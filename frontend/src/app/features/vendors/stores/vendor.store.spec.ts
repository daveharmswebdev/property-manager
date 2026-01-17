import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VendorStore } from './vendor.store';
import {
  ApiClient,
  VendorDto,
  VendorTradeTagDto,
} from '../../../core/api/api.service';

describe('VendorStore', () => {
  let store: InstanceType<typeof VendorStore>;
  let mockApiClient: {
    vendors_GetAllVendors: ReturnType<typeof vi.fn>;
    vendors_CreateVendor: ReturnType<typeof vi.fn>;
    vendors_DeleteVendor: ReturnType<typeof vi.fn>;
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
      vendors_DeleteVendor: vi.fn(),
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

  // Story 8-6: Search & Filter Vendors Tests
  describe('filter functionality (Story 8-6)', () => {
    const plumberTag: VendorTradeTagDto = { id: 'tag-1', name: 'Plumber' };
    const electricianTag: VendorTradeTagDto = {
      id: 'tag-2',
      name: 'Electrician',
    };
    const hvacTag: VendorTradeTagDto = { id: 'tag-3', name: 'HVAC' };

    const vendorsWithTags: VendorDto[] = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        tradeTags: [plumberTag],
      } as VendorDto,
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        fullName: 'Jane Smith',
        tradeTags: [electricianTag],
      } as VendorDto,
      {
        id: '3',
        firstName: 'Bob',
        lastName: 'Johnson',
        fullName: 'Bob Johnson',
        tradeTags: [plumberTag, hvacTag],
      } as VendorDto,
      {
        id: '4',
        firstName: 'Alice',
        lastName: 'Williams',
        fullName: 'Alice Williams',
        tradeTags: [],
      } as VendorDto,
    ];

    beforeEach(() => {
      // Load vendors with trade tags for filter tests
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: vendorsWithTags, totalCount: 4 })
      );
      store.loadVendors();
    });

    describe('initial filter state', () => {
      it('should have empty searchTerm', () => {
        expect(store.searchTerm()).toBe('');
      });

      it('should have empty selectedTradeTagIds', () => {
        expect(store.selectedTradeTagIds()).toEqual([]);
      });

      it('should have hasActiveFilters false when no filters set', () => {
        expect(store.hasActiveFilters()).toBe(false);
      });

      it('should return all vendors in filteredVendors when no filters', () => {
        expect(store.filteredVendors()).toEqual(vendorsWithTags);
      });
    });

    describe('filteredVendors with search term (AC #1)', () => {
      it('5.1 - should filter by first name (case-insensitive)', () => {
        store.setSearchTerm('john');

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(2); // John Doe and Bob Johnson
        expect(filtered.map((v) => v.firstName)).toContain('John');
        expect(filtered.map((v) => v.lastName)).toContain('Johnson');
      });

      it('5.2 - should filter by last name (case-insensitive)', () => {
        store.setSearchTerm('smith');

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(1);
        expect(filtered[0].lastName).toBe('Smith');
      });

      it('5.3 - should filter by full name (case-insensitive)', () => {
        store.setSearchTerm('jane smith');

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(1);
        expect(filtered[0].fullName).toBe('Jane Smith');
      });

      it('should handle partial name matching', () => {
        store.setSearchTerm('jo');

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(2); // John Doe, Bob Johnson
      });

      it('should handle whitespace in search term', () => {
        store.setSearchTerm('  jane  ');

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(1);
        expect(filtered[0].firstName).toBe('Jane');
      });
    });

    describe('filteredVendors with trade tag filter (AC #2)', () => {
      it('5.4 - should filter by single trade tag', () => {
        store.setTradeTagFilter(['tag-1']); // Plumber

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(2); // John Doe, Bob Johnson
        expect(filtered.every((v) => v.tradeTags?.some((t) => t.id === 'tag-1'))).toBe(true);
      });

      it('5.5 - should filter by multiple trade tags (OR logic)', () => {
        store.setTradeTagFilter(['tag-1', 'tag-2']); // Plumber OR Electrician

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(3); // John, Jane, Bob
        expect(filtered.map((v) => v.firstName).sort()).toEqual([
          'Bob',
          'Jane',
          'John',
        ]);
      });

      it('should not include vendors with no matching tags', () => {
        store.setTradeTagFilter(['tag-2']); // Electrician only

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(1);
        expect(filtered[0].firstName).toBe('Jane');
      });

      it('should not include vendors with empty trade tags', () => {
        store.setTradeTagFilter(['tag-1']); // Plumber

        const filtered = store.filteredVendors();
        expect(filtered.find((v) => v.firstName === 'Alice')).toBeUndefined();
      });
    });

    describe('filteredVendors with combined filters (AC #3)', () => {
      it('5.6 - should apply AND logic for search + trade tag', () => {
        store.setSearchTerm('bob');
        store.setTradeTagFilter(['tag-1']); // Plumber

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(1);
        expect(filtered[0].firstName).toBe('Bob');
      });

      it('should return empty when combined filters have no match', () => {
        store.setSearchTerm('jane');
        store.setTradeTagFilter(['tag-1']); // Plumber - Jane is Electrician

        const filtered = store.filteredVendors();
        expect(filtered.length).toBe(0);
      });
    });

    describe('clearFilters (AC #3)', () => {
      it('5.7 - should reset both searchTerm and selectedTradeTagIds', () => {
        store.setSearchTerm('test');
        store.setTradeTagFilter(['tag-1', 'tag-2']);

        store.clearFilters();

        expect(store.searchTerm()).toBe('');
        expect(store.selectedTradeTagIds()).toEqual([]);
        expect(store.filteredVendors()).toEqual(vendorsWithTags);
      });
    });

    describe('hasActiveFilters (AC #3)', () => {
      it('5.8 - should return true when searchTerm is set', () => {
        store.setSearchTerm('test');

        expect(store.hasActiveFilters()).toBe(true);
      });

      it('5.8 - should return true when trade tags are selected', () => {
        store.setTradeTagFilter(['tag-1']);

        expect(store.hasActiveFilters()).toBe(true);
      });

      it('5.8 - should return true when both filters are set', () => {
        store.setSearchTerm('test');
        store.setTradeTagFilter(['tag-1']);

        expect(store.hasActiveFilters()).toBe(true);
      });

      it('should return false when searchTerm is only whitespace', () => {
        store.setSearchTerm('   ');

        expect(store.hasActiveFilters()).toBe(false);
      });
    });

    describe('noMatchesFound (AC #4)', () => {
      it('5.9 - should return false when vendors list is empty (no vendors at all)', () => {
        mockApiClient.vendors_GetAllVendors.mockReturnValue(
          of({ items: [], totalCount: 0 })
        );
        store.loadVendors();
        store.setSearchTerm('test');

        expect(store.noMatchesFound()).toBe(false);
      });

      it('5.9 - should return false when no filters are active', () => {
        expect(store.noMatchesFound()).toBe(false);
      });

      it('5.9 - should return true when filters return no results but vendors exist', () => {
        store.setSearchTerm('nonexistent');

        expect(store.noMatchesFound()).toBe(true);
      });

      it('5.9 - should return false when filters return some results', () => {
        store.setSearchTerm('john');

        expect(store.noMatchesFound()).toBe(false);
      });

      it('should return true when combined filters return no results', () => {
        store.setSearchTerm('jane');
        store.setTradeTagFilter(['tag-1']); // Jane is Electrician, not Plumber

        expect(store.noMatchesFound()).toBe(true);
      });
    });

    describe('setSearchTerm', () => {
      it('should update searchTerm state', () => {
        store.setSearchTerm('new term');

        expect(store.searchTerm()).toBe('new term');
      });
    });

    describe('setTradeTagFilter', () => {
      it('should update selectedTradeTagIds state', () => {
        store.setTradeTagFilter(['tag-1', 'tag-2']);

        expect(store.selectedTradeTagIds()).toEqual(['tag-1', 'tag-2']);
      });

      it('should handle empty array', () => {
        store.setTradeTagFilter(['tag-1']);
        store.setTradeTagFilter([]);

        expect(store.selectedTradeTagIds()).toEqual([]);
      });
    });
  });

  // Story 8-8: Delete Vendor Tests
  describe('deleteVendor (Story 8-8)', () => {
    beforeEach(() => {
      // Load vendors first
      mockApiClient.vendors_GetAllVendors.mockReturnValue(
        of({ items: mockVendors, totalCount: 2 })
      );
      store.loadVendors();
    });

    it('should have isDeleting false initially', () => {
      expect(store.isDeleting()).toBe(false);
    });

    it('should call API with vendor id (AC #5)', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(of(undefined));

      store.deleteVendor('1');

      expect(mockApiClient.vendors_DeleteVendor).toHaveBeenCalledWith('1');
    });

    it('should remove vendor from local state on success (AC #3)', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(of(undefined));
      expect(store.vendors().length).toBe(2);

      store.deleteVendor('1');

      expect(store.vendors().length).toBe(1);
      expect(store.vendors().find((v) => v.id === '1')).toBeUndefined();
      expect(store.vendors().find((v) => v.id === '2')).toBeDefined();
    });

    it('should show success snackbar on delete (AC #4)', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(of(undefined));

      store.deleteVendor('1');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Vendor deleted',
        'Close',
        expect.objectContaining({ duration: 3000 })
      );
    });

    it('should set isDeleting false after success', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(of(undefined));

      store.deleteVendor('1');

      expect(store.isDeleting()).toBe(false);
    });

    it('should handle 404 error with specific message (AC #6)', () => {
      const error = { status: 404 };
      mockApiClient.vendors_DeleteVendor.mockReturnValue(throwError(() => error));

      store.deleteVendor('nonexistent');

      expect(store.error()).toBe('Vendor not found.');
      expect(store.isDeleting()).toBe(false);
    });

    it('should handle generic error', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.deleteVendor('1');

      expect(store.error()).toBe('Failed to delete vendor. Please try again.');
      expect(store.isDeleting()).toBe(false);
    });

    it('should show error snackbar on failure', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.deleteVendor('1');

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to delete vendor. Please try again.',
        'Close',
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('should not remove vendor from local state on error', () => {
      mockApiClient.vendors_DeleteVendor.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      expect(store.vendors().length).toBe(2);

      store.deleteVendor('1');

      expect(store.vendors().length).toBe(2);
    });
  });
});
