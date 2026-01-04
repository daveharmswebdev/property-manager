import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import {
  ApiClient,
  UnprocessedReceiptDto,
} from '../../../core/api/api.service';

/**
 * Receipt Store State Interface (AC-5.3.1, AC-5.3.2, AC-5.3.4, AC-5.6.3)
 */
interface ReceiptState {
  unprocessedReceipts: UnprocessedReceiptDto[];
  isLoading: boolean;
  error: string | null;
  /** IDs of receipts recently added via SignalR (for animation, AC-5.6.3) */
  newReceiptIds: Set<string>;
}

/**
 * Initial state for receipt store
 */
const initialState: ReceiptState = {
  unprocessedReceipts: [],
  isLoading: false,
  error: null,
  newReceiptIds: new Set(),
};

/**
 * ReceiptStore (AC-5.3.1, AC-5.3.2, AC-5.3.4, AC-5.6.3)
 *
 * State management for receipts using @ngrx/signals.
 * Provides:
 * - Unprocessed receipts list with loading/error states
 * - Computed signal for unprocessed count (for navigation badge)
 * - Method to load unprocessed receipts from API
 * - Receipts are sorted by createdAt descending (newest first)
 * - Tracking of new receipt IDs for animation (AC-5.6.3)
 */
export const ReceiptStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Count of unprocessed receipts for navigation badge (AC-5.3.1)
     */
    unprocessedCount: computed(() => store.unprocessedReceipts().length),

    /**
     * Whether there are no unprocessed receipts
     */
    isEmpty: computed(() => store.unprocessedReceipts().length === 0),

    /**
     * Whether we have receipts loaded (not loading and not empty)
     */
    hasReceipts: computed(
      () => !store.isLoading() && store.unprocessedReceipts().length > 0
    ),
  })),
  withMethods((store, api = inject(ApiClient)) => ({
    /**
     * Load unprocessed receipts from API (AC-5.3.2, AC-5.3.4)
     * Receipts are returned sorted by createdAt descending (newest first)
     */
    async loadUnprocessedReceipts(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      try {
        const response = await firstValueFrom(api.receipts_GetUnprocessed());
        // Server returns receipts sorted by createdAt descending (newest first)
        patchState(store, {
          unprocessedReceipts: response.items || [],
          isLoading: false,
        });
      } catch (error) {
        console.error('Error loading unprocessed receipts:', error);
        patchState(store, {
          isLoading: false,
          error: 'Failed to load receipts',
        });
      }
    },

    /**
     * Remove a receipt from the queue (called after processing)
     * This provides optimistic UI update without full reload
     */
    removeFromQueue(receiptId: string): void {
      patchState(store, (state) => ({
        unprocessedReceipts: state.unprocessedReceipts.filter(
          (r) => r.id !== receiptId
        ),
      }));
    },

    /**
     * Add a receipt to the queue (called after new capture)
     * This provides optimistic UI update without full reload
     */
    addToQueue(receipt: UnprocessedReceiptDto): void {
      patchState(store, (state) => ({
        // Add to beginning since it's newest
        unprocessedReceipts: [receipt, ...state.unprocessedReceipts],
      }));
    },

    /**
     * Add a receipt from SignalR real-time update (AC-5.6.1, AC-5.6.3)
     * Handles duplicate prevention for receipts received via both HTTP and SignalR
     * Tracks new receipt ID for animation
     */
    addReceiptRealTime(receipt: UnprocessedReceiptDto): void {
      // Check for duplicates (may already exist from HTTP response)
      const existing = store.unprocessedReceipts().find((r) => r.id === receipt.id);
      if (existing) {
        console.log('ReceiptStore: Receipt already exists, skipping duplicate:', receipt.id);
        return;
      }

      // Add to beginning of list (newest first) and track as new for animation
      patchState(store, (state) => {
        const newIds = new Set(state.newReceiptIds);
        if (receipt.id) {
          newIds.add(receipt.id);
          // Auto-remove from new list after animation duration (2.3 seconds)
          setTimeout(() => {
            patchState(store, (s) => {
              const updated = new Set(s.newReceiptIds);
              if (receipt.id) updated.delete(receipt.id);
              return { newReceiptIds: updated };
            });
          }, 2300);
        }
        return {
          unprocessedReceipts: [receipt, ...state.unprocessedReceipts],
          newReceiptIds: newIds,
        };
      });
    },

    /**
     * Check if a receipt is new (for animation, AC-5.6.3)
     */
    isNewReceipt(receiptId: string): boolean {
      return store.newReceiptIds().has(receiptId);
    },

    /**
     * Clear error state
     */
    clearError(): void {
      patchState(store, { error: null });
    },

    /**
     * Reset store to initial state
     */
    reset(): void {
      patchState(store, initialState);
    },
  }))
);
