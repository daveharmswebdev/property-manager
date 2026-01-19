# Story 9.1: Work Order Entity & Category Hierarchy

Status: done

## Story

As a **developer**,
I want **the Work Order database entities and category hierarchy created**,
So that **work orders can be stored with proper relationships and categories can be nested**.

## Acceptance Criteria

### Database Schema

1. **Given** the database migration runs
   **When** I check the database schema
   **Then** a `WorkOrders` table exists with columns:
   - Id (UUID, PK, default gen_random_uuid())
   - AccountId (UUID, FK to Accounts, NOT NULL)
   - PropertyId (UUID, FK to Properties, NOT NULL)
   - VendorId (UUID, FK to Vendors, nullable - NULL means DIY)
   - CategoryId (UUID, FK to ExpenseCategories, nullable)
   - CreatedByUserId (UUID, FK to Users, NOT NULL)
   - Status (VARCHAR 50, NOT NULL, default 'Reported')
   - Description (TEXT, NOT NULL)
   - CreatedAt, UpdatedAt (timestamps)
   - DeletedAt (timestamp, nullable for soft delete)

2. **And** a `WorkOrderTags` table exists with columns:
   - Id (UUID, PK, default gen_random_uuid())
   - AccountId (UUID, FK to Accounts, NOT NULL)
   - Name (VARCHAR 100, NOT NULL)
   - CreatedAt (timestamp)
   - UNIQUE constraint on (AccountId, Name)

3. **And** a `WorkOrderTagAssignments` junction table exists with:
   - WorkOrderId (UUID, FK to WorkOrders, ON DELETE CASCADE)
   - TagId (UUID, FK to WorkOrderTags, ON DELETE CASCADE)
   - PRIMARY KEY (WorkOrderId, TagId)

4. **And** `ExpenseCategories` table has new column:
   - ParentId (UUID, FK to ExpenseCategories, nullable)

5. **And** EF Core entities are configured with relationships
6. **And** global query filter enforces AccountId tenant isolation
7. **And** global query filter excludes soft-deleted work orders

### API Endpoints

8. **Given** the API is running
   **When** I call `GET /api/v1/work-orders`
   **Then** I receive an empty list with standard response format `{ items: [], totalCount: 0 }`

9. **Given** I call `GET /api/v1/expense-categories`
   **When** categories have ParentId set
   **Then** the response includes ParentId for building hierarchy on client

## Tasks / Subtasks

### Task 1: Create Domain Entities (AC: #1, #2, #3)

- [x] 1.1 Create `WorkOrderStatus` enum in Domain/Enums with values: Reported, Assigned, Completed
- [x] 1.2 Create `WorkOrder` entity in Domain/Entities with:
  - Id, AccountId, PropertyId, VendorId (nullable), CategoryId (nullable), CreatedByUserId
  - Status as WorkOrderStatus enum (default: Reported)
  - Description (string, required)
  - DeletedAt for soft delete
  - Implements ITenantEntity, AuditableEntity, ISoftDeletable
  - Navigation properties: Account, Property, Vendor?, Category?, Tags, CreatedByUser
- [x] 1.3 Create `WorkOrderTag` entity in Domain/Entities with:
  - Id, AccountId, Name, CreatedAt
  - Implements ITenantEntity
  - Navigation to WorkOrders collection
- [x] 1.4 Create `WorkOrderTagAssignment` entity in Domain/Entities with:
  - WorkOrderId, TagId (composite PK)
  - Navigation properties: WorkOrder, Tag

### Task 2: Update ExpenseCategory Entity (AC: #4)

- [x] 2.1 Add `ParentId` property to ExpenseCategory entity (nullable Guid)
- [x] 2.2 Add `Parent` navigation property (nullable ExpenseCategory)
- [x] 2.3 Add `Children` navigation collection (ICollection<ExpenseCategory>)

### Task 3: Configure EF Core (AC: #5, #6, #7)

