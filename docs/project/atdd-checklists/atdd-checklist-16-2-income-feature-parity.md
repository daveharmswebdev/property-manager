# ATDD Checklist - Story 16.2: Income Feature Parity

**Date:** 2026-02-20
**Author:** Dave
**Primary Test Level:** E2E (Playwright)

---

## Story Summary

**As a** property owner tracking rental income,
**I want** to add, edit, and view income from the global income list,
**So that** I don't have to navigate through property detail to manage income.

This story brings the `/income` page to feature parity with `/expenses` by adding: an "Add Income" button with property picker logic, row-level edit/delete actions, a detail view at `/income/:id` with full CRUD, and property reassignment on edit.

---

## Acceptance Criteria

1. **AC1** — "Add Income" button on `/income` page: single property → navigate directly, multiple → property picker dialog, zero → snackbar
2. **AC2** — Edit/delete action icons on list rows: edit navigates to detail, delete shows confirm dialog then soft-deletes
3. **AC3** — Income detail view at `/income/:id`: displays amount, date, source, description, property name; "Back to Income" link; Edit/Delete buttons
4. **AC4** — Edit all fields including property: form with Amount, Date, Source, Description, Property dropdown; property reassignment; "Income updated" snackbar
5. **AC5** — Delete from detail view: confirm dialog, soft-delete, navigate to `/income`, "Income deleted" snackbar

---

## Failing Tests Created (RED Phase)

### E2E Tests (12 tests)

**File:** `frontend/e2e/tests/income/income-detail.spec.ts`

- **Test:** AC1: should navigate directly to income workspace when single property
  - **Status:** RED — "Add Income" button does not exist on `/income` page
  - **Verifies:** Single-property shortcut navigation to `/properties/:id/income`

- **Test:** AC1: should open property picker dialog when multiple properties
  - **Status:** RED — "Add Income" button does not exist; no `onAddIncome()` method
  - **Verifies:** PropertyPickerDialogComponent opens and navigates to selected property

- **Test:** AC1: should show snackbar when zero properties exist
  - **Status:** RED — "Add Income" button does not exist
  - **Verifies:** Snackbar "Create a property first before adding income."

- **Test:** AC2: should navigate to /income/:id when clicking income row in list
  - **Status:** RED — Income rows have no click handler; `/income/:id` route does not exist
  - **Verifies:** Row click navigates to income detail page

- **Test:** AC2: should delete income from list row with confirmation dialog
  - **Status:** RED — No action icons on income rows; no delete flow on list page
  - **Verifies:** Delete icon → confirm dialog → "Income deleted" snackbar → row removed

- **Test:** AC3: should display all income fields in read-only detail view
  - **Status:** RED — `/income/:id` route and IncomeDetailComponent do not exist
  - **Verifies:** Amount, date, source, description, property name displayed with Edit/Delete buttons

- **Test:** AC3: should navigate back to /income via "Back to Income" link
  - **Status:** RED — IncomeDetailComponent does not exist
  - **Verifies:** Back link returns to `/income` list page

- **Test:** AC4: should enter edit mode with pre-populated form
  - **Status:** RED — IncomeDetailComponent/Store do not exist
  - **Verifies:** Edit button shows form with amount, source, property dropdown, description inputs

- **Test:** AC4: should save updated income and return to view mode
  - **Status:** RED — IncomeDetailStore does not exist
  - **Verifies:** Modified fields persist, "Income updated" snackbar, view mode restored

- **Test:** AC4: should reassign income to different property
  - **Status:** RED — Backend UpdateIncomeCommand missing PropertyId; no property dropdown
  - **Verifies:** Property dropdown changes property assignment on save

- **Test:** AC4: should cancel edit and revert to view mode without changes
  - **Status:** RED — IncomeDetailComponent does not exist
  - **Verifies:** Cancel discards changes and restores original values

- **Test:** AC5: should delete income from detail view with confirmation and navigate to /income
  - **Status:** RED — IncomeDetailComponent/Store do not exist
  - **Verifies:** Delete → confirm dialog → "Income deleted" snackbar → navigate to `/income`

---

## Infrastructure Created

### Page Object

**File:** `frontend/e2e/pages/income-detail.page.ts`

