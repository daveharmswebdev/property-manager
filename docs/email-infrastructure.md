# Email Infrastructure

How mail leaves Upkeep, how it comes back, and what to check when it doesn't.

Last verified: **2026-08-22**

## The short version

Two different services handle two different directions, and confusing them costs hours:

| Direction | Service | What it carries |
|---|---|---|
| **Outbound** | SendGrid (SMTP relay) | Invitations, email verification, password resets — everything the app sends |
| **Inbound** | Zoho Mail | The `@upkeep-io.dev` test-persona mailboxes |
| **Local dev** | MailHog | Everything; nothing leaves the machine |

Outbound and inbound share only a domain name. A working SendGrid account tells you nothing about whether mail can be *received*, which is precisely the trap documented in the incident log below.

```
  App (Render)                                    Test personas
       |                                                ^
       | SMTP :587                                      | IMAP/web
       v                                                |
   SendGrid  ---- internet ---->  Zoho MX (mx.zoho.com) +
   (relay)                        inbound for @upkeep-io.dev

  Local: App --> MailHog :1025  (read at http://localhost:8025)
```

## Outbound — SendGrid

Generic SMTP; nothing in the codebase is SendGrid-specific (`SmtpEmailService.cs`). The provider identity lives entirely in configuration.

| Setting | Production / staging value |
|---|---|
| `Email__Provider` | `Smtp` |
| `Email__SmtpHost` | `smtp.sendgrid.net` |
| `Email__SmtpPort` | `587` |
| `Email__SmtpUsername` | `apikey` — the literal word, not the key's name |
| `Email__SmtpPassword` | the SendGrid API key (`SG.…`) |
| `Email__EnableSsl` | `true` (required on 587) |
| `Email__FromEmail` | `noreply@upkeep-io.dev` |
| `Email__BaseUrl` | frontend origin — becomes the invite/reset link host |

**Where the values live:** `render.yaml:35-45` declares these with `sync: false`, meaning the real values are entered in the Render dashboard and are deliberately absent from the repo. Grepping the codebase for them finds nothing — that is by design, not a missing file.

Local defaults point at MailHog (`appsettings.json:9-15`: `localhost:1025`, no credentials, `EnableSsl: false`).

### Sending is fire-and-forget-shaped, but isn't

`SmtpEmailService` has **no try/catch**. An SMTP failure propagates out of the handler, so a `2xx` from an endpoint that sends mail proves the relay accepted the handoff. It does **not** prove delivery — see the incident log.

## Inbound — Zoho Mail

`upkeep-io.dev` MX points at Zoho (cutover 2026-08-22). Namecheap's Email Forwarding was used before that and is **no longer in the path**; the Redirect Email / catch-all settings there are inert while Mail Settings is `Custom MX`.

