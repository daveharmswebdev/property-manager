import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  IncomeService,
  CreateIncomeRequest,
  CreateIncomeResponse,
  IncomeDto,
  IncomeListResponse,
  IncomeTotalResponse,
  IncomeFilterParams,
  AllIncomeResponse,
  UpdateIncomeRequest
} from './income.service';

describe('IncomeService', () => {
  let service: IncomeService;
  let httpMock: HttpTestingController;

  const mockIncome: IncomeDto = {
    id: 'inc-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    amount: 1500.00,
    date: '2024-03-01',
    source: 'Rent',
    description: 'March rent payment',
    createdAt: '2024-03-01T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IncomeService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(IncomeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllIncome', () => {
    it('should get all income without filters', () => {
      const mockResponse: AllIncomeResponse = {
        items: [mockIncome],
        totalCount: 1,
        totalAmount: 1500.00
      };

      service.getAllIncome().subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.totalAmount).toBe(1500.00);
      });

      const req = httpMock.expectOne('/api/v1/income');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should filter income by date range', () => {
      const filters: IncomeFilterParams = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      };
      const mockResponse: AllIncomeResponse = {
        items: [mockIncome],
        totalCount: 1,
        totalAmount: 1500.00
      };

      service.getAllIncome(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/income');
      expect(req.request.params.get('dateFrom')).toBe('2024-01-01');
      expect(req.request.params.get('dateTo')).toBe('2024-12-31');
      req.flush(mockResponse);
    });

    it('should filter income by property ID', () => {
      const filters: IncomeFilterParams = {
        propertyId: 'prop-1'
      };
      const mockResponse: AllIncomeResponse = {
        items: [mockIncome],
        totalCount: 1,
        totalAmount: 1500.00
      };

      service.getAllIncome(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/income');
      expect(req.request.params.get('propertyId')).toBe('prop-1');
      req.flush(mockResponse);
    });

    it('should filter income by year', () => {
      const filters: IncomeFilterParams = {
        year: 2024
      };
      const mockResponse: AllIncomeResponse = {
        items: [mockIncome],
        totalCount: 1,
        totalAmount: 1500.00
      };

      service.getAllIncome(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/income');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });

    it('should combine multiple filters', () => {
      const filters: IncomeFilterParams = {
        dateFrom: '2024-01-01',
        propertyId: 'prop-1',
        year: 2024
      };
      const mockResponse: AllIncomeResponse = {
        items: [],
        totalCount: 0,
        totalAmount: 0
      };

      service.getAllIncome(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/income');
      expect(req.request.params.get('dateFrom')).toBe('2024-01-01');
      expect(req.request.params.get('propertyId')).toBe('prop-1');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });
  });

  describe('createIncome', () => {
    it('should create an income entry and return the ID', () => {
      const request: CreateIncomeRequest = {
        propertyId: 'prop-1',
        amount: 1500.00,
        date: '2024-03-01',
        source: 'Rent',
        description: 'March rent payment'
      };
      const mockResponse: CreateIncomeResponse = { id: 'new-inc-id' };

      service.createIncome(request).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/v1/income');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });

    it('should create income without optional fields', () => {
      const request: CreateIncomeRequest = {
        propertyId: 'prop-1',
        amount: 1000.00,
        date: '2024-04-01'
      };
      const mockResponse: CreateIncomeResponse = { id: 'minimal-inc' };

      service.createIncome(request).subscribe(response => {
        expect(response.id).toBe('minimal-inc');
      });

      const req = httpMock.expectOne('/api/v1/income');
      expect(req.request.body.source).toBeUndefined();
      expect(req.request.body.description).toBeUndefined();
      req.flush(mockResponse);
    });
  });

  describe('getIncomeByProperty', () => {
    it('should get income for a property without year filter', () => {
      const mockResponse: IncomeListResponse = {
        items: [mockIncome],
        totalCount: 1,
        ytdTotal: 1500.00
      };

      service.getIncomeByProperty('prop-1').subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.ytdTotal).toBe(1500.00);
      });

      const req = httpMock.expectOne('/api/v1/properties/prop-1/income');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockResponse);
    });

    it('should get income for a property filtered by year', () => {
      const mockResponse: IncomeListResponse = {
        items: [mockIncome],
        totalCount: 1,
        ytdTotal: 1500.00
      };

      service.getIncomeByProperty('prop-1', 2024).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/income');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });
  });

  describe('getIncomeTotalByProperty', () => {
    it('should get income total for a property and year', () => {
      const mockResponse: IncomeTotalResponse = {
        total: 18000.00,
        year: 2024
      };

      service.getIncomeTotalByProperty('prop-1', 2024).subscribe(response => {
        expect(response.total).toBe(18000.00);
        expect(response.year).toBe(2024);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/income/total');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });
  });

  describe('getIncomeById', () => {
    it('should get a single income entry by ID', () => {
      service.getIncomeById('inc-1').subscribe(response => {
        expect(response.id).toBe('inc-1');
        expect(response.amount).toBe(1500.00);
        expect(response.source).toBe('Rent');
      });

      const req = httpMock.expectOne('/api/v1/income/inc-1');
      expect(req.request.method).toBe('GET');
      req.flush(mockIncome);
    });
  });

  describe('updateIncome', () => {
    it('should update an income entry', () => {
      const request: UpdateIncomeRequest = {
        amount: 1600.00,
        date: '2024-03-05',
        source: 'Rent + Late Fee',
        description: 'March rent with late fee'
      };

      service.updateIncome('inc-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/income/inc-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });

    it('should update income with only required fields', () => {
      const request: UpdateIncomeRequest = {
        amount: 1500.00,
        date: '2024-03-01'
      };

      service.updateIncome('inc-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/income/inc-1');
      expect(req.request.body.source).toBeUndefined();
      expect(req.request.body.description).toBeUndefined();
      req.flush(null);
    });
  });

  describe('deleteIncome', () => {
    it('should delete an income entry', () => {
      service.deleteIncome('inc-1').subscribe();

      const req = httpMock.expectOne('/api/v1/income/inc-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
