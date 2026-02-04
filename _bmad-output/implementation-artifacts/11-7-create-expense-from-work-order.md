# Story 11.7: Create Expense from Work Order

Status: review-ready

## Story

As a **property owner**,
I want **to create an expense directly from a work order**,
So that **I can quickly log costs as they occur on a job without navigating away from the work order**.

## Acceptance Criteria

### AC #1: Create Expense Button on Work Order Detail Page

**Given** I am on a work order detail page
**When** I view the Linked Expenses section
**Then** I see a "Create Expense" button alongside the existing "Link Existing Expense" button
**And** the button has icon `add_circle` and text "Create Expense"

### AC #2: Create Expense Dialog with Pre-populated Fields

**Given** I click "Create Expense" on the work order detail page
**When** the dialog opens
**Then** I see a dialog titled "Create Expense for Work Order"
**And** the property is displayed as a locked label (from the work order)
**And** the work order description is shown for context (read-only)
**And** the category is pre-selected if the work order has a category (editable)
**And** the date defaults to today (editable)
**And** the amount field is empty and required
**And** the description field is empty (optional)
**And** I see "Create" and "Cancel" buttons

### AC #3: Successful Expense Creation

**Given** I fill in at least the amount and category
**When** I click "Create"
**Then** the expense is created via `POST /api/v1/expenses` with `workOrderId` set
**And** I see snackbar "Expense created"
**And** the dialog closes
**And** the expense appears in the Linked Expenses list on the work order
**And** the linked expenses total updates to include the new amount

### AC #4: Cancel Without Creating

**Given** the Create Expense dialog is open
**When** I click "Cancel"
**Then** no expense is created
**And** the dialog closes

### AC #5: Validation

**Given** I am in the Create Expense dialog
**When** I leave the amount field empty or enter 0
**Then** I see validation error "Amount is required"
**And** the "Create" button is disabled until valid

**Given** I am in the Create Expense dialog
**When** I leave the category unselected
**Then** I see validation error "Category is required"

### AC #6: Error Handling

**Given** expense creation fails (network error or server error)
**When** the API returns an error
**Then** I see snackbar "Failed to create expense"
**And** the dialog remains open for retry

### AC #7: Multiple Expenses per Work Order

**Given** I just created an expense for this work order
**When** I click "Create Expense" again
**Then** the dialog opens fresh (no leftover data from previous submission)
**And** I can create another expense linked to the same work order

## Tasks / Subtasks

### Task 1: Create the Dialog Component (AC: #2, #4, #5)

- [x] 1.1 Create `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.ts`
  - Standalone component with inline template and styles
  - Inject `MAT_DIALOG_DATA` receiving `CreateExpenseFromWoDialogData`:
    ```typescript
    export interface CreateExpenseFromWoDialogData {
      workOrderId: string;
      propertyId: string;
      propertyName: string;
      categoryId?: string;
      workOrderDescription: string;
    }
    ```
  - Inject `MatDialogRef`, `FormBuilder`, `ExpenseService`, `MatSnackBar`
  - Import `ReactiveFormsModule`, `MatDialogModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatButtonModule`, `MatProgressSpinnerModule`, `MatDatepickerModule`

- [x] 1.2 Create the form with fields:
  ```typescript
  form = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date: [new Date().toISOString().split('T')[0], [Validators.required]],
    categoryId: [this.data.categoryId || '', [Validators.required]],
    description: [''],
  });
  ```

- [x] 1.3 Load categories on init using `ExpenseStore.loadCategories()` pattern:
  ```typescript
  private readonly expenseStore = inject(ExpenseStore);
  categories = this.expenseStore.sortedCategories;
  ```
  Call `this.expenseStore.loadCategories()` in constructor or `ngOnInit`.

