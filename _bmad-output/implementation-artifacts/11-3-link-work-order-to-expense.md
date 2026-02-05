# Story 11.3: Link Work Order to Expense

Status: done

## Story

As a **property owner**,
I want **to link an existing expense to a work order from the work order detail page**,
So that **I can attach receipts and costs I've already recorded and see the total cost of a repair**.

## Acceptance Criteria

### AC #1: Display Linked Expenses on Work Order Detail Page

**Given** I am on a work order detail page
**When** the page loads
**Then** I see a "Linked Expenses" section showing a list of linked expenses
**And** each expense shows: date, description, category name, and amount (formatted as currency)
**And** expenses are sorted by date (newest first)
**And** I see a total at the bottom: "Total: $X,XXX.XX"

### AC #2: Empty State for Linked Expenses

**Given** I am on a work order detail page with no linked expenses
**When** the page loads
**Then** I see "No expenses linked yet"
**And** I see a "Link Existing Expense" button

### AC #3: Link Existing Expense Button

**Given** I am on a work order detail page (with or without existing linked expenses)
**When** I view the Linked Expenses section
**Then** I see a "Link Existing Expense" button

### AC #4: Expense Selector Dialog

**Given** I click "Link Existing Expense"
**When** the selector dialog opens
**Then** I see a list of expenses for this work order's property
**And** only expenses with NO existing work order link are shown (workOrderId is null)
**And** each expense shows: date, description, category, amount
**And** expenses are sorted by date (newest first)

### AC #5: Search/Filter in Expense Selector

**Given** the expense selector dialog is open
**When** I type in the search field
**Then** the expense list filters to show matching expenses (by description)

### AC #6: Link an Expense

**Given** I select an expense in the selector dialog
**When** I confirm the selection
**Then** the expense's `workOrderId` is updated to this work order's ID
**And** I see snackbar "Expense linked"
**And** the expense appears in the Linked Expenses list
**And** the total updates to include the new expense

### AC #7: Unlink an Expense

**Given** I am viewing linked expenses on a work order detail page
**When** I click the "Unlink" action on an expense row
**Then** I see a brief confirmation (or it unlinks immediately with undo snackbar)
**And** the expense's `workOrderId` is set to null
**And** the expense disappears from the linked list
**And** the total updates
**And** the expense is NOT deleted, just unlinked

### AC #8: Empty Selector State

**Given** I click "Link Existing Expense"
**When** all expenses for this property are already linked to work orders
**Then** I see "No unlinked expenses available for this property"
**And** the dialog shows a close/cancel button

## Tasks / Subtasks

### Task 1: Add Work Order Expenses Service Method and DTO (AC: #1, #2)

- [x] 1.1 Add `WorkOrderExpenseItemDto` interface to `work-order.service.ts`:
  ```typescript
  export interface WorkOrderExpenseItemDto {
    id: string;
    date: string;
    description: string | null;
    categoryName: string;
    amount: number;
  }
  export interface WorkOrderExpensesResponse {
    items: WorkOrderExpenseItemDto[];
    totalCount: number;
  }
  ```
- [x] 1.2 Add `getWorkOrderExpenses(workOrderId: string)` method to `WorkOrderService`:
  ```typescript
  getWorkOrderExpenses(workOrderId: string): Observable<WorkOrderExpensesResponse> {
    return this.http.get<WorkOrderExpensesResponse>(`${this.baseUrl}/${workOrderId}/expenses`);
  }
  ```
  Base URL is already `/api/v1/work-orders` in this service.

### Task 2: Add Linked Expenses State to Work Order Detail Component (AC: #1, #2)

- [x] 2.1 Add signals in `work-order-detail.component.ts`:
  ```typescript
  linkedExpenses = signal<WorkOrderExpenseItemDto[]>([]);
  isLoadingExpenses = signal(false);
  expensesTotal = computed(() =>
    this.linkedExpenses().reduce((sum, e) => sum + e.amount, 0)
  );
  ```
