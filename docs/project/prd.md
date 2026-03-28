# property-manager - Product Requirements Document

**Author:** Dave
**Date:** 2025-11-28
**Version:** 2.0 (evolved 2026-03-28)

---

## Executive Summary

Property Manager is a lean property management platform for small landlords. It manages the full lifecycle of property ownership — from a tenant reporting a leaky faucet, to a vendor completing the repair, to the receipt becoming a line item on IRS Schedule E.

Built for landlords who manage properties as a team (typically a couple), the system covers the daily workflows that small property owners actually deal with: tracking expenses, managing work orders, coordinating with vendors, capturing receipts, and producing tax-ready reports. The entire landlord-to-tenant-to-vendor workflow is handled in one place, without the enterprise bloat of tools built for large property management companies.

### What Makes This Special

**Full lifecycle, no bloat.** Competitors like AppFolio and Buildium are built for property management companies with hundreds of units. They're packed with features nobody asked for. Property Manager is built for the landlord with 5-50 properties who wants things to just work.

**The core workflow:**
1. Tenant submits a maintenance request through the tenant portal
2. Landlord reviews and assigns a vendor
3. Vendor completes the work, receipts are captured
4. Expense is created and linked to the work order
5. At tax time, one click → Schedule E worksheets ready for the accountant

**Competitive advantage:** Solo developer with agentic coding tools can ship faster and respond to real user feedback quicker than enterprise teams with 50 people shipping features nobody asked for.

### Secondary Value

This is Dave's graduate school — a career-building portfolio piece demonstrating full-stack SaaS development from database design to Stripe integration to deployment. Even if the business doesn't scale, the skills transfer directly to professional work.

---

## Project Classification

**Technical Type:** web_app (SaaS)
**Domain:** real estate / property management
**Complexity:** moderate
**Business Model:** Subscription SaaS (Stripe integration planned)
**Legal Entity:** LLC formed, EIN in progress

This is a browser-based SPA with a .NET backend, designed for responsive use on desktop and mobile. Multi-role: landlords, co-managers, and tenants. Deployed on Render with a production URL.

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Angular 21 + @ngrx/signals | Expert knowledge, structured state management |
| Backend | .NET 10 + ASP.NET Core | Expert knowledge, Clean Architecture |
| Database | PostgreSQL + EF Core 10 | Proven, cloud-ready, excellent tooling |
| API Contracts | NSwag | Auto-generate TypeScript from C# |
| Architecture | Clean Architecture + CQRS/MediatR | Testable, maintainable |
| Hosting | Render | Deployed, production-ready |
| Payments | Stripe (planned) | Subscription billing |

---

## User Roles

### Property Owner (Primary — the paying subscriber)
The person who owns the rental properties. Creates the account, manages billing, oversees everything. This is the person who currently deals with a shoebox of receipts, coordinates repairs, and dreads tax time.

### Co-Manager (Invited by owner)
Typically the owner's spouse or business partner. Same access to properties, expenses, work orders, and reports. Invited by the primary owner. Reflects the reality that small property management is almost always a team effort.

### Tenant (Portal user)
Lives in the property. Interacts through a lightweight tenant portal. Initially can only submit maintenance requests and view their status. Does NOT have access to financial data, other tenants, or landlord workflows.

### Vendor (Not a user)
Plumbers, electricians, handymen. Vendors are data entities referenced by work orders — they do not log in to the system. Landlords track vendor contact info, trade tags, and work history, but vendors interact through phone/email, not through the app.

---

## Success Criteria

### The Magic Moment
A tenant submits a maintenance request. The landlord assigns it to a vendor. The work gets done, the receipt is captured, the expense is created, and at tax time it shows up on the Schedule E worksheet — all without leaving the app.

### User Adoption (The Real Test)
- **"It's part of my routine"** — The beta user integrates it into their property management workflow
- **"I like this"** — Positive feedback, not just tolerance
- **They keep using it** — Sustained adoption, not a one-week trial that fades

