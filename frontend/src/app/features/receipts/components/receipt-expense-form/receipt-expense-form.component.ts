import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MatDialog } from '@angular/material/dialog';

import { ApiClient } from '../../../../core/api/api.service';
import { CategorySelectComponent } from '../../../expenses/components/category-select/category-select.component';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';
import { formatLocalDate } from '../../../../shared/utils/date.utils';
import { PropertyStore } from '../../../properties/stores/property.store';
import { ExpenseService } from '../../../expenses/services/expense.service';
import {
  DuplicateWarningDialogComponent,
  DuplicateWarningDialogData,
} from '../../../expenses/components/duplicate-warning-dialog/duplicate-warning-dialog.component';
import { WorkOrderService, WorkOrderDto } from '../../../work-orders/services/work-order.service';

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

        <!-- Work Order Dropdown (AC-11.8.1, AC-11.8.2, AC-11.8.3) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Work Order (optional)</mat-label>
          <mat-select formControlName="workOrderId"
            data-testid="work-order-select">
            @if (isLoadingWorkOrders()) {
              <mat-option disabled>Loading work orders...</mat-option>
            } @else {
              <mat-option value="">None</mat-option>
              @for (wo of workOrders(); track wo.id) {
                <mat-option [value]="wo.id">
                  {{ wo.description.length > 60 ? (wo.description | slice:0:60) + '...' : wo.description }}
                  ({{ wo.status }})
                </mat-option>
              }
            }
          </mat-select>
          @if (form.controls['workOrderId'].disabled) {
            <mat-hint>Select a property first</mat-hint>
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
            [disabled]="!form.valid || isSaving() || isCheckingDuplicate()"
            data-testid="save-btn"
          >
            @if (isSaving() || isCheckingDuplicate()) {
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
  private readonly dialog = inject(MatDialog);
  private readonly expenseService = inject(ExpenseService);
  private readonly workOrderService = inject(WorkOrderService);
  private readonly destroyRef = inject(DestroyRef);

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
  // Duplicate check loading state (AC-16.8.5)
  protected readonly isCheckingDuplicate = signal(false);

  // Work order dropdown state (AC-11.8.1, AC-11.8.2)
  protected readonly workOrders = signal<WorkOrderDto[]>([]);
  protected readonly isLoadingWorkOrders = signal(false);

  protected form: FormGroup = this.fb.group({
    propertyId: ['', [Validators.required]],
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [this.today, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
    workOrderId: [''], // AC-11.8.1 - optional, no validators
  });

  @ViewChild(FormGroupDirective) private formDirective!: FormGroupDirective;

  ngOnInit(): void {
    // Load categories if not already loaded
    this.expenseStore.loadCategories();

    // Load properties if not already loaded
    this.propertyStore.loadProperties(undefined);

    // Disable work order dropdown initially (AC-11.8.3)
    this.form.get('workOrderId')?.disable();

    // Pre-populate property if provided
    if (this.propertyId()) {
      this.form.patchValue({ propertyId: this.propertyId() });
      // Enable and load work orders for pre-selected property (AC-11.8.2)
      this.form.get('workOrderId')?.enable();
      this.loadWorkOrders(this.propertyId()!);
    }

    // Pre-populate date from receipt's createdAt (AC-5.4.3)
    if (this.defaultDate()) {
      this.form.patchValue({ date: this.defaultDate() });
    }

    // Watch property changes to reload work orders (AC-11.8.6)
    this.form.get('propertyId')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((propertyId: string) => {
        // Clear work order selection when property changes (AC-11.8.6)
        this.form.get('workOrderId')?.setValue('');
        if (propertyId) {
          this.form.get('workOrderId')?.enable();
          this.loadWorkOrders(propertyId);
        } else {
          this.form.get('workOrderId')?.disable();
          this.workOrders.set([]);
        }
      });
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

  /**
   * Load work orders for the selected property (AC-11.8.2)
   * Filters to active work orders only (Reported, Assigned)
   */
  private loadWorkOrders(propertyId: string): void {
    this.isLoadingWorkOrders.set(true);
    this.workOrderService.getWorkOrdersByProperty(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const active = response.items.filter(
            wo => wo.status === 'Reported' || wo.status === 'Assigned'
          );
          this.workOrders.set(active);
          this.isLoadingWorkOrders.set(false);
        },
        error: () => {
          this.workOrders.set([]);
          this.isLoadingWorkOrders.set(false);
        },
      });
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const { propertyId, amount, date, categoryId, description, workOrderId } = this.form.value;
    const formattedDate = this.formatDate(date);

    // AC-16.8.1, AC-16.8.5: Check for duplicate before processing
    this.isCheckingDuplicate.set(true);

    this.expenseService.checkDuplicateExpense(propertyId, amount, formattedDate)
      .subscribe({
        next: (result) => {
          this.isCheckingDuplicate.set(false);

          if (result.isDuplicate && result.existingExpense) {
            // AC-16.8.1: Duplicate found — show warning dialog
            this.showDuplicateWarning(result.existingExpense, {
              propertyId,
              amount,
              date: formattedDate,
              categoryId,
              description: description?.trim(),
              workOrderId: workOrderId || undefined,
            });
          } else {
            // AC-16.8.3: No duplicate — proceed directly
            this.processReceipt(propertyId, amount, formattedDate, categoryId, description, workOrderId);
          }
        },
        error: (error) => {
          // AC-16.8.4: Graceful degradation — log and proceed
          this.isCheckingDuplicate.set(false);
          console.error('Error checking for duplicate:', error);
          this.processReceipt(propertyId, amount, formattedDate, categoryId, description, workOrderId);
        },
      });
  }

  /**
   * Show duplicate warning dialog (AC-16.8.2)
   */
  private showDuplicateWarning(
    existingExpense: { id: string; date: string; amount: number; description?: string },
    pendingData: { propertyId: string; amount: number; date: string; categoryId: string; description?: string; workOrderId?: string }
  ): void {
    const dialogData: DuplicateWarningDialogData = {
      existingExpense: {
        id: existingExpense.id,
        date: existingExpense.date,
        amount: existingExpense.amount,
        description: existingExpense.description,
      },
    };

    const dialogRef = this.dialog.open(DuplicateWarningDialogComponent, {
      data: dialogData,
      width: '450px',
    });

    dialogRef.afterClosed().subscribe((saveAnyway: boolean) => {
      if (saveAnyway) {
        // AC-16.8.2: User clicked "Save Anyway" — proceed
        this.processReceipt(
          pendingData.propertyId,
          pendingData.amount,
          pendingData.date,
          pendingData.categoryId,
          pendingData.description,
          pendingData.workOrderId,
        );
      }
      // AC-16.8.2: User clicked "Cancel" — do nothing, receipt stays unprocessed
    });
  }

  /**
   * Process the receipt into an expense via API
   */
  private processReceipt(
    propertyId: string,
    amount: number,
    date: string,
    categoryId: string,
    description?: string,
    workOrderId?: string,
  ): void {
    this.isSaving.set(true);

    this.api
      .receipts_ProcessReceipt(this.receiptId(), {
        propertyId,
        amount,
        date,
        categoryId,
        description: description?.trim(),
        workOrderId: workOrderId || undefined, // AC-11.8.4, AC-11.8.5
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
    return formatLocalDate(date);
  }
}
