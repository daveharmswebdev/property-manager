# Story 16.8: Wire Duplicate Expense Detection into Receipt Processing

Status: dev-complete

## Story

As a property owner processing receipts into expenses,
I want the system to warn me if I'm about to create a duplicate expense,
so that I don't accidentally record the same expense twice from a receipt.

## Acceptance Criteria

1. **AC-16.8.1 — Duplicate check before receipt-to-expense creation:**
   Given I process a receipt into an expense
   When the system is about to create the expense
   Then it calls `GET /api/v1/expenses/check-duplicate` with the propertyId, amount, and date
   And if a match is found (same property + amount + date within ±1 day), the `DuplicateWarningDialogComponent` is shown

2. **AC-16.8.2 — User can proceed or cancel on duplicate warning:**
   Given the duplicate warning dialog is shown during receipt processing
   When I choose "Save Anyway"
   Then the expense is created normally via `receipts_ProcessReceipt`
   When I choose "Cancel"
   Then the expense is not created and the receipt remains unprocessed

3. **AC-16.8.3 — No warning when no duplicate exists:**
   Given I process a receipt into an expense with no matching existing expense
   When the duplicate check completes
   Then no dialog is shown and the expense is created immediately

4. **AC-16.8.4 — Graceful degradation on check failure:**
   Given the duplicate check API call fails (network error, server error)
   When the error occurs
   Then the error is logged to console
   And the expense creation proceeds normally (duplicate check must never block a save)

5. **AC-16.8.5 — Submit button disabled during duplicate check:**
   Given I click the submit button on the receipt expense form
   When the duplicate check is in progress
   Then the submit button is disabled to prevent double-submission

## Tasks / Subtasks

- [x] Task 1: Add duplicate check to `ReceiptExpenseFormComponent.onSubmit()` (AC: 1, 3, 4, 5)
  - [x] 1.1 Import `ExpenseService`, `MatDialog`, `DuplicateWarningDialogComponent`, `DuplicateWarningDialogData`
  - [x] 1.2 Inject `ExpenseService` and `MatDialog` via `inject()`
  - [x] 1.3 Add `isCheckingDuplicate = signal(false)` state signal
  - [x] 1.4 Disable submit button when `isCheckingDuplicate()` is true (add to existing disabled binding)
  - [x] 1.5 Refactor `onSubmit()`: after form validation + value extraction, call `expenseService.checkDuplicateExpense(propertyId, amount, formattedDate)` before `receipts_ProcessReceipt()`
  - [x] 1.6 On success with `isDuplicate: false` → call existing `receipts_ProcessReceipt()` flow unchanged
  - [x] 1.7 On success with `isDuplicate: true` → call `showDuplicateWarning()` helper
  - [x] 1.8 On error → log to console, fall through to `receipts_ProcessReceipt()` (never block saves)
- [x] Task 2: Add `showDuplicateWarning()` helper method (AC: 2)
  - [x] 2.1 Create private `showDuplicateWarning(existingExpense, pendingFormData)` method
  - [x] 2.2 Open `DuplicateWarningDialogComponent` with `{ existingExpense: { id, date, amount, description } }`, width `'450px'`
  - [x] 2.3 Subscribe to `afterClosed()`: if `true` → call `receipts_ProcessReceipt()` with pending data; if `false`/dismissed → do nothing (receipt stays unprocessed)
