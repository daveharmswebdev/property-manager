# Property Manager - Architecture

## Executive Summary

Property Manager is a web application that transforms paper-based rental property expense tracking into organized, tax-ready Schedule E reports. This architecture document defines the technical decisions and patterns that ensure consistent implementation across all development - whether by AI agents or human developers.

**Core Stack:**
- **Frontend:** Angular 21 + @ngrx/signals + Angular Material
- **Backend:** .NET 10 + ASP.NET Core + Clean Architecture + CQRS/MediatR
- **Database:** PostgreSQL + EF Core 10
- **Hosting:** Render (portable to AWS/GCP/Azure)

## Decision Summary

| # | Category | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Project Structure | Monorepo, 4-layer Clean Architecture | Clear separation, single PR for full features |
| 2 | Authentication | ASP.NET Core Identity + JWT + RBAC | Full control, multi-user ready, Owner/Contributor roles |
| 3 | API Design | RESTful, `/api/v1/`, GUIDs, plural resources | Industry standard, NSwag generates TypeScript client |
| 4 | Database | Account-based multi-tenancy, soft deletes, audit fields | Tenant isolation, data recovery, traceability |
| 5 | Receipt Storage | AWS S3, presigned URLs, direct upload | Scalable, secure, bypasses server for uploads |
| 6 | CI/CD | Docker-based, PR triggers tests, merge deploys | Local = deployed parity, automated migrations |
| 7 | Real-time | SignalR | Dual-device receipt sync, built into ASP.NET |
| 8 | Error Handling | Global middleware, RFC 7807 Problem Details | Consistent errors, traceable |
| 9 | Logging | Serilog, structured JSON, console sink | Cloud-agnostic, searchable, correlated by traceId |
| 10 | Testing | xUnit + Vitest + Playwright + Postman + smoke tests | Automated + manual verification per story |
| 11 | Naming | PascalCase (.NET), kebab-case (Angular files), camelCase (JSON) | Language-idiomatic, predictable |
| 12 | Code Organization | Feature-based in Application layer and Angular | One obvious home for every file |
| 13 | API Responses | `{ items, totalCount }` for lists, Problem Details for errors | Predictable, typed |

## Project Structure

### Repository Layout

```
property-manager/
├── backend/
│   ├── src/
│   │   ├── PropertyManager.Domain/
│   │   ├── PropertyManager.Application/
│   │   ├── PropertyManager.Infrastructure/
│   │   └── PropertyManager.Api/
│   ├── tests/
│   │   ├── PropertyManager.Application.Tests/
│   │   ├── PropertyManager.Api.Tests/
│   │   └── PropertyManager.Infrastructure.Tests/
│   ├── Dockerfile
│   └── PropertyManager.sln
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   ├── shared/
│   │   │   └── features/
│   │   ├── styles/
│   │   └── assets/
│   ├── e2e/
│   ├── Dockerfile
│   └── angular.json
├── postman/
│   ├── PropertyManager.postman_collection.json
│   └── environments/
├── docker-compose.yml
├── .github/workflows/ (or .gitlab-ci.yml)
└── README.md
```

### Backend Structure (Clean Architecture)

Four projects, one per layer. Dependencies point inward only — Domain has zero
project references, and Infrastructure implements interfaces declared further in.

- **Domain** — `Entities/`, `ValueObjects/`, `Exceptions/`, `Interfaces/`.
- **Application** — one folder per feature slice, each holding its MediatR
  commands and queries, their handlers, and co-located FluentValidation
  validators. Cross-cutting concerns live in `Common/` (`Behaviors/` for the
  validation and logging pipeline, `Interfaces/` for `ICurrentUser`,
  `IStorageService`, and friends).
- **Infrastructure** — `Persistence/` (`AppDbContext`, `Configurations/`,
  `Migrations/`, `Repositories/`), `Storage/` (S3), `Identity/`, and
  `DependencyInjection.cs`.
- **Api** — `Controllers/`, `Hubs/` (SignalR), `Middleware/`, `Program.cs`.

### Frontend Structure (Feature-Based)

- **`core/`** — auth (service, guard, interceptor), the NSwag-generated API
  client, and the SignalR connection.
- **`shared/`** — reusable components, pipes, and directives.
- **`features/`** — one folder per feature, holding its routes, page
  components, a `components/` folder for local pieces, and a `stores/` folder
  of `@ngrx/signals` stores. Larger features add `services/` and `pages/`.

The concrete inventory of both layers is generated directly from the code below.

<!-- BEGIN GENERATED: repo-map (scripts/gen-repo-map.sh — do not edit by hand) -->

### Backend — Application Feature Slices

```
backend/src/PropertyManager.Application/
  AccountUsers
  Auth
  Common
  Dashboard
  Expenses
  Income
  Invitations
  MaintenanceRequestPhotos
  MaintenanceRequests
  Notes
  Photos
  Properties
  PropertyPhotos
  Receipts
  Reports
  VendorPhotos
  VendorTradeTags
  Vendors
  WorkOrderTags
  WorkOrders
```

### Frontend — Feature Modules

```
frontend/src/app/features/
  admin/                 stores: admin.store.ts
  auth/
  dashboard/
  expenses/              stores: expense-detail.store.ts expense-list.store.ts expense.store.ts | services
  income/                stores: income-detail.store.ts income-list.store.ts income.store.ts | services
  maintenance-requests/  stores: maintenance-request.store.ts | services
  properties/            stores: property-photo.store.ts property.store.ts | services
  receipts/              stores: receipt.store.ts | services
  reports/               stores: reports.store.ts | services
  settings/              stores: user-management.store.ts
  tenant-dashboard/      stores: tenant-dashboard.store.ts | services
  vendors/               stores: vendor-photo.store.ts vendor.store.ts
  work-orders/           stores: work-order-photo.store.ts work-order.store.ts | services
```

