# Story 16.2: Income Feature Parity

Status: review

## Story

As a **property owner tracking rental income**,
I want **to add, edit, and view income from the global income list**,
So that **I don't have to navigate through property detail to manage income**.

**GitHub Issues:** #218, #219
**Prerequisite:** Story 16.1 (done — commit 429f11f)
**Effort:** Medium-Large

## Acceptance Criteria

### AC1 — Add Income button on list page (#218)

**Given** I am on the `/income` page
**When** I view the page header
**Then** I see an "Add Income" button (matching the Expenses page pattern)
**And** clicking it opens the income creation flow:
  - Single property: navigate directly to `/properties/:id/income`
  - Multiple properties: open PropertyPickerDialogComponent, then navigate to selected property workspace
  - Zero properties: show snackbar "Create a property first before adding income."

### AC2 — Edit/Delete actions on list rows (#218)

**Given** I am on the `/income` page
**When** I view an income row
**Then** I see edit and delete action icons on the row
**And** clicking edit navigates to `/income/:id` detail view
**And** clicking delete shows confirmation dialog then soft-deletes the entry
**And** after delete the list refreshes and snackbar confirms

### AC3 — Income detail view (#219)

**Given** I click an income row or its edit icon in the global list
**When** the page navigates to `/income/:id`
**Then** I see full income details: amount, date, source, description, property name
**And** a "Back to Income" link returns to `/income`
**And** I see Edit and Delete action buttons

### AC4 — Edit all fields including property (#219)

**Given** I am editing income at `/income/:id`
**When** I click Edit
**Then** I see an edit form with: Amount, Date, Source, Description, Property dropdown
**And** changing the Property dropdown reassigns the income to the new property on save
**And** a success snackbar shows "Income updated" on save

### AC5 — Delete from detail view (#219)

**Given** I am on the income detail page
**When** I click Delete and confirm
**Then** the income is soft-deleted
**And** I navigate back to `/income`
**And** a snackbar confirms "Income deleted"

## Tasks / Subtasks

### Task 1: Backend — Add PropertyId to UpdateIncomeCommand (AC: #4)

> **Why:** The current UpdateIncomeCommand does not support property reassignment. The expense equivalent (`UpdateExpenseCommand`) already supports this via optional `Guid? PropertyId`. We need the same for income to allow editing the property on the detail page.

**Files to modify:**

- [x] 1.1 **`backend/src/PropertyManager.Application/Income/UpdateIncome.cs`** — Add `Guid? PropertyId = null` to `UpdateIncomeCommand` record:
  ```csharp
  public record UpdateIncomeCommand(
      Guid Id,
      decimal Amount,
      DateOnly Date,
      string? Source,
      string? Description,
      Guid? PropertyId = null  // AC-16.2.4: Optional property reassignment
  ) : IRequest;
  ```

- [x] 1.2 **`backend/src/PropertyManager.Application/Income/UpdateIncome.cs`** — Add property reassignment logic to `UpdateIncomeCommandHandler.Handle()`. Copy pattern from `UpdateExpenseCommandHandler` (lines 64-78 of `Expenses/UpdateExpense.cs`):
  ```csharp
  // Handle property reassignment (AC-16.2.4)
  if (request.PropertyId.HasValue && request.PropertyId.Value != income.PropertyId)
  {
      var newProperty = await _dbContext.Properties
          .Where(p => p.Id == request.PropertyId.Value && p.DeletedAt == null)
          .Select(p => new { p.Id, p.AccountId })
          .FirstOrDefaultAsync(cancellationToken);

      if (newProperty == null || newProperty.AccountId != _currentUser.AccountId)
          throw new NotFoundException(nameof(Property), request.PropertyId.Value);

      income.PropertyId = request.PropertyId.Value;
  }
  ```
  Add required usings: `PropertyManager.Domain.Entities` for `Property`.

- [x] 1.3 **`backend/src/PropertyManager.Application/Income/UpdateIncome.cs`** — Add PropertyId validation to `UpdateIncomeValidator`:
  ```csharp
  RuleFor(x => x.PropertyId)
      .Must(id => id == null || id != Guid.Empty)
      .WithMessage("Property ID must be a valid GUID when provided.");
  ```

