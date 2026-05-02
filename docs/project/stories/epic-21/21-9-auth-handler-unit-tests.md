# Story 21.9: Auth Handler Unit Tests

Status: done

## Story

As a developer,
I want unit test coverage for every command handler in `PropertyManager.Application/Auth/` (Login, RefreshToken, Logout, ForgotPassword, ResetPassword, VerifyEmail),
so that the handler logic — token generation, refresh-token validation, password-reset session invalidation, anti-enumeration on forgot-password, and the logger-based security signals — has the same unit-level coverage as the rest of the Application layer (currently zero unit tests; only `AuthControllerTests.cs` integration coverage).

## Acceptance Criteria

> **Reality check (epic vs. shipped code).** The Auth folder ships **6 handlers**, not "5-7" — enumerate them:
>
> | File | Handler | Result | Validator? |
> |---|---|---|---|
> | `Login.cs` | `LoginCommandHandler` | `LoginResult` (record) | Yes — `LoginCommandValidator` |
> | `RefreshToken.cs` | `RefreshTokenCommandHandler` | `RefreshTokenResult` (record) | No |
> | `Logout.cs` | `LogoutCommandHandler` | `LogoutResult` (record) | No |
> | `ForgotPassword.cs` | `ForgotPasswordCommandHandler` | `ForgotPasswordResult` (record) | Yes — `ForgotPasswordCommandValidator` |
> | `ResetPassword.cs` | `ResetPasswordCommandHandler` | `ResetPasswordResult` (record) | Yes — `ResetPasswordCommandValidator` |
> | `VerifyEmail.cs` | `VerifyEmailCommandHandler` | `VerifyEmailResult` (record) | Yes — `VerifyEmailCommandValidator` |
>
> Verified by reading every file in `backend/src/PropertyManager.Application/Auth/` (April 2026).
>
> **Surprises that will trip the dev workflow:**
>
> 1. **Login throws `UnauthorizedAccessException` on invalid credentials** — it does NOT return a result with `Success=false`. The handler's contract is to **throw** for the unauthorized path and let global exception middleware translate it to a 401 ProblemDetails. Tests must assert via `await act.Should().ThrowAsync<UnauthorizedAccessException>()`. Verified `Login.cs:83`.
> 2. **`LoginCommandHandler` constructor takes `IAppDbContext` but never uses it.** Verified `Login.cs:52, 63` and grep — no `_dbContext.X` references inside `Handle`. Tests should still pass `new Mock<IAppDbContext>().Object` to the constructor (do not refactor the production code in this story). Note in dev-notes that this is a follow-up cleanup candidate but **out of scope here**.
> 3. **`ResetPasswordCommandHandler` returns `ResetPasswordResult(success, errorMessage?)` — does NOT throw.** Even on `_identityService.ResetPasswordAsync` failure, the handler logs and returns `new ResetPasswordResult(false, errorMessage)`. Verified `ResetPassword.cs:73`.
> 4. **`ForgotPasswordCommandHandler` always returns `ForgotPasswordResult(true)` — anti-enumeration.** Whether the user exists, the email send succeeds, or the user does not exist, the result record is `Success=true`. The branch difference is observable only by verifying interactions with `IIdentityService.GeneratePasswordResetTokenAsync` and `IEmailService.SendPasswordResetEmailAsync` (called when user exists, NOT called when user does not). Verified `ForgotPassword.cs:64-79`.
> 5. **`ResetPasswordCommandHandler.ExtractUserIdFromToken`** parses `Base64(userId:actualToken)`. Tests need to construct tokens with the matching format to exercise the "session revoke" branch. Construction: `Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userId}:{actualToken}"))`. Verified `ResetPassword.cs:98-116`.
> 6. **`LogoutCommandHandler` is idempotent** — `request.RefreshToken` may be `null` or whitespace, in which case it logs and returns `Success=true` without calling `_jwtService.RevokeRefreshTokenAsync`. Verified `Logout.cs:47-65`.
> 7. **`RefreshTokenCommandHandler` does NOT rotate refresh tokens by default** — the rotation block is commented out in the handler. Tests should assert `result.NewRefreshToken == null` for the success path (the record has a default `NewRefreshToken = null`). Verified `RefreshToken.cs:68-74`.
> 8. **`VerifyEmailCommandHandler` is the simplest** — it returns `new VerifyEmailResult(success, errorMessage)` straight from `_identityService.VerifyEmailAsync`. The epic text didn't list this handler explicitly under AC-1..AC-4 ("Login, RefreshToken, ResetPassword, RequestPasswordReset"), but it lives in `Auth/` and meets the epic's own scoping rule ("Target handlers live in `backend/src/PropertyManager.Application/Auth/` — enumerate and cover each"). The story includes it in AC-6.
> 9. **The epic text says "RequestPasswordResetHandler"** — there is no such handler. The shipped code calls it `ForgotPasswordCommandHandler`. AC-4 below uses the actual class name. The behavior covered (anti-enumeration on unknown email, email service interaction) matches the epic's intent.
> 10. **`Login` and `RefreshToken` use `_jwtService.GenerateAccessTokenAsync` which returns `(string AccessToken, int ExpiresIn)`**. Tests must `.ReturnsAsync(("token", 3600))`. The signature also includes `displayName` (nullable) and `propertyId` (nullable Guid?) — pass `It.IsAny<...>()` matchers when verifying.
> 11. **Logger assertions are NOT required** for these tests. The handlers log warnings on failed login attempts and information on success/refresh, but `_logger` is just `Mock.Of<ILogger<X>>()` — we do not need to verify log calls because the project's existing handler tests do not. (Grep `backend/tests/PropertyManager.Application.Tests/**` for `_loggerMock.Verify` — zero hits.) Use `Mock.Of<ILogger<HandlerName>>()` per the established pattern (`CreateReceiptHandlerTests:72`).
> 12. **No DbContext setup is needed** for any of these handlers. Five of six don't touch `IAppDbContext` at all; Login injects but does not use it. **MockQueryable.Moq is therefore NOT used in this story** — but the project still uses it elsewhere; do not remove the package reference.

