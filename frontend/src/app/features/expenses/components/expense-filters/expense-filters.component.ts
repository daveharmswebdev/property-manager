import { Component, input, output, effect } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ExpenseCategoryDto } from '../../services/expense.service';
import { DateRangePreset, FilterChip } from '../../stores/expense-list.store';
import { DateRangeFilterComponent } from '../../../../shared/components/date-range-filter/date-range-filter.component';

/**
 * ExpenseFiltersComponent (AC-3.4.3, AC-3.4.4, AC-3.4.5, AC-3.4.6)
 *
 * Filter controls for the expense list page:
 * - Date range dropdown with presets (This Month, This Quarter, This Year, Custom)
 * - Custom date range picker
 * - Category multi-select dropdown
 * - Search text input with debounce
 * - Filter chips display with remove functionality
 * - "Clear all" button
 */
@Component({
  selector: 'app-expense-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    DateRangeFilterComponent,
  ],
  template: `
    <div class="filters-container">
      <!-- Filter Controls Row -->
      <div class="filter-controls">
        <!-- Date Range Filter (AC-3.4.3) -->
        <app-date-range-filter
          [dateRangePreset]="dateRangePreset()"
          [dateFrom]="dateFrom()"
          [dateTo]="dateTo()"
          (dateRangePresetChange)="onDateRangePresetChange($event)"
          (customDateRangeChange)="onCustomDateRangeChange($event)"
        />

        <!-- Category Multi-Select (AC-3.4.4) -->
        <mat-form-field appearance="outline" class="filter-field category-field">
          <mat-label>Categories</mat-label>
          <mat-select multiple [value]="selectedCategoryIds()" (selectionChange)="onCategoryChange($event.value)">
            @for (category of categories(); track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Search Input (AC-3.4.5) -->
        <mat-form-field appearance="outline" class="filter-field search-field">
          <mat-label>Search description</mat-label>
          <input
            matInput
            [formControl]="searchControl"
            placeholder="Search expenses..."
          >
          <mat-icon matPrefix>search</mat-icon>
          @if (searchControl.value) {
            <button
              matSuffix
              mat-icon-button
              aria-label="Clear search"
              (click)="clearSearch()"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
      </div>

      <!-- Filter Chips Row (AC-3.4.6) -->
      @if (filterChips().length > 0) {
        <div class="filter-chips">
          <mat-chip-set>
            @for (chip of filterChips(); track chip.type + chip.value) {
              <mat-chip (removed)="onChipRemove(chip)" class="filter-chip">
                <span class="chip-label">{{ chip.label }}:</span>
                <span class="chip-value">{{ chip.value }}</span>
                <button matChipRemove aria-label="Remove filter">
                  <mat-icon>cancel</mat-icon>
                </button>
              </mat-chip>
            }
          </mat-chip-set>
          <button mat-button color="primary" (click)="onClearAll()" class="clear-all-btn">
            Clear all
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .filters-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .filter-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }

    .filter-field {
      margin: 0;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .category-field {
      min-width: 200px;
    }

    .search-field {
      min-width: 250px;
      flex: 1;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .filter-chip {
      .chip-label {
        font-weight: 500;
        margin-right: 4px;
      }
    }

    .clear-all-btn {
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .filter-controls {
        flex-direction: column;
      }

      .filter-field {
        width: 100%;
        min-width: unset;
      }

      .search-field {
        min-width: unset;
      }
    }
  `],
})
export class ExpenseFiltersComponent {
  // Inputs
  categories = input.required<ExpenseCategoryDto[]>();
  dateRangePreset = input.required<DateRangePreset>();
  selectedCategoryIds = input.required<string[]>();
  searchText = input.required<string>();
  filterChips = input.required<FilterChip[]>();
  dateFrom = input<string | null>(null);
  dateTo = input<string | null>(null);

  // Outputs
  dateRangePresetChange = output<DateRangePreset>();
  customDateRangeChange = output<{ dateFrom: string; dateTo: string }>();
  categoryChange = output<string[]>();
  searchChange = output<string>();
  chipRemove = output<FilterChip>();
  clearAll = output<void>();

  // Form controls
  searchControl = new FormControl('');

  private destroy$ = new Subject<void>();

  constructor() {
    // Set up search debounce (AC-3.4.5 - 300ms debounce)
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      this.searchChange.emit(value || '');
    });

    // Sync search input with parent state
    effect(() => {
      const search = this.searchText();
      if (this.searchControl.value !== search) {
        this.searchControl.setValue(search, { emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDateRangePresetChange(preset: DateRangePreset): void {
    this.dateRangePresetChange.emit(preset);
  }

  onCustomDateRangeChange(range: { dateFrom: string; dateTo: string }): void {
    this.customDateRangeChange.emit(range);
  }

  onCategoryChange(categoryIds: string[]): void {
    this.categoryChange.emit(categoryIds);
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.searchChange.emit('');
  }

  onChipRemove(chip: FilterChip): void {
    this.chipRemove.emit(chip);
  }

  onClearAll(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.clearAll.emit();
  }
}
