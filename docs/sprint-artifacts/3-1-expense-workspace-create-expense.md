# Story 3.1: Expense Workspace - Create Expense

Status: done

## Story

As a property owner,
I want to add expenses to a property with amount, date, and category,
so that I can track what I'm spending on each rental.

## Acceptance Criteria

1. **AC-3.1.1**: User can create an expense with required fields: amount, date, category, propertyId
   - Expense Workspace accessible via [+ Add] on property row or [+ Add Expense] on property detail
   - Route: `/properties/:id/expenses`
   - Form displays property name in header for context
   - All required fields must be filled before submission

2. **AC-3.1.2**: Amount must be greater than $0 and display validation error if invalid
   - Amount field is currency input with 2 decimal precision
   - Validation error "Amount must be greater than $0" shown inline
   - Server-side validation: Amount > 0, max 2 decimal places, max $9,999,999.99

3. **AC-3.1.3**: Date defaults to today and cannot be in the future
   - Date field uses Angular Material datepicker
   - Default value: today's date
   - Validation error if date is in the future
   - Date stored as DateOnly in backend

4. **AC-3.1.4**: Category dropdown displays all 15 IRS Schedule E categories
   - Categories loaded from `/api/v1/expense-categories` endpoint
   - Display all 15 categories: Advertising, Auto and Travel, Cleaning and Maintenance, Commissions, Insurance, Legal and Professional Fees, Management Fees, Mortgage Interest, Other Interest, Repairs, Supplies, Taxes, Utilities, Depreciation, Other
   - Categories sorted by SortOrder from database

5. **AC-3.1.5**: Description field is optional with 500 character max
   - Text input for expense description
   - Max length validation (500 chars)
   - No HTML allowed (sanitized server-side)

6. **AC-3.1.6**: Expense is saved immediately and snackbar confirms "Expense saved ✓"
   - POST request to `/api/v1/expenses`
   - Immediate persistence (FR55)
   - Success snackbar appears at bottom-center
   - Snackbar auto-dismisses after 3 seconds

7. **AC-3.1.7**: New expense appears at top of expense list without page refresh
   - ExpenseStore updates local state on successful save
   - Expense list below form shows new expense immediately
   - YTD total updates to include new expense amount

8. **AC-3.1.8**: Form clears after successful save, ready for next entry
   - All form fields reset to defaults after successful save
   - Date resets to today
   - Category clears (must be re-selected)
   - Form ready for batch entry pattern

## Tasks / Subtasks

- [ ] Task 1: Create Expense Entity and Database Configuration (AC: 3.1.1)
  - [ ] Verify `Expense` entity exists in `Domain/Entities/Expense.cs` from Epic 1
  - [ ] Verify `ExpenseConfiguration` in Infrastructure with proper mapping
  - [ ] Verify foreign key relationships: PropertyId, CategoryId, CreatedByUserId
  - [ ] Verify global query filter for AccountId tenant isolation
  - [ ] Verify global query filter for soft deletes (DeletedAt == null)
  - [ ] Add database indexes for performance (AccountId+Date, AccountId+PropertyId, AccountId+CategoryId)
  - [ ] Create migration for indexes if needed

- [ ] Task 2: Create CreateExpense Command and Handler (AC: 3.1.1, 3.1.2, 3.1.3, 3.1.5, 3.1.6)
  - [ ] Create `CreateExpenseCommand.cs` in `Application/Expenses/` with PropertyId, Amount, Date, CategoryId, Description
  - [ ] Create `CreateExpenseHandler.cs` implementing `IRequestHandler<CreateExpenseCommand, Guid>`
  - [ ] Validate property exists and belongs to user's account
  - [ ] Validate category exists
  - [ ] Create Expense entity with AccountId from current user
  - [ ] Set CreatedAt, UpdatedAt, CreatedByUserId
  - [ ] Return new expense ID
  - [ ] Write unit tests for CreateExpenseHandler (6+ tests: valid expense, invalid amount, future date, invalid property, invalid category, max description length)

