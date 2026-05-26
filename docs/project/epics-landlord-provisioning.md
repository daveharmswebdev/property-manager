# Landlord Account Provisioning - Epic Breakdown

**Author:** Dave
**Date:** 2026-05-26
**Version:** 1.0
**Source PRD:** This document (mini-epic, no separate PRD)

---

## Overview

This document defines a focused, mini-epic that unblocks beta testing by giving a platform administrator a sanctioned way to provision **new top-level landlord accounts** — separate `Account` rows with their own Owner user, distinct from the inviter's data.

Today the only top-level account is `claude@claude.com`, seeded by `OwnerAccountSeeder`. The existing invitation system (Epic 19, Epic 20) is designed to add users **to an existing account** (Owner, Contributor, Tenant). There is no API path to create a brand-new tenant-isolated landlord — which is exactly what's needed to onboard beta users.

**Foundation already in place (discovered during grounding):**

- `Invitation.AccountId` is **nullable**.
- `AcceptInvitation.cs` already branches on it: when `AccountId == null`, the handler creates a new `Account` and provisions the user as `Owner` (see `AcceptInvitation.cs:103-111`). The code comment labels this the "legacy/standalone flow — preserves curl workflow."
- The gap is the **create-side**: `CreateInvitation.cs:109` always sets `AccountId = _currentUser.AccountId`, so there is no longer a way to author a null-AccountId invitation through the API.

This epic closes the loop on the create-side, adds a `PlatformAdmin` gate, gives landlord invitations a distinct email, and ships an admin console UI so the workflow is self-serve for the platform owner.

**Dependencies:** Epic 19 (Multi-User Account with RBAC) — permission infrastructure, invitation entity refactor.

**Sets the seam for:** v1.0 self-service signup (a future public `POST /api/v1/signup` endpoint will create the same kind of new-account invitation **without** the PlatformAdmin gate).

---

## Epic Summary

| Epic | Name | Stories | Description |
|------|------|---------|-------------|
| 22 | Landlord Account Provisioning | 4 | PlatformAdmin role, landlord invitation API, accept-side verification, admin console UI |

---

## Functional Requirements Coverage

| FR | Description | Story |
|----|-------------|-------|
| FR-LP1 | PlatformAdmin can invite a new landlord by email | 22.2, 22.4 |
| FR-LP2 | Accepting a landlord invitation creates a new top-level Account and Owner user | 22.3 |
| FR-LP3 | Landlord invitation emails are distinct from co-owner/tenant invitation emails | 22.2 |
| FR-LP4 | Only users with PlatformAdmin role can invite landlords | 22.1, 22.2 |
| FR-LP5 | PlatformAdmin can list and resend landlord invitations | 22.4 |
| FR-LP6 | Existing tenant and co-owner invitation flows are unchanged (no regression) | 22.3 |

| NFR | Description | Story |
|-----|-------------|-------|
| NFR-LP1 | PlatformAdmin role enforced via policy on landlord-invitation endpoints | 22.1, 22.2 |
| NFR-LP2 | Code path leaves a clean seam for a future public `/signup` endpoint (no PlatformAdmin gate) | 22.2 |
| NFR-LP3 | New landlord accounts are fully tenant-isolated — no shared data with the inviter | 22.3 |
| NFR-LP4 | PlatformAdmin claim included in JWT for stateless authorization | 22.1 |

---

## Epic 22: Landlord Account Provisioning

### Objective

Give the platform administrator a curated mechanism to invite new landlords as separate top-level accounts via API and a small admin UI. This is the beta-onboarding tool. The accept-invitation handler already supports new-account provisioning; this epic closes the create-side gap, gates it appropriately, and surfaces it.

### Dependency Chain

```
22.1 (PlatformAdmin role) ──→ 22.2 (Create API + email) ──→ 22.3 (Accept verification + tests)
                                                         ──→ 22.4 (Admin console UI)
```

22.2 makes the feature beta-usable via Postman/curl immediately, before 22.4 lands the UI.

---

### Story 22.1: PlatformAdmin Role & Permission Infrastructure

