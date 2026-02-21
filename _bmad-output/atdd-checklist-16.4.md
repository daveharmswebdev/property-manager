# ATDD Checklist - Story 16.4: Expense-WorkOrder & Receipt Linking

**Date:** 2026-02-21
**Author:** Dave
**Primary Test Level:** Unit (backend) + Component (frontend)

---

## Story Summary

As a property owner editing an expense, I want to link it to a work order and/or receipt, so that my expenses are connected to the maintenance context and proof of purchase.

**As a** property owner
**I want** to link expenses to work orders and receipts from the detail edit view
**So that** expenses are connected to maintenance context and proof of purchase

---

## Acceptance Criteria

1. **AC1** — Work order dropdown on detail edit form (filtered to expense's property, persists on save)
2. **AC2** — Work order dropdown resets on property change (clears selection, reloads for new property)
3. **AC3** — Link unprocessed receipt to existing expense (thumbnail picker, sets both FKs + ProcessedAt)
4. **AC4** — Unlink receipt from detail edit mode (returns receipt to unprocessed queue)

---

## Failing Tests Created (RED Phase)

### Backend Unit Tests (12 tests)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseHandlerTests.cs`

- **Test:** `Handle_ExpenseNotFound_ThrowsNotFoundException`
  - **Status:** RED — `LinkReceiptToExpenseCommand` class does not exist
  - **Verifies:** 404 when expense not found (AC3)

- **Test:** `Handle_ReceiptNotFound_ThrowsNotFoundException`
  - **Status:** RED — `LinkReceiptToExpenseHandler` class does not exist
  - **Verifies:** 404 when receipt not found (AC3)

- **Test:** `Handle_ExpenseAlreadyHasReceipt_ThrowsConflictException`
  - **Status:** RED — Handler not implemented
  - **Verifies:** 409 Conflict when expense already linked (AC3)

- **Test:** `Handle_ReceiptAlreadyProcessed_ThrowsConflictException`
  - **Status:** RED — Handler not implemented
  - **Verifies:** 409 Conflict when receipt is already processed (AC3)

- **Test:** `Handle_ValidCommand_SetsExpenseReceiptId`
  - **Status:** RED — Handler not implemented
  - **Verifies:** `expense.ReceiptId = receipt.Id` (AC3, critical FK)

- **Test:** `Handle_ValidCommand_SetsReceiptExpenseId`
  - **Status:** RED — Handler not implemented
  - **Verifies:** `receipt.ExpenseId = expense.Id` (AC3, shadow property — Story 15.4 lesson)

- **Test:** `Handle_ValidCommand_SetsReceiptProcessedAt`
  - **Status:** RED — Handler not implemented
  - **Verifies:** `receipt.ProcessedAt` set to UtcNow (AC3)

- **Test:** `Handle_ReceiptWithNoProperty_SyncsPropertyFromExpense`
  - **Status:** RED — Handler not implemented
  - **Verifies:** `receipt.PropertyId = expense.PropertyId` when receipt has no property (AC3)

- **Test:** `Handle_ValidCommand_CallsSaveChanges`
  - **Status:** RED — Handler not implemented
  - **Verifies:** Persistence call made (AC3)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs`

- **Test:** `Validate_EmptyExpenseId_Fails`
  - **Status:** RED — `LinkReceiptToExpenseValidator` class does not exist
  - **Verifies:** FluentValidation rejects empty GUID (AC3)

- **Test:** `Validate_EmptyReceiptId_Fails`
  - **Status:** RED — Validator not implemented
  - **Verifies:** FluentValidation rejects empty GUID (AC3)

- **Test:** `Validate_ValidCommand_Passes`
  - **Status:** RED — Validator not implemented
  - **Verifies:** Valid GUIDs pass validation (AC3)

### Frontend Component Tests (10 tests)

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts`

**Work Order Dropdown (AC1-AC2):**

- **Test:** `should show work order dropdown in edit mode (AC1)`
  - **Status:** RED — No `workOrderId` form control or `[data-testid="work-order-select"]` in template
  - **Verifies:** Work order dropdown renders in edit mode

- **Test:** `should populate workOrderId from expense data (AC1)`
  - **Status:** RED — `populateEditForm()` does not patch workOrderId
  - **Verifies:** Pre-population from expense record

- **Test:** `should clear work order when property changes (AC2)`
  - **Status:** RED — No propertyId valueChanges subscription
  - **Verifies:** Reactive reset on property change

- **Test:** `should include workOrderId in update request on submit (AC1)`
  - **Status:** RED — `onSubmit()` does not include workOrderId
  - **Verifies:** PUT request payload includes work order

- **Test:** `should send undefined workOrderId when None selected (AC1)`
  - **Status:** RED — No workOrderId in form
  - **Verifies:** Empty selection sends undefined (not empty string)

**Receipt Linking (AC3-AC4):**

- **Test:** `should show receipt link section when no receipt is linked (AC3)`
  - **Status:** RED — No `[data-testid="receipt-link-section"]` in edit template
  - **Verifies:** Receipt picker renders when no receipt attached

- **Test:** `should show unprocessed receipt thumbnails in picker (AC3)`
  - **Status:** RED — No receipt picker UI exists
  - **Verifies:** Thumbnails rendered from unprocessed receipts

- **Test:** `should show Link Receipt button when receipt is selected (AC3)`
  - **Status:** RED — No `[data-testid="link-receipt-btn"]` in template
  - **Verifies:** Link action button present

- **Test:** `should show unlink button in edit mode when receipt exists (AC4)`
  - **Status:** RED — No `[data-testid="receipt-section-edit"]` in edit template
  - **Verifies:** Unlink available in edit mode for linked receipts

- **Test:** `should show "No unprocessed receipts" when none available (AC3)`
  - **Status:** RED — No empty state message in receipt link section
  - **Verifies:** Graceful empty state

### E2E Acceptance Tests (7 tests)

**File:** `frontend/e2e/tests/expenses/expense-linking.spec.ts`

- **Test:** `AC1: should show work order dropdown in edit mode`
  - **Status:** RED — No work order dropdown in edit form
  - **Verifies:** Full journey: navigate → edit → see work order select

- **Test:** `AC1: should persist work order selection on save`
  - **Status:** RED — PUT request missing workOrderId
  - **Verifies:** Selected work order included in update API call

- **Test:** `AC2: should clear work order dropdown when property changes`
  - **Status:** RED — No property change listener for work orders
  - **Verifies:** Dropdown reset and reload on property switch

- **Test:** `AC3: should show receipt picker in edit mode when no receipt linked`
  - **Status:** RED — No receipt link section in edit mode
  - **Verifies:** Unprocessed receipts displayed as thumbnails

- **Test:** `AC3: should link selected receipt to expense`
  - **Status:** RED — No link-receipt endpoint or UI
  - **Verifies:** POST link-receipt called with correct receiptId, snackbar shown

- **Test:** `AC4: should show unlink button in edit mode when receipt is linked`
  - **Status:** RED — No receipt section in edit template
  - **Verifies:** Unlink button visible when receipt exists

- **Test:** `AC4: should unlink receipt in edit mode and show receipt picker`
  - **Status:** RED — No unlink-from-edit-mode flow
  - **Verifies:** After unlink, receipt picker appears

---

## Data Infrastructure

### Page Object Updates

**File:** `frontend/e2e/pages/expense-detail.page.ts`

**New Locators:**
- `receiptLinkSection` — `[data-testid="receipt-link-section"]`
- `receiptOptions` — `[data-testid="receipt-option"]`
- `linkReceiptButton` — `[data-testid="link-receipt-btn"]`
- `receiptSectionEdit` — `[data-testid="receipt-section-edit"]`
- `noUnprocessedReceiptsMessage` — text match "No unprocessed receipts"

**New Methods:**
- `expectReceiptLinkSection()` — Assert receipt picker visible
- `expectNoUnprocessedReceipts()` — Assert empty state
- `selectReceipt(index)` — Click receipt thumbnail by index
- `clickLinkReceipt()` — Click "Link Selected Receipt" button
- `expectWorkOrderDropdown()` — Assert work order select visible
- `selectWorkOrder(description)` — Select work order by text

### Existing Locators Already in Page Object
- `workOrderSelect` — `mat-select[formControlName="workOrderId"]` (already declared)
- `unlinkReceiptButton` — text match "Unlink Receipt"

---

## Required data-testid Attributes

### Expense Detail Edit Mode (New)

- `work-order-select` — Work order dropdown `<mat-select>` in edit form
- `receipt-link-section` — Container for receipt picker when no receipt linked
- `receipt-option` — Individual receipt thumbnail button in picker grid
- `link-receipt-btn` — "Link Selected Receipt" action button
- `receipt-section-edit` — Container for receipt info in edit mode when receipt exists

### Already Existing

- `expense-amount`, `expense-category`, `expense-description`, `expense-property`, `expense-date` — View mode fields
- `receipt-section` — Receipt section in view mode
- `receipt-thumbnail` — Receipt attached indicator
- `work-order-section` — Work order section in view mode
- `work-order-link` — Work order navigation link

---

## Implementation Checklist

### Test: Backend — LinkReceiptToExpenseHandler (9 tests)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseHandlerTests.cs`

**Tasks to make these tests pass:**

- [ ] Create `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpense.cs`
  - [ ] Define `LinkReceiptToExpenseCommand(Guid ExpenseId, Guid ReceiptId) : IRequest<Unit>`
  - [ ] Implement `LinkReceiptToExpenseHandler` with IAppDbContext + ILogger
  - [ ] Load expense from Expenses DbSet, throw NotFoundException if null
  - [ ] Verify `expense.ReceiptId == null` (ConflictException if not)
  - [ ] Load receipt from Receipts DbSet, throw NotFoundException if null
  - [ ] Verify `receipt.ProcessedAt == null` (ConflictException if not)
  - [ ] Set BOTH FKs: `expense.ReceiptId = receipt.Id`, `receipt.ExpenseId = expense.Id`
  - [ ] Set `receipt.ProcessedAt = DateTime.UtcNow`
  - [ ] If `receipt.PropertyId == null`, sync from expense
  - [ ] Call `SaveChangesAsync`
- [ ] Run: `dotnet test --filter "LinkReceiptToExpenseHandlerTests"` from `/backend`
- [ ] All 9 tests pass (green phase)

### Test: Backend — LinkReceiptToExpenseValidator (3 tests)

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs`

**Tasks to make these tests pass:**

- [ ] Create `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpenseValidator.cs`
  - [ ] `RuleFor(x => x.ExpenseId).NotEmpty()`
  - [ ] `RuleFor(x => x.ReceiptId).NotEmpty()`
- [ ] Run: `dotnet test --filter "LinkReceiptToExpenseValidatorTests"` from `/backend`
- [ ] All 3 tests pass (green phase)

### Test: Backend — API Endpoint

**No dedicated test file — covered by E2E tests**

**Tasks:**

- [ ] Add `POST expenses/{id:guid}/link-receipt` to `ExpensesController.cs`
  - [ ] Add `LinkReceiptRequest(Guid ReceiptId)` record at bottom of controller
  - [ ] Explicit validator call before `_mediator.Send()`
  - [ ] Return `NoContent()` on success
  - [ ] Add `[ProducesResponseType]` attributes (204, 404, 409)
- [ ] Run `npm run generate-api` from `/frontend` to regenerate TypeScript client

### Test: Frontend — Work Order Dropdown (5 component tests)

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts`

**Tasks to make these tests pass:**

- [ ] Add `workOrderId` form control to `editForm` in component
- [ ] Import and inject `WorkOrderService`
- [ ] Add `workOrders` and `isLoadingWorkOrders` signals
- [ ] Add `loadWorkOrders(propertyId)` method
- [ ] Call `loadWorkOrders()` in `onEdit()` method
- [ ] Add `propertyId` valueChanges subscription to reset work orders (AC2)
- [ ] Patch `workOrderId` in `populateEditForm()`
- [ ] Include `workOrderId` in `onSubmit()` request
- [ ] Add work order `<mat-select>` with `data-testid="work-order-select"` to edit template
- [ ] Import `MatSelectModule` if not already imported
- [ ] Run: `npm test` from `/frontend`
- [ ] All 5 work order tests pass (green phase)

### Test: Frontend — Receipt Linking (5 component tests)

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts`

**Tasks to make these tests pass:**

- [ ] Add receipt-related signals: `unprocessedReceipts`, `isLoadingReceipts`, `isLinkingReceipt`, `selectedReceiptId`
- [ ] Import API service for `receipts_GetUnprocessed` and `linkReceipt`
- [ ] Add `loadUnprocessedReceipts()` method
- [ ] Call `loadUnprocessedReceipts()` in `onEdit()` when no receipt linked
- [ ] Add `linkReceipt()` method with API call
- [ ] Add receipt picker template with `data-testid="receipt-link-section"`, `data-testid="receipt-option"`, `data-testid="link-receipt-btn"`
- [ ] Add receipt edit section with `data-testid="receipt-section-edit"` for linked receipt
- [ ] Add empty state: "No unprocessed receipts available"
- [ ] Add SCSS for receipt picker grid
- [ ] Run: `npm test` from `/frontend`
- [ ] All 5 receipt tests pass (green phase)

### Test: E2E — Full Integration (7 tests)

**File:** `frontend/e2e/tests/expenses/expense-linking.spec.ts`

**Tasks to make these tests pass:**

- [ ] All backend tasks complete (command, validator, endpoint)
- [ ] All frontend tasks complete (work order dropdown, receipt picker)
- [ ] NSwag API client regenerated with link-receipt endpoint
- [ ] Run: `npm run test:e2e -- tests/expenses/expense-linking.spec.ts` from `/frontend`
- [ ] All 7 E2E tests pass (green phase)

---

## Running Tests

```bash
# Backend — LinkReceiptToExpense unit tests
dotnet test --filter "LinkReceiptToExpenseHandlerTests|LinkReceiptToExpenseValidatorTests" --project backend/tests/PropertyManager.Application.Tests

# Frontend — Component tests (includes Story 16.4 additions)
# IMPORTANT: Use npm test, NEVER npx vitest
cd frontend && npm test

# E2E — Story 16.4 acceptance tests only
cd frontend && npx playwright test tests/expenses/expense-linking.spec.ts

# E2E — All expense tests (verify no regression)
cd frontend && npx playwright test tests/expenses/

# Full suite
dotnet test --project backend/tests/PropertyManager.Application.Tests
cd frontend && npm test
cd frontend && npm run test:e2e
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- [x] All 29 tests written and failing
- [x] Page object updated with receipt linking locators and methods
- [x] Test helper `createExpenseAndGetId()` reused from expense-detail.spec.ts
- [x] Network-first patterns applied (page.route before navigation)
- [x] data-testid requirements listed
- [x] Implementation checklist created

**Verification:**

- All tests fail due to missing implementation (command/handler/validator/UI)
- Failure messages are clear: compilation errors (backend), element-not-found (frontend)
- No test bugs — tests are structurally sound

---

### GREEN Phase (DEV Team - Recommended Order)

**Implement in dependency order:**

1. **Backend first** — `LinkReceiptToExpense.cs` + `LinkReceiptToExpenseValidator.cs` (12 tests → green)
2. **API endpoint** — `ExpensesController.cs` link-receipt route (enables E2E)
3. **API client** — `npm run generate-api` (enables frontend integration)
4. **Work order dropdown** — Task 1 from story (5 component tests → green)
5. **Receipt linking UI** — Task 6 from story (5 component tests → green)
6. **E2E verification** — Run all 7 E2E tests (should go green)

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Backend tests go green first (no frontend dependency)
- Frontend component tests go green next (mock API)
- E2E tests go green last (require full stack)

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 29 tests pass
2. Run full test suite to check for regressions
3. Review code for:
   - DRY violations in work order loading logic
   - Proper signal cleanup
   - Consistent error handling patterns
4. Ensure no TypeScript compilation warnings

---

## Next Steps

1. **Review this checklist** and the 3 test files
2. **Run failing tests** to confirm RED phase:
   - `dotnet test` from `/backend` (will see compilation errors)
   - `npm test` from `/frontend` (will see element-not-found failures)
3. **Begin implementation** using the checklist above (backend → frontend → E2E)
4. **Work one test at a time** (red → green for each)
5. **When all tests pass**, refactor and update story status

---

## Knowledge Base References Applied

- **fixture-architecture.md** — Reused existing Playwright fixtures (authenticatedUser, page objects)
- **data-factories.md** — Leveraged TestDataHelper.generateExpense() pattern
- **network-first.md** — All E2E tests use page.route() BEFORE navigation
- **component-tdd.md** — Component tests use signal-based mock pattern from existing spec
- **test-quality.md** — One assertion per test, deterministic selectors
- **selector-resilience.md** — data-testid selectors for all new UI elements
- **test-healing-patterns.md** — Avoided hardcoded counts (used route mocking instead)
- **test-levels-framework.md** — Unit for business logic, Component for UI, E2E for integration only

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test File Summary

| File | Tests | Level | Status |
|---|---|---|---|
| `backend/.../LinkReceiptToExpenseHandlerTests.cs` | 9 | Unit (xUnit) | RED |
| `backend/.../LinkReceiptToExpenseValidatorTests.cs` | 3 | Unit (xUnit) | RED |
| `frontend/.../expense-detail.component.spec.ts` | 10 new | Component (Vitest) | RED |
| `frontend/e2e/tests/expenses/expense-linking.spec.ts` | 7 | E2E (Playwright) | RED |
| **Total** | **29** | | **RED** |

---

## Notes

- Backend tests will fail with **compilation errors** — `LinkReceiptToExpenseCommand`, `LinkReceiptToExpenseHandler`, and `LinkReceiptToExpenseValidator` do not exist yet. This is the expected RED phase for backend TDD.
- Frontend component tests will fail with **assertion errors** — DOM elements with the required `data-testid` attributes don't exist in the current template.
- E2E tests will fail with **timeout/element-not-found** — the work order dropdown and receipt linking UI don't exist in the current component.
- The `workOrderSelect` locator was already declared in the page object (Story 15.5 forward-planning), but the form control `workOrderId` doesn't exist yet.
- The unlink receipt flow in edit mode (AC4) is separate from the view mode unlink tested in expense-detail.spec.ts (Story 15.5).

---

**Generated by BMad TEA Agent** — 2026-02-21
