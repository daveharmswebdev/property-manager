import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseFormComponent } from './expense-form.component';
import { ExpenseStore } from '../../stores/expense.store';
import { ExpenseService } from '../../services/expense.service';

/**
 * Unit tests for ExpenseFormComponent (AC-3.1.1, AC-3.1.2, AC-3.1.3, AC-3.1.4, AC-3.1.5, AC-3.1.8)
 *
 * Test coverage:
 * - Component creation
 * - Form fields (amount, date, category, description)
 * - Field validation
 * - Form submission
 * - Loading state
 * - Duplicate check behavior (AC-3.6)
 */

// Full ExpenseStore mock for tests that render CategorySelectComponent
const createMockExpenseStore = () => ({
  isSaving: signal(false),
  isLoadingCategories: signal(false),
  sortedCategories: signal([
    { id: 'cat-1', name: 'Repairs', scheduleELine: 'Line 14' },
    { id: 'cat-2', name: 'Insurance', scheduleELine: 'Line 9' },
  ]),
  categories: signal([]),
  createExpense: vi.fn(),
  loadCategories: vi.fn(),
});

describe('ExpenseFormComponent', () => {
  let component: ExpenseFormComponent;
  let fixture: ComponentFixture<ExpenseFormComponent>;

  const mockExpenseStore = createMockExpenseStore();

  const mockExpenseService = {
    checkDuplicateExpense: vi.fn().mockReturnValue(of({ isDuplicate: false })),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(false) }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have expense-form-card wrapper', () => {
    const card = fixture.debugElement.query(By.css('.expense-form-card'));
    expect(card).toBeTruthy();
  });

  it('should display "New Expense" title', () => {
    const title = fixture.debugElement.query(By.css('mat-card-title'));
    expect(title.nativeElement.textContent.trim()).toBe('New Expense');
  });

  it('should have amount field (AC-3.1.2)', () => {
    const amountField = fixture.debugElement.query(By.css('.amount-field'));
    expect(amountField).toBeTruthy();
  });

  it('should have date field (AC-3.1.3)', () => {
    const dateField = fixture.debugElement.query(By.css('.date-field'));
    expect(dateField).toBeTruthy();
  });

  it('should have category select component (AC-3.1.4)', () => {
    const categorySelect = fixture.debugElement.query(By.css('app-category-select'));
    expect(categorySelect).toBeTruthy();
  });

  it('should have description field (AC-3.1.5)', () => {
    const descField = fixture.debugElement.query(By.css('.description-field'));
    expect(descField).toBeTruthy();
  });

  it('should have submit button', () => {
    const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.nativeElement.textContent).toContain('Save Expense');
  });

  it('should have form with required controls', () => {
    expect(component['form'].get('amount')).toBeTruthy();
    expect(component['form'].get('date')).toBeTruthy();
    expect(component['form'].get('categoryId')).toBeTruthy();
    expect(component['form'].get('description')).toBeTruthy();
  });

  it('should default date to today (AC-3.1.3)', () => {
    const today = new Date();
    const formDate = component['form'].get('date')?.value;
    expect(formDate.toDateString()).toBe(today.toDateString());
  });

  it('should have null amount by default', () => {
    expect(component['form'].get('amount')?.value).toBeNull();
  });

  it('should have empty categoryId by default', () => {
    expect(component['form'].get('categoryId')?.value).toBe('');
  });

  it('should have empty description by default', () => {
    expect(component['form'].get('description')?.value).toBe('');
  });

  it('should load categories on init', () => {
    expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
  });
});

describe('ExpenseFormComponent validation', () => {
  let component: ExpenseFormComponent;
  let fixture: ComponentFixture<ExpenseFormComponent>;

  const mockExpenseStore = createMockExpenseStore();

  const mockExpenseService = {
    checkDuplicateExpense: vi.fn().mockReturnValue(of({ isDuplicate: false })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should require amount', () => {
    const amountControl = component['form'].get('amount');
    expect(amountControl?.hasError('required')).toBe(true);
  });

  it('should require amount greater than 0 (AC-3.1.2)', () => {
    const amountControl = component['form'].get('amount');
    amountControl?.setValue(0);
    expect(amountControl?.hasError('min')).toBe(true);
  });

  it('should accept valid amount', () => {
    const amountControl = component['form'].get('amount');
    amountControl?.setValue(100);
    expect(amountControl?.valid).toBe(true);
  });

  it('should enforce max amount', () => {
    const amountControl = component['form'].get('amount');
    amountControl?.setValue(10000000);
    expect(amountControl?.hasError('max')).toBe(true);
  });

  it('should require date', () => {
    const dateControl = component['form'].get('date');
    dateControl?.setValue(null);
    expect(dateControl?.hasError('required')).toBe(true);
  });

  it('should require category', () => {
    const categoryControl = component['form'].get('categoryId');
    expect(categoryControl?.hasError('required')).toBe(true);
  });

  it('should limit description to 500 characters (AC-3.1.5)', () => {
    const descControl = component['form'].get('description');
    descControl?.setValue('a'.repeat(501));
    expect(descControl?.hasError('maxlength')).toBe(true);
  });

  it('should be invalid when required fields missing', () => {
    expect(component['form'].valid).toBe(false);
  });

  it('should be valid when required fields filled', () => {
    component['form'].patchValue({
      amount: 100,
      date: new Date(),
      categoryId: 'cat-1',
    });
    expect(component['form'].valid).toBe(true);
  });
});

