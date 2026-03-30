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
import { ApiClient, VendorPhotoDto } from '../../../core/api/api.service';
import { PhotoUploadService } from '../../../shared/services/photo-upload.service';
import { PhotoEntityType } from '../../../core/api/api.service';

/**
 * Vendor Photo Store State Interface
 */
interface VendorPhotoState {
  /** Current vendor ID */
  vendorId: string | null;
  /** List of photos for the vendor */
  photos: VendorPhotoDto[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Upload in progress */
  isUploading: boolean;
  /** Upload progress (0-100) */
  uploadProgress: number;
  /** Upload error */
  uploadError: string | null;
}

/**
 * Initial state for vendor photo store
 */
const initialState: VendorPhotoState = {
  vendorId: null,
  photos: [],
  isLoading: false,
  error: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
};

/**
 * VendorPhotoStore
 *
 * State management for vendor photos using @ngrx/signals.
 * Mirrors PropertyPhotoStore pattern exactly.
 */
export const VendorPhotoStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Total count of photos
     */
    photoCount: computed(() => store.photos().length),

    /**
     * Whether the vendor has any photos
     */
    hasPhotos: computed(() => store.photos().length > 0),

    /**
     * Whether the gallery is empty
     */
    isEmpty: computed(() => !store.isLoading() && store.photos().length === 0),

    /**
     * Primary photo (if any)
     */
    primaryPhoto: computed(() => store.photos().find((p) => p.isPrimary)),

    /**
     * Photos sorted by display order
     */
    sortedPhotos: computed(() =>
      [...store.photos()].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    ),
  })),
  withMethods(
    (
      store,
      apiClient = inject(ApiClient),
      snackBar = inject(MatSnackBar),
      photoUploadService = inject(PhotoUploadService)
    ) => ({
      /**
       * Load photos for a vendor
       */
      loadPhotos: rxMethod<string>(
        pipe(
          tap((vendorId) =>
            patchState(store, {
              vendorId,
              isLoading: true,
              error: null,
            })
          ),
          switchMap((vendorId) =>
            apiClient.vendorPhotos_GetPhotos(vendorId).pipe(
              tap((response) =>
                patchState(store, {
                  photos: response.items ?? [],
                  isLoading: false,
                })
              ),
              catchError((error) => {
                const errorMessage =
                  error.status === 404
                    ? 'Vendor not found'
                    : 'Failed to load photos. Please try again.';
                patchState(store, {
                  isLoading: false,
                  error: errorMessage,
                });
                console.error('Error loading vendor photos:', error);
                return of(null);
              })
            )
          )
        )
      ),

      /**
       * Upload a photo for the current vendor
       */
      async uploadPhoto(file: File): Promise<boolean> {
        const vendorId = store.vendorId();
        if (!vendorId) {
          console.error('No vendor ID set for photo upload');
          return false;
        }

        patchState(store, {
          isUploading: true,
          uploadProgress: 0,
          uploadError: null,
        });

        try {
          // First, get presigned URL from vendor photos endpoint
          const uploadUrlResponse = await apiClient
            .vendorPhotos_GenerateUploadUrl(vendorId, {
              contentType: file.type,
              fileSizeBytes: file.size,
              originalFileName: file.name,
            })
            .toPromise();

          if (!uploadUrlResponse?.uploadUrl || !uploadUrlResponse?.storageKey) {
            throw new Error('Failed to get upload URL');
          }

          patchState(store, { uploadProgress: 10 });

          // Upload to S3 using the photo upload service
          const uploadResult = await photoUploadService.uploadPhoto(file, {
            entityType: PhotoEntityType.Vendors,
            entityId: vendorId,
            onProgress: (percent) => {
              patchState(store, { uploadProgress: 10 + Math.round(percent * 0.7) });
            },
          });

          patchState(store, { uploadProgress: 80 });

          // Confirm the upload with the vendor photos endpoint
          await apiClient
            .vendorPhotos_ConfirmUpload(vendorId, {
              storageKey: uploadResult.storageKey,
              thumbnailStorageKey: uploadResult.thumbnailStorageKey ?? undefined,
              contentType: uploadResult.contentType,
              fileSizeBytes: uploadResult.fileSizeBytes,
              originalFileName: file.name,
            })
            .toPromise();

          patchState(store, {
            isUploading: false,
            uploadProgress: 100,
          });

          // Refresh photos list
          this.loadPhotos(vendorId);

          snackBar.open('Photo uploaded successfully', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });

          return true;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Upload failed. Please try again.';
          patchState(store, {
            isUploading: false,
            uploadProgress: 0,
            uploadError: errorMessage,
          });

          snackBar.open(errorMessage, 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });

          console.error('Error uploading photo:', error);
          return false;
        }
      },

      /**
       * Delete a photo
       */
      deletePhoto: rxMethod<string>(
        pipe(
          switchMap((photoId) => {
            const vendorId = store.vendorId();
            if (!vendorId) {
              console.error('No vendor ID set');
              return of(null);
            }

            return apiClient.vendorPhotos_DeletePhoto(vendorId, photoId).pipe(
              tap(() => {
                patchState(store, {
                  photos: store.photos().filter((p) => p.id !== photoId),
                });

                snackBar.open('Photo deleted', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
              }),
              catchError((error) => {
                snackBar.open('Failed to delete photo', 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error deleting photo:', error);
                return of(null);
              })
            );
          })
        )
      ),

      /**
       * Set a photo as primary
       */
      setPrimaryPhoto: rxMethod<string>(
        pipe(
          switchMap((photoId) => {
            const vendorId = store.vendorId();
            if (!vendorId) {
              console.error('No vendor ID set');
              return of(null);
            }

            return apiClient.vendorPhotos_SetPrimaryPhoto(vendorId, photoId).pipe(
              tap(() => {
                patchState(store, {
                  photos: store.photos().map((p) => ({
                    ...p,
                    isPrimary: p.id === photoId,
                  })),
                });

                snackBar.open('Primary photo updated', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
              }),
              catchError((error) => {
                snackBar.open('Failed to set primary photo', 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error setting primary photo:', error);
                return of(null);
              })
            );
          })
        )
      ),

      /**
       * Reorder photos
       */
      reorderPhotos: rxMethod<string[]>(
        pipe(
          switchMap((photoIds) => {
            const vendorId = store.vendorId();
            if (!vendorId) {
              console.error('No vendor ID set');
              return of(null);
            }

            return apiClient.vendorPhotos_ReorderPhotos(vendorId, { photoIds }).pipe(
              tap(() => {
                const reorderedPhotos: VendorPhotoDto[] = [];
                photoIds.forEach((id, index) => {
                  const photo = store.photos().find((p) => p.id === id);
                  if (photo) {
                    reorderedPhotos.push({ ...photo, displayOrder: index });
                  }
                });

                patchState(store, { photos: reorderedPhotos });

                snackBar.open('Photos reordered', 'Close', {
                  duration: 3000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
              }),
              catchError((error) => {
                snackBar.open('Failed to reorder photos', 'Close', {
                  duration: 5000,
                  horizontalPosition: 'center',
                  verticalPosition: 'bottom',
                });
                console.error('Error reordering photos:', error);
                return of(null);
              })
            );
          })
        )
      ),

      /**
       * Clear store state
       */
      clear(): void {
        patchState(store, initialState);
      },

      /**
       * Clear error state
       */
      clearError(): void {
        patchState(store, { error: null });
      },

      /**
       * Clear upload error state
       */
      clearUploadError(): void {
        patchState(store, { uploadError: null });
      },
    })
  )
);
