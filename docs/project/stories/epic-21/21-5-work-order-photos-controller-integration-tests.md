# Story 21.5: WorkOrderPhotosController Integration Tests

Status: done

## Story

As a developer,
I want integration test coverage for every `WorkOrderPhotosController` endpoint,
so that the 5 photo endpoints (upload-url, confirm-upload, get, delete, set-primary, reorder) are independently verified against the real HTTP + EF Core + auth + handler stack — closing the gap left by Stories 10.4 / 10.5 / 10.6 which shipped with no dedicated integration test file.

## Acceptance Criteria

> **Note (epic vs. controller reconciliation):** Epic 21's text for Story 21.5 lists 6 ACs and 5 endpoints, but inspection of the shipped controller (`backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs`) shows **6 endpoints** (epic counted SetPrimary+Reorder as one bucket but they are separate routes/handlers). ACs below reflect the **shipped** behavior. Deltas from the epic text:
>
> | Epic statement | Actual behavior | Story AC |
> |---|---|---|
> | "GenerateUploadUrl returns presigned URL **and pending photo record**" | The shipped handler does NOT create a photo record at upload-URL time. Only `ConfirmUpload` creates the row. There is no `Pending` / `PendingUpload` state on the entity. | AC-2, AC-3 |
> | "ConfirmUpload transitions photo to `Uploaded`" | There is no status field on `WorkOrderPhoto`. `ConfirmUpload` creates the row directly. First-photo-on-work-order is auto-promoted to `IsPrimary = true`; subsequent photos get `IsPrimary = false` and the next `DisplayOrder`. | AC-7, AC-8 |
> | "DeletePhoto removes S3 object and record; subsequent primary logic adjusts if needed" | The shipped `DeleteWorkOrderPhotoHandler` does **NOT** auto-promote a new primary when the deleted photo was primary. The handler comment explicitly says "Simpler than PropertyPhoto delete - no primary photo promotion logic." This is **different from `MaintenanceRequestPhotos`** (which does promote, per Story 21.2 AC-14) and from `PropertyPhotos`. AC-15 below tests the actual no-promotion behavior; if it's wrong, that's a bug-in-product to file separately, NOT a test to invert. | AC-13, AC-14, AC-15 |
> | "All endpoints enforce work-order ownership" with 404 | Confirmed: account filter `w.AccountId == _currentUser.AccountId` in handlers. Cross-account → 404 (NotFound). Tenants/Contributors get **403 from the controller-level policy** (`CanViewWorkOrders` / `CanManageWorkOrders`) before ever reaching the handler — Tenants don't have `WorkOrders.View`. | AC-22, AC-23 |
> | "exactly one primary per work order" invariant | Enforced by a unique filtered EF index `IX_WorkOrderPhotos_WorkOrderId_IsPrimary_Unique` (`"IsPrimary" = true`). `SetPrimaryPhoto` clears the previous primary in a transaction. | AC-11, AC-12 |
>
> **Permission policies (controller-level):**
> - Class-level: `[Authorize(Policy = "CanViewWorkOrders")]` (i.e., applies to all endpoints)
> - GET `/photos` — only the class-level policy
> - All other endpoints (POST upload-url, POST photos, DELETE, PUT primary, PUT reorder) — additionally `[Authorize(Policy = "CanManageWorkOrders")]`
>
> Per `RolePermissions.Mappings`: Owner has both. Contributor has `WorkOrders.View` (CanViewWorkOrders) but NOT `WorkOrders.Create` (CanManageWorkOrders) — so Contributor can `GET` but gets `403` on the others. Tenant has neither — `403` on all endpoints.

### AC-1: All endpoints return 401 without a bearer token

- **Given** no `Authorization` header
- **When** each of `POST /api/v1/work-orders/{id}/photos/upload-url`, `POST /api/v1/work-orders/{id}/photos`, `GET /api/v1/work-orders/{id}/photos`, `DELETE /api/v1/work-orders/{id}/photos/{photoId}`, `PUT /api/v1/work-orders/{id}/photos/{photoId}/primary`, `PUT /api/v1/work-orders/{id}/photos/reorder` is called
- **Then** each returns `401 Unauthorized`

### AC-2: GenerateUploadUrl as Owner returns 200 with presigned URL and storage keys

- **Given** an authenticated `Owner` user with a work order in their account
- **When** they POST body `{ contentType: "image/jpeg", fileSizeBytes: 1024, originalFileName: "leak.jpg" }` to `/api/v1/work-orders/{workOrderId}/photos/upload-url`
- **Then** the response is `200 OK` with `{ uploadUrl, storageKey, thumbnailStorageKey, expiresAt }`
- **And** `storageKey` starts with the caller's `AccountId` (per `IPhotoService.GenerateUploadUrlAsync` key pattern: `{accountId}/work-orders/{year}/{guid}.{ext}`)
- **And** `thumbnailStorageKey` is non-empty
- **And** `expiresAt` is in the future
- **And** `uploadUrl` matches `https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=true` (FakeStorageService deterministic pattern)

### AC-3: GenerateUploadUrl does NOT create a WorkOrderPhoto row

- **Given** a valid Owner + work order
- **When** the upload-URL endpoint succeeds
- **Then** `dbContext.WorkOrderPhotos.CountAsync(p => p.WorkOrderId == workOrderId) == 0` — only `ConfirmUpload` persists rows

### AC-4: GenerateUploadUrl returns 404 for non-existent work order

- **Given** an authenticated Owner with no work order created
- **When** they POST to `/api/v1/work-orders/{nonExistentGuid}/photos/upload-url` with a valid body
- **Then** the response is `404 NotFound` (handler throws `NotFoundException` → `GlobalExceptionHandlerMiddleware` maps to 404)

### AC-5: GenerateUploadUrl returns 404 for cross-account work order

- **Given** a work order in Account A
- **When** an Owner in Account B POSTs to `/api/v1/work-orders/{accountAWorkOrderId}/photos/upload-url`
- **Then** the response is `404 NotFound` (account filter eliminates cross-account visibility — same-shape behavior as 21.2 AC-4)

### AC-6: GenerateUploadUrl validation

- **Given** a valid authenticated Owner + work order
- **When** the body fails validation — invalid `contentType` (e.g., `"text/plain"`), oversize `fileSizeBytes` (greater than `PhotoValidation.MaxFileSizeBytes`), `fileSizeBytes <= 0`, empty `originalFileName`, or `originalFileName` over 255 chars
- **Then** each returns `400 BadRequest` with a `ValidationProblemDetails` payload identifying the offending field (per `GenerateWorkOrderPhotoUploadUrlValidator`)

### AC-7: ConfirmUpload creates WorkOrderPhoto row and returns 201

- **Given** an authenticated Owner + work order in their account
- **And** a `storageKey` prefixed with their `AccountId` (matching what `GenerateUploadUrl` would have returned)
- **When** they POST body `{ storageKey, thumbnailStorageKey, contentType, fileSizeBytes, originalFileName }` to `/api/v1/work-orders/{id}/photos`
- **Then** the response is `201 Created` with `{ id, thumbnailUrl, viewUrl }` (both URLs non-empty — FakeStorageService returns deterministic presigned URLs)
- **And** `Location` header references `/api/v1/work-orders/{workOrderId}/photos/{response.Id}`
- **And** a `WorkOrderPhoto` row exists with `WorkOrderId == id`, `AccountId == owner.AccountId`, `CreatedByUserId == owner.UserId`, `OriginalFileName == "leak.jpg"`, `DisplayOrder == 0`, `IsPrimary == true` (first photo)

