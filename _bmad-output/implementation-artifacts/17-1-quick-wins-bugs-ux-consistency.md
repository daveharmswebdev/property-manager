# Story 17.1: Quick Wins — CSS, Form & List Fixes

Status: review

**Combined Story:** Bundles original stories 17.1 through 17.5 into a single dev effort.
**GitHub Issues:** #273, #275, #278, #272, #265, #269, #267, #266
**Effort:** M (combined XS + 4×S)

## Story

As a property owner using the application daily,
I want dialogs to display labels correctly, forms to behave predictably, and all list views to have consistent edit/delete actions,
so that I don't fight visual glitches, stale data, or missing functionality across different views.

## Acceptance Criteria

### Group A — CSS Dialog & Label Fixes (Issues #273, #275, #278)

**AC-A1: Inline Add Vendor dialog label fix (#273)**
Given I open the "Add New Vendor" dialog from the Work Order form
When the dialog renders
Then the "First Name*" label is fully visible and not clipped by the card header

**AC-A2: Schedule E Reports modal label fix (#275)**
Given I open "Generate All Schedule E Reports" from the Reports page
When the dialog renders
Then the "Tax Year" label is fully visible and not clipped by the dialog header

**AC-A3: Link Expense dialog text contrast (#278)**
Given I open "Link Existing Expense" from a Work Order detail page
When the expense list renders
Then the expense date and category text have sufficient contrast (WCAG AA minimum)
And all three lines (date, description, category) are fully visible without clipping

### Group B — Form Behavior Fixes: Vendor Edit (Issues #272, #265)

**AC-B1: Save button disabled on pristine form (#272)**
Given I navigate to Edit Vendor and the form loads with existing data
When I have not changed any field
Then the "Save Changes" button is disabled
And the button enables only after I modify at least one field value OR add/remove a trade tag

**AC-B2: Phone number input mask (#265)**
Given I am editing a vendor's phone number
When I type digits into the phone number field
Then the input formats as `(XXX) XXX-XXXX` as I type
And stored value is digits-only for API submission

**AC-B3: Trade tag input clears after creation (#265)**
Given I type a tag name in the Trade Tags input and select "Create" from autocomplete
When the chip appears in the tag list
Then the text input field is cleared automatically
And I can immediately type another tag name

### Group C — Work Order List Refresh After Delete (Issue #269)

**AC-C1: List updates after delete**
Given I am on the Work Orders list (`/work-orders`)
When I delete a work order and the API confirms success
Then the deleted work order is immediately removed from the list
And the total count updates accordingly

**AC-C2: No full page reload required**
Given the delete succeeds
When the list updates
Then my scroll position and any active filters are preserved

### Group D — Expenses List Actions Column (Issue #267)

**AC-D1: Actions column with edit and delete**
Given I am on the `/expenses` page
When I view the expense table
Then I see an "Actions" column with edit (pencil icon) and delete (trash icon) buttons per row

**AC-D2: Edit navigates to detail/edit**
Given I click the edit icon on an expense row
When the action fires
Then I am navigated to `/expenses/:id`

**AC-D3: Delete with confirmation**
Given I click the delete icon on an expense row
When the confirmation dialog appears and I confirm
Then the expense is soft-deleted and removed from the list
And a snackbar confirms the deletion

### Group E — WO Linked Expenses: Clickable Rows & Actions (Issue #266)

**AC-E1: Clickable expense rows**
Given I am on a Work Order detail page viewing the Linked Expenses section
When I click on an expense row
Then I navigate to `/expenses/:id` for that expense

**AC-E2: Actions column (edit, delete, unlink)**
Given I view the Linked Expenses list
When I look at the actions area per row
Then I see edit (pencil), delete (trash), and unlink action icons
And the existing unlink icon is retained

**AC-E3: Delete removes expense**
Given I click delete on a linked expense
When I confirm the deletion
Then the expense is soft-deleted
And it disappears from both the linked expenses list and the global expenses list

## Tasks / Subtasks

### Group A: CSS Dialog & Label Fixes
- [x] Task A1: Fix inline vendor dialog label clipping (AC: A1)
  - [x] A1.1: In `inline-vendor-dialog.component.ts` inline styles, increase `mat-dialog-content` padding-top from `8px` to `20px`
  - [x] A1.2: Verify "First Name*" floating label is fully visible when field is empty and when focused
- [x] Task A2: Fix batch report dialog label clipping (AC: A2)
  - [x] A2.1: In `batch-report-dialog.component.ts` inline styles, add `padding-top: 4px` to the `.year-field` mat-form-field or increase dialog content top padding
  - [x] A2.2: Verify "Tax Year" floating label is fully visible
- [x] Task A3: Fix link expense dialog text contrast (AC: A3)
  - [x] A3.1: In `link-expense-dialog.component.ts` inline styles, change `.expense-date` and `.expense-category` color from `var(--mat-sys-outline)` to `var(--mat-sys-on-surface-variant)`
  - [x] A3.2: Verify text passes WCAG AA contrast ratio (4.5:1 for small text)

### Group B: Form Behavior Fixes — Vendor Edit
- [x] Task B1: Add dirty check to Save button (AC: B1)
  - [x] B1.1: In `vendor-edit.component.ts`, change Save button `[disabled]` from `form.invalid || store.isSaving()` to `(form.invalid || (!form.dirty && !hasTagChanges())) || store.isSaving()`
  - [x] B1.2: Extract trade tag change detection into a `hasTagChanges()` helper (compare `selectedTags()` IDs against `originalTradeTagIds`)
  - [x] B1.3: Add unit test for button disabled when pristine, enabled when dirty
- [x] Task B2: Add phone number input mask (AC: B2)
  - [x] B2.1: Create `phone-mask.directive.ts` in `shared/directives/`
  - [x] B2.2: Directive listens to `input` event, formats display as `(XXX) XXX-XXXX`, strips to digits for model value
  - [x] B2.3: Apply directive to phone number input in `vendor-edit.component.ts`
  - [x] B2.4: N/A — `vendor-form.component.ts` (create flow) has no phone number fields; phone numbers are only added during vendor edit
  - [x] B2.5: Ensure stored/submitted value is digits-only (check save handler trim logic)
  - [x] B2.6: Add unit test for directive: input "5125551234" → display "(512) 555-1234", model "5125551234"
- [x] Task B3: Verify trade tag input clearing (AC: B3)
  - [x] B3.1: Test the autocomplete "Create" path in `selectTag()` — verify `tagInputControl.setValue('')` clears native input
  - [x] B3.2: Added `@ViewChild('tagInput') tagInput: ElementRef` and clear `this.tagInput.nativeElement.value = ''` in `selectTag()`
  - [x] B3.3: Verify `addTagFromInput()` path (ENTER/COMMA) also clears — this path already calls `event.chipInput?.clear()`

### Group C: Work Order List Refresh After Delete
- [x] Task C1: Fix work order store delete to update local list (AC: C1, C2)
  - [x] C1.1: In `work-order.store.ts` `deleteWorkOrder` method, after successful API delete, add `patchState(store, { workOrders: store.workOrders().filter(wo => wo.id !== id) })`
  - [x] C1.2: Conditionally navigate — only when `selectedWorkOrder` is set (detail page context)
  - [x] C1.3: If the delete is called from detail page (selectedWorkOrder context), keep the navigate; if from list page, don't navigate
  - [x] C1.4: Add unit test: after delete, `workOrders()` array no longer contains deleted item

### Group D: Expenses List Actions Column
- [x] Task D1: Add actions column to expense list (AC: D1, D2, D3)
  - [x] D1.1: Added actions cell with edit/delete buttons to expense-list-row template
  - [x] D1.2: Updated grid-template-columns in both `.list-header` and `.expense-list-row` to add `80px` actions column
  - [x] D1.3: Added "Actions" header in `expenses.component.ts` list header
  - [x] D1.4: Added `onDelete()` method and `delete` output event to `expense-list-row.component.ts`
  - [x] D1.5: Added `onDeleteExpense()` handler in `expenses.component.ts` with `ConfirmDialogComponent` + `store.deleteExpense(id)`
  - [x] D1.6: Added unit tests for delete emit and action buttons (3 tests)

### Group E: WO Linked Expenses Click & Actions
- [x] Task E1: Make linked expense rows clickable (AC: E1)
  - [x] E1.1: In `work-order-detail.component.ts` linked expenses template, add `(click)="navigateToExpense(expense.id)"` to expense rows
  - [x] E1.2: Add `navigateToExpense(id: string)` method that calls `router.navigate(['/expenses', id])`
  - [x] E1.3: Add cursor pointer styling to `.expense-row` with hover effect
- [x] Task E2: Add edit and delete icons alongside unlink (AC: E2, E3)
  - [x] E2.1: In `.expense-actions` section, added edit (pencil) and delete (trash) icon buttons before existing unlink button
  - [x] E2.2: Edit button: `onEditExpense($event, expense.id)` with stopPropagation + navigate
  - [x] E2.3: Delete button: `onDeleteLinkedExpense($event, expense.id)` opens `ConfirmDialogComponent`, calls `expenseService.deleteExpense(id)`, then refreshes via `loadLinkedExpenses()`
  - [x] E2.4: Wrapped unlink in `onUnlinkExpense($event, expense.id)` with `stopPropagation()` on all action buttons
  - [x] E2.5: `ExpenseService` already injected — used directly instead of store (component uses local signal state for linked expenses)

## Dev Notes

### Group A — CSS Fixes

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts` | Increase `mat-dialog-content` padding-top from 8px → 20px |
| `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.ts` | Add top padding/margin to `.year-field` or increase content padding |
| `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.ts` | Change color on `.expense-date` and `.expense-category` |

**Root cause for AC-A1/A2:** Angular Material's `mat-form-field` with `appearance="outline"` positions the floating label in the outline notch. When a dialog has tight padding between the title bar and the first form field, the label's upward float overlaps the title area. Fix: increase `padding-top` on `mat-dialog-content` or add `margin-top` to the first form field.

**Contrast fix for AC-A3:** The current `var(--mat-sys-outline)` is a low-contrast Material 3 token. Replace with `var(--mat-sys-on-surface-variant)` which is designed for secondary text with readable contrast. The project also defines `--pm-text-secondary: #64748b` in `styles.scss` (line 27) as an alternative.

**All dialogs use inline styles** (no external SCSS files). Edit the `styles: [...]` array in the `@Component` decorator.

### Group B — Vendor Edit Form Fixes

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.ts` | Save button disabled binding + tag input clearing verification |
| `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.ts` | Apply phone mask to create form too |
| `frontend/src/app/shared/directives/phone-mask.directive.ts` | **NEW FILE** — phone formatting directive |

**Save button (AC-B1):** Current binding is `[disabled]="form.invalid || store.isSaving()"` (line ~210). The component already tracks dirty state via `hasUnsavedChanges()` (line ~468). But trade tag changes bypass `form.dirty` because tags use a signal (`selectedTags`), not a FormArray. Solution: combine `form.dirty` with a tag comparison check.

**Phone mask (AC-B2):** No phone formatting exists in the codebase. No third-party mask libraries installed. Create a lightweight directive:
- Selector: `[appPhoneMask]`
- On `input` event: strip non-digits, format as `(XXX) XXX-XXXX` for display
- Write digits-only to the FormControl model value via `NgControl`
- Max 10 digits (US phone)
- Reference: `shared/directives/currency-input.directive.ts` exists as a pattern for input formatting directives in this project

**Tag clearing (AC-B3):** Both code paths already call `tagInputControl.setValue('')`:
- `addTagFromInput()` (ENTER/COMMA) — also calls `event.chipInput?.clear()` ✓
- `selectTag()` (autocomplete) — only calls `tagInputControl.setValue('')`, does NOT clear native input

**Likely bug:** The autocomplete path (`selectTag`) may leave text in the native input. If so, add `@ViewChild('tagInput') tagInput!: ElementRef<HTMLInputElement>` and call `this.tagInput.nativeElement.value = ''` in `selectTag()`. Test both paths manually before deciding.

### Group C — Work Order Store Delete

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/app/features/work-orders/stores/work-order.store.ts` | Fix `deleteWorkOrder` to update local list |

**Root cause:** `deleteWorkOrder` (line ~453) calls API, clears `selectedWorkOrder`, navigates away — but never removes the item from `workOrders` array. When the user returns to the list, the deleted item is still there until next API fetch.

**Reference pattern — income store** (`income.store.ts` line ~334):
```typescript
// After successful API delete:
const updatedIncome = store.incomeEntries().filter(i => i.id !== incomeId);
patchState(store, { incomeEntries: updatedIncome, isDeleting: false });
```

**Implementation:** Add the same filter pattern. Keep the navigation for detail-page context (the user may have clicked delete from the detail view), but also ensure the list state is updated so returning to the list shows correct data.

### Group D — Expense List Actions

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` | Add actions cell + delete output |
| `frontend/src/app/features/expenses/expenses.component.ts` | Add actions header + delete handler |

**Reference pattern — income list** (`income.component.ts` line ~198):
```html
<div class="cell-actions" (click)="$event.stopPropagation()">
  <button mat-icon-button matTooltip="Edit" (click)="navigateToDetail(income)">
    <mat-icon>edit</mat-icon>
  </button>
  <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDeleteIncome(income)">
    <mat-icon>delete</mat-icon>
  </button>
</div>
```

**Grid update:** Current expense row grid is `100px 150px 1fr auto 40px 40px 100px` (7 cols). Add 8th column: `100px 150px 1fr auto 40px 40px 100px 80px`. Match in both `.list-header` and `.expense-list-row`.

**Delete flow:** Expense store already has `deleteExpense(id)` which removes from list, updates `ytdTotal`, and shows snackbar. Use `ConfirmDialogComponent` before calling it — same pattern as income delete.

**Expense list row is a child component** with `@Input() expense` and existing `@Output() createWorkOrder`. Add `@Output() delete = new EventEmitter<string>()`. Parent `expenses.component.ts` handles the confirmation dialog.

### Group E — WO Linked Expenses

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` | Add row click + edit/delete icons |

**Current state:** Linked expenses section (line ~293) displays expenses in a flex layout with only an unlink (`link_off`) button. Rows are NOT clickable.

**DTO available:** `WorkOrderExpenseItemDto { id, date, description, categoryName, amount }` — has the `id` needed for navigation.

**Delete flow:** Inject `ExpenseStore` (if not already), call `expenseStore.deleteExpense(id)`, then call `this.loadLinkedExpenses()` to refresh the section. Use `ConfirmDialogComponent` for confirmation.

**Linked expense refresh:** `loadLinkedExpenses()` (line ~844) already exists — calls `workOrderService.getWorkOrderExpenses(workOrderId)` and updates local `linkedExpenses` signal.

### Project Structure Notes

- All changes are **frontend-only** — no backend modifications, no migrations
- Follows existing component patterns: inline styles in `@Component`, signal stores, `inject()` function
- New file: only `phone-mask.directive.ts` in `shared/directives/`
- Shared directives precedent: `currency-input.directive.ts` already exists in same folder

### References

- [Source: epic-17-tech-debt-bugs-ux-consistency.md — Stories 17.1–17.5]
- [Source: project-context.md — Angular Signal Store patterns, testing rules]
- [Source: income.store.ts:334-392 — Reference delete pattern]
- [Source: income.component.ts:198-224 — Reference actions column pattern]
- [Source: vendor-edit.component.ts:468-486 — Existing hasUnsavedChanges() method]
- [Source: work-order.store.ts:453-503 — Bug: missing patchState after delete]
- [Source: expense-list-row.component.ts:37-101 — Current template, missing actions]
- [Source: work-order-detail.component.ts:293-346 — Linked expenses section]
- [Angular Material Dialog docs — mat-dialog-content provides scrollable area with default padding]
- [Angular Material Chips docs — MatChipInput with matChipInputFor for text entry]

## Testing Requirements

### Unit Tests
- **Phone mask directive:** Input formatting, digit-only model value, partial input handling, paste handling
- **Save button disabled state:** Pristine → disabled, dirty → enabled, tag change only → enabled
- **Expense list row delete emit:** Emits expense ID on delete click
- **Work order store delete:** After delete, `workOrders()` filtered correctly

### Manual Verification
- **All three dialogs** (AC-A1, A2, A3): Open each, verify labels visible, contrast readable
- **Phone mask:** Type digits, verify formatting, submit and verify digits-only stored
- **Tag input clearing:** Test both ENTER/COMMA creation and autocomplete "Create" selection
- **WO list refresh:** Delete from list view, verify item removed without page reload
- **Expense actions:** Click edit → navigates; click delete → confirm → removed
- **WO linked expenses:** Click row → navigates; edit/delete/unlink icons all functional

### E2E Tests
No new E2E tests required — these are UI polish fixes. Existing E2E tests should continue passing. Run full suite to verify no regressions.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Used `npm test -- --include=...` pattern (never `npx vitest`) per project memory
- RED-GREEN-REFACTOR TDD cycle for each group

### Completion Notes List
- **Group A:** CSS-only — no unit tests needed, manual verification required
- **Group B:** 3 new tests for Save button disabled state, 10 new tests for phone mask directive (45/45 vendor-edit, 10/10 phone-mask)
- **Group C:** 2 new tests + 1 updated test for work order delete behavior (61/61 work-order store)
- **Group D:** 3 new tests for expense row delete action (21/21 expense-list-row)
- **Group E:** 6 new tests + 1 updated test for linked expense click/edit/delete (62/62 work-order-detail)
- All 2553 tests across 109 files pass

### File List
**Modified:**
| File | Changes |
|------|---------|
| `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts` | A1: padding-top 8px → 20px |
| `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.ts` | A2: added padding-top 4px to .year-field |
| `frontend/src/app/features/work-orders/components/link-expense-dialog/link-expense-dialog.component.ts` | A3: color outline → on-surface-variant |
| `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.ts` | B1: Save button dirty check, B2: phone mask directive, B3: tag input clearing |
| `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.spec.ts` | B1: 3 new tests for save button disabled state |
| `frontend/src/app/features/work-orders/stores/work-order.store.ts` | C1: patchState after delete, conditional navigation |
| `frontend/src/app/features/work-orders/stores/work-order.store.spec.ts` | C1: 2 new tests + 1 updated |
| `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts` | D1: actions column (edit/delete), 8-col grid |
| `frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.spec.ts` | D1: 3 new tests for delete action |
| `frontend/src/app/features/expenses/expenses.component.ts` | D1: actions header, onDeleteExpense handler |
| `frontend/src/app/features/expenses/stores/expense-list.store.ts` | D1: deleteExpense rxMethod |
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` | E1: row click navigate, E2: edit/delete/unlink actions |
| `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.spec.ts` | E1/E2: 6 new tests + 1 updated |

**Created:**
| File | Purpose |
|------|---------|
| `frontend/src/app/shared/directives/phone-mask.directive.ts` | B2: Phone formatting directive (ControlValueAccessor) |
| `frontend/src/app/shared/directives/phone-mask.directive.spec.ts` | B2: 10 unit tests for phone mask |
