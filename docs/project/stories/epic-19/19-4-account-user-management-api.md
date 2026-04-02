# Story 19.4: Account User Management API

Status: done

## Story

As an account owner,
I want API endpoints to list, update, and remove users on my account,
so that I can manage who has access and what role they have.

## Acceptance Criteria

1. **Given** I am logged in as an Owner
   **When** I call `GET /api/v1/account/users`
   **Then** I receive a list of all users on my account with: UserId, Email, DisplayName, Role, CreatedAt

2. **Given** I am logged in as an Owner
   **When** I call `PUT /api/v1/account/users/{userId}/role` with `{ "role": "Contributor" }`
   **Then** the user's role is updated to Contributor
   **And** subsequent API calls by that user enforce Contributor permissions

3. **Given** I am logged in as an Owner
   **When** I try to change my own role and I am the last Owner on the account
   **Then** I receive 400 Bad Request with "Cannot remove the last owner from the account"

4. **Given** I am logged in as an Owner
   **When** I call `DELETE /api/v1/account/users/{userId}`
   **Then** the user is removed from the account (disabled)
   **And** that user can no longer log in to this account

5. **Given** I am logged in as a Contributor
   **When** I call any `/api/v1/account/users` endpoint
   **Then** I receive 403 Forbidden

## Tasks / Subtasks

