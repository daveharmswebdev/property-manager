# Epic 18: Test Infrastructure Improvements

**Author:** Dave
**Date:** 2026-03-29
**GitHub Issues:** #319, #292

---

## Overview

This epic addresses two independent test infrastructure improvements: upgrading a breaking dependency in the backend test suite, and establishing a cleanup strategy for E2E tests that accumulate orphan data.

| Story | Title | Scope | Effort | Dependencies |
|-------|-------|-------|--------|--------------|
| 18.1 | Upgrade MockQueryable.Moq 7→10 | Backend tests | S | None |
| 18.2 | E2E test data cleanup strategy | E2E/Backend | M | None |

**Stories are independent — no inter-story dependencies.**

---

## Story 18.1: Upgrade MockQueryable.Moq from 7.0.3 to 10.0.5

**As a** developer,
**I want** MockQueryable.Moq upgraded to v10,
**So that** the test suite stays current with .NET 10 / EF Core 10 and receives ongoing maintenance.

**GitHub Issue:** #319
**Effort:** S — mechanical find-and-replace across 67 files, one API change

### Background

Dependabot PR #309 attempted this bump but failed with CS0411 type inference errors. The breaking change: `BuildMockDbSet<TEntity>()` moved from being an extension on `IQueryable<TEntity>` (v7) to `ICollection<TEntity>` (v10). Since every call site follows the pattern `list.AsQueryable().BuildMockDbSet()`, the fix is removing `.AsQueryable()` so the method resolves against `List<T>` (which implements `ICollection<T>`).

### Acceptance Criteria

**AC-1: Package upgraded**
Given the backend test project references MockQueryable.Moq
When I check the package version
Then it is 10.0.5

**AC-2: All call sites updated**
Given 122 usages of `BuildMockDbSet` across 67 test files
When `.AsQueryable().BuildMockDbSet()` is replaced with `.BuildMockDbSet()`
Then all files compile without CS0411 or other type inference errors

**AC-3: All tests pass**
Given the package is upgraded and call sites updated
When I run `dotnet test` from `/backend`
Then all existing tests pass with zero regressions

**AC-4: No leftover AsQueryable calls paired with BuildMockDbSet**
Given the migration is complete
When I search the test project for `.AsQueryable().BuildMockDbSet()`
Then zero results are found

### Technical Notes

**Breaking change details:**
- v7: `public static Mock<DbSet<TEntity>> BuildMockDbSet<TEntity>(this IQueryable<TEntity> data)`
- v10: `public static Mock<DbSet<TEntity>> BuildMockDbSet<TEntity>(this ICollection<TEntity> data)`
- `List<T>` implements `ICollection<T>`, so removing `.AsQueryable()` resolves the type mismatch

**Three usage patterns to update (all follow the same fix):**

Pattern 1 — Inline:
```csharp
// Before
var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
// After
var mockDbSet = vendors.BuildMockDbSet();
```

Pattern 2 — Helper method:
```csharp
// Before
private void SetupVendorsDbSet(List<Vendor> vendors)
{
    var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
    _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
}
// After — same but remove .AsQueryable()
```

Pattern 3 — With additional Setup calls (Add/RemoveRange callbacks):
```csharp
// Before
var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
mockDbSet.Setup(x => x.Add(It.IsAny<WorkOrder>()))
    .Callback<WorkOrder>(w => _addedWorkOrders.Add(w));
// After — same fix, callback chaining unaffected
```

**Files affected:** 67 test files in `backend/tests/PropertyManager.Application.Tests/`
**Package file:** `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj`

---

## Story 18.2: E2E Test Data Cleanup Strategy

**As a** developer,
**I want** E2E tests to clean up after themselves,
**So that** the shared test database doesn't accumulate orphan data and tests remain reliable across runs.

**GitHub Issue:** #292
**Effort:** M — backend endpoint + frontend test infrastructure changes

### Background

