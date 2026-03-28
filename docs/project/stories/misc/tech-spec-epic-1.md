# Epic Technical Specification: Foundation

Date: 2025-11-29
Author: Dave
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the foundational infrastructure for Property Manager, a web application that transforms paper-based rental property expense tracking into organized, tax-ready Schedule E reports. This epic delivers the complete technical foundation including project structure, database schema, authentication system, and CI/CD pipeline that all subsequent features build upon.

The primary goal is to get the application live and accessible with secure user authentication. After Epic 1 completion, users can register an account, verify their email, log in securely, and access a protected application shell with navigation. The "first gig" milestone ensures every subsequent epic ships to production incrementally.

## Objectives and Scope

**In Scope:**
- Monorepo project structure with Clean Architecture backend (.NET 10) and feature-based Angular 21 frontend
- PostgreSQL database with EF Core migrations, multi-tenant schema design, and soft delete support
- Complete authentication flow: registration, email verification, JWT-based login, logout, password reset
- Application shell with dark sidebar navigation (desktop) and bottom tab bar (mobile)
- CI/CD pipeline with GitHub Actions and automated deployment to Render
- Forest Green themed UI using Angular Material with custom theming

**Out of Scope:**
- Property CRUD operations (Epic 2)
- Expense/Income tracking (Epics 3-4)
- Receipt capture and storage (Epic 5)
- Tax report generation (Epic 6)
- Multi-user account sharing (post-MVP)
- OAuth/social login providers

## System Architecture Alignment

**Architecture Pattern:** Clean Architecture with CQRS/MediatR

The Foundation epic implements the core architectural layers defined in the Architecture document:

| Layer | Epic 1 Implementation |
|-------|----------------------|
| **Domain** | Base entity definitions, audit fields (CreatedAt, UpdatedAt, DeletedAt), Account/User entities |
| **Application** | Common behaviors (ValidationBehavior, LoggingBehavior), ICurrentUser interface |
| **Infrastructure** | AppDbContext, EF Core configurations, ASP.NET Core Identity integration |
| **API** | AuthController, global exception middleware, Program.cs configuration |

**Key Components Referenced:**
- `PropertyManager.Domain/Entities/Account.cs`, `User.cs`
- `PropertyManager.Application/Common/Interfaces/ICurrentUser.cs`
- `PropertyManager.Infrastructure/Identity/CurrentUserService.cs`
- `PropertyManager.Api/Controllers/AuthController.cs`
- `PropertyManager.Api/Middleware/ExceptionHandlingMiddleware.cs`

**Constraints from Architecture:**
- All tenant data filtered by AccountId using EF Core global query filters
- JWT stored in HttpOnly cookie (not localStorage) for XSS protection
- Stateless API design for future horizontal scaling
- Database migrations run automatically on production startup

## Detailed Design

### Services and Modules

| Module | Responsibility | Layer | Key Files |
|--------|---------------|-------|-----------|
| **Identity** | User registration, authentication, password management | Infrastructure | `CurrentUserService.cs`, Identity configuration |
| **Auth** | JWT token generation, validation, refresh token management | API/Infrastructure | `AuthController.cs`, JWT middleware |
| **Database** | EF Core context, migrations, tenant filtering | Infrastructure | `AppDbContext.cs`, entity configurations |
| **Email** | Verification emails, password reset emails | Infrastructure | `IEmailService.cs`, SMTP/SendGrid implementation |
| **Core (Frontend)** | Auth service, guards, interceptors | Angular core/ | `auth.service.ts`, `auth.guard.ts`, `auth.interceptor.ts` |
| **Shell (Frontend)** | Navigation, layout components | Angular app/ | `app.component.ts`, sidenav, bottom-nav |

**Backend Service Flow:**
```
AuthController → MediatR Command/Query → Handler → Repository/Identity → Database
```

**Frontend Service Flow:**
```
Component → AuthService → HTTP Client (with interceptor) → API → Response → State Update
```

### Data Models and Contracts

**Core Entities (Domain Layer):**

```csharp
// Account.cs - Tenant boundary
public class Account
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation
    public ICollection<User> Users { get; set; } = new List<User>();
}

// User.cs - Identity + Account link
public class User
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner"; // Owner | Contributor
    public bool EmailVerified { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public Account Account { get; set; } = null!;
}
```

**Database Schema (PostgreSQL):**

