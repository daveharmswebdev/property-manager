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
} from '../services/expense.service';

/**
 * Expense Store State Interface (AC-3.1.6, AC-3.1.7, AC-3.1.8)
 */
interface ExpenseState {
  expenses: ExpenseDto[];
  categories: ExpenseCategoryDto[];
  currentPropertyId: string | null;
  currentPropertyName: string | null;
  ytdTotal: number;
  isLoading: boolean;
  isSaving: boolean;
  isLoadingCategories: boolean;
  error: string | null;
  categoriesLoaded: boolean;
}

/**
 * Initial state for expense store
 */
const initialState: ExpenseState = {
  expenses: [],
  categories: [],
  currentPropertyId: null,
  currentPropertyName: null,
  ytdTotal: 0,
  isLoading: false,
  isSaving: false,
  isLoadingCategories: false,
  error: null,
  categoriesLoaded: false,
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
     * Load expenses for a property (AC-3.1.7)
     * @param params Object with propertyId, propertyName, and optional year
     */
    loadExpensesByProperty: rxMethod<{
      propertyId: string;
      propertyName: string;
      year?: number;
    }>(
      pipe(
        tap(({ propertyId, propertyName }) =>
          patchState(store, {
            isLoading: true,
            error: null,
            currentPropertyId: propertyId,
            currentPropertyName: propertyName,
          })
        ),
        switchMap(({ propertyId, year }) =>
          expenseService.getExpensesByProperty(propertyId, year).pipe(
            tap((response) =>
              patchState(store, {
                expenses: response.items,
                ytdTotal: response.ytdTotal,
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
                createdAt: new Date().toISOString(),
              };

              // Prepend to expenses list and update YTD total (AC-3.1.7)
              const currentExpenses = store.expenses();
              const currentYtdTotal = store.ytdTotal();
              patchState(store, {
                expenses: [newExpense, ...currentExpenses],
                ytdTotal: currentYtdTotal + request.amount,
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
     * Set current property context
     */
    setCurrentProperty(propertyId: string, propertyName: string): void {
      patchState(store, {
        currentPropertyId: propertyId,
        currentPropertyName: propertyName,
      });
    },
  }))
);
