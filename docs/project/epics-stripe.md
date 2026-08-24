# Stripe Subscription Billing - Epic Breakdown

**Author:** Dave
**Date:** 2026-08-06
**Version:** 1.0
**Source PRD:** `prd.md` — FR78–FR81, NFR29

---

## Overview

This epic gives landlord accounts a paid subscription managed through Stripe. It
is the last remaining capability between Upkeep and the ability to take money
from a beta user.

Everything here is deliberately boring. Stripe Checkout for signup, Stripe
Billing Portal for self-service management, one webhook endpoint for lifecycle
events, and a policy that gates access on subscription status. No custom payment
UI, no card handling in our own forms, no PCI surface beyond a redirect.

**Sequencing:** the scope decision below is made now, in writing. The
implementation begins only after the Phase 2 loop validation is complete and its
blocking bugs are cleared — see `consultant-eval-2026-08-06.md` §5. This epic
exists so that Stripe stops being an unbounded unknown, not so that it gets built
first.

### Scope boundary — read this before estimating

**In scope:** landlord subscribes → landlord pays monthly → subscription status
gates access to the landlord workspace.

**Explicitly out of scope, and not to be reintroduced:**

| Excluded | Why |
|---|---|
| **Stripe Connect** | Onboarding, KYC, payouts, money movement between parties we do not control. A different product with a regulatory surface. |
| **Tenant rent payments** | PRD "Future State — Tenant Portal Phase 3." This is what Connect would be *for*. Revisit only after paying users ask for it. |
| **Tenant-side billing of any kind** | Tenants are free users. They are the distribution mechanism, not a revenue line. |
| **Per-unit / metered pricing** | Flat plan for beta. Per-unit billing adds proration, usage reporting, and mid-cycle recalculation for no beta value. |
| **Dunning email sequences** | Stripe's built-in dunning is sufficient at beta scale. |
| **Annual plans, coupons UI, multi-currency** | Not needed to prove someone will pay. |

The Connect exclusion is the reason this epic is small. It is also why
TurboTenant, Baselane and Avail can be free to landlords — payment flow is their
revenue model, not ours. We are charging for the vendor-management and
work-order capability the affordable tier lacks (see
`archive/research/market-property-management-saas-research-2026-01-31.md`).

### Open product decisions — Dave to confirm before Story 24.1

These are business decisions, not engineering ones. Defaults proposed:

| Decision | Proposed default | Notes |
|---|---|---|
| Price point | **$29/mo flat** | Market research identifies $20–40/mo "comprehensive + affordable" as the opportunity zone. DoorLoop starts at $69; free tiers are feature-thin. |
| Trial | **30-day trial, card required at signup** | Card-required trial filters tyre-kickers and removes a second conversion step later. |
| Beta users | **Comped via Stripe coupon, not a code path** | Keep the billing logic identical for everyone; handle beta generosity in the Stripe dashboard. |
| Grace period on failed payment | **14 days** | Generous. Beta users' cards will fail for benign reasons and we do not want to lock a landlord out of their tax records. |
| Tenant impact when landlord lapses | **None during grace; read-only after** | Tenants must never lose access to their own submitted maintenance requests. Data hostage situations are unacceptable. |

---

## Epic Summary

| Epic | Name | Stories | Description |
|------|------|---------|-------------|
| 24 | Stripe Subscription Billing | 5 | Subscription model, Checkout, webhooks, access gating, billing management UI |

---

## Functional Requirements Coverage

| FR | Description | Story |
|----|-------------|-------|
| FR78 | Landlord accounts have a subscription plan managed via Stripe | 24.1, 24.2 |
| FR79 | Primary owner can manage billing (update payment method, view invoices) | 24.5 |
| FR80 | Subscription status gates access to the platform (grace period for lapses) | 24.4 |
| FR81 | Stripe webhooks update account status on payment events | 24.3 |

