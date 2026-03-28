# Story 16.3: Desktop Receipt Upload

Status: done

## Story

As a **property owner on desktop**,
I want **to upload receipts directly from the Receipts page**,
So that **I don't need my phone to capture receipts**.

**GitHub Issue:** #234
**Prerequisites:** None
**Effort:** Small-Medium — all backend exists, frontend-only changes

## Acceptance Criteria

### AC1 — Upload button in page header

**Given** I am on the `/receipts` page
**When** I view the page header
**Then** I see an "Upload Receipt" button consistent with Expenses/Properties header pattern

### AC2 — Drag-and-drop upload dialog

**Given** I click "Upload Receipt"
**When** the dialog opens
**Then** I see a drag-and-drop zone accepting JPEG, PNG, and PDF (max 10MB each)

### AC3 — Optional property assignment

**Given** I select files to upload
**When** I click Upload in the dialog
**Then** I'm prompted to optionally assign a property via PropertyTagModalComponent

### AC4 — Upload success

**Given** files are uploaded successfully
**When** the upload completes
**Then** receipts appear in the unprocessed queue (SignalR auto-pushes)
**And** a snackbar confirms success

### AC5 — Multi-file support

**Given** I select multiple files
**When** they upload
**Then** one receipt record is created per file

### AC6 — Error handling

**Given** a file fails validation or upload
**When** the error occurs
**Then** a snackbar shows the specific error (file too large, wrong type, upload failure)
**And** other valid files still upload successfully

### AC7 — Desktop and tablet viewports

**Given** I am on any viewport >= 768px wide
**When** I view the receipts page
**Then** the upload button is visible and functional

## Tasks / Subtasks

### Task 1: Create ReceiptUploadDialogComponent (AC: #2, #5)

> **Why:** Wraps `DragDropUploadComponent` in a `MatDialog` for the upload flow. Simple dialog: file selection → confirm.

**New file:** `frontend/src/app/features/receipts/components/receipt-upload-dialog/receipt-upload-dialog.component.ts`

- [x] 1.1 Create standalone component with:
  - `MatDialogRef<ReceiptUploadDialogComponent>` injected
  - Inline template with `mat-dialog-title` "Upload Receipts", `mat-dialog-content` containing `<app-drag-drop-upload>`, `mat-dialog-actions` with Cancel and Upload buttons
  - **Critical:** Pass `accept="image/jpeg,image/png,application/pdf"` to `DragDropUploadComponent` — default excludes PDF
  - Pass `multiple="true"` (already default, but be explicit)
  - Track selected files via `filesSelected` output from `DragDropUploadComponent`
  - Upload button disabled when no files selected
  - On Cancel → `dialogRef.close(null)`
  - On Upload → `dialogRef.close(selectedFiles)`
  - Dialog width: `500px`

- [x] 1.2 Imports required:
  ```typescript
  import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
  import { MatButtonModule } from '@angular/material/button';
  import { DragDropUploadComponent } from '../../../../shared/components/drag-drop-upload/drag-drop-upload.component';
  ```

- [x] 1.3 Unit test: `receipt-upload-dialog.component.spec.ts`
  - Dialog renders with DragDropUpload component
  - Upload button disabled when no files
  - Cancel closes dialog with null
  - Upload closes dialog with selected files array

### Task 2: Update receipts page header (AC: #1, #7)

> **Why:** Current page has only a bare `<h1>`. Match the Expenses page header pattern: `div.page-header > div.page-header-content` with title + subtitle on left, action button on right.

**File:** `frontend/src/app/features/receipts/receipts.component.ts`

- [x] 2.1 Replace the bare `<h1 class="page-title">Receipts to Process</h1>` with the standard header pattern:
  ```html
  <div class="page-header">
    <div class="page-header-content">
      <div>
        <h1>Receipts</h1>
        <p class="subtitle">Upload and process receipts for your properties</p>
      </div>
      <button mat-stroked-button color="primary" (click)="onUploadReceipt()" data-testid="upload-receipt-btn">
        <mat-icon>cloud_upload</mat-icon>
        <span class="button-text">Upload Receipt</span>
      </button>
    </div>
  </div>
  ```

- [x] 2.2 Add page-header styles (copy from expenses pattern):
  ```scss
  .page-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  @media (max-width: 599px) {
    .page-header-content {
      flex-direction: column;
      align-items: stretch;
    }
  }
  ```

