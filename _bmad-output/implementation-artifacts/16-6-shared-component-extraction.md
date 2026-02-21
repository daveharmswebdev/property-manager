# Story 16.6: Shared Component Extraction

Status: done

**GitHub Issues:** #215, #216
**Prerequisites:** Story 16.2 (Income Feature Parity) — DONE
**Effort:** Small-Medium — extract existing implementations, replace usages, one backend addition

## Story

As a **developer maintaining the application**,
I want **reusable date range and total display components**,
So that **list views are consistent and changes only need to happen in one place**.

## Acceptance Criteria

### AC1 — Shared date range selector (#215)

**Given** any list view with date filtering
**When** it needs a date filter
**Then** it uses a shared `DateRangeFilterComponent` with presets (All Time, This Month, This Quarter, This Year, Custom Range)
**And** the Expenses and Income pages both use this shared component

### AC2 — Shared total amount display (#216)

**Given** a list view showing financial records
**When** there is a filtered total to display
**Then** it uses a shared `ListTotalDisplayComponent` accepting a label and currency value
**And** both Income and Expenses list pages show their respective totals

## Tasks / Subtasks

### Task 1: Extract DateRangeFilterComponent to shared (AC: #1)

> **Why:** The `expense-filters.component.ts` has a well-designed date range UI with presets, custom range picker, and apply logic. This needs to be its own reusable component so Income (and future list views) can use the same UX.

**Create:** `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.ts`

- [x] 1.1 Extract `DateRangePreset` type and `getDateRangeFromPreset()` utility to `shared/utils/date-range.utils.ts`:
  ```typescript
  // Move from expense-list.store.ts lines 23, 100-134
  export type DateRangePreset = 'this-month' | 'this-quarter' | 'this-year' | 'custom' | 'all';

  export function getDateRangeFromPreset(
    preset: DateRangePreset,
    year?: number | null
  ): { dateFrom: string | null; dateTo: string | null } { ... }
  ```

- [x] 1.2 Create `DateRangeFilterComponent` with these inputs/outputs:
  ```typescript
  // Inputs
  dateRangePreset = input<DateRangePreset>('all');
  dateFrom = input<string | null>(null);
  dateTo = input<string | null>(null);

  // Outputs
  dateRangePresetChange = output<DateRangePreset>();
  customDateRangeChange = output<{ dateFrom: string; dateTo: string }>();
  ```

- [x] 1.3 Move the date range template from `expense-filters.component.ts` lines 51-79 into the new component:
  - Preset dropdown (mat-form-field + mat-select): All Time, This Month, This Quarter, This Year, Custom Range
  - Custom date range inputs (two mat-datepickers + Apply button) — shown only when preset is 'custom'
  - `formatLocalDate()` usage for date serialization (import from `shared/utils/date.utils.ts`)

- [x] 1.4 Move the relevant SCSS from `expense-filters.component.ts` lines 134-217:
  - `.date-range-field { min-width: 150px; }`
  - `.date-fields` container: flex row, gap 8px, align center
  - `.date-field { width: 140px; }`
  - Apply button styling

- [x] 1.5 Write unit tests: `date-range-filter.component.spec.ts`
  - Renders preset dropdown with 5 options
  - Emits `dateRangePresetChange` on selection
  - Shows custom date inputs when 'custom' selected
  - Emits `customDateRangeChange` with formatted dates on Apply
  - Does not emit if either custom date is missing

- [x] 1.6 Write unit tests: `date-range.utils.spec.ts`
  - `getDateRangeFromPreset('this-month')` returns first of month to today
  - `getDateRangeFromPreset('this-quarter')` returns first of quarter to today
  - `getDateRangeFromPreset('this-year')` returns Jan 1 to Dec 31
  - `getDateRangeFromPreset('all')` returns nulls
  - `getDateRangeFromPreset('custom')` returns nulls

### Task 2: Replace date range filter in ExpenseFiltersComponent (AC: #1)

> **Why:** `expense-filters.component.ts` is the origin — replace its inline date range UI with the new shared component. The category filter, search filter, and chip logic stay in `expense-filters.component.ts`.

**Modify:** `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts`

