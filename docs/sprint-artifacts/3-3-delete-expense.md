# Story 3.3: Delete Expense

Status: done

## Story

As a property owner,
I want to delete an expense I entered by mistake,
so that my records are accurate.

## Acceptance Criteria

1. **AC-3.3.1**: User can delete an expense with inline confirmation
   - Delete icon visible on hover (desktop) or always visible (mobile)
   - Delete action shows inline confirmation before executing
   - Confirmation appears in place (not modal) for quick items

2. **AC-3.3.2**: Confirmation shows "Delete this expense?" with [Cancel] [Delete] options
   - Inline confirmation replaces expense row actions temporarily
   - Cancel returns to normal row state
   - Delete executes the deletion

3. **AC-3.3.3**: Expense is soft-deleted (DeletedAt set, not permanently removed)
   - Server-side: `DeletedAt = DateTime.UtcNow`
   - Expense no longer appears in lists due to global query filter
   - Data recoverable in database (FR56)

4. **AC-3.3.4**: Snackbar confirms "Expense deleted" after successful deletion
   - Snackbar appears at bottom-center
   - Auto-dismisses after 3 seconds
   - Success styling

5. **AC-3.3.5**: Expense disappears from list and totals recalculate
   - Expense removed from UI immediately
   - YTD total decreases by deleted expense amount
   - Property row total in dashboard updates (if navigated back)
   - Stats bar total updates on dashboard

## Tasks / Subtasks

- [x] Task 1: Create DeleteExpense Command and Handler (AC: 3.3.1, 3.3.3)
  - [x] Create `DeleteExpenseCommand.cs` in `Application/Expenses/` with Id parameter
  - [x] Create `DeleteExpenseHandler.cs` implementing `IRequestHandler<DeleteExpenseCommand>`
  - [x] Validate expense exists and belongs to user's account (throw NotFoundException if not)
  - [x] Set `DeletedAt = DateTime.UtcNow` (soft delete)
  - [x] Preserve all other fields unchanged
  - [x] Save to database
  - [x] Write unit tests for DeleteExpenseHandler (6 tests)

- [x] Task 2: Add DELETE Endpoint to ExpensesController (AC: 3.3.1, 3.3.3)
  - [x] Add `DELETE /api/v1/expenses/{id}` endpoint
  - [x] Return 204 No Content on success
  - [x] Return 404 if expense not found or wrong account
  - [x] Log deletion with expense ID and timestamp
  - [x] Update Swagger documentation

- [x] Task 3: Generate TypeScript API Client
  - [x] Run NSwag to generate updated TypeScript client
  - [x] Verify deleteExpense method generated

- [x] Task 4: Add ExpenseService Delete Method (AC: 3.3.1)
  - [x] Add `deleteExpense(id: string): Observable<void>` to ExpenseService

- [x] Task 5: Update ExpenseStore with Delete Functionality (AC: 3.3.4, 3.3.5)
  - [x] Add signal: `isDeleting` for loading state
  - [x] Add signal: `confirmingDeleteId` for inline confirmation state
  - [x] Add method: `startDeleteConfirmation(expenseId: string)` - shows inline confirm
  - [x] Add method: `cancelDeleteConfirmation()` - hides inline confirm
  - [x] Add rxMethod: `deleteExpense(expenseId: string)`
  - [x] On successful delete:
    - Remove expense from local state
    - Recalculate ytdTotal (subtract deleted amount)
    - Clear confirmingDeleteId
    - Show snackbar "Expense deleted"

- [x] Task 6: Update ExpenseRowComponent with Delete Action (AC: 3.3.1, 3.3.2)
  - [x] Add delete icon button next to edit button (visible on hover/focus)
  - [x] Add `@Output() delete` event emitter
  - [x] Add `@Input() isConfirmingDelete` to show confirmation state
  - [x] Add `@Output() cancelDelete` event emitter for cancel action
  - [x] Style delete icon with hover states (warning/red color)
  - [x] Always visible on mobile (same as edit)
  - [x] When confirming: show inline "Delete this expense?" [Cancel] [Delete]

