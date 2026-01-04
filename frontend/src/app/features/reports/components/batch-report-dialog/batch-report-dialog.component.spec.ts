import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { BatchReportDialogComponent } from './batch-report-dialog.component';
import { ReportService } from '../../services/report.service';
import { PropertyStore } from '../../../properties/stores/property.store';
import { YearSelectorService } from '../../../../core/services/year-selector.service';

describe('BatchReportDialogComponent', () => {
  let component: BatchReportDialogComponent;
  let fixture: ComponentFixture<BatchReportDialogComponent>;
  let mockReportService: Partial<ReportService>;
  let mockDialogRef: Partial<MatDialogRef<BatchReportDialogComponent>>;
  let mockSnackBar: Partial<MatSnackBar>;

  const mockProperties = [
    { id: 'prop-1', name: 'Property 1', city: 'Austin', state: 'TX', incomeTotal: 1000, expenseTotal: 500 },
    { id: 'prop-2', name: 'Property 2', city: 'Dallas', state: 'TX', incomeTotal: 0, expenseTotal: 0 },
    { id: 'prop-3', name: 'Property 3', city: 'Houston', state: 'TX', incomeTotal: 2000, expenseTotal: 800 },
  ];

  const mockPropertyStore = {
    properties: signal(mockProperties),
    isLoading: signal(false),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2024),
    availableYears: signal([2024, 2023, 2022]),
  };

  beforeEach(async () => {
    mockReportService = {
      generateBatchScheduleE: vi.fn(),
      downloadZip: vi.fn()
    };

    mockDialogRef = {
      close: vi.fn()
    };

    mockSnackBar = {
      open: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [BatchReportDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BatchReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load all properties on init', () => {
      expect(component.properties().length).toBe(3);
    });

    it('should select all properties by default', () => {
      expect(component.selectedCount()).toBe(3);
      expect(component.allSelected()).toBe(true);
    });

    it('should identify properties with no data', () => {
      const noDataProperty = component.properties().find(p => p.id === 'prop-2');
      expect(noDataProperty?.hasDataForYear).toBe(false);
    });

    it('should identify properties with data', () => {
      const hasDataProperty = component.properties().find(p => p.id === 'prop-1');
      expect(hasDataProperty?.hasDataForYear).toBe(true);
    });
  });

  describe('property selection', () => {
    it('should toggle individual property selection', () => {
      component.toggleProperty('prop-1');
      expect(component.selectedCount()).toBe(2);

      component.toggleProperty('prop-1');
      expect(component.selectedCount()).toBe(3);
    });

    it('should toggle all properties with toggleAll()', () => {
      component.toggleAll(); // Deselect all
      expect(component.selectedCount()).toBe(0);
      expect(component.allSelected()).toBe(false);

      component.toggleAll(); // Select all
      expect(component.selectedCount()).toBe(3);
      expect(component.allSelected()).toBe(true);
    });

    it('should update button count when selection changes', () => {
      expect(component.selectedCount()).toBe(3);

      component.toggleProperty('prop-1');
      component.toggleProperty('prop-2');
      expect(component.selectedCount()).toBe(1);
    });
  });

  describe('generate', () => {
    it('should call generateBatchScheduleE with selected property IDs', async () => {
      const mockBlob = new Blob(['ZIP'], { type: 'application/zip' });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      await component.generate();

      expect(mockReportService.generateBatchScheduleE).toHaveBeenCalledWith(
        ['prop-1', 'prop-2', 'prop-3'],
        2024
      );
    });

    it('should trigger ZIP download on success', async () => {
      const mockBlob = new Blob(['ZIP'], { type: 'application/zip' });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      await component.generate();

      expect(mockReportService.downloadZip).toHaveBeenCalledWith(mockBlob, 2024);
    });

    it('should show snackbar on success', async () => {
      const mockBlob = new Blob(['ZIP'], { type: 'application/zip' });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      await component.generate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        '3 reports ready for download',
        'Close',
        { duration: 5000 }
      );
    });

    it('should close dialog on success', async () => {
      const mockBlob = new Blob(['ZIP'], { type: 'application/zip' });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      await component.generate();

      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should set error on failure', async () => {
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));

      await component.generate();

      expect(component.error()).toBe('Failed to generate reports. Please try again.');
    });

    it('should set loading state during generation', async () => {
      let resolvePromise: (value: Blob) => void;
      const promise = new Promise<Blob>((resolve) => {
        resolvePromise = resolve;
      });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      const generatePromise = component.generate();
      expect(component.isLoading()).toBe(true);

      resolvePromise!(new Blob(['ZIP'], { type: 'application/zip' }));
      await generatePromise;

      expect(component.isLoading()).toBe(false);
    });

    it('should not call API if no properties selected', async () => {
      component.toggleAll(); // Deselect all
      await component.generate();

      expect(mockReportService.generateBatchScheduleE).not.toHaveBeenCalled();
    });

    it('should only send selected property IDs', async () => {
      const mockBlob = new Blob(['ZIP'], { type: 'application/zip' });
      (mockReportService.generateBatchScheduleE as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

      component.toggleProperty('prop-2'); // Deselect one

      await component.generate();

      expect(mockReportService.generateBatchScheduleE).toHaveBeenCalledWith(
        ['prop-1', 'prop-3'],
        2024
      );
    });
  });

  describe('error handling', () => {
    it('should clear error state', () => {
      component.error.set('Test error');
      component.clearError();
      expect(component.error()).toBeNull();
    });
  });

  describe('year selector', () => {
    it('should have 10 year options', () => {
      expect(component.availableYears.length).toBe(10);
    });

    it('should default to the current year from service', () => {
      expect(component.selectedYear).toBe(2024);
    });
  });
});
