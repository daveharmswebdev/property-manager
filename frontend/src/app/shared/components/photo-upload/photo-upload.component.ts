import { Component, input, output, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PhotoUploadService } from '../../services/photo-upload.service';

/**
 * Upload item in the queue (Task 1.1)
 */
export interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error: string | null;
}

/**
 * PhotoUploadComponent
 *
 * Generic photo upload component with drag-drop zone and multi-file queue.
 * Delegates actual upload to parent component via uploadFn input.
 * Emits events for parent to handle store updates.
 *
 * Used by: PropertyPhotoUploadComponent, WorkOrderDetailComponent
 *
 * Features:
 * - Drag-and-drop zone (multi-file)
 * - File picker button (multi-select)
 * - Per-file upload progress
 * - Per-file validation errors
 * - Sequential upload processing
 * - Retry/remove per item
 * - Mobile camera support via accept attribute
 */
@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="upload-container">
      <input
        #fileInput
        type="file"
        [accept]="acceptedTypes"
        [attr.multiple]="true"
        (change)="onFileSelected($event)"
        hidden
        data-testid="file-input"
      />

      @if (!hasQueue()) {
        <!-- Idle state: full drop zone (Task 3.1) -->
        <div
          class="drop-zone"
          [class.dragging]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
          data-testid="drop-zone"
        >
          <mat-icon class="upload-icon">cloud_upload</mat-icon>
          <p class="drop-text">Drag & drop photos here</p>
          <p class="drop-subtext">or click to browse</p>
          <p class="file-info">
            Accepts: JPEG, PNG, GIF, WebP (max {{ maxFileSizeMB }}MB)
          </p>
        </div>
      } @else {
        <!-- Queue state: compact drop zone + file queue (Task 3.2) -->
        <div
          class="compact-drop-zone"
          [class.dragging]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
          data-testid="drop-zone"
        >
          <mat-icon>cloud_upload</mat-icon>
          <span>Drop more photos or click to add</span>
        </div>

        <!-- Queue list (Task 3.3) -->
        <div class="upload-queue" data-testid="upload-queue">
          @for (item of uploadQueue(); track item.id) {
            <div
              class="queue-item"
              [class.success]="item.status === 'success'"
              [class.error]="item.status === 'error'"
              [class.uploading]="item.status === 'uploading'"
              [class.pending]="item.status === 'pending'"
              [attr.data-testid]="'queue-item-' + item.id"
            >
              @switch (item.status) {
                @case ('pending') {
                  <mat-icon class="status-icon pending-icon">hourglass_empty</mat-icon>
                }
                @case ('uploading') {
                  <mat-icon class="status-icon spinning">sync</mat-icon>
                }
                @case ('success') {
                  <mat-icon class="status-icon success-icon">check_circle</mat-icon>
                }
                @case ('error') {
                  <mat-icon class="status-icon error-icon">error_outline</mat-icon>
                }
              }

              <div class="queue-item-info">
                <span class="queue-item-name">{{ item.file.name }}</span>
                @if (item.status === 'uploading') {
                  <mat-progress-bar
                    mode="determinate"
                    [value]="item.progress"
                    color="primary"
                  ></mat-progress-bar>
                }
                @if (item.status === 'error' && item.error) {
                  <span class="queue-item-error">{{ item.error }}</span>
                }
              </div>

              <div class="queue-item-actions">
                @if (item.status === 'error') {
                  <button
                    mat-icon-button
                    (click)="retryItem(item.id)"
                    aria-label="Retry upload"
                    data-testid="retry-btn"
                  >
                    <mat-icon>refresh</mat-icon>
                  </button>
                }
                @if (item.status === 'pending' || item.status === 'error') {
                  <button
                    mat-icon-button
                    (click)="removeItem(item.id)"
                    aria-label="Remove from queue"
                    data-testid="remove-btn"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Summary line (Task 3.5) -->
          <div class="queue-summary" data-testid="queue-summary">
            @if (completedCount() === totalCount() && failedCount() === 0) {
              All {{ totalCount() }} uploaded successfully
            } @else {
              {{ completedCount() }} of {{ totalCount() }} uploaded
            }
          </div>

          <!-- Clear button when all in final state (Task 3.6) -->
          @if (allInFinalState()) {
            <button
              mat-stroked-button
              (click)="clearQueue()"
              data-testid="clear-queue-btn"
              class="clear-queue-btn"
            >
              Clear
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .upload-container {
        width: 100%;
      }

      /* Full drop zone (idle state) */
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

        &:hover {
          border-color: var(--pm-primary);
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.05);
        }

        &.dragging {
          border-color: var(--pm-primary);
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.1);
          transform: scale(1.02);
        }
      }

      .upload-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--pm-text-secondary);
        margin-bottom: 12px;
      }

      .drop-text {
        font-size: 16px;
        font-weight: 500;
        color: var(--pm-text-primary);
        margin: 0 0 4px 0;
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

      /* Compact drop zone (Task 4.5) */
      .compact-drop-zone {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border: 2px dashed var(--pm-border, #ccc);
        border-radius: 8px;
        background-color: var(--pm-surface-variant, #fafafa);
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 12px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          color: var(--pm-text-secondary);
        }

        span {
          font-size: 14px;
          color: var(--pm-text-secondary);
        }

        &:hover {
          border-color: var(--pm-primary);
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.05);
        }

        &.dragging {
          border-color: var(--pm-primary);
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.1);
        }
      }

      /* Upload queue container (Task 4.1) */
      .upload-queue {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--pm-border, #e0e0e0);
        border-radius: 8px;
        padding: 8px;
      }

      /* Queue item row (Task 4.2) */
      .queue-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 6px;
        transition: background-color 0.2s ease;

        &:not(:last-of-type) {
          margin-bottom: 4px;
        }

        /* State styles (Task 4.3) */
        &.success {
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.08);
        }

        &.error {
          background-color: rgba(198, 40, 40, 0.06);
        }

        &.uploading {
          background-color: rgba(var(--pm-primary-rgb, 76, 175, 80), 0.04);
        }

        &.pending {
          background-color: transparent;
        }
      }

      .status-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;

        &.pending-icon {
          color: var(--pm-text-secondary);
        }

        &.spinning {
          animation: spin 1s linear infinite;
          color: var(--pm-primary);
        }

        &.success-icon {
          color: var(--pm-primary);
        }

        &.error-icon {
          color: var(--pm-error, #c62828);
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .queue-item-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .queue-item-name {
        font-size: 13px;
        color: var(--pm-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .queue-item-error {
        font-size: 12px;
        color: var(--pm-error, #c62828);
      }

      .queue-item-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;

        button {
          width: 32px;
          height: 32px;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }

      /* Queue summary (Task 4.4) */
      .queue-summary {
        padding: 8px;
        font-size: 13px;
        color: var(--pm-text-secondary);
        text-align: center;
        border-top: 1px solid var(--pm-border, #e0e0e0);
        margin-top: 4px;
      }

      .clear-queue-btn {
        display: block;
        margin: 8px auto 0;
      }
    `,
  ],
})
export class PhotoUploadComponent implements OnDestroy {
  private readonly photoUploadService = inject(PhotoUploadService);
  private readonly progressIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private nextItemId = 0;

  /** Required: upload function provided by parent (unchanged contract) */
  readonly uploadFn = input.required<(file: File) => Promise<boolean>>();

  /** Emitted after EACH successful file upload */
  readonly uploadComplete = output<void>();

  /** Emitted ONCE when ALL files reach a final state (Task 1.6) */
  readonly batchComplete = output<void>();

  /** Drag state */
  readonly isDragging = signal(false);

  /** Multi-file upload queue (Task 1.2) */
  readonly uploadQueue = signal<UploadItem[]>([]);

  /** Computed signals (Task 1.3) */
  readonly isProcessing = computed(() =>
    this.uploadQueue().some((item) => item.status === 'uploading'),
  );
  readonly hasQueue = computed(() => this.uploadQueue().length > 0);
  readonly completedCount = computed(
    () => this.uploadQueue().filter((item) => item.status === 'success').length,
  );
  readonly failedCount = computed(
    () => this.uploadQueue().filter((item) => item.status === 'error').length,
  );
  readonly totalCount = computed(() => this.uploadQueue().length);
  readonly allInFinalState = computed(
    () =>
      this.hasQueue() &&
      this.uploadQueue().every((item) => item.status === 'success' || item.status === 'error'),
  );

  readonly acceptedTypes = this.photoUploadService.getAcceptString();
  readonly maxFileSizeMB = this.photoUploadService.getMaxFileSizeBytes() / 1024 / 1024;

  ngOnDestroy(): void {
    this.progressIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.progressIntervals.clear();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  /** Handle drop — accepts multiple files (Task 2.3) */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.addToQueue(Array.from(files));
      this.processQueue();
    }
  }

  /** Handle file input selection — accepts multiple files (Task 2.4) */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addToQueue(Array.from(input.files));
      input.value = '';
      this.processQueue();
    }
  }

  /** Validate each file and add to queue (Task 1.4) */
  private addToQueue(files: File[]): void {
    const newItems: UploadItem[] = [];

    for (const file of files) {
      const id = `upload-${++this.nextItemId}`;

      if (!this.photoUploadService.isValidFileType(file.type)) {
        newItems.push({
          id,
          file,
          status: 'error',
          progress: 0,
          error: `Invalid file type: ${file.type || 'unknown'}. Please use JPEG, PNG, GIF, or WebP.`,
        });
        continue;
      }

      if (!this.photoUploadService.isValidFileSize(file.size)) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        newItems.push({
          id,
          file,
          status: 'error',
          progress: 0,
          error: `File too large: ${sizeMB}MB. Maximum size is ${this.maxFileSizeMB}MB.`,
        });
        continue;
      }

      newItems.push({
        id,
        file,
        status: 'pending',
        progress: 0,
        error: null,
      });
    }

    this.uploadQueue.update((queue) => [...queue, ...newItems]);
  }

  /** Process queue sequentially — one file at a time (Task 1.5) */
  async processQueue(): Promise<void> {
    if (this.isProcessing()) return; // guard re-entry (Task 2.6)

    const next = this.uploadQueue().find((item) => item.status === 'pending');
    if (!next) {
      if (this.totalCount() > 0) {
        this.batchComplete.emit();
      }
      return;
    }

    this.updateItem(next.id, { status: 'uploading', progress: 0 });
    this.startProgressSimulation(next.id);

    try {
      const uploadFn = this.uploadFn();
      const success = await uploadFn(next.file);

      this.stopProgressSimulation(next.id);

      if (success) {
        this.updateItem(next.id, { status: 'success', progress: 100 });
        this.uploadComplete.emit();
      } else {
        this.updateItem(next.id, {
          status: 'error',
          progress: 0,
          error: 'Upload failed. Please try again.',
        });
      }
    } catch (error) {
      this.stopProgressSimulation(next.id);
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed. Please try again.';
      this.updateItem(next.id, { status: 'error', progress: 0, error: errorMessage });
    }

    await this.processQueue();
  }

  /** Set failed item back to pending and restart queue (Task 1.7) */
  retryItem(id: string): void {
    this.updateItem(id, { status: 'pending', progress: 0, error: null });
    this.processQueue();
  }

  /** Remove item from queue (Task 1.8) */
  removeItem(id: string): void {
    this.stopProgressSimulation(id);
    this.uploadQueue.update((queue) => queue.filter((item) => item.id !== id));
  }

  /** Reset queue to empty (Task 1.9) */
  clearQueue(): void {
    this.progressIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.progressIntervals.clear();
    this.uploadQueue.set([]);
  }

  /** Reset to idle state — backward compat (Task 1.10) */
  resetUpload(event?: Event): void {
    event?.stopPropagation();
    this.clearQueue();
  }

  private updateItem(id: string, updates: Partial<UploadItem>): void {
    this.uploadQueue.update((queue) =>
      queue.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  /** Per-item progress simulation (Task 3.8) */
  private startProgressSimulation(itemId: string): void {
    const intervalId = setInterval(() => {
      const item = this.uploadQueue().find((i) => i.id === itemId);
      if (item && item.status === 'uploading' && item.progress < 90) {
        this.updateItem(itemId, { progress: Math.min(item.progress + 10, 90) });
      }
    }, 200);
    this.progressIntervals.set(itemId, intervalId);
  }

  private stopProgressSimulation(itemId: string): void {
    const intervalId = this.progressIntervals.get(itemId);
    if (intervalId) {
      clearInterval(intervalId);
      this.progressIntervals.delete(itemId);
    }
  }
}
