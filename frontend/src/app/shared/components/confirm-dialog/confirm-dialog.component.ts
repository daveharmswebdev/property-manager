import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Configuration options for the confirm dialog
 */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  iconColor?: 'primary' | 'accent' | 'warn';
  secondaryMessage?: string;
  confirmIcon?: string;
}

/**
 * ConfirmDialogComponent
 *
 * A reusable confirmation dialog component.
 * Returns true if confirmed, false/null if cancelled.
 *
 * Usage:
 * ```typescript
 * const dialogRef = this.dialog.open(ConfirmDialogComponent, {
 *   data: {
 *     title: 'Delete this item?',
 *     message: 'This action cannot be undone.',
 *     confirmText: 'Delete',
 *     confirmColor: 'warn'
 *   }
 * });
 *
 * dialogRef.afterClosed().subscribe(confirmed => {
 *   if (confirmed) { ... }
 * });
 * ```
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.icon) {
        <mat-icon class="header-icon" [ngClass]="'icon-' + (data.iconColor || 'primary')">
          {{ data.icon }}
        </mat-icon>
      }
      <p class="primary-message">{{ data.message }}</p>
      @if (data.secondaryMessage) {
        <p class="secondary-message">{{ data.secondaryMessage }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button mat-raised-button color="warn" (click)="onConfirm()">
        @if (data.confirmIcon) {
          <mat-icon>{{ data.confirmIcon }}</mat-icon>
        }
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .header-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
      }

      .icon-primary {
        color: var(--mat-sys-primary);
      }

      .icon-accent {
        color: var(--mat-sys-tertiary);
      }

      .icon-warn {
        color: var(--mat-sys-error);
      }

      .primary-message {
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
      }

      .secondary-message {
        margin: 0;
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  protected onCancel(): void {
    this.dialogRef.close(false);
  }

  protected onConfirm(): void {
    this.dialogRef.close(true);
  }
}
