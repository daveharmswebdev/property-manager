import { describe, it, expect } from 'vitest';
import { parseLocalDate, formatLocalDate, formatDateShort, formatDateLong } from './date.utils';

describe('Date Utils', () => {
  describe('parseLocalDate', () => {
    it('should parse ISO date string (YYYY-MM-DD) to local date', () => {
      const result = parseLocalDate('2025-12-28');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11); // December is month 11 (0-indexed)
      expect(result.getDate()).toBe(28);
    });

    it('should parse ISO datetime string (YYYY-MM-DDTHH:mm:ss) to local date', () => {
      const result = parseLocalDate('2025-12-28T10:30:00');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(28);
    });

    it('should parse ISO datetime string with timezone to local date', () => {
      const result = parseLocalDate('2025-12-28T00:00:00.000Z');

      // Should still be Dec 28, not Dec 27 (the UTC issue we're fixing)
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(28);
    });

    it('should handle first day of month', () => {
      const result = parseLocalDate('2025-03-01');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March is month 2
      expect(result.getDate()).toBe(1);
    });

    it('should handle last day of month', () => {
      const result = parseLocalDate('2025-01-31');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January is month 0
      expect(result.getDate()).toBe(31);
    });

    it('should handle first day of year', () => {
      const result = parseLocalDate('2025-01-01');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });

    it('should handle last day of year', () => {
      const result = parseLocalDate('2025-12-31');

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(31);
    });

    it('should handle leap year date', () => {
      const result = parseLocalDate('2024-02-29');

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February is month 1
      expect(result.getDate()).toBe(29);
    });

    it('should return current date for empty string', () => {
      const result = parseLocalDate('');
      const now = new Date();

      expect(result.getFullYear()).toBe(now.getFullYear());
      expect(result.getMonth()).toBe(now.getMonth());
      expect(result.getDate()).toBe(now.getDate());
    });
  });

  describe('formatLocalDate', () => {
    it('should format Date to YYYY-MM-DD using local timezone', () => {
      // Nov 1 2025 — would shift to Oct 31 under toISOString() in UTC-5
      const date = new Date(2025, 10, 1); // month 10 = November
      expect(formatLocalDate(date)).toBe('2025-11-01');
    });

    it('should pad single-digit month and day', () => {
      const date = new Date(2025, 0, 5); // Jan 5
      expect(formatLocalDate(date)).toBe('2025-01-05');
    });

    it('should handle Dec 31 (year boundary)', () => {
      const date = new Date(2025, 11, 31);
      expect(formatLocalDate(date)).toBe('2025-12-31');
    });

    it('should handle Jan 1 (year boundary)', () => {
      const date = new Date(2026, 0, 1);
      expect(formatLocalDate(date)).toBe('2026-01-01');
    });

    it('should handle leap year Feb 29', () => {
      const date = new Date(2024, 1, 29);
      expect(formatLocalDate(date)).toBe('2024-02-29');
    });
  });

  describe('formatDateShort', () => {
    it('should format date as "MMM DD, YYYY"', () => {
      const result = formatDateShort('2025-12-28');

      expect(result).toBe('Dec 28, 2025');
    });

    it('should format January date correctly', () => {
      const result = formatDateShort('2025-01-15');

      expect(result).toBe('Jan 15, 2025');
    });

    it('should format single-digit day with leading zero', () => {
      const result = formatDateShort('2025-03-05');

      expect(result).toBe('Mar 05, 2025');
    });

    it('should handle datetime string correctly', () => {
      const result = formatDateShort('2025-12-28T10:30:00');

      expect(result).toBe('Dec 28, 2025');
    });

    it('should handle UTC datetime string correctly', () => {
      // This is the key test - UTC string should still show Dec 28, not Dec 27
      const result = formatDateShort('2025-12-28T00:00:00.000Z');

      expect(result).toBe('Dec 28, 2025');
    });
  });

  describe('formatDateLong', () => {
    it('should format date as "MMMM D, YYYY"', () => {
      const result = formatDateLong('2025-12-28');

      expect(result).toBe('December 28, 2025');
    });

    it('should format January date correctly', () => {
      const result = formatDateLong('2025-01-15');

      expect(result).toBe('January 15, 2025');
    });

    it('should handle datetime string correctly', () => {
      const result = formatDateLong('2025-12-28T10:30:00');

      expect(result).toBe('December 28, 2025');
    });
  });
});
