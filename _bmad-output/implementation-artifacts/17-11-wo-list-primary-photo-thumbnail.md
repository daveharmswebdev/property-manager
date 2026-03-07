# Story 17.11: Work Order List — Primary Photo Thumbnail

Status: review

## Story

As a property owner browsing work orders,
I want to see a photo thumbnail for each work order in the list,
so that I can visually identify work orders at a glance.

**GitHub Issue:** #270
**Effort:** M (downgraded to S — backend already complete, frontend-only change)

## Acceptance Criteria

**AC-1: Thumbnail displayed in work order list row**
Given I am on the Work Orders list (`/work-orders`)
When a work order has photos
Then the primary photo thumbnail (48×48px) is displayed in the row between the expand chevron and the row content

**AC-2: Placeholder for no-photo work orders**
Given a work order has no photos
When the list renders
Then a placeholder `mat-icon` (`handyman`) is shown in the same 48×48 container

**AC-3: Backend includes thumbnail URL (ALREADY DONE)**
Given the `GET /api/v1/work-orders` response
When work orders have photos
Then the response includes a `primaryPhotoThumbnailUrl` field
**Status:** Already implemented — `GetAllWorkOrders.cs` includes `.Include(w => w.Photos)`, generates presigned thumbnail URLs, returns in `WorkOrderDto.PrimaryPhotoThumbnailUrl`. No backend changes needed.

**AC-4: Mobile responsive**
Given I view the work order list on mobile (≤768px)
When the rows stack into mobile layout
Then the thumbnail remains visible and appropriately sized (40×40px)

## Tasks / Subtasks

### Task 1: Add thumbnail element to work order list row template (AC: 1, 2)

- [x] 1.1: Add a `<div class="wo-thumbnail">` between the expand chevron button (line 122-126) and the `<div class="row-content">` (line 129) in the `work-orders.component.ts` template
- [x] 1.2: Inside the thumbnail div, use conditional rendering:
  ```html
  <div class="wo-thumbnail">
    @if (workOrder.primaryPhotoThumbnailUrl) {
      <img [src]="workOrder.primaryPhotoThumbnailUrl"
           [alt]="workOrder.description + ' photo'"
           class="thumbnail-img"
           loading="lazy" />
    } @else {
      <mat-icon class="fallback-icon">handyman</mat-icon>
    }
  </div>
  ```
- [x] 1.3: No new imports needed — `MatIconModule` and `CommonModule` already imported

### Task 2: Add thumbnail styles (AC: 1, 2, 4)

- [x] 2.1: Add `.wo-thumbnail` styles matching the property-row pattern:
  ```scss
  .wo-thumbnail {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background-color: var(--mat-sys-surface-container);
    overflow: hidden;
    flex-shrink: 0;
  }

  .wo-thumbnail .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .wo-thumbnail .fallback-icon {
    color: var(--mat-sys-on-surface-variant);
    font-size: 24px;
    width: 24px;
    height: 24px;
  }
  ```
- [x] 2.2: Add mobile breakpoint override (inside existing `@media (max-width: 768px)` block):
  ```scss
  .wo-thumbnail {
    width: 40px;
    height: 40px;
  }
  .wo-thumbnail .fallback-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
  }
  ```

### Task 3: Unit tests — thumbnail display (AC: 1, 2)

- [x] 3.1: Test: renders thumbnail `<img>` when `primaryPhotoThumbnailUrl` is present (use `wo-2` mock which has `'http://example.com/thumb.jpg'`)
- [x] 3.2: Test: `<img>` has correct `src` attribute matching the URL
- [x] 3.3: Test: `<img>` has `loading="lazy"` attribute
- [x] 3.4: Test: renders placeholder `mat-icon` with `handyman` text when `primaryPhotoThumbnailUrl` is null (use `wo-1` mock)
- [x] 3.5: Test: every row has a `.wo-thumbnail` container (3 total for 3 mock work orders)
- [x] 3.6: Test: no `<img>` rendered inside placeholder thumbnail (null URL row)

## Dev Notes

### This is a Frontend-Only Story — No Backend Changes

The backend `GetAllWorkOrders` handler (`backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrders.cs`) already:
1. Includes `.Include(w => w.Photos)` in the query (line 56)
2. Selects primary photo (IsPrimary first, then first by DisplayOrder) (lines 89-90)
3. Generates presigned thumbnail URL via `_photoService.GetThumbnailUrlAsync()` (line 95)
4. Returns `thumbnailUrl` in the `WorkOrderDto` constructor (line 114)

The frontend `WorkOrderDto` interface (`work-order.service.ts`) already has `primaryPhotoThumbnailUrl?: string`.

The NSwag-generated API client already maps this field. **Zero backend or service changes required.**

### Pattern: Follow PropertyRowComponent Thumbnail

