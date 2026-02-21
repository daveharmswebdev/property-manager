# Story 16.1: Fix Date UTC Offset Bug

Status: done

## Story

As a **property owner recording income and expenses**,
I want **dates to be saved and displayed exactly as I enter them**,
So that **my financial records are accurate for tax reporting**.

**GitHub Issue:** #217
**Prerequisite:** None
**Effort:** Small

## Root Cause Analysis

The bug has **two surfaces**:

1. **Serialization bug** — Several components use `date.toISOString().split('T')[0]` to format dates for API calls. `toISOString()` converts to UTC, so a user in UTC-5 picking Nov 1 (midnight local) gets `"2025-10-31T05:00:00.000Z"` → `"2025-10-31"`. Wrong date sent to backend.

2. **Display bug** — Several components use `new Date(dateString)` to parse date-only strings from the API. Per the JS spec, `new Date("2025-11-01")` is interpreted as UTC midnight. In UTC-5, `toLocaleDateString()` then renders "Oct 31, 2025". Wrong date displayed.

**Existing correct patterns already exist in the codebase:**
- `shared/utils/date.utils.ts` has `parseLocalDate()` for safe display parsing — some expense components already use it
- Four form components have a local `formatDate()` using `getFullYear()/getMonth()/getDate()` for safe serialization — but this pattern isn't shared

## Acceptance Criteria

### AC1 — Income date preservation

**Given** I create an income entry with date 11/1/2025
**When** the entry is saved and redisplayed
**Then** the date shows 11/1/2025 (not Oct 31, 2025)

### AC2 — Expense date preservation

**Given** I create an expense entry with date 1/1/2026
**When** the entry is saved and redisplayed
**Then** the date shows 1/1/2026 (no day shift from UTC conversion)

### AC3 — Audit all date-only fields

**Given** any form or filter with a date-only field (income, expense, work order)
**When** I submit the form or apply the filter
**Then** the date is sent as an ISO date string (`2025-11-01`) derived from local time, not UTC

## Tasks / Subtasks

### Task 1: Add `formatLocalDate()` to shared date utilities (AC: #1, #2, #3)

> **Why:** Four form components have independent copies of the same safe serialization logic. Extract to a shared utility to fix all serialization bugs with one function and DRY up existing code.

**File:** `frontend/src/app/shared/utils/date.utils.ts`

- [x] 1.1 Add `formatLocalDate(date: Date): string` function to `date.utils.ts`:
  ```typescript
  /**
   * Format a Date object to an ISO date string (YYYY-MM-DD) using local timezone.
   * Avoids the UTC shift bug of toISOString().split('T')[0].
   */
  export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  ```
- [x] 1.2 Add unit test for `formatLocalDate` in `date.utils.spec.ts` (create file if needed) — verify with a date that would shift under UTC (e.g., `new Date(2025, 10, 1)` → `"2025-11-01"`)

### Task 2: Fix serialization bugs — replace `toISOString().split('T')[0]` (AC: #1, #2, #3)

> **Why:** These are the locations that send wrong dates to the backend. Each uses `toISOString()` which converts to UTC before extracting the date part.

- [x] 2.1 **`income.component.ts:505-506`** — `formatDateForApi()` method. Replace:
  ```typescript
  // Before:
  private formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  // After:
  private formatDateForApi(date: Date): string {
    return formatLocalDate(date);
  }
  ```
  Import `formatLocalDate` from `shared/utils/date.utils`.

- [x] 2.2 **`income-row.component.ts:456-458`** — `onSaveEdit()` inline edit save. Replace:
  ```typescript
  // Before:
  const dateValue = formValue.date instanceof Date
    ? formValue.date.toISOString().split('T')[0]
    : formValue.date;
  // After:
  const dateValue = formValue.date instanceof Date
    ? formatLocalDate(formValue.date)
    : formValue.date;
  ```
  Import `formatLocalDate` from `shared/utils/date.utils`.

