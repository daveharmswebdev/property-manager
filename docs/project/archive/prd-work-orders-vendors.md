---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
status: complete
inputDocuments:
  - '_bmad-output/analysis/brainstorming-session-2026-01-07.md'
  - '_bmad-output/planning-artifacts/prd.md'
workflowType: 'prd'
lastStep: 3
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 1
---

# Product Requirements Document - Work Orders and Vendors

**Author:** Dave
**Date:** 2026-01-08
**Parent System:** Property Manager (MVP PRD v1.0)

## Executive Summary

Property Manager Phase 2 extends the existing expense-tracking platform with Work Order Management and Vendor tracking capabilities. Building on the successful Phase 1 foundation ("From Shoebox to Schedule E"), this phase addresses the operational reality that expenses don't exist in isolation - they originate from maintenance events that need tracking, assignment, and resolution.

The primary insight driving this phase: **Work orders are the "why" behind repair expenses.** When a landlord pays $500 for a plumbing repair, they need to know which property, which vendor, what the problem was, and what was done. This context matters for tax preparation, vendor evaluation, and operational memory.

This phase serves two user segments:
- **Part-time landlords (< 10 properties):** Often perform DIY repairs, need simple tracking without enterprise complexity
- **Growing landlords (10-50+ properties):** Rely on vendor networks, need vendor history and performance visibility

### What Makes This Special

**"Simple enough for 5 properties, smart enough for 50."**

Property Manager is designed for the landlord trajectory - not the static endpoint. Unlike enterprise tools (AppFolio, Buildium) that overwhelm small operators, or spreadsheets that collapse at scale, Property Manager grows with the portfolio.

The architectural foundation being laid now - separate but mapped taxonomies, structured work order data, vendor performance history - enables a future AI-assisted dispatcher. Today's work orders become tomorrow's training data for intelligent vendor assignment.

The existing email infrastructure (account invites) extends naturally to work order notifications, enabling vendors to receive job details without requiring app accounts.

### Workflow Flexibility

Work orders and expenses can be created in either direction - the system supports real behavior, not idealized process:

- **Work Order First (Operational):** Problem reported → Create work order → Assign vendor → Track to completion → Expense created from invoice
- **Expense First (Documentation):** Work completed → Receipt captured → Expense logged → Retroactively create/link work order for historical context

Both paths lead to the same connected data. Some users manage active repairs through work orders. Others document after the fact and attach context later. The system accommodates both without forcing a prescribed workflow.

### Architectural Continuity

This phase follows a "same tree, new branches" principle. Ten years of development experience teaches that new features become legacy liabilities when they ignore existing patterns. Work Orders and Vendors must:

- **Extend, don't reinvent:** Use established entity patterns (soft delete, audit fields, user ownership)
- **Reuse infrastructure:** Existing email service, PDF generation, file storage
- **Share foundations:** Polymorphic notes table, separate but mapped taxonomies
- **Maintain consistency:** Same Clean Architecture layers, same CQRS patterns, same validation approach

The goal is a single codebase with unified patterns - not a collection of features that happened to ship together.

### Taxonomy Architecture

Expense categories and vendor trade tags maintain independent structures with explicit mappings between them:

- **Expense Categories:** Can evolve hierarchy for tax reporting (Repairs > Plumbing > Emergency)
- **Vendor Trade Tags:** Flat structure for simple matching (Plumber, Electrician, HVAC Tech)
- **Category-Trade Mapping:** Explicit relationships enable AI-assisted vendor recommendations without structural coupling

This "separate but mapped" approach supports future AI dispatch while allowing each taxonomy to evolve independently based on its actual use case.

## Project Classification

**Technical Type:** web_app
**Domain:** general (real estate/property management)
**Complexity:** low
**Project Context:** Brownfield - Phase 2 extending existing Angular 20/.NET 10 system

