# Property Manager - Gemini Context

This file documents the context, architecture, and conventions for the Property Manager project. Use this as a reference for all future tasks.

## 1. Project Overview
Property Manager is a full-stack web application for tracking rental property expenses and generating tax-ready Schedule E reports.
- **Type:** Full-stack Web Application
- **State:** Active Development (Migration from Node.js/Vue legacy project)

## 2. Technology Stack

### Backend
- **Framework:** .NET 10 (ASP.NET Core)
- **Architecture:** Clean Architecture + CQRS (MediatR)
- **Database:** PostgreSQL 16 (EF Core 10)
- **Validation:** FluentValidation
- **Authentication:** ASP.NET Core Identity (JWT)
- **API Documentation:** Swagger/OpenAPI

### Frontend
- **Framework:** Angular 20+ (CLI)
- **State Management:** @ngrx/signals
- **UI Component Library:** Angular Material
- **Testing:** Vitest (Unit), Playwright (E2E)
- **API Client:** NSwag (Auto-generated from Swagger)

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Email:** MailHog (Local development)
- **CI/CD:** GitHub Actions

## 3. Directory Structure & Key Files

### Root
- `docker-compose.yml`: Main infrastructure (PostgreSQL, MailHog).
- `GEMINI.md`: This file.
- `CLAUDE.md`: Context for Claude AI (useful for cross-reference).
- `README.md`: General project documentation.

### Backend (`/backend`)
- `src/PropertyManager.Domain/`: **Core Domain**. Entities, Value Objects, Interfaces. *No dependencies.*
- `src/PropertyManager.Application/`: **Business Logic**. CQRS Commands/Queries, Validators, DTOs. *Depends on Domain.*
- `src/PropertyManager.Infrastructure/`: **Implementation**. EF Core DbContext, Migrations, External Services. *Depends on Application.*
- `src/PropertyManager.Api/`: **Entry Point**. Controllers, Program.cs, Configuration. *Depends on Application & Infrastructure.*
- `PropertyManager.sln`: Solution file.

### Frontend (`/frontend`)
- `src/app/core/`: Singleton services, Interceptors, Guards, Auth logic.
- `src/app/features/`: Feature modules (Lazy loaded).
- `src/app/shared/`: Shared UI components, pipes, directives.
- `nswag.json`: Configuration for generating TypeScript API client.
- `proxy.conf.json`: Dev server proxy configuration.

## 4. Development Workflow & Commands

**ALWAYS** run commands from the project root unless specified.

### Setup & Infrastructure
```bash
# Start Database & MailHog
docker compose up -d db mailhog
```

### Backend Development
**Working Directory:** `/backend`

```bash
# Run API (Hot Reload)
dotnet run --project src/PropertyManager.Api

# Run Tests
dotnet test

# Create Migration
dotnet ef migrations add <MigrationName> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api

# Apply Migrations
dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api
```

### Frontend Development
**Working Directory:** `/frontend`

```bash
# Install Dependencies
npm install

# Run Development Server (http://localhost:4200)
ng serve

# Run Unit Tests
npm test

# Run E2E Tests (Requires Backend & DB running)
npm run test:e2e

# Generate API Client (Requires Backend running)
npm run generate-api
```

## 5. Coding Conventions

### General
- **Naming:** PascalCase for C# classes/methods. camelCase for TS variables/functions. kebab-case for Angular components/files.
- **Formatting:** Respect `.editorconfig` and `prettier` settings.

### Backend (Clean Architecture)
- **Dependency Rule:** Domain <- Application <- Infrastructure <- Api.
- **CQRS:** Every write operation is a `Command`. Every read operation is a `Query`.
- **Validation:** Use `AbstractValidator<T>` in the Application layer.
- **Controllers:** Thin controllers. Delegate immediately to `IMediator`.

### Frontend (Angular)
- **Signals:** Prefer Signals over RxJS for synchronous state. Use RxJS for asynchronous streams/effects.
- **Components:** Standalone components preferred.
- **Smart/Dumb:** Container components (Smart) handle data fetching/state. Presentational components (Dumb) handle rendering/events.

## 6. Common URLs (Local)
- **Web App:** http://localhost:4200
- **API:** http://localhost:5292 (or 5000 depending on launch profile)
- **Swagger:** http://localhost:5292/swagger
- **MailHog:** http://localhost:8025