MX is exclusive — one service receives for the domain. Choosing Zoho means the Namecheap catch-all stops working, and vice versa.

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx.zoho.com` | 10 |
| MX | `@` | `mx2.zoho.com` | 20 |
| MX | `@` | `mx3.zoho.com` | 50 |

Zoho's free plan caps the domain at **5 users**, and the admin account consumes one — which is exactly why there are four test personas and not five.

## DNS reference

Current records on `upkeep-io.dev`:

| Record | Value | Purpose |
|---|---|---|
| MX ×3 | `mx.zoho.com` / `mx2` / `mx3` | Inbound to Zoho |
| TXT | `zoho-verification=zb75012605.zmverify.zoho.com` | Zoho domain ownership |
| CNAME `em3558` | `u57658848.wl099.sendgrid.net` | SendGrid link branding |
| CNAME `s1._domainkey` | `s1.domainkey.u57658848.wl099.sendgrid.net` | SendGrid DKIM |
| CNAME `s2._domainkey` | `s2.domainkey.u57658848.wl099.sendgrid.net` | SendGrid DKIM |
| TXT `_dmarc` | `v=DMARC1; p=none;` | DMARC, monitor-only |

### ⚠️ Open item: no SPF record

Namecheap auto-managed the old SPF record (`include:spf.efwd.registrar-servers.com`) and **deleted it** when Mail Settings switched from *Email Forwarding* to *Custom MX*. The domain currently publishes no SPF policy.

Add one TXT record at `@` — exactly one, never two (multiple SPF records are a permanent error that fails harder than none):

```
v=spf1 include:zoho.com include:sendgrid.net ~all
```

`zoho.com` covers mail sent from the Zoho mailboxes; `sendgrid.net` covers the app. DKIM is unaffected either way, and DMARC is `p=none`, so this is a deliverability improvement rather than an outage fix.

Verify with:

```bash
dig +short TXT upkeep-io.dev
dig +short MX upkeep-io.dev
```

## Test personas

Four mailboxes exist in Zoho for manual multi-role testing:

| Address | Role |
|---|---|
| `test-landlord.one@upkeep-io.dev` | Landlord (account Owner) |
| `test-landlord.two@upkeep-io.dev` | Landlord (account Owner) |
| `mock-renter.a@upkeep-io.dev` | Tenant |
| `mock-renter.b@upkeep-io.dev` | Tenant |

**Passwords are in `scratch.txt` at the repo root, which is gitignored** (`.gitignore:143`). They are deliberately not in this file.

How each persona gets provisioned:

- **Landlords** — invited from the Admin Console (`/admin` → *Invite New Landlord*) by a PlatformAdmin. The seeded `claude@claude.com` account carries that claim (`OwnerAccountSeeder.cs`, runs in all environments per `Program.cs:449`). Accepting creates a brand-new isolated account with role `Owner` and `EmailConfirmed = true` — there is no separate verification step.
- **Tenants** — invited by a landlord from a property's detail page, **not** from the Admin Console. A tenant invitation carries the `AccountId` and `PropertyId`, so it joins the landlord's existing account rather than creating one.

Invitation codes expire after **24 hours** and are single-use. Only the SHA-256 hash is stored, so the raw code exists **only in the email** — there is no way to recover a link from the database.

For throwaway personas beyond these four, use Gmail plus-aliases (`daveharmswebdev+whatever@gmail.com`). They work: Identity's default `AllowedUserNameCharacters` includes `+` (never overridden — `Program.cs:270-280`), the validator is a plain `EmailAddress()` check, and `RequireUniqueEmail = true` makes each alias a distinct user. That avoids burning a Zoho seat.

## Local development

MailHog receives everything. `docker compose up -d db mailhog`, then read mail at <http://localhost:8025>. No DNS, no SendGrid, no Zoho involvement. `frontend/e2e/helpers/mailhog.helper.ts` pulls invitation codes out of MailHog programmatically — that helper, plus `tenant.helper.ts`, is the fastest way to provision a full landlord + tenant + property fixture without touching real email.

## Runbook — "the invitation never arrived"

Work outward. Each layer records the truth; the trick is asking each one in order rather than guessing from the top.

**1. Did the app create the invitation?**

```bash
TOKEN=$(curl -s https://api.upkeep-io.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"claude@claude.com","password":"<seeded>"}' | jq -r .accessToken)

curl -s https://api.upkeep-io.dev/api/v1/admin/landlord-invitations \
  -H "Authorization: Bearer $TOKEN" | jq '.items[] | select(.email | contains("upkeep-io"))'
```

A row means the request landed. Note that the row is written **before** the email is sent (`CreateLandlordInvitation.cs:88-99`) — a `Pending` row with no email is exactly what a failed send looks like.

**2. Did the app hand it to SendGrid?** Render logs for `property-manager-api`. `Landlord invitation created` is logged *after* the send completes, so its presence means SMTP accepted. An `SmtpException` instead means the send threw — check that `Email__Smtp*` vars are still set (unset, they silently default to `localhost:1025`) and that the API key hasn't been revoked.

**3. What did SendGrid do with it?** Dashboard → **Activity** → **Activity Feed**, search by recipient. This is the highest-value step and the one most easily skipped: the Dashboard graph lags, the Activity Feed does not. Free-plan retention is **3 days**.

- `Delivered` → the problem is past SendGrid; check the Zoho mailbox and its spam folder.
- `Blocked` / `Bounced` → read the **Response**. A `5xx` here is the recipient server talking, not SendGrid.
- `Dropped` → SendGrid suppressed it locally; see step 5.
- Nothing at all → the app never sent it; go back to step 2.

**4. Decode the recipient's response.** `554 5.7.1 ... Relay access denied` means the receiving server does not consider itself responsible for that address — an MX/mailbox configuration problem, not spam filtering, and not a reputation problem regardless of what SendGrid's `bounce_classification` guesses. Check `dig +short MX upkeep-io.dev` points at Zoho and that the mailbox actually exists in Zoho's admin console.

**5. Clear the suppression before retrying.** A permanent rejection lands the address in SendGrid → **Suppressions** → **Blocks** (for `type: blocked`) or **Bounces**. Until it's removed, SendGrid drops further sends *internally* without ever contacting the recipient — so a retry fails differently and misleadingly. Delete the entry, then retry.

**6. Retrying is harder than it should be.** A pending invitation cannot be resent (`ResendLandlordInvitation.cs:78-84` allows expired only) and the address cannot be re-invited (`CreateLandlordInvitation.cs:70-79`). Today the workarounds are: wait for the 24-hour expiry, or expire the row directly:

```sql
UPDATE "Invitations" SET "ExpiresAt" = now() - interval '1 hour' WHERE "Id" = '<id>';
```

which flips it to `Expired` and makes the Resend button appear. `td-7-cancel-and-resend-pending-invitations.md` exists to remove this hand-surgery.

## Known gaps

| Gap | Impact | Tracked by |
|---|---|---|
| No SendGrid event webhook | Bounces are invisible to the app; the admin console shows `Pending` forever | `td-8-sendgrid-event-webhook.md` |
| Pending invitations can't be cancelled or resent | A bounced or mistyped invite freezes that address for 24h | `td-7-cancel-and-resend-pending-invitations.md` |
| No SPF record | Deliverability risk; no outage today (DKIM signs, DMARC is `p=none`) | this doc, above |
| Zoho free plan: 5 users | No room for a fifth persona; use Gmail plus-aliases instead | — |
| Activity Feed retention: 3 days | A bounce during a quiet stretch is unrecoverable after 72h | `td-8` (persisting events fixes this) |

## Incident log

### 2026-08-22 — invitations silently undeliverable

**Symptom.** A landlord invitation to `test-landlord.one@upkeep-io.dev` never arrived. The admin console showed `Pending`; the API had returned `201`.

**Cause.** `upkeep-io.dev` MX pointed at Namecheap's email-forwarding servers (`eforward1-5.registrar-servers.com`) with an **empty alias table**. Those servers rejected the message with `554 5.7.1 Relay access denied`. Zoho had been domain-verified months earlier but MX was never switched, so Zoho was never in the delivery path at all — the mailboxes existed and could not receive.

**Duration.** Unknown — no invitation had been sent to a domain address since the project went quiet, and nothing monitors delivery.

**Fix.** Namecheap Mail Settings switched from *Email Forwarding* to *Custom MX* with Zoho's three MX records; the SendGrid Block for the affected address deleted; the stuck pending invitation removed from the database so the address could be re-invited.

**Verified.** `test-landlord.two` invited and accepted at 00:06→00:10Z; `test-landlord.one` invited and accepted at 00:40→00:41Z. Both are live accounts.

**Lessons.**
1. A `2xx` from a send endpoint means "the relay accepted it," never "it arrived." Only the recipient's response code answers that.
2. Read the SMTP status code before theorizing. `554 Relay access denied` names a routing problem precisely; SendGrid's `bounce_classification: "Reputation"` on the same event was simply wrong.
3. Domain *verification* with a mail provider is not the same as *routing* mail to it. Verification is a TXT record; routing is MX.
4. This was invisible because nothing carried delivery state back into the product — hence `td-8`.
