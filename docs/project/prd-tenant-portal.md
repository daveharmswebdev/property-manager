# Tenant Portal - Product Requirements Document

**Author:** Dave
**Date:** 2026-04-11
**Version:** 1.0
**Parent PRD:** prd.md (Property Manager v2.0)

---

## Executive Summary

The Tenant Portal extends Property Manager with a lightweight, mobile-first experience for tenants to submit maintenance requests and track their status. Landlords receive requests in a single inbox and either convert them to work orders or dismiss them with a reason. This completes the core workflow described in the main PRD: tenant reports issue → landlord manages repair → expense lands on Schedule E.

### What This Is

A scoped addition to the existing Property Manager app. Tenants log in to the same Angular application and see a stripped-down, role-based view. No separate deployment, no separate domain, no additional infrastructure cost.

### What This Is Not

- Not a full tenant management system (lease management, rent collection, messaging come later)
- Not a separate application or portal deployment
- Not accessible to vendors (vendors remain data-only entities)

---

## User Roles (Tenant Portal Scope)

### Property Owner / Co-Manager (Existing)

Invites tenants to properties. Receives maintenance requests in a single inbox across all properties. Converts requests to work orders or dismisses with a reason.

### Tenant (New)

Lives in a property. Invited by the landlord. Can submit maintenance requests with description and photos, view their property (read-only), and see the status of all maintenance requests for their property. Cannot access financial data, other properties, other tenants' properties, or landlord workflows.

**Key constraint:** A tenant is tied to exactly one property. A property can have multiple tenants (roommates, couples, co-habitants — typically 1-3 adults).

---

## Functional Requirements

### Tenant Invitation & Onboarding

- **FR-TP1:** Landlord (account owner or co-manager) can invite a tenant to a specific property via email
- **FR-TP2:** Each tenant is associated with exactly one property (1:1 tenant-to-property)
- **FR-TP3:** A property can have multiple active tenants (roommates, married couples, etc.)
- **FR-TP4:** Tenant accepts invitation, creates account (or links existing), and is immediately scoped to their assigned property
- **FR-TP5:** Invitation flow reuses existing invitation infrastructure (email, acceptance, role assignment)

### Tenant Experience

- **FR-TP6:** Tenant sees their assigned property information (read-only — address, basic details)
- **FR-TP7:** Tenant can submit a maintenance request with a description and optional photos
- **FR-TP8:** Tenant can view all maintenance requests for their property (shared visibility across all tenants on the property)
- **FR-TP9:** Tenant sees a simplified status for each request: Submitted, In Progress, Resolved, or Dismissed (with reason)
- **FR-TP10:** Tenant cannot access financial data (expenses, income, reports), other properties, or landlord workflows
- **FR-TP11:** Tenant is routed to a tenant-specific dashboard upon login (role-based routing)

### Landlord Experience

- **FR-TP12:** Landlord sees a single inbox of incoming maintenance requests across all properties
- **FR-TP13:** Landlord can convert a maintenance request into a work order
- **FR-TP14:** Conversion pre-populates the work order with the request's description and photos
- **FR-TP15:** Landlord can dismiss a maintenance request with a required reason
- **FR-TP16:** Tenant sees updated status when their request is converted (In Progress) or dismissed (Dismissed + reason)
- **FR-TP17:** When the linked work order is completed, the maintenance request status updates to Resolved

### Maintenance Request Entity

- **FR-TP18:** Maintenance Request is a separate entity from Work Order
- **FR-TP19:** Maintenance Request has: description, status, dismissal reason (nullable), photos, timestamps, tenant reference, property reference, and optional work order reference
- **FR-TP20:** Maintenance Request statuses: Submitted → In Progress → Resolved, or Submitted → Dismissed
- **FR-TP21:** Photos on maintenance requests use existing S3 presigned URL infrastructure

---

## Non-Functional Requirements

### Security

- **NFR-TP1:** Tenant role cannot access any API endpoint outside their scoped property and maintenance requests
- **NFR-TP2:** Tenant cannot retrieve financial data (expenses, income, reports) via API — enforced at authorization level, not just UI
- **NFR-TP3:** Tenant API authorization enforced via role-based checks in addition to existing AccountId-based multi-tenancy filters
- **NFR-TP4:** Tenant invitation tokens follow existing security patterns (expiration, single-use)

### Performance

- **NFR-TP5:** Tenant dashboard loads in under 3 seconds on mobile networks
- **NFR-TP6:** Maintenance request list supports pagination for properties with high request volume

### Responsive Design

- **NFR-TP7:** Mobile-first design for all tenant views (primary use case: submitting requests from phone)
- **NFR-TP8:** Photo capture works on iOS Safari and Android Chrome (camera integration)

---

## User Flows

### Flow 1: Landlord Invites Tenant

1. Landlord navigates to property detail page
2. Landlord invites tenant by email, associating them with that property
3. Tenant receives email with invitation link
4. Tenant clicks link → registration page (or login if existing account)
5. Tenant is associated with the property with Tenant role
6. Tenant lands on tenant dashboard