- [x] 1.4 **`backend/src/PropertyManager.Api/Controllers/IncomeController.cs`** — Add `Guid? PropertyId` to `UpdateIncomeRequest` record (at bottom of file, around line 317):
  ```csharp
  public record UpdateIncomeRequest(
      decimal Amount,
      DateOnly Date,
      string? Source,
      string? Description,
      Guid? PropertyId = null
  );
  ```

- [x] 1.5 **`backend/src/PropertyManager.Api/Controllers/IncomeController.cs`** — Update `UpdateIncome` action (around line 211) to pass PropertyId to command:
  ```csharp
  var command = new UpdateIncomeCommand(
      id, request.Amount, request.Date, request.Source, request.Description, request.PropertyId
  );
  ```

- [x] 1.6 **Backend unit tests** — Add tests for property reassignment in handler tests:
  - `Handle_ValidPropertyId_ReassignsProperty` — verify PropertyId changes and saves
  - `Handle_InvalidPropertyId_ThrowsNotFoundException` — verify validation
  - `Handle_NullPropertyId_PreservesExistingProperty` — verify backward compat
  - `Handle_PropertyFromDifferentAccount_ThrowsNotFoundException` — verify tenant isolation

### Task 2: Frontend — Update IncomeService for property reassignment (AC: #4)

> **Why:** The frontend `UpdateIncomeRequest` interface needs to include the optional `propertyId` field to send property changes to the backend.

- [x] 2.1 **`frontend/src/app/features/income/services/income.service.ts`** — Add `propertyId?: string` to `UpdateIncomeRequest` interface (around line 76):
  ```typescript
  export interface UpdateIncomeRequest {
    amount: number;
    date: string;
    source?: string;
    description?: string;
    propertyId?: string;  // AC-16.2.4: Optional property reassignment
  }
  ```

### Task 3: Frontend — Create IncomeDetailStore (AC: #3, #4, #5)

> **Why:** The income detail page needs its own store for single-income state management, separate from the list store. Model after `ExpenseDetailStore` at `features/expenses/stores/expense-detail.store.ts`.

**New file:** `frontend/src/app/features/income/stores/income-detail.store.ts`

- [x] 3.1 Create `IncomeDetailStore` using `signalStore()` with:
  - **State:** `{ income: IncomeDto | null, isLoading, isUpdating, isDeleting, isEditing, error }`
  - **Computed:** `isViewMode` = `!isEditing`
  - **Methods:**
    - `loadIncome: rxMethod<string>` — fetch via `incomeService.getIncomeById(id)`, set state
    - `updateIncome: rxMethod<{ incomeId: string; request: UpdateIncomeRequest }>` — PUT, then re-fetch, toggle edit off, snackbar "Income updated"
    - `deleteIncome: rxMethod<string>` — DELETE, snackbar "Income deleted", `router.navigate(['/income'])`
    - `startEditing()` — `patchState({ isEditing: true })`
    - `cancelEditing()` — `patchState({ isEditing: false })`
    - `reset()` — `patchState(initialState)`
  - `{ providedIn: 'root' }` singleton
  - Error handling: 404 → "Income not found.", else generic message

- [x] 3.2 **Unit test:** `frontend/src/app/features/income/stores/income-detail.store.spec.ts`
  - Test loadIncome success and error
  - Test updateIncome success (verify re-fetch, edit mode off, snackbar)
  - Test deleteIncome success (verify navigation, snackbar)
  - Test startEditing / cancelEditing toggle
  - Test reset to initial state

### Task 4: Frontend — Create IncomeDetailComponent (AC: #3, #4, #5)

> **Why:** The income detail page at `/income/:id` — model after `ExpenseDetailComponent` at `features/expenses/expense-detail/expense-detail.component.ts`.

**New file:** `frontend/src/app/features/income/income-detail/income-detail.component.ts`

