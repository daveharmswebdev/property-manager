# Story 15.5: Expense Detail/Edit View

Status: done

## Story

As a **property owner**,
I want **a dedicated expense detail/edit page at `/expenses/:id`**,
So that **I can view, edit (including reassigning property), and delete any expense from the global expense list**.

**GitHub Issue:** #208
**Prerequisite:** Story 15.4 (unlink receipt fix — done)
**Effort:** Large

## Acceptance Criteria

### AC1 — Navigation from expense list

**Given** I am on the `/expenses` page
**When** I click an expense row
**Then** I am navigated to `/expenses/:id`

### AC2 — Detail view

**Given** I am on `/expenses/:id`
**When** the page loads
**Then** I see all expense fields displayed in read-only mode:
- Amount (formatted as currency)
- Date (formatted as "Mon DD, YYYY")
- Category (name + Schedule E line if applicable)
- Description
- Property name
- Linked Receipt (thumbnail preview + view action if present)
- Linked Work Order (name/title + link to `/work-orders/:id` if present)
- Created date

### AC3 — Edit all fields including property

**Given** I am on the expense detail page
**When** I click the Edit button
**Then** the page switches to edit mode with a form pre-populated with current values
**And** I can edit: Amount, Date, Category, Description, Property (dropdown), Work Order (optional dropdown)

**Given** I am editing an expense and change the Property dropdown
**When** I click Save
**Then** the expense is reassigned to the new property

**Given** I am editing and click Cancel
**Then** the form reverts to read-only detail view with no changes saved

### AC4 — Delete from detail view

**Given** I am on the expense detail page
**When** I click Delete and confirm in the dialog
**Then** the expense is soft-deleted and I am navigated back to `/expenses`
**And** a success snackbar is shown

### AC5 — Unlink receipt from detail view

**Given** the expense has a linked receipt displayed on the detail page
**When** I click an "Unlink Receipt" action and confirm
**Then** the receipt is unlinked (`DELETE /api/v1/expenses/{id}/receipt`)
**And** the receipt section updates to show "No receipt linked"
**And** a success snackbar confirms the action

## Tasks / Subtasks

### Task 1: Backend — Add PropertyId to UpdateExpenseCommand (AC: #3)

> **Why:** The current `UpdateExpenseCommand` does NOT include `PropertyId`. The backend only updates Amount, Date, CategoryId, Description, WorkOrderId. Property reassignment requires this backend change.

- [x] 1.1 Add `Guid? PropertyId` parameter to `UpdateExpenseCommand` record in `backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs`
- [x] 1.2 Update `UpdateExpenseHandler.Handle()` to set `expense.PropertyId = request.PropertyId` when the value is provided and differs from current
- [x] 1.3 Validate the new PropertyId exists and belongs to the same account (add to existing handler logic or `UpdateExpenseValidator`)
- [x] 1.4 Add `propertyId` to `UpdateExpenseRequest` record in the controller file `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` (request/response records are at bottom of controller file per project convention)
- [x] 1.5 Add `PropertyId = request.PropertyId` mapping in the controller's Update action
- [x] 1.6 If WorkOrderId is set, validate work order belongs to the NEW property (not old one)
- [x] 1.7 Update `UpdateExpenseValidator` in `backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs` — add rule: if PropertyId provided, must be valid Guid
- [x] 1.8 Write unit tests for the new property reassignment path in `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseHandlerTests.cs`
- [x] 1.9 Run `dotnet test` — all tests pass
- [x] 1.10 Regenerate NSwag client: `npm run generate-api` from `/frontend`

### Task 2: Frontend — Add unlinkReceipt to ExpenseService (AC: #5)

> **Why:** `ExpenseService` doesn't have an `unlinkReceipt` method. The NSwag client has `expenses_UnlinkReceipt(id)` but the hand-written service doesn't wrap it.

