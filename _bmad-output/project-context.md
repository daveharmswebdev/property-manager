---
project_name: 'property-manager'
user_name: 'Dave'
date: '2026-02-01'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 89
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Angular | 21.x |
| State Management | @ngrx/signals | 21.x |
| UI Components | Angular Material | 21.x |
| Test Runner (FE) | Vitest | 4.x |
| E2E Testing | Playwright | 1.58.x |
| Backend | .NET | 10 |
| Web Framework | ASP.NET Core | 10 |
| ORM | EF Core | 10 |
| CQRS | MediatR | 14.x |
| Validation | FluentValidation | 11.x |
| Logging | Serilog | 10.x |
| Database | PostgreSQL | 16 |
| Real-time | SignalR | 10.x |
| API Client Gen | NSwag | 14.x |

---

## Critical Implementation Rules

### Language-Specific Rules

**TypeScript (Frontend):**
- Strict mode enabled - no implicit any, strict null checks enforced
- Use `inject()` function for DI, not constructor parameter decorators
- Prefer `signal()` and `computed()` over BehaviorSubject for state
- Use `record` types for immutable data structures (DTOs, responses)
- DateOnly on backend maps to `string` in TypeScript - handle date parsing explicitly

**C# (Backend):**
- Nullable reference types enabled - use `?` explicitly for nullable properties
- Use `record` for Commands, Queries, DTOs - immutable by default
- Async methods must have `Async` suffix and return `Task<T>`
- Private fields use `_camelCase` prefix (e.g., `_logger`, `_context`)
- Use `DateOnly` for dates without time, `decimal` for money

### Framework-Specific Rules