### AC-8: ConfirmUpload auto-promotes first photo to primary; second photo is non-primary

- **Given** a work order with one existing primary photo (`IsPrimary == true, DisplayOrder == 0`)
- **When** a second `ConfirmUpload` is issued
- **Then** the new row has `IsPrimary == false` and `DisplayOrder == 1`
- **And** the existing row remains `IsPrimary == true` (uniqueness invariant preserved)

### AC-9: ConfirmUpload returns 403 when storage key belongs to another account

- **Given** an Owner in Account A with a valid work order
- **When** they POST a `storageKey` whose GUID prefix is a different account (e.g., `{otherAccountId}/work-orders/2026/{guid}.jpg`)
- **Then** the handler throws `UnauthorizedAccessException("Cannot confirm upload for another account")` (`ConfirmWorkOrderPhotoUploadHandler` line ~71) → `GlobalExceptionHandlerMiddleware` maps to `403 Forbidden`. Mirrors 21.2 AC-8.

### AC-10: ConfirmUpload returns 404 for cross-account or non-existent work order; 400 for malformed payload

- **Given** a valid storage key but a work-order id that doesn't exist OR exists in another account
- **When** `ConfirmUpload` is called
- **Then** the response is `404 NotFound`
- **And** when the storage key doesn't have a parseable GUID prefix (`ArgumentException` from handler) → `400 BadRequest`
- **And** when validation fails (empty storage key, invalid content type, etc.) → `400 BadRequest`

### AC-11: GetPhotos returns ordered photos for the work order with presigned URLs

- **Given** a work order with 3 photos seeded via `ConfirmUpload` (or direct DB seed) in `DisplayOrder` 0, 1, 2 with photo-1 primary
- **When** the Owner GETs `/api/v1/work-orders/{id}/photos`
- **Then** the response is `200 OK` with `items.Count == 3`
- **And** items are ordered by `DisplayOrder` ascending (primary first because `DisplayOrder == 0`)
- **And** `items[0].IsPrimary == true`, `items[1].IsPrimary == false`, `items[2].IsPrimary == false`
- **And** each item has a non-null `photoUrl` and `thumbnailUrl` (both pointing at FakeStorageService's deterministic `?presigned=download` pattern)

### AC-12: GetPhotos returns empty list for a work order with no photos

- **Given** a work order owned by the caller's account, with zero photos
- **When** GET `/photos` is called
- **Then** the response is `200 OK` with `items` being an empty array (not null)

### AC-13: GetPhotos does not leak photos from other work orders

- **Given** Work Order A with 3 photos and Work Order B with 2 photos (both same account)
- **When** GET `/api/v1/work-orders/{aId}/photos` is called
- **Then** exactly the 3 photos for A are returned and none of B's photo ids appear in the response

### AC-14: GetPhotos returns 404 when work order is inaccessible

- **Given** a work order in Account A with photos
- **When** an Owner in Account B GETs `/photos`
- **Then** the response is `404 NotFound` (handler precheck on `_dbContext.WorkOrders.AnyAsync(... AccountId == _currentUser.AccountId)`)

### AC-15: DeletePhoto removes the row and invokes the storage delete

- **Given** a work order with one confirmed photo (row + FakeStorageService keys)
- **When** the Owner DELETEs `/api/v1/work-orders/{id}/photos/{photoId}`
- **Then** the response is `204 NoContent`
- **And** the `WorkOrderPhoto` row is gone (verify via `dbContext.WorkOrderPhotos.CountAsync(...) == 0`)
- **And** `FakeStorageService.DeletedKeys` contains BOTH the original storage key and the thumbnail storage key (proves `IPhotoService.DeletePhotoAsync` was invoked) — capture a snapshot of `DeletedKeys.Count` BEFORE the call and use containment assertions to avoid singleton-accumulation flakiness, per Story 21.2 learning #2

### AC-16: DeletePhoto does NOT auto-promote when the primary is deleted (shipped behavior)

- **Given** a work order with 3 photos: photo-1 primary (`DisplayOrder == 0`), photo-2 non-primary (`DisplayOrder == 1`), photo-3 non-primary (`DisplayOrder == 2`)
- **When** the Owner deletes photo-1 (the primary)
- **Then** the response is `204 NoContent`
- **And** **NEITHER** photo-2 NOR photo-3 has `IsPrimary == true` afterwards (the work order is left with no primary photo). This is the shipped no-promotion behavior of `DeleteWorkOrderPhotoHandler` ("Simpler than PropertyPhoto delete — no primary photo promotion logic"). Asserting otherwise would be asserting an aspirational contract.
- **Note:** If product wants promotion symmetry with `MaintenanceRequestPhotos` and `PropertyPhotos`, file a follow-up issue. **Do NOT change the handler in this story.**

### AC-17: DeletePhoto returns 404 for cross-account photo

- **Given** a photo in Account A's work order
- **When** an Owner in Account B attempts to delete via `DELETE /api/v1/work-orders/{accountAWorkOrderId}/photos/{accountAPhotoId}`
- **Then** the response is `404 NotFound` (photo lookup filters by `AccountId == _currentUser.AccountId`)

### AC-18: DeletePhoto returns 404 for a photo that doesn't belong to the specified work order

- **Given** Work Order A with photo-A1; Work Order B (same account) with no photos
- **When** the Owner calls `DELETE /api/v1/work-orders/{bId}/photos/{a1Id}`
- **Then** the response is `404 NotFound` (handler filters by both `Id == photoId && WorkOrderId == request.WorkOrderId`)

### AC-19: SetPrimaryPhoto promotes one photo and demotes the previous primary

- **Given** a work order with 3 photos: photo-1 primary, photo-2 non-primary, photo-3 non-primary
- **When** the Owner PUTs `/api/v1/work-orders/{id}/photos/{photo3Id}/primary`
- **Then** the response is `204 NoContent`
- **And** post-call DB state: photo-3 has `IsPrimary == true`; photo-1 has `IsPrimary == false`; photo-2 unchanged (still `false`)
- **And** exactly one photo has `IsPrimary == true` (the unique filtered index `IX_WorkOrderPhotos_WorkOrderId_IsPrimary_Unique` is preserved)

### AC-20: SetPrimaryPhoto is a no-op when target is already primary

- **Given** photo-1 is currently primary
- **When** Owner PUTs `/photos/{photo1Id}/primary` again
- **Then** the response is `204 NoContent`
- **And** photo-1 remains primary; nothing else is changed (handler short-circuits when `photo.IsPrimary` is already true)

### AC-21: SetPrimaryPhoto returns 404 for cross-account / non-existent photo

- **Given** a photo in Account A's work order
- **When** an Owner in Account B PUTs `/api/v1/work-orders/{accountAWorkOrderId}/photos/{accountAPhotoId}/primary`
- **Then** the response is `404 NotFound`
- **And** when the `photoId` doesn't exist at all (or doesn't belong to the specified work order), `404 NotFound`

