import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ReceiptStore } from './stores/receipt.store';
import { ReceiptQueueItemComponent } from './components/receipt-queue-item/receipt-queue-item.component';
import { ApiClient, UnprocessedReceiptDto } from '../../core/api/api.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Receipts Page Component (AC-5.3.2, AC-5.3.3)
 *
 * Displays the unprocessed receipt queue with:
 * - Page title "Receipts to Process"
 * - Loading spinner while fetching
 * - Empty state with checkmark and message when no receipts
 * - List of receipt queue items when receipts exist
 */
@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    ReceiptQueueItemComponent,
  ],
  template: `
    <div class="receipts-page">
      <h1 class="page-title">Receipts to Process</h1>

      @if (store.isLoading()) {
        <div class="loading" data-testid="receipts-loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (store.isEmpty()) {
        <div class="empty-state" data-testid="receipts-empty">
          <mat-icon class="check-icon">check_circle</mat-icon>
          <h2>All caught up!</h2>
          <p>No receipts to process.</p>
        </div>
      } @else {
        <div class="receipt-queue" data-testid="receipts-queue">
          @for (receipt of store.unprocessedReceipts(); track receipt.id) {
            <app-receipt-queue-item
              [receipt]="receipt"
              (clicked)="onReceiptClick(receipt)"
              (delete)="onDeleteReceipt($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .receipts-page {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .page-title {
        margin: 0 0 24px 0;
        font-size: 1.5rem;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.87);
      }

      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        text-align: center;
        padding: 48px;
      }

      .check-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--pm-primary, #2e7d32);
        margin-bottom: 16px;
      }

      .empty-state h2 {
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.87);
      }

      .empty-state p {
        margin: 0;
        color: rgba(0, 0, 0, 0.6);
      }

      .receipt-queue {
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class ReceiptsComponent implements OnInit {
  readonly store = inject(ReceiptStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = inject(ApiClient);

  ngOnInit(): void {
    this.store.loadUnprocessedReceipts();
  }

  onReceiptClick(receipt: UnprocessedReceiptDto): void {
    // Navigate to receipt processing view (Story 5.4)
    this.router.navigate(['/receipts', receipt.id]);
  }

  /**
   * Handle delete receipt event from queue item (AC-5.5.3)
   */
  onDeleteReceipt(receiptId: string): void {
    const dialogData: ConfirmDialogData = {
      title: 'Delete Receipt',
      message: 'Are you sure you want to delete this receipt? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'delete',
      iconColor: 'warn',
      confirmIcon: 'delete',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data: dialogData })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteReceipt(receiptId);
        }
      });
  }

  private deleteReceipt(receiptId: string): void {
    this.api.receipts_DeleteReceipt(receiptId).subscribe({
      next: () => {
        this.store.removeFromQueue(receiptId);
        this.snackBar.open('Receipt deleted', 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.snackBar.open('Failed to delete receipt', 'Close', {
          duration: 3000,
        });
      },
    });
  }
}