- [x] 2.2 Inject `WorkOrderService` (if not already injected) and `ExpenseService`
- [x] 2.3 Add `loadLinkedExpenses(workOrderId: string)` method:
  ```typescript
  private loadLinkedExpenses(workOrderId: string): void {
    this.isLoadingExpenses.set(true);
    this.workOrderService.getWorkOrderExpenses(workOrderId).subscribe({
      next: (response) => {
        this.linkedExpenses.set(response.items);
        this.isLoadingExpenses.set(false);
      },
      error: () => this.isLoadingExpenses.set(false),
    });
  }
  ```
- [x] 2.4 Call `loadLinkedExpenses()` in `ngOnInit()` alongside existing photo/note loading

### Task 3: Replace Linked Expenses Placeholder with Functional UI (AC: #1, #2, #3, #7)

- [x] 3.1 Replace the existing placeholder `mat-card` (the one with `receipt_long` icon and "No expenses linked") with a functional section:
  - Header: "Linked Expenses" with "Link Existing Expense" button (mat-icon-button or text button)
  - Loading spinner while `isLoadingExpenses()` is true
  - Empty state when `linkedExpenses().length === 0`
  - Expense list when expenses exist
- [x] 3.2 For each linked expense row, display:
  - Date (formatted, e.g., `date | date:'mediumDate'`)
  - Description (or "No description")
  - Category name
  - Amount (formatted as `amount | currency:'USD'`)
  - Unlink icon button (`link_off` icon) with tooltip "Unlink expense"
- [x] 3.3 Add total row at bottom: `"Total: {{ expensesTotal() | currency:'USD' }}"`
- [x] 3.4 Add `MatTableModule` or use simple `@for` loop with flex/grid layout (follow existing patterns — the notes section uses `@for` with `mat-list`, follow that pattern)
- [x] 3.5 Import `MatButtonModule`, `MatIconModule`, `MatTooltipModule` if not already imported
- [x] 3.6 Each expense row should link to the expense detail. Use `routerLink` to navigate: `/properties/{{workOrder.propertyId}}/expenses` (the expense workspace). Or simply make the row a clickable link. Follow whichever navigation pattern exists.

### Task 4: Create Expense Selector Dialog Component (AC: #4, #5, #6, #8)

- [x] 4.1 Create new component: `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.ts`
  - Standalone component
  - Inject `MAT_DIALOG_DATA` to receive `{ propertyId: string, workOrderId: string }`
  - Inject `ExpenseService` to load expenses
  - Inject `MatDialogRef` to close dialog with result
- [x] 4.2 On init, load expenses for the property using `ExpenseService.getExpensesByProperty(propertyId)` (no year filter to get all years, large pageSize to get all):
  ```typescript
  this.expenseService.getExpensesByProperty(this.data.propertyId, undefined, 1, 500).subscribe(...)
  ```
  Filter out expenses where `workOrderId` is not null/undefined (already linked to any work order).
- [x] 4.3 Add search field to filter by description (client-side filter on the loaded list)
- [x] 4.4 Display each expense as a selectable row: date, description, category, amount
- [x] 4.5 On row click, close dialog returning the selected expense ID:
  ```typescript
  selectExpense(expenseId: string): void {
    this.dialogRef.close(expenseId);
  }
  ```
- [x] 4.6 Add "Cancel" button to close dialog without selection
- [x] 4.7 Show empty state if no unlinked expenses available
- [x] 4.8 Use `MatDialogModule`, `MatFormFieldModule`, `MatInputModule`, `MatListModule` for UI

### Task 5: Implement Link and Unlink Actions (AC: #6, #7)

- [x] 5.1 Add `openLinkExpenseDialog()` method to `work-order-detail.component.ts`:
  ```typescript
  openLinkExpenseDialog(): void {
    const dialogRef = this.dialog.open(LinkExpenseDialogComponent, {
      width: '500px',
      data: {
        propertyId: this.store.selectedWorkOrder()!.propertyId,
        workOrderId: this.workOrderId,
      },
    });
    dialogRef.afterClosed().subscribe((expenseId: string | undefined) => {
      if (expenseId) {
        this.linkExpense(expenseId);
      }
    });
  }
  ```
