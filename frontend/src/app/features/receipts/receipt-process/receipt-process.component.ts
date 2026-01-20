import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiClient, ReceiptDto } from '../../../core/api/api.service';
import { ReceiptStore } from '../stores/receipt.store';
import { PhotoViewerComponent } from '../../../shared/components/photo-viewer/photo-viewer.component';
import { ReceiptExpenseFormComponent } from '../components/receipt-expense-form/receipt-expense-form.component';

/**
 * ReceiptProcessComponent (AC-5.4.1, AC-5.4.5, AC-5.4.6, AC-5.4.7)
 *
 * Page for processing a receipt into an expense with:
 * - Side-by-side layout (image viewer + expense form)
 * - Responsive stacking on mobile
 * - Assembly line workflow (auto-load next receipt)
 * - Redirect handling for already processed receipts
 */
@Component({
  selector: 'app-receipt-process',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    PhotoViewerComponent,
    ReceiptExpenseFormComponent,
  ],
  template: `
    <div class="receipt-process-page" data-testid="receipt-process-page">
      @if (isLoading()) {
        <div class="loading-state" data-testid="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading receipt...</p>
        </div>
      } @else if (error()) {
        <div class="error-state" data-testid="error-state">
          <mat-icon>error</mat-icon>
          <h2>{{ error() }}</h2>
          <button mat-stroked-button routerLink="/receipts" data-testid="back-to-receipts-btn">
            Back to Receipts
          </button>
        </div>
      } @else if (receipt()) {
        <div class="split-view" data-testid="split-view">
          <!-- Left: Image Viewer -->
          <div class="image-panel" data-testid="image-panel">
            <app-photo-viewer
              [viewUrl]="receipt()!.viewUrl!"
              [contentType]="receipt()!.contentType!"
            />
          </div>

          <!-- Right: Expense Form -->
          <div class="form-panel" data-testid="form-panel">
            <h2>Create Expense from Receipt</h2>
            <app-receipt-expense-form
              [receiptId]="receipt()!.id!"
              [propertyId]="receipt()!.propertyId ?? undefined"
              [defaultDate]="getReceiptDate()"
              (saved)="onExpenseSaved()"
              (cancelled)="onCancel()"
            />
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .receipt-process-page {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .loading-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: rgba(0, 0, 0, 0.6);
      }

      .error-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: rgba(0, 0, 0, 0.6);
      }

      .error-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #f44336;
      }

      .error-state h2 {
        margin: 0;
        font-weight: 400;
      }

      .split-view {
        flex: 1;
        display: flex;
        gap: 24px;
        padding: 24px;
        overflow: hidden;
      }

      .image-panel {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .form-panel {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: auto;
      }

      .form-panel h2 {
        margin: 0;
        padding: 16px;
        font-size: 1.25rem;
        font-weight: 500;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      /* Mobile: stack vertically */
      @media (max-width: 768px) {
        .split-view {
          flex-direction: column;
          padding: 16px;
        }

        .image-panel {
          height: 40vh;
          min-height: 200px;
          flex: none;
        }

        .form-panel {
          flex: 1;
          min-height: 0;
        }
      }
    `,
  ],
})
export class ReceiptProcessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly store = inject(ReceiptStore);
  private readonly snackBar = inject(MatSnackBar);

  protected receipt = signal<ReceiptDto | null>(null);
  protected isLoading = signal(true);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid receipt ID');
      this.isLoading.set(false);
      return;
    }
    this.loadReceipt(id);
  }

  private loadReceipt(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.receipts_GetReceipt(id).subscribe({
      next: (receipt) => {
        // Check if already processed (AC-5.4.7)
        if (receipt.processedAt) {
          this.snackBar.open('Receipt already processed', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
          this.router.navigate(['/receipts']);
          return;
        }
        this.receipt.set(receipt);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 404) {
          this.error.set('Receipt not found');
        } else {
          this.error.set('Failed to load receipt');
        }
      },
    });
  }

  /**
   * Handle successful expense save (AC-5.4.5 - Assembly Line)
   * Automatically navigate to next unprocessed receipt
   */
  protected onExpenseSaved(): void {
    // Remove from store (optimistic update)
    this.store.removeFromQueue(this.receipt()!.id!);

    // Assembly line: navigate to next receipt (AC-5.4.5)
    const remaining = this.store.unprocessedReceipts();
    if (remaining.length > 0) {
      // Navigate to next unprocessed receipt
      this.router.navigate(['/receipts', remaining[0].id]);
      // Load the next receipt
      this.loadReceipt(remaining[0].id!);
    } else {
      // No more receipts - navigate to receipts page
      this.snackBar.open('All caught up!', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      this.router.navigate(['/receipts']);
    }
  }

  /**
   * Handle cancel (AC-5.4.6)
   * Return to receipts queue without processing
   */
  protected onCancel(): void {
    this.router.navigate(['/receipts']);
  }

  /**
   * Get receipt date as a proper Date object
   * API may return date as string, ensure it's converted
   */
  protected getReceiptDate(): Date {
    const createdAt = this.receipt()?.createdAt;
    if (!createdAt) {
      return new Date();
    }
    // If it's already a Date object, return it
    if (createdAt instanceof Date) {
      return createdAt;
    }
    // Convert string to Date
    return new Date(createdAt);
  }
}
