# Story 10.1: Polymorphic Notes Entity

Status: done

## Story

As a **developer**,
I want **a polymorphic notes table that can attach to any entity**,
So that **notes can be reused for work orders now and other entities in the future**.

## Acceptance Criteria

### AC #1: Notes Table Schema

**Given** the database migration runs
**When** I check the database schema
**Then** a `Notes` table exists with columns:
- Id (UUID, PK, default gen_random_uuid())
- AccountId (UUID, FK to Accounts, NOT NULL)
- EntityType (VARCHAR 50, NOT NULL) - e.g., 'WorkOrder', 'Vendor', 'Property'
- EntityId (UUID, NOT NULL) - the ID of the related entity
- Content (TEXT, NOT NULL)
- CreatedByUserId (UUID, FK to Users, NOT NULL)
- CreatedAt (TIMESTAMP, NOT NULL)
- UpdatedAt (TIMESTAMP, NOT NULL)
- DeletedAt (TIMESTAMP, nullable - for soft delete)

### AC #2: Database Indexes

**Given** the Notes table exists
**When** I check the indexes
**Then** an index exists on (EntityType, EntityId) for efficient lookups
**And** an index exists on AccountId for tenant filtering
**And** a composite index exists on (AccountId, EntityType, EntityId) for common query patterns

### AC #3: EF Core Configuration

**Given** the EF Core entity is configured
**When** I check the configuration
**Then** global query filter enforces AccountId tenant isolation
**And** global query filter excludes soft-deleted notes (WHERE DeletedAt IS NULL)
**And** the EntityType is stored as string (not enum ordinal)

### AC #4: API Endpoint - Get Notes for Entity

**Given** the API is running
**When** I call `GET /api/v1/notes?entityType=WorkOrder&entityId={workOrderId}`
**Then** I receive notes filtered by EntityType and EntityId
**And** response format is `{ items: NoteDto[], totalCount: number }`
**And** notes are sorted by CreatedAt DESC (newest first)
**And** each note includes: id, content, createdByUserId, createdByUserName, createdAt

### AC #5: API Endpoint - Create Note

**Given** the API is running
**When** I call `POST /api/v1/notes` with body:
```json
{
  "entityType": "WorkOrder",
  "entityId": "guid-of-work-order",
  "content": "Called vendor, they will arrive tomorrow."
}
```
**Then** the note is created with my AccountId and UserId
**And** CreatedAt and UpdatedAt are set to current timestamp
**And** response is `{ id: "guid-of-new-note" }` with 201 Created
**And** Location header points to the new note

### AC #6: API Endpoint - Delete Note

**Given** a note exists that I created
**When** I call `DELETE /api/v1/notes/{noteId}`
**Then** the note is soft-deleted (DeletedAt timestamp set)
**And** response is 204 No Content
**And** the note no longer appears in GET results

### AC #7: Validation

**Given** I try to create a note with empty content
**When** I submit the request
**Then** I receive 400 Bad Request with validation error "Content is required"

**Given** I try to create a note with invalid EntityType
**When** I submit the request
**Then** I receive 400 Bad Request with validation error "EntityType must be one of: WorkOrder, Vendor, Property"

**Given** I try to delete a note I didn't create (different user in same account)
**When** I submit the request
**Then** I receive 403 Forbidden (or 404 depending on policy - discuss with team)
**Or** deletion is allowed for account owners (policy decision)

### AC #8: Tenant Isolation

**Given** notes exist for different accounts
**When** I query notes as User A
**Then** I only see notes where AccountId matches my account
**And** I cannot access notes from other accounts even with direct ID

## Tasks / Subtasks

> **TDD Approach:** This story follows Test-Driven Development (Red-Green-Refactor).
> For each feature: write failing tests first, then implement minimum code to pass.

---

### Phase 1: Foundation (Required Infrastructure)

#### Task 1: Create Domain Entity & NoteEntityType (AC: #1)

- [x] 1.1 Create `NoteEntityType.cs` in `Domain/`:
  ```csharp
  public static class NoteEntityType
  {
      public const string WorkOrder = "WorkOrder";
      public const string Vendor = "Vendor";
      public const string Property = "Property";

      public static readonly string[] ValidTypes = { WorkOrder, Vendor, Property };

      public static bool IsValid(string type) => ValidTypes.Contains(type);
  }
  ```
