# Story 22.2: Create Landlord Invitation API and Email

Status: review

## Story

As a **PlatformAdmin**,
I want a dedicated endpoint to invite a new landlord by email (and a distinct invitation email template),
so that I can onboard beta customers as their own top-level Upkeep account without giving them access to my data — and so the create-side of the new-account invitation flow that `AcceptInvitation` already supports (Story 22.1 foundation work confirmed `Invitation.AccountId` is nullable and `AcceptInvitation.cs:103-111` already branches on it) is finally reachable via API.

## Acceptance Criteria

1. **Given** an authenticated PlatformAdmin (JWT carries `platformAdmin=true`),
   **When** they `POST /api/v1/admin/landlord-invitations` with body `{ "email": "newlandlord@example.com" }`,
   **Then** the API returns `201 Created` with body `{ invitationId: "<guid>", message: "<string>" }` and a new `Invitation` row is persisted with `AccountId = null`, `Role = "Owner"`, `PropertyId = null`, `InvitedByUserId = <calling PlatformAdmin's user id>`, `CreatedAt = now`, `ExpiresAt = now + 24h`, `UsedAt = null`, and a fresh SHA-256-hashed code (raw code only sent via email).

2. **Given** a non-PlatformAdmin caller (regular Owner, Contributor, or Tenant) authenticated via JWT,
   **When** they `POST /api/v1/admin/landlord-invitations` with any payload,
   **Then** the API returns `403 Forbidden` (the `CanInviteLandlords` policy from Story 22.1 enforces this at the framework layer; no handler code executes).

3. **Given** no `Authorization` header (or an invalid/expired JWT),
   **When** the caller hits `POST /api/v1/admin/landlord-invitations`,
   **Then** the API returns `401 Unauthorized`.

4. **Given** an email that already maps to an existing registered user (case-insensitive match),
   **When** a PlatformAdmin calls the endpoint with that email,
   **Then** the API returns `400 Bad Request` with an RFC 7807 `ValidationProblemDetails` body whose `errors` map includes `Email: ["This email is already registered"]`, and **no** `Invitation` row is created, and **no** email is sent.

5. **Given** an email that already has a non-expired, unused invitation (of **any** flavor — landlord, co-owner, or tenant),
   **When** a PlatformAdmin calls the endpoint with that email,
   **Then** the API returns `400 Bad Request` with `errors` map including `Email: ["This email already has a pending invitation"]`, and **no** new `Invitation` row is created, and **no** email is sent.

6. **Given** a successful landlord invitation creation,
   **When** the email is dispatched,
   **Then** `IEmailService.SendLandlordInvitationEmailAsync(email, rawCode, ct)` is invoked exactly once (not `SendInvitationEmailAsync` and not `SendTenantInvitationEmailAsync`), the email subject is `"You're invited to create your Upkeep account"`, the body copy makes clear the recipient is being invited to create **their own** Upkeep account (they will get their own dashboard / properties), and the accept link points at `{frontend_url}/accept-invitation?code={url-encoded-code}` (the existing accept route).

7. **Given** the request payload schema,
   **When** the endpoint contract is exposed via Swagger/NSwag,
   **Then** the only required field is `email` (string). There are **no** `role`, `accountId`, or `propertyId` parameters on the request DTO. Sending extra fields is ignored (standard JSON binding); missing `email` returns `400` with `errors.Email` containing `"Email is required"`. Malformed email (e.g., `not-an-email`) returns `400` with `errors.Email` containing `"Invalid email format"`.

8. **Given** the existing `POST /api/v1/invitations` endpoint (per-account co-owner/tenant invitations),
   **When** any caller exercises it after this story ships,
   **Then** its behavior is unchanged — still gated by `[Authorize(Policy = "CanManageUsers")]`, still creates invitations bound to `_currentUser.AccountId`, still validates `Role` ∈ {Owner, Contributor, Tenant} and the Tenant-requires-PropertyId rule. The existing `InvitationsControllerTests` suite continues to pass with no test modifications.

9. **Given** the new `CreateLandlordInvitationCommandHandler`,
   **When** inspected for future-signup reuse (NFR-LP2),
   **Then** the handler contains **zero** references to the PlatformAdmin claim or the `CanInviteLandlords` policy — the gate lives only on the controller via `[Authorize(Policy = "CanInviteLandlords")]`. A future `POST /api/v1/signup` endpoint can dispatch the same `CreateLandlordInvitationCommand` (or a peer command sharing the same handler) without modification, and a code comment in the handler explicitly notes this reuse seam.

10. **Given** a successful landlord invitation creation,
    **When** the structured log is emitted,
    **Then** a single `LogInformation` entry fires carrying `InvitationId`, `InvitedByUserId`, and the **masked** recipient email (via `LogSanitizer.MaskEmail`). Raw email, JWT, password, and any code/hash material are NEVER logged.

