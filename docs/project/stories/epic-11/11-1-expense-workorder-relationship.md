# Story 11.1: Expense-WorkOrder Relationship

Status: done

## Story

As a **developer**,
I want **the Expense entity to have an optional foreign key to WorkOrder**,
So that **expenses can be linked to work orders, enabling the full Work Order-Expense Integration epic**.

## Acceptance Criteria

### AC #1: Database Migration - Add WorkOrderId Column

**Given** the database migration runs
**When** I check the Expenses table schema
**Then** a new column exists:
- `WorkOrderId` (UUID, FK to WorkOrders, nullable)
- Foreign key constraint with `ON DELETE SET NULL` behavior
- Index `IX_Expenses_AccountId_WorkOrderId` for efficient filtering

### AC #2: Domain Entity - Expense Has WorkOrder Navigation

**Given** the Expense domain entity is updated
**When** I inspect the entity class
**Then**:
- `WorkOrderId` property exists (type `Guid?`, nullable)
- `WorkOrder` navigation property exists (type `WorkOrder?`)
- No other entity changes required

### AC #3: Domain Entity - WorkOrder Has Expenses Collection

**Given** the WorkOrder domain entity is updated
**When** I inspect the entity class
**Then**:
- `Expenses` navigation collection exists (type `ICollection<Expense>`)
- Initialized as empty collection `= []`

### AC #4: EF Core Configuration - Relationship

**Given** the EF Core configuration is updated
**When** I inspect the Expense entity configuration
**Then**:
- One-to-many relationship configured (WorkOrder has many Expenses)
- FK on Expense (`WorkOrderId`) pointing to WorkOrder
- Delete behavior is `SetNull` (work order deleted = expense keeps, FK nulled)

### AC #5: API Response - Expense Includes WorkOrderId

**Given** an expense has a WorkOrderId set
**When** I call `GET /api/v1/expenses/{id}`
**Then** the response includes `workOrderId` field (UUID or null)

**Given** an expense has no work order linked
**When** I retrieve the expense
**Then** `workOrderId` is null in the response

### AC #6: API Response - Work Order Expenses Endpoint

**Given** a work order has linked expenses
**When** I call `GET /api/v1/work-orders/{id}/expenses`
**Then** I receive a list response: `{ items: [...], totalCount: n }`
- Each item includes: id, date, description, category, amount
- Items filtered by AccountId (tenant isolation) and DeletedAt == null (soft delete)

**Given** a work order has no linked expenses
**When** I call `GET /api/v1/work-orders/{id}/expenses`
**Then** I receive `{ items: [], totalCount: 0 }`

### AC #7: Property Isolation Constraint

**Given** I attempt to set an expense's WorkOrderId
**When** the work order belongs to a different property than the expense
**Then** a validation error is returned (400 Bad Request)
- Message: "Expense and work order must belong to the same property"

### AC #8: Existing Expense Backward Compatibility

**Given** the migration runs on existing data
**When** I query existing expenses
**Then** all existing expenses have `WorkOrderId = NULL` (no data loss)

### AC #9: Update Expense - Set/Clear WorkOrderId

**Given** I call `PUT /api/v1/expenses/{id}` with a `workOrderId` field
**When** the work order exists, belongs to the same property, and same account
**Then** the expense's WorkOrderId is updated

**Given** I call `PUT /api/v1/expenses/{id}` with `workOrderId: null`
**When** the expense was previously linked
**Then** the WorkOrderId is set to null (unlinked)

## Tasks / Subtasks

### Task 1: Update Domain Entities (AC: #2, #3)

- [x] 1.1 Add `WorkOrderId` and `WorkOrder` navigation to `Expense.cs`:
  ```csharp
  // In backend/src/PropertyManager.Domain/Entities/Expense.cs
  public Guid? WorkOrderId { get; set; }
  public WorkOrder? WorkOrder { get; set; }
  ```

- [x] 1.2 Add `Expenses` navigation collection to `WorkOrder.cs`:
  ```csharp
  // In backend/src/PropertyManager.Domain/Entities/WorkOrder.cs
  public ICollection<Expense> Expenses { get; set; } = [];
  ```

### Task 2: Update EF Core Configuration (AC: #4)

- [x] 2.1 Add relationship configuration in `ExpenseConfiguration.cs`:
  ```csharp
  // After the existing Receipt relationship (around line 71-74)
  builder.HasOne(e => e.WorkOrder)
      .WithMany(w => w.Expenses)
      .HasForeignKey(e => e.WorkOrderId)
      .OnDelete(DeleteBehavior.SetNull);
  ```