**User Story:** As the platform owner, I want a PlatformAdmin role distinct from per-account Owner, so that landlord-provisioning endpoints can be gated by a platform-level capability rather than by per-account ownership.

**Source:** FR-LP4, NFR-LP1, NFR-LP4

**Acceptance Criteria:**

- **AC-22.1.1:** Given the application roles, When the system starts, Then a `"PlatformAdmin"` role/claim exists separate from `Owner`, `Contributor`, and `Tenant`. PlatformAdmin is a platform-wide role, **not** an account role — a user can simultaneously be Owner of an account and PlatformAdmin.

- **AC-22.1.2:** Given the `OwnerAccountSeeder`, When the seeder runs, Then `claude@claude.com` is granted the PlatformAdmin role/claim in addition to their existing Owner role on their account.

- **AC-22.1.3:** Given an authenticated user with the PlatformAdmin role, When the JWT is issued at login, Then the token includes a claim indicating PlatformAdmin status (so authorization is stateless).

- **AC-22.1.4:** Given the permission system, When permissions are evaluated, Then a `"CanInviteLandlords"` policy exists and resolves true only for users with PlatformAdmin.

- **AC-22.1.5:** Given a user without the PlatformAdmin role (regular Owner, Contributor, Tenant), When they call any endpoint protected by `CanInviteLandlords`, Then the API returns 403 Forbidden.

- **AC-22.1.6:** Given a PlatformAdmin who is also Owner of an account, When they call existing per-account endpoints (`POST /api/v1/invitations` for co-owners, property/expense endpoints, etc.), Then those endpoints continue to work as before — PlatformAdmin does not grant cross-account read/write access.

**Technical Notes:**

- Add `PlatformAdmin` to identity setup — likely a new role string in `RolePermissions.cs` (or a separate claim type if roles are reserved for account-scope).
- `OwnerAccountSeeder.cs` updates: after creating `claude@claude.com`, add PlatformAdmin via `UserManager.AddToRoleAsync` or claims API. Idempotent.
- JWT generation in `Application/Auth/Login.cs` (or equivalent) includes the PlatformAdmin claim when present.
- Register `CanInviteLandlords` policy in `Program.cs` alongside existing `CanManageUsers`.
- Decision: PlatformAdmin is a **claim**, not a per-account role. This prevents conflicts with `ApplicationUser.Role` (currently `Owner` / `Contributor` / `Tenant`, which is the per-account role).
- Unit tests for permission evaluator covering PlatformAdmin true/false cases.
- Integration test: authenticated as PlatformAdmin, hit a `CanInviteLandlords`-protected stub → 200; as plain Owner → 403.

---

### Story 22.2: Create Landlord Invitation API + Distinct Email

**User Story:** As a PlatformAdmin, I want a dedicated endpoint to invite a new landlord by email, so that I can onboard beta customers without giving them access to my data.

**Source:** FR-LP1, FR-LP3, FR-LP4, NFR-LP1, NFR-LP2

**Acceptance Criteria:**

- **AC-22.2.1:** Given a PlatformAdmin authenticated via JWT, When they call `POST /api/v1/admin/landlord-invitations` with a valid email payload, Then an `Invitation` row is created with `AccountId = null`, `Role = "Owner"`, `InvitedByUserId` set to the calling PlatformAdmin, and a 24-hour expiry — and a 201 Created is returned with the invitation id.

- **AC-22.2.2:** Given a non-PlatformAdmin user (regular Owner, Contributor, Tenant, or unauthenticated), When they call `POST /api/v1/admin/landlord-invitations`, Then the API returns 403 Forbidden (or 401 if no JWT).

- **AC-22.2.3:** Given an email that is already a registered user, When the endpoint is called with that email, Then validation fails with a 400 and the message indicates the email is already registered.

- **AC-22.2.4:** Given an email that already has a non-expired, unused invitation (of any flavor), When the endpoint is called, Then validation fails with a 400 and the message indicates a pending invitation exists.