### API Endpoint Inventory

Parsed from `[Route]` and `[Http*]` attributes. `TestController` is excluded
as a development-only fixture.

```

# AccountUsersController
GET    api/v1/account/users
PUT    api/v1/account/users/{userId:guid}/role
DELETE api/v1/account/users/{userId:guid}

# AdminLandlordInvitationsController
GET    api/v1/admin/landlord-invitations
POST   api/v1/admin/landlord-invitations/{id:guid}/resend
POST   api/v1/admin/landlord-invitations

# AuthController
POST   api/v1/auth/verify-email
POST   api/v1/auth/login
POST   api/v1/auth/refresh
POST   api/v1/auth/logout
POST   api/v1/auth/forgot-password
POST   api/v1/auth/reset-password

# DashboardController
GET    api/v1/dashboard/totals

# ExpensesController
GET    api/v1/expenses/check-duplicate
GET    api/v1/expenses/totals
GET    api/v1/expenses
POST   api/v1/expenses
GET    api/v1/expense-categories
GET    api/v1/properties/{id:guid}/expenses
GET    api/v1/expenses/{id:guid}
PUT    api/v1/expenses/{id:guid}
DELETE api/v1/expenses/{id:guid}
DELETE api/v1/expenses/{id:guid}/receipt
POST   api/v1/expenses/{id:guid}/link-receipt

# HealthController
GET    api/v1/health
GET    api/v1/health/ready

# IncomeController
GET    api/v1/income
POST   api/v1/income
GET    api/v1/properties/{id:guid}/income
GET    api/v1/properties/{id:guid}/income/total
GET    api/v1/income/{id:guid}
PUT    api/v1/income/{id:guid}
DELETE api/v1/income/{id:guid}

# InvitationsController
GET    api/v1/invitations
POST   api/v1/invitations/{id:guid}/resend
POST   api/v1/invitations
GET    api/v1/invitations/{code}/validate
POST   api/v1/invitations/{code}/accept

# MaintenanceRequestPhotosController
POST   api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos/upload-url
POST   api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos
GET    api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos
DELETE api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos/{photoId:guid}

# MaintenanceRequestsController
POST   api/v1/maintenance-requests
GET    api/v1/maintenance-requests
GET    api/v1/maintenance-requests/tenant-property
GET    api/v1/maintenance-requests/{id:guid}
POST   api/v1/maintenance-requests/{id:guid}/convert
POST   api/v1/maintenance-requests/{id:guid}/dismiss

# NotesController
GET    api/v1/notes
POST   api/v1/notes
PUT    api/v1/notes/{id:guid}
DELETE api/v1/notes/{id:guid}

# PhotosController
POST   api/v1/photos/upload-url
POST   api/v1/photos/confirm

# PropertiesController
GET    api/v1/properties
GET    api/v1/properties/{id:guid}
POST   api/v1/properties
PUT    api/v1/properties/{id:guid}
DELETE api/v1/properties/{id:guid}

# PropertyPhotosController
POST   api/v1/properties/{propertyId:guid}/photos/upload-url
POST   api/v1/properties/{propertyId:guid}/photos
GET    api/v1/properties/{propertyId:guid}/photos
DELETE api/v1/properties/{propertyId:guid}/photos/{photoId:guid}
PUT    api/v1/properties/{propertyId:guid}/photos/{photoId:guid}/primary
PUT    api/v1/properties/{propertyId:guid}/photos/reorder

# ReceiptsController
POST   api/v1/receipts/upload-url
POST   api/v1/receipts
GET    api/v1/receipts/{id:guid}
GET    api/v1/receipts/unprocessed
DELETE api/v1/receipts/{id:guid}
POST   api/v1/receipts/{id:guid}/process

# ReportsController
POST   api/v1/reports/schedule-e
POST   api/v1/reports/schedule-e/batch
GET    api/v1/reports
GET    api/v1/reports/{id:guid}
DELETE api/v1/reports/{id:guid}

# VendorPhotosController
POST   api/v1/vendors/{vendorId:guid}/photos/upload-url
POST   api/v1/vendors/{vendorId:guid}/photos
GET    api/v1/vendors/{vendorId:guid}/photos
DELETE api/v1/vendors/{vendorId:guid}/photos/{photoId:guid}
PUT    api/v1/vendors/{vendorId:guid}/photos/{photoId:guid}/primary
PUT    api/v1/vendors/{vendorId:guid}/photos/reorder

# VendorTradeTagsController
GET    api/v1/vendor-trade-tags
POST   api/v1/vendor-trade-tags

# VendorsController
GET    api/v1/vendors
GET    api/v1/vendors/{id:guid}
PUT    api/v1/vendors/{id:guid}
POST   api/v1/vendors
DELETE api/v1/vendors/{id:guid}

# WorkOrderPhotosController
POST   api/v1/work-orders/{workOrderId:guid}/photos/upload-url
POST   api/v1/work-orders/{workOrderId:guid}/photos
GET    api/v1/work-orders/{workOrderId:guid}/photos
DELETE api/v1/work-orders/{workOrderId:guid}/photos/{photoId:guid}
PUT    api/v1/work-orders/{workOrderId:guid}/photos/{photoId:guid}/primary
PUT    api/v1/work-orders/{workOrderId:guid}/photos/reorder

# WorkOrderTagsController
GET    api/v1/work-order-tags
POST   api/v1/work-order-tags

# WorkOrdersController
GET    api/v1/work-orders
POST   api/v1/work-orders
GET    api/v1/work-orders/{id:guid}
PUT    api/v1/work-orders/{id:guid}
DELETE api/v1/work-orders/{id:guid}
GET    api/v1/work-orders/{id:guid}/expenses
POST   api/v1/work-orders/{id:guid}/pdf
GET    api/v1/properties/{propertyId:guid}/work-orders
GET    api/v1/vendors/{vendorId:guid}/work-orders
```

