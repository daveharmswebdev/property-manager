# Story 21.12: Pagination Edge Case Tests

Status: done

## Story

As a developer,
I want pagination edge case coverage on every list endpoint that actually paginates (`GET /api/v1/expenses`, `GET /api/v1/properties/{id}/expenses`, `GET /api/v1/maintenance-requests`),
so that page-boundary, empty-page, and over-request scenarios — and the inconsistencies between handlers' clamping rules — are pinned by tests and a follow-up issue is filed for the divergence.

## Acceptance Criteria

> **Reality check (epic vs. shipped controllers) — read this before writing any test.**
>
> The epic spec (`epic-21-epics-test-coverage.md` § Story 21.12) lists "Properties, Expenses, Vendors, WorkOrders, MaintenanceRequests" as paginated list endpoints. A repo-wide audit (May 2026) of every `GetAll*` query handler and corresponding controller `[HttpGet]` action found:
>
> | Endpoint | Paginates? | Source-of-truth file |
> |---|---|---|
> | `GET /api/v1/properties` | **No** — `GetAllPropertiesQuery` is parameterless; handler returns the full list. No `page`/`pageSize`. | `backend/src/PropertyManager.Api/Controllers/PropertiesController.cs:51`, `GetAllProperties.cs` |
> | `GET /api/v1/expenses` | **Yes** — `Page` (default 1) and `PageSize` (default 50, **clamped to [1,100]**) | `ExpensesController.cs:152-187`, `GetAllExpenses.cs:122-127` |
> | `GET /api/v1/properties/{id}/expenses` | **Yes** — `Page` (default 1) and `PageSize` (default 25, **clamped to [1,100]**); empty-list TotalPages == 1 (NOT 0 — see inconsistency below) | `ExpensesController.cs:278-297`, `GetExpensesByProperty.cs:74-78` |
> | `GET /api/v1/income` | **No** — `GetAllIncomeQuery` has no `Page`/`PageSize`; handler returns full account-scoped list. | `IncomeController.cs:52-73`, `GetAllIncome.cs` |
> | `GET /api/v1/vendors` | **No** — `GetAllVendorsQuery` is parameterless; handler returns full account-scoped list ordered by LastName, FirstName. | `VendorsController.cs:52-55`, `GetAllVendors.cs` |
> | `GET /api/v1/work-orders` | **No** — `GetAllWorkOrdersQuery(string? status, Guid? propertyId)` has no pagination params; handler returns the filtered list with `TotalCount = items.Count`. | `WorkOrdersController.cs:60-80`, `GetAllWorkOrders.cs` |
> | `GET /api/v1/maintenance-requests` | **Yes** — `Page` (default 1) and `PageSize` (default 20). Handler **does NOT clamp** — see Inconsistencies below. | `MaintenanceRequestsController.cs:88-100`, `GetMaintenanceRequests.cs:14-15, 78-108` |
>
> **Three endpoints actually paginate.** Properties, Income, Vendors, and WorkOrders return un-paginated lists; the epic's list was aspirational/anticipatory. **This story scopes to the three real paginated endpoints.** If product wants pagination on Vendors / WorkOrders / Income / Properties, that is a separate story (and would be a behavior change to those handlers, not test work).
>
> **Three handler inconsistencies surface from the audit.** They are real bugs/divergences in shipped behavior:
>
> | Inconsistency | `GetAllExpenses` | `GetExpensesByProperty` | `GetMaintenanceRequests` |
> |---|---|---|---|
> | `Math.Clamp(PageSize, 1, 100)` | YES | YES | **NO — uses raw `request.PageSize`** |
> | `Math.Max(1, Page)` | YES | YES | **NO — uses raw `request.Page`** |
> | Empty-list `TotalPages` value | `0` (`Math.Ceiling(0/pageSize)`) | `1` (explicit `totalCount == 0 ? 1 : ...`) | `0` (same Ceiling math, but only when `pageSize > 0`) |
> | `pageSize=0` request | clamped to 1 | clamped to 1 | divides by zero in `Math.Ceiling((double)totalCount / 0)` → `Infinity` cast to int (undefined / huge) AND returns 0 items because `Take(0)` returns empty |
> | `page=0` (or negative) | clamped to 1 | clamped to 1 | `Skip((0 - 1) * pageSize) = Skip(-pageSize)` → throws `ArgumentOutOfRangeException` at LINQ enumeration |
>
> **AC-FOLLOWUP-1 below mandates filing a GitHub issue for these divergences. This story does NOT fix the handlers** (per epic AC-3 "If AC-3 surfaces a real bug, do NOT silently fix it inside this story — flag it"). Tests assert the **shipped** (broken) behavior so the test suite documents it; the follow-up issue tracks the cleanup work.

### AC-1: `GET /api/v1/expenses` — pagination edge case block (clamped behavior)

For every test below: an authenticated Owner makes the request; assertions are on the response body parsed as `PagedExpenseListResponse` (the file-record DTO already declared in `ExpensesControllerTests.cs`).

- **AC-1.1: page=1 with fewer results than pageSize returns all results, TotalPages=1, Page=1**
  - **Given** an Owner with 3 expenses
  - **When** they `GET /api/v1/expenses?page=1&pageSize=50`
  - **Then** the response is `200 OK`, `items.Count == 3`, `totalCount == 3`, `page == 1`, `pageSize == 50`, `totalPages == 1`
  - **Note:** `GetAllExpenses_WithPageSize_RespectsPageSize` (existing) already covers a 5-of-2 case at line ~1271, but no existing test pins the "page=1 with results < pageSize" boundary. Add an explicit test.

- **AC-1.2: page beyond last page returns empty `items` but preserves `Page`, `TotalCount`, `TotalPages`**
  - **Given** an Owner with 3 expenses
  - **When** they `GET /api/v1/expenses?page=10&pageSize=50`
  - **Then** the response is `200 OK`, `items` is empty, `page == 10` (echoed verbatim — handler does NOT round-trip-correct), `totalCount == 3`, `totalPages == 1`
  - **Note:** `GetAllExpenses_PageBeyondLast_ReturnsEmptyItems` already exists at line 1552. **Verify it covers the assertions above** (it currently does); **if any AC-1.2 assertion is missing from the existing test, augment that test** rather than duplicate.

