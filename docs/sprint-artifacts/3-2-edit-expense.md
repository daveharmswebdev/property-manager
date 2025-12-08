# Story 3.2: Edit Expense

Status: done

## Story

As a property owner,
I want to edit an existing expense,
so that I can correct mistakes in amount, date, or category.

## Acceptance Criteria

1. **AC-3.2.1**: User can edit amount, date, category, and description of existing expense
   - Expense form pre-populated with current values
   - All editable fields: Amount, Date, Category, Description
   - PropertyId is NOT editable (delete and recreate to change property)

2. **AC-3.2.2**: Edit actions appear on hover/focus of expense row
   - Edit icon visible on hover (desktop) or always visible (mobile)
   - Edit action opens inline edit form OR side panel with pre-filled form
   - Form shows current expense values

3. **AC-3.2.3**: UpdatedAt timestamp is set on save
   - Server-side: `UpdatedAt = DateTime.UtcNow`
   - Preserves original `CreatedAt` and `CreatedByUserId`

4. **AC-3.2.4**: Snackbar confirms "Expense updated" after successful save
   - Snackbar appears at bottom-center
   - Auto-dismisses after 3 seconds
   - Success styling (green)

5. **AC-3.2.5**: Totals recalculate if amount changed
   - YTD total in expense workspace updates
   - Property row total in dashboard updates (if navigated back)
   - Stats bar total updates on dashboard

## Tasks / Subtasks

- [x] Task 1: Create UpdateExpense Command and Handler (AC: 3.2.1, 3.2.3)
  - [x] Create `UpdateExpenseCommand.cs` in `Application/Expenses/` with Id, Amount, Date, CategoryId, Description
  - [x] Create `UpdateExpenseHandler.cs` implementing `IRequestHandler<UpdateExpenseCommand>`
  - [x] Validate expense exists and belongs to user's account (throw NotFoundException if not)
  - [x] Validate category exists
  - [x] Update entity fields (Amount, Date, CategoryId, Description)
  - [x] Set `UpdatedAt = DateTime.UtcNow`
  - [x] Preserve `CreatedAt`, `CreatedByUserId`, `PropertyId`
  - [x] Save to database
  - [x] Write unit tests for UpdateExpenseHandler (10 tests)

- [x] Task 2: Create UpdateExpense Validator (AC: 3.2.1)
  - [x] Create `UpdateExpenseValidator.cs` with FluentValidation rules
  - [x] Id: NotEmpty
  - [x] CategoryId: NotEmpty
  - [x] Amount: GreaterThan(0), LessThanOrEqualTo(9999999.99m)
  - [x] Date: NotEmpty, LessThanOrEqualTo(today)
  - [x] Description: MaximumLength(500), no HTML
  - [x] Write unit tests for validator (14 tests)

- [x] Task 3: Create GetExpense Query (AC: 3.2.1, 3.2.2)
  - [x] Create `GetExpenseQuery.cs` with ExpenseId parameter
  - [x] Create `GetExpenseHandler.cs` returning ExpenseDto
  - [x] Filter by AccountId (automatic via global query filter)
  - [x] Include Category name for display
  - [x] Return 404 if not found or wrong account
  - [x] Write unit tests for GetExpenseHandler (9 tests)

- [x] Task 4: Add PUT Endpoint to ExpensesController (AC: 3.2.1, 3.2.3, 3.2.4)
  - [x] Add `PUT /api/v1/expenses/{id}` endpoint
  - [x] Accept UpdateExpenseRequest body: `{ amount, date, categoryId, description }`
  - [x] Return 204 No Content on success
  - [x] Return 400 for validation errors with Problem Details
  - [x] Return 404 if expense not found
  - [x] Update Swagger documentation

- [x] Task 5: Add GET Single Expense Endpoint (AC: 3.2.2)
  - [x] Add `GET /api/v1/expenses/{id}` endpoint
  - [x] Return ExpenseDto with full details
  - [x] Return 404 if not found

- [x] Task 6: Generate TypeScript API Client
  - [x] Run NSwag to generate updated TypeScript client
  - [x] Verify UpdateExpenseRequest interface generated
  - [x] Verify getExpense and updateExpense methods generated

- [x] Task 7: Add ExpenseService Update Methods (AC: 3.2.1)
  - [x] Add `getExpense(id: string): Observable<ExpenseDto>` to ExpenseService
  - [x] Add `updateExpense(id: string, request: UpdateExpenseRequest): Observable<void>` to ExpenseService

- [x] Task 8: Update ExpenseStore with Edit Functionality (AC: 3.2.1, 3.2.4, 3.2.5)
  - [x] Add signals: `editingExpenseId`, `editingExpense`, `isEditing`, `isUpdating`
  - [x] Add method: `startEditing(expenseId: string)`
  - [x] Add method: `cancelEditing()`
  - [x] Add rxMethod: `updateExpense({ expenseId, request })`
  - [x] On successful update:
    - Update expense in local state
    - Recalculate ytdTotal if amount changed
    - Clear editingExpense
    - Show snackbar "Expense updated"