<!-- END GENERATED: repo-map -->


## Technology Stack Details

### Core Technologies

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | Angular | 20 |
| State Management | @ngrx/signals | Latest |
| UI Components | Angular Material | 20.x |
| Backend Runtime | .NET | 10 (LTS) |
| Web Framework | ASP.NET Core | 10 |
| ORM | Entity Framework Core | 10 |
| Database | PostgreSQL | 16 |
| Real-time | SignalR | (included in ASP.NET Core) |
| Object Storage | AWS S3 | - |
| Hosting | Render | - |

### Development Tools

| Tool | Purpose |
|------|---------|
| NSwag | Generate TypeScript API client from .NET controllers |
| Docker | Local/production parity |
| Vitest | Angular unit/component tests |
| xUnit | .NET unit/integration tests |
| Playwright | E2E tests |
| Postman | API manual testing |
| Serilog | Structured logging |
| FluentValidation | Request validation |
| MediatR | CQRS command/query handling |

## Data Architecture

### Entity Relationship

```
Account (tenant boundary)
├── Users (1:many)
│   └── Role: Owner | Contributor
├── Properties (1:many)
│   ├── Expenses (1:many)
│   │   └── Receipt (1:1 optional)
│   └── Income (1:many)
└── Receipts (1:many, can be unassigned)

ExpenseCategories (global, no AccountId)
```

### Core Tables

```sql
-- Accounts (tenant)
Accounts (
    Id UUID PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    CreatedAt TIMESTAMP NOT NULL
)

-- Users (Identity + Account link)
Users (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    Email VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role VARCHAR(50) NOT NULL,  -- 'Owner' | 'Contributor'
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL
)

-- Properties
Properties (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    Name VARCHAR(255) NOT NULL,
    Address TEXT,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    DeletedAt TIMESTAMP NULL
)

-- Expenses
Expenses (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    PropertyId UUID NOT NULL REFERENCES Properties(Id),
    CategoryId UUID NOT NULL REFERENCES ExpenseCategories(Id),
    Amount DECIMAL(10,2) NOT NULL,
    Date DATE NOT NULL,
    Description TEXT,
    ReceiptId UUID NULL REFERENCES Receipts(Id),
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    DeletedAt TIMESTAMP NULL
)

-- Receipts
Receipts (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    PropertyId UUID NULL REFERENCES Properties(Id),
    StorageKey VARCHAR(500) NOT NULL,  -- S3 key
    OriginalFileName VARCHAR(255),
    ContentType VARCHAR(100),
    FileSizeBytes BIGINT,
    ExpenseId UUID NULL,  -- linked after processing
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    CreatedAt TIMESTAMP NOT NULL,
    ProcessedAt TIMESTAMP NULL,
    DeletedAt TIMESTAMP NULL
)

-- Income
Income (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    PropertyId UUID NOT NULL REFERENCES Properties(Id),
    Amount DECIMAL(10,2) NOT NULL,
    Date DATE NOT NULL,
    Source VARCHAR(255),
    Description TEXT,
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    DeletedAt TIMESTAMP NULL
)

-- ExpenseCategories (global seed data)
ExpenseCategories (
    Id UUID PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    ScheduleELine VARCHAR(50),
    SortOrder INT NOT NULL
)
```

### Multi-Tenancy

- All tenant data filtered by `AccountId`
- EF Core global query filters enforce isolation
- JWT claims include `accountId` for current user
- Future option: separate database per tenant for enhanced privacy

## API Contracts

### Base URL

```
/api/v1/
```

### Endpoints

The complete endpoint inventory is generated from the `[Route]` and `[Http*]`
attributes on the controllers — see **API Endpoint Inventory** under Repository
Map above. It is regenerated by `scripts/gen-repo-map.sh`, so it cannot drift
from the code.


### Response Formats

