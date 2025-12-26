# Epic Technical Specification: Expense Tracking

Date: 2025-12-04
Author: Dave
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 delivers the core expense tracking functionality that represents the heart of Property Manager - approximately 80% of daily usage happens here. This epic enables users to record expenses for each rental property with proper IRS Schedule E categorization, view and filter expenses across their portfolio, and see accurate year-to-date totals on the dashboard.

The expense tracking system transforms the chaotic "shoebox of receipts" workflow into organized, categorized financial records. Users can quickly add expenses through the Expense Workspace pattern (form + history on same page), filter and search across all properties, and have confidence that their data is complete and accurate for tax time.

This epic completes the "core value loop": record expenses → see totals update → answer "how much is this costing us?" - the fundamental question the application exists to answer.

## Objectives and Scope

### In Scope

- **Expense CRUD Operations**: Create, read, update, and soft-delete expenses linked to properties
- **Expense Workspace UI**: Full-page experience showing form + expense history for batch entry
- **IRS Schedule E Categories**: 15 expense categories aligned with Schedule E line items (seeded in Epic 1)
- **Filtering & Search**: Filter by date range, category; search by description text
- **Tax Year Selector**: Global year filter affecting all totals and lists
- **Dashboard Integration**: Real expense totals replacing Epic 2 placeholders
- **Duplicate Prevention**: Warn users about potential duplicate entries with override option
- **Property Detail Integration**: Show per-property expense totals and recent expenses

### Out of Scope

- Receipt attachment to expenses (Epic 5 - Receipt Capture)
- AI/OCR reading of receipts (Future)
- Recurring expense automation (Future)
- Expense import from external sources (Future)
- Multi-currency support (N/A - USD only)
- Expense approval workflows (N/A - single user MVP)

## System Architecture Alignment

### Backend Components

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Domain | `Expense` entity | Core expense data with validation rules |
| Application | `Expenses/` feature folder | CQRS commands/queries for expense operations |
| Infrastructure | `ExpenseConfiguration` | EF Core mapping, global query filters |
| API | `ExpensesController` | REST endpoints for expense CRUD + filtering |

### Frontend Components

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Feature | `features/expenses/` | Expense workspace, list, filters |
| Store | `expense.store.ts` | @ngrx/signals state management |
| Components | `ExpenseRowComponent` | Reusable expense list item |
| Shared | `StatsBarComponent` | Updated with real expense totals |

### Database Tables

- `Expenses` - Primary expense records (created in Epic 1)
- `ExpenseCategories` - IRS Schedule E categories (seeded in Epic 1)

### Architecture Constraints

- All expenses filtered by `AccountId` via EF Core global query filters
- Soft deletes via `DeletedAt` timestamp
- Audit fields: `CreatedAt`, `UpdatedAt`, `CreatedByUserId`
- Amount stored as `decimal(10,2)` - no floating point

## Detailed Design

### Services and Modules

#### Backend Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| `CreateExpense` | `Application/Expenses/CreateExpense.cs` | Command + Handler for expense creation with validation |
| `UpdateExpense` | `Application/Expenses/UpdateExpense.cs` | Command + Handler for expense updates |
| `DeleteExpense` | `Application/Expenses/DeleteExpense.cs` | Command + Handler for soft-delete |
| `GetExpense` | `Application/Expenses/GetExpense.cs` | Query for single expense by ID |
| `GetExpensesByProperty` | `Application/Expenses/GetExpensesByProperty.cs` | Query for expenses filtered by property |
| `GetAllExpenses` | `Application/Expenses/GetAllExpenses.cs` | Query with filtering (date, category, search) |
| `CheckDuplicateExpense` | `Application/Expenses/CheckDuplicateExpense.cs` | Query to detect potential duplicates |
| `GetExpenseTotals` | `Application/Expenses/GetExpenseTotals.cs` | Query for dashboard/property totals by year |
| `ExpenseValidator` | `Application/Expenses/CreateExpenseValidator.cs` | FluentValidation rules |