- [x] Task 9: Create ExpenseEditFormComponent (AC: 3.2.1, 3.2.2)
  - [x] Create `expense-edit-form.component.ts` in `features/expenses/components/`
  - [x] Accept @Input expense: ExpenseDto
  - [x] Pre-populate reactive form with expense values
  - [x] Same validation as ExpenseFormComponent
  - [x] Emit (save) event with updated values
  - [x] Emit (cancel) event to close edit mode
  - [x] Loading state during save

- [x] Task 10: Update ExpenseRowComponent with Edit Actions (AC: 3.2.2)
  - [x] Add edit icon button to expense row (visible on hover/focus)
  - [x] Add `@Output() edit` event emitter
  - [x] Style edit icon with hover states
  - [x] Always visible on mobile

- [x] Task 11: Implement Inline Edit in ExpenseWorkspaceComponent (AC: 3.2.1, 3.2.2, 3.2.4, 3.2.5)
  - [x] Track which expense is being edited via store.editingExpenseId
  - [x] Show ExpenseEditFormComponent when editing (replace ExpenseRowComponent for that row)
  - [x] Handle save: call ExpenseStore.updateExpense()
  - [x] Handle cancel: store.cancelEditing()
  - [x] Update ytdTotal display after amount change
  - [x] Hide create form when editing

- [x] Task 12: Run Tests and Validate
  - [x] Backend unit tests pass (40 expense tests)
  - [x] Frontend builds successfully
  - [x] Frontend tests pass (267 tests)
  - [x] Backend builds successfully

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Application Layer: `UpdateExpenseCommand`, `UpdateExpenseHandler`, `GetExpenseQuery`, `GetExpenseHandler` in `Application/Expenses/`
- FluentValidation: `UpdateExpenseValidator` for request validation
- MediatR: CQRS pattern - command for write, query for read
- Multi-tenant: `AccountId` filtering via EF Core global query filter (automatic)
- Audit fields: Preserve `CreatedAt`, update `UpdatedAt`

**Frontend Architecture:**
- Feature module: `features/expenses/`
- @ngrx/signals store: `editingExpenseId` signal for tracking edit state
- Inline edit pattern: Replace row with edit form, not modal (keeps user in context)
- Generated API client from NSwag

**UX Patterns (from UX Design Specification):**
- Edit on hover reveal (Section 6.3 ExpenseRowComponent)
- Inline edit preferred - keeps user in context
- Snackbar at bottom-center, 3-second auto-dismiss (Section 7.3)
- Form validation on blur (Section 7.4)

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Expenses/
    ├── UpdateExpense.cs           # Command + Handler
    ├── UpdateExpenseValidator.cs  # FluentValidation
    ├── GetExpense.cs              # Query + Handler (if not exists)

backend/tests/PropertyManager.Application.Tests/Expenses/
    ├── UpdateExpenseHandlerTests.cs
    ├── UpdateExpenseValidatorTests.cs
    └── GetExpenseHandlerTests.cs
```

**Frontend files to create/modify:**
```
frontend/src/app/features/expenses/
    ├── components/
    │   ├── expense-edit-form/
    │   │   ├── expense-edit-form.component.ts
    │   │   └── expense-edit-form.component.spec.ts
    │   └── expense-row/
    │       └── expense-row.component.ts  # MODIFY - add edit action
    ├── stores/
    │   └── expense.store.ts              # MODIFY - add edit signals/methods
    └── expense-workspace/
        └── expense-workspace.component.ts  # MODIFY - handle inline edit
```

### Learnings from Previous Story

**From Story 3-1-expense-workspace-create-expense (Status: done)**

- **ExpenseStore pattern established**: Signals (`expenses`, `categories`, `isLoading`, `isSaving`, `error`, `currentPropertyId`, `ytdTotal`) and rxMethods (`loadCategories`, `loadExpensesByProperty`, `createExpense`) - follow same pattern for edit operations

- **ExpenseRowComponent exists**: Displays Date, Description, Category chip, Amount - extend with edit icon on hover

- **ExpenseFormComponent exists**: Reactive form with Amount, Date, Category, Description - can reuse validation patterns for ExpenseEditFormComponent

- **Expense Workspace pattern**: Form + history on same page - inline edit fits naturally (replace row with edit form)

- **ExpenseService exists**: Has `createExpense`, `getExpensesByProperty`, `getCategories` methods - add `getExpense`, `updateExpense`

- **CategorySelectComponent exists**: Reuse in edit form

- **Snackbar pattern established**: Use same pattern for "Expense updated"

- **Route structure**: `/properties/:id/expenses` - edit happens in-place, no new route needed

[Source: docs/sprint-artifacts/3-1-expense-workspace-create-expense.md#Dev-Notes]

### Data Model Reference

**UpdateExpenseCommand:**
```csharp
public record UpdateExpenseCommand(
    Guid Id,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
) : IRequest;
```

**API Contract:**
```
PUT /api/v1/expenses/{id}
{
  "amount": 135.00,
  "date": "2025-12-04",
  "categoryId": "guid",
  "description": "Updated description"
}

