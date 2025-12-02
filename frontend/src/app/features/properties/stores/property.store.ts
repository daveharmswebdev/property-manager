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
import {
  PropertyService,
  PropertySummaryDto,
} from '../services/property.service';

/**
 * Property Store State Interface
 */
interface PropertyState {
  properties: PropertySummaryDto[];
  isLoading: boolean;
  error: string | null;
  selectedYear: number | null;
}

/**
 * Initial state for property store
 */
const initialState: PropertyState = {
  properties: [],
  isLoading: false,
  error: null,
  selectedYear: null,
};

/**
 * PropertyStore (AC-2.2.2, AC-2.2.4)
 *
 * State management for properties using @ngrx/signals.
 * Provides:
 * - Properties list with loading/error states
 * - Computed signals for totals (expense, income, net)
 * - Method to load properties from API
 */
export const PropertyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Total count of properties
     */
    totalCount: computed(() => store.properties().length),

    /**
     * Sum of all property expense totals
     */
    totalExpenses: computed(() =>
      store.properties().reduce((sum, p) => sum + p.expenseTotal, 0)
    ),

    /**
     * Sum of all property income totals
     */
    totalIncome: computed(() =>
      store.properties().reduce((sum, p) => sum + p.incomeTotal, 0)
    ),

    /**
     * Net income (total income - total expenses)
     */
    netIncome: computed(() => {
      const income = store
        .properties()
        .reduce((sum, p) => sum + p.incomeTotal, 0);
      const expenses = store
        .properties()
        .reduce((sum, p) => sum + p.expenseTotal, 0);
      return income - expenses;
    }),

    /**
     * Whether the property list is empty
     */
    isEmpty: computed(() => store.properties().length === 0),

    /**
     * Whether we have properties loaded (not loading and not empty)
     */
    hasProperties: computed(
      () => !store.isLoading() && store.properties().length > 0
    ),
  })),
  withMethods((store, propertyService = inject(PropertyService)) => ({
    /**
     * Load properties from API
     * @param year Optional tax year filter
     */
    loadProperties: rxMethod<number | undefined>(
      pipe(
        tap(() =>
          patchState(store, {
            isLoading: true,
            error: null,
          })
        ),
        switchMap((year) =>
          propertyService.getProperties(year).pipe(
            tap((response) =>
              patchState(store, {
                properties: response.items,
                isLoading: false,
                selectedYear: year ?? null,
              })
            ),
            catchError((error) => {
              patchState(store, {
                isLoading: false,
                error: 'Failed to load properties. Please try again.',
              });
              console.error('Error loading properties:', error);
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
      patchState(store, initialState);
    },

    /**
     * Set selected year filter
     */
    setSelectedYear(year: number | null): void {
      patchState(store, { selectedYear: year });
    },
  }))
);