This phase maintains architectural consistency with Phase 1: Clean Architecture, CQRS with MediatR, Angular Signals for state management. New entities (Person, Vendor, Work Order) follow established patterns for properties and expenses.

## Success Criteria

### User Success

**Sarah (Part-Time Landlord) - Retrospective Value:**
- At tax time, every expense has traceable context - "what was this $500 for?"
- Work order history serves as institutional memory for properties
- Six months later, when the same problem recurs, she can see what was done before
- Success moment: Looking at a receipt and instantly understanding the full repair story

**Marcus (Growing Landlord) - Operational Visibility:**
- Multiple active work orders visible at a glance (Kanban-style)
- Can toggle between 5 fires in a single day without losing track
- Knows which vendor is assigned to which problem
- Success moment: Opening the app and immediately seeing the state of all active repairs across all properties

### Business Success

**Phase 2 Validation:**
- Dogfooding: Dave uses Work Orders and Vendors for his own properties
- Feature ships without degrading codebase maintainability
- Architecture remains "one tree" - no bolted-on subsystems
- Ready for beta testing with friend managing 50+ properties

**Not Just Shipping:**
A feature that ships but makes the codebase harder to maintain is not a success. The bar is: feature works AND code stays clean.

### Technical Success

**Testing as Primary Verification:**
- Unit tests validate business logic before manual testing
- E2E tests verify user workflows end-to-end
- Tests are how developer and AI agent confirm features work
- No feature is complete without corresponding test coverage

**Pattern Discipline:**
- Extend existing patterns (entity conventions, CQRS handlers, validation approach)
- New patterns only when the old way genuinely won't work
- Deviation requires explicit justification, not convenience

**Architectural Integrity:**
- Same Clean Architecture layers
- Same folder structure conventions
- Same API design patterns
- New entities (Person, Vendor, Work Order) follow Property/Expense precedent

### Measurable Outcomes

| Metric | Target |
|--------|--------|
| Work order creation time | Under 60 seconds from property detail |
| Expense-to-work-order linking | One click from expense or work order |
| Active work order visibility | All open work orders on single dashboard view |
| Test coverage | Maintained at current levels for new code |
| New patterns introduced | Zero without documented justification |

## Product Scope

### MVP - Minimum Viable Product

**Foundation (Phase A):**
- Person entity (base for Vendor, future Tenant, User refactor)
- Expense Category taxonomy (hierarchical)
- Vendor Trade Tag taxonomy (flat)
- Category-Trade mapping table
- Polymorphic Notes table

**Core Entities (Phase B):**
- Vendor (extends Person + trade tags)
- Work Order (property link, status, category, description, tags)
- Work Order statuses: Reported → Assigned → Completed

**Attachments & Links (Phase C):**
- Photos on Work Order
- Notes on Work Order
- Work Order ↔ Expense relationship (bidirectional)
- Retroactive work order creation from expense

**Integration (Phase D):**
- Work Order dropdown on receipt processing (active work orders only)
- Expense linking from Work Order detail
- Work Order linking from Expense detail

**Output (Phase E):**
- Work Order PDF generation (extends existing PDF service)
- Email work order to vendor (extends existing email infrastructure)

### Growth Features (Post-MVP)

- Vendor performance tracking (ratings, response time, cost history)
- Work order templates for common issues
- Bulk work order operations
- Dashboard widgets for work order metrics
- Property maintenance history timeline

### Vision (Future)

- AI-assisted vendor recommendations based on trade, history, and ratings
- AI dispatcher for automatic vendor assignment suggestions
- Tenant portal for submitting maintenance requests
- Vendor portal for job updates and invoice submission
- Preventive maintenance scheduling
- Property turnover punch lists

## User Journeys

### Journey 1: Sarah Martinez - The Tax Time Revelation

