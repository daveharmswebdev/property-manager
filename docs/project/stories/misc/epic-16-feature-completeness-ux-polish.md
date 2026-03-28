# Epic 16: Feature Completeness & UX Polish

**Goal:** Close all open GitHub issues by bringing features to full parity, adding missing capabilities, and polishing rough UX edges discovered in production use.

**GitHub Issues:** #215, #216, #217, #218, #219, #220, #222, #223, #234, #235, #240, #241, #244, #250
**Deferred Issues:** #243 (vendor-to-receipt relationship — intentionally deferred)

**User Value:** "Every feature works completely, looks consistent, and I can manage my data from any view without workarounds"

---

## Story 16.1: Fix Date UTC Offset Bug

**GitHub Issue:** #217

**As a** property owner recording income and expenses,
**I want** dates to be saved exactly as I enter them,
**So that** my financial records are accurate for tax reporting.

**Acceptance Criteria:**

**AC1 — Income date preservation:**
**Given** I create an income entry with date 11/1/2025
**When** the entry is saved and redisplayed
**Then** the date shows 11/1/2025 (not Oct 31, 2025)

**AC2 — Expense date preservation:**
**Given** I create an expense entry with date 1/1/2026
**When** the entry is saved and redisplayed
**Then** the date shows 1/1/2026 (no day shift from UTC conversion)

**AC3 — Audit all date-only fields:**
**Given** any form with a date-only field (income, expense, work order)
**When** I submit the form
**Then** the date is sent as an ISO date string (`2025-11-01`) without time component, or normalized to noon UTC

**Prerequisites:** None

**Effort:** Small — date serialization fix across forms, potentially a shared date adapter

**Technical Notes:**
- Root cause: frontend sends `2025-11-01T00:00:00` local time, which shifts back a day when converted to UTC
- Fix: send date as `YYYY-MM-DD` string only, or use Angular Material `MAT_DATE_FORMATS` to strip time
- Backend already uses `DateOnly` for expense dates — verify income uses `DateOnly` too
- Audit all date fields: expense date, income date, work order dates

**Priority: HIGH** — Financial records stored with wrong dates impacts tax reporting accuracy.

---

## Story 16.2: Income Feature Parity

**GitHub Issues:** #218, #219

**As a** property owner tracking rental income,
**I want** to add, edit, and view income from the global income list,
**So that** I don't have to navigate through property detail to manage income.

**Acceptance Criteria:**

