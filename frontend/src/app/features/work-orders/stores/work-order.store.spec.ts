import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { WorkOrderStore } from './work-order.store';
import {
  WorkOrderService,
  WorkOrderDto,
  WorkOrderTagDto,
  GetAllWorkOrdersResponse,
  GetAllWorkOrderTagsResponse,
} from '../services/work-order.service';

describe('WorkOrderStore', () => {
  let store: InstanceType<typeof WorkOrderStore>;
  let workOrderServiceMock: {
    getWorkOrders: ReturnType<typeof vi.fn>;
    getWorkOrder: ReturnType<typeof vi.fn>;
    createWorkOrder: ReturnType<typeof vi.fn>;
    updateWorkOrder: ReturnType<typeof vi.fn>;
    deleteWorkOrder: ReturnType<typeof vi.fn>;
    getWorkOrderTags: ReturnType<typeof vi.fn>;
    createWorkOrderTag: ReturnType<typeof vi.fn>;
  };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  const mockTag: WorkOrderTagDto = { id: 'tag-1', name: 'Urgent' };

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
    createdAt: '2025-01-15T10:00:00Z',
    createdByUserId: 'user-1',
    tags: [mockTag],
  };

  const mockWorkOrdersResponse: GetAllWorkOrdersResponse = {
    items: [mockWorkOrder],
    totalCount: 1,
  };

  const mockTagsResponse: GetAllWorkOrderTagsResponse = {
    items: [mockTag],
    totalCount: 1,
  };

  beforeEach(() => {
    workOrderServiceMock = {
      getWorkOrders: vi.fn().mockReturnValue(of(mockWorkOrdersResponse)),
      getWorkOrder: vi.fn().mockReturnValue(of(mockWorkOrder)),
      createWorkOrder: vi.fn().mockReturnValue(of({ id: 'new-wo-1' })),
      updateWorkOrder: vi.fn().mockReturnValue(of(undefined)),
      deleteWorkOrder: vi.fn().mockReturnValue(of(undefined)),
      getWorkOrderTags: vi.fn().mockReturnValue(of(mockTagsResponse)),
      createWorkOrderTag: vi.fn().mockReturnValue(of({ id: 'new-tag-1' })),
    };
    snackBarMock = { open: vi.fn() };
    routerMock = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        WorkOrderStore,
        { provide: WorkOrderService, useValue: workOrderServiceMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    store = TestBed.inject(WorkOrderStore);
  });

  describe('initial state', () => {
    it('should have empty work orders', () => {
      expect(store.workOrders()).toEqual([]);
    });

    it('should have empty tags', () => {
      expect(store.tags()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should not be saving', () => {
      expect(store.isSaving()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });

    it('should have all statuses selected', () => {
      expect(store.selectedStatuses()).toEqual(['Reported', 'Assigned', 'Completed']);
    });

    it('should have no property filter', () => {
      expect(store.selectedPropertyId()).toBeNull();
    });

    it('should have no selected work order', () => {
      expect(store.selectedWorkOrder()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('hasWorkOrders should be false when empty', () => {
      expect(store.hasWorkOrders()).toBe(false);
    });

    it('hasWorkOrders should be true when work orders exist', () => {
      store.loadWorkOrders();
      expect(store.hasWorkOrders()).toBe(true);
    });

    it('isEmpty should be true when no work orders', () => {
      workOrderServiceMock.getWorkOrders.mockReturnValue(of({ items: [], totalCount: 0 }));
      store.loadWorkOrders();
      expect(store.isEmpty()).toBe(true);
    });

    it('workOrderCount should return correct count', () => {
      store.loadWorkOrders();
      expect(store.workOrderCount()).toBe(1);
    });

    it('hasActiveFilters should be false initially', () => {
      expect(store.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should be true when status filter applied', () => {
      store.setStatusFilter(['Reported']);
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when property filter applied', () => {
      store.setPropertyFilter('prop-1');
      expect(store.hasActiveFilters()).toBe(true);
    });

    it('isFilteredEmpty should be true when filters return empty', () => {
      workOrderServiceMock.getWorkOrders.mockReturnValue(of({ items: [], totalCount: 0 }));
      store.setStatusFilter(['Completed']);
      expect(store.isFilteredEmpty()).toBe(true);
    });

    it('hasSelectedWorkOrder should be true when work order selected', () => {
      store.loadWorkOrderById('wo-1');
      expect(store.hasSelectedWorkOrder()).toBe(true);
    });
  });

  describe('loadWorkOrders', () => {
    it('should call service with no params', () => {
      store.loadWorkOrders();
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should call service with status filter', () => {
      store.loadWorkOrders({ status: 'Reported' });
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith('Reported', undefined);
    });

    it('should call service with property filter', () => {
      store.loadWorkOrders({ propertyId: 'prop-1' });
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith(undefined, 'prop-1');
    });

    it('should update state with loaded work orders', () => {
      store.loadWorkOrders();
      expect(store.workOrders()).toEqual([mockWorkOrder]);
      expect(store.isLoading()).toBe(false);
    });

    it('should handle load error', () => {
      workOrderServiceMock.getWorkOrders.mockReturnValue(throwError(() => new Error('Network error')));
      store.loadWorkOrders();
      expect(store.error()).toBe('Failed to load work orders. Please try again.');
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('createWorkOrder', () => {
    const createRequest = {
      propertyId: 'prop-1',
      description: 'New work order',
      categoryId: 'cat-1',
      status: 'Reported',
    };

    it('should call service with request', () => {
      store.createWorkOrder(createRequest);
      expect(workOrderServiceMock.createWorkOrder).toHaveBeenCalledWith(createRequest);
    });

    it('should show success snackbar', () => {
      store.createWorkOrder(createRequest);
      expect(snackBarMock.open).toHaveBeenCalledWith('Work order created', 'Close', expect.any(Object));
    });

    it('should navigate to work order detail', () => {
      store.createWorkOrder(createRequest);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/work-orders', 'new-wo-1']);
    });

    it('should handle 400 error', () => {
      workOrderServiceMock.createWorkOrder.mockReturnValue(throwError(() => ({ status: 400 })));
      store.createWorkOrder(createRequest);
      expect(store.error()).toBe('Invalid work order data. Please check your input.');
      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Invalid work order data. Please check your input.',
        'Close',
        expect.any(Object)
      );
    });

    it('should handle 404 error', () => {
      workOrderServiceMock.createWorkOrder.mockReturnValue(throwError(() => ({ status: 404 })));
      store.createWorkOrder(createRequest);
      expect(store.error()).toBe('Property, category, or vendor not found.');
    });
  });

  describe('updateWorkOrder', () => {
    const updateRequest = {
      id: 'wo-1',
      data: {
        description: 'Updated description',
        status: 'Completed',
      },
    };

    it('should call service with id and data', () => {
      store.updateWorkOrder(updateRequest);
      expect(workOrderServiceMock.updateWorkOrder).toHaveBeenCalledWith('wo-1', updateRequest.data);
    });

    it('should show success snackbar', () => {
      store.updateWorkOrder(updateRequest);
      expect(snackBarMock.open).toHaveBeenCalledWith('Work order updated', 'Close', expect.any(Object));
    });

    it('should navigate to work order detail', () => {
      store.updateWorkOrder(updateRequest);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/work-orders', 'wo-1']);
    });

    it('should handle update error', () => {
      workOrderServiceMock.updateWorkOrder.mockReturnValue(throwError(() => ({ status: 500 })));
      store.updateWorkOrder(updateRequest);
      expect(store.error()).toBe('Failed to update work order. Please try again.');
    });
  });

  describe('deleteWorkOrder', () => {
    it('should call service with id', () => {
      store.deleteWorkOrder('wo-1');
      expect(workOrderServiceMock.deleteWorkOrder).toHaveBeenCalledWith('wo-1');
    });

    it('should show success snackbar', () => {
      store.deleteWorkOrder('wo-1');
      expect(snackBarMock.open).toHaveBeenCalledWith('Work order deleted', 'Close', expect.any(Object));
    });

    it('should navigate to work orders list when on detail page (AC-C1)', () => {
      // Load detail first to simulate being on detail page
      store.loadWorkOrderById('wo-1');
      expect(store.selectedWorkOrder()).not.toBeNull();

      store.deleteWorkOrder('wo-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/work-orders']);
    });

    it('should NOT navigate when delete is triggered from list page (AC-C2)', () => {
      // Load work orders into list (no selectedWorkOrder)
      store.loadWorkOrders();
      expect(store.selectedWorkOrder()).toBeNull();

      store.deleteWorkOrder('wo-1');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('should remove deleted work order from workOrders array (AC-C1)', () => {
      // Load list first
      store.loadWorkOrders();
      expect(store.workOrders().length).toBe(1);

      // Delete the work order
      store.deleteWorkOrder('wo-1');
      expect(store.workOrders().length).toBe(0);
      expect(store.workOrders().find(wo => wo.id === 'wo-1')).toBeUndefined();
    });

    it('should clear selected work order', () => {
      store.loadWorkOrderById('wo-1');
      expect(store.selectedWorkOrder()).not.toBeNull();

      store.deleteWorkOrder('wo-1');
      expect(store.selectedWorkOrder()).toBeNull();
    });

    it('should handle delete error', () => {
      workOrderServiceMock.deleteWorkOrder.mockReturnValue(throwError(() => ({ status: 404 })));
      store.deleteWorkOrder('wo-1');
      expect(store.error()).toBe('Work order not found.');
    });
  });

  describe('loadWorkOrderById', () => {
    it('should call service with id', () => {
      store.loadWorkOrderById('wo-1');
      expect(workOrderServiceMock.getWorkOrder).toHaveBeenCalledWith('wo-1');
    });

    it('should update selected work order', () => {
      store.loadWorkOrderById('wo-1');
      expect(store.selectedWorkOrder()).toEqual(mockWorkOrder);
    });

    it('should handle 404 error', () => {
      workOrderServiceMock.getWorkOrder.mockReturnValue(throwError(() => ({ status: 404 })));
      store.loadWorkOrderById('wo-1');
      expect(store.detailError()).toBe('Work order not found');
    });

    it('should handle other errors', () => {
      workOrderServiceMock.getWorkOrder.mockReturnValue(throwError(() => ({ status: 500 })));
      store.loadWorkOrderById('wo-1');
      expect(store.detailError()).toBe('Failed to load work order. Please try again.');
    });
  });

  describe('setStatusFilter', () => {
    it('should update selected statuses', () => {
      store.setStatusFilter(['Reported', 'Assigned']);
      expect(store.selectedStatuses()).toEqual(['Reported', 'Assigned']);
    });

    it('should reload work orders with status filter', () => {
      store.setStatusFilter(['Reported']);
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith('Reported', undefined);
    });

    it('should not allow empty status selection', () => {
      store.setStatusFilter([]);
      expect(store.selectedStatuses()).toEqual(['Reported', 'Assigned', 'Completed']);
    });

    it('should send undefined when all statuses selected', () => {
      store.setStatusFilter(['Reported', 'Assigned', 'Completed']);
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('setPropertyFilter', () => {
    it('should update selected property', () => {
      store.setPropertyFilter('prop-1');
      expect(store.selectedPropertyId()).toBe('prop-1');
    });

    it('should reload work orders with property filter', () => {
      store.setPropertyFilter('prop-1');
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenCalledWith(undefined, 'prop-1');
    });

    it('should clear property filter when null passed', () => {
      store.setPropertyFilter('prop-1');
      store.setPropertyFilter(null);
      expect(store.selectedPropertyId()).toBeNull();
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters', () => {
      store.setStatusFilter(['Reported']);
      store.setPropertyFilter('prop-1');

      store.clearFilters();

      expect(store.selectedStatuses()).toEqual(['Reported', 'Assigned', 'Completed']);
      expect(store.selectedPropertyId()).toBeNull();
    });

    it('should reload work orders without filters', () => {
      store.clearFilters();
      expect(workOrderServiceMock.getWorkOrders).toHaveBeenLastCalledWith(undefined, undefined);
    });
  });

  describe('loadTags', () => {
    it('should call service', () => {
      store.loadTags();
      expect(workOrderServiceMock.getWorkOrderTags).toHaveBeenCalled();
    });

    it('should update tags state', () => {
      store.loadTags();
      expect(store.tags()).toEqual([mockTag]);
    });

    it('should handle error silently', () => {
      workOrderServiceMock.getWorkOrderTags.mockReturnValue(throwError(() => new Error('Network')));
      store.loadTags();
      expect(store.tags()).toEqual([]);
      expect(store.isLoadingTags()).toBe(false);
    });
  });

  describe('createTag', () => {
    it('should call service with name', async () => {
      await store.createTag('New Tag');
      expect(workOrderServiceMock.createWorkOrderTag).toHaveBeenCalledWith({ name: 'New Tag' });
    });

    it('should return new tag id', async () => {
      const result = await store.createTag('New Tag');
      expect(result).toBe('new-tag-1');
    });

    it('should add tag to state', async () => {
      store.loadTags(); // Load initial tags
      await store.createTag('New Tag');
      expect(store.tags().length).toBe(2);
      expect(store.tags()[1]).toEqual({ id: 'new-tag-1', name: 'New Tag' });
    });

    it('should handle duplicate tag error', async () => {
      workOrderServiceMock.createWorkOrderTag.mockReturnValue(throwError(() => ({ status: 409 })));
      const result = await store.createTag('Existing Tag');
      expect(result).toBeNull();
      expect(snackBarMock.open).toHaveBeenCalledWith('A tag with that name already exists', 'Close', expect.any(Object));
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      workOrderServiceMock.getWorkOrders.mockReturnValue(throwError(() => new Error('Error')));
      store.loadWorkOrders();
      expect(store.error()).not.toBeNull();

      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  describe('clearSelectedWorkOrder', () => {
    it('should clear selected work order and detail error', () => {
      store.loadWorkOrderById('wo-1');
      expect(store.selectedWorkOrder()).not.toBeNull();

      store.clearSelectedWorkOrder();
      expect(store.selectedWorkOrder()).toBeNull();
      expect(store.detailError()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      store.loadWorkOrders();
      store.setStatusFilter(['Reported']);
      store.setPropertyFilter('prop-1');

      store.reset();

      expect(store.workOrders()).toEqual([]);
      expect(store.selectedStatuses()).toEqual(['Reported', 'Assigned', 'Completed']);
      expect(store.selectedPropertyId()).toBeNull();
      expect(store.error()).toBeNull();
    });
  });
});
