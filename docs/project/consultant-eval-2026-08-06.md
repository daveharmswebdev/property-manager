# Outside Evaluation — Upkeep / property-manager

**To:** property-manager development team
**From:** Outside review (engaged informally, one session)
**Date:** 2026-08-06
**Subject:** Project restart — assessment, risk register, and recommended sequence

---

## Preface

I have no prior involvement with this project. I reviewed it in a single sitting:
the PRDs, the epic ledger, the sprint status file, `project-context.md`, the
archived market research, the deployment config, and the git history. I did not
run the application and I have not read the majority of the source. Treat
everything here as an outside read, useful for exactly the reason that it is
uninformed by the last nine months of context.

The engagement started somewhere else. Dave was evaluating whether to start a
new project — specifically, whether to find an underserved mobile app market
from scratch. That work is what led back here. The relevant conclusion is in
§2.

---

## 1. Bottom line

**Restart this project. Do not rebuild it, do not re-scope it upward, and do not
start something new.**

The asset is in better shape than a three-week pause would suggest. 23 epics and
roughly 150 stories are recorded, the overwhelming majority marked done. The
stack is current (.NET 10, Angular 21, EF Core 10, PostgreSQL), the architecture
is disciplined (Clean Architecture + CQRS/MediatR, multi-tenancy via global query
filters), CI/CD runs to Render, and an LLC is formed. Last commit is 2026-07-14;
the commits immediately preceding it are Dependabot batches, meaning feature work
stopped cleanly rather than mid-flight.

Critically: **Epic 20, the tenant portal, is complete.** All eleven stories. The
mechanism that makes the business model work already exists in the product.

The pause was caused by external commitments — a demanding consulting engagement
and family obligations — not by project health, technical debt, or a failed
thesis. That distinction matters for how you restart: this is a resumption, not
a rescue.

**Two things, in this order.**

1. **Make the Stripe scope decision now, on paper** — subscription billing only,
   Connect and rent payments explicitly out of beta. This is a decision, not
   work. It costs an hour and it removes the item that has been blocking the
   project since June. See §5, Phase 3.
2. **Then validate the core loop end to end with real accounts before writing
   any billing code.** This was the next task when work stopped and it remains
   the correct next task. See §5, Phase 2 — it is the substantial phase of this
   restart, not a checklist item.

Do not reverse that order. Billing on top of an unvalidated core converts a beta
into a refund conversation.

---

## 2. Why this project and not a new one

This is worth stating explicitly, because the team should know the alternative
was tested seriously rather than dismissed.

We spent a full working session building a tool to mine the App Store and Google
Play for underserved markets — chart and keyword collection across 14 categories,
star-histogram deficit scoring, a log-normal serviceable-demand band, IDF-weighted
complaint clustering across ~15,000 negative reviews, and a competitive
substitute check. It scored 1,254 apps.

**It produced three confident recommendations. Two were wrong.**

- The top pick (a mileage tracker with a 45% one-and-two-star share) turned out
  to sit in a category where three competitors serve the same users at 3–7%. The
  "opportunity" was an artifact of never checking whether anyone had already
  solved the problem.
- The second pick — a 1,043-day-stale incumbent — was sitting next to a healthy
  competitor doing the same job.
- An entire cluster of high-scoring candidates (K-12 school portals, rated
  1.4–2.7★ with millions of captive users) is structurally unenterable: school
  districts buy the software and students are conscripted into using it. Maximum
  measured pain, zero addressable market.

The tool was eventually fixed to catch these. But the finding that matters is
this: **the project's own market research, done by hand in January 2026, was
better work than the automated output.**

`docs/project/archive/research/market-property-management-saas-research-2026-01-31.md`
identifies 15 competitors across three tiers with sourced pricing, and produces a
feature-gap matrix showing that **vendor management and work orders are absent
from the entire affordable tier** — Landlord Studio, Stessa, Baselane and
TurboTenant all lack them; the tools that have them start at $69/month. Epics
8 through 12 built directly into that gap. The differentiation is deliberate and
evidence-based.

### The structural case

Independently of the competitive analysis, this product has a shape that is
unusually favourable and that the team should understand and protect:

**It is a two-sided prosumer product with an obligatory interaction.**

- **Free side:** tenants. **Paying side:** landlords with 5–50 units.
- **The obligatory interaction is the maintenance request.** The landlord's
  repair workflow cannot begin until a tenant submits one. That means the
  landlord has a structural incentive to onboard their own tenants into the
  product. That is free distribution, and it is rare.
- **The buyer is a sole proprietor with a credit card.** No procurement cycle,
  no committee, no gatekeeper. This is the specific property the K-12 candidates
  above lacked and why they were unenterable.
