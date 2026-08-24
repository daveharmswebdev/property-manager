# Product Brief: Upkeep (property-manager)

**Author:** Dave
**Date:** 2026-08-23
**Status:** Pre-beta — product built, revenue mechanism unbuilt

> **Provenance.** This brief is referenced as an input by `/create-prd`,
> `/create-architecture`, `/create-epics`, and `/create-ux`, but was never
> written — those skills have been reading a missing file. It is reconstructed
> from `prd.md`, the January 2026 market research in
> `archive/research/market-property-management-saas-research-2026-01-31.md`, and
> the outside evaluation in `consultant-eval-2026-08-06.md`.
>
> It states **one** goal: landlords paying for the product. Portfolio and
> learning goals are deliberately excluded — see Risks & Assumptions.

---

## Executive Summary

Upkeep is a property management platform for small landlords — the owner of 5–50
units who manages properties as a team, usually with a spouse. It covers one
continuous workflow that competing products split across several tools or omit
entirely: a tenant reports a problem, the landlord assigns a vendor, the work is
done, the receipt is captured, and the expense lands on a Schedule E worksheet at
tax time.

The product is built. Every story across Epics 1–22 is marked done except four —
the property photo gallery (13-3), Sentry integration (14-4, 14-5), and E2E
test-data cleanup (18-2) — and that includes all eleven tenant portal stories.
Epic 23 (Angular 22) is frozen. What does not exist is subscription billing:
Epic 24 is five stories, all pending, no code. And no landlord other than the
founder has used the system on their own properties.

---

## Problem Statement

Small landlords do property management with a shoebox of receipts, a phone full
of contractor numbers, and a spreadsheet that gets rebuilt every April.

The specific gap is documented rather than assumed. The January 2026 market
research priced 15 competitors across three tiers and produced a feature-gap
matrix with one clear finding: **vendor management and work orders are absent
from the entire affordable tier.** Landlord Studio, Stessa, Baselane, and
TurboTenant all lack them. The products that do have them start at $69/month and
are built for management companies with hundreds of units.

So a landlord with 12 properties chooses between a cheap tool that tracks money
but not work, or an enterprise tool priced and designed for someone else. The
repair and the expense it produces are the same event, and no affordable product
treats them that way.

---

## Target Users

**Property Owner — the paying subscriber.** Owns 5–50 rental units. Self-manages
rather than paying a management company. Deals with the receipt shoebox,
coordinates repairs by phone, and dreads tax time. Buys the subscription and is
the only user whose payment matters.

**Co-Manager — invited by the owner.** Almost always the owner's spouse or
business partner, with the same access to properties, expenses, work orders, and
reports. Small property management is a team activity, and products that assume a
single operator break on contact with how these households actually work.

**Tenant — portal user.** Lives in the property. Submits maintenance requests and
checks their status. Has no access to financial data, other tenants, or landlord
workflows. The tenant is not a customer, but the tenant starts the workflow that
makes the product valuable.

**Vendor — not a user.** Plumbers, electricians, handymen. Vendors are records
referenced by work orders. They are reached by phone and email and never log in.
Building a vendor login is a recurring temptation and is out of scope.

---

## Solution Overview

One loop, end to end, in one product:

1. Tenant submits a maintenance request through the portal.
2. Landlord reviews it and assigns a vendor, or marks it DIY.
3. Work is completed; photos and notes attach to the work order.
4. The receipt is captured on a phone and processed into an expense.
5. The expense links back to the work order, bidirectionally.
6. At tax time, one action produces Schedule E worksheets for every property.

Every step of that loop is built and shipped. Step 6 has been exercised for real;
steps 1–5 have not been run end to end by anyone who is not the developer.

---

## Key Differentiators

**The full lifecycle at the affordable tier.** Repair work and the expense it
produces are the same event. Cheap tools track the expense; expensive tools track
the work. Upkeep does both, priced for the small landlord.

**Built by someone who has the problem.** The founder manages rental properties
and uses the product on their own.

**Deliberately small.** Competitors aimed at management companies carry features
nobody in this segment asked for. Restraint is the feature.

**Solo operator with agentic tooling.** A one-person team can ship and respond to
user feedback faster than an enterprise roadmap. This is a real advantage and
also a real risk — see below.

---

## Success Metrics

Measurable, in order. Each gates the next.

| # | Metric | Threshold |
|---|---|---|
| 1 | Core loop validated end to end with real accounts | Tenant request → vendor assignment → receipt → expense → Schedule E line, completed once by a human who is not Dave |
| 2 | Billing live | Stripe subscription active; one real charge captured and settled |
| 3 | **First paying landlord** | A landlord who is not Dave, using Upkeep on their own properties, with a card on file |
| 4 | Retention signal | That landlord still active 30 days after first charge, without prompting |
| 5 | Second paying landlord | Acquired without a personal relationship to the founder |

Metric 3 is the definition of done for the current phase. Nothing above it counts
as progress toward it.

---

## Scope & Boundaries

**In scope for beta**

- The six-step loop described in Solution Overview
- Co-manager invitation and RBAC
- Stripe subscription billing — **subscriptions only**

**Explicitly out of scope for beta**

- Stripe Connect and rent payments through the platform
- Lease management, landlord-tenant messaging, document storage
- Mileage tracking, AI receipt categorization, bank integration
- Advanced financial dashboards beyond Schedule E

**Frozen until a paying landlord exists** (from the outside evaluation, by name so
the freeze is enforceable)

- Epic 23 — Angular 22 migration
- The Dependabot backlog
- Any further test coverage work
- Any UX polish or design refresh
- Any feature from the PRD "Future State" table

**Permanently out of scope**

- Enterprise property management (100+ units)
- HOA management, commercial real estate, mortgage origination

**Technical constraints.** Angular 21 + @ngrx/signals, .NET 10 + Clean
Architecture + CQRS/MediatR, PostgreSQL 16 + EF Core 10, NSwag-generated API
client, deployed on Render. Multi-tenancy enforced by global query filters. LLC
formed.

---

## Risks & Assumptions

**The single-master rule.** The PRD previously carried a second goal — the
project as a portfolio piece and "graduate school." The outside evaluation
identified this as the mechanism behind the stall: every epic that shipped had an
objectively correct answer (tests, migrations, refactors), while the work
requiring someone to be asked for money was never scheduled. A twelve-story test
backfill interrupted the tenant portal; an Angular migration was planned before
billing was. **This brief therefore states one goal.** The learning is real and
will happen regardless; it is not a success criterion, because when it competes
with shipping it wins.

**Unvalidated demand.** The market gap is evidenced; willingness to pay is not.
Nobody has been asked for money. This is the central open risk and metric 3 is
the only thing that resolves it.

**Sequencing risk.** Billing built on an unvalidated core turns a beta into a
refund conversation. Validate the loop first — this ordering is deliberate.

**Bus factor of one.** A solo operator is the speed advantage and the continuity
risk. Acceptable at beta scale; revisit if paying users reach double digits.

**Craft-shaped work is the default failure mode.** It feels responsible, it is
objectively completable, and it is how three weeks became a pause. The freeze
list exists because good judgment in the moment has already proven insufficient.
