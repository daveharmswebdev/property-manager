import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient, PhotoEntityType } from '../../core/api/api.service';

/**
 * Maximum file size for photos: 10MB (matches backend PhotoValidation.MaxFileSizeBytes)
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed content types for photo uploads (matches backend PhotoValidation.AllowedContentTypes)
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
];

/**
 * Options for photo upload
 */
export interface PhotoUploadOptions {
  /** Type of entity the photo belongs to */
  entityType: PhotoEntityType;
  /** ID of the entity */
  entityId: string;
  /** Optional progress callback (0-100) */
  onProgress?: (percent: number) => void;
}

/**
 * Result of a successful photo upload
 */
export interface PhotoUploadResult {
  /** Storage key of the uploaded photo */
  storageKey: string;
  /** Storage key of the generated thumbnail (may be null if generation failed) */
  thumbnailStorageKey: string | null;
  /** Content type of the uploaded file */
  contentType: string;
  /** Size of the uploaded file in bytes */
  fileSizeBytes: number;
}

/**
 * PhotoUploadService
 *
 * Generic photo upload service that:
 * 1. Requests a presigned URL from the backend
 * 2. Uploads the file directly to S3
 * 3. Confirms the upload (triggering thumbnail generation)
 *
 * Supports all entity types: Properties, Vendors, Users, Receipts
 */
@Injectable({ providedIn: 'root' })
export class PhotoUploadService {
  private readonly apiClient = inject(ApiClient);

  /**
   * Upload a photo file to S3 with thumbnail generation
   *
   * Flow:
   * 1. Request presigned URL from backend (includes storage keys)
   * 2. Upload file directly to S3 using presigned URL
   * 3. Confirm upload (backend generates thumbnail)
   *
   * @param file The image file to upload
   * @param options Upload options (entityType, entityId, onProgress)
   * @returns Promise resolving to upload result with storage keys
   * @throws Error if any step fails or validation fails
   */
  async uploadPhoto(file: File, options: PhotoUploadOptions): Promise<PhotoUploadResult> {
    // Validate file
    if (!this.isValidFileType(file.type)) {
      throw new Error(
        `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`
      );
    }
    if (!this.isValidFileSize(file.size)) {
      throw new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
      );
    }

    // Report initial progress
    options.onProgress?.(0);

    // Step 1: Request presigned URL from backend
    const uploadUrlResponse = await firstValueFrom(
      this.apiClient.photos_GenerateUploadUrl({
        entityType: options.entityType,
        entityId: options.entityId,
        contentType: file.type,
        fileSizeBytes: file.size,
        originalFileName: file.name,
      })
    );

    options.onProgress?.(10);

    // Step 2: Upload file directly to S3
    const progressCallback = options.onProgress
      ? (percent: number) => {
          // Map S3 upload progress (0-100) to overall progress (10-80)
          options.onProgress!(10 + Math.round(percent * 0.7));
        }
      : undefined;

    const s3Response = await this.uploadToS3(uploadUrlResponse.uploadUrl!, file, progressCallback);

    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
    }

    options.onProgress?.(80);

    // Step 3: Confirm upload (triggers thumbnail generation)
    const confirmResponse = await firstValueFrom(
      this.apiClient.photos_ConfirmUpload({
        storageKey: uploadUrlResponse.storageKey!,
        thumbnailStorageKey: uploadUrlResponse.thumbnailStorageKey!,
        contentType: file.type,
        fileSizeBytes: file.size,
      })
    );

    options.onProgress?.(100);

    return {
      storageKey: confirmResponse.storageKey!,
      thumbnailStorageKey: confirmResponse.thumbnailStorageKey ?? null,
      contentType: confirmResponse.contentType!,
      fileSizeBytes: confirmResponse.fileSizeBytes!,
    };
  }

  /**
   * Upload file to S3 with optional progress tracking
   */
  private async uploadToS3(
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

  /**
   * Check if a file type is valid for upload
   *
   * Allowed types: image/jpeg, image/png, image/gif, image/webp, image/bmp, image/tiff
   *
   * @param contentType MIME type of the file
   * @returns true if the content type is allowed
   */
  isValidFileType(contentType: string): boolean {
    return ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase());
  }

  /**
   * Check if a file size is within the allowed limit
   *
   * Maximum size: 10MB
   *
   * @param fileSizeBytes Size of the file in bytes
   * @returns true if the file size is within limits
   */
  isValidFileSize(fileSizeBytes: number): boolean {
    return fileSizeBytes > 0 && fileSizeBytes <= MAX_FILE_SIZE_BYTES;
  }

  /**
   * Get the maximum allowed file size in bytes
   */
  getMaxFileSizeBytes(): number {
    return MAX_FILE_SIZE_BYTES;
  }

  /**
   * Get list of allowed MIME types
   */
  getAllowedContentTypes(): readonly string[] {
    return ALLOWED_CONTENT_TYPES;
  }

  /**
   * Get accept string for file input (e.g., "image/jpeg,image/png,...")
   */
  getAcceptString(): string {
    return ALLOWED_CONTENT_TYPES.join(',');
  }
}
