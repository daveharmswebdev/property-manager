import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ReceiptSignalRService,
  ReceiptAddedEvent,
  ReceiptLinkedEvent,
  ReceiptDeletedEvent,
} from './receipt-signalr.service';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { ReceiptStore } from '../stores/receipt.store';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('ReceiptSignalRService', () => {
  let service: ReceiptSignalRService;
  let signalRSpy: {
    connect: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof signal<boolean>>;
    isReconnecting: ReturnType<typeof signal<boolean>>;
  };
  let receiptStoreSpy: {
    addReceiptRealTime: ReturnType<typeof vi.fn>;
    removeFromQueue: ReturnType<typeof vi.fn>;
    loadUnprocessedReceipts: ReturnType<typeof vi.fn>;
  };
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };

  // Capture event handlers registered via signalR.on()
  const eventHandlers: Map<string, (data: unknown) => void> = new Map();

  beforeEach(() => {
    eventHandlers.clear();

    signalRSpy = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event: string, handler: (data: unknown) => void) => {
        eventHandlers.set(event, handler);
      }),
      off: vi.fn(),
      isConnected: signal(false),
      isReconnecting: signal(false),
    };

    receiptStoreSpy = {
      addReceiptRealTime: vi.fn(),
      removeFromQueue: vi.fn(),
      loadUnprocessedReceipts: vi.fn().mockResolvedValue(undefined),
    };

    snackBarSpy = {
      open: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ReceiptSignalRService,
        { provide: SignalRService, useValue: signalRSpy },
        { provide: ReceiptStore, useValue: receiptStoreSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    });

    service = TestBed.inject(ReceiptSignalRService);
  });

  describe('initialize', () => {
    it('should connect to SignalR', async () => {
      await service.initialize();

      expect(signalRSpy.connect).toHaveBeenCalled();
    });

    it('should subscribe to ReceiptAdded event', async () => {
      await service.initialize();

      expect(signalRSpy.on).toHaveBeenCalledWith('ReceiptAdded', expect.any(Function));
    });

    it('should subscribe to ReceiptLinked event', async () => {
      await service.initialize();

      expect(signalRSpy.on).toHaveBeenCalledWith('ReceiptLinked', expect.any(Function));
    });

    it('should subscribe to ReceiptDeleted event', async () => {
      await service.initialize();

      expect(signalRSpy.on).toHaveBeenCalledWith('ReceiptDeleted', expect.any(Function));
    });

    it('should not subscribe multiple times on repeated initialize', async () => {
      await service.initialize();
      await service.initialize();

      // Should only be called once per event
      expect(signalRSpy.on).toHaveBeenCalledTimes(3);
    });
  });

  describe('ReceiptAdded event (AC-5.6.1)', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add receipt to store when ReceiptAdded event received', () => {
      const event: ReceiptAddedEvent = {
        id: 'receipt-123',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        propertyId: 'property-456',
        propertyName: 'Test Property',
        createdAt: '2025-12-31T10:30:00Z',
      };

      // Simulate SignalR event
      const handler = eventHandlers.get('ReceiptAdded');
      handler?.(event);

      expect(receiptStoreSpy.addReceiptRealTime).toHaveBeenCalledWith({
        id: 'receipt-123',
        propertyId: 'property-456',
        propertyName: 'Test Property',
        createdAt: expect.any(Date),
        viewUrl: undefined,
        contentType: undefined,
      });
    });

    it('should handle event with undefined optional fields', () => {
      const event: ReceiptAddedEvent = {
        id: 'receipt-789',
        createdAt: '2025-12-31T10:30:00Z',
      };

      const handler = eventHandlers.get('ReceiptAdded');
      handler?.(event);

      expect(receiptStoreSpy.addReceiptRealTime).toHaveBeenCalledWith({
        id: 'receipt-789',
        propertyId: undefined,
        propertyName: undefined,
        createdAt: expect.any(Date),
        viewUrl: undefined,
        contentType: undefined,
      });
    });
  });

  describe('ReceiptLinked event (AC-5.6.2)', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should remove receipt from queue when ReceiptLinked event received', () => {
      const event: ReceiptLinkedEvent = {
        receiptId: 'receipt-123',
        expenseId: 'expense-456',
      };

      const handler = eventHandlers.get('ReceiptLinked');
      handler?.(event);

      expect(receiptStoreSpy.removeFromQueue).toHaveBeenCalledWith('receipt-123');
    });
  });

  describe('ReceiptDeleted event', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should remove receipt from queue when ReceiptDeleted event received', () => {
      const event: ReceiptDeletedEvent = {
        receiptId: 'receipt-123',
      };

      const handler = eventHandlers.get('ReceiptDeleted');
      handler?.(event);

      expect(receiptStoreSpy.removeFromQueue).toHaveBeenCalledWith('receipt-123');
    });
  });

  describe('handleReconnection (AC-5.6.4)', () => {
    it('should reload unprocessed receipts on reconnection', async () => {
      await service.handleReconnection();

      expect(receiptStoreSpy.loadUnprocessedReceipts).toHaveBeenCalled();
    });

    it('should show snackbar notification on reconnection', async () => {
      await service.handleReconnection();

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Reconnected - syncing receipts...',
        undefined,
        { duration: 2000 }
      );
    });
  });

  describe('ngOnDestroy', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should unsubscribe from all events', () => {
      service.ngOnDestroy();

      expect(signalRSpy.off).toHaveBeenCalledWith('ReceiptAdded');
      expect(signalRSpy.off).toHaveBeenCalledWith('ReceiptLinked');
      expect(signalRSpy.off).toHaveBeenCalledWith('ReceiptDeleted');
    });
  });
});
