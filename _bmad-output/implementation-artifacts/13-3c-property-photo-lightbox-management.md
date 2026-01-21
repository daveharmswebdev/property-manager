# Story 13.3c: Property Photo Lightbox & Management

Status: ready-for-review

## Story

As a property owner,
I want to view photos in a lightbox and manage them (set primary, delete, reorder),
so that I can examine photo details and organize my property photos effectively.

## Parent Story

Split from [Story 13.3: Property Photo Gallery](13-3-property-photo-gallery.md)

## Dependencies

- **Story 13.3a** (Property Photo Backend) - ✅ Complete
- **Story 13.3b** (Gallery & Upload) - ✅ Complete

## Acceptance Criteria

### Lightbox

1. **AC-13.3c.1**: Clicking a photo opens lightbox modal with navigation (prev/next), zoom controls, and close button
2. **AC-13.3c.2**: Lightbox supports keyboard navigation (arrow keys, Escape to close)
3. **AC-13.3c.3**: Close on backdrop click or Escape key

### Photo Management

4. **AC-13.3c.4**: Photo management component shows star icon on primary photo
5. **AC-13.3c.5**: Allows delete (with confirmation), set as primary via context menu
6. **AC-13.3c.6**: Reorder photos via "move up/down" buttons (drag-drop deferred to growth phase)
7. **AC-13.3c.7**: When primary photo is deleted, next photo by DisplayOrder becomes primary
8. **AC-13.3c.8**: Delete confirmation dialog warns action cannot be undone

### UX Polish

9. **AC-13.3c.9**: Visual indicator (star badge) distinguishes primary photo
10. **AC-13.3c.10**: Gallery updates immediately after each operation

### Testing

11. **AC-13.3c.11**: Frontend unit tests cover gallery, upload, lightbox, and store

## Tasks / Subtasks

### Task 1: Frontend - Property Photo Lightbox (AC: 1, 2, 3) ✅ COMPLETE
- [x] 1.1 Create `PropertyPhotoLightboxComponent` (modal dialog) *(property-photo-lightbox.component.ts)*
- [x] 1.2 Add prev/next navigation with keyboard support *(arrow keys, wrapping navigation)*
- [x] 1.3 Integrate existing `PhotoViewerComponent` for zoom/rotate *(zoom/pan/rotate controls)*
- [x] 1.4 Close on backdrop click or Escape key *(@HostListener keyboard handler)*

### Task 2: Frontend - Property Photo Management (AC: 4, 5, 6, 7, 8, 9, 10) ✅ COMPLETE
- [x] 2.1 Add star badge on primary photo *(done in 13.3b - gallery component lines 98-102)*
- [x] 2.2 Add context menu (set primary, delete) to gallery photo cards *(MatMenu with mat-menu-item)*
- [x] 2.3 Add move up/down reorder buttons to gallery photo cards *(hover overlay buttons)*
- [x] 2.4 Implement delete confirmation dialog *(using ConfirmDialogComponent)*
- [x] 2.5 Update gallery after each operation *(store methods handle optimistic updates)*

### Task 3: Frontend - Store Enhancements ✅ COMPLETE (implemented in 13.3b)
- [x] 3.1 Add deletePhoto method to store *(property-photo.store.ts:213-247)*
- [x] 3.2 Add setPrimaryPhoto method to store *(property-photo.store.ts:252-289)*
- [x] 3.3 Add reorderPhotos method to store *(property-photo.store.ts:294-334)*
- [x] 3.4 Handle optimistic updates *(all methods update local state immediately)*

### Task 4: Frontend - Unit Tests (AC: 11) ✅ COMPLETE
- [x] 4.1 Test gallery component rendering *(property-photo-gallery.component.spec.ts - 357 lines)*
- [x] 4.2 Test upload component validation *(property-photo-upload.component.spec.ts - 294 lines)*
- [x] 4.3 Test lightbox navigation *(property-photo-lightbox.component.spec.ts - 247 lines)*
- [x] 4.4 Test store state management *(property-photo.store.spec.ts - 321 lines)*

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
- Lightbox component → `shared/components/property-photo-lightbox/`
- Photo card with management → `features/properties/components/property-photo-card/`

