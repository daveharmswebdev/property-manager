# ATDD Checklist - Story 16.3: Desktop Receipt Upload

**Date:** 2026-02-20
**Author:** Dave
**Primary Test Level:** E2E (Playwright) + Component (Vitest)

---

## Story Summary

Desktop receipt upload enables property owners to upload receipts directly from the Receipts page without needing a mobile device. This is a frontend-only story — all backend infrastructure (presigned URLs, S3 upload, SignalR) already exists.

**As a** property owner on desktop
**I want** to upload receipts directly from the Receipts page
**So that** I don't need my phone to capture receipts

---

## Acceptance Criteria

1. **AC1** — Upload button in page header (visible, consistent with Expenses pattern)
2. **AC2** — Drag-and-drop upload dialog (accepts JPEG, PNG, PDF; max 10MB each)
3. **AC3** — Optional property assignment via PropertyTagModalComponent
4. **AC4** — Upload success (receipts appear in queue via SignalR, snackbar confirms)
5. **AC5** — Multi-file support (one receipt record per file)
6. **AC6** — Error handling (file-specific errors, other valid files still upload)
7. **AC7** — Desktop and tablet viewports (>= 768px)

---

## Failing Tests Created (RED Phase)

### E2E Tests (11 tests)

**File:** `frontend/e2e/tests/receipts/receipt-upload.spec.ts` (365 lines)