- [x] 1.2 Create `Note.cs` in `Domain/Entities/`:
  ```csharp
  public class Note : AuditableEntity, ITenantEntity, ISoftDeletable
  {
      public Guid AccountId { get; set; }
      public string EntityType { get; set; } = string.Empty;
      public Guid EntityId { get; set; }
      public string Content { get; set; } = string.Empty;
      public Guid CreatedByUserId { get; set; }
      public DateTime? DeletedAt { get; set; }

      // Navigation properties
      public Account Account { get; set; } = null!;
      public User CreatedByUser { get; set; } = null!;
  }
  ```

#### Task 2: Create Database Migration & EF Core Config (AC: #1, #2, #3)

- [x] 2.1 Create `NoteConfiguration.cs` in `Infrastructure/Persistence/Configurations/`
- [x] 2.2 Add `DbSet<Note> Notes { get; set; }` to `AppDbContext.cs`
- [x] 2.3 Create migration: `dotnet ef migrations add AddNotesTable --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- [x] 2.4 Run migration and verify schema: indexes on (EntityType, EntityId), (AccountId), (AccountId, EntityType, EntityId)

#### Task 3: Create DTOs (AC: #4, #5)

- [x] 3.1 Create `NoteDto.cs` in `Application/Notes/`:
  ```csharp
  public record NoteDto(
      Guid Id,
      string EntityType,
      Guid EntityId,
      string Content,
      Guid CreatedByUserId,
      string CreatedByUserName,
      DateTime CreatedAt
  );
  ```
- [x] 3.2 Create `CreateNoteRequest.cs` in `Api/Contracts/Notes/`

---

### Phase 2: TDD Cycle - CreateNote Command

#### Task 4: RED - Write Failing CreateNote Tests (AC: #5, #7)

- [x] 4.1 Create `CreateNoteCommandHandlerTests.cs` in `Application.Tests/Notes/`:
  ```csharp
  [Fact]
  public async Task Handle_ValidCommand_CreatesNoteWithCorrectAccountId()

  [Fact]
  public async Task Handle_ValidCommand_SetsCreatedByUserId()

  [Fact]
  public async Task Handle_ValidCommand_SetsTimestamps()

  [Fact]
  public async Task Handle_ValidCommand_ReturnsNewNoteId()
  ```
- [x] 4.2 Create `CreateNoteCommandValidatorTests.cs`:
  ```csharp
  [Fact]
  public async Task Validate_EmptyContent_ReturnsError()

  [Fact]
  public async Task Validate_InvalidEntityType_ReturnsError()

  [Fact]
  public async Task Validate_ValidCommand_PassesValidation()
  ```
- [x] 4.3 **Run tests - verify they FAIL** (Red phase)

#### Task 5: GREEN - Implement CreateNote Command (AC: #5, #7)

- [x] 5.1 Create `CreateNote.cs` in `Application/Notes/`:
  - `CreateNoteCommand` record
  - `CreateNoteCommandValidator` with FluentValidation rules
  - `CreateNoteCommandHandler` implementation
- [x] 5.2 **Run tests - verify they PASS** (Green phase)
- [x] 5.3 **Refactor** if needed while keeping tests green

---

### Phase 3: TDD Cycle - GetNotes Query

#### Task 6: RED - Write Failing GetNotes Tests (AC: #4, #8)

- [x] 6.1 Create `GetNotesQueryHandlerTests.cs` in `Application.Tests/Notes/`:
  ```csharp
  [Fact]
  public async Task Handle_NotesExist_ReturnsNotesForEntity()

  [Fact]
  public async Task Handle_NoNotes_ReturnsEmptyList()

  [Fact]
  public async Task Handle_DifferentAccount_ReturnsEmpty_TenantIsolation()

  [Fact]
  public async Task Handle_MultipleNotes_OrdersByCreatedAtDesc()

  [Fact]
  public async Task Handle_SoftDeletedNotes_ExcludesFromResults()

  [Fact]
  public async Task Handle_IncludesCreatedByUserName()
  ```
- [x] 6.2 **Run tests - verify they FAIL** (Red phase)

#### Task 7: GREEN - Implement GetNotes Query (AC: #4, #8)

- [x] 7.1 Create `GetNotes.cs` in `Application/Notes/`:
  - `GetNotesQuery` record
  - `GetNotesResult` record
  - `GetNotesQueryHandler` implementation
- [x] 7.2 **Run tests - verify they PASS** (Green phase)
- [x] 7.3 **Refactor** if needed while keeping tests green

---

### Phase 4: TDD Cycle - DeleteNote Command

#### Task 8: RED - Write Failing DeleteNote Tests (AC: #6, #7)

- [x] 8.1 Create `DeleteNoteCommandHandlerTests.cs` in `Application.Tests/Notes/`:
  ```csharp
  [Fact]
  public async Task Handle_ExistingNote_SoftDeletes()

  [Fact]
  public async Task Handle_NonExistentNote_ThrowsNotFoundException()

  [Fact]
  public async Task Handle_DifferentAccount_ThrowsNotFoundException_TenantIsolation()

  [Fact]
  public async Task Handle_SetsDeletedAtTimestamp()
  ```
- [x] 8.2 **Run tests - verify they FAIL** (Red phase)

#### Task 9: GREEN - Implement DeleteNote Command (AC: #6, #7)

- [x] 9.1 Create `DeleteNote.cs` in `Application/Notes/`:
  - `DeleteNoteCommand` record
  - `DeleteNoteCommandHandler` implementation
- [x] 9.2 **Run tests - verify they PASS** (Green phase)
- [x] 9.3 **Refactor** if needed while keeping tests green

---

### Phase 5: TDD Cycle - API Controller

#### Task 10: RED - Write Failing Integration Tests (AC: #4, #5, #6)

- [x] 10.1 Create `NotesControllerTests.cs` in `Api.Tests/Controllers/`:
  ```csharp
  [Fact]
  public async Task GetNotes_ReturnsNotesForEntity()

  [Fact]
  public async Task GetNotes_ReturnsEmptyForNoNotes()

  [Fact]
  public async Task GetNotes_Unauthorized_Returns401()

  [Fact]
  public async Task CreateNote_ValidRequest_Returns201WithId()

  [Fact]
  public async Task CreateNote_EmptyContent_Returns400()

  [Fact]
  public async Task CreateNote_InvalidEntityType_Returns400()

  [Fact]
  public async Task DeleteNote_ExistingNote_Returns204()

  [Fact]
  public async Task DeleteNote_NonExistent_Returns404()

  [Fact]
  public async Task CrossAccountAccess_IsBlocked()
  ```
- [x] 10.2 **Run tests - verify they FAIL** (Red phase)

#### Task 11: GREEN - Implement NotesController (AC: #4, #5, #6)

- [x] 11.1 Create `NotesController.cs` in `Api/Controllers/`:
  ```csharp
  [ApiController]
  [Route("api/v1/notes")]
  [Authorize]
  public class NotesController : ControllerBase
  {
      [HttpGet]
      public async Task<IActionResult> GetNotes([FromQuery] string entityType, [FromQuery] Guid entityId, CancellationToken ct)

      [HttpPost]
      public async Task<IActionResult> CreateNote([FromBody] CreateNoteRequest request, CancellationToken ct)

      [HttpDelete("{id:guid}")]
      public async Task<IActionResult> DeleteNote(Guid id, CancellationToken ct)
  }
  ```
- [x] 11.2 **Run tests - verify they PASS** (Green phase)
- [x] 11.3 **Refactor** if needed while keeping tests green

---

### Phase 6: Final Verification

#### Task 12: Full Test Suite & Manual Verification

- [x] 12.1 Run full backend test suite: `dotnet test`
- [x] 12.2 Verify all new tests pass
- [x] 12.3 Manual verification checklist:
  - [x] POST /api/v1/notes creates a note
  - [x] GET /api/v1/notes returns notes for entity
  - [x] DELETE /api/v1/notes/{id} soft deletes
  - [x] Tenant isolation works (can't see other account's notes)
  - [x] Validation returns proper error messages

## Dev Notes

### Architecture Compliance

**Backend Structure:**
```
backend/src/PropertyManager.Domain/
├── Entities/
│   └── Note.cs                    ← NEW
├── NoteEntityType.cs              ← NEW (static class with valid types)

