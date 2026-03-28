# Story 11.4: View Linked Work Order on Expense

Status: done

## Story

As a **property owner**,
I want **to see work order context when viewing expenses and linked expenses when viewing work orders**,
So that **I understand the story behind every expense at tax time and know the total cost of every repair**.

**Combined Scope:** This story merges original stories 11-4 (FR33) and 11-5 (FR34). FR34 was already implemented in Story 11-3 -- this story formally covers it and implements the remaining FR33 work.

## Acceptance Criteria

### AC #1: Work Order Context Sub-line on Expense Row (Property Workspace)

**Given** I am viewing the expense list in the property expense workspace
**When** an expense is linked to a work order
**Then** I see a small work order context line below the description showing:
- A colored status chip (Reported=warn, Assigned=primary, Completed=tertiary)
- The work order description (truncated to ~50 chars)
**And** the entire context line is clickable and navigates to `/work-orders/:workOrderId`

### AC #2: Clickable Work Order Indicator Icon

**Given** I am viewing an expense row in the property workspace
**When** the expense has a linked work order
**Then** the existing `assignment` icon becomes clickable
**And** clicking it navigates to the work order detail page (`/work-orders/:workOrderId`)
**And** the tooltip shows the work order description (instead of generic "Linked to work order")
**And** clicking the icon does NOT trigger the row edit action

### AC #3: Work Orders Pre-loaded for Expense Context

**Given** I navigate to the expense workspace for a property
**When** the workspace loads
**Then** work orders for this property are loaded in the background
**And** work order data (description, status) is available for each expense row to display
**And** if work order loading fails, expense rows fall back to the existing generic icon behavior

### AC #4: Work Order Indicator on All-Expenses List

**Given** I am viewing the all-expenses list at `/expenses`
**When** an expense is linked to a work order
**Then** I see a small `assignment` icon indicator on that row
**And** the icon is clickable and navigates to the work order detail page
**And** clicking the icon does NOT trigger row navigation to the expense workspace

### AC #5: FR34 - View Linked Expenses on Work Order (Already Complete)

**Given** I am on a work order detail page
**When** the page loads
**Then** I see a "Linked Expenses" section showing date, description, category, amount for each linked expense
**And** I see the total of all linked expenses
**And** I can link/unlink expenses
**Note:** This was fully implemented in Story 11-3. No additional work required.

## Tasks / Subtasks

### Task 1: Load Work Orders in Expense Workspace (AC: #3)

- [x] 1.1 Inject `WorkOrderService` in `expense-workspace.component.ts`
- [x] 1.2 Add signals for work order data:
  ```typescript
  protected readonly workOrderMap = signal<Record<string, WorkOrderDto>>({});
  ```
- [x] 1.3 In `loadProperty()` success handler, after loading expenses, call `loadWorkOrders(propertyId)`:
  ```typescript
  private loadWorkOrders(propertyId: string): void {
    this.workOrderService.getWorkOrdersByProperty(propertyId).subscribe({
      next: (response) => {
        const map: Record<string, WorkOrderDto> = {};
        response.items.forEach(wo => map[wo.id] = wo);
        this.workOrderMap.set(map);
      },
      error: () => {
        // Silent fail - expense rows fall back to generic icon behavior
        this.workOrderMap.set({});
      },
    });
  }
  ```
- [x] 1.4 Pass work order data to each `app-expense-row` via new input:
  ```html
  <app-expense-row
    [expense]="expense"
    [workOrder]="workOrderMap()[expense.workOrderId ?? '']"
    (edit)="onEditExpense($event)"
    (delete)="onDeleteExpense($event)"
  />
  ```
- [x] 1.5 Add import for `WorkOrderService` and `WorkOrderDto`:
  ```typescript
  import { WorkOrderService, WorkOrderDto } from '../../work-orders/services/work-order.service';
  ```

### Task 2: Enhance Expense Row with Work Order Context (AC: #1, #2)

- [x] 2.1 Add optional `workOrder` input to `expense-row.component.ts`:
  ```typescript
  workOrder = input<WorkOrderDto | undefined>();
  ```
- [x] 2.2 Add `Router` injection and `RouterModule` import for navigation:
  ```typescript
  private readonly router = inject(Router);
  ```
  Add `RouterModule` to component imports array.
- [x] 2.3 Update the existing work order indicator icon to be clickable with dynamic tooltip:
  ```html
  @if (expense().workOrderId) {
    <mat-icon
      class="work-order-indicator clickable"
      [matTooltip]="workOrder()?.description || 'Linked to work order'"
      data-testid="work-order-indicator"
      (click)="navigateToWorkOrder($event)"
    >assignment</mat-icon>
  }
  ```