```sql
-- Accounts table
CREATE TABLE "Accounts" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" VARCHAR(255) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table (extends ASP.NET Identity)
CREATE TABLE "Users" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "AccountId" UUID NOT NULL REFERENCES "Accounts"("Id"),
    "Email" VARCHAR(255) NOT NULL UNIQUE,
    "NormalizedEmail" VARCHAR(255) NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "Role" VARCHAR(50) NOT NULL DEFAULT 'Owner',
    "EmailConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
    "SecurityStamp" TEXT,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "IX_Users_AccountId" ON "Users"("AccountId");
CREATE INDEX "IX_Users_Email" ON "Users"("Email");

-- Expense Categories (seed data - global, no AccountId)
CREATE TABLE "ExpenseCategories" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" VARCHAR(100) NOT NULL,
    "ScheduleELine" VARCHAR(50),
    "SortOrder" INT NOT NULL
);
```

**Seed Data - Expense Categories:**

| Name | Schedule E Line | Sort Order |
|------|-----------------|------------|
| Advertising | Line 5 | 1 |
| Auto and Travel | Line 6 | 2 |
| Cleaning and Maintenance | Line 7 | 3 |
| Commissions | Line 8 | 4 |
| Insurance | Line 9 | 5 |
| Legal and Professional Fees | Line 10 | 6 |
| Management Fees | Line 11 | 7 |
| Mortgage Interest | Line 12 | 8 |
| Other Interest | Line 13 | 9 |
| Repairs | Line 14 | 10 |
| Supplies | Line 15 | 11 |
| Taxes | Line 16 | 12 |
| Utilities | Line 17 | 13 |
| Depreciation | Line 18 | 14 |
| Other | Line 19 | 15 |

### APIs and Interfaces

**Authentication Endpoints:**

| Method | Endpoint | Request | Response | Description |
|--------|----------|---------|----------|-------------|
| POST | `/api/v1/auth/register` | `{ email, password, name }` | `{ userId }` | Create account + owner user |
| POST | `/api/v1/auth/verify-email` | `{ token }` | 204 No Content | Confirm email address |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ accessToken, expiresIn }` + HttpOnly cookie | Authenticate user |
| POST | `/api/v1/auth/refresh` | (cookie) | `{ accessToken, expiresIn }` | Refresh JWT token |
| POST | `/api/v1/auth/logout` | (cookie) | 204 No Content | Invalidate session |
| POST | `/api/v1/auth/forgot-password` | `{ email }` | 204 No Content | Send reset email |
| POST | `/api/v1/auth/reset-password` | `{ token, newPassword }` | 204 No Content | Reset password |
| GET | `/api/v1/auth/me` | (JWT) | `{ userId, email, accountId, role }` | Get current user |

**Request/Response Examples:**

```json
// POST /api/v1/auth/register
Request:
{
  "email": "user@example.com",
  "password": "SecureP@ss1",
  "name": "My Properties"
}

Response (201 Created):
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}

// POST /api/v1/auth/login
Request:
{
  "email": "user@example.com",
  "password": "SecureP@ss1"
}

Response (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
+ Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict

// Error Response (400 Bad Request)
{
  "type": "https://propertymanager.app/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "password": ["Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character"]
  },
  "traceId": "00-abc123..."
}
```

**Health Check Endpoint:**

| Method | Endpoint | Response | Description |
|--------|----------|----------|-------------|
| GET | `/api/v1/health` | `{ status: "healthy", version: "1.0.0" }` | Application health |

### Workflows and Sequencing

**Registration Flow:**

```
User                    Frontend                 API                      Database/Email
  │                        │                      │                           │
  ├─ Enter email/pass ────►│                      │                           │
  │                        ├─ POST /register ────►│                           │
  │                        │                      ├─ Validate request         │
  │                        │                      ├─ Check email unique ─────►│
  │                        │                      ├─ Create Account ─────────►│
  │                        │                      ├─ Create User ────────────►│
  │                        │                      ├─ Generate verify token    │
  │                        │                      ├─ Send verification email ►│
  │                        │◄─ 201 { userId } ────┤                           │
  │◄─ "Check your email" ──┤                      │                           │
  │                        │                      │                           │
  ├─ Click email link ────►│                      │                           │
  │                        ├─ POST /verify-email ►│                           │
  │                        │                      ├─ Validate token           │
  │                        │                      ├─ Mark email verified ────►│
  │                        │◄─ 204 ───────────────┤                           │
  │◄─ Redirect to login ───┤                      │                           │
