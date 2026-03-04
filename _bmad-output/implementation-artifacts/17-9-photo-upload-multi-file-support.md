# Story 17.9: PhotoUpload Multi-File Support

Status: review

## Story

As a property owner uploading photos,
I want to select or drag-drop multiple files at once,
so that I don't have to upload photos one at a time.

**GitHub Issue:** #276
**Effort:** M

## Acceptance Criteria

**AC-1: File input supports multi-select**
Given I click the upload area to open the file chooser
When the file dialog opens
Then I can select multiple files (Cmd/Ctrl+click or Shift+click)

**AC-2: Drag-and-drop processes all files**
Given I drag multiple files onto the upload area
When I drop them
Then all files are processed and uploaded, not just the first

**AC-3: Individual file validation**
Given I select 5 files where 1 exceeds the size limit
When validation runs
Then the 4 valid files are uploaded
And the invalid file shows an error message

**AC-4: Upload feedback per file**
Given multiple files are uploading
When the upload is in progress
Then I see progress/status feedback for each file

**AC-5: Mobile camera capture not broken**
Given I am on a mobile device using the camera to capture a photo
When I take a single photo
Then it uploads correctly (single-file flow preserved)

## Tasks / Subtasks

### Task 1: Refactor PhotoUploadComponent data model for multi-file queue (AC: 1, 2, 3, 4)

- [x] 1.1: Add `UploadItem` interface: `{ id: string, file: File, status: 'pending' | 'uploading' | 'success' | 'error', progress: number, error: string | null }`
- [x] 1.2: Replace single `uploadState` signal with `uploadQueue` signal of type `WritableSignal<UploadItem[]>`
- [x] 1.3: Add computed signals: `isProcessing` (any item uploading), `hasQueue` (queue not empty), `completedCount`, `failedCount`, `totalCount`
- [x] 1.4: Add `private addToQueue(files: File[]): void` — validate each file, add valid ones as `pending` UploadItems, set validation errors for invalid ones (per-file, not global)
- [x] 1.5: Add `private async processQueue(): Promise<void>` — find next `pending` item, set to `uploading`, call `uploadFn()`, set to `success`/`error`, emit `uploadComplete` on each success, recurse until no pending items remain
- [x] 1.6: After all items processed (no more pending), emit new `batchComplete` output
- [x] 1.7: Add `retryItem(id: string)` — set item back to `pending`, call `processQueue()`
- [x] 1.8: Add `removeItem(id: string)` — remove from queue
- [x] 1.9: Add `clearQueue()` — reset to empty
- [x] 1.10: Keep existing `resetUpload()` method working — it now calls `clearQueue()` and resets validation errors

### Task 2: Update file input and handlers for multi-file (AC: 1, 2, 5)

- [x] 2.1: Add `multiple` attribute to `<input type="file">` — use `[attr.multiple]="true"` (always on)
- [x] 2.2: Remove hardcoded `capture="environment"` from file input — the `accept` attribute with image MIME types already prompts mobile browsers to offer camera as an option. Hardcoding `capture` forces camera-only on iOS, preventing file library access and conflicting with `multiple`. See Dev Notes for details.
- [x] 2.3: Update `onDrop()`: change `this.handleFile(files[0])` to `this.addToQueue(Array.from(event.dataTransfer.files))`
- [x] 2.4: Update `onFileSelected()`: change `this.handleFile(input.files[0])` to `this.addToQueue(Array.from(input.files))`
- [x] 2.5: After `addToQueue()`, call `processQueue()` if not already processing
- [x] 2.6: Guard against starting `processQueue()` while already processing (check `isProcessing` computed)

### Task 3: Update template for queue UI (AC: 3, 4)

