# Story 21.8: Work Orders E2E

Status: done

## Story

As a developer,
I want Playwright E2E coverage of the work order create / edit / delete / photo / PDF flows,
so that the work-orders feature surface — currently covered by exactly one list-only spec that uses `page.route()` to mock the API — has user-level regression protection through real backend round-trips, before Epic 20 (tenant portal) resumes and we keep building on top of work orders.

## Acceptance Criteria

> **Reality check (epic vs. shipped UI/API):**
>
> 1. **Existing E2E coverage is `work-order-list.spec.ts` only**, and it is fully `page.route()`-mocked (asserts row layout, status chips, expand/collapse, delete-dialog appearance, filters, "New Work Order" button navigation). It does NOT exercise create/edit/delete/photo/PDF against the real backend. This story adds that real-backend coverage in **separate spec files** (per the epic's "split if file > ~300 lines" guidance). Do not modify the mocked spec.
> 2. **Cleanup is real and reliable.** `backend/src/PropertyManager.Api/Controllers/TestController.cs` already deletes `WorkOrderTagAssignments`, `WorkOrderPhotos`, `Notes`, `Expenses`, `Income`, `WorkOrders`, `Vendors`, `Persons`, `PropertyPhotos`, `Receipts`, `GeneratedReports`, `Properties`, `RefreshTokens` for the current account on `POST /api/v1/test/reset` (Development only). Playwright's `globalTeardown` (`frontend/e2e/global-teardown.ts`) calls it once at suite end. Inside this spec, prefer **`afterAll`** reset (single round-trip per file) rather than per-test reset (slow). Per-test uniqueness via `Date.now()` keeps assertions safe even with shared seeded-account state, matching the 21.4 pattern.
> 3. **Vendors are NOT cleaned by `TestController.reset` for the seeded account in a way we can rely on across runs** — the vendor delete uses raw SQL on `Persons.AccountId = accountId`, which DOES include the seeded `claude@claude.com` account (it has a co-Owner setup, not isolation). Translation: a vendor created in this spec is wiped at suite teardown. Tests that need a vendor should create one per-test via API.
> 4. **PDF download is verified at the request layer**, not by parsing PDF bytes. Per epic's technical note: "validate that the request is made and response returns 200 with `application/pdf` content type." Use Playwright's `page.waitForEvent('download')` for the download flow and `expect(response.headers()['content-type']).toBe('application/pdf')` for the preview flow's HTTP response (the preview dialog requests `/api/v1/work-orders/{id}/pdf` via the same endpoint; assert via `page.waitForResponse`).
> 5. **The work-order detail "Edit" entry is a `<a routerLink>` to `/work-orders/:id/edit`** (verified `work-order-detail.component.ts:114-121`), and the list row's "Edit" hover icon is also `<a routerLink>` (verified `work-orders.component.ts:181`). Both are real navigations — don't try `clickEditOnRow` and then expect a dialog; expect a route change.
> 6. **Status auto-transition contract**: when a vendor is selected on the create form and current status is `Reported`, the form auto-patches status to `Assigned` (verified `work-order-form.component.ts:561-566`). The AC for "edit changes status" must be aware of this so the test isn't surprised when assigning a vendor flips the status as a side-effect.
> 7. **Snackbar messages — verbatim from the store** (verified `work-order.store.ts`): create → `'Work order created'`, update → `'Work order updated'`, delete → `'Work order deleted'`, photo upload → `'Photo added ✓'` (note the check-mark glyph). PDF download → `'PDF downloaded'`. Use these verbatim in `expectSnackBar(...)` assertions.
> 8. **Vendor creation UI exists** but using it inline (`Add New Vendor` option) opens an `InlineVendorDialogComponent` modal — out of scope for this story. Tests that need a vendor seed it via API (`POST /api/v1/vendors`), then select it from the dropdown by name.

### AC-1: User can create a work order via the UI (real backend round-trip)

- **Given** the seeded user is logged in, a property exists for that user, and a vendor exists for that user (both seeded via API in `beforeAll`)
- **When** the user navigates to `/work-orders/new`, selects the property, types a description, leaves status as default (`Reported`), and clicks **Create Work Order**
- **Then** a `POST /api/v1/work-orders` request returns `201 Created`
- **And** the snackbar `Work order created` is shown
- **And** the user is navigated back to `/work-orders` (per `WorkOrderStore.createWorkOrder` redirect, verified at `work-order.store.ts:191-193`)
- **And** the new work order's description is visible in the list (use `getRowByDescription(uniqueDescription)`)
- **And** that row's status chip text is `Reported`

### AC-2: Creating a work order with a vendor auto-transitions status to Assigned

- **Given** the same seed as AC-1
- **When** the user opens `/work-orders/new`, selects the property, types a description, selects the seeded vendor in the **Assigned To** dropdown, and submits without manually changing status
- **Then** the form's status field becomes `Assigned` before submit (per `onVendorChange` auto-patch)
- **And** the resulting list row shows the vendor name on line-2 (`.wo-vendor`) and status chip `Assigned`

### AC-3: User can edit an existing work order

- **Given** a work order created via API in `beforeAll` (seeded WO with description `Edit-target ${ts}`, status `Reported`, no vendor)
- **When** the user lands on `/work-orders`, hovers the seeded row to reveal action icons, clicks the **Edit** icon, is routed to `/work-orders/:id/edit`, changes the description to a new unique string, changes status to `Assigned`, and clicks **Save Changes**
- **Then** a `PUT /api/v1/work-orders/{id}` request returns 200 (or 204)
- **And** snackbar `Work order updated` appears
- **And** the user is navigated back to a target consistent with the store's redirect (verify `work-order.store.ts` — currently the `updateWorkOrder` reducer; if it redirects to detail, navigate accordingly; if it stays on edit, expect the form's title or button text update)
- **And** when the user navigates to `/work-orders/:id` (detail), the new description and status `Assigned` are rendered

### AC-4: User can delete a work order from the list and confirm via dialog

- **Given** a work order created via API in `beforeEach` (description `Delete-target ${ts}`)
- **When** the user navigates to `/work-orders`, hovers the seeded row, clicks the **Delete** icon (`button[aria-label="Delete work order"]`), and clicks the **Delete** button in the confirm dialog
- **Then** a `DELETE /api/v1/work-orders/{id}` request returns 204
- **And** snackbar `Work order deleted` appears
- **And** the row is no longer present in the list (`expectRowNotInList(description)`)

### AC-5: User can delete a work order from the detail page