backend/src/PropertyManager.Application/
├── Notes/                         ← NEW folder
│   ├── NoteDto.cs
│   ├── GetNotes.cs               ← Query + Handler
│   ├── CreateNote.cs             ← Command + Validator + Handler
│   └── DeleteNote.cs             ← Command + Handler

backend/src/PropertyManager.Infrastructure/
├── Persistence/
│   ├── AppDbContext.cs           ← MODIFY (add DbSet<Note>)
│   └── Configurations/
│       └── NoteConfiguration.cs  ← NEW

backend/src/PropertyManager.Api/
├── Controllers/
│   └── NotesController.cs        ← NEW
├── Contracts/
│   └── Notes/
│       └── CreateNoteRequest.cs  ← NEW

backend/tests/PropertyManager.Application.Tests/
├── Notes/                        ← NEW folder
│   ├── CreateNoteCommandHandlerTests.cs
│   ├── GetNotesQueryHandlerTests.cs
│   └── DeleteNoteCommandHandlerTests.cs

backend/tests/PropertyManager.Api.Tests/
├── Controllers/
│   └── NotesControllerTests.cs   ← NEW
```

### Polymorphic Pattern Rationale

Using EntityType + EntityId discriminator pattern (per Architecture doc ADR-16):
- **Pros:** Single table, simple queries, extensible to any entity
- **Cons:** No FK constraint to specific entity tables
- **Mitigation:** Application-level validation ensures EntityId exists

This pattern is preferred over:
- Separate tables per entity type (more tables, duplicate logic)
- EF Core owned types (too complex for simple notes)

### EntityType Values

Start with these supported entity types:
- `WorkOrder` - Primary use case for Epic 10
- `Vendor` - Future use (vendor communication notes)
- `Property` - Future use (property-level notes)

Add more types by:
1. Add to `NoteEntityType.ValidTypes` array
2. No migration needed (just validation change)

### User Name Resolution

Include `CreatedByUserName` in NoteDto for display:
```csharp
public async Task<GetNotesResult> Handle(GetNotesQuery request, CancellationToken ct)
{
    var notes = await _dbContext.Notes
        .Include(n => n.CreatedByUser)
        .Where(n => n.EntityType == request.EntityType)
        .Where(n => n.EntityId == request.EntityId)
        .OrderByDescending(n => n.CreatedAt)
        .Select(n => new NoteDto(
            n.Id,
            n.EntityType,
            n.EntityId,
            n.Content,
            n.CreatedByUserId,
            n.CreatedByUser.FirstName ?? n.CreatedByUser.Email, // Fallback to email
            n.CreatedAt
        ))
        .ToListAsync(ct);

    return new GetNotesResult(notes, notes.Count);
}
```

### Soft Delete Pattern

Follow existing project pattern:
```csharp
// In DeleteNoteCommandHandler
var note = await _dbContext.Notes
    .FirstOrDefaultAsync(n => n.Id == request.Id, ct)
    ?? throw new NotFoundException(nameof(Note), request.Id);

