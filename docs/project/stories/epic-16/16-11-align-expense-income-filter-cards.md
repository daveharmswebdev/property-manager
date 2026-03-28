# Story 16.11: Align Expense & Income Filter Cards

Status: dev-complete

## Story

As a **property owner filtering expenses and income**,
I want **both list views to have consistent filter capabilities**,
So that **I can search, filter by property, and see totals in the same way regardless of which list I'm viewing**.

**GitHub Issue:** #250
**Prerequisites:** None (pairs naturally with 16.6, which is done)
**Effort:** Medium — three distinct UI changes across two components, plus backend additions

## Acceptance Criteria

### AC1 — Income list: add search field

**Given** I am on the `/income` page
**When** I view the filter card
**Then** I see a search text field that filters on `source` and `description` columns
**And** styling matches the existing search field on the expenses list (debounced 300ms, `mat-icon` prefix, clear button)

### AC2 — Expenses list: move total inside filter card

**Given** I am on the `/expenses` page
**When** I view the filter card
**Then** "Total Expenses: $X" is displayed **inside** the filter card (below filters, with border separator)
**And** layout matches the income list's "Total Income" display pattern

### AC3 — Expenses list: add property filter

**Given** I am on the `/expenses` page
**When** I view the filter card
**Then** I see a "Property" dropdown with "All Properties" as default
**And** selecting a property filters the expense list to that property only
**And** styling matches the property filter on the income list (`min-width: 200px`, `mat-select`, outline appearance)

### AC4 — Both filter cards reach parity

**Given** both filter cards are updated
**When** I compare expenses and income filter cards
**Then** both contain: Date Range, Property dropdown, Search field, Total display
**And** the only difference is the Category dropdown (expenses only)

## Tasks / Subtasks

### Task 1: Backend — Add `propertyId` filter to `GetAllExpenses` (AC: #3)

> **Why:** The expenses API currently has no property filter. Income already has one. We need parity.

**Files to modify:**

- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs`
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`

- [x] 1.1 Add `Guid? PropertyId` parameter to `GetAllExpensesQuery` record (insert after `CategoryIds`):
  ```csharp
  public record GetAllExpensesQuery(
      DateOnly? DateFrom,
      DateOnly? DateTo,
      List<Guid>? CategoryIds,
      Guid? PropertyId,        // ← NEW: filter by property
      string? Search,
      int? Year,
      string? SortBy = null,
      string? SortDirection = null,
      int Page = 1,
      int PageSize = 50
  ) : IRequest<PagedResult<ExpenseListItemDto>>;
  ```

- [x] 1.2 Add filter clause in `GetAllExpensesHandler.Handle()` — insert after the category filter block (line ~99), before the search filter:
  ```csharp
  // Apply property filter (AC-16.11.3)
  if (request.PropertyId.HasValue)
  {
      query = query.Where(e => e.PropertyId == request.PropertyId.Value);
  }
  ```

- [x] 1.3 Add `[FromQuery] Guid? propertyId = null` parameter to `ExpensesController.GetAllExpenses()` and pass to query constructor:
  ```csharp
  public async Task<IActionResult> GetAllExpenses(
      [FromQuery] DateOnly? dateFrom = null,
      [FromQuery] DateOnly? dateTo = null,
      [FromQuery] List<Guid>? categoryIds = null,
      [FromQuery] Guid? propertyId = null,   // ← NEW
      [FromQuery] string? search = null,
      ...
  ```
  Update the `new GetAllExpensesQuery(...)` call to include `propertyId`.

- [x] 1.4 Update XML doc comments on the controller action to document the new parameter.

### Task 2: Backend — Add `search` filter to `GetAllIncome` (AC: #1)

> **Why:** The income API has no search capability. Expenses already has one. We need parity.

**Files to modify:**

- `backend/src/PropertyManager.Application/Income/GetAllIncome.cs`
- `backend/src/PropertyManager.Api/Controllers/IncomeController.cs`

- [x] 2.1 Add `string? Search` parameter to `GetAllIncomeQuery` record (insert after `PropertyId`):
  ```csharp
  public record GetAllIncomeQuery(
      DateOnly? DateFrom,
      DateOnly? DateTo,
      Guid? PropertyId,
      string? Search,          // ← NEW: search source and description
      int? Year
  ) : IRequest<IncomeListResult>;
  ```

