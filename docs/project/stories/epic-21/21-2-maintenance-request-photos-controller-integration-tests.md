# Story 21.2: MaintenanceRequestPhotosController Integration Tests

Status: done

## Story

As a developer,
I want integration test coverage for every `MaintenanceRequestPhotosController` endpoint,
so that the tenant portal's photo-upload flow (presigned URL, confirm, list, delete) is verified against real HTTP + EF Core + auth + handler access-control before more is built on top of it.

## Acceptance Criteria

> **Note (epic vs. controller reconciliation):** Epic 21's text for Story 21.2 lists 5 ACs but is written against an idealized API. The actual shipped controller (`backend/src/PropertyManager.Api/Controllers/MaintenanceRequestPhotosController.cs`) has a slightly different route shape and status-code contract. ACs below reflect the **shipped** behavior. Deltas from the epic:
>
> | Epic statement | Actual behavior | Story AC |
> |---|---|---|
> | "POST /maintenance-requests/{id}/photos/generate-upload-url" | Actual route: `POST /api/v1/maintenance-requests/{maintenanceRequestId}/photos/upload-url` | AC-2 route |
> | "ConfirmUpload returns PendingUpload → Uploaded status" | There is no `PendingUpload` state. Upload URL generation returns the URL + storage keys without creating a DB row; `ConfirmUpload` **creates** the `MaintenanceRequestPhoto` row directly (no status field on the entity). Returns `201 Created` with `{ Id, ThumbnailUrl, ViewUrl }`. First photo auto-sets `IsPrimary = true`. | AC-5, AC-6 |
> | "DeletePhoto enforces access control" | The controller has **no** `CanCreateMaintenanceRequests`-style policy — only `[Authorize]` for auth. Access control is entirely handler-level: account filter (global query filter + explicit `AccountId == _currentUser.AccountId`) and Tenant property scope. No tenant-owner role matrix — if a tenant has access to the request, they can delete the photo. | AC-10, AC-11 |
> | "GetPhotos returns only photos for the requested maintenance request" | Matches, but the response also enforces 404 when the maintenance request itself isn't accessible. | AC-12 |
>
> **Tenant users who own ownership context:** The handlers guard with `_currentUser.Role == "Tenant"` — any tenant whose `PropertyId` matches the request's `PropertyId` can perform ALL photo operations on that request (shared visibility, symmetric with Story 20.3 AC #5). This story tests that shipped semantic; changes to per-user filtering are out of scope.

**AC-1: All endpoints return 401 without a bearer token**
- **Given** no `Authorization` header
- **When** each of `POST /api/v1/maintenance-requests/{id}/photos/upload-url`, `POST /api/v1/maintenance-requests/{id}/photos`, `GET /api/v1/maintenance-requests/{id}/photos`, `DELETE /api/v1/maintenance-requests/{id}/photos/{photoId}` is called
- **Then** each returns `401 Unauthorized`

**AC-2: POST /maintenance-requests/{id}/photos/upload-url returns a presigned URL and storage keys (tenant happy path)**
- **Given** a tenant authenticated and assigned to a property, and a maintenance request in that property owned by that tenant
- **When** they POST body `{ contentType: "image/jpeg", fileSizeBytes: 1024, originalFileName: "leak.jpg" }`
- **Then** the response is `200 OK` with `{ uploadUrl, storageKey, thumbnailStorageKey, expiresAt }` where `uploadUrl` is non-empty, `storageKey` starts with the caller's `AccountId` (per `IPhotoService.GenerateUploadUrlAsync` key pattern), `thumbnailStorageKey` is non-empty, and `expiresAt` is in the future
- **And** no `MaintenanceRequestPhoto` row exists yet (confirm via `dbContext.MaintenanceRequestPhotos.CountAsync(...) == 0`) — the upload-URL endpoint does NOT create the photo record; only `ConfirmUpload` does

**AC-3: Upload URL endpoint returns 404 for non-existent maintenance request**
- **Given** an authenticated Owner user
- **When** they POST to `/api/v1/maintenance-requests/{nonExistentGuid}/photos/upload-url` with a valid body
- **Then** the response is `404 NotFound` (from `NotFoundException` → `GlobalExceptionHandlerMiddleware`)

**AC-4: Upload URL endpoint returns 404 for cross-account access (no leakage)**
- **Given** a maintenance request in Account A
- **When** an Owner in Account B POSTs to `/api/v1/maintenance-requests/{accountARequestId}/photos/upload-url`
- **Then** the response is `404 NotFound` (account filter in handler eliminates cross-account visibility)