- [x] 1.4 Add dialog template:
  ```html
  <h2 mat-dialog-title>Create Expense for Work Order</h2>
  <mat-dialog-content>
    <p class="property-label">Property: {{ data.propertyName }}</p>
    <p class="wo-context">Work Order: {{ data.workOrderDescription }}</p>
    <form [formGroup]="form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Amount</mat-label>
        <span matTextPrefix>$&nbsp;</span>
        <input matInput type="number" formControlName="amount" step="0.01" min="0.01">
        @if (form.controls.amount.hasError('required')) {
          <mat-error>Amount is required</mat-error>
        } @else if (form.controls.amount.hasError('min')) {
          <mat-error>Amount must be greater than 0</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Date</mat-label>
        <input matInput type="date" formControlName="date">
        @if (form.controls.date.hasError('required')) {
          <mat-error>Date is required</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Category</mat-label>
        <mat-select formControlName="categoryId">
          @for (cat of categories(); track cat.id) {
            <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
          }
        </mat-select>
        @if (form.controls.categoryId.hasError('required')) {
          <mat-error>Category is required</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description (optional)</mat-label>
        <textarea matInput formControlName="description" rows="2"></textarea>
      </mat-form-field>
    </form>
  </mat-dialog-content>
  <mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-flat-button color="primary"
      [disabled]="form.invalid || isSubmitting()"
      (click)="onSubmit()">
      @if (isSubmitting()) {
        <mat-spinner diameter="20"></mat-spinner>
      } @else {
        Create
      }
    </button>
  </mat-dialog-actions>
  ```

- [x] 1.5 Add styles:
  ```scss
  .full-width { width: 100%; }
  .property-label {
    font-size: 0.9em;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 4px;
  }
  .wo-context {
    font-size: 0.85em;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 16px;
    font-style: italic;
  }
  mat-dialog-content { min-width: 400px; }
  @media (max-width: 600px) {
    mat-dialog-content { min-width: unset; }
  }
  ```

### Task 2: Implement Create Expense Logic (AC: #3, #6)

- [x] 2.1 Add `isSubmitting` signal and `onSubmit()` method:
  ```typescript
  isSubmitting = signal(false);

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const createRequest: CreateExpenseRequest = {
      propertyId: this.data.propertyId,
      amount: this.form.value.amount!,
      date: this.form.value.date!,
      categoryId: this.form.value.categoryId!,
      description: this.form.value.description || undefined,
      workOrderId: this.data.workOrderId,
    };

    this.expenseService.createExpense(createRequest).subscribe({
      next: () => {
        this.snackBar.open('Expense created', 'Close', { duration: 3000 });
        this.dialogRef.close({ created: true });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Failed to create expense', 'Close', { duration: 3000 });
      },
    });
  }
  ```

- [x] 2.2 Define the dialog result interface:
  ```typescript
  export interface CreateExpenseFromWoDialogResult {
    created: boolean;
  }
  ```

### Task 3: Add Create Expense Button to Work Order Detail (AC: #1, #3, #7)

- [x] 3.1 In `work-order-detail.component.ts`, add a "Create Expense" button in the Linked Expenses header alongside the existing "Link Existing Expense" button:
  ```html
  <mat-card-header class="expenses-header">
    <mat-card-title>Linked Expenses</mat-card-title>
    <div class="expenses-actions">
      <button mat-stroked-button (click)="openCreateExpenseDialog()">
        <mat-icon>add_circle</mat-icon>
        Create Expense
      </button>
      <button mat-stroked-button (click)="openLinkExpenseDialog()" [disabled]="isLinkingExpense()">
        <mat-icon>add_link</mat-icon>
        Link Existing Expense
      </button>
    </div>
  </mat-card-header>
  ```

- [x] 3.2 Add the `openCreateExpenseDialog()` method:
  ```typescript
  openCreateExpenseDialog(): void {
    const wo = this.workOrder();
    if (!wo) return;

    const dialogRef = this.dialog.open(CreateExpenseFromWoDialogComponent, {
      width: '500px',
      data: {
        workOrderId: wo.id,
        propertyId: wo.propertyId,
        propertyName: wo.propertyName,
        categoryId: wo.categoryId,
        workOrderDescription: wo.description,
      } as CreateExpenseFromWoDialogData,
    });

    dialogRef.afterClosed().subscribe((result: CreateExpenseFromWoDialogResult | undefined) => {
      if (result?.created) {
        this.loadLinkedExpenses();
      }
    });
  }
  ```

- [x] 3.3 Add imports:
  ```typescript
  import { CreateExpenseFromWoDialogComponent, CreateExpenseFromWoDialogData, CreateExpenseFromWoDialogResult } from '../../expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component';
  ```

