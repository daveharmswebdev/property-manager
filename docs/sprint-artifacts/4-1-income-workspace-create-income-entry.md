# Story 4.1: Income Workspace - Create Income Entry

Status: ready-for-dev

## Story

As a property owner,
I want to record rental income for a property,
so that I can track what each property earns.

## Acceptance Criteria

1. **AC-4.1.1**: Navigate to income workspace from property detail
   - [+ Add Income] button appears on property detail page
   - Clicking navigates to `/properties/:id/income`
   - Route is protected by auth guard
   - 404 for non-existent or other-account properties

2. **AC-4.1.2**: Income workspace displays form and income list
   - Property name shown in header (context)
   - NEW INCOME form at top with fields:
     - Amount (required, currency input, mat-form-field)
     - Date (required, mat-datepicker, defaults to today)
     - Source (optional, text input, e.g., "John Smith - Rent")
     - Description (optional, text input)
   - "Previous Income" list below the form
   - YTD income total for this property displayed
   - List sorted by date descending (newest first)

3. **AC-4.1.3**: Valid form submission creates income entry
   - Submitting valid form calls `POST /api/v1/income`
   - Request body: `{ propertyId, amount, date, source, description }`
   - Success returns 201 with `{ id: "guid" }`
   - Snackbar: "Income recorded ✓"
   - Form clears, ready for next entry
   - New income appears at top of list immediately (optimistic update)

4. **AC-4.1.4**: YTD income total updates after save
   - Total reflects sum of all income for selected tax year
   - Updates immediately after successful save
   - Uses existing year selector from app state (Epic 3)

5. **AC-4.1.5**: Amount validation enforced
   - Amount must be > $0
   - Validation error shown: "Amount must be greater than $0"
   - Form does not submit with invalid amount
   - Negative, zero, and non-numeric values rejected
   - Validation on blur and on submit

6. **AC-4.1.6**: Income list displays correctly
   - Each income row shows: Date, Amount, Source (if present), Description (if present)
   - Amount formatted as currency ($1,500.00)
   - Date formatted as locale date (Jan 15, 2025)
   - Empty source/description fields not displayed (no empty text)
   - Hover reveals edit/delete icons (prepared for Story 4.2)

## Tasks / Subtasks

- [ ] Task 1: Create Income Entity and EF Core Configuration (AC: 4.1.3)
  - [ ] Create `Income.cs` entity in `PropertyManager.Domain/Entities/`
  - [ ] Add `DbSet<Income>` to `AppDbContext`
  - [ ] Create `IncomeConfiguration.cs` in `Infrastructure/Persistence/Configurations/`
  - [ ] Configure indexes: (AccountId), (PropertyId), (PropertyId, Date)
  - [ ] Add soft delete global query filter (DeletedAt == null)
  - [ ] Add navigation properties to Property entity
  - [ ] Create and apply EF Core migration

- [ ] Task 2: Create Income DTOs and Mapping (AC: 4.1.3, 4.1.6)
  - [ ] Create `IncomeDto.cs` in `Application/Income/`
  - [ ] Record: Id, PropertyId, PropertyName, Amount, Date, Source, Description, CreatedAt
  - [ ] Create mapping extension or AutoMapper profile

- [ ] Task 3: Create CreateIncome Command and Handler (AC: 4.1.3, 4.1.5)
  - [ ] Create `CreateIncome.cs` in `Application/Income/`
  - [ ] `CreateIncomeCommand(Guid PropertyId, decimal Amount, DateOnly Date, string? Source, string? Description)` : `IRequest<Guid>`
  - [ ] `CreateIncomeValidator` with FluentValidation:
    - PropertyId required and must exist
    - Amount > 0
    - Date required
  - [ ] Handler creates entity with AccountId from CurrentUser
  - [ ] Set CreatedByUserId, CreatedAt, UpdatedAt
  - [ ] Return new Income.Id

- [ ] Task 4: Create GetIncomeByProperty Query and Handler (AC: 4.1.2, 4.1.6)
  - [ ] Create `GetIncomeByProperty.cs` in `Application/Income/`
  - [ ] `GetIncomeByPropertyQuery(Guid PropertyId, int? Year)` : `IRequest<List<IncomeDto>>`
  - [ ] Handler queries Income where PropertyId matches
  - [ ] Filter by year if provided (Date.Year == Year)
  - [ ] Order by Date descending
  - [ ] Include PropertyName in DTO
  - [ ] Use AsNoTracking() for performance

