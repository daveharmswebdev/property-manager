# Story 19.6: Invitation Management UI

Status: done

## Story

As an account owner,
I want a UI to invite new users to my account and see pending invitations,
so that I can manage team access without using API calls.

## Acceptance Criteria

1. **Given** I am logged in as an Owner
   **When** I navigate to Settings
   **Then** I see a "User Management" page with an "Invite User" button and a list of pending invitations

2. **Given** I click "Invite User"
   **When** I enter an email address and select a role (Owner or Contributor)
   **And** I click Send
   **Then** the invitation is created and I see a success snackbar "Invitation sent to {email}"
   **And** the invitation appears in the pending invitations list

3. **Given** I am on the User Management page
   **When** I look at the invitations section
   **Then** I see a list of pending invitations with: Email, Role, Sent Date, Status (Pending/Expired/Accepted)

4. **Given** an invitation has expired
   **When** I view the invitations list
   **Then** the expired invitation shows status "Expired" and I can resend it

5. **Given** I enter an email that's already registered on my account
   **When** I try to send the invitation
   **Then** I see an error message "This email is already registered"

6. **Given** I am logged in as a Contributor
   **When** I try to navigate to Settings
   **Then** I am redirected to the Dashboard (ownerGuard already blocks access)

## Tasks / Subtasks

