import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TenantService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TenantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Task 7.1: createMaintenanceRequest POSTs to correct URL with description body (AC #2)
  it('createMaintenanceRequest POSTs to correct URL with description body', () => {
    const mockResponse = { id: 'req-123' };

    service.createMaintenanceRequest('Leaky faucet').subscribe((result) => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/v1/maintenance-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ description: 'Leaky faucet' });
    req.flush(mockResponse);
  });

  // Task 7.2: generatePhotoUploadUrl POSTs to correct URL with params (AC #3)
  it('generatePhotoUploadUrl POSTs to correct URL with params', () => {
    const mockResponse = {
      uploadUrl: 'https://s3.example.com/presigned',
      storageKey: 'photos/req-123/abc.jpg',
      thumbnailStorageKey: 'photos/req-123/abc-thumb.jpg',
      expiresAt: '2026-04-16T12:00:00Z',
    };

    service
      .generatePhotoUploadUrl('req-123', 'image/jpeg', 1024000, 'photo.jpg')
      .subscribe((result) => {
        expect(result).toEqual(mockResponse);
      });

    const req = httpMock.expectOne('/api/v1/maintenance-requests/req-123/photos/upload-url');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      contentType: 'image/jpeg',
      fileSizeBytes: 1024000,
      originalFileName: 'photo.jpg',
    });
    req.flush(mockResponse);
  });

  // Task 7.3: confirmPhotoUpload POSTs to correct URL with body (AC #3)
  it('confirmPhotoUpload POSTs to correct URL with body', () => {
    const confirmBody = {
      storageKey: 'photos/req-123/abc.jpg',
      thumbnailStorageKey: 'photos/req-123/abc-thumb.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 1024000,
      originalFileName: 'photo.jpg',
    };
    const mockResponse = {
      id: 'photo-1',
      thumbnailUrl: 'https://s3.example.com/thumb.jpg',
      viewUrl: 'https://s3.example.com/full.jpg',
    };

    service.confirmPhotoUpload('req-123', confirmBody).subscribe((result) => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/v1/maintenance-requests/req-123/photos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(confirmBody);
    req.flush(mockResponse);
  });
});