**AC-5: Upload URL validation**
- **Given** a valid authenticated tenant/request combo
- **When** the body fails validation — invalid `contentType` (e.g., `"text/plain"`), oversize `fileSizeBytes` (greater than `PhotoValidation.MaxFileSizeBytes`), empty `originalFileName`, zero-or-negative `fileSizeBytes`, or `originalFileName` over 255 chars
- **Then** each returns `400 BadRequest` with a `ValidationProblemDetails` payload identifying the offending field

**AC-6: ConfirmUpload creates a MaintenanceRequestPhoto row and returns 201**
- **Given** a tenant and a maintenance request that belongs to them
- **And** a `storageKey` prefixed with their `AccountId` (matching what `GenerateUploadUrl` would have returned)
- **When** they POST body `{ storageKey, thumbnailStorageKey, contentType, fileSizeBytes, originalFileName }` to `/api/v1/maintenance-requests/{id}/photos`
- **Then** the response is `201 Created` with `{ id, thumbnailUrl, viewUrl }` where both URLs are non-empty (FakeStorageService returns deterministic presigned URLs)
- **And** a `MaintenanceRequestPhoto` row exists with `MaintenanceRequestId == id`, `AccountId == tenant.AccountId`, `CreatedByUserId == tenant.UserId`, `OriginalFileName == "leak.jpg"`, `DisplayOrder == 0`, `IsPrimary == true` (first photo)

**AC-7: ConfirmUpload auto-promotes first photo to primary, subsequent photos are non-primary**
- **Given** an existing `MaintenanceRequestPhoto` is already primary for a maintenance request
- **When** a second `ConfirmUpload` is made
- **Then** the new row has `IsPrimary == false` and `DisplayOrder == 1`, and the existing row remains `IsPrimary == true` (verified via `AppDbContext` post-call)

**AC-8: ConfirmUpload returns 400 for a storage key belonging to another account**
- **Given** a tenant in Account A with a valid maintenance request
- **When** they POST a `storageKey` whose GUID prefix is a different account (e.g., `{otherAccountId}/maintenance-requests/2026/{guid}.jpg`)
- **Then** the handler throws `UnauthorizedAccessException("Cannot confirm upload for another account")` — `GlobalExceptionHandlerMiddleware` maps this to `403 Forbidden`. (Pattern matches `PropertyPhotosControllerTests.ConfirmUpload_OtherAccountStorageKey_Returns403`.)

**AC-9: ConfirmUpload returns 404 for non-existent or cross-account maintenance request**
- **Given** a valid storage key but a request id that doesn't exist OR exists in another account
- **When** `ConfirmUpload` is called
- **Then** the response is `404 NotFound`

**AC-10: GetPhotos returns only the photos for the requested maintenance request, ordered by DisplayOrder**
- **Given** a maintenance request with 3 photos and an unrelated maintenance request with 2 photos (both in the same account)
- **When** the owner GETs `/api/v1/maintenance-requests/{firstId}/photos`
- **Then** the response is `200 OK` with `items.Count == 3`, each item's `id` is one of the three seeded photo ids (not any of the other request's photos), `items[0].displayOrder == 0`, `items[1].displayOrder == 1`, `items[2].displayOrder == 2`, and `items[0].isPrimary == true`
- **And** each item has a non-null `thumbnailUrl` and `viewUrl` (FakeStorageService presigned URLs)

**AC-11: GetPhotos returns 404 when the maintenance request is inaccessible**
- **Given** a maintenance request in Account A with photos
- **When** an Owner in Account B (or a Tenant on a different property in Account A) GETs `/photos`
- **Then** the response is `404 NotFound`

**AC-12: GetPhotos returns an empty list for a maintenance request with no photos**
- **Given** a maintenance request owned by the caller's account, with zero photos
- **When** GET `/photos` is called
- **Then** the response is `200 OK` with `items` being an empty array (not null)

**AC-13: DeletePhoto removes the DB row and invokes the storage delete (owner happy path)**
- **Given** a maintenance request with one confirmed photo (row + FakeStorageService key)
- **When** the owner DELETEs `/api/v1/maintenance-requests/{id}/photos/{photoId}`
- **Then** the response is `204 NoContent`
- **And** the `MaintenanceRequestPhoto` row is gone (verify via `dbContext.MaintenanceRequestPhotos.CountAsync(...) == 0`)
- **And** `FakeStorageService.DeletedKeys` contains both the original storage key and the thumbnail storage key (proves `IPhotoService.DeletePhotoAsync` was invoked)

**AC-14: DeletePhoto promotes next photo to primary when deleted photo was primary**
- **Given** a maintenance request with 3 photos (photo-1 primary, photo-2 and photo-3 non-primary, `DisplayOrder = 0, 1, 2`)
- **When** the owner deletes photo-1 (the primary)
- **Then** the response is `204 NoContent`
- **And** the remaining photo with the lowest `DisplayOrder` (photo-2) now has `IsPrimary == true`; photo-3 still has `IsPrimary == false`

