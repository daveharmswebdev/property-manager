# Epic Technical Specification: Income Tracking

Date: 2025-12-13
Author: Dave
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 delivers the Income Tracking capability for Property Manager, enabling users to record rental income for each property and see a complete financial picture on their dashboard. This epic completes the core financial loop by adding income alongside existing expense tracking (Epic 3), allowing users to answer "Are we making money on these properties?"

The epic builds upon the established patterns from Epic 3 (Expense Tracking) - reusing the workspace pattern, form components, and filtering mechanisms - while introducing income-specific data flows. After this epic, the dashboard will display total expenses, total income, and net income (income minus expenses), providing the complete financial visibility needed for property management decisions.

**Key User Value:** "I can record what I earn and see my net income per property and across my portfolio."

## Objectives and Scope

### In Scope

- **Income Entry (FR23-FR25):** Create income entries with amount, date, property, and optional source/description fields
- **Income Management (FR26-FR27):** Edit and delete income entries with the same patterns as expenses
- **Income Viewing (FR28-FR29):** View income for a single property and filter by date range
- **Dashboard Integration (FR39-FR40, FR44, FR46):**
  - Display total income YTD on dashboard stats bar
  - Calculate and display net income (income - expenses)
  - Show income totals per property in property detail views
  - Display recent income entries on property detail pages
- **Tax Year Filtering:** Income respects the existing tax year selector from Epic 3

### Out of Scope

