# Story 13.3c: Property Photo Lightbox & Management

Status: blocked

## Story

As a property owner,
I want to view photos in a lightbox and manage them (set primary, delete, reorder),
so that I can examine photo details and organize my property photos effectively.

## Parent Story

Split from [Story 13.3: Property Photo Gallery](13-3-property-photo-gallery.md)

## Dependencies

- **Story 13.3a** (Property Photo Backend) - Must be complete
- **Story 13.3b** (Gallery & Upload) - Must be complete before starting

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

### Task 1: Frontend - Property Photo Lightbox (AC: 1, 2, 3)
- [ ] 1.1 Create `PropertyPhotoLightboxComponent` (modal dialog)
- [ ] 1.2 Add prev/next navigation with keyboard support
- [ ] 1.3 Integrate existing `PhotoViewerComponent` for zoom/rotate
- [ ] 1.4 Close on backdrop click or Escape key

### Task 2: Frontend - Property Photo Management (AC: 4, 5, 6, 7, 8, 9, 10)
- [ ] 2.1 Add star badge on primary photo
- [ ] 2.2 Add context menu (set primary, delete)
- [ ] 2.3 Add move up/down reorder buttons
- [ ] 2.4 Implement delete confirmation dialog
- [ ] 2.5 Update gallery after each operation

### Task 3: Frontend - Store Enhancements
- [ ] 3.1 Add deletePhoto method to store
- [ ] 3.2 Add setPrimary method to store
- [ ] 3.3 Add reorderPhotos method to store
- [ ] 3.4 Handle optimistic updates

### Task 4: Frontend - Unit Tests (AC: 11)
- [ ] 4.1 Test gallery component rendering
- [ ] 4.2 Test upload component validation
- [ ] 4.3 Test lightbox navigation
- [ ] 4.4 Test store state management

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

### Frontend Component Hierarchy (Complete)

```
property-detail.component.ts
└── property-photo-gallery.component.ts
    ├── property-photo-upload.component.ts (when adding)
    ├── property-photo-card.component.ts (per photo)
    │   └── context menu (set primary, delete)
    │   └── reorder buttons (move up/down)
    └── property-photo-lightbox.component.ts (modal)
        └── photo-viewer.component.ts (existing - zoom/rotate)
```

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

This story adds:
```
frontend/src/app/shared/components/property-photo-lightbox/
  ├── property-photo-lightbox.component.ts
  ├── property-photo-lightbox.component.html
  └── property-photo-lightbox.component.scss
frontend/src/app/features/properties/components/property-photo-card/ (enhanced)
  └── context-menu, reorder buttons added
```

### References

- [Source: GitHub Issue #100](https://github.com/daveharmswebdev/property-manager/issues/100)
- [Source: photo-viewer.component.ts] - Existing viewer with zoom/rotate

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List

