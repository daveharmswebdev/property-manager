import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PhoneMaskDirective } from './phone-mask.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PhoneMaskDirective],
  template: `<input appPhoneMask [formControl]="phoneControl" />`,
})
class TestHostComponent {
  phoneControl = new FormControl('');
}

describe('PhoneMaskDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let input: HTMLInputElement;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('should create the directive', () => {
    expect(input).toBeTruthy();
  });

  it('should format full 10-digit input as (XXX) XXX-XXXX', () => {
    simulateInput(input, '5125551234');
    fixture.detectChanges();

    expect(input.value).toBe('(512) 555-1234');
  });

  it('should store digits-only in the form control model value', () => {
    simulateInput(input, '5125551234');
    fixture.detectChanges();

    expect(component.phoneControl.value).toBe('5125551234');
  });

  it('should format partial input (3 digits)', () => {
    simulateInput(input, '512');
    fixture.detectChanges();

    expect(input.value).toBe('(512) ');
  });

  it('should format partial input (6 digits)', () => {
    simulateInput(input, '512555');
    fixture.detectChanges();

    expect(input.value).toBe('(512) 555-');
  });

  it('should limit to 10 digits', () => {
    simulateInput(input, '51255512345678');
    fixture.detectChanges();

    expect(input.value).toBe('(512) 555-1234');
    expect(component.phoneControl.value).toBe('5125551234');
  });

  it('should strip non-digit characters from input', () => {
    simulateInput(input, '(512) 555-1234');
    fixture.detectChanges();

    expect(input.value).toBe('(512) 555-1234');
    expect(component.phoneControl.value).toBe('5125551234');
  });

  it('should handle empty input', () => {
    simulateInput(input, '');
    fixture.detectChanges();

    expect(input.value).toBe('');
    expect(component.phoneControl.value).toBe('');
  });

  it('should handle writeValue from form control', () => {
    component.phoneControl.setValue('5125551234');
    fixture.detectChanges();

    expect(input.value).toBe('(512) 555-1234');
  });

  it('should handle paste with formatted value', () => {
    simulateInput(input, '(512) 555-1234');
    fixture.detectChanges();

    expect(component.phoneControl.value).toBe('5125551234');
    expect(input.value).toBe('(512) 555-1234');
  });

  it('should preserve cursor position after formatting', () => {
    // Simulate typing '512' then inserting at position after '5'
    simulateInput(input, '5125551234');
    fixture.detectChanges();

    // Cursor should be at end for full number
    expect(input.selectionStart).toBe('(512) 555-1234'.length);
  });

  it('should place cursor correctly for partial input', () => {
    // Type 3 digits — cursor should be after the 3rd digit in formatted output
    simulateInputWithCursor(input, '512', 3);
    fixture.detectChanges();

    // After '(512) ' the 3rd digit is at index 3, cursor goes to index 4
    // but since formatPhoneInput adds trailing ' ', cursor should be at position 4
    expect(input.selectionStart).toBe(4);
  });

  function simulateInput(inputEl: HTMLInputElement, value: string): void {
    inputEl.value = value;
    inputEl.dispatchEvent(new Event('input'));
  }

  function simulateInputWithCursor(inputEl: HTMLInputElement, value: string, cursorPos: number): void {
    inputEl.value = value;
    inputEl.setSelectionRange(cursorPos, cursorPos);
    inputEl.dispatchEvent(new Event('input'));
  }
});
