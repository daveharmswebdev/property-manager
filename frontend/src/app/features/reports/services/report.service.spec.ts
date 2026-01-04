import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateScheduleE', () => {
    it('should call the correct API endpoint', async () => {
      const propertyId = 'test-property-id';
      const year = 2024;
      const mockPdfBlob = new Blob(['PDF content'], { type: 'application/pdf' });

      const promise = service.generateScheduleE(propertyId, year);

      const req = httpMock.expectOne('/api/v1/reports/schedule-e');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ propertyId, year });
      expect(req.request.responseType).toBe('blob');

      req.flush(mockPdfBlob);

      const result = await promise;
      expect(result).toBeInstanceOf(Blob);
    });

    it('should send property ID and year in request body', async () => {
      const propertyId = 'abc-123';
      const year = 2023;
      const mockPdfBlob = new Blob(['PDF content'], { type: 'application/pdf' });

      const promise = service.generateScheduleE(propertyId, year);

      const req = httpMock.expectOne('/api/v1/reports/schedule-e');
      expect(req.request.body.propertyId).toBe(propertyId);
      expect(req.request.body.year).toBe(year);

      req.flush(mockPdfBlob);
      await promise;
    });
  });

  describe('generateBatchScheduleE', () => {
    it('should call the correct batch API endpoint', async () => {
      const propertyIds = ['id-1', 'id-2', 'id-3'];
      const year = 2024;
      const mockZipBlob = new Blob(['ZIP content'], { type: 'application/zip' });

      const promise = service.generateBatchScheduleE(propertyIds, year);

      const req = httpMock.expectOne('/api/v1/reports/schedule-e/batch');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ propertyIds, year });
      expect(req.request.responseType).toBe('blob');

      req.flush(mockZipBlob);

      const result = await promise;
      expect(result).toBeInstanceOf(Blob);
    });

    it('should send property IDs array and year in request body', async () => {
      const propertyIds = ['abc-123', 'def-456'];
      const year = 2023;
      const mockZipBlob = new Blob(['ZIP content'], { type: 'application/zip' });

      const promise = service.generateBatchScheduleE(propertyIds, year);

      const req = httpMock.expectOne('/api/v1/reports/schedule-e/batch');
      expect(req.request.body.propertyIds).toEqual(propertyIds);
      expect(req.request.body.year).toBe(year);

      req.flush(mockZipBlob);
      await promise;
    });
  });

  describe('downloadPdf', () => {
    // Setup mocks for URL.createObjectURL and URL.revokeObjectURL
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it('should create and trigger a download link', () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const propertyName = 'Test Property';
      const year = 2024;

      // Create a mock anchor that we can check was clicked
      const mockAnchor = document.createElement('a');
      const clickSpy = vi.spyOn(mockAnchor, 'click').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

      service.downloadPdf(mockBlob, propertyName, year);

      expect(mockAnchor.download).toBe('Schedule-E-Test-Property-2024.pdf');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should sanitize property name for filename', () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const propertyName = 'Test Property @#$% (Special)';
      const year = 2024;

      const mockAnchor = document.createElement('a');
      vi.spyOn(mockAnchor, 'click').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

      service.downloadPdf(mockBlob, propertyName, year);

      // Should remove special chars and replace spaces with hyphens
      expect(mockAnchor.download).toBe('Schedule-E-Test-Property--Special-2024.pdf');
    });
  });

  describe('downloadZip', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it('should create and trigger a ZIP download link', () => {
      const mockBlob = new Blob(['ZIP content'], { type: 'application/zip' });
      const year = 2024;

      const mockAnchor = document.createElement('a');
      const clickSpy = vi.spyOn(mockAnchor, 'click').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

      service.downloadZip(mockBlob, year);

      expect(mockAnchor.download).toBe('Schedule-E-Reports-2024.zip');
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
