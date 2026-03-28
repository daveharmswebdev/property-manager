# Story 13.3: Property Photo Gallery

Status: split

> **This story has been split into smaller stories for better manageability:**
>
> | Story | Description | Status |
> |-------|-------------|--------|
> | [13.3a](13-3a-property-photo-backend.md) | Backend - Entity & API | ready-for-dev |
> | [13.3b](13-3b-property-photo-gallery-upload.md) | Frontend - Gallery & Upload | blocked (depends on 13.3a) |
> | [13.3c](13-3c-property-photo-lightbox-management.md) | Frontend - Lightbox & Management | blocked (depends on 13.3b) |
>
> **Dependency chain:** 13.3a → 13.3b → 13.3c

---

## Original Story (for reference)

## Story

As a property owner,
I want to upload, view, and manage photos of my properties,
so that I can visually identify properties in lists and document their condition.

## Acceptance Criteria

### Backend (Entity & API)

1. **AC-13.3.1**: `PropertyPhoto` entity exists with fields: `Id`, `PropertyId`, `AccountId`, `StorageKey`, `ThumbnailStorageKey`, `OriginalFileName`, `ContentType`, `FileSizeBytes`, `DisplayOrder`, `IsPrimary`, `CreatedByUserId`, `CreatedAt`
2. **AC-13.3.2**: EF Core migration creates `PropertyPhotos` table with:
   - Unique index on `(PropertyId, IsPrimary) WHERE IsPrimary = true` (only one primary per property)
   - Index on `(PropertyId, DisplayOrder)` for efficient ordering
   - FK to `Properties(Id)` with cascade delete
3. **AC-13.3.3**: `POST /api/v1/properties/{propertyId}/photos/upload-url` generates presigned URL (uses existing PhotoService)
4. **AC-13.3.4**: `POST /api/v1/properties/{propertyId}/photos` confirms upload, creates PropertyPhoto record, auto-sets `IsPrimary=true` if first photo
5. **AC-13.3.5**: `GET /api/v1/properties/{propertyId}/photos` returns all photos ordered by `DisplayOrder`, includes presigned view URLs
6. **AC-13.3.6**: `DELETE /api/v1/properties/{propertyId}/photos/{photoId}` soft-deletes from DB and removes from S3; if deleted photo was primary, promotes next photo by DisplayOrder
7. **AC-13.3.7**: `PUT /api/v1/properties/{propertyId}/photos/{photoId}/primary` sets photo as primary, clears previous primary
8. **AC-13.3.8**: `PUT /api/v1/properties/{propertyId}/photos/reorder` accepts array of photo IDs in new order, updates `DisplayOrder` values
9. **AC-13.3.9**: `PropertyDto` includes `PrimaryPhotoThumbnailUrl` (nullable) for list view
10. **AC-13.3.10**: All endpoints enforce tenant isolation via `AccountId`
11. **AC-13.3.11**: Unit tests cover all commands/queries with >80% coverage

### Frontend (Components & UX)

12. **AC-13.3.12**: Property list cards show thumbnail from `PrimaryPhotoThumbnailUrl` or fallback home icon
13. **AC-13.3.13**: Property detail page has "Photos" section with gallery grid (max 3x4 on desktop)
14. **AC-13.3.14**: Clicking a photo opens lightbox modal with navigation (prev/next), zoom controls, and close button
15. **AC-13.3.15**: Photo upload component supports drag-drop and file picker, shows progress bar, validates file type/size client-side
16. **AC-13.3.16**: Photo management component shows star icon on primary photo, allows delete (with confirmation), set as primary
17. **AC-13.3.17**: Reorder photos via "move up/down" buttons (drag-drop deferred to growth phase)
18. **AC-13.3.18**: Empty state shows upload prompt when no photos exist
19. **AC-13.3.19**: Loading states show skeleton placeholders during fetch
20. **AC-13.3.20**: Error states show retry option on upload/load failures
21. **AC-13.3.21**: Responsive design: 1 column on mobile, 2 on tablet, 3+ on desktop

### UX Requirements

