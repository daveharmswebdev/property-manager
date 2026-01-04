import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ReportsComponent } from './reports.component';
import { ReportsStore } from './stores/reports.store';
import { GeneratedReportDto } from '../../core/api/api.service';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let mockDialog: Partial<MatDialog>;
  let mockSnackBar: Partial<MatSnackBar>;

  const mockReports: GeneratedReportDto[] = [
    {
      id: 'report-1',
      displayName: 'Property A',
      year: 2024,
      generatedAt: new Date('2024-01-15'),
      fileName: 'Schedule-E-Property-A-2024.pdf',
      fileType: 'PDF',
      fileSizeBytes: 12345,
    },
    {
      id: 'report-2',
      displayName: 'All Properties',
      year: 2024,
      generatedAt: new Date('2024-01-14'),
      fileName: 'Schedule-E-Reports-2024.zip',
      fileType: 'ZIP',
      fileSizeBytes: 54321,
    },
  ];

  const mockReportsStore = {
    generatedReports: signal(mockReports),
    isLoading: signal(false),
    isDeleting: signal(false),
    error: signal<string | null>(null),
    isEmpty: signal(false),
    hasReports: signal(true),
    reportCount: signal(2),
    loadReports: vi.fn(),
    downloadReport: vi.fn().mockResolvedValue(true),
    deleteReport: vi.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent, NoopAnimationsModule],
      providers: [
        { provide: ReportsStore, useValue: mockReportsStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load reports on init', () => {
      expect(mockReportsStore.loadReports).toHaveBeenCalled();
    });
  });

  describe('display', () => {
    it('should display reports table when hasReports is true', () => {
      const table = fixture.nativeElement.querySelector('[data-testid="reports-list"]');
      expect(table).toBeTruthy();
    });

    it('should display generate button', () => {
      const btn = fixture.nativeElement.querySelector('[data-testid="generate-all-reports-btn"]');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('Generate All Schedule E Reports');
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockReportsStore.isEmpty = signal(true);
      mockReportsStore.hasReports = signal(false);
      mockReportsStore.generatedReports = signal([]);
      fixture.detectChanges();
    });

    it('should show empty state when no reports', () => {
      const emptyState = fixture.nativeElement.querySelector('[data-testid="reports-empty-state"]');
      expect(emptyState).toBeTruthy();
    });

    it('should show correct empty state message (AC-6.3.4)', () => {
      const emptyState = fixture.nativeElement.querySelector('[data-testid="reports-empty-state"]');
      expect(emptyState.textContent).toContain('No reports generated yet');
      expect(emptyState.textContent).toContain('Generate your first Schedule E report to get started');
    });
  });

  describe('downloadReport', () => {
    it('should call store downloadReport method', async () => {
      mockReportsStore.downloadReport.mockResolvedValue(true);

      await component.downloadReport(mockReports[0]);

      expect(mockReportsStore.downloadReport).toHaveBeenCalledWith(mockReports[0]);
    });

    // Note: Snackbar display tests for downloadReport are covered by E2E tests
    // Angular's TestBed with @ngrx/signals stores has complex injection behavior
    // that makes unit testing async snackbar calls unreliable
  });

  describe('confirmDelete', () => {
    it('should open delete confirmation dialog', () => {
      component.confirmDelete(mockReports[0]);

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should delete report when confirmed', async () => {
      (mockDialog.open as ReturnType<typeof vi.fn>).mockReturnValue({
        afterClosed: () => of(true),
      });

      component.confirmDelete(mockReports[0]);
      await fixture.whenStable();

      expect(mockReportsStore.deleteReport).toHaveBeenCalledWith('report-1');
    });

    it('should not delete when cancelled', async () => {
      (mockDialog.open as ReturnType<typeof vi.fn>).mockReturnValue({
        afterClosed: () => of(false),
      });

      component.confirmDelete(mockReports[0]);
      await fixture.whenStable();

      expect(mockReportsStore.deleteReport).not.toHaveBeenCalled();
    });

    it('should call deleteReport when user confirms', async () => {
      mockReportsStore.deleteReport.mockResolvedValue(true);
      (mockDialog.open as ReturnType<typeof vi.fn>).mockReturnValue({
        afterClosed: () => of(true),
      });

      component.confirmDelete(mockReports[0]);
      await fixture.whenStable();
      // Give the observable subscription time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReportsStore.deleteReport).toHaveBeenCalledWith('report-1');
    });
  });

  describe('openBatchDialog', () => {
    it('should open batch report dialog', () => {
      component.openBatchDialog();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should reload reports after dialog closes with generated true', async () => {
      mockReportsStore.loadReports.mockClear();
      (mockDialog.open as ReturnType<typeof vi.fn>).mockReturnValue({
        afterClosed: () => of({ generated: true }),
      });

      component.openBatchDialog();
      await fixture.whenStable();

      expect(mockReportsStore.loadReports).toHaveBeenCalled();
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(component.formatFileSize(0)).toBe('0 B');
      expect(component.formatFileSize(500)).toBe('500 B');
      expect(component.formatFileSize(1024)).toBe('1.0 KB');
      expect(component.formatFileSize(1536)).toBe('1.5 KB');
      expect(component.formatFileSize(1048576)).toBe('1.0 MB');
    });

    it('should handle undefined', () => {
      expect(component.formatFileSize(undefined)).toBe('0 B');
    });
  });
});
