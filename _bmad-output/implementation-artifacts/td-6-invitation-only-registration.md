# Story TD.6: Invitation-Only Registration

Status: in-progress

## Story

As the system administrator,
I want to restrict account creation to email invitations only,
so that I can control exactly who has access to the property management system.

## Acceptance Criteria

1. **AC-TD.6.1**: Public registration is removed
   - "Don't have an account? Create one" link/text removed from login page
   - Public registration page/route is removed or disabled
   - Direct navigation to `/register` redirects to login (or shows "invitation required" message)
   - Public registration API endpoint returns 404 or appropriate error

2. **AC-TD.6.2**: Invitation entity and persistence
   - `Invitation` entity with: Id, Email, Code (unique), CreatedAt, ExpiresAt, UsedAt (nullable)
   - Invitation codes expire after 24 hours
   - Each invitation code is single-use only
   - Expired or used invitations cannot be redeemed

3. **AC-TD.6.3**: Invitation creation via API (Postman)
   - `POST /api/v1/invitations` endpoint protected with `[Authorize(Roles = "Owner")]`
   - Owner logs in via Postman, uses JWT to call invitation endpoint
   - Returns success with invitation ID, or error if:
     - Email already has pending invitation
     - Email already registered as user
   - Invitation email sent via configured email service (MailHog in dev)

4. **AC-TD.6.4**: First owner seeded in migration
   - Database truncated (all dev data removed)
   - First owner account (`claude@claude.com`) seeded in migration
   - No bootstrap/first-run registration logic needed

5. **AC-TD.6.5**: Invitation email
   - Email contains link to accept invitation (e.g., `https://app.domain.com/accept-invitation?code=xxx`)
   - Email includes clear instructions and expiration notice (24 hours)
   - Email template is professional and matches app branding

6. **AC-TD.6.6**: Accept invitation flow (frontend)
   - New route `/accept-invitation` with query param `code`
   - Page validates invitation code on load
   - If code invalid/expired/used: show appropriate error message
   - If code valid: show form to set password (and confirm password)
   - On submit: create account and mark invitation as used
   - Redirect to login page on success (with success message)

7. **AC-TD.6.7**: Dead code removal
   - Remove unused registration components, services, and routes
   - Remove unused registration API endpoints/handlers
   - Remove associated unit tests for deleted code
   - Ensure no orphaned imports or references

## Tasks / Subtasks

- [x] Task 1: Truncate Database and Seed First Owner (AC: TD.6.4)
  - [x] Truncate all existing dev data from database
  - [x] Create migration to seed first owner account (`claude@claude.com` / `1@mClaude`)
  - [x] Verify seed works on fresh database

- [x] Task 2: Create Invitation Entity and Migration (AC: TD.6.2)
  - [x] Create `Invitation` entity in Domain layer
  - [x] Add EF Core configuration in Infrastructure
  - [x] Create and run database migration
  - [x] Add unique index on Code column

- [x] Task 3: Create Invitation Commands/Handlers (AC: TD.6.2, TD.6.3)
  - [x] `CreateInvitationCommand` with email validation
  - [x] `CreateInvitationHandler` - generates code, saves invitation, triggers email
  - [x] `ValidateInvitationQuery` - checks if code is valid, not expired, not used
  - [x] `AcceptInvitationCommand` - creates user, marks invitation as used
  - [x] Add FluentValidation validators

- [x] Task 4: Create Invitation API Endpoints (AC: TD.6.3, TD.6.6)
  - [x] `POST /api/v1/invitations` - create invitation (protected, Owner role)
  - [x] `GET /api/v1/invitations/{code}/validate` - validate code (public)
  - [x] `POST /api/v1/invitations/{code}/accept` - accept invitation and create account (public)
  - [x] Appropriate error responses for invalid/expired/used codes