```

**Login Flow:**

```
User                    Frontend                 API                      Database
  │                        │                      │                           │
  ├─ Enter credentials ───►│                      │                           │
  │                        ├─ POST /login ───────►│                           │
  │                        │                      ├─ Validate credentials ───►│
  │                        │                      ├─ Generate JWT             │
  │                        │                      ├─ Generate refresh token   │
  │                        │                      ├─ Store refresh token ────►│
  │                        │◄─ 200 + Set-Cookie ──┤                           │
  │                        ├─ Store JWT in memory │                           │
  │                        ├─ Navigate to /dashboard                          │
  │◄─ Dashboard shown ─────┤                      │                           │
```

**Token Refresh Flow:**

```
Frontend                           API                           Database
  │                                 │                               │
  ├─ API call with expired JWT ────►│                               │
  │◄─ 401 Unauthorized ─────────────┤                               │
  ├─ POST /refresh (cookie) ───────►│                               │
  │                                 ├─ Validate refresh token ─────►│
  │                                 ├─ Generate new JWT              │
  │                                 ├─ Rotate refresh token ────────►│
  │◄─ 200 { accessToken } ──────────┤                               │
  ├─ Retry original request ───────►│                               │
  │◄─ 200 (success) ────────────────┤                               │
```

**Password Reset Flow:**

```
User                    Frontend                 API                      Email
  │                        │                      │                         │
  ├─ Click "Forgot" ──────►│                      │                         │
  │                        ├─ POST /forgot ──────►│                         │
  │                        │                      ├─ Generate reset token   │
  │                        │                      ├─ Send reset email ─────►│
  │                        │◄─ 204 ───────────────┤                         │
  │◄─ "Check email" ───────┤                      │                         │
  │                        │                      │                         │
  ├─ Click reset link ────►│                      │                         │
  │                        ├─ Display reset form  │                         │
  ├─ Enter new password ──►│                      │                         │
  │                        ├─ POST /reset ───────►│                         │
  │                        │                      ├─ Validate token         │
  │                        │                      ├─ Update password        │
  │                        │                      ├─ Invalidate all tokens  │
  │                        │◄─ 204 ───────────────┤                         │
  │◄─ Redirect to login ───┤                      │                         │
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Source | Epic 1 Implementation |
|-------------|--------|--------|----------------------|
| **NFR1** | Pages load < 3 seconds | PRD | Angular lazy loading, optimized bundle size |
| **NFR3** | PDF generation < 10s/property | PRD | N/A for Epic 1 (future) |
| API Response Time | < 500ms for auth endpoints | Architecture | Async handlers, connection pooling |
| Database Queries | < 100ms for simple lookups | Architecture | Indexed columns (Email, AccountId) |

**Epic 1 Specific Targets:**
- Login endpoint: < 300ms (password hashing is CPU-bound)
- Token refresh: < 100ms
- Registration: < 1s (includes email send)
- Initial page load (login page): < 2s on 3G connection

**Implementation Notes:**
- Use `async/await` throughout for non-blocking I/O
- EF Core connection pooling configured via `Npgsql`
- Angular production build with AOT compilation and tree-shaking
- Lazy load feature modules (not applicable until Epic 2+)

### Security

| Requirement | Source | Epic 1 Implementation |
|-------------|--------|----------------------|
| **NFR4** | HTTPS everywhere (TLS 1.2+) | Render enforces HTTPS, HSTS headers |
| **NFR5** | Passwords hashed (bcrypt/Argon2) | ASP.NET Core Identity uses PBKDF2 with 100k iterations |
| **NFR6** | JWT with appropriate expiration | 60-minute access token, 7-day refresh token |
| **NFR7** | API requires authentication | `[Authorize]` attribute on all controllers except auth |
| **NFR10** | Credentials in env vars | `ConnectionStrings__Default`, `Jwt__Secret` in Render env |
| **NFR12** | Input validation | FluentValidation on all request DTOs |
| **NFR13** | CORS restricted | Allow only `https://property-manager.app` origin |

**JWT Configuration:**
```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuration["Jwt:Secret"]!)),
            ClockSkew = TimeSpan.Zero
        };
    });
```

**Password Requirements (FluentValidation):**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Security Headers (Middleware):**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Reliability/Availability

| Requirement | Target | Source | Epic 1 Implementation |
|-------------|--------|--------|----------------------|
| **NFR22** | 99% uptime | PRD | Render managed hosting with auto-restart |
| **NFR23** | Graceful error handling | PRD | Global exception middleware, Problem Details |
| **NFR18** | Daily database backups | PRD | Render PostgreSQL automated backups |
| **NFR19** | 7-day point-in-time recovery | PRD | Render PostgreSQL PITR |