- [x] 2.4 Add work order context sub-line below the description row:
  ```html
  @if (workOrder(); as wo) {
    <div class="work-order-context" (click)="navigateToWorkOrder($event)" data-testid="work-order-context">
      <span class="wo-status-chip" [attr.data-status]="wo.status">{{ wo.status }}</span>
      <span class="wo-description">{{ truncateWoDescription(wo.description) }}</span>
      <mat-icon class="wo-link-icon">open_in_new</mat-icon>
    </div>
  }
  ```
  Place this inside `.expense-details` div, after the `.expense-category` chip-set.
- [x] 2.5 Add `navigateToWorkOrder` method:
  ```typescript
  protected navigateToWorkOrder(event: Event): void {
    event.stopPropagation(); // Prevent triggering edit
    const workOrderId = this.expense().workOrderId;
    if (workOrderId) {
      this.router.navigate(['/work-orders', workOrderId]);
    }
  }
  ```
- [x] 2.6 Add `truncateWoDescription` helper:
  ```typescript
  protected truncateWoDescription(description: string): string {
    const maxLength = 50;
    return description.length > maxLength
      ? description.substring(0, maxLength) + '...'
      : description;
  }
  ```
- [x] 2.7 Add styles for work order context sub-line:
  ```scss
  .work-order-indicator.clickable {
    cursor: pointer;
    transition: color 0.2s ease;
    &:hover {
      color: var(--mat-sys-primary);
    }
  }

  .work-order-context {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8em;
    color: var(--mat-sys-on-surface-variant);
    cursor: pointer;
    padding: 2px 0;
    transition: color 0.2s ease;
    &:hover {
      color: var(--mat-sys-primary);
    }
  }

  .wo-status-chip {
    font-size: 0.75em;
    padding: 1px 8px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .wo-status-chip[data-status="Reported"] {
    background-color: var(--mat-sys-tertiary-container);
    color: var(--mat-sys-on-tertiary-container);
  }

  .wo-status-chip[data-status="Assigned"] {
    background-color: var(--mat-sys-primary-container);
    color: var(--mat-sys-on-primary-container);
  }

  .wo-status-chip[data-status="Completed"] {
    background-color: var(--mat-sys-secondary-container);
    color: var(--mat-sys-on-secondary-container);
  }

  .wo-description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wo-link-icon {
    font-size: 14px;
    width: 14px;
    height: 14px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .work-order-context:hover .wo-link-icon {
    opacity: 1;
  }
  ```

### Task 3: Add Work Order Indicator to Expense List Row (AC: #4)

- [x] 3.1 In `expense-list-row.component.ts`, add `Router` injection (already injected)
- [x] 3.2 Add a work order indicator column in the template, between receipt and amount columns:
  ```html
  <!-- Work Order Indicator (AC-11.4.4) -->
  <div class="expense-work-order">
    @if (expense().workOrderId) {
      <mat-icon
        matTooltip="Linked to work order"
        class="work-order-link"
        (click)="navigateToWorkOrder($event)"
        data-testid="work-order-indicator"
      >assignment</mat-icon>
    }
  </div>
  ```
- [x] 3.3 Update the grid template columns to include work order indicator:
  ```scss
  .expense-list-row {
    grid-template-columns: 100px 150px 1fr auto 40px 40px 100px;
    // Added one 40px column for work order indicator between receipt and amount
  }
  ```
- [x] 3.4 Add `navigateToWorkOrder` method:
  ```typescript
  navigateToWorkOrder(event: Event): void {
    event.stopPropagation(); // Prevent row click navigation
    const workOrderId = this.expense().workOrderId;
    if (workOrderId) {
      this.router.navigate(['/work-orders', workOrderId]);
    }
  }
  ```
- [x] 3.5 Add styles for work order indicator:
  ```scss
  .expense-work-order {
    display: flex;
    align-items: center;
    justify-content: center;

    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mat-sys-on-surface-variant);
    }

    .work-order-link {
      cursor: pointer;
      transition: color 0.2s ease;
      &:hover {
        color: var(--mat-sys-primary);
      }
    }
  }
  ```
- [x] 3.6 Update mobile responsive styles to hide work order indicator (same as receipt):
  ```scss
  @media (max-width: 768px) {
    .expense-work-order {
      display: none;
    }
  }
  ```

### Task 4: Frontend Unit Tests (AC: ALL)

- [x] 4.1 Test `expense-workspace.component.spec.ts`:
  - Loads work orders for property on init
  - Creates workOrderMap from loaded work orders
  - Passes workOrder to expense-row components
  - Handles work order loading failure gracefully

