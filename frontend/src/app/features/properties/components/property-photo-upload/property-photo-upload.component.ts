import { Component, input, output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PhotoUploadService } from '../../../../shared/services/photo-upload.service';
import { PropertyPhotoStore } from '../../stores/property-photo.store';

/**
 * Upload state interface
 */
interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error: string | null;
  file: File | null;
}

/**
 * PropertyPhotoUploadComponent (AC-13.3b.7, AC-13.3b.8, AC-13.3b.9)
 *
 * Photo upload component with:
 * - Drag-and-drop zone
 * - File picker button
 * - Upload progress bar
 * - Client-side file type/size validation
 * - Error states with retry option
 *
 * Integrates with existing PhotoUploadService for S3 direct upload.
 */
@Component({
  selector: 'app-property-photo-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="upload-container">
      <!-- Drag & Drop Zone (AC-13.3b.7) -->
      <div
        class="drop-zone"
        [class.dragging]="isDragging()"
        [class.uploading]="uploadState().status === 'uploading'"
        [class.error]="uploadState().status === 'error'"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()">

        <input
          #fileInput
          type="file"
          [accept]="acceptedTypes"
          (change)="onFileSelected($event)"
          hidden
        />

        @switch (uploadState().status) {
          @case ('idle') {
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p class="drop-text">Drag & drop a photo here</p>
            <p class="drop-subtext">or click to browse</p>
            <p class="file-info">
              Accepts: JPEG, PNG, GIF, WebP (max {{ maxFileSizeMB }}MB)
            </p>
          }

          @case ('uploading') {
            <mat-icon class="upload-icon spinning">sync</mat-icon>
            <p class="drop-text">Uploading...</p>
            <div class="progress-container">
              <mat-progress-bar
                mode="determinate"
                [value]="uploadState().progress"
                color="primary">
              </mat-progress-bar>
              <span class="progress-text">{{ uploadState().progress }}%</span>
            </div>
          }

          @case ('success') {
            <mat-icon class="upload-icon success">check_circle</mat-icon>
            <p class="drop-text">Upload complete!</p>
            <button mat-stroked-button color="primary" (click)="resetUpload($event)">
              Upload Another
            </button>
          }

          @case ('error') {
            <mat-icon class="upload-icon error">error_outline</mat-icon>
            <p class="drop-text error-text">Upload failed</p>
            <p class="error-message">{{ uploadState().error }}</p>
            <div class="error-actions">
              <button mat-stroked-button color="primary" (click)="retryUpload($event)">
                <mat-icon>refresh</mat-icon>
                Retry
              </button>
              <button mat-stroked-button (click)="resetUpload($event)">
                Cancel
              </button>
            </div>
          }
        }
      </div>

      <!-- Validation Error Display -->
      @if (validationError()) {
        <div class="validation-error">
          <mat-icon>warning</mat-icon>
          <span>{{ validationError() }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .upload-container {
      width: 100%;
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      border: 2px dashed var(--pm-border, #ccc);
      border-radius: 12px;
      background-color: var(--pm-surface-variant, #fafafa);
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 200px;

      &:hover:not(.uploading) {
        border-color: var(--pm-primary);
        background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.05);
      }

      &.dragging {
        border-color: var(--pm-primary);
        background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.1);
        transform: scale(1.02);
      }

      &.uploading {
        cursor: default;
        border-style: solid;
        border-color: var(--pm-primary);
      }

      &.error {
        border-color: var(--pm-error, #c62828);
        background-color: rgba(198, 40, 40, 0.05);
      }
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--pm-text-secondary);
      margin-bottom: 12px;

      &.spinning {
        animation: spin 1s linear infinite;
        color: var(--pm-primary);
      }

      &.success {
        color: var(--pm-primary);
      }

      &.error {
        color: var(--pm-error, #c62828);
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .drop-text {
      font-size: 16px;
      font-weight: 500;
      color: var(--pm-text-primary);
      margin: 0 0 4px 0;

      &.error-text {
        color: var(--pm-error, #c62828);
      }
    }

    .drop-subtext {
      font-size: 14px;
      color: var(--pm-text-secondary);
      margin: 0 0 16px 0;
    }

    .file-info {
      font-size: 12px;
      color: var(--pm-text-secondary);
      margin: 0;
    }

    .progress-container {
      width: 100%;
      max-width: 300px;
      margin-top: 16px;

      mat-progress-bar {
        border-radius: 4px;
      }

      .progress-text {
        display: block;
        text-align: center;
        font-size: 14px;
        color: var(--pm-text-secondary);
        margin-top: 8px;
      }
    }

    .error-message {
      font-size: 14px;
      color: var(--pm-error, #c62828);
      margin: 8px 0 16px 0;
      text-align: center;
    }

    .error-actions {
      display: flex;
      gap: 12px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    .validation-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 12px 16px;
      background-color: rgba(198, 40, 40, 0.1);
      border-radius: 8px;
      color: var(--pm-error, #c62828);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      span {
        font-size: 14px;
      }
    }
  `]
})
export class PropertyPhotoUploadComponent {
  private readonly photoUploadService = inject(PhotoUploadService);
  private readonly photoStore = inject(PropertyPhotoStore);

  /**
   * Property ID for the upload
   */
  readonly propertyId = input.required<string>();

  /**
   * Emitted when upload completes successfully
   */
  readonly uploadComplete = output<void>();

  constructor() {
    // Sync upload progress from store to local state
    effect(() => {
      const isUploading = this.photoStore.isUploading();
      const progress = this.photoStore.uploadProgress();
      const error = this.photoStore.uploadError();

      if (isUploading) {
        this.uploadState.update(state => ({
          ...state,
          status: 'uploading',
          progress,
        }));
      } else if (error && this.uploadState().status === 'uploading') {
        this.uploadState.update(state => ({
          ...state,
          status: 'error',
          error,
          progress: 0,
        }));
      } else if (!isUploading && this.uploadState().status === 'uploading' && progress === 100) {
        this.uploadState.update(state => ({
          ...state,
          status: 'success',
          progress: 100,
        }));
        this.uploadComplete.emit();
      }
    });
  }

  /**
   * Drag state
   */
  readonly isDragging = signal(false);

  /**
   * Upload state
   */
  readonly uploadState = signal<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    file: null,
  });

  /**
   * Validation error message
   */
  readonly validationError = signal<string | null>(null);

  /**
   * Accepted file types for file input
   */
  readonly acceptedTypes = this.photoUploadService.getAcceptString();

  /**
   * Max file size in MB for display
   */
  readonly maxFileSizeMB = this.photoUploadService.getMaxFileSizeBytes() / 1024 / 1024;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.uploadState().status === 'uploading') return;
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.uploadState().status === 'uploading') return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
      // Reset input so same file can be selected again
      input.value = '';
    }
  }

  /**
   * Validate and start upload
   */
  private handleFile(file: File): void {
    this.validationError.set(null);

    // Client-side validation (AC-13.3b.7)
    if (!this.photoUploadService.isValidFileType(file.type)) {
      this.validationError.set(
        `Invalid file type: ${file.type || 'unknown'}. Please use JPEG, PNG, GIF, or WebP.`
      );
      return;
    }

    if (!this.photoUploadService.isValidFileSize(file.size)) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      this.validationError.set(
        `File too large: ${sizeMB}MB. Maximum size is ${this.maxFileSizeMB}MB.`
      );
      return;
    }

    this.startUpload(file);
  }

  /**
   * Start the upload process using PropertyPhotoStore
   * This ensures photos are created via property-specific endpoints
   * and properly stored in the PropertyPhotos table.
   */
  private async startUpload(file: File): Promise<void> {
    this.uploadState.set({
      status: 'uploading',
      progress: 0,
      error: null,
      file,
    });

    // Use the store's uploadPhoto method which calls property-specific endpoints
    // that create PropertyPhoto records in the database
    const success = await this.photoStore.uploadPhoto(file);

    // Note: The effect() in the constructor handles state transitions
    // based on photoStore signals, so we don't need to manually
    // set success/error states here. But we do set them for immediate feedback.
    if (!success) {
      // Error state is set by the effect, but also set file reference
      this.uploadState.update(state => ({ ...state, file }));
    }
  }

  /**
   * Retry failed upload (AC-13.3b.8)
   */
  retryUpload(event: Event): void {
    event.stopPropagation();
    const file = this.uploadState().file;
    if (file) {
      this.startUpload(file);
    }
  }

  /**
   * Reset to idle state
   */
  resetUpload(event: Event): void {
    event.stopPropagation();
    this.uploadState.set({
      status: 'idle',
      progress: 0,
      error: null,
      file: null,
    });
    this.validationError.set(null);
  }
}
