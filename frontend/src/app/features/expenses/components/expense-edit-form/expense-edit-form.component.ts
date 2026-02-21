import { Component, DestroyRef, inject, input, output, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategorySelectComponent } from '../category-select/category-select.component';
import { ExpenseDto, UpdateExpenseRequest } from '../../services/expense.service';
import { ExpenseStore } from '../../stores/expense.store';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';
import { ApiClient, ReceiptDto } from '../../../../core/api/api.service';
import {
  ReceiptLightboxDialogComponent,
  ReceiptLightboxDialogData,
} from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WorkOrderService, WorkOrderDto } from '../../../work-orders/services/work-order.service';
import { formatLocalDate } from '../../../../shared/utils/date.utils';

/**
 * ExpenseEditFormComponent (AC-3.2.1, AC-3.2.2, AC-3.2.3, AC-3.2.5)
 *
 * Inline edit form for expenses with:
 * - Pre-populated fields from existing expense
 * - Same validation as create form
 * - Save and Cancel buttons
 * - Replaces expense row when editing
 */
@Component({
  selector: 'app-expense-edit-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    CategorySelectComponent,
    CurrencyInputDirective,
  ],
  template: `
    <div class="expense-edit-form">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="edit-form">
        <div class="form-row">
          <!-- Amount Field (AC-3.2.1) -->
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

          <!-- Date Field (AC-3.2.1) -->
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

        <!-- Category Field (AC-3.2.1) -->
        <app-category-select
          [value]="form.get('categoryId')?.value"
          (categoryChange)="onCategoryChange($event)"
          [error]="getCategoryError()"
        />

        <!-- Description Field (AC-3.2.1) -->
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

        <!-- Work Order Link (optional) (AC-11.2.2, AC-11.2.3, AC-11.2.5) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Work Order (optional)</mat-label>
          <mat-select formControlName="workOrderId" data-testid="work-order-select">
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
        </mat-form-field>

        <!-- Receipt Section (AC-5.5.4, AC-5.5.5) -->
        @if (expense().receiptId) {
          <div class="receipt-section" data-testid="receipt-section">
            <div class="receipt-label">Attached Receipt</div>
            <div class="receipt-content">
              @if (receiptLoading()) {
                <div class="receipt-loading">
                  <mat-spinner diameter="24"></mat-spinner>
                </div>
              } @else if (receipt()) {
                <button
                  type="button"
                  class="receipt-thumbnail"
                  (click)="viewReceipt()"
                  matTooltip="Click to view full size"
                  data-testid="receipt-thumbnail"
                >
                  @if (isPdf()) {
                    <mat-icon class="pdf-icon">description</mat-icon>
                  } @else {
                    <img [src]="receipt()!.viewUrl" alt="Receipt thumbnail" />
                  }
                </button>
              }
              <button
                mat-stroked-button
                color="warn"
                type="button"
                class="unlink-btn"
                (click)="onUnlinkReceipt()"
                [disabled]="isUnlinking()"
                data-testid="unlink-receipt-btn"
              >
                @if (isUnlinking()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <ng-container>
                    <mat-icon>link_off</mat-icon>
                    Unlink Receipt
                  </ng-container>
                }
              </button>
            </div>
          </div>
        }

        <!-- Action Buttons (AC-3.2.3, AC-3.2.5) -->
        <div class="form-actions">
          <button
            mat-button
            type="button"
            (click)="onCancel()"
            [disabled]="store.isUpdating()"
          >
            Cancel
          </button>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="!form.valid || store.isUpdating()"
          >
            @if (store.isUpdating()) {
              <mat-spinner diameter="20" />
            } @else {
              <ng-container>
                <mat-icon>save</mat-icon>
                Save Changes
              </ng-container>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .expense-edit-form {
      padding: 16px;
      background-color: var(--mat-sys-surface-container-low);
      border-radius: 8px;
      margin: 8px 0;
      border: 1px solid var(--mat-sys-outline-variant);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
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

    .description-field,
    .full-width {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 8px;
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

    .receipt-section {
      padding: 12px;
      background-color: var(--mat-sys-surface-container);
      border-radius: 8px;
      margin-top: 8px;
    }

    .receipt-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 12px;
    }

    .receipt-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .receipt-loading {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .receipt-thumbnail {
      width: 64px;
      height: 64px;
      border-radius: 4px;
      overflow: hidden;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      padding: 0;
      transition: box-shadow 0.2s ease;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pdf-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #666;
      }
    }

    .unlink-btn {
      mat-icon {
        margin-right: 4px;
        vertical-align: middle;
      }
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

      .form-actions {
        flex-direction: column-reverse;
      }

      .form-actions button {
        width: 100%;
      }

      .receipt-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .unlink-btn {
        width: 100%;
      }
    }
  `],
})
export class ExpenseEditFormComponent implements OnInit, OnChanges {
  protected readonly store = inject(ExpenseStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = inject(ApiClient);
  private readonly workOrderService = inject(WorkOrderService);
  private readonly destroyRef = inject(DestroyRef);

  // Input: Expense to edit (AC-3.2.2)
  expense = input.required<ExpenseDto>();

  // Output: Edit cancelled
  cancelled = output<void>();

  // Output: Edit saved
  saved = output<void>();

  // Output: Receipt unlinked (AC-5.5.5)
  receiptUnlinked = output<void>();

  protected readonly today = new Date();

  // Receipt state (AC-5.5.4, AC-5.5.5)
  protected receipt = signal<ReceiptDto | null>(null);
  protected receiptLoading = signal(false);
  protected isUnlinking = signal(false);

  // Work order dropdown state (AC-11.2.2, AC-11.2.3)
  protected readonly workOrders = signal<WorkOrderDto[]>([]);
  protected readonly isLoadingWorkOrders = signal(false);

  protected form: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [null, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
    workOrderId: [''], // AC-11.2.2 - optional
  });

