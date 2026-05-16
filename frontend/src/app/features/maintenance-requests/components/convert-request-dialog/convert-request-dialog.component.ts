import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';
import {
  ConvertMaintenanceRequestRequest,
  MaintenanceRequestService,
} from '../../services/maintenance-request.service';

/**
 * Data passed into the convert dialog (Story 20.8, AC #4).
 */
export interface ConvertRequestDialogData {
  maintenanceRequestId: string;
  propertyId: string;
  propertyName: string;
  description: string;
}

/**
 * Result returned when the dialog closes with a successful conversion
 * (Story 20.8, AC #5, #8). When the user cancels, the dialog closes
 * with `undefined` instead.
 */
export interface ConvertRequestDialogResult {
  workOrderId: string;
  maintenanceRequestId: string;
}

/**
 * ConvertRequestDialogComponent (Story 20.8, AC #4, #5, #15, #16).
 *
 * Lets the landlord turn a maintenance request into a work order in one shot:
 * description (pre-filled), optional category, optional vendor (or self/DIY).
 * The backend handles WO creation + photo mirror + status transition atomically.
 */
@Component({
  selector: 'app-convert-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div data-testid="convert-dialog">
      <h2 mat-dialog-title>Convert to Work Order</h2>
      <mat-dialog-content>
        <p class="property-label">Property: {{ data.propertyName }}</p>
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea
              matInput
              formControlName="description"
              rows="4"
              data-testid="convert-dialog-description"
            ></textarea>
            @if (form.controls.description.hasError('required')) {
              <mat-error>Description is required</mat-error>
            }
            @if (form.controls.description.hasError('maxlength')) {
              <mat-error>Description must be 5000 characters or less</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Category (optional)</mat-label>
            <mat-select
              formControlName="categoryId"
              data-testid="convert-dialog-category"
            >
              <mat-option value="">None</mat-option>
              @for (cat of expenseStore.sortedCategories(); track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Assigned To (optional)</mat-label>
            <mat-select
              formControlName="vendorId"
              data-testid="convert-dialog-vendor"
            >
              <mat-option value="">Self (DIY)</mat-option>
              @for (vendor of vendorStore.vendors(); track vendor.id) {
                <mat-option [value]="vendor.id">{{ vendor.fullName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close data-testid="convert-dialog-cancel">
          Cancel
        </button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="form.invalid || isSubmitting()"
          (click)="onSubmit()"
          data-testid="convert-dialog-submit"
        >
          @if (isSubmitting()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            Convert
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
export class ConvertRequestDialogComponent implements OnInit {
  protected readonly data: ConvertRequestDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ConvertRequestDialogComponent, ConvertRequestDialogResult>>(
      MatDialogRef,
    );
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(MaintenanceRequestService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly expenseStore = inject(ExpenseStore);
  protected readonly vendorStore = inject(VendorStore);

  readonly isSubmitting = signal(false);

  form = this.fb.group({
    description: [
      this.data.description,
      [Validators.required, Validators.maxLength(5000)],
    ],
    categoryId: [''],
    vendorId: [''],
  });

  ngOnInit(): void {
    this.expenseStore.loadCategories();
    this.vendorStore.loadVendors();
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);

    const value = this.form.value;
    const body: ConvertMaintenanceRequestRequest = {
      description: (value.description ?? '').trim(),
      categoryId: value.categoryId ? value.categoryId : undefined,
      vendorId: value.vendorId ? value.vendorId : undefined,
    };

    this.service
      .convertToWorkOrder(this.data.maintenanceRequestId, body)
      .subscribe({
        next: (response) => {
          this.dialogRef.close({
            workOrderId: response.workOrderId,
            maintenanceRequestId: response.maintenanceRequestId,
          });
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackBar.open(
            'Failed to convert request to work order',
            'Close',
            { duration: 4000 },
          );
        },
      });
  }
}
