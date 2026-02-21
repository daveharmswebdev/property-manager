# Story 16.5: UX Polish Bundle

Status: complete

**GitHub Issues:** #220, #222, #223
**Prerequisites:** None
**Effort:** Small — CSS, template, and minor TS changes only. No backend changes.

## Story

As a **user performing common operations**,
I want **clear visual feedback and readable details**,
So that **the app feels polished and I always know what I'm acting on**.

## Acceptance Criteria

### AC1 — Inline delete shows record details (#220)

**Given** I click delete on an inline row (income, expense, etc.)
**When** the confirmation appears
**Then** I can see the key details of the record being deleted (e.g., "$1,500.00 on Nov 1, 2025")
**And** this pattern is consistent across all inline delete confirmations

### AC2 — Inline edit form visual separation (#222)

**Given** I'm editing a record inline (income, expense workspace)
**When** the edit form appears between list rows
**Then** the form has visual distinction (border, shadow, or background shade) from surrounding rows
**And** this applies consistently to all inline edit forms

### AC3 — Receipt queue exact timestamp (#223)

**Given** I view the receipt queue
**When** I look at a receipt item
**Then** I see the exact timestamp alongside the relative time (e.g., "about 1 month ago" + "Jan 14, 2026 3:42 PM")

## Tasks / Subtasks

### Task 1: Add record details to income inline delete confirmation (AC: #1)

> **Why:** Income row uses an inline confirmation that only says "Delete this income entry?" with no record details. The expense workspace already shows details via `secondaryMessage` in the modal dialog — this is the gold standard. The income inline pattern needs record details displayed directly.

**File:** `frontend/src/app/features/income/components/income-row/income-row.component.ts`

- [x] 1.1 Update the inline delete confirmation template to show record details:
  ```html
  <!-- Delete Confirmation Mode (AC-4.2.5) -->
  <div class="income-row income-row--confirming">
    <div class="confirm-message">
      Delete this income entry?
    </div>
    <div class="confirm-details">
      {{ income().amount | currency }} on {{ formatDate(income().date) }}
      @if (income().source) {
        &mdash; {{ income().source }}
      }
    </div>
    <div class="confirm-actions">
      <!-- existing buttons unchanged -->
    </div>
  </div>
  ```

- [x] 1.2 Add CSS for `.confirm-details`:
  ```scss
  .confirm-details {
    font-size: 0.875rem;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 12px;
  }
  ```

### Task 2: Audit all other delete confirmations for record details (AC: #1)

> **Why:** The AC says "consistent across all inline delete confirmations." Verify every delete shows record details. The expense workspace ALREADY shows details — confirm it's good and audit the rest.

**Audit results from analysis (no changes needed unless missing):**

| Component | Current state | Action |
|---|---|---|
| Expense workspace | Shows `date • description • category • $amount` via `secondaryMessage` | No change |
| Expense detail | Modal — shows details | No change |
| Income row | **MISSING** — only "Delete this income entry?" | **FIX in Task 1** |
| Income detail | Modal — "This income entry will be permanently removed." + secondary details | Verify has details, add if missing |
| Income component (list page) | Modal — shows `$amount on date` via `secondaryMessage` | Verify |
| Vendor list | Shows vendor name in title: `Delete ${vendor.fullName}?` | Acceptable |
| Work order detail | "This will remove the work order. Linked expenses will be unlinked." | Add work order description as `secondaryMessage` |
| Receipts page | "Are you sure you want to delete this receipt?" | Add property name or filename as `secondaryMessage` |
| Property detail | Shows property name in title + secondary msg about preserved records | No change |

**Files to check and potentially update:**
- [x] 2.1 Verify `income-detail.component.ts` shows record details in delete dialog — added `secondaryMessage` with `$amount on date`
- [x] 2.2 Verify `income.component.ts` shows record details — already shows `$amount from date` in message. No change needed.
- [x] 2.3 Update `work-order-detail.component.ts` — added `secondaryMessage` with work order description (truncated to 80 chars)
- [x] 2.4 Update `receipts.component.ts` — added `secondaryMessage` with property name when available