- [x] 5.2 Add `linkExpense(expenseId: string)` method — calls `ExpenseService.updateExpense(expenseId, { workOrderId: this.workOrderId })` then reloads linked expenses:
  ```typescript
  private linkExpense(expenseId: string): void {
    // We need the current expense data to build the update request
    this.expenseService.getExpense(expenseId).subscribe({
      next: (expense) => {
        const updateRequest: UpdateExpenseRequest = {
          propertyId: expense.propertyId,
          amount: expense.amount,
          date: expense.date,
          categoryId: expense.categoryId,
          description: expense.description,
          workOrderId: this.workOrderId,
        };
        this.expenseService.updateExpense(expenseId, updateRequest).subscribe({
          next: () => {
            this.snackBar.open('Expense linked', 'Close', { duration: 3000 });
            this.loadLinkedExpenses(this.workOrderId);
          },
          error: () => {
            this.snackBar.open('Failed to link expense', 'Close', { duration: 3000 });
          },
        });
      },
    });
  }
  ```
  **NOTE:** The `updateExpense` PUT endpoint requires ALL fields (propertyId, amount, date, categoryId, description, workOrderId). You MUST fetch the existing expense first to get its current field values, then patch in the new `workOrderId`. Do NOT send a partial update — the backend will validation-fail.
- [x] 5.3 Add `unlinkExpense(expenseId: string)` method — same pattern but sets `workOrderId` to `undefined`:
  ```typescript
  unlinkExpense(expenseId: string): void {
    this.expenseService.getExpense(expenseId).subscribe({
      next: (expense) => {
        const updateRequest: UpdateExpenseRequest = {
          propertyId: expense.propertyId,
          amount: expense.amount,
          date: expense.date,
          categoryId: expense.categoryId,
          description: expense.description,
          workOrderId: undefined, // Unlink
        };
        this.expenseService.updateExpense(expenseId, updateRequest).subscribe({
          next: () => {
            this.snackBar.open('Expense unlinked', 'Close', { duration: 3000 });
            this.loadLinkedExpenses(this.workOrderId);
          },
          error: () => {
            this.snackBar.open('Failed to unlink expense', 'Close', { duration: 3000 });
          },
        });
      },
    });
  }
  ```
- [x] 5.4 Inject `MatDialog` and `MatSnackBar` in work-order-detail component (if not already)
- [x] 5.5 Wire "Link Existing Expense" button to `openLinkExpenseDialog()`
- [x] 5.6 Wire "Unlink" icon button on each expense row to `unlinkExpense(expense.id)`

### Task 6: Frontend Unit Tests (AC: ALL)

- [x] 6.1 Test `work-order.service.ts` — new `getWorkOrderExpenses` method:
  - Returns expenses for a work order
  - Calls correct API endpoint

- [x] 6.2 Test `link-expense-dialog.component.ts`:
  - Loads expenses for property on init
  - Filters out already-linked expenses
  - Search filters by description
  - Selecting an expense closes dialog with expense ID
  - Cancel closes dialog without result
  - Empty state shown when no unlinked expenses

- [x] 6.3 Test `work-order-detail.component.ts` — linked expenses section:
  - Loads linked expenses on init
  - Displays expense list with date, description, category, amount
  - Shows total
  - Shows empty state when no expenses
  - "Link Existing Expense" button opens dialog
  - Successful link reloads expenses and shows snackbar
  - Unlink calls update and reloads expenses
  - Shows loading spinner while expenses load

## Dev Notes

### Architecture: Frontend-Only Story

Story 11.1 completed ALL backend work needed:
- `WorkOrderId` nullable FK on Expense entity
- `GET /api/v1/work-orders/{id}/expenses` endpoint (returns `WorkOrderExpensesResponse`)
- `PUT /api/v1/expenses/{id}` accepts `workOrderId` to link/unlink
- Property isolation validation (expense & work order must be same property)

**This story is 100% frontend work.** No backend changes, no migrations, no API client regeneration needed.

