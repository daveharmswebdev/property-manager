# Story 16.9: Receipt Thumbnail Reactivity After Upload

Status: done

## Story

As a property owner uploading receipts,
I want to see the actual thumbnail once it's available,
so that I can visually confirm my receipt was captured correctly without refreshing the page.

## Acceptance Criteria

1. **AC-16.9.1 — Thumbnail displays after upload without page refresh:**
   Given I upload a receipt photo (desktop or mobile)
   When the thumbnail has been generated server-side
   Then the receipt list item displays the actual thumbnail, not a placeholder

2. **AC-16.9.2 — Placeholder shown only while thumbnail is generating:**
   Given I just uploaded a receipt
   When the thumbnail is still being generated
   Then a placeholder is shown with a visual loading indicator
   And once the thumbnail is ready, the placeholder is replaced automatically

3. **AC-16.9.3 — SignalR-delivered receipts show thumbnails:**
   Given a receipt arrives via SignalR WebSocket notification
   When the receipt appears in the list
   Then the thumbnail is displayed if available, or updates reactively once available

## Root Cause Analysis

The bug has **two contributing causes** — both must be fixed:

### Cause 1: Backend sends `null` URLs in SignalR event

**File:** `backend/src/PropertyManager.Application/Receipts/CreateReceipt.cs:102-112`

The `CreateReceiptHandler` generates thumbnails **synchronously** (line 86-95), saves `ThumbnailStorageKey` to DB, and THEN broadcasts the SignalR event. But the event hardcodes `ThumbnailUrl: null`:

```csharp
await _notificationService.NotifyReceiptAddedAsync(
    _currentUser.AccountId,
    new ReceiptAddedEvent(
        receipt.Id,
        null, // ← BUG: ThumbnailUrl always null, even though thumbnail was just generated
        receipt.PropertyId,
        propertyName,
        receipt.CreatedAt
    ), cancellationToken);
```

The `ReceiptAddedEvent` record also lacks `ViewUrl` and `ContentType` fields — the frontend needs these to display the receipt.

### Cause 2: Frontend upload flow never refreshes the receipt list

**File:** `frontend/src/app/features/receipts/receipts.component.ts:181-226`

After `ReceiptCaptureService.uploadReceipt()` completes, `onUploadReceipt()` shows a snackbar but **never calls `store.loadUnprocessedReceipts()`**. The new receipt only appears via SignalR, which sends null URLs (Cause 1).

### How the template decides what to show

**File:** `frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts:41-53`

```html
@if (isPdf() && !hasThumbnail()) {
  <mat-icon class="pdf-icon">description</mat-icon>
} @else if (imageError()) {
  <mat-icon class="fallback-icon">image</mat-icon>
} @else {
  <img [src]="hasThumbnail() ? receipt().thumbnailUrl : receipt().viewUrl" .../>
}
```

When both `thumbnailUrl` and `viewUrl` are undefined → img `src` is undefined → `onerror` fires → fallback icon shown.

## Tasks / Subtasks

- [x] Task 1: Expand `ReceiptAddedEvent` with URL and content type fields (AC: 1, 3)
  - [x] 1.1 Add `ViewUrl`, `ContentType` fields to `ReceiptAddedEvent` record in `IReceiptNotificationService.cs`
  - [x] 1.2 Inject `IStorageService` into `CreateReceiptHandler` constructor
  - [x] 1.3 After thumbnail generation block, generate presigned download URLs for both original (`StorageKey`) and thumbnail (`ThumbnailStorageKey`)
  - [x] 1.4 Pass generated URLs and `ContentType` to `ReceiptAddedEvent` in the notification call
- [x] Task 2: Update backend unit tests (AC: 1, 3)
  - [x] 2.1 Add `Mock<IStorageService>` to `CreateReceiptHandlerTests` constructor, set up `GeneratePresignedDownloadUrlAsync` to return test URLs
  - [x] 2.2 Update existing test assertions that verify `ReceiptAddedEvent` fields to include `ViewUrl`, `ThumbnailUrl`, `ContentType`
  - [x] 2.3 Add test: `Handle_WithThumbnail_IncludesPresignedUrlsInNotification` — verify both URLs passed
  - [x] 2.4 Add test: `Handle_ThumbnailGenerationFails_IncludesViewUrlOnly` — verify `ViewUrl` present, `ThumbnailUrl` null
  - [x] 2.5 Update `ReceiptNotificationServiceTests` to verify new event fields propagated correctly
- [x] Task 3: Frontend — Map SignalR event fields through to store (AC: 3)
  - [x] 3.1 Add `viewUrl`, `contentType` fields to `ReceiptAddedEvent` interface in `receipt-signalr.service.ts`
  - [x] 3.2 Update `addReceiptRealTime()` call to pass `viewUrl: event.viewUrl`, `thumbnailUrl: event.thumbnailUrl`, `contentType: event.contentType` instead of hardcoded `undefined`
  - [x] 3.3 Update `receipt-signalr.service.spec.ts` tests to verify new fields are passed through
