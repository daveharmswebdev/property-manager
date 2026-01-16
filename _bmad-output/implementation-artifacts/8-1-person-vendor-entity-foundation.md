# Story 8.1: Person & Vendor Entity Foundation

Status: done

## Story

As a **developer**,
I want **the Person and Vendor database entities and API infrastructure created**,
So that **vendors can be stored and retrieved with proper data architecture**.

## Acceptance Criteria

### Database Schema

1. **Given** the database migration runs
   **When** I check the database schema
   **Then** a `Persons` table exists with columns:
   - Id (UUID, PK)
   - AccountId (UUID, FK to Accounts)
   - FirstName (VARCHAR 100, NOT NULL)
   - MiddleName (VARCHAR 100, nullable)
   - LastName (VARCHAR 100, NOT NULL)
   - Phones (JSONB, default '[]')
   - Emails (JSONB, default '[]')
   - CreatedAt, UpdatedAt (timestamps)

2. **And** a `Vendors` table exists with columns:
   - Id (UUID, PK, FK to Persons.Id - TPT inheritance)
   - DeletedAt (timestamp, nullable for soft delete)

3. **And** EF Core entities are configured with TPT inheritance
4. **And** global query filter enforces AccountId tenant isolation
5. **And** global query filter excludes soft-deleted vendors

### API Endpoint

6. **Given** the API is running
   **When** I call `GET /api/v1/vendors`
   **Then** I receive an empty list (no vendors yet)
   **And** the response follows the standard format `{ items: [], totalCount: 0 }`

## Tasks / Subtasks

### Task 1: Create Domain Entities (AC: #1, #2)
- [x] 1.1 Create `PhoneNumber` record in Domain/ValueObjects
- [x] 1.2 Create `Person` entity in Domain/Entities with:
  - Id, AccountId, FirstName, MiddleName, LastName
  - Phones as `List<PhoneNumber>`
  - Emails as `List<string>`
  - Implements ITenantEntity, AuditableEntity
- [x] 1.3 Create `Vendor` entity extending Person with:
  - DeletedAt for soft delete
  - Implements ISoftDeletable
  - Navigation to TradeTags collection (empty for now)

### Task 2: Configure EF Core (AC: #3, #4, #5)
- [x] 2.1 Create `PersonConfiguration.cs` in Infrastructure/Persistence/Configurations
  - Configure TPT inheritance with `ToTable("Persons")`
  - Configure Phones/Emails as JSONB columns using `.HasColumnType("jsonb")`
  - Configure AccountId FK relationship
- [x] 2.2 Create `VendorConfiguration.cs` in Infrastructure/Persistence/Configurations
  - Configure TPT inheritance with `ToTable("Vendors")`
  - Configure soft delete via DeletedAt
- [x] 2.3 Add DbSets to AppDbContext:
  - `DbSet<Person> Persons`
  - `DbSet<Vendor> Vendors`
- [x] 2.4 Add global query filters:
  - AccountId tenant isolation filter for Person
  - Soft delete filter for Vendor (where DeletedAt == null)

### Task 3: Create Database Migration (AC: #1, #2)
- [x] 3.1 Generate migration: `dotnet ef migrations add AddPersonAndVendorEntities`
- [x] 3.2 Review migration SQL for correctness
- [x] 3.3 Apply migration: `dotnet ef database update`
- [x] 3.4 Verify tables created in PostgreSQL

### Task 4: Implement Application Layer (AC: #6)
- [x] 4.1 Create `Vendors/` folder in Application layer
- [x] 4.2 Create `GetAllVendors.cs` query:
  - `GetAllVendorsQuery : IRequest<PaginatedList<VendorDto>>`
  - `GetAllVendorsQueryHandler`
  - `VendorDto` with Id, FirstName, LastName, FullName
- [x] 4.3 Create `VendorDto.cs` in Vendors folder

