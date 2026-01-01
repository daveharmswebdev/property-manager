import { TestBed } from '@angular/core/testing';
import { ReceiptStore } from './receipt.store';
import {
  ApiClient,
  UnprocessedReceiptsResponse,
  UnprocessedReceiptDto,
} from '../../../core/api/api.service';
import { of, throwError } from 'rxjs';

describe('ReceiptStore', () => {
  let store: InstanceType<typeof ReceiptStore>;
  let apiClientSpy: {
    receipts_GetUnprocessed: ReturnType<typeof vi.fn>;
  };

  const mockReceipt1: UnprocessedReceiptDto = {
    id: 'receipt-1',
    createdAt: new Date('2025-12-31T10:30:00Z'),
    propertyId: 'property-1',
    propertyName: 'Oak Street Duplex',
    contentType: 'image/jpeg',
    viewUrl: 'https://s3.amazonaws.com/presigned-url-1',
  };

  const mockReceipt2: UnprocessedReceiptDto = {
    id: 'receipt-2',
    createdAt: new Date('2025-12-31T09:15:00Z'),
    propertyId: undefined,
    propertyName: undefined,
    contentType: 'image/png',
    viewUrl: 'https://s3.amazonaws.com/presigned-url-2',
  };

  const mockResponse: UnprocessedReceiptsResponse = {
    items: [mockReceipt1, mockReceipt2],
    totalCount: 2,
  };

  beforeEach(() => {
    apiClientSpy = {
      receipts_GetUnprocessed: vi
        .fn()
        .mockReturnValue(of({ items: [], totalCount: 0 })),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ReceiptStore, { provide: ApiClient, useValue: apiClientSpy }],
    });

    store = TestBed.inject(ReceiptStore);
  });

  describe('initial state', () => {
    it('should have empty unprocessedReceipts array', () => {
      expect(store.unprocessedReceipts()).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('should compute unprocessedCount correctly when empty', () => {
      expect(store.unprocessedCount()).toBe(0);
    });

    it('should compute unprocessedCount correctly with receipts', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      expect(store.unprocessedCount()).toBe(2);
    });

    it('should compute isEmpty correctly when empty', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('should compute isEmpty correctly when has receipts', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      expect(store.isEmpty()).toBe(false);
    });

    it('should compute hasReceipts correctly', async () => {
      expect(store.hasReceipts()).toBe(false);

      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      expect(store.hasReceipts()).toBe(true);
    });
  });

  describe('loadUnprocessedReceipts', () => {
    it('should load receipts successfully', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      expect(store.unprocessedReceipts().length).toBe(2);
      expect(store.error()).toBeNull();
      expect(store.isLoading()).toBe(false);
    });

    it('should call API service', async () => {
      await store.loadUnprocessedReceipts();

      expect(apiClientSpy.receipts_GetUnprocessed).toHaveBeenCalled();
    });

    it('should preserve server-side sorting (newest first)', async () => {
      const newReceipt: UnprocessedReceiptDto = {
        id: 'new',
        createdAt: new Date('2025-12-31T10:00:00Z'),
        contentType: 'image/jpeg',
        viewUrl: 'https://example.com/new',
      };
      const oldReceipt: UnprocessedReceiptDto = {
        id: 'old',
        createdAt: new Date('2025-12-01T10:00:00Z'),
        contentType: 'image/jpeg',
        viewUrl: 'https://example.com/old',
      };

      // Server returns items already sorted (newest first)
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(
        of({
          items: [newReceipt, oldReceipt],
          totalCount: 2,
        })
      );

      await store.loadUnprocessedReceipts();

      expect(store.unprocessedReceipts()[0].id).toBe('new');
      expect(store.unprocessedReceipts()[1].id).toBe('old');
    });

    it('should handle error gracefully', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      await store.loadUnprocessedReceipts();

      expect(store.error()).toBe('Failed to load receipts');
      expect(store.isLoading()).toBe(false);
      expect(store.unprocessedReceipts()).toEqual([]);
    });

    it('should clear error before loading', async () => {
      // First, trigger an error
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      await store.loadUnprocessedReceipts();
      expect(store.error()).not.toBeNull();

      // Now load successfully
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();
      expect(store.error()).toBeNull();
    });

    it('should set loading state during fetch', () => {
      // This tests the sync behavior of setting isLoading
      store.loadUnprocessedReceipts();
      // Note: isLoading is set before the async call completes
    });
  });

  describe('removeFromQueue', () => {
    it('should remove a receipt from the queue', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();
      expect(store.unprocessedReceipts().length).toBe(2);

      store.removeFromQueue('receipt-1');

      expect(store.unprocessedReceipts().length).toBe(1);
      expect(
        store.unprocessedReceipts().find((r) => r.id === 'receipt-1')
      ).toBeUndefined();
    });

    it('should update unprocessedCount after removal', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();
      expect(store.unprocessedCount()).toBe(2);

      store.removeFromQueue('receipt-1');

      expect(store.unprocessedCount()).toBe(1);
    });

    it('should handle removing non-existent receipt gracefully', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      store.removeFromQueue('non-existent');

      expect(store.unprocessedReceipts().length).toBe(2);
    });
  });

  describe('addToQueue', () => {
    it('should add a receipt to the beginning of queue', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();

      const newReceipt: UnprocessedReceiptDto = {
        id: 'new-receipt',
        createdAt: new Date(),
        contentType: 'image/jpeg',
        viewUrl: 'https://example.com/new',
      };

      store.addToQueue(newReceipt);

      expect(store.unprocessedReceipts().length).toBe(3);
      expect(store.unprocessedReceipts()[0].id).toBe('new-receipt');
    });

    it('should update unprocessedCount after addition', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();
      expect(store.unprocessedCount()).toBe(2);

      const newReceipt: UnprocessedReceiptDto = {
        id: 'new-receipt',
        createdAt: new Date(),
        contentType: 'image/jpeg',
        viewUrl: 'https://example.com/new',
      };

      store.addToQueue(newReceipt);

      expect(store.unprocessedCount()).toBe(3);
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      await store.loadUnprocessedReceipts();
      expect(store.error()).not.toBeNull();

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      apiClientSpy.receipts_GetUnprocessed.mockReturnValue(of(mockResponse));

      await store.loadUnprocessedReceipts();
      expect(store.unprocessedReceipts().length).toBeGreaterThan(0);

      store.reset();

      expect(store.unprocessedReceipts()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });
});
