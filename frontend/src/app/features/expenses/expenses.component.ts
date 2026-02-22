import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseListStore, FilterChip, DateRangePreset } from './stores/expense-list.store';
import { ExpenseFiltersComponent } from './components/expense-filters/expense-filters.component';
import { ListTotalDisplayComponent } from '../../shared/components/list-total-display/list-total-display.component';
import { ExpenseListRowComponent } from './components/expense-list-row/expense-list-row.component';
import { ExpenseListItemDto } from './services/expense.service';
import {
  CreateWoFromExpenseDialogComponent,
  CreateWoFromExpenseDialogData,
  CreateWoFromExpenseDialogResult,
} from '../work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component';
import {
  PropertyPickerDialogComponent,
  PropertyPickerDialogData,
} from './components/property-picker-dialog/property-picker-dialog.component';
import { PropertyStore } from '../properties/stores/property.store';
import { PropertyService } from '../properties/services/property.service';

/**
 * ExpensesComponent (AC-3.4.1, AC-3.4.7, AC-3.4.8)
 *
 * Main expense list page displaying all expenses across all properties with:
 * - Filters (date range, categories, search)
 * - Paginated expense list
 * - Empty states (filtered vs truly empty)
 */
@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    ExpenseFiltersComponent,
    ExpenseListRowComponent,
    ListTotalDisplayComponent,
  ],
  template: `
    <div class="expenses-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-content">
          <div>
            <h1>Expenses</h1>
            <p class="subtitle">View and filter all expenses across your properties</p>
          </div>
          <button mat-stroked-button color="primary" (click)="onAddExpense()">
            <mat-icon>add</mat-icon>
            <span class="button-text">Add Expense</span>
          </button>
        </div>
      </div>

      <!-- Filters (AC-3.4.3, AC-3.4.4, AC-3.4.5, AC-3.4.6) -->
      <app-expense-filters
        [categories]="store.categories()"
        [dateRangePreset]="store.dateRangePreset()"
        [dateFrom]="store.dateFrom()"
        [dateTo]="store.dateTo()"
        [selectedCategoryIds]="store.selectedCategoryIds()"
        [searchText]="store.searchText()"
        [filterChips]="store.filterChips()"
        (dateRangePresetChange)="onDateRangePresetChange($event)"
        (customDateRangeChange)="onCustomDateRangeChange($event)"
        (categoryChange)="onCategoryChange($event)"
        (searchChange)="onSearchChange($event)"
        (chipRemove)="onChipRemove($event)"
        (clearAll)="onClearAllFilters()"
      />

      <!-- Total Expenses Display (AC2) -->
      @if (!store.isLoading() && store.totalCount() > 0) {
        <app-list-total-display
          label="Total Expenses"
          [amount]="store.totalAmount()"
          [showBorder]="true"
        />
      }

      <!-- Loading State -->
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading expenses...</p>
        </div>
      }

      <!-- Error State -->
      @if (store.error()) {
        <mat-card class="error-card">
          <mat-icon color="warn">error_outline</mat-icon>
          <p>{{ store.error() }}</p>
          <button mat-stroked-button color="primary" (click)="store.initialize()">
            Try Again
          </button>
        </mat-card>
      }

      <!-- Expense List -->
      @if (!store.isLoading() && !store.error()) {
        <!-- Truly Empty State (AC-3.4.7) -->
        @if (store.isTrulyEmpty()) {
          <mat-card class="empty-state-card">
            <mat-icon class="empty-icon">receipt_long</mat-icon>
            <h2>No expenses recorded yet</h2>
            <p>Start by adding expenses to your properties.</p>
            <p class="hint">Go to a property's expense workspace to add expenses.</p>
          </mat-card>
        }

        <!-- Filtered Empty State (AC-3.4.7) -->
        @if (store.isFilteredEmpty()) {
          <mat-card class="empty-state-card">
            <mat-icon class="empty-icon">search_off</mat-icon>
            <h2>No expenses match your filters</h2>
            <p>Try adjusting your search criteria or clearing filters.</p>
            <button mat-stroked-button color="primary" (click)="onClearAllFilters()">
              Clear filters
            </button>
          </mat-card>
        }

        <!-- Expense List with Pagination -->
        @if (store.hasExpenses()) {
          <mat-card class="expense-list-card">
            <!-- List Header -->
            <div class="list-header">
              @for (col of sortColumns; track col.key) {
                <button class="sort-header header-{{col.key}}" [class.active]="store.sortBy() === col.key" (click)="store.setSort(col.key)">
                  {{ col.label }}
                  @if (store.sortBy() === col.key) {
                    <mat-icon class="sort-icon">{{ store.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  }
                </button>
              }
              <div class="header-receipt"></div>
              <div class="header-work-order"></div>
              <button class="sort-header header-amount" [class.active]="store.sortBy() === 'amount'" (click)="store.setSort('amount')">
                Amount
                @if (store.sortBy() === 'amount') {
                  <mat-icon class="sort-icon">{{ store.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                }
              </button>
            </div>

            <!-- Expense Rows -->
            @for (expense of store.expenses(); track expense.id) {
              <app-expense-list-row
                [expense]="expense"
                (createWorkOrder)="onCreateWorkOrder($event)"
              />
            }

            <!-- Pagination (AC-3.4.8) -->
            <div class="pagination-container">
              <span class="pagination-info">{{ store.totalDisplay() }}</span>
              <mat-paginator
                [length]="store.totalCount()"
                [pageSize]="store.pageSize()"
                [pageIndex]="store.page() - 1"
                [pageSizeOptions]="[25, 50, 100]"
                (page)="onPageChange($event)"
                showFirstLastButtons
              >
              </mat-paginator>
            </div>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .expenses-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .page-header {
      margin-bottom: 24px;

      .page-header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      h1 {
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
      }

      .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
      gap: 16px;

      p {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .error-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      text-align: center;
      gap: 16px;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .empty-state-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      text-align: center;

      .empty-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-primary);
        margin-bottom: 16px;
      }

      h2 {
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
      }

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      .hint {
        font-size: 0.9em;
        margin-top: 8px;
        opacity: 0.8;
      }

      button {
        margin-top: 24px;
      }
    }

    .expense-list-card {
      overflow: hidden;
    }

    .list-header {
      display: grid;
      grid-template-columns: 100px 150px 1fr auto 40px 40px 100px;
      gap: 16px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container);
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      font-weight: 500;
      font-size: 0.85em;
      color: var(--mat-sys-on-surface-variant);
    }

    .sort-header {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font-weight: 500;
      font-size: inherit;
      color: inherit;
      font-family: inherit;

      &:hover {
        color: var(--mat-sys-primary);
      }

      &.active {
        color: var(--mat-sys-primary);
      }

      .sort-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .header-amount {
      text-align: right;
      justify-content: flex-end;
    }

    .pagination-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
    }

    .pagination-info {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 768px) {
      .expenses-container {
        padding: 16px;
      }

      .list-header {
        display: none;
      }

      .pagination-container {
        flex-direction: column;
        gap: 8px;
      }
    }
  `],
})
export class ExpensesComponent implements OnInit {
  readonly store = inject(ExpenseListStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly propertyStore = inject(PropertyStore);
  private readonly propertyService = inject(PropertyService);
  private readonly snackBar = inject(MatSnackBar);

  readonly sortColumns = [
    { key: 'date', label: 'Date' },
    { key: 'property', label: 'Property' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
  ];

  ngOnInit(): void {
    // Initialize store - load categories and expenses
    this.store.initialize();
    // Load properties for "Add Expense" button routing (single vs multi-property)
    this.propertyStore.loadProperties(undefined);
  }

  onDateRangePresetChange(preset: DateRangePreset): void {
    this.store.setDateRangePreset(preset);
  }

  onCustomDateRangeChange(range: { dateFrom: string; dateTo: string }): void {
    this.store.setCustomDateRange(range.dateFrom, range.dateTo);
  }

  onCategoryChange(categoryIds: string[]): void {
    this.store.setCategories(categoryIds);
  }

  onSearchChange(search: string): void {
    this.store.setSearch(search);
  }

  onChipRemove(chip: FilterChip): void {
    this.store.removeFilterChip(chip);
  }

  onClearAllFilters(): void {
    this.store.clearFilters();
  }

  async onAddExpense(): Promise<void> {
    let properties = this.propertyStore.properties();
    if (properties.length === 0) {
      try {
        const response = await firstValueFrom(this.propertyService.getProperties());
        properties = response.items;
      } catch {
        this.snackBar.open('Failed to load properties. Please try again.', 'Dismiss', { duration: 5000 });
        return;
      }
    }
    if (properties.length === 0) {
      this.snackBar.open('Create a property first before adding expenses.', 'Dismiss', { duration: 5000 });
      return;
    }
    if (properties.length === 1) {
      this.router.navigate(['/properties', properties[0].id, 'expenses']);
    } else {
      const dialogRef = this.dialog.open(PropertyPickerDialogComponent, {
        width: '400px',
        data: {
          properties: properties.map((p) => ({ id: p.id, name: p.name })),
        } as PropertyPickerDialogData,
      });
      dialogRef.afterClosed().subscribe((propertyId: string | undefined) => {
        if (propertyId) {
          this.router.navigate(['/properties', propertyId, 'expenses']);
        }
      });
    }
  }

  onPageChange(event: PageEvent): void {
    if (event.pageSize !== this.store.pageSize()) {
      this.store.setPageSize(event.pageSize);
    } else {
      // PageEvent uses 0-based index, our API uses 1-based
      this.store.goToPage(event.pageIndex + 1);
    }
  }

  /**
   * Handle create work order from expense in all-expenses list (AC-11.6.7)
   */
  protected onCreateWorkOrder(expense: ExpenseListItemDto): void {
    const dialogRef = this.dialog.open(CreateWoFromExpenseDialogComponent, {
      width: '500px',
      data: {
        expenseId: expense.id,
        propertyId: expense.propertyId,
        propertyName: expense.propertyName,
        description: expense.description,
        categoryId: expense.categoryId,
      } as CreateWoFromExpenseDialogData,
    });

    dialogRef.afterClosed().subscribe((result: CreateWoFromExpenseDialogResult | undefined) => {
      if (result) {
        this.store.initialize();
      }
    });
  }
}