**Error Handling Strategy:**
```csharp
// Global exception handler returns RFC 7807 Problem Details
app.UseExceptionHandler(handler =>
{
    handler.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        var (statusCode, title) = exception switch
        {
            ValidationException => (400, "Validation failed"),
            UnauthorizedAccessException => (401, "Unauthorized"),
            NotFoundException => (404, "Resource not found"),
            _ => (500, "An unexpected error occurred")
        };

        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Type = $"https://propertymanager.app/errors/{statusCode}",
            Title = title,
            Status = statusCode,
            Detail = exception?.Message,
            Extensions = { ["traceId"] = Activity.Current?.Id }
        });
    });
});
```

**Health Check Endpoint:**
- `/api/v1/health` - Returns 200 if API is responsive
- `/api/v1/health/ready` - Checks database connectivity
- Used by Render for deployment health verification

### Observability

| Requirement | Source | Epic 1 Implementation |
|-------------|--------|----------------------|
| **NFR27** | Sufficient logging for diagnosis | PRD | Serilog structured logging |

**Logging Configuration (Serilog):**
```csharp
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "PropertyManager")
    .WriteTo.Console(new JsonFormatter())
    .CreateLogger();
```

**Log Output Format (JSON):**
```json
{
  "@t": "2025-11-29T10:30:00.000Z",
  "@l": "Information",
  "@m": "User registered",
  "UserId": "550e8400-e29b-41d4-a716-446655440000",
  "Email": "user@example.com",
  "TraceId": "00-abc123...",
  "Application": "PropertyManager"
}
```

**Key Events to Log:**
| Event | Level | Properties |
|-------|-------|------------|
| User registered | Information | UserId, Email |
| User logged in | Information | UserId, Email |
| Login failed | Warning | Email, Reason |
| Password reset requested | Information | Email |
| Token refresh | Debug | UserId |
| Unhandled exception | Error | Exception, TraceId |

**Request Logging (Middleware):**
- Log all requests with: Method, Path, StatusCode, Duration, TraceId
- Exclude sensitive paths from body logging (`/auth/login`, `/auth/register`)
- Correlate logs via `TraceId` header propagation

## Dependencies and Integrations

### Backend Dependencies (.NET 10)

| Package | Version | Purpose |
|---------|---------|---------|
| **Microsoft.AspNetCore.Authentication.JwtBearer** | 10.x | JWT authentication middleware |
| **Microsoft.AspNetCore.Identity.EntityFrameworkCore** | 10.x | Identity with EF Core integration |
| **Microsoft.EntityFrameworkCore** | 10.x | ORM for database access |
| **Npgsql.EntityFrameworkCore.PostgreSQL** | 10.x | PostgreSQL provider for EF Core |
| **MediatR** | 12.x | CQRS command/query handling |
| **FluentValidation.AspNetCore** | 11.x | Request validation |
| **Serilog.AspNetCore** | 8.x | Structured logging |
| **Serilog.Sinks.Console** | 5.x | Console output sink |
| **NSwag.AspNetCore** | 14.x | OpenAPI/Swagger generation |
| **Swashbuckle.AspNetCore** | 6.x | Swagger UI |

**Backend Project References:**
```xml
<!-- PropertyManager.Api.csproj -->
<ItemGroup>
  <ProjectReference Include="..\PropertyManager.Application\PropertyManager.Application.csproj" />
  <ProjectReference Include="..\PropertyManager.Infrastructure\PropertyManager.Infrastructure.csproj" />
</ItemGroup>

<!-- PropertyManager.Application.csproj -->
<ItemGroup>
  <ProjectReference Include="..\PropertyManager.Domain\PropertyManager.Domain.csproj" />
</ItemGroup>

<!-- PropertyManager.Infrastructure.csproj -->
<ItemGroup>
  <ProjectReference Include="..\PropertyManager.Application\PropertyManager.Application.csproj" />
</ItemGroup>
```

### Frontend Dependencies (Angular 21)

| Package | Version | Purpose |
|---------|---------|---------|
| **@angular/core** | 21.x | Angular framework |
| **@angular/material** | 21.x | Material Design components |
| **@angular/cdk** | 21.x | Component Dev Kit |
| **@ngrx/signals** | latest | Signal-based state management |
| **rxjs** | 7.x | Reactive extensions |