Response: 204 No Content
```

**Note:** PropertyId is intentionally NOT in the update request - expenses cannot be moved between properties.

### Testing Strategy

**Unit Tests (xUnit):**
- `UpdateExpenseHandlerTests`:
  - Handle_ValidUpdate_UpdatesExpense
  - Handle_AmountChanged_UpdatesAmount
  - Handle_ExpenseNotFound_ThrowsNotFoundException
  - Handle_WrongAccount_ThrowsNotFoundException (security)
  - Handle_InvalidCategory_ThrowsValidationException

- `UpdateExpenseValidatorTests`:
  - Validate_ValidRequest_Passes
  - Validate_EmptyId_Fails
  - Validate_NegativeAmount_Fails
  - Validate_ZeroAmount_Fails
  - Validate_FutureDate_Fails
  - Validate_DescriptionTooLong_Fails

- `GetExpenseHandlerTests`:
  - Handle_ValidId_ReturnsExpense
  - Handle_NotFound_ThrowsNotFoundException
  - Handle_WrongAccount_ThrowsNotFoundException

**Integration Tests (xUnit):**
- `ExpensesControllerTests`:
  - UpdateExpense_ValidRequest_Returns204
  - UpdateExpense_ValidationFailure_Returns400
  - UpdateExpense_NotFound_Returns404
  - UpdateExpense_WrongAccount_Returns404
  - GetExpense_ValidId_ReturnsExpense
  - GetExpense_NotFound_Returns404

**Component Tests (Vitest):**
- `ExpenseEditFormComponent`: Pre-population, validation, save/cancel events
- `ExpenseRowComponent`: Edit icon visibility, hover states, event emission
- `ExpenseWorkspaceComponent`: Inline edit flow, state transitions

**Manual Verification Checklist:**
```markdown
## Smoke Test: Edit Expense

### API Verification
- [ ] GET /api/v1/expenses/{id} returns expense details
- [ ] PUT /api/v1/expenses/{id} with valid data returns 204
- [ ] PUT /api/v1/expenses/{id} with invalid amount returns 400
- [ ] PUT /api/v1/expenses/{id} with wrong id returns 404

### Database Verification
- [ ] UpdatedAt timestamp changed after update
- [ ] CreatedAt timestamp preserved (not changed)
- [ ] Amount/Date/CategoryId/Description updated correctly
- [ ] PropertyId unchanged

### Frontend Verification
- [ ] Hover expense row shows edit icon
- [ ] Click edit icon shows inline edit form
- [ ] Form pre-populated with current values
- [ ] Save button disabled until form valid
- [ ] Successful save shows snackbar "Expense updated"
- [ ] Expense row updates with new values immediately
- [ ] YTD total updates if amount changed
- [ ] Cancel closes edit form without changes
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#AC-3.2: Edit Expense] - Acceptance Criteria AC-3.2.1 through AC-3.2.5
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Workflows - Edit Expense Flow] - Edit workflow sequence
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Data Models - UpdateExpenseCommand] - Command structure
- [Source: docs/epics.md#Story 3.2: Edit Expense] - Epic-level story definition
- [Source: docs/architecture.md#API Contracts] - REST endpoint patterns (PUT returns 204)
- [Source: docs/architecture.md#Implementation Patterns - CQRS Pattern] - Command/Handler structure
- [Source: docs/ux-design-specification.md#6.3 ExpenseRowComponent] - Edit on hover reveal pattern
- [Source: docs/ux-design-specification.md#7.3 Feedback Patterns] - Snackbar patterns
- [Source: docs/prd.md#FR15] - Users can edit an existing expense

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/3-2-edit-expense.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- All 12 tasks completed successfully
- Backend: 40 expense-related unit tests passing
- Frontend: 267 tests passing, build successful
- Inline edit pattern implemented - edit form replaces row when editing
- Edit icon appears on hover (desktop) or always visible (mobile)
- YTD total recalculates automatically when amount is changed
- Snackbar confirmation on successful update

### File List

**Backend (Created):**
- `backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs` - Command + Handler
- `backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs` - FluentValidation
- `backend/src/PropertyManager.Application/Expenses/GetExpense.cs` - Query + Handler
- `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseHandlerTests.cs` - 10 tests
- `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseValidatorTests.cs` - 14 tests
- `backend/tests/PropertyManager.Application.Tests/Expenses/GetExpenseHandlerTests.cs` - 9 tests

**Backend (Modified):**
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` - Added PUT/GET endpoints

**Frontend (Created):**
- `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts`

**Frontend (Modified):**
- `frontend/src/app/features/expenses/services/expense.service.ts` - Added getExpense, updateExpense
- `frontend/src/app/features/expenses/stores/expense.store.ts` - Added edit state and methods
- `frontend/src/app/features/expenses/components/expense-row/expense-row.component.ts` - Added edit button
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts` - Inline edit integration
- `frontend/src/app/core/api/api.service.ts` - Regenerated NSwag client

**Config (Modified):**
- `frontend/nswag.json` - Fixed port from 5000 to 5292

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-07 | Initial story draft created | SM Agent (Create Story Workflow) |
| 2025-12-08 | Story implementation completed | Dev Agent (dev-story workflow) |
