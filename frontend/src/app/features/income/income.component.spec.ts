import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { IncomeComponent } from './income.component';
import { IncomeListStore } from './stores/income-list.store';
import { PropertyStore } from '../properties/stores/property.store';
import { YearSelectorService } from '../../core/services/year-selector.service';

/**
 * Unit tests for IncomeComponent (AC-4.3.1, AC-4.3.2, AC-4.3.3, AC-4.3.4, AC-4.3.5, AC-4.3.6)
 *
 * Test coverage:
 * - Component creation
 * - Page header display (AC-4.3.1)
 * - Filter controls (AC-4.3.3, AC-4.3.4)
 * - Loading state
 * - Error state
 * - Truly empty state (AC-4.3.5)
 * - Filtered empty state (AC-4.3.5)
 * - Income list display (AC-4.3.2)
 * - Total amount display (AC-4.3.6)
 */
describe('IncomeComponent', () => {
  let component: IncomeComponent;
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeEntries = [
    { id: 'inc-1', date: '2026-01-15', propertyId: 'prop-1', propertyName: 'Test Property', source: 'John Smith', description: 'Rent payment', amount: 1500 },
    { id: 'inc-2', date: '2026-01-20', propertyId: 'prop-1', propertyName: 'Test Property', source: 'Jane Doe', description: 'Pet deposit', amount: 500 },
  ];

  const mockIncomeListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasIncome: signal(true),
    incomeEntries: signal(mockIncomeEntries),
    selectedPropertyId: signal<string | null>(null),
    hasActiveFilters: signal(false),
    totalAmount: signal(2000),
    totalCount: signal(2),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    setDateRangePreset: vi.fn(),
    setCustomDateRange: vi.fn(),
    setPropertyFilter: vi.fn(),
    clearFilters: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([
      { id: 'prop-1', name: 'Test Property 1' },
      { id: 'prop-2', name: 'Test Property 2' },
    ]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render income container', () => {
    const container = fixture.debugElement.query(By.css('.income-container'));
    expect(container).toBeTruthy();
  });

  it('should display "Income" header (AC-4.3.1)', () => {
    const header = fixture.debugElement.query(By.css('.page-header h1'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent.trim()).toBe('Income');
  });

  it('should display subtitle', () => {
    const subtitle = fixture.debugElement.query(By.css('.page-header .subtitle'));
    expect(subtitle).toBeTruthy();
    expect(subtitle.nativeElement.textContent).toContain('View all income');
  });

  it('should render filters card', () => {
    const filters = fixture.debugElement.query(By.css('.filters-card'));
    expect(filters).toBeTruthy();
  });

  it('should render shared date range filter (AC-4.3.3)', () => {
    const dateRangeFilter = fixture.debugElement.query(By.css('app-date-range-filter'));
    expect(dateRangeFilter).toBeTruthy();
  });

  it('should render property filter dropdown (AC-4.3.4)', () => {
    const propertyField = fixture.debugElement.query(By.css('.property-field'));
    expect(propertyField).toBeTruthy();
  });

  it('should render shared list total display (AC-4.3.6)', () => {
    const totalDisplay = fixture.debugElement.query(By.css('app-list-total-display'));
    expect(totalDisplay).toBeTruthy();
  });

  it('should initialize store on init', () => {
    expect(mockIncomeListStore.initialize).toHaveBeenCalled();
  });

  it('should load properties on init (AC-4.3.4)', () => {
    expect(mockPropertyStore.loadProperties).toHaveBeenCalled();
  });

  it('should render income list card', () => {
    const card = fixture.debugElement.query(By.css('.income-list-card'));
    expect(card).toBeTruthy();
  });

  it('should render list header with columns (AC-4.3.2)', () => {
    const header = fixture.debugElement.query(By.css('.list-header'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent).toContain('Date');
    expect(header.nativeElement.textContent).toContain('Property');
    expect(header.nativeElement.textContent).toContain('Source');
    expect(header.nativeElement.textContent).toContain('Amount');
  });

  it('should render income rows', () => {
    const rows = fixture.debugElement.queryAll(By.css('.income-row'));
    expect(rows.length).toBe(2);
  });

  it('should call setDateRangePreset when preset changes (AC-4.3.3)', () => {
    component.onDateRangePresetChange('this-month');
    expect(mockIncomeListStore.setDateRangePreset).toHaveBeenCalledWith('this-month');
  });

  it('should call setCustomDateRange when custom dates applied (AC-4.3.3)', () => {
    component.onCustomDateRangeChange({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(mockIncomeListStore.setCustomDateRange).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });

  it('should call setPropertyFilter when property changes', () => {
    component.onPropertyChange('prop-1');
    expect(mockIncomeListStore.setPropertyFilter).toHaveBeenCalledWith('prop-1');
  });

  it('should call clearFilters when clear clicked', () => {
    component.onClearFilters();
    expect(mockIncomeListStore.clearFilters).toHaveBeenCalled();
  });

  it('should reset store on destroy', () => {
    component.ngOnDestroy();
    expect(mockIncomeListStore.reset).toHaveBeenCalled();
  });
});

describe('IncomeComponent loading state', () => {
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeListStore = {
    isLoading: signal(true),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasIncome: signal(false),
    incomeEntries: signal([]),
    selectedPropertyId: signal<string | null>(null),
    hasActiveFilters: signal(false),
    totalAmount: signal(0),
    totalCount: signal(0),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    fixture.detectChanges();
  });

  it('should show loading spinner when loading', () => {
    const spinner = fixture.debugElement.query(By.css('.loading-container mat-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('should display loading text', () => {
    const loadingText = fixture.debugElement.query(By.css('.loading-container p'));
    expect(loadingText.nativeElement.textContent).toContain('Loading income');
  });
});

describe('IncomeComponent error state', () => {
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeListStore = {
    isLoading: signal(false),
    error: signal<string | null>('Failed to load income'),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasIncome: signal(false),
    incomeEntries: signal([]),
    selectedPropertyId: signal<string | null>(null),
    hasActiveFilters: signal(false),
    totalAmount: signal(0),
    totalCount: signal(0),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    fixture.detectChanges();
  });

  it('should show error card when error exists', () => {
    const errorCard = fixture.debugElement.query(By.css('.error-card'));
    expect(errorCard).toBeTruthy();
  });

  it('should display error message', () => {
    const errorMsg = fixture.debugElement.query(By.css('.error-card p'));
    expect(errorMsg.nativeElement.textContent).toContain('Failed to load income');
  });

  it('should show retry button', () => {
    const retryBtn = fixture.debugElement.query(By.css('.error-card button'));
    expect(retryBtn).toBeTruthy();
    expect(retryBtn.nativeElement.textContent).toContain('Try Again');
  });
});

describe('IncomeComponent truly empty state (AC-4.3.5)', () => {
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(true),
    isFilteredEmpty: signal(false),
    hasIncome: signal(false),
    incomeEntries: signal([]),
    selectedPropertyId: signal<string | null>(null),
    hasActiveFilters: signal(false),
    totalAmount: signal(0),
    totalCount: signal(0),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    fixture.detectChanges();
  });

  it('should show empty state card when truly empty', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard).toBeTruthy();
  });

  it('should display "No income recorded yet" message', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard.nativeElement.textContent).toContain('No income recorded yet');
  });

  it('should display payments icon', () => {
    const icon = fixture.debugElement.query(By.css('.empty-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('payments');
  });
});