All E2E tests share a single database and test account (`claude@claude.com`). Tests that create data (properties, expenses, vendors, work orders) leave it behind permanently. Over time this causes growing data pollution, flaky count-based assertions, and slower test execution. Current workaround is `page.route()` interception and timestamp-based unique names, but the database grows unbounded.

**Current state:**
- 23+ E2E tests, many create properties/expenses/vendors
- Zero `afterEach`/`afterAll` cleanup hooks
- No backend test reset endpoint
- Timestamp-based unique names prevent collisions but don't remove data
- Work order tests already use API mocking to avoid pollution (good pattern)

### Acceptance Criteria

**AC-1: Backend test reset endpoint**
Given the application is running in a test/development environment
When I call `POST /api/v1/test/reset`
Then all data for the test account is deleted (properties, expenses, income, vendors, work orders, receipts, reports)
And the seeded test account itself (`claude@claude.com`) is preserved
And the endpoint returns 200 with a summary of deleted counts

**AC-2: Endpoint is disabled in production**
Given the application is deployed to production
When any client calls `POST /api/v1/test/reset`
Then the endpoint returns 404 (not registered in production middleware)

**AC-3: Global teardown resets database**
Given the E2E test suite has finished running
When the Playwright global teardown executes
Then it calls the test reset endpoint to clean up all orphan data

**AC-4: Per-test cleanup for data-creating tests**
Given an E2E test that creates entities (properties, vendors, expenses)
When the test completes (pass or fail)
Then entities created during that test are deleted via API calls in `afterEach`/`afterAll`
Or the test uses API mocking (`page.route()`) to avoid database writes entirely

**AC-5: CI parity**
Given E2E tests run in CI with `workers: 1`
When the full suite completes
Then the database is in the same state as before the run (minus any seeded data changes)

### Technical Notes

**Recommended approach: Backend test reset endpoint**

Create a `TestController` with a reset endpoint, only registered when `ASPNETCORE_ENVIRONMENT` is `Development` or `Testing`:

```csharp
[ApiController]
[Route("api/v1/test")]
public class TestController : ControllerBase
{
    [HttpPost("reset")]
    public async Task<IActionResult> ResetTestData(...)
    {
        // Delete in dependency order:
        // 1. WorkOrderTagAssignments, WorkOrderPhotos, Notes
        // 2. Expenses (clears WorkOrderId FK), Income
        // 3. WorkOrders
        // 4. VendorTradeTags, VendorPhones, VendorEmails
        // 5. Vendors
        // 6. PropertyPhotos, Receipts, GeneratedReports
        // 7. Properties
        // Preserve: Account, User, ExpenseCategories, WorkOrderTags, VendorTradeTags (reference data)
    }
}
```

**Playwright integration:**

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});

// e2e/global-teardown.ts
export default async function globalTeardown() {
  await fetch('http://localhost:5292/api/v1/test/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

**Alternative per-test pattern (for tests that must create real data):**
```typescript
test.afterEach(async ({ request }) => {
  // Delete specific entities created during test
  if (createdPropertyId) {
    await request.delete(`/api/v1/properties/${createdPropertyId}`);
  }
});
```

**Files to create:**
- `backend/src/PropertyManager.Api/Controllers/TestController.cs`
- `frontend/e2e/global-teardown.ts`

**Files to modify:**
- `backend/src/PropertyManager.Api/Program.cs` — conditionally register TestController
- `frontend/playwright.config.ts` — add globalTeardown
- Test files that create data — add afterEach cleanup or convert to API mocking

### Ordering Note

AC-1 and AC-2 (backend endpoint) must be implemented before AC-3 (global teardown). AC-4 (per-test cleanup) can be done incrementally after the endpoint exists.

---

## Validation Gates

- [x] Issue #319 verified as still open (MockQueryable.Moq is v7.0.3)
- [x] Issue #292 verified as still open (no cleanup infrastructure exists)
- [ ] All acceptance criteria are in BDD Given/When/Then format
- [ ] Stories are sized appropriately (S and M)
- [ ] No inter-story dependencies
- [ ] User reviewed and approved