Sarah is a full-time ER nurse with four rental properties she inherited from her parents. Property management is important to her family's financial future, but it's firmly in second place behind her career and raising two kids. Her husband Mike handles most repairs himself - he's handy and it saves money. When something breaks, Sarah texts Mike, Mike fixes it, and they save the receipt in a kitchen drawer.

One Tuesday evening, the tenant at Elm Street texts: "Water heater making weird noises." Sarah forwards it to Mike. He stops by after work, diagnoses a failing heating element, picks up the part at Home Depot ($47), and replaces it that weekend. Sarah snaps a photo of the receipt and uploads it to Property Manager from her phone while waiting for her daughter's soccer practice to end. Thirty seconds - amount, date, category "Repairs," done. Back to answering work emails.

Six months pass.

It's February, tax time. Sarah opens Property Manager to generate her Schedule E reports. She sees the $47 expense at Elm Street but can't remember what it was for. "Repairs - $47" doesn't tell her anything. Was it the water heater? The garbage disposal? That weird outlet in the kitchen? She texts Mike: "Hey, what was that $47 Home Depot receipt for Elm Street last summer?" Mike doesn't remember either.

Sarah thinks: *"I wish I had written down what the actual problem was."*

**The Next Year - With Work Orders:**

Same scenario. Tenant texts about the water heater. This time, after uploading the receipt, Sarah taps "Link to Work Order" and spends 45 seconds creating one: "Water heater making noise - Mike replacing heating element." She attaches the photo the tenant sent her.

February comes again. Sarah opens Property Manager, clicks on that $47 expense, and immediately sees: *"Water heater making noise - Mike replacing heating element. Photo attached. Completed 7/15."*

She doesn't text Mike. She doesn't wonder. She just knows.

When the same tenant reports water heater issues again the following year, Sarah pulls up Elm Street's work order history and sees: "We replaced the heating element 18 months ago. If it's failing again, might be time for a new unit." She makes an informed decision instead of starting from scratch.

**Sarah's Aha Moment:** "This isn't extra work - it's insurance against my own forgetfulness."

---

### Journey 2: Marcus Thompson - Managing the Chaos

Marcus quit his IT job six months ago to manage his rental portfolio full-time. Twenty-three properties across Austin, San Antonio, and Houston. What started as a side hustle buying duplexes has become a real business. He has a network of eight vendors he's built relationships with over the years - two plumbers, an electrician, two HVAC techs, a roofer, a handyman, and a cleaning crew.

It's 9:47 AM on a Thursday when everything happens at once.

His phone buzzes: tenant at Riverside reports AC not cooling. Before he can respond, another text: toilet overflowing at Congress Ave. He opens his email - the property manager at his Houston fourplex reports a roof leak in unit 3. His handyman texts asking for the gate code to Lamar St because he's there to finish yesterday's drywall repair.

Marcus has four active problems across three cities, and his day just started.

**The Old Way (Notes App + Text Threads):**

Marcus opens his notes app and types: "Riverside - AC, Congress - toilet, Houston - roof, Lamar - ongoing." He scrolls through text threads to find his HVAC guy's number. Calls, no answer, leaves voicemail. Texts his plumber for Congress Ave. Searches his email for the roofer he used in Houston last year - was it Martinez Roofing or Martinez Construction? He finds the thread, forwards the tenant's photos, asks for a quote.

By noon, Marcus has made 11 phone calls, sent 23 texts, and still isn't sure who confirmed what. He creates a reminder to follow up tomorrow. When his wife asks about his day at dinner, he says, "I honestly don't know which fires are out and which are still burning."

**The New Way (Property Manager Work Orders):**

Same Thursday, same four problems. Marcus opens Property Manager on his laptop.

He creates the first work order: Riverside, AC not cooling, category HVAC. He clicks "Assign Vendor" and sees his two HVAC techs listed with their trade tags. He picks Tony - he did good work at this property before. One click sends Tony an email with the property address, tenant contact info, and problem description. Work order status: Assigned.

