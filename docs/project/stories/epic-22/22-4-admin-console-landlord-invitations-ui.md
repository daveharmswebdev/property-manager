# Story 22.4: Admin Console UI — List, Create, Resend Landlord Invitations

Status: done

## Story

As the platform administrator,
I want a small admin console in the app where I can create landlord invitations, see existing ones with their status, and resend expired invitations,
so that I can manage beta onboarding without touching Postman or curl.

This is the **frontend UI** for the landlord-provisioning API delivered in Stories 22.1 (PlatformAdmin claim + `CanInviteLandlords` policy), 22.2 (`POST /api/v1/admin/landlord-invitations`), and 22.3 (accept-side verification). Story 22.1 already shipped the reactive `PermissionService.isPlatformAdmin` signal that this story consumes for nav visibility and the route guard.

> **IMPORTANT — scope is larger than "frontend-only".** Grounding against the current codebase (this turn) revealed **two backend gaps** that this story MUST close before the UI can work. The epic doc framed 22.4 as a UI story, but:
> 1. **There is no GET endpoint that returns landlord invitations.** AC-22.4.3 requires listing invitations where `AccountId = null`. The only existing list query, `GetAccountInvitationsQuery` (`GetAccountInvitations.cs:52-53`), filters `i.AccountId == _currentUser.AccountId` — it can NEVER return null-`AccountId` rows. A new admin-scoped `GET /api/v1/admin/landlord-invitations` endpoint + query is required.
> 2. **The existing resend handler cannot resend a landlord invitation.** `ResendInvitationCommandHandler` (`ResendInvitation.cs:50`) filters `i.AccountId == _currentUser.AccountId`, then re-creates the new invitation with `AccountId = _currentUser.AccountId` (line 87) and sends the **co-owner** email (`SendInvitationEmailAsync`, line 116). For a landlord invitation `AccountId == null`, so the lookup returns null → `NotFoundException`; even if found, it would corrupt the invitation by stamping the admin's `AccountId` and send the wrong email template. **This is exactly the authorization/handler decision the epic flagged at line ~220 — see the "Resend Authorization Decision" section below, which resolves it explicitly.**
>
> Because this story adds/changes backend endpoints, it requires **WebApplicationFactory integration tests** (not skippable as "frontend-only").

## Acceptance Criteria

1. **AC-22.4.1 — "Admin" nav entry visible only to PlatformAdmins.**
   **Given** a user whose JWT carries `platformAdmin=true` (so `PermissionService.isPlatformAdmin()` / `AuthService.currentUser()?.isPlatformAdmin` is `true`),
   **When** they are logged in and viewing the app shell,
   **Then** the side navigation shows an "Admin" entry (icon `admin_panel_settings`, route `/admin`), visually separated from the per-account nav items by a `mat-divider`. **And** a user without the claim (regular Owner, Contributor, Tenant) does **not** see the "Admin" entry at all.

2. **AC-22.4.2 — Admin landing page with a Landlord Invitations section.**
   **Given** a PlatformAdmin clicks the "Admin" nav entry,
   **When** the `/admin` route loads,
   **Then** they see an admin console landing page with a page title (e.g. "Admin Console") and a card/section for "Landlord Invitations" (mirroring the `mat-card` section pattern used on the Settings page).