### Task 5: Implement API Controller (AC: #6)
- [x] 5.1 Create `VendorsController.cs` in Api/Controllers
- [x] 5.2 Implement `GET /api/v1/vendors` endpoint
  - Returns `{ items: [], totalCount: 0 }` format
  - Uses `[Authorize]` attribute
- [x] 5.3 Verify endpoint appears in Swagger

### Task 6: Testing
- [x] 6.1 Create unit test for GetAllVendorsQueryHandler
- [x] 6.2 Test migration applies cleanly to fresh database
- [x] 6.3 Verify endpoint returns correct format via Postman

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Domain/
├── Entities/
│   ├── Person.cs          ← NEW
│   └── Vendor.cs          ← NEW
├── ValueObjects/
│   └── PhoneNumber.cs     ← NEW

PropertyManager.Application/
├── Vendors/               ← NEW folder
│   ├── GetAllVendors.cs   ← Query + Handler
│   └── VendorDto.cs

PropertyManager.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── PersonConfiguration.cs   ← NEW
│   │   └── VendorConfiguration.cs   ← NEW
│   └── AppDbContext.cs    ← Add DbSets

PropertyManager.Api/
├── Controllers/
│   └── VendorsController.cs  ← NEW
```

### TPT Inheritance Pattern

This story implements Table-per-Type (TPT) inheritance for Person → Vendor hierarchy. This is a deliberate architecture decision (ADR #14) to support future entities (Tenant, User refactor) that will also extend Person.

**EF Core Configuration:**
```csharp
// PersonConfiguration.cs
public void Configure(EntityTypeBuilder<Person> builder)
{
    builder.ToTable("Persons");
    builder.HasKey(p => p.Id);

    // JSONB columns for PostgreSQL
    builder.Property(p => p.Phones)
        .HasColumnType("jsonb")
        .HasDefaultValueSql("'[]'::jsonb");

    builder.Property(p => p.Emails)
        .HasColumnType("jsonb")
        .HasDefaultValueSql("'[]'::jsonb");
}

// VendorConfiguration.cs
public void Configure(EntityTypeBuilder<Vendor> builder)
{
    builder.ToTable("Vendors");
    // Id is FK to Persons.Id (TPT pattern)
}
```

### JSONB for Phones/Emails

Per Architecture ADR #15, phones and emails are stored as JSONB columns rather than separate tables. This simplifies the model for 1-3 values per person while maintaining queryability if needed later.

**PhoneNumber record:**
```csharp
public record PhoneNumber(string Number, string? Label);
```

### Existing Patterns to Follow

**Reference Files:**
- `PropertyManager.Domain/Entities/Property.cs` - Entity pattern with ITenantEntity
- `PropertyManager.Domain/Entities/Expense.cs` - Soft delete pattern with ISoftDeletable
- `PropertyManager.Application/Properties/GetAllProperties.cs` - Query/Handler pattern
- `PropertyManager.Infrastructure/Persistence/Configurations/PropertyConfiguration.cs` - Configuration pattern
- `PropertyManager.Api/Controllers/PropertiesController.cs` - Controller pattern

**Tenant Isolation:**
All Person/Vendor queries MUST filter by AccountId. Use the existing `ICurrentUser` service to get the current user's AccountId.

### API Response Format

Follow existing pattern from PropertiesController:
```json
{
  "items": [],
  "totalCount": 0
}
```

### Global Query Filters

Add to AppDbContext.OnModelCreating:
```csharp
// Tenant isolation for Person
modelBuilder.Entity<Person>()
    .HasQueryFilter(p => p.AccountId == _currentUser.AccountId);

// Soft delete for Vendor
modelBuilder.Entity<Vendor>()
    .HasQueryFilter(v => v.DeletedAt == null);
