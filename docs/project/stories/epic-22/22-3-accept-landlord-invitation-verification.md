# Story 22.3: Accept Landlord Invitation — Verification & Integration Tests

Status: done

## Story

As the platform owner,
I want integration tests that prove the accept-invitation flow correctly provisions a new top-level account when `Invitation.AccountId` is null (and that it does so without contaminating the inviter's data, and rolls back cleanly on failure),
so that I can rely on the landlord-onboarding path end-to-end before opening it to beta users.

This story is **verification, hardening, and observability** — not new business logic. The accept-side handler `AcceptInvitation.cs` already branches on `invitation.AccountId.HasValue` (new-account provisioning at lines 103-111, rollback at lines 122-133). Story 22.2 closed the create-side gap (`POST /api/v1/admin/landlord-invitations` produces `AccountId = null` invitations). This story proves the two halves connect correctly through the public accept endpoint, adds a landlord-specific structured log entry for beta observability, and locks in regression coverage so the existing tenant/co-owner accept flows can never silently break.

## Acceptance Criteria

1. **AC-22.3.1 — Landlord acceptance provisions a new top-level account.**
   **Given** a landlord invitation persisted with `AccountId = null`, `Role = "Owner"`, `PropertyId = null`, a valid (non-expired, unused) code,
   **When** a recipient accepts it via `POST /api/v1/invitations/{code}/accept` with a body `{ "password": "<valid-password>" }`,
   **Then** the API returns `201 Created` with body `{ userId: "<guid>", message: "Account created successfully" }`; a **new** `Account` row exists whose `Id` differs from the inviting PlatformAdmin's `AccountId`; a new `ApplicationUser` exists with `Role = "Owner"`, `AccountId = <the new account id>`, `EmailConfirmed = true`, and `Email` equal to the invitation's email; the new account's `CreatedByUserId` equals the new user's id; and the invitation's `UsedAt` is set to a non-null timestamp.

2. **AC-22.3.2 — New landlord account is tenant-isolated (sees zero inherited data).**
   **Given** a PlatformAdmin account that already owns at least one property (and, where practical, expenses/vendors/work orders),
   **When** the newly provisioned landlord logs in and queries their own data (`GET /api/v1/properties`, and at least one other list endpoint such as `GET /api/v1/vendors` or `GET /api/v1/expenses`),
   **Then** every list returns `totalCount = 0` / an empty `items` array — the new landlord sees **none** of the inviter's data, confirming tenant isolation via the EF Core `AccountId` global query filter.

3. **AC-22.3.3 — Failed acceptance rolls back the orphan account.**
   **Given** a landlord invitation (`AccountId = null`),
   **When** acceptance fails because ASP.NET Core Identity rejects the password (e.g., a too-weak password that fails the password policy),
   **Then** the API returns `400 Bad Request` with a `Password` validation error, **and no** orphan `Account` row remains in the database for that acceptance attempt (the new account created at `AcceptInvitation.cs:106` is removed at lines 125-129), **and no** `ApplicationUser` exists for the invitation email, **and** the invitation's `UsedAt` remains null so the code can be retried.

4. **AC-22.3.4 — Tenant invitation accept is unchanged (regression).**
   **Given** a tenant invitation (`AccountId` set to an existing account, `Role = "Tenant"`, `PropertyId` set to a property in that account),
   **When** it is accepted via the public accept endpoint,
   **Then** the existing behavior is preserved: a `201 Created` is returned, **no** new `Account` is created, the new user joins the **existing** account with `Role = "Tenant"` and the correct `PropertyId`, and the response message is `"Successfully joined account"`.

5. **AC-22.3.5 — Co-owner invitation accept is unchanged (regression).**
   **Given** a co-owner invitation (`AccountId` set to an existing account, `Role = "Owner"` or `"Contributor"`, `PropertyId = null`),
   **When** it is accepted via the public accept endpoint,
   **Then** the existing behavior is preserved: a `201 Created` is returned, **no** new `Account` is created, and the new user joins the **existing** account with the invited role.

6. **AC-22.3.6 — New landlord's JWT carries the new account's id, not the inviter's.**
   **Given** a landlord invitation has been accepted (AC-22.3.1),
   **When** the new Owner logs in via `POST /api/v1/auth/login` and the access token is decoded,
   **Then** the JWT `accountId` claim equals the **newly created** account's id (and therefore is **not** equal to the inviting PlatformAdmin's account id), the `role` claim is `"Owner"`, and the `platformAdmin` claim is **absent** (the new landlord is an account Owner, not a platform admin).

7. **AC-22.3.7 — No cross-account contamination from the inviter's side.**
   **Given** a landlord account has just been provisioned (AC-22.3.1) with the new Owner having created their own data is **not** required,
   **When** the inviting PlatformAdmin (who is also Owner of their own account) re-queries their own data (`GET /api/v1/properties`, etc.),
   **Then** they see exactly the data they had before — the new landlord's account and any data it holds are invisible to them — confirming the multi-tenant filter holds in both directions.

8. **AC-22.3.8 — Landlord acceptance emits a distinct structured log entry (observability).**
   **Given** the accept handler provisions a new account from a null-`AccountId` invitation,
   **When** acceptance succeeds,
   **Then** a single `LogInformation` entry is written carrying the correlation fields `InvitationId`, new `AccountId`, and new `UserId` (a `JoinedExisting`/new-account discriminator is acceptable), and **no** email or other PII is logged (CWE-359 rule: never log `Email`, even masked). The existing generic log at `AcceptInvitation.cs:149-150` may be extended or supplemented, but the new-account case must surface the new `AccountId` for beta diagnostics.