#### Frontend Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| `expense.store.ts` | `features/expenses/stores/` | Signal-based state: expenses, filters, loading states |
| `expense.service.ts` | `features/expenses/services/` | API calls via generated NSwag client |
| `expense-workspace.component.ts` | `features/expenses/` | Main workspace with form + history |
| `expense-list.component.ts` | `features/expenses/` | All expenses view with filters |
| `expense-row.component.ts` | `features/expenses/components/` | Reusable expense list item |
| `expense-form.component.ts` | `features/expenses/components/` | Reusable expense form (create/edit) |
| `category-select.component.ts` | `features/expenses/components/` | Category dropdown with Schedule E categories |

### Data Models and Contracts

#### Domain Entity: Expense

```csharp
// Domain/Entities/Expense.cs
public class Expense
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid PropertyId { get; private set; }
    public Guid CategoryId { get; private set; }
    public decimal Amount { get; private set; }
    public DateOnly Date { get; private set; }
    public string? Description { get; private set; }
    public Guid? ReceiptId { get; private set; }  // Epic 5
    public Guid CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    // Navigation properties
    public Property Property { get; private set; } = null!;
    public ExpenseCategory Category { get; private set; } = null!;
    public User CreatedBy { get; private set; } = null!;
}
```

#### DTOs

```csharp
// Application/Expenses/ExpenseDto.cs
public record ExpenseDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    Guid CategoryId,
    string CategoryName,
    string ScheduleELine,
    decimal Amount,
    DateOnly Date,
    string? Description,
    Guid? ReceiptId,
    DateTime CreatedAt
);

// Application/Expenses/CreateExpenseCommand.cs
public record CreateExpenseCommand(
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
) : IRequest<Guid>;

// Application/Expenses/UpdateExpenseCommand.cs
public record UpdateExpenseCommand(
    Guid Id,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
) : IRequest;

// Application/Expenses/ExpenseFilterDto.cs
public record ExpenseFilterDto(
    DateOnly? DateFrom,
    DateOnly? DateTo,
    List<Guid>? CategoryIds,
    string? Search,
    Guid? PropertyId,
    int? Year,
    int Page = 1,
    int PageSize = 50
);

// Application/Expenses/ExpenseTotalsDto.cs
public record ExpenseTotalsDto(
    decimal TotalExpenses,
    int Year,
    List<PropertyExpenseTotal> ByProperty
);

public record PropertyExpenseTotal(
    Guid PropertyId,
    string PropertyName,
    decimal Total
);
```

#### TypeScript Interfaces (Generated via NSwag)

```typescript
// Generated in api.service.ts
export interface ExpenseDto {
  id: string;
  propertyId: string;
  propertyName: string;
  categoryId: string;
  categoryName: string;
  scheduleELine: string;
  amount: number;
  date: string;  // ISO date
  description?: string;
  receiptId?: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  propertyId: string;
  amount: number;
  date: string;
  categoryId: string;
  description?: string;
}

export interface ExpenseListResponse {
  items: ExpenseDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### APIs and Interfaces

#### Expense Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/v1/expenses` | List all expenses (filtered) | Query params | `{ items, totalCount, page, pageSize, totalPages }` |
| `POST` | `/api/v1/expenses` | Create expense | `CreateExpenseRequest` | `201` + `{ id }` |
| `GET` | `/api/v1/expenses/{id}` | Get single expense | - | `ExpenseDto` |
| `PUT` | `/api/v1/expenses/{id}` | Update expense | `UpdateExpenseRequest` | `204 No Content` |
| `DELETE` | `/api/v1/expenses/{id}` | Soft-delete expense | - | `204 No Content` |
| `GET` | `/api/v1/expenses/totals` | Get expense totals | `?year=2025` | `ExpenseTotalsDto` |
| `GET` | `/api/v1/expenses/check-duplicate` | Check for duplicates | Query params | `{ isDuplicate, existingExpense? }` |

#### Property Expense Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/properties/{id}/expenses` | Expenses for property | `{ items, totalCount }` |

#### Query Parameters for GET /expenses

| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | `DateOnly` | Filter: start date |
| `dateTo` | `DateOnly` | Filter: end date |
| `categoryIds` | `Guid[]` | Filter: expense categories |
| `search` | `string` | Search description text |
| `propertyId` | `Guid` | Filter: specific property |
| `year` | `int` | Filter: tax year (Jan 1 - Dec 31) |
| `page` | `int` | Pagination: page number (default 1) |
| `pageSize` | `int` | Pagination: items per page (default 50) |

#### Duplicate Check Endpoint

