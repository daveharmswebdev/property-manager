# Story 17.12: Replace Global Year Selector with Dashboard Date Range Filter

Status: ready-for-dev

## Story

As a property owner viewing financial summaries,
I want date range filters on the dashboard and property detail pages instead of a global year selector,
so that I can see financial data for any time period and filters don't silently conflict with each other.

**GitHub Issue:** #279
**Effort:** L — multi-page refactor, backend dateFrom/dateTo params, frontend component integration, service + component removal

## Acceptance Criteria

**AC-1: Year selector removed from sidebar**
Given I view the application sidebar
When the sidebar renders
Then the year selector is no longer present

**AC-2: Dashboard date range filter**
Given I am on the Dashboard
When I view the page
Then I see an inline `DateRangeFilterComponent` with presets: All Time, This Month, This Quarter, This Year (default), Last Year, Custom
And the summary totals (Total Expenses, Total Income, Net Income) respect the selected range

**AC-3: Property detail date range filter**
Given I am on a Property detail page
When I view the financial summary cards
Then a local `DateRangeFilterComponent` controls Expenses, Income, Net Income totals
And labels update based on range (e.g., "YTD Expenses" for this-year, "Expenses" for custom/other ranges)

**AC-4: Properties list date range filter**
Given I am on the Properties list
When I view per-property financial summaries
Then they respect a local date range filter (default: This Year)

**AC-5: Income list decoupled from global year**
Given I am on the Income list with its own date range filter
When I select a date range
Then only the local date range filter applies — no global year interference
And the `yearEffect` watching `YearSelectorService` is removed

**AC-6: Report dialogs unaffected**
Given I open a Schedule E report dialog (single or batch)
When the dialog loads
Then it still has its own year selector and works independently (no regression)
And it defaults to the current calendar year (previously from YearSelectorService)

**AC-7: Cleanup**
Given all consumers are migrated
When migration is complete
Then `YearSelectorService`, `YearSelectorComponent`, and localStorage key `propertyManager.selectedYear` are removed
And no references remain anywhere in the codebase

## Tasks / Subtasks

### Task 1: Add "Last Year" preset to DateRangeFilterComponent (AC: 2)

- [ ] 1.1: Add `'last-year'` to the `DateRangePreset` union type in `frontend/src/app/shared/utils/date-range.utils.ts`
- [ ] 1.2: Add `case 'last-year'` to `getDateRangeFromPreset()` — return Jan 1 to Dec 31 of `currentYear - 1`
- [ ] 1.3: Add `<mat-option value="last-year">Last Year</mat-option>` to `DateRangeFilterComponent` template (between "This Year" and "Custom Range")
- [ ] 1.4: Add unit tests for the new preset in `date-range.utils.spec.ts` (if exists) and `date-range-filter.component.spec.ts`

### Task 2: Backend — Add dateFrom/dateTo to property and dashboard endpoints (AC: 2, 3, 4)

- [ ] 2.1: Update `GetAllPropertiesQuery` record to add `DateOnly? DateFrom = null, DateOnly? DateTo = null` parameters
- [ ] 2.2: Update `GetAllPropertiesQueryHandler.Handle()` — when `DateFrom`/`DateTo` are provided, use them for date range filtering instead of `year`. Keep existing `Year` fallback for backward compat
- [ ] 2.3: Update `GetPropertyByIdQuery` record to add `DateOnly? DateFrom = null, DateOnly? DateTo = null` parameters
- [ ] 2.4: Update `GetPropertyByIdQueryHandler.Handle()` — when `DateFrom`/`DateTo` are provided, use `request.DateFrom`/`request.DateTo` instead of computing `yearStart`/`yearEnd` from year
- [ ] 2.5: Update `GetDashboardTotalsQuery` record to add `DateOnly? DateFrom = null, DateOnly? DateTo = null` parameters (keep `Year` for backward compat)
- [ ] 2.6: Update `GetDashboardTotalsQueryHandler.Handle()` — when `DateFrom`/`DateTo` are provided, use them; otherwise fall back to existing `Year`-based filtering
- [ ] 2.7: Update `PropertiesController.GetAllProperties()` — add `[FromQuery] DateOnly? dateFrom = null, [FromQuery] DateOnly? dateTo = null` params, pass to query
- [ ] 2.8: Update `PropertiesController.GetPropertyById()` (read the method — it has a `[FromQuery] int? year` param) — add `dateFrom`/`dateTo` params, pass to query
- [ ] 2.9: Update `DashboardController.GetTotals()` — add `dateFrom`/`dateTo` params, pass to query. Change `year` from required to optional (default to current year when nothing is provided)
- [ ] 2.10: Add backend unit tests for dateFrom/dateTo filtering in all three handlers
- [ ] 2.11: Regenerate NSwag API client: run `npm run generate-api` from `/frontend`

