# Test Coverage Gap Work - Handoff Document

## Status
- **PR #122** - ReportsController tests (29 tests) - awaiting merge
- **Branch:** `chore/test-coverage-gaps-2`
- **Current coverage:** 92.1% line, 263 API integration tests
- **Total tests:** 1,121 (773 Application + 85 Infrastructure + 263 API)

## PRs
| PR | Description | Status |
|----|-------------|--------|
| [#121](https://github.com/daveharmswebdev/property-manager/pull/121) | WorkOrders + WorkOrderTags tests (56 tests) | Merged |
| [#122](https://github.com/daveharmswebdev/property-manager/pull/122) | ReportsController tests (29 tests) | Open |

## Completed
| Task | Controller | Coverage | Tests |
|------|------------|----------|-------|
| #1 | WorkOrdersController | 0% → 95.6% | 45 |
| #2 | WorkOrderTagsController | 0% → 84.4% | 11 |
| #3 | ReportsController | 0% → 93.3% | 29 |

## Remaining Tasks (Priority Order)

### High Priority
| Task | Target | Current | Location |
|------|--------|---------|----------|
| #9 | work-order.store.ts | 13% | `frontend/src/app/features/work-orders/store/work-order.store.ts` |
| #10 | auth.service.ts | 20% | `frontend/src/app/core/auth/auth.service.ts` |

### Medium Priority
| Task | Target | Current | Location |
|------|--------|---------|----------|
| #4 | PhotosController | 0% | `backend/src/PropertyManager.Api/Controllers/PhotosController.cs` |
| #5 | PropertyPhotosController | 0% | `backend/src/PropertyManager.Api/Controllers/PropertyPhotosController.cs` |
| #6 | IncomeController | 37% | `backend/src/PropertyManager.Api/Controllers/IncomeController.cs` |
| #7 | VendorTradeTagsController | 0% | `backend/src/PropertyManager.Api/Controllers/VendorTradeTagsController.cs` |

### Low Priority
| Task | Target | Current |
|------|--------|---------|
| #8 | InvitationsController | 0% |

## Testing Pattern (Backend)

Tests go in: `backend/tests/PropertyManager.Api.Tests/`

```csharp
public class XxxControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    // Helper methods:
    // - GetAccessTokenAsync() - create user and login
    // - PostAsJsonWithAuthAsync(url, content, token)
    // - GetWithAuthAsync(url, token)
    // - PutAsJsonWithAuthAsync(url, content, token)
    // - DeleteWithAuthAsync(url, token)
}
```

Test scenarios to cover:
- Without auth → 401
- With valid data → 2xx
- With invalid data → 400
- Not found → 404
- Multi-tenant isolation (user can't access other user's data)
- Duplicate detection → 409 (where applicable)

## Commands

```bash
# Run specific controller tests
cd backend
dotnet test tests/PropertyManager.Api.Tests --filter "FullyQualifiedName~XxxControllerTests"

# Run all tests with coverage
dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults

# Generate coverage report
reportgenerator -reports:"TestResults/*/coverage.cobertura.xml" -targetdir:"./CoverageReport" -reporttypes:TextSummary
```

## Notes

- FakeReportStorageService was added to PropertyManagerWebApplicationFactory.cs to support ReportsController tests
- ExpenseCategories are seeded globally - use known IDs from ExpenseCategorySeeder.cs:
  - Repairs: `11111111-1111-1111-1111-111111111110`
  - Other categories have similar GUIDs ending in 101-115

## To Continue

After PR #122 merges:
1. `git checkout main && git pull`
2. Create new branch or continue on existing
3. Next recommended: IncomeController (37% → higher) or PhotosController (0%)
4. Alternative: Switch to frontend tests for higher impact coverage gains

## Verification

After each controller:
1. Run the specific test filter
2. Run full test suite to check for regressions
3. Check coverage improvement with reportgenerator