- [x] 2.3 **`expense-filters.component.ts:303-306`** — `applyCustomDateRange()`. Replace:
  ```typescript
  // Before:
  this.customDateRangeChange.emit({
    dateFrom: fromDate.toISOString().split('T')[0],
    dateTo: toDate.toISOString().split('T')[0],
  });
  // After:
  this.customDateRangeChange.emit({
    dateFrom: formatLocalDate(fromDate),
    dateTo: formatLocalDate(toDate),
  });
  ```
  Import `formatLocalDate` from `shared/utils/date.utils`.

- [x] 2.4 **`expense-list.store.ts:110-111, 118-119`** — `getDateRangeFromPreset()` for this-month and this-quarter presets. Replace all four instances:
  ```typescript
  // Before:
  dateFrom: firstDay.toISOString().split('T')[0],
  dateTo: today.toISOString().split('T')[0],
  // After:
  dateFrom: formatLocalDate(firstDay),
  dateTo: formatLocalDate(today),
  ```
  Import `formatLocalDate` from `shared/utils/date.utils`.

- [x] 2.5 **`create-expense-from-wo-dialog.component.ts:151`** — form initial date value. Replace:
  ```typescript
  // Before:
  date: [new Date().toISOString().split('T')[0], [Validators.required]],
  // After:
  date: [formatLocalDate(new Date()), [Validators.required]],
  ```
  Import `formatLocalDate` from `shared/utils/date.utils`.

### Task 3: Fix display bugs — replace `new Date(dateString)` with `parseLocalDate()` (AC: #1, #2)

> **Why:** These locations parse API date strings (`"2025-11-01"`) with `new Date()` which treats date-only strings as UTC, causing the display to show the previous day in negative UTC offset timezones. The project already has `parseLocalDate()` in `date.utils.ts` — just need to use it.

- [x] 3.1 **`income.component.ts:530-537`** — `formatDate()` display method. Replace:
  ```typescript
  // Before:
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  // After:
  formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }
  ```
  Import `formatDateShort` from `shared/utils/date.utils`.

- [x] 3.2 **`income-row.component.ts:432-438`** — `formatDate()` display method. Same fix as 3.1 — replace with `formatDateShort(dateString)`.
  Import `formatDateShort` from `shared/utils/date.utils`.

- [x] 3.3 **`income-row.component.ts:410`** — datepicker initialization in `initEditForm()`. Replace:
  ```typescript
  // Before:
  date: [new Date(income.date), Validators.required],
  // After:
  date: [parseLocalDate(income.date), Validators.required],
  ```
  Import `parseLocalDate` from `shared/utils/date.utils`.

- [x] 3.4 **`income-row.component.ts:423`** — datepicker reset in `resetFormToCurrentValues()`. Replace:
  ```typescript
  // Before:
  date: new Date(income.date),
  // After:
  date: parseLocalDate(income.date),
  ```

### Task 4: DRY up existing correct serialization code (AC: #3)

> **Why:** Four form components each have their own private `formatDate(date: Date): string` method with identical logic. Replace with the shared `formatLocalDate()` to prevent future drift and reduce code.

- [x] 4.1 **`expense-form.component.ts:422-427`** — Replace private `formatDate()` body with `return formatLocalDate(date);`, import `formatLocalDate`.
- [x] 4.2 **`expense-edit-form.component.ts:522-527`** — Same replacement.
- [x] 4.3 **`income-form.component.ts:260-265`** — Same replacement.
- [x] 4.4 **`receipt-expense-form.component.ts:442-447`** — Same replacement.
- [x] 4.5 **`expense-detail.component.ts:664-669`** — Same replacement.

### Task 5: Update existing tests (AC: all)

