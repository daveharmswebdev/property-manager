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
 * Receipt Store State Interface (AC-5.3.1, AC-5.3.2, AC-5.3.4)
 */
interface ReceiptState {
  unprocessedReceipts: UnprocessedReceiptDto[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Initial state for receipt store
 */
const initialState: ReceiptState = {
  unprocessedReceipts: [],
  isLoading: false,
  error: null,
};

/**
 * ReceiptStore (AC-5.3.1, AC-5.3.2, AC-5.3.4)
 *
 * State management for receipts using @ngrx/signals.
 * Provides:
 * - Unprocessed receipts list with loading/error states
 * - Computed signal for unprocessed count (for navigation badge)
 * - Method to load unprocessed receipts from API
 * - Receipts are sorted by createdAt descending (newest first)
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
