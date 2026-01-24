import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  WorkOrderService,
  WorkOrderDto,
  WorkOrderTagDto,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
} from '../services/work-order.service';

/**
 * All available work order statuses
 */
const ALL_STATUSES = ['Reported', 'Assigned', 'Completed'];

/**
 * Helper to determine if filters are active
 * Extracted to avoid duplication between computed signals
 */
function areFiltersActive(selectedStatuses: string[], selectedPropertyId: string | null): boolean {
  const hasStatusFilter = selectedStatuses.length < ALL_STATUSES.length;
  const hasPropertyFilter = selectedPropertyId !== null;
  return hasStatusFilter || hasPropertyFilter;
}

/**
 * Work Order Store State Interface
 */
interface WorkOrderState {
  workOrders: WorkOrderDto[];
  tags: WorkOrderTagDto[];
  isLoading: boolean;
  isLoadingTags: boolean;
  isSaving: boolean;
  error: string | null;
  // Filter state (Story 9-7)
  selectedStatuses: string[];
  selectedPropertyId: string | null;
  // Detail view state (Story 9-8)
  selectedWorkOrder: WorkOrderDto | null;
  isLoadingDetail: boolean;
  detailError: string | null;
  // Edit/Delete state (Story 9-9)
  isUpdating: boolean;
  isDeleting: boolean;
}

/**
 * Initial state for work order store
 */