- **The workflow terminates in hard financial value** — Schedule E at tax time —
  which supplies a deadline-driven annual reason to still be subscribed.

Most products have to buy distribution or manufacture retention. This one has
both available structurally. Preserving that should inform prioritisation:
**anything that strengthens the landlord→tenant onboarding loop is strategic;
anything that doesn't is not.**

---

## 3. Diagnosis — why it stalled

The pause has an external cause and an internal pattern. Both are worth naming;
only the second is actionable.

### The PRD serves two masters

`prd.md` states this openly:

> "This is Dave's graduate school — a career-building portfolio piece
> demonstrating full-stack SaaS development from database design to Stripe
> integration to deployment."

Success criteria include *"Portfolio piece — LinkedIn-worthy."* Those goals
compete with shipping to paying users, and the epic ledger shows which one won.

### The pattern in the ledger

- **Epic 21 — a twelve-story test coverage backfill — interrupted Epic 20, the
  tenant portal.** The tenant portal is the two-sided mechanism described in §2,
  and it was paused for test coverage.
- **Epic 23 is an Angular 22 migration.** **Epic 8.5 was a UX rebrand.**
- **Stripe is the only major PRD item with no epic at all.** FR78–FR81 are
  written. There is no `epics-stripe.md`. The revenue mechanism was never
  planned, while a framework migration was.

Every epic that shipped had a clear right answer — tests, migrations, RBAC,
refactors. Work where completion is objective and nobody can tell you you were
wrong. The work that never got scheduled is the work that requires charging a
human being money and finding out whether they will pay.

This is an ordinary and well-documented failure mode in solo and small-team
projects. It is not a character problem and it is not a code problem. It is a
prioritisation default that has to be deliberately overridden, because craft work
always feels more responsible than exposure work.

**Design implication for the restart: front-load exposure-shaped work. Freeze
craft-shaped work explicitly and by name.**

### The counterweight

The discipline that produced the over-investment is also the reason this project
is recoverable. After a three-week pause there is a passing test suite, a written
`project-context.md` with 65 codified rules, a per-story status ledger, and PRDs
for both the core product and the tenant portal. Most paused solo projects cannot
be resumed at all. This one can be resumed in an afternoon.

The craft investment cost velocity and bought resumability. That trade has now
paid off. It should not be repeated.

---

## 4. Infrastructure risk register — act on this first

A credit card was compromised and replaced. Every recurring charge on it has
likely failed. **This is the most time-sensitive item in this memo**, because two
of these services can lose data permanently.

Ordered by irreversibility, not by convenience:

| # | Service | What it holds | Risk if lapsed | Priority |
|---|---|---|---|---|
| 1 | **Render PostgreSQL** (`property-manager-db`, plan `basic-256mb`) | The entire production database | Suspension, then reclamation after grace period. **Permanent data loss.** | Today |
| 2 | **AWS S3** (`AWS__BucketName`) | Every receipt and property photo any user has uploaded | User data, not regenerable. Separate AWS account, separate card. | Today |
| 3 | **Domain `upkeep-io.dev`** | App URL and all test-account email addresses | Cascade failure; domain becomes publicly registrable. Separate registrar, separate card. | This week |
| 4 | **Render web services** ×2 (`property-manager-api`, `property-manager-web`, plan `starter`) | Deployed application | Suspension. Fully reversible. | This week |
| 5 | **Email SMTP** (`Email__SmtpHost` / `SmtpUsername` / `SmtpPassword`) | Invitation and verification delivery | Breaks beta onboarding. Reversible. Config is generic SMTP — provider is likely Zoho Mail given the domain; verify. | This week |
| 6 | **Ref MCP** | Developer documentation lookup | Zero user impact. Blocks nothing. | Last, or never |

**Note the two omissions.** When Dave listed the at-risk services from memory, he
named Render, email, and Ref MCP. **S3 and the domain registrar were not on the
list** — and those are the two that can permanently destroy something. S3 holds
every receipt image in the product.

This is a representative example of the general point in §7: the hard part of
this work is not writing code, it is noticing what is not on the list.

---

## 5. Recommended sequence

### Phase 0 — Restore billing (today)

Work the risk register in §4 in order. Confirm the Postgres instance is intact
before anything else. If it is past grace, that changes every downstream plan and
you need to know immediately.

### Phase 1 — Prove it still runs (day 1)

```
docker compose up -d db mailhog
dotnet run --project src/PropertyManager.Api     # :5292
ng serve                                          # :4200
```

Then run the full test suite. **Not to improve it — to use it as a liveness probe
on institutional memory.** A green suite confirms the codebase is intact, and
reading a handful of E2E specs is the fastest available route back into how the
application actually behaves. Rediscovery through execution, not through reading
documentation.