**Single Resource (200 OK):**
```json
{
  "id": "abc-123",
  "name": "123 Oak Street",
  "address": "Austin, TX 78701",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Collection (200 OK):**
```json
{
  "items": [...],
  "totalCount": 14
}
```

**Paginated Collection (200 OK):**
```json
{
  "items": [...],
  "totalCount": 156,
  "page": 2,
  "pageSize": 20,
  "totalPages": 8
}
```

**Create (201 Created):**
```json
{
  "id": "xyz-789"
}
```
+ `Location` header: `/api/v1/expenses/xyz-789`

**Update/Delete (204 No Content):** No body

**Validation Error (400 Bad Request):**
```json
{
  "type": "https://propertymanager.app/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "amount": ["Amount must be greater than 0"],
    "propertyId": ["Property is required"]
  },
  "traceId": "00-abc123..."
}
```

**Not Found (404):**
```json
{
  "type": "https://propertymanager.app/errors/not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "Expense 'xyz-789' does not exist",
  "traceId": "00-abc123..."
}
```

## Security Architecture

### Authentication Flow

1. User registers/logs in → receives JWT (stored in HttpOnly cookie)
2. JWT contains: `userId`, `accountId`, `role`, `exp`
3. API validates JWT on every request
4. Role checked via `[Authorize(Roles = "Owner")]` where needed

### Authorization (RBAC)

| Role | Capabilities |
|------|--------------|
| Owner | Full access: CRUD all resources, invite users, generate reports |
| Contributor | Capture receipts, view properties (cannot create expenses, run reports) |

### Data Protection

- HTTPS everywhere (TLS 1.2+)
- Passwords hashed with ASP.NET Core Identity (PBKDF2)
- JWT tokens with appropriate expiration
- S3 bucket private, presigned URLs for access (15 min expiry)
- S3 objects encrypted at rest
- Database credentials in environment variables
- CORS restricted to application domain
- Input validation on all endpoints (FluentValidation)

## Real-Time Architecture

### SignalR Hub

**Purpose:** Push receipt notifications for dual-device workflow

**Hub:** `ReceiptHub`, mapped at `/hubs/receipts` in `Program.cs`. SignalR hubs are
mapped directly rather than via controller attributes, so they do not appear in the
generated API Endpoint Inventory above.

**Groups:** Account-based (all users in same account receive notifications)

**Events:**
| Event | Payload | When |
|-------|---------|------|
| `ReceiptAdded` | `{ receiptId, thumbnail, propertyId }` | New receipt uploaded |
| `ReceiptLinked` | `{ receiptId, expenseId }` | Receipt linked to expense |

**Flow:**
```
Phone uploads receipt
    → API saves to S3 + database
    → API broadcasts via SignalR to account group
    → Desktop receives notification
    → Desktop refreshes receipt queue
```

## Implementation Patterns

### CQRS Pattern

**Commands (write operations):**
```csharp
// Application/Expenses/CreateExpense.cs
public record CreateExpenseCommand(
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description,
    Guid? ReceiptId
) : IRequest<Guid>;

public class CreateExpenseHandler : IRequestHandler<CreateExpenseCommand, Guid>
{
    public async Task<Guid> Handle(CreateExpenseCommand request, CancellationToken ct)
    {
        // Validation via FluentValidation pipeline behavior
        // Create entity
        // Save via repository
        // Return ID
    }
}
```

**Queries (read operations):**
```csharp
// Application/Expenses/GetExpensesByProperty.cs
public record GetExpensesByPropertyQuery(Guid PropertyId) : IRequest<List<ExpenseDto>>;
```

### Error Handling Pattern

**Global Exception Handler Middleware** (`PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs`)

The API uses a centralized exception handler middleware registered as the **first middleware** in the pipeline. This eliminates the need for try-catch blocks in controllers for standard exception-to-HTTP-status mapping.

**Exception Mapping:**

| Exception Type | HTTP Status | ProblemDetails Type |
|----------------|-------------|---------------------|
| `NotFoundException` | 404 | `https://propertymanager.app/errors/not-found` |
| `ValidationException` (FluentValidation) | 400 | `https://tools.ietf.org/html/rfc7231#section-6.5.1` |
| `ArgumentException` | 400 | `https://propertymanager.app/errors/bad-request` |
| `UnauthorizedAccessException` | 403 | `https://propertymanager.app/errors/forbidden` |
| All other exceptions | 500 | `https://propertymanager.app/errors/internal-server-error` |

**Response Format (RFC 7807 ProblemDetails):**

```json
{
  "type": "https://propertymanager.app/errors/not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "Property with ID 'abc-123' was not found",
  "instance": "/api/v1/properties/abc-123",
  "traceId": "00-abc123...",
  "exceptionDetails": "..." // Development mode only
}
```

**Key Principles:**

1. **Controllers do NOT need try-catch blocks** for domain exceptions like `NotFoundException` - the middleware handles them automatically
2. **Use try-catch in controllers ONLY** when you need custom behavior (e.g., returning a default value instead of 404)
3. **Logging levels**: 5xx errors → `LogError`, 4xx errors → `LogWarning`
4. **Stack traces**: Included only in Development environment to prevent information leakage

**Controller Example (simplified - no try-catch needed):**

```csharp
// Controllers just call MediatR - middleware handles exceptions
public async Task<IActionResult> GetExpense(Guid id)
{
    var expense = await _mediator.Send(new GetExpenseQuery(id));
    return Ok(expense);
    // If NotFoundException thrown, middleware returns 404 ProblemDetails
}
```

**When to use try-catch in controllers:**

```csharp
// ONLY use try-catch for custom exception handling
public async Task<IActionResult> GetExpenseOrDefault(Guid id)
{
    try
    {
        return Ok(await _mediator.Send(new GetExpenseQuery(id)));
    }
    catch (NotFoundException)
    {
        return Ok(new ExpenseDto { Amount = 0 }); // Custom behavior
    }
}
```

### Logging Pattern

**Cardinal rule: log correlation, never content.** Structured logs are joined back to
sensitive data through the database via non-sensitive correlation IDs — they must never
*carry* that data. Emit the IDs that let an operator pivot into the DB (entity IDs, the
request `traceId`); never emit emails, account IDs, storage keys, or raw request fields.

```csharp
// ✅ DO — log non-sensitive correlation IDs; the DB holds the rest
_logger.LogInformation("Expense created: {ExpenseId} for property {PropertyId}",
    expense.Id, expense.PropertyId);

// All logs include traceId automatically via UseSerilogRequestLogging()
```

