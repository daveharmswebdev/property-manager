import { TestBed } from '@angular/core/testing';
import { PropertyStore } from './property.store';
import { PropertyService, GetAllPropertiesResponse } from '../services/property.service';
import { of, throwError, delay } from 'rxjs';

describe('PropertyStore', () => {
  let store: InstanceType<typeof PropertyStore>;
  let propertyServiceSpy: {
    getProperties: ReturnType<typeof vi.fn>;
  };

  const mockPropertiesResponse: GetAllPropertiesResponse = {
    items: [
      {
        id: '1',
        name: 'Oak Street Duplex',
        street: '123 Oak St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        expenseTotal: 1500,
        incomeTotal: 3000,
      },
      {
        id: '2',
        name: 'Maple Ave Condo',
        street: '456 Maple Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        expenseTotal: 800,
        incomeTotal: 2000,
      },
    ],
    totalCount: 2,
  };

  beforeEach(() => {
    propertyServiceSpy = {
      getProperties: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PropertyStore,
        { provide: PropertyService, useValue: propertyServiceSpy },
      ],
    });

    store = TestBed.inject(PropertyStore);
  });

  describe('initial state', () => {
    it('should have empty properties array', () => {
      expect(store.properties()).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(store.error()).toBeNull();
    });

    it('should have null selected year initially', () => {
      expect(store.selectedYear()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('should compute totalCount correctly', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.totalCount()).toBe(2);
    });

    it('should compute totalExpenses correctly', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.totalExpenses()).toBe(2300); // 1500 + 800
    });

    it('should compute totalIncome correctly', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.totalIncome()).toBe(5000); // 3000 + 2000
    });

    it('should compute netIncome correctly', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.netIncome()).toBe(2700); // 5000 - 2300
    });

    it('should compute isEmpty correctly when empty', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('should compute isEmpty correctly when has properties', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.isEmpty()).toBe(false);
    });

    it('should compute hasProperties correctly', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      expect(store.hasProperties()).toBe(false);

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.hasProperties()).toBe(true);
    });
  });

  describe('loadProperties', () => {
    it('should load properties successfully', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.properties()).toEqual(mockPropertiesResponse.items);
      expect(store.error()).toBeNull();
      expect(store.isLoading()).toBe(false);
    });

    it('should call service without year parameter', async () => {
      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(propertyServiceSpy.getProperties).toHaveBeenCalledWith(undefined);
    });

    it('should call service with year parameter', async () => {
      store.loadProperties(2024);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(propertyServiceSpy.getProperties).toHaveBeenCalledWith(2024);
    });

    it('should set selectedYear when loading with year', async () => {
      store.loadProperties(2024);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.selectedYear()).toBe(2024);
    });

    it('should handle error gracefully', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBe('Failed to load properties. Please try again.');
      expect(store.isLoading()).toBe(false);
      expect(store.properties()).toEqual([]);
    });

    it('should clear error before loading', async () => {
      // First, trigger an error
      propertyServiceSpy.getProperties.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).not.toBeNull();

      // Now load successfully
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      store.loadProperties(undefined);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).not.toBeNull();

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      propertyServiceSpy.getProperties.mockReturnValue(of(mockPropertiesResponse));

      store.loadProperties(2024);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.properties().length).toBeGreaterThan(0);

      store.reset();

      expect(store.properties()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.selectedYear()).toBeNull();
    });
  });

  describe('setSelectedYear', () => {
    it('should set selected year', () => {
      store.setSelectedYear(2024);
      expect(store.selectedYear()).toBe(2024);
    });

    it('should allow setting null year', () => {
      store.setSelectedYear(2024);
      store.setSelectedYear(null);
      expect(store.selectedYear()).toBeNull();
    });
  });
});
