# Story 19.1: Refactor Invitation to Join Existing Account

Status: done

## Story

As an account owner,
I want to invite someone to join my account with a specific role,
so that they can work alongside me without creating a separate account.

## Acceptance Criteria

1. **Given** I am logged in as an Owner
   **When** I create an invitation with an email and role ("Owner" or "Contributor")
   **Then** the invitation is stored with my AccountId, the specified Role, and my UserId as InvitedByUserId
   **And** the invitation email is sent to the recipient

2. **Given** I received an invitation email (with AccountId set)
   **When** I click the link and register with a password
   **Then** my user is created on the inviter's Account (not a new account)
   **And** my Role is set to the role specified in the invitation
   **And** I can log in and see the same properties/data as the inviter

3. **Given** an invitation was created with role "Contributor"
   **When** the recipient accepts the invitation
   **Then** the new user has Role = "Contributor" on the inviter's account

4. **Given** an invitation was created with role "Owner"
   **When** the recipient accepts the invitation
   **Then** the new user has Role = "Owner" on the inviter's account

5. **Given** an invitation was created without an AccountId (legacy/standalone invitation)
   **When** the recipient accepts the invitation
   **Then** a new Account is created (existing behavior preserved)
   **And** the new user has Role = "Owner" on the new account

## Tasks / Subtasks