```
GET /api/v1/expenses/check-duplicate?propertyId={guid}&amount={decimal}&date={date}
```

Returns:
```json
{
  "isDuplicate": true,
  "existingExpense": {
    "id": "abc-123",
    "date": "2025-12-01",
    "amount": 127.50,
    "description": "Home Depot - Faucet"
  }
}
```

Duplicate detection criteria: Same `propertyId` + `amount` + `date` within 24 hours.

### Workflows and Sequencing

#### Create Expense Flow

```
User clicks [+ Add] on property row
    │
    ▼
Navigate to /properties/{id}/expenses (Expense Workspace)
    │
    ▼
User fills form: Amount, Date, Category, Description
    │
    ▼
Frontend calls: POST /api/v1/expenses/check-duplicate
    │
    ├── No duplicate → Continue
    │
    └── Duplicate found → Show warning dialog
        │
        ├── User clicks [Cancel] → Return to form
        │
        └── User clicks [Save Anyway] → Continue
    │
    ▼
Frontend calls: POST /api/v1/expenses
    │
    ▼
Backend: CreateExpenseHandler
    ├── Validate via FluentValidation
    ├── Check property belongs to user's account
    ├── Create Expense entity
    ├── Save to database
    └── Return new expense ID
    │
    ▼
Frontend receives 201 Created
    │
    ▼
Show snackbar: "Expense saved ✓"
    │
    ▼
Refresh expense list (new expense at top)
    │
    ▼
Clear form for next entry
```

#### Edit Expense Flow

```
User hovers expense row → Edit icon appears
    │
    ▼
User clicks edit icon
    │
    ▼
Inline edit form expands OR side panel opens
    │
    ▼
User modifies fields
    │
    ▼
User clicks [Save]
    │
    ▼
Frontend calls: PUT /api/v1/expenses/{id}
    │
    ▼
Backend: UpdateExpenseHandler
    ├── Validate ownership (AccountId match)
    ├── Validate via FluentValidation
    ├── Update entity fields
    ├── Set UpdatedAt timestamp
    └── Save to database
    │
    ▼
Frontend receives 204 No Content
    │
    ▼
Show snackbar: "Expense updated ✓"
    │
    ▼
Refresh list with updated values
    │
    ▼
Recalculate totals if amount changed
```

#### Delete Expense Flow

```
User clicks delete icon on expense row
    │
    ▼
Inline confirmation: "Delete this expense?" [Cancel] [Delete]
    │
    ├── User clicks [Cancel] → Dismiss
    │
    └── User clicks [Delete]
        │
        ▼
    Frontend calls: DELETE /api/v1/expenses/{id}
        │
        ▼
    Backend: DeleteExpenseHandler
        ├── Validate ownership (AccountId match)
        ├── Set DeletedAt = DateTime.UtcNow
        └── Save to database
        │
        ▼
    Frontend receives 204 No Content
        │
        ▼
    Show snackbar: "Expense deleted"
        │
        ▼
    Remove from list, recalculate totals
```

#### Dashboard Totals Update Flow

