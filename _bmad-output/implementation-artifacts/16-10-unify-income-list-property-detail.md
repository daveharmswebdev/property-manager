# Story 16.10: Unify Income List in Property Detail

Status: review

## Story

As a **property owner viewing income for a specific property**,
I want **the property detail income list to use the same table format as the main income page**,
So that **the experience is consistent and I have full edit/delete capability from both views**.

**GitHub Issue:** #240
**Prerequisite:** Story 16.2 (done)
**Effort:** Small

## Acceptance Criteria

### AC1 — Table format with column headers

**Given** I am on `/properties/:id` viewing the income section
**When** the income list renders
**Then** it uses a table with column headers: Date, Source, Description, Amount, Actions
**And** the Property column is omitted (context is already single-property)

### AC2 — Edit and delete actions per row

**Given** I am viewing the property detail income table
**When** I look at a row
**Then** I see edit (pencil) and delete (trash) action icons matching the main income page pattern
**And** clicking edit navigates to `/income/:id`
**And** clicking delete shows a confirmation dialog, then soft-deletes the entry and refreshes

### AC3 — Consistent styling

**Given** I compare the property detail income table with the main income table
**When** I view both
**Then** styling, spacing, and interaction patterns are consistent (same grid layout, hover effects, icon placement, responsive behavior)

## Tasks / Subtasks

### Task 1: Create PropertyIncomeComponent (AC: #1, #2, #3)

> **Why:** Replace the card-style "Recent Income" in property detail with a proper table component. Follow the `PropertyWorkOrdersComponent` standalone pattern — own data fetching, loading/error/empty states, table rendering.

**New file:** `frontend/src/app/features/properties/components/property-income/property-income.component.ts`

- [x] 1.1 Create `PropertyIncomeComponent` as a standalone component with:
  - **Inputs:** `propertyId = input.required<string>()`
  - **Outputs:** `addClick = output()` (emits when "Add Income" is clicked)
  - **Injected:** `IncomeService`, `Router`, `MatDialog`, `MatSnackBar`, `DestroyRef`
  - **Local signals:** `isLoading`, `error`, `incomeEntries: IncomeDto[]`, `totalCount`, `ytdTotal`
  - **Lifecycle:** `OnInit` → call `loadIncome()`
  - **`loadIncome()` method:**
    - Set `isLoading(true)`, clear error
    - Call `incomeService.getIncomeByProperty(propertyId())`
    - On success: set `incomeEntries`, `totalCount`, `ytdTotal`, `isLoading(false)`
    - On error: set `error('Failed to load income')`, `isLoading(false)`
    - Use `takeUntilDestroyed(destroyRef)`
  - **Module imports:** `CommonModule`, `CurrencyPipe`, `RouterLink`, `MatCardModule`, `MatIconModule`, `MatButtonModule`, `MatProgressSpinnerModule`, `MatTooltipModule`, `MatDialogModule`

- [x] 1.2 **Template** — Follow `PropertyWorkOrdersComponent` card pattern:
  - **Card header:** mat-icon `payments` + title "Income" + count `({{ totalCount() }})` + "Add Income" stroked button emitting `addClick`
  - **Loading state:** Centered `mat-spinner` (diameter 32)
  - **Error state:** Icon + message + retry button calling `loadIncome()`
  - **Empty state:** Icon `payments` + "No income recorded yet" + "Add your first income entry" text
  - **Table (when data exists):**
    ```
    Header: Date | Source | Description | Amount | Actions
    Grid:   100px  1fr     1fr          120px    80px
    ```
    - Each row: `(click)="navigateToDetail(income)"` with cursor pointer + hover
    - Date: `formatDateShort(income.date)` — import from `shared/utils/date.utils`
    - Source: `income.source || '—'`
    - Description: `income.description || '—'`
    - Amount: `income.amount | currency` (right-aligned, primary color, bold)
    - Actions (stopPropagation):
      - Edit icon button → `navigateToDetail(income)`
      - Delete icon button (warn) → `onDeleteIncome(income)`
  - **"View all income" link** when `totalCount() > 5`: navigates to `/income` (optionally filtered by property)

- [x] 1.3 **Component methods:**
  - `navigateToDetail(income: IncomeDto)` → `router.navigate(['/income', income.id])`
  - `onDeleteIncome(income: IncomeDto)`:
    - Open `ConfirmDialogComponent` with title "Delete Income?", message showing amount and date
    - On confirm → `incomeService.deleteIncome(income.id)` → snackbar "Income deleted" → `loadIncome()`
  - `formatDate(date: string)` → delegate to `formatDateShort(date)`

