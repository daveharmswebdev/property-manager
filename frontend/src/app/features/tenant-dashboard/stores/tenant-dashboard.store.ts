import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  isSubmitting: boolean;
  submitError: string | null;
}

const initialState: TenantDashboardState = {
  property: null,
  requests: [],
  isLoading: false,
  error: null,
  totalCount: 0,
  page: 1,
  pageSize: 20,
  isSubmitting: false,
  submitError: null,
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
  withMethods(
    (store, tenantService = inject(TenantService), snackBar = inject(MatSnackBar)) => ({
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
          const page =
            params && typeof params === 'object' && 'page' in params
              ? (params.page ?? store.page())
              : store.page();
          const pageSize =
            params && typeof params === 'object' && 'pageSize' in params
              ? (params.pageSize ?? store.pageSize())
              : store.pageSize();
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

    /**
     * Submit a maintenance request (Story 20.6, Task 2.2).
     * Returns the new request ID on success, null on error.
     */
    async submitRequest(description: string): Promise<string | null> {
      patchState(store, { isSubmitting: true, submitError: null });

      try {
        const response = await firstValueFrom(
          tenantService.createMaintenanceRequest(description),
        );

        patchState(store, { isSubmitting: false });

        snackBar.open('Maintenance request submitted', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });

        return response.id;
      } catch (error) {
        patchState(store, {
          isSubmitting: false,
          submitError: 'Failed to submit request. Please try again.',
        });

        snackBar.open('Failed to submit request. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });

        console.error('Error submitting maintenance request:', error);
        return null;
      }
    },

    /**
     * Upload a photo for a maintenance request (Story 20.6, Task 2.3).
     * 3-step presigned URL flow: generate URL -> upload to S3 -> confirm upload.
     * Returns true on success, false on failure.
     */
    async uploadPhoto(requestId: string, file: File): Promise<boolean> {
      try {
        // Step 1: Get presigned URL
        const uploadUrlResponse = await firstValueFrom(
          tenantService.generatePhotoUploadUrl(
            requestId,
            file.type,
            file.size,
            file.name,
          ),
        );

        // Step 2: Upload to S3 via fetch (not HttpClient — avoids JWT header)
        const s3Response = await fetch(uploadUrlResponse.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        if (!s3Response.ok) {
          throw new Error(
            `S3 upload failed: ${s3Response.status} ${s3Response.statusText}`,
          );
        }

        // Step 3: Confirm upload
        await firstValueFrom(
          tenantService.confirmPhotoUpload(requestId, {
            storageKey: uploadUrlResponse.storageKey,
            thumbnailStorageKey: uploadUrlResponse.thumbnailStorageKey,
            contentType: file.type,
            fileSizeBytes: file.size,
            originalFileName: file.name,
          }),
        );

        return true;
      } catch (error) {
        console.error('Error uploading photo:', error);
        return false;
      }
    },

    /**
     * Clear submit error (Story 20.6, Task 2.4).
     */
    clearSubmitError(): void {
      patchState(store, { submitError: null });
    },
  }),
  ),
);