22. **AC-13.3.22**: First uploaded photo automatically becomes primary
23. **AC-13.3.23**: When primary photo is deleted, next photo by DisplayOrder becomes primary
24. **AC-13.3.24**: Visual indicator (star badge) distinguishes primary photo
25. **AC-13.3.25**: Delete confirmation dialog warns action cannot be undone
26. **AC-13.3.26**: Smooth transitions when photos load (fade-in)

## Tasks / Subtasks

### Task 1: Backend - PropertyPhoto Entity & Migration (AC: 1, 2)
- [ ] 1.1 Create `PropertyPhoto` entity in `Domain/Entities/`
- [ ] 1.2 Add `PropertyPhotos` navigation to `Property` entity
- [ ] 1.3 Create `PropertyPhotoConfiguration` in Infrastructure
- [ ] 1.4 Create migration with indexes
- [ ] 1.5 Run migration locally, verify schema

### Task 2: Backend - Property Photo Commands (AC: 3, 4, 6, 7, 8, 10)
- [ ] 2.1 Create `GeneratePropertyPhotoUploadUrl` command (reuses IPhotoService)
- [ ] 2.2 Create `ConfirmPropertyPhotoUpload` command with auto-primary logic
- [ ] 2.3 Create `DeletePropertyPhoto` command with primary promotion
- [ ] 2.4 Create `SetPrimaryPropertyPhoto` command
- [ ] 2.5 Create `ReorderPropertyPhotos` command
- [ ] 2.6 Add FluentValidation validators for all commands

### Task 3: Backend - Property Photo Queries (AC: 5, 9)
- [ ] 3.1 Create `GetPropertyPhotos` query returning photos with presigned URLs
- [ ] 3.2 Update `GetProperty` query to include `PrimaryPhotoThumbnailUrl`
- [ ] 3.3 Update `GetAllProperties` query to include `PrimaryPhotoThumbnailUrl`
- [ ] 3.4 Create/update DTOs (`PropertyPhotoDto`, update `PropertyDto`)

### Task 4: Backend - PropertyPhotosController (AC: 3, 4, 5, 6, 7, 8)
- [ ] 4.1 Create `PropertyPhotosController` with all endpoints
- [ ] 4.2 Implement proper authorization (user must own property)
- [ ] 4.3 Add Swagger documentation
- [ ] 4.4 Verify NSwag generates TypeScript client

### Task 5: Backend - Unit Tests (AC: 11)
- [ ] 5.1 Test `ConfirmPropertyPhotoUpload` handler (auto-primary logic)
- [ ] 5.2 Test `DeletePropertyPhoto` handler (primary promotion)
- [ ] 5.3 Test `SetPrimaryPropertyPhoto` handler
- [ ] 5.4 Test `ReorderPropertyPhotos` handler
- [ ] 5.5 Test validators

### Task 6: Frontend - Property List Thumbnail (AC: 12)
- [ ] 6.1 Update property card component to show thumbnail
- [ ] 6.2 Add fallback home icon when no photo
- [ ] 6.3 Style thumbnail with proper aspect ratio

### Task 7: Frontend - Property Photo Gallery Component (AC: 13, 18, 19, 21, 26)
- [ ] 7.1 Create `PropertyPhotoGalleryComponent` in `features/properties/components/`
- [ ] 7.2 Implement responsive grid layout (CSS Grid)
- [ ] 7.3 Add empty state with upload CTA
- [ ] 7.4 Add skeleton loading placeholders
- [ ] 7.5 Add fade-in transitions

### Task 8: Frontend - Property Photo Lightbox (AC: 14)
- [ ] 8.1 Create `PropertyPhotoLightboxComponent` (modal dialog)
- [ ] 8.2 Add prev/next navigation with keyboard support
- [ ] 8.3 Integrate existing `PhotoViewerComponent` for zoom/rotate
- [ ] 8.4 Close on backdrop click or Escape key

### Task 9: Frontend - Property Photo Upload Component (AC: 15, 20)
- [ ] 9.1 Create `PropertyPhotoUploadComponent` with drag-drop zone
- [ ] 9.2 Integrate existing `PhotoUploadService`
- [ ] 9.3 Show upload progress bar
- [ ] 9.4 Add client-side validation (file type, size)
- [ ] 9.5 Handle errors with retry option