- [x] Task 1: Add new fields to Invitation entity and create migration (AC: #1, #5)
  - [x] 1.1 Add `AccountId` (Guid?, **nullable**), `Role` (string, required, default "Owner"), `InvitedByUserId` (Guid?, **nullable**) to `Invitation` entity in `backend/src/PropertyManager.Domain/Entities/Invitation.cs`
  - [x] 1.2 Update `InvitationConfiguration` in `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` to configure new columns (max lengths, AccountId/InvitedByUserId nullable, default value for Role)
  - [x] 1.3 Create EF Core migration: `dotnet ef migrations add AddInvitationAccountAndRole --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
  - [x] 1.4 Apply migration: `dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`

- [x] Task 2: Refactor CreateInvitationCommand to include Role and populate AccountId/InvitedByUserId (AC: #1)
  - [x] 2.1 Update `CreateInvitationCommand` record to add `Role` parameter: `CreateInvitationCommand(string Email, string Role)`
  - [x] 2.2 Update `CreateInvitationCommandValidator` to validate Role is "Owner" or "Contributor"
  - [x] 2.3 Update `CreateInvitationCommandHandler` to inject `ICurrentUser` and populate `AccountId`, `InvitedByUserId`, and `Role` on the Invitation entity
  - [x] 2.4 Update `InvitationsController.CreateInvitation` — update `CreateInvitationRequest` to include `Role` field, pass it through to command

- [x] Task 3: Refactor AcceptInvitationCommandHandler to conditionally join existing account (AC: #2, #3, #4, #5)
  - [x] 3.1 Add conditional logic: if `invitation.AccountId` is not null, use it (join existing account); if null, create a new Account (preserve legacy behavior)
  - [x] 3.2 Read `Role` from invitation when AccountId is set; default to "Owner" when creating new account
  - [x] 3.3 Keep account rollback logic for the legacy (new account) path only
  - [x] 3.4 Update `AcceptInvitationResult.Message` to reflect which path was taken

- [x] Task 4: Update ValidateInvitationQuery to return Role (AC: #1)
  - [x] 4.1 Add `Role` field to `ValidateInvitationResult` record
  - [x] 4.2 Update `ValidateInvitationQueryHandler` to populate `Role` from invitation
  - [x] 4.3 Update `ValidateInvitationResponse` in controller to include `Role`

- [x] Task 5: Unit tests for refactored handlers (AC: #1, #2, #3, #4)
  - [x] 5.1 Update `CreateInvitationTests` — test that invitation stores AccountId, Role, InvitedByUserId from ICurrentUser
  - [x] 5.2 Add test: `Handle_ValidEmailWithContributorRole_CreatesInvitationWithContributorRole`
  - [x] 5.3 Add test: `Handle_InvalidRole_ThrowsValidationException` (validator test)
  - [x] 5.4 Create `AcceptInvitationTests` — test that handler uses invitation's AccountId when set (join account)
  - [x] 5.5 Add test: `Handle_InvitationWithAccountId_JoinsExistingAccount`
  - [x] 5.6 Add test: `Handle_InvitationWithContributorRole_CreatesUserWithContributorRole`
  - [x] 5.7 Add test: `Handle_InvitationWithoutAccountId_CreatesNewAccount` (legacy backward-compat path)

- [x] Task 6: Integration tests for full invitation flow (AC: #2, #3, #4)
  - [x] 6.1 Update existing `CreateInvitation_WithOwnerRole_Returns201AndSendsEmail` to include Role in request
  - [x] 6.2 Update `AcceptInvitation_CreatesUserWithOwnerRole` to verify user joins inviter's account (same AccountId)
  - [x] 6.3 Add test: `AcceptInvitation_WithContributorRole_CreatesUserWithContributorRole` — verify JWT role claim is "Contributor"
  - [x] 6.4 Add test: `AcceptInvitation_JoinsInviterAccount_SeesSharedData` — create a property as owner, accept invitation, login as invitee, verify same properties visible
  - [x] 6.5 Add test: `AcceptInvitation_WithoutAccountId_CreatesNewAccount` — legacy path creates new account + Owner role
  - [x] 6.5 Update `CreateInvitation_WithInvalidEmail_Returns400` and similar tests for new request shape

- [x] Task 7: E2E test for invitation acceptance flow (AC: #2)
  - [x] 7.1 Create `frontend/e2e/tests/invitations/invitation-flow.spec.ts`
  - [x] 7.2 Test: Owner creates invitation via API -> extract code from MailHog -> navigate to accept-invitation page -> fill password form -> submit -> verify success -> login as new user -> verify dashboard access

- [x] Task 8: Frontend — update accept-invitation component to show role info (AC: #2)
  - [x] 8.1 Update `AcceptInvitationComponent` to display the role the user will receive (from ValidateInvitation response)
  - [x] 8.2 Manually update API client (NSwag requires .NET 9, unavailable; added `role` to `ValidateInvitationResponse` and `CreateInvitationRequest` interfaces)

## Dev Notes

### Architecture Patterns

**Backend Clean Architecture — Dependencies point inward:**
- Domain (`Invitation` entity) → no dependencies
- Application (handlers, commands) → depends on Domain + interfaces
- Infrastructure (EF Core config, Identity) → implements interfaces
- Api (controllers) → orchestrates via MediatR

**CQRS Pattern:** Single-file CQRS — Command/Query record + Handler + DTOs co-located in one `.cs` file.

**Validators:** FluentValidation validators in separate files, injected into controllers and called explicitly before `_mediator.Send()`.

**Controllers:** Request/Response records defined at bottom of controller file. Controllers use `[Authorize(Roles = "Owner")]` for role-gated endpoints.

### Key Files to Modify

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Domain/Entities/Invitation.cs` | Add AccountId, Role, InvitedByUserId properties |
| `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` | Configure new columns |
| `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` | Add Role param, inject ICurrentUser, populate new fields |
| `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` | Remove account creation, use invitation's AccountId/Role |
| `backend/src/PropertyManager.Application/Invitations/ValidateInvitation.cs` | Return Role in result |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Update request/response DTOs for Role |
| `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` | Update + add tests |
| `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` | Update + add integration tests |
| `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts` | Display role from validation response |
| `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.html` | Show role info |

### Critical Implementation Details

**Invitation Entity — New Fields (AccountId/InvitedByUserId are NULLABLE for backward compatibility):**
```csharp
public Guid? AccountId { get; set; }          // Inviter's account — null means create new account (legacy)
public string Role { get; set; } = "Owner";   // "Owner" or "Contributor"
public Guid? InvitedByUserId { get; set; }    // Who sent the invitation — null for legacy invitations
```

**AcceptInvitationCommandHandler — The Core Change (conditional, backward-compatible):**
```csharp
Guid accountId;
string role;
Account? newAccount = null;

if (invitation.AccountId.HasValue)
{
    // Join existing account (new RBAC flow)
    accountId = invitation.AccountId.Value;
    role = invitation.Role;
}
else
{
    // Create new account (legacy/standalone flow — preserves curl workflow)
    newAccount = new Account { Name = $"{invitation.Email}'s Account" };
    _dbContext.Accounts.Add(newAccount);
    await _dbContext.SaveChangesAsync(cancellationToken);
    accountId = newAccount.Id;
    role = "Owner";
}

var (userId, errors) = await _identityService.CreateUserWithConfirmedEmailAsync(
    invitation.Email, request.Password, accountId, role, cancellationToken);

// Rollback only if we created a new account
if (userId is null && newAccount is not null)
{
    _dbContext.Accounts.Remove(newAccount);
    await _dbContext.SaveChangesAsync(cancellationToken);
}
```

**CreateInvitationCommandHandler — Inject ICurrentUser:**
```csharp
// Add to constructor:
private readonly ICurrentUser _currentUser;

// In Handle method, populate new fields:
var invitation = new Invitation
{
    Email = email,
    CodeHash = codeHash,
    CreatedAt = DateTime.UtcNow,
    ExpiresAt = DateTime.UtcNow.AddHours(24),
    AccountId = _currentUser.AccountId,
    InvitedByUserId = _currentUser.UserId,
    Role = request.Role
};
```

**Validator for Role:**
```csharp
RuleFor(x => x.Role)
    .NotEmpty().WithMessage("Role is required")
    .Must(r => r == "Owner" || r == "Contributor")
    .WithMessage("Role must be 'Owner' or 'Contributor'");
```

**Migration Note:** The `Invitation` table does NOT have `AccountId` as a tenant filter (it's not an `ITenantEntity`). The new `AccountId` column is just a data field linking to the inviter's account — it does not participate in global query filters.

**EF Core Configuration — New Columns (AccountId/InvitedByUserId nullable):**
```csharp
builder.Property(e => e.AccountId).IsRequired(false);
builder.Property(e => e.Role).HasMaxLength(50).IsRequired().HasDefaultValue("Owner");
builder.Property(e => e.InvitedByUserId).IsRequired(false);
```

**Existing Data Migration:** AccountId and InvitedByUserId are nullable, so existing rows simply get NULL — no backfill needed. Role defaults to "Owner" via HasDefaultValue. Clean and safe.

### IIdentityService — Already Supports This

The `CreateUserWithConfirmedEmailAsync` method already accepts `accountId` and `role` parameters:
```csharp
Task<(Guid? UserId, IEnumerable<string> Errors)> CreateUserWithConfirmedEmailAsync(
    string email, string password, Guid accountId, string role, CancellationToken cancellationToken = default);
```
No changes needed to the identity service interface or implementation.

### ICurrentUser — Already Has Required Fields

```csharp
public interface ICurrentUser
{
    Guid UserId { get; }
    Guid AccountId { get; }
    string Role { get; }
    bool IsAuthenticated { get; }
}
```

### Testing Pyramid

- **Unit tests:** Handler logic (CreateInvitation populates fields, AcceptInvitation joins account)
- **Integration tests:** Full API flow with WebApplicationFactory + Testcontainers PostgreSQL
- **E2E tests:** Browser-based invitation acceptance flow via Playwright

### WebApplicationFactory Helper

The test factory already has `CreateTestUserAsync(email, password, role)` which creates a user with a new account. Use this to create the inviting Owner, then verify the accepted invitation user joins that same account.

The factory also has `CreateTestUserInAccountAsync(accountId, email, password, role)` for creating users in existing accounts — useful for verification.

### Frontend Changes (Minimal)

The `AcceptInvitationComponent` already works. The only change is:
1. `ValidateInvitationResponse` gains a `role` field
2. Display the role on the accept-invitation page (e.g., "You've been invited as an **Owner**")
3. Regenerate API client after backend changes

### Previous Story Intelligence

From recent stories (17.13, 18.1, 18.2):
- **Testing pyramid enforced:** Unit + integration + E2E tests required for full-stack stories
- **MockQueryable.Moq v10:** Use `list.BuildMockDbSet()` directly (no `.AsQueryable()`)
- **E2E test data:** Tests that create data should clean up or use route interception for isolation
- **Integration tests** use `PropertyManagerWebApplicationFactory` with Testcontainers PostgreSQL

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.1 requirements, full epic context |
| `docs/project/archive/multi-user-rbac-refactor-plan.md` | Sections 2-3: current state analysis, target architecture |
| `docs/project/project-context.md` | All sections — coding standards, testing rules |
| `docs/project/architecture.md` | Clean Architecture layers, CQRS pattern |
| `backend/src/PropertyManager.Domain/Entities/Invitation.cs` | Current entity (no AccountId/Role) |
| `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` | Lines 113-118: account creation to remove |
| `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` | Handler to add ICurrentUser injection |
| `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs` | Already has UserId, AccountId, Role |
| `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` | CreateUserWithConfirmedEmailAsync signature |
| `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` | Existing integration tests to update |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | CreateTestUserAsync, CreateTestUserInAccountAsync helpers |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Pre-existing test failure: `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` — unrelated to this story
- NSwag client generation requires .NET 9 runtime (only .NET 10 installed) — manually updated TypeScript API interfaces

### Completion Notes List
- All 8 tasks completed with full testing pyramid (unit + integration + E2E)
- Backward compatibility preserved: invitations without AccountId (legacy path) still create new accounts
- AcceptInvitation message distinguishes "joined account" vs "Account created" based on path taken
- CreateInvitationRequest defaults Role to "Owner" for backward compatibility
- Frontend displays role info ("You've been invited as Owner/Contributor") on accept-invitation page
- E2E test validates full flow: API invitation creation -> MailHog code extraction -> browser acceptance -> login verification

### Code Review Record

**Review Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (1M context)

**Findings (4 total — 1 HIGH, 2 MEDIUM, 1 LOW):**

1. **HIGH — PII logged without sanitization in AcceptInvitationCommandHandler** (AcceptInvitation.cs:163)
   - `invitation.Email` logged raw, but `CreateInvitationCommandHandler` uses `LogSanitizer.MaskEmail()`
   - **FIXED:** Added `using PropertyManager.Application.Common` and replaced with `LogSanitizer.MaskEmail(invitation.Email)`

2. **MEDIUM — Validators inline in handler files instead of separate files** (architecture violation)
   - Project-context.md rule: "FluentValidation validators in separate files"
   - All three invitation validators were co-located in handler files
   - **FIXED:** Extracted to `CreateInvitationValidator.cs`, `AcceptInvitationValidator.cs`, `ValidateInvitationValidator.cs`

3. **MEDIUM — E2E test does not verify shared data visibility** (AC #2 partial)
   - AC #2 says "I can log in and see the same properties/data as the inviter"
   - E2E test only verifies dashboard access ("Welcome back"), not that shared properties are visible
   - Integration test `AcceptInvitation_JoinsInviterAccount_SeesSharedData` does cover this
   - **NOT FIXED:** Acceptable coverage via integration test; E2E test correctly tests the browser flow

4. **LOW — Controller try-catch blocks redundant with global middleware** (pre-existing)
   - `InvitationsController` catches `FluentValidation.ValidationException` in CreateInvitation and AcceptInvitation
   - Global middleware already handles this exception type
   - **NOT FIXED:** Pre-existing pattern from TD.6, not in scope of this refactoring story

**Post-fix test results:**
- Backend unit tests: 20 passed (0 failed)
- Backend integration tests: 27 passed (0 failed)
- Frontend unit tests: 2606 passed (110 test files, 0 failed)

### File List

**New files:**
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260331010509_AddInvitationAccountAndRole.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260331010509_AddInvitationAccountAndRole.Designer.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/AcceptInvitationTests.cs`
- `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs` — Extracted from CreateInvitation.cs (review fix)
- `backend/src/PropertyManager.Application/Invitations/AcceptInvitationValidator.cs` — Extracted from AcceptInvitation.cs (review fix)
- `backend/src/PropertyManager.Application/Invitations/ValidateInvitationValidator.cs` — Extracted from ValidateInvitation.cs (review fix)
- `frontend/e2e/tests/invitations/invitation-flow.spec.ts`

**Modified files:**
- `backend/src/PropertyManager.Domain/Entities/Invitation.cs` — Added AccountId, Role, InvitedByUserId properties
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` — Configured new columns
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/AppDbContextModelSnapshot.cs` — Auto-updated by migration
- `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` — Added Role param, ICurrentUser injection, new field population
- `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` — Conditional join-account vs create-account logic
- `backend/src/PropertyManager.Application/Invitations/ValidateInvitation.cs` — Added Role to result
- `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` — Updated DTOs for Role
- `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` — Updated + added tests (20 total)
- `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` — Updated + added tests (27 total)
- `frontend/src/app/core/api/api.service.ts` — Added role field to ValidateInvitationResponse and CreateInvitationRequest
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts` — Added role signal and population
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.html` — Added role display section
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.scss` — Added .role-display styles
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.spec.ts` — Added role tests
- `frontend/e2e/helpers/mailhog.helper.ts` — Added extractInvitationCode and getInvitationCode methods
- `docs/project/sprint-status.yaml` — Updated story status
- `docs/project/stories/epic-19/19-1-refactor-invitation-join-account.md` — Updated tasks and status