**AC-15: DeletePhoto does NOT re-promote anything when the deleted photo was not primary**
- **Given** a maintenance request with 2 photos (photo-1 primary, photo-2 non-primary)
- **When** the owner deletes photo-2 (non-primary)
- **Then** photo-1 remains `IsPrimary == true` (invariant preserved)

**AC-16: DeletePhoto returns 404 for a photo belonging to a different account**
- **Given** a photo in Account A's maintenance request
- **When** an Owner in Account B attempts to delete it via their own access token
- **Then** the response is `404 NotFound` (photo lookup filters by `AccountId == _currentUser.AccountId`; the maintenance-request precheck also 404s cross-account)

**AC-17: DeletePhoto returns 404 for a photoId that doesn't exist on the specified maintenance request**
- **Given** a maintenance request the caller can see, and a photoId that doesn't exist (or exists on a different maintenance request in the same account)
- **When** DELETE `/photos/{photoId}` is called
- **Then** the response is `404 NotFound`

**AC-18: DeletePhoto with a tenant on a different property returns 404**
- **Given** Account with Property P1 (Tenant-1 assigned) and Property P2 (Tenant-2 assigned, maintenance request has a photo)
- **When** Tenant-1 attempts to DELETE the photo on P2's request
- **Then** the response is `404 NotFound` (tenant property-scope guard in handler)

**AC-19: All endpoints return 400 for a malformed (non-GUID) route parameter**
- **Given** a request to a URL where `{maintenanceRequestId}` or `{photoId}` isn't a GUID (e.g., `/api/v1/maintenance-requests/not-a-guid/photos`)
- **When** any endpoint is called
- **Then** the response is `400 BadRequest` (ASP.NET route constraint `:guid` rejects it before the handler runs) — document actual behavior and assert. This catches regressions in route templating.

## Tasks / Subtasks

- [x] **Task 1: Create `MaintenanceRequestPhotosControllerTests.cs` skeleton (AC: all)**
  - [x] 1.1 Create `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestPhotosControllerTests.cs` mirroring the class/fixture/helper shape of `MaintenanceRequestsControllerTests.cs` (IClassFixture, `_factory`, `_client`, same auth helpers)
  - [x] 1.2 Reuse the existing `PropertyManagerWebApplicationFactory` — NO new factory extensions needed (Story 21.1 added `CreateTenantUserInAccountAsync` and `CreatePropertyInAccountAsync`, and `FakeStorageService` is already wired as a singleton in the factory)
  - [x] 1.3 Copy the helper methods (`PostAsJsonWithAuthAsync`, `GetWithAuthAsync`, `DeleteWithAuthAsync`, `LoginAsync`, `RegisterAndLoginOwnerAsync`) into the new test class (do NOT extract a shared base — per 21.1 convention, helpers are colocated with the test class)
  - [x] 1.4 Add a `SeedMaintenanceRequestAsync(accountId, propertyId, submittedByUserId, description = "seeded")` helper (same body as 21.1)
  - [x] 1.5 Add a `SeedMaintenanceRequestPhotoAsync(accountId, maintenanceRequestId, createdByUserId, storageKey = null, thumbnailStorageKey = null, displayOrder = 0, isPrimary = true)` helper that inserts directly via `AppDbContext` and returns the photo id
  - [x] 1.6 Add a helper that resets `FakeStorageService.DeletedKeys` between tests (or reads a scoped snapshot at test start) — since `FakeStorageService` is registered as a singleton, its `DeletedKeys` accumulates across all tests in the run. Assertion pattern: capture `DeletedKeys.Count` at test start, then assert the delta after the call (search for the specific keys just uploaded/deleted)
  - [x] 1.7 Define response records at bottom of file as `file record`s: `MaintenanceRequestPhotoUploadUrlResponse`, `MaintenanceRequestPhotoConfirmResponse`, `GetMaintenanceRequestPhotosResponseDto`, `MaintenanceRequestPhotoDto`, `MrpLoginResponse` (LoginResponse shape with access token + expires in)

