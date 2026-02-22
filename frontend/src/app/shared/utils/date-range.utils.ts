import { formatLocalDate } from './date.utils';

/**
 * Date range preset options for filtering (AC-3.4.3)
 */
export type DateRangePreset = 'this-month' | 'this-quarter' | 'this-year' | 'custom' | 'all';

/**
 * Calculate date range from preset.
 * Extracted from expense-list.store.ts for shared use across list views.
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  year?: number | null
): { dateFrom: string | null; dateTo: string | null } {
  const today = new Date();
  const currentYear = year || today.getFullYear();

  switch (preset) {
    case 'this-month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        dateFrom: formatLocalDate(firstDay),
        dateTo: formatLocalDate(today),
      };
    }
    case 'this-quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), quarter * 3, 1);
      return {
        dateFrom: formatLocalDate(firstDay),
        dateTo: formatLocalDate(today),
      };
    }
    case 'this-year': {
      return {
        dateFrom: `${currentYear}-01-01`,
        dateTo: `${currentYear}-12-31`,
      };
    }
    case 'all':
    case 'custom':
    default:
      return { dateFrom: null, dateTo: null };
  }
}
