# property-manager - Epic Breakdown

**Author:** Dave
**Date:** 2025-11-29
**Project Level:** low (web application)
**Target Scale:** 14 rental properties, single user MVP

---

## Overview

This document provides the complete epic and story breakdown for property-manager, decomposing the requirements from the [PRD](./prd.md) into implementable stories.

**Living Document Notice:** This is the initial version. It will be updated after UX Design and Architecture workflows add interaction and technical details to stories.

**Epics Summary:** 6 epics delivering incremental user value aligned with user journey stages.

| Epic | Name | User Value | FRs Covered |
|------|------|------------|-------------|
| 1 | Foundation | App exists, user can authenticate | FR1-FR6 |
| 2 | Property Management | Properties are in the system | FR7-FR11, FR41-FR42 |
| 3 | Expense Tracking | User can record spending | FR12-FR22, FR38, FR43, FR45, FR47-FR48 |
| 4 | Income Tracking | User can record earnings | FR23-FR29, FR39-FR40, FR44, FR46 |
| 5 | Receipt Capture | User can snap receipts on mobile | FR30-FR37 |
| 6 | Tax Reports | One click → Schedule E PDFs | FR49-FR54, FR55-FR57 |

---

## Functional Requirements Inventory

### User Account & Access (FR1-FR6)
| FR | Description |
|----|-------------|
| FR1 | Users can register a new account with email and password |
| FR2 | Users receive email verification after registration |
| FR3 | Users can log in with email and password |
| FR4 | Users can log out and sessions are terminated securely |
| FR5 | Users can reset their password via email |
| FR6 | System maintains user session across browser tabs |

### Property Management (FR7-FR11)
| FR | Description |
|----|-------------|
| FR7 | Users can create a new property with name and address |
| FR8 | Users can view a list of all their properties |
| FR9 | Users can edit property details (name, address) |
| FR10 | Users can delete a property (with confirmation) |
| FR11 | Users can view a single property's detail page |

### Expense Management (FR12-FR22)
| FR | Description |
|----|-------------|
| FR12 | Users can create an expense linked to a specific property |
| FR13 | Expenses have required fields: amount, date, category, property |
| FR14 | Expenses have optional fields: description, receipt attachment |
| FR15 | Users can edit an existing expense |
| FR16 | Users can delete an expense (with confirmation) |
| FR17 | Users can view a list of expenses for a single property |
| FR18 | Users can view a list of all expenses across all properties |
| FR19 | Expense categories align with IRS Schedule E line items |
| FR20 | Users can filter expenses by date range (year-to-date, custom) |
| FR21 | Users can filter expenses by category |
| FR22 | Users can search expenses by description text |

### Income Management (FR23-FR29)
| FR | Description |
|----|-------------|
| FR23 | Users can create an income entry linked to a specific property |
| FR24 | Income entries have required fields: amount, date, property |
| FR25 | Income entries have optional fields: description, source |
| FR26 | Users can edit an existing income entry |
| FR27 | Users can delete an income entry (with confirmation) |
| FR28 | Users can view income entries for a single property |
| FR29 | Users can filter income by date range |

### Receipt Management (FR30-FR37)
| FR | Description |
|----|-------------|
| FR30 | Users can capture a receipt photo using device camera (mobile) |
| FR31 | Users can upload a receipt image from device storage |
| FR32 | Receipts are stored in cloud blob storage (S3) |
| FR33 | Users can create a receipt without immediately linking to expense |
| FR34 | Users can view a list of unprocessed receipts |
| FR35 | Users can link an existing receipt to an expense |
| FR36 | Users can view the receipt image attached to an expense |
| FR37 | Users can delete a receipt |

### Dashboard & Views (FR38-FR48)
| FR | Description |
|----|-------------|
| FR38 | Dashboard displays total expenses YTD across all properties |
| FR39 | Dashboard displays total income YTD across all properties |
| FR40 | Dashboard displays net income (income minus expenses) YTD |
| FR41 | Dashboard displays list/cards of all properties with expense totals |
| FR42 | Users can click a property to navigate to its detail page |
| FR43 | Property detail page shows expense total for that property |
| FR44 | Property detail page shows income total for that property |
| FR45 | Property detail page shows list of recent expenses |
| FR46 | Property detail page shows list of recent income entries |
| FR47 | Users can select which tax year to view (default: current) |
| FR48 | All totals and lists respect the selected tax year filter |

### Tax Reporting (FR49-FR54)
| FR | Description |
|----|-------------|
| FR49 | Users can generate a Schedule E worksheet PDF for a single property |
| FR50 | Users can generate Schedule E worksheet PDFs for all properties |
| FR51 | Generated PDFs include: property address, expense categories, income |
| FR52 | Users can select the tax year for report generation |
| FR53 | Generated PDFs can be downloaded to user's device |
| FR54 | Generated PDFs can be previewed before download |

### Data Integrity (FR55-FR57)
| FR | Description |
|----|-------------|
| FR55 | All data changes are persisted immediately (no manual save) |
| FR56 | Deleted items are soft-deleted with ability to restore |
| FR57 | System prevents duplicate expense entries (with override option) |

**FR Inventory Summary:** 57 Functional Requirements across 7 capability areas

---

## FR Coverage Map

| Epic | Epic Name | User Value Delivered | FRs Covered |
|------|-----------|---------------------|-------------|
| **1** | Foundation | "App exists, I can log in" | FR1, FR2, FR3, FR4, FR5, FR6, FR55, FR56 |
| **2** | Property Management | "My 14 properties are in the system" | FR7, FR8, FR9, FR10, FR11, FR41, FR42 |
| **3** | Expense Tracking | "I can record what I spend" | FR12-FR22, FR38, FR43, FR45, FR47, FR48, FR57 |
| **4** | Income Tracking | "I can record what I earn" | FR23-FR29, FR39, FR40, FR44, FR46 |
| **5** | Receipt Capture | "I can snap receipts on mobile" | FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37 |
| **6** | Tax Reports | "One click → Schedule E PDFs" | FR49, FR50, FR51, FR52, FR53, FR54 |

**Coverage Validation:** 57/57 FRs mapped ✅

---

## Epic 1: Foundation

**Goal:** Establish the technical infrastructure and authentication system that enables all subsequent features. User can register, verify email, log in, and access a protected application shell.

**FRs Covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR55, FR56

**User Value:** "The app exists and I can securely access it"

---

### Story 1.1: Project Infrastructure Setup

**As a** developer,
**I want** the monorepo structure, build system, and local development environment configured,
**So that** I can begin implementing features with consistent tooling.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** I run `docker compose up`
**Then** PostgreSQL database starts and is accessible on port 5432

**And** the backend API project structure follows Clean Architecture:
- `PropertyManager.Domain/` (entities, value objects)
- `PropertyManager.Application/` (commands, queries, handlers)
- `PropertyManager.Infrastructure/` (EF Core, S3, Identity)
- `PropertyManager.Api/` (controllers, middleware)

**And** the frontend project uses Angular 21 with:
- Feature-based folder structure (`core/`, `shared/`, `features/`)
- Angular Material installed with custom theme shell
- @ngrx/signals configured

**And** `dotnet build` and `ng build` both succeed with zero errors

**Prerequisites:** None (first story)

**Technical Notes:**
- Backend: .NET 10, ASP.NET Core, EF Core 10
- Frontend: Angular 21, Vitest, @ngrx/signals
- Database: PostgreSQL 16
- Use Architecture doc Section "Project Structure" for exact folder layout
- Configure NSwag for TypeScript client generation

---

### Story 1.2: Database Schema and EF Core Setup

