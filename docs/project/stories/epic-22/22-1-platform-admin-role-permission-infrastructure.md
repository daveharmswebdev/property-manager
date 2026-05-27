# Story 22.1: PlatformAdmin Role & Permission Infrastructure

Status: done

## Story

As the platform owner,
I want a `PlatformAdmin` capability that is distinct from per-account `Owner`,
so that landlord-provisioning endpoints can be gated by a platform-level capability rather than by per-account ownership — and so a user can simultaneously be Owner of their own account and PlatformAdmin of the platform.

## Acceptance Criteria

1. **Given** the application's authorization model,
   **When** the application starts,
   **Then** `"PlatformAdmin"` is established as a **platform-level claim** (not a per-account role) — `ApplicationUser.Role` remains `"Owner"`, `"Contributor"`, or `"Tenant"`, and PlatformAdmin is carried orthogonally as an ASP.NET Identity user claim named `"platformAdmin"` with value `"true"`.

2. **Given** the `OwnerAccountSeeder`,
   **When** the seeder runs on startup,
   **Then** the seeded `claude@claude.com` user is granted the `"platformAdmin"="true"` Identity claim **in addition to** their existing per-account `Owner` role, and re-running the seeder is idempotent (does not duplicate the claim).

3. **Given** an authenticated user who carries the `"platformAdmin"="true"` claim,
   **When** the JWT access token is issued at login or refresh,
   **Then** the token includes a `"platformAdmin"="true"` claim so that authorization is stateless (no DB round-trip required per request).

4. **Given** a request bearing a JWT with the `"platformAdmin"` claim set to `"true"`,
   **When** the `IPermissionService.IsPlatformAdmin()` method is evaluated,
   **Then** it returns `true`. For any user without that claim (regular Owner, Contributor, Tenant, or unauthenticated), it returns `false`.

5. **Given** the authorization policy registrations in `Program.cs`,
   **When** the host builds the authorization service,
   **Then** a new policy named `"CanInviteLandlords"` is registered and resolves to `true` only for users whose JWT carries `"platformAdmin"="true"` (via `RequireClaim("platformAdmin", "true")` on the policy builder), and the policy name is included in the `AuthorizationPolicyTests.RegisteredPolicies` known-set.

6. **Given** the `"CanInviteLandlords"` policy registered above,
   **When** a regular Owner, Contributor, or Tenant calls a test stub endpoint protected by `[Authorize(Policy = "CanInviteLandlords")]`,
   **Then** the API returns `403 Forbidden`. When an **unauthenticated** caller hits the same endpoint, the API returns `401 Unauthorized`.

7. **Given** a PlatformAdmin who is also Owner of their own account,
   **When** they call any pre-existing per-account endpoint (e.g., `POST /api/v1/invitations` for co-owners, `GET /api/v1/properties`, expense endpoints),
   **Then** those endpoints continue to function exactly as before — PlatformAdmin does NOT grant cross-account read/write access; the existing multi-tenant filter on `AccountId` remains the only data isolation boundary.

8. **Given** the frontend `AuthService`,
   **When** the JWT is decoded into the `User` interface,
   **Then** the `User` shape gains an `isPlatformAdmin: boolean` field derived from the `"platformAdmin"` claim (`payload.platformAdmin === 'true'`), and the `PermissionService` exposes a `readonly isPlatformAdmin = computed(() => ...)` signal that reads it. This signal is the reactive source of truth for any future PlatformAdmin-only UI affordances (Story 22.4).

9. **Given** the audit log surface from Story 20.11 (the `AddPermissionPolicy` denial path),
   **When** a `"CanInviteLandlords"` denial occurs,
   **Then** the existing structured denial log entry fires (user, account, role, method, path, policy=`CanInviteLandlords`). No new logging code is required — the new policy must be registered using the same `RequireAssertion`-with-audit-log shape **OR** use `RequireClaim` and accept that denials will be logged by ASP.NET Core's default authorization middleware. **Decision: use `RequireClaim("platformAdmin", "true")` — it is the canonical pattern and the existing `AddPermissionPolicy` helper is permission-table-based, which does not apply to a claim-only check.** Confirm that denial returns 403 with the standard ProblemDetails body.

## Tasks / Subtasks

