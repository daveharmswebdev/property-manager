# Story 15.2: Quick-Fix Form Validation Bugs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user interacting with forms,
I want validation states to be correct and required fields clearly marked,
so that I'm not confused by phantom errors or missing indicators.

## Acceptance Criteria

**AC1 — Note field resets cleanly after add (GitHub #202):**
Given I add a note to a work order successfully
When the note is created and the field clears
Then the textarea is in a pristine state with no validation error border

**AC2 — Category required indicator (GitHub #205):**
Given I am on the New Expense form
When I view the Category dropdown label
Then it displays `Category *` matching the pattern of other required fields (Amount, Date)

## Tasks / Subtasks

- [x] Task 1: Fix note field reset to pristine state (AC: #1)
  - [x] 1.1: In `work-order-notes.component.ts` line 412, change `this.noteContent.setValue('')` to `this.noteContent.reset()`
  - [x] 1.2: Update `work-order-notes.component.spec.ts` — existing test at line ~191 asserts `component.noteContent.value` is `''` after add; update to also assert `component.noteContent.pristine` is `true` and `component.noteContent.untouched` is `true`
  - [x] 1.3: Add test: after successful note add, `noteContent.errors` should be `null` (since `reset()` clears to null which is falsy but the required validator fires on empty string — verify `reset()` sets value to `null` and the control is pristine, so no error is displayed even though technically invalid)

- [x] Task 2: Add required indicator to Category dropdown (AC: #2)
  - [x] 2.1: In `category-select.component.ts` line 27, change `<mat-label>Category</mat-label>` to `<mat-label>Category *</mat-label>`
  - [x] 2.2: Update `category-select.component.spec.ts` — add or update test: the rendered `mat-label` text should contain `Category *`

## Dev Notes

### Current State — Note Field Reset (AC1)

**File:** `frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.ts`

The `noteContent` control is defined at line 368:
```typescript
noteContent = new FormControl('', Validators.required);
```

In the `addNote()` method (line 399), after a successful create, line 412 does:
```typescript
this.noteContent.setValue('');
```

**Problem:** `setValue('')` sets the value to empty string but does NOT reset the control's `dirty`/`touched` state. Because the field has `Validators.required`, it becomes invalid (empty + required = error), and since it's still marked `dirty`/`touched` from the user's prior input, the validation error border shows immediately.

**Fix:** `this.noteContent.reset()` sets the value to `null`, AND resets `pristine` to `true` and `untouched` to `true`. The required validator will still consider the control invalid, but the error won't display because the control isn't dirty/touched. This matches the initial load state.

**Existing test (spec line ~191):**
```typescript
expect(component.noteContent.value).toBe('');
```
After the fix, `reset()` sets value to `null`, so this assertion needs to change to `toBe(null)` or use a falsy check.

### Current State — Category Label (AC2)

**File:** `frontend/src/app/features/expenses/components/category-select/category-select.component.ts`

The `CategorySelectComponent` is a standalone component with an inline template. Line 27:
```html
<mat-label>Category</mat-label>
```

Other required fields on the expense form (Amount, Date) show `*` after their labels. The Category dropdown is also required (`categoryId: ['', [Validators.required]]` at expense-form.component.ts line 268) but the label doesn't show the required indicator.

**Fix:** Simply change the label text to `Category *`.

### Project Structure Notes

- All changes are frontend-only
- Two components in separate feature areas:
  - `frontend/src/app/features/work-orders/components/work-order-notes/`
  - `frontend/src/app/features/expenses/components/category-select/`
- No new files needed — only modifications to existing component files
- No new dependencies required

### Testing Patterns to Follow

Per project-context.md:
- Spec files co-located with component files (both already exist)
- `describe/it` blocks with `vi.fn()` for mocks
- TestBed configuration in `beforeEach` with service mocks
- Import from `vitest`: `describe, it, expect, beforeEach, vi`
- Run tests: `npm test` from `/frontend`

### Estimated Test Changes

- **Modify:** 1 test (noteContent value assertion after add)
- **Add:** ~2 tests (noteContent pristine state, category label text)
- Very small test footprint matching "Tiny" effort estimate

### References

- [Source: epic-15-manual-testing-bug-fixes.md#Story 15.2]
- [Source: GitHub Issue #202 — note textarea shows validation error after clearing]
- [Source: GitHub Issue #205 — Category dropdown missing required indicator]
- [Source: frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.ts — line 412]
- [Source: frontend/src/app/features/expenses/components/category-select/category-select.component.ts — line 27]
- [Source: _bmad-output/project-context.md — Angular patterns, testing rules]

### Git Intelligence

Story 15.1 (Login Form Fixes) was just completed. Story 15.4 (UnlinkReceipt) is also done. This story is independent with no prerequisites.

## Dev Agent Record

### Implementation Plan
- Task 1: Replace `setValue('')` with `reset()` in `addNote()` success handler. Update existing test assertion from `''` to `null`, add pristine/untouched assertions. Add new test verifying pristine state after dirty/touched interaction.
- Task 2: Add `*` to Category label text. Update existing label assertion test.

### Completion Notes
- AC1: `noteContent.reset()` now correctly returns the textarea to its initial pristine/untouched state after note add, preventing the phantom validation error border (GitHub #202).
- AC2: Category dropdown label now shows `Category *` matching the pattern of other required fields (GitHub #205).
- All 2307 tests pass. Zero regressions. 1 test modified, 1 test added for Task 1. 1 test modified for Task 2.

## File List

- `frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.ts` — changed `setValue('')` to `reset()`
- `frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.spec.ts` — updated value assertion, added pristine state test
- `frontend/src/app/features/expenses/components/category-select/category-select.component.ts` — changed label to `Category *`
- `frontend/src/app/features/expenses/components/category-select/category-select.component.spec.ts` — updated label assertion
- `_bmad-output/implementation-artifacts/15-2-quick-fix-form-validation-bugs.md` — story file updates
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status tracking

## Change Log

- 2026-02-15: Implemented Story 15.2 — fixed note field reset (AC1) and added category required indicator (AC2)
