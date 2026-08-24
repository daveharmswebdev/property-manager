# Story TD.8: SendGrid Event Webhook — Email Delivery Observability

Status: pending

## Story

As the platform owner,
I want SendGrid delivery events (bounce, blocked, dropped, deferred, delivered) posted back to the API, recorded, and surfaced next to the invitation that produced them,
so that a failed invitation announces itself instead of looking identical to one nobody has opened yet.

## Context — the incident that produced this story (2026-08-22)

An invitation to `test-landlord.one@upkeep-io.dev` was created, handed to SendGrid, and rejected by the recipient's mail server with `554 5.7.1 Relay access denied`. The application never learned any of it. The admin console showed `Pending` — indistinguishable from "sent fine, recipient hasn't clicked yet" — and the failure was only found by opening the SendGrid dashboard and reading the Activity Feed by hand. Every layer had recorded the truth; nothing carried it back into the product.

Two consequences worth stating plainly:

1. `POST /api/v1/admin/landlord-invitations` returning `201` proves only that **SendGrid accepted the handoff** (the send is awaited before the handler returns at `CreateLandlordInvitation.cs:99`, and `SmtpEmailService` has no try/catch, so a `201` means no SMTP exception). It says nothing about delivery.
2. SendGrid's Activity Feed retains events for **3 days** on the free plan. A bounce that happens during a quiet stretch is simply gone before anyone looks.

## Acceptance Criteria

1. **AC-TD.8.1 — The webhook endpoint accepts a signed SendGrid batch.**
   **Given** SendGrid's Event Webhook is configured to post to `POST /api/v1/webhooks/sendgrid`,
   **When** a batch arrives with valid `X-Twilio-Email-Event-Webhook-Signature` and `X-Twilio-Email-Event-Webhook-Timestamp` headers,
   **Then** the API returns `204 No Content` and one `EmailDeliveryEvent` row is persisted per event in the batch.

2. **AC-TD.8.2 — Signature verification is mandatory and correct.**
   **Given** a request whose body or headers have been tampered with, or which is signed by a different key,
   **When** it hits the endpoint,
   **Then** the API returns `403 Forbidden` and **no** rows are persisted. Verification is ECDSA-P256/SHA-256 over the concatenation `timestamp + rawRequestBody`, against the base64 `SubjectPublicKeyInfo` public key from SendGrid. The signature is DER-encoded, so .NET must verify with `DSASignatureFormat.Rfc3279DerSequence`:
   ```csharp
   using var ecdsa = ECDsa.Create();
   ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(publicKey), out _);
   var payload = Encoding.UTF8.GetBytes(timestamp + rawBody);
   var ok = ecdsa.VerifyData(payload, Convert.FromBase64String(signature),
                             HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
   ```

3. **AC-TD.8.3 — The raw body is verified byte-for-byte.**
   **Given** the endpoint action,
   **When** it reads the request,
   **Then** it reads the **raw** body (no `[FromBody]` model binding, no re-serialization, no trimming of leading/trailing whitespace or `\r\n`) before deserializing. Re-serialized JSON will not match the signature.

4. **AC-TD.8.4 — Stale requests are rejected.**
   **Given** a request whose `X-Twilio-Email-Event-Webhook-Timestamp` is more than 10 minutes from server time (either direction),
   **When** it hits the endpoint,
   **Then** the API returns `403` and nothing is persisted (replay protection).

5. **AC-TD.8.5 — Missing configuration fails closed.**
   **Given** the webhook public key is not configured,
   **When** a request arrives,
   **Then** the API returns `503 Service Unavailable`, logs a warning once, and persists nothing. An unverified event is **never** accepted.

6. **AC-TD.8.6 — Delivery events are persisted.**
   **Given** a verified batch,
   **Then** each event yields an `EmailDeliveryEvent` with: `Id`, `Email`, `EventType` (`delivered`, `bounce`, `blocked`, `dropped`, `deferred`, `processed`, …), `Reason` (nullable — e.g. `554 5.7.1 ... Relay access denied`), `SgEventId`, `SgMessageId` (nullable), `OccurredAt` (from the event `timestamp`), and `CreatedAt`. The entity has **no** `AccountId` and is **not** an `ITenantEntity` — these events cross account boundaries and must not be filtered by the tenant query filter.

7. **AC-TD.8.7 — Redelivery is idempotent.**
   **Given** SendGrid retries a batch (it retries on any non-2xx, and duplicates are normal even on success),
   **When** an event with an already-seen `SgEventId` arrives,
   **Then** it is ignored, no duplicate row is written, and the response is still `204`. Enforced by a unique index on `SgEventId`.