**Log Output (JSON):**
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "Information",
  "message": "Expense created",
  "properties": {
    "expenseId": "abc-123",
    "propertyId": "def-456",
    "traceId": "00-xyz..."
  }
}
```

#### CodeQL-safe logging (read before adding any log line with an identifier)

CodeQL runs two queries against this repo that block PR merges on logging:

| Query | Catches | Example trigger |
|-------|---------|-----------------|
| `cs/cleartext-storage-of-sensitive-information` (HIGH) | account/tenant IDs and other values tainted as sensitive written to a log sink | `LogInformation("... {AccountId}", accountId)` |
| CWE-359 *Exposure of private information* | PII (emails, names) reaching a log sink | `LogInformation("... {Email}", invitation.Email)` |

**Masking helpers do NOT satisfy these queries.** `LogSanitizer.MaskEmail`, `MaskId`,
and `MaskStorageKey` are not recognized as sanitizing sinks by CodeQL's taint analysis —
a masked value is still flagged. Wrapping a sensitive value to "make it safe to log" only
hides the problem from humans, not from the scanner. (`LogSanitizer.Sanitize` is a
different tool: it strips newlines to prevent log-forging/CWE-117 and is still correct for
that purpose on user-controlled *non-sensitive* strings.)

```csharp
// ❌ DON'T — every one of these has been flagged and ripped out post-PR
_logger.LogInformation("Invitation accepted for {Email}", invitation.Email);          // CWE-359
_logger.LogInformation("Account {AccountId} provisioned", accountId);                  // cs/cleartext-storage
_logger.LogInformation("Masked: {Email}", LogSanitizer.MaskEmail(invitation.Email));   // still flagged
_logger.LogInformation("Masked: {AccountId}", LogSanitizer.MaskId(accountId));         // still flagged

// ✅ DO — log a correlation ID that maps to the sensitive entity in the DB.
// The InvitationId resolves to the email, account, and user via a single query,
// so the flow stays fully traceable without putting any of them in the log.
_logger.LogInformation(
    "Invitation {InvitationId} accepted. UserId: {UserId}, JoinedExisting: {JoinedExisting}",
    invitation.Id, userId, invitation.AccountId.HasValue);
```

**Decision rule when you need diagnostic context in a log:**

1. Is there an entity ID that maps to the sensitive value through the DB? Log that ID instead.
   (`InvitationId` → email/account; `ExpenseId` → property/account; `traceId` → request.)
2. No such ID? Log a boolean/enum about the *shape* of the event (`JoinedExisting: true`),
   not the sensitive value itself.
3. Still stuck? Drop the field. A field you can derive from the DB is never worth a blocked PR.

> History: Stories 22-1 (`5e52256`), 22-2 (`f0a1da7`), and 22-3 (`be41b7f` autofix) all
> shipped sensitive-value logs that had to be removed after CodeQL flagged the PR. The
> exemplary "✅ DO" above is the 22-3 handler in its final, passing form.

## Naming Conventions

### Backend (.NET)

| Element | Convention | Example |
|---------|------------|---------|
| Projects | `PropertyManager.{Layer}` | `PropertyManager.Domain` |
| Classes | PascalCase | `CreateExpenseHandler` |
| Interfaces | `I` prefix | `IExpenseRepository` |
| Methods | PascalCase, verb-first | `GetByIdAsync` |
| Private fields | `_camelCase` | `_logger` |
| Async methods | `Async` suffix | `HandleAsync` |
| Commands | Verb + Noun | `CreateExpense` |
| Queries | Get + What | `GetExpenseById` |
| Handlers | Command/Query + `Handler` | `CreateExpenseHandler` |

### Database

| Element | Convention | Example |
|---------|------------|---------|
| Tables | PascalCase plural | `Expenses` |
| Columns | PascalCase | `PropertyId` |
| Primary keys | `Id` | `Id` |
| Foreign keys | `{Entity}Id` | `PropertyId` |
| Indexes | `IX_{Table}_{Columns}` | `IX_Expenses_AccountId` |

### Frontend (Angular)

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `expense-row.component.ts` |
| Components | PascalCase class | `ExpenseRowComponent` |
| Services | `.service.ts` | `expense.service.ts` |
| Stores | `.store.ts` | `expense.store.ts` |
| Signals | noun, no prefix | `expenses`, `isLoading` |

### API

| Element | Convention | Example |
|---------|------------|---------|
| URLs | kebab-case, plural | `/expense-categories` |
| JSON properties | camelCase | `propertyId` |
| Query params | camelCase | `?pageSize=20` |

## Deployment Architecture

### Local Development

```yaml
# docker-compose.yml
services:
  api:
    build: ./backend
    environment:
      - ConnectionStrings__Default=Host=db;Database=propertymanager;...
      - AWS__BucketName=property-manager-receipts-dev
    ports:
      - "5000:8080"
    depends_on:
      - db

  web:
    build: ./frontend
    ports:
      - "4200:80"

  db:
    image: postgres:16
    environment:
      - POSTGRES_DB=propertymanager
      - POSTGRES_PASSWORD=localdev
    volumes:
      - pgdata:/var/lib/postgresql/data
```

### CI/CD Pipeline

```yaml
# Triggered on PR
pr-checks:
  - dotnet build
  - dotnet test
  - npm run build
  - npm run test
  - docker build (verify)

# Triggered on merge to main
deploy-production:
  - all pr-checks
  - docker push to registry
  - deploy to Render
  - EF migrations run on startup
```

### Environment Strategy

| Branch | Environment | Resources |
|--------|-------------|-----------|
| `main` | Production | Render web service + PostgreSQL |
| `staging` | Staging | Separate Render instance (when needed) |
| `dev` | Development | Separate Render instance (when needed) |

Same pipeline, same Docker image, different environment variables.

### Database Migrations

```csharp
// Automatic on production startup
if (app.Environment.IsProduction())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