- [x] Task 4: Frontend — Reload receipt list after upload completes (AC: 1, 2)
  - [x] 4.1 In `receipts.component.ts` `onUploadReceipt()`, after the upload loop completes and `isUploading` is set to false, call `this.store.loadUnprocessedReceipts()` to refresh with full presigned URLs
  - [x] 4.2 Update `receipts.component.spec.ts` to verify `loadUnprocessedReceipts` is called after upload

## Dev Notes

### This is a backend + frontend fix. Both must be done together.

The thumbnail generation is **synchronous** within the `CreateReceiptHandler` — the thumbnail IS available by the time SignalR fires. The backend just fails to generate presigned URLs and include them. This is the primary fix.

### Backend Changes — Exact locations

**File 1:** `backend/src/PropertyManager.Application/Common/Interfaces/IReceiptNotificationService.cs`

The `ReceiptAddedEvent` record (line 27-33) needs two new fields:
```csharp
public record ReceiptAddedEvent(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,       // NEW: presigned URL for full-size receipt
    string? ContentType,   // NEW: MIME type for frontend display logic
    Guid? PropertyId,
    string? PropertyName,
    DateTime CreatedAt
);
```

**File 2:** `backend/src/PropertyManager.Application/Receipts/CreateReceipt.cs`

- Add `IStorageService _storageService` to constructor injection (line 29-46)
- After the thumbnail try/catch block (after line 100), generate presigned URLs:

```csharp
// Generate presigned URLs for SignalR notification
string? viewUrl = null;
string? thumbnailUrl = null;
try
{
    viewUrl = await _storageService.GeneratePresignedDownloadUrlAsync(
        receipt.StorageKey, cancellationToken);
    if (receipt.ThumbnailStorageKey != null)
    {
        thumbnailUrl = await _storageService.GeneratePresignedDownloadUrlAsync(
            receipt.ThumbnailStorageKey, cancellationToken);
    }
}
catch (Exception ex) when (ex is not OperationCanceledException)
{
    _logger.LogWarning(ex, "Failed to generate presigned URLs for notification, receipt {ReceiptId}", receipt.Id);
}
```

- Update the `ReceiptAddedEvent` construction to include URLs:

```csharp
new ReceiptAddedEvent(
    receipt.Id,
    thumbnailUrl,
    viewUrl,
    request.ContentType,
    receipt.PropertyId,
    propertyName,
    receipt.CreatedAt
)
```

### Frontend Changes — Exact locations

**File 3:** `frontend/src/app/features/receipts/services/receipt-signalr.service.ts`

- Add `viewUrl?` and `contentType?` to `ReceiptAddedEvent` interface (line 9-15):

```typescript
export interface ReceiptAddedEvent {
  id: string;
  thumbnailUrl?: string;
  viewUrl?: string;       // NEW
  contentType?: string;   // NEW
  propertyId?: string;
  propertyName?: string;
  createdAt: string;
}
```

- Update the `addReceiptRealTime()` call (line 67-74) to pass through new fields:

```typescript
this.receiptStore.addReceiptRealTime({
  id: event.id,
  propertyId: event.propertyId ?? undefined,
  propertyName: event.propertyName ?? undefined,
  createdAt: new Date(event.createdAt),
  viewUrl: event.viewUrl ?? undefined,
  thumbnailUrl: event.thumbnailUrl ?? undefined,
  contentType: event.contentType ?? undefined,
});
```

**File 4:** `frontend/src/app/features/receipts/receipts.component.ts`

After the upload loop (after line 208 `this.isUploading.set(false)`), add:

```typescript
// Refresh receipt list to get full presigned URLs (AC-16.9.1)
if (successCount > 0) {
  this.store.loadUnprocessedReceipts();
}
```

### Critical Implementation Details

1. **`IStorageService` is already used by `GetUnprocessedReceiptsHandler`** in the same namespace — use the same interface, `inject()` pattern
2. **Presigned URL expiry (15 min)** is acceptable — these URLs are consumed immediately by the browser for thumbnail display
3. **Error handling on URL generation**: Wrap in try/catch. If URL generation fails, still send the notification (without URLs) — never block the receipt creation flow
4. **The `ReceiptAddedEvent` record change is a breaking change** in field ordering. Callers must be updated:
   - `CreateReceiptHandler.Handle()` (the only caller of `NotifyReceiptAddedAsync` with this event)
   - Backend tests that construct `ReceiptAddedEvent` directly
5. **`UnprocessedReceiptDto` (NSwag-generated)** already has `thumbnailUrl`, `viewUrl`, `contentType` fields — no NSwag regeneration needed
6. **Store `addReceiptRealTime()` already accepts `UnprocessedReceiptDto`** — just pass the fields through
7. **Store duplicate prevention still works** — if SignalR fires before `loadUnprocessedReceipts`, the receipt is there with URLs. When `loadUnprocessedReceipts` runs, it replaces the entire list with fresh API data (which also has URLs). No conflict.

