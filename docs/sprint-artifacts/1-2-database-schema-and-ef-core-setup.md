# Story 1.2: Database Schema and EF Core Setup

Status: done

## Story

As a developer,
I want the core database schema created with EF Core migrations,
so that entities can be persisted and the multi-tenant foundation is established.

## Acceptance Criteria

1. **AC2.1**: Running `dotnet ef database update` creates the following tables with correct column types:
   - `Accounts` (Id UUID PK, Name VARCHAR(255), CreatedAt TIMESTAMP)
   - `Users` (Id UUID PK, AccountId UUID FK, Email VARCHAR(255) UNIQUE, PasswordHash TEXT, Role VARCHAR(50), CreatedAt TIMESTAMP, UpdatedAt TIMESTAMP)
   - `Properties` (Id UUID PK, AccountId UUID FK, Name VARCHAR(255), Address TEXT, CreatedAt TIMESTAMP, UpdatedAt TIMESTAMP, DeletedAt TIMESTAMP NULL)
   - `Expenses` (Id UUID PK, AccountId UUID FK, PropertyId UUID FK, CategoryId UUID FK, Amount DECIMAL(10,2), Date DATE, Description TEXT, ReceiptId UUID NULL, CreatedByUserId UUID FK, CreatedAt TIMESTAMP, UpdatedAt TIMESTAMP, DeletedAt TIMESTAMP NULL)
   - `Income` (Id UUID PK, AccountId UUID FK, PropertyId UUID FK, Amount DECIMAL(10,2), Date DATE, Source VARCHAR(255), Description TEXT, CreatedByUserId UUID FK, CreatedAt TIMESTAMP, UpdatedAt TIMESTAMP, DeletedAt TIMESTAMP NULL)
   - `Receipts` (Id UUID PK, AccountId UUID FK, PropertyId UUID NULL FK, StorageKey VARCHAR(500), OriginalFileName VARCHAR(255), ContentType VARCHAR(100), FileSizeBytes BIGINT, ExpenseId UUID NULL, CreatedByUserId UUID FK, CreatedAt TIMESTAMP, ProcessedAt TIMESTAMP NULL, DeletedAt TIMESTAMP NULL)
   - `ExpenseCategories` (Id UUID PK, Name VARCHAR(100), ScheduleELine VARCHAR(50), SortOrder INT)

2. **AC2.2**: ExpenseCategories table is seeded with 15 IRS Schedule E line items:
   | Name | Schedule E Line | Sort Order |
   |------|-----------------|------------|
   | Advertising | Line 5 | 1 |
   | Auto and Travel | Line 6 | 2 |
   | Cleaning and Maintenance | Line 7 | 3 |
   | Commissions | Line 8 | 4 |
   | Insurance | Line 9 | 5 |
   | Legal and Professional Fees | Line 10 | 6 |
   | Management Fees | Line 11 | 7 |
   | Mortgage Interest | Line 12 | 8 |
   | Other Interest | Line 13 | 9 |
   | Repairs | Line 14 | 10 |
   | Supplies | Line 15 | 11 |
   | Taxes | Line 16 | 12 |
   | Utilities | Line 17 | 13 |
   | Depreciation | Line 18 | 14 |
   | Other | Line 19 | 15 |

3. **AC2.3**: Global query filters are configured for soft deletes (`WHERE DeletedAt IS NULL`) on all applicable entities (Properties, Expenses, Income, Receipts)

4. **AC2.4**: Global query filters enforce AccountId tenant isolation - all queries automatically filter by the current user's AccountId

5. **AC2.5**: All primary keys use GUIDs (UUID) with `gen_random_uuid()` default in PostgreSQL

6. **AC2.6**: Appropriate indexes are created for frequently queried columns:
   - `IX_Users_AccountId` on Users.AccountId
   - `IX_Users_Email` on Users.Email
   - `IX_Properties_AccountId` on Properties.AccountId
   - `IX_Expenses_AccountId` on Expenses.AccountId
   - `IX_Expenses_PropertyId` on Expenses.PropertyId
   - `IX_Income_AccountId` on Income.AccountId
   - `IX_Income_PropertyId` on Income.PropertyId

## Tasks / Subtasks

- [x] Task 1: Create Domain entities (AC: 2.1, 2.5)
  - [x] Create `Account.cs` entity with Id, Name, CreatedAt properties
  - [x] Create `User.cs` entity with all user properties and Account navigation
  - [x] Create `Property.cs` entity with audit fields and soft delete
  - [x] Create `Expense.cs` entity with all expense properties
  - [x] Create `Income.cs` entity with all income properties
  - [x] Create `Receipt.cs` entity with all receipt properties
  - [x] Create `ExpenseCategory.cs` entity (global, no AccountId)
  - [x] Create base `AuditableEntity` class with CreatedAt, UpdatedAt fields
  - [x] Create `ISoftDeletable` interface with DeletedAt property

