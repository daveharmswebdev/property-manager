# Story 13.3b: Property Photo Gallery & Upload

Status: ready-for-review

## Story

As a property owner,
I want to view a gallery of my property photos and upload new ones,
so that I can visually document my properties and see them in lists.

## Parent Story

Split from [Story 13.3: Property Photo Gallery](13-3-property-photo-gallery.md)

## Dependencies

- **Story 13.3a** (Property Photo Backend) - Must be complete before starting

## Acceptance Criteria

### Property List Thumbnail

1. **AC-13.3b.1**: Property list cards show thumbnail from `PrimaryPhotoThumbnailUrl` or fallback home icon

### Gallery Component

2. **AC-13.3b.2**: Property detail page has "Photos" section with gallery grid (max 3x4 on desktop)
3. **AC-13.3b.3**: Empty state shows upload prompt when no photos exist
4. **AC-13.3b.4**: Loading states show skeleton placeholders during fetch
5. **AC-13.3b.5**: Responsive design: 1 column on mobile, 2 on tablet, 3+ on desktop
6. **AC-13.3b.6**: Smooth transitions when photos load (fade-in)

### Upload Component

7. **AC-13.3b.7**: Photo upload component supports drag-drop and file picker, shows progress bar, validates file type/size client-side
8. **AC-13.3b.8**: Error states show retry option on upload/load failures
9. **AC-13.3b.9**: First uploaded photo automatically becomes primary

## Tasks / Subtasks

### Task 1: Frontend - Property List Thumbnail (AC: 1)
- [x] 1.1 Update property card component to show thumbnail
- [x] 1.2 Add fallback home icon when no photo
- [x] 1.3 Style thumbnail with proper aspect ratio

### Task 2: Frontend - Property Photo Gallery Component (AC: 2, 3, 4, 5, 6)
- [x] 2.1 Create `PropertyPhotoGalleryComponent` in `features/properties/components/`
- [x] 2.2 Implement responsive grid layout (CSS Grid)
- [x] 2.3 Add empty state with upload CTA
- [x] 2.4 Add skeleton loading placeholders
- [x] 2.5 Add fade-in transitions

### Task 3: Frontend - Property Photo Upload Component (AC: 7, 8, 9)
- [x] 3.1 Create `PropertyPhotoUploadComponent` with drag-drop zone
- [x] 3.2 Integrate existing `PhotoUploadService`
- [x] 3.3 Show upload progress bar
- [x] 3.4 Add client-side validation (file type, size)
- [x] 3.5 Handle errors with retry option

### Task 4: Frontend - State Management & Integration
- [x] 4.1 Create property photo store (signals-based)
- [x] 4.2 Add photo gallery section to property-detail page
- [x] 4.3 Regenerate API client from backend
- [x] 4.4 Wire up all API calls
- [x] 4.5 Test mobile/tablet/desktop breakpoints

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
- Gallery component → `features/properties/components/property-photo-gallery/`
- Upload component → `features/properties/components/property-photo-upload/`
- Store → `features/properties/stores/property-photo.store.ts`

### Existing Code to Reuse

**DO NOT reinvent these - they already exist:**

| Component | Location | Usage |
|-----------|----------|-------|
| `PhotoUploadService` | `shared/services/photo-upload.service.ts` | S3 direct upload with progress |
| `PhotoEntityType.Properties` | Enum value already exists | Use for upload service calls |

### Frontend Component Hierarchy

```
property-detail.component.ts
└── property-photo-gallery.component.ts
    ├── property-photo-upload.component.ts (when adding)
    └── property-photo-card.component.ts (per photo - basic version)
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
  }))
);
```

### Project Structure

This story adds:
```
frontend/src/app/features/properties/components/
  ├── property-photo-gallery/
  │   ├── property-photo-gallery.component.ts
  │   ├── property-photo-gallery.component.html
  │   └── property-photo-gallery.component.scss
  ├── property-photo-upload/
  │   ├── property-photo-upload.component.ts
  │   ├── property-photo-upload.component.html
  │   └── property-photo-upload.component.scss
  └── property-photo-card/
      ├── property-photo-card.component.ts
      ├── property-photo-card.component.html
      └── property-photo-card.component.scss
frontend/src/app/features/properties/stores/property-photo.store.ts
```

### References

- [Source: GitHub Issue #100](https://github.com/daveharmswebdev/property-manager/issues/100)
- [Source: photo-upload.service.ts] - Existing S3 upload service

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **Task 1**: Updated `PropertyRowComponent` to show thumbnail from `primaryPhotoThumbnailUrl` with home icon fallback. Added `thumbnailUrl` input and updated styles. Updated `PropertySummaryDto` and `PropertyDetailDto` to include the new field.
- **Task 2**: Created `PropertyPhotoGalleryComponent` with responsive CSS Grid layout (1/2/3 columns based on viewport), empty state with upload CTA, skeleton loading placeholders with shimmer animation, and fade-in transitions on image load. Primary photos show star badge.
- **Task 3**: Created `PropertyPhotoUploadComponent` with drag-drop zone, file picker integration, upload progress bar, client-side file type/size validation using existing `PhotoUploadService`, and error states with retry option.
- **Task 4**: Created `PropertyPhotoStore` with signals-based state management for photos list, upload progress, delete, set primary, and reorder operations. Integrated gallery and upload components into `PropertyDetailComponent` with upload dialog overlay.
- All 1109 frontend tests passing

### File List

**New Files:**
- frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts
- frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.spec.ts
- frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.ts
- frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.spec.ts
- frontend/src/app/features/properties/stores/property-photo.store.ts

**Modified Files:**
- frontend/src/app/shared/components/property-row/property-row.component.ts (added thumbnailUrl input, updated template/styles)
- frontend/src/app/shared/components/property-row/property-row.component.spec.ts (added thumbnail tests)
- frontend/src/app/features/properties/properties.component.ts (pass thumbnailUrl to PropertyRow)
- frontend/src/app/features/properties/services/property.service.ts (added primaryPhotoThumbnailUrl to DTOs)
- frontend/src/app/features/properties/property-detail/property-detail.component.ts (integrated photo gallery, upload dialog)
- frontend/src/app/features/properties/property-detail/property-detail.component.spec.ts (added mockPhotoStore)
- frontend/src/app/core/api/api.service.ts (regenerated with PropertyPhoto endpoints)
- frontend/nswag.json (temporarily updated port for API generation)

