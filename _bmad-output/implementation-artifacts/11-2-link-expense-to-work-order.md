# Story 11.2: Link Expense to Work Order

Status: dev-complete

## Story

As a **property owner**,
I want **to link an existing expense to a work order from the expense form**,
So that **I can associate costs with the repair they belong to and understand what each expense was for at tax time**.

## Acceptance Criteria

### AC #1: Work Order Dropdown on Expense Create Form

**Given** I am creating a new expense on the expense workspace
**When** I view the expense form
**Then** I see an optional "Work Order" dropdown below the Description field
**And** the dropdown shows work orders for the current property only
**And** each option displays: description (truncated to ~60 chars) + status badge
**And** a "None" option is available and selected by default

### AC #2: Work Order Dropdown on Expense Edit Form

**Given** I am editing an existing expense
**When** I view the edit form
**Then** I see the "Work Order" dropdown pre-populated with the currently linked work order (or "None")
**And** I can change or clear the work order link
**And** saving persists the updated workOrderId

### AC #3: Work Orders Filtered by Property

**Given** I open the Work Order dropdown on an expense form
**When** the dropdown options load
**Then** only work orders belonging to the same property as the expense are shown
**And** work orders are sorted by most recently created first
**And** all statuses are included (Reported, Assigned, Completed)

### AC #4: Save Expense with Work Order Link

**Given** I select a work order in the dropdown
**When** I save the expense (create or update)
**Then** the expense's `workOrderId` is set to the selected work order
**And** I see snackbar confirmation ("Expense saved" / "Expense updated")

### AC #5: Clear Work Order Link

**Given** an expense is linked to a work order
**When** I edit the expense and select "None" from the Work Order dropdown
**And** I save
**Then** the expense's `workOrderId` is set to null (unlinked)

### AC #6: Empty State - No Work Orders

**Given** the current property has no work orders
**When** I view the Work Order dropdown
**Then** the dropdown is still visible but shows only "None"
**And** no error is displayed

### AC #7: Work Order Indicator in Expense List Row

**Given** an expense is linked to a work order
**When** I view the expense in the expense list
**Then** I see a small work order icon (`assignment`) next to the description
**And** hovering shows a tooltip with the work order description

## Tasks / Subtasks

### Task 1: Update Frontend DTOs to Include workOrderId (AC: #1, #2, #4, #5)

- [x] 1.1 Add `workOrderId?: string` to `ExpenseDto` in `expense.service.ts`
- [x] 1.2 Add `workOrderId?: string` to `CreateExpenseRequest` in `expense.service.ts`
- [x] 1.3 Add `workOrderId?: string` to `UpdateExpenseRequest` in `expense.service.ts`
- [x] 1.4 Add `workOrderId?: string` to `ExpenseListItemDto` in `expense.service.ts`

### Task 2: Update Expense Store for workOrderId (AC: #4, #5)

- [x] 2.1 Update `createExpense` method in `expense.store.ts` to include `workOrderId` when building the local `newExpense` DTO:
  ```typescript
  const newExpense: ExpenseDto = {
    ...existing fields,
    workOrderId: request.workOrderId ?? undefined,
  };
  ```
- [x] 2.2 Update `updateExpense` method to persist `workOrderId` in local state after update:
  ```typescript
  return {
    ...expense,
    ...existing updates,
    workOrderId: request.workOrderId ?? undefined,
  };
  ```

### Task 3: Add Work Order Dropdown to Expense Create Form (AC: #1, #3, #4, #6)

- [x] 3.1 Inject `WorkOrderService` in `expense-form.component.ts`
- [x] 3.2 Add `workOrderId` form control to the FormGroup (optional, no validators):
  ```typescript
  form: FormGroup = this.fb.group({
    ...existing controls,
    workOrderId: [''],
  });
  ```
