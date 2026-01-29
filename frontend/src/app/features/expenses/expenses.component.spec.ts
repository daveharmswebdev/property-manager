import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ExpensesComponent } from './expenses.component';
import { ExpenseListStore } from './stores/expense-list.store';

/**
 * Unit tests for ExpensesComponent (AC-3.4.1, AC-3.4.7, AC-3.4.8)
 *
 * Test coverage:
 * - Component creation
 * - Page header display
 * - Loading state
 * - Error state
 * - Truly empty state (AC-3.4.7)
 * - Filtered empty state (AC-3.4.7)
 * - Expense list display
 * - Pagination (AC-3.4.8)
 * - Filter interactions
 */
describe('ExpensesComponent', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal([
      { id: 'exp-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Test expense', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
      { id: 'exp-2', date: '2026-01-16', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Another expense', categoryId: 'cat-2', categoryName: 'Insurance', amount: 200 },
    ]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(2),
    totalDisplay: signal('Showing 1-2 of 2 expenses'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setDateRangePreset: vi.fn(),
    setCustomDateRange: vi.fn(),
    setCategories: vi.fn(),
    setSearch: vi.fn(),
    removeFilterChip: vi.fn(),
    clearFilters: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render expenses container', () => {
    const container = fixture.debugElement.query(By.css('.expenses-container'));
    expect(container).toBeTruthy();
  });

  it('should display "Expenses" header', () => {
    const header = fixture.debugElement.query(By.css('.page-header h1'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent.trim()).toBe('Expenses');
  });

  it('should display subtitle', () => {
    const subtitle = fixture.debugElement.query(By.css('.page-header .subtitle'));
    expect(subtitle).toBeTruthy();
    expect(subtitle.nativeElement.textContent).toContain('View and filter all expenses');
  });

  it('should render expense filters component', () => {
    const filters = fixture.debugElement.query(By.css('app-expense-filters'));
    expect(filters).toBeTruthy();
  });

  it('should initialize store on init', () => {
    expect(mockExpenseListStore.initialize).toHaveBeenCalled();
  });

  it('should render expense list card', () => {
    const card = fixture.debugElement.query(By.css('.expense-list-card'));
    expect(card).toBeTruthy();
  });

  it('should render list header with columns', () => {
    const header = fixture.debugElement.query(By.css('.list-header'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent).toContain('Date');
    expect(header.nativeElement.textContent).toContain('Property');
    expect(header.nativeElement.textContent).toContain('Amount');
  });

  it('should render expense rows', () => {
    const rows = fixture.debugElement.queryAll(By.css('app-expense-list-row'));
    expect(rows.length).toBe(2);
  });

  it('should render pagination', () => {
    const paginator = fixture.debugElement.query(By.css('mat-paginator'));
    expect(paginator).toBeTruthy();
  });

  it('should display total display text', () => {
    const paginationInfo = fixture.debugElement.query(By.css('.pagination-info'));
    expect(paginationInfo).toBeTruthy();
    expect(paginationInfo.nativeElement.textContent).toContain('Showing 1-2 of 2');
  });

  it('should call setDateRangePreset when preset changes', () => {
    component.onDateRangePresetChange('this-month');
    expect(mockExpenseListStore.setDateRangePreset).toHaveBeenCalledWith('this-month');
  });

  it('should call setCustomDateRange when custom dates set', () => {
    component.onCustomDateRangeChange({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(mockExpenseListStore.setCustomDateRange).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });

  it('should call setCategories when categories change', () => {
    component.onCategoryChange(['cat-1', 'cat-2']);
    expect(mockExpenseListStore.setCategories).toHaveBeenCalledWith(['cat-1', 'cat-2']);
  });

  it('should call setSearch when search changes', () => {
    component.onSearchChange('test');
    expect(mockExpenseListStore.setSearch).toHaveBeenCalledWith('test');
  });

  it('should call clearFilters when clear all clicked', () => {
    component.onClearAllFilters();
    expect(mockExpenseListStore.clearFilters).toHaveBeenCalled();
  });
});

describe('ExpensesComponent loading state', () => {
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(true),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(false),
    expenses: signal([]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
  });

  it('should show loading spinner when loading', () => {
    const spinner = fixture.debugElement.query(By.css('.loading-container mat-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('should display loading text', () => {
    const loadingText = fixture.debugElement.query(By.css('.loading-container p'));
    expect(loadingText.nativeElement.textContent).toContain('Loading expenses');
  });
});

describe('ExpensesComponent error state', () => {
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>('Failed to load expenses'),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(false),
    expenses: signal([]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
  });

  it('should show error card when error exists', () => {
    const errorCard = fixture.debugElement.query(By.css('.error-card'));
    expect(errorCard).toBeTruthy();
  });

  it('should display error message', () => {
    const errorMsg = fixture.debugElement.query(By.css('.error-card p'));
    expect(errorMsg.nativeElement.textContent).toContain('Failed to load expenses');
  });

  it('should show retry button', () => {
    const retryBtn = fixture.debugElement.query(By.css('.error-card button'));
    expect(retryBtn).toBeTruthy();
    expect(retryBtn.nativeElement.textContent).toContain('Try Again');
  });
});

describe('ExpensesComponent truly empty state (AC-3.4.7)', () => {
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(true),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(false),
    expenses: signal([]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
  });

  it('should show empty state card when truly empty', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard).toBeTruthy();
  });

  it('should display "No expenses recorded yet" message', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard.nativeElement.textContent).toContain('No expenses recorded yet');
  });

  it('should display receipt icon', () => {
    const icon = fixture.debugElement.query(By.css('.empty-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('receipt_long');
  });
});

describe('ExpensesComponent filtered empty state (AC-3.4.7)', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(true),
    hasExpenses: signal(false),
    expenses: signal([]),
    categories: signal([]),
    dateRangePreset: signal('this-month'),
    selectedCategoryIds: signal(['cat-1']),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    clearFilters: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show filtered empty state card', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard).toBeTruthy();
  });

  it('should display "No expenses match your filters" message', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard.nativeElement.textContent).toContain('No expenses match your filters');
  });

  it('should display search_off icon', () => {
    const icon = fixture.debugElement.query(By.css('.empty-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('search_off');
  });

  it('should show clear filters button', () => {
    const clearBtn = fixture.debugElement.query(By.css('.empty-state-card button'));
    expect(clearBtn).toBeTruthy();
    expect(clearBtn.nativeElement.textContent).toContain('Clear filters');
  });

  it('should call clearFilters when button clicked', () => {
    const clearBtn = fixture.debugElement.query(By.css('.empty-state-card button'));
    clearBtn.nativeElement.click();
    expect(mockExpenseListStore.clearFilters).toHaveBeenCalled();
  });
});

describe('ExpensesComponent pagination (AC-3.4.8)', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal([{ id: 'exp-1', date: '2026-01-15', description: 'Test', amount: 100 }]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    totalCount: signal(50),
    totalDisplay: signal('Showing 1-25 of 50 expenses'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should call setPageSize when page size changes', () => {
    component.onPageChange({ pageIndex: 0, pageSize: 50, length: 50, previousPageIndex: 0 });
    expect(mockExpenseListStore.setPageSize).toHaveBeenCalledWith(50);
  });

  it('should call goToPage when page changes', () => {
    component.onPageChange({ pageIndex: 1, pageSize: 25, length: 50, previousPageIndex: 0 });
    expect(mockExpenseListStore.goToPage).toHaveBeenCalledWith(2); // 0-indexed to 1-indexed
  });
});
