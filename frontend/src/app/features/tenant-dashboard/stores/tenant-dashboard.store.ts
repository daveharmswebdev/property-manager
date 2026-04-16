import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import {
  TenantService,
  TenantPropertyDto,
  MaintenanceRequestDto,
} from '../services/tenant.service';

/**
 * Tenant Dashboard Store State
 */
interface TenantDashboardState {
  property: TenantPropertyDto | null;
  requests: MaintenanceRequestDto[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
}

const initialState: TenantDashboardState = {
  property: null,
  requests: [],
  isLoading: false,
  error: null,
  totalCount: 0,
  page: 1,
  pageSize: 20,
};

/**
 * Tenant Dashboard Store (Story 20.5, AC #2, #3, #4)
 *
 * Signal store for tenant dashboard state:
 * - Property info (read-only)
 * - Maintenance request list with pagination
 * - Loading/error states
 */
export const TenantDashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalPages: computed(() => {
      const ps = store.pageSize();
      const tc = store.totalCount();
      return ps > 0 ? Math.ceil(tc / ps) : 0;
    }),
    isEmpty: computed(() => store.requests().length === 0 && !store.isLoading()),
    propertyAddress: computed(() => {
      const p = store.property();
      if (!p) return '';
      return `${p.street}, ${p.city}, ${p.state} ${p.zipCode}`;
    }),
    isPropertyLoaded: computed(() => store.property() !== null),
  })),
  withMethods((store, tenantService = inject(TenantService)) => ({
    loadProperty: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          tenantService.getTenantProperty().pipe(
            tap((property) => patchState(store, { property, isLoading: false })),
            catchError((error) => {
              patchState(store, {
                isLoading: false,
                error: 'Failed to load property information.',
              });
              console.error('Error loading tenant property:', error);
              return of(null);
            }),
          ),
        ),
      ),
    ),

    loadRequests: rxMethod<{ page?: number; pageSize?: number } | void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((params) => {
          const page = (params && typeof params === 'object' && 'page' in params) ? params.page ?? store.page() : store.page();
          const pageSize = (params && typeof params === 'object' && 'pageSize' in params) ? params.pageSize ?? store.pageSize() : store.pageSize();
          return tenantService.getMaintenanceRequests(page, pageSize).pipe(
            tap((response) =>
              patchState(store, {
                requests: response.items,
                totalCount: response.totalCount,
                page: response.page,
                pageSize: response.pageSize,
                isLoading: false,
              }),
            ),
            catchError((error) => {
              patchState(store, {
                isLoading: false,
                error: 'Failed to load maintenance requests.',
              });
              console.error('Error loading maintenance requests:', error);
              return of(null);
            }),
          );
        }),
      ),
    ),
  })),
);
