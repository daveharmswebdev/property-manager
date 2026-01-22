# Sprint Change Proposal: Property Photos Epic Refinements

**Date:** 2026-01-22
**Triggered By:** QA findings during Story 13-3c review
**Author:** Bob (Scrum Master) with Dave
**Scope Classification:** Minor - Direct implementation by dev team

---

## Section 1: Issue Summary

During review of Story 13-3c (Property Photo Lightbox Management), the following issues were identified:

| Priority | Issue | Type | Status |
|----------|-------|------|--------|
| **HIGH** | Dashboard property list shows house icon instead of photo thumbnail | Bug | Approved |
| **HIGH** | "Set as Primary" photo action not discoverable - hidden in menu | UX Gap | Approved |
| **MEDIUM** | Photo reordering uses Move Up/Down buttons instead of drag-and-drop | Enhancement | Approved |

**Context:** Epic 13 (Property Photos) is in-progress with Story 13-3c in `ready-for-review` status. These refinements ensure the feature meets 2026 UX expectations before marking the epic complete.

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 13: Property Photos** - Directly affected, refinements extend 13-3c scope

### Story Impact
- **Story 13-3c** (Property Photo Lightbox Management) - Add acceptance criteria for:
  - Dashboard thumbnail display
  - Visible favorite icon for primary selection
  - Drag-and-drop reordering on desktop

### Artifact Conflicts
- **PRD:** No changes needed - features align with FR41 (property list with thumbnails)
- **Architecture:** No changes - existing API endpoints support all functionality
- **UX Design:** Minor addition - document favorite icon pattern for reuse

### Technical Impact
- Frontend only - no backend changes required
- Existing `SetPrimaryPropertyPhoto` command already supports the feature
- Existing `ReorderPropertyPhotos` command already supports the feature
- Angular CDK DragDrop module required (likely already installed)

---

## Section 3: Recommended Approach

**Direct Adjustment** - Modify Story 13-3c to include these refinements before closing.

**Rationale:**
- All fixes are frontend-only with minimal effort
- Backend API already supports all required functionality
- Changes improve feature quality before release
- No scope creep - these are expected behaviors for a photo gallery

**Effort Estimate:** 2-3 hours total
- Bug fix (dashboard thumbnail): ~15 minutes
- Favorite icon UX: ~1 hour
- Drag-and-drop: ~1.5 hours

**Risk Assessment:** Low
- No backend changes
- No database migrations
- Existing test patterns can be extended

---

## Section 4: Detailed Change Proposals

### Change 1: Dashboard Thumbnail Bug Fix

**File:** `frontend/src/app/features/dashboard/dashboard.component.ts`
**Lines:** 93-100

**OLD:**
```html
<app-property-row
  [id]="property.id"
  [name]="property.name"
  [city]="property.city"
  [state]="property.state"
  [expenseTotal]="property.expenseTotal"
  [incomeTotal]="property.incomeTotal"
  (rowClick)="navigateToProperty($event)">
</app-property-row>
```

**NEW:**
```html
<app-property-row
  [id]="property.id"
  [name]="property.name"
  [city]="property.city"
  [state]="property.state"
  [expenseTotal]="property.expenseTotal"
  [incomeTotal]="property.incomeTotal"
  [thumbnailUrl]="property.primaryPhotoThumbnailUrl"
  (rowClick)="navigateToProperty($event)">
</app-property-row>
```

**Justification:** Properties list already passes this binding; dashboard was simply missing it.

---

### Change 2: Primary Photo "Favorite" Icon

**File:** `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts`

**Template Change - Replace primary badge with clickable favorite button:**

**OLD (lines 100-104):**
```html
@if (photo.isPrimary) {
  <div class="primary-badge" data-testid="primary-badge">
    <mat-icon>star</mat-icon>
  </div>
}
```

**NEW:**
```html
<button
  class="favorite-btn"
  [class.is-primary]="photo.isPrimary"
  (click)="onSetPrimary(photo, $event)"
  [attr.aria-label]="photo.isPrimary ? 'Primary photo' : 'Set as primary photo'"
  data-testid="favorite-btn">
  <mat-icon>{{ photo.isPrimary ? 'favorite' : 'favorite_border' }}</mat-icon>
</button>
```