- [x] 2.1 Add `unlinkReceipt(expenseId: string): Observable<void>` to `frontend/src/app/features/expenses/services/expense.service.ts`
  ```typescript
  unlinkReceipt(expenseId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/expenses/${expenseId}/receipt`);
  }
  ```
- [x] 2.2 Add test for new method in `expense.service.spec.ts`

### Task 3: Frontend — Create ExpenseDetailStore (AC: #2, #3, #4, #5)

> **Why:** The existing `ExpenseStore` is property-scoped (manages expenses within property workspace). The `ExpenseListStore` is for the global list. A new detail store manages single-expense state for the detail page.

**File:** `frontend/src/app/features/expenses/stores/expense-detail.store.ts`

- [x] 3.1 Create `ExpenseDetailStore` signal store with state:
  ```typescript
  interface ExpenseDetailState {
    expense: ExpenseDto | null;
    isLoading: boolean;
    isUpdating: boolean;
    isDeleting: boolean;
    isUnlinkingReceipt: boolean;
    isEditing: boolean;  // view mode vs edit mode toggle
    error: string | null;
  }
  ```
- [x] 3.2 Add methods:
  - `loadExpense: rxMethod<string>` — calls `expenseService.getExpense(id)`, patches state
  - `updateExpense: rxMethod<{ expenseId: string; request: UpdateExpenseRequest }>` — calls service, shows snackbar, reloads expense, exits edit mode
  - `deleteExpense: rxMethod<string>` — calls service, shows snackbar, navigates to `/expenses`
  - `unlinkReceipt: rxMethod<string>` — calls service, shows snackbar, reloads expense
  - `startEditing(): void` — `patchState(store, { isEditing: true })`
  - `cancelEditing(): void` — `patchState(store, { isEditing: false })`
  - `reset(): void`
- [x] 3.3 Add computed signals: `hasReceipt`, `hasWorkOrder`, `isViewMode`
- [x] 3.4 Write spec file `expense-detail.store.spec.ts`

### Task 4: Frontend — Create ExpenseDetailComponent (AC: #1, #2, #3, #4, #5)

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts`

- [x] 4.1 Create component with route param `id` extraction via `input()` (Angular 20+ route input binding) or `ActivatedRoute`
- [x] 4.2 **View Mode** layout (default):
  - Header with back button (← Back to Expenses) and action buttons (Edit, Delete)
  - Card displaying all expense fields in read-only format:
    - Amount (currency formatted)
    - Date (formatted via `formatDateShort` from existing utility)
    - Category name (with Schedule E line if applicable)
    - Description
    - Property name (linked to `/properties/:propertyId`)
    - Receipt section: thumbnail preview if `receiptId` exists + "View Receipt" button (opens `ReceiptLightboxDialogComponent`) + "Unlink Receipt" button. Show "No receipt" if null.
    - Work Order section: if `workOrderId` exists, show link to `/work-orders/:workOrderId`. Show "No work order linked" if null.
    - Created date
- [x] 4.3 **Edit Mode** layout (toggled by Edit button):
  - Form with pre-populated fields using `ReactiveFormsModule`:
    - Amount — `<input matInput appCurrencyInput formControlName="amount">` (reuse `CurrencyInputDirective`)
    - Date — `<mat-datepicker>` with `formControlName="date"`
    - Category — `<mat-select formControlName="categoryId">` populated from `ExpenseStore.sortedCategories` (categories are cached)
    - Description — `<textarea matInput formControlName="description">`
    - Property — `<mat-select formControlName="propertyId">` populated from properties store/service
    - Work Order — optional `<mat-select formControlName="workOrderId">` filtered to work orders for the SELECTED property (re-fetch when property changes)
  - Save and Cancel buttons
  - Validation matching backend: Amount > 0, ≤ $9,999,999.99; Date not future; Category required; Description max 500 chars
- [x] 4.4 **Delete action**: Confirmation dialog (use existing `waitForConfirmDialog` / `confirmDialogAction` pattern or `window.confirm`). On confirm → `store.deleteExpense(id)` → navigate `/expenses`.
- [x] 4.5 **Unlink Receipt action**: Confirmation dialog. On confirm → `store.unlinkReceipt(id)` → reload expense.
- [x] 4.6 Loading state: spinner while `isLoading` is true
- [x] 4.7 Error state: show error card with retry if expense not found (404)
- [x] 4.8 SCSS styles following existing detail page patterns (max-width 800px, centered, card-based)

### Task 5: Frontend — Add Route and Update Navigation (AC: #1)

- [x] 5.1 Add route to `frontend/src/app/app.routes.ts`:
  ```typescript
  {
    path: 'expenses/:id',
    loadComponent: () =>
      import('./features/expenses/expense-detail/expense-detail.component').then(
        (m) => m.ExpenseDetailComponent
      ),
  },
  ```
  Place it AFTER the `expenses` path (list) and BEFORE the `income` path. Angular matches routes top-down; `/expenses/:id` must be after `/expenses` to avoid conflict.

- [x] 5.2 Update `ExpenseListRowComponent` navigation in `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts`:
  - Change `navigateToExpense()` from:
    ```typescript
    this.router.navigate(['/properties', this.expense().propertyId, 'expenses']);
    ```
    To:
    ```typescript
    this.router.navigate(['/expenses', this.expense().id]);
    ```