### Existing Code to Reuse

**DO NOT reinvent these - they already exist:**

| Component | Location | Usage |
|-----------|----------|-------|
| `PhotoViewerComponent` | `shared/components/photo-viewer/` | Zoom/rotate/pan in lightbox |

### Frontend Component Hierarchy (Actual)

```
property-detail.component.ts
└── property-photo-gallery.component.ts (already exists)
    ├── property-photo-upload.component.ts (already exists - upload dialog)
    ├── Photo cards rendered inline (add context menu + reorder buttons)
    └── property-photo-lightbox.component.ts (NEW - modal dialog)
        └── photo-viewer.component.ts (already exists - zoom/rotate/pan)
```

**Note:** The gallery component renders photo cards inline (no separate `property-photo-card` component).
Management UI (context menu, reorder buttons) should be added directly to the gallery's photo card template.

### State Management (Signals) - Complete

```typescript
// property-photo.store.ts - extended from 13.3b
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

**Frontend Tests (Vitest):**
- Test gallery renders photos in correct order
- Test empty state shows upload prompt
- Test upload validation rejects invalid files
- Test lightbox navigation wraps correctly
- Test primary badge appears on correct photo
- Test delete confirmation dialog shows

### Project Structure

This story adds/modifies:
```
frontend/src/app/shared/components/property-photo-lightbox/  (NEW)
  ├── property-photo-lightbox.component.ts
  └── property-photo-lightbox.component.spec.ts
frontend/src/app/features/properties/components/property-photo-gallery/  (MODIFY)
  └── property-photo-gallery.component.ts (add context menu, reorder buttons)
frontend/src/app/features/properties/stores/  (MODIFY)
  └── property-photo.store.spec.ts (NEW - add store unit tests)
```

### References

- [Source: GitHub Issue #100](https://github.com/daveharmswebdev/property-manager/issues/100)
- [Source: photo-viewer.component.ts] - Existing viewer with zoom/rotate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 (Lightbox)**: Created `PropertyPhotoLightboxComponent` as a fullscreen modal dialog using Angular Material. Integrates existing `PhotoViewerComponent` for zoom/rotate/pan functionality. Supports keyboard navigation (ArrowLeft/Right, Escape) and navigation button clicks. Closes on backdrop click.

2. **Task 2 (Photo Management)**: Enhanced `PropertyPhotoGalleryComponent` with:
   - Context menu (MatMenu) with "Set as Primary" and "Delete" options
   - Move up/down reorder buttons that appear on hover overlay
   - Delete confirmation via existing `ConfirmDialogComponent`
   - "Set as Primary" hidden for already-primary photos
   - Disabled move up on first photo, move down on last photo

3. **Task 4 (Testing)**: Added comprehensive unit tests:
   - Lightbox tests (22 tests): navigation, keyboard, close functionality, single photo handling
   - Gallery tests expanded (+10 tests): context menu, reorder buttons, event emissions
   - Store tests (20 tests): loadPhotos, deletePhoto, setPrimaryPhoto, reorderPhotos, computed properties, error handling

4. **Integration**: Wired up lightbox in `property-detail.component.ts` - clicking a photo opens the lightbox at the correct index. Management actions (delete, set primary, reorder) call store methods which handle API calls and optimistic updates.

### File List

**New Files:**
- `frontend/src/app/shared/components/property-photo-lightbox/property-photo-lightbox.component.ts` (174 lines)
- `frontend/src/app/shared/components/property-photo-lightbox/property-photo-lightbox.component.spec.ts` (247 lines)
- `frontend/src/app/features/properties/stores/property-photo.store.spec.ts` (321 lines)

**Modified Files:**
- `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts` - Added context menu, reorder buttons, overlay styling, new outputs
- `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.spec.ts` - Added tests for management features (+10 tests)
- `frontend/src/app/features/properties/property-detail/property-detail.component.ts` - Added lightbox integration and management event handlers