- [x] 1.4 **Styles** — Match the main income list table styles from `income.component.ts`:
  - Same grid template (adapted: 5 columns without Property)
  - Same `.list-header` background/border/font styling
  - Same `.income-row` hover, cursor, border
  - Same `.cell-amount` right-align + primary color + font-weight: 600
  - Same `.cell-source`, `.cell-description` text-overflow: ellipsis
  - **Mobile responsive** (`@media max-width: 768px`): hide header, rows become flex column cards (same as income.component.ts)
  - Reuse `.activity-card` styling from `PropertyWorkOrdersComponent` for card wrapper

- [x] 1.5 **Unit test:** `frontend/src/app/features/properties/components/property-income/property-income.component.spec.ts`
  - Test component creates
  - Test `loadIncome()` called on init with propertyId
  - Test loading state renders spinner
  - Test error state renders error message and retry button
  - Test empty state renders when no income
  - Test table renders with correct columns when data exists
  - Test row click calls `navigateToDetail`
  - Test delete icon opens confirm dialog
  - Test confirm delete calls `deleteIncome` and refreshes list
  - Test "Add Income" button emits `addClick`

### Task 2: Replace "Recent Income" in PropertyDetailComponent (AC: #1, #3)

> **Why:** Swap the existing card-style `Recent Income` section (lines 290-314 of `property-detail.component.ts`) with the new `PropertyIncomeComponent`.

**File:** `frontend/src/app/features/properties/property-detail/property-detail.component.ts`

- [x] 2.1 **Add import** for `PropertyIncomeComponent` to the component's `imports` array
- [x] 2.2 **Replace the "Recent Income" mat-card** (the entire block from `<!-- Recent Income -->` through the closing `</mat-card>`) with:
  ```html
  <!-- Income Section (Story 16-10) -->
  <app-property-income
    [propertyId]="propertyStore.selectedProperty()!.id"
    (addClick)="onAddIncome()"
  />
  ```
- [x] 2.3 **Add `onAddIncome()` method** to PropertyDetailComponent:
  - Navigate to the property's income workspace: `router.navigate(['/properties', propertyId, 'income'])`
  - (The property-scoped income workspace already exists from Epic 4)
- [x] 2.4 **Also replace "Recent Expenses" section** with similar pattern for consistency (SKIP — out of scope for this story. Document as follow-up if desired.)
- [x] 2.5 **Update `property-detail.component.spec.ts`** if existing tests reference the old "Recent Income" section:
  - Update any selectors or assertions that tested the old `.activity-item` income rendering
  - Add basic test: `PropertyIncomeComponent` is rendered with correct propertyId binding

### Task 3: Run all tests (AC: all)

- [x] 3.1 `npm test` from `/frontend` — all existing + new tests pass (NEVER use `npx vitest`)
- [x] 3.2 Verify no TypeScript compilation errors
- [x] 3.3 Visual smoke test: navigate to `/properties/:id`, verify income table renders with correct columns, edit/delete icons work, styling matches `/income` page

## Dev Notes

### Architecture Compliance

