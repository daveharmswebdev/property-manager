# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Property Manager is a web application for tracking rental property expenses and generating tax-ready Schedule E reports. This is a rebuild using modern .NET/Angular stack (the `docs/previous_project/` folder contains documentation from an earlier Node.js/Vue implementation).

## Tech Stack

- **Frontend:** Angular 20+ with @ngrx/signals, Angular Material, SCSS, Vitest
- **Backend:** .NET 10 with ASP.NET Core, Clean Architecture, MediatR (CQRS), FluentValidation
- **Database:** PostgreSQL 16 with EF Core 10
- **API Client:** NSwag for TypeScript client generation

## Development Commands

### Infrastructure
```bash
docker compose up -d db mailhog          # Start PostgreSQL and MailHog
```

### Backend (from /backend)
```bash
dotnet restore                           # Restore packages
dotnet build                             # Build solution
dotnet run --project src/PropertyManager.Api  # Run API (http://localhost:5292)
dotnet test                              # Run all tests
dotnet test --filter "FullyQualifiedName~TestClassName"  # Run specific test

# Database migrations
dotnet ef migrations add <Name> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api
dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api
```

### Frontend (from /frontend)
```bash
npm install                  # Install dependencies
ng serve                     # Run dev server (http://localhost:4200)
npm test                     # Run Vitest tests
npm run generate-api         # Generate TypeScript API client from swagger
```

## Architecture

### Backend Clean Architecture Layers

```
PropertyManager.Domain/       # Entities, Value Objects, Exceptions, Interfaces
PropertyManager.Application/  # Commands/Queries (MediatR handlers), Validators
PropertyManager.Infrastructure/  # EF Core DbContext, Identity, Email service
PropertyManager.Api/          # Controllers, middleware, Program.cs configuration
```

**Dependency Rule:** Dependencies point inward only. Domain has zero dependencies. Infrastructure implements interfaces defined in Domain/Application.

### Frontend Structure

```
src/app/
├── core/           # Auth service, API clients, global services
│   ├── auth/       # Authentication state and guards
│   └── services/   # Shared services
├── features/       # Feature modules (auth, dashboard, properties, etc.)
└── shared/         # Reusable components
```

### Key Patterns

- **CQRS with MediatR:** Commands and queries in Application layer, handlers registered via assembly scanning
- **FluentValidation:** Validators co-located with command/query definitions
- **ASP.NET Core Identity:** User management with JWT authentication
- **Angular Signals (@ngrx/signals):** State management in frontend

## Services

| Service | URL |
|---------|-----|
| Angular App | http://localhost:4200 |
| .NET API | http://localhost:5292 |
| Swagger UI | http://localhost:5292/swagger |
| MailHog (email testing) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

## Configuration

Backend configuration via environment variables (see `.env.example`):
- `ConnectionStrings__Default` - PostgreSQL connection string
- `Jwt__Secret`, `Jwt__Issuer`, `Jwt__Audience` - JWT settings
- `Email__SmtpHost`, `Email__SmtpPort` - Email configuration

Frontend API proxy configured in `proxy.conf.json` (proxies `/api` to backend).

## Test Accounts (Local Development)

| Email | Password | Notes |
|-------|----------|-------|
| claude@claude.com | 1@mClaude | Primary test account with 1 property (Test Property - Austin, TX) |

## E2E Testing Rules (Playwright)

**All E2E tests share a single database and test account (`claude@claude.com`).** Tests that create data (properties, expenses, vendors, etc.) pollute state for all subsequent tests. This is the #1 source of flaky E2E failures.

**NEVER assume seed-data counts.** A test like "given the user has exactly 1 property" will break because earlier specs (e.g., `expense-flow.spec.ts`) call `createPropertyAndGetId()` and leave those properties behind.

**Use `page.route()` to control what the component sees** when a test requires a specific data shape:
```typescript
// Intercept API to simulate single-property account
await page.route('*/**/api/v1/properties', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  await route.fulfill({ response, json: { items: json.items.slice(0, 1), totalCount: 1 } });
});
```

**Rate limiting is disabled in development** via `appsettings.Development.json` (`RateLimiting.Disabled: true`). CI also disables it via `RateLimiting__Disabled=true` env var. Without this, E2E tests hit 429s after ~5 tests due to the auth endpoint's 5-req/min sliding window limit.

**E2E tests run with 1 worker in CI** (`Running N tests using 1 worker`). Run locally with `--workers=1` to match CI behavior. Never use `npx vitest` directly for frontend tests (see memory notes).

## Project Skills (Slash Commands)

### Daily Development
- `/dev-story` — Execute next story (TDD, validation gates, sprint status)
- `/create-story` — Create story from epics with exhaustive context
- `/code-review` — Adversarial review (3-10 issues min, git cross-reference)
- `/create-atdd` — Generate failing acceptance tests
- `/sprint-status` — View sprint progress and next actions

### Planning (at epic/project boundaries)
- `/create-product-brief` — Collaborative product brief
- `/create-prd` — Step-by-step PRD creation
- `/create-architecture` — Architecture decision document
- `/create-ux` — UX design specification
- `/create-epics` — Break PRD into epics and stories

### Meta
- `/generate-context` — Regenerate project-context.md
- `/create-excalidraw` — Generate diagrams (flowcharts, wireframes, architecture, dataflow)
- `/orchestrate` — Chain skills (story-cycle, planning-cycle, test-first-cycle)

## Critical Tools (Use Proactively)

- **GitHub CLI (`gh`)** — The repo's PRs, actions, and commit history are institutional memory. Use `gh` proactively to gather context, investigate CI failures, and find existing patterns.
- **Playwright MCP** — Use the browser during frontend development for visual verification, not just E2E test runs. Navigate to pages and confirm UI behavior during implementation.
- **Ref MCP** — Look up documentation BEFORE writing code, not after hitting errors. Use `mcp__Ref__ref_search_documentation` to verify API signatures, configuration patterns, and library usage. The LLM's training data is ~1 year behind current package versions.

## Project Artifacts

Planning and implementation artifacts live in `docs/project/`:
- `project-context.md` — Critical implementation rules (read before coding)
- `prd.md` — Product requirements document
- `architecture.md` — Architecture decisions
- `epics.md` — Feature breakdown with BDD acceptance criteria
- `ux-design-specification.md` — UX patterns and design system
- `sprint-status.yaml` — Current sprint tracking
- `stories/` — Implementation story files (organized by epic)