- Receipt attachment to income entries (income typically doesn't require receipts)
- Tenant management or tenant-linked income (future consideration)
- Recurring income automation (manual entry for MVP)
- Income categories (unlike expenses, income is simpler - just rental income)
- Bank integration or auto-import of income transactions

## System Architecture Alignment

This epic integrates with the existing Clean Architecture layers as established in Epic 1 and extended in Epics 2-3:

**Backend Alignment:**
- `PropertyManager.Domain/Entities/Income.cs` - New entity following existing patterns
- `PropertyManager.Application/Income/` - Commands and queries following CQRS pattern (mirrors Expenses structure)
- `PropertyManager.Infrastructure/Persistence/` - EF Core configuration and repository
- `PropertyManager.Api/Controllers/IncomeController.cs` - RESTful endpoints following API conventions

**Frontend Alignment:**
- `features/income/` - New feature module with income workspace, forms, and stores
- Reuse of `StatsBarComponent` with income integration
- Reuse of form patterns and row components from expenses

**Database Alignment:**
- `Income` table already defined in Schema (Epic 1, Story 1.2)
- Uses existing AccountId tenant isolation via global query filters
- Soft delete pattern via DeletedAt field

**API Contracts:**
- Follows existing RESTful conventions (`/api/v1/income`)
- Response formats match Architecture doc patterns (`{ items, totalCount }`)

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `IncomeController` | API endpoints for income CRUD | HTTP requests | JSON responses |
| `CreateIncomeHandler` | Create new income entry | `CreateIncomeCommand` | `Guid` (new ID) |
| `UpdateIncomeHandler` | Update existing income | `UpdateIncomeCommand` | `Unit` (success) |
| `DeleteIncomeHandler` | Soft-delete income entry | `DeleteIncomeCommand` | `Unit` (success) |
| `GetIncomeByPropertyHandler` | List income for property | `GetIncomeByPropertyQuery` | `List<IncomeDto>` |
| `GetAllIncomeHandler` | List all income with filters | `GetAllIncomeQuery` | `PaginatedResult<IncomeDto>` |
| `GetPropertyTotalsHandler` | (Extended) Property totals | `GetPropertyTotalsQuery` | Includes income totals |
| `IncomeStore` (Frontend) | Signal-based state management | API responses | Reactive state |

### Data Models and Contracts

**Income Entity (Domain):**
```csharp
public class Income
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly Date { get; set; }
    public string? Source { get; set; }        // e.g., "John Smith - Rent"
    public string? Description { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation
    public Property Property { get; set; }
    public User CreatedByUser { get; set; }
}
```

**IncomeDto (Application):**
```csharp
public record IncomeDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    decimal Amount,
    DateOnly Date,
    string? Source,
    string? Description,
    DateTime CreatedAt
);
```

**CreateIncomeCommand:**
```csharp
public record CreateIncomeCommand(
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    string? Source,
    string? Description
) : IRequest<Guid>;
```

### APIs and Interfaces

| Method | Path | Request | Response | Errors |
|--------|------|---------|----------|--------|
| `POST` | `/api/v1/income` | `CreateIncomeRequest` | `201 { id }` | 400, 401, 404 |
| `GET` | `/api/v1/income` | `?dateFrom&dateTo&propertyId&year` | `200 { items, totalCount }` | 401 |
| `GET` | `/api/v1/income/{id}` | - | `200 IncomeDto` | 401, 404 |
| `PUT` | `/api/v1/income/{id}` | `UpdateIncomeRequest` | `204` | 400, 401, 404 |
| `DELETE` | `/api/v1/income/{id}` | - | `204` | 401, 404 |
| `GET` | `/api/v1/properties/{id}/income` | `?year` | `200 { items, totalCount }` | 401, 404 |

**Request/Response Examples:**

```json
// POST /api/v1/income
{
  "propertyId": "abc-123",
  "amount": 1500.00,
  "date": "2025-01-01",
  "source": "John Smith - Rent",
  "description": "January rent payment"
}

// Response: 201 Created
{ "id": "def-456" }
```

### Workflows and Sequencing

**Create Income Flow:**
```
User clicks [+ Add Income] on property detail
    → Navigate to /properties/:id/income
    → Load IncomeWorkspaceComponent
    → Display form (amount, date, source, description)
    → User fills form and clicks Save
    → POST /api/v1/income
    → Handler validates (amount > 0, property exists)
    → Create Income entity, save to DB
    → Return 201 with new ID
    → Frontend shows snackbar "Income recorded ✓"
    → Add new entry to top of income list
    → Update YTD income total
```

**Dashboard Totals Flow:**
```
User navigates to Dashboard
    → GET /api/v1/properties?year=2025 (includes totals)
    → API aggregates: sum(expenses), sum(income) per property
    → Response includes expenseTotal, incomeTotal per property
    → Frontend calculates net = income - expenses
    → StatsBarComponent displays: Expenses | Income | Net
    → Color coding: green for positive net, red for negative
```

## Non-Functional Requirements

### Performance

- Income list endpoints return within 200ms for up to 1000 entries
- Dashboard totals calculation adds < 50ms overhead to property queries
- Frontend income store updates optimistically for responsive UI
- Pagination for income lists > 100 entries

**Reference:** PRD NFR1 - "Pages load in under 3 seconds"

### Security

- All income endpoints require JWT authentication
- AccountId filtering enforced via EF Core global query filters (tenant isolation)
- Input validation: amount > 0, date format, property ownership verification
- No sensitive data in income records (no PII beyond optional source field)

**Reference:** PRD NFR7 - "API endpoints require authentication"

### Reliability/Availability

- Income CRUD operations use database transactions
- Soft delete ensures data recovery capability (FR56)
- Optimistic locking via UpdatedAt for concurrent edit protection
- Graceful degradation: if income totals fail, dashboard shows expense data with error message

### Observability

- Structured logging for income operations: `Income created: {IncomeId} for property {PropertyId}`
- Log level: Information for successful operations, Warning for validation failures
- TraceId correlation across API calls
- Metrics: income_created_count, income_total_amount (per account)

## Dependencies and Integrations

### Backend Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| MediatR | 12.x | CQRS command/query handling |
| FluentValidation | 11.x | Request validation |
| EF Core | 10.x | Database operations |
| Serilog | 3.x | Structured logging |

### Frontend Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @ngrx/signals | Latest | State management |
| Angular Material | 20.x | UI components |
| NSwag generated client | - | Type-safe API calls |

### Integration Points

- **Properties API:** Income entries reference PropertyId; property detail shows income totals
- **Dashboard:** Stats bar requires aggregated income totals from properties endpoint
- **Tax Year Filter:** Income respects existing year filter from app state (Epic 3)
- **Auth Service:** JWT token for API authentication

## Acceptance Criteria (Authoritative)

### AC-4.1: Create Income Entry
1. User can navigate to income workspace from property detail via [+ Add Income] button
2. Income form displays fields: Amount (required), Date (required, defaults today), Source (optional), Description (optional)
3. Submitting valid form creates income entry and shows "Income recorded ✓" snackbar
4. New income appears at top of income list immediately
5. YTD income total updates after save
6. Amount validation: must be > $0, displays error "Amount must be greater than $0"

### AC-4.2: Edit and Delete Income
7. Hovering over income row reveals edit and delete icons
8. Clicking edit opens inline form or side panel with pre-filled values
9. Saving edit updates entry, shows "Income updated ✓", recalculates totals
10. Clicking delete shows inline confirmation "Delete this income entry?"
11. Confirming delete soft-deletes entry, shows "Income deleted", recalculates totals
12. Cancel on either action preserves original state

### AC-4.3: View All Income with Filters
13. Navigation "Income" shows all income across all properties
14. List displays: Date, Property name, Source, Description, Amount
15. Date range filter limits displayed income to selected period
16. Property filter limits to single property
17. Empty state shows "No income recorded for this period"
18. Total reflects filtered results

### AC-4.4: Dashboard Income and Net Totals
19. Dashboard stats bar shows Total Income YTD alongside Total Expenses YTD
20. Net Income YTD calculated as (Income - Expenses)
21. Positive net displays in green
22. Negative net displays in red with parentheses format, e.g., "($1,234)"
23. Property detail page shows property-level income total and recent income
24. Changing tax year updates all income totals

## Traceability Mapping

| AC | Spec Section | Component/API | Test Idea |
|----|--------------|---------------|-----------|
| AC-1 | APIs: POST /income | IncomeController.Create, CreateIncomeHandler | Unit: validate command; Integration: full create flow |
| AC-2 | Data: IncomeDto | IncomeWorkspaceComponent | Component: form renders required fields |
| AC-3 | Workflows: Create | IncomeController, IncomeStore | Integration: create returns 201, frontend updates |
| AC-4 | Frontend: income list | IncomeListComponent | Component: new entry appears at top |
| AC-5 | APIs: GET totals | GetPropertyTotalsHandler | Unit: totals aggregate correctly |
| AC-6 | Commands: validation | CreateIncomeValidator | Unit: amount > 0 validation |
| AC-7-8 | Frontend: row actions | IncomeRowComponent | Component: hover reveals icons |
| AC-9 | APIs: PUT /income | UpdateIncomeHandler | Integration: update persists |
| AC-10-12 | APIs: DELETE /income | DeleteIncomeHandler | Integration: soft delete |
| AC-13-18 | APIs: GET /income filters | GetAllIncomeHandler | Unit: filter logic; Integration: query params |
| AC-19-24 | Frontend: dashboard | StatsBarComponent, PropertyStore | Component: displays income; E2E: dashboard shows totals |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Income totals slow down dashboard | Medium | Optimize query with indexed aggregate; consider caching |
| Negative net income confuses users | Low | Clear visual formatting (red, parentheses) and tooltip |
| Tax year filter edge cases | Low | Comprehensive test coverage for year boundaries |

### Assumptions

- Income entries are primarily monthly rent payments (simple structure)
- Users don't need income categories (unlike expenses mapped to Schedule E lines)
- Source field is free text (no tenant management in MVP)
- Property must exist before income can be recorded

### Open Questions

1. **Resolved:** Should income support bulk import? → No, manual entry for MVP
2. **Resolved:** Should income link to tenants? → No, future consideration (out of scope)
3. **Deferred:** Should recurring income be automated? → Post-MVP feature

## Test Strategy Summary

### Unit Tests (xUnit)
- `CreateIncomeHandler`: Valid command creates entry, invalid amount fails validation
- `UpdateIncomeHandler`: Update persists changes, UpdatedAt modified
- `DeleteIncomeHandler`: Soft delete sets DeletedAt
- `GetAllIncomeHandler`: Filter logic for date range, property
- `CreateIncomeValidator`: Amount > 0, PropertyId required

### Integration Tests (xUnit + Testcontainers)
- POST /income: Creates entry, returns 201, Location header correct
- GET /income: Returns paginated list, respects filters
- PUT /income: Updates entry, returns 204
- DELETE /income: Soft deletes, returns 204, subsequent GET returns 404
- Tenant isolation: User A cannot access User B's income

### Component Tests (Vitest)
- IncomeWorkspaceComponent: Renders form, displays income list
- IncomeRowComponent: Shows data correctly, hover reveals actions
- StatsBarComponent: Displays income total, calculates net correctly

### E2E Tests (Playwright)
- Create income: Navigate → fill form → submit → verify in list
- Dashboard totals: Create income → verify stats bar updates
- Tax year filter: Change year → verify income totals update

### Manual Smoke Tests (per story)
- [ ] API: POST /income returns 201
- [ ] API: GET /income returns income list
- [ ] DB: Income row created with correct AccountId
- [ ] Frontend: Income appears in list after save
- [ ] Dashboard: Stats bar shows income total
