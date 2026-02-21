import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatDistanceToNow, format } from 'date-fns';

import { UnprocessedReceiptDto } from '../../../../core/api/api.service';

/**
 * Receipt Queue Item Component (AC-5.3.2, AC-5.3.5, AC-5.3.6, AC-5.6.3)
 *
 * Displays a single receipt in the unprocessed queue with:
 * - Thumbnail (image preview or PDF icon)
 * - Capture date (relative time format)
 * - Property name or "(unassigned)" in muted style
 * - Click handler for navigation to processing view
 * - Hover effect for clickability
 * - Slide-in animation for new receipts from SignalR (AC-5.6.3)
 */
@Component({
  selector: 'app-receipt-queue-item',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card
      class="receipt-item"
      [class.new-receipt]="isNew()"
      (click)="onClick()"
      data-testid="receipt-queue-item"
    >
      <div class="receipt-content">
        <div class="thumbnail" data-testid="receipt-thumbnail">
          @if (isPdf()) {
            <mat-icon class="pdf-icon">description</mat-icon>
          } @else if (imageError()) {
            <mat-icon class="fallback-icon">image</mat-icon>
          } @else {
            <img
              [src]="receipt().viewUrl"
              [alt]="'Receipt from ' + formattedDate()"
              (error)="onImageError()"
              class="receipt-thumb"
              loading="lazy"
            />
          }
        </div>
        <div class="details">
          <span class="date" data-testid="receipt-date">{{ formattedDate() }}</span>
          @if (exactDate()) {
            <span class="exact-date" data-testid="receipt-exact-date">{{ exactDate() }}</span>
          }
          <span
            class="property"
            [class.unassigned]="!receipt().propertyName"
            data-testid="receipt-property"
          >
            {{ receipt().propertyName || '(unassigned)' }}
          </span>
        </div>
        <button
          mat-icon-button
          class="delete-btn"
          (click)="onDelete($event)"
          matTooltip="Delete receipt"
          data-testid="delete-receipt-btn"
        >
          <mat-icon>delete</mat-icon>
        </button>
        <mat-icon class="chevron">chevron_right</mat-icon>
      </div>
    </mat-card>
  `,
  styles: [
    `
      .receipt-item {
        cursor: pointer;
        transition: box-shadow 0.2s ease;
        margin-bottom: 8px;
      }

      .receipt-item:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .receipt-content {
        display: flex;
        align-items: center;
        padding: 12px;
        gap: 16px;
      }

      .thumbnail {
        width: 64px;
        height: 64px;
        border-radius: 4px;
        overflow: hidden;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .receipt-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pdf-icon,
      .fallback-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #666;
      }

      .fallback-icon {
        color: #999;
      }

      .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .date {
        font-weight: 500;
        color: rgba(0, 0, 0, 0.87);
      }

      .exact-date {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
      }

      .property {
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .property.unassigned {
        font-style: italic;
        color: rgba(0, 0, 0, 0.38);
      }

      .delete-btn {
        opacity: 0;
        transition: opacity 0.2s ease;
        color: rgba(0, 0, 0, 0.38);
        flex-shrink: 0;

        &:hover {
          color: var(--mat-sys-error, #f44336);
        }
      }

      .receipt-item:hover .delete-btn {
        opacity: 1;
      }

      .chevron {
        color: rgba(0, 0, 0, 0.38);
        flex-shrink: 0;
      }

      /* Mobile: always show delete button */
      @media (max-width: 600px) {
        .delete-btn {
          opacity: 1;
        }
      }

      /* Animation for new receipts from SignalR (AC-5.6.3) */
      @keyframes slideIn {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes highlightPulse {
        0% {
          background-color: rgba(76, 175, 80, 0.15);
        }
        100% {
          background-color: transparent;
        }
      }

      .receipt-item.new-receipt {
        animation: slideIn 0.3s ease-out, highlightPulse 2s ease-out 0.3s;
      }
    `,
  ],
})
export class ReceiptQueueItemComponent {
  /** The receipt data to display */
  receipt = input.required<UnprocessedReceiptDto>();

  /** Whether this is a newly added receipt (for animation, AC-5.6.3) */
  isNew = input<boolean>(false);

  /** Emitted when the item is clicked */
  clicked = output<void>();

  /** Emitted when delete button is clicked (AC-5.5.3) */
  delete = output<string>();

  /** Whether the thumbnail image failed to load */
  imageError = signal(false);

  /** Whether the receipt is a PDF (shows document icon instead of thumbnail) */
  isPdf = computed(() => this.receipt().contentType === 'application/pdf');

  /** Formatted date using relative time (e.g., "2 hours ago") */
  formattedDate = computed(() => {
    const createdAt = this.receipt().createdAt;
    if (!createdAt) return 'Unknown date';
    const date = new Date(createdAt);
    return formatDistanceToNow(date, { addSuffix: true });
  });

  /** Exact formatted timestamp (e.g., "Jan 14, 2026 3:42 PM") */
  exactDate = computed(() => {
    const createdAt = this.receipt().createdAt;
    if (!createdAt) return '';
    const date = new Date(createdAt);
    return format(date, 'MMM d, yyyy h:mm a');
  });

  onClick(): void {
    this.clicked.emit();
  }

  onImageError(): void {
    // Set signal to show fallback icon instead of broken image
    this.imageError.set(true);
  }

  /**
   * Handle delete button click (AC-5.5.3)
   * Stops propagation to prevent navigation
   */
  onDelete(event: Event): void {
    event.stopPropagation();
    const receiptId = this.receipt().id;
    if (receiptId) {
      this.delete.emit(receiptId);
    }
  }
}