Congress Ave toilet: he creates the work order, assigns his plumber Ray, sends the email. Twenty seconds.

Houston roof: creates work order, but he doesn't have a Houston roofer in the system. He adds a new vendor - just the name and phone number, enough to move forward. He can add email and trade tags later. Assigns the work order, makes the call. Now they're in the system for next time.

Lamar St drywall: he finds the existing work order from yesterday, sees it's still "Assigned" to his handyman, texts him the gate code directly.

Marcus looks at his dashboard: four work orders, four properties, three assigned and pending, one in progress. All on one screen. When Tony the HVAC tech texts "AC fixed, capacitor was bad, $180," Marcus opens the Riverside work order, marks it complete, and later links the expense when Tony's invoice arrives.

At dinner, Marcus knows exactly where things stand. "Three done, one waiting on a quote from Houston. Productive day."

**Marcus's Aha Moment:** "I can see everything at once instead of reconstructing it from memory and text threads."

---

### Journey 3: Joe Garza - The Vendor on the Receiving End

Joe has been a licensed plumber in Austin for 22 years. He runs a two-man operation with his nephew, handles mostly residential work, and gets most of his jobs through word of mouth and repeat customers. He doesn't use apps to manage his business - he's got a spiral notebook in his truck and a whiteboard in his garage. His phone is for calls, texts, and the occasional email when a property manager sends something formal.

Marcus has used Joe for plumbing work across six properties over the past three years. Joe's reliable, fairly priced, and answers his phone. That's all Marcus needs.

**Thursday, 10:02 AM:**

Joe's on his way to a job when his phone buzzes with an email notification. He glances at it while stopped at a red light:

> **Subject: Work Order - 2847 Congress Ave, Unit B**

He opens it when he arrives at his current job site:

> **Work Order Request**
>
> **Property:** 2847 Congress Ave, Unit B, Austin TX 78704
>
> **Issue:** Toilet overflowing in main bathroom
>
> **Category:** Plumbing
>
> **Reported:** January 8, 2026
>
> **Tenant Contact:** Maria Chen, (512) 555-8821
>
> **Property Owner:** Marcus Thompson, (512) 555-4455
>
> **Notes:** Tenant says it started this morning, tried plunging but water keeps rising.
>
> **Photo attached:** [toilet_overflow.jpg]
>
> ---
> Reply to this email or call Marcus to confirm availability.

Joe glances at the photo - looks like a standard clog, maybe the wax ring if there's water at the base. He texts Marcus: "Can be there around 2, that work?" Marcus replies: "Perfect, thanks Joe."

At 2:15 PM, Joe fixes the clog (tree roots in the main line, needs a follow-up with a camera scope). He texts Marcus: "Done for now, but you've got root intrusion. I'll send a quote for the scope and possible repair." He writes up the invoice that evening: $175 service call, and emails it to Marcus.

Marcus receives the invoice, opens the Congress Ave work order in Property Manager, marks it complete, adds a note: "Root intrusion found, Joe sending quote for scope." When the invoice comes through, he creates the expense and links it to the work order. Done.

**What Joe never had to do:**
- Download an app
- Create an account
- Learn a new system
- Change how he works

**Joe's Non-Aha Moment:** "That was just a normal job." *And that's the point.*

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---------|---------------------------|
| **Sarah (Retrospective)** | Expense-first workflow, link work order from expense, minimal friction creation, photo attachment, property work history, DIY vendor support |
| **Marcus (Operational)** | Work order dashboard, quick vendor assignment, vendor email notification, add vendor on the fly with minimal required fields, status tracking, multi-property visibility, expense linking from work order |
| **Joe (Vendor)** | Email work order delivery, essential info only, photo attachment in email, no vendor login required, clear reply instructions |

### Design Principles from Journeys

**Progressive Data Entry:** Capture the minimum to move forward, enrich when convenient. Marcus adds a vendor with just a name and phone number - trade tags and email can come later.