### Task 10: Frontend - Property Photo Management (AC: 16, 17, 22, 23, 24, 25)
- [ ] 10.1 Add star badge on primary photo
- [ ] 10.2 Add context menu (set primary, delete)
- [ ] 10.3 Add move up/down reorder buttons
- [ ] 10.4 Implement delete confirmation dialog
- [ ] 10.5 Update gallery after each operation

### Task 11: Frontend - Integration (AC: all frontend)
- [ ] 11.1 Add photo gallery section to property-detail page
- [ ] 11.2 Create property photo store (signals-based)
- [ ] 11.3 Wire up all API calls
- [ ] 11.4 Test mobile/tablet/desktop breakpoints

### Task 12: Frontend - Unit Tests
- [ ] 12.1 Test gallery component rendering
- [ ] 12.2 Test upload component validation
- [ ] 12.3 Test lightbox navigation
- [ ] 12.4 Test store state management

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

**Frontend Structure:**
- Gallery component → `features/properties/components/property-photo-gallery/`
- Lightbox component → `shared/components/property-photo-lightbox/`
- Upload component → `features/properties/components/property-photo-upload/`
- Store → `features/properties/stores/property-photo.store.ts`

### Existing Code to Reuse

**DO NOT reinvent these - they already exist:**

| Component | Location | Usage |
|-----------|----------|-------|
| `IPhotoService` | `Application/Common/Interfaces/IPhotoService.cs` | Generate upload URLs, confirm uploads, delete photos |
| `PhotoService` | `Infrastructure/Storage/PhotoService.cs` | S3 operations + thumbnail generation |
| `PhotosController` | `Api/Controllers/PhotosController.cs` | Reference for endpoint patterns |
| `PhotoViewerComponent` | `shared/components/photo-viewer/` | Zoom/rotate/pan in lightbox |
| `PhotoUploadService` | `shared/services/photo-upload.service.ts` | S3 direct upload with progress |
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

### Frontend Component Hierarchy

```
property-detail.component.ts
└── property-photo-gallery.component.ts
    ├── property-photo-upload.component.ts (when adding)
    ├── property-photo-card.component.ts (per photo)
    │   └── context menu (set primary, delete)
    └── property-photo-lightbox.component.ts (modal)
        └── photo-viewer.component.ts (existing - zoom/rotate)
```

### State Management (Signals)

```typescript
// property-photo.store.ts
export const PropertyPhotoStore = signalStore(
  { providedIn: 'root' },
  withState<PropertyPhotoState>({
    photos: [],
    isLoading: false,
    isUploading: false,
    uploadProgress: 0,
    error: null,
  }),
  withMethods((store, apiClient = inject(ApiClient)) => ({
    loadPhotos: rxMethod<string>(/* propertyId */),
    uploadPhoto: rxMethod<{ propertyId: string; file: File }>(),
    deletePhoto: rxMethod<{ propertyId: string; photoId: string }>(),
    setPrimary: rxMethod<{ propertyId: string; photoId: string }>(),
    reorderPhotos: rxMethod<{ propertyId: string; photoIds: string[] }>(),
  }))
);
```

### Testing Requirements

**Backend Tests (xUnit):**
- Test auto-primary on first upload
- Test primary promotion on delete
- Test tenant isolation (cannot access other account's photos)
- Test reorder maintains correct DisplayOrder values

**Frontend Tests (Vitest):**
- Test gallery renders photos in correct order
- Test empty state shows upload prompt
- Test upload validation rejects invalid files
- Test lightbox navigation wraps correctly

### Project Structure Notes

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
frontend/src/app/features/properties/components/
  ├── property-photo-gallery/
  ├── property-photo-upload/
  └── property-photo-card/
frontend/src/app/shared/components/property-photo-lightbox/
frontend/src/app/features/properties/stores/property-photo.store.ts
```

### References

- [Source: GitHub Issue #100](https://github.com/daveharmswebdev/property-manager/issues/100)
- [Source: architecture.md#Phase-2-Work-Orders-and-Vendors] - Photo attachment patterns
- [Source: PhotoService.cs] - Existing generic photo service
- [Source: PhotosController.cs] - Existing photo endpoint patterns
- [Source: photo-viewer.component.ts] - Existing viewer with zoom/rotate
- [Source: photo-upload.service.ts] - Existing S3 upload service

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List
