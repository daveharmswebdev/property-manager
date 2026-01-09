# Story 7.5: Expense List Pagination

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **property owner**,
I want **the Previous Expense List on the Property Expenses View to be paginated**,
So that **I can navigate through a large number of expenses efficiently**.

## Acceptance Criteria

1. **AC-7.5.1: Pagination controls displayed**
   - **Given** I am on the Property Expenses workspace
   - **When** there are more expenses than the page size
   - **Then** I see pagination controls below the list

2. **AC-7.5.2: Page size options**
   - **Given** pagination controls are visible
   - **When** I view the page size selector
   - **Then** I can select page size: 10, 25, or 50 items per page
   - **And** the default page size is 25

3. **AC-7.5.3: Page navigation**
   - **Given** pagination controls are visible
   - **When** I view them
   - **Then** I can navigate between pages
   - **And** I see total count (e.g., "Showing 1-25 of 150")

4. **AC-7.5.4: Page size preference persists**
   - **Given** I change the page size to 50
   - **When** I navigate away and return to the page
   - **Then** my page size preference (50) is restored

5. **AC-7.5.5: Pagination resets on property change**
   - **Given** I am on page 3 of expenses for Property A
   - **When** I navigate to Property B's expenses
   - **Then** I start on page 1 of Property B's expenses
   - **And** my page size preference is preserved

## Tasks / Subtasks