- [ ] Task 5: Create GetIncomeTotalByProperty Query (AC: 4.1.4)
  - [ ] Create `GetIncomeTotalByProperty.cs` in `Application/Income/`
  - [ ] `GetIncomeTotalByPropertyQuery(Guid PropertyId, int Year)` : `IRequest<decimal>`
  - [ ] Handler sums Amount where PropertyId and Date.Year match
  - [ ] Returns 0 if no income entries

- [ ] Task 6: Create IncomeController with Endpoints (AC: 4.1.1, 4.1.3)
  - [ ] Create `IncomeController.cs` in `PropertyManager.Api/Controllers/`
  - [ ] `[ApiController]`, `[Route("api/v1/[controller]")]`, `[Authorize]`
  - [ ] `POST /api/v1/income` - Create income entry
    - Returns 201 Created with `{ id }` and Location header
  - [ ] `GET /api/v1/properties/{id}/income` - Get income for property (add to PropertiesController)
    - Query param: `year`
    - Returns `{ items, totalCount }`
  - [ ] Update Swagger documentation

- [ ] Task 7: Generate TypeScript API Client
  - [ ] Run NSwag to regenerate API client
  - [ ] Verify `income_Create` method generated
  - [ ] Verify `CreateIncomeRequest` and `IncomeDto` types generated

- [ ] Task 8: Create IncomeService in Frontend (AC: 4.1.3, 4.1.4)
  - [ ] Create `income.service.ts` in `features/income/services/`
  - [ ] Inject generated API client
  - [ ] `createIncome(request: CreateIncomeRequest): Observable<{ id: string }>`
  - [ ] `getIncomeByProperty(propertyId: string, year?: number): Observable<IncomeDto[]>`
  - [ ] `getIncomeTotalByProperty(propertyId: string, year: number): Observable<number>`

- [ ] Task 9: Create IncomeStore with @ngrx/signals (AC: 4.1.2, 4.1.4, 4.1.6)
  - [ ] Create `income.store.ts` in `features/income/stores/`
  - [ ] Signal-based store pattern (follow expense.store.ts)
  - [ ] State: income entries, loading, error, total
  - [ ] Actions: loadIncomeByProperty, createIncome
  - [ ] Optimistic updates for create

- [ ] Task 10: Create IncomeFormComponent (AC: 4.1.2, 4.1.3, 4.1.5)
  - [ ] Create `income-form/` directory in `features/income/components/`
  - [ ] Create `income-form.component.ts`
  - [ ] Form fields: amount (matInput type="number"), date (mat-datepicker), source (matInput), description (matInput)
  - [ ] Default date to today
  - [ ] Reactive form with FormGroup
  - [ ] Validation: amount required and > 0
  - [ ] Error messages below fields on blur
  - [ ] Submit button: [Save]
  - [ ] Clear form after successful save
  - [ ] Loading state during save

- [ ] Task 11: Create IncomeRowComponent (AC: 4.1.6)
  - [ ] Create `income-row/` directory in `features/income/components/`
  - [ ] Create `income-row.component.ts`
  - [ ] Display: Date | Amount | Source | Description
  - [ ] Date formatted (locale, e.g., "Jan 15, 2025")
  - [ ] Amount formatted as currency ($1,500.00)
  - [ ] Hide source/description if empty
  - [ ] Hover reveals edit/delete icons (disabled, for 4.2)

- [ ] Task 12: Create IncomeWorkspaceComponent (AC: 4.1.1, 4.1.2, 4.1.4)
  - [ ] Create `income-workspace/` directory in `features/income/`
  - [ ] Create `income-workspace.component.ts`
  - [ ] Route: `/properties/:id/income`
  - [ ] Load property info for header
  - [ ] Load income list on init
  - [ ] Display YTD income total
  - [ ] Compose: IncomeFormComponent + IncomeRowComponent list
  - [ ] Handle form submit event → create income → refresh list

- [ ] Task 13: Add [+ Add Income] Button to Property Detail (AC: 4.1.1)
  - [ ] Modify `property-detail.component.ts`
  - [ ] Add [+ Add Income] button next to [+ Add Expense]
  - [ ] Route to `/properties/:id/income` on click
  - [ ] Use mat-button with icon

