# Tenant Portal - Epic Breakdown

**Author:** Dave
**Date:** 2026-04-11
**Version:** 1.0
**Source PRD:** prd-tenant-portal.md

---

## Overview

This document breaks down the Tenant Portal PRD into implementable stories with BDD acceptance criteria. The tenant portal is delivered as a single epic (Epic 20) with ordered stories that build on each other.

**Dependencies:** Epic 19 (Multi-User Account with RBAC) must be complete. The tenant portal extends the invitation infrastructure, role system, and permission framework established there.

---

## Epic Summary

| Epic | Name | Stories | Description |
|------|------|---------|-------------|
| 20 | Tenant Portal | 11 | Tenant maintenance requests, landlord inbox, role-based routing |

## Functional Requirements Coverage

| FR | Description | Story |
|----|-------------|-------|
| FR-TP1 | Landlord invites tenant to property via email | 20.2 |
| FR-TP2 | Tenant associated with exactly one property | 20.1 |
| FR-TP3 | Property can have multiple tenants | 20.1 |
| FR-TP4 | Tenant accepts invitation, scoped to property | 20.2 |
| FR-TP5 | Invitation reuses existing infrastructure | 20.2 |
| FR-TP6 | Tenant sees property info (read-only) | 20.5 |
| FR-TP7 | Tenant submits request with description + photos | 20.6 |
| FR-TP8 | Tenant views all requests for their property (shared) | 20.5 |
| FR-TP9 | Tenant sees simplified status | 20.5 |
| FR-TP10 | Tenant cannot access financial data or landlord workflows | 20.1, 20.11 |
| FR-TP11 | Tenant routed to tenant dashboard on login | 20.5 |
| FR-TP12 | Landlord sees single inbox across all properties | 20.7 |
| FR-TP13 | Landlord converts request to work order | 20.8 |
| FR-TP14 | Conversion pre-populates work order | 20.8 |
| FR-TP15 | Landlord dismisses request with reason | 20.9 |
| FR-TP16 | Tenant sees updated status | 20.8, 20.9 |
| FR-TP17 | Work order completion resolves request | 20.10 |
| FR-TP18 | MaintenanceRequest is separate from WorkOrder | 20.3 |
| FR-TP19 | MaintenanceRequest entity fields | 20.3 |
| FR-TP20 | Status state machine | 20.3 |
| FR-TP21 | Photos use S3 presigned URL infrastructure | 20.4 |

| NFR | Description | Story |
|-----|-------------|-------|
| NFR-TP1 | Tenant scoped to property + requests only | 20.11 |
| NFR-TP2 | Tenant cannot access financials via API | 20.11 |
| NFR-TP3 | Role-based authorization checks | 20.1, 20.11 |
| NFR-TP4 | Invitation token security | 20.2 |
| NFR-TP5 | Tenant dashboard < 3s on mobile | 20.5 |
| NFR-TP6 | Paginated request list | 20.3 |
| NFR-TP7 | Mobile-first tenant views | 20.5, 20.6 |
| NFR-TP8 | Photo capture iOS Safari + Android Chrome | 20.6 |

---

## Epic 20: Tenant Portal

### Objective

Enable tenants to submit maintenance requests through a mobile-first experience in the existing app, and give landlords a single inbox to triage those requests into work orders or dismiss them.

### Dependency Chain

```
20.1 (Tenant Role) ──→ 20.2 (Invitation)
                   ──→ 20.3 (Entity & API) ──→ 20.4 (Photos)
                                            ──→ 20.7 (Landlord Inbox) ──→ 20.8 (Convert) ──→ 20.10 (Resolution)
                                                                       ──→ 20.9 (Dismiss)
20.1 + 20.3 ──→ 20.5 (Tenant Dashboard) ──→ 20.6 (Submit Request UI)
20.5 ──→ 20.11 (Authorization Lockdown)
```

---

### Story 20.1: Tenant Role & Property Association

**User Story:** As a system administrator, I want a Tenant role with property-level scoping, so that tenants can be associated with a specific property and restricted from landlord workflows.

**Source:** FR-TP2, FR-TP3, FR-TP10, NFR-TP3

**Acceptance Criteria:**

- **AC-20.1.1:** Given the application roles, When the system starts, Then a "Tenant" role exists alongside "Owner" and "Contributor"

