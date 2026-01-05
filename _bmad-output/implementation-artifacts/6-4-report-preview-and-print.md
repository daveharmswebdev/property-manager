# Story 6.4: Report Preview and Print

Status: done

## Story

As a property owner,
I want to preview reports before downloading and print directly,
So that I can verify the data and get a physical copy if needed.

## Acceptance Criteria

1. **AC-6.4.1**: Preview stored reports
   - Given I am viewing the reports list
   - When I click "Preview" on a report row
   - Then a preview dialog opens showing the PDF
   - And I can scroll through multiple pages if present
   - And I can see all expense categories clearly

2. **AC-6.4.2**: Zoom controls in preview
   - Given I am viewing a report preview
   - When I want to verify detailed data
   - Then I can zoom in/out on the PDF
   - And zoom controls are clearly visible
   - And the current zoom level is displayed

3. **AC-6.4.3**: Print from preview
   - Given I am viewing a report preview
   - When I click "Print"
   - Then the browser print dialog opens with the PDF
   - And the document prints correctly formatted
   - And I see snackbar "Preparing print..."

4. **AC-6.4.4**: Navigate to fix errors
   - Given I notice an error while previewing a report
   - When I want to correct the data
   - Then I can close the preview dialog
   - And I see a "Fix Data" hint or link
   - And I can navigate to expenses/income to fix entries
   - And regenerate the report with corrected data

5. **AC-6.4.5**: Download from preview
   - Given I am viewing a report preview
   - When I click "Download"
   - Then the PDF downloads to my device
   - And I see snackbar "Report downloaded"

6. **AC-6.4.6**: Preview dialog responsive
   - Given I am on a mobile device
   - When I open a report preview
   - Then the preview dialog is full-screen
   - And controls are touch-friendly
   - And zoom gestures work (pinch-to-zoom)

7. **AC-6.4.7**: Preview loading state
   - Given I click preview on a report
   - When the PDF is loading from S3
   - Then I see a loading spinner
   - And the dialog shows "Loading report..."

## Tasks / Subtasks

- [x] Task 1: Add Preview Button to Reports List (AC: 6.4.1)
  - [x] Add "Preview" icon button to reports table actions column
  - [x] Position between existing Download and Delete buttons
  - [x] Add `matTooltip="Preview report"`
  - [x] Add `data-testid="preview-report-{id}"` for testing

- [x] Task 2: Create ReportPreviewDialogComponent (AC: 6.4.1, 6.4.2, 6.4.3, 6.4.5)
  - [x] Create `report-preview-dialog.component.ts` in `features/reports/components/`
  - [x] Dialog receives `{ report: GeneratedReportDto }` as data
  - [x] Full-height dialog (90vh) for comfortable viewing
  - [x] Include toolbar with: report name, year, zoom controls, print, download, close
  - [x] Use existing PdfPreviewComponent for PDF display
  - [x] Fetch PDF blob from `GET /api/v1/reports/{id}`

- [x] Task 3: Implement Zoom Controls (AC: 6.4.2)
  - [x] Add zoom in (+), zoom out (-), and reset buttons
  - [x] Display current zoom percentage (100%, 125%, 150%, etc.)
  - [x] Zoom range: 50% to 200%
  - [x] Apply CSS transform scale to PDF container
  - [x] Remember zoom level within dialog session

- [x] Task 4: Implement Print Functionality (AC: 6.4.3)
  - [x] Add print button with mat-icon "print"
  - [x] Use iframe approach for printing PDF blob
  - [x] Show snackbar "Preparing print..." while loading
  - [x] Open browser print dialog via iframe.contentWindow.print()
  - [x] Handle print for both PDF and ZIP (skip ZIP or extract first PDF)

- [x] Task 5: Add Fix Data Navigation Hint (AC: 6.4.4)
  - [x] Add subtle "Notice an error?" hint in dialog footer
  - [x] Link to expenses page: "Go to Expenses to fix and regenerate"
  - [x] Close dialog when navigation occurs
  - [x] Consider property-specific navigation if single-property report

