import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ReceiptStore } from './stores/receipt.store';
import { ReceiptQueueItemComponent } from './components/receipt-queue-item/receipt-queue-item.component';
import { ReceiptUploadDialogComponent } from './components/receipt-upload-dialog/receipt-upload-dialog.component';
import { PropertyTagModalComponent, PropertyTagResult } from './components/property-tag-modal/property-tag-modal.component';
import { ReceiptCaptureService } from './services/receipt-capture.service';
import { ApiClient, UnprocessedReceiptDto } from '../../core/api/api.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Receipts Page Component (AC-5.3.2, AC-5.3.3)
 *
 * Displays the unprocessed receipt queue with:
 * - Page title "Receipts"
 * - Loading spinner while fetching
 * - Empty state with checkmark and message when no receipts
 * - List of receipt queue items when receipts exist
 */
@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    ReceiptQueueItemComponent,
  ],
  template: `
    <div class="receipts-page">
      <div class="page-header">
        <div class="page-header-content">
          <div>
            <h1>Receipts</h1>
            <p class="subtitle">Upload and process receipts for your properties</p>
          </div>
          <button
            mat-stroked-button
            color="primary"
            [disabled]="isUploading()"
            (click)="onUploadReceipt()"
            data-testid="upload-receipt-btn"
          >
            @if (isUploading()) {
              <mat-icon>hourglass_empty</mat-icon>
            } @else {
              <mat-icon>cloud_upload</mat-icon>
            }
            <span class="button-text">Upload Receipt</span>
          </button>
        </div>
      </div>

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
              [isNew]="store.isNewReceipt(receipt.id!)"
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

      .page-header {
        margin-bottom: 24px;
      }

      .page-header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .page-header h1 {
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
      }

      .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      @media (max-width: 599px) {
        .page-header-content {
          flex-direction: column;
          align-items: stretch;
        }
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
  private readonly receiptCaptureService = inject(ReceiptCaptureService);

  readonly isUploading = signal(false);

  ngOnInit(): void {
    this.store.loadUnprocessedReceipts();
  }

  async onUploadReceipt(): Promise<void> {
    // Step 1: Open file selection dialog
    const dialogRef = this.dialog.open(ReceiptUploadDialogComponent, { width: '500px' });
    const files: File[] | null = await firstValueFrom(dialogRef.afterClosed());
    if (!files || files.length === 0) return;

    // Step 2: Open PropertyTagModal for optional property assignment
    const tagRef = this.dialog.open(PropertyTagModalComponent, { width: '300px' });
    const tagResult: PropertyTagResult | undefined = await firstValueFrom(tagRef.afterClosed());
    if (tagResult === undefined) return; // backdrop dismiss = abort

    const propertyId = tagResult.propertyId || undefined;

    // Step 3: Upload each file
    this.isUploading.set(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      try {
        await this.receiptCaptureService.uploadReceipt(file, propertyId);
        successCount++;
      } catch {
        failCount++;
      }
    }

    this.isUploading.set(false);

    if (successCount > 0 && failCount > 0) {
      this.snackBar.open(
        `${successCount} uploaded, ${failCount} failed`,
        'Dismiss', { duration: 5000 }
      );
    } else if (successCount > 0) {
      const msg = successCount === 1
        ? 'Receipt uploaded successfully'
        : `${successCount} receipts uploaded successfully`;
      this.snackBar.open(msg, 'Dismiss', { duration: 3000 });
    } else if (failCount > 0) {
      this.snackBar.open(
        `Failed to upload ${failCount === 1 ? '1 receipt' : `${failCount} receipts`}`,
        'Dismiss', { duration: 5000 }
      );
    }
  }

  onReceiptClick(receipt: UnprocessedReceiptDto): void {
    // Navigate to receipt processing view (Story 5.4)
    this.router.navigate(['/receipts', receipt.id]);
  }

  /**
   * Handle delete receipt event from queue item (AC-5.5.3)
   */
  onDeleteReceipt(receiptId: string): void {
    const receipt = this.store.unprocessedReceipts().find(r => r.id === receiptId);
    const parts = [
      receipt?.propertyName,
      receipt?.createdAt ? new Date(receipt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
    ].filter(Boolean);
    const secondaryMessage = parts.length > 0 ? parts.join(' — ') : undefined;
    const dialogData: ConfirmDialogData = {
      title: 'Delete Receipt',
      message: 'Are you sure you want to delete this receipt? This action cannot be undone.',
      secondaryMessage,
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