### Task 6: Frontend — Load Properties for Edit Mode (AC: #3)

> **Why:** The edit form needs a property dropdown. Properties must be fetched. Use the existing `PropertyStore` or `PropertyService`.

- [x] 6.1 Ensure the property list is available when entering edit mode. Either:
  - Inject `PropertyStore` and call `loadProperties()` when edit mode is activated
  - OR inject the NSwag `ApiClient` / `PropertyService` directly and load on demand
- [x] 6.2 When the Property dropdown value changes, re-fetch work orders for the new property (if the work order dropdown is shown)

### Task 7: Unit Tests (AC: all)

- [x] 7.1 `expense-detail.store.spec.ts` — test loadExpense, updateExpense, deleteExpense, unlinkReceipt, edit mode toggling
- [x] 7.2 `expense-detail.component.spec.ts` — test view mode rendering, edit mode toggling, form validation, navigation, delete confirmation
- [x] 7.3 Update `expense-list-row.component.spec.ts` — verify navigation now goes to `/expenses/:id` instead of `/properties/:propertyId/expenses`
- [x] 7.4 `backend/.../UpdateExpenseHandlerTests.cs` — test property reassignment path (new property valid, invalid, same property)

### Task 8: Regenerate API Client

- [x] 8.1 After backend changes, run `npm run generate-api` from `/frontend`
- [x] 8.2 Verify `UpdateExpenseRequest` now includes `propertyId` in the generated client
- [x] 8.3 Update `UpdateExpenseRequest` interface in `expense.service.ts` to add `propertyId?: string`

## Dev Notes

### Critical: Backend Property Reassignment

The epic says "This is purely frontend" but AC3 requires property reassignment. The backend `UpdateExpenseCommand` currently does NOT include `PropertyId`. **Task 1 is a backend change** that must be completed first. This is a small change — add one field to the command record, validate it, and apply it in the handler.

When changing property, if a WorkOrder is linked, validate the work order belongs to the NEW property. If not, either clear the WorkOrderId or reject the update.

### Existing Patterns to Follow

| Pattern | Source | Reuse For |
|---------|--------|-----------|
| Detail page layout (header + back button + card) | `property-detail.component.ts`, `vendor-detail.component.ts` | ExpenseDetailComponent layout |
| Edit form with validation | `expense-form.component.ts`, `expense-edit-form.component.ts` | Edit mode form fields |
| Signal store with rxMethod | `expense.store.ts`, `work-order.store.ts` | ExpenseDetailStore |
| Receipt lightbox dialog | `ReceiptLightboxDialogComponent` (used in expense-list-row) | View receipt from detail |
| Currency input | `CurrencyInputDirective` at `shared/directives/currency-input.directive.ts` | Amount field |
| Delete confirmation | `window.confirm()` or MatDialog (varies by component) | Delete/Unlink actions |
| Date formatting | `formatDateShort()` from `shared/utils/` | Display dates |
| Snackbar notifications | `MatSnackBar` pattern in all stores | Success/error feedback |

### File Structure

```
frontend/src/app/features/expenses/
├── components/
│   └── expense-list-row/          # UPDATE: change navigation target
├── expense-detail/                 # NEW
│   ├── expense-detail.component.ts
│   └── expense-detail.component.spec.ts
├── expense-workspace/             # EXISTING: no changes
├── services/
│   └── expense.service.ts          # UPDATE: add unlinkReceipt method
└── stores/
    ├── expense.store.ts            # EXISTING: no changes
    ├── expense-list.store.ts       # EXISTING: no changes
    └── expense-detail.store.ts     # NEW

backend/src/PropertyManager.Application/Expenses/
├── UpdateExpense.cs                # UPDATE: add PropertyId to command
├── UpdateExpenseValidator.cs       # UPDATE: add PropertyId rule

backend/src/PropertyManager.Api/Controllers/
├── ExpensesController.cs           # UPDATE: add propertyId to UpdateExpenseRequest

frontend/src/app/app.routes.ts      # UPDATE: add expenses/:id route
```

### Architecture Compliance