note.DeletedAt = DateTime.UtcNow;
await _dbContext.SaveChangesAsync(ct);
```

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR47 | Notes system is polymorphic (reusable for future entities) | EntityType discriminator allows notes on any entity type |

### TDD Workflow

This story uses **Test-Driven Development (Red-Green-Refactor)**:

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Foundation                                        │
│  ├── Entity, Migration, EF Config, DTOs                     │
│  └── (Required infrastructure before tests can run)         │
├─────────────────────────────────────────────────────────────┤
│  Phase 2-4: TDD Cycles for Handlers                         │
│  ├── RED:   Write failing unit tests                        │
│  ├── GREEN: Implement minimum code to pass                  │
│  └── REFACTOR: Clean up while tests stay green              │
├─────────────────────────────────────────────────────────────┤
│  Phase 5: TDD Cycle for Controller                          │
│  ├── RED:   Write failing integration tests                 │
│  ├── GREEN: Implement controller                            │
│  └── REFACTOR: Clean up while tests stay green              │
├─────────────────────────────────────────────────────────────┤
│  Phase 6: Final Verification                                │
│  └── Full test suite + manual verification                  │
└─────────────────────────────────────────────────────────────┘
```

**Key TDD Rules:**
1. Never write implementation code without a failing test first
2. Write only enough test code to fail (Red)
3. Write only enough production code to pass (Green)
4. Refactor only when tests are green
5. Run tests after every change

