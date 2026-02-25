import { Directive, ElementRef, forwardRef, HostListener, inject, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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
    const raw = (event.target as HTMLInputElement).value;
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    const formatted = this.formatPhone(digits);

    this.setDisplayValue(formatted);
    this.onChange(digits);
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
    const digits = value.replace(/\D/g, '').slice(0, 10);
    this.setDisplayValue(this.formatPhone(digits));
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

  private formatPhone(digits: string): string {
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}) `;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}-`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  private setDisplayValue(value: string): void {
    this.renderer.setProperty(this.el.nativeElement, 'value', value);
  }
}