### Task 3: Frontend — Update PropertyService and PropertyStore for date range (AC: 2, 3, 4)

- [ ] 3.1: Update `PropertyService.getProperties()` signature to accept `params?: { year?: number; dateFrom?: string; dateTo?: string }` instead of `year?: number`. Build query params from the object
- [ ] 3.2: Update `PropertyService.getPropertyById()` signature to accept `id: string, params?: { year?: number; dateFrom?: string; dateTo?: string }` instead of `id: string, year?: number`
- [ ] 3.3: Update `PropertyStore.loadProperties` rxMethod — change input type from `number | undefined` to `{ dateFrom?: string; dateTo?: string } | undefined`. Update `switchMap` to call `propertyService.getProperties(params)`
- [ ] 3.4: Update `PropertyStore.loadPropertyById` rxMethod — change input type from `{ id: string; year?: number }` to `{ id: string; dateFrom?: string; dateTo?: string }`. Update `switchMap` accordingly
- [ ] 3.5: Replace `selectedYear: number | null` in `PropertyState` with `dateFrom: string | null` and `dateTo: string | null`. Update `initialState` accordingly
- [ ] 3.6: Update property store unit tests for new parameter shapes

### Task 4: Dashboard — Add DateRangeFilterComponent, remove year dependency (AC: 2)

- [ ] 4.1: Import `DateRangeFilterComponent` in DashboardComponent imports array
- [ ] 4.2: Add date range state signals: `dateRangePreset = signal<DateRangePreset>('this-year')`, `dateFrom = signal<string | null>(null)`, `dateTo = signal<string | null>(null)`. Compute initial values from `getDateRangeFromPreset('this-year')`
- [ ] 4.3: Add `<app-date-range-filter>` to dashboard template — place between the header and the `<app-stats-bar>`, inside a `<mat-card class="filters-card">` wrapper for visual consistency with other pages
- [ ] 4.4: Add `onDateRangePresetChange()` and `onCustomDateRangeChange()` handler methods — update signals, recalculate dateFrom/dateTo via `getDateRangeFromPreset()`, call `loadProperties()`
- [ ] 4.5: Replace the existing `effect()` (lines 192-195) that watches `yearService.selectedYear()` with a new `effect()` that watches `dateFrom()`/`dateTo()` and calls `propertyStore.loadProperties({ dateFrom, dateTo })`
- [ ] 4.6: Remove `YearSelectorService` import and injection
- [ ] 4.7: Update `loadProperties()` method to use date range signals instead of `yearService.selectedYear()`
- [ ] 4.8: Import `getDateRangeFromPreset`, `DateRangePreset` from shared utils
- [ ] 4.9: Add dashboard component unit tests for date range filter integration

### Task 5: Properties list — Add DateRangeFilterComponent (AC: 4)

- [ ] 5.1: Import `DateRangeFilterComponent` and `MatCardModule` in PropertiesComponent imports
- [ ] 5.2: Add date range state signals (same pattern as Task 4.2, default `'this-year'`)
- [ ] 5.3: Add `<app-date-range-filter>` to properties template — place below the page header, inside a `<mat-card class="filters-card">`
- [ ] 5.4: Add `onDateRangePresetChange()` and `onCustomDateRangeChange()` handler methods
- [ ] 5.5: Replace the existing `effect()` (lines 162-165) that watches `yearService.selectedYear()` with date range effect
- [ ] 5.6: Remove `YearSelectorService` import and injection
- [ ] 5.7: Update `loadProperties()` method to use date range signals
- [ ] 5.8: Add properties component unit tests for date range filter integration

### Task 6: Property detail — Add DateRangeFilterComponent (AC: 3)