- [x] 2.2 Add composite index for WorkOrderId queries:
  ```csharp
  builder.HasIndex(e => new { e.AccountId, e.WorkOrderId })
      .HasDatabaseName("IX_Expenses_AccountId_WorkOrderId");
  ```

### Task 3: Create EF Core Migration (AC: #1, #8)

- [x] 3.1 Generate migration:
  ```bash
  dotnet ef migrations add AddWorkOrderIdToExpense \
    --project src/PropertyManager.Infrastructure \
    --startup-project src/PropertyManager.Api
  ```

- [x] 3.2 Verify generated migration:
  - Adds nullable `WorkOrderId` UUID column to Expenses
  - Creates FK constraint with SetNull delete behavior
  - Creates index `IX_Expenses_AccountId_WorkOrderId`
  - No data loss for existing records (all NULL)

- [x] 3.3 Apply migration locally and verify:
  ```bash
  dotnet ef database update \
    --project src/PropertyManager.Infrastructure \
    --startup-project src/PropertyManager.Api
  ```

### Task 4: Update Expense DTOs and Mappings (AC: #5)

- [x] 4.1 Add `WorkOrderId` to `ExpenseDto` (or equivalent response record):
  ```csharp
  public Guid? WorkOrderId { get; init; }
  ```

- [x] 4.2 Update query handlers that return expenses to include `WorkOrderId` in mapping
  - `GetExpenseByIdHandler` - include WorkOrderId
  - `GetExpensesByPropertyHandler` (or equivalent list handler) - include WorkOrderId

### Task 5: Update Expense Commands (AC: #9, #7)

- [x] 5.1 Add `WorkOrderId` to `CreateExpenseCommand`:
  ```csharp
  public Guid? WorkOrderId { get; init; }
  ```

- [x] 5.2 Add `WorkOrderId` to `UpdateExpenseCommand`:
  ```csharp
  public Guid? WorkOrderId { get; init; }
  ```

- [x] 5.3 Add property isolation validation in command handlers:
  ```csharp
  // When WorkOrderId is provided, validate same property
  if (request.WorkOrderId.HasValue)
  {
      var workOrder = await _context.WorkOrders
          .FirstOrDefaultAsync(w => w.Id == request.WorkOrderId.Value
              && w.AccountId == _currentUser.AccountId
              && w.DeletedAt == null, ct);

      if (workOrder == null)
          throw new NotFoundException("WorkOrder", request.WorkOrderId.Value);

      if (workOrder.PropertyId != request.PropertyId)
          throw new BusinessRuleException("Expense and work order must belong to the same property");
  }
  ```

- [x] 5.4 Add FluentValidation rule for WorkOrderId (optional GUID format):
  ```csharp
  RuleFor(x => x.WorkOrderId)
      .Must(id => id == null || id != Guid.Empty)
      .WithMessage("WorkOrderId must be a valid GUID or null");
  ```

### Task 6: Create Work Order Expenses Query (AC: #6)

- [x] 6.1 Create `GetWorkOrderExpensesQuery`:
  ```csharp
  // In Application/WorkOrders/Queries/
  public record GetWorkOrderExpensesQuery(Guid WorkOrderId) : IRequest<WorkOrderExpensesResponse>;

  public record WorkOrderExpensesResponse(
      List<WorkOrderExpenseItemDto> Items,
      int TotalCount);

  public record WorkOrderExpenseItemDto(
      Guid Id,
      DateOnly Date,
      string? Description,
      string CategoryName,
      decimal Amount);
  ```

- [x] 6.2 Create `GetWorkOrderExpensesHandler`:
  ```csharp
  // Verify work order exists and belongs to current account
  // Query expenses WHERE WorkOrderId == request.WorkOrderId
  //   AND AccountId == _currentUser.AccountId
  //   AND DeletedAt == null
  // Map to DTOs
  ```

- [x] 6.3 Create `GetWorkOrderExpensesValidator`:
  ```csharp
  RuleFor(x => x.WorkOrderId).NotEmpty();
  ```

### Task 7: Add API Endpoint (AC: #6)

- [x] 7.1 Add endpoint to `WorkOrdersController`:
  ```csharp
  [HttpGet("{id:guid}/expenses")]
  [ProducesResponseType(typeof(WorkOrderExpensesResponse), StatusCodes.Status200OK)]
  public async Task<IActionResult> GetWorkOrderExpenses(Guid id)
  {
      var result = await _mediator.Send(new GetWorkOrderExpensesQuery(id));
      return Ok(result);
  }
  ```

### Task 8: Backend Unit Tests (AC: ALL)

