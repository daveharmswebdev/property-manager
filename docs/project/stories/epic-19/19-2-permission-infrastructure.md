# Story 19.2: Permission Infrastructure

Status: done

## Story

As a developer,
I want a permission system that maps roles to granular permissions,
so that handlers and controllers can enforce role-based access.

## Acceptance Criteria

1. **Given** the permission constants are defined
   **When** I check `RolePermissions.Mappings["Owner"]`
   **Then** it contains all permissions (full CRUD on all entities)

2. **Given** the permission constants are defined
   **When** I check `RolePermissions.Mappings["Contributor"]`
   **Then** it contains only: `Properties.ViewList`, `Receipts.ViewAll`, `Receipts.Create`, `WorkOrders.View`, `WorkOrders.EditStatus`, `WorkOrders.AddNotes`

3. **Given** I inject `IPermissionService`
   **When** I call `HasPermission("Expenses.View")` as an Owner
   **Then** it returns true

4. **Given** I inject `IPermissionService`
   **When** I call `HasPermission("Expenses.View")` as a Contributor
   **Then** it returns false

5. **Given** I call `IsOwner()` or `IsContributor()`
   **When** the current user has role "Owner" or "Contributor" respectively
   **Then** the method returns true

## Tasks / Subtasks

- [x] Task 1: Create Permission Constants (AC: #1, #2)
  - [x] 1.1 Create `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` — static class with nested static classes for each entity (Properties, Expenses, Income, Receipts, WorkOrders, Vendors, Reports, Account, Users)
  - [x] 1.2 Define granular permission constants per entity (View, ViewList, Create, Edit, Delete, plus entity-specific like `Receipts.Process`, `WorkOrders.EditStatus`, `WorkOrders.AddNotes`)

- [x] Task 2: Create Role-Permission Mapping (AC: #1, #2)
  - [x] 2.1 Create `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` — static class with `IReadOnlyDictionary<string, HashSet<string>> Mappings`
  - [x] 2.2 Owner mapping: all permissions (full CRUD on all entities)
  - [x] 2.3 Contributor mapping: `Properties.ViewList`, `Receipts.ViewAll`, `Receipts.Create`, `WorkOrders.View`, `WorkOrders.EditStatus`, `WorkOrders.AddNotes`

- [x] Task 3: Create IPermissionService Interface (AC: #3, #4, #5)
  - [x] 3.1 Create `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs`
  - [x] 3.2 Define methods: `bool HasPermission(string permission)`, `bool IsOwner()`, `bool IsContributor()`

- [x] Task 4: Implement PermissionService (AC: #3, #4, #5)
  - [x] 4.1 Create `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs`
  - [x] 4.2 Inject `ICurrentUser`, look up role in `RolePermissions.Mappings`, check if permission exists in the set
  - [x] 4.3 Implement `IsOwner()` and `IsContributor()` using `_currentUser.Role`

- [x] Task 5: Register PermissionService in DI Container (AC: #3, #4, #5)
  - [x] 5.1 Add `builder.Services.AddScoped<IPermissionService, PermissionService>();` to `backend/src/PropertyManager.Api/Program.cs` (alongside other Identity service registrations near line 64)

- [x] Task 6: Create ForbiddenAccessException (AC: —, prerequisite for Story 19.3)
  - [x] 6.1 Create `backend/src/PropertyManager.Domain/Exceptions/ForbiddenAccessException.cs` — follows same pattern as `NotFoundException`
  - [x] 6.2 Update `GlobalExceptionHandlerMiddleware` to map `ForbiddenAccessException` to 403 (currently only maps `UnauthorizedAccessException`)

- [x] Task 7: Unit Tests for PermissionService (AC: #1, #2, #3, #4, #5)
  - [x] 7.1 Create `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs`
  - [x] 7.2 Test: `HasPermission_OwnerWithExpensesView_ReturnsTrue` (AC: #3)
  - [x] 7.3 Test: `HasPermission_ContributorWithExpensesView_ReturnsFalse` (AC: #4)
  - [x] 7.4 Test: `HasPermission_OwnerWithAllPermissions_ReturnsTrue` — verify Owner mapping is comprehensive
  - [x] 7.5 Test: `HasPermission_ContributorWithPropertiesViewList_ReturnsTrue` — verify Contributor allowed permissions
  - [x] 7.6 Test: `HasPermission_ContributorWithPropertiesCreate_ReturnsFalse` — verify Contributor denied permissions
  - [x] 7.7 Test: `HasPermission_ContributorWithReceiptsViewAll_ReturnsTrue`
  - [x] 7.8 Test: `HasPermission_ContributorWithReceiptsProcess_ReturnsFalse`
  - [x] 7.9 Test: `HasPermission_ContributorWithWorkOrdersView_ReturnsTrue`
  - [x] 7.10 Test: `HasPermission_ContributorWithWorkOrdersCreate_ReturnsFalse`
  - [x] 7.11 Test: `IsOwner_WhenRoleIsOwner_ReturnsTrue` (AC: #5)
  - [x] 7.12 Test: `IsOwner_WhenRoleIsContributor_ReturnsFalse` (AC: #5)
  - [x] 7.13 Test: `IsContributor_WhenRoleIsContributor_ReturnsTrue` (AC: #5)
  - [x] 7.14 Test: `IsContributor_WhenRoleIsOwner_ReturnsFalse` (AC: #5)
  - [x] 7.15 Test: `HasPermission_UnknownRole_ReturnsFalse` — edge case for invalid role string
  - [x] 7.16 Test: `HasPermission_EmptyPermission_ReturnsFalse` — edge case

- [x] Task 8: Unit Tests for RolePermissions Mapping Integrity (AC: #1, #2)
  - [x] 8.1 Create `backend/tests/PropertyManager.Application.Tests/Common/RolePermissionsTests.cs`
  - [x] 8.2 Test: `OwnerMapping_ContainsAllPermissions` — verify Owner has every permission constant defined in `Permissions` class
  - [x] 8.3 Test: `ContributorMapping_ContainsExactlyExpectedPermissions` — verify Contributor has exactly the 6 allowed permissions, no more
  - [x] 8.4 Test: `AllMappedPermissions_ExistInPermissionsClass` — verify no typos in mapping (every mapped string appears as a constant)

## Dev Notes

### Architecture Patterns

**This is a backend-only, infrastructure-focused story.** No frontend changes, no database migrations, no API endpoint changes. Pure code: constants, interface, implementation, DI registration, tests.

**Backend Clean Architecture — Dependencies point inward:**
- `Permissions.cs` and `RolePermissions.cs` go in **Domain** (`PropertyManager.Domain/Authorization/`) — they are value-like static definitions with zero dependencies
- `IPermissionService.cs` goes in **Application** (`PropertyManager.Application/Common/Interfaces/`) — alongside `ICurrentUser.cs`
- `PermissionService.cs` goes in **Infrastructure** (`PropertyManager.Infrastructure/Identity/`) — alongside `CurrentUserService.cs`, depends on `ICurrentUser`
- DI registration in **Api** (`Program.cs`) — alongside other Identity service registrations

**File-scoped namespaces:** All C# files use `namespace X;` (not `namespace X { }`)

**No repository pattern:** This story doesn't touch the database. `PermissionService` only needs `ICurrentUser` (not `IAppDbContext`).

### Permission Constants Design

The `Permissions` class uses nested static classes for organization:

```
Permissions.Properties.View
Permissions.Properties.ViewList
Permissions.Properties.Create
Permissions.Properties.Edit
Permissions.Properties.Delete
Permissions.Expenses.View / Create / Edit / Delete
Permissions.Income.View / Create / Edit / Delete
Permissions.Receipts.ViewAll / Create / Edit / Delete / Process
Permissions.WorkOrders.View / Create / Edit / EditStatus / AddNotes / Delete
Permissions.Vendors.View / Create / Edit / Delete
Permissions.Reports.View / Generate
Permissions.Account.View / Edit
Permissions.Users.View / Invite / EditRole / Remove
```

### Role-Permission Mapping Design

Use `IReadOnlyDictionary<string, HashSet<string>>` (not `Dictionary<string, string[]>`) for O(1) permission lookup via `HashSet.Contains()`. The RBAC plan shows `string[]` but `HashSet<string>` is more correct for membership checks.

**Owner:** Gets ALL permissions.

**Contributor:** Gets exactly these 6:
- `Properties.ViewList` — for dropdowns when uploading receipts
- `Receipts.ViewAll` — view all receipts for team transparency (per RBAC plan Section 5.2.1)
- `Receipts.Create` — upload receipts
- `WorkOrders.View` — view work order details
- `WorkOrders.EditStatus` — change work order status
- `WorkOrders.AddNotes` — add notes to work orders

### ForbiddenAccessException

The global exception handler middleware already maps `UnauthorizedAccessException` to 403. However, `UnauthorizedAccessException` is a .NET system exception — it's better practice to create a domain-specific `ForbiddenAccessException` (following the same pattern as `NotFoundException`) so that:
1. The exception type clearly communicates "permission denied" vs "not authenticated"
2. Story 19.3 (Backend Permission Enforcement) can throw `ForbiddenAccessException` from handlers
3. The middleware maps it to 403 with proper ProblemDetails

Pattern to follow from `NotFoundException`:
```csharp
namespace PropertyManager.Domain.Exceptions;

public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException() : base() { }
    public ForbiddenAccessException(string message) : base(message) { }
    public ForbiddenAccessException(string message, Exception innerException) : base(message, innerException) { }
}
```

Update `GlobalExceptionHandlerMiddleware.GetErrorDetails()` to add a case for `ForbiddenAccessException` before the existing `UnauthorizedAccessException` case (both map to 403).

### DI Registration

Add to `Program.cs` near line 64 (alongside other Identity registrations):
```csharp
builder.Services.AddScoped<IPermissionService, PermissionService>();
```

### Testing Approach

**Unit tests only** — this story is pure infrastructure code with no API endpoints or database interaction.

**Test class location:** `backend/tests/PropertyManager.Application.Tests/Common/` — since `IPermissionService` lives in `Application/Common/Interfaces/`, tests go in the Common test folder.

**Test setup pattern (from CreateInvitationTests):**
- Constructor setup, no `[SetUp]` attribute
- `Mock<ICurrentUser>` to control role
- Direct instantiation of `PermissionService` (it only needs `ICurrentUser`)
- FluentAssertions for all assertions: `.Should().BeTrue()`, `.Should().BeFalse()`

**RolePermissions integrity tests use reflection** to enumerate all permission constants from the `Permissions` class and verify the Owner mapping contains them all. This prevents future permission additions from being missed in the Owner mapping.

### Previous Story Intelligence

From Story 19.1:
- **Testing pyramid enforced:** Unit + integration + E2E required for full-stack stories. This story is backend-only infrastructure, so unit tests are sufficient.
- **Validators in separate files:** Story 19.1 review found validators co-located with handlers — had to extract them. Not relevant here (no validators).
- **NSwag requires .NET 9:** Cannot auto-generate API client. Not relevant here (no API changes).
- **ICurrentUser already has `Role` property:** Confirmed in `CurrentUserService.cs` — reads from JWT `role` claim. This is the foundation `PermissionService` builds on.
- **`[Authorize(Roles = "Owner")]` already used** on `InvitationsController` — this is the only existing permission enforcement. Story 19.2 builds the infrastructure; Story 19.3 will apply it broadly.

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.2 requirements and ACs |
| `docs/project/archive/multi-user-rbac-refactor-plan.md` | Sections 5.1.1–5.1.5: permission constants, role mapping, service interface and implementation |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs` | Interface with UserId, AccountId, Role, IsAuthenticated |
| `backend/src/PropertyManager.Infrastructure/Identity/CurrentUserService.cs` | Implementation reading from JWT claims |
| `backend/src/PropertyManager.Domain/Exceptions/NotFoundException.cs` | Pattern for ForbiddenAccessException |
| `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` | Exception-to-status-code mapping (add ForbiddenAccessException) |
| `backend/src/PropertyManager.Api/Program.cs` | DI registration (line ~64 for Identity services) |
| `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` | Test setup pattern with Mock<ICurrentUser> |
| ASP.NET Core 10 Authorization Policies docs | `RequireAssertion` pattern verified via Ref MCP |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None — clean implementation with no errors.

### Completion Notes List
- All 8 tasks implemented in a single pass with TDD (RED-GREEN-REFACTOR)
- Tests written before PermissionService implementation; confirmed compile failure (RED), then implemented (GREEN)
- Added Infrastructure project reference to Application.Tests csproj to allow direct PermissionService instantiation
- 18 new unit tests, all passing. Full suite: 1,654 tests, 0 failures.
- ForbiddenAccessException added before UnauthorizedAccessException in middleware switch expression

### File List
- **New:** `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` — Permission constants (9 entity groups, 33 permissions)
- **New:** `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` — Role-to-permission mappings (Owner: all, Contributor: 6)
- **New:** `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs` — Service interface
- **New:** `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs` — Service implementation
- **New:** `backend/src/PropertyManager.Domain/Exceptions/ForbiddenAccessException.cs` — Domain exception for 403
- **New:** `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs` — 15 unit tests
- **New:** `backend/tests/PropertyManager.Application.Tests/Common/RolePermissionsTests.cs` — 3 integrity tests
- **Modified:** `backend/src/PropertyManager.Api/Program.cs` — Added IPermissionService DI registration
- **Modified:** `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` — Added ForbiddenAccessException mapping
- **Modified:** `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj` — Added Infrastructure project reference