### Task 3: Add visual separation to expense inline edit form (AC: #2)

> **Why:** `expense-edit-form.component.ts` currently has `background-color: var(--mat-sys-surface-container-low)` and `border-radius: 8px` but NO border or shadow. It blends into surrounding rows.

**File:** `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts`

- [x] 3.1 Update `.expense-edit-form` styles to add border and subtle shadow:
  ```scss
  .expense-edit-form {
    padding: 16px;
    background-color: var(--mat-sys-surface-container-low);
    border-radius: 8px;
    margin: 8px 0;
    border: 1px solid var(--mat-sys-outline-variant);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }
  ```

### Task 4: Add visual separation to income inline edit form (AC: #2)

> **Why:** `income-row.component.ts` uses `background-color: var(--mat-sys-surface-container)` for edit and confirming states but has NO border or shadow. Apply the same treatment as the expense edit form.

**File:** `frontend/src/app/features/income/components/income-row/income-row.component.ts`

- [x] 4.1 Update `.income-row--editing` and `.income-row--confirming` styles:
  ```scss
  .income-row--editing,
  .income-row--confirming {
    flex-direction: column;
    align-items: stretch;
    background-color: var(--mat-sys-surface-container);
    border: 1px solid var(--mat-sys-outline-variant);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    margin: 4px 0;
  }
  ```
  Note: Add `border-radius` and `margin` to match expense edit form style. Remove `border-bottom` from base `.income-row` when in editing/confirming state since the border-radius makes the bottom border look odd.

### Task 5: Add exact timestamp to receipt queue item (AC: #3)

> **Why:** Currently only shows relative time ("about 1 month ago") via `formatDistanceToNow`. Need to add the exact timestamp alongside it.

**File:** `frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts`

- [x] 5.1 Add `format` import from `date-fns`:
  ```typescript
  import { formatDistanceToNow, format } from 'date-fns';
  ```

- [x] 5.2 Add a computed signal for the exact timestamp:
  ```typescript
  /** Exact formatted timestamp (e.g., "Jan 14, 2026 3:42 PM") */
  exactDate = computed(() => {
    const createdAt = this.receipt().createdAt;
    if (!createdAt) return '';
    const date = new Date(createdAt);
    return format(date, 'MMM d, yyyy h:mm a');
  });
  ```

- [x] 5.3 Update the template to show both relative and exact time:
  ```html
  <span class="date" data-testid="receipt-date">{{ formattedDate() }}</span>
  @if (exactDate()) {
    <span class="exact-date" data-testid="receipt-exact-date">{{ exactDate() }}</span>
  }
  ```

- [x] 5.4 Add CSS for `.exact-date`:
  ```scss
  .exact-date {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.45);
  }
  ```
  Note: The `.details` container already has `flex-direction: column` and `gap: 4px`, so the exact date will naturally appear on its own line below the relative time and above the property name.

### Task 6: Update unit tests (AC: all)

- [x] 6.1 **Income row tests** (`income-row.component.spec.ts`):
  - Test: "delete confirmation shows record details (amount and date)" — PASS
  - Test: "delete confirmation shows source when available" — PASS

- [x] 6.2 **Receipt queue item tests** (`receipt-queue-item.component.spec.ts`):
  - Test: "shows exact timestamp alongside relative time" — PASS
  - Test: "exact timestamp renders correct format" — PASS

- [x] 6.3 **Expense edit form tests** (`expense-edit-form.component.spec.ts`):
  - No new tests needed — visual styling only

### Task 7: Run all tests (AC: all)

- [x] 7.1 `npm test` from `/frontend` — 2424/2424 tests pass (4 new + 2420 existing)
- [x] 7.2 Verify no TypeScript compilation errors

