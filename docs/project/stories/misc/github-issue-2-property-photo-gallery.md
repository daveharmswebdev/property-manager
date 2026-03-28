# GitHub Issue #2: Implement Property Photo Gallery

## Summary

Add photo gallery support to properties, enabling users to visually identify their properties in list views and explore multiple photos in detail views. This feature uses the generic photo service created in Issue #1.

## Problem Statement

Currently, property cards in the list view display a static home icon (`mat-icon`). Users managing multiple properties cannot visually distinguish between them at a glance. Real estate applications like Zillow have established that visual property identification is essential for user experience.

**Current State:**
- Property list shows generic home icon for all properties
- Property detail page has no visual representation
- No ability to upload or manage property photos

**Desired State:**
- Property list cards show property thumbnail (or fallback icon if no photo)
- Property detail page displays photo gallery
- Users can upload, delete, reorder, and set primary photo

## Value Proposition

- **Visual Identification**: Users can quickly identify properties when scrolling through a list
- **Richer Property Records**: Properties feel more complete with visual documentation
- **Consistency with Industry**: Matches UX patterns users expect from real estate apps

## Scope

### In Scope
- `PropertyPhoto` entity with gallery support (multiple photos per property)
- Primary photo designation for list view thumbnails
- Photo upload in property create/edit forms
- Photo gallery display on property detail page
- Photo management (delete, reorder, set as primary)
- API endpoints for property photos
- Frontend components for gallery and upload

### Out of Scope
- Vendor logo support (future issue)
- User avatar support (future issue)
- Image editing (crop, filters) - future enhancement
- Drag-and-drop reordering - future enhancement (button-based reorder for MVP)

## Dependencies

- **Requires**: Issue #1 (Generic Photo Service with Thumbnail Generation) must be completed first

## Technical Design

### Backend Changes

#### 1. PropertyPhoto Entity

**File:** `PropertyManager.Domain/Entities/PropertyPhoto.cs`

```csharp
public class PropertyPhoto : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }

    // Photo storage
    public string StorageKey { get; set; } = string.Empty;
    public string ThumbnailStorageKey { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }

    // Gallery management
    public int DisplayOrder { get; set; }
    public bool IsPrimary { get; set; }
    public string? Caption { get; set; }

    // Soft delete
    public DateTime? DeletedAt { get; set; }

    // Navigation
    public Property Property { get; set; } = null!;
    public Account Account { get; set; } = null!;
}
```

#### 2. Property Entity Update

**File:** `PropertyManager.Domain/Entities/Property.cs`

Add navigation property:
```csharp
public ICollection<PropertyPhoto> Photos { get; set; } = new List<PropertyPhoto>();
```

Add computed helper (optional, for convenience):
```csharp
public PropertyPhoto? PrimaryPhoto => Photos?.FirstOrDefault(p => p.IsPrimary && p.DeletedAt == null);
```

#### 3. Database Migration

- Create `PropertyPhotos` table
- Add foreign key to `Properties`
- Add indexes: `IX_PropertyPhotos_PropertyId`, `IX_PropertyPhotos_AccountId_DeletedAt`
- Add unique constraint: Only one `IsPrimary = true` per `PropertyId`

#### 4. Commands and Queries

**UploadPropertyPhoto Command:**
```csharp
public record UploadPropertyPhotoCommand(
    Guid PropertyId,
    string ContentType,
    long FileSizeBytes,
    string? OriginalFileName
) : IRequest<UploadPropertyPhotoResponse>;

public record UploadPropertyPhotoResponse(
    string UploadUrl,
    string StorageKey,
    DateTime ExpiresAt
);
```

**ConfirmPropertyPhotoUpload Command:**
```csharp
public record ConfirmPropertyPhotoUploadCommand(
    Guid PropertyId,
    string StorageKey,
    string ThumbnailStorageKey,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    string? Caption
) : IRequest<Guid>;  // Returns PhotoId
```

