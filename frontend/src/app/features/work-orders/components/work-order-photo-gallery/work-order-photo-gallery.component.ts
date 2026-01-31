import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkOrderPhotoDto } from '../../../../core/api/api.service';

/**
 * WorkOrderPhotoGalleryComponent
 *
 * Displays work order photos in a responsive grid.
 * Simpler than PropertyPhotoGalleryComponent:
 * - NO drag-drop reordering
 * - NO primary photo indicator/button
 * - Just display, click to view, delete
 *
 * Features:
 * - Empty state with upload CTA when no photos
 * - Skeleton loading placeholders during fetch
 * - Fade-in animations when photos load
 * - Responsive grid (1/2/3 columns based on viewport)
 */
@Component({
  selector: 'app-work-order-photo-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="gallery-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>photo_library</mat-icon>
          Photos
          @if (photos().length > 0) {
            <span class="photo-count">({{ photos().length }})</span>
          }
        </mat-card-title>
        @if (!isLoading() && photos().length > 0) {
          <button mat-stroked-button color="primary" class="add-photo-btn" (click)="addPhotoClick.emit()">
            <mat-icon>add_a_photo</mat-icon>
            Add Photo
          </button>
        }
      </mat-card-header>
      <mat-card-content>
        <!-- Loading State -->
        @if (isLoading()) {
          <div class="gallery-grid" data-testid="loading-grid">
            @for (i of skeletonItems; track i) {
              <div class="photo-skeleton">
                <div class="skeleton-shimmer"></div>
              </div>
            }
          </div>
        }

        <!-- Empty State -->
        @if (!isLoading() && photos().length === 0) {
          <div class="empty-state" data-testid="empty-state">
            <mat-icon>add_photo_alternate</mat-icon>
            <h3>No photos yet</h3>
            <p>Add photos to document this work order</p>
            <button mat-raised-button color="primary" (click)="addPhotoClick.emit()">
              <mat-icon>add_a_photo</mat-icon>
              Add First Photo
            </button>
          </div>
        }

        <!-- Photo Grid (NO drag-drop, simpler than property gallery) -->
        @if (!isLoading() && photos().length > 0) {
          <div class="gallery-grid" data-testid="photo-grid">
            @for (photo of photos(); track photo.id) {
              <div
                class="photo-card"
                tabindex="0"
                role="button"
                [attr.data-testid]="'photo-card-' + photo.id"
                [attr.aria-label]="'View ' + (photo.originalFileName || 'photo')">
                <img
                  [src]="photo.thumbnailUrl || photo.photoUrl"
                  [alt]="photo.originalFileName || 'Work order photo'"
                  class="photo-img"
                  loading="lazy"
                  (load)="onImageLoad($event)"
                  (click)="photoClick.emit(photo)"
                  (keydown.enter)="photoClick.emit(photo)"
                />
                <!-- Delete Button (on hover) -->
                <div class="photo-overlay">
                  <button
                    mat-icon-button
                    class="delete-btn"
                    (click)="onDelete(photo, $event)"
                    [attr.data-testid]="'delete-btn-' + photo.id"
                    aria-label="Delete photo">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .gallery-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;

          mat-icon {
            color: var(--pm-primary);
          }

          .photo-count {
            font-size: 14px;
            font-weight: normal;
            color: var(--pm-text-secondary);
          }
        }

        .add-photo-btn {
          mat-icon {
            margin-right: 4px;
          }
        }
      }
    }

    /* Responsive Flexbox Grid */
    .gallery-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Photo Card - Responsive Flexbox Sizing */
    .photo-card {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background-color: var(--pm-surface-variant, #f5f5f5);
      transition: box-shadow 0.2s ease;

      /* Single column on mobile (default) */
      flex: 0 0 100%;

      /* 2 columns on tablet - account for 12px gap */
      @media (min-width: 600px) {
        flex: 0 0 calc(50% - 6px);
      }

      /* 3 columns on desktop - account for 12px gap between 3 items */
      @media (min-width: 960px) {
        flex: 0 0 calc(33.333% - 8px);
      }

      &:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      &:focus {
        outline: 2px solid var(--pm-primary);
        outline-offset: 2px;
      }
    }

    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;

      &.loaded {
        opacity: 1;
      }
    }

    /* Photo Overlay with Delete Button */
    .photo-overlay {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      padding: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
      background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.3) 100%);
      pointer-events: none;
    }

    .photo-overlay .delete-btn {
      pointer-events: auto;
    }

    .photo-card:hover .photo-overlay,
    .photo-card:focus-within .photo-overlay {
      opacity: 1;
    }

    .delete-btn {
      background-color: rgba(255, 255, 255, 0.9);
      color: #c62828;
      width: 32px;
      height: 32px;

      &:hover {
        background-color: white;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #c62828;
      }
    }

    /* Skeleton Loading */
    .photo-skeleton {
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      background-color: var(--pm-surface-variant, #e0e0e0);

      /* Single column on mobile (default) */
      flex: 0 0 100%;

      /* 2 columns on tablet */
      @media (min-width: 600px) {
        flex: 0 0 calc(50% - 6px);
      }

      /* 3 columns on desktop */
      @media (min-width: 960px) {
        flex: 0 0 calc(33.333% - 8px);
      }
    }

    .skeleton-shimmer {
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--pm-text-secondary);

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        opacity: 0.5;
        margin-bottom: 16px;
      }

      h3 {
        color: var(--pm-text-primary);
        font-size: 18px;
        font-weight: 500;
        margin: 0 0 8px 0;
      }

      p {
        font-size: 14px;
        margin: 0 0 24px 0;
      }

      button mat-icon {
        margin-right: 8px;
      }
    }
  `]
})
export class WorkOrderPhotoGalleryComponent {
  /**
   * List of photos to display
   */
  readonly photos = input<WorkOrderPhotoDto[]>([]);

  /**
   * Whether photos are currently loading
   */
  readonly isLoading = input<boolean>(false);

  /**
   * Emitted when user clicks "Add Photo" button
   */
  readonly addPhotoClick = output<void>();

  /**
   * Emitted when user clicks on a photo (for lightbox)
   */
  readonly photoClick = output<WorkOrderPhotoDto>();

  /**
   * Emitted when user clicks delete button
   */
  readonly deleteClick = output<WorkOrderPhotoDto>();

  /**
   * Skeleton placeholder items for loading state
   */
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];

  /**
   * Handle image load event for fade-in animation
   */
  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  /**
   * Delete photo
   */
  onDelete(photo: WorkOrderPhotoDto, event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit(photo);
  }
}
