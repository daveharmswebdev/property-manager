import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ExpenseService,
  ExpenseFilters,
  ExpenseListItemDto,
  ExpenseCategoryDto,
} from '../services/expense.service';
import { DateRangePreset, getDateRangeFromPreset } from '../../../shared/utils/date-range.utils';

export type { DateRangePreset } from '../../../shared/utils/date-range.utils';

/**
 * Filter chip for display (AC-3.4.6)
 */
export interface FilterChip {
  type: 'date-range' | 'category' | 'search';
  label: string;
  value: string;
}

/**
 * Expense List Store State Interface (AC-3.4.1, AC-3.4.3, AC-3.4.4, AC-3.4.5, AC-3.4.6, AC-3.4.8)
 */
interface ExpenseListState {
  // Data
  expenses: ExpenseListItemDto[];
  categories: ExpenseCategoryDto[];

  // Filters (AC-3.4.3, AC-3.4.4, AC-3.4.5)
  dateRangePreset: DateRangePreset;
  dateFrom: string | null;
  dateTo: string | null;
  selectedCategoryIds: string[];
  searchText: string;
  year: number | null;

  // Sorting (AC-15.3.3)
  sortBy: string | null;
  sortDirection: 'asc' | 'desc';

  // Pagination (AC-3.4.8)
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  totalAmount: number;

  // Loading states
  isLoading: boolean;
  isLoadingCategories: boolean;
  error: string | null;
  categoriesLoaded: boolean;
}

/**
 * Initial state for expense list store
 */
const initialState: ExpenseListState = {
  // Data
  expenses: [],
  categories: [],

  // Filters - default to no filters (AC-3.4.4 "All Categories" when none selected)
  dateRangePreset: 'all',
  dateFrom: null,
  dateTo: null,
  selectedCategoryIds: [],
  searchText: '',
  year: null,

  // Sorting
  sortBy: null,
  sortDirection: 'desc',

  // Pagination - default page size 50 (AC-3.4.8)
  page: 1,
  pageSize: 50,
  totalCount: 0,
  totalPages: 0,
  totalAmount: 0,

  // Loading states
  isLoading: false,
  isLoadingCategories: false,
  error: null,
  categoriesLoaded: false,
};

const DATE_FILTER_STORAGE_KEY = 'propertyManager.expenseList.dateFilter';

function persistDateFilter(preset: DateRangePreset, dateFrom: string | null, dateTo: string | null): void {
  sessionStorage.setItem(DATE_FILTER_STORAGE_KEY, JSON.stringify({ dateRangePreset: preset, dateFrom, dateTo }));
}

function restoreDateFilter(): Partial<ExpenseListState> | null {
  const stored = sessionStorage.getItem(DATE_FILTER_STORAGE_KEY);
  if (!stored) return null;
  try {
    const { dateRangePreset, dateFrom, dateTo } = JSON.parse(stored);
    return { dateRangePreset, dateFrom, dateTo };
  } catch {
    return null;
  }
}

/**
 * ExpenseListStore (AC-3.4.1, AC-3.4.3, AC-3.4.4, AC-3.4.5, AC-3.4.6, AC-3.4.8)
 *
 * State management for the all-expenses list page using @ngrx/signals.
 * Provides:
 * - Paginated expense list with loading/error states
 * - Date range filtering (presets + custom)
 * - Category multi-select filtering
 * - Text search with debounce
 * - Filter chip display and management
 */
