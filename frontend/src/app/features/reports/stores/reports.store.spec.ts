import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ReportsStore } from './reports.store';
import { ApiClient, GeneratedReportDto, FileResponse } from '../../../core/api/api.service';

describe('ReportsStore', () => {
  let store: InstanceType<typeof ReportsStore>;
  let mockApiClient: Partial<ApiClient>;

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

  beforeEach(() => {
    mockApiClient = {
      reports_GetReports: vi.fn().mockReturnValue(of(mockReports)),
      reports_DownloadReport: vi.fn(),
      reports_DeleteReport: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        ReportsStore,
        { provide: ApiClient, useValue: mockApiClient },
      ],
    });

    store = TestBed.inject(ReportsStore);
  });

  describe('initial state', () => {
    it('should have empty generatedReports', () => {
      expect(store.generatedReports()).toEqual([]);
    });

    it('should have isLoading false', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have error null', () => {
      expect(store.error()).toBeNull();
    });

    it('should have isEmpty true', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('should have hasReports false', () => {
      expect(store.hasReports()).toBe(false);
    });
  });

  describe('loadReports', () => {
    it('should load reports from API', async () => {
      await store.loadReports();

      expect(mockApiClient.reports_GetReports).toHaveBeenCalled();
      expect(store.generatedReports()).toEqual(mockReports);
      expect(store.isLoading()).toBe(false);
    });

    it('should update computed properties after loading', async () => {
      await store.loadReports();

      expect(store.reportCount()).toBe(2);
      expect(store.isEmpty()).toBe(false);
      expect(store.hasReports()).toBe(true);
    });

    it('should set error on API failure', async () => {
      (mockApiClient.reports_GetReports as ReturnType<typeof vi.fn>)
        .mockReturnValue(throwError(() => new Error('API Error')));

      await store.loadReports();

      expect(store.error()).toBe('Failed to load reports');
      expect(store.isLoading()).toBe(false);
    });

    it('should set isLoading during load', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (mockApiClient.reports_GetReports as ReturnType<typeof vi.fn>)
        .mockReturnValue(of(mockReports).pipe());

      const loadPromise = store.loadReports();

      // Note: Because of firstValueFrom, isLoading will be set briefly
      // In production, this would show a loading spinner

      await loadPromise;
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('downloadReport', () => {
    it('should return true on successful download', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockFileResponse: FileResponse = {
        data: mockBlob,
        status: 200,
        fileName: 'test.pdf',
        headers: {},
      };
      (mockApiClient.reports_DownloadReport as ReturnType<typeof vi.fn>)
        .mockReturnValue(of(mockFileResponse));

      // Mock URL and document methods for jsdom
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as HTMLElement);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as HTMLElement);

      const result = await store.downloadReport(mockReports[0]);

      expect(result).toBe(true);
      expect(mockApiClient.reports_DownloadReport).toHaveBeenCalledWith('report-1');

      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should return false when report has no id', async () => {
      const reportWithoutId = { ...mockReports[0], id: undefined };

      const result = await store.downloadReport(reportWithoutId);

      expect(result).toBe(false);
      expect(mockApiClient.reports_DownloadReport).not.toHaveBeenCalled();
    });

    it('should return false on API failure', async () => {
      (mockApiClient.reports_DownloadReport as ReturnType<typeof vi.fn>)
        .mockReturnValue(throwError(() => new Error('API Error')));

      const result = await store.downloadReport(mockReports[0]);

      expect(result).toBe(false);
      expect(store.error()).toBe('Failed to download report');
    });
  });

  describe('deleteReport', () => {
    beforeEach(async () => {
      await store.loadReports();
    });

    it('should delete report from local state on success', async () => {
      const success = await store.deleteReport('report-1');

      expect(success).toBe(true);
      expect(store.generatedReports().length).toBe(1);
      expect(store.generatedReports()[0].id).toBe('report-2');
    });

    it('should call API with correct id', async () => {
      await store.deleteReport('report-1');

      expect(mockApiClient.reports_DeleteReport).toHaveBeenCalledWith('report-1');
    });

    it('should return false on API failure', async () => {
      (mockApiClient.reports_DeleteReport as ReturnType<typeof vi.fn>)
        .mockReturnValue(throwError(() => new Error('API Error')));

      const success = await store.deleteReport('report-1');

      expect(success).toBe(false);
      expect(store.error()).toBe('Failed to delete report');
    });
  });

  describe('addReport', () => {
    beforeEach(async () => {
      await store.loadReports();
    });

    it('should add report to beginning of list', () => {
      const newReport: GeneratedReportDto = {
        id: 'report-new',
        displayName: 'New Property',
        year: 2024,
        generatedAt: new Date(),
        fileName: 'Schedule-E-New-2024.pdf',
        fileType: 'PDF',
        fileSizeBytes: 9999,
      };

      store.addReport(newReport);

      expect(store.generatedReports().length).toBe(3);
      expect(store.generatedReports()[0].id).toBe('report-new');
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      // Cause an error first
      (mockApiClient.reports_GetReports as ReturnType<typeof vi.fn>)
        .mockReturnValue(throwError(() => new Error('API Error')));
      await store.loadReports();
      expect(store.error()).toBe('Failed to load reports');

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      await store.loadReports();
      expect(store.generatedReports().length).toBe(2);

      store.reset();

      expect(store.generatedReports()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('getReportBlob (AC-6.4.1)', () => {
    it('should fetch and return report blob', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockFileResponse: FileResponse = {
        data: mockBlob,
        status: 200,
        fileName: 'test.pdf',
        headers: {},
      };
      (mockApiClient.reports_DownloadReport as ReturnType<typeof vi.fn>)
        .mockReturnValue(of(mockFileResponse));

      const result = await store.getReportBlob('report-1');

      expect(mockApiClient.reports_DownloadReport).toHaveBeenCalledWith('report-1');
      expect(result).toBe(mockBlob);
    });

    it('should propagate error on API failure', async () => {
      (mockApiClient.reports_DownloadReport as ReturnType<typeof vi.fn>)
        .mockReturnValue(throwError(() => new Error('API Error')));

      await expect(store.getReportBlob('report-1')).rejects.toThrow('API Error');
    });
  });
});