- [x] Task 2: Configure EF Core DbContext (AC: 2.1, 2.3, 2.4)
  - [x] Create `AppDbContext.cs` in Infrastructure/Persistence
  - [x] Add DbSet properties for all entities
  - [x] Configure connection string from environment variables
  - [x] Implement `ICurrentUser` interface for tenant context
  - [x] Configure global query filter for soft deletes
  - [x] Configure global query filter for AccountId tenant isolation

- [x] Task 3: Create EF Core entity configurations (AC: 2.1, 2.5, 2.6)
  - [x] Create `AccountConfiguration.cs` with table name and column mappings
  - [x] Create `UserConfiguration.cs` with email unique constraint
  - [x] Create `PropertyConfiguration.cs` with indexes and FK relationships
  - [x] Create `ExpenseConfiguration.cs` with decimal precision and indexes
  - [x] Create `IncomeConfiguration.cs` with decimal precision and indexes
  - [x] Create `ReceiptConfiguration.cs` with nullable FK configurations
  - [x] Create `ExpenseCategoryConfiguration.cs` for global category table

- [x] Task 4: Create seed data for ExpenseCategories (AC: 2.2)
  - [x] Create `ExpenseCategorySeeder.cs` with 15 IRS Schedule E categories
  - [x] Configure seeder to run on migration (via HasData)
  - [x] Verify all 15 categories are inserted with correct Line numbers

- [x] Task 5: Create and run initial migration (AC: 2.1)
  - [x] Install EF Core tools if not present: `dotnet tool install --global dotnet-ef`
  - [x] Create initial migration: `dotnet ef migrations add InitialCreate`
  - [x] Review generated migration SQL for correctness
  - [x] Apply migration: `dotnet ef database update`
  - [x] Verify all tables created in PostgreSQL

- [x] Task 6: Add integration tests for database operations (AC: 2.1-2.6)
  - [x] Create `PropertyManager.Infrastructure.Tests` project
  - [x] Add Testcontainers.PostgreSql package for test database
  - [x] Create test for migration applies successfully
  - [x] Create test for ExpenseCategories seeded with 15 rows
  - [x] Create test for soft delete filter excludes deleted records
  - [x] Create test for AccountId filter enforces tenant isolation

- [x] Task 7: Verification and documentation
  - [x] Verify `dotnet ef database update` succeeds on fresh database
  - [x] Query PostgreSQL to confirm all tables exist with correct schema
  - [x] Query ExpenseCategories to confirm 15 seed records

## Dev Notes

### Architecture Patterns and Constraints

This story establishes the data persistence foundation per the Architecture document "Data Architecture" section.

**Technology Stack:**
- .NET 10 with EF Core 10 (verified in *.csproj files: `<TargetFramework>net10.0</TargetFramework>`)
- Npgsql.EntityFrameworkCore.PostgreSQL for PostgreSQL provider
- PostgreSQL 16 running via Docker Compose

**Entity Relationship Model:**
```
Account (tenant boundary)
├── Users (1:many)
│   └── Role: Owner | Contributor
├── Properties (1:many)
│   ├── Expenses (1:many)
│   │   └── Receipt (1:1 optional)
│   └── Income (1:many)
└── Receipts (1:many, can be unassigned)

ExpenseCategories (global, no AccountId)
```

**Multi-Tenancy Strategy:**
- Shared database with AccountId column on all tenant data
- EF Core global query filters automatically add `WHERE AccountId = @currentAccountId`
- Current user's AccountId derived from JWT claims via `ICurrentUser` service

**Soft Delete Implementation:**
- `DeletedAt` nullable timestamp on all deletable entities
- Global query filter: `WHERE DeletedAt IS NULL`
- Cascade soft-delete from Property to Expenses/Income (handled by application layer)

**Audit Fields:**
- `CreatedAt` set on insert (UTC timestamp)
- `UpdatedAt` set on every update (UTC timestamp)
- Override `SaveChangesAsync` to auto-populate these fields

### Project Structure Notes

Files to create per Architecture document:

```
backend/src/PropertyManager.Domain/
├── Entities/
│   ├── Account.cs
│   ├── User.cs
│   ├── Property.cs
│   ├── Expense.cs
│   ├── Income.cs
│   ├── Receipt.cs
│   └── ExpenseCategory.cs
├── Common/
│   ├── AuditableEntity.cs
│   └── ISoftDeletable.cs
└── Interfaces/
    └── IRepository.cs (placeholder for future)

backend/src/PropertyManager.Infrastructure/
├── Persistence/
│   ├── AppDbContext.cs
│   ├── Configurations/
│   │   ├── AccountConfiguration.cs
│   │   ├── UserConfiguration.cs
│   │   ├── PropertyConfiguration.cs
│   │   ├── ExpenseConfiguration.cs
│   │   ├── IncomeConfiguration.cs
│   │   ├── ReceiptConfiguration.cs
│   │   └── ExpenseCategoryConfiguration.cs
│   └── Migrations/
│       └── (generated by EF Core)
└── DependencyInjection.cs
```