8. **AC-TD.8.8 — Unknown event types are tolerated.**
   **Given** a batch containing an event type the code does not model (`open`, `click`, `unsubscribe`, or anything SendGrid adds later),
   **When** it is processed,
   **Then** it is persisted with its raw `EventType` string (or skipped by an explicit allow-list) without throwing, and the rest of the batch still processes. One malformed event must never fail the batch.

9. **AC-TD.8.9 — The admin console shows delivery status.**
   **Given** the Landlord Invitations table at `/admin`,
   **When** delivery events exist for an invitation's email at or after that invitation's `CreatedAt`,
   **Then** the row shows the latest delivery outcome (e.g. **Delivered**, **Bounced**, **Blocked**) alongside the existing `Pending`/`Expired`/`Accepted` status, and a failure exposes its `Reason` on hover or in a detail affordance. An invitation with no events shows no delivery badge.

10. **AC-TD.8.10 — The endpoint is anonymous but not rate-limited into failure.**
    **Given** SendGrid cannot present a JWT,
    **When** the endpoint is registered,
    **Then** it is `[AllowAnonymous]` (authenticated by signature alone) and carries `[DisableRateLimiting]` so a burst of events cannot trip the global sliding-window limiter (`Program.cs:368-378`) and trigger SendGrid's retry-and-eventual-drop behavior.

11. **AC-TD.8.11 — Logging carries no PII.**
    **Given** any webhook processing,
    **When** structured logs are emitted,
    **Then** they carry event **counts** and **types** only — never the recipient email, not even masked (CWE-359 blocks the merge; Stories 22-1 through 22-4 all had identifiers stripped post-PR). The email lives in the database, which is the correct place for it. A failure log reads like `"SendGrid webhook processed. Events: {Count}, Failures: {FailureCount}"`.

12. **AC-TD.8.12 — Existing email paths are unchanged.**
    **Given** `SmtpEmailService` and every caller of `IEmailService`,
    **When** this story ships,
    **Then** none of them change. This story is purely additive observability.

## Tasks / Subtasks

