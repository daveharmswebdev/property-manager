import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ReceiptProcessComponent } from './receipt-process.component';
import { ApiClient, ReceiptDto } from '../../../core/api/api.service';
import { ReceiptStore } from '../stores/receipt.store';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('ReceiptProcessComponent', () => {
  let component: ReceiptProcessComponent;
  let fixture: ComponentFixture<ReceiptProcessComponent>;
  let apiClientMock: { receipts_GetReceipt: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let mockUnprocessedReceipts: ReturnType<typeof signal>;

  const testReceiptId = 'receipt-123';

  const mockReceipt: ReceiptDto = {
    id: testReceiptId,
    originalFileName: 'receipt.jpg',
    contentType: 'image/jpeg',
    fileSizeBytes: 1024,
    viewUrl: 'https://s3.amazonaws.com/test.jpg',
    createdAt: new Date(),
    processedAt: undefined,
    propertyId: 'property-123',
  };

  const mockProcessedReceipt: ReceiptDto = {
    ...mockReceipt,
    processedAt: new Date(),
  };

  beforeEach(async () => {
    mockUnprocessedReceipts = signal([
      { id: 'receipt-next', createdAt: new Date() },
    ]);

    apiClientMock = {
      receipts_GetReceipt: vi.fn().mockReturnValue(of(mockReceipt)),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    snackBarMock = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ReceiptProcessComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiClient, useValue: apiClientMock },
        { provide: Router, useValue: routerMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? testReceiptId : null),
              },
            },
          },
        },
        {
          provide: ReceiptStore,
          useValue: {
            unprocessedReceipts: mockUnprocessedReceipts,
            removeFromQueue: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  describe('loading state', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      // Don't call detectChanges yet to keep in loading state
    });

    it('should show loading state initially', () => {
      expect(component['isLoading']()).toBe(true);
    });
  });

  describe('with valid receipt', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load receipt from API', () => {
      expect(apiClientMock.receipts_GetReceipt).toHaveBeenCalledWith(testReceiptId);
    });

    it('should display split view', () => {
      fixture.detectChanges();
      const splitView = fixture.debugElement.query(
        By.css('[data-testid="split-view"]')
      );
      expect(splitView).toBeTruthy();
    });

    it('should display image panel', () => {
      fixture.detectChanges();
      const imagePanel = fixture.debugElement.query(
        By.css('[data-testid="image-panel"]')
      );
      expect(imagePanel).toBeTruthy();
    });

    it('should display form panel', () => {
      fixture.detectChanges();
      const formPanel = fixture.debugElement.query(
        By.css('[data-testid="form-panel"]')
      );
      expect(formPanel).toBeTruthy();
    });

    it('should not display loading state', () => {
      fixture.detectChanges();
      const loading = fixture.debugElement.query(
        By.css('[data-testid="loading-state"]')
      );
      expect(loading).toBeNull();
    });

    it('should not display error state', () => {
      fixture.detectChanges();
      const error = fixture.debugElement.query(
        By.css('[data-testid="error-state"]')
      );
      expect(error).toBeNull();
    });
  });

  describe('with processed receipt', () => {
    beforeEach(async () => {
      apiClientMock.receipts_GetReceipt.mockReturnValue(of(mockProcessedReceipt));

      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should redirect to receipts page', () => {
      expect(routerMock.navigate).toHaveBeenCalledWith(['/receipts']);
    });

    it('should show snackbar message', () => {
      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Receipt already processed',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('with API error', () => {
    beforeEach(async () => {
      apiClientMock.receipts_GetReceipt.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should display error state', () => {
      fixture.detectChanges();
      const error = fixture.debugElement.query(
        By.css('[data-testid="error-state"]')
      );
      expect(error).toBeTruthy();
    });

    it('should set error message for 404', () => {
      expect(component['error']()).toBe('Receipt not found');
    });
  });

  describe('assembly line logic', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should navigate to next receipt after save', () => {
      component['onExpenseSaved']();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/receipts', 'receipt-next']);
    });

    it('should navigate to receipts page when no more receipts', () => {
      // Clear unprocessed receipts
      mockUnprocessedReceipts.set([]);

      component['onExpenseSaved']();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/receipts']);
      expect(snackBarMock.open).toHaveBeenCalledWith(
        'All caught up!',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('cancel behavior', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(ReceiptProcessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should navigate to receipts page on cancel', () => {
      component['onCancel']();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/receipts']);
    });
  });
});
