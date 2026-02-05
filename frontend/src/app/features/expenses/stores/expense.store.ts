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
  ExpenseService,
  ExpenseDto,
  ExpenseCategoryDto,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from '../services/expense.service';

/**
 * localStorage key for expense workspace page size persistence (AC-7.5.4)
 */
const PAGE_SIZE_STORAGE_KEY = 'propertyManager.expenseWorkspace.pageSize';

/**
 * Default page size for expense workspace
 */
const DEFAULT_PAGE_SIZE = 25;

/**
 * Read page size from localStorage, defaulting to 25 (AC-7.5.4)
 */
function getStoredPageSize(): number {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PAGE_SIZE;
  }
  const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_PAGE_SIZE;
  }
  const parsed = parseInt(stored, 10);
  // Validate it's a valid page size option
  if ([10, 25, 50].includes(parsed)) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

/**
 * Expense Store State Interface (AC-3.1.6, AC-3.1.7, AC-3.1.8, AC-3.2, AC-3.3, AC-7.5)
 */
interface ExpenseState {
  expenses: ExpenseDto[];
  categories: ExpenseCategoryDto[];
  currentPropertyId: string | null;
  currentPropertyName: string | null;
  currentYear: number | null;
  ytdTotal: number;
  isLoading: boolean;
  isSaving: boolean;
  isLoadingCategories: boolean;
  error: string | null;
  categoriesLoaded: boolean;
  // Edit state (AC-3.2)
  editingExpenseId: string | null;
  isUpdating: boolean;
  // Delete state (AC-3.3)
  isDeleting: boolean;
  // Pagination state (AC-7.5.1, AC-7.5.2, AC-7.5.3)
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Initial state for expense store
 */
const initialState: ExpenseState = {
  expenses: [],
  categories: [],
  currentPropertyId: null,
  currentPropertyName: null,
  currentYear: null,
  ytdTotal: 0,
  isLoading: false,
  isSaving: false,
  isLoadingCategories: false,
  error: null,
  categoriesLoaded: false,
  // Edit state (AC-3.2)
  editingExpenseId: null,
  isUpdating: false,
  // Delete state (AC-3.3)
  isDeleting: false,
  // Pagination state (AC-7.5.1, AC-7.5.2, AC-7.5.3)
  page: 1,
  pageSize: getStoredPageSize(),
  totalCount: 0,
  totalPages: 1,
};

/**
 * ExpenseStore (AC-3.1.6, AC-3.1.7, AC-3.1.8)
 *
 * State management for expenses using @ngrx/signals.
 * Provides:
 * - Expenses list with loading/error states
 * - Expense categories (cached)
 * - Methods for CRUD operations
 * - Automatic local state updates on create
 */
export const ExpenseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Expenses for current property, sorted by date (newest first)
     */
    expensesForCurrentProperty: computed(() =>
      store.expenses().filter((e) => e.propertyId === store.currentPropertyId())
    ),

    /**
     * Categories sorted by sortOrder
     */
    sortedCategories: computed(() =>
      [...store.categories()].sort((a, b) => a.sortOrder - b.sortOrder)
    ),

    /**
     * Total expense count for current property
     */
    expenseCount: computed(() => store.expenses().length),

    /**
     * Whether we have expenses loaded
     */
    hasExpenses: computed(() => !store.isLoading() && store.expenses().length > 0),

    /**
     * Whether we have categories loaded
     */
    hasCategories: computed(() => store.categories().length > 0),

    /**
     * Whether the expense list is empty
     */
    isEmpty: computed(() => !store.isLoading() && store.expenses().length === 0),

    /**
     * The expense currently being edited (AC-3.2.2)
     */
    editingExpense: computed(() => {
      const editingId = store.editingExpenseId();
      if (!editingId) return null;
      return store.expenses().find((e) => e.id === editingId) ?? null;
    }),