Same migrations run locally (`dotnet ef database update`) and in production.

## Testing Strategy

### Test Pyramid

| Layer | Framework | What |
|-------|-----------|------|
| Unit | xUnit | Domain entities, handlers, validators |
| Integration | xUnit + Testcontainers | API endpoints with real PostgreSQL |
| Component | Vitest | Angular components, services |
| E2E | Playwright | Critical user flows |
| Manual | Postman + checklists | API verification, smoke tests |

### Test Naming

```csharp
// Method_Scenario_ExpectedResult
public async Task Handle_ValidExpense_CreatesAndReturnsId() { }
public async Task Handle_NegativeAmount_ThrowsValidationException() { }
```

### Story Definition of Done

Every PR must include:

| Deliverable | Description |
|-------------|-------------|
| Code | Implementation complete |
| Unit tests | Handler/service tests passing |
| Postman requests | New endpoints added to collection |
| Smoke test checklist | In PR description, all boxes checked |
| DB verification | Expected state documented |
| Store verification | Expected signal state changes documented |

### Smoke Test Checklist Template

```markdown
## Manual Smoke Test: [Feature Name]

### API Verification
- [ ] Endpoint returns expected status
- [ ] Response matches schema

### Database Verification
- [ ] Expected rows created/updated
- [ ] Foreign keys correct
- [ ] Audit fields populated

### Frontend Verification
- [ ] State updates in DevTools
- [ ] UI reflects changes
- [ ] Feedback shown (snackbar, etc.)

### SignalR Verification (if applicable)
- [ ] Real-time notification received
```

## Development Environment

### Prerequisites

- .NET 10 SDK
- Node.js 22 LTS
- Docker Desktop
- PostgreSQL client (psql, pgAdmin, or DataGrip)
- VS Code or JetBrains Rider
- Angular CLI (`npm install -g @angular/cli`)

### Setup Commands

```bash
# Clone repository
git clone <repo-url>
cd property-manager

# Start infrastructure
docker compose up -d db

# Backend
cd backend
dotnet restore
dotnet ef database update
dotnet run --project src/PropertyManager.Api

# Frontend (new terminal)
cd frontend
npm install
ng serve

# Access
# API: http://localhost:5000
# Web: http://localhost:4200
# Swagger: http://localhost:5000/swagger
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ConnectionStrings__Default` | PostgreSQL connection | `Host=localhost;Database=propertymanager;...` |
| `Jwt__Secret` | JWT signing key | `<256-bit-secret>` |
| `Jwt__ExpiryMinutes` | Token lifetime | `60` |
| `AWS__AccessKeyId` | S3 access key | `AKIA...` |
| `AWS__SecretAccessKey` | S3 secret | `...` |
| `AWS__BucketName` | S3 bucket | `property-manager-receipts` |
| `AWS__Region` | S3 region | `us-east-1` |

## Architecture Decision Records

### ADR-001: Monorepo over Polyrepo

**Decision:** Single repository with `backend/` and `frontend/` folders

**Rationale:** Single developer, single PR for full features, simpler CI/CD

**Trade-offs:** Larger repo over time, but acceptable for this scale

---

### ADR-002: Account-Based Multi-Tenancy

**Decision:** Shared database with `AccountId` filtering via EF Core global query filters

**Rationale:** Simple, cost-effective, adequate isolation for current scale

**Future:** Can migrate to database-per-tenant if customers demand enhanced privacy

---

### ADR-003: SignalR over Polling

**Decision:** SignalR for real-time receipt sync

**Rationale:** Built into ASP.NET Core, two-way communication, no external dependency

**Trade-offs:** Slightly more complexity than polling, but better UX

---

### ADR-004: S3 Direct Upload

**Decision:** Client uploads directly to S3 via presigned URLs

**Rationale:** Server doesn't handle file bytes, faster uploads, better scalability

**Trade-offs:** Slightly more complex client flow, but worth it

---

### ADR-005: .NET 10 + EF Core 10 (LTS)

**Decision:** Use latest LTS versions

**Rationale:** 3-year support window (until Nov 2028), native JSON, improved LINQ

**Trade-offs:** None - LTS is the correct choice for new projects

---

### ADR-006: Angular 21 + Vitest

**Decision:** Use Angular 21 with Vitest as test runner

**Rationale:** Angular 21 used for @ngrx/signals compatibility; Vitest is faster than Karma

**Trade-offs:** Migration docs available if needed

---

### ADR-007: Manual Verification Layer

**Decision:** Require Postman collection + smoke test checklist per story

**Rationale:** AI-assisted development requires human verification. "Trust but verify."

**Trade-offs:** More deliverables per PR, but catches issues before merge

---

## FR Category to Architecture Mapping

| PRD Category | Backend Module | Frontend Feature | Database Tables |
|--------------|----------------|------------------|-----------------|
| User Account & Access (FR1-6) | Auth, Identity | core/auth | Users, Accounts |
| Property Management (FR7-11) | Properties | features/properties | Properties |
| Expense Management (FR12-22) | Expenses | features/expenses | Expenses, ExpenseCategories |
| Income Management (FR23-29) | Income | features/income | Income |
| Receipt Management (FR30-37) | Receipts | features/receipts | Receipts |
| Dashboard & Views (FR38-48) | Properties, Expenses, Income | features/dashboard | (queries across tables) |
| Tax Reporting (FR49-57) | Reports | features/reports | (queries + PDF generation) |

---

