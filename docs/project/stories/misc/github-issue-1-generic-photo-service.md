# GitHub Issue #1: Create Generic Photo Service with Thumbnail Generation

## Summary

Refactor the existing receipt photo infrastructure into a reusable, generic photo service that supports thumbnail generation. This foundational work enables photo capabilities across multiple entity types (Properties now, Vendors and User Avatars in the future) without code duplication.

## Problem Statement

The current receipt photo system is well-architected but tightly coupled to the Receipt entity:
- `ReceiptCaptureService` has receipt-specific method signatures
- `ReceiptImageViewerComponent` is generic but poorly named
- No thumbnail generation exists (10MB images load in list views)
- Storage key pattern doesn't distinguish entity types
- Future photo needs (properties, vendors, avatars) would require duplicating code

## Value Proposition

- **Reusability**: Build once, use for properties, vendors, user avatars
- **Performance**: Thumbnail generation enables fast list view rendering
- **Maintainability**: Single photo service to maintain instead of multiple copies
- **Consistency**: Unified photo handling across the application

## Scope

### In Scope
- Create generic `IPhotoService` interface and implementation
- Add upload-time thumbnail generation (backend)
- Rename/refactor frontend components for generic use
- Update storage key pattern to support entity types
- Maintain backward compatibility with existing receipt functionality