**The Process Should Never Be the Goal:** High-functioning users work around rigid systems. If adding a vendor requires 8 fields before you can assign a work order, users will find workarounds. The system accommodates real workflows.

**Meet Users Where They Are:** Joe the plumber has worked the same way for 22 years. Property Manager sends him an email - he doesn't need to adopt a new system. The value is for Marcus; Joe just gets a clear, professional work order.

**Retrospective Value is Real Value:** Sarah doesn't see the benefit of work orders until tax time, six months later. The system must make it easy enough that she captures context even when the immediate value isn't obvious.

## Web Application Requirements

### Platform & Browser Support

Continuing from Phase 1 decisions - no changes for Phase 2:

| Platform | Browser | Use Case |
|----------|---------|----------|
| Mobile (iOS) | Safari | Receipt capture, quick work order creation |
| Mobile (Android) | Chrome | Same as iOS |
| Desktop/Laptop | Chrome | Primary for data entry, work order management, reporting |

**Target:** Modern evergreen browsers only. No legacy browser support.

### Responsive Design

- **Mobile-first approach** - All Phase 2 features (work orders, vendors) must work on mobile
- **Work order creation** - Optimized for phone (Sarah at soccer practice, Marcus in the field)
- **Work order dashboard** - Readable on mobile, optimized for desktop (Marcus managing multiple fires)
- **Vendor management** - Functional on mobile, designed for desktop

### New Routes (Phase 2)

| Route | Purpose | Primary Device |
|-------|---------|----------------|
| `/work-orders` | Dashboard - all active work orders | Desktop (Kanban view) |
| `/work-orders/:id` | Work order detail | Both |
| `/work-orders/new` | Create work order | Both |
| `/vendors` | Vendor list | Desktop |
| `/vendors/:id` | Vendor detail + work history | Both |
| `/properties/:id/work-orders` | Property work order history | Both |

### Email Integration

**Deferred to Growth phase.** Questions to resolve:
- From address: System email with reply-to user? User's own email via OAuth?
- Email template design

For MVP, users generate Work Order PDF and share manually (text, email from their own client, etc.). This keeps MVP scope lean while still delivering core value.

### Future Mobile Considerations

The current Angular SPA + .NET API architecture supports future mobile app options:

- **PWA path:** Add service worker, manifest - installable with offline support
- **Native wrapper path:** Capacitor wraps existing Angular code for app store distribution
- **Architecture principle:** Keep API clean and mobile-friendly, responsive CSS, no desktop-only features

No specific mobile app work in Phase 2, but architectural decisions should not close doors.

### Performance Targets

Continuing Phase 1 targets:
- Page load: Under 3 seconds on typical broadband
- Work order list: Handle hundreds of records with pagination
- PDF generation: Under 10 seconds per work order

### SEO & Accessibility

- **SEO:** Not applicable (authenticated application)
- **Accessibility:** Standard good practices - keyboard navigation, proper labels, sufficient contrast

## Scoping Decisions

### MVP Philosophy

**Approach:** Platform MVP - Build the foundation for future AI dispatch while delivering immediate work order value.

**Rationale:** Each phase builds incrementally. Person entity abstraction enables future Tenant feature. Separate taxonomies enable future AI matching. The architecture investment pays forward.

### MVP Scope Validation

**Essential for MVP:**
- Person entity (foundation for Vendor, future Tenant) - confirmed essential
- All 5 phases (A through E) with email deferred
- Both user journeys supported (Sarah's retrospective, Marcus's operational)

**Scope Adjustment:**
- Work Order PDF generation: **MVP** (extends existing PDF service)
- Email work order to vendor: **Moved to Growth** (requires solving "from address" question)

### Phase Summary (Final)

