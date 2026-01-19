import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { GeneratedReportDto } from '../../../../core/api/api.service';
import { ReportsStore } from '../../stores/reports.store';
import { PdfPreviewComponent } from '../pdf-preview/pdf-preview.component';

/**
 * Data passed to the report preview dialog
 */
export interface ReportPreviewDialogData {
  report: GeneratedReportDto;
}

/**
 * ReportPreviewDialogComponent (AC-6.4.1, AC-6.4.2, AC-6.4.3, AC-6.4.4, AC-6.4.5, AC-6.4.6, AC-6.4.7)
 *
 * Dialog for previewing stored PDF reports with:
 * - Zoom controls (AC-6.4.2)
 * - Print functionality (AC-6.4.3)
 * - Download option (AC-6.4.5)
 * - Fix data navigation hint (AC-6.4.4)
 * - Mobile responsive design (AC-6.4.6)
 * - Loading state (AC-6.4.7)
 */
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
    MatSnackBarModule,
    PdfPreviewComponent,
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
          <button
            mat-icon-button
            matTooltip="Zoom out"
            (click)="zoomOut()"
            [disabled]="isLoading() || zoomLevel() <= 50"
            data-testid="zoom-out-btn"
          >
            <mat-icon>remove</mat-icon>
          </button>
          <span class="zoom-level" data-testid="zoom-level"
            >{{ zoomLevel() }}%</span
          >
          <button
            mat-icon-button
            matTooltip="Zoom in"
            (click)="zoomIn()"
            [disabled]="isLoading() || zoomLevel() >= 200"
            data-testid="zoom-in-btn"
          >
            <mat-icon>add</mat-icon>
          </button>
          <button
            mat-icon-button
            matTooltip="Reset zoom"
            (click)="resetZoom()"
            [disabled]="isLoading()"
            data-testid="reset-zoom-btn"
          >
            <mat-icon>fit_screen</mat-icon>
          </button>
        </div>

        <div class="toolbar-right">
          <button
            mat-icon-button
            matTooltip="Print"
            (click)="print()"
            [disabled]="isLoading() || isPrinting() || isZipFile()"
            data-testid="print-btn"
          >
            <mat-icon>print</mat-icon>
          </button>
          <button
            mat-icon-button
            matTooltip="Download"
            (click)="download()"
            [disabled]="isLoading()"
            data-testid="download-btn"
          >
            <mat-icon>download</mat-icon>
          </button>
          <button
            mat-icon-button
            matTooltip="Close"
            mat-dialog-close
            data-testid="close-btn"
          >
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
          <div
            class="pdf-wrapper"
            [style.transform]="'scale(' + zoomLevel() / 100 + ')'"
          >
            <app-pdf-preview [pdfUrl]="previewUrl()!"></app-pdf-preview>
          </div>
        }
      </div>

      <!-- Footer hint (AC-6.4.4) -->
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
  styles: [
    `
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
          color: var(--pm-primary, #4361ee);
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

      .loading-state,
      .error-state {
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

        p {
          margin: 0 0 16px;
        }
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
            color: var(--pm-primary, #4361ee);
            cursor: pointer;
            text-decoration: underline;
          }
        }
      }

      /* Mobile responsive (AC-6.4.6) */
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
    `,
  ],
})
export class ReportPreviewDialogComponent implements OnDestroy {
  readonly data = inject<ReportPreviewDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ReportPreviewDialogComponent>);
  private readonly store = inject(ReportsStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

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

  /**
   * Check if the report is a ZIP file (cannot preview or print directly)
   */
  isZipFile(): boolean {
    return this.data.report.fileType === 'ZIP';
  }

  /**
   * Load the report PDF from the API (AC-6.4.7)
   */
  async loadReport(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.cleanupBlobUrl();

    try {
      const blob = await this.store.getReportBlob(this.data.report.id!);
      this.cachedBlob = blob;
      this.currentBlobUrl = URL.createObjectURL(blob);
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        this.currentBlobUrl
      );
      this.previewUrl.set(safeUrl);
    } catch (err) {
      console.error('Failed to load report:', err);
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Increase zoom level (AC-6.4.2)
   */
  zoomIn(): void {
    const current = this.zoomLevel();
    if (current < 200) {
      this.zoomLevel.set(Math.min(200, current + 25));
    }
  }

  /**
   * Decrease zoom level (AC-6.4.2)
   */
  zoomOut(): void {
    const current = this.zoomLevel();
    if (current > 50) {
      this.zoomLevel.set(Math.max(50, current - 25));
    }
  }

  /**
   * Reset zoom to default (AC-6.4.2)
   */
  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  /**
   * Print the PDF via iframe (AC-6.4.3)
   */
  async print(): Promise<void> {
    if (!this.cachedBlob || this.isZipFile()) {
      // Cannot print ZIP files directly
      return;
    }

    this.isPrinting.set(true);
    this.snackBar.open('Preparing print...', '', { duration: 2000 });

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

  /**
   * Download the report (AC-6.4.5)
   */
  async download(): Promise<void> {
    if (!this.cachedBlob) return;

    const filename =
      this.data.report.fileName ||
      `Schedule-E-${this.data.report.displayName}-${this.data.report.year}.pdf`;

    const url = URL.createObjectURL(this.cachedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.snackBar.open('Report downloaded', 'Dismiss', { duration: 3000 });
  }

  /**
   * Navigate to expenses page to fix data (AC-6.4.4)
   */
  navigateToFix(): void {
    this.dialogRef.close();
    // Navigate to expenses page where user can fix data
    this.router.navigate(['/expenses']);
  }

  /**
   * Clean up blob URL to prevent memory leaks
   */
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
