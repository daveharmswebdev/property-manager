import { Pipe, PipeTransform } from '@angular/core';
import { extractDigits, formatPhoneDisplay } from '../utils/phone-format.utils';

/**
 * Formats a digits-only phone string as (XXX) XXX-XXXX.
 * Passes through non-digit or already-formatted values unchanged.
 */
@Pipe({ name: 'phoneFormat', standalone: true })
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const digits = extractDigits(value);
    if (digits.length === 0) return value;
    return formatPhoneDisplay(digits);
  }
}
