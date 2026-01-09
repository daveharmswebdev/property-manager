---
stepsCompleted: [1, 2, 3, 4]
status: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/prd-work-orders-vendors.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Property Manager Phase 2: Work Orders & Vendors - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Property Manager Phase 2 (Work Orders & Vendors), decomposing the requirements from the PRD, Architecture, and UX Design into implementable stories.

## Requirements Inventory

### Functional Requirements

**Person Management (Foundation):**
- FR1: System supports Person as a base entity with first name, middle name, last name
- FR2: System supports multiple phone numbers per Person with optional labels
- FR3: System supports multiple email addresses per Person
- FR4: Person records include standard audit fields (created, updated, soft delete)
- FR5: Person entity serves as base for Vendor (and future Tenant, User refactor)

**Vendor Management:**
- FR6: Users can create a new vendor with minimal required fields (name only)
- FR7: Users can add optional vendor details (phone, email, trade tags) at any time
- FR8: Users can assign one or more trade tags to a vendor
- FR9: Users can view a list of all vendors
- FR10: Users can search/filter vendors by name or trade tag
- FR11: Users can edit vendor details
- FR12: Users can delete a vendor (soft delete)
- FR13: Users can view a vendor's work order history
- FR14: System allows vendor creation inline during work order assignment (no blocking validation)

**Work Order Management:**
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

**Work Order-Expense Integration:**
- FR29: Users can link an existing expense to a work order
- FR30: Users can link an existing work order to an expense
- FR31: Users can create a work order from an expense detail page (retroactive)
- FR32: Users can create an expense from a work order detail page
- FR33: Users can view linked work order context when viewing an expense
- FR34: Users can view linked expenses when viewing a work order
- FR35: Work order dropdown appears on receipt processing form (active work orders only)
- FR36: A work order can have zero or many linked expenses
- FR37: An expense can have zero or one linked work order

**Taxonomy Management:**
- FR38: System maintains expense categories as hierarchical taxonomy
- FR39: System maintains vendor trade tags as flat taxonomy
- FR40: System maintains mappings between expense categories and trade tags
- FR41: Users see autocomplete suggestions when entering tags (work order tags, vendor trade tags)

**Notes & Attachments:**
- FR42: Users can add notes to a work order (timestamped entries)
- FR43: Users can attach photos to a work order
- FR44: Users can view photos attached to a work order
- FR45: Users can delete photos from a work order
- FR46: Users can delete notes from a work order
- FR47: Notes system is polymorphic (reusable for future entities)

**Document Generation:**
- FR48: Users can generate a PDF for a single work order
- FR49: Work order PDF includes: property info, issue description, status, category, assigned vendor, notes, linked expenses
- FR50: Users can download the generated work order PDF
- FR51: Users can preview work order PDF before download

### Non-Functional Requirements

**Performance:**
- NFR1: Page load time under 3 seconds on typical broadband
- NFR2: Navigation between routes completes in under 1 second
- NFR3: Form submissions provide feedback within 500ms
- NFR4: Work order list handles 500+ records with pagination (no client-side performance degradation)
- NFR5: Search/filter operations return results within 1 second
- NFR6: Photo upload completes within 5 seconds for images under 5MB
- NFR7: Work order PDF generation completes within 10 seconds
- NFR8: PDF preview renders without blocking UI

**Security:**
- NFR9: All routes require authentication (no anonymous access to data)
- NFR10: Users can only access their own properties, work orders, vendors, expenses
- NFR11: JWT tokens expire appropriately (current system patterns)
- NFR12: All data transmitted over HTTPS (TLS 1.2+)
- NFR13: Passwords stored with secure hashing (current system patterns)
- NFR14: Sensitive data not logged in plain text
- NFR15: Sessions invalidate on logout
- NFR16: Concurrent session handling follows current system patterns

**Maintainability & Testability:**
- NFR17: New code follows existing Clean Architecture patterns
- NFR18: New code follows existing folder/namespace conventions
- NFR19: No new architectural patterns without documented justification
- NFR20: Unit tests cover business logic in Application layer handlers
- NFR21: E2E tests cover critical user workflows (work order CRUD, linking)
- NFR22: Test coverage maintained at current project levels for new code
- NFR23: API endpoints documented in Swagger/OpenAPI
- NFR24: Complex business logic has inline comments explaining "why"

### Additional Requirements

**From Architecture - Data Model Decisions:**
- Person entity uses TPT (Table-per-Type) inheritance pattern
- Phone/Email stored as JSONB columns on Person table
- Polymorphic Notes table with EntityType + EntityId discriminator pattern
- Hierarchical expense categories (with ParentId), flat trade tags, mapping table between them
- Work Order ↔ Expense: FK on Expense (WorkOrderId) for 1:N relationship
- Work Order Status stored as C# Enum converted to string in database
- Work Order Tags use separate table with M:M junction
- Assigned To uses nullable VendorId (NULL = DIY/Self assignment)
- Photo Attachments reuse Receipt pattern: WorkOrderPhotos table + S3 presigned URLs
- Category hierarchy uses flat API with ParentId (client builds tree structure)
- Dashboard view uses list with status filters (Kanban view deferred to Growth)
- Tag input uses Angular Material Chips + Autocomplete components

**From Architecture - API Design:**
- All endpoints under /api/v1/ prefix
- Work Orders: full CRUD + photo upload + notes + expense linking endpoints
- Vendors: full CRUD + work order history endpoint
- Supporting endpoints for trade tags, work order tags
- Query parameters for filtering (status, property, vendor, date range, search)

**From Architecture - Implementation Phases (from PRD):**
- Phase A: Foundation (Person, taxonomies, Notes table)
- Phase B: Core Entities (Vendor, WorkOrder)
- Phase C: Attachments & Links (Photos, Notes on WorkOrder, Expense FK)
- Phase D: Integration (Receipt processing dropdown, bidirectional linking UI)
- Phase E: Output (Work Order PDF generation)