| Phase | Deliverables |
|-------|--------------|
| **A - Foundation** | Person entity, Expense Category taxonomy (hierarchical), Vendor Trade Tag taxonomy (flat), Category-Trade mapping, Polymorphic Notes table |
| **B - Core Entities** | Vendor (extends Person + trade tags), Work Order (property, status, category, description, tags) |
| **C - Attachments & Links** | Photos on Work Order, Notes on Work Order, Work Order ↔ Expense bidirectional relationship |
| **D - Integration** | Work Order dropdown on receipt processing, Expense linking from Work Order detail, Work Order linking from Expense detail |
| **E - Output** | Work Order PDF generation (extends existing PDF service) |

### Growth Features (Post-MVP)

**Immediate Growth (next after MVP):**
- Email work order to vendor (solve from-address question)
- Vendor performance tracking (ratings, response time)

**Later Growth:**
- Work order templates for common issues
- Bulk work order operations
- Dashboard widgets for work order metrics
- Property maintenance history timeline

### Vision (Future)

- AI-assisted vendor recommendations
- AI dispatcher for vendor assignment suggestions
- Tenant portal for maintenance requests
- Vendor portal for job updates
- Preventive maintenance scheduling

### Risk Mitigation

**Technical Risk:** Person entity abstraction adds upfront work but prevents refactor when Tenant ships. Worth the investment.

**Scope Risk:** Email deferred to Growth - reduces MVP complexity without blocking core value (Marcus can still call/text Joe, just generates PDF to share).

**Pattern Risk:** Mitigated by "same tree, new branches" principle - extend existing patterns only.

## Architecture Decision: Project Structure

### Decision: Single Project with Folder-Based Separation

Work Orders and Vendors will be added to the existing project structure, not as separate projects.

**Rationale:**
- Work Orders are tightly coupled to Properties (a work order belongs to a property)
- Shared data models and relationships across domains
- Same user context, same database, same infrastructure
- Single person maintaining the codebase
- Same deployment pipeline

**Structure (folder-based separation within layers):**

```
PropertyManager.Application/
├── Properties/
│   ├── Commands/
│   └── Queries/
├── Expenses/
│   ├── Commands/
│   └── Queries/
├── WorkOrders/          ← New folder
│   ├── Commands/
│   └── Queries/
├── Vendors/             ← New folder
│   ├── Commands/
│   └── Queries/
└── Common/

PropertyManager.Domain/
├── Entities/
│   ├── Property.cs
│   ├── Expense.cs
│   ├── Person.cs        ← New (base entity)
│   ├── Vendor.cs        ← New
│   └── WorkOrder.cs     ← New
```

**Benefits:**
- Logical separation via folders/namespaces
- Single deployment unit
- Shared infrastructure (one DbContext, one set of patterns)
- Easy to navigate
- Easy to split later if genuine need arises

**When to revisit:**
- Application folder exceeds 100+ files and becomes hard to navigate
- Multiple developers need clear ownership boundaries
- Independent deployment requirements emerge

This follows the "same tree, new branches" principle - extend existing structure, don't create parallel structures.

## Functional Requirements

### Person Management (Foundation)

- FR1: System supports Person as a base entity with first name, middle name, last name
- FR2: System supports multiple phone numbers per Person with optional labels
- FR3: System supports multiple email addresses per Person
- FR4: Person records include standard audit fields (created, updated, soft delete)
- FR5: Person entity serves as base for Vendor (and future Tenant, User refactor)

### Vendor Management

- FR6: Users can create a new vendor with minimal required fields (name only)
- FR7: Users can add optional vendor details (phone, email, trade tags) at any time
- FR8: Users can assign one or more trade tags to a vendor
- FR9: Users can view a list of all vendors
- FR10: Users can search/filter vendors by name or trade tag
- FR11: Users can edit vendor details
- FR12: Users can delete a vendor (soft delete)
- FR13: Users can view a vendor's work order history
- FR14: System allows vendor creation inline during work order assignment (no blocking validation)

### Work Order Management

