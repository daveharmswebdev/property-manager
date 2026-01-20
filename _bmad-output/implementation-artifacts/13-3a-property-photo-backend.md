# Story 13.3a: Property Photo Backend - Entity & API

Status: dev-complete

## Story

As a property owner,
I want the backend API to support property photo management,
so that frontend components can upload, view, and manage property photos.

## Parent Story

Split from [Story 13.3: Property Photo Gallery](13-3-property-photo-gallery.md)

## Dependencies

- None (this is the foundation story)

## Acceptance Criteria

### Entity & Migration

1. **AC-13.3a.1**: `PropertyPhoto` entity exists with fields: `Id`, `PropertyId`, `AccountId`, `StorageKey`, `ThumbnailStorageKey`, `OriginalFileName`, `ContentType`, `FileSizeBytes`, `DisplayOrder`, `IsPrimary`, `CreatedByUserId`, `CreatedAt`
2. **AC-13.3a.2**: EF Core migration creates `PropertyPhotos` table with:
   - Unique index on `(PropertyId, IsPrimary) WHERE IsPrimary = true` (only one primary per property)
   - Index on `(PropertyId, DisplayOrder)` for efficient ordering
   - FK to `Properties(Id)` with cascade delete

### Commands

3. **AC-13.3a.3**: `POST /api/v1/properties/{propertyId}/photos/upload-url` generates presigned URL (uses existing PhotoService)
4. **AC-13.3a.4**: `POST /api/v1/properties/{propertyId}/photos` confirms upload, creates PropertyPhoto record, auto-sets `IsPrimary=true` if first photo
5. **AC-13.3a.5**: `DELETE /api/v1/properties/{propertyId}/photos/{photoId}` soft-deletes from DB and removes from S3; if deleted photo was primary, promotes next photo by DisplayOrder
6. **AC-13.3a.6**: `PUT /api/v1/properties/{propertyId}/photos/{photoId}/primary` sets photo as primary, clears previous primary
7. **AC-13.3a.7**: `PUT /api/v1/properties/{propertyId}/photos/reorder` accepts array of photo IDs in new order, updates `DisplayOrder` values

### Queries

8. **AC-13.3a.8**: `GET /api/v1/properties/{propertyId}/photos` returns all photos ordered by `DisplayOrder`, includes presigned view URLs
9. **AC-13.3a.9**: `PropertyDto` includes `PrimaryPhotoThumbnailUrl` (nullable) for list view

### Cross-Cutting

10. **AC-13.3a.10**: All endpoints enforce tenant isolation via `AccountId`
11. **AC-13.3a.11**: Unit tests cover all commands/queries with >80% coverage

## Tasks / Subtasks

### Task 1: Backend - PropertyPhoto Entity & Migration (AC: 1, 2)
- [x] 1.1 Create `PropertyPhoto` entity in `Domain/Entities/`
- [x] 1.2 Add `PropertyPhotos` navigation to `Property` entity
- [x] 1.3 Create `PropertyPhotoConfiguration` in Infrastructure
- [x] 1.4 Create migration with indexes
- [x] 1.5 Run migration locally, verify schema

### Task 2: Backend - Property Photo Commands (AC: 3, 4, 5, 6, 7, 10)
- [x] 2.1 Create `GeneratePropertyPhotoUploadUrl` command (reuses IPhotoService)
- [x] 2.2 Create `ConfirmPropertyPhotoUpload` command with auto-primary logic
- [x] 2.3 Create `DeletePropertyPhoto` command with primary promotion
- [x] 2.4 Create `SetPrimaryPropertyPhoto` command
- [x] 2.5 Create `ReorderPropertyPhotos` command
- [x] 2.6 Add FluentValidation validators for all commands

### Task 3: Backend - Property Photo Queries (AC: 8, 9)
- [x] 3.1 Create `GetPropertyPhotos` query returning photos with presigned URLs
- [x] 3.2 Update `GetProperty` query to include `PrimaryPhotoThumbnailUrl`
- [x] 3.3 Update `GetAllProperties` query to include `PrimaryPhotoThumbnailUrl`
- [x] 3.4 Create/update DTOs (`PropertyPhotoDto`, update `PropertyDto`)

