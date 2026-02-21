/**
 * ATDD RED Phase — Story 16.6, Task 4.2
 *
 * Component tests for ListTotalDisplayComponent.
 * Will NOT pass until the component is created (Task 4.1).
 *
 * Tests verify:
 * - Renders label text (AC2)
 * - Formats amount as currency using Angular currency pipe
 * - Shows border when showBorder is true
 * - No border by default
 * - Handles zero amount
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ListTotalDisplayComponent } from './list-total-display.component';

describe('ListTotalDisplayComponent', () => {
  let component: ListTotalDisplayComponent;
  let fixture: ComponentFixture<ListTotalDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListTotalDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ListTotalDisplayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    // GIVEN: required label input is set
    fixture.componentRef.setInput('label', 'Total');
    fixture.detectChanges();

    // THEN: component exists
    expect(component).toBeTruthy();
  });

  it('should render label text', () => {
    // GIVEN: label is "Total Expenses"
    fixture.componentRef.setInput('label', 'Total Expenses');
    fixture.detectChanges();

    // THEN: label appears in the DOM
    const label = fixture.nativeElement.querySelector('.total-label');
    expect(label.textContent).toContain('Total Expenses');
  });

  it('should format amount as currency', () => {
    // GIVEN: amount is 1234.56
    fixture.componentRef.setInput('label', 'Total');
    fixture.componentRef.setInput('amount', 1234.56);
    fixture.detectChanges();

    // THEN: amount is formatted as $1,234.56
    const amount = fixture.nativeElement.querySelector('.total-amount');
    expect(amount.textContent).toContain('$1,234.56');
  });

  it('should show border when showBorder is true', () => {
    // GIVEN: showBorder is true
    fixture.componentRef.setInput('label', 'Total');
    fixture.componentRef.setInput('showBorder', true);
    fixture.detectChanges();

    // THEN: with-border CSS class is applied
    const listTotal = fixture.nativeElement.querySelector('.list-total');
    expect(listTotal.classList.contains('with-border')).toBe(true);
  });

  it('should NOT show border by default', () => {
    // GIVEN: showBorder is not set (defaults to false)
    fixture.componentRef.setInput('label', 'Total');
    fixture.detectChanges();

    // THEN: with-border CSS class is NOT applied
    const listTotal = fixture.nativeElement.querySelector('.list-total');
    expect(listTotal.classList.contains('with-border')).toBe(false);
  });

  it('should handle zero amount', () => {
    // GIVEN: amount is 0
    fixture.componentRef.setInput('label', 'Total');
    fixture.componentRef.setInput('amount', 0);
    fixture.detectChanges();

    // THEN: displays $0.00
    const amount = fixture.nativeElement.querySelector('.total-amount');
    expect(amount.textContent).toContain('$0.00');
  });

  it('should handle large amounts with proper formatting', () => {
    // GIVEN: large amount
    fixture.componentRef.setInput('label', 'Total');
    fixture.componentRef.setInput('amount', 1234567.89);
    fixture.detectChanges();

    // THEN: formatted with commas
    const amount = fixture.nativeElement.querySelector('.total-amount');
    expect(amount.textContent).toContain('$1,234,567.89');
  });

  it('should display label with colon separator', () => {
    // GIVEN: label is "Total Income"
    fixture.componentRef.setInput('label', 'Total Income');
    fixture.detectChanges();

    // THEN: label shows "Total Income:"
    const label = fixture.nativeElement.querySelector('.total-label');
    expect(label.textContent).toContain('Total Income:');
  });
});