**From UX Design:**
- Mobile-first approach for work order creation (optimized for phone at job site)
- Property-first navigation pattern extends to work orders
- "Obvious, not clever" design principle applies
- Angular Material components with Forest Green theme
- Snackbar confirmations for user feedback
- List view for work order dashboard (not Kanban for MVP)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Person base entity with name fields |
| FR2 | Epic 1 | Multiple phone numbers per Person |
| FR3 | Epic 1 | Multiple email addresses per Person |
| FR4 | Epic 1 | Person audit fields |
| FR5 | Epic 1 | Person as base for Vendor |
| FR6 | Epic 1 | Create vendor with minimal fields |
| FR7 | Epic 1 | Add optional vendor details |
| FR8 | Epic 1 | Assign trade tags to vendor |
| FR9 | Epic 1 | View vendor list |
| FR10 | Epic 1 | Search/filter vendors |
| FR11 | Epic 1 | Edit vendor details |
| FR12 | Epic 1 | Delete vendor (soft delete) |
| FR13 | Epic 1 | View vendor work order history |
| FR14 | Epic 1 | Inline vendor creation |
| FR15 | Epic 2 | Create work order linked to property |
| FR16 | Epic 2 | Set work order status |
| FR17 | Epic 2 | Assign category to work order |
| FR18 | Epic 2 | Add description to work order |
| FR19 | Epic 2 | Add tags to work order |
| FR20 | Epic 2 | Assign work order to vendor |
| FR21 | Epic 2 | Assign work order to Self (DIY) |
| FR22 | Epic 2 | View work orders in dashboard |
| FR23 | Epic 2 | Filter work orders by status |
| FR24 | Epic 2 | Filter work orders by property |
| FR25 | Epic 2 | View work order detail page |
| FR26 | Epic 2 | Edit work order details |
| FR27 | Epic 2 | Delete work order (soft delete) |
| FR28 | Epic 2 | View work order history for property |
| FR29 | Epic 4 | Link expense to work order |
| FR30 | Epic 4 | Link work order to expense |
| FR31 | Epic 4 | Create work order from expense (retroactive) |
| FR32 | Epic 4 | Create expense from work order |
| FR33 | Epic 4 | View linked work order on expense |
| FR34 | Epic 4 | View linked expenses on work order |
| FR35 | Epic 4 | Work order dropdown on receipt processing |
| FR36 | Epic 4 | Work order has many expenses |
| FR37 | Epic 4 | Expense has one work order |
| FR38 | Epic 2 | Hierarchical expense categories |
| FR39 | Epic 1 | Flat vendor trade tags |
| FR40 | Epic 1 | Category-trade tag mappings |
| FR41 | Epic 1 | Tag autocomplete suggestions |
| FR42 | Epic 3 | Add notes to work order |
| FR43 | Epic 3 | Attach photos to work order |
| FR44 | Epic 3 | View photos on work order |
| FR45 | Epic 3 | Delete photos from work order |
| FR46 | Epic 3 | Delete notes from work order |
| FR47 | Epic 3 | Polymorphic notes system |
| FR48 | Epic 5 | Generate work order PDF |
| FR49 | Epic 5 | PDF includes full work order details |
| FR50 | Epic 5 | Download work order PDF |
| FR51 | Epic 5 | Preview work order PDF |

**Coverage: 51/51 FRs mapped (100%)**

## Epic List

### Epic 1: Vendor Management
**User Outcome:** "I have my vendor network in the system with their trade specialties"

Users can create, manage, and organize their vendors with trade tags. This is Marcus's vendor network - the plumbers, electricians, and handymen he relies on. Includes the Person entity foundation that enables the Vendor entity.

**FRs Covered:** FR1-FR14, FR39, FR40, FR41

**Key Deliverables:**
- Person entity with TPT inheritance (foundation)
- Vendor entity extending Person
- Trade tag taxonomy (flat structure)
- Category-trade tag mappings
- Vendor CRUD operations
- Vendor search and filtering
- Trade tag autocomplete

---

### Epic 2: Work Order Tracking
**User Outcome:** "I can track maintenance issues across my properties"

Users can create work orders linked to properties, assign vendors (or DIY), and track status through completion. This is the operational heart - Marcus managing his four fires on a Thursday morning.

**FRs Covered:** FR15-FR28, FR38

**Key Deliverables:**
- Work Order entity with status tracking
- Work order CRUD operations
- Vendor/DIY assignment
- Work order tags with autocomplete
- Dashboard view with status filters
- Property-level work order history
- Category hierarchy (ParentId on ExpenseCategories)

---

### Epic 3: Work Order Context
**User Outcome:** "I can document everything about a repair with photos and notes"

Users can add rich context to work orders - photos of the problem, timestamped notes tracking progress. This is Sarah's institutional memory - "what did we do last time this happened?"

**FRs Covered:** FR42-FR47

**Key Deliverables:**
- Polymorphic Notes table
- Notes CRUD on work orders
- WorkOrderPhotos table (S3 pattern)
- Photo upload with presigned URLs
- Photo viewing and deletion

---

### Epic 4: Work Order-Expense Integration
**User Outcome:** "I know the story behind every expense - which work order it came from"

Users can link expenses to work orders bidirectionally. Create work orders retroactively from expenses. See linked expenses on work orders. This is tax time context - "$500 for what?"

**FRs Covered:** FR29-FR37

**Key Deliverables:**
- WorkOrderId FK on Expense table
- Bidirectional linking UI
- Retroactive work order creation from expense
- Create expense from work order
- Work order dropdown on receipt processing
- Linked expense display on work order detail

---

### Epic 5: Work Order Output
**User Outcome:** "I can generate a professional work order PDF to share with vendors"

Users can generate, preview, and download work order PDFs containing all relevant details. This is Joe the plumber receiving a clear, professional job description.

**FRs Covered:** FR48-FR51

**Key Deliverables:**
- Work order PDF generation (extends existing PDF service)
- PDF includes: property info, description, status, category, vendor, notes, linked expenses
- PDF preview functionality
- PDF download

---

## Epic Dependencies

```
Epic 1: Vendor Management
    ↓ (provides vendors for assignment)
Epic 2: Work Order Tracking
    ↓ (provides work orders to enrich)
Epic 3: Work Order Context
    ↓ (provides work orders to link)
Epic 4: Work Order-Expense Integration
    ↓ (provides complete work orders to output)
Epic 5: Work Order Output
```

Each epic is **standalone and usable** after completion.

---

## Epic 1: Vendor Management - Stories

**Goal:** Users can create, manage, and organize their vendors with trade tags - Marcus's network of plumbers, electricians, and handymen.

**FRs Covered:** FR1-FR13, FR39, FR40, FR41

---

### Story 1.1: Person & Vendor Entity Foundation

As a **developer**,
I want **the Person and Vendor database entities and API infrastructure created**,
So that **vendors can be stored and retrieved with proper data architecture**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** a `Persons` table exists with columns:
- Id (UUID, PK)
- AccountId (UUID, FK to Accounts)
- FirstName (VARCHAR 100, NOT NULL)
- MiddleName (VARCHAR 100, nullable)
- LastName (VARCHAR 100, NOT NULL)
- Phones (JSONB, default '[]')
- Emails (JSONB, default '[]')
- CreatedAt, UpdatedAt (timestamps)

**And** a `Vendors` table exists with columns:
- Id (UUID, PK, FK to Persons.Id - TPT inheritance)
- DeletedAt (timestamp, nullable for soft delete)

**And** EF Core entities are configured with TPT inheritance
**And** global query filter enforces AccountId tenant isolation
**And** global query filter excludes soft-deleted vendors

**Given** the API is running
**When** I call `GET /api/v1/vendors`
**Then** I receive an empty list (no vendors yet)
**And** the response follows the standard format `{ items: [], totalCount: 0 }`

---

### Story 1.2: Trade Tag Taxonomy Setup