- [ ] 6.1: Import `DateRangeFilterComponent` and `MatCardModule` in PropertyDetailComponent imports
- [ ] 6.2: Add date range state signals (same pattern, default `'this-year'`)
- [ ] 6.3: Add `<app-date-range-filter>` to template — place above the `.stats-section` (before line 177), inside a compact filter card
- [ ] 6.4: Add handler methods for preset and custom date range changes
- [ ] 6.5: Replace the existing `effect()` (lines 676-681) that watches `yearService.selectedYear()` with date range effect that calls `propertyStore.loadPropertyById({ id: this.propertyId, dateFrom, dateTo })`
- [ ] 6.6: Update stat card labels to be dynamic: use `'YTD Expenses'` when preset is `'this-year'`, otherwise `'Expenses'` (same for Income). Use a computed signal: `expenseLabel = computed(() => this.dateRangePreset() === 'this-year' ? 'YTD Expenses' : 'Expenses')`
- [ ] 6.7: Remove `YearSelectorService` import and injection
- [ ] 6.8: Update the `ReportDialogComponent` data passing (if property-detail passes `currentYear: this.yearService.selectedYear()` to it) — replace with `currentYear: new Date().getFullYear()`
- [ ] 6.9: Add property detail unit tests for date range filter integration and dynamic labels

### Task 7: Income — Decouple from global year selector (AC: 5)

- [ ] 7.1: Remove the `yearEffect` field (lines 496-499) from `IncomeComponent`
- [ ] 7.2: Remove `YearSelectorService` import and injection (line 28, 481)
- [ ] 7.3: Remove `year` state from `IncomeListStore` — remove `year: number | null` from state interface, remove from initialState, remove `setYear()` method
- [ ] 7.4: Update `IncomeListStore.currentFilters` computed — remove `year: store.year() ?? undefined` from the returned object. When preset is not custom, `getDateRangeFromPreset()` no longer needs a year param since the function uses `today.getFullYear()` by default
- [ ] 7.5: Update `IncomeListStore.setDateRangePreset()` — remove `store.year()` from `getDateRangeFromPreset()` call (just pass preset)
- [ ] 7.6: Update income component and store unit tests — remove YearSelectorService mocking, remove year-related test cases

### Task 8: Report dialogs — Decouple from YearSelectorService (AC: 6)

- [ ] 8.1: In `BatchReportDialogComponent` — change `selectedYear = this.yearService.selectedYear()` to `selectedYear = new Date().getFullYear()`. Remove `YearSelectorService` import and injection
- [ ] 8.2: Verify batch report dialog still has its own year dropdown with `generateYearOptions()` — no changes needed to that
- [ ] 8.3: Check `ReportDialogComponent` (single property report) — if it injects `YearSelectorService`, decouple it the same way. If it receives year via dialog data from property-detail, Task 6.8 already handles it
- [ ] 8.4: Update report dialog unit tests — remove YearSelectorService mocking

### Task 9: Cleanup — Remove YearSelectorService and YearSelectorComponent (AC: 1, 7)

- [ ] 9.1: Remove `<app-year-selector />` from `sidebar-nav.component.html` (lines 7-10, the `.year-selector-container` div)
- [ ] 9.2: Remove `<app-year-selector class="light-theme" />` from `shell.component.html` tablet header (line 31)
- [ ] 9.3: Remove `<app-year-selector />` from `shell.component.html` mobile header (line 55)
- [ ] 9.4: Remove `YearSelectorComponent` from `SidebarNavComponent` imports array
- [ ] 9.5: Remove `YearSelectorComponent` from `ShellComponent` imports array and its import statement
- [ ] 9.6: Delete file: `frontend/src/app/core/services/year-selector.service.ts`
- [ ] 9.7: Delete file: `frontend/src/app/core/services/year-selector.service.spec.ts`
- [ ] 9.8: Delete file: `frontend/src/app/shared/components/year-selector/year-selector.component.ts`
- [ ] 9.9: Delete file: `frontend/src/app/shared/components/year-selector/year-selector.component.spec.ts`
- [ ] 9.10: Verify no remaining references — search codebase for `YearSelectorService`, `YearSelectorComponent`, `year-selector`, `propertyManager.selectedYear`
- [ ] 9.11: Remove any sidebar SCSS for `.year-selector-container` if present in sidebar component styles

### Task 10: Final validation (AC: all)

- [ ] 10.1: Run all frontend unit tests: `npm test` from `/frontend` — expect zero regressions
- [ ] 10.2: Run all backend unit tests: `dotnet test` from `/backend`
- [ ] 10.3: Manual smoke test: dashboard loads with "This Year" default, changing filter updates totals
- [ ] 10.4: Manual smoke test: properties list loads with date range filter, per-property totals update
- [ ] 10.5: Manual smoke test: property detail shows date range filter, stat cards update, labels change for non-YTD ranges
- [ ] 10.6: Manual smoke test: income list works without global year interference
- [ ] 10.7: Manual smoke test: batch report dialog opens, defaults to current year, generates correctly
- [ ] 10.8: Manual smoke test: sidebar has no year selector on desktop, tablet, and mobile

