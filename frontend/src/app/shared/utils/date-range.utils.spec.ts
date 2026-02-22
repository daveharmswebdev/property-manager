/**
 * ATDD RED Phase — Story 16.6, Task 1.6
 *
 * Tests for getDateRangeFromPreset() utility extracted from expense-list.store.ts.
 * Will NOT pass until date-range.utils.ts is created (Task 1.1).
 */
import { describe, it, expect } from 'vitest';
import { getDateRangeFromPreset, type DateRangePreset } from './date-range.utils';
import { formatLocalDate } from './date.utils';

describe('date-range.utils', () => {
  describe('getDateRangeFromPreset', () => {
    // AC1 — Shared date range selector presets

    describe('this-month preset', () => {
      it('should return first day of current month as dateFrom', () => {
        const result = getDateRangeFromPreset('this-month');
        const now = new Date();
        const expected = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        expect(result.dateFrom).toBe(expected);
      });

      it('should return today as dateTo', () => {
        const result = getDateRangeFromPreset('this-month');
        const expected = formatLocalDate(new Date());
        expect(result.dateTo).toBe(expected);
      });
    });

    describe('this-quarter preset', () => {
      it('should return first day of current quarter as dateFrom', () => {
        const result = getDateRangeFromPreset('this-quarter');
        const now = new Date();
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const expected = formatLocalDate(new Date(now.getFullYear(), quarterMonth, 1));
        expect(result.dateFrom).toBe(expected);
      });

      it('should return today as dateTo', () => {
        const result = getDateRangeFromPreset('this-quarter');
        const expected = formatLocalDate(new Date());
        expect(result.dateTo).toBe(expected);
      });
    });

    describe('this-year preset', () => {
      it('should return Jan 1 of current year as dateFrom', () => {
        const result = getDateRangeFromPreset('this-year');
        const now = new Date();
        const expected = formatLocalDate(new Date(now.getFullYear(), 0, 1));
        expect(result.dateFrom).toBe(expected);
      });

      it('should return Dec 31 of current year as dateTo', () => {
        const result = getDateRangeFromPreset('this-year');
        const now = new Date();
        const expected = formatLocalDate(new Date(now.getFullYear(), 11, 31));
        expect(result.dateTo).toBe(expected);
      });
    });

    describe('this-year preset with explicit year', () => {
      it('should return Jan 1 of given year as dateFrom', () => {
        const result = getDateRangeFromPreset('this-year', 2024);
        expect(result.dateFrom).toBe('2024-01-01');
      });

      it('should return Dec 31 of given year as dateTo', () => {
        const result = getDateRangeFromPreset('this-year', 2024);
        expect(result.dateTo).toBe('2024-12-31');
      });
    });

    describe('all preset', () => {
      it('should return null dateFrom', () => {
        const result = getDateRangeFromPreset('all');
        expect(result.dateFrom).toBeNull();
      });

      it('should return null dateTo', () => {
        const result = getDateRangeFromPreset('all');
        expect(result.dateTo).toBeNull();
      });
    });

    describe('custom preset', () => {
      it('should return null dateFrom', () => {
        const result = getDateRangeFromPreset('custom');
        expect(result.dateFrom).toBeNull();
      });

      it('should return null dateTo', () => {
        const result = getDateRangeFromPreset('custom');
        expect(result.dateTo).toBeNull();
      });
    });
  });

  describe('DateRangePreset type', () => {
    it('should accept all valid preset values', () => {
      const validPresets: DateRangePreset[] = [
        'this-month',
        'this-quarter',
        'this-year',
        'custom',
        'all',
      ];
      // Type-check passes if this compiles — runtime check for completeness
      expect(validPresets).toHaveLength(5);
    });
  });
});