**Dev Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| **vitest** | latest | Unit test runner |
| **@testing-library/angular** | latest | Component testing utilities |
| **playwright** | latest | E2E testing |
| **typescript** | 5.x | TypeScript compiler |

### External Services

| Service | Purpose | Epic 1 Usage |
|---------|---------|--------------|
| **Render** | Cloud hosting | API + Frontend + PostgreSQL deployment |
| **PostgreSQL** | Database | Render managed PostgreSQL 16 |
| **SendGrid / SMTP** | Email delivery | Verification & password reset emails |
| **GitHub** | Source control & CI | Repository + GitHub Actions |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ConnectionStrings__Default` | PostgreSQL connection string | Yes |
| `Jwt__Secret` | 256-bit secret for JWT signing | Yes |
| `Jwt__Issuer` | JWT issuer (e.g., `https://api.property-manager.app`) | Yes |
| `Jwt__Audience` | JWT audience (e.g., `https://property-manager.app`) | Yes |
| `Jwt__ExpiryMinutes` | Access token lifetime (default: 60) | No |
| `Email__Provider` | Email provider (`SendGrid` or `Smtp`) | Yes |
| `Email__ApiKey` | SendGrid API key (if using SendGrid) | Conditional |
| `Email__SmtpHost` | SMTP server host (if using SMTP) | Conditional |
| `Email__SmtpPort` | SMTP server port | Conditional |
| `Email__FromAddress` | Sender email address | Yes |
| `Email__FromName` | Sender display name | No |
| `ASPNETCORE_ENVIRONMENT` | Environment (`Development`, `Production`) | Yes |

### Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        Property Manager                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Angular   │ ───► │   .NET API  │ ───► │ PostgreSQL  │     │
│  │   Frontend  │      │             │      │  (Render)   │     │
│  │  (Render)   │      │  (Render)   │      │             │     │
│  └─────────────┘      └──────┬──────┘      └─────────────┘     │
│                              │                                   │
│                              ▼                                   │
│                       ┌─────────────┐                           │
│                       │  SendGrid   │                           │
│                       │   / SMTP    │                           │
│                       └─────────────┘                           │
│                                                                  │
│  ┌─────────────┐                                                │
│  │   GitHub    │ ──── CI/CD Pipeline ────► Render Deploy       │
│  │   Actions   │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Docker Configuration

**Backend Dockerfile:**
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["backend/src/", "."]
RUN dotnet restore "PropertyManager.Api/PropertyManager.Api.csproj"
RUN dotnet publish "PropertyManager.Api/PropertyManager.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "PropertyManager.Api.dll"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/property-manager/browser /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

**docker-compose.yml (Local Development):**
```yaml
services:
  api:
    build: ./backend
    ports:
      - "5000:8080"
    environment:
      - ConnectionStrings__Default=Host=db;Database=propertymanager;Username=postgres;Password=localdev
      - Jwt__Secret=local-development-secret-key-min-32-chars
      - Jwt__Issuer=http://localhost:5000
      - Jwt__Audience=http://localhost:4200
      - Email__Provider=Smtp
      - Email__SmtpHost=mailhog
      - Email__SmtpPort=1025
      - Email__FromAddress=noreply@localhost
    depends_on:
      - db
      - mailhog

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
    ports:
      - "5432:5432"

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

volumes:
  pgdata:
```

## Acceptance Criteria (Authoritative)

### AC1: Project Infrastructure
- [ ] **AC1.1**: Running `docker compose up` starts PostgreSQL on port 5432 and is accessible
- [ ] **AC1.2**: Backend follows 4-layer Clean Architecture (Domain, Application, Infrastructure, Api)
- [ ] **AC1.3**: Frontend uses feature-based structure (core/, shared/, features/)
- [ ] **AC1.4**: `dotnet build` succeeds with zero errors
- [ ] **AC1.5**: `ng build` succeeds with zero errors
- [ ] **AC1.6**: NSwag generates TypeScript API client from .NET controllers

### AC2: Database Schema
- [ ] **AC2.1**: `dotnet ef database update` creates Accounts, Users, ExpenseCategories tables
- [ ] **AC2.2**: ExpenseCategories seeded with 15 IRS Schedule E line items
- [ ] **AC2.3**: Global query filters enforce soft delete (`DeletedAt == null`)
- [ ] **AC2.4**: All tables use UUID primary keys