## Phase 2: Work Orders and Vendors

_Extension to Phase 1 Architecture - Date: 2026-01-08_

### Decision Summary (Phase 2)

| # | Category | Decision | Rationale |
|---|----------|----------|-----------|
| 14 | Person Entity | TPT (Table-per-Type) inheritance | Future-proofs for Tenant, clean separation |
| 15 | Phone/Email Storage | JSONB columns on Person | Simple for 1-3 values, PostgreSQL native |
| 16 | Polymorphic Notes | Single table + discriminator | `EntityType` + `EntityId` pattern |
| 17 | Taxonomy Structure | Hierarchical categories, flat trade tags, mapping table | Independent evolution, AI-ready |
| 18 | Work Order ↔ Expense | FK on Expense (`WorkOrderId`) | 1:N relationship, simple |
| 19 | Work Order Status | C# Enum stored as string | Type-safe, readable in DB |
| 20 | Work Order Tags | Separate table (M:M) | Tag reuse, clean autocomplete |
| 21 | Assigned To | Nullable `VendorId` | NULL = DIY/Self |
| 22 | Photo Attachments | Reuse Receipt pattern | `WorkOrderPhotos` table, S3 presigned URLs |
| 23 | Category Hierarchy | Flat API with `ParentId` | Client builds tree |
| 24 | Dashboard View | List with status filters | Kanban deferred to Growth |
| 25 | Tag Input | Angular Material Chips + Autocomplete | Built-in components |

### New Domain Entities

#### Person (Base Entity)

```csharp
public class Person : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;

    // JSONB columns
    public List<PhoneNumber> Phones { get; set; } = [];
    public List<string> Emails { get; set; } = [];

    // Navigation
    public Account Account { get; set; } = null!;
}

public record PhoneNumber(string Number, string? Label);
```

#### Vendor (Extends Person - TPT)

```csharp
public class Vendor : Person, ISoftDeletable
{
    public DateTime? DeletedAt { get; set; }

    // Navigation
    public ICollection<VendorTradeTag> TradeTags { get; set; } = [];
    public ICollection<WorkOrder> WorkOrders { get; set; } = [];
}
```

#### WorkOrder

```csharp
public class WorkOrder : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public Guid? VendorId { get; set; }  // NULL = DIY/Self
    public Guid? CategoryId { get; set; }
    public Guid CreatedByUserId { get; set; }

    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Reported;
    public string Description { get; set; } = string.Empty;
    public DateTime? DeletedAt { get; set; }

    // Navigation
    public Account Account { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public Vendor? Vendor { get; set; }
    public ExpenseCategory? Category { get; set; }
    public ICollection<WorkOrderTag> Tags { get; set; } = [];
    public ICollection<WorkOrderPhoto> Photos { get; set; } = [];
    public ICollection<Note> Notes { get; set; } = [];
    public ICollection<Expense> Expenses { get; set; } = [];
}

public enum WorkOrderStatus { Reported, Assigned, Completed }
```

### New Database Tables

```sql
-- Person (base table for TPT)
Persons (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    FirstName VARCHAR(100) NOT NULL,
    MiddleName VARCHAR(100),
    LastName VARCHAR(100) NOT NULL,
    Phones JSONB DEFAULT '[]',
    Emails JSONB DEFAULT '[]',
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL
)

-- Vendor (extends Person via TPT)
Vendors (
    Id UUID PRIMARY KEY REFERENCES Persons(Id),
    DeletedAt TIMESTAMP NULL
)

-- Vendor Trade Tags (flat taxonomy)
VendorTradeTags (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Name VARCHAR(100) NOT NULL,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    CreatedAt TIMESTAMP NOT NULL,
    UNIQUE(AccountId, Name)
)

-- Vendor ↔ Trade Tag junction
VendorTradeTagAssignments (
    VendorId UUID NOT NULL REFERENCES Vendors(Id),
    TradeTagId UUID NOT NULL REFERENCES VendorTradeTags(Id),
    PRIMARY KEY (VendorId, TradeTagId)
)

-- Category ↔ Trade Tag mapping (for AI recommendations)
CategoryTradeTagMappings (
    CategoryId UUID NOT NULL REFERENCES ExpenseCategories(Id),
    TradeTagId UUID NOT NULL REFERENCES VendorTradeTags(Id),
    PRIMARY KEY (CategoryId, TradeTagId)
)

-- Work Orders
WorkOrders (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    PropertyId UUID NOT NULL REFERENCES Properties(Id),
    VendorId UUID NULL REFERENCES Vendors(Id),
    CategoryId UUID NULL REFERENCES ExpenseCategories(Id),
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    Status VARCHAR(50) NOT NULL DEFAULT 'Reported',
    Description TEXT NOT NULL,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    DeletedAt TIMESTAMP NULL
)

-- Work Order Tags
WorkOrderTags (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    Name VARCHAR(100) NOT NULL,
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    CreatedAt TIMESTAMP NOT NULL,
    UNIQUE(AccountId, Name)
)

-- Work Order ↔ Tag junction
WorkOrderTagAssignments (
    WorkOrderId UUID NOT NULL REFERENCES WorkOrders(Id),
    TagId UUID NOT NULL REFERENCES WorkOrderTags(Id),
    PRIMARY KEY (WorkOrderId, TagId)
)

-- Work Order Photos (mirrors Receipt pattern)
WorkOrderPhotos (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    WorkOrderId UUID NOT NULL REFERENCES WorkOrders(Id),
    StorageKey VARCHAR(500) NOT NULL,
    OriginalFileName VARCHAR(255),
    ContentType VARCHAR(100),
    FileSizeBytes BIGINT,
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    CreatedAt TIMESTAMP NOT NULL
)

-- Polymorphic Notes
Notes (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    AccountId UUID NOT NULL REFERENCES Accounts(Id),
    EntityType VARCHAR(50) NOT NULL,  -- 'WorkOrder', 'Vendor', etc.
    EntityId UUID NOT NULL,
    Content TEXT NOT NULL,
    CreatedByUserId UUID NOT NULL REFERENCES Users(Id),
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    DeletedAt TIMESTAMP NULL
)

-- Add to existing Expenses table
ALTER TABLE Expenses ADD COLUMN WorkOrderId UUID NULL REFERENCES WorkOrders(Id);

-- Add to existing ExpenseCategories table (for hierarchy)
ALTER TABLE ExpenseCategories ADD COLUMN ParentId UUID NULL REFERENCES ExpenseCategories(Id);
```