### Backend Endpoints to Use (Already Exist)

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `GET /api/v1/work-orders/{id}/expenses` | Fetch linked expenses | Task 1, 2 |
| `GET /api/v1/properties/{id}/expenses` | Fetch expenses for property (for selector) | Task 4 |
| `GET /api/v1/expenses/{id}` | Get single expense (for building update request) | Task 5 |
| `PUT /api/v1/expenses/{id}` | Update expense workOrderId (link/unlink) | Task 5 |

**DO NOT** create new backend endpoints. Everything needed already exists.

### Backend Response: GET /api/v1/work-orders/{id}/expenses

```json
{
  "items": [
    {
      "id": "guid",
      "date": "2026-01-15",
      "description": "Home Depot - Faucet parts",
      "categoryName": "Repairs",
      "amount": 125.50
    }
  ],
  "totalCount": 1
}
```

### Critical: PUT Expense Requires Full Payload

The `PUT /api/v1/expenses/{id}` endpoint requires ALL fields (propertyId, amount, date, categoryId, description, workOrderId). It is NOT a PATCH — sending only `workOrderId` will fail validation. You MUST:
1. Fetch the existing expense via `GET /api/v1/expenses/{id}`
2. Build a complete `UpdateExpenseRequest` with all existing fields
3. Override only `workOrderId`

### Component Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/features/work-orders/services/work-order.service.ts` | Add `getWorkOrderExpenses()` method + DTOs |
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` | Replace placeholder, add linked expenses logic, dialog integration |
| **NEW** `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.ts` | Expense selector dialog |

### Existing Services to Reuse

| Service | Method | Purpose |
|---------|--------|---------|
| `WorkOrderService` | `getWorkOrderExpenses(workOrderId)` | NEW — fetch linked expenses |
| `ExpenseService` | `getExpensesByProperty(propertyId, year?, page?, pageSize?)` | Load expenses for selector dialog |
| `ExpenseService` | `getExpense(expenseId)` | Get full expense for building update |
| `ExpenseService` | `updateExpense(expenseId, request)` | Set/clear workOrderId |

### Existing Placeholder to Replace

In `work-order-detail.component.ts` (lines ~259-270), there is a static placeholder:
```html
<!-- Linked Expenses Placeholder -->
<mat-card class="section-card placeholder-section">
  <mat-card-header>
    <mat-card-title>Linked Expenses</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    <div class="empty-state">
      <mat-icon class="empty-icon">receipt_long</mat-icon>
      <p>No expenses linked</p>
    </div>
  </mat-card-content>
</mat-card>
```

Replace this entirely with the functional linked expenses section.

### UI Pattern: Follow Notes Section

The work order detail page already has a functional Notes section with:
- `@for` loop over items
- Loading spinner
- Empty state
- Add button in header
- `mat-card` wrapper

Follow the same visual pattern for linked expenses.

### Dialog Pattern: Follow Existing Confirm Dialogs

The project has `shared/components/confirm-dialog/`. For the expense selector, create a standalone dialog component following the same pattern but with a list selection instead of confirm/cancel.

### Import Requirements

Work order detail component will need (add if not already present):
```typescript
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService, UpdateExpenseRequest } from '../../../expenses/services/expense.service';
import { LinkExpenseDialogComponent } from '../../components/link-expense-dialog/link-expense-dialog.component';
import { WorkOrderExpenseItemDto } from '../../services/work-order.service';
```

Link expense dialog component:
```typescript
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ExpenseService, ExpenseListItemDto } from '../../../expenses/services/expense.service';
```

### Previous Story Intelligence (11.2)

From Story 11.2 implementation:
- Frontend: 2,146 tests pass (2,130 base + 16 new), 0 failures
- `workOrderId` already exists on all expense DTOs (`ExpenseDto`, `CreateExpenseRequest`, `UpdateExpenseRequest`, `ExpenseListItemDto`)
- `ExpenseStore.createExpense()` and `updateExpense()` already persist `workOrderId` in local state
- Work order dropdown on expense forms uses `WorkOrderService.getWorkOrdersByProperty(propertyId)`
- `MatSelectModule` already imported in expense form components
- Components use inline templates (backtick strings), standalone, new control flow (`@if`, `@for`)

### Git Intelligence

Recent commits:
- `415b9d3` - Merge PR #178: Story 11.2 link expense to work order
- `30876d6` - fix(review): Address code review findings for Story 11.2
- `f6ccc78` - feat(expenses): Add work order dropdown to expense forms (Story 11.2)
- `56d2510` - Merge PR #177: Story 11.1 expense-workorder relationship
- `95cc8cc` - feat(expenses): Add WorkOrderId FK to Expense entity (Story 11.1)

### Testing Standards

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` — orphaned workers)
- Co-located `.spec.ts` files
- Mock services using `vi.fn()` and `of()` for Observable returns
- Use `TestBed.configureTestingModule()` with mock providers
- For dialog testing, mock `MatDialog.open()` to return `afterClosed()` observable
- For snackbar testing, mock `MatSnackBar.open()`

