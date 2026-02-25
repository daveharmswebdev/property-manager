import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpensesComponent } from './expenses.component';
import { ExpenseListStore } from './stores/expense-list.store';
import { PropertyStore } from '../properties/stores/property.store';
import { CreateWoFromExpenseDialogComponent } from '../work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component';
import { PropertyPickerDialogComponent } from './components/property-picker-dialog/property-picker-dialog.component';
import { PropertyService } from '../properties/services/property.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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
const defaultMockPropertyStore = {
  properties: signal<{ id: string; name: string }[]>([]),
  loadProperties: vi.fn(),
};

const defaultMockPropertyService = {
  getProperties: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
};

const defaultMockRouter = {
  navigate: vi.fn(),
};

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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(2),
    totalAmount: signal(300),
    totalDisplay: signal('Showing 1-2 of 2 expenses'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    setPropertyFilter: vi.fn(),
    setDateRangePreset: vi.fn(),
    setCustomDateRange: vi.fn(),
    setCategories: vi.fn(),
    setSearch: vi.fn(),
    removeFilterChip: vi.fn(),
    clearFilters: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(0),
    totalAmount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(0),
    totalAmount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(0),
    totalAmount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal(['cat-1']),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(0),
    totalAmount: signal(0),
    totalDisplay: signal(''),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    clearFilters: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(50),
    totalAmount: signal(5000),
    totalDisplay: signal('Showing 1-25 of 50 expenses'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
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

describe('ExpensesComponent create work order from expense (AC-11.6.7)', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockExpenses = [
    { id: 'exp-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Faucet repair', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
    { id: 'exp-2', date: '2026-01-16', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Insurance', categoryId: 'cat-2', categoryName: 'Insurance', amount: 200, workOrderId: 'wo-existing' },
  ];

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal(mockExpenses),
    categories: signal([]),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(2),
    totalAmount: signal(300),
    totalDisplay: signal('Showing 1-2 of 2 expenses'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    setPropertyFilter: vi.fn(),
    setDateRangePreset: vi.fn(),
    setCustomDateRange: vi.fn(),
    setCategories: vi.fn(),
    setSearch: vi.fn(),
    removeFilterChip: vi.fn(),
    clearFilters: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of({ workOrderId: 'new-wo-1', expenseId: 'exp-1' }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should open dialog with correct data when onCreateWorkOrder called', () => {
    component['onCreateWorkOrder'](mockExpenses[0] as any);

    expect(mockDialog.open).toHaveBeenCalledWith(
      CreateWoFromExpenseDialogComponent,
      expect.objectContaining({
        width: '500px',
        data: expect.objectContaining({
          expenseId: 'exp-1',
          propertyId: 'prop-1',
          propertyName: 'Test Property',
          description: 'Faucet repair',
          categoryId: 'cat-1',
        }),
      })
    );
  });

  it('should reinitialize store after dialog closes with result', () => {
    vi.clearAllMocks();
    component['onCreateWorkOrder'](mockExpenses[0] as any);

    expect(mockExpenseListStore.initialize).toHaveBeenCalled();
  });

  it('should not reinitialize store when dialog closes without result (cancel)', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    vi.clearAllMocks();

    component['onCreateWorkOrder'](mockExpenses[0] as any);

    expect(mockExpenseListStore.initialize).not.toHaveBeenCalled();
  });
});

describe('ExpensesComponent Add Expense button (AC1 Story 15.3)', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockPropertyStore: { properties: ReturnType<typeof signal>; loadProperties: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockPropertyService: { getProperties: ReturnType<typeof vi.fn> };

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal([
      { id: 'exp-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Test', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
    ]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(1),
    totalAmount: signal(100),
    totalDisplay: signal('Showing 1 of 1 expense'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    setPropertyFilter: vi.fn(),
    setDateRangePreset: vi.fn(),
    setCustomDateRange: vi.fn(),
    setCategories: vi.fn(),
    setSearch: vi.fn(),
    removeFilterChip: vi.fn(),
    clearFilters: vi.fn(),
    setPageSize: vi.fn(),
    goToPage: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRouter = { navigate: vi.fn() };
    mockPropertyStore = {
      properties: signal([{ id: 'prop-1', name: 'Test Property' }]),
      loadProperties: vi.fn(),
    };
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of('prop-2'),
      }),
    };
    mockSnackBar = { open: vi.fn() };
    mockPropertyService = {
      getProperties: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
    };

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render "Add Expense" button in page header', () => {
    const button = fixture.debugElement.query(By.css('.page-header button'));
    expect(button).toBeTruthy();
    expect(button.nativeElement.textContent).toContain('Add Expense');
  });

  it('should navigate directly when single property', () => {
    component.onAddExpense();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/properties', 'prop-1', 'expenses']);
  });

  it('should open dialog when multiple properties', () => {
    mockPropertyStore.properties = signal([
      { id: 'prop-1', name: 'Property A' },
      { id: 'prop-2', name: 'Property B' },
    ]);

    component.onAddExpense();
    expect(mockDialog.open).toHaveBeenCalledWith(
      PropertyPickerDialogComponent,
      expect.objectContaining({
        width: '400px',
        data: expect.objectContaining({
          properties: [
            { id: 'prop-1', name: 'Property A' },
            { id: 'prop-2', name: 'Property B' },
          ],
        }),
      })
    );
  });

  it('should navigate after selecting property from dialog', () => {
    mockPropertyStore.properties = signal([
      { id: 'prop-1', name: 'Property A' },
      { id: 'prop-2', name: 'Property B' },
    ]);

    component.onAddExpense();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/properties', 'prop-2', 'expenses']);
  });

  it('should show snackbar when zero properties after fetch', async () => {
    mockPropertyStore.properties = signal([]);
    mockPropertyService.getProperties.mockReturnValue(of({ items: [], totalCount: 0 }));

    await component.onAddExpense();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Create a property first before adding expenses.',
      'Dismiss',
      { duration: 5000 }
    );
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should show snackbar on fetch error', async () => {
    mockPropertyStore.properties = signal([]);
    mockPropertyService.getProperties.mockReturnValue(throwError(() => new Error('Network')));

    await component.onAddExpense();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to load properties. Please try again.',
      'Dismiss',
      { duration: 5000 }
    );
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});