- [ ] **Task 1: Domain + persistence** (AC: #6, #7)
  - [ ] 1.1 `backend/src/PropertyManager.Domain/Entities/EmailDeliveryEvent.cs` — plain entity, **not** `ITenantEntity`.
  - [ ] 1.2 Add `DbSet<EmailDeliveryEvent> EmailDeliveryEvents` to `IAppDbContext` and `AppDbContext`; configure a unique index on `SgEventId` and an index on `(Email, OccurredAt)` for the lookup in AC-TD.8.9.
  - [ ] 1.3 `dotnet ef migrations add AddEmailDeliveryEvents --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`, then `dotnet ef database update` and verify the schema locally before claiming the feature works.
- [ ] **Task 2: Signature verification** (AC: #2, #3, #4, #5)
  - [ ] 2.1 `backend/src/PropertyManager.Infrastructure/Email/SendGridWebhookVerifier.cs` implementing an interface defined in Application (dependency rule: Infrastructure implements, Application declares).
  - [ ] 2.2 Bind `SendGrid:EventWebhook:PublicKey` via options; fail closed when absent.
  - [ ] 2.3 Timestamp freshness window (10 minutes, configurable).
- [ ] **Task 3: Endpoint** (AC: #1, #8, #10)
  - [ ] 3.1 `backend/src/PropertyManager.Api/Controllers/SendGridWebhookController.cs` — `[Route("api/v1/webhooks/sendgrid")]`, `[AllowAnonymous]`, `[DisableRateLimiting]`.
  - [ ] 3.2 Read the raw body via `StreamReader` on `Request.Body` with **no** body-bound action parameter.
  - [ ] 3.3 Verify → deserialize → dispatch `RecordEmailDeliveryEventsCommand` → return `204`.
  - [ ] 3.4 Return `204` even on partially malformed batches; never surface an exception to SendGrid (a 5xx just triggers retries of an unprocessable payload).
- [ ] **Task 4: Handler** (AC: #6, #7, #8, #11)
  - [ ] 4.1 `RecordEmailDeliveryEvents.cs` in Application — filter already-seen `SgEventId`s in one query, insert the remainder, log counts only.
- [ ] **Task 5: Surface it in the admin console** (AC: #9)
  - [ ] 5.1 Extend `GetLandlordInvitations` to project the latest `EmailDeliveryEvent` per invitation email where `OccurredAt >= invitation.CreatedAt` (single grouped query — no N+1).
  - [ ] 5.2 Add `deliveryStatus` + `deliveryReason` to the response DTO; `npm run generate-api`.
  - [ ] 5.3 Render a delivery chip in `landlord-invitations-list.component.ts` next to the status chip; failure styling for bounce/blocked/dropped.
- [ ] **Task 6: Configuration + deployment**
  - [ ] 6.1 `render.yaml` — add `SendGrid__EventWebhook__PublicKey` with `sync: false` (dashboard-managed, like the other email secrets at lines 35-45).
  - [ ] 6.2 `.env.example` — document the key.
  - [ ] 6.3 In SendGrid: Settings → Mail Settings → Event Webhook → enable, point at `https://api.upkeep-io.dev/api/v1/webhooks/sendgrid`, enable Signed Event Webhook, subscribe to `delivered`, `bounce`, `blocked`, `dropped`, `deferred`.
  - [ ] 6.4 Document the whole thing in `docs/email-infrastructure.md`.
- [ ] **Task 7: Tests**
  - [ ] 7.1 Unit: verifier — valid signature passes; tampered body fails; wrong key fails; stale timestamp fails; missing key fails closed. Generate a throwaway P-256 keypair in the test to sign fixtures; never commit a real key.
  - [ ] 7.2 Unit: handler — new events inserted; duplicate `SgEventId` skipped; unknown event type tolerated.
  - [ ] 7.3 Integration: `WebApplicationFactory` — signed batch → `204` + rows; bad signature → `403` + no rows; replayed batch → `204` + no duplicates; endpoint reachable unauthenticated.
  - [ ] 7.4 Integration: an invitation plus a `bounce` event for its email surfaces `deliveryStatus = "Bounced"` from the list endpoint.
  - [ ] 7.5 Frontend unit: delivery chip rendering across delivered/bounced/none.

## Dev Notes

### Raw body is the whole trick

Signature verification is over `timestamp + rawBody`. Anything that reparses and re-serializes the JSON (including standard `[FromBody]` binding) changes the bytes and guarantees a mismatch. Read `Request.Body` directly and hold the exact string. SendGrid's own SDK docs make this the headline warning: *"It is important that the body of the request is verified raw, not after it was parsed as json"* — and *"be sure to not remove any leading/trailing whitespace characters (e.g. `\r\n`)."*

Headers (verified against SendGrid's SDK docs this turn):

| Header | Contents |
|---|---|
| `X-Twilio-Email-Event-Webhook-Signature` | base64 DER-encoded ECDSA signature |
| `X-Twilio-Email-Event-Webhook-Timestamp` | integer seconds, also part of the signed payload |

### A seam Epic 24 will reuse

Story `24-3-stripe-webhook-handler` needs the identical shape: anonymous endpoint, raw body, provider signature, idempotency on a provider event id, fast 2xx. Build this one so the raw-body-read and idempotency pieces are extractable rather than copy-pasted later. Do **not** over-abstract now — just avoid burying the pattern inside SendGrid-specific code.

### Verified codebase facts

| Fact | Evidence |
|---|---|
| `201` from create proves handoff only, not delivery | `CreateLandlordInvitation.cs:99` (send awaited), `SmtpEmailService.cs:50-60` (no try/catch) |
| Global sliding-window rate limiter exists and is bypassable per-endpoint | `Program.cs:320`, `:368-378`, `:419-421` |
| Rate limiting is already disabled in dev/CI via config | `RateLimiting:Disabled` |
| `IAppDbContext` exposes DbSets directly; no repository layer | `IAppDbContext.cs:14-35` |
| Invitation status derivation to sit alongside | `GetAccountInvitations.cs:71-76` |
| Email secrets are dashboard-managed, not in the repo | `render.yaml:35-45` (`sync: false`) |

### Test Scope

| Pyramid level | Required? | Justification |
|---|---|---|
| **Unit (backend)** | **YES** | Signature verification is cryptographic and security-relevant — every branch needs a test with locally generated keys. |
| **Integration (backend)** | **YES** | Raw-body handling only breaks when the real ASP.NET pipeline is involved; that is exactly the failure mode a unit test misses. |
| **Unit (frontend)** | **YES** | Delivery-chip rendering matrix. |
| **E2E** | **NO** | Playwright cannot produce a validly signed SendGrid batch, and stubbing one adds no confidence over the integration tests. Justified exception to the full-pyramid rule in `feedback_testing_pyramid`. |

### Related

- `docs/email-infrastructure.md` — architecture and the bounce runbook this story automates
- `td-7-cancel-and-resend-pending-invitations.md` — makes a bounced invitation recoverable; this story makes it visible