### Demo Readiness
Before demoing to the target beta candidate:
- Co-manager invitation flow with UI (not just API)
- Tenant portal (minimal — submit maintenance request, view status)
- Stripe integration (demonstrates project maturity and technical capability)

### Tax Time Victory (Still Core)
- One-click export → Schedule E worksheets for all properties
- Accountant-ready — no back-and-forth questions
- Every expense traceable back to a work order, receipt, or manual entry

### Data Integrity
- Nothing gets lost — every expense reliably stored
- Accurate totals — reports match bank statements
- Audit-ready — any line item traceable to source

### Technical Learning (Dave's Goals)
- **Full-stack SaaS** — Auth, multi-tenancy, Stripe, tenant portal, deployment
- **Agentic development** — Built with Claude Code, demonstrating what solo dev + AI can produce
- **Portfolio piece** — LinkedIn-worthy: "Built a SaaS property management platform with Stripe integration"

---

## Product Scope

### Built (Epics 1-17)

**Core Data Management:**
- Properties: CRUD with photos, detail pages
- Expenses: CRUD with Schedule E categories, duplicate detection, date range filtering
- Income: CRUD with filtering
- Receipt capture: Mobile camera, S3 upload, process into expense, real-time sync via SignalR
- Schedule E PDF generation: Per-property and batch

**Workflow Management:**
- Vendors: CRUD with trade tags, contact info, detail pages with work history
- Work orders: Create, assign vendor (or DIY), status tracking, category hierarchy, tag system
- Work order photos and notes
- Expense ↔ work order linking (bidirectional)
- Create expense from work order, create work order from expense

**Platform:**
- Authentication: Registration, login, JWT, password reset, email verification
- Invitation system (API-level, no UI yet)
- Dashboard with financial summaries and date range filtering
- Responsive design (desktop primary, mobile for receipt capture)
- CI/CD pipeline (GitHub Actions), deployed on Render

### Next Phase (Demo-Ready)

| Feature | Description | Why |
|---------|-------------|-----|
| Co-manager invitation UI | Primary owner invites co-manager via email, UI for the invitation flow | Small landlords work as a team |
| RBAC | Owner and co-manager roles with appropriate permissions | Foundation for multi-user |
| Tenant portal (minimal) | Tenant submits maintenance request, views status | Core workflow starts with the tenant |
| Stripe integration | Subscription billing for landlord accounts | Business model + credibility for demo |

### Future State

| Feature | Description |
|---------|-------------|
| Tenant portal — Phase 2 | Lease info, payment history |
| Tenant portal — Phase 3 | Rent payments via Stripe |
| Lease management | Store lease terms, renewal dates, rent amounts |
| Landlord-tenant messaging | Communication within the platform |
| Advanced financial dashboards | Profit/loss, cash flow beyond Schedule E |
| General document storage | Leases, insurance, tax docs |
| Mileage tracking | Auto-calculate mileage for property visits |
| AI receipt categorization | Auto-categorize from receipt photos |
| Bank integration | Auto-import transactions |

### Out of Scope (Permanently)
- Enterprise property management (100+ units)
- HOA management
- Commercial real estate
- Mortgage origination

---

## Functional Requirements

### User Account & Access (Built)

- **FR1:** Users can register a new account with email and password
- **FR2:** Users receive email verification after registration
- **FR3:** Users can log in with email and password
- **FR4:** Users can log out and sessions are terminated securely
- **FR5:** Users can reset their password via email
- **FR6:** System maintains user session across browser tabs

### Multi-User & Roles (Next Phase)

- **FR58:** Primary owner can invite a co-manager via email
- **FR59:** Co-manager receives invitation email with registration link
- **FR60:** Co-manager has full access to the account's properties, expenses, work orders, and reports
- **FR61:** Primary owner can revoke co-manager access
- **FR62:** Invitation management UI shows pending and accepted invitations

### Property Management (Built)

- **FR7:** Users can create a new property with name and address
- **FR8:** Users can view a list of all their properties
- **FR9:** Users can edit property details (name, address)
- **FR10:** Users can delete a property (with confirmation)
- **FR11:** Users can view a single property's detail page