- [x] 2.2 Add filter clause in `GetAllIncomeHandler.Handle()` — insert after the property filter block (line ~73), before query execution:
  ```csharp
  // Apply search filter - case-insensitive partial match on source and description (AC-16.11.1)
  if (!string.IsNullOrWhiteSpace(request.Search))
  {
      var searchTerm = request.Search.Trim().ToLower();
      query = query.Where(i =>
          (i.Source != null && i.Source.ToLower().Contains(searchTerm)) ||
          (i.Description != null && i.Description.ToLower().Contains(searchTerm)));
  }
  ```

- [x] 2.3 Add `[FromQuery] string? search = null` parameter to `IncomeController.GetAllIncome()` and pass to query constructor:
  ```csharp
  public async Task<IActionResult> GetAllIncome(
      [FromQuery] DateOnly? dateFrom = null,
      [FromQuery] DateOnly? dateTo = null,
      [FromQuery] Guid? propertyId = null,
      [FromQuery] string? search = null,      // ← NEW
      [FromQuery] int? year = null)
  {
      var query = new GetAllIncomeQuery(dateFrom, dateTo, propertyId, search, year);
  ```

- [x] 2.4 Update XML doc comments on the controller action to document the new parameter.

### Task 3: Backend unit tests (AC: #1, #3)

**New test files:**

- `backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesHandlerTests.cs` — add test for propertyId filter (if file exists, add test method; if not, create)
- `backend/tests/PropertyManager.Application.Tests/Income/GetAllIncomeHandlerTests.cs` — add test for search filter (if file exists, add test method; if not, create)

- [x] 3.1 Test: `Handle_WithPropertyId_FiltersExpensesByProperty` — verify only expenses for the given property are returned
- [x] 3.2 Test: `Handle_WithSearch_FiltersIncomeBySourceAndDescription` — verify income entries matching source OR description are returned
- [x] 3.3 Test: `Handle_WithSearch_CaseInsensitive` — verify search is case-insensitive
- [x] 3.4 Run `dotnet test` from `/backend` — all existing + new tests pass

### Task 4: Frontend — Regenerate NSwag API client (AC: all)

> **Why:** Backend API signatures changed (new query params). NSwag client must be regenerated so TypeScript types match.

- [x] 4.1 Ensure backend is running (`dotnet run --project src/PropertyManager.Api` from `/backend`)
- [x] 4.2 Run `npm run generate-api` from `/frontend`
- [x] 4.3 Verify generated client includes `propertyId` in expense list params and `search` in income list params

### Task 5: Frontend — Update ExpenseFilters and ExpenseService for property filter (AC: #3)

**Files to modify:**

