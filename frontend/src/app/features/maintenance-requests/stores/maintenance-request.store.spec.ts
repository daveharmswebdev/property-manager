import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MaintenanceRequestStore } from './maintenance-request.store';
import {
  MaintenanceRequestService,
  MaintenanceRequestDto,
  PaginatedMaintenanceRequests,
} from '../services/maintenance-request.service';

describe('MaintenanceRequestStore', () => {
  let store: InstanceType<typeof MaintenanceRequestStore>;
  let serviceMock: {
    getMaintenanceRequests: ReturnType<typeof vi.fn>;
    getMaintenanceRequestById: ReturnType<typeof vi.fn>;
  };

  const mockRequest: MaintenanceRequestDto = {
    id: 'req-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    propertyAddress: '123 Test St, Austin, TX',
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

  const mockResponse: PaginatedMaintenanceRequests = {
    items: [mockRequest],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    serviceMock = {
      getMaintenanceRequests: vi.fn().mockReturnValue(of(mockResponse)),
      getMaintenanceRequestById: vi.fn().mockReturnValue(of(mockRequest)),
    };

    TestBed.configureTestingModule({
      providers: [
        MaintenanceRequestStore,
        { provide: MaintenanceRequestService, useValue: serviceMock },
      ],
    });

    store = TestBed.inject(MaintenanceRequestStore);
  });

  describe('initial state', () => {
    it('starts with empty requests', () => {
      expect(store.requests()).toEqual([]);
    });

    it('starts with all statuses selected', () => {
      expect(store.selectedStatuses()).toEqual(['Submitted', 'InProgress', 'Resolved', 'Dismissed']);
    });

    it('starts with no property filter', () => {
      expect(store.selectedPropertyId()).toBeNull();
    });

    it('starts with page=1, pageSize=20', () => {
      expect(store.page()).toBe(1);
      expect(store.pageSize()).toBe(20);
    });

    it('starts with no selected request', () => {
      expect(store.selectedRequest()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('hasActiveFilters is false on defaults', () => {
      expect(store.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters is true when status subset selected', () => {
      store.setStatusFilter(['Submitted']);
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters is true when property filter applied', () => {
      store.setPropertyFilter('prop-1');
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('isEmpty is true when no requests AND no filters', () => {
      serviceMock.getMaintenanceRequests.mockReturnValue(
        of({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }),
      );
      store.loadRequests();
      expect(store.isEmpty()).toBe(true);
      expect(store.isFilteredEmpty()).toBe(false);
    });

    it('isFilteredEmpty is true when no requests AND filters active', () => {
      serviceMock.getMaintenanceRequests.mockReturnValue(
        of({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }),
      );
      store.setStatusFilter(['Submitted']);
      expect(store.isFilteredEmpty()).toBe(true);
      expect(store.isEmpty()).toBe(false);
    });
  });

  describe('loadRequests', () => {
    it('happy path patches requests and pagination', () => {
      store.loadRequests();
      expect(store.requests()).toEqual([mockRequest]);
      expect(store.totalCount()).toBe(1);
      expect(store.page()).toBe(1);
      expect(store.pageSize()).toBe(20);
      expect(store.totalPages()).toBe(1);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('sends no status param when all statuses selected', () => {
      store.loadRequests();
      expect(serviceMock.getMaintenanceRequests).toHaveBeenCalledWith({
        status: undefined,
        propertyId: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('sends single status when exactly one selected', () => {
      store.setStatusFilter(['InProgress']);
      const lastCall =
        serviceMock.getMaintenanceRequests.mock.calls[
          serviceMock.getMaintenanceRequests.mock.calls.length - 1
        ];
      expect(lastCall[0].status).toBe('InProgress');
    });

    it('sends no status when 2 of 4 statuses selected', () => {
      store.setStatusFilter(['Submitted', 'InProgress']);
      const lastCall =
        serviceMock.getMaintenanceRequests.mock.calls[
          serviceMock.getMaintenanceRequests.mock.calls.length - 1
        ];
      expect(lastCall[0].status).toBeUndefined();
    });

    it('sets error on failure', () => {
      serviceMock.getMaintenanceRequests.mockReturnValue(throwError(() => new Error('boom')));
      store.loadRequests();
      expect(store.error()).toBe('Failed to load maintenance requests. Please try again.');
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('setStatusFilter', () => {
    it('patches state and reloads', () => {
      const callsBefore = serviceMock.getMaintenanceRequests.mock.calls.length;
      store.setStatusFilter(['Submitted']);
      expect(store.selectedStatuses()).toEqual(['Submitted']);
      expect(store.page()).toBe(1);
      expect(serviceMock.getMaintenanceRequests.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('refuses an empty selection (no patch, no reload)', () => {
      store.setStatusFilter(['Submitted']); // patch first
      const before = serviceMock.getMaintenanceRequests.mock.calls.length;
      store.setStatusFilter([]);
      expect(store.selectedStatuses()).toEqual(['Submitted']);
      expect(serviceMock.getMaintenanceRequests.mock.calls.length).toBe(before);
    });
  });

  describe('setPropertyFilter', () => {
    it('patches and reloads', () => {
      const callsBefore = serviceMock.getMaintenanceRequests.mock.calls.length;
      store.setPropertyFilter('prop-9');
      expect(store.selectedPropertyId()).toBe('prop-9');
      expect(store.page()).toBe(1);
      expect(serviceMock.getMaintenanceRequests.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('clearing property filter sends propertyId=undefined', () => {
      store.setPropertyFilter('prop-9');
      store.setPropertyFilter(null);
      const lastCall =
        serviceMock.getMaintenanceRequests.mock.calls[
          serviceMock.getMaintenanceRequests.mock.calls.length - 1
        ];
      expect(lastCall[0].propertyId).toBeUndefined();
    });
  });

  describe('clearFilters', () => {
    it('resets to defaults and reloads', () => {
      store.setStatusFilter(['Submitted']);
      store.setPropertyFilter('prop-7');
      store.clearFilters();
      expect(store.selectedStatuses()).toEqual([
        'Submitted',
        'InProgress',
        'Resolved',
        'Dismissed',
      ]);
      expect(store.selectedPropertyId()).toBeNull();
      expect(store.page()).toBe(1);
      expect(store.hasActiveFilters()).toBe(false);
    });
  });

  describe('setPage', () => {
    it('passes page and pageSize to the service', () => {
      store.setPage(2, 50);
      const lastCall =
        serviceMock.getMaintenanceRequests.mock.calls[
          serviceMock.getMaintenanceRequests.mock.calls.length - 1
        ];
      expect(lastCall[0].page).toBe(2);
      expect(lastCall[0].pageSize).toBe(50);
    });
  });

  describe('loadRequestById', () => {
    it('happy path patches selectedRequest', () => {
      store.loadRequestById('req-1');
      expect(store.selectedRequest()).toEqual(mockRequest);
      expect(store.isLoadingDetail()).toBe(false);
      expect(store.detailError()).toBeNull();
    });

    it('404 sets detailError to "Maintenance request not found"', () => {
      serviceMock.getMaintenanceRequestById.mockReturnValue(throwError(() => ({ status: 404 })));
      store.loadRequestById('missing');
      expect(store.detailError()).toBe('Maintenance request not found');
      expect(store.selectedRequest()).toBeNull();
    });

    it('non-404 errors set generic detailError', () => {
      serviceMock.getMaintenanceRequestById.mockReturnValue(throwError(() => ({ status: 500 })));
      store.loadRequestById('boom');
      expect(store.detailError()).toBe('Failed to load maintenance request. Please try again.');
    });
  });

  describe('clearSelectedRequest', () => {
    it('clears selectedRequest and detailError', () => {
      store.loadRequestById('req-1');
      // Manually patch detailError to verify the method clears it too:
      serviceMock.getMaintenanceRequestById.mockReturnValue(throwError(() => ({ status: 500 })));
      store.loadRequestById('boom');
      expect(store.detailError()).not.toBeNull();

      store.clearSelectedRequest();
      expect(store.selectedRequest()).toBeNull();
      expect(store.detailError()).toBeNull();
    });
  });
});
