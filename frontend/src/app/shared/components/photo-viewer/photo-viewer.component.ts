import { Component, computed, effect, input, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Photo Viewer Component
 *
 * Reusable component for displaying photos with:
 * - Thumbnail-first loading (optional) for list view optimization
 * - Zoom in/out controls (50%-200% range)
 * - Pan/drag functionality when zoomed
 * - Rotate controls (90 degree increments)
 * - Loading spinner while image loads
 * - Error state with retry button
 * - PDF handling: show icon + "View PDF" link
 */
@Component({
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe],
  template: `
    <div class="viewer-container" data-testid="photo-viewer">
      <!-- Controls -->
      <div class="viewer-controls" data-testid="viewer-controls">
        <button
          mat-icon-button
          (click)="zoomOut()"
          [disabled]="scale() <= 0.5"
          aria-label="Zoom out"
          data-testid="zoom-out-btn"
        >
          <mat-icon>remove</mat-icon>
        </button>
        <span class="zoom-level" data-testid="zoom-level"
          >{{ scale() * 100 | number: '1.0-0' }}%</span
        >
        <button
          mat-icon-button
          (click)="zoomIn()"
          [disabled]="scale() >= 2"
          aria-label="Zoom in"
          data-testid="zoom-in-btn"
        >
          <mat-icon>add</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="rotateLeft()"
          aria-label="Rotate left"
          data-testid="rotate-left-btn"
        >
          <mat-icon>rotate_left</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="rotateRight()"
          aria-label="Rotate right"
          data-testid="rotate-right-btn"
        >
          <mat-icon>rotate_right</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="resetView()"
          aria-label="Reset view"
          data-testid="reset-btn"
        >
          <mat-icon>restart_alt</mat-icon>
        </button>
      </div>

      <!-- Image/PDF Display -->
      @if (isPdf()) {
        <div class="pdf-placeholder" data-testid="pdf-placeholder">
          <mat-icon>description</mat-icon>
          <p>PDF Document</p>
          <a
            [href]="viewUrl()"
            target="_blank"
            rel="noopener noreferrer"
            mat-stroked-button
            data-testid="open-pdf-btn"
          >
            Open PDF
          </a>
        </div>
      } @else {
        <div
          class="image-viewport"
          (mousedown)="onMouseDown($event)"
          (mousemove)="onMouseMove($event)"
          (mouseup)="onMouseUp()"
          (mouseleave)="onMouseUp()"
          (wheel)="onWheel($event)"
          [class.grabbing]="isDragging()"
          data-testid="image-viewport"
        >
          @if (isLoadingThumbnail() && !hasError()) {
            <mat-spinner diameter="40" data-testid="loading-spinner"></mat-spinner>
          }
          @if (!hasError()) {
            <!-- Show thumbnail first if available, then transition to full image -->
            @if (showThumbnail() && effectiveThumbnailUrl()) {
              <img
                [src]="effectiveThumbnailUrl()"
                [style.transform]="imageTransform()"
                [class.loading]="isLoadingThumbnail()"
                (load)="onThumbnailLoad()"
                (error)="onImageError()"
                alt="Photo thumbnail"
                draggable="false"
                data-testid="photo-thumbnail"
              />
            }
            <img
              [src]="effectiveViewUrl()"
              [style.transform]="imageTransform()"
              [class.loading]="isLoadingFullImage()"
              [class.hidden]="showThumbnail() && !isFullImageLoaded()"
              (load)="onFullImageLoad()"
              (error)="onImageError()"
              alt="Photo"
              draggable="false"
              data-testid="photo-image"
            />
          }
          @if (hasError()) {
            <div class="error-state" data-testid="error-state">
              <mat-icon>error</mat-icon>
              <p>Failed to load image</p>
              <button mat-stroked-button (click)="retry()" data-testid="retry-btn">Retry</button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .viewer-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: var(--mat-sys-surface-container-low, #f5f5f5);
        border-radius: 8px;
      }

      .viewer-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px;
        background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.05));
        border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.1));
        flex-shrink: 0;
      }

      .zoom-level {
        min-width: 48px;
        text-align: center;
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }

      .image-viewport {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        position: relative;
      }

      .image-viewport.grabbing {
        cursor: grabbing;
      }

      .image-viewport img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.1s ease-out;
        user-select: none;
      }

      .image-viewport img.loading {
        opacity: 0.5;
      }

      .image-viewport img.hidden {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .pdf-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }

      .pdf-placeholder mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
      }

      .pdf-placeholder p {
        margin: 0;
        font-size: 1.125rem;
      }

      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }

      .error-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-error, #f44336);
      }

      mat-spinner {
        position: absolute;
      }
    `,
  ],
})
export class PhotoViewerComponent {
  /** The presigned URL for viewing the full-size photo (required) */
  viewUrl = input.required<string>();

