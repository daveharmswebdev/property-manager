import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GeneratedReportDto } from '../../../../core/api/api.service';

export interface DeleteReportDialogData {
  report: GeneratedReportDto;
}

/**
 * Delete Report Confirmation Dialog (AC-6.3.3)
 *
 * Displays a confirmation dialog before deleting a generated report.
 */
@Component({
  selector: 'app-delete-report-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">warning</mat-icon>
      Delete Report?
    </h2>

    <mat-dialog-content>
      <p>
        Are you sure you want to delete this report?
      </p>
      <div class="report-info">
        <strong>{{ data.report.displayName }}</strong>
        <span class="year">{{ data.report.year }}</span>
        <span class="filename">{{ data.report.fileName }}</span>
      </div>
      <p class="warning-text">This action cannot be undone.</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" data-testid="cancel-delete-btn">
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        [mat-dialog-close]="true"
        data-testid="confirm-delete-btn"
      >
        Delete Report
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 16px 24px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      }

      mat-dialog-content {
        padding: 24px;

        p {
          margin: 0 0 16px;
        }
      }

      .report-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 16px;
        background-color: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 16px;

        strong {
          font-size: 14px;
        }

        .year {
          font-size: 13px;
          color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
        }

        .filename {
          font-size: 12px;
          color: var(--pm-text-tertiary, rgba(0, 0, 0, 0.4));
        }
      }

      .warning-text {
        color: var(--pm-warn, #f44336);
        font-size: 13px;
        margin: 0;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
        gap: 8px;
      }
    `,
  ],
})
export class DeleteReportDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<DeleteReportDialogComponent>
  );
  protected readonly data = inject<DeleteReportDialogData>(MAT_DIALOG_DATA);
}