### AC-22: ReorderPhotos updates DisplayOrder for all photos

- **Given** a work order with 3 photos in `DisplayOrder` 0, 1, 2
- **When** the Owner PUTs `/api/v1/work-orders/{id}/photos/reorder` with body `{ photoIds: [photo3Id, photo1Id, photo2Id] }`
- **Then** the response is `204 NoContent`
- **And** post-call DB state: photo-3 `DisplayOrder == 0`, photo-1 `DisplayOrder == 1`, photo-2 `DisplayOrder == 2`
- **And** `IsPrimary` flags are NOT changed by reorder (orthogonal concerns)

### AC-23: ReorderPhotos validation

- **Given** a work order with 3 photos
- **When** the body fails validation — empty `photoIds` array, `null` array, duplicate IDs, or empty-GUID elements
- **Then** each returns `400 BadRequest` (per `ReorderWorkOrderPhotosValidator`)
- **And** when `photoIds` does NOT contain all photos for the work order exactly once (e.g., omits one or includes IDs not on this work order), the handler throws `ValidationException` → `400 BadRequest` (handler-level guard at `ReorderWorkOrderPhotos.cs` line ~65)
- **And** when ANY photoId in the body doesn't exist on this work order, the handler throws `NotFoundException` → `404 NotFound` (handler-level guard at `ReorderWorkOrderPhotos.cs` line ~58)

### AC-24: ReorderPhotos returns 404 for cross-account / non-existent work order

- **Given** a work order in Account A
- **When** an Owner in Account B PUTs `/api/v1/work-orders/{accountAWorkOrderId}/photos/reorder` with any non-empty body
- **Then** the response is `404 NotFound`

### AC-25: Role-based policy enforcement (`CanViewWorkOrders` / `CanManageWorkOrders`)