- [x] 2.3 Add `MatButtonModule` and `MatDialogModule` to component imports (if not already present)

### Task 3: Implement upload orchestration in ReceiptsComponent (AC: #2, #3, #4, #5, #6)

> **Why:** The receipts page component orchestrates the full flow: open dialog → get files → open PropertyTagModal → upload each file via ReceiptCaptureService. Pattern mirrors MobileCaptureFabComponent but for batch.

**File:** `frontend/src/app/features/receipts/receipts.component.ts`

- [x] 3.1 Add imports:
  ```typescript
  import { MatDialog } from '@angular/material/dialog';
  import { ReceiptUploadDialogComponent } from './components/receipt-upload-dialog/receipt-upload-dialog.component';
  import { PropertyTagModalComponent, PropertyTagResult } from './components/property-tag-modal/property-tag-modal.component';
  import { ReceiptCaptureService } from './services/receipt-capture.service';
  import { firstValueFrom } from 'rxjs';
  ```

- [x] 3.2 Inject `ReceiptCaptureService` (dialog and snackBar already injected):
  ```typescript
  private readonly receiptCaptureService = inject(ReceiptCaptureService);
  ```

- [x] 3.3 Add `isUploading = signal(false)` to track upload state

- [x] 3.4 Implement `onUploadReceipt()` method:
  ```typescript
  async onUploadReceipt(): Promise<void> {
    // Step 1: Open file selection dialog
    const dialogRef = this.dialog.open(ReceiptUploadDialogComponent, { width: '500px' });
    const files: File[] | null = await firstValueFrom(dialogRef.afterClosed());
    if (!files || files.length === 0) return;

    // Step 2: Open PropertyTagModal for optional property assignment
    const tagRef = this.dialog.open(PropertyTagModalComponent, { width: '300px' });
    const tagResult: PropertyTagResult | undefined = await firstValueFrom(tagRef.afterClosed());
    if (tagResult === undefined) return; // backdrop dismiss = abort

    const propertyId = tagResult.propertyId || undefined;

    // Step 3: Upload each file
    this.isUploading.set(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      try {
        await this.receiptCaptureService.uploadReceipt(file, propertyId);
        successCount++;
      } catch {
        failCount++;
        this.snackBar.open(`Failed to upload ${file.name}`, 'Dismiss', { duration: 5000 });
      }
    }

    this.isUploading.set(false);

    if (successCount > 0) {
      const msg = successCount === 1
        ? 'Receipt uploaded successfully'
        : `${successCount} receipts uploaded successfully`;
      this.snackBar.open(msg, 'Dismiss', { duration: 3000 });
    }
  }
  ```

- [x] 3.5 **Do NOT manually call `store.addToQueue()`** — SignalR `ReceiptAdded` event fires from backend on each `POST /receipts` and the `ReceiptSignalRService` already handles `addReceiptRealTime()` to update the queue automatically.

- [x] 3.6 Disable the Upload button while `isUploading()` is true (prevents double-submit):
  ```html
  <button ... [disabled]="isUploading()" (click)="onUploadReceipt()">
    @if (isUploading()) {
      <mat-icon>hourglass_empty</mat-icon>
    } @else {
      <mat-icon>cloud_upload</mat-icon>
    }
    <span class="button-text">Upload Receipt</span>
  </button>
  ```

### Task 4: Unit tests for upload orchestration (AC: all)

**File:** `frontend/src/app/features/receipts/receipts.component.spec.ts`

- [x] 4.1 Add test: "Upload Receipt button renders"
- [x] 4.2 Add test: "onUploadReceipt opens ReceiptUploadDialogComponent"
- [x] 4.3 Add test: "dialog cancel does not open PropertyTagModal"
- [x] 4.4 Add test: "after file selection, PropertyTagModal opens"
- [x] 4.5 Add test: "PropertyTagModal skip (null propertyId) still uploads files"
- [x] 4.6 Add test: "PropertyTagModal dismiss (undefined) aborts upload"
- [x] 4.7 Add test: "successful upload shows success snackbar"
- [x] 4.8 Add test: "multi-file upload calls receiptCaptureService for each file"
- [x] 4.9 Add test: "failed upload shows error snackbar with filename"
- [x] 4.10 Add test: "isUploading signal disables button during upload"