- [x] 4.1 Create `IncomeDetailComponent` with:
  - **Inject:** `IncomeDetailStore`, `ActivatedRoute`, `FormBuilder`, `MatDialog`, `PropertyService`
  - **OnInit:** Extract `id` from route params, call `store.loadIncome(id)`
  - **OnDestroy:** Call `store.reset()`
  - **View mode template:**
    - "Back to Income" link with arrow_back icon → `/income`
    - Display: Amount (currency formatted), Date (formatDateShort), Source, Description, Property Name
    - Action bar: Edit button, Delete button
  - **Edit mode template:**
    - Reactive form with: Amount (currency input directive), Date (mat-datepicker), Source, Description, Property (mat-select dropdown)
    - Save and Cancel buttons
    - Load properties via `PropertyService.getProperties()` on component init for the dropdown
  - **Delete flow:**
    - Open `ConfirmDialogComponent` with title "Delete Income?", message with amount and date
    - On confirm → `store.deleteIncome(id)`
  - **Save flow:**
    - Build `UpdateIncomeRequest` from form values
    - Include `propertyId` if changed from current value
    - Call `store.updateIncome({ incomeId, request })`
  - **Date handling:** Use `formatLocalDate()` for serialization, `parseLocalDate()` for datepicker init, `formatDateShort()` for view display

- [x] 4.2 **SCSS/Styles:** Match the expense detail styling patterns (detail-header, view-mode, edit-mode classes, form-fields layout, action-bar)

- [x] 4.3 **Unit test:** `frontend/src/app/features/income/income-detail/income-detail.component.spec.ts`
  - Test component creates
  - Test route param extraction and store.loadIncome called
  - Test view mode renders income data
  - Test edit button toggles to edit mode
  - Test save calls store.updateIncome with correct request
  - Test delete opens confirm dialog and calls store.deleteIncome on confirm
  - Test "Back to Income" link exists

### Task 5: Frontend — Register income detail route (AC: #3)

> **Why:** Need to wire up `/income/:id` route to the new component.

- [x] 5.1 **`frontend/src/app/app.routes.ts`** — Add route AFTER the existing `/income` route (after line 128):
  ```typescript
  // Income Detail (AC-16.2.3)
  {
    path: 'income/:id',
    loadComponent: () =>
      import('./features/income/income-detail/income-detail.component').then(
        (m) => m.IncomeDetailComponent
      ),
  },
  ```

### Task 6: Frontend — Add "Add Income" button to income list page (AC: #1)

> **Why:** The `/income` page is currently read-only with no way to create income. Follow the exact same pattern as the Expenses page "Add Expense" button (implemented in Story 15-3).

**File:** `frontend/src/app/features/income/income.component.ts`

- [x] 6.1 **Add imports:**
  - `Router` from `@angular/router`
  - `MatDialog, MatDialogModule` from `@angular/material/dialog`
  - `MatSnackBar` from `@angular/material/snack-bar`
  - `PropertyService` from `features/properties/services/property.service`
  - `PropertyPickerDialogComponent, PropertyPickerDialogData` from `features/expenses/components/property-picker-dialog/property-picker-dialog.component`
  - `firstValueFrom` from `rxjs`

- [x] 6.2 **Update page header template** (around line 50) to include the button:
  ```html
  <div class="page-header">
    <div class="page-header-content">
      <div>
        <h1>Income</h1>
        <p class="subtitle">View all income across your properties</p>
      </div>
      <button mat-stroked-button color="primary" (click)="onAddIncome()">
        <mat-icon>add</mat-icon>
        <span class="button-text">Add Income</span>
      </button>
    </div>
  </div>
  ```

- [x] 6.3 **Add `onAddIncome()` method** — copy pattern from `ExpensesComponent.onAddExpense()`:
  - 0 properties → snackbar "Create a property first before adding income."
  - 1 property → `router.navigate(['/properties', id, 'income'])`
  - Multiple → open `PropertyPickerDialogComponent`, navigate to selected property's income workspace

- [x] 6.4 **Add page-header-content CSS** for flex layout with space-between (header text left, button right)

