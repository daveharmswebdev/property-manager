# Story TD.1: E2E Tests Main Flows

Status: done

## Story

As a developer,
I want comprehensive Playwright E2E tests for the main user flows (Property CRUD, Expense CRUD, Income CRUD),
so that we can confidently verify critical paths work correctly after code changes.

## Acceptance Criteria

1. **AC-TD.1.1**: Property CRUD E2E tests cover Edit and Delete flows
   - Edit Property: Navigate to property detail > Click Edit > Modify fields > Save > Verify changes persist
   - Delete Property: Navigate to property detail > Click Delete > Confirm dialog > Verify removal from list
   - Existing create/view tests continue to pass

2. **AC-TD.1.2**: Expense CRUD E2E tests cover complete workflow
   - Create Expense: Navigate to expense workspace > Fill form > Save > Verify appears in list and totals update
   - Edit Expense: Click edit on existing expense > Modify fields > Save > Verify changes persist
   - Delete Expense: Click delete > Confirm > Verify removal and total recalculation
   - Filter expenses by date range and category (basic verification)

3. **AC-TD.1.3**: Income CRUD E2E tests cover complete workflow
   - Create Income: Navigate to income workspace > Fill form > Save > Verify appears in list and totals update
   - Edit Income: Click edit on existing income > Modify fields > Save > Verify changes persist
   - Delete Income: Click delete > Confirm > Verify removal and total recalculation

4. **AC-TD.1.4**: Dashboard totals verified after data changes
   - After creating expense, verify dashboard expense total updates
   - After creating income, verify dashboard income total updates
   - Verify net income calculation displays correctly (positive green, negative red)

5. **AC-TD.1.5**: All E2E tests pass locally
   - `npm run test:e2e` runs all tests successfully
   - Tests are independent (can run in any order)
   - Tests use unique test data to avoid conflicts

## Tasks / Subtasks

- [x] Task 1: Create Page Objects for Expense Workspace (AC: TD.1.2)
  - [x] Create `frontend/e2e/pages/expense-workspace.page.ts`
  - [x] Add form field locators: amount, date, category, description
  - [x] Add action methods: fillForm(), submit(), editExpense(), deleteExpense()
  - [x] Add assertion helpers: expectExpenseInList(), expectTotal()

- [x] Task 2: Create Page Objects for Income Workspace (AC: TD.1.3)
  - [x] Create `frontend/e2e/pages/income-workspace.page.ts`
  - [x] Add form field locators: amount, date, source, description
  - [x] Add action methods: fillForm(), submit(), editIncome(), deleteIncome()
  - [x] Add assertion helpers: expectIncomeInList(), expectTotal()

- [x] Task 3: Extend Property Page Object for Edit/Delete (AC: TD.1.1)
  - [x] Create `frontend/e2e/pages/property-detail.page.ts`
  - [x] Add navigation to edit page, click delete button
  - [x] Add confirmation dialog handling
  - [x] Add verification methods for property details

- [x] Task 4: Extend Test Data Helper (AC: TD.1.2, TD.1.3)
  - [x] Add `generateExpense()` method to TestDataHelper
  - [x] Add `generateIncome()` method to TestDataHelper
  - [x] Ensure unique timestamps for each test run

- [x] Task 5: Write Property Edit/Delete E2E Tests (AC: TD.1.1)
  - [x] Create `frontend/e2e/tests/properties/property-edit.spec.ts`
  - [x] Test: Edit property name and address, verify changes
  - [x] Test: Delete property, verify removal from dashboard
  - [x] Test: Cancel edit returns to detail without changes
  - [x] Test: Cancel delete keeps property in list

- [x] Task 6: Write Expense CRUD E2E Tests (AC: TD.1.2, TD.1.4)
  - [x] Create `frontend/e2e/tests/expenses/expense-flow.spec.ts`
  - [x] Test: Create expense from expense workspace
  - [x] Test: Edit existing expense, verify totals recalculate
  - [x] Test: Delete expense with confirmation
  - [x] Test: Create multiple expenses and verify cumulative totals
  - [x] Test: Verify dashboard totals update after expense changes
  - [x] Test: Cancel edit preserves original values
  - [x] Test: Filter expenses by category on expenses list page (code review fix)