**Pattern for mocking dialog:**
```typescript
const mockDialogRef = { afterClosed: () => of('selected-expense-id') };
const mockDialog = { open: vi.fn().mockReturnValue(mockDialogRef) };
```

**Pattern for mocking services:**
```typescript
const mockWorkOrderService = {
  getWorkOrderExpenses: vi.fn().mockReturnValue(of({
    items: [
      { id: 'exp-1', date: '2026-01-15', description: 'Faucet repair', categoryName: 'Repairs', amount: 125.50 },
    ],
    totalCount: 1,
  })),
};
const mockExpenseService = {
  getExpensesByProperty: vi.fn().mockReturnValue(of({
    items: [...],
    totalCount: 5,
    page: 1,
    pageSize: 500,
    totalPages: 1,
  })),
  getExpense: vi.fn().mockReturnValue(of({...fullExpenseDto})),
  updateExpense: vi.fn().mockReturnValue(of(undefined)),
};
```

### Project Structure Notes

- Components use inline templates and styles (backtick strings, not separate files)
- All components are `standalone: true`
- Use new control flow: `@if`, `@for`, `@else`
- Signal stores use `signalStore()` from `@ngrx/signals`
- Material components imported individually
- Dialog components go in `components/` folder under the feature

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.3] - Link Work Order to Expense requirements
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: architecture.md#API Extensions] - `GET /api/v1/work-orders/{id}/expenses` endpoint
- [Source: work-order-detail.component.ts] - Current detail page with placeholder
- [Source: work-order.service.ts] - Work order service (needs getWorkOrderExpenses added)
- [Source: expense.service.ts] - Expense service (getExpensesByProperty, getExpense, updateExpense)
- [Source: GetWorkOrderExpenses.cs] - Backend query returns WorkOrderExpenseItemDto
- [Source: 11-2-link-expense-to-work-order.md] - Previous story completion notes

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR30 | Users can link an existing work order to an expense | "Link Existing Expense" button + selector dialog on work order detail |
| FR34 | Users can view linked expenses when viewing a work order | Linked expenses list with date, description, category, amount, total |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 6 tasks completed — 100% frontend story, no backend changes
- `UpdateExpenseRequest` does NOT include `propertyId` (confirmed from existing interface) — link/unlink code correctly omits it
- Used `@for` loop pattern consistent with existing notes section (not mat-table)
- Dialog uses `mat-selection-list` for clickable expense rows with search filter
- Expenses sorted newest-first in both dialog and linked list
- 2,165 total frontend tests pass (2,130 base + 13 new for Story 11.3)

### File List

| File | Action |
|------|--------|
| `frontend/src/app/features/work-orders/services/work-order.service.ts` | Modified — added DTOs + `getWorkOrderExpenses()` |
| `frontend/src/app/features/work-orders/services/work-order.service.spec.ts` | Modified — added 2 tests for `getWorkOrderExpenses` |
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` | Modified — replaced placeholder, added state/methods for link/unlink |
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.spec.ts` | Modified — updated 2 existing tests, added 6 linked expenses tests |
| `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.ts` | **NEW** — expense selector dialog |
| `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.spec.ts` | **NEW** — 11 tests for dialog |