- **Test:** should display Upload Receipt button on receipts page
  - **Status:** RED — `[data-testid="upload-receipt-btn"]` not found (element doesn't exist)
  - **Verifies:** AC1 — Upload button presence

- **Test:** should display Upload Receipt button with cloud_upload icon
  - **Status:** RED — Upload button doesn't exist in template
  - **Verifies:** AC1 — Button icon matches pattern

- **Test:** should display page header with title and subtitle
  - **Status:** RED — `.page-header` CSS class doesn't exist
  - **Verifies:** AC1 — Expenses-style page header pattern

- **Test:** should open upload dialog when Upload Receipt is clicked
  - **Status:** RED — Can't click non-existent button
  - **Verifies:** AC2 — Dialog opens with drag-drop zone

- **Test:** should show dialog accepting JPEG, PNG, and PDF
  - **Status:** RED — Dialog doesn't exist
  - **Verifies:** AC2 — File input accept attribute includes PDF

- **Test:** should show dialog title "Upload Receipts"
  - **Status:** RED — Dialog doesn't exist
  - **Verifies:** AC2 — Dialog title

- **Test:** should open PropertyTagModal after files selected and Upload clicked
  - **Status:** RED — Upload dialog flow doesn't exist
  - **Verifies:** AC3 — Property assignment prompt after file selection

- **Test:** should show success snackbar after upload completes
  - **Status:** RED — Upload flow doesn't exist (APIs mocked via `page.route()`)
  - **Verifies:** AC4 — Success feedback

- **Test:** should confirm multiple receipts uploaded for multi-file selection
  - **Status:** RED — Upload flow doesn't exist (APIs mocked)
  - **Verifies:** AC5 — Multi-file handling with correct count in snackbar

- **Test:** should show error snackbar when upload fails
  - **Status:** RED — Upload flow doesn't exist (API mocked to fail)
  - **Verifies:** AC6 — Error feedback with file context

- **Test:** should show upload button on tablet viewport (768px)
  - **Status:** RED — Upload button doesn't exist
  - **Verifies:** AC7 — Tablet viewport support

### Component Tests — Vitest (3 tests, RED verified)

**File:** `frontend/src/app/features/receipts/receipts.component.spec.ts` (added to existing)

- **Test:** should render Upload Receipt button (AC1)
  - **Status:** RED — `expected null to be truthy` (element not in template)
  - **Verifies:** AC1 — `[data-testid="upload-receipt-btn"]` present

- **Test:** should render page header with Expenses-style layout (AC1)
  - **Status:** RED — `expected null to be truthy` (`.page-header` not in template)
  - **Verifies:** AC1 — Page header structure

- **Test:** should render subtitle in page header (AC1)
  - **Status:** RED — `expected null to be truthy` (`.subtitle` not in template)
  - **Verifies:** AC1 — Subtitle element

### Component Tests — Deferred to GREEN Phase (7 tests)

These tests require TypeScript-typed method calls or imports of non-existent components. They will be written during implementation alongside the code they test.

**File:** `frontend/src/app/features/receipts/components/receipt-upload-dialog/receipt-upload-dialog.component.spec.ts` (NEW — create with component)

- Dialog renders with DragDropUpload component
- Upload button disabled when no files selected
- Cancel closes dialog with null
- Upload closes dialog with selected files array

**File:** `frontend/src/app/features/receipts/receipts.component.spec.ts` (additions during GREEN phase)

- onUploadReceipt opens ReceiptUploadDialogComponent
- dialog cancel does not proceed to PropertyTagModal
- successful upload shows success snackbar with correct message

---

## Data Factories Created

**None required.** This story uses:
- Fake file buffers (`Buffer.from('fake-image-data')`) for E2E file selection
- Existing mock patterns for Vitest (signal mocks, `vi.fn()`)

---

## Fixtures Created

**No new fixtures.** Uses existing:
- `authenticatedUser` fixture (auto-login with seeded account)
- All existing Vitest TestBed setup patterns from `receipts.component.spec.ts`

---

## Mock Requirements

### E2E — API Route Interception (for AC4-AC6 tests)

**Presigned URL Endpoint:**
- Route: `*/**/api/v1/receipts/upload-url`
- Success: `{ uploadUrl: "https://mock-s3.example.com/upload", storageKey: "test-key" }`
- Failure: `500` with error body

**S3 Upload:**
- Route: `https://mock-s3.example.com/**`
- Success: `200` empty body

**Receipt Creation:**
- Route: `*/**/api/v1/receipts` (POST only, GET passes through)
- Success: `201` with `{ id: "new-receipt-id" }`

**Notes:** Routes set up BEFORE navigation (network-first pattern). GET requests to `/receipts` for loading unprocessed queue pass through to the real API.

### Vitest — Service Mocks (existing)

- `MatDialog.open()` → mock `afterClosed()` with `of(files)` or `of(tagResult)`
- `MatSnackBar.open()` → spy
- `ReceiptCaptureService.uploadReceipt()` → mock resolved/rejected promise (deferred tests)

---

## Required data-testid Attributes

### Receipts Page (ReceiptsComponent)

- `upload-receipt-btn` — Upload Receipt button in page header (**NEW**)

### Upload Dialog (ReceiptUploadDialogComponent)

- `drag-drop-zone` — DragDropUploadComponent zone (**already exists** on component)
- `file-input` — Hidden file input element (**already exists** on component)

**Note:** No new data-testid attributes needed on DragDropUploadComponent or PropertyTagModalComponent — both reused as-is.

---

## Implementation Checklist

### Test: Upload Receipt button renders (Vitest + E2E AC1/AC7)

**Files:** `receipts.component.ts`, `receipts.component.spec.ts`

**Tasks to make these tests pass:**

- [ ] Replace bare `<h1 class="page-title">` with page-header pattern from Expenses
- [ ] Add `data-testid="upload-receipt-btn"` to Upload Receipt button
- [ ] Add `cloud_upload` mat-icon to button
- [ ] Add `.page-header`, `.page-header-content`, `.subtitle` styles
- [ ] Add `MatButtonModule` to component imports
- [ ] Run Vitest: `npm test` from `/frontend`
- [ ] ✅ 3 Vitest tests pass (green phase)
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC1 + AC7 tests)
- [ ] ✅ AC1 + AC7 E2E tests pass

---

### Test: Upload dialog opens with drag-drop zone (E2E AC2)

**Files:** `receipt-upload-dialog.component.ts` (NEW), `receipt-upload-dialog.component.spec.ts` (NEW)

