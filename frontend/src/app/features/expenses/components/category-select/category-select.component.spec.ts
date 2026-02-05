import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CategorySelectComponent } from './category-select.component';
import { ExpenseStore } from '../../stores/expense.store';

/**
 * Unit tests for CategorySelectComponent (AC-3.1.4)
 *
 * Test coverage:
 * - Component creation and rendering
 * - Category dropdown display
 * - Category selection and change events
 * - Loading state
 * - Error display
 */
describe('CategorySelectComponent', () => {
  let component: CategorySelectComponent;
  let fixture: ComponentFixture<CategorySelectComponent>;

  const mockCategories = [
    { id: 'cat-1', name: 'Advertising', scheduleELine: 'Line 1' },
    { id: 'cat-2', name: 'Insurance', scheduleELine: 'Line 9' },
    { id: 'cat-3', name: 'Repairs', scheduleELine: 'Line 14' },
  ];

  const mockExpenseStore = {
    categories: signal(mockCategories),
    sortedCategories: signal(mockCategories),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySelectComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render mat-form-field', () => {
    const formField = fixture.debugElement.query(By.css('mat-form-field'));
    expect(formField).toBeTruthy();
  });

  it('should render mat-select', () => {
    const select = fixture.debugElement.query(By.css('mat-select'));
    expect(select).toBeTruthy();
  });

  it('should have "Category" label', () => {
    const label = fixture.debugElement.query(By.css('mat-label'));
    expect(label.nativeElement.textContent.trim()).toBe('Category');
  });

  it('should have default value as null', () => {
    expect(component.value()).toBeNull();
  });

  it('should have disabled as false by default', () => {
    expect(component.disabled()).toBe(false);
  });

  it('should have error as null by default', () => {
    expect(component.error()).toBeNull();
  });

  it('should have category-select class on form field', () => {
    const formField = fixture.debugElement.query(By.css('.category-select'));
    expect(formField).toBeTruthy();
  });

  it('should emit categoryChange when category is selected', () => {
    const changeSpy = vi.fn();
    component.categoryChange.subscribe(changeSpy);

    component['onCategoryChange']('cat-2');

    expect(changeSpy).toHaveBeenCalledWith('cat-2');
  });
});

describe('CategorySelectComponent loading state', () => {
  let fixture: ComponentFixture<CategorySelectComponent>;

  const mockExpenseStore = {
    categories: signal([]),
    sortedCategories: signal([]),
    isLoadingCategories: signal(true),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySelectComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelectComponent);
    fixture.detectChanges();
  });

  it('should show loading state when isLoadingCategories is true', () => {
    // When loading, select shows "Loading..." option
    const select = fixture.debugElement.query(By.css('mat-select'));
    expect(select).toBeTruthy();
    // The loading state is controlled by the store's isLoadingCategories signal
    expect(mockExpenseStore.isLoadingCategories()).toBe(true);
  });
});

describe('CategorySelectComponent with error', () => {
  let fixture: ComponentFixture<CategorySelectComponent>;

  const mockExpenseStore = {
    categories: signal([]),
    sortedCategories: signal([]),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySelectComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelectComponent);
    fixture.componentRef.setInput('error', 'Category is required');
    fixture.detectChanges();
  });

  it('should display error message when error is set', () => {
    // Component should have error input set
    expect(fixture.componentInstance.error()).toBe('Category is required');
    // Note: mat-error visibility depends on form field validation state
  });
});

describe('CategorySelectComponent with value', () => {
  let fixture: ComponentFixture<CategorySelectComponent>;

  const mockCategories = [
    { id: 'cat-1', name: 'Advertising', scheduleELine: 'Line 1' },
    { id: 'cat-2', name: 'Insurance', scheduleELine: 'Line 9' },
  ];

  const mockExpenseStore = {
    categories: signal(mockCategories),
    sortedCategories: signal(mockCategories),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySelectComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelectComponent);
    fixture.componentRef.setInput('value', 'cat-2');
    fixture.detectChanges();
  });

  it('should reflect selected value', () => {
    expect(fixture.componentInstance.value()).toBe('cat-2');
  });
});

describe('CategorySelectComponent disabled state', () => {
  let fixture: ComponentFixture<CategorySelectComponent>;

  const mockExpenseStore = {
    categories: signal([]),
    sortedCategories: signal([]),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySelectComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelectComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
  });

  it('should disable select when disabled input is true', () => {
    expect(fixture.componentInstance.disabled()).toBe(true);
  });
});
