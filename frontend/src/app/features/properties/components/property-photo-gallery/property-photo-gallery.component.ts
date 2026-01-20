import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Photo data interface matching API PropertyPhotoDto
 */
export interface PropertyPhoto {
  id: string;
  thumbnailUrl?: string | null;
  viewUrl?: string | null;
  isPrimary: boolean;
  displayOrder: number;
  originalFileName?: string;
  fileSizeBytes?: number;
  createdAt?: Date;
}

/**
 * PropertyPhotoGalleryComponent (AC-13.3b.2, AC-13.3b.3, AC-13.3b.4, AC-13.3b.5, AC-13.3b.6)
 *
 * Displays property photos in a responsive grid:
 * - 1 column on mobile (<600px)
 * - 2 columns on tablet (600-959px)
 * - 3 columns on desktop (960px+)
 * - Max 12 photos visible (3x4 grid on desktop)
 *
 * Features:
 * - Empty state with upload CTA when no photos
 * - Skeleton loading placeholders during fetch
 * - Fade-in animations when photos load
 * - Primary photo indicator badge
 */
@Component({
  selector: 'app-property-photo-gallery',
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
        </mat-card-title>
        @if (!isLoading() && photos().length > 0) {
          <button mat-stroked-button color="primary" class="add-photo-btn" (click)="addPhotoClick.emit()">
            <mat-icon>add_a_photo</mat-icon>
            Add Photo
          </button>
        }
      </mat-card-header>
      <mat-card-content>
        <!-- Loading State (AC-13.3b.4) -->
        @if (isLoading()) {
          <div class="gallery-grid">
            @for (i of skeletonItems; track i) {
              <div class="photo-skeleton">
                <div class="skeleton-shimmer"></div>
              </div>
            }
          </div>
        }

        <!-- Empty State (AC-13.3b.3) -->
        @if (!isLoading() && photos().length === 0) {
          <div class="empty-state">
            <mat-icon>add_photo_alternate</mat-icon>
            <h3>No photos yet</h3>
            <p>Add photos to visually document this property</p>
            <button mat-raised-button color="primary" (click)="addPhotoClick.emit()">
              <mat-icon>add_a_photo</mat-icon>
              Add First Photo
            </button>
          </div>
        }

        <!-- Photo Grid (AC-13.3b.2, AC-13.3b.5, AC-13.3b.6) -->
        @if (!isLoading() && photos().length > 0) {
          <div class="gallery-grid">
            @for (photo of photos(); track photo.id) {
              <div
                class="photo-card"
                [class.is-primary]="photo.isPrimary"
                (click)="photoClick.emit(photo)"
                (keydown.enter)="photoClick.emit(photo)"
                tabindex="0"
                role="button"
                [attr.aria-label]="'View ' + (photo.originalFileName || 'photo')">
                @if (photo.isPrimary) {
                  <div class="primary-badge">
                    <mat-icon>star</mat-icon>
                  </div>
                }
                <img
                  [src]="photo.thumbnailUrl || photo.viewUrl"
                  [alt]="photo.originalFileName || 'Property photo'"
                  class="photo-img"
                  loading="lazy"
                  (load)="onImageLoad($event)"
                />
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
        }

        .add-photo-btn {
          mat-icon {
            margin-right: 4px;
          }
        }
      }
    }

    /* Responsive Grid (AC-13.3b.5) */
    .gallery-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(1, 1fr);

      @media (min-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (min-width: 960px) {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    /* Photo Card */
    .photo-card {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background-color: var(--pm-surface-variant, #f5f5f5);
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      &:focus {
        outline: 2px solid var(--pm-primary);
        outline-offset: 2px;
      }

      &.is-primary {
        box-shadow: 0 0 0 2px var(--pm-primary);
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

    .primary-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background-color: var(--pm-primary);
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    /* Skeleton Loading (AC-13.3b.4) */
    .photo-skeleton {
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      background-color: var(--pm-surface-variant, #e0e0e0);
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

    /* Empty State (AC-13.3b.3) */
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
export class PropertyPhotoGalleryComponent {
  /**
   * List of photos to display
   */
  readonly photos = input<PropertyPhoto[]>([]);

  /**
   * Whether photos are currently loading
   */
  readonly isLoading = input<boolean>(false);

  /**
   * Emitted when user clicks "Add Photo" button
   */
  readonly addPhotoClick = output<void>();

  /**
   * Emitted when user clicks on a photo (for lightbox/details)
   */
  readonly photoClick = output<PropertyPhoto>();

  /**
   * Skeleton placeholder items for loading state
   */
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];

  /**
   * Handle image load event for fade-in animation (AC-13.3b.6)
   */
  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }
}