- [ ] Task 3: Create CreateExpense Validator (AC: 3.1.2, 3.1.3, 3.1.5)
  - [ ] Create `CreateExpenseValidator.cs` with FluentValidation rules
  - [ ] PropertyId: NotEmpty
  - [ ] CategoryId: NotEmpty
  - [ ] Amount: GreaterThan(0), LessThanOrEqualTo(9999999.99m)
  - [ ] Date: NotEmpty, LessThanOrEqualTo(today)
  - [ ] Description: MaximumLength(500), no HTML
  - [ ] Write unit tests for validator (8+ tests covering all rules)

- [ ] Task 4: Create GetExpenseCategories Query (AC: 3.1.4)
  - [ ] Create `GetExpenseCategoriesQuery.cs` in `Application/Expenses/`
  - [ ] Create `GetExpenseCategoriesHandler.cs` returning List<ExpenseCategoryDto>
  - [ ] Return all categories ordered by SortOrder
  - [ ] ExpenseCategoryDto: Id, Name, ScheduleELine, SortOrder
  - [ ] Write unit tests for handler

- [ ] Task 5: Create GetExpensesByProperty Query (AC: 3.1.7)
  - [ ] Create `GetExpensesByPropertyQuery.cs` with PropertyId, optional Year filter
  - [ ] Create `GetExpensesByPropertyHandler.cs` returning ExpenseListDto
  - [ ] Filter by PropertyId and AccountId
  - [ ] Order by Date descending (newest first)
  - [ ] Include ExpenseDto with: Id, PropertyId, PropertyName, CategoryId, CategoryName, ScheduleELine, Amount, Date, Description, CreatedAt
  - [ ] Calculate YTD total for the property
  - [ ] Write unit tests for handler

- [ ] Task 6: Add Endpoints to ExpensesController (AC: 3.1.1, 3.1.4, 3.1.6, 3.1.7)
  - [ ] Create `ExpensesController.cs` in API layer if not exists
  - [ ] Add `POST /api/v1/expenses` endpoint returning 201 Created with `{ id }`
  - [ ] Add `GET /api/v1/expense-categories` endpoint returning category list
  - [ ] Add `GET /api/v1/properties/{id}/expenses` endpoint returning expense list
  - [ ] Return 400 for validation errors with Problem Details
  - [ ] Return 404 if property not found
  - [ ] Update Swagger documentation
  - [ ] Write integration tests (8+ tests: create success, create validation failure, create property not found, get categories, get expenses by property)

- [ ] Task 7: Generate TypeScript API Client
  - [ ] Run NSwag to generate updated TypeScript client
  - [ ] Verify ExpenseDto, CreateExpenseRequest, ExpenseCategoryDto interfaces generated
  - [ ] Verify expense API methods generated

- [ ] Task 8: Create ExpenseService (AC: 3.1.1, 3.1.4, 3.1.6, 3.1.7)
  - [ ] Create `expense.service.ts` in `features/expenses/services/`
  - [ ] Add `createExpense(request: CreateExpenseRequest): Observable<{ id: string }>`
  - [ ] Add `getExpensesByProperty(propertyId: string, year?: number): Observable<ExpenseListResponse>`
  - [ ] Add `getCategories(): Observable<ExpenseCategoryDto[]>`
  - [ ] Use generated NSwag client

- [ ] Task 9: Create ExpenseStore with Signals (AC: 3.1.6, 3.1.7, 3.1.8)
  - [ ] Create `expense.store.ts` in `features/expenses/stores/`
  - [ ] State signals: `expenses`, `categories`, `isLoading`, `isSaving`, `error`, `currentPropertyId`, `ytdTotal`
  - [ ] Computed: `expensesForCurrentProperty`, `sortedCategories`
  - [ ] rxMethod: `loadCategories()` - load and cache expense categories
  - [ ] rxMethod: `loadExpensesByProperty(propertyId: string)` - load expenses for property
  - [ ] rxMethod: `createExpense(request: CreateExpenseRequest)` - create expense, update local state, show snackbar
  - [ ] On successful create: prepend to expenses list, update ytdTotal
  - [ ] Write unit tests for ExpenseStore

