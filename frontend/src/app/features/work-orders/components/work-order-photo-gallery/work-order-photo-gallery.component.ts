import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkOrderPhotoDto } from '../../../../core/api/api.service';

/**
 * WorkOrderPhotoGalleryComponent
 *
 * Displays work order photos in a responsive grid with drag-drop reordering
 * and primary photo selection (symmetric with PropertyPhotoGalleryComponent).
 *
 * Features:
 * - Empty state with upload CTA when no photos
 * - Skeleton loading placeholders during fetch
 * - Fade-in animations when photos load
 * - Responsive grid (1/2/3 columns based on viewport)
 * - Drag-drop reordering (desktop) with arrow buttons (mobile)
 * - Primary photo indicator with heart icon
 */
@Component({
  selector: 'app-work-order-photo-gallery',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
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
            <mat-icon>{{ isUploadVisible() ? 'close' : 'add_a_photo' }}</mat-icon>
            {{ isUploadVisible() ? 'Close' : 'Add Photo' }}
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

        <!-- Photo Grid with drag-drop -->
        @if (!isLoading() && photos().length > 0) {
          <div class="gallery-grid" cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="onDrop($event)" data-testid="photo-grid">
            @for (photo of photos(); track photo.id; let i = $index; let first = $first; let last = $last) {
              <div
                class="photo-card"
                cdkDrag
                [cdkDragDisabled]="photos().length <= 1"
                [class.is-primary]="photo.isPrimary"
                tabindex="0"
                role="button"
                [attr.data-testid]="'photo-card-' + photo.id"
                [attr.aria-label]="'View ' + (photo.originalFileName || 'photo')">
                <!-- Drag Placeholder -->
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
                <!-- Favorite Button -->
                <button
                  class="favorite-btn"
                  [class.is-primary]="photo.isPrimary"
                  (click)="onSetPrimary(photo, $event)"
                  [attr.aria-label]="photo.isPrimary ? 'Primary photo' : 'Set as primary photo'"
                  data-testid="favorite-btn">
                  <mat-icon>{{ photo.isPrimary ? 'favorite' : 'favorite_border' }}</mat-icon>
                </button>

                <!-- Photo Image (clickable area) -->
                <img
                  [src]="photo.thumbnailUrl || photo.photoUrl"
                  [alt]="photo.originalFileName || 'Work order photo'"
                  class="photo-img"
                  loading="lazy"
                  (load)="onImageLoad($event)"
                  (click)="photoClick.emit(photo)"
                  (keydown.enter)="photoClick.emit(photo)"
                />

                <!-- Photo Card Overlay with Actions -->
                <div class="photo-overlay">
                  <!-- Reorder Buttons (mobile) -->
                  @if (photos().length > 1) {
                    <div class="reorder-buttons">
                      <button
                        mat-icon-button
                        class="reorder-btn"
                        [disabled]="first"
                        (click)="onMoveUp(photo, i, $event)"
                        matTooltip="Move up"
                        data-testid="move-up-button"
                        aria-label="Move photo up">
                        <mat-icon>arrow_upward</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        class="reorder-btn"
                        [disabled]="last"
                        (click)="onMoveDown(photo, i, $event)"
                        matTooltip="Move down"
                        data-testid="move-down-button"
                        aria-label="Move photo down">
                        <mat-icon>arrow_downward</mat-icon>
                      </button>
                    </div>
                  }

                  <!-- Delete Button -->
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
      cursor: grab;
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

      &:active {
        cursor: grabbing;
      }

      &:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
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

    /* Favorite Button */
    .favorite-btn {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(255, 255, 255, 0.9);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #666;
      }

      &.is-primary mat-icon {
        color: #e91e63;
      }

      &:hover {
        background: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
    }

    /* Photo Overlay with Actions */
    .photo-overlay {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-end;
      padding: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
      background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%);
      z-index: 1;
      pointer-events: none;
    }

    .photo-overlay button,
    .photo-overlay .reorder-buttons {
      pointer-events: auto;
    }

    .photo-card:hover .photo-overlay,
    .photo-card:focus-within .photo-overlay {
      opacity: 1;
    }

    .reorder-buttons {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .reorder-btn,
    .delete-btn {
      background-color: rgba(255, 255, 255, 0.9);
      color: var(--pm-text-primary, #333);
      width: 32px;
      height: 32px;

      &:hover:not(:disabled) {
        background-color: white;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .delete-btn {
      align-self: flex-end;
      color: #c62828;

      mat-icon {
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

    /* Drag-and-Drop Styles */
    .drag-placeholder {
      aspect-ratio: 4 / 3;
      background: var(--pm-surface-variant, #f5f5f5);
      border: 2px dashed var(--pm-primary);
      border-radius: 8px;
    }

    .cdk-drag-preview {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      opacity: 0.9;
    }

    .cdk-drag-animating {
      transition: transform 200ms ease;
    }

    .cdk-drop-list-dragging .photo-card:not(.cdk-drag-placeholder) {
      transition: transform 200ms ease;
    }

    /* Responsive: Hide move buttons on desktop */
    @media (min-width: 768px) {
      .reorder-buttons {
        display: none;
      }
    }

    /* Responsive: Disable drag on mobile, show move buttons */
    @media (max-width: 767px) {
      .photo-card {
        cursor: pointer;
      }

      .reorder-buttons {
        display: flex;
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
   * Whether the upload zone is currently visible
   * Used to change button text from "Add Photo" to "Close"
   */
  readonly isUploadVisible = input<boolean>(false);

  /**
   * Emitted when user clicks "Add Photo" button
   */
  readonly addPhotoClick = output<void>();

  /**
   * Emitted when user clicks on a photo (for lightbox)
   */
  readonly photoClick = output<WorkOrderPhotoDto>();

  /**
   * Emitted when user clicks "Set as Primary" (heart icon)
   */
  readonly setPrimaryClick = output<WorkOrderPhotoDto>();

  /**
   * Emitted when user clicks delete button
   */
  readonly deleteClick = output<WorkOrderPhotoDto>();

  /**
   * Emitted when photos are reordered
   * Emits the new order of photo IDs
   */
  readonly reorderClick = output<string[]>();

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
   * Set photo as primary
   * Only emits if photo is not already primary
   */
  onSetPrimary(photo: WorkOrderPhotoDto, event: Event): void {
    event.stopPropagation();
    if (!photo.isPrimary) {
      this.setPrimaryClick.emit(photo);
    }
  }

  /**
   * Delete photo
   */
  onDelete(photo: WorkOrderPhotoDto, event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit(photo);
  }

  /**
   * Handle drag-and-drop photo reordering
   */
  onDrop(event: CdkDragDrop<WorkOrderPhotoDto[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const photos = [...this.photos()];
      moveItemInArray(photos, event.previousIndex, event.currentIndex);
      const newOrder = photos.map(p => p.id!);
      this.reorderClick.emit(newOrder);
    }
  }

  /**
   * Move photo up in display order
   */
  onMoveUp(photo: WorkOrderPhotoDto, index: number, event: Event): void {
    event.stopPropagation();
    if (index > 0) {
      const photos = [...this.photos()];
      const newOrder = photos.map(p => p.id!);
      // Swap with previous
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      this.reorderClick.emit(newOrder);
    }
  }

  /**
   * Move photo down in display order
   */
  onMoveDown(photo: WorkOrderPhotoDto, index: number, event: Event): void {
    event.stopPropagation();
    const photos = this.photos();
    if (index < photos.length - 1) {
      const newOrder = photos.map(p => p.id!);
      // Swap with next
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      this.reorderClick.emit(newOrder);
    }
  }
}
