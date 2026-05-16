import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaintenanceRequestService } from '../../services/maintenance-request.service';

/**
 * Data passed into the dismiss dialog (Story 20.9, AC #4).
 */
export interface DismissRequestDialogData {
  maintenanceRequestId: string;
  propertyName: string;
  // Raw tenant description — the template truncates to 100 chars for the summary.
  description: string;
}

/**
 * Result returned when the dialog closes after a successful dismissal
 * (Story 20.9, AC #8). On Cancel the dialog closes with `undefined`.
 */
export type DismissRequestDialogResult = true;

/**
 * DismissRequestDialogComponent (Story 20.9, AC #4, #5, #6, #17).
 *
 * Reason-only dismissal flow: the user enters a reason, submits, and the
 * backend trims + persists + transitions status to Dismissed. After success
 * the parent detail page reloads the request via the store; this dialog
 * simply closes with `true` so the parent knows to refresh.
 */
@Component({
  selector: 'app-dismiss-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div data-testid="dismiss-dialog">
      <h2 mat-dialog-title>Dismiss Maintenance Request</h2>
      <mat-dialog-content>
        <p class="property-label">Property: {{ data.propertyName }}</p>
        <p class="description-summary" data-testid="dismiss-dialog-summary">
          {{ truncatedDescription }}
        </p>
        <p class="warning-text">
          This will tell the tenant their request will not be addressed.
        </p>
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="4"
              data-testid="dismiss-dialog-reason"
            ></textarea>
            @if (form.controls.reason.hasError('required')) {
              <mat-error>Reason is required</mat-error>
            }
            @if (form.controls.reason.hasError('maxlength')) {
              <mat-error>Reason must be 2000 characters or less</mat-error>
            }
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close data-testid="dismiss-dialog-cancel">
          Cancel
        </button>
        <button
          mat-flat-button
          color="warn"
          [disabled]="isSubmitDisabled()"
          (click)="onSubmit()"
          data-testid="dismiss-dialog-submit"
        >
          @if (isSubmitting()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            Dismiss Request
          }
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .property-label {
        font-size: 0.9em;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 8px;
      }
      .description-summary {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface);
        margin-bottom: 16px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .warning-text {
        color: var(--mat-sys-error);
        font-size: 0.875rem;
        margin-bottom: 16px;
      }
      mat-dialog-content {
        min-width: 400px;
      }
      @media (max-width: 600px) {
        mat-dialog-content {
          min-width: unset;
        }
      }
    `,
  ],
})
export class DismissRequestDialogComponent {
  protected readonly data: DismissRequestDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<DismissRequestDialogComponent, DismissRequestDialogResult>>(
      MatDialogRef,
    );
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(MaintenanceRequestService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isSubmitting = signal(false);

  form = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  /**
   * Truncate the tenant description to 100 chars with an ellipsis for the
   * read-only summary (AC #4).
   */
  get truncatedDescription(): string {
    const desc = this.data.description ?? '';
    return desc.length > 100 ? desc.slice(0, 100) + '…' : desc;
  }

  /**
   * Trim-aware disabled check (AC #5). `Validators.required` accepts whitespace
   * for strings, so we re-check after trim to mirror the FluentValidation
   * `NotEmpty()` behaviour on the backend.
   */
  isSubmitDisabled(): boolean {
    if (this.form.invalid || this.isSubmitting()) {
      return true;
    }
    const reason = this.form.value.reason ?? '';
    return reason.trim() === '';
  }

  onSubmit(): void {
    if (this.isSubmitDisabled()) {
      return;
    }
    this.isSubmitting.set(true);

    const reason = (this.form.value.reason ?? '').trim();
    this.service
      .dismissMaintenanceRequest(this.data.maintenanceRequestId, { reason })
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('Failed to dismiss request', 'Close', {
            duration: 4000,
          });
        },
      });
  }
}