### Expense Management (Built)

- **FR12:** Users can create an expense linked to a specific property
- **FR13:** Expenses have required fields: amount, date, category, property
- **FR14:** Expenses have optional fields: description, receipt attachment
- **FR15:** Users can edit an existing expense
- **FR16:** Users can delete an expense (with confirmation)
- **FR17:** Users can view a list of expenses for a single property
- **FR18:** Users can view a list of all expenses across all properties
- **FR19:** Expense categories align with IRS Schedule E line items
- **FR20:** Users can filter expenses by date range
- **FR21:** Users can filter expenses by category
- **FR22:** Users can search expenses by description text

### Income Management (Built)

- **FR23:** Users can create an income entry linked to a specific property
- **FR24:** Income entries have required fields: amount, date, property
- **FR25:** Income entries have optional fields: description, source
- **FR26:** Users can edit an existing income entry
- **FR27:** Users can delete an income entry (with confirmation)
- **FR28:** Users can view income entries for a single property
- **FR29:** Users can filter income by date range

### Receipt Management (Built)

- **FR30:** Users can capture a receipt photo using device camera (mobile)
- **FR31:** Users can upload a receipt image from device storage (desktop)
- **FR32:** Receipts are stored in cloud blob storage (S3)
- **FR33:** Users can create a receipt without immediately linking to an expense
- **FR34:** Users can view a list of unprocessed receipts
- **FR35:** Users can link an existing receipt to an expense
- **FR36:** Users can view the receipt image attached to an expense
- **FR37:** Users can delete a receipt

### Dashboard & Views (Built)

- **FR38:** Dashboard displays total expenses across all properties for selected date range
- **FR39:** Dashboard displays total income across all properties for selected date range
- **FR40:** Dashboard displays net income (income minus expenses)
- **FR41:** Dashboard displays a list of all properties with individual totals
- **FR42:** Users can click a property to navigate to its detail page
- **FR43:** Property detail page shows expense total
- **FR44:** Property detail page shows income total
- **FR45:** Property detail page shows list of recent expenses
- **FR46:** Property detail page shows list of recent income entries
- **FR47:** Users can select date ranges for filtering (presets and custom)
- **FR48:** All totals and lists respect the selected date range filter

### Vendor Management (Built)

- **FR63:** Users can create a vendor with name, contact info, trade tags
- **FR64:** Users can view, edit, and delete vendors
- **FR65:** Users can search and filter vendors by trade, name
- **FR66:** Vendor detail page shows work order history

### Work Order Management (Built)

- **FR67:** Users can create a work order linked to a property
- **FR68:** Work orders can be assigned to a vendor or marked DIY
- **FR69:** Work orders have status tracking (Reported → Assigned → Completed)
- **FR70:** Work orders support photos, notes, and tags
- **FR71:** Expenses can be linked to work orders (bidirectional)
- **FR72:** Users can create an expense from a work order or vice versa

### Tax Reporting (Built)

- **FR49:** Users can generate a Schedule E worksheet PDF for a single property
- **FR50:** Users can generate Schedule E worksheet PDFs for all properties in one action
- **FR51:** Generated PDFs include property address, expense categories with totals, income total
- **FR52:** Users can select the tax year for report generation
- **FR53:** Generated PDFs can be downloaded
- **FR54:** Generated PDFs can be previewed before download

### Tenant Portal (Next Phase — Minimal)

- **FR73:** Tenants can log in with a separate tenant role
- **FR74:** Tenants can submit a maintenance request (description, optional photo)
- **FR75:** Maintenance requests create a work order visible to the landlord
- **FR76:** Tenants can view the status of their submitted requests
- **FR77:** Tenants cannot access financial data, other tenants, or landlord workflows

### Stripe Integration (Next Phase)

- **FR78:** Landlord accounts have a subscription plan managed via Stripe
- **FR79:** Primary owner can manage billing (update payment method, view invoices)
- **FR80:** Subscription status gates access to the platform (grace period for lapses)
- **FR81:** Stripe webhooks update account status on payment events

