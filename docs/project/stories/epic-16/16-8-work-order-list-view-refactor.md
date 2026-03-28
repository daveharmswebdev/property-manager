# Story 16.8: Work Order List View Refactor

Status: complete

**Prerequisites:** None — all work order features complete (Epics 9-12 done)
**Effort:** Medium — single component template/style refactor, no API or store changes
**UX Source:** `_bmad-output/planning-artifacts/ux-handoff-work-orders-list-redesign.md`
**Wireframe:** `_bmad-output/excalidraw-diagrams/wireframe-work-orders-enriched-row.excalidraw`

## Story

As a **property owner managing maintenance across multiple properties**,
I want **the work orders list displayed as enriched two-line rows instead of a card grid**,
So that **I can scan, sort, and compare work orders efficiently with a consistent reading flow**.

## Acceptance Criteria

### AC1 — Enriched row format on desktop

**Given** I am viewing the work orders list on desktop (>768px)
**When** the page loads with work orders
**Then** each work order displays as a full-width row (not a card in a grid)
**And** rows use a flex-based layout (not `mat-table`)

### AC2 — Two-line row content

**Given** a work order row on desktop
**When** I view the row
**Then** Line 1 (scan line) shows: status chip, description (title), assignee, category, date, action icons (edit, delete)
**And** Line 2 (context line) shows: property name, vendor name (if not DIY), tags

### AC3 — Color-coded status chips

**Given** a work order row
**When** I view the status chip
**Then** "Reported" displays with orange/amber background
**And** "Assigned" displays with blue background
**And** "Completed" displays with green background
**And** these form a visible "traffic light strip" down the left side of the list

### AC4 — Alternating row backgrounds

**Given** the work orders list
**When** multiple rows are displayed
**Then** odd and even rows have slightly different background colors for visual rhythm

### AC5 — Expand/collapse detail panel

**Given** a work order row
**When** I click the expand chevron on the left
**Then** an inline detail panel expands below the row showing: full description text, photo thumbnail (if available)
**And** clicking the chevron again collapses the panel
**And** clicking the chevron does NOT navigate to the detail page

### AC6 — Mobile responsive reflow

**Given** I am viewing the work orders list on mobile (<768px)
**When** the page loads
**Then** each row unstacks into a compact stacked card layout:
  - Status chip + date on top line
  - Description (title)
  - Property name
  - Assignee
  - Category (if present)

### AC7 — Existing filters continue to work

**Given** the refactored list view
**When** I use status filter chips or property dropdown
**Then** filtering works exactly as before (server-side, same store methods)

### AC8 — No changes to work order CRUD or API

**Given** the refactored list view
**When** I create, edit, or delete work orders
**Then** all CRUD operations work unchanged
**And** no API endpoints or data model changes are needed

## Tasks / Subtasks

### Task 1: Refactor list template from card grid to enriched row list (AC: 1, 2, 3, 4)

> **Why:** The card grid (CSS `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` with `mat-card`) scatters data spatially. Rows create a consistent left-to-right reading flow enabling scanning and comparison.

**Modify:** `frontend/src/app/features/work-orders/work-orders.component.ts`

- [x] 1.1 Replace the `.work-orders-list` CSS grid container with a flex column list:
  ```scss
  .work-orders-list {
    display: flex;
    flex-direction: column;
    gap: 0; /* rows are flush, separated by borders */
  }
  ```