### Task 4: Backend - PropertyPhotosController (AC: 3, 4, 5, 6, 7, 8)
- [x] 4.1 Create `PropertyPhotosController` with all endpoints
- [x] 4.2 Implement proper authorization (user must own property)
- [x] 4.3 Add Swagger documentation
- [x] 4.4 Verify NSwag generates TypeScript client

### Task 5: Backend - Unit Tests (AC: 11)
- [x] 5.1 Test `ConfirmPropertyPhotoUpload` handler (auto-primary logic)
- [x] 5.2 Test `DeletePropertyPhoto` handler (primary promotion)
- [x] 5.3 Test `SetPrimaryPropertyPhoto` handler
- [x] 5.4 Test `ReorderPropertyPhotos` handler
- [x] 5.5 Test validators

## Dev Notes

### Architecture Compliance

**Backend Clean Architecture Layers:**
- `PropertyPhoto` entity → `Domain/Entities/`
- Commands/Queries → `Application/PropertyPhotos/`
- EF Configuration → `Infrastructure/Persistence/Configurations/`
- Controller → `Api/Controllers/PropertyPhotosController.cs`

**CQRS Pattern:**
- Follow existing patterns in `Application/Properties/` and `Application/Photos/`
- Each command/query gets its own file with handler + validator
- Use MediatR pipeline behaviors for validation

### Existing Code to Reuse

**DO NOT reinvent these - they already exist:**

| Component | Location | Usage |
|-----------|----------|-------|
| `IPhotoService` | `Application/Common/Interfaces/IPhotoService.cs` | Generate upload URLs, confirm uploads, delete photos |
| `PhotoService` | `Infrastructure/Storage/PhotoService.cs` | S3 operations + thumbnail generation |
| `PhotosController` | `Api/Controllers/PhotosController.cs` | Reference for endpoint patterns |
| `PhotoEntityType.Properties` | Enum value already exists | Use for IPhotoService calls |

### Entity Design

```csharp
public class PropertyPhoto : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string? ThumbnailStorageKey { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsPrimary { get; set; }
    public Guid CreatedByUserId { get; set; }

    // Navigation
    public Account Account { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
}
```

### API Endpoint Design

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/properties/{id}/photos/upload-url` | `{ contentType, fileSizeBytes, originalFileName }` | `{ uploadUrl, storageKey, thumbnailStorageKey, expiresAt }` |
| POST | `/properties/{id}/photos` | `{ storageKey, thumbnailStorageKey, contentType, fileSizeBytes, originalFileName }` | `{ id, thumbnailUrl, viewUrl }` |
| GET | `/properties/{id}/photos` | - | `{ items: [{ id, thumbnailUrl, viewUrl, isPrimary, displayOrder }] }` |
| DELETE | `/properties/{id}/photos/{photoId}` | - | 204 No Content |
| PUT | `/properties/{id}/photos/{photoId}/primary` | - | 204 No Content |
| PUT | `/properties/{id}/photos/reorder` | `{ photoIds: ["id1", "id2", ...] }` | 204 No Content |

### Testing Requirements

**Backend Tests (xUnit):**
- Test auto-primary on first upload
- Test primary promotion on delete
- Test tenant isolation (cannot access other account's photos)
- Test reorder maintains correct DisplayOrder values

### Project Structure

This story adds:
```
backend/src/PropertyManager.Domain/Entities/PropertyPhoto.cs
backend/src/PropertyManager.Application/PropertyPhotos/
  ├── GeneratePropertyPhotoUploadUrl.cs
  ├── ConfirmPropertyPhotoUpload.cs
  ├── GetPropertyPhotos.cs
  ├── DeletePropertyPhoto.cs
  ├── SetPrimaryPropertyPhoto.cs
  └── ReorderPropertyPhotos.cs