**DeletePropertyPhoto Command:**
```csharp
public record DeletePropertyPhotoCommand(Guid PhotoId) : IRequest;
```

**SetPrimaryPropertyPhoto Command:**
```csharp
public record SetPrimaryPropertyPhotoCommand(Guid PhotoId) : IRequest;
```

**ReorderPropertyPhotos Command:**
```csharp
public record ReorderPropertyPhotosCommand(
    Guid PropertyId,
    List<Guid> PhotoIdsInOrder
) : IRequest;
```

**GetPropertyPhotos Query:**
```csharp
public record GetPropertyPhotosQuery(Guid PropertyId) : IRequest<List<PropertyPhotoDto>>;
```

#### 5. DTOs

**PropertyPhotoDto:**
```csharp
public record PropertyPhotoDto(
    Guid Id,
    string ViewUrl,           // Presigned URL for full image
    string ThumbnailUrl,      // Presigned URL for thumbnail
    string? Caption,
    int DisplayOrder,
    bool IsPrimary,
    DateTime CreatedAt
);
```

**Update PropertySummaryDto:**
```csharp
public record PropertySummaryDto(
    Guid Id,
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode,
    decimal ExpenseTotal,
    decimal IncomeTotal,
    string? PrimaryPhotoThumbnailUrl  // NEW: For list view cards
);
```

**Update PropertyDetailDto:**
```csharp
public record PropertyDetailDto(
    // ... existing fields ...
    List<PropertyPhotoDto> Photos  // NEW: Full gallery
);
```

#### 6. API Endpoints

**New endpoints in PropertiesController:**

```
POST   /api/v1/properties/{propertyId}/photos/upload-url
       → UploadPropertyPhotoCommand → UploadPropertyPhotoResponse

POST   /api/v1/properties/{propertyId}/photos
       → ConfirmPropertyPhotoUploadCommand → PhotoId

GET    /api/v1/properties/{propertyId}/photos
       → GetPropertyPhotosQuery → List<PropertyPhotoDto>

DELETE /api/v1/properties/{propertyId}/photos/{photoId}
       → DeletePropertyPhotoCommand

PUT    /api/v1/properties/{propertyId}/photos/{photoId}/primary
       → SetPrimaryPropertyPhotoCommand

PUT    /api/v1/properties/{propertyId}/photos/reorder
       → ReorderPropertyPhotosCommand
```

### Frontend Changes

#### 1. Property Service Updates

**File:** `frontend/src/app/features/properties/services/property.service.ts`

Add photo-related methods and update DTOs:

```typescript
export interface PropertyPhotoDto {
  id: string;
  viewUrl: string;
  thumbnailUrl: string;
  caption?: string;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface PropertySummaryDto {
  // ... existing fields ...
  primaryPhotoThumbnailUrl?: string;
}

export interface PropertyDetailDto {
  // ... existing fields ...
  photos: PropertyPhotoDto[];
}

// New methods
requestPhotoUploadUrl(propertyId: string, file: File): Observable<UploadUrlResponse>;
confirmPhotoUpload(propertyId: string, request: ConfirmPhotoRequest): Observable<string>;
deletePhoto(propertyId: string, photoId: string): Observable<void>;
setPhotoAsPrimary(propertyId: string, photoId: string): Observable<void>;
reorderPhotos(propertyId: string, photoIds: string[]): Observable<void>;
```

#### 2. Property Row Component Update

**File:** `frontend/src/app/shared/components/property-row/property-row.component.ts`

Replace static home icon with photo thumbnail:

```html
<div class="property-thumbnail">
  @if (property.primaryPhotoThumbnailUrl) {
    <img
      [src]="property.primaryPhotoThumbnailUrl"
      [alt]="property.name"
      loading="lazy"
      class="thumbnail-image"
      (error)="onThumbnailError($event)"
    />
  } @else {
    <mat-icon class="placeholder-icon">home</mat-icon>
  }
</div>
```

#### 3. Property Photo Gallery Component (New)

