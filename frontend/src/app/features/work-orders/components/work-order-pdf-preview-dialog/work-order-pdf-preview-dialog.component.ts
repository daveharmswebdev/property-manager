import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfPreviewComponent } from '../../../reports/components/pdf-preview/pdf-preview.component';
import { WorkOrderService } from '../../services/work-order.service';

export interface WorkOrderPdfPreviewDialogData {
  workOrderId: string;
}

/**
 * WorkOrderPdfPreviewDialogComponent (Story 12-2, AC #3-#7)
 *
 * Dialog for previewing work order PDFs with:
 * - Zoom controls (AC #4)
 * - Download button (AC #5)
 * - Print button (AC #6)
 * - Close via X, Escape, or outside click (AC #7)
 */
@Component({
  selector: 'app-work-order-pdf-preview-dialog',
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
    <div class="preview-dialog" data-testid="wo-pdf-preview-dialog">
      <!-- Toolbar -->
      <header class="preview-toolbar">
        <div class="toolbar-left">
          <mat-icon class="report-icon">description</mat-icon>
          <span class="report-name">Work Order PDF</span>
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
          <span class="zoom-level" data-testid="zoom-level">{{ zoomLevel() }}%</span>
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
            [disabled]="isLoading() || isPrinting()"
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
            <p>Loading PDF...</p>
          </div>
        } @else if (error()) {
          <div class="error-state" data-testid="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <button mat-button color="primary" (click)="loadPdf()">
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
    </div>
  `,
  styles: [
    `
      .preview-dialog {
        display: flex;
        flex-direction: column;
        height: 85vh;
        max-height: 85vh;
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
      }

      .report-icon {
        color: var(--pm-primary, #4361ee);
        font-size: 28px;
        height: 28px;
        width: 28px;
      }

      .report-name {
        font-weight: 500;
        font-size: 16px;
      }

      .toolbar-center {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .zoom-level {
        min-width: 50px;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
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
      }

      .loading-state mat-icon,
      .error-state mat-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        margin-bottom: 16px;
      }

      .error-state mat-icon {
        color: var(--pm-warn, #f44336);
      }

      .loading-state p,
      .error-state p {
        margin: 0 0 16px;
      }

      @media (max-width: 768px) {
        .preview-dialog {
          height: 100vh;
          max-height: 100vh;
        }

        .toolbar-center {
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
export class WorkOrderPdfPreviewDialogComponent implements OnDestroy {
  readonly data = inject<WorkOrderPdfPreviewDialogData>(MAT_DIALOG_DATA);
  private readonly workOrderService = inject(WorkOrderService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly snackBar = inject(MatSnackBar);

  readonly isLoading = signal(true);
  readonly isPrinting = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly zoomLevel = signal(100);

  private currentBlobUrl: string | null = null;
  private cachedBlob: Blob | null = null;
  private cachedFilename: string = 'WorkOrder.pdf';
  private printIframe: HTMLIFrameElement | null = null;
  private loadSub: Subscription | null = null;

  constructor() {
    this.loadPdf();
  }

  loadPdf(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.cleanupBlobUrl();
    this.loadSub?.unsubscribe();

    this.loadSub = this.workOrderService.generateWorkOrderPdf(this.data.workOrderId).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.error.set('Failed to generate PDF. Please try again.');
          this.isLoading.set(false);
          return;
        }
        this.cachedBlob = blob;

        // Extract filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const match = disposition?.match(/filename="?([^";\n]*)"?/);
        this.cachedFilename = match?.[1] || `WorkOrder-${this.data.workOrderId.substring(0, 8)}.pdf`;

        this.currentBlobUrl = URL.createObjectURL(blob);
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentBlobUrl);
        this.previewUrl.set(safeUrl);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to generate PDF. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  zoomIn(): void {
    const current = this.zoomLevel();
    if (current < 200) {
      this.zoomLevel.set(Math.min(200, current + 10));
    }
  }

  zoomOut(): void {
    const current = this.zoomLevel();
    if (current > 50) {
      this.zoomLevel.set(Math.max(50, current - 10));
    }
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  download(): void {
    if (!this.cachedBlob) return;

    const url = URL.createObjectURL(this.cachedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.cachedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.snackBar.open('PDF downloaded', 'Dismiss', { duration: 3000 });
  }

  print(): void {
    if (!this.cachedBlob) return;

    this.isPrinting.set(true);

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
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        this.printIframe?.remove();
        this.printIframe = null;
      }, 1000);
    };
  }

  private cleanupBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.cleanupBlobUrl();
    this.cachedBlob = null;
    this.printIframe?.remove();
  }
}
