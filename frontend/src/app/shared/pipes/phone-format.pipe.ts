import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a digits-only phone string as (XXX) XXX-XXXX.
 * Passes through non-digit or already-formatted values unchanged.
 */
@Pipe({ name: 'phoneFormat', standalone: true })
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return value;
    if (digits.length <= 3) return `(${digits})`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
}
