import {
  Component,
  inject,
  input,
  output,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormGroupDirective,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiClient } from '../../../../core/api/api.service';
import { CategorySelectComponent } from '../../../expenses/components/category-select/category-select.component';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';
import { PropertyStore } from '../../../properties/stores/property.store';

/**
 * ReceiptExpenseFormComponent (AC-5.4.3, AC-5.4.4)
 *
 * Form for creating an expense from a receipt with:
 * - Property dropdown (pre-selected if receipt has propertyId)
 * - Amount (currency, 2 decimal places)
 * - Date (defaults to receipt's createdAt date)
 * - Category dropdown
 * - Description (optional, max 500 chars)
 */
@Component({
  selector: 'app-receipt-expense-form',
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
    MatSelectModule,
    CategorySelectComponent,
    CurrencyInputDirective,
  ],
  template: `
    <div class="receipt-expense-form" data-testid="receipt-expense-form">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Property Dropdown (AC-5.4.3) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Property</mat-label>
          <mat-select formControlName="propertyId" data-testid="property-select">
            @for (property of propertyStore.properties(); track property.id) {
              <mat-option [value]="property.id">
                {{ property.name }}
              </mat-option>
            }
          </mat-select>
          @if (form.get('propertyId')?.hasError('required') && form.get('propertyId')?.touched) {
            <mat-error>Property is required</mat-error>
          }
        </mat-form-field>

        <div class="form-row">
          <!-- Amount Field -->
          <mat-form-field appearance="outline" class="amount-field">
            <mat-label>Amount</mat-label>
            <span matPrefix>$ </span>
            <input
              matInput
              appCurrencyInput
              formControlName="amount"
              placeholder="0.00"
              data-testid="amount-input"
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

          <!-- Date Field (defaults to receipt date) -->
          <mat-form-field appearance="outline" class="date-field">
            <mat-label>Date</mat-label>
            <input
              matInput
              [matDatepicker]="picker"
              formControlName="date"
              [max]="today"
              data-testid="date-input"
            />
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-datepicker #picker />
            @if (form.get('date')?.hasError('required') && form.get('date')?.touched) {
              <mat-error>Date is required</mat-error>
            }
          </mat-form-field>
        </div>

        <!-- Category Field -->
        <app-category-select
          [value]="form.get('categoryId')?.value"
          (categoryChange)="onCategoryChange($event)"
          [error]="getCategoryError()"
        />

        <!-- Description Field -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="e.g., Home Depot - Faucet repair"
            rows="2"
            maxlength="500"
            data-testid="description-input"
          ></textarea>
          <mat-hint align="end"
            >{{ form.get('description')?.value?.length || 0 }} / 500</mat-hint
          >
          @if (form.get('description')?.hasError('maxlength') && form.get('description')?.touched) {
            <mat-error>Description must be 500 characters or less</mat-error>
          }
        </mat-form-field>

        <!-- Form Actions -->
        <div class="form-actions">
          <button
            mat-stroked-button
            type="button"
            (click)="onCancel()"
            [disabled]="isSaving()"
            data-testid="cancel-btn"
          >
            Cancel
          </button>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="!form.valid || isSaving()"
            data-testid="save-btn"
          >
            @if (isSaving()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <ng-container>
                <mat-icon>save</mat-icon>
                Save Expense
              </ng-container>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .receipt-expense-form {
        padding: 16px;
      }

      .form-row {
        display: flex;
        gap: 16px;
      }

      .amount-field {
        flex: 1;

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

      .full-width {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
      }

      .form-actions button {
        min-width: 120px;

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
    `,
  ],
})
export class ReceiptExpenseFormComponent implements OnInit {
  protected readonly expenseStore = inject(ExpenseStore);
  protected readonly propertyStore = inject(PropertyStore);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiClient);
  private readonly snackBar = inject(MatSnackBar);

  /** The receipt ID being processed */
  receiptId = input.required<string>();

  /** Pre-selected property ID if receipt was tagged */
  propertyId = input<string | undefined>();

  /** Default date from receipt's createdAt */
  defaultDate = input<Date>();

  /** Emitted when expense is successfully saved */
  saved = output<void>();

  /** Emitted when user cancels */
  cancelled = output<void>();

  protected readonly today = new Date();
  protected readonly isSaving = signal(false);

  protected form: FormGroup = this.fb.group({
    propertyId: ['', [Validators.required]],
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [this.today, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
  });

  @ViewChild(FormGroupDirective) private formDirective!: FormGroupDirective;

  ngOnInit(): void {
    // Load categories if not already loaded
    this.expenseStore.loadCategories();

    // Load properties if not already loaded
    this.propertyStore.loadProperties(undefined);

    // Pre-populate property if provided
    if (this.propertyId()) {
      this.form.patchValue({ propertyId: this.propertyId() });
    }

    // Pre-populate date from receipt's createdAt (AC-5.4.3)
    if (this.defaultDate()) {
      this.form.patchValue({ date: this.defaultDate() });
    }
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

    const { propertyId, amount, date, categoryId, description } = this.form.value;
    const formattedDate = this.formatDate(date);

    this.isSaving.set(true);

    // Call the process receipt endpoint using the generated API client
    this.api
      .receipts_ProcessReceipt(this.receiptId(), {
        propertyId,
        amount,
        date: formattedDate,
        categoryId,
        description: description?.trim(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Expense saved with receipt', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
          this.saved.emit();
        },
        error: (error) => {
          this.isSaving.set(false);
          let errorMessage = 'Failed to save expense. Please try again.';
          if (error.status === 404) {
            errorMessage = 'Receipt or property not found.';
          } else if (error.status === 409) {
            errorMessage = 'Receipt has already been processed.';
          } else if (error.status === 400) {
            errorMessage = 'Invalid expense data. Please check your input.';
          }

          this.snackBar.open(errorMessage, 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
          console.error('Error processing receipt:', error);
        },
      });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
