import { Component, computed, HostListener, inject, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PhotoViewerComponent } from '../photo-viewer/photo-viewer.component';

/**
 * Photo data interface for lightbox
 */
export interface LightboxPhoto {
  id: string;
  viewUrl: string | null | undefined;
  thumbnailUrl?: string | null;
  contentType?: string;
  originalFileName?: string;
  createdAt?: Date | string;  // Story 10-6: Upload date display
  isPrimary?: boolean;
  displayOrder?: number;
}

/**
 * Data passed to the lightbox dialog
 */
export interface PhotoLightboxData {
  photos: LightboxPhoto[];
  currentIndex: number;
  showDelete?: boolean;  // Story 10-6: Enable delete button in lightbox
}

/**
 * PhotoLightboxComponent
 *
 * Generic full-screen lightbox modal for viewing photos with:
 * - Navigation (prev/next) buttons
 * - Keyboard navigation (arrow keys, Escape to close)
 * - Close on backdrop click or Escape key
 * - Zoom/rotate controls via PhotoViewerComponent
 * - Photo counter (x of y)
 *
 * Used by: PropertyPhotoGallery, WorkOrderPhotoGallery
 */
@Component({
  selector: 'app-photo-lightbox',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    PhotoViewerComponent,
  ],
  template: `
    <div
      class="lightbox-backdrop"
      data-testid="lightbox-backdrop"
      (click)="close()"
    >
      <div
        class="lightbox-container"
        data-testid="lightbox-content"
        (click)="$event.stopPropagation()"
      >
        <!-- Header with close button and filename -->
        <header class="lightbox-header">
          <div class="photo-info">
            <span class="photo-filename" data-testid="photo-filename">
              {{ currentPhoto()?.originalFileName || 'Photo' }}
            </span>
            @if (currentPhoto()?.createdAt) {
              <span class="photo-date" data-testid="photo-date">
                Uploaded {{ currentPhoto()!.createdAt | date:'mediumDate' }}
              </span>
            }
            <span class="photo-counter" data-testid="photo-counter">
              {{ currentIndex() + 1 }} of {{ photoCount() }}
            </span>
          </div>
          <div class="header-actions">
            @if (data.showDelete) {
              <button
                mat-icon-button
                class="delete-button"
                data-testid="lightbox-delete-button"
                (click)="onDelete()"
                aria-label="Delete photo"
              >
                <mat-icon>delete</mat-icon>
              </button>
            }
            <button
              mat-icon-button
              class="close-button"
              data-testid="close-button"
              (click)="close()"
              aria-label="Close lightbox"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </header>

        <!-- Main content area with photo viewer -->
        <div class="lightbox-content">
          <!-- Previous button -->
          @if (showNavigation()) {
            <button
              mat-icon-button
              class="nav-button nav-prev"
              data-testid="prev-button"
              (click)="previous()"
              aria-label="Previous photo"
            >
              <mat-icon>chevron_left</mat-icon>
            </button>
          }

          <!-- Photo viewer -->
          <div class="photo-viewer-wrapper">
            @if (currentPhoto()?.viewUrl) {
              <app-photo-viewer
                [viewUrl]="currentPhoto()!.viewUrl!"
                [thumbnailUrl]="currentPhoto()?.thumbnailUrl ?? undefined"
                [contentType]="currentPhoto()?.contentType || 'image/jpeg'"
              />
            }
          </div>

          <!-- Next button -->
          @if (showNavigation()) {
            <button
              mat-icon-button
              class="nav-button nav-next"
              data-testid="next-button"
              (click)="next()"
              aria-label="Next photo"
            >
              <mat-icon>chevron_right</mat-icon>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lightbox-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .lightbox-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      max-width: 100vw;
      max-height: 100vh;
    }

    .lightbox-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      flex-shrink: 0;
    }

    .photo-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .photo-filename {
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .photo-counter {
      font-size: 12px;
      opacity: 0.8;
    }

    .photo-date {
      font-size: 12px;
      opacity: 0.7;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .close-button {
      color: white;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    .delete-button {
      color: #ff6b6b;

      &:hover {
        background-color: rgba(255, 107, 107, 0.15);
      }
    }

    .lightbox-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-height: 0;
      padding: 16px;
    }

    .nav-button {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      width: 48px;
      height: 48px;

      &:hover {
        background-color: rgba(0, 0, 0, 0.7);
      }

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }

    .nav-prev {
      left: 16px;
    }

    .nav-next {
      right: 16px;
    }

    .photo-viewer-wrapper {
      width: 100%;
      height: 100%;
      max-width: calc(100vw - 160px);
      max-height: calc(100vh - 100px);
      display: flex;
      align-items: center;
      justify-content: center;

      app-photo-viewer {
        width: 100%;
        height: 100%;
      }
    }

    @media (max-width: 767px) {
      .lightbox-header {
        padding: 8px 12px;
      }

      .photo-filename {
        max-width: 200px;
        font-size: 12px;
      }

      .nav-button {
        width: 40px;
        height: 40px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .nav-prev {
        left: 8px;
      }

      .nav-next {
        right: 8px;
      }

      .photo-viewer-wrapper {
        max-width: calc(100vw - 100px);
      }
    }
  `],
})
export class PhotoLightboxComponent {
  private readonly dialogRef = inject(MatDialogRef<PhotoLightboxComponent>);
  protected readonly data: PhotoLightboxData = inject(MAT_DIALOG_DATA);

  /** Emitted when user clicks delete button - parent handles confirmation (Story 10-6) */
  readonly deleteClick = output<LightboxPhoto>();

  /** Track photos in a signal for reactivity (Story 10-6) */
  private readonly photos = signal<LightboxPhoto[]>(this.data.photos);

  /** Current photo index (clamped to valid range) */
  readonly currentIndex = signal(
    Math.min(Math.max(0, this.data.currentIndex), this.data.photos.length - 1)
  );

  /** Track photo count for dynamic updates after deletions (Story 10-6) */
  readonly photoCount = computed(() => this.photos().length);

  /** Current photo computed from index (may be undefined for empty arrays) */
  readonly currentPhoto = computed((): LightboxPhoto | undefined => this.photos()[this.currentIndex()]);

  /** Whether to show navigation buttons (more than one photo) */
  readonly showNavigation = computed(() => this.photoCount() > 1);

  /**
   * Navigate to next photo (wraps to first)
   */
  next(): void {
    const photos = this.photos();
    const nextIndex = (this.currentIndex() + 1) % photos.length;
    this.currentIndex.set(nextIndex);
  }

  /**
   * Navigate to previous photo (wraps to last)
   */
  previous(): void {
    const photos = this.photos();
    const prevIndex = (this.currentIndex() - 1 + photos.length) % photos.length;
    this.currentIndex.set(prevIndex);
  }

  /**
   * Close the lightbox dialog
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Handle delete button click - emit event for parent to handle (Story 10-6, AC #4)
   */
  onDelete(): void {
    const photo = this.currentPhoto();
    if (photo) {
      this.deleteClick.emit(photo);
    }
  }

  /**
   * Update photos array and current index after deletion (Story 10-6, AC #6, #7)
   * Called by parent component after successful delete
   */
  updatePhotos(photos: LightboxPhoto[], newIndex: number): void {
    this.photos.set(photos);
    this.currentIndex.set(Math.min(Math.max(0, newIndex), photos.length - 1));
  }

  /**
   * Handle keyboard events for navigation (AC-13.3c.2)
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previous();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }
}