- [x] 8.1 Test `CreateExpenseHandler` with WorkOrderId:
  - `Handle_ValidExpenseWithWorkOrder_ReturnsId`
  - `Handle_WorkOrderDifferentProperty_ThrowsBusinessRuleException`
  - `Handle_WorkOrderNotFound_ThrowsNotFoundException`
  - `Handle_NullWorkOrderId_ReturnsId` (backward compat)

- [x] 8.2 Test `UpdateExpenseHandler` with WorkOrderId:
  - `Handle_SetWorkOrderId_UpdatesExpense`
  - `Handle_ClearWorkOrderId_SetsNull`
  - `Handle_CrossPropertyWorkOrder_ThrowsBusinessRuleException`

- [x] 8.3 Test `GetWorkOrderExpensesHandler`:
  - `Handle_WorkOrderWithExpenses_ReturnsListWithCount`
  - `Handle_WorkOrderNoExpenses_ReturnsEmptyList`
  - `Handle_WorkOrderNotFound_ThrowsNotFoundException`
  - `Handle_RespectsAccountIsolation`
  - `Handle_ExcludesSoftDeletedExpenses`

- [x] 8.4 Test ON DELETE SET NULL behavior (verified via integration test - soft delete preserves expense):
  - `DeleteWorkOrder_LinkedExpenses_WorkOrderIdSetToNull`

### Task 9: Integration Tests (AC: ALL)

- [x] 9.1 Test full flow:
  - Create work order, create expense with WorkOrderId, verify linkage
  - Get work order expenses endpoint returns correct list
  - Update expense to clear WorkOrderId, verify unlink
  - Delete work order, verify expense remains with null WorkOrderId

- [x] 9.2 Test tenant isolation:
  - Account A cannot link expenses to Account B's work orders

### Task 10: Frontend - Regenerate API Client

- [x] 10.1 After backend is deployed/running, regenerate TypeScript API client:
  ```bash
  cd frontend && npm run generate-api
  ```

- [x] 10.2 Verify `workOrderId` field appears in expense DTOs in generated client

## Dev Notes

### Architecture Pattern: FK on Expense (1:N)

This follows the established pattern in the codebase:
- **Receipt-Expense** (1:1 optional): `ReceiptId` on Expense, `OnDelete(SetNull)`
- **Vendor-WorkOrder** (1:N optional): `VendorId` on WorkOrder, `OnDelete(SetNull)`
- **New: WorkOrder-Expense** (1:N optional): `WorkOrderId` on Expense, `OnDelete(SetNull)`

The FK lives on Expense because one work order can have many expenses, but an expense can only have one work order.

### Existing Code to Modify

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Domain/Entities/Expense.cs` | Add `WorkOrderId`, `WorkOrder` nav |
| `backend/src/PropertyManager.Domain/Entities/WorkOrder.cs` | Add `Expenses` collection nav |
| `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ExpenseConfiguration.cs` | Add FK config + index |
| `backend/src/PropertyManager.Application/Expenses/Commands/Create*.cs` | Add `WorkOrderId` to command |
| `backend/src/PropertyManager.Application/Expenses/Commands/Update*.cs` | Add `WorkOrderId` to command |
| `backend/src/PropertyManager.Application/Expenses/Queries/Get*.cs` | Include `WorkOrderId` in response |

### New Files to Create

| File | Purpose |
|------|---------|
| `Application/WorkOrders/Queries/GetWorkOrderExpenses.cs` | Query + Handler + DTO |
| `Application/WorkOrders/Queries/GetWorkOrderExpensesValidator.cs` | FluentValidation |
| Migration file (auto-generated) | AddWorkOrderIdToExpense |

### Critical Guardrails

1. **Multi-tenant isolation**: ALL queries MUST filter by `AccountId`. Pattern: `.Where(x => x.AccountId == _currentUser.AccountId && x.DeletedAt == null)`
2. **Soft delete**: NEVER physically delete. All reads filter `DeletedAt == null`.
3. **No try-catch in controllers**: Global middleware handles exceptions.
4. **Property isolation**: Expenses can ONLY link to work orders on the same property. Validate in handlers.
5. **Backward compatibility**: All existing expenses get `WorkOrderId = NULL`. Zero data loss.
6. **API client regen**: Run `npm run generate-api` in frontend after backend API changes.

### Previous Epic Intelligence

From Epic 10 (Work Order Context):
- All 2130 frontend tests passing, all 1352 backend tests passing as of last story
- Pattern for outputs/emitters in shared components works well
- Property photos and work order photos share `PhotoLightboxComponent`
- `WorkOrderPhotoStore` pattern with `signalStore()` established

From Epic 9 (Work Order Tracking):
- `WorkOrder` entity uses `WorkOrderStatus` enum stored as VARCHAR(50)
- `WorkOrdersController` exists with full CRUD
- Work order detail page exists at route `/work-orders/:id`
- `VendorId` nullable FK pattern (null = DIY) is the precedent for optional FK with SetNull

### Git Intelligence

Recent work:
- Angular 21, NgRx Signals 21, Vitest 4 upgrade completed
- MediatR upgraded to 14.0.0
- FluentValidation upgraded to 12.1.1
- 51 code scanning alerts addressed (security fix)
- All dependency bumps merged to main

### Testing Standards

**Backend (xUnit + FluentAssertions):**
- Naming: `{Method}_{Scenario}_{Expected}`
- Integration tests use `IClassFixture<PropertyManagerWebApplicationFactory>`
- Unique test users: `$"email-{Guid.NewGuid():N}@example.com"`
- Verify soft deletes by checking `DeletedAt` timestamp

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest` - orphaned workers)
- Co-located `.spec.ts` files
- No frontend component changes in this story (foundation only)

