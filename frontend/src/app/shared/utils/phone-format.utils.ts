/**
 * Shared phone formatting utility.
 *
 * Used by both PhoneFormatPipe (display) and PhoneMaskDirective (input).
 * Formats US phone numbers as (XXX) XXX-XXXX.
 *
 * For display contexts (pipe), trailing separators on partial numbers are omitted.
 * For input contexts (directive), trailing separators are included to guide typing.
 */

/**
 * Strip all non-digit characters and limit to 10 digits.
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/**
 * Format digits for display — no trailing separators on partial input.
 * Used by PhoneFormatPipe.
 *
 * Examples:
 *   ''           → ''
 *   '512'        → '(512)'
 *   '512555'     → '(512) 555'
 *   '5125551234' → '(512) 555-1234'
 */
export function formatPhoneDisplay(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits})`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format digits for input masking — includes trailing separators to guide typing.
 * Used by PhoneMaskDirective.
 *
 * Examples:
 *   ''           → ''
 *   '512'        → '(512) '
 *   '512555'     → '(512) 555-'
 *   '5125551234' → '(512) 555-1234'
 */
export function formatPhoneInput(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}) `;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}-`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
