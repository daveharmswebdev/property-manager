import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReportService } from '../../services/report.service';
import { PdfPreviewComponent } from '../pdf-preview/pdf-preview.component';

/**
 * Data passed to the report dialog.
 */
export interface ReportDialogData {
  propertyId: string;
  propertyName: string;
  currentYear: number;
}

/**
 * Report Dialog Component (AC-6.1.1, AC-6.1.2, AC-6.1.3, AC-6.1.5)
 *
 * Modal dialog for generating Schedule E PDF reports.
 * Features:
 * - Year selector dropdown (defaults to currently selected year)
 * - Preview button to display PDF in modal
 * - Download button to save PDF to device
 * - Loading spinner during generation
 * - Error handling with retry option
 */
@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
    PdfPreviewComponent
  ],
  template: `
    <h2 mat-dialog-title data-testid="report-dialog-title">
      <mat-icon class="title-icon">description</mat-icon>
      Generate Schedule E Report
    </h2>

    <mat-dialog-content data-testid="report-dialog-content">
      <p class="property-name">Property: <strong>{{ data.propertyName }}</strong></p>

      <mat-form-field appearance="outline" class="year-selector">
        <mat-label>Tax Year</mat-label>
        <mat-select [(value)]="selectedYear" data-testid="year-selector">
          @for (year of availableYears; track year) {
            <mat-option [value]="year">{{ year }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (isLoading()) {
        <div class="loading-container" data-testid="loading-indicator">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Generating report...</p>
        </div>
      }

      @if (error()) {
        <div class="error-message" data-testid="error-message">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error() }}</p>
          <button mat-button color="primary" (click)="clearError()" data-testid="retry-button">
            Try Again
          </button>
        </div>
      }

      @if (previewUrl()) {
        <app-pdf-preview [pdfUrl]="previewUrl()!" data-testid="pdf-preview"></app-pdf-preview>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-testid="cancel-button">Cancel</button>
      <button mat-stroked-button
              color="primary"
              (click)="preview()"
              [disabled]="isLoading()"
              data-testid="preview-button">
        <mat-icon>visibility</mat-icon>
        Preview
      </button>
      <button mat-flat-button
              color="primary"
              (click)="download()"
              [disabled]="isLoading()"
              data-testid="download-button">
        <mat-icon>download</mat-icon>
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      .title-icon {
        color: var(--pm-primary, #2e7d32);
      }
    }

    mat-dialog-content {
      padding: 24px;
      min-height: 200px;
    }

    .property-name {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: var(--pm-text-secondary, #666);

      strong {
        color: var(--pm-text-primary, #333);
      }
    }

    .year-selector {
      width: 100%;
      margin-bottom: 16px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      gap: 16px;

      p {
        margin: 0;
        color: var(--pm-text-secondary, #666);
      }
    }

    .error-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      text-align: center;
      background-color: #ffebee;
      border-radius: 4px;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #c62828;
        margin-bottom: 8px;
      }

      p {
        margin: 0 0 16px 0;
        color: #c62828;
      }
    }

    app-pdf-preview {
      display: block;
      height: 450px;
      margin-top: 16px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      gap: 8px;

      button mat-icon {
        margin-right: 4px;
      }
    }
  `]
})
export class ReportDialogComponent implements OnDestroy {
  private readonly reportService = inject(ReportService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly dialogRef = inject(MatDialogRef<ReportDialogComponent>);
  readonly data = inject<ReportDialogData>(MAT_DIALOG_DATA);

  selectedYear = this.data.currentYear;
  availableYears = this.generateYearOptions();

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);

  private currentBlobUrl: string | null = null;

  /**
   * Generate a list of available years (current year and 4 previous years).
   */
  private generateYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }

  /**
   * Preview the Schedule E report (AC-6.1.2).
   * Generates the PDF and displays it in the embedded viewer.
   */
  async preview(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.cleanupBlobUrl();

    try {
      const blob = await this.reportService.generateScheduleE(
        this.data.propertyId,
        this.selectedYear
      );

      // Create object URL for preview
      this.currentBlobUrl = URL.createObjectURL(blob);
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentBlobUrl);
      this.previewUrl.set(safeUrl);
    } catch (err) {
      console.error('Report generation failed:', err);
      this.error.set('Failed to generate report. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Download the Schedule E report (AC-6.1.3).
   * Generates the PDF and triggers a browser download.
   */
  async download(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const blob = await this.reportService.generateScheduleE(
        this.data.propertyId,
        this.selectedYear
      );
      this.reportService.downloadPdf(blob, this.data.propertyName, this.selectedYear);
    } catch (err) {
      console.error('Report download failed:', err);
      this.error.set('Failed to download report. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Clear the error state to allow retry.
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Clean up blob URL to prevent memory leaks.
   */
  private cleanupBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanupBlobUrl();
  }
}