- [x] 1.2 Replace each `mat-card.work-order-card` with a `.work-order-row` div using this two-line structure:
  ```html
  @for (workOrder of store.workOrders(); track workOrder.id) {
    <div class="work-order-row" [class.expanded]="isExpanded(workOrder.id)">
      <!-- Row content (clickable → navigates to detail) -->
      <div class="row-content" [routerLink]="['/work-orders', workOrder.id]">
        <!-- Expand chevron -->
        <button class="expand-btn" mat-icon-button
          (click)="toggleExpand(workOrder.id, $event)">
          <mat-icon>{{ isExpanded(workOrder.id) ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>

        <!-- Line 1: Scan line -->
        <div class="line-1">
          <span class="status-chip" [ngClass]="'status-' + workOrder.status.toLowerCase()">
            {{ workOrder.status }}
          </span>
          <span class="wo-title">{{ workOrder.description }}</span>
          <span class="wo-assignee">
            <mat-icon class="inline-icon">{{ workOrder.isDiy ? 'person' : 'engineering' }}</mat-icon>
            {{ workOrder.isDiy ? 'DIY' : (workOrder.vendorName || 'Unassigned') }}
          </span>
          @if (workOrder.categoryName) {
            <span class="wo-category">{{ workOrder.categoryName }}</span>
          }
          <span class="wo-date">{{ workOrder.createdAt | date:'mediumDate' }}</span>
        </div>

        <!-- Line 2: Context line -->
        <div class="line-2">
          <span class="wo-property">
            <mat-icon class="inline-icon">home</mat-icon>
            {{ workOrder.propertyName }}
          </span>
          @if (!workOrder.isDiy && workOrder.vendorName) {
            <span class="wo-vendor">{{ workOrder.vendorName }}</span>
          }
          @if (workOrder.tags && workOrder.tags.length > 0) {
            <span class="wo-tags">
              @for (tag of workOrder.tags; track tag.id) {
                <mat-chip>{{ tag.name }}</mat-chip>
              }
            </span>
          }
        </div>
      </div>

      <!-- Action icons (stop propagation to prevent navigation) -->
      <div class="row-actions">
        <a mat-icon-button [routerLink]="['/work-orders', workOrder.id, 'edit']"
          (click)="$event.stopPropagation()" aria-label="Edit work order">
          <mat-icon>edit</mat-icon>
        </a>
        <button mat-icon-button (click)="confirmDelete(workOrder, $event)"
          aria-label="Delete work order">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>

    <!-- Expand panel (AC5) -->
    @if (isExpanded(workOrder.id)) {
      <div class="expand-panel">
        <div class="expand-content">
          <p class="full-description">{{ workOrder.description }}</p>
          @if (workOrder.primaryPhotoThumbnailUrl) {
            <img [src]="workOrder.primaryPhotoThumbnailUrl" alt="Work order photo"
              class="expand-thumbnail" loading="lazy" />
          }
        </div>
      </div>
    }
  }
  ```

- [x] 1.3 Replace the status badge CSS with status chip CSS (reuse existing color values):
  ```scss
  .status-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }
  /* Reuse existing color classes: .status-reported, .status-assigned, .status-completed */
  ```

- [x] 1.4 Add alternating row backgrounds:
  ```scss
  .work-order-row:nth-child(odd) {
    background-color: var(--mat-sys-surface);
  }
  .work-order-row:nth-child(even) {
    background-color: var(--mat-sys-surface-container-low);
  }
  ```

- [x] 1.5 Style the two-line row layout:
  ```scss
  .work-order-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--mat-sys-outline-variant);
    padding: 12px 16px;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .work-order-row:hover {
    background-color: var(--mat-sys-surface-container);
  }
  .row-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line-1, .line-2 {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .line-1 {
    font-weight: 500;
  }
  .line-2 {
    font-size: 0.875rem;
    color: var(--mat-sys-on-surface-variant);
  }
  .wo-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .inline-icon {
    font-size: 16px;
    height: 16px;
    width: 16px;
    vertical-align: middle;
  }
  .row-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .work-order-row:hover .row-actions {
    opacity: 1;
  }
  ```

- [x] 1.6 Remove all card-related CSS (`.work-orders-list` grid, `.work-order-card`, `.card-layout`, `.card-thumbnail`, `.card-content`, `.has-thumbnail`, `.description`, `.category`, `.assignee`, `.assignee-icon`, `.work-order-tags`, `.status-badge`, `.created-date`, `.date-icon`)

- [x] 1.7 Remove `MatCardModule` from component imports (no longer needed in list view). Keep all other imports. Add `MatDialogModule` if adding delete confirmation.

### Task 2: Add expand/collapse functionality (AC: 5)

> **Why:** The expand panel lets users peek at full details (description, photo) without navigating away — reduces context switching.

**Modify:** `frontend/src/app/features/work-orders/work-orders.component.ts` (component class)

- [x] 2.1 Add local expand state to the component class:
  ```typescript
  private expandedIds = new Set<string>();

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation(); // Prevent row click navigation
    event.preventDefault();
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }
  ```