### Data Integrity (Built)

- **FR55:** All data changes are persisted immediately
- **FR56:** Deleted items are soft-deleted
- **FR57:** System prevents duplicate expense entries (with override option)

---

## Non-Functional Requirements

### Performance

- **NFR1:** Pages load in under 3 seconds on typical broadband
- **NFR2:** Expense list pagination handles hundreds of records without degradation
- **NFR3:** PDF generation completes within 10 seconds per property

### Security

- **NFR4:** All data transmitted over HTTPS (TLS 1.2+)
- **NFR5:** Passwords hashed using industry-standard algorithm
- **NFR6:** JWT authentication with appropriate expiration
- **NFR7:** API endpoints require authentication
- **NFR8:** Receipt images stored in private S3 bucket with signed URLs
- **NFR9:** S3 objects encrypted at rest
- **NFR10:** Database credentials in environment variables (not in code)
- **NFR11:** Application runs in isolated container
- **NFR12:** Input validation on all user-submitted data
- **NFR13:** CORS configured to allow only the application domain
- **NFR28:** Tenant role cannot access landlord data (role-based API authorization)
- **NFR29:** Stripe webhook signatures verified to prevent spoofing

### Scalability

- **NFR14:** Multi-tenant data model (AccountId on all tables) — already implemented
- **NFR15:** Stateless API design for horizontal scaling
- **NFR16:** Database connection pooling configured
- **NFR17:** Receipt storage in S3 (scales independently)

### Backup & Recovery

- **NFR18:** Database backups run automatically (daily minimum)
- **NFR19:** Point-in-time recovery for at least 7 days
- **NFR20:** S3 versioning enabled for receipt images
- **NFR21:** Backup restoration tested and documented

### Availability

- **NFR22:** Target 99% uptime
- **NFR23:** Graceful error handling with user-friendly messages

### Maintainability

- **NFR24:** Clean Architecture patterns
- **NFR25:** Automated tests for critical paths
- **NFR26:** CI/CD pipeline (GitHub Actions → Render)
- **NFR27:** Structured logging sufficient to diagnose issues

---

## Web Application Requirements

### Browser Support
| Platform | Browser | Notes |
|----------|---------|-------|
| Mobile (iOS) | Safari | Receipt capture, tenant portal |
| Mobile (Android) | Chrome | Receipt capture, tenant portal |
| Desktop/Laptop | Chrome | Primary for landlord data entry and reporting |

### Responsive Design
- **Mobile-first for tenant portal** — maintenance requests from phone
- **Mobile for receipt capture** — camera flow must work smoothly
- **Desktop-optimized for landlord workflows** — forms, lists, reports

### Accessibility
Standard good practices: keyboard navigation, proper form labels, sufficient color contrast, screen reader compatible markup.

### Real-Time Features
- SignalR for receipt sync between devices (built)
- Future: real-time notification when tenant submits maintenance request

---

## PRD Summary

| Metric | Count |
|--------|-------|
| Functional Requirements | 81 (FR1-FR81) |
| Non-Functional Requirements | 29 (NFR1-NFR29) |
| User Roles | 3 (Owner, Co-Manager, Tenant) + Vendor (data only) |
| Features Built | Epics 1-17 |
| Next Phase | Co-manager UI, Tenant Portal (minimal), Stripe |

### Key Design Decisions
- **UX:** "Obvious, not clever" — friendly, no bloat
- **Security:** Multi-tenant from day 1, role-based access
- **Architecture:** Clean Architecture + CQRS
- **Business:** SaaS subscription model, LLC formed

### The Pitch
A lean property management platform for small landlords. Full lifecycle from tenant repair request to Schedule E tax report. No enterprise bloat. Built by a developer who actually manages rental properties.

---

_Evolved from v1.0 (2025-11-28) through collaborative discovery. Original vision: single-user tax tool. Current vision: multi-role SaaS property management platform._
