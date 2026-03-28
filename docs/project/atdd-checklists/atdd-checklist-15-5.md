# ATDD Checklist - Epic 15, Story 15.5: Expense Detail/Edit View

**Date:** 2026-02-17
**Author:** Dave
**Primary Test Level:** E2E (Playwright)
**Story Status:** ready-for-dev → Tests in RED Phase

---

## Story Summary

Adds a dedicated expense detail/edit page at `/expenses/:id` where property owners can view all expense fields, edit (including property reassignment), delete, and unlink receipts from the global expense list.

**As a** property owner
**I want** a dedicated expense detail/edit page at `/expenses/:id`
**So that** I can view, edit (including reassigning property), and delete any expense from the global expense list

---

## Acceptance Criteria

1. **AC1 — Navigation**: Click expense row in `/expenses` list → navigate to `/expenses/:id`
2. **AC2 — Detail view**: All fields displayed read-only (amount, date, category, description, property, receipt, work order, created date)
3. **AC3 — Edit mode**: Edit button → form pre-populated → modify fields including property reassignment → Save/Cancel
4. **AC4 — Delete**: Delete button → confirmation dialog → soft-delete → navigate to `/expenses` + snackbar
5. **AC5 — Unlink receipt**: Unlink Receipt → confirmation → receipt section updates to "No receipt" + snackbar

---

## Failing Tests Created (RED Phase)

### E2E Tests (9 tests)

**File:** `frontend/e2e/tests/expenses/expense-detail.spec.ts`

| # | Test | AC | Status | Expected Failure Reason |
|---|---|---|---|---|
| 1 | should navigate to /expenses/:id when clicking expense row | AC1 | RED | `ExpenseListRowComponent` still navigates to `/properties/:propertyId/expenses` |
| 2 | should display all expense fields in read-only detail view | AC2 | RED | `/expenses/:id` route does not exist, no component renders |
| 3 | should display receipt actions when expense has linked receipt | AC2 | RED | `ExpenseDetailComponent` does not exist |
| 4 | should enter edit mode with pre-populated form | AC3 | RED | `ExpenseDetailComponent` does not exist |
| 5 | should save updated expense and return to view mode | AC3 | RED | `ExpenseDetailComponent` does not exist |
| 6 | should reassign expense to different property | AC3 | RED | `ExpenseDetailComponent` and backend `PropertyId` support do not exist |
| 7 | should cancel edit and revert to view mode without changes | AC3 | RED | `ExpenseDetailComponent` does not exist |
| 8 | should delete expense with confirmation and navigate to list | AC4 | RED | `ExpenseDetailComponent` does not exist |
| 9 | should unlink receipt and show "No receipt" after confirmation | AC5 | RED | `ExpenseDetailComponent` and `unlinkReceipt` method do not exist |

---

## Test Infrastructure Created

### Page Object

**File:** `frontend/e2e/pages/expense-detail.page.ts`

Extends `BasePage`. Provides:
- View mode locators (data-testid selectors for fields, button text selectors for actions)
- Edit mode locators (formControlName selectors for form fields)
- Assertion helpers: `expectViewMode()`, `expectEditMode()`, `expectAmount()`, `expectCategory()`, `expectProperty()`, `expectReceiptLinked()`, `expectNoReceipt()`
- Action helpers: `clickEdit()`, `clickDelete()`, `clickUnlinkReceipt()`, `submitEdit()`, `cancelEdit()`, `fillAmount()`, `fillDescription()`, `selectCategory()`, `selectProperty()`

### Fixture Registration

**File:** `frontend/e2e/fixtures/test-fixtures.ts` (updated)

Added `expenseDetailPage: ExpenseDetailPage` fixture to the Fixtures type and fixture definition.

### Data Setup Helper

In-spec helper function `createExpenseAndGetId()`:
- Creates property via `createPropertyAndGetId` (existing helper)
- Creates expense via `expenseWorkspacePage.createExpense`
- Captures expense ID from POST response using network-first pattern (`page.waitForResponse`)
- Returns `{ expenseId, propertyId, propertyData, testExpense }`

### Network Mocking (AC2/AC5)

- AC2 receipt test: Uses `page.route()` to inject `receiptId` into expense GET response
- AC5 unlink test: Uses `page.route()` to mock DELETE receipt endpoint (204) and simulate receipt state change

---

## Required data-testid Attributes

### Expense Detail Component (view mode)

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `expense-amount` | Amount display element | Assert formatted currency amount |
| `expense-date` | Date display element | Assert formatted date |
| `expense-category` | Category display element | Assert category name + Schedule E line |
| `expense-description` | Description display element | Assert description text |
| `expense-property` | Property name display element | Assert property name |
| `expense-created-date` | Created date display element | Assert creation date |
| `receipt-section` | Receipt section container | Assert receipt section visibility |
| `receipt-thumbnail` | Receipt thumbnail image | Assert receipt preview exists |
| `work-order-section` | Work order section container | Assert work order section visibility |
| `work-order-link` | Work order link element | Assert navigation to work order detail |

### Buttons (use text selectors, no data-testid needed)

- "Edit" button → triggers edit mode
- "Delete" button → triggers delete confirmation
- "Save" button → submits edit form (type="submit")
- "Cancel" button → cancels edit mode
- "View Receipt" button → opens receipt lightbox
- "Unlink Receipt" button → triggers unlink confirmation
- "Back to Expenses" link → navigates to `/expenses`