- [x] 4.2 Test `expense-row.component.spec.ts`:
  - Shows work order context sub-line when workOrder input provided
  - Hides work order context when no workOrder input
  - Status chip shows correct status text
  - WO description truncated at 50 chars
  - Clicking indicator navigates to work order detail
  - Clicking context line navigates to work order detail
  - Click events do NOT propagate (stopPropagation)
  - Tooltip shows WO description when available
  - Tooltip falls back to "Linked to work order" when workOrder input not provided
  - Icon still shows when workOrderId exists but workOrder input is undefined (graceful fallback)

- [x] 4.3 Test `expense-list-row.component.spec.ts`:
  - Shows work order icon when workOrderId exists
  - Hides work order icon when no workOrderId
  - Clicking icon navigates to work order detail
  - Click event does NOT propagate to row click handler
  - Icon has correct tooltip

### Task 5: Verify FR34 Completeness from Story 11-3 (AC: #5)

- [x] 5.1 Confirm in `work-order-detail.component.ts` that linked expenses section exists with:
  - Expense list showing date, description, category, amount
  - Total row
  - Empty state
  - Link/unlink functionality
- [x] 5.2 Document FR34 as complete (no code changes needed)

## Dev Notes

### Architecture: Frontend-Only Story

All backend work was completed in Story 11-1. This story is **100% frontend work**. No backend changes, no migrations, no API client regeneration needed.

### Critical: Two Different Expense Row Components

The project has TWO expense row components for different contexts:

| Component | Location | Used In | Current WO Support |
|-----------|----------|---------|-------------------|
| `ExpenseRowComponent` | `expenses/components/expense-row/` | Property expense workspace (`/properties/:id/expenses`) | Icon indicator only |
| `ExpenseListRowComponent` | `expenses/components/expense-list-row/` | All-expenses list (`/expenses`) | None |

Both need work order indicators. Only `ExpenseRowComponent` gets the detailed WO context sub-line (because the workspace loads WOs for the property).

### Data Flow: Work Order Context

```
ExpenseWorkspaceComponent
  ├── loads property (existing)
  ├── loads expenses (existing via store)
  ├── loads work orders (NEW) → workOrderMap signal
  │
  └── ExpenseRowComponent (per expense)
        ├── expense input (existing)
        └── workOrder input (NEW) ← looked up from workOrderMap
```

The expense-list-row does NOT get work order details -- it only gets `workOrderId` from `ExpenseListItemDto` and shows a generic icon with navigation.

### Existing Services to Reuse

| Service | Method | Purpose |
|---------|--------|---------|
| `WorkOrderService` | `getWorkOrdersByProperty(propertyId)` | Load all WOs for property (for expense row context) |
| `WorkOrderService` | `getWorkOrder(id)` | NOT USED -- prefer batch load via getWorkOrdersByProperty |

**DO NOT** create new services or endpoints. Everything needed already exists.

### Component Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts` | Load work orders, pass to rows |
| `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` | Add workOrder input, context sub-line, clickable navigation |
| `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` | Add WO indicator icon with navigation |

### Pattern: Follow Existing Receipt Indicator

The receipt indicator in `expense-row.component.ts` (lines 54-61) is the exact pattern for clickable icons:
```html
@if (expense().receiptId) {
  <mat-icon
    class="receipt-indicator"
    matTooltip="View receipt"
    (click)="viewReceipt($event)"
    data-testid="receipt-indicator"
  >receipt</mat-icon>
}
```

Follow this pattern for the clickable work order indicator and add `event.stopPropagation()` in the handler.

### Status Chip Styling

The work order detail page uses colored status badges. Match those colors for the status chip on the expense row context line. Use `data-status` attribute for CSS targeting (avoids dynamic class binding complexity).

### Navigation: Work Order Detail Route

Work order detail pages are at `/work-orders/:id`. Use `Router.navigate(['/work-orders', workOrderId])` for programmatic navigation. Do NOT use `routerLink` directive since these are click handlers on non-anchor elements.

### WorkOrderDto Shape (from work-order.service.ts)

```typescript
interface WorkOrderDto {
  id: string;
  propertyId: string;
  propertyName: string;
  vendorId?: string;
  vendorName?: string;
  isDiy: boolean;
  categoryId?: string;
  categoryName?: string;
  status: string;  // Reported, Assigned, Completed
  description: string;
  createdAt: string;
  createdByUserId: string;
  tags: WorkOrderTagDto[];
  primaryPhotoThumbnailUrl?: string;
}
```

### ExpenseListItemDto Shape (from expense.service.ts)

```typescript
export interface ExpenseListItemDto {
  id: string;
  propertyId: string;
  propertyName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  date: string;
  description?: string;
  receiptId?: string;
  workOrderId?: string;  // Available for indicator
  createdAt: string;
}
```

### Import Requirements

