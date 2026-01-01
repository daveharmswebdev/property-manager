import { Component, computed, input, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Receipt Image Viewer Component (AC-5.4.2)
 *
 * Displays receipt image with:
 * - Zoom in/out controls (50%-200% range)
 * - Pan/drag functionality when zoomed
 * - Rotate controls (90 degree increments)
 * - Loading spinner while image loads
 * - Error state with retry button
 * - PDF handling: show icon + "View PDF" link
 */
@Component({
  selector: 'app-receipt-image-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DecimalPipe,
  ],
  template: `
    <div class="viewer-container" data-testid="receipt-image-viewer">
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
          >{{ scale() * 100 | number : '1.0-0' }}%</span
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
        <p>PDF Receipt</p>
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
        @if (isLoading() && !hasError()) {
        <mat-spinner diameter="40" data-testid="loading-spinner"></mat-spinner>
        } @if (!hasError()) {
        <img
          [src]="viewUrl()"
          [style.transform]="imageTransform()"
          [class.loading]="isLoading()"
          (load)="onImageLoad()"
          (error)="onImageError()"
          alt="Receipt"
          draggable="false"
          data-testid="receipt-image"
        />
        } @if (hasError()) {
        <div class="error-state" data-testid="error-state">
          <mat-icon>error</mat-icon>
          <p>Failed to load image</p>
          <button mat-stroked-button (click)="retry()" data-testid="retry-btn">
            Retry
          </button>
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .viewer-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #f5f5f5;
        border-radius: 8px;
        overflow: hidden;
      }

      .viewer-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      .zoom-level {
        min-width: 48px;
        text-align: center;
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
      }

      .image-viewport {
        flex: 1;
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

      .pdf-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: rgba(0, 0, 0, 0.6);
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
        color: rgba(0, 0, 0, 0.6);
      }

      .error-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #f44336;
      }

      mat-spinner {
        position: absolute;
      }
    `,
  ],
})
export class ReceiptImageViewerComponent {
  /** The presigned S3 URL for viewing the receipt */
  viewUrl = input.required<string>();

  /** The content type of the receipt file */
  contentType = input.required<string>();

  /** Current zoom scale (0.5 - 2.0) */
  protected scale = signal(1);

  /** Current rotation in degrees */
  protected rotation = signal(0);

  /** Current X translation for panning */
  protected translateX = signal(0);

  /** Current Y translation for panning */
  protected translateY = signal(0);

  /** Whether the image is still loading */
  protected isLoading = signal(true);

  /** Whether the image failed to load */
  protected hasError = signal(false);

  /** Whether the user is currently dragging the image */
  protected isDragging = signal(false);

  /** Last mouse X position for drag calculation */
  private lastMouseX = 0;

  /** Last mouse Y position for drag calculation */
  private lastMouseY = 0;

  /** Whether the receipt is a PDF file */
  protected isPdf = computed(
    () => this.contentType()?.toLowerCase() === 'application/pdf'
  );

  /** Combined CSS transform for the image */
  protected imageTransform = computed(
    () =>
      `scale(${this.scale()}) rotate(${this.rotation()}deg) translate(${this.translateX()}px, ${this.translateY()}px)`
  );

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

  /** Handle successful image load */
  protected onImageLoad(): void {
    this.isLoading.set(false);
  }

  /** Handle image load error */
  protected onImageError(): void {
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  /** Retry loading the image */
  protected retry(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    // Force reload by appending timestamp - but we can't modify the input
    // The parent component should provide a new URL or the browser cache should be cleared
  }
}