**Tasks to make these tests pass:**

- [ ] Create `ReceiptUploadDialogComponent` standalone component
- [ ] Inject `MatDialogRef`
- [ ] Template: `mat-dialog-title` "Upload Receipts", `mat-dialog-content` with `<app-drag-drop-upload>`
- [ ] **Critical:** Pass `accept="image/jpeg,image/png,application/pdf"` to DragDropUploadComponent
- [ ] Pass `multiple="true"` explicitly
- [ ] Track selected files via `filesSelected` output
- [ ] Upload button disabled when no files; Cancel button always enabled
- [ ] Cancel → `dialogRef.close(null)`, Upload → `dialogRef.close(selectedFiles)`
- [ ] Dialog width: `500px`
- [ ] Write dialog spec: renders, disabled button, cancel/upload close behavior
- [ ] Run Vitest: `npm test` from `/frontend`
- [ ] ✅ Dialog spec tests pass
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC2 tests)
- [ ] ✅ AC2 E2E tests pass

---

### Test: PropertyTagModal opens after file selection (E2E AC3)

**File:** `receipts.component.ts`

**Tasks to make these tests pass:**

- [ ] Add `onUploadReceipt()` method triggered by button click
- [ ] Open `ReceiptUploadDialogComponent` via `MatDialog.open()`
- [ ] Await dialog close with `firstValueFrom(dialogRef.afterClosed())`
- [ ] If files returned (not null/empty), open `PropertyTagModalComponent`
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC3 test)
- [ ] ✅ AC3 E2E test passes

---

### Test: Upload success with snackbar (E2E AC4)

**File:** `receipts.component.ts`

**Tasks to make these tests pass:**

- [ ] After PropertyTagModal close, extract `propertyId` from result
- [ ] If result is `undefined` (backdrop dismiss), abort
- [ ] Loop through files, call `receiptCaptureService.uploadReceipt(file, propertyId)` for each
- [ ] Track `successCount` and `failCount`
- [ ] Show success snackbar: "Receipt uploaded successfully" (single) or "{n} receipts uploaded successfully" (multi)
- [ ] **Do NOT manually call `store.addToQueue()`** — SignalR handles it
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC4 test)
- [ ] ✅ AC4 E2E test passes

---

### Test: Multi-file upload (E2E AC5)

**File:** `receipts.component.ts`

**Tasks to make these tests pass:**

- [ ] Verify loop creates one upload per file
- [ ] Snackbar shows correct count
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC5 test)
- [ ] ✅ AC5 E2E test passes

---

### Test: Error handling (E2E AC6)

**File:** `receipts.component.ts`

**Tasks to make these tests pass:**

- [ ] Each file upload wrapped in try/catch
- [ ] Failed upload shows error snackbar with filename: `Failed to upload {filename}`
- [ ] Other valid files continue uploading despite individual failures
- [ ] Run E2E: `npm run test:e2e -- receipt-upload.spec.ts` (AC6 test)
- [ ] ✅ AC6 E2E test passes

---

### Test: isUploading state (Vitest — deferred)

**File:** `receipts.component.ts`, `receipts.component.spec.ts`

**Tasks to make these tests pass:**

- [ ] Add `isUploading = signal(false)` to component
- [ ] Set `true` before upload loop, `false` after
- [ ] Disable Upload Receipt button when `isUploading()` is true
- [ ] Swap icon to `hourglass_empty` during upload
- [ ] Write Vitest test for disabled state
- [ ] Run Vitest: `npm test` from `/frontend`
- [ ] ✅ isUploading test passes

---

## Running Tests