**Test Counts:**
- Unit tests (handlers): ~14 tests across 3 test files
- Integration tests (controller): ~9 tests in 1 test file
- Total: ~23 new tests

### Previous Story Intelligence

From Story 9-11 (Property Work Order History):
- Query patterns with Include() for navigation properties
- Tenant isolation via ICurrentUser.AccountId
- Soft delete pattern with DeletedAt timestamp
- API response format `{ items, totalCount }`
- Test patterns for handlers and controllers

### Git Intelligence

Recent commits show test-focused work:
- `ee3aecd` - Frontend feature component tests
- `a3d7d49` - Frontend auth component tests
- `6a9d7f4` - API integration tests for Photos, Income, VendorTradeTags

Pattern: Comprehensive test coverage is expected. Include both unit tests and API integration tests.

### Project Context Reference

From CLAUDE.md:
- Backend uses MediatR for CQRS, FluentValidation, EF Core with PostgreSQL
- Clean Architecture layers: Domain, Application, Infrastructure, Api
- Test command: `dotnet test`
- Migration command: `dotnet ef migrations add <Name> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`

### References

- [Source: epics-work-orders-vendors.md#Story 3.1] - Polymorphic Notes Entity (lines 1053-1082)
- [Source: architecture.md#Phase 2] - Notes table schema (lines 1124-1134)
- [Source: architecture.md#ADR-16] - Polymorphic Notes pattern
- [Source: 9-11-property-work-order-history.md] - Previous story patterns
- [Source: CLAUDE.md] - Development commands and architecture overview

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no issues

### Completion Notes List

- Implemented polymorphic Notes entity with EntityType discriminator pattern (ADR-16)
- Created Notes table with all required indexes: (EntityType, EntityId), (AccountId), (AccountId, EntityType, EntityId)
- Global query filters for tenant isolation (AccountId) and soft delete (DeletedAt IS NULL)
- TDD approach followed: 48 new tests across unit and integration test suites
- All 1313 backend tests passing (806 Application, 85 Infrastructure, 422 Api)
- Manual verification completed successfully for all API endpoints
- Validation errors return proper messages as per AC #7

### File List

**Domain Layer (NEW):**
- backend/src/PropertyManager.Domain/NoteEntityType.cs
- backend/src/PropertyManager.Domain/Entities/Note.cs

**Infrastructure Layer (NEW/MODIFIED):**
- backend/src/PropertyManager.Infrastructure/Persistence/Configurations/NoteConfiguration.cs (NEW)
- backend/src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs (MODIFIED - added DbSet, query filter)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260129200724_AddNotesTable.cs (NEW)
- backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260129200724_AddNotesTable.Designer.cs (NEW)

**Application Layer (NEW/MODIFIED):**
- backend/src/PropertyManager.Application/Notes/NoteDto.cs (NEW)
- backend/src/PropertyManager.Application/Notes/CreateNote.cs (NEW)
- backend/src/PropertyManager.Application/Notes/GetNotes.cs (NEW)
- backend/src/PropertyManager.Application/Notes/DeleteNote.cs (NEW)
- backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs (MODIFIED - added DbSet<Note>)

**API Layer (NEW):**
- backend/src/PropertyManager.Api/Controllers/NotesController.cs (NEW)
- backend/src/PropertyManager.Api/Contracts/Notes/CreateNoteRequest.cs (NEW)

**Unit Tests (NEW):**
- backend/tests/PropertyManager.Application.Tests/Notes/CreateNoteCommandHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/Notes/CreateNoteCommandValidatorTests.cs
- backend/tests/PropertyManager.Application.Tests/Notes/GetNotesQueryHandlerTests.cs
- backend/tests/PropertyManager.Application.Tests/Notes/DeleteNoteCommandHandlerTests.cs

**Integration Tests (NEW):**
- backend/tests/PropertyManager.Api.Tests/NotesControllerTests.cs
