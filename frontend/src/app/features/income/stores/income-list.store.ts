import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  IncomeService,
  IncomeDto,
  IncomeFilterParams,
} from '../services/income.service';
import { DateRangePreset, getDateRangeFromPreset } from '../../../shared/utils/date-range.utils';

/**
 * Property option for filter dropdown (AC-4.3.4)
 */
export interface PropertyOption {
  id: string;
  name: string;
}

/**
 * Income List Store State Interface (AC-4.3.1, AC-4.3.3, AC-4.3.4, AC-4.3.5, AC-4.3.6)
 */
interface IncomeListState {
  // Data
  incomeEntries: IncomeDto[];
  totalAmount: number;
  totalCount: number;

  // Properties for filter dropdown
  properties: PropertyOption[];

  // Filters (AC-4.3.3, AC-4.3.4, AC-16.11.1)
  dateRangePreset: DateRangePreset;
  dateFrom: string | null;
  dateTo: string | null;
  selectedPropertyId: string | null;
  searchText: string;
  year: number | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Track if we've ever loaded data (for empty state detection)
  hasEverLoaded: boolean;
}

/**
 * Initial state for income list store
 */
const initialState: IncomeListState = {
  // Data
  incomeEntries: [],
  totalAmount: 0,
  totalCount: 0,

  // Properties
  properties: [],

  // Filters - default to no filters
  dateRangePreset: 'all',
  dateFrom: null,
  dateTo: null,
  selectedPropertyId: null,
  searchText: '',
  year: null,

  // Loading states
  isLoading: false,
  error: null,
  hasEverLoaded: false,
};

const INCOME_DATE_FILTER_STORAGE_KEY = 'propertyManager.incomeList.dateFilter';

function persistIncomeDateFilter(preset: DateRangePreset, dateFrom: string | null, dateTo: string | null): void {
  sessionStorage.setItem(INCOME_DATE_FILTER_STORAGE_KEY, JSON.stringify({ dateRangePreset: preset, dateFrom, dateTo }));
}

function restoreIncomeDateFilter(): Partial<IncomeListState> | null {
  const stored = sessionStorage.getItem(INCOME_DATE_FILTER_STORAGE_KEY);
  if (!stored) return null;
  try {
    const { dateRangePreset, dateFrom, dateTo } = JSON.parse(stored);
    return { dateRangePreset, dateFrom, dateTo };
  } catch {
    return null;
  }
}

/**
 * IncomeListStore (AC-4.3.1, AC-4.3.3, AC-4.3.4, AC-4.3.5, AC-4.3.6)
 *
 * State management for the all-income list page using @ngrx/signals.
 * Provides:
 * - Income list with loading/error states
 * - Date range filtering
 * - Property filtering
 * - Total amount calculation
 * - Empty state detection
 */
export const IncomeListStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Whether any filter is active (AC-4.3.6)
     */
    hasActiveFilters: computed(() =>
      store.dateRangePreset() !== 'all' ||
      store.selectedPropertyId() !== null ||
      store.searchText().trim() !== ''
    ),

    /**
     * Whether we have income loaded
     */
    hasIncome: computed(() => !store.isLoading() && store.incomeEntries().length > 0),

    /**
     * Whether the income list is empty after filtering (AC-4.3.5)
     */
    isFilteredEmpty: computed(() =>
      !store.isLoading() &&
      store.hasEverLoaded() &&
      store.incomeEntries().length === 0 &&
      (store.dateRangePreset() !== 'all' ||
        store.selectedPropertyId() !== null ||
        store.searchText().trim() !== '')
    ),

    /**
     * Whether the income list is truly empty (no income at all) (AC-4.3.5)
     */
    isTrulyEmpty: computed(() =>
      !store.isLoading() &&
      store.hasEverLoaded() &&
      store.incomeEntries().length === 0 &&
      store.totalCount() === 0 &&
      store.dateRangePreset() === 'all' &&
      store.selectedPropertyId() === null &&
      store.searchText().trim() === ''
    ),

    /**
     * Build current filters object for API call
     */
    currentFilters: computed((): IncomeFilterParams => {
      const { dateFrom, dateTo } = store.dateRangePreset() === 'custom'
        ? { dateFrom: store.dateFrom(), dateTo: store.dateTo() }
        : getDateRangeFromPreset(store.dateRangePreset(), store.year());

      return {
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
        propertyId: store.selectedPropertyId() ?? undefined,
        search: store.searchText().trim() || undefined,
        year: store.year() ?? undefined,
      };
    }),

  })),
  withMethods((store, incomeService = inject(IncomeService), snackBar = inject(MatSnackBar)) => ({
    /**
     * Load all income with current filters (AC-4.3.1)
     */
    loadIncome: rxMethod<IncomeFilterParams>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((filters) =>
          incomeService.getAllIncome(filters).pipe(
            tap((response) =>
              patchState(store, {
                incomeEntries: response.items,
                totalCount: response.totalCount,
                totalAmount: response.totalAmount,
                isLoading: false,
                hasEverLoaded: true,
              })
            ),
            catchError((error) => {
              patchState(store, {
                isLoading: false,
                error: 'Failed to load income. Please try again.',
                hasEverLoaded: true,
              });
              console.error('Error loading income:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Set properties for filter dropdown (AC-4.3.4)
     */
    setProperties(properties: PropertyOption[]): void {
      patchState(store, { properties });
    },

    /**
     * Set date range preset and reload (AC-4.3.3)
     */
    setDateRangePreset(preset: DateRangePreset): void {
      const { dateFrom, dateTo } = getDateRangeFromPreset(preset, store.year());
      patchState(store, { dateRangePreset: preset, dateFrom, dateTo });
      persistIncomeDateFilter(preset, dateFrom, dateTo);
      this.loadIncome(store.currentFilters());
    },

    /**
     * Set custom date range and reload (AC-4.3.3)
     */
    setCustomDateRange(dateFrom: string, dateTo: string): void {
      patchState(store, { dateRangePreset: 'custom', dateFrom, dateTo });
      persistIncomeDateFilter('custom', dateFrom, dateTo);
      this.loadIncome(store.currentFilters());
    },

    /**
     * Set property filter and reload (AC-4.3.4)
     */
    setPropertyFilter(propertyId: string | null): void {
      patchState(store, { selectedPropertyId: propertyId });
      this.loadIncome(store.currentFilters());
    },

    /**
     * Set search text and reload (AC-16.11.1)
     * Called after debounce in component
     */
    setSearch(searchText: string): void {
      patchState(store, { searchText });
      this.loadIncome(store.currentFilters());
    },

    /**
     * Set tax year filter and reload (AC-4.3.2)
     */
    setYear(year: number | null): void {
      patchState(store, { year });
      this.loadIncome(store.currentFilters());
    },

    /**
     * Clear all filters (AC-4.3.5)
     */
    clearFilters(): void {
      patchState(store, {
        dateRangePreset: 'all',
        dateFrom: null,
        dateTo: null,
        selectedPropertyId: null,
        searchText: '',
      });
      sessionStorage.removeItem(INCOME_DATE_FILTER_STORAGE_KEY);
      this.loadIncome(store.currentFilters());
    },

    /**
     * Clear error state
     */
    clearError(): void {
      patchState(store, { error: null });
    },

    /**
     * Initialize store - load income with current filters
     */
    initialize(): void {
      const restored = restoreIncomeDateFilter();
      if (restored) {
        patchState(store, restored);
      }
      this.loadIncome(store.currentFilters());
    },

    /**
     * Reset store to initial state
     */
    reset(): void {
      patchState(store, initialState);
    },
  }))
);
