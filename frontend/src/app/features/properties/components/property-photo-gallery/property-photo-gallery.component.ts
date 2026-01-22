import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    DragDropModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatTooltipModule,
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

        <!-- Photo Grid (AC-13.3b.2, AC-13.3b.5, AC-13.3b.6, AC-13.3c.4, AC-13.3c.5, AC-13.3c.6, AC-13.3c.15, AC-13.3c.16) -->
        @if (!isLoading() && photos().length > 0) {
          <div class="gallery-grid" cdkDropList (cdkDropListDropped)="onDrop($event)">
            @for (photo of photos(); track photo.id; let i = $index; let first = $first; let last = $last) {
              <div
                class="photo-card"
                cdkDrag
                [cdkDragDisabled]="photos().length <= 1"
                [class.is-primary]="photo.isPrimary"
                tabindex="0"
                role="button"
                [attr.aria-label]="'View ' + (photo.originalFileName || 'photo')">
                <!-- Drag Placeholder (AC-13.3c.15) -->
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
                <!-- Favorite Button (AC-13.3c.13, AC-13.3c.14) -->
                <button
                  class="favorite-btn"
                  [class.is-primary]="photo.isPrimary"
                  (click)="onSetPrimary(photo, $event)"
                  [attr.aria-label]="photo.isPrimary ? 'Primary photo' : 'Set as primary photo'"
                  data-testid="favorite-btn">
                  <mat-icon>{{ photo.isPrimary ? 'favorite' : 'favorite_border' }}</mat-icon>
                </button>

                <!-- Drag Handle (AC-13.3c.15) - Desktop only -->
                @if (photos().length > 1) {
                  <div class="drag-handle" cdkDragHandle data-testid="drag-handle">
                    <mat-icon>drag_indicator</mat-icon>
                  </div>
                }

                <!-- Photo Image (clickable area) -->
                <img
                  [src]="photo.thumbnailUrl || photo.viewUrl"
                  [alt]="photo.originalFileName || 'Property photo'"
                  class="photo-img"
                  loading="lazy"
                  (load)="onImageLoad($event)"
                  (click)="photoClick.emit(photo)"
                  (keydown.enter)="photoClick.emit(photo)"
                />

                <!-- Photo Card Overlay with Actions -->
                <div class="photo-overlay">
                  <!-- Reorder Buttons (AC-13.3c.6) -->
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

                  <!-- Context Menu Button (AC-13.3c.5) -->
                  <button
                    mat-icon-button
                    class="menu-btn"
                    [matMenuTriggerFor]="photoMenu"
                    (click)="$event.stopPropagation()"
                    data-testid="photo-menu-button"
                    aria-label="Photo options">
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #photoMenu="matMenu">
                    @if (!photo.isPrimary) {
                      <button mat-menu-item (click)="setPrimaryClick.emit(photo)" data-testid="set-primary-menu-item">
                        <mat-icon>star</mat-icon>
                        <span>Set as Primary</span>
                      </button>
                    }
                    <button mat-menu-item class="delete-menu-item" (click)="deleteClick.emit(photo)" data-testid="delete-menu-item">
                      <mat-icon color="warn">delete</mat-icon>
                      <span>Delete</span>
                    </button>
                  </mat-menu>
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

    /* Favorite Button (AC-13.3c.13, AC-13.3c.14) */
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
        transform: scale(1.1);
      }
    }

    /* Drag Handle (AC-13.3c.15) */
    .drag-handle {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 4px;
      width: 32px;
      height: 32px;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      opacity: 0;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #666;
      }

      &:hover {
        background: white;
        transform: scale(1.1);
      }

      &:active {
        cursor: grabbing;
      }
    }

    .photo-card:hover .drag-handle {
      opacity: 1;
    }

    /* Photo Overlay with Actions (AC-13.3c.5, AC-13.3c.6) */
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
      pointer-events: none; /* Don't block drag interactions */
    }

    .photo-overlay button,
    .photo-overlay .reorder-buttons {
      pointer-events: auto; /* Re-enable for buttons only */
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
    .menu-btn {
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

    .menu-btn {
      align-self: flex-end;
    }

    .delete-menu-item {
      color: #c62828;
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

    /* Drag-and-Drop Styles (AC-13.3c.15) */
    .photo-card {
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }

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

    /* Responsive: Hide move buttons on desktop, show drag handle (AC-13.3c.16) */
    @media (min-width: 768px) {
      .reorder-buttons {
        display: none;
      }

      .drag-handle {
        display: flex;
      }
    }

    /* Responsive: Disable drag on mobile, show move buttons (AC-13.3c.16) */
    @media (max-width: 767px) {
      .photo-card {
        cursor: pointer;
      }

      .drag-handle {
        display: none !important;
      }

      .reorder-buttons {
        display: flex;
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
   * Emitted when user clicks "Set as Primary" in context menu (AC-13.3c.5)
   */
  readonly setPrimaryClick = output<PropertyPhoto>();

  /**
   * Emitted when user clicks "Delete" in context menu (AC-13.3c.5)
   */
  readonly deleteClick = output<PropertyPhoto>();

  /**
   * Emitted when photos are reordered (AC-13.3c.6)
   * Emits the new order of photo IDs
   */
  readonly reorderClick = output<string[]>();

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

  /**
   * Set photo as primary (AC-13.3c.14)
   * Only emits if photo is not already primary
   */
  onSetPrimary(photo: PropertyPhoto, event: Event): void {
    event.stopPropagation();
    if (!photo.isPrimary) {
      this.setPrimaryClick.emit(photo);
    }
  }

  /**
   * Handle drag-and-drop photo reordering (AC-13.3c.15)
   */
  onDrop(event: CdkDragDrop<PropertyPhoto[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const photos = [...this.photos()];
      moveItemInArray(photos, event.previousIndex, event.currentIndex);
      const newOrder = photos.map(p => p.id);
      this.reorderClick.emit(newOrder);
    }
  }

  /**
   * Move photo up in display order (AC-13.3c.6)
   */
  onMoveUp(photo: PropertyPhoto, index: number, event: Event): void {
    event.stopPropagation();
    if (index > 0) {
      const photos = [...this.photos()];
      const newOrder = photos.map(p => p.id);
      // Swap with previous
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      this.reorderClick.emit(newOrder);
    }
  }

  /**
   * Move photo down in display order (AC-13.3c.6)
   */
  onMoveDown(photo: PropertyPhoto, index: number, event: Event): void {
    event.stopPropagation();
    const photos = this.photos();
    if (index < photos.length - 1) {
      const newOrder = photos.map(p => p.id);
      // Swap with next
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      this.reorderClick.emit(newOrder);
    }
  }
}