- [x] Task 1: Create `GetAccountInvitations` backend query and endpoint (AC: #3, #4)
  - [x] 1.1 Create `backend/src/PropertyManager.Application/Invitations/GetAccountInvitations.cs` with:
    - `GetAccountInvitationsQuery` record implementing `IRequest<GetAccountInvitationsResponse>`
    - `GetAccountInvitationsResponse` record with `IReadOnlyList<InvitationDto> Items` and `int TotalCount`
    - `InvitationDto` record with `Guid Id, string Email, string Role, DateTime CreatedAt, DateTime ExpiresAt, DateTime? UsedAt, string Status`
    - `GetAccountInvitationsQueryHandler` that queries `_dbContext.Invitations.Where(i => i.AccountId == _currentUser.AccountId)` and maps to DTOs
    - Status logic: if `UsedAt != null` => "Accepted", if `ExpiresAt < DateTime.UtcNow` => "Expired", else "Pending"
  - [x] 1.2 Add `GET` endpoint to `InvitationsController` at route root (`[HttpGet]`) with `[Authorize(Policy = "CanManageUsers")]`
  - [x] 1.3 Define `GetAccountInvitationsResponse` as controller response DTO
  - [x] 1.4 Unit tests for `GetAccountInvitationsQueryHandler`

- [x] Task 2: Create `ResendInvitation` backend command and endpoint (AC: #4)
  - [x] 2.1 Create `backend/src/PropertyManager.Application/Invitations/ResendInvitation.cs` with:
    - `ResendInvitationCommand(Guid InvitationId)` record implementing `IRequest<ResendInvitationResult>`
    - `ResendInvitationResult(Guid InvitationId, string Message)` record
    - `ResendInvitationCommandHandler` that:
      - Loads the invitation by Id, verifies it belongs to the current user's account
      - Verifies it is expired AND not used
      - Creates a new invitation with same email/role/accountId (or updates expiry + new code)
      - Sends the invitation email
  - [x] 2.2 Create `backend/src/PropertyManager.Application/Invitations/ResendInvitationValidator.cs` with FluentValidation rules
  - [x] 2.3 Add `POST /{id:guid}/resend` endpoint to `InvitationsController` with `[Authorize(Policy = "CanManageUsers")]`
  - [x] 2.4 Unit tests for `ResendInvitationCommandHandler`

- [x] Task 3: Integration tests for new backend endpoints (AC: #3, #4, #5)
  - [x] 3.1 Add tests to `InvitationsControllerTests.cs`:
    - `GetAccountInvitations_AsOwner_ReturnsInvitationList`
    - `GetAccountInvitations_AsContributor_Returns403`
    - `ResendInvitation_ExpiredInvitation_Returns201AndSendsEmail`
    - `ResendInvitation_ActiveInvitation_Returns400`
    - `ResendInvitation_AsContributor_Returns403`

- [x] Task 4: Update frontend API client with new types (AC: #2, #3, #4)
  - [x] 4.1 Add `InvitationDto`, `GetAccountInvitationsResponse`, `AccountUserDto`, `GetAccountUsersResponse` interfaces to `api.service.ts` (manual, since NSwag requires .NET 9)
  - [x] 4.2 Add `invitations_GetAccountInvitations()`, `invitations_ResendInvitation(id)` methods to the `ApiClient` class
  - [x] 4.3 Add `accountUsers_GetAccountUsers()` method to `ApiClient` class (from Story 19.4 API, needed for user list)

- [x] Task 5: Create `UserManagementStore` (AC: #2, #3, #4)
  - [x] 5.1 Create `frontend/src/app/features/settings/stores/user-management.store.ts`
  - [x] 5.2 State: `{ invitations: InvitationDto[], users: AccountUserDto[], loading: boolean, error: string | null }`
  - [x] 5.3 Methods: `loadInvitations()`, `sendInvitation(email, role)`, `resendInvitation(id)`, `loadUsers()` using `rxMethod` pattern
  - [x] 5.4 Unit tests: `user-management.store.spec.ts`

- [x] Task 6: Create `InviteUserDialogComponent` (AC: #2, #5)
  - [x] 6.1 Create `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.ts`
  - [x] 6.2 Reactive form with:
    - Email field (required, email validator)
    - Role select (required, options: "Owner", "Contributor")
  - [x] 6.3 On submit: call `UserManagementStore.sendInvitation()`, close dialog on success
  - [x] 6.4 Display backend validation errors (e.g., "already registered") inline
  - [x] 6.5 Unit tests: `invite-user-dialog.component.spec.ts`

- [x] Task 7: Create `UserManagementComponent` — settings page (AC: #1, #3, #4)
  - [x] 7.1 Replace placeholder `SettingsComponent` with `UserManagementComponent` at `frontend/src/app/features/settings/settings.component.ts`
  - [x] 7.2 Layout: page title "User Management", "Invite User" button, two sections: "Pending Invitations" and "Account Users"
  - [x] 7.3 Invitations section: list/table with Email, Role, Sent Date, Status columns
  - [x] 7.4 Status column: chip/badge showing "Pending" (primary), "Expired" (warn), "Accepted" (accent)
  - [x] 7.5 "Resend" button on expired invitations
  - [x] 7.6 "Invite User" button opens `InviteUserDialogComponent`
  - [x] 7.7 Account Users section: list with Name/Email, Role, Joined Date (read-only for this story — full management in Story 19.7)
  - [x] 7.8 Load data on init via `UserManagementStore`
  - [x] 7.9 Unit tests: `settings.component.spec.ts`

- [x] Task 8: Wire up routing and verify guards (AC: #6)
  - [x] 8.1 The `/settings` route already has `ownerGuard` (from Story 19.5) — verify Contributor redirect works
  - [x] 8.2 No route changes needed — the SettingsComponent is already loaded at `/settings`

- [x] Task 9: E2E test for invitation flow (AC: #1, #2, #3)
  - [x] 9.1 Create `frontend/e2e/tests/settings/user-management.spec.ts`
  - [x] 9.2 Test: Owner navigates to Settings, sees User Management page
  - [x] 9.3 Test: Owner clicks "Invite User", fills email and role, submits, sees success snackbar
  - [x] 9.4 Test: Invitation appears in the pending invitations list
  - [x] 9.5 Use `page.route()` to intercept API responses if needed for test isolation

- [x] Task 10: Verify all existing tests pass (AC: all)
  - [x] 10.1 Run `dotnet test` — all backend tests pass (1717 tests)
  - [x] 10.2 Run `npm test` — all frontend unit tests pass (2671 tests)
  - [x] 10.3 Run E2E tests — 2 new tests pass, no regressions

## Dev Notes

### Architecture: Full-Stack Story

This is a full-stack story requiring backend (new query + command + endpoints), frontend (store + components + dialog), and E2E testing. The backend adds two new capabilities to the existing `InvitationsController`: listing account invitations and resending expired ones.

### Backend: New Query — GetAccountInvitations

The `Invitation` entity is NOT an `ITenantEntity` (no global query filter by AccountId). The `AccountId` field was added in Story 19.1 as a nullable Guid. The query must explicitly filter by `AccountId`:

```csharp
// GetAccountInvitationsQueryHandler
var invitations = await _dbContext.Invitations
    .Where(i => i.AccountId == _currentUser.AccountId)
    .OrderByDescending(i => i.CreatedAt)
    .ToListAsync(cancellationToken);
```

**Status calculation** — derive from entity properties, do NOT store a Status column:
- `UsedAt != null` => "Accepted"
- `ExpiresAt < DateTime.UtcNow` => "Expired"  
- Otherwise => "Pending"

**InvitationDto** — define in `GetAccountInvitations.cs` co-located with the query (existing pattern):
```csharp
public record InvitationDto(
    Guid Id,
    string Email,
    string Role,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    DateTime? UsedAt,
    string Status);
```

### Backend: New Command — ResendInvitation

Resending creates a **new** invitation record (new code hash, new expiry) for the same email/role/account. The old invitation remains as historical record. This is simpler and more auditable than updating in-place.

```csharp
// ResendInvitationCommandHandler.Handle:
// 1. Load original invitation by Id
// 2. Verify AccountId matches current user's account
// 3. Verify it's expired AND not used (can only resend expired, unused invitations)
// 4. Reuse CreateInvitationCommand logic: generate new code, hash, create invitation, send email
// OR: Create a new Invitation entity directly, reusing the email service
```

**Alternative simpler approach:** The handler can directly reuse the `IEmailService` to send a new invitation email and create a new `Invitation` record. This avoids coupling to `CreateInvitationCommand` internals.

### Backend: InvitationsController Updates

Add two new endpoints to the existing `InvitationsController`:

```csharp
// GET /api/v1/invitations — List account invitations (Owner-only)
[HttpGet]
[Authorize(Policy = "CanManageUsers")]
[ProducesResponseType(typeof(GetAccountInvitationsResponse), StatusCodes.Status200OK)]

// POST /api/v1/invitations/{id:guid}/resend — Resend expired invitation (Owner-only)
[HttpPost("{id:guid}/resend")]
[Authorize(Policy = "CanManageUsers")]
[ProducesResponseType(typeof(ResendInvitationResponse), StatusCodes.Status201Created)]
```

The existing `POST /api/v1/invitations` (create) and `GET /api/v1/invitations/{code}/validate` (validate) remain unchanged. The `CanManageUsers` policy is already registered in `Program.cs` (from Story 19.3).

**Important:** The existing `InvitationsController` does NOT have `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` at the class level — it has `[Authorize(Policy = "CanManageUsers")]` on individual endpoints and `[AllowAnonymous]` on validate/accept. Follow this existing pattern: put `[Authorize(Policy = "CanManageUsers")]` on the new GET and POST resend endpoints individually, NOT at the class level.

### Frontend: Manual API Client Updates

NSwag client generation requires .NET 9 (only .NET 10 installed). Manually add types to `api.service.ts` following the pattern established in Story 19.1 (which also manually added types).

**New interfaces to add:**
```typescript
export interface InvitationDto {
  id?: string;
  email?: string;
  role?: string;
  createdAt?: Date;
  expiresAt?: Date;
  usedAt?: Date | undefined;
  status?: string;
}

export interface GetAccountInvitationsResponse {
  items?: InvitationDto[];
  totalCount?: number;
}

export interface AccountUserDto {
  userId?: string;
  email?: string;
  displayName?: string | undefined;
  role?: string;
  createdAt?: Date;
}

export interface GetAccountUsersResponse {
  items?: AccountUserDto[];
  totalCount?: number;
}
```

**New methods to add to `ApiClient` class:**
- `invitations_GetAccountInvitations(): Observable<GetAccountInvitationsResponse>` — `GET /api/v1/invitations`
- `invitations_ResendInvitation(id: string): Observable<CreateInvitationResponse>` — `POST /api/v1/invitations/{id}/resend`
- `accountUsers_GetAccountUsers(): Observable<GetAccountUsersResponse>` — `GET /api/v1/account/users`

Follow the existing NSwag-generated method patterns in the file (URL construction, headers, response processing).

### Frontend: UserManagementStore

Follow the existing signalStore pattern used throughout the project:

```typescript
// user-management.store.ts
import { signalStore, withState, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { patchState } from '@ngrx/signals';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { inject } from '@angular/core';
import { ApiClient } from '../../../core/api/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

type UserManagementState = {
  invitations: InvitationDto[];
  users: AccountUserDto[];
  loading: boolean;
  error: string | null;
};

const initialState: UserManagementState = {
  invitations: [],
  users: [],
  loading: false,
  error: null,
};

export const UserManagementStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiClient), snackBar = inject(MatSnackBar)) => ({
    loadInvitations: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => api.invitations_GetAccountInvitations().pipe(
        tapResponse({
          next: (res) => patchState(store, { invitations: res.items ?? [], loading: false }),
          error: () => patchState(store, { loading: false, error: 'Failed to load invitations' }),
        })
      ))
    )),
    // ... similar for loadUsers, sendInvitation, resendInvitation
  }))
);
```

### Frontend: InviteUserDialogComponent

Follow the existing dialog pattern from `ConfirmDialogComponent` and `InlineVendorDialogComponent`:

```typescript
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
```

**Dialog pattern (verified from Angular Material docs):**
- Open with `this.dialog.open(InviteUserDialogComponent, { width: '400px' })`
- No data injection needed (form is self-contained)
- Close with result: `this.dialogRef.close(true)` on success
- Use `inject(MatDialogRef<InviteUserDialogComponent>)` (inject function, not constructor injection — project pattern)

**Form fields:**
- Email: `Validators.required`, `Validators.email`
- Role: `Validators.required`, default to "Owner", options: ["Owner", "Contributor"]

**Error handling:** The backend `CreateInvitation` endpoint already validates:
- Empty/invalid email → 400 validation error
- Email already has pending invitation → 400 "already has a pending invitation"
- Email already registered → 400 "already registered"

Display these errors from the API response in the dialog (use `MatSnackBar` for generic errors, inline mat-error for field-specific).

### Frontend: SettingsComponent Replacement

Replace the current placeholder `SettingsComponent` with a full user management page. This component becomes the container for both invitation management (this story) and user management (Story 19.7 will extend it).

**Layout structure:**
```
User Management
[Invite User] button

--- Pending Invitations ---
| Email | Role | Sent | Status | Actions |
| ...   | ...  | ...  | Pending | - |
| ...   | ...  | ...  | Expired | [Resend] |

--- Account Users ---
| Name/Email | Role | Joined |
| ...        | ...  | ...    |
```

Use Angular Material components:
- `mat-card` for sections
- `mat-table` or simple list with `mat-list` for data display
- `mat-chip` for status badges
- `mat-button` for actions
- `mat-icon` for visual cues

### Frontend: Settings Route

The `/settings` route already exists with `ownerGuard` (from Story 19.5). No routing changes needed — just replace the placeholder component content.

### Previous Story Intelligence

**From Story 19.5:**
- `PermissionService` with `isOwner`/`isContributor` computed signals — use for conditional rendering
- `ownerGuard` already on `/settings` route — Contributors are already blocked
- Navigation already shows "Settings" only for Owners
- E2E tests for RBAC were deferred — this story should include E2E for the invitation flow
- `AuthService.currentUser()` provides role information

**From Story 19.4:**
- `AccountUsersController` at `/api/v1/account/users` with `GET`, `PUT /{id}/role`, `DELETE /{id}` endpoints
- `GetAccountUsersResponse` with `AccountUserDto` items — needed for user list section
- `CanManageUsers` policy already registered and working
- NSwag client was NOT regenerated — manual API types needed

**From Story 19.1:**
- `CreateInvitation` accepts `email` and `role` parameters
- Invitation entity has `AccountId`, `Role`, `InvitedByUserId`, `ExpiresAt`, `UsedAt`
- NSwag types were manually added — follow the same pattern
- `IEmailService` sends invitation emails with code
- Invitation code is hashed (`CodeHash`) — raw code is never stored, only sent via email

**Common issues from previous stories:**
- NSwag requires .NET 9 — manually add types following existing pattern
- `FluentValidation.ValidationException` vs `PropertyManager.Domain.Exceptions.ValidationException` — use fully qualified names in tests
- MockQueryable.Moq v10: use `list.BuildMockDbSet()` directly (no `.AsQueryable()`)

### Testing Pyramid

- **Unit tests (xUnit):** `GetAccountInvitationsHandlerTests`, `ResendInvitationHandlerTests`, `ResendInvitationValidatorTests`
- **Integration tests (WebApplicationFactory):** GET invitations, POST resend (happy + error paths + auth enforcement)
- **Unit tests (Vitest):** `UserManagementStore`, `InviteUserDialogComponent`, `SettingsComponent` (user management page)
- **E2E tests (Playwright):** Navigate to Settings > see User Management page, open invite dialog, submit, verify snackbar and list update

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.6 requirements and ACs |
| `docs/project/stories/epic-19/19-5-frontend-auth-state-permission-service.md` | PermissionService, ownerGuard, route configuration |
| `docs/project/stories/epic-19/19-4-account-user-management-api.md` | AccountUsers API endpoints, AccountUserDto |
| `docs/project/stories/epic-19/19-1-refactor-invitation-join-account.md` | Invitation entity, CreateInvitation handler, email service |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Domain/Entities/Invitation.cs` | Invitation entity with AccountId, Role, ExpiresAt, UsedAt |
| `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` | Existing create invitation handler (reference for resend logic) |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Controller to extend with GET and POST resend |
| `backend/src/PropertyManager.Api/Controllers/AccountUsersController.cs` | AccountUsers controller pattern reference |
| `backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs` | `DbSet<Invitation> Invitations` available |
| `frontend/src/app/core/api/api.service.ts` | NSwag-generated client — manual additions needed |
| `frontend/src/app/features/settings/settings.component.ts` | Placeholder to replace |
| `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts` | Dialog pattern reference |
| `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts` | Dialog with form pattern reference |
| `frontend/src/app/app.routes.ts` | Settings route already has ownerGuard |
| Angular Material Dialog docs | `MatDialog.open()`, `MAT_DIALOG_DATA`, `MatDialogRef` — inject pattern |
| @ngrx/signals docs | `signalStore`, `withState`, `withMethods`, `rxMethod`, `patchState` |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- FluentValidation.ValidationException vs Domain.Exceptions.ValidationException ambiguity: used fully qualified names
- Vitest `this` not available in rxMethod closures: used closure variable (reloadInvitations helper)
- E2E getByText('Pending') strict mode violation: switched to getByText('Pending', { exact: true }) and getByRole locators
- E2E 429 rate limiting with 2 workers: tests pass with --workers=1 (matches CI)

### Completion Notes List
- Task 1: GetAccountInvitations query with status derivation logic (7 unit tests)
- Task 2: ResendInvitation command creates new invitation record for audit trail (5 handler + 2 validator unit tests)
- Task 3: 5 integration tests covering auth enforcement, happy paths, error paths
- Task 4: Manual API client additions following NSwag pattern (3 methods + 4 interfaces)
- Task 5: UserManagementStore with loadInvitations, loadUsers, sendInvitation, resendInvitation (12 unit tests)
- Task 6: InviteUserDialogComponent with email/role form (9 unit tests)
- Task 7: SettingsComponent replaced placeholder with full User Management page (8 unit tests)
- Task 8: Route already configured with ownerGuard - no changes needed
- Task 9: 2 E2E tests using page.route() for isolation
- Task 10: All 1717 backend + 2671 frontend + 2 E2E tests pass

### File List
**New files:**
- `backend/src/PropertyManager.Application/Invitations/GetAccountInvitations.cs`
- `backend/src/PropertyManager.Application/Invitations/ResendInvitation.cs`
- `backend/src/PropertyManager.Application/Invitations/ResendInvitationValidator.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/GetAccountInvitationsTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/ResendInvitationTests.cs`
- `frontend/src/app/features/settings/stores/user-management.store.ts`
- `frontend/src/app/features/settings/stores/user-management.store.spec.ts`
- `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.ts`
- `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.spec.ts`
- `frontend/e2e/tests/settings/user-management.spec.ts`

**Modified files:**
- `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` (added GET and POST resend endpoints)
- `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` (added 5 integration tests)
- `frontend/src/app/core/api/api.service.ts` (added 3 methods + 4 interfaces)
- `frontend/src/app/features/settings/settings.component.ts` (replaced placeholder with User Management page)
- `frontend/src/app/features/settings/settings.component.spec.ts` (replaced placeholder tests)
- `docs/project/sprint-status.yaml` (status: in-progress -> review)
- `docs/project/stories/epic-19/19-6-invitation-management-ui.md` (status: review, all tasks complete)