- [ ] Task 14: Configure Routing for Income Workspace (AC: 4.1.1)
  - [ ] Create `income.routes.ts` in `features/income/`
  - [ ] Route: `{ path: 'properties/:id/income', component: IncomeWorkspaceComponent }`
  - [ ] Apply auth guard
  - [ ] Add to app.routes.ts

- [ ] Task 15: Write Backend Unit Tests
  - [ ] `CreateIncomeHandlerTests.cs`:
    - [ ] Handle_ValidCommand_CreatesIncomeAndReturnsId
    - [ ] Handle_AmountZero_ThrowsValidationException
    - [ ] Handle_AmountNegative_ThrowsValidationException
    - [ ] Handle_PropertyNotFound_ThrowsNotFoundException
    - [ ] Handle_SetsAuditFields_Correctly
  - [ ] `GetIncomeByPropertyHandlerTests.cs`:
    - [ ] Handle_ReturnsIncomeForProperty
    - [ ] Handle_FiltersbyYear
    - [ ] Handle_OrdersByDateDescending
    - [ ] Handle_EmptyProperty_ReturnsEmptyList
  - [ ] `GetIncomeTotalByPropertyHandlerTests.cs`:
    - [ ] Handle_ReturnsSumOfAmounts
    - [ ] Handle_NoIncome_ReturnsZero
    - [ ] Handle_FiltersbyYear

- [ ] Task 16: Write Backend Integration Tests
  - [ ] `IncomeControllerTests.cs`:
    - [ ] Create_ValidRequest_Returns201WithId
    - [ ] Create_InvalidAmount_Returns400
    - [ ] Create_UnauthorizedUser_Returns401
    - [ ] Create_PropertyNotFound_Returns404
    - [ ] GetByProperty_ReturnsIncomeList
    - [ ] GetByProperty_FiltersbyYear
    - [ ] GetByProperty_OtherUserProperty_Returns404

- [ ] Task 17: Write Frontend Component Tests
  - [ ] `income-form.component.spec.ts`:
    - [ ] Should render all form fields
    - [ ] Should default date to today
    - [ ] Should show validation error for invalid amount
    - [ ] Should emit submit event with form data
    - [ ] Should clear form after save
  - [ ] `income-row.component.spec.ts`:
    - [ ] Should display income data correctly
    - [ ] Should format date and amount
    - [ ] Should hide empty source/description
  - [ ] `income-workspace.component.spec.ts`:
    - [ ] Should load and display income list
    - [ ] Should show YTD total
    - [ ] Should add new income to list on create

- [ ] Task 18: Manual Verification
  - [ ] All backend tests pass
  - [ ] All frontend tests pass
  - [ ] Frontend builds successfully
  - [ ] Run smoke test checklist

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Domain Layer: `Income.cs` entity in `Entities/`
- Application Layer: Commands/Queries in `Income/` folder following CQRS pattern
- Infrastructure Layer: EF Core configuration and DbContext
- API Layer: `IncomeController` with RESTful endpoints

**MediatR CQRS Pattern:**
```csharp
// Command example
public record CreateIncomeCommand(
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    string? Source,
    string? Description
) : IRequest<Guid>;
```

**Global Exception Handler:**
- Controllers do NOT need try-catch blocks (per architecture.md)
- NotFoundException → 404
- ValidationException → 400
- No explicit error handling in controller methods

**Multi-Tenant Isolation:**
- `AccountId` set from `ICurrentUser.AccountId` in handler
- EF Core global query filter ensures tenant isolation
- Integration tests verify cross-account isolation

**API Contract:**
```
POST /api/v1/income
{
  "propertyId": "abc-123",
  "amount": 1500.00,
  "date": "2025-01-01",
  "source": "John Smith - Rent",
  "description": "January rent payment"
}

Response: 201 Created
{ "id": "def-456" }
Location: /api/v1/income/def-456
```

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Domain/Entities/
    └── Income.cs
backend/src/PropertyManager.Application/Income/
    ├── CreateIncome.cs
    ├── GetIncomeByProperty.cs
    ├── GetIncomeTotalByProperty.cs
    └── IncomeDto.cs
backend/src/PropertyManager.Infrastructure/Persistence/Configurations/
    └── IncomeConfiguration.cs
backend/src/PropertyManager.Api/Controllers/
    └── IncomeController.cs
backend/tests/PropertyManager.Application.Tests/Income/
    ├── CreateIncomeHandlerTests.cs
    ├── GetIncomeByPropertyHandlerTests.cs
    └── GetIncomeTotalByPropertyHandlerTests.cs