### Project Structure Notes

- Follows Clean Architecture: Domain -> Application -> Infrastructure -> Api
- Dependencies point inward only
- Commands/Queries co-located with handlers in Application layer feature folders
- Validators co-located with Commands in same namespace
- EF Core configurations in `Infrastructure/Persistence/Configurations/`

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.1] - Expense-WorkOrder Relationship requirements
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: Expense.cs] - Current Expense entity (no WorkOrderId yet)
- [Source: WorkOrder.cs] - Current WorkOrder entity (no Expenses collection yet)
- [Source: ExpenseConfiguration.cs] - Current EF Core config for Expense
- [Source: WorkOrderConfiguration.cs] - Current EF Core config for WorkOrder
- [Source: project-context.md] - Full project rules and patterns

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR36 | A work order can have zero or many linked expenses | 1:N relationship via WorkOrderId FK on Expense |
| FR37 | An expense can have zero or one linked work order | Nullable WorkOrderId on Expense entity |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- No `BusinessRuleException` exists in codebase. Used `ValidationException` (maps to 400) for property isolation validation per AC #7.
- Soft delete does NOT trigger FK `ON DELETE SET NULL` - that only fires on physical SQL DELETEs. Integration test adjusted to verify expense preservation after work order soft delete.

### Completion Notes List

- Tasks 1-10 all complete
- 15 new unit tests (5 CreateExpense + 4 UpdateExpense + 6 GetWorkOrderExpenses)
- 8 new integration tests (full flow, property isolation, tenant isolation, backward compat)
- Backend: 1,421 tests pass (899 app + 85 infra + 437 API), 0 failures
- Frontend: 2,130 tests pass, 0 failures/regressions
- API client regenerated with `workOrderId` in all expense DTOs and request models
- New endpoint `GET /api/v1/work-orders/{id}/expenses` generated in TypeScript client

### File List

**Modified:**
- `backend/src/PropertyManager.Domain/Entities/Expense.cs` - Added WorkOrderId, WorkOrder nav
- `backend/src/PropertyManager.Domain/Entities/WorkOrder.cs` - Added Expenses collection nav
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ExpenseConfiguration.cs` - FK config + index
- `backend/src/PropertyManager.Application/Expenses/ExpenseDto.cs` - Added WorkOrderId field
- `backend/src/PropertyManager.Application/Expenses/GetExpense.cs` - WorkOrderId in Select projection
- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` - WorkOrderId in ExpenseListItemDto + Select
- `backend/src/PropertyManager.Application/Expenses/GetExpensesByProperty.cs` - WorkOrderId in Select projection
- `backend/src/PropertyManager.Application/Expenses/CreateExpense.cs` - WorkOrderId param + validation
- `backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs` - WorkOrderId param + validation
- `backend/src/PropertyManager.Application/Expenses/CreateExpenseValidator.cs` - WorkOrderId rule
- `backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs` - WorkOrderId rule
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` - WorkOrderId in request/command mapping
- `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs` - New GetWorkOrderExpenses endpoint
- `frontend/src/app/core/api/api.service.ts` - Regenerated API client

**New:**
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260204113727_AddWorkOrderIdToExpense.cs` - Migration
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260204113727_AddWorkOrderIdToExpense.Designer.cs` - Migration designer
- `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrderExpenses.cs` - Query + Handler + DTOs
- `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrderExpensesValidator.cs` - FluentValidation
- `backend/tests/PropertyManager.Application.Tests/Expenses/CreateExpenseWithWorkOrderTests.cs` - 5 unit tests
- `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseWithWorkOrderTests.cs` - 4 unit tests
- `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetWorkOrderExpensesHandlerTests.cs` - 6 unit tests
- `backend/tests/PropertyManager.Api.Tests/ExpenseWorkOrderIntegrationTests.cs` - 8 integration tests