- **Given** a work order created via API in `beforeEach`
- **When** the user navigates to `/work-orders/{id}`, clicks the **Delete** action button in the header, and confirms the dialog
- **Then** the `DELETE` request fires, snackbar appears, and the user is navigated back to `/work-orders` and the row is absent

> **Implementation note:** AC-4 covers list-row delete; AC-5 covers detail-page delete. They are separate flows with different button origins. Both are required by the epic ("from list or detail").

### AC-6: User can upload a photo to a work order via the detail page

- **Given** a work order created via API in `beforeEach` and the user is on `/work-orders/{id}`
- **When** the user clicks **Add Photo** (or **Add First Photo** on empty state) and uses `setInputFiles` on the photo-upload component's `[data-testid="file-input"]` to upload a small in-memory JPEG
- **Then** the test stubs S3 (because the real backend issues a presigned PUT to a bucket Playwright cannot reach in dev) using `page.route()` for the S3 PUT URL only — the API calls (`generate-upload-url`, `confirm`) hit the real backend
- **And** snackbar `Photo added ✓` is visible (note the check-mark — copy it from the store)
- **And** after the upload completes, a card matching `[data-testid="photo-card-..."]` appears inside `[data-testid="photo-grid"]`

> **Network strategy for AC-6:**
>
> - DO let the API calls hit the real backend so the `WorkOrderPhoto` row is actually created in PG (and gets cleaned up by `TestController.reset` in `afterAll`).
> - DO mock the S3 PUT (the presigned URL the backend returns will point at a real S3 host; Playwright cannot reach it in dev). Use `page.route(uploadUrlResponse.uploadUrl, route => route.fulfill({ status: 200 }))` after capturing the URL via `page.waitForResponse('**/photos/upload-url')`. Reference pattern: `frontend/e2e/tests/receipts/receipt-upload.spec.ts:181-183`.
> - The `ConfirmUpload` endpoint will succeed regardless because the backend doesn't verify object existence in S3 during confirm (verified by reading `WorkOrderPhotosController.cs` and the `ConfirmUploadHandler`).

### AC-7: User can preview a work order PDF and the preview request returns application/pdf

- **Given** a work order created via API with a description and vendor
- **When** the user navigates to `/work-orders/{id}` and clicks the button matching `[data-testid="preview-pdf-btn"]`
- **Then** a `GET /api/v1/work-orders/{id}/pdf` request fires (intercept with `page.waitForResponse`)
- **And** the response status is 200
- **And** the response `content-type` header starts with `application/pdf`
- **And** the dialog matching `[data-testid="wo-pdf-preview-dialog"]` becomes visible

### AC-8: User can download a work order PDF