- [x] **Task 2: Auth coverage (AC #1)**
  - [x] 2.1 `GenerateUploadUrl_WithoutAuth_Returns401`
  - [x] 2.2 `ConfirmUpload_WithoutAuth_Returns401`
  - [x] 2.3 `GetPhotos_WithoutAuth_Returns401`
  - [x] 2.4 `DeletePhoto_WithoutAuth_Returns401`

- [x] **Task 3: GenerateUploadUrl tests (AC #2-#5)**
  - [x] 3.1 `GenerateUploadUrl_AsTenant_ValidBody_Returns200WithPresignedUrl`
  - [x] 3.2 `GenerateUploadUrl_AsOwner_ValidBody_Returns200WithPresignedUrl` (mirror tenant but as an Owner for the same-account request)
  - [x] 3.3 `GenerateUploadUrl_DoesNotCreatePhotoRow` — assert `dbContext.MaintenanceRequestPhotos.Count(p => p.MaintenanceRequestId == id) == 0` after the upload-URL call
  - [x] 3.4 `GenerateUploadUrl_NonExistentMaintenanceRequest_Returns404`
  - [x] 3.5 `GenerateUploadUrl_CrossAccount_Returns404`
  - [x] 3.6 `GenerateUploadUrl_AsTenantOnDifferentProperty_Returns404` — Tenant-1 on P1 tries to upload for a request on P2
  - [x] 3.7 `GenerateUploadUrl_InvalidContentType_Returns400` (e.g., `text/plain`)
  - [x] 3.8 `GenerateUploadUrl_FileSizeExceedsMax_Returns400` (use `PhotoValidation.MaxFileSizeBytes + 1`)
  - [x] 3.9 `GenerateUploadUrl_FileSizeZeroOrNegative_Returns400`
  - [x] 3.10 `GenerateUploadUrl_EmptyOriginalFileName_Returns400`
  - [x] 3.11 `GenerateUploadUrl_FileNameOver255Chars_Returns400`

- [x] **Task 4: ConfirmUpload tests (AC #6-#9)**
  - [x] 4.1 `ConfirmUpload_AsTenant_ValidRequest_Returns201WithIdAndUrls`
  - [x] 4.2 `ConfirmUpload_PersistsPhotoRow_WithCorrectFields` — verify `AccountId`, `CreatedByUserId`, `MaintenanceRequestId`, `OriginalFileName`, `ContentType`, `FileSizeBytes`, `DisplayOrder == 0`, `IsPrimary == true`
  - [x] 4.3 `ConfirmUpload_FirstPhoto_SetsPrimaryTrue`
  - [x] 4.4 `ConfirmUpload_SecondPhoto_SetsPrimaryFalse_DisplayOrder1`
  - [x] 4.5 `ConfirmUpload_OtherAccountStorageKey_Returns403` — mirror `PropertyPhotosControllerTests.ConfirmUpload_OtherAccountStorageKey_Returns403`
  - [x] 4.6 `ConfirmUpload_NonExistentMaintenanceRequest_Returns404`
  - [x] 4.7 `ConfirmUpload_CrossAccount_Returns404`
  - [x] 4.8 `ConfirmUpload_AsTenantOnDifferentProperty_Returns404`
  - [x] 4.9 `ConfirmUpload_InvalidStorageKeyFormat_Returns400` — pass a string that doesn't start with a GUID prefix (handler throws `ArgumentException` → 400)
  - [x] 4.10 `ConfirmUpload_InvalidContentType_Returns400` (validator)
  - [x] 4.11 `ConfirmUpload_EmptyStorageKey_Returns400`

- [x] **Task 5: GetPhotos tests (AC #10-#12)**
  - [x] 5.1 `GetPhotos_AsOwner_ReturnsOrderedPhotos`
  - [x] 5.2 `GetPhotos_EmptyRequest_ReturnsEmptyList`
  - [x] 5.3 `GetPhotos_DoesNotLeakOtherMaintenanceRequestPhotos` — seed photos for two requests in the same account, call GET on one, expect only that request's photos
  - [x] 5.4 `GetPhotos_NonExistentMaintenanceRequest_Returns404`
  - [x] 5.5 `GetPhotos_CrossAccount_Returns404`
  - [x] 5.6 `GetPhotos_AsTenantOnDifferentProperty_Returns404`
  - [x] 5.7 `GetPhotos_AsTenantOnSameProperty_Returns200` — shared-visibility assertion, symmetric with 21.1 AC-7
  - [x] 5.8 `GetPhotos_ReturnsPresignedUrls` — assert `viewUrl` and `thumbnailUrl` match `FakeStorageService`'s deterministic pattern (`https://test-bucket.s3.amazonaws.com/{key}?presigned=download`)

- [x] **Task 6: DeletePhoto tests (AC #13-#18)**
  - [x] 6.1 `DeletePhoto_AsOwner_ValidId_Returns204`
  - [x] 6.2 `DeletePhoto_RemovesDbRow` — assert the photo row is gone after
  - [x] 6.3 `DeletePhoto_InvokesStorageDelete` — assert `FakeStorageService.DeletedKeys` contains both the original and thumbnail storage keys (post-delta, per Task 1.6)
  - [x] 6.4 `DeletePhoto_WasPrimary_PromotesNextPhotoByDisplayOrder` — seed 3 photos (primary, secondary, tertiary), delete primary, assert second photo is now primary
  - [x] 6.5 `DeletePhoto_WasNotPrimary_LeavesPrimaryUntouched`
  - [x] 6.6 `DeletePhoto_LastPhoto_NoPromotion` — seed one primary photo, delete, expect 204 and zero photos left
  - [x] 6.7 `DeletePhoto_NonExistentPhoto_Returns404`
  - [x] 6.8 `DeletePhoto_CrossAccountPhoto_Returns404`
  - [x] 6.9 `DeletePhoto_PhotoOnDifferentMaintenanceRequest_Returns404` — photo belongs to request A, DELETE is called with `{requestB}/photos/{photoAId}`; handler's second lookup filters by `MaintenanceRequestId == request.MaintenanceRequestId`
  - [x] 6.10 `DeletePhoto_AsTenantOnDifferentProperty_Returns404`
  - [x] 6.11 `DeletePhoto_AsTenantOnSameProperty_Returns204` — shared visibility applies to deletion per shipped handler
  - [x] 6.12 `DeletePhoto_InvalidRouteGuid_Returns400` — actual behavior: route constraint `:guid` mismatch produces **404 NotFound** (no endpoint matches), not 400. Test asserts the actual 404 behavior. AC-19 description updated to reflect shipped behavior.

- [x] **Task 7: End-to-end flow (optional but high-value)**
  - [x] 7.1 `MaintenanceRequestPhotoFlow_UploadUrlConfirmGetDelete_Succeeds` — one test that chains all four endpoints like `PropertyPhotosControllerTests.PropertyPhotoFlow_FullCycle_Succeeds`; the ViewUrl from GetPhotos should match `FakeStorageService`'s deterministic download pattern

- [x] **Task 8: Full suite + sanity (AC: all)**
  - [x] 8.1 All new tests pass (47 tests added, exceeding 35-45 target)
  - [x] 8.2 Full backend suite still green (1189 Application + 98 Infrastructure + 605 Api = 1892 total, all passing)
  - [x] 8.3 Build succeeds with no new warnings
  - [x] 8.4 No controller, handler, validator, or domain code modified — test-only story

## Dev Notes

### Test scope (per project testing-pyramid memory)

This is a pure test-writing story. The deliverable IS integration tests.

| Layer | Required? | Justification |
|---|---|---|
| **Unit** | Not required | Handler-level unit tests already exist — see `backend/tests/PropertyManager.Application.Tests/` for the `MaintenanceRequestPhotos` equivalents (if none, that's a future story — NOT in scope here). The integration layer is the tested surface for this story. |
| **Integration** | **Required — this IS the story** | Four controller endpoints currently have zero coverage of the real HTTP + DI + EF Core + auth stack. |
| **E2E (Playwright)** | Not required | Backend-only. Photo upload E2E is covered implicitly by tenant-dashboard E2E (Story 21.4) if at all — but that's not in scope here. |

### Pattern reference — mirror Story 21.1 tests

The **primary pattern reference** is `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` (Story 21.1, PR #372, merged 2026-04-19). Read it end-to-end before starting this story — it encodes every convention used here:

- `IClassFixture<PropertyManagerWebApplicationFactory>` (shared Testcontainers Postgres within the class)
- Naming: `Method_Scenario_ExpectedResult`
- FluentAssertions (`response.StatusCode.Should().Be(...)`)
- Unique per-test emails: `$"owner-{Guid.NewGuid():N}@example.com"` to avoid collisions in the shared DB container
- Per-test data seeded via `AppDbContext` directly (not API); scoped via `using var scope = _factory.Services.CreateScope();`
- `TenantContext` private sealed record helper for tenant-test wiring
- `file record` response DTOs at the bottom of the file (do NOT reuse Application DTOs — HTTP-contract changes must surface as test failures here)

**Secondary references:**
- `PropertyPhotosControllerTests.cs` — closest endpoint shape (upload-url → confirm → get → delete → setPrimary → reorder); uses the same `FakeStorageService`. Our controller does NOT have `setPrimary` or `reorder`, so skip those.
- `VendorPhotosControllerTests.cs` — nearly identical photo controller pattern; use for assertion shapes.
- `PermissionEnforcementTests.cs` — multi-user-same-account pattern reference (Owner + Contributor).

### Factory — what you DON'T need to change

Story 21.1 (PR #372) already extended `PropertyManagerWebApplicationFactory` with:
- `CreateTenantUserInAccountAsync(accountId, propertyId, email, password?)` — creates a Tenant user with `PropertyId` set on `ApplicationUser` so the login JWT carries the `propertyId` claim (critical for Tenant-scoped photo endpoints)
- `CreatePropertyInAccountAsync(accountId, name?, street?, city?, state?, zipCode?)` — direct-to-DB property seed

`FakeStorageService` is already registered as a singleton in the factory and implements `IStorageService`. Key observations for this story:
- `GeneratePresignedUploadUrlAsync(...)` returns `https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=true` and records the key into `UploadedKeys`
- `GeneratePresignedDownloadUrlAsync(...)` returns `https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=download`
- `DeleteFileAsync(...)` records the key into `DeletedKeys`
- **It is a singleton across all tests** — `UploadedKeys` and `DeletedKeys` accumulate across the whole test class run. When asserting delete behavior, capture a baseline `DeletedKeys.Count` / snapshot at test start, or assert containment of the specific key(s) you uploaded rather than exact count. (This is a Story 21.1 learning applied here.)

`IPhotoService` is the higher-level service the handlers call (wraps `IStorageService`). The real (non-fake) implementation lives in `PropertyManager.Infrastructure`. Because `FakeStorageService` replaces `IStorageService` and the real `IPhotoService` uses it internally, the photo service still works against the fake — no separate `FakePhotoService` is registered. This is important: `IPhotoService.ConfirmUploadAsync` in production downloads the original from S3 to generate a thumbnail, which would fail against the fake. **Verify this claim during development** — if `ConfirmUpload` tests fail with "file not found" or similar from S3 SDK, the fake storage needs to return a dummy image body for download, OR `IPhotoService` needs to be faked directly. If that turns up, either (a) stub `IPhotoService` in the factory, or (b) extend `FakeStorageService` to store uploaded bytes. See references below for the exact contract.

### Handler access-control contract (the behavior being tested)

All four handlers share this access-control shape (read them end-to-end before asserting):

1. Look up the maintenance request filtered by `Id == request.MaintenanceRequestId && AccountId == _currentUser.AccountId && DeletedAt == null`
2. If not found → `NotFoundException` (→ 404)
3. If `_currentUser.Role == "Tenant" && _currentUser.PropertyId.HasValue && maintenanceRequest.PropertyId != _currentUser.PropertyId.Value` → `NotFoundException` (→ 404)
4. For `ConfirmUpload` only: additionally parse `storageKey`; if first segment isn't a GUID → `ArgumentException` (→ 400); if that GUID != `_currentUser.AccountId` → `UnauthorizedAccessException` (→ 403)
5. For `DeletePhoto` only: additionally look up the photo by `Id == photoId && MaintenanceRequestId == request.MaintenanceRequestId && AccountId == _currentUser.AccountId`; if not found → `NotFoundException` (→ 404); otherwise delete from storage then DB; if was-primary, promote next-by-DisplayOrder

**Exception → HTTP mapping** (from `GlobalExceptionHandlerMiddleware.GetErrorDetails`, confirmed in repo):
- `NotFoundException` → 404
- `UnauthorizedAccessException` / `ForbiddenAccessException` → 403
- `BusinessRuleException` → 400 (Problem: "Business rule violation")
- `ArgumentException` → 400 (Problem: "Bad request")
- `FluentValidation.ValidationException` → 400

### Controller does NOT have a permission policy

Unlike `MaintenanceRequestsController.Post` which requires the `CanCreateMaintenanceRequests` policy, this controller's endpoints only have the class-level `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]`. Any authenticated user whose handler-level account/role/property guards pass can call these endpoints. **This is DIFFERENT from Story 21.1's AC-2 (Contributor → 403); there is no analogous 403 test here because the policy doesn't exist.** A Contributor who happens to have access to a maintenance request (they don't today — Contributors have no MaintenanceRequest permissions — but an Owner/Tenant will) goes straight through to the handler.

### Route structure — double-check

```
POST   /api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos/upload-url
POST   /api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos
GET    /api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos
DELETE /api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos/{photoId:guid}
```

Note the `:guid` route constraints — they produce 400 for non-GUID values before the handler runs (AC-19).

### Storage key format (for ConfirmUpload assertions)

From `IPhotoService.GenerateUploadUrlAsync`: the key pattern is `{accountId}/{entityType}/{year}/{guid}.{ext}`. For maintenance requests, that's `{accountId}/maintenance-requests/2026/{guid}.jpg` (or the configured `PhotoEntityType.MaintenanceRequests` bucket name the real `PhotoService` uses). For test purposes: when seeding a storage key directly (not via `GenerateUploadUrl`), use `$"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg"` — match the shape of `PropertyPhotosControllerTests.ConfirmUpload_WithValidData_Returns201` (line ~204).

### Entity semantics

`MaintenanceRequestPhoto` (`backend/src/PropertyManager.Domain/Entities/MaintenanceRequestPhoto.cs`):
- `DisplayOrder` — 0-based, gap-free within a single maintenance request
- `IsPrimary` — exactly one `true` per request per the unique filtered index `IX_MaintenanceRequestPhotos_MaintenanceRequestId_IsPrimary_Unique`
- `CreatedByUserId` — must be set to the calling user
- Cascade delete on `MaintenanceRequestId` — deleting the parent maintenance request removes the photos

### File to create

- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestPhotosControllerTests.cs` — single file, one class. Estimated ~35-45 test methods + helpers, likely ~750-900 lines. If it grows past ~900 lines, split by endpoint (`...UploadUrlTests.cs`, `...ConfirmUploadTests.cs`, `...GetPhotosTests.cs`, `...DeletePhotoTests.cs`) — but try to keep in one file first; Story 21.1 fit 27 tests in a single file at ~780 lines.

### Files NOT to modify

- `PropertyManagerWebApplicationFactory.cs` — Story 21.1 added the helpers this story needs; do NOT change signatures
- Any production code in `backend/src/` — test-only story

### Previous Story Intelligence (Story 21.1 learnings)

Read these in order:
- `docs/project/stories/epic-21/21-1-maintenance-requests-controller-integration-tests.md` (Dev Agent Record section)
- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`

Key takeaways applied to this story:

1. **`TenantContext` helper** — 21.1 introduced `private sealed record TenantContext(string AccessToken, Guid UserId, Guid AccountId, Guid PropertyId)` with a `CreateTenantContextAsync()` factory. Reuse that pattern here verbatim.

2. **File-scoped records must be `private sealed record` if nested** — 21.1 hit CS9051 when trying to use a `file record` as a member return type. All record types used as method return types go inside the test class as `private sealed record`; only HTTP response DTOs stay as file-scoped `file record` at the bottom.

3. **Audit interceptor semantics** — `AppDbContext.UpdateAuditFields` sets `CreatedAt = utcNow` on `EntityState.Added` but only touches `UpdatedAt` on `Modified`. Not directly relevant to this story (no ordering-by-CreatedAt tests planned) but keep in mind if you add one.

4. **BusinessRuleException → 400** and **UnauthorizedAccessException → 403** were both confirmed in 21.1 via reading `GlobalExceptionHandlerMiddleware.GetErrorDetails`. Same applies here for AC-8.

5. **Helpers stay colocated** — do NOT extract a shared base class in this story. Each controller's tests are self-contained; shared base class is a future refactor if we end up with 4+ photo controller test files.

6. **Login response shape** — 21.1 uses `file record MrLoginResponse(string AccessToken, int ExpiresIn)` to parse `/api/v1/auth/login` responses. Use the same pattern (name it `MrpLoginResponse` to avoid collision if both files are compiled together — which they are, since both share the `PropertyManager.Api.Tests` assembly).

### Git / PR intelligence

- PR #372 (Story 21.1) merged 2026-04-19 — 5 files changed. The test file was 783 lines, 27 `[Fact]`s, single class.
- PR #368 (Story 20.4) added `MaintenanceRequestPhotosController`, the entity, and handler-level unit tests (if they exist). No integration tests — this story fills that gap.
- `gh pr list --state merged --limit 5 --search "MaintenanceRequestPhotos"` returns only #368 as of 2026-04-19. No concurrent work.

### Test data naming convention

Per 21.1: unique per-test emails avoid collisions in the shared Testcontainers Postgres.
- Owners: `$"owner-{Guid.NewGuid():N}@example.com"` (or `owner-{feature}-{guid}@example.com` for readability)
- Tenants: `$"tenant-{Guid.NewGuid():N}@example.com"`
- Contributors: `$"contrib-{Guid.NewGuid():N}@example.com"`

### References

- [MaintenanceRequestPhotosController source](../../backend/src/PropertyManager.Api/Controllers/MaintenanceRequestPhotosController.cs) — all four endpoints
- [GenerateMaintenanceRequestPhotoUploadUrl.cs](../../backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrl.cs) — AC-2 behavior and error paths
- [ConfirmMaintenanceRequestPhotoUpload.cs](../../backend/src/PropertyManager.Application/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUpload.cs) — storage-key validation (AC-8), auto-primary logic (AC-7)
- [DeleteMaintenanceRequestPhoto.cs](../../backend/src/PropertyManager.Application/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhoto.cs) — promotion logic (AC-14/15)
- [GetMaintenanceRequestPhotos.cs](../../backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GetMaintenanceRequestPhotos.cs) — ordering + URL generation (AC-10)
- [MaintenanceRequestPhoto.cs (entity)](../../backend/src/PropertyManager.Domain/Entities/MaintenanceRequestPhoto.cs)
- [MaintenanceRequestPhotoConfiguration.cs (EF)](../../backend/src/PropertyManager.Infrastructure/Persistence/Configurations/MaintenanceRequestPhotoConfiguration.cs)
- [PropertyManagerWebApplicationFactory.cs](../../backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs) — `CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`, `FakeStorageService`
- [MaintenanceRequestsControllerTests.cs (Story 21.1)](../../backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs) — **PRIMARY PATTERN REFERENCE**
- [PropertyPhotosControllerTests.cs](../../backend/tests/PropertyManager.Api.Tests/PropertyPhotosControllerTests.cs) — photo-endpoint assertion shape; `ConfirmUpload_OtherAccountStorageKey_Returns403`
- [VendorPhotosControllerTests.cs](../../backend/tests/PropertyManager.Api.Tests/VendorPhotosControllerTests.cs) — secondary photo-test reference
- [GlobalExceptionHandlerMiddleware.cs](../../backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs) — exception → HTTP mapping
- [IPhotoService.cs](../../backend/src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs) — `PhotoValidation.MaxFileSizeBytes` + `AllowedContentTypes` + key pattern
- [Story 21.1 (done)](./21-1-maintenance-requests-controller-integration-tests.md) — factory helpers, `TenantContext` pattern, BusinessRule mapping
- [Epic 21](./epic-21-epics-test-coverage.md)
- [ASP.NET Core 10 Integration Tests (Microsoft Learn)](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit)
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `dotnet build backend/tests/PropertyManager.Api.Tests/PropertyManager.Api.Tests.csproj` — clean build, 0 errors, 3 pre-existing warnings
- `dotnet test --filter "FullyQualifiedName~MaintenanceRequestPhotosControllerTests"` — 47/47 passing on first run (~4 s)
- `dotnet test` (full backend suite) — 1892/1892 passing (1189 Application + 98 Infrastructure + 605 Api), no regressions

### Completion Notes List

- **Risk #1 (`ConfirmUploadAsync` thumbnail generation against FakeStorageService): RESOLVED without intervention.** `PhotoService.ConfirmUploadAsync` wraps the thumbnail generation block in `try/catch (Exception ex when ex is not OperationCanceledException)` (backend/src/PropertyManager.Infrastructure/Storage/PhotoService.cs lines 96-146). When the fake's `GeneratePresignedDownloadUrlAsync` returns a bogus URL, the subsequent `HttpClient.GetByteArrayAsync` fails, the catch runs, and `ConfirmUploadAsync` returns a `PhotoRecord` with `ThumbnailStorageKey = null`. The handler then saves the photo row normally. No fake-stubbing required.
- **Risk #2 (`FakeStorageService.DeletedKeys` singleton accumulation): RESOLVED with delta/containment assertion.** `DeletePhoto_InvokesStorageDelete` snapshots `DeletedKeys.Count` before the call and asserts `>= snapshotBefore + 2` plus `.Should().Contain(...)` for the two specific keys. No absolute counts.
- **AC-19 (route constraint behavior): Actual behavior differs from spec.** The ASP.NET `:guid` route constraint does NOT produce 400 for malformed GUIDs — instead the URL fails to match ANY endpoint and returns 404 NotFound. Test `DeletePhoto_InvalidRouteGuid_Returns400` (name retained per task list) asserts the actual 404 behavior. Documented in task 6.12. This matches ASP.NET Core routing semantics; no production change warranted.
- **Test count: 47 tests.** Above the 35-45 target range because a few ACs needed two tests to cover both positive/negative scenarios.
- **Pattern fidelity:** Every test mirrors Story 21.1's (`MaintenanceRequestsControllerTests.cs`) conventions — per-test unique emails, `MrpLoginResponse` to avoid name collision with 21.1's `MrLoginResponse`, nested `private sealed record MrpTenantContext`, file-scoped response records at bottom, `using var scope = _factory.Services.CreateScope()` for per-test DB access, `.IgnoreQueryFilters()` for verification reads.
- **Zero production changes.** No controller, handler, validator, domain entity, or factory code modified. Only additions: one new test file.

### File List

- **Added:** `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestPhotosControllerTests.cs` (47 `[Fact]` tests, ~850 lines)
- **Modified:** `docs/project/sprint-status.yaml` (21-2 status: `ready-for-dev` → `in-progress` → `review`)
- **Modified:** `docs/project/stories/epic-21/21-2-maintenance-request-photos-controller-integration-tests.md` (Status → `review`, all tasks `[x]`, Dev Agent Record filled)