As a **developer**,
I want **the trade tag taxonomy and category mappings created**,
So that **vendors can be tagged by trade specialty and mapped to expense categories**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** a `VendorTradeTags` table exists with columns:
- Id (UUID, PK)
- AccountId (UUID, FK to Accounts)
- Name (VARCHAR 100, NOT NULL)
- CreatedAt (timestamp)
- UNIQUE constraint on (AccountId, Name)

**And** a `CategoryTradeTagMappings` table exists with columns:
- CategoryId (UUID, FK to ExpenseCategories)
- TradeTagId (UUID, FK to VendorTradeTags)
- PRIMARY KEY (CategoryId, TradeTagId)

**Given** the API is running
**When** I call `GET /api/v1/vendor-trade-tags`
**Then** I receive a list of trade tags for my account

**Given** I want to create a new trade tag
**When** I call `POST /api/v1/vendor-trade-tags` with `{ "name": "Plumber" }`
**Then** the trade tag is created
**And** I receive `{ "id": "<guid>" }`

**Given** a trade tag with that name already exists for my account
**When** I try to create a duplicate
**Then** I receive a 409 Conflict error

---

### Story 1.3: Create Vendor (Minimal)

As a **property owner**,
I want **to add a vendor with just their name**,
So that **I can quickly capture a new vendor without stopping to enter all details**.

**Acceptance Criteria:**

**Given** I am logged in and on the Vendors page
**When** I click "Add Vendor"
**Then** I see a form with fields:
- First Name (required)
- Last Name (required)
- Middle Name (optional)

**Given** I enter a first and last name
**When** I click "Save"
**Then** the vendor is created with my AccountId
**And** I see snackbar "Vendor added ✓"
**And** I am returned to the vendor list
**And** the new vendor appears in the list

**Given** I leave First Name or Last Name empty
**When** I try to submit
**Then** I see validation error "First name is required" / "Last name is required"
**And** the form does not submit

---

### Story 1.4: Add Vendor Details & Trade Tags

As a **property owner**,
I want **to add contact info and trade specialties to a vendor**,
So that **I can find them easily and know what jobs they handle**.

**Acceptance Criteria:**

**Given** I am creating or editing a vendor
**When** I view the form
**Then** I see additional fields:
- Phone Numbers (repeatable field with optional label: "Mobile", "Office", etc.)
- Email Addresses (repeatable field)
- Trade Tags (multi-select with autocomplete)

**Given** I add a phone number
**When** I enter the number and optional label
**Then** I can add multiple phone numbers
**And** each can have its own label

**Given** I type in the Trade Tags field
**When** matching tags exist in my account
**Then** I see autocomplete suggestions
**And** I can select existing tags

**Given** I type a tag name that doesn't exist
**When** I press Enter or select "Create new"
**Then** a new trade tag is created for my account
**And** it is assigned to this vendor

**Given** I save a vendor with phone, email, and trade tags
**When** the save completes
**Then** all details are persisted correctly
**And** I see the updated info on the vendor list/detail

---

### Story 1.5: View Vendor List

As a **property owner**,
I want **to see all my vendors in a list**,
So that **I can quickly find and manage my vendor network**.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Vendors page (`/vendors`)
**Then** I see a list of all my vendors showing:
- Vendor name (First Last)
- Trade tags as chips/badges
- Phone number (primary, if exists)
- Email (primary, if exists)

**Given** I have no vendors
**When** I view the Vendors page
**Then** I see empty state: "No vendors yet. Add your first vendor to get started."
**And** I see an "Add Vendor" button

**Given** I have multiple vendors
**When** I view the list
**Then** vendors are sorted alphabetically by last name

**Given** I click on a vendor row
**When** the navigation completes
**Then** I am taken to the vendor detail page

---

### Story 1.6: Search & Filter Vendors

As a **property owner**,
I want **to search and filter my vendors by name or trade**,
So that **I can quickly find the right vendor for a job**.

**Acceptance Criteria:**

**Given** I am on the Vendors page with multiple vendors
**When** I type in the search box
**Then** the list filters in real-time to show vendors matching the search text
**And** search matches against first name, last name, or combined name

**Given** I want to filter by trade
**When** I select one or more trade tags from the filter dropdown
**Then** only vendors with those trade tags are shown

**Given** I apply both search and trade filter
**When** the filters are active
**Then** results match both criteria (AND logic)
**And** I see active filter indicators
**And** I see a "Clear filters" link

**Given** no vendors match my filters
**When** the list is empty
**Then** I see "No vendors match your search" with a clear filters option

---

### Story 1.7: Edit Vendor

As a **property owner**,
I want **to update a vendor's information**,
So that **I can keep my vendor records accurate**.

**Acceptance Criteria:**

**Given** I am on the vendor detail page or vendor list
**When** I click "Edit" on a vendor
**Then** I see the edit form pre-populated with current values

**Given** I am on the edit form
**When** I modify fields and click "Save"
**Then** the vendor is updated in the database
**And** UpdatedAt timestamp is set
**And** I see snackbar "Vendor updated ✓"
**And** I am returned to the vendor detail page

**Given** I add or remove trade tags
**When** I save
**Then** the vendor's trade tag associations are updated correctly

**Given** I click "Cancel"
**When** I have unsaved changes
**Then** I see confirmation "You have unsaved changes. Discard?"
**And** if confirmed, I return without saving

---

### Story 1.8: Delete Vendor

As a **property owner**,
I want **to remove a vendor I no longer work with**,
So that **my vendor list stays relevant**.

**Acceptance Criteria:**

**Given** I am on the vendor detail page or list
**When** I click "Delete" on a vendor
**Then** I see confirmation dialog: "Delete [Vendor Name]?"
**And** message: "This vendor will be removed from your list. Work orders assigned to this vendor will show 'Deleted Vendor'."

**Given** I confirm deletion
**When** the delete completes
**Then** the vendor is soft-deleted (DeletedAt timestamp set)
**And** I see snackbar "Vendor deleted"
**And** the vendor no longer appears in my vendor list

**Given** I click "Cancel" on the confirmation
**When** the dialog closes
**Then** the vendor remains unchanged

---

### Story 1.9: Vendor Detail Page

As a **property owner**,
I want **to view all details about a vendor including their work history**,
So that **I can evaluate their track record and find their contact info**.

**Acceptance Criteria:**

**Given** I click on a vendor from the list
**When** the detail page loads (`/vendors/:id`)
**Then** I see:
- Vendor full name as page title
- All phone numbers with labels
- All email addresses
- Trade tags as chips
- "Work Order History" section

**Given** the vendor has no work orders yet
**When** I view the Work Order History section
**Then** I see "No work orders yet for this vendor"

**Given** I try to access a vendor that doesn't exist or belongs to another account
**When** the page loads
**Then** I see 404 "Vendor not found"

**Given** I am on the vendor detail page
**When** I want to take action
**Then** I see [Edit] and [Delete] buttons

---

### Epic 1 Summary

