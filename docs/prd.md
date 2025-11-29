# property-manager - Product Requirements Document

**Author:** Dave
**Date:** 2025-11-28
**Version:** 1.0

---

## Executive Summary

Property Manager is a web application that transforms chaotic paper-based rental property expense tracking into organized, tax-ready financial records. Built for small landlords managing properties as a side business, the system captures expenses throughout the year and generates reports that map directly to IRS Schedule E (Supplemental Income and Loss), eliminating the annual scramble to gather paperwork for accountants.

The primary user is a non-technical property manager (Dave's wife) who needs simple, fast expense entry. The system prioritizes practical daily usability over feature complexity, with the core value proposition being: **enter expenses easily throughout the year, get accountant-ready reports at tax time.**

### What Makes This Special

**"From Shoebox to Schedule E"** - This isn't generic expense tracking. Every feature is designed around one outcome: transforming scattered paper receipts into the exact format accountants need for Schedule E tax reporting. The system understands rental property tax categories natively, so users don't need to think about tax implications when entering data - they just record what they spent, and the system organizes it correctly.

Secondary value: This is Dave's hands-on cloud computing learning project - full ownership from database design to deployment, building skills that complement his day-job experience.

---

## Project Classification

**Technical Type:** web_app
**Domain:** general (real estate/property management)
**Complexity:** low

This is a browser-based single-page application (SPA) with a .NET backend, designed for responsive use on desktop and mobile browsers. The domain is straightforward property expense management with no specialized regulatory requirements (not fintech, not healthcare). Standard security and data protection practices apply.

### Technology Stack (from brainstorming session)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Angular 19 + @ngrx/signals | Expert knowledge, structured state management |
| Backend | .NET 8 + ASP.NET Core | Expert knowledge, Clean Architecture |
| Database | PostgreSQL + EF Core | Proven, cloud-ready, excellent tooling |
| API Contracts | NSwag | Auto-generate TypeScript from C# |
| Architecture | Clean Architecture + CQRS/MediatR | Testable, maintainable |

---

## Success Criteria

### The Magic Moment
**One click → PDF worksheets for every property, Schedule E format, ready to email or print.**

That's the test. If your wife can click a button at tax time and hand the accountant exactly what they need - no scrambling, no follow-up questions, no missing receipts - the product succeeded.

### User Adoption (Primary User: Your Wife)
- **She actually uses it** - Prefers the app over paper/spreadsheets for expense entry
- **Minimal friction** - Adding an expense takes under 30 seconds
- **Self-sufficient** - Doesn't need to ask Dave "how do I...?" for normal operations
- **Trust** - She believes the data is complete and correct

### Tax Time Victory
- **One-click export** - Generate Schedule E worksheets for all properties instantly
- **Accountant-ready** - No back-and-forth questions about categorization or missing data
- **No surprises** - No "oh wait, we forgot about that $2,000 repair" after filing
- **Dramatic time savings** - Hours of annual prep work reduced to minutes

### Data Integrity
- **Nothing gets lost** - Every expense entered is reliably stored
- **Accurate totals** - Reports match bank statements and receipts
- **Audit-ready** - If questioned, you can trace any line item back to source

### Technical Learning (Dave's Goals)
- **Full ownership** - Built and deployed the entire stack yourself
- **Cloud fluency** - Confident with cloud infrastructure decisions
- **Pride in craft** - Codebase demonstrates Clean Architecture done right
- **Reusable knowledge** - Skills transfer to day job and future projects

---

## Product Scope

### MVP - Minimum Viable Product

The first tax season. Everything needed to go from "paper shoebox" to "Schedule E PDFs ready for accountant."

**Core Data Management:**
- Properties: Add, edit, delete rental properties (name, address)
- Expenses: Add, edit, delete expenses linked to properties
- Income: Track rental income per property
- Categories: Expense categories aligned with Schedule E line items

**Views & Dashboard:**
- Dashboard: Basic expenses overview across all properties
- Single property view: Expenses and income for one property
- All properties total: Aggregate expenses across portfolio
- Year-to-date filtering: View data by tax year

**Receipt Capture (Mobile-First):**
- Mobile: Property detail → "Save Receipt" button → Camera opens → Photo saved to S3
- "Capture now, categorize later" workflow - minimal friction at point of purchase
- Link receipts to expenses when convenient

**Tax Reporting:**
- One-click PDF export: Generate Schedule E worksheet per property
- All properties export: Batch generate all worksheets

**Authentication:**
- User login (single user for MVP - Dave's wife)

**Out of Scope for MVP:**
- Mortgage interest tracking (accountant handles)
- Partial ownership % calculations (properties owned outright)
- Multi-user / sharing
- Tenant management
- Vendor management

### Growth Features (Post-MVP)

_To be revisited after first successful tax season._

- **Multi-user support** - Friends and partners with their own accounts/properties
- **Mileage tracking** - Start trip → drive → auto-calculate mileage (primary user already values this pattern from work)
- **Shared properties** - Co-ownership scenarios if needed

### Vision (Future)

_Parked for now. Revisit when Growth features are proven._

- White-label SaaS for other small landlords
- Bank integration for auto-importing transactions
- AI-powered expense categorization from receipt photos
- Tenant portal
- Vendor management / 1099 generation

---

## Web Application Requirements

### Browser Support
| Platform | Browser | Notes |
|----------|---------|-------|
| Mobile (iOS) | Safari | Primary mobile use for receipt capture |
| Mobile (Android) | Chrome | If needed |
| Desktop/Laptop | Chrome | Primary for data entry and reporting |

**Target:** Modern evergreen browsers only. No legacy browser support required.

### Responsive Design
- **Mobile-first for receipt capture** - Camera flow must work smoothly on phone
- **Desktop-optimized for data entry** - Forms, lists, and reports designed for larger screens
- **Dashboard readable on both** - Key metrics visible regardless of device

### SEO Strategy
Not applicable - authenticated application, no public-facing content.

### Real-Time Features
Not required. Standard request/response model. "Refresh to see updates" is acceptable.

### Accessibility
Standard good practices:
- Keyboard navigation
- Proper form labels
- Sufficient color contrast
- Screen reader compatible markup

No specific WCAG compliance certification required.

### Offline Capability
Not required for MVP. User can wait for connectivity to capture receipts.
_Future consideration: Offline capture → sync when online._

---

## User Experience Principles

### Design Philosophy
**"Obvious, not clever."**

The primary user is non-technical, busy with a full-time job, and currently tolerates Google Sheets because it's free - not because she enjoys it. The UI must be immediately understandable without explanation.

### Visual Personality
- **Friendly and colorful** - Not sterile corporate, not overwhelming
- **Big buttons** - Easy tap targets, hard to miss
- **Clear labels** - No icon-only mystery buttons
- **Visible navigation** - No hidden hamburger menus for critical functions
- **Obvious affordances** - If it's clickable, it looks clickable

### User Behavior Pattern
Primary user batches work - collects receipts throughout the week, then enters everything at once at home on desktop. Mobile capture is available but not the primary workflow initially.

**Design implication:** Desktop data entry must be fast and efficient. Mobile is secondary but ready when habits change.

### Key Interactions

**1. Dashboard (Home Screen)**
- Headline: "How much have we spent this year?" - total across all properties
- Property cards/list showing per-property totals
- Drill-down: Click property → see that property's detail

**2. Add Expense (Primary Action)**
- Quick form - minimal required fields
- Property selector (dropdown or recent)
- Amount, date, category, optional description
- Optional receipt attachment
- Save and done - no multi-step wizards

**3. Receipt Capture (Mobile)**
- Property detail page → "Add Receipt" button (big, obvious)
- Camera opens → snap photo → saved
- "Add details later" - receipt exists without full expense entry
- List of unprocessed receipts visible for later categorization

**4. Tax Report Generation**
- Clear "Generate Reports" action
- Year selector
- One click → all properties exported as PDFs
- Or select individual property

### Information Architecture

```
Dashboard (All Properties)
├── Total YTD expenses
├── Property cards with individual totals
│   └── Click → Property Detail
│       ├── Property expenses list
│       ├── Property income
│       ├── "Add Expense" button
│       ├── "Add Receipt" button (mobile)
│       └── "Generate Report" for this property
├── "Add Expense" (global quick-add)
└── "Generate All Reports"
```

### The Bar to Clear
Better than Google Sheets - which means:
- Faster to enter data (no scrolling to find the right row)
- Easier to categorize (dropdowns vs. typing)
- Reports generated automatically (no manual formulas)
- Receipts attached to records (no separate folder of photos)
- **Joy** - the feeling of "this is better" when using it

---

## Functional Requirements

### User Account & Access

- **FR1:** Users can register a new account with email and password
- **FR2:** Users receive email verification after registration
- **FR3:** Users can log in with email and password
- **FR4:** Users can log out and sessions are terminated securely
- **FR5:** Users can reset their password via email
- **FR6:** System maintains user session across browser tabs

### Property Management

- **FR7:** Users can create a new property with name and address
- **FR8:** Users can view a list of all their properties
- **FR9:** Users can edit property details (name, address)
- **FR10:** Users can delete a property (with confirmation)
- **FR11:** Users can view a single property's detail page

### Expense Management

- **FR12:** Users can create an expense linked to a specific property
- **FR13:** Expenses have required fields: amount, date, category, property
- **FR14:** Expenses have optional fields: description, receipt attachment
- **FR15:** Users can edit an existing expense
- **FR16:** Users can delete an expense (with confirmation)
- **FR17:** Users can view a list of expenses for a single property
- **FR18:** Users can view a list of all expenses across all properties
- **FR19:** Expense categories align with IRS Schedule E line items (advertising, auto/travel, cleaning/maintenance, commissions, insurance, legal/professional fees, management fees, mortgage interest, other interest, repairs, supplies, taxes, utilities, depreciation, other)
- **FR20:** Users can filter expenses by date range (year-to-date, custom range)
- **FR21:** Users can filter expenses by category
- **FR22:** Users can search expenses by description text

### Income Management

- **FR23:** Users can create an income entry linked to a specific property
- **FR24:** Income entries have required fields: amount, date, property
- **FR25:** Income entries have optional fields: description, source (e.g., tenant name)
- **FR26:** Users can edit an existing income entry
- **FR27:** Users can delete an income entry (with confirmation)
- **FR28:** Users can view income entries for a single property
- **FR29:** Users can filter income by date range

### Receipt Management

- **FR30:** Users can capture a receipt photo using device camera (mobile)
- **FR31:** Users can upload a receipt image from device storage
- **FR32:** Receipts are stored in cloud blob storage (S3)
- **FR33:** Users can create a receipt without immediately linking to an expense ("capture now, categorize later")
- **FR34:** Users can view a list of unprocessed receipts (not yet linked to expenses)
- **FR35:** Users can link an existing receipt to an expense
- **FR36:** Users can view the receipt image attached to an expense
- **FR37:** Users can delete a receipt

### Dashboard & Views

- **FR38:** Dashboard displays total expenses year-to-date across all properties
- **FR39:** Dashboard displays total income year-to-date across all properties
- **FR40:** Dashboard displays net income (income minus expenses) year-to-date
- **FR41:** Dashboard displays a list/cards of all properties with individual expense totals
- **FR42:** Users can click a property to navigate to its detail page
- **FR43:** Property detail page shows expense total for that property
- **FR44:** Property detail page shows income total for that property
- **FR45:** Property detail page shows list of recent expenses
- **FR46:** Property detail page shows list of recent income entries
- **FR47:** Users can select which tax year to view (default: current year)
- **FR48:** All totals and lists respect the selected tax year filter

### Tax Reporting

- **FR49:** Users can generate a Schedule E worksheet PDF for a single property
- **FR50:** Users can generate Schedule E worksheet PDFs for all properties in one action
- **FR51:** Generated PDFs include: property address, all expense categories with totals, income total, organized by Schedule E line item structure
- **FR52:** Users can select the tax year for report generation
- **FR53:** Generated PDFs can be downloaded to user's device
- **FR54:** Generated PDFs can be previewed before download

### Data Integrity

- **FR55:** All data changes are persisted immediately (no manual "save" required)
- **FR56:** Deleted items are soft-deleted with ability to restore (or permanently deleted with clear warning)
- **FR57:** System prevents duplicate expense entries (same property, amount, date, category within short time window - with override option)

---

## Non-Functional Requirements

### Performance

- **NFR1:** Pages load in under 3 seconds on typical broadband connection
- **NFR2:** Expense list pagination handles hundreds of records without degradation
- **NFR3:** PDF generation completes within 10 seconds per property

_No strict SLA required. "Reasonably fast" is the target - users shouldn't wait or feel friction._

### Security

**Design Principle:** "If we can't secure our own data, we can't secure someone else's." Build trustworthy from day 1.

- **NFR4:** All data transmitted over HTTPS (TLS 1.2+)
- **NFR5:** Passwords hashed using industry-standard algorithm (bcrypt/Argon2)
- **NFR6:** Authentication tokens (JWT) with appropriate expiration
- **NFR7:** API endpoints require authentication (no unauthenticated data access)
- **NFR8:** Receipt images stored in private S3 bucket with signed URLs (not public)
- **NFR9:** S3 objects encrypted at rest
- **NFR10:** Database credentials stored in environment variables/secrets manager (not in code)
- **NFR11:** Application runs in isolated container (not shared hosting with other tenants)
- **NFR12:** Input validation on all user-submitted data (prevent injection attacks)
- **NFR13:** CORS configured to allow only the application domain

### Scalability

**Design Principle:** Build for today's needs, but don't close doors. Not architecting for 1000 users on day 1, but avoid decisions that would require a rewrite.

- **NFR14:** Data model supports multi-user from day 1 (user_id on all tables) even if MVP is single user
- **NFR15:** Stateless API design (no server-side session state) to allow horizontal scaling later
- **NFR16:** Database connection pooling configured appropriately
- **NFR17:** Receipt storage in S3 (not local filesystem) - scales independently

### Backup & Recovery

**Design Principle:** Paper is the backup for now, but data loss would kill adoption. Don't make users re-enter everything.

- **NFR18:** Database backups run automatically (daily minimum)
- **NFR19:** Point-in-time recovery available for at least 7 days
- **NFR20:** S3 versioning enabled for receipt images
- **NFR21:** Backup restoration tested and documented

### Availability

- **NFR22:** Target 99% uptime (allows for maintenance windows, not mission-critical 24/7)
- **NFR23:** Graceful error handling with user-friendly messages (no stack traces shown to users)

### Maintainability

- **NFR24:** Codebase follows Clean Architecture patterns (from brainstorming decision)
- **NFR25:** Automated tests for critical paths (expense CRUD, PDF generation)
- **NFR26:** CI/CD pipeline for deployment (no manual server updates)
- **NFR27:** Logging sufficient to diagnose issues without reproducing them

---

## PRD Summary

| Metric | Count |
|--------|-------|
| Functional Requirements | 57 |
| Non-Functional Requirements | 27 |
| Capability Areas | 7 (Auth, Properties, Expenses, Income, Receipts, Dashboard, Reports) |

### MVP Scope Summary
- Single user (Dave's wife) managing 14 rental properties
- Expense and income tracking with Schedule E categories
- Mobile receipt capture with "categorize later" workflow
- Dashboard with YTD totals and per-property drill-down
- One-click PDF export for Schedule E worksheets

### Key Design Decisions
- **UX:** "Obvious, not clever" - friendly, colorful, big buttons
- **Security:** Trustworthy from day 1 - proper auth, encrypted storage, isolated hosting
- **Architecture:** Clean Architecture + CQRS (from brainstorming)
- **Data Model:** Multi-user ready even for MVP single user

### Out of Scope (MVP)
- Multi-user / sharing
- Mileage tracking
- Tenant portal
- Bank integration
- AI categorization

---

## Input Documents

**Product Brief:** None (standalone workflow)
**Domain Brief:** None (general domain, no specialized research needed)
**Research Documents:** Brainstorming session (`docs/bmm-brainstorming-session-2025-11-28.md`) - covers stack selection, architecture patterns, and lessons learned from previous project (Upkeep.io)

---

_This PRD captures the essence of property-manager - transforming paper-based rental property chaos into tax-ready Schedule E reports with minimal friction for the busy landlord._

_Created through collaborative discovery between Dave and AI facilitator._