- `frontend/src/app/features/expenses/services/expense.service.ts`
- `frontend/src/app/features/expenses/stores/expense-list.store.ts`
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts`

- [x] 5.1 Add `propertyId?: string` to `ExpenseFilters` interface in `expense.service.ts` (line ~78):
  ```typescript
  export interface ExpenseFilters {
    dateFrom?: string;
    dateTo?: string;
    categoryIds?: string[];
    propertyId?: string;    // ← NEW
    search?: string;
    year?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page: number;
    pageSize: number;
  }
  ```

- [x] 5.2 Add `propertyId` to the `getExpenses()` method's params builder in `expense.service.ts` (after categoryIds block, ~line 290):
  ```typescript
  if (filters.propertyId) {
    params['propertyId'] = filters.propertyId;
  }
  ```

- [x] 5.3 Add state fields to `ExpenseListState` in `expense-list.store.ts`:
  ```typescript
  selectedPropertyId: string | null;   // ← NEW
  properties: PropertyOption[];         // ← NEW (same type as income store)
  ```
  Initialize: `selectedPropertyId: null`, `properties: []`

- [x] 5.4 Add `setPropertyFilter` method to `ExpenseListStore`:
  ```typescript
  setPropertyFilter(propertyId: string | null): void {
    patchState(store, { selectedPropertyId: propertyId, page: 1 });
    // reload expenses
  }
  ```

- [x] 5.5 Update `currentFilters` computed signal to include `propertyId: store.selectedPropertyId()`.

- [x] 5.6 Update `hasActiveFilters` computed signal to include `|| store.selectedPropertyId() !== null`.

- [x] 5.7 Add property filter chip to `filterChips` computed signal (if property is selected, add chip with `type: 'property'`, `label: 'Property'`, `value: property name`).

- [x] 5.8 Handle `removeFilterChip` for `type: 'property'` — reset `selectedPropertyId` to null.

- [x] 5.9 Update `clearFilters` to reset `selectedPropertyId: null`.

- [x] 5.10 Add `loadProperties` method to `ExpenseListStore` initialize (load via `PropertyService.getProperties()`, store in `properties` state). Follow same pattern as `IncomeListStore`.

- [x] 5.11 Add property filter dropdown to `ExpenseFiltersComponent`:
  - Add `properties` input: `properties = input.required<PropertyOption[]>()`
  - Add `selectedPropertyId` input: `selectedPropertyId = input<string | null>(null)`
  - Add `propertyChange` output: `propertyChange = output<string | null>()`
  - Add mat-select template (between DateRangeFilter and Categories):
    ```html
    <!-- Property Filter (AC-16.11.3) -->
    <mat-form-field appearance="outline" class="filter-field property-field">
      <mat-label>Property</mat-label>
      <mat-select
        [value]="selectedPropertyId() || 'all'"
        (selectionChange)="onPropertyChange($event.value)">
        <mat-option value="all">All Properties</mat-option>
        @for (property of properties(); track property.id) {
          <mat-option [value]="property.id">{{ property.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    ```
  - Add `.property-field { min-width: 200px; }` to styles
  - Add handler method:
    ```typescript
    onPropertyChange(value: string): void {
      this.propertyChange.emit(value === 'all' ? null : value);
    }
    ```

- [x] 5.12 Wire new inputs/outputs in `expenses.component.ts` parent template:
  ```html
  [properties]="store.properties()"
  [selectedPropertyId]="store.selectedPropertyId()"
  (propertyChange)="onPropertyChange($event)"
  ```
  Add handler in parent:
  ```typescript
  onPropertyChange(propertyId: string | null): void {
    this.store.setPropertyFilter(propertyId);
  }
  ```

- [x] 5.13 Import `PropertyStore` (or `PropertyService`) into `ExpenseListStore` for loading properties. Follow same pattern as `IncomeListStore`.

### Task 6: Frontend — Move total display inside expense filter card (AC: #2)

**Files to modify:**

- `frontend/src/app/features/expenses/expenses.component.ts`
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts`

- [x] 6.1 **Remove** the `<app-list-total-display>` from `expenses.component.ts` template (currently rendered outside `<app-expense-filters>`).

- [x] 6.2 **Add** `<app-list-total-display>` **inside** `ExpenseFiltersComponent` template, at the bottom of `.filters-container` div (after filter chips):
  ```html
  @if (showTotal()) {
    <app-list-total-display
      label="Total Expenses"
      [amount]="totalAmount()"
      [showBorder]="true"
    />
  }
  ```

- [x] 6.3 Add inputs to `ExpenseFiltersComponent`:
  ```typescript
  totalAmount = input<number>(0);
  showTotal = input<boolean>(false);
  ```

- [x] 6.4 Add `ListTotalDisplayComponent` to `ExpenseFiltersComponent` imports array.

- [x] 6.5 Wire in parent `expenses.component.ts`:
  ```html
  [totalAmount]="store.totalAmount()"
  [showTotal]="!store.isLoading() && store.totalCount() > 0"
  ```

### Task 7: Frontend — Add search to income filter card (AC: #1)

**Files to modify:**

- `frontend/src/app/features/income/services/income.service.ts`
- `frontend/src/app/features/income/stores/income-list.store.ts`
- `frontend/src/app/features/income/income.component.ts`

- [x] 7.1 Add `search?: string` to `IncomeFilterParams` interface in `income.service.ts`:
  ```typescript
  export interface IncomeFilterParams {
    dateFrom?: string;
    dateTo?: string;
    propertyId?: string;
    search?: string;          // ← NEW
    year?: number;
  }
  ```

- [x] 7.2 Add search param to `getAllIncome()` method in `income.service.ts`:
  ```typescript
  if (params?.search && params.search.trim()) {
    queryParams['search'] = params.search.trim();
  }
  ```

- [x] 7.3 Add `searchText: string` to `IncomeListState` in `income-list.store.ts` (initialize: `searchText: ''`).

- [x] 7.4 Add `setSearch` method to `IncomeListStore`:
  ```typescript
  setSearch(searchText: string): void {
    patchState(store, { searchText });
    // reload income with updated filters
  }
  ```

- [x] 7.5 Update `currentFilters` computed signal to include `search: store.searchText()`.

- [x] 7.6 Update `hasActiveFilters` computed signal to include `|| store.searchText().trim() !== ''`.

- [x] 7.7 Update `clearFilters` method to reset `searchText: ''`.

- [x] 7.8 Add search field to income component template — insert after the property filter dropdown, inside the `.filters-row`:
  ```html
  <!-- Search Input (AC-16.11.1) -->
  <mat-form-field appearance="outline" class="filter-field search-field">
    <mat-label>Search source & description</mat-label>
    <input matInput [formControl]="searchControl" placeholder="Search income...">
    <mat-icon matPrefix>search</mat-icon>
    @if (searchControl.value) {
      <button matSuffix mat-icon-button aria-label="Clear search" (click)="clearSearch()">
        <mat-icon>close</mat-icon>
      </button>
    }
  </mat-form-field>
  ```

- [x] 7.9 Add `searchControl = new FormControl('')` to income component class, with debounce setup in constructor (same pattern as `ExpenseFiltersComponent`):
  ```typescript
  searchControl = new FormControl('');
  // In constructor:
  this.searchControl.valueChanges.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    takeUntil(this.destroy$)
  ).subscribe((value) => {
    this.incomeStore.setSearch(value || '');
  });
  ```

- [x] 7.10 Add `clearSearch()` method:
  ```typescript
  clearSearch(): void {
    this.searchControl.setValue('');
    this.incomeStore.setSearch('');
  }
  ```

- [x] 7.11 Sync search input when store resets (via effect):
  ```typescript
  effect(() => {
    const search = this.incomeStore.searchText();
    if (this.searchControl.value !== search) {
      this.searchControl.setValue(search, { emitEvent: false });
    }
  });
  ```

- [x] 7.12 Add necessary imports: `FormControl`, `ReactiveFormsModule`, `MatInputModule`, `MatIconModule`, `Subject`, `debounceTime`, `distinctUntilChanged`, `takeUntil`.

- [x] 7.13 Add `.search-field { min-width: 250px; flex: 1; }` to income component styles.

- [x] 7.14 Ensure `clearFilters()` in income component also resets `searchControl.setValue('', { emitEvent: false })`.

### Task 8: Frontend unit tests (AC: all)

- [x] 8.1 Update `expense-filters.component.spec.ts`:
  - Test property dropdown renders with "All Properties" default
  - Test property selection emits `propertyChange` with property ID
  - Test "All Properties" selection emits `propertyChange` with null
  - Test total display renders inside filter card when `showTotal` is true

- [x] 8.2 Update `expense-list.store` tests (if exist):
  - Test `setPropertyFilter` patches state and reloads
  - Test `currentFilters` includes `propertyId`
  - Test `hasActiveFilters` is true when propertyId is set
  - Test `clearFilters` resets propertyId

- [x] 8.3 Update `income.component.spec.ts`:
  - Test search field renders in filter card
  - Test search input triggers `setSearch` after debounce
  - Test clear search button resets search
  - Test `clearFilters` also clears search control

- [x] 8.4 Update `income-list.store` tests (if exist):
  - Test `setSearch` patches state and reloads
  - Test `currentFilters` includes `search`
  - Test `hasActiveFilters` is true when searchText is non-empty
  - Test `clearFilters` resets searchText

- [x] 8.5 Run `npm test` from `/frontend` — all tests pass (NEVER use `npx vitest`)
- [x] 8.6 Run `dotnet test` from `/backend` — all tests pass

### Task 9: Visual verification (AC: #4)

- [x] 9.1 Navigate to `/expenses` — verify property dropdown, search, category, date range, total all inside filter card
- [x] 9.2 Navigate to `/income` — verify search field, property dropdown, date range, total all inside filter card
- [x] 9.3 Compare both pages — confirm visual parity (date range, property, search, total present on both; category only on expenses)
- [x] 9.4 Test property filter on expenses — select a property, verify list filters correctly
- [x] 9.5 Test search on income — type search term, verify list filters on source and description
- [x] 9.6 Test responsive layout — verify filters stack on mobile (768px breakpoint)

## Dev Notes

### Architecture Compliance

- **Clean Architecture layers:** Backend changes touch Application (query/handler) and Api (controller) layers only. Domain untouched.
- **No repository pattern:** Handlers query `_dbContext` directly — follow existing pattern exactly.
- **CQRS pattern:** Query records + Handler classes co-located in single files. No separate DTOs needed.
- **Controller pattern:** `[FromQuery]` params → construct query record → `_mediator.Send()`. No try-catch (global exception middleware).
- **Frontend state:** `@ngrx/signals` stores with `patchState()`. Property filter follows exact pattern from `IncomeListStore`.
- **Presentation components:** `ExpenseFiltersComponent` is a presentation component with inputs/outputs — maintain this pattern when adding property filter and total display.

### Critical Patterns to Follow

| Pattern | Reference File | What to copy |
|---------|---------------|--------------|
| Property filter dropdown (income) | `features/income/income.component.ts` lines 109-123 | mat-select with "All Properties", `onPropertyChange()` handler |
| Property filter state management | `features/income/stores/income-list.store.ts` | `selectedPropertyId`, `setPropertyFilter`, `loadProperties`, `PropertyOption` type |
| Search input with debounce | `features/expenses/components/expense-filters/expense-filters.component.ts` lines 65-84 | mat-form-field, FormControl, debounceTime(300), clear button |
| Search backend filter | `Application/Expenses/GetAllExpenses.cs` lines 101-107 | `.Where()` with `.ToLower().Contains()` |
| Total inside filter card | `features/income/income.component.ts` | `<app-list-total-display>` with `showBorder="true"` inside mat-card |
| PropertyId backend filter | `Application/Income/GetAllIncome.cs` lines 69-73 | `.Where(i => i.PropertyId == request.PropertyId.Value)` |

### What's Already Working (Don't Rebuild)

- `DateRangeFilterComponent` — shared, used by both pages (story 16-6)
- `ListTotalDisplayComponent` — shared, used by both pages (story 16-6)
- `PropertyStore` with `properties()` signal and `loadProperties()` method
- `ExpenseFiltersComponent` — already has date range, category, search, filter chips
- Income filter card — already has date range, property dropdown, total inside card
- `ExpenseService.getExpenses()` — already builds query params, just needs `propertyId` added
- `IncomeService.getAllIncome()` — already builds query params, just needs `search` added
- Backend income `PropertyId` filter — already works
- Backend expense `Search` filter — already works (description only)

### API Changes Summary

**`GET /api/v1/expenses` — Add `propertyId` param:**
```
Before: dateFrom, dateTo, categoryIds, search, year, sortBy, sortDirection, page, pageSize
After:  dateFrom, dateTo, categoryIds, propertyId, search, year, sortBy, sortDirection, page, pageSize
```

**`GET /api/v1/income` — Add `search` param:**
```
Before: dateFrom, dateTo, propertyId, year
After:  dateFrom, dateTo, propertyId, search, year
```

Both are backward-compatible additions (new optional query params with null defaults).

### NSwag Client Regeneration

After backend changes, run `npm run generate-api` from `/frontend` to regenerate the TypeScript client. The generated types should automatically pick up the new query parameters. However, this project uses hand-written service classes (not NSwag-generated services), so the NSwag client may not be directly consumed. Verify whether generated types are used or if manual `ExpenseFilters`/`IncomeFilterParams` interfaces are the source of truth. **If manual interfaces are the source of truth (likely), skip NSwag regeneration and just update the interfaces manually** (Tasks 5.1, 7.1).

### Income Search: Source + Description

The income search must filter on BOTH `source` and `description` fields (OR condition). This differs from expense search which only searches `description`. The backend LINQ query uses `||` to match either field.

### Order of Backend Query Parameters

When adding parameters to record constructors, position matters because records use positional construction. Verify all callers are updated:
- `GetAllExpensesQuery` — used in `ExpensesController.GetAllExpenses()` only
- `GetAllIncomeQuery` — used in `IncomeController.GetAllIncome()` only

### Filter Chip Consistency

Income currently does NOT show filter chips. This story does NOT require adding filter chips to income. The scope is limited to the 4 ACs: search on income, total inside expense card, property on expenses, visual parity.

### Project Structure Notes

**Modified files:**
```
# Backend
backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs       # Add PropertyId param + filter
backend/src/PropertyManager.Application/Income/GetAllIncome.cs           # Add Search param + filter
backend/src/PropertyManager.Api/Controllers/ExpensesController.cs        # Add propertyId query param
backend/src/PropertyManager.Api/Controllers/IncomeController.cs          # Add search query param

# Backend Tests
backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesHandlerTests.cs  # Add/update
backend/tests/PropertyManager.Application.Tests/Income/GetAllIncomeHandlerTests.cs      # Add/update

# Frontend Services
frontend/src/app/features/expenses/services/expense.service.ts          # Add propertyId to ExpenseFilters
frontend/src/app/features/income/services/income.service.ts             # Add search to IncomeFilterParams

# Frontend Stores
frontend/src/app/features/expenses/stores/expense-list.store.ts         # Add property state + methods
frontend/src/app/features/income/stores/income-list.store.ts            # Add search state + methods

# Frontend Components
frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts  # Add property dropdown + total display
frontend/src/app/features/expenses/expenses.component.ts                 # Wire property filter, move total
frontend/src/app/features/income/income.component.ts                     # Add search field

# Frontend Tests
frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.spec.ts  # Update
frontend/src/app/features/income/income.component.spec.ts                # Update
```

**No new files needed** — all changes are modifications to existing files.

### Testing Requirements

**Backend (xUnit + Moq + FluentAssertions):**
- Test naming: `Handle_WithPropertyId_FiltersExpensesByProperty`, `Handle_WithSearch_FiltersIncomeBySourceAndDescription`
- Mock `IAppDbContext` with `MockQueryable.Moq` for DbSet mocking
- Verify filter is applied by checking result set only contains matching records

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- Update existing spec files for both components and stores
- Test signal store methods: `setPropertyFilter`, `setSearch`, `clearFilters`
- Test component rendering: property dropdown, search field, total display placement

### Previous Story Intelligence (16-10, 16-6)

**Story 16-10 (done):**
- Established `PropertyIncomeComponent` pattern for sub-components
- Used `IncomeService.getIncomeByProperty()` for property-scoped data
- Confirmed `ConfirmDialogComponent` and `MatDialog` patterns
- All 2525 tests passing at completion

**Story 16-6 (done):**
- Extracted `DateRangeFilterComponent` to `shared/components/date-range-filter/`
- Extracted `ListTotalDisplayComponent` to `shared/components/list-total-display/`
- Both components are already used by income and expense pages
- `ListTotalDisplayComponent` accepts `label`, `amount`, `showBorder` inputs

### Git Intelligence

Recent commits show:
- `4dda389` — Merged 16-10 (income list unification)
- `20efbce` — Code review perf/UX/test improvements
- `c4cb17d` — Fix scoping for E2E Add Income button locator
- Pattern: feature branches with PR merges, code review fixes as separate commits

### References

- [GitHub Issue #250](https://github.com/daveharmswebdev/property-manager/issues/250) — Align expense and income list filter cards
- [Source: `Application/Expenses/GetAllExpenses.cs` — Expense query handler (no propertyId)]
- [Source: `Application/Income/GetAllIncome.cs` — Income query handler (no search)]
- [Source: `Api/Controllers/ExpensesController.cs:144-180` — Expense list endpoint]
- [Source: `Api/Controllers/IncomeController.cs:46-69` — Income list endpoint]
- [Source: `features/expenses/services/expense.service.ts:78-88` — ExpenseFilters interface]
- [Source: `features/income/services/income.service.ts:57-62` — IncomeFilterParams interface]
- [Source: `features/expenses/components/expense-filters/expense-filters.component.ts` — Filter card with search]
- [Source: `features/income/income.component.ts` — Filter card with property dropdown + total inside]
- [Source: `features/expenses/stores/expense-list.store.ts` — Expense list state management]
- [Source: `features/income/stores/income-list.store.ts` — Income list state management]
- [Source: `shared/components/list-total-display/list-total-display.component.ts` — Shared total display]
- [Source: `shared/components/date-range-filter/date-range-filter.component.ts` — Shared date filter]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
