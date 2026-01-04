import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReceiptLightboxDialogComponent,
  ReceiptLightboxDialogData,
} from './receipt-lightbox-dialog.component';
import { ApiClient, ReceiptDto } from '../../../../core/api/api.service';

describe('ReceiptLightboxDialogComponent', () => {
  let component: ReceiptLightboxDialogComponent;
  let fixture: ComponentFixture<ReceiptLightboxDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockApiClient: { receipts_GetReceipt: ReturnType<typeof vi.fn> };
  const mockDialogData: ReceiptLightboxDialogData = {
    receiptId: 'test-receipt-id',
  };

  const mockReceipt: ReceiptDto = {
    id: 'test-receipt-id',
    originalFileName: 'receipt.jpg',
    contentType: 'image/jpeg',
    viewUrl: 'https://s3.example.com/receipt.jpg',
    createdAt: new Date('2024-01-15'),
  };

  describe('when receipt loads successfully', () => {
    beforeEach(async () => {
      mockDialogRef = { close: vi.fn() };
      mockApiClient = {
        receipts_GetReceipt: vi.fn().mockReturnValue(of(mockReceipt)),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ReceiptLightboxDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
          { provide: ApiClient, useValue: mockApiClient },
        ],
      });

      fixture = TestBed.createComponent(ReceiptLightboxDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should fetch receipt on init', () => {
      expect(mockApiClient.receipts_GetReceipt).toHaveBeenCalledWith(
        'test-receipt-id'
      );
    });

    it('should display receipt viewer after loading', () => {
      fixture.detectChanges();
      const viewer = fixture.nativeElement.querySelector(
        '[data-testid="receipt-viewer"]'
      );
      expect(viewer).toBeTruthy();
    });

    it('should not show loading spinner after load', () => {
      // Check that isLoading signal is false after load
      expect(component.isLoading()).toBe(false);
      expect(component.receipt()).toBeTruthy();
    });

    it('should not show error state', () => {
      fixture.detectChanges();
      const errorState = fixture.nativeElement.querySelector(
        '[data-testid="error-state"]'
      );
      expect(errorState).toBeNull();
    });

    it('should close dialog when close button clicked', () => {
      fixture.detectChanges();
      const closeBtn = fixture.nativeElement.querySelector(
        '[data-testid="close-btn"]'
      );
      closeBtn.click();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('when receipt fails to load', () => {
    beforeEach(async () => {
      mockDialogRef = { close: vi.fn() };
      mockApiClient = {
        receipts_GetReceipt: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Not found'))),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ReceiptLightboxDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
          { provide: ApiClient, useValue: mockApiClient },
        ],
      });

      fixture = TestBed.createComponent(ReceiptLightboxDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show error state', () => {
      fixture.detectChanges();
      const errorState = fixture.nativeElement.querySelector(
        '[data-testid="error-state"]'
      );
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Failed to load receipt');
    });

    it('should not show loading spinner', () => {
      fixture.detectChanges();
      const spinner = fixture.nativeElement.querySelector(
        '[data-testid="loading-spinner"]'
      );
      expect(spinner).toBeNull();
    });

    it('should not show receipt viewer', () => {
      fixture.detectChanges();
      const viewer = fixture.nativeElement.querySelector(
        '[data-testid="receipt-viewer"]'
      );
      expect(viewer).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockDialogRef = { close: vi.fn() };
      // Create a never-completing observable to simulate loading
      mockApiClient = {
        receipts_GetReceipt: vi.fn().mockReturnValue(new Subject()),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ReceiptLightboxDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
          { provide: ApiClient, useValue: mockApiClient },
        ],
      });

      fixture = TestBed.createComponent(ReceiptLightboxDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      // Don't await whenStable - we want to check loading state

      const spinner = fixture.nativeElement.querySelector(
        '[data-testid="loading-spinner"]'
      );
      expect(spinner).toBeTruthy();
    });
  });
});
