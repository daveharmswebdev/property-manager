import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ReceiptsComponent } from './receipts.component';
import { ReceiptStore } from './stores/receipt.store';
import { ReceiptCaptureService } from './services/receipt-capture.service';
import { ReceiptUploadDialogComponent } from './components/receipt-upload-dialog/receipt-upload-dialog.component';
import { PropertyTagModalComponent } from './components/property-tag-modal/property-tag-modal.component';
import { ApiClient, UnprocessedReceiptDto } from '../../core/api/api.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('ReceiptsComponent', () => {
  let component: ReceiptsComponent;
  let fixture: ComponentFixture<ReceiptsComponent>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let mockStore: {
    unprocessedReceipts: ReturnType<typeof signal<UnprocessedReceiptDto[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    unprocessedCount: ReturnType<typeof signal<number>>;
    hasReceipts: ReturnType<typeof signal<boolean>>;
    loadUnprocessedReceipts: ReturnType<typeof vi.fn>;
    removeFromQueue: ReturnType<typeof vi.fn>;
    isNewReceipt: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockApiClient: {
    receipts_GetUnprocessed: ReturnType<typeof vi.fn>;
    receipts_DeleteReceipt: ReturnType<typeof vi.fn>;
  };
  let mockReceiptCaptureService: {
    uploadReceipt: ReturnType<typeof vi.fn>;
  };

  const mockReceipts: UnprocessedReceiptDto[] = [
    {
      id: 'receipt-1',
      createdAt: new Date(),
      propertyId: 'property-1',
      propertyName: 'Oak Street Duplex',
      contentType: 'image/jpeg',
      viewUrl: 'https://s3.amazonaws.com/test-1.jpg',
    },
    {
      id: 'receipt-2',
      createdAt: new Date(),
      propertyId: undefined,
      propertyName: undefined,
      contentType: 'image/png',
      viewUrl: 'https://s3.amazonaws.com/test-2.png',
    },
  ];

  beforeEach(async () => {
    routerSpy = {
      navigate: vi.fn(),
    };

    mockStore = {
      unprocessedReceipts: signal<UnprocessedReceiptDto[]>([]),
      isLoading: signal(false),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      unprocessedCount: signal(0),
      hasReceipts: signal(false),
      loadUnprocessedReceipts: vi.fn().mockResolvedValue(undefined),
      removeFromQueue: vi.fn(),
      isNewReceipt: vi.fn().mockReturnValue(false),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockApiClient = {
      receipts_GetUnprocessed: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
      receipts_DeleteReceipt: vi.fn().mockReturnValue(of(undefined)),
    };

    mockReceiptCaptureService = {
      uploadReceipt: vi.fn().mockResolvedValue('receipt-id'),
    };

    await TestBed.configureTestingModule({
      imports: [ReceiptsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: routerSpy },
        { provide: ReceiptStore, useValue: mockStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: ApiClient, useValue: mockApiClient },
        { provide: ReceiptCaptureService, useValue: mockReceiptCaptureService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptsComponent);
    component = fixture.componentInstance;
  });

  describe('initialization', () => {
    it('should create', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should call loadUnprocessedReceipts on init', () => {
      fixture.detectChanges();
      expect(mockStore.loadUnprocessedReceipts).toHaveBeenCalled();
    });

    it('should display page title', () => {
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('.page-header h1'));
      expect(title.nativeElement.textContent).toContain('Receipts');
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      mockStore.isLoading.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(
        By.css('[data-testid="receipts-loading"]')
      );
      expect(spinner).toBeTruthy();
    });

    it('should not show empty state or queue when loading', () => {
      mockStore.isLoading.set(true);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"]')
      );
      const queue = fixture.debugElement.query(
        By.css('[data-testid="receipts-queue"]')
      );

      expect(emptyState).toBeNull();
      expect(queue).toBeNull();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockStore.isLoading.set(false);
      mockStore.isEmpty.set(true);
      fixture.detectChanges();
    });

    it('should display empty state when no receipts', () => {
      const emptyState = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"]')
      );
      expect(emptyState).toBeTruthy();
    });

    it('should show check icon in empty state', () => {
      const checkIcon = fixture.debugElement.query(By.css('.check-icon'));
      expect(checkIcon).toBeTruthy();
    });

    it('should show "All caught up!" heading', () => {
      const heading = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"] h2')
      );
      expect(heading.nativeElement.textContent).toContain('All caught up!');
    });

    it('should show "No receipts to process." message', () => {
      const message = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"] p')
      );
      expect(message.nativeElement.textContent).toContain(
        'No receipts to process.'
      );
    });
  });

  describe('receipt list', () => {
    beforeEach(() => {
      mockStore.isLoading.set(false);
      mockStore.isEmpty.set(false);
      mockStore.unprocessedReceipts.set(mockReceipts);
      fixture.detectChanges();
    });

    it('should display receipt queue when receipts exist', () => {
      const queue = fixture.debugElement.query(
        By.css('[data-testid="receipts-queue"]')
      );
      expect(queue).toBeTruthy();
    });

    it('should render correct number of receipt items', () => {
      const items = fixture.debugElement.queryAll(By.css('app-receipt-queue-item'));
      expect(items.length).toBe(2);
    });

    it('should navigate to receipt detail on click', () => {
      component.onReceiptClick(mockReceipts[0]);

      expect(routerSpy.navigate).toHaveBeenCalledWith([
        '/receipts',
        'receipt-1',
      ]);
    });
  });

  describe('delete receipt (AC-5.5.3)', () => {
    it('should open confirmation dialog when delete is triggered', () => {
      fixture.detectChanges();
      component.onDeleteReceipt('receipt-1');

      expect(mockDialog.open).toHaveBeenCalled();
      const dialogConfig = mockDialog.open.mock.calls[0][1];
      expect(dialogConfig.data.title).toBe('Delete Receipt');
      expect(dialogConfig.data.confirmText).toBe('Delete');
    });

    it('should not delete receipt when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(false),
      });
      fixture.detectChanges();

      component.onDeleteReceipt('receipt-1');

      expect(mockApiClient.receipts_DeleteReceipt).not.toHaveBeenCalled();
    });

    it('should delete receipt when dialog is confirmed', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });
      fixture.detectChanges();

      component.onDeleteReceipt('receipt-1');

      expect(mockApiClient.receipts_DeleteReceipt).toHaveBeenCalledWith('receipt-1');
    });

    it('should remove receipt from queue on successful delete', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });
      fixture.detectChanges();

      component.onDeleteReceipt('receipt-1');

      expect(mockStore.removeFromQueue).toHaveBeenCalledWith('receipt-1');
    });

    it('should show success snackbar on successful delete', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });
      fixture.detectChanges();

      component.onDeleteReceipt('receipt-1');

      expect(mockSnackBar.open).toHaveBeenCalledWith('Receipt deleted', 'Close', { duration: 3000 });
    });

    it('should show error snackbar on failed delete', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });
      mockApiClient.receipts_DeleteReceipt.mockReturnValue(throwError(() => new Error('API Error')));
      fixture.detectChanges();

      component.onDeleteReceipt('receipt-1');

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to delete receipt', 'Close', { duration: 3000 });
    });
  });

  // ─────────────────────────────────────────────
  // Story 16.3 — Desktop Receipt Upload
  // ─────────────────────────────────────────────
  describe('upload receipt (Story 16.3)', () => {
    it('should render Upload Receipt button (AC1)', () => {
      fixture.detectChanges();
      const uploadBtn = fixture.debugElement.query(
        By.css('[data-testid="upload-receipt-btn"]')
      );
      expect(uploadBtn).toBeTruthy();
    });

    it('should render page header with Expenses-style layout (AC1)', () => {
      fixture.detectChanges();
      const header = fixture.debugElement.query(By.css('.page-header'));
      expect(header).toBeTruthy();
    });

    it('should render subtitle in page header (AC1)', () => {
      fixture.detectChanges();
      const subtitle = fixture.debugElement.query(By.css('.subtitle'));
      expect(subtitle).toBeTruthy();
    });

    it('should open ReceiptUploadDialogComponent on button click (AC2)', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });
      fixture.detectChanges();

      component.onUploadReceipt();

      expect(mockDialog.open).toHaveBeenCalledWith(
        ReceiptUploadDialogComponent,
        { width: '500px' }
      );
    });

    it('should not open PropertyTagModal when dialog is cancelled (AC2)', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });
      fixture.detectChanges();

      await component.onUploadReceipt();

      // Only one dialog call (the upload dialog), no PropertyTagModal
      expect(mockDialog.open).toHaveBeenCalledTimes(1);
    });

    it('should open PropertyTagModal after file selection (AC3)', async () => {
      const files = [new File(['data'], 'test.jpg', { type: 'image/jpeg' })];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        // PropertyTagModal — return undefined to abort (we just want to verify it opens)
        return { afterClosed: () => of(undefined) };
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockDialog.open).toHaveBeenCalledTimes(2);
      expect(mockDialog.open).toHaveBeenCalledWith(
        PropertyTagModalComponent,
        { width: '300px' }
      );
    });

    it('should abort upload when PropertyTagModal is dismissed (AC3)', async () => {
      const files = [new File(['data'], 'test.jpg', { type: 'image/jpeg' })];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of(undefined) }; // backdrop dismiss
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockReceiptCaptureService.uploadReceipt).not.toHaveBeenCalled();
    });

    it('should upload files with null propertyId when Skip is chosen (AC3)', async () => {
      const files = [new File(['data'], 'test.jpg', { type: 'image/jpeg' })];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of({ propertyId: null }) }; // Skip
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockReceiptCaptureService.uploadReceipt).toHaveBeenCalledWith(
        files[0],
        undefined
      );
    });

    it('should show success snackbar after upload (AC4)', async () => {
      const files = [new File(['data'], 'test.jpg', { type: 'image/jpeg' })];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of({ propertyId: null }) };
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Receipt uploaded successfully',
        'Dismiss',
        { duration: 3000 }
      );
    });

    it('should call uploadReceipt for each file in multi-file upload (AC5)', async () => {
      const files = [
        new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
        new File(['c'], 'c.pdf', { type: 'application/pdf' }),
      ];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of({ propertyId: 'prop-1' }) };
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockReceiptCaptureService.uploadReceipt).toHaveBeenCalledTimes(3);
      expect(mockReceiptCaptureService.uploadReceipt).toHaveBeenCalledWith(files[0], 'prop-1');
      expect(mockReceiptCaptureService.uploadReceipt).toHaveBeenCalledWith(files[1], 'prop-1');
      expect(mockReceiptCaptureService.uploadReceipt).toHaveBeenCalledWith(files[2], 'prop-1');
    });

    it('should show multi-file success snackbar (AC5)', async () => {
      const files = [
        new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
      ];
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of({ propertyId: null }) };
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        '2 receipts uploaded successfully',
        'Dismiss',
        { duration: 3000 }
      );
    });

    it('should show error snackbar with filename on failed upload (AC6)', async () => {
      const files = [new File(['data'], 'bad.jpg', { type: 'image/jpeg' })];
      mockReceiptCaptureService.uploadReceipt.mockRejectedValue(new Error('Upload failed'));
      let callCount = 0;
      mockDialog.open.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { afterClosed: () => of(files) };
        }
        return { afterClosed: () => of({ propertyId: null }) };
      });
      fixture.detectChanges();

      await component.onUploadReceipt();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to upload bad.jpg',
        'Dismiss',
        { duration: 5000 }
      );
    });

    it('should disable upload button while isUploading is true (AC6)', () => {
      fixture.detectChanges();

      const btn = fixture.debugElement.query(
        By.css('[data-testid="upload-receipt-btn"]')
      );
      expect(btn.nativeElement.disabled).toBe(false);

      component.isUploading.set(true);
      fixture.detectChanges();
      expect(btn.nativeElement.disabled).toBe(true);
    });
  });
});
