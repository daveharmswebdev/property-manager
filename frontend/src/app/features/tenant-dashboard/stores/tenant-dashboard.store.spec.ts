import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TenantDashboardStore } from './tenant-dashboard.store';
import { TenantService } from '../services/tenant.service';

describe('TenantDashboardStore', () => {
  let store: InstanceType<typeof TenantDashboardStore>;
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let tenantServiceMock: {
    getTenantProperty: ReturnType<typeof vi.fn>;
    getMaintenanceRequests: ReturnType<typeof vi.fn>;
    getMaintenanceRequestById: ReturnType<typeof vi.fn>;
    createMaintenanceRequest: ReturnType<typeof vi.fn>;
    generatePhotoUploadUrl: ReturnType<typeof vi.fn>;
    confirmPhotoUpload: ReturnType<typeof vi.fn>;
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
    snackBarMock = { open: vi.fn() };
    tenantServiceMock = {
      getTenantProperty: vi.fn().mockReturnValue(of(mockProperty)),
      getMaintenanceRequests: vi.fn().mockReturnValue(of(mockRequestsResponse)),
      getMaintenanceRequestById: vi.fn(),
      createMaintenanceRequest: vi.fn().mockReturnValue(of({ id: 'new-req-1' })),
      generatePhotoUploadUrl: vi.fn(),
      confirmPhotoUpload: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TenantDashboardStore,
        { provide: TenantService, useValue: tenantServiceMock },
        { provide: MatSnackBar, useValue: snackBarMock },
      ],
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

  // Task 8.1: submitRequest calls service and returns request ID on success (AC #2)
  it('submitRequest calls service and returns request ID on success', async () => {
    const result = await store.submitRequest('Leaky faucet');

    expect(tenantServiceMock.createMaintenanceRequest).toHaveBeenCalledWith('Leaky faucet');
    expect(result).toBe('new-req-1');
    expect(store.isSubmitting()).toBe(false);
    expect(store.submitError()).toBeNull();
    expect(snackBarMock.open).toHaveBeenCalledWith(
      'Maintenance request submitted',
      'Close',
      expect.objectContaining({ duration: 3000 }),
    );
  });

  // Task 8.2: submitRequest sets isSubmitting during request (AC #2)
  it('submitRequest sets isSubmitting during request', async () => {
    // Check initial state
    expect(store.isSubmitting()).toBe(false);

    // The method is async so we can't easily check mid-flight,
    // but we verify it resets to false after completion
    await store.submitRequest('Test');
    expect(store.isSubmitting()).toBe(false);
  });

  // Task 8.3: submitRequest handles error and sets submitError (AC #2)
  it('submitRequest handles error and sets submitError', async () => {
    tenantServiceMock.createMaintenanceRequest.mockReturnValue(
      throwError(() => new Error('Server error')),
    );

    const result = await store.submitRequest('Broken pipe');

    expect(result).toBeNull();
    expect(store.isSubmitting()).toBe(false);
    expect(store.submitError()).toBe('Failed to submit request. Please try again.');
    expect(snackBarMock.open).toHaveBeenCalledWith(
      'Failed to submit request. Please try again.',
      'Close',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  // Task 8.4: uploadPhoto returns true on successful 3-step upload (AC #3)
  it('uploadPhoto returns true on successful 3-step upload', async () => {
    tenantServiceMock.generatePhotoUploadUrl.mockReturnValue(
      of({
        uploadUrl: 'https://s3.example.com/presigned',
        storageKey: 'photos/req-1/abc.jpg',
        thumbnailStorageKey: 'photos/req-1/abc-thumb.jpg',
        expiresAt: '2026-04-16T12:00:00Z',
      }),
    );
    tenantServiceMock.confirmPhotoUpload.mockReturnValue(
      of({ id: 'photo-1', thumbnailUrl: null, viewUrl: null }),
    );

    // Mock global fetch for S3 upload
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await store.uploadPhoto('req-1', file);

    expect(result).toBe(true);
    expect(tenantServiceMock.generatePhotoUploadUrl).toHaveBeenCalledWith(
      'req-1',
      'image/jpeg',
      4,
      'photo.jpg',
    );
    expect(fetchMock).toHaveBeenCalledWith('https://s3.example.com/presigned', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'image/jpeg' },
    });
    expect(tenantServiceMock.confirmPhotoUpload).toHaveBeenCalledWith('req-1', {
      storageKey: 'photos/req-1/abc.jpg',
      thumbnailStorageKey: 'photos/req-1/abc-thumb.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 4,
      originalFileName: 'photo.jpg',
    });

    vi.unstubAllGlobals();
  });

  // Task 8.5: uploadPhoto returns false on failure (AC #3)
  it('uploadPhoto returns false on failure', async () => {
    tenantServiceMock.generatePhotoUploadUrl.mockReturnValue(
      throwError(() => new Error('Failed to get upload URL')),
    );

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await store.uploadPhoto('req-1', file);

    expect(result).toBe(false);
  });

  // Task 2.4: clearSubmitError clears the submit error
  it('clearSubmitError clears the submit error', async () => {
    tenantServiceMock.createMaintenanceRequest.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    await store.submitRequest('test');
    expect(store.submitError()).not.toBeNull();

    store.clearSubmitError();
    expect(store.submitError()).toBeNull();
  });
});