- [x] Task 7: Write Income CRUD E2E Tests (AC: TD.1.3, TD.1.4)
  - [x] Create `frontend/e2e/tests/income/income-flow.spec.ts`
  - [x] Test: Create income entry from income workspace
  - [x] Test: Edit existing income entry
  - [x] Test: Delete income with confirmation
  - [x] Test: Create multiple income entries and verify cumulative totals
  - [x] Test: Verify dashboard income totals update after income changes
  - [x] Test: Cancel delete keeps income entry

- [x] Task 8: Update Test Fixtures (AC: TD.1.5)
  - [x] Add expense workspace page to fixtures
  - [x] Add income workspace page to fixtures
  - [x] Add property detail page to fixtures
  - [x] Ensure all fixtures work with `authenticatedUser`

- [x] Task 9: Run and Verify All Tests (AC: TD.1.5)
  - [x] Run `npm run test:e2e` locally
  - [x] Verify all new tests pass (17 new tests)
  - [x] Verify existing auth and property tests still pass (6 tests)
  - [x] Fix snackbar locator issues for Angular Material

## Dev Notes

### Architecture Patterns and Constraints

**E2E Test Structure (Playwright):**
```
frontend/e2e/
├── fixtures/
│   └── test-fixtures.ts       # Shared fixtures including authenticatedUser
├── helpers/
│   ├── auth.helper.ts         # Authentication utilities
│   ├── mailhog.helper.ts      # Email verification utilities
│   └── test-data.helper.ts    # Test data generation
├── pages/
│   ├── base.page.ts           # Base page object
│   ├── dashboard.page.ts      # Dashboard interactions
│   ├── expense-workspace.page.ts  # NEW: Expense form/list
│   ├── income-workspace.page.ts   # NEW: Income form/list
│   ├── property-detail.page.ts    # NEW: Property detail page
│   └── ...existing pages
└── tests/
    ├── auth/
    │   └── auth-flow.spec.ts  # Existing: 3 auth tests
    ├── properties/
    │   ├── property-flow.spec.ts   # Existing: 3 property tests
    │   └── property-edit.spec.ts   # NEW: Edit/Delete tests
    ├── expenses/
    │   └── expense-flow.spec.ts    # NEW: Full CRUD tests
    └── income/
        └── income-flow.spec.ts     # NEW: Full CRUD tests
```

**Page Object Pattern:**
```typescript
// Example structure for new page objects
export class ExpenseWorkspacePage extends BasePage {
  readonly amountInput = this.page.getByLabel('Amount');
  readonly dateInput = this.page.getByLabel('Date');
  readonly categorySelect = this.page.getByLabel('Category');
  readonly descriptionInput = this.page.getByLabel('Description');
  readonly saveButton = this.page.getByRole('button', { name: 'Save' });

  async fillForm(expense: TestExpense) { ... }
  async submit() { await this.saveButton.click(); }
  async expectExpenseInList(description: string) { ... }
}
```

**Test Data Generation:**
```typescript
// Extend TestDataHelper
static generateExpense(propertyId?: string) {
  return {
    amount: (Math.random() * 1000 + 50).toFixed(2),
    date: new Date().toISOString().split('T')[0],
    category: 'Repairs',
    description: `E2E Test Expense ${Date.now()}`,
  };
}
```

### Project Structure Notes

**Existing E2E Infrastructure (REUSE):**
- `authenticatedUser` fixture - Handles login before tests
- `TestDataHelper.generateProperty()` - Pattern for generating test data
- `mailhog.helper.ts` - Email verification (not needed for CRUD tests)
- Page object pattern with `BasePage` - Extend for new pages

**Key Selectors to Use:**
- `app-expense-row` - Expense list items
- `app-income-row` - Income list items
- `app-property-row` - Property list items
- `mat-dialog-container` - Confirmation dialogs
- `mat-snack-bar-container` - Success/error messages

**Commands:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/tests/expenses/expense-flow.spec.ts