Modeled on `ExpenseDetailPage`. Provides:
- View mode assertions: `expectViewMode()`, `expectAmount()`, `expectSource()`, `expectProperty()`, `expectDescription()`
- Edit mode assertions: `expectEditMode()`
- Actions: `clickEdit()`, `clickDelete()`, `submitEdit()`, `cancelEdit()`, `clickBack()`
- Form helpers: `fillAmount()`, `fillSource()`, `fillDescription()`, `selectProperty()`
- Navigation: `gotoIncome(incomeId)`
- Inherits from `BasePage`: `waitForLoading()`, `expectSnackBar()`, `waitForConfirmDialog()`, `confirmDialogAction()`

### Fixture

**File:** `frontend/e2e/fixtures/test-fixtures.ts` (modified)

Added `incomeDetailPage` fixture:
```typescript
incomeDetailPage: async ({ page }, use) => {
  await use(new IncomeDetailPage(page));
},
```

### Helper Function

Spec-local `createIncomeAndGetId()` helper:
- Creates property via `createPropertyAndGetId()`
- Navigates to income workspace via `propertyDetailPage.clickAddIncome()`
- Creates income entry and captures ID from POST response (network-first pattern)
- Returns `{ incomeId, propertyId, propertyData, testIncome }`

---

## Required data-testid Attributes

### Income Detail Page (IncomeDetailComponent)

- `income-amount` — Amount display (currency formatted)
- `income-date` — Date display (formatDateShort)
- `income-source` — Source display (e.g., "Tenant Rent")
- `income-description` — Description display
- `income-property` — Property name display
- `income-created-date` — Created date display

### Income List Page (IncomeComponent — modified)

- `.page-header button` containing "Add Income" — Add Income button
- `.cell-actions` — Action icons container on each row (edit + delete)
- `.income-row` — Clickable row (existing class, add click handler)

---

## Implementation Checklist

### Test: AC1 — Add Income button (3 tests)

**File:** `frontend/src/app/features/income/income.component.ts`

**Tasks to make these tests pass:**

- [ ] Add imports: `Router`, `MatDialog`, `MatSnackBar`, `PropertyService`, `PropertyPickerDialogComponent`, `firstValueFrom`
- [ ] Update page header template to include "Add Income" button with `mat-stroked-button`
- [ ] Add `onAddIncome()` method (copy from `ExpensesComponent.onAddExpense()` lines 393-423)
- [ ] 0 properties → snackbar "Create a property first before adding income."
- [ ] 1 property → `router.navigate(['/properties', id, 'income'])`
- [ ] Multiple → open `PropertyPickerDialogComponent`, navigate to selected property
- [ ] Add `page-header-content` CSS for flex layout (header text left, button right)
- [ ] Run test: `npm run test:e2e -- e2e/tests/income/income-detail.spec.ts`
- [ ] 3 AC1 tests pass (green phase)

### Test: AC2 — Row navigation + delete from list (2 tests)

**File:** `frontend/src/app/features/income/income.component.ts`

**Tasks to make these tests pass:**

- [ ] Add imports: `ConfirmDialogComponent`, `ConfirmDialogData`, `IncomeService`
- [ ] Add click handler on `.income-row`: `(click)="navigateToDetail(income)"`
- [ ] Add `navigateToDetail(income)` method: `router.navigate(['/income', income.id])`
- [ ] Add `.cell-actions` column with edit and delete icon buttons
- [ ] Edit icon: `navigateToDetail(income)` (same as row click)
- [ ] Delete icon: `onDeleteIncome(income)` with `ConfirmDialogComponent`
- [ ] On confirm: call `incomeService.deleteIncome()`, refresh list, show snackbar
- [ ] Update grid-template-columns to include actions column
- [ ] Add `cursor: pointer` on `.income-row`, hover effect
- [ ] Run test: `npm run test:e2e -- e2e/tests/income/income-detail.spec.ts`
- [ ] 2 AC2 tests pass (green phase)

### Test: AC3 — Income detail route + view (2 tests)

**Files:** `frontend/src/app/app.routes.ts`, new `IncomeDetailComponent`

**Tasks to make these tests pass:**

- [ ] Register `/income/:id` route in `app.routes.ts` (after existing `/income` route)
- [ ] Create `IncomeDetailComponent` at `features/income/income-detail/income-detail.component.ts`
- [ ] View mode template: Back link, amount, date, source, description, property name
- [ ] Add `data-testid` attributes: `income-amount`, `income-date`, `income-source`, `income-description`, `income-property`
- [ ] Edit and Delete action buttons in view mode
- [ ] Inject `ActivatedRoute` to extract `:id` param
- [ ] Run test: `npm run test:e2e -- e2e/tests/income/income-detail.spec.ts`
- [ ] 2 AC3 tests pass (green phase)