Do not fix anything you find in this phase unless it blocks the app from
starting. Write it down and move on.

### Phase 2 — Validate the full loop with real accounts (the main event)

**This is the substantial phase of the restart.** It was the next task when work
stopped in July — the beta email accounts were created for exactly this purpose
and never used. It has never been executed end to end by a human.

Test accounts already exist: two test landlords and two mock renters on
`@upkeep-io.dev`. **Credentials are in `scratch.txt` at the repository root**
(gitignored; not reproduced here). That file also contains API keys in
plaintext — rotate them.

Note the fixture set is deliberate: **two landlords** enables a real multi-tenant
isolation check, and **two renters** enables the multiple-tenants-per-property
case (FR-TP3). Use both.

#### The loop under test

> tenant submits maintenance request with photo → landlord triages it in the
> inbox → converts to work order → assigns vendor → work is performed →
> receipt captured on a phone → expense created and linked to the work order →
> work order closed → request resolution syncs back to the tenant →
> expense appears correctly on the Schedule E worksheet

This crosses **three roles and six epics** (5, 6, 8, 9, 11, 20). It is the
product. It is also the specific claim the competitive analysis rests on — the
vendor-management and work-order capability that the affordable tier lacks
(§2). If it works, there is something to sell. If it breaks, the break outranks
everything else in this document.

#### Why the existing test suite will not have caught these

Epic 21 backfilled coverage per-controller and per-feature — story 21-4 covers
the tenant dashboard, 21-8 covers work orders. Those tests run **one role at a
time, on seeded fixtures, against MailHog and a local environment.** The loop
above runs three roles in sequence against real SMTP, a real S3 bucket, and real
presigned URLs.

**The bugs will be in the seams, not the units.** Predicted areas, in rough order
of likelihood:

1. **Invitation email delivery** — first time out of MailHog and onto production
   SMTP. Deliverability, spam classification, and whether invitation links carry
   the correct production URL rather than a localhost origin.
2. **Request resolution sync** (story 20-10) — the smallest story in Epic 20
   (size 3) and the last one implemented. The tenant-visible status is the end of
   the loop and the least exercised part of it.
3. **Maintenance request → work order conversion** (story 20-8) — carries photos
   and description across an entity boundary.
4. **Receipt capture on a real phone** — camera flow, real S3 upload, presigned
   URL expiry (15 min), SignalR sync between devices. Materially different from
   desktop upload against a local bucket.
5. **Expense ↔ work order link surviving into the Schedule E PDF** — verify the
   linked expense appears with the right category and amount, not just that a PDF
   generates.
6. **Cross-account isolation** — log in as landlord two and confirm none of
   landlord one's properties, requests, or expenses are reachable. Then confirm
   the tenant lockdown (20-11) holds under a real session.

#### Discipline for this phase

**Walk the entire loop before fixing anything.** Log every defect and keep
moving. Only stop mid-loop for a hard blocker that prevents continuing.

The failure mode here is predictable and specific: find bug #1, disappear into
fixing it, lose the thread, never reach the end of the loop, and end the week
without knowing whether the product works. The output of the walk is **a bug
list**, not a set of commits.

Then triage that list into exactly two buckets:

- **Blocks a beta landlord from completing the loop** → fix now, before Stripe.
- **Everything else** → backlog. Including anything cosmetic, anything about
  test coverage, and anything that starts with "while I was in there."

Timebox the fix pass. If the blocking list turns out to be larger than a week,
that is a finding worth escalating rather than absorbing — it changes the beta
timeline and should be a deliberate decision, not a silent slip.

### Phase 3 — Write and ship `epics-stripe.md` (the only new epic)

**Sequencing note:** the scope decision below should be made immediately, in
writing, at the start of the restart — it is what removes Stripe as a blocking
unknown. The *implementation* waits until Phase 2's blocking bugs are cleared.
Decide now, build later.

**Scope: subscription billing only. FR78–FR81.**

- Stripe Checkout session for landlord subscription
- Stripe Billing Portal for payment method and invoice management
- Webhook on `customer.subscription.*`, signature verified (NFR29)
- Subscription status gates access, with a grace period on lapse (FR80)

This is well-trodden, boring, and small. It is the last thing standing between
this product and the ability to take money.

**Explicitly out of scope: Stripe Connect and tenant rent payments.**

This is the decision that unblocks the project. The PRD lists "Tenant portal —
Phase 3: Rent payments via Stripe" under Future State, and that is an entirely
different system: Connect onboarding, KYC, payouts, ACH, money movement between
two parties you do not control, dispute handling, NSF and failed-payment states,
and a regulatory surface. It is also *why* TurboTenant, Baselane and Avail can
be free to landlords — payment flow is their revenue model.

