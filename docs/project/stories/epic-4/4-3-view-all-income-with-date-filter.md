# Story 4.3: View All Income with Date Filter

Status: done

## Story

As a property owner,
I want to view all income across properties and filter by date,
so that I can see total earnings and find specific payments.

## Acceptance Criteria

1. **AC-4.3.1**: Navigation "Income" shows all income across all properties
   - Sidebar navigation includes "Income" menu item
   - Clicking "Income" navigates to `/income` route
   - Route is protected by auth guard (requires login)
   - Income page loads with all income entries for the current user's account

2. **AC-4.3.2**: List displays required columns
   - Date column: Formatted date (e.g., "Dec 15, 2025")
   - Property name column: Property the income belongs to
   - Source column: Shows source if provided, empty otherwise
   - Description column: Shows description if provided, empty otherwise
   - Amount column: Currency formatted (e.g., "$1,500.00")
   - List sorted by date descending (newest first)
   - Respects global tax year selector

3. **AC-4.3.3**: Date range filter limits displayed income
   - Date range picker with "From" and "To" date inputs
   - Selecting date range filters income to entries within that period
   - Total updates to reflect filtered results
   - Filter applied immediately on selection (no submit button)
   - Clear filter option to reset date range
   - Default: Shows all income for selected tax year

4. **AC-4.3.4**: Property filter limits to single property
   - Property dropdown filter with all user's properties
   - Selecting property filters to only that property's income
   - "All Properties" option to show income from all properties
   - Filter works in combination with date range filter
   - Total updates to reflect filtered results

5. **AC-4.3.5**: Empty state displays appropriate message
   - When no income matches filters: "No income recorded for this period"
   - Empty state includes clear filters link
   - When no income exists at all: "No income recorded yet. Add your first income entry."
   - Empty state centered and styled consistently with other pages

6. **AC-4.3.6**: Total reflects filtered results
   - Total income amount displayed above or below the list
   - Total recalculates when filters change
   - Total formatted as currency (e.g., "Total: $4,500.00")
   - Label: "Total Income" with filtered amount

## Tasks / Subtasks

- [x] Task 1: Create GetAllIncome Query and Handler (AC: 4.3.1, 4.3.2, 4.3.3, 4.3.4)
  - [x] Create `GetAllIncome.cs` in `Application/Income/`
  - [x] `GetAllIncomeQuery(DateOnly? DateFrom, DateOnly? DateTo, Guid? PropertyId, int? Year)` : `IRequest<IncomeListResult>`
  - [x] `IncomeListResult { Items: List<IncomeDto>, TotalCount: int, TotalAmount: decimal }`
  - [x] Handler retrieves income for current account with filters
  - [x] Apply date range filter (DateFrom to DateTo inclusive)
  - [x] Apply property filter if PropertyId provided
  - [x] Apply tax year filter if Year provided
  - [x] Calculate TotalAmount from filtered results
  - [x] Order by Date descending
  - [x] Unit tests for filter combinations

- [x] Task 2: Update IncomeController with GetAll Endpoint (AC: 4.3.1)
  - [x] Add `GET /api/v1/income` endpoint with query parameters
  - [x] Query params: `dateFrom`, `dateTo`, `propertyId`, `year`
  - [x] Returns `{ items: [...], totalCount: n, totalAmount: n }`
  - [x] Returns 200 OK with empty items array if no matches
  - [x] Update Swagger documentation

- [x] Task 3: Regenerate TypeScript API Client
  - [x] Run NSwag to regenerate API client
  - [x] Verify `income_GetAll` method generated with filter parameters
  - [x] Verify `IncomeListResult` type generated

- [x] Task 4: Update IncomeService for GetAll (AC: 4.3.1)
  - [x] Add `getAllIncome(params?: IncomeFilterParams): Observable<IncomeListResult>` method
  - [x] `IncomeFilterParams { dateFrom?: string, dateTo?: string, propertyId?: string, year?: number }`
  - [x] Build query string from filter parameters
  - [x] Handle empty/null parameters correctly

- [x] Task 5: Create Income List Page Route and Component (AC: 4.3.1)
  - [x] Add `/income` route to app.routes.ts
  - [x] Create `IncomeListComponent` in `features/income/`
  - [x] Route protected by auth guard
  - [x] Component lazy-loaded with income module

- [x] Task 6: Extend IncomeStore for List State (AC: 4.3.1, 4.3.6)
  - [x] Add `allIncome` signal for full list state
  - [x] Add `totalAmount` computed signal
  - [x] Add `filters` signal for current filter state
  - [x] Add `loadAllIncome` rxMethod with filter parameters
  - [x] Handle loading state with `isLoadingAll` signal
  - [x] Update filters when year selector changes