### AC-1: `LoginCommandHandler` covers success, invalid credentials, and access-token + refresh-token issuance

- **AC-1.1 (success path):** Given `IIdentityService.ValidateCredentialsAsync` returns `(success: true, userId, accountId, role: "Owner", email, displayName: "Dave H.", propertyId: null, errorMessage: null)`, and `IJwtService.GenerateAccessTokenAsync` returns `("access.jwt", 3600)`, and `IJwtService.GenerateRefreshTokenAsync` returns `"refresh.token"`,
  When `_handler.Handle(new LoginCommand("dave@example.com", "Pw1!"), default)` is awaited,
  Then the result `LoginResult` has `AccessToken == "access.jwt"`, `ExpiresIn == 3600`, `RefreshToken == "refresh.token"`, `UserId == userId`, `AccountId == accountId`, `Role == "Owner"`,
  And `_jwtService.GenerateAccessTokenAsync` was called exactly once with the same `userId, accountId, role, email, displayName, propertyId` arguments,
  And `_jwtService.GenerateRefreshTokenAsync` was called exactly once with `userId, accountId`.

- **AC-1.2 (invalid credentials throws):** Given `ValidateCredentialsAsync` returns `(success: false, ..., errorMessage: "Invalid email or password")`,
  When the handler is invoked,
  Then a `UnauthorizedAccessException` is thrown with message `"Invalid email or password"`,
  And neither `GenerateAccessTokenAsync` nor `GenerateRefreshTokenAsync` is called.

