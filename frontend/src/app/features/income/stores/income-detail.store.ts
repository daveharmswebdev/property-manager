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
  IncomeService,
  IncomeDto,
  UpdateIncomeRequest,
} from '../services/income.service';

/**
 * Income Detail Store State (AC-16.2.3, AC-16.2.4, AC-16.2.5)
 */
interface IncomeDetailState {
  income: IncomeDto | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isEditing: boolean;
  error: string | null;
}

const initialState: IncomeDetailState = {
  income: null,
  isLoading: false,
  isUpdating: false,
  isDeleting: false,
  isEditing: false,
  error: null,
};

/**
 * IncomeDetailStore (AC-16.2.3, AC-16.2.4, AC-16.2.5)
 *
 * State management for the income detail/edit page.
 * Manages single-income state with view/edit mode toggle.
 */
export const IncomeDetailStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isViewMode: computed(() => !store.isEditing()),
  })),
  withMethods((
    store,
    incomeService = inject(IncomeService),
    snackBar = inject(MatSnackBar),
    router = inject(Router),
  ) => ({
    loadIncome: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((incomeId) =>
          incomeService.getIncomeById(incomeId).pipe(
            tap((income) =>
              patchState(store, { income, isLoading: false })
            ),
            catchError((error) => {
              const errorMessage = error.status === 404
                ? 'Income not found.'
                : 'Failed to load income. Please try again.';
              patchState(store, { isLoading: false, error: errorMessage });
              return of(null);
            })
          )
        )
      )
    ),

    updateIncome: rxMethod<{ incomeId: string; request: UpdateIncomeRequest }>(
      pipe(
        tap(() => patchState(store, { isUpdating: true, error: null })),
        switchMap(({ incomeId, request }) =>
          incomeService.updateIncome(incomeId, request).pipe(
            switchMap(() => incomeService.getIncomeById(incomeId)),
            tap((income) => {
              patchState(store, {
                income,
                isUpdating: false,
                isEditing: false,
              });
              snackBar.open('Income updated \u2713', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            }),
            catchError((error) => {
              const errorMessage = error.status === 400
                ? 'Invalid income data. Please check your input.'
                : 'Failed to update income. Please try again.';
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

    deleteIncome: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isDeleting: true, error: null })),
        switchMap((incomeId) =>
          incomeService.deleteIncome(incomeId).pipe(
            tap(() => {
              patchState(store, { isDeleting: false });
              snackBar.open('Income deleted', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              router.navigate(['/income']);
            }),
            catchError((error) => {
              const errorMessage = error.status === 404
                ? 'Income not found.'
                : 'Failed to delete income. Please try again.';
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