- [ ] Task 10: Create CategorySelectComponent (AC: 3.1.4)
  - [ ] Create `category-select.component.ts` in `features/expenses/components/`
  - [ ] Use `mat-select` with categories from ExpenseStore
  - [ ] Display category name and optionally Schedule E line reference
  - [ ] Emit selected categoryId
  - [ ] Write unit tests

- [ ] Task 11: Create ExpenseFormComponent (AC: 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.8)
  - [ ] Create `expense-form.component.ts` in `features/expenses/components/`
  - [ ] Form fields: Amount (currency), Date (datepicker), Category (select), Description (textarea)
  - [ ] Reactive form with validators matching backend
  - [ ] Default date to today
  - [ ] Submit button disabled until form valid
  - [ ] Loading state during save
  - [ ] Reset form on successful save
  - [ ] Emit createExpense event with form data
  - [ ] Write unit tests for form validation and submission

- [ ] Task 12: Create ExpenseRowComponent (AC: 3.1.7)
  - [ ] Create `expense-row.component.ts` in `features/expenses/components/`
  - [ ] Display: Date, Description, Category (as chip/tag), Amount
  - [ ] Format date as "Nov 28, 2025"
  - [ ] Format amount as currency "$127.50"
  - [ ] Category chip with distinct color per category (optional for this story)
  - [ ] Write unit tests

- [ ] Task 13: Create ExpenseWorkspaceComponent (AC: 3.1.1, 3.1.6, 3.1.7)
  - [ ] Create `expense-workspace.component.ts` in `features/expenses/`
  - [ ] Route: `/properties/:id/expenses`
  - [ ] Layout: Property name header + NEW EXPENSE form at top + Previous Expenses list below + YTD total
  - [ ] Load property details and expenses on init
  - [ ] Load categories on init (cache in store)
  - [ ] Handle form submission via ExpenseStore.createExpense()
  - [ ] Display loading state while saving
  - [ ] Display snackbar on success
  - [ ] Write unit tests

- [ ] Task 14: Add Routing and Navigation (AC: 3.1.1)
  - [ ] Add route `/properties/:id/expenses` to expenses routing module
  - [ ] Add [+ Add] action button to PropertyRowComponent (from Epic 2)
  - [ ] Add [+ Add Expense] button to PropertyDetailComponent (from Epic 2)
  - [ ] Wire navigation to expense workspace

- [ ] Task 15: Update Dashboard Integration (AC: 3.1.7)
  - [ ] Ensure PropertyRowComponent can display expense total (placeholder from Epic 2 now real)
  - [ ] Verify StatsBarComponent can display real expense total (prepare for Story 3.5)

- [ ] Task 16: Run Tests and Validate
  - [ ] Backend unit tests pass (CreateExpenseHandler, Validator, GetExpensesByProperty, GetCategories)
  - [ ] Backend integration tests pass (all expense endpoints)
  - [ ] Frontend component tests pass (ExpenseForm, ExpenseRow, CategorySelect, ExpenseWorkspace)
  - [ ] Frontend builds successfully
  - [ ] Backend builds successfully
  - [ ] Manual smoke test checklist completed

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Domain Layer: `Expense` entity in `Domain/Entities/`
- Application Layer: `CreateExpenseCommand`, `CreateExpenseHandler`, `GetExpensesByPropertyQuery`, `GetExpenseCategoriesQuery` in `Application/Expenses/`
- FluentValidation for request validation
- MediatR for CQRS pattern
- Multi-tenant filtering via `ICurrentUser.AccountId`

**Frontend Architecture:**
- Feature module: `features/expenses/`
- @ngrx/signals store pattern (following PropertyStore from Epic 2)
- Reactive forms with Angular Material components
- Generated API client from NSwag