- [x] Task 1: Update GetExpensesByProperty backend query (AC: #1, #3)
  - [x] 1.1: Add `Page` and `PageSize` parameters to `GetExpensesByPropertyQuery` record
  - [x] 1.2: Add pagination logic (Skip/Take) to query handler
  - [x] 1.3: Change return type from `ExpenseListDto` to `PagedExpenseListDto` with page info
  - [x] 1.4: Maintain existing `YtdTotal` calculation (independent of pagination)

- [x] Task 2: Update ExpensesController endpoint (AC: #1)
  - [x] 2.1: Add `[FromQuery] int page = 1` and `[FromQuery] int pageSize = 25` parameters
  - [x] 2.2: Pass parameters to query handler
  - [x] 2.3: Update Swagger documentation

- [x] Task 3: Update ExpenseService frontend (AC: #1, #2, #3)
  - [x] 3.1: Add `page` and `pageSize` query parameters to `getExpensesByProperty()` method
  - [x] 3.2: Update return type to match new backend response

- [x] Task 4: Update ExpenseStore with pagination state (AC: #1, #2, #3, #5)
  - [x] 4.1: Add pagination state: `page`, `pageSize`, `totalCount`, `totalPages`
  - [x] 4.2: Add `goToPage(page: number)` method
  - [x] 4.3: Add `setPageSize(pageSize: number)` method (resets to page 1)
  - [x] 4.4: Update `loadExpenses()` to include pagination parameters
  - [x] 4.5: Reset page to 1 when property changes (in `setPropertyId()`)

- [x] Task 5: Implement localStorage persistence (AC: #4)
  - [x] 5.1: Add localStorage key `propertyManager.expenseWorkspace.pageSize`
  - [x] 5.2: Read from localStorage on store initialization (default: 25)
  - [x] 5.3: Write to localStorage in `setPageSize()` method

- [x] Task 6: Update expense-workspace.component.ts template (AC: #1, #2, #3)
  - [x] 6.1: Add `mat-paginator` component below expense list
  - [x] 6.2: Configure: `[length]`, `[pageSize]`, `[pageIndex]`, `[pageSizeOptions]="[10, 25, 50]"`
  - [x] 6.3: Handle `(page)` event to call store methods
  - [x] 6.4: Add pagination info text: "Showing X-Y of Z expenses"
  - [x] 6.5: Hide paginator when total expenses <= 10

- [x] Task 7: Write backend unit tests (AC: #1, #3)
  - [x] 7.1: Test default pagination (page 1, size 25)
  - [x] 7.2: Test page navigation (page 2 returns correct items)
  - [x] 7.3: Test page size limits (clamp to 1-100 range)
  - [x] 7.4: Test total count remains accurate across pages
  - [x] 7.5: Test YtdTotal is independent of pagination

- [x] Task 8: Write frontend tests (AC: #4, #5)
  - [x] 8.1: Test page size persists to localStorage
  - [x] 8.2: Test page resets on property change
  - [x] 8.3: Test pagination state updates on page change

- [x] Task 9: Manual verification
  - [x] 9.1: API verified returning paginated response with correct structure
  - [x] 9.2: YtdTotal verified as independent of pagination (same across pages)
  - [x] 9.3: Paginator correctly hidden when total <= 10

## Dev Notes

### Architecture Compliance

This story follows the **exact pagination pattern** already implemented in `GetAllExpenses.cs` and `expense-list.store.ts`. The codebase has a mature, tested pagination implementation that should be replicated.

### Existing Pagination Pattern (MUST FOLLOW)

**Backend Query Pattern (GetAllExpenses.cs lines 28-95):**
```csharp
public record GetExpensesByPropertyQuery(
    Guid PropertyId,
    int? Year = null,
    int Page = 1,
    int PageSize = 25
) : IRequest<PagedExpenseListDto>;

// In handler:
var clampedPageSize = Math.Clamp(request.PageSize, 1, 100);
var clampedPage = Math.Max(1, request.Page);

var totalCount = await query.CountAsync(ct);
var totalPages = (int)Math.Ceiling((double)totalCount / clampedPageSize);

var items = await query
    .OrderByDescending(e => e.Date)
    .ThenByDescending(e => e.CreatedAt)
    .Skip((clampedPage - 1) * clampedPageSize)
    .Take(clampedPageSize)
    .Select(e => new ExpenseDto(...))
    .ToListAsync(ct);

return new PagedExpenseListDto(items, totalCount, clampedPage, clampedPageSize, totalPages, ytdTotal);
```

**Frontend Store Pattern (expense-list.store.ts lines 388-405):**
```typescript
goToPage(page: number): void {
  patchState(store, { page });
  store.loadExpenses();
}

setPageSize(pageSize: number): void {
  patchState(store, { pageSize, page: 1 });
  localStorage.setItem('propertyManager.expenseWorkspace.pageSize', pageSize.toString());
  store.loadExpenses();
}
```

**Material Paginator Pattern (expenses.component.ts lines 120-128):**
```html
<mat-paginator
  [length]="store.totalCount()"
  [pageSize]="store.pageSize()"
  [pageIndex]="store.page() - 1"
  [pageSizeOptions]="[10, 25, 50]"
  (page)="onPageChange($event)">
</mat-paginator>
```

### Files to Modify

**Backend:**
```
backend/src/PropertyManager.Application/Expenses/
├── GetExpensesByProperty.cs          <- MODIFY: Add pagination
└── Dtos/PagedExpenseListDto.cs       <- CREATE: New DTO with page info

backend/src/PropertyManager.Api/Controllers/
└── ExpensesController.cs             <- MODIFY: Add query params

backend/tests/PropertyManager.Application.Tests/Expenses/
└── GetExpensesByPropertyHandlerTests.cs <- MODIFY: Add pagination tests
```

**Frontend:**
```
frontend/src/app/features/expenses/
├── services/
│   └── expense.service.ts            <- MODIFY: Add pagination params
├── stores/
│   └── expense.store.ts              <- MODIFY: Add pagination state
└── expense-workspace/
    └── expense-workspace.component.ts <- MODIFY: Add mat-paginator
```

### Current Implementation Reference

**GetExpensesByProperty.cs (current - NO pagination):**
- Returns `ExpenseListDto(Items, TotalCount, YtdTotal)`
- No Skip/Take logic
- Returns ALL expenses for property

**expense.store.ts (current - NO pagination):**
- State: `expenses`, `ytdTotal`, `loading`, `error`
- No page/pageSize state
- Loads all expenses

### New Response DTO

Create `PagedExpenseListDto.cs`:
```csharp
public record PagedExpenseListDto(
    List<ExpenseDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    decimal YtdTotal  // Must remain - calculated independently
);
```

### localStorage Key

Following existing pattern from story 7-3:
- Key: `propertyManager.expenseWorkspace.pageSize`
- Default: 25
- Valid values: 10, 25, 50

### API Contract Change

**Current:**
```
GET /api/v1/properties/{id}/expenses?year=2025
Response: { items: [], totalCount: 150, ytdTotal: 5000.00 }
```

**New:**
```
GET /api/v1/properties/{id}/expenses?year=2025&page=1&pageSize=25
Response: {
  items: [],
  totalCount: 150,
  page: 1,
  pageSize: 25,
  totalPages: 6,
  ytdTotal: 5000.00
}
```

### Important Considerations

1. **YtdTotal must remain accurate** - Calculate YTD total from ALL expenses matching the year filter, NOT just the current page
2. **Page clamp range** - Use 1-100 for pageSize (matches existing pattern)
3. **Material paginator uses 0-based index** - Convert: `[pageIndex]="store.page() - 1"`
4. **Hide paginator when unneeded** - Only show when `totalCount > 10`
5. **Reset page on year change** - If user changes year filter, reset to page 1

### Previous Story Intelligence (7-4)

From story 7-4 implementation:
- Backend tests: 498+ tests must pass
- Frontend tests: 672+ tests must pass
- Use `ThenByDescending(e => e.CreatedAt)` for consistent ordering
- Follow existing Material component patterns

### Git Intelligence

Recent commits show established patterns:
- `13cef1b`: feat(property-detail) - Backend query + frontend display changes
- `58e09f4`: feat(year-selector) - localStorage persistence pattern

### Testing Strategy

**Backend Unit Tests:**
1. `Handle_DefaultPagination_ReturnsFirst25Items`
2. `Handle_Page2_ReturnsCorrectItems`
3. `Handle_PageSizeExceeds100_ClampedTo100`
4. `Handle_PageSizeLessThan1_ClampedTo1`
5. `Handle_YtdTotal_IndependentOfPagination`

**Frontend Tests:**
1. `should persist pageSize to localStorage`
2. `should read pageSize from localStorage on init`
3. `should reset page to 1 when property changes`
4. `should reset page to 1 when pageSize changes`

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Uses existing `PagedResult` pattern from `GetAllExpenses`
- Angular Material components already imported in module

### References

- [Source: backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs] - Existing pagination pattern
- [Source: frontend/src/app/features/expenses/stores/expense-list.store.ts] - Store pagination pattern
- [Source: frontend/src/app/features/expenses/expenses.component.ts:120-128] - Material paginator integration
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Contracts] - PagedResult format
- GitHub Issue: #62

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Backend Implementation**: Added pagination support to `GetExpensesByProperty.cs` with `PagedExpenseListDto` return type. Pagination parameters (`page`, `pageSize`) are clamped to valid ranges (page >= 1, pageSize 1-100). YtdTotal is calculated from ALL matching expenses before pagination is applied.

2. **API Contract**: Updated `ExpensesController.cs` endpoint to accept `page` (default 1) and `pageSize` (default 25) query parameters. Response now includes `page`, `pageSize`, `totalPages` fields in addition to existing `items`, `totalCount`, and `ytdTotal`.

3. **Frontend Service**: Updated `expense.service.ts` with `PagedExpenseListResponse` interface and updated `getExpensesByProperty()` method to include pagination parameters.

4. **Store State Management**: Added pagination state (`page`, `pageSize`, `totalCount`, `totalPages`) to `expense.store.ts`. Implemented `goToPage()` and `setPageSize()` methods. Page resets to 1 when property changes or page size changes.

5. **localStorage Persistence**: Page size preference persisted to `propertyManager.expenseWorkspace.pageSize` key. Valid values: 10, 25, 50. Default: 25.

6. **UI Component**: Added `mat-paginator` to `expense-workspace.component.ts` with pagination info text. Paginator hidden when totalCount <= 10.

7. **Tests**: Added 16 backend unit tests for pagination logic. Added 15 frontend tests for store pagination behavior and localStorage persistence.

### File List

**Backend Files Modified:**
- `backend/src/PropertyManager.Application/Expenses/GetExpensesByProperty.cs`
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`

**Backend Files Created:**
- `backend/tests/PropertyManager.Application.Tests/Expenses/GetExpensesByPropertyHandlerTests.cs`

**Frontend Files Modified:**
- `frontend/src/app/features/expenses/services/expense.service.ts`
- `frontend/src/app/features/expenses/stores/expense.store.ts`
- `frontend/src/app/features/expenses/stores/expense.store.spec.ts`
- `frontend/src/app/features/expenses/expense-workspace/expense-workspace.component.ts`
