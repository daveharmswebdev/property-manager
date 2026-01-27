import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  PropertyService,
  CreatePropertyRequest,
  CreatePropertyResponse,
  PropertySummaryDto,
  GetAllPropertiesResponse,
  PropertyDetailDto
} from './property.service';

describe('PropertyService', () => {
  let service: PropertyService;
  let httpMock: HttpTestingController;

  const mockPropertySummary: PropertySummaryDto = {
    id: 'prop-1',
    name: 'Test Property',
    street: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    expenseTotal: 5000,
    incomeTotal: 18000,
    primaryPhotoThumbnailUrl: 'https://example.com/photo.jpg'
  };

  const mockPropertyDetail: PropertyDetailDto = {
    id: 'prop-1',
    name: 'Test Property',
    street: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    expenseTotal: 5000,
    incomeTotal: 18000,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    recentExpenses: [
      { id: 'exp-1', description: 'Repairs', amount: 150, date: '2024-03-10' }
    ],
    recentIncome: [
      { id: 'inc-1', description: 'Rent', amount: 1500, date: '2024-03-01' }
    ],
    primaryPhotoThumbnailUrl: 'https://example.com/photo.jpg'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PropertyService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PropertyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createProperty', () => {
    it('should create a property and return the ID', () => {
      const request: CreatePropertyRequest = {
        name: 'New Property',
        street: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201'
      };
      const mockResponse: CreatePropertyResponse = { id: 'new-prop-id' };

      service.createProperty(request).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/v1/properties');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });
  });

  describe('getProperties', () => {
    it('should get all properties without year filter', () => {
      const mockResponse: GetAllPropertiesResponse = {
        items: [mockPropertySummary],
        totalCount: 1
      };

      service.getProperties().subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.items[0].name).toBe('Test Property');
      });

      const req = httpMock.expectOne('/api/v1/properties');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockResponse);
    });

    it('should get properties filtered by year', () => {
      const mockResponse: GetAllPropertiesResponse = {
        items: [mockPropertySummary],
        totalCount: 1
      };

      service.getProperties(2024).subscribe(response => {
        expect(response.items).toHaveLength(1);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });

    it('should handle empty properties list', () => {
      const mockResponse: GetAllPropertiesResponse = {
        items: [],
        totalCount: 0
      };

      service.getProperties().subscribe(response => {
        expect(response.items).toHaveLength(0);
        expect(response.totalCount).toBe(0);
      });

      const req = httpMock.expectOne('/api/v1/properties');
      req.flush(mockResponse);
    });

    it('should handle property without photo', () => {
      const propertyWithoutPhoto: PropertySummaryDto = {
        ...mockPropertySummary,
        primaryPhotoThumbnailUrl: null
      };
      const mockResponse: GetAllPropertiesResponse = {
        items: [propertyWithoutPhoto],
        totalCount: 1
      };

      service.getProperties().subscribe(response => {
        expect(response.items[0].primaryPhotoThumbnailUrl).toBeNull();
      });

      const req = httpMock.expectOne('/api/v1/properties');
      req.flush(mockResponse);
    });
  });

  describe('getPropertyById', () => {
    it('should get a property by ID without year filter', () => {
      service.getPropertyById('prop-1').subscribe(response => {
        expect(response.id).toBe('prop-1');
        expect(response.name).toBe('Test Property');
        expect(response.recentExpenses).toHaveLength(1);
        expect(response.recentIncome).toHaveLength(1);
      });

      const req = httpMock.expectOne('/api/v1/properties/prop-1');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockPropertyDetail);
    });

    it('should get a property by ID filtered by year', () => {
      service.getPropertyById('prop-1', 2024).subscribe(response => {
        expect(response.id).toBe('prop-1');
        expect(response.expenseTotal).toBe(5000);
        expect(response.incomeTotal).toBe(18000);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockPropertyDetail);
    });

    it('should include recent expenses and income in response', () => {
      service.getPropertyById('prop-1').subscribe(response => {
        expect(response.recentExpenses[0].description).toBe('Repairs');
        expect(response.recentExpenses[0].amount).toBe(150);
        expect(response.recentIncome[0].description).toBe('Rent');
        expect(response.recentIncome[0].amount).toBe(1500);
      });

      const req = httpMock.expectOne('/api/v1/properties/prop-1');
      req.flush(mockPropertyDetail);
    });
  });

  describe('updateProperty', () => {
    it('should update a property', () => {
      const request: CreatePropertyRequest = {
        name: 'Updated Property',
        street: '789 Elm St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001'
      };

      service.updateProperty('prop-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/properties/prop-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });

    it('should send all property fields in update request', () => {
      const request: CreatePropertyRequest = {
        name: 'Updated Name',
        street: 'New Street',
        city: 'New City',
        state: 'CA',
        zipCode: '90210'
      };

      service.updateProperty('prop-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/properties/prop-1');
      expect(req.request.body.name).toBe('Updated Name');
      expect(req.request.body.street).toBe('New Street');
      expect(req.request.body.city).toBe('New City');
      expect(req.request.body.state).toBe('CA');
      expect(req.request.body.zipCode).toBe('90210');
      req.flush(null);
    });
  });

  describe('deleteProperty', () => {
    it('should delete a property', () => {
      service.deleteProperty('prop-1').subscribe();

      const req = httpMock.expectOne('/api/v1/properties/prop-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
