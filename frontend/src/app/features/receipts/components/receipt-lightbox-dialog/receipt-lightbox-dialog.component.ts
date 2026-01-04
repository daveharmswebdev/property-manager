import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReceiptImageViewerComponent } from '../receipt-image-viewer/receipt-image-viewer.component';
import { ApiClient, ReceiptDto } from '../../../../core/api/api.service';

/**
 * Dialog data for Receipt Lightbox
 */
export interface ReceiptLightboxDialogData {
  receiptId: string;
}

/**
 * Receipt Lightbox Dialog Component (AC-5.5.1, AC-5.5.2)
 *
 * Displays receipt image in a lightbox/modal with:
 * - Full zoom/pan/rotate controls via ReceiptImageViewerComponent
 * - Loading spinner while fetching receipt
 * - Error state if receipt not found
 * - Close button to return to caller
 */
@Component({
  selector: 'app-receipt-lightbox-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReceiptImageViewerComponent,
  ],
  template: `
    <div class="lightbox-container" data-testid="receipt-lightbox">
      <div class="lightbox-header">
        <h3>Receipt</h3>
        <button
          mat-icon-button
          (click)="close()"
          aria-label="Close"
          data-testid="close-btn"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="lightbox-content">
        @if (isLoading()) {
          <mat-spinner diameter="40" data-testid="loading-spinner"></mat-spinner>
        } @else if (error()) {
          <div class="error-state" data-testid="error-state">
            <mat-icon>error</mat-icon>
            <p>{{ error() }}</p>
          </div>
        } @else if (receipt()) {
          <app-receipt-image-viewer
            [viewUrl]="receipt()!.viewUrl!"
            [contentType]="receipt()!.contentType!"
            data-testid="receipt-viewer"
          />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .lightbox-container {
        width: 75vw;
        height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .lightbox-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);

        h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 500;
        }
      }

      .lightbox-content {
        flex: 1;
        min-height: 0;
        display: flex;
        width: 100%;
      }

      .error-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: rgba(0, 0, 0, 0.6);

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #f44336;
        }
      }

      app-receipt-image-viewer {
        display: block;
        width: 100%;
        height: 100%;
      }

      /* Mobile: Full-screen dialog */
      @media (max-width: 767px) {
        .lightbox-container {
          width: 100vw;
          height: 100vh;
        }
      }
    `,
  ],
})
export class ReceiptLightboxDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<ReceiptLightboxDialogComponent>
  );
  private readonly api = inject(ApiClient);
  protected readonly data: ReceiptLightboxDialogData = inject(MAT_DIALOG_DATA);

  receipt = signal<ReceiptDto | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReceipt();
  }

  private loadReceipt(): void {
    this.api.receipts_GetReceipt(this.data.receiptId).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load receipt');
        this.isLoading.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