### Test: AC4 — Edit with property reassignment (4 tests)

**Files:** `IncomeDetailStore`, `IncomeDetailComponent`, backend `UpdateIncome.cs`, `IncomeController.cs`, `income.service.ts`

**Tasks to make these tests pass:**

- [ ] **Backend:** Add `Guid? PropertyId = null` to `UpdateIncomeCommand`
- [ ] **Backend:** Add property reassignment logic to `UpdateIncomeCommandHandler` (copy from `UpdateExpenseCommandHandler`)
- [ ] **Backend:** Add PropertyId validation to `UpdateIncomeValidator`
- [ ] **Backend:** Add `Guid? PropertyId = null` to `UpdateIncomeRequest` in controller
- [ ] **Backend:** Pass PropertyId in controller action
- [ ] **Frontend:** Add `propertyId?: string` to `UpdateIncomeRequest` interface in `income.service.ts`
- [ ] Create `IncomeDetailStore` at `features/income/stores/income-detail.store.ts`
- [ ] Store methods: `loadIncome`, `updateIncome`, `deleteIncome`, `startEditing`, `cancelEditing`, `reset`
- [ ] Edit mode template: Amount input, Date picker, Source input, Description textarea, Property dropdown
- [ ] `formControlName` attributes: `amount`, `date`, `source`, `description`, `propertyId`
- [ ] Save button submits form → `store.updateIncome()` → snackbar "Income updated" → view mode
- [ ] Cancel button → `store.cancelEditing()` → view mode with original values
- [ ] Load properties via `PropertyService.getProperties()` for dropdown
- [ ] Run test: `npm run test:e2e -- e2e/tests/income/income-detail.spec.ts`
- [ ] 4 AC4 tests pass (green phase)

### Test: AC5 — Delete from detail (1 test)

**File:** `IncomeDetailComponent`, `IncomeDetailStore`

**Tasks to make these tests pass:**

- [ ] Delete button opens `ConfirmDialogComponent` with "Delete Income?" title
- [ ] On confirm → `store.deleteIncome(id)` → snackbar "Income deleted" → `router.navigate(['/income'])`
- [ ] Run test: `npm run test:e2e -- e2e/tests/income/income-detail.spec.ts`
- [ ] 1 AC5 test passes (green phase)

---

## Running Tests

```bash
# Run all failing tests for this story
npm run test:e2e -- e2e/tests/income/income-detail.spec.ts

# Run specific test by title
npm run test:e2e -- e2e/tests/income/income-detail.spec.ts -g "AC1"

# Run tests in headed mode (see browser)
npm run test:e2e -- e2e/tests/income/income-detail.spec.ts --headed

# Debug specific test
npm run test:e2e -- e2e/tests/income/income-detail.spec.ts --debug

# Run with single worker (match CI)
npm run test:e2e -- e2e/tests/income/income-detail.spec.ts --workers=1
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 12 E2E tests written and failing
- Page object created (`income-detail.page.ts`) with auto-inherited cleanup
- Fixture registered (`incomeDetailPage`)
- Helper function for income creation with ID capture
- data-testid requirements documented
- Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failures are due to missing implementation, not test bugs
- Tests follow Given-When-Then structure with network-first patterns

---

### GREEN Phase (DEV Team — Next Steps)

1. **Pick one failing test** from implementation checklist (start with AC3 route + basic view)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify green
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Recommended Order:**

1. AC3 (route + detail view) — Foundation for all other tests
2. AC4 (edit + store) — Core functionality
3. AC5 (delete from detail) — Quick win after store exists
4. AC1 (add button) — Independent from detail page
5. AC2 (row actions) — Last, builds on detail route

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 12 tests pass
2. Review code for consistency with expense patterns
3. Extract shared patterns if applicable
4. Ensure tests still pass after each refactor

---

## Knowledge Base References Applied

- **fixture-architecture.md** — Page object extends BasePage with inherited helpers
- **data-factories.md** — TestDataHelper.generateIncome() with timestamp uniqueness
- **network-first.md** — `page.route()` for property count simulation; `waitForResponse` for ID capture
- **component-tdd.md** — Given-When-Then structure throughout
- **test-quality.md** — Atomic tests, one assertion focus per test, deterministic waits
- **selector-resilience.md** — data-testid for view fields, formControlName for form elements
- **timing-debugging.md** — `waitForLoadState('networkidle')` before assertions, explicit waits

---

**Generated by BMad TEA Agent** — 2026-02-20
