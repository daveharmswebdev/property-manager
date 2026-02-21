import { Component, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { IncomeListStore } from './stores/income-list.store';
import { IncomeService, IncomeDto } from './services/income.service';
import { PropertyStore } from '../properties/stores/property.store';
import { PropertyService } from '../properties/services/property.service';
import {
  PropertyPickerDialogComponent,
  PropertyPickerDialogData,
} from '../expenses/components/property-picker-dialog/property-picker-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { YearSelectorService } from '../../core/services/year-selector.service';
import { formatLocalDate, formatDateShort } from '../../shared/utils/date.utils';

/**
 * IncomeComponent (AC-4.3.1, AC-4.3.2, AC-4.3.3, AC-4.3.4, AC-4.3.5, AC-4.3.6)
 *
 * Main income list page displaying all income across all properties with:
 * - Navigation "Income" shows all income across all properties (AC-4.3.1)
 * - List displays required columns (AC-4.3.2)
 * - Date range filter (AC-4.3.3)
 * - Property filter (AC-4.3.4)
 * - Empty states (AC-4.3.5)
 * - Total reflects filtered results (AC-4.3.6)
 */
@Component({
  selector: 'app-income',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    MatTooltipModule,
    CurrencyPipe,
  ],
  template: `
    <div class="income-container">
      <!-- Page Header (AC-16.2.1) -->
      <div class="page-header">
        <div class="page-header-content">
          <div>
            <h1>Income</h1>
            <p class="subtitle">View all income across your properties</p>
          </div>
          <button mat-stroked-button color="primary" (click)="onAddIncome()">
            <mat-icon>add</mat-icon>
            <span class="button-text">Add Income</span>
          </button>
        </div>
      </div>

      <!-- Filters Section (AC-4.3.3, AC-4.3.4) -->
      <mat-card class="filters-card">
        <div class="filters-row">
          <!-- Date Range Filter (AC-4.3.3) -->
          <div class="filter-group date-range-group">
            <mat-form-field class="date-field">
              <mat-label>From</mat-label>
              <input
                matInput
                [matDatepicker]="fromPicker"
                [value]="dateFromValue"
                (dateChange)="onDateFromChange($event)"
                placeholder="Start date"
              >
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
              <mat-datepicker #fromPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field class="date-field">
              <mat-label>To</mat-label>
              <input
                matInput
                [matDatepicker]="toPicker"
                [value]="dateToValue"
                (dateChange)="onDateToChange($event)"
                placeholder="End date"
              >
              <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
              <mat-datepicker #toPicker></mat-datepicker>
            </mat-form-field>
          </div>

          <!-- Property Filter (AC-4.3.4) -->
          <mat-form-field class="property-field">
            <mat-label>Property</mat-label>
            <mat-select
              [value]="incomeStore.selectedPropertyId() || 'all'"
              (selectionChange)="onPropertyChange($event.value)"
            >
              <mat-option value="all">All Properties</mat-option>
              @for (property of propertyStore.properties(); track property.id) {
                <mat-option [value]="property.id">{{ property.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Clear Filters Button -->
          @if (incomeStore.hasActiveFilters()) {
            <button
              mat-stroked-button
              (click)="onClearFilters()"
              class="clear-filters-btn"
            >
              <mat-icon>clear</mat-icon>
              Clear Filters
            </button>
          }
        </div>

        <!-- Total Income Display (AC-4.3.6) -->
        @if (!incomeStore.isLoading()) {
          <div class="total-section">
            <span class="total-label">Total Income:</span>
            <span class="total-amount">{{ incomeStore.formattedTotalAmount() }}</span>
          </div>
        }
      </mat-card>

      <!-- Loading State -->
      @if (incomeStore.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading income...</p>
        </div>
      }

      <!-- Error State -->
      @if (incomeStore.error()) {
        <mat-card class="error-card">
          <mat-icon color="warn">error_outline</mat-icon>
          <p>{{ incomeStore.error() }}</p>
          <button mat-stroked-button color="primary" (click)="incomeStore.initialize()">
            Try Again
          </button>
        </mat-card>
      }

      <!-- Income List -->
      @if (!incomeStore.isLoading() && !incomeStore.error()) {
        <!-- Truly Empty State (AC-4.3.5) -->
        @if (incomeStore.isTrulyEmpty()) {
          <mat-card class="empty-state-card">
            <mat-icon class="empty-icon">payments</mat-icon>
            <h2>No income recorded yet</h2>
            <p>Add your first income entry.</p>
            <p class="hint">Go to a property's income workspace to add income.</p>
          </mat-card>
        }

        <!-- Filtered Empty State (AC-4.3.5) -->
        @if (incomeStore.isFilteredEmpty()) {
          <mat-card class="empty-state-card">
            <mat-icon class="empty-icon">search_off</mat-icon>
            <h2>No income recorded for this period</h2>
            <p>Try adjusting your filters or clearing them.</p>
            <button mat-stroked-button color="primary" (click)="onClearFilters()">
              Clear Filters
            </button>
          </mat-card>
        }

        <!-- Income List Table (AC-4.3.2) -->
        @if (incomeStore.hasIncome()) {
          <mat-card class="income-list-card">
            <!-- List Header -->
            <div class="list-header">
              <div class="header-date">Date</div>
              <div class="header-property">Property</div>
              <div class="header-source">Source</div>
              <div class="header-description">Description</div>
              <div class="header-amount">Amount</div>
              <div class="header-actions">Actions</div>
            </div>

            <!-- Income Rows (AC-16.2.2) -->
            @for (income of incomeStore.incomeEntries(); track income.id) {
              <div class="income-row" (click)="navigateToDetail(income)">
                <div class="cell-date">{{ formatDate(income.date) }}</div>
                <div class="cell-property">{{ income.propertyName }}</div>
                <div class="cell-source">{{ income.source || '—' }}</div>
                <div class="cell-description">{{ income.description || '—' }}</div>
                <div class="cell-amount">{{ income.amount | currency }}</div>
                <div class="cell-actions" (click)="$event.stopPropagation()">
                  <button mat-icon-button matTooltip="Edit" (click)="navigateToDetail(income)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDeleteIncome(income)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .income-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
      }

      .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .page-header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .filters-card {
      margin-bottom: 24px;
      padding: 16px;
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 16px;
    }

    .date-range-group {
      display: flex;
      gap: 8px;
    }

    .date-field {
      width: 150px;
    }

    .property-field {
      min-width: 200px;
    }

    .clear-filters-btn {
      margin-top: 4px;
    }

    .total-section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .total-label {
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }

    .total-amount {
      font-size: 1.25em;
      font-weight: 600;
      color: var(--mat-sys-primary);
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

    .income-list-card {
      overflow: hidden;
    }

    .list-header {
      display: grid;
      grid-template-columns: 100px 180px 1fr 1fr 120px 80px;
      gap: 16px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container);
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      font-weight: 500;
      font-size: 0.85em;
      color: var(--mat-sys-on-surface-variant);
    }

    .header-amount {
      text-align: right;
    }

    .header-actions {
      text-align: center;
    }

    .income-row {
      display: grid;
      grid-template-columns: 100px 180px 1fr 1fr 120px 80px;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      transition: background-color 0.2s ease;
      cursor: pointer;
      align-items: center;

      &:hover {
        background-color: var(--mat-sys-surface-container-low);
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .cell-actions {
      display: flex;
      justify-content: center;
      gap: 0;
    }

    .cell-date {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    .cell-property {
      font-weight: 500;
    }

    .cell-source, .cell-description {
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell-amount {
      text-align: right;
      font-weight: 600;
      color: var(--mat-sys-primary);
    }

    @media (max-width: 768px) {
      .income-container {
        padding: 16px;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .date-range-group {
        flex-direction: column;
      }

      .date-field, .property-field {
        width: 100%;
      }

      .list-header {
        display: none;
      }

      .income-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
      }

      .cell-date {
        order: 1;
      }

      .cell-property {
        order: 2;
        font-size: 1.1em;
      }

      .cell-amount {
        order: 3;
        text-align: left;
        font-size: 1.2em;
      }

      .cell-source {
        order: 4;
      }

      .cell-description {
        order: 5;
      }

      .cell-actions {
        order: 6;
      }
    }
  `],
})
export class IncomeComponent implements OnInit, OnDestroy {
  readonly incomeStore = inject(IncomeListStore);
  readonly propertyStore = inject(PropertyStore);
  private readonly yearService = inject(YearSelectorService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly propertyService = inject(PropertyService);
  private readonly incomeService = inject(IncomeService);

  // Date values for the datepickers
  dateFromValue: Date | null = null;
  dateToValue: Date | null = null;

  // Effect to react to year changes (AC-4.3.2 - respects global tax year selector)
  private yearEffect = effect(() => {
    const year = this.yearService.selectedYear();
    this.incomeStore.setYear(year);
  });

  ngOnInit(): void {
    // Load properties for filter dropdown (AC-4.3.4)
    this.propertyStore.loadProperties(undefined);

    // Initialize income list
    this.incomeStore.initialize();
  }

  ngOnDestroy(): void {
    // Reset store on component destroy
    this.incomeStore.reset();
  }

  /**
   * Handle date from change (AC-4.3.3)
   */
  onDateFromChange(event: { value: Date | null }): void {
    this.dateFromValue = event.value;
    this.updateDateRange();
  }

  /**
   * Handle date to change (AC-4.3.3)
   */
  onDateToChange(event: { value: Date | null }): void {
    this.dateToValue = event.value;
    this.updateDateRange();
  }

  /**
   * Update date range filter in store
   */
  private updateDateRange(): void {
    const dateFrom = this.dateFromValue
      ? this.formatDateForApi(this.dateFromValue)
      : null;
    const dateTo = this.dateToValue
      ? this.formatDateForApi(this.dateToValue)
      : null;

    this.incomeStore.setDateRange(dateFrom, dateTo);
  }

  /**
   * Format date for API (YYYY-MM-DD)
   */
  private formatDateForApi(date: Date): string {
    return formatLocalDate(date);
  }

  /**
   * Handle property filter change (AC-4.3.4)
   */
  onPropertyChange(value: string): void {
    const propertyId = value === 'all' ? null : value;
    this.incomeStore.setPropertyFilter(propertyId);
  }

  /**
   * Clear all filters (AC-4.3.5)
   */
  onClearFilters(): void {
    this.dateFromValue = null;
    this.dateToValue = null;
    this.incomeStore.clearFilters();
  }

  /**
   * Format date for display (AC-4.3.2)
   * Format: "Dec 15, 2025"
   */
  formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  /**
   * Add Income button handler (AC-16.2.1)
   * 0 properties → snackbar
   * 1 property → navigate directly
   * Multiple → property picker dialog
   */
  async onAddIncome(): Promise<void> {
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
      this.snackBar.open('Create a property first before adding income.', 'Dismiss', { duration: 5000 });
      return;
    }

    if (properties.length === 1) {
      this.router.navigate(['/properties', properties[0].id, 'income']);
    } else {
      const dialogRef = this.dialog.open(PropertyPickerDialogComponent, {
        width: '400px',
        data: {
          properties: properties.map((p) => ({ id: p.id, name: p.name })),
        } as PropertyPickerDialogData,
      });

      dialogRef.afterClosed().subscribe((propertyId: string | undefined) => {
        if (propertyId) {
          this.router.navigate(['/properties', propertyId, 'income']);
        }
      });
    }
  }

  /**
   * Navigate to income detail page (AC-16.2.2)
   */
  navigateToDetail(income: IncomeDto): void {
    this.router.navigate(['/income', income.id]);
  }

  /**
   * Delete income from list row (AC-16.2.2)
   */
  onDeleteIncome(income: IncomeDto): void {
    const dialogData: ConfirmDialogData = {
      title: 'Delete Income?',
      message: `Delete income of ${income.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} from ${this.formatDate(income.date)}?`,
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
          this.incomeService.deleteIncome(income.id).subscribe({
            next: () => {
              this.snackBar.open('Income deleted', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              this.incomeStore.initialize();
            },
            error: () => {
              this.snackBar.open('Failed to delete income. Please try again.', 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            },
          });
        }
      });
  }
}
