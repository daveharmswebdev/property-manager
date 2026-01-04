import { Injectable, inject, OnDestroy, effect } from '@angular/core';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { ReceiptStore } from '../stores/receipt.store';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * SignalR event data for a newly added receipt (AC-5.6.1).
 */
export interface ReceiptAddedEvent {
  id: string;
  thumbnailUrl?: string;
  propertyId?: string;
  propertyName?: string;
  createdAt: string;
}

/**
 * SignalR event data for a receipt linked to an expense (AC-5.6.2).
 */
export interface ReceiptLinkedEvent {
  receiptId: string;
  expenseId: string;
}

/**
 * SignalR event data for a deleted receipt.
 */
export interface ReceiptDeletedEvent {
  receiptId: string;
}

/**
 * Receipt-specific SignalR service (AC-5.6.1, AC-5.6.2, AC-5.6.3).
 *
 * Subscribes to receipt events from SignalR and updates the ReceiptStore
 * to provide real-time updates across devices.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptSignalRService implements OnDestroy {
  private readonly signalR = inject(SignalRService);
  private readonly receiptStore = inject(ReceiptStore);
  private readonly snackBar = inject(MatSnackBar);

  private isSubscribed = false;

  /**
   * Initialize SignalR connection and subscribe to receipt events.
   */
  async initialize(): Promise<void> {
    await this.signalR.connect();
    this.subscribeToEvents();
  }

  /**
   * Subscribe to receipt-related SignalR events.
   */
  private subscribeToEvents(): void {
    if (this.isSubscribed) return;

    // Receipt Added - new receipt captured on another device (AC-5.6.1)
    this.signalR.on<ReceiptAddedEvent>('ReceiptAdded', (event) => {
      console.log('SignalR: ReceiptAdded', event);

      // Add to store with real-time update (handles duplicates)
      // Note: viewUrl will be undefined since SignalR doesn't send the full URL
      // The receipt will be visible but without thumbnail until page refresh
      this.receiptStore.addReceiptRealTime({
        id: event.id,
        propertyId: event.propertyId ?? undefined,
        propertyName: event.propertyName ?? undefined,
        createdAt: new Date(event.createdAt),
        viewUrl: undefined,
        contentType: undefined,
      });
    });

    // Receipt Linked - receipt processed on another device (AC-5.6.2)
    this.signalR.on<ReceiptLinkedEvent>('ReceiptLinked', (event) => {
      console.log('SignalR: ReceiptLinked', event);
      this.receiptStore.removeFromQueue(event.receiptId);
    });

    // Receipt Deleted - receipt deleted on another device
    this.signalR.on<ReceiptDeletedEvent>('ReceiptDeleted', (event) => {
      console.log('SignalR: ReceiptDeleted', event);
      this.receiptStore.removeFromQueue(event.receiptId);
    });

    this.isSubscribed = true;
  }

  /**
   * Handle reconnection by syncing current state (AC-5.6.4).
   */
  async handleReconnection(): Promise<void> {
    console.log('SignalR: Syncing receipts after reconnection...');
    this.snackBar.open('Reconnected - syncing receipts...', undefined, {
      duration: 2000,
    });

    // Reload unprocessed receipts to get current server state
    await this.receiptStore.loadUnprocessedReceipts();
  }

  /**
   * Cleanup subscriptions on destroy.
   */
  ngOnDestroy(): void {
    this.signalR.off('ReceiptAdded');
    this.signalR.off('ReceiptLinked');
    this.signalR.off('ReceiptDeleted');
    this.isSubscribed = false;
  }
}
