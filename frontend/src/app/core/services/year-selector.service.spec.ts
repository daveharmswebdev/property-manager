import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { YearSelectorService } from './year-selector.service';

describe('YearSelectorService', () => {
  let service: YearSelectorService;
  let localStorageMock: { [key: string]: string };
  let getItemSpy: Mock;
  let setItemSpy: Mock;
  let removeItemSpy: Mock;

  const STORAGE_KEY = 'propertyManager.selectedYear';
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    // Reset localStorage mock before each test
    localStorageMock = {};

    // Create mock functions
    getItemSpy = vi.fn((key: string) => localStorageMock[key] ?? null);
    setItemSpy = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    removeItemSpy = vi.fn((key: string) => {
      delete localStorageMock[key];
    });

    // Replace localStorage methods with spies
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: getItemSpy,
        setItem: setItemSpy,
        removeItem: removeItemSpy,
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [YearSelectorService]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // Helper to create a fresh service instance
  const createService = () => TestBed.inject(YearSelectorService);

  it('should be created', () => {
    service = createService();
    expect(service).toBeTruthy();
  });

  describe('selectedYear', () => {
    it('should default to current year', () => {
      service = createService();
      expect(service.selectedYear()).toBe(currentYear);
    });
  });

  describe('availableYears', () => {
    it('should return 6 years', () => {
      service = createService();
      const years = service.availableYears();
      expect(years.length).toBe(6);
    });

    it('should start with current year', () => {
      service = createService();
      const years = service.availableYears();
      expect(years[0]).toBe(currentYear);
    });

    it('should be in descending order', () => {
      service = createService();
      const years = service.availableYears();
      for (let i = 1; i < years.length; i++) {
        expect(years[i]).toBe(years[i - 1] - 1);
      }
    });

    it('should include 5 previous years', () => {
      service = createService();
      const years = service.availableYears();
      expect(years[5]).toBe(currentYear - 5);
    });
  });

  describe('setYear', () => {
    it('should update selectedYear', () => {
      service = createService();
      const testYear = currentYear - 2;
      service.setYear(testYear);
      expect(service.selectedYear()).toBe(testYear);
    });

    it('should reject year outside available range', () => {
      service = createService();
      const invalidYear = currentYear - 10; // Too old
      const originalYear = service.selectedYear();

      service.setYear(invalidYear);

      // Should not have changed
      expect(service.selectedYear()).toBe(originalYear);
    });

    it('should reject future years', () => {
      service = createService();
      const futureYear = currentYear + 5;
      const originalYear = service.selectedYear();

      service.setYear(futureYear);

      // Should not have changed
      expect(service.selectedYear()).toBe(originalYear);
    });
  });

  describe('reset', () => {
    it('should reset to current year', () => {
      service = createService();
      service.setYear(currentYear - 3);
      service.reset();
      expect(service.selectedYear()).toBe(currentYear);
    });

    it('should write current year to localStorage on reset', () => {
      service = createService();
      service.setYear(currentYear - 2);
      setItemSpy.mockClear(); // Clear previous calls

      service.reset();

      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, currentYear.toString());
    });
  });

  describe('localStorage persistence', () => {
    it('should read stored year on initialization (AC-7.3.1, AC-7.3.2)', () => {
      // Pre-populate localStorage before service creation
      const storedYear = currentYear - 1;
      localStorageMock[STORAGE_KEY] = storedYear.toString();

      service = createService();

      expect(getItemSpy).toHaveBeenCalledWith(STORAGE_KEY);
      expect(service.selectedYear()).toBe(storedYear);
    });

    it('should write to localStorage when year changes (AC-7.3.1, AC-7.3.2)', () => {
      service = createService();
      const testYear = currentYear - 1;

      service.setYear(testYear);

      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, testYear.toString());
      expect(localStorageMock[STORAGE_KEY]).toBe(testYear.toString());
    });

    it('should fall back to current year when localStorage is empty (AC-7.3.3)', () => {
      // localStorage is empty (default state from beforeEach)
      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
    });

    it('should fall back to current year when stored value is invalid string (AC-7.3.4)', () => {
      localStorageMock[STORAGE_KEY] = 'abc';

      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
    });

    it('should fall back to current year when stored value is negative (AC-7.3.4)', () => {
      localStorageMock[STORAGE_KEY] = '-1';

      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
    });

    it('should fall back to current year when stored year is out of range - too old (AC-7.3.5)', () => {
      // Year too old (more than 5 years ago)
      localStorageMock[STORAGE_KEY] = (currentYear - 10).toString();

      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
      // Should have replaced the invalid value with current year in localStorage
      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, currentYear.toString());
    });

    it('should fall back to current year when stored year is in the future (AC-7.3.5)', () => {
      localStorageMock[STORAGE_KEY] = (currentYear + 5).toString();

      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
      // Should have replaced the invalid value with current year in localStorage
      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, currentYear.toString());
    });

    it('should handle localStorage getItem exception gracefully (AC-7.3.3)', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      // Service should still work, defaulting to current year
      service = createService();

      expect(service.selectedYear()).toBe(currentYear);
    });

    it('should handle localStorage setItem exception gracefully', () => {
      service = createService();

      setItemSpy.mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      // Should not throw
      expect(() => service.setYear(currentYear - 1)).not.toThrow();
      expect(service.selectedYear()).toBe(currentYear - 1);
    });

    it('should replace invalid stored value with current year in localStorage (AC-7.3.4)', () => {
      localStorageMock[STORAGE_KEY] = 'invalid';

      service = createService();

      // Should have written the valid current year back
      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, currentYear.toString());
    });

    it('should accept valid year within range', () => {
      const validYear = currentYear - 3; // 3 years ago is valid (within 6 year range)
      localStorageMock[STORAGE_KEY] = validYear.toString();

      service = createService();

      expect(service.selectedYear()).toBe(validYear);
    });
  });
});
