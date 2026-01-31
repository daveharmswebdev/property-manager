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
import { ApiClient, WorkOrderPhotoDto } from '../../../core/api/api.service';

/**
 * Work Order Photo Store State Interface
 *
 * Simpler than PropertyPhotoState:
 * - NO isPrimary
 * - NO displayOrder/reordering
 * - Photos sorted by createdAt descending (newest first) from API
 */
interface WorkOrderPhotoState {
  /** Current work order ID */
  workOrderId: string | null;
  /** List of photos for the work order */
  photos: WorkOrderPhotoDto[];
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
 * Initial state for work order photo store
 */
const initialState: WorkOrderPhotoState = {
  workOrderId: null,
  photos: [],
  isLoading: false,
  error: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
};

/**
 * WorkOrderPhotoStore
 *
 * State management for work order photos using @ngrx/signals.
 * Simpler than PropertyPhotoStore:
 * - NO isPrimary
 * - NO displayOrder/reordering
 * - Photos sorted by createdAt descending (newest first)
 *
 * Provides:
 * - Photos list with loading/error states
 * - Upload with progress tracking
 * - Delete operation
 */
export const WorkOrderPhotoStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Total count of photos
     */
    photoCount: computed(() => store.photos().length),

    /**
     * Whether the work order has any photos
     */
    hasPhotos: computed(() => store.photos().length > 0),

    /**
     * Whether the gallery is empty (not loading and no photos)
     */
    isEmpty: computed(() => !store.isLoading() && store.photos().length === 0),

    /**
     * Photos sorted by createdAt descending (newest first)
     * Note: API already returns photos sorted, but we ensure consistency
     */
    sortedPhotos: computed(() =>
      [...store.photos()].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Newest first
      })
    ),
  })),
  withMethods((store, apiClient = inject(ApiClient), snackBar = inject(MatSnackBar)) => ({
    /**
     * Load photos for a work order
     */
    loadPhotos: rxMethod<string>(
      pipe(
        tap((workOrderId) =>
          patchState(store, {
            workOrderId,
            isLoading: true,
            error: null,
          })
        ),
        switchMap((workOrderId) =>
          apiClient.workOrderPhotos_GetPhotos(workOrderId).pipe(
            tap((response) =>
              patchState(store, {
                photos: response.items ?? [],
                isLoading: false,
              })
            ),
            catchError((error) => {
              const errorMessage = error.status === 404
                ? 'Work order not found'
                : 'Failed to load photos. Please try again.';
              patchState(store, {
                isLoading: false,
                error: errorMessage,
              });
              console.error('Error loading work order photos:', error);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Upload a photo for the current work order
     */
    async uploadPhoto(file: File): Promise<boolean> {
      const workOrderId = store.workOrderId();
      if (!workOrderId) {
        console.error('No work order ID set for photo upload');
        return false;
      }

      patchState(store, {
        isUploading: true,
        uploadProgress: 0,
        uploadError: null,
      });

      try {
        // Step 1: Request presigned URL from work order photos endpoint
        const uploadUrlResponse = await apiClient.workOrderPhotos_GenerateUploadUrl(workOrderId, {
          contentType: file.type,
          fileSizeBytes: file.size,
          originalFileName: file.name,
        }).toPromise();

        if (!uploadUrlResponse?.uploadUrl || !uploadUrlResponse?.storageKey) {
          throw new Error('Failed to get upload URL');
        }

        patchState(store, { uploadProgress: 10 });

        // Step 2: Upload file directly to S3
        const s3Response = await uploadToS3(
          uploadUrlResponse.uploadUrl,
          file,
          (percent) => patchState(store, { uploadProgress: 10 + Math.round(percent * 0.7) })
        );

        if (!s3Response.ok) {
          throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
        }

        patchState(store, { uploadProgress: 80 });

        // Step 3: Confirm upload with work order photos endpoint
        await apiClient.workOrderPhotos_ConfirmUpload(workOrderId, {
          storageKey: uploadUrlResponse.storageKey,
          thumbnailStorageKey: uploadUrlResponse.thumbnailStorageKey ?? undefined,
          contentType: file.type,
          fileSizeBytes: file.size,
          originalFileName: file.name,
        }).toPromise();

        patchState(store, {
          isUploading: false,
          uploadProgress: 100,
        });

        // Refresh photos list
        this.loadPhotos(workOrderId);

        snackBar.open('Photo added ✓', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
        patchState(store, {
          isUploading: false,
          uploadProgress: 0,
          uploadError: errorMessage,
        });

        snackBar.open(`Failed to upload ${file.name}. Try again.`, 'Close', {
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
          const workOrderId = store.workOrderId();
          if (!workOrderId) {
            console.error('No work order ID set');
            return of(null);
          }

          return apiClient.workOrderPhotos_DeletePhoto(workOrderId, photoId).pipe(
            tap(() => {
              // Remove from local state
              patchState(store, {
                photos: store.photos().filter(p => p.id !== photoId),
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
  }))
);

/**
 * Upload file to S3 with progress tracking
 */
async function uploadToS3(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<Response> {
  // If no progress callback, use simple fetch
  if (!onProgress) {
    return fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      resolve(new Response(null, { status: xhr.status, statusText: xhr.statusText }));
    };

    xhr.onerror = () => {
      reject(new Error('Network error during S3 upload'));
    };

    xhr.send(file);
  });
}
