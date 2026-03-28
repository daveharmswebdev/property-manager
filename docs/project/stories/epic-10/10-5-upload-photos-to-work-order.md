# Story 10.5: Upload Photos to Work Order

Status: ready-for-dev

## Story

As a **property owner**,
I want **to attach photos to a work order**,
So that **I can document the problem visually (before, during, after repairs)**.

## Design Philosophy: Unified Codebase, Maximum Reuse

**CRITICAL:** This story implements the frontend for work order photo upload. Per Dave's guidance:

> "Focus on reusability. Maintain/improve symmetry with property photo feature. Unified application - one voice. Evidence of one codebase."

**Reusability Analysis:**

| Component | Status | Strategy |
|-----------|--------|----------|
| `PhotoUploadService` | ✅ Shared | Entity-agnostic, reuse as-is |
| `PhotoViewerComponent` | ✅ Shared | Reuse as-is |
| `PropertyPhotoLightboxComponent` | ✅ Shared (rename) | Already generic via `LightboxPhoto` interface |
| `PropertyPhotoGalleryComponent` | ⚠️ Property-specific | Create simplified `WorkOrderPhotoGalleryComponent` |
| `PropertyPhotoUploadComponent` | ⚠️ Property-specific | Refactor to generic `PhotoUploadComponent` |
| `PropertyPhotoStore` | ⚠️ Property-specific | Create `WorkOrderPhotoStore` (simpler) |

