import { Component, computed, inject, OnInit, OnDestroy, signal, DestroyRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseDetailStore } from '../stores/expense-detail.store';
import { ExpenseStore } from '../stores/expense.store';
import { UpdateExpenseRequest } from '../services/expense.service';
import {
  PropertyService,
  PropertySummaryDto,
} from '../../properties/services/property.service';
import { CurrencyInputDirective } from '../../../shared/directives/currency-input.directive';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  ReceiptLightboxDialogComponent,
  ReceiptLightboxDialogData,
} from '../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';
import { formatDateShort, formatLocalDate } from '../../../shared/utils/date.utils';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    CurrencyPipe,
    CurrencyInputDirective,
  ],
  template: `
    <div class="expense-detail-container">
      <!-- Loading State -->
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading expense...</p>
        </div>
      }

      <!-- Error State -->
      @if (!store.isLoading() && store.error()) {
        <div class="error-container">
          <mat-icon>error_outline</mat-icon>
          <p>{{ store.error() }}</p>
          <a routerLink="/expenses">Back to Expenses</a>
        </div>
      }

      <!-- Expense Content -->
      @if (!store.isLoading() && store.expense() && !store.error()) {
        <!-- Header -->
        <header class="detail-header">
          <div class="header-content">
            <a routerLink="/expenses" class="back-link">
              <mat-icon>arrow_back</mat-icon>
              Back to Expenses
            </a>
          </div>
        </header>

        <!-- VIEW MODE -->
        @if (store.isViewMode()) {
          <div class="view-mode">
            <div class="action-bar">
              <button mat-stroked-button color="primary" (click)="onEdit()">
                <mat-icon>edit</mat-icon>
                Edit
              </button>
              <button
                mat-stroked-button
                color="warn"
                (click)="onDelete()"
                [disabled]="store.isDeleting()"
              >
                @if (store.isDeleting()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>delete</mat-icon>
                }
                Delete
              </button>
            </div>

            <mat-card class="detail-card">
              <mat-card-content>
                <div class="detail-grid">
                  <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value" data-testid="expense-amount">
                      {{ store.expense()!.amount | currency }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value" data-testid="expense-date">
                      {{ formatDate(store.expense()!.date) }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Category</span>
                    <span class="detail-value" data-testid="expense-category">
                      {{ store.expense()!.categoryName }}
                      @if (store.expense()!.scheduleELine) {
                        <span class="schedule-e-line">({{ store.expense()!.scheduleELine }})</span>
                      }
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value" data-testid="expense-description">
                      {{ store.expense()!.description || 'No description' }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Property</span>
                    <span class="detail-value" data-testid="expense-property">
                      {{ store.expense()!.propertyName }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value" data-testid="expense-created-date">
                      {{ formatDate(store.expense()!.createdAt) }}
                    </span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Receipt Section -->
            <mat-card class="section-card" data-testid="receipt-section">
              <mat-card-header>
                <mat-card-title>Receipt</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (store.hasReceipt()) {
                  <div class="receipt-actions">
                    <span data-testid="receipt-thumbnail">Receipt attached</span>
                    <button mat-stroked-button (click)="onViewReceipt()">
                      <mat-icon>visibility</mat-icon>
                      View Receipt
                    </button>
                    <button
                      mat-stroked-button
                      color="warn"
                      (click)="onUnlinkReceipt()"
                      [disabled]="store.isUnlinkingReceipt()"
                    >
                      @if (store.isUnlinkingReceipt()) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>link_off</mat-icon>
                      }
                      Unlink Receipt
                    </button>
                  </div>
                } @else {
                  <p class="empty-text">No receipt linked</p>
                }
              </mat-card-content>
            </mat-card>

            <!-- Work Order Section -->
            <mat-card class="section-card" data-testid="work-order-section">
              <mat-card-header>
                <mat-card-title>Work Order</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (store.hasWorkOrder()) {
                  <a
                    [routerLink]="['/work-orders', store.expense()!.workOrderId]"
                    data-testid="work-order-link"
                    class="work-order-link"
                  >
                    View Work Order
                  </a>
                } @else {
                  <p class="empty-text">No work order linked</p>
                }
              </mat-card-content>
            </mat-card>
          </div>
        }

        <!-- EDIT MODE -->
        @if (store.isEditing()) {
          <form [formGroup]="editForm" (ngSubmit)="onSubmit()" class="edit-form">
            <mat-card class="detail-card">
              <mat-card-content>
                <div class="form-fields">
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="amount-field">
                      <mat-label>Amount</mat-label>
                      <span matPrefix>$ </span>
                      <input
                        matInput
                        appCurrencyInput
                        formControlName="amount"
                        placeholder="0.00"
                      />
                      @if (editForm.get('amount')?.hasError('required') && editForm.get('amount')?.touched) {
                        <mat-error>Amount is required</mat-error>
                      }
                    </mat-form-field>

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
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Category</mat-label>
                    <mat-select formControlName="categoryId">
                      @for (cat of categories(); track cat.id) {
                        <mat-option [value]="cat.id">
                          {{ cat.name }}
                          @if (cat.scheduleELine) {
                            ({{ cat.scheduleELine }})
                          }
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description (optional)</mat-label>
                    <textarea
                      matInput
                      formControlName="description"
                      rows="3"
                      maxlength="500"
                    ></textarea>
                    <mat-hint align="end">{{ editForm.get('description')?.value?.length || 0 }} / 500</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Property</mat-label>
                    <mat-select formControlName="propertyId">
                      @for (prop of properties(); track prop.id) {
                        <mat-option [value]="prop.id">{{ prop.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </mat-card-content>
            </mat-card>

            <div class="form-actions">
              <button mat-button type="button" (click)="onCancel()">
                Cancel
              </button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!editForm.valid || store.isUpdating()"
              >
                @if (store.isUpdating()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Save
              </button>
            </div>
          </form>
        }
      }
    </div>
  `,
  styles: [`
    .expense-detail-container {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .error-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-error);
    }

    .detail-header {
      margin-bottom: 24px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .action-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    .detail-card {
      margin-bottom: 16px;
    }

    .detail-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .detail-row {
      display: flex;
      gap: 16px;
    }

    .detail-label {
      min-width: 100px;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .detail-value {
      color: var(--mat-sys-on-surface);
    }

    .schedule-e-line {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .section-card {
      margin-bottom: 16px;
    }

    mat-card-title {
      font-size: 16px !important;
      font-weight: 500;
    }

    .receipt-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      button mat-icon {
        margin-right: 4px;
      }
    }

    .work-order-link {
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }

    .empty-text {
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
      margin: 0;
    }

    /* Edit mode */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-fields {
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
      gap: 8px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    @media (max-width: 600px) {
      .expense-detail-container {
        padding: 16px;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .action-bar {
        flex-wrap: wrap;
      }
    }
  `],
})
export class ExpenseDetailComponent implements OnInit, OnDestroy {
  protected readonly store = inject(ExpenseDetailStore);
  private readonly expenseStore = inject(ExpenseStore);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = new Date();
  protected readonly categories = computed(() => this.expenseStore.sortedCategories());
  protected readonly properties = signal<PropertySummaryDto[]>([]);