    /**
     * Whether any expense is currently being edited (AC-3.2.1)
     */
    isEditing: computed(() => store.editingExpenseId() !== null),
  })),
  withMethods((store, expenseService = inject(ExpenseService), snackBar = inject(MatSnackBar)) => ({
    /**
     * Load expense categories (AC-3.1.4)
     * Categories are cached - only loads if not already loaded
     */
    loadCategories: rxMethod<void>(
      pipe(
        tap(() => {
          // Skip if already loaded
          if (store.categoriesLoaded()) {
            return;
          }
          patchState(store, {
            isLoadingCategories: true,
            error: null,
          });
        }),
        switchMap(() => {
          // Skip API call if already loaded
          if (store.categoriesLoaded()) {
            return of(null);
          }
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
     * Load expenses for a property with pagination (AC-3.1.7, AC-7.5.1, AC-7.5.3)
     * Uses current page and pageSize from store state.
     * @param params Object with propertyId, propertyName, and optional year
     */
    loadExpensesByProperty: rxMethod<{
      propertyId: string;
      propertyName: string;
      year?: number;
    }>(
      pipe(
        tap(({ propertyId, propertyName, year }) =>
          patchState(store, {
            isLoading: true,
            error: null,
            currentPropertyId: propertyId,
            currentPropertyName: propertyName,
            currentYear: year ?? null,
          })
        ),
        switchMap(({ propertyId, year }) =>
          expenseService.getExpensesByProperty(propertyId, year, store.page(), store.pageSize()).pipe(
            tap((response) =>
              patchState(store, {
                expenses: response.items,
                ytdTotal: response.ytdTotal,
                totalCount: response.totalCount,
                page: response.page,
                totalPages: response.totalPages,
                isLoading: false,
              })
            ),
            catchError((error) => {
              const errorMessage =
                error.status === 404
                  ? 'Property not found'
                  : 'Failed to load expenses. Please try again.';
              patchState(store, {
                isLoading: false,
                error: errorMessage,
              });
              console.error('Error loading expenses:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Create a new expense (AC-3.1.6, AC-3.1.7, AC-3.1.8)
     * On success:
     * - Prepends expense to list
     * - Updates YTD total
     * - Shows snackbar confirmation
     * @param request Expense details
     */
    createExpense: rxMethod<CreateExpenseRequest>(
      pipe(
        tap(() =>
          patchState(store, {
            isSaving: true,
            error: null,
          })
        ),
        switchMap((request) =>
          expenseService.createExpense(request).pipe(
            tap((response) => {
              // Create a new expense DTO for local state
              const category = store.categories().find((c) => c.id === request.categoryId);
              const newExpense: ExpenseDto = {
                id: response.id,
                propertyId: request.propertyId,
                propertyName: store.currentPropertyName() || '',
                categoryId: request.categoryId,
                categoryName: category?.name || '',
                scheduleELine: category?.scheduleELine,
                amount: request.amount,
                date: request.date,
                description: request.description,
                workOrderId: request.workOrderId ?? undefined, // AC-11.2.4
                createdAt: new Date().toISOString(),
              };

              // Prepend to expenses list and update YTD total (AC-3.1.7)
              // Also update totalCount for pagination (AC-7.5.3)
              const currentExpenses = store.expenses();
              const currentYtdTotal = store.ytdTotal();
              const newTotalCount = store.totalCount() + 1;
              const newTotalPages = Math.ceil(newTotalCount / store.pageSize());
              patchState(store, {
                expenses: [newExpense, ...currentExpenses],
                ytdTotal: currentYtdTotal + request.amount,
                totalCount: newTotalCount,
                totalPages: newTotalPages,
                isSaving: false,
              });

              // Show success snackbar (AC-3.1.6)
              snackBar.open('Expense saved \u2713', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError((error) => {
              let errorMessage = 'Failed to save expense. Please try again.';
              if (error.status === 400) {
                errorMessage = 'Invalid expense data. Please check your input.';
              } else if (error.status === 404) {
                errorMessage = 'Property or category not found.';
              }

              patchState(store, {
                isSaving: false,
                error: errorMessage,
              });

              // Show error snackbar
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });

              console.error('Error creating expense:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Clear the error state
     */
    clearError(): void {
      patchState(store, { error: null });
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

    /**
     * Set current property context (AC-7.5.5)
     * Resets page to 1 when property changes.
     */
    setCurrentProperty(propertyId: string, propertyName: string): void {
      // Reset page to 1 when property changes (AC-7.5.5)
      patchState(store, {
        currentPropertyId: propertyId,
        currentPropertyName: propertyName,
        page: 1, // Reset pagination when property changes
      });
    },

    /**
     * Go to a specific page (AC-7.5.3)
     * Uses rxMethod for proper request cancellation and loading state.
     */
    goToPage: rxMethod<number>(
      pipe(
        tap((page) => {
          const propertyId = store.currentPropertyId();
          if (!propertyId) {
            console.warn('Cannot go to page: no property selected');
            return;
          }
          patchState(store, { page, isLoading: true, error: null });
        }),
        switchMap((page) => {
          const propertyId = store.currentPropertyId();
          const year = store.currentYear();

          if (!propertyId) {
            return of(null);
          }

          return expenseService.getExpensesByProperty(propertyId, year ?? undefined, page, store.pageSize()).pipe(
            tap((response) => {
              if (response) {
                patchState(store, {
                  expenses: response.items,
                  ytdTotal: response.ytdTotal,
                  totalCount: response.totalCount,
                  page: response.page,
                  totalPages: response.totalPages,
                  isLoading: false,
                });
              }
            }),
            catchError((error) => {
              console.error('Error loading expenses:', error);
              patchState(store, {
                isLoading: false,
                error: 'Failed to load expenses. Please try again.',
              });
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Set page size and persist to localStorage (AC-7.5.2, AC-7.5.4)
     * Resets to page 1 when page size changes.
     * Uses rxMethod for proper request cancellation and loading state.
     * @param pageSize The new page size (10, 25, or 50)
     */
    setPageSize: rxMethod<number>(
      pipe(
        tap((pageSize) => {
          // Validate pageSize is one of the allowed values
          if (![10, 25, 50].includes(pageSize)) {
            console.warn(`Invalid pageSize ${pageSize}, must be 10, 25, or 50`);
            return;
          }

          // Persist to localStorage (AC-7.5.4)
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(PAGE_SIZE_STORAGE_KEY, pageSize.toString());
          }

          // Reset to page 1 when page size changes
          patchState(store, { pageSize, page: 1, isLoading: true, error: null });
        }),
        switchMap((pageSize) => {
          // Validate pageSize is one of the allowed values
          if (![10, 25, 50].includes(pageSize)) {
            return of(null);
          }

          const propertyId = store.currentPropertyId();
          const year = store.currentYear();

          if (!propertyId) {
            patchState(store, { isLoading: false });
            return of(null); // No property selected, just update state
          }

          return expenseService.getExpensesByProperty(propertyId, year ?? undefined, 1, pageSize).pipe(
            tap((response) => {
              if (response) {
                patchState(store, {
                  expenses: response.items,
                  ytdTotal: response.ytdTotal,
                  totalCount: response.totalCount,
                  page: response.page,
                  totalPages: response.totalPages,
                  isLoading: false,
                });
              }
            }),
            catchError((error) => {
              console.error('Error loading expenses:', error);
              patchState(store, {
                isLoading: false,
                error: 'Failed to load expenses. Please try again.',
              });
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Start editing an expense (AC-3.2.1)
     * @param expenseId The expense ID to edit
     */
    startEditing(expenseId: string): void {
      patchState(store, {
        editingExpenseId: expenseId,
        error: null,
      });
    },

    /**
     * Cancel editing (AC-3.2.5)
     */
    cancelEditing(): void {
      patchState(store, {
        editingExpenseId: null,
        error: null,
      });
    },

    /**
     * Update an expense (AC-3.2.3, AC-3.2.4)
     * On success:
     * - Updates expense in list
     * - Updates YTD total if amount changed
     * - Shows snackbar confirmation
     * - Exits edit mode
     */
    updateExpense: rxMethod<{ expenseId: string; request: UpdateExpenseRequest }>(
      pipe(
        tap(() =>
          patchState(store, {
            isUpdating: true,
            error: null,
          })
        ),
        switchMap(({ expenseId, request }) =>
          expenseService.updateExpense(expenseId, request).pipe(
            tap(() => {
              // Get the original expense to calculate YTD difference
              const originalExpense = store.expenses().find((e) => e.id === expenseId);
              const amountDifference = originalExpense
                ? request.amount - originalExpense.amount
                : 0;

              // Get category details for the updated expense
              const category = store.categories().find((c) => c.id === request.categoryId);

              // Update the expense in the list (AC-3.2.4)
              const updatedExpenses = store.expenses().map((expense) => {
                if (expense.id !== expenseId) return expense;
                return {
                  ...expense,
                  amount: request.amount,
                  date: request.date,
                  categoryId: request.categoryId,
                  categoryName: category?.name || expense.categoryName,
                  scheduleELine: category?.scheduleELine,
                  description: request.description,
                  workOrderId: request.workOrderId ?? undefined, // AC-11.2.5
                };
              });

              patchState(store, {
                expenses: updatedExpenses,
                ytdTotal: store.ytdTotal() + amountDifference,
                isUpdating: false,
                editingExpenseId: null,
              });

              // Show success snackbar (AC-3.2.4)
              snackBar.open('Expense updated \u2713', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError((error) => {
              let errorMessage = 'Failed to update expense. Please try again.';
              if (error.status === 400) {
                errorMessage = 'Invalid expense data. Please check your input.';
              } else if (error.status === 404) {
                errorMessage = 'Expense or category not found.';
              }

              patchState(store, {
                isUpdating: false,
                error: errorMessage,
              });

              // Show error snackbar
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });

              console.error('Error updating expense:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Delete an expense (AC-3.3.3, AC-3.3.4, AC-3.3.5)
     * On success:
     * - Removes expense from list
     * - Updates YTD total
     * - Shows snackbar confirmation
     */
    deleteExpense: rxMethod<string>(
      pipe(
        tap(() =>
          patchState(store, {
            isDeleting: true,
            error: null,
          })
        ),
        switchMap((expenseId) => {
          // Get the expense before deleting to know the amount to subtract
          const expenseToDelete = store.expenses().find((e) => e.id === expenseId);

          return expenseService.deleteExpense(expenseId).pipe(
            tap(() => {
              // Remove expense from list (AC-3.3.5)
              const updatedExpenses = store.expenses().filter((e) => e.id !== expenseId);

              // Calculate new YTD total (AC-3.3.5)
              const deletedAmount = expenseToDelete?.amount || 0;
              const newYtdTotal = store.ytdTotal() - deletedAmount;

              // Update totalCount for pagination (AC-7.5.3)
              const newTotalCount = Math.max(0, store.totalCount() - 1);
              const newTotalPages = Math.max(1, Math.ceil(newTotalCount / store.pageSize()));

              patchState(store, {
                expenses: updatedExpenses,
                ytdTotal: newYtdTotal,
                totalCount: newTotalCount,
                totalPages: newTotalPages,
                isDeleting: false,
              });

              // Show success snackbar (AC-3.3.4)
              snackBar.open('Expense deleted', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError((error) => {
              let errorMessage = 'Failed to delete expense. Please try again.';
              if (error.status === 404) {
                errorMessage = 'Expense not found.';
              }

              patchState(store, {
                isDeleting: false,
                error: errorMessage,
              });

              // Show error snackbar
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });

              console.error('Error deleting expense:', error);
              return of(null);
            })
          );
        })
      )
    ),
  }))
);
