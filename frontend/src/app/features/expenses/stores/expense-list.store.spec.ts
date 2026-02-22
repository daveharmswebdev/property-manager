import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseListStore, FilterChip } from './expense-list.store';
import {
  ExpenseService,
  ExpenseListItemDto,
  ExpenseCategoryDto,
  PagedResult,
  ExpenseCategoriesResponse,
} from '../services/expense.service';

describe('ExpenseListStore', () => {
  let store: InstanceType<typeof ExpenseListStore>;
  let expenseServiceMock: {
    getExpenses: ReturnType<typeof vi.fn>;
    getCategories: ReturnType<typeof vi.fn>;
  };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };

  const mockCategory: ExpenseCategoryDto = {
    id: 'cat-1',
    name: 'Repairs',
    scheduleELine: 'Line 14',
    sortOrder: 1,
  };

  const mockExpense: ExpenseListItemDto = {
    id: 'exp-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    categoryId: 'cat-1',
    categoryName: 'Repairs',
    scheduleELine: 'Line 14',
    amount: 150.0,
    date: '2025-01-15',
    description: 'Fixed leak',
    createdAt: '2025-01-15T10:00:00Z',
  };

  const mockExpensesResponse: PagedResult<ExpenseListItemDto> = {
    items: [mockExpense],
    totalCount: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    totalAmount: 150.0,
  };

  const mockCategoriesResponse: ExpenseCategoriesResponse = {
    items: [mockCategory],
    totalCount: 1,
  };

  beforeEach(() => {
    sessionStorage.clear();

    expenseServiceMock = {
      getExpenses: vi.fn().mockReturnValue(of(mockExpensesResponse)),
      getCategories: vi.fn().mockReturnValue(of(mockCategoriesResponse)),
    };
    snackBarMock = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ExpenseListStore,
        { provide: ExpenseService, useValue: expenseServiceMock },
        { provide: MatSnackBar, useValue: snackBarMock },
      ],
    });

    store = TestBed.inject(ExpenseListStore);
  });

  describe('initial state', () => {
    it('should have empty expenses', () => {
      expect(store.expenses()).toEqual([]);
    });

    it('should have empty categories', () => {
      expect(store.categories()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have dateRangePreset set to all', () => {
      expect(store.dateRangePreset()).toBe('all');
    });

    it('should have no selected category ids', () => {
      expect(store.selectedCategoryIds()).toEqual([]);
    });

    it('should have empty search text', () => {
      expect(store.searchText()).toBe('');
    });

    it('should have page 1', () => {
      expect(store.page()).toBe(1);
    });

    it('should have page size 50', () => {
      expect(store.pageSize()).toBe(50);
    });

    it('should have zero totalAmount', () => {
      expect(store.totalAmount()).toBe(0);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('hasActiveFilters should be false initially', () => {
      expect(store.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should be true when date range set', () => {
      store.setDateRangePreset('this-month');
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when categories selected', () => {
      store.loadCategories(undefined);
      store.setCategories(['cat-1']);
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when search text set', () => {
      store.setSearch('test');
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('hasExpenses should be true when expenses loaded', () => {
      store.initialize();
      expect(store.hasExpenses()).toBe(true);
    });

    it('hasExpenses should be false when loading', () => {
      expenseServiceMock.getExpenses.mockImplementation(() => {
        // Never resolves, stays loading
        return of(mockExpensesResponse);
      });
      store.initialize();
      expect(store.isLoading()).toBe(false);
      expect(store.hasExpenses()).toBe(true);
    });

    it('isTrulyEmpty should be true when no expenses at all', () => {
      expenseServiceMock.getExpenses.mockReturnValue(of({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      }));
      store.initialize();
      expect(store.isTrulyEmpty()).toBe(true);
    });

    it('isFilteredEmpty should be true when filters return empty', () => {
      // First load expenses
      store.initialize();

      // Then set filter that returns empty
      expenseServiceMock.getExpenses.mockReturnValue(of({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      }));
      store.setSearch('nonexistent');

      expect(store.isFilteredEmpty()).toBe(true);
    });

    describe('totalDisplay', () => {
      it('should show empty string when no expenses', () => {
        expenseServiceMock.getExpenses.mockReturnValue(of({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 50,
          totalPages: 0,
        }));
        store.initialize();
        expect(store.totalDisplay()).toBe('');
      });

      it('should show correct range', () => {
        store.initialize();
        expect(store.totalDisplay()).toBe('Showing 1-1 of 1 expenses');
      });
    });

    describe('filterChips', () => {
      it('should return empty array when no filters', () => {
        expect(store.filterChips()).toEqual([]);
      });

      it('should include date range chip', () => {
        store.setDateRangePreset('this-month');
        const chips = store.filterChips();
        expect(chips).toContainEqual({
          type: 'date-range',
          label: 'Date',
          value: 'This Month',
        });
      });

      it('should include category chip', () => {
        store.loadCategories(undefined);
        store.setCategories(['cat-1']);
        const chips = store.filterChips();
        expect(chips).toContainEqual({
          type: 'category',
          label: 'Category',
          value: 'Repairs',
        });
      });

      it('should include search chip', () => {
        store.setSearch('leak');
        const chips = store.filterChips();
        expect(chips).toContainEqual({
          type: 'search',
          label: 'Search',
          value: '"leak"',
        });
      });
    });
  });

  describe('loadCategories', () => {
    it('should call service', () => {
      store.loadCategories(undefined);
      expect(expenseServiceMock.getCategories).toHaveBeenCalled();
    });

    it('should update categories state', () => {
      store.loadCategories(undefined);
      expect(store.categories()).toEqual([mockCategory]);
    });

    it('should set categoriesLoaded flag', () => {
      store.loadCategories(undefined);
      expect(store.categoriesLoaded()).toBe(true);
    });

    it('should not reload if already loaded', () => {
      store.loadCategories(undefined);
      store.loadCategories(undefined);
      expect(expenseServiceMock.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should handle error', () => {
      expenseServiceMock.getCategories.mockReturnValue(throwError(() => new Error('Network')));
      store.loadCategories(undefined);
      expect(store.error()).toBe('Failed to load expense categories. Please try again.');
    });
  });

  describe('loadExpenses', () => {
    it('should call service with filters', () => {
      const filters = { page: 1, pageSize: 50 };
      store.loadExpenses(filters);
      expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(filters);
    });

    it('should update expenses state', () => {
      store.initialize();
      expect(store.expenses()).toEqual([mockExpense]);
    });

    it('should update pagination state', () => {
      store.initialize();
      expect(store.totalCount()).toBe(1);
      expect(store.totalPages()).toBe(1);
    });

    it('should set totalAmount from API response (AC2)', () => {
      store.initialize();
      expect(store.totalAmount()).toBe(150.0);
    });

    it('should handle error', () => {
      expenseServiceMock.getExpenses.mockReturnValue(throwError(() => new Error('Network')));
      store.initialize();
      expect(store.error()).toBe('Failed to load expenses. Please try again.');
    });
  });

  describe('setDateRangePreset', () => {
    it('should update dateRangePreset', () => {
      store.setDateRangePreset('this-month');
      expect(store.dateRangePreset()).toBe('this-month');
    });

    it('should reset page to 1', () => {
      store.goToPage(2);
      store.setDateRangePreset('this-year');
      expect(store.page()).toBe(1);
    });

    it('should reload expenses', () => {
      store.setDateRangePreset('this-quarter');
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('setCustomDateRange', () => {
    it('should set preset to custom', () => {
      store.setCustomDateRange('2025-01-01', '2025-01-31');
      expect(store.dateRangePreset()).toBe('custom');
    });

    it('should set date range', () => {
      store.setCustomDateRange('2025-01-01', '2025-01-31');
      expect(store.dateFrom()).toBe('2025-01-01');
      expect(store.dateTo()).toBe('2025-01-31');
    });

    it('should reload expenses', () => {
      store.setCustomDateRange('2025-01-01', '2025-01-31');
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('setCategories', () => {
    it('should update selected category ids', () => {
      store.setCategories(['cat-1', 'cat-2']);
      expect(store.selectedCategoryIds()).toEqual(['cat-1', 'cat-2']);
    });

    it('should reset page to 1', () => {
      store.goToPage(2);
      store.setCategories(['cat-1']);
      expect(store.page()).toBe(1);
    });

    it('should reload expenses', () => {
      store.setCategories(['cat-1']);
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('setSearch', () => {
    it('should update search text', () => {
      store.setSearch('repair');
      expect(store.searchText()).toBe('repair');
    });

    it('should reset page to 1', () => {
      store.goToPage(2);
      store.setSearch('repair');
      expect(store.page()).toBe(1);
    });

    it('should reload expenses', () => {
      store.setSearch('repair');
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('setYear', () => {
    it('should update year', () => {
      store.setYear(2024);
      expect(store.year()).toBe(2024);
    });

    it('should reload expenses with year filter', () => {
      store.setYear(2024);
      expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2024 })
      );
    });
  });

  describe('pagination', () => {
    describe('goToPage', () => {
      it('should request specific page', () => {
        store.goToPage(3);
        expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ page: 3 })
        );
      });

      it('should reload expenses', () => {
        store.goToPage(2);
        expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    describe('setPageSize', () => {
      it('should request new page size', () => {
        store.setPageSize(100);
        expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ pageSize: 100 })
        );
      });

      it('should reset to page 1 when changing page size', () => {
        // Mock to track multiple calls
        store.goToPage(2);
        expenseServiceMock.getExpenses.mockClear();
        store.setPageSize(100);
        expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, pageSize: 100 })
        );
      });

      it('should reload expenses', () => {
        store.setPageSize(25);
        expect(expenseServiceMock.getExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ pageSize: 25 })
        );
      });
    });
  });

  describe('removeFilterChip', () => {
    it('should remove date range filter', () => {
      store.setDateRangePreset('this-month');
      const chip: FilterChip = { type: 'date-range', label: 'Date', value: 'This Month' };

      store.removeFilterChip(chip);

      expect(store.dateRangePreset()).toBe('all');
      expect(store.dateFrom()).toBeNull();
      expect(store.dateTo()).toBeNull();
    });

    it('should remove category filter', () => {
      store.loadCategories(undefined);
      store.setCategories(['cat-1']);
      const chip: FilterChip = { type: 'category', label: 'Category', value: 'Repairs' };

      store.removeFilterChip(chip);

      expect(store.selectedCategoryIds()).toEqual([]);
    });

    it('should remove search filter', () => {
      store.setSearch('test');
      const chip: FilterChip = { type: 'search', label: 'Search', value: '"test"' };

      store.removeFilterChip(chip);

      expect(store.searchText()).toBe('');
    });

    it('should reload expenses after removing chip', () => {
      store.setSearch('test');
      expenseServiceMock.getExpenses.mockClear();

      const chip: FilterChip = { type: 'search', label: 'Search', value: '"test"' };
      store.removeFilterChip(chip);

      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters', () => {
      store.setDateRangePreset('this-month');
      store.setCategories(['cat-1']);
      store.setSearch('repair');

      store.clearFilters();

      expect(store.dateRangePreset()).toBe('all');
      expect(store.dateFrom()).toBeNull();
      expect(store.dateTo()).toBeNull();
      expect(store.selectedCategoryIds()).toEqual([]);
      expect(store.searchText()).toBe('');
    });

    it('should reset page to 1', () => {
      store.goToPage(3);
      store.clearFilters();
      expect(store.page()).toBe(1);
    });

    it('should reload expenses', () => {
      store.clearFilters();
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      expenseServiceMock.getExpenses.mockReturnValue(throwError(() => new Error('Error')));
      store.initialize();
      expect(store.error()).not.toBeNull();

      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should load categories', () => {
      store.initialize();
      expect(expenseServiceMock.getCategories).toHaveBeenCalled();
    });

    it('should load expenses', () => {
      store.initialize();
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset filters but preserve categories', () => {
      store.loadCategories(undefined);
      store.setDateRangePreset('this-month');
      store.setSearch('test');

      store.reset();

      expect(store.dateRangePreset()).toBe('all');
      expect(store.searchText()).toBe('');
      expect(store.categories()).toEqual([mockCategory]); // Preserved
      expect(store.categoriesLoaded()).toBe(true); // Preserved
    });

    it('should reset expenses', () => {
      store.initialize();
      store.reset();
      expect(store.expenses()).toEqual([]);
    });
  });

  describe('currentFilters computed', () => {
    it('should build filters with all parameters', () => {
      store.setDateRangePreset('this-year');
      store.setCategories(['cat-1']);
      store.setSearch('repair');
      store.setYear(2025);

      const filters = store.currentFilters();

      expect(filters.categoryIds).toEqual(['cat-1']);
      expect(filters.search).toBe('repair');
      expect(filters.year).toBe(2025);
      expect(filters.page).toBe(1);
      expect(filters.pageSize).toBe(50);
    });

    it('should not include undefined values', () => {
      const filters = store.currentFilters();

      expect(filters.dateFrom).toBeUndefined();
      expect(filters.dateTo).toBeUndefined();
      expect(filters.categoryIds).toBeUndefined();
      expect(filters.search).toBeUndefined();
      expect(filters.year).toBeUndefined();
    });
  });

  describe('sessionStorage persistence (AC2 Story 15.3)', () => {
    const STORAGE_KEY = 'propertyManager.expenseList.dateFilter';

    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should persist date filter to sessionStorage after setCustomDateRange', () => {
      store.setCustomDateRange('2026-03-01', '2026-03-31');

      const stored = sessionStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.dateRangePreset).toBe('custom');
      expect(parsed.dateFrom).toBe('2026-03-01');
      expect(parsed.dateTo).toBe('2026-03-31');
    });

    it('should persist date filter to sessionStorage after setDateRangePreset', () => {
      store.setDateRangePreset('this-month');

      const stored = sessionStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.dateRangePreset).toBe('this-month');
    });

    it('should restore date filter from sessionStorage on initialize', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        dateRangePreset: 'custom',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      }));

      store.initialize();

      expect(store.dateRangePreset()).toBe('custom');
      expect(store.dateFrom()).toBe('2026-06-01');
      expect(store.dateTo()).toBe('2026-06-30');
    });

    it('should clear sessionStorage on clearFilters', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        dateRangePreset: 'custom',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      }));

      store.clearFilters();

      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should clear sessionStorage on date-range chip removal', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        dateRangePreset: 'this-month',
        dateFrom: null,
        dateTo: null,
      }));
      store.setDateRangePreset('this-month');

      const chip: FilterChip = { type: 'date-range', label: 'Date', value: 'This Month' };
      store.removeFilterChip(chip);

      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('sort (AC3 Story 15.3)', () => {
    it('should have null sortBy initially', () => {
      expect(store.sortBy()).toBeNull();
    });

    it('should have desc sortDirection initially', () => {
      expect(store.sortDirection()).toBe('desc');
    });

    it('should set sortBy and direction to asc on first sort', () => {
      store.setSort('amount');
      expect(store.sortBy()).toBe('amount');
      expect(store.sortDirection()).toBe('asc');
    });

    it('should toggle direction when clicking same column', () => {
      store.setSort('amount');
      expect(store.sortDirection()).toBe('asc');

      store.setSort('amount');
      expect(store.sortDirection()).toBe('desc');
    });

    it('should reset direction to asc when switching to new column', () => {
      store.setSort('amount');
      store.setSort('amount'); // now desc
      expect(store.sortDirection()).toBe('desc');

      store.setSort('date');
      expect(store.sortBy()).toBe('date');
      expect(store.sortDirection()).toBe('asc');
    });

    it('should include sortBy/sortDirection in currentFilters when set', () => {
      store.setSort('amount');
      const filters = store.currentFilters();
      expect(filters.sortBy).toBe('amount');
      expect(filters.sortDirection).toBe('asc');
    });

    it('should not include sort in currentFilters when sortBy is null', () => {
      const filters = store.currentFilters();
      expect(filters.sortBy).toBeUndefined();
      expect(filters.sortDirection).toBeUndefined();
    });

    it('should reload expenses on setSort', () => {
      store.setSort('date');
      // initialize called once in setup if any, plus setSort triggers loadExpenses
      expect(expenseServiceMock.getExpenses).toHaveBeenCalled();
    });
  });
});
