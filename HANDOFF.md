# Test Coverage Gap Work - Handoff Document

## Status
- **Branch:** `main` (working on test coverage)
- **Current coverage:** 92%+ line, 385 API integration tests
- **Total tests:** 1,243 (773 Application + 85 Infrastructure + 385 API)

## Completed
| Task | Controller | Coverage | Tests Added |
|------|------------|----------|-------------|
| #1 | WorkOrdersController | 0% → 95.6% | PR #121 |
| #2 | WorkOrderTagsController | 0% → 84.4% | PR #121 |
| #3 | ReportsController | 0% → 93.3% | PR #122 |
| #4 | PhotosController | 0% → ~95% | 36 tests |
| #5 | PropertyPhotosController | 0% → ~90% | 30 tests |
| #6 | IncomeController | 37% → ~90% | 38 tests (CRUD) |
| #7 | VendorTradeTagsController | 0% → ~95% | 18 tests |

## Remaining Tasks (Priority Order)

### High Priority (Frontend)
| Task | Target | Current | Location |
|------|--------|---------|----------|
| #9 | work-order.store.ts | 13% | `frontend/src/app/features/work-orders/store/work-order.store.ts` |
| #10 | auth.service.ts | 20% | `frontend/src/app/core/auth/auth.service.ts` |

### Low Priority (Backend)
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

1. Consider moving to next priority controller (PhotosController or IncomeController)
2. Or switch to frontend tests for higher impact coverage gains

## Verification

After each controller:
1. Run the specific test filter
2. Run full test suite to check for regressions
3. Check coverage improvement with reportgenerator