**Key Simplifications vs Property Photos:**
- **NO** primary photo concept (work orders don't need a "cover" photo)
- **NO** display order/reordering (photos shown in upload order, newest first)
- **Simpler store** - just load, upload, delete operations

## Acceptance Criteria

### AC #1: Photos Section on Work Order Detail

**Given** I am on a work order detail page (`/work-orders/:id`)
**When** the page loads
**Then** I see a "Photos" section with:
- Grid of existing photos (if any)
- "Add Photo" button
- Photo count indicator

**Given** the work order has no photos
**When** I view the Photos section
**Then** I see empty state: "No photos yet"
**And** I see an "Add Photo" button

### AC #2: Photo Upload Trigger

**Given** I am on a work order detail page
**When** I click "Add Photo" button
**Then** a file picker dialog opens (same as property photos)
**Or** drag-drop zone is revealed (if inline upload zone design)

### AC #3: Upload Flow (Reuse PhotoUploadService)

**Given** I select one or more image files
**When** upload begins
**Then** I see upload progress indicator for each photo
**And** the existing `PhotoUploadService` handles:
  - Requesting presigned URL from `/api/v1/work-orders/{id}/photos/upload-url`
  - Uploading directly to S3
  - Confirming upload via `/api/v1/work-orders/{id}/photos`

**Given** upload completes successfully
**When** the photo is saved
**Then** I see snackbar "Photo added ✓"
**And** the photo thumbnail appears in the grid
**And** the photo count updates

### AC #4: Upload Validation (Client-side)

**Given** I select a file
**When** the file type is not an image (not jpeg, png, gif, webp, bmp, tiff)
**Then** I see validation error "Invalid file type"
**And** upload does not proceed

**Given** I select a file
**When** the file size exceeds 10MB
**Then** I see validation error "File too large (max 10MB)"
**And** upload does not proceed

### AC #5: Upload Error Handling

**Given** upload fails
**When** an error occurs
**Then** I see error message "Failed to upload [filename]. Try again."
**And** I can retry the upload

### AC #6: Mobile Support

**Given** I'm on mobile
**When** I click "Add Photo"
**Then** I can choose to take a new photo with camera
**Or** select from photo library

### AC #7: Photo Grid Display

**Given** the work order has photos
**When** I view the Photos section
**Then** I see a grid of photo thumbnails
**And** photos are displayed newest first (by upload date)
**And** each thumbnail shows a loading placeholder until image loads
**And** thumbnails fade in when loaded

### AC #8: Click to View (Lightbox)

**Given** I click on a photo thumbnail
**When** the lightbox opens
**Then** I see the full-size photo with:
  - Zoom in/out controls
  - Rotate controls
  - Navigation arrows (if multiple photos)
  - Photo counter "X of Y"
  - Close button (X or Escape key)

### AC #9: Responsive Grid

**Given** I view the photo grid
**When** the viewport changes
**Then** the grid adjusts:
  - 1 column on mobile (<600px)
  - 2 columns on tablet (600-959px)
  - 3 columns on desktop (960px+)

## Tasks / Subtasks

> **TDD Approach:** Frontend tests use Vitest. Write failing tests first for new components.

---

### Phase 1: Refactor Shared Components (Unified Codebase)

#### Task 1: Rename Lightbox Component for Reusability (AC: #8)

- [ ] 1.1 Rename `property-photo-lightbox` folder to `photo-lightbox`:
  ```
  shared/components/photo-lightbox/
  ├── photo-lightbox.component.ts
  └── photo-lightbox.component.spec.ts
  ```
- [ ] 1.2 Update component selector from `app-property-photo-lightbox` to `app-photo-lightbox`
- [ ] 1.3 Update class name from `PropertyPhotoLightboxComponent` to `PhotoLightboxComponent`
- [ ] 1.4 Update all imports in `property-photo-gallery.component.ts` to use new path
- [ ] 1.5 Run existing tests to verify no regressions: `npm test -- photo-lightbox`

**Rationale:** The lightbox is already generic via `LightboxPhoto` interface. Renaming clarifies it's shared.

#### Task 2: Create Generic PhotoUploadComponent (AC: #2, #3, #4, #5, #6)

- [ ] 2.1 Create `shared/components/photo-upload/photo-upload.component.ts`:
  ```typescript
  /**
   * PhotoUploadComponent
   *
   * Generic photo upload component with drag-drop zone.
   * Delegates to PhotoUploadService for actual upload.
   * Emits events - parent component handles store updates.
   *
   * Replaces property-specific PropertyPhotoUploadComponent.
   */
  @Component({
    selector: 'app-photo-upload',
    standalone: true,
    // ... same template/styles as PropertyPhotoUploadComponent
  })
  export class PhotoUploadComponent {
    /** Required: The upload function to call */
    readonly uploadFn = input.required<(file: File) => Promise<boolean>>();

    /** Emitted when upload completes successfully */
    readonly uploadComplete = output<void>();

    // ... same logic, but calls uploadFn() instead of photoStore.uploadPhoto()
  }
  ```
- [ ] 2.2 Create `photo-upload.component.spec.ts` with tests for:
  - Drag-and-drop zone renders
  - File validation (type, size)
  - Upload progress display
  - Error handling with retry
  - Success state
- [ ] 2.3 **Run tests - verify they PASS**

#### Task 3: Update PropertyPhotoUpload to Use Generic Component

- [ ] 3.1 Refactor `PropertyPhotoUploadComponent` to wrap `PhotoUploadComponent`:
  ```typescript
  // property-photo-upload.component.ts
  @Component({
    selector: 'app-property-photo-upload',
    standalone: true,
    imports: [PhotoUploadComponent],
    template: `
      <app-photo-upload
        [uploadFn]="uploadPhoto"
        (uploadComplete)="uploadComplete.emit()"
      />
    `
  })
  export class PropertyPhotoUploadComponent {
    private readonly photoStore = inject(PropertyPhotoStore);
    readonly propertyId = input.required<string>();
    readonly uploadComplete = output<void>();

    uploadPhoto = async (file: File): Promise<boolean> => {
      return this.photoStore.uploadPhoto(file);
    };
  }
  ```
- [ ] 3.2 Run property photo tests to verify no regressions
- [ ] 3.3 Manually test property photo upload in browser

---

### Phase 2: Work Order Photo Store

#### Task 4: Create WorkOrderPhotoStore (AC: #1, #3, #7)

- [ ] 4.1 Create `features/work-orders/stores/work-order-photo.store.ts`:
  ```typescript
  /**
   * WorkOrderPhotoStore
   *
   * State management for work order photos.
   * Simpler than PropertyPhotoStore:
   * - NO isPrimary
   * - NO displayOrder/reordering
   * - Photos sorted by createdAt descending (newest first)
   */
  interface WorkOrderPhotoState {
    workOrderId: string | null;
    photos: WorkOrderPhotoDto[];
    isLoading: boolean;
    error: string | null;
    isUploading: boolean;
    uploadProgress: number;
    uploadError: string | null;
  }

  export const WorkOrderPhotoStore = signalStore(
    { providedIn: 'root' },
    withState(initialState),
    withComputed((store) => ({
      photoCount: computed(() => store.photos().length),
      hasPhotos: computed(() => store.photos().length > 0),
      isEmpty: computed(() => !store.isLoading() && store.photos().length === 0),
      // Photos already sorted by API (newest first)
      sortedPhotos: computed(() => store.photos()),
    })),
    withMethods((store, apiClient = inject(ApiClient), snackBar = inject(MatSnackBar)) => ({
      loadPhotos: rxMethod<string>(...),
      uploadPhoto: async (file: File) => Promise<boolean>,
      deletePhoto: rxMethod<string>(...),
      clear: () => void,
    }))
  );
  ```
- [ ] 4.2 Create `work-order-photo.store.spec.ts` with tests for:
  - `loadPhotos` fetches from API and updates state
  - `uploadPhoto` calls work order photo endpoints
  - `deletePhoto` removes photo and updates state
  - Error handling for each operation
  - Tenant isolation (handled by API, but test error states)
- [ ] 4.3 **Run tests - verify they PASS**

---

### Phase 3: Work Order Photo Gallery Component

#### Task 5: Create WorkOrderPhotoGalleryComponent (AC: #1, #7, #8, #9)

- [ ] 5.1 Create `features/work-orders/components/work-order-photo-gallery/`:
  ```typescript
  /**
   * WorkOrderPhotoGalleryComponent
   *
   * Displays work order photos in a responsive grid.
   * Simpler than PropertyPhotoGalleryComponent:
   * - NO drag-drop reordering
   * - NO primary photo indicator/button
   * - Just display, click to view, delete
   */
  @Component({
    selector: 'app-work-order-photo-gallery',
    standalone: true,
    imports: [
      CommonModule,
      MatCardModule,
      MatIconModule,
      MatButtonModule,
      MatProgressSpinnerModule,
    ],
    template: `
      <mat-card class="gallery-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>photo_library</mat-icon>
            Photos
            @if (photos().length > 0) {
              <span class="photo-count">({{ photos().length }})</span>
            }
          </mat-card-title>
          @if (!isLoading() && photos().length > 0) {
            <button mat-stroked-button color="primary" (click)="addPhotoClick.emit()">
              <mat-icon>add_a_photo</mat-icon>
              Add Photo
            </button>
          }
        </mat-card-header>
        <mat-card-content>
          <!-- Loading State -->
          @if (isLoading()) {
            <div class="gallery-grid">
              @for (i of skeletonItems; track i) {
                <div class="photo-skeleton"><div class="skeleton-shimmer"></div></div>
              }
            </div>
          }

          <!-- Empty State -->
          @if (!isLoading() && photos().length === 0) {
            <div class="empty-state">
              <mat-icon>add_photo_alternate</mat-icon>
              <h3>No photos yet</h3>
              <p>Add photos to document this work order</p>
              <button mat-raised-button color="primary" (click)="addPhotoClick.emit()">
                <mat-icon>add_a_photo</mat-icon>
                Add First Photo
              </button>
            </div>
          }

          <!-- Photo Grid (NO drag-drop, simpler than property gallery) -->
          @if (!isLoading() && photos().length > 0) {
            <div class="gallery-grid">
              @for (photo of photos(); track photo.id) {
                <div class="photo-card" tabindex="0" role="button">
                  <img
                    [src]="photo.thumbnailUrl || photo.viewUrl"
                    [alt]="photo.originalFileName || 'Work order photo'"
                    class="photo-img"
                    loading="lazy"
                    (load)="onImageLoad($event)"
                    (click)="photoClick.emit(photo)"
                    (keydown.enter)="photoClick.emit(photo)"
                  />
                  <!-- Delete Button (on hover) -->
                  <div class="photo-overlay">
                    <button
                      mat-icon-button
                      class="delete-btn"
                      (click)="onDelete(photo, $event)"
                      aria-label="Delete photo">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>
    `,
    styles: [...] // Same responsive grid styles as PropertyPhotoGalleryComponent
  })
  export class WorkOrderPhotoGalleryComponent {
    readonly photos = input<WorkOrderPhotoDto[]>([]);
    readonly isLoading = input<boolean>(false);
    readonly addPhotoClick = output<void>();
    readonly photoClick = output<WorkOrderPhotoDto>();
    readonly deleteClick = output<WorkOrderPhotoDto>();
    // ...
  }
  ```
- [ ] 5.2 Create `work-order-photo-gallery.component.spec.ts` with tests for:
  - Empty state renders with CTA
  - Loading skeleton renders
  - Photo grid displays thumbnails
  - Click emits `photoClick`
  - Delete button emits `deleteClick`
  - Responsive breakpoints
- [ ] 5.3 **Run tests - verify they PASS**

**Key differences from PropertyPhotoGalleryComponent:**
- NO `cdkDropList` / drag-drop imports
- NO `setPrimaryClick` output
- NO `reorderClick` output
- NO favorite button on photos
- Simpler overlay (just delete button)

---

### Phase 4: Integrate into Work Order Detail

#### Task 6: Update WorkOrderDetailComponent (AC: #1-#9)

- [ ] 6.1 Import new components:
  ```typescript
  import { WorkOrderPhotoGalleryComponent } from '../../components/work-order-photo-gallery/...';
  import { PhotoUploadComponent } from '../../../../shared/components/photo-upload/...';
  import { PhotoLightboxComponent, LightboxPhoto } from '../../../../shared/components/photo-lightbox/...';
  import { WorkOrderPhotoStore } from '../../stores/work-order-photo.store';
  ```
- [ ] 6.2 Inject `WorkOrderPhotoStore` and `MatDialog`
- [ ] 6.3 Replace placeholder Photos section:
  ```html
  <!-- Photos Section (Story 10-5) -->
  <mat-card class="section-card">
    <mat-card-content>
      <app-work-order-photo-gallery
        [photos]="photoStore.sortedPhotos()"
        [isLoading]="photoStore.isLoading()"
        (addPhotoClick)="onAddPhoto()"
        (photoClick)="onPhotoClick($event)"
        (deleteClick)="onDeletePhoto($event)"
      />
    </mat-card-content>
  </mat-card>

  <!-- Upload Zone (shown when adding) -->
  @if (showUploadZone()) {
    <div class="upload-zone-container">
      <app-photo-upload
        [uploadFn]="uploadPhoto"
        (uploadComplete)="onUploadComplete()"
      />
    </div>
  }
  ```
- [ ] 6.4 Implement component methods:
  ```typescript
  protected readonly photoStore = inject(WorkOrderPhotoStore);
  private readonly dialog = inject(MatDialog);
  protected showUploadZone = signal(false);

  ngOnInit(): void {
    // ... existing code ...
    if (this.workOrderId) {
      this.photoStore.loadPhotos(this.workOrderId);
    }
  }

  ngOnDestroy(): void {
    // ... existing code ...
    this.photoStore.clear();
  }

  onAddPhoto(): void {
    this.showUploadZone.set(true);
  }

  uploadPhoto = async (file: File): Promise<boolean> => {
    return this.photoStore.uploadPhoto(file);
  };

  onUploadComplete(): void {
    this.showUploadZone.set(false);
  }

  onPhotoClick(photo: WorkOrderPhotoDto): void {
    const photos = this.photoStore.sortedPhotos();
    const currentIndex = photos.findIndex(p => p.id === photo.id);
    this.dialog.open(PhotoLightboxComponent, {
      data: { photos, currentIndex },
      panelClass: 'photo-lightbox-dialog',
      maxWidth: '100vw',
      maxHeight: '100vh',
    });
  }

  async onDeletePhoto(photo: WorkOrderPhotoDto): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this photo?',
        message: 'This action cannot be undone.',
        confirmText: 'Delete',
        icon: 'warning',
        iconColor: 'warn',
      } as ConfirmDialogData,
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed) {
      this.photoStore.deletePhoto(photo.id);
    }
  }
  ```
- [ ] 6.5 Add CSS for upload zone container
- [ ] 6.6 Update component tests

#### Task 7: Generate API Client Types

- [ ] 7.1 Run `npm run generate-api` to generate TypeScript types for new work order photo endpoints
- [ ] 7.2 Verify `WorkOrderPhotoDto` type is generated
- [ ] 7.3 Verify `workOrderPhotos_*` methods are available in `ApiClient`

---

### Phase 5: Testing & Verification

#### Task 8: Component Tests

- [ ] 8.1 Run all new component tests: `npm test`
- [ ] 8.2 Verify no regressions in property photo tests
- [ ] 8.3 Test coverage for:
  - WorkOrderPhotoStore: load, upload, delete, error states
  - WorkOrderPhotoGalleryComponent: empty, loading, display, interactions
  - PhotoUploadComponent: validation, progress, retry

#### Task 9: Integration Testing (Manual)

- [ ] 9.1 Navigate to work order detail page
- [ ] 9.2 Verify "Photos" section displays with empty state
- [ ] 9.3 Click "Add Photo" - verify upload zone appears
- [ ] 9.4 Select valid image - verify upload progress and success
- [ ] 9.5 Verify photo appears in grid
- [ ] 9.6 Click photo - verify lightbox opens with controls
- [ ] 9.7 Test keyboard navigation in lightbox (arrows, Escape)
- [ ] 9.8 Delete photo - verify confirmation and removal
- [ ] 9.9 Test on mobile viewport:
  - Single column grid
  - Camera option in file picker
  - Touch-friendly lightbox navigation

#### Task 10: Cross-Feature Verification

- [ ] 10.1 Test property photo upload still works (no regressions)
- [ ] 10.2 Verify shared components work for both features
- [ ] 10.3 Compare UI consistency between property and work order photos

---

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
```
frontend/src/app/
├── shared/
│   ├── components/
│   │   ├── photo-lightbox/              ← RENAMED from property-photo-lightbox
│   │   │   ├── photo-lightbox.component.ts
│   │   │   └── photo-lightbox.component.spec.ts
│   │   ├── photo-upload/                ← NEW (extracted from property)
│   │   │   ├── photo-upload.component.ts
│   │   │   └── photo-upload.component.spec.ts
│   │   └── photo-viewer/                ← EXISTING (unchanged)
│   └── services/
│       └── photo-upload.service.ts      ← EXISTING (unchanged)
│
└── features/
    ├── properties/
    │   └── components/
    │       └── property-photo-upload/   ← REFACTORED (wraps generic)
    └── work-orders/
        ├── stores/
        │   └── work-order-photo.store.ts   ← NEW
        ├── components/
        │   └── work-order-photo-gallery/   ← NEW
        │       ├── work-order-photo-gallery.component.ts
        │       └── work-order-photo-gallery.component.spec.ts
        └── pages/
            └── work-order-detail/          ← MODIFIED
```

### Reuse Summary

**Shared (reused by both Property and WorkOrder):**
- `PhotoUploadService` - S3 presigned URL upload flow
- `PhotoViewerComponent` - zoom/rotate/pan controls
- `PhotoLightboxComponent` - fullscreen viewer modal
- `PhotoUploadComponent` - drag-drop upload zone (NEW, extracted)

**Feature-Specific:**
- `PropertyPhotoStore` / `WorkOrderPhotoStore` - different operations (primary, reorder vs simple)
- `PropertyPhotoGalleryComponent` / `WorkOrderPhotoGalleryComponent` - different features

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/work-orders/{id}/photos/upload-url` | POST | Get presigned S3 upload URL |
| `/api/v1/work-orders/{id}/photos` | POST | Confirm upload, create record |
| `/api/v1/work-orders/{id}/photos` | GET | List photos with presigned view URLs |
| `/api/v1/work-orders/{id}/photos/{photoId}` | DELETE | Delete photo (S3 + DB) |

### Key Differences from PropertyPhotoGalleryComponent

| Feature | Property Photos | Work Order Photos |
|---------|-----------------|-------------------|
| Primary photo | ✅ Yes (favorite button) | ❌ No |
| Drag-drop reorder | ✅ Yes (cdkDropList) | ❌ No |
| Display order | Configurable | CreatedAt desc (newest first) |
| Move up/down buttons | ✅ Yes (mobile) | ❌ No |

### Testing Approach

- Vitest for component unit tests
- Mock `ApiClient` calls in store tests
- Test responsive breakpoints with viewport utilities
- Test keyboard navigation in lightbox

### Previous Story Intelligence (10-4)

From the 10-4 implementation:
- Backend API follows same patterns as PropertyPhotos
- `WorkOrderPhotoDto` matches `PropertyPhotoDto` structure (minus isPrimary, displayOrder)
- Photos sorted by `CreatedAt` descending by API
- 32 backend unit tests passing

### References

- [Source: epics-work-orders-vendors.md#Story 3.5] - Upload Photos to Work Order (lines 1200-1240)
- [Source: property-photo.store.ts] - Store pattern to follow
- [Source: property-photo-gallery.component.ts] - Gallery pattern to follow (simplified)
- [Source: property-photo-upload.component.ts] - Upload pattern to extract
- [Source: property-photo-lightbox.component.ts] - Lightbox to rename
- [Source: 10-4-work-order-photos-entity.md] - Backend implementation reference

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR43 | Users can attach photos to a work order | Frontend upload UI and gallery |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**New Files:**
- `frontend/src/app/shared/components/photo-upload/photo-upload.component.ts`
- `frontend/src/app/shared/components/photo-upload/photo-upload.component.spec.ts`
- `frontend/src/app/features/work-orders/stores/work-order-photo.store.ts`
- `frontend/src/app/features/work-orders/stores/work-order-photo.store.spec.ts`
- `frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.ts`
- `frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.spec.ts`

**Renamed Files:**
- `frontend/src/app/shared/components/property-photo-lightbox/` → `photo-lightbox/`

**Modified Files:**
- `frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.ts` (refactor to use generic)
- `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts` (update lightbox import)
- `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` (add photo section)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Story created with unified codebase focus | SM Agent (Bob) |
