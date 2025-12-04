import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Data interface for DeletePropertyDialogComponent (AC-2.5.1)
 */
export interface DeletePropertyDialogData {
  propertyName: string;
}

/**
 * Delete Property Confirmation Dialog Component (AC-2.5.1)
 *
 * Displays a confirmation dialog when user attempts to delete a property.
 * - Modal title: "Delete [Property Name]?"
 * - Message explains data will be preserved for tax purposes
 * - [Cancel] and [Delete] buttons
 * - Delete button styled as destructive (red/mat-warn)
 *
 * Returns true when Delete button is clicked, false when Cancel is clicked.
 */
@Component({
  selector: 'app-delete-property-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="delete-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2 mat-dialog-title>Delete {{ data.propertyName }}?</h2>
      </div>
      <mat-dialog-content>
        <p class="warning-message">
          This will remove the property from your active portfolio.
        </p>
        <p class="preservation-note">
          Historical expense and income records will be preserved for tax purposes.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="warn" (click)="onDelete()">
          <mat-icon>delete</mat-icon>
          Delete
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .delete-dialog {
        min-width: 350px;
        max-width: 450px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;

        .warning-icon {
          color: #f44336;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        h2 {
          margin: 0;
          color: var(--pm-text-primary, #333);
          font-size: 20px;
          font-weight: 500;
        }
      }

      mat-dialog-content {
        padding-top: 8px;

        .warning-message {
          margin: 0 0 12px 0;
          color: var(--pm-text-primary, #333);
          font-size: 14px;
          line-height: 1.5;
        }

        .preservation-note {
          margin: 0;
          color: var(--pm-text-secondary, #666);
          font-size: 13px;
          line-height: 1.5;
          padding: 12px;
          background-color: #f5f5f5;
          border-radius: 4px;
          border-left: 3px solid #1976d2;
        }
      }

      mat-dialog-actions {
        padding: 16px 0 0;
        gap: 8px;

        button {
          min-width: 80px;

          mat-icon {
            margin-right: 4px;
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }
    `,
  ],
})
export class DeletePropertyDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeletePropertyDialogComponent>);
  protected readonly data: DeletePropertyDialogData = inject(MAT_DIALOG_DATA);

  onDelete(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