- [x] Task 1: Extend `IIdentityService` with user management methods (AC: #1, #2, #3, #4)
  - [x] 1.1 Add `GetAccountUsersAsync(Guid accountId, CancellationToken)` returning `List<AccountUserDto>` where `AccountUserDto` is defined in Application layer
  - [x] 1.2 Add `UpdateUserRoleAsync(Guid userId, Guid accountId, string newRole, CancellationToken)` returning `(bool Success, string? ErrorMessage)`
  - [x] 1.3 Add `RemoveUserFromAccountAsync(Guid userId, Guid accountId, CancellationToken)` returning `(bool Success, string? ErrorMessage)`
  - [x] 1.4 Add `CountOwnersInAccountAsync(Guid accountId, CancellationToken)` returning `int`

- [x] Task 2: Implement `IIdentityService` extensions in `IdentityService` (AC: #1, #2, #3, #4)
  - [x] 2.1 `GetAccountUsersAsync`: Query `_dbContext.Users.IgnoreQueryFilters().Where(u => u.AccountId == accountId)` — map to `AccountUserDto`
  - [x] 2.2 `UpdateUserRoleAsync`: Find user by Id+AccountId, validate role is "Owner" or "Contributor", update `user.Role`, save
  - [x] 2.3 `RemoveUserFromAccountAsync`: Find user by Id+AccountId, use `_userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue)` to disable login. Alternatively set `user.EmailConfirmed = false` so `ValidateCredentialsAsync` rejects login
  - [x] 2.4 `CountOwnersInAccountAsync`: Count users where `AccountId == accountId && Role == "Owner"` and not locked out

- [x] Task 3: Create `GetAccountUsers` query (AC: #1)
  - [x] 3.1 Create `backend/src/PropertyManager.Application/AccountUsers/GetAccountUsers.cs` with:
    - `GetAccountUsersQuery` record implementing `IRequest<GetAccountUsersResponse>`
    - `GetAccountUsersResponse` record with `IReadOnlyList<AccountUserDto> Items` and `int TotalCount`
    - `AccountUserDto` record with `Guid UserId, string Email, string? DisplayName, string Role, DateTime CreatedAt`
    - `GetAccountUsersQueryHandler` that calls `_identityService.GetAccountUsersAsync(_currentUser.AccountId)`

- [x] Task 4: Create `UpdateUserRole` command (AC: #2, #3)
  - [x] 4.1 Create `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRole.cs` with:
    - `UpdateUserRoleCommand(Guid UserId, string Role)` record implementing `IRequest`
    - `UpdateUserRoleCommandHandler` that:
      - Validates role is "Owner" or "Contributor"
      - If changing to non-Owner, checks `CountOwnersInAccountAsync` > 1 (last-owner guard)
      - Calls `_identityService.UpdateUserRoleAsync(command.UserId, _currentUser.AccountId, command.Role)`
      - Throws `FluentValidation.ValidationException` with "Cannot remove the last owner from the account" if last-owner check fails
  - [x] 4.2 Create `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRoleValidator.cs` with FluentValidation rules:
    - `Role` must not be empty
    - `Role` must be "Owner" or "Contributor"
    - `UserId` must not be empty

- [x] Task 5: Create `RemoveAccountUser` command (AC: #4, #3)
  - [x] 5.1 Create `backend/src/PropertyManager.Application/AccountUsers/RemoveAccountUser.cs` with:
    - `RemoveAccountUserCommand(Guid UserId)` record implementing `IRequest`
    - `RemoveAccountUserCommandHandler` that:
      - Checks if target user is the current user AND last owner (prevent self-removal as last owner)
      - Checks `CountOwnersInAccountAsync` to prevent removing the last owner
      - Calls `_identityService.RemoveUserFromAccountAsync(command.UserId, _currentUser.AccountId)`
      - Throws `NotFoundException` if user not found in account
      - Throws `FluentValidation.ValidationException` if last-owner guard fails

- [x] Task 6: Create `AccountUsersController` (AC: #1, #2, #3, #4, #5)
  - [x] 6.1 Create `backend/src/PropertyManager.Api/Controllers/AccountUsersController.cs`
  - [x] 6.2 Class attributes: `[ApiController]`, `[Route("api/v1/account/users")]`, `[Produces("application/json")]`, `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]`, `[Authorize(Policy = "CanManageUsers")]`
  - [x] 6.3 `GET /` — returns list of account users (200 OK)
  - [x] 6.4 `PUT /{userId:guid}/role` — updates user role (204 No Content)
  - [x] 6.5 `DELETE /{userId:guid}` — removes user from account (204 No Content)
  - [x] 6.6 Define `UpdateUserRoleRequest(string Role)` record at bottom of file
  - [x] 6.7 Add `[ProducesResponseType]` attributes for 200, 204, 400, 401, 403, 404

- [x] Task 7: Unit tests for handlers (AC: #1, #2, #3, #4)
  - [x] 7.1 Create `backend/tests/PropertyManager.Application.Tests/AccountUsers/GetAccountUsersHandlerTests.cs`
    - Test: `Handle_ReturnsUsersFromIdentityService`
  - [x] 7.2 Create `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleHandlerTests.cs`
    - Test: `Handle_ValidRole_CallsIdentityService`
    - Test: `Handle_LastOwnerDemotion_ThrowsValidationException`
    - Test: `Handle_InvalidRole_ThrowsValidationException` (if handler validates beyond FluentValidation)
  - [x] 7.3 Create `backend/tests/PropertyManager.Application.Tests/AccountUsers/RemoveAccountUserHandlerTests.cs`
    - Test: `Handle_ValidUser_CallsRemoveFromAccount`
    - Test: `Handle_LastOwner_ThrowsValidationException`
    - Test: `Handle_UserNotFound_ThrowsNotFoundException`
  - [x] 7.4 Create `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleValidatorTests.cs`
    - Test: `Validate_EmptyRole_Fails`
    - Test: `Validate_InvalidRole_Fails`
    - Test: `Validate_ValidOwnerRole_Passes`
    - Test: `Validate_ValidContributorRole_Passes`
    - Test: `Validate_EmptyUserId_Fails`

- [x] Task 8: Integration tests (AC: #1, #2, #3, #4, #5)
  - [x] 8.1 Create `backend/tests/PropertyManager.Api.Tests/AccountUsersControllerTests.cs`
  - [x] 8.2 Test: `GetAccountUsers_AsOwner_ReturnsUserList` — Owner gets 200 with user list
  - [x] 8.3 Test: `GetAccountUsers_AsContributor_Returns403` — Contributor blocked
  - [x] 8.4 Test: `UpdateUserRole_AsOwner_Returns204` — Owner can change role
  - [x] 8.5 Test: `UpdateUserRole_AsContributor_Returns403` — Contributor blocked
  - [x] 8.6 Test: `UpdateUserRole_LastOwner_Returns400` — Cannot demote last owner
  - [x] 8.7 Test: `RemoveUser_AsOwner_Returns204` — Owner can remove user
  - [x] 8.8 Test: `RemoveUser_AsContributor_Returns403` — Contributor blocked
  - [x] 8.9 Test: `RemoveUser_LastOwner_Returns400` — Cannot remove last owner
  - [x] 8.10 Test: `RemoveUser_RemovedUserCannotLogin` — Verify removed user's login fails
  - [x] 8.11 Test: `UpdateUserRole_RoleChangeEnforced` — After role change, user gets 403 on Owner-only endpoint

- [x] Task 9: Verify all existing tests pass (AC: all)
  - [x] 9.1 Run `dotnet test` — all existing tests plus new tests should pass

## Dev Notes

### Architecture Decisions

**Controller placement:** New `AccountUsersController` at `api/v1/account/users`. This follows the REST convention of nesting users under the account resource. The `[Authorize(Policy = "CanManageUsers")]` policy (already registered in Program.cs from Story 19.3) restricts all endpoints to Owners only.

**User disable strategy for "remove user":** Since `ApplicationUser` uses ASP.NET Core Identity, the cleanest approach for disabling a user is to set `user.EmailConfirmed = false`. The existing `ValidateCredentialsAsync` in `IdentityService` already checks `if (!user.EmailConfirmed) return error`, so this naturally blocks login without needing new logic. An alternative is `UserManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue)`, but that requires lockout to be enabled. The `EmailConfirmed = false` approach is simpler and already proven by the existing auth flow.

**`IIdentityService` extension pattern:** The `ApplicationUser` entity is in the Infrastructure layer, so Application-layer handlers cannot reference it directly. All user operations go through `IIdentityService` — this is the existing pattern used by `CreateInvitationCommandHandler`, `Login`, `ForgotPassword`, etc. New methods follow the same pattern: define in `IIdentityService`, implement in `IdentityService` using `_dbContext.Users` and `_userManager`.

**DTO location:** `AccountUserDto` is defined in the Application layer (in `GetAccountUsers.cs`) alongside the query. It maps from `ApplicationUser` in the Infrastructure layer. This follows the existing pattern where DTOs are co-located with their command/query.

**Last-owner guard:** This is a business rule enforced at the handler level, not the controller level. Both `UpdateUserRole` and `RemoveAccountUser` handlers must check: if the target user is an Owner and after the operation the account would have zero Owners, throw a `ValidationException`. Use `CountOwnersInAccountAsync` which counts non-locked-out Owners.

### Key Files to Create

| File | Purpose |
|------|---------|
| `backend/src/PropertyManager.Application/AccountUsers/GetAccountUsers.cs` | Query + Handler + DTOs |
| `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRole.cs` | Command + Handler |
| `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRoleValidator.cs` | FluentValidation |
| `backend/src/PropertyManager.Application/AccountUsers/RemoveAccountUser.cs` | Command + Handler |
| `backend/src/PropertyManager.Api/Controllers/AccountUsersController.cs` | REST controller |
| `backend/tests/PropertyManager.Application.Tests/AccountUsers/GetAccountUsersHandlerTests.cs` | Unit tests |
| `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleHandlerTests.cs` | Unit tests |
| `backend/tests/PropertyManager.Application.Tests/AccountUsers/RemoveAccountUserHandlerTests.cs` | Unit tests |
| `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleValidatorTests.cs` | Unit tests |
| `backend/tests/PropertyManager.Api.Tests/AccountUsersControllerTests.cs` | Integration tests |

### Key Files to Modify

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` | Add 4 new methods |
| `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs` | Implement 4 new methods |

### Critical Implementation Details

**`IIdentityService` new method signatures:**
```csharp
Task<List<AccountUserDto>> GetAccountUsersAsync(Guid accountId, CancellationToken cancellationToken = default);
Task<(bool Success, string? ErrorMessage)> UpdateUserRoleAsync(Guid userId, Guid accountId, string newRole, CancellationToken cancellationToken = default);
Task<(bool Success, string? ErrorMessage)> RemoveUserFromAccountAsync(Guid userId, Guid accountId, CancellationToken cancellationToken = default);
Task<int> CountOwnersInAccountAsync(Guid accountId, CancellationToken cancellationToken = default);
```

**Note on `AccountUserDto` reference in `IIdentityService`:** Since `AccountUserDto` is in the Application layer and `IIdentityService` is also in the Application layer, this works. The Infrastructure implementation maps from `ApplicationUser` to `AccountUserDto`. This avoids leaking Infrastructure types into Application layer.

**`IgnoreQueryFilters()` required:** `ApplicationUser` is managed via `IdentityDbContext`, not the tenant-filtered `IAppDbContext`. When querying `_dbContext.Users`, use `IgnoreQueryFilters()` and manually filter by `AccountId`. This is the existing pattern in `IdentityService.ValidateCredentialsAsync` and `GetUserDisplayNamesAsync`.

**Controller pattern:** Follow the existing `InvitationsController` pattern:
- Inject `IMediator`, validators, and `ILogger`
- Validators called explicitly before `_mediator.Send()`
- Request/Response records at bottom of file
- No try-catch for domain exceptions (handled by global middleware)
- `[ProducesResponseType]` on all actions

**Policy already registered:** The `"CanManageUsers"` policy is already registered in `Program.cs` (line 173) from Story 19.3. It checks `Permissions.Users.View`. No changes needed to `Program.cs`.

**Roles are NOT Identity Roles:** This project stores roles as a string property on `ApplicationUser.Role`, NOT as ASP.NET Core Identity roles (`_userManager.AddToRoleAsync`). Do NOT use `UserManager.AddToRoleAsync/RemoveFromRoleAsync`. Simply update the `Role` property directly.

**Testing pattern:** Follow `PermissionEnforcementTests.cs` for integration test structure:
- `IClassFixture<PropertyManagerWebApplicationFactory>`
- `CreateOwnerAndContributorInSameAccountAsync()` helper
- `GetAccessTokenAsync()` and `SendWithAuthAsync()` helpers
- FluentAssertions for status code checks

### Previous Story Intelligence

From Story 19.3:
- **`CanManageUsers` policy registered:** Already in Program.cs (line 173), maps to `Permissions.Users.View`
- **Integration test pattern:** `PermissionEnforcementTests.cs` has the `CreateOwnerAndContributorInSameAccountAsync()` helper and auth request helpers — reuse the same pattern
- **Policy-based auth returns 403 automatically:** ASP.NET Core returns 403 for authenticated but unauthorized users. No custom handling needed
- **All existing tests use Owner role by default:** New controller won't break any existing tests

From Story 19.2:
- **`Permissions.Users` constants available:** `View`, `Invite`, `EditRole`, `Remove` — all defined in `Permissions.cs`
- **`RolePermissions` already maps Owner to all `Users.*` permissions** and Contributor to none

From Story 19.1:
- **`CreateTestUserInAccountAsync(accountId, email, password, role)`** — factory helper for creating users in same account
- **`ApplicationUser.Role` is a simple string property** — no Identity role table involved

### Testing Pyramid

- **Unit tests:** Handler logic (last-owner guard, role validation, service delegation), validator rules
- **Integration tests:** WebApplicationFactory + Testcontainers — full request pipeline including auth policy enforcement, database persistence, and login verification after removal
- **No E2E tests:** This is backend-only API. Story 19.7 will add the frontend UI and E2E tests.

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.4 requirements and ACs |
| `docs/project/stories/epic-19/19-3-backend-permission-enforcement.md` | Policy registration, integration test patterns |
| `docs/project/stories/epic-19/19-2-permission-infrastructure.md` | Permission constants, PermissionService |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` | Interface to extend |
| `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs` | Implementation to extend |
| `backend/src/PropertyManager.Infrastructure/Identity/ApplicationUser.cs` | User entity with Role, AccountId, DisplayName, CreatedAt |
| `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` | `Users.View`, `Users.EditRole`, `Users.Remove` constants |
| `backend/src/PropertyManager.Api/Program.cs` | Line 173: `CanManageUsers` policy already registered |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Controller pattern to follow |
| `backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs` | Integration test pattern to follow |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Test factory helpers |
| ASP.NET Core 10 Policy-based authorization docs | `RequireAssertion` pattern verified |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- FluentAssertions v8: `HaveCountGreaterThanOrEqualTo` (not `HaveCountGreaterOrEqualTo`)
- `FluentValidation.ValidationException` vs `PropertyManager.Domain.Exceptions.ValidationException` ambiguity in tests — use fully qualified name
- Removed user login returns 401 (not 400) because `ValidateCredentialsAsync` returns error message → LoginHandler throws `UnauthorizedAccessException` → AuthController returns 401

### Completion Notes List
- All 9 tasks complete with 15 unit tests + 10 integration tests = 25 new tests
- Full test suite: 1698 tests, 0 failures
- `EmailConfirmed = false` strategy used for user removal (matches existing auth flow)
- `GetAccountUsersAsync` filters by `EmailConfirmed == true` to exclude removed users
- Last-owner guard enforced in both `UpdateUserRole` and `RemoveAccountUser` handlers

### File List

**New files:**
- `backend/src/PropertyManager.Application/AccountUsers/GetAccountUsers.cs` — Query + Handler + AccountUserDto + Response
- `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRole.cs` — Command + Handler
- `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRoleValidator.cs` — FluentValidation rules
- `backend/src/PropertyManager.Application/AccountUsers/RemoveAccountUser.cs` — Command + Handler
- `backend/src/PropertyManager.Api/Controllers/AccountUsersController.cs` — REST controller + UpdateUserRoleRequest DTO
- `backend/tests/PropertyManager.Application.Tests/AccountUsers/GetAccountUsersHandlerTests.cs` — 2 unit tests
- `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleHandlerTests.cs` — 4 unit tests
- `backend/tests/PropertyManager.Application.Tests/AccountUsers/RemoveAccountUserHandlerTests.cs` — 4 unit tests
- `backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleValidatorTests.cs` — 5 unit tests
- `backend/tests/PropertyManager.Api.Tests/AccountUsersControllerTests.cs` — 10 integration tests

**Modified files:**
- `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` — Added 4 new methods
- `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs` — Implemented 4 new methods
- `docs/project/sprint-status.yaml` — Updated 19-4 status to in-progress → review
- `docs/project/stories/epic-19/19-4-account-user-management-api.md` — Updated status and task checkboxes

## Evaluation Record

### Verdict: PASS

### Test Results

| Suite | Result |
|-------|--------|
| Backend build | Clean (0 warnings, 0 errors) |
| Frontend build | Clean (1 bundle size warning, non-blocking) |
| Backend tests (xUnit) | 526 passed, 0 failed |
| Frontend tests (Vitest) | 2606 passed, 0 failed |
| Playwright E2E | 3 passed, 0 failed |

### AC Verification

| AC | Status | Evidence |
|----|--------|----------|
| AC #1: GET /api/v1/account/users returns user list | IMPLEMENTED | Handler queries via IIdentityService, integration test `GetAccountUsers_AsOwner_ReturnsUserList` passes |
| AC #2: PUT /api/v1/account/users/{userId}/role updates role | IMPLEMENTED | Handler + validator + integration test `UpdateUserRole_AsOwner_Returns204` passes |
| AC #3: Last-owner guard returns 400 | IMPLEMENTED | Both UpdateUserRole and RemoveAccountUser handlers enforce guard, integration tests `UpdateUserRole_LastOwner_Returns400` and `RemoveUser_LastOwner_Returns400` pass |
| AC #4: DELETE /api/v1/account/users/{userId} disables user | IMPLEMENTED | Handler sets EmailConfirmed=false, integration test `RemoveUser_RemovedUserCannotLogin` verifies login fails post-removal |
| AC #5: Contributor gets 403 on all endpoints | IMPLEMENTED | CanManageUsers policy on controller, integration tests for GET/PUT/DELETE all verify 403 |

### Grading

| Dimension | Weight | Grade | Notes |
|-----------|--------|-------|-------|
| Functional Completeness | CRITICAL | A | All 5 ACs verified with passing integration tests |
| Regression Safety | CRITICAL | A | All 526 backend + 2606 frontend + 3 E2E tests pass |
| Test Quality | HIGH | A | 15 unit tests + 10 integration tests covering happy paths, error paths, last-owner guard, role enforcement after change, login blocked after removal |
| Code Quality | MEDIUM | A- | Clean architecture followed, minor findings below |

### Findings

1. **MEDIUM — Performance: Double query in handlers.** `UpdateUserRoleCommandHandler` and `RemoveAccountUserCommandHandler` both call `GetAccountUsersAsync` (fetches ALL users) to check if the target user is an Owner, then separately call `CountOwnersInAccountAsync`. A single targeted query (e.g., `GetUserRoleAsync(userId, accountId)`) would be more efficient. Not a problem at current scale but worth noting for future optimization.

2. **LOW — Inconsistent error handling pattern.** `AccountUsersController` validates explicitly with `_updateRoleValidator` but does not try-catch `FluentValidation.ValidationException` from the handler's last-owner guard. Instead relies on global middleware. `InvitationsController` uses explicit try-catch. Both work correctly, but the approaches are mixed.

3. **LOW — No FluentValidator for RemoveAccountUserCommand.** `UpdateUserRoleCommand` has a dedicated `UpdateUserRoleValidator`, but `RemoveAccountUserCommand` has none. The route constraint `{userId:guid}` ensures a valid GUID, so this is not a bug, but adding a validator would be more consistent with project patterns.

### Evaluator
Claude Opus 4.6 (1M context) — 2026-04-02