**AC1 — Add Income button on list page (#218):**
**Given** I am on the `/income` page
**When** I view the page header
**Then** I see an "Add Income" button (matching the Expenses page pattern)
**And** clicking it opens the income creation flow

**AC2 — Edit/Delete actions on list rows (#218):**
**Given** I am on the `/income` page
**When** I view an income row
**Then** I see edit and delete action icons
**And** clicking edit opens inline edit or navigates to detail view
**And** clicking delete shows confirmation then soft-deletes

**AC3 — Income detail view (#219):**
**Given** I click an income row in the global list
**When** the page navigates to `/income/:id`
**Then** I see full income details: amount, date, source, description, property

**AC4 — Edit all fields including property (#219):**
**Given** I am editing income at `/income/:id`
**When** I change the Property dropdown
**Then** the income is reassigned to the new property on save

**AC5 — Delete from detail view (#219):**
**Given** I am on the income detail page
**When** I click Delete and confirm
**Then** the income is soft-deleted and I navigate back to `/income`

**Prerequisites:** Story 16.1 (date fix should land first so new income entries have correct dates)

**Effort:** Medium-Large — mirrors the work done for Expense detail view in Story 15.5

**Technical Notes:**
- Check if `GET /api/v1/income/{id}` exists; if not, create it
- Model after `ExpenseDetailComponent` pattern from Story 15.5
- Property dropdown must be editable (unlike property workspace where it's locked)
- #218 "Add Income" button: follow same pattern as Expenses page "Add Expense" button

---

## Story 16.3: Desktop Receipt Upload

**GitHub Issue:** #234

**As a** property owner on desktop,
**I want** to upload receipts directly from the Receipts page,
**So that** I don't need my phone to capture receipts.

**Acceptance Criteria:**

**AC1 — Upload button in page header:**
**Given** I am on the `/receipts` page
**When** I view the page header
**Then** I see an "Upload Receipt" button (consistent with Properties/Expenses header pattern)

**AC2 — Drag-and-drop upload dialog:**
**Given** I click "Upload Receipt"
**When** the dialog opens
**Then** I see a drag-and-drop zone accepting JPEG, PNG, and PDF (max 10MB each)

**AC3 — Optional property assignment:**
**Given** I select files to upload
**When** the upload flow begins
**Then** I'm prompted to optionally assign a property (via existing PropertyTagModal)

**AC4 — Upload success:**
**Given** files are uploaded successfully
**When** the upload completes
**Then** receipts appear in the unprocessed queue (SignalR auto-pushes)
**And** a snackbar confirms success

**AC5 — Multi-file support:**
**Given** I select multiple files
**When** they upload
**Then** one receipt record is created per file

**Prerequisites:** None

**Effort:** Small-Medium — all backend exists, reuse `DragDropUploadComponent` + `ReceiptCaptureService` + `PropertyTagModalComponent`

**Technical Notes:**
- No backend changes needed — presigned URL flow, `ReceiptCaptureService`, SignalR all wired
- Configure `DragDropUploadComponent` with `accept="image/jpeg,image/png,application/pdf"`
- Nice-to-have: make the empty state itself a drop target

---

## Story 16.4: Expense-WorkOrder & Expense-Receipt Linking

**GitHub Issue:** #235

**As a** property owner editing an expense,
**I want** to link it to a work order and/or receipt,
**So that** my expenses are connected to the maintenance context and proof of purchase.

**Acceptance Criteria:**

**AC1 — Work order dropdown on detail edit form:**
**Given** I am editing an expense at `/expenses/:id`
**When** I view the edit form
**Then** I see a Work Order dropdown (optional) filtered to the expense's property
**And** saving persists the work order association

**AC2 — Work order dropdown resets on property change:**
**Given** I change the property on the expense edit form
**When** the property changes
**Then** the work order dropdown clears and reloads work orders for the new property

**AC3 — Link unprocessed receipt to existing expense:**
**Given** I am editing an expense with no linked receipt
**When** I click "Link Receipt"
**Then** I can select from unprocessed receipts (thumbnails)
**And** linking sets `Expense.ReceiptId`, `Receipt.ExpenseId`, and `Receipt.ProcessedAt`

**AC4 — Unlink receipt from detail edit:**
**Given** the expense has a linked receipt
**When** I click unlink
**Then** the receipt is unlinked and returned to the unprocessed queue

**Prerequisites:** None (unlink already fixed in Story 15.4)

**Effort:** Medium — work order dropdown is straightforward (inline edit already has it); receipt linking needs a new backend command

**Technical Notes:**
- **Work order (Part 1):** Copy pattern from `expense-edit-form.component.ts` which already has a work order dropdown
- **Receipt linking (Part 2):** New backend command `LinkReceiptToExpense` — set `Expense.ReceiptId`, `Receipt.ExpenseId`, `Receipt.ProcessedAt`. Validation: receipt must be unprocessed and belong to same account
- Receipt-Expense relationship is 1:1 — keep this constraint for now (see #235 design discussion)

---

## Story 16.5: UX Polish Bundle

**GitHub Issues:** #220, #222, #223

**As a** user performing common operations,
**I want** clear visual feedback and readable details,
**So that** the app feels polished and I always know what I'm acting on.

**Acceptance Criteria:**

**AC1 — Inline delete shows record details (#220):**
**Given** I click delete on an inline row (income, expense, etc.)
**When** the confirmation appears
**Then** I can see the key details of the record being deleted (e.g., "$1,500.00 on Nov 1, 2025")
**And** this pattern is consistent across all inline delete confirmations

**AC2 — Inline edit form visual separation (#222):**
**Given** I'm editing a record inline (income, expense workspace)
**When** the edit form appears between list rows
**Then** the form has visual distinction (border, shadow, or background shade) from surrounding rows
**And** this applies consistently to all inline edit forms

**AC3 — Receipt queue exact timestamp (#223):**
**Given** I view the receipt queue
**When** I look at a receipt item
**Then** I see the exact timestamp alongside the relative time (e.g., "about 1 month ago" + "Jan 14, 2026 3:42 PM")

**Prerequisites:** None

**Effort:** Small — CSS and template-only changes

**Technical Notes:**
- #220: Include record summary in delete confirmation prompt or keep row data visible behind confirmation overlay
- #222: Add `mat-elevation-z2` or a subtle border/background to inline edit form wrapper
- #223: Add secondary text line or tooltip with exact timestamp in `receipt-queue-item.component.ts`

---

## Story 16.6: Shared Component Extraction

**GitHub Issues:** #215, #216

**As a** developer maintaining the application,
**I want** reusable date range and total display components,
**So that** list views are consistent and changes only need to happen in one place.

**Acceptance Criteria:**

**AC1 — Shared date range selector (#215):**
**Given** any list view with date filtering
**When** it needs a date filter
**Then** it uses a shared `DateRangeFilterComponent` with presets (All Time, This Month, This Quarter, This Year, Custom Range)
**And** the Expenses and Income pages both use this shared component

**AC2 — Shared total amount display (#216):**
**Given** a list view showing financial records
**When** there is a filtered total to display
**Then** it uses a shared `ListTotalDisplayComponent` accepting a label and currency value
**And** both Income and Expenses list pages show their respective totals

**Prerequisites:** None (can be done anytime, but easier after Story 16.2 so income page is fully built)

**Effort:** Small-Medium — extract existing implementations into shared components, replace usages

**Technical Notes:**
- #215: Expense date range selector is the reference implementation — extract to `shared/components/date-range-filter/`
- #216: Income total display is the reference — extract to `shared/components/list-total-display/`
- Replace originals with shared component usages after extraction

---

## Story 16.7: Test Infrastructure — High-Priority Gaps

**GitHub Issue:** #212

**As a** development team,
**I want** coverage enforcement and E2E coverage for all core features,
**So that** regressions are caught before merge.

**Acceptance Criteria:**

**AC1 — Coverage gating in CI:**
**Given** a PR is submitted
**When** CI runs
**Then** coverage reports are uploaded to a coverage service (CodeCov or similar)
**And** PRs that drop below thresholds are flagged

**AC2 — Work Order E2E tests:**
**Given** the Work Orders feature is complete
**When** E2E tests run
**Then** work order CRUD, notes, photos, and vendor assignment flows are covered (currently 0 E2E tests)

**AC3 — Post-deploy smoke test:**
**Given** a deploy to production completes
**When** the CD pipeline finishes
**Then** a critical-path E2E subset runs against the deployed environment

**Prerequisites:** None

**Effort:** Medium — E2E test writing is the bulk, CI config changes are small

**Technical Notes:**
- From TEA assessment (#212): Work Orders have 18 unit test files but 0 E2E tests
- Coverage collected but never uploaded or gated in CI
- Consider CodeCov GitHub Action for coverage reporting
- Post-deploy smoke: run auth + property + expense create flows against prod URL

---

## Story 16.8: Wire Duplicate Expense Detection into Receipt Processing

**GitHub Issue:** #244

**As a** property owner processing receipts into expenses,
**I want** the system to warn me if I'm about to create a duplicate expense,
**So that** I don't accidentally record the same expense twice from a receipt.

**Acceptance Criteria:**

**AC1 — Duplicate check before receipt-to-expense creation:**
**Given** I process a receipt into an expense
**When** the system is about to create the expense
**Then** it calls `GET /api/v1/expenses/check-duplicate` with the propertyId, amount, and date
**And** if a match is found (same property + amount + date within ±1 day), the `DuplicateWarningDialogComponent` is shown

**AC2 — User can proceed or cancel on duplicate warning:**
**Given** the duplicate warning dialog is shown during receipt processing
**When** I choose "Create Anyway"
**Then** the expense is created normally
**When** I choose "Cancel"
**Then** the expense is not created and the receipt remains unprocessed

**AC3 — No warning when no duplicate exists:**
**Given** I process a receipt into an expense with no matching existing expense
**When** the duplicate check completes
**Then** no dialog is shown and the expense is created immediately

**Prerequisites:** None

**Effort:** Small — all backend and UI components exist, this is purely wiring

**Technical Notes:**
- Backend endpoint already working: `GET /api/v1/expenses/check-duplicate` (propertyId, amount, date)
- Frontend service already implemented: `ExpenseService.checkDuplicateExpense()`
- Dialog already built: `DuplicateWarningDialogComponent`
- Gap: receipt processing component does not call the duplicate check before expense creation
- Wire in the same pattern used in `expense-form.component.ts`: check duplicate → show dialog if match → proceed or cancel
- Label: **bug** — this is a wiring gap in existing functionality

---

## Story 16.9: Receipt Thumbnail Reactivity After Upload

**GitHub Issue:** #241

**As a** property owner uploading receipts,
**I want** to see the actual thumbnail once it's available,
**So that** I can visually confirm my receipt was captured correctly without refreshing the page.

**Acceptance Criteria:**

**AC1 — Thumbnail displays after upload without page refresh:**
**Given** I upload a receipt photo (desktop or mobile)
**When** the thumbnail has been generated server-side
**Then** the receipt list item displays the actual thumbnail, not a placeholder

**AC2 — Placeholder shown only while thumbnail is generating:**
**Given** I just uploaded a receipt
**When** the thumbnail is still being generated
**Then** a placeholder is shown with a visual loading indicator
**And** once the thumbnail is ready, the placeholder is replaced automatically

**AC3 — SignalR-delivered receipts show thumbnails:**
**Given** a receipt arrives via SignalR WebSocket notification
**When** the receipt appears in the list
**Then** the thumbnail is displayed if available, or updates reactively once available

**Prerequisites:** None

**Effort:** Small-Medium — requires either polling, SignalR extension, or delayed thumbnail fetch

**Technical Notes:**
- Thumbnails generated server-side via SixLabors.ImageSharp, stored in S3
- Receipt images served via presigned URLs (15-min expiry)
- SignalR already in use — could extend `ReceiptProcessed` or add `ThumbnailReady` event
- Alternative: after upload, poll the receipt endpoint every 2-3s until thumbnailUrl is populated (simpler)
- @ngrx/signals store could hold thumbnail state and react to availability changes

---

## Story 16.10: Unify Income List in Property Detail

**GitHub Issue:** #240

**As a** property owner viewing income for a specific property,
**I want** the property detail income list to use the same table format as the main income page,
**So that** the experience is consistent and I have full edit/delete capability from both views.

**Acceptance Criteria:**

**AC1 — Table format with column headers:**
**Given** I am on `/properties/:id` viewing the income section
**When** the income list renders
**Then** it uses a table with column headers: Date, Source, Description, Amount, Actions
**And** the Property column is omitted (context is already single-property)

**AC2 — Edit and delete actions per row:**
**Given** I am viewing the property detail income table
**When** I look at a row
**Then** I see edit (pencil) and delete (trash) action icons matching the main income page pattern

**AC3 — Consistent styling:**
**Given** I compare the property detail income table with the main income table
**When** I view both
**Then** styling, spacing, and interaction patterns are consistent

**Prerequisites:** Story 16.2 (income feature parity — build the full income table first, then reuse here)

**Effort:** Small — reuse/extract the income table component built in 16.2

**Technical Notes:**
- Current property detail uses card-style list under "Previous Income" heading
- After 16.2 builds the full income table, extract it as a shared component or reuse directly
- Pairs well with 16.6 (shared component extraction)
- Low priority — business value ~4-5/10, UI consistency improvement

---

## Story 16.11: Align Expense & Income Filter Cards

**GitHub Issue:** #250

**As a** property owner filtering expenses and income,
**I want** both list views to have consistent filter capabilities,
**So that** I can search, filter by property, and see totals in the same way regardless of which list I'm viewing.

**Acceptance Criteria:**

**AC1 — Income list: add search field:**
**Given** I am on the `/income` page
**When** I view the filter card
**Then** I see a search text field that filters on source and description columns
**And** styling matches the existing search field on the expenses list

**AC2 — Expenses list: move total inside filter card:**
**Given** I am on the `/expenses` page
**When** I view the filter card
**Then** "Total Expenses: $X" is displayed inside the filter card
**And** layout matches the income list's "Total Income" display

**AC3 — Expenses list: add property filter:**
**Given** I am on the `/expenses` page
**When** I view the filter card
**Then** I see a "Property" dropdown with "All Properties" as default
**And** selecting a property filters the expense list to that property only
**And** styling matches the property filter on the income list

**AC4 — Both filter cards reach parity:**
**Given** both filter cards are updated
**When** I compare expenses and income filter cards
**Then** both contain: Date Range, Property dropdown, Search field, Total display
**And** the only difference is the Category dropdown (expenses only)

**Prerequisites:** None (can be done independently, but pairs naturally with 16.6)

**Effort:** Medium — three distinct UI changes across two components, plus backend property filtering on expenses if not already supported

**Technical Notes:**
- Income search: add `MatFormField` + input to income filter card, wire to store filtering on `source` and `description`
- Expenses total: move total display from outside the `mat-card` to inside, matching income's placement
- Expenses property filter: add property dropdown (reuse pattern from income list), wire to query params
- Check if `GET /api/v1/expenses` already supports `propertyId` query param — if not, add it
- Pairs well with 16.6 (shared component extraction) — could extract a unified filter card component after both lists reach parity

---

## Deferred: Direct Vendor-to-Receipt Relationship

**GitHub Issue:** #243

**Status:** Intentionally deferred. The indirect path through work orders (receipt → work order → vendor) covers the primary use case. No action until beta testers surface a need for direct vendor-receipt linkage. This documents that the relationship was considered and intentionally deferred — not overlooked.

---

## Epic 16 Summary

| Story | Title | GitHub Issues | Effort | Prerequisites |
|-------|-------|---------------|--------|---------------|
| 16.1 | Fix Date UTC Offset Bug | #217 | Small | None |
| 16.2 | Income Feature Parity | #218, #219 | Medium-Large | 16.1 |
| 16.3 | Desktop Receipt Upload | #234 | Small-Medium | None |
| 16.4 | Expense-WO & Receipt Linking | #235 | Medium | None |
| 16.5 | UX Polish Bundle | #220, #222, #223 | Small | None |
| 16.6 | Shared Component Extraction | #215, #216 | Small-Medium | 16.2 (preferred) |
| 16.7 | Test Infrastructure Gaps | #212 | Medium | None |
| 16.8 | Wire Duplicate Detection into Receipt Flow | #244 | Small | None |
| 16.9 | Receipt Thumbnail Reactivity | #241 | Small-Medium | None |
| 16.10 | Unify Income List in Property Detail | #240 | Small | 16.2 |
| 16.11 | Align Expense & Income Filter Cards | #250 | Medium | None |
| — | Deferred: Vendor-to-Receipt Relationship | #243 | — | Deferred |

**Dependencies:**
- 16.1 → 16.2 (fix dates before building new income forms)
- 16.2 → 16.10 (build income table first, then reuse in property detail)
- 16.6 waits for 16.2 (extract after income page is built)
- 16.3, 16.4, 16.5, 16.7, 16.8, 16.9, 16.11 are independent — can run in parallel

**Recommended priority order:** 16.1 (High severity) → 16.8 (bug fix, small) → 16.5 (quick wins) → 16.3 (receipt upload) → 16.9 (receipt thumbnails) → 16.4 (linking) → 16.11 (filter card alignment) → 16.2 (income parity) → 16.10 (income list unification) → 16.6 (extraction) → 16.7 (test infra)

**Note:** GitHub issues #202 and #205 are still open but were completed in Epic 15.2 — they should be closed.

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-22 (updated — added Stories 16.8-16.11 from GitHub issues #240, #241, #244, #250; deferred #243)_
_For: Dave_
_Project: property-manager_
