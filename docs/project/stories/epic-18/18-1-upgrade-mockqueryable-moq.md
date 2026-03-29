# Story 18.1: Upgrade MockQueryable.Moq from 7.0.3 to 10.0.5

Status: done

## Story

As a developer,
I want MockQueryable.Moq upgraded to v10.0.5,
so that the test suite stays current with .NET 10 / EF Core 10 and receives ongoing maintenance.

**GitHub Issue:** #319
**Effort:** S — mechanical refactor, one API change across 67 test files (68 total including csproj)

## Acceptance Criteria

**AC-1: Package upgraded**
Given the backend test project references MockQueryable.Moq
When I check the package version in PropertyManager.Application.Tests.csproj
Then it is 10.0.5

**AC-2: All call sites updated**
Given 122 usages of `BuildMockDbSet` across 67 test files
When `.AsQueryable().BuildMockDbSet()` is replaced with `.BuildMockDbSet()`
Then all files compile without CS0411 or other type inference errors

**AC-3: All tests pass**
Given the package is upgraded and call sites updated
When I run `dotnet test` from `/backend`
Then all existing tests pass with zero regressions

**AC-4: No leftover AsQueryable+BuildMockDbSet calls**
Given the migration is complete
When I search the test project for `.AsQueryable().BuildMockDbSet()`
Then zero results are found

## Tasks / Subtasks

### Task 1: Upgrade package version (AC: 1)

- [x] 1.1: Update `MockQueryable.Moq` from `7.0.3` to `10.0.5` in `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj`
- [x] 1.2: Run `dotnet restore` to pull new package
- [x] 1.3: Attempt `dotnet build` — confirm CS0411 errors appear (expected, validates the breaking change)

### Task 2: Update all BuildMockDbSet call sites (AC: 2, 4)

- [x] 2.1: Replace `.AsQueryable().BuildMockDbSet()` with `.BuildMockDbSet()` across all 67 test files in `backend/tests/PropertyManager.Application.Tests/`
- [x] 2.2: Run `dotnet build` — confirm zero compile errors
- [x] 2.3: Search for any remaining `.AsQueryable().BuildMockDbSet()` — confirm zero results

### Task 3: Verify all tests pass (AC: 3)

- [x] 3.1: Run `dotnet test` from `/backend` — all tests must pass
- [x] 3.2: If any test fails, diagnose whether it's a v10 behavioral change vs. a pre-existing issue

## Dev Notes

### Breaking Change Details

MockQueryable.Moq v10 changed the `BuildMockDbSet` extension method signature:

```csharp
// v7 — extension on IQueryable<T>
public static Mock<DbSet<TEntity>> BuildMockDbSet<TEntity>(this IQueryable<TEntity> data)

// v10 — extension on ICollection<T>
public static Mock<DbSet<TEntity>> BuildMockDbSet<TEntity>(this ICollection<TEntity> data)
```

`List<T>` implements `ICollection<T>`, so removing `.AsQueryable()` resolves the type mismatch. The return type (`Mock<DbSet<TEntity>>`) is unchanged — all downstream `.Object`, `.Setup()`, and `.Callback()` calls remain valid.

### Usage Patterns (all same fix)

**Pattern 1 — Inline (most common):**
```csharp
// Before
var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
_dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);

// After
var mockDbSet = vendors.BuildMockDbSet();
_dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
```

**Pattern 2 — Helper method:**
```csharp
// Before
private void SetupVendorsDbSet(List<Vendor> vendors)
{
    var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
    _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
}

// After — remove .AsQueryable() only
```

**Pattern 3 — With Add/RemoveRange callbacks:**
```csharp
// Before
var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
mockDbSet.Setup(x => x.Add(It.IsAny<WorkOrder>()))
    .Callback<WorkOrder>(w => _addedWorkOrders.Add(w));

// After — same fix, callback chaining unaffected
```

### Scope

- **67 files**, **122 call sites** — all in `backend/tests/PropertyManager.Application.Tests/`
- Every single call follows the pattern `list.AsQueryable().BuildMockDbSet()`
- No calls use `BuildMockDbSet` without `.AsQueryable()` prefix
- No `.Include()`, `.AsNoTracking()`, or raw SQL patterns in test mock setup

### Package Dependencies

Current csproj:
```xml
<PackageReference Include="MockQueryable.Moq" Version="7.0.3" />
<PackageReference Include="Moq" Version="4.20.72" />
```

MockQueryable.Moq 10.0.5 requires Moq >= 4.20.72 (already satisfied). Transitive deps MockQueryable.Core and MockQueryable.EntityFrameworkCore will auto-upgrade.

### Namespace

Import stays the same: `using MockQueryable.Moq;` — no namespace changes between v7 and v10.

### References

- [Package: MockQueryable.Moq on NuGet](https://www.nuget.org/packages/MockQueryable.Moq)
- [Source: v10 MoqExtensions.cs](https://github.com/romantitov/MockQueryable/blob/master/src/MockQueryable/MockQueryable.Moq/MoqExtensions.cs)
- [Closed PR: #309 (Dependabot attempt)](https://github.com/daveharmswebdev/property-manager/pull/309)
- [GitHub Issue: #319](https://github.com/daveharmswebdev/property-manager/issues/319)
- Project file: `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- 244 CS0411 errors confirmed after package upgrade (validates breaking change)
- 1 additional fix needed: `GenerateBatchScheduleEReportsHandlerTests.cs` line 243 — `IEnumerable<Property>` parameter needed `.ToList()` before `.BuildMockDbSet()` since v10 requires `ICollection<T>`

### Completion Notes List

- Package upgraded from 7.0.3 to 10.0.5
- 122 occurrences of `.AsQueryable().BuildMockDbSet()` replaced with `.BuildMockDbSet()` across 67 files
- 1 edge case: `SetupDbContext(IEnumerable<Property>)` in batch report tests needed `.ToList()` call since `IEnumerable<T>` doesn't implement `ICollection<T>`
- All 1,535 tests pass (981 Application + 96 Infrastructure + 458 Api)

### File List

- `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj` — package version 7.0.3 → 10.0.5
- 67 test files (`.cs`) in `backend/tests/PropertyManager.Application.Tests/` — removed `.AsQueryable()` from 122 `BuildMockDbSet` call sites
- `backend/tests/PropertyManager.Application.Tests/Reports/GenerateBatchScheduleEReportsHandlerTests.cs` — added `.ToList()` for `IEnumerable<T>` compatibility
- `docs/project/project-context.md` — updated MockQueryable testing rule to reflect v10 API
- `docs/project/sprint-status.yaml` — added Epic 18 tracking, set 18-1 to review
- `docs/project/epics-test-infrastructure.md` — new epic definition for test infrastructure improvements
- `docs/project/stories/epic-18/18-1-upgrade-mockqueryable-moq.md` — this story file

## Senior Developer Review

### Review Date: 2026-03-29

**Reviewer:** Claude Opus 4.6 (code-review skill)

**Findings:**

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | HIGH | All changes on `main` — no feature branch created | Fixed: created `story/18-1-upgrade-mockqueryable-moq` branch |
| 2 | MEDIUM | File List missing 4 doc/planning files | Fixed: added all doc files to File List |
| 3 | MEDIUM | File count "67 files" slightly misleading (68 including csproj) | Fixed: clarified in Effort line |

**Verdict:** All ACs implemented and verified. 1,535 tests passing. Review issues fixed — story is done.
