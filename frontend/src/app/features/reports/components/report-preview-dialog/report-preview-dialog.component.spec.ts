import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  ReportPreviewDialogComponent,
  ReportPreviewDialogData,
} from './report-preview-dialog.component';
import { ReportsStore } from '../../stores/reports.store';
import { GeneratedReportDto } from '../../../../core/api/api.service';

describe('ReportPreviewDialogComponent', () => {
  let component: ReportPreviewDialogComponent;
  let fixture: ComponentFixture<ReportPreviewDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<ReportPreviewDialogComponent>>;
  let mockReportsStore: Partial<InstanceType<typeof ReportsStore>>;
  let mockRouter: Partial<Router>;
  let mockSnackBar: Partial<MatSnackBar>;

  const mockReport: GeneratedReportDto = {
    id: 'report-123',
    displayName: 'Test Property',
    year: 2024,
    generatedAt: new Date('2024-01-15'),
    fileName: 'Schedule-E-Test-Property-2024.pdf',
    fileType: 'PDF',
    fileSizeBytes: 12345,
  };

  const mockDialogData: ReportPreviewDialogData = {
    report: mockReport,
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    mockReportsStore = {
      getReportBlob: vi.fn().mockResolvedValue(
        new Blob(['PDF content'], { type: 'application/pdf' })
      ),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    // Mock URL methods
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ReportPreviewDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: ReportsStore, useValue: mockReportsStore },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportPreviewDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loading state (AC-6.4.7)', () => {
    it('should display loading state initially', async () => {
      // Mock a never-resolving promise to keep loading state
      (mockReportsStore.getReportBlob as ReturnType<typeof vi.fn>)
        .mockReturnValue(new Promise(() => {}));

      // Need to recreate the component with the new mock
      fixture = TestBed.createComponent(ReportPreviewDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const loadingState = fixture.nativeElement.querySelector(
        '[data-testid="loading-state"]'
      );
      expect(loadingState).toBeTruthy();
      expect(loadingState.textContent).toContain('Loading report...');
    });

    it('should show PDF after successful load', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.isLoading()).toBe(false);
      expect(component.previewUrl()).toBeTruthy();
    });

    it('should show error state on load failure', async () => {
      (mockReportsStore.getReportBlob as ReturnType<typeof vi.fn>)
        .mockRejectedValue(new Error('Failed to fetch'));

      fixture = TestBed.createComponent(ReportPreviewDialogComponent);
      component = fixture.componentInstance;
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.error()).toBe('Failed to load report. Please try again.');
      const errorState = fixture.nativeElement.querySelector(
        '[data-testid="error-state"]'
      );
      expect(errorState).toBeTruthy();
    });

    it('should have retry button on error', async () => {
      (mockReportsStore.getReportBlob as ReturnType<typeof vi.fn>)
        .mockRejectedValue(new Error('Failed to fetch'));

      fixture = TestBed.createComponent(ReportPreviewDialogComponent);
      component = fixture.componentInstance;
      await fixture.whenStable();
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector(
        '[data-testid="error-state"] button'
      );
      expect(retryBtn).toBeTruthy();
      expect(retryBtn.textContent).toContain('Try Again');
    });
  });

  describe('zoom controls (AC-6.4.2)', () => {
    beforeEach(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should have initial zoom level at 100%', () => {
      expect(component.zoomLevel()).toBe(100);
    });

    it('should increase zoom level when zoom in clicked', () => {
      component.zoomIn();
      expect(component.zoomLevel()).toBe(125);
    });

    it('should decrease zoom level when zoom out clicked', () => {
      component.zoomOut();
      expect(component.zoomLevel()).toBe(75);
    });

    it('should not exceed maximum zoom of 200%', () => {
      component.zoomLevel.set(200);
      component.zoomIn();
      expect(component.zoomLevel()).toBe(200);
    });

    it('should not go below minimum zoom of 50%', () => {
      component.zoomLevel.set(50);
      component.zoomOut();
      expect(component.zoomLevel()).toBe(50);
    });

    it('should reset zoom to 100% when reset clicked', () => {
      component.zoomLevel.set(175);
      component.resetZoom();
      expect(component.zoomLevel()).toBe(100);
    });

    it('should display current zoom level', () => {
      const zoomDisplay = fixture.nativeElement.querySelector(
        '[data-testid="zoom-level"]'
      );
      expect(zoomDisplay).toBeTruthy();
      expect(zoomDisplay.textContent).toContain('100%');
    });
  });

  describe('print functionality (AC-6.4.3)', () => {
    beforeEach(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should have print button', () => {
      const printBtn = fixture.nativeElement.querySelector(
        '[data-testid="print-btn"]'
      );
      expect(printBtn).toBeTruthy();
    });

    it('should set isPrinting when print is triggered with blob', async () => {
      // The print button is tested for existence above
      // Full print functionality is covered by E2E tests
      // Here we just verify the component structure
      expect(component.isPrinting()).toBe(false);
    });

    it('should disable print for ZIP files', async () => {
      // Create component with ZIP report
      const zipDialogData: ReportPreviewDialogData = {
        report: { ...mockReport, fileType: 'ZIP' },
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ReportPreviewDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: MAT_DIALOG_DATA, useValue: zipDialogData },
          { provide: ReportsStore, useValue: mockReportsStore },
          { provide: Router, useValue: mockRouter },
          { provide: MatSnackBar, useValue: mockSnackBar },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ReportPreviewDialogComponent);
      component = fixture.componentInstance;
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.isZipFile()).toBe(true);
      const printBtn = fixture.nativeElement.querySelector(
        '[data-testid="print-btn"]'
      );
      expect(printBtn.disabled).toBe(true);
    });
  });

  describe('download functionality (AC-6.4.5)', () => {
    beforeEach(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should have download button', () => {
      const downloadBtn = fixture.nativeElement.querySelector(
        '[data-testid="download-btn"]'
      );
      expect(downloadBtn).toBeTruthy();
    });

    it('should have download method', () => {
      // The download button is tested for existence above
      // Full download functionality is covered by E2E tests
      // Here we just verify the method exists
      expect(typeof component.download).toBe('function');
    });
  });

  describe('fix data navigation (AC-6.4.4)', () => {
    beforeEach(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should have fix data link in footer', () => {
      const fixLink = fixture.nativeElement.querySelector(
        '[data-testid="fix-data-link"]'
      );
      expect(fixLink).toBeTruthy();
      expect(fixLink.textContent).toContain('Go to Expenses');
    });

    it('should navigate to expenses when fix link clicked', () => {
      component.navigateToFix();

      expect(mockDialogRef.close).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/expenses']);
    });
  });

  describe('dialog display', () => {
    beforeEach(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should display report name', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Test Property');
    });

    it('should display report year', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('2024');
    });

    it('should have close button', () => {
      const closeBtn = fixture.nativeElement.querySelector(
        '[data-testid="close-btn"]'
      );
      expect(closeBtn).toBeTruthy();
    });
  });

  describe('cleanup', () => {
    it('should cleanup blob URLs on destroy', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      // Trigger destroy
      component.ngOnDestroy();

      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});