describe('ExpensesComponent sort headers (AC3 Story 15.3)', () => {
  let fixture: ComponentFixture<ExpensesComponent>;

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal([
      { id: 'exp-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Test', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
    ]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(1),
    totalAmount: signal(100),
    totalDisplay: signal('Showing 1 of 1 expense'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
  });

  it('should render sort header buttons for sortable columns', () => {
    const sortHeaders = fixture.debugElement.queryAll(By.css('.list-header .sort-header'));
    expect(sortHeaders.length).toBe(5); // date, property, description, category, amount
  });

  it('should call store.setSort("date") when Date header clicked', () => {
    const dateHeader = fixture.debugElement.query(By.css('.header-date'));
    dateHeader.nativeElement.click();
    expect(mockExpenseListStore.setSort).toHaveBeenCalledWith('date');
  });

  it('should call store.setSort("amount") when Amount header clicked', () => {
    const amountHeader = fixture.debugElement.query(By.css('.header-amount'));
    amountHeader.nativeElement.click();
    expect(mockExpenseListStore.setSort).toHaveBeenCalledWith('amount');
  });
});

describe('ExpensesComponent delete expense (AC-D3)', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockExpenseListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasExpenses: signal(true),
    expenses: signal([
      { id: 'exp-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', description: 'Test expense', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
    ]),
    categories: signal([]),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    selectedCategoryIds: signal([]),
    searchText: signal(''),
    filterChips: signal([]),
    properties: signal([]),
    selectedPropertyId: signal<string | null>(null),
    totalCount: signal(1),
    totalAmount: signal(100),
    totalDisplay: signal('Showing 1 of 1 expense'),
    pageSize: signal(25),
    page: signal(1),
    initialize: vi.fn(),
    setProperties: vi.fn(),
    deleteExpense: vi.fn(),
    sortBy: signal<string | null>(null),
    sortDirection: signal<'asc' | 'desc'>('desc'),
    setSort: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseListStore, useValue: mockExpenseListStore },
        { provide: PropertyStore, useValue: defaultMockPropertyStore },
        { provide: PropertyService, useValue: defaultMockPropertyService },
        { provide: Router, useValue: defaultMockRouter },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should open confirm dialog with correct data when onDeleteExpense called', () => {
    component['onDeleteExpense']('exp-1');

    expect(mockDialog.open).toHaveBeenCalledWith(
      ConfirmDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Delete Expense',
          message: 'Are you sure you want to delete this expense?',
          confirmText: 'Delete',
          icon: 'delete',
          iconColor: 'warn',
        }),
      })
    );
  });

  it('should call store.deleteExpense when user confirms', () => {
    component['onDeleteExpense']('exp-1');

    expect(mockExpenseListStore.deleteExpense).toHaveBeenCalledWith('exp-1');
  });

  it('should NOT call store.deleteExpense when user cancels', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(false),
    });

    component['onDeleteExpense']('exp-1');

    expect(mockExpenseListStore.deleteExpense).not.toHaveBeenCalled();
  });
});