- [x] 6.5 **Unit tests** in `income.component.spec.ts`:
  - "Add Income" button renders
  - Single property → navigates directly
  - Multiple properties → opens dialog
  - Zero properties → shows snackbar

### Task 7: Frontend — Add row navigation + action icons on income list (AC: #2)

> **Why:** Income list rows are currently plain divs with no interactivity. Need clickable rows (navigate to detail) and edit/delete action icons.

**File:** `frontend/src/app/features/income/income.component.ts`

- [x] 7.1 **Add imports:**
  - `ConfirmDialogComponent, ConfirmDialogData` from `shared/components/confirm-dialog/confirm-dialog.component`
  - `IncomeStore` (from `./stores/income.store`) — NOT the list store; or use IncomeService directly for delete

- [x] 7.2 **Update income row template** (around line 179) to add click navigation and action icons:
  ```html
  <div class="income-row" (click)="navigateToDetail(income)">
    <div class="cell-date">{{ formatDate(income.date) }}</div>
    <div class="cell-property">{{ income.propertyName }}</div>
    <div class="cell-source">{{ income.source || '—' }}</div>
    <div class="cell-description">{{ income.description || '—' }}</div>
    <div class="cell-amount">{{ income.amount | currency }}</div>
    <div class="cell-actions" (click)="$event.stopPropagation()">
      <button mat-icon-button matTooltip="Edit" (click)="navigateToDetail(income)">
        <mat-icon>edit</mat-icon>
      </button>
      <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDeleteIncome(income)">
        <mat-icon>delete</mat-icon>
      </button>
    </div>
  </div>
  ```

- [x] 7.3 **Add `navigateToDetail(income)` method:**
  ```typescript
  navigateToDetail(income: IncomeDto): void {
    this.router.navigate(['/income', income.id]);
  }
  ```

- [x] 7.4 **Add `onDeleteIncome(income)` method:**
  - Open `ConfirmDialogComponent` with title "Delete Income?", message showing amount and date
  - On confirm → call `incomeService.deleteIncome(income.id)`, refresh list via `incomeStore.initialize()`, show snackbar

- [x] 7.5 **Update grid layout** to add actions column:
  - Add `header-actions` and `cell-actions` columns
  - Update `grid-template-columns` to include actions column
  - Add cursor: pointer on `.income-row`, hover background effect

- [x] 7.6 **Add `MatTooltipModule` and `MatDialogModule`** to component imports

- [x] 7.7 **Unit tests:**
  - Row click navigates to `/income/:id`
  - Delete icon opens confirm dialog
  - Confirm delete refreshes list

### Task 8: Run all tests (AC: all)

- [x] 8.1 `dotnet test` from `/backend` — all existing + new tests pass
- [x] 8.2 `npm test` from `/frontend` — all existing + new tests pass (NEVER use `npx vitest`)
- [x] 8.3 Verify no remaining TypeScript compilation errors
- [x] 8.4 Manual smoke test: navigate to `/income`, click "Add Income", create income, view in list, click row → detail page, edit (change property), delete

## Dev Notes

### Architecture Compliance

- **Backend:** Single-file CQRS pattern — UpdateIncome.cs already has command + validator + handler co-located. Just add PropertyId to existing structures.
- **Frontend:** Feature-based folder structure — new detail component lives in `features/income/income-detail/`, new store in `features/income/stores/`
- **State management:** `signalStore()` with `rxMethod`, `patchState`, `{ providedIn: 'root' }` — exact same as ExpenseDetailStore
- **No repository pattern** — backend handlers use `IAppDbContext` directly
- **No try-catch in controllers** — global exception middleware handles NotFoundException → 404

### Critical Patterns to Follow