- **AC-1.3: pageSize=0 is clamped to 1 (handler uses `Math.Clamp(PageSize, 1, 100)`)**
  - **Given** an Owner with 3 expenses
  - **When** they `GET /api/v1/expenses?pageSize=0`
  - **Then** the response is `200 OK`, `pageSize == 1`, `items.Count == 1`, `totalCount == 3`, `totalPages == 3`
  - **Note:** No existing test in `ExpensesControllerTests.cs` covers `pageSize=0` on `GET /expenses`. Add one. Pattern: mirror `GetExpensesByProperty_PageSizeZero_Clamped` (line 1798) but for the all-expenses endpoint.

- **AC-1.4: pageSize larger than max (100) is clamped to 100**
  - **Given** an Owner authenticated (no expenses needed)
  - **When** they `GET /api/v1/expenses?pageSize=500`
  - **Then** the response is `200 OK` and `pageSize == 100`
  - **Note:** `GetAllExpenses_PageSizeOverMax_ClampedTo100` at line 1570 already covers this. **No new test needed; verify and reference.**

- **AC-1.5: page=0 (or negative) is clamped to 1 (handler uses `Math.Max(1, Page)`)**
  - **Given** an Owner with 3 expenses
  - **When** they `GET /api/v1/expenses?page=0&pageSize=50` (and a separate sub-case `?page=-5&pageSize=50`)
  - **Then** the response is `200 OK`, `page == 1`, `items.Count == 3`
  - **Note:** No existing test pins `page=0` / negative-page behavior on `GET /expenses`. Add. Use `[Theory] [InlineData(0)] [InlineData(-1)] [InlineData(-100)]`, OR two `[Fact]`s — match the file's existing style (look at neighboring tests). Either way, assert the clamped `Page == 1` AND the items count.

- **AC-1.6: empty list returns `TotalPages == 0` (NOT 1) — pins the divergence with `GetExpensesByProperty`**
  - **Given** an Owner with zero expenses
  - **When** they `GET /api/v1/expenses?page=1&pageSize=50`
  - **Then** the response is `200 OK`, `items` is empty, `totalCount == 0`, `totalPages == 0`
  - **Note:** `GetAllExpenses_NoExpenses_ReturnsEmptyList` at line 1196 already covers this exact case (asserts `totalPages == 0` at line 1210). **No new test needed; reference in Dev Notes that the assertion already pins the inconsistency vs. `GetExpensesByProperty`'s `TotalPages == 1`.**

### AC-2: `GET /api/v1/properties/{id}/expenses` — pagination edge case block (clamped behavior; empty TotalPages == 1)

- **AC-2.1: page=1 with fewer results than pageSize returns all results, TotalPages=1, Page=1**
  - **Given** an Owner with one property containing 3 expenses
  - **When** they `GET /api/v1/properties/{id}/expenses?page=1&pageSize=25`
  - **Then** the response is `200 OK`, `items.Count == 3`, `totalCount == 3`, `page == 1`, `pageSize == 25`, `totalPages == 1`
  - **Note:** `GetExpensesByProperty_ReturnsPagedWithYtdTotal_OrderedByDateDesc` covers a similar happy path; **add an explicit AC-2.1 test** if the existing one doesn't pin all four pagination fields.

- **AC-2.2: page beyond last returns empty `items` but preserves `Page`, `TotalCount`, `TotalPages`**
  - **Given** an Owner with one property containing 3 expenses
  - **When** they `GET /api/v1/properties/{id}/expenses?page=10&pageSize=25`
  - **Then** the response is `200 OK`, `items` is empty, `page == 10`, `totalCount == 3`, `totalPages == 1`
  - **Note:** No existing test. Add. Pattern: mirror `GetAllExpenses_PageBeyondLast_ReturnsEmptyItems` at line 1552.

- **AC-2.3: pageSize=0 is clamped to 1 (already covered, AC-2.3 verifies and references)**
  - **Given** an Owner with one property containing 3 expenses
  - **When** they `GET /api/v1/properties/{id}/expenses?pageSize=0`
  - **Then** the response is `200 OK`, `pageSize == 1`, `items.Count == 1`
  - **Note:** `GetExpensesByProperty_PageSizeZero_Clamped` at line 1798 already covers `PageSize == 1` clamping. **Augment it** to also assert `items.Count == 1` (currently only asserts `PageSize`). Do NOT add a new `[Fact]`.

- **AC-2.4: pageSize larger than max (100) is clamped to 100 (already covered)**
  - **Note:** `GetExpensesByProperty_PageSizeOverMax_ClampedTo100` at line 1786 already covers this. **No new test needed; reference in Dev Notes.**

- **AC-2.5: page=0 (or negative) is clamped to 1**
  - **Given** an Owner with one property containing 3 expenses
  - **When** they `GET /api/v1/properties/{id}/expenses?page=0&pageSize=25` (and a separate sub-case `?page=-5&pageSize=25`)
  - **Then** the response is `200 OK`, `page == 1`, `items.Count == 3`
  - **Note:** No existing test for `page=0` / negative on this endpoint. Add. Mirror AC-1.5 style.

- **AC-2.6: empty property returns `TotalPages == 1` (NOT 0) — pins the divergence with `GetAllExpenses`**
  - **Given** an Owner with one property and zero expenses on it
  - **When** they `GET /api/v1/properties/{id}/expenses?page=1&pageSize=25`
  - **Then** the response is `200 OK`, `items` is empty, `totalCount == 0`, `totalPages == 1`, `ytdTotal == 0`
  - **Note:** `GetExpensesByProperty_EmptyProperty_ReturnsEmptyWith_TotalPages_1_AndYtdTotal_Zero` at line ~1748 already covers this. **No new test needed; reference in Dev Notes that the assertion already pins the inconsistency vs. `GetAllExpenses`'s `TotalPages == 0`.**

### AC-3: `GET /api/v1/maintenance-requests` — pagination edge case block (un-clamped, divergent behavior)

For every test below: an Owner authenticated and seeded with maintenance requests via `SeedMaintenanceRequestAsync` (existing helper at the bottom of `MaintenanceRequestsControllerTests.cs`); assertions on `GetMaintenanceRequestsResponseDto` (file-record at line 742).