### Task 5: Run all tests (AC: all)

- [x] 5.1 `npm test` from `/frontend` — all existing + new tests pass (NEVER use `npx vitest`)
- [x] 5.2 Verify no TypeScript compilation errors
- [x] 5.3 Manual smoke test: navigate to `/receipts`, click "Upload Receipt", select files, optionally assign property, verify receipts appear in queue

## Dev Notes

### Zero Backend Changes

The backend is **fully complete** for desktop upload. All endpoints exist and are validated:

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `POST /api/v1/receipts/upload-url` | Generate presigned S3 PUT URL |
| 2 | Direct PUT to S3 URL | Client uploads file bytes directly |
| 3 | `POST /api/v1/receipts` | Confirm upload, create receipt record |

- `ReceiptCaptureService.uploadReceipt(file, propertyId?)` handles all 3 steps
- Validation: `image/jpeg`, `image/png`, `application/pdf` — max 10MB per file
- SignalR `ReceiptAdded` event fires on step 3 completion, auto-updates the queue

### Critical: DragDropUploadComponent `accept` Input

**The default `accept` on `DragDropUploadComponent` is `'image/jpeg,image/png'` — PDF is excluded.**

You **must** pass `accept="image/jpeg,image/png,application/pdf"` when using this component for receipts. The `acceptHint` computed signal will display "JPG, PNG, PDF" correctly (falls through to `type.split('/')[1].toUpperCase()`).

### What Already Exists (Don't Rebuild)

| Component / Service | Path | What it does |
|---|---|---|
| `DragDropUploadComponent` | `shared/components/drag-drop-upload/drag-drop-upload.component.ts` | Drag-and-drop file selection with previews, validation, multi-file support |
| `ReceiptCaptureService` | `features/receipts/services/receipt-capture.service.ts` | 3-step presigned URL upload flow, validation helpers |
| `PropertyTagModalComponent` | `features/receipts/components/property-tag-modal/property-tag-modal.component.ts` | Optional property assignment dialog (Skip or Save) |
| `ReceiptStore` | `features/receipts/stores/receipt.store.ts` | Unprocessed queue state, `addReceiptRealTime()` for SignalR |
| `ReceiptSignalRService` | `features/receipts/services/receipt-signalr.service.ts` | Listens for `ReceiptAdded`/`ReceiptLinked`/`ReceiptDeleted` events |
| `ReceiptQueueItemComponent` | `features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts` | Queue item card with thumbnail/PDF icon, delete button |
| `ReceiptsComponent` | `features/receipts/receipts.component.ts` | The receipts page — **modify this** |

### MobileCaptureFab Upload Pattern (Reference)

The mobile flow in `MobileCaptureFabComponent` is the exact pattern to follow for desktop:

1. File selected → validate type + size
2. Open `PropertyTagModalComponent` → get `propertyId | null`
3. `receiptCaptureService.uploadReceipt(file, propertyId)` → returns receipt ID
4. Show success/error snackbar
5. SignalR handles queue update

Desktop difference: multiple files, dialog-based file selection instead of camera.

### Page Header Pattern

Follow the Expenses page header (most recent reference):

```html
<div class="page-header">
  <div class="page-header-content">
    <div>
      <h1>Title</h1>
      <p class="subtitle">Description text</p>
    </div>
    <button mat-stroked-button color="primary" (click)="onAction()">
      <mat-icon>icon</mat-icon>
      <span class="button-text">Label</span>
    </button>
  </div>
</div>
```

Uses `mat-stroked-button` (not `mat-raised-button`). Flex with `space-between`. Collapses to stack on mobile.

### ReceiptCaptureService API

```typescript
// Upload one file — returns receipt ID
async uploadReceipt(file: File, propertyId?: string): Promise<string>

// Validation helpers
isValidFileType(contentType: string): boolean   // checks against ALLOWED_CONTENT_TYPES
isValidFileSize(fileSizeBytes: number): boolean // checks <= 10MB
getMaxFileSizeBytes(): number                    // 10485760
getAllowedFileTypes(): string[]                  // ['image/jpeg', 'image/png', 'application/pdf']
```

### PropertyTagModalComponent API