**As a** developer,
**I want** the core database schema created with EF Core migrations,
**So that** entities can be persisted and the multi-tenant foundation is established.

**Acceptance Criteria:**

**Given** the database is running
**When** I run `dotnet ef database update`
**Then** the following tables are created:
- `Accounts` (Id, Name, CreatedAt)
- `Users` (Id, AccountId, Email, PasswordHash, Role, CreatedAt, UpdatedAt)
- `Properties` (Id, AccountId, Name, Address, CreatedAt, UpdatedAt, DeletedAt)
- `Expenses` (Id, AccountId, PropertyId, CategoryId, Amount, Date, Description, ReceiptId, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt)
- `Income` (Id, AccountId, PropertyId, Amount, Date, Source, Description, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt)
- `Receipts` (Id, AccountId, PropertyId, StorageKey, OriginalFileName, ContentType, FileSizeBytes, ExpenseId, CreatedByUserId, CreatedAt, ProcessedAt, DeletedAt)
- `ExpenseCategories` (Id, Name, ScheduleELine, SortOrder)

**And** ExpenseCategories is seeded with IRS Schedule E line items:
- Advertising, Auto/Travel, Cleaning/Maintenance, Commissions, Insurance, Legal/Professional Fees, Management Fees, Mortgage Interest, Other Interest, Repairs, Supplies, Taxes, Utilities, Depreciation, Other

**And** global query filters are configured for soft deletes (`DeletedAt == null`)
**And** global query filters enforce AccountId tenant isolation

**Prerequisites:** Story 1.1

**Technical Notes:**
- Use GUIDs for all primary keys
- All tenant tables have AccountId foreign key
- Audit fields: CreatedAt, UpdatedAt on all entities
- Soft delete via DeletedAt timestamp
- See Architecture doc "Data Architecture" section

---

### Story 1.3: User Registration with Email Verification

**As a** new user,
**I want** to register an account with my email and password,
**So that** I can access the application securely.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter a valid email and password (8+ chars, 1 uppercase, 1 number, 1 special)
**Then** my account is created with role "Owner"
**And** a new Account (tenant) is created for me
**And** I receive a verification email with a confirmation link
**And** I see a message "Please check your email to verify your account"

**Given** I click the verification link in my email within 24 hours
**When** the link is valid
**Then** my account is marked as verified
**And** I am redirected to the login page with message "Email verified! You can now log in."

**Given** I try to register with an email that already exists
**When** I submit the form
**Then** I see an error "An account with this email already exists"

**Prerequisites:** Story 1.2

**Technical Notes:**
- API: `POST /api/v1/auth/register` → creates Account + User
- Use ASP.NET Core Identity for password hashing (PBKDF2)
- Email verification token expires in 24 hours
- Frontend: Simple registration form, Forest Green theme
- UX: Form validation on blur, error messages below fields (per UX doc Section 7.4)

---

### Story 1.4: User Login and JWT Authentication

**As a** registered user,
**I want** to log in with my email and password,
**So that** I can access my protected data.

**Acceptance Criteria:**

**Given** I am on the login page with a verified account
**When** I enter valid credentials
**Then** I receive a JWT token (stored in HttpOnly cookie)
**And** I am redirected to the Dashboard
**And** subsequent API requests include the JWT for authentication

**Given** I enter invalid credentials
**When** I submit the form
**Then** I see an error "Invalid email or password"
**And** failed attempts are logged for security monitoring

**Given** I am logged in
**When** I open a new browser tab
**Then** my session persists (FR6)

**Given** I am logged in on my desktop
**When** I log in on my phone
**Then** both sessions remain active simultaneously
**And** each device has its own JWT/refresh token pair
**And** logging out of one device does not affect the other

**Given** my JWT token expires
**When** I make an API request
**Then** the refresh token automatically requests a new JWT
**And** my session continues without interruption

**Prerequisites:** Story 1.3

**Technical Notes:**
- API: `POST /api/v1/auth/login` → returns JWT + refresh token
- JWT contains: userId, accountId, role, exp
- JWT expiry: 60 minutes, refresh token: 7 days
- Store JWT in HttpOnly cookie (not localStorage) for XSS protection
- Frontend: Auth interceptor adds token to requests
- **Multiple concurrent sessions:** Each login creates a new refresh token; tokens are device-independent. This enables the dual-device workflow (Epic 5).
- UX: Loading spinner on button during auth (per UX doc Section 7.3)

---

### Story 1.5: User Logout

**As a** logged-in user,
**I want** to log out of the application,
**So that** my session is terminated securely.

**Acceptance Criteria:**

**Given** I am logged in
**When** I click the logout button
**Then** my JWT cookie is cleared
**And** my refresh token is invalidated server-side
**And** I am redirected to the login page
**And** subsequent API requests return 401 Unauthorized

**Prerequisites:** Story 1.4

**Technical Notes:**
- API: `POST /api/v1/auth/logout`
- Clear HttpOnly cookie
- Invalidate refresh token in database
- Frontend: Clear any cached user state

---

### Story 1.6: Password Reset Flow

**As a** user who forgot my password,
**I want** to reset my password via email,
**So that** I can regain access to my account.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I click "Forgot Password" and enter my email
**Then** I receive a password reset email with a secure link
**And** I see "If an account exists, you'll receive a reset email"

**Given** I click the reset link within 1 hour
**When** I enter a new valid password
**Then** my password is updated
**And** all existing sessions are invalidated
**And** I am redirected to login with "Password reset successfully"

**Given** the reset link is expired or already used
**When** I try to use it
**Then** I see "This reset link is invalid or expired"

**Prerequisites:** Story 1.4

**Technical Notes:**
- API: `POST /api/v1/auth/forgot` → sends reset email
- API: `POST /api/v1/auth/reset` → validates token, updates password
- Reset token expires in 1 hour
- One-time use tokens (invalidate after use)

---

### Story 1.7: Application Shell with Navigation

**As a** logged-in user,
**I want** to see the main application layout with navigation,
**So that** I can access different sections of the app.

**Acceptance Criteria:**

**Given** I am logged in
**When** the Dashboard loads
**Then** I see a dark sidebar navigation with:
- Dashboard (active by default)
- Properties
- Expenses
- Income
- Receipts (with badge count placeholder)
- Reports
- Settings