  protected editForm: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [null, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
    propertyId: ['', [Validators.required]],
  });

  private expenseId: string | null = null;

  ngOnInit(): void {
    // Subscribe to route param changes so the component reloads on param-only navigation
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.expenseId) {
        this.expenseId = id;
        this.store.loadExpense(id);
      } else if (id && !this.expenseId) {
        this.expenseId = id;
        this.store.loadExpense(id);
      }
    });
    // Load categories (cached by ExpenseStore)
    this.expenseStore.loadCategories(undefined);
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  protected formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  protected onEdit(): void {
    this.store.startEditing();
    this.populateEditForm();
    this.loadProperties();
  }

  protected onCancel(): void {
    this.store.cancelEditing();
  }

  protected onSubmit(): void {
    if (!this.editForm.valid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { amount, date, categoryId, description, propertyId } = this.editForm.value;
    const formattedDate = this.formatDateForApi(date);

    const request: UpdateExpenseRequest = {
      amount,
      date: formattedDate,
      categoryId,
      description: description?.trim() || undefined,
      propertyId,
    };

    this.store.updateExpense({ expenseId: this.expenseId!, request });
  }

  protected onDelete(): void {
    const dialogData: ConfirmDialogData = {
      title: 'Delete Expense?',
      message: 'This expense will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data: dialogData, width: '400px', disableClose: true })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.store.deleteExpense(this.expenseId!);
        }
      });
  }

  protected onViewReceipt(): void {
    const receiptId = this.store.expense()?.receiptId;
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

  protected onUnlinkReceipt(): void {
    const dialogData: ConfirmDialogData = {
      title: 'Unlink Receipt?',
      message: 'The receipt will be removed from this expense and returned to the unprocessed queue.',
      confirmText: 'Unlink',
      cancelText: 'Cancel',
      icon: 'link_off',
      iconColor: 'warn',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data: dialogData, width: '400px', disableClose: true })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.store.unlinkReceipt(this.expenseId!);
        }
      });
  }

  private populateEditForm(): void {
    const expense = this.store.expense();
    if (!expense) return;

    const dateParts = expense.date.split('T')[0].split('-');
    const dateValue = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );

    this.editForm.patchValue({
      amount: expense.amount,
      date: dateValue,
      categoryId: expense.categoryId,
      description: expense.description || '',
      propertyId: expense.propertyId,
    });
  }

  private loadProperties(): void {
    this.propertyService.getProperties().subscribe({
      next: (response) => this.properties.set(response.items),
      error: () => {
        this.snackBar.open('Failed to load properties', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  private formatDateForApi(date: Date): string {
    return formatLocalDate(date);
  }
}
