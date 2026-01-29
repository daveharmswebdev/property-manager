import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { IncomeFormComponent } from './income-form.component';
import { IncomeStore } from '../../stores/income.store';

/**
 * Unit tests for IncomeFormComponent (AC-4.1.2, AC-4.1.3, AC-4.1.5)
 *
 * Test coverage:
 * - Component creation
 * - Form fields (amount, date, source, description)
 * - Validation
 * - Form submission
 * - Loading state
 */
describe('IncomeFormComponent', () => {
  let component: IncomeFormComponent;
  let fixture: ComponentFixture<IncomeFormComponent>;

  const mockIncomeStore = {
    isSaving: signal(false),
    createIncome: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: IncomeStore, useValue: mockIncomeStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have income-form-card wrapper', () => {
    const card = fixture.debugElement.query(By.css('.income-form-card'));
    expect(card).toBeTruthy();
  });

  it('should display "New Income" title', () => {
    const title = fixture.debugElement.query(By.css('mat-card-title'));
    expect(title.nativeElement.textContent.trim()).toBe('New Income');
  });

  it('should have amount field (AC-4.1.5)', () => {
    const amountField = fixture.debugElement.query(By.css('.amount-field'));
    expect(amountField).toBeTruthy();
  });

  it('should have date field (AC-4.1.2)', () => {
    const dateField = fixture.debugElement.query(By.css('.date-field'));
    expect(dateField).toBeTruthy();
  });

  it('should have source field (AC-4.1.2)', () => {
    const sourceField = fixture.debugElement.query(By.css('.source-field'));
    expect(sourceField).toBeTruthy();
  });

  it('should have description field (AC-4.1.2)', () => {
    const descField = fixture.debugElement.query(By.css('.description-field'));
    expect(descField).toBeTruthy();
  });

  it('should have submit button', () => {
    const submitBtn = fixture.debugElement.query(
      By.css('button[type="submit"]')
    );
    expect(submitBtn).toBeTruthy();
  });

  it('should have form with required fields', () => {
    expect(component['form'].get('amount')).toBeTruthy();
    expect(component['form'].get('date')).toBeTruthy();
    expect(component['form'].get('source')).toBeTruthy();
    expect(component['form'].get('description')).toBeTruthy();
  });

  it('should default date to today', () => {
    const today = new Date();
    const formDate = component['form'].get('date')?.value;
    expect(formDate.toDateString()).toBe(today.toDateString());
  });

  it('should have null amount by default', () => {
    expect(component['form'].get('amount')?.value).toBeNull();
  });

  it('should have empty source by default', () => {
    expect(component['form'].get('source')?.value).toBe('');
  });

  it('should have empty description by default', () => {
    expect(component['form'].get('description')?.value).toBe('');
  });
});

describe('IncomeFormComponent validation', () => {
  let component: IncomeFormComponent;
  let fixture: ComponentFixture<IncomeFormComponent>;

  const mockIncomeStore = {
    isSaving: signal(false),
    createIncome: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: IncomeStore, useValue: mockIncomeStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should require amount', () => {
    const amountControl = component['form'].get('amount');
    expect(amountControl?.hasError('required')).toBe(true);
  });

  it('should require amount greater than 0', () => {
    const amountControl = component['form'].get('amount');
    amountControl?.setValue(0);
    expect(amountControl?.hasError('min')).toBe(true);
  });

  it('should accept valid amount', () => {
    const amountControl = component['form'].get('amount');
    amountControl?.setValue(100);
    expect(amountControl?.valid).toBe(true);
  });

  it('should require date', () => {
    const dateControl = component['form'].get('date');
    dateControl?.setValue(null);
    expect(dateControl?.hasError('required')).toBe(true);
  });

  it('should limit source to 255 characters', () => {
    const sourceControl = component['form'].get('source');
    sourceControl?.setValue('a'.repeat(256));
    expect(sourceControl?.hasError('maxlength')).toBe(true);
  });

  it('should limit description to 500 characters', () => {
    const descControl = component['form'].get('description');
    descControl?.setValue('a'.repeat(501));
    expect(descControl?.hasError('maxlength')).toBe(true);
  });

  it('should be invalid when amount is missing', () => {
    expect(component['form'].valid).toBe(false);
  });

  it('should be valid when required fields are filled', () => {
    component['form'].patchValue({
      amount: 500,
      date: new Date(),
    });
    expect(component['form'].valid).toBe(true);
  });
});

describe('IncomeFormComponent submission (AC-4.1.3)', () => {
  let component: IncomeFormComponent;
  let fixture: ComponentFixture<IncomeFormComponent>;

  const mockIncomeStore = {
    isSaving: signal(false),
    createIncome: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IncomeFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: IncomeStore, useValue: mockIncomeStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should not submit when form is invalid', () => {
    component['onSubmit']();
    expect(mockIncomeStore.createIncome).not.toHaveBeenCalled();
  });

  it('should emit incomeCreated when form is submitted', () => {
    const emitSpy = vi.fn();
    component.incomeCreated.subscribe(emitSpy);

    component['form'].patchValue({
      amount: 1000,
      date: new Date('2026-01-15'),
      source: 'Test Source',
      description: 'Test Description',
    });

    component['onSubmit']();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should call createIncome on store when submitted', () => {
    component['form'].patchValue({
      amount: 1000,
      date: new Date('2026-01-15'),
    });

    component['onSubmit']();

    expect(mockIncomeStore.createIncome).toHaveBeenCalled();
    const callArg = mockIncomeStore.createIncome.mock.calls[0][0];
    expect(callArg.propertyId).toBe('prop-123');
    expect(callArg.amount).toBe(1000);
  });
});

describe('IncomeFormComponent saving state', () => {
  let fixture: ComponentFixture<IncomeFormComponent>;

  const mockIncomeStore = {
    isSaving: signal(true),
    createIncome: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: IncomeStore, useValue: mockIncomeStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeFormComponent);
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should disable submit button when saving', () => {
    const submitBtn = fixture.debugElement.query(
      By.css('button[type="submit"]')
    );
    expect(submitBtn.nativeElement.disabled).toBe(true);
  });

  it('should show spinner when saving', () => {
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeTruthy();
  });
});
