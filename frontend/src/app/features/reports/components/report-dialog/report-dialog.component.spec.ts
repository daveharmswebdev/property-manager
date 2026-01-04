import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReportDialogComponent, ReportDialogData } from './report-dialog.component';
import { ReportService } from '../../services/report.service';

describe('ReportDialogComponent', () => {
  let component: ReportDialogComponent;
  let fixture: ComponentFixture<ReportDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<ReportDialogComponent>>;
  let mockReportService: Partial<ReportService>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  const mockDialogData: ReportDialogData = {
    propertyId: 'test-property-id',
    propertyName: 'Test Property',
    currentYear: 2024
  };

  beforeAll(() => {
    // Mock URL methods globally for this test suite
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn()
    };

    mockReportService = {
      generateScheduleE: vi.fn(),
      downloadPdf: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        ReportDialogComponent,
        NoopAnimationsModule
      ],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: ReportService, useValue: mockReportService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should display the property name', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Test Property');
    });

    it('should default year selector to current year from dialog data', () => {
      expect(component.selectedYear).toBe(2024);
    });

    it('should have available years options', () => {
      // Check that we have years generated (default is 10)
      expect(component.availableYears.length).toBe(10);
      
      const currentYear = new Date().getFullYear();
      expect(component.availableYears[0]).toBe(currentYear);
      expect(component.availableYears[9]).toBe(currentYear - 9);
    });

    it('should not be loading initially', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(component.error()).toBeNull();
    });

    it('should have no preview URL initially', () => {
      expect(component.previewUrl()).toBeNull();
    });
  });

  describe('preview', () => {
    it('should set loading state when previewing', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      const promise = component.preview();
      expect(component.isLoading()).toBe(true);

      await promise;
      expect(component.isLoading()).toBe(false);
    });

    it('should call report service with correct parameters', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      component.selectedYear = 2023;
      await component.preview();

      expect(mockReportService.generateScheduleE).toHaveBeenCalledWith('test-property-id', 2023);
    });

    it('should set preview URL on success', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      await component.preview();

      expect(component.previewUrl()).not.toBeNull();
    });

    it('should set error on failure', async () => {
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));

      await component.preview();

      expect(component.error()).toBe('Failed to generate report. Please try again.');
      expect(component.isLoading()).toBe(false);
    });

    it('should clear previous error before new preview', async () => {
      // Set initial error
      component.error.set('Previous error');

      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      const promise = component.preview();
      expect(component.error()).toBeNull();
      await promise;
    });
  });

  describe('download', () => {
    it('should set loading state when downloading', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      const promise = component.download();
      expect(component.isLoading()).toBe(true);

      await promise;
      expect(component.isLoading()).toBe(false);
    });

    it('should call downloadPdf on success', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      component.selectedYear = 2024;
      await component.download();

      expect(mockReportService.downloadPdf).toHaveBeenCalledWith(mockBlob, 'Test Property', 2024);
    });

    it('should set error on failure', async () => {
      (mockReportService.generateScheduleE as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));

      await component.download();

      expect(component.error()).toBe('Failed to download report. Please try again.');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      component.error.set('Some error');
      component.clearError();
      expect(component.error()).toBeNull();
    });
  });

  describe('year selection', () => {
    it('should allow changing year', () => {
      component.selectedYear = 2022;
      expect(component.selectedYear).toBe(2022);
    });
  });
});
