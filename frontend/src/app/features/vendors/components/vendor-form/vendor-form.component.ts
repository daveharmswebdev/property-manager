import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VendorStore } from '../../stores/vendor.store';

/**
 * Vendor Form Component (AC #3, #4, #5, #6)
 *
 * Form for creating a new vendor with first name, middle name (optional), and last name.
 */
@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="vendor-form-container">
      <mat-card class="vendor-form-card">
        <mat-card-header>
          <mat-card-title>Add Vendor</mat-card-title>
          <mat-card-subtitle>Enter the vendor's name to add them to your list</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- First Name (AC #3, #5) -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>First Name</mat-label>
              <input matInput formControlName="firstName" placeholder="Enter first name" />
              @if (form.get('firstName')?.hasError('required') && form.get('firstName')?.touched) {
                <mat-error>First name is required</mat-error>
              }
              @if (form.get('firstName')?.hasError('maxlength')) {
                <mat-error>First name must be 100 characters or less</mat-error>
              }
            </mat-form-field>

            <!-- Middle Name (Optional) (AC #3) -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Middle Name (Optional)</mat-label>
              <input matInput formControlName="middleName" placeholder="Enter middle name" />
              @if (form.get('middleName')?.hasError('maxlength')) {
                <mat-error>Middle name must be 100 characters or less</mat-error>
              }
            </mat-form-field>

            <!-- Last Name (AC #3, #6) -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Last Name</mat-label>
              <input matInput formControlName="lastName" placeholder="Enter last name" />
              @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
                <mat-error>Last name is required</mat-error>
              }
              @if (form.get('lastName')?.hasError('maxlength')) {
                <mat-error>Last name must be 100 characters or less</mat-error>
              }
            </mat-form-field>

            <!-- Form Actions (AC #4) -->
            <div class="form-actions">
              <button
                mat-button
                type="button"
                (click)="onCancel()"
                [disabled]="store.isSaving()"
              >
                Cancel
              </button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="form.invalid || store.isSaving()"
              >
                @if (store.isSaving()) {
                  <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
                  Saving...
                } @else {
                  Save
                }
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .vendor-form-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }

      .vendor-form-card {
        padding: 16px;
      }

      mat-card-header {
        margin-bottom: 24px;
      }

      mat-card-title {
        font-size: 24px !important;
      }

      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      ::ng-deep .button-spinner circle {
        stroke: white;
      }
    `,
  ],
})
export class VendorFormComponent {
  protected readonly store = inject(VendorStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /**
   * Form group with validation (AC #5, #6)
   * - firstName: Required, max 100 chars
   * - middleName: Optional, max 100 chars
   * - lastName: Required, max 100 chars
   */
  protected form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  /**
   * Handle form submission (AC #4)
   * Creates vendor via store and navigates back to list on success
   */
  protected onSubmit(): void {
    if (this.form.invalid) {
      // Mark all fields as touched to show validation errors
      this.form.markAllAsTouched();
      return;
    }

    const request = {
      firstName: this.form.value.firstName?.trim(),
      middleName: this.form.value.middleName?.trim() || undefined,
      lastName: this.form.value.lastName?.trim(),
    };

    this.store.createVendor(request);
  }

  /**
   * Handle cancel button - navigate back to vendor list
   */
  protected onCancel(): void {
    this.router.navigate(['/vendors']);
  }
}