backend/tests/PropertyManager.Api.Tests/
    └── IncomeControllerTests.cs
```

**Frontend files to create:**
```
frontend/src/app/features/income/
    ├── income.routes.ts
    ├── income-workspace/
    │   ├── income-workspace.component.ts
    │   └── income-workspace.component.spec.ts
    ├── components/
    │   ├── income-form/
    │   │   ├── income-form.component.ts
    │   │   └── income-form.component.spec.ts
    │   └── income-row/
    │       ├── income-row.component.ts
    │       └── income-row.component.spec.ts
    ├── services/
    │   └── income.service.ts
    └── stores/
        └── income.store.ts
```

**Frontend files to modify:**
```
frontend/src/app/features/properties/property-detail/property-detail.component.ts  # Add [+ Add Income] button
frontend/src/app/app.routes.ts  # Add income routes
frontend/src/app/core/api/api.service.ts  # NSwag regenerated
```

### Learnings from Previous Story

**From Story 3-6-duplicate-expense-prevention (Status: done)**

- **CQRS Pattern**: Follow `CheckDuplicateExpense.cs` structure for Query + Handler + DTO
- **Dialog Components**: Use `MatDialog.open()` with `MAT_DIALOG_DATA` injection
- **Testing Coverage**: 256 backend tests, 310 frontend tests pass - maintain this level
- **GlobalExceptionHandler**: No try-catch in controllers - return proper status codes
- **NSwag Regeneration**: Run after adding new endpoints

**Key files from 3-6 to reference:**
- `backend/src/PropertyManager.Application/Expenses/CheckDuplicateExpense.cs` - Query/handler pattern
- `frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts` - Form submission pattern
- `frontend/src/app/features/expenses/services/expense.service.ts` - Service pattern

**Patterns to REUSE (not recreate):**
- `YearSelectorService` for tax year filtering
- Snackbar pattern for success messages
- Form validation patterns (on blur, on submit)
- Row component with hover actions

[Source: docs/sprint-artifacts/3-6-duplicate-expense-prevention.md#Dev-Agent-Record]

### Testing Strategy

**Unit Tests (xUnit):**
- `CreateIncomeHandlerTests`: 5 test cases
- `GetIncomeByPropertyHandlerTests`: 4 test cases
- `GetIncomeTotalByPropertyHandlerTests`: 3 test cases

**Integration Tests (xUnit):**
- `IncomeControllerTests`: 7 test cases

**Component Tests (Vitest):**
- `income-form.component.spec.ts`: 5 test cases
- `income-row.component.spec.ts`: 3 test cases
- `income-workspace.component.spec.ts`: 3 test cases

**Manual Verification Checklist:**
```markdown
## Smoke Test: Income Workspace - Create Income Entry

### API Verification
- [ ] POST /api/v1/income returns 201 with id
- [ ] POST /api/v1/income with invalid amount returns 400
- [ ] GET /api/v1/properties/{id}/income returns income list
- [ ] Unauthorized request returns 401

### Database Verification
- [ ] Income row created with correct AccountId
- [ ] CreatedByUserId set correctly
- [ ] CreatedAt and UpdatedAt populated
- [ ] PropertyId foreign key valid

### Frontend Verification
- [ ] [+ Add Income] button navigates to workspace
- [ ] Form defaults date to today
- [ ] Amount validation shows error message
- [ ] Save creates income and shows snackbar
- [ ] Income appears in list after save
- [ ] YTD total updates after save
- [ ] Form clears after successful save
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#AC-4.1] - Acceptance criteria 1-6
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Services and Modules] - Module responsibilities
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data Models and Contracts] - Income entity and DTO definitions
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#APIs and Interfaces] - API contract specification
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows and Sequencing] - Create Income Flow
- [Source: docs/epics.md#Story 4.1: Income Workspace - Create Income Entry] - Epic-level story definition
- [Source: docs/architecture.md#Backend Structure] - Clean Architecture layers
- [Source: docs/architecture.md#Frontend Structure] - Feature-based organization
- [Source: docs/architecture.md#Error Handling Pattern] - Global Exception Handler
- [Source: docs/prd.md#FR23-FR25] - Income entry requirements
- [Source: docs/prd.md#FR28] - View income for property
- [Source: docs/prd.md#FR46] - Property detail recent income

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/4-1-income-workspace-create-income-entry.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-13 | Initial story draft created | SM Agent (Create Story Workflow) |