- [x] 2.1 Replace the date range template section (lines 49-79) with:
  ```html
  <app-date-range-filter
    [dateRangePreset]="dateRangePreset()"
    [dateFrom]="dateFrom()"
    [dateTo]="dateTo()"
    (dateRangePresetChange)="onDateRangePresetChange($event)"
    (customDateRangeChange)="onCustomDateRangeChange($event)"
  />
  ```

- [x] 2.2 Remove the now-redundant code from `expense-filters.component.ts`:
  - Remove `customDateFrom` and `customDateTo` FormControl declarations
  - Remove `applyCustomDateRange()` method
  - Remove date-related SCSS (moved to shared component)
  - Keep category, search, and chip logic untouched

- [x] 2.3 Update `expense-list.store.ts`:
  - Import `DateRangePreset` and `getDateRangeFromPreset` from `shared/utils/date-range.utils.ts`
  - Remove the local type definition and local utility function
  - All other store logic (persistence, chips, methods) stays unchanged

- [x] 2.4 Update `expense-filters.component.spec.ts`:
  - Adapt date range tests to work with the nested shared component
  - Category and search tests should be unchanged

### Task 3: Add date range filter to Income page (AC: #1)

> **Why:** Income currently has basic From/To date pickers with no presets (inferior UX). Replace with the shared component for preset support and consistency with Expenses.

**Modify:** `frontend/src/app/features/income/income.component.ts`

- [x] 3.1 Replace the inline date picker template (lines ~82-109 — the two mat-datepicker inputs) with:
  ```html
  <app-date-range-filter
    [dateRangePreset]="dateRangePreset()"
    [dateFrom]="incomeStore.dateFrom()"
    [dateTo]="incomeStore.dateTo()"
    (dateRangePresetChange)="onDateRangePresetChange($event)"
    (customDateRangeChange)="onCustomDateRangeChange($event)"
  />
  ```

- [x] 3.2 Remove the now-redundant code from `income.component.ts`:
  - Remove `dateFromValue` and `dateToValue` class properties
  - Remove `onDateFromChange()`, `onDateToChange()`, `updateDateRange()` methods
  - Remove the date-picker SCSS styles

- [x] 3.3 Update `income-list.store.ts` to support presets:
  - Add `dateRangePreset: DateRangePreset` to state (default: `'all'`)
  - Add `setDateRangePreset(preset)` method (calculates dates via `getDateRangeFromPreset()`, calls `loadIncome()`)
  - Add `setCustomDateRange(dateFrom, dateTo)` method (sets preset to 'custom', calls `loadIncome()`)
  - Add sessionStorage persistence for date filter (key: `'propertyManager.incomeList.dateFilter'`) — follow the expense-list.store pattern
  - Restore persisted filter in `initialize()`

- [x] 3.4 Add event handlers to `income.component.ts`:
  ```typescript
  dateRangePreset = computed(() => this.incomeStore.dateRangePreset());

  onDateRangePresetChange(preset: DateRangePreset) {
    this.incomeStore.setDateRangePreset(preset);
  }

  onCustomDateRangeChange(range: { dateFrom: string; dateTo: string }) {
    this.incomeStore.setCustomDateRange(range.dateFrom, range.dateTo);
  }
  ```

- [x] 3.5 Update `income-list.store.spec.ts`:
  - Test `setDateRangePreset()` triggers reload with correct dates
  - Test `setCustomDateRange()` sets preset to 'custom' and reloads
  - Test sessionStorage persistence and restore

- [x] 3.6 Update `income.component.spec.ts`:
  - Add mock for `dateRangePreset` signal
  - Test date range filter renders
  - Test preset change calls store method

### Task 4: Create ListTotalDisplayComponent (AC: #2)

> **Why:** Income page already shows "Total Income: $3,000.00". Extract into a reusable component and standardize on the Angular `currency` pipe (currently income uses `Intl.NumberFormat` in a computed signal — inconsistent).

**Create:** `frontend/src/app/shared/components/list-total-display/list-total-display.component.ts`