**New Component Method:**
```typescript
onSetPrimary(photo: PropertyPhoto, event: Event): void {
  event.stopPropagation();
  if (!photo.isPrimary) {
    this.setPrimaryClick.emit(photo);
  }
}
```

**New Styles:**
```scss
.favorite-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  mat-icon {
    color: #666;
    font-size: 20px;
  }

  &.is-primary mat-icon {
    color: #e91e63;
  }

  &:hover {
    background: white;
    transform: scale(1.1);
  }
}
```

**Justification:** Heart/favorite icon is universally understood. Filled = primary, outline = tap to set. Pattern will be reused for Vendors feature.

---

### Change 3: Drag-and-Drop Photo Reordering

**File:** `frontend/src/app/features/properties/components/property-photo-gallery/property-photo-gallery.component.ts`

**New Import:**
```typescript
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
```

**Template Change:**
```html
<div class="photo-grid" cdkDropList (cdkDropListDropped)="onDrop($event)">
  @for (photo of photos(); track photo.id; let i = $index) {
    <div class="photo-card" cdkDrag ...>
      <div class="drag-placeholder" *cdkDragPlaceholder></div>
```

**New Component Method:**
```typescript
onDrop(event: CdkDragDrop<PropertyPhoto[]>): void {
  const photos = [...this.photos()];
  moveItemInArray(photos, event.previousIndex, event.currentIndex);
  const newOrder = photos.map(p => p.id);
  this.reorderClick.emit(newOrder);
}
```

**New Styles (responsive):**
```scss
.photo-card {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.cdk-drag-preview {
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  opacity: 0.9;
}

.cdk-drag-placeholder {
  background: var(--pm-surface-variant);
  border: 2px dashed var(--pm-primary);
  border-radius: 8px;
}

.cdk-drag-animating {
  transition: transform 200ms ease;
}

// Hide move buttons on desktop, show on mobile
.move-buttons {
  display: none;

  @media (max-width: 767px) {
    display: flex;
  }
}

// Disable drag on mobile
@media (max-width: 767px) {
  .photo-card {
    cursor: default;
  }

  .cdk-drop-list {
    pointer-events: none;
  }

  .photo-card > *:not(.cdk-drag-handle) {
    pointer-events: auto;
  }
}
```

**Justification:** Modern UX expectation. Desktop uses drag-drop, mobile keeps Move Up/Down buttons for better touch experience.

---

## Section 5: Implementation Handoff

**Scope Classification:** Minor

**Route To:** Development team for direct implementation

**Deliverables:**
1. Updated Story 13-3c with new acceptance criteria
2. Implementation of all three changes
3. Unit tests for new favorite button functionality
4. Manual QA verification on desktop and mobile

**Success Criteria:**
- [ ] Dashboard shows property thumbnails (same as properties list)
- [ ] Favorite icon visible on all photo cards in gallery
- [ ] Tapping outline heart sets photo as primary
- [ ] Primary photo shows filled pink heart
- [ ] Desktop: drag-and-drop reorders photos
- [ ] Mobile: Move Up/Down buttons visible and functional
- [ ] All existing tests pass
- [ ] New tests added for favorite button

**Acceptance Criteria Additions for Story 13-3c:**

```markdown
**Given** I am on the Dashboard
**When** a property has a primary photo set
**Then** the property row displays the photo thumbnail instead of the house icon

**Given** I am viewing the photo gallery on a property detail page
**When** I see a photo card
**Then** I see a heart icon in the top-left corner
**And** the primary photo's heart is filled (pink)
**And** non-primary photos have an outline heart

**Given** I click the outline heart on a non-primary photo
**When** the action completes
**Then** that photo becomes the primary (heart fills)
**And** the previous primary photo's heart becomes outline
**And** I see a success message

**Given** I am on desktop viewing the photo gallery
**When** I drag a photo to a new position
**Then** the photos reorder
**And** the new order persists after page reload

**Given** I am on mobile viewing the photo gallery
**When** I open the photo menu
**Then** I see Move Up and Move Down options
**And** drag-and-drop is disabled
```

---

*Generated by Correct Course Workflow*
*Sprint: Epic 13 - Property Photos*