- **Clean Architecture:** Backend change adds a field to Application layer command. No new layers or dependencies.
- **CQRS:** UpdateExpenseCommand record extended with optional `Guid? PropertyId`. Handler applies conditionally.
- **No try-catch in controller** — global middleware handles exceptions.
- **Validators called explicitly** in controller before `_mediator.Send()`.
- **Frontend signal store** pattern: `{ providedIn: 'root' }`, `withState`, `withComputed`, `withMethods`, `rxMethod<T>`.
- **Standalone components** — no NgModules.
- **`inject()` function** — not constructor injection.

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/expenses/{id}` | GET | Load expense detail |
| `PUT /api/v1/expenses/{id}` | PUT | Update expense (now with propertyId) |
| `DELETE /api/v1/expenses/{id}` | DELETE | Soft-delete expense |
| `DELETE /api/v1/expenses/{id}/receipt` | DELETE | Unlink receipt |
| `GET /api/v1/expense-categories` | GET | Load categories for edit form |
| `GET /api/v1/properties` | GET | Load properties for edit dropdown |

### TypeScript Types (from service layer, NOT NSwag)

```typescript
// expense.service.ts — existing
interface ExpenseDto {
  id: string; propertyId: string; propertyName: string;
  categoryId: string; categoryName: string; scheduleELine?: string;
  amount: number; date: string; description?: string;
  receiptId?: string; workOrderId?: string; createdAt: string;
}

// expense.service.ts — UPDATE (add propertyId)
interface UpdateExpenseRequest {
  amount: number; date: string; categoryId: string;
  description?: string; workOrderId?: string;
  propertyId?: string;  // NEW — for property reassignment
}
```

### Previous Story Intelligence (from 15.4)

- Story 15.4 fixed `UnlinkReceipt` handler to use `Include(e => e.Receipt)` approach and clear both FK sides. The endpoint works correctly now.
- No frontend changes were needed for 15.4 — the API contract is unchanged.
- The `DELETE /api/v1/expenses/{id}/receipt` endpoint returns 204 on success, 404 if expense or receipt not found.

### Git Recent Patterns

Recent commits show:
- Story 15.3 added sorting, date persistence, and Add Expense button to the expense list page
- Story 15.1 fixed login form issues
- E2E test isolation patterns using `page.route()` for intercepting API responses
- Code review fixes focused on null handling and error handling cleanup

### Testing Requirements

**Backend:** xUnit + Moq + FluentAssertions
- Test property reassignment in handler tests
- Test validator accepts/rejects propertyId
- Test that changing property clears WorkOrderId if work order doesn't belong to new property

**Frontend:** Vitest (run via `npm test` from `/frontend`, NEVER `npx vitest`)
- Store tests: mock ExpenseService, verify state transitions
- Component tests: TestBed with mocked store, verify view/edit mode rendering

### References

- [Source: _bmad-output/implementation-artifacts/epic-15-manual-testing-bug-fixes.md#Story 15.5]
- [Source: backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs — current command definition]
- [Source: frontend/src/app/features/expenses/services/expense.service.ts — all service methods]
- [Source: frontend/src/app/features/expenses/stores/expense.store.ts — property-scoped store pattern]
- [Source: frontend/src/app/features/expenses/stores/expense-list.store.ts — global list store pattern]
- [Source: frontend/src/app/features/expenses/components/expense-list-row/ — current row navigation]
- [Source: frontend/src/app/app.routes.ts — current routing structure]
- [Source: _bmad-output/project-context.md — project rules and patterns]

## Dev Agent Record

### Agent Model Used
claude-opus-4-6

### Debug Log References
- E2E test flakiness traced to auth refresh rate limiting (5 login/min, 10 refresh/min)
- Fixed pre-existing `initializeAuth()` race condition with `shareReplay(1)` deduplication

### Completion Notes List
- All 4 implementation phases completed
- Backend: Added PropertyId to UpdateExpenseCommand with validation + 4 new unit tests
- Frontend: Created ExpenseDetailStore, ExpenseDetailComponent, added route, updated navigation
- Bonus: Fixed auth service `initializeAuth()` race condition (AppComponent + auth guard both called it on page reload)
- All 2,352 unit tests pass, all 9 E2E acceptance tests pass, all 21 expense E2E tests pass

### File List
**Backend (modified):**
- `backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs` — added Guid? PropertyId to command + handler logic
- `backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs` — added PropertyId rule
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` — added propertyId to request record
- `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseHandlerTests.cs` — 4 new tests

**Frontend (new):**
- `frontend/src/app/features/expenses/stores/expense-detail.store.ts`
- `frontend/src/app/features/expenses/stores/expense-detail.store.spec.ts`
- `frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts`
- `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts`

**Frontend (modified):**
- `frontend/src/app/features/expenses/services/expense.service.ts` — added propertyId to UpdateExpenseRequest, added unlinkReceipt()
- `frontend/src/app/app.routes.ts` — added expenses/:id route
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` — updated navigation to /expenses/:id
- `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.spec.ts` — updated test expectations
- `frontend/src/app/core/services/auth.service.ts` — fixed initializeAuth() race condition with shareReplay(1)