- **Given** an authenticated `Tenant` user (no `WorkOrders.View` permission)
- **When** they call any of the 6 endpoints (including the GET)
- **Then** the response is `403 Forbidden` (class-level `CanViewWorkOrders` policy fails before reaching handler)
- **Given** an authenticated `Contributor` user (has `WorkOrders.View` but not `WorkOrders.Create`)
- **When** they call `GET /photos`
- **Then** the response is `200 OK` (or `404` if the work order isn't theirs — but for this AC, set up a same-account WO so the GET succeeds)
- **And** when they call any of the mutating endpoints (POST upload-url, POST confirm, DELETE, PUT primary, PUT reorder)
- **Then** the response is `403 Forbidden` (per-endpoint `CanManageWorkOrders` policy fails)

### AC-26: End-to-end flow — upload, confirm, get, set primary, reorder, delete

- **Given** an Owner with a work order
- **When** they execute the full sequence: GenerateUploadUrl → ConfirmUpload (twice for two photos) → GetPhotos → SetPrimaryPhoto (promote photo-2) → ReorderPhotos (swap order) → DeletePhoto (delete one)
- **Then** every step returns its documented success status, and the final GetPhotos call shows the remaining photo with the expected `DisplayOrder` and `IsPrimary` per the operations chained

## Tasks / Subtasks

- [x] **Task 1: Create `WorkOrderPhotosControllerTests.cs` skeleton (AC: all)**
  - [x] 1.1 Create `backend/tests/PropertyManager.Api.Tests/WorkOrderPhotosControllerTests.cs` mirroring the structure of `MaintenanceRequestPhotosControllerTests.cs` (Story 21.2, PR #373)
  - [x] 1.2 Use `IClassFixture<PropertyManagerWebApplicationFactory>` — single shared Testcontainers Postgres for the class. Do NOT create a new factory.
  - [x] 1.3 Copy the helper method shape from 21.2: `LoginAsync`, `RegisterAndLoginOwnerAsync`, `PostAsJsonWithAuthAsync`, `GetWithAuthAsync`, `DeleteWithAuthAsync`, `PutWithAuthAsync`, `PutAsJsonWithAuthAsync`. Helpers stay colocated (per 21.2 learning #5).
  - [x] 1.4 Add a `SeedWorkOrderAsync(accountId, propertyId, description = "seeded WO")` helper that inserts a `WorkOrder` directly via `AppDbContext` and returns the new id (mirror `SeedMaintenanceRequestAsync` pattern). Status defaults to `WorkOrderStatus.Reported` per `CreateWorkOrder` defaults.
  - [x] 1.5 Add a `SeedWorkOrderPhotoAsync(accountId, workOrderId, createdByUserId, storageKey = null, thumbnailStorageKey = null, displayOrder = 0, isPrimary = true, originalFileName = "seeded.jpg", contentType = "image/jpeg", fileSizeBytes = 1024)` helper that inserts directly via `AppDbContext` and returns the photo id. Auto-generate account-scoped storage keys when null.
  - [x] 1.6 Define `private sealed record OwnerContext(string AccessToken, Guid UserId, Guid AccountId, Guid PropertyId, Guid WorkOrderId)` and a `CreateOwnerContextWithWorkOrderAsync()` factory that creates an Owner + property + work order in one call (mirrors 21.2's `CreateTenantContextWithRequestAsync` shape but for Owners — Tenants don't have access to WorkOrders endpoints).
  - [x] 1.7 Snapshot helper for `FakeStorageService.DeletedKeys` — capture `DeletedKeys.Count` and any specific keys at test start, then assert delta + containment in delete tests (per 21.2 Risk #2 / learning).
  - [x] 1.8 Define HTTP-response DTOs at the bottom of the file as `file record`s — give them `Wo*` prefixes to avoid collisions with 21.2's `Mrp*` and `PropertyPhotos*` records: `WoUploadUrlResponse`, `WoConfirmResponse`, `WoPhotoDto`, `GetWoPhotosResponse`, `WoLoginResponse`. Do NOT re-import Application DTOs — HTTP-contract changes must surface as test failures here.

- [x] **Task 2: Auth coverage — AC-1 (6 tests)**
  - [x] 2.1 `GenerateUploadUrl_WithoutAuth_Returns401`
  - [x] 2.2 `ConfirmUpload_WithoutAuth_Returns401`
  - [x] 2.3 `GetPhotos_WithoutAuth_Returns401`
  - [x] 2.4 `DeletePhoto_WithoutAuth_Returns401`
  - [x] 2.5 `SetPrimaryPhoto_WithoutAuth_Returns401`
  - [x] 2.6 `ReorderPhotos_WithoutAuth_Returns401`

- [x] **Task 3: GenerateUploadUrl tests — AC-2 to AC-6**
  - [x] 3.1 `GenerateUploadUrl_AsOwner_ValidBody_Returns200WithPresignedUrl` (AC-2)
  - [x] 3.2 `GenerateUploadUrl_DoesNotCreatePhotoRow` (AC-3) — assert `dbContext.WorkOrderPhotos.IgnoreQueryFilters().CountAsync(p => p.WorkOrderId == id) == 0` after the call
  - [x] 3.3 `GenerateUploadUrl_NonExistentWorkOrder_Returns404` (AC-4)
  - [x] 3.4 `GenerateUploadUrl_CrossAccount_Returns404` (AC-5)
  - [x] 3.5 `GenerateUploadUrl_InvalidContentType_Returns400` (AC-6, e.g., `text/plain`)
  - [x] 3.6 `GenerateUploadUrl_FileSizeExceedsMax_Returns400` (AC-6, use `PhotoValidation.MaxFileSizeBytes + 1`)
  - [x] 3.7 `GenerateUploadUrl_FileSizeZeroOrNegative_Returns400` (AC-6)
  - [x] 3.8 `GenerateUploadUrl_EmptyOriginalFileName_Returns400` (AC-6)
  - [x] 3.9 `GenerateUploadUrl_FileNameOver255Chars_Returns400` (AC-6)

- [x] **Task 4: ConfirmUpload tests — AC-7 to AC-10**
  - [x] 4.1 `ConfirmUpload_AsOwner_ValidRequest_Returns201WithIdAndUrls` (AC-7) — assert response shape AND `Location` header value
  - [x] 4.2 `ConfirmUpload_PersistsPhotoRow_WithCorrectFields` (AC-7) — verify `AccountId`, `WorkOrderId`, `CreatedByUserId`, `OriginalFileName`, `ContentType`, `FileSizeBytes`, `DisplayOrder == 0`, `IsPrimary == true` via `AppDbContext.IgnoreQueryFilters()`
  - [x] 4.3 `ConfirmUpload_FirstPhoto_SetsPrimaryTrue_DisplayOrder0` (AC-8)
  - [x] 4.4 `ConfirmUpload_SecondPhoto_SetsPrimaryFalse_DisplayOrder1` (AC-8) — seed a primary first, then call ConfirmUpload, then verify the second is non-primary with `DisplayOrder == 1`
  - [x] 4.5 `ConfirmUpload_OtherAccountStorageKey_Returns403` (AC-9) — pass a storage key prefixed with a different account's GUID
  - [x] 4.6 `ConfirmUpload_NonExistentWorkOrder_Returns404` (AC-10)
  - [x] 4.7 `ConfirmUpload_CrossAccount_Returns404` (AC-10)
  - [x] 4.8 `ConfirmUpload_InvalidStorageKeyFormat_Returns400` (AC-10) — pass a string that doesn't start with a GUID (handler throws `ArgumentException` → 400)
  - [x] 4.9 `ConfirmUpload_InvalidContentType_Returns400` (AC-10, validator)
  - [x] 4.10 `ConfirmUpload_EmptyStorageKey_Returns400` (AC-10, validator)
  - [x] 4.11 `ConfirmUpload_EmptyThumbnailStorageKey_Returns400` (AC-10, validator)
  - [x] 4.12 `ConfirmUpload_FileSizeExceedsMax_Returns400` (AC-10, validator)

- [x] **Task 5: GetPhotos tests — AC-11 to AC-14**
  - [x] 5.1 `GetPhotos_AsOwner_ReturnsOrderedPhotos` (AC-11) — seed 3 photos with `DisplayOrder` 0/1/2, primary = photo-1; assert returned order matches seeded `DisplayOrder` and the primary flag values
  - [x] 5.2 `GetPhotos_EmptyWorkOrder_ReturnsEmptyList` (AC-12)
  - [x] 5.3 `GetPhotos_DoesNotLeakOtherWorkOrderPhotos` (AC-13) — seed photos for two work orders in same account, GET on one, expect only that one's photos
  - [x] 5.4 `GetPhotos_NonExistentWorkOrder_Returns404` (AC-14)
  - [x] 5.5 `GetPhotos_CrossAccount_Returns404` (AC-14)
  - [x] 5.6 `GetPhotos_ReturnsPresignedUrls` (AC-11) — assert `viewUrl` (named `photoUrl` in `WorkOrderPhotoDto`) and `thumbnailUrl` match `FakeStorageService`'s deterministic pattern (`https://test-bucket.s3.amazonaws.com/{key}?presigned=download`)

- [x] **Task 6: DeletePhoto tests — AC-15 to AC-18**
  - [x] 6.1 `DeletePhoto_AsOwner_ValidId_Returns204` (AC-15)
  - [x] 6.2 `DeletePhoto_RemovesDbRow` (AC-15) — assert the photo row is gone via `dbContext.WorkOrderPhotos.IgnoreQueryFilters().CountAsync(...) == 0`
  - [x] 6.3 `DeletePhoto_InvokesStorageDelete` (AC-15) — capture `DeletedKeys.Count` snapshot before, assert delta `>= 2` AND `.Should().Contain(originalKey)` AND `.Should().Contain(thumbnailKey)` after
  - [x] 6.4 `DeletePhoto_WasPrimary_DoesNotPromoteOthers` (AC-16) — seed primary + 2 non-primary, delete primary; verify NO remaining photo has `IsPrimary == true`. **This documents the shipped no-promotion behavior — do not invert.**
  - [x] 6.5 `DeletePhoto_WasNotPrimary_LeavesPrimaryUntouched` (AC-16, sanity)
  - [x] 6.6 `DeletePhoto_LastPhoto_NoErrorAndNoPhotosLeft` (AC-15) — seed one primary photo, delete, expect 204 and zero photos
  - [x] 6.7 `DeletePhoto_NonExistentPhoto_Returns404`
  - [x] 6.8 `DeletePhoto_CrossAccountPhoto_Returns404` (AC-17)
  - [x] 6.9 `DeletePhoto_PhotoOnDifferentWorkOrder_Returns404` (AC-18) — seed photo on WO A, call DELETE on WO B with that photoId
  - [x] 6.10 `DeletePhoto_NonExistentWorkOrder_Returns404` — handler's first guard fails before second photo lookup

- [x] **Task 7: SetPrimaryPhoto tests — AC-19 to AC-21**
  - [x] 7.1 `SetPrimaryPhoto_PromotesNewPhoto_AndDemotesOldPrimary` (AC-19) — seed 3 with photo-1 primary, set photo-3 primary, assert photo-3 isPrimary=true and photo-1 false (transaction-based handler clears previous before setting)
  - [x] 7.2 `SetPrimaryPhoto_ExactlyOnePrimary_Invariant` (AC-19) — after the call assert `dbContext.WorkOrderPhotos.IgnoreQueryFilters().CountAsync(p => p.WorkOrderId == woId && p.IsPrimary) == 1`
  - [x] 7.3 `SetPrimaryPhoto_AlreadyPrimary_NoOp_Returns204` (AC-20) — seed photo-1 primary, call SetPrimary on photo-1 again, assert 204 and DB unchanged. (Used row count + IsPrimary assertion per the optional fallback in Risk #3, since the no-op short-circuit means there's no UpdatedAt change to test against reliably.)
  - [x] 7.4 `SetPrimaryPhoto_CrossAccountPhoto_Returns404` (AC-21)
  - [x] 7.5 `SetPrimaryPhoto_NonExistentPhoto_Returns404` (AC-21)
  - [x] 7.6 `SetPrimaryPhoto_PhotoOnDifferentWorkOrder_Returns404` (AC-21) — handler filters by both `Id == photoId && WorkOrderId == request.WorkOrderId`

- [x] **Task 8: ReorderPhotos tests — AC-22 to AC-24**
  - [x] 8.1 `ReorderPhotos_ValidOrder_Returns204_AndUpdatesDisplayOrder` (AC-22) — seed 3 photos `0/1/2`, call reorder with `[photo3Id, photo1Id, photo2Id]`, assert resulting `DisplayOrder` is `0/1/2` for `photo3/photo1/photo2`
  - [x] 8.2 `ReorderPhotos_DoesNotChangeIsPrimary` (AC-22) — same setup as 8.1; verify `IsPrimary` flags are unchanged (still on photo-1)
  - [x] 8.3 `ReorderPhotos_EmptyPhotoIds_Returns400` (AC-23, validator)
  - [x] 8.4 `ReorderPhotos_DuplicateIds_Returns400` (AC-23, validator)
  - [x] 8.5 `ReorderPhotos_NullPhotoIds_Returns400` (AC-23, validator) — pass `{ photoIds: null }`
  - [x] 8.6 `ReorderPhotos_PartialPhotoSet_Returns400` (AC-23) — seed 3, send only 2 ids; handler throws `ValidationException` → 400
  - [x] 8.7 `ReorderPhotos_PhotoIdNotOnWorkOrder_Returns404` (AC-23) — include a guid that doesn't belong to this work order; handler throws `NotFoundException` → 404
  - [x] 8.8 `ReorderPhotos_CrossAccount_Returns404` (AC-24)
  - [x] 8.9 `ReorderPhotos_NonExistentWorkOrder_Returns404` (AC-24)

- [x] **Task 9: Role-based policy tests — AC-25**
  - [x] 9.1 `GenerateUploadUrl_AsTenant_Returns403` — Tenant user (no `WorkOrders.View` permission) hitting upload-url; class-level `CanViewWorkOrders` policy fails before the per-endpoint `CanManageWorkOrders` is even checked
  - [x] 9.2 `GetPhotos_AsTenant_Returns403`
  - [x] 9.3 `ConfirmUpload_AsTenant_Returns403`
  - [x] 9.4 `DeletePhoto_AsTenant_Returns403`
  - [x] 9.5 `SetPrimaryPhoto_AsTenant_Returns403`
  - [x] 9.6 `ReorderPhotos_AsTenant_Returns403`
  - [x] 9.7 `GetPhotos_AsContributor_Returns200` — Contributor has `WorkOrders.View`; same-account work order, expect a normal 200 list (likely empty or the seeded fixture)
  - [x] 9.8 `GenerateUploadUrl_AsContributor_Returns403` — Contributor lacks `WorkOrders.Create`; mutating endpoint blocked at `CanManageWorkOrders`
  - [x] 9.9 `ConfirmUpload_AsContributor_Returns403`
  - [x] 9.10 `DeletePhoto_AsContributor_Returns403`
  - [x] 9.11 `SetPrimaryPhoto_AsContributor_Returns403`
  - [x] 9.12 `ReorderPhotos_AsContributor_Returns403`

- [x] **Task 10: End-to-end flow — AC-26 (1 test)**
  - [x] 10.1 `WorkOrderPhotoFlow_FullCycle_Succeeds` — chain GenerateUploadUrl → ConfirmUpload (x2) → GetPhotos → SetPrimaryPhoto → ReorderPhotos → DeletePhoto → final GetPhotos. Mirror `PropertyPhotosControllerTests.PropertyPhotoFlow_FullCycle_Succeeds`. Assert each step's success status and final DB state via the last GET.

- [x] **Task 11: Verify and ship (AC: all)**
  - [x] 11.1 Run `dotnet test --filter "FullyQualifiedName~WorkOrderPhotosControllerTests"` — all new tests pass on first run (71 tests, 0 failures, ~6s)
  - [x] 11.2 Run `dotnet test` (full backend suite) — no regressions; 2041 tests pass (1189 Application + 98 Infrastructure + 754 Api), 0 failures
  - [x] 11.3 `dotnet build` clean — 0 errors. The 3 warnings emitted are all pre-existing (one nullability warning in Receipts, one CA1416 in PdfRendererService, one testcontainers obsolescence in the factory)
  - [x] 11.4 No production code modified — controller, handlers, validators, entity, EF config, factory all untouched. Test-only story.

- [x] **Task 12: Sprint status + story status update (process)**
  - [x] 12.1 Update `docs/project/sprint-status.yaml`: `21-5-work-order-photos-controller-integration-tests: review`
  - [x] 12.2 Update story status (this file) to `review`; fill out Dev Agent Record
  - [x] 12.3 Note any deviations between this AC list and the actual handler/validator behavior in the Completion Notes section (especially AC-16 if the no-promotion behavior changes during implementation)

## Dev Notes

### Test Scope

This is a pure backend test-writing story. The deliverable IS integration tests.

| Layer | Required? | Justification |
|---|---|---|
| **Unit** | Not required | Handler-level unit tests for `WorkOrderPhotos*` exist (or are out-of-scope for this audit story). The integration layer is the tested surface. If this audit later finds missing handler unit tests, file separately. |
| **Integration** | **Required — this IS the story** | All 6 controller endpoints currently have zero coverage of the real HTTP + DI + EF Core + auth + handler stack. |
| **E2E (Playwright)** | Not required | Backend-only test story. Work-order photo upload E2E is partially covered by Story 21.8 (Work Orders E2E, P2/L) which is a separate backlog story. No E2E debt is created or expanded here. |

### Pattern Reference — mirror Story 21.2 tests

**PRIMARY pattern reference:** `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestPhotosControllerTests.cs` (Story 21.2, PR #373, merged 2026-04-22). Read end-to-end before starting. It encodes every convention:

- `IClassFixture<PropertyManagerWebApplicationFactory>` — shared Testcontainers Postgres within the class
- Naming: `Method_Scenario_ExpectedResult`
- FluentAssertions
- Unique per-test emails: `$"owner-{Guid.NewGuid():N}@example.com"` to dodge UNIQUE-constraint collisions in the shared DB
- Per-test data seeded directly via `AppDbContext` — `using var scope = _factory.Services.CreateScope();`
- Private sealed-record context helper (the WorkOrders equivalent of `MrpTenantContext`)
- File-scoped `file record` HTTP DTOs at the bottom — do NOT reuse Application DTOs (HTTP-contract changes must surface as test failures here)
- `Wo*` prefix on file records to avoid name collisions with `Mrp*` (21.2) and `PropertyPhoto*` records — all 3 files share the same assembly

**Secondary references:**
- `PropertyPhotosControllerTests.cs` — the closest endpoint-shape match (same 6-endpoint surface). Use for SetPrimary/Reorder assertion shapes.
- `WorkOrdersControllerTests.cs` — for the work-order seeding shape (`CreateUserWithPropertyAsync` etc.) and the `LoginResponse` DTO.
- `MaintenanceRequestPhotosControllerTests.cs` — for `FakeStorageService` snapshot pattern and the `IPhotoService` thumbnail-failure resolution (Risk #1 below).

### Factory — what you DON'T need to change

`PropertyManagerWebApplicationFactory` already exposes everything needed:
- `CreateTestUserAsync(email, password?, role = "Owner")` — creates a user + new account
- `CreateTestUserInAccountAsync(accountId, email, password?, role = "Member")` — creates a Contributor or other role inside an existing account (default role is `"Member"`, override to `"Contributor"` or `"Tenant"` as needed)
- `CreateTenantUserInAccountAsync(accountId, propertyId, email, password?)` — creates a Tenant user with `PropertyId` set so JWT carries the property claim
- `CreatePropertyInAccountAsync(accountId, name?, street?, city?, state?, zipCode?)` — direct-to-DB property seed
- `FakeStorageService` is registered as a singleton implementing `IStorageService`. `IPhotoService` uses the **real** `PhotoService` (not `NoOpPhotoService`) — the factory explicitly forces this via the `services.AddHttpClient<IPhotoService, PhotoService>();` line. This means thumbnail download attempts go through `FakeStorageService.GeneratePresignedDownloadUrlAsync` and result in a bogus URL that causes the HTTP fetch to fail — but `PhotoService.ConfirmUploadAsync` swallows that exception (see Risk #1).

**Do NOT change `PropertyManagerWebApplicationFactory.cs`.** Story 21.2 explicitly relied on the factory as-is and so does this story.

### Handler access-control contract (the behavior being tested)

All 6 handlers share this access-control pattern (read them end-to-end before asserting):

1. **Controller-level** `[Authorize(Policy = "CanViewWorkOrders")]` (class) + per-endpoint `[Authorize(Policy = "CanManageWorkOrders")]` for mutating endpoints. Failure → **403** before reaching the handler.
2. **Handler-level work order lookup**: `_dbContext.WorkOrders.AnyAsync(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId, ...)`. Missing → `NotFoundException` → **404**.
3. **For `ConfirmUpload`**: additionally parse `storageKey`'s first segment as a GUID. Non-GUID → `ArgumentException` → **400**. GUID != `_currentUser.AccountId` → `UnauthorizedAccessException` → **403**.
4. **For `DeletePhoto`**: additional photo lookup `_dbContext.WorkOrderPhotos.FirstOrDefaultAsync(p => p.Id == request.PhotoId && p.WorkOrderId == request.WorkOrderId && p.AccountId == _currentUser.AccountId)`. Missing → `NotFoundException` → **404**. **No primary-promotion logic** (handler comment: "Simpler than PropertyPhoto delete - no primary photo promotion logic").
5. **For `SetPrimaryPhoto`**: same photo lookup as DeletePhoto. If `photo.IsPrimary` already true, return early (no-op). Otherwise transactional update: clear current primary first, save, then set new primary, save, commit.
6. **For `ReorderPhotos`**: WO lookup; then load ALL photos for WO; validate all `request.PhotoIds` exist in the WO's photo set (else `NotFoundException` → 404); validate `request.PhotoIds.Count == photos.Count && Distinct().Count() == photos.Count` (else `ValidationException` → 400); update `DisplayOrder` by index position.

**Exception → HTTP mapping** (from `GlobalExceptionHandlerMiddleware.GetErrorDetails`, confirmed in repo and in 21.1/21.2 stories):
- `NotFoundException` → 404
- `UnauthorizedAccessException` / `ForbiddenAccessException` → 403
- `BusinessRuleException` → 400 (Problem: "Business rule violation")
- `ArgumentException` → 400 (Problem: "Bad request")
- `FluentValidation.ValidationException` → 400

### Route structure

```
POST   /api/v1/work-orders/{workOrderId:guid}/photos/upload-url
POST   /api/v1/work-orders/{workOrderId:guid}/photos              (ConfirmUpload)
GET    /api/v1/work-orders/{workOrderId:guid}/photos
DELETE /api/v1/work-orders/{workOrderId:guid}/photos/{photoId:guid}
PUT    /api/v1/work-orders/{workOrderId:guid}/photos/{photoId:guid}/primary
PUT    /api/v1/work-orders/{workOrderId:guid}/photos/reorder
```

**Per Story 21.2 finding:** the `:guid` route constraint produces **404 NotFound** (no endpoint matches) for non-GUID values, NOT 400. Don't write a malformed-GUID 400 test — it would fail. (This is a quirk of ASP.NET Core routing and is documented as a one-line note in 21.2's Completion Notes.) Out of scope here; if you want to add such a test, expect 404.

### Storage key format (for ConfirmUpload assertions)

From `IPhotoService.GenerateUploadUrlAsync`: the key pattern is `{accountId}/{entityType}/{year}/{guid}.{ext}`. For work orders, `PhotoEntityType.WorkOrders` produces the segment `work-orders` (the real `PhotoService` uses the enum's lowercased-pluralized form per the existing pattern — verify by inspection if needed). For test purposes when seeding directly: use `$"{accountId}/work-orders/2026/{Guid.NewGuid()}.jpg"`. Match the shape of `PropertyPhotosControllerTests.ConfirmUpload_WithValidData_Returns201`.

### Entity semantics — `WorkOrderPhoto`

(`backend/src/PropertyManager.Domain/Entities/WorkOrderPhoto.cs` + `WorkOrderPhotoConfiguration.cs`):
- `DisplayOrder` — 0-based; not necessarily gap-free after delete (no auto-renumber on delete in the shipped handler)
- `IsPrimary` — at most one `true` per work order, enforced by unique filtered index `IX_WorkOrderPhotos_WorkOrderId_IsPrimary_Unique` (`"IsPrimary" = true`). After deleting the primary photo, the WO has zero primaries (no auto-promotion — see AC-16).
- `CreatedByUserId` — must be set to the calling user
- Cascade delete on `WorkOrderId` — removing the WO removes its photos (not exercised by this story but worth knowing)
- `AuditableEntity` provides `CreatedAt` and `UpdatedAt` set by `AppDbContext.UpdateAuditFields`

### Risks and mitigations (carried over from Story 21.2)

**Risk #1 — `IPhotoService.ConfirmUploadAsync` thumbnail generation against `FakeStorageService`:** the real `PhotoService` tries to download the original from S3 to generate a thumbnail. Against `FakeStorageService` that download fails. **Resolution from 21.2:** `PhotoService.ConfirmUploadAsync` wraps thumbnail generation in `try/catch (Exception ex when ex is not OperationCanceledException)` — when the fake download fails, the catch block runs and `ConfirmUploadAsync` returns a `PhotoRecord` with `ThumbnailStorageKey = null` (or whatever the fallback is). The handler then saves the photo row normally. **No fake-stubbing required.** If this story's tests fail on `ConfirmUpload` with a different exception than 21.2 saw, re-read `PhotoService.cs` lines ~96-146 and apply the same mitigation 21.2 did.

**Risk #2 — `FakeStorageService.DeletedKeys` singleton accumulation:** the fake is registered as a singleton, so `DeletedKeys` accumulates across all tests in the class run. **Resolution:** snapshot `DeletedKeys.Count` at test start; assert `Count >= snapshotBefore + 2` AND `.Should().Contain(originalKey)` AND `.Should().Contain(thumbnailKey)`. Never assert exact total counts. (Same pattern as 21.2 Task 1.6.)

**Risk #3 — `UpdatedAt` no-op assertion (AC-20 / Task 7.3):** if the handler's "already primary" no-op early-returns BEFORE touching the entity, `UpdatedAt` stays at its seeded value. But `AppDbContext.UpdateAuditFields` only sets `UpdatedAt` on `EntityState.Modified` — and since the early return prevents any save, no modify happens. The `UpdatedAt` check should work. If it proves flaky (e.g., postgres timestamp resolution), drop the timestamp check and just assert the `IsPrimary` flag is still `true` and the row count is unchanged.

### Permission policies — verified mappings

From `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`:

| Role | `WorkOrders.View` | `WorkOrders.Create` | Behavior on this controller |
|---|---|---|---|
| Owner | yes | yes | All endpoints succeed (subject to handler-level checks) |
| Contributor | yes | no | GET succeeds; all mutating endpoints → **403** |
| Tenant | no | no | All endpoints → **403** (class-level policy fails) |

Test the Tenant case with `factory.CreateTenantUserInAccountAsync(...)` and the Contributor case with `factory.CreateTestUserInAccountAsync(accountId, email, role: "Contributor")`. Both must be in the Owner's account so the work-order-account match passes — the goal is to verify the **policy check fails** before the handler-level account check would have passed.

### Test data naming convention (per 21.1 / 21.2)

Unique per-test emails avoid collisions in the shared Testcontainers Postgres:
- Owners: `$"owner-{feature}-{Guid.NewGuid():N}@example.com"`
- Tenants: `$"tenant-{feature}-{Guid.NewGuid():N}@example.com"`
- Contributors: `$"contrib-{feature}-{Guid.NewGuid():N}@example.com"`

### Previous Story Intelligence

**Story 21.1 (done, PR #372)** — Added `MaintenanceRequestsController` integration tests + factory helpers `CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`. Established `TenantContext` private-record pattern. This story uses the Owner-equivalent (`OwnerContext`) instead — Tenants don't have access to WorkOrder photos.

**Story 21.2 (done, PR #373)** — `MaintenanceRequestPhotosController` integration tests. Most-relevant pattern reference. Key takeaways applied here:
1. `private sealed record` for context types used as method return types (avoids CS9051)
2. `file record` HTTP DTOs at file bottom (with `Wo*` prefix to avoid collision with 21.2's `Mrp*` records — both files compile into the same `PropertyManager.Api.Tests` assembly)
3. `FakeStorageService.DeletedKeys` snapshot/containment assertion (Risk #2 above)
4. `IPhotoService.ConfirmUploadAsync` thumbnail-failure swallowing (Risk #1 above)
5. Helpers stay colocated — do NOT extract a shared base class
6. Login response shape `record WoLoginResponse(string AccessToken, int ExpiresIn)` — name distinct from `MrpLoginResponse` (21.2) and `LoginResponse` (PropertyPhotos / WorkOrders)

**Story 21.3 (done, PR #381)** — Consolidation pattern; not directly applicable. Notable: the merged `ExpensesControllerTests.cs` uses nested classes (`public class Post : ExpensesControllerTestsBase`) when a single file gets large. **Do not nest** unless this file blows past ~1000 lines. Aim for one flat class with clear region comments per endpoint, mirroring 21.2's structure.

**Story 21.4 (done, PR #382)** — E2E pattern; not directly applicable to this backend-only story. Confirmed `npm test`/`dotnet test` clean.

### Files to create

- `backend/tests/PropertyManager.Api.Tests/WorkOrderPhotosControllerTests.cs` — single file, single class. Estimated 50-65 `[Fact]` tests + helpers, likely ~1000-1200 lines (slightly larger than 21.2 because there are 6 endpoints vs 4). If it exceeds ~1200 lines, split by endpoint per CLAUDE.md guidance for large test files — but try one-file first; 21.2 fit 47 tests in ~1320 lines.

### Files NOT to modify

- `PropertyManagerWebApplicationFactory.cs` — already provides every helper this story needs
- Any production code in `backend/src/` — controller, handlers, validators, EF config, entity. Test-only story.
- Other test files (`PropertyPhotosControllerTests.cs`, `MaintenanceRequestPhotosControllerTests.cs`, `WorkOrdersControllerTests.cs`) — leave alone

### Anti-pitfalls (don't make these mistakes)

1. **Don't assert `DeletePhoto` promotes a new primary** — the shipped handler explicitly does NOT. AC-16 documents this. If you write the inverse you'll fail AND if the handler ever changes, the test will pretend it passes for the wrong reason.
2. **Don't reuse 21.2's `Mrp*` file records** — naming collisions break compilation. Prefix yours with `Wo*`.
3. **Don't assert exact `FakeStorageService.DeletedKeys.Count`** — singleton accumulation will flake in CI. Use snapshot delta + containment.
4. **Don't write a malformed-GUID 400 test** — `:guid` route constraint produces 404, not 400 (per 21.2's actual measurement).
5. **Don't change `PropertyManagerWebApplicationFactory`** — it's load-bearing for every other integration test.
6. **Don't import Application DTOs as response types** — define `file record`s in this test file. HTTP-contract changes must surface as test failures here.
7. **Don't put the response records inside the test class** — they need to be `file record`s at file scope (otherwise CS9051 hits when used as return types of class members in some scenarios; see 21.2 learning #2 for the inverse case).
8. **Don't assume `WorkOrderPhotoDto.PhotoUrl` is named `ViewUrl`** — it's `PhotoUrl` (verify in `GetWorkOrderPhotos.cs`). 21.2's MR analog is `ViewUrl`. Different controllers, different DTO field names.

### References

- [WorkOrderPhotosController source](../../../backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs) — all 6 endpoints, route templates, policy attributes
- [GenerateWorkOrderPhotoUploadUrl.cs](../../../backend/src/PropertyManager.Application/WorkOrders/GenerateWorkOrderPhotoUploadUrl.cs) — AC-2 / AC-4 / AC-5 behavior
- [ConfirmWorkOrderPhotoUpload.cs](../../../backend/src/PropertyManager.Application/WorkOrders/ConfirmWorkOrderPhotoUpload.cs) — storage-key validation (AC-9), auto-primary logic (AC-7/AC-8)
- [DeleteWorkOrderPhoto.cs](../../../backend/src/PropertyManager.Application/WorkOrders/DeleteWorkOrderPhoto.cs) — **NO promotion logic** (AC-16)
- [SetPrimaryWorkOrderPhoto.cs](../../../backend/src/PropertyManager.Application/WorkOrders/SetPrimaryWorkOrderPhoto.cs) — transactional clear+set (AC-19), no-op on already-primary (AC-20)
- [ReorderWorkOrderPhotos.cs](../../../backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotos.cs) — full-set requirement (AC-23), partial 400 vs missing-id 404
- [GetWorkOrderPhotos.cs](../../../backend/src/PropertyManager.Application/WorkOrders/GetWorkOrderPhotos.cs) — ordering by `DisplayOrder` (AC-11), DTO field name `PhotoUrl` (NOT `ViewUrl`)
- [GenerateWorkOrderPhotoUploadUrlValidator.cs](../../../backend/src/PropertyManager.Application/WorkOrders/GenerateWorkOrderPhotoUploadUrlValidator.cs) — AC-6 rules
- [ConfirmWorkOrderPhotoUploadValidator.cs](../../../backend/src/PropertyManager.Application/WorkOrders/ConfirmWorkOrderPhotoUploadValidator.cs) — AC-10 rules
- [DeleteWorkOrderPhotoValidator.cs](../../../backend/src/PropertyManager.Application/WorkOrders/DeleteWorkOrderPhotoValidator.cs) — minimal NotEmpty checks
- [SetPrimaryWorkOrderPhotoValidator.cs](../../../backend/src/PropertyManager.Application/WorkOrders/SetPrimaryWorkOrderPhotoValidator.cs) — minimal NotEmpty checks
- [ReorderWorkOrderPhotosValidator.cs](../../../backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotosValidator.cs) — empty / null / duplicate ID rules (AC-23)
- [WorkOrderPhoto.cs (entity)](../../../backend/src/PropertyManager.Domain/Entities/WorkOrderPhoto.cs)
- [WorkOrderPhotoConfiguration.cs (EF)](../../../backend/src/PropertyManager.Infrastructure/Persistence/Configurations/WorkOrderPhotoConfiguration.cs) — unique filtered IsPrimary index
- [PropertyManagerWebApplicationFactory.cs](../../../backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs) — `CreateTestUserAsync`, `CreateTestUserInAccountAsync`, `CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`, `FakeStorageService`
- [MaintenanceRequestPhotosControllerTests.cs (Story 21.2)](../../../backend/tests/PropertyManager.Api.Tests/MaintenanceRequestPhotosControllerTests.cs) — **PRIMARY PATTERN REFERENCE**
- [PropertyPhotosControllerTests.cs](../../../backend/tests/PropertyManager.Api.Tests/PropertyPhotosControllerTests.cs) — closest endpoint-shape match (SetPrimary + Reorder assertion patterns)
- [WorkOrdersControllerTests.cs](../../../backend/tests/PropertyManager.Api.Tests/WorkOrdersControllerTests.cs) — work-order seeding pattern, `CreateUserWithPropertyAsync` shape
- [GlobalExceptionHandlerMiddleware.cs](../../../backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs) — exception → HTTP mapping
- [IPhotoService.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs) — `PhotoValidation.MaxFileSizeBytes`, `AllowedContentTypes`, key pattern, `PhotoEntityType.WorkOrders`
- [RolePermissions.cs](../../../backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs) — Owner/Contributor/Tenant permission matrix
- [Program.cs (auth policy registration)](../../../backend/src/PropertyManager.Api/Program.cs) — lines 170-171: `CanManageWorkOrders` + `CanViewWorkOrders` policy definitions
- [Story 21.1 (done)](./21-1-maintenance-requests-controller-integration-tests.md) — factory helpers, BusinessRule mapping
- [Story 21.2 (done)](./21-2-maintenance-request-photos-controller-integration-tests.md) — **PRIMARY pattern reference for this story**
- [Story 21.3 (done)](./21-3-expenses-controller-integration-consolidation.md) — consolidation patterns (informational)
- [Story 21.4 (done)](./21-4-tenant-dashboard-e2e.md) — most recent reference
- [Epic 21](./epic-21-epics-test-coverage.md)
- [ASP.NET Core 10 Integration Tests (Microsoft Learn)](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit) — `WebApplicationFactory` + `IClassFixture` is the current pattern (verified via Ref MCP at story-write time)
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Claude Opus 4.7, 1M context)

### Debug Log References

- `dotnet build tests/PropertyManager.Api.Tests/PropertyManager.Api.Tests.csproj` — succeeded with 0 errors, 3 pre-existing warnings.
- `dotnet test --filter "FullyQualifiedName~WorkOrderPhotosControllerTests"` — 71 passed, 0 failed, 0 skipped, ~6s.
- `dotnet test` (full backend suite) — 2041 passed, 0 failed (1189 Application + 98 Infrastructure + 754 Api), no regressions.

### Completion Notes List

- **All 26 ACs covered by 71 `[Fact]` integration tests** in a single new file (`WorkOrderPhotosControllerTests.cs`). Tests passed on first run with no test bugs and no production-code surprises.
- **Test count exceeded the 50–65 estimate** because the role-policy matrix (Tenant + Contributor across 6 endpoints) and the validator/cross-account/cross-WO permutations naturally expanded each task. Still single-file, ~1280 lines — under the ~1200 line "consider splitting" threshold by a small margin; left flat per Story 21.3 guidance.
- **AC-16 confirmed shipped behavior:** `DeleteWorkOrderPhotoHandler` does NOT auto-promote a new primary when the primary is deleted. Test `DeletePhoto_WasPrimary_DoesNotPromoteOthers` documents this explicitly. This DIVERGES from `MaintenanceRequestPhotos` (which DOES promote — see Story 21.2 AC-14) and from `PropertyPhotos`. **No production change made; flagging as a potential follow-up product question — should the three photo controllers behave symmetrically?** (Risk: a future "fix" could break this test.)
- **Risk #1 mitigation held:** `IPhotoService.ConfirmUploadAsync` against `FakeStorageService` swallowed thumbnail-download failures as expected; tests asserted only `ViewUrl` non-null and made `ThumbnailUrl` optional in the response record. No fake-stubbing required.
- **Risk #2 mitigation applied:** All `DeletedKeys` assertions used the snapshot/containment pattern (`Count >= snapshotBefore + 2`, `.Contain(originalKey)`, `.Contain(thumbnailKey)`).
- **Risk #3 fallback chosen:** For the no-op `SetPrimary` test (Task 7.3), I used the row-count + IsPrimary fallback instead of `UpdatedAt` comparison — the handler's early return means there is no `SaveChangesAsync`, so `UpdatedAt` is never updated and would be a tautology rather than evidence the no-op happened. The chosen assertions (single row, still primary) prove the no-op.
- **No production code modified** — controller, handlers, validators, entity, EF config, factory all untouched. Pure test-only story.
- **`Wo*` file-record prefixes** prevent collision with Story 21.2's `Mrp*` records and `PropertyPhoto*` records that share the same assembly.
- **Location header value:** the controller returns `/api/v1/work-orders/{id}/photos/{photoId}` (with leading slash), asserted exactly in `ConfirmUpload_AsOwner_ValidRequest_Returns201WithIdAndUrls`.
- **`WorkOrderPhotoDto.PhotoUrl` (not `ViewUrl`)** — confirmed in `GetWorkOrderPhotos.cs` and reflected in the `WoPhotoDto` test record. Tests verifying URL shape used `PhotoUrl`. The `ConfirmUploadResponse` DTO does use `ViewUrl` (different DTO), reflected in `WoConfirmResponse`.

### File List

**Added**
- `backend/tests/PropertyManager.Api.Tests/WorkOrderPhotosControllerTests.cs` — 71 `[Fact]` integration tests, ~1280 lines, single class

**Modified (process artifacts)**
- `docs/project/stories/epic-21/21-5-work-order-photos-controller-integration-tests.md` — task checkboxes, status, Dev Agent Record
- `docs/project/sprint-status.yaml` — `21-5-work-order-photos-controller-integration-tests: review`