**And** I see my email or name in the sidebar footer with logout option
**And** the content area shows placeholder "Dashboard coming soon"
**And** the Forest Green color theme is applied (primary: #66BB6A)

**Given** I am on mobile (< 768px)
**When** I view the app
**Then** I see bottom tab navigation instead of sidebar
**And** a floating action button (FAB) appears for quick actions

**Prerequisites:** Story 1.4

**Technical Notes:**
- Use Angular Material `mat-sidenav` with dark theme
- Responsive breakpoints: Desktop ≥1024px, Tablet 768-1023px, Mobile <768px
- Routes: `/dashboard`, `/properties`, `/expenses`, `/income`, `/receipts`, `/reports`, `/settings`
- Auth guard protects all routes except `/login`, `/register`, `/forgot-password`
- UX: See UX doc Section 4 "Design Direction" for layout specs

---

### Story 1.8: CI/CD Pipeline and Initial Deployment

**As a** developer,
**I want** automated CI/CD with deployment to Render,
**So that** every merge to main automatically deploys a working application.

**Acceptance Criteria:**

**Given** I push code to a PR branch
**When** the PR is opened
**Then** CI runs: `dotnet build`, `dotnet test`, `ng build`, `ng test`
**And** Docker images build successfully
**And** PR cannot merge if CI fails

**Given** I merge a PR to main
**When** CI passes
**Then** Docker images are pushed to container registry
**And** Render deploys the new version automatically
**And** EF Core migrations run on application startup

**Given** deployment completes
**When** I visit the production URL
**Then** the login page loads with Forest Green theme
**And** API health check endpoint returns 200 OK
**And** I can register a new account and log in

**Given** a deployment fails
**When** health checks don't pass
**Then** Render automatically rolls back to previous version

**Prerequisites:** Story 1.7

**Technical Notes:**
- GitHub Actions for CI pipeline
- Render Web Service (Docker) for API
- Render Static Site for Angular frontend
- Render PostgreSQL for database
- Environment variables: `ConnectionStrings__Default`, `Jwt__Secret`, `AWS__*`
- Health check endpoint: `GET /api/v1/health`
- See Architecture doc "Deployment Architecture" section

**🎸 The First Gig:** This is where the journey begins. The app is live, real users can access it, and every subsequent epic ships to production incrementally.

---

### Epic 1 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 1.1 | Project Infrastructure Setup | - | None |
| 1.2 | Database Schema and EF Core Setup | FR55, FR56 | 1.1 |
| 1.3 | User Registration with Email Verification | FR1, FR2 | 1.2 |
| 1.4 | User Login and JWT Authentication | FR3, FR6 | 1.3 |
| 1.5 | User Logout | FR4 | 1.4 |
| 1.6 | Password Reset Flow | FR5 | 1.4 |
| 1.7 | Application Shell with Navigation | - | 1.4 |
| 1.8 | CI/CD Pipeline and Initial Deployment | - | 1.7 |

**Stories:** 8 | **FRs Covered:** FR1-FR6, FR55, FR56 ✅

**Epic 1 Milestone:** 🎸 *The app is LIVE. The first gig. Small venue, but real audience.*

---

## Epic 2: Property Management

**Goal:** Enable users to manage their rental property portfolio. After this epic, all 14 properties can be added to the system with the dashboard showing property list.

**FRs Covered:** FR7, FR8, FR9, FR10, FR11, FR41, FR42

**User Value:** "My 14 properties are in the system and I can see them on my dashboard"

---

### Story 2.1: Create Property

**As a** property owner,
**I want** to add a new rental property to my portfolio,
**So that** I can track expenses and income for that property.

**Acceptance Criteria:**

**Given** I am logged in and on the Properties page
**When** I click "Add Property"
**Then** I see a form with fields:
- Name (required, e.g., "Oak Street Duplex")
- Street Address (required)
- City (required)
- State (required, dropdown)
- ZIP Code (required)

**Given** I fill in valid property details
**When** I click "Save"
**Then** the property is created in the database with my AccountId
**And** I see snackbar "Property added ✓"
**And** I am redirected to the Properties list
**And** the new property appears in the list

**Given** I leave required fields empty
**When** I try to submit
**Then** I see validation errors below each empty field
**And** the form does not submit

**Prerequisites:** Story 1.8 (deployed app shell)

**Technical Notes:**
- API: `POST /api/v1/properties` → returns `{ id: "guid" }`
- Request body: `{ name, address: { street, city, state, zip } }`
- Frontend: `/properties/new` route
- Form uses Angular Material `mat-form-field` with Forest Green focus
- UX: Labels above inputs, validation on blur (per UX doc Section 7.4)

---

### Story 2.2: View Properties List with Dashboard Stats

**As a** property owner,
**I want** to see all my properties on the dashboard with expense totals,
**So that** I can quickly understand my portfolio at a glance.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to Dashboard (home)
**Then** I see a stats bar showing:
- Total Expenses YTD: $0.00 (placeholder until Epic 3)
- Total Income YTD: $0.00 (placeholder until Epic 4)
- Net Income YTD: $0.00 (calculated)

**And** I see a list of all my properties showing:
- Property name
- Address (city, state)
- YTD expense total ($0.00 placeholder)
- [+] quick-add button (disabled until Epic 3)

**Given** I have no properties
**When** I view the dashboard
**Then** I see empty state: "No properties yet. Add your first property to get started."
**And** I see an "Add Property" button

**Given** I have 14 properties
**When** I view the dashboard
**Then** all 14 properties are visible without pagination (list view, scannable)

**Prerequisites:** Story 2.1

**Technical Notes:**
- API: `GET /api/v1/properties` → `{ items: [...], totalCount: n }`
- Dashboard route: `/dashboard`
- Use `PropertyRowComponent` (custom component per UX doc Section 6.3)
- Stats bar uses `StatsBarComponent` with placeholder values
- List view optimized for scanning 14+ properties (not card grid)
- UX: See UX doc Section 5.4 "Journey: View Dashboard"

---

### Story 2.3: View Property Detail Page

**As a** property owner,
**I want** to view details for a single property,
**So that** I can see all information and activity for that property.

**Acceptance Criteria:**

**Given** I am on the Dashboard or Properties list
**When** I click on a property row
**Then** I navigate to the property detail page (`/properties/:id`)

**Given** I am on a property detail page
**When** the page loads
**Then** I see:
- Property name as page title
- Full address
- YTD Expenses total ($0.00 placeholder)
- YTD Income total ($0.00 placeholder)
- "Recent Expenses" section (empty state: "No expenses yet")
- "Recent Income" section (empty state: "No income recorded yet")
- [+ Add Expense] button (navigates to expense workspace - Epic 3)
- [+ Add Income] button (navigates to income form - Epic 4)
- [Edit] button
- [Delete] button

**Given** I try to access a property that doesn't exist or belongs to another account
**When** the page loads
**Then** I see a 404 "Property not found" page

**Prerequisites:** Story 2.2

**Technical Notes:**
- API: `GET /api/v1/properties/{id}` → property details
- Route: `/properties/:id`
- Breadcrumb: Dashboard > Property Name
- Placeholder sections for expenses/income (populated in Epics 3 & 4)
- AccountId filtering enforced by API (tenant isolation)
- UX: See UX doc Section 4.4 "Property Detail" layout

---

### Story 2.4: Edit Property

**As a** property owner,
**I want** to edit an existing property's details,
**So that** I can correct mistakes or update information.

**Acceptance Criteria:**

**Given** I am on a property detail page
**When** I click "Edit"
**Then** I navigate to the edit form pre-populated with current values

**Given** I am on the edit form
**When** I modify fields and click "Save"
**Then** the property is updated in the database
**And** UpdatedAt timestamp is set
**And** I see snackbar "Property updated ✓"
**And** I am redirected back to the property detail page

**Given** I click "Cancel" on the edit form
**When** I have unsaved changes
**Then** I see a confirmation "You have unsaved changes. Discard?"
**And** if confirmed, I return to property detail without saving

**Prerequisites:** Story 2.3

**Technical Notes:**
- API: `PUT /api/v1/properties/{id}` → 204 No Content
- Route: `/properties/:id/edit`
- Reuse property form component from Story 2.1
- Unsaved changes guard on route navigation
- UX: Same form patterns as create (Section 7.4)

---

### Story 2.5: Delete Property

**As a** property owner,
**I want** to delete a property I no longer manage,
**So that** it doesn't clutter my portfolio.

**Acceptance Criteria:**

**Given** I am on a property detail page
**When** I click "Delete"
**Then** I see a confirmation dialog:
- Title: "Delete [Property Name]?"
- Message: "This will remove the property and all its expenses and income records. This action cannot be undone."
- Buttons: [Cancel] [Delete]

**Given** I confirm deletion
**When** the delete completes
**Then** the property is soft-deleted (DeletedAt set)
**And** all associated expenses and income are soft-deleted (cascade)
**And** I see snackbar "Property deleted"
**And** I am redirected to the Dashboard
**And** the property no longer appears in my list

**Given** I click "Cancel" on the confirmation
**When** the dialog closes
**Then** the property remains unchanged

**Prerequisites:** Story 2.4

**Technical Notes:**
- API: `DELETE /api/v1/properties/{id}` → 204 No Content
- Soft delete: Sets DeletedAt timestamp
- Cascade soft-delete to Expenses and Income
- Modal confirmation using `mat-dialog` (per UX doc Section 7.6)
- UX: Destructive action requires modal confirmation

---

### Epic 2 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 2.1 | Create Property | FR7 | 1.8 |
| 2.2 | View Properties List with Dashboard Stats | FR8, FR41 | 2.1 |
| 2.3 | View Property Detail Page | FR11, FR42 | 2.2 |
| 2.4 | Edit Property | FR9 | 2.3 |
| 2.5 | Delete Property | FR10 | 2.4 |

**Stories:** 5 | **FRs Covered:** FR7-FR11, FR41, FR42 ✅

**Epic 2 Milestone:** 📍 *All 14 properties are in the system. The portfolio exists. Dashboard shows the full picture (even if totals are $0 for now).*

---

## Epic 3: Expense Tracking ⭐ CORE

**Goal:** Enable users to track expenses for each property. This is the heart of the application - 80% of daily usage happens here. After this epic, the core value loop is complete: record expenses → see totals.

**FRs Covered:** FR12, FR13, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR38, FR43, FR45, FR47, FR48, FR57

**User Value:** "I can record what I spend and see my totals update"

---

### Story 3.1: Expense Workspace - Create Expense

**As a** property owner,
**I want** to add expenses to a property with amount, date, and category,
**So that** I can track what I'm spending on each rental.

**Acceptance Criteria:**

**Given** I am on a property detail page or dashboard
**When** I click [+ Add Expense] or the [+] button on a property row
**Then** I navigate to the Expense Workspace (`/properties/:id/expenses`)

**Given** I am on the Expense Workspace
**When** the page loads
**Then** I see:
- Property name in header (context)
- NEW EXPENSE form at top with fields:
  - Amount (required, currency input)
  - Date (required, datepicker, defaults to today)
  - Category (required, dropdown with Schedule E categories)
  - Description (optional, text input)
- "Previous Expenses" list below the form
- YTD total for this property

**Given** I fill in valid expense details
**When** I click "Save"
**Then** the expense is created with my AccountId and PropertyId
**And** I see snackbar "Expense saved ✓"
**And** the new expense appears at top of the list immediately
**And** the form clears, ready for next entry
**And** the YTD total updates

**Given** I enter an invalid amount (negative, zero, or non-numeric)
**When** I try to submit
**Then** I see validation error "Amount must be greater than $0"

**Given** the category dropdown
**When** I open it
**Then** I see all IRS Schedule E categories:
- Advertising
- Auto and Travel
- Cleaning and Maintenance
- Commissions
- Insurance
- Legal and Professional Fees
- Management Fees
- Mortgage Interest
- Other Interest
- Repairs
- Supplies
- Taxes
- Utilities
- Depreciation
- Other

**Prerequisites:** Story 2.5 (Property Management complete)

**Technical Notes:**
- API: `POST /api/v1/expenses` → `{ id: "guid" }`
- Request: `{ propertyId, amount, date, categoryId, description }`
- Route: `/properties/:id/expenses`
- Form stays on page after save (batch entry pattern)
- Use `ExpenseRowComponent` for list items
- Amount stored as decimal(10,2)
- UX: See UX doc Section 5.2 "Journey: Add Expense" - Expense Workspace pattern

---

### Story 3.2: Edit Expense

**As a** property owner,
**I want** to edit an existing expense,
**So that** I can correct mistakes in amount, date, or category.

**Acceptance Criteria:**

**Given** I am viewing the expense list (workspace or all expenses)
**When** I hover over an expense row
**Then** I see edit and delete action icons

**Given** I click the edit icon on an expense
**When** the edit mode activates
**Then** the expense row expands to show an inline edit form
**Or** a side panel opens with the expense form pre-filled

**Given** I modify expense fields and click "Save"
**When** the save completes
**Then** the expense is updated in the database
**And** UpdatedAt timestamp is set
**And** I see snackbar "Expense updated ✓"
**And** the list refreshes with updated values
**And** totals recalculate if amount changed

**Given** I click "Cancel" during edit
**When** the form closes
**Then** no changes are saved

**Prerequisites:** Story 3.1

**Technical Notes:**
- API: `PUT /api/v1/expenses/{id}` → 204 No Content
- Inline edit preferred (keeps user in context)
- Recalculate property and dashboard totals on amount change
- UX: Edit on hover reveal (per UX doc Section 6.3 ExpenseRowComponent)

---

### Story 3.3: Delete Expense

**As a** property owner,
**I want** to delete an expense I entered by mistake,
**So that** my records are accurate.

**Acceptance Criteria:**

**Given** I am viewing the expense list
**When** I click the delete icon on an expense
**Then** I see inline confirmation: "Delete this expense?" [Cancel] [Delete]

**Given** I confirm deletion
**When** the delete completes
**Then** the expense is soft-deleted (DeletedAt set)
**And** I see snackbar "Expense deleted"
**And** the expense disappears from the list
**And** totals recalculate

**Given** I click "Cancel"
**When** the confirmation dismisses
**Then** the expense remains unchanged

**Prerequisites:** Story 3.2

**Technical Notes:**
- API: `DELETE /api/v1/expenses/{id}` → 204 No Content
- Soft delete (DeletedAt timestamp)
- Inline confirmation (not modal - quick items per UX doc Section 7.6)
- Recalculate totals after delete

---

### Story 3.4: View All Expenses with Filters

**As a** property owner,
**I want** to view and filter all expenses across all properties,
**So that** I can find specific expenses and understand spending patterns.

**Acceptance Criteria:**

**Given** I click "Expenses" in the navigation
**When** the page loads
**Then** I see all expenses across all properties in a list showing:
- Date
- Property name
- Description
- Category (as tag/chip)
- Amount
- Receipt indicator (icon if attached - future Epic 5)

**Given** I want to filter by date range
**When** I select a date range (e.g., "This Month", "This Quarter", "Custom")
**Then** only expenses within that range are shown
**And** the total updates to reflect filtered results

**Given** I want to filter by category
**When** I select one or more categories from a multi-select dropdown
**Then** only expenses in those categories are shown

**Given** I want to search by description
**When** I type in the search box
**Then** expenses filter in real-time to match description text (case-insensitive)

**Given** I apply multiple filters
**When** filters are active
**Then** I see a "Clear all filters" link
**And** active filter chips are visible

**Given** no expenses match my filters
**When** the list is empty
**Then** I see "No expenses match your filters" with a clear filters link

**Prerequisites:** Story 3.3

**Technical Notes:**
- API: `GET /api/v1/expenses?dateFrom=&dateTo=&categoryIds=&search=`
- Route: `/expenses`
- Pagination if > 100 expenses (use `{ items, totalCount, page, pageSize }`)
- Filters persist during session
- UX: Filters above list, instant filtering (per UX doc Section 7.10)

---

### Story 3.5: Tax Year Selector and Dashboard Totals

**As a** property owner,
**I want** to select which tax year I'm viewing and see accurate expense totals,
**So that** I can track spending by tax year and answer "how much have we spent?"

**Acceptance Criteria:**

**Given** I am on the Dashboard
**When** I look at the stats bar
**Then** I see a year selector dropdown (defaults to current year)
**And** Total Expenses YTD shows the sum of all expenses for selected year

**Given** I change the tax year selector
**When** I select a different year (e.g., 2024)
**Then** all totals update to reflect that year's data
**And** property list shows per-property totals for that year
**And** the selection persists as I navigate

**Given** I am on a property detail page
**When** the page loads
**Then** I see the property's expense total for the selected tax year
**And** recent expenses list shows expenses from that year

**Given** the selected year has no expenses
**When** I view the dashboard
**Then** Total Expenses shows $0.00
**And** property totals show $0.00

**Prerequisites:** Story 3.4

**Technical Notes:**
- API: Add `?year=2025` query param to properties and expenses endpoints
- Year selector in dashboard header (or stats bar)
- Store selected year in app state (persists across navigation)
- Tax year = calendar year (Jan 1 - Dec 31)
- Update `StatsBarComponent` with real expense totals
- Update `PropertyRowComponent` with real per-property totals

---

### Story 3.6: Duplicate Expense Prevention

**As a** property owner,
**I want** the system to warn me about potential duplicate expenses,
**So that** I don't accidentally enter the same expense twice.

**Acceptance Criteria:**

**Given** I am creating a new expense
**When** I enter an amount, date, and property that matches an existing expense within 24 hours
**Then** I see a warning: "Possible duplicate: You entered a similar expense on [date] for [amount]. Save anyway?"
**And** I can choose [Cancel] or [Save Anyway]

**Given** I click "Save Anyway"
**When** the save completes
**Then** the expense is created (user override)

**Given** I click "Cancel"
**When** the warning dismisses
**Then** the form remains with my entered data (not cleared)

**Given** the amounts match but dates are more than 24 hours apart
**When** I save
**Then** no duplicate warning is shown (legitimate recurring expense)

**Prerequisites:** Story 3.5

**Technical Notes:**
- Check for duplicates on save (API-side validation)
- Match criteria: same propertyId + amount + date within 24 hours
- Return 409 Conflict with duplicate details if found
- Frontend shows warning dialog with override option
- FR57: "with override option" - user can always force save

---

### Epic 3 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 3.1 | Expense Workspace - Create Expense | FR12, FR13, FR17, FR19, FR45 | 2.5 |
| 3.2 | Edit Expense | FR15 | 3.1 |
| 3.3 | Delete Expense | FR16 | 3.2 |
| 3.4 | View All Expenses with Filters | FR18, FR20, FR21, FR22 | 3.3 |
| 3.5 | Tax Year Selector and Dashboard Totals | FR38, FR43, FR47, FR48 | 3.4 |
| 3.6 | Duplicate Expense Prevention | FR57 | 3.5 |

**Stories:** 6 | **FRs Covered:** FR12-FR22, FR38, FR43, FR45, FR47, FR48, FR57 ✅

**Epic 3 Milestone:** 💰 *The core value loop is complete. Record expenses → see totals → answer "how much is this costing us?"*

---

## Epic 4: Income Tracking

**Goal:** Enable users to track rental income for each property. After this epic, the dashboard shows complete financial picture: expenses, income, and net income.

**FRs Covered:** FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR39, FR40, FR44, FR46

**User Value:** "I can record what I earn and see my net income"

---

### Story 4.1: Income Workspace - Create Income Entry

**As a** property owner,
**I want** to record rental income for a property,
**So that** I can track what each property earns.

**Acceptance Criteria:**

**Given** I am on a property detail page
**When** I click [+ Add Income]
**Then** I navigate to the Income Workspace (`/properties/:id/income`)

**Given** I am on the Income Workspace
**When** the page loads
**Then** I see:
- Property name in header (context)
- NEW INCOME form at top with fields:
  - Amount (required, currency input)
  - Date (required, datepicker, defaults to today)
  - Source (optional, e.g., "John Smith - Rent", "Security Deposit")
  - Description (optional, text input)
- "Previous Income" list below the form
- YTD income total for this property

**Given** I fill in valid income details
**When** I click "Save"
**Then** the income entry is created with my AccountId and PropertyId
**And** I see snackbar "Income recorded ✓"
**And** the new entry appears at top of the list
**And** the form clears, ready for next entry
**And** the YTD income total updates

**Given** I enter an invalid amount
**When** I try to submit
**Then** I see validation error "Amount must be greater than $0"

**Prerequisites:** Story 3.6 (Expense Tracking complete)

**Technical Notes:**
- API: `POST /api/v1/income` → `{ id: "guid" }`
- Request: `{ propertyId, amount, date, source, description }`
- Route: `/properties/:id/income`
- Reuse workspace pattern from expenses
- Amount stored as decimal(10,2)
- UX: Same workspace pattern as expenses (form + history)

---

### Story 4.2: Edit and Delete Income Entry

**As a** property owner,
**I want** to edit or delete income entries,
**So that** I can correct mistakes in my records.

**Acceptance Criteria:**

**Given** I am viewing the income list
**When** I hover over an income row
**Then** I see edit and delete action icons

**Given** I click the edit icon
**When** the edit form appears
**Then** I can modify amount, date, source, or description
**And** clicking "Save" updates the entry
**And** I see snackbar "Income updated ✓"
**And** totals recalculate

**Given** I click the delete icon
**When** I see inline confirmation "Delete this income entry?"
**Then** clicking "Delete" soft-deletes the entry
**And** I see snackbar "Income deleted"
**And** the entry disappears and totals recalculate

**Given** I click "Cancel" on either action
**When** the dialog/form closes
**Then** no changes are saved

**Prerequisites:** Story 4.1

**Technical Notes:**
- API: `PUT /api/v1/income/{id}` → 204 No Content
- API: `DELETE /api/v1/income/{id}` → 204 No Content
- Soft delete (DeletedAt timestamp)
- Same inline edit/delete pattern as expenses

---

### Story 4.3: View All Income with Date Filter

**As a** property owner,
**I want** to view all income across properties and filter by date,
**So that** I can see total earnings and find specific payments.

**Acceptance Criteria:**

**Given** I click "Income" in the navigation
**When** the page loads
**Then** I see all income entries across all properties showing:
- Date
- Property name
- Source (if provided)
- Description (if provided)
- Amount

**Given** I want to filter by date range
**When** I select a date range
**Then** only income within that range is shown
**And** the total updates to reflect filtered results

**Given** I want to filter by property
**When** I select a property from dropdown
**Then** only income for that property is shown

**Given** no income matches my filters
**When** the list is empty
**Then** I see "No income recorded for this period"

**Prerequisites:** Story 4.2

**Technical Notes:**
- API: `GET /api/v1/income?dateFrom=&dateTo=&propertyId=`
- Route: `/income`
- Respects selected tax year from app state
- Simpler than expenses (no category filter, no search - income entries are simpler)

---

### Story 4.4: Dashboard Income and Net Income Totals

**As a** property owner,
**I want** to see total income and net income on the dashboard,
**So that** I understand the complete financial picture.

**Acceptance Criteria:**

**Given** I am on the Dashboard
**When** the page loads
**Then** the stats bar shows:
- Total Expenses YTD: $X (from Epic 3)
- Total Income YTD: $Y (sum of all income for selected year)
- Net Income YTD: $Z (Income - Expenses, can be negative)

**Given** Net Income is positive
**When** I view the stats bar
**Then** Net Income displays in green

**Given** Net Income is negative
**When** I view the stats bar
**Then** Net Income displays in red with parentheses, e.g., "($1,234)"

**Given** I am on a property detail page
**When** the page loads
**Then** I see:
- Property income total for selected year
- Recent income entries list
- Net for this property (income - expenses)

**Given** I change the tax year selector
**When** totals recalculate
**Then** income totals update along with expense totals

**Prerequisites:** Story 4.3

**Technical Notes:**
- API: Extend properties endpoint to include income totals
- Net income calculated: `totalIncome - totalExpenses`
- Color coding: green for positive, red for negative
- Update `StatsBarComponent` with income and net
- Property detail shows per-property net

---

### Epic 4 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 4.1 | Income Workspace - Create Income Entry | FR23, FR24, FR25, FR28, FR46 | 3.6 |
| 4.2 | Edit and Delete Income Entry | FR26, FR27 | 4.1 |
| 4.3 | View All Income with Date Filter | FR29 | 4.2 |
| 4.4 | Dashboard Income and Net Income Totals | FR39, FR40, FR44 | 4.3 |

**Stories:** 4 | **FRs Covered:** FR23-FR29, FR39, FR40, FR44, FR46 ✅

**Epic 4 Milestone:** 📊 *Complete financial picture. Expenses + Income = Net Income. "Are we making money on these properties?"*

---

## Epic 5: Receipt Capture

**Goal:** Enable mobile receipt capture with "capture now, categorize later" workflow. This is the convenience feature that transforms receipt processing from a chore into an efficient assembly line.

**FRs Covered:** FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37

**User Value:** "I can snap receipts on my phone and process them later on desktop"

---

### Story 5.1: Receipt Upload Infrastructure (S3 Presigned URLs)

**As a** developer,
**I want** receipt images uploaded directly to S3 via presigned URLs,
**So that** uploads are fast, secure, and don't burden the API server.

**Acceptance Criteria:**

**Given** a user wants to upload a receipt
**When** they request an upload URL
**Then** the API returns a presigned S3 upload URL (valid for 15 minutes)
**And** the URL allows direct PUT to S3 without passing through the API

**Given** a user uploads an image to S3
**When** the upload completes
**Then** they call the API to confirm and create the receipt record
**And** the receipt is stored with: storageKey, originalFileName, contentType, fileSizeBytes

**Given** a user wants to view a receipt image
**When** they request the receipt
**Then** the API returns a presigned download URL (valid for 15 minutes)
**And** the image loads directly from S3

**Given** receipts are stored in S3
**When** checking security
**Then** the bucket is private (no public access)
**And** objects are encrypted at rest
**And** presigned URLs are the only access method

**Prerequisites:** Story 4.4 (Income Tracking complete)

**Technical Notes:**
- API: `POST /api/v1/receipts/upload-url` → `{ uploadUrl, storageKey }`
- API: `POST /api/v1/receipts` → `{ id }` (confirm upload, create record)
- API: `GET /api/v1/receipts/{id}` → includes `viewUrl` (presigned)
- S3 bucket: `property-manager-receipts-{env}`
- Storage key format: `{accountId}/{year}/{guid}.{ext}`
- See Architecture doc "ADR-004: S3 Direct Upload"

---

### Story 5.2: Mobile Receipt Capture with Camera

**As a** property owner on my phone,
**I want** to quickly snap receipt photos,
**So that** I can capture expenses while I'm out without stopping to enter details.

**Acceptance Criteria:**

**Given** I am on any screen on mobile
**When** I tap the floating action button (FAB) with camera icon
**Then** the device camera opens

**Given** I take a photo
**When** the capture completes
**Then** the image uploads to S3 in the background
**And** I see a brief "Saved ✓" confirmation
**And** I'm immediately ready to take another photo (burst mode feel)

**Given** the photo is saved
**When** a modal appears
**Then** I can optionally select a property to tag: "Which property?"
**And** I can choose [Skip] to capture faster or [Save] after selecting

**Given** I skip property selection
**When** the receipt is saved
**Then** it appears in the unprocessed queue as "unassigned"

**Given** I tag a property
**When** the receipt is saved
**Then** it appears in the queue with that property pre-selected

**Given** I'm capturing multiple receipts
**When** I want to go fast
**Then** the UI stays out of my way - minimal taps between shots

**Prerequisites:** Story 5.1

**Technical Notes:**
- Use device camera API (navigator.mediaDevices or Capacitor Camera)
- FAB component: `MobileCaptureButtonComponent`
- Property selector: simple dropdown modal
- Upload happens async - don't block next capture
- UX: See UX doc Section 5.3 "Journey: Dual-Device Receipt Processing"

---

### Story 5.3: Unprocessed Receipt Queue

**As a** property owner on desktop,
**I want** to see all receipts waiting to be processed,
**So that** I can efficiently categorize them in a batch.

**Acceptance Criteria:**

**Given** I have unprocessed receipts
**When** I look at the sidebar navigation
**Then** I see "Receipts" with a badge showing the count (e.g., "Receipts (3)")

**Given** I click "Receipts" in navigation
**When** the page loads
**Then** I see the unprocessed receipt queue showing:
- Receipt thumbnail (small preview)
- Capture date
- Property name (if tagged) or "(unassigned)" in muted style
- Visual distinction for unassigned receipts

**Given** I have no unprocessed receipts
**When** I view the Receipts page
**Then** I see: "All caught up! No receipts to process." with a checkmark icon

**Given** receipts are sorted
**When** I view the list
**Then** newest receipts appear at top

**Prerequisites:** Story 5.2

**Technical Notes:**
- API: `GET /api/v1/receipts/unprocessed` → `{ items, totalCount }`
- Route: `/receipts`
- Badge updates when count changes
- Use `ReceiptQueueItemComponent` (per UX doc Section 6.3)
- Thumbnails: generate on upload or use S3 image resizing

---

### Story 5.4: Process Receipt into Expense

**As a** property owner,
**I want** to process a receipt by creating an expense from it,
**So that** receipts become properly categorized financial records.

**Acceptance Criteria:**

**Given** I click on a receipt in the queue
**When** the processing view opens
**Then** I see side-by-side layout:
- Left: Receipt image (with zoom/rotate controls)
- Right: Expense form (amount, date, category, property, description)

**Given** the receipt was tagged with a property
**When** the form loads
**Then** the property dropdown is pre-selected

**Given** I fill in the expense details (reading from receipt image)
**When** I click "Save"
**Then** an expense is created with the receipt attached
**And** the receipt is marked as processed (ProcessedAt timestamp set)
**And** the receipt disappears from the queue
**And** the badge count decreases
**And** I see snackbar "Expense saved with receipt ✓"

**Given** I want to process the next receipt
**When** I save successfully
**Then** the next unprocessed receipt loads automatically (assembly line)

**Given** I click "Cancel" or close without saving
**When** the view closes
**Then** the receipt remains in the unprocessed queue

**Prerequisites:** Story 5.3

**Technical Notes:**
- API: `POST /api/v1/receipts/{id}/link` with expense creation
- Or create expense with `receiptId` in the request
- Route: `/receipts/:id` or modal/drawer
- Use `ReceiptFormLayoutComponent` (per UX doc Section 6.3)
- Image viewer: pinch-zoom on mobile, scroll-zoom on desktop
- UX: See UX doc Section 5.3 processing flow

---

### Story 5.5: View and Delete Receipts

**As a** property owner,
**I want** to view receipts attached to expenses and delete unwanted receipts,
**So that** I can verify records and clean up mistakes.

**Acceptance Criteria:**

**Given** an expense has a receipt attached
**When** I view the expense (in list or detail)
**Then** I see a receipt icon indicator
**And** clicking the icon opens the receipt image in a lightbox/modal

**Given** I'm viewing a receipt image
**When** I want to see details
**Then** I can zoom in/out and pan the image
**And** I can close the viewer to return to the expense

**Given** I want to delete an unprocessed receipt
**When** I click delete on a queue item
**Then** I see confirmation: "Delete this receipt?"
**And** confirming deletes the receipt from S3 and database
**And** I see snackbar "Receipt deleted"

**Given** I want to remove a receipt from an expense
**When** I edit the expense
**Then** I can click "Remove receipt" to unlink it
**And** the receipt returns to unprocessed queue (or is deleted - user choice)

**Prerequisites:** Story 5.4

**Technical Notes:**
- API: `DELETE /api/v1/receipts/{id}` → 204 No Content
- Delete from S3 and database (or soft delete)
- Lightbox: use Angular CDK overlay or mat-dialog
- Receipt indicator: small icon on ExpenseRowComponent

---

### Story 5.6: Real-Time Receipt Sync (SignalR)

**As a** property owner using phone and desktop together,
**I want** receipts captured on my phone to appear on desktop immediately,
**So that** I can run an efficient assembly-line workflow.

**Acceptance Criteria:**

**Given** I'm logged in on both phone and desktop
**When** I capture a receipt on my phone
**Then** the receipt appears in the desktop queue within 1-2 seconds
**And** the badge count updates in real-time
**And** I don't need to refresh the page

**Given** I process a receipt on desktop
**When** the receipt is linked to an expense
**Then** other connected devices see the queue update
**And** the receipt disappears from their view too

**Given** I'm on desktop with the receipts page open
**When** a new receipt arrives via SignalR
**Then** I see a subtle animation as it appears in the queue
**And** optionally hear a soft notification sound

**Given** my connection is temporarily lost
**When** I reconnect
**Then** SignalR automatically reconnects
**And** the queue syncs to current state

**Prerequisites:** Story 5.5

**Technical Notes:**
- SignalR Hub: `ReceiptHub` (per Architecture doc)
- Events: `ReceiptAdded`, `ReceiptLinked`
- Group by AccountId (all users in same account get updates)
- Frontend: `SignalRService` in `core/signalr/`
- Reconnection: automatic with exponential backoff
- UX: See UX doc Section 2.2 "Dual-Device Receipt Processing"

---

### Epic 5 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 5.1 | Receipt Upload Infrastructure | FR31, FR32 | 4.4 |
| 5.2 | Mobile Receipt Capture with Camera | FR30, FR33 | 5.1 |
| 5.3 | Unprocessed Receipt Queue | FR34 | 5.2 |
| 5.4 | Process Receipt into Expense | FR35 | 5.3 |
| 5.5 | View and Delete Receipts | FR36, FR37 | 5.4 |
| 5.6 | Real-Time Receipt Sync (SignalR) | - | 5.5 |

**Stories:** 6 | **FRs Covered:** FR30-FR37 ✅

**Epic 5 Milestone:** 📸 *The assembly line is complete. Phone captures, desktop processes, real-time sync. Receipt chaos → organized records.*

---

## Epic 6: Tax Reports ⭐ PAYOFF

**Goal:** Generate Schedule E worksheet PDFs that make tax time effortless. This is the magic moment that justifies the entire application - one click produces tax-ready documents.

**FRs Covered:** FR49, FR50, FR51, FR52, FR53, FR54

**User Value:** "One click → Schedule E PDFs ready for my accountant"

---

### Story 6.1: Generate Schedule E PDF for Single Property

**As a** property owner,
**I want** to generate a Schedule E worksheet PDF for one property,
**So that** I can see a tax-ready summary of that property's finances.

**Acceptance Criteria:**

**Given** I am on a property detail page
**When** I click "Generate Report"
**Then** I see a modal with options:
- Tax Year (dropdown, defaults to selected year)
- [Preview] [Download]

**Given** I click "Preview"
**When** the PDF generates
**Then** I see a preview of the Schedule E worksheet in the modal
**And** I can scroll through the document

**Given** I click "Download"
**When** the PDF generates
**Then** the file downloads to my device
**And** filename format: `Schedule-E-{PropertyName}-{Year}.pdf`

**Given** the PDF content
**When** I view it
**Then** it includes:
- Property address at top
- Tax year
- Income section: Total rental income for the year
- Expense section: Totals by IRS Schedule E category
  - Line 5: Advertising
  - Line 6: Auto and travel
  - Line 7: Cleaning and maintenance
  - ... (all 15 categories)
- Net income/loss calculation
- Generated date and "Property Manager" watermark

**Prerequisites:** Story 5.6 (Receipt Capture complete)

**Technical Notes:**
- API: `POST /api/v1/reports/schedule-e` with `{ propertyId, year }`
- Returns PDF binary or generates and stores in S3
- PDF generation: QuestPDF, iTextSharp, or similar .NET library
- Match IRS Schedule E line numbers exactly
- UX: Modal with preview pane (per UX doc Section 5.5)

---

### Story 6.2: Generate Schedule E PDFs for All Properties

**As a** property owner with 14 rental properties,
**I want** to generate Schedule E worksheets for all properties at once,
**So that** I have everything ready for tax time in one click.

**Acceptance Criteria:**

**Given** I am on the Reports page
**When** I click "Generate All Schedule E Reports"
**Then** I see a modal with:
- Tax Year selector
- List of all properties with checkboxes (all checked by default)
- [Generate] button

**Given** I click "Generate"
**When** the generation starts
**Then** I see a progress indicator: "Generating 14 reports..."
**And** each property's PDF is generated

**Given** all PDFs are generated
**When** the process completes
**Then** I have the option to:
- Download as ZIP file (all PDFs bundled)
- Download individually from the list
**And** I see snackbar "14 reports ready for download"

**Given** some properties have no data for the selected year
**When** I generate reports
**Then** those properties show $0 totals (still generates PDF)
**Or** I'm warned "3 properties have no data for 2025"

**Prerequisites:** Story 6.1

**Technical Notes:**
- API: `POST /api/v1/reports/schedule-e/batch` with `{ propertyIds[], year }`
- Generate PDFs in parallel for speed
- ZIP creation on server or client-side
- Route: `/reports`
- Consider background job for large batches (future scale)

---

### Story 6.3: View and Manage Generated Reports

**As a** property owner,
**I want** to view previously generated reports,
**So that** I can re-download them without regenerating.

**Acceptance Criteria:**

**Given** I navigate to the Reports page
**When** the page loads
**Then** I see a list of previously generated reports showing:
- Property name (or "All Properties")
- Tax year
- Generated date
- [Download] [Delete] actions

**Given** I want to download a previous report
**When** I click "Download"
**Then** the PDF downloads (from stored copy or regenerates)

**Given** I want to delete old reports
**When** I click "Delete"
**Then** I see confirmation "Delete this report?"
**And** confirming removes it from the list

**Given** I have no generated reports
**When** I view the Reports page
**Then** I see: "No reports generated yet. Generate your first Schedule E report to get started."

**Prerequisites:** Story 6.2

**Technical Notes:**
- API: `GET /api/v1/reports` → list of generated reports
- API: `GET /api/v1/reports/{id}` → download PDF
- API: `DELETE /api/v1/reports/{id}` → remove report
- Store generated PDFs in S3 (or regenerate on demand)
- Route: `/reports`

---

### Story 6.4: Report Preview and Print

**As a** property owner,
**I want** to preview reports before downloading and print directly,
**So that** I can verify the data and get a physical copy if needed.

**Acceptance Criteria:**

**Given** I am viewing a report preview
**When** I want to verify the data
**Then** I can zoom in/out on the PDF
**And** I can scroll through multiple pages if present
**And** I can see all expense categories clearly

**Given** I want a physical copy
**When** I click "Print"
**Then** the browser print dialog opens with the PDF
**And** the document prints correctly formatted

**Given** I notice an error in the report
**When** I review the data
**Then** I can close the preview
**And** navigate to fix the expense/income entry
**And** regenerate the report with corrected data

**Prerequisites:** Story 6.3

**Technical Notes:**
- Use PDF.js or browser native PDF viewer for preview
- Print via `window.print()` or iframe print
- Consider showing source data summary alongside preview
- UX: Preview modal should be large enough to read comfortably

---

### Epic 6 Summary

| Story | Title | FRs | Prerequisites |
|-------|-------|-----|---------------|
| 6.1 | Generate Schedule E PDF for Single Property | FR49, FR51, FR52, FR53, FR54 | 5.6 |
| 6.2 | Generate Schedule E PDFs for All Properties | FR50 | 6.1 |
| 6.3 | View and Manage Generated Reports | - | 6.2 |
| 6.4 | Report Preview and Print | FR54 | 6.3 |

**Stories:** 4 | **FRs Covered:** FR49-FR54 ✅

**Epic 6 Milestone:** 🎯 *THE PAYOFF. Tax time magic. One click → 14 Schedule E PDFs → Email to accountant → Done.*

---

## FR Coverage Matrix

| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR1 | Register with email/password | 1 | 1.3 |
| FR2 | Email verification | 1 | 1.3 |
| FR3 | Login with email/password | 1 | 1.4 |
| FR4 | Logout with session termination | 1 | 1.5 |
| FR5 | Password reset via email | 1 | 1.6 |
| FR6 | Session persistence across tabs | 1 | 1.4 |
| FR7 | Create property | 2 | 2.1 |
| FR8 | View property list | 2 | 2.2 |
| FR9 | Edit property | 2 | 2.4 |
| FR10 | Delete property | 2 | 2.5 |
| FR11 | View property detail | 2 | 2.3 |
| FR12 | Create expense linked to property | 3 | 3.1 |
| FR13 | Expense required fields | 3 | 3.1 |
| FR14 | Expense optional fields (receipt) | 5 | 5.4 |
| FR15 | Edit expense | 3 | 3.2 |
| FR16 | Delete expense | 3 | 3.3 |
| FR17 | View expenses for property | 3 | 3.1 |
| FR18 | View all expenses | 3 | 3.4 |
| FR19 | Schedule E categories | 3 | 3.1 |
| FR20 | Filter by date range | 3 | 3.4 |
| FR21 | Filter by category | 3 | 3.4 |
| FR22 | Search by description | 3 | 3.4 |
| FR23 | Create income entry | 4 | 4.1 |
| FR24 | Income required fields | 4 | 4.1 |
| FR25 | Income optional fields | 4 | 4.1 |
| FR26 | Edit income | 4 | 4.2 |
| FR27 | Delete income | 4 | 4.2 |
| FR28 | View income for property | 4 | 4.1 |
| FR29 | Filter income by date | 4 | 4.3 |
| FR30 | Capture receipt via camera | 5 | 5.2 |
| FR31 | Upload receipt from storage | 5 | 5.1 |
| FR32 | Store receipts in S3 | 5 | 5.1 |
| FR33 | Create unlinked receipt | 5 | 5.2 |
| FR34 | View unprocessed receipts | 5 | 5.3 |
| FR35 | Link receipt to expense | 5 | 5.4 |
| FR36 | View receipt on expense | 5 | 5.5 |
| FR37 | Delete receipt | 5 | 5.5 |
| FR38 | Dashboard total expenses YTD | 3 | 3.5 |
| FR39 | Dashboard total income YTD | 4 | 4.4 |
| FR40 | Dashboard net income | 4 | 4.4 |
| FR41 | Dashboard property list | 2 | 2.2 |
| FR42 | Click property to navigate | 2 | 2.3 |
| FR43 | Property expense total | 3 | 3.5 |
| FR44 | Property income total | 4 | 4.4 |
| FR45 | Property recent expenses | 3 | 3.1 |
| FR46 | Property recent income | 4 | 4.1 |
| FR47 | Tax year selector | 3 | 3.5 |
| FR48 | Totals respect tax year | 3 | 3.5 |
| FR49 | Generate Schedule E for property | 6 | 6.1 |
| FR50 | Generate Schedule E for all | 6 | 6.2 |
| FR51 | PDF includes address, categories, income | 6 | 6.1 |
| FR52 | Select tax year for report | 6 | 6.1 |
| FR53 | Download PDF | 6 | 6.1 |
| FR54 | Preview PDF | 6 | 6.4 |
| FR55 | Immediate persistence | 1 | 1.2 |
| FR56 | Soft deletes | 1 | 1.2 |
| FR57 | Duplicate prevention | 3 | 3.6 |

**Coverage: 57/57 FRs (100%)** ✅

---

## Summary

### Epic Overview

| Epic | Name | Stories | FRs | Milestone |
|------|------|---------|-----|-----------|
| 1 | Foundation | 8 | FR1-6, FR55-56 | 🎸 First gig - app is LIVE |
| 2 | Property Management | 5 | FR7-11, FR41-42 | 📍 14 properties in system |
| 3 | Expense Tracking | 6 | FR12-22, FR38, FR43, FR45, FR47-48, FR57 | 💰 Core value loop complete |
| 4 | Income Tracking | 4 | FR23-29, FR39-40, FR44, FR46 | 📊 Complete financial picture |
| 5 | Receipt Capture | 6 | FR30-37 | 📸 Assembly line workflow |
| 6 | Tax Reports | 4 | FR49-54 | 🎯 THE PAYOFF |
| **Total** | | **33 stories** | **57 FRs** | |

### Story Dependency Chain

```
Epic 1: Foundation
    1.1 → 1.2 → 1.3 → 1.4 → 1.5
                  ↓       ↓
                1.6     1.7 → 1.8
                              ↓
Epic 2: Property Management ──────────────────────
    2.1 → 2.2 → 2.3 → 2.4 → 2.5
                              ↓
Epic 3: Expense Tracking (CORE) ──────────────────
    3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
                                    ↓
Epic 4: Income Tracking ──────────────────────────
    4.1 → 4.2 → 4.3 → 4.4
                        ↓
Epic 5: Receipt Capture ──────────────────────────
    5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
                                    ↓
Epic 6: Tax Reports (PAYOFF) ─────────────────────
    6.1 → 6.2 → 6.3 → 6.4
                        ↓
                      DONE! 🎉
```

### Key Design Decisions Captured

1. **Multi-device sessions** - Phone + desktop can be logged in simultaneously (Story 1.4)
2. **Expense Workspace pattern** - Form + history on same page for batch entry (Story 3.1)
3. **Tax year as global filter** - Selection persists across navigation (Story 3.5)
4. **Dual-device receipt workflow** - Capture on phone, process on desktop, SignalR sync (Epic 5)
5. **Deploy early** - Story 1.8 ensures every subsequent epic ships to production

### User Journey Alignment

| Journey Stage | Epic | User Says |
|---------------|------|-----------|
| Setup | 1, 2 | "My properties are in the system" |
| Weekly Entry | 3, 4 | "I track what I spend and earn" |
| Receipt Capture | 5 | "I snap receipts on my phone" |
| Tax Time | 6 | "One click and I'm done" |

---

## What's Next

1. **Run `create-story` workflow** for each story to generate detailed implementation specs
2. **Run `sprint-planning` workflow** to create sprint status tracking
3. **Begin Epic 1** - Foundation stories are ready for implementation

---

_Generated by BMAD Epic & Story Workflow_
_Date: 2025-11-29_
_For: Dave_
_Project: property-manager_