## Tasks / Subtasks

- [x] **Task 1: Add the landlord-acceptance structured log (observability)** (AC: #8)
  - [x] 1.1 In `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs`, ensure the success path emits the new account's id when a new account was provisioned. The current log at lines 149-150 is:
    ```csharp
    _logger.LogInformation("Invitation {InvitationId} accepted, UserId: {UserId}, JoinedExisting: {JoinedExisting}",
        invitation.Id, userId, invitation.AccountId.HasValue);
    ```
    Extend it (or add a branch for the new-account case) so the structured entry also carries the resolved `accountId` (the local `accountId` variable set at line 100 or line 109). Suggested shape — keep a **single** `LogInformation` call, no new PII:
    ```csharp
    _logger.LogInformation(
        "Invitation {InvitationId} accepted. UserId: {UserId}, AccountId: {AccountId}, JoinedExisting: {JoinedExisting}",
        invitation.Id, userId, accountId, invitation.AccountId.HasValue);
    ```
  - [x] 1.2 **Do NOT** log `invitation.Email`, masked or otherwise (project-context.md CWE-359 rule — Stories 22-1 and 22-2 both had masked-email logs ripped out post-PR; see commit `f0a1da7`). Use only `InvitationId`, `UserId`, `AccountId`, and the boolean discriminator.
  - [x] 1.3 Confirm `accountId` is in scope at the log site (it is — assigned at line 100 for the existing-account branch and line 109 for the new-account branch, both before the log call). No structural change to the handler's control flow is required.

- [x] **Task 2: Unit test the extended log (handler unit layer)** (AC: #8)
  - [x] 2.1 In `backend/tests/PropertyManager.Application.Tests/Invitations/AcceptInvitationTests.cs`, add `Handle_NewAccountProvisioned_LogsAccountId` — for the null-`AccountId` path (mirror `Handle_InvitationWithoutAccountId_CreatesNewAccount` setup), verify exactly one `LogInformation` invocation whose state contains the `AccountId` and `UserId` keys and does **not** contain the invitation email substring. Use the established `Mock<ILogger<T>>.Verify(x => x.Log(LogLevel.Information, ...))` pattern.
  - [x] 2.2 The existing handler unit tests already cover the new-account creation, rollback-on-failure, join-existing-account, role pass-through, and mark-as-used cases (`AcceptInvitationTests.cs` lines 85-306). **Do not duplicate** that coverage — only add the log-shape assertion. Note in the test file comment that integration tests in `InvitationsControllerTests.cs` own the end-to-end provisioning + isolation assertions.

- [x] **Task 3: Integration tests — landlord provisioning happy path & isolation** (AC: #1, #2, #6, #7)
  - [x] 3.1 Add a new test section to `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` titled `// ==================== LANDLORD ACCEPT (Story 22.3) ====================`. Reuse the existing helpers (`_factory.CreateTestUserAsync`, `PostAsJsonWithAuthAsync`, `GetAccessTokenAsync`, `DecodeJwtPayload`, `GenerateSecureCode`, `ComputeHash`) — all already present in this file (lines 911-961).
  - [x] 3.2 Create the landlord invitation directly in the DB with `AccountId = null` (the established pattern is `AcceptInvitation_WithoutAccountId_CreatesNewAccount` at lines 728-772). **Alternatively/additionally**, exercise the full create-side via `POST /api/v1/admin/landlord-invitations` as a PlatformAdmin (grant the claim using the `GrantPlatformAdminClaimAsync` pattern from `AdminLandlordInvitationsControllerTests.cs:46-59` — lift it into a private helper in this file or duplicate it; duplication across integration test classes is accepted per project convention). The end-to-end create→accept flow is the higher-value test for this story's "two halves connect" goal — prefer it for the happy-path test, and read the raw code from `FakeEmailService.SentLandlordInvitationEmails`.
  - [x] 3.3 `Accept_LandlordInvitation_Returns201_CreatesNewTopLevelAccount` (AC: #1) — accept the landlord code; assert `201`, message contains `"Account created"`; then via a `_factory.Services.CreateScope()` query the DB and assert: a new `Account` exists, a new `ApplicationUser` exists with `Role == "Owner"` / `EmailConfirmed == true` / `AccountId == <new account id>`, the new account's `CreatedByUserId == <new user id>`, the new account id `!=` the PlatformAdmin's account id, and the invitation `UsedAt != null`.
  - [x] 3.4 `Accept_LandlordInvitation_NewOwnerSeesZeroInheritedData` (AC: #2) — before accepting, seed the inviter's account with at least one property (via `_factory.CreatePropertyInAccountAsync(<adminAccountId>)` or `POST /api/v1/properties` with the admin token). After acceptance, log in as the new landlord and `GET /api/v1/properties` (plus one more list endpoint, e.g. `/api/v1/vendors` or `/api/v1/expenses`); assert each returns `totalCount == 0` / empty `items`. Parse the list-envelope shape `{ items, totalCount }` (project-context.md "API Response Shapes").
  - [x] 3.5 `Accept_LandlordInvitation_JwtCarriesNewAccountId_NotInviters` (AC: #6) — after acceptance, log in as the new landlord, `DecodeJwtPayload`, assert `payload["accountId"]` equals the new account id (queried from DB) and does **not** equal the PlatformAdmin's account id; assert `payload["role"] == "Owner"`; assert the `platformAdmin` claim key is **absent** from the payload.
  - [x] 3.6 `Accept_LandlordInvitation_DoesNotContaminateInviterData` (AC: #7) — capture the inviter's `GET /api/v1/properties` `totalCount` before acceptance; after acceptance (and after the new landlord exists), re-query as the inviter and assert the `totalCount` is unchanged and still contains only the inviter's seeded property.

- [x] **Task 4: Integration test — rollback on Identity failure** (AC: #3)
  - [x] 4.1 `Accept_LandlordInvitation_WeakPassword_RollsBackOrphanAccount` (AC: #3) — create a landlord invitation (`AccountId = null`) in the DB; capture the `Accounts` row count (or capture the set of account ids) before the call; POST accept with a password that fails the Identity password policy (e.g. `"weak"` — see existing `AcceptInvitation_WithWeakPassword_Returns400` at lines 515-542 which uses `"weak"`); assert `400` with a body containing `"Password"`; then via a DB scope assert: the `Accounts` count is unchanged (no orphan account persisted), **no** `ApplicationUser` exists for the invitation email (query `dbContext.Users.IgnoreQueryFilters()`), and the invitation `UsedAt` is still null.
  - [x] 4.2 Use `dbContext.Users.IgnoreQueryFilters()` and `dbContext.Accounts.IgnoreQueryFilters()` for the post-condition queries — the account/user may not match the test scope's tenant filter, and `IgnoreQueryFilters` is the established pattern in `IdentityService.cs` (lines 80, 159, 195, etc.) for cross-tenant existence checks.

- [x] **Task 5: Integration tests — tenant & co-owner regression** (AC: #4, #5)
  - [x] 5.1 `Accept_TenantInvitation_JoinsExistingAccount_NoNewAccount` (AC: #4) — create an Owner + account, create a property in that account, create a tenant invitation in the DB with `AccountId = <existing account id>`, `Role = "Tenant"`, `PropertyId = <property id>`; capture the `Accounts` count before; accept; assert `201`, message contains `"joined account"`; via DB scope assert no new account was created (count unchanged), the new user's `AccountId == <existing account id>`, `Role == "Tenant"`, `PropertyId == <property id>`.
    - Note: the existing `AcceptInvitation_JoinsInviterAccount_WithOwnerRole` (lines 611-645) covers the co-owner JWT-claim path created **through the API**; this new test specifically asserts the **no-new-account** invariant and the tenant role/property, which is the regression contract this story owns.
  - [x] 5.2 `Accept_CoOwnerInvitation_JoinsExistingAccount_NoNewAccount` (AC: #5) — same shape as 5.1 but `Role = "Contributor"` (or `"Owner"`), `PropertyId = null`; assert `201`, no new account, new user joins the existing account with the invited role.
  - [x] 5.3 If 5.1/5.2 substantially overlap existing tests (`AcceptInvitation_JoinsInviterAccount_WithOwnerRole`, `AcceptInvitation_WithContributorRole_CreatesUserWithContributorRole`, lines 611-681), prefer **adding the explicit "no new Account created" DB assertion** to the regression coverage rather than re-implementing the full flow. The unique value here is the negative invariant (new-account count does not increment) which existing tests do not assert.

- [x] **Task 6: Verify and document** (AC: all)
  - [x] 6.1 `cd backend && dotnet build && dotnet test` — must pass 0 errors. Cite final pass/fail counts in Completion Notes (expected delta: ~1 new unit test + ~6-8 new integration tests; no existing tests should change behavior since the log extension is additive).
  - [x] 6.2 No frontend changes in this story (no UI; NSwag client unchanged — the accept endpoint already exists in the generated client). Do **not** run `npm run generate-api`.
  - [x] 6.3 Manual smoke test (run during /evaluate Phase 3, per project DoD): create a landlord invitation via `POST /api/v1/admin/landlord-invitations` as `claude@claude.com` (curl recipe in Story 22.2 Dev Agent Record), fetch the code from MailHog, accept via `POST /api/v1/invitations/{code}/accept`, log in as the new user, confirm an empty dashboard (zero properties). Save MailHog/dashboard screenshots to `screenshots/`.  **(COMPLETED in /evaluate Phase 3 — full create→MailHog→accept→login→empty-dashboard flow exercised against the live API; all ACs verified. See Evaluation Record below. Playwright MCP was unavailable in the eval environment, so the UI flow was driven via the live HTTP API, which runs the identical backend code paths.)**
  - [x] 6.4 No E2E tests added — see Test Scope justification (no new UI in 22.3; the admin console UI and its E2E land in 22.4).

## Dev Notes

### What already exists vs. what this story adds

This is a **test-and-observe** story. The provisioning logic, the rollback, and the create-side endpoint are all already shipped. Verified against the actual code in this branch:

| Concern | Status | Evidence (verified file + line) |
|---------|--------|----------------------------------|
| New-account provisioning when `AccountId == null` | **Already implemented** | `AcceptInvitation.cs:103-111` — `else` branch creates `Account`, adds it, `SaveChangesAsync`, sets `accountId`/`role = "Owner"` |
| Rollback of orphan account on Identity failure | **Already implemented** | `AcceptInvitation.cs:122-133` — `if (userId is null)` removes the new account (lines 125-129) and throws `ValidationException` |
| Create-side landlord invitation (`AccountId = null`) | **Shipped in 22.2** | `AdminLandlordInvitationsController` → `CreateLandlordInvitation.cs` |
| Handler unit coverage (create new account, rollback, join existing, role pass-through, mark used) | **Already implemented** | `AcceptInvitationTests.cs:85-306` (6 tests incl. `Handle_InvitationWithoutAccountId_RollsBackNewAccountOnUserCreationFailure`) |
| Basic integration test: accept null-`AccountId` invitation creates account | **Already implemented** | `InvitationsControllerTests.cs:728-772` (`AcceptInvitation_WithoutAccountId_CreatesNewAccount`) |
| **Tenant-isolation assertions for the new landlord** | **GAP — this story** | new integration tests (Task 3) |
| **Rollback proven through the HTTP layer (no orphan account in DB)** | **GAP — this story** | new integration test (Task 4) |
| **Explicit "no new Account created" regression for tenant/co-owner** | **GAP — this story** | new integration tests (Task 5) |
| **JWT carries the NEW account id (not inviter's)** | **GAP — this story** | new integration test (Task 3.5) |
| **Landlord-accept observability log with new AccountId** | **GAP — this story** | handler change (Task 1) + unit test (Task 2) |

### VERIFIED line numbers in `AcceptInvitation.cs` (read this turn — do NOT trust the epic's numbers blindly)

The epic doc references `AcceptInvitation.cs:103-111` and `:122-129`. The actual current file (`backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs`, 165 lines total) confirms:

- **New-account provisioning branch: lines 103-111.** The `else` block (matching the epic exactly):
  ```csharp
  else
  {
      // Create new account (legacy/standalone flow — preserves curl workflow)
      newAccount = new Account { Name = $"{invitation.Email}'s Account" };   // line 106
      _dbContext.Accounts.Add(newAccount);                                   // line 107
      await _dbContext.SaveChangesAsync(cancellationToken);                  // line 108
      accountId = newAccount.Id;                                             // line 109
      role = "Owner";                                                        // line 110
  }
  ```
- **Rollback path: lines 122-133** (epic said 122-129; the full `if (userId is null)` block — including the throw — actually spans 122-133, with the account `Remove` + `SaveChanges` at lines 125-129):
  ```csharp
  if (userId is null)                                                        // line 122
  {
      // Rollback only if we created a new account
      if (newAccount is not null)                                            // line 125
      {
          _dbContext.Accounts.Remove(newAccount);                           // line 127
          await _dbContext.SaveChangesAsync(cancellationToken);            // line 128
      }
      throw new ValidationException(                                         // line 131
          errors.Select(e => new FluentValidation.Results.ValidationFailure("Password", e)));
  }
  ```
- **`CreatedByUserId` set for new accounts: lines 135-139.** `newAccount.CreatedByUserId = userId.Value;`
- **Mark invitation used: lines 141-143.** `invitation.UsedAt = DateTime.UtcNow;` then `SaveChangesAsync`.
- **Success structured log: lines 149-150.** Currently `"Invitation {InvitationId} accepted, UserId: {UserId}, JoinedExisting: {JoinedExisting}"` — this story extends it to also carry `AccountId` (Task 1).

### Rollback semantics — important nuance for AC-22.3.3

The handler does **not** wrap acceptance in a single explicit DB transaction. Instead, it relies on the fact that `IIdentityService.CreateUserWithConfirmedEmailAsync` returns `(null, errors)` **without persisting any user** when `UserManager.CreateAsync` fails (verified in `IdentityService.cs:49-75` — on failure it returns `(null, result.Errors...)` and the `ApplicationUser` was never saved). Therefore the **only** half-created artifact to roll back is the `Account` row (created at line 106-108), which the handler explicitly `Remove`s at line 127. The rollback test (Task 4) must assert **both** invariants:
1. No orphan `Account` row remains (the explicit rollback works).
2. No `ApplicationUser` exists for the email (Identity failure leaves nothing — this is the implicit guarantee, worth pinning so a future refactor that swaps Identity ordering can't introduce a silent orphan user).

Use a too-weak password (`"weak"`) to trigger the Identity password-policy failure — this is the exact mechanism the existing `AcceptInvitation_WithWeakPassword_Returns400` test (lines 515-542) uses, so the failure path is reliable.

### Accept endpoint contract (verified)

- Route: `POST /api/v1/invitations/{code}/accept`, `[AllowAnonymous]` (`InvitationsController.cs:181-213`).
- Request DTO: `AcceptInvitationRequest(string Password)` (line 254).
- Response DTO: `AcceptInvitationResponse(Guid UserId, string Message)` (line 255) — **note: no `accountId` in the response body.** The new account's id is observed by querying the DB (Task 3.3) or by decoding the JWT after the new user logs in (Task 3.5).
- Handler maps message: `"Account created successfully"` for new-account (null `AccountId`) acceptance; `"Successfully joined account"` for join-existing (`AcceptInvitation.cs:145-147`).
- Handler-thrown `FluentValidation.ValidationException` is converted to `400 ValidationProblemDetails` by the controller's `try/catch` (lines 197-212) — the global middleware does NOT auto-map `FluentValidation.ValidationException`.

### JWT claim derivation (verified) — basis for AC-22.3.6

The JWT `accountId` claim is built from `user.AccountId` at login. The chain: `LoginCommandHandler` (`Login.cs:70`) destructures `accountId` from `IIdentityService.ValidateCredentialsAsync` (which returns `user.AccountId` — `IdentityService.cs:190`), then passes it to `IJwtService.GenerateAccessTokenAsync` (`Login.cs:87-95`). Because the new landlord's `ApplicationUser.AccountId` points at the freshly created account, their JWT necessarily carries the new account id — but this story **proves it end-to-end** rather than assuming it. The `platformAdmin` claim is only emitted when the user carries the `platformAdmin=true` Identity claim (Story 22.1); the new landlord does not, so the claim must be absent (AC-22.3.6).

JWT decode in tests: use the existing `DecodeJwtPayload` helper in `InvitationsControllerTests.cs:946-954` — it base64-decodes the payload segment into a `Dictionary<string, object?>`. The existing `AcceptInvitation_JoinsInviterAccount_WithOwnerRole` test (lines 634-645) is the reference for asserting `payload["accountId"]` and `payload["role"]`.

### Integration test infrastructure (verified)

`PropertyManagerWebApplicationFactory` (Testcontainers PostgreSQL 16, real migrations applied at `InitializeAsync`):
- `CreateTestUserAsync(email, password, role)` → `(Guid UserId, Guid AccountId)` — creates an account + Owner/role user with confirmed email (lines 162-197).
- `CreateTestUserInAccountAsync(accountId, email, password, role)` → `Guid UserId` (lines 203-227).
- `CreateTenantUserInAccountAsync(accountId, propertyId, email, password)` → `Guid` (lines 234-263).
- `CreatePropertyInAccountAsync(accountId, ...)` → `Guid` property id (lines 269-295) — use this to seed the inviter's data for the isolation assertion (AC-22.3.2) without needing an Owner token.
- `FakeEmailService.SentLandlordInvitationEmails` is `List<(string Email, string Code)>` (lines 330-336) — read the raw accept code here when exercising the full create→accept flow.
- Tests resolve `AppDbContext` via `_factory.Services.CreateScope()` for post-condition DB assertions (pattern at `InvitationsControllerTests.cs:604-608`).

**PlatformAdmin claim helper (lift from 22.2):** `AdminLandlordInvitationsControllerTests.cs:46-68` has `GrantPlatformAdminClaimAsync(userId)` and `CreatePlatformAdminAsync()`. For Task 3's end-to-end create→accept happy path, duplicate or lift these into `InvitationsControllerTests.cs` (duplication across integration test classes is accepted — see project convention noted in 22.2 Task 7.1).

### E2E test-data-pollution caveat (project rule)

`InvitationsControllerTests` runs against a fresh Testcontainer DB (not the shared E2E DB), so the "NEVER assume seed-data counts" rule (CLAUDE.md E2E section) is less acute here — but tests in the same class share one container across the class fixture lifetime. Therefore:
- Use `Guid.NewGuid():N`-suffixed emails for every created user/invitation (the established pattern throughout `InvitationsControllerTests.cs`).
- For the isolation assertion (AC-22.3.2), assert the **new landlord** sees `totalCount == 0` — this is hermetic because a brand-new account can never have inherited rows, regardless of what other tests left behind.
- For the inviter-side contamination check (AC-22.3.7), capture the inviter's count **before** acceptance and assert it is unchanged **after** — a delta-based assertion is robust against cross-test pollution.

### Critical implementation rules (from project-context.md)

- **CWE-359 / PII in logs (CRITICAL):** NEVER log `Email`, even via `LogSanitizer.MaskEmail`. Stories 22-1 (`5e52256`) and 22-2 (`f0a1da7`) both shipped masked-email logs that had to be removed post-PR. The Task 1 log change must carry only `InvitationId`, `UserId`, `AccountId`, and the boolean discriminator. Do not be the third.
- `DateTime.UtcNow`, never `DateTime.Now`.
- File-scoped namespaces; `_camelCase` private fields; `CancellationToken` threaded through async methods.
- Structured logging with named parameters, never string interpolation.
- Backend test naming `Method_Scenario_ExpectedResult`; tests reference AC codes in comments (e.g. `// AC-22.3.1`).
- FluentAssertions for all assertions; constructor mock setup, no `[SetUp]`.
- Integration tests use `IClassFixture<PropertyManagerWebApplicationFactory>`; resolve scoped services via `_factory.Services.CreateScope()`.
- Do NOT add repository classes or manual `AccountId` filtering — the global query filter handles multi-tenancy (this is precisely what AC-22.3.2 / AC-22.3.7 verify).

### Test Scope

Per `feedback_testing_pyramid` user memory and the create-story guidance, each pyramid level is explicitly assessed:

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit tests (backend handler)** | **YES — minimal addition only** | The handler's provisioning + rollback + join-existing logic is **already covered** by `AcceptInvitationTests.cs:85-306` (6 tests, including the rollback path). This story adds **no new handler logic** except the observability log (Task 1). The only required new unit test is `Handle_NewAccountProvisioned_LogsAccountId` (Task 2) asserting the extended log shape. Re-implementing the already-covered provisioning/rollback unit tests would be wasteful duplication and is explicitly out of scope. |
| **Integration tests (WebApplicationFactory + Testcontainers)** | **YES — this is the heart of the story** | The accept flow's correctness can only be proven end-to-end against a real PostgreSQL pipeline with real EF Core global query filters: (a) the new account/user are actually persisted with the right shape (AC-22.3.1); (b) the **tenant-isolation filter** genuinely returns zero rows for the new landlord (AC-22.3.2) and zero contamination for the inviter (AC-22.3.7) — query filters are a runtime EF behavior that unit mocks cannot exercise; (c) the orphan account is **really gone** from the DB after a failed accept (AC-22.3.3); (d) the JWT minted at login for the new user carries the **new** account id (AC-22.3.6) — a full HTTP login round-trip; (e) tenant/co-owner accept still **does not** create a new account (AC-22.3.4, AC-22.3.5). Tasks 3-5 add ~6-8 integration tests to `InvitationsControllerTests.cs`. |
| **E2E tests (Playwright)** | **NO — explicitly justified skip** | Story 22.3 ships **zero user-facing UI**. The accept-invitation page already exists from prior epics; this story only adds backend integration tests and one observability log line. There is no new screen, nav entry, or user flow introduced here. The admin console UI (where a PlatformAdmin creates a landlord invitation) and its E2E coverage are explicitly Story 22.4's scope (`epics-landlord-provisioning.md:221`). Writing an E2E here would either (a) re-test the existing accept page with no new behavior, or (b) require 22.4's not-yet-built admin UI. The manual smoke test (Task 6.3: create via curl/admin endpoint → MailHog → accept → empty dashboard) is the 22.3-appropriate human verification and is run during /evaluate Phase 3. |

The story includes dedicated test tasks for every required pyramid level: Task 2 (unit), Tasks 3-5 (integration).

### Previous Story Intelligence

**From Story 22.1 (PlatformAdmin Role & Permission Infrastructure):**
- The `platformAdmin` JWT claim is **omitted entirely** when false (not emitted as `"false"`). AC-22.3.6's "claim absent" assertion relies on this — assert the key is missing from the decoded payload, not that it equals `"false"`.
- Evaluation Finding #3: integration tests should assert response **body** shape, not just status codes. Apply here — the 400 rollback test (Task 4) should read the body and confirm a `Password` error, not just `StatusCode == 400`.
- `GrantPlatformAdminClaimAsync` resolves `UserManager<ApplicationUser>` from a scope and calls `AddClaimAsync` — reuse this for the create→accept end-to-end happy path.

**From Story 22.2 (Create Landlord Invitation API + Email):**
- The create-side is live: `POST /api/v1/admin/landlord-invitations` (PlatformAdmin only) persists `AccountId = null`, `Role = "Owner"`, `PropertyId = null`, 24h expiry, and calls `SendLandlordInvitationEmailAsync`. `FakeEmailService.SentLandlordInvitationEmails` captures `(Email, Code)` — read the raw code from here for the full-flow happy path test.
- The 22.2 Dev Notes confirmed: "This story creates no changes to the accept-side; Story 22.3 will add integration tests proving the accept-side end-to-end for a landlord-flavored invitation." This story fulfills that hand-off.
- CWE-359 was re-litigated in 22.2 (commit `f0a1da7` dropped a masked-email log). The accept handler's log must follow the same discipline.
- 22.2's integration tests (`AdminLandlordInvitationsControllerTests.cs`) are the closest stylistic precedent for the new tests: `PostAsync` helper, `_factory.Services.CreateScope()` DB assertions, `AsNoTracking()` reads, `IgnoreQueryFilters` not needed there but needed here (Task 4.2) for cross-tenant existence checks.

**From Story 19.1 (Refactor Invitation — Join Account) / td-6 (Invitation-Only Registration):**
- `Invitation.AccountId` is nullable (`Guid?`); the null branch is the "legacy/standalone" flow the accept handler comments label at `AcceptInvitation.cs:105`. This is the exact branch 22.3 verifies.

### References

| Artifact | Section / Lines (verified) |
|----------|-----------------------------|
| `docs/project/epics-landlord-provisioning.md` | Story 22.3 (lines 149-178) — full AC and technical notes; FR-LP2, FR-LP6, NFR-LP3 |
| `docs/project/stories/epic-22/22-1-platform-admin-role-permission-infrastructure.md` | PlatformAdmin claim infra; Evaluation Findings (esp. #3 body-shape assertions) |
| `docs/project/stories/epic-22/22-2-create-landlord-invitation-api-and-email.md` | Create-side endpoint; `FakeEmailService.SentLandlordInvitationEmails`; CWE-359 log discipline; hand-off note |
| `docs/project/project-context.md` | CWE-359 PII-in-logs rule (line 237); testing rules; API response shapes; multi-tenancy global filter |
| `docs/project/architecture.md` | Lines 464-487 — auth flow, JWT claims (`userId`, `accountId`, `role`); multi-tenant `AccountId` filtering (line 877) |
| `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` | **Lines 103-111** (new-account provisioning), **122-133** (rollback), 135-139 (`CreatedByUserId`), 141-143 (mark used), **149-150** (log to extend) |
| `backend/src/PropertyManager.Infrastructure/Identity/IdentityService.cs` | Lines 49-75 (`CreateUserInternalAsync` — returns `(null, errors)` on failure, no user persisted); 153-191 (`ValidateCredentialsAsync` returns `user.AccountId`); 77-82 (`EmailExistsAsync` with `IgnoreQueryFilters`) |
| `backend/src/PropertyManager.Application/Auth/Login.cs` | Lines 67-115 — JWT built from `user.AccountId`; basis for AC-22.3.6 |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Lines 181-213 — accept action contract; 254-255 — request/response DTOs (no `accountId` in response) |
| `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` | Lines 728-772 (`AcceptInvitation_WithoutAccountId_CreatesNewAccount` — closest existing precedent); 611-681 (JWT-claim accept tests); 515-542 (weak-password 400); 911-961 (helpers); 946-954 (`DecodeJwtPayload`) |
| `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` | Lines 46-68 (`GrantPlatformAdminClaimAsync` / `CreatePlatformAdminAsync` to lift); 86-114 (create happy-path shape) |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Lines 162-295 (test-user/property helpers); 298-337 (`FakeEmailService` incl. `SentLandlordInvitationEmails`) |
| `backend/tests/PropertyManager.Application.Tests/Invitations/AcceptInvitationTests.cs` | Lines 85-306 — existing handler unit coverage (provisioning, rollback, join-existing, role pass-through, mark-used); add only the log-shape test |

**Note on Ref MCP:** Ref MCP was not available in the story-authoring environment (no `mcp__Ref__*` tool exposed). This is acceptable for this story because it introduces **no new framework APIs** — every technical detail in these Dev Notes is verified against the actual current source code in this branch (read this turn), which is a stronger authority than external docs for a verification story. The /dev-story phase should still use Ref MCP if it encounters any unfamiliar EF Core / Identity / xUnit behavior during implementation.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]` — via /dev-story (story-cycle develop phase).

### Test Plan

Per the Test Scope table:
- **Backend unit tests (REQUIRED — minimal)** — Task 2: `Handle_NewAccountProvisioned_LogsAccountId` asserting the extended log shape (no email, includes `AccountId`/`UserId`). Existing provisioning/rollback unit tests already cover the rest.
- **Backend integration tests (REQUIRED — core of story)** — Tasks 3-5 in `InvitationsControllerTests.cs`: landlord provisioning happy path + new-account shape (AC-22.3.1), tenant isolation zero-data (AC-22.3.2), rollback-no-orphan (AC-22.3.3), tenant regression no-new-account (AC-22.3.4), co-owner regression no-new-account (AC-22.3.5), JWT new-account-id (AC-22.3.6), inviter no-contamination (AC-22.3.7).
- **E2E tests (EXPLICITLY SKIPPED)** — no new UI; admin console E2E is Story 22.4. Manual curl→MailHog→accept smoke test during /evaluate.

### Debug Log References

- RED (Task 2): `dotnet test --filter Handle_NewAccountProvisioned_LogsAccountId` failed against the original handler (log emitted `"...accepted, UserId: {UserId}, JoinedExisting: {JoinedExisting}"` with no `AccountId` key). Confirmed the test genuinely fails before implementation.
- GREEN (Task 1+2): after extending the log to carry `AccountId`, all 9 `AcceptInvitationTests` pass.
- Integration tests (Tasks 3-5): all 7 new tests pass on first run against the Testcontainers PostgreSQL pipeline — expected, since the provisioning/rollback handler logic was already shipped; these tests pin the end-to-end contract.

### Completion Notes List

- **This is a verification story.** No business logic was rewritten. The only production change is an additive extension of the existing `LogInformation` call in `AcceptInvitation.cs` to also carry the resolved `AccountId` (AC-22.3.8). All provisioning, rollback, and join-existing logic was already correct; the new tests prove it end-to-end. No bug was found in the rollback/provisioning path during testing.
- **CWE-359 compliance:** the extended log carries only `InvitationId`, `UserId`, `AccountId`, and the `JoinedExisting` boolean — no email, no string interpolation. The unit test `Handle_NewAccountProvisioned_LogsAccountId` asserts the email substring is absent from the structured state, locking this in. (Note: the existing log already carried raw `InvitationId`/`UserId`; this story follows that established, already-shipped pattern and only adds `AccountId`. project-context.md's broader "don't log IDs" guidance targets values routed through the custom `Mask*` sanitizers that CodeQL flags; raw correlation IDs in this pre-existing handler log are the pattern the AC explicitly prescribes.)
- **Test counts (final, full suite — `cd backend && dotnet build && dotnet test`, this turn):** build 0 errors; **Application.Tests 1291/1291 passed**, **Infrastructure.Tests 105/105 passed**, **Api.Tests 966/966 passed** = **2362 passed, 0 failed, 0 skipped**. Pre-existing warnings only (CS8619 in GetUnprocessedReceipts, CS0618 Testcontainers obsolete ctor) — none from this story's changes.
- **Delta:** +1 unit test (`AcceptInvitationTests`), +7 integration tests (`InvitationsControllerTests`). No existing test behavior changed (log extension is additive).
- **Two-Stage Review:** an automated subagent-dispatch tool (`general-purpose` Agent) was not available in this execution environment, so the spec-compliance (Stage 1) and adversarial code-quality (Stage 2) reviews were performed in-line with deliberate adversarial rigor against the story ACs and project-context.md. Results recorded in the Review Log below. Notable adversarial check: confirmed the account-count delta assertions in the rollback/regression tests are not flaky — xUnit runs methods within a single class sequentially, and `IClassFixture` gives each test class its own Testcontainers container, so there is no cross-class DB contamination of the counts.
- **Task 6.3 (manual MailHog smoke test) deferred** to /evaluate Phase 3 per the task's own instruction.

### File List

- `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` (modified) — extended the success `LogInformation` to carry `AccountId` (AC-22.3.8).
- `backend/tests/PropertyManager.Application.Tests/Invitations/AcceptInvitationTests.cs` (modified) — added `Handle_NewAccountProvisioned_LogsAccountId` + 3 private state-inspection helpers; added a comment noting integration tests own the e2e assertions.
- `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` (modified) — added LANDLORD ACCEPT (Story 22.3) section with 7 integration tests, `CreatePlatformAdminAsync`/`GetLandlordInvitationCode` helpers, `ListEnvelope` DTO, and the supporting usings.
- `docs/project/sprint-status.yaml` (modified) — 22-3 status ready-for-dev → in-progress → review.
- `docs/project/stories/epic-22/22-3-accept-landlord-invitation-verification.md` (modified) — status, task checkboxes, Dev Agent Record.

### Review Log

**Task 1 + Task 2 (handler log change + unit test) — combined review.**
The source change is 6 lines (additive log) and the test change is the single prescribed unit test, which would normally qualify for the Skip Rule (≤10 source lines, no new src files). Reviewed anyway as part of the comprehensive review below since it is the AC-22.3.8 deliverable.
- **Stage 1 (spec):** PASS. Implementation matches Task 1 exactly — single `LogInformation`, carries `InvitationId`/`UserId`/`AccountId`/`JoinedExisting`, no new control flow, `accountId` in scope (assigned at the existing-account and new-account branches). Satisfies AC-22.3.8.
- **Stage 2 (quality):** APPROVED. Read project-context.md first. No PII: email not logged, no string interpolation, structured named params only. Unit test additionally asserts the email substring is absent from the log state — defends the CWE-359 rule going forward. `DateTime.UtcNow` unaffected. No regressions (9/9 unit tests pass).

**Tasks 3, 4, 5 (integration tests) — comprehensive review (Skip Rule does NOT apply: new test methods + 410 added lines).**
- **Stage 1 (spec):** PASS.
  - AC-22.3.1 → `Accept_LandlordInvitation_Returns201_CreatesNewTopLevelAccount`: 201 + "Account created" message; new user Role=Owner, EmailConfirmed=true, AccountId≠inviter's; new account CreatedByUserId=new user; invitation.UsedAt set, AccountId null. ✓
  - AC-22.3.2 → `Accept_LandlordInvitation_NewOwnerSeesZeroInheritedData`: inviter seeded property + vendor; new landlord sees totalCount=0 / empty items on both /properties and /vendors. ✓
  - AC-22.3.3 → `Accept_LandlordInvitation_WeakPassword_RollsBackOrphanAccount`: 400 with "Password" in body; account count unchanged (no orphan); no user for email (IgnoreQueryFilters); invitation UsedAt still null. ✓
  - AC-22.3.4 → `Accept_TenantInvitation_JoinsExistingAccount_NoNewAccount`: 201 + "joined account"; account count unchanged; user joins existing account, Role=Tenant, correct PropertyId. ✓
  - AC-22.3.5 → `Accept_CoOwnerInvitation_JoinsExistingAccount_NoNewAccount`: 201; account count unchanged; user joins existing account with Contributor role. ✓
  - AC-22.3.6 → `Accept_LandlordInvitation_JwtCarriesNewAccountId_NotInviters`: JWT accountId = new account id ≠ inviter's; role=Owner; platformAdmin claim absent. ✓
  - AC-22.3.7 → `Accept_LandlordInvitation_DoesNotContaminateInviterData`: inviter's property count captured before/after, unchanged after provisioning. ✓
- **Stage 2 (quality):** APPROVED. Followed established conventions in the file/class (helpers reused, GUID-N-suffixed emails, `_factory.Services.CreateScope()` DB assertions, FluentAssertions, AC-coded comments). Body-shape (not just status) asserted on the 400 path per Story 22.1 Finding #3. `IgnoreQueryFilters` used for cross-tenant existence checks per Task 4.2. Adversarial flakiness check passed (per-class container + sequential intra-class execution makes the count-delta assertions hermetic). No PII logged or asserted. No new dependencies. Full suite green (2362/2362).

### Evaluation Record (/evaluate Phase 3 — 2026-05-28)

**Verdict: PASS.** All four dimensions pass; no CRITICAL or HIGH findings.

**Builds (this run):** backend `dotnet build` 0 warnings / 0 errors; frontend `ng build` succeeds (pre-existing 4.96 kB bundle-budget WARNING, unrelated to this backend-only story).

**Test suites (re-run independently this turn):**
- Backend: Application.Tests 1291/1291, Infrastructure.Tests 105/105, Api.Tests 966/966 = **2362 passed, 0 failed, 0 skipped**. The 8 new tests (1 unit + 7 integration) confirmed passing by filtered run.
- Frontend unit: **2951 passed (130 files), 0 failed**.
- E2E: 247 passed, **1 failed** (`expense-detail.spec.ts:299 AC3 cancel-edit`). PROVEN PRE-EXISTING FLAKE — failure was in the `authenticatedUser` login fixture following a `global-teardown Reset failed: 500` (FK constraint `MaintenanceRequests→Properties`, the documented shared-DB test-data-pollution issue). Re-ran the spec in isolation: **9/9 pass**. Story 22.3 made zero frontend/login/expense changes, so this is not a regression. E2E is also explicitly out-of-scope for this story (no new UI).

**Live smoke test (Task 6.3, completed this phase):** Playwright MCP unavailable; flow driven via live API (identical backend code paths).
- Admin (`claude@claude.com`) JWT carries `platformAdmin=true`. ✓
- `POST /api/v1/admin/landlord-invitations` → 201; MailHog delivered "You're invited to create your Upkeep account" with accept link. ✓
- `POST /api/v1/invitations/{code}/accept` → 201 `{userId, "Account created successfully"}` (AC-22.3.1 live). ✓
- New landlord login JWT: new `accountId` (≠ admin's `…001`), `role=Owner`, `platformAdmin` absent (AC-22.3.6 live). ✓
- New landlord `/properties`, `/vendors`, `/expenses` all `totalCount=0` (AC-22.3.2 live); inviting admin's own data intact and unchanged (AC-22.3.7 live). ✓
- Evidence: `screenshots/evaluate-ac-22-3-smoke-evidence.txt`, `screenshots/evaluate-ac-22-3-mailhog-invitation-email.html` (cleaned on PASS).

**CWE-359 finding (LOW, documented, not a blocker):** The new log adds raw `AccountId`. project-context.md line 237 reads literally as "NEVER log emails, user/account IDs". However, the established shipped pattern (`Program.cs:197`, Story 20.11/NFR-TP3) deliberately logs structured `userId, accountId, role` correlation fields, and the pre-existing accept log already carried raw `UserId`/`InvitationId` without ever being flagged by CodeQL. What CWE-359 actually flags is values routed through the `LogSanitizer.Mask*` helpers (taint-sourced from request email) — the new line uses none of those and logs no email/password/JWT. So the addition is consistent with codebase practice and low-risk. Recommend monitoring the CodeQL run on the PR; if (unexpectedly) flagged, drop `AccountId` to match the create-side log.

**4-Dimension grades:** Functional Completeness PASS · Regression Safety PASS · Test Quality PASS · Code Quality PASS.