- **Standalone component pattern:** Follow `PropertyWorkOrdersComponent` exactly — standalone component with `input.required()`, `output()`, own data fetching via service, local signals for state
- **No repository pattern:** Frontend services call API directly via `HttpClient`
- **Feature-based folder structure:** New component lives in `features/properties/components/property-income/` (it's a property-detail sub-component, not an income feature component)
- **State management:** Use local component signals (not a store) — this is a simple read-only view with delete capability, same pattern as `PropertyWorkOrdersComponent`

### Critical Patterns to Follow

| Pattern | Reference File | What to copy |
|---------|---------------|--------------|
| Property detail sub-component | `features/properties/components/property-work-orders/property-work-orders.component.ts` | Component structure, input/output, loading/error/empty states, card layout, "View All" link |
| Income table grid layout | `features/income/income.component.ts:329-394` | CSS Grid columns, header styling, row hover, cell styling, responsive breakpoint |
| Delete with confirm dialog | `features/income/income.component.ts` `onDeleteIncome()` method | ConfirmDialogComponent usage, snackbar feedback, list refresh |
| Date formatting | `shared/utils/date.utils.ts` `formatDateShort()` | Consistent date display |
| Confirm dialog | `shared/components/confirm-dialog/confirm-dialog.component.ts` | `ConfirmDialogData` interface |

### What's Already Working (Don't Rebuild)

- `IncomeService.getIncomeByProperty(propertyId, year?)` — returns `{ items: IncomeDto[], totalCount, ytdTotal }`
- `IncomeService.deleteIncome(id)` — soft delete endpoint
- `IncomeDto` — has all fields needed: id, propertyId, propertyName, amount, date, source, description, createdAt
- `ConfirmDialogComponent` — exists in `shared/components/confirm-dialog/`
- `formatDateShort()` — exists in `shared/utils/date.utils.ts`
- `/income/:id` route — detail page already built in Story 16-2
- Income workspace at `/properties/:id/income` — built in Epic 4

### Data Differences: IncomeSummaryDto vs IncomeDto

The current property detail embeds `IncomeSummaryDto` from the `GetPropertyById` query — this DTO only has `Id, Description, Amount, Date` (no `Source` field). The new component will NOT use this embedded data. Instead, it fetches independently via `IncomeService.getIncomeByProperty()` which returns full `IncomeDto` with all fields including `Source`. This is the same approach used by `PropertyWorkOrdersComponent` (fetches its own data, doesn't rely on the property detail response).

### Existing "Recent Expenses" Section

The "Recent Expenses" section in property detail uses the same card-style pattern as income. This story ONLY unifies income. A follow-up story could do the same for expenses if desired. Do NOT modify the expenses section as part of this story.

### Grid Column Layout

Main income page uses 6 columns: `100px 180px 1fr 1fr 120px 80px` (Date, Property, Source, Description, Amount, Actions).
Property detail version uses 5 columns (no Property): `100px 1fr 1fr 120px 80px` (Date, Source, Description, Amount, Actions).

### Project Structure Notes

**New files:**
```
frontend/src/app/features/properties/components/property-income/
├── property-income.component.ts       # NEW
└── property-income.component.spec.ts  # NEW
```

**Modified files:**
```
frontend/src/app/features/properties/property-detail/property-detail.component.ts  # Replace income section
frontend/src/app/features/properties/property-detail/property-detail.component.spec.ts  # Update tests
```

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- `property-income.component.spec.ts` — new component tests (loading, error, empty, data rendering, navigation, delete)
- `property-detail.component.spec.ts` — updated to reflect new `PropertyIncomeComponent` usage

### Previous Story Intelligence (16-2, 16-6)

Story 16-2 established:
- Income detail page at `/income/:id` with view/edit/delete — the edit icon in our new table should navigate here
- Delete pattern: `ConfirmDialogComponent` → `incomeService.deleteIncome()` → snackbar → refresh
- `IncomeDto` shape with all needed fields

Story 16-6 established:
- `DateRangeFilterComponent` and `ListTotalDisplayComponent` as shared components
- These are used on the main income list page but are NOT needed for the property detail income section (no filtering needed in property context)

### References

- [GitHub Issue #240](https://github.com/daveharmswebdev/property-manager/issues/240) — Unify income list in property detail
- [Source: `features/properties/components/property-work-orders/property-work-orders.component.ts` — Sub-component pattern]
- [Source: `features/income/income.component.ts:172-203` — Income table grid + rows]
- [Source: `features/income/income.component.ts:329-394` — Table CSS Grid styling]
- [Source: `features/income/services/income.service.ts:135-141` — `getIncomeByProperty()` API]
- [Source: `features/properties/property-detail/property-detail.component.ts:290-314` — Current "Recent Income" section to replace]
- [Source: `shared/utils/date.utils.ts` — `formatDateShort()` for date display]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no major debugging required.

### Completion Notes List

- All 3 tasks completed with all subtasks checked off
- PropertyIncomeComponent follows PropertyWorkOrdersComponent standalone pattern exactly
- Income table uses 5-column CSS Grid (Date, Source, Description, Amount, Actions) — Property column omitted since context is single-property
- Delete flow uses ConfirmDialogComponent → IncomeService.deleteIncome → snackbar → refresh
- MatDialog testing required accessing component's private dialog instance via `(component as any)['dialog']` due to standalone component injector hierarchy
- Full test suite: 108 files, 2525 tests — ALL passing
- TypeScript build: zero errors
- Visual smoke test: confirmed rendering via Playwright — empty state, table with data, edit/delete icons all working

### File List

**New files:**
- `frontend/src/app/features/properties/components/property-income/property-income.component.ts`
- `frontend/src/app/features/properties/components/property-income/property-income.component.spec.ts`

**Modified files:**
- `frontend/src/app/features/properties/property-detail/property-detail.component.ts`
- `frontend/src/app/features/properties/property-detail/property-detail.component.spec.ts`