### Existing Tests That Need Updates

**Backend:**
- `CreateReceiptHandlerTests.cs` — All tests that verify `ReceiptAddedEvent` need updating for new record shape. Must add `Mock<IStorageService>` to constructor.
- `ReceiptNotificationServiceTests.cs` — Tests construct `ReceiptAddedEvent` directly — update to include new fields.

**Frontend:**
- `receipt-signalr.service.spec.ts` — Lines 119-126 assert `viewUrl: undefined, contentType: undefined`. Update to verify actual values are passed through from event.
- `receipts.component.spec.ts` — Add test verifying `loadUnprocessedReceipts` called after successful upload.

### Project Structure Notes

- All backend changes in Application + Api layers (no new files)
- All frontend changes in existing files (no new files)
- Follows existing dependency injection patterns exactly
- `IStorageService` injection into handler is established pattern (see `GetUnprocessedReceiptsHandler`)

### References

- [Source: backend/src/PropertyManager.Application/Receipts/CreateReceipt.cs#L83-112] — Thumbnail generation + SignalR notification (the bug)
- [Source: backend/src/PropertyManager.Application/Common/Interfaces/IReceiptNotificationService.cs#L27-33] — ReceiptAddedEvent record to expand
- [Source: frontend/src/app/features/receipts/services/receipt-signalr.service.ts#L61-74] — SignalR handler that hardcodes undefined URLs
- [Source: frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts#L41-53] — Template thumbnail/placeholder logic
- [Source: frontend/src/app/features/receipts/receipts.component.ts#L181-226] — Upload flow that never refreshes list
- [Source: frontend/src/app/features/receipts/stores/receipt.store.ts#L120-147] — addReceiptRealTime with duplicate prevention
- [Source: backend/src/PropertyManager.Application/Receipts/GetUnprocessedReceipts.cs#L64-74] — Reference: how GetUnprocessedReceipts generates presigned URLs (the pattern to follow)
- [Source: backend/src/PropertyManager.Application/Common/Interfaces/IStorageService.cs#L29-31] — GeneratePresignedDownloadUrlAsync signature
- [Source: project-context.md] — Project conventions and rules

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Backend tests: 1,496 passed (956 Application + 96 Infrastructure + 444 Api), 0 failed
- Frontend tests: 2,500 passed across 107 test files, 0 failed

### Completion Notes List
- **Task 1:** Added `ViewUrl` and `ContentType` fields to `ReceiptAddedEvent` record. Injected `IStorageService` into `CreateReceiptHandler`. After thumbnail generation, generates presigned download URLs for both original file and thumbnail, passes them (along with `ContentType`) to `ReceiptAddedEvent`. URL generation failure is caught and logged without blocking receipt creation.
- **Task 2:** Added `Mock<IStorageService>` to `CreateReceiptHandlerTests` with default URL generation setup. Updated 2 existing notification assertions to verify `ViewUrl`, `ThumbnailUrl`, and `ContentType`. Added 2 new tests: `Handle_WithThumbnail_IncludesPresignedUrlsInNotification` and `Handle_ThumbnailGenerationFails_IncludesViewUrlOnly`. Updated all `ReceiptNotificationServiceTests` event constructions with new fields.
- **Task 3:** Added `viewUrl` and `contentType` to frontend `ReceiptAddedEvent` interface. Updated `addReceiptRealTime()` call to pass through `viewUrl`, `thumbnailUrl`, `contentType` from SignalR event instead of hardcoded `undefined`. Updated spec to verify new fields.
- **Task 4:** After upload loop completes with `successCount > 0`, calls `store.loadUnprocessedReceipts()` to refresh with full presigned URLs. Added 2 tests: one verifying reload on success, one verifying no reload on all-fail.

### File List
- `backend/src/PropertyManager.Application/Common/Interfaces/IReceiptNotificationService.cs` — Added `ViewUrl`, `ContentType` fields to `ReceiptAddedEvent` record
- `backend/src/PropertyManager.Application/Receipts/CreateReceipt.cs` — Injected `IStorageService`, generate presigned URLs, pass to notification event
- `backend/tests/PropertyManager.Application.Tests/Receipts/CreateReceiptHandlerTests.cs` — Added `Mock<IStorageService>`, updated assertions, added 2 new tests
- `backend/tests/PropertyManager.Api.Tests/Services/ReceiptNotificationServiceTests.cs` — Updated `ReceiptAddedEvent` constructions with new fields
- `frontend/src/app/features/receipts/services/receipt-signalr.service.ts` — Added `viewUrl`, `contentType` to interface, pass through from event
- `frontend/src/app/features/receipts/services/receipt-signalr.service.spec.ts` — Updated test to verify new fields passed through
- `frontend/src/app/features/receipts/receipts.component.ts` — Call `loadUnprocessedReceipts()` after successful upload
- `frontend/src/app/features/receipts/receipts.component.spec.ts` — Added 2 tests for post-upload refresh behavior
