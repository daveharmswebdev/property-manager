# Story 8.2: Trade Tag Taxonomy Setup

Status: done

## Story

As a **developer**,
I want **the trade tag taxonomy and category mappings created**,
So that **vendors can be tagged by trade specialty and mapped to expense categories**.

## Acceptance Criteria

### Database Schema

1. **Given** the database migration runs
   **When** I check the database schema
   **Then** a `VendorTradeTags` table exists with columns:
   - Id (UUID, PK)
   - AccountId (UUID, FK to Accounts)
   - Name (VARCHAR 100, NOT NULL)
   - CreatedAt (timestamp)
   - UNIQUE constraint on (AccountId, Name)

2. **And** a `CategoryTradeTagMappings` table exists with columns:
   - CategoryId (UUID, FK to ExpenseCategories)
   - TradeTagId (UUID, FK to VendorTradeTags)
   - PRIMARY KEY (CategoryId, TradeTagId)

### API Endpoints

3. **Given** the API is running
   **When** I call `GET /api/v1/vendor-trade-tags`
   **Then** I receive a list of trade tags for my account
   **And** the response follows standard format `{ items: [...], totalCount: n }`

4. **Given** I want to create a new trade tag
   **When** I call `POST /api/v1/vendor-trade-tags` with `{ "name": "Plumber" }`
   **Then** the trade tag is created
   **And** I receive `{ "id": "<guid>" }`

5. **Given** a trade tag with that name already exists for my account
   **When** I try to create a duplicate
   **Then** I receive a 409 Conflict error

## Tasks / Subtasks

### Task 1: Create Domain Entity (AC: #1)
- [x] 1.1 Create `VendorTradeTag` entity in Domain/Entities with:
  - Id, AccountId, Name, CreatedAt
  - Implements ITenantEntity
  - Navigation to Vendors collection (via junction table)

### Task 2: Create Junction Entity for Category Mapping (AC: #2)
- [x] 2.1 Create `CategoryTradeTagMapping` entity in Domain/Entities with:
  - CategoryId, TradeTagId (composite PK)
  - Navigation to ExpenseCategory and VendorTradeTag

### Task 3: Configure EF Core (AC: #1, #2)
- [x] 3.1 Create `VendorTradeTagConfiguration.cs` in Infrastructure/Persistence/Configurations
  - Configure table name, primary key
  - Configure unique constraint on (AccountId, Name)
  - Add global query filter for tenant isolation
- [x] 3.2 Create `CategoryTradeTagMappingConfiguration.cs` in Infrastructure/Persistence/Configurations
  - Configure composite primary key (CategoryId, TradeTagId)
  - Configure FK relationships
- [x] 3.3 Add DbSets to AppDbContext:
  - `DbSet<VendorTradeTag> VendorTradeTags`
  - `DbSet<CategoryTradeTagMapping> CategoryTradeTagMappings`
- [x] 3.4 Add to IAppDbContext interface

### Task 4: Create Database Migration (AC: #1, #2)
- [x] 4.1 Generate migration: `dotnet ef migrations add AddVendorTradeTagsTaxonomy`
- [x] 4.2 Review migration SQL for correctness
- [x] 4.3 Apply migration: `dotnet ef database update`
- [x] 4.4 Verify tables created in PostgreSQL

### Task 5: Implement Application Layer - Query (AC: #3)
- [x] 5.1 Create `VendorTradeTags/` folder in Application layer
- [x] 5.2 Create `VendorTradeTagDto.cs` with Id, Name
- [x] 5.3 Create `GetAllVendorTradeTags.cs` query:
  - `GetAllVendorTradeTagsQuery : IRequest<PaginatedList<VendorTradeTagDto>>`
  - Handler returns trade tags sorted by Name
  - Filter by current user's AccountId

### Task 6: Implement Application Layer - Command (AC: #4, #5)
- [x] 6.1 Create `CreateVendorTradeTag.cs` command:
  - `CreateVendorTradeTagCommand(string Name) : IRequest<Guid>`
  - Handler creates tag with AccountId from current user
