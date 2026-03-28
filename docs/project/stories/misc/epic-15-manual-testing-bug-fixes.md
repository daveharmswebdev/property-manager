# Epic 15: Manual Testing Bug Fixes

**Goal:** Resolve all bugs and UX gaps discovered during manual testing (GitHub Issues #198-#210, excluding feature PRs #201, #203, #209 which belong to Epic 14).

**GitHub Issues:** #198, #199, #200, #202, #204, #205, #206, #207, #208, #210

**User Value:** "The app works correctly and consistently — the bugs I found during testing are fixed"

---

## Story 15.1: Login Form Fixes

**GitHub Issues:** #198, #199, #200

**As a** user logging into the application,
**I want** the login form to validate email properly, not show dead UI, and redirect me to where I was going,
**So that** the login experience is clean and functional.

**Acceptance Criteria:**

**AC1 — Stricter email validation (#198):**
**Given** I enter an email without a TLD (e.g., `user@g`)
**When** I attempt to submit the login form
**Then** a field-level validation error appears before the form submits to the server

**AC2 — Remove "Remember me" checkbox (#199):**
**Given** I am on the login page
**When** I view the form
**Then** there is no "Remember me" checkbox (sessions are already persistent via HttpOnly refresh cookies)

**AC3 — Honor returnUrl after login (#200):**
**Given** I am redirected to `/login?returnUrl=%2Fproperties`
**When** I log in successfully
**Then** I am redirected to `/properties` (the returnUrl value), not hardcoded `/dashboard`

**Given** the returnUrl is an absolute URL or external domain
**When** I log in
**Then** the returnUrl is rejected and I am redirected to `/dashboard` (open redirect protection)

**Prerequisites:** None

**Technical Notes:**
- All changes in `login.component.ts` and `login.component.html`
- #198: Add `Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)` alongside existing `Validators.email`
- #199: Remove `rememberMe` form control, `<mat-checkbox>`, and `MatCheckboxModule` import if unused
- #200: Inject `ActivatedRoute`, read `returnUrl` query param in success handler, sanitize to relative paths only
- Update unit tests for all three changes

---

## Story 15.2: Quick-Fix Form Validation Bugs

**GitHub Issues:** #202, #205

**As a** user interacting with forms,
**I want** validation states to be correct and required fields clearly marked,
**So that** I'm not confused by phantom errors or missing indicators.

**Acceptance Criteria:**

**AC1 — Note field resets cleanly after add (#202):**
**Given** I add a note to a work order successfully
**When** the note is created and the field clears
**Then** the textarea is in a pristine state with no validation error border

**AC2 — Category required indicator (#205):**
**Given** I am on the New Expense form
**When** I view the Category dropdown label
**Then** it displays `Category *` matching the pattern of other required fields (Amount, Date)

**Prerequisites:** None

**Technical Notes:**
- #202: In `work-order-notes.component.ts` line ~412, change `this.noteContent.setValue('')` to `this.noteContent.reset()`
- #205: Add required indicator to Category `mat-label` in expense form template

---

## Story 15.3: Expense List UX Improvements

**GitHub Issues:** #204, #206, #207

**As a** property owner viewing my expenses,
**I want** to create expenses from the list page, have my filters persist, and sort by columns,
**So that** the expense list is fully functional and not read-only.

**Acceptance Criteria:**

**AC1 — Add Expense button (#204):**
**Given** I am on the `/expenses` page
**When** I look at the page header area
**Then** I see an "Add Expense" button
**And** clicking it opens the create expense flow

**AC2 — Custom date range persistence (#206):**
**Given** I set a custom date range filter and navigate away
**When** I navigate back to the Expenses page
**Then** the From/To date picker inputs repopulate with my previously selected dates

**Given** I refresh the page
**When** the Expenses page loads
**Then** the custom date range is restored (via URL params or session storage)

**AC3 — Column sorting (#207):**
**Given** I am on the Expenses list page
**When** I click a column header (Date, Amount, Category, Property, Description)
**Then** the table sorts by that column with a visible sort direction indicator
**And** clicking again toggles ascending/descending

**Prerequisites:** None

**Technical Notes:**
- #204: Add FAB or header button on expenses list page, route to create expense form/dialog
- #206: Persist custom date range in URL query params or sessionStorage; restore on component init
- #207: Add `MatSort` directive to the `mat-table`, implement `matSort` on column headers

---

## Story 15.4: Fix Unlink Receipt Backend Bug

**GitHub Issue:** #210

**As a** property owner managing receipts,
**I want** to unlink a receipt from an expense,
**So that** I can reprocess or reassign receipts when needed.

**Acceptance Criteria:**

**Given** an expense has a linked receipt
**When** I call `DELETE /api/v1/expenses/{id}/receipt`
**Then** the receipt is unlinked from the expense (Expense.ReceiptId set to null)
**And** the S3 file is cleaned up if applicable
**And** the response is 204 No Content

**Given** an expense has no linked receipt
**When** I call `DELETE /api/v1/expenses/{id}/receipt`
**Then** the response is 404 with appropriate error message

**Prerequisites:** None

**Technical Notes:**
- **Root cause:** `UnlinkReceipt.cs` queries `Receipt.ExpenseId` but the FK is actually `Expense.ReceiptId` (FK is on Expense side per `ExpenseConfiguration.cs` lines 71-74)
- **Fix:** Replace the broken query with `_dbContext.Expenses.Include(e => e.Receipt).FirstOrDefaultAsync(e => e.Id == request.ExpenseId)`
- Then get `receipt = expense.Receipt` instead of querying Receipts table directly
- **Severity: High** — blocks receipt reprocessing workflow
- Update/add integration tests for both success and not-found cases

---

## Story 15.5: Expense Detail/Edit View

**GitHub Issue:** #208

**As a** property owner,
**I want** a dedicated expense detail/edit page at `/expenses/:id`,
**So that** I can view, edit (including reassigning property), and delete any expense from the global expense list.

**Acceptance Criteria:**

**AC1 — Navigation from expense list:**
**Given** I am on the `/expenses` page
**When** I click an expense row (or a view/edit icon)
**Then** I am navigated to `/expenses/:id`

**AC2 — Detail view:**
**Given** I am on `/expenses/:id`
**When** the page loads
**Then** I see all expense fields: Amount, Date, Category, Description, Property, linked Receipt (with image preview), linked Work Order

**AC3 — Edit all fields including property:**
**Given** I am editing an expense
**When** I change the Property dropdown
**Then** the expense is reassigned to the new property on save

**AC4 — Delete from detail view:**
**Given** I am on the expense detail page
**When** I click Delete and confirm
**Then** the expense is soft-deleted and I am navigated back to `/expenses`

**AC5 — Unlink receipt from detail view:**
**Given** the expense has a linked receipt
**When** I click an unlink/remove receipt action
**Then** the receipt is unlinked (depends on Story 15.4 fix)

**Prerequisites:** Story 15.4 (for receipt unlinking)

**Technical Notes:**
- **This is purely frontend** — all backend endpoints exist (`GET/PUT/DELETE /api/v1/expenses/{id}`, `DELETE /api/v1/expenses/{id}/receipt`)
- New route: `/expenses/:id` → `ExpenseDetailComponent`
- Reuse existing expense form patterns from property expense workspace
- Key difference from property workspace: property dropdown must be included and editable
- Add navigation from expense list rows
- Blocked test cases: TC-EXP-012 through TC-EXP-016

---

## Epic 15 Summary

| Story | Title | GitHub Issues | Effort | Prerequisites |
|-------|-------|---------------|--------|---------------|
| 15.1 | Login Form Fixes | #198, #199, #200 | Small | None |
| 15.2 | Quick-Fix Form Validation Bugs | #202, #205 | Tiny | None |
| 15.3 | Expense List UX Improvements | #204, #206, #207 | Medium | None |
| 15.4 | Fix Unlink Receipt Backend Bug | #210 | Small | None |
| 15.5 | Expense Detail/Edit View | #208 | Large | 15.4 |

**Stories:** 5 | **Stories 15.1-15.4 are independent — can be worked in parallel. Story 15.5 depends on 15.4.**

**Recommended priority order:** 15.4 (High severity) → 15.2 (quick wins) → 15.1 (login cleanup) → 15.3 (expense list) → 15.5 (large feature)

**Epic 15 Milestone:** Fix all bugs found during manual testing. Ship a stable, polished experience.

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-15_
_For: Dave_
_Project: property-manager_