**File:** `frontend/src/app/features/properties/components/property-photo-gallery/`

Features:
- Grid/list view of all property photos
- Click to open full-size in PhotoViewerComponent (from Issue #1)
- Primary photo indicator (star badge)
- Lightbox modal for full-screen viewing
- Navigation between photos (prev/next)

```typescript
@Component({
  selector: 'app-property-photo-gallery',
  // ...
})
export class PropertyPhotoGalleryComponent {
  @Input() photos: PropertyPhotoDto[] = [];
  @Input() propertyName: string = '';

  selectedPhoto = signal<PropertyPhotoDto | null>(null);
  isLightboxOpen = signal(false);

  openLightbox(photo: PropertyPhotoDto): void;
  closeLightbox(): void;
  nextPhoto(): void;
  previousPhoto(): void;
}
```

#### 4. Property Photo Upload Component (New)

**File:** `frontend/src/app/features/properties/components/property-photo-upload/`

Features:
- File input with camera capture support
- Multiple file selection
- Upload progress indicator
- Preview before upload
- Caption input (optional)
- Integration with PhotoUploadService from Issue #1

```typescript
@Component({
  selector: 'app-property-photo-upload',
  // ...
})
export class PropertyPhotoUploadComponent {
  @Input() propertyId!: string;
  @Output() photoUploaded = new EventEmitter<PropertyPhotoDto>();

  selectedFiles = signal<File[]>([]);
  uploadProgress = signal<number>(0);
  isUploading = signal(false);

  onFilesSelected(event: Event): void;
  uploadPhotos(): void;
  removeSelectedFile(index: number): void;
}
```

#### 5. Property Photo Management Component (New)

**File:** `frontend/src/app/features/properties/components/property-photo-management/`

Features:
- List of existing photos with actions
- Delete button with confirmation
- "Set as Primary" button
- Move up/down buttons for reordering
- Used in property edit form

```typescript
@Component({
  selector: 'app-property-photo-management',
  // ...
})
export class PropertyPhotoManagementComponent {
  @Input() propertyId!: string;
  @Input() photos: PropertyPhotoDto[] = [];
  @Output() photosChanged = new EventEmitter<void>();

  deletePhoto(photo: PropertyPhotoDto): void;
  setAsPrimary(photo: PropertyPhotoDto): void;
  moveUp(photo: PropertyPhotoDto): void;
  moveDown(photo: PropertyPhotoDto): void;
}
```

#### 6. Property Detail Page Update

**File:** `frontend/src/app/features/properties/property-detail/property-detail.component.html`

Add gallery section:

```html
<!-- Property Photo Gallery -->
<section class="property-photos-section">
  <h3>Photos</h3>
  @if (property.photos.length > 0) {
    <app-property-photo-gallery
      [photos]="property.photos"
      [propertyName]="property.name"
    />
  } @else {
    <div class="no-photos-placeholder">
      <mat-icon>photo_camera</mat-icon>
      <p>No photos yet</p>
      <button mat-stroked-button routerLink="edit">Add Photos</button>
    </div>
  }
</section>
```

#### 7. Property Form Updates

**Files:**
- `property-form.component.ts` (create)
- `property-edit.component.ts` (edit)

Add photo upload section to forms:

```html
<!-- Photo Upload Section -->
<mat-card class="photo-section">
  <mat-card-header>
    <mat-card-title>Property Photos</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    @if (isEditMode && existingPhotos().length > 0) {
      <app-property-photo-management
        [propertyId]="propertyId"
        [photos]="existingPhotos()"
        (photosChanged)="refreshPhotos()"
      />
    }

    <app-property-photo-upload
      [propertyId]="propertyId"
      (photoUploaded)="onPhotoUploaded($event)"
    />
  </mat-card-content>
</mat-card>
```

### Database Changes

#### Migration: AddPropertyPhotos

```csharp
public partial class AddPropertyPhotos : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PropertyPhotos",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                AccountId = table.Column<Guid>(nullable: false),
                PropertyId = table.Column<Guid>(nullable: false),
                StorageKey = table.Column<string>(maxLength: 500, nullable: false),
                ThumbnailStorageKey = table.Column<string>(maxLength: 500, nullable: false),
                OriginalFileName = table.Column<string>(maxLength: 255, nullable: false),
                ContentType = table.Column<string>(maxLength: 100, nullable: false),
                FileSizeBytes = table.Column<long>(nullable: false),
                DisplayOrder = table.Column<int>(nullable: false, defaultValue: 0),
                IsPrimary = table.Column<bool>(nullable: false, defaultValue: false),
                Caption = table.Column<string>(maxLength: 500, nullable: true),
                CreatedAt = table.Column<DateTime>(nullable: false),
                UpdatedAt = table.Column<DateTime>(nullable: false),
                DeletedAt = table.Column<DateTime>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PropertyPhotos", x => x.Id);
                table.ForeignKey(
                    name: "FK_PropertyPhotos_Properties_PropertyId",
                    column: x => x.PropertyId,
                    principalTable: "Properties",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_PropertyPhotos_Accounts_AccountId",
                    column: x => x.AccountId,
                    principalTable: "Accounts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_PropertyPhotos_PropertyId",
            table: "PropertyPhotos",
            column: "PropertyId");

        migrationBuilder.CreateIndex(
            name: "IX_PropertyPhotos_AccountId_DeletedAt",
            table: "PropertyPhotos",
            columns: new[] { "AccountId", "DeletedAt" });
    }
}
```

## Acceptance Criteria

### Backend
- [ ] `PropertyPhoto` entity created with all fields
- [ ] Database migration created and tested
- [ ] Upload URL generation endpoint working
- [ ] Photo upload confirmation endpoint working (triggers thumbnail generation)
- [ ] Get property photos endpoint returns list with presigned URLs
- [ ] Delete photo endpoint soft-deletes and removes from S3
- [ ] Set primary photo endpoint updates `IsPrimary` flag (only one per property)
- [ ] Reorder photos endpoint updates `DisplayOrder` values
- [ ] `PropertySummaryDto` includes `primaryPhotoThumbnailUrl`
- [ ] `PropertyDetailDto` includes `photos` array
- [ ] All endpoints enforce tenant isolation (AccountId)
- [ ] Unit tests for all command handlers
- [ ] Integration tests for photo upload flow

### Frontend
- [ ] Property list cards show thumbnail or fallback icon
- [ ] Property detail page displays photo gallery
- [ ] Lightbox opens full-size photo with navigation
- [ ] Photo upload component in property forms
- [ ] Multiple file upload supported
- [ ] Upload progress indicator shown
- [ ] Photo management (delete, set primary, reorder) working
- [ ] Error handling for upload failures
- [ ] Loading states for all async operations
- [ ] Responsive design (mobile and desktop)

### UX
- [ ] First uploaded photo automatically set as primary
- [ ] Deleting primary photo promotes next photo (by display order)
- [ ] Clear visual indicator for primary photo
- [ ] Confirmation dialog before deleting photos
- [ ] Smooth transitions in gallery lightbox

## UI/UX Specifications

### Property List Card (Updated)

```
┌─────────────────────────────────────────────────────┐
│ ┌──────┐                                            │
│ │ IMG  │  914 Curdwood Blvd          YTD EXPENSES  │
│ │ 64x64│  Nashville, TN                  $1,342.97 │
│ └──────┘                                    NET    │
│                                         ($1,342.97)│
└─────────────────────────────────────────────────────┘

- Thumbnail: 64x64px, rounded corners (4px)
- Fallback: Home icon if no photo
- Lazy loading for thumbnails
```

### Property Detail Gallery

```
┌─────────────────────────────────────────────────────┐
│ Photos                                              │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │  ★ IMG  │ │   IMG   │ │   IMG   │ │   IMG   │    │
│ │  150px  │ │  150px  │ │  150px  │ │  150px  │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                     │
│ ★ = Primary photo indicator                         │
└─────────────────────────────────────────────────────┘

- Grid: 4 columns desktop, 2 columns mobile
- Thumbnail size: 150x150px
- Click opens lightbox with full image
- Star badge on primary photo
```

### Photo Lightbox

```
┌─────────────────────────────────────────────────────┐
│                                              [X]    │
│                                                     │
│    [<]          FULL SIZE IMAGE            [>]     │
│                                                     │
│                                                     │
│              ● ○ ○ ○  (dot indicators)              │
│                                                     │
│    Zoom: [-] 100% [+]   [↺] [↻]   [Reset]          │
└─────────────────────────────────────────────────────┘

- Full viewport modal
- Prev/Next navigation
- Dot indicators for position
- Zoom/rotate controls (reuse PhotoViewerComponent)
- Keyboard navigation (← → Esc)
- Swipe gestures on mobile
```

### Photo Management (Edit Form)

```
┌─────────────────────────────────────────────────────┐
│ Property Photos                                     │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ ┌────┐ exterior-front.jpg    ★ Primary   [🗑️]  │ │
│ │ │IMG │ Uploaded Jan 15, 2026      [↑] [↓]      │ │
│ │ └────┘                                          │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ┌────┐ living-room.jpg       [Set Primary][🗑️] │ │
│ │ │IMG │ Uploaded Jan 15, 2026      [↑] [↓]      │ │
│ │ └────┘                                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │        [+] Add Photos                           │ │
│ │  Drag and drop or click to select               │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Files to Create/Modify

### Backend - Create
- `src/PropertyManager.Domain/Entities/PropertyPhoto.cs`
- `src/PropertyManager.Infrastructure/Persistence/Configurations/PropertyPhotoConfiguration.cs`
- `src/PropertyManager.Infrastructure/Persistence/Migrations/YYYYMMDD_AddPropertyPhotos.cs`
- `src/PropertyManager.Application/Properties/Photos/UploadPropertyPhoto.cs`
- `src/PropertyManager.Application/Properties/Photos/ConfirmPropertyPhotoUpload.cs`
- `src/PropertyManager.Application/Properties/Photos/DeletePropertyPhoto.cs`
- `src/PropertyManager.Application/Properties/Photos/SetPrimaryPropertyPhoto.cs`
- `src/PropertyManager.Application/Properties/Photos/ReorderPropertyPhotos.cs`
- `src/PropertyManager.Application/Properties/Photos/GetPropertyPhotos.cs`
- `src/PropertyManager.Application/Properties/Photos/PropertyPhotoDto.cs`
- `tests/PropertyManager.Application.Tests/Properties/Photos/*.cs`

### Backend - Modify
- `src/PropertyManager.Domain/Entities/Property.cs` (add Photos collection)
- `src/PropertyManager.Application/Properties/PropertySummaryDto.cs` (add thumbnail URL)
- `src/PropertyManager.Application/Properties/PropertyDetailDto.cs` (add photos)
- `src/PropertyManager.Application/Properties/GetAllProperties.cs` (include primary photo)
- `src/PropertyManager.Application/Properties/GetPropertyById.cs` (include photos)
- `src/PropertyManager.Api/Controllers/PropertiesController.cs` (add photo endpoints)
- `src/PropertyManager.Infrastructure/Persistence/PropertyManagerDbContext.cs` (add DbSet)

### Frontend - Create
- `src/app/features/properties/components/property-photo-gallery/`
- `src/app/features/properties/components/property-photo-upload/`
- `src/app/features/properties/components/property-photo-management/`
- `src/app/features/properties/components/property-photo-lightbox/`

### Frontend - Modify
- `src/app/shared/components/property-row/property-row.component.ts` (add thumbnail)
- `src/app/features/properties/services/property.service.ts` (add photo methods)
- `src/app/features/properties/property-detail/property-detail.component.ts` (add gallery)
- `src/app/features/properties/property-form/property-form.component.ts` (add upload)
- `src/app/features/properties/property-edit/property-edit.component.ts` (add management)

## Testing Strategy

### Unit Tests
- Command handler tests for all photo operations
- Validation tests (file type, size, property ownership)
- Primary photo logic (auto-promote on delete)
- Reorder logic (display order updates)

### Integration Tests
- Full upload flow (URL → S3 → confirm → thumbnail)
- Photo retrieval with presigned URLs
- Tenant isolation (can't access other account's photos)
- Cascade delete (property deletion removes photos)

### Frontend Tests
- Component rendering tests
- Upload flow tests
- Gallery navigation tests
- Photo management action tests

### Manual Testing Checklist

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| P1 | Upload single photo to property | Photo appears in gallery, set as primary |
| P2 | Upload multiple photos | All photos appear, first is primary |
| P3 | View property in list | Thumbnail shows (not full image) |
| P4 | Click photo in gallery | Lightbox opens with full image |
| P5 | Navigate lightbox (prev/next) | Photos cycle correctly |
| P6 | Set different photo as primary | Star indicator moves, list thumbnail updates |
| P7 | Delete non-primary photo | Photo removed, others unchanged |
| P8 | Delete primary photo | Next photo becomes primary |
| P9 | Reorder photos | Display order persists after refresh |
| P10 | Upload on mobile | Camera capture works |
| P11 | Property with no photos | Fallback icon in list, "Add Photos" prompt in detail |

## Related Issues

- **Depends on**: Issue #1 (Generic Photo Service with Thumbnail Generation)
- **Future**: Vendor Logo Support (will use same PhotoService)
- **Future**: User Avatar Support (will use same PhotoService)



---

## ADDITION: Mobile Property Photo Capture FAB

### Overview

Create a `PropertyPhotoCaptureFabComponent` that appears on mobile devices when viewing property detail pages, enabling on-site photo capture. This follows the same UX pattern as the existing `MobileCaptureFabComponent` for receipts.

### User Flow

**On-site property photo capture:**
1. User visits property in person with phone
2. Opens app, navigates to property detail page
3. Taps camera FAB (floating action button)
4. Phone camera opens (rear camera preferred)
5. User takes photo
6. Photo uploads directly to property gallery
7. User continues taking more photos
8. Gallery builds in real-time as they walk around property

### Component Specification

**File:** `frontend/src/app/features/properties/components/property-photo-capture-fab/property-photo-capture-fab.component.ts`

```typescript
@Component({
  selector: 'app-property-photo-capture-fab',
  standalone: true,
  // ...
})
export class PropertyPhotoCaptureFabComponent {
  // Inputs
  @Input({ required: true }) propertyId!: string;

  // Outputs
  @Output() photoCaptured = new EventEmitter<PropertyPhotoDto>();

  // State
  isUploading = signal(false);
  isMobile = signal(false);

  // Visibility: Only show on mobile + property detail route
  private breakpointObserver = inject(BreakpointObserver);

  constructor() {
    // Check if mobile viewport (< 768px)
    this.breakpointObserver
      .observe(['(max-width: 767px)'])
      .subscribe(result => this.isMobile.set(result.matches));
  }

  async onFileSelected(event: Event): Promise<void>;
}
```

### UI Specification

```
Mobile Property Detail Page:
┌─────────────────────────────────────────┐
│ < Property Detail                    ⋮  │
├─────────────────────────────────────────┤
│                                         │
│  914 Curdwood Blvd                      │
│  Nashville, TN 37204                    │
│                                         │
│  [Photo Gallery Grid]                   │
│                                         │
│  Stats...                               │
│                                         │
│                                         │
│                               ┌───────┐ │
│                               │  📷   │ │  ← Camera FAB
│                               │       │ │     (bottom-right)
│                               └───────┘ │
├─────────────────────────────────────────┤
│ 🏠 Dashboard  📋 Properties  ...        │  ← Bottom nav
└─────────────────────────────────────────┘

FAB States:
- Default: Camera icon (photo_camera)
- Uploading: Spinner/hourglass icon
- Success: Brief checkmark, then back to camera
- Error: Snackbar with retry option
```

### Features

1. **Mobile-Only Visibility**
   - Only visible on viewport < 768px
   - Only visible on property detail route
   - Hidden on desktop (desktop uses drag-drop in edit form)

2. **Camera Integration**
   - File input with `capture="environment"` (rear camera)
   - Falls back to photo gallery if camera denied
   - Accepts JPEG/PNG

3. **Instant Upload**
   - No preview step (quick capture flow)
   - Upload begins immediately on capture
   - Progress indicator on FAB
   - Success/error feedback via snackbar

4. **Gallery Integration**
   - New photos appear in gallery immediately
   - First photo auto-set as primary (if no primary exists)
   - Real-time update without page refresh

### Template

```html
@if (isMobile()) {
  <input
    #fileInput
    type="file"
    accept="image/jpeg,image/png"
    capture="environment"
    class="hidden-input"
    (change)="onFileSelected($event)"
  />

  <button
    mat-fab
    color="primary"
    class="capture-fab"
    [disabled]="isUploading()"
    (click)="fileInput.click()"
    aria-label="Take property photo"
  >
    @if (isUploading()) {
      <mat-spinner diameter="24"></mat-spinner>
    } @else {
      <mat-icon>photo_camera</mat-icon>
    }
  </button>
}
```

### Styling

```scss
.capture-fab {
  position: fixed;
  bottom: 80px;  // Above bottom nav
  right: 16px;
  z-index: 1000;
}

.hidden-input {
  display: none;
}
```

### Integration with Property Detail

**File:** `property-detail.component.html`

```html
<!-- At bottom of template -->
<app-property-photo-capture-fab
  [propertyId]="property.id"
  (photoCaptured)="onPhotoCaptured($event)"
/>
```

**File:** `property-detail.component.ts`

```typescript
onPhotoCaptured(photo: PropertyPhotoDto): void {
  // Add to local gallery display
  this.photos.update(photos => [...photos, photo]);

  // Show success feedback
  this.snackBar.open('Photo added', 'View', { duration: 3000 });
}
```

### Additional Acceptance Criteria for Issue #100

- [ ] `PropertyPhotoCaptureFabComponent` created
- [ ] FAB only visible on mobile viewport (< 768px)
- [ ] FAB only visible on property detail page
- [ ] Camera capture opens rear camera on mobile
- [ ] Photo uploads immediately after capture
- [ ] Upload progress shown on FAB (spinner)
- [ ] Success feedback via snackbar
- [ ] Error handling with retry option
- [ ] New photo appears in gallery without refresh
- [ ] First photo auto-set as primary if no primary exists
- [ ] FAB positioned above bottom navigation
- [ ] Accessible (aria-label, keyboard support)

### Files to Create

- `src/app/features/properties/components/property-photo-capture-fab/property-photo-capture-fab.component.ts`
- `src/app/features/properties/components/property-photo-capture-fab/property-photo-capture-fab.component.html`
- `src/app/features/properties/components/property-photo-capture-fab/property-photo-capture-fab.component.scss`
- `src/app/features/properties/components/property-photo-capture-fab/property-photo-capture-fab.component.spec.ts`

### Manual Test Cases (Additional)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| P12 | Mobile FAB visibility | View property detail on mobile | Camera FAB visible bottom-right |
| P13 | Desktop FAB hidden | View property detail on desktop | Camera FAB not visible |
| P14 | Capture photo on-site | Tap FAB → camera opens → take photo | Photo uploads and appears in gallery |
| P15 | Multiple quick captures | Take 3 photos in rapid succession | All 3 photos appear in gallery |
| P16 | First photo is primary | Capture photo for property with no photos | Photo marked as primary |
| P17 | Upload error recovery | Capture with poor network | Error snackbar with retry option |
