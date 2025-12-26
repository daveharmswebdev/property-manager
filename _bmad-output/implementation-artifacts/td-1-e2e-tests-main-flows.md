# Story TD.1: E2E Tests Main Flows

Status: ready-for-dev

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

- [ ] Task 1: Create Page Objects for Expense Workspace (AC: TD.1.2)
  - [ ] Create `frontend/e2e/pages/expense-workspace.page.ts`
  - [ ] Add form field locators: amount, date, category, description
  - [ ] Add action methods: fillForm(), submit(), editExpense(), deleteExpense()
  - [ ] Add assertion helpers: expectExpenseInList(), expectTotal()

- [ ] Task 2: Create Page Objects for Income Workspace (AC: TD.1.3)
  - [ ] Create `frontend/e2e/pages/income-workspace.page.ts`
  - [ ] Add form field locators: amount, date, source, description
  - [ ] Add action methods: fillForm(), submit(), editIncome(), deleteIncome()
  - [ ] Add assertion helpers: expectIncomeInList(), expectTotal()

- [ ] Task 3: Extend Property Page Object for Edit/Delete (AC: TD.1.1)
  - [ ] Create `frontend/e2e/pages/property-detail.page.ts`
  - [ ] Add navigation to edit page, click delete button
  - [ ] Add confirmation dialog handling
  - [ ] Add verification methods for property details

- [ ] Task 4: Extend Test Data Helper (AC: TD.1.2, TD.1.3)
  - [ ] Add `generateExpense()` method to TestDataHelper
  - [ ] Add `generateIncome()` method to TestDataHelper
  - [ ] Ensure unique timestamps for each test run

- [ ] Task 5: Write Property Edit/Delete E2E Tests (AC: TD.1.1)
  - [ ] Create `frontend/e2e/tests/properties/property-edit.spec.ts`
  - [ ] Test: Edit property name and address, verify changes
  - [ ] Test: Delete property, verify removal from dashboard
  - [ ] Test: Cancel edit returns to detail without changes

- [ ] Task 6: Write Expense CRUD E2E Tests (AC: TD.1.2, TD.1.4)
  - [ ] Create `frontend/e2e/tests/expenses/expense-flow.spec.ts`
  - [ ] Test: Create expense from dashboard quick-add
  - [ ] Test: Create expense from expense workspace
  - [ ] Test: Edit existing expense, verify totals recalculate
  - [ ] Test: Delete expense with confirmation
  - [ ] Test: Filter expenses by category
  - [ ] Test: Verify dashboard totals update after expense changes

- [ ] Task 7: Write Income CRUD E2E Tests (AC: TD.1.3, TD.1.4)
  - [ ] Create `frontend/e2e/tests/income/income-flow.spec.ts`
  - [ ] Test: Create income entry from property detail
  - [ ] Test: Create income from income workspace
  - [ ] Test: Edit existing income entry
  - [ ] Test: Delete income with confirmation
  - [ ] Test: Verify dashboard totals update after income changes

- [ ] Task 8: Update Test Fixtures (AC: TD.1.5)
  - [ ] Add expense workspace page to fixtures
  - [ ] Add income workspace page to fixtures
  - [ ] Add property detail page to fixtures
  - [ ] Ensure all fixtures work with `authenticatedUser`

- [ ] Task 9: Run and Verify All Tests (AC: TD.1.5)
  - [ ] Run `npm run test:e2e` locally
  - [ ] Verify all new tests pass
  - [ ] Verify existing auth and property tests still pass
  - [ ] Fix any flaky tests or timing issues

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
| Property Edit/Delete | 3 | AC-TD.1.1 |
| Expense CRUD | 6 | AC-TD.1.2, TD.1.4 |
| Income CRUD | 5 | AC-TD.1.3, TD.1.4 |
| **Total New Tests** | **14** | |

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial story draft created | SM Agent (Create Story Workflow) |