```
Dashboard loads OR year selector changes
    │
    ▼
Frontend calls: GET /api/v1/expenses/totals?year={year}
    │
    ▼
Backend: GetExpenseTotalsHandler
    ├── Filter expenses by AccountId (automatic via global filter)
    ├── Filter by date range: Jan 1 - Dec 31 of {year}
    ├── Calculate SUM(Amount) for all expenses
    ├── Group by PropertyId, calculate per-property totals
    └── Return ExpenseTotalsDto
    │
    ▼
Frontend updates StatsBarComponent
    │
    ▼
Frontend updates PropertyRowComponent totals

## Non-Functional Requirements

### Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Expense list load | < 500ms | Time to first meaningful paint for up to 100 expenses |
| Expense create/update | < 300ms | API response time |
| Dashboard totals | < 500ms | Time to calculate totals for all properties |
| Filter/search response | < 300ms | Time to return filtered results |
| Pagination | No degradation | Performance consistent regardless of total expense count |

**Implementation Guidelines:**

- **Database indexes** on `Expenses` table:
  - `IX_Expenses_AccountId_Date` - for year filtering
  - `IX_Expenses_AccountId_PropertyId` - for property filtering
  - `IX_Expenses_AccountId_CategoryId` - for category filtering
  - Composite index for common query patterns

- **Query optimization:**
  - Use `.AsNoTracking()` for read-only queries
  - Project to DTOs directly in queries (avoid loading full entities)
  - Pagination enforced server-side (max 100 per page)

- **Frontend optimization:**
  - Virtual scrolling for expense lists > 50 items
  - Debounce search input (300ms)
  - Cache expense categories (rarely change)

**PRD Reference:** NFR1 (pages < 3s), NFR2 (pagination handles hundreds of records)

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Tenant isolation** | EF Core global query filter on `AccountId` - expenses only visible to owning account |
| **Authorization** | JWT token with `accountId` claim, validated on every request |
| **Input validation** | FluentValidation on all commands; sanitize description text |
| **Amount validation** | Server-side: Amount > 0, max 2 decimal places, max value $9,999,999.99 |
| **Date validation** | Server-side: Date not in future, not before account creation |
| **SQL injection** | Parameterized queries via EF Core (automatic) |
| **XSS prevention** | Angular auto-escapes; backend validates no HTML in description |

**Validation Rules (FluentValidation):**

```csharp
public class CreateExpenseValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseValidator()
    {
        RuleFor(x => x.PropertyId).NotEmpty();
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than $0")
            .LessThanOrEqualTo(9999999.99m).WithMessage("Amount exceeds maximum");
        RuleFor(x => x.Date)
            .NotEmpty()
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("Date cannot be in the future");
        RuleFor(x => x.Description)
            .MaximumLength(500)
            .Must(d => d == null || !ContainsHtml(d))
            .WithMessage("Description cannot contain HTML");
    }
}
```

**PRD Reference:** NFR4 (HTTPS), NFR7 (auth required), NFR12 (input validation)

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| **Data persistence** | Immediate save on create/update (FR55) |
| **Soft deletes** | `DeletedAt` timestamp, data recoverable (FR56) |
| **Optimistic concurrency** | EF Core concurrency token on `UpdatedAt` |
| **Transaction handling** | Single expense operations atomic; no cross-entity transactions needed |
| **Error recovery** | Failed saves show retry option; form data preserved |

**Error Handling:**

| Scenario | Response | User Experience |
|----------|----------|-----------------|
| Validation failure | 400 + Problem Details | Inline field errors |
| Expense not found | 404 | "Expense not found" message |
| Unauthorized (wrong account) | 404 | Same as not found (don't leak existence) |
| Concurrency conflict | 409 | "Data was modified. Refresh and retry" |
| Server error | 500 | "Something went wrong. Please try again" |

**PRD Reference:** NFR22 (99% uptime), NFR23 (graceful errors)

### Observability

| Signal | Implementation |
|--------|----------------|
| **Structured logging** | Serilog JSON with `traceId`, `accountId`, `expenseId` |
| **Log levels** | Info: CRUD operations, Warn: validation failures, Error: exceptions |
| **Metrics** | Expense count by property, total amounts by year (for future dashboards) |
| **Correlation** | `traceId` from HTTP header flows through all logs |

**Key Log Events:**

```csharp
// Expense created
Log.Information("Expense created: {ExpenseId} for property {PropertyId}, amount {Amount}",
    expense.Id, expense.PropertyId, expense.Amount);

// Duplicate detected
Log.Information("Potential duplicate expense detected: {PropertyId}, {Amount}, {Date}",
    propertyId, amount, date);