- [x] Task 7: Create IncomeListComponent UI (AC: 4.3.2)
  - [x] Page title: "Income"
  - [x] Filters section at top of page
  - [x] Income list using mat-table or custom list
  - [x] Columns: Date | Property | Source | Description | Amount
  - [x] Reuse IncomeRowComponent for row display
  - [x] Total income display below filters or above list
  - [x] Responsive layout for mobile

- [x] Task 8: Implement Date Range Filter (AC: 4.3.3)
  - [x] Add mat-datepicker for "From" date input
  - [x] Add mat-datepicker for "To" date input
  - [x] Clear button to reset date range
  - [x] Filter triggers on date selection (no submit button)
  - [x] Update store filters and reload data
  - [x] Default to tax year range from app state

- [x] Task 9: Implement Property Filter (AC: 4.3.4)
  - [x] Add mat-select dropdown for property filter
  - [x] Options: "All Properties" + list of user's properties
  - [x] "All Properties" is default selection
  - [x] Filter triggers on selection change
  - [x] Works in combination with date range filter
  - [x] Inject PropertyStore to load property options

- [x] Task 10: Implement Empty State (AC: 4.3.5)
  - [x] Show "No income recorded for this period" when filters return empty
  - [x] Include "Clear Filters" link that resets all filters
  - [x] Show "No income recorded yet" when no income exists at all
  - [x] Add "Add Income" link if on specific property context
  - [x] Style consistently with empty states on other pages

- [x] Task 11: Integrate with Tax Year Selector (AC: 4.3.3, 4.3.6)
  - [x] Subscribe to AppState year selector
  - [x] When year changes, update filters and reload income
  - [x] Default date range respects selected tax year
  - [x] Total reflects income for selected year

- [x] Task 12: Write Backend Unit Tests
  - [x] `GetAllIncomeHandlerTests.cs`:
    - [x] Handle_NoFilters_ReturnsAllIncome
    - [x] Handle_DateFromFilter_ReturnsIncomeAfterDate
    - [x] Handle_DateToFilter_ReturnsIncomeBeforeDate
    - [x] Handle_DateRangeFilter_ReturnsIncomeInRange
    - [x] Handle_PropertyFilter_ReturnsPropertyIncome
    - [x] Handle_YearFilter_ReturnsIncomeForYear
    - [x] Handle_CombinedFilters_ReturnsCorrectIncome
    - [x] Handle_CalculatesTotalAmount_Correctly
    - [x] Handle_OrdersByDateDescending

- [x] Task 13: Write Backend Integration Tests
  - [x] `IncomeControllerGetAllTests.cs`:
    - [x] GetAll_ReturnsIncomeList_WithCount
    - [x] GetAll_WithDateFilter_ReturnsFilteredIncome
    - [x] GetAll_WithPropertyFilter_ReturnsPropertyIncome
    - [x] GetAll_Unauthorized_Returns401

- [x] Task 14: Write Frontend Component Tests
  - [x] `income-list.component.spec.ts`:
    - [x] Should render income list
    - [x] Should display total amount
    - [x] Should filter by date range
    - [x] Should filter by property
    - [x] Should show empty state when no income
    - [x] Should clear filters

- [x] Task 15: Manual Verification
  - [x] All backend tests pass
  - [x] All frontend tests pass
  - [x] Frontend builds successfully
  - [x] Smoke test completed (see checklist below)

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Application Layer: Query in `Income/` folder following CQRS pattern
- Use MediatR for query dispatch
- Global query filters enforce AccountId tenant isolation
- Global Exception Handler maps exceptions to HTTP status codes

**MediatR CQRS Pattern:**
```csharp
// GetAll Query example
public record GetAllIncomeQuery(
    DateOnly? DateFrom,
    DateOnly? DateTo,
    Guid? PropertyId,
    int? Year
) : IRequest<IncomeListResult>;

public record IncomeListResult(
    List<IncomeDto> Items,
    int TotalCount,
    decimal TotalAmount
);
```

**API Contract:**
```
GET /api/v1/income?dateFrom=2025-01-01&dateTo=2025-12-31&propertyId=abc-123&year=2025

Response: 200 OK
{
  "items": [
    {
      "id": "...",
      "propertyId": "...",
      "propertyName": "Oak Street Duplex",
      "amount": 1500.00,
      "date": "2025-01-15",
      "source": "John Smith - Rent",
      "description": "January rent"
    }
  ],
  "totalCount": 12,
  "totalAmount": 18000.00
}
```