| NFR | Description | Story |
|-----|-------------|-------|
| NFR29 | Stripe webhook signatures verified to prevent spoofing | 24.3 |
| NFR10 | Stripe secrets in environment variables, never in code | 24.1 |
| NFR12 | Input validation on all endpoints | 24.2, 24.5 |
| NFR28 | Tenant role unaffected by landlord billing state (no cross-role leakage) | 24.4 |

---

## Epic 24: Stripe Subscription Billing

### Objective

A landlord can start a subscription, pay for it monthly, manage their payment
method and invoices, and lose access if they stop paying — with a grace period,
and without tenants ever being locked out of their own maintenance history.

### Dependency Chain

```
24.1 (domain + config) ──┬──→ 24.2 (Checkout)  ──┬──→ 24.5 (Billing UI)
                         └──→ 24.3 (Webhooks) ──┴──→ 24.4 (Access gating)
```

24.2 and 24.3 can run in parallel once 24.1 lands. 24.4 requires 24.3 (it reads
the status webhooks write). 24.5 requires both 24.2 and 24.3.

**24.2 + 24.3 alone make the feature demonstrable in Stripe test mode**, before
any UI work — a subscription can be created and its status observed in the
database.

---

### Story 24.1: Subscription Domain Model & Stripe Configuration

**User Story:** As a developer, I want subscription state persisted on the account and the Stripe SDK configured, so that billing features have a foundation to build on.

**Source:** FR78, NFR10

**Acceptance Criteria:**

- **AC-24.1.1:** Given the `Account` entity, When the migration runs, Then it has nullable fields `StripeCustomerId`, `StripeSubscriptionId`, `SubscriptionStatus`, `CurrentPeriodEnd` (UTC), and `TrialEndsAt` (UTC).

- **AC-24.1.2:** Given `SubscriptionStatus`, When persisted, Then it stores Stripe's own status vocabulary as a string — `trialing`, `active`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid` — plus a local `none` for accounts that have never subscribed. Do not invent a parallel status enum; mirroring Stripe removes an entire class of mapping bug.

- **AC-24.1.3:** Given an account created before this epic, When the migration runs, Then it is backfilled with `SubscriptionStatus = "none"` and null Stripe identifiers.

- **AC-24.1.4:** Given application configuration, When the app starts, Then `Stripe__SecretKey`, `Stripe__PublishableKey`, `Stripe__WebhookSecret`, and `Stripe__PriceId` are read from environment variables and are absent from source control.

- **AC-24.1.5:** Given the app starts in any environment other than Development, When a Stripe setting is missing, Then startup fails loudly with a clear message rather than deferring the failure to first use.

- **AC-24.1.6:** Given the `Stripe.net` SDK, When registered in DI, Then a typed `IStripeService` abstraction wraps it, so that handlers depend on our interface and unit tests do not require network access or the Stripe SDK types.

**Technical Notes:**