11. **Given** the Story 22.1 dev-only `PlatformAdminStubController` at `GET /api/v1/test/platform-admin-only`,
    **When** this story ships,
    **Then** the stub controller is **deleted** (file removed from `backend/src/PropertyManager.Api/Controllers/`), because the real `AdminLandlordInvitationsController` now satisfies the `AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` orphan check on `CanInviteLandlords`. The `PlatformAdminPolicyTests` integration class is updated to point at the new production endpoint (`POST /api/v1/admin/landlord-invitations`) instead of the deleted stub — and the existing assertions (200 as PlatformAdmin, 403 as Owner/Contributor/Tenant, 401 unauthenticated) all continue to pass against the real endpoint. (This closes Story 22.1 Evaluation Finding #1 — the un-env-gated stub.)

## Tasks / Subtasks

- [x] **Task 1: Add `IEmailService.SendLandlordInvitationEmailAsync` and SMTP implementation** (AC: #6)
  - [x] 1.1 Add new method to `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs`:
    ```csharp
    /// <summary>
    /// Sends a landlord invitation email — distinct from co-owner and tenant invitations.
    /// Recipient is being invited to create their OWN top-level Upkeep account (AC: FR-LP3).
    /// Link format: {frontend_url}/accept-invitation?code={code}
    /// </summary>
    Task SendLandlordInvitationEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken = default);
    ```
  - [x] 1.2 Implement the method on `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs`. Subject: `"You're invited to create your Upkeep account"`. Body copy must be visibly distinct from the co-owner/tenant templates and make clear:
    - The recipient is creating their **own** Upkeep account (not joining someone else's).
    - They'll get their own dashboard, properties, expenses, tenants, etc.
    - The invitation expires in 24 hours.
    - Use the same HTML/text alternate-view pattern as `GenerateInvitationEmailHtml` / `GenerateInvitationEmailText` (Upkeep green `#66BB6A` header, max-width 600px, plain-text fallback). Keep the accept URL identical to the other invitation flows so the existing accept route handles it.
  - [x] 1.3 Update `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` — extend `FakeEmailService` with:
    ```csharp
    public List<(string Email, string Code)> SentLandlordInvitationEmails { get; } = [];

    public Task SendLandlordInvitationEmailAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        SentLandlordInvitationEmails.Add((email, code));
        return Task.CompletedTask;
    }
    ```
    Place adjacent to the existing `SentInvitationEmails` / `SentTenantInvitationEmails` lists for consistency.

- [x] **Task 2: Create `CreateLandlordInvitation` command + handler + result** (AC: #1, #4, #5, #6, #9, #10)
  - [x] 2.1 New file: `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitation.cs`. Mirror the structure of `CreateInvitation.cs` but minimal:
    ```csharp
    /// <summary>
    /// Command for inviting a new top-level landlord (creates a fresh account on accept).
    /// Caller authorization is enforced at the controller via [Authorize(Policy = "CanInviteLandlords")] (Story 22.1).
    /// This handler is intentionally permission-agnostic so a future public POST /api/v1/signup
    /// can reuse it without the PlatformAdmin gate (NFR-LP2).
    /// </summary>
    public record CreateLandlordInvitationCommand(string Email) : IRequest<CreateLandlordInvitationResult>;

    public record CreateLandlordInvitationResult(Guid InvitationId, string Message);
    ```
  - [x] 2.2 Handler dependencies (constructor-injected, `_camelCase` private readonly fields, per project-context.md):
    - `IAppDbContext _dbContext`
    - `IIdentityService _identityService`
    - `IEmailService _emailService`
    - `ICurrentUser _currentUser` — used **only** to read `UserId` for the `InvitedByUserId` audit field. Do NOT read `AccountId` (that's the whole point — the invitation has none).
    - `ILogger<CreateLandlordInvitationCommandHandler> _logger`
  - [x] 2.3 Handler logic mirrors `CreateInvitationCommandHandler.Handle`:
    1. Lower-case + trim the input email.
    2. `if (await _identityService.EmailExistsAsync(email, ct)) throw new ValidationException(...)` with message `"This email is already registered"` on property `Email`.
    3. Query `_dbContext.Invitations.Where(i => i.Email == email && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow).FirstOrDefaultAsync(ct)` — if non-null, throw `ValidationException` with `"This email already has a pending invitation"` on property `Email`.
    4. Generate secure code: lift the `GenerateSecureCode` (32 random bytes → base64-url) and `ComputeHash` (SHA-256 → base64) static methods from `CreateInvitation.cs` verbatim. Co-locate them as private static methods in the new file. (Do NOT refactor into a shared utility in this story — pre-existing duplication is acceptable; Story 22.3+ or a separate tech-debt story can DRY.)
    5. Construct `new Invitation { Email = email, CodeHash = hash, CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(24), AccountId = null, InvitedByUserId = _currentUser.UserId, Role = "Owner", PropertyId = null }`.
    6. `_dbContext.Invitations.Add(invitation); await _dbContext.SaveChangesAsync(ct);`
    7. `await _emailService.SendLandlordInvitationEmailAsync(email, rawCode, ct);`
    8. `_logger.LogInformation("Landlord invitation created. InvitationId: {InvitationId}, InvitedByUserId: {InvitedByUserId}, Email: {Email}", invitation.Id, _currentUser.UserId, LogSanitizer.MaskEmail(email));`
    9. Return `new CreateLandlordInvitationResult(invitation.Id, "Landlord invitation sent successfully")`.
  - [x] 2.4 Header `using` directives required (verify each — file-scoped namespace, implicit usings on): `System.Security.Cryptography`, `FluentValidation`, `MediatR`, `Microsoft.EntityFrameworkCore`, `Microsoft.Extensions.Logging`, `PropertyManager.Application.Common` (for `LogSanitizer`), `PropertyManager.Application.Common.Interfaces`, `PropertyManager.Domain.Entities`.

- [x] **Task 3: Create `CreateLandlordInvitationValidator`** (AC: #7)
  - [x] 3.1 New file: `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitationValidator.cs`. Keep minimal — only `Email`:
    ```csharp
    public class CreateLandlordInvitationCommandValidator : AbstractValidator<CreateLandlordInvitationCommand>
    {
        public CreateLandlordInvitationCommandValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email is required")
                .EmailAddress().WithMessage("Invalid email format");
        }
    }
    ```
  - [x] 3.2 No `Role` rule, no `PropertyId` rule — the request DTO has neither (AC #7).
  - [x] 3.3 Validator is auto-discovered by the `AddValidatorsFromAssemblyContaining<...>()` registration already in `Program.cs` (same assembly scan that picks up `CreateInvitationCommandValidator`). No DI wiring needed beyond placing the file in `PropertyManager.Application.Invitations`. Verify by running the controller integration tests (Task 7); a missing validator surfaces as a DI exception at request time.

- [x] **Task 4: Create `AdminLandlordInvitationsController`** (AC: #1, #2, #3, #7, #10, #11)
  - [x] 4.1 New file: `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs`. Pattern mirrors `InvitationsController` but trimmed to a single POST action.
    ```csharp
    using FluentValidation;
    using MediatR;
    using Microsoft.AspNetCore.Authentication.JwtBearer;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using PropertyManager.Application.Invitations;

    namespace PropertyManager.Api.Controllers;

    /// <summary>
    /// Admin endpoints for provisioning new top-level landlord accounts (Story 22.2).
    /// Gated by the platform-level CanInviteLandlords policy (Story 22.1).
    /// </summary>
    [ApiController]
    [Route("api/v1/admin/landlord-invitations")]
    [Produces("application/json")]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Policy = "CanInviteLandlords")]
    public class AdminLandlordInvitationsController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly IValidator<CreateLandlordInvitationCommand> _createValidator;
        private readonly ILogger<AdminLandlordInvitationsController> _logger;

        public AdminLandlordInvitationsController(
            IMediator mediator,
            IValidator<CreateLandlordInvitationCommand> createValidator,
            ILogger<AdminLandlordInvitationsController> logger)
        {
            _mediator = mediator;
            _createValidator = createValidator;
            _logger = logger;
        }

        [HttpPost]
        [ProducesResponseType(typeof(CreateLandlordInvitationResponse), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> CreateLandlordInvitation([FromBody] CreateLandlordInvitationRequest request)
        {
            var command = new CreateLandlordInvitationCommand(request.Email);

            var validationResult = await _createValidator.ValidateAsync(command);
            if (!validationResult.IsValid)
            {
                return BadRequest(CreateValidationProblemDetails(validationResult));
            }

            try
            {
                var result = await _mediator.Send(command);
                var response = new CreateLandlordInvitationResponse(result.InvitationId, result.Message);

                return CreatedAtAction(
                    nameof(CreateLandlordInvitation),
                    new { id = result.InvitationId },
                    response);
            }
            catch (ValidationException ex)
            {
                return BadRequest(CreateValidationProblemDetails(ex));
            }
        }

        private static ProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult result)
        {
            var errors = result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            return new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation Error",
                Type = "https://tools.ietf.org/html/rfc7807"
            };
        }

        private static ProblemDetails CreateValidationProblemDetails(ValidationException ex)
        {
            var errors = ex.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            return new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation Error",
                Type = "https://tools.ietf.org/html/rfc7807"
            };
        }
    }

    // DTOs at bottom of file per project convention.
    public record CreateLandlordInvitationRequest(string Email);
    public record CreateLandlordInvitationResponse(Guid InvitationId, string Message);
    ```
  - [x] 4.2 Note: try/catch around `ValidationException` mirrors the existing `InvitationsController.CreateInvitation` action — this is the established codebase pattern for surfacing handler-thrown `FluentValidation.ValidationException` as `400` (the global middleware does not auto-map `FluentValidation.ValidationException` to 400). Do **not** alter the middleware in this story.
  - [x] 4.3 Confirm `[Authorize(... Policy = "CanInviteLandlords")]` is at the class level — that way the orphan check in `AuthorizationPolicyTests.AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` picks it up naturally once the stub controller is deleted (Task 9).

- [x] **Task 5: Update `Program.cs` policy comment** (AC: #11 cleanup hygiene)
  - [x] 5.1 In `backend/src/PropertyManager.Api/Program.cs` around lines 183-194, update the comment block above `AddPolicy("CanInviteLandlords", ...)`:
    - Before (current): `// Story 22.2 will gate POST /api/v1/admin/landlord-invitations with this policy.`
    - After: `// Gates POST /api/v1/admin/landlord-invitations (Story 22.2 — AdminLandlordInvitationsController).`
  - [x] 5.2 The policy registration body itself does not change — Story 22.1's `RequireAuthenticatedUser().RequireClaim(PlatformClaims.PlatformAdmin, "true")` is exactly what this story needs.

- [x] **Task 6: Backend unit tests for handler + validator** (AC: #1, #4, #5, #6, #7, #9, #10)
  - [x] 6.1 New file: `backend/tests/PropertyManager.Application.Tests/Invitations/CreateLandlordInvitationTests.cs`. Mirror the structure of `CreateInvitationTests.cs` (constructor mock setup, `MockQueryable.Moq` for `BuildMockDbSet()`, no `[SetUp]`). Mocks needed: `Mock<IAppDbContext>`, `Mock<IIdentityService>`, `Mock<IEmailService>`, `Mock<ICurrentUser>`, `Mock<ILogger<CreateLandlordInvitationCommandHandler>>`.
  - [x] 6.2 Tests to write (each with AC reference comment per project rule):
    - `Handle_ValidEmail_CreatesInvitationWithAccountIdNullAndRoleOwner` (AC: #1) — assert persisted entity has `AccountId == null`, `Role == "Owner"`, `PropertyId == null`, `InvitedByUserId == _currentUser.UserId`, `ExpiresAt` is roughly 24 hours after `CreatedAt`.
    - `Handle_ValidEmail_CallsSendLandlordInvitationEmail_NotOtherFlavors` (AC: #6) — verify `SendLandlordInvitationEmailAsync` is called once; verify `SendInvitationEmailAsync` and `SendTenantInvitationEmailAsync` are called zero times. (`Times.Never` on both.)
    - `Handle_ValidEmail_LowerCasesAndTrims` — input `"  NEW@Example.COM  "` produces persisted entity with `email == "new@example.com"` and the email-existence check is invoked with the normalized value.
    - `Handle_EmailAlreadyRegistered_ThrowsValidationException` (AC: #4) — `_identityService.EmailExistsAsync` returns true → expect `ValidationException` whose `Errors` contains an entry with `PropertyName == "Email"` and `ErrorMessage` containing `"already registered"`. Verify NO invitation added (`_mockDbContext.Verify(x => x.SaveChangesAsync(...), Times.Never)`) and NO email sent.
    - `Handle_PendingInvitationExists_ThrowsValidationException` (AC: #5) — seed the mocked invitations list with one row having `UsedAt == null` and `ExpiresAt > DateTime.UtcNow`; expect `ValidationException` with message containing `"pending invitation"`. Verify no new save, no email.
    - `Handle_ExpiredInvitationExists_DoesNotBlock` (AC: #5 guard) — seed a single row for the same email but with `ExpiresAt < DateTime.UtcNow`; the new invitation should be created successfully (proves the duplicate-check correctly ignores expired rows).
    - `Handle_UsedInvitationExists_DoesNotBlock` (AC: #5 guard) — seed a single row with `UsedAt != null`; the new invitation should be created successfully.
    - `Handle_SuccessfulCreation_LogsInfoWithMaskedEmail` (AC: #10) — verify exactly one `LogInformation` invocation. Inspect the log state to confirm it contains `InvitationId` and `InvitedByUserId` keys and the email is masked (no raw `@example.com` substring in the log state). Pattern: use `Mock<ILogger<T>>.Verify(x => x.Log(LogLevel.Information, ...), Times.Once)` against the standard Moq logger extension shape.
    - `Handler_DoesNotReferencePlatformAdminClaim` (AC: #9) — meta test: use reflection to assert that `CreateLandlordInvitationCommandHandler` declared members (fields, methods) contain no string literal `"platformAdmin"` and no reference to `PlatformClaims.PlatformAdmin`. Implementation hint: read the type's `Assembly.Location` -> the assembly's manifest module string heap is too messy; instead simply assert via inspection at code-review time **and** add a `// NFR-LP2:` comment in the handler explicitly noting the seam. If a reflection-based test is impractical, downgrade this AC #9 verification to a code-review checklist item plus the comment requirement.
    - `Validator_EmptyEmail_Fails` (AC: #7) — both `""` and `null` via `[Theory]`.
    - `Validator_InvalidEmailFormat_Fails` (AC: #7) — `"not-an-email"`.
    - `Validator_ValidEmail_Passes` (AC: #7).
    - `Validator_DoesNotRequireRole` (AC: #7 structural) — invoke `validator.Validate(new CreateLandlordInvitationCommand("valid@example.com"))` and assert `IsValid == true`. (Implicitly proves the record only has the `Email` field — would fail at compile time if the record signature differs, so this is mostly a smoke test.)

- [x] **Task 7: Backend integration tests for the new endpoint** (AC: #1, #2, #3, #4, #5, #6, #7, #11)
  - [x] 7.1 New file: `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs`. Use `IClassFixture<PropertyManagerWebApplicationFactory>` like `PlatformAdminPolicyTests` and `InvitationsControllerTests`. Reuse the existing helpers `_factory.CreateTestUserAsync`, `_factory.CreateTestUserInAccountAsync`, `_factory.CreateTenantUserInAccountAsync`, `_factory.CreatePropertyInAccountAsync`, plus the `GrantPlatformAdminClaimAsync` helper pattern from `PlatformAdminPolicyTests.cs:45-61` (lift it into a private helper or duplicate — duplication is acceptable for two integration test classes).
  - [x] 7.2 Tests:
    - `Create_AsPlatformAdmin_Returns201_PersistsInvitationWithNullAccountIdAndRoleOwner` (AC: #1) — happy path. Decode the 201 body, query the DB via `_factory.Services` scope, assert `invitation.AccountId == null`, `invitation.Role == "Owner"`, `invitation.InvitedByUserId == <admin user id>`, `invitation.PropertyId == null`, `invitation.ExpiresAt > DateTime.UtcNow.AddHours(23)`.
    - `Create_AsPlatformAdmin_SendsLandlordEmail_NotCoOwnerOrTenant` (AC: #6) — after the call, inspect `_factory.Services.GetRequiredService<FakeEmailService>().SentLandlordInvitationEmails` — should contain one entry for the invited email; `SentInvitationEmails` and `SentTenantInvitationEmails` should NOT contain it.
    - `Create_AsRegularOwner_Returns403` (AC: #2) — create an Owner without the PlatformAdmin claim, login, hit the endpoint, assert 403.
    - `Create_AsContributor_Returns403` (AC: #2).
    - `Create_AsTenant_Returns403` (AC: #2) — uses `CreateTenantUserInAccountAsync` (which requires a property).
    - `Create_AsUnauthenticated_Returns401` (AC: #3).
    - `Create_WithMissingEmail_Returns400` (AC: #7) — body `{}` → 400 with `errors.Email` containing `"Email is required"`.
    - `Create_WithMalformedEmail_Returns400` (AC: #7) — body `{ "email": "not-an-email" }` → 400 with `errors.Email` containing `"Invalid email format"`.
    - `Create_WithDuplicateRegisteredEmail_Returns400` (AC: #4) — first create a user via `_factory.CreateTestUserAsync("existing@example.com", ...)`, then POST with same email. Expect 400 with `errors.Email` containing `"already registered"`. Verify no invitation row appears in DB for that email.
    - `Create_WithPendingInvitationForSameEmail_Returns400` (AC: #5) — first POST creates the invitation (201); second POST with the same email returns 400 with `errors.Email` containing `"pending invitation"`. (Use a fresh `Guid.NewGuid()`-suffixed email so the test is hermetic against test-DB pollution.)
    - `Create_WithExtraFieldsInPayload_IgnoresThem` (AC: #7) — POST body `{ "email": "x@example.com", "role": "Tenant", "accountId": "<guid>" }` — assert 201 (the extras are silently ignored by JSON binding, since the request DTO is `CreateLandlordInvitationRequest(string Email)`). Decode the persisted invitation and assert `Role == "Owner"` and `AccountId == null` (proving the server did not honor the spurious `role`/`accountId`).
  - [x] 7.3 **Modify existing tests** `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs`:
    - Change `private const string StubEndpoint = "/api/v1/test/platform-admin-only";` → `private const string TargetEndpoint = "/api/v1/admin/landlord-invitations";`
    - Switch the `Get(...)` helper invocations to `Post(...)` with a minimal valid JSON body for the PlatformAdmin happy-path test (`{ "email": $"new-{Guid.NewGuid():N}@example.com" }`). For the negative tests (Owner/Contributor/Tenant/Unauthenticated), the body can be empty `{}` — the framework runs the policy check **before** the controller binds the body, so 401/403 fire regardless.
    - The PlatformAdmin happy-path test will now return `201 Created` (not `200 OK`). Update the assertion. (This also doubles as additional coverage of AC #1.)
    - Per-account regression test `PlatformAdmin_CanStillAccess_OwnAccountInvitationsEndpoint_Returns201` (lines 188-212) — **keep unchanged**. It covers AC #8 (existing per-account flow unbroken) for both stories.
    - `Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim` and `Login_AsRegularOwner_JwtOmitsPlatformAdminClaim` — **keep unchanged**. Both target the auth endpoint, not the stub.
  - [x] 7.4 **Delete** `backend/src/PropertyManager.Api/Controllers/PlatformAdminStubController.cs` (AC: #11). Re-run `AuthorizationPolicyTests` after this — the orphan check now passes because `AdminLandlordInvitationsController` carries the `CanInviteLandlords` policy attribute.

- [x] **Task 8: Update Postman / curl smoke artifacts (developer ergonomics)** (AC: #1 manual verification)
  - [x] 8.1 No Postman collection is checked into the repo today (verified with `find . -name "*.postman_collection.json"` returning zero hits in repo grep history). Provide a curl smoke command in the PR description / Dev Agent Record showing the happy path:
    ```bash
    # 1) Login as seeded PlatformAdmin
    TOKEN=$(curl -s -X POST http://localhost:5292/api/v1/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"email":"claude@claude.com","password":"1@mClaude"}' | jq -r '.accessToken')

    # 2) Invite a new landlord
    curl -s -X POST http://localhost:5292/api/v1/admin/landlord-invitations \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"email":"new-landlord@example.com"}'

    # 3) Inspect MailHog at http://localhost:8025 — see the "You're invited to create your Upkeep account" email.
    ```
  - [x] 8.2 No documentation file edit required; the curl snippet lives in the PR body and the manual smoke test confirmation lives in the Dev Agent Record / Evaluation section.

- [x] **Task 9: Verify and document** (AC: all)
  - [x] 9.1 `cd backend && dotnet build && dotnet test` — must pass with 0 errors. Note expected delta: ~10-15 new tests (Task 6) + ~10 new integration tests (Task 7) + ~5 modified `PlatformAdminPolicyTests` lines + deletion of `PlatformAdminStubController` shouldn't break any other test. Cite final pass/fail counts in the Completion Notes.
  - [x] 9.2 Frontend NSwag regeneration: this story adds a new API endpoint, but **no frontend code consumes it yet** (Story 22.4 owns the admin UI). Run `cd frontend && npm run generate-api` to refresh `frontend/src/app/core/api/generated/` and confirm the generated client includes a method for `POST /api/v1/admin/landlord-invitations`. Commit the regenerated client. (Do NOT add a frontend service or store in this story — that's 22.4's surface.)
  - [x] 9.3 `cd frontend && npm run build && npm test -- --run` — confirm the regenerated NSwag client doesn't break existing frontend tests. Cite test counts.
  - [x] 9.4 No E2E tests added — see Test Scope.
  - [x] 9.5 Manual smoke test (run via /evaluate Phase 3): execute the Task 8.1 curl recipe end-to-end against the running dev server. Verify (a) 201 response with invitationId, (b) MailHog received the landlord-flavored email with the new subject line, (c) database has the new row with `AccountId IS NULL` and `Role = 'Owner'`. Save the MailHog screenshot to `screenshots/`.

## Dev Notes

### Architectural Decision: Authorization Gate at Controller, Business Logic at Handler

Per **AC #9** and **NFR-LP2**, the `CreateLandlordInvitationCommandHandler` must be **gate-agnostic**. The handler creates an invitation row with `AccountId = null` and `Role = "Owner"` — that's domain logic that's identical whether the caller is a PlatformAdmin (this story) or an anonymous public-signup user (future v1.0 story). The PlatformAdmin gate lives only on the controller via `[Authorize(Policy = "CanInviteLandlords")]`.

When the future `POST /api/v1/signup` endpoint lands, it will:
1. Mount at a different route (e.g., `/api/v1/signup`) with `[AllowAnonymous]` instead of the policy.
2. Add bot-protection middleware (CAPTCHA, rate-limit) — out of scope here.
3. Dispatch the **same** `CreateLandlordInvitationCommand` (or a peer command sharing the same handler).
4. Optionally enrich with terms-acceptance, email-verification, Stripe-customer creation — out of scope.

### Why Reuse `AcceptInvitation` Unchanged

Story 22.1 grounding confirmed: `AcceptInvitation.cs:103-111` already branches on `invitation.AccountId.HasValue`. When `null`, the handler creates a new `Account`, then provisions the user as `Owner` of that account, then marks the invitation used. Rollback semantics for failed Identity creation already exist at lines 122-129. **This story creates no changes to the accept-side**; Story 22.3 will add integration tests proving the accept-side end-to-end for a landlord-flavored invitation.

### Why a Separate Email Method Instead of a Type Parameter

Three email methods (`SendInvitationEmailAsync`, `SendTenantInvitationEmailAsync`, `SendLandlordInvitationEmailAsync`) is the existing pattern from Stories 1-6, 20.2, and this one. We deliberately do NOT collapse them into a single `SendInvitationEmailAsync(string email, string code, InvitationType type, ...)` because:
1. Each template has distinct copy and (for tenant) extra parameters (`propertyAddress`).
2. The `FakeEmailService` in `PropertyManagerWebApplicationFactory` uses per-method `Sent...Emails` lists, which makes it trivial in integration tests to assert that the **right flavor** was sent (AC #6) without parsing template content. A single dispatcher would force tests to inspect template strings, which is brittle.
3. NSwag generates separate methods for separate controller actions in the frontend; same separation principle for email service methods feels consistent.

### File-by-File Change Map

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs` | Add `SendLandlordInvitationEmailAsync` method signature. |
| `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs` | Implement `SendLandlordInvitationEmailAsync` + private HTML/text generators. |
| `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitation.cs` | **NEW** — command, result, handler. |
| `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitationValidator.cs` | **NEW** — minimal validator (email only). |
| `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs` | **NEW** — single POST action, gated by `CanInviteLandlords`. |
| `backend/src/PropertyManager.Api/Controllers/PlatformAdminStubController.cs` | **DELETE** — orphan check now satisfied by the real controller (AC #11, closes Story 22.1 finding #1). |
| `backend/src/PropertyManager.Api/Program.cs` | Update comment above `CanInviteLandlords` policy (cosmetic — registration body unchanged). |
| `backend/tests/PropertyManager.Application.Tests/Invitations/CreateLandlordInvitationTests.cs` | **NEW** — handler + validator unit tests (Task 6). |
| `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` | **NEW** — integration tests (Task 7). |
| `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs` | Modify — point at real endpoint, switch GET→POST, update PlatformAdmin happy-path status 200→201. Keep Login claim tests and per-account regression test unchanged. |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Add `SentLandlordInvitationEmails` list and `SendLandlordInvitationEmailAsync` impl on `FakeEmailService`. |
| `frontend/src/app/core/api/generated/*` | Regenerated by `npm run generate-api` — should pick up the new endpoint. Commit the diff but do not hand-edit. |

### Code Sketch: Handler Skeleton

```csharp
namespace PropertyManager.Application.Invitations;

/// <summary>
/// Command to invite a new top-level landlord — creates an Invitation with AccountId=null.
/// AcceptInvitation already branches on AccountId.HasValue (line 103-111) and will provision
/// a fresh Account + Owner user when this invitation is accepted.
///
/// NFR-LP2 SEAM: This handler is intentionally permission-agnostic. The PlatformAdmin gate
/// lives only on AdminLandlordInvitationsController via [Authorize(Policy = "CanInviteLandlords")].
/// A future public POST /api/v1/signup can dispatch this same command without modification.
/// </summary>
public record CreateLandlordInvitationCommand(string Email)
    : IRequest<CreateLandlordInvitationResult>;

public record CreateLandlordInvitationResult(Guid InvitationId, string Message);

public class CreateLandlordInvitationCommandHandler
    : IRequestHandler<CreateLandlordInvitationCommand, CreateLandlordInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IIdentityService _identityService;
    private readonly IEmailService _emailService;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<CreateLandlordInvitationCommandHandler> _logger;

    public CreateLandlordInvitationCommandHandler(
        IAppDbContext dbContext,
        IIdentityService identityService,
        IEmailService emailService,
        ICurrentUser currentUser,
        ILogger<CreateLandlordInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _identityService = identityService;
        _emailService = emailService;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<CreateLandlordInvitationResult> Handle(
        CreateLandlordInvitationCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _identityService.EmailExistsAsync(email, cancellationToken))
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email is already registered")
            });
        }

        var pending = await _dbContext.Invitations
            .Where(i => i.Email == email && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(cancellationToken);

        if (pending != null)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email already has a pending invitation")
            });
        }

        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        var invitation = new Invitation
        {
            Email = email,
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            AccountId = null,                         // NEW-account flow
            InvitedByUserId = _currentUser.UserId,    // audit only
            Role = "Owner",
            PropertyId = null
        };

        _dbContext.Invitations.Add(invitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _emailService.SendLandlordInvitationEmailAsync(email, rawCode, cancellationToken);

        _logger.LogInformation(
            "Landlord invitation created. InvitationId: {InvitationId}, InvitedByUserId: {InvitedByUserId}, Email: {Email}",
            invitation.Id,
            _currentUser.UserId,
            LogSanitizer.MaskEmail(email));

        return new CreateLandlordInvitationResult(invitation.Id, "Landlord invitation sent successfully");
    }

    private static string GenerateSecureCode()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string ComputeHash(string code)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }
}
```

### Code Sketch: Email Template (Subject + Distinctive Body)

```csharp
public async Task SendLandlordInvitationEmailAsync(
    string email, string code, CancellationToken cancellationToken = default)
{
    var inviteUrl = $"{_settings.BaseUrl}/accept-invitation?code={Uri.EscapeDataString(code)}";

    var subject = "You're invited to create your Upkeep account";
    var htmlBody = GenerateLandlordInvitationEmailHtml(inviteUrl);
    var textBody = GenerateLandlordInvitationEmailText(inviteUrl);

    await SendEmailAsync(email, subject, htmlBody, textBody, cancellationToken);

    _logger.LogInformation(
        "Landlord invitation email sent to {Email}", LogSanitizer.MaskEmail(email));
}
```

Body copy guidance (must differ visibly from `GenerateInvitationEmailHtml` to satisfy AC #6 — reviewers should be able to tell at a glance which template was sent):
- Headline: "Create your Upkeep account"
- Body lead: "You've been invited to set up your **own** Upkeep account — your private dashboard for tracking rental property expenses, generating tax-ready reports, and managing tenants and vendors."
- Sub-line: "When you accept, a new account will be created for you. You'll be the owner, with full control over your data."
- CTA: "Create my account" (vs. co-owner CTA "Accept invitation")
- Keep the 24-hour expiry warning + "ignore if unexpected" footer pattern identical for consistency.

### Critical Implementation Rules (from project-context.md)

- **File-scoped namespaces** throughout: `namespace PropertyManager.Application.Invitations;`
- **`DateTime.UtcNow`**, never `DateTime.Now`.
- **Records for Commands / Results / Request / Response DTOs**.
- **Private fields `_camelCase`**, `CancellationToken` parameter on all async methods.
- **Controllers do NOT need try-catch** for domain exceptions — but for `FluentValidation.ValidationException` thrown from handlers, the existing `InvitationsController.CreateInvitation` action uses an explicit `try/catch` to convert to `ValidationProblemDetails`. Mirror that pattern in the new controller (AC #4, #5 surface as 400s).
- **Structured logging** with named parameters, never string interpolation.
- **`LogSanitizer.MaskEmail`** for any email in logs.
- **API URLs kebab-case, plural**: `/api/v1/admin/landlord-invitations` ✓.
- **Response shapes**: `201 Created` with `{ invitationId }` envelope.

### Previous Story Intelligence

**From Story 22.1 (PlatformAdmin Role & Permission Infrastructure):**

- The `CanInviteLandlords` policy is registered in `Program.cs:189-193` via `RequireAuthenticatedUser().RequireClaim(PlatformClaims.PlatformAdmin, "true")`. Use it verbatim on the new controller — no policy changes needed in 22.2.
- `AuthorizationPolicyTests` enforces both:
  - Every `[Authorize(Policy = "X")]` name is in `RegisteredPolicies` HashSet.
  - Every name in `RegisteredPolicies` appears in at least one `[Authorize]` attribute.
  When `AdminLandlordInvitationsController` ships with the `CanInviteLandlords` attribute, the orphan check that was satisfied by `PlatformAdminStubController` is now satisfied by the production controller — the stub can (and per AC #11 **must**) be deleted.
- **Stub deletion closes Story 22.1 Evaluation Finding #1** (`PlatformAdminStubController` not environment-gated, lives in production until 22.2 removes it). Story 22.1's evaluation explicitly accepted the deferral.
- Story 22.1 Evaluation **Finding #3** (integration tests assert status code only, not ProblemDetails body) is worth heeding in this story's integration tests: for the 400 paths (AC #4, #5, #7), the tests **should** read the response body as `ValidationProblemDetails` and assert the `errors[Email]` array contains the expected message — not just `response.StatusCode.Should().Be(400)`. This sets a stronger pattern for future stories.
- Story 22.1 Evaluation **Finding #2** (missing `JwtService.ValidateRefreshTokenAsync` claim-extraction unit test) is out of scope here — leave as future tech-debt.
- Story 22.1 Evaluation **Finding #5** (`CanInviteLandlords` denials bypass Story 20.11 audit-log helper) is out of scope — AC #9 in 22.1 explicitly accepted this trade-off. Do NOT refactor `AddPermissionPolicy` to support claim-based policies in this story.

**From Story 19.1 (Refactor Invitation — Join Account):**

- `Invitation.AccountId` was made nullable to support both join-existing-account and (legacy) standalone flows.
- `AcceptInvitation.cs:103-111` already creates a new Account when `AccountId` is null. This story relies on that branch being correct (Story 22.3 will add integration tests confirming end-to-end).

**From Story 20.2 (Tenant Invitation Flow):**

- Adding a new flavor of invitation = (1) extend `IEmailService` with a per-flavor method, (2) extend `FakeEmailService` with a per-flavor `Sent...Emails` list, (3) controller-level dispatch decides which method to call. Mirror this pattern exactly.
- The `SendTenantInvitationEmailAsync` impl in `SmtpEmailService.cs:245-260` is the closest stylistic precedent for the new landlord email method.

**From td-6 (Invitation-Only Registration):**

- The `GenerateSecureCode` / `ComputeHash` static helpers were introduced in `CreateInvitation.cs`. Resist the urge to DRY them into a shared utility in this story — duplication across two handlers is cheap; a shared base would couple two CQRS handlers and obscure the pattern. Address in a dedicated tech-debt story if friction grows.

### Test Scope

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit tests (backend handler + validator)** | **YES** | Handler is new logic (duplicate-email check, pending-invitation check, persistence shape with `AccountId=null` / `Role="Owner"`, log shape). Validator is new (minimal but must enforce the email-only contract per AC #7). All can be tested with `Mock<IAppDbContext>` + `MockQueryable.Moq` without DB. Task 6 covers ~13 unit tests. |
| **Integration tests (backend, WebApplicationFactory + Testcontainers)** | **YES** | This story adds a **brand-new endpoint** with auth, validation, and side-effects (DB write + email send). End-to-end coverage at the HTTP layer is the only way to prove (a) the `CanInviteLandlords` policy actually fires (Story 22.1's stub-based tests get **upgraded** to point at the real endpoint), (b) JSON binding correctly maps the request DTO, (c) `ValidationProblemDetails` body has the right shape for 400s (closes Story 22.1 Finding #3 pattern), (d) the right email flavor is sent (via `FakeEmailService`). Task 7 covers ~10 integration tests; Task 7.3 migrates the existing `PlatformAdminPolicyTests` to the production endpoint. |
| **E2E tests (Playwright)** | **NO — explicitly justified skip** | This story is **backend-only** per the epic doc (`epics-landlord-provisioning.md` lines 64-71 — "22.2 makes the feature beta-usable via Postman/curl immediately, before 22.4 lands the UI"). There is no admin console, no nav entry, no form to fill — those land in Story 22.4. Writing an E2E here would either need to (a) hit the backend directly with a fetch, which is an integration test in disguise, or (b) wait for 22.4's UI. **Story 22.4 will own the E2E** for the full admin-creates-landlord-invitation flow (epic doc line 221). Document this hand-off so the orchestrator does not insist on E2E in /evaluate Phase 3 for 22.2. The manual smoke test via curl + MailHog (Task 8 / Task 9.5) is the closest 22.2-appropriate manual verification. |

The story includes dedicated test tasks (Task 6, Task 7) for the required pyramid levels.

### References

| Artifact | Section / Lines |
|----------|-----------------|
| `docs/project/epics-landlord-provisioning.md` | Story 22.2 (lines 107-146) — full AC and technical notes |
| `docs/project/stories/epic-22/22-1-platform-admin-role-permission-infrastructure.md` | Whole file — PlatformAdmin claim infra this story builds on, plus Evaluation Findings #1, #3, #5 referenced above |
| `docs/project/stories/epic-19/19-1-refactor-invitation-join-account.md` | `Invitation.AccountId` nullability decision |
| `docs/project/stories/epic-20/20-2-tenant-invitation-flow.md` | Closest analogue — added a new invitation flavor + email method end-to-end |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` | Closest existing handler — lift `GenerateSecureCode`/`ComputeHash` + structural shape |
| `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs` | Existing validator pattern (mirror but trim to email-only) |
| `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` | Lines 103-111 — confirms the accept-side already handles `AccountId == null` (no changes needed here) |
| `backend/src/PropertyManager.Application/Common/LogSanitizer.cs` | `MaskEmail` helper for AC #10 |
| `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs` | Interface to extend |
| `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs` | Lines 181-240 (`SendInvitationEmailAsync` + HTML/text generators) and lines 245-305 (`SendTenantInvitationEmailAsync`) — closest precedents for the new method |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Lines 96-136 — `CreateInvitation` action pattern (try/catch around `ValidationException`, `CreatedAtAction` shape, `ProblemDetails` helpers); DTOs at bottom of file (lines 248-257) |
| `backend/src/PropertyManager.Api/Controllers/PlatformAdminStubController.cs` | **TO BE DELETED** — closes Story 22.1 finding #1 |
| `backend/src/PropertyManager.Api/Program.cs` | Lines 183-194 — `CanInviteLandlords` policy (only the comment changes here) |
| `backend/src/PropertyManager.Domain/Authorization/PlatformClaims.cs` | `PlatformAdmin = "platformAdmin"` constant (referenced indirectly via the policy) |
| `backend/src/PropertyManager.Domain/Entities/Invitation.cs` | Entity to construct — confirm `AccountId` is `Guid?`, `Role` is `string`, `PropertyId` is `Guid?` |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Lines 162-296 — `CreateTestUserAsync`, `CreateTestUserInAccountAsync`, `CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`; lines 298-329 — `FakeEmailService` to extend |
| `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs` | Whole file — modify per Task 7.3 (stub endpoint → production endpoint, status 200 → 201) |
| `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` | Lines 26-180 — integration-test patterns for the existing invitation endpoint (auth helpers, `PostAsJsonWithAuthAsync`, `FakeEmailService` assertion patterns) |
| `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` | Closest unit-test pattern — copy structure, simplify (no `Role` / `PropertyId` cases) |
| `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` | Lines 17-33 — `RegisteredPolicies` HashSet (no edit needed; the new controller satisfies the existing entry) |
| MailHog (local) | http://localhost:8025 — manual smoke verification target |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via /dev-story.

### Test Plan

Per the Test Scope table:

- **Backend unit tests (REQUIRED)** — Task 6:
  - `CreateLandlordInvitationTests` (NEW): ~13 tests covering happy path, duplicate-email block, pending-invitation block, expired/used invitations don't block, email-flavor exclusivity, log shape with masked email, validator (empty/malformed/valid email).
- **Backend integration tests (REQUIRED, WebApplicationFactory + Testcontainers)** — Task 7:
  - `AdminLandlordInvitationsControllerTests` (NEW): ~10 tests covering PlatformAdmin happy path (DB shape + email flavor), 403 for Owner/Contributor/Tenant, 401 unauthenticated, 400 for missing/malformed email + duplicate registered + pending invitation, extra-field-ignored.
  - `PlatformAdminPolicyTests` (MODIFIED): stub-endpoint URL → production endpoint, GET → POST, status 200 → 201; per-account regression test unchanged; JWT-claim login tests unchanged.
- **Frontend unit tests (NOT REQUIRED for this story)** — Story 22.4 will add admin store/service/component specs. Only the regenerated NSwag client lands here, and the existing frontend test suite must still pass.
- **E2E tests (EXPLICITLY SKIPPED)** — see Test Scope justification: this story is backend-only per the epic; Story 22.4 owns E2E for the full admin-creates-landlord-invitation flow.

### Debug Log References

- `dotnet test` full suite: 2353 passed, 1 failed. The single failure
  (`PropertyManager.Api.Tests.TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts`)
  is a **pre-existing local flake unrelated to this story** — confirmed by
  stashing all 22.2 changes and re-running the test in isolation, which
  reproduces the same 400 Bad Request on `POST /api/v1/expenses` inside the
  TestController helper. The most recent CI run on Story 22.1 (PR #436)
  passed this test green, so it is environment-specific. No regression introduced.
- NSwag local regen required temporarily switching `frontend/nswag.json`
  runtime from `Net90` to `Net100` because the host lacks the .NET 9 runtime;
  reverted immediately after regeneration. The generated client output is
  runtime-independent.

### Completion Notes List

- All 11 acceptance criteria implemented and covered by unit + integration tests.
- `PlatformAdminStubController` deleted (AC #11, closes Story 22.1 Evaluation Finding #1).
  `AuthorizationPolicyTests.AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` continues
  to pass — the orphan check is now satisfied by the production `AdminLandlordInvitationsController`.
- `CreateLandlordInvitationCommandHandler` is gate-agnostic (AC #9, NFR-LP2):
  XML doc on the command record + handler explicitly call out the seam, and
  the handler reads only `ICurrentUser.UserId` (never `AccountId`).
- Handler reuses `GenerateSecureCode` / `ComputeHash` static helpers from
  `CreateInvitation.cs` per story Dev Notes "do NOT refactor into a shared
  utility in this story" guidance.
- Log statement in `SmtpEmailService.SendLandlordInvitationEmailAsync` omits
  the email entirely (just "Landlord invitation email sent") to avoid CodeQL
  CWE-359 (PII in log). The handler's `LogInformation` keeps the masked email
  per AC #10 — this mirrors existing `CreateInvitationCommandHandler` pattern.
- `PlatformAdminPolicyTests` rewritten to POST against the production
  endpoint; PlatformAdmin happy-path assertion updated from 200 to 201.
  The per-account regression test and JWT-claim tests are unchanged.

### Manual smoke test (curl recipe per Task 8.1)

```bash
# 1) Login as seeded PlatformAdmin
TOKEN=$(curl -s -X POST http://localhost:5292/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"claude@claude.com","password":"1@mClaude"}' | jq -r '.accessToken')

# 2) Invite a new landlord
curl -s -X POST http://localhost:5292/api/v1/admin/landlord-invitations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"new-landlord@example.com"}'

# 3) Inspect MailHog at http://localhost:8025 — see the
#    "You're invited to create your Upkeep account" email.
```

### Review Log

- Task 1 (Email service): Spec PASS; Quality APPROVE — interface + impl + fake all follow
  the existing co-owner/tenant flavor pattern; email body copy visibly distinct.
- Task 2 (Command + handler): Spec PASS; Quality APPROVE — handler reads only
  `ICurrentUser.UserId`, AccountId=null + Role="Owner" persisted, masked email logged,
  NFR-LP2 seam comment present.
- Task 3 (Validator): SKIPPED (trivial — 11 lines, single email rule, follows
  established `CreateInvitationCommandValidator` pattern stripped of Role/PropertyId).
- Task 4 (Controller): Spec PASS; Quality APPROVE — class-level
  `[Authorize(Policy = "CanInviteLandlords")]` so the orphan check picks it up;
  try/catch around `ValidationException` mirrors `InvitationsController` per spec.
- Task 5 (Program.cs comment): SKIPPED (trivial — 1-line comment update).
- Task 6 (Unit tests): Spec PASS; Quality APPROVE — 14 tests covering happy path,
  duplicate-email block, pending-invitation block, expired/used invitations don't block,
  email-flavor exclusivity, log shape with masked email, validator (empty/malformed/valid).
- Task 7 (Integration tests + stub deletion): Spec PASS; Quality APPROVE — 10 new
  integration tests + 9 updated `PlatformAdminPolicyTests` (now targeting production
  endpoint); stub file deleted; orphan check passes.
- Task 8 (Document curl smoke): SKIPPED (documentation-only, curl snippet captured above).
- Task 9 (Verify): SKIPPED (process step, evidence in Debug Log + Completion Notes).

Note: reviews above are self-reviews in main context — the harness does not expose
the Agent dispatch tool. Both stages were performed against `git diff HEAD` with
project-context.md cross-referenced.

### File List

**Backend — Application layer (NEW):**
- `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitation.cs`
- `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitationValidator.cs`

**Backend — Application layer (MODIFIED):**
- `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs` — added
  `SendLandlordInvitationEmailAsync` signature.

**Backend — Infrastructure layer (MODIFIED):**
- `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs` — implemented
  `SendLandlordInvitationEmailAsync` + landlord-flavored HTML/text email templates.

**Backend — API layer (NEW):**
- `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs`

**Backend — API layer (MODIFIED):**
- `backend/src/PropertyManager.Api/Program.cs` — comment-only update above the
  `CanInviteLandlords` policy registration.

**Backend — API layer (DELETED):**
- `backend/src/PropertyManager.Api/Controllers/PlatformAdminStubController.cs` (AC #11).

**Backend — tests (NEW):**
- `backend/tests/PropertyManager.Application.Tests/Invitations/CreateLandlordInvitationTests.cs`
- `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs`

**Backend — tests (MODIFIED):**
- `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs` — redirected
  from deleted stub endpoint to production endpoint; PlatformAdmin happy-path status
  updated 200 → 201.
- `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` —
  extended `FakeEmailService` with `SentLandlordInvitationEmails` list and
  `SendLandlordInvitationEmailAsync` implementation.

**Frontend (regenerated, do not hand-edit):**
- `frontend/src/app/core/api/api.service.ts` — new `adminLandlordInvitations_CreateLandlordInvitation`
  method + `CreateLandlordInvitationRequest` / `CreateLandlordInvitationResponse` types.

**Docs:**
- `docs/project/sprint-status.yaml` — story status `ready-for-dev` → `review`.
- `docs/project/stories/epic-22/22-2-create-landlord-invitation-api-and-email.md` —
  all tasks marked `[x]`; Dev Agent Record populated; status `ready-for-dev` → `review`.