### AC3: User Registration (FR1, FR2)
- [ ] **AC3.1**: POST `/api/v1/auth/register` creates Account and User with role "Owner"
- [ ] **AC3.2**: Password validated (8+ chars, uppercase, number, special char)
- [ ] **AC3.3**: Duplicate email returns 400 "An account with this email already exists"
- [ ] **AC3.4**: Verification email sent with token valid for 24 hours
- [ ] **AC3.5**: POST `/api/v1/auth/verify-email` marks account as verified
- [ ] **AC3.6**: Expired/invalid verification token returns appropriate error

### AC4: User Login (FR3, FR6)
- [ ] **AC4.1**: POST `/api/v1/auth/login` returns JWT access token on valid credentials
- [ ] **AC4.2**: Refresh token set in HttpOnly cookie with Secure and SameSite flags
- [ ] **AC4.3**: Invalid credentials return 401 "Invalid email or password"
- [ ] **AC4.4**: Unverified email returns 401 "Please verify your email"
- [ ] **AC4.5**: JWT contains userId, accountId, role, exp claims
- [ ] **AC4.6**: Session persists across browser tabs (refresh token works)
- [ ] **AC4.7**: Multiple concurrent sessions supported (phone + desktop)

### AC5: User Logout (FR4)
- [ ] **AC5.1**: POST `/api/v1/auth/logout` clears refresh token cookie
- [ ] **AC5.2**: Refresh token invalidated server-side
- [ ] **AC5.3**: Subsequent API calls return 401 Unauthorized

### AC6: Password Reset (FR5)
- [ ] **AC6.1**: POST `/api/v1/auth/forgot-password` sends reset email (always returns 204)
- [ ] **AC6.2**: Reset token valid for 1 hour
- [ ] **AC6.3**: POST `/api/v1/auth/reset-password` updates password on valid token
- [ ] **AC6.4**: All existing sessions invalidated after password reset
- [ ] **AC6.5**: Expired/used reset token returns appropriate error

