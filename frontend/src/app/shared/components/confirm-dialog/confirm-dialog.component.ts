import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/**
 * Data interface for ConfirmDialogComponent (AC-2.4.3)
 */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

/**
 * Reusable Confirmation Dialog Component (AC-2.4.3)
 *
 * A generic confirmation dialog for actions requiring user confirmation.
 * Used for unsaved changes warnings, delete confirmations, etc.
 *
 * Returns true when confirm button is clicked, false when cancel is clicked.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">{{ data.cancelText }}</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">
        {{ data.confirmText }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2 {
        margin: 0;
        color: var(--pm-text-primary, #333);
      }

      mat-dialog-content {
        padding-top: 16px;
      }

      p {
        margin: 0;
        color: var(--pm-text-secondary, #666);
        font-size: 14px;
        line-height: 1.5;
      }

      mat-dialog-actions {
        padding: 16px 0 0;
        gap: 8px;
      }

      button {
        min-width: 80px;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  protected readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