// Validation failure
Log.Warning("Expense validation failed: {Errors}", validationResult.Errors);
```

**PRD Reference:** NFR27 (logging sufficient to diagnose issues)

## Dependencies and Integrations

### Internal Dependencies (From Previous Epics)

| Dependency | Epic | Required For |
|------------|------|--------------|
| `Expense` entity & table | Epic 1 (Story 1.2) | Database schema exists |
| `ExpenseCategories` seed data | Epic 1 (Story 1.2) | 15 IRS Schedule E categories |
| `Property` entity & endpoints | Epic 2 | Link expenses to properties |
| Authentication & JWT | Epic 1 (Story 1.4) | Secure API access |
| `AccountId` global query filters | Epic 1 (Story 1.2) | Tenant isolation |
| Angular Material theme | Epic 1 (Story 1.7) | Forest Green styling |
| Dashboard shell | Epic 2 (Story 2.2) | Stats bar, property list |

### Backend Dependencies (NuGet)

| Package | Version | Purpose |
|---------|---------|---------|
| `MediatR` | 12.x | CQRS command/query handling |
| `FluentValidation` | 11.x | Request validation |
| `FluentValidation.DependencyInjectionExtensions` | 11.x | Auto-register validators |
| `Microsoft.EntityFrameworkCore` | 10.x | ORM, query building |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 10.x | PostgreSQL provider |
| `Serilog` | 4.x | Structured logging |

### Frontend Dependencies (npm)

| Package | Version | Purpose |
|---------|---------|---------|
| `@angular/core` | 20.x | Framework |
| `@angular/material` | 20.x | UI components |
| `@ngrx/signals` | 19.x | Signal-based state management |
| `date-fns` | 3.x | Date formatting and manipulation |

### Integration Points

| Integration | Type | Description |
|-------------|------|-------------|
| **Properties API** | Internal | Validate PropertyId exists and belongs to account |
| **Categories API** | Internal | Fetch expense categories for dropdown |
| **Dashboard** | Internal | Provide totals via `/expenses/totals` endpoint |
| **NSwag** | Build-time | Generate TypeScript client from .NET controllers |

### Database Migrations Required

This epic requires a new migration to add indexes for performance:

```csharp
// Migration: AddExpenseIndexes
migrationBuilder.CreateIndex(
    name: "IX_Expenses_AccountId_Date",
    table: "Expenses",
    columns: new[] { "AccountId", "Date" });

migrationBuilder.CreateIndex(
    name: "IX_Expenses_AccountId_PropertyId",
    table: "Expenses",
    columns: new[] { "AccountId", "PropertyId" });

migrationBuilder.CreateIndex(
    name: "IX_Expenses_AccountId_CategoryId",
    table: "Expenses",
    columns: new[] { "AccountId", "CategoryId" });