- [x] Task 3: Write unit tests (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Test: `onSubmit()` calls `checkDuplicateExpense` with correct params before processing
  - [x] 3.2 Test: when no duplicate found, `receipts_ProcessReceipt` is called directly
  - [x] 3.3 Test: when duplicate found, `DuplicateWarningDialogComponent` opens with correct data
  - [x] 3.4 Test: when dialog returns `true`, `receipts_ProcessReceipt` is called
  - [x] 3.5 Test: when dialog returns `false`, `receipts_ProcessReceipt` is NOT called
  - [x] 3.6 Test: when duplicate check errors, `receipts_ProcessReceipt` is called anyway (graceful degradation)
  - [x] 3.7 Test: submit button is disabled while `isCheckingDuplicate` is true

## Dev Notes

### This is a PURE FRONTEND wiring task. No backend changes needed.

All infrastructure exists — this story is connecting existing pieces:
- Backend endpoint: `GET /api/v1/expenses/check-duplicate` — fully working
- Frontend service: `ExpenseService.checkDuplicateExpense()` — fully implemented
- Dialog: `DuplicateWarningDialogComponent` — fully built, standalone, reusable

### Reference Implementation (THE pattern to copy)

**File:** `frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts`

The exact pattern to replicate lives in this file:
- **Lines 20-28:** Imports for `MatDialog`, `DuplicateWarningDialogComponent`, `DuplicateWarningDialogData`
- **Line 257:** `isCheckingDuplicate = signal(false)` state signal
- **Line 153:** Button disabled binding includes `isCheckingDuplicate()`
- **Lines 328-381:** `onSubmit()` — validates form, calls `checkDuplicateExpense()`, handles result
- **Lines 386-412:** `showDuplicateWarning()` — opens dialog, subscribes to `afterClosed()`

### Target File (WHERE to make changes)

**File:** `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts`

- **Line 387:** `onSubmit()` — this is where the duplicate check must be inserted
- Current flow: validate form → extract values → call `receipts_ProcessReceipt()` directly
- New flow: validate form → extract values → call `checkDuplicateExpense()` → show dialog if duplicate → call `receipts_ProcessReceipt()` if clear

### Critical Implementation Details

1. **`ExpenseService` is in the expenses feature** — import from `'../../expenses/services/expense.service'` (relative) or use the path `features/expenses/services/expense.service`
2. **Date formatting:** Use `formatLocalDate(date)` to produce `YYYY-MM-DD` string — same as existing `formatDate()` in the component
3. **PropertyId source:** `this.propertyId()` — already available as an input signal
4. **Amount source:** `this.form.value.amount` — from the reactive form
5. **Dialog width:** `'450px'` — must match the existing pattern
6. **Error handling:** On duplicate check failure, log error and proceed to save. NEVER block the save.
7. **The `receipts_ProcessReceipt()` call remains unchanged** — it's just gated behind the duplicate check

### Existing Imports Already in receipt-expense-form

The component already imports/injects:
- `ApiClient` (NSwag-generated) — for `receipts_ProcessReceipt()`
- `MatSnackBar` — for notifications
- Reactive forms, Angular Material form components
- Various signal helpers

**New imports needed:**
- `ExpenseService` from `features/expenses/services/expense.service`
- `MatDialog` from `@angular/material/dialog`
- `DuplicateWarningDialogComponent` and `DuplicateWarningDialogData` from `features/expenses/components/duplicate-warning-dialog/duplicate-warning-dialog.component`

### Project Structure Notes

- All changes in a single file: `receipt-expense-form.component.ts` (plus its spec file)
- No new files, no new components, no new services, no backend changes
- Cross-feature import from `expenses` → acceptable, `ExpenseService` and `DuplicateWarningDialogComponent` are already designed for reuse
- Follows existing Angular conventions: `inject()` for DI, `signal()` for state

### Testing Standards

- Spec file: `receipt-expense-form.component.spec.ts` (co-located)
- Use `vi.fn()` for mocks, `vi.spyOn()` for spies
- Mock `ExpenseService.checkDuplicateExpense()` returning `of({ isDuplicate: false, existingExpense: null })` for default
- Mock `MatDialog.open()` returning `{ afterClosed: () => of(true) }` for dialog tests
- Use `TestBed` configuration in `beforeEach`
- Follow `describe/it` block pattern
- Reference AC codes in comments: `// AC-16.8.1`, `// AC-16.8.2`, etc.

### Previous Story Intelligence (from 16.6)

- Test baseline: 2,466 frontend tests, 1,489 backend tests, 6/6 E2E tests passing
- Signal-based components: use `input()` / `output()` / `signal()` functions — already the pattern in receipt-expense-form
- `data-testid` attributes on interactive elements for E2E targeting

### Git Intelligence

Recent receipt-related work:
- PR #251/c435587: PDF receipt thumbnail generation (server-side) — no impact on this story
- PR #242/dac1b22: Expense-WorkOrder-Receipt linking (Story 16.4) — established the 1:1 Receipt-Expense relationship pattern
- No prior commits touch duplicate detection in the receipt flow

### References

- [Source: epic-16-feature-completeness-ux-polish.md#Story 16.8] — Story definition and acceptance criteria
- [Source: frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts#L328-412] — Reference implementation of duplicate check pattern
- [Source: frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts#L387-437] — Target onSubmit() to modify
- [Source: frontend/src/app/features/expenses/services/expense.service.ts#L240-248] — checkDuplicateExpense() service method
- [Source: frontend/src/app/features/expenses/components/duplicate-warning-dialog/duplicate-warning-dialog.component.ts] — Reusable dialog component
- [Source: backend/src/PropertyManager.Application/Expenses/CheckDuplicateExpense.cs] — Backend query (±1 day matching logic)
- [Source: project-context.md] — Project conventions and rules

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Fixed pre-existing type error in `work-orders.component.spec.ts` line 38: changed `ReturnType<typeof vi.fn>` to `any` for `dialogSpy` to resolve Vitest/MatDialog type mismatch

### Completion Notes List
- Pure frontend wiring task — no backend changes needed
- Refactored `onSubmit()` to flow through `checkDuplicateExpense()` before `receipts_ProcessReceipt()`
- Extracted `processReceipt()` private method to avoid duplication across success/error/dialog paths
- All 7 new tests + 36 existing tests pass (43 total in spec file)
- Full test suite: 2,496 tests passing across 107 test files

### File List
- `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts` — Added duplicate check wiring
- `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts` — Added 7 tests for AC-16.8
- `frontend/src/app/features/work-orders/work-orders.component.spec.ts` — Fixed pre-existing type error (line 38)
