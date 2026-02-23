---
project_name: 'property-manager'
user_name: 'Dave'
date: '2026-02-23'
sections_completed: ['technology_stack', 'language_specific_rules', 'framework_specific_rules', 'testing_rules', 'code_quality_style', 'development_workflow', 'critical_dont_miss']
status: 'complete'
rule_count: 65
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Stack

| Technology | Version | Notes |
|---|---|---|
| .NET | 10 | LTS, `net10.0` TFM |
| ASP.NET Core | 10 | Web API with JWT Bearer auth |
| EF Core | 10.0.3 | PostgreSQL via Npgsql 10.0.0 |
| Angular | 21.x | ^21.1.5 in package.json |
| @ngrx/signals | 21.0.1 | Signal-based state management |
| Angular Material | 21.1.5 | UI component library |
| TypeScript | 5.9.2 | Strict mode enabled |

### Key Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| MediatR | 14.0.0 | CQRS command/query handling |
| FluentValidation | 12.1.1 (Application), 11.3.1 AspNetCore (Api) | Request validation |
| Serilog | 10.0 | Structured JSON logging |
| NSwag | 14.6.3 | TypeScript API client generation |
| QuestPDF | 2026.2.1 | PDF report generation |
| SixLabors.ImageSharp | 3.1.12 | Image/thumbnail processing |
| AWSSDK.S3 | 4.0.18.6 | Receipt/photo storage |
| PDFtoImage | 5.2.0 | PDF-to-image conversion for thumbnails |
| Microsoft.IdentityModel.Tokens | 8.16.0 | JWT token handling |
| System.IdentityModel.Tokens.Jwt | 8.16.0 | JWT token parsing |
| @microsoft/signalr | 10.0 | Real-time notifications |
| Vitest | 4.0.18 | Frontend unit tests (max 3 threads) |
| Playwright | 1.58.2 | E2E tests |
| xUnit + Moq + FluentAssertions | latest | Backend unit tests |
| MockQueryable.Moq | latest | EF Core DbSet mocking |

## Critical Implementation Rules

### Language-Specific Rules

**C# / .NET:**
- File-scoped namespaces throughout (`namespace X;` not `namespace X { }`)
- Nullable reference types enabled (`<Nullable>enable</Nullable>`)
- Implicit usings enabled — do not add redundant `using System;` etc.
- Records for DTOs, Commands, and Queries (`public record CreateExpenseCommand(...) : IRequest<Guid>;`)
- `DateTime.UtcNow` always — never `DateTime.Now`
- `DateOnly` for date-only fields (e.g., expense dates), not `DateTime`
- Private fields use `_camelCase` (`_mediator`, `_logger`)
- Async methods accept `CancellationToken` parameter

**TypeScript / Angular:**
- Strict mode: `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Angular strict templates: `strictTemplates: true`, `strictInjectionParameters: true`
- Target `ES2022`, module `preserve`
- Functional interceptors (not class-based) — `HttpInterceptorFn` pattern
- `inject()` function preferred over constructor injection
- Prettier config in package.json: `singleQuote: true`, `printWidth: 100`, angular HTML parser
- No standalone ESLint config — Prettier only

### Framework-Specific Rules

**Backend — Clean Architecture + CQRS:**
- 4-layer structure: Domain → Application → Infrastructure → Api. Dependencies point inward ONLY
- Domain has ZERO external dependencies
- **IAppDbContext directly** — no repository pattern. Handlers query `_dbContext.Expenses` etc.
- Single-file CQRS: Command/Query record + Handler class + DTOs co-located in one `.cs` file (e.g., `DeleteExpense.cs`)
- FluentValidation validators in separate files: `CreateExpenseValidator.cs` alongside `CreateExpense.cs`
- Validators injected into controllers and called explicitly before `_mediator.Send()` — not via MediatR pipeline behavior
- Controllers use `[Route("api/v1")]` at class level, then `[HttpGet("expenses/{id:guid}")]` per action
- Controllers always `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]`
- Request/Response records defined at bottom of controller file (e.g., `CreateExpenseRequest`, `CreateExpenseResponse`)
- Entity base classes: `AuditableEntity` (Id, CreatedAt, UpdatedAt) + `ITenantEntity` (AccountId) + `ISoftDeletable` (DeletedAt)
- Multi-tenancy: EF Core global query filters on `AccountId` — handlers don't need to filter manually
- Soft deletes: Set `DeletedAt = DateTime.UtcNow`, filter with `e.DeletedAt == null` in queries
- Global exception middleware maps domain exceptions to RFC 7807 ProblemDetails — **controllers do NOT need try-catch**

**Frontend — Angular + @ngrx/signals:**
- Signal stores use `signalStore()` with `withState()`, `withComputed()`, `withMethods()`
- Async operations use `rxMethod<T>(pipe(...))` with `switchMap`, `tap`, `catchError`
- State updates via `patchState(store, { ... })`
- Stores are `{ providedIn: 'root' }` singletons
- Services inject `HttpClient`, stores inject services via `inject()` inside `withMethods()`
- MatSnackBar for user feedback (success/error notifications)
- Feature-based folder structure: `features/{name}/components/`, `features/{name}/stores/`, `features/{name}/services/`
- SCSS for component styles (configured in angular.json)
- Proxy config: `/api` → `localhost:5292`, `/hubs` → `ws://localhost:5292`

