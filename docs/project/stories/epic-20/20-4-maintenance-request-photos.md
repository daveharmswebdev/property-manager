# Story 20.4: Maintenance Request Photos

Status: done

## Story

As a tenant,
I want to attach photos to my maintenance request,
so that the landlord can see what's wrong before visiting.

## Acceptance Criteria

1. **Given** the domain layer,
   **When** the MaintenanceRequestPhoto entity is defined,
   **Then** it has: Id, MaintenanceRequestId, AccountId, StorageKey, ThumbnailStorageKey, OriginalFileName, ContentType, FileSizeBytes, DisplayOrder, IsPrimary, CreatedByUserId, CreatedAt, UpdatedAt

2. **Given** a maintenance request,
   **When** a user requests a presigned upload URL with content type, file size, and file name,
   **Then** the system returns an S3 presigned URL, storage key, thumbnail storage key, and expiration time scoped to maintenance request photos

3. **Given** a photo uploaded to S3,
   **When** the user confirms the upload with storage keys and metadata,
   **Then** a MaintenanceRequestPhoto record is created linking the photo to the request with auto-primary logic for the first photo

4. **Given** a maintenance request with photos,
   **When** anyone views the request detail (GetMaintenanceRequestById),
   **Then** presigned download URLs (thumbnail and full-size) are returned for each photo ordered by DisplayOrder

5. **Given** a maintenance request with photos,
   **When** photos are queried via the GET photos endpoint,
   **Then** they are returned ordered by DisplayOrder with presigned URLs

6. **Given** a maintenance request photo,
   **When** a user deletes the photo,
   **Then** the photo is removed from the database and S3 (original + thumbnail), and if it was primary, the next photo by DisplayOrder is promoted

7. **Given** the EF Core configuration,
   **When** the migration runs,
   **Then** the MaintenanceRequestPhotos table is created with proper FKs, indexes, and AccountId for multi-tenancy

8. **Given** a tenant user,
   **When** they upload or view photos,
   **Then** they can only access photos for maintenance requests on their assigned property

## Tasks / Subtasks

