# Story 13.4: Photo Gallery Drag-and-Drop Fix

Status: review

## Story

As a property owner,
I want drag-and-drop photo reordering to work reliably with reasonable drag distance,
so that I can easily organize my property photos without frustration.

## Source

- [GitHub Issue #113](https://github.com/daveharmswebdev/property-manager/issues/113)

## Dependencies

- **Story 13.3c** (Property Photo Lightbox & Management) - Contains the original drag-drop implementation

## Problem Summary

The drag-and-drop photo reordering feature implemented in Story 13.3c is inconsistent and requires excessive drag distance to trigger. The root cause is that **Angular CDK drag-drop's default sorting strategy was designed for single-direction linear lists**, not CSS Grid layouts.

## Root Cause Analysis

| Issue | Cause |
|-------|-------|
| Inconsistent drag trigger | CDK uses linear index-based sorting; CSS Grid is 2D positional |
| Excessive drag distance | Default sorting strategy miscalculates positions in wrapped layouts |
| CSS transform conflicts | `.photo-card:hover { transform: scale(1.02) }` can interfere with drag calculations |

## Solution

Angular CDK v18.1.0+ added `cdkDropListOrientation="mixed"` which:
- Uses DOM node manipulation instead of CSS transforms for sorting
- Properly handles wrapped/grid layouts
- **Trade-off**: No smooth animation during sort (acceptable for this use case)

## Acceptance Criteria

1. **AC-13.4.1**: Drag-and-drop reordering triggers with reasonable drag distance (similar to native browser drag)
2. **AC-13.4.2**: Visual feedback (placeholder) shows correct drop position during drag
3. **AC-13.4.3**: Reordered photos persist to backend via existing `ReorderPropertyPhotos` API
4. **AC-13.4.4**: Works on desktop (768px+); mobile continues to use move buttons
5. **AC-13.4.5**: All existing photo gallery tests continue to pass
6. **AC-13.4.6**: Drag handle icon appears on hover and initiates drag correctly

## Tasks / Subtasks

### Task 1: Convert CSS Grid to Flexbox (AC: 1, 2)

- [x] 1.1 Change `.gallery-grid` from `display: grid` to `display: flex; flex-wrap: wrap`
- [x] 1.2 Update photo card sizing to use `flex` property instead of grid columns
- [x] 1.3 Ensure responsive breakpoints still work (1/2/3 columns at mobile/tablet/desktop)
- [x] 1.4 Verify gap spacing is preserved

### Task 2: Enable Mixed Orientation (AC: 1, 2)

- [x] 2.1 Add `cdkDropListOrientation="mixed"` to the gallery grid `cdkDropList`
- [x] 2.2 Verify drag-and-drop now triggers with normal drag distance
- [x] 2.3 Test that placeholder appears at correct position during drag

### Task 3: Remove CSS Transform Conflicts (AC: 1)

- [x] 3.1 Remove or modify `.photo-card:hover { transform: scale(1.02) }`
- [x] 3.2 Remove `.drag-handle:hover { transform: scale(1.1) }` if present
- [x] 3.3 Consider alternative hover effects (box-shadow, border) that don't use transform

### Task 4: Verify Responsive Behavior (AC: 4)

- [x] 4.1 Test drag-drop works correctly on desktop (768px+)
- [x] 4.2 Confirm move up/down buttons work on mobile (<768px)
- [x] 4.3 Verify `cdkDragDisabled` is applied correctly on mobile

### Task 5: Update and Run Tests (AC: 5, 6)

- [x] 5.1 Update existing drag-drop tests if CSS selectors changed
- [x] 5.2 Run full frontend test suite (`npm test`)
- [x] 5.3 Manually verify via Playwright MCP tools

## Dev Notes

### Key File to Modify

**Primary:** `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts`

### Current Implementation (Lines 94, 221-233)

```html
<!-- Line 94 - Missing orientation -->
<div class="gallery-grid" cdkDropList (cdkDropListDropped)="onDrop($event)">
```

```scss
/* Lines 221-233 - CSS Grid (problematic) */
.gallery-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(1, 1fr);

  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 960px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Required Changes

**HTML (Line 94):**
```html
<div class="gallery-grid" cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="onDrop($event)">
```

**CSS - Replace Grid with Flexbox:**
```scss
.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.photo-card {
  /* Single column on mobile */
  flex: 0 0 100%;

  @media (min-width: 600px) {
    /* 2 columns on tablet - account for gap */
    flex: 0 0 calc(50% - 6px);
  }

  @media (min-width: 960px) {
    /* 3 columns on desktop - account for gap */
    flex: 0 0 calc(33.333% - 8px);
  }
}
```

**CSS - Remove Transform on Hover (Lines 245-248):**
```scss
/* REMOVE or REPLACE this: */
.photo-card:hover {
  transform: scale(1.02);  /* <-- This interferes with drag */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* REPLACE WITH: */
.photo-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  /* No transform - keeps drag calculations accurate */
}
```

### Mixed Orientation Behavior

Per Angular CDK documentation:
- `cdkDropListOrientation="mixed"` moves DOM nodes directly (not via CSS transform)
- **Animation limitation**: Sorting animation won't be smooth (items jump to new position)
- This is acceptable since the visual feedback during drag is preserved

### Architecture Compliance

| Aspect | Compliance |
|--------|------------|
| Component location | `features/properties/components/property-photo-gallery/` - ✅ Correct |
| State management | Uses `@ngrx/signals` store - ✅ Existing pattern |
| Testing | Vitest - ✅ Existing pattern |
| CDK version | @angular/cdk@20.2.14 - ✅ Supports mixed orientation |

### Testing Strategy

1. **Unit Tests**: Existing tests in `property-photo-gallery.component.spec.ts` should pass
2. **Manual Testing**: Use Playwright MCP to verify:
   - Navigate to property detail page with photos
   - Attempt drag-drop reordering
   - Verify placeholder appears correctly
   - Verify order persists after drop

### Previous Story Learnings (13.3c)

From `13-3c-property-photo-lightbox-management.md`:
- Drag-drop was marked complete but behavior was inconsistent
- Move up/down buttons work correctly (alternative for mobile)
- Store methods (`reorderPhotos`) work correctly
- Backend `ReorderPropertyPhotos` API is functional

### References

- [GitHub Issue #113 - Full technical details](https://github.com/daveharmswebdev/property-manager/issues/113)
- [Angular CDK Mixed Orientation Support (PR #29216)](https://github.com/angular/components/pull/29216)
- [Angular CDK Drag-Drop Guide](https://angular.dev/guide/drag-drop)
- [GitHub Issue #13372 - Original feature request (resolved)](https://github.com/angular/components/issues/13372)

### Project Structure Notes

- Single file modification: `property-photo-gallery.component.ts`
- No new files required
- No backend changes needed

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - implementation was straightforward.

### Completion Notes List

1. **Task 1 - CSS Grid to Flexbox**: Converted `.gallery-grid` from CSS Grid to Flexbox with responsive breakpoints. Photo cards now use `flex: 0 0 100%` (mobile), `flex: 0 0 calc(50% - 6px)` (tablet), and `flex: 0 0 calc(33.333% - 8px)` (desktop).

2. **Task 2 - Mixed Orientation**: Added `cdkDropListOrientation="mixed"` attribute to the cdkDropList directive. This enables proper drag-drop behavior for wrapped/grid layouts by using DOM node manipulation instead of CSS transforms.

3. **Task 3 - Transform Conflicts**: Removed `transform: scale()` from hover states on `.photo-card` and `.favorite-btn`. Replaced with enhanced `box-shadow` effects to maintain visual feedback without interfering with drag calculations.

4. **Task 4 - Responsive Verification**:
   - Desktop (1280px): 2-column layout verified, entire card draggable
   - Mobile (375px): Single column layout, move up/down buttons work correctly
   - Tested reorder via move button - "Photos reordered" snackbar confirmed backend persistence

5. **Task 5 - Tests**:
   - Fixed missing vitest imports in `property-photo-gallery.component.spec.ts`
   - All 1216 frontend tests pass (57 test files)
   - Manual verification via Playwright MCP confirmed all AC met

6. **Post-Review Enhancement - Drag Handle Removal**: Removed separate drag handle (6-dots icon) per user feedback. Entire photo card is now draggable, which:
   - Eliminates visual clutter
   - Provides more intuitive UX (grab anywhere on photo to drag)

7. **Post-Review Enhancement - Menu Simplification**: Replaced 3-dot menu with direct delete button per user feedback:
   - Menu only had 1-2 items (Delete, and Set as Primary for non-primary photos)
   - "Set as Primary" already handled by heart/favorite button
   - Direct trash icon is cleaner and more obvious
   - Removed MatMenuModule dependency

### File List

- `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts` - CSS and template changes for flexbox layout and mixed orientation
- `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.spec.ts` - Added vitest imports

### Change Log

- 2026-01-22: Implemented drag-drop fix with cdkDropListOrientation="mixed" and flexbox layout (Story 13.4)

