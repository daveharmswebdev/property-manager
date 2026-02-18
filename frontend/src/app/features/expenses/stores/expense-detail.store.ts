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
import { Router } from '@angular/router';
import {
  ExpenseService,
  ExpenseDto,
  UpdateExpenseRequest,
} from '../services/expense.service';

/**
 * Expense Detail Store State (AC-15.5.2 through AC-15.5.5)
 */
interface ExpenseDetailState {
  expense: ExpenseDto | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isUnlinkingReceipt: boolean;
  isEditing: boolean;
  error: string | null;
}

const initialState: ExpenseDetailState = {
  expense: null,
  isLoading: false,
  isUpdating: false,
  isDeleting: false,
  isUnlinkingReceipt: false,
  isEditing: false,
  error: null,
};

/**
 * ExpenseDetailStore (AC-15.5.2 through AC-15.5.5)
 *
 * State management for the expense detail/edit page.
 * Manages single-expense state with view/edit mode toggle.
 */
export const ExpenseDetailStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasReceipt: computed(() => !!store.expense()?.receiptId),
    hasWorkOrder: computed(() => !!store.expense()?.workOrderId),
    isViewMode: computed(() => !store.isEditing()),
  })),
  withMethods((
    store,
    expenseService = inject(ExpenseService),
    snackBar = inject(MatSnackBar),
    router = inject(Router),
  ) => ({
    loadExpense: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((expenseId) =>
          expenseService.getExpense(expenseId).pipe(
            tap((expense) =>
              patchState(store, { expense, isLoading: false })
            ),
            catchError((error) => {
              const errorMessage = error.status === 404
                ? 'Expense not found.'
                : 'Failed to load expense. Please try again.';
              patchState(store, { isLoading: false, error: errorMessage });
              return of(null);
            })
          )
        )
      )
    ),

    updateExpense: rxMethod<{ expenseId: string; request: UpdateExpenseRequest }>(
      pipe(
        tap(() => patchState(store, { isUpdating: true, error: null })),
        switchMap(({ expenseId, request }) =>
          expenseService.updateExpense(expenseId, request).pipe(
            switchMap(() => expenseService.getExpense(expenseId)),
            tap((expense) => {
              patchState(store, {
                expense,
                isUpdating: false,
                isEditing: false,
              });
              snackBar.open('Expense updated \u2713', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError((error) => {
              const errorMessage = error.status === 400
                ? 'Invalid expense data. Please check your input.'
                : 'Failed to update expense. Please try again.';
              patchState(store, { isUpdating: false, error: errorMessage });
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              return of(null);
            })
          )
        )
      )
    ),

    deleteExpense: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isDeleting: true, error: null })),
        switchMap((expenseId) =>
          expenseService.deleteExpense(expenseId).pipe(
            tap(() => {
              patchState(store, { isDeleting: false });
              snackBar.open('Expense deleted', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              router.navigate(['/expenses']);
            }),
            catchError((error) => {
              const errorMessage = error.status === 404
                ? 'Expense not found.'
                : 'Failed to delete expense. Please try again.';
              patchState(store, { isDeleting: false, error: errorMessage });
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              return of(null);
            })
          )
        )
      )
    ),

    unlinkReceipt: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isUnlinkingReceipt: true, error: null })),
        switchMap((expenseId) =>
          expenseService.unlinkReceipt(expenseId).pipe(
            switchMap(() => expenseService.getExpense(expenseId)),
            tap((expense) => {
              patchState(store, { expense, isUnlinkingReceipt: false });
              snackBar.open('Receipt unlinked', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError(() => {
              const errorMessage = 'Failed to unlink receipt. Please try again.';
              patchState(store, { isUnlinkingReceipt: false, error: errorMessage });
              snackBar.open(errorMessage, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              return of(null);
            })
          )
        )
      )
    ),

    startEditing(): void {
      patchState(store, { isEditing: true });
    },

    cancelEditing(): void {
      patchState(store, { isEditing: false });
    },

    reset(): void {
      patchState(store, initialState);
    },
  }))
);