```

### External Dependencies

None - Epic 3 has no external service dependencies. Receipt storage (S3) is deferred to Epic 5.

## Acceptance Criteria (Authoritative)

### AC-3.1: Create Expense

1. **AC-3.1.1**: User can create an expense with required fields: amount, date, category, propertyId
2. **AC-3.1.2**: Amount must be greater than $0 and display validation error if invalid
3. **AC-3.1.3**: Date defaults to today and cannot be in the future
4. **AC-3.1.4**: Category dropdown displays all 15 IRS Schedule E categories
5. **AC-3.1.5**: Description field is optional with 500 character max
6. **AC-3.1.6**: Expense is saved immediately and snackbar confirms "Expense saved ✓"
7. **AC-3.1.7**: New expense appears at top of expense list without page refresh
8. **AC-3.1.8**: Form clears after successful save, ready for next entry

### AC-3.2: Edit Expense

9. **AC-3.2.1**: User can edit amount, date, category, and description of existing expense
10. **AC-3.2.2**: Edit actions appear on hover/focus of expense row
11. **AC-3.2.3**: UpdatedAt timestamp is set on save
12. **AC-3.2.4**: Snackbar confirms "Expense updated ✓"
13. **AC-3.2.5**: Totals recalculate if amount changed

### AC-3.3: Delete Expense

14. **AC-3.3.1**: User can delete an expense with inline confirmation
15. **AC-3.3.2**: Confirmation shows "Delete this expense?" with [Cancel] [Delete] options
16. **AC-3.3.3**: Expense is soft-deleted (DeletedAt set, not permanently removed)
17. **AC-3.3.4**: Snackbar confirms "Expense deleted"
18. **AC-3.3.5**: Expense disappears from list and totals recalculate

### AC-3.4: View All Expenses with Filters

19. **AC-3.4.1**: User can view all expenses across all properties
20. **AC-3.4.2**: Expense list shows: date, property name, description, category tag, amount
21. **AC-3.4.3**: User can filter by date range (This Month, This Quarter, Custom)
22. **AC-3.4.4**: User can filter by one or more categories (multi-select)
23. **AC-3.4.5**: User can search by description text (case-insensitive, real-time filter)
24. **AC-3.4.6**: Active filters shown as chips with "Clear all" option
25. **AC-3.4.7**: Empty state shows "No expenses match your filters" with clear link
26. **AC-3.4.8**: List paginates when > 50 items without performance degradation

### AC-3.5: Tax Year Selector and Dashboard Totals

27. **AC-3.5.1**: Dashboard shows year selector dropdown (defaults to current year)
28. **AC-3.5.2**: Stats bar displays "Total Expenses YTD" with real sum
29. **AC-3.5.3**: Changing year updates all totals and lists
30. **AC-3.5.4**: Property list shows per-property expense totals for selected year
31. **AC-3.5.5**: Year selection persists during navigation session
32. **AC-3.5.6**: Property detail page shows expense total for selected year
33. **AC-3.5.7**: Property detail shows recent expenses list for selected year

### AC-3.6: Duplicate Expense Prevention

34. **AC-3.6.1**: System detects duplicate when same property + amount + date within 24 hours
35. **AC-3.6.2**: Warning dialog shows: "Possible duplicate: You entered a similar expense on [date] for [amount]"
36. **AC-3.6.3**: User can choose [Cancel] to return to form with data preserved
37. **AC-3.6.4**: User can choose [Save Anyway] to override and create expense
38. **AC-3.6.5**: Amounts differing by date > 24 hours do not trigger warning

## Traceability Mapping

| AC # | FR | Spec Section | Component(s) | Test Approach |
|------|-----|--------------|--------------|---------------|
| AC-3.1.1 | FR12, FR13 | APIs - POST /expenses | `CreateExpenseHandler`, `expense-form.component` | Unit + Integration |
| AC-3.1.2 | FR13 | Security - Validation | `CreateExpenseValidator` | Unit test validator |
| AC-3.1.3 | FR13 | Workflows - Create | `expense-form.component`, validator | Component + Unit |
| AC-3.1.4 | FR19 | Data Models - Categories | `category-select.component`, seed data | Component test |
| AC-3.1.5 | FR14 | Data Models - Expense | `CreateExpenseValidator` | Unit test |
| AC-3.1.6 | FR55 | Workflows - Create | `expense-workspace.component` | E2E test |
| AC-3.1.7 | FR17 | Workflows - Create | `expense.store.ts` | Component test |
| AC-3.1.8 | - | Workflows - Create | `expense-form.component` | Component test |
| AC-3.2.1 | FR15 | APIs - PUT /expenses | `UpdateExpenseHandler` | Integration test |
| AC-3.2.2 | - | UX Patterns | `expense-row.component` | Component test |
| AC-3.2.3 | - | Data Models | `UpdateExpenseHandler` | Unit test |
| AC-3.2.4 | - | Workflows - Edit | `expense-workspace.component` | E2E test |
| AC-3.2.5 | FR43 | Workflows - Edit | `expense.store.ts`, `StatsBarComponent` | Integration test |
| AC-3.3.1 | FR16 | APIs - DELETE /expenses | `DeleteExpenseHandler` | Integration test |
| AC-3.3.2 | - | UX Patterns | Confirm dialog | Component test |
| AC-3.3.3 | FR56 | Reliability | `DeleteExpenseHandler` | Unit test |
| AC-3.3.4 | - | Workflows - Delete | Snackbar | E2E test |
| AC-3.3.5 | FR43 | Workflows - Delete | `expense.store.ts` | Integration test |
| AC-3.4.1 | FR18 | APIs - GET /expenses | `GetAllExpensesHandler` | Integration test |
| AC-3.4.2 | FR18 | Data Models - ExpenseDto | `expense-row.component` | Component test |
| AC-3.4.3 | FR20 | APIs - Query params | `GetAllExpensesHandler` | Integration test |
| AC-3.4.4 | FR21 | APIs - Query params | `expense-list.component` | Integration test |
| AC-3.4.5 | FR22 | APIs - Query params | `expense-list.component` | Integration test |
| AC-3.4.6 | - | UX Patterns | Filter chips | Component test |
| AC-3.4.7 | - | UX Patterns | Empty state | Component test |
| AC-3.4.8 | NFR2 | Performance | Pagination | Performance test |
| AC-3.5.1 | FR47 | Dashboard | Year selector | Component test |
| AC-3.5.2 | FR38 | APIs - /expenses/totals | `GetExpenseTotalsHandler`, `StatsBarComponent` | Integration test |
| AC-3.5.3 | FR48 | Dashboard | `expense.store.ts` | Integration test |
| AC-3.5.4 | FR41 | Dashboard | `PropertyRowComponent` | Component test |
| AC-3.5.5 | FR48 | State Management | `expense.store.ts` | Unit test |
| AC-3.5.6 | FR43 | Property Detail | Property detail page | Integration test |
| AC-3.5.7 | FR45 | Property Detail | Property detail page | Integration test |
| AC-3.6.1 | FR57 | APIs - check-duplicate | `CheckDuplicateExpenseHandler` | Unit test |
| AC-3.6.2 | FR57 | Workflows - Create | Duplicate warning dialog | Component test |
| AC-3.6.3 | FR57 | Workflows - Create | `expense-form.component` | E2E test |
| AC-3.6.4 | FR57 | Workflows - Create | `CreateExpenseHandler` | Integration test |
| AC-3.6.5 | FR57 | APIs - check-duplicate | `CheckDuplicateExpenseHandler` | Unit test |

### FR Coverage Summary

| FR | Description | Covered By |
|----|-------------|------------|
| FR12 | Create expense linked to property | AC-3.1.1 |
| FR13 | Required fields: amount, date, category, property | AC-3.1.1, AC-3.1.2, AC-3.1.3 |
| FR14 | Optional fields: description | AC-3.1.5 |
| FR15 | Edit expense | AC-3.2.1 |
| FR16 | Delete expense | AC-3.3.1 |
| FR17 | View expenses for property | AC-3.1.7 |
| FR18 | View all expenses | AC-3.4.1, AC-3.4.2 |
| FR19 | Schedule E categories | AC-3.1.4 |
| FR20 | Filter by date range | AC-3.4.3 |
| FR21 | Filter by category | AC-3.4.4 |
| FR22 | Search by description | AC-3.4.5 |
| FR38 | Dashboard total expenses YTD | AC-3.5.2 |
| FR43 | Property expense total | AC-3.5.6 |
| FR45 | Property recent expenses | AC-3.5.7 |
| FR47 | Tax year selector | AC-3.5.1 |
| FR48 | Totals respect tax year | AC-3.5.3 |
| FR57 | Duplicate prevention | AC-3.6.1 - AC-3.6.5 |

**Coverage: 17/17 FRs mapped to acceptance criteria ✓**

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| R1 | **Expense table missing from Epic 1** - Schema may not have been created | High | Low | Verify table exists in first story; add migration if needed |
| R2 | **Category seed data missing** - 15 Schedule E categories not seeded | Medium | Low | Verify seed data exists; create seeder if needed |
| R3 | **Performance with large datasets** - User with 1000+ expenses per property | Medium | Low | Implement pagination from start; add indexes; test with realistic data volume |
| R4 | **Duplicate detection false positives** - Legitimate same-day purchases flagged | Low | Medium | Allow user override; make detection window configurable |
| R5 | **Year filter complexity** - Edge cases around year boundaries | Low | Medium | Use DateOnly type; clear Jan 1 - Dec 31 boundaries; test Dec 31/Jan 1 scenarios |

### Assumptions

| ID | Assumption | Validation |
|----|------------|------------|
| A1 | `Expenses` table exists with correct schema from Epic 1, Story 1.2 | Verify database schema before starting |
| A2 | `ExpenseCategories` seeded with 15 IRS Schedule E categories | Query database to confirm |
| A3 | Properties API from Epic 2 is complete and working | Test property endpoints |
| A4 | Dashboard StatsBar component exists and can accept real data | Review Epic 2 implementation |
| A5 | Global query filters for AccountId are already configured | Review Infrastructure layer |
| A6 | User only needs to track expenses in USD (no multi-currency) | Confirmed in PRD scope |
| A7 | Tax year follows calendar year (Jan 1 - Dec 31) | Standard US tax year |

### Open Questions

| ID | Question | Owner | Decision/Status |
|----|----------|-------|-----------------|
| Q1 | Should duplicate detection check category as well as amount/date? | Dave | **Decision needed** - Current spec: property + amount + date only |
| Q2 | What happens to expenses when a property is deleted? | Dave | **Proposed**: Soft-delete cascade - expenses remain but hidden with property |
| Q3 | Should we allow editing PropertyId on existing expenses? | Dave | **Proposed**: No - delete and recreate to change property |
| Q4 | How many years back should the year selector go? | Dave | **Proposed**: Current year + 5 previous years |
| Q5 | Should filter state persist across sessions (localStorage)? | Dave | **Proposed**: No for MVP - session only |

## Test Strategy Summary

### Test Pyramid

```
        ┌─────────┐
        │  E2E    │  4 critical flows
        │ (few)   │
       ┌┴─────────┴┐
       │ Integration│  12 API endpoint tests
       │  (some)    │
      ┌┴───────────┴┐
      │    Unit     │  30+ handler/validator tests
      │   (many)    │
      └─────────────┘