### Testing Rules

**Backend (xUnit + Moq + FluentAssertions):**
- Test naming: `Method_Scenario_ExpectedResult` (e.g., `Handle_ValidId_SetsDeletedAtTimestamp`)
- Test organization mirrors source: `PropertyManager.Application.Tests/Expenses/DeleteExpenseHandlerTests.cs`
- Constructor setup — no `[SetUp]` attribute. Mocks initialized in constructor
- Standard mocks: `Mock<IAppDbContext>` and `Mock<ICurrentUser>` for handler tests
- EF Core DbSet mocking: `MockQueryable.Moq` — `expenses.AsQueryable().BuildMockDbSet()`
- Simulate global query filters in `SetupDbSet()` helper: filter by `AccountId` and `DeletedAt == null`
- FluentAssertions for all assertions: `.Should().Be()`, `.Should().ThrowAsync<>()`
- Verify persistence: `_dbContextMock.Verify(x => x.SaveChangesAsync(...), Times.Once)`
- Separate test classes for handlers and validators

**Frontend (Vitest):**
- Spec files co-located with source: `expense.store.spec.ts` alongside `expense.store.ts`
- `describe/it` blocks, `vi.fn()` for mocks, `vi.spyOn()` for spies
- TestBed configuration in `beforeEach` with service mocks as plain objects
- Service mocks return `of(...)` or `throwError(...)` via `vi.fn().mockReturnValue()`
- Vitest config: max 3 threads (memory optimization), V8 coverage provider
- Coverage thresholds: 70% statements/branches/lines, 50% functions

**E2E Testing (Playwright):**
- Tests live in `frontend/e2e/tests/{feature}/` (e.g., `e2e/tests/expenses/expense-flow.spec.ts`)
- Page Object Model: all page objects in `e2e/pages/` extending abstract `BasePage` class
- BasePage provides: `waitForLoading()`, `expectSnackBar()`, `waitForConfirmDialog()`, `confirmDialogAction()`
- Custom fixtures in `e2e/fixtures/test-fixtures.ts` — import `test` and `expect` from there, NOT `@playwright/test`
- `authenticatedUser` fixture auto-logs in with seeded owner account before each test
- Page object fixtures: `dashboardPage`, `expenseWorkspacePage`, `vendorPage`, etc.
- Helpers in `e2e/helpers/`: `auth.helper.ts`, `test-data.helper.ts`, `test-setup.helper.ts`, `mailhog.helper.ts`
- Chromium only, `fullyParallel: true`, trace/video on first retry, screenshot on failure
- `webServer` config auto-starts `npm run start` locally, disabled in CI
- Run with: `npm run test:e2e` (headless), `npm run test:e2e:ui` (interactive), `npm run test:e2e:debug`

**General:**
- Each handler/validator gets its own test class (backend)
- Each store/service/component gets its own spec file (frontend)
- Tests reference Acceptance Criteria codes in comments (e.g., `// AC-3.3.1`)

### Code Quality & Style Rules

**Naming Conventions:**

| Context | Convention | Example |
|---|---|---|
| .NET projects | `PropertyManager.{Layer}` | `PropertyManager.Domain` |
| .NET classes | PascalCase | `CreateExpenseHandler` |
| .NET interfaces | `I` prefix | `IAppDbContext` |
| .NET private fields | `_camelCase` | `_mediator` |
| Commands | Verb + Noun + `Command` | `DeleteExpenseCommand` |
| Queries | Get + What + `Query` | `GetExpensesByPropertyQuery` |
| Handlers | Command/Query + `Handler` | `DeleteExpenseCommandHandler` |
| Angular files | kebab-case | `expense-row.component.ts` |
| Angular components | PascalCase | `ExpenseRowComponent` |
| Angular stores | `.store.ts` | `expense.store.ts` |
| Angular services | `.service.ts` | `expense.service.ts` |
| API URLs | kebab-case, plural | `/api/v1/expense-categories` |
| JSON properties | camelCase | `propertyId` |
| DB tables | PascalCase plural | `Expenses` |
| DB columns | PascalCase | `PropertyId` |

