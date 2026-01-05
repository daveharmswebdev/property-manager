import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BatchReportDialogComponent } from './components/batch-report-dialog/batch-report-dialog.component';
import { DeleteReportDialogComponent } from './components/delete-report-dialog/delete-report-dialog.component';
import { ReportPreviewDialogComponent } from './components/report-preview-dialog/report-preview-dialog.component';
import { ReportsStore } from './stores/reports.store';
import { GeneratedReportDto } from '../../core/api/api.service';

/**
 * Reports page component (AC-6.3.1, AC-6.3.2, AC-6.3.3, AC-6.3.4)
 * Displays generated reports and provides generation features.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    MatSnackBarModule,
    DatePipe,
  ],
  template: `
    <div class="reports-page">
      <header class="page-header">
        <h1>Tax Reports</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openBatchDialog()"
          data-testid="generate-all-reports-btn"
        >
          <mat-icon>summarize</mat-icon>
          Generate All Schedule E Reports
        </button>
      </header>

      <section class="reports-content">
        <!-- Loading state -->
        @if (store.isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading reports...</p>
          </div>
        }

        <!-- Error state -->
        @if (store.error()) {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ store.error() }}</p>
            <button mat-button color="primary" (click)="store.loadReports()">
              Try Again
            </button>
          </div>
        }

        <!-- Empty state (AC-6.3.4) -->
        @if (store.isEmpty()) {
          <div class="empty-state" data-testid="reports-empty-state">
            <mat-icon>description</mat-icon>
            <p>No reports generated yet.</p>
            <p class="hint">
              Generate your first Schedule E report to get started.
            </p>
          </div>
        }

        <!-- Reports list (AC-6.3.1) -->
        @if (store.hasReports()) {
          <table
            mat-table
            [dataSource]="store.generatedReports()"
            class="reports-table"
            data-testid="reports-list"
          >
            <!-- Property Name Column -->
            <ng-container matColumnDef="displayName">
              <th mat-header-cell *matHeaderCellDef>Property</th>
              <td mat-cell *matCellDef="let report">
                {{ report.displayName }}
              </td>
            </ng-container>

            <!-- Year Column -->
            <ng-container matColumnDef="year">
              <th mat-header-cell *matHeaderCellDef>Year</th>
              <td mat-cell *matCellDef="let report">{{ report.year }}</td>
            </ng-container>

            <!-- Generated Date Column -->
            <ng-container matColumnDef="generatedAt">
              <th mat-header-cell *matHeaderCellDef>Generated</th>
              <td mat-cell *matCellDef="let report">
                {{ report.generatedAt | date: 'MMM d, y h:mm a' }}
              </td>
            </ng-container>

            <!-- File Type Column -->
            <ng-container matColumnDef="fileType">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let report">
                <span class="file-type-badge" [class.zip]="report.fileType === 'ZIP'">
                  {{ report.fileType }}
                </span>
              </td>
            </ng-container>

            <!-- File Size Column -->
            <ng-container matColumnDef="fileSizeBytes">
              <th mat-header-cell *matHeaderCellDef>Size</th>
              <td mat-cell *matCellDef="let report">
                {{ formatFileSize(report.fileSizeBytes) }}
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
              <td mat-cell *matCellDef="let report" class="actions-cell">
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
                <button
                  mat-icon-button
                  color="primary"
                  matTooltip="Download report"
                  (click)="downloadReport(report)"
                  [attr.data-testid]="'download-report-' + report.id"
                >
                  <mat-icon>download</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  matTooltip="Delete report"
                  (click)="confirmDelete(report)"
                  [attr.data-testid]="'delete-report-' + report.id"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .reports-page {
        padding: 24px;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;

        h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 500;
          color: var(--pm-text-primary, #333);
        }

        button mat-icon {
          margin-right: 8px;
        }
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        text-align: center;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));

        p {
          margin-top: 16px;
        }
      }

      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        text-align: center;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));

        mat-icon {
          font-size: 48px;
          height: 48px;
          width: 48px;
          color: var(--pm-warn, #f44336);
          margin-bottom: 16px;
        }

        p {
          margin: 0 0 16px;
        }
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        text-align: center;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));

        mat-icon {
          font-size: 64px;
          height: 64px;
          width: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        p {
          margin: 0;
        }

        .hint {
          font-size: 14px;
          color: var(--pm-text-tertiary, rgba(0, 0, 0, 0.4));
          margin-top: 8px;
        }
      }

      .reports-table {
        width: 100%;

        th.mat-mdc-header-cell {
          font-weight: 500;
          color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
        }

        .actions-header {
          text-align: right;
        }

        .actions-cell {
          text-align: right;
          white-space: nowrap;
        }
      }

      .file-type-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        background-color: #e3f2fd;
        color: #1976d2;

        &.zip {
          background-color: #e8f5e9;
          color: #388e3c;
        }
      }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly store = inject(ReportsStore);

  displayedColumns = [
    'displayName',
    'year',
    'generatedAt',
    'fileType',
    'fileSizeBytes',
    'actions',
  ];

  ngOnInit(): void {
    this.store.loadReports();
  }

  openBatchDialog(): void {
    const dialogRef = this.dialog.open(BatchReportDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
    });

    // Reload reports after dialog closes (if report was generated)
    dialogRef.afterClosed().subscribe((result) => {
      if (result?.generated) {
        this.store.loadReports();
      }
    });
  }

  /**
   * Open preview dialog for a report (AC-6.4.1)
   */
  openPreview(report: GeneratedReportDto): void {
    this.dialog.open(ReportPreviewDialogComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh',
      panelClass: 'report-preview-panel',
      data: { report },
    });
  }

  async downloadReport(report: GeneratedReportDto): Promise<void> {
    const success = await this.store.downloadReport(report);
    if (success) {
      this.snackBar.open('Report downloaded', 'Dismiss', { duration: 3000 });
    } else {
      this.snackBar.open('Failed to download report', 'Dismiss', { duration: 3000 });
    }
  }

  confirmDelete(report: GeneratedReportDto): void {
    const dialogRef = this.dialog.open(DeleteReportDialogComponent, {
      width: '400px',
      data: { report },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed && report.id) {
        const success = await this.store.deleteReport(report.id);
        if (success) {
          this.snackBar.open('Report deleted', 'Dismiss', { duration: 3000 });
        } else {
          this.snackBar.open('Failed to delete report', 'Dismiss', {
            duration: 3000,
          });
        }
      }
    });
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
}