| Story | Title | FRs Covered |
|-------|-------|-------------|
| 1.1 | Person & Vendor Entity Foundation | FR1-FR5 |
| 1.2 | Trade Tag Taxonomy Setup | FR39, FR40 |
| 1.3 | Create Vendor (Minimal) | FR6 |
| 1.4 | Add Vendor Details & Trade Tags | FR7, FR8, FR41 |
| 1.5 | View Vendor List | FR9 |
| 1.6 | Search & Filter Vendors | FR10 |
| 1.7 | Edit Vendor | FR11 |
| 1.8 | Delete Vendor | FR12 |
| 1.9 | Vendor Detail Page | FR13 |

**Stories:** 9 | **FRs Covered:** FR1-FR13, FR39-FR41 ✅

---

## Epic 2: Work Order Tracking - Stories

**Goal:** Users can create work orders linked to properties, assign vendors (or DIY), and track status through completion - Marcus managing his four fires on a Thursday morning.

**FRs Covered:** FR14, FR15-FR28, FR38

---

### Story 2.1: Work Order Entity & Category Hierarchy

As a **developer**,
I want **the Work Order database entities and category hierarchy created**,
So that **work orders can be stored with proper relationships and categories can be nested**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** a `WorkOrders` table exists with columns:
- Id (UUID, PK)
- AccountId (UUID, FK to Accounts)
- PropertyId (UUID, FK to Properties, NOT NULL)
- VendorId (UUID, FK to Vendors, nullable - NULL means DIY)
- CategoryId (UUID, FK to ExpenseCategories, nullable)
- CreatedByUserId (UUID, FK to Users)
- Status (VARCHAR 50, NOT NULL, default 'Reported')
- Description (TEXT, NOT NULL)
- CreatedAt, UpdatedAt (timestamps)
- DeletedAt (timestamp, nullable)

**And** a `WorkOrderTags` table exists with columns:
- Id (UUID, PK)
- AccountId (UUID, FK to Accounts)
- Name (VARCHAR 100, NOT NULL)
- CreatedAt (timestamp)
- UNIQUE constraint on (AccountId, Name)

**And** a `WorkOrderTagAssignments` junction table exists with:
- WorkOrderId (UUID, FK to WorkOrders)
- TagId (UUID, FK to WorkOrderTags)
- PRIMARY KEY (WorkOrderId, TagId)

**And** `ExpenseCategories` table has new column:
- ParentId (UUID, FK to ExpenseCategories, nullable)

**And** EF Core entities are configured with relationships
**And** global query filter enforces AccountId tenant isolation
**And** global query filter excludes soft-deleted work orders

**Given** the API is running
**When** I call `GET /api/v1/work-orders`
**Then** I receive an empty list with standard response format

**Given** I call `GET /api/v1/expense-categories`
**When** categories have ParentId set
**Then** the response includes ParentId for building hierarchy on client

---

### Story 2.2: Create Work Order

As a **property owner**,
I want **to create a work order for a maintenance issue**,
So that **I can track what needs to be fixed at my property**.

**Acceptance Criteria:**

**Given** I am logged in and on the Work Orders page or a Property detail page
**When** I click "New Work Order"
**Then** I see a form with fields:
- Property (required, dropdown of my properties - pre-selected if coming from property page)
- Description (required, textarea)
- Category (optional, dropdown with hierarchical expense categories)
- Status (required, dropdown: Reported, Assigned, Completed - defaults to "Reported")

**Given** I fill in required fields (property, description)
**When** I click "Save"
**Then** the work order is created with my AccountId and CreatedByUserId
**And** I see snackbar "Work order created ✓"
**And** I am taken to the work order detail page

**Given** I select a category
**When** the category dropdown is open
**Then** I see categories displayed hierarchically (indented children)
**And** I can select any category at any level

**Given** I leave required fields empty
**When** I try to submit
**Then** I see validation errors
**And** the form does not submit

---

### Story 2.3: Add Work Order Tags

As a **property owner**,
I want **to add tags to a work order**,
So that **I can categorize and find work orders by custom labels**.

**Acceptance Criteria:**

**Given** I am creating or editing a work order
**When** I view the form
**Then** I see a Tags field with autocomplete input

**Given** I type in the Tags field
**When** matching tags exist in my account
**Then** I see autocomplete suggestions (GitHub-style dropdown)
**And** I can select existing tags

**Given** I type a tag that doesn't exist
**When** I press Enter or Tab
**Then** a new tag is created for my account
**And** it appears as a chip in the field

**Given** I have added multiple tags
**When** I view the tags
**Then** each tag appears as a removable chip
**And** I can click X to remove a tag

**Given** I save the work order with tags
**When** the save completes
**Then** tag associations are persisted in WorkOrderTagAssignments
**And** tags display on the work order detail and list views

---

### Story 2.4: Assign Work Order (Vendor or DIY)

As a **property owner**,
I want **to assign a work order to a vendor or mark it as DIY**,
So that **I know who's responsible for the repair**.

**Acceptance Criteria:**

**Given** I am creating or editing a work order
**When** I view the form
**Then** I see an "Assigned To" field with options:
- "Self (DIY)" option at top
- List of my vendors (from Epic 1)

**Given** I select a vendor
**When** I save the work order
**Then** VendorId is set to that vendor's ID
**And** Status automatically changes to "Assigned" if it was "Reported"

**Given** I select "Self (DIY)"
**When** I save the work order
**Then** VendorId is NULL
**And** the work order displays "DIY" or "Self" as the assignee

**Given** I change assignment from one vendor to another
**When** I save
**Then** the VendorId is updated
**And** the change is reflected immediately

**Given** I view a work order with a vendor assigned
**When** I look at the assignee
**Then** I see the vendor's name as a link to their detail page

---

### Story 2.5: Inline Vendor Creation

As a **property owner**,
I want **to create a new vendor while assigning a work order**,
So that **I don't have to leave the form to add a vendor I just found**.

**Acceptance Criteria:**

**Given** I am on the work order form in the "Assigned To" field
**When** I click "+ Add New Vendor" option
**Then** a dialog/drawer opens with the minimal vendor form (First Name, Last Name)

**Given** I fill in the vendor name in the dialog
**When** I click "Save"
**Then** the vendor is created in my account
**And** the dialog closes
**And** the new vendor is automatically selected in the "Assigned To" field
**And** I can continue editing the work order

**Given** I click "Cancel" on the vendor dialog
**When** the dialog closes
**Then** no vendor is created
**And** the "Assigned To" field remains as it was

**Given** I create a vendor inline
**When** I later go to the Vendors page
**Then** the vendor appears in my vendor list
**And** I can add more details (phone, email, trade tags) later

---

### Story 2.6: Work Order Dashboard

As a **property owner**,
I want **to see all my work orders in one place**,
So that **I can track what's happening across all my properties**.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to Work Orders (`/work-orders`)
**Then** I see a list of all my work orders showing:
- Status (as colored badge: Reported=yellow, Assigned=blue, Completed=green)
- Property name
- Description (truncated if long)
- Assigned to (vendor name or "DIY")
- Category (if set)
- Created date
- Tags (as small chips)

**Given** I have no work orders
**When** I view the page
**Then** I see empty state: "No work orders yet. Create one to start tracking maintenance."
**And** I see a "New Work Order" button