## Dev Notes

### Zero-Change Inventory (Don't Rebuild)

| Component / File | Path | What it does | Reuse how |
|---|---|---|---|
| `ConfirmDialogComponent` | `shared/components/confirm-dialog/confirm-dialog.component.ts` | Centralized modal dialog with `secondaryMessage` support | Already has `secondaryMessage` field — just populate it in callers |
| `ConfirmDialogData` | Same file | Interface with `title`, `message`, `secondaryMessage`, `icon`, `iconColor`, `confirmIcon` | Use `secondaryMessage` for record details |
| `formatDateShort()` | `shared/utils/date.utils.ts` | Returns "Jan 15, 2025" format | Already imported in `income-row.component.ts` |
| `CurrencyPipe` | Angular CommonModule | Formats `{{ amount \| currency }}` | Already imported in `income-row.component.ts` |
| `date-fns` | v4.1.0 | `formatDistanceToNow` already used in receipt queue item | Add `format` import for exact timestamp |

### AC1 — Delete Details: Current State

**Expense workspace** (ALREADY DONE — reference implementation):
```typescript
// expense-workspace.component.ts:onDeleteExpense()
const dialogData: ConfirmDialogData = {
  title: 'Delete Expense?',
  message: 'This expense will be removed from your records.',
  secondaryMessage: `${this.formatDate(expense.date)} • ${expense.description} • ${expense.categoryName} • ${this.formatCurrency(expense.amount)}`,
  icon: 'warning', iconColor: 'warn', confirmIcon: 'delete',
};
```

**Income row** (NEEDS FIX — only says "Delete this income entry?"):
```html
<!-- income-row.component.ts lines 127-152 — current template -->
<div class="income-row income-row--confirming">
  <div class="confirm-message">Delete this income entry?</div>
  <!-- NO record details shown -->
  <div class="confirm-actions">...</div>
</div>
```

The income row already has access to `income()` data and the `formatDate()` method and `CurrencyPipe`. Just add a details line between the message and actions.

### AC2 — Visual Separation: Design Decision

Use **border + subtle shadow** for consistency. This is a minimal change:
- `border: 1px solid var(--mat-sys-outline-variant)` — uses Material Design theme token
- `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08)` — lighter than `mat-elevation-z2` which is too heavy for inline forms
- `border-radius: 8px` — already on expense edit, add to income edit

Do NOT use `mat-elevation-z2` class — it's `box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12)` which is too prominent for an inline context.

### AC3 — Receipt Timestamp: date-fns Format

`date-fns` v4 uses the same `format()` function:
```typescript
import { format } from 'date-fns';
format(new Date(), 'MMM d, yyyy h:mm a');  // "Jan 14, 2026 3:42 PM"
```

The `.details` div in `receipt-queue-item.component.ts` is already a column flexbox with `gap: 4px`. The new `.exact-date` span slots naturally between the relative date and property name. The visual hierarchy:
1. **"about 1 month ago"** — `font-weight: 500` (existing `.date` class)
2. **"Jan 14, 2026 3:42 PM"** — `font-size: 0.75rem`, muted color (new `.exact-date`)
3. **"Oak Street Duplex"** — `font-size: 0.875rem` (existing `.property` class)

### Backend Changes

**None.** This is entirely a frontend story.

### Files NOT to Modify

- Any backend file
- `expense-workspace.component.ts` — expense delete already shows details
- `expense-row.component.ts` — just emits ID to parent
- `property-detail.component.ts` — delete already shows name + secondary message
- `delete-report-dialog.component.ts` — custom dialog, already shows report details
- `confirm-dialog.component.ts` — shared dialog already supports `secondaryMessage`, no changes needed

### Project Structure Notes