- [x] 3.1 Create `WorkOrderConfiguration.cs` in Infrastructure/Persistence/Configurations
  - Configure Status as string conversion (Enum stored as VARCHAR)
  - Configure FK relationships: PropertyId, VendorId, CategoryId, CreatedByUserId
  - Configure DeletedAt for soft delete
  - Add index on (AccountId, Status) for filtered queries
  - Add index on DeletedAt for soft delete queries
- [x] 3.2 Create `WorkOrderTagConfiguration.cs`
  - Configure unique constraint on (AccountId, Name)
  - Add index on AccountId
- [x] 3.3 Create `WorkOrderTagAssignmentConfiguration.cs`
  - Configure composite PK (WorkOrderId, TagId)
  - Configure cascade delete behavior
- [x] 3.4 Update `ExpenseCategoryConfiguration.cs`
  - Add ParentId FK relationship (self-referential)
  - Configure as nullable
- [x] 3.5 Add DbSets to AppDbContext:
  - `DbSet<WorkOrder> WorkOrders`
  - `DbSet<WorkOrderTag> WorkOrderTags`
  - `DbSet<WorkOrderTagAssignment> WorkOrderTagAssignments`
- [x] 3.6 Add global query filters:
  - AccountId tenant isolation filter for WorkOrder
  - Soft delete filter for WorkOrder (where DeletedAt == null)
  - AccountId tenant isolation filter for WorkOrderTag

### Task 4: Create Database Migration (AC: #1, #2, #3, #4)

- [x] 4.1 Generate migration: `dotnet ef migrations add AddWorkOrderEntitiesAndCategoryHierarchy`
- [x] 4.2 Review migration SQL for:
  - Correct FK constraints and ON DELETE behaviors
  - Proper indexes for query performance
  - ParentId added to ExpenseCategories
- [x] 4.3 Apply migration: `dotnet ef database update`
- [x] 4.4 Verify tables created in PostgreSQL

### Task 5: Update ExpenseCategory DTOs and Query (AC: #9)

- [x] 5.1 Update `ExpenseCategoryDto` to include `ParentId` property
- [x] 5.2 Update `GetExpenseCategories` query handler to include ParentId in response
- [x] 5.3 Verify GET /api/v1/expense-categories returns ParentId field

### Task 6: Implement WorkOrders Application Layer (AC: #8)

- [x] 6.1 Create `WorkOrders/` folder in Application layer
- [x] 6.2 Create `WorkOrderDto.cs` with:
  - Id, PropertyId, PropertyName
  - VendorId (nullable), VendorName (nullable)
  - CategoryId (nullable), CategoryName (nullable)
  - Status (as string), Description
  - CreatedAt, CreatedByUserId
  - Tags as List<WorkOrderTagDto>
- [x] 6.3 Create `WorkOrderTagDto.cs` with Id, Name
- [x] 6.4 Create `GetAllWorkOrders.cs` query:
  - `GetAllWorkOrdersQuery : IRequest<PaginatedList<WorkOrderDto>>`
  - Include filters: Status, PropertyId (for future use)
  - Handler with tenant isolation, soft delete filtering
  - Sort by CreatedAt descending (newest first)

### Task 7: Implement API Controller (AC: #8)

- [x] 7.1 Create `WorkOrdersController.cs` in Api/Controllers
- [x] 7.2 Implement `GET /api/v1/work-orders` endpoint
  - Returns `{ items: [], totalCount: 0 }` format
  - Uses `[Authorize]` attribute
  - Optional query params: status, propertyId (stubbed for now)
- [x] 7.3 Verify endpoint appears in Swagger

### Task 8: Testing

- [x] 8.1 Create unit test for GetAllWorkOrdersQueryHandler
  - Test empty list returned
  - Test tenant isolation
  - Test soft delete filtering
