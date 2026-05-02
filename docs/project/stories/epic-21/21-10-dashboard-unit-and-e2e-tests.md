# Story 21.10: Dashboard Unit + E2E Tests

Status: done

## Story

As a developer,
I want unit coverage of the dashboard aggregation handler (`GetDashboardTotalsQueryHandler`) and 2-3 Playwright E2E smoke tests for the dashboard page,
so that the dashboard — currently covered only by ~8 integration tests in `DashboardControllerTests.cs` and zero unit/E2E tests — has baseline regression protection at the unit and user-flow layers without ballooning into a full feature sweep.

## Acceptance Criteria

> **Reality check (epic vs. shipped code) — read this before writing any test.**
>
> The epic spec at `epic-21-epics-test-coverage.md` § Story 21.10 says the aggregation handler does "totals, percentage-change calculations, period comparisons." **The shipped handler does none of those.** Verified by reading every line of `backend/src/PropertyManager.Application/Dashboard/GetDashboardTotals.cs` (April 2026):
>
> - **One handler exists:** `GetDashboardTotalsQueryHandler` with constructor `(IAppDbContext dbContext, ICurrentUser currentUser)` (lines 32-38).
> - **Query record:** `GetDashboardTotalsQuery(int? Year, DateOnly? DateFrom, DateOnly? DateTo)` (line 11).
> - **Result DTO:** `DashboardTotalsDto(decimal TotalExpenses, decimal TotalIncome, decimal NetIncome, int PropertyCount)` (lines 16-21).
> - **Logic:** Sum expenses for the date range, sum income for the date range, count active properties (i.e. `DeletedAt == null`), compute `NetIncome = TotalIncome - TotalExpenses`. **No percentage-change.** **No period comparison.** **No "previous period" or YoY math.**
> - **Date range derivation:** if `DateFrom`/`DateTo` are null, the handler defaults to `new DateOnly(year, 1, 1)` … `new DateOnly(year, 12, 31)` where `year = request.Year ?? DateTime.UtcNow.Year` (lines 42-44).
> - **Account filtering is performed manually** inside each query (e.g. `e.AccountId == _currentUser.AccountId`), NOT via EF Core global query filters in the production code path (the handler does this itself at lines 48, 55, 62). Tests must mirror this — set up `_currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId)` and seed each DbSet with both matching and non-matching `AccountId` rows so the manual filter is exercised.
> - **Soft-delete filtering on Expenses and Income is also manual** (`e.DeletedAt == null` at lines 49, 56). Properties also filter on `p.DeletedAt == null` at line 62. Tests must seed at least one soft-deleted row per DbSet to confirm exclusion.
>
> **AC-1 below targets the actual handler shape — totals, account isolation, soft-delete exclusion, date filtering.** It does NOT require percentage-change/period-comparison tests because that math does not exist. If a future story adds percentage-change to the handler, those tests get added then.
>
> **Frontend reality check (epic vs. shipped UI):**
>
> - **There is NO "recent activity" section on the dashboard.** Verified by reading `frontend/src/app/features/dashboard/dashboard.component.ts` (302 lines). The dashboard renders: dashboard-header (welcome + Add Property button), `app-date-range-filter`, `app-stats-bar`, then `app-property-row` rows OR `app-empty-state` (no properties). For the Contributor role it renders a different template entirely (Receipts + Work Orders shortcut links). The epic's "recent activity" mention is aspirational copy — AC-2 below targets the actual rendered structure.
> - **There is NO `app-property-row` "per-property breakdown" beyond the row itself.** Each row already shows `YTD Expenses` and `Net` — that IS the per-property breakdown. AC-2 asserts on these row values.
> - **Critically: the dashboard component does NOT call `/api/v1/dashboard/totals`.** Verified `dashboard.component.ts:274-281` (the effect that fires on load) and `propertyStore.loadProperties()` at `property.store.ts:142-171` — the store calls `propertyService.getProperties(...)` which hits `/api/v1/properties` (not the dashboard totals endpoint). The stats-bar values come from a client-side `reduce` over the per-property `expenseTotal`/`incomeTotal` fields (verified `property.store.ts:83-105`). **Translation:** the E2E tests must `page.route('*/**/api/v1/properties*', ...)` for empty-state simulation — NOT `*/**/api/v1/dashboard/totals*`. Seeded happy-path test (AC-2) does not need to mock anything; it relies on the seeded `claude@claude.com` account having ≥1 property + expense + income.
> - **Existing `DashboardPage` page object** lives at `frontend/e2e/pages/dashboard.page.ts` and exposes `welcomeHeader`, `addPropertyButton`, `propertyList`, `propertyRows`, `emptyState`, `statsBar`, plus helpers `goto()`, `expectWelcome()`, `expectNoProperties()`, `expectPropertyCount(n)`, `clickAddProperty()`, `clickProperty(name)`, `getPropertyRow(name)`, `expectPropertyInList(name)`. The story reuses this POM as-is. No new selectors needed for AC-2/AC-3.
> - **Empty-state component:** `app-empty-state` with `[icon]="home_work" [title]="No properties yet" [message]="Add your first property to get started." [actionLabel]="Add Property"` (verified `dashboard.component.ts:90-96`). The DOM emits an `<h2>No properties yet</h2>` and a `<p>Add your first property to get started.</p>`. AC-3 asserts on these.
> - **No data-testids on the dashboard.** Selectors must be CSS/component-tag-based: `app-stats-bar`, `app-property-row`, `app-empty-state`, `.dashboard-header h1`, `.stat-card.expense-card .stat-value`, etc. (Verified by grepping the component template — no `data-testid` attributes.)

### AC-1: `GetDashboardTotalsQueryHandler` unit tests cover all execution paths

The unit tests live at `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsQueryHandlerTests.cs` (new file, new folder). Constructor takes two mocks: `Mock<IAppDbContext>` and `Mock<ICurrentUser>`. `_currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId)` in the constructor. Helpers `SetupExpensesDbSet(List<Expense>)`, `SetupIncomeDbSet(List<IncomeEntity>)`, `SetupPropertiesDbSet(List<Property>)` use `MockQueryable.Moq` v10 `.BuildMockDbSet()` (no `.AsQueryable()` — extends `ICollection<T>` directly per Story 18.1 and project-context.md:111).

- **AC-1.1 (no data — returns zeros):** Given empty DbSets for `Expenses`, `Income`, `Properties` (zero rows of any kind),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then the result is `DashboardTotalsDto(TotalExpenses: 0m, TotalIncome: 0m, NetIncome: 0m, PropertyCount: 0)`.