- [x] 3.3 Add signal for work orders: `workOrders = signal<WorkOrderDto[]>([])`
- [x] 3.4 Add signal for loading state: `isLoadingWorkOrders = signal(false)`
- [x] 3.5 Load work orders on init using `WorkOrderService.getWorkOrdersByProperty(propertyId)`:
  ```typescript
  ngOnInit(): void {
    this.store.loadCategories();
    this.loadWorkOrders();
  }
  private loadWorkOrders(): void {
    this.isLoadingWorkOrders.set(true);
    this.workOrderService.getWorkOrdersByProperty(this.propertyId()).subscribe({
      next: (response) => {
        this.workOrders.set(response.items);
        this.isLoadingWorkOrders.set(false);
      },
      error: () => this.isLoadingWorkOrders.set(false),
    });
  }
  ```
- [x] 3.6 Add `MatSelectModule` to imports
- [x] 3.7 Add dropdown template between Description and Submit button:
  ```html
  <!-- Work Order Link (optional) (AC-11.2.1) -->
  <mat-form-field appearance="outline" class="full-width">
    <mat-label>Work Order (optional)</mat-label>
    <mat-select formControlName="workOrderId">
      <mat-option value="">None</mat-option>
      @for (wo of workOrders(); track wo.id) {
        <mat-option [value]="wo.id">
          {{ wo.description | slice:0:60 }}{{ wo.description.length > 60 ? '...' : '' }}
          ({{ wo.status }})
        </mat-option>
      }
    </mat-select>
  </mat-form-field>
  ```
- [x] 3.8 Include `workOrderId` in saveExpense request (pass `undefined` if empty string):
  ```typescript
  private saveExpense(request: CreateExpenseRequest): void {
    // existing logic plus workOrderId
  }
  ```
  Update `onSubmit()` to include `workOrderId: this.form.value.workOrderId || undefined` in the request
- [x] 3.9 Reset `workOrderId` to `''` in `resetForm()`
- [x] 3.10 Add `.full-width` style: `width: 100%`

### Task 4: Add Work Order Dropdown to Expense Edit Form (AC: #2, #3, #5)

- [x] 4.1 Inject `WorkOrderService` in `expense-edit-form.component.ts`
- [x] 4.2 Add `workOrderId` form control to FormGroup:
  ```typescript
  form: FormGroup = this.fb.group({
    ...existing controls,
    workOrderId: [''],
  });
  ```
- [x] 4.3 Add `workOrders` and `isLoadingWorkOrders` signals
- [x] 4.4 Load work orders on init using the expense's `propertyId`:
  ```typescript
  this.workOrderService.getWorkOrdersByProperty(this.expense().propertyId).subscribe(...)
  ```
- [x] 4.5 Populate `workOrderId` in `populateForm()`:
  ```typescript
  this.form.patchValue({
    ...existing fields,
    workOrderId: exp.workOrderId || '',
  });
  ```
- [x] 4.6 Add `MatSelectModule` to imports
- [x] 4.7 Add dropdown template between Description field and Receipt section
- [x] 4.8 Include `workOrderId` in the `UpdateExpenseRequest` in `onSubmit()`:
  ```typescript
  const request: UpdateExpenseRequest = {
    ...existing fields,
    workOrderId: this.form.value.workOrderId || undefined,
  };
  ```

### Task 5: Add Work Order Indicator to Expense Row (AC: #7)

- [x] 5.1 Find the expense row component (likely `expense-row.component.ts`)
- [x] 5.2 Add a small `assignment` icon next to the description when `expense.workOrderId` exists
- [x] 5.3 Add tooltip showing the work order description (this may require loading work order data - if not available in the expense DTO, show workOrderId or a generic "Linked to work order" tooltip)
- [x] 5.4 Import `MatIconModule` and `MatTooltipModule` if not already imported

### Task 6: Frontend Unit Tests (AC: ALL)