  /** The presigned URL for viewing the thumbnail (optional, for list view optimization) */
  thumbnailUrl = input<string>();

  /** The content type of the photo file (required for PDF detection) */
  contentType = input.required<string>();

  /** Current zoom scale (0.5 - 2.0) */
  protected scale = signal(1);

  /** Current rotation in degrees */
  protected rotation = signal(0);

  /** Current X translation for panning */
  protected translateX = signal(0);

  /** Current Y translation for panning */
  protected translateY = signal(0);

  /** Whether the thumbnail is still loading */
  protected isLoadingThumbnail = signal(true);

  /** Whether the full image is still loading */
  protected isLoadingFullImage = signal(true);

  /** Whether the full image has finished loading */
  protected isFullImageLoaded = signal(false);

  /** Whether the image failed to load */
  protected hasError = signal(false);

  /** Whether the user is currently dragging the image */
  protected isDragging = signal(false);

  /** Timestamp for cache-busting on retry */
  private retryTimestamp = signal<number | null>(null);

  /** Last mouse X position for drag calculation */
  private lastMouseX = 0;

  /** Last mouse Y position for drag calculation */
  private lastMouseY = 0;

  /** Whether the file is a PDF */
  protected isPdf = computed(() => this.contentType()?.toLowerCase() === 'application/pdf');

  /** Whether to show the thumbnail (has thumbnail URL and full image not yet loaded) */
  protected showThumbnail = computed(() => !!this.thumbnailUrl() && !this.isFullImageLoaded());

  /** Effective view URL with cache-busting for retry */
  protected effectiveViewUrl = computed(() => {
    const url = this.viewUrl();
    const timestamp = this.retryTimestamp();
    if (timestamp) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}_retry=${timestamp}`;
    }
    return url;
  });

  /** Effective thumbnail URL with cache-busting for retry */
  protected effectiveThumbnailUrl = computed(() => {
    const url = this.thumbnailUrl();
    if (!url) return url;
    const timestamp = this.retryTimestamp();
    if (timestamp) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}_retry=${timestamp}`;
    }
    return url;
  });

  /** Combined CSS transform for the image */
  protected imageTransform = computed(
    () =>
      `scale(${this.scale()}) rotate(${this.rotation()}deg) translate(${this.translateX()}px, ${this.translateY()}px)`
  );

  constructor() {
    // Reset loading state when viewUrl changes
    effect(() => {
      const url = this.viewUrl();
      if (url) {
        this.isLoadingThumbnail.set(true);
        this.isLoadingFullImage.set(true);
        this.isFullImageLoaded.set(false);
        this.hasError.set(false);
      }
    });
  }

  /** Increase zoom level by 0.25 */
  protected zoomIn(): void {
    this.scale.update((s) => Math.min(s + 0.25, 2));
  }

  /** Decrease zoom level by 0.25 */
  protected zoomOut(): void {
    this.scale.update((s) => Math.max(s - 0.25, 0.5));
  }

  /** Rotate image 90 degrees counter-clockwise */
  protected rotateLeft(): void {
    this.rotation.update((r) => r - 90);
  }

  /** Rotate image 90 degrees clockwise */
  protected rotateRight(): void {
    this.rotation.update((r) => r + 90);
  }

  /** Reset all transformations to default */
  protected resetView(): void {
    this.scale.set(1);
    this.rotation.set(0);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  /** Handle mouse down event for panning */
  protected onMouseDown(event: MouseEvent): void {
    if (this.scale() > 1) {
      this.isDragging.set(true);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      event.preventDefault();
    }
  }

  /** Handle mouse move event for panning */
  protected onMouseMove(event: MouseEvent): void {
    if (this.isDragging()) {
      const dx = event.clientX - this.lastMouseX;
      const dy = event.clientY - this.lastMouseY;
      this.translateX.update((x) => x + dx / this.scale());
      this.translateY.update((y) => y + dy / this.scale());
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  /** Handle mouse up event to stop panning */
  protected onMouseUp(): void {
    this.isDragging.set(false);
  }

  /** Handle mouse wheel event for zooming */
  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  /** Handle successful thumbnail load */
  protected onThumbnailLoad(): void {
    this.isLoadingThumbnail.set(false);
  }

  /** Handle successful full image load */
  protected onFullImageLoad(): void {
    this.isLoadingFullImage.set(false);
    this.isFullImageLoaded.set(true);
  }

  /** Handle image load error */
  protected onImageError(): void {
    this.isLoadingThumbnail.set(false);
    this.isLoadingFullImage.set(false);
    this.hasError.set(true);
  }

  /** Retry loading the image */
  protected retry(): void {
    this.hasError.set(false);
    this.isLoadingThumbnail.set(true);
    this.isLoadingFullImage.set(true);
    this.isFullImageLoaded.set(false);
    // Set timestamp to cache-bust the URL and force browser to reload
    this.retryTimestamp.set(Date.now());
  }
}