```

### Unit Tests (xUnit)

| Component | Tests | Focus |
|-----------|-------|-------|
| `CreateExpenseValidator` | 8 | All validation rules |
| `UpdateExpenseValidator` | 6 | Update-specific validation |
| `CreateExpenseHandler` | 5 | Business logic, entity creation |
| `UpdateExpenseHandler` | 4 | Update logic, timestamp handling |
| `DeleteExpenseHandler` | 3 | Soft delete logic |
| `CheckDuplicateExpenseHandler` | 5 | Duplicate detection algorithm |
| `GetExpenseTotalsHandler` | 4 | Aggregation logic |

**Naming Convention:** `Method_Scenario_ExpectedResult`

```csharp
[Fact]
public async Task Handle_ValidExpense_CreatesAndReturnsId() { }

[Fact]
public async Task Handle_NegativeAmount_ThrowsValidationException() { }

[Fact]
public async Task Handle_DuplicateWithin24Hours_ReturnsIsDuplicateTrue() { }
```

### Integration Tests (xUnit + TestContainers)

| Endpoint | Tests | Scenarios |
|----------|-------|-----------|
| `POST /expenses` | 3 | Success, validation failure, property not found |
| `PUT /expenses/{id}` | 3 | Success, not found, wrong account |
| `DELETE /expenses/{id}` | 2 | Success, not found |
| `GET /expenses` | 4 | No filter, date filter, category filter, search |
| `GET /expenses/totals` | 2 | Current year, specific year |
| `GET /expenses/check-duplicate` | 2 | Duplicate found, no duplicate |

### Component Tests (Vitest + Testing Library)

| Component | Tests | Focus |
|-----------|-------|-------|
| `expense-form.component` | 6 | Form validation, submit, clear |
| `expense-row.component` | 4 | Display, hover actions, delete confirm |
| `expense-list.component` | 5 | Filters, search, pagination, empty state |
| `category-select.component` | 3 | Display categories, selection |
| `StatsBarComponent` | 3 | Display totals, loading state |

### E2E Tests (Playwright)

| Flow | Steps | Critical Path |
|------|-------|---------------|
| **Create Expense** | Navigate → Fill form → Save → Verify in list | Yes |
| **Edit Expense** | Find expense → Edit → Save → Verify changes | Yes |
| **Delete Expense** | Find expense → Delete → Confirm → Verify removed | Yes |
| **Filter & Search** | Apply filters → Verify results → Clear → Verify reset | Yes |

### Manual Smoke Test Checklist (Per Story)

```markdown
## Smoke Test: [Story Name]

### API Verification
- [ ] Endpoint returns expected status code
- [ ] Response matches expected schema
- [ ] Postman request added to collection

### Database Verification
- [ ] Expected rows created/updated
- [ ] AccountId correctly set
- [ ] Audit fields (CreatedAt, UpdatedAt) populated
- [ ] Soft delete sets DeletedAt (not physical delete)

### Frontend Verification
- [ ] Signal state updates in DevTools
- [ ] UI reflects changes immediately
- [ ] Snackbar confirmation displayed
- [ ] Form clears/resets as expected

### Cross-cutting
- [ ] Year filter respected
- [ ] Totals recalculated
- [ ] No console errors
```

### Test Data Strategy

- **Seed data**: Use test account with 3 properties, 50 expenses across categories
- **Edge cases**: Zero-amount (rejected), max amount, long descriptions
- **Date scenarios**: Today, past dates, year boundaries
- **Duplicates**: Same amount/date within window, outside window

### Coverage Targets

| Layer | Target | Tool |
|-------|--------|------|
| Backend handlers | 90% | xUnit + Coverlet |
| Frontend components | 80% | Vitest |
| Critical paths | 100% | Playwright E2E |
| PRD FRs | 100% | Traceability matrix |