- [x] 6.1 Test `expense-form.component.spec.ts`:
  - Form includes workOrderId field
  - Work orders load on init for current property
  - Work order dropdown displays options
  - Selected workOrderId included in create request
  - Empty workOrderId sends undefined (not empty string)
  - Form reset clears workOrderId
  - Empty work orders shows only "None" option

- [x] 6.2 Test `expense-edit-form.component.spec.ts`:
  - Form pre-populates workOrderId from expense
  - Work orders load for expense's property
  - Updated workOrderId included in update request
  - Clearing workOrderId sends undefined
  - "None" option available

- [x] 6.3 Test expense row work order indicator:
  - Icon shows when workOrderId present
  - Icon hidden when no workOrderId
  - Tooltip displays work order info

## Dev Notes

### Architecture: Frontend-Only Story

Story 11.1 already completed ALL backend work:
- `WorkOrderId` nullable FK on Expense entity with `ON DELETE SET NULL`
- CreateExpense and UpdateExpense commands accept `workOrderId`
- Property isolation validation (expense & work order must be same property)
- `GET /api/v1/work-orders/{id}/expenses` endpoint
- API client regenerated with `workOrderId` in all DTOs

**This story is 100% frontend work.** No backend changes, no migrations, no API client regeneration needed.

### Critical: Hand-Written DTOs Need Updating

The project uses BOTH:
1. **Generated API client** (`core/api/api.service.ts`) - already has `workOrderId`
2. **Hand-written service DTOs** (`features/expenses/services/expense.service.ts`) - does NOT have `workOrderId`

The expense forms use the hand-written service. You MUST add `workOrderId` to these DTOs:
- `ExpenseDto` (line 45-57)
- `CreateExpenseRequest` (line 8-14)
- `UpdateExpenseRequest` (line 116-121)
- `ExpenseListItemDto` (line 98-110)

### Existing Services to Reuse

| Service | Method | Purpose |
|---------|--------|---------|
| `WorkOrderService` | `getWorkOrdersByProperty(propertyId)` | Fetch work orders for dropdown |
| `ExpenseService` | `createExpense(request)` | Already sends to backend that accepts workOrderId |
| `ExpenseService` | `updateExpense(id, request)` | Already sends to backend that accepts workOrderId |
| `ExpenseStore` | `createExpense()` / `updateExpense()` | Orchestrates save + local state |

**DO NOT** create new services or endpoints. Everything needed already exists.

### Component Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/features/expenses/services/expense.service.ts` | Add workOrderId to DTOs |
| `frontend/src/app/features/expenses/stores/expense.store.ts` | Persist workOrderId in local state on create/update |
| `frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts` | Add work order dropdown |
| `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts` | Add work order dropdown |
| Expense row component (find in `components/expense-row/`) | Add work order indicator icon |

### Pattern: Follow Property Dropdown in Receipt Form

The `ReceiptExpenseFormComponent` has a property dropdown using `mat-select` that is the exact pattern to follow:
```html
<mat-form-field appearance="outline" class="full-width">
  <mat-label>Property</mat-label>
  <mat-select formControlName="propertyId">
    @for (property of propertyStore.properties(); track property.id) {
      <mat-option [value]="property.id">{{ property.name }}</mat-option>
    }
  </mat-select>
</mat-form-field>
```

Adapt this pattern for work orders, adding "None" as the first option.

### Form Reset Pattern

