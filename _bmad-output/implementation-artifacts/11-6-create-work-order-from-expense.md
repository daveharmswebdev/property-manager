# Story 11.6: Create Work Order from Expense

Status: done

## Story

As a **property owner**,
I want **to create a work order retroactively from an expense that has no linked work order**,
So that **I can organize past expenses into work orders for better tracking and understand the story behind every cost at tax time**.

## Acceptance Criteria

### AC #1: Create Work Order Button on Expense Row (Property Workspace)

**Given** I am viewing an expense row in the property expense workspace
**When** the expense has NO linked work order (`workOrderId` is null)
**Then** I see a "Create Work Order" icon button (`add_task`) in the expense actions area
**And** the button has tooltip "Create work order from this expense"
**And** clicking it opens the Create Work Order dialog

**Given** the expense already has a linked work order
**When** I view the expense row actions
**Then** the "Create Work Order" button is NOT shown (the work order context line is shown instead)

### AC #2: Create Work Order Dialog with Pre-populated Fields

**Given** I click "Create Work Order" on an expense row
**When** the dialog opens
**Then** I see a dialog titled "Create Work Order from Expense"
**And** the property is pre-selected and locked (from the expense's property)
**And** the description is pre-filled with the expense description (editable)
**And** the category is pre-selected if the expense has a category (editable)
**And** status defaults to "Reported"
**And** vendor assignment is available (optional)
**And** I see "Create & Link" and "Cancel" buttons

### AC #3: Successful Work Order Creation and Auto-Link

**Given** I fill in the work order details in the dialog
**When** I click "Create & Link"
**Then** a new work order is created via `POST /api/v1/work-orders`
**And** the expense is automatically linked to the new work order via `PUT /api/v1/expenses/{id}`
**And** I see snackbar "Work order created and linked"
**And** the dialog closes
**And** the expense row updates to show the work order context sub-line (from Story 11.4)
**And** the "Create Work Order" button is replaced by the work order indicator

### AC #4: Cancel Without Creating

**Given** the Create Work Order dialog is open
**When** I click "Cancel"
**Then** no work order is created
**And** the expense remains unlinked
**And** the dialog closes

### AC #5: Validation

**Given** I am in the Create Work Order dialog
**When** I leave the description field empty
**Then** I see validation error "Description is required"
**And** the "Create & Link" button is disabled until valid

### AC #6: Error Handling

**Given** work order creation fails (network error or server error)
**When** the API returns an error
**Then** I see snackbar "Failed to create work order"
**And** the dialog remains open for retry

**Given** work order creation succeeds but expense linking fails
**When** the link API returns an error
**Then** I see snackbar "Work order created but linking failed. Link manually from the work order."
**And** the dialog closes (work order exists, user can link later)

### AC #7: Create Work Order from All-Expenses List

**Given** I am viewing the all-expenses list at `/expenses`
**When** I see an expense row with no linked work order
**Then** I see a small `add_task` icon button
**And** clicking it opens the same Create Work Order dialog
**And** the dialog works identically to AC #2-#6

## Tasks / Subtasks

### Task 1: Create the Dialog Component (AC: #2, #4, #5)

- [x] 1.1 Create `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.ts`
  - Standalone component with inline template and styles
  - Inject `MAT_DIALOG_DATA` receiving `CreateWoFromExpenseDialogData`:
    ```typescript
    export interface CreateWoFromExpenseDialogData {
      expenseId: string;
      propertyId: string;
      propertyName: string;
      description?: string;
      categoryId?: string;
    }
    ```
  - Inject `MatDialogRef`, `FormBuilder`, `WorkOrderService`, `ExpenseService`, `MatSnackBar`
  - Import `ReactiveFormsModule`, `MatDialogModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatButtonModule`, `MatProgressSpinnerModule`

- [x] 1.2 Create the form with fields:
  ```typescript
  form = this.fb.group({
    description: [this.data.description || '', [Validators.required, Validators.maxLength(5000)]],
    categoryId: [this.data.categoryId || ''],
    status: ['Reported'],
    vendorId: [''],
  });
  ```

- [x] 1.3 Load categories on init using existing pattern:
  ```typescript
  private readonly expenseCategoryService = inject(ExpenseCategoryService);
  categories = signal<ExpenseCategoryDto[]>([]);
  // Load via expenseCategoryService or use the generated API client
  ```
  Use the same category loading pattern as `work-order-form.component.ts` (loads from `GET /api/v1/expense-categories`).

- [x] 1.4 Load vendors on init for optional vendor assignment:
  ```typescript
  private readonly vendorService = inject(VendorService);
  vendors = signal<VendorListItemDto[]>([]);
  ```
  Use same vendor loading pattern as `work-order-form.component.ts`.

- [x] 1.5 Add dialog template:
  ```html
  <h2 mat-dialog-title>Create Work Order from Expense</h2>
  <mat-dialog-content>
    <p class="property-label">Property: {{ data.propertyName }}</p>
    <form [formGroup]="form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <textarea matInput formControlName="description" rows="3"></textarea>
        @if (form.controls.description.hasError('required')) {
          <mat-error>Description is required</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Category (optional)</mat-label>
        <mat-select formControlName="categoryId">
          <mat-option value="">None</mat-option>
          @for (cat of categories(); track cat.id) {
            <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Assigned To (optional)</mat-label>
        <mat-select formControlName="vendorId">
          <mat-option value="">Self (DIY)</mat-option>
          @for (vendor of vendors(); track vendor.id) {
            <mat-option [value]="vendor.id">{{ vendor.fullName }}</mat-option>
          }
        </mat-select>
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
        Create & Link
      }
    </button>
  </mat-dialog-actions>
  ```

- [x] 1.6 Add styles:
  ```scss
  .full-width { width: 100%; }
  .property-label {
    font-size: 0.9em;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 16px;
  }
  mat-dialog-content { min-width: 400px; }
  @media (max-width: 600px) {
    mat-dialog-content { min-width: unset; }
  }
  ```

### Task 2: Implement Create & Link Logic (AC: #3, #6)

- [x] 2.1 Add `isSubmitting` signal and `onSubmit()` method:
  ```typescript
  isSubmitting = signal(false);

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const createRequest: CreateWorkOrderRequest = {
      propertyId: this.data.propertyId,
      description: this.form.value.description!,
      categoryId: this.form.value.categoryId || undefined,
      status: this.form.value.status || 'Reported',
      vendorId: this.form.value.vendorId || undefined,
    };

    this.workOrderService.createWorkOrder(createRequest).subscribe({
      next: (response) => {
        this.linkExpenseToWorkOrder(response.id);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Failed to create work order', 'Close', { duration: 3000 });
      },
    });
  }
  ```

- [x] 2.2 Add `linkExpenseToWorkOrder()` method:
  ```typescript
  private linkExpenseToWorkOrder(workOrderId: string): void {
    // Fetch the full expense first (PUT requires all fields)
    this.expenseService.getExpense(this.data.expenseId).subscribe({
      next: (expense) => {
        const updateRequest: UpdateExpenseRequest = {
          amount: expense.amount,
          date: expense.date,
          categoryId: expense.categoryId,
          description: expense.description,
          workOrderId: workOrderId,
        };
        this.expenseService.updateExpense(this.data.expenseId, updateRequest).subscribe({
          next: () => {
            this.snackBar.open('Work order created and linked', 'Close', { duration: 3000 });
            this.dialogRef.close({ workOrderId, expenseId: this.data.expenseId });
          },
          error: () => {
            this.isSubmitting.set(false);
            this.snackBar.open(
              'Work order created but linking failed. Link manually from the work order.',
              'Close',
              { duration: 5000 }
            );
            this.dialogRef.close({ workOrderId, expenseId: this.data.expenseId, linkFailed: true });
          },
        });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open(
          'Work order created but linking failed. Link manually from the work order.',
          'Close',
          { duration: 5000 }
        );
        this.dialogRef.close({ workOrderId, expenseId: this.data.expenseId, linkFailed: true });
      },
    });
  }
  ```

- [x] 2.3 Define the dialog result interface:
  ```typescript
  export interface CreateWoFromExpenseDialogResult {
    workOrderId: string;
    expenseId: string;
    linkFailed?: boolean;
  }
  ```

### Task 3: Add Create Work Order Action to Expense Row (AC: #1)

- [x] 3.1 In `expense-row.component.ts`, add a new output:
  ```typescript
  createWorkOrder = output<string>(); // emits expense ID
  ```

- [x] 3.2 Add the "Create Work Order" icon button in the template's `.expense-actions` section, BEFORE the edit button, only when `!expense().workOrderId`:
  ```html
  @if (!expense().workOrderId) {
    <button mat-icon-button
      class="create-wo-button"
      matTooltip="Create work order from this expense"
      (click)="onCreateWorkOrder($event)"
      data-testid="create-work-order-button">
      <mat-icon>add_task</mat-icon>
    </button>
  }
  ```

- [x] 3.3 Add the click handler:
  ```typescript
  protected onCreateWorkOrder(event: Event): void {
    event.stopPropagation(); // Prevent triggering row edit
    this.createWorkOrder.emit(this.expense().id);
  }
  ```

- [x] 3.4 Add styling:
  ```scss
  .create-wo-button {
    color: var(--mat-sys-primary);
  }
  ```

### Task 4: Wire Dialog to Expense Workspace (AC: #3)

- [x] 4.1 In `expense-workspace.component.ts`, inject `MatDialog`:
  ```typescript
  private readonly dialog = inject(MatDialog);
  ```

- [x] 4.2 Add the `onCreateWorkOrder()` handler:
  ```typescript
  onCreateWorkOrder(expenseId: string): void {
    const expense = this.store.expenses().find(e => e.id === expenseId);
    if (!expense) return;

    const dialogRef = this.dialog.open(CreateWoFromExpenseDialogComponent, {
      width: '500px',
      data: {
        expenseId: expense.id,
        propertyId: expense.propertyId,
        propertyName: this.store.selectedProperty()?.name || '',
        description: expense.description,
        categoryId: expense.categoryId,
      } as CreateWoFromExpenseDialogData,
    });

    dialogRef.afterClosed().subscribe((result: CreateWoFromExpenseDialogResult | undefined) => {
      if (result) {
        // Refresh expenses to show updated workOrderId
        this.store.loadExpenses(expense.propertyId);
        // Refresh work order map to include the new work order
        this.loadWorkOrders(expense.propertyId);
      }
    });
  }
  ```

- [x] 4.3 Wire the output in the template — add `(createWorkOrder)` binding on `app-expense-row`:
  ```html
  <app-expense-row
    [expense]="expense"
    [workOrder]="workOrderMap()[expense.workOrderId ?? '']"
    (edit)="onEditExpense($event)"
    (delete)="onDeleteExpense($event)"
    (createWorkOrder)="onCreateWorkOrder($event)"
  />
  ```

- [x] 4.4 Add imports:
  ```typescript
  import { MatDialog } from '@angular/material/dialog';
  import { CreateWoFromExpenseDialogComponent, CreateWoFromExpenseDialogData, CreateWoFromExpenseDialogResult } from '../../work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component';
  ```

### Task 5: Add Create Work Order Action to All-Expenses List Row (AC: #7)

- [x] 5.1 In `expense-list-row.component.ts`, add a new output:
  ```typescript
  createWorkOrder = output<ExpenseListItemDto>(); // emits full expense item
  ```

- [x] 5.2 Add the `add_task` icon button in the template. Place alongside existing work order indicator:
  ```html
  <div class="expense-work-order">
    @if (expense().workOrderId) {
      <mat-icon
        matTooltip="Linked to work order"
        class="work-order-link"
        (click)="navigateToWorkOrder($event)"
        data-testid="work-order-indicator"
      >assignment</mat-icon>
    } @else {
      <mat-icon
        matTooltip="Create work order"
        class="create-wo-link"
        (click)="onCreateWorkOrder($event)"
        data-testid="create-work-order-button"
      >add_task</mat-icon>
    }
  </div>
  ```

- [x] 5.3 Add click handler:
  ```typescript
  onCreateWorkOrder(event: Event): void {
    event.stopPropagation();
    this.createWorkOrder.emit(this.expense());
  }
  ```

- [x] 5.4 Add styling:
  ```scss
  .create-wo-link {
    cursor: pointer;
    color: var(--mat-sys-on-surface-variant);
    transition: color 0.2s ease;
    &:hover {
      color: var(--mat-sys-primary);
    }
  }
  ```

- [x] 5.5 In the parent all-expenses list component, wire up the `(createWorkOrder)` output to open the same dialog. Pass propertyName from the expense list item DTO. After dialog closes with a result, reload the expense list.

### Task 6: Frontend Unit Tests (AC: ALL)

- [x] 6.1 Test `create-wo-from-expense-dialog.component.spec.ts`:
  - Dialog renders with pre-populated description from expense data
  - Dialog renders with pre-selected category from expense data
  - Property name displayed (not editable)
  - Description field validates as required
  - "Create & Link" disabled when form invalid
  - "Create & Link" disabled during submission
  - Successful creation calls `workOrderService.createWorkOrder` with correct data
  - After WO creation, calls `expenseService.getExpense` then `updateExpense` with `workOrderId`
  - Shows "Work order created and linked" snackbar on full success
  - Shows error snackbar when WO creation fails
  - Shows partial success snackbar when linking fails
  - Cancel closes dialog without result
  - Dialog returns result with workOrderId and expenseId on success

- [x] 6.2 Test `expense-row.component.spec.ts` (additions):
  - Shows "Create Work Order" button when `expense.workOrderId` is null
  - Hides "Create Work Order" button when `expense.workOrderId` exists
  - Clicking button emits `createWorkOrder` event with expense ID
  - Click event does NOT propagate (stopPropagation)

- [x] 6.3 Test `expense-workspace.component.spec.ts` (additions):
  - `onCreateWorkOrder()` opens dialog with correct data
  - After dialog closes with result, reloads expenses
  - After dialog closes with result, reloads work orders
  - After dialog closes without result (cancel), no reload

- [x] 6.4 Test `expense-list-row.component.spec.ts` (additions):
  - Shows `add_task` icon when no workOrderId
  - Shows `assignment` icon when workOrderId exists (existing test)
  - Clicking `add_task` emits `createWorkOrder` event
  - Click event does NOT propagate

## Dev Notes

### Architecture: Frontend-Only Story

All backend work was completed in Story 11-1 (Expense-WorkOrder Relationship). This story is **100% frontend work**. No backend changes, no migrations, no API client regeneration needed.

The backend already supports:
- `POST /api/v1/work-orders` - Create work order (returns `{ id: workOrderId }`)
- `GET /api/v1/expenses/{id}` - Get expense (to build full update request)
- `PUT /api/v1/expenses/{id}` - Update expense with `workOrderId` (requires ALL fields)
- Property isolation validation (expense & work order must be same property)

### Critical: PUT Expense Requires Full Payload

The `PUT /api/v1/expenses/{id}` endpoint is NOT a PATCH. It requires ALL fields: `amount`, `date`, `categoryId`, `description`, `workOrderId`. You MUST:
1. Fetch the existing expense via `GET /api/v1/expenses/{id}`
2. Build a complete `UpdateExpenseRequest` with all existing field values
3. Override only `workOrderId` with the new work order ID

This pattern was established in Story 11-3 (link/unlink from work order detail). Follow it exactly.

### Two-Step API Sequence

Creating a work order from an expense requires TWO API calls:
1. `POST /api/v1/work-orders` → returns `{ id: workOrderId }`
2. `PUT /api/v1/expenses/{expenseId}` → sets `workOrderId` on the expense

The backend does NOT support creating a work order with an automatic expense link in a single call. This is by design (separation of concerns).

Handle partial failure: if step 1 succeeds but step 2 fails, the work order exists but is unlinked. Inform the user so they can link manually.

### Dialog vs Navigation Decision

**Dialog chosen** (not navigation to `/work-orders/new`) because:
- Keeps user in context (expense workspace)
- Simpler UX for retroactive work order creation
- Matches existing patterns (`link-expense-dialog`, `inline-vendor-dialog`)
- Avoids complex query param state management for auto-linking after navigation

### Existing Services to Reuse

| Service | Method | Purpose |
|---------|--------|---------|
| `WorkOrderService` | `createWorkOrder(request)` | Create the new work order |
| `ExpenseService` | `getExpense(expenseId)` | Fetch full expense for building update request |
| `ExpenseService` | `updateExpense(expenseId, request)` | Set workOrderId on expense |
| `WorkOrderService` | `getWorkOrdersByProperty(propertyId)` | Refresh workOrderMap after creation |
| `ExpenseStore` | `loadExpenses(propertyId)` | Refresh expense list after linking |

**DO NOT** create new services or API endpoints. Everything needed already exists.

### Component Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` | Add `createWorkOrder` output, `add_task` button |
| `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts` | Add dialog opener, wire output, reload on success |
| `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` | Add `add_task` icon when no WO, emit event |

### New File to Create

| File | Purpose |
|------|---------|
| `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.ts` | Dialog for creating WO from expense |
| `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts` | Unit tests |

### Pattern: Follow Inline Vendor Dialog

The `inline-vendor-dialog.component.ts` is the closest pattern match:
- Minimal creation dialog that stays in context
- Creates entity via service call
- Returns result to caller for auto-selection
- Shows error snackbar and stays open on failure
- Closes with result on success

### Pattern: Follow Expense Linking from Story 11.3

The `work-order-detail.component.ts` `linkExpense()` method (Story 11.3) shows the correct pattern for linking an expense to a work order:
1. Fetch full expense via `getExpense(expenseId)`
2. Build `UpdateExpenseRequest` with all existing fields + new `workOrderId`
3. Call `updateExpense(expenseId, request)`
4. Show snackbar on success/failure

### CreateWorkOrderRequest Shape (from work-order.service.ts)

```typescript
interface CreateWorkOrderRequest {
  propertyId: string;
  description: string;
  categoryId?: string;
  status?: string;
  vendorId?: string;
  tagIds?: string[];
}
```

### ExpenseDto Shape (from expense.service.ts)

```typescript
interface ExpenseDto {
  id: string;
  propertyId: string;
  propertyName: string;
  categoryId: string;
  categoryName: string;
  scheduleELine?: string;
  amount: number;
  date: string;
  description?: string;
  receiptId?: string;
  workOrderId?: string;
  createdAt: string;
}
```

### UpdateExpenseRequest Shape (from expense.service.ts)

```typescript
interface UpdateExpenseRequest {
  amount: number;
  date: string;
  categoryId: string;
  description?: string;
  workOrderId?: string;
}
```

Note: `UpdateExpenseRequest` does NOT include `propertyId` (confirmed from Story 11.3 completion notes).

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
import { WorkOrderService, CreateWorkOrderRequest } from '../../services/work-order.service';
import { ExpenseService, UpdateExpenseRequest } from '../../../expenses/services/expense.service';
```

Expense workspace additions:
```typescript
import { MatDialog } from '@angular/material/dialog';
import { CreateWoFromExpenseDialogComponent, CreateWoFromExpenseDialogData, CreateWoFromExpenseDialogResult } from '../../work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component';
```

### Previous Story Intelligence (11.4)

From Story 11.4 implementation:
- Frontend: 2,180 tests pass (2,165 base + 15 from 11.4), 0 failures
- `workOrderMap` signal exists in expense-workspace for looking up work order data per expense
- `loadWorkOrders(propertyId)` method exists in expense-workspace (reload after creating WO)
- Expense row has `workOrder` input for context display and `navigateToWorkOrder()` for click handling
- Components use inline templates (backtick strings), standalone, `@if`/`@for` control flow
- `event.stopPropagation()` pattern established for preventing row-level click handlers

### Git Intelligence

Recent commits:
- `99f71b8` - Merge PR #180: Story 11.4 view linked work order on expense
- `a044cf2` - fix(review): Address code review findings for Story 11.4
- `5a2db27` - feat(expenses): Add work order context to expense rows (Story 11.4)
- `e0bf147` - Merge PR #179: Story 11.3 link work order to expense
- `f507713` - fix(review): Address code review findings for Story 11.3

### Testing Standards

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` -- orphaned workers)
- Co-located `.spec.ts` files
- Mock services using `vi.fn()` and `of()` for Observable returns
- Use `TestBed.configureTestingModule()` with mock providers
- Mock `MatDialog.open()` to return `afterClosed()` observable
- Mock `MatSnackBar.open()` to verify feedback messages
- Mock `Router.navigate()` if testing navigation

