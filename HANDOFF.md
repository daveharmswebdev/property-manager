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
| #4 | PhotosController | 0% → ~95% | 36 tests (PR #124) |
| #5 | PropertyPhotosController | 0% → ~90% | 30 tests (PR #124) |
| #6 | IncomeController | 37% → ~90% | 38 tests (PR #124) |
| #7 | VendorTradeTagsController | 0% → ~95% | 18 tests (PR #124) |

## Backend API Controllers Status

| Controller | Tests | Status |
|------------|-------|--------|
| AuthController | ✅ | Covered |
| DashboardController | ✅ | Covered |
| ExpensesController | ✅ | Covered (3 test files) |
| HealthController | ✅ | Covered |
| IncomeController | ✅ | Covered (2 test files) |
| **InvitationsController** | ❌ | **0% - NO TESTS** |
| PhotosController | ✅ | Covered |
| PropertiesController | ✅ | Covered |
| PropertyPhotosController | ✅ | Covered |
| ReceiptsController | ✅ | Covered |
| ReportsController | ✅ | Covered |
| VendorTradeTagsController | ✅ | Covered |
| VendorsController | ✅ | Covered (2 test files) |
| WorkOrderTagsController | ✅ | Covered |
| WorkOrdersController | ✅ | Covered |

**Backend Summary:** 14/15 controllers have tests.

## Remaining Tasks (Priority Order)

### Backend (1 controller remaining)
| Task | Target | Current | Endpoints |
|------|--------|---------|-----------|
| #8 | InvitationsController | 0% | 3 endpoints (~20 tests needed) |

Endpoints to test:
- `POST /api/v1/invitations` - Create invitation (requires Owner role)
- `GET /api/v1/invitations/{code}/validate` - Validate invitation code
- `POST /api/v1/invitations/{code}/accept` - Accept invitation and create account

### Frontend - High Priority (Core Services/Stores)
| Task | Target | Location |
|------|--------|----------|
| #9 | auth.service.ts | `frontend/src/app/core/services/auth.service.ts` |
| #10 | api.service.ts | `frontend/src/app/core/api/api.service.ts` |
| #11 | work-order.store.ts | `frontend/src/app/features/work-orders/stores/work-order.store.ts` |
| #12 | expense-list.store.ts | `frontend/src/app/features/expenses/stores/expense-list.store.ts` |
| #13 | income.store.ts | `frontend/src/app/features/income/stores/income.store.ts` |

### Frontend - Medium Priority (Feature Services)
| Target | Location |
|--------|----------|
| work-order.service.ts | `frontend/src/app/features/work-orders/services/` |
| expense.service.ts | `frontend/src/app/features/expenses/services/` |
| income.service.ts | `frontend/src/app/features/income/services/` |
| property.service.ts | `frontend/src/app/features/properties/services/` |

### Frontend - Lower Priority (Components without tests)
- **Auth:** login, forgot-password, reset-password, accept-invitation
- **Work Orders:** work-order-create, work-order-edit
- **Expenses:** expense-workspace, expense-form, expense-filters, category-select
- **Income:** income, income-workspace, income-form, income-row
- **Properties:** properties
- **Reports:** pdf-preview
- **Shared:** not-found, empty-state, loading-spinner
- **Settings:** settings

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
- Role-based access → 403 (where applicable)

## Commands

```bash
# Run specific controller tests
cd backend
dotnet test tests/PropertyManager.Api.Tests --filter "FullyQualifiedName~XxxControllerTests"

# Run all tests with coverage
dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults

# Generate coverage report
reportgenerator -reports:"TestResults/*/coverage.cobertura.xml" -targetdir:"./CoverageReport" -reporttypes:TextSummary

# Frontend tests
cd frontend
npm test
```

## Notes

- FakeReportStorageService was added to PropertyManagerWebApplicationFactory.cs to support ReportsController tests
- FakeEmailService tracks sent invitations via `SentInvitationEmails` list
- ExpenseCategories are seeded globally - use known IDs from ExpenseCategorySeeder.cs:
  - Repairs: `11111111-1111-1111-1111-111111111110`
  - Other categories have similar GUIDs ending in 101-115
- InvitationsController requires Owner role for creating invitations - test with role-based auth

## Verification

After each controller:
1. Run the specific test filter
2. Run full test suite to check for regressions
3. Check coverage improvement with reportgenerator