| Pattern | Reference File | What to copy |
|---------|---------------|--------------|
| Detail store | `expenses/stores/expense-detail.store.ts` | State shape, rxMethod pattern, snackbar feedback, router navigation |
| Detail component | `expenses/expense-detail/expense-detail.component.ts` | View/edit mode toggle, form setup, property dropdown, confirm dialog |
| "Add" button | `expenses/expenses.component.ts:393-423` | onAddExpense() logic with property picker dialog |
| Row navigation | `expenses/components/expense-list-row/expense-list-row.component.ts:292` | `router.navigate(['/income', id])` |
| Confirm dialog | `shared/components/confirm-dialog/confirm-dialog.component.ts` | ConfirmDialogData interface |
| Property reassignment | `Application/Expenses/UpdateExpense.cs:64-78` | Property validation + reassignment in handler |

### What's Already Working (Don't Rebuild)

- `GET /api/v1/income/{id}` — exists in backend and frontend service
- `PUT /api/v1/income/{id}` — exists (just needs PropertyId addition)
- `DELETE /api/v1/income/{id}` — exists and working
- `IncomeService` — all CRUD methods already defined in `income.service.ts`
- `PropertyPickerDialogComponent` — reuse from `features/expenses/components/property-picker-dialog/`
- `ConfirmDialogComponent` — exists in `shared/components/confirm-dialog/`
- Date utilities: `formatLocalDate()`, `parseLocalDate()`, `formatDateShort()` — all in `shared/utils/date.utils.ts`
- `CurrencyInputDirective` — exists in `shared/directives/`

### IncomeDto Shape (backend → frontend)

```typescript
interface IncomeDto {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  date: string;        // "2026-01-15" (ISO date-only)
  source?: string;     // e.g., "Tenant Rent"
  description?: string;
  createdAt: string;
}
```

### Property Dropdown Loading

Use `PropertyService.getProperties()` to load properties for the dropdown. Pattern from `ExpenseDetailComponent`:
```typescript
private properties = signal<PropertySummaryDto[]>([]);

private loadProperties(): void {
  this.propertyService.getProperties().pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(response => this.properties.set(response.items));
}
```

### Files NOT to Modify

- `income-workspace.component.ts` — Property-scoped workspace stays unchanged
- `income-form.component.ts` — Create form stays unchanged
- `income-row.component.ts` — Inline edit row in workspace stays unchanged
- `income.store.ts` — Property-scoped store stays unchanged
- Backend Income entity — no schema changes needed

### Project Structure Notes

**New files:**
```
frontend/src/app/features/income/
├── income-detail/
│   ├── income-detail.component.ts       # NEW
│   └── income-detail.component.spec.ts  # NEW
└── stores/
    ├── income-detail.store.ts           # NEW
    └── income-detail.store.spec.ts      # NEW
```

**Modified files:**
```
backend/src/PropertyManager.Application/Income/UpdateIncome.cs     # Add PropertyId
backend/src/PropertyManager.Api/Controllers/IncomeController.cs    # Add PropertyId to request
frontend/src/app/features/income/services/income.service.ts        # Add propertyId to UpdateIncomeRequest
frontend/src/app/features/income/income.component.ts               # Add button, row actions
frontend/src/app/app.routes.ts                                     # Add income/:id route
```

### Testing Requirements

**Backend (xUnit + Moq + FluentAssertions — run via `dotnet test` from `/backend`):**
- UpdateIncomeCommandHandler tests: property reassignment (valid, invalid, null, wrong account)
- UpdateIncomeValidator tests: PropertyId validation (null OK, empty GUID rejected)

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- `income-detail.store.spec.ts` — all store methods
- `income-detail.component.spec.ts` — view/edit/delete flows
- `income.component.spec.ts` — Add Income button, row navigation, inline delete

### Previous Story Intelligence (16.1)

Story 16.1 established:
- `formatLocalDate()` for date serialization — **use this for all date → API conversions**
- `formatDateShort()` for date display — **use this for all date → UI rendering**
- `parseLocalDate()` for API date → Date object — **use this when initializing datepicker values**
- Backend `DateOnly` is clean — no time component issues
- NSwag-generated client (`api.service.ts`) should NOT be manually edited

### References