- **AC-1.2 (one property, single expense, single income — basic totals):** Given the test account has one active property (`AccountId == _testAccountId`, `DeletedAt == null`), one expense of `$200` dated `2026-03-15`, one income of `$1000` dated `2026-03-01`,
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `TotalExpenses == 200m`, `TotalIncome == 1000m`, `NetIncome == 800m`, `PropertyCount == 1`.

- **AC-1.3 (multiple properties + multiple expenses/income — sums correctly):** Given two active properties for the test account, three expenses (`$100`, `$200`, `$300` — all in 2026) and two income rows (`$500`, `$1500` — both in 2026),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `TotalExpenses == 600m`, `TotalIncome == 2000m`, `NetIncome == 1400m`, `PropertyCount == 2`.

- **AC-1.4 (negative NetIncome when expenses exceed income):** Given `$5000` expenses and `$2000` income for 2026,
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `NetIncome == -3000m`. (Mirrors the integration test `GetTotals_NegativeNet_CalculatesCorrectly`.)

- **AC-1.5 (year filter — excludes prior-year data):** Given expenses in both 2024 (`$100`) and 2026 (`$200`), and income in both 2024 (`$500`) and 2026 (`$300`),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `TotalExpenses == 200m` and `TotalIncome == 300m` (2024 data excluded by the date-range derived from `Year`).

- **AC-1.6 (account isolation — excludes other account's data):** Given the test account has one property (`$100` expense, `$500` income in 2026), and another account (`Guid.NewGuid()` ≠ `_testAccountId`) has one property (`$999` expense, `$9999` income in 2026),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `TotalExpenses == 100m`, `TotalIncome == 500m`, `PropertyCount == 1` (other account's data is excluded by the manual `e.AccountId == _currentUser.AccountId` filter).

