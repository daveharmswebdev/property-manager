import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  WorkOrderService,
  WorkOrderDto,
  CreateWorkOrderRequest,
} from '../services/work-order.service';

/**
 * Work Order Store State Interface
 */
interface WorkOrderState {
  workOrders: WorkOrderDto[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Initial state for work order store
 */
const initialState: WorkOrderState = {
  workOrders: [],
  isLoading: false,
  isSaving: false,
  error: null,
};

/**
 * WorkOrderStore
 *
 * State management for work orders using @ngrx/signals.
 * Provides:
 * - Work orders list with loading/error states
 * - Methods for CRUD operations
 */
export const WorkOrderStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Whether we have work orders loaded
     */
    hasWorkOrders: computed(() => !store.isLoading() && store.workOrders().length > 0),

    /**
     * Whether the work order list is empty
     */
    isEmpty: computed(() => !store.isLoading() && store.workOrders().length === 0),

    /**
     * Total work order count
     */
    workOrderCount: computed(() => store.workOrders().length),
  })),
  withMethods(
    (
      store,
      workOrderService = inject(WorkOrderService),
      snackBar = inject(MatSnackBar),
      router = inject(Router)
    ) => ({
      /**
       * Load all work orders
       */
      loadWorkOrders: rxMethod<{ status?: string; propertyId?: string } | void>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
            })
          ),
          switchMap((params) => {
            const status = params && 'status' in params ? params.status : undefined;
            const propertyId = params && 'propertyId' in params ? params.propertyId : undefined;

            return workOrderService.getWorkOrders(status, propertyId).pipe(
              tap((response) =>
                patchState(store, {
                  workOrders: response.items,
                  isLoading: false,
                })
              ),
              catchError((error) => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load work orders. Please try again.',
                });
                console.error('Error loading work orders:', error);
                return of(null);
              })
            );
          })
        )
      ),

      /**
       * Create a new work order (AC #1, #7)
       * On success:
       * - Shows snackbar confirmation
       * - Navigates to work order detail page
       */
      createWorkOrder: rxMethod<CreateWorkOrderRequest>(
        pipe(
          tap(() =>
            patchState(store, {
              isSaving: true,
              error: null,
            })
          ),
          switchMap((request) =>
            workOrderService.createWorkOrder(request).pipe(
              tap((response) => {
                patchState(store, {
                  isSaving: false,
                });

                // Show success snackbar (AC #7)
                snackBar.open('Work order created', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });

                // Navigate to work order detail page (AC #7)
                router.navigate(['/work-orders', response.id]);
              }),
              catchError((error) => {
                let errorMessage = 'Failed to create work order. Please try again.';
                if (error.status === 400) {
                  errorMessage = 'Invalid work order data. Please check your input.';
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

                console.error('Error creating work order:', error);
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
    })
  )
);
