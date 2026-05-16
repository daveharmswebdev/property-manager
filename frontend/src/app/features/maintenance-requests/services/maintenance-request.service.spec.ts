import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  MaintenanceRequestService,
  PaginatedMaintenanceRequests,
  MaintenanceRequestDto,
} from './maintenance-request.service';

describe('MaintenanceRequestService', () => {
  let service: MaintenanceRequestService;
  let httpMock: HttpTestingController;

  const mockRequest: MaintenanceRequestDto = {
    id: 'req-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    propertyAddress: '123 Test St, Austin, TX 78701',
    description: 'Leaky faucet',
    status: 'Submitted',
    dismissalReason: null,
    submittedByUserId: 'user-1',
    submittedByUserName: 'Jane Tenant',
    workOrderId: null,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    photos: null,
  };

  const mockPaginated: PaginatedMaintenanceRequests = {
    items: [mockRequest],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MaintenanceRequestService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MaintenanceRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMaintenanceRequests', () => {
    it('should hit /api/v1/maintenance-requests with no params', () => {
      service.getMaintenanceRequests().subscribe((response) => {
        expect(response).toEqual(mockPaginated);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/v1/maintenance-requests');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockPaginated);
    });

    it('should send status param when provided', () => {
      service.getMaintenanceRequests({ status: 'InProgress' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/v1/maintenance-requests');
      expect(req.request.params.get('status')).toBe('InProgress');
      expect(req.request.params.has('propertyId')).toBe(false);
      expect(req.request.params.has('page')).toBe(false);
      req.flush(mockPaginated);
    });

    it('should send propertyId param when provided', () => {
      service.getMaintenanceRequests({ propertyId: 'prop-42' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/v1/maintenance-requests');
      expect(req.request.params.get('propertyId')).toBe('prop-42');
      expect(req.request.params.has('status')).toBe(false);
      req.flush(mockPaginated);
    });

    it('should send page, pageSize, status, and propertyId together', () => {
      service
        .getMaintenanceRequests({
          status: 'Submitted',
          propertyId: 'prop-1',
          page: 2,
          pageSize: 50,
        })
        .subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/v1/maintenance-requests');
      expect(req.request.params.get('status')).toBe('Submitted');
      expect(req.request.params.get('propertyId')).toBe('prop-1');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('50');
      req.flush(mockPaginated);
    });

    it('should omit empty string status', () => {
      service.getMaintenanceRequests({ status: '' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/v1/maintenance-requests');
      expect(req.request.params.has('status')).toBe(false);
      req.flush(mockPaginated);
    });
  });

  describe('getMaintenanceRequestById', () => {
    it('should hit /api/v1/maintenance-requests/:id', () => {
      service.getMaintenanceRequestById('req-1').subscribe((response) => {
        expect(response.id).toBe('req-1');
      });

      const req = httpMock.expectOne('/api/v1/maintenance-requests/req-1');
      expect(req.request.method).toBe('GET');
      req.flush(mockRequest);
    });
  });
});