- **Given** the same seed as AC-7 and the user is on `/work-orders/{id}`
- **When** the user clicks the button matching `[data-testid="download-pdf-btn"]` (the page-header download button — NOT the in-dialog one) wrapped in a `page.waitForEvent('download')` promise
- **Then** the download is initiated (Playwright's Download object resolves)
- **And** the suggested filename matches `WorkOrder-*.pdf` (per the component's `Content-Disposition` parsing fallback at `work-order-detail.component.ts:917-918`)
- **And** snackbar `PDF downloaded` is shown

> **Don't validate PDF bytes.** Per epic technical note. Asserting `download.suggestedFilename()` and the snackbar is sufficient.

### AC-9: All seeded entities are cleaned up after the suite runs

- **Given** the spec creates properties, vendors, work orders, and photos via API
- **When** all tests in this spec finish
- **Then** the spec's `afterAll` calls `POST /api/v1/test/reset` once with the seeded user's JWT, clearing all per-test rows
- **And** subsequent re-runs of this spec are deterministic — no row from prior runs satisfies any current-run assertion (because all assertions key on per-run unique strings: descriptions, names, etc. via `Date.now()`)
- **Verified:** spec re-runs back-to-back all green when run with `--workers=1` (target: green twice in a row).

## Tasks / Subtasks

- [x] **Task 1: Create `work-order.helper.ts` for API-driven seed setup (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9)**
  - [x] 1.1 Create `frontend/e2e/helpers/work-order.helper.ts`
  - [x] 1.2 Export `getAccessTokenForSeededUser(): Promise<string>` — POSTs to `/api/v1/auth/login` with `claude@claude.com` / `1@mClaude` and returns `accessToken`. Mirror `frontend/e2e/global-teardown.ts:13-21`.
  - [x] 1.3 Export `createPropertyViaApi(token, overrides?): Promise<{ id: string; name: string }>` — POSTs `/api/v1/properties` with `{ name: 'WO E2E Property ${ts}', street, city, state, zipCode }` and returns the created id + name. Verify the POST contract by reading the `PropertiesController` and matching the existing E2E test create payloads.
  - [x] 1.4 Export `createVendorViaApi(token, overrides?): Promise<{ id: string; fullName: string }>` — POSTs `/api/v1/vendors`. Read `VendorsController.cs` to confirm the body shape (firstName, lastName, optionally email/phone — likely `{ firstName, lastName }` minimum). Returns the persisted id + computed `fullName`.
  - [x] 1.5 Export `createWorkOrderViaApi(token, propertyId, overrides?): Promise<{ id: string; description: string }>` — POSTs `/api/v1/work-orders` with `{ propertyId, description: 'WO E2E ${ts}', status: 'Reported' }`. Returns the created id + description.
  - [x] 1.6 Export `resetTestDataViaApi(token): Promise<void>` — POSTs `/api/v1/test/reset`. Used by `afterAll` for cleanup. Don't throw if it 500s — log and continue (matches `global-teardown` resilience).
  - [x] 1.7 Add a `WO_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5292'` constant. Reuse it across all helpers.
  - [x] 1.8 Each helper uses native `fetch` (no Playwright `request` fixture needed at this layer) so the helpers can be called from `beforeAll`/`afterAll` without a `page` instance.

- [x] **Task 2: Extend `WorkOrderListPage` with row delete + edit assertions and `expectRowNotInList` (AC-1, AC-3, AC-4)**
  - [x] 2.1 Open `frontend/e2e/pages/work-order-list.page.ts`
  - [x] 2.2 Add `expectRowNotInList(description: string): Promise<void>` mirroring `expectRequestNotInList` from `tenant-dashboard.page.ts` — use `expect(getRowByDescription(description)).toHaveCount(0)`.
  - [x] 2.3 Add `expectRowVendor(description, vendorName): Promise<void>` — locates `.wo-vendor` inside the row.
  - [x] 2.4 No new selectors needed for `clickEditOnRow` / `clickDeleteOnRow` — already exist (verified `work-order-list.page.ts:99-106` and `:90-97`).
  - [x] 2.5 Add `expectStatusOnRow(description, status): Promise<void>` — wraps `expectRowHasStatus` if the existing helper isn't sufficient, but verify first; existing one at `:160-165` already does the job.

- [x] **Task 3: Create `work-order-form.page.ts` page object (AC-1, AC-2, AC-3)**
  - [x] 3.1 Create `frontend/e2e/pages/work-order-form.page.ts` extending `BasePage`
  - [x] 3.2 `goto()` defaults to `/work-orders/new`; expose `gotoEdit(id: string)` for `/work-orders/:id/edit`
  - [x] 3.3 Locators (no `data-testid` attributes are added in this story — use Material control selectors that the form already exposes):
    - `propertyDropdown` → `mat-select[formControlName="propertyId"]`
    - `descriptionInput` → `textarea[formControlName="description"]`
    - `statusDropdown` → `mat-select[formControlName="status"]`
    - `vendorDropdown` → `mat-select[formControlName="vendorId"]`
    - `submitButton` → `button[type="submit"]` (matches both "Create Work Order" and "Save Changes")
    - `cancelButton` → `button:has-text("Cancel")`
  - [x] 3.4 Methods:
    - `selectProperty(propertyName: string)` — click dropdown, click option matching property name
    - `fillDescription(text: string)` — `descriptionInput.fill(text)`
    - `selectStatus(status: 'Reported' | 'Assigned' | 'Completed')`
    - `selectVendorByName(name: string)` — opens dropdown, clicks `mat-option:has-text("${name}")` (skipping the "Self (DIY)" and "Add New Vendor" options)
    - `selectDiy()` — selects the `Self (DIY)` mat-option
    - `submit()` — clicks submitButton
    - `expectSubmitDisabled()` — `await expect(submitButton).toBeDisabled()`

- [x] **Task 4: Create `work-order-detail.page.ts` page object (AC-3, AC-5, AC-6, AC-7, AC-8)**
  - [x] 4.1 Create `frontend/e2e/pages/work-order-detail.page.ts` extending `BasePage`
  - [x] 4.2 `goto(id: string)` → `/work-orders/${id}` then `waitForLoading()`
  - [x] 4.3 Locators (verified against `work-order-detail.component.ts`):
    - `editButton` → `a[routerLink][title^="Edit work order"]` OR `.action-buttons a:has-text("Edit")`
    - `deleteButton` → `.action-buttons button:has-text("Delete")`
    - `previewPdfButton` → `[data-testid="preview-pdf-btn"]`
    - `downloadPdfButton` → `[data-testid="download-pdf-btn"]`
    - `pdfPreviewDialog` → `[data-testid="wo-pdf-preview-dialog"]`
    - `addPhotoButton` → `.gallery-card .add-photo-btn` (visible when photos > 0) OR `.empty-state button:has-text("Add First Photo")` (empty state)
    - `fileInput` → `[data-testid="file-input"]` (lives inside `app-photo-upload`)
    - `photoCards` → `[data-testid^="photo-card-"]`
    - `descriptionText` → `.description-text`
    - `statusOptionDisplay` → `.status-option` (the inline mat-select-trigger contents)
  - [x] 4.4 Methods:
    - `clickEdit()` → click + `waitForURL(/\/work-orders\/[a-f0-9-]+\/edit$/)`
    - `clickDelete()` → click + `waitForConfirmDialog()`
    - `confirmDelete()` → `confirmDialogAction('Work order deleted')` then `waitForURL('/work-orders')` (per `WorkOrderStore.deleteWorkOrder` redirect — verify in store before relying on it; if no redirect, drop the URL wait)
    - `clickPreviewPdf()` → click + return a `Promise<Response>` from `page.waitForResponse(/\/api\/v1\/work-orders\/[a-f0-9-]+\/pdf/)`
    - `downloadPdf()` → returns `[Download, Promise<void>]` using `page.waitForEvent('download')` started **before** clicking `downloadPdfButton`
    - `clickAddPhoto()` → opens upload zone (the button toggles `showUploadZone` signal)
    - `uploadPhoto(buffer: Buffer, name = 'test.jpg', mime = 'image/jpeg')` → `fileInput.setInputFiles({ name, mimeType: mime, buffer })`

- [x] **Task 5: Add page-object fixtures to `test-fixtures.ts` (AC-1..AC-9)**
  - [x] 5.1 Open `frontend/e2e/fixtures/test-fixtures.ts`
  - [x] 5.2 Import `WorkOrderFormPage`, `WorkOrderDetailPage`
  - [x] 5.3 Add to the `Fixtures` type and the `test.extend` block
  - [x] 5.4 No new auth fixture needed — reuse `authenticatedUser`

- [x] **Task 6: Write `work-orders-create.spec.ts` (AC-1, AC-2, AC-9)**
  - [x] 6.1 File: `frontend/e2e/tests/work-orders/work-orders-create.spec.ts`
  - [x] 6.2 `test.describe('Work Orders Create (Story 21.8)', ...)`
  - [x] 6.3 `test.beforeAll`: get token, create one property, create one vendor — store ids on the suite scope
  - [x] 6.4 `test.afterAll`: call `resetTestDataViaApi(token)` once
  - [x] 6.5 Test: `'creates a work order with required fields'` (AC-1)
    - Login via `authenticatedUser` fixture
    - `workOrderListPage.newWorkOrderButton.click()` → wait for `/work-orders/new`
    - `workOrderFormPage.selectProperty(seedProperty.name)`
    - `workOrderFormPage.fillDescription(`Create-target ${Date.now()}`)`
    - `workOrderFormPage.submit()`
    - Expect `Work order created` snackbar
    - Expect URL `/work-orders`
    - Expect row visible by description, status `Reported`
  - [x] 6.6 Test: `'auto-transitions status to Assigned when a vendor is selected'` (AC-2)
    - Same flow but also `workOrderFormPage.selectVendorByName(seedVendor.fullName)`
    - Submit
    - Expect row's `.wo-vendor` shows the vendor name
    - Expect row's status chip text is `Assigned`

- [x] **Task 7: Write `work-orders-edit.spec.ts` (AC-3, AC-9)**
  - [x] 7.1 File: `frontend/e2e/tests/work-orders/work-orders-edit.spec.ts`
  - [x] 7.2 `beforeAll`: token + seed property + seed vendor + seed WorkOrder via API (`description = 'Edit-target ${ts}'`, status `Reported`, no vendor)
  - [x] 7.3 `afterAll`: reset
  - [x] 7.4 Test: `'edits an existing work order via the list edit icon'` (AC-3)
    - Navigate to `/work-orders`
    - `workOrderListPage.clickEditOnRow(seedWO.description)` → wait for `/work-orders/:id/edit`
    - Change description to `'Edited ${ts}'`
    - `workOrderFormPage.selectStatus('Assigned')`
    - Submit
    - Expect `Work order updated` snackbar
    - Navigate back to detail (or list, whichever the store does — confirm in code)
    - Expect detail page renders the new description and status `Assigned` (use `workOrderDetailPage.descriptionText` and `statusOptionDisplay`)

- [x] **Task 8: Write `work-orders-delete.spec.ts` (AC-4, AC-5, AC-9)**
  - [x] 8.1 File: `frontend/e2e/tests/work-orders/work-orders-delete.spec.ts`
  - [x] 8.2 `beforeAll`: token + seed property
  - [x] 8.3 `afterAll`: reset
  - [x] 8.4 Test: `'deletes a work order from the list row'` (AC-4)
    - `beforeEach` (or inside the test) — create a fresh WorkOrder via API so the test has a known row to delete
    - Navigate to `/work-orders`
    - `workOrderListPage.clickDeleteOnRow(wo.description)` → wait for confirm dialog
    - `workOrderListPage.confirmDialogAction('Work order deleted')`
    - `workOrderListPage.expectRowNotInList(wo.description)`
  - [x] 8.5 Test: `'deletes a work order from the detail page'` (AC-5)
    - Create a fresh WorkOrder via API
    - `workOrderDetailPage.goto(wo.id)`
    - `workOrderDetailPage.clickDelete()`
    - `workOrderDetailPage.confirmDelete()` — asserts the snackbar internally
    - Wait for `/work-orders` URL (or assert detail page no longer rendered if the store redirects elsewhere)
    - `workOrderListPage.expectRowNotInList(wo.description)`

- [x] **Task 9: Write `work-orders-photos.spec.ts` (AC-6, AC-9)**
  - [x] 9.1 File: `frontend/e2e/tests/work-orders/work-orders-photos.spec.ts`
  - [x] 9.2 `beforeAll`: token + seed property + seed WorkOrder
  - [x] 9.3 `afterAll`: reset
  - [x] 9.4 Test: `'uploads a photo to a work order via the detail page'` (AC-6)
    - Navigate to `/work-orders/{seedWO.id}`
    - Set up `page.route()` for the S3 PUT URL **after** capturing the upload URL from `/photos/upload-url` response. Pattern:
      ```typescript
      const uploadUrlPromise = page.waitForResponse(/\/photos\/upload-url$/);
      await workOrderDetailPage.clickAddPhoto();
      // For the empty-state path the upload zone may already be visible; click the file input wrapper instead.
      await workOrderDetailPage.uploadPhoto(Buffer.from('fake-jpeg'), 'test.jpg', 'image/jpeg');
      const uploadUrlResp = await uploadUrlPromise;
      const { uploadUrl } = await uploadUrlResp.json();
      await page.route(uploadUrl, (route) => route.fulfill({ status: 200 }));
      ```
      **Order matters** — register the response listener before the click, but register the route mock for the S3 URL only after capturing it (because the URL is dynamic per request).
    - **Alternative (simpler):** `page.route('**/*.amazonaws.com/**', (route) => route.fulfill({ status: 200 }));` registered before any click, which catches any S3 host pattern without needing to extract the URL. Use this unless the dev S3 endpoint doesn't match `*.amazonaws.com` — verify the actual presigned URL host before choosing.
    - Expect `Photo added ✓` snackbar
    - Expect at least one card matching `[data-testid^="photo-card-"]` in the gallery

  > **Sanity-check the S3 URL host**: Before writing the route mock, run the dev backend and trigger one upload via the UI to see the presigned URL host (or grep `appsettings.Development.json` for `S3:Endpoint`/`S3:BucketName`). If the dev setup uses LocalStack on `localhost:4566`, the wildcard `**/*.amazonaws.com/**` won't match — adjust to `**/4566/**` or capture-then-mock. The receipts spec at `frontend/e2e/tests/receipts/receipt-upload.spec.ts:181-183` mocks `'https://mock-s3.example.com/**'` because that test fully mocks the upload flow; this story uses a real upload-url request and stubs only the S3 leg.

- [x] **Task 10: Write `work-orders-pdf.spec.ts` (AC-7, AC-8, AC-9)**
  - [x] 10.1 File: `frontend/e2e/tests/work-orders/work-orders-pdf.spec.ts`
  - [x] 10.2 `beforeAll`: token + seed property + seed vendor + seed WorkOrder with vendor assigned
  - [x] 10.3 `afterAll`: reset
  - [x] 10.4 Test: `'previews PDF — request returns 200 application/pdf'` (AC-7)
    - Navigate to `/work-orders/{seedWO.id}`
    - `const respPromise = page.waitForResponse(/\/api\/v1\/work-orders\/[^/]+\/pdf/)`
    - Click `workOrderDetailPage.previewPdfButton`
    - `const resp = await respPromise`
    - `expect(resp.status()).toBe(200)`
    - `expect(resp.headers()['content-type']).toMatch(/^application\/pdf/)`
    - `await expect(workOrderDetailPage.pdfPreviewDialog).toBeVisible()`
  - [x] 10.5 Test: `'downloads PDF — file dispatched and snackbar shown'` (AC-8)
    - Navigate to `/work-orders/{seedWO.id}`
    - `const downloadPromise = page.waitForEvent('download')`
    - Click `workOrderDetailPage.downloadPdfButton`
    - `const download = await downloadPromise`
    - `expect(download.suggestedFilename()).toMatch(/^WorkOrder-.+\.pdf$/)`
    - Expect snackbar `PDF downloaded`

- [x] **Task 11: Run, verify locally with `--workers=1`, ensure idempotent re-runs (AC-9, all)**
  - [x] 11.1 `npx playwright test e2e/tests/work-orders --workers=1` — all new specs green; existing `work-order-list.spec.ts` still green (it's mocked and independent).
  - [x] 11.2 Re-run twice back-to-back: both runs green (proves AC-9 — cleanup + per-run unique strings work together).
  - [x] 11.3 Run a wider regression: `npx playwright test e2e/tests/work-orders e2e/tests/expenses/expense-flow.spec.ts e2e/tests/invitations/invitation-flow.spec.ts --workers=1` — confirm no cross-suite pollution.
  - [x] 11.4 `dotnet build` and `ng build --configuration development` clean (no production-code touched, but verify import paths in the new specs are correct).
  - [x] 11.5 Confirm CI parity: `playwright.config.ts` already sets `workers: process.env.CI ? 1 : undefined`, so CI will run these specs with one worker. No config change needed.

- [x] **Task 12: Sprint status + story status update (process)**
  - [x] 12.1 Update `docs/project/sprint-status.yaml`: `21-8-work-orders-e2e: review`
  - [x] 12.2 Set this story's `Status:` line to `review`
  - [x] 12.3 Fill out Dev Agent Record with model + completion notes + file list

## Dev Notes

### Test Scope

This is an **E2E-only** story. E2E tests ARE the deliverable.

| Layer | Required? | Justification |
|---|---|---|
| **Unit tests (Vitest)** | **Not required** | The work-order Angular components have full Vitest coverage (`work-order-create.component.spec.ts`, `work-order-edit.component.spec.ts`, `work-order-detail.component.spec.ts`, `work-order-form.component.spec.ts`, `work-order-photo-gallery.component.spec.ts`, `work-order-pdf-preview-dialog.component.spec.ts`, plus the existing `work-orders.component.spec.ts`). No new components or store logic are added by this story. |
| **Integration tests (.NET WebApplicationFactory)** | **Not required** | `WorkOrdersControllerTests` (existing, 50+ tests) plus `WorkOrderPhotosControllerTests.cs` (Story 21.5, done — PR #383) cover every endpoint this story exercises. The work-order PDF generation has dedicated tests in the Application layer. |
| **E2E (Playwright)** | **Required — this IS the story** | Closes the gap left by Stories 9.x, 10.x, 12.x — all of which deferred E2E to the test-coverage backfill epic. The single existing spec (`work-order-list.spec.ts`) is fully mocked and only verifies row layout / filter UI. Real-backend create / edit / delete / photo / PDF flows have **zero** E2E coverage today. |

### Pattern Reference — mirror `tenant-dashboard.spec.ts` and the receipts upload spec

Two canonical references in this repo:

1. **`frontend/e2e/tests/tenant-dashboard/tenant-dashboard.spec.ts`** (Story 21.4, done — most recent E2E story) — establishes:
   - The `Date.now()`-suffixed unique-data convention for cleanup-tolerant assertions
   - The "API helpers in `*.helper.ts`, page objects in `pages/`, fixture wiring in `test-fixtures.ts`" three-layer split
   - The "snackbar text verbatim from the store" rule
   - The "per-test cleanup is overkill if assertions are unique-string-based" justification (this story uses one `afterAll` reset per spec instead, since `TestController.reset` covers all the entities we touch)

2. **`frontend/e2e/tests/receipts/receipt-upload.spec.ts`** (existing) — establishes:
   - `setInputFiles({ name, mimeType, buffer: Buffer.from('fake-image-data') })` for in-memory file upload
   - `page.route('https://mock-s3.example.com/**', route => route.fulfill({ status: 200 }))` for stubbing the S3 PUT
   - `page.locator('mat-dialog-container [data-testid="file-input"]')` scoping when the file input lives inside a Material dialog (work-orders' upload is inline, not in a dialog — the scoping won't be needed here, but the file-input testid pattern is the same).

### Cleanup strategy — single `afterAll` reset per spec

Per CLAUDE.md, the seeded `claude@claude.com` account is shared across all tests. Two cleanup options were considered:

1. **Per-test `afterEach` reset** — slow (~150ms × N tests) and requires re-seeding properties/vendors per test if `beforeAll` placed them on the seeded account.
2. **Single `afterAll` reset per spec, with `beforeAll`-scoped seeds + per-test unique strings** — fast, deterministic, and idempotent for re-runs (verified via the re-run check in Task 11.2).

**This story uses option 2.** The `globalTeardown` hook still runs at suite end as a safety net, but each spec also self-cleans via `afterAll` so the suite stays fast and individual specs can be run in isolation without leaking state.

**Why per-test uniqueness still matters even with `afterAll`:** If a spec fails partway through, `afterAll` may not run reliably. Per-test unique descriptions (`'Create-target ${Date.now()}'`) ensure the next run still discriminates correctly even if the previous run leaked rows.

### Network strategy — real API, mock S3 only

| Endpoint | Real or mocked? | Why |
|---|---|---|
| `POST /api/v1/auth/login` | Real | Used by login flow + helper to get token |
| `POST /api/v1/properties` | Real | Seed setup, exercises real EF Core |
| `POST /api/v1/vendors` | Real | Seed setup |
| `POST /api/v1/work-orders` | Real | Story-AC-1 flow under test |
| `PUT /api/v1/work-orders/{id}` | Real | AC-3 |
| `DELETE /api/v1/work-orders/{id}` | Real | AC-4, AC-5 |
| `GET /api/v1/work-orders` | Real | List view |
| `GET /api/v1/work-orders/{id}` | Real | Detail view |
| `GET /api/v1/work-orders/{id}/pdf` | Real | AC-7, AC-8 — assert content-type and download trigger |
| `POST /api/v1/work-orders/{id}/photos/upload-url` | Real | AC-6 setup |
| `POST /api/v1/work-orders/{id}/photos` (confirm) | Real | AC-6 — creates the row that proves the photo "exists" from the UI's perspective |
| `GET /api/v1/work-orders/{id}/photos` | Real | AC-6 list refresh |
| Presigned S3 PUT URL | **Mocked** with `page.route()` | Real S3 host is unreachable in dev/CI; mocking 200 lets the chain progress to the confirm step |

This matches CLAUDE.md's "use `page.route()` to control what the component sees **when a test requires a specific data shape**" — here, the "specific shape" is "make S3 PUT succeed without actually hitting S3."

### `data-testid` audit (verified — Apr 2026)

Already in place — no production changes needed:

| Selector | Component | Used for AC |
|---|---|---|
| `[data-testid="preview-pdf-btn"]` | `work-order-detail.component.ts:134` | AC-7 |
| `[data-testid="download-pdf-btn"]` | `work-order-detail.component.ts:143` | AC-8 |
| `[data-testid="wo-pdf-preview-dialog"]` | `work-order-pdf-preview-dialog.component.ts:41` | AC-7 |
| `[data-testid="file-input"]` | `photo-upload.component.ts:50` | AC-6 |
| `[data-testid="photo-grid"]` | `work-order-photo-gallery.component.ts:81` | AC-6 |
| `[data-testid^="photo-card-"]` | `work-order-photo-gallery.component.ts:90` | AC-6 |
| `[data-testid="empty-state"]` (gallery) | `work-order-photo-gallery.component.ts:68` | AC-6 (initial state) |

**Selectors NOT yet present** (but the existing list/form structure makes them unnecessary if the page object uses Material control queries instead of testids):

- No testid on the work-order list rows beyond `.work-order-row` and `.row-content` — the existing `WorkOrderListPage` uses CSS selectors directly. Don't add new testids in this story.
- No testid on the form's submit/cancel buttons — `button[type="submit"]` is unambiguous within the form scope.

> **Discipline:** Resist the urge to add `data-testid` attributes during E2E development. Only add one if the test cannot reliably select the element via existing selectors. None of the AC flows in this story require new testids.

### Anti-pitfalls (don't make these mistakes)

1. **Don't mock the API for AC-1..AC-5, AC-7, AC-8** — the entire point is to exercise the real backend. The existing `work-order-list.spec.ts` is fully mocked; this story is the opposite. Keep the two patterns clearly separated by file.
2. **Don't import `test`/`expect` from `@playwright/test`** — use `../../fixtures/test-fixtures` per CLAUDE.md and Story 21.4 convention.
3. **Don't use `page.waitForLoadState('networkidle')` everywhere** — slow, brittle. Use specific `waitForURL` / `expect(...).toBeVisible()` / `waitForResponse(...)` waits.
4. **Don't expect a confirm-dialog to give a chance to inspect the work order's title before clicking confirm without waiting** — the dialog renders the description as `secondaryMessage` (verified `work-order-detail.component.ts:867-869`); if the test wants to assert that, do it before clicking confirm.
5. **Don't call `clickEditOnRow` and then `expect(dialog).toBeVisible()`** — the row's edit icon is a router link, not a dialog opener. Wait for the URL to change instead.
6. **Don't validate PDF bytes** — assert `Content-Type` header and the `Download` event only.
7. **Don't try to `setInputFiles` on a hidden `<input type="file">` while the upload zone is collapsed** — the photo-upload component has two states (`hasQueue` true/false). The file input is always present in the DOM with `hidden` attribute, so `setInputFiles` works regardless of zone visibility — but the test reads better if the test explicitly opens the zone first via `clickAddPhoto`.
8. **Don't assume `setInputFiles` triggers a `file-chooser` event** — it doesn't; it sets the file directly on the input element. The component's `(change)` handler fires automatically. (No `page.waitForEvent('filechooser')` needed.)
9. **Don't forget to register the S3 `page.route` mock BEFORE the upload click** — once the click fires, the component immediately POSTs to `upload-url`, gets the presigned URL, and PUTs to S3. If the route mock isn't registered when the PUT fires, the test will hang or fail. The "register a wildcard mock for any S3 host before clicking" approach is simpler than capture-then-mock.
10. **Don't run with default `workers` locally if you want to mirror CI** — pass `--workers=1`. The new specs are designed to be parallel-safe (per-test unique strings), but `workers=1` matches the CI behavior and surfaces ordering bugs.
11. **Don't add a new `afterEach` reset** — `afterAll` per spec + global teardown is the established pattern. Per-test reset would 3x suite runtime for no benefit.
12. **Don't seed via `dashboardPage.clickAddProperty()` UI flow** — use the API helper for setup; reserve UI-driven property creation for tests that specifically test the property-creation flow (which is a separate feature, covered elsewhere).
13. **Don't extend `AuthHelper.login` to optionally skip the `/dashboard` URL wait** — the seeded user is an Owner, so `/dashboard` is correct. (Tenant-specific concerns from Story 21.4 don't apply here.)

### Previous Story Intelligence

**Story 21.7 (done, PR #386 — most recent prior story in epic)** — Frontend unit tests for `api.service.ts` (NSwag client) + `auth.interceptor.ts`. Pure Vitest; no overlap with this E2E story. **Carry-over:** test-only-story discipline (no production code modified).

**Story 21.6 (done, PR #384)** — Backend integration tests for `VendorsController` GET/PUT. Confirms the vendor API contract this story uses for the seed helper at Task 1.4. The `POST /api/v1/vendors` body shape can be cross-referenced with that story's test setup.

**Story 21.5 (done, PR #383)** — Backend integration tests for `WorkOrderPhotosController`. Confirms the upload-url + confirm-upload flow this story exercises in AC-6. Read that file before writing AC-6 to align on terminology and request bodies.

**Story 21.4 (done, PR #382 — most recent E2E story)** — Tenant Dashboard E2E. **Primary pattern reference for this story.** Specifically:
- The 3-file structure (helper / page-object / spec) — copy that
- Per-run unique strings via `Date.now()` — copy that
- Fixture wiring in `test-fixtures.ts` — extend the existing pattern
- `expectSnackBar('verbatim string')` after verifying the store's exact message — copy that
- The "do not modify shared `AuthHelper`" rule — copy that. This story doesn't need a custom login (Owner role, `/dashboard` redirect is correct), so just reuse `authenticatedUser`.
- The "deviations from epic text are OK if shipped behavior differs — document them in the AC" pattern — applied here in the reality-check note above for the auto-status-transition contract and the AC-5 (detail-page delete) split.

**Story 21.3 (done, PR #381)** — `ExpensesController` integration consolidation. Established the "split files OK if file would otherwise exceed ~600 lines" rule. This story preemptively splits into 5 spec files (create/edit/delete/photos/pdf) per the epic's explicit "split by flow" guidance.

**Story 18.2 (review)** — E2E test data cleanup. Established the `TestController.reset` endpoint that this story relies on. Read that story for the cleanup contract before writing helpers.

**Story 9.x / 10.x / 12.x** — Original work-order feature stories. Each shipped Vitest-only; their dev notes confirm "E2E coverage deferred to backfill epic." This story IS that backfill.

### Files to create

- `frontend/e2e/helpers/work-order.helper.ts` — token + property + vendor + work-order + reset API helpers (Task 1)
- `frontend/e2e/pages/work-order-form.page.ts` — form POM (Task 3)
- `frontend/e2e/pages/work-order-detail.page.ts` — detail-page POM (Task 4)
- `frontend/e2e/tests/work-orders/work-orders-create.spec.ts` (Task 6)
- `frontend/e2e/tests/work-orders/work-orders-edit.spec.ts` (Task 7)
- `frontend/e2e/tests/work-orders/work-orders-delete.spec.ts` (Task 8)
- `frontend/e2e/tests/work-orders/work-orders-photos.spec.ts` (Task 9)
- `frontend/e2e/tests/work-orders/work-orders-pdf.spec.ts` (Task 10)

### Files to modify

- `frontend/e2e/pages/work-order-list.page.ts` — add `expectRowNotInList`, `expectRowVendor` (Task 2)
- `frontend/e2e/fixtures/test-fixtures.ts` — register the two new page-object fixtures (Task 5)
- `docs/project/sprint-status.yaml` — `21-8-work-orders-e2e: review` (Task 12.1)
- `docs/project/stories/epic-21/21-8-work-orders-e2e.md` — status + Dev Agent Record (Task 12.2, 12.3)

### Files NOT to modify

- `frontend/e2e/tests/work-orders/work-order-list.spec.ts` — existing mocked spec; out of scope. Keep both patterns side-by-side.
- `frontend/e2e/helpers/auth.helper.ts` — works for the Owner role; no changes needed.
- `frontend/e2e/helpers/test-data.helper.ts` / `test-setup.helper.ts` — these are the older UI-driven setup helpers used by the original 5 specs. Don't touch; the new helpers live in `work-order.helper.ts` and use API-driven seeding.
- `frontend/e2e/pages/base.page.ts` — no changes needed; the new POMs extend it.
- Any production code under `frontend/src/` or `backend/src/` — this is a test-only story. No new `data-testid` attributes (existing ones suffice; verified above).
- `backend/src/PropertyManager.Api/Controllers/TestController.cs` — the existing reset already covers WorkOrders, WorkOrderPhotos, WorkOrderTagAssignments, Vendors, Persons, Properties. No extension needed.

### References

- [work-orders.component.ts (existing list view)](../../../frontend/src/app/features/work-orders/work-orders.component.ts) — list row structure, status chips, delete confirmation
- [work-order-create.component.ts](../../../frontend/src/app/features/work-orders/pages/work-order-create/work-order-create.component.ts) — page wraps `WorkOrderFormComponent`
- [work-order-edit.component.ts](../../../frontend/src/app/features/work-orders/pages/work-order-edit/work-order-edit.component.ts) — page wraps `WorkOrderFormComponent` in edit mode; emits `formSubmit` / `formCancel`
- [work-order-detail.component.ts](../../../frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts) — verify all action-button + PDF + photo testids
- [work-order-form.component.ts](../../../frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.ts) — form structure; lines 70-87 (property select), 90-107 (description), 130-135 (status), 137-173 (vendor with auto-Assign), 561-568 (`onVendorChange` auto-status logic)
- [work-order.store.ts](../../../frontend/src/app/features/work-orders/stores/work-order.store.ts) — verbatim snackbar messages: `'Work order created'` (line 192), `'Work order updated'` (line 413), `'Work order deleted'` (line 478)
- [work-order-photo.store.ts](../../../frontend/src/app/features/work-orders/stores/work-order-photo.store.ts) — `'Photo added ✓'` (line 198), upload-url + S3 + confirm flow (lines 150-189)
- [work-order-photo-gallery.component.ts](../../../frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.ts) — `[data-testid="photo-grid"]`, `[data-testid="photo-card-${id}"]`, `[data-testid="empty-state"]`
- [work-order-pdf-preview-dialog.component.ts](../../../frontend/src/app/features/work-orders/components/work-order-pdf-preview-dialog/work-order-pdf-preview-dialog.component.ts) — `[data-testid="wo-pdf-preview-dialog"]`, `[data-testid="download-btn"]`, etc.
- [photo-upload.component.ts](../../../frontend/src/app/shared/components/photo-upload/photo-upload.component.ts) — `[data-testid="file-input"]`
- [confirm-dialog.component.ts](../../../frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts) — confirms `mat-raised-button[color=warn]` is the confirm button (matches `BasePage.confirmDialogConfirmButton` selector)
- [TestController.cs](../../../backend/src/PropertyManager.Api/Controllers/TestController.cs) — verifies reset includes WorkOrders, WorkOrderPhotos, WorkOrderTagAssignments, Vendors, Properties
- [WorkOrdersController.cs](../../../backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs) — endpoint contract reference
- [WorkOrderPhotosController.cs](../../../backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs) — photo upload + confirm endpoint contract
- [api.service.ts (NSwag client)](../../../frontend/src/app/core/api/api.service.ts) — generated method names: `workOrders_*`, `workOrderPhotos_*` (lines 4903-5944)
- [tenant-dashboard.spec.ts (Story 21.4 — PRIMARY E2E PATTERN REFERENCE)](../../../frontend/e2e/tests/tenant-dashboard/tenant-dashboard.spec.ts)
- [tenant.helper.ts (Story 21.4 — PRIMARY HELPER PATTERN REFERENCE)](../../../frontend/e2e/helpers/tenant.helper.ts)
- [work-order-list.spec.ts (existing — DO NOT MODIFY)](../../../frontend/e2e/tests/work-orders/work-order-list.spec.ts) — mocked-API pattern reference for understanding what's already covered
- [work-order-list.page.ts (existing — extend)](../../../frontend/e2e/pages/work-order-list.page.ts)
- [test-fixtures.ts (existing — extend)](../../../frontend/e2e/fixtures/test-fixtures.ts)
- [base.page.ts (existing)](../../../frontend/e2e/pages/base.page.ts) — confirms snackbar / dialog / loading helpers
- [auth.helper.ts (existing — DO NOT MODIFY)](../../../frontend/e2e/helpers/auth.helper.ts)
- [global-teardown.ts (existing)](../../../frontend/e2e/global-teardown.ts) — reset-endpoint usage pattern
- [playwright.config.ts (existing — DO NOT MODIFY)](../../../frontend/playwright.config.ts) — confirms `workers: process.env.CI ? 1 : undefined` and the global teardown wiring
- [receipts/receipt-upload.spec.ts (existing)](../../../frontend/e2e/tests/receipts/receipt-upload.spec.ts) — pattern for `setInputFiles` + S3 mocking via `page.route`
- [Story 21.4 (done)](./21-4-tenant-dashboard-e2e.md) — most-recent E2E story; the patterns this story extends
- [Story 21.5 (done)](./21-5-work-order-photos-controller-integration-tests.md) — backend integration coverage for the photo flow this story exercises
- [Story 21.7 (done)](./21-7-core-frontend-service-unit-tests.md) — most-recent prior story in epic; "test-only story" discipline reference
- [Story 18.2 (review)](../epic-18/18-2-e2e-test-data-cleanup.md) — origin of `TestController.reset` and the cleanup contract
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic
- [project-context.md](../../project-context.md) — testing conventions
- [Playwright `setInputFiles` (verified Apr 2026 via Ref MCP)](https://playwright.dev/docs/api/class-locator#locator-set-input-files) — buffer-payload signature
- [Playwright `page.waitForEvent('download')` (verified Apr 2026)](https://playwright.dev/docs/api/class-page#page-wait-for-download)
- [Playwright `page.route` mocking (verified Apr 2026)](https://playwright.dev/docs/mock) — `route.fulfill({ status: 200 })` pattern
- CLAUDE.md → "E2E Testing Rules (Playwright)" — the rules this story must obey
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `/dev-story` skill via `/orchestrate`.

### Debug Log References

- `npx playwright test e2e/tests/work-orders --workers=1` → 19 passed (14.7s) on first run
- Re-ran same command back-to-back → 19 passed (15.3s) — idempotency verified per Task 11.2
- Wider regression `npx playwright test e2e/tests/work-orders e2e/tests/expenses/expense-flow.spec.ts e2e/tests/invitations/invitation-flow.spec.ts --workers=1` → 27 passed (38.8s)
- Full suite `npx playwright test --workers=1` → 226 passed (6.5m)
- TypeScript check `npx tsc --noEmit -p e2e/tsconfig.json` → only pre-existing `e2e/tests/reports/report-flow.spec.ts(23,41)` error, unrelated to this story

### Completion Notes List

- **Selector verification surprises (corrected from story text):**
  - The work-order detail page Edit button is `<button mat-stroked-button [routerLink]>` (not `<a routerLink>` as the story stated). Used `.action-buttons button:has-text("Edit")` instead. Behavior is identical (router-link navigation).
  - The PDF endpoint is `POST /api/v1/work-orders/{id}/pdf` (not GET as AC-7 stated). The frontend's `WorkOrderService.generateWorkOrderPdf` POSTs an empty body (`work-order.service.ts:222`); test asserts the POST response.
- **Store redirects (corrected from story text):**
  - `WorkOrderStore.createWorkOrder` redirects to `/work-orders/{id}` (detail page) on success (`work-order.store.ts:199`), not to the list. Test navigates back to the list explicitly to assert the row.
  - `WorkOrderStore.deleteWorkOrder` only redirects to `/work-orders` when delete was triggered from the detail page (`work-order.store.ts:484-487`). List-row delete leaves the user on the list. Both flows tested separately.
- **S3 mock strategy (AC-6):** The dev backend uses real AWS S3 (verified `S3StorageService.cs`), so `page.route('**/*.amazonaws.com/**', route => route.fulfill({ status: 200 }))` registered before the upload click is sufficient. The `ConfirmUpload` endpoint succeeds without verifying object existence, so the mocked PUT drives the chain to completion and creates a real `WorkOrderPhoto` row that gets cleaned up by `afterAll`.
- **TestController.reset 500 caveat:** When this spec runs after `tenant-dashboard.spec.ts` or `invitation-flow.spec.ts` have created `MaintenanceRequests` rows, the `TestController.reset` endpoint 500s with FK violation on `MaintenanceRequests`. This is a pre-existing bug in `TestController` (it doesn't delete `MaintenanceRequests`), unrelated to this story. The helper handles it gracefully with a warning, matching `global-teardown.ts` resilience. Tests still pass because per-run unique strings (`Date.now()`) ensure assertions only match current-run data. **Recommendation for follow-up:** add a separate cleanup story to extend `TestController.reset` to delete `MaintenanceRequestPhotos` and `MaintenanceRequests`.
- **Form submit auto-Assign:** Verified in `work-order-form.component.ts:561-566` — selecting any vendor while status is `Reported` auto-patches status to `Assigned`. The AC-2 test asserts this transition before submit via `expectStatusValue('Assigned')`.
- **Snackbar verbatim strings:** Used the exact message text from the stores — `'Work order created'`, `'Work order updated'`, `'Work order deleted'`, `'Photo added ✓'` (with checkmark), `'PDF downloaded'`. No fuzzy matching.
- No production code modified. No new `data-testid` attributes added.

### File List

**Created:**
- `frontend/e2e/helpers/work-order.helper.ts` — token + property + vendor + work-order + reset API helpers
- `frontend/e2e/pages/work-order-form.page.ts` — create/edit form POM
- `frontend/e2e/pages/work-order-detail.page.ts` — detail-page POM (edit/delete/PDF/photo flows)
- `frontend/e2e/tests/work-orders/work-orders-create.spec.ts` — AC-1, AC-2 (2 tests)
- `frontend/e2e/tests/work-orders/work-orders-edit.spec.ts` — AC-3 (1 test)
- `frontend/e2e/tests/work-orders/work-orders-delete.spec.ts` — AC-4, AC-5 (2 tests)
- `frontend/e2e/tests/work-orders/work-orders-photos.spec.ts` — AC-6 (1 test)
- `frontend/e2e/tests/work-orders/work-orders-pdf.spec.ts` — AC-7, AC-8 (2 tests)

**Modified:**
- `frontend/e2e/pages/work-order-list.page.ts` — added `expectRowNotInList`, `expectRowVendor`
- `frontend/e2e/fixtures/test-fixtures.ts` — registered `workOrderFormPage`, `workOrderDetailPage` fixtures
- `docs/project/sprint-status.yaml` — `21-8-work-orders-e2e: review`
- `docs/project/stories/epic-21/21-8-work-orders-e2e.md` — Status, task ticks, Dev Agent Record

**Not modified (per story Files NOT to modify):**
- `frontend/e2e/tests/work-orders/work-order-list.spec.ts` (mocked spec — out of scope)
- `frontend/e2e/helpers/auth.helper.ts`
- `frontend/e2e/helpers/test-data.helper.ts` / `test-setup.helper.ts`
- `frontend/e2e/pages/base.page.ts`
- `backend/src/PropertyManager.Api/Controllers/TestController.cs`
- `frontend/playwright.config.ts`
- All production code under `frontend/src/` and `backend/src/`