- [x] 8.2 Create unit test for ExpenseCategory ParentId in DTO
- [x] 8.3 Test migration applies cleanly to fresh database
- [x] 8.4 Verify endpoints return correct format via Postman

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Domain/
├── Entities/
│   ├── WorkOrder.cs              ← NEW
│   ├── WorkOrderTag.cs           ← NEW
│   ├── WorkOrderTagAssignment.cs ← NEW
│   └── ExpenseCategory.cs        ← MODIFIED (ParentId)
├── Enums/
│   └── WorkOrderStatus.cs        ← NEW

PropertyManager.Application/
├── WorkOrders/                   ← NEW folder
│   ├── GetAllWorkOrders.cs       ← Query + Handler
│   ├── WorkOrderDto.cs
│   └── WorkOrderTagDto.cs
├── ExpenseCategories/
│   └── ExpenseCategoryDto.cs     ← MODIFIED (ParentId)

PropertyManager.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── WorkOrderConfiguration.cs           ← NEW
│   │   ├── WorkOrderTagConfiguration.cs        ← NEW
│   │   ├── WorkOrderTagAssignmentConfiguration.cs ← NEW
│   │   └── ExpenseCategoryConfiguration.cs     ← MODIFIED
│   └── AppDbContext.cs           ← Add DbSets

PropertyManager.Api/
├── Controllers/
│   └── WorkOrdersController.cs   ← NEW
```

### Work Order Status Enum Pattern

Per Architecture ADR #19, status is stored as a C# enum converted to string in the database:

```csharp
// Domain/Enums/WorkOrderStatus.cs
public enum WorkOrderStatus
{
    Reported,   // Initial state when work order is created
    Assigned,   // When vendor or DIY is assigned
    Completed   // Work is finished
}

// In WorkOrderConfiguration.cs
builder.Property(w => w.Status)
    .HasConversion<string>()
    .HasMaxLength(50)
    .HasDefaultValue(WorkOrderStatus.Reported);
```

### VendorId NULL = DIY Pattern

Per Architecture ADR #21, a NULL VendorId means the work order is assigned to "Self" (DIY):

```csharp
public class WorkOrder
{
    public Guid? VendorId { get; set; }  // NULL = DIY/Self assignment
    public Vendor? Vendor { get; set; }

    public bool IsDiy => VendorId == null;
}
```

### Category Hierarchy Pattern

Per Architecture ADR #23, categories use flat API with ParentId - client builds the tree:

```csharp
// ExpenseCategory entity addition
public Guid? ParentId { get; set; }
public ExpenseCategory? Parent { get; set; }
public ICollection<ExpenseCategory> Children { get; set; } = [];

// API returns flat list with ParentId - client reconstructs hierarchy
// Example response:
// { "id": "plumbing", "name": "Plumbing", "parentId": null }
// { "id": "drain", "name": "Drain Cleaning", "parentId": "plumbing" }
```

### Existing Patterns to Follow

**Reference Files from Epic 8 (Vendor Management):**
- `PropertyManager.Domain/Entities/Vendor.cs` - Entity with soft delete, tenant isolation
- `PropertyManager.Application/Vendors/GetAllVendors.cs` - Query/Handler pattern
- `PropertyManager.Infrastructure/Persistence/Configurations/VendorConfiguration.cs` - Configuration pattern
- `PropertyManager.Api/Controllers/VendorsController.cs` - Controller pattern

**Reference Files for Tag Pattern:**
- `VendorTradeTags` table pattern (from 8-2) for WorkOrderTags
- `VendorTradeTagAssignments` junction table for WorkOrderTagAssignments

**Tenant Isolation:**
All WorkOrder queries MUST filter by AccountId. Use the existing `ICurrentUser` service to get the current user's AccountId.

### API Response Format

Follow existing pattern from VendorsController:
```json
{
  "items": [],
  "totalCount": 0
}
```

### Global Query Filters

Add to AppDbContext.OnModelCreating:
```csharp
// Tenant isolation for WorkOrder
modelBuilder.Entity<WorkOrder>()
    .HasQueryFilter(w => w.AccountId == _currentUser.AccountId);