### Flow 2: Tenant Submits Maintenance Request

1. Tenant logs in → tenant dashboard (their property info + request list)
2. Tenant taps "Submit Request"
3. Fills in description, optionally attaches photos from camera or gallery
4. Submits → status is "Submitted"
5. Request appears in the shared request list for all tenants on the property
6. Request appears in the landlord's maintenance request inbox

### Flow 3: Landlord Converts Request to Work Order

1. Landlord opens maintenance request inbox (single view, all properties)
2. Reviews request description and photos
3. Clicks "Convert to Work Order"
4. Work order form opens, pre-populated with description and photos from the request
5. Landlord completes work order creation (assigns vendor, etc.)
6. Maintenance request status updates to "In Progress"
7. Tenant sees "In Progress" on their dashboard

### Flow 4: Landlord Dismisses Request

1. Landlord opens maintenance request inbox
2. Reviews request
3. Clicks "Dismiss"
4. Enters a required reason for dismissal
5. Maintenance request status updates to "Dismissed"
6. Tenant sees "Dismissed" with the landlord's reason

### Flow 5: Request Resolution

1. Landlord completes the linked work order through normal workflow
2. Maintenance request status automatically updates to "Resolved"
3. Tenant sees "Resolved" on their dashboard

---

## Data Model Overview

### New Entity: MaintenanceRequest

| Field | Type | Notes |
|-------|------|-------|
| Id | Guid | PK |
| Description | string | Required, submitted by tenant |
| Status | enum | Submitted, InProgress, Resolved, Dismissed |
| DismissalReason | string? | Required when status is Dismissed |
| PropertyId | Guid | FK → Property |
| SubmittedByUserId | Guid | FK → User (tenant who submitted) |
| WorkOrderId | Guid? | FK → WorkOrder (linked when converted) |
| AccountId | Guid | Multi-tenancy (FK → Account) |
| CreatedAt | DateTime | Audit |
| UpdatedAt | DateTime | Audit |

### New Entity: MaintenanceRequestPhoto

Reuses existing photo/S3 infrastructure pattern (presigned URLs, thumbnails).

| Field | Type | Notes |
|-------|------|-------|
| Id | Guid | PK |
| MaintenanceRequestId | Guid | FK → MaintenanceRequest |
| S3Key | string | S3 object key |
| FileName | string | Original filename |
| ContentType | string | MIME type |
| FileSize | long | Bytes |
| DisplayOrder | int | Photo ordering |

### Modified: User/Role

- New "Tenant" role added to ASP.NET Core Identity roles
- Tenant-to-Property association: a user with Tenant role is linked to exactly one property

### Modified: Property

- Navigation property to tenants (one-to-many)

### Relationships

```
Property ──── 1:N ──── Tenants (Users with Tenant role)
Property ──── 1:N ──── MaintenanceRequests
Tenant ──── N:1 ──── Property
MaintenanceRequest ──── 0..1:1 ──── WorkOrder
MaintenanceRequest ──── 1:N ──── MaintenanceRequestPhotos
```

---

## Success Criteria

- A landlord can invite a tenant to a property, and the tenant can log in and see only their property
- A tenant can submit a maintenance request with photos from their phone
- The landlord sees the request in their inbox and converts it to a work order in under 30 seconds
- The tenant sees status updates as the request progresses
- No tenant can access any financial data or landlord workflows, verified by API-level authorization tests

---

## Out of Scope (Phase 1)

- Lease management (lease terms, renewal dates, rent amounts)
- Rent payment collection (Stripe for tenants)
- Landlord-tenant messaging
- Tenant payment history
- Push notifications / real-time updates for tenants
- Tenant self-registration (must be invited by landlord)
- Vendor portal

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Role-based routing complexity in single Angular app | Leverage existing RBAC infrastructure from Epic 19; use Angular route guards |
| Tenant authorization gaps (data leakage) | API-level role checks + integration tests verifying tenant cannot access landlord endpoints |
| Photo upload on mobile browsers | Reuse existing S3 presigned URL infrastructure; test on iOS Safari and Android Chrome |
| Maintenance request → work order status sync | Clear state machine; work order completion triggers request status update |
| Invitation flow differences from co-manager | Tenant invitation adds property association — extend existing invitation infrastructure |

---

## Appendix: Relationship to Main PRD

This document supersedes the following sections in `prd.md`:
- FR73–FR77 (Tenant Portal — Next Phase — Minimal)
- NFR28 (Tenant role authorization)

Key changes from original PRD:
- **FR75 removed:** Maintenance requests do NOT automatically create work orders. The landlord explicitly converts or dismisses.
- **Invitation flow added:** Original PRD did not specify how tenants enter the system.
- **Multiple tenants per property:** Original PRD did not address this.
- **Shared request visibility:** All tenants on a property see all requests for that property.
- **Dismissal with reason:** Landlord can dismiss requests, not just convert them.