- [x] Task 6: Update ReportsStore for Preview (AC: 6.4.1, 6.4.5)
  - [x] Add `getReportBlob(id: string): Promise<Blob>` method
  - [x] Use existing `api.reports_DownloadReport()` to fetch blob
  - [x] Cache blob in signal during preview session
  - [x] Clear cache when dialog closes

- [x] Task 7: Mobile Responsive Dialog (AC: 6.4.6)
  - [x] Full-screen dialog on mobile (< 768px)
  - [x] Larger touch targets for buttons (48x48 minimum)
  - [x] Swipe gestures for page navigation (if multi-page)
  - [x] Pinch-to-zoom support via touch events

- [x] Task 8: Loading State (AC: 6.4.7)
  - [x] Show mat-spinner while fetching PDF
  - [x] Display "Loading report..." message
  - [x] Disable action buttons until loaded
  - [x] Handle error state with retry option

- [x] Task 9: Wire Up ReportsComponent (AC: 6.4.1)
  - [x] Add `openPreview(report: GeneratedReportDto)` method
  - [x] Open ReportPreviewDialogComponent with report data
  - [x] Connect preview button click to openPreview()

- [x] Task 10: Backend Unit Tests
  - [x] Existing GetReportDownload handler already tested (from 6.3)
  - [x] Verify blob response content-type headers

- [x] Task 11: Frontend Unit Tests
  - [x] ReportPreviewDialogComponent tests:
    - [x] Displays loading state while fetching
    - [x] Shows PDF after successful load
    - [x] Zoom in increases scale
    - [x] Zoom out decreases scale
    - [x] Print button triggers print dialog
    - [x] Download button triggers download
    - [x] Close button closes dialog
  - [x] ReportsComponent preview integration tests

- [x] Task 12: Update E2E Tests
  - [x] Add preview flow to existing reports e2e test
  - [x] Verify preview dialog opens with PDF
  - [x] Verify print button exists (cannot automate actual print)
  - [x] Verify download from preview works

## Dev Notes

### Architecture Patterns

**Files to Create:**
```
frontend/src/app/features/reports/
├── components/
│   └── report-preview-dialog/
│       ├── report-preview-dialog.component.ts      # NEW
│       └── report-preview-dialog.component.spec.ts # NEW
```

**Files to Modify:**
```
frontend/src/app/features/reports/
├── reports.component.ts                   # Add preview button and handler
├── reports.component.spec.ts              # Add preview tests
├── stores/reports.store.ts                # Add getReportBlob method
├── stores/reports.store.spec.ts           # Add blob fetch tests
```

### Existing Components to Reuse

**PdfPreviewComponent** (`components/pdf-preview/pdf-preview.component.ts`):
- Already exists from Story 6.1
- Uses browser's native `<object>` tag for PDF rendering
- Accepts `pdfUrl` as SafeResourceUrl input
- Has fallback download link for unsupported browsers
- **Reuse directly** - no modifications needed

**ReportDialogComponent** (`components/report-dialog/report-dialog.component.ts`):
- Used for generating new reports (Story 6.1)
- Has preview and download functionality for newly generated PDFs
- **Reference for patterns** but don't modify - this is for generation

**ReportService** (`services/report.service.ts`):
- Has `triggerDownload()` helper - **reuse for download**
- Has `downloadPdf()` method - **can reference pattern**

### Frontend Implementation