Expense workspace:
```typescript
import { WorkOrderService, WorkOrderDto } from '../../work-orders/services/work-order.service';
```

Expense row (add if not present):
```typescript
import { Router, RouterModule } from '@angular/router';
import { WorkOrderDto } from '../../../work-orders/services/work-order.service';
```

### Previous Story Intelligence (11.3)

From Story 11.3 implementation:
- Frontend: 2,165 tests pass (2,130 base + 35 from 11.2/11.3), 0 failures
- `workOrderId` exists on all expense DTOs
- `WorkOrderService.getWorkOrdersByProperty()` already exists and is used by expense forms
- Components use inline templates (backtick strings), standalone, new control flow (`@if`, `@for`)
- The work order detail page already has the complete linked expenses section (FR34)
- The link-expense-dialog component exists for linking from WO side
- `MatSelectModule` already imported in expense form components

### Git Intelligence

Recent commits:
- `e0bf147` - Merge PR #179: Story 11.3 link work order to expense
- `f507713` - fix(review): Address code review findings for Story 11.3
- `abb7d9d` - feat(work-orders): Add linked expenses section to work order detail (Story 11.3)
- `415b9d3` - Merge PR #178: Story 11.2 link expense to work order
- `30876d6` - fix(review): Address code review findings for Story 11.2

### Testing Standards

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` -- orphaned workers)
- Co-located `.spec.ts` files
- Mock services using `vi.fn()` and `of()` for Observable returns
- Use `TestBed.configureTestingModule()` with mock providers
- Mock `Router.navigate()` to verify navigation calls

**Pattern for mocking WorkOrderService:**
```typescript
const mockWorkOrderService = {
  getWorkOrdersByProperty: vi.fn().mockReturnValue(of({
    items: [
      { id: 'wo-1', description: 'Fix plumbing leak', status: 'Assigned', propertyId: 'prop-1', propertyName: 'Test Property', isDiy: false, createdAt: '2026-01-15', createdByUserId: 'user-1', tags: [] },
    ],
    totalCount: 1,
  })),
};
```

**Pattern for mocking Router:**
```typescript
const mockRouter = { navigate: vi.fn() };
// Provide as: { provide: Router, useValue: mockRouter }
```

### Project Structure Notes

- Components use inline templates and styles (backtick strings, not separate files)
- All components are `standalone: true`
- Use new control flow: `@if`, `@for`, `@else`
- Signal stores use `signalStore()` from `@ngrx/signals`
- Material components imported individually
- `input()` and `input.required()` for component inputs (signal-based)

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.4] - View Linked Work Order on Expense (FR33)
- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.5] - View Linked Expenses on Work Order (FR34)
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: expense-row.component.ts] - Current expense row with basic WO indicator
- [Source: expense-list-row.component.ts] - All-expenses list row (no WO indicator yet)
- [Source: expense-workspace.component.ts] - Property expense workspace
- [Source: work-order.service.ts] - WorkOrderService with getWorkOrdersByProperty()
- [Source: 11-3-link-work-order-to-expense.md] - Story 11.3 completion (FR34 implemented)
- [Source: 11-2-link-expense-to-work-order.md] - Story 11.2 completion (basic WO indicator)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR33 | Users can view linked work order context when viewing an expense | WO context sub-line on expense row + clickable navigation to WO detail |
| FR34 | Users can view linked expenses when viewing a work order | Already implemented in Story 11-3 (linked expenses section on WO detail page) |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - clean implementation with no blocking issues.

### Completion Notes List

- All 5 tasks completed successfully
- 15 new unit tests added (2,165 base → 2,180 total), 0 failures
- FR33: Implemented - WO context sub-line on expense row + clickable navigation to WO detail
- FR34: Verified complete from Story 11-3 - linked expenses section on WO detail page
- No backend changes needed (frontend-only story)
- No new services or endpoints created (reused existing WorkOrderService.getWorkOrdersByProperty)
- Task 2.2 note: RouterModule import not needed because expense-row doesn't use routerLink directive; Router is injected for programmatic navigation

### File List

- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts` - Added WorkOrderService injection, workOrderMap signal, loadWorkOrders method, passes workOrder to expense-row
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.spec.ts` - Added WorkOrderService mock to all test suites, 3 new tests for WO loading + failure handling
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` - Added workOrder input, Router injection, clickable indicator with dynamic tooltip, WO context sub-line, navigateToWorkOrder, truncateWoDescription, styles
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.spec.ts` - Added Router mock, WorkOrderDto mock, 8 new tests for WO context/indicator/navigation
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` - Added WO indicator column, navigateToWorkOrder method, grid column update, responsive styles
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.spec.ts` - Added WO test fixtures, 4 new tests for indicator/navigation/stopPropagation