- **AC-20.1.2:** Given an ApplicationUser with the Tenant role, When querying the user, Then a PropertyId field is present linking the tenant to exactly one property

- **AC-20.1.3:** Given a property, When querying its tenants, Then multiple users with the Tenant role can be associated with that property

- **AC-20.1.4:** Given a user with the Tenant role, When the user attempts to access any landlord endpoint (properties list, expenses, income, reports, vendors, work orders), Then the API returns 403 Forbidden

- **AC-20.1.5:** Given a Tenant permission set, When permissions are evaluated, Then the Tenant role has only: MaintenanceRequests.Create, MaintenanceRequests.ViewOwn, Property.ViewAssigned

- **AC-20.1.6:** Given the database, When the migration runs, Then a nullable PropertyId column is added to the user record (nullable because Owner/Contributor users don't have one)

**Technical Notes:**
- Add `PropertyId` (nullable Guid) to `ApplicationUser`
- Add Tenant role to `RolePermissions.cs` with minimal permission set
- EF Core migration for PropertyId FK on AspNetUsers
- Add PropertyId to JWT claims for tenant users
- Seed Tenant role in identity setup

---

### Story 20.2: Tenant Invitation Flow

**User Story:** As a landlord, I want to invite a tenant to a specific property via email, so that the tenant can create an account and immediately access their property.

**Source:** FR-TP1, FR-TP4, FR-TP5, NFR-TP4

**Acceptance Criteria:**

- **AC-20.2.1:** Given a landlord on the property detail page, When they invite a tenant by email, Then an invitation is created with role "Tenant" and the associated PropertyId

- **AC-20.2.2:** Given an invitation with role "Tenant" and a PropertyId, When the tenant accepts the invitation, Then their account is created with the Tenant role and PropertyId set to the invited property

- **AC-20.2.3:** Given an existing user who is not yet a tenant, When they accept a tenant invitation, Then their role and PropertyId are updated accordingly

- **AC-20.2.4:** Given a tenant invitation, When the invitation email is sent, Then the email includes the property address so the tenant knows what they're accepting

- **AC-20.2.5:** Given an invitation, When the invitation is created, Then the PropertyId is validated to ensure it belongs to the landlord's account

- **AC-20.2.6:** Given an expired or already-accepted tenant invitation, When a user tries to accept it, Then the system returns an appropriate error

**Technical Notes:**
- Extend `Invitation` entity with nullable `PropertyId`
- Extend `CreateInvitationCommand` to accept PropertyId when role is Tenant
- Extend `AcceptInvitationCommand` to set PropertyId on the new user when role is Tenant
- Validate PropertyId is required when invitation role is Tenant
- Add PropertyId to invitation email template context
- Frontend: add "Invite Tenant" action on property detail page (reuse invitation dialog with property pre-selected)

---

### Story 20.3: MaintenanceRequest Entity & API

**User Story:** As a developer, I want the MaintenanceRequest domain entity and CRUD API, so that tenants can submit requests and landlords can manage them.

**Source:** FR-TP18, FR-TP19, FR-TP20, NFR-TP6

**Acceptance Criteria:**

- **AC-20.3.1:** Given the domain layer, When the MaintenanceRequest entity is defined, Then it has: Id, Description, Status, DismissalReason (nullable), PropertyId, SubmittedByUserId, WorkOrderId (nullable), AccountId, CreatedAt, UpdatedAt

- **AC-20.3.2:** Given the MaintenanceRequest status enum, When defined, Then valid statuses are: Submitted, InProgress, Resolved, Dismissed

- **AC-20.3.3:** Given valid status transitions, When a status change is attempted, Then only these transitions are allowed: Submitted → InProgress, Submitted → Dismissed, InProgress → Resolved

- **AC-20.3.4:** Given a tenant user, When they POST to the create endpoint with a description, Then a MaintenanceRequest is created with status Submitted, the tenant's PropertyId, and the tenant's UserId

- **AC-20.3.5:** Given a tenant user, When they GET maintenance requests, Then they receive all requests for their property (shared visibility), paginated

- **AC-20.3.6:** Given a landlord user, When they GET maintenance requests, Then they receive requests across all their properties, paginated, with property info included

- **AC-20.3.7:** Given a landlord user, When they GET a single maintenance request, Then they see the full detail including description, status, submitter info, property info, and dismissal reason if applicable

- **AC-20.3.8:** Given the EF Core configuration, When the migration runs, Then the MaintenanceRequests table is created with proper FKs, indexes, and AccountId for multi-tenancy

- **AC-20.3.9:** Given the MaintenanceRequest entity, When queried, Then global query filters apply for AccountId and soft delete (DeletedAt)

**Technical Notes:**
- Domain: `MaintenanceRequest.cs` entity, `MaintenanceRequestStatus` enum
- Application: `CreateMaintenanceRequest.cs`, `GetMaintenanceRequests.cs`, `GetMaintenanceRequestById.cs`
- Validators for create (description required, max length)
- API: `MaintenanceRequestsController.cs`
- Tenant endpoint returns requests filtered by PropertyId; landlord endpoint returns all
- EF Core config: `MaintenanceRequestConfiguration.cs` with indexes on PropertyId, AccountId, Status

---

### Story 20.4: Maintenance Request Photos

**User Story:** As a tenant, I want to attach photos to my maintenance request, so that the landlord can see what's wrong before visiting.

**Source:** FR-TP21

**Acceptance Criteria:**

- **AC-20.4.1:** Given a maintenance request, When a tenant requests a presigned upload URL, Then the system returns an S3 presigned URL scoped to maintenance request photos

- **AC-20.4.2:** Given a photo uploaded to S3, When the tenant confirms the upload, Then a MaintenanceRequestPhoto record is created linking the photo to the request

- **AC-20.4.3:** Given a maintenance request with photos, When anyone views the request, Then presigned download URLs are returned for each photo

- **AC-20.4.4:** Given the MaintenanceRequestPhoto entity, Then it has: Id, MaintenanceRequestId, S3Key, FileName, ContentType, FileSize, DisplayOrder

- **AC-20.4.5:** Given a maintenance request, When photos are queried, Then they are ordered by DisplayOrder

**Technical Notes:**
- Domain: `MaintenanceRequestPhoto.cs` entity
- Reuse existing `IStorageService` and presigned URL patterns from receipt/work order photos
- Application: `GetMaintenanceRequestPhotoUploadUrl.cs`, `ConfirmMaintenanceRequestPhotoUpload.cs`
- Include photos in `GetMaintenanceRequestById` response
- S3 key pattern: `accounts/{accountId}/maintenance-requests/{requestId}/photos/{photoId}`

---

### Story 20.5: Tenant Dashboard & Role-Based Routing

**User Story:** As a tenant, I want to log in and see a dashboard showing my property and maintenance requests, so that I can manage my requests without seeing landlord workflows.

**Source:** FR-TP6, FR-TP8, FR-TP9, FR-TP11, NFR-TP5, NFR-TP7

**Acceptance Criteria:**

- **AC-20.5.1:** Given a user with the Tenant role, When they log in, Then they are routed to the tenant dashboard (not the landlord dashboard)

- **AC-20.5.2:** Given a tenant on their dashboard, When the page loads, Then they see their property information (address, name) in read-only format

- **AC-20.5.3:** Given a tenant on their dashboard, When the page loads, Then they see a list of all maintenance requests for their property (submitted by any tenant on that property)

- **AC-20.5.4:** Given a maintenance request in the list, When the tenant views it, Then they see the description, status (Submitted / In Progress / Resolved / Dismissed), and dismissal reason if dismissed

- **AC-20.5.5:** Given a tenant, When they navigate the app, Then the navigation shows only tenant-relevant items (dashboard, submit request) — no properties list, expenses, income, reports, vendors, or work orders

- **AC-20.5.6:** Given a tenant, When they manually navigate to a landlord route (e.g., /expenses), Then the Angular route guard redirects them to the tenant dashboard

- **AC-20.5.7:** Given a landlord user, When they log in, Then they are routed to the existing landlord dashboard as before (no regression)

- **AC-20.5.8:** Given the tenant dashboard, When viewed on a mobile device, Then the layout is mobile-first and usable on small screens

**Technical Notes:**
- Frontend: `features/tenant-dashboard/` with components, store, routes
- Angular route guard: `tenantGuard` checks role, redirects non-tenants; `landlordGuard` redirects tenants
- `app.routes.ts`: role-based route splitting
- Tenant store fetches property detail + maintenance requests via API
- Navigation component conditionally renders items based on role from auth service
- Mobile-first SCSS with responsive breakpoints

---

### Story 20.6: Submit Maintenance Request (Tenant UI)

**User Story:** As a tenant, I want to submit a maintenance request with a description and photos from my phone, so that my landlord knows about the issue.

**Source:** FR-TP7, NFR-TP7, NFR-TP8

**Acceptance Criteria:**

- **AC-20.6.1:** Given a tenant on the dashboard, When they tap "Submit Request", Then a form appears with a description field and photo upload area

- **AC-20.6.2:** Given the submit form, When the tenant enters a description and submits, Then a maintenance request is created with status "Submitted"

- **AC-20.6.3:** Given the submit form, When the tenant attaches photos, Then photos are uploaded to S3 via presigned URLs and linked to the request

- **AC-20.6.4:** Given a successful submission, When the request is created, Then the tenant sees a success notification and the new request appears in their list

- **AC-20.6.5:** Given the submit form on a mobile device, When the tenant taps the photo upload, Then they can choose from camera or photo gallery (native browser behavior)

- **AC-20.6.6:** Given the submit form, When the description is empty, Then validation prevents submission with an error message

- **AC-20.6.7:** Given the submit form, When viewed on mobile, Then the form is mobile-optimized (full-width inputs, large tap targets)

**Technical Notes:**
- Frontend: `features/tenant-dashboard/components/submit-request/`
- Reuse photo upload patterns from work order photo upload
- MatFormField for description (textarea), photo upload component
- Mobile-first: large touch targets, full-width layout
- Test on iOS Safari and Android Chrome via Playwright MCP

---

### Story 20.7: Landlord Maintenance Request Inbox

**User Story:** As a landlord, I want a single inbox showing all maintenance requests across my properties, so that I can triage them efficiently.

**Source:** FR-TP12

**Acceptance Criteria:**

- **AC-20.7.1:** Given a landlord user, When they navigate to the maintenance request inbox, Then they see all maintenance requests across all properties in their account

- **AC-20.7.2:** Given the inbox, When requests are listed, Then each request shows: property name/address, description (truncated), submitter name, status, and submission date

- **AC-20.7.3:** Given the inbox, When a landlord clicks a request, Then they see the full request detail including description, photos, status, submitter info, and property info

- **AC-20.7.4:** Given the inbox, When there are many requests, Then the list is paginated

- **AC-20.7.5:** Given the inbox, When requests exist in different statuses, Then requests are visually distinguishable by status (e.g., badges or color coding)

- **AC-20.7.6:** Given the landlord navigation, When the tenant portal is active, Then a "Maintenance Requests" item appears in the landlord navigation

**Technical Notes:**
- Frontend: `features/maintenance-requests/` with inbox component, detail component, store
- New nav item for landlords
- Uses the landlord variant of the GET maintenance requests API (all properties)
- Status badges using Angular Material chips or similar
- Paginated list with property grouping or filtering option

---

### Story 20.8: Convert Request to Work Order

**User Story:** As a landlord, I want to convert a maintenance request into a work order, so that I can track the repair through my existing workflow.

**Source:** FR-TP13, FR-TP14, FR-TP16

**Acceptance Criteria:**

- **AC-20.8.1:** Given a maintenance request with status "Submitted", When the landlord clicks "Convert to Work Order", Then the work order creation form opens

- **AC-20.8.2:** Given the work order creation form opened from a conversion, When the form loads, Then the description is pre-populated from the maintenance request

- **AC-20.8.3:** Given the work order creation form opened from a conversion, When the form loads, Then the property is pre-selected from the maintenance request's property

- **AC-20.8.4:** Given a maintenance request with photos, When converting to a work order, Then the photos are copied/linked to the new work order

- **AC-20.8.5:** Given a successful work order creation from conversion, When the work order is saved, Then the maintenance request's WorkOrderId is set and status changes to "InProgress"

- **AC-20.8.6:** Given a maintenance request that has been converted, When the tenant views it, Then the status shows "In Progress"

- **AC-20.8.7:** Given a maintenance request with status other than "Submitted", When the landlord tries to convert it, Then the action is not available

**Technical Notes:**
- Application: `ConvertMaintenanceRequestToWorkOrder.cs` command — creates work order, links it, updates status
- Reuse existing `CreateWorkOrder` logic, extend to accept source maintenance request
- Copy photos from maintenance request S3 path to work order S3 path, or reference same S3 keys
- Frontend: "Convert to Work Order" button on request detail, navigates to pre-populated work order form
- Status transition validation in domain entity

---

### Story 20.9: Dismiss Maintenance Request

**User Story:** As a landlord, I want to dismiss a maintenance request with a reason, so that the tenant understands why their request won't be addressed.

**Source:** FR-TP15, FR-TP16

**Acceptance Criteria:**

- **AC-20.9.1:** Given a maintenance request with status "Submitted", When the landlord clicks "Dismiss", Then a dialog appears requiring a dismissal reason

- **AC-20.9.2:** Given the dismissal dialog, When the landlord enters a reason and confirms, Then the maintenance request status changes to "Dismissed" and the reason is stored

- **AC-20.9.3:** Given the dismissal dialog, When the reason field is empty, Then the confirm action is disabled

- **AC-20.9.4:** Given a dismissed maintenance request, When the tenant views it, Then the status shows "Dismissed" and the landlord's reason is displayed

- **AC-20.9.5:** Given a maintenance request with status other than "Submitted", When the landlord tries to dismiss it, Then the action is not available

**Technical Notes:**
- Application: `DismissMaintenanceRequest.cs` command — sets status to Dismissed, stores reason
- Validator: DismissalReason required, max length
- Frontend: dismiss button on request detail, opens confirmation dialog with reason textarea
- Status transition validation in domain entity (same as 20.8)

---

### Story 20.10: Request Resolution Sync

**User Story:** As a tenant, I want my maintenance request to show "Resolved" when the landlord completes the associated work order, so that I know the issue has been fixed.

**Source:** FR-TP17

**Acceptance Criteria:**

- **AC-20.10.1:** Given a work order linked to a maintenance request, When the work order status changes to "Completed", Then the maintenance request status automatically changes to "Resolved"

- **AC-20.10.2:** Given a work order linked to a maintenance request, When the work order status changes to something other than "Completed" (e.g., Assigned), Then the maintenance request status remains "InProgress"

- **AC-20.10.3:** Given a maintenance request that is "Resolved", When the tenant views it, Then the status shows "Resolved"

- **AC-20.10.4:** Given a work order that is NOT linked to a maintenance request, When the work order is completed, Then no maintenance request status change occurs (backward compatible)

**Technical Notes:**
- Modify existing `UpdateWorkOrderStatus` handler to check for linked maintenance request
- When work order → Completed and a linked MaintenanceRequest exists, update request status to Resolved
- Keep it simple: synchronous update in the same transaction, not event-driven
- Unit tests for both linked and unlinked work order completion scenarios

---

### Story 20.11: Tenant Authorization Lockdown

**User Story:** As a system owner, I want integration tests proving that tenants cannot access landlord data, so that I have confidence in the security boundary.

**Source:** NFR-TP1, NFR-TP2, NFR-TP3

**Acceptance Criteria:**

- **AC-20.11.1:** Given a user with the Tenant role, When they call GET /api/v1/properties, Then the API returns 403 Forbidden

- **AC-20.11.2:** Given a user with the Tenant role, When they call any expense endpoint (GET, POST, PUT, DELETE), Then the API returns 403 Forbidden

- **AC-20.11.3:** Given a user with the Tenant role, When they call any income endpoint, Then the API returns 403 Forbidden

- **AC-20.11.4:** Given a user with the Tenant role, When they call any report endpoint, Then the API returns 403 Forbidden

- **AC-20.11.5:** Given a user with the Tenant role, When they call any vendor endpoint, Then the API returns 403 Forbidden

- **AC-20.11.6:** Given a user with the Tenant role, When they call any work order endpoint directly, Then the API returns 403 Forbidden

- **AC-20.11.7:** Given a user with the Tenant role, When they call GET /api/v1/maintenance-requests, Then they receive only requests for their property (not other properties in the account)

- **AC-20.11.8:** Given a user with the Tenant role, When they call the convert-to-work-order or dismiss endpoints, Then the API returns 403 Forbidden (these are landlord-only actions)

- **AC-20.11.9:** Given a user with the Tenant role on Property A, When they try to create a maintenance request for Property B, Then the API returns 403 Forbidden

**Technical Notes:**
- Integration tests using WebApplicationFactory
- Create test tenant user, authenticate, attempt all landlord endpoints
- Verify property-scoping: tenant can only see/create for their assigned property
- These tests serve as a security regression suite — run in CI on every PR
