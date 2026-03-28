---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Work Order Management for Property Manager App'
session_goals: 'Define work order features leveraging existing expense tracking, with vendor management architecture consideration'
selected_approach: 'progressive-flow'
techniques_used: ['Role Playing', 'Mind Mapping', 'SCAMPER Method', 'Decision Tree Mapping']
ideas_generated: [vendor-lookup, mobile-first, work-order-as-memory, diy-vs-vendor-paths, multi-source-photos, retroactive-work-orders, person-entity-abstraction, shared-taxonomy, polymorphic-notes, pdf-generation]
context_file: '_bmad/bmm/data/project-context-template.md'
session_status: complete
---

# Brainstorming Session Results

**Facilitator:** Dave
**Date:** 2026-01-07

## Session Overview

**Topic:** Adding Work Order Management to Property Manager, leveraging existing expense tracking functionality, with vendor management as a planned future addition.

**Goals:**
- Define work order features that integrate with existing expense tracking
- Architect with vendor management integration in mind
- Map the complete work order lifecycle: Create → Assign → Complete → Invoice → Expense

### Context Guidance

This session focuses on software product development with outputs feeding into Product Briefs and PRDs. Key areas: user problems, feature ideas, technical approaches, UX, and business value.

### Session Setup

**Key Insight Captured:** Work orders become the *context* around expenses - the "why" behind repair costs, connecting expenses to specific maintenance events.

**Entity Relationships Identified:**
- Work Order → Expense (expense born from completed work order)
- Work Order → Vendor (assigned tradesperson/company)
- Expense → Work Order (expense has context/origin)
- Vendor → Work Orders (history of work performed)

## Technique Selection

**Approach:** Progressive Technique Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 - Exploration:** Role Playing - embody landlord, tenant, vendor, property manager perspectives
- **Phase 2 - Pattern Recognition:** Mind Mapping - organize ideas around work order lifecycle
- **Phase 3 - Development:** SCAMPER Method - systematic enhancement through 7 lenses
- **Phase 4 - Action Planning:** Decision Tree Mapping - implementation roadmap with priorities

**Journey Rationale:** Property management inherently involves multiple stakeholders with distinct needs. Progressive flow ensures comprehensive feature discovery while maintaining focus on buildable outcomes.

---

## Phase 1: Expansive Exploration (Role Playing)

### Landlord Perspective (Primary User)

**The Real Workflow Discovered:**
```
Tenant contacts landlord (phone/text/email)
    → Landlord calls tenant for details
    → Tenant sends pictures
    → Landlord assesses: DIY or call vendor?
    → Maybe visits property + takes own pictures
    → Either self-fixes OR finds/calls vendor
    → Work completed → Invoice/receipts → Expense created
```

**Key Ideas Generated:**

| # | Feature/Need | Notes |
|---|--------------|-------|
| 1 | Vendor lookup by trade/history | Surface trusted vendors with past work history |
| 2 | Mobile-first, one-tap to call | Landlord in "solve NOW" mode |
| 3 | Work order as "memory" | The WHY behind expenses |
| 4 | Two job paths | Vendor jobs vs. DIY jobs |
| 5 | Multi-source photos | Tenant photos + landlord photos attached |
| 6 | Retroactive work orders | Create after-the-fact, link existing expenses |
| 7 | Outbound vendor notifications | Email (maybe SMS) job details to vendor |
| 8 | Expense categorization | Work order type informs supplies vs. repairs |

### Scope Decisions

| Stakeholder | App Interaction | Notes |
|-------------|-----------------|-------|
| Landlord | Primary user | Full app access |
| Tenant | None (future) | Traditional contact methods only |
| Vendor | Recipient only | Receives notifications, no login |

### Future State Ideas

- AI-powered vendor recommendation (at scale)
- Tenant portal for submitting issues
- Vendor portal for job updates

### Peer Validation

Other landlords confirmed work order/maintenance tracking is a major need - market validation for this feature.

---

## Phase 2: Pattern Recognition (Mind Mapping)

### Status Lifecycle (Simplified)

```
REPORTED → ASSIGNED → COMPLETED
```

Three states only. Simple and user-friendly. Add complexity later if needed.

### Property/Expense Relationship

**Two paths for expenses to reach properties:**

```
         ┌──────────────┐
         │   PROPERTY   │
         └──────────────┘
               ▲  ▲
               │  │
  ┌────────────┘  └────────────┐
  │ Direct              Indirect│
  │                             │
  ▼                             ▼
┌─────────────┐        ┌─────────────┐
│   EXPENSE   │        │ WORK ORDER  │
│ (utilities, │        └──────┬──────┘
│  taxes,     │               │
│  Zillow)    │        ┌──────┴──────┐
└─────────────┘        │   EXPENSE   │
                       │ (repairs,   │
                       │  parts)     │
                       └─────────────┘
```

### Work Order Details

| Field | Type | Notes |
|-------|------|-------|
| Property | Link | Which property |
| Status | Enum | Reported → Assigned → Completed |
| Description | Text | What's the problem |
| Category | Enum | Plumbing, Electrical, HVAC, etc. |
| Tags | Free-form + autocomplete | GitHub-style |
| Assigned To | Vendor or Self | Who's doing the work |
| Photos | Attachments | Multiple, from any source |
| Notes | List of entries | Timestamped notes + optional attachments |
| Expenses | Links | Zero to many |
| Created/Updated/Deleted | System | Standard CRUD + soft delete |

### Vendor Details

