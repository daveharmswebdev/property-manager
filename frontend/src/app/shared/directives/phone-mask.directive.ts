import { Directive, ElementRef, forwardRef, HostListener, inject, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { extractDigits, formatPhoneInput } from '../utils/phone-format.utils';

/**
 * PhoneMaskDirective
 *
 * Formats phone input as (XXX) XXX-XXXX for display while storing digits-only
 * for the form model value. Max 10 digits (US phone format).
 *
 * Usage:
 * <input matInput appPhoneMask formControlName="number" />
 */
@Directive({
  selector: 'input[appPhoneMask]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneMaskDirective),
      multi: true,
    },
  ],
})
export class PhoneMaskDirective implements ControlValueAccessor {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart ?? 0;
    const raw = input.value;

    // Count digits before cursor in the old value
    const digitsBefore = raw.slice(0, cursorPos).replace(/\D/g, '').length;

    const digits = extractDigits(raw);
    const formatted = formatPhoneInput(digits);

    this.setDisplayValue(formatted);
    this.onChange(digits);

    // Restore cursor: find position after the same number of digits in formatted string
    const newCursorPos = this.findCursorPosition(formatted, digitsBefore);
    input.setSelectionRange(newCursorPos, newCursorPos);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    if (!value) {
      this.setDisplayValue('');
      return;
    }
    const digits = extractDigits(value);
    this.setDisplayValue(formatPhoneInput(digits));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }

  /**
   * Find the cursor position in the formatted string that corresponds
   * to being after `digitCount` digits.
   */
  private findCursorPosition(formatted: string, digitCount: number): number {
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        seen++;
        if (seen === digitCount) {
          return i + 1;
        }
      }
    }
    // If digitCount is 0 or we ran out, place at end
    return formatted.length;
  }

  private setDisplayValue(value: string): void {
    this.renderer.setProperty(this.el.nativeElement, 'value', value);
  }
}