## Dev Notes

### Architecture Overview

This story replaces a **global year selector** (sidebar widget → singleton service → effects in 4 components) with **local date range filters** per page. The existing `DateRangeFilterComponent` is already used by Expenses and Income lists — this story reuses it on Dashboard, Properties list, and Property detail.

**Current data flow (REMOVE):**
```
YearSelectorComponent (sidebar/toolbar)
  → YearSelectorService (singleton, localStorage)
    → effect() in DashboardComponent → propertyStore.loadProperties(year)
    → effect() in PropertiesComponent → propertyStore.loadProperties(year)
    → effect() in PropertyDetailComponent → propertyStore.loadPropertyById({id, year})
    → effect() in IncomeComponent → incomeStore.setYear(year)
    → BatchReportDialogComponent → initializes selectedYear from service
```

**New data flow (ADD):**
```
DateRangeFilterComponent (per page, local state)
  → Page component state (dateRangePreset, dateFrom, dateTo signals)
    → effect() → propertyStore.loadProperties({ dateFrom, dateTo })
    → effect() → propertyStore.loadPropertyById({ id, dateFrom, dateTo })
```

### Existing DateRangeFilterComponent — Ready for Reuse

**File:** `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.ts`

Standalone presentation component. No state — receives values via inputs, emits via outputs:
```typescript
// Inputs
dateRangePreset = input<DateRangePreset>('all');
dateFrom = input<string | null>(null);
dateTo = input<string | null>(null);

// Outputs
dateRangePresetChange = output<DateRangePreset>();
customDateRangeChange = output<{ dateFrom: string; dateTo: string }>();
```

**Current presets:** `'all' | 'this-month' | 'this-quarter' | 'this-year' | 'custom'`
**New preset to add:** `'last-year'`

Utility function: `getDateRangeFromPreset(preset, year?)` in `shared/utils/date-range.utils.ts` — computes `{ dateFrom, dateTo }` strings from presets.

### Backend Changes — dateFrom/dateTo Parameters

All three backend handlers already use `DateOnly` internally for year-based filtering. Adding `dateFrom`/`dateTo` query params is straightforward.

**Pattern (existing in GetPropertyByIdQueryHandler):**
```csharp
var yearStart = new DateOnly(year, 1, 1);
var yearEnd = new DateOnly(year, 12, 31);
```

**New pattern:**
```csharp
var dateStart = request.DateFrom ?? new DateOnly(year, 1, 1);
var dateEnd = request.DateTo ?? new DateOnly(year, 12, 31);
```

When `DateFrom`/`DateTo` are provided, use them directly. When absent, fall back to year (existing behavior). This ensures backward compatibility for any direct API consumers.

**GetAllPropertiesQueryHandler** uses `e.Date.Year == year` instead of date range — change to `e.Date >= dateStart && e.Date <= dateEnd` for consistency with the other handlers.

**DashboardController.GetTotals** currently requires `year` — make it optional with fallback to `DateTime.UtcNow.Year`.

ASP.NET Core binds `DateOnly` from query strings natively (format: `YYYY-MM-DD`). No custom model binder needed.

### Frontend PropertyService — Updated Signatures

**Current:**
```typescript
getProperties(year?: number): Observable<GetAllPropertiesResponse>
getPropertyById(id: string, year?: number): Observable<PropertyDetailDto>
```

**New:**
```typescript
getProperties(params?: { year?: number; dateFrom?: string; dateTo?: string }): Observable<GetAllPropertiesResponse>
getPropertyById(id: string, params?: { year?: number; dateFrom?: string; dateTo?: string }): Observable<PropertyDetailDto>
```

Build HttpParams from the object — only include keys that have values.

### Frontend PropertyStore — Updated rxMethod Signatures

**Current:**
```typescript
loadProperties: rxMethod<number | undefined>(...)
loadPropertyById: rxMethod<{ id: string; year?: number }>(...)
```

**New:**
```typescript
loadProperties: rxMethod<{ dateFrom?: string; dateTo?: string } | undefined>(...)
loadPropertyById: rxMethod<{ id: string; dateFrom?: string; dateTo?: string }>(...)
```

Replace `selectedYear: number | null` in PropertyState with `dateFrom: string | null; dateTo: string | null`.

### Dashboard Integration Pattern