- [x] 5.1 Update `expense-filters.component.spec.ts` — tests at lines ~322-334 use `toISOString().split('T')[0]` in assertions. Update to use `formatLocalDate()` or hardcoded expected strings.
- [x] 5.2 Update `create-expense-from-wo-dialog.component.spec.ts:92` — same pattern in test setup.
- [x] 5.3 Run `npm test` from `/frontend` — all tests pass.
- [x] 5.4 Verify no remaining `toISOString().split('T')[0]` in source code (spec files may still use it for test setup — that's OK since those create Date objects at known times, not from user input).

### Task 6: Verify end-to-end (manual smoke test)

- [x] 6.1 Create an income entry with date 11/1/2025 — verify it saves and displays as Nov 1, 2025
- [x] 6.2 Create an expense with date 1/1/2026 — verify it saves and displays as Jan 1, 2026
- [x] 6.3 Test expense date filters: set custom range, verify correct dates are sent to API (check Network tab)
- [x] 6.4 Test expense list preset filters (This Month, This Quarter) — verify correct date range

## Dev Notes

### What's NOT broken (no changes needed)

These locations already use safe patterns:

| Component | Pattern | Why safe |
|-----------|---------|----------|
| `expense-row.component.ts` | `formatDateShort()` | Uses `parseLocalDate` internally |
| `expense-list-row.component.ts` | `formatDateShort()` | Same |
| `expense-workspace.component.ts` | `formatDateShort()` | Same |
| `expense-detail.component.ts` | `formatDateShort()` | Same |
| `duplicate-warning-dialog.component.ts` | `formatDateShort()` | Same |
| `expense-edit-form.component.ts` | `parseDate()` at line 474 | Splits on '-', uses local Date constructor |

### Backend is clean

Backend uses `DateOnly` throughout (entities, commands, DTOs, controllers). `System.Text.Json` in .NET 10 serializes `DateOnly` as `"YYYY-MM-DD"` — no time component, no timezone. Npgsql maps `DateOnly` to PostgreSQL `date` column — timezone-unaware. **No backend changes required.**

### NSwag-generated `api.service.ts`

The generated API client at `core/api/api.service.ts` uses `date.toISOString()` in query URL construction (lines 513, 631, 633, 1259, 1261). However, this file is auto-generated and should NOT be manually edited. The custom services (`ExpenseService`, `IncomeService`) bypass the generated client for mutations — they use `HttpClient` directly with string dates. The filter/query paths that DO use the generated client receive string dates after our fix, so the `toISOString()` code paths won't be triggered (the value is already a string, not a Date).

### Scope of the fix

| File | Change type | Bug surface |
|------|------------|-------------|
| `shared/utils/date.utils.ts` | ADD `formatLocalDate()` | Shared utility |
| `income.component.ts` | FIX serialization + display | Filter dates + list display |
| `income-row.component.ts` | FIX serialization + display + datepicker | Inline edit + row display |
| `expense-filters.component.ts` | FIX serialization | Custom date range filter |
| `expense-list.store.ts` | FIX serialization | Preset date range filters |
| `create-expense-from-wo-dialog.component.ts` | FIX serialization | Initial form date |
| `expense-form.component.ts` | DRY (already correct) | — |
| `expense-edit-form.component.ts` | DRY (already correct) | — |
| `income-form.component.ts` | DRY (already correct) | — |
| `receipt-expense-form.component.ts` | DRY (already correct) | — |
| `expense-detail.component.ts` | DRY (already correct) | — |

### Architecture Compliance

- **No new files** except `date.utils.spec.ts` (if it doesn't exist)
- **No backend changes** — backend is already correct with `DateOnly`
- **No new dependencies** — pure utility function
- **Shared utility pattern** — consistent with existing `date.utils.ts`

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- Unit test for `formatLocalDate()` in `date.utils.spec.ts`
- Update existing tests that assert `toISOString().split('T')[0]`
- No new component tests needed — existing tests cover the form flows; we're just swapping the internal serialization function

### References

- [GitHub Issue #217](https://github.com/daveharmswebdev/property-manager/issues/217)
- [Source: `shared/utils/date.utils.ts` — existing `parseLocalDate()` utility]
- [Source: `expense-detail.component.ts:664-669` — reference implementation of safe serialization]
- [Source: `_bmad-output/project-context.md` — project rules and patterns]

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-19_
_For: Dave_
_Project: property-manager_