### Out of Scope
- Property photos implementation (Issue #2)
- Vendor logo support (future issue)
- User avatar support (future issue)
- CDN/CloudFront integration (future optimization)
- WebP format support (future optimization)

## Technical Design

### Backend Changes

#### 1. New Photo Service Interface

**File:** `PropertyManager.Application/Common/Interfaces/IPhotoService.cs`

```csharp
public interface IPhotoService
{
    Task<PhotoUploadResult> GenerateUploadUrlAsync(
        PhotoUploadRequest request,
        CancellationToken cancellationToken = default);

    Task<PhotoRecord> ConfirmUploadAsync(
        ConfirmPhotoUploadRequest request,
        CancellationToken cancellationToken = default);

    Task<string> GetPhotoUrlAsync(string storageKey);
    Task<string> GetThumbnailUrlAsync(string storageKey);
    Task DeletePhotoAsync(string storageKey);
}

public record PhotoUploadRequest(
    string EntityType,      // "property", "receipt", "vendor", "user"
    Guid EntityId,
    string ContentType,
    long FileSizeBytes,
    string? OriginalFileName
);

public record PhotoUploadResult(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt
);

public record PhotoRecord(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes
);
```

#### 2. Thumbnail Generation Service

**File:** `PropertyManager.Infrastructure/Storage/ThumbnailService.cs`

- Use **SixLabors.ImageSharp** (MIT license, cross-platform)
- Generate thumbnails at 300x300px (configurable)
- Maintain aspect ratio (fit within bounds)
- Strip EXIF metadata for privacy
- Support JPEG and PNG input
- Output as JPEG for consistent thumbnail format

```csharp
public interface IThumbnailService
{
    Task<byte[]> GenerateThumbnailAsync(
        Stream imageStream,
        int maxWidth = 300,
        int maxHeight = 300);
}
```

#### 3. Updated Storage Key Pattern

**Current:** `{accountId}/{year}/{guid}.{ext}`
**New:** `{accountId}/{entityType}/{year}/{guid}.{ext}`

Examples:
- Receipt: `acc123/receipts/2026/guid.jpg`
- Property: `acc123/properties/2026/guid.jpg`
- Thumbnail: `acc123/properties/2026/guid_thumb.jpg`

#### 4. Photo Upload Flow (Updated)

1. Frontend requests presigned upload URL
2. Backend generates URL for full-size image location
3. Frontend uploads directly to S3
4. Frontend calls confirm endpoint
5. **NEW:** Backend downloads image from S3, generates thumbnail, uploads thumbnail
6. Backend returns both storage keys

### Frontend Changes

#### 1. Rename Components

| Current Name | New Name |
|--------------|----------|
| `ReceiptImageViewerComponent` | `PhotoViewerComponent` |
| `ReceiptCaptureService` | Keep for receipts, create `PhotoUploadService` |

#### 2. New Generic Photo Upload Service

**File:** `frontend/src/app/shared/services/photo-upload.service.ts`

```typescript
export interface PhotoUploadOptions {
  entityType: 'property' | 'receipt' | 'vendor' | 'user';
  entityId?: string;
  onProgress?: (percent: number) => void;
}

export interface PhotoUploadResult {
  storageKey: string;
  thumbnailStorageKey: string;
  viewUrl: string;
  thumbnailUrl: string;
}

@Injectable({ providedIn: 'root' })
export class PhotoUploadService {
  async uploadPhoto(file: File, options: PhotoUploadOptions): Promise<PhotoUploadResult>;
  isValidFileType(contentType: string): boolean;
  isValidFileSize(bytes: number): boolean;
}
```

#### 3. PhotoViewerComponent Updates

- Rename from `ReceiptImageViewerComponent`
- Accept `thumbnailUrl` input for list view usage
- Keep all existing functionality (zoom, pan, rotate, PDF handling)
- Add loading state for thumbnail → full transition

### Database Changes

None required for this issue. Photo metadata storage will be entity-specific (Issue #2 for properties).

## Acceptance Criteria

### Backend
- [ ] `IPhotoService` interface created with upload, confirm, get URL, delete methods
- [ ] `PhotoService` implementation using existing `IStorageService`
- [ ] `IThumbnailService` interface and `ImageSharpThumbnailService` implementation
- [ ] Thumbnails generated at 300x300px max, JPEG output, EXIF stripped
- [ ] Storage key pattern includes entity type
- [ ] Existing receipt functionality continues to work (backward compatible)
- [ ] Unit tests for thumbnail generation service
- [ ] Integration tests for photo upload flow

### Frontend
- [ ] `PhotoViewerComponent` created (renamed from ReceiptImageViewer)
- [ ] `PhotoUploadService` created with generic upload capability
- [ ] Existing receipt components updated to use new service
- [ ] All existing receipt tests pass

### Documentation
- [ ] API documentation updated for new photo endpoints
- [ ] Storage key pattern documented

## Technical Notes

### ImageSharp NuGet Package
```xml
<PackageReference Include="SixLabors.ImageSharp" Version="3.1.12" />
```

### Thumbnail Generation Considerations
- Process in memory (don't save temp files)
- Limit max input size (already 10MB enforced)
- Consider async processing for large images
- Log thumbnail generation failures (don't block upload)

### Backward Compatibility
- `ReceiptCaptureService` continues to work
- Existing receipt storage keys remain valid
- New receipts can optionally use new service

## Receipt Regression Testing Strategy

> **CRITICAL**: Receipt capture and display is a production feature. This refactoring MUST NOT introduce breaking changes. The following regression strategy is mandatory.

### Risk Assessment

| Component | Risk Level | Reason |
|-----------|------------|--------|
| `ReceiptCaptureService` | **HIGH** | Core upload logic being abstracted |
| `ReceiptImageViewerComponent` | **HIGH** | Being renamed/moved |
| Receipt API endpoints | **MEDIUM** | May be modified to use new service |
| Receipt Store (ngrx/signals) | **LOW** | Not directly modified |
| SignalR notifications | **LOW** | Not directly modified |
| Mobile FAB capture | **MEDIUM** | Uses ReceiptCaptureService |

### Existing Test Inventory (Must All Pass)

#### Backend Tests
- `GenerateUploadUrlValidatorTests.cs` - File type and size validation
- `ReceiptNotificationServiceTests.cs` - SignalR notification tests
- Any receipt command/query handler tests

#### Frontend Tests
- Receipt component specs (`.spec.ts` files)
- Receipt service specs
- Receipt store specs

### Manual Regression Test Cases

Execute these manually before marking issue complete:

#### Upload Flow Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| R1 | JPEG upload via mobile FAB | 1. Open app on mobile viewport<br>2. Navigate to Dashboard<br>3. Tap camera FAB<br>4. Select JPEG image<br>5. Optionally tag property<br>6. Confirm upload | Receipt appears in unprocessed queue with thumbnail |
| R2 | PNG upload via mobile FAB | Same as R1 with PNG file | Receipt appears in queue |
| R3 | PDF upload via mobile FAB | Same as R1 with PDF file | Receipt appears in queue with PDF icon |
| R4 | Large file rejection | Upload file > 10MB | Error snackbar: "File too large" |
| R5 | Invalid type rejection | Attempt to upload .gif or .webp | Error snackbar: "Invalid file type" |
| R6 | Upload retry on failure | 1. Simulate network error during upload<br>2. Click "Retry" in snackbar | Upload completes successfully |

#### Display Flow Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| R7 | View receipt image | Click receipt in unprocessed queue | Full image loads in viewer with zoom/pan controls |
| R8 | Zoom in/out | Click +/- buttons in viewer | Image scales 0.5x to 2.0x |
| R9 | Pan when zoomed | Zoom > 100%, drag image | Image pans smoothly |
| R10 | Rotate image | Click rotate buttons | Image rotates 90° increments |
| R11 | Reset view | Click reset button | Returns to 100%, 0° rotation |
| R12 | View PDF receipt | Click PDF receipt in queue | PDF icon shown with "Open PDF" link |
| R13 | Image load error | View receipt with corrupted/missing S3 file | Error state with "Retry" button |

#### Processing Flow Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| R14 | Process receipt to expense | 1. Open unprocessed receipt<br>2. Fill expense form<br>3. Submit | Receipt marked processed, expense created |
| R15 | Receipt removed from queue | Process a receipt | Receipt no longer in unprocessed list |

#### Real-time Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| R16 | SignalR new receipt notification | Upload receipt in one tab, watch queue in another | New receipt appears in both tabs |

#### Property Tagging Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| R17 | Tag receipt with property | Upload with property selected in modal | Receipt shows property name in queue |
| R18 | Skip property tagging | Upload without selecting property | Receipt shows no property tag |

### E2E Test Scenarios (Playwright)

If E2E tests exist, ensure these scenarios are covered:

```typescript
// Receipt upload happy path
test('user can upload receipt via mobile FAB', async ({ page }) => {
  // Navigate to dashboard on mobile viewport
  // Click FAB, select file, confirm upload
  // Assert receipt appears in queue
});

// Receipt viewing
test('user can view and manipulate receipt image', async ({ page }) => {
  // Navigate to receipt detail
  // Test zoom, pan, rotate controls
  // Assert image transformations work
});

// Receipt processing
test('user can process receipt into expense', async ({ page }) => {
  // Open unprocessed receipt
  // Fill expense form
  // Assert expense created, receipt processed
});
```

### Refactoring Safety Rules

1. **No Big Bang**: Refactor incrementally. Keep old components working while building new ones.

2. **Parallel Implementation**:
   - Create `PhotoViewerComponent` alongside `ReceiptImageViewerComponent`
   - Create `PhotoUploadService` alongside `ReceiptCaptureService`
   - Only delete old components after new ones are proven

3. **Feature Flag Option**: Consider a feature flag to switch between old and new implementations during testing.

4. **Import Aliasing**: When renaming, use re-exports to maintain backward compatibility:
   ```typescript
   // receipt-image-viewer.component.ts (deprecated)
   export { PhotoViewerComponent as ReceiptImageViewerComponent } from '@shared/components/photo-viewer';
   ```

5. **API Stability**: Receipt API endpoints (`/api/v1/receipts/*`) must not change signatures. New photo endpoints should be additive.

### Testing Gate Criteria

**This issue cannot be merged until:**

- [ ] All existing backend receipt tests pass (`dotnet test --filter "Receipt"`)
- [ ] All existing frontend receipt tests pass (`npm test -- --filter receipt`)
- [ ] Manual regression tests R1-R18 executed and documented
- [ ] E2E tests pass (if they exist)
- [ ] Code review confirms no breaking changes to receipt API contracts
- [ ] QA sign-off on receipt functionality (if QA process exists)

### Rollback Plan

If issues are discovered post-merge:

1. Revert the merge commit
2. Old receipt components should still exist (parallel implementation)
3. Investigate failure before re-attempting

## Dependencies

- SixLabors.ImageSharp NuGet package
- Existing S3 infrastructure

## Estimated Complexity

**Backend:** Medium (new service, thumbnail generation)
**Frontend:** Low (mostly renaming/refactoring)
**Testing:** Medium (thumbnail generation edge cases)

## Files to Modify/Create

### Backend - Create
- `src/PropertyManager.Application/Common/Interfaces/IPhotoService.cs`
- `src/PropertyManager.Application/Common/Interfaces/IThumbnailService.cs`
- `src/PropertyManager.Infrastructure/Storage/PhotoService.cs`
- `src/PropertyManager.Infrastructure/Storage/ThumbnailService.cs`
- `tests/PropertyManager.Application.Tests/Photos/PhotoServiceTests.cs`
- `tests/PropertyManager.Infrastructure.Tests/Storage/ThumbnailServiceTests.cs`

### Backend - Modify
- `src/PropertyManager.Infrastructure/DependencyInjection.cs` (register services)
- `src/PropertyManager.Api/Program.cs` (if DI changes needed)

### Frontend - Create
- `src/app/shared/services/photo-upload.service.ts`
- `src/app/shared/components/photo-viewer/photo-viewer.component.ts`
- `src/app/shared/components/photo-viewer/photo-viewer.component.html`
- `src/app/shared/components/photo-viewer/photo-viewer.component.scss`

### Frontend - Modify
- `src/app/features/receipts/` (update imports to use shared components)

## Related Issues

- Blocks: Issue #2 (Property Photo Gallery)
- Future: Vendor Logo Support
- Future: User Avatar Support



---

## ADDITION: Generic Drag-and-Drop Upload Component

### Overview

Create a reusable `DragDropUploadComponent` for desktop that provides a modern file upload experience. This component will be used by property photos (Issue #100) and future features (vendor logos, user avatars).

### Component Specification

**File:** `frontend/src/app/shared/components/drag-drop-upload/drag-drop-upload.component.ts`

```typescript
@Component({
  selector: 'app-drag-drop-upload',
  standalone: true,
  // ...
})
export class DragDropUploadComponent {
  // Inputs
  @Input() accept: string = 'image/jpeg,image/png';  // Allowed MIME types
  @Input() maxSizeBytes: number = 10485760;          // 10MB default
  @Input() multiple: boolean = true;                  // Allow multiple files
  @Input() disabled: boolean = false;

  // Outputs
  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() uploadError = new EventEmitter<string>();

  // State
  isDragging = signal(false);
  selectedFiles = signal<File[]>([]);
}
```

### UI Specification

```
Desktop View (drag-drop zone):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌─────────────────┐                      │
│                    │   cloud_upload  │                      │
│                    │      icon       │                      │
│                    └─────────────────┘                      │
│                                                             │
│              Drag and drop photos here                      │
│                        or                                   │
│                                                             │
│               [ Browse Files ]  button                      │
│                                                             │
│            JPEG, PNG up to 10MB each                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Drag-over state (visual feedback):
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │              Drop files here                          │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
- Dashed border becomes solid primary color
- Background lightens
- Icon animates (pulse or bounce)

Files selected (preview):
┌─────────────────────────────────────────────────────────────┐
│ Selected files:                                             │
│ ┌──────┐ ┌──────┐ ┌──────┐                                 │
│ │ IMG  │ │ IMG  │ │ IMG  │  + Add more                     │
│ │ [x]  │ │ [x]  │ │ [x]  │                                 │
│ └──────┘ └──────┘ └──────┘                                 │
│                                                             │
│ 3 files selected (4.2 MB total)     [ Upload ]              │
└─────────────────────────────────────────────────────────────┘
```

### Features

1. **Drag and Drop**
   - Visual feedback on drag enter/leave
   - Drop zone highlights when files dragged over
   - Validates file types on drop

2. **Click to Browse**
   - Hidden file input triggered by button click
   - Native file picker opens
   - Supports multiple file selection

3. **File Validation**
   - Check MIME type against `accept` input
   - Check file size against `maxSizeBytes`
   - Show error message for rejected files

4. **Preview Before Upload**
   - Thumbnail preview of selected images
   - File name and size display
   - Remove button on each file
   - Total size calculation

5. **Accessibility**
   - Keyboard navigable (Tab to button, Enter to open picker)
   - ARIA labels for screen readers
   - Focus indicators

### Styling

```scss
.drag-drop-zone {
  border: 2px dashed var(--mat-sys-outline);
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;

  &.dragging {
    border-color: var(--mat-sys-primary);
    border-style: solid;
    background-color: var(--mat-sys-primary-container);
  }

  &:hover:not(.disabled) {
    border-color: var(--mat-sys-primary);
    background-color: var(--mat-sys-surface-variant);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Additional Acceptance Criteria for Issue #99

- [ ] `DragDropUploadComponent` created in shared components
- [ ] Drag-over visual feedback working
- [ ] Click-to-browse working with native file picker
- [ ] File type validation (reject invalid types with error message)
- [ ] File size validation (reject oversized files with error message)
- [ ] Multiple file selection supported
- [ ] Preview thumbnails displayed for selected images
- [ ] Remove individual files from selection
- [ ] Total file size displayed
- [ ] Component is accessible (keyboard navigation, ARIA labels)
- [ ] Unit tests for validation logic
- [ ] Component works on all modern browsers (Chrome, Firefox, Safari, Edge)

### Files to Create

- `src/app/shared/components/drag-drop-upload/drag-drop-upload.component.ts`
- `src/app/shared/components/drag-drop-upload/drag-drop-upload.component.html`
- `src/app/shared/components/drag-drop-upload/drag-drop-upload.component.scss`
- `src/app/shared/components/drag-drop-upload/drag-drop-upload.component.spec.ts`