- [x] 4.1 Create component with these inputs:
  ```typescript
  @Component({
    selector: 'app-list-total-display',
    standalone: true,
    imports: [CurrencyPipe],
    template: `
      <div class="list-total" [class.with-border]="showBorder()">
        <span class="total-label">{{ label() }}:</span>
        <span class="total-amount">{{ amount() | currency }}</span>
      </div>
    `,
    styles: [`
      .list-total {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .list-total.with-border {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .total-label {
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
      }
      .total-amount {
        font-size: 1.25em;
        font-weight: 600;
        color: var(--mat-sys-primary);
      }
    `]
  })
  export class ListTotalDisplayComponent {
    label = input.required<string>();
    amount = input<number>(0);
    showBorder = input<boolean>(false);
  }
  ```

- [x] 4.2 Write unit tests: `list-total-display.component.spec.ts`
  - Renders label text
  - Formats amount as currency
  - Shows border when `showBorder` is true
  - Does not show border by default
  - Handles zero amount

### Task 5: Add TotalAmount to expense list backend (AC: #2)

> **Why:** `GetAllExpenses` returns `PagedResult<T>` with no `TotalAmount`. Income has it (`IncomeListResult.TotalAmount`). We need the backend to compute the sum of ALL filtered expenses (not just the current page) and return it.

**Modify:** `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs`

- [x] 5.1 Add `decimal TotalAmount` to `PagedResult<T>` (it's only used by expenses, defined in this file):
  ```csharp
  public record PagedResult<T>(
      List<T> Items,
      int TotalCount,
      int Page,
      int PageSize,
      int TotalPages,
      decimal TotalAmount = 0   // New: sum of filtered expenses
  );
  ```

- [x] 5.2 Compute total in handler BEFORE pagination (after all filters applied, before `.Skip().Take()`):
  ```csharp
  // After line 109 (var totalCount = await query.CountAsync(...))
  var totalAmount = await query.SumAsync(e => e.Amount, cancellationToken);
  ```
  Pass `TotalAmount: totalAmount` in the `return new PagedResult<>()` constructor.

- [x] 5.3 Update `ExpensesController.cs` response documentation (if needed — `[ProducesResponseType]` already uses `PagedResult<ExpenseListItemDto>` so it auto-includes the new field).

- [x] 5.4 Write/update backend unit test for `GetAllExpensesHandler`:
  - Test that `TotalAmount` is returned as the sum of all matching expenses
  - Test that pagination does NOT affect `TotalAmount` (total is across ALL pages)

### Task 6: Wire expense total in frontend (AC: #2)

> **Why:** Frontend needs to receive, store, and display the new `TotalAmount` from the API.

**Modify:** `frontend/src/app/features/expenses/services/expense.service.ts`

- [x] 6.1 Add `totalAmount` to `PagedResult<T>` interface (line 93-99):
  ```typescript
  export interface PagedResult<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    totalAmount: number;  // New
  }
  ```

**Modify:** `frontend/src/app/features/expenses/stores/expense-list.store.ts`

- [x] 6.2 Add `totalAmount: number` to `ExpenseListState` (default: 0)
- [x] 6.3 Store `totalAmount` from API response in `loadExpenses` handler: `totalAmount: response.totalAmount`
- [x] 6.4 Expose `totalAmount` signal (it's already exposed via `withState`)

**Modify:** `frontend/src/app/features/expenses/expenses.component.ts`

- [x] 6.5 Add `ListTotalDisplayComponent` to imports and template:
  ```html
  @if (!store.isLoading() && store.hasExpenses()) {
    <app-list-total-display
      label="Total Expenses"
      [amount]="store.totalAmount()"
      [showBorder]="true"
    />
  }
  ```
  Place between the filters section and the expense table.

- [x] 6.6 Update `expense-list.store.spec.ts`:
  - Verify `totalAmount` is set from API response
  - Verify `totalAmount` resets on filter change

### Task 7: Replace Income total with shared component (AC: #2)

> **Why:** Income page currently uses `Intl.NumberFormat` in a computed signal (`formattedTotalAmount`). Replace with the shared component for consistency.

**Modify:** `frontend/src/app/features/income/income.component.ts`

- [x] 7.1 Replace the inline total section (lines ~138-144) with:
  ```html
  @if (!incomeStore.isLoading() && incomeStore.totalCount() > 0) {
    <app-list-total-display
      label="Total Income"
      [amount]="incomeStore.totalAmount()"
      [showBorder]="true"
    />
  }
  ```

- [x] 7.2 Remove `formattedTotalAmount` computed signal from `income-list.store.ts` (no longer needed — the shared component handles formatting)

- [x] 7.3 Remove `.total-section`, `.total-label`, `.total-amount` CSS from `income.component.ts`

- [x] 7.4 Update `income.component.spec.ts` total display test to use the shared component

### Task 8: Run all tests (AC: all)

- [x] 8.1 `npm test` from `/frontend` — all tests pass (NEVER use `npx vitest` directly)
- [x] 8.2 `dotnet test` from `/backend` — all tests pass
- [x] 8.3 Verify no TypeScript compilation errors
- [x] 8.4 Verify NSwag regeneration is NOT needed (types are manually defined in expense.service.ts)

## Dev Notes

### Zero-Change Inventory (Don't Rebuild)

| Component / File | Path | What it does | Reuse how |
|---|---|---|---|
| `formatLocalDate()` | `shared/utils/date.utils.ts` | Formats Date → `YYYY-MM-DD` local timezone | Import in new DateRangeFilterComponent |
| `parseLocalDate()` | `shared/utils/date.utils.ts` | Parses ISO date in local timezone | Already used by expense filters |
| `MatDatepickerModule` | `@angular/material/datepicker` | Date picker UI | Import in new shared component |
| `MatSelectModule` | `@angular/material/select` | Dropdown select | Import in new shared component |
| `CurrencyPipe` | `@angular/common` | Currency formatting | Import in new ListTotalDisplayComponent |
| `sessionStorage` pattern | `expense-list.store.ts` lines 136-151 | Date filter persistence | Copy pattern for income-list.store |
| `ExpenseFiltersComponent` | `features/expenses/components/expense-filters/` | Category filter, search, chips | Keep as-is — only date section extracted |
| `ConfirmDialogComponent` | `shared/components/confirm-dialog/` | Not relevant | Don't touch |
| `StatsBarComponent` | `shared/components/stats-bar/` | Dashboard YTD totals with icons | Different use case — don't merge with list-total |
| `YearSelectorComponent` | `shared/components/year-selector/` | Tax year selector | Not related — don't touch |

### Architecture Notes

**Component Extraction Strategy:**
- `DateRangeFilterComponent` is a **presentation component** — it owns no state. It receives values via inputs and emits changes via outputs. The parent page/store is responsible for computing date ranges and calling APIs.
- `ListTotalDisplayComponent` is a **presentation component** — it just displays a formatted label + amount. Zero logic.
- The `getDateRangeFromPreset()` utility function moves to `shared/utils/` because it's pure logic used by multiple stores.

**Income Store Enhancement:**
- The income-list.store currently has bare `setDateRange(dateFrom, dateTo)`. This story adds `dateRangePreset` state + `setDateRangePreset()` method to match the expense-list.store pattern.
- Also adds sessionStorage persistence for income date filters (matching expense pattern).
- The existing `setDateRange()` method can be removed or kept as internal — `setCustomDateRange()` replaces its public API.

**Backend Change Scope:**
- Only `GetAllExpenses.cs` changes. One `SumAsync()` call added before pagination.
- The `PagedResult<T>` record gets a new field with a default value, so no other consumers break.
- The controller needs no changes — the response type auto-includes the new field.

**Work Orders Assessment:**
- Work orders have NO date filtering currently. Adding it would be scope creep.
- If needed in future, `DateRangeFilterComponent` is ready to drop in.

### Files NOT to Modify

- Any component in `shared/components/` that isn't listed above (stats-bar, year-selector, confirm-dialog, etc.)
- `expense-workspace.component.ts` — per-property workspace, uses `ExpenseStore` (not `ExpenseListStore`)
- `income-workspace.component.ts` — per-property workspace, different store
- Any work order files
- Any receipt files
- `proxy.conf.json` or `angular.json`

### Previous Story Intelligence (16.5)

Story 16.5 established:
- `var(--mat-sys-*)` CSS custom properties for theming consistency
- `data-testid` attributes on key interactive elements
- All 2,424 frontend tests passing as baseline
- Signal-based patterns with computed signals

### Git Intelligence

Recent commits show stable main branch:
```
480f2d1 Merge pull request #247 — feature/16-5-ux-polish-bundle
cad3eae fix: address code review issues for UX polish bundle (#247)
4b57395 feat: add UX polish — delete details, edit form borders, receipt timestamps (#220, #222, #223)
```

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- New spec files:
  - `shared/components/date-range-filter/date-range-filter.component.spec.ts`
  - `shared/components/list-total-display/list-total-display.component.spec.ts`
  - `shared/utils/date-range.utils.spec.ts`
- Modified spec files:
  - `expense-filters.component.spec.ts` — adapt for nested shared component
  - `expense-list.store.spec.ts` — import path changes, totalAmount tests
  - `income.component.spec.ts` — date range + total display changes
  - `income-list.store.spec.ts` — preset methods, sessionStorage

**Backend (xUnit + Moq + FluentAssertions):**
- Modify `GetAllExpensesHandlerTests` — verify `TotalAmount` computation

**Testing Pattern:**
```typescript
// Shared component input testing (use setInput)
fixture.componentRef.setInput('label', 'Total Expenses');
fixture.componentRef.setInput('amount', 1234.56);
fixture.detectChanges();
expect(fixture.nativeElement.querySelector('.total-amount').textContent).toContain('$1,234.56');
```

### References

- [GitHub Issue #215](https://github.com/daveharmswebdev/property-manager/issues/215) — Extract Date Range selector into reusable shared component
- [GitHub Issue #216](https://github.com/daveharmswebdev/property-manager/issues/216) — Extract total amount display into reusable shared component
- [Source: `features/expenses/components/expense-filters/expense-filters.component.ts` — Date range reference implementation]
- [Source: `features/expenses/stores/expense-list.store.ts` — DateRangePreset type, getDateRangeFromPreset(), persistence pattern]
- [Source: `features/income/income.component.ts` — Total display reference, basic date pickers to replace]
- [Source: `features/income/stores/income-list.store.ts` — Income date filtering, totalAmount, formattedTotalAmount]
- [Source: `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` — PagedResult record, handler to add TotalAmount]
- [Source: `backend/src/PropertyManager.Application/Income/GetAllIncome.cs` — IncomeListResult with TotalAmount (reference pattern)]
- [Source: `shared/utils/date.utils.ts` — formatLocalDate, parseLocalDate utilities]
- [Source: `shared/components/stats-bar/stats-bar.component.ts` — Testing pattern reference for signal inputs]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Extracted `DateRangeFilterComponent` and `date-range.utils.ts` to shared (Task 1)
- Created `ListTotalDisplayComponent` (Task 4)
- Added `TotalAmount` to backend `PagedResult<T>` with `SumAsync` before pagination (Task 5)
- Replaced inline date range in expense filters with shared component (Task 2)
- Added date range presets + sessionStorage persistence to income store (Task 3)
- Replaced inline date pickers and total display in income component (Tasks 3+7)
- Wired expense `totalAmount` from API through store to `<app-list-total-display>` (Task 6)
- All 2,466 frontend tests passing, 1,489 backend tests passing, 6/6 new E2E tests passing
- One E2E test (income total display) flaky due to transient login timeout — not a code issue

### File List

**Created:**
- `frontend/src/app/shared/utils/date-range.utils.ts`
- `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.ts`
- `frontend/src/app/shared/components/list-total-display/list-total-display.component.ts`

**Modified (Frontend):**
- `frontend/src/app/features/expenses/services/expense.service.ts` — added `totalAmount` to `PagedResult<T>`
- `frontend/src/app/features/expenses/services/expense.service.spec.ts` — added `totalAmount` to mock responses
- `frontend/src/app/features/expenses/stores/expense-list.store.ts` — shared imports, `totalAmount` state, store from response
- `frontend/src/app/features/expenses/stores/expense-list.store.spec.ts` — added `totalAmount` tests + mock response field
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.ts` — replaced inline date range with shared component
- `frontend/src/app/features/expenses/components/expense-filters/expense-filters.component.spec.ts` — updated for nested component
- `frontend/src/app/features/expenses/expenses.component.ts` — added `ListTotalDisplayComponent`
- `frontend/src/app/features/expenses/expenses.component.spec.ts` — added `totalAmount` to mock stores
- `frontend/src/app/features/income/income.component.ts` — replaced date pickers and total with shared components
- `frontend/src/app/features/income/income.component.spec.ts` — updated for shared components
- `frontend/src/app/features/income/stores/income-list.store.ts` — added presets, sessionStorage persistence
- `frontend/src/app/features/income/stores/income-list.store.spec.ts` — updated for preset/custom methods

**Modified (Backend):**
- `backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs` — added `TotalAmount` to `PagedResult<T>`, `SumAsync` in handler
