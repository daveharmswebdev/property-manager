import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, firstValueFrom, map } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ApiClient,
  VendorDto,
  VendorDetailDto,
  VendorTradeTagDto,
  CreateVendorRequest,
  UpdateVendorRequest,
} from '../../../core/api/api.service';

/**
 * Vendor Store State Interface (AC #1-#14)
 */
interface VendorState {
  vendors: VendorDto[];
  selectedVendor: VendorDetailDto | null;
  tradeTags: VendorTradeTagDto[];
  isLoading: boolean;
  isSaving: boolean;
  /** @deprecated Use deletingVendorId instead for per-vendor delete tracking */
  isDeleting: boolean;
  /** ID of the vendor currently being deleted, or null if none */
  deletingVendorId: string | null;
  error: string | null;
  // Filter state (Story 8-6)
  searchTerm: string;
  selectedTradeTagIds: string[];
}

/**
 * Initial state for vendor store
 */
const initialState: VendorState = {
  vendors: [],
  selectedVendor: null,
  tradeTags: [],
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  deletingVendorId: null,
  error: null,
  // Filter state (Story 8-6)
  searchTerm: '',
  selectedTradeTagIds: [],
};

/**
 * VendorStore (AC #1-#6)
 *
 * State management for vendors using @ngrx/signals.
 * Provides:
 * - Vendors list with loading/error states
 * - Methods to load and create vendors
 */