**Given** I have multiple work orders
**When** I view the list
**Then** work orders are sorted by created date (newest first)
**And** I can click any row to go to its detail page

**Given** I click "New Work Order"
**When** the form opens
**Then** I can create a new work order (per Story 2.2)

---

### Story 2.7: Filter Work Orders

As a **property owner**,
I want **to filter work orders by status and property**,
So that **I can focus on what needs attention**.

**Acceptance Criteria:**

**Given** I am on the Work Orders dashboard
**When** I look at the filter controls
**Then** I see:
- Status filter (multi-select: Reported, Assigned, Completed)
- Property filter (dropdown of my properties)

**Given** I select status "Reported" and "Assigned"
**When** the filter applies
**Then** only work orders with those statuses are shown
**And** Completed work orders are hidden

**Given** I select a specific property
**When** the filter applies
**Then** only work orders for that property are shown

**Given** I apply multiple filters
**When** viewing results
**Then** filters combine with AND logic
**And** I see active filter indicators
**And** I see a "Clear filters" link

**Given** no work orders match my filters
**When** the list is empty
**Then** I see "No work orders match your filters"

**Given** I clear filters
**When** the list refreshes
**Then** all work orders are shown again

---

### Story 2.8: Work Order Detail Page

As a **property owner**,
I want **to view all details of a work order**,
So that **I can see the full picture of a maintenance issue**.

**Acceptance Criteria:**

**Given** I click on a work order from the list
**When** the detail page loads (`/work-orders/:id`)
**Then** I see:
- Status badge (prominent, colored)
- Property name (link to property detail)
- Description (full text)
- Category (if set)
- Assigned to (vendor name with link, or "DIY")
- Tags (as chips)
- Created date and by whom
- Updated date

**And** I see action buttons:
- [Edit] - goes to edit form
- [Delete] - triggers delete confirmation

**And** I see placeholder sections for future epics:
- "Photos" section (empty state: "No photos yet" - Epic 3)
- "Notes" section (empty state: "No notes yet" - Epic 3)
- "Linked Expenses" section (empty state: "No expenses linked" - Epic 4)

**Given** I try to access a work order that doesn't exist or belongs to another account
**When** the page loads
**Then** I see 404 "Work order not found"

---

### Story 2.9: Edit Work Order

As a **property owner**,
I want **to update a work order's details**,
So that **I can correct information or change status as work progresses**.

**Acceptance Criteria:**

**Given** I am on the work order detail page
**When** I click "Edit"
**Then** I see the edit form pre-populated with current values

**Given** I change the status to "Completed"
**When** I save
**Then** the status is updated
**And** I see snackbar "Work order updated ✓"
**And** the detail page shows the new status

**Given** I change the assigned vendor
**When** I save
**Then** the assignment is updated
**And** the detail page shows the new assignee

**Given** I modify description, category, or tags
**When** I save
**Then** all changes are persisted
**And** UpdatedAt timestamp is set

**Given** I click "Cancel"
**When** I have unsaved changes
**Then** I see confirmation "Discard changes?"
**And** if confirmed, I return to detail page without saving

---

### Story 2.10: Delete Work Order

As a **property owner**,
I want **to delete a work order**,
So that **I can remove entries created by mistake**.

**Acceptance Criteria:**

**Given** I am on the work order detail page
**When** I click "Delete"
**Then** I see confirmation dialog: "Delete this work order?"
**And** message: "This will remove the work order. Linked expenses will be unlinked."

**Given** I confirm deletion
**When** the delete completes
**Then** the work order is soft-deleted (DeletedAt set)
**And** I see snackbar "Work order deleted"
**And** I am redirected to the Work Orders dashboard
**And** the work order no longer appears in lists

**Given** I click "Cancel"
**When** the dialog closes
**Then** the work order remains unchanged

---

### Story 2.11: Property Work Order History

As a **property owner**,
I want **to see all work orders for a specific property**,
So that **I can understand the maintenance history of that property**.

**Acceptance Criteria:**

**Given** I am on a property detail page (`/properties/:id`)
**When** the page loads
**Then** I see a "Work Orders" section showing:
- List of work orders for this property
- Status, description (truncated), assigned to, date
- Count of total work orders

**Given** the property has no work orders
**When** I view the section
**Then** I see "No work orders for this property"
**And** I see "+ New Work Order" button

**Given** I click "+ New Work Order" from the property page
**When** the work order form opens
**Then** the property is pre-selected in the form

**Given** I click on a work order in the list
**When** navigation completes
**Then** I am taken to that work order's detail page

**Given** the property has many work orders
**When** I view the section
**Then** I see the most recent 5-10 with a "View all" link
**And** "View all" takes me to Work Orders dashboard filtered by this property

---

### Epic 2 Summary

| Story | Title | FRs Covered |
|-------|-------|-------------|
| 2.1 | Work Order Entity & Category Hierarchy | FR38 |
| 2.2 | Create Work Order | FR15, FR16, FR17, FR18 |
| 2.3 | Add Work Order Tags | FR19 |
| 2.4 | Assign Work Order (Vendor or DIY) | FR20, FR21 |
| 2.5 | Inline Vendor Creation | FR14 |
| 2.6 | Work Order Dashboard | FR22 |
| 2.7 | Filter Work Orders | FR23, FR24 |
| 2.8 | Work Order Detail Page | FR25 |
| 2.9 | Edit Work Order | FR26 |
| 2.10 | Delete Work Order | FR27 |
| 2.11 | Property Work Order History | FR28 |

**Stories:** 11 | **FRs Covered:** FR14, FR15-FR28, FR38 ✅

---

## Epic 3: Work Order Context - Stories

**Goal:** Users can add rich context to work orders - photos of the problem, timestamped notes tracking progress. This is Sarah's institutional memory - "what did we do last time this happened?"

**FRs Covered:** FR42-FR47

---

### Story 3.1: Polymorphic Notes Entity

As a **developer**,
I want **a polymorphic notes table that can attach to any entity**,
So that **notes can be reused for work orders now and other entities in the future**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** a `Notes` table exists with columns:
- Id (UUID, PK)
- AccountId (UUID, FK to Accounts)
- EntityType (VARCHAR 50, NOT NULL) - e.g., 'WorkOrder', 'Vendor'
- EntityId (UUID, NOT NULL) - the ID of the related entity
- Content (TEXT, NOT NULL)
- CreatedByUserId (UUID, FK to Users)
- CreatedAt (timestamp, NOT NULL)
- UpdatedAt (timestamp, NOT NULL)
- DeletedAt (timestamp, nullable)

**And** an index exists on (EntityType, EntityId) for efficient lookups
**And** global query filter enforces AccountId tenant isolation
**And** global query filter excludes soft-deleted notes

**Given** the API is running
**When** I call `GET /api/v1/work-orders/:id/notes`
**Then** I receive notes filtered by EntityType='WorkOrder' and EntityId=:id
**And** response format is `{ items: [], totalCount: 0 }`

---

### Story 3.2: Add Notes to Work Order