### AC7: Application Shell
- [ ] **AC7.1**: Dark sidebar navigation visible on desktop (≥1024px)
- [ ] **AC7.2**: Navigation items: Dashboard, Properties, Expenses, Income, Receipts, Reports, Settings
- [ ] **AC7.3**: User email/name displayed in sidebar footer with logout option
- [ ] **AC7.4**: Bottom tab navigation on mobile (<768px)
- [ ] **AC7.5**: Forest Green theme applied (primary: #66BB6A)
- [ ] **AC7.6**: Auth guard redirects unauthenticated users to /login

### AC8: CI/CD Pipeline
- [ ] **AC8.1**: PR triggers CI: `dotnet build`, `dotnet test`, `ng build`, `ng test`
- [ ] **AC8.2**: Docker images build successfully in CI
- [ ] **AC8.3**: Merge to main triggers deployment to Render
- [ ] **AC8.4**: EF Core migrations run automatically on startup
- [ ] **AC8.5**: Health check endpoint returns 200 OK
- [ ] **AC8.6**: Failed deployments trigger rollback

### AC9: Data Persistence (FR55, FR56)
- [ ] **AC9.1**: All data changes persisted immediately (no manual save)
- [ ] **AC9.2**: Soft delete sets DeletedAt timestamp
- [ ] **AC9.3**: Soft-deleted records excluded from queries via global filter

## Traceability Mapping

| AC | FR | Spec Section | Component/API | Test Idea |
|----|----|--------------|--------------| ----------|
| AC1.1-AC1.6 | - | Detailed Design | Project structure | Integration: `docker compose up` succeeds |
| AC2.1-AC2.4 | FR55, FR56 | Data Models | `AppDbContext`, migrations | Integration: Verify table creation, seed data |
| AC3.1 | FR1 | APIs/Workflows | `POST /auth/register` | Unit: RegisterHandler creates Account+User |
| AC3.2 | FR1 | Security | FluentValidation | Unit: Password validation rules |
| AC3.3 | FR1 | APIs | `POST /auth/register` | Integration: Duplicate email returns 400 |
| AC3.4-AC3.6 | FR2 | Workflows | Email service, verify endpoint | Integration: Email sent, token validation |
| AC4.1-AC4.3 | FR3 | APIs/Security | `POST /auth/login` | Unit: LoginHandler, Integration: JWT flow |
| AC4.4 | FR3 | APIs | `POST /auth/login` | Integration: Unverified user blocked |
| AC4.5 | FR3 | Security | JWT configuration | Unit: Token contains required claims |
| AC4.6-AC4.7 | FR6 | Workflows | Refresh token flow | E2E: Multi-tab, multi-device sessions |
| AC5.1-AC5.3 | FR4 | APIs | `POST /auth/logout` | Integration: Cookie cleared, token invalid |
| AC6.1-AC6.5 | FR5 | APIs/Workflows | Password reset endpoints | Integration: Full reset flow |
| AC7.1-AC7.3 | - | UX Design | Sidebar, navigation | E2E: Desktop layout verification |
| AC7.4 | - | UX Design | Bottom nav | E2E: Mobile layout verification |
| AC7.5 | - | Visual Foundation | Theme | Visual: Color matches spec |
| AC7.6 | - | Security | AuthGuard | E2E: Redirect to login |
| AC8.1-AC8.6 | - | CI/CD | GitHub Actions, Render | Manual: Pipeline verification |
| AC9.1-AC9.3 | FR55, FR56 | Data Models | EF Core global filters | Integration: Soft delete behavior |

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| **R1** | Email delivery failures block registration | High | Medium | Use reliable provider (SendGrid), implement retry logic, provide manual verification fallback |
| **R2** | JWT secret exposed in logs or errors | High | Low | Never log secrets, use structured logging with sanitization, security headers |
| **R3** | Render cold starts cause slow initial loads | Medium | Medium | Configure minimum instances, implement health check pre-warming |
| **R4** | EF Core migrations fail on production | High | Low | Test migrations locally with production-like data, implement rollback strategy |
| **R5** | Password hashing performance impacts login | Low | Medium | PBKDF2 with 100k iterations is ~300ms; acceptable for auth endpoints |
| **R6** | CORS misconfiguration blocks frontend | Medium | Medium | Test CORS in staging environment before production |

### Assumptions

| ID | Assumption | Validation |
|----|------------|------------|
| **A1** | Single user (Dave's wife) for MVP - no multi-user complexity | Confirmed in PRD |
| **A2** | Render provides sufficient performance for expected load | Monitor after deployment |
| **A3** | SendGrid free tier sufficient for verification emails | ~100 emails/day limit adequate for MVP |
| **A4** | Users have modern browsers (Chrome, Safari) | PRD specifies evergreen browsers only |
| **A5** | Mobile Safari supports camera access for future receipt capture | Validated - standard Web API |
| **A6** | .NET 10 and Angular 21 stable releases available | Architecture specifies LTS versions |

### Open Questions

| ID | Question | Owner | Status | Resolution |
|----|----------|-------|--------|------------|
| **Q1** | Which email provider to use: SendGrid vs AWS SES vs SMTP? | Dave | **Open** | Recommend SendGrid for simplicity; can switch later |
| **Q2** | Custom domain for production (property-manager.app)? | Dave | **Open** | Needed for professional appearance, CORS, cookies |
| **Q3** | Should refresh tokens be stored in database or Redis? | Dev | **Resolved** | Database for MVP simplicity; Redis if scaling needed |
| **Q4** | Email templates: plain text or HTML? | Dave | **Open** | Start with simple HTML templates |
| **Q5** | Rate limiting on auth endpoints? | Dev | **Deferred** | Implement in Epic 2 or later; low risk for single user |

## Test Strategy Summary

### Test Pyramid

| Level | Framework | Coverage Target | Epic 1 Focus |
|-------|-----------|-----------------|--------------|
| **Unit** | xUnit (.NET), Vitest (Angular) | 80% business logic | Handlers, validators, services |
| **Integration** | xUnit + Testcontainers | Critical paths | Auth endpoints, database operations |
| **Component** | Vitest + Testing Library | UI components | Forms, navigation, auth guards |
| **E2E** | Playwright | Happy paths | Registration → Login → Dashboard |
| **Manual** | Postman + Checklists | Verification | API testing, smoke tests |

### Unit Tests

**Backend (.NET with xUnit):**
```csharp
// Example: RegisterCommandHandlerTests.cs
public class RegisterCommandHandlerTests
{
    [Fact]
    public async Task Handle_ValidRequest_CreatesAccountAndUser()
    {
        // Arrange
        var command = new RegisterCommand("test@example.com", "SecureP@ss1", "Test Account");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        _dbContext.Accounts.Should().HaveCount(1);
        _dbContext.Users.Should().HaveCount(1);
    }

    [Fact]
    public async Task Handle_DuplicateEmail_ThrowsValidationException()
    {
        // Arrange - existing user
        // Act & Assert
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Theory]
    [InlineData("short")]           // Too short
    [InlineData("nouppercase1!")]   // No uppercase
    [InlineData("NOLOWERCASE1!")]   // No lowercase
    [InlineData("NoNumber!")]       // No number
    [InlineData("NoSpecial1")]      // No special char
    public async Task Handle_WeakPassword_ThrowsValidationException(string password)
    {
        // Test password validation rules
    }
}
```

**Frontend (Angular with Vitest):**
```typescript
// Example: auth.service.spec.ts
describe('AuthService', () => {
  it('should store token after successful login', async () => {
    const mockResponse = { accessToken: 'jwt-token', expiresIn: 3600 };
    httpMock.expectOne('/api/v1/auth/login').flush(mockResponse);

    await service.login('test@example.com', 'password');

    expect(service.isAuthenticated()).toBe(true);
  });

  it('should clear token on logout', async () => {
    httpMock.expectOne('/api/v1/auth/logout').flush(null);

    await service.logout();

    expect(service.isAuthenticated()).toBe(false);
  });
});
```

### Integration Tests

**API Integration Tests (xUnit + Testcontainers):**
```csharp
public class AuthControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Register_ValidRequest_Returns201()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = "test@example.com",
            password = "SecureP@ss1",
            name = "Test"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsJwt()
    {
        // Setup: Register user first
        // Act: Login
        // Assert: JWT returned, cookie set
    }

    [Fact]
    public async Task ProtectedEndpoint_NoToken_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
```

### E2E Tests (Playwright)

```typescript
// e2e/auth.spec.ts
test.describe('Authentication', () => {
  test('user can register and login', async ({ page }) => {
    // Register
    await page.goto('/register');
    await page.fill('[data-testid="email"]', 'newuser@example.com');
    await page.fill('[data-testid="password"]', 'SecureP@ss1');
    await page.fill('[data-testid="name"]', 'Test Account');
    await page.click('[data-testid="submit"]');

    await expect(page.locator('text=Check your email')).toBeVisible();

    // Simulate email verification (test helper)
    await verifyEmail('newuser@example.com');

    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'newuser@example.com');
    await page.fill('[data-testid="password"]', 'SecureP@ss1');
    await page.click('[data-testid="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="submit"]');

    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });
});
```

### Manual Smoke Test Checklist

```markdown
## Epic 1 Smoke Test: Foundation

### Environment Setup
- [ ] `docker compose up` starts all services
- [ ] API accessible at http://localhost:5000
- [ ] Frontend accessible at http://localhost:4200
- [ ] Swagger UI at http://localhost:5000/swagger
- [ ] MailHog UI at http://localhost:8025

### Registration Flow
- [ ] Navigate to /register
- [ ] Enter valid email, password, name
- [ ] Submit - see "Check your email" message
- [ ] Check MailHog - verification email received
- [ ] Click verification link - redirects to login
- [ ] Try registering same email - see duplicate error

### Login Flow
- [ ] Navigate to /login
- [ ] Enter valid credentials - redirects to dashboard
- [ ] Check sidebar navigation visible (desktop)
- [ ] Open new tab - still logged in
- [ ] Invalid credentials - see error message

### Logout Flow
- [ ] Click logout in sidebar
- [ ] Redirected to login
- [ ] Try accessing /dashboard - redirected to login

### Password Reset
- [ ] Click "Forgot Password" on login
- [ ] Enter email - see confirmation
- [ ] Check MailHog - reset email received
- [ ] Click reset link - enter new password
- [ ] Login with new password - success

### Mobile Responsive
- [ ] Open DevTools, toggle mobile view
- [ ] Bottom navigation visible
- [ ] Sidebar hidden
- [ ] Forms usable on mobile

### Database Verification (psql or pgAdmin)
- [ ] Accounts table has entry
- [ ] Users table has entry with correct AccountId
- [ ] ExpenseCategories has 15 rows
```

### Postman Collection Structure

```
PropertyManager/
├── Auth/
│   ├── Register
│   ├── Verify Email
│   ├── Login
│   ├── Refresh Token
│   ├── Logout
│   ├── Forgot Password
│   ├── Reset Password
│   └── Get Current User
├── Health/
│   ├── Health Check
│   └── Ready Check
└── Environments/
    ├── Local
    └── Production
```

### Definition of Done (Epic 1)

Each story PR must include:
- [ ] Code implementation complete
- [ ] Unit tests passing (≥80% coverage for new code)
- [ ] Integration tests for API endpoints
- [ ] Postman requests added to collection
- [ ] Smoke test checklist completed
- [ ] No TypeScript/C# compiler warnings
- [ ] PR approved by reviewer
- [ ] Deployed to staging (if available) or production
