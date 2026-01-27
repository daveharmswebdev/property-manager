import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  WorkOrderService,
  CreateWorkOrderRequest,
  CreateWorkOrderResponse,
  UpdateWorkOrderRequest,
  WorkOrderDto,
  GetAllWorkOrdersResponse,
  GetAllWorkOrderTagsResponse,
  CreateWorkOrderTagRequest,
  GetWorkOrdersByPropertyResponse,
  WorkOrderTagDto
} from './work-order.service';

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let httpMock: HttpTestingController;

  const mockWorkOrderTag: WorkOrderTagDto = {
    id: 'tag-1',
    name: 'Urgent'
  };

  const mockWorkOrder: WorkOrderDto = {
    id: 'wo-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor',
    isDiy: false,
    categoryId: 'cat-1',
    categoryName: 'Plumbing',
    status: 'Reported',
    description: 'Fix leaky faucet',
    createdAt: '2024-01-15T10:00:00Z',
    createdByUserId: 'user-1',
    tags: [mockWorkOrderTag]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorkOrderService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(WorkOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createWorkOrder', () => {
    it('should create a work order and return the ID', () => {
      const request: CreateWorkOrderRequest = {
        propertyId: 'prop-1',
        description: 'Fix leaky faucet',
        categoryId: 'cat-1',
        status: 'Reported',
        vendorId: 'vendor-1',
        tagIds: ['tag-1']
      };
      const mockResponse: CreateWorkOrderResponse = { id: 'new-wo-id' };

      service.createWorkOrder(request).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/v1/work-orders');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });

    it('should create a DIY work order without vendorId', () => {
      const request: CreateWorkOrderRequest = {
        propertyId: 'prop-1',
        description: 'Paint bedroom'
      };
      const mockResponse: CreateWorkOrderResponse = { id: 'diy-wo-id' };

      service.createWorkOrder(request).subscribe(response => {
        expect(response.id).toBe('diy-wo-id');
      });

      const req = httpMock.expectOne('/api/v1/work-orders');
      expect(req.request.body.vendorId).toBeUndefined();
      req.flush(mockResponse);
    });
  });

  describe('getWorkOrders', () => {
    it('should get all work orders without filters', () => {
      const mockResponse: GetAllWorkOrdersResponse = {
        items: [mockWorkOrder],
        totalCount: 1
      };

      service.getWorkOrders().subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.totalCount).toBe(1);
      });

      const req = httpMock.expectOne('/api/v1/work-orders');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockResponse);
    });

    it('should filter work orders by status', () => {
      const mockResponse: GetAllWorkOrdersResponse = {
        items: [mockWorkOrder],
        totalCount: 1
      };

      service.getWorkOrders('Reported').subscribe(response => {
        expect(response.items[0].status).toBe('Reported');
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/work-orders');
      expect(req.request.params.get('status')).toBe('Reported');
      req.flush(mockResponse);
    });

    it('should filter work orders by propertyId', () => {
      const mockResponse: GetAllWorkOrdersResponse = {
        items: [mockWorkOrder],
        totalCount: 1
      };

      service.getWorkOrders(undefined, 'prop-1').subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/work-orders');
      expect(req.request.params.get('propertyId')).toBe('prop-1');
      expect(req.request.params.has('status')).toBe(false);
      req.flush(mockResponse);
    });

    it('should filter work orders by both status and propertyId', () => {
      const mockResponse: GetAllWorkOrdersResponse = {
        items: [mockWorkOrder],
        totalCount: 1
      };

      service.getWorkOrders('Completed', 'prop-2').subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/work-orders');
      expect(req.request.params.get('status')).toBe('Completed');
      expect(req.request.params.get('propertyId')).toBe('prop-2');
      req.flush(mockResponse);
    });
  });

  describe('getWorkOrder', () => {
    it('should get a single work order by ID', () => {
      service.getWorkOrder('wo-1').subscribe(response => {
        expect(response.id).toBe('wo-1');
        expect(response.description).toBe('Fix leaky faucet');
      });

      const req = httpMock.expectOne('/api/v1/work-orders/wo-1');
      expect(req.request.method).toBe('GET');
      req.flush(mockWorkOrder);
    });
  });

  describe('updateWorkOrder', () => {
    it('should update a work order', () => {
      const request: UpdateWorkOrderRequest = {
        description: 'Updated description',
        categoryId: 'cat-2',
        status: 'Completed',
        vendorId: 'vendor-2',
        tagIds: ['tag-2']
      };

      service.updateWorkOrder('wo-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/work-orders/wo-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });

    it('should update work order with minimal fields', () => {
      const request: UpdateWorkOrderRequest = {
        description: 'Minimal update'
      };

      service.updateWorkOrder('wo-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/work-orders/wo-1');
      expect(req.request.body.description).toBe('Minimal update');
      expect(req.request.body.categoryId).toBeUndefined();
      req.flush(null);
    });
  });

  describe('getWorkOrderTags', () => {
    it('should get all work order tags', () => {
      const mockResponse: GetAllWorkOrderTagsResponse = {
        items: [
          { id: 'tag-1', name: 'Urgent' },
          { id: 'tag-2', name: 'Routine' }
        ],
        totalCount: 2
      };

      service.getWorkOrderTags().subscribe(response => {
        expect(response.items).toHaveLength(2);
        expect(response.items[0].name).toBe('Urgent');
      });

      const req = httpMock.expectOne('/api/v1/work-order-tags');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('createWorkOrderTag', () => {
    it('should create a new work order tag', () => {
      const request: CreateWorkOrderTagRequest = { name: 'Priority' };
      const mockResponse = { id: 'new-tag-id' };

      service.createWorkOrderTag(request).subscribe(response => {
        expect(response.id).toBe('new-tag-id');
      });

      const req = httpMock.expectOne('/api/v1/work-order-tags');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });
  });

  describe('deleteWorkOrder', () => {
    it('should delete a work order', () => {
      service.deleteWorkOrder('wo-1').subscribe();

      const req = httpMock.expectOne('/api/v1/work-orders/wo-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getWorkOrdersByProperty', () => {
    it('should get work orders for a specific property', () => {
      const mockResponse: GetWorkOrdersByPropertyResponse = {
        items: [mockWorkOrder],
        totalCount: 1
      };

      service.getWorkOrdersByProperty('prop-1').subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.items[0].propertyId).toBe('prop-1');
      });

      const req = httpMock.expectOne('/api/v1/properties/prop-1/work-orders');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockResponse);
    });

    it('should get work orders with limit parameter', () => {
      const mockResponse: GetWorkOrdersByPropertyResponse = {
        items: [mockWorkOrder],
        totalCount: 10
      };

      service.getWorkOrdersByProperty('prop-1', 5).subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.totalCount).toBe(10);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/work-orders');
      expect(req.request.params.get('limit')).toBe('5');
      req.flush(mockResponse);
    });

    it('should not include limit param when undefined', () => {
      const mockResponse: GetWorkOrdersByPropertyResponse = {
        items: [],
        totalCount: 0
      };

      service.getWorkOrdersByProperty('prop-1', undefined).subscribe();

      const req = httpMock.expectOne('/api/v1/properties/prop-1/work-orders');
      expect(req.request.params.has('limit')).toBe(false);
      req.flush(mockResponse);
    });
  });
});