- **AC-3.1: page=1 with fewer results than pageSize returns all, TotalPages=1, Page=1**
  - **Given** an Owner with 3 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?page=1&pageSize=20`
  - **Then** the response is `200 OK`, `items.Count == 3`, `totalCount == 3`, `page == 1`, `pageSize == 20`, `totalPages == 1`
  - **Note:** No existing test pins this exact boundary. `GetMaintenanceRequests_AsOwner_ReturnsAccountScopedList` covers happy-path but with default pagination params not asserted. Add an explicit test.

- **AC-3.2: page beyond last returns empty `items` but preserves `Page`, `TotalCount`, `TotalPages`**
  - **Given** an Owner with 5 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?page=10&pageSize=20`
  - **Then** the response is `200 OK`, `items` is empty, `page == 10`, `totalCount == 5`, `totalPages == 1`
  - **Note:** No existing test. Add.

- **AC-3.3: pageSize=0 — assert the un-clamped (broken) shipped behavior; flag for follow-up**
  - **Given** an Owner with 5 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?pageSize=0`
  - **Then** assert the **actual** shipped behavior (per audit-finding above):
    - The response is **NOT a 4xx** — the handler does not validate or clamp; it executes the query.
    - `Math.Ceiling(5 / 0.0)` → `double.PositiveInfinity` → cast to `int` is **`int.MinValue`** in .NET (per [`Convert.ToInt32(double)` overflow semantics](https://learn.microsoft.com/dotnet/api/system.convert.toint32?view=net-10.0)) — verify in dev with a real run and assert the actual integer the handler returns.
    - `Take(0)` returns an empty list, so `items.Count == 0`.
    - `pageSize == 0` is echoed back verbatim.
  - **What to write:** the dev runs the test once with a "loose" assertion (e.g., `content.Should().NotBeNull()` only) to capture the actual `totalPages` integer, then tightens to that exact value. Document in the Dev Agent Record what the captured value was. **DO NOT fix the handler** — tightening to exact value is the point: the test will fail loudly if the handler is later fixed (which is the right outcome — it forces an update to AC-3 then).
  - **AC-FOLLOWUP-1 file-issue trigger:** this AC is the surfaced divergence per epic AC-3.

- **AC-3.4: pageSize larger than max (no max) — `pageSize=500` returns up to 500 items un-clamped**
  - **Given** an Owner with 30 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?pageSize=500`
  - **Then** the response is `200 OK`, `items.Count == 30` (all of them — no clamping), `pageSize == 500` (echoed verbatim), `totalCount == 30`, `totalPages == 1`
  - **AC-FOLLOWUP-1 file-issue trigger:** divergence with the Expenses endpoints (which clamp at 100).

- **AC-3.5: page=0 — assert the un-clamped (broken) shipped behavior**
  - **Given** an Owner with 5 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?page=0&pageSize=20`
  - **Then** assert the **actual** shipped behavior. The handler computes `Skip((0 - 1) * 20) = Skip(-20)`; depending on EF Core's PostgreSQL provider, this either:
    - Throws `ArgumentOutOfRangeException` from LINQ → `500 Internal Server Error` mapped by `GlobalExceptionHandlerMiddleware`, OR
    - Translates to SQL `OFFSET -20` which PostgreSQL **rejects with `ERROR: OFFSET must not be negative`** → `500` from EF Core.
  - **What to write:** the dev runs the test once to capture the actual response status (likely `500`). Assert the captured status. If it is in fact `500`, also assert the response body is a `ProblemDetails` with `status == 500`. **DO NOT fix the handler.**
  - **AC-FOLLOWUP-1 file-issue trigger:** this is unambiguous: returning 500 for client-side input is a server bug.
  - **Per `feedback_close_stale_issues`:** verify the actual status with a one-off dev run BEFORE assuming 500. The /dev-story workflow's first action on this AC is "run a dummy E2E to capture the real failure mode." Then encode it.

- **AC-3.6: page=-5 (negative) — same as AC-3.5; same un-clamped failure mode**
  - **Given** an Owner with 5 maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?page=-5&pageSize=20`
  - **Then** assert the same response status as AC-3.5 (the failure mode is identical for any `page <= 0`).
  - **Note:** This may be a `[Theory]` with `[InlineData(0)] [InlineData(-1)] [InlineData(-100)]` paired with AC-3.5 to keep the test count down. Match the file's existing pagination test style — `GetMaintenanceRequests_Pagination_Page2PageSize10` is a `[Fact]`, so two `[Fact]`s is fine, OR a `[Theory]` is fine — whichever produces the cleanest failure message.

- **AC-3.7: empty account returns `TotalPages == 0` (same as `GetAllExpenses`, divergent from `GetExpensesByProperty`)**
  - **Given** an Owner with zero maintenance requests
  - **When** they `GET /api/v1/maintenance-requests?page=1&pageSize=20`
  - **Then** the response is `200 OK`, `items` is empty, `totalCount == 0`, `totalPages == 0` (`Math.Ceiling(0.0 / 20)` → 0)
  - **Note:** `GetMaintenanceRequests_EmptyAccount_ReturnsEmptyList` at line 420 already covers this happy-path but **does not assert `TotalPages`**. **Augment it** to add the assertion `content.TotalPages.Should().Be(0)`. Do NOT add a new `[Fact]`.

### AC-4: A follow-up GitHub issue is filed documenting the three handler divergences