```

**Note:** The Vendor filter combines with Person filter via TPT inheritance.

### Project Structure Notes

- Vendors feature folder follows Properties/Expenses pattern
- No new architectural patterns introduced
- Extends existing tenant isolation mechanism
- Follows existing CQRS command/query separation

### Testing Requirements

**Unit Tests:**
- `GetAllVendorsQueryHandlerTests.cs` - Verify empty list returned, verify tenant isolation

**Manual Verification:**
- [x] Migration applies without errors
- [x] Tables created with correct columns in PostgreSQL
- [x] Swagger shows /api/v1/vendors endpoint
- [x] GET /api/v1/vendors returns `{ items: [], totalCount: 0 }`
- [x] Endpoint requires authentication (returns 401 without JWT)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR1 | Person base entity with name fields | Person entity with FirstName, MiddleName, LastName |
| FR2 | Multiple phone numbers per Person | Phones JSONB column with List<PhoneNumber> |
| FR3 | Multiple email addresses per Person | Emails JSONB column with List<string> |
| FR4 | Person audit fields | AuditableEntity base with CreatedAt, UpdatedAt |
| FR5 | Person as base for Vendor | TPT inheritance: Vendor extends Person |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - TPT inheritance decision
- [Source: architecture.md#Decision #15] - JSONB for Phone/Email
- [Source: architecture.md#Decision #14] - TPT inheritance rationale
- [Source: epics-work-orders-vendors.md#Story 1.1] - Original story definition
- [Source: prd-work-orders-vendors.md#Person Management] - FR1-FR5 requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Migration created successfully: 20260116120529_AddPersonAndVendorEntities
- TPT inheritance query filter limitation: Removed Vendor query filter since EF Core doesn't support query filters on derived types in TPT. Soft delete is handled explicitly in GetAllVendorsQueryHandler.
- All 521 tests pass (330 Application + 33 Infrastructure + 158 Api)

### Completion Notes List

1. **Domain Layer:** Created PhoneNumber value object and Person/Vendor entities with TPT inheritance pattern
2. **EF Core Configuration:** Configured TPT inheritance with Persons as base table, Vendors as derived table with FK to Persons.Id, JSONB columns for Phones/Emails
3. **Database Migration:** Successfully created and applied migration AddPersonAndVendorEntities - verified tables created correctly in PostgreSQL
4. **Application Layer:** Implemented GetAllVendorsQuery with handler returning paginated vendor list sorted by LastName, FirstName
5. **API Layer:** Created VendorsController with GET /api/v1/vendors endpoint requiring JWT authentication
6. **Testing:** Created 7 unit tests for GetAllVendorsQueryHandler covering empty list, tenant isolation, soft delete filtering, sorting, and DTO mapping
7. **Code Review Fixes:** Added DeletedAt index for soft delete query performance, documented defense-in-depth tenant filter, updated File List with missing AppDbContextModelSnapshot.cs

### File List

**Created:**
- backend/src/PropertyManager.Domain/ValueObjects/PhoneNumber.cs
- backend/src/PropertyManager.Domain/Entities/Person.cs
- backend/src/PropertyManager.Domain/Entities/Vendor.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/PersonConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/VendorConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116120529_AddPersonAndVendorEntities.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116120529_AddPersonAndVendorEntities.Designer.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116121830_AddVendorDeletedAtIndex.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260116121830_AddVendorDeletedAtIndex.Designer.cs
- backend/src/PropertyManager.Application/Vendors/VendorDto.cs
- backend/src/PropertyManager.Application/Vendors/GetAllVendors.cs
- backend/src/PropertyManager.Api/Controllers/VendorsController.cs
- backend/tests/PropertyManager.Application.Tests/Vendors/GetAllVendorsHandlerTests.cs

**Modified:**
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs (Added DbSets for Person/Vendor, query filter for Person)
- backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs (Added DbSets for Person/Vendor)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs (Auto-generated: updated model snapshot)
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/VendorConfiguration.cs (Added DeletedAt index for soft delete query performance)
- backend/src/PropertyManager.Application/Vendors/GetAllVendors.cs (Added documentation for defense-in-depth tenant filter)