- [x] Task 7: Implement Inline Delete Confirmation in ExpenseWorkspaceComponent (AC: 3.3.1, 3.3.2, 3.3.4, 3.3.5)
  - [x] Track which expense is showing delete confirmation via store.confirmingDeleteId
  - [x] Pass isConfirmingDelete input to ExpenseRowComponent
  - [x] Handle delete click: store.startDeleteConfirmation(expenseId)
  - [x] Handle cancel: store.cancelDeleteConfirmation()
  - [x] Handle confirm delete: store.deleteExpense(expenseId)
  - [x] Update ytdTotal display after deletion

- [x] Task 8: Write Unit Tests
  - [x] Backend: DeleteExpenseHandler tests (Handle_ValidId_SetsDeletedAt, Handle_NotFound_ThrowsNotFoundException, Handle_WrongAccount_ThrowsNotFoundException)
  - [x] Frontend: ExpenseRowComponent delete button and confirmation state tests
  - [x] Frontend: ExpenseStore deleteExpense method tests

- [x] Task 9: Run Tests and Validate
  - [x] Backend unit tests pass (182 tests passing)
  - [x] Frontend builds successfully
  - [x] Frontend tests pass (308 tests passing)
  - [x] Backend builds successfully

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Application Layer: `DeleteExpenseCommand`, `DeleteExpenseHandler` in `Application/Expenses/`
- MediatR: CQRS pattern - command for write operation
- Multi-tenant: `AccountId` filtering via EF Core global query filter (automatic)
- Soft delete: Set `DeletedAt` timestamp, do NOT physically delete

**Frontend Architecture:**
- Feature module: `features/expenses/`
- @ngrx/signals store: `deletingExpenseId`, `confirmingDeleteId` signals for tracking delete state
- Inline confirmation pattern: Show confirmation in row, not modal (per UX doc Section 7.6)
- Generated API client from NSwag

**UX Patterns (from UX Design Specification):**
- Inline confirmation for quick items (Section 7.6) - not modal
- Delete on hover reveal (same as edit, Section 6.3 ExpenseRowComponent)
- Snackbar at bottom-center, 3-second auto-dismiss (Section 7.3)
- Destructive actions show confirmation before executing

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Expenses/
    └── DeleteExpense.cs              # Command + Handler

backend/tests/PropertyManager.Application.Tests/Expenses/
    └── DeleteExpenseHandlerTests.cs  # Unit tests
```

**Backend files to modify:**
```
backend/src/PropertyManager.Api/Controllers/ExpensesController.cs  # Add DELETE endpoint
```

**Frontend files to modify:**
```
frontend/src/app/features/expenses/
    ├── services/
    │   └── expense.service.ts              # Add deleteExpense method
    ├── stores/
    │   └── expense.store.ts                # Add delete state and methods
    ├── components/
    │   └── expense-row/
    │       └── expense-row.component.ts    # Add delete button + confirmation UI
    └── expense-workspace/
        └── expense-workspace.component.ts  # Handle delete confirmation flow
```

### Learnings from Previous Story

**From Story 3-2-edit-expense (Status: done)**

- **ExpenseStore pattern established**: Signals and rxMethods pattern - follow same for delete operations
- **ExpenseRowComponent exists**: Has edit button on hover - add delete button next to it
- **ExpenseService exists**: Has `createExpense`, `updateExpense`, `getExpense` methods - add `deleteExpense`
- **Snackbar pattern established**: Use same pattern for "Expense deleted"
- **Inline edit pattern**: Replace row with edit form - similar inline confirm pattern for delete
- **Test patterns established**: 40 expense-related unit tests - follow same structure

**Key files created in 3-2:**
- `backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs` - Command pattern to follow
- `backend/src/PropertyManager.Application/Expenses/GetExpense.cs` - Query pattern
- `frontend/src/app/features/expenses/stores/expense.store.ts` - Store with edit state

[Source: docs/sprint-artifacts/3-2-edit-expense.md#Dev-Agent-Record]

### Data Model Reference

**DeleteExpenseCommand:**
```csharp
public record DeleteExpenseCommand(
    Guid Id
) : IRequest;
```

**API Contract:**
```
DELETE /api/v1/expenses/{id}

