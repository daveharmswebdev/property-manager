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
import {
  ExpenseService,
  CreateExpenseRequest,
} from '../../services/expense.service';
import { ExpenseStore } from '../../stores/expense.store';

/**
 * Data passed to the dialog (AC #2)
 */
export interface CreateExpenseFromWoDialogData {
  workOrderId: string;
  propertyId: string;
  propertyName: string;
  categoryId?: string;
  workOrderDescription: string;
}

/**
 * Result returned when dialog closes with a created expense (AC #3)
 */
export interface CreateExpenseFromWoDialogResult {
  created: boolean;
}

/**
 * CreateExpenseFromWoDialogComponent (Story 11.7 AC #2, #3, #4, #5, #6, #7)
 *
 * Dialog for creating an expense directly from a work order.
 * Pre-populates property and category from the work order.
 * Single API call — POST /api/v1/expenses with workOrderId set.
 */
@Component({
  selector: 'app-create-expense-from-wo-dialog',
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
    <h2 mat-dialog-title>Create Expense for Work Order</h2>
    <mat-dialog-content>
      <p class="property-label">Property: {{ data.propertyName }}</p>
      <p class="wo-context">Work Order: {{ data.workOrderDescription }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Amount</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" formControlName="amount" step="0.01" min="0.01">
          @if (form.controls.amount.hasError('required')) {
            <mat-error>Amount is required</mat-error>
          } @else if (form.controls.amount.hasError('min')) {
            <mat-error>Amount must be greater than 0</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="date">
          @if (form.controls.date.hasError('required')) {
            <mat-error>Date is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category</mat-label>
          <mat-select formControlName="categoryId">
            @for (cat of categories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.categoryId.hasError('required')) {
            <mat-error>Category is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
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
          Create
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    .property-label {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
    }
    .wo-context {
      font-size: 0.85em;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 16px;
      font-style: italic;
    }
    mat-dialog-content { min-width: 400px; }
    @media (max-width: 600px) {
      mat-dialog-content { min-width: unset; }
    }
  `],
})
export class CreateExpenseFromWoDialogComponent implements OnInit {
  protected readonly data: CreateExpenseFromWoDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CreateExpenseFromWoDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly expenseStore = inject(ExpenseStore);

  protected readonly categories = this.expenseStore.sortedCategories;
  isSubmitting = signal(false);

  form = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date: [new Date().toISOString().split('T')[0], [Validators.required]],
    categoryId: [this.data.categoryId || '', [Validators.required]],
    description: [''],
  });

  ngOnInit(): void {
    this.expenseStore.loadCategories();
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const createRequest: CreateExpenseRequest = {
      propertyId: this.data.propertyId,
      amount: this.form.value.amount!,
      date: this.form.value.date!,
      categoryId: this.form.value.categoryId!,
      description: this.form.value.description || undefined,
      workOrderId: this.data.workOrderId,
    };

    this.expenseService.createExpense(createRequest).subscribe({
      next: () => {
        this.snackBar.open('Expense created', 'Close', { duration: 3000 });
        this.dialogRef.close({ created: true } as CreateExpenseFromWoDialogResult);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Failed to create expense', 'Close', { duration: 3000 });
      },
    });
  }
}