3. **AC-22.4.3 — List all landlord invitations with status.**
   **Given** a PlatformAdmin on the Landlord Invitations view,
   **When** the view loads,
   **Then** it calls `GET /api/v1/admin/landlord-invitations` and renders a table of all landlord invitations (those with `AccountId = null`) ordered by created-at descending, with columns: **Email**, **Created** (`mediumDate`), **Expires** (`mediumDate`), **Status** (`Pending` / `Accepted` / `Expired` rendered as a `mat-chip` with the same `status-*` classes as Settings), and **Invited By** (the inviting admin's display name or email). When there are zero landlord invitations, an empty-state message ("No landlord invitations yet.") is shown instead of an empty table.

4. **AC-22.4.4 — Create-invitation dialog (email only).**
   **Given** the Landlord Invitations view,
   **When** the PlatformAdmin clicks "Invite New Landlord",
   **Then** a Material dialog opens asking only for an email address (no role/property/account fields), and submitting a valid email calls `POST /api/v1/admin/landlord-invitations` with body `{ email }`.

5. **AC-22.4.5 — Successful create refreshes the list and confirms via snackbar.**
   **Given** a valid email submitted in the create dialog,
   **When** the API returns `201 Created`,
   **Then** the dialog closes, the invitations list reloads (the new row appears with status "Pending"), and a `MatSnackBar` success message confirms the invitation was sent (e.g. `Landlord invitation sent to <email>`).

6. **AC-22.4.6 — Resend an expired landlord invitation.**
   **Given** a landlord invitation whose status is "Expired" in the list,
   **When** the PlatformAdmin clicks "Resend" on that row,
   **Then** the resend call succeeds (per the Resend Authorization Decision below), a new landlord invitation with a fresh 24-hour expiry is created (and a landlord-flavored email is sent), the list refreshes to show the new Pending row, and a success snackbar confirms the resend. The "Resend" action is shown **only** for rows whose status is "Expired" (matching the Settings page rule).

7. **AC-22.4.7 — Route guard blocks non-admins from deep-linking `/admin`.**
   **Given** a non-PlatformAdmin user (Owner without the claim, Contributor, or Tenant),
   **When** they navigate directly to `/admin` (deep link or typed URL),
   **Then** a functional `platformAdminGuard` denies activation and redirects them to their normal landing page (`/dashboard` for Owner/Contributor; `/tenant` for Tenant), and the admin view never renders. An authenticated PlatformAdmin is allowed through.

8. **AC-22.4.8 — Form validation matches existing patterns.**
   **Given** the create-invitation dialog,
   **When** the email field is empty or malformed,
   **Then** a `mat-error` is shown ("Email is required" / "Invalid email format") and submitting an invalid form does not call the API (the form is marked touched and the submit is a no-op) — mirroring the `InviteUserDialogComponent` validation pattern (`Validators.required`, `Validators.email`).

9. **AC-22.4.9 — Admin console follows Upkeep visual language (desktop).**
   **Given** the admin console rendered on desktop,
   **When** viewed,
   **Then** it uses the established Upkeep components and layout: Angular Material `mat-card` sections, the same plain `<table class="data-table">` + `mat-chip` status-badge pattern used on the Settings page (NOT raw `mat-table` — Settings uses a styled HTML table; mirror it for consistency), `mat-raised-button color="primary"` for the primary action, `MatSnackBar` for feedback, and "obvious not clever" copy.

## Resend Authorization Decision (epic note ~line 220 — RESOLVED)

The epic deferred this decision: *"the existing `[Authorize(Policy = "CanManageUsers")]` on the resend route must also accept PlatformAdmin for landlord invitations specifically — implement by checking the invitation type in the handler and allowing either policy, OR by adding a parallel admin route."*

**Decision: add a parallel admin resend route — `POST /api/v1/admin/landlord-invitations/{id}/resend` — gated by `[Authorize(Policy = "CanInviteLandlords")]`, backed by a new `ResendLandlordInvitationCommand` handler. Do NOT overload the existing `/api/v1/invitations/{id}/resend` route or the existing `ResendInvitationCommandHandler`.**

Rationale (verified against current code, this turn):

- **The existing handler is structurally account-scoped and would corrupt a landlord invitation.** `ResendInvitation.cs:50` looks the invitation up with `i.AccountId == _currentUser.AccountId`. A landlord invitation has `AccountId == null`, so for a PlatformAdmin (who is Owner of their *own* account) this returns `null` → `NotFoundException`. Worse, the new row it builds stamps `AccountId = _currentUser.AccountId` (line 87) and calls `SendInvitationEmailAsync` (the **co-owner** email, line 116) — both wrong for a landlord invitation. Making the existing handler branch on `AccountId == null` would entangle two flows in one handler and re-introduce the kind of conditional sprawl 22.2 deliberately avoided.
- **The parallel route keeps the gate at the controller (NFR-LP2 seam).** Same architecture decision as 22.2: a future public `/signup` flow could reuse the landlord-resend handler without the PlatformAdmin policy. The handler stays permission-agnostic; the gate lives on the admin controller via `[Authorize(Policy = "CanInviteLandlords")]`.
- **It mirrors 22.2 exactly** (`AdminLandlordInvitationsController` already exists with the `CanInviteLandlords` policy). Adding a second action to that controller is the lowest-friction, most consistent option.
- **Consequence — the existing `/api/v1/invitations/{id}/resend` route is unchanged** (still `CanManageUsers`, still account-scoped). No regression risk to the co-owner/tenant resend flow (Story 19.6).

The new `ResendLandlordInvitationCommandHandler` mirrors `ResendInvitationCommandHandler` but: (a) looks the invitation up by `i.Id == request.InvitationId && i.AccountId == null`; (b) re-creates the new row with `AccountId = null`, `Role = "Owner"`, `PropertyId = null`, `InvitedByUserId = _currentUser.UserId`; (c) calls `_emailService.SendLandlordInvitationEmailAsync(...)` (the 22.2 template), not `SendInvitationEmailAsync`; (d) keeps the same guards (cannot resend a `UsedAt != null` invitation; can only resend an expired one).

## Tasks / Subtasks

### Backend — list endpoint (AC: #3)

- [x] **Task 1: Add `GetLandlordInvitations` query + handler** (AC: #3)
  - [x] 1.1 New file `backend/src/PropertyManager.Application/Invitations/GetLandlordInvitations.cs`. Mirror `GetAccountInvitations.cs` but:
    - Query `_dbContext.Invitations.Where(i => i.AccountId == null).OrderByDescending(i => i.CreatedAt)`.
    - Add an `InvitedBy` field to the DTO so AC-22.4.3's "Invited By" column has data. Resolve it from the inviting user: join/lookup the inviting `ApplicationUser` via `IIdentityService` or query the users table for `DisplayName`/`Email` by `InvitedByUserId`. (Verify how 19.7 / `AccountUserDto` resolves a display name — reuse that mechanism; do NOT hand-roll a new Identity query if a helper exists.)
    - Reuse the `DeriveStatus` logic (`Accepted` / `Expired` / `Pending`) verbatim from `GetAccountInvitations.cs:71-76` so the UI status values are identical to Settings. **Note:** the epic AC says "Used" but the existing codebase status string is `"Accepted"` — use `"Accepted"` for consistency with the existing UI/CSS classes; the dialog/list copy may still read naturally.
  - [x] 1.2 DTO shape suggestion: `public record LandlordInvitationDto(Guid Id, string Email, DateTime CreatedAt, DateTime ExpiresAt, DateTime? UsedAt, string Status, string InvitedBy);` and `public record GetLandlordInvitationsResponse(IReadOnlyList<LandlordInvitationDto> Items, int TotalCount);`.
  - [x] 1.3 **CWE-359 / cleartext-storage:** the success log must carry ONLY a count (e.g. `_logger.LogInformation("Retrieved {Count} landlord invitations", dtos.Count);`). Do NOT log emails, `AccountId`, `UserId`, or `InvitationId` lists. (See "Critical: logging" in Dev Notes — Stories 22-1/22-2/22-3 all had logs ripped out post-PR; commit `398dca3` specifically dropped `AccountId` from a 22-3 log after CodeQL `cs/cleartext-storage` flagged it.)

- [x] **Task 2: Add `GET` action to `AdminLandlordInvitationsController`** (AC: #3)
  - [x] 2.1 Add `[HttpGet]` action returning `GetLandlordInvitationsResponse` (200) to the existing `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs`. The class already carries `[Authorize(... Policy = "CanInviteLandlords")]`, so the new action is gated automatically.
  - [x] 2.2 Add `[ProducesResponseType(typeof(GetLandlordInvitationsResponse), StatusCodes.Status200OK)]` + `401`/`403` for NSwag.

### Backend — resend endpoint (AC: #6, per Resend Authorization Decision)

- [x] **Task 3: Add `ResendLandlordInvitation` command + handler** (AC: #6)
  - [x] 3.1 New file `backend/src/PropertyManager.Application/Invitations/ResendLandlordInvitation.cs`. Mirror `ResendInvitation.cs` structure (command record, result record, handler) with the landlord-specific changes enumerated in the "Resend Authorization Decision" section: lookup by `AccountId == null`, re-create with `AccountId = null` / `Role = "Owner"` / `PropertyId = null`, call `SendLandlordInvitationEmailAsync`.
  - [x] 3.2 Keep the existing guards: throw `NotFoundException(nameof(Invitation), id)` when not found (null-`AccountId` lookup miss); throw `FluentValidation.ValidationException` on `UsedAt != null` ("Cannot resend an invitation that has already been used") and on not-yet-expired ("Can only resend expired invitations"). These map to 404/400 via existing middleware + the controller try/catch pattern.
  - [x] 3.3 Lift `GenerateSecureCode` / `ComputeHash` static helpers (same as 22.2 — duplication across handlers is the accepted project convention; do NOT refactor into a shared utility).
  - [x] 3.4 Success log: carry ONLY `"Resent landlord invitation"` with no IDs/email (CWE-359 / cleartext-storage discipline — see Task 1.3 note). If a correlation value is genuinely needed for diagnostics, prefer a trace id; do NOT log `InvitationId`, `OriginalId`, `AccountId`, or `Email`.

- [x] **Task 4: Add `POST {id}/resend` action to `AdminLandlordInvitationsController`** (AC: #6)
  - [x] 4.1 Add `[HttpPost("{id:guid}/resend")]` action dispatching `ResendLandlordInvitationCommand(id)`, returning `201 Created` with `{ invitationId, message }` (mirror the existing `InvitationsController.ResendInvitation` action shape, including the `try/catch (ValidationException)` → `ValidationProblemDetails`, lines 70-95). Gated by the class-level `CanInviteLandlords` policy.
  - [x] 4.2 Add `[ProducesResponseType]` for 201/400/401/403/404.
  - [x] 4.3 Wire a validator if the existing resend uses one (`ResendInvitationValidator.cs` exists — create a peer `ResendLandlordInvitationValidator.cs` only if the existing controller calls a validator before `_mediator.Send`; otherwise dispatch directly. Verify against `InvitationsController.ResendInvitation` — it calls `_resendValidator.ValidateAsync`).

### Backend — tests

- [x] **Task 5: Backend unit tests** (AC: #3, #6)
  - [x] 5.1 New `backend/tests/PropertyManager.Application.Tests/Invitations/GetLandlordInvitationsTests.cs`: returns only `AccountId == null` rows; excludes account-scoped invitations; ordered by `CreatedAt` desc; status derivation (`Pending`/`Expired`/`Accepted`); `InvitedBy` populated; empty list → empty response with `TotalCount == 0`. Use `Mock<IAppDbContext>` + `MockQueryable.Moq` (`BuildMockDbSet()`).
  - [x] 5.2 New `backend/tests/PropertyManager.Application.Tests/Invitations/ResendLandlordInvitationTests.cs`: happy path re-creates with `AccountId == null` / `Role == "Owner"` and calls `SendLandlordInvitationEmailAsync` (verify `SendInvitationEmailAsync` and `SendTenantInvitationEmailAsync` are `Times.Never`); not-found when no null-`AccountId` invitation matches; `UsedAt != null` → `ValidationException`; not-yet-expired → `ValidationException`.

- [x] **Task 6: Backend integration tests (WebApplicationFactory + Testcontainers)** (AC: #3, #6, plus auth)
  - [x] 6.1 Extend `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` (created in 22.2). Reuse `GrantPlatformAdminClaimAsync` / `CreatePlatformAdminAsync` helpers already in that file.
  - [x] 6.2 **GET list tests:** `GetLandlordInvitations_AsPlatformAdmin_Returns200WithNullAccountInvitations` (seed via `POST` create as admin, then GET, assert the created invitation appears and account-scoped invitations created via `/api/v1/invitations` do NOT appear); `GetLandlordInvitations_AsRegularOwner_Returns403`; `GetLandlordInvitations_AsUnauthenticated_Returns401`.
  - [x] 6.3 **Resend tests:** `ResendLandlordInvitation_AsPlatformAdmin_ExpiredInvitation_Returns201_CreatesFreshNullAccountInvitation` (seed an EXPIRED landlord invitation directly in the DB with `AccountId = null` and `ExpiresAt` in the past — mirror the seeding pattern in `InvitationsControllerTests`; after resend, query DB and assert a new `AccountId == null` row with fresh `ExpiresAt > now`, and assert `FakeEmailService.SentLandlordInvitationEmails` got the entry while `SentInvitationEmails` did NOT); `ResendLandlordInvitation_AsRegularOwner_Returns403`; `ResendLandlordInvitation_NotYetExpired_Returns400`; `ResendLandlordInvitation_AlreadyUsed_Returns400`; `ResendLandlordInvitation_NonExistentId_Returns404`. Read the 400 response **body** and assert the `errors`/`detail` message (per Story 22.1 Finding #3 — assert body shape, not just status).

### Frontend — API client, store, service

- [x] **Task 7: Regenerate the NSwag client** (AC: #3, #6)
  - [x] 7.1 After Tasks 1-4 land and the backend builds, run `cd frontend && npm run generate-api`. Confirm the generated `api.service.ts` gains `adminLandlordInvitations_GetLandlordInvitations()` and `adminLandlordInvitations_ResendLandlordInvitation(id)` plus the `LandlordInvitationDto` / `GetLandlordInvitationsResponse` / resend response types. (`adminLandlordInvitations_CreateLandlordInvitation` already exists from 22.2 — verified this turn at `api.service.ts:22`.) Commit the regenerated client; do NOT hand-edit it.

- [x] **Task 8: Admin store** (AC: #3, #5, #6)
  - [x] 8.1 New `frontend/src/app/features/admin/stores/admin.store.ts` using `signalStore({ providedIn: 'root' }, withState(...), withMethods(...))`. State: `{ invitations: LandlordInvitationDto[]; loading: boolean; error: string | null }`. **Mirror `UserManagementStore` (`features/settings/stores/user-management.store.ts`) closely** — it is the canonical precedent (load via `rxMethod`, `patchState`, `MatSnackBar` feedback, error extraction from `error.errors`/`error.title`, a private `reloadInvitations()` helper used after create/resend).
  - [x] 8.2 Methods: `loadInvitations` (rxMethod, calls `api.adminLandlordInvitations_GetLandlordInvitations()`), `createInvitation` ({ email }, calls `adminLandlordInvitations_CreateLandlordInvitation({ email })`, on success snackbar `Landlord invitation sent to <email>` + reload), `resendInvitation` (id, calls `adminLandlordInvitations_ResendLandlordInvitation(id)`, on success snackbar + reload). Match the snackbar config (`duration`, position) used in `UserManagementStore`.
  - [x] 8.3 Inject `ApiClient` directly inside `withMethods` (the settings store injects the generated `ApiClient` — there is no separate hand-written `admin.service.ts` needed; the generated client IS the service layer, consistent with `UserManagementStore`). **Skip a separate `admin.service.ts`** unless the dev finds non-trivial transformation logic — note this deviation from the epic's suggested file list and justify in the Dev Agent Record. (The epic listed `admin.service.ts`, but the established 19.6/19.7 pattern injects `ApiClient` straight into the store.)

### Frontend — guard, route, components, nav

- [x] **Task 9: `platformAdminGuard` functional route guard** (AC: #7)
  - [x] 9.1 New `frontend/src/app/core/auth/platform-admin.guard.ts`. Mirror `owner.guard.ts` exactly (functional `CanActivateFn`, `inject(AuthService)`, `inject(Router)`). Allow when `authService.currentUser()?.isPlatformAdmin === true`; otherwise redirect: Tenant → `router.createUrlTree(['/tenant'])`, everyone else → `router.createUrlTree(['/dashboard'])`. (Runs inside the Shell, which already applies `authGuard`, so authentication is guaranteed by the time this runs — same assumption documented in `owner.guard.ts`.)

- [x] **Task 10: Admin feature components + route** (AC: #2, #3, #4, #5, #6, #8, #9)
  - [x] 10.1 New feature folder `frontend/src/app/features/admin/`. Components (all standalone, signal-based, `inject()`):
    - `admin-landing.component.ts` — route landing; page title "Admin Console"; renders the Landlord Invitations section. May host the list directly or compose `landlord-invitations-list`.
    - `components/landlord-invitations-list/landlord-invitations-list.component.ts` — the `mat-card` + `<table class="data-table">` + `mat-chip` status pattern copied from `settings.component.ts:56-115`. "Invite New Landlord" button (`mat-raised-button color="primary"`) opens the create dialog via `MatDialog`. "Resend" `mat-button` shown only for `status === 'Expired'` rows (mirror `settings.component.ts:97-106`). Empty state when `store.invitations().length === 0`. Reads `store.invitations()`, `store.loading()`; calls `store.loadInvitations()` on init.
    - `components/create-landlord-invitation-dialog/create-landlord-invitation-dialog.component.ts` — **copy `InviteUserDialogComponent` and strip the Role field** (email-only). `FormBuilder` group `{ email: ['', [Validators.required, Validators.email]] }`, `mat-form-field appearance="outline"`, `mat-error` for required/email, `onSubmit` closes with `{ email }` (or no-op + `markAllAsTouched` when invalid), `onCancel` closes undefined. Returns the email to the list component, which calls `store.createInvitation({ email })`.
  - [x] 10.2 Register the route in `frontend/src/app/app.routes.ts` as a child of the Shell route (alongside `settings`): `{ path: 'admin', loadComponent: () => import('./features/admin/admin-landing.component').then(m => m.AdminLandingComponent), canActivate: [platformAdminGuard] }`. Import `platformAdminGuard` at the top like the other guards.

- [x] **Task 11: Conditional "Admin" nav entry** (AC: #1)
  - [x] 11.1 In `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts`, surface the admin entry conditionally. Inject `PermissionService` (or read `authService.currentUser()?.isPlatformAdmin`) and add a separate computed signal `adminNavItems` (or a guarded append) so the "Admin" item (`{ label: 'Admin', route: '/admin', icon: 'admin_panel_settings' }`) is included ONLY when `isPlatformAdmin()` is true. Do NOT fold it into the role-based `navItems` branches (a user is Owner+PlatformAdmin simultaneously — the admin entry is orthogonal to role, per 22.1's architectural decision).
  - [x] 11.2 In `sidebar-nav.component.html`, render the admin entry **after a `mat-divider`** below the main `mat-nav-list`, so it is visually distinct as a platform-level area (AC-22.4.1). Give the link `data-testid="nav-admin"` (the template already derives test ids as `'nav-' + label.toLowerCase()` — verify the existing `@for` covers it, or add an explicit element). Ensure it does NOT appear for non-admins.

### Frontend — tests

- [x] **Task 12: Frontend unit tests (Vitest)** (AC: #1, #3, #5, #6, #7, #8)
  - [x] 12.1 `admin.store.spec.ts` — `loadInvitations` populates state from the mocked `ApiClient`; `createInvitation` calls the create method, shows success snackbar, reloads; `resendInvitation` calls the resend method, shows snackbar, reloads; error paths set `error` and show error snackbar. Mock `ApiClient` methods returning `of(...)` / `throwError(...)`, mock `MatSnackBar`. Mirror `user-management.store.spec.ts`.
  - [x] 12.2 `platform-admin.guard.spec.ts` — allows when `currentUser().isPlatformAdmin === true`; redirects Tenant to `/tenant`; redirects Owner-without-claim / Contributor to `/dashboard`; redirects when `currentUser()` is null. Mirror `owner.guard.spec.ts`. (Remember every `User` literal needs `isPlatformAdmin` per the 22.1 strict-mode lesson.)
  - [x] 12.3 `create-landlord-invitation-dialog.component.spec.ts` — invalid/empty email keeps the dialog open (no close with value); valid email closes with `{ email }`; `mat-error` rendering for required + email. Mirror `invite-user-dialog.component.spec.ts`.
  - [x] 12.4 `landlord-invitations-list.component.spec.ts` — renders rows from the store; shows empty state at zero; "Resend" visible only for Expired rows; clicking "Invite New Landlord" opens the dialog (mock `MatDialog.open` returning an `afterClosed()` of `{ email }`) and calls `store.createInvitation`.
  - [x] 12.5 `sidebar-nav.component.spec.ts` (extend existing) — "Admin" entry present when `isPlatformAdmin` true; absent for Owner-without-claim, Contributor, Tenant. Update existing `User` fixtures with `isPlatformAdmin` as needed.

- [x] **Task 13: E2E test (Playwright)** (AC: #1, #2, #3, #4, #5, #6)
  - [x] 13.1 New `frontend/e2e/tests/admin/landlord-invitations.spec.ts`. Import `test`/`expect` from `e2e/fixtures/test-fixtures` (NOT `@playwright/test`). The `authenticatedUser` fixture logs in as the seeded `claude@claude.com`, who is a PlatformAdmin per 22.1 — so the admin nav/route are reachable.
  - [x] 13.2 Happy path: assert the "Admin" nav entry is visible (`data-testid="nav-admin"`); navigate to `/admin`; assert the Landlord Invitations section renders; click "Invite New Landlord", fill a unique `landlord-${Date.now()}@example.com` email, submit; assert the success snackbar (`BasePage.expectSnackBar(...)`) and that the new row appears with status "Pending". Use the `mailhog.helper.ts` (`waitForEmail(email, "You're invited to create your Upkeep account")`) to confirm the landlord email was sent — mirror `e2e/tests/invitations/invitation-flow.spec.ts` which already uses `mailhog.getInvitationCode(...)`.
  - [x] 13.3 Resend path (best-effort within shared-DB constraints): the spec MAY seed an expired landlord invitation by calling `POST /api/v1/admin/landlord-invitations` then time-warping is not possible — instead use `page.route()` to stub `GET /api/v1/admin/landlord-invitations` returning one row with status "Expired", click "Resend", and assert the resend POST fires + success snackbar. Document this stubbing approach in the spec (per CLAUDE.md E2E rules — `page.route()` to control data shape; "NEVER assume seed-data counts").
  - [x] 13.4 Create a Page Object under `e2e/pages/` (e.g. `admin-landlord-invitations.page.ts`) extending `BasePage`, exposing the nav link, the invite button, the dialog email field, the submit button, the table rows, and the resend button — following the existing Page Object Model convention.

### Verify

- [x] **Task 14: Verify and document** (AC: all)
  - [x] 14.1 `cd backend && dotnet build && dotnet test` — 0 errors; cite final pass/fail counts. Expected delta: ~4 unit test files of additions + ~8 integration tests in `AdminLandlordInvitationsControllerTests`.
  - [x] 14.2 `cd frontend && npm run build && npm test -- --run` — build clean; cite test counts. (The regenerated NSwag client must not break existing specs.)
  - [x] 14.3 `cd frontend && npm run e2e -- --workers=1` (or the project's `npm run test:e2e`) — run the new admin spec; cite pass/fail. Note any pre-existing shared-DB flakes separately (per the documented `Reset 500` FK pattern in 22.3's eval).
  - [x] 14.4 Manual smoke (during /evaluate Phase 3): log in as `claude@claude.com`, open `/admin`, create a landlord invitation, confirm it appears + MailHog received the landlord email; if the dev server is up, drive it via Playwright MCP and save screenshots to `screenshots/`.

## Dev Notes

### Critical: logging (CWE-359 + cleartext-storage) — do not be the fourth (now fifth)

`project-context.md` line 237 and the git history are emphatic: **NEVER log emails, user/account IDs, storage keys, or request fields — even masked.** Two CodeQL queries block merges: CWE-359 (PII) and `cs/cleartext-storage-of-sensitive-information` (account/tenant IDs). Verified this turn in git: Stories 22-1 (`5e52256`), 22-2 (`f0a1da7`), and 22-3 (commit `398dca3` — *"drop AccountId from invitation log"*, following `be41b7f` *"Potential fix for ... Clear text storage of sensitive information"*) all shipped logs that were ripped out post-PR. The new backend logs in Tasks 1 and 3 must carry only non-sensitive aggregates (a count) or nothing — no `InvitationId`, `AccountId`, `UserId`, or `Email`.

### Verified codebase facts (read this turn — trust these over the epic's assumptions)

| Fact | Evidence (file:line, verified this turn) |
|---|---|
| `PermissionService.isPlatformAdmin` signal already exists (shipped 22.1) | `frontend/src/app/core/auth/permission.service.ts:30-32` |
| `AuthService.currentUser()?.isPlatformAdmin` field exists (shipped 22.1) | referenced by the signal above; `User` interface carries `isPlatformAdmin` |
| `POST /api/v1/admin/landlord-invitations` create method already in generated client (22.2) | `frontend/src/app/core/api/api.service.ts:22` (`adminLandlordInvitations_CreateLandlordInvitation`) |
| `AdminLandlordInvitationsController` exists, class-level `[Authorize(Policy="CanInviteLandlords")]` | `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs:15` |
| **No GET endpoint for landlord (null-AccountId) invitations** — must be added | only `GetAccountInvitations.cs:52-53` exists, filters by `_currentUser.AccountId` |
| **Existing resend is account-scoped & sends co-owner email** — cannot serve landlord | `ResendInvitation.cs:50` (lookup `AccountId == _currentUser.AccountId`), `:87` (re-stamps AccountId), `:116` (`SendInvitationEmailAsync`) |
| `Invitation` is NOT an `ITenantEntity` (no global query filter) — safe to query `AccountId == null` directly | `Invitation.cs:43` (`Guid? AccountId`); no `HasQueryFilter` for `Invitations` in `AppDbContext` |
| Status strings are `Pending`/`Expired`/`Accepted` (NOT "Used") | `GetAccountInvitations.cs:71-76` (`DeriveStatus`) |
| Settings page uses a plain `<table class="data-table">` + `mat-chip` status, NOT `mat-table` | `settings.component.ts:68-115` |
| Existing co-owner resend handler keeps cannot-resend-used / only-expired guards | `ResendInvitation.cs:59-74` |
| `SendLandlordInvitationEmailAsync` (the distinct 22.2 template) is the email to use on resend | `IEmailService` (22.2); `FakeEmailService.SentLandlordInvitationEmails` for test assertions |

### Frontend pattern anchors (copy these, don't invent)

- **Guard:** `frontend/src/app/core/auth/owner.guard.ts` — functional `CanActivateFn`, `inject()`, `createUrlTree` redirects, Tenant special-case. `platformAdminGuard` is a near-clone keyed on `isPlatformAdmin`.
- **Store:** `frontend/src/app/features/settings/stores/user-management.store.ts` — `signalStore` + `rxMethod` + `patchState` + `MatSnackBar` + private `reload...()` helper + error extraction from `error.errors`/`error.title`. The closest analogue (it already does load/create/resend invitations, just account-scoped).
- **Create dialog:** `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.ts` — `FormBuilder`, `mat-form-field appearance="outline"`, `@if`-based `mat-error`, `MatDialogRef.close(value)`. Strip the Role control for the landlord (email-only) dialog.
- **List/table + status chips:** `frontend/src/app/features/settings/settings.component.ts:56-115` — `mat-card` section, `<table class="data-table">`, `mat-chip` with `status-pending`/`status-expired`/`status-accepted` classes, Resend button gated on `status === 'Expired'`.
- **Nav:** `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts:61-90` (computed `navItems`, role branching) and `sidebar-nav.component.html:8-26` (`@for` over items, `data-testid`, `mat-divider` already imported via `MatDividerModule`).
- **Routes:** `frontend/src/app/app.routes.ts:182-190` (the `settings` child route is the structural template for the new `admin` child route).

### Backend pattern anchors

- **Query + handler + DTO single file:** `GetAccountInvitations.cs` — copy structure for `GetLandlordInvitations.cs` (swap the `Where` clause, add `InvitedBy`).
- **Resend command + handler:** `ResendInvitation.cs` — copy for `ResendLandlordInvitation.cs` with the landlord changes (lookup `AccountId == null`, re-create null-account, landlord email).
- **Admin controller:** `AdminLandlordInvitationsController.cs` (22.2) — add `[HttpGet]` and `[HttpPost("{id:guid}/resend")]` actions; the class is already policy-gated. Mirror `InvitationsController.ResendInvitation` (lines 70-95) for the try/catch + `CreatedAtAction` shape.
- **Integration test class:** `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` (22.2) — extend it; reuse `GrantPlatformAdminClaimAsync`/`CreatePlatformAdminAsync` and `FakeEmailService.SentLandlordInvitationEmails`.

### Resend authorization — see the dedicated "Resend Authorization Decision" section above

That section is the explicit resolution of the epic note at ~line 220. Summary: **parallel admin route `POST /api/v1/admin/landlord-invitations/{id}/resend` gated by `CanInviteLandlords`, new `ResendLandlordInvitationCommandHandler`; existing `/api/v1/invitations/{id}/resend` untouched.**

### Multi-PlatformAdmin / orthogonality reminder (from 22.1)

PlatformAdmin is a **claim**, orthogonal to the per-account `role`. The seeded `claude@claude.com` is simultaneously `role = "Owner"` and `platformAdmin = true`. Therefore: (a) the Admin nav entry must be additive — appended for admins, not a separate role branch that hides the normal Owner nav; (b) `platformAdminGuard` keys on the claim, not on role; (c) only `claude@claude.com` is seeded as PlatformAdmin (no UI to grant the claim — out of scope per the epic).

### Critical implementation rules (from project-context.md)

- Frontend: standalone components, `inject()`, `input()`/`output()` signals, `@if`/`@for` control flow, signal stores `{ providedIn: 'root' }`, `MatSnackBar` for feedback, SCSS styles, Prettier (`singleQuote`, `printWidth: 100`).
- Backend: file-scoped namespaces, records for commands/queries/DTOs, `DateTime.UtcNow`, `_camelCase` private fields, `CancellationToken` threaded, `IAppDbContext` directly (no repository), `[ProducesResponseType]` on actions, controllers `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]`, Request/Response records at the bottom of the controller file.
- Do NOT add try/catch in controllers for domain exceptions (middleware maps them) — EXCEPT the established `FluentValidation.ValidationException` → `ValidationProblemDetails` try/catch that `InvitationsController` uses; mirror it for the resend action.
- Tests: `Method_Scenario_ExpectedResult`, AC codes in comments, FluentAssertions, constructor mock setup, `MockQueryable.Moq` `BuildMockDbSet()`; frontend specs co-located, `vi.fn()`, `of(...)`/`throwError(...)`; E2E imports from `e2e/fixtures/test-fixtures`, Page Object Model.

### Test Scope

Per `feedback_testing_pyramid` and the create-story guidance, each pyramid level is explicitly assessed:

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit tests (backend)** | **YES** | New `GetLandlordInvitationsQueryHandler` (filter `AccountId == null`, status derivation, `InvitedBy`) and new `ResendLandlordInvitationCommandHandler` (null-account lookup, landlord email, resend guards) are genuinely new logic — testable with `Mock<IAppDbContext>` + `MockQueryable.Moq`. Task 5. |
| **Unit tests (frontend)** | **YES** | New `admin.store` (load/create/resend + snackbar + error paths), `platformAdminGuard` (allow/redirect matrix), create dialog (validation), list component (rows/empty/resend-gating/dialog wiring), and the sidebar nav admin-entry visibility. Task 12. |
| **Integration tests (backend, WebApplicationFactory + Testcontainers)** | **YES — REQUIRED** | This story **adds two backend endpoints** (GET list + POST resend) with authorization, DB side-effects, and email dispatch. The epic's "frontend-only" framing was wrong (verified: no GET endpoint existed, resend was account-scoped). End-to-end HTTP coverage is the only way to prove (a) the `CanInviteLandlords` policy fires on the new routes (200/403/401), (b) the GET returns only null-`AccountId` rows and excludes account-scoped invitations, (c) resend creates a fresh null-account row and sends the landlord email (via `FakeEmailService`), (d) resend guards return 400/404 with the right body. Task 6. |
| **E2E tests (Playwright)** | **YES — REQUIRED** | This story introduces the FIRST user-facing admin flow: the Admin nav entry, the `/admin` route + guard, the list, the create dialog, and resend. The epic explicitly assigns the admin-creates-landlord-invitation E2E to this story (epic line 221), and Stories 22.1/22.2/22.3 all deferred E2E to 22.4. Happy path (admin sees nav → opens /admin → lists → creates → MailHog confirms email) is the critical path; resend is covered via `page.route()` stubbing. Task 13. |

The story includes dedicated test tasks for every required level: Task 5 (backend unit), Task 6 (backend integration), Task 12 (frontend unit), Task 13 (E2E).

### Previous Story Intelligence

**From Story 22.1 (PlatformAdmin Role & Permission Infrastructure):**
- `PermissionService.isPlatformAdmin` computed signal and `User.isPlatformAdmin` field already exist — this story consumes them for nav + guard. No new auth plumbing needed.
- The `platformAdmin` JWT claim is **omitted entirely** when false (not `"false"`); `isPlatformAdmin` derives from `payload.platformAdmin === 'true'`.
- Adding any field to the `User` interface ripples through ~10+ frontend spec files (TypeScript strict mode). Updating `User` fixtures is unlikely here (no `User` shape change), but the guard/nav specs must include `isPlatformAdmin` in their `User` literals.
- Evaluation Finding #3: integration tests should assert response **body** shape, not just status. Apply to the 400 resend tests.

**From Story 22.2 (Create Landlord Invitation API + Email):**
- `AdminLandlordInvitationsController` + `CanInviteLandlords` gate are live; extend the same controller with GET + resend (don't create a new controller).
- `SendLandlordInvitationEmailAsync` is the distinct landlord email; `FakeEmailService.SentLandlordInvitationEmails` is the test hook to assert the right flavor was sent on resend.
- `GenerateSecureCode`/`ComputeHash` are duplicated per-handler by design — duplicate again for resend; do NOT DRY.
- The generated client method `adminLandlordInvitations_CreateLandlordInvitation` already exists (22.2 regenerated it) — Task 7 only adds GET + resend.

**From Story 22.3 (Accept Landlord Invitation — Verification):**
- CWE-359 / cleartext-storage is real and enforced post-merge: 22.3's `AccountId`-in-log was reverted by commit `398dca3` after CodeQL flagged `cs/cleartext-storage-of-sensitive-information`. The new logs in this story must avoid IDs entirely.
- The full create→MailHog→accept→empty-dashboard flow is proven; this story's UI sits on top of that verified backend.

**From Story 19.6 / 19.7 (Invitation & User Management UI):**
- `UserManagementStore` + `InviteUserDialogComponent` + the `settings.component.ts` table are the direct precedents for this story's store/dialog/list — copy their structure and styling. The Settings invitation table already implements the exact "list invitations with status chips + Resend on Expired" UX this story needs (just account-scoped instead of admin-scoped).
- The existing E2E `e2e/tests/invitations/invitation-flow.spec.ts` + `mailhog.helper.ts` (`getInvitationCode`, `waitForEmail`) are the precedents for the admin E2E.

### References

| Artifact | Section / Lines (verified this turn) |
|---|---|
| `docs/project/epics-landlord-provisioning.md` | Story 22.4 (lines 182-222) — ACs + technical notes; **line ~220** = resend authorization decision (resolved above); line 221 = E2E hand-off |
| `docs/project/stories/epic-22/22-1-...md` | PlatformAdmin claim + `PermissionService.isPlatformAdmin` signal; Finding #3 (assert body shape) |
| `docs/project/stories/epic-22/22-2-...md` | `AdminLandlordInvitationsController`, `CanInviteLandlords`, `SendLandlordInvitationEmailAsync`, `FakeEmailService.SentLandlordInvitationEmails` |
| `docs/project/stories/epic-22/22-3-...md` | CWE-359/cleartext-storage log discipline; verified accept flow |
| `docs/project/project-context.md` | Frontend/backend rules; line 237 (logging PII/IDs); API response shapes; testing rules |
| `frontend/src/app/core/auth/owner.guard.ts` | Functional guard pattern to clone for `platformAdminGuard` |
| `frontend/src/app/core/auth/permission.service.ts` | Lines 30-32 — `isPlatformAdmin` signal |
| `frontend/src/app/features/settings/stores/user-management.store.ts` | Store pattern (load/create/resend + snackbar + error extraction) |
| `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.ts` | Dialog pattern (strip Role for landlord) |
| `frontend/src/app/features/settings/settings.component.ts` | Lines 56-115 — `mat-card` + `data-table` + `mat-chip` status + Resend-on-Expired |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` / `.html` | Nav computed items + `@for` + `mat-divider` (MatDividerModule already imported) |
| `frontend/src/app/app.routes.ts` | Lines 182-190 — `settings` child route = template for `admin` route |
| `frontend/src/app/core/api/api.service.ts` | Line 22 — existing `adminLandlordInvitations_CreateLandlordInvitation`; line 2328 — `invitations_ResendInvitation` (account-scoped, not for landlord) |
| `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs` | Existing class to extend (GET + resend actions) |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Lines 48-56 (GET pattern), 70-95 (resend action try/catch + CreatedAtAction) |
| `backend/src/PropertyManager.Application/Invitations/GetAccountInvitations.cs` | Lines 52-53 (account-scoped query — NOT reusable), 71-76 (`DeriveStatus` — reuse) |
| `backend/src/PropertyManager.Application/Invitations/ResendInvitation.cs` | Lines 50/87/116 (why it can't serve landlord), 59-74 (resend guards to mirror) |
| `backend/src/PropertyManager.Domain/Entities/Invitation.cs` | Line 43 — `Guid? AccountId` (nullable, not ITenantEntity → no global filter) |
| `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` | 22.2 class to extend; `GrantPlatformAdminClaimAsync`/`CreatePlatformAdminAsync` helpers |
| `frontend/e2e/tests/invitations/invitation-flow.spec.ts` + `frontend/e2e/helpers/mailhog.helper.ts` | E2E + MailHog precedents (`getInvitationCode`, `waitForEmail`) |
| Angular Material — table guide | https://github.com/angular/components/blob/main/src/material/table/table.md (verified current API; NOTE: this story mirrors Settings' plain `data-table`, not `mat-table`) |
| Angular — CanActivateFn | https://angular.dev/api/router/CanActivateFn (verified functional-guard signature for Angular 21) |

**Ref MCP note:** Verified the current Angular Material table guide and `CanActivateFn` API (Angular 21) via Ref MCP. No discrepancy with the codebase's established patterns — the existing `owner.guard.ts` and Settings table already use current idioms, which are a stronger authority than docs for this story. **Playwright MCP note:** the dev server was NOT running during story authoring (`localhost:4200` and `:5292` both returned no response), so live visual observation was skipped; the visual language is instead grounded in the real `settings.component.ts` and `sidebar-nav` component files read this turn. /dev-story should run the app and use Playwright MCP for visual verification during implementation.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Test Plan

Per the Test Scope table:
- **Backend unit (REQUIRED)** — Task 5: `GetLandlordInvitationsTests`, `ResendLandlordInvitationTests`.
- **Backend integration (REQUIRED)** — Task 6: GET list (200/403/401, null-account filtering) + resend (201/403/400/404, landlord-email flavor) in `AdminLandlordInvitationsControllerTests`.
- **Frontend unit (REQUIRED)** — Task 12: `admin.store`, `platformAdminGuard`, create dialog, list component, sidebar nav visibility.
- **E2E (REQUIRED)** — Task 13: admin nav → /admin → list → create (+ MailHog) happy path; resend via `page.route()` stub.

### Debug Log References

- **Integration test shared-DB collision (Task 6):** initial seed helpers hardcoded `CodeHash = "seeded-hash"`. `IX_Invitations_CodeHash` is a unique index, so a second seed-using test in the same `IClassFixture` Postgres container hit `23505 duplicate key`. Fixed by generating a unique `CodeHash = $"seeded-{Guid.NewGuid():N}"` per seed. Tests pass individually but failed when the class ran together — classic shared-state flake.
- **NSwag runtime mismatch (Task 7):** `nswag.json` pins `runtime: Net90` but only the .NET 10 runtime is installed locally. Generated the client by temporarily setting the json `runtime` to `Net100` (the `Net100` toolchain binaries exist under `node_modules/nswag/bin/binaries/Net100`), then reverted `nswag.json` back to `Net90` so the committed config is unchanged. The generated `api.service.ts` is the only intended artifact.
- **E2E strict-mode (Task 13):** `getByText('Landlord Invitations')` matched both the card title and the empty-state text "No landlord invitations yet." Switched the section-visibility assertion to `mat-card-title` filtered by text.
- **`Reset 500` teardown:** the documented pre-existing shared-DB FK teardown flake (`[global-teardown] Reset failed: 500`) appears after the admin E2E run — unrelated to this story; both admin specs pass.

### Completion Notes List

- Backend scope was larger than "frontend-only" exactly as the story flagged: added `GET /api/v1/admin/landlord-invitations` (new `GetLandlordInvitationsQuery` + handler) and the parallel `POST /api/v1/admin/landlord-invitations/{id}/resend` (new `ResendLandlordInvitationCommand` + handler + validator) on the existing `AdminLandlordInvitationsController`. The existing `/api/v1/invitations/{id}/resend` route and `ResendInvitationCommandHandler` are untouched.
- `InvitedBy` resolved via the existing `IIdentityService.GetUserDisplayNamesAsync` helper (same mechanism as MaintenanceRequests / Notes) — no hand-rolled identity query.
- **CWE-359 / cleartext-storage discipline:** the two new backend logs carry only a count (`"Retrieved {Count} landlord invitations"`) or a static string (`"Resent landlord invitation"`) — no email, `InvitationId`, `AccountId`, or `UserId`.
- **Deviation from epic file list (justified):** no separate `admin.service.ts` was created. Per Task 8.3 and the 19.6/19.7 precedent, the generated `ApiClient` is injected directly into `AdminStore` — there is no non-trivial transformation logic that would warrant a hand-written service.
- `GenerateSecureCode`/`ComputeHash` duplicated in `ResendLandlordInvitation.cs` per the accepted project convention (not DRY'd into a shared utility).
- Verified visually via Playwright MCP as `claude@claude.com` (a seeded PlatformAdmin): the Admin nav entry renders below a divider after Settings; `/admin` shows the Admin Console title + Landlord Invitations card + data-table with status chips + Resend-on-Expired; the email-only create dialog opens. Screenshots were saved to `screenshots/` during development and removed at completion per the skill.

### File List

**Backend — new:**
- `backend/src/PropertyManager.Application/Invitations/GetLandlordInvitations.cs`
- `backend/src/PropertyManager.Application/Invitations/ResendLandlordInvitation.cs`
- `backend/src/PropertyManager.Application/Invitations/ResendLandlordInvitationValidator.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/GetLandlordInvitationsTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/ResendLandlordInvitationTests.cs`

**Backend — modified:**
- `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs` (added GET + resend actions, `_resendValidator`, `ResendLandlordInvitationResponse` record)
- `backend/tests/PropertyManager.Api.Tests/AdminLandlordInvitationsControllerTests.cs` (added GET list + resend integration tests + seed helpers)

**Frontend — new:**
- `frontend/src/app/features/admin/admin-landing.component.ts`
- `frontend/src/app/features/admin/components/landlord-invitations-list/landlord-invitations-list.component.ts`
- `frontend/src/app/features/admin/components/landlord-invitations-list/landlord-invitations-list.component.spec.ts`
- `frontend/src/app/features/admin/components/create-landlord-invitation-dialog/create-landlord-invitation-dialog.component.ts`
- `frontend/src/app/features/admin/components/create-landlord-invitation-dialog/create-landlord-invitation-dialog.component.spec.ts`
- `frontend/src/app/features/admin/stores/admin.store.ts`
- `frontend/src/app/features/admin/stores/admin.store.spec.ts`
- `frontend/src/app/core/auth/platform-admin.guard.ts`
- `frontend/src/app/core/auth/platform-admin.guard.spec.ts`
- `frontend/e2e/tests/admin/landlord-invitations.spec.ts`
- `frontend/e2e/pages/admin-landlord-invitations.page.ts`

**Frontend — modified:**
- `frontend/src/app/core/api/api.service.ts` (regenerated NSwag client — gained GET/resend methods + `LandlordInvitationDto`/`GetLandlordInvitationsResponse`/`ResendLandlordInvitationResponse`)
- `frontend/src/app/app.routes.ts` (added `/admin` child route + `platformAdminGuard` import)
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` (added `adminNavItems` computed)
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.html` (added admin nav block after a `mat-divider`)
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` (added PlatformAdmin nav-visibility describe block)

**Docs:**
- `docs/project/sprint-status.yaml` (22-4 → review)

### Test Results

- Backend: `dotnet build` → 0 errors; `dotnet test` → **2386 passing** (Application 1306, Infrastructure 105, Api 975), exit 0.
- Frontend: `npm run build` → clean (pre-existing bundle-budget warning only); `npm test` → **2984 passing / 134 files**, 0 failures.
- E2E: `npx playwright test e2e/tests/admin/landlord-invitations.spec.ts --workers=1` → **2 passed** (create+MailHog happy path; resend via `page.route()` stub). `Reset 500` teardown is the documented pre-existing shared-DB flake.

### Review Log

Note: this environment does not expose a general-purpose subagent dispatch tool, so the two-stage review was performed in-thread (fresh-eyes spec pass, then adversarial quality pass) rather than via dispatched subagents.

- **Task 1 (GetLandlordInvitations query):** Spec PASS — filters `AccountId == null`, orders desc, derives `Pending`/`Expired`/`Accepted` verbatim, resolves `InvitedBy` via `GetUserDisplayNamesAsync`, log carries only a count. Quality APPROVE — DTO/response records match the suggested shape; `ResolveInvitedBy` handles the null-`InvitedByUserId` case.
- **Task 2 (GET controller action):** Spec PASS — `[HttpGet]` returns `GetLandlordInvitationsResponse` (200) under the class-level `CanInviteLandlords` policy; `[ProducesResponseType]` 200/401/403 present. Quality APPROVE.
- **Task 3 (ResendLandlordInvitation handler + validator):** Spec PASS — lookup by `Id && AccountId == null`, re-creates `AccountId=null`/`Role="Owner"`/`PropertyId=null`/`InvitedByUserId=caller`, sends `SendLandlordInvitationEmailAsync`, keeps used/not-expired guards, log carries no IDs/email. Quality APPROVE — secure-code helpers duplicated per convention.
- **Task 4 (resend controller action):** Spec PASS — `[HttpPost("{id:guid}/resend")]` returns 201 with `{invitationId,message}`, mirrors the `try/catch (ValidationException) → ValidationProblemDetails` shape, validator called before `Send`, `[ProducesResponseType]` 201/400/401/403/404. Quality APPROVE.
- **Task 5 (backend unit):** Spec PASS — covers null-account filtering, ordering, status matrix, `InvitedBy`, empty list, and resend happy/not-found/used/not-expired + validator. Quality APPROVE — uses `MockQueryable.Moq` + AC comments; verifies co-owner/tenant emails are `Times.Never`.
- **Task 6 (backend integration):** Spec PASS — GET 200/403/401 with null-account filtering + account-scoped exclusion; resend 201 (DB asserts fresh null-account row + `FakeEmailService.SentLandlordInvitationEmails`)/403/400(not-expired)/400(used)/404(missing)/404(account-scoped), 400 bodies asserted. Quality APPROVE after fixing the unique-`CodeHash` shared-DB collision.
- **Task 7 (NSwag client):** Spec PASS — generated client gained the GET + resend methods and the three new types; client not hand-edited; `nswag.json` runtime reverted. Quality APPROVE.
- **Task 8 (admin store):** Spec PASS — `signalStore({providedIn:'root'})` with `loadInvitations`/`createInvitation`/`resendInvitation` (rxMethod + patchState + MatSnackBar + `reloadInvitations` helper + `errors`/`title` extraction), mirrors `UserManagementStore`; ApiClient injected directly. Quality APPROVE — snackbar configs extracted to constants; shared `extractErrorMessage` helper avoids duplication.
- **Task 9 (platformAdminGuard):** Spec PASS — functional `CanActivateFn`, allows on `isPlatformAdmin === true`, Tenant → `/tenant`, else → `/dashboard`; keys on claim not role. Quality APPROVE.
- **Task 10 (components + route):** Spec PASS — standalone signal components; landing hosts the list; list mirrors the Settings `mat-card`+`data-table`+`mat-chip` pattern with Resend-on-Expired + empty state; email-only dialog with required/email `mat-error`; `/admin` registered as a Shell child with `platformAdminGuard`. Quality APPROVE.
- **Task 11 (nav entry):** Spec PASS — separate `adminNavItems` computed gated on `isPlatformAdmin`, rendered after a `mat-divider`, not folded into role branches; `data-testid="nav-admin"`. Quality APPROVE.
- **Task 12 (frontend unit):** Spec PASS — store load/create/resend + error paths; guard allow/redirect matrix incl. null user; dialog validation + `mat-error` rendering + close-with-`{email}`; list rows/empty/resend-gating/dialog-wiring; sidebar admin-entry visibility across all roles. Quality APPROVE.
- **Task 13 (E2E):** Spec PASS — happy path asserts nav visible → `/admin` → section → create → success snackbar → new Pending row → MailHog landlord email; resend path uses `page.route()` to stub an Expired row + assert the resend POST fires + snackbar; Page Object under `e2e/pages/`. Quality APPROVE — stubbing approach documented in the spec per CLAUDE.md E2E rules.
- **Task 14 (verify):** Spec PASS — build + all suites + E2E run and cited above. Quality APPROVE.
