import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { By } from '@angular/platform-browser';
import { IncomeRowComponent } from './income-row.component';
import { IncomeDto } from '../../services/income.service';

/**
 * Unit tests for IncomeRowComponent (AC-4.1.6, AC-4.2)
 *
 * Test coverage:
 * - Component creation and display
 * - Date formatting (AC-4.1.6)
 * - Edit functionality (AC-4.2.1, AC-4.2.2)
 * - Delete confirmation (AC-4.2.5, AC-4.2.6)
 * - Cancel actions (AC-4.2.7)
 */
describe('IncomeRowComponent', () => {
  let component: IncomeRowComponent;
  let fixture: ComponentFixture<IncomeRowComponent>;

  const mockIncome: IncomeDto = {
    id: 'income-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    amount: 1500.00,
    date: '2026-01-15',
    source: 'John Smith',
    description: 'January rent payment',
    createdAt: '2026-01-15T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('income', mockIncome);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display income date formatted (AC-4.1.6)', () => {
    const dateEl = fixture.debugElement.query(By.css('.income-date'));
    expect(dateEl).toBeTruthy();
    // Date displays in local timezone, so just verify it's a formatted date string
    const dateText = dateEl.nativeElement.textContent.trim();
    expect(dateText).toMatch(/Jan\s+\d{1,2},?\s+2026/);
  });

  it('should display income amount as currency', () => {
    const amountEl = fixture.debugElement.query(By.css('.income-amount'));
    expect(amountEl).toBeTruthy();
    expect(amountEl.nativeElement.textContent).toContain('$1,500.00');
  });

  it('should display source when present', () => {
    const sourceEl = fixture.debugElement.query(By.css('.income-source'));
    expect(sourceEl).toBeTruthy();
    expect(sourceEl.nativeElement.textContent.trim()).toBe('John Smith');
  });

  it('should display description when present', () => {
    const descEl = fixture.debugElement.query(By.css('.income-description'));
    expect(descEl).toBeTruthy();
    expect(descEl.nativeElement.textContent.trim()).toBe('January rent payment');
  });

  it('should display edit button (AC-4.2.1)', () => {
    const editBtn = fixture.debugElement.query(By.css('.edit-button'));
    expect(editBtn).toBeTruthy();
  });

  it('should display delete button (AC-4.2.1)', () => {
    const deleteBtn = fixture.debugElement.query(By.css('.delete-button'));
    expect(deleteBtn).toBeTruthy();
  });

  it('should emit edit event when edit button is clicked (AC-4.2.1)', () => {
    const editSpy = vi.fn();
    component.edit.subscribe(editSpy);

    const editBtn = fixture.debugElement.query(By.css('.edit-button'));
    editBtn.nativeElement.click();

    expect(editSpy).toHaveBeenCalledWith('income-123');
  });

  it('should show delete confirmation when delete button is clicked (AC-4.2.5)', () => {
    const deleteBtn = fixture.debugElement.query(By.css('.delete-button'));
    deleteBtn.nativeElement.click();
    fixture.detectChanges();

    expect(component.isConfirmingDelete()).toBe(true);
  });

  it('should not be in editing state by default', () => {
    expect(component.isEditing()).toBe(false);
  });

  it('should not be in confirming delete state by default', () => {
    expect(component.isConfirmingDelete()).toBe(false);
  });
});

describe('IncomeRowComponent without source and description', () => {
  let fixture: ComponentFixture<IncomeRowComponent>;

  const mockIncomeNoDetails: IncomeDto = {
    id: 'income-124',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    amount: 2000.00,
    date: '2026-02-01',
    createdAt: '2026-02-01T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeRowComponent);
    fixture.componentRef.setInput('income', mockIncomeNoDetails);
    fixture.detectChanges();
  });

  it('should display em-dash when no source or description', () => {
    const noDetailsEl = fixture.debugElement.query(By.css('.income-no-details'));
    expect(noDetailsEl).toBeTruthy();
    expect(noDetailsEl.nativeElement.textContent.trim()).toBe('—');
  });
});

describe('IncomeRowComponent in editing state (AC-4.2.2)', () => {
  let component: IncomeRowComponent;
  let fixture: ComponentFixture<IncomeRowComponent>;

  const mockIncome: IncomeDto = {
    id: 'income-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    amount: 1500.00,
    date: '2026-01-15',
    source: 'John Smith',
    description: 'January rent',
    createdAt: '2026-01-15T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeRowComponent],
      providers: [provideNoopAnimations(), provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('income', mockIncome);
    fixture.componentRef.setInput('isEditing', true);
    fixture.detectChanges();
  });

  it('should display edit form when isEditing is true', () => {
    const editForm = fixture.debugElement.query(By.css('.edit-form'));
    expect(editForm).toBeTruthy();
  });

  it('should not display normal row content when editing', () => {
    const incomeDate = fixture.debugElement.query(By.css('.income-date'));
    expect(incomeDate).toBeFalsy();
  });

  it('should have cancel button in edit mode', () => {
    const cancelBtn = fixture.debugElement.query(By.css('.cancel-button'));
    expect(cancelBtn).toBeTruthy();
  });

  it('should emit cancelEdit when cancel button is clicked (AC-4.2.7)', () => {
    const cancelSpy = vi.fn();
    component.cancelEdit.subscribe(cancelSpy);

    const cancelBtn = fixture.debugElement.query(By.css('.cancel-button'));
    cancelBtn.nativeElement.click();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('should emit save event when form is submitted (AC-4.2.3)', () => {
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    // Set form values
    component.editForm.patchValue({
      amount: 1600,
      date: new Date('2026-01-20'),
      source: 'Jane Doe',
      description: 'Updated payment',
    });

    component['onSaveEdit']();

    expect(saveSpy).toHaveBeenCalled();
    const emittedValue = saveSpy.mock.calls[0][0];
    expect(emittedValue.incomeId).toBe('income-123');
    expect(emittedValue.request.amount).toBe(1600);
  });
});

describe('IncomeRowComponent delete confirmation (AC-4.2.5)', () => {
  let component: IncomeRowComponent;
  let fixture: ComponentFixture<IncomeRowComponent>;

  const mockIncome: IncomeDto = {
    id: 'income-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    amount: 1500.00,
    date: '2026-01-15',
    createdAt: '2026-01-15T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('income', mockIncome);
    fixture.detectChanges();

    // Enter confirming state
    component['onDeleteClick']();
    fixture.detectChanges();
  });

  it('should show confirming delete state', () => {
    expect(component.isConfirmingDelete()).toBe(true);
  });

  it('should display confirmation message', () => {
    const confirmMsg = fixture.debugElement.query(By.css('.confirm-message'));
    expect(confirmMsg).toBeTruthy();
    expect(confirmMsg.nativeElement.textContent).toContain('Delete this income entry?');
  });

  it('should have cancel button', () => {
    const cancelBtn = fixture.debugElement.query(By.css('.cancel-button'));
    expect(cancelBtn).toBeTruthy();
  });

  it('should emit delete event when confirmed (AC-4.2.6)', () => {
    const deleteSpy = vi.fn();
    component.delete.subscribe(deleteSpy);

    component['onConfirmDelete']();

    expect(deleteSpy).toHaveBeenCalledWith('income-123');
  });

  it('should hide confirmation when cancelled (AC-4.2.7)', () => {
    component['onCancelDelete']();
    fixture.detectChanges();

    expect(component.isConfirmingDelete()).toBe(false);
  });
});