The create form uses `FormGroupDirective.resetForm()` (critical for ErrorStateMatcher). When resetting, include `workOrderId: ''`:
```typescript
this.formDirective.resetForm({
  amount: null,
  date: this.today,
  categoryId: '',
  description: '',
  workOrderId: '',
});
```

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
}
```

### Import Requirements

Both expense form components will need:
```typescript
import { MatSelectModule } from '@angular/material/select';
import { WorkOrderService, WorkOrderDto } from '../../../work-orders/services/work-order.service';
```

Add `MatSelectModule` to the `imports` array of each component.

### Previous Story Intelligence (11.1)

From Story 11.1 dev notes:
- Backend: 1,421 tests pass (899 app + 85 infra + 437 API), 0 failures
- Frontend: 2,130 tests pass, 0 failures
- No `BusinessRuleException` exists - codebase uses `ValidationException` for 400 errors
- Soft delete does NOT trigger FK `ON DELETE SET NULL` - only physical SQL DELETEs do
- The generated API client in `core/api/api.service.ts` already has `workOrderId` in all expense DTOs

### Git Intelligence

Recent commits:
- `feat(expenses): Add WorkOrderId FK to Expense entity (Story 11.1)` - Backend FK complete
- `fix(review): Address code review findings for Story 11.1` - Review fixes applied
- `fix(security): Address 51 code scanning alerts` - Security scanning resolved

### Testing Standards

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` - orphaned workers)
- Co-located `.spec.ts` files
- Mock stores using `signal()` for reactive properties, `vi.fn()` for methods
- Use `TestBed.configureTestingModule()` with mock providers
- Mock `WorkOrderService.getWorkOrdersByProperty()` to return test data

**Pattern for mocking:**
```typescript
const mockWorkOrderService = {
  getWorkOrdersByProperty: vi.fn().mockReturnValue(of({
    items: [
      { id: 'wo-1', description: 'Fix plumbing', status: 'Reported', propertyId: 'prop-1' },
      { id: 'wo-2', description: 'Replace HVAC', status: 'Assigned', propertyId: 'prop-1' },
    ],
    totalCount: 2,
  })),
};
```

### Project Structure Notes

- Components use inline templates and styles (backtick strings, not separate files)
- All components are `standalone: true`
- Use new control flow: `@if`, `@for`, `@else`
- Signal stores use `signalStore()` from `@ngrx/signals`
- Material components imported individually

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.2] - Link Expense to Work Order requirements
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: expense-form.component.ts] - Current create form (no workOrderId)
- [Source: expense-edit-form.component.ts] - Current edit form (no workOrderId)
- [Source: expense.service.ts] - Hand-written DTOs (need workOrderId added)
- [Source: work-order.service.ts] - getWorkOrdersByProperty() already exists
- [Source: expense.store.ts] - Store create/update methods need workOrderId in local state
- [Source: project-context.md] - Full project rules and patterns
- [Source: 11-1-expense-workorder-relationship.md] - Previous story completion notes

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR29 | Users can link an existing expense to a work order | Work Order dropdown on expense create/edit forms |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 6 tasks (35 subtasks) completed
- Frontend-only story — no backend changes, no migrations, no API client regeneration
- Added `workOrderId` to 4 DTOs in `expense.service.ts`
- Updated `expense.store.ts` to persist `workOrderId` in local state on create/update
- Added optional Work Order dropdown (mat-select) to both create and edit forms
- Dropdown loads work orders from `WorkOrderService.getWorkOrdersByProperty()`, filtered by current property
- "None" option available and selected by default
- Empty `workOrderId` mapped to `undefined` (not sent as empty string)
- Added `assignment` icon indicator on expense row when `workOrderId` exists
- 2,146 frontend tests pass (was 2,130 — 16 new tests added), 0 failures

### File List

- `frontend/src/app/features/expenses/services/expense.service.ts` — Added `workOrderId` to `CreateExpenseRequest`, `ExpenseDto`, `UpdateExpenseRequest`, `ExpenseListItemDto`
- `frontend/src/app/features/expenses/stores/expense.store.ts` — Persist `workOrderId` in `createExpense` and `updateExpense` local state
- `frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts` — Work order dropdown, load work orders, include in create request, reset
- `frontend/src/app/features/expenses/components/expense-form/expense-form.component.spec.ts` — 7 new tests for AC-11.2
- `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts` — Work order dropdown, pre-populate, include in update request
- `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.spec.ts` — 6 new tests for AC-11.2
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` — Work order `assignment` icon indicator
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.spec.ts` — 3 new tests for AC-11.2.7