As a **property owner**,
I want **to add timestamped notes to a work order**,
So that **I can track progress and document what happened**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I view the Notes section
**Then** I see:
- List of existing notes (if any)
- Text input field to add a new note
- "Add Note" button

**Given** I type a note and click "Add Note"
**When** the note is saved
**Then** the note is created with:
- My AccountId and UserId
- EntityType = 'WorkOrder'
- EntityId = this work order's ID
- Current timestamp as CreatedAt
**And** I see snackbar "Note added ✓"
**And** the new note appears at the top of the notes list
**And** the input field clears

**Given** I view the notes list
**When** notes exist
**Then** each note shows:
- Note content
- Who added it (user name or email)
- When it was added (formatted timestamp, e.g., "Jan 8, 2026 at 2:34 PM")
**And** notes are sorted newest first

**Given** I try to add an empty note
**When** I click "Add Note"
**Then** nothing happens (button disabled when input empty)
**Or** I see validation "Note cannot be empty"

**Given** I add a note with a long text
**When** viewing the note
**Then** the full text is displayed (no truncation in detail view)

---

### Story 3.3: Delete Notes

As a **property owner**,
I want **to delete notes from a work order**,
So that **I can remove incorrect or outdated information**.

**Acceptance Criteria:**

**Given** I am viewing notes on a work order
**When** I hover over a note I created
**Then** I see a delete icon/button

**Given** I click delete on a note
**When** the confirmation appears
**Then** I see "Delete this note?"
**And** options [Cancel] [Delete]

**Given** I confirm deletion
**When** the delete completes
**Then** the note is soft-deleted (DeletedAt set)
**And** I see snackbar "Note deleted"
**And** the note disappears from the list

**Given** I click "Cancel"
**When** the confirmation closes
**Then** the note remains unchanged

**Given** I try to delete a note created by another user
**When** I view that note
**Then** I do not see a delete option
**Or** delete is allowed if I'm the account owner (business rule decision)

---

### Story 3.4: Work Order Photos Entity

As a **developer**,
I want **the work order photos table and S3 infrastructure created**,
So that **photos can be uploaded and stored for work orders**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** a `WorkOrderPhotos` table exists with columns:
- Id (UUID, PK)
- WorkOrderId (UUID, FK to WorkOrders, NOT NULL)
- StorageKey (VARCHAR 500, NOT NULL) - S3 object key
- OriginalFileName (VARCHAR 255)
- ContentType (VARCHAR 100)
- FileSizeBytes (BIGINT)
- CreatedByUserId (UUID, FK to Users)
- CreatedAt (timestamp, NOT NULL)

**And** foreign key cascade: when work order is deleted, photos are deleted

**Given** the API is running
**When** I call `POST /api/v1/work-orders/:id/photos/upload-url`
**Then** I receive a presigned S3 upload URL
**And** response includes `{ uploadUrl, storageKey }`
**And** the URL is valid for 15 minutes

**Given** the S3 bucket configuration
**When** I check settings
**Then** the bucket is private (no public access)
**And** objects are encrypted at rest
**And** storage key format is `{accountId}/work-orders/{workOrderId}/{guid}.{ext}`

---

### Story 3.5: Upload Photos to Work Order

As a **property owner**,
I want **to attach photos to a work order**,
So that **I can document the problem visually**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I view the Photos section
**Then** I see:
- Grid of existing photos (if any)
- "Add Photo" button

**Given** I click "Add Photo"
**When** the file picker opens
**Then** I can select one or more image files (jpg, png, heic)
**And** maximum file size is 10MB per image

**Given** I select photos
**When** upload begins
**Then** I see upload progress indicator for each photo
**And** the UI is not blocked (I can continue viewing the page)

**Given** upload completes successfully
**When** the photo is saved
**Then** the API is called to confirm upload and create the record
**And** I see snackbar "Photo added ✓"
**And** the photo thumbnail appears in the grid

**Given** upload fails
**When** an error occurs
**Then** I see error message "Failed to upload [filename]. Try again."
**And** I can retry the upload

**Given** I'm on mobile
**When** I click "Add Photo"
**Then** I can choose to take a new photo with camera
**Or** select from photo library

---

### Story 3.6: View Work Order Photos

As a **property owner**,
I want **to view photos attached to a work order**,
So that **I can see the visual documentation of the issue**.

**Acceptance Criteria:**

**Given** I am on a work order detail page with photos
**When** I view the Photos section
**Then** I see a grid of photo thumbnails
**And** each thumbnail shows a preview of the image

**Given** I click on a photo thumbnail
**When** the viewer opens
**Then** I see the full-size photo in a lightbox/modal
**And** I can zoom in/out
**And** I can pan when zoomed
**And** I see the filename and upload date

**Given** multiple photos exist
**When** I'm in the lightbox
**Then** I can navigate between photos (arrow keys or swipe)
**And** I see "3 of 7" indicator

**Given** I want to close the lightbox
**When** I click outside, press Escape, or click X
**Then** the lightbox closes
**And** I return to the work order detail page

**Given** a work order has no photos
**When** I view the Photos section
**Then** I see "No photos yet"
**And** I see the "Add Photo" button

---

### Story 3.7: Delete Work Order Photos

As a **property owner**,
I want **to delete photos from a work order**,
So that **I can remove incorrect or duplicate images**.

**Acceptance Criteria:**

**Given** I am viewing photos on a work order (grid or lightbox)
**When** I hover over a photo or view it in lightbox
**Then** I see a delete icon/button

**Given** I click delete on a photo
**When** the confirmation appears
**Then** I see "Delete this photo?"
**And** shows thumbnail preview
**And** options [Cancel] [Delete]

**Given** I confirm deletion
**When** the delete completes
**Then** the photo record is deleted from database
**And** the file is deleted from S3
**And** I see snackbar "Photo deleted"
**And** the photo disappears from the grid

**Given** I click "Cancel"
**When** the confirmation closes
**Then** the photo remains unchanged

**Given** I'm in the lightbox viewing photo 3 of 5
**When** I delete that photo
**Then** the lightbox shows the next photo (now photo 3 of 4)
**Or** closes if it was the last photo

---

### Epic 3 Summary

| Story | Title | FRs Covered |
|-------|-------|-------------|
| 3.1 | Polymorphic Notes Entity | FR47 |
| 3.2 | Add Notes to Work Order | FR42 |
| 3.3 | Delete Notes | FR46 |
| 3.4 | Work Order Photos Entity | - |
| 3.5 | Upload Photos to Work Order | FR43 |
| 3.6 | View Work Order Photos | FR44 |
| 3.7 | Delete Work Order Photos | FR45 |

**Stories:** 7 | **FRs Covered:** FR42-FR47 ✅

---

## Epic 4: Work Order-Expense Integration - Stories

**Goal:** Users can link expenses to work orders bidirectionally. Create work orders retroactively from expenses. See linked expenses on work orders. This is tax time context - "$500 for what?"

**FRs Covered:** FR29-FR37

---