# View test report
npm run test:e2e:report
```

### Learnings from Previous Story

**From Story 4-4-dashboard-income-and-net-income-totals (Status: done)**

- **Dashboard Service Available**: DashboardController at `GET /api/v1/dashboard/totals?year=YYYY`
- **PropertyStore has computed signals**: `totalExpenses`, `totalIncome`, `netIncome`
- **StatsBarComponent displays**: Formatted expenses, income, and net income with color coding
- **Accounting Format**: Negative values show as "($X,XXX.XX)" in red
- **329 frontend tests passing**: All unit/component tests are green

**Components to interact with in E2E:**
- `StatsBarComponent` - Verify totals update after CRUD operations
- `PropertyRowComponent` - Has net income display, click to navigate
- `ExpenseRowComponent` - Edit/delete hover actions
- `IncomeRowComponent` - Edit/delete hover actions

[Source: docs/sprint-artifacts/4-4-dashboard-income-and-net-income-totals.md#Dev-Notes]

### Testing Strategy

**Test Independence:**
- Each test creates its own test data with unique timestamps
- Tests should not depend on data from other tests
- Use `authenticatedUser` fixture for consistent auth state

**Test Categories:**
| Category | Test Count | Coverage |
|----------|------------|----------|
| Property Edit/Delete | 4 | AC-TD.1.1 |
| Expense CRUD | 7 | AC-TD.1.2, TD.1.4 |
| Income CRUD | 6 | AC-TD.1.3, TD.1.4 |
| **Total New Tests** | **17** | |

**Existing Tests (must continue passing):**
| Category | Test Count | File |
|----------|------------|------|
| Auth Flow | 3 | auth-flow.spec.ts |
| Property Create/View | 3 | property-flow.spec.ts |

### References

- [Source: docs/architecture.md#Testing Strategy] - Test pyramid and E2E strategy
- [Source: frontend/e2e/tests/auth/auth-flow.spec.ts] - Existing E2E patterns
- [Source: frontend/e2e/tests/properties/property-flow.spec.ts] - Property test patterns
- [Source: frontend/e2e/fixtures/test-fixtures.ts] - Fixture patterns
- [Source: frontend/playwright.config.ts] - Playwright configuration

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/td-1-e2e-tests-main-flows.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 23 E2E tests passing: 6 existing + 17 new
- Fixed base page snackbar locator to use `[matsnackbarlabel]` selector to avoid matching nested Angular Material elements
- Income store uses "Income recorded" message instead of "Income saved" - updated page object accordingly
- Property form redirects to dashboard after create, not property detail - test helpers updated to navigate via dashboard click
- Code review fixes applied: extracted duplicate helper to shared file, fixed type safety issues, added missing filter test for AC-TD.1.2

### File List

**New Page Objects:**
- `frontend/e2e/pages/expense-workspace.page.ts` - Expense workspace interactions
- `frontend/e2e/pages/income-workspace.page.ts` - Income workspace interactions
- `frontend/e2e/pages/property-detail.page.ts` - Property detail and edit interactions

**New Helper Files:**
- `frontend/e2e/helpers/test-setup.helper.ts` - Shared createPropertyAndGetId helper (code review fix)

**New Test Files:**
- `frontend/e2e/tests/properties/property-edit.spec.ts` - 4 property edit/delete tests
- `frontend/e2e/tests/expenses/expense-flow.spec.ts` - 7 expense CRUD tests (includes filter test)
- `frontend/e2e/tests/income/income-flow.spec.ts` - 6 income CRUD tests

**Modified Files:**
- `frontend/e2e/fixtures/test-fixtures.ts` - Added new page object fixtures
- `frontend/e2e/helpers/test-data.helper.ts` - Added generateExpense() and generateIncome()
- `frontend/e2e/pages/base.page.ts` - Fixed snackbar locator
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial story draft created | SM Agent (Create Story Workflow) |
| 2025-12-26 | Story implementation complete - 22/22 E2E tests passing | Dev Agent (Amelia) |
| 2025-12-26 | Code review fixes: extracted shared helper, fixed type safety, added filter test - 23/23 E2E tests | Dev Agent (Amelia) |