Follow Income component's pattern for DateRangeFilterComponent integration. Key difference: dashboard defaults to `'this-year'` preset instead of `'all'`.

```typescript
// State
dateRangePreset = signal<DateRangePreset>('this-year');
dateFrom = signal<string | null>(null);
dateTo = signal<string | null>(null);

constructor() {
  // Initialize date range from default preset
  const initial = getDateRangeFromPreset('this-year');
  this.dateFrom.set(initial.dateFrom);
  this.dateTo.set(initial.dateTo);

  // React to date range changes
  effect(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    this.propertyStore.loadProperties({ dateFrom: from ?? undefined, dateTo: to ?? undefined });
  });
}

onDateRangePresetChange(preset: DateRangePreset): void {
  this.dateRangePreset.set(preset);
  const { dateFrom, dateTo } = getDateRangeFromPreset(preset);
  this.dateFrom.set(dateFrom);
  this.dateTo.set(dateTo);
}

onCustomDateRangeChange(range: { dateFrom: string; dateTo: string }): void {
  this.dateRangePreset.set('custom');
  this.dateFrom.set(range.dateFrom);
  this.dateTo.set(range.dateTo);
}
```

### Property Detail — Dynamic Stat Labels

Current hardcoded labels: `"YTD Expenses"`, `"YTD Income"`, `"Net Income"`.

Replace with computed signals:
```typescript
expenseLabel = computed(() => this.dateRangePreset() === 'this-year' ? 'YTD Expenses' : 'Expenses');
incomeLabel = computed(() => this.dateRangePreset() === 'this-year' ? 'YTD Income' : 'Income');
```

### Income Store — Year Removal

The `IncomeListStore` has a `year: number | null` state field that is set by the `yearEffect` in `IncomeComponent`. After removing the year effect:
- Remove `year` from state interface and initial state
- Remove `setYear()` method
- In `currentFilters` computed, call `getDateRangeFromPreset(store.dateRangePreset())` without passing year — the function already uses `today.getFullYear()` as default
- In `setDateRangePreset()`, call `getDateRangeFromPreset(preset)` without year

### Report Dialogs — Minimal Changes

`BatchReportDialogComponent` (line 270): `selectedYear = this.yearService.selectedYear()` → `selectedYear = new Date().getFullYear()`. It already has its own year dropdown via `generateYearOptions()`.

Check `ReportDialogComponent` — if it receives year via `@Inject(MAT_DIALOG_DATA)` from property-detail, update the caller (Task 6.8) to pass `new Date().getFullYear()`.

### Execution Order

Tasks should be executed in order (1→2→3→4→5→6→7→8→9→10) since:
- Task 1 (preset) is needed by Tasks 4-6
- Task 2 (backend) is needed by Task 3
- Task 3 (store/service) is needed by Tasks 4-6
- Tasks 4-8 can be done in any order
- Task 9 (cleanup) must be last before validation

### Files to Modify

**Frontend (modify):**
- `frontend/src/app/shared/utils/date-range.utils.ts` — add `'last-year'` preset
- `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.ts` — add mat-option
- `frontend/src/app/features/properties/services/property.service.ts` — update method signatures
- `frontend/src/app/features/properties/stores/property.store.ts` — update rxMethod types, state
- `frontend/src/app/features/dashboard/dashboard.component.ts` — add filter, remove year service
- `frontend/src/app/features/properties/properties.component.ts` — add filter, remove year service
- `frontend/src/app/features/properties/property-detail/property-detail.component.ts` — add filter, dynamic labels
- `frontend/src/app/features/income/income.component.ts` — remove yearEffect, year service
- `frontend/src/app/features/income/stores/income-list.store.ts` — remove year state
- `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.ts` — decouple
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.html` — remove year selector
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` — remove import
- `frontend/src/app/core/components/shell/shell.component.html` — remove year selector (2 instances)
- `frontend/src/app/core/components/shell/shell.component.ts` — remove import

**Frontend (delete):**
- `frontend/src/app/core/services/year-selector.service.ts`
- `frontend/src/app/core/services/year-selector.service.spec.ts`
- `frontend/src/app/shared/components/year-selector/year-selector.component.ts`
- `frontend/src/app/shared/components/year-selector/year-selector.component.spec.ts`