const initialState: WorkOrderState = {
  workOrders: [],
  tags: [],
  isLoading: false,
  isLoadingTags: false,
  isSaving: false,
  error: null,
  // Filter initial state - all statuses selected, no property filter (Story 9-7)
  selectedStatuses: [...ALL_STATUSES],
  selectedPropertyId: null,
  // Detail view initial state (Story 9-8)
  selectedWorkOrder: null,
  isLoadingDetail: false,
  detailError: null,
  // Edit/Delete initial state (Story 9-9)
  isUpdating: false,
  isDeleting: false,
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
     * Whether the work order list is empty (no filters applied)
     */
    isEmpty: computed(() => !store.isLoading() && store.workOrders().length === 0),

    /**
     * Total work order count
     */
    workOrderCount: computed(() => store.workOrders().length),

    /**
     * Whether any filters are currently active (Story 9-7, AC #5)
     * Active when: fewer than all statuses selected OR a property is selected
     */
    hasActiveFilters: computed(() =>
      areFiltersActive(store.selectedStatuses(), store.selectedPropertyId())
    ),

    /**
     * Whether the list is empty due to filtering (Story 9-7, AC #7)
     * True when: not loading, no work orders, and filters are active
     */
    isFilteredEmpty: computed(() =>
      !store.isLoading() &&
      store.workOrders().length === 0 &&
      areFiltersActive(store.selectedStatuses(), store.selectedPropertyId())
    ),

    /**
     * Whether a work order is selected for detail view (Story 9-8, AC #2)
     */
    hasSelectedWorkOrder: computed(() => store.selectedWorkOrder() !== null),
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
                  errorMessage = 'Property, category, or vendor not found.';
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

      /**
       * Set status filter and reload work orders (Story 9-7, AC #2)
       * @param statuses Array of status strings to filter by
       */
      setStatusFilter(statuses: string[]): void {
        // Prevent empty selection - require at least one status
        if (statuses.length === 0) {
          return;
        }
        patchState(store, { selectedStatuses: statuses });
        // Build comma-separated status string, undefined if all selected
        const statusParam = statuses.length < ALL_STATUSES.length ? statuses.join(',') : undefined;
        this.loadWorkOrders({ status: statusParam, propertyId: store.selectedPropertyId() ?? undefined });
      },

      /**
       * Set property filter and reload work orders (Story 9-7, AC #3)
       * @param propertyId Property ID or null for all properties
       */
      setPropertyFilter(propertyId: string | null): void {
        patchState(store, { selectedPropertyId: propertyId });
        const statusParam = store.selectedStatuses().length < ALL_STATUSES.length
          ? store.selectedStatuses().join(',')
          : undefined;
        this.loadWorkOrders({ status: statusParam, propertyId: propertyId ?? undefined });
      },

      /**
       * Clear all filters and reload work orders (Story 9-7, AC #6)
       */
      clearFilters(): void {
        patchState(store, {
          selectedStatuses: [...ALL_STATUSES],
          selectedPropertyId: null,
        });
        this.loadWorkOrders();
      },

      /**
       * Load all work order tags (AC #8)
       */
      loadTags: rxMethod<void>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoadingTags: true,
            })
          ),
          switchMap(() =>
            workOrderService.getWorkOrderTags().pipe(
              tap((response) =>
                patchState(store, {
                  tags: response.items,
                  isLoadingTags: false,
                })
              ),
              catchError((error) => {
                patchState(store, {
                  isLoadingTags: false,
                });
                console.error('Error loading work order tags:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Create a new work order tag (AC #10)
       * @returns Promise with new tag ID for immediate use
       */
      async createTag(name: string): Promise<string | null> {
        try {
          const response = await firstValueFrom(workOrderService.createWorkOrderTag({ name }));
          if (response) {
            // Add the new tag to the store immediately
            const newTag: WorkOrderTagDto = { id: response.id, name };
            patchState(store, {
              tags: [...store.tags(), newTag],
            });
            return response.id;
          }
          return null;
        } catch (error: any) {
          // Handle conflict (duplicate tag name)
          if (error.status === 409) {
            snackBar.open('A tag with that name already exists', 'Close', {
              duration: 3000,
            });
          } else {
            console.error('Error creating tag:', error);
            snackBar.open('Failed to create tag', 'Close', {
              duration: 3000,
            });
          }
          return null;
        }
      },

      /**
       * Load a single work order by ID (Story 9-8, AC #1, #2, #7)
       * @param id Work order GUID
       */
      loadWorkOrderById: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoadingDetail: true,
              detailError: null,
              selectedWorkOrder: null,
            })
          ),
          switchMap((id) =>
            workOrderService.getWorkOrder(id).pipe(
              tap((workOrder) =>
                patchState(store, {
                  selectedWorkOrder: workOrder,
                  isLoadingDetail: false,
                })
              ),
              catchError((error) => {
                const errorMessage =
                  error.status === 404
                    ? 'Work order not found'
                    : 'Failed to load work order. Please try again.';
                patchState(store, {
                  isLoadingDetail: false,
                  detailError: errorMessage,
                });
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Clear the selected work order (Story 9-8)
       * Used when leaving detail view to clean up state
       */
      clearSelectedWorkOrder(): void {
        patchState(store, {
          selectedWorkOrder: null,
          detailError: null,
        });
      },

      /**
       * Update an existing work order (Story 9-9, AC #3)
       * On success:
       * - Shows snackbar confirmation
       * - Navigates to work order detail page
       */
      updateWorkOrder: rxMethod<{ id: string; data: UpdateWorkOrderRequest }>(
        pipe(
          tap(() =>
            patchState(store, {
              isUpdating: true,
              error: null,
            })
          ),
          switchMap(({ id, data }) =>
            workOrderService.updateWorkOrder(id, data).pipe(
              tap(() => {
                patchState(store, {
                  isUpdating: false,
                });

                // Show success snackbar (AC #3)
                snackBar.open('Work order updated', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });

                // Navigate to work order detail page (AC #3)
                router.navigate(['/work-orders', id]);
              }),
              catchError((error) => {
                let errorMessage = 'Failed to update work order. Please try again.';
                if (error.status === 400) {
                  errorMessage = 'Invalid work order data. Please check your input.';
                } else if (error.status === 404) {
                  errorMessage = 'Work order, category, or vendor not found.';
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

                console.error('Error updating work order:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Delete a work order (soft delete) (Story 9-9, AC #6)
       * On success:
       * - Shows snackbar confirmation
       * - Navigates to work orders dashboard
       * - Refreshes work orders list
       */
      deleteWorkOrder: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isDeleting: true,
              error: null,
            })
          ),
          switchMap((id) =>
            workOrderService.deleteWorkOrder(id).pipe(
              tap(() => {
                patchState(store, {
                  isDeleting: false,
                  selectedWorkOrder: null,
                });

                // Show success snackbar (AC #6)
                snackBar.open('Work order deleted', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });

                // Navigate to work orders dashboard (AC #6)
                router.navigate(['/work-orders']);
              }),
              catchError((error) => {
                let errorMessage = 'Failed to delete work order. Please try again.';
                if (error.status === 404) {
                  errorMessage = 'Work order not found.';
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

                console.error('Error deleting work order:', error);
                return of(null);
              })
            )
          )
        )
      ),
    })
  )
);