- **AC-1.7 (soft-deleted expenses excluded; soft-deleted income excluded; soft-deleted properties excluded from PropertyCount):** Given the test account has two properties (one with `DeletedAt = DateTime.UtcNow`, one active), two expenses (one with `DeletedAt` set, one active — both `$100`), two income rows (one with `DeletedAt` set, one active — both `$500`),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)`,
  Then `TotalExpenses == 100m`, `TotalIncome == 500m`, `PropertyCount == 1` (deleted rows excluded by the manual `... .DeletedAt == null` filters at handler lines 49, 56, 62). **Note:** mirrors the integration test `GetTotals_ExcludesSoftDeletedProperties_FromPropertyCount`, which proves that historical income from a soft-deleted property is preserved in totals. This unit test must keep that contract: soft-deleted *property's* income is still summed if the income row itself is not soft-deleted. To exercise that branch, seed an expense whose `PropertyId` points at a soft-deleted property — the expense itself has `DeletedAt == null` and **must** be counted (handler does NOT join properties when summing expenses).

- **AC-1.8 (year defaults to UtcNow.Year when `request.Year` is null):** Given `DateTime.UtcNow.Year` data (one expense at `$50` dated `new DateOnly(DateTime.UtcNow.Year, 6, 15)`) and one expense from `2020` (`$999`),
  When the handler runs `new GetDashboardTotalsQuery(null, null, null)` (year = null),
  Then the handler derives the date range from `DateTime.UtcNow.Year` (per line 42) and `TotalExpenses == 50m`. *Justification:* the `??` fallback on line 42 is otherwise uncovered.

- **AC-1.9 (explicit DateFrom + DateTo override the year-derived range):** Given expenses dated `2026-01-01` (`$100`), `2026-03-15` (`$200`), `2026-06-30` (`$300`),
  When the handler runs `new GetDashboardTotalsQuery(2026, new DateOnly(2026, 3, 1), new DateOnly(2026, 5, 31))`,
  Then `TotalExpenses == 200m` (only the March-15 row falls in the range; lines 43-44 prefer `request.DateFrom`/`DateTo` over the year-based defaults).

- **AC-1.10 (boundary inclusivity — `>=` and `<=`):** Given expenses dated `2026-01-01` (`$100`), `2026-12-31` (`$200`), `2025-12-31` (`$300` — outside), `2027-01-01` (`$400` — outside),
  When the handler runs `new GetDashboardTotalsQuery(2026, null, null)` (range becomes `2026-01-01`..`2026-12-31`),
  Then `TotalExpenses == 300m` (`$100` + `$200`; both boundaries are inclusive per the `>=` / `<=` operators on lines 50, 57). *Justification:* the integration tests don't pin boundary behavior — this is a unit-level pin.

### AC-2: Dashboard E2E smoke verifies the page renders with seeded data

Test file: `frontend/e2e/tests/dashboard/dashboard.spec.ts` (new file, new subdirectory). Mirrors the convention used by `frontend/e2e/tests/work-orders/`, `tenant-dashboard/`, etc. (one feature = one subdirectory). Imports `test, expect` from `../../fixtures/test-fixtures` (NOT from `@playwright/test` — per project-context.md:131 and CLAUDE.md). Uses the existing `authenticatedUser` and `dashboardPage` fixtures.

The seeded `claude@claude.com` account has at least 1 property — `Test Property - Austin, TX` per CLAUDE.md "Test Accounts" — but does NOT guarantee an expense or income exists (the property may have zero financial data depending on prior test runs). To make AC-2 deterministic without relying on shared seed data and without polluting state, **seed one property + one expense + one income via the same helpers Story 21.8 used (`work-order.helper.ts`-style)**, capturing per-test-unique amounts so assertions are reliable, then `afterAll` reset via `POST /api/v1/test/reset`. **However** — re-using `work-order.helper.ts`'s exports (`getAccessTokenForSeededUser`, `createPropertyViaApi`, `resetTestDataViaApi`) is appropriate; this story should NOT add new helper modules. Add `createExpenseViaApi(token, propertyId, amount, date, categoryId)` and `createIncomeViaApi(token, propertyId, amount, date)` *inside* a new `frontend/e2e/helpers/dashboard.helper.ts` (mirrors 21.8's convention of one helper file per story when the existing helper would grow), or extend `work-order.helper.ts` if growth is bounded — pick **`dashboard.helper.ts`** to keep concerns separated (work-order helper already has 173 lines, dashboard tests need different fixtures). The dashboard helper exports re-import `getAccessTokenForSeededUser` from `work-order.helper.ts` rather than duplicating it.

- **AC-2.1 (header + welcome render):** Given the seeded user is logged in via `authenticatedUser` fixture and a property + expense + income are seeded via API in `beforeAll`,
  When the user navigates to `/dashboard`,
  Then `dashboardPage.expectWelcome()` passes (matches "Welcome back" text — verified `dashboard.component.ts:47` for the Owner role; the seeded `claude@claude.com` account has the `Owner` role per CLAUDE.md so this branch always renders),
  And the **Add Property** button is visible (`dashboardPage.addPropertyButton`).

- **AC-2.2 (stats-bar renders with non-zero values):** Given an expense of `$<E>` and an income of `$<I>` were seeded for the year `DateTime.UtcNow.Year` (i.e. the date range filter's default `this-year` preset will include them — verified `dashboard.component.ts:268`),
  When the user is on `/dashboard`,
  Then the `app-stats-bar` element is visible,
  And the expense stat value (locator: `.stat-card.expense-card .stat-value`) contains a non-zero dollar amount (assertion: text matches `/\$[1-9][\d,.]*/` — non-zero currency),
  And the income stat value (locator: `.stat-card.income-card .stat-value`) contains a non-zero dollar amount,
  And the net stat value (locator: `.stat-card.net-card .stat-value`) is non-zero. *Justification:* the dashboard reads via `propertyStore.totalExpenses()` / `totalIncome()` which sum the per-property `expenseTotal`/`incomeTotal` returned by `GET /api/v1/properties`. As long as the seeded property has the seeded expense + income, these will be > 0 in the response. (Verified contract via `property.store.ts:83-105` and `property.service.ts:78-86`.)

- **AC-2.3 (per-property row renders with values):** Given the seeded property and the seeded financial rows exist,
  When the user is on `/dashboard`,
  Then `dashboardPage.expectPropertyInList(seedProperty.name)` passes (the row's text contains the property name),
  And the row's `.expense-value` cell shows a non-zero dollar amount (locator: `app-property-row .property-expense .expense-value`),
  And the row's `.net-value` cell shows a non-zero dollar amount.

- **AC-2.4 (cleanup):** Given the test seeded a property, an expense, and an income via API,
  When `afterAll` runs `resetTestDataViaApi(token)`,
  Then the seeded entities are removed (per `TestController.reset` semantics — verified by 21.8's success).

### AC-3: Dashboard E2E smoke verifies the empty-state when account has no properties

Strategy: per CLAUDE.md ("E2E Testing Rules"), prefer `page.route()` interception to simulate empty data over polluting the shared seed account. Intercept `GET /api/v1/properties*` and return `{ items: [], totalCount: 0 }` so the `propertyStore.isEmpty()` computed flips to `true` and the empty-state branch renders (verified `dashboard.component.ts:88-96`). No DB writes; no cleanup required.

- **AC-3.1 (empty state visible — title + message):** Given the user is logged in and `GET /api/v1/properties*` is intercepted to return `{ items: [], totalCount: 0 }`,
  When the user navigates to `/dashboard`,
  Then `dashboardPage.emptyState` is visible (`expect(dashboardPage.emptyState).toBeVisible()`),
  And the empty-state title `<h2>No properties yet</h2>` is visible (locator: `app-empty-state h2`, text exact `"No properties yet"`),
  And the empty-state message `<p>Add your first property to get started.</p>` is visible (locator: `app-empty-state p`).

- **AC-3.2 (no misleading "$0" totals shown without context):** Given the same intercepted-empty state,
  When the user is on `/dashboard`,
  Then there is no error indicator visible (`expect(page.locator('app-error-card')).not.toBeVisible()`),
  And no console error is emitted that contains `"failed"` or `"error loading"` (assert via `page.on('pageerror', ...)` capture initialized in `beforeEach` — empty array at end of test). *Note:* the stats-bar IS still rendered with `$0.00` values in the empty state (verified `dashboard.component.ts:68-71` — stats-bar is unconditionally outside the empty-state `@if`). The epic AC says "no misleading $0 totals without context"; the dashboard's contract is that the stats-bar shows zeros AND the empty-state card explains why (no properties yet). This AC therefore asserts presence of the empty-state card, not absence of the stats-bar — the "context" is the empty-state card, not zero stats. **Document this in dev-notes** so reviewers don't expect the stats-bar to be hidden.

- **AC-3.3 (empty-state Add Property action navigates):** Given the empty-state is shown,
  When the user clicks the empty-state's "Add Property" button (selector: `app-empty-state button`),
  Then the URL becomes `/properties/new` (the empty-state component's `actionRoute` is `/properties/new` per `dashboard.component.ts:95`).

### AC-4: Test Scope justification (process AC — addressed in Dev Notes, not implemented as a test)

- **AC-4.1:** This story adds **unit tests + E2E tests only**. No new integration tests are added. Existing integration coverage of `/api/v1/dashboard/totals` lives in `backend/tests/PropertyManager.Api.Tests/DashboardControllerTests.cs` (8 tests verified by reading the file: `GetTotals_WithoutAuth_Returns401`, `GetTotals_NoData_ReturnsZeros`, `GetTotals_WithProperties_ReturnsPropertyCount`, `GetTotals_WithExpensesAndIncome_CalculatesNetCorrectly`, `GetTotals_WithYearFilter_FiltersCorrectly`, `GetTotals_AccountIsolation_OnlyReturnsOwnData`, `GetTotals_ExcludesSoftDeletedProperties_FromPropertyCount`, `GetTotals_NegativeNet_CalculatesCorrectly`). The unit tests added by this story cover the same behaviors at the handler-mock layer for fast feedback; the integration tests pin the wire/HTTP/EF-Core path. This is intentional pyramid duplication, not redundancy.

### AC-5: All new tests run green and are wired into the existing test commands

- **AC-5.1 (backend unit tests run):** `cd backend && dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Dashboard"` — discovers and passes ≥10 tests (matches the AC-1.1..AC-1.10 floor).
- **AC-5.2 (no backend regressions):** `cd backend && dotnet test` — full suite passes (no test in any project broken by the additions).
- **AC-5.3 (E2E spec runs locally with `--workers=1`):** `cd frontend && npx playwright test e2e/tests/dashboard/dashboard.spec.ts --workers=1` — 3 tests pass (AC-2 = 1 test, AC-3 = 2 tests; or split AC-2 into 2 subtests if assertion count grows). Re-run twice consecutively, both green (per Story 21.8's "deterministic re-run" rule).
- **AC-5.4 (E2E spec runs in CI):** the spec is included by `frontend/playwright.config.ts`'s default `testDir: './e2e'` and runs with `workers: 1` in CI (verified `playwright.config.ts:9`). No CI configuration changes required.

## Tasks / Subtasks

- [x] **Task 1: Create `GetDashboardTotalsQueryHandlerTests.cs` (AC-1, AC-5.1, AC-5.2)**
  - [x] 1.1 Create directory `backend/tests/PropertyManager.Application.Tests/Dashboard/`.
  - [x] 1.2 Create file `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsQueryHandlerTests.cs` with namespace `PropertyManager.Application.Tests.Dashboard`.
  - [x] 1.3 Constructor: instantiate `Mock<IAppDbContext>`, `Mock<ICurrentUser>`. Call `_currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId)`. Build SUT: `_handler = new GetDashboardTotalsQueryHandler(_dbContextMock.Object, _currentUserMock.Object)`.
  - [x] 1.4 Add private helpers (mirror `GetAllPropertiesHandlerTests.cs` pattern):
    - `SetupExpensesDbSet(List<Expense> expenses)` → `_dbContextMock.Setup(x => x.Expenses).Returns(expenses.BuildMockDbSet().Object)`.
    - `SetupIncomeDbSet(List<IncomeEntity> income)` → same pattern with `_dbContextMock.Setup(x => x.Income)`.
    - `SetupPropertiesDbSet(List<Property> properties)` → same pattern with `_dbContextMock.Setup(x => x.Properties)`.
    - `CreateProperty(Guid accountId, string name, DateTime? deletedAt = null)` and `CreateExpense(Guid accountId, Guid propertyId, decimal amount, DateOnly date, DateTime? deletedAt = null)` and `CreateIncome(Guid accountId, Guid propertyId, decimal amount, DateOnly date, DateTime? deletedAt = null)` — each populates required fields (`Id = Guid.NewGuid()`, `Street`, `City`, `State`, `ZipCode`, `CreatedByUserId`, `CreatedAt`, etc. — match `GetAllPropertiesHandlerTests.cs:CreateProperty` for shape).
  - [x] 1.5 `[Fact] Handle_NoData_ReturnsAllZeros` (AC-1.1).
  - [x] 1.6 `[Fact] Handle_OneProperty_OneExpense_OneIncome_ReturnsBasicTotals` (AC-1.2).
  - [x] 1.7 `[Fact] Handle_MultiplePropertiesAndRows_SumsAllForAccount` (AC-1.3).
  - [x] 1.8 `[Fact] Handle_ExpensesExceedIncome_ReturnsNegativeNetIncome` (AC-1.4).
  - [x] 1.9 `[Fact] Handle_YearFilter_ExcludesPriorYearData` (AC-1.5).
  - [x] 1.10 `[Fact] Handle_OtherAccountData_IsExcluded` (AC-1.6).
  - [x] 1.11 `[Fact] Handle_SoftDeletedRows_AreExcludedAcrossAllThreeDbSets` (AC-1.7) — single `[Fact]` covers expenses + income + properties together since the handler's three queries are independent.
  - [x] 1.12 `[Fact] Handle_NullYear_DefaultsToCurrentYear` (AC-1.8).
  - [x] 1.13 `[Fact] Handle_ExplicitDateFromAndDateTo_OverrideYearRange` (AC-1.9).
  - [x] 1.14 `[Fact] Handle_DateBoundaries_AreInclusive` (AC-1.10).
  - [x] 1.15 Run `dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Dashboard"` — verify 10/10 green.

- [x] **Task 2: Create `dashboard.helper.ts` for E2E API seeding (AC-2)**
  - [x] 2.1 Create `frontend/e2e/helpers/dashboard.helper.ts`.
  - [x] 2.2 Re-export `getAccessTokenForSeededUser` and `resetTestDataViaApi` from `./work-order.helper.ts` (or import-and-re-export at the top of `dashboard.spec.ts` — pick whichever keeps the dashboard helper thin).
  - [x] 2.3 Export `createPropertyViaApi(token, overrides?): Promise<{ id: string; name: string }>` — re-exported from `work-order.helper.ts`; the spec passes a `Dashboard E2E Property ${Date.now()}` name override for log debuggability.
  - [x] 2.4 Export `createExpenseViaApi(token, propertyId, amount, dateString)` — POSTs `/api/v1/expenses` with `{ propertyId, amount, date: <ISO>, categoryId, description: 'Dashboard E2E expense' }`. The helper looks up the first available expense category id via `GET /api/v1/expense-categories` (mirrors `DashboardControllerTests.cs:280-298`).
  - [x] 2.5 Export `createIncomeViaApi(token, propertyId, amount, dateString)` — POSTs `/api/v1/income` with `{ propertyId, amount, date, source: 'Rent', description: 'Dashboard E2E income' }`. No category required for income.
  - [x] 2.6 Use the same `D_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5292'` constant as `work-order.helper.ts:13`.
  - [x] 2.7 All helpers use native `fetch` so they can run in `beforeAll`/`afterAll` without a `page` instance (matches 21.8 convention).

- [x] **Task 3: Create `dashboard.spec.ts` E2E test file (AC-2, AC-3, AC-5.3, AC-5.4)**
  - [x] 3.1 Create directory `frontend/e2e/tests/dashboard/`.
  - [x] 3.2 Create file `frontend/e2e/tests/dashboard/dashboard.spec.ts` importing `test, expect` from `../../fixtures/test-fixtures`.
  - [x] 3.3 Top-level `test.describe('Dashboard E2E (Story 21.10)', () => { ... })` block.
  - [x] 3.4 `let token: string; let seedProperty: { id: string; name: string };` declarations.
  - [x] 3.5 `beforeAll`: seeds `Dashboard E2E Property ${Date.now()}` + `$250` expense + `$1500` income, all dated *yesterday* in the current year. The spec uses a `pastDateThisYear()` helper instead of the originally proposed `currentYearDate('06-15')` — see Completion Notes for rationale (the API rejects future dates and the runtime year may be early in the calendar where June 15 is still in the future).
  - [x] 3.6 `afterAll`: `if (token) await resetTestDataViaApi(token);`.
  - [x] 3.7 **AC-2.1+2.2+2.3 test:** asserts welcome header, Add Property button visible, stats-bar visible with non-zero expense/income/net values (regex `/\$[1-9][\d,.]*/` for positive currency, `/[\$(][1-9][\d,.]*\)?/` for net which may render as accounting-format negative `($...)`), and the per-property row `.expense-value` + `.net-value` are non-zero.
  - [x] 3.8 **AC-3 test:** intercepts `**/api/v1/properties**` GET to return `{ items: [], totalCount: 0 }`, navigates, asserts `<app-empty-state>` is visible with the exact `<h2>` and `<p>` text, and `<app-error-card>` is not visible.
  - [x] 3.9 **AC-3.3 test:** same interception; clicks `app-empty-state button`; waits for URL ending in `/properties/new`.

- [x] **Task 4: Run, verify, no regressions (AC-5)**
  - [x] 4.1 `cd backend && dotnet build` — clean (zero new errors; same 4 pre-existing warnings as main).
  - [x] 4.2 `cd backend && dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Dashboard"` — **10/10 green** (150 ms).
  - [x] 4.3 `cd backend && dotnet test` — Application.Tests **1221/1221**, Infrastructure.Tests **98/98**, Api.Tests **790/791**. The single failure (`TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts`) is pre-existing on `main` and unrelated to this story (it fails because the seeded test DB has leftover MaintenanceRequests with FK references to Properties that the TestController's reset order does not delete). Orchestrator flagged this as known.
  - [x] 4.4 `cd frontend && npx playwright test e2e/tests/dashboard/dashboard.spec.ts --workers=1` — **3/3 green** (3.0s).
  - [x] 4.5 Re-run 4.4 a second time back-to-back — **3/3 green again** (2.5s). Deterministic.

- [x] **Task 5: Sprint status + story status update (process)**
  - [x] 5.1 Update `docs/project/sprint-status.yaml`: `21-10-dashboard-unit-and-e2e-tests: review`.
  - [x] 5.2 Set this story's `Status:` line to `review`.
  - [x] 5.3 Fill out Dev Agent Record below (Agent Model Used, Debug Log References, Completion Notes, File List).

## Dev Notes

### Test Scope

| Layer | Required? | Justification |
|---|---|---|
| **Unit tests (xUnit + Moq + FluentAssertions)** | **Required — story deliverable #1** | `GetDashboardTotalsQueryHandler` has zero unit tests today (verified by `find backend/tests -iname "*dashboard*"` returns only `Api.Tests/DashboardControllerTests.cs` — no Application.Tests file). Story creates `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsQueryHandlerTests.cs` with ≥10 tests covering totals, account isolation, soft-delete exclusion, year filter, date boundary inclusivity, null-year fallback. |
| **Integration tests (.NET WebApplicationFactory)** | **Not required** | `backend/tests/PropertyManager.Api.Tests/DashboardControllerTests.cs` exists with **8 integration tests** covering: 401-unauthenticated, no-data, property count, expenses+income net, year filter, account isolation, soft-deleted property exclusion from PropertyCount, negative net. Verified by reading the file. The epic explicitly scopes 21.10 to "unit + E2E only — integration coverage already exists." Pyramid is satisfied. |
| **E2E tests (Playwright)** | **Required — story deliverable #2** | The dashboard page (`/dashboard`) has zero E2E coverage (verified by `find frontend/e2e -name "dashboard*.spec.ts"` returns nothing). Story creates `frontend/e2e/tests/dashboard/dashboard.spec.ts` with ~3 tests: AC-2 happy-path render with seeded data, AC-3 empty-state via `page.route()` interception, AC-3.3 empty-state CTA navigation. |

### Pattern References — mirror these existing files

1. **`backend/tests/PropertyManager.Application.Tests/Properties/GetAllPropertiesHandlerTests.cs`** — handler that takes `(IAppDbContext, ICurrentUser, IPhotoService)` and queries `Properties` + `Expenses` + `Income` DbSets. The dashboard handler is structurally similar (queries the same 3 DbSets, takes the first 2 of those 3 deps). Copy the:
   - Constructor pattern (Mock fields, `_testAccountId`/`_otherAccountId`, `_currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId)`).
   - `SetupPropertiesDbSet`, `SetupExpensesDbSet`, `SetupIncomeDbSet` private helpers (lines for `BuildMockDbSet()`).
   - `CreateProperty(accountId, name, city, state)` factory pattern (extend with optional `deletedAt`).

2. **`backend/tests/PropertyManager.Application.Tests/Income/GetAllIncomeHandlerTests.cs`** — same `MockQueryable.Moq` pattern; line 377 shows the v10 single-line setup `var mockDbSet = filteredIncome.BuildMockDbSet(); _dbContextMock.Setup(x => x.Income).Returns(mockDbSet.Object);`. Use this exact form (no `.AsQueryable()`).

3. **`frontend/e2e/tests/work-orders/work-orders-create.spec.ts`** — Story 21.8's E2E pattern; mirror exactly:
   - Imports: `import { test, expect } from '../../fixtures/test-fixtures';` then `import { getAccessTokenForSeededUser, createPropertyViaApi, resetTestDataViaApi } from '../../helpers/work-order.helper';` (this story imports from `dashboard.helper.ts` instead).
   - `test.describe('Dashboard E2E (Story 21.10)', ...)` wrapper.
   - `let token: string;` declared at suite scope; `beforeAll` populates; `afterAll` calls `resetTestDataViaApi(token)` if `token` truthy.
   - Each test takes destructured fixtures `{ page, authenticatedUser, dashboardPage }` and uses POM helpers directly.

4. **`frontend/e2e/pages/dashboard.page.ts`** — already has every selector/method this story needs. **Do NOT modify it** — read-only reuse. If a future test needs new dashboard selectors, that's a separate concern; this story's AC list is satisfied by the existing POM.

5. **`backend/tests/PropertyManager.Api.Tests/DashboardControllerTests.cs:108-149`** — the integration test `GetTotals_WithYearFilter_FiltersCorrectly`. Use this as a template for AC-1.5's expected values (same shape: 2024 vs 2025 data isolation).

### Anti-pitfalls (don't make these mistakes)

1. **Don't write percentage-change or period-comparison tests.** The handler does not compute either. Verified by reading every line of `GetDashboardTotals.cs`. The epic spec is wrong on this — see "Reality check" at the top of AC. If the dev workflow tries to add `Handle_PercentageChange_*` tests, the production code has no surface to test, and the test will be asserting against a hallucinated contract. **Stop and re-read the handler if tempted.**

2. **Don't seed seeded-account-shared data without `afterAll` cleanup.** The `claude@claude.com` account is shared across all E2E tests. AC-2 seeds a property + expense + income via API; AC-2.4 mandates `afterAll` reset via `POST /api/v1/test/reset` (the same endpoint Story 21.8 uses). If cleanup is skipped, subsequent specs will see the residual data.

3. **Don't use `page.route('**/api/v1/dashboard/totals*', ...)` for the empty-state mock.** The dashboard component does NOT call that endpoint. It calls `/api/v1/properties`. Mocking the wrong URL leaves the component still hitting the real `/api/v1/properties` endpoint and the test will be non-deterministic. Verified by reading `dashboard.component.ts:274-281` (the load effect) and `property.store.ts:142-171` (the rxMethod that calls `propertyService.getProperties`).

4. **Don't add `data-testid` attributes to `dashboard.component.ts` or its child components.** This is a test-only story — production code is read-only. CSS/component-tag selectors (`app-stats-bar`, `app-property-row`, `app-empty-state`, `.stat-card.expense-card .stat-value`) are sufficient. If a selector is genuinely fragile (e.g., relies on text that might be localized later), document it in the Dev Agent Record but do NOT add a testid in this story — that'd be scope creep.

5. **Don't expect the stats-bar to be hidden in the empty state.** Verified `dashboard.component.ts:67-71` — the `<app-stats-bar>` element is always rendered for the Owner role, regardless of property count. The empty-state card appears below it. AC-3's "no misleading $0" assertion is satisfied by the empty-state card being visible (which provides the context); it is NOT satisfied by hiding the stats-bar.

6. **Don't write a unit test for the stats-bar component or property-row component.** Those are presentational components already covered by `dashboard.component.spec.ts` and (likely) component-level specs. This story scopes to the **backend handler** unit test + **dashboard page** E2E. Frontend component unit tests are out of scope (no AC covers them).

7. **Don't write an E2E test for the Contributor-role dashboard branch.** The dashboard renders a different template (Receipts + Work Orders shortcut links — verified `dashboard.component.ts:124-148`) when `isOwner() === false`. The seeded `claude@claude.com` account is `Owner`, and 21.4 already covers the Tenant-role dashboard. Contributor-dashboard E2E is unrequested by the epic and is not part of AC-1..AC-3. If desired, file as a follow-up story.

8. **Don't use `BuildMockDbSet().AsQueryable()`.** MockQueryable.Moq v10 (per Story 18.1 / project-context.md:111) extends `ICollection<T>` directly — `.AsQueryable()` is no longer needed and is a hint that the dev is reading old documentation. Use `list.BuildMockDbSet()` exactly.

9. **Don't seed expense/income rows without a valid category for expenses.** The `POST /api/v1/expenses` endpoint requires `categoryId`. Mirror the integration-test helper at `DashboardControllerTests.cs:280-298` — first `GET /api/v1/expense-categories` to get a category id, then POST. Income has no category requirement.

10. **Don't use `page.context().route()` instead of `page.route()`.** The empty-state interception is page-scoped and only needs to apply to the navigation triggered by `dashboardPage.goto()`. Page-level routing is sufficient and cleaner. (Verified Playwright `mock.md` doc April 2026: `page.route` for per-test mocks; `browserContext.route` only when the same mock spans multiple pages.)

11. **Don't mock the auth/login endpoint to skip authentication for the empty-state test.** The `authenticatedUser` fixture handles login via real HTTP and provides a valid JWT. Once logged in, only the `/api/v1/properties` GET needs interception. Mocking auth would defeat the purpose of an E2E smoke test.

12. **Don't assert on exact dollar amounts in AC-2 unless you set them in `beforeAll`.** Use the values you seeded (`$250` expense, `$1500` income → `$1250` net) so assertions are deterministic. Avoid asserting on partial-currency text matches that could fail if the seed amounts ever change.

13. **Don't add a separate test for "stats-bar shows correct sum" in AC-2.2.** The integration tests already pin the math; AC-2.2 only needs to confirm the values rendered are non-zero (i.e. the data flowed end-to-end from API → store → component → DOM). Asserting on exact totals duplicates what `DashboardControllerTests.GetTotals_WithExpensesAndIncome_CalculatesNetCorrectly` already covers.

14. **Don't use `vi.fn()` / Vitest assertions in the E2E spec.** E2E uses Playwright's `expect`. Frontend unit-test imports (`vi.fn`, `vitest`, `HttpTestingController`) are wrong layer. Verified `frontend/e2e/tests/work-orders/work-orders-create.spec.ts` uses `expect` from `'../../fixtures/test-fixtures'` (a re-export of `@playwright/test`'s `expect`).

15. **Don't `cd` into `frontend/` and run `npx vitest` for any test in this story.** Per CLAUDE.md memory note ("Never use `npx vitest` directly for frontend tests"). Backend uses `dotnet test`; E2E uses `npx playwright test` (the correct invocation). No vitest in this story.

### Previous Story Intelligence

**Story 21.9 (done — PR #395, merged most recently)** — Auth handler unit tests, six handlers in `Auth/`. Pattern carry-over for AC-1:
- One file per handler (this story has only one handler → one file). Folder: `backend/tests/PropertyManager.Application.Tests/Dashboard/`.
- Constructor mock setup with `Mock<T>` fields (no `[SetUp]`).
- `Mock.Of<ILogger<HandlerName>>()` — **NOT applicable here**: `GetDashboardTotalsQueryHandler` does NOT inject an `ILogger` (verified `GetDashboardTotals.cs:32-38` — only `IAppDbContext` and `ICurrentUser`). Don't add a logger arg.
- Method naming: `Handle_Scenario_ExpectedResult` (project-context.md:107).
- FluentAssertions for all assertions (`.Should().Be()`, `.Should().NotBeNull()`).
- "Reality check (epic vs. shipped code)" preamble convention — replicated above with the percentage-change/period-comparison reality-check finding.

**Story 21.8 (done — PR #394)** — Work Orders E2E. Pattern carry-over for AC-2 and AC-3:
- Test file structure: `frontend/e2e/tests/{feature}/{feature}.spec.ts` (subdirectory per feature).
- Helper file pattern: `frontend/e2e/helpers/{feature}.helper.ts` with native `fetch` for API seeding (no Playwright `request` fixture). This story creates `dashboard.helper.ts` mirroring `work-order.helper.ts`.
- `beforeAll` seeds, `afterAll` resets via `POST /api/v1/test/reset` — single round-trip per file (per-test reset is too slow).
- `let token: string;` at suite scope; reused across tests.
- Per-test unique strings via `Date.now()` to keep assertions deterministic with shared seed account.
- Verbatim snackbar messages, but **AC-2 and AC-3 don't trigger snackbars** (read-only dashboard view), so this is informational only.
- Re-run-twice rule: AC-5.3 mirrors 21.8's "two consecutive green runs" verification.

**Story 21.7 (done — PR #386)** — Frontend service unit tests for `api.service.ts` and `auth.interceptor.ts`. Confirms the `data: { items: [], totalCount: 0 }` shape used by `GET /api/v1/properties` (verified `api.service.spec.ts:185` references `'/api/v1/dashboard/totals?year=2024'` — a different endpoint, but same `items` + `totalCount` envelope shape used by all list APIs per project-context.md:172).

**Story 21.4 (done)** — Tenant Dashboard E2E. Sister story to this one but for the Tenant-role dashboard. Confirms two patterns: (a) `page.route()` interception for state simulation works cleanly with the `authenticatedUser` fixture, (b) per-test `Date.now()` uniqueness combined with `afterAll` reset is sufficient cleanup. AC-3 in this story uses the same `page.route()` strategy.

**Story 18.1 (done — Issue #319)** — MockQueryable.Moq v10 upgrade. Critical carry-over: use `list.BuildMockDbSet()` directly (no `.AsQueryable()`), and the v10 extension applies to `ICollection<T>`. AC-1 tests in this story rely on this.

**Story 2.2 (done, original `GetAllPropertiesHandler`)** — established the same triple-DbSet (Properties + Expenses + Income) pattern that the dashboard handler uses. The `GetAllPropertiesHandlerTests.cs` is therefore the single best pattern reference for this story.

### Reality check findings (epic vs. shipped code) — summary

This is a **story-creation deviation** from the epic spec. Acceptance for review:

1. **Epic says "percentage-change calculations, period comparisons" — handler does neither.** AC-1 covers what the handler actually does (totals, account isolation, soft-delete exclusion, year/date filtering, boundary inclusivity, null-year fallback). 10 unit tests rather than the epic-implied 3-4. **Recommendation:** if percentage-change is a desired feature, file as a separate story (new PR adds the math + new tests). Don't bolt onto this test-only story.

2. **Epic says "totals card, recent activity, and per-property breakdown" — UI has no recent activity section.** AC-2 covers what's actually rendered (header + stats-bar + property rows). The "per-property breakdown" IS each `app-property-row` with its `expense-value` and `net-value` cells.

3. **Epic implies dashboard component calls `/api/v1/dashboard/totals`** — it doesn't; it calls `/api/v1/properties` and reduces client-side. AC-3's `page.route()` mock targets `/api/v1/properties` accordingly. This is the most likely place the dev workflow could go wrong if it doesn't read the component.

4. **Epic says "alternatively use `page.route()` to simulate empty data" — that IS the chosen strategy** (per CLAUDE.md guidance to prefer `page.route()` over polluting the shared DB account). AC-3 explicitly takes this route.

### Files to create

- `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsQueryHandlerTests.cs` (Task 1) — AC-1
- `frontend/e2e/helpers/dashboard.helper.ts` (Task 2) — supports AC-2
- `frontend/e2e/tests/dashboard/dashboard.spec.ts` (Task 3) — AC-2 + AC-3

### Files to modify

- `docs/project/sprint-status.yaml` — `21-10-dashboard-unit-and-e2e-tests: review` (Task 5.1; create-story already sets this to `ready-for-dev`)
- `docs/project/stories/epic-21/21-10-dashboard-unit-and-e2e-tests.md` — Status + Dev Agent Record (Task 5.2, 5.3)

### Files NOT to modify

- All production code under `backend/src/PropertyManager.Application/Dashboard/` and `frontend/src/app/features/dashboard/` — test-only story.
- `frontend/e2e/pages/dashboard.page.ts` — existing POM is sufficient as-is.
- `frontend/e2e/helpers/work-order.helper.ts` — re-export from `dashboard.helper.ts` rather than modify (keeps blast radius small).
- `backend/tests/PropertyManager.Api.Tests/DashboardControllerTests.cs` — existing integration tests are sufficient and out of scope.
- `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj` — no new package references needed; xUnit + Moq + FluentAssertions + MockQueryable.Moq already present.

### References

- [GetDashboardTotals.cs (handler under test)](../../../backend/src/PropertyManager.Application/Dashboard/GetDashboardTotals.cs) — `GetDashboardTotalsQueryHandler` (line 27), constructor (lines 32-38), Handle (lines 40-74). Verified April 2026.
- [DashboardController.cs](../../../backend/src/PropertyManager.Api/Controllers/DashboardController.cs) — confirms the handler is wired to `GET /api/v1/dashboard/totals` with policy `CanAccessExpenses`.
- [DashboardControllerTests.cs (existing integration coverage — out of scope)](../../../backend/tests/PropertyManager.Api.Tests/DashboardControllerTests.cs) — 8 integration tests verified.
- [IAppDbContext.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs) — `DbSet<Expense> Expenses` (line 16), `DbSet<IncomeEntity> Income` (line 17), `DbSet<Property> Properties` (line 15).
- [ICurrentUser.cs](../../../backend/src/PropertyManager.Application/Common/Interfaces/ICurrentUser.cs) — `Guid AccountId { get; }` is the only member used.
- [GetAllPropertiesHandlerTests.cs (PRIMARY PATTERN REFERENCE for AC-1)](../../../backend/tests/PropertyManager.Application.Tests/Properties/GetAllPropertiesHandlerTests.cs) — same DbSet trio mocking pattern, `_testAccountId`/`_otherAccountId` constructor fields, `SetupXxxDbSet` helper convention.
- [GetAllIncomeHandlerTests.cs](../../../backend/tests/PropertyManager.Application.Tests/Income/GetAllIncomeHandlerTests.cs) — line 377 shows the v10 `BuildMockDbSet()` single-line setup form; line 374 shows manual `DeletedAt == null` filtering at the test seed layer (analogous to handler-side filtering).
- [dashboard.component.ts](../../../frontend/src/app/features/dashboard/dashboard.component.ts) — Owner template (lines 41-122) for AC-2 selector reference; empty-state branch (lines 88-96) for AC-3.
- [property.store.ts](../../../frontend/src/app/features/properties/stores/property.store.ts) — `loadProperties` rxMethod (lines 142-171) confirms `/api/v1/properties` is the endpoint AC-3 must intercept; `totalExpenses` / `totalIncome` / `isEmpty` computed (lines 83-110).
- [property.service.ts](../../../frontend/src/app/features/properties/services/property.service.ts) — line 67 confirms `baseUrl = '/api/v1/properties'`.
- [stats-bar.component.ts](../../../frontend/src/app/shared/components/stats-bar/stats-bar.component.ts) — lines 22-46 confirm the `.stat-card.expense-card .stat-value`, `.income-card .stat-value`, `.net-card .stat-value` selectors used in AC-2.2.
- [property-row.component.ts](../../../frontend/src/app/shared/components/property-row/property-row.component.ts) — lines 31-65 confirm `.property-expense .expense-value` and `.property-net .net-value` selectors used in AC-2.3.
- [empty-state.component.ts](../../../frontend/src/app/shared/components/empty-state/empty-state.component.ts) — lines 17-29 confirm `<h2>` and `<p>` are the title/message containers for AC-3.1.
- [dashboard.page.ts (existing POM — reuse as-is)](../../../frontend/e2e/pages/dashboard.page.ts) — selectors and helpers referenced throughout AC-2, AC-3.
- [work-order.helper.ts (TEMPLATE for `dashboard.helper.ts`)](../../../frontend/e2e/helpers/work-order.helper.ts) — `getAccessTokenForSeededUser` (line 19), `createPropertyViaApi` (line 40), `resetTestDataViaApi` (line 158) — re-exported or duplicated.
- [work-orders-create.spec.ts (TEMPLATE for `dashboard.spec.ts` structure)](../../../frontend/e2e/tests/work-orders/work-orders-create.spec.ts) — `beforeAll`/`afterAll` cleanup pattern (lines 31-41), describe block structure.
- [test-fixtures.ts](../../../frontend/e2e/fixtures/test-fixtures.ts) — `dashboardPage`, `authenticatedUser` fixtures already wired (lines 104-105, 165-176).
- [PropertyManager.Application.Tests.csproj](../../../backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj) — confirms package versions: `Moq 4.20.72`, `FluentAssertions 8.9.0`, `xunit 2.9.3`, `MockQueryable.Moq 10.0.5`.
- [Story 21.9 (done — most recent prior story in epic)](./21-9-auth-handler-unit-tests.md) — handler-unit-test pattern, "Reality check" preamble convention.
- [Story 21.8 (done)](./21-8-work-orders-e2e.md) — E2E spec structure, `afterAll` reset pattern, helper-file convention, two-consecutive-runs rule.
- [Story 21.4 (done)](./21-4-tenant-dashboard-e2e.md) — `page.route()` empty-state strategy precedent for tenant dashboard; same approach for owner dashboard here.
- [Story 18.1 (done — Issue #319)](../epic-18/18-1-upgrade-mockqueryable-moq.md) — MockQueryable.Moq v10 upgrade; v10 pattern enforced repo-wide.
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic. Story 21.10 spec at line 487-521.
- [Playwright `page.route` + modify-api-responses doc (verified April 2026 via Ref MCP)](https://github.com/microsoft/playwright/blob/main/docs/src/mock.md) — `route.fulfill({ status, contentType, body })` API for the empty-state mock.
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit that spawned this epic.
- CLAUDE.md → "E2E Testing Rules (Playwright)" — `page.route()` empty-data strategy guidance; rate limiting disabled in dev/CI; `--workers=1` rule.
- project-context.md:107-141 — backend testing standards (xUnit + Moq + FluentAssertions + MockQueryable.Moq v10), E2E standards (`e2e/tests/{feature}/`, POM in `e2e/pages/`, `test`/`expect` import from `e2e/fixtures/test-fixtures`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Claude Code dev-story workflow).

### Debug Log References

- **Backend filtered run:** `dotnet test --filter "FullyQualifiedName~PropertyManager.Application.Tests.Dashboard"` → **Passed! Failed: 0, Passed: 10, Skipped: 0, Total: 10, Duration: 150 ms**.
- **Backend full suite:** `dotnet test` →
  - PropertyManager.Application.Tests.dll: **Passed! Failed: 0, Passed: 1221, Total: 1221, Duration: 879 ms**
  - PropertyManager.Infrastructure.Tests.dll: **Passed! Failed: 0, Passed: 98, Total: 98, Duration: 6 s**
  - PropertyManager.Api.Tests.dll: **Failed! Failed: 1, Passed: 790, Total: 791, Duration: 19 s** — the single failure is `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` (pre-existing on `main`, unrelated to this story; orchestrator flagged it).
- **Frontend Vitest:** `npm test` → **123 passed (123) test files, 2768 passed (2768) tests, 7.11 s**. Zero regressions.
- **Dashboard E2E (run 1):** `npx playwright test e2e/tests/dashboard/dashboard.spec.ts --workers=1` → **3 passed (3.0s)**.
- **Dashboard E2E (run 2):** **3 passed (2.5s)**. Deterministic per Story 21.8 rule.

### Completion Notes List

**TDD discipline:** unit tests written against the actual handler shape (totals + property count + soft-delete filter + account isolation + date range + null-year fallback + boundary inclusivity), not the epic's hallucinated percentage-change/period-comparison contract. Each `[Fact]` was authored against a precise reading of `GetDashboardTotals.cs` (lines 40-74). All 10 tests passed on the first compile-and-run cycle — no red phase needed because the SUT is already shipped and stable.

**File-by-file LOC:**
- `GetDashboardTotalsQueryHandlerTests.cs`: 367 lines (10 `[Fact]` methods + 6 helpers).
- `dashboard.helper.ts`: 109 lines (2 new exports + 3 re-exports).
- `dashboard.spec.ts`: 169 lines (3 tests in one describe + `pastDateThisYear()` helper + `beforeAll/afterAll`).

**Anti-pitfall confirmations:**
1. No percentage-change tests — handler does not perform that math.
2. Empty-state mock targets `**/api/v1/properties**`, NOT `/api/v1/dashboard/totals` (which the dashboard component never calls).
3. Stats-bar is not asserted hidden — it is unconditionally rendered for Owner role; the empty-state CARD is the source of context for `$0`.
4. Zero data-testids added; selectors are CSS/component-tag-based.
5. `BuildMockDbSet()` used directly — no `.AsQueryable()` (MockQueryable.Moq v10).
6. Production code: **zero modifications** (verified — only test files and process docs touched).

**Deviation from story spec:** Task 3.5 originally specified `currentYearDate('06-15')` (a fixed June 15) for the seeded date. This was changed to a `pastDateThisYear()` helper that returns *yesterday* in the current year. The original date failed in the running environment because today's date is May 1 of the current year — June 15 is in the future, and the API's expense/income validators reject future dates with `400 {"errors":{"Date":["Date cannot be in the future"]}}`. The replacement helper is robust to any calendar position while still landing inside the dashboard's default `this-year` preset.

**Pre-existing failure (documented):** `PropertyManager.Api.Tests.TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` fails on `main` because the test fixture creates an expense whose `Date` is in the future. Independently, the dev-database test reset has a related FK issue: `TestController.Reset` does not include `MaintenanceRequests` in its FK-safe delete order, so when prior test runs leave MRs behind, subsequent reset attempts fail with `23503 violates foreign key constraint "FK_MaintenanceRequests_Properties_PropertyId"`. The work-order helper's reset is best-effort (catches the 500 and logs a warning), so this does not break the test run, but the dev DB stays polluted across runs. Both issues are out of scope for this test-only story; recommend filing follow-up.

### File List

**Created (test-only):**
- `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsQueryHandlerTests.cs` — 10 `[Fact]` methods.
- `frontend/e2e/helpers/dashboard.helper.ts` — `createExpenseViaApi`, `createIncomeViaApi`, `getFirstExpenseCategoryId` (private); re-exports `getAccessTokenForSeededUser`, `createPropertyViaApi`, `resetTestDataViaApi`.
- `frontend/e2e/tests/dashboard/dashboard.spec.ts` — 3 Playwright tests (AC-2, AC-3, AC-3.3) + `pastDateThisYear()` helper.

**Modified (process docs only):**
- `docs/project/sprint-status.yaml` — `21-10-dashboard-unit-and-e2e-tests` changed from `ready-for-dev` → `in-progress` → `review`.
- `docs/project/stories/epic-21/21-10-dashboard-unit-and-e2e-tests.md` — Status `ready-for-dev` → `review`; tasks marked `[x]`; Dev Agent Record filled in.

**Production code:** zero modifications — verified against `git diff main -- backend/src frontend/src`.