**Angular:**
- All components must be `standalone: true` with explicit imports array
- Use new control flow syntax: `@if`, `@for`, `@else` (not *ngIf/*ngFor)
- Components delegate to stores - never call services directly from components
- Signal stores created with `signalStore()` from @ngrx/signals
- Store methods use `rxMethod<T>()` for async operations with `patchState()` updates
- Inline templates and styles using backtick strings (not separate files)
- Material components imported individually (MatCardModule, MatButtonModule, etc.)

**ASP.NET Core / Clean Architecture:**
- 4-layer structure: Domain → Application → Infrastructure → Api
- Dependencies point inward only - Domain has zero external dependencies
- Controllers only inject `IMediator` - all logic in handlers
- Commands/Queries co-located with their handlers in Application layer
- Validators co-located with Commands in same namespace
- Global exception middleware handles all errors - no try-catch in controllers
- RFC 7807 ProblemDetails for all error responses

**MediatR/CQRS:**
- Commands return `Guid` (created ID) or `Unit` (void operations)
- Queries return response records with data
- Handler naming: `{Action}{Resource}Handler` (e.g., `CreateExpenseHandler`)
- ValidationBehavior pipeline validates before handler execution

### Testing Rules

**CRITICAL - Frontend Test Execution:**
- **ALWAYS use `npm test` from package.json, NEVER `npx vitest` directly**
- Using `npx vitest` creates orphaned vitest workers that consume machine memory
- The `npm test` script properly manages worker lifecycle and cleanup
- Memory optimization: Vitest configured with max 3 threads to prevent OOM issues

**Frontend Testing (Vitest):**
- Test files use `.spec.ts` suffix, co-located with source files
- Mock stores using `signal()` for reactive properties, `vi.fn()` for methods
- Organize tests by state: loading, error, empty, data states in separate describe blocks
- Use `TestBed.configureTestingModule()` with mock providers
- Coverage thresholds: 70% statements/branches/lines, 50% functions

**Backend Testing (xUnit):**
- Test naming: `{Method}_{Scenario}_{Expected}` (e.g., `Handle_ValidExpense_ReturnsId`)
- Integration tests use `IClassFixture<PropertyManagerWebApplicationFactory>`
- Create unique test users per test: `$"email-{Guid.NewGuid():N}@example.com"`
- Use FluentAssertions for readable assertions
- Verify soft deletes by checking `DeletedAt` timestamp

**E2E Testing (Playwright):**
- Run with `npm run test:e2e` from frontend directory
- CI runs full stack: PostgreSQL + MailHog + API + Frontend
- Playwright reports uploaded as artifacts on failure

**GitHub CI/CD Pipeline:**
- **CI (Pull Requests):** Runs 4 parallel jobs:
  1. Backend: `dotnet restore` → `dotnet build` → `dotnet test` (with coverage)
  2. Frontend: `npm ci` → `npm run build` → `npm test`
  3. Docker: Build verification for both images (no push)
  4. E2E: Full integration tests with Playwright
- **CD (Merge to main):** Auto-deploys to Render cloud via deploy hooks, verifies API health
- **CodeQL:** Security scanning on all PRs + weekly scheduled scan (C# and TypeScript)
- All CI jobs must pass before PR can merge
- Ensure tests pass locally before pushing - failed CI blocks deployment

### Code Quality & Style Rules

**Naming Conventions:**
- **Backend:** PascalCase for classes/methods, `_camelCase` for private fields, `I` prefix for interfaces
- **Frontend files:** kebab-case (e.g., `expense-list.store.ts`, `vendor-form.component.ts`)
- **Frontend classes:** PascalCase with suffix (e.g., `ExpenseListStore`, `VendorFormComponent`)
- **Database:** PascalCase tables (plural), PascalCase columns, `IX_{Table}_{Columns}` for indexes
- **API:** kebab-case URLs (`/api/v1/work-orders`), camelCase JSON properties

**File Organization:**
- **Backend:** Feature folders in Application layer (Properties/, Expenses/, Vendors/)
- **Frontend:** Feature modules in `features/`, shared components in `shared/`, core services in `core/`
- Commands/Queries/Handlers/Validators co-located in same file or folder
- One component per file, stores in `stores/` subfolder within feature

**Code Style:**
- Prettier configured: 100 char width, single quotes, Angular HTML parser
- No trailing commas in multi-line (default Prettier)
- Explicit return types on public methods
- No `any` type - use proper typing or `unknown`

**Documentation:**
- XML doc summaries on public classes/methods in C#
- AC references in comments: `(AC-3.1.1, AC-3.1.6)` format for traceability
- Inline comments only for non-obvious business logic
- No redundant comments that restate the code

### Development Workflow Rules

**Git Workflow:**
- Main branch: `main` - protected, requires PR with passing CI
- Feature branches: Work in feature branches, PR to main
- Merging to main triggers automatic deployment to Render

**Local Development:**
- Start infrastructure: `docker compose up -d db mailhog`
- Backend: `dotnet run --project src/PropertyManager.Api` (port 5292)
- Frontend: `ng serve` (port 4200, proxies `/api` to backend)
- API client regeneration: `npm run generate-api` after backend API changes

**Database Migrations:**
- Create: `dotnet ef migrations add <Name> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- Apply: `dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
- Migrations run automatically on production startup

**API Client Generation:**
- NSwag generates TypeScript client from Swagger
- Run `npm run generate-api` in frontend after adding/changing endpoints
- Generated client in `frontend/src/app/core/api/`

**Story Implementation (BMad Method):**
- Stories created via `/bmad:bmm:workflows:create-story`
- Implementation via `/bmad:bmm:workflows:dev-story`
- Each story includes acceptance criteria with AC-X.Y.Z references
- Stories tracked in `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Critical Don't-Miss Rules

**Multi-Tenant Data Isolation (CRITICAL):**
- ALL queries MUST filter by `AccountId` - no exceptions
- Pattern: `.Where(x => x.AccountId == _currentUser.AccountId && x.DeletedAt == null)`
- Account context comes from `ICurrentUser` service (extracted from JWT claims)
- Failing to filter by AccountId = data leakage between tenants

**Soft Delete Pattern:**
- NEVER physically delete records - always set `DeletedAt = DateTime.UtcNow`
- ALL read queries must filter: `.Where(x => x.DeletedAt == null)`
- Deleted records remain for audit trail and potential recovery
- EF Core global query filters enforce this automatically

**Error Handling:**
- Controllers do NOT use try-catch - global middleware handles all exceptions
- Throw domain exceptions: `NotFoundException`, `ValidationException`, `BusinessRuleException`
- Middleware maps exceptions to RFC 7807 ProblemDetails responses
- Only use try-catch in controllers for custom fallback behavior (rare)

**Security Rules:**
- Access tokens stored in memory only (signals), NEVER localStorage
- Refresh tokens as HttpOnly cookies with `Secure=true, SameSite=Strict`
- Mask sensitive data in logs: use `LogSanitizer.MaskEmail()`
- Validate all user input via FluentValidation - never trust client data
- Check authorization in handlers, not just authentication at controller level

**Frontend State Management:**
- Components NEVER call services directly - always go through stores
- Unidirectional flow: Component → Store → Service → API
- Stores are single source of truth for domain state
- Use `patchState()` for state updates, never mutate directly

**Common Anti-Patterns to Avoid:**
- DON'T use `npx vitest` - use `npm test` (orphaned workers)
- DON'T skip AccountId filtering in queries
- DON'T add try-catch blocks in controllers
- DON'T store tokens in localStorage
- DON'T call services from components (use stores)
- DON'T forget to regenerate API client after backend changes

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Reference AC codes when implementing story acceptance criteria

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

_Last Updated: 2026-02-01_
_Generated by BMAD Generate Project Context Workflow_