// Soft delete for WorkOrder
// Note: EF Core TPT limitation - handle in query handler like GetAllVendors
modelBuilder.Entity<WorkOrder>()
    .HasQueryFilter(w => w.DeletedAt == null);

// Tenant isolation for WorkOrderTag
modelBuilder.Entity<WorkOrderTag>()
    .HasQueryFilter(t => t.AccountId == _currentUser.AccountId);
```

**Important Note from Epic 8 Learning:** EF Core query filters may need explicit handling in handlers for derived types. Check 8-1 debug log for TPT filter workaround pattern.

### Database FK Relationships

```csharp
// WorkOrderConfiguration.cs
builder.HasOne(w => w.Property)
    .WithMany()
    .HasForeignKey(w => w.PropertyId)
    .OnDelete(DeleteBehavior.Restrict);  // Don't cascade delete work orders

builder.HasOne(w => w.Vendor)
    .WithMany(v => v.WorkOrders)
    .HasForeignKey(w => w.VendorId)
    .OnDelete(DeleteBehavior.SetNull);  // If vendor deleted, set to DIY

builder.HasOne(w => w.Category)
    .WithMany()
    .HasForeignKey(w => w.CategoryId)
    .OnDelete(DeleteBehavior.SetNull);  // Category optional

builder.HasOne(w => w.CreatedByUser)
    .WithMany()
    .HasForeignKey(w => w.CreatedByUserId)
    .OnDelete(DeleteBehavior.Restrict);