The `property-row.component.ts` (`frontend/src/app/shared/components/property-row/property-row.component.ts`) provides the exact pattern:
- 48×48px container with `border-radius: 8px`
- `<img>` with `object-fit: cover` for photos
- `<mat-icon>` fallback for no-photo state
- 40×40px on mobile

Use `handyman` icon as fallback (work orders are maintenance tasks), NOT `home` (that's for properties) or `build` (less recognizable).

### Template Insertion Point

The thumbnail goes **between** the expand chevron and the row content. Current row structure (lines 120-176 of `work-orders.component.ts`):

```
.work-order-row
  ├── .expand-btn (chevron)
  ├── [NEW] .wo-thumbnail (thumbnail)  ← INSERT HERE
  ├── .row-content (two-line content, clickable)
  └── .row-actions (edit/delete icons)
```

The `.row-content` has `flex: 1; min-width: 0` so it will naturally shrink to accommodate the new 48px thumbnail.

### Expand Panel Thumbnail

The expand panel already shows `primaryPhotoThumbnailUrl` as a larger preview (120×120px, class `.expand-thumbnail`, lines 183-185). Keep this — it serves a different purpose (preview on expand). The row thumbnail provides quick visual identification at a glance.

### CSS Variables

Use `var(--mat-sys-surface-container)` for the thumbnail background (matches the app's Material Design 3 theme system). The property-row uses `var(--pm-primary-light)` which is a project-specific variable — prefer the M3 system tokens for consistency with the work orders page, which already uses `var(--mat-sys-*)` tokens throughout.

Use `var(--mat-sys-on-surface-variant)` for the fallback icon color (matches the existing `.inline-icon` and `.wo-category` coloring in the work order list).

### Existing Test Mock Data

The spec file (`work-orders.component.spec.ts`) already has appropriate test data:
- `wo-1`: `primaryPhotoThumbnailUrl: null` → should show placeholder
- `wo-2`: `primaryPhotoThumbnailUrl: 'http://example.com/thumb.jpg'` → should show `<img>`
- `wo-3`: `primaryPhotoThumbnailUrl: null` → should show placeholder

No changes to mock data needed.

### Project Structure Notes

- Single file to modify: `frontend/src/app/features/work-orders/work-orders.component.ts` (inline template + inline styles)
- Single test file to update: `frontend/src/app/features/work-orders/work-orders.component.spec.ts`
- No new files, no new components, no new services

### References

- [Source: `frontend/src/app/features/work-orders/work-orders.component.ts` — lines 120-176 (row template), lines 183-185 (expand panel thumbnail), lines 299-305 (.work-order-row styles), lines 461-467 (.expand-thumbnail styles), lines 477-545 (mobile breakpoint)]
- [Source: `frontend/src/app/shared/components/property-row/property-row.component.ts` — lines 33-38 (thumbnail template pattern), lines 92-115 (thumbnail styles)]
- [Source: `frontend/src/app/features/work-orders/work-orders.component.spec.ts` — lines 40-83 (mockWorkOrders with primaryPhotoThumbnailUrl data), lines 396-415 (existing expand panel thumbnail tests)]
- [Source: `backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrders.cs` — lines 49-56 (query with .Include Photos), lines 87-116 (thumbnail URL generation)]
- [Source: `backend/src/PropertyManager.Application/WorkOrders/WorkOrderDto.cs` — PrimaryPhotoThumbnailUrl field]
- [Source: `frontend/src/app/features/work-orders/services/work-order.service.ts` — WorkOrderDto interface with primaryPhotoThumbnailUrl]
- [Source: project-context.md — Angular Material patterns, testing rules]
- [Source: GitHub Issue #270 — Work order list primary photo thumbnail]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, all tests passed on first run.

### Completion Notes List

- Task 1: Added `<div class="wo-thumbnail">` between expand chevron and `.row-content` with `@if`/`@else` conditional rendering — `<img>` with `loading="lazy"` for photos, `<mat-icon>handyman</mat-icon>` fallback for no-photo work orders. No new imports needed.
- Task 2: Added `.wo-thumbnail` styles (48×48px desktop, 40×40px mobile) using `var(--mat-sys-surface-container)` background and `var(--mat-sys-on-surface-variant)` icon color per M3 design tokens. Mobile override placed inside existing `@media (max-width: 768px)` block.
- Task 3: Added 6 unit tests in `describe('Row Thumbnail')` block covering: img rendering, src binding, lazy loading, placeholder icon, container count, and no-img-in-placeholder. All pass.
- All 2625 frontend tests pass, zero regressions.

### Change Log

- 2026-03-05: Implemented Story 17.11 — work order list primary photo thumbnail (AC-1, AC-2, AC-4)

### File List

- `frontend/src/app/features/work-orders/work-orders.component.ts` (modified — template + styles)
- `frontend/src/app/features/work-orders/work-orders.component.spec.ts` (modified — 6 new tests)
