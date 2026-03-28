# Story 15.3: Expense List UX Improvements

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a property owner viewing my expenses,
I want to create expenses from the list page, have my filters persist, and sort by columns,
so that the expense list is fully functional and not read-only.

## Acceptance Criteria

**AC1 — Add Expense button (GitHub #204):**
Given I am on the `/expenses` page
When I look at the page header area
Then I see an "Add Expense" button (mat-stroked-button, matching Property Detail page pattern)
And clicking it navigates me to the create expense flow

Given I have only one property
When I click "Add Expense"
Then I navigate directly to `/properties/{propertyId}/expenses`

Given I have multiple properties
When I click "Add Expense"
Then a property selection dialog opens
And after selecting a property, I navigate to `/properties/{propertyId}/expenses`

**AC2 — Custom date range persistence (GitHub #206):**
Given I set a custom date range filter (From/To) and navigate away
When I navigate back to the Expenses page
Then the From/To date picker inputs repopulate with my previously selected dates
And the filtered results match those dates

Given I set a custom date range filter and refresh the page
When the Expenses page loads
Then the custom date range is restored from sessionStorage
And the filtered results match those dates

**AC3 — Column sorting (GitHub #207):**
Given I am on the Expenses list page
When I click a sortable column header (Date, Amount, Property, Category, Description)
Then the table sorts by that column with a visible sort direction indicator (arrow icon)
And clicking again toggles ascending/descending

Given the default sort is Date descending (newest first)
When I change the sort column or direction
Then the API is called with the new sort parameters (server-side sorting)

## Tasks / Subtasks

- [x] Task 1: Add "Add Expense" button with property selection (AC: #1)
  - [x] 1.1: Create `PropertyPickerDialogComponent` — standalone dialog with property list from `PropertyStore`, emits selected property ID
  - [x] 1.2: In `expenses.component.ts`, add "Add Expense" `mat-stroked-button` with `mat-icon` "add" in the `.page-header` div (right-aligned, matching Property Detail page design)
  - [x] 1.3: Inject `Router`, `PropertyStore`, `MatDialog` in `ExpensesComponent`
  - [x] 1.4: Implement `onAddExpense()` method — load properties if needed, if 1 property navigate directly to `/properties/{id}/expenses`, if multiple open `PropertyPickerDialogComponent`
  - [x] 1.5: Add unit test: "Add Expense" button renders in page header
  - [x] 1.6: Add unit test: single-property scenario navigates directly
  - [x] 1.7: Add unit test: multi-property scenario opens dialog

- [x] Task 2: Fix custom date range navigation persistence (AC: #2 — navigation)
  - [x] 2.1: In `expense-filters.component.ts`, add new inputs: `dateFrom = input<string | null>()` and `dateTo = input<string | null>()`
  - [x] 2.2: Add `effect()` to sync `dateFrom()`/`dateTo()` inputs to `customDateFrom`/`customDateTo` FormControls — parse ISO string to `Date` object for the datepicker (mirror the existing search sync `effect()` at line 252)
  - [x] 2.3: In `expenses.component.ts` template, pass `[dateFrom]="store.dateFrom()"` and `[dateTo]="store.dateTo()"` to `<app-expense-filters>`
  - [x] 2.4: Add unit test: when `dateFrom`/`dateTo` inputs change, FormControls update
  - [x] 2.5: Add unit test: on component init with custom preset and dates, pickers show the dates

- [x] Task 3: Add sessionStorage persistence for date range filter (AC: #2 — refresh)
  - [x] 3.1: In `expense-list.store.ts`, add private helper `persistDateFilter()` that saves `{ dateRangePreset, dateFrom, dateTo }` to sessionStorage key `'propertyManager.expenseList.dateFilter'`
  - [x] 3.2: Add private helper `restoreDateFilter()` that reads from sessionStorage and returns partial state or `null`
  - [x] 3.3: In `initialize()` method, call `restoreDateFilter()` before loading — if data exists, `patchState()` with restored values before calling `loadExpenses()`
  - [x] 3.4: Call `persistDateFilter()` inside `setDateRangePreset()`, `setCustomDateRange()`, `clearFilters()`, and `removeFilterChip()` (for date-range chip removal)
  - [x] 3.5: Add unit test: after `setCustomDateRange()`, sessionStorage contains expected values
  - [x] 3.6: Add unit test: `initialize()` restores from sessionStorage when data present
  - [x] 3.7: Add unit test: `clearFilters()` clears sessionStorage entry

- [x] Task 4: Add server-side column sorting — Backend (AC: #3)
  - [x] 4.1: In `GetAllExpenses.cs`, add `string? SortBy` and `string? SortDirection` parameters to `GetAllExpensesQuery` record (default `null`)
  - [x] 4.2: In `GetAllExpensesHandler.Handle()`, replace hardcoded `.OrderByDescending(e => e.Date).ThenByDescending(e => e.CreatedAt)` with dynamic sort logic based on `SortBy`/`SortDirection` — supported values: `"date"`, `"amount"`, `"property"`, `"category"`, `"description"` (default: `"date"` descending)
  - [x] 4.3: In `ExpensesController.cs` `GetAllExpenses` action, add `[FromQuery] string? sortBy = null` and `[FromQuery] string? sortDirection = null` parameters, pass to query
  - [x] 4.4: Update `GetAllExpensesHandlerTests.cs` — add test for each sort column (ascending + descending)
  - [x] 4.5: Update `GetAllExpensesHandlerTests.cs` — add test for invalid sort column falls back to date descending
  - [x] 4.6: Run `dotnet test` from `/backend` — all tests must pass

- [x] Task 5: Add column sorting — Frontend (AC: #3)
  - [x] 5.1: In `expense.service.ts`, add `sortBy?: string` and `sortDirection?: 'asc' | 'desc'` to `ExpenseFilters` interface
  - [x] 5.2: In `expense.service.ts` `getExpenses()` method, pass `sortBy` and `sortDirection` as query params when present
  - [x] 5.3: In `expense-list.store.ts`, add `sortBy: string | null` and `sortDirection: 'asc' | 'desc'` to state (default `null` and `'desc'`)
  - [x] 5.4: Add `setSort(sortBy: string)` method — toggles direction if same column, resets to `'asc'` if new column, resets page to 1, reloads
  - [x] 5.5: Include `sortBy` and `sortDirection` in `currentFilters` computed signal
  - [x] 5.6: In `expenses.component.ts` template, replace static `.list-header` divs with clickable header buttons that call `store.setSort('date')`, etc.
  - [x] 5.7: Add sort direction arrow icon next to active sort column header (use `mat-icon` `arrow_upward`/`arrow_downward`)
  - [x] 5.8: Style sort headers: cursor pointer, hover highlight, active column emphasized
  - [x] 5.9: Add unit test: clicking "Date" header calls `store.setSort('date')`
  - [x] 5.10: Add unit test: sort icon shows on active column
  - [x] 5.11: Add unit test: clicking same column toggles direction
  - [x] 5.12: Run `npm test` from `/frontend` — all tests must pass

- [x] Task 6: Regenerate API client
  - [x] 6.1: Run `npm run generate-api` from `/frontend` to pick up new sortBy/sortDirection query params
  - [x] 6.2: Verify generated client includes the new parameters

## Dev Notes

### Current State — Expense List Page

**File:** `frontend/src/app/features/expenses/expenses.component.ts`

The expense list uses a **custom CSS Grid layout** (NOT mat-table). The header at line 110-118 is a `<div class="list-header">` with grid columns: `100px 150px 1fr auto 40px 40px 100px` (Date, Property, Description, Category, Receipt icon, WO icon, Amount). Rows are rendered via `@for` loop with `<app-expense-list-row>` components.

**No "Add Expense" button** exists. The empty state (line 89-90) tells users "Go to a property's expense workspace to add expenses."

**No column sorting** — headers are static text with no click handlers.

### Current State — Expense Filters

**File:** `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts`

The custom date picker uses two FormControls (line 236-237):
```typescript
customDateFrom = new FormControl<Date | null>(null);
customDateTo = new FormControl<Date | null>(null);
```

**BUG (navigation persistence):** These controls are initialized to `null` and never synced from the store's `dateFrom`/`dateTo` values. The component receives `dateRangePreset` as input but NOT `dateFrom`/`dateTo`. So when navigating back, the preset dropdown shows "Custom Range" correctly (synced from store) but the date pickers are empty. The store retains the date values (it's `providedIn: 'root'`), and the API filters work correctly — only the picker UI is out of sync.

Compare with the `searchText` sync pattern that works correctly (line 252-257):
```typescript
effect(() => {
  const search = this.searchText();
  if (this.searchControl.value !== search) {
    this.searchControl.setValue(search, { emitEvent: false });
  }
});
```
The same pattern is needed for `dateFrom`/`dateTo`.

### Current State — Expense List Store

**File:** `frontend/src/app/features/expenses/stores/expense-list.store.ts`

- `providedIn: 'root'` singleton — state persists across SPA navigation but NOT across page refresh
- No `sortBy`/`sortDirection` in state
- No sessionStorage persistence for any filter values
- `currentFilters` computed signal (line 246-260) builds `ExpenseFilters` for API calls — no sort params currently

### Current State — Backend GetAllExpenses

**File:** `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs`

The handler hardcodes sorting at line 116-118:
```csharp
.OrderByDescending(e => e.Date)
.ThenByDescending(e => e.CreatedAt)
```

The `GetAllExpensesQuery` record (line 10-18) has no `SortBy`/`SortDirection` parameters.

**File:** `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`

The `GetAllExpenses` action (line 144-173) accepts query params but has no sort params.

### Current State — Property Access for Add Expense Button

**File:** `frontend/src/app/features/properties/stores/property.store.ts`

The `PropertyStore` is `providedIn: 'root'` and contains the user's properties. It has a `properties()` signal and `loadProperties()` method. The dashboard loads properties on init, so they should be available when navigating to the expenses page.

The Property Detail page's "Add Expense" button pattern (`frontend/src/app/features/properties/property-detail/property-detail.component.ts` line 100-105):
```html
<button mat-stroked-button color="primary"
        [routerLink]="['/properties', propertyStore.selectedProperty()!.id, 'expenses']">
  <mat-icon>add</mat-icon>
  <span class="button-text">Add Expense</span>
</button>
```

### Backend Sort Implementation Pattern

For Task 4.2, the dynamic sort in the handler should use a switch expression:

```csharp
var sortBy = request.SortBy?.ToLowerInvariant();
var ascending = string.Equals(request.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

IOrderedQueryable<Expense> orderedQuery = sortBy switch
{
    "amount" => ascending ? query.OrderBy(e => e.Amount) : query.OrderByDescending(e => e.Amount),
    "property" => ascending ? query.OrderBy(e => e.Property.Name) : query.OrderByDescending(e => e.Property.Name),
    "category" => ascending ? query.OrderBy(e => e.Category.Name) : query.OrderByDescending(e => e.Category.Name),
    "description" => ascending ? query.OrderBy(e => e.Description) : query.OrderByDescending(e => e.Description),
    _ => ascending ? query.OrderBy(e => e.Date) : query.OrderByDescending(e => e.Date), // Default: date
};

var expenses = await orderedQuery
    .ThenByDescending(e => e.CreatedAt)
    .Skip(skip)
    .Take(pageSize)
    // ... rest of Select/ToList
```

### Sort Header UI Pattern

Keep the CSS Grid layout. Replace static header divs with clickable elements:

```html
<div class="list-header">
  <button class="sort-header header-date" [class.active]="store.sortBy() === 'date'" (click)="store.setSort('date')">
    Date
    @if (store.sortBy() === 'date') {
      <mat-icon class="sort-icon">{{ store.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
    }
  </button>
  <!-- repeat for property, description, category -->
  <div class="header-receipt"></div>
  <div class="header-work-order"></div>
  <button class="sort-header header-amount" [class.active]="store.sortBy() === 'amount'" (click)="store.setSort('amount')">
    Amount
    @if (store.sortBy() === 'amount') {
      <mat-icon class="sort-icon">{{ store.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
    }
  </button>
</div>
```

Sort headers should use `display: inline-flex; align-items: center; cursor: pointer;` with no button chrome (reset button styles).

### PropertyPickerDialogComponent Pattern

Create a minimal standalone dialog:

```typescript
// frontend/src/app/features/expenses/components/property-picker-dialog/property-picker-dialog.component.ts
@Component({
  standalone: true,
  imports: [MatDialogModule, MatListModule, MatIconModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Select Property</h2>
    <mat-dialog-content>
      <mat-selection-list [multiple]="false" (selectionChange)="onSelect($event)">
        @for (property of data.properties; track property.id) {
          <mat-list-option [value]="property.id">{{ property.name }}</mat-list-option>
        }
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `
})
```

### sessionStorage Persistence Pattern

```typescript
const STORAGE_KEY = 'propertyManager.expenseList.dateFilter';

function persistDateFilter(preset: DateRangePreset, dateFrom: string | null, dateTo: string | null): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dateRangePreset: preset, dateFrom, dateTo }));
}

function restoreDateFilter(): Partial<ExpenseListState> | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const { dateRangePreset, dateFrom, dateTo } = JSON.parse(stored);
    return { dateRangePreset, dateFrom, dateTo };
  } catch {
    return null;
  }
}
```

### Project Structure Notes

**New files:**
- `frontend/src/app/features/expenses/components/property-picker-dialog/property-picker-dialog.component.ts`
- `frontend/src/app/features/expenses/components/property-picker-dialog/property-picker-dialog.component.spec.ts`

**Modified files:**
- `frontend/src/app/features/expenses/expenses.component.ts` — Add button, sort headers, new imports
- `frontend/src/app/features/expenses/expenses.component.spec.ts` — New tests for button and sort
- `frontend/src/app/features/expenses/stores/expense-list.store.ts` — Sort state, persistence
- `frontend/src/app/features/expenses/stores/expense-list.store.spec.ts` — New tests for sort and persistence
- `frontend/src/app/features/expenses/services/expense.service.ts` — Sort params
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts` — Date inputs + sync effect
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.spec.ts` — Date sync tests
- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` — SortBy/SortDirection params
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` — Sort query params
- `backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesHandlerTests.cs` — Sort tests

### Testing Patterns to Follow

**Backend (xUnit + Moq + FluentAssertions):**
- Test naming: `Handle_Scenario_ExpectedResult`
- MockQueryable.Moq for DbSet mocking: `expenses.AsQueryable().BuildMockDbSet()`
- Verify sort order by checking `Items[0]` and `Items[1]` order

**Frontend (Vitest):**
- Spec files co-located with source
- `describe/it` blocks, `vi.fn()` for mocks
- TestBed configuration in `beforeEach` with service mocks
- Mock `sessionStorage` via `vi.spyOn(Storage.prototype, 'getItem')` / `vi.spyOn(Storage.prototype, 'setItem')`
- Run tests: `npm test` from `/frontend`

### References

- [Source: epic-15-manual-testing-bug-fixes.md#Story 15.3]
- [Source: GitHub Issue #204 — Expenses page missing Add Expense button]
- [Source: GitHub Issue #206 — Custom date range filter loses date values on navigation and refresh]
- [Source: GitHub Issue #207 — Add column sorting to expense list table]
- [Source: frontend/src/app/features/expenses/expenses.component.ts — current expense list page]
- [Source: frontend/src/app/features/expenses/stores/expense-list.store.ts — current store state]
- [Source: frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts — date picker bug]
- [Source: frontend/src/app/features/expenses/services/expense.service.ts — API service]
- [Source: backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs — handler with hardcoded sort]
- [Source: backend/src/PropertyManager.Api/Controllers/ExpensesController.cs — controller endpoint]
- [Source: frontend/src/app/features/properties/property-detail/property-detail.component.ts — Add Expense button pattern]
- [Source: _bmad-output/project-context.md — Angular patterns, testing rules, architecture]

### Git Intelligence

Recent commits show Stories 15-1 (Login Form Fixes) and 15-2 (Form Validation Bugs) were just completed. Story 15-4 (UnlinkReceipt) is also done. This story is independent with no prerequisites. The expense list page has been stable since Epic 3 (Story 3-4). No recent changes to the expense list or filters area.

Last 5 commits:
1. `9a78128` — Merge PR #214 (15-2 form validation bugs)
2. `ebfdfd1` — fix: note field reset to pristine and category required indicator
3. `be72ac3` — Merge PR #213 (15-1 login form fixes)
4. `235ca4d` — refactor: remove dead CommonModule import
5. `cc21d54` — fix: login form — stricter email validation, remove Remember Me, honor returnUrl

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 6 tasks completed with full test coverage
- Backend: 4 new sort tests (compile fix + handler logic) — all 1,446 backend tests pass
- Frontend: 19 new unit tests across components/store — all 2,330 frontend tests pass
- ATDD tests written by TEA in RED phase, GREEN phase completed by dev
- API client regenerated with sortBy/sortDirection params confirmed in swagger

### File List

**New files:**
- `frontend/src/app/features/expenses/components/property-picker-dialog/property-picker-dialog.component.ts`

**Modified files (backend):**
- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` — SortBy/SortDirection on query + dynamic sort in handler
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` — sortBy/sortDirection query params
- `backend/tests/PropertyManager.Application.Tests/Expenses/GetAllExpensesHandlerTests.cs` — 4 sort unit tests (ATDD)

**Modified files (frontend):**
- `frontend/src/app/features/expenses/expenses.component.ts` — Add Expense button, sort headers, PropertyStore/Router injection
- `frontend/src/app/features/expenses/expenses.component.spec.ts` — 7 new tests (AC1 button + AC3 sort headers)
- `frontend/src/app/features/expenses/stores/expense-list.store.ts` — sortBy/sortDirection state, setSort(), sessionStorage persist/restore
- `frontend/src/app/features/expenses/stores/expense-list.store.spec.ts` — 12 new tests (sessionStorage + sort)
- `frontend/src/app/features/expenses/services/expense.service.ts` — sortBy/sortDirection on ExpenseFilters + getExpenses()
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts` — dateFrom/dateTo inputs + sync effects
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.spec.ts` — 3 new tests (date sync)
- `frontend/src/app/core/services/api.service.ts` — regenerated NSwag client