**Pattern for mocking dialog:**
```typescript
const mockDialogRef = { afterClosed: () => of({ workOrderId: 'wo-1', expenseId: 'exp-1' }) };
const mockDialog = { open: vi.fn().mockReturnValue(mockDialogRef) };
```

**Pattern for mocking WorkOrderService:**
```typescript
const mockWorkOrderService = {
  createWorkOrder: vi.fn().mockReturnValue(of({ id: 'new-wo-id' })),
  getWorkOrdersByProperty: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
};
```

**Pattern for mocking ExpenseService:**
```typescript
const mockExpenseService = {
  getExpense: vi.fn().mockReturnValue(of({
    id: 'exp-1', propertyId: 'prop-1', amount: 125.50, date: '2026-01-15',
    categoryId: 'cat-1', description: 'Faucet repair', workOrderId: undefined,
  })),
  updateExpense: vi.fn().mockReturnValue(of(undefined)),
};
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

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.6] - Create Work Order from Expense (FR31)
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: architecture.md#API Extensions] - Work order CRUD endpoints
- [Source: expense-row.component.ts] - Expense row with actions, WO context
- [Source: expense-workspace.component.ts] - Workspace with workOrderMap, loadWorkOrders
- [Source: work-order.service.ts] - createWorkOrder(), getWorkOrdersByProperty()
- [Source: expense.service.ts] - getExpense(), updateExpense()
- [Source: inline-vendor-dialog.component.ts] - Dialog pattern reference
- [Source: link-expense-dialog.component.ts] - Dialog pattern reference
- [Source: 11-4-view-linked-work-order-on-expense.md] - Previous story with WO context on rows
- [Source: 11-3-link-work-order-to-expense.md] - Expense linking pattern (fetch + update)
- [Source: 11-2-link-expense-to-work-order.md] - WO dropdown and DTO updates
- [Source: 11-1-expense-workorder-relationship.md] - Backend foundation (FK, endpoints)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR31 | Users can create a work order from an expense detail page (retroactive) | "Create Work Order" button on expense rows opens dialog, creates WO, auto-links expense |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Created `CreateWoFromExpenseDialogComponent` with pre-populated form fields from expense data (description, category), property displayed as locked label, vendor dropdown, and "Create & Link" / "Cancel" actions
- Used `ExpenseStore` for categories and `VendorStore` for vendors, matching the existing `work-order-form.component.ts` pattern
- Implemented two-step API sequence: POST work order, then GET expense + PUT expense with workOrderId
- Handled partial failure: if WO creation succeeds but linking fails, dialog closes with `linkFailed: true` and user-facing message about manual linking
- Added `createWorkOrder` output and `add_task` icon button to `expense-row.component.ts` (visible only when expense has no linked work order)
- Wired dialog opening in `expense-workspace.component.ts` with post-close expense + work order refresh
- Added `createWorkOrder` output and `add_task` icon to `expense-list-row.component.ts` (replaces empty space when no WO)
- Wired dialog opening in `expenses.component.ts` (all-expenses list) with post-close list refresh
- All 2,219 frontend tests pass (39 new tests added, 0 regressions)

### File List

**New Files:**
- `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.ts`
- `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts`

**Modified Files:**
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` - Added `createWorkOrder` output, `add_task` button, click handler
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.spec.ts` - Added 4 tests for create WO button
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts` - Added dialog opener, wired output, reload on success
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.spec.ts` - Added 4 tests for dialog opening and reload
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` - Added `createWorkOrder` output, `add_task` icon, click handler
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.spec.ts` - Added 4 tests for create WO button
- `frontend/src/app/features/expenses/expenses.component.ts` - Added dialog opener for all-expenses list