  /** Check if the receipt is a PDF (AC-5.5.4) */
  protected isPdf(): boolean {
    const r = this.receipt();
    return r?.contentType === 'application/pdf';
  }

  ngOnInit(): void {
    this.populateForm();
    this.loadReceipt();
    this.loadWorkOrders(); // AC-11.2.2, AC-11.2.3
  }

  /**
   * Load work orders for the expense's property (AC-11.2.3)
   */
  private loadWorkOrders(): void {
    this.isLoadingWorkOrders.set(true);
    this.workOrderService.getWorkOrdersByProperty(this.expense().propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workOrders.set(response.items);
          this.isLoadingWorkOrders.set(false);
        },
        error: (error) => {
          console.error('Error loading work orders:', error);
          this.isLoadingWorkOrders.set(false);
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expense'] && !changes['expense'].firstChange) {
      this.populateForm();
    }
  }

  /**
   * Populate form with expense data (AC-3.2.2)
   */
  private populateForm(): void {
    const exp = this.expense();
    if (!exp) return;

    // Parse the date string to Date object
    const dateValue = this.parseDate(exp.date);

    this.form.patchValue({
      amount: exp.amount,
      date: dateValue,
      categoryId: exp.categoryId,
      description: exp.description || '',
      workOrderId: exp.workOrderId || '', // AC-11.2.2
    });
  }

  private parseDate(dateString: string): Date {
    // Handle ISO date string (YYYY-MM-DD)
    const parts = dateString.split('T')[0].split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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

  protected onCancel(): void {
    this.store.cancelEditing();
    this.cancelled.emit();
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, date, categoryId, description, workOrderId } = this.form.value;

    // Format date as ISO string (YYYY-MM-DD)
    const formattedDate = this.formatDate(date);

    const request: UpdateExpenseRequest = {
      amount,
      date: formattedDate,
      categoryId,
      description: description?.trim() || undefined,
      workOrderId: workOrderId || undefined, // AC-11.2.5
    };

    // Update expense via store (AC-3.2.3)
    this.store.updateExpense({ expenseId: this.expense().id, request });
    this.saved.emit();
  }

  private formatDate(date: Date): string {
    return formatLocalDate(date);
  }

  /**
   * Load receipt details if expense has a receiptId (AC-5.5.4)
   */
  private loadReceipt(): void {
    const receiptId = this.expense().receiptId;
    if (!receiptId) return;

    this.receiptLoading.set(true);
    this.api.receipts_GetReceipt(receiptId).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.receiptLoading.set(false);
      },
      error: () => {
        this.receiptLoading.set(false);
        // Silently fail - just don't show the thumbnail
      },
    });
  }

  /**
   * Open receipt in lightbox dialog (AC-5.5.4)
   */
  protected viewReceipt(): void {
    const receiptId = this.expense().receiptId;
    if (!receiptId) return;

    this.dialog.open<ReceiptLightboxDialogComponent, ReceiptLightboxDialogData>(
      ReceiptLightboxDialogComponent,
      {
        data: { receiptId },
        width: '90vw',
        maxWidth: '1400px',
        height: '90vh',
        panelClass: 'receipt-lightbox-panel',
      }
    );
  }

  /**
   * Unlink receipt from expense with confirmation (AC-5.5.5)
   */
  protected onUnlinkReceipt(): void {
    const dialogData: ConfirmDialogData = {
      title: 'Unlink Receipt',
      message: 'Are you sure you want to unlink this receipt from the expense? The receipt will return to the unprocessed queue.',
      confirmText: 'Unlink',
      cancelText: 'Cancel',
      icon: 'link_off',
      iconColor: 'warn',
      confirmIcon: 'link_off',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data: dialogData })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.unlinkReceipt();
        }
      });
  }

  private unlinkReceipt(): void {
    const expenseId = this.expense().id;
    this.isUnlinking.set(true);

    this.api.expenses_UnlinkReceipt(expenseId).subscribe({
      next: () => {
        this.isUnlinking.set(false);
        this.receipt.set(null);
        this.snackBar.open('Receipt unlinked', 'Close', { duration: 3000 });
        this.receiptUnlinked.emit();
      },
      error: () => {
        this.isUnlinking.set(false);
        this.snackBar.open('Failed to unlink receipt', 'Close', { duration: 3000 });
      },
    });
  }
}