### Story 4.1: Expense-WorkOrder Relationship

As a **developer**,
I want **the expense table to have a foreign key to work orders**,
So that **expenses can be linked to work orders**.

**Acceptance Criteria:**

**Given** the database migration runs
**When** I check the database schema
**Then** the `Expenses` table has a new column:
- WorkOrderId (UUID, FK to WorkOrders, nullable)

**And** the foreign key has ON DELETE SET NULL behavior
(if work order is deleted, expense keeps existing but WorkOrderId becomes NULL)

**Given** an expense has a WorkOrderId set
**When** I call `GET /api/v1/expenses/:id`
**Then** the response includes `workOrderId` field
**And** optionally includes `workOrder: { id, description, status }` summary

**Given** I call `GET /api/v1/work-orders/:id/expenses`
**When** expenses are linked to that work order
**Then** I receive a list of expenses with that WorkOrderId
**And** response format is `{ items: [...], totalCount: n }`

**Given** an expense with no work order linked
**When** I retrieve the expense
**Then** `workOrderId` is null

---

### Story 4.2: Link Expense to Work Order

As a **property owner**,
I want **to link an existing expense to a work order**,
So that **I can associate costs with the repair they belong to**.

**Acceptance Criteria:**

**Given** I am viewing or editing an expense
**When** I look at the form/detail
**Then** I see a "Work Order" field (dropdown or search)

**Given** I click the Work Order field
**When** the selector opens
**Then** I see a list of work orders for the same property
**And** work orders are filtered to the expense's property
**And** I can search/filter work orders by description

**Given** I select a work order
**When** I save the expense
**Then** the expense's WorkOrderId is set to that work order
**And** I see snackbar "Expense linked to work order ✓"

**Given** the expense is already linked to a work order
**When** I view the field
**Then** I see the linked work order displayed
**And** I can click to change it or clear the link

**Given** I want to remove the link
**When** I click "Clear" or "Unlink"
**Then** WorkOrderId is set to NULL
**And** the expense is no longer associated with any work order

**Given** the expense is for a different property than the work order
**When** I try to link them
**Then** only work orders for the expense's property are shown
(prevents cross-property linking)

---

### Story 4.3: Link Work Order to Expense

As a **property owner**,
I want **to link an existing expense to a work order from the work order page**,
So that **I can attach receipts and costs I've already recorded**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I view the Linked Expenses section
**Then** I see a "Link Existing Expense" button

**Given** I click "Link Existing Expense"
**When** the selector opens
**Then** I see a list of expenses for this work order's property
**And** expenses are filtered to the same property
**And** I see expenses that are NOT already linked to another work order
**And** I can search expenses by description or date

**Given** I select an expense
**When** the link is created
**Then** the expense's WorkOrderId is updated to this work order
**And** I see snackbar "Expense linked ✓"
**And** the expense appears in the Linked Expenses list

**Given** an expense is already linked to a different work order
**When** I view available expenses
**Then** that expense is not shown (or shown as "Already linked to [Work Order]")

**Given** I want to link multiple expenses
**When** I finish linking one
**Then** I can click "Link Existing Expense" again to add more

---

### Story 4.4: View Linked Work Order on Expense

As a **property owner**,
I want **to see work order context when viewing an expense**,
So that **I understand what repair this expense was for**.

**Acceptance Criteria:**

**Given** I am viewing an expense that is linked to a work order
**When** the expense detail loads
**Then** I see a "Work Order" section showing:
- Work order status badge
- Work order description (truncated if long)
- Link to view full work order

**Given** I click on the work order link
**When** navigation completes
**Then** I am taken to the work order detail page

**Given** I am viewing the expenses list
**When** an expense is linked to a work order
**Then** I see a small work order indicator/icon on that row
**And** hovering shows work order description tooltip
**Or** work order info is shown in a column

**Given** I am viewing an expense with no linked work order
**When** the expense detail loads
**Then** the Work Order section shows "Not linked to a work order"
**And** I see a "Link to Work Order" action

---

### Story 4.5: View Linked Expenses on Work Order

As a **property owner**,
I want **to see all expenses linked to a work order**,
So that **I know the total cost of a repair**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** the page loads
**Then** I see a "Linked Expenses" section showing:
- List of linked expenses
- Each expense shows: date, description, category, amount
- Total of all linked expenses

**Given** the work order has multiple linked expenses
**When** I view the list
**Then** expenses are sorted by date (newest first)
**And** I see the running total at the bottom: "Total: $X,XXX.XX"

**Given** I click on an expense in the list
**When** navigation completes
**Then** I am taken to that expense's detail page

**Given** the work order has no linked expenses
**When** I view the section
**Then** I see "No expenses linked yet"
**And** I see "Link Existing Expense" and "Create Expense" buttons

**Given** the work order has linked expenses
**When** I want to unlink one
**Then** I see an "Unlink" action on each expense row
**And** clicking it removes the link (sets WorkOrderId to NULL)
**And** the expense is NOT deleted, just unlinked

---

### Story 4.6: Create Work Order from Expense

As a **property owner**,
I want **to create a work order retroactively from an expense**,
So that **I can organize past expenses into work orders for better tracking**.

**Acceptance Criteria:**

**Given** I am viewing an expense that has no linked work order
**When** I click "Create Work Order"
**Then** a work order creation form opens (modal or new page)
**And** the property is pre-selected (from the expense)
**And** the description is pre-filled with expense description (editable)

**Given** I fill in work order details
**When** I click "Save"
**Then** a new work order is created
**And** the expense is automatically linked to the new work order
**And** I see snackbar "Work order created and linked ✓"
**And** I return to the expense detail (or work order detail - user preference)

**Given** I click "Cancel" on the work order form
**When** the form closes
**Then** no work order is created
**And** the expense remains unlinked

**Given** I'm in the expense list view
**When** I see an unlinked expense
**Then** I can access "Create Work Order" from a context menu or action button

---

### Story 4.7: Create Expense from Work Order

As a **property owner**,
I want **to create an expense directly from a work order**,
So that **I can quickly log costs as they occur on a job**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I view the Linked Expenses section
**Then** I see a "Create Expense" button

**Given** I click "Create Expense"
**When** the expense form opens
**Then** the property is pre-selected (from the work order)
**And** the work order is pre-linked (WorkOrderId set)
**And** the category is pre-selected if work order has a category
**And** date defaults to today

**Given** I fill in expense details (amount required)
**When** I click "Save"
**Then** the expense is created with the WorkOrderId set
**And** I see snackbar "Expense created ✓"
**And** the expense appears in the Linked Expenses list on the work order

**Given** I click "Cancel"
**When** the form closes
**Then** no expense is created

**Given** I want to create multiple expenses for a work order
**When** I save one expense
**Then** I can click "Create Expense" again to add more

---

### Story 4.8: Work Order Dropdown on Receipt Processing

As a **property owner**,
I want **to link a receipt to a work order while processing it**,
So that **I can connect receipts to repairs in my normal workflow**.

**Acceptance Criteria:**

