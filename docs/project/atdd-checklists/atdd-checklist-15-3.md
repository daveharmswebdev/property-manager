# ATDD Checklist — Story 15.3: Expense List UX Improvements

**Date:** 2026-02-15
**Author:** Dave (via TEA Agent Murat)
**Primary Test Level:** E2E (Playwright) + Unit (xUnit backend)

---

## Story Summary

**As a** property owner viewing my expenses
**I want** to create expenses from the list page, have my filters persist, and sort by columns
**So that** the expense list is fully functional and not read-only

---

## Acceptance Criteria

1. **AC1 — Add Expense button (#204):** Button in page header navigates to expense workspace (single property: direct, multiple: dialog picker)
2. **AC2 — Custom date range persistence (#206):** Date picker values repopulate on SPA navigation; sessionStorage restores after page refresh
3. **AC3 — Column sorting (#207):** Clickable column headers with sort direction indicators; server-side sorting via API params

---

## Failing Tests Created (RED Phase)

### E2E Tests (5 tests)

**File:** `frontend/e2e/tests/expenses/expense-list-ux.spec.ts`

- **Test:** AC1: should navigate directly to expense workspace when single property
  - **Status:** RED — No "Add Expense" button exists in `.page-header`
  - **Verifies:** Button visible + single-property direct navigation to `/properties/{id}/expenses`

- **Test:** AC1: should open property picker dialog when multiple properties
  - **Status:** RED — No "Add Expense" button exists; no PropertyPickerDialogComponent
  - **Verifies:** Dialog opens with property list, selecting navigates to correct workspace

- **Test:** AC2: should persist custom date picker values across SPA navigation
  - **Status:** RED — `customDateFrom`/`customDateTo` FormControls don't sync from store signals
  - **Verifies:** After navigate away → back, From/To date pickers repopulate (not empty)

- **Test:** AC2: should restore custom date range from sessionStorage after page refresh
  - **Status:** RED — No sessionStorage persistence logic in `expense-list.store.ts`
  - **Verifies:** After hard refresh, preset shows "Custom Range" and date pickers repopulate

- **Test:** AC3: should sort by column with direction indicator and toggle
  - **Status:** RED — Column headers are static `<div>` elements, not clickable buttons
  - **Verifies:** Amount header clickable → sort icon appears → click again → direction toggles

### Backend Unit Tests (4 tests)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesHandlerTests.cs`

- **Test:** Handle_SortByAmountAscending_ReturnsItemsSortedByAmount
  - **Status:** RED — `GetAllExpensesQuery` has no `SortBy`/`SortDirection` params (won't compile)
  - **Verifies:** Expenses returned sorted by amount ascending

- **Test:** Handle_SortByDateAscending_ReturnsOldestFirst
  - **Status:** RED — Same compile error; handler hardcodes date descending
  - **Verifies:** Explicit `asc` direction overrides default descending

- **Test:** Handle_SortByPropertyName_ReturnsItemsSortedByPropertyName
  - **Status:** RED — Same compile error; tests navigation property sort (Property.Name)
  - **Verifies:** Sort by navigation property works through EF Select projection

- **Test:** Handle_NullSortBy_DefaultsToDateDescending
  - **Status:** RED — Same compile error
  - **Verifies:** Backward compatibility — null sort params preserve existing date desc behavior

---

## Data Infrastructure

### Existing Fixtures (Reused)

- `authenticatedUser` — Auto-logs in with seeded owner account (`claude@claude.com`)
- `dashboardPage`, `propertyFormPage`, `propertyDetailPage`, `expenseWorkspacePage` — Page objects
- `createPropertyAndGetId()` — Helper to create property through UI and extract ID
- `TestDataHelper.generateExpense()` — Factory for test expense data

### No New Factories Needed

The existing `TestDataHelper` and `createPropertyAndGetId` are sufficient. No faker/factory additions required.

### Mock Requirements

**Backend tests:** Standard `Mock<IAppDbContext>` with `MockQueryable.Moq` for DbSet mocking. Pattern copied from existing `GetExpensesByPropertyHandlerTests.cs`.

---

## Implementation Checklist

### Test: AC1 — Add Expense button (single + multi property)

**Tasks to make these tests pass:**

- [ ] Create `PropertyPickerDialogComponent` (standalone, `mat-selection-list`)
- [ ] Add "Add Expense" `mat-stroked-button` with `mat-icon "add"` to `.page-header` in `expenses.component.ts`
- [ ] Inject `Router`, `PropertyStore`, `MatDialog` in `ExpensesComponent`
- [ ] Implement `onAddExpense()`: if 1 property → navigate, if multiple → open dialog
- [ ] Run E2E: `npm run test:e2e -- expense-list-ux`
- [ ] Tests pass (green phase)

### Test: AC2 — Date range navigation persistence

**Tasks to make this test pass:**

- [ ] Add `dateFrom` and `dateTo` signal inputs to `ExpenseFiltersComponent`
- [ ] Add `effect()` to sync inputs → `customDateFrom`/`customDateTo` FormControls
- [ ] Pass `[dateFrom]="store.dateFrom()"` `[dateTo]="store.dateTo()"` from `expenses.component.ts`
- [ ] Run E2E: `npm run test:e2e -- expense-list-ux`
- [ ] Test passes (green phase)

### Test: AC2 — sessionStorage refresh persistence

**Tasks to make this test pass:**

- [ ] Add `persistDateFilter()` / `restoreDateFilter()` helpers in `expense-list.store.ts`
- [ ] Call `restoreDateFilter()` in `initialize()` before loading
- [ ] Call `persistDateFilter()` in `setDateRangePreset()`, `setCustomDateRange()`, `clearFilters()`, `removeFilterChip()` (date chip)
- [ ] Run E2E: `npm run test:e2e -- expense-list-ux`
- [ ] Test passes (green phase)

### Test: AC3 — Backend sort (4 tests)

**Tasks to make these tests compile and pass:**

- [ ] Add `string? SortBy` and `string? SortDirection` to `GetAllExpensesQuery` record
- [ ] Implement dynamic sort with switch expression in `GetAllExpensesHandler.Handle()`
- [ ] Add `[FromQuery] string? sortBy`, `[FromQuery] string? sortDirection` to `ExpensesController.GetAllExpenses()`
- [ ] Run: `dotnet test` from `/backend`
- [ ] All 4 tests pass (green phase)

### Test: AC3 — Frontend sort UI

**Tasks to make the E2E test pass:**

- [ ] Add `sortBy: string | null` and `sortDirection: 'asc' | 'desc'` to store state
- [ ] Add `setSort(column)` method — toggles direction or resets for new column
- [ ] Include `sortBy`/`sortDirection` in `currentFilters` computed and `ExpenseFilters` interface
- [ ] Pass sort params in `expense.service.ts` `getExpenses()` call
- [ ] Replace static `.list-header` divs with clickable `<button>` elements
- [ ] Add `mat-icon` sort indicators (`arrow_upward`/`arrow_downward`)
- [ ] Run `npm run generate-api` to pick up new backend params
- [ ] Run E2E: `npm run test:e2e -- expense-list-ux`
- [ ] Test passes (green phase)

---

## Running Tests

```bash
# Run all Story 15.3 E2E tests
npm run test:e2e -- --grep "Story 15.3" --project chromium

# Run specific test file
npm run test:e2e -- e2e/tests/expenses/expense-list-ux.spec.ts

# Run in headed mode (see browser)
npm run test:e2e -- e2e/tests/expenses/expense-list-ux.spec.ts --headed

# Run backend sort tests (will fail to compile until query record updated)
dotnet test --filter "FullyQualifiedName~GetAllExpensesHandlerTests" --project backend/tests/PropertyManager.Application.Tests

# Run all frontend unit tests
npm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- [x] 5 E2E acceptance tests written and expected to fail
- [x] 4 backend unit tests written (won't compile until SortBy/SortDirection added)
- [x] All tests use existing fixtures and helpers (no new infrastructure)
- [x] Implementation checklist maps each test to concrete tasks

### GREEN Phase (DEV Team)

1. Start with **backend sort** (Task 4) — adds API capability
2. Then **Add Expense button** (Task 1) — independent UI feature
3. Then **date navigation persistence** (Task 2) — smallest change, fixes bug
4. Then **sessionStorage persistence** (Task 3) — builds on Task 2
5. Then **frontend sort UI** (Task 5) — depends on backend sort
6. Finally **generate API client** (Task 6) — depends on backend changes

### REFACTOR Phase (DEV Team)

- Extract sort header into reusable component if pattern repeats
- Consider extracting sessionStorage helpers to shared utility
- All tests must still pass after refactoring

---

## Notes

- **No new data-testid attributes required** — tests use existing selectors (`.page-header button`, `.list-header button`, `mat-dialog-container`, `mat-form-field`, `mat-select`, `mat-icon`, `mat-list-option`)
- **Backend tests deliberately won't compile** — this is the RED state for compiled languages. DEV adds query params first (makes it compile), then implements sort logic (makes it pass).
- **E2E AC2 navigation test** targets the exact bug: `customDateFrom`/`customDateTo` FormControls initialize to `null` and never sync from store signals. The `searchText` sync pattern (line 252-257 in `expense-filters.component.ts`) is the proven fix pattern.
- **Seeded account** (`claude@claude.com`) has 1 property — used for AC1 single-property test. Multi-property test creates a second property via `createPropertyAndGetId()`.

---

**Generated by BMad TEA Agent** — 2026-02-15
