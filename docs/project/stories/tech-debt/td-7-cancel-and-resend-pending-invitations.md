# Story TD.7: Cancel and Resend Pending Landlord Invitations

Status: pending

## Story

As the platform owner onboarding beta landlords,
I want to cancel or resend a **pending** landlord invitation,
so that a bounced or mistyped invitation can be fixed immediately instead of freezing that email address for 24 hours.

## Context — the incident that produced this story (2026-08-22)

A landlord invitation to `test-landlord.one@upkeep-io.dev` was created at `23:38:04Z`. SendGrid accepted it and the recipient MX rejected it with `554 5.7.1 Relay access denied` (the domain's MX pointed at a forwarding service with no matching alias — see `docs/email-infrastructure.md`). The email never arrived, and the system offered **no way to recover**:

- **Resend was refused** — `ResendLandlordInvitation.cs:78-84` throws `"Can only resend expired invitations"` while `ExpiresAt >= UtcNow`.
- **Re-inviting was refused** — `CreateLandlordInvitation.cs:70-79` throws `"This email already has a pending invitation"`.
- **The UI offered no action at all** — `landlord-invitations-list.component.ts:87` renders the Resend button only when `status === 'Expired'`.

The only escape was a manual `DELETE` against the staging database. For a beta landlord who receives a typo'd invitation, the product answer today is "wait until tomorrow" — unacceptable for the onboarding path that Epic 22 exists to serve.

## Acceptance Criteria

1. **AC-TD.7.1 — Resend is permitted on a Pending invitation.**
   **Given** a landlord invitation with `AccountId = null`, `UsedAt = null`, and `ExpiresAt > now` (status `Pending`),
   **When** a PlatformAdmin calls `POST /api/v1/admin/landlord-invitations/{id}/resend`,
   **Then** the API returns `201 Created`, a **new** `Invitation` row is persisted with a fresh code and `ExpiresAt = now + 24h`, and `SendLandlordInvitationEmailAsync` is invoked exactly once.

2. **AC-TD.7.2 — The superseded invitation is invalidated.**
   **Given** AC-TD.7.1 has occurred,
   **Then** the original invitation's `ExpiresAt` is set to `now` (or earlier) so its status derives as `Expired` and **its code can no longer be accepted** — accepting the old code returns `400` with `"This invitation has expired"`. Exactly one `Pending` invitation exists for that email afterward, preserving the `CreateLandlordInvitation.cs:70-79` invariant. The original row is **not** deleted; the failed attempt remains visible as history.

3. **AC-TD.7.3 — Resend on a used invitation is still refused.**
   **Given** an invitation with `UsedAt != null`,
   **When** resend is called,
   **Then** the API returns `400` with `"Cannot resend an invitation that has already been used"` (existing guard at `ResendLandlordInvitation.cs:67-73` is unchanged).

4. **AC-TD.7.4 — Resend on an already-expired invitation still works.**
   **Given** an invitation with `ExpiresAt < now` and `UsedAt = null`,
   **When** resend is called,
   **Then** behavior is unchanged from today: `201 Created` with a fresh invitation. (Regression guard — this story widens the gate, it does not move it.)

5. **AC-TD.7.5 — A pending invitation can be cancelled.**
   **Given** a landlord invitation with `AccountId = null` and `UsedAt = null`,
   **When** a PlatformAdmin calls `DELETE /api/v1/admin/landlord-invitations/{id}`,
   **Then** the API returns `204 No Content`, the invitation's `ExpiresAt` is set to `now` so it derives as `Expired`, its code is no longer acceptable, and the email address is immediately free — a subsequent `POST /api/v1/admin/landlord-invitations` for the same email returns `201`, not `400`.

6. **AC-TD.7.6 — Cancelling a used invitation is refused.**
   **Given** an invitation with `UsedAt != null` (an account was already provisioned from it),
   **When** cancel is called,
   **Then** the API returns `400` with `"Cannot cancel an invitation that has already been used"`. Cancelling an invitation must never affect the account created from it.

7. **AC-TD.7.7 — Both endpoints are PlatformAdmin-gated.**
   **Given** a non-PlatformAdmin caller (Owner, Contributor, Tenant) or an unauthenticated request,
   **When** either the resend or cancel endpoint is called,
   **Then** the API returns `403` or `401` respectively, enforced by the class-level `[Authorize(Policy = "CanInviteLandlords")]` on `AdminLandlordInvitationsController` — no handler code executes.

8. **AC-TD.7.8 — Admin console exposes both actions on Pending rows.**
   **Given** the Landlord Invitations table at `/admin`,
   **When** a row's status is `Pending`,
   **Then** that row shows both a **Resend** and a **Cancel** action. `Expired` rows keep **Resend** only. `Accepted` rows show no actions (unchanged).

9. **AC-TD.7.9 — Cancel is confirmed before it fires.**
   **Given** a PlatformAdmin clicks **Cancel** on a pending row,
   **When** the click is handled,
   **Then** a confirmation dialog appears naming the invitation's email; confirming issues the DELETE, refreshes the list, and shows a success snackbar; dismissing performs no request.

10. **AC-TD.7.10 — Account-scoped invitations are untouched.**
    **Given** the existing co-owner/tenant endpoints (`POST /api/v1/invitations`, `POST /api/v1/invitations/{id}/resend`),
    **When** exercised after this story ships,
    **Then** their behavior and their existing test suites are unchanged. This story touches the **landlord** (null-`AccountId`) path only. Widening the account-scoped resend gate is explicitly out of scope.

11. **AC-TD.7.11 — Logging carries no PII.**
    **Given** any resend or cancel operation,
    **When** a structured log entry is emitted,
    **Then** it carries no email, invitation id, account id, or user id — consistent with the CWE-359 / cleartext-storage rules that stripped identifiers from Stories 22-1 through 22-4. A bare event log (`"Landlord invitation cancelled"`) is the established pattern (`ResendLandlordInvitation.cs:107`).

## Tasks / Subtasks

- [ ] **Task 1: Widen the resend gate** (AC: #1, #2, #3, #4)
  - [ ] 1.1 In `backend/src/PropertyManager.Application/Invitations/ResendLandlordInvitation.cs`, delete the `ExpiresAt >= DateTime.UtcNow` guard (lines 78-84).
  - [ ] 1.2 Before `SaveChangesAsync`, set `original.ExpiresAt = DateTime.UtcNow` so the superseded row derives as `Expired` and its code dies with it.
  - [ ] 1.3 Keep the `UsedAt != null` guard exactly as-is.
- [ ] **Task 2: Add the cancel command** (AC: #5, #6, #11)
  - [ ] 2.1 New `backend/src/PropertyManager.Application/Invitations/CancelLandlordInvitation.cs` — `CancelLandlordInvitationCommand(Guid InvitationId)`, handler mirrors the `ResendLandlordInvitation` lookup (`Id == request.InvitationId && AccountId == null`, `NotFoundException` when absent).
  - [ ] 2.2 Guard `UsedAt != null` → `ValidationException`.
  - [ ] 2.3 Set `ExpiresAt = DateTime.UtcNow`, save, log without identifiers.
- [ ] **Task 3: Controller actions** (AC: #7)
  - [ ] 3.1 `AdminLandlordInvitationsController` — add `[HttpDelete("{id:guid}")]` returning `204`, mirroring the existing resend action's `FluentValidation.ValidationException` → `ValidationProblemDetails` try/catch (lines 71-95).
  - [ ] 3.2 `[ProducesResponseType]` for 204 / 400 / 401 / 403 / 404.
- [ ] **Task 4: Regenerate the API client**
  - [ ] 4.1 `cd frontend && npm run generate-api` (API must be running) — adds the delete method to `api.service.ts`.
- [ ] **Task 5: Admin console actions** (AC: #8, #9)
  - [ ] 5.1 `admin.store.ts` — add a `cancelInvitation` rxMethod following the existing `resendInvitation` shape (snackbar + `reloadInvitations()` + error extraction from `error.errors`/`error.title`).
  - [ ] 5.2 `landlord-invitations-list.component.ts:87` — show Resend for `Pending` **and** `Expired`; add a Cancel button for `Pending`.
  - [ ] 5.3 Confirmation dialog before cancel — reuse the project's existing confirm-dialog pattern rather than inventing one.
  - [ ] 5.4 `data-testid` attributes on both actions for E2E targeting.
- [ ] **Task 6: Backend tests** (AC: all)
  - [ ] 6.1 Unit: `ResendLandlordInvitationTests` — pending resend succeeds; original is expired afterward; used still refused; expired still works.
  - [ ] 6.2 Unit: new `CancelLandlordInvitationTests` — cancel expires the row; used refused; missing → `NotFoundException`; account-scoped invitation not found via this path.
  - [ ] 6.3 Integration: `AdminLandlordInvitationsControllerTests` — cancel then re-invite the same email returns `201` (the incident scenario, end to end); policy matrix for both endpoints (401/403).
  - [ ] 6.4 Integration: after a pending resend, accepting the **old** code returns `400`.
- [ ] **Task 7: Frontend tests** (AC: #8, #9)
  - [ ] 7.1 `admin.store.spec.ts` — cancel success/failure paths.
  - [ ] 7.2 `landlord-invitations-list.component.spec.ts` — action visibility matrix across the three statuses; confirm-dialog wiring (confirm fires request, dismiss does not).
- [ ] **Task 8: E2E** (AC: #8, #9)
  - [ ] 8.1 Extend the admin console spec: invite a unique address → cancel it → re-invite the same address succeeds. Use `Date.now()`-suffixed emails per the E2E isolation rules in `CLAUDE.md`.

## Dev Notes

### Why expire rather than delete

Setting `ExpiresAt = now` reuses the existing status derivation (`Pending`/`Expired`/`Accepted`, `GetAccountInvitations.cs:71-76`) and needs **no migration** — there is no `RevokedAt`/`CancelledAt` column and adding one would drag an EF migration into a tech-debt story. It also preserves history: the admin console keeps showing the failed attempt instead of erasing evidence, which is exactly what would have shortened the 2026-08-22 debugging session. The trade-off is that "cancelled" and "naturally expired" look identical in the UI; accept that for now and revisit if the audit trail ever matters.

### Verified codebase facts

| Fact | Evidence |
|---|---|
| Resend refuses non-expired invitations | `ResendLandlordInvitation.cs:78-84` |
| Resend already refuses used invitations | `ResendLandlordInvitation.cs:67-73` |
| Resend creates a **new** row (does not mutate the original) | `ResendLandlordInvitation.cs:88-101` |
| Create refuses when a pending invitation exists (any flavor) | `CreateLandlordInvitation.cs:70-79` |
| Accept rejects expired codes | `AcceptInvitation.cs:75-82` |
| Landlord invitations are the `AccountId == null` rows | `CreateLandlordInvitation.cs:86-95` |
| `Invitation` has no global query filter — safe to query `AccountId == null` | `Invitation.cs:43`; no `HasQueryFilter` in `AppDbContext` |
| Controller is class-level policy-gated | `AdminLandlordInvitationsController.cs:15-18` |
| Resend button gated on Expired only | `landlord-invitations-list.component.ts:87` |
| Store/dialog/snackbar patterns to copy | `frontend/src/app/features/admin/stores/admin.store.ts` |

### Test Scope

| Pyramid level | Required? | Justification |
|---|---|---|
| **Unit (backend)** | **YES** | New cancel handler plus changed resend semantics (supersession) are real logic. `Mock<IAppDbContext>` + `MockQueryable.Moq`. |
| **Integration (backend)** | **YES** | The bug is a cross-handler interaction — cancel must unblock create, and a superseded code must fail at accept. Only `WebApplicationFactory` proves that. |
| **Unit (frontend)** | **YES** | Action-visibility matrix and confirm-dialog wiring are pure component logic. |
| **E2E** | **YES** | The recovery path is the story's entire point; per `feedback_testing_pyramid`, a full-stack story gets all three levels. |

### Critical implementation rules

- Backend: file-scoped namespaces, records for commands, `DateTime.UtcNow`, `CancellationToken` threaded, `IAppDbContext` directly, `[ProducesResponseType]` on actions. No try/catch in controllers except the established `ValidationException` → `ValidationProblemDetails` shape.
- Frontend: standalone components, `inject()`, `@if`/`@for`, signal store with `rxMethod`, `MatSnackBar` feedback, Prettier `singleQuote` / `printWidth: 100`.
- Logging: no email, no ids, not even masked (CWE-359 + `cs/cleartext-storage-of-sensitive-information` both block merges).

### Related

- `docs/email-infrastructure.md` — the delivery architecture whose failure exposed this gap
- `td-8-sendgrid-event-webhook.md` — makes the bounce *visible*; this story makes it *recoverable*. They are complementary and can ship in either order.