### API Extensions

#### Work Orders

```
GET    /api/v1/work-orders                    List (paginated, filterable)
POST   /api/v1/work-orders                    Create
GET    /api/v1/work-orders/{id}               Get detail
PUT    /api/v1/work-orders/{id}               Update
DELETE /api/v1/work-orders/{id}               Soft delete
GET    /api/v1/work-orders/{id}/expenses      Get linked expenses
POST   /api/v1/work-orders/{id}/expenses      Link expense
DELETE /api/v1/work-orders/{id}/expenses/{expenseId}  Unlink expense
POST   /api/v1/work-orders/{id}/photos/upload-url     Get presigned upload URL
POST   /api/v1/work-orders/{id}/photos        Confirm photo upload
DELETE /api/v1/work-orders/{id}/photos/{photoId}      Delete photo
GET    /api/v1/work-orders/{id}/notes         Get notes
POST   /api/v1/work-orders/{id}/notes         Add note

Query parameters for GET /work-orders:
?status=Reported,Assigned
?propertyId={guid}
?vendorId={guid}
?dateFrom=2026-01-01
?dateTo=2026-01-31
?search=plumbing
?page=1&pageSize=20
```

#### Vendors

```
GET    /api/v1/vendors                        List (filterable)
POST   /api/v1/vendors                        Create
GET    /api/v1/vendors/{id}                   Get detail
PUT    /api/v1/vendors/{id}                   Update
DELETE /api/v1/vendors/{id}                   Soft delete
GET    /api/v1/vendors/{id}/work-orders       Get work history

Query parameters for GET /vendors:
?search=joe
?tradeTagId={guid}
?page=1&pageSize=20
```

#### Supporting Endpoints

```
GET    /api/v1/vendor-trade-tags              List trade tags
POST   /api/v1/vendor-trade-tags              Create trade tag
GET    /api/v1/work-order-tags                List work order tags
POST   /api/v1/work-order-tags                Create work order tag
GET    /api/v1/properties/{id}/work-orders    Work orders for property
```

### Frontend Structure (Phase 2 Additions)

```
src/app/features/
├── work-orders/
│   ├── components/
│   │   ├── work-order-form/
│   │   ├── work-order-list/
│   │   ├── work-order-detail/
│   │   ├── work-order-filters/
│   │   ├── work-order-status-badge/
│   │   └── work-order-tag-input/
│   ├── services/
│   │   └── work-order.service.ts
│   ├── stores/
│   │   └── work-order.store.ts
│   └── work-orders.routes.ts
├── vendors/
│   ├── components/
│   │   ├── vendor-form/
│   │   ├── vendor-list/
│   │   ├── vendor-detail/
│   │   ├── vendor-picker/
│   │   └── trade-tag-input/
│   ├── services/
│   │   └── vendor.service.ts
│   ├── stores/
│   │   └── vendor.store.ts
│   └── vendors.routes.ts
```

### Implementation Phases

| Phase | Deliverables |
|-------|--------------|
| **A - Foundation** | Person entity, VendorTradeTags, CategoryTradeTagMappings, Notes table, ExpenseCategory hierarchy |
| **B - Core Entities** | Vendor entity, WorkOrder entity, WorkOrderTags |
| **C - Attachments & Links** | WorkOrderPhotos, Notes on WorkOrder, Expense.WorkOrderId FK |
| **D - Integration** | Receipt processing dropdown, bidirectional linking UI |
| **E - Output** | Work Order PDF generation |

### FR Category to Architecture Mapping (Phase 2)

| PRD Category | Backend Module | Frontend Feature | Database Tables |
|--------------|----------------|------------------|-----------------|
| Person Management (FR1-5) | Persons | (shared) | Persons |
| Vendor Management (FR6-14) | Vendors | features/vendors | Vendors, VendorTradeTags, VendorTradeTagAssignments |
| Work Order Management (FR15-28) | WorkOrders | features/work-orders | WorkOrders, WorkOrderTags, WorkOrderTagAssignments |
| Work Order-Expense Integration (FR29-37) | WorkOrders, Expenses | features/work-orders, features/expenses | Expenses (WorkOrderId FK) |
| Taxonomy Management (FR38-41) | Categories, TradeTags | shared/components | ExpenseCategories (ParentId), CategoryTradeTagMappings |
| Notes & Attachments (FR42-47) | Notes, Photos | features/work-orders | Notes, WorkOrderPhotos |
| Document Generation (FR48-51) | Reports | features/work-orders | (PDF generation) |

---

_Generated by BMAD Architecture Workflow_
_Phase 1: 2025-11-29_
_Phase 2: 2026-01-08_
_For: Dave_