**Given** I am processing a receipt (creating expense from receipt)
**When** I view the receipt processing form
**Then** I see a "Work Order" dropdown field (optional)

**Given** I have selected a property for the expense
**When** I open the Work Order dropdown
**Then** I see work orders filtered by:
- Same property as selected
- Status is "Reported" or "Assigned" (active work orders only)
- Sorted by most recently created

**Given** no property is selected yet
**When** I view the Work Order dropdown
**Then** it is disabled with hint "Select a property first"
**Or** shows all active work orders grouped by property

**Given** I select a work order from the dropdown
**When** I complete receipt processing and save
**Then** the expense is created with WorkOrderId set to the selected work order

**Given** I don't select a work order
**When** I complete receipt processing
**Then** the expense is created without a work order link (WorkOrderId = NULL)

**Given** I change the selected property
**When** a work order was already selected
**Then** the work order selection is cleared
**And** dropdown reloads with work orders for the new property

---

### Epic 4 Summary

| Story | Title | FRs Covered |
|-------|-------|-------------|
| 4.1 | Expense-WorkOrder Relationship | FR36, FR37 |
| 4.2 | Link Expense to Work Order | FR29 |
| 4.3 | Link Work Order to Expense | FR30 |
| 4.4 | View Linked Work Order on Expense | FR33 |
| 4.5 | View Linked Expenses on Work Order | FR34 |
| 4.6 | Create Work Order from Expense | FR31 |
| 4.7 | Create Expense from Work Order | FR32 |
| 4.8 | Work Order Dropdown on Receipt Processing | FR35 |

**Stories:** 8 | **FRs Covered:** FR29-FR37 ✅

---

## Epic 5: Work Order Output - Stories

**Goal:** Users can generate, preview, and download work order PDFs containing all relevant details. This is Joe the plumber receiving a clear, professional job description.

**FRs Covered:** FR48-FR51

---

### Story 5.1: Work Order PDF Generation Service

As a **developer**,
I want **a backend service that generates work order PDFs**,
So that **users can get professional documents for their work orders**.

**Acceptance Criteria:**

**Given** the PDF generation service exists
**When** I call `POST /api/v1/work-orders/:id/pdf`
**Then** a PDF is generated and returned
**And** the response Content-Type is `application/pdf`

**Given** the PDF is generated
**When** I view the document
**Then** it includes the following sections:

**Header:**
- "Work Order" title
- Work order ID or reference number
- Generated date
- Status badge (Reported/Assigned/Completed)

**Property Information:**
- Property name
- Full property address

**Work Order Details:**
- Description (full text)
- Category (if set)
- Tags (comma-separated list)
- Created date
- Created by (user name)

**Assignment:**
- Assigned to: Vendor name with contact info (phone, email) OR "Self (DIY)"
- If vendor: trade tags listed

**Notes Section:**
- All notes in chronological order
- Each note shows: content, author, timestamp
- If no notes: "No notes recorded"

**Linked Expenses Section:**
- Table of expenses: Date, Description, Category, Amount
- Total row at bottom
- If no expenses: "No expenses linked"

**Footer:**
- "Generated by Property Manager"
- Page numbers if multiple pages

**Given** a work order has photos
**When** the PDF is generated
**Then** photos are NOT included in PDF (keeps file size small)
**And** a note indicates "X photos attached - view online"

**Given** a work order doesn't exist or belongs to another account
**When** I try to generate PDF
**Then** I receive 404 Not Found

---

### Story 5.2: Download Work Order PDF

As a **property owner**,
I want **to download a work order as a PDF**,
So that **I can share it with vendors or keep for my records**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I look at the action buttons
**Then** I see a "Download PDF" button (or icon)

**Given** I click "Download PDF"
**When** the generation starts
**Then** I see a brief loading indicator
**And** the PDF generation completes within 10 seconds (NFR7)

**Given** the PDF is generated
**When** the download completes
**Then** the file downloads to my device
**And** the filename format is: `WorkOrder-[PropertyName]-[Date]-[ID].pdf`
**And** example: `WorkOrder-OakStreetDuplex-2026-01-08-abc123.pdf`

**Given** I'm on mobile
**When** I download the PDF
**Then** the file opens in the device's PDF viewer
**Or** downloads to the device's download location

**Given** PDF generation fails
**When** an error occurs
**Then** I see error message "Failed to generate PDF. Please try again."
**And** I can retry the download

**Given** I want to share the PDF
**When** I download it
**Then** the PDF is self-contained and readable without internet access

---

### Story 5.3: Preview Work Order PDF

As a **property owner**,
I want **to preview the work order PDF before downloading**,
So that **I can verify the content is correct**.

**Acceptance Criteria:**

**Given** I am on a work order detail page
**When** I look at the action buttons
**Then** I see both "Preview PDF" and "Download PDF" options
**Or** a single button with dropdown: "PDF → Preview / Download"

**Given** I click "Preview PDF"
**When** the preview loads
**Then** I see the PDF rendered in a modal/overlay
**And** the preview renders without blocking the UI (NFR8)
**And** I can scroll through the document

**Given** I am viewing the preview
**When** I want to examine details
**Then** I can zoom in/out on the PDF
**And** I can navigate pages if multiple pages exist

**Given** I am viewing the preview
**When** I want to download
**Then** I see a "Download" button in the preview modal
**And** clicking it downloads the same PDF I'm previewing

**Given** I am viewing the preview
**When** I want to print
**Then** I see a "Print" button
**And** clicking it opens the browser print dialog

**Given** I want to close the preview
**When** I click outside the modal, press Escape, or click X
**Then** the preview closes
**And** I return to the work order detail page

**Given** I notice an error in the PDF content
**When** I close the preview
**Then** I can edit the work order and regenerate the PDF

---

### Epic 5 Summary

| Story | Title | FRs Covered |
|-------|-------|-------------|
| 5.1 | Work Order PDF Generation Service | FR48, FR49 |
| 5.2 | Download Work Order PDF | FR50 |
| 5.3 | Preview Work Order PDF | FR51 |

**Stories:** 3 | **FRs Covered:** FR48-FR51 ✅

---

## Summary

### Story Count by Epic

| Epic | Title | Stories |
|------|-------|---------|
| 1 | Vendor Management | 9 |
| 2 | Work Order Tracking | 11 |
| 3 | Work Order Context | 7 |
| 4 | Work Order-Expense Integration | 8 |
| 5 | Work Order Output | 3 |
| **Total** | | **38** |

### FR Coverage

**51/51 FRs covered (100%)**

### Implementation Order

```
Epic 1: Vendor Management (9 stories)
    ↓
Epic 2: Work Order Tracking (11 stories)
    ↓
Epic 3: Work Order Context (7 stories)
    ↓
Epic 4: Work Order-Expense Integration (8 stories)
    ↓
Epic 5: Work Order Output (3 stories)
```

---

_Generated by BMAD Epic & Story Workflow_
_Date: 2026-01-08_
_For: Dave_
_Project: Property Manager Phase 2 - Work Orders & Vendors_