```typescript
// Open dialog
const dialogRef = this.dialog.open(PropertyTagModalComponent, { width: '300px' });
const result: PropertyTagResult | undefined = await firstValueFrom(dialogRef.afterClosed());

// Result interpretation
result === undefined → backdrop dismiss, abort upload
result.propertyId === null → user clicked "Skip"
result.propertyId === 'some-guid' → user selected a property
```

### DragDropUploadComponent API

```typescript
// Inputs
accept = input('image/jpeg,image/png');       // OVERRIDE THIS for receipts!
maxSizeBytes = input(10 * 1024 * 1024);       // 10MB default, matches service
multiple = input(true);                        // multi-file default
disabled = input(false);

// Outputs
filesSelected = output<File[]>();              // emitted after validation
uploadError = output<string>();                // emitted on validation failure
```

The component handles its own file type and size validation internally — invalid files are rejected with `uploadError` output.

### Files NOT to Modify

- `MobileCaptureFabComponent` — mobile FAB stays as-is (dashboard only, mobile only)
- `ReceiptCaptureService` — reuse as-is, no changes needed
- `PropertyTagModalComponent` — reuse as-is
- `DragDropUploadComponent` — reuse as-is (just pass correct `accept` input)
- `ReceiptStore` — no changes needed (SignalR handles updates)
- `ReceiptSignalRService` — no changes needed
- Any backend files — zero backend changes

### Project Structure Notes

**New files:**
```
frontend/src/app/features/receipts/components/
└── receipt-upload-dialog/
    ├── receipt-upload-dialog.component.ts       # NEW
    └── receipt-upload-dialog.component.spec.ts  # NEW
```

**Modified files:**
```
frontend/src/app/features/receipts/receipts.component.ts   # Header + upload orchestration
frontend/src/app/features/receipts/receipts.component.spec.ts  # New tests
```

### Testing Requirements

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- `receipt-upload-dialog.component.spec.ts` — dialog renders, file selection, cancel/upload actions
- `receipts.component.spec.ts` — upload button, dialog flow, PropertyTagModal flow, success/error snackbars, multi-file, isUploading state

### Previous Story Intelligence (16.2)

Story 16.2 established:
- `firstValueFrom()` for awaiting dialog results — use this pattern for both dialogs
- `MatDialog.open()` with typed dialog components — same pattern here
- `mat-stroked-button color="primary"` for page header action buttons
- `page-header` / `page-header-content` CSS pattern for consistent headers
- `data-testid` attributes on key elements for E2E targeting
- `ConfirmDialogComponent` pattern for dialogs (reference only, not used here)

### References

- [GitHub Issue #234](https://github.com/daveharmswebdev/property-manager/issues/234) — Desktop receipt upload
- [Source: `features/receipts/receipts.component.ts` — Receipts page to modify]
- [Source: `shared/components/drag-drop-upload/drag-drop-upload.component.ts` — Reuse for file selection]
- [Source: `features/receipts/services/receipt-capture.service.ts` — 3-step upload flow]
- [Source: `features/receipts/components/property-tag-modal/property-tag-modal.component.ts` — Property assignment dialog]
- [Source: `features/receipts/components/mobile-capture-fab/mobile-capture-fab.component.ts` — Upload pattern reference]
- [Source: `features/receipts/stores/receipt.store.ts` — Queue state management]
- [Source: `features/expenses/expenses.component.ts` — Page header pattern reference]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None required — clean implementation, all tests passed first run.

### Completion Notes List

- All 5 tasks completed in order per story file
- 104 test files passed, 2409 total tests (0 failures)
- 17 new tests added (7 dialog spec + 10 upload orchestration spec)
- 3 RED-phase tests converted to GREEN
- Zero backend changes — all frontend-only
- DragDropUploadComponent passed `accept="image/jpeg,image/png,application/pdf"` (critical: default excludes PDF)
- SignalR handles queue updates automatically — no manual store calls
- Followed MobileCaptureFab upload pattern for desktop batch flow

### File List

**New files:**
- `frontend/src/app/features/receipts/components/receipt-upload-dialog/receipt-upload-dialog.component.ts`
- `frontend/src/app/features/receipts/components/receipt-upload-dialog/receipt-upload-dialog.component.spec.ts`

**Modified files:**
- `frontend/src/app/features/receipts/receipts.component.ts` — page header + upload orchestration
- `frontend/src/app/features/receipts/receipts.component.spec.ts` — 10 new tests + fixed title test