- FR15: Users can create a work order linked to a property
- FR16: Users can set work order status (Reported, Assigned, Completed)
- FR17: Users can assign a category to a work order (from expense category taxonomy)
- FR18: Users can add a description to a work order (free-form text)
- FR19: Users can add tags to a work order (GitHub-style autocomplete)
- FR20: Users can assign a work order to a vendor
- FR21: Users can assign a work order to "Self" (DIY)
- FR22: Users can view all work orders in a dashboard view
- FR23: Users can filter work orders by status
- FR24: Users can filter work orders by property
- FR25: Users can view work order detail page
- FR26: Users can edit work order details
- FR27: Users can delete a work order (soft delete)
- FR28: Users can view work order history for a specific property

### Work Order-Expense Integration

- FR29: Users can link an existing expense to a work order
- FR30: Users can link an existing work order to an expense
- FR31: Users can create a work order from an expense detail page (retroactive)
- FR32: Users can create an expense from a work order detail page
- FR33: Users can view linked work order context when viewing an expense
- FR34: Users can view linked expenses when viewing a work order
- FR35: Work order dropdown appears on receipt processing form (active work orders only)
- FR36: A work order can have zero or many linked expenses
- FR37: An expense can have zero or one linked work order

### Taxonomy Management

- FR38: System maintains expense categories as hierarchical taxonomy
- FR39: System maintains vendor trade tags as flat taxonomy
- FR40: System maintains mappings between expense categories and trade tags
- FR41: Users see autocomplete suggestions when entering tags (work order tags, vendor trade tags)

### Notes & Attachments

- FR42: Users can add notes to a work order (timestamped entries)
- FR43: Users can attach photos to a work order
- FR44: Users can view photos attached to a work order
- FR45: Users can delete photos from a work order
- FR46: Users can delete notes from a work order
- FR47: Notes system is polymorphic (reusable for future entities)

### Document Generation

- FR48: Users can generate a PDF for a single work order
- FR49: Work order PDF includes: property info, issue description, status, category, assigned vendor, notes, linked expenses
- FR50: Users can download the generated work order PDF
- FR51: Users can preview work order PDF before download

## Non-Functional Requirements

### Performance

**Page Load & Navigation:**
- NFR1: Page load time under 3 seconds on typical broadband
- NFR2: Navigation between routes completes in under 1 second
- NFR3: Form submissions provide feedback within 500ms

**Data Operations:**
- NFR4: Work order list handles 500+ records with pagination (no client-side performance degradation)
- NFR5: Search/filter operations return results within 1 second
- NFR6: Photo upload completes within 5 seconds for images under 5MB

**Document Generation:**
- NFR7: Work order PDF generation completes within 10 seconds
- NFR8: PDF preview renders without blocking UI

### Security

**Authentication & Authorization:**
- NFR9: All routes require authentication (no anonymous access to data)
- NFR10: Users can only access their own properties, work orders, vendors, expenses
- NFR11: JWT tokens expire appropriately (current system patterns)

**Data Protection:**
- NFR12: All data transmitted over HTTPS (TLS 1.2+)
- NFR13: Passwords stored with secure hashing (current system patterns)
- NFR14: Sensitive data not logged in plain text

**Session Security:**
- NFR15: Sessions invalidate on logout
- NFR16: Concurrent session handling follows current system patterns

### Maintainability & Testability

**Code Quality:**
- NFR17: New code follows existing Clean Architecture patterns
- NFR18: New code follows existing folder/namespace conventions
- NFR19: No new architectural patterns without documented justification

**Test Coverage:**
- NFR20: Unit tests cover business logic in Application layer handlers
- NFR21: E2E tests cover critical user workflows (work order CRUD, linking)
- NFR22: Test coverage maintained at current project levels for new code

**Documentation:**
- NFR23: API endpoints documented in Swagger/OpenAPI
- NFR24: Complex business logic has inline comments explaining "why"