- [x] 6.2 Create `CreateVendorTradeTagValidator.cs`:
  - Name required, max 100 chars
- [x] 6.3 Add duplicate detection in handler:
  - Check if tag with same name exists for account
  - Throw appropriate exception for 409 response

### Task 7: Create Custom Exception for Conflict (AC: #5)
- [x] 7.1 Create `ConflictException` in Domain/Exceptions (if not exists) - Already existed
- [x] 7.2 Update GlobalExceptionHandlerMiddleware to map ConflictException to 409 - Already mapped

### Task 8: Implement API Controller (AC: #3, #4, #5)
- [x] 8.1 Create `VendorTradeTagsController.cs` in Api/Controllers
- [x] 8.2 Implement `GET /api/v1/vendor-trade-tags` endpoint
- [x] 8.3 Implement `POST /api/v1/vendor-trade-tags` endpoint
  - Return 201 Created with `{ id: "<guid>" }`
  - Return 409 Conflict on duplicate
- [x] 8.4 Verify endpoints appear in Swagger

### Task 9: Testing
- [x] 9.1 Create unit tests for GetAllVendorTradeTagsQueryHandler
  - Test empty list, tenant isolation, sorting
- [x] 9.2 Create unit tests for CreateVendorTradeTagCommandHandler
  - Test successful creation, duplicate detection
- [x] 9.3 Test migration applies cleanly
- [x] 9.4 Verify endpoints via API calls

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Domain/
├── Entities/
│   ├── VendorTradeTag.cs          <- NEW
│   └── CategoryTradeTagMapping.cs <- NEW
├── Exceptions/
│   └── ConflictException.cs       <- NEW (if not exists)

PropertyManager.Application/
├── VendorTradeTags/               <- NEW folder
│   ├── VendorTradeTagDto.cs
│   ├── GetAllVendorTradeTags.cs
│   ├── CreateVendorTradeTag.cs
│   └── CreateVendorTradeTagValidator.cs

PropertyManager.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── VendorTradeTagConfiguration.cs          <- NEW
│   │   └── CategoryTradeTagMappingConfiguration.cs <- NEW
│   └── AppDbContext.cs    <- Add DbSets

PropertyManager.Api/
├── Controllers/
│   └── VendorTradeTagsController.cs  <- NEW
├── Middleware/
│   └── GlobalExceptionHandlerMiddleware.cs <- Update for 409
```

### Taxonomy Architecture (ADR #17)

Per Architecture document, the taxonomy uses "separate but mapped" approach:
- **Expense Categories:** Hierarchical (ParentId) - for tax reporting
- **Vendor Trade Tags:** Flat structure - for simple vendor matching
- **Category-Trade Mapping:** Explicit relationships for future AI recommendations

This story creates the flat trade tag taxonomy. The mapping table enables future features like "suggest plumber vendors when expense category is Plumbing > Repairs".

### Flat Taxonomy Pattern

VendorTradeTags is intentionally flat (no ParentId) per PRD:
> "Vendor Trade Tags: Flat structure for simple matching (Plumber, Electrician, HVAC Tech)"

### Unique Constraint Pattern

The unique constraint on (AccountId, Name) ensures:
- Each account can have their own "Plumber" tag
- No duplicate tag names within an account
- Database-level enforcement (not just application logic)

**EF Core Configuration:**
```csharp
builder.HasIndex(t => new { t.AccountId, t.Name })
    .IsUnique();