**Frontend test files (modify):**
- `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts` — add last-year test
- `frontend/src/app/features/dashboard/dashboard.component.spec.ts` — remove year service mock, add filter tests
- `frontend/src/app/features/properties/properties.component.spec.ts` — same
- `frontend/src/app/features/properties/property-detail/property-detail.component.spec.ts` — same
- `frontend/src/app/features/income/income.component.spec.ts` — remove year service mock
- `frontend/src/app/features/income/stores/income-list.store.spec.ts` — remove year tests
- `frontend/src/app/features/properties/stores/property.store.spec.ts` — update for new param types
- `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.spec.ts` — remove year service mock

**Backend (modify):**
- `backend/src/PropertyManager.Application/Properties/GetAllProperties.cs` — add DateFrom/DateTo to query + handler
- `backend/src/PropertyManager.Application/Properties/GetPropertyById.cs` — add DateFrom/DateTo to query + handler
- `backend/src/PropertyManager.Application/Dashboard/GetDashboardTotals.cs` — add DateFrom/DateTo, make Year optional
- `backend/src/PropertyManager.Api/Controllers/PropertiesController.cs` — add query params
- `backend/src/PropertyManager.Api/Controllers/DashboardController.cs` — add query params, make year optional

**Backend test files (modify/create):**
- `backend/tests/PropertyManager.Application.Tests/Properties/GetAllPropertiesHandlerTests.cs` — add dateFrom/dateTo tests
- `backend/tests/PropertyManager.Application.Tests/Properties/GetPropertyByIdHandlerTests.cs` — add dateFrom/dateTo tests
- `backend/tests/PropertyManager.Application.Tests/Dashboard/GetDashboardTotalsHandlerTests.cs` — add dateFrom/dateTo tests

### Project Structure Notes

- Aligned with Clean Architecture: backend query changes in Application layer, controller param changes in Api layer
- Frontend follows feature-based structure: stores, services, components all within their feature folders
- Shared DateRangeFilterComponent stays in `shared/components/` — no new shared components needed
- No new files created (except possibly test files if they don't exist)

### References

- [Source: `frontend/src/app/core/services/year-selector.service.ts` — full YearSelectorService implementation to be removed]
- [Source: `frontend/src/app/shared/components/year-selector/year-selector.component.ts` — full YearSelectorComponent to be removed]
- [Source: `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.ts` — reusable DateRangeFilterComponent with inputs/outputs]
- [Source: `frontend/src/app/shared/utils/date-range.utils.ts` — DateRangePreset type and getDateRangeFromPreset utility]
- [Source: `frontend/src/app/features/dashboard/dashboard.component.ts` — lines 186-195 (yearService injection, effect)]
- [Source: `frontend/src/app/features/properties/properties.component.ts` — lines 157-165 (yearService injection, effect)]
- [Source: `frontend/src/app/features/properties/property-detail/property-detail.component.ts` — lines 647, 674-681 (yearService injection, effect)]
- [Source: `frontend/src/app/features/income/income.component.ts` — lines 481, 496-499 (yearService, yearEffect)]
- [Source: `frontend/src/app/features/income/stores/income-list.store.ts` — lines 45, 155-166, 248-251 (year state, currentFilters, setYear)]
- [Source: `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.ts` — line 266, 270 (yearService injection, selectedYear init)]
- [Source: `frontend/src/app/features/properties/stores/property.store.ts` — lines 27, 140-168, 195-226 (selectedYear state, loadProperties, loadPropertyById)]
- [Source: `frontend/src/app/features/properties/services/property.service.ts` — lines 78-91 (getProperties, getPropertyById with year param)]
- [Source: `frontend/src/app/core/components/shell/shell.component.html` — lines 31, 55 (year selector in tablet/mobile headers)]
- [Source: `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.html` — lines 7-10 (year selector in sidebar)]
- [Source: `backend/src/PropertyManager.Application/Properties/GetAllProperties.cs` — line 11 (Year param), line 76 (e.Date.Year == year filtering)]
- [Source: `backend/src/PropertyManager.Application/Properties/GetPropertyById.cs` — lines 13, 78-80 (Year param, yearStart/yearEnd)]
- [Source: `backend/src/PropertyManager.Application/Dashboard/GetDashboardTotals.cs` — lines 11, 42-43 (Year param, yearStart/yearEnd)]
- [Source: `backend/src/PropertyManager.Api/Controllers/PropertiesController.cs` — line 47 (year query param)]
- [Source: `backend/src/PropertyManager.Api/Controllers/DashboardController.cs` — line 40 (year query param, required)]
- [Source: project-context.md — Clean Architecture patterns, Angular signals patterns, testing rules]
- [Source: GitHub Issue #279 — Replace global year selector with date range filter]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