- [x] 3.1: **Idle state** (no queue items): Same drop zone as current but text says "Drag & drop photos here" (plural), "or click to browse"
- [x] 3.2: **Queue state** (has items): Show compact drop zone at top ("Drop more photos or click to add") + file queue list below
- [x] 3.3: Each queue item row shows: file name, status icon (`sync` spinning for uploading, `check_circle` for success, `error_outline` for error, `hourglass_empty` for pending), progress bar (for uploading), error message (for error), retry button (for error), remove button (for pending/error)
- [x] 3.4: Validation errors (invalid file type, too large) shown per-file inline — change from single `validationError` signal to per-item errors in the queue (invalid files get added as `error` status with message)
- [x] 3.5: Summary line below queue: "X of Y uploaded" or "All X uploaded successfully"
- [x] 3.6: "Clear" button when all items are in final state (success/error) to reset to idle
- [x] 3.7: Drop zone remains interactive during uploads — user can add more files to the queue while uploads are in progress
- [x] 3.8: Progress simulation per-item: each uploading item gets its own progress interval (same 200ms/+10 pattern, cap at 90%)

### Task 4: Update styles (AC: 4)

- [x] 4.1: Add `.upload-queue` container with scrollable list (max-height ~300px with overflow-y auto for many files)
- [x] 4.2: Add `.queue-item` row styles: flex row with file name, status icon, progress bar, action buttons
- [x] 4.3: Add `.queue-item.success`, `.queue-item.error`, `.queue-item.uploading`, `.queue-item.pending` state styles matching existing color variables
- [x] 4.4: Add `.queue-summary` styles for the summary line
- [x] 4.5: Add `.compact-drop-zone` styles for the smaller drop zone shown during queue processing (reduced padding, smaller icon)

### Task 5: Update consumer — WorkOrderDetailComponent (AC: 2, 4)

