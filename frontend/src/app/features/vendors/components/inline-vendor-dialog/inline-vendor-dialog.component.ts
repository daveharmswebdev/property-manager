import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VendorStore } from '../../stores/vendor.store';

/**
 * Result returned when vendor is successfully created
 */
export interface InlineVendorDialogResult {
  id: string;
  fullName: string;
}

/**
 * InlineVendorDialogComponent (Story 9-5 AC #2, #3, #4, #5, #7)
 *
 * Minimal vendor creation dialog for use within work order form.
 * Creates vendor inline without navigation.
 *
 * Features:
 * - First Name (required), Middle Name (optional), Last Name (required)
 * - Cancel closes without creating
 * - Save creates vendor and returns data for auto-selection
 * - Remains open on error for retry
 */
@Component({
  selector: 'app-inline-vendor-dialog',
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
    <h2 mat-dialog-title>Add New Vendor</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="vendor-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" />
          @if (form.get('firstName')?.hasError('required') && form.get('firstName')?.touched) {
            <mat-error>First name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Middle Name (Optional)</mat-label>
          <input matInput formControlName="middleName" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" />
          @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
            <mat-error>Last name is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="store.isSaving()">
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="form.invalid || store.isSaving()"
      >
        @if (store.isSaving()) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          Save
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .vendor-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 300px;
      }

      .full-width {
        width: 100%;
      }

      mat-dialog-content {
        overflow: visible;
        padding-top: 8px;
      }
    `,
  ],
})
export class InlineVendorDialogComponent {
  protected readonly store = inject(VendorStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(
    MatDialogRef<InlineVendorDialogComponent>
  );

  protected form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected onCancel(): void {
    this.dialogRef.close(null);
  }

  protected async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = {
      firstName: this.form.value.firstName?.trim(),
      middleName: this.form.value.middleName?.trim() || undefined,
      lastName: this.form.value.lastName?.trim(),
    };

    const vendorId = await this.store.createVendorInline(request);

    if (vendorId) {
      const fullName = [request.firstName, request.middleName, request.lastName]
        .filter(Boolean)
        .join(' ');
      this.dialogRef.close({
        id: vendorId,
        fullName,
      } as InlineVendorDialogResult);
    }
    // On error, dialog stays open (store shows snackbar error)
  }
}