**UX Patterns (from UX Design Specification):**
- Expense Workspace pattern: Form + history on same page (Section 5.2)
- Property-first navigation: User navigates via property context
- Batch entry pattern: Form clears after save, ready for next entry
- Snackbar at bottom-center, 3-second auto-dismiss
- Forest Green theme, form validation on blur

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Expenses/
    ├── CreateExpense.cs           # Command + Handler
    ├── CreateExpenseValidator.cs  # FluentValidation
    ├── GetExpensesByProperty.cs   # Query + Handler
    ├── GetExpenseCategories.cs    # Query + Handler
    ├── ExpenseDto.cs              # DTOs
    └── ExpenseCategoryDto.cs

backend/src/PropertyManager.Api/Controllers/
    └── ExpensesController.cs

backend/tests/PropertyManager.Application.Tests/Expenses/
    ├── CreateExpenseHandlerTests.cs
    ├── CreateExpenseValidatorTests.cs
    ├── GetExpensesByPropertyHandlerTests.cs
    └── GetExpenseCategoriesHandlerTests.cs
```

**Frontend files to create:**
```
frontend/src/app/features/expenses/
    ├── expenses.routes.ts
    ├── expense-workspace/
    │   ├── expense-workspace.component.ts
    │   └── expense-workspace.component.spec.ts
    ├── components/
    │   ├── expense-form/
    │   │   ├── expense-form.component.ts
    │   │   └── expense-form.component.spec.ts
    │   ├── expense-row/
    │   │   ├── expense-row.component.ts
    │   │   └── expense-row.component.spec.ts
    │   └── category-select/
    │       ├── category-select.component.ts
    │       └── category-select.component.spec.ts
    ├── services/
    │   └── expense.service.ts
    └── stores/
        ├── expense.store.ts
        └── expense.store.spec.ts
```

**Frontend files to modify:**
```
frontend/src/app/features/properties/components/property-row/property-row.component.ts  # Add [+] button
frontend/src/app/features/properties/property-detail/property-detail.component.ts       # Add [+ Add Expense] button
frontend/src/app/app.routes.ts  # Add expense routes
```

### Learnings from Previous Story

**From Epic 2 Retrospective (Status: completed)**

- **@ngrx/signals PropertyStore pattern established**: Follow same pattern for ExpenseStore with signals (`expenses`, `isLoading`, `error`) and rxMethods (`loadExpenses`, `createExpense`)

- **Test coverage discipline**: Epic 2 tripled test coverage (89→291). Continue this pattern for Epic 3.

- **E2E testing in CI/CD**: Playwright tests running on every PR. Consider adding E2E test for expense creation flow.

- **Clean Architecture maintained**: Consistent patterns across all stories - continue same patterns.

**From Story 2-5-delete-property (Status: done)**

- **NotFoundException Pattern**: `NotFoundException.cs` exists at `Domain/Exceptions/NotFoundException.cs` - reuse for 404 handling when property not found

- **PropertyStore Pattern**: Has rxMethod pattern established - follow same pattern for ExpenseStore

- **Soft delete preserved financial records**: Property deletion does NOT cascade to expenses - expenses remain for tax reporting. This confirms expense data is protected.

**Technical Debt to Note (from Epic 2 Retro):**
- Missing frontend tests for some Epic 2 components (tracked in GitHub issues)
- Bundle size at 522KB vs 500KB budget (pre-existing debt)

[Source: docs/sprint-artifacts/epic-2-retro-2025-12-04.md]
[Source: docs/sprint-artifacts/2-5-delete-property.md]

### Data Model Reference

**Expense Entity (from Epic 1):**
```csharp
public class Expense
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid PropertyId { get; private set; }
    public Guid CategoryId { get; private set; }
    public decimal Amount { get; private set; }
    public DateOnly Date { get; private set; }
    public string? Description { get; private set; }
    public Guid? ReceiptId { get; private set; }  // Epic 5
    public Guid CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }
}
```

**ExpenseCategory (seeded in Epic 1):**
- 15 IRS Schedule E categories pre-populated
- Id, Name, ScheduleELine, SortOrder

**Create Expense Flow:**
```
POST /api/v1/expenses
{
  "propertyId": "guid",
  "amount": 127.50,
  "date": "2025-12-04",
  "categoryId": "guid",
  "description": "Home Depot - Faucet repair"
}