- **AC-22.2.5:** Given a successful landlord invitation creation, When the email is sent, Then it uses a **landlord-specific template** distinct from the co-owner/tenant invitation email: subject line, body copy, and CTA make clear the recipient is being invited to create **their own** Upkeep account (not to join someone else's).

- **AC-22.2.6:** Given the email request payload, When validated, Then only `email` is required — there is no `role`, `propertyId`, or `accountId` parameter (the endpoint is single-purpose: create a new-account landlord invitation).

- **AC-22.2.7:** Given the existing `POST /api/v1/invitations` endpoint (the per-account invitation for co-owners and tenants), When called, Then its behavior is unchanged — it still requires the `CanManageUsers` policy and creates invitations bound to the caller's `AccountId`.

- **AC-22.2.8:** Given the new endpoint's command/handler, When implemented, Then the handler is structured so a future public `/api/v1/signup` endpoint could reuse the same domain logic by calling the same command (or a peer command) **without** the PlatformAdmin policy check — the gate lives at the controller/policy level, not in the domain logic.

- **AC-22.2.9:** Given audit logging in place for invitations, When a landlord invitation is created, Then a structured log entry is written including: invitation id, PlatformAdmin user id, masked recipient email.

**Technical Notes:**

- New file: `backend/src/PropertyManager.Application/Invitations/CreateLandlordInvitation.cs` — command + handler + result record.
- Command shape: `record CreateLandlordInvitationCommand(string Email) : IRequest<CreateLandlordInvitationResult>;`
- Handler reuses existing patterns from `CreateInvitation.cs`: secure code generation, hash storage, duplicate-email/pending-invitation checks. Differs only in that `AccountId` stays null and `Role` is forced to `"Owner"`.
- New validator: `CreateLandlordInvitationValidator.cs`.
- New controller (or new action on a new admin controller): `backend/src/PropertyManager.Api/Controllers/AdminLandlordInvitationsController.cs` — route `[Route("api/v1/admin/landlord-invitations")]`, action gated by `[Authorize(Policy = "CanInviteLandlords")]`.
- `IEmailService` gains a new method: `SendLandlordInvitationEmailAsync(string email, string rawCode, CancellationToken ct)`. Existing `SendInvitationEmailAsync` stays for co-owner; `SendTenantInvitationEmailAsync` stays for tenant.
- Email template differentiation: subject like "You're invited to create your Upkeep account" (vs co-owner "You've been invited to join an Upkeep account"). Body explains they'll get their own dashboard, properties, etc.
- The accept URL in the email continues to point at the existing `/accept/:code` flow (no separate route — the accept handler already branches on `AccountId`).
- Postman collection: add new request under `Admin / Landlord Invitations`.
- Unit tests for handler covering: happy path (null AccountId persisted), duplicate email, pending invitation, valid email format.
- Integration tests via `WebApplicationFactory`: PlatformAdmin → 201; plain Owner → 403; unauthenticated → 401; duplicate-email → 400.

---

### Story 22.3: Accept Landlord Invitation — Verification & Integration Tests

**User Story:** As the platform owner, I want integration tests that prove the accept-invitation flow correctly provisions a new top-level account when `AccountId` is null, so that I can rely on the landlord-onboarding path end-to-end.

**Source:** FR-LP2, FR-LP6, NFR-LP3

**Acceptance Criteria:**

- **AC-22.3.1:** Given a landlord invitation (`AccountId = null`, `Role = "Owner"`), When a recipient accepts it via `POST /api/v1/invitations/{code}/accept` with a valid password, Then a new `Account` row is created, a new Owner `ApplicationUser` is created and linked to that account, the invitation is marked `UsedAt = now`, and the response includes the new user id.

- **AC-22.3.2:** Given a newly provisioned landlord account, When the new Owner logs in and queries their data (`GET /api/v1/properties`, etc.), Then they see exactly **zero** properties, expenses, vendors, work orders — confirming tenant isolation from the inviting PlatformAdmin's account.

- **AC-22.3.3:** Given a landlord invitation, When acceptance fails (Identity rejects the password, for example), Then the partially-created `Account` row is rolled back so we don't accumulate orphaned accounts.

- **AC-22.3.4:** Given a tenant invitation (`AccountId` set, `Role = "Tenant"`, `PropertyId` set), When accepted, Then the existing behavior is preserved — the user joins the existing account as a Tenant. Regression test.

- **AC-22.3.5:** Given a co-owner invitation (`AccountId` set, `Role = "Owner"` or `"Contributor"`), When accepted, Then the existing behavior is preserved — the user joins the existing account. Regression test.

- **AC-22.3.6:** Given a landlord invitation has been accepted, When the new Owner's JWT is issued, Then it contains the new `Account`'s id (not the inviter's), confirming JWT claims are derived from the freshly created user.

- **AC-22.3.7:** Given the new landlord account, When the inviting PlatformAdmin queries their own data, Then they see no contamination — the new account's data is invisible to them (multi-tenant filter holds).

**Technical Notes:**

- Existing handler `AcceptInvitation.cs:103-111` already supports this — the work here is **verification, hardening, and observability**, not new logic.
- Audit: review the rollback path in `AcceptInvitation.cs:122-129` — confirm the account-row delete works in the transaction and there are no FK orphans (new Owner user creation rolls back too).
- Integration tests in `PropertyManager.Api.Tests/InvitationsControllerTests.cs` (new test class section): full end-to-end accept flow for landlord invitations + tenant-isolation assertions.
- Add a structured log entry on landlord-invitation acceptance: new account id, new user id, originating invitation id. Useful for beta observability.
- Manual smoke test (in PR description, per project DoD): create landlord invitation via Postman, fetch code from MailHog, accept via Postman, log in as new user, verify empty dashboard.
- Documentation: update `CLAUDE.md` Test Accounts section once we have a stable beta test landlord (or document the curl-style invite flow for future test setup).

---

### Story 22.4: Admin Console UI — List, Create, Resend Landlord Invitations

**User Story:** As the platform administrator, I want a small admin console in the app where I can create landlord invitations, see existing ones with their status, and resend expired invitations, so that I can manage beta onboarding without touching Postman.

**Source:** FR-LP1, FR-LP5

**Acceptance Criteria:**

- **AC-22.4.1:** Given a user with the PlatformAdmin claim, When they log in, Then the app shows an "Admin" navigation entry (visible only to PlatformAdmins). Non-admins do not see it.

- **AC-22.4.2:** Given a PlatformAdmin clicks "Admin", When the route loads, Then they see an admin console landing page with a section/card for "Landlord Invitations".

- **AC-22.4.3:** Given a PlatformAdmin on the Landlord Invitations page, When the page loads, Then it lists all landlord invitations (those with `AccountId = null`) with columns: email, created at, expires at, status (Pending / Used / Expired), invited-by.

- **AC-22.4.4:** Given the list view, When the PlatformAdmin clicks "Invite New Landlord", Then a dialog or inline form appears asking only for an email address. Submitting calls `POST /api/v1/admin/landlord-invitations`.

- **AC-22.4.5:** Given a successful invitation creation, When the response returns, Then the new row appears in the list with status "Pending" and a success snackbar confirms the email was sent.

- **AC-22.4.6:** Given an expired landlord invitation in the list, When the PlatformAdmin clicks "Resend", Then the existing `POST /api/v1/invitations/{id}/resend` endpoint is called (extended to permit PlatformAdmin to resend landlord invitations), a new invitation is created with a fresh expiry, and the list refreshes.

- **AC-22.4.7:** Given a non-PlatformAdmin user, When they navigate directly to `/admin` (deep link), Then the Angular route guard redirects them away (to their normal dashboard).

- **AC-22.4.8:** Given form validation, When the email field is empty or malformed, Then the submit button is disabled and a validation error is shown — matching existing form patterns (`shared/components/...`).

- **AC-22.4.9:** Given the admin console, When viewed on desktop (the expected platform for admin work), Then it follows existing Upkeep visual language: Angular Material components, list/table patterns matching settings pages, "obvious not clever" copy.

**Technical Notes:**

- Frontend: new feature folder `frontend/src/app/features/admin/` with subfolders for components, services, store, routes (per `features/{name}/` pattern).
- New store: `admin.store.ts` using `signalStore()` — state for invitations list, loading flag, error state.
- New service: `admin.service.ts` wrapping the generated API client calls for `/api/v1/admin/landlord-invitations` and the existing `/api/v1/invitations/{id}/resend` (regenerate NSwag client after 22.2 lands).
- Route registration in `app.routes.ts`: `/admin` path with `platformAdminGuard` (new functional guard reading the PlatformAdmin claim from the auth service).
- Permission service / auth service exposes `isPlatformAdmin` signal so nav and guards can read it reactively.
- Nav update: conditionally render "Admin" link in the main side nav using the auth service's `isPlatformAdmin` signal — keep it visually distinct (small icon, separator from per-account nav items) so it's clear this is a platform-level area.
- Component sketch:
  - `admin-landing.component.ts` (route landing)
  - `landlord-invitations-list.component.ts` (table/list)
  - `create-landlord-invitation-dialog.component.ts` (modal form)
- Resend endpoint authorization: the existing `[Authorize(Policy = "CanManageUsers")]` on the resend route must also accept PlatformAdmin for landlord invitations specifically — implement by checking the invitation type in the handler and allowing either policy, OR by adding a parallel admin route. (Decision deferred to implementation — `/create-story` for 22.4 should call this out.)
- E2E test (Playwright): log in as `claude@claude.com` (now PlatformAdmin per 22.1), navigate to `/admin`, create a landlord invitation, verify it appears in the list and MailHog received the email.
- Unit tests (Vitest): store/service/component coverage per project testing rules (`feedback_testing_pyramid`).

---

## Cross-Reference Validation

| FR | Story | Verified |
|----|-------|----------|
| FR-LP1 | 22.2 (API), 22.4 (UI) | ✓ |
| FR-LP2 | 22.3 (existing handler verified + tested) | ✓ |
| FR-LP3 | 22.2 (distinct email template) | ✓ |
| FR-LP4 | 22.1 (role infra), 22.2 (policy on endpoint) | ✓ |
| FR-LP5 | 22.4 (list + resend in UI) | ✓ |
| FR-LP6 | 22.3 (regression tests for tenant + co-owner accept) | ✓ |
| NFR-LP1 | 22.1, 22.2 | ✓ |
| NFR-LP2 | 22.2 AC-22.2.8 (handler-level seam) | ✓ |
| NFR-LP3 | 22.3 AC-22.3.2, AC-22.3.7 | ✓ |
| NFR-LP4 | 22.1 AC-22.1.3 | ✓ |

**No orphaned requirements. Epic ordering respects dependencies (22.1 → 22.2 → 22.3 / 22.4).**

---

## Out of Scope (Deliberate)

The following are intentionally **not** in this epic. They belong to later epics or v1.0:

- **Public self-service signup** (`POST /api/v1/signup` with no PlatformAdmin gate) — NFR-LP2 leaves the seam; the actual public endpoint, including email verification, terms acceptance, and bot protection (CAPTCHA / rate limit), is v1.0 work.
- **Stripe billing on new account creation** — when a landlord signs up, Stripe customer creation / trial start / subscription gating lives in the Stripe epic (per PRD §Stripe Integration FR78-FR81).
- **Email verification on the new landlord's account** — current behavior pre-confirms email on invitation acceptance (mirrors existing tenant/co-owner flow). v1.0 self-service signup will require true email verification.
- **Account deletion / decommissioning** — needed eventually for beta wind-down or churned customers, but separate concern.
- **Multi-PlatformAdmin support** — only `claude@claude.com` is seeded as PlatformAdmin. A UI to grant PlatformAdmin to other users is not needed yet (and adds attack surface). If/when needed, it gets its own story.

---

_Authored 2026-05-26 by Dave + Claude (create-epics skill)_
_Implementation order: 22.1 → 22.2 → 22.3 → 22.4_
_Run `/orchestrate` to execute the epic via the story-cycle workflow._