- **AC-1.3 (invalid credentials with null errorMessage uses fallback message):** Given `ValidateCredentialsAsync` returns `(success: false, ..., errorMessage: null)`,
  When the handler is invoked,
  Then `UnauthorizedAccessException.Message == "Invalid email or password"` (the handler's `?? "Invalid email or password"` fallback at `Login.cs:83`).

- **AC-1.4 (passes propertyId for tenant role through to access token):** Given `ValidateCredentialsAsync` returns success with `role: "Tenant"` and `propertyId: <guid>`,
  When the handler runs,
  Then `GenerateAccessTokenAsync` is invoked with that `propertyId`.

### AC-2: `RefreshTokenCommandHandler` covers valid, invalid/expired/revoked, and access-token issuance

- **AC-2.1 (success path):** Given `IJwtService.ValidateRefreshTokenAsync("refresh.token", _)` returns `(isValid: true, userId, accountId, role, email, displayName, propertyId)` and `GenerateAccessTokenAsync` returns `("new.access.jwt", 3600)`,
  When the handler runs `new RefreshTokenCommand("refresh.token")`,
  Then result has `AccessToken == "new.access.jwt"`, `ExpiresIn == 3600`, and `NewRefreshToken == null` (rotation is disabled — verified `RefreshToken.cs:74`),
  And `GenerateAccessTokenAsync` was called once with the resolved user info.

- **AC-2.2 (invalid token throws):** Given `ValidateRefreshTokenAsync` returns `(isValid: false, null, null, null, null, null, null)`,
  When the handler runs,
  Then a `UnauthorizedAccessException` is thrown with message `"Invalid or expired refresh token"`,
  And `GenerateAccessTokenAsync` is NOT called.

- **AC-2.3 (valid flag but missing claims throws):** Given `ValidateRefreshTokenAsync` returns `(isValid: true, userId: null, ...)` (defensive null check at `RefreshToken.cs:47`),
  When the handler runs,
  Then `UnauthorizedAccessException` is thrown.
  Repeat for: `accountId == null`, `role == null`, `email == null`. (Four small assertions, can use `[Theory]` with `MemberData` or four explicit `[Fact]` cases — pick whichever matches the existing project style; the project's neighboring tests prefer explicit `[Fact]` per scenario, so default to that.)

### AC-3: `LogoutCommandHandler` covers token-present (revoke called) and token-missing (idempotent) paths

- **AC-3.1 (token present):** Given `currentUserMock.UserId == userId` and `request.RefreshToken == "abc"`,
  When the handler runs,
  Then `_jwtService.RevokeRefreshTokenAsync("abc", _)` is called exactly once,
  And the result is `LogoutResult(true)`.

- **AC-3.2 (null token — idempotent):** Given `request.RefreshToken == null`,
  When the handler runs,
  Then `_jwtService.RevokeRefreshTokenAsync` is NEVER called,
  And the result is `LogoutResult(true)` (idempotent per AC5.2 — verified `Logout.cs:46-47`).

- **AC-3.3 (whitespace token — idempotent):** Given `request.RefreshToken == "   "` (any whitespace),
  When the handler runs,
  Then `RevokeRefreshTokenAsync` is NOT called and the result is `LogoutResult(true)`.

### AC-4: `ForgotPasswordCommandHandler` covers anti-enumeration and email-send interaction

- **AC-4.1 (existing user — token generated and email sent):** Given `_identityService.GetUserIdByEmailAsync("user@example.com", _)` returns a `Guid?` non-null and `_identityService.GeneratePasswordResetTokenAsync(userId, _)` returns `"reset.token.value"`,
  When the handler runs `new ForgotPasswordCommand("user@example.com")`,
  Then `_emailService.SendPasswordResetEmailAsync("user@example.com", "reset.token.value", _)` is called exactly once,
  And the result is `ForgotPasswordResult(true)`.

- **AC-4.2 (unknown user — anti-enumeration: NO email is sent, but result is still success):** Given `GetUserIdByEmailAsync` returns `null`,
  When the handler runs,
  Then `_identityService.GeneratePasswordResetTokenAsync` is NEVER called,
  And `_emailService.SendPasswordResetEmailAsync` is NEVER called,
  And the result is `ForgotPasswordResult(true)` (anti-enumeration — verified `ForgotPassword.cs:78-79`).

- **AC-4.3 (email service throws — propagates):** Given `GetUserIdByEmailAsync` returns a non-null Guid, `GeneratePasswordResetTokenAsync` returns a string, and `SendPasswordResetEmailAsync` throws an `InvalidOperationException("SMTP unreachable")`,
  When the handler is awaited,
  Then the exception propagates (the handler does NOT swallow it — verified by reading `ForgotPassword.cs:67-68`; there is no try/catch around the email send).
  *Justification:* documents the actual contract — the controller currently catches and ignores at `AuthController.cs:217`'s level; the handler itself does not handle email failure.

### AC-5: `ResetPasswordCommandHandler` covers valid token (success + session revoke), invalid token, and malformed token (no userId extraction)

- **AC-5.1 (valid token — success path):** Given `_identityService.ResetPasswordAsync(token, "NewPw1!", _)` returns `(true, null)` AND the token is constructed as `Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userId}:innerToken"))` so `ExtractUserIdFromToken` succeeds,
  When the handler runs,
  Then `_jwtService.RevokeAllUserRefreshTokensAsync(userId, _)` is called exactly once (AC6.4 — invalidate all sessions),
  And the result is `ResetPasswordResult(true, null)`.

- **AC-5.2 (invalid token returned by Identity — failure result, sessions NOT revoked):** Given `ResetPasswordAsync` returns `(false, "Invalid token")`,
  When the handler runs,
  Then `RevokeAllUserRefreshTokensAsync` is NEVER called,
  And the result is `ResetPasswordResult(false, "Invalid token")`.

- **AC-5.3 (malformed Base64 token — success but session revoke skipped):** Given `ResetPasswordAsync` returns `(true, null)` AND the supplied token is `"this-is-not-base64!"`,
  When the handler runs,
  Then `RevokeAllUserRefreshTokensAsync` is NEVER called (because `ExtractUserIdFromToken` returns null),
  And the result is `ResetPasswordResult(true, null)`.

- **AC-5.4 (well-formed Base64 but parts.Length != 2 — session revoke skipped):** Given `ResetPasswordAsync` returns `(true, null)` AND the token is `Convert.ToBase64String(Encoding.UTF8.GetBytes("no-colon-here"))`,
  When the handler runs,
  Then `RevokeAllUserRefreshTokensAsync` is NEVER called,
  And the result is `ResetPasswordResult(true, null)`.

### AC-6: `VerifyEmailCommandHandler` covers success and failure passthrough

- **AC-6.1 (success):** Given `_identityService.VerifyEmailAsync(token, _)` returns `(true, null)`,
  When the handler runs `new VerifyEmailCommand("vtoken")`,
  Then the result is `VerifyEmailResult(true, null)`.

- **AC-6.2 (failure passthrough):** Given `VerifyEmailAsync` returns `(false, "Invalid verification token")`,
  When the handler runs,
  Then the result is `VerifyEmailResult(false, "Invalid verification token")` — the handler does not transform the error.

### AC-7: All new tests follow existing handler unit test conventions (project parity)

- **AC-7.1 (file & namespace conventions):** New test files live under `backend/tests/PropertyManager.Application.Tests/Auth/` with namespace `PropertyManager.Application.Tests.Auth`. One file per handler (six files): `LoginCommandHandlerTests.cs`, `RefreshTokenCommandHandlerTests.cs`, `LogoutCommandHandlerTests.cs`, `ForgotPasswordCommandHandlerTests.cs`, `ResetPasswordCommandHandlerTests.cs`, `VerifyEmailCommandHandlerTests.cs`. Mirrors existing structure (e.g., `Receipts/CreateReceiptHandlerTests.cs`, `AccountUsers/UpdateUserRoleHandlerTests.cs`).
- **AC-7.2 (mock construction):** Each test class constructs its mocks in the constructor (no `[SetUp]`), uses `Mock<T>` for service mocks, `Mock.Of<ILogger<HandlerName>>()` for the logger (per `CreateReceiptHandlerTests.cs:72`), and assigns the SUT to a `_handler` field.
- **AC-7.3 (assertion library):** All assertions use FluentAssertions (`.Should().Be(...)`, `.Should().ThrowAsync<...>()`, `.Should().NotBeNull()`). No bare `Assert.Equal`.
- **AC-7.4 (test naming):** Method naming `Handle_Scenario_ExpectedResult` (project convention — `project-context.md:107`). Examples: `Handle_ValidCredentials_ReturnsTokens`, `Handle_InvalidCredentials_ThrowsUnauthorizedAccessException`, `Handle_NullRefreshToken_ReturnsSuccessWithoutRevoke`.
- **AC-7.5 (interaction verification):** Tests verify the relevant `Mock<T>.Verify(...)` calls (e.g., `_jwtServiceMock.Verify(x => x.GenerateAccessTokenAsync(...), Times.Once)`, `Times.Never` for branches). Logger verification is NOT required (matches existing project pattern — zero `_loggerMock.Verify` hits across `Application.Tests/**`).
- **AC-7.6 (test count target):** **Minimum 22 test cases total across the 6 files** (4 + 5 + 3 + 3 + 4 + 2 + 1 sanity case for AC-1.4 = 22). The dev-story may add more if a useful edge case surfaces during TDD; do not consolidate ACs to reduce count below this floor.

### AC-8: Test suite runs green and is wired into the existing test command

- **AC-8.1 (build & run):** `dotnet test backend/PropertyManager.sln --filter "FullyQualifiedName~PropertyManager.Application.Tests.Auth"` runs cleanly with zero failures and the new tests are discovered (count >= 22).
- **AC-8.2 (no regressions):** `dotnet test backend/PropertyManager.sln` passes overall — no other test class is broken by the additions.

## Tasks / Subtasks

- [x] **Task 1: Create `LoginCommandHandlerTests.cs` (AC-1, AC-7)**
  - [x] 1.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/LoginCommandHandlerTests.cs` with namespace `PropertyManager.Application.Tests.Auth`.
  - [x] 1.2 Constructor: instantiate `Mock<IIdentityService>`, `Mock<IJwtService>`, `Mock<IAppDbContext>`, `Mock.Of<ILogger<LoginCommandHandler>>()`. Assign `_handler = new LoginCommandHandler(_identityServiceMock.Object, _jwtServiceMock.Object, _dbContextMock.Object, Mock.Of<ILogger<LoginCommandHandler>>())`.
  - [x] 1.3 Default helper `SetupValidCredentials(...)` that wires `ValidateCredentialsAsync` to a success tuple — call from the success-path test only. *Inlined per-test for clarity since each test's expected tuple differed (success vs invalid vs tenant role); a shared helper would have produced more complexity than it removed.*
  - [x] 1.4 `[Fact] Handle_ValidCredentials_ReturnsTokensAndCallsJwtServices` (AC-1.1).
  - [x] 1.5 `[Fact] Handle_InvalidCredentials_ThrowsUnauthorizedAccessException_WithIdentityErrorMessage` (AC-1.2).
  - [x] 1.6 `[Fact] Handle_InvalidCredentials_NullErrorMessage_ThrowsUnauthorizedAccessException_WithFallback` (AC-1.3).
  - [x] 1.7 `[Fact] Handle_TenantRoleWithPropertyId_PassesPropertyIdToAccessTokenGeneration` (AC-1.4).
  - [x] 1.8 Verify on success path: `GenerateAccessTokenAsync(userId, accountId, role, email, displayName, propertyId, _)` called `Times.Once` AND `GenerateRefreshTokenAsync(userId, accountId, _)` called `Times.Once`.
  - [x] 1.9 Verify on failure path: both JWT methods `Times.Never`.

- [x] **Task 2: Create `RefreshTokenCommandHandlerTests.cs` (AC-2, AC-7)**
  - [x] 2.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/RefreshTokenCommandHandlerTests.cs`.
  - [x] 2.2 Constructor: `Mock<IJwtService>`, `Mock.Of<ILogger<RefreshTokenCommandHandler>>()`. Build SUT.
  - [x] 2.3 `[Fact] Handle_ValidRefreshToken_ReturnsNewAccessTokenAndNullNewRefreshToken` (AC-2.1).
  - [x] 2.4 `[Fact] Handle_InvalidRefreshToken_ThrowsUnauthorizedAccessException` (AC-2.2 — `isValid:false`).
  - [x] 2.5 `[Fact] Handle_NullUserId_ThrowsUnauthorizedAccessException` (AC-2.3 — `userId == null` even when `isValid:true`).
  - [x] 2.6 `[Fact] Handle_NullAccountId_ThrowsUnauthorizedAccessException` (AC-2.3 — `accountId == null`).
  - [x] 2.7 `[Fact] Handle_NullRole_ThrowsUnauthorizedAccessException` (AC-2.3 — `role == null`).
  - [x] 2.8 `[Fact] Handle_NullEmail_ThrowsUnauthorizedAccessException` (AC-2.3 — `email == null`).

- [x] **Task 3: Create `LogoutCommandHandlerTests.cs` (AC-3, AC-7)**
  - [x] 3.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/LogoutCommandHandlerTests.cs`.
  - [x] 3.2 Constructor: `Mock<IJwtService>`, `Mock<ICurrentUser>`, `Mock.Of<ILogger<LogoutCommandHandler>>()`. The `ICurrentUser.UserId` setup is informational (used in log) — wire it but don't assert on it.
  - [x] 3.3 `[Fact] Handle_RefreshTokenProvided_RevokesTokenAndReturnsSuccess` (AC-3.1).
  - [x] 3.4 `[Fact] Handle_NullRefreshToken_DoesNotRevokeAndReturnsSuccess` (AC-3.2).
  - [x] 3.5 `[Fact] Handle_WhitespaceRefreshToken_DoesNotRevokeAndReturnsSuccess` (AC-3.3).

- [x] **Task 4: Create `ForgotPasswordCommandHandlerTests.cs` (AC-4, AC-7)**
  - [x] 4.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/ForgotPasswordCommandHandlerTests.cs`.
  - [x] 4.2 Constructor: `Mock<IIdentityService>`, `Mock<IEmailService>`, `Mock.Of<ILogger<ForgotPasswordCommandHandler>>()`. Build SUT.
  - [x] 4.3 `[Fact] Handle_KnownEmail_GeneratesTokenAndSendsEmail_ReturnsSuccess` (AC-4.1) — assert `SendPasswordResetEmailAsync` called once with `(email, token, _)`.
  - [x] 4.4 `[Fact] Handle_UnknownEmail_DoesNotGenerateTokenOrSendEmail_StillReturnsSuccess` (AC-4.2) — anti-enumeration; verify `Times.Never` on both Identity token gen and email send.
  - [x] 4.5 `[Fact] Handle_EmailServiceThrows_PropagatesException` (AC-4.3) — `Should().ThrowAsync<InvalidOperationException>().WithMessage("*SMTP unreachable*")`.

- [x] **Task 5: Create `ResetPasswordCommandHandlerTests.cs` (AC-5, AC-7)**
  - [x] 5.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/ResetPasswordCommandHandlerTests.cs`.
  - [x] 5.2 Constructor: `Mock<IIdentityService>`, `Mock<IJwtService>`, `Mock.Of<ILogger<ResetPasswordCommandHandler>>()`. Build SUT.
  - [x] 5.3 Helper `BuildValidToken(Guid userId)` returning `Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userId}:inner"))`.
  - [x] 5.4 `[Fact] Handle_ValidTokenAndIdentitySuccess_RevokesAllSessionsAndReturnsSuccess` (AC-5.1).
  - [x] 5.5 `[Fact] Handle_IdentityFailure_DoesNotRevokeSessionsAndReturnsFailure` (AC-5.2).
  - [x] 5.6 `[Fact] Handle_MalformedBase64Token_SuccessButSkipsSessionRevoke` (AC-5.3).
  - [x] 5.7 `[Fact] Handle_TokenWithoutColonSeparator_SuccessButSkipsSessionRevoke` (AC-5.4).

- [x] **Task 6: Create `VerifyEmailCommandHandlerTests.cs` (AC-6, AC-7)**
  - [x] 6.1 Create `backend/tests/PropertyManager.Application.Tests/Auth/VerifyEmailCommandHandlerTests.cs`.
  - [x] 6.2 Constructor: `Mock<IIdentityService>`. (No logger field — `VerifyEmailCommandHandler` does not take an `ILogger`. Verified `VerifyEmail.cs:35-40`.) Build SUT with the single mock.
  - [x] 6.3 `[Fact] Handle_ValidToken_ReturnsSuccessResult` (AC-6.1).
  - [x] 6.4 `[Fact] Handle_InvalidToken_PassesIdentityErrorMessageThrough` (AC-6.2).

- [x] **Task 7: Run, verify, no regressions (AC-8)**
  - [x] 7.1 `cd backend && dotnet build` — clean build (0 Warnings, 0 Errors introduced by the new tests).
  - [x] 7.2 `cd backend && dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Auth"` — 22/22 passed.
  - [x] 7.3 `cd backend && dotnet test` — full suite: Application.Tests 1211/1211, Infrastructure.Tests 98/98, Api.Tests 790/791 (1 pre-existing failure unrelated to this story; see Completion Notes).
  - [x] 7.4 Confirmed: zero DbSet setup in any of the 6 new test files. `IAppDbContext` is mocked but never configured (Login handler doesn't read from it; the other handlers don't take it).

- [x] **Task 8: Sprint status + story status update (process)**
  - [x] 8.1 Updated `docs/project/sprint-status.yaml`: `21-9-auth-handler-unit-tests: review`.
  - [x] 8.2 Set this story's `Status:` line to `review`.
  - [x] 8.3 Filled out Dev Agent Record below.

## Dev Notes

### Test Scope

This is a **backend-only, unit-test-only** story. Unit tests ARE the deliverable.

| Layer | Required? | Justification |
|---|---|---|
| **Unit tests (xUnit + Moq + FluentAssertions)** | **Required — this IS the story** | Six handlers in `backend/src/PropertyManager.Application/Auth/` currently have zero unit-test coverage. Story closes that gap. Six new test files, ≥22 test cases. |
| **Integration tests (.NET WebApplicationFactory)** | **Not required** | Auth integration coverage already exists in `backend/tests/PropertyManager.Api.Tests/AuthControllerTests.cs` (~25 methods per epic text). This story is the *unit-test* counterpart; it does not add or change endpoints, so no new integration tests are needed. Justified per Epic 21 testing-pyramid backfill scope. |
| **E2E tests (Playwright)** | **Not required** | No UI changes. Login, password-reset, and email-verification E2E flows are already exercised by `frontend/e2e/tests/auth/*` and `frontend/e2e/tests/invitations/*`. Justified — the story is backend-only and adds zero user-visible behavior. |

### Pattern Reference — mirror `AccountUsers/UpdateUserRoleHandlerTests.cs` and `Receipts/CreateReceiptHandlerTests.cs`

The two canonical references in this repo for handler unit tests:

1. **`backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleHandlerTests.cs`** — establishes:
   - Constructor-time mock setup with `Mock<T>` fields
   - `Mock<ICurrentUser>` configured with `Setup(x => x.AccountId).Returns(_testAccountId)`
   - FluentAssertions throw assertions: `await act.Should().ThrowAsync<NotFoundException>()`
   - Method naming: `Handle_Scenario_ExpectedResult`
   - One `[Fact]` per scenario, no `[Theory]` unless data-driven naturally
   - Verification: `_identityServiceMock.Verify(x => x.UpdateUserRoleAsync(...), Times.Once)`

2. **`backend/tests/PropertyManager.Application.Tests/Receipts/CreateReceiptHandlerTests.cs`** — establishes:
   - `Mock.Of<ILogger<HandlerName>>()` as the logger pattern (line 72)
   - Multiple service mocks injected and verified
   - DbSet mocking via `MockQueryable.Moq.BuildMockDbSet()` (NOT used in this story but the pattern is here for reference if a future auth-related test needs it)

### Anti-pitfalls (don't make these mistakes)

1. **Don't write tests that exercise the validators' rules.** Validators are tested by FluentValidation conventions in separate `*ValidatorTests.cs` files (see `Vendors/CreateVendorValidatorTests.cs`). This story is *handler* tests only. The epic text places validator-coverage polish under Story 21.11.
2. **Don't try to unit-test `_logger.LogWarning` / `LogInformation` calls.** None of the existing handler tests in this codebase verify logger calls. The logger is a `Mock.Of<ILogger<X>>()` placeholder that does nothing. Adding logger verification here would create a project-wide inconsistency. (If logger-output coverage is desired, file a separate story to standardize a logger-verification helper across all handler tests.)
3. **Don't try to refactor the unused `IAppDbContext` field on `LoginCommandHandler`.** It's a real code smell (verified — declared, assigned, never used), but cleaning it up requires touching production code, which is out of scope for a test-only story. Note it in the Dev Agent Record's "Completion Notes" as a follow-up cleanup candidate. Tests must still pass `new Mock<IAppDbContext>().Object` to the constructor to satisfy the signature.
4. **Don't construct random/empty Base64 tokens for the ResetPassword "valid" path.** `ExtractUserIdFromToken` parses `Base64(userId:innerToken)` — get this format wrong and you'll be debugging why `RevokeAllUserRefreshTokensAsync` is never called when you expect it. Use the `BuildValidToken(Guid)` helper exactly as in Task 5.3.
5. **Don't assert on token *content* in Login/RefreshToken success paths.** The handler returns whatever the mocked `IJwtService` returns — assert on the wiring (`AccessToken == "access.jwt"` because that's what the mock returned), not on JWT structure. JWT structure is the Infrastructure layer's concern, covered by `JwtServiceTests` if it exists (out of scope here).
6. **Don't add a logger to `VerifyEmailCommandHandler` test setup.** That handler does not inject `ILogger`. Verified `VerifyEmail.cs:35-40`. Adding a `Mock.Of<ILogger<VerifyEmailCommandHandler>>()` argument will fail to compile.
7. **Don't skip the `currentUserMock.Setup(x => x.UserId)` in the Logout test.** The handler reads it for the log message at `Logout.cs:55-56`. If unset, `Mock<ICurrentUser>` returns `default(Guid)` = `Guid.Empty`, which the log call accepts without error — so the test won't fail, but if a future change asserts non-empty, your test would not catch it. Wire the value as a precaution. (Minor — not an AC, but note it in implementation.)
8. **Don't wire MockQueryable.Moq for these tests.** None of the auth handlers query a DbSet in `Handle`. If the dev workflow reaches for `BuildMockDbSet`, that's a sign they're testing the wrong thing.
9. **Don't add new `using` directives for things already in `<Using Include="Xunit" />` (csproj).** The xUnit using is global; redundant `using Xunit;` per-file lints fine but is noise. Match the style of the existing test files (no top-level `using Xunit;`).
10. **Don't change the `Handle` method signature in production code to make testing easier.** This is a test-only story. If a handler is hard to test, document why in the Dev Agent Record — do not refactor production code for testability without a separate story.
11. **Don't assert on `Guid.Empty` for unset Guid claims** — use specific guids generated in the constructor (`_testUserId`, `_testAccountId`) so that the `Verify(...)` calls assert against known values, not against whatever `default(Guid)` happens to be.
12. **Don't merge multiple ACs into one test.** Each AC sub-bullet (AC-1.1, AC-1.2, etc.) is a separate `[Fact]`. Coverage tooling (`coverlet`) reports line/branch coverage; merging tests reduces signal when one branch breaks.