**Frontend State Management:**
- Use @ngrx/signals for reactive state
- rxMethod for async API calls
- Computed signals for derived values (totalAmount)
- Filter state persisted across navigation

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Income/
    └── GetAllIncome.cs
backend/tests/PropertyManager.Application.Tests/Income/
    └── GetAllIncomeHandlerTests.cs
backend/tests/PropertyManager.Api.Tests/
    └── IncomeControllerGetAllTests.cs
```

**Backend files to modify:**
```
backend/src/PropertyManager.Api/Controllers/IncomeController.cs  # Add GET all endpoint
```

**Frontend files to create:**
```
frontend/src/app/features/income/income-list/
    ├── income-list.component.ts
    ├── income-list.component.html
    ├── income-list.component.scss
    └── income-list.component.spec.ts
```

**Frontend files to modify:**
```
frontend/src/app/features/income/services/income.service.ts  # Add getAllIncome method
frontend/src/app/features/income/stores/income.store.ts  # Add allIncome state, loadAllIncome
frontend/src/app/features/income/income.routes.ts  # Add list route
frontend/src/app/app.routes.ts  # Ensure income route configured
```

### Learnings from Previous Story

**From Story 4-2-edit-and-delete-income-entry (Status: done)**

- **IncomeService Available**: Full CRUD service at `features/income/services/income.service.ts` - extend with getAllIncome method
- **IncomeStore Available**: Store at `features/income/stores/income.store.ts` - extend with allIncome state
- **IncomeRowComponent Available**: Component at `features/income/components/income-row/` - reuse for list rendering
- **API Client Generated**: NSwag client has income types - regenerate after adding GetAll endpoint
- **Testing Pattern**: Follow same test structure - unit tests in Application.Tests, integration in Api.Tests

**Services to REUSE:**
- `IncomeService` - extend with getAllIncome(filters)
- `IncomeStore` - extend with allIncome, filters, loadAllIncome
- `IncomeRowComponent` - reuse for list items (already has date, property, amount display)
- `PropertyStore` - inject to get property list for filter dropdown

**Reference Files for Filtering Pattern (from expenses):**
- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` - GetAll with filters pattern
- `frontend/src/app/features/expenses/expenses-list/expenses-list.component.ts` - List page with filters
- `frontend/src/app/features/expenses/stores/expense.store.ts` - Store with filter state

[Source: docs/sprint-artifacts/4-2-edit-and-delete-income-entry.md#Dev-Agent-Record]

### Testing Strategy

**Unit Tests (xUnit):**
- `GetAllIncomeHandlerTests`: 9 test cases covering all filter combinations

**Integration Tests (xUnit):**
- `IncomeControllerGetAllTests`: 4 test cases

**Component Tests (Vitest):**
- `income-list.component.spec.ts`: 6 test cases

**Manual Verification Checklist:**
```markdown
## Smoke Test: View All Income with Date Filter

### API Verification
- [ ] GET /api/v1/income returns 200 with income list
- [ ] GET /api/v1/income?dateFrom=2025-01-01 filters correctly
- [ ] GET /api/v1/income?dateTo=2025-12-31 filters correctly
- [ ] GET /api/v1/income?propertyId=xxx filters to property
- [ ] GET /api/v1/income?year=2025 filters to year
- [ ] Response includes totalCount and totalAmount
- [ ] Empty filters return all income for account
- [ ] Unauthorized request returns 401

### Database Verification
- [ ] AccountId filtering enforced (cannot see other accounts' income)
- [ ] DeletedAt filtering enforced (soft-deleted income not returned)
- [ ] Results ordered by Date descending

### Frontend Verification
- [ ] Income navigation item visible in sidebar
- [ ] Click navigates to /income
- [ ] Income list displays all entries
- [ ] Columns show: Date, Property, Source, Description, Amount
- [ ] Date range filter works
- [ ] Property filter dropdown populates
- [ ] Property filter works
- [ ] Combined filters work together
- [ ] Total income updates with filters
- [ ] Empty state shows when no income
- [ ] Clear filters resets to default
- [ ] Tax year selector changes update list
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#AC-4.3] - Acceptance criteria 13-18
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#APIs and Interfaces] - GET /api/v1/income endpoint
- [Source: docs/epics.md#Story 4.3: View All Income with Date Filter] - Epic-level story definition
- [Source: docs/architecture.md#API Contracts] - Response formats
- [Source: docs/architecture.md#CQRS Pattern] - Query pattern
- [Source: docs/prd.md#FR29] - Filter income by date range requirement

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/4-3-view-all-income-with-date-filter.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Initial story draft created | SM Agent (Create Story Workflow) |