- **AC-4.1:** A new GitHub issue is filed (via `gh issue create` — see Tasks for the exact body) titled **"Pagination handler inconsistencies across paginated list endpoints"** with the three handler files (`GetAllExpenses.cs`, `GetExpensesByProperty.cs`, `GetMaintenanceRequests.cs`) and the divergence table reproduced from the Reality Check above.
- **AC-4.2:** The issue references this story (Story 21.12) and the parent epic issue (#371) as related.
- **AC-4.3:** The issue does NOT include a fix — only the diagnosis and proposed unified contract (e.g., "all paginated handlers should `Math.Clamp(PageSize, 1, MaxPageSize)` and `Math.Max(1, Page)`; empty-list TotalPages should be 0 OR 1 unanimously"). The issue is left open for later prioritization.
- **AC-4.4:** Document the issue URL/number in the Dev Agent Record File List section under "GitHub artifacts."

### AC-5: Existing pagination tests are NOT regressed; net-new test count is documented

- **AC-5.1:** All tests in `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` and `MaintenanceRequestsControllerTests.cs` continue to pass after this story's additions (`dotnet test --filter "FullyQualifiedName~ExpensesControllerTests | FullyQualifiedName~MaintenanceRequestsControllerTests"`).
- **AC-5.2:** The full backend suite passes: `cd backend && dotnet test` (allowing for the documented pre-existing `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` failure noted in Story 21.10 — same baseline as 21.11).
- **AC-5.3:** `dotnet build` is clean (zero new warnings).
- **AC-5.4:** Net-new test count is documented in Dev Agent Record. Approximate target (per ACs above): 5 net-new in `ExpensesControllerTests.cs`, 5 net-new in `MaintenanceRequestsControllerTests.cs`, plus 2 augmented existing tests. Final exact counts confirmed at handoff.

### AC-6: Test scope justification (process AC — addressed in Dev Notes, not implemented as a test)

- **AC-6.1:** This story is **integration-test-only**. Per Test Scope table:
  - **Unit tests:** NOT REQUIRED — there is no new validator, no new handler, no new domain logic. The story exercises pre-existing handler pagination behavior at the HTTP level.
  - **Integration tests:** REQUIRED — this is the heart of the story. Tests live in `ExpensesControllerTests.cs` and `MaintenanceRequestsControllerTests.cs` and use `PropertyManagerWebApplicationFactory` per the `feedback_bmad_what_works` integration convention.
  - **E2E tests:** NOT REQUIRED — pagination edge cases are tested at the API contract layer; there is no user-facing UI for `?page=0` / `?pageSize=500`. The tenant dashboard and expense list use clamped UI controls; no user can produce these requests through the app.

## Tasks / Subtasks

- [x] **Task 1: Pre-flight — confirm shipped behavior with one-off probes (AC-3.3, AC-3.5)**
  - [x] 1.1 Spin up the backend (`docker compose up -d db && cd backend && dotnet run --project src/PropertyManager.Api`).
  - [x] 1.2 Authenticate as the seeded Owner (`claude@claude.com` / `1@mClaude`) via `POST /api/v1/auth/login` and capture the JWT.
  - [x] 1.3 Seed at least 5 maintenance requests for that account (use the existing tenant invitation flow OR direct database insert via psql).
  - [x] 1.4 Probe `GET /api/v1/maintenance-requests?pageSize=0` and capture: HTTP status, response body (parse `totalPages`).
  - [x] 1.5 Probe `GET /api/v1/maintenance-requests?page=0&pageSize=20` and capture: HTTP status, response body shape (likely `ProblemDetails` with status 500).
  - [x] 1.6 Document the captured values in the Dev Agent Record's "Debug Log References" so AC-3.3 and AC-3.5 assertions can be tightened to actual integers/status codes.
  - **Probe approach used:** rather than spinning up a separate dev backend + psql + curl, the probe was performed via the WebApplicationFactory test fixture (faster, deterministic, same DI/EF/PostgreSQL stack via Testcontainers). Tests were written with the predicted-but-loose assertion first, run once to capture actuals, then tightened. See "Debug Log References" below.

- [x] **Task 2: Augment existing tests in `ExpensesControllerTests.cs` (AC-2.3)**
  - [x] 2.1 Open `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs`.
  - [x] 2.2 In `GetExpensesByProperty_PageSizeZero_Clamped` (line 1798), add `content.Items.Should().HaveCount(1)` after the existing `PageSize` assertion. **Path chosen:** added seeding of 3 expenses inside the augmented test (lower friction than splitting into a separate `[Fact]`; preserves the test name and comment line `// Math.Clamp(0, 1, 100) == 1`).
  - [x] 2.3 Run `dotnet test --filter "FullyQualifiedName~GetExpensesByProperty"` — confirm green.

- [x] **Task 3: Add new pagination edge case tests to `ExpensesControllerTests.cs` (AC-1.1, AC-1.3, AC-1.5; AC-2.1, AC-2.2, AC-2.5)**
  - [x] 3.1 In the `#region GET /expenses` block, add `GetAllExpenses_Page1WithFewerResultsThanPageSize_ReturnsAllAndTotalPages1` (AC-1.1).
  - [x] 3.2 In the same block, add `GetAllExpenses_PageSizeZero_ClampedToOne` (AC-1.3).
  - [x] 3.3 In the same block, add `GetAllExpenses_PageZeroOrNegative_ClampedToOne` (AC-1.5) as a `[Theory]` with `[InlineData(0)] [InlineData(-1)] [InlineData(-100)]`.
  - [x] 3.4 In the `#region GET /properties/{id}/expenses` block, add `GetExpensesByProperty_Page1WithFewerResultsThanPageSize_ReturnsAllAndTotalPages1` (AC-2.1).
  - [x] 3.5 In the same block, add `GetExpensesByProperty_PageBeyondLast_ReturnsEmptyItems` (AC-2.2).
  - [x] 3.6 In the same block, add `GetExpensesByProperty_PageZeroOrNegative_ClampedToOne` (AC-2.5) as a `[Theory]`.
  - [x] 3.7 Run `dotnet test --filter "FullyQualifiedName~ExpensesControllerTests"` — confirm green (124/124 passed).

- [x] **Task 4: Add new pagination edge case tests to `MaintenanceRequestsControllerTests.cs` (AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6, AC-3.7)**
  - [x] 4.1 Open `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`.
  - [x] 4.2 Locate the existing `GetMaintenanceRequests_Pagination_Page2PageSize10` — added new tests adjacent in code order via a `// Story 21.12 — Pagination edge cases (AC-3.*)` block (file did not previously use `#region`).
  - [x] 4.3 Add `GetMaintenanceRequests_Page1WithFewerResultsThanPageSize_ReturnsAllAndTotalPages1` (AC-3.1).
  - [x] 4.4 Add `GetMaintenanceRequests_PageBeyondLast_ReturnsEmptyItems` (AC-3.2).
  - [x] 4.5 Add `GetMaintenanceRequests_PageSizeZero_ReturnsEmptyAndUnclampedTotalPages` (AC-3.3) — asserts `TotalPages == int.MaxValue` (captured value, see Debug Log).
  - [x] 4.6 Add `GetMaintenanceRequests_PageSize500_ReturnsAllUnclamped` (AC-3.4) — seeds 30 requests, asserts `items.Count == 30` and `pageSize == 500`.
  - [x] 4.7 Add `GetMaintenanceRequests_PageZeroOrNegative_Returns500` (AC-3.5, AC-3.6) as a `[Theory]` with `[InlineData(0)] [InlineData(-1)] [InlineData(-100)]`. Asserts `HttpStatusCode.InternalServerError`. (Did not assert `ProblemDetails`-shape because in Development mode the GlobalExceptionHandlerMiddleware emits a non-`ProblemDetails` JSON envelope; just status-code assertion is sufficient and avoids coupling tests to the dev-mode middleware shape.)
  - [x] 4.8 Augment `GetMaintenanceRequests_EmptyAccount_ReturnsEmptyList` to add `content.TotalPages.Should().Be(0)` assertion (AC-3.7).
  - [x] 4.9 Run `dotnet test --filter "FullyQualifiedName~MaintenanceRequestsControllerTests"` — confirm green (34/34 passed).

- [x] **Task 5: File the follow-up GitHub issue (AC-4)**
  - [x] 5.1 Use `gh issue create` with title: **"Pagination handler inconsistencies across paginated list endpoints"**.
  - [x] 5.2 Body: includes the divergence table, source-file paths, references to Story 21.12 and epic issue #371, and the actual captured AC-3.3/AC-3.5 values.
  - [x] 5.3 Labels: only `bug` exists in this repo (verified via `gh label list`); `tech-debt` and `backend` do not. Applied `bug` only.
  - [x] 5.4 Captured: **issue #402** at https://github.com/daveharmswebdev/property-manager/issues/402.

- [x] **Task 6: Verify, no regressions, scope guards (AC-5)**
  - [x] 6.1 `cd backend && dotnet build` — clean (no new warnings; only pre-existing CS0618/CA1416/CS8619 — same baseline).
  - [x] 6.2 `cd backend && dotnet test` — full suite green: **2127/2127** (1221 Application + 98 Infrastructure + 808 Api). The `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` test mentioned in the story did not fail in this run.
  - [x] 6.3 `git diff --stat main -- backend/src` — confirmed **empty**. Zero production source changes.
  - [x] 6.4 `git diff --stat main -- backend/tests` — confirmed two files: `ExpensesControllerTests.cs` (+152) and `MaintenanceRequestsControllerTests.cs` (+150).
  - [x] 6.5 Net-new tests via `git diff main -- 'backend/tests/**/*Tests.cs' | grep -cE "^\+    \[Fact\]|^\+    \[Theory\]"` = **11** new attribute lines (6 Expenses + 5 Maintenance). Plus 2 augmented existing tests (AC-2.3, AC-3.7). Total tests touched: 13.

- [x] **Task 7: Sprint status + story status update (process)**
  - [x] 7.1 Updated `docs/project/sprint-status.yaml`: `21-12-pagination-edge-case-tests: review`.
  - [x] 7.2 Set this story's `Status:` line to `review`.
  - [x] 7.3 Filled out Dev Agent Record below.

## Dev Notes

### Test Scope

| Layer | Required? | Justification |
|---|---|---|
| **Unit tests (xUnit + Moq + FluentAssertions)** | **Not required** | No new handler, validator, or domain rule. The story tests pre-existing handler pagination behavior at the HTTP layer where it matters (clamping is at the boundary between the wire format and the EF Core query). Unit-testing the handler's `Math.Clamp` math directly would duplicate the integration assertions without exercising the real LINQ → EF Core → SQL → response shape pipeline. |
| **Integration tests (.NET WebApplicationFactory)** | **REQUIRED — this is the heart of the story** | Three paginated endpoints, six-to-eight new edge-case `[Fact]`s/`[Theory]`s per endpoint, plus two augmented existing tests. Lives in the existing `ExpensesControllerTests.cs` and `MaintenanceRequestsControllerTests.cs` files using the existing `PropertyManagerWebApplicationFactory` fixture. No new test files. |
| **E2E tests (Playwright)** | **Not required** | Pagination edge cases (`?page=0`, `?pageSize=500`) are not user-reachable through the UI — the expense list and maintenance request list use clamped UI controls (Material `mat-paginator` and the work-orders cap). The risk surface is malicious/scripted clients hitting the API directly, which is the integration-test surface. |

### Pagination Contract (Verified — read from controller + handler source May 2026)

**`GET /api/v1/expenses` (`ExpensesController.cs:148-187` → `GetAllExpenses.cs:122-127`)**
- Default `Page = 1`, `PageSize = 50`, max `PageSize = 100`.
- `pageSize` clamped: `Math.Clamp(request.PageSize, 1, 100)` — value 0 becomes 1, value 500 becomes 100.
- `page` clamped: `Math.Max(1, request.Page)` — value 0 or negative becomes 1.
- `totalPages = Math.Ceiling(totalCount / (double)pageSize)` — empty list yields **0**.
- Skip beyond last page returns empty `items` but echoes `Page` verbatim (e.g., `?page=10` on a 1-page result returns `page=10, items=[]`).
- Response shape: `PagedResult<ExpenseListItemDto>` (`Items`, `TotalCount`, `Page`, `PageSize`, `TotalPages`, `TotalAmount`).

**`GET /api/v1/properties/{id}/expenses` (`ExpensesController.cs:273-297` → `GetExpensesByProperty.cs:74-78`)**
- Default `Page = 1`, `PageSize = 25`, max `PageSize = 100`.
- `pageSize` clamped: `Math.Clamp(request.PageSize, 1, 100)` — same as above.
- `page` clamped: `Math.Max(1, request.Page)` — same as above.
- `totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize)` — empty list yields **1** (the divergence vs. `GetAllExpenses`).
- Skip beyond last page returns empty `items` but echoes `Page` verbatim.
- Response shape: `PagedExpenseListDto` (`Items`, `TotalCount`, `Page`, `PageSize`, `TotalPages`, `YtdTotal`).

**`GET /api/v1/maintenance-requests` (`MaintenanceRequestsController.cs:88-100` → `GetMaintenanceRequests.cs:50-108`)**
- Default `Page = 1`, `PageSize = 20`, max `PageSize` is **NOT enforced** (no clamp).
- `pageSize` is **NOT clamped** — passed raw to `Skip`/`Take` and `Math.Ceiling`.
- `page` is **NOT clamped** — passed raw to `Skip((Page - 1) * PageSize)`. Negative or zero `Page` produces a negative skip → `ArgumentOutOfRangeException` from LINQ at enumeration OR a `OFFSET -N` from EF that PostgreSQL rejects → 500.
- `totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize)` — empty list yields **0**; `pageSize=0` produces `Math.Ceiling(N/0.0)` which is `Infinity` cast to int → undefined / `int.MinValue` per .NET overflow semantics.
- Response shape: `GetMaintenanceRequestsResponse` (`Items`, `TotalCount`, `Page`, `PageSize`, `TotalPages`).

### Why these three endpoints and not Properties/Vendors/WorkOrders/Income

The epic spec lists Properties, Expenses, Vendors, WorkOrders, MaintenanceRequests as paginated. **Audit found that only Expenses (both endpoints) and MaintenanceRequests actually accept `?page=` / `?pageSize=`.** The other four return un-paginated lists. Adding pagination to those handlers is a behavior change — out of scope for a test-only story. Tests against un-paginated endpoints have no edge cases to cover (there is no page boundary).

### Pattern References — mirror these existing files

1. **`ExpensesControllerTests.cs`** — already has 5 pagination tests for `GET /expenses`:
   - `GetAllExpenses_NoExpenses_ReturnsEmptyList` (line 1196) — empty-list case, asserts `TotalPages == 0`.
   - `GetAllExpenses_WithPageSize_RespectsPageSize` (line 1271) — happy-path 5-of-2.
   - `GetAllExpenses_WithPage_ReturnsCorrectPage` (line 1292) — page navigation.
   - `GetAllExpenses_PageBeyondLast_ReturnsEmptyItems` (line 1552) — page-beyond-last.
   - `GetAllExpenses_PageSizeOverMax_ClampedTo100` (line 1570) — clamp-upper-bound.
   - **Mirror these patterns** for the new AC-1 tests. Notably: use the file-record DTO `PagedExpenseListResponse` (already declared in the file) — do NOT redeclare.

2. **`ExpensesControllerTests.cs`** — pagination tests for `GET /properties/{id}/expenses`:
   - `GetExpensesByProperty_ReturnsPagedWithYtdTotal_OrderedByDateDesc` (line 1681) — happy-path with YtdTotal.
   - `GetExpensesByProperty_EmptyProperty_ReturnsEmptyWith_TotalPages_1_AndYtdTotal_Zero` (line ~1748) — empty-list TotalPages == 1 (divergence vs. all-expenses).
   - `GetExpensesByProperty_Pagination_Page2PageSize2` (line 1765) — page navigation.
   - `GetExpensesByProperty_PageSizeOverMax_ClampedTo100` (line 1786) — clamp-upper-bound.
   - `GetExpensesByProperty_PageSizeZero_Clamped` (line 1798) — clamp-lower-bound.
   - **Mirror these patterns** for the new AC-2 tests.

3. **`MaintenanceRequestsControllerTests.cs`** — single pagination test:
   - `GetMaintenanceRequests_Pagination_Page2PageSize10` (line 395) — page navigation with 25 seeded requests.
   - **Mirror this pattern** for the new AC-3 tests, using the existing `SeedMaintenanceRequestAsync` helper (defined inside the same class — read it before adding tests).

4. **WebApplicationFactory pattern:** all three test classes use `IClassFixture<PropertyManagerWebApplicationFactory>`. Each test creates its own user via `RegisterAndLoginAsync` (Expenses) or `_factory.CreateTestUserAsync` + `LoginAsync` (MaintenanceRequests) — see existing tests for the per-file convention. **Use the file's existing convention; don't introduce a new helper.**

### Anti-pitfalls (don't make these mistakes)

1. **Don't fix the handler in this story.** AC-3 of the epic is explicit: "If AC-3 surfaces a real bug, do NOT silently fix it inside this story — flag it." The follow-up issue (AC-4) is the deliverable. Tests assert the broken behavior; that pins it. A separate story will fix it.

2. **Don't write tests for un-paginated endpoints (Properties / Income / Vendors / WorkOrders).** These endpoints don't accept `?page=` / `?pageSize=`; testing edge cases on them produces nonsense (the query parameters are ignored).

3. **Don't redeclare the `PagedExpenseListResponse` / `GetMaintenanceRequestsResponseDto` file-records.** Both already exist as `file record` declarations at the bottom of the corresponding test files. Reuse them — adding a duplicate at the top of a new region produces a CS0260 / CS8050 collision.

4. **Don't assume AC-3.3 / AC-3.5 produce specific status codes / `totalPages` values without probing.** The handler's behavior under `pageSize=0` and `page=0` is undefined-ish (`int.MinValue` from `Convert.ToInt32(double.PositiveInfinity)`, or 500 from EF translation failure). Task 1 is the probe step. Without it, AC-3.3 and AC-3.5 will be written with hallucinated assertions that fail in CI.

5. **Don't create a new test file.** All new tests go into the two existing files (`ExpensesControllerTests.cs` and `MaintenanceRequestsControllerTests.cs`) per the file-per-controller convention established by Stories 21.1 / 21.3 / 21.6. The orchestrator's Ship phase decides PR granularity; the dev workflow does NOT pre-emptively split into new files.

6. **Don't add a `dotnet test` warm-up that hits the broken endpoint outside the test fixture.** All AC-3.3 / AC-3.5 capture work happens inside `[Fact]`s; the Task 1 probe is informational only (to set the correct expected values in the assertion). Don't leave any out-of-test code paths in the repo.

7. **Don't change pagination defaults (50, 25, 20) or the max (100).** Those are part of the contract; changing them is a behavior change.

8. **Don't add `[Authorize]` / role coverage in this story.** Auth coverage is already solid in the three test files (per Stories 21.1, 21.3, 21.6). This story is narrow: pagination edge cases only.

9. **Don't combine unrelated tests in a `[Theory]`.** AC-1.5 and AC-2.5 (page=0 negative) are clean theory candidates. AC-3.5 / AC-3.6 (page=0 negative on maintenance requests) are also clean. AC-1.3 (pageSize=0 clamped) is a single-case fact — don't merge with AC-1.5.

10. **Don't update `RolePermissions` / `MaintenanceRequestsController` to add validation that rejects `page=0` / `pageSize=0` with 400.** That IS the fix that the follow-up issue is for. Don't pre-empt it here.

11. **Don't run frontend tests for this story.** This is backend-only. `cd frontend && npm test` is not in scope.

12. **Don't strip pre-existing `// AC-X.Y.Z` comments from tests when augmenting.** Story 21.11 had the same discipline; preserve traceability.

### Previous Story Intelligence

**Story 21.11 (done — PR #401)** — Validation message assertion improvements. Carried-over patterns:
- "Reality check (epic vs. shipped code)" preamble convention — replicated above with the per-handler audit table.
- Anti-pitfall numbered list convention — replicated.
- Test Scope table convention — replicated; this story marks Unit and E2E as "Not required" with explicit justification.
- AC-3 epic discipline ("flag bugs, don't silently fix them inside this story") — replicated literally in AC-3.3 / AC-3.5 / AC-4 / Anti-pitfall #1.
- Dev Agent Record structure (Agent Model, Debug Log, Completion Notes, File List) — replicated.

**Story 21.10 (done — PR #396)** — Dashboard unit + E2E tests. Carried-over patterns:
- "Pre-flight probe to capture actual behavior before assertions" pattern — applied here in Task 1 (probe `pageSize=0` and `page=0` behavior). Same discipline as 21.10's "click around the dashboard before writing assertions."

**Story 21.6 (done — PR #380)** — VendorsController integration tests (GET/PUT). Carried-over patterns:
- "Epic vs. controller reconciliation" pattern explicitly used — AC-2 of 21.6 reconciles the epic's claimed search/filter/pagination on `/vendors` against the shipped (parameter-less) handler. The same reconciliation discipline applies here: epic listed five paginated endpoints; only three actually paginate.
- "Test-only story; do not change handlers" rule — replicated.

**Story 21.3 (done — PR #379)** — ExpensesController integration test consolidation. Carried-over patterns:
- The 5 existing GET /expenses pagination tests (`GetAllExpenses_*` listed in Pattern References above) were added in 21.3. This story EXTENDS that test block with 3 more `[Fact]`s for the missing `pageSize=0`, `page=0`, `page=1 < pageSize` cases.
- The 3 existing GetExpensesByProperty pagination tests were also added in 21.3. This story extends with `page beyond last` and `page=0` cases, plus augments `PageSizeZero_Clamped` to assert items count.

**Story 21.1 (done — PR #373)** — MaintenanceRequestsController integration tests. Carried-over patterns:
- Test class structure (`IClassFixture<PropertyManagerWebApplicationFactory>`, file-record DTOs at bottom of file, helper methods inside the class) — preserved in the new tests added to that file.
- The single existing `GetMaintenanceRequests_Pagination_Page2PageSize10` test was added in 21.1; this story extends with the 5 new pagination edge case tests.

### Files in scope to modify (test files only)

**Backend (2 files):**
1. `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` — add ~5 new tests + augment `GetExpensesByProperty_PageSizeZero_Clamped`.
2. `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` — add ~5 new tests + augment `GetMaintenanceRequests_EmptyAccount_ReturnsEmptyList`.

**Process docs (2 files):**
- `docs/project/sprint-status.yaml` — `21-12-pagination-edge-case-tests: review` (Task 7.1)
- `docs/project/stories/epic-21/21-12-pagination-edge-case-tests.md` — Status + Dev Agent Record (Task 7.2, 7.3)

**GitHub artifacts (1 issue):**
- New issue filed via `gh issue create` per AC-4 / Task 5.

### Files NOT to modify

- **Production handlers** (`backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs`, `GetExpensesByProperty.cs`; `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequests.cs`) — read-only; the divergences are deliberately left unfixed for the follow-up issue.
- **Production controllers** (`ExpensesController.cs`, `MaintenanceRequestsController.cs`) — read-only.
- **Other test files** — out of scope.

### References

- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic. Story 21.12 spec at lines 561-595. Epic AC-3 mandates "If AC-3 surfaces a real bug, do NOT silently fix it inside this story — flag it."
- [Story 21.11 (done — most recent prior story in epic)](./21-11-validation-message-assertion-improvements.md) — pattern reference for "Reality check" preamble, anti-pitfall list, Test Scope table, Dev Agent Record structure, "test-only story; do not change behavior" discipline.
- [Story 21.6 (done)](./21-6-vendors-controller-integration-tests.md) — "Epic vs. controller reconciliation" pattern explicitly used.
- [Story 21.3 (done)](./21-3-expenses-controller-integration-consolidation.md) — original `ExpensesControllerTests.cs` file structure; existing pagination tests this story extends.
- [Story 21.1 (done)](./21-1-maintenance-requests-controller-integration-tests.md) — original `MaintenanceRequestsControllerTests.cs` file structure; existing pagination test this story extends.
- [project-context.md](../../project-context.md) — backend testing standards (xUnit + FluentAssertions; integration tests via WebApplicationFactory).
- [CLAUDE.md](../../../CLAUDE.md) — `dotnet test` command, `--filter` syntax for targeted runs.
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — parent test-coverage audit.
- **Source-of-truth handler files** (read-only):
  - [`GetAllExpenses.cs`](../../../../backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs) — lines 122-127 (`Math.Clamp`/`Math.Max` clamping; `Math.Ceiling` totalPages).
  - [`GetExpensesByProperty.cs`](../../../../backend/src/PropertyManager.Application/Expenses/GetExpensesByProperty.cs) — lines 74-78 (same clamping; empty-list `TotalPages = 1`).
  - [`GetMaintenanceRequests.cs`](../../../../backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequests.cs) — lines 14-15, 78-108 (no clamping; raw `Page`/`PageSize` passed to LINQ).
- **Source-of-truth controller files** (read-only):
  - [`ExpensesController.cs`](../../../../backend/src/PropertyManager.Api/Controllers/ExpensesController.cs) — lines 148-187 (`GET /expenses`), 273-297 (`GET /properties/{id}/expenses`).
  - [`MaintenanceRequestsController.cs`](../../../../backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs) — lines 86-100 (`GET /maintenance-requests`).
- **Existing pagination test references** (read-only — mirror their style):
  - [`ExpensesControllerTests.cs`](../../../../backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs) lines 1196-1233 (no-expenses + happy path), 1270-1308 (page/pageSize), 1551-1578 (page-beyond + clamp-upper), 1748-1807 (by-property pagination block).
  - [`MaintenanceRequestsControllerTests.cs`](../../../../backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs) lines 395-417 (existing pagination test), 419-433 (existing empty-list test), 742-747 (`GetMaintenanceRequestsResponseDto` file-record).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) via `/dev-story` skill in Claude Code.

### Debug Log References

**Probe approach (Task 1):** rather than spinning up the API process, authenticating, seeding via psql, and curl-ing the endpoints, the probe was performed in-test via the `PropertyManagerWebApplicationFactory` Testcontainers fixture. This exercised the same DI/EF/PostgreSQL stack as a real run with deterministic seeded data.

Procedure:
1. Wrote AC-3.3 and AC-3.5 tests with `int.MinValue` / `HttpStatusCode.InternalServerError` predicted assertions (per the story's Anti-pitfall #4 prediction).
2. Ran via `dotnet test --filter "FullyQualifiedName~MaintenanceRequestsControllerTests.GetMaintenanceRequests_PageSizeZero_ReturnsEmptyAndUnclampedTotalPages|FullyQualifiedName~MaintenanceRequestsControllerTests.GetMaintenanceRequests_PageZeroOrNegative_Returns500"`.
3. Captured actuals from the test output and tightened the assertions.

**Captured probe values:**

| Probe | HTTP status | Response body |
|---|---|---|
| `GET /api/v1/maintenance-requests?pageSize=0` (5 seeded requests) | **200 OK** | `items=[]`, `pageSize=0`, `totalCount=5`, **`totalPages=2147483647` (`int.MaxValue`)** |
| `GET /api/v1/maintenance-requests?page=0&pageSize=20` | **500 Internal Server Error** | PostgreSQL `ERROR: OFFSET must not be negative` (SQLSTATE 2201X) propagated through `GlobalExceptionHandlerMiddleware` |
| `GET /api/v1/maintenance-requests?page=-1&pageSize=20` | **500** (same) | (same) |
| `GET /api/v1/maintenance-requests?page=-100&pageSize=20` | **500** (same) | (same) |

**Divergence from the story's predicted behavior:**

- **Anti-pitfall #4 predicted `totalPages == int.MinValue`** (per `Convert.ToInt32(double)` overflow semantics).
- **Actual: `totalPages == int.MaxValue` (2147483647)**. The handler does `(int)Math.Ceiling((double)totalCount / 0)` — that's a direct C# cast (`(int)+Infinity`), which uses the .NET *saturating* cast for `double → int` and yields `int.MaxValue` on `+Infinity`, NOT the throw-or-overflow path that `Convert.ToInt32` takes. The test now asserts the actual value (`int.MaxValue`) and a comment in the test source documents the divergence.

This is a real bug surfaced by the probe — captured exactly per the story's "If AC-3 surfaces a real bug, do NOT silently fix it inside this story — flag it" discipline. Issue #402 documents both behaviors with the captured int.MaxValue value.

### Completion Notes List

1. **Probe-first discipline paid off.** The story predicted `int.MinValue` and would have produced a test that fails on first run with the wrong assertion in CI. The probe captured the correct value (`int.MaxValue`) before the test was tightened. See Debug Log References for the divergence rationale.

2. **AC-2.3 path:** chose to seed 3 expenses in the augmented `GetExpensesByProperty_PageSizeZero_Clamped` test (vs. splitting into a separate `[Fact]`) — lower friction, preserves the original test name, and the additional `Items.Count == 1` and `TotalCount == 3` assertions read naturally with the same comment line.

3. **AC-3.5/3.6 ProblemDetails coverage:** intentionally NOT asserted. The dev-mode `GlobalExceptionHandlerMiddleware` shape is environment-dependent and tightly coupling the test to it would produce flakiness when the middleware is later updated. The 500 status assertion is sufficient to pin "this is a server bug" — the proper fix is in #402 (validate page > 0 at the validator/handler layer; never reach EF with `Skip(-N)`).

4. **GitHub labels:** only `bug` exists in this repo. The story requested `bug, tech-debt, backend` — `tech-debt` and `backend` are not configured. Applied `bug` only; documented in Task 5.3.

5. **Pre-existing test resolved:** the story noted `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` was failing as a baseline (carry-over from Story 21.10/21.11). It passed in this run — likely fixed by an intervening dependency bump (PR #400 Microsoft.IdentityModel.Tokens) or test-isolation change. No action required.

6. **No production code changes.** `git diff --stat main -- backend/src` is empty. The two divergent handlers (`GetMaintenanceRequests.cs` line 82, `(int)Math.Ceiling...` cast on line 106) are explicitly preserved as documented broken behavior.

### File List

**Backend test files modified:**
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` (+152 lines: 6 new tests for AC-1.1, AC-1.3, AC-1.5, AC-2.1, AC-2.2, AC-2.5; 1 augmented test for AC-2.3)
- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` (+150 lines: 5 new tests for AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5/3.6 Theory; 1 augmented test for AC-3.7)

**Net-new tests:** 11 `[Fact]`/`[Theory]` attributes (6 Expenses + 5 Maintenance). Including expanded `[InlineData]` rows the test count is higher: AC-1.5 Theory → 3 cases, AC-2.5 Theory → 3 cases, AC-3.5/3.6 Theory → 3 cases. Augmented existing tests: 2 (AC-2.3, AC-3.7).

**Production source files modified:** NONE.

**Process docs:**
- `docs/project/sprint-status.yaml` — `21-12-pagination-edge-case-tests: review`.
- `docs/project/stories/epic-21/21-12-pagination-edge-case-tests.md` — `Status: done`; Dev Agent Record completed.

**GitHub artifacts:**
- Follow-up issue: **#402** — https://github.com/daveharmswebdev/property-manager/issues/402 ("Pagination handler inconsistencies across paginated list endpoints"). Labeled `bug`. Includes captured probe values (`totalPages == int.MaxValue`, `OFFSET must not be negative` 500), divergence table, three source-file paths, references to Story 21.12 and epic #371, proposed unified contract.