**Report Preview Dialog:**
```typescript
// features/reports/components/report-preview-dialog/report-preview-dialog.component.ts
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { GeneratedReportDto } from '../../../../core/api/api.service';
import { ReportsStore } from '../../stores/reports.store';
import { PdfPreviewComponent } from '../pdf-preview/pdf-preview.component';

export interface ReportPreviewDialogData {
  report: GeneratedReportDto;
}

@Component({
  selector: 'app-report-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PdfPreviewComponent
  ],
  template: `
    <div class="preview-dialog" data-testid="report-preview-dialog">
      <!-- Toolbar -->
      <header class="preview-toolbar">
        <div class="toolbar-left">
          <mat-icon class="report-icon">description</mat-icon>
          <div class="report-info">
            <span class="report-name">{{ data.report.displayName }}</span>
            <span class="report-meta">Tax Year {{ data.report.year }}</span>
          </div>
        </div>

        <div class="toolbar-center">
          <button mat-icon-button
                  matTooltip="Zoom out"
                  (click)="zoomOut()"
                  [disabled]="isLoading() || zoomLevel() <= 50"
                  data-testid="zoom-out-btn">
            <mat-icon>remove</mat-icon>
          </button>
          <span class="zoom-level" data-testid="zoom-level">{{ zoomLevel() }}%</span>
          <button mat-icon-button
                  matTooltip="Zoom in"
                  (click)="zoomIn()"
                  [disabled]="isLoading() || zoomLevel() >= 200"
                  data-testid="zoom-in-btn">
            <mat-icon>add</mat-icon>
          </button>
          <button mat-icon-button
                  matTooltip="Reset zoom"
                  (click)="resetZoom()"
                  [disabled]="isLoading()"
                  data-testid="reset-zoom-btn">
            <mat-icon>fit_screen</mat-icon>
          </button>
        </div>

        <div class="toolbar-right">
          <button mat-icon-button
                  matTooltip="Print"
                  (click)="print()"
                  [disabled]="isLoading() || isPrinting()"
                  data-testid="print-btn">
            <mat-icon>print</mat-icon>
          </button>
          <button mat-icon-button
                  matTooltip="Download"
                  (click)="download()"
                  [disabled]="isLoading()"
                  data-testid="download-btn">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button
                  matTooltip="Close"
                  mat-dialog-close
                  data-testid="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </header>

      <!-- Content -->
      <div class="preview-content">
        @if (isLoading()) {
          <div class="loading-state" data-testid="loading-state">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading report...</p>
          </div>
        } @else if (error()) {
          <div class="error-state" data-testid="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <button mat-button color="primary" (click)="loadReport()">
              Try Again
            </button>
          </div>
        } @else if (previewUrl()) {
          <div class="pdf-wrapper" [style.transform]="'scale(' + zoomLevel() / 100 + ')'">
            <app-pdf-preview [pdfUrl]="previewUrl()!"></app-pdf-preview>
          </div>
        }
      </div>

      <!-- Footer hint -->
      <footer class="preview-footer">
        <span class="hint-text">
          Notice an error?
          <a (click)="navigateToFix()" data-testid="fix-data-link">
            Go to Expenses
          </a>
          to fix and regenerate.
        </span>
      </footer>
    </div>
  `,
  styles: [`
    .preview-dialog {
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 90vh;
    }

    .preview-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: var(--pm-surface, #fff);
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .report-icon {
        color: var(--pm-primary, #66BB6A);
        font-size: 28px;
        height: 28px;
        width: 28px;
      }

      .report-info {
        display: flex;
        flex-direction: column;
      }

      .report-name {
        font-weight: 500;
        font-size: 16px;
      }

      .report-meta {
        font-size: 12px;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
      }
    }

    .toolbar-center {
      display: flex;
      align-items: center;
      gap: 4px;

      .zoom-level {
        min-width: 50px;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
      }
    }

    .toolbar-right {
      display: flex;
      gap: 4px;
    }

    .preview-content {
      flex: 1;
      overflow: auto;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      padding: 16px;
    }

    .pdf-wrapper {
      transform-origin: top center;
      transition: transform 0.2s ease;
      width: 100%;
      height: 100%;
    }

    app-pdf-preview {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 500px;
    }

    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;
      color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));

      mat-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        margin-bottom: 16px;
      }

      p { margin: 0 0 16px; }
    }

    .error-state mat-icon {
      color: var(--pm-warn, #f44336);
    }

    .preview-footer {
      padding: 8px 16px;
      background: var(--pm-surface, #fff);
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      text-align: center;
      flex-shrink: 0;

      .hint-text {
        font-size: 13px;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));

        a {
          color: var(--pm-primary, #66BB6A);
          cursor: pointer;
          text-decoration: underline;
        }
      }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .preview-dialog {
        height: 100vh;
        max-height: 100vh;
      }

      .toolbar-center {
        display: none; /* Hide zoom on mobile - use pinch */
      }

      .toolbar-left .report-info {
        display: none;
      }

      button[mat-icon-button] {
        width: 48px;
        height: 48px;
      }
    }
  `]
})
export class ReportPreviewDialogComponent implements OnDestroy {
  readonly data = inject<ReportPreviewDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ReportPreviewDialogComponent>);
  private readonly store = inject(ReportsStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly isPrinting = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly zoomLevel = signal(100);

  private currentBlobUrl: string | null = null;
  private cachedBlob: Blob | null = null;
  private printIframe: HTMLIFrameElement | null = null;

  constructor() {
    this.loadReport();
  }

  async loadReport(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.cleanupBlobUrl();

    try {
      const blob = await this.store.getReportBlob(this.data.report.id!);
      this.cachedBlob = blob;
      this.currentBlobUrl = URL.createObjectURL(blob);
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentBlobUrl);
      this.previewUrl.set(safeUrl);
    } catch (err) {
      console.error('Failed to load report:', err);
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  zoomIn(): void {
    const current = this.zoomLevel();
    if (current < 200) {
      this.zoomLevel.set(Math.min(200, current + 25));
    }
  }

  zoomOut(): void {
    const current = this.zoomLevel();
    if (current > 50) {
      this.zoomLevel.set(Math.max(50, current - 25));
    }
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  async print(): Promise<void> {
    if (!this.cachedBlob || this.data.report.fileType === 'ZIP') {
      // Cannot print ZIP files directly
      return;
    }

    this.isPrinting.set(true);

    try {
      // Create invisible iframe for printing
      this.printIframe = document.createElement('iframe');
      this.printIframe.style.position = 'fixed';
      this.printIframe.style.right = '0';
      this.printIframe.style.bottom = '0';
      this.printIframe.style.width = '0';
      this.printIframe.style.height = '0';
      this.printIframe.style.border = 'none';

      const blobUrl = URL.createObjectURL(this.cachedBlob);
      this.printIframe.src = blobUrl;

      document.body.appendChild(this.printIframe);

      this.printIframe.onload = () => {
        this.printIframe?.contentWindow?.print();
        this.isPrinting.set(false);
        // Cleanup after print dialog closes
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          this.printIframe?.remove();
          this.printIframe = null;
        }, 1000);
      };
    } catch (err) {
      console.error('Print failed:', err);
      this.isPrinting.set(false);
    }
  }

  async download(): Promise<void> {
    if (!this.cachedBlob) return;

    const filename = this.data.report.fileName ||
      `Schedule-E-${this.data.report.displayName}-${this.data.report.year}.pdf`;

    const url = URL.createObjectURL(this.cachedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  navigateToFix(): void {
    this.dialogRef.close();
    // Navigate to expenses page where user can fix data
    this.router.navigate(['/expenses']);
  }

  private cleanupBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanupBlobUrl();
    this.cachedBlob = null;
    this.printIframe?.remove();
  }
}
```

**Update ReportsStore:**
```typescript
// Add to features/reports/stores/reports.store.ts

/**
 * Fetches the PDF/ZIP blob for a stored report.
 * Used for preview functionality (AC-6.4.1).
 */
async getReportBlob(id: string): Promise<Blob> {
  const response = await firstValueFrom(
    this.api.reports_DownloadReport(id)
  );
  // The NSwag client returns FileResponse with data as Blob
  return response.data;
}
```

**Update ReportsComponent:**
```typescript
// Add to reports.component.ts imports
import { ReportPreviewDialogComponent } from './components/report-preview-dialog/report-preview-dialog.component';

// Add to displayedColumns array (before 'actions')
// No change needed - preview button goes in actions column

// Add preview button in actions column (template)
// Before download button:
<button
  mat-icon-button
  color="primary"
  matTooltip="Preview report"
  (click)="openPreview(report)"
  [disabled]="report.fileType === 'ZIP'"
  [attr.data-testid]="'preview-report-' + report.id"
>
  <mat-icon>visibility</mat-icon>
</button>

// Add method
openPreview(report: GeneratedReportDto): void {
  this.dialog.open(ReportPreviewDialogComponent, {
    width: '90vw',
    maxWidth: '1200px',
    height: '90vh',
    panelClass: 'report-preview-panel',
    data: { report }
  });
}
```

### Print Implementation Details

**Why iframe approach:**
- Browser's native `window.print()` prints the entire page
- For PDF-specific printing, we need an isolated context
- iframe approach allows printing just the PDF document
- Works across all modern browsers

**Print flow:**
1. Create hidden iframe
2. Set iframe src to blob URL
3. Wait for iframe to load
4. Call `iframe.contentWindow.print()`
5. Browser opens native print dialog
6. Clean up iframe and blob URL after timeout

**ZIP handling:**
- Cannot print ZIP files directly
- Disable print button for ZIP reports
- User must download and extract first

### Mobile Considerations

**Responsive breakpoints:**
- Desktop (>= 1024px): Full dialog with all controls
- Tablet (768-1023px): Slightly smaller dialog
- Mobile (< 768px): Full-screen dialog, hidden zoom controls

**Touch support:**
- Browser's native PDF viewer handles pinch-to-zoom
- Large touch targets (48x48px) for buttons
- Simplified toolbar on mobile

### Previous Story Learnings (From 6.3)

**Patterns to follow:**
- Use MatDialog with consistent sizing patterns
- Signal-based state management (isLoading, error, etc.)
- Blob URL cleanup in ngOnDestroy
- DomSanitizer for safe resource URLs
- NSwag-generated API client methods

**Gotchas from 6.3:**
- Always filter by AccountId (handled by global query filter + explicit check)
- Handle both PDF and ZIP file types
- Test empty state and error state

### Testing Strategy

**Unit Tests:**
```typescript
// report-preview-dialog.component.spec.ts
describe('ReportPreviewDialogComponent', () => {
  it('should display loading state initially');
  it('should show PDF after successful load');
  it('should show error state on load failure');
  it('should increase zoom level when zoom in clicked');
  it('should decrease zoom level when zoom out clicked');
  it('should reset zoom to 100% when reset clicked');
  it('should trigger download when download clicked');
  it('should disable print for ZIP files');
  it('should navigate to expenses when fix link clicked');
  it('should cleanup blob URLs on destroy');
});

// reports.component.spec.ts additions
describe('Preview functionality', () => {
  it('should open preview dialog when preview clicked');
  it('should disable preview for ZIP reports');
});
```

**E2E Tests:**
```typescript
// e2e/tests/reports/report-preview.spec.ts
describe('Report Preview', () => {
  it('should open preview dialog for PDF report');
  it('should display zoom controls');
  it('should show print and download buttons');
  it('should close dialog when close clicked');
});
```

### Project Structure Notes

- Follows existing component structure patterns
- Reuses PdfPreviewComponent from Story 6.1
- Dialog patterns consistent with DeleteReportDialog and BatchReportDialog
- Signal-based state management consistent with ReportsStore

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4: Report Preview and Print]
- [Source: _bmad-output/planning-artifacts/architecture.md#Reports]
- [Source: _bmad-output/implementation-artifacts/6-3-view-and-manage-generated-reports.md]
- [Source: frontend/src/app/features/reports/components/pdf-preview/pdf-preview.component.ts]
- [Source: frontend/src/app/features/reports/components/report-dialog/report-dialog.component.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
