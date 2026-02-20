/**
 * Date utility functions for consistent timezone handling
 *
 * Problem: JavaScript's Date constructor interprets ISO date strings (YYYY-MM-DD)
 * as UTC midnight. When displayed with toLocaleDateString() in timezones west of UTC,
 * this shows the previous day.
 *
 * Solution: Parse dates using the Date constructor with explicit year, month, day
 * parameters to create dates at midnight in the LOCAL timezone.
 */

/**
 * Parse an ISO date string to a Date object in the local timezone.
 * Handles both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DDTHH:mm:ss) formats.
 *
 * @param dateString - ISO date string (e.g., "2025-12-28" or "2025-12-28T10:30:00")
 * @returns Date object at midnight in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }

  // Extract date part (before T if present)
  const datePart = dateString.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length !== 3) {
    // Fallback for unexpected format
    return new Date(dateString);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(parts[2], 10);

  return new Date(year, month, day);
}

/**
 * Format a Date object to an ISO date string (YYYY-MM-DD) using local timezone.
 * Avoids the UTC shift bug of toISOString().split('T')[0].
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display in a short format.
 * Uses parseLocalDate to ensure correct timezone handling.
 *
 * @param dateString - ISO date string
 * @returns Formatted string like "Dec 28, 2025"
 */
export function formatDateShort(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date string for display in a long format.
 * Uses parseLocalDate to ensure correct timezone handling.
 *
 * @param dateString - ISO date string
 * @returns Formatted string like "December 28, 2025"
 */
export function formatDateLong(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
