import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MobileCaptureFabComponent } from './mobile-capture-fab.component';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReceiptCaptureService } from '../../services/receipt-capture.service';
import { PropertyStore } from '../../../properties/stores/property.store';
import { Router, NavigationEnd } from '@angular/router';
import { of, BehaviorSubject, NEVER, Subject } from 'rxjs';
import { signal } from '@angular/core';

describe('MobileCaptureFabComponent', () => {
  let component: MobileCaptureFabComponent;
  let fixture: ComponentFixture<MobileCaptureFabComponent>;
  let breakpointSubject: BehaviorSubject<BreakpointState>;
  let breakpointObserverSpy: {
    observe: ReturnType<typeof vi.fn>;
  };
  let dialogSpy: {
    open: ReturnType<typeof vi.fn>;
  };
  let snackBarSpy: {
    open: ReturnType<typeof vi.fn>;
  };
  let receiptCaptureServiceSpy: {
    uploadReceipt: ReturnType<typeof vi.fn>;
    isValidFileType: ReturnType<typeof vi.fn>;
    isValidFileSize: ReturnType<typeof vi.fn>;
  };
  let propertyStoreSpy: {
    properties: ReturnType<typeof signal>;
    loadProperties: ReturnType<typeof vi.fn>;
  };
  let routerEventsSubject: Subject<any>;
  let routerSpy: {
    url: string;
    events: Subject<any>;
  };

  beforeEach(() => {
    breakpointSubject = new BehaviorSubject<BreakpointState>({
      matches: true,
      breakpoints: { '(max-width: 767px)': true },
    });

    breakpointObserverSpy = {
      observe: vi.fn().mockReturnValue(breakpointSubject.asObservable()),
    };

    dialogSpy = {
      open: vi.fn(),
    };

    const mockSnackBarRef = {
      onAction: () => NEVER,
    };

    snackBarSpy = {
      open: vi.fn().mockReturnValue(mockSnackBarRef),
    };

    receiptCaptureServiceSpy = {
      uploadReceipt: vi.fn().mockResolvedValue('receipt-123'),
      isValidFileType: vi.fn().mockReturnValue(true),
      isValidFileSize: vi.fn().mockReturnValue(true),
    };

    propertyStoreSpy = {
      properties: signal([
        { id: 'prop-1', name: 'Property 1', address: '123 Main St', city: 'Austin', state: 'TX', zip: '78701', purchasePrice: 100000, monthlyRent: 1000 },
        { id: 'prop-2', name: 'Property 2', address: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78702', purchasePrice: 150000, monthlyRent: 1500 },
      ]),
      loadProperties: vi.fn(),
    };

    // Mock Router - simulate being on dashboard for FAB visibility tests
    routerEventsSubject = new Subject<any>();
    routerSpy = {
      url: '/dashboard',
      events: routerEventsSubject,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MobileCaptureFabComponent],
      providers: [
        { provide: BreakpointObserver, useValue: breakpointObserverSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: ReceiptCaptureService, useValue: receiptCaptureServiceSpy },
        { provide: PropertyStore, useValue: propertyStoreSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    fixture = TestBed.createComponent(MobileCaptureFabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('visibility (AC-5.2.1)', () => {
    it('should be visible on mobile viewport (< 768px)', () => {
      expect(component.isMobile()).toBe(true);
    });

    it('should be hidden on desktop viewport (>= 768px)', () => {
      breakpointSubject.next({
        matches: false,
        breakpoints: { '(max-width: 767px)': false },
      });
      fixture.detectChanges();

      expect(component.isMobile()).toBe(false);
    });

    it('should detect dashboard route on init', () => {
      expect(component.isOnDashboard()).toBe(true);
    });

    it('should hide FAB when not on dashboard route', () => {
      // Simulate navigation away from dashboard
      routerSpy.url = '/properties';
      routerEventsSubject.next(new NavigationEnd(1, '/properties', '/properties'));
      fixture.detectChanges();

      expect(component.isOnDashboard()).toBe(false);
      const fabElement = fixture.nativeElement.querySelector('.capture-fab');
      expect(fabElement).toBeNull();
    });

    it('should show FAB when navigating back to dashboard', () => {
      // Navigate away first
      routerEventsSubject.next(new NavigationEnd(1, '/properties', '/properties'));
      fixture.detectChanges();
      expect(component.isOnDashboard()).toBe(false);

      // Navigate back to dashboard
      routerEventsSubject.next(new NavigationEnd(2, '/dashboard', '/dashboard'));
      fixture.detectChanges();

      expect(component.isOnDashboard()).toBe(true);
    });
  });

  describe('FAB display', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have camera icon', () => {
      const fabElement = fixture.nativeElement.querySelector('.capture-fab');
      const iconElement = fabElement?.querySelector('mat-icon');
      expect(iconElement?.textContent?.trim()).toBe('photo_camera');
    });
  });

  describe('file selection', () => {
    it('should trigger file input click when FAB clicked', () => {
      const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(fileInput, 'click');

      component.onFabClick();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should accept image and pdf files', () => {
      const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
      expect(fileInput.getAttribute('accept')).toBe('image/jpeg,image/png,application/pdf');
    });

    it('should have capture attribute for camera on mobile', () => {
      const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
      expect(fileInput.getAttribute('capture')).toBe('environment');
    });
  });

  describe('file upload (AC-5.2.2)', () => {
    it('should validate file type before upload', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: null }) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(receiptCaptureServiceSpy.isValidFileType).toHaveBeenCalledWith('image/jpeg');
    });

    it('should validate file size before upload', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: null }) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(receiptCaptureServiceSpy.isValidFileSize).toHaveBeenCalledWith(mockFile.size);
    });

    it('should show error for invalid file type', async () => {
      const mockFile = new File(['test'], 'receipt.gif', { type: 'image/gif' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(false);

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Invalid file type. Please use JPEG, PNG, or PDF.',
        'Dismiss',
        expect.any(Object)
      );
    });

    it('should show error for file too large', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(false);

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'File too large. Maximum size is 10MB.',
        'Dismiss',
        expect.any(Object)
      );
    });

    it('should open property tag modal after file selection', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: 'prop-1' }) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(dialogSpy.open).toHaveBeenCalled();
    });

    it('should upload receipt with selected property ID', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: 'prop-1' }) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(receiptCaptureServiceSpy.uploadReceipt).toHaveBeenCalledWith(mockFile, 'prop-1');
    });

    it('should upload receipt with null property ID when skipped', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: null }) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(receiptCaptureServiceSpy.uploadReceipt).toHaveBeenCalledWith(mockFile, undefined);
    });

    it('should show success snackbar after upload (AC-5.2.2)', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: null }) });
      receiptCaptureServiceSpy.uploadReceipt.mockResolvedValue('receipt-123');

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Saved',
        '',
        expect.objectContaining({ duration: 2000 })
      );
    });

    it('should show error snackbar on upload failure (AC-5.2.5)', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId: null }) });
      receiptCaptureServiceSpy.uploadReceipt.mockRejectedValue(new Error('Upload failed'));

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Upload failed. Retry?',
        'Retry',
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('should not upload if modal is cancelled', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(undefined) });

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      expect(receiptCaptureServiceSpy.uploadReceipt).not.toHaveBeenCalled();
    });

    it('should preserve propertyId on retry after upload failure (AC-5.2.5)', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      const propertyId = 'prop-1';
      receiptCaptureServiceSpy.isValidFileType.mockReturnValue(true);
      receiptCaptureServiceSpy.isValidFileSize.mockReturnValue(true);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of({ propertyId }) });

      // First upload fails
      receiptCaptureServiceSpy.uploadReceipt.mockRejectedValueOnce(new Error('Network error'));

      // Set up snackbar to capture retry action
      let retryCallback: (() => void) | undefined;
      const mockSnackBarRef = {
        onAction: () => ({
          subscribe: (cb: () => void) => { retryCallback = cb; }
        }),
      };
      snackBarSpy.open.mockReturnValue(mockSnackBarRef);

      await component.onFileSelected({ target: { files: [mockFile] } } as any);

      // Verify first upload was called with propertyId
      expect(receiptCaptureServiceSpy.uploadReceipt).toHaveBeenCalledWith(mockFile, propertyId);

      // Reset mock and simulate retry succeeding
      receiptCaptureServiceSpy.uploadReceipt.mockReset();
      receiptCaptureServiceSpy.uploadReceipt.mockResolvedValue('receipt-123');

      // Trigger retry
      if (retryCallback) {
        retryCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Verify retry preserves propertyId
      expect(receiptCaptureServiceSpy.uploadReceipt).toHaveBeenCalledWith(mockFile, propertyId);
    });
  });
});
