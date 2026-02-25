# Epic 17: Tech Debt, Bug Fixes & UX Consistency

**Goal:** Fix all bugs found during manual testing, close UX consistency gaps between features, and deliver missing capabilities discovered through real usage.

**GitHub Issues:** #244, #265, #266, #267, #268, #269, #270, #271, #272, #273, #274, #275, #276, #277, #278, #279

**User Value:** "Every form works correctly, every list behaves consistently, and I don't hit visual glitches or dead ends when managing my properties"

---

## Story 17.1: CSS Dialog & Label Fixes

**GitHub Issues:** #273, #275, #278

**As a** user interacting with dialogs,
**I want** all form labels and text to be fully visible and readable,
**So that** I can see what I'm filling in without guessing.

**Acceptance Criteria:**

**AC1 — Inline Add Vendor dialog label fix (#273):**
**Given** I open the "Add New Vendor" dialog from the Work Order form
**When** the dialog renders
**Then** the "First Name*" label is fully visible and not clipped by the card header

**AC2 — Schedule E Reports modal label fix (#275):**
**Given** I open "Generate All Schedule E Reports" from the Reports page
**When** the dialog renders
**Then** the "Tax Year" label is fully visible and not clipped by the dialog header

**AC3 — Link Expense dialog text contrast (#278):**
**Given** I open "Link Existing Expense" from a Work Order detail page
**When** the expense list renders
**Then** the expense date and category text have sufficient contrast (WCAG AA minimum)
**And** all three lines (date, description, category) are fully visible without clipping

**Prerequisites:** None

**Effort:** XS — CSS padding/margin and color fixes only

**Technical Notes:**
- #273 and #275 share the same root cause: insufficient padding between dialog title and first form field; `mat-form-field` outline label floats into header area
- Fix: add `padding-top` or `margin-top` to dialog content area, or increase gap between title and first field
- #278: change `.expense-date` and `.expense-category` from `color: var(--mat-sys-outline)` to a higher-contrast variable (e.g., `var(--mat-sys-on-surface-variant)`)
- Consider a shared dialog content spacing rule to prevent this class of bug in future dialogs

---

## Story 17.2: Form Behavior Fixes — Vendor Edit

**GitHub Issues:** #272, #265

**As a** user editing vendor information,
**I want** the save button to reflect actual changes and inputs to behave predictably,
**So that** I don't submit no-op updates or fight with form fields.

**Acceptance Criteria:**

**AC1 — Save button disabled on pristine form (#272):**
**Given** I navigate to Edit Vendor and the form loads with existing data
**When** I have not changed any field
**Then** the "Save Changes" button is disabled
**And** the button enables only after I modify at least one field value

**AC2 — Phone number input mask (#265):**
**Given** I am editing a vendor's phone number
**When** I type digits into the phone number field
**Then** the input formats as `(XXX) XXX-XXXX` as I type
**And** stored value is digits-only for API submission

**AC3 — Trade tag input clears after creation (#265):**
**Given** I type a tag name in the Trade Tags input and create a tag
**When** the chip appears in the tag list
**Then** the text input field is cleared automatically
**And** I can immediately type another tag name

**Prerequisites:** None

**Effort:** S — button disabled binding + input mask directive + chip input clear

**Technical Notes:**
- #272: Add `[disabled]="!form.dirty || form.invalid"` to Save button in vendor edit form
- #265 phone mask: use Angular CDK or a lightweight mask directive; display formatted, store raw digits
- #265 tag clear: after `MatChipInput` event fires, reset the input value with `input.value = ''` and clear the `FormControl`
- Check if the phone mask approach should be reused in vendor create flow as well

---

## Story 17.3: Work Order List Refresh After Delete

**GitHub Issue:** #269

**As a** user managing work orders,
**I want** the work order list to update immediately after I delete a work order,
**So that** I don't see stale data or need to manually refresh the page.

**Acceptance Criteria:**

**AC1 — List updates after delete:**
**Given** I am on the Work Orders list (`/work-orders`)
**When** I delete a work order and the API confirms success
**Then** the deleted work order is immediately removed from the list
**And** the total count updates accordingly

**AC2 — No full page reload required:**
**Given** the delete succeeds
**When** the list updates
**Then** my scroll position and any active filters are preserved

**Prerequisites:** None

**Effort:** S — store not removing item from local state after successful API delete

**Technical Notes:**
- Root cause: work order store delete handler likely calls API but doesn't `patchState()` to remove the item from `items` array, or doesn't re-fetch
- Reference implementation: income store delete pattern — remove item from local array or re-trigger list fetch
- Pattern: `patchState(store, { items: store.items().filter(i => i.id !== id) })` after successful delete

---

## Story 17.4: Expenses List Actions Column

**GitHub Issue:** #267

**As a** property owner managing expenses,
**I want** edit and delete actions directly on each expense row,
**So that** I can manage expenses without navigating to the detail page.

**Acceptance Criteria:**

**AC1 — Actions column with edit and delete:**
**Given** I am on the `/expenses` page
**When** I view the expense table
**Then** I see an "Actions" column with edit (pencil icon) and delete (trash icon) buttons per row

**AC2 — Edit navigates to detail/edit:**
**Given** I click the edit icon on an expense row
**When** the action fires
**Then** I am navigated to `/expenses/:id` in edit mode

**AC3 — Delete with confirmation:**
**Given** I click the delete icon on an expense row
**When** the confirmation dialog appears and I confirm
**Then** the expense is soft-deleted and removed from the list
**And** a snackbar confirms the deletion

**Prerequisites:** None

**Effort:** S — frontend-only, follow existing Income table actions pattern

**Technical Notes:**
- Reference: Income table already has this exact pattern with Actions column header + pencil + trash icons
- Add `actions` to `displayedColumns` array
- Add `<ng-container matColumnDef="actions">` with icon buttons
- Wire edit button to `router.navigate(['/expenses', expense.id])`
- Wire delete to existing store delete method with confirmation dialog

---

## Story 17.5: Work Order Linked Expenses — Clickable Rows & Actions

**GitHub Issue:** #266

**As a** property owner viewing a work order's linked expenses,
**I want** to click expense rows to navigate to the expense detail and have edit/delete actions available,
**So that** I can manage linked expenses without leaving the work order context or navigating manually.

**Acceptance Criteria:**

**AC1 — Clickable expense rows:**
**Given** I am on a Work Order detail page viewing the Linked Expenses section
**When** I click on an expense row
**Then** I navigate to `/expenses/:id` for that expense

**AC2 — Actions column (edit, delete, unlink):**
**Given** I view the Linked Expenses list
**When** I look at the actions area per row
**Then** I see edit (pencil), delete (trash), and unlink action icons
**And** the existing unlink icon is retained

**AC3 — Delete removes expense:**
**Given** I click delete on a linked expense
**When** I confirm the deletion
**Then** the expense is soft-deleted
**And** it disappears from both the linked expenses list and the global expenses list

**Prerequisites:** None

**Effort:** S — frontend template + click handler changes

**Technical Notes:**
- Add `routerLink` or `(click)` handler to expense rows pointing to `/expenses/:id`
- Add edit and delete icons alongside existing unlink icon
- Delete should call expense store delete, then refresh the linked expenses list
- Match the action icon pattern used in the income table

---

## Story 17.6: Wire Duplicate Expense Detection into Receipt Processing

**GitHub Issue:** #244

**As a** property owner processing receipts into expenses,
**I want** the system to warn me if I'm about to create a duplicate expense,
**So that** I don't accidentally record the same expense twice from a receipt.

**Acceptance Criteria:**

**AC1 — Duplicate check before receipt-to-expense creation:**
**Given** I process a receipt into an expense
**When** the system is about to create the expense
**Then** it calls `GET /api/v1/expenses/check-duplicate` with propertyId, amount, and date
**And** if a match is found (same property + amount + date within +/-1 day), the `DuplicateWarningDialogComponent` is shown

**AC2 — User can proceed or cancel:**
**Given** the duplicate warning dialog is shown
**When** I choose "Create Anyway" **Then** the expense is created normally
**When** I choose "Cancel" **Then** the expense is not created and the receipt remains unprocessed

**AC3 — No warning when no duplicate:**
**Given** no matching expense exists
**When** the duplicate check completes
**Then** no dialog is shown and the expense is created immediately

**Prerequisites:** None

**Effort:** S — all backend and UI components exist, this is purely wiring

**Technical Notes:**
- Backend endpoint working: `GET /api/v1/expenses/check-duplicate`
- Frontend service exists: `ExpenseService.checkDuplicateExpense()`
- Dialog exists: `DuplicateWarningDialogComponent`
- Wire same pattern as `expense-form.component.ts`: check duplicate -> show dialog if match -> proceed or cancel
- **Note:** This was Story 16.8 but was not completed in Epic 16 — carried forward

---

## Story 17.7: Vendor Detail — Work Order History

**GitHub Issue:** #268

**As a** property owner viewing a vendor's profile,
**I want** to see all work orders assigned to that vendor,
**So that** I can evaluate their work history and track ongoing assignments.

**Acceptance Criteria:**

**AC1 — Backend returns work orders in vendor detail response:**
**Given** I request `GET /api/v1/vendors/:id`
**When** the response returns
**Then** it includes a `workOrders` array with each work order's id, title, status, createdAt, and propertyName

**AC2 — Work order history section on vendor detail page:**
**Given** I am on a vendor detail page
**When** work orders exist for this vendor
**Then** I see a "Work Order History" section listing all assigned work orders
**And** each item shows title, status badge, property name, and date

**AC3 — Clickable work orders:**
**Given** I view the work order history list
**When** I click a work order item
**Then** I navigate to `/work-orders/:id`

**AC4 — Empty state:**
**Given** I view a vendor with no assigned work orders
**When** the page renders
**Then** I see "No work orders assigned" or similar empty state message

**Prerequisites:** None

**Effort:** M — backend query change (join WorkOrders), DTO update, frontend display section

**Technical Notes:**
- Backend: Update `GetVendorDetail` query handler to `.Include(v => v.WorkOrders)` and map to a `VendorWorkOrderDto`
- DTO needs: id, title, status, createdAt, property name (may need to join through WorkOrder -> Property)
- Frontend: Add work order history section to vendor detail component
- Consider reusing work order list row styling for consistency

---

## Story 17.8: Full-Size Add Vendor Form

**GitHub Issue:** #274

**As a** user creating a vendor from the Vendors list page,
**I want** a full-size creation form with all vendor fields,
**So that** I can enter complete vendor details upfront without using the limited inline dialog.

**Acceptance Criteria:**

**AC1 — Full-size form from Vendor list:**
**Given** I am on the Vendors list page (`/vendors`)
**When** I click "+ Add Vendor"
**Then** I see a full-size vendor creation form (not the compact inline dialog)
**And** the form includes: first name, middle name, last name, phone numbers, email addresses, and trade tags

**AC2 — Form matches Edit Vendor layout:**
**Given** I compare the new Add Vendor form with the Edit Vendor form
**When** I view both
**Then** they have the same layout, field sizing, and section organization

**AC3 — Inline dialog unchanged for Work Orders:**
**Given** I am creating a Work Order and click "Add New Vendor"
**When** the inline dialog opens
**Then** it remains the compact form (unchanged — designed for speed in that context)

**Prerequisites:** None

**Effort:** M — route to a full form page or open a full-size dialog, reusing Edit Vendor form structure

**Technical Notes:**
- Option A: Create a `/vendors/new` route that renders the same form component as Edit Vendor, in "create" mode
- Option B: Open a full-size `MatDialog` with the complete form
- Option A is preferred — matches the pattern of other create flows (create expense, create work order)
- The compact inline dialog in work order form stays as-is — it's intentionally minimal for that context

---

## Story 17.9: PhotoUpload Multi-File Support

**GitHub Issue:** #276

**As a** property owner uploading photos,
**I want** to select or drag-drop multiple files at once,
**So that** I don't have to upload photos one at a time.

**Acceptance Criteria:**

**AC1 — File input supports multi-select:**
**Given** I click the upload area to open the file chooser
**When** the file dialog opens
**Then** I can select multiple files (Cmd/Ctrl+click or Shift+click)

**AC2 — Drag-and-drop processes all files:**
**Given** I drag multiple files onto the upload area
**When** I drop them
**Then** all files are processed and uploaded, not just the first

**AC3 — Individual file validation:**
**Given** I select 5 files where 1 exceeds the size limit
**When** validation runs
**Then** the 4 valid files are uploaded
**And** the invalid file shows an error message

**AC4 — Upload feedback per file:**
**Given** multiple files are uploading
**When** the upload is in progress
**Then** I see progress/status feedback for each file

**AC5 — Mobile camera capture not broken:**
**Given** I am on a mobile device using the camera to capture a photo
**When** I take a single photo
**Then** it uploads correctly (single-file flow preserved)

**Prerequisites:** None

**Effort:** M — fix drop handler + file input + loop processing, reference `DragDropUploadComponent`

**Technical Notes:**
- Add `multiple` attribute to `<input type="file">` in `photo-upload.component.ts`
- Change `onDrop()` from `handleFile(files[0])` to `Array.from(files).forEach(f => handleFile(f))`
- Change `onFileSelected()` similarly to process all files
- Reference: `DragDropUploadComponent` already handles multi-file correctly — adapt that pattern
- Consider sequential upload (one at a time) vs parallel — sequential is safer for S3 presigned URL flow
- `capture="environment"` on mobile may conflict with `multiple` — test on iOS/Android

---

## Story 17.10: Inline Status Dropdown on Work Order Detail

**GitHub Issue:** #277

**As a** property owner managing work orders,
**I want** to change a work order's status directly from the detail view without entering edit mode,
**So that** I can quickly update status as work progresses (Reported -> Assigned -> Completed).

**Acceptance Criteria:**

**AC1 — Status badge replaced with dropdown:**
**Given** I am on a Work Order detail page
**When** the page renders
**Then** I see an interactive status dropdown (mat-select) below the Description card, replacing the read-only badge

**AC2 — Immediate API update on change:**
**Given** I select a new status from the dropdown
**When** the selection changes
**Then** an API call fires immediately to update the status (no save button)
**And** a snackbar confirms success

**AC3 — Revert on failure:**
**Given** I change the status and the API call fails
**When** the error is received
**Then** the dropdown reverts to the previous value
**And** an error snackbar is shown

**AC4 — Status color coding preserved:**
**Given** the dropdown displays the current status
**When** I view or interact with it
**Then** status options have appropriate color coding (matching existing badge colors)

**AC5 — Edit form stays in sync:**
**Given** I change status via the inline dropdown
**When** I then open the Edit form
**Then** the status field in the edit form reflects the updated value

**Prerequisites:** None

**Effort:** M — new component section, API call on change, optimistic/rollback UX

**Technical Notes:**
- Remove the `<span class="status-badge">` from above the heading
- Add `<mat-select>` with statuses: Reported, Assigned, Completed
- Reuse existing `UpdateWorkOrderCommand` endpoint — send only status change
- Consider a dedicated lightweight PATCH endpoint if full update has side effects, but reusing the existing endpoint is simpler
- Wire `(selectionChange)` to call API, store previous value for rollback
- Layout: place between Description card and Details card per the issue mockup

---

## Story 17.11: Work Order List — Primary Photo Thumbnail

**GitHub Issue:** #270

**As a** property owner browsing work orders,
**I want** to see a photo thumbnail for each work order in the list,
**So that** I can visually identify work orders at a glance.

**Acceptance Criteria:**

**AC1 — Thumbnail displayed in work order list:**
**Given** I am on the Work Orders list (`/work-orders`)
**When** a work order has photos
**Then** the primary photo thumbnail is displayed in the row

**AC2 — Placeholder for no-photo work orders:**
**Given** a work order has no photos
**When** the list renders
**Then** a placeholder icon is shown (e.g., `mat-icon: build` or camera icon)

**AC3 — Backend includes thumbnail URL:**
**Given** the `GET /api/v1/work-orders` response
**When** work orders have photos
**Then** the response includes a `primaryPhotoThumbnailUrl` field

**Prerequisites:** None

**Effort:** M — backend DTO change (include primary photo URL in list response), frontend thumbnail column

**Technical Notes:**
- Backend: Update `GetAllWorkOrders` query to include primary photo thumbnail URL in the DTO
- Join through `WorkOrderPhotos` → filter for primary/first photo → include S3 thumbnail URL
- Frontend: Add a thumbnail column to the work order list component (match Properties list pattern)
- Use `<img>` with fallback to `mat-icon` placeholder
- Consider lazy loading thumbnails for performance

---

## Story 17.12: Replace Global Year Selector with Dashboard Date Range Filter

**GitHub Issue:** #279

**As a** property owner viewing financial summaries,
**I want** date range filters on the dashboard and property detail pages instead of a global year selector,
**So that** I can see financial data for any time period and filters don't silently conflict with each other.

**Acceptance Criteria:**

**AC1 — Year selector removed from sidebar:**
**Given** I view the application sidebar
**When** the sidebar renders
**Then** the year selector is no longer present

**AC2 — Dashboard date range filter:**
**Given** I am on the Dashboard
**When** I view the page
**Then** I see an inline `DateRangeFilterComponent` with presets: This Month, This Quarter, This Year (default), Last Year, Custom
**And** the summary totals (Total Expenses, Total Income, Net Income) respect the selected range

**AC3 — Property detail date range filter:**
**Given** I am on a Property detail page
**When** I view the financial summary cards
**Then** a local `DateRangeFilterComponent` controls YTD Expenses, YTD Income, Net Income
**And** labels update based on range (e.g., drop "YTD" for custom ranges)

**AC4 — Properties list date range filter:**
**Given** I am on the Properties list
**When** I view per-property financial summaries
**Then** they respect a local date range filter

**AC5 — Income list decoupled from global year:**
**Given** I am on the Income list with its own date range filter
**When** I select a date range
**Then** only the local date range filter applies — no global year interference
**And** the `yearEffect` watching `YearSelectorService` is removed

**AC6 — Report dialogs unaffected:**
**Given** I open a Schedule E report dialog
**When** the dialog loads
**Then** it still has its own year selector and works independently (no regression)

**AC7 — Cleanup:**
**Given** all consumers are migrated
**When** migration is complete
**Then** `YearSelectorService`, `YearSelectorComponent`, and localStorage key `propertyManager.selectedYear` are removed

**Prerequisites:** None

**Effort:** L — multi-page refactor, backend must accept `dateFrom`/`dateTo` params on property and dashboard endpoints, service and component removal

**Technical Notes:**
- **Phase 1 — Backend:** Add `dateFrom`/`dateTo` query params to `GET /properties` and `GET /properties/:id` endpoints (alongside existing `year` param for backwards compat initially)
- **Phase 2 — Dashboard:** Add `DateRangeFilterComponent` to dashboard, wire to property store with date range params
- **Phase 3 — Property detail:** Add `DateRangeFilterComponent`, update financial card queries
- **Phase 4 — Income decoupling:** Remove `yearEffect` from `income.component.ts`, stop sending `year` param when `dateFrom`/`dateTo` present
- **Phase 5 — Cleanup:** Remove `YearSelectorService`, `YearSelectorComponent`, sidebar references, specs, localStorage
- The expenses list already uses `DateRangeFilterComponent` without year dependency — that's the target pattern
- Report dialogs already have their own year selectors — no changes needed
- Consider splitting into sub-stories (17.12a-e) if needed during story creation

---

## Story 17.13: Vendor Photo Support — Profile Photo, Gallery & List Thumbnail

**GitHub Issue:** #271

**As a** property owner managing vendors,
**I want** to upload photos for my vendors (profile photo, business cards, certifications, work samples),
**So that** I can visually identify vendors and keep relevant documentation attached to their profile.

**Acceptance Criteria:**

**AC1 — Profile / primary photo on vendor detail:**
**Given** I am on a vendor detail page
**When** I view the Contact Information section
**Then** I see a profile photo (or upload placeholder if none exists)
**And** I can upload/change the primary photo

**AC2 — Photo gallery on vendor detail:**
**Given** I am on a vendor detail page
**When** I scroll to the photos section
**Then** I see a photo gallery with upload capability
**And** I can upload multiple photos (business cards, certs, work samples, etc.)

**AC3 — Photo delete and lightbox:**
**Given** I view the vendor photo gallery
**When** I click a photo **Then** it opens in the lightbox viewer
**When** I click delete on a photo **Then** it is removed after confirmation

**AC4 — Vendor list thumbnail:**
**Given** I am on the Vendors list (`/vendors`)
**When** a vendor has a primary photo
**Then** the primary photo thumbnail replaces the generic person icon in the vendor card

**AC5 — S3 storage with thumbnails:**
**Given** I upload a vendor photo
**When** the upload completes
**Then** a thumbnail is generated server-side (matching existing property/work order photo pipeline)
**And** the photo is stored in S3 with presigned URL access

**Prerequisites:** None

**Effort:** L — full-stack: domain entity, migration, backend endpoints, S3 pipeline, frontend upload + gallery + list integration

**Technical Notes:**
- **Domain:** Create `VendorPhoto` entity (mirrors `PropertyPhoto` / `WorkOrderPhoto` pattern): Id, VendorId, S3Key, ThumbnailS3Key, OriginalFileName, ContentType, IsPrimary, SortOrder, CreatedAt
- **Migration:** Add `VendorPhotos` table with FK to `Vendors`
- **Backend:** CRUD endpoints for vendor photos — reuse existing `PhotoService` + `ImageSharpThumbnailService` pipeline
- **Backend:** Update `GetVendorDetail` to include photos; update `GetAllVendors` to include primary thumbnail URL
- **Frontend:** Add `PhotoUploadComponent` to vendor detail (same pattern as property photos and work order photos)
- **Frontend:** Add photo gallery section with lightbox (reuse `PhotoViewerComponent`)
- **Frontend:** Update vendor list card to show thumbnail from `primaryPhotoThumbnailUrl`
- Reference: Property photos (Epic 13) — follow the exact same pattern for consistency

---

## Epic 17 Summary

| Story | Title | GitHub Issues | Effort | Prerequisites |
|-------|-------|---------------|--------|---------------|
| 17.1 | CSS Dialog & Label Fixes | #273, #275, #278 | XS | None |
| 17.2 | Form Behavior Fixes — Vendor Edit | #272, #265 | S | None |
| 17.3 | Work Order List Refresh After Delete | #269 | S | None |
| 17.4 | Expenses List Actions Column | #267 | S | None |
| 17.5 | WO Linked Expenses — Click & Actions | #266 | S | None |
| 17.6 | Wire Duplicate Detection into Receipt Flow | #244 | S | None |
| 17.7 | Vendor Detail — Work Order History | #268 | M | None |
| 17.8 | Full-Size Add Vendor Form | #274 | M | None |
| 17.9 | PhotoUpload Multi-File Support | #276 | M | None |
| 17.10 | Inline Status Dropdown on WO Detail | #277 | M | None |
| 17.11 | WO List — Primary Photo Thumbnail | #270 | M | None |
| 17.12 | Replace Global Year Selector with Date Range | #279 | L | None |
| 17.13 | Vendor Photo Support | #271 | L | None |

**Dependencies:**
- All stories are independent — no blockers between them
- Recommended execution order: XS/S batch first (17.1-17.6), then M batch (17.7-17.11), then L items (17.12-17.13)

**Recommended Priority Order:**
1. **17.1** (XS) — visual bugs, instant credibility
2. **17.2** (S) — form behavior annoyances
3. **17.3** (S) — stale state after delete
4. **17.6** (S) — bug: duplicate detection wiring gap
5. **17.4** (S) — expense list actions parity
6. **17.5** (S) — linked expenses usability
7. **17.7** (M) — vendor work order history
8. **17.8** (M) — full vendor creation form
9. **17.10** (M) — inline status dropdown
10. **17.9** (M) — multi-file photo upload
11. **17.11** (M) — work order list thumbnails
12. **17.12** (L) — year selector refactor (consider splitting into sub-stories)
13. **17.13** (L) — vendor photos (consider splitting into sub-stories)

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-25_
_For: Dave_
_Project: property-manager_