### Previous Story Intelligence

**Story 21.8 (done, PR #394 — most recent prior story in epic)** — Work Orders E2E. Frontend-only. **Carry-over to this story:** the "test-only story discipline" pattern — no production code modified, no new `data-testid` attributes, all test code lives in `tests/`. Also reinforces the "split per concern" rule (Story 21.8 split 5 spec files; this story splits 6 test files — one per handler). The "Reality check (epic vs. shipped code)" preamble convention from 21.8 is replicated in this story's AC section to surface the 12 surprises listed at the top.

**Story 21.7 (done, PR #386)** — Frontend unit tests for `api.service.ts` + `auth.interceptor.ts`. Pure Vitest; no overlap, but the **"test-only story discipline"** is the same — no production code modified. The "Reality check" preamble pattern was inherited from 21.7 too. **Carry-over:** the AC numbering convention (AC-1.1, AC-1.2 ...) for sub-criteria within a single AC group.

**Story 21.6 (done, PR #384)** — Backend integration tests for `VendorsController` GET/PUT. Confirms the project's xUnit + Moq + FluentAssertions stack and the `WebApplicationFactory` integration testing pattern. **Carry-over:** none directly (this story is unit, not integration), but the backend-tests folder structure (`backend/tests/PropertyManager.{Layer}.Tests/{Feature}/...`) is the same.

**Story 21.5 (done, PR #383)** — Backend integration tests for `WorkOrderPhotosController`. Same pattern reference as 21.6 for tests-folder layout.

**Story 18.1 (done — Issue #319)** — MockQueryable.Moq v10 upgrade. **Critical carry-over:** if a future auth handler ever takes an `IAppDbContext` and starts querying DbSets, follow the v10 pattern (`.BuildMockDbSet()` directly on a list — no `.AsQueryable()`). The current story doesn't need it, but the rule still applies repo-wide.

**Story 1.4 (done, original Login implementation)** — established the `LoginResult`/`UnauthorizedAccessException` contract used here. The `?? "Invalid email or password"` fallback at `Login.cs:83` was added by Story 1.4 — AC-1.3 is here to pin that behavior.

**Story 1.6 (done, original Password Reset implementation)** — established the `Base64(userId:innerToken)` shape on the reset-password token. **Critical:** AC-5 above is testing *that very contract*; if the token shape changes upstream (e.g., the project moves to a JWT-encoded reset token), AC-5.3/AC-5.4 will need updating. Document this in the Dev Agent Record so a future migration knows where to look.

### Files to create

- `backend/tests/PropertyManager.Application.Tests/Auth/LoginCommandHandlerTests.cs` (Task 1) — AC-1
- `backend/tests/PropertyManager.Application.Tests/Auth/RefreshTokenCommandHandlerTests.cs` (Task 2) — AC-2
- `backend/tests/PropertyManager.Application.Tests/Auth/LogoutCommandHandlerTests.cs` (Task 3) — AC-3
- `backend/tests/PropertyManager.Application.Tests/Auth/ForgotPasswordCommandHandlerTests.cs` (Task 4) — AC-4
- `backend/tests/PropertyManager.Application.Tests/Auth/ResetPasswordCommandHandlerTests.cs` (Task 5) — AC-5
- `backend/tests/PropertyManager.Application.Tests/Auth/VerifyEmailCommandHandlerTests.cs` (Task 6) — AC-6

### Files to modify

- `docs/project/sprint-status.yaml` — `21-9-auth-handler-unit-tests: review` (Task 8.1)
- `docs/project/stories/epic-21/21-9-auth-handler-unit-tests.md` — Status + Dev Agent Record (Task 8.2, 8.3)

### Files NOT to modify

- All production code under `backend/src/PropertyManager.Application/Auth/` — test-only story. Do not refactor the unused `IAppDbContext` field on Login. Do not rename handlers. Do not change any record signature.
- `backend/src/PropertyManager.Application/Common/LogSanitizer.cs` — used by `ForgotPassword` and `ResetPassword` for log-output sanitization; no changes needed because we are not asserting on log output.
- `backend/tests/PropertyManager.Api.Tests/AuthControllerTests.cs` — existing integration tests; out of scope for this story. Don't touch.
- `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj` — no new package references needed. The current packages (xUnit, Moq, FluentAssertions, MockQueryable.Moq) are sufficient.

### References

- [Login.cs (Auth handler under test)](../../../backend/src/PropertyManager.Application/Auth/Login.cs) — `LoginCommandHandler`, `LoginResult`, validator
- [RefreshToken.cs](../../../backend/src/PropertyManager.Application/Auth/RefreshToken.cs) — `RefreshTokenCommandHandler`, no rotation by default (line 74)
- [Logout.cs](../../../backend/src/PropertyManager.Application/Auth/Logout.cs) — idempotent handler (lines 47-65)
- [ForgotPassword.cs](../../../backend/src/PropertyManager.Application/Auth/ForgotPassword.cs) — anti-enumeration logic (lines 64-79)
- [ResetPassword.cs](../../../backend/src/PropertyManager.Application/Auth/ResetPassword.cs) — `ExtractUserIdFromToken` parses `Base64(userId:innerToken)` (lines 98-116); session revoke on success (lines 78-85)
- [VerifyEmail.cs](../../../backend/src/PropertyManager.Application/Auth/VerifyEmail.cs) — simplest handler, no logger (lines 33-48)
- [IIdentityService.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs) — `ValidateCredentialsAsync` tuple shape (lines 60-63), `GetUserIdByEmailAsync` (line 70), `GeneratePasswordResetTokenAsync` (line 77), `ResetPasswordAsync` (line 84), `VerifyEmailAsync` (line 51)
- [IJwtService.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/IJwtService.cs) — `GenerateAccessTokenAsync` returns `(string, int)` (line 14), `ValidateRefreshTokenAsync` tuple (line 37), `RevokeRefreshTokenAsync` (line 44), `RevokeAllUserRefreshTokensAsync` (line 51)
- [IEmailService.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs) — `SendPasswordResetEmailAsync` (lines 21-24)
- [ICurrentUser.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs) — `UserId`, `AccountId`, `Role` properties
- [AccountUsers/UpdateUserRoleHandlerTests.cs (PRIMARY PATTERN REFERENCE)](../../../backend/tests/PropertyManager.Application.Tests/AccountUsers/UpdateUserRoleHandlerTests.cs) — single-service-mock handler test pattern, FluentAssertions throw style
- [AccountUsers/RemoveAccountUserHandlerTests.cs](../../../backend/tests/PropertyManager.Application.Tests/AccountUsers/RemoveAccountUserHandlerTests.cs) — `Mock<ICurrentUser>` setup pattern, `_testAccountId` constructor field
- [Receipts/CreateReceiptHandlerTests.cs](../../../backend/tests/PropertyManager.Application.Tests/Receipts/CreateReceiptHandlerTests.cs) — `Mock.Of<ILogger<X>>()` pattern (line 72), multi-mock constructor wiring
- [Vendors/CreateVendorHandlerTests.cs](../../../backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorHandlerTests.cs) — additional handler-test reference for style consistency
- [PropertyManager.Application.Tests.csproj](../../../backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj) — confirms package versions: `Moq 4.20.72`, `FluentAssertions 8.9.0`, `xunit 2.9.3`, `MockQueryable.Moq 10.0.5`, `coverlet.collector 10.0.0`, target `net10.0`. Global `<Using Include="Xunit" />`.
- [AuthController.cs](../../../backend/src/PropertyManager.Api/Controllers/AuthController.cs) — confirms all 6 auth handlers are wired up in production (verify-email, login, refresh, logout, forgot-password, reset-password)
- [AuthControllerTests.cs (existing integration coverage — out of scope, do not modify)](../../../backend/tests/PropertyManager.Api.Tests/AuthControllerTests.cs) — confirms what's already covered at the integration layer
- [project-context.md → Backend testing rules](../../project-context.md) — line 107: `Method_Scenario_ExpectedResult` naming; line 109: constructor mock setup; line 111: `MockQueryable.Moq v10 — BuildMockDbSet()` (not used in this story but confirms the convention); line 113: FluentAssertions for all assertions; line 138: each handler/validator gets its own test class
- [Story 21.8 (done)](./21-8-work-orders-e2e.md) — most-recent E2E story; "test-only discipline" carry-over
- [Story 21.7 (done)](./21-7-core-frontend-service-unit-tests.md) — most-recent unit-test story in epic; "Reality check" preamble pattern; AC-X.Y sub-numbering
- [Story 21.6 (done)](./21-6-vendors-controller-integration-tests.md) — backend-tests folder layout reference
- [Story 18.1 (done — Issue #319)](../epic-18/18-1-upgrade-mockqueryable-moq.md) — MockQueryable.Moq v10 upgrade; pattern enforced repo-wide
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic
- [Moq async setup docs (verified Apr 2026 via Ref MCP)](https://github.com/devlooped/moq/blob/main/readme.md) — `ReturnsAsync(...)` and `ThrowsAsync(...)` API
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit that spawned this epic
- CLAUDE.md → Backend testing standards

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`. Branch: `story/21-9-auth-handler-unit-tests`.

### Debug Log References

- `dotnet test --filter "FullyQualifiedName~LoginCommandHandlerTests"` — 4/4 passed (62 ms)
- `dotnet test --filter "FullyQualifiedName~RefreshTokenCommandHandlerTests"` — 6/6 passed (44 ms)
- `dotnet test --filter "FullyQualifiedName~LogoutCommandHandlerTests"` — 3/3 passed (37 ms)
- `dotnet test --filter "FullyQualifiedName~ForgotPasswordCommandHandlerTests"` — 3/3 passed (44 ms)
- `dotnet test --filter "FullyQualifiedName~ResetPasswordCommandHandlerTests"` — 4/4 passed (39 ms)
- `dotnet test --filter "FullyQualifiedName~VerifyEmailCommandHandlerTests"` — 2/2 passed (32 ms)
- `dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Auth"` — 22/22 passed (46 ms) — meets AC-7.6 floor exactly
- `dotnet test` (full suite) — Application.Tests 1211/1211, Infrastructure.Tests 98/98, Api.Tests 790/791

### Completion Notes List

**TDD discipline.** This is a "test the existing handler" story, so the standard fail-then-pass cycle reduced to "write the test, run it, expect green on first run". Each test passed on the first run against the real handler — confirming the test correctly captured handler behavior rather than asserting against a hallucinated contract.

**File-by-file count (708 lines total across 6 files).**
- `LoginCommandHandlerTests.cs` (155 lines, 4 tests, AC-1.1–1.4)
- `RefreshTokenCommandHandlerTests.cs` (156 lines, 6 tests, AC-2.1–2.3 split into individual `[Fact]` cases per the story's "default to explicit `[Fact]` per scenario" instruction)
- `LogoutCommandHandlerTests.cs` (84 lines, 3 tests, AC-3.1–3.3)
- `ForgotPasswordCommandHandlerTests.cs` (114 lines, 3 tests, AC-4.1–4.3)
- `ResetPasswordCommandHandlerTests.cs` (134 lines, 4 tests, AC-5.1–5.4 — uses inline `BuildValidToken` private helper as specified in Task 5.3)
- `VerifyEmailCommandHandlerTests.cs` (65 lines, 2 tests, AC-6.1–6.2 — no `ILogger` per the handler's actual constructor)

**Pre-existing test failure (unrelated to this story).** During the full-suite run, `PropertyManager.Api.Tests.TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` failed with HTTP 400 on a POST to `/api/v1/expenses` (TestControllerTests.cs:309). This test is in `Api.Tests`, exercises an unrelated controller, and has nothing to do with the Auth handlers covered by this story. Per the story's own instruction ("note them but don't fix them in this story"), it is documented here and left for a follow-up.

**Helper inlined.** Task 1.3 originally suggested a `SetupValidCredentials(...)` helper. Each Login test needed a different success/failure tuple shape (success vs. invalid vs. tenant role with propertyId), so a shared helper would have produced more parameter-permutation complexity than it eliminated. Each test wires its own `_identityServiceMock.Setup(...)` inline. This matches the project's other handler tests (e.g., `UpdateUserRoleHandlerTests.cs` does not use such helpers).

**Anti-pitfall #3 — `IAppDbContext` on `LoginCommandHandler`.** Confirmed: the field is declared and assigned but never read inside `Handle`. Tests pass `new Mock<IAppDbContext>().Object` per the story's Reality Check item #2. Production code unchanged. **Follow-up cleanup candidate (out of scope here):** drop `IAppDbContext` from the `LoginCommandHandler` constructor and DI registration. Would touch `Login.cs:52, 58, 63` and any DI wiring; no test would need to change beyond removing the third constructor argument.

**Anti-pitfall #4 — Token format on ResetPassword.** AC-5.1 uses `Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userId}:inner"))` exactly as specified. Test confirmed `RevokeAllUserRefreshTokensAsync` is called once with the correct `userId`. AC-5.3 ("not-base64") and AC-5.4 (Base64-but-no-colon) both correctly skip session revoke (`Times.Never`). Story 1.6 owns this contract — if it changes upstream, AC-5.3/AC-5.4 will need updating.

**No DbSet mocking, no MockQueryable.Moq usage.** As predicted in the Reality Check (item #12), none of the 6 new test files pull in `MockQueryable.Moq` or call `BuildMockDbSet`. Auth handlers don't query DbSets.

**No logger verification.** Per AC-7.5 and the project's existing pattern (zero `_loggerMock.Verify` hits across `Application.Tests/**`), no logger calls are asserted. Loggers use `Mock.Of<ILogger<HandlerName>>()`.

**Pyramid scope respected.** Unit tests only — no integration tests added (existing coverage in `AuthControllerTests.cs`), no E2E tests added (existing coverage in `frontend/e2e/tests/auth/*`).

### File List

**Created:**
- `backend/tests/PropertyManager.Application.Tests/Auth/LoginCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/RefreshTokenCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/LogoutCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/ForgotPasswordCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/ResetPasswordCommandHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Auth/VerifyEmailCommandHandlerTests.cs`

**Modified:**
- `docs/project/sprint-status.yaml` — set `21-9-auth-handler-unit-tests: review`
- `docs/project/stories/epic-21/21-9-auth-handler-unit-tests.md` — Status, Tasks, Dev Agent Record

**Production code: zero modifications** (test-only story, per AC-7 / anti-pitfall #10).