It is not required for beta. Deciding that now, in writing, is what removes the
blocker. Revisit only after paying users exist and ask for it.

### Phase 4 — Beta

Onboard the real humans who already volunteered. Definition of done for this
phase is **a landlord who is not Dave, using it on their own properties, with a
card on file.**

### Frozen until beta users exist

By name, so the freeze is enforceable:

- Epic 23 — Angular 22 migration
- The Dependabot backlog
- Any further test coverage work
- Any UX polish or design refresh
- Any feature from the PRD "Future State" table

---

## 6. Recommended tooling change: a closing agent

Dave proposed adding a persistent agent to the project whose role is to close it
out — the specialist brought in to finish a project rather than build one. I
endorse this, with one correction.

**Why it works:** a paused project needs a different operating mode than a
project in flight. The closer's job is subtraction — descope, sequence, finish,
ship. That is a genuinely different posture from the one that authored 23 epics.
Encoding it as an agent definition in `.claude/agents/` means the discipline
persists across busy weeks and low-energy evenings, which is precisely when the
drift described in §3 occurs.

**The correction:** a closer's real power is *the authority to say no* — to tell
a stakeholder a feature is not making the release. An agent cannot hold that
authority; only Dave can. If the agent is treated as the decision-maker, it
becomes a way to delegate exactly the judgment that this project needs a human
for.

**Build it as enforcement, not judgment. It proposes; Dave disposes.**

Suggested behaviours:

- Refuses to open new epics. No exceptions.
- Requires every proposed task to answer one question: *does this block a real
  landlord from using and paying for this product?* If no, it goes to the
  backlog without discussion.
- Knows the frozen list in §5 by name and pushes back on drift toward it,
  because the ledger shows that is the specific failure mode here.
- Defines "done" as **deployed and used by a human who is not Dave** — never as
  "merged."
- During Phase 2, enforces walk-the-whole-loop-before-fixing. If a defect is
  found mid-loop and is not a hard blocker, it gets logged and the walk
  continues. This is the highest-probability drift point in the entire restart.
- Surfaces the §4 risk register status at the start of any session until all
  items are cleared.

---

## 7. What I would watch

**The market research is six months old.** It explicitly flagged "Baselane
expands features" and "Stessa pushes downmarket" as Medium threats — both would
attack the vendor-management and work-order gap that is this product's entire
differentiation. Re-verify before committing further build effort. This is an
hour of work, not a project, and it is cheap insurance on a thesis the whole
roadmap rests on.

**The two-masters problem in the PRD will recur** unless it is resolved on paper.
Recommend amending `prd.md` to demote the portfolio/learning goals from success
criteria to a stated side effect. They are real and they were valuable; they
should not be allowed to compete with shipping for prioritisation.

**Guard the onboarding loop.** Per §2, the landlord→tenant invitation path is the
distribution mechanism. Any friction there costs more than it appears to, because
it compounds against every future user. It deserves disproportionate polish
relative to the rest of the product — and it is the one place where "craft work"
is also exposure work.

---

## 8. Closing observation

I will state this plainly because it came up in conversation and I think it is
the correct read.

Over the course of this engagement I generated a complete two-store scraping
pipeline — caching, backoff, statistical scoring, natural-language complaint
clustering — in about twenty minutes. The code was never the constraint. Every
failure in that work was a judgment failure: a wrong model of what demand means,
a failure to check for existing substitutes, a scoring change that inverted its
own signal. Three confident recommendations, two overturned, none of them
because anyone typed something incorrectly.

Meanwhile a document in this repository's archive — written by hand in January,
by a person thinking carefully for an afternoon — was better than all of it.

Code generation is cheap now and getting cheaper. What is scarce is knowing what
to build, what to cut, and when you are wrong. That is the job. This project's
problem was never that the code was hard; it is that the last remaining decision
was expensive, and expensive decisions are easy to defer indefinitely.

The decision is in §5. Make it, and the rest is execution.

---

## Appendix — key references

| Document | Contents |
|---|---|
| `docs/project/prd.md` | Core product PRD, FR1–FR81, NFR1–NFR29 |
| `docs/project/prd-tenant-portal.md` | Tenant portal PRD (Epic 20 — complete) |
| `docs/project/sprint-status.yaml` | Per-story status ledger, Epics 1–23 |
| `docs/project/project-context.md` | 65 codified implementation rules — read before writing code |
| `docs/project/architecture.md` | Architecture reference, logging patterns |
| `docs/project/archive/research/market-property-management-saas-research-2026-01-31.md` | Competitive analysis — the strategic basis for §2 |
| `render.yaml` | Deployment topology; the paid services in §4 |
| `scratch.txt` (gitignored, repo root) | Beta test account credentials; contains API keys needing rotation |