describe('IncomeComponent filtered empty state (AC-4.3.5)', () => {
  let component: IncomeComponent;
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(true),
    hasIncome: signal(false),
    incomeEntries: signal([]),
    selectedPropertyId: signal<string | null>('prop-1'),
    hasActiveFilters: signal(true),
    totalAmount: signal(0),
    totalCount: signal(0),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    clearFilters: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show filtered empty state card', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard).toBeTruthy();
  });

  it('should display "No income recorded for this period" message', () => {
    const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(emptyCard.nativeElement.textContent).toContain('No income recorded for this period');
  });

  it('should display search_off icon', () => {
    const icon = fixture.debugElement.query(By.css('.empty-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('search_off');
  });

  it('should show clear filters button', () => {
    const clearBtn = fixture.debugElement.query(By.css('.empty-state-card button'));
    expect(clearBtn).toBeTruthy();
    expect(clearBtn.nativeElement.textContent).toContain('Clear Filters');
  });

  it('should call clearFilters when button clicked', () => {
    const clearBtn = fixture.debugElement.query(By.css('.empty-state-card button'));
    clearBtn.nativeElement.click();
    expect(mockIncomeListStore.clearFilters).toHaveBeenCalled();
  });
});

describe('IncomeComponent property filter (AC-4.3.4)', () => {
  let component: IncomeComponent;
  let fixture: ComponentFixture<IncomeComponent>;

  const mockIncomeListStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isTrulyEmpty: signal(false),
    isFilteredEmpty: signal(false),
    hasIncome: signal(true),
    incomeEntries: signal([{ id: 'inc-1', amount: 1000 }]),
    selectedPropertyId: signal<string | null>(null),
    hasActiveFilters: signal(false),
    totalAmount: signal(1000),
    totalCount: signal(1),
    dateRangePreset: signal('all'),
    dateFrom: signal<string | null>(null),
    dateTo: signal<string | null>(null),
    initialize: vi.fn(),
    setPropertyFilter: vi.fn(),
    setYear: vi.fn(),
    reset: vi.fn(),
  };

  const mockPropertyStore = {
    properties: signal([
      { id: 'prop-1', name: 'Property One' },
      { id: 'prop-2', name: 'Property Two' },
    ]),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IncomeComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeListStore, useValue: mockIncomeListStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should set propertyId to null when "all" is selected', () => {
    component.onPropertyChange('all');
    expect(mockIncomeListStore.setPropertyFilter).toHaveBeenCalledWith(null);
  });

  it('should set propertyId when property is selected', () => {
    component.onPropertyChange('prop-1');
    expect(mockIncomeListStore.setPropertyFilter).toHaveBeenCalledWith('prop-1');
  });
});