```

### 409 Conflict Response Pattern

For duplicate detection, follow RFC 7807 Problem Details format:
```json
{
  "type": "https://propertymanager.app/errors/conflict",
  "title": "Resource conflict",
  "status": 409,
  "detail": "A trade tag with name 'Plumber' already exists",
  "traceId": "00-abc123..."
}
```

### Previous Story Learnings (8.1)

From 8-1-person-vendor-entity-foundation.md:

1. **TPT Query Filter Limitation:** EF Core doesn't support query filters on derived types in TPT. Not applicable to this story (VendorTradeTag is not using inheritance).

2. **Defense-in-Depth Pattern:** Even with global query filter, explicitly filter by AccountId in handlers for documentation clarity.

3. **Soft Delete Index:** If soft delete is needed, add index on DeletedAt column. This story does NOT use soft delete (trade tags are hard deleted or kept).

4. **Test Count Baseline:** All 521 tests passing after 8.1 (330 Application + 33 Infrastructure + 158 Api).

### Existing Patterns to Follow

**Reference Files:**
- `PropertyManager.Application/Vendors/GetAllVendors.cs` - Query pattern from 8.1
- `PropertyManager.Application/Expenses/CreateExpense.cs` - Command pattern
- `PropertyManager.Application/ExpenseCategories/GetExpenseCategories.cs` - Simple list query
- `PropertyManager.Api/Controllers/VendorsController.cs` - Controller pattern from 8.1
- `PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` - Exception mapping

**Tenant Isolation:**
All VendorTradeTag queries MUST filter by AccountId. Use `ICurrentUser.AccountId`.

### API Response Formats

**GET /api/v1/vendor-trade-tags (200 OK):**
```json
{
  "items": [
    { "id": "abc-123", "name": "Electrician" },
    { "id": "def-456", "name": "Plumber" }
  ],
  "totalCount": 2
}
```

**POST /api/v1/vendor-trade-tags (201 Created):**
```json
{
  "id": "xyz-789"
}
```
+ `Location` header: `/api/v1/vendor-trade-tags/xyz-789`

**POST duplicate (409 Conflict):**
```json
{
  "type": "https://propertymanager.app/errors/conflict",
  "title": "Resource conflict",
  "status": 409,
  "detail": "A trade tag with name 'Plumber' already exists",
  "traceId": "00-..."
}
```

### CategoryTradeTagMappings - Deferred Usage

The CategoryTradeTagMappings junction table is created in this story for database completeness, but:
- No API endpoints for mappings in this story
- No UI for managing mappings in Epic 8
- Mappings will be used in future AI-assisted vendor recommendations

This follows the architecture principle: "Lay foundation now, use later."

### Project Structure Notes

- VendorTradeTags feature folder follows Vendors pattern
- No new architectural patterns introduced
- Extends existing tenant isolation mechanism
- No frontend changes in this story (backend-only)

### Testing Requirements

**Unit Tests:**
- `GetAllVendorTradeTagsQueryHandlerTests.cs`:
  - Returns empty list when no tags
  - Filters by current user's AccountId (tenant isolation)
  - Returns tags sorted alphabetically by name
  - Maps correctly to DTO

- `CreateVendorTradeTagCommandHandlerTests.cs`:
  - Creates tag with correct AccountId
  - Returns new tag ID
  - Throws on duplicate name (same account)
  - Allows same name in different accounts

**Manual Verification:**
- [x] Migration applies without errors
- [x] Tables created with correct columns and constraints
- [x] Swagger shows both endpoints
- [x] GET returns `{ items: [], totalCount: 0 }` initially
- [x] POST creates tag and returns ID
- [x] POST with duplicate returns 409
- [x] Endpoints require authentication (401 without JWT)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR39 | System maintains vendor trade tags as flat taxonomy | VendorTradeTags table with AccountId scoping |
| FR40 | System maintains mappings between expense categories and trade tags | CategoryTradeTagMappings junction table |

### References

- [Source: architecture.md#Decision #17] - Taxonomy structure: hierarchical categories, flat trade tags, mapping table
- [Source: architecture.md#New Database Tables] - VendorTradeTags and CategoryTradeTagMappings schema
- [Source: epics-work-orders-vendors.md#Story 1.2] - Original story definition and acceptance criteria
- [Source: prd-work-orders-vendors.md#Taxonomy Management] - FR39, FR40 requirements
- [Source: 8-1-person-vendor-entity-foundation.md] - Previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- No debug issues encountered during implementation

### Completion Notes List

- Created VendorTradeTag entity implementing ITenantEntity for multi-tenant support
- Created CategoryTradeTagMapping junction table for future category-trade tag relationships
- Added EF Core configurations with unique constraint on (AccountId, Name)
- Applied database migration successfully - tables verified in PostgreSQL
- Implemented GetAllVendorTradeTagsQuery with tenant isolation and alphabetical sorting
- Implemented CreateVendorTradeTagCommand with case-insensitive duplicate detection
- ConflictException and 409 mapping already existed from previous story
- Created VendorTradeTagsController with GET and POST endpoints
- All 544 backend tests pass (353 Application + 33 Infrastructure + 158 Api)
- 23 new unit tests added for VendorTradeTags feature
- API endpoints verified via curl with JWT authentication

### File List

**New Files:**
- backend/src/PropertyManager.Domain/Entities/VendorTradeTag.cs
- backend/src/PropertyManager.Domain/Entities/CategoryTradeTagMapping.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/VendorTradeTagConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/CategoryTradeTagMappingConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116155434_AddVendorTradeTagsTaxonomy.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116155434_AddVendorTradeTagsTaxonomy.Designer.cs
- backend/src/PropertyManager.Application/VendorTradeTags/VendorTradeTagDto.cs
- backend/src/PropertyManager.Application/VendorTradeTags/GetAllVendorTradeTags.cs
- backend/src/PropertyManager.Application/VendorTradeTags/CreateVendorTradeTag.cs
- backend/src/PropertyManager.Application/VendorTradeTags/CreateVendorTradeTagValidator.cs
- backend/src/PropertyManager.Api/Controllers/VendorTradeTagsController.cs
- backend/tests/PropertyManager.Application.Tests/VendorTradeTags/GetAllVendorTradeTagsHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/VendorTradeTags/CreateVendorTradeTagHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/VendorTradeTags/CreateVendorTradeTagValidatorTests.cs

**Modified Files:**
- backend/src/PropertyManager.Domain/Entities/ExpenseCategory.cs (added TradeTagMappings navigation)
- backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs (added DbSets)
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs (added DbSets and query filter)
- backend/src/PropertyManager.Api/Controllers/VendorTradeTagsController.cs (code review fixes)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116190445_FixVendorTradeTagCaseInsensitiveIndex.cs (NEW - code review fix)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116190445_FixVendorTradeTagCaseInsensitiveIndex.Designer.cs (NEW - code review fix)

---

## Senior Developer Review (AI)

**Reviewer:** Amelia (Dev Agent) - Claude Opus 4.5
**Date:** 2026-01-16
**Outcome:** APPROVED with fixes applied

### Issues Found and Fixed

| # | Severity | Issue | Fix Applied |
|---|----------|-------|-------------|
| 1 | MEDIUM | Database unique index was case-sensitive but handler checked case-insensitively - data integrity gap | Created migration `FixVendorTradeTagCaseInsensitiveIndex` with functional index `LOWER(Name)` |
| 2 | MEDIUM | Controller actions missing `CancellationToken` - server continues on client disconnect | Added `CancellationToken` parameter to both GET and POST actions |
| 3 | LOW | `CreatedAtAction` had unused route parameter `{ id = tradeTagId }` | Changed to `null` since no GetById endpoint exists |
| 4 | LOW | Redundant `DateTime.UtcNow` in log messages | Removed - structured logging adds timestamps automatically |
| 5 | LOW | Missing null check on `[FromBody]` request | Added null check with proper ProblemDetails response |

### Verification

- All 544 backend tests pass (353 Application + 33 Infrastructure + 158 Api)
- Migration applies cleanly
- Build succeeds with no new errors

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-16 | Dev Agent (Claude Opus 4.5) | Code review fixes: case-insensitive DB index, CancellationToken support, controller improvements |

