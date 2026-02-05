import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import {
  WorkOrderService,
  CreateWorkOrderRequest,
} from '../../services/work-order.service';
import {
  ExpenseService,
  UpdateExpenseRequest,
} from '../../../expenses/services/expense.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';

/**
 * Data passed to the dialog (AC #2)
 */
export interface CreateWoFromExpenseDialogData {
  expenseId: string;
  propertyId: string;
  propertyName: string;
  description?: string;
  categoryId?: string;
}

/**
 * Result returned when dialog closes with a created work order (AC #3)
 */
export interface CreateWoFromExpenseDialogResult {
  workOrderId: string;
  expenseId: string;
  linkFailed?: boolean;
}

/**
 * CreateWoFromExpenseDialogComponent (Story 11.6 AC #2, #3, #4, #5, #6)
 *
 * Dialog for creating a work order retroactively from an expense.
 * Pre-populates fields from the expense, creates WO, then auto-links.
 */
@Component({
  selector: 'app-create-wo-from-expense-dialog',
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
    <h2 mat-dialog-title>Create Work Order from Expense</h2>
    <mat-dialog-content>
      <p class="property-label">Property: {{ data.propertyName }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
          @if (form.controls.description.hasError('required')) {
            <mat-error>Description is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category (optional)</mat-label>
          <mat-select formControlName="categoryId">
            <mat-option value="">None</mat-option>
            @for (cat of expenseStore.sortedCategories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Assigned To (optional)</mat-label>
          <mat-select formControlName="vendorId">
            <mat-option value="">Self (DIY)</mat-option>
            @for (vendor of vendorStore.vendors(); track vendor.id) {
              <mat-option [value]="vendor.id">{{ vendor.fullName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary"
        [disabled]="form.invalid || isSubmitting()"
        (click)="onSubmit()">
        @if (isSubmitting()) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          Create & Link
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    .property-label {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 16px;
    }
    mat-dialog-content { min-width: 400px; }
    @media (max-width: 600px) {
      mat-dialog-content { min-width: unset; }
    }
  `],
})
export class CreateWoFromExpenseDialogComponent implements OnInit {
  protected readonly data: CreateWoFromExpenseDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CreateWoFromExpenseDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly workOrderService = inject(WorkOrderService);
  private readonly expenseService = inject(ExpenseService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly expenseStore = inject(ExpenseStore);
  protected readonly vendorStore = inject(VendorStore);

  isSubmitting = signal(false);

  form = this.fb.group({
    description: [this.data.description || '', [Validators.required, Validators.maxLength(5000)]],
    categoryId: [this.data.categoryId || ''],
    status: ['Reported'],
    vendorId: [''],
  });

  ngOnInit(): void {
    this.expenseStore.loadCategories();
    this.vendorStore.loadVendors();
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const createRequest: CreateWorkOrderRequest = {
      propertyId: this.data.propertyId,
      description: this.form.value.description!,
      categoryId: this.form.value.categoryId || undefined,
      status: this.form.value.status || 'Reported',
      vendorId: this.form.value.vendorId || undefined,
    };

    let createdWorkOrderId: string;

    this.workOrderService.createWorkOrder(createRequest).pipe(
      switchMap((response) => {
        createdWorkOrderId = response.id;
        return this.expenseService.getExpense(this.data.expenseId);
      }),
      switchMap((expense) => {
        const updateRequest: UpdateExpenseRequest = {
          amount: expense.amount,
          date: expense.date,
          categoryId: expense.categoryId,
          description: expense.description,
          workOrderId: createdWorkOrderId,
        };
        return this.expenseService.updateExpense(this.data.expenseId, updateRequest);
      }),
      catchError(() => {
        if (!createdWorkOrderId) {
          // WO creation failed — dialog stays open for retry (AC #6)
          this.isSubmitting.set(false);
          this.snackBar.open('Failed to create work order', 'Close', { duration: 3000 });
        } else {
          // WO created but linking failed (AC #6)
          this.isSubmitting.set(false);
          this.snackBar.open(
            'Work order created but linking failed. Link manually from the work order.',
            'Close',
            { duration: 5000 }
          );
          this.dialogRef.close({ workOrderId: createdWorkOrderId, expenseId: this.data.expenseId, linkFailed: true } as CreateWoFromExpenseDialogResult);
        }
        return EMPTY;
      }),
    ).subscribe({
      next: () => {
        this.snackBar.open('Work order created and linked', 'Close', { duration: 3000 });
        this.dialogRef.close({ workOrderId: createdWorkOrderId, expenseId: this.data.expenseId } as CreateWoFromExpenseDialogResult);
      },
    });
  }
}