describe('ExpenseFormComponent submission (AC-3.1.6)', () => {
  let component: ExpenseFormComponent;
  let fixture: ComponentFixture<ExpenseFormComponent>;

  const mockExpenseStore = createMockExpenseStore();

  const mockExpenseService = {
    checkDuplicateExpense: vi.fn().mockReturnValue(of({ isDuplicate: false })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should not submit when form is invalid', () => {
    component['onSubmit']();
    expect(mockExpenseService.checkDuplicateExpense).not.toHaveBeenCalled();
  });

  it('should check for duplicates when form is valid (AC-3.6.1)', () => {
    component['form'].patchValue({
      amount: 100,
      date: new Date('2026-01-15'),
      categoryId: 'cat-1',
      description: 'Test expense',
    });

    component['onSubmit']();

    expect(mockExpenseService.checkDuplicateExpense).toHaveBeenCalled();
  });

  it('should call createExpense when no duplicate found', () => {
    component['form'].patchValue({
      amount: 100,
      date: new Date('2026-01-15'),
      categoryId: 'cat-1',
      description: 'Test expense',
    });

    component['onSubmit']();

    expect(mockExpenseStore.createExpense).toHaveBeenCalled();
    const callArg = mockExpenseStore.createExpense.mock.calls[0][0];
    expect(callArg.propertyId).toBe('prop-123');
    expect(callArg.amount).toBe(100);
    expect(callArg.categoryId).toBe('cat-1');
  });

  it('should emit expenseCreated when submitted', () => {
    const emitSpy = vi.fn();
    component.expenseCreated.subscribe(emitSpy);

    component['form'].patchValue({
      amount: 100,
      date: new Date('2026-01-15'),
      categoryId: 'cat-1',
    });

    component['onSubmit']();

    expect(emitSpy).toHaveBeenCalled();
  });
});

describe('ExpenseFormComponent duplicate check (AC-3.6)', () => {
  let component: ExpenseFormComponent;
  let fixture: ComponentFixture<ExpenseFormComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockExpenseStore = createMockExpenseStore();

  const mockExpenseService = {
    checkDuplicateExpense: vi.fn().mockReturnValue(of({
      isDuplicate: true,
      existingExpense: { id: 'exp-1', date: '2026-01-15', amount: 100 },
    })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should open dialog when duplicate found (AC-3.6.2)', () => {
    component['form'].patchValue({
      amount: 100,
      date: new Date('2026-01-15'),
      categoryId: 'cat-1',
    });

    component['onSubmit']();

    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should save expense when user confirms duplicate (AC-3.6.4)', () => {
    component['form'].patchValue({
      amount: 100,
      date: new Date('2026-01-15'),
      categoryId: 'cat-1',
    });

    component['onSubmit']();

    // Dialog returns true (save anyway)
    expect(mockExpenseStore.createExpense).toHaveBeenCalled();
  });
});

describe('ExpenseFormComponent saving state', () => {
  let fixture: ComponentFixture<ExpenseFormComponent>;

  const mockExpenseStore = {
    isSaving: signal(true),
    isLoadingCategories: signal(false),
    sortedCategories: signal([]),
    categories: signal([]),
    createExpense: vi.fn(),
    loadCategories: vi.fn(),
  };

  const mockExpenseService = {
    checkDuplicateExpense: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentRef.setInput('propertyId', 'prop-123');
    fixture.detectChanges();
  });

  it('should disable submit button when saving', () => {
    const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(submitBtn.nativeElement.disabled).toBe(true);
  });

  it('should show spinner when saving', () => {
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeTruthy();
  });
});