- [x] 2.2 Style the expand panel:
  ```scss
  .expand-panel {
    padding: 16px 16px 16px 56px; /* indent past chevron column */
    background-color: var(--mat-sys-surface-container-lowest);
    border-bottom: 1px solid var(--mat-sys-outline-variant);
  }
  .expand-content {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .full-description {
    flex: 1;
    white-space: pre-wrap;
    line-height: 1.5;
  }
  .expand-thumbnail {
    max-width: 120px;
    max-height: 120px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid var(--mat-sys-outline-variant);
  }
  .expand-btn {
    flex-shrink: 0;
    margin-right: 8px;
  }
  ```

- [x] 2.3 Note: The expand panel shows data already available in `WorkOrderDto`. Linked expenses are NOT in the list DTO and would require an API enhancement — intentionally excluded per AC8 (no API changes). Can be added in a future story if needed.

### Task 3: Add delete confirmation from list (AC: 2)

> **Why:** The UX handoff specifies action icons (edit + delete) on each row. Edit navigates to edit page (link, no extra logic). Delete requires confirmation dialog using existing pattern.

**Modify:** `frontend/src/app/features/work-orders/work-orders.component.ts`

- [x] 3.1 Add `MatDialog` injection and delete confirmation method:
  ```typescript
  private readonly dialog = inject(MatDialog);

  confirmDelete(workOrder: WorkOrderDto, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete "${workOrder.description}"?`,
        message: 'This work order will be permanently removed.',
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.deleteWorkOrder(workOrder.id);
      }
    });
  }
  ```

- [x] 3.2 Add required imports:
  ```typescript
  import { MatDialog, MatDialogModule } from '@angular/material/dialog';
  import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
  import { WorkOrderDto } from './services/work-order.service';
  ```
  Add `MatDialogModule` and `ConfirmDialogComponent` to the component `imports` array.

- [x] 3.3 Note: The `store.deleteWorkOrder()` method already exists and handles soft delete + snackbar + list reload. No store changes needed.

### Task 4: Mobile responsive reflow (AC: 6)

> **Why:** The enriched row layout must degrade gracefully to a stacked card layout on mobile. The UX handoff specifies three breakpoints.

**Modify:** `frontend/src/app/features/work-orders/work-orders.component.ts` (styles section)

- [x] 4.1 Add medium breakpoint (768px-1200px) — drop category column:
  ```scss
  @media (max-width: 1200px) {
    .wo-category {
      display: none;
    }
  }
  ```

- [x] 4.2 Add mobile breakpoint (<768px) — stack into card layout:
  ```scss
  @media (max-width: 768px) {
    .work-order-row {
      flex-direction: column;
      align-items: flex-start;
      padding: 16px;
      gap: 8px;
    }
    .row-content {
      width: 100%;
    }
    .line-1, .line-2 {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .line-1 {
      /* Status chip + date on first line */
      flex-direction: row;
      justify-content: space-between;
      width: 100%;
    }
    .wo-title {
      width: 100%;
      white-space: normal; /* Allow wrapping on mobile */
      order: 2; /* Title below status row */
    }
    .wo-assignee, .wo-category {
      order: 3;
    }
    .wo-date {
      order: 1; /* Date next to status chip */
    }
    .row-actions {
      opacity: 1; /* Always visible on mobile (no hover) */
      align-self: flex-end;
    }
    .expand-btn {
      display: none; /* Hide expand on mobile — full info already visible */
    }
    .expand-panel {
      display: none;
    }
  }
  ```

### Task 5: Update unit tests (AC: all)

> **Why:** The template structure is changing significantly. Existing tests that query for `mat-card` elements will break.

**Modify:** `frontend/src/app/features/work-orders/work-orders.component.spec.ts`

- [x] 5.1 Update element selectors in existing tests:
  - Replace `mat-card.work-order-card` queries with `.work-order-row` queries
  - Replace card title queries with `.wo-title` queries
  - Replace `.status-badge` queries with `.status-chip` queries

- [x] 5.2 Add new tests for expand/collapse:
  ```typescript
  it('should toggle expand panel on chevron click', () => {
    // Setup: store has work orders
    // Act: click expand button on first row
    // Assert: expand panel is visible with description
    // Act: click expand button again
    // Assert: expand panel is hidden
  });

  it('should not navigate when clicking expand chevron', () => {
    // Assert: router.navigate was NOT called
  });
  ```

- [x] 5.3 Add tests for action icons:
  ```typescript
  it('should open confirm dialog on delete click', () => {
    // Click delete icon
    // Assert: MatDialog.open was called with ConfirmDialogComponent
  });

  it('should call store.deleteWorkOrder on confirm', () => {
    // Setup: dialog returns true
    // Assert: store.deleteWorkOrder called with correct id
  });
  ```

- [x] 5.4 Verify existing filter tests still pass (they test store methods, not template structure — should be unaffected)

- [x] 5.5 Run `npm test` from `/frontend` — all tests pass (NEVER use `npx vitest` directly)

### Task 6: Visual QA and regression verification (AC: 7, 8)

- [x] 6.1 Verify status filter chips still work (select/deselect, store reloads)
- [x] 6.2 Verify property dropdown filter still works
- [x] 6.3 Verify "Clear filters" button still works
- [x] 6.4 Verify empty states still display correctly (no work orders, no filter matches)
- [x] 6.5 Verify row click navigates to `/work-orders/:id` detail page
- [x] 6.6 Verify edit icon navigates to `/work-orders/:id/edit`
- [x] 6.7 Verify delete from list works (confirm dialog → soft delete → list refreshes)
- [x] 6.8 Verify "New Work Order" button still works

## Dev Notes

### Zero-Change Inventory (Don't Rebuild or Modify)

| Component / File | Path | What it does | Note |
|---|---|---|---|
| `WorkOrderStore` | `features/work-orders/stores/work-order.store.ts` | State management for list, detail, CRUD, tags, filters | NO CHANGES — same signals, same methods |
| `WorkOrderService` | `features/work-orders/services/work-order.service.ts` | HTTP calls + DTOs | NO CHANGES — same API calls |
| `WorkOrderDto` | `work-order.service.ts` lines 53-68 | List item data shape | NO CHANGES — all fields already available |
| Status chip CSS colors | Already in component | `.status-reported` (orange), `.status-assigned` (blue), `.status-completed` (green) | REUSE these exact color values in new `.status-chip` class |
| `ConfirmDialogComponent` | `shared/components/confirm-dialog/` | Delete confirmation dialog | REUSE for delete-from-list |
| `PropertyStore` | `features/properties/stores/property.store.ts` | Property list for filter dropdown | NO CHANGES — already loaded in `ngOnInit` |
| Filter section template | Lines 46-82 of current component | Status chips + property dropdown + clear button | KEEP AS-IS — only the list portion below changes |
| Empty states | Lines 84-113 of current component | Loading spinner, filtered empty, true empty | KEEP AS-IS |
| All work order page components | `pages/work-order-create/`, `pages/work-order-detail/`, `pages/work-order-edit/` | Create, detail, edit pages | DO NOT TOUCH |
| Work order form | `components/work-order-form/` | Create/edit form | DO NOT TOUCH |
| API endpoints | Backend | All work order endpoints | NO CHANGES (AC8) |

### Architecture Notes

**This is a template + CSS refactor only.** The component class gains:
1. `expandedIds: Set<string>` — local UI state for expand/collapse (no store change)
2. `isExpanded()` / `toggleExpand()` — simple Set operations
3. `confirmDelete()` — uses existing `store.deleteWorkOrder()` + `ConfirmDialogComponent`

**Why NOT `mat-table`:** The UX handoff explicitly says "Use a flex-based list layout, NOT `mat-table` — rows need two-line flexibility." `mat-table` enforces single-line cells and doesn't support the two-line row pattern.

**Why NOT a new child component:** The row template is tightly coupled to the list's filter state, routing, and store. Extracting to a child component would require passing 5+ inputs per row and event bindings. A single inline template is simpler and consistent with how the component works today.

**Expand panel data limitations:** The `WorkOrderDto` in the list endpoint does NOT include linked expenses. The expand panel shows `description` + `primaryPhotoThumbnailUrl` — both already in the DTO. Adding linked expenses to the expand panel would require either:
- Extending the list DTO (API change, violates AC8)
- Lazy-loading detail per row (store change, adds complexity)

This can be a follow-up story if needed.

### CSS Custom Properties Used

All theming uses `var(--mat-sys-*)` tokens (established in Story 8.5 and maintained since):
- `--mat-sys-surface` — primary background
- `--mat-sys-surface-container-low` — alternating row background
- `--mat-sys-surface-container` — hover state
- `--mat-sys-surface-container-lowest` — expand panel background
- `--mat-sys-outline-variant` — borders
- `--mat-sys-on-surface-variant` — secondary text
- `--mat-sys-warning-container` / `--mat-sys-on-warning-container` — Reported status
- `--mat-sys-primary-container` / `--mat-sys-on-primary-container` — Assigned status
- `--mat-sys-tertiary-container` / `--mat-sys-on-tertiary-container` — Completed status

### Project Structure Notes

Only ONE file changes: `frontend/src/app/features/work-orders/work-orders.component.ts`
Only ONE test file changes: `frontend/src/app/features/work-orders/work-orders.component.spec.ts`

No new files created. No files deleted. No shared components added. No store changes. No service changes. No API changes. No routing changes.

### Previous Story Intelligence (16-6 and 16-5)

Story 16-6 established:
- Shared `DateRangeFilterComponent` and `ListTotalDisplayComponent` — NOT needed for this story (work orders have no date filter or total)
- `setInput()` testing pattern for signal inputs in specs

Story 16-5 established:
- `var(--mat-sys-*)` CSS custom properties — use these, not hardcoded colors
- `data-testid` attributes on key interactive elements — consider adding to rows if E2E tests target them later
- All 2,424+ frontend tests passing as baseline

### Git Intelligence

Recent commits confirm stable main branch. Branch `feature/workorder-list-view-refactor` is current. UX planning materials already committed:
```
4f430bc workorder refactor planning material
0b14c07 Merge pull request #252 from daveharmswebdev/manual-testing
```

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- Modified: `work-orders.component.spec.ts`
  - Update selectors from `mat-card` to `.work-order-row`
  - Add expand/collapse tests
  - Add delete action test
  - Verify existing filter tests pass

**No backend tests needed** — zero backend changes.

**E2E consideration:** Existing E2E tests (if any) that target work order list elements will need selector updates. Check `frontend/e2e/tests/` for work order test files.

### References

- [Source: `_bmad-output/planning-artifacts/ux-handoff-work-orders-list-redesign.md` — Complete UX handoff with layout specs, breakpoints, and acceptance criteria]
- [Source: `_bmad-output/excalidraw-diagrams/wireframe-work-orders-enriched-row.excalidraw` — Visual wireframe reference]
- [Source: `features/work-orders/work-orders.component.ts` — Current component to refactor (422 lines)]
- [Source: `features/work-orders/stores/work-order.store.ts` — Store (no changes needed, already has deleteWorkOrder)]
- [Source: `features/work-orders/services/work-order.service.ts` lines 53-68 — WorkOrderDto shape]
- [Source: `shared/components/confirm-dialog/confirm-dialog.component.ts` — Reuse for delete-from-list]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — clean implementation with no unresolved issues.

### Completion Notes

- **Angular 21 compatibility**: Used `[class]` binding instead of `ngClass` (soft-deprecated in Angular 21). MatDialog is `providedIn: 'root'` so `MatDialogModule` was NOT added to component imports — this was a key discovery during testing.
- **TDD approach**: Wrote 19 new unit tests first (red), then implemented component changes (green). All 2484 tests passing (107 files).
- **E2E tests**: Created 10 E2E tests using `page.route()` API interception per CLAUDE.md guidance. New page object `WorkOrderListPage` follows project `BasePage` pattern.
- **Mobile CSS fix**: Initial mobile responsive layout used conflicting `flex-direction` rules. Fixed by using `flex-wrap: wrap` with `order` values and `flex-basis: 100%` for proper stacking at <768px breakpoint.
- **Zero-change inventory verified**: No changes to store, service, API, routing, or any other files outside the component and its spec.
- **Visual QA**: Desktop and mobile layouts verified via Playwright MCP screenshots. Expand/collapse, delete dialog, status chips, alternating rows, action icons all confirmed working.

### File List

**Modified:**
- `frontend/src/app/features/work-orders/work-orders.component.ts` — Template + CSS refactor from card grid to enriched row list, expand/collapse, delete confirmation
- `frontend/src/app/features/work-orders/work-orders.component.spec.ts` — Updated selectors, 19 new tests for rows, expand/collapse, delete, status chips, tags, vendor display

**Created:**
- `frontend/e2e/pages/work-order-list.page.ts` — Page object for work order list E2E tests
- `frontend/e2e/tests/work-orders/work-order-list.spec.ts` — 10 E2E tests with API interception

**Edited:**
- `frontend/e2e/fixtures/test-fixtures.ts` — Added WorkOrderListPage fixture registration
