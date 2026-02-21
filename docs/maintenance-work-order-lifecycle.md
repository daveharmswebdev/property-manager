# Maintenance Work Order Lifecycle

> Analysis session conducted 2026-02-21 between Dave (Landlord/Product Owner) and Mary (Business Analyst)

## Overview

End-to-end workflow for maintenance requests originating from the tenant portal, progressing through landlord triage, vendor/DIY work execution, status tracking, and financial reconciliation.

## Guiding Principles

- **"Reduce the need for phone calls"** — notifications should keep all parties informed without requiring manual outreach
- **"Never give a tenant an excuse to break a lease"** — concierge-level transparency; tenants should always feel confident their issues are being addressed
- **Statuses are terminal** — no reopening of work orders; new linked tickets are created instead

## Actors

| Actor | Access | Role |
|-------|--------|------|
| Tenant | Logged in via tenant portal | Submits requests, responds to follow-ups, adds notes, receives notifications |
| Landlord | Logged in (primary decision maker) | Triages, assigns, tracks, reconciles. Landlord associates may also change status (configurable) |
| Vendor | Not logged in (indirect participant) | Performs work. Any vendor notes are relayed by the landlord |

## Phase 1: Tenant Submission

### Auto-Captured (from portal context)
- Tenant identity
- Property
- Unit

### Tenant Provides
- **Simple category** — short predefined list, kept minimal
- **Brief description** — limited text field
- **Location within unit** — e.g., kitchen, bathroom, etc.
- **Urgency** — Emergency vs. Routine
- **Photo attachments**

### System Actions
- Creates a new work order (Status: **New**)
- Tenant receives immediate confirmation with reference number
- Landlord notified via email

### Emergency Handling
- App displays an emergency contact number/hotline (configurable by landlord per property)
- Emergency handling is outside the digital workflow — just a visible resource in the app

### Scope
- Requests scoped to the tenant's associated property only

## Phase 2: Landlord Triage

When a new request arrives, the landlord sees it on their dashboard and is notified via email. No approval workflow — the landlord is the sole decision-maker.

### Triage Actions (from Status: New)

| Action | Result |
|--------|--------|
| **Request More Info** | A detailed follow-up form is sent to the tenant. Landlord can also fill out this form themselves (e.g., after a phone call). Tenant responds → back to triage. |
| **Close — No Action Required** | Work order closed, similar to closing a Git issue. Tenant notified. Terminal state. |
| **Assign Vendor** | Landlord talks to vendor first (real-world), then assigns in app. Vendor notified via email. Status → **In Progress**. |
| **DIY (Self)** | Same work order, flagged as self/DIY. No vendor steps. Status → **In Progress**. |

### Follow-Up Form
- Two-tier form design: initial submission is simple/low-friction; follow-up form captures richer detail
- Follow-up form is available to both tenant and landlord

### Not In Scope (Phase 1)
- No auto-escalation if requests sit untouched
- No approval process / committee sign-off

## Phase 3: Work Assignment & Execution

### Vendor Assignment
- Vendor acceptance happens in real life (phone call) before formal assignment in app
- Assignment in app = vendor has already accepted
- Vendor receives email notification upon assignment

### DIY Path
- Same work order as vendor path, just flagged as "self/DIY"
- Skips vendor notification, otherwise same tracking

### Tracking During Work
- **Notes** — tenant and landlord can add notes (both are logged-in users). Vendor notes are relayed indirectly by the landlord.
- **Scheduling** — handled via notes (not a structured feature for phase 1)
- **Scope changes** — handled via notes

### Receipts (Two Types)
| Type | Description |
|------|-------------|
| **Vendor Invoice** | The bill from the vendor for labor/service |
| **Supplies/Materials** | Receipts for parts, materials purchased |

## Phase 4: Status Flow

```
New → In Progress → Completed → Reconciled
                  ↘ Abandoned (terminal)
```

### Status Definitions

| Status | Meaning |
|--------|---------|
| **New** | Request submitted, awaiting triage |
| **In Progress** | Assigned to vendor or DIY; work underway |
| **Completed** | Physical work is done; books not yet closed |
| **Abandoned** | Work stopped/not completed; no reconciliation needed. Terminal. |
| **Reconciled** | Accounting closed out. Terminal (but adjustable — see below). |

### Status Change Authority
- Only the landlord (and landlord associates) can change status
- This may be configurable in the future

### No Separate Triage/Assigned Statuses
- Kept lean — "In Progress" covers both assigned and actively being worked

## Phase 5: Completion & Reconciliation

### Completion
- Means the physical work is done
- Tenant notified
- Moves to reconciliation phase

### Reconciliation
- All receipts (invoices + supplies) attached
- Expenses recorded against the property
- Final cost total on the work order
- Ties into Schedule E reporting

### Reconciled Is NOT Immutable
- Receipts and expenses can still be added/adjusted after reconciliation
- Real-world reality: "receipts turn up, other expenses seem to show up somehow"

### Tenant Closure
- Handled by landlord in real life, not an in-app step
- No tenant satisfaction/confirmation step for phase 1

## Phase 6: Notifications

### Delivery Method
- **Email only** for phase 1
- In-app messaging system anticipated for future phases

### Tenant Receives Notifications On
- Request acknowledged / work order created
- Follow-up form requested (more info needed)
- Status changes: In Progress, Completed, Abandoned
- **NOT** notified of Reconciliation (internal/financial status)

### Landlord Receives Notifications On
- New maintenance request submitted
- Tenant responds to follow-up form

## Phase 7: Follow-Up Work

### The "It's Back" Scenario
- A fix doesn't hold (e.g., toilet leaks again, stove burner fails again)
- Common in property maintenance

### Solution: New Linked Work Orders
- **No reopening** of existing work orders — once Completed, Reconciled, or Abandoned, it stays that way
- **New ticket created instead** — fresh work order with its own full lifecycle
- **Linked to previous ticket** — reference/parent link to the original work order
- Creates a traceable chain: WO-1234 → WO-1267 → WO-1301

### Rules
- Only the landlord creates follow-up work orders
- May involve a different vendor than the original
- New work order starts at Phase 1 with full lifecycle

## Flowchart

See: `_bmad-output/excalidraw-diagrams/flowchart-maintenance-work-order-2026-02-21.excalidraw`

Open with [Excalidraw](https://excalidraw.com) or the VS Code Excalidraw extension.

## Next Steps

- [ ] Derive epics and user stories (PBIs) from this workflow
- [ ] Break stories into implementable tasks
- [ ] Prioritize for sprint planning