- [x] Task 5: Create Invitation Email Template (AC: TD.6.5)
  - [x] Add `SendInvitationEmailAsync` to IEmailService interface
  - [x] Implement in SmtpEmailService with HTML/text templates
  - [ ] Test with MailHog

- [ ] Task 6: Create Accept Invitation Page (AC: TD.6.6)
  - [ ] Create `AcceptInvitationComponent` at `/accept-invitation`
  - [ ] On load: validate code via API
  - [ ] Show error state for invalid/expired/used codes
  - [ ] Show password form for valid codes (password + confirm)
  - [ ] On submit: call accept API, redirect to login on success
  - [ ] Handle loading and error states

- [ ] Task 7: Remove Public Registration (AC: TD.6.1, TD.6.7)
  - [ ] Remove "Don't have an account? Create one" from login page
  - [ ] Remove or disable registration route/component
  - [ ] Remove or disable public registration API endpoint
  - [ ] Add redirect from `/register` to `/login` (or show message)

- [ ] Task 8: Dead Code Cleanup (AC: TD.6.7)
  - [ ] Remove unused registration components
  - [ ] Remove unused registration services/stores
  - [ ] Remove unused backend registration handlers (keep what's reused by invitation flow)
  - [ ] Remove associated tests for deleted code
  - [ ] Verify no orphaned imports

- [ ] Task 9: Update E2E Tests (AC: TD.6.1, TD.6.6)
  - [ ] Update auth E2E tests to remove registration tests
  - [ ] Add E2E test for accept invitation flow (using test invitation)
  - [ ] Verify login page no longer shows registration link

- [ ] Task 10: Manual Testing and Verification
  - [ ] Create invitation via Postman (login as owner, call API)
  - [ ] Verify invitation email arrives in MailHog
  - [ ] Verify accept invitation flow works
  - [ ] Verify cannot register without invitation
  - [ ] Verify expired invitations are rejected
  - [ ] Verify used invitations are rejected

## Dev Notes

### CRITICAL: Database Reset Required

**Before starting implementation:**
1. Truncate all existing dev data (it's all test data, nothing real)
2. Seed first owner account in migration
3. This eliminates need for bootstrap logic

### Invitation Creation Approach

**Use Postman instead of shell script:**
1. Owner logs in via Postman → gets JWT
2. Calls `POST /api/v1/invitations` with Bearer token
3. Endpoint protected with `[Authorize(Roles = "Owner")]`

No script maintenance, no API key management, standard JWT auth.

### CRITICAL: Files to Modify/Remove

**Frontend Files to REMOVE:**
```
frontend/src/app/features/auth/register/
├── register.component.ts       # DELETE entire component
├── register.component.html     # DELETE
└── register.component.scss     # DELETE
```

**Frontend Files to MODIFY:**

| File | Line | Change |
|------|------|--------|
| `frontend/src/app/features/auth/login/login.component.html` | 54 | REMOVE `<p>Don't have an account? <a routerLink="/register">Create one</a></p>` |
| `frontend/src/app/app.routes.ts` | 7-14 | REMOVE the `/register` route block, OR change to redirect to `/login` |
| `frontend/src/app/core/services/auth.service.ts` | 65-67 | REMOVE `register()` method (dead code after removal) |

**Backend Files to MODIFY:**

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Api/Controllers/AuthController.cs` | REMOVE or comment out `[HttpPost("register")]` endpoint |
| `backend/src/PropertyManager.Application/Auth/Register.cs` | **KEEP** - Reuse logic in AcceptInvitationCommand |

### Architecture Patterns (Follow Existing Code)

**Backend Clean Architecture:**
```
Domain/
├── Entities/
│   └── Invitation.cs                    # NEW - Similar to Account.cs pattern
│
Application/
├── Common/Interfaces/
│   └── IEmailService.cs                 # MODIFY - Add SendInvitationEmailAsync (line 25)
├── Invitations/                         # NEW folder
│   ├── CreateInvitationCommand.cs       # Pattern: Follow ForgotPassword.cs structure
│   ├── ValidateInvitationQuery.cs       # Pattern: Follow GetPropertyById.cs structure
│   └── AcceptInvitationCommand.cs       # Pattern: Reuse Register.cs logic
│
Infrastructure/
├── Email/
│   └── SmtpEmailService.cs              # MODIFY - Add SendInvitationEmailAsync (follow line 119-176 pattern)
├── Persistence/
│   └── Configurations/
│       └── InvitationConfiguration.cs   # NEW - Follow AccountConfiguration.cs pattern
│
Api/
└── Controllers/
    └── InvitationsController.cs         # NEW - Follow AuthController.cs patterns
```

**Frontend Structure:**
```
src/app/
├── features/auth/
│   ├── accept-invitation/              # NEW - Pattern: Follow reset-password/ structure
│   │   ├── accept-invitation.component.ts
│   │   ├── accept-invitation.component.html
│   │   └── accept-invitation.component.scss
│   └── login/
│       └── login.component.html        # MODIFY - Remove registration link
├── core/services/
│   └── auth.service.ts                 # MODIFY - Add invitation methods, remove register()
└── app.routes.ts                       # MODIFY - Add /accept-invitation, remove /register
```

### Code Patterns to Follow

**1. Email Service Pattern** (from `SmtpEmailService.cs:119-176`):
```csharp
// Follow this exact pattern for SendInvitationEmailAsync
public async Task SendInvitationEmailAsync(
    string email,
    string code,
    CancellationToken cancellationToken = default)
{
    var inviteUrl = $"{_settings.BaseUrl}/accept-invitation?code={Uri.EscapeDataString(code)}";
    var subject = "You're invited to Property Manager";
    var htmlBody = GenerateInvitationEmailHtml(inviteUrl);
    var textBody = GenerateInvitationEmailText(inviteUrl);
    await SendEmailAsync(email, subject, htmlBody, textBody, cancellationToken);
    _logger.LogInformation("Invitation email sent to {Email}", email);
}
```

**2. Command/Handler Pattern** (from `ForgotPassword.cs`):
```csharp
public record CreateInvitationCommand(string Email) : IRequest<CreateInvitationResult>;
public record CreateInvitationResult(Guid InvitationId, string Code);

public class CreateInvitationCommandValidator : AbstractValidator<CreateInvitationCommand>
{
    public CreateInvitationCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");
    }
}
```

**3. Entity Pattern** (from existing Domain entities):
```csharp
public class Invitation
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;  // Hashed
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
```

**4. Angular Component Pattern** (from `reset-password.component.ts`):
- Use standalone component with inject()
- Use signals for state: loading(), error(), success()
- Use reactive forms with FormBuilder
- Follow same Material imports pattern

### Security Requirements

**Invitation Code Generation:**
```csharp
// Use cryptographically secure random string
using System.Security.Cryptography;

var bytes = new byte[32];
RandomNumberGenerator.Fill(bytes);
var code = Convert.ToBase64String(bytes)
    .Replace("+", "-")
    .Replace("/", "_")
    .TrimEnd('=');

// Store HASHED version in database (like password reset tokens)
var hashedCode = ComputeHash(code);
```

**Rate Limiting:**
- Consider adding rate limiting on `POST /api/v1/invitations` endpoint
- Log all invitation creation attempts for audit trail

### Business Rules

| Rule | Implementation |
|------|---------------|
| Expiration | `ExpiresAt = DateTime.UtcNow.AddHours(24)` |
| Single-use | Set `UsedAt = DateTime.UtcNow` when used, reject if `UsedAt != null` |
| Duplicate email | Check `_identityService.EmailExistsAsync()` before creating |
| Pending invitation | Check for existing valid invitation (not expired, not used) |

### Email Template Content

**Subject:** You're invited to Property Manager

**Required Elements:**
- Professional header matching existing email branding (green #66BB6A)
- Clear invitation message
- Call-to-action button: "Accept Invitation"
- Expiration notice: "This invitation expires in 24 hours"
- Fallback URL for button issues
- Support contact if needed

### Testing Strategy

**Unit Tests:**
- CreateInvitationCommandHandler - valid email, duplicate email, pending invitation
- ValidateInvitationQueryHandler - valid code, expired code, used code, invalid code
- AcceptInvitationCommandHandler - successful accept, invalid code, password validation

**Integration Tests:**
- Full invitation flow: create → validate → accept
- Email service integration with MailHog

**E2E Tests:**
- Accept invitation flow with valid code
- Error states for invalid/expired/used codes
- Verify registration link removed from login

### Project Structure Notes

- All new backend code follows Clean Architecture layer separation
- Frontend follows existing feature module patterns
- Email templates match existing branding in SmtpEmailService.cs
- API versioning: `/api/v1/invitations/*`

### References

- [Source: backend/src/PropertyManager.Application/Auth/Register.cs] - User creation logic to reuse
- [Source: backend/src/PropertyManager.Application/Auth/ForgotPassword.cs] - Token-based flow pattern
- [Source: backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs:74-176] - Email template patterns
- [Source: frontend/src/app/features/auth/reset-password/] - Password form UI pattern
- [Source: frontend/src/app/features/auth/login/login.component.html:54] - Registration link to remove
- [Source: frontend/src/app/app.routes.ts:7-14] - Route to remove/modify
- [Source: frontend/src/app/core/services/auth.service.ts:65-67] - Register method to remove

### Previous Story Intelligence

**From TD-5 (Income Form Reset Bug):**
- Use `FormGroupDirective.resetForm()` instead of `form.reset()` to clear submitted state
- Apply this pattern to accept-invitation form

**From E2E Test Stories (TD-1, TD-2, TD-3):**
- E2E tests use Playwright with custom test fixtures
- Test data setup patterns established in `e2e/fixtures/`
- For invitation E2E test, may need to create test invitation via API/database setup

### Git Intelligence (Recent Patterns)

Recent commits show:
- E2E test patterns in `e2e/` directory
- Form handling improvements with FormGroupDirective
- Clean separation of concerns in component structure

## Dev Agent Record

### Context Reference

Story prepared with comprehensive codebase analysis including:
- Exact file paths and line numbers for modifications
- Code patterns extracted from existing implementations
- Security requirements and business rules
- Testing strategy aligned with project patterns

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

N/A

### Completion Notes List

(To be filled during implementation)

### File List

**Files to CREATE:**
- `backend/src/PropertyManager.Domain/Entities/Invitation.cs`
- `backend/src/PropertyManager.Application/Invitations/CreateInvitationCommand.cs`
- `backend/src/PropertyManager.Application/Invitations/ValidateInvitationQuery.cs`
- `backend/src/PropertyManager.Application/Invitations/AcceptInvitationCommand.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs`
- `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs`
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts`
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.html`
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.scss`

**Files to MODIFY:**
- `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs`
- `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs`
- `backend/src/PropertyManager.Api/Controllers/AuthController.cs`
- `frontend/src/app/features/auth/login/login.component.html`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/core/services/auth.service.ts`

**Files to DELETE:**
- `frontend/src/app/features/auth/register/register.component.ts`
- `frontend/src/app/features/auth/register/register.component.html`
- `frontend/src/app/features/auth/register/register.component.scss`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial story draft created from requirements discussion | Mary (Business Analyst Agent) |
| 2025-12-26 | Enhanced with comprehensive implementation context, exact file paths, code patterns, and security requirements | Bob (Scrum Master Agent) |
| 2025-12-26 | Simplified: Removed shell script in favor of Postman for invitations; Added DB truncation and owner seed task; Renumbered ACs and tasks | Bob (Scrum Master Agent) |