```bash
# Run all Vitest tests (includes RED phase component tests)
cd frontend && npm test

# Run only receipts component spec
cd frontend && npm test -- receipts.component

# Run E2E tests for this story only
cd frontend && npm run test:e2e -- --grep "Desktop Receipt Upload"

# Run E2E tests with headed browser
cd frontend && npm run test:e2e -- --grep "Desktop Receipt Upload" --headed

# Run E2E tests in debug mode
cd frontend && npm run test:e2e -- --grep "Desktop Receipt Upload" --debug

# Run all E2E receipt tests
cd frontend && npm run test:e2e -- e2e/tests/receipts/
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ 11 E2E tests written (Playwright) — all will fail (elements don't exist)
- ✅ 3 Vitest component tests written — all fail (`expected null to be truthy`)
- ✅ 7 additional Vitest tests documented for GREEN phase creation
- ✅ API mock strategy documented (page.route for presigned URL, S3, receipt creation)
- ✅ Required data-testid attributes listed
- ✅ Implementation checklist created with clear tasks

**Verification:**

- Vitest: 3 failed | 2389 passed (verified 2026-02-20)
- E2E: Not run (requires running infrastructure) — tests structured to fail on missing UI elements
- All failures due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task 1** — Page header update (makes 3 Vitest + 3 E2E tests pass)
2. **Then Task 2** — ReceiptUploadDialogComponent (makes 3 E2E dialog tests pass)
3. **Then Task 3** — Upload orchestration (makes AC3-AC6 E2E tests pass)
4. **Then Task 4** — Write deferred Vitest tests alongside implementation
5. **Finally Task 5** — Run full test suite, verify all green

**Key Principles:**

- One test group at a time (don't try to fix all at once)
- Follow the story file task order (matches dependency chain)
- Run tests frequently (immediate feedback)
- **Critical:** Pass `accept="image/jpeg,image/png,application/pdf"` to DragDropUploadComponent — default excludes PDF

**Progress Tracking:**

- Check off tasks in this checklist as completed
- Update story status in `sprint-status.yaml`

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all tests pass (Vitest + E2E)
2. Review code for consistency with existing patterns (Expenses page header, MobileCaptureFab upload flow)
3. Ensure no unnecessary imports or dead code
4. Run full test suite: `npm test` and `npm run test:e2e`
5. Ready for code review

---

## Next Steps

1. **Run failing Vitest tests** to confirm RED phase: `cd frontend && npm test`
2. **Begin implementation** using story file tasks as guide
3. **Work one test group at a time** (header → dialog → orchestration)
4. **Write deferred Vitest tests** alongside implementation in GREEN phase
5. **When all tests pass**, refactor for quality
6. **When refactoring complete**, update story status to 'done' in `sprint-status.yaml`

---

## Knowledge Base References Applied

- **selector-resilience.md** — data-testid > ARIA > text > CSS hierarchy for stable selectors
- **network-first.md** — Route interception BEFORE navigation to prevent race conditions
- **test-quality.md** — Given-When-Then structure, deterministic tests, clear assertion messages
- **component-tdd.md** — Red-green-refactor cycle, component DOM assertions
- **timing-debugging.md** — `waitForLoadState('networkidle')` for page stabilization

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd frontend && npm test`

**Results:**

```
 Test Files  1 failed | 102 passed (103)
      Tests  3 failed | 2389 passed (2392)
   Start at  19:33:21
   Duration  35.16s
```

**Summary:**

- Total new tests: 3 (Vitest) + 11 (E2E, pending infrastructure)
- Vitest Passing: 0 of 3 new (expected)
- Vitest Failing: 3 of 3 new (expected)
- Existing tests: 2389 passed (no regressions)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

- `AssertionError: expected null to be truthy` — DOM elements not in template yet

---

## Notes

- Zero backend changes required — all upload infrastructure exists from Story 5.x
- **DragDropUploadComponent default `accept` excludes PDF** — must explicitly pass `accept="image/jpeg,image/png,application/pdf"`
- E2E tests use `page.route()` to mock upload APIs — avoids polluting shared test database
- Existing `MobileCaptureFabComponent` upload pattern is the direct reference for desktop flow
- The `isUploading` signal test is deferred because it requires TypeScript method references that don't exist yet

---

**Generated by BMad TEA Agent** - 2026-02-20