```

### Project Structure Notes

- WorkOrders feature folder follows Vendors/Properties/Expenses pattern
- No new architectural patterns introduced
- Extends existing tenant isolation mechanism
- Follows existing CQRS command/query separation
- WorkOrderStatus enum follows simple .NET enum pattern (no SmartEnum complexity needed)

### Testing Requirements

**Unit Tests:**
- `GetAllWorkOrdersQueryHandlerTests.cs` - Empty list, tenant isolation, soft delete, sort order
- `ExpenseCategoryDtoTests.cs` - Verify ParentId mapping

**Manual Verification:**
- [x] Migration applies without errors
- [x] Tables created with correct columns and constraints in PostgreSQL
- [x] Swagger shows /api/v1/work-orders endpoint
- [x] GET /api/v1/work-orders returns `{ items: [], totalCount: 0 }`
- [x] GET /api/v1/expense-categories returns items with ParentId field
- [x] Endpoints require authentication (returns 401 without JWT)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR15 | Create work order linked to property | WorkOrder entity with PropertyId FK |
| FR16 | Set work order status | WorkOrderStatus enum (Reported, Assigned, Completed) |
| FR17 | Assign category to work order | CategoryId FK to ExpenseCategories |
| FR18 | Add description to work order | Description TEXT field |
| FR20 | Assign work order to vendor | VendorId FK (nullable for DIY) |
| FR21 | Assign work order to Self (DIY) | VendorId NULL = DIY |
| FR38 | Hierarchical expense categories | ParentId FK on ExpenseCategories |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - WorkOrder entity design
- [Source: architecture.md#Decision #19] - Status as C# Enum stored as string
- [Source: architecture.md#Decision #21] - Nullable VendorId for DIY
- [Source: architecture.md#Decision #23] - Category hierarchy with ParentId
- [Source: epics-work-orders-vendors.md#Story 2.1] - Original story definition
- [Source: 8-1-person-vendor-entity-foundation.md] - Pattern reference for entity foundation story

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - Implementation proceeded without blocking issues.

### Completion Notes List

1. **Domain Entities Created**: WorkOrderStatus enum, WorkOrder entity (with ITenantEntity, AuditableEntity, ISoftDeletable), WorkOrderTag entity, WorkOrderTagAssignment junction table.

2. **ExpenseCategory Hierarchy**: Added ParentId FK, Parent navigation, and Children collection for category hierarchy support per ADR #23.

3. **EF Core Configurations**: Created configurations for WorkOrder, WorkOrderTag, WorkOrderTagAssignment. Updated ExpenseCategoryConfiguration with self-referential ParentId FK.

4. **Migration Applied**: `20260119142928_AddWorkOrderEntitiesAndCategoryHierarchy` creates WorkOrders, WorkOrderTags, WorkOrderTagAssignments tables, adds ParentId to ExpenseCategories.

5. **Global Query Filters**: Added tenant isolation (AccountId) and soft delete (DeletedAt == null) filters for WorkOrder and WorkOrderTag in AppDbContext.

6. **Defense-in-Depth**: GetAllWorkOrdersQueryHandler includes explicit tenant and soft delete filtering in the query, matching VendorsHandler pattern.

7. **API Controller**: WorkOrdersController created with GET /api/v1/work-orders endpoint, optional status and propertyId query params.

8. **Unit Tests**: 14 new tests covering GetAllWorkOrdersHandlerTests (11 tests) and GetExpenseCategoriesHandlerTests (3 tests). All 653 total tests pass.

### Code Review Fixes (Post-PR)

9. **Case-Insensitive Status Filter**: Updated GetAllWorkOrders handler to use `Enum.TryParse` with `ignoreCase: true` instead of string comparison. Status filter now accepts "assigned", "ASSIGNED", "Assigned" etc.

10. **Input Validation Added**: Created GetAllWorkOrdersValidator using FluentValidation to validate status parameter against valid WorkOrderStatus enum values. Invalid values (e.g., "InvalidStatus", "123") now return 400 Bad Request with proper error message.

11. **Controller Updated**: WorkOrdersController now injects and uses GetAllWorkOrdersValidator, returns ValidationProblemDetails for invalid status values.

12. **Additional Tests**: Added 23 new tests - 18 validator tests (GetAllWorkOrdersValidatorTests) and 5 handler tests for case-insensitive filtering. Total tests now 676.

### File List

**Created:**
- backend/src/PropertyManager.Domain/Enums/WorkOrderStatus.cs
- backend/src/PropertyManager.Domain/Entities/WorkOrder.cs
- backend/src/PropertyManager.Domain/Entities/WorkOrderTag.cs
- backend/src/PropertyManager.Domain/Entities/WorkOrderTagAssignment.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/WorkOrderConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/WorkOrderTagConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/WorkOrderTagAssignmentConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260119142928_AddWorkOrderEntitiesAndCategoryHierarchy.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260119142928_AddWorkOrderEntitiesAndCategoryHierarchy.Designer.cs
- backend/src/PropertyManager.Application/WorkOrders/WorkOrderDto.cs
- backend/src/PropertyManager.Application/WorkOrders/WorkOrderTagDto.cs
- backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrders.cs
- backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs
- backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/Expenses/GetExpenseCategoriesHandlerTests.cs
- backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrdersValidator.cs (code review fix)
- backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersValidatorTests.cs (code review fix)

**Modified:**
- backend/src/PropertyManager.Domain/Entities/ExpenseCategory.cs (added ParentId, Parent, Children)
- backend/src/PropertyManager.Domain/Entities/Vendor.cs (added WorkOrders navigation)
- backend/src/PropertyManager.Domain/Entities/Property.cs (added WorkOrders navigation)
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ExpenseCategoryConfiguration.cs (added ParentId FK)
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs (added DbSets and query filters)
- backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs (added WorkOrder DbSets)
- backend/src/PropertyManager.Application/Expenses/ExpenseCategoryDto.cs (added ParentId)
- backend/src/PropertyManager.Application/Expenses/GetExpenseCategories.cs (added ParentId to projection)
- backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrders.cs (code review: case-insensitive status filter)
- backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs (code review: added validation)
- backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersHandlerTests.cs (code review: added case-insensitive tests)