---

## Implementation Checklist

### Phase 1: Backend — PropertyId in UpdateExpenseCommand (AC3)

**Tasks to make test #6 pass (property reassignment):**

- [ ] Add `Guid? PropertyId` to `UpdateExpenseCommand` record in `UpdateExpense.cs`
- [ ] Update handler to set `expense.PropertyId` when provided
- [ ] Validate PropertyId exists and belongs to same account
- [ ] If WorkOrderId set, validate work order belongs to NEW property
- [ ] Add `propertyId` to `UpdateExpenseRequest` in `ExpensesController.cs`
- [ ] Update `UpdateExpenseValidator` with PropertyId rule
- [ ] Write backend unit tests for property reassignment path
- [ ] Run: `dotnet test` from `/backend`
- [ ] Regenerate NSwag client: `npm run generate-api` from `/frontend`

### Phase 2: Frontend Service + Store (AC2-AC5)

**Tasks to make tests #2-9 compile and interact with API:**

- [ ] Add `unlinkReceipt(expenseId)` to `expense.service.ts`
- [ ] Create `expense-detail.store.ts` with state, methods, computed signals
- [ ] Write store spec: `expense-detail.store.spec.ts`
- [ ] Run: `npm test` from `/frontend`

### Phase 3: Frontend Component + Route (AC1-AC5)

**Tasks to make tests #1-9 pass:**

- [ ] Create `expense-detail.component.ts` with view/edit mode
- [ ] Add all `data-testid` attributes per table above
- [ ] View mode: display all fields, Edit/Delete buttons, receipt section, work order section
- [ ] Edit mode: reactive form with Amount, Date, Category, Description, Property, WorkOrder
- [ ] Delete: confirmation dialog → soft-delete → navigate `/expenses`
- [ ] Unlink receipt: confirmation dialog → API call → update UI
- [ ] Add route `expenses/:id` to `app.routes.ts`
- [ ] Update `ExpenseListRowComponent.navigateToExpense()` to `/expenses/:id`
- [ ] Write component spec: `expense-detail.component.spec.ts`
- [ ] Run: `npm test` from `/frontend`

### Phase 4: E2E Verification

- [ ] Run: `npm run test:e2e -- --grep "Story 15.5"` → all 9 tests GREEN
- [ ] Run full E2E suite: `npm run test:e2e` → no regressions

---

## Running Tests

```bash
# Run only story 15.5 E2E tests
npm run test:e2e -- --grep "Story 15.5"

# Run with headed browser (debug)
npm run test:e2e -- --grep "Story 15.5" --headed

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run specific test by name
npm run test:e2e -- --grep "AC1: should navigate"

# Run all expense E2E tests
npm run test:e2e -- --grep "Expense"

# Run frontend unit tests (NEVER use npx vitest directly)
npm test  # from /frontend

# Run backend unit tests
dotnet test  # from /backend
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ 9 E2E tests written and failing
- ✅ Page object created with data-testid selectors
- ✅ Fixture registered in test-fixtures.ts
- ✅ Network mocking patterns for receipt tests
- ✅ Implementation checklist with phased approach
- ✅ data-testid requirements documented

**Verification:**

- All tests fail because `ExpenseDetailComponent` and `/expenses/:id` route don't exist
- AC1 fails because `ExpenseListRowComponent` still navigates to property workspace
- Tests fail for the right reasons (missing implementation, not test bugs)

---

### GREEN Phase (DEV Team - Next Steps)

**Recommended implementation order:**

1. **Backend first** (Phase 1): Add PropertyId to UpdateExpenseCommand, run `dotnet test`
2. **Regenerate API client**: `npm run generate-api`
3. **Frontend service + store** (Phase 2): Add unlinkReceipt method, create ExpenseDetailStore
4. **Frontend component + route** (Phase 3): Build the detail page, register route, update row navigation
5. **Verify E2E** (Phase 4): Run `npm run test:e2e -- --grep "Story 15.5"` → all GREEN

**Key Principles:**

- One test at a time (implement what's needed to make that test pass)
- Backend changes before frontend (PropertyId must exist in API)
- Follow existing patterns (property-detail, vendor-detail components as reference)
- Use the dev-story workflow for implementation

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all 9 E2E tests pass
2. Review component for code quality (SCSS patterns, signal store patterns)
3. Ensure no regressions in existing expense tests
4. Update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

- **network-first.md** — Intercept POST response to capture expense ID; mock GET/DELETE for receipt tests
- **fixture-architecture.md** — Page object extends BasePage, registered as fixture with auto-setup
- **test-levels-framework.md** — E2E selected as primary (new user-facing page, cross-component navigation)
- **selector-resilience.md** — data-testid for field displays, formControlName for inputs, text for buttons
- **test-quality.md** — Given-When-Then structure, deterministic waits, isolated test data

---

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `frontend/e2e/pages/expense-detail.page.ts` | **NEW** | Page object for detail/edit page |
| `frontend/e2e/tests/expenses/expense-detail.spec.ts` | **NEW** | 9 failing E2E tests for AC1-AC5 |
| `frontend/e2e/fixtures/test-fixtures.ts` | **MODIFIED** | Added `expenseDetailPage` fixture |
| `_bmad-output/atdd-checklist-15-5.md` | **NEW** | This ATDD checklist |

---

**Generated by BMad TEA Agent** - 2026-02-17