- [x] 5.1: Change `onUploadComplete()` to NOT close the upload zone — remove `this.showUploadZone.set(false)`
- [x] 5.2: Add `onBatchComplete()` handler that calls `this.showUploadZone.set(false)` — bind to new `(batchComplete)` output
- [x] 5.3: Template: `<app-photo-upload [uploadFn]="uploadPhoto" (uploadComplete)="onUploadComplete()" (batchComplete)="onBatchComplete()" />`
- [x] 5.4: `onUploadComplete()` now just triggers gallery refresh (it already does via the store's internal `loadPhotos()` call, so this can become a no-op or be removed)

### Task 6: Update consumer — PropertyPhotoUploadComponent (AC: 2, 4)

- [x] 6.1: Add `batchComplete` output and wire it: `(batchComplete)="batchComplete.emit()"`
- [x] 6.2: Parent `PropertyDetailComponent` (or wherever `PropertyPhotoUploadComponent` is used) handles `batchComplete` — verify this doesn't need behavior changes

### Task 7: Unit tests — PhotoUploadComponent (AC: 1, 2, 3, 4, 5)

- [x] 7.1: Update `createMockDataTransfer` helper to support multiple files
- [x] 7.2: Test: multi-file drop — drops 3 valid files, all enter queue, all upload sequentially
- [x] 7.3: Test: multi-file select — selects 3 files via file input, all enter queue
- [x] 7.4: Test: individual validation — drop 3 files (1 invalid type), 2 upload, 1 shows error in queue
- [x] 7.5: Test: individual validation — drop 3 files (1 oversized), 2 upload, 1 shows error in queue
- [x] 7.6: Test: per-file progress — while uploading, each item shows progress
- [x] 7.7: Test: `uploadComplete` emits per successful file
- [x] 7.8: Test: `batchComplete` emits once after all files processed
- [x] 7.9: Test: retry failed item — click retry, item re-enters queue and uploads
- [x] 7.10: Test: remove pending item from queue
- [x] 7.11: Test: clear queue resets to idle state
- [x] 7.12: Test: single file still works (backward compat — drop 1 file, uploads normally)
- [x] 7.13: Test: file input has `multiple` attribute
- [x] 7.14: Test: file input does NOT have `capture` attribute (removed for multi-file compat)
- [x] 7.15: Test: can add more files while upload in progress (queue grows)
- [x] 7.16: Test: drop zone accepts new files during active uploads (not blocked by `isProcessing`)

### Task 8: Update consumer tests (AC: 2)

- [x] 8.1: Update `property-photo-upload.component.spec.ts` — verify `batchComplete` output wired
- [x] 8.2: Update work order detail component spec — verify `onBatchComplete` closes upload zone, `onUploadComplete` does NOT close it

## Dev Notes

### Architecture: Refactor PhotoUploadComponent, No New Components

This story modifies the **shared** `PhotoUploadComponent` used by both property and work order photo features. The existing single-file state machine is replaced with a multi-file queue model. No new components are created — just expanding the existing one.

**Consumers to update:**
- `PropertyPhotoUploadComponent` — thin wrapper, add `batchComplete` pass-through
- `WorkOrderDetailComponent` — change close behavior from `uploadComplete` to `batchComplete`

### Critical: `capture="environment"` Removal

The current file input has `capture="environment"` hardcoded. This attribute forces the device camera to open directly on mobile, bypassing the file picker entirely. When combined with `multiple`, behavior is platform-dependent and broken:

- **iOS Safari**: `capture` takes priority, ignores `multiple` — user can only take one photo via camera, cannot browse library
- **Android Chrome**: Inconsistent — may show camera only or show picker depending on version

**Solution:** Remove `capture="environment"` entirely. The `accept` attribute (`image/jpeg,image/png,...`) already causes mobile browsers to show camera as an option in the file picker alongside "Photo Library" and "Browse". This preserves mobile camera access (AC-5) while enabling multi-select from the library.

Reference: [MDN - HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture) and [web.dev - Capturing images](https://web.dev/media-capturing-images/) both document that omitting `capture` while keeping `accept="image/*"` gives the user all options (camera + library).

### Upload Processing: Sequential, Not Parallel

Files MUST be uploaded sequentially (one at a time), NOT in parallel. Reasons:
1. Each upload requires its own presigned URL request → S3 PUT → confirm call (3 network round-trips per file)
2. The backend `ConfirmUpload` endpoint triggers server-side thumbnail generation (downloads original from S3, resizes via ImageSharp, uploads thumbnail back) — parallel confirms would spike server memory
3. The store's `loadPhotos()` is called after each `uploadFn()` completion — parallel calls would create race conditions

**Queue processing pattern:**
```typescript
private async processQueue(): Promise<void> {
  if (this.isProcessing()) return; // guard re-entry
  const next = this.uploadQueue().find(item => item.status === 'pending');
  if (!next) {
    this.batchComplete.emit();
    return;
  }
  // update item to uploading, start progress sim, await uploadFn(next.file), update status, emit uploadComplete, recurse
}
```

### Upload State Machine Per Item

Each `UploadItem` in the queue transitions independently:
```
pending → uploading → success
                    → error → (retry) → pending → uploading → ...
```

The `uploadFn` input signature `(file: File) => Promise<boolean>` is UNCHANGED. The component calls it once per file, sequentially.

### Template Design

The component has two visual modes:

1. **Empty queue (idle):** Full drop zone with icon, "Drag & drop photos here", "or click to browse", file info text. Same as current but text is plural.

2. **Queue active:** Compact drop zone at top (smaller, just "Add more photos" with cloud_upload icon) + scrollable queue list below. Each row: `[icon] filename.jpg [progress/status] [action]`. Summary line at bottom.

### Existing `DragDropUploadComponent` Reference

Do NOT reuse or merge with `DragDropUploadComponent`. That component is a file-picker-only (emits `filesSelected`, does not upload). Different responsibilities. Only reference its `processFiles(Array.from(files))` pattern for multi-file handling.

### Per-Item Progress Simulation

Each uploading item needs its own `setInterval` for progress simulation. Track interval IDs per item (use a `Map<string, ReturnType<typeof setInterval>>`). Clear on destroy via `ngOnDestroy` — iterate and clearInterval all active timers.

### `uploadComplete` vs `batchComplete` Outputs

- `uploadComplete`: emits after EACH successful file upload (gallery refreshes progressively — good UX)
- `batchComplete`: emits ONCE when ALL files have reached a final state (success or error). Consumers use this to close the upload zone.

The `WorkOrderDetailComponent.onUploadComplete()` currently closes the upload zone — this MUST change to only close on `batchComplete`. Otherwise the zone closes after the first file in a multi-file batch.

### Project Structure Notes

- Only modifying existing files — no new files created
- `PhotoUploadComponent` is in `shared/components/` — used by 2 consumers
- The `uploadFn` input contract stays the same: `(file: File) => Promise<boolean>`
- Both photo stores (`PropertyPhotoStore`, `WorkOrderPhotoStore`) internally refresh the gallery after each `uploadPhoto()` call — no store changes needed
- `InlineVendorDialogComponent`, `DragDropUploadComponent`, `ReceiptUploadDialogComponent` — NOT MODIFIED

### References

- [Source: `frontend/src/app/shared/components/photo-upload/photo-upload.component.ts` — Main component to refactor (496 lines)]
- [Source: `frontend/src/app/shared/components/photo-upload/photo-upload.component.spec.ts` — Tests to update (390 lines)]
- [Source: `frontend/src/app/shared/components/drag-drop-upload/drag-drop-upload.component.ts` — Multi-file pattern reference (lines 362-449)]
- [Source: `frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.ts` — Consumer wrapper to update (49 lines)]
- [Source: `frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.spec.ts` — Consumer tests to update]
- [Source: `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts:262-265` — Consumer template to update]
- [Source: `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts:1037-1039` — `onUploadComplete()` to change]
- [Source: `frontend/src/app/shared/services/photo-upload.service.ts` — Validation helpers (isValidFileType, isValidFileSize) — NO CHANGES]
- [Source: `frontend/src/app/features/work-orders/stores/work-order-photo.store.ts` — Store unchanged, refreshes gallery internally]
- [Source: `frontend/src/app/features/properties/stores/property-photo.store.ts` — Store unchanged, refreshes gallery internally]
- [Source: Backend controllers — NO CHANGES. Presigned URL flow is single-file-per-request. Multi-file is purely frontend loop.]
- [Source: project-context.md — Angular patterns, testing rules, SCSS styles]
- [Source: GitHub Issue #276 — PhotoUpload multi-file support]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Replaced single-file `UploadState` state machine with multi-file `UploadItem[]` queue model
- Added `UploadItem` interface with per-item status tracking (pending/uploading/success/error)
- Implemented sequential queue processing via recursive `processQueue()` with re-entry guard
- Added `batchComplete` output that fires once when all files reach final state
- Existing `uploadComplete` still fires per successful file (gallery refreshes progressively)
- Removed `capture="environment"` from file input to enable multi-select on mobile (accept attribute provides camera option)
- Added `[attr.multiple]="true"` for multi-file selection via file picker
- Template now has two modes: full drop zone (idle) and compact drop zone + scrollable queue list
- Per-item progress simulation using `Map<string, setInterval>` — all cleared on destroy
- Updated WorkOrderDetailComponent: `onUploadComplete` is now no-op, `onBatchComplete` closes upload zone
- Updated PropertyPhotoUploadComponent: added `batchComplete` pass-through output
- Updated PropertyDetailComponent: `onUploadComplete` is now no-op, `onBatchComplete` closes upload dialog
- All 2604 tests pass (111 test files), zero regressions

### File List

- frontend/src/app/shared/components/photo-upload/photo-upload.component.ts (modified — complete rewrite for multi-file queue)
- frontend/src/app/shared/components/photo-upload/photo-upload.component.spec.ts (modified — complete rewrite with 25+ multi-file tests)
- frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.ts (modified — added batchComplete output)
- frontend/src/app/features/properties/components/property-photo-upload/property-photo-upload.component.spec.ts (modified — added batchComplete test)
- frontend/src/app/features/properties/property-detail/property-detail.component.ts (modified — onUploadComplete no-op, added onBatchComplete)
- frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts (modified — onUploadComplete no-op, added onBatchComplete, template updated)
- frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.spec.ts (modified — added Task 8.2 tests)

## Change Log

- 2026-03-03: Implemented multi-file photo upload support (Story 17.9). Replaced single-file upload model with queue-based sequential processing. Added per-file validation, progress tracking, retry/remove per item, batchComplete output. Updated all consumers (WorkOrderDetail, PropertyPhotoUpload, PropertyDetail) to close upload zone on batch completion instead of per-file completion. Removed `capture="environment"` for mobile multi-select compatibility. All 2604 tests pass.