backend/src/PropertyManager.Infrastructure/Persistence/Configurations/PropertyPhotoConfiguration.cs
backend/src/PropertyManager.Api/Controllers/PropertyPhotosController.cs
```

### References

- [Source: GitHub Issue #100](https://github.com/daveharmswebdev/property-manager/issues/100)
- [Source: architecture.md#Phase-2-Work-Orders-and-Vendors] - Photo attachment patterns
- [Source: PhotoService.cs] - Existing generic photo service
- [Source: PhotosController.cs] - Existing photo endpoint patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created `PropertyPhoto` entity with all required fields (Id, PropertyId, AccountId, StorageKey, ThumbnailStorageKey, OriginalFileName, ContentType, FileSizeBytes, DisplayOrder, IsPrimary, CreatedByUserId, CreatedAt)
- Added `PropertyPhotoConfiguration` with unique filtered index for IsPrimary (only one primary per property)
- Implemented auto-primary logic: first photo for a property automatically becomes primary
- Implemented primary promotion: when deleting primary photo, next photo by DisplayOrder becomes primary
- All commands enforce tenant isolation via AccountId
- Updated existing Properties queries to include PrimaryPhotoThumbnailUrl
- Fixed existing tests to include IPhotoService mock dependency
- All 998 backend tests passing (60 PropertyPhotos tests)

### Code Review Fixes (2026-01-20)

- **Added missing unit tests**: Created `GetPropertyPhotosHandlerTests.cs` (8 tests) and `GeneratePropertyPhotoUploadUrlHandlerTests.cs` (7 tests)
- **Performance optimization**: Parallelized presigned URL generation in `GetPropertyPhotos` and `GetAllProperties` using `Task.WhenAll`
- **Added missing index**: Added `IX_PropertyPhotos_CreatedByUserId` index for audit/reporting queries (consistent with other entities)
- **New migration**: `AddPropertyPhotoCreatedByUserIdIndex` for the new index

### File List

**New Files:**
- backend/src/PropertyManager.Domain/Entities/PropertyPhoto.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/PropertyPhotoConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260120123049_AddPropertyPhotos.cs
- backend/src/PropertyManager.Application/PropertyPhotos/GeneratePropertyPhotoUploadUrl.cs
- backend/src/PropertyManager.Application/PropertyPhotos/GeneratePropertyPhotoUploadUrlValidator.cs
- backend/src/PropertyManager.Application/PropertyPhotos/ConfirmPropertyPhotoUpload.cs
- backend/src/PropertyManager.Application/PropertyPhotos/ConfirmPropertyPhotoUploadValidator.cs
- backend/src/PropertyManager.Application/PropertyPhotos/DeletePropertyPhoto.cs
- backend/src/PropertyManager.Application/PropertyPhotos/DeletePropertyPhotoValidator.cs
- backend/src/PropertyManager.Application/PropertyPhotos/SetPrimaryPropertyPhoto.cs
- backend/src/PropertyManager.Application/PropertyPhotos/SetPrimaryPropertyPhotoValidator.cs
- backend/src/PropertyManager.Application/PropertyPhotos/ReorderPropertyPhotos.cs
- backend/src/PropertyManager.Application/PropertyPhotos/ReorderPropertyPhotosValidator.cs
- backend/src/PropertyManager.Application/PropertyPhotos/GetPropertyPhotos.cs
- backend/src/PropertyManager.Api/Controllers/PropertyPhotosController.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ConfirmPropertyPhotoUploadHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/DeletePropertyPhotoHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/SetPrimaryPropertyPhotoHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ReorderPropertyPhotosHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ValidatorTests.cs
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/GetPropertyPhotosHandlerTests.cs (code review fix)
- backend/tests/PropertyManager.Application.Tests/PropertyPhotos/GeneratePropertyPhotoUploadUrlHandlerTests.cs (code review fix)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/*_AddPropertyPhotoCreatedByUserIdIndex.cs (code review fix)

**Modified Files:**
- backend/src/PropertyManager.Domain/Entities/Property.cs (added PropertyPhotos navigation)
- backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs (added PropertyPhotos DbSet)
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs (added PropertyPhotos DbSet and tenant filter)
- backend/src/PropertyManager.Application/Properties/GetAllProperties.cs (added PrimaryPhotoThumbnailUrl)
- backend/src/PropertyManager.Application/Properties/GetPropertyById.cs (added PrimaryPhotoThumbnailUrl)
- backend/tests/PropertyManager.Application.Tests/Properties/GetAllPropertiesHandlerTests.cs (added IPhotoService mock)
- backend/tests/PropertyManager.Application.Tests/Properties/GetPropertyByIdHandlerTests.cs (added IPhotoService mock)
- backend/src/PropertyManager.Application/PropertyPhotos/GetPropertyPhotos.cs (code review: parallelized URL generation)
- backend/src/PropertyManager.Application/Properties/GetAllProperties.cs (code review: parallelized URL generation)
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/PropertyPhotoConfiguration.cs (code review: added CreatedByUserId index)

