import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import {
  MaintenanceRequestService,
  MaintenanceRequestDto,
  MaintenanceRequestQueryParams,
} from '../services/maintenance-request.service';

/**
 * All available maintenance request statuses (Story 20.7, AC #5, #6).
 */
export const ALL_REQUEST_STATUSES = ['Submitted', 'InProgress', 'Resolved', 'Dismissed'] as const;

const ALL_STATUSES_ARRAY: string[] = [...ALL_REQUEST_STATUSES];

/**
 * Helper: are filters currently active?
 *
 * Active when not all statuses are selected, or a property filter is applied.
 */
function areFiltersActive(selectedStatuses: string[], selectedPropertyId: string | null): boolean {
  const hasStatusFilter = selectedStatuses.length < ALL_STATUSES_ARRAY.length;
  const hasPropertyFilter = selectedPropertyId !== null;
  return hasStatusFilter || hasPropertyFilter;
}

/**
 * Encode the user's status selection into the single backend `status` query param.
 *
 * The backend `GetMaintenanceRequestsQuery.Status` only parses one status. When
 * the user selects exactly one status chip, send it. Otherwise send `undefined`
 * — see `docs/project/stories/epic-20/20-7-landlord-maintenance-request-inbox.md`
 * §"Status Filter Encoding (One-Status Constraint)".
 */
function encodeStatusParam(selectedStatuses: string[]): string | undefined {
  if (selectedStatuses.length === 1) {
    return selectedStatuses[0];
  }
  return undefined;
}

/**
 * Maintenance Request Store State (Story 20.7, AC #1, #4, #6, #7, #12).
 */
interface MaintenanceRequestState {
  requests: MaintenanceRequestDto[];
  selectedRequest: MaintenanceRequestDto | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  detailError: string | null;
  // Filter state (AC #6, #7)
  selectedStatuses: string[];
  selectedPropertyId: string | null;
  // Pagination (AC #4)
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const initialState: MaintenanceRequestState = {
  requests: [],
  selectedRequest: null,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  detailError: null,
  selectedStatuses: [...ALL_STATUSES_ARRAY],
  selectedPropertyId: null,
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
};

/**
 * Maintenance Request Store (Story 20.7).
 *
 * State management for the landlord maintenance request inbox using @ngrx/signals.
 * Mirrors `WorkOrderStore` patterns: rxMethod with switchMap + catchError → of(null).
 */
export const MaintenanceRequestStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /** True when not loading, list is empty, AND no filters are active (AC #9). */
    isEmpty: computed(
      () =>
        !store.isLoading() &&
        store.requests().length === 0 &&
        !areFiltersActive(store.selectedStatuses(), store.selectedPropertyId()),
    ),
    /** True when not loading, list is empty, AND filters are active (AC #8). */
    isFilteredEmpty: computed(
      () =>
        !store.isLoading() &&
        store.requests().length === 0 &&
        areFiltersActive(store.selectedStatuses(), store.selectedPropertyId()),
    ),
    /** True when any filter (status subset or property) is active. */
    hasActiveFilters: computed(() =>
      areFiltersActive(store.selectedStatuses(), store.selectedPropertyId()),
    ),
  })),
  withMethods((store, requestService = inject(MaintenanceRequestService)) => {
    function buildParams(overrides?: { page?: number; pageSize?: number }): MaintenanceRequestQueryParams {
      const status = encodeStatusParam(store.selectedStatuses());
      const propertyId = store.selectedPropertyId() ?? undefined;
      return {
        status,
        propertyId,
        page: overrides?.page ?? store.page(),
        pageSize: overrides?.pageSize ?? store.pageSize(),
      };
    }

    return {
      /**
       * Load the inbox with the current filter/pagination state.
       *
       * @param overrides Optional `{ page, pageSize }` to apply for this request.
       *                  When omitted, uses the store's current page/pageSize.
       */
      loadRequests: rxMethod<{ page?: number; pageSize?: number } | void>(
        pipe(
          tap((overrides) => {
            patchState(store, {
              isLoading: true,
              error: null,
              page: overrides?.page ?? store.page(),
              pageSize: overrides?.pageSize ?? store.pageSize(),
            });
          }),
          switchMap((overrides) =>
            requestService.getMaintenanceRequests(buildParams(overrides ?? undefined)).pipe(
              tap((response) =>
                patchState(store, {
                  requests: response.items,
                  totalCount: response.totalCount,
                  page: response.page,
                  pageSize: response.pageSize,
                  totalPages: response.totalPages,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load maintenance requests. Please try again.',
                });
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Load a single maintenance request by ID for the detail view.
       * 404 → `detailError = 'Maintenance request not found'`; other errors get a generic message.
       */
      loadRequestById: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoadingDetail: true,
              detailError: null,
              selectedRequest: null,
            }),
          ),
          switchMap((id) =>
            requestService.getMaintenanceRequestById(id).pipe(
              tap((request) =>
                patchState(store, {
                  selectedRequest: request,
                  isLoadingDetail: false,
                }),
              ),
              catchError((error: { status?: number }) => {
                const detailError =
                  error?.status === 404
                    ? 'Maintenance request not found'
                    : 'Failed to load maintenance request. Please try again.';
                patchState(store, {
                  isLoadingDetail: false,
                  detailError,
                });
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /**
       * Update the status filter and reload from page 1.
       *
       * Refuses an empty selection — matches `WorkOrderStore` UX so users can't
       * land on a "no statuses → unfiltered" state.
       */
      setStatusFilter(statuses: string[]): void {
        if (statuses.length === 0) {
          return;
        }
        patchState(store, { selectedStatuses: statuses, page: 1 });
        this.loadRequests();
      },

      /**
       * Update the property filter and reload from page 1.
       */
      setPropertyFilter(propertyId: string | null): void {
        patchState(store, { selectedPropertyId: propertyId, page: 1 });
        this.loadRequests();
      },

      /**
       * Reset all filters to defaults and reload from page 1.
       */
      clearFilters(): void {
        patchState(store, {
          selectedStatuses: [...ALL_STATUSES_ARRAY],
          selectedPropertyId: null,
          page: 1,
        });
        this.loadRequests();
      },

      /**
       * Update pagination (used by `mat-paginator`).
       *
       * @param page 1-based page number (the paginator's pageIndex + 1)
       * @param pageSize Items per page
       */
      setPage(page: number, pageSize: number): void {
        this.loadRequests({ page, pageSize });
      },

      /**
       * Clear the selected request and detail error — call on detail-page leave.
       */
      clearSelectedRequest(): void {
        patchState(store, {
          selectedRequest: null,
          detailError: null,
        });
      },
    };
  }),
);
