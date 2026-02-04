import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseStore } from '../stores/expense.store';
import { ExpenseFormComponent } from '../components/expense-form/expense-form.component';
import { ExpenseRowComponent } from '../components/expense-row/expense-row.component';
import { ExpenseEditFormComponent } from '../components/expense-edit-form/expense-edit-form.component';
import { PropertyService, PropertyDetailDto } from '../../properties/services/property.service';
import { WorkOrderService, WorkOrderDto } from '../../work-orders/services/work-order.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { formatDateShort } from '../../../shared/utils/date.utils';

/**
 * ExpenseWorkspaceComponent (AC-3.1.1, AC-3.1.6, AC-3.1.7, AC-3.2, AC-3.3)
 *
 * Main workspace for expense management:
 * - Property name header for context
 * - New expense form at top
 * - Previous expenses list below
 * - YTD total
 * - Inline editing support (AC-3.2)
 * - Modal delete confirmation support (AC-3.3)
 */
@Component({
  selector: 'app-expense-workspace',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatPaginatorModule,
    CurrencyPipe,
    ExpenseFormComponent,
    ExpenseRowComponent,
    ExpenseEditFormComponent,
  ],
  template: `
    <div class="expense-workspace">
      <!-- Header with Property Context -->
      <header class="workspace-header">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-content">
          <h1>{{ propertyName() }}</h1>
          <p class="header-subtitle">Add and manage expenses</p>
        </div>
      </header>

      @if (isLoadingProperty()) {
        <div class="loading-container">
          <mat-spinner diameter="40" />
          <p>Loading property...</p>
        </div>
      } @else if (propertyError()) {
        <mat-card class="error-card">
          <mat-card-content>
            <mat-icon>error_outline</mat-icon>
            <p>{{ propertyError() }}</p>
            <button mat-button color="primary" (click)="goBack()">Go Back</button>
          </mat-card-content>
        </mat-card>
      } @else {
        <!-- New Expense Form (hide when editing) -->
        @if (!store.isEditing()) {
          <app-expense-form
            [propertyId]="propertyId()"
            (expenseCreated)="onExpenseCreated()"
          />
        }

        <!-- Expenses List -->
        <mat-card class="expenses-list-card">
          <mat-card-header>
            <mat-card-title>Previous Expenses</mat-card-title>
            <div class="ytd-total">
              <span class="ytd-label">YTD Total:</span>
              <span class="ytd-amount">{{ store.ytdTotal() | currency }}</span>
            </div>
          </mat-card-header>
          <mat-card-content>
            @if (store.isLoading()) {
              <div class="loading-container">
                <mat-spinner diameter="32" />
                <p>Loading expenses...</p>
              </div>
            } @else if (store.isEmpty()) {
              <div class="empty-state">
                <mat-icon>receipt_long</mat-icon>
                <p>No expenses yet for this property.</p>
                <p class="empty-hint">Use the form above to add your first expense.</p>
              </div>
            } @else {
              <div class="expenses-list">
                @for (expense of store.expenses(); track expense.id) {
                  <!-- Show edit form for the expense being edited (AC-3.2.2) -->
                  @if (store.editingExpenseId() === expense.id) {
                    <app-expense-edit-form
                      [expense]="expense"
                      (cancelled)="onEditCancelled()"
                      (saved)="onEditSaved()"
                    />
                  } @else {
                    <!-- Show normal row with edit and delete buttons (AC-3.2.1, AC-3.3.1) -->
                    <app-expense-row
                      [expense]="expense"
                      [workOrder]="workOrderMap()[expense.workOrderId ?? '']"
                      (edit)="onEditExpense($event)"
                      (delete)="onDeleteExpense($event)"
                    />
                  }
                }
              </div>

              <!-- Pagination (AC-7.5.1, AC-7.5.2, AC-7.5.3) -->
              @if (store.totalCount() > 10) {
                <div class="pagination-container">
                  <div class="pagination-info">
                    Showing {{ paginationStart() }}-{{ paginationEnd() }} of {{ store.totalCount() }} expenses
                  </div>
                  <mat-paginator
                    [length]="store.totalCount()"
                    [pageSize]="store.pageSize()"
                    [pageIndex]="store.page() - 1"
                    [pageSizeOptions]="[10, 25, 50]"
                    [showFirstLastButtons]="true"
                    (page)="onPageChange($event)"
                    aria-label="Select page of expenses"
                  />
                </div>
              }
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .expense-workspace {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
    }

    .workspace-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .back-button {
      flex-shrink: 0;
    }

    .header-content h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .header-subtitle {
      margin: 4px 0 0 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .error-card {
      text-align: center;
      padding: 24px;
    }

    .error-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-error);
      margin-bottom: 16px;
    }

    .expenses-list-card {
      margin-top: 24px;
    }

    .expenses-list-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;

      // Override mat-card-header internal structure to allow proper flex layout
      ::ng-deep .mat-mdc-card-header-text {
        flex: 1;
      }
    }

    .ytd-total {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ytd-label {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
    }

    .ytd-amount {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--mat-sys-primary);
    }

    .expenses-list {
      // Removed negative margin that was causing overlap with header
      margin: 0 -16px -16px -16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-hint {
      font-size: 0.9rem;
      margin-top: 8px;
    }

    /* Pagination styles (AC-7.5.1) */
    .pagination-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      margin-top: 8px;
    }

    .pagination-info {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 8px;
    }
  `],
})
export class ExpenseWorkspaceComponent implements OnInit {
  protected readonly store = inject(ExpenseStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly propertyService = inject(PropertyService);
  private readonly dialog = inject(MatDialog);
  private readonly workOrderService = inject(WorkOrderService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly propertyId = signal<string>('');
  protected readonly propertyName = signal<string>('');
  protected readonly isLoadingProperty = signal(true);
  protected readonly propertyError = signal<string | null>(null);
  protected readonly workOrderMap = signal<Record<string, WorkOrderDto>>({});

  /**
   * Computed: First item number on current page (AC-7.5.3)
   */
  protected readonly paginationStart = computed(() => {
    const page = this.store.page();
    const pageSize = this.store.pageSize();
    const totalCount = this.store.totalCount();
    if (totalCount === 0) return 0;
    return (page - 1) * pageSize + 1;
  });

  /**
   * Computed: Last item number on current page (AC-7.5.3)
   */
  protected readonly paginationEnd = computed(() => {
    const page = this.store.page();
    const pageSize = this.store.pageSize();
    const totalCount = this.store.totalCount();
    return Math.min(page * pageSize, totalCount);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.propertyError.set('Property ID is required');
      this.isLoadingProperty.set(false);
      return;
    }

    this.propertyId.set(id);
    this.loadProperty(id);
  }

  private loadProperty(propertyId: string): void {
    this.isLoadingProperty.set(true);
    this.propertyError.set(null);

    this.propertyService.getPropertyById(propertyId).subscribe({
      next: (property: PropertyDetailDto) => {
        this.propertyName.set(property.name);
        this.isLoadingProperty.set(false);

        // Load expenses for this property
        this.store.loadExpensesByProperty({
          propertyId,
          propertyName: property.name,
        });

        // Load categories if not already loaded
        this.store.loadCategories();

        // Load work orders for expense row context (AC-11.4.3)
        this.loadWorkOrders(propertyId);
      },
      error: (error) => {
        this.isLoadingProperty.set(false);
        if (error.status === 404) {
          this.propertyError.set('Property not found');
        } else {
          this.propertyError.set('Failed to load property. Please try again.');
        }
        console.error('Error loading property:', error);
      },
    });
  }

  protected onExpenseCreated(): void {
    // Form handles the snackbar and state update
    // This callback is for any additional actions needed
  }

  /**
   * Handle edit button click (AC-3.2.1)
   */
  protected onEditExpense(expenseId: string): void {
    this.store.startEditing(expenseId);
  }

  /**
   * Handle edit cancelled (AC-3.2.5)
   */
  protected onEditCancelled(): void {
    // Store handles the state reset
  }

  /**
   * Handle edit saved (AC-3.2.4)
   */
  protected onEditSaved(): void {
    // Store handles the update and snackbar
  }

  /**
   * Handle pagination change (AC-7.5.3)
   */
  protected onPageChange(event: PageEvent): void {
    // Check if page size changed
    if (event.pageSize !== this.store.pageSize()) {
      this.store.setPageSize(event.pageSize);
    } else {
      // Page changed (pageIndex is 0-based, our store uses 1-based)
      this.store.goToPage(event.pageIndex + 1);
    }
  }

  /**
   * Handle delete button click - show modal confirmation (AC-3.3.1)
   */
  protected onDeleteExpense(expenseId: string): void {
    const expense = this.store.expenses().find((e) => e.id === expenseId);
    if (!expense) return;

    const dialogData: ConfirmDialogData = {
      title: 'Delete Expense?',
      message: 'This expense will be removed from your records.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
      secondaryMessage: `${this.formatDate(expense.date)} • ${expense.description} • ${expense.categoryName} • ${this.formatCurrency(expense.amount)}`,
      confirmIcon: 'delete',
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '450px',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.store.deleteExpense(expenseId);
      }
    });
  }

  /**
   * Format date as "Nov 28, 2025"
   * Uses formatDateShort utility for correct timezone handling
   */
  private formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  /**
   * Format amount as currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  private loadWorkOrders(propertyId: string): void {
    this.workOrderService.getWorkOrdersByProperty(propertyId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => {
        const map: Record<string, WorkOrderDto> = {};
        response.items.forEach(wo => map[wo.id] = wo);
        this.workOrderMap.set(map);
      },
      error: () => {
        // Silent fail - expense rows fall back to generic icon behavior (AC-11.4.3)
        this.workOrderMap.set({});
      },
    });
  }

  protected goBack(): void {
    const propertyId = this.propertyId();
    if (propertyId) {
      this.router.navigate(['/properties', propertyId]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