### Learnings from Previous Story

**From Story 1-1-project-infrastructure-setup (Status: done)**

- **Project Structure**: Clean Architecture folders already exist with .gitkeep placeholders - replace with actual files
- **EF Core Package**: Npgsql.EntityFrameworkCore.PostgreSQL already added to Infrastructure project
- **Docker Postgres**: PostgreSQL 16 running on port 5432, verified accessible
- **Vitest Configured**: Frontend testing with Vitest is working (2 tests passing)

[Source: docs/sprint-artifacts/1-1-project-infrastructure-setup.md#Dev-Agent-Record]

### Testing Strategy

**Integration Tests with Testcontainers:**
- Spin up real PostgreSQL container for each test run
- Verify migrations apply cleanly
- Test query filters work correctly
- Test seed data inserted

**Test Examples:**
```csharp
[Fact]
public async Task Migration_CreatesAllTables()
{
    // Verify all 7 tables exist after migration
}

[Fact]
public async Task ExpenseCategories_SeededWith15Records()
{
    var count = await _dbContext.ExpenseCategories.CountAsync();
    count.Should().Be(15);
}

[Fact]
public async Task SoftDeleteFilter_ExcludesDeletedRecords()
{
    // Create property, soft delete it, verify it's excluded from queries
}

[Fact]
public async Task AccountIdFilter_EnforcesIsolation()
{
    // Create data for two accounts, verify each only sees their own
}
```

### References

- [Source: docs/architecture.md#Data Architecture] - Entity relationship and table definitions
- [Source: docs/architecture.md#Core Tables] - SQL schema for all tables
- [Source: docs/architecture.md#Multi-Tenancy] - AccountId filtering strategy
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC2: Database Schema] - Acceptance criteria source
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Data Models and Contracts] - Entity C# definitions
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Seed Data - Expense Categories] - IRS Schedule E categories
- [Source: docs/epics.md#Story 1.2] - Epic-level story definition and prerequisites

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/1-2-database-schema-and-ef-core-setup.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No issues encountered during implementation

### Completion Notes List

- All 7 database tables created with correct column types and relationships
- 15 IRS Schedule E expense categories seeded via EF Core HasData
- Global query filters implemented for soft delete (DeletedAt == null)
- Global query filters implemented for AccountId tenant isolation
- All primary keys use UUIDs with gen_random_uuid() default
- All required indexes created (verified via psql)
- 14 integration tests passing using Testcontainers.PostgreSql

### File List

**Domain Layer:**
- backend/src/PropertyManager.Domain/Common/AuditableEntity.cs
- backend/src/PropertyManager.Domain/Common/ISoftDeletable.cs
- backend/src/PropertyManager.Domain/Common/ITenantEntity.cs
- backend/src/PropertyManager.Domain/Entities/Account.cs
- backend/src/PropertyManager.Domain/Entities/User.cs
- backend/src/PropertyManager.Domain/Entities/Property.cs
- backend/src/PropertyManager.Domain/Entities/Expense.cs
- backend/src/PropertyManager.Domain/Entities/Income.cs
- backend/src/PropertyManager.Domain/Entities/Receipt.cs
- backend/src/PropertyManager.Domain/Entities/ExpenseCategory.cs

**Application Layer:**
- backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs

**Infrastructure Layer:**
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs
- backend/src/PropertyManager.Infrastructure/Persistence/ExpenseCategorySeeder.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/AccountConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/UserConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/PropertyConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ExpenseConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/IncomeConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ReceiptConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ExpenseCategoryConfiguration.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20251129215839_InitialCreate.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20251129215839_InitialCreate.Designer.cs
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs

**API Layer (modified):**
- backend/src/PropertyManager.Api/Program.cs (added DbContext registration)
- backend/src/PropertyManager.Api/PropertyManager.Api.csproj (added EF Core Design package)

**Tests:**
- backend/tests/PropertyManager.Infrastructure.Tests/PropertyManager.Infrastructure.Tests.csproj
- backend/tests/PropertyManager.Infrastructure.Tests/DatabaseFixture.cs
- backend/tests/PropertyManager.Infrastructure.Tests/DatabaseSchemaTests.cs
- backend/tests/PropertyManager.Infrastructure.Tests/ExpenseCategorySeedTests.cs
- backend/tests/PropertyManager.Infrastructure.Tests/SoftDeleteFilterTests.cs
- backend/tests/PropertyManager.Infrastructure.Tests/TenantIsolationTests.cs

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-29 | Initial story draft created | SM Agent |
| 2025-11-29 | Implemented database schema, migrations, and tests | Dev Agent (Claude Opus 4.5) |