- [x] 3.4 Add `.expenses-actions` wrapper styles if not already present:
  ```scss
  .expenses-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  ```

### Task 4: Frontend Unit Tests (AC: ALL)

- [x] 4.1 Test `create-expense-from-wo-dialog.component.spec.ts`:
  - Dialog renders with property name displayed (not editable)
  - Dialog renders with work order description for context
  - Category pre-selected from work order data when provided
  - Date defaults to today
  - Amount field validates as required
  - Amount field validates min 0.01
  - Category field validates as required
  - "Create" button disabled when form invalid
  - "Create" button disabled during submission
  - Successful creation calls `expenseService.createExpense` with correct data including workOrderId
  - Shows "Expense created" snackbar on success
  - Shows "Failed to create expense" snackbar on error
  - Dialog stays open on error for retry
  - Cancel closes dialog without result
  - Dialog returns `{ created: true }` on success
  - Categories loaded from store

- [x] 4.2 Test `work-order-detail.component.spec.ts` (additions):
  - Shows "Create Expense" button in Linked Expenses section
  - `openCreateExpenseDialog()` opens dialog with correct data from work order
  - After dialog closes with `{ created: true }`, refreshes linked expenses
  - After dialog closes without result (cancel), no refresh

## Dev Notes

### Architecture: Frontend-Only Story

All backend work was completed in Story 11-1 (Expense-WorkOrder Relationship). This story is **100% frontend work**. No backend changes, no migrations, no API client regeneration needed.

The backend already supports:
- `POST /api/v1/expenses` — Create expense with `workOrderId` field (single API call!)
- `GET /api/v1/work-orders/{id}/expenses` — Get linked expenses (for refresh)

### Critical: Single API Call (Simpler than Story 11-6)

Unlike Story 11-6 (create WO from expense) which requires a two-step API sequence, this story uses a **single API call**. The `CreateExpenseRequest` already includes `workOrderId` as an optional field, so we set it at creation time. No fetch-then-update dance needed.

```
Story 11-6 flow: POST work-order → GET expense → PUT expense (3 calls, partial failure handling)
Story 11-7 flow: POST expense with workOrderId (1 call, simple error handling)
```

This makes the dialog significantly simpler — no partial failure states to handle.

### CreateExpenseRequest Shape (from expense.service.ts)

```typescript
export interface CreateExpenseRequest {
  propertyId: string;
  amount: number;
  date: string;          // ISO date string (YYYY-MM-DD)
  categoryId: string;
  description?: string;
  workOrderId?: string;  // Set this from dialog data
}
```

### Dialog vs Navigation Decision

**Dialog chosen** (not navigation to expense workspace) because:
- Keeps user in work order context
- Faster for logging multiple expenses against same work order
- Matches existing patterns (`link-expense-dialog`, `create-wo-from-expense-dialog`)
- Avoids complex query param state management

### Existing Services to Reuse

| Service | Method | Purpose |
|---------|--------|---------|
| `ExpenseService` | `createExpense(request)` | Create the expense with workOrderId |
| `ExpenseStore` | `loadCategories()` / `sortedCategories` | Populate category dropdown |
| `WorkOrderDetailComponent` | `loadLinkedExpenses()` | Refresh linked expenses after creation |

**DO NOT** create new services or API endpoints. Everything needed already exists.

### New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.ts` | Dialog for creating expense from work order |
| `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.spec.ts` | Unit tests |

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/features/work-orders/work-order-detail/work-order-detail.component.ts` | Add "Create Expense" button, dialog opener, refresh on success |
| `frontend/src/app/features/work-orders/work-order-detail/work-order-detail.component.spec.ts` | Add tests for create expense button and dialog |

### Pattern: Follow CreateWoFromExpenseDialogComponent (Reverse)

The `create-wo-from-expense-dialog.component.ts` (Story 11-6) is the reverse pattern. Key adaptations:
- **Simpler submit flow** — single API call instead of two-step
- **Amount field** — required numeric input (not present in WO creation)
- **Date field** — defaults to today, required (not present in WO creation)
- **No vendor/status fields** — expenses don't have these
- **workOrderId set at creation** — no separate linking step needed

### Pattern: Follow Existing Category Loading

Use `ExpenseStore.loadCategories()` and `sortedCategories` computed signal, which caches categories and sorts them. This is the same pattern used in `expense-form.component.ts`.

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
  status: string;
  description: string;
  createdAt: string;
  createdByUserId: string;
  tags: WorkOrderTagDto[];
  primaryPhotoThumbnailUrl?: string;
}
```

