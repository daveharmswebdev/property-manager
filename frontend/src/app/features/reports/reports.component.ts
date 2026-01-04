import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { BatchReportDialogComponent } from './components/batch-report-dialog/batch-report-dialog.component';

/**
 * Reports page component (AC-6.2.1)
 * Provides access to tax report generation features.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="reports-page">
      <header class="page-header">
        <h1>Tax Reports</h1>
        <button mat-flat-button
                color="primary"
                (click)="openBatchDialog()"
                data-testid="generate-all-reports-btn">
          <mat-icon>summarize</mat-icon>
          Generate All Schedule E Reports
        </button>
      </header>

      <section class="reports-content">
        <!-- Placeholder for future: list of generated reports (Story 6.3) -->
        <div class="empty-state">
          <mat-icon>description</mat-icon>
          <p>Generate Schedule E worksheets for tax reporting.</p>
          <p class="hint">Click the button above to generate reports for all your properties.</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
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
  `]
})
export class ReportsComponent {
  private readonly dialog = inject(MatDialog);

  openBatchDialog(): void {
    this.dialog.open(BatchReportDialogComponent, {
      width: '600px',
      maxHeight: '80vh'
    });
  }
}