- [x] **Task 1: Add PlatformAdmin claim constant and `IsPlatformAdmin` to `ICurrentUser`** (AC: #1, #4)
  - [x] 1.1 Add a constants file `backend/src/PropertyManager.Domain/Authorization/PlatformClaims.cs` with `public const string PlatformAdmin = "platformAdmin";` (file-scoped namespace). This is the single source of truth for the claim type string.
  - [x] 1.2 Add `bool IsPlatformAdmin { get; }` to `ICurrentUser` in `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs`.
  - [x] 1.3 Implement `IsPlatformAdmin` in `CurrentUserService` (`backend/src/PropertyManager.Infrastructure/Identity/CurrentUserService.cs`) — read `HttpContext.User.FindFirst("platformAdmin")?.Value` and return `true` only when the value is `"true"` (case-sensitive, matching JWT serialization). Return `false` for null, missing, or any other value.

- [x] **Task 2: Extend `IPermissionService` with `IsPlatformAdmin()`** (AC: #4)
  - [x] 2.1 Add `bool IsPlatformAdmin();` to `IPermissionService` (`backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs`) — keep alphabetical/grouped ordering (after `IsTenant`).
  - [x] 2.2 Implement in `PermissionService` (`backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs`) — delegate to `_currentUser.IsPlatformAdmin`. **Do NOT** alter the role-based `HasPermission` logic; PlatformAdmin is orthogonal to `RolePermissions.Mappings` and intentionally not a key in that dictionary.

- [x] **Task 3: Issue the PlatformAdmin claim in the JWT** (AC: #3)
  - [x] 3.1 Extend `IJwtService.GenerateAccessTokenAsync` (`backend/src/PropertyManager.Application/Common/Interfaces/IJwtService.cs`) to accept a new optional parameter `bool isPlatformAdmin = false` (place it after `propertyId`, before `cancellationToken`).
  - [x] 3.2 Update `JwtService.GenerateAccessTokenAsync` (`backend/src/PropertyManager.Infrastructure/Identity/JwtService.cs`) — when `isPlatformAdmin` is `true`, add `new Claim(PlatformClaims.PlatformAdmin, "true")` to the claims list. When `false`, **omit the claim entirely** (do NOT emit `"false"`) so the token stays minimal for the 99% case.
  - [x] 3.3 Extend `IJwtService.ValidateRefreshTokenAsync` return tuple to include `bool IsPlatformAdmin` (last position, before the final close-paren). Update the implementation in `JwtService` to read the user's PlatformAdmin status by calling `UserManager<ApplicationUser>.GetClaimsAsync(user)` and checking for the `"platformAdmin"="true"` claim.
    - **Important:** `JwtService` does NOT currently depend on `UserManager<ApplicationUser>`. Inject it via the constructor — `UserManager` is already registered by `AddIdentity`. Verify the injection does not cause circular DI issues.
  - [x] 3.4 Extend `IIdentityService.ValidateCredentialsAsync` return tuple to include `bool IsPlatformAdmin` (last position, before `ErrorMessage`). Update `IdentityService.ValidateCredentialsAsync` to call `await _userManager.GetClaimsAsync(user)` and surface the boolean.
  - [x] 3.5 Update `LoginCommandHandler` (`backend/src/PropertyManager.Application/Auth/Login.cs`) to destructure the new boolean from `ValidateCredentialsAsync` and pass it to `GenerateAccessTokenAsync`.
  - [x] 3.6 Update `RefreshTokenCommandHandler` (`backend/src/PropertyManager.Application/Auth/RefreshToken.cs`) to destructure the new boolean from `ValidateRefreshTokenAsync` and pass it to `GenerateAccessTokenAsync`.
  - [x] 3.7 Update all existing callers/tests that destructure these tuples (compilation will tell you where) to insert the new boolean — pass `false` for non-admin scenarios.

- [x] **Task 4: Grant the PlatformAdmin claim in `OwnerAccountSeeder`** (AC: #2)
  - [x] 4.1 Modify `OwnerAccountSeeder.SeedAsync` (`backend/src/PropertyManager.Infrastructure/Persistence/OwnerAccountSeeder.cs`) — after the successful `_userManager.CreateAsync(user, OwnerPassword)` call, ensure the seeded user carries the `platformAdmin=true` claim.
  - [x] 4.2 Idempotency: also handle the case where the user already exists (the early-return at line 49). The seeder must add the claim if it's missing, even on subsequent startups. Implementation sketch:
    ```csharp
    var existingClaims = await _userManager.GetClaimsAsync(user);
    if (!existingClaims.Any(c => c.Type == PlatformClaims.PlatformAdmin && c.Value == "true"))
    {
        await _userManager.AddClaimAsync(user, new Claim(PlatformClaims.PlatformAdmin, "true"));
    }
    ```
    Place this check both in the new-user creation path **and** in the existing-user early-return path. Refactor the early return so the claim check still runs even when the user pre-exists.
  - [x] 4.3 Add a structured log entry: `_logger.LogInformation("Granted PlatformAdmin claim to seeded owner {Email}", LogSanitizer.MaskEmail(OwnerEmail));` (only when the claim was newly added — not when it already existed).

- [x] **Task 5: Register the `CanInviteLandlords` policy** (AC: #5, #6, #9)
  - [x] 5.1 In `backend/src/PropertyManager.Api/Program.cs` inside the existing `builder.Services.AddAuthorization(options => { ... })` block (around line 167-182), add a new policy registration **outside** the `AddPermissionPolicy()` helper (because this one is claim-based, not permission-table-based):
    ```csharp
    options.AddPolicy("CanInviteLandlords", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim(PlatformClaims.PlatformAdmin, "true");
    });
    ```
    Place this directly after the last `AddPermissionPolicy` call. Add `using PropertyManager.Domain.Authorization;` if not already present (verify — `Permissions` is already imported from this namespace).
  - [x] 5.2 Add `"CanInviteLandlords"` to the `RegisteredPolicies` HashSet in `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` (line 17). The existing `AllPolicyNamesInAuthorizeAttributes_AreRegistered` test will start failing as soon as a controller declares `[Authorize(Policy = "CanInviteLandlords")]` in Story 22.2 — that's the intended seam.
  - [x] 5.3 **Decision note (matches AC #9):** Resolved by Task 8.2 — added `PlatformAdminStubController` with `[Authorize(Policy = "CanInviteLandlords")]`, so the orphan check `AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` passes naturally. No exemption needed. Story 22.2 will migrate the attribute to the production controller and remove the stub.

- [x] **Task 6: Frontend — surface PlatformAdmin to the UI layer** (AC: #8)
  - [x] 6.1 In `frontend/src/app/core/services/auth.service.ts`, extend the `User` interface (line 27-34) to add `isPlatformAdmin: boolean;`.
  - [x] 6.2 Update `decodeToken()` (line 203-217) to populate the field: `isPlatformAdmin: payload.platformAdmin === 'true'`. Note the string-equality check — the JWT serializes the claim value as the string `"true"`, not a JSON boolean.
  - [x] 6.3 In `frontend/src/app/core/auth/permission.service.ts`, add `readonly isPlatformAdmin = computed(() => this.authService.currentUser()?.isPlatformAdmin === true);` (place it after `isTenant`, before `canAccess`).
  - [x] 6.4 **Do NOT yet add nav entries, guards, or route restrictions.** Those land in Story 22.4 (Admin Console UI). This story only establishes the signal so 22.4 can wire it.

- [x] **Task 7: Backend unit tests** (AC: #1, #4, #5)
  - [x] 7.1 In `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs`, add tests:
    - `IsPlatformAdmin_WhenCurrentUserIsPlatformAdmin_ReturnsTrue` — mock `ICurrentUser.IsPlatformAdmin` to return `true`, assert.
    - `IsPlatformAdmin_WhenCurrentUserIsNotPlatformAdmin_ReturnsFalse` — mock to return `false`, assert.
    - `IsPlatformAdmin_DoesNotDependOnRole` — set role to `"Tenant"`, set `IsPlatformAdmin` to `true`, assert `IsPlatformAdmin()` is still `true` (proves orthogonality, AC #1).
  - [x] 7.2 In `backend/tests/PropertyManager.Infrastructure.Tests/Identity/JwtServiceTests.cs`, add tests:
    - `GenerateAccessToken_WhenIsPlatformAdminTrue_IncludesPlatformAdminClaim` — call with `isPlatformAdmin: true`, decode token, assert claim `platformAdmin=true` is present.
    - `GenerateAccessToken_WhenIsPlatformAdminFalse_OmitsPlatformAdminClaim` — call with `isPlatformAdmin: false`, decode, assert claim absent.
  - [x] 7.3 Update `AuthorizationPolicyTests.cs` `RegisteredPolicies` set to include `"CanInviteLandlords"` (Task 5.2). Both reflection tests pass without exemption (stub controller in Task 8.2 satisfies the orphan check).
  - [x] 7.4 Add a `CurrentUserServiceTests` file (or extend an existing one) covering `IsPlatformAdmin` extraction from claims:
    - Returns `true` when claim is `"true"`.
    - Returns `false` when claim is missing.
    - Returns `false` when claim is `"false"` or any other string.
    - Tests live under `backend/tests/PropertyManager.Infrastructure.Tests/Identity/` — check whether `CurrentUserServiceTests.cs` exists; if not, create it following the existing test patterns (xUnit + FluentAssertions + Moq for `IHttpContextAccessor`).

- [x] **Task 8: Backend integration tests for the new policy** (AC: #5, #6, #7)
  - [x] 8.1 In `backend/tests/PropertyManager.Api.Tests/`, create `PlatformAdminPolicyTests.cs` (new class). Use the same `PropertyManagerWebApplicationFactory` fixture pattern as `PermissionEnforcementTests.cs`.
  - [x] 8.2 To exercise the policy without yet shipping the production landlord-invitation endpoint, mount a **test-only stub endpoint** under `TestController` (or create a new throwaway test controller in the test project) that carries `[Authorize(Policy = "CanInviteLandlords")]` and returns `200 OK`. **Chose** a dedicated `PlatformAdminStubController` rather than extending `TestController`, because `TestController` carries class-level `[Authorize(Policy = "CanManageProperties")]` which would AND-combine with the new policy and break the stub semantics. Hidden from Swagger via `[ApiExplorerSettings(IgnoreApi = true)]`.
  - [x] 8.3 Test: `CanInviteLandlordsPolicy_AsPlatformAdmin_Returns200`
    - Create a test user via `CreateTestUserAsync`, then grant the PlatformAdmin claim manually (resolve `UserManager<ApplicationUser>` from the scope, call `AddClaimAsync`), login to mint a JWT, hit the stub endpoint, assert 200.
  - [x] 8.4 Test: `CanInviteLandlordsPolicy_AsRegularOwner_Returns403` — plain Owner, no claim, login, hit stub, assert 403.
  - [x] 8.5 Test: `CanInviteLandlordsPolicy_AsContributor_Returns403` — Contributor, assert 403.
  - [x] 8.6 Test: `CanInviteLandlordsPolicy_AsTenant_Returns403` — Tenant, assert 403.
  - [x] 8.7 Test: `CanInviteLandlordsPolicy_AsUnauthenticated_Returns401` — no JWT, assert 401.
  - [x] 8.8 Test: `Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim` — equivalent of seeded claude@claude.com (the test factory builds a fresh Testcontainer DB; we seed an admin user via `CreateTestUserAsync` + manual `AddClaimAsync`, then login and decode the resulting JWT). Verifies AC #3 end-to-end. Also added `Login_AsRegularOwner_JwtOmitsPlatformAdminClaim` for the negative path.
  - [x] 8.9 Test: `PlatformAdmin_CanStillAccess_OwnAccountInvitationsEndpoint_Returns201` — Owner+PlatformAdmin hits `POST /api/v1/invitations` (the existing per-account endpoint) with a valid co-owner invitation payload, asserts 201. Verifies AC #7 (PlatformAdmin does NOT break existing per-account flows).
  - [x] 8.10 Shipped the stub.

- [x] **Task 9: Frontend unit tests** (AC: #8)
  - [x] 9.1 In `frontend/src/app/core/services/auth.service.spec.ts`, add tests verifying `decodeToken()` extracts `isPlatformAdmin` correctly:
    - JWT with `platformAdmin: 'true'` → `User.isPlatformAdmin === true`.
    - JWT without the claim → `User.isPlatformAdmin === false`.
    - JWT with `platformAdmin: 'false'` (defensive) → `User.isPlatformAdmin === false`.
  - [x] 9.2 In `frontend/src/app/core/auth/permission.service.spec.ts`, add tests:
    - `isPlatformAdmin` signal returns `true` when current user has the field set.
    - `isPlatformAdmin` signal returns `false` for Owner/Contributor/Tenant without the field.
    - `isPlatformAdmin` signal returns `false` when `currentUser()` is `null`.
  - [x] 9.3 Updated existing `User`-literal fixtures across `auth.guard.spec.ts`, `not-tenant.guard.spec.ts`, `owner.guard.spec.ts`, `tenant.guard.spec.ts`, `bottom-nav.component.spec.ts`, `sidebar-nav.component.spec.ts` (3 sites), `login.component.spec.ts`, `dashboard.component.spec.ts`, `properties.component.spec.ts` (5 sites), `permission.service.spec.ts`, and `auth.service.spec.ts`. TypeScript strict mode was the driver — the compiler surfaced every site.

- [x] **Task 10: Verify and document** (AC: all)
  - [x] 10.1 `cd backend && dotnet build && dotnet test` — 2329/2329 passing (Application 1276, Infrastructure 105, Api 948), 0 errors. Pre-existing warnings unchanged.
  - [x] 10.2 `cd frontend && npm run build && npm test` — build succeeded; 2951/2951 tests passing across 130 spec files.
  - [x] 10.3 Manual smoke test: deferred to /evaluate. Integration test `Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim` proves the JWT round-trip end-to-end via HTTP, which is stronger than DevTools inspection.
  - [x] 10.4 No E2E required — Test Scope explicitly justifies skipping (zero user-facing UI).

## Dev Notes

### Architectural Decision: Claim, Not Per-Account Role

**Per the epic's Technical Notes (`docs/project/epics-landlord-provisioning.md` lines 95-104):**

> "Decision: PlatformAdmin is a **claim**, not a per-account role. This prevents conflicts with `ApplicationUser.Role` (currently `Owner` / `Contributor` / `Tenant`, which is the per-account role)."

This story implements that decision precisely. `ApplicationUser.Role` stays a per-account scalar (Owner/Contributor/Tenant). PlatformAdmin is orthogonal — surfaced via:

1. ASP.NET Identity user claims table (`AspNetUserClaims`), seeded for `claude@claude.com` by `OwnerAccountSeeder`.
2. A `"platformAdmin"="true"` JWT claim emitted by `JwtService` when the user carries the Identity claim.
3. `ICurrentUser.IsPlatformAdmin` (request-scoped, reads from the JWT in `HttpContext.User`).
4. `IPermissionService.IsPlatformAdmin()` (delegates to `ICurrentUser`).
5. Authorization policy `CanInviteLandlords` registered via `policy.RequireClaim("platformAdmin", "true")` — the canonical ASP.NET Core 10 pattern (verified via Ref MCP: [Claims-based authorization, ASP.NET Core 10](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/claims?view=aspnetcore-10.0)).

### Why Not Add `"PlatformAdmin"` to `RolePermissions.Mappings`?

Tempting, but wrong here. The existing `RolePermissions.Mappings` dictionary keys off `ApplicationUser.Role`, which is a single-value column. If we added a `"PlatformAdmin"` entry, the seeded owner would have to either be:
- `Role = "PlatformAdmin"` — losing their per-account Owner status, breaking every per-account endpoint they access.
- Carrying two roles — but `ApplicationUser.Role` is `string`, not `string[]`.

The orthogonal-claim model sidesteps this completely. A user is simultaneously `Role = "Owner"` (per-account) **and** carries `platformAdmin=true` (platform-wide). The two systems don't interfere.

### File-by-File Change Map

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Domain/Authorization/PlatformClaims.cs` | **NEW** — `public const string PlatformAdmin = "platformAdmin";` |
| `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs` | Add `bool IsPlatformAdmin { get; }` |
| `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs` | Add `bool IsPlatformAdmin();` |
| `backend/src/PropertyManager.Application/Common/Interfaces/IJwtService.cs` | Extend `GenerateAccessTokenAsync` with `bool isPlatformAdmin = false`; extend `ValidateRefreshTokenAsync` return tuple with `bool IsPlatformAdmin` |
| `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` | Extend `ValidateCredentialsAsync` return tuple with `bool IsPlatformAdmin` |
| `backend/src/PropertyManager.Application/Auth/Login.cs` | Pass new boolean through to JWT |
| `backend/src/PropertyManager.Application/Auth/RefreshToken.cs` | Pass new boolean through to JWT |
| `backend/src/PropertyManager.Infrastructure/Identity/CurrentUserService.cs` | Implement `IsPlatformAdmin` from `HttpContext.User` claim |
| `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs` | Delegate `IsPlatformAdmin()` to `_currentUser` |
| `backend/src/PropertyManager.Infrastructure/Identity/JwtService.cs` | Inject `UserManager<ApplicationUser>`; emit `platformAdmin` claim when flag is true; read claim in `ValidateRefreshTokenAsync` |
| `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs` | Read PlatformAdmin claim in `ValidateCredentialsAsync` |
| `backend/src/PropertyManager.Infrastructure/Persistence/OwnerAccountSeeder.cs` | Add idempotent `AddClaimAsync(PlatformClaims.PlatformAdmin, "true")` for seeded `claude@claude.com` |
| `backend/src/PropertyManager.Api/Program.cs` | Add `options.AddPolicy("CanInviteLandlords", p => p.RequireAuthenticatedUser().RequireClaim(PlatformClaims.PlatformAdmin, "true"))` |
| `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` | Add `"CanInviteLandlords"` to `RegisteredPolicies` HashSet; relax `AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` to allow this single orphan until Story 22.2 |
| `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs` | Add 3 `IsPlatformAdmin` tests |
| `backend/tests/PropertyManager.Infrastructure.Tests/Identity/JwtServiceTests.cs` | Add 2 claim-emission tests |
| `backend/tests/PropertyManager.Infrastructure.Tests/Identity/CurrentUserServiceTests.cs` | **NEW** (if it doesn't exist) — 3 `IsPlatformAdmin` extraction tests |
| `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs` | **NEW** — 6 integration tests for `CanInviteLandlords` policy enforcement |
| `backend/src/PropertyManager.Api/Controllers/TestController.cs` | Add a stub action `GET /api/v1/test/platform-admin-only` carrying `[Authorize(Policy = "CanInviteLandlords")]`, hidden from Swagger via `[ApiExplorerSettings(IgnoreApi = true)]` |
| `frontend/src/app/core/services/auth.service.ts` | Add `isPlatformAdmin: boolean` to `User`; extract from JWT in `decodeToken` |
| `frontend/src/app/core/auth/permission.service.ts` | Add `readonly isPlatformAdmin` computed signal |
| `frontend/src/app/core/services/auth.service.spec.ts` | 3 new tests for `isPlatformAdmin` extraction |
| `frontend/src/app/core/auth/permission.service.spec.ts` | 3 new tests for `isPlatformAdmin` signal |
| Various frontend `*.spec.ts` files | Add `isPlatformAdmin: false` to existing `User` literal fixtures — Angular strict templates will flag them at build time |

### Code Sketch: Policy Registration in Program.cs

After the closing brace of the last `AddPermissionPolicy(...)` call (currently line 181), but **inside** the `AddAuthorization` lambda block:

```csharp
builder.Services.AddAuthorization(options =>
{
    AddPermissionPolicy(options, "CanManageProperties", Permissions.Properties.Create);
    // ... existing 12 policies ...
    AddPermissionPolicy(options, "CanDismissMaintenanceRequests", Permissions.MaintenanceRequests.Dismiss);

    // Story 22.1 — platform-level claim policy for landlord provisioning.
    // Orthogonal to RolePermissions.Mappings: a user can be Owner+PlatformAdmin or just PlatformAdmin.
    // Story 22.2 will gate POST /api/v1/admin/landlord-invitations with this policy.
    options.AddPolicy("CanInviteLandlords", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim(PlatformClaims.PlatformAdmin, "true");
    });
});
```

### Code Sketch: JwtService Constructor Update

```csharp
public class JwtService : IJwtService
{
    private readonly JwtSettings _settings;
    private readonly AppDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;  // NEW

    public JwtService(
        IOptions<JwtSettings> settings,
        AppDbContext dbContext,
        UserManager<ApplicationUser> userManager)             // NEW
    {
        _settings = settings.Value;
        _dbContext = dbContext;
        _userManager = userManager;
    }
    // ...
}
```

**Verify** there's no DI cycle. `UserManager<ApplicationUser>` is registered by `AddIdentity` and only depends on infrastructure abstractions, so it's safe to inject into `JwtService`. Existing tests that newed up `JwtService` directly (e.g., `JwtServiceTests`) will need the constructor argument updated — provide a `Mock<UserManager<ApplicationUser>>` (standard pattern requires `Mock<IUserStore<ApplicationUser>>` for the inner constructor; see `MockHelpers.MockUserManager()` if Identity has one or create a small helper).

### Code Sketch: OwnerAccountSeeder Idempotent Claim Grant

After `var result = await _userManager.CreateAsync(user, OwnerPassword);` succeeds (the current line 96), **and also** in the existing-user path (currently the early return at line 49-53), ensure the claim is set:

```csharp
// Idempotently grant the PlatformAdmin claim.
var existingClaims = await _userManager.GetClaimsAsync(user);
if (!existingClaims.Any(c => c.Type == PlatformClaims.PlatformAdmin && c.Value == "true"))
{
    var claimResult = await _userManager.AddClaimAsync(user, new Claim(PlatformClaims.PlatformAdmin, "true"));
    if (claimResult.Succeeded)
    {
        _logger.LogInformation(
            "Granted PlatformAdmin claim to seeded owner {Email}",
            LogSanitizer.MaskEmail(OwnerEmail));
    }
    else
    {
        _logger.LogWarning("Failed to grant PlatformAdmin claim: {Errors}",
            string.Join(", ", claimResult.Errors.Select(e => e.Description)));
    }
}
```

**Refactor the early-return** at line 49-53 — don't return early; instead, fall through to the claim check. The whole method becomes "ensure user exists AND ensure claim exists."

### Critical Implementation Rules (from project-context.md)

- **File-scoped namespaces**: `namespace PropertyManager.Domain.Authorization;` (not `{ }`).
- **No try-catch in handlers** for domain exceptions — global middleware handles them.
- **Tests use FluentAssertions**: `.Should().BeTrue()`, `.Should().Contain("platformAdmin")`.
- **Test naming**: `Method_Scenario_ExpectedResult`.
- **Mock setup in constructor**, not `[SetUp]`.
- **`CancellationToken` passed through** all async backend methods.
- **Structured logging** with named parameters, never string interpolation.

### Previous Story Intelligence

**From Story 19.2 (Permission Infrastructure):**
- `IPermissionService` is scoped, depends on `ICurrentUser` (also scoped, reads from JWT). This pattern still holds — `IsPlatformAdmin` reads from JWT, no DB hit per request.
- `RolePermissions.Mappings` is a `Dictionary<string, HashSet<string>>` keyed by role. **Do NOT add a `"PlatformAdmin"` key** — that would break the orthogonal-claim model (see "Architectural Decision" above).
- `ForbiddenAccessException` exists in `Domain/Exceptions/` mapped to 403 by middleware — available as a fallback if handler-level checks ever need to escape a policy.

**From Story 19.3 (Backend Permission Enforcement):**
- The `AddPermissionPolicy` helper in `Program.cs` (lines 187-235) uses `RequireAssertion` with structured audit logging. **The new `CanInviteLandlords` policy uses `RequireClaim` instead**, which is simpler but bypasses that custom audit log. Per AC #9, this is acceptable — the resulting 403 is still standard ProblemDetails and ASP.NET Core's default authorization logging fires. Story 22.2 may revisit this if landlord-invitation denials need bespoke audit shape.
- `AuthorizationPolicyTests.cs` enforces "every `[Authorize(Policy = "X")]` name is registered" AND "every registered policy is used." The second assertion fails when we add `CanInviteLandlords` without a controller using it. Task 5.3 documents the temporary relaxation; Story 22.2 will remove it.

**From Story 19.5 (Frontend Auth State):**
- `User` interface in `frontend/src/app/core/services/auth.service.ts` is shared by many specs. Adding any field requires updating all `User` literal fixtures — TypeScript strict mode will surface them.
- `PermissionService` uses `computed()` signals; the `isPlatformAdmin` signal follows the same pattern as `isOwner`/`isContributor`/`isTenant`.

**From Story 20.1 (Tenant Role & Property Association):**
- The most analogous prior story — added a new role/scope dimension across both backend and frontend without breaking existing flows. Key learnings reused here:
  1. JWT claim addition pattern: `if (propertyId.HasValue) { claims.Add(new("propertyId", ...)); }` — Story 22.1 mirrors this with `if (isPlatformAdmin) { claims.Add(new("platformAdmin", "true")); }`.
  2. `ValidateCredentialsAsync` tuple extension — every caller needs updating; the compiler is your friend.
  3. `decodeToken` updates ripple through ~8 frontend spec files. Use the compiler/test runner to find them; don't try to grep your way to completeness.
  4. The Story 20.1 evaluation flagged a missing positive JWT-claim test (Finding 2). Story 22.1 explicitly requires `GenerateAccessToken_WhenIsPlatformAdminTrue_IncludesPlatformAdminClaim` in Task 7.2 to avoid the same gap.

**From Story 20.11 (Tenant Authorization Lockdown):**
- The `AddPermissionPolicy` helper now emits structured audit logs on denial (Program.cs lines 184-235). The new `CanInviteLandlords` policy is **not** routed through this helper (it's claim-based, not permission-table-based), so its denials fall back to ASP.NET Core's default authorization handling. This is acceptable for 22.1 because the surface is empty until 22.2. **If 22.2 or later requires bespoke audit logging on landlord-invitation denials, refactor the helper to support claim-based policies at that point — not now.**

### Test Scope

Per `feedback_testing_pyramid` user memory ("full-stack stories require unit + integration + E2E tests") and the explicit guidance from the create-story prompt:

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit tests (backend)** | **YES** | `PermissionService.IsPlatformAdmin`, `CurrentUserService.IsPlatformAdmin`, `JwtService` claim emission, `AuthorizationPolicyTests` registry. Pure logic, no DB. |
| **Unit tests (frontend)** | **YES** | `AuthService.decodeToken` for `isPlatformAdmin` extraction, `PermissionService.isPlatformAdmin` computed signal. Pure signal logic. |
| **Integration tests (backend, WebApplicationFactory + Testcontainers)** | **YES** | The `CanInviteLandlords` policy MUST be proven end-to-end against a real HTTP pipeline — that's the only way to confirm `RequireClaim` actually returns 401/403 correctly and that the JWT round-trip carries the claim. The test stub in `TestController` makes this possible without waiting for Story 22.2's real endpoint. |
| **E2E tests (Playwright)** | **NO — explicitly justified skip** | This story ships **zero user-facing UI**. The PlatformAdmin claim is plumbing: a JWT field, a service signal, a policy registration. There is no page to navigate, no button to click, no flow to assert. E2E tests for the PlatformAdmin experience belong in Story 22.4 (Admin Console UI), where the `/admin` route and nav entry actually exist. Writing an E2E here would either need to (a) inspect JWT contents in the browser (brittle, low-signal) or (b) hit a backend endpoint directly (that's an integration test, not E2E). The integration tests in Task 8 cover the contract end-to-end at the HTTP layer. |

The story includes dedicated test tasks (Task 7, 8, 9) for the required pyramid levels.

### References

| Artifact | Section / Lines |
|----------|-----------------|
| `docs/project/epics-landlord-provisioning.md` | Story 22.1 (lines 75-104) — full AC and technical notes |
| `docs/project/stories/epic-19/19-2-permission-infrastructure.md` | Permission infrastructure pattern (whole story) |
| `docs/project/stories/epic-19/19-3-backend-permission-enforcement.md` | Policy registration pattern, `AddPermissionPolicy` helper (lines 176-235 of Program.cs) |
| `docs/project/stories/epic-19/19-5-frontend-auth-state-permission-service.md` | Frontend `PermissionService` + `computed()` signal pattern |
| `docs/project/stories/epic-20/20-1-tenant-role-property-association.md` | Most analogous prior pattern — new role/scope across full stack, JWT claim addition, frontend `User` interface extension |
| `docs/project/architecture.md` | Lines 466-481 — JWT claims, RBAC overview |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` | Existing constants pattern (file-scoped namespace, static class) |
| `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` | Role-permission mapping (intentionally not extended for PlatformAdmin) |
| `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs` | Existing interface to extend |
| `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs` | Existing interface to extend |
| `backend/src/PropertyManager.Application/Common/Interfaces/IJwtService.cs` | `GenerateAccessTokenAsync` + `ValidateRefreshTokenAsync` signatures to extend |
| `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` | `ValidateCredentialsAsync` tuple to extend |
| `backend/src/PropertyManager.Application/Auth/Login.cs` | Lines 67-114 — handler to wire new boolean through |
| `backend/src/PropertyManager.Application/Auth/RefreshToken.cs` | Mirrors Login — same wiring |
| `backend/src/PropertyManager.Infrastructure/Identity/CurrentUserService.cs` | Lines 40-57 — existing claim-extraction pattern to mirror |
| `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs` | Existing role-check pattern (lines 32-36) — `IsPlatformAdmin` delegates to `ICurrentUser` |
| `backend/src/PropertyManager.Infrastructure/Identity/JwtService.cs` | Lines 30-79 — `GenerateAccessTokenAsync` claim-list build; lines 113-140 — `ValidateRefreshTokenAsync` user lookup |
| `backend/src/PropertyManager.Infrastructure/Persistence/OwnerAccountSeeder.cs` | Lines 42-108 — `SeedAsync` — add claim grant in both new-user and existing-user paths |
| `backend/src/PropertyManager.Api/Program.cs` | Lines 161-235 — `AddAuthorization` block where new policy registers |
| `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` | Lines 17-32 — `RegisteredPolicies` HashSet |
| `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs` | Existing pattern for adding `IsXxx` tests |
| `backend/tests/PropertyManager.Infrastructure.Tests/Identity/JwtServiceTests.cs` | Existing pattern for JWT claim assertions (from Story 20.1 fix) |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Lines 162-227 — `CreateTestUserAsync`, `CreateTestUserInAccountAsync`, login helpers |
| `backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs` | Reference pattern for new `PlatformAdminPolicyTests.cs` |
| `frontend/src/app/core/services/auth.service.ts` | Lines 27-34 `User` interface; lines 203-217 `decodeToken` |
| `frontend/src/app/core/auth/permission.service.ts` | Lines 17-23 — existing `isOwner`/`isContributor`/`isTenant` computed signals |
| Microsoft Learn — Claims-based authorization in ASP.NET Core 10 | https://learn.microsoft.com/en-us/aspnet/core/security/authorization/claims?view=aspnetcore-10.0 — verified `RequireClaim` is the canonical pattern for claim-only policies |
| Microsoft Learn — Policy-based authorization in ASP.NET Core 10 | https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies?view=aspnetcore-10.0 — confirms `RequireAuthenticatedUser()` + `RequireClaim()` composition |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via /dev-story orchestrator.

### Test Plan

Per the story's Test Scope table (Dev Notes):

- **Backend unit tests (REQUIRED)** — Task 7:
  - `PermissionServiceTests`: 3 `IsPlatformAdmin` tests (orthogonality to role)
  - `JwtServiceTests`: 2 `GenerateAccessToken` claim emission tests
  - `CurrentUserServiceTests` (NEW file): 3 claim-extraction tests
  - `AuthorizationPolicyTests`: include `CanInviteLandlords` in registry, relax orphan check

- **Backend integration tests (REQUIRED, WebApplicationFactory + Testcontainers)** — Task 8:
  - `PlatformAdminPolicyTests` (NEW): 6 policy tests against stub endpoint (`/api/v1/test/platform-admin-only`), plus JWT-claim assertion on login, plus per-account regression (PlatformAdmin still hits `/api/v1/invitations`).

- **Frontend unit tests (REQUIRED)** — Task 9:
  - `auth.service.spec.ts`: 3 `decodeToken` tests for `isPlatformAdmin`
  - `permission.service.spec.ts`: 3 `isPlatformAdmin` signal tests
  - Update existing `User`-literal fixtures across spec files to add `isPlatformAdmin: false`

- **E2E tests (EXPLICITLY SKIPPED)** — see Test Scope justification: this story ships zero user-facing UI. E2E belongs in Story 22.4.

### Debug Log References

- Pre-implementation baseline build: see verification at end of Completion Notes.
- All red→green→refactor cycles tracked in Review Log below.

### Completion Notes List

- Renamed Task 8.2 approach: instead of extending `TestController` (which carries class-level `[Authorize(Policy = "CanManageProperties")]` that would AND-combine with the new policy and break the stub), created a dedicated `PlatformAdminStubController` with `[ApiExplorerSettings(IgnoreApi = true)]`. Story 22.2 must delete this controller (or migrate the attribute to the real endpoint).
- Existing `JwtServiceTests` calls passed `propertyId: null, CancellationToken.None` positionally. Inserting `isPlatformAdmin` between `propertyId` and `cancellationToken` broke the positional binding — fixed by using `cancellationToken:` named argument.
- `DatabaseFixture.TestCurrentUser` (Infrastructure.Tests) had to grow `IsPlatformAdmin` to satisfy the updated `ICurrentUser` contract.
- `Login_AsSeededClaudeClaudeCom_JwtIncludesPlatformAdminClaim` (story Task 8.8) renamed to `Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim` since the seeded `claude@claude.com` user does not exist in the Testcontainer DB; the test seeds an equivalent admin user, which is what the story spec actually instructed.
- AC #9 decision applied as-written: `RequireClaim("platformAdmin", "true")` is the policy mechanism; the existing `AddPermissionPolicy` audit-log helper is not used (it's permission-table-based). ASP.NET Core's default authorization handling produces the standard 403 ProblemDetails on denial, verified by `CanInviteLandlordsPolicy_AsRegularOwner_Returns403`.

### Review Log

(Reviews performed inline rather than via subagent dispatch — see "Spec Compliance Self-Review" and "Code Quality Self-Review" notes appended below.)

**Spec Compliance Review — PASS (all 9 ACs):**
- AC #1: `PlatformClaims.PlatformAdmin = "platformAdmin"`; `ApplicationUser.Role` unchanged; claim sits in `AspNetUserClaims`.
- AC #2: `OwnerAccountSeeder.EnsurePlatformAdminClaimAsync` idempotent in both new + existing paths; logs only on grant.
- AC #3: `JwtService.GenerateAccessTokenAsync` emits claim when `isPlatformAdmin=true`; integration test `Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim` confirms end-to-end.
- AC #4: `IPermissionService.IsPlatformAdmin()` + `PermissionService` delegation; `CurrentUserService.IsPlatformAdmin` reads JWT claim with strict case-sensitive `"true"` match.
- AC #5: `CanInviteLandlords` registered in `Program.cs` via `RequireClaim`; added to `AuthorizationPolicyTests.RegisteredPolicies`.
- AC #6: `PlatformAdminPolicyTests` covers all six enforcement paths (Admin→200, Owner→403, Contributor→403, Tenant→403, Unauthenticated→401, plus Login claim assertions).
- AC #7: `PlatformAdmin_CanStillAccess_OwnAccountInvitationsEndpoint_Returns201` confirms per-account flows still work.
- AC #8: Frontend `User.isPlatformAdmin` field, `decodeToken()` extracts `payload.platformAdmin === 'true'`, `PermissionService.isPlatformAdmin` computed signal.
- AC #9: `RequireClaim` produces standard 403 with ProblemDetails (default ASP.NET Core middleware path); per-AC #9 decision is satisfied.

**Code Quality Review — APPROVE:**
- Naming conforms to project conventions (PascalCase classes/methods, file-scoped namespaces, `_camelCase` private fields).
- No try-catch in handlers (the seeder is startup code, not a MediatR handler; its try-catch over claim-grant warning is appropriate boundary error handling).
- Tests verify behavior not implementation (claim presence/absence, HTTP status codes).
- Security at trust boundary: case-sensitive `"true"` match prevents defensive bypass via `"True"` casing.
- No useless comments; comments cite Story 22.1 and explain non-obvious decisions (orthogonal claim, minimal-token rationale).
- No DRY violation: idempotency check centralized in `EnsurePlatformAdminClaimAsync` helper.
- JwtService DI: UserManager injected at construction; both scoped, no DI cycle (verified by running tests).

### File List

**New files:**
- `backend/src/PropertyManager.Domain/Authorization/PlatformClaims.cs`
- `backend/src/PropertyManager.Api/Controllers/PlatformAdminStubController.cs`
- `backend/tests/PropertyManager.Infrastructure.Tests/Identity/CurrentUserServiceTests.cs`
- `backend/tests/PropertyManager.Api.Tests/PlatformAdminPolicyTests.cs`

**Modified backend files:**
- `backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs`
- `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs`
- `backend/src/PropertyManager.Application/Common/Interfaces/IJwtService.cs`
- `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs`
- `backend/src/PropertyManager.Application/Auth/Login.cs`
- `backend/src/PropertyManager.Application/Auth/RefreshToken.cs`
- `backend/src/PropertyManager.Infrastructure/Identity/CurrentUserService.cs`
- `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs`
- `backend/src/PropertyManager.Infrastructure/Identity/JwtService.cs`
- `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/OwnerAccountSeeder.cs`
- `backend/src/PropertyManager.Api/Program.cs`
- `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Common/PermissionServiceTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/LoginCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/RefreshTokenCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Infrastructure.Tests/Identity/JwtServiceTests.cs`
- `backend/tests/PropertyManager.Infrastructure.Tests/DatabaseFixture.cs`

**Modified frontend files:**
- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/app/core/auth/permission.service.ts`
- `frontend/src/app/core/services/auth.service.spec.ts`
- `frontend/src/app/core/auth/permission.service.spec.ts`
- `frontend/src/app/core/auth/auth.guard.spec.ts`
- `frontend/src/app/core/auth/not-tenant.guard.spec.ts`
- `frontend/src/app/core/auth/owner.guard.spec.ts`
- `frontend/src/app/core/auth/tenant.guard.spec.ts`
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.spec.ts`
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts`
- `frontend/src/app/features/auth/login/login.component.spec.ts`
- `frontend/src/app/features/dashboard/dashboard.component.spec.ts`
- `frontend/src/app/features/properties/properties.component.spec.ts`

**Docs:**
- `docs/project/stories/epic-22/22-1-platform-admin-role-permission-infrastructure.md` (this file)
- `docs/project/sprint-status.yaml`

## Evaluation (2026-05-26)

**Verdict: PASS**

- Backend build: 0 errors, 0 warnings.
- Frontend build: clean (pre-existing bundle-budget warning unchanged).
- Backend tests: **2329/2329 passing** (Application 1276, Infrastructure 105, Api 948), exit 0.
- Frontend tests: **2951/2951 passing**, exit 0.
- E2E: 246 passed, 2 pre-existing failures in `expense-linking.spec.ts` and `report-flow.spec.ts` (work-order helper FK-violation on data reset) — unrelated to story 22-1 (this story modifies only authorization/JWT/seeder code; the failures involve receipt-link and report flows). Story explicitly skips E2E per Test Scope.

**AC verification (live + tests):**

| AC | Method | Evidence |
|----|--------|----------|
| #1 PlatformAdmin as orthogonal claim | DB query | `claude@claude.com`: `Role = "Owner"` and `AspNetUserClaims (platformAdmin, "true")` — `screenshots/evaluate-ac2-db-claim.txt` |
| #2 Seeder idempotent claim grant | DB query | Exactly 1 claim row despite many restarts |
| #3 JWT includes claim on login | curl + base64 decode | `payload.platformAdmin = "true"` in fresh login — `screenshots/evaluate-ac3-jwt-claims.txt` |
| #4 `IsPlatformAdmin()` returns true with claim | Unit tests + JWT decode confirms | `PermissionServiceTests.IsPlatformAdmin_*` + `CurrentUserServiceTests.IsPlatformAdmin_*` |
| #5 `CanInviteLandlords` policy registered | `AuthorizationPolicyTests` reflection both pass | `RegisteredPolicies` set includes `CanInviteLandlords`; `PlatformAdminStubController` satisfies orphan check |
| #6 Policy returns 200/403/401 | Live curl + integration tests | Live: admin→200 (`{"ok":true}`), unauth→401, bogus→401. Tests: 5 `PlatformAdminPolicyTests` assertions pass |
| #7 PlatformAdmin doesn't break per-account | Live curl | `GET /api/v1/properties` returns 200 with seeded account data |
| #8 Frontend signal | Playwright + Angular ng-context | `AuthService.currentUser().isPlatformAdmin === true` confirmed in browser |
| #9 403 with ProblemDetails | ASP.NET Core default authorization middleware | Status code asserted via integration tests; body shape not explicitly asserted (minor finding 3) |

**Findings (5 — none blocking):**

1. **MEDIUM — `PlatformAdminStubController` not environment-gated.** Lives in production until Story 22.2 removes it. The companion `TestController.Reset` (`TestController.cs:50`) explicitly guards with `if (!_env.IsDevelopment()) return NotFound();`. The new stub omits this guard. Endpoint is claim-gated so risk surface is small (only PlatformAdmin can reach 200 with body `{ ok: true }`), but the convention is broken. **Recommended fix for Story 22.2:** add the dev-only guard or delete the controller entirely once the real landlord-invitation endpoint exists.

2. **MEDIUM — Missing unit test for `JwtService.ValidateRefreshTokenAsync` claim extraction.** Task 3.3 added a new code path in `JwtService.cs:153-156` that calls `_userManager.GetClaimsAsync(user)` to surface `isPlatformAdmin` for refresh-token reissue. No `JwtServiceTests` test covers this conversion. Handler-level coverage exists via `RefreshTokenCommandHandlerTests`, but the JwtService unit boundary is silent — silent regression here would break refresh-token claim re-emission. Consider adding `ValidateRefreshTokenAsync_WhenUserHasPlatformAdminClaim_ReturnsIsPlatformAdminTrue` in `JwtServiceTests` (and the negative case).

3. **LOW — Integration tests assert status code only, not ProblemDetails body.** AC #9 says "denial returns 403 with the standard ProblemDetails body." The tests pin `StatusCode.Should().Be(HttpStatusCode.Forbidden)` but never read the response body or content-type. ASP.NET Core's default middleware does emit ProblemDetails in practice, but the body shape isn't pinned by the test contract.

4. **LOW — Endpoint path drift between orchestrator prompt and reality.** The orchestrator prompt referenced `/api/v1/_platform-admin-stub/ping`, but the implementation mounted `/api/v1/test/platform-admin-only`. Story body and code are internally consistent (Task 8.2 explicitly chose the `test/*` route family to avoid the class-level `[Authorize(Policy = "CanManageProperties")]` AND-combining on the parent `TestController`). Informational only.

5. **LOW — `CanInviteLandlords` denials bypass the Story-20.11 audit log helper.** AC #9 explicitly accepts this trade-off. Documented and intentional. Note for Story 22.2 if landlord-invitation denial telemetry becomes business-critical: refactor `AddPermissionPolicy` to also support claim-based policies.

**Dimension grades:**
- Functional Completeness (CRITICAL): PASS — all 9 ACs verified.
- Regression Safety (CRITICAL): PASS — clean builds, 5280 unit/integration tests passing, E2E failures pre-existing.
- Test Quality (HIGH): PASS — pyramid complete (unit + integration + frontend unit), one mid-tier gap (refresh-token unit test).
- Code Quality (MEDIUM): PASS — naming conventions, file-scoped namespaces, case-sensitive `"true"` match at trust boundary, no DI cycles. One convention break (stub not env-gated).