export const ExpenseListStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Whether any filter is active (AC-3.4.6)
     */
    hasActiveFilters: computed(() =>
      store.dateRangePreset() !== 'all' ||
      store.selectedCategoryIds().length > 0 ||
      store.searchText().trim() !== ''
    ),

    /**
     * Generate filter chips for display (AC-3.4.6)
     */
    filterChips: computed(() => {
      const chips: FilterChip[] = [];

      // Date range chip
      if (store.dateRangePreset() !== 'all') {
        const presetLabels: Record<DateRangePreset, string> = {
          'this-month': 'This Month',
          'this-quarter': 'This Quarter',
          'this-year': 'This Year',
          'custom': 'Custom Range',
          'all': 'All Time',
        };
        chips.push({
          type: 'date-range',
          label: 'Date',
          value: presetLabels[store.dateRangePreset()],
        });
      }

      // Category chips
      const categories = store.categories();
      store.selectedCategoryIds().forEach((categoryId) => {
        const category = categories.find((c) => c.id === categoryId);
        if (category) {
          chips.push({
            type: 'category',
            label: 'Category',
            value: category.name,
          });
        }
      });

      // Search chip
      if (store.searchText().trim()) {
        chips.push({
          type: 'search',
          label: 'Search',
          value: `"${store.searchText()}"`,
        });
      }

      return chips;
    }),

    /**
     * Display text for pagination (AC-3.4.8)
     * "Showing X-Y of Z expenses"
     */
    totalDisplay: computed(() => {
      const page = store.page();
      const pageSize = store.pageSize();
      const totalCount = store.totalCount();

      if (totalCount === 0) return '';

      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, totalCount);

      return `Showing ${start}-${end} of ${totalCount} expenses`;
    }),

    /**
     * Whether we have expenses loaded
     */
    hasExpenses: computed(() => !store.isLoading() && store.expenses().length > 0),

    /**
     * Whether the expense list is empty after filtering
     */
    isFilteredEmpty: computed(() =>
      !store.isLoading() &&
      store.expenses().length === 0 &&
      (store.dateRangePreset() !== 'all' ||
        store.selectedCategoryIds().length > 0 ||
        store.searchText().trim() !== '')
    ),

    /**
     * Whether the expense list is truly empty (no expenses at all)
     */
    isTrulyEmpty: computed(() =>
      !store.isLoading() &&
      store.expenses().length === 0 &&
      store.totalCount() === 0 &&
      store.dateRangePreset() === 'all' &&
      store.selectedCategoryIds().length === 0 &&
      store.searchText().trim() === ''
    ),

    /**
     * Build current filters object for API call
     */
    currentFilters: computed((): ExpenseFilters => {
      const { dateFrom, dateTo } = store.dateRangePreset() === 'custom'
        ? { dateFrom: store.dateFrom(), dateTo: store.dateTo() }
        : getDateRangeFromPreset(store.dateRangePreset(), store.year());

      return {
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
        categoryIds: store.selectedCategoryIds().length > 0 ? store.selectedCategoryIds() : undefined,
        search: store.searchText().trim() || undefined,
        year: store.year() ?? undefined,
        sortBy: store.sortBy() ?? undefined,
        sortDirection: store.sortBy() ? store.sortDirection() : undefined,
        page: store.page(),
        pageSize: store.pageSize(),
      };
    }),
  })),
  withMethods((store, expenseService = inject(ExpenseService), snackBar = inject(MatSnackBar)) => ({
    /**
     * Load expense categories (AC-3.4.4)
     * Categories are cached - only loads if not already loaded
     */
    loadCategories: rxMethod<void>(
      pipe(
        tap(() => {
          if (store.categoriesLoaded()) return;
          patchState(store, { isLoadingCategories: true, error: null });
        }),
        switchMap(() => {
          if (store.categoriesLoaded()) return of(null);
          return expenseService.getCategories().pipe(
            tap((response) =>
              patchState(store, {
                categories: response.items,
                isLoadingCategories: false,
                categoriesLoaded: true,
              })
            ),
            catchError((error) => {
              patchState(store, {
                isLoadingCategories: false,
                error: 'Failed to load expense categories. Please try again.',
              });
              console.error('Error loading categories:', error);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Load expenses with current filters (AC-3.4.1)
     */
    loadExpenses: rxMethod<ExpenseFilters>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((filters) =>
          expenseService.getExpenses(filters).pipe(
            tap((response) =>
              patchState(store, {
                expenses: response.items,
                totalCount: response.totalCount,
                totalPages: response.totalPages,
                totalAmount: response.totalAmount,
                page: response.page,
                pageSize: response.pageSize,
                isLoading: false,
              })
            ),
            catchError((error) => {
              patchState(store, {
                isLoading: false,
                error: 'Failed to load expenses. Please try again.',
              });
              console.error('Error loading expenses:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Set date range preset and reload (AC-3.4.3)
     */
    setDateRangePreset(preset: DateRangePreset): void {
      const { dateFrom, dateTo } = getDateRangeFromPreset(preset, store.year());
      patchState(store, {
        dateRangePreset: preset,
        dateFrom,
        dateTo,
        page: 1, // Reset to first page on filter change
      });
      persistDateFilter(preset, dateFrom, dateTo);
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Set custom date range and reload (AC-3.4.3)
     */
    setCustomDateRange(dateFrom: string, dateTo: string): void {
      patchState(store, {
        dateRangePreset: 'custom',
        dateFrom,
        dateTo,
        page: 1,
      });
      persistDateFilter('custom', dateFrom, dateTo);
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Set selected categories and reload (AC-3.4.4)
     */
    setCategories(categoryIds: string[]): void {
      patchState(store, {
        selectedCategoryIds: categoryIds,
        page: 1,
      });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Set search text and reload (AC-3.4.5)
     * Called after debounce in component
     */
    setSearch(searchText: string): void {
      patchState(store, {
        searchText,
        page: 1,
      });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Set tax year filter and reload
     */
    setYear(year: number | null): void {
      patchState(store, {
        year,
        page: 1,
      });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Set sort column — toggles direction if same column, resets to asc for new column (AC-15.3.3)
     */
    setSort(sortBy: string): void {
      const currentSortBy = store.sortBy();
      const currentDirection = store.sortDirection();
      const newDirection = currentSortBy === sortBy
        ? (currentDirection === 'asc' ? 'desc' : 'asc')
        : 'asc';
      patchState(store, {
        sortBy,
        sortDirection: newDirection,
        page: 1,
      });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Go to specific page (AC-3.4.8)
     */
    goToPage(page: number): void {
      patchState(store, { page });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Change page size (AC-3.4.8)
     */
    setPageSize(pageSize: number): void {
      patchState(store, {
        pageSize,
        page: 1, // Reset to first page when changing page size
      });
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Remove a specific filter chip (AC-3.4.6)
     */
    removeFilterChip(chip: FilterChip): void {
      switch (chip.type) {
        case 'date-range':
          patchState(store, {
            dateRangePreset: 'all',
            dateFrom: null,
            dateTo: null,
            page: 1,
          });
          sessionStorage.removeItem(DATE_FILTER_STORAGE_KEY);
          break;
        case 'category':
          const category = store.categories().find((c) => c.name === chip.value);
          if (category) {
            patchState(store, {
              selectedCategoryIds: store.selectedCategoryIds().filter((id) => id !== category.id),
              page: 1,
            });
          }
          break;
        case 'search':
          patchState(store, {
            searchText: '',
            page: 1,
          });
          break;
      }
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Clear all filters (AC-3.4.6, AC-3.4.7)
     */
    clearFilters(): void {
      patchState(store, {
        dateRangePreset: 'all',
        dateFrom: null,
        dateTo: null,
        selectedCategoryIds: [],
        searchText: '',
        page: 1,
      });
      sessionStorage.removeItem(DATE_FILTER_STORAGE_KEY);
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Clear error state
     */
    clearError(): void {
      patchState(store, { error: null });
    },

    /**
     * Initialize store - load categories and expenses
     */
    initialize(): void {
      const restored = restoreDateFilter();
      if (restored) {
        patchState(store, restored);
      }
      this.loadCategories(undefined);
      this.loadExpenses(store.currentFilters());
    },

    /**
     * Reset store to initial state
     */
    reset(): void {
      patchState(store, {
        ...initialState,
        // Preserve cached categories
        categories: store.categories(),
        categoriesLoaded: store.categoriesLoaded(),
      });
    },
  }))
);
