# ATDD Checklist - Story 16.6: Shared Component Extraction

**Date:** 2026-02-21
**Author:** Dave (TEA Agent: Murat)
**Primary Test Level:** Component/Unit (Vitest + xUnit)
**Secondary:** E2E (Playwright)

---

## Story Summary

**As a** developer maintaining the application
**I want** reusable date range and total display components
**So that** list views are consistent and changes only need to happen in one place

---

## Acceptance Criteria

1. **AC1 — Shared date range selector (#215):** Any list view with date filtering uses a shared `DateRangeFilterComponent` with presets (All Time, This Month, This Quarter, This Year, Custom Range). Expenses and Income both use this shared component.
2. **AC2 — Shared total amount display (#216):** List views showing financial records use a shared `ListTotalDisplayComponent` accepting a label and currency value. Both Income and Expenses show their respective totals.

---

## Failing Tests Created (RED Phase)

### Unit Tests — `date-range.utils.spec.ts` (13 tests)

**File:** `frontend/src/app/shared/utils/date-range.utils.spec.ts`

- **Test:** `getDateRangeFromPreset > this-month > returns first day of current month as dateFrom`
  - **Status:** RED — Cannot find module `./date-range.utils`
  - **Verifies:** AC1 — preset date calculation
- **Test:** `getDateRangeFromPreset > this-month > returns today as dateTo`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — preset date calculation
- **Test:** `getDateRangeFromPreset > this-quarter > returns first day of current quarter`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — quarter boundary calculation
- **Test:** `getDateRangeFromPreset > this-quarter > returns today as dateTo`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — quarter boundary calculation
- **Test:** `getDateRangeFromPreset > this-year > returns Jan 1 as dateFrom`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — year boundary calculation
- **Test:** `getDateRangeFromPreset > this-year > returns Dec 31 as dateTo`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — year boundary calculation
- **Test:** `getDateRangeFromPreset > this-year with explicit year > returns Jan 1 of given year`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — year override for tax year selector
- **Test:** `getDateRangeFromPreset > this-year with explicit year > returns Dec 31 of given year`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — year override for tax year selector
- **Test:** `getDateRangeFromPreset > all preset > returns null dateFrom`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — no date filter on "All Time"
- **Test:** `getDateRangeFromPreset > all preset > returns null dateTo`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — no date filter on "All Time"
- **Test:** `getDateRangeFromPreset > custom preset > returns null dateFrom`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — custom mode defers to user input
- **Test:** `getDateRangeFromPreset > custom preset > returns null dateTo`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — custom mode defers to user input
- **Test:** `DateRangePreset type > should accept all valid preset values`
  - **Status:** RED — Module not found
  - **Verifies:** AC1 — type completeness

---

### Component Tests — `date-range-filter.component.spec.ts` (11 tests)

**File:** `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`

- **Test:** `should create`
  - **Status:** RED — Cannot find module `./date-range-filter.component`
  - **Verifies:** AC1 — component exists
- **Test:** `preset dropdown > should render date range preset dropdown`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — mat-select renders
- **Test:** `preset dropdown > should default to all preset`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — default state
- **Test:** `preset dropdown > should emit dateRangePresetChange on preset selection`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — output event emission
- **Test:** `preset dropdown > should emit for each preset value`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — all presets work
- **Test:** `custom date range > should NOT show date inputs when preset is not custom`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — conditional rendering
- **Test:** `custom date range > should show date inputs when preset is custom`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — conditional rendering
- **Test:** `custom date range > should emit customDateRangeChange with formatted dates on Apply`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — date formatting + emission
- **Test:** `custom date range > should NOT emit if dateFrom is missing`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — validation guard
- **Test:** `custom date range > should NOT emit if dateTo is missing`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — validation guard
- **Test:** `input synchronization > syncs dateFrom/dateTo/clears on preset change`
  - **Status:** RED — Component not found
  - **Verifies:** AC1 — parent↔child sync

---

### Component Tests — `list-total-display.component.spec.ts` (8 tests)

**File:** `frontend/src/app/shared/components/list-total-display/list-total-display.component.spec.ts`

- **Test:** `should create`
  - **Status:** RED — Cannot find module `./list-total-display.component`
  - **Verifies:** AC2 — component exists
- **Test:** `should render label text`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — label display
- **Test:** `should format amount as currency`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — Angular currency pipe formatting
- **Test:** `should show border when showBorder is true`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — CSS class toggle
- **Test:** `should NOT show border by default`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — default state
- **Test:** `should handle zero amount`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — edge case ($0.00)
- **Test:** `should handle large amounts with proper formatting`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — comma separators
- **Test:** `should display label with colon separator`
  - **Status:** RED — Component not found
  - **Verifies:** AC2 — label formatting

---

### Backend Tests — `GetAllExpensesTotalAmountTests.cs` (5 tests)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesTotalAmountTests.cs`

- **Test:** `Handle_ReturnsCorrectTotalAmount_ForAllFilteredExpenses`
  - **Status:** RED — `PagedResult<T>` has no `TotalAmount` property (compilation error)
  - **Verifies:** AC2 — sum of all filtered amounts
- **Test:** `Handle_TotalAmountIsNotAffectedByPagination`
  - **Status:** RED — Compilation error
  - **Verifies:** AC2 — total spans ALL pages, not just current page
- **Test:** `Handle_TotalAmountRespectsDateFilters`
  - **Status:** RED — Compilation error
  - **Verifies:** AC2 — filtered sum respects date range
- **Test:** `Handle_TotalAmountRespectsCategoryFilter`
  - **Status:** RED — Compilation error
  - **Verifies:** AC2 — filtered sum respects category selection
- **Test:** `Handle_TotalAmountIsZero_WhenNoExpensesMatch`
  - **Status:** RED — Compilation error
  - **Verifies:** AC2 — zero default for empty result sets

---

### E2E Tests — `income-shared-components.spec.ts` (4 tests)

**File:** `frontend/e2e/tests/income/income-shared-components.spec.ts`

- **Test:** `Date Range Presets > should display date range preset dropdown`
  - **Status:** RED — `app-date-range-filter` element not found on income page
  - **Verifies:** AC1 — shared component integrated into income
- **Test:** `Date Range Presets > should show 5 preset options when dropdown opened`
  - **Status:** RED — Element not found
  - **Verifies:** AC1 — all presets available
- **Test:** `Date Range Presets > should show custom date inputs when Custom Range selected`
  - **Status:** RED — Element not found
  - **Verifies:** AC1 — custom mode toggle
- **Test:** `Total Income > should display total using shared ListTotalDisplayComponent`
  - **Status:** RED — `app-list-total-display` element not found
  - **Verifies:** AC2 — shared total component on income page

---

### E2E Tests — `expense-total-display.spec.ts` (2 tests)

**File:** `frontend/e2e/tests/expenses/expense-total-display.spec.ts`

- **Test:** `should display total expenses amount using shared component`
  - **Status:** RED — `app-list-total-display` element not found on expenses page
  - **Verifies:** AC2 — total amount displayed from API `totalAmount` field
- **Test:** `should NOT show total when no expenses exist`
  - **Status:** RED — Element not found (or passes vacuously — recheck after implementation)
  - **Verifies:** AC2 — hidden when empty

---

## Tests to Modify During GREEN Phase

These existing test files need updates when implementing the story. Do NOT modify them during RED phase — they currently pass.

### `expense-filters.component.spec.ts`
- Adapt date range tests to verify the nested `<app-date-range-filter>` component
- Category and search tests should remain unchanged
- Update any selectors that reference the old inline date range template

### `expense-list.store.spec.ts`
- Add test: `totalAmount` is set from API response
- Add test: `totalAmount` resets to 0 when filters change
- Update imports: `DateRangePreset` and `getDateRangeFromPreset` from `shared/utils/date-range.utils`
- Existing date range preset tests should pass after import path change

### `income.component.spec.ts`
- Add mock for `dateRangePreset` signal
- Add test: date range filter renders via shared component
- Add test: preset change calls store method
- Replace total section test to use `app-list-total-display`

### `income-list.store.spec.ts`
- Add test: `setDateRangePreset()` triggers reload with correct dates
- Add test: `setCustomDateRange()` sets preset to 'custom' and reloads
- Add test: sessionStorage persistence — save, restore, clear

---

## Mock Requirements

No external service mocking required. All API interactions use route interception in E2E tests.

### E2E Route Interceptions Used

| Endpoint | Test File | Response Shape |
|---|---|---|
| `*/**/api/v1/income*` | income-shared-components.spec.ts | `{ items, totalCount, totalAmount }` |
| `*/**/api/v1/expenses*` | expense-total-display.spec.ts | `{ items, totalCount, page, pageSize, totalPages, totalAmount }` |
| `*/**/api/v1/expense-categories` | expense-total-display.spec.ts | `[{ id, name, scheduleELine }]` |

---

## Required data-testid Attributes

None required for this story. Tests use Angular component selectors (`app-date-range-filter`, `app-list-total-display`) and CSS classes (`.date-fields`, `.total-label`, `.total-amount`, `.list-total`, `.with-border`). This is consistent with the existing project pattern.

---

## Implementation Checklist

### Task 1: Extract DateRangeFilterComponent (AC1)

**Makes these tests compilable/pass:**
- `date-range.utils.spec.ts` (all 13 tests)
- `date-range-filter.component.spec.ts` (all 11 tests)

**Steps:**
- [ ] 1.1 Create `shared/utils/date-range.utils.ts` with `DateRangePreset` type and `getDateRangeFromPreset()`
- [ ] 1.2 Create `DateRangeFilterComponent` with signal inputs/outputs
- [ ] 1.3 Move date range template from expense-filters
- [ ] 1.4 Move date range SCSS from expense-filters
- [ ] Run: `npm test` from `/frontend` — verify 24 new tests pass

### Task 2: Replace date range in ExpenseFiltersComponent (AC1)

**Modifies:** `expense-filters.component.spec.ts`

**Steps:**
- [ ] 2.1 Replace inline date range template with `<app-date-range-filter>`
- [ ] 2.2 Remove redundant code (FormControls, method, SCSS)
- [ ] 2.3 Update `expense-list.store.ts` imports to use shared utility
- [ ] 2.4 Update `expense-filters.component.spec.ts` for nested component
- [ ] Run: `npm test` — verify all existing expense tests still pass

### Task 3: Add date range filter to Income page (AC1)

**Makes E2E tests pass:** `income-shared-components.spec.ts` (3 date range tests)
**Modifies:** `income-list.store.spec.ts`, `income.component.spec.ts`

**Steps:**
- [ ] 3.1 Replace inline date pickers with `<app-date-range-filter>` in income template
- [ ] 3.2 Remove redundant date picker code
- [ ] 3.3 Add preset support to `income-list.store.ts` (state, methods, sessionStorage)
- [ ] 3.4 Add event handlers to `income.component.ts`
- [ ] 3.5 Update `income-list.store.spec.ts` with preset/persistence tests
- [ ] 3.6 Update `income.component.spec.ts` for shared component
- [ ] Run: `npm test` — all income tests pass

### Task 4: Create ListTotalDisplayComponent (AC2)

**Makes these tests pass:** `list-total-display.component.spec.ts` (all 8 tests)

**Steps:**
- [ ] 4.1 Create component with `label`, `amount`, `showBorder` inputs
- [ ] 4.2 Verify spec tests pass
- [ ] Run: `npm test` — 8 new tests pass

### Task 5: Add TotalAmount to expense list backend (AC2)

**Makes these tests compilable/pass:** `GetAllExpensesTotalAmountTests.cs` (all 5 tests)

**Steps:**
- [ ] 5.1 Add `decimal TotalAmount = 0` to `PagedResult<T>` record
- [ ] 5.2 Add `SumAsync(e => e.Amount)` before pagination in handler
- [ ] 5.3 Pass `TotalAmount: totalAmount` in return statement
- [ ] Run: `dotnet test` — 5 new tests pass, existing tests unaffected

### Task 6: Wire expense total in frontend (AC2)

**Makes E2E test pass:** `expense-total-display.spec.ts` (2 tests)
**Modifies:** `expense-list.store.spec.ts`

**Steps:**
- [ ] 6.1 Add `totalAmount` to `PagedResult<T>` interface in expense.service.ts
- [ ] 6.2-6.4 Add `totalAmount` to store state, store from response, expose signal
- [ ] 6.5 Add `<app-list-total-display>` to expenses template
- [ ] 6.6 Update `expense-list.store.spec.ts` with totalAmount tests
- [ ] Run: `npm test` — store tests pass
- [ ] Run: `npm run test:e2e -- expense-total-display.spec.ts` — E2E passes

### Task 7: Replace Income total with shared component (AC2)

**Makes E2E test pass:** `income-shared-components.spec.ts` (total income test)
**Modifies:** `income.component.spec.ts`

**Steps:**
- [ ] 7.1 Replace inline total section with `<app-list-total-display>`
- [ ] 7.2 Remove `formattedTotalAmount` computed signal
- [ ] 7.3 Remove total SCSS from income component
- [ ] 7.4 Update `income.component.spec.ts` total test
- [ ] Run: `npm test` — income tests pass
- [ ] Run: `npm run test:e2e -- income-shared-components.spec.ts` — E2E passes

### Task 8: Run all tests (Validation)

- [ ] 8.1 `npm test` from `/frontend` — ALL tests pass (2,424+ baseline + ~32 new)
- [ ] 8.2 `dotnet test` from `/backend` — ALL tests pass (baseline + 5 new)
- [ ] 8.3 `npm run test:e2e` from `/frontend` — ALL E2E tests pass (baseline + 6 new)
- [ ] 8.4 Verify no TypeScript compilation errors

---

## Running Tests

```bash
# Run all frontend unit/component tests
cd frontend && npm test

# Run specific test file
cd frontend && npm test -- --testPathPattern="date-range.utils"
cd frontend && npm test -- --testPathPattern="date-range-filter"
cd frontend && npm test -- --testPathPattern="list-total-display"

# Run backend tests
cd backend && dotnet test
cd backend && dotnet test --filter "FullyQualifiedName~GetAllExpensesTotalAmount"

# Run E2E tests
cd frontend && npm run test:e2e -- income-shared-components.spec.ts
cd frontend && npm run test:e2e -- expense-total-display.spec.ts

# Run E2E in headed mode (debug)
cd frontend && npm run test:e2e:ui
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**
- All 43 tests written and failing
- 6 new test files created
- 4 existing files documented for GREEN-phase modifications
- Implementation checklist maps every test to code tasks

**Verification:**
- Frontend tests: Import errors for non-existent modules (`date-range.utils`, `date-range-filter.component`, `list-total-display.component`)
- Backend tests: Compilation error — `PagedResult<T>` has no `TotalAmount` property
- E2E tests: Element not found errors (`app-date-range-filter`, `app-list-total-display`)

### GREEN Phase (DEV Team)

1. Pick Task 1 first (shared utility + component — unblocks Tasks 2, 3)
2. Then Task 4 (ListTotalDisplayComponent — unblocks Tasks 6, 7)
3. Then Task 5 (backend TotalAmount — unblocks Task 6)
4. Then Tasks 2, 3, 6, 7 in any order
5. Task 8 last (full validation)

**Recommended execution order:** 1 → 4 → 5 → 2 → 3 → 6 → 7 → 8

### REFACTOR Phase (DEV Team)

After all tests pass:
1. Review for code duplication
2. Ensure SCSS is consistent across shared components
3. Verify no orphaned imports or dead code from extraction
4. Confirm sessionStorage keys follow naming convention

---

## Next Steps

1. Run failing tests to confirm RED phase: `npm test` from `/frontend`
2. Begin implementation using task order: 1 → 4 → 5 → 2 → 3 → 6 → 7 → 8
3. Work one test group at a time (RED → GREEN for each task)
4. When all tests pass, refactor for quality
5. Update story status to 'in-progress' in sprint-status.yaml

---

## Knowledge Base References Applied

- **fixture-architecture.md** — Composable fixture patterns for Playwright E2E tests
- **data-factories.md** — Factory patterns (not needed for this story — no new entities)
- **component-tdd.md** — Red-green-refactor for Angular component tests with TestBed
- **network-first.md** — Route interception before navigation in E2E tests
- **test-quality.md** — Given-When-Then structure, one assertion per test, deterministic tests
- **test-levels-framework.md** — Component/Unit as primary level for presentation components
- **selector-resilience.md** — Component selectors + CSS classes (consistent with project pattern)
- **timing-debugging.md** — Deterministic waits in E2E, no hard timeouts

---

## Test Summary

| Level | File | Test Count | Status |
|---|---|---|---|
| Unit | `date-range.utils.spec.ts` | 13 | RED |
| Component | `date-range-filter.component.spec.ts` | 11 | RED |
| Component | `list-total-display.component.spec.ts` | 8 | RED |
| Backend | `GetAllExpensesTotalAmountTests.cs` | 5 | RED |
| E2E | `income-shared-components.spec.ts` | 4 | RED |
| E2E | `expense-total-display.spec.ts` | 2 | RED |
| **TOTAL** | **6 new files** | **43** | **ALL RED** |

**Plus ~10 tests to add/modify in existing files during GREEN phase.**

---

**Generated by BMad TEA Agent (Murat)** — 2026-02-21
