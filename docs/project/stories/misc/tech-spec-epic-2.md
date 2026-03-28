# Epic Technical Specification: Property Management

Date: 2025-12-02
Author: Dave
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 establishes the foundation for property portfolio management within the Property Manager application. This epic transforms the deployed authentication shell (from Epic 1) into a functional property tracking system where users can create, view, edit, and delete their rental properties. The dashboard becomes the central hub displaying all properties with their respective expense totals, enabling users to quickly answer "which properties do I own and how much is each costing me?"

This epic directly supports the PRD's core value proposition of "From Shoebox to Schedule E" by providing the organizational structure (properties) that expenses, income, and receipts will attach to in subsequent epics. Without properties, there's nothing to track expenses against.

## Objectives and Scope

### In-Scope

- **FR7:** Create new properties with name and address fields (street, city, state, ZIP)
- **FR8:** View paginated/scrollable list of all properties owned by the user
- **FR9:** Edit existing property details (name and address components)
- **FR10:** Soft-delete properties with cascade to related expenses/income (with confirmation dialog)
- **FR11:** View detailed property page showing summary, placeholders for expenses/income
- **FR41:** Dashboard displays property cards/list with per-property expense totals (placeholder $0 until Epic 3)
- **FR42:** Click-through navigation from property card to property detail page
- Multi-tenant data isolation via AccountId filtering (all queries scoped to user's account)
- Responsive design: list view on desktop, card stack on mobile

### Out-of-Scope

- Expense/income data entry (Epic 3, Epic 4)
- Receipt attachment (Epic 5)
- Tax report generation (Epic 6)
- Property images/photos
- Property sharing between accounts
- Bulk property import
- Property archiving (separate from soft delete)
- Tenant/lease management

## System Architecture Alignment

This epic aligns with the established Clean Architecture and follows patterns defined in the Architecture document:

**Backend Layers Involved:**
- `PropertyManager.Domain/Entities/Property.cs` - Property entity with audit fields
- `PropertyManager.Application/Properties/` - CQRS commands/queries (CreateProperty, GetProperty, GetAllProperties, UpdateProperty, DeleteProperty)
- `PropertyManager.Infrastructure/Persistence/` - EF Core repository and configurations
- `PropertyManager.Api/Controllers/PropertiesController.cs` - RESTful endpoints

**Frontend Structure:**
- `features/properties/` - Property components and routes
- `features/dashboard/` - Dashboard with property list integration
- `shared/components/` - PropertyRowComponent, StatsBarComponent

**Key Constraints:**
- All property data filtered by AccountId (global query filter in EF Core)
- Soft deletes via DeletedAt timestamp (global query filter excludes deleted records)
- GUIDs for all primary keys
- Standard API response formats: `{ items, totalCount }` for lists

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `CreatePropertyCommand` | Create new property | PropertyDto (name, address) | Guid (new property ID) |
| `GetAllPropertiesQuery` | List all properties for account | AccountId, Year (optional) | List<PropertySummaryDto> |
| `GetPropertyByIdQuery` | Get single property details | PropertyId | PropertyDetailDto |
| `UpdatePropertyCommand` | Update property fields | PropertyId, PropertyDto | void (204 No Content) |
| `DeletePropertyCommand` | Soft-delete property | PropertyId | void (204 No Content) |
| `PropertiesController` | REST API endpoints | HTTP requests | JSON responses |
| `PropertyStore` (Angular) | Frontend state management | API responses | Signals for UI binding |

### Data Models and Contracts

**Property Entity (Domain):**
```csharp
public class Property
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Name { get; set; }        // e.g., "Oak Street Duplex"
    public string Street { get; set; }
    public string City { get; set; }
    public string State { get; set; }       // 2-letter code
    public string ZipCode { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; } // Soft delete

    // Navigation
    public Account Account { get; set; }
    public ICollection<Expense> Expenses { get; set; }
    public ICollection<Income> IncomeEntries { get; set; }
}
```

**API DTOs:**
```typescript
// Request: Create/Update Property
interface CreatePropertyRequest {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

// Response: Property Summary (for list)
interface PropertySummaryDto {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  expenseTotal: number;  // YTD, $0 until Epic 3
  incomeTotal: number;   // YTD, $0 until Epic 4
}

// Response: Property Detail
interface PropertyDetailDto extends PropertySummaryDto {
  createdAt: string;
  updatedAt: string;
  recentExpenses: ExpenseSummaryDto[];  // Empty until Epic 3
  recentIncome: IncomeSummaryDto[];     // Empty until Epic 4
}
```

### APIs and Interfaces

| Method | Endpoint | Request | Response | Status |
|--------|----------|---------|----------|--------|
| POST | `/api/v1/properties` | `CreatePropertyRequest` | `{ id: "guid" }` | 201 Created |
| GET | `/api/v1/properties` | Query: `?year=2025` | `{ items: PropertySummaryDto[], totalCount: number }` | 200 OK |
| GET | `/api/v1/properties/{id}` | - | `PropertyDetailDto` | 200 OK / 404 |
| PUT | `/api/v1/properties/{id}` | `CreatePropertyRequest` | - | 204 No Content |
| DELETE | `/api/v1/properties/{id}` | - | - | 204 No Content |

**Error Responses (RFC 7807):**
- 400 Bad Request: Validation errors (missing name, invalid state code)
- 401 Unauthorized: No valid JWT
- 404 Not Found: Property doesn't exist or belongs to different account
- 500 Internal Server Error: Unexpected errors

### Workflows and Sequencing

**Create Property Flow:**
```
User clicks "Add Property" → Navigate to /properties/new
    → Fill form (name, street, city, state, zip)
    → Click "Save"
    → POST /api/v1/properties
    → Backend validates, creates with AccountId from JWT
    → Returns 201 with { id }
    → Frontend shows snackbar "Property added ✓"
    → Navigate to /dashboard
    → Property appears in list
```

**View Dashboard Flow:**
```
User logs in → Redirect to /dashboard
    → GET /api/v1/properties?year=2025
    → Backend returns properties with $0 totals (no expenses yet)
    → Frontend renders StatsBarComponent (all $0)
    → Frontend renders PropertyRowComponent for each property
    → User sees all 14 properties with name, city/state, $0 total
```

**Delete Property Flow:**
```
User on property detail → Click "Delete"
    → Modal: "Delete [Name]? This will remove all expenses and income."
    → User confirms → DELETE /api/v1/properties/{id}
    → Backend sets DeletedAt on property
    → Backend cascade sets DeletedAt on related Expenses/Income
    → Returns 204
    → Frontend shows snackbar "Property deleted"
    → Navigate to /dashboard
    → Property no longer in list
```

## Non-Functional Requirements

### Performance

- **Page load:** Dashboard with 14 properties loads in < 1 second
- **API response:** Property list query returns in < 200ms for typical dataset
- **No pagination needed:** 14 properties fit in single list view (per PRD target scale)
- **Indexed queries:** AccountId column indexed for tenant filtering

### Security

- **Authentication required:** All `/api/v1/properties/*` endpoints require valid JWT
- **Tenant isolation:** Global query filter ensures users only see their AccountId data
- **Input validation:** FluentValidation on all commands (name required, state 2-char, zip 5-digit)
- **HTTPS:** All traffic encrypted in transit
- **No sensitive data:** Property addresses are not PII for this application context

### Reliability/Availability

- **Soft deletes:** DeletedAt pattern allows potential recovery
- **Cascade behavior:** Deleting property marks related expenses/income as deleted (not orphaned)
- **Database constraints:** Foreign key relationships enforce referential integrity
- **Graceful errors:** 404 for missing properties, not 500

### Observability

- **Logging:** All CRUD operations logged with PropertyId, AccountId, UserId
- **Structured logs:** Serilog JSON format with traceId correlation
- **Key signals:**
  - `property.created` - New property added
  - `property.updated` - Property modified
  - `property.deleted` - Property soft-deleted
  - `property.notfound` - 404 returned (potential security probe)

## Dependencies and Integrations

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Microsoft.EntityFrameworkCore | 10.x | ORM and database access |
| FluentValidation | 11.x | Request validation |
| MediatR | 12.x | CQRS pattern implementation |
| Serilog | 4.x | Structured logging |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @angular/material | 20.x | UI components (mat-list, mat-form-field, mat-button) |
| @ngrx/signals | latest | State management for property store |

### External Integrations

- None for this epic (S3 integration comes in Epic 5)

### Internal Dependencies

- **Epic 1 completion required:** Authentication, database schema, app shell must be deployed
- **Expense/Income tables exist:** Schema from Story 1.2, but data comes in Epic 3/4

## Acceptance Criteria (Authoritative)

### Story 2.1: Create Property
1. AC-2.1.1: User can access "Add Property" form from Properties page
2. AC-2.1.2: Form validates required fields (name, street, city, state, zip) on blur
3. AC-2.1.3: Successful save shows snackbar "Property added ✓" and redirects to dashboard
4. AC-2.1.4: New property appears in dashboard list immediately
5. AC-2.1.5: Property created with user's AccountId (multi-tenant)

### Story 2.2: View Properties List with Dashboard Stats
6. AC-2.2.1: Dashboard shows stats bar with Total Expenses, Total Income, Net Income (all $0 placeholders)
7. AC-2.2.2: Dashboard displays list of all properties with name, city/state, YTD expense total
8. AC-2.2.3: Empty state shows "No properties yet" message with Add Property button
9. AC-2.2.4: All 14 properties visible without pagination (list view)
10. AC-2.2.5: Each property row has [+] quick-add button (disabled until Epic 3)

### Story 2.3: View Property Detail Page
11. AC-2.3.1: Clicking property row navigates to `/properties/:id`
12. AC-2.3.2: Detail page shows property name, full address, YTD totals
13. AC-2.3.3: Recent Expenses/Income sections show empty states
14. AC-2.3.4: Edit and Delete buttons visible on detail page
15. AC-2.3.5: Accessing non-existent property shows 404 page

### Story 2.4: Edit Property
16. AC-2.4.1: Edit button navigates to `/properties/:id/edit` with pre-filled form
17. AC-2.4.2: Saving updates shows snackbar "Property updated ✓"
18. AC-2.4.3: Cancel with unsaved changes shows confirmation dialog
19. AC-2.4.4: UpdatedAt timestamp updated on save

### Story 2.5: Delete Property
20. AC-2.5.1: Delete button shows modal confirmation with property name
21. AC-2.5.2: Confirming delete soft-deletes property (DeletedAt set)
22. AC-2.5.3: Related expenses/income cascade soft-deleted
23. AC-2.5.4: Snackbar shows "Property deleted" and redirects to dashboard
24. AC-2.5.5: Deleted property no longer appears in any lists

## Traceability Mapping

| AC | Spec Section | Component(s) | Test Idea |
|----|--------------|--------------|-----------|
| AC-2.1.1 | APIs - POST /properties | PropertiesController, PropertyFormComponent | Navigate to /properties/new, verify form renders |
| AC-2.1.2 | Data Models - CreatePropertyRequest | PropertyFormComponent, CreatePropertyValidator | Leave fields empty, verify error messages |
| AC-2.1.3 | Workflows - Create Property Flow | PropertyFormComponent, API | Submit valid form, verify snackbar and redirect |
| AC-2.1.4 | APIs - GET /properties | DashboardComponent, PropertyStore | Create property, verify appears in list |
| AC-2.1.5 | Architecture - Multi-tenancy | CreatePropertyHandler | Create as User A, verify User B cannot see |
| AC-2.2.1 | Data Models - PropertySummaryDto | StatsBarComponent | Load dashboard, verify $0 totals displayed |
| AC-2.2.2 | Services - GetAllPropertiesQuery | PropertyRowComponent | Load dashboard with properties, verify list |
| AC-2.2.3 | Design - Empty States | DashboardComponent | New account, verify empty state message |
| AC-2.2.4 | Performance | DashboardComponent | Create 14 properties, verify all visible |
| AC-2.2.5 | Services | PropertyRowComponent | Verify [+] button present but disabled |
| AC-2.3.1 | APIs - GET /properties/{id} | DashboardComponent, Router | Click property, verify URL change |
| AC-2.3.2 | Data Models - PropertyDetailDto | PropertyDetailComponent | Load detail, verify all fields shown |
| AC-2.3.3 | Design | PropertyDetailComponent | Verify empty state text for expenses/income |
| AC-2.3.4 | APIs - PUT, DELETE | PropertyDetailComponent | Verify Edit/Delete buttons visible |
| AC-2.3.5 | Security - 404 handling | PropertyDetailComponent | Navigate to /properties/invalid-guid |
| AC-2.4.1 | APIs - GET, PUT | PropertyFormComponent | Click Edit, verify form pre-filled |
| AC-2.4.2 | Workflows | PropertyFormComponent | Save changes, verify snackbar |
| AC-2.4.3 | UX Patterns | PropertyFormComponent, CanDeactivate guard | Modify, cancel, verify dialog |
| AC-2.4.4 | Data Models - Property.UpdatedAt | UpdatePropertyHandler | Update, verify timestamp changed |
| AC-2.5.1 | UX Patterns - Confirmation | PropertyDetailComponent, mat-dialog | Click delete, verify modal |
| AC-2.5.2 | Services - DeletePropertyCommand | DeletePropertyHandler | Delete, verify DeletedAt set |
| AC-2.5.3 | Architecture - Cascade | DeletePropertyHandler | Delete property with expenses, verify cascade |
| AC-2.5.4 | Workflows - Delete Flow | PropertyDetailComponent | Complete delete, verify snackbar/redirect |
| AC-2.5.5 | Services - Global Query Filter | GetAllPropertiesQuery | Delete property, verify excluded from list |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Address validation complexity | Medium | Accept free-form entry for MVP; consider address validation service post-MVP |
| State dropdown maintenance | Low | Use static list of US states; international addresses out of scope |
| Cascade delete performance | Low | Only relevant with many expenses; batch soft-delete if needed |

### Assumptions

1. Users will have at most ~20 properties (no pagination needed)
2. US addresses only for MVP (state dropdown, 5-digit ZIP)
3. Property name is user-defined (not validated against address)
4. Single account per user for MVP (no account switching)

### Open Questions

1. **Q:** Should we validate ZIP codes against state? **A:** No, unnecessary complexity for MVP.
2. **Q:** Property image/photo support? **A:** Deferred to post-MVP growth features.
3. **Q:** Undo delete functionality? **A:** Soft delete allows admin recovery; user-facing undo not in MVP.

## Test Strategy Summary

### Unit Tests (xUnit)

- `CreatePropertyHandlerTests`: Valid creation, validation failures, duplicate name handling
- `GetAllPropertiesQueryTests`: Empty list, multiple properties, tenant isolation
- `UpdatePropertyHandlerTests`: Valid update, not found, unauthorized
- `DeletePropertyHandlerTests`: Soft delete, cascade behavior

### Integration Tests (xUnit + Testcontainers)

- `PropertiesControllerTests`: Full CRUD cycle against real PostgreSQL
- Multi-tenant isolation: Create as User A, verify User B gets 404

### Component Tests (Vitest)

- `PropertyFormComponent`: Form validation, submit behavior
- `PropertyRowComponent`: Rendering, click handling
- `DashboardComponent`: Empty state, populated state

### E2E Tests (Playwright)

- Happy path: Login → Add Property → View Dashboard → View Detail → Edit → Delete
- Validation: Submit empty form, verify errors
- 404: Navigate to invalid property ID

### Manual Verification Checklist

- [ ] Create property with all fields
- [ ] View in dashboard list
- [ ] Navigate to detail page
- [ ] Edit and verify update
- [ ] Delete with confirmation
- [ ] Verify soft delete in database
- [ ] Mobile responsive layout
