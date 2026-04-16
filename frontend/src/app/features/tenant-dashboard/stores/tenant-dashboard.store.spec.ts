import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TenantDashboardStore } from './tenant-dashboard.store';
import { TenantService } from '../services/tenant.service';

describe('TenantDashboardStore', () => {
  let store: InstanceType<typeof TenantDashboardStore>;
  let tenantServiceMock: {
    getTenantProperty: ReturnType<typeof vi.fn>;
    getMaintenanceRequests: ReturnType<typeof vi.fn>;
    getMaintenanceRequestById: ReturnType<typeof vi.fn>;
  };

  const mockProperty = {
    id: 'prop-1',
    name: 'Sunset Apartments',
    street: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
  };

  const mockRequestsResponse = {
    items: [
      {
        id: 'req-1',
        propertyId: 'prop-1',
        propertyName: 'Sunset Apartments',
        propertyAddress: '123 Main St, Austin, TX 78701',
        description: 'Broken window',
        status: 'Submitted',
        dismissalReason: null,
        submittedByUserId: 'user-1',
        submittedByUserName: 'John',
        workOrderId: null,
        createdAt: '2026-04-10T00:00:00Z',
        updatedAt: '2026-04-10T00:00:00Z',
        photos: null,
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    tenantServiceMock = {
      getTenantProperty: vi.fn().mockReturnValue(of(mockProperty)),
      getMaintenanceRequests: vi.fn().mockReturnValue(of(mockRequestsResponse)),
      getMaintenanceRequestById: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [TenantDashboardStore, { provide: TenantService, useValue: tenantServiceMock }],
    });

    store = TestBed.inject(TenantDashboardStore);
  });

  // Task 13.1: loadProperty() fetches and stores property data
  it('loadProperty() fetches and stores property data', () => {
    store.loadProperty();

    expect(tenantServiceMock.getTenantProperty).toHaveBeenCalled();
    expect(store.property()).toEqual(mockProperty);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  // Task 13.2: loadProperty() error sets error state
  it('loadProperty() error sets error state', () => {
    tenantServiceMock.getTenantProperty.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    store.loadProperty();

    expect(store.property()).toBeNull();
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBe('Failed to load property information.');
  });

  // Task 13.3: loadRequests() fetches and stores maintenance requests
  it('loadRequests() fetches and stores maintenance requests', () => {
    store.loadRequests();

    expect(tenantServiceMock.getMaintenanceRequests).toHaveBeenCalled();
    expect(store.requests()).toEqual(mockRequestsResponse.items);
    expect(store.totalCount()).toBe(1);
    expect(store.isLoading()).toBe(false);
  });

  // Task 13.4: loadRequests() error sets error state
  it('loadRequests() error sets error state', () => {
    tenantServiceMock.getMaintenanceRequests.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    store.loadRequests();

    expect(store.requests()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBe('Failed to load maintenance requests.');
  });

  // Task 13.5: totalPages computed correctly
  it('totalPages computes correctly', () => {
    const manyRequestsResponse = {
      ...mockRequestsResponse,
      totalCount: 45,
      pageSize: 20,
    };
    tenantServiceMock.getMaintenanceRequests.mockReturnValue(of(manyRequestsResponse));

    store.loadRequests();

    expect(store.totalPages()).toBe(3);
  });

  // Task 13.6: propertyAddress formats correctly
  it('propertyAddress formats correctly', () => {
    store.loadProperty();

    expect(store.propertyAddress()).toBe('123 Main St, Austin, TX 78701');
  });
});
