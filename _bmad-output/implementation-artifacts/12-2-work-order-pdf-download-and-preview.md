# Story 12.2: Work Order PDF Download & Preview

Status: review

## Story

As a **property owner**,
I want **to download and preview a work order as a PDF**,
So that **I can share it with vendors, keep it for my records, or verify content before sending**.

## Acceptance Criteria

1. **Given** I am on a work order detail page **When** I look at the action buttons **Then** I see a "PDF" split button or button group with "Preview" and "Download" options alongside the existing Edit and Delete buttons

2. **Given** I click "Download PDF" **When** the generation starts **Then** I see a brief loading indicator **And** the PDF downloads to my device with filename format `WorkOrder-{PropertyName}-{Date}-{ShortId}.pdf` **And** I see snackbar "PDF downloaded"

3. **Given** I click "Preview PDF" **When** the preview loads **Then** I see the PDF rendered in a modal/dialog overlay **And** the preview renders without blocking the UI (NFR8) **And** I can scroll through the document

4. **Given** I am viewing the PDF preview **When** I want to examine details **Then** I can zoom in/out (50%-200% range) **And** I see zoom controls in the dialog toolbar

5. **Given** I am viewing the PDF preview **When** I want to download **Then** I see a "Download" button in the preview toolbar **And** clicking it downloads the same PDF I'm previewing

6. **Given** I am viewing the PDF preview **When** I want to print **Then** I see a "Print" button in the preview toolbar **And** clicking it opens the browser print dialog

7. **Given** I want to close the preview **When** I click outside the modal, press Escape, or click X **Then** the preview closes **And** I return to the work order detail page

8. **Given** PDF generation fails **When** an error occurs **Then** I see snackbar "Failed to generate PDF. Please try again." **And** I can retry

9. **Given** I'm on mobile **When** I use the PDF actions **Then** the buttons are accessible and the download triggers the device's native PDF handling

## Merged Stories

This story combines original stories **12-2** (Download Work Order PDF - FR50) and **12-3** (Preview Work Order PDF - FR51) into a single implementation unit. Both features share the same API endpoint, page location, and state management plumbing.

**FRs Covered:** FR50, FR51

## Tasks / Subtasks

