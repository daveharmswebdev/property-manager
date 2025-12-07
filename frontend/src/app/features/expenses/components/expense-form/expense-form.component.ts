import { Component, inject, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CategorySelectComponent } from '../category-select/category-select.component';
import { CreateExpenseRequest } from '../../services/expense.service';
import { ExpenseStore } from '../../stores/expense.store';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';

/**
 * ExpenseFormComponent (AC-3.1.1, AC-3.1.2, AC-3.1.3, AC-3.1.4, AC-3.1.5, AC-3.1.8)
 *
 * Form for creating expenses with:
 * - Amount (currency, 2 decimal places)
 * - Date (datepicker, defaults to today, no future dates)
 * - Category (dropdown)
 * - Description (optional, max 500 chars)
 * - Form clears after successful save
 */
@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    CategorySelectComponent,
    CurrencyInputDirective,
  ],
  template: `
    <mat-card class="expense-form-card">
      <mat-card-header>
        <mat-card-title>New Expense</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="expense-form">
          <div class="form-row">
            <!-- Amount Field (AC-3.1.2) -->
            <mat-form-field appearance="outline" class="amount-field">
              <mat-label>Amount</mat-label>
              <span matPrefix>$ </span>
              <input
                matInput
                appCurrencyInput
                formControlName="amount"
                placeholder="0.00"
              />
              @if (form.get('amount')?.hasError('required') && form.get('amount')?.touched) {
                <mat-error>Amount is required</mat-error>
              }
              @if (form.get('amount')?.hasError('min') && form.get('amount')?.touched) {
                <mat-error>Amount must be greater than $0</mat-error>
              }
              @if (form.get('amount')?.hasError('max') && form.get('amount')?.touched) {
                <mat-error>Amount exceeds maximum</mat-error>
              }
            </mat-form-field>

            <!-- Date Field (AC-3.1.3) -->
            <mat-form-field appearance="outline" class="date-field">
              <mat-label>Date</mat-label>
              <input
                matInput
                [matDatepicker]="picker"
                formControlName="date"
                [max]="today"
              />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
              @if (form.get('date')?.hasError('required') && form.get('date')?.touched) {
                <mat-error>Date is required</mat-error>
              }
            </mat-form-field>
          </div>

          <!-- Category Field (AC-3.1.4) -->
          <app-category-select
            [value]="form.get('categoryId')?.value"
            (categoryChange)="onCategoryChange($event)"
            [error]="getCategoryError()"
          />

          <!-- Description Field (AC-3.1.5) -->
          <mat-form-field appearance="outline" class="description-field">
            <mat-label>Description (optional)</mat-label>
            <textarea
              matInput
              formControlName="description"
              placeholder="e.g., Home Depot - Faucet repair"
              rows="2"
              maxlength="500"
            ></textarea>
            <mat-hint align="end">{{ form.get('description')?.value?.length || 0 }} / 500</mat-hint>
            @if (form.get('description')?.hasError('maxlength') && form.get('description')?.touched) {
              <mat-error>Description must be 500 characters or less</mat-error>
            }
          </mat-form-field>

          <!-- Submit Button -->
          <div class="form-actions">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="!form.valid || store.isSaving()"
            >
              @if (store.isSaving()) {
                <mat-spinner diameter="20" />
              } @else {
                <ng-container>
                  <mat-icon>add</mat-icon>
                  Save Expense
                </ng-container>
              }
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .expense-form-card {
      margin-bottom: 24px;
    }

    .expense-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .amount-field {
      flex: 1;

      // Fix: Add padding before $ prefix so it doesn't touch the border
      ::ng-deep .mat-mdc-form-field-infix {
        padding-left: 0;
      }

      ::ng-deep [matPrefix] {
        padding-left: 12px;
      }
    }

    .date-field {
      flex: 1;
    }

    .description-field {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }

    .form-actions button {
      min-width: 140px;

      // Fix: Align icon and text vertically in button
      mat-icon {
        vertical-align: middle;
        margin-right: 4px;
      }
    }

    mat-spinner {
      display: inline-block;
    }

    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .amount-field,
      .date-field {
        width: 100%;
      }
    }
  `],
})
export class ExpenseFormComponent implements OnInit {
  protected readonly store = inject(ExpenseStore);
  private readonly fb = inject(FormBuilder);

  // Input: Property ID
  propertyId = input.required<string>();

  // Output: Expense created event
  expenseCreated = output<void>();

  protected readonly today = new Date();

  protected form: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [this.today, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    // Load categories if not already loaded
    this.store.loadCategories();
  }

  protected onCategoryChange(categoryId: string): void {
    this.form.patchValue({ categoryId });
    this.form.get('categoryId')?.markAsTouched();
  }

  protected getCategoryError(): string | null {
    const control = this.form.get('categoryId');
    if (control?.hasError('required') && control?.touched) {
      return 'Category is required';
    }
    return null;
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, date, categoryId, description } = this.form.value;

    // Format date as ISO string (YYYY-MM-DD)
    const formattedDate = this.formatDate(date);

    const request: CreateExpenseRequest = {
      propertyId: this.propertyId(),
      amount,
      date: formattedDate,
      categoryId,
      description: description?.trim() || undefined,
    };

    // Create expense via store
    this.store.createExpense(request);

    // Reset form after submission (AC-3.1.8)
    // The store handles success/error snackbar
    this.resetForm();
    this.expenseCreated.emit();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resetForm(): void {
    this.form.reset({
      amount: null,
      date: this.today,
      categoryId: '',
      description: '',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
  }
}