### Import Requirements

Dialog component:
```typescript
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService, CreateExpenseRequest } from '../../services/expense.service';
import { ExpenseStore } from '../../stores/expense.store';
```

Work order detail additions:
```typescript
import { CreateExpenseFromWoDialogComponent, CreateExpenseFromWoDialogData, CreateExpenseFromWoDialogResult } from '../../expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component';
```

### Previous Story Intelligence (11.6)

From Story 11.6 implementation:
- Frontend: 2,219 tests pass (2,180 base + 39 from 11.6), 0 failures
- `MatDialog` already injected in `work-order-detail.component.ts` (used by link-expense-dialog)
- Components use inline templates (backtick strings), standalone, `@if`/`@for` control flow
- Signal-based inputs: `input()` and `input.required()`
- Signal-based outputs: `output()`
- `signal()` for reactive state, `computed()` for derived state

### Git Intelligence

Recent commits:
- `d764105` - Merge PR #181: Story 11.6 create work order from expense
- `40343d5` - fix(review): Address code review findings for Story 11.6
- `edcd7d3` - feat(expenses): Add create work order from expense (Story 11.6)
- `99f71b8` - Merge PR #180: Story 11.4 view linked work order on expense
- `a044cf2` - fix(review): Address code review findings for Story 11.4

### Testing Standards

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` — orphaned workers)
- Co-located `.spec.ts` files
- Mock services using `vi.fn()` and `of()` for Observable returns
- Use `TestBed.configureTestingModule()` with mock providers
- Mock `MatDialog.open()` to return `afterClosed()` observable
- Mock `MatSnackBar.open()` to verify feedback messages

**Pattern for mocking ExpenseService:**
```typescript
const mockExpenseService = {
  createExpense: vi.fn().mockReturnValue(of({ id: 'new-exp-id' })),
};
```

**Pattern for mocking ExpenseStore:**
```typescript
const mockExpenseStore = {
  loadCategories: vi.fn(),
  sortedCategories: signal([
    { id: 'cat-1', name: 'Repairs', scheduleELine: 'Repairs', sortOrder: 1, parentId: null },
    { id: 'cat-2', name: 'Supplies', scheduleELine: 'Other', sortOrder: 2, parentId: null },
  ]),
};
```

**Pattern for mocking dialog:**
```typescript
const mockDialogRef = { afterClosed: () => of({ created: true }) };
const mockDialog = { open: vi.fn().mockReturnValue(mockDialogRef) };
```

### Project Structure Notes

- Components use inline templates and styles (backtick strings, not separate files)
- All components are `standalone: true`
- Use new control flow: `@if`, `@for`, `@else`
- Signal-based inputs: `input()` and `input.required()`
- Signal-based outputs: `output()`
- Material components imported individually
- Dialog components go in `components/` folder under the feature
- `signal()` for reactive state, `computed()` for derived state

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.7] - Create Expense from Work Order (FR32)
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: architecture.md#API Extensions] - Work order CRUD endpoints
- [Source: work-order-detail.component.ts] - Work order detail with linked expenses section
- [Source: expense.service.ts] - createExpense() with workOrderId support
- [Source: expense.store.ts] - loadCategories(), sortedCategories
- [Source: create-wo-from-expense-dialog.component.ts] - Reverse dialog pattern (Story 11.6)
- [Source: 11-6-create-work-order-from-expense.md] - Reverse story (WO from expense)
- [Source: 11-3-link-work-order-to-expense.md] - Linked expenses section on WO detail
- [Source: 11-1-expense-workorder-relationship.md] - Backend foundation (FK, endpoints)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR32 | Users can create expenses directly from work orders | "Create Expense" button on WO detail opens dialog, creates expense with workOrderId pre-set |