**Modified files only (no new files):**
```
frontend/src/app/features/income/components/income-row/income-row.component.ts
  — Add record details to delete confirmation template + add edit/confirming border+shadow styles

frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts
  — Add border + shadow to .expense-edit-form CSS

frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts
  — Add exact timestamp computed signal + template line + CSS

frontend/src/app/features/income/income-detail/income-detail.component.ts
  — Add secondaryMessage to delete dialog (if missing)

frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts
  — Add secondaryMessage with work order description to delete dialog

frontend/src/app/features/receipts/receipts.component.ts
  — Add secondaryMessage with filename/property to delete dialog
```

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- Income row: 2 new tests for delete confirmation details
- Receipt queue item: 2 new tests for exact timestamp
- All tests are co-located with their component spec files
- No new test files needed

### Previous Story Intelligence (16.4)

Story 16.4 established:
- Signal-based state management patterns (`.set()`, computed signals)
- `var(--mat-sys-*)` CSS custom properties for theming consistency
- `data-testid` attributes on key interactive elements
- All 2,420 frontend tests passing as baseline
- All 1,484 backend tests passing as baseline

### Git Intelligence

Recent commits show stable main branch with successful merges:
```
cd7c022 Merge pull request #246 — fix/expense-receipt-thumbnail
dac1b22 Merge pull request #242 — feature/235-expense-workorder-receipt-linking
79c21f0 Merge pull request #245 — feature/maintenance-work-order-lifecycle
```

### References

- [GitHub Issue #220](https://github.com/daveharmswebdev/property-manager/issues/220) — Inline delete should show record details
- [GitHub Issue #222](https://github.com/daveharmswebdev/property-manager/issues/222) — Inline edit form visual separation
- [GitHub Issue #223](https://github.com/daveharmswebdev/property-manager/issues/223) — Receipt queue exact timestamp
- [Source: `features/income/components/income-row/income-row.component.ts` — Inline delete + edit target]
- [Source: `features/expenses/components/expense-edit-form/expense-edit-form.component.ts` — Edit form CSS target]
- [Source: `features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts` — Timestamp target]
- [Source: `shared/components/confirm-dialog/confirm-dialog.component.ts` — ConfirmDialogData interface with secondaryMessage]
- [Source: `features/expenses/expense-workspace/expense-workspace.component.ts` — Reference implementation for delete details pattern]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, all tests passed first try after green phase.

### Completion Notes List

- AC1: Income row inline delete now shows `$amount on date — source` in `.confirm-details` div
- AC1 Audit: Added `secondaryMessage` to income-detail, work-order-detail, receipts delete dialogs. income.component already had details in message. Expense workspace and property detail already had secondaryMessage.
- AC2: Added `border: 1px solid var(--mat-sys-outline-variant)` and `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08)` to both expense-edit-form and income-row editing/confirming states. Added `border-radius: 8px` and `margin: 4px 0` to income states for consistency.
- AC3: Added `exactDate` computed signal using `date-fns` `format()` with `'MMM d, yyyy h:mm a'` pattern. Displayed below relative time in receipt queue items.
- TDD: 4 new tests written before implementation (red), all passing after (green).
- All 2424 frontend tests passing.

### File List

- `frontend/src/app/features/income/components/income-row/income-row.component.ts` — Task 1 (confirm-details template + CSS), Task 4 (border/shadow on editing/confirming)
- `frontend/src/app/features/income/components/income-row/income-row.component.spec.ts` — Task 6.1 (2 new tests)
- `frontend/src/app/features/expenses/components/expense-edit-form/expense-edit-form.component.ts` — Task 3 (border + shadow CSS)
- `frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts` — Task 5 (format import, exactDate signal, template, CSS)
- `frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.spec.ts` — Task 6.2 (2 new tests)
- `frontend/src/app/features/income/income-detail/income-detail.component.ts` — Task 2.1 (secondaryMessage)
- `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` — Task 2.3 (secondaryMessage)
- `frontend/src/app/features/receipts/receipts.component.ts` — Task 2.4 (secondaryMessage)