- Add `Stripe.net` to `PropertyManager.Infrastructure`. The Domain layer must not reference it (Clean Architecture — Domain has zero external dependencies).
- `Account` entity lives in `PropertyManager.Domain`; the new fields are primitives and strings only. No Stripe types cross the boundary.
- `IStripeService` in `Application/Common/Interfaces/`, implementation in `Infrastructure/Services/StripeService.cs`. Methods needed across this epic: `CreateCheckoutSessionAsync`, `CreateBillingPortalSessionAsync`, `ConstructWebhookEvent`.
- Migration: `dotnet ef migrations add AddSubscriptionToAccount --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- `render.yaml`: add the four `Stripe__*` env keys with `sync: false` so they are set in the Render dashboard rather than committed.
- `.env.example`: add the four keys with placeholder values and a comment pointing at the Stripe dashboard test-mode keys.
- Unit tests: migration applies cleanly; config validation throws when a key is missing in Production.

---

### Story 24.2: Subscribe via Stripe Checkout

**User Story:** As a landlord, I want to start a subscription with a credit card, so that I can keep using Upkeep after my trial.

**Source:** FR78, NFR12

**Acceptance Criteria:**

- **AC-24.2.1:** Given an authenticated account Owner without an active subscription, When they call `POST /api/v1/billing/checkout-session`, Then a Stripe Checkout Session is created in `subscription` mode for the configured price, and the response returns the session URL.

- **AC-24.2.2:** Given an account with no `StripeCustomerId`, When a checkout session is created, Then a Stripe Customer is created first, its id persisted to the account, and the session is bound to that customer — so a landlord never accumulates duplicate Stripe customers.

- **AC-24.2.3:** Given the checkout session, When created, Then it carries `client_reference_id` (or metadata) containing the `AccountId`, so the webhook handler can associate the resulting subscription with the correct account without guessing from email.

- **AC-24.2.4:** Given a configured trial period, When the subscription is created, Then it includes `trial_period_days` per the configured value, and payment method collection is required at signup.

- **AC-24.2.5:** Given a user whose role is Contributor or Tenant, When they call the checkout endpoint, Then the API returns 403 Forbidden. Only the account Owner manages billing.

- **AC-24.2.6:** Given an account that already has a `SubscriptionStatus` of `active` or `trialing`, When the checkout endpoint is called, Then the API returns 400 with a message directing the user to the billing portal instead.

- **AC-24.2.7:** Given a completed checkout, When Stripe redirects, Then success and cancel URLs return the user to the application at defined routes, and the success page communicates that activation may take a moment (status is authoritative only once the webhook lands — see 24.3).

**Technical Notes:**

- New file: `Application/Billing/CreateCheckoutSession.cs` — command, handler, result record, following single-file CQRS convention.
- Validator: `CreateCheckoutSessionValidator.cs`.
- New controller: `Api/Controllers/BillingController.cs`, `[Route("api/v1")]`, actions under `billing/`. Request/Response records at the bottom of the controller file per convention.
- Owner-only enforcement: reuse the existing permission infrastructure from Epic 19 rather than checking roles inline.
- **Do not mark the account active on redirect.** The redirect is a UX event and can be forged or simply missed. The webhook is the only source of truth for subscription state.
- Unit tests: handler creates customer when absent, reuses when present, throws on already-subscribed, forbids non-Owner.
- Integration test via `WebApplicationFactory` with `IStripeService` mocked: Owner → 200 with URL; Contributor → 403; already-active → 400.

---

### Story 24.3: Stripe Webhook Handler

**User Story:** As the platform, I want to receive and verify Stripe lifecycle events, so that account subscription status reflects reality even when the user closes the browser mid-checkout.

**Source:** FR81, NFR29

**Acceptance Criteria:**

- **AC-24.3.1:** Given a `POST /api/v1/billing/webhook` request, When it arrives, Then the endpoint is **anonymous** (no JWT — Stripe cannot authenticate) and excluded from any auth-required global policy.

- **AC-24.3.2:** Given an incoming webhook, When processed, Then its `Stripe-Signature` header is verified against `Stripe__WebhookSecret` using the SDK's signature construction. **An invalid or missing signature returns 400 and the payload is not processed.** (NFR29)

- **AC-24.3.3:** Given webhook signature verification, When the request body is read, Then the raw body is used — not a deserialized-and-reserialized model — because re-serialization invalidates the signature.

- **AC-24.3.4:** Given the events `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`, When received, Then the corresponding account's `SubscriptionStatus`, `StripeSubscriptionId`, and `CurrentPeriodEnd` are updated to match the event payload.

- **AC-24.3.5:** Given `checkout.session.completed`, When received, Then the account is located via `client_reference_id` and its `StripeCustomerId` and `StripeSubscriptionId` are persisted.

- **AC-24.3.6:** Given `invoice.payment_failed`, When received, Then the account status reflects Stripe's resulting subscription status (typically `past_due`) and the grace period clock starts from that moment.

- **AC-24.3.7:** Given the same event delivered more than once, When processed a second time, Then the result is identical and no duplicate side effects occur. **Stripe retries and does not guarantee exactly-once delivery.**

- **AC-24.3.8:** Given events delivered out of order, When an event older than the currently stored state is processed, Then it does not overwrite newer state. Compare event timestamps or subscription `created`/period values before applying.

- **AC-24.3.9:** Given an unrecognized event type, When received, Then the endpoint returns 200 without error. Returning a non-2xx causes Stripe to retry indefinitely for events we do not care about.

- **AC-24.3.10:** Given webhook processing, When it logs, Then it logs the Stripe event id and event type only. **No customer email, no account id, no subscription id.** See `project-context.md` — CodeQL blocks merges on logged identifiers, and the custom masking helpers are not recognized as safe sinks.

**Technical Notes:**

- New file: `Application/Billing/HandleStripeWebhook.cs` — command + handler.
- Controller action must read the raw body: `using var reader = new StreamReader(HttpContext.Request.Body); var json = await reader.ReadToEndAsync();` then `EventUtility.ConstructEvent(json, signatureHeader, webhookSecret)`.
- The action needs `[AllowAnonymous]` and must be exempt from the rate limiter added in Epic 14 (story 14-3) — or given a generous dedicated limit. Stripe bursts on retry.
- Idempotency: simplest sufficient approach at beta scale is a `ProcessedStripeEvents` table keyed on the Stripe event id, checked before applying. Cheaper than reasoning about per-event idempotency individually.
- Ordering: `customer.subscription.updated` carries the full subscription object; compare its `current_period_end` against stored `CurrentPeriodEnd` and skip if not newer.
- Local development: `stripe listen --forward-to localhost:5292/api/v1/billing/webhook` produces a webhook secret for the local session. Document this in the README's dev setup.
- Unit tests: signature valid/invalid, each handled event type, replay produces no change, out-of-order event ignored, unknown event returns 200.
- Integration test: post a fixture payload with a correctly computed test signature; assert account state.

---

### Story 24.4: Subscription Access Gating with Grace Period

**User Story:** As the business, I want access to the landlord workspace to depend on an active subscription, so that the product has a revenue model — without ever trapping a tenant's data behind a landlord's billing problem.

**Source:** FR80, NFR28

**Acceptance Criteria:**

- **AC-24.4.1:** Given an account with status `active` or `trialing`, When any landlord endpoint is called, Then access proceeds normally.

- **AC-24.4.2:** Given an account with status `past_due`, When the grace period (configured, default 14 days from the failure) has **not** elapsed, Then access proceeds normally and the API response includes a warning indicator the frontend can surface.

- **AC-24.4.3:** Given an account whose grace period **has** elapsed, or whose status is `canceled` / `unpaid`, When a landlord attempts a **write** operation, Then the API returns 402 Payment Required with a ProblemDetails body directing them to billing.

- **AC-24.4.4:** Given a lapsed account, When a landlord attempts a **read** operation, Then it succeeds. **A landlord must always be able to reach their own tax records and export their data.** Lapsing suspends the service, it does not confiscate the data.

- **AC-24.4.5:** Given a lapsed account, When the landlord calls billing endpoints (checkout session, billing portal), Then those always succeed regardless of status — the path to fixing the problem is never gated behind the problem.

- **AC-24.4.6:** Given a tenant whose landlord's account has lapsed, When the tenant logs in, Then they retain read access to their property and all maintenance requests they have submitted. Submitting a **new** request is blocked with a message directing them to contact their landlord. (NFR28)

- **AC-24.4.7:** Given a user with the PlatformAdmin claim, When gating is evaluated, Then they are exempt. The platform operator does not lock themselves out.

- **AC-24.4.8:** Given an account with status `none` that has never subscribed, When gating is evaluated, Then it is treated as lapsed for writes — with messaging that distinguishes "start your subscription" from "your payment failed."

**Technical Notes:**

- Implement as an authorization policy or a MediatR-adjacent check, not scattered `if` statements in handlers. A single enforcement point is the difference between this being maintainable and being a source of bugs forever.
- Write vs read discrimination: HTTP verb is the cheapest correct signal (`GET`/`HEAD` read; everything else write). Prefer that over enumerating endpoints.
- 402 Payment Required is the semantically correct status. Map it through the existing global exception middleware to RFC 7807 ProblemDetails so the shape matches every other error in the API.
- The frontend needs to distinguish 402 from 401/403 in the HTTP interceptor and route to billing rather than to login. Coordinate with 24.5.
- Grace period start: derive from the subscription's `past_due` transition rather than storing a separate timestamp where possible; if a stored field is needed, add `PastDueSince` in this story's migration.
- Unit tests for every status × read/write × role combination. This is the highest-risk logic in the epic — a bug here either gives the product away or locks out a paying customer.
- E2E: lapsed landlord sees the paywall on write and can still export Schedule E; tenant of a lapsed landlord can still view request history.

---

### Story 24.5: Billing Management UI

**User Story:** As a landlord, I want to see my subscription status and manage my payment method and invoices, so that I can fix billing problems myself without emailing support.

**Source:** FR79

**Acceptance Criteria:**

- **AC-24.5.1:** Given an authenticated account Owner, When they call `POST /api/v1/billing/portal-session`, Then a Stripe Billing Portal session is created for their `StripeCustomerId` with a return URL back to the application, and the URL is returned.

- **AC-24.5.2:** Given an account with no `StripeCustomerId`, When the portal endpoint is called, Then the API returns 400 directing them to start a subscription first.

- **AC-24.5.3:** Given a Contributor or Tenant, When they call the portal endpoint, Then the API returns 403. Billing is Owner-only.

- **AC-24.5.4:** Given a landlord in the application, When they open a billing settings page, Then it displays current subscription status, next billing date (`CurrentPeriodEnd`), and trial end date when applicable.

- **AC-24.5.5:** Given the billing settings page, When the account is unsubscribed or lapsed, Then a primary action starts Checkout; when active, a primary action opens the Billing Portal.

- **AC-24.5.6:** Given an account in `past_due` within grace, When the landlord uses any part of the application, Then a persistent, dismissible banner communicates the payment problem and links to billing.

- **AC-24.5.7:** Given the frontend HTTP interceptor, When any API call returns 402, Then the user is routed to the billing page rather than to the login page.

- **AC-24.5.8:** Given the billing page, When rendered for a Tenant or Contributor, Then it is not present in navigation and direct navigation is blocked by a route guard.

**Technical Notes:**

- Feature folder `frontend/src/app/features/billing/` with `components/`, `stores/`, `services/` per convention.
- `billing.store.ts` using `signalStore()` with `withState`/`withComputed`/`withMethods`, `rxMethod` for async, `patchState` for updates. Follow the established store pattern exactly.
- Extend the existing functional `HttpInterceptorFn` for the 402 case — do not add a second interceptor.
- Subscription status belongs in auth/account state so the banner and route guards can read it without a fetch on every navigation. Coordinate with the Epic 19 auth state work.
- Regenerate the typed API client after the backend lands: `npm run generate-api`.
- The Billing Portal is a Stripe-hosted redirect. Do not build invoice lists or payment method forms — that is the entire reason for using the portal.
- Vitest specs for the store and the billing service. Playwright E2E: Owner reaches billing page and both CTAs produce a redirect URL (Stripe mocked at the service boundary).

---

## Definition of Done for Epic 24

Not "merged." Not "tests green."

> **A landlord who is not Dave has entered a credit card, has an `active`
> subscription visible in the Stripe dashboard, and is using the product.**

## Rollout Notes

- Build and verify entirely in **Stripe test mode**. Do not create live-mode keys
  until Story 24.4 has been exercised end to end.
- Beta landlords onboarded before pricing is finalized should be comped with a
  Stripe coupon rather than a code branch — keep one billing path for everyone.
- Verify the webhook endpoint is reachable from the public internet on Render
  *before* depending on it. A webhook that silently 404s in production leaves
  every subscription stuck in `none` with no visible error on the landlord's side.