export const VendorStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Total count of vendors
     */
    totalCount: computed(() => store.vendors().length),

    /**
     * Whether the vendor list is empty (AC #2)
     */
    isEmpty: computed(() => !store.isLoading() && store.vendors().length === 0),

    /**
     * Whether we have vendors loaded (not loading and not empty)
     */
    hasVendors: computed(
      () => !store.isLoading() && store.vendors().length > 0
    ),

    /**
     * Filtered vendors based on search term and trade tag filters (Story 8-6 AC #1-#4)
     * Search matches first name, last name, or full name (case-insensitive)
     * Trade tag filter uses OR logic (vendor matches if they have ANY selected tag)
     * Combined filters use AND logic (must match both search AND tags)
     */
    filteredVendors: computed(() => {
      const vendors = store.vendors();
      const searchTerm = store.searchTerm().toLowerCase().trim();
      const selectedTagIds = store.selectedTradeTagIds();

      return vendors.filter((vendor) => {
        // Search filter: match first, last, or full name
        const matchesSearch =
          !searchTerm ||
          vendor.firstName?.toLowerCase().includes(searchTerm) ||
          vendor.lastName?.toLowerCase().includes(searchTerm) ||
          vendor.fullName?.toLowerCase().includes(searchTerm);

        // Trade tag filter: vendor must have at least one of selected tags (OR logic)
        const matchesTags =
          selectedTagIds.length === 0 ||
          (vendor.tradeTags?.some((tag: VendorTradeTagDto) => tag.id && selectedTagIds.includes(tag.id)) ??
            false);

        // AND logic: must match both
        return matchesSearch && matchesTags;
      });
    }),

    /**
     * Whether any filter is currently active (Story 8-6 AC #3)
     */
    hasActiveFilters: computed(
      () =>
        store.searchTerm().trim().length > 0 ||
        store.selectedTradeTagIds().length > 0
    ),
  })),
  // Second withComputed block so noMatchesFound can reference filteredVendors
  withComputed((store) => ({
    /**
     * Whether we have vendors but the filter returned empty results (Story 8-6 AC #4)
     * Distinct from isEmpty which means no vendors exist at all
     */
    noMatchesFound: computed(() => {
      const hasVendors = store.vendors().length > 0;
      const hasFilters = store.hasActiveFilters();

      // Use existing filteredVendors signal to avoid duplicating filter logic
      return hasVendors && hasFilters && store.filteredVendors().length === 0;
    }),
  })),
  withMethods(
    (
      store,
      apiService = inject(ApiClient),
      router = inject(Router),
      snackBar = inject(MatSnackBar)
    ) => ({
      /**
       * Load vendors from API (AC #1, #2)
       */
      loadVendors: rxMethod<void>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
            })
          ),
          switchMap(() =>
            apiService.vendors_GetAllVendors().pipe(
              tap((response) =>
                patchState(store, {
                  vendors: response.items ?? [],
                  isLoading: false,
                })
              ),
              catchError((error) => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load vendors. Please try again.',
                });
                console.error('Error loading vendors:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Create a new vendor (AC #3, #4)
       * @param request Vendor creation request with firstName, middleName?, lastName
       */
      createVendor: rxMethod<CreateVendorRequest>(
        pipe(
          tap(() =>
            patchState(store, {
              isSaving: true,
              error: null,
            })
          ),
          switchMap((request) =>
            apiService.vendors_CreateVendor(request).pipe(
              tap(() => {
                patchState(store, { isSaving: false });
                snackBar.open('Vendor added \u2713', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                // Navigate back to vendor list (AC #4)
                router.navigate(['/vendors']);
              }),
              catchError((error) => {
                let errorMessage =
                  'Failed to save vendor. Please try again.';
                if (error.status === 400) {
                  errorMessage =
                    'Invalid vendor data. Please check your input.';
                }
                patchState(store, {
                  isSaving: false,
                  error: errorMessage,
                });
                snackBar.open(errorMessage, 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error creating vendor:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Load a single vendor by ID (AC #10)
       * @param id Vendor ID to load
       */
      loadVendor: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedVendor: null,
            })
          ),
          switchMap((id) =>
            apiService.vendors_GetVendor(id).pipe(
              tap((vendor) =>
                patchState(store, {
                  selectedVendor: vendor,
                  isLoading: false,
                })
              ),
              catchError((error) => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load vendor. Please try again.',
                });
                console.error('Error loading vendor:', error);
                if (error.status === 404) {
                  router.navigate(['/vendors']);
                  snackBar.open('Vendor not found', 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                  });
                }
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Update an existing vendor (AC #12, #14, Story 8.9 AC #6)
       * @param params Object containing id and request
       */
      updateVendor: rxMethod<{ id: string; request: UpdateVendorRequest }>(
        pipe(
          tap(() =>
            patchState(store, {
              isSaving: true,
              error: null,
            })
          ),
          switchMap(({ id, request }) =>
            apiService.vendors_UpdateVendor(id, request).pipe(
              tap(() => {
                patchState(store, { isSaving: false });
                snackBar.open('Vendor updated \u2713', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                // Navigate to vendor detail page (Story 8.9 AC #6)
                router.navigate(['/vendors', id]);
              }),
              catchError((error) => {
                let errorMessage =
                  'Failed to update vendor. Please try again.';
                if (error.status === 400) {
                  errorMessage =
                    'Invalid vendor data. Please check your input.';
                } else if (error.status === 404) {
                  errorMessage = 'Vendor not found.';
                }
                patchState(store, {
                  isSaving: false,
                  error: errorMessage,
                });
                snackBar.open(errorMessage, 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error updating vendor:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Delete a vendor (soft delete) (FR12)
       * @param id Vendor ID to delete
       */
      deleteVendor: rxMethod<string>(
        pipe(
          tap((id) =>
            patchState(store, {
              isDeleting: true,
              deletingVendorId: id,
              error: null,
            })
          ),
          switchMap((id) =>
            apiService.vendors_DeleteVendor(id).pipe(
              tap(() => {
                // Remove from local vendors array
                patchState(store, {
                  vendors: store.vendors().filter((v) => v.id !== id),
                  isDeleting: false,
                  deletingVendorId: null,
                });
                snackBar.open('Vendor deleted \u2713', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
              }),
              catchError((error) => {
                let errorMessage = 'Failed to delete vendor. Please try again.';
                if (error.status === 404) {
                  errorMessage = 'Vendor not found.';
                }
                patchState(store, {
                  isDeleting: false,
                  deletingVendorId: null,
                  error: errorMessage,
                });
                snackBar.open(errorMessage, 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error deleting vendor:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Load all trade tags for autocomplete (AC #7)
       */
      loadTradeTags: rxMethod<void>(
        pipe(
          switchMap(() =>
            apiService.vendorTradeTags_GetAllVendorTradeTags().pipe(
              tap((response) =>
                patchState(store, {
                  tradeTags: response.items ?? [],
                })
              ),
              catchError((error) => {
                console.error('Error loading trade tags:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Create a new trade tag (AC #8)
       * @param name Name of the new trade tag
       * @returns Promise resolving to the created tag
       */
      async createTradeTag(name: string): Promise<VendorTradeTagDto | null> {
        try {
          const response = await firstValueFrom(
            apiService.vendorTradeTags_CreateVendorTradeTag({ name }).pipe(
              map((result) => {
                const newTag: VendorTradeTagDto = {
                  id: result.id,
                  name: name,
                };
                // Add to local cache
                patchState(store, {
                  tradeTags: [...store.tradeTags(), newTag],
                });
                return newTag;
              })
            )
          );
          return response;
        } catch (error) {
          console.error('Error creating trade tag:', error);
          snackBar.open('Failed to create trade tag', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
          return null;
        }
      },

      /**
       * Clear selected vendor
       */
      clearSelectedVendor(): void {
        patchState(store, { selectedVendor: null });
      },

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
       * Set search term for filtering vendors (Story 8-6 AC #1)
       * @param term Search text to filter by
       */
      setSearchTerm(term: string): void {
        patchState(store, { searchTerm: term });
      },

      /**
       * Set trade tag filter for filtering vendors (Story 8-6 AC #2)
       * @param tagIds Array of trade tag IDs to filter by
       */
      setTradeTagFilter(tagIds: string[]): void {
        patchState(store, { selectedTradeTagIds: tagIds });
      },

      /**
       * Clear all filters (Story 8-6 AC #3)
       */
      clearFilters(): void {
        patchState(store, { searchTerm: '', selectedTradeTagIds: [] });
      },
    })
  )
);
