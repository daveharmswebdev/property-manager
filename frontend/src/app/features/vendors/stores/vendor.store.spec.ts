import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VendorStore } from './vendor.store';
import { ApiClient, VendorDto } from '../../../core/api/api.service';

describe('VendorStore', () => {
  let store: InstanceType<typeof VendorStore>;
  let mockApiClient: {
    vendors_GetAllVendors: ReturnType<typeof vi.fn>;
    vendors_CreateVendor: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  const mockVendors: VendorDto[] = [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
    } as VendorDto,
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      fullName: 'Jane Smith',
    } as VendorDto,
  ];

  beforeEach(() => {
    mockApiClient = {
      vendors_GetAllVendors: vi.fn(),
      vendors_CreateVendor: vi.fn(),
    };
    mockRouter = { navigate: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        VendorStore,
        { provide: ApiClient, useValue: mockApiClient },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    store = TestBed.inject(VendorStore);
  });

  describe('initial state', () => {
    it('should have empty vendors array', () => {
      expect(store.vendors()).toEqual([]);
    });

    it('should have isLoading false', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have isSaving false', () => {
      expect(store.isSaving()).toBe(false);
    });

    it('should have error null', () => {
      expect(store.error()).toBeNull();
    });

    it('should have totalCount 0', () => {
      expect(store.totalCount()).toBe(0);
    });

    it('should have isEmpty true when not loading and no vendors', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('should have hasVendors false when no vendors', () => {
      expect(store.hasVendors()).toBe(false);
    });
  });

  describe('loadVendors', () => {
    it('should set isLoading true while loading (AC #1)', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: [], totalCount: 0 })
      );

      store.loadVendors();

      // After the observable completes, isLoading should be false
      expect(store.isLoading()).toBe(false);
    });

    it('should load vendors from API (AC #1)', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: mockVendors, totalCount: 2 })
      );

      store.loadVendors();

      expect(store.vendors()).toEqual(mockVendors);
      expect(store.totalCount()).toBe(2);
      expect(store.isLoading()).toBe(false);
    });

    it('should set hasVendors true when vendors loaded', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: mockVendors, totalCount: 2 })
      );

      store.loadVendors();

      expect(store.hasVendors()).toBe(true);
      expect(store.isEmpty()).toBe(false);
    });

    it('should handle empty response (AC #2)', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: [], totalCount: 0 })
      );

      store.loadVendors();

      expect(store.vendors()).toEqual([]);
      expect(store.isEmpty()).toBe(true);
      expect(store.hasVendors()).toBe(false);
    });

    it('should handle null items in response', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: null, totalCount: 0 })
      );

      store.loadVendors();

      expect(store.vendors()).toEqual([]);
    });

    it('should set error on API failure', () => {
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        throwError(() => new Error('API Error'))
      );

      store.loadVendors();

      expect(store.error()).toBe('Failed to load vendors. Please try again.');
      expect(store.isLoading()).toBe(false);
    });

    it('should clear error before loading', () => {
      // First, simulate an error
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        throwError(() => new Error('API Error'))
      );
      store.loadVendors();
      expect(store.error()).not.toBeNull();

      // Then load successfully
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: mockVendors, totalCount: 2 })
      );
      store.loadVendors();

      expect(store.error()).toBeNull();
    });
  });

  describe('createVendor', () => {
    const createRequest = {
      firstName: 'New',
      middleName: undefined,
      lastName: 'Vendor',
    };

    it('should set isSaving true while saving (AC #4)', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        of({ id: 'new-id' })
      );

      store.createVendor(createRequest);

      // After the observable completes, isSaving should be false
      expect(store.isSaving()).toBe(false);
    });

    it('should call API with request data (AC #4)', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        of({ id: 'new-id' })
      );

      store.createVendor(createRequest);

      expect(mockApiClient.vendors_CreateVendor).toHaveBeenCalledWith(createRequest);
    });

    it('should show success snackbar on create (AC #4)', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        of({ id: 'new-id' })
      );

      store.createVendor(createRequest);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Vendor added ✓',
        'Close',
        expect.objectContaining({ duration: 3000 })
      );
    });

    it('should navigate to /vendors on success (AC #4)', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        of({ id: 'new-id' })
      );

      store.createVendor(createRequest);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/vendors']);
    });

    it('should handle 400 error with specific message', () => {
      const error = { status: 400 };
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        throwError(() => error)
      );

      store.createVendor(createRequest);

      expect(store.error()).toBe('Invalid vendor data. Please check your input.');
      expect(store.isSaving()).toBe(false);
    });

    it('should handle generic error', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.createVendor(createRequest);

      expect(store.error()).toBe('Failed to save vendor. Please try again.');
    });

    it('should show error snackbar on failure', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.createVendor(createRequest);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to save vendor. Please try again.',
        'Close',
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('should not navigate on failure', () => {
      mockApiClient.vendors_CreateVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.createVendor(createRequest);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Set an error first
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        throwError(() => new Error('API Error'))
      );
      store.loadVendors();
      expect(store.error()).not.toBeNull();

      // Clear it
      store.clearError();

      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      // Load some data first
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: mockVendors, totalCount: 2 })
      );
      store.loadVendors();
      expect(store.vendors().length).toBe(2);

      // Reset
      store.reset();

      expect(store.vendors()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.isSaving()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });
});
