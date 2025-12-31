import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/api/api.service';

/**
 * Maximum file size for receipts: 10MB
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed content types for receipt uploads (AC-5.2.6)
 */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * ReceiptCaptureService (AC-5.2.1, AC-5.2.2, AC-5.2.5)
 *
 * Handles receipt capture and upload to S3 using presigned URLs.
 * Uses existing backend infrastructure from Story 5-1.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptCaptureService {
  private readonly apiClient = inject(ApiClient);

  /**
   * Upload a receipt file to S3 and create a receipt record (AC-5.2.2, AC-5.2.5)
   *
   * Flow:
   * 1. Request presigned URL from backend
   * 2. Upload file directly to S3 using presigned URL
   * 3. Confirm upload and create receipt record in database
   *
   * @param file The file to upload (image or PDF)
   * @param propertyId Optional property ID to associate with receipt
   * @returns Promise resolving to the created receipt ID
   * @throws Error if any step in the upload process fails
   */
  async uploadReceipt(file: File, propertyId?: string): Promise<string> {
    // Step 1: Request presigned URL from backend
    const uploadUrlResponse = await firstValueFrom(
      this.apiClient.receipts_GenerateUploadUrl({
        contentType: file.type,
        fileSizeBytes: file.size,
        propertyId,
      })
    );

    // Step 2: Upload file directly to S3
    const s3Response = await fetch(uploadUrlResponse.uploadUrl!, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!s3Response.ok) {
      throw new Error('S3 upload failed');
    }

    // Step 3: Confirm upload and create receipt record
    const createReceiptResponse = await firstValueFrom(
      this.apiClient.receipts_CreateReceipt({
        storageKey: uploadUrlResponse.storageKey,
        originalFileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        propertyId,
      })
    );

    return createReceiptResponse.id!;
  }

  /**
   * Check if a file type is valid for upload (AC-5.2.6)
   *
   * Allowed types: image/jpeg, image/png, application/pdf
   *
   * @param contentType MIME type of the file
   * @returns true if the content type is allowed
   */
  isValidFileType(contentType: string): boolean {
    return ALLOWED_CONTENT_TYPES.includes(contentType);
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
    return fileSizeBytes <= MAX_FILE_SIZE_BYTES;
  }

  /**
   * Get the maximum allowed file size in bytes
   */
  getMaxFileSizeBytes(): number {
    return MAX_FILE_SIZE_BYTES;
  }

  /**
   * Get human-readable list of allowed file types
   */
  getAllowedFileTypes(): string[] {
    return [...ALLOWED_CONTENT_TYPES];
  }
}