Response: 204 No Content
```

**Error Responses:**
- 404 Not Found: Expense doesn't exist or belongs to different account

### Inline Confirmation UI Pattern

```
Normal state:
┌─────────────────────────────────────────────────────┐
│ Nov 25   Home Depot - Faucet   [Repairs]  $127  [✎][🗑] │
└─────────────────────────────────────────────────────┘

Confirming delete state:
┌─────────────────────────────────────────────────────┐
│ Delete this expense?                 [Cancel] [Delete] │
└─────────────────────────────────────────────────────┘
```

### Testing Strategy

**Unit Tests (xUnit):**
- `DeleteExpenseHandlerTests`:
  - Handle_ValidId_SetsDeletedAtTimestamp
  - Handle_ValidId_PreservesOtherFields
  - Handle_ExpenseNotFound_ThrowsNotFoundException
  - Handle_WrongAccount_ThrowsNotFoundException (security)
  - Handle_AlreadyDeleted_ThrowsNotFoundException
  - Handle_ValidId_LogsDeletion

**Component Tests (Vitest):**
- `ExpenseRowComponent`:
  - Should show delete icon on hover
  - Should emit delete event when delete clicked
  - Should show inline confirmation when isConfirmingDelete is true
  - Should emit cancelDelete when cancel clicked
- `ExpenseStore`:
  - deleteExpense should remove expense from state
  - deleteExpense should update ytdTotal
  - deleteExpense should show snackbar on success

**Manual Verification Checklist:**
```markdown
## Smoke Test: Delete Expense

### API Verification
- [ ] DELETE /api/v1/expenses/{id} with valid id returns 204
- [ ] DELETE /api/v1/expenses/{id} with invalid id returns 404
- [ ] DELETE /api/v1/expenses/{id} with different account's expense returns 404

### Database Verification
- [ ] DeletedAt timestamp set after delete
- [ ] All other fields preserved (not null)
- [ ] Expense no longer appears in GET queries (global filter)