- [x] Task 1: Add PDF method to WorkOrderService (AC: #2, #3, #8)
  - [x] 1.1 Add `generateWorkOrderPdf(id: string): Observable<Blob>` method to `work-order.service.ts`
  - [x] 1.2 Use `HttpClient.post()` with `{ responseType: 'blob', observe: 'response' }` to call `POST /api/v1/work-orders/{id}/pdf`
  - [x] 1.3 Extract filename from `Content-Disposition` header, fallback to `WorkOrder-{id}.pdf`

- [x] Task 2: Create WorkOrderPdfPreviewDialogComponent (AC: #3, #4, #5, #6, #7)
  - [x] 2.1 Create `work-order-pdf-preview-dialog.component.ts` in `features/work-orders/components/`
  - [x] 2.2 Accept `{ workOrderId: string }` as dialog data
  - [x] 2.3 On open: call `WorkOrderService.generateWorkOrderPdf()`, show loading spinner
  - [x] 2.4 On success: create `URL.createObjectURL(blob)`, sanitize with `DomSanitizer.bypassSecurityTrustResourceUrl()`, display in `<object>` element (follow `PdfPreviewComponent` pattern)
  - [x] 2.5 Add zoom controls: zoom in (+10%), zoom out (-10%), reset (100%), range 50%-200% (follow `ReportPreviewDialogComponent` pattern)
  - [x] 2.6 Add Download button: trigger browser download from cached blob using `createObjectURL` + anchor click pattern
  - [x] 2.7 Add Print button: create hidden iframe, load blob URL, call `contentWindow.print()` (follow `ReportPreviewDialogComponent.print()` pattern)
  - [x] 2.8 Add Close button (`mat-dialog-close`)
  - [x] 2.9 Implement `cleanupBlobUrl()` in `ngOnDestroy()` to revoke object URLs and remove print iframe

- [x] Task 3: Add PDF buttons to work order detail page (AC: #1, #2, #9)
  - [x] 3.1 Add "Download PDF" button (`mat-stroked-button`) with `mat-icon` `download` to `.action-buttons` container in `work-order-detail.component.ts`
  - [x] 3.2 Add "Preview PDF" button (`mat-stroked-button`) with `mat-icon` `visibility` to `.action-buttons` container
  - [x] 3.3 Implement `onDownloadPdf()`: call service, show loading state on button (spinner or disabled), trigger blob download, show snackbar on success/error
  - [x] 3.4 Implement `onPreviewPdf()`: open `WorkOrderPdfPreviewDialogComponent` via `MatDialog.open()`
  - [x] 3.5 Extract filename from response header or construct fallback: `WorkOrder-{PropertyName}-{Date}-{ShortId}.pdf`

- [x] Task 4: Unit tests (AC: #1-#8)
  - [x] 4.1 Test WorkOrderService: `generateWorkOrderPdf` returns blob from API
  - [x] 4.2 Test WorkOrderService: `generateWorkOrderPdf` propagates errors
  - [x] 4.3 Test work-order-detail: Download PDF button calls service and triggers download
  - [x] 4.4 Test work-order-detail: Preview PDF button opens dialog
  - [x] 4.5 Test preview dialog: shows loading state while fetching
  - [x] 4.6 Test preview dialog: displays PDF on success
  - [x] 4.7 Test preview dialog: shows error on failure
  - [x] 4.8 Test preview dialog: download button triggers browser download from cached blob
  - [x] 4.9 Test preview dialog: cleans up blob URLs on destroy

## Dev Notes

### Architecture: Follow Existing Report Preview Pattern

This story is 100% frontend. The backend endpoint (`POST /api/v1/work-orders/{id}/pdf`) was built in Story 12-1 and returns binary PDF with `Content-Disposition` filename header.

**Key pattern sources to replicate:**
- `features/reports/components/report-preview-dialog/report-preview-dialog.component.ts` — Full PDF preview dialog with zoom, print, download, blob management
- `features/reports/components/pdf-preview/pdf-preview.component.ts` — PDF rendering via `<object>` element
- `features/reports/stores/reports.store.ts` — Blob download pattern with `URL.createObjectURL`

### WorkOrderService (Not NSwag)

Work orders use a custom `WorkOrderService` wrapping `HttpClient`, NOT the NSwag-generated `ApiClient`. Add the PDF method here:

```typescript
generateWorkOrderPdf(id: string): Observable<HttpResponse<Blob>> {
  return this.http.post(`/api/v1/work-orders/${id}/pdf`, null, {
    responseType: 'blob',
    observe: 'response',
  });
}
```

The `observe: 'response'` gives access to headers for extracting the filename from `Content-Disposition`.

### Filename Extraction

The backend sets `Content-Disposition: attachment; filename=WorkOrder-{PropertyName}-{Date}-{ShortId}.pdf`. Extract with:

```typescript
const disposition = response.headers.get('Content-Disposition');
const match = disposition?.match(/filename="?([^";\n]*)"?/);
const filename = match?.[1] || `WorkOrder-${workOrderId.substring(0, 8)}.pdf`;
```

### Download Pattern (from reports.store.ts)

```typescript
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
```

### Print Pattern (from ReportPreviewDialogComponent)

```typescript
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
const blobUrl = URL.createObjectURL(blob);
iframe.src = blobUrl;
document.body.appendChild(iframe);
iframe.onload = () => {
  iframe.contentWindow?.print();
  // cleanup after print dialog closes
};
```

### Memory Management (Critical)

Both preview and download create object URLs from blobs. Failure to revoke them causes memory leaks.

- Cache the blob in the preview dialog (used for both preview display and download/print actions)
- Call `URL.revokeObjectURL()` in `ngOnDestroy()` for all created URLs
- Clean up print iframe in `ngOnDestroy()`

### Button Placement

Add to existing `.action-buttons` flex container in work order detail header. Current layout:

```
[Edit] [Delete]
```

New layout:

```
[Edit] [Delete] [Preview PDF] [Download PDF]
```

On mobile (<600px), buttons wrap to full width per existing responsive CSS.

### Dialog Sizing

Follow `ReportPreviewDialogComponent` dialog config:
- Width: `90vw`, maxWidth: `1200px`
- Height: `85vh`
- Panel class for custom styling

### No NSwag Regeneration Needed

Since `WorkOrderService` uses direct `HttpClient` calls (not NSwag), no client regeneration is required.

### Project Structure

**New files:**
```
frontend/src/app/features/work-orders/components/
  work-order-pdf-preview-dialog/
    work-order-pdf-preview-dialog.component.ts
```

**Modified files:**
```
frontend/src/app/features/work-orders/services/work-order.service.ts   (add PDF method)
frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts  (add PDF buttons + handlers)
```

### References

- [Source: epics-work-orders-vendors.md#Epic 5 Stories 5.2 + 5.3] — Original story requirements
- [Source: 12-1-work-order-pdf-generation-service.md] — Backend endpoint details
- [Source: features/reports/components/report-preview-dialog/] — PDF preview dialog pattern (zoom, print, download, blob management)
- [Source: features/reports/components/pdf-preview/] — PDF rendering pattern
- [Source: features/reports/stores/reports.store.ts] — Blob download pattern
- [Source: features/work-orders/pages/work-order-detail/] — Target page for button placement
- [Source: features/work-orders/services/work-order.service.ts] — Custom HTTP service to extend

## Dev Agent Record

### Implementation Plan

- Task 1: Added `generateWorkOrderPdf()` method to `WorkOrderService` with `observe: 'response'` for header access
- Task 2: Created `WorkOrderPdfPreviewDialogComponent` following `ReportPreviewDialogComponent` pattern exactly — zoom (10% increments, 50-200%), print via iframe, download via anchor click, blob cleanup in ngOnDestroy
- Task 3: Added "Preview PDF" and "Download PDF" buttons to work order detail `.action-buttons` container with loading spinner on download button
- Task 4: Added 27 new unit tests across 3 spec files (service: 2 tests, detail component: 5 tests, preview dialog: 20 tests)

### Completion Notes

All 4 tasks implemented following existing patterns from `ReportPreviewDialogComponent` and `PdfPreviewComponent`. Story is 100% frontend — no backend changes needed. All 2300 frontend tests pass. All 522 backend tests pass.

Key decisions:
- Used +/-10% zoom increments (per AC #4) vs 25% in reports (story spec takes priority)
- Dialog sized 90vw x 85vh (matching report preview pattern)
- Download button shows spinner while generating PDF
- Filename extracted from Content-Disposition header with fallback to `WorkOrder-{id}.pdf`
- Reused shared `PdfPreviewComponent` for PDF rendering via `<object>` element

## File List

**New files:**
- `frontend/src/app/features/work-orders/components/work-order-pdf-preview-dialog/work-order-pdf-preview-dialog.component.ts`
- `frontend/src/app/features/work-orders/components/work-order-pdf-preview-dialog/work-order-pdf-preview-dialog.component.spec.ts`

**Modified files:**
- `frontend/src/app/features/work-orders/services/work-order.service.ts` — Added `generateWorkOrderPdf()` method
- `frontend/src/app/features/work-orders/services/work-order.service.spec.ts` — Added 2 PDF generation tests
- `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.ts` — Added PDF buttons + handlers
- `frontend/src/app/features/work-orders/pages/work-order-detail/work-order-detail.component.spec.ts` — Added 5 PDF action tests, updated button count test

## Change Log

- 2026-02-06: Story 12-2 implementation complete — Work Order PDF Download & Preview (FR50, FR51)