- [x] Task 1: Create MaintenanceRequestPhoto domain entity (AC: #1)
  - [x] 1.1 Create `MaintenanceRequestPhoto.cs` in `backend/src/PropertyManager.Domain/Entities/` extending `AuditableEntity` and implementing `ITenantEntity`
  - [x] 1.2 Define properties: `AccountId`, `MaintenanceRequestId`, `StorageKey`, `ThumbnailStorageKey` (nullable), `OriginalFileName` (nullable), `ContentType` (nullable), `FileSizeBytes` (nullable long), `DisplayOrder` (int), `IsPrimary` (bool), `CreatedByUserId` (Guid)
  - [x] 1.3 Add navigation properties: `Account` (Account), `MaintenanceRequest` (MaintenanceRequest)
  - [x] 1.4 Add `ICollection<MaintenanceRequestPhoto> Photos` navigation property to `MaintenanceRequest` entity

- [x] Task 2: Add `MaintenanceRequests` to `PhotoEntityType` enum (AC: #2)
  - [x] 2.1 Add `MaintenanceRequests` value to `PhotoEntityType` enum in `IPhotoService.cs`

- [x] Task 3: Create EF Core configuration and migration (AC: #7)
  - [x] 3.1 Create `MaintenanceRequestPhotoConfiguration.cs` in `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/`
  - [x] 3.2 Configure table `MaintenanceRequestPhotos`, PK, Id with `gen_random_uuid()` default
  - [x] 3.3 Configure `AccountId` (required), `MaintenanceRequestId` (required), `CreatedByUserId` (required)
  - [x] 3.4 Configure `StorageKey` as required, max 500; `ThumbnailStorageKey` optional, max 500
  - [x] 3.5 Configure `OriginalFileName` optional, max 255; `ContentType` optional, max 100
  - [x] 3.6 Configure `DisplayOrder` required, `IsPrimary` required
  - [x] 3.7 Configure FK to Account with `DeleteBehavior.Restrict`
  - [x] 3.8 Configure FK to MaintenanceRequest with `DeleteBehavior.Cascade` via `WithMany(mr => mr.Photos)`
  - [x] 3.9 Add indexes: `IX_MaintenanceRequestPhotos_AccountId`, `IX_MaintenanceRequestPhotos_MaintenanceRequestId_DisplayOrder`, unique filtered index `IX_MaintenanceRequestPhotos_MaintenanceRequestId_IsPrimary_Unique` where `IsPrimary = true`, `IX_MaintenanceRequestPhotos_CreatedByUserId`
  - [x] 3.10 Add `DbSet<MaintenanceRequestPhoto> MaintenanceRequestPhotos` to `IAppDbContext` and `AppDbContext`
  - [x] 3.11 Add global query filter in `AppDbContext.OnModelCreating`: `HasQueryFilter(e => CurrentAccountId == null || e.AccountId == CurrentAccountId)`
  - [x] 3.12 Create and apply migration

- [x] Task 4: Create GenerateMaintenanceRequestPhotoUploadUrl command + handler (AC: #2, #8)
  - [x] 4.1 Create `GenerateMaintenanceRequestPhotoUploadUrl.cs` in `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/`
  - [x] 4.2 Command: `GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid MaintenanceRequestId, string ContentType, long FileSizeBytes, string OriginalFileName) : IRequest<GenerateMaintenanceRequestPhotoUploadUrlResponse>`
  - [x] 4.3 Response: `GenerateMaintenanceRequestPhotoUploadUrlResponse(string UploadUrl, string StorageKey, string ThumbnailStorageKey, DateTime ExpiresAt)`
  - [x] 4.4 Handler: verify maintenance request exists (AccountId + DeletedAt check). For tenant users, verify request is on their PropertyId. Use `IPhotoService.GenerateUploadUrlAsync` with `PhotoEntityType.MaintenanceRequests`.

- [x] Task 5: Create GenerateMaintenanceRequestPhotoUploadUrl validator (AC: #2)
  - [x] 5.1 Create `GenerateMaintenanceRequestPhotoUploadUrlValidator.cs` — validate MaintenanceRequestId NotEmpty, ContentType NotEmpty + allowed type, FileSizeBytes > 0 and <= 10MB, OriginalFileName NotEmpty + max 255

- [x] Task 6: Create ConfirmMaintenanceRequestPhotoUpload command + handler (AC: #3)
  - [x] 6.1 Create `ConfirmMaintenanceRequestPhotoUpload.cs` in `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/`
  - [x] 6.2 Command: `ConfirmMaintenanceRequestPhotoUploadCommand(Guid MaintenanceRequestId, string StorageKey, string ThumbnailStorageKey, string ContentType, long FileSizeBytes, string OriginalFileName) : IRequest<ConfirmMaintenanceRequestPhotoUploadResponse>`
  - [x] 6.3 Response: `ConfirmMaintenanceRequestPhotoUploadResponse(Guid Id, string? ThumbnailUrl, string? ViewUrl)`
  - [x] 6.4 Handler: verify request exists + account ownership + tenant property scoping. Validate storage key belongs to current account. Call `IPhotoService.ConfirmUploadAsync` for thumbnail generation. Auto-set `IsPrimary = true` if first photo. Calculate DisplayOrder as max + 1. Create `MaintenanceRequestPhoto` entity.

- [x] Task 7: Create ConfirmMaintenanceRequestPhotoUpload validator (AC: #3)
  - [x] 7.1 Create `ConfirmMaintenanceRequestPhotoUploadValidator.cs` — validate MaintenanceRequestId, StorageKey, ThumbnailStorageKey, ContentType, FileSizeBytes, OriginalFileName (same pattern as ConfirmVendorPhotoUploadValidator)

- [x] Task 8: Create GetMaintenanceRequestPhotos query + handler (AC: #5)
  - [x] 8.1 Create `GetMaintenanceRequestPhotos.cs` in `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/`
  - [x] 8.2 Query: `GetMaintenanceRequestPhotosQuery(Guid MaintenanceRequestId) : IRequest<GetMaintenanceRequestPhotosResponse>`
  - [x] 8.3 DTO: `MaintenanceRequestPhotoDto(Guid Id, string? ThumbnailUrl, string? ViewUrl, bool IsPrimary, int DisplayOrder, string OriginalFileName, long FileSizeBytes, DateTime CreatedAt)`
  - [x] 8.4 Response: `GetMaintenanceRequestPhotosResponse(IReadOnlyList<MaintenanceRequestPhotoDto> Items)`
  - [x] 8.5 Handler: verify request exists + account ownership + tenant property scoping. Query photos ordered by DisplayOrder. Generate presigned URLs in parallel.

- [x] Task 9: Create DeleteMaintenanceRequestPhoto command + handler (AC: #6)
  - [x] 9.1 Create `DeleteMaintenanceRequestPhoto.cs` in `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/`
  - [x] 9.2 Command: `DeleteMaintenanceRequestPhotoCommand(Guid MaintenanceRequestId, Guid PhotoId) : IRequest`
  - [x] 9.3 Handler: verify photo exists, belongs to request and account. Delete from S3 via `IPhotoService.DeletePhotoAsync`. Remove from DB. If deleted photo was primary, promote next photo by DisplayOrder.

- [x] Task 10: Create DeleteMaintenanceRequestPhoto validator (AC: #6)
  - [x] 10.1 Create `DeleteMaintenanceRequestPhotoValidator.cs` — validate MaintenanceRequestId NotEmpty, PhotoId NotEmpty

- [x] Task 11: Create MaintenanceRequestPhotosController (AC: #2, #3, #5, #6, #8)
  - [x] 11.1 Create `MaintenanceRequestPhotosController.cs` in `backend/src/PropertyManager.Api/Controllers/`
  - [x] 11.2 Route: `api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos`
  - [x] 11.3 Class-level: `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` (no policy — both tenants and landlords can manage photos on their accessible requests, handler enforces scoping)
  - [x] 11.4 POST `upload-url` endpoint: accepts `MaintenanceRequestPhotoUploadUrlRequest(ContentType, FileSizeBytes, OriginalFileName)`, returns 200 with upload URL details
  - [x] 11.5 POST endpoint: accepts `MaintenanceRequestPhotoConfirmRequest(StorageKey, ThumbnailStorageKey, ContentType, FileSizeBytes, OriginalFileName)`, returns 201 with photo ID and URLs
  - [x] 11.6 GET endpoint: returns list of photos with presigned URLs
  - [x] 11.7 DELETE `{photoId:guid}` endpoint: returns 204
  - [x] 11.8 Define Request records at bottom of controller file
  - [x] 11.9 Inject IMediator, validators (upload URL, confirm, delete), ILogger

- [x] Task 12: Include photos in GetMaintenanceRequestById response (AC: #4)
  - [x] 12.1 Add `IReadOnlyList<MaintenanceRequestPhotoDto>? Photos` field to `MaintenanceRequestDto` (make it optional to avoid breaking existing list endpoint which does not need photos)
  - [x] 12.2 In `GetMaintenanceRequestByIdQueryHandler`, include `Photos` navigation, generate presigned URLs for each photo, populate the DTO field
  - [x] 12.3 Inject `IPhotoService` into `GetMaintenanceRequestByIdQueryHandler`

- [x] Task 13: Backend unit tests — GenerateMaintenanceRequestPhotoUploadUrl handler (AC: #2, #8)
  - [x] 13.1 Test: valid request returns upload URL details
  - [x] 13.2 Test: calls IPhotoService with PhotoEntityType.MaintenanceRequests and correct entity ID
  - [x] 13.3 Test: maintenance request not found throws NotFoundException
  - [x] 13.4 Test: deleted maintenance request throws NotFoundException
  - [x] 13.5 Test: tenant accessing request on different property throws NotFoundException

- [x] Task 14: Backend unit tests — ConfirmMaintenanceRequestPhotoUpload handler (AC: #3)
  - [x] 14.1 Test: valid confirm creates photo record and returns ID + URLs
  - [x] 14.2 Test: first photo gets IsPrimary = true
  - [x] 14.3 Test: subsequent photos get IsPrimary = false
  - [x] 14.4 Test: DisplayOrder increments correctly
  - [x] 14.5 Test: invalid storage key format throws ArgumentException
  - [x] 14.6 Test: storage key for different account throws UnauthorizedAccessException
  - [x] 14.7 Test: maintenance request not found throws NotFoundException

- [x] Task 15: Backend unit tests — GetMaintenanceRequestPhotos handler (AC: #5)
  - [x] 15.1 Test: returns photos ordered by DisplayOrder with presigned URLs
  - [x] 15.2 Test: maintenance request not found throws NotFoundException
  - [x] 15.3 Test: tenant accessing request on different property throws NotFoundException
  - [x] 15.4 Test: empty photo list returns empty Items

- [x] Task 16: Backend unit tests — DeleteMaintenanceRequestPhoto handler (AC: #6)
  - [x] 16.1 Test: deletes photo from DB and calls IPhotoService.DeletePhotoAsync
  - [x] 16.2 Test: photo not found throws NotFoundException
  - [x] 16.3 Test: if deleted photo was primary, promotes next photo
  - [x] 16.4 Test: if deleted photo was the only photo, no promotion needed

- [x] Task 17: Backend unit tests — Validators (AC: #2, #3, #6)
  - [x] 17.1 Test: GenerateUploadUrl validator — empty fields fail, valid passes
  - [x] 17.2 Test: ConfirmUpload validator — empty fields fail, valid passes
  - [x] 17.3 Test: Delete validator — empty IDs fail, valid passes

- [x] Task 18: Backend unit tests — GetMaintenanceRequestById with photos (AC: #4)
  - [x] 18.1 Test: detail response includes photos with presigned URLs
  - [x] 18.2 Test: detail response with no photos returns empty list

- [x] Task 19: Verify all existing tests pass (AC: all)
  - [x] 19.1 Run `dotnet test` — all backend tests pass
  - [x] 19.2 Run `dotnet build` — compiles without errors

## Dev Notes

### Architecture: Backend-Only Photo CRUD API

This is a backend-only story following the exact same pattern as VendorPhotos (Epic 17, Story 17-13) and WorkOrderPhotos (Epic 10). No frontend changes. The `MaintenanceRequestPhoto` entity is symmetric with `WorkOrderPhoto` and `VendorPhoto` — same fields, same `IPhotoService` integration, same controller structure.

### Key Pattern: Copy VendorPhotos, Replace "Vendor" with "MaintenanceRequest"

The vendor photo implementation is the most recent and cleanest reference. The story involves:

1. **Domain entity** (`MaintenanceRequestPhoto`) — mirrors `VendorPhoto` exactly
2. **EF Core config** (`MaintenanceRequestPhotoConfiguration`) — mirrors `WorkOrderPhotoConfiguration`
3. **Application handlers** — mirrors `VendorPhotos/` folder structure
4. **Controller** — mirrors `VendorPhotosController` with route `api/v1/maintenance-requests/{maintenanceRequestId}/photos`
5. **Tests** — mirrors `VendorPhotos/` test structure

### S3 Key Pattern

The `IPhotoService` generates storage keys automatically based on `PhotoEntityType` and entity ID. Add `MaintenanceRequests` to the `PhotoEntityType` enum. The resulting S3 key pattern will be: `{accountId}/maintenancerequests/{year}/{guid}.{ext}` (the photo service lowercases and removes spaces from the entity type name).

### PhotoEntityType Enum Addition

Add `MaintenanceRequests` to `PhotoEntityType` in `IPhotoService.cs`. This is the only change needed for the S3 key generation to work — the `IPhotoService` implementation uses the enum name in the storage key path.

### Authorization: Role-Based Scoping in Handlers

Both tenants and landlords can upload/view/delete photos on maintenance requests they can access:
- **Tenant:** can access photos on requests for their assigned property (PropertyId match)
- **Landlord (Owner/Contributor):** can access photos on any request in their account

The controller has no policy attribute beyond JWT auth. Handlers enforce scoping by:
1. Verifying the maintenance request exists with `AccountId == _currentUser.AccountId && DeletedAt == null`
2. For tenant users, additionally checking `maintenanceRequest.PropertyId == _currentUser.PropertyId`

This matches the existing pattern in `GetMaintenanceRequestByIdQueryHandler`.

### Including Photos in Detail Response

Modify `MaintenanceRequestDto` to include an optional `Photos` field. The `GetMaintenanceRequestByIdQueryHandler` will be updated to include photos with presigned URLs. The list endpoint (`GetMaintenanceRequests`) does NOT include photos — only the detail endpoint does (performance consideration for list views).

### Key Files to Create

**Domain Layer:**
- `backend/src/PropertyManager.Domain/Entities/MaintenanceRequestPhoto.cs`

**Application Layer (new folder `MaintenanceRequestPhotos/`):**
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrl.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrlValidator.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUpload.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUploadValidator.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GetMaintenanceRequestPhotos.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhoto.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhotoValidator.cs`

**Infrastructure Layer:**
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/MaintenanceRequestPhotoConfiguration.cs`
- New migration files (auto-generated)

**API Layer:**
- `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestPhotosController.cs`

### Key Files to Modify

- `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs` — add `Photos` navigation collection
- `backend/src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs` — add `MaintenanceRequests` to `PhotoEntityType` enum
- `backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs` — add `DbSet<MaintenanceRequestPhoto>`
- `backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs` — add DbSet + global query filter
- `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs` — add optional Photos field
- `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs` — include photos, inject IPhotoService
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GetMaintenanceRequestPhotos.cs` — photo DTO (reused in detail)

### Critical Patterns to Follow

1. **Entity extends `AuditableEntity` + implements `ITenantEntity`.** No `ISoftDeletable` — photo entities are hard-deleted (matching WorkOrderPhoto and VendorPhoto patterns).

2. **Global query filter on AccountId only** (no soft delete filter since photos are hard-deleted). Pattern: `HasQueryFilter(e => CurrentAccountId == null || e.AccountId == CurrentAccountId)`.

3. **No repository pattern.** Handlers use `IAppDbContext` directly.

4. **Validators injected into controllers and called explicitly** before `_mediator.Send()`.

5. **Request/Response records at bottom of controller file.** Follow `VendorPhotosController` pattern.

6. **Controller route:** `api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos` — nested under maintenance requests.

7. **Auto-primary logic:** First photo uploaded for a maintenance request gets `IsPrimary = true`. Subsequent photos get `IsPrimary = false`.

8. **Delete with primary promotion:** When deleting a primary photo, promote the next photo by DisplayOrder to primary.

9. **DisplayOrder calculation:** `maxDisplayOrder + 1` for new photos, starting from 0.

10. **Presigned URL generation in parallel:** Use `Task.WhenAll` pattern from `GetVendorPhotosHandler`.

11. **Storage key validation on confirm:** Validate that the storage key's account prefix matches `_currentUser.AccountId`.

12. **Photo DTO reuse:** The `MaintenanceRequestPhotoDto` defined in `GetMaintenanceRequestPhotos.cs` should be reused by the detail endpoint.

### Previous Story Intelligence

From Story 20.3:
- `MaintenanceRequest` entity is in place with `AuditableEntity`, `ITenantEntity`, `ISoftDeletable`
- `MaintenanceRequestsController` exists at `api/v1/maintenance-requests`
- `GetMaintenanceRequestByIdQueryHandler` does explicit account + tenant property scoping — same pattern needed for photo handlers
- `BusinessRuleException` was created and mapped to 400 in middleware
- Backend baseline: 1150 tests passing
- Frontend baseline: 2703 tests passing
- NSwag generation may fail with .NET 10 — manual API client update is acceptable

From VendorPhotos (reference implementation):
- Full CRUD: GenerateUploadUrl, ConfirmUpload, GetPhotos, Delete, SetPrimary, Reorder
- For this story: only GenerateUploadUrl, ConfirmUpload, GetPhotos, Delete (no SetPrimary or Reorder — keep it minimal for tenant use case)
- Test pattern: mock `IPhotoService`, `IAppDbContext`, `ICurrentUser`; use `MockQueryable.Moq`'s `BuildMockDbSet()`

### Testing Strategy

- **Backend unit tests** for:
  - GenerateUploadUrl handler (valid request, entity type, not found, deleted, tenant scoping)
  - ConfirmUpload handler (creates record, auto-primary, display order, key validation, not found)
  - GetPhotos handler (ordered list, not found, tenant scoping, empty list)
  - Delete handler (removes + S3 cleanup, primary promotion, not found)
  - All validators (required fields, constraints)
  - GetMaintenanceRequestById with photos (includes photos, empty photos)
- **No frontend tests** — backend-only story
- **No E2E tests** — tenant photo UI comes in Story 20.5 (tenant dashboard)

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.4)
- Previous story: `docs/project/stories/epic-20/20-3-maintenance-request-entity-api.md`
- Tenant Portal PRD: `docs/project/prd-tenant-portal.md` (FR-TP21, MaintenanceRequestPhoto data model)
- Reference implementation (VendorPhotos — most recent, cleanest):
  - Entity: `backend/src/PropertyManager.Domain/Entities/VendorPhoto.cs`
  - Generate URL: `backend/src/PropertyManager.Application/VendorPhotos/GenerateVendorPhotoUploadUrl.cs`
  - Generate URL validator: `backend/src/PropertyManager.Application/VendorPhotos/GenerateVendorPhotoUploadUrlValidator.cs`
  - Confirm upload: `backend/src/PropertyManager.Application/VendorPhotos/ConfirmVendorPhotoUpload.cs`
  - Confirm validator: `backend/src/PropertyManager.Application/VendorPhotos/ConfirmVendorPhotoUploadValidator.cs`
  - Get photos: `backend/src/PropertyManager.Application/VendorPhotos/GetVendorPhotos.cs`
  - Delete: `backend/src/PropertyManager.Application/VendorPhotos/DeleteVendorPhoto.cs`
  - Controller: `backend/src/PropertyManager.Api/Controllers/VendorPhotosController.cs`
  - Tests: `backend/tests/PropertyManager.Application.Tests/VendorPhotos/`
- Reference implementation (WorkOrderPhotos — EF Config):
  - Config: `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/WorkOrderPhotoConfiguration.cs`
  - Entity: `backend/src/PropertyManager.Domain/Entities/WorkOrderPhoto.cs`
- IPhotoService: `backend/src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs`
- IAppDbContext: `backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs`
- AppDbContext: `backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs`
- MaintenanceRequest entity: `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs`
- MaintenanceRequestDto: `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs`
- GetMaintenanceRequestById: `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs`
- ICurrentUser: `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs`

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Build succeeded with 0 errors, 0 warnings (relevant)
- All 1,812 backend tests pass (1183 Application + 98 Infrastructure + 531 Api)
- 31 new MaintenanceRequestPhotos tests + 2 new GetMaintenanceRequestById photo tests = 33 new tests

### Completion Notes List
- Tasks 1-3: Domain entity, PhotoEntityType enum, EF Core config + migration created and applied
- Tasks 4-10: All CQRS handlers, validators created following VendorPhotos pattern exactly
- Task 11: Controller created with 4 endpoints (upload-url, confirm, get, delete)
- Task 12: GetMaintenanceRequestById now includes Photos with presigned URLs
- Tasks 13-18: All unit tests written and passing (33 new tests total)
- Task 19: Full test suite passes with zero regressions
- Pattern: Symmetric with VendorPhotos — same handler structure, same test patterns, same controller layout
- Authorization: Both tenants and landlords can manage photos; tenant scoping enforced in handlers via PropertyId check

### File List

**New Files:**
- `backend/src/PropertyManager.Domain/Entities/MaintenanceRequestPhoto.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/MaintenanceRequestPhotoConfiguration.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/*AddMaintenanceRequestPhotos*` (migration files)
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrl.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrlValidator.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUpload.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUploadValidator.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GetMaintenanceRequestPhotos.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhoto.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhotoValidator.cs`
- `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestPhotosController.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/GenerateMaintenanceRequestPhotoUploadUrlHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/ConfirmMaintenanceRequestPhotoUploadHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/GetMaintenanceRequestPhotosHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/DeleteMaintenanceRequestPhotoHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/ValidatorTests.cs`

**Modified Files:**
- `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs` — added Photos navigation collection
- `backend/src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs` — added MaintenanceRequests to PhotoEntityType enum
- `backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs` — added DbSet<MaintenanceRequestPhoto>
- `backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs` — added DbSet + global query filter
- `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs` — added optional Photos field
- `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs` — included Photos, injected IPhotoService
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/GetMaintenanceRequestByIdHandlerTests.cs` — added IPhotoService mock + 2 photo tests
- `docs/project/sprint-status.yaml` — updated story status