### Frontend Verification
- [ ] Hover expense row shows delete icon
- [ ] Click delete icon shows inline confirmation
- [ ] "Delete this expense?" text with Cancel and Delete buttons
- [ ] Click Cancel returns to normal row state
- [ ] Click Delete removes expense from list
- [ ] Snackbar shows "Expense deleted"
- [ ] YTD total decreases by deleted amount
- [ ] Cannot delete while editing (edit takes precedence)
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#AC-3.3: Delete Expense] - Acceptance Criteria AC-3.3.1 through AC-3.3.5
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Workflows - Delete Expense Flow] - Delete workflow sequence
- [Source: docs/epics.md#Story 3.3: Delete Expense] - Epic-level story definition
- [Source: docs/architecture.md#API Contracts] - REST endpoint patterns (DELETE returns 204)
- [Source: docs/architecture.md#Data Architecture] - Soft delete via DeletedAt timestamp
- [Source: docs/ux-design-specification.md#7.6 Confirmation Patterns] - Inline confirmation for quick items
- [Source: docs/ux-design-specification.md#7.3 Feedback Patterns] - Snackbar patterns
- [Source: docs/prd.md#FR16] - Users can delete an expense (with confirmation)
- [Source: docs/prd.md#FR56] - Deleted items are soft-deleted with ability to restore

## Dev Agent Record

### Context Reference

- [3-3-delete-expense.context.xml](./3-3-delete-expense.context.xml) - Generated 2025-12-07

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Task 1: Created DeleteExpenseCommand following UpdateExpenseCommand pattern - simple command with just Id parameter, handler validates existence (via global query filter + DeletedAt check) and sets DeletedAt timestamp

### Completion Notes List

- Implemented soft delete functionality following existing patterns from UpdateExpense
- Backend: Created DeleteExpenseCommand/Handler with 6 unit tests covering success, not found, wrong account, and already deleted scenarios
- API: Added DELETE /api/v1/expenses/{id} endpoint returning 204 on success, 404 on not found
- Frontend Store: Added confirmingDeleteId/isDeleting state, startDeleteConfirmation/cancelDeleteConfirmation methods, deleteExpense rxMethod
- UI: Updated ExpenseRowComponent with delete button (hover reveal), inline confirmation UI replacing row content
- All acceptance criteria satisfied: AC-3.3.1 through AC-3.3.5
- Tests: 182 backend tests passing, 308 frontend tests passing (including 26 new expense-related tests)

### File List

**Created:**
- `backend/src/PropertyManager.Application/Expenses/DeleteExpense.cs`
- `backend/tests/PropertyManager.Application.Tests/Expenses/DeleteExpenseHandlerTests.cs`
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.spec.ts`
- `frontend/src/app/features/expenses/stores/expense.store.spec.ts`

**Modified:**
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`
- `frontend/src/app/core/api/api.service.ts` (NSwag regenerated)
- `frontend/src/app/features/expenses/services/expense.service.ts`
- `frontend/src/app/features/expenses/stores/expense.store.ts`
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts`
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-07 | Initial story draft created | SM Agent (Create Story Workflow) |
| 2025-12-07 | Story context XML generated | Story Context Workflow |
| 2025-12-08 | Story implementation complete - all tasks finished, tests passing | Dev Agent (Claude Opus 4.5) |
| 2025-12-08 | Senior Developer Review notes appended | Senior Developer Review (AI) |

## Senior Developer Review (AI)

### Reviewer
Dave

### Date
2025-12-08

### Outcome
**✅ APPROVE**

All acceptance criteria fully implemented with evidence. All completed tasks verified. No security vulnerabilities or architectural violations found. Tests comprehensive and passing.

### Summary

Story 3.3 (Delete Expense) implements soft-delete functionality for expenses following established Clean Architecture patterns. The implementation includes:

- Backend: DeleteExpense command/handler with soft-delete via `DeletedAt` timestamp
- API: `DELETE /api/v1/expenses/{id}` endpoint returning 204/404 as specified
- Frontend: Inline confirmation UI (not modal), store state management, snackbar feedback
- Tests: 6 backend unit tests + comprehensive frontend tests (47+ delete-related tests)

The code follows existing patterns from the UpdateExpense feature and adheres to architectural constraints.

### Key Findings

**No HIGH or MEDIUM severity issues found.**

### Acceptance Criteria Coverage

| AC # | Description | Status | Evidence |
|------|-------------|--------|----------|
| AC-3.3.1 | User can delete expense with inline confirmation | ✅ IMPLEMENTED | `expense-row.component.ts:64-69`, `expense-row.component.ts:260-262` |
| AC-3.3.2 | Confirmation shows "Delete this expense?" [Cancel] [Delete] | ✅ IMPLEMENTED | `expense-row.component.ts:74-98` |
| AC-3.3.3 | Expense is soft-deleted (DeletedAt set) | ✅ IMPLEMENTED | `DeleteExpense.cs:48` |
| AC-3.3.4 | Snackbar confirms "Expense deleted" | ✅ IMPLEMENTED | `expense.store.ts:489` |
| AC-3.3.5 | Expense disappears and totals recalculate | ✅ IMPLEMENTED | `expense.store.ts:474-479` |

**Summary: 5 of 5 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked | Verified | Evidence |
|------|--------|----------|----------|
| Task 1: Create DeleteExpense Command/Handler | [x] | ✅ VERIFIED | `DeleteExpense.cs:9-54` |
| Task 2: Add DELETE Endpoint | [x] | ✅ VERIFIED | `ExpensesController.cs:285-329` |
| Task 3: Generate TypeScript API Client | [x] | ✅ VERIFIED | `api.service.ts:30` |
| Task 4: Add ExpenseService Delete Method | [x] | ✅ VERIFIED | `expense.service.ts:143-145` |
| Task 5: Update ExpenseStore | [x] | ✅ VERIFIED | `expense.store.ts:37-40, 434-520` |
| Task 6: Update ExpenseRowComponent | [x] | ✅ VERIFIED | `expense-row.component.ts:222-236, 62-98` |
| Task 7: Implement Inline Delete in Workspace | [x] | ✅ VERIFIED | `expense-workspace.component.ts:110-117, 322-338` |
| Task 8: Write Unit Tests | [x] | ✅ VERIFIED | `DeleteExpenseHandlerTests.cs`, `expense-row.component.spec.ts`, `expense.store.spec.ts` |
| Task 9: Run Tests and Validate | [x] | ✅ VERIFIED | Backend: 6 tests pass, Frontend: 308 tests pass |

**Summary: 9 of 9 completed tasks verified, 0 questionable, 0 falsely marked complete**

### Test Coverage and Gaps

**Backend Tests (xUnit):**
- `DeleteExpenseHandlerTests.cs`: 6 tests covering:
  - `Handle_ValidId_SetsDeletedAtTimestamp`
  - `Handle_ValidId_PreservesOtherFields`
  - `Handle_ExpenseNotFound_ThrowsNotFoundException`
  - `Handle_WrongAccount_ThrowsNotFoundException`
  - `Handle_AlreadyDeleted_ThrowsNotFoundException`
  - `Handle_ValidCommand_CallsSaveChanges`

**Frontend Tests (Vitest):**
- `expense-row.component.spec.ts`: 20 tests covering delete button, confirmation UI, events
- `expense.store.spec.ts`: 27 tests covering delete state management, snackbar calls

**Test Gaps:** None identified. Coverage is comprehensive.

### Architectural Alignment

| Constraint | Status | Notes |
|------------|--------|-------|
| Clean Architecture (Command/Handler in Application layer) | ✅ Compliant | `DeleteExpense.cs` follows pattern |
| MediatR CQRS pattern | ✅ Compliant | Uses `IRequest` command pattern |
| Multi-tenant AccountId filtering | ✅ Compliant | Global query filter handles isolation |
| Soft delete via DeletedAt | ✅ Compliant | `expense.DeletedAt = DateTime.UtcNow` |
| REST API conventions (204 on success, 404 on not found) | ✅ Compliant | `ExpensesController.cs:310, 327` |
| Inline confirmation (not modal) | ✅ Compliant | UX spec Section 7.6 followed |
| Snackbar at bottom-center, 3-second dismiss | ✅ Compliant | `expense.store.ts:489-493` |

### Security Notes

- ✅ **Tenant isolation**: Global query filter ensures expenses from other accounts are not accessible
- ✅ **Information disclosure**: Same 404 response for "not found" and "wrong account" (no leaking existence)
- ✅ **Authorization**: JWT authentication required on endpoint via `[Authorize]` attribute
- ✅ **Input validation**: GUID route constraint validates ID format

### Best-Practices and References

- [.NET Soft Delete Pattern](https://docs.microsoft.com/en-us/ef/core/querying/filters) - Global query filters for soft deletes
- [@ngrx/signals Documentation](https://ngrx.io/guide/signals) - Signal-based state management
- [Angular Material Snackbar](https://material.angular.io/components/snack-bar/overview) - Snackbar configuration

### Action Items

**Code Changes Required:**
(None - story approved)

**Advisory Notes:**
- Note: The `_currentUser` dependency is injected in handler but not explicitly used - this is intentional as global query filter handles tenant filtering automatically
- Note: Consider adding an integration test for the DELETE endpoint in a future story to verify end-to-end behavior with real database