Response: 201 Created
{
  "id": "new-expense-guid"
}
Location: /api/v1/expenses/{id}
```

### Testing Strategy

**Unit Tests (xUnit):**
- `CreateExpenseHandlerTests`:
  - Handle_ValidExpense_CreatesAndReturnsId
  - Handle_NegativeAmount_ThrowsValidationException
  - Handle_ZeroAmount_ThrowsValidationException
  - Handle_FutureDate_ThrowsValidationException
  - Handle_InvalidPropertyId_ThrowsNotFoundException
  - Handle_InvalidCategoryId_ThrowsValidationException
  - Handle_DescriptionTooLong_ThrowsValidationException

- `CreateExpenseValidatorTests`:
  - 8+ tests covering all validation rules

- `GetExpensesByPropertyHandlerTests`:
  - Handle_ValidProperty_ReturnsExpenses
  - Handle_NoExpenses_ReturnsEmptyList
  - Handle_OtherAccountProperty_ThrowsNotFoundException

**Integration Tests (xUnit):**
- `ExpensesControllerTests`:
  - Create_ValidExpense_Returns201
  - Create_ValidationFailure_Returns400
  - Create_PropertyNotFound_Returns404
  - Create_Unauthorized_Returns401
  - GetCategories_ReturnsAllCategories
  - GetByProperty_ReturnsExpenses
  - GetByProperty_PropertyNotFound_Returns404

**Component Tests (Vitest):**
- `ExpenseFormComponent`: Form validation, submission, reset
- `ExpenseRowComponent`: Display formatting
- `CategorySelectComponent`: Category list, selection
- `ExpenseWorkspaceComponent`: Integration of form + list

**Manual Verification Checklist:**
```markdown
## Smoke Test: Create Expense

### API Verification
- [ ] GET /api/v1/expense-categories returns 15 categories
- [ ] POST /api/v1/expenses with valid data returns 201
- [ ] POST /api/v1/expenses with invalid amount returns 400
- [ ] POST /api/v1/expenses with future date returns 400
- [ ] GET /api/v1/properties/{id}/expenses returns expense list

### Database Verification
- [ ] Expense record created with correct AccountId
- [ ] Expense record has PropertyId, CategoryId set correctly
- [ ] CreatedAt, UpdatedAt timestamps populated
- [ ] CreatedByUserId set to current user

### Frontend Verification
- [ ] Navigate to property row [+] button goes to expense workspace
- [ ] Form displays property name in header
- [ ] Category dropdown shows all 15 categories
- [ ] Date defaults to today
- [ ] Amount validation shows error for $0 or negative
- [ ] Date validation shows error for future dates
- [ ] Save button disabled until form valid
- [ ] Successful save shows snackbar "Expense saved ✓"
- [ ] New expense appears at top of list immediately
- [ ] Form clears after successful save
- [ ] YTD total updates after save
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#AC-3.1: Create Expense] - Acceptance Criteria AC-3.1.1 through AC-3.1.8
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Workflows - Create Expense Flow] - Create workflow sequence
- [Source: docs/epics.md#Story 3.1: Expense Workspace - Create Expense] - Epic-level story definition
- [Source: docs/architecture.md#Data Architecture] - Expense entity schema
- [Source: docs/architecture.md#API Contracts] - REST endpoint patterns
- [Source: docs/ux-design-specification.md#5.2 Journey: Add Expense] - Expense Workspace UX pattern
- [Source: docs/ux-design-specification.md#7.4 Form Patterns] - Form validation patterns
- [Source: docs/prd.md#FR12-FR19] - Functional requirements for expense management

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/3-1-expense-workspace-create-expense.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-04 | Initial story draft created | SM Agent (Create Story Workflow) |