| Field | Type | Notes |
|-------|------|-------|
| (Person fields) | Via relationship | First, Middle, Last, Phones[], Emails[] |
| Trade Tags | Free-form + autocomplete | GitHub-style, multiple allowed |
| Notes | Polymorphic link | Same notes table as work orders |
| Work History | Auto-linked | Work orders assigned to this vendor |
| Created/Updated/Deleted | System | Standard CRUD + soft delete |

### Person Abstraction (Architecture Decision)

**Decision:** Implement Person base entity now (not later) because Tenant is next on roadmap.

```
PERSON (base entity)
├── First Name, Middle Name, Last Name
├── Phones[] (multiple, with labels)
├── Emails[] (multiple)
├── Notes[] (polymorphic link)
├── Created/Updated/Deleted
│
├─── VENDOR (extends Person)
│    ├── Trade Tags
│    └── → Work Orders (history)
│
├─── TENANT (future)
│    ├── → Lease, Occupants, Pets, etc.
│
└─── USER (extends Person)
     ├── Auth/Login credentials
     └── Preferences
```

### Design Principles Captured

**Target User:** Friends and family managing properties as a side responsibility while holding full-time jobs or running households.

**Implication:** Terminology should be colloquial/conversational, not industry jargon. Simplicity over comprehensiveness.

---

## Phase 3: Idea Development (SCAMPER)

### Substitute
- Standard photo picker flow works (save from text → select from camera roll)
- Multi-photo selection is native to iOS/Android

### Combine
- **Decision:** Shared taxonomy for work order categories AND vendor trade tags
- Same list enables easy matching and future AI recommendations

### Adapt
- **Enhancement:** Add optional "Work Order" dropdown to receipt processing
- Dropdown shows active work orders only (keeps it clean)
- Edge case (old receipts for closed work orders): Link via work order detail or expense edit

### Modify
- Description field: Free-form text only
- No structured prompts - minimize friction for busy users

### Put to Other Uses (Future Scope)
- Preventive/scheduled maintenance
- Property turnover punch lists
- Inspections

### Eliminate
- Nothing removed - all designed elements earn their place

### Reverse
- Problem-first flow is natural, no need for vendor-first entry point

---

## Phase 4: Action Planning (Decision Tree Mapping)

### Implementation Roadmap

```
PHASE A: Foundation
├── Person entity (base for Vendor, future Tenant, User)
├── Category/Trade taxonomy (shared list)
└── Notes (polymorphic, reusable across entities)

PHASE B: Core Entities
├── Vendor (extends Person + trade tags)
└── Work Order (core fields, status, category, tags)

PHASE C: Attachments & Links
├── Photos on Work Order
├── Notes on Work Order
└── Work Order ↔ Expense relationship

PHASE D: Integration
├── Receipt processing dropdown (active work orders)
└── Expense linking from Work Order detail

PHASE E: Output
└── Work Order PDF (via reusable PDF service)
```

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Person entity now | Tenant feature coming next, avoid refactor |
| Shared taxonomy | Categories + trade tags use same list for matching |
| Polymorphic notes | Single table, reusable across entities |
| Modular PDF service | Template-driven, reusable for future documents |

### Deferred to Future

| Feature | Reason |
|---------|--------|
| Tenant portal | Out of scope for MVP |
| Vendor portal | Out of scope for MVP |
| Email/SMS notifications | Tabled - PDF generation provides flexibility |
| AI vendor recommendations | Future enhancement at scale |
| Preventive maintenance | Future scope |
| Property turnover punch lists | Future scope |
| Inspections | Future scope |

---

## Session Summary

### What We Accomplished

This brainstorming session defined the Work Order feature for Property Manager, leveraging existing expense tracking functionality and architecting for future vendor management.

### Key Discoveries

**The Real Workflow:**
```
Tenant contacts landlord (phone/text/email)
    → Landlord gathers details + photos
    → Assess: DIY or call vendor?
    → Create work order
    → Assign (self or vendor)
    → Complete work
    → Attach expense(s)
```

**Two Paths for Expenses:**
- Direct: Expense → Property (utilities, taxes, Zillow)
- Indirect: Expense → Work Order → Property (repairs, parts)

### Entity Model

```
PERSON (base)
├── First, Middle, Last Name
├── Phones[], Emails[]
├── Notes[] (polymorphic)
│
├─── VENDOR (extends Person)
│    └── Trade Tags
│
├─── TENANT (future)
│
└─── USER (extends Person)
     └── Auth/Preferences

WORK ORDER
├── Property (link)
├── Status: Reported → Assigned → Completed
├── Description (free-form)
├── Category (shared taxonomy)
├── Tags (GitHub-style autocomplete)
├── Assigned To (Vendor or Self)
├── Photos[]
├── Notes[]
└── Expenses[] (zero to many)
```

### Design Principles

| Principle | Application |
|-----------|-------------|
| Target user | Friends/family, side responsibility, busy lives |
| Terminology | Colloquial, not industry jargon |
| Simplicity | 3 statuses, no unnecessary complexity |
| Flexibility | Retroactive work orders, optional expense linking |
| Modularity | Reusable notes, PDF service, shared taxonomy |

### Integration Points

- **Receipt processing:** Add optional "Work Order" dropdown (active only)
- **Work Order detail:** Add Expense button to link existing expenses
- **PDF generation:** Reusable service for work order output (and future docs)

### Next Steps

1. Create Product Brief or PRD from this brainstorm
2. Break into epics/stories following the phased roadmap
3. Begin implementation with Phase A (Foundation)

---

**Session Complete**

*Brainstorming facilitated by Mary (Business Analyst Agent)*
*Date: 2026-01-07*