**Code Organization:**
- Backend Application: feature folders with co-located Command+Handler+DTO files
- Backend Common: `Application/Common/Interfaces/` for cross-cutting interfaces
- Frontend features: `features/{name}/components/`, `stores/`, `services/`
- Shared: `shared/components/`, `shared/directives/`, `shared/pipes/`
- Core: `core/auth/`, `core/services/`, `core/signalr/`

**API Response Shapes:**
- Lists: `{ items: [...], totalCount }`
- Paginated: `{ items, totalCount, page, pageSize, totalPages }`
- Create: `201 Created` with `{ id: "guid" }`
- Update/Delete: `204 No Content`
- Errors: RFC 7807 ProblemDetails with `traceId`

### Development Workflow Rules

**Git/Repository:**
- Monorepo: `backend/` and `frontend/` in single repo
- Main branch: `main` — **protected, no direct pushes**. All changes require a feature branch + PR.
- Feature branches: `feature/{issue-number}-{description}`
- PRs merge to `main`

**Development Setup:**
- `docker compose up -d db mailhog` — PostgreSQL + MailHog for local dev
- Backend: `dotnet run --project src/PropertyManager.Api` → `localhost:5292`
- Frontend: `ng serve` → `localhost:4200` (proxies `/api` and `/hubs` to backend)
- API client generation: `npm run generate-api` (NSwag + patch script)

**Database Migrations:**
- EF Core migrations in Infrastructure project
- Add: `dotnet ef migrations add <Name> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- Apply: `dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- Auto-migrate on production startup

**Test Accounts:**
- Seeded owner: `claude@claude.com` / `1@mClaude` (1 property: Test Property - Austin, TX)
- E2E tests use this seeded account via `authenticatedUser` fixture

**Key URLs:**

| Service | URL |
|---|---|
| Angular App | `http://localhost:4200` |
| .NET API | `http://localhost:5292` |
| Swagger UI | `http://localhost:5292/swagger` |
| MailHog | `http://localhost:8025` |
| PostgreSQL | `localhost:5432` |

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**
- Do NOT add try-catch in controllers for domain exceptions — global middleware handles `NotFoundException`, `ValidationException`, etc.
- Do NOT create repository classes — use `IAppDbContext` directly in handlers
- Do NOT manually filter by `AccountId` in queries — EF Core global query filters handle multi-tenancy automatically
- Do NOT use `DateTime.Now` — always `DateTime.UtcNow`
- Do NOT use class-based interceptors in Angular — use functional `HttpInterceptorFn`
- Do NOT import `test`/`expect` from `@playwright/test` in E2E — import from `e2e/fixtures/test-fixtures`
- Do NOT add `using System;` or other implicit usings in C# files

**Critical Patterns to Follow:**
- MANDATORY: Documentation-first development. Do upfront research via `mcp__Ref__ref_search_documentation` at story start for key technologies involved, then during implementation use Ref MCP and WebSearch when encountering unfamiliar APIs, errors, or unexpected behavior — research docs BEFORE retrying. Do NOT re-fetch docs already in context. Applies to Angular, .NET, EF Core, ngrx/signals, Angular Material, Playwright, and all project dependencies.
- Always check `DeletedAt == null` when querying soft-deletable entities (in addition to global filters)
- Always throw `NotFoundException(nameof(Entity), id)` when entity not found — middleware maps to 404
- Always use `_dbContext.SaveChangesAsync(cancellationToken)` — pass the token through
- Always define Request/Response records at the bottom of the controller file, not in separate files
- Always use `[ProducesResponseType]` attributes on controller actions for Swagger/NSwag generation
- Always log with structured parameters: `_logger.LogInformation("Created {EntityId}", id)` — not string interpolation

**Security Rules:**
- JWT claims include `accountId` — tenant isolation enforced at query filter level
- S3 presigned URLs with 15-min expiry for receipt/photo access
- CORS restricted to application domain
- Input validation on all endpoints via FluentValidation

**Performance Considerations:**
- Vitest max 3 threads to prevent OOM (configured in `vitest.config.ts`)
- Pagination required for all list endpoints (default page sizes: 20-50)
- Categories are cached in frontend stores (`categoriesLoaded` flag prevents re-fetch)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-23