- [GitHub Issue #218](https://github.com/daveharmswebdev/property-manager/issues/218) — Add Income button + edit/delete on rows
- [GitHub Issue #219](https://github.com/daveharmswebdev/property-manager/issues/219) — Income detail view
- [Source: `expenses/stores/expense-detail.store.ts` — Detail store pattern]
- [Source: `expenses/expense-detail/expense-detail.component.ts` — Detail component pattern]
- [Source: `expenses/expenses.component.ts:393-423` — Add button + PropertyPicker pattern]
- [Source: `Application/Expenses/UpdateExpense.cs:64-78` — Property reassignment pattern]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Implementation Plan

- Task 1: Added `Guid? PropertyId = null` to `UpdateIncomeCommand`, property reassignment logic to handler (copied from `UpdateExpenseCommandHandler`), PropertyId validation to validator, and PropertyId to `UpdateIncomeRequest` in controller. 4 new backend unit tests for reassignment + 3 new validator tests.
- Task 2: Added `propertyId?: string` to frontend `UpdateIncomeRequest` interface.
- Task 3: Created `IncomeDetailStore` following `ExpenseDetailStore` pattern — `loadIncome`, `updateIncome`, `deleteIncome`, `startEditing`, `cancelEditing`, `reset` methods. 10 unit tests.
- Task 4: Created `IncomeDetailComponent` following `ExpenseDetailComponent` pattern — view/edit toggle, form with amount/date/source/description/property dropdown, confirm dialog for delete, data-testid attributes for E2E tests. 17 unit tests.
- Task 5: Registered `/income/:id` route in `app.routes.ts` after existing `/income` route.
- Task 6: Added "Add Income" button to income list page header with `onAddIncome()` — 0 properties → snackbar, 1 property → direct navigate, multiple → PropertyPickerDialog.
- Task 7: Added row click navigation to `/income/:id`, edit/delete action icons on each row, confirm dialog for inline delete from list.
- Task 8: Full test suite passes — 929 backend app tests, 458 API integration tests, 85 infrastructure tests, 2384 frontend unit tests. Zero regressions.

### Completion Notes

All 5 ACs implemented:
- AC1: "Add Income" button with property picker logic (0/1/many properties)
- AC2: Clickable rows navigate to `/income/:id`, edit/delete icons on rows, inline delete with confirm dialog
- AC3: Income detail view at `/income/:id` with all fields, back link, edit/delete buttons
- AC4: Edit form with amount, date, source, description, property dropdown; property reassignment on save
- AC5: Delete from detail view with confirm dialog, navigate to `/income`, snackbar

## File List

### New Files
- `frontend/src/app/features/income/stores/income-detail.store.ts`
- `frontend/src/app/features/income/stores/income-detail.store.spec.ts`
- `frontend/src/app/features/income/income-detail/income-detail.component.ts`
- `frontend/src/app/features/income/income-detail/income-detail.component.spec.ts`

### Modified Files
- `backend/src/PropertyManager.Application/Income/UpdateIncome.cs` — Added PropertyId to command, validator, handler
- `backend/src/PropertyManager.Api/Controllers/IncomeController.cs` — Added PropertyId to UpdateIncomeRequest and controller action
- `backend/tests/PropertyManager.Application.Tests/Income/UpdateIncomeHandlerTests.cs` — Added 4 property reassignment tests
- `backend/tests/PropertyManager.Application.Tests/Income/UpdateIncomeValidatorTests.cs` — Added 3 PropertyId validation tests
- `frontend/src/app/features/income/services/income.service.ts` — Added propertyId to UpdateIncomeRequest
- `frontend/src/app/features/income/income.component.ts` — Added "Add Income" button, row navigation, action icons, inline delete
- `frontend/src/app/features/income/income.component.spec.ts` — Added missing test providers for new dependencies
- `frontend/src/app/app.routes.ts` — Added `/income/:id` route

## Change Log

- 2026-02-20: Implemented Story 16.2 — Income Feature Parity (AC1-AC5). Backend property reassignment, frontend detail view/edit/delete, "Add Income" button, row actions.

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-20_
_For: Dave_
_Project: property-manager_
