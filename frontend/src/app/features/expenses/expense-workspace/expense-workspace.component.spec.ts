import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseWorkspaceComponent } from './expense-workspace.component';
import { ExpenseStore } from '../stores/expense.store';
import { PropertyService } from '../../properties/services/property.service';

// Helper to create a complete ExpenseStore mock with all required signals
const createMockExpenseStore = (overrides = {}) => ({
  isLoading: signal(false),
  isEmpty: signal(false),
  isEditing: signal(false),
  isSaving: signal(false),
  isUpdating: signal(false),
  isLoadingCategories: signal(false),
  sortedCategories: signal([
    { id: 'cat-1', name: 'Repairs', scheduleELine: 'Line 14' },
    { id: 'cat-2', name: 'Insurance', scheduleELine: 'Line 9' },
  ]),
  categories: signal([]),
  expenses: signal([]),
  ytdTotal: signal(0),
  editingExpenseId: signal<string | null>(null),
  totalCount: signal(0),
  pageSize: signal(10),
  page: signal(1),
  loadExpensesByProperty: vi.fn(),
  loadCategories: vi.fn(),
  startEditing: vi.fn(),
  deleteExpense: vi.fn(),
  setPageSize: vi.fn(),
  goToPage: vi.fn(),
  createExpense: vi.fn(),
  ...overrides,
});

/**
 * Unit tests for ExpenseWorkspaceComponent (AC-3.1.1, AC-3.1.6, AC-3.1.7, AC-3.2, AC-3.3)
 *
 * Test coverage:
 * - Component creation
 * - Property loading and header display
 * - Loading and error states
 * - Expense form display
 * - Expense list display
 * - YTD total display
 * - Edit mode behavior (AC-3.2)
 * - Delete confirmation (AC-3.3)
 * - Pagination
 */
describe('ExpenseWorkspaceComponent', () => {
  let component: ExpenseWorkspaceComponent;
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;
  let router: Router;

  const mockProperty = {
    id: 'prop-123',
    name: 'Test Property',
    addressLine1: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockExpenses = [
    { id: 'exp-1', date: '2026-01-15', description: 'Repair expense', categoryId: 'cat-1', categoryName: 'Repairs', amount: 150 },
    { id: 'exp-2', date: '2026-01-20', description: 'Insurance premium', categoryId: 'cat-2', categoryName: 'Insurance', amount: 500 },
  ];

  const mockExpenseStore = createMockExpenseStore({
    expenses: signal(mockExpenses),
    ytdTotal: signal(650),
    totalCount: signal(2),
  });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of(mockProperty)),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(false) }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: 'properties/:id', component: ExpenseWorkspaceComponent },
          { path: 'dashboard', component: ExpenseWorkspaceComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'prop-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render expense-workspace container', () => {
    const container = fixture.debugElement.query(By.css('.expense-workspace'));
    expect(container).toBeTruthy();
  });

  it('should display property name in header', () => {
    const header = fixture.debugElement.query(By.css('.header-content h1'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent.trim()).toBe('Test Property');
  });

  it('should display header subtitle', () => {
    const subtitle = fixture.debugElement.query(By.css('.header-subtitle'));
    expect(subtitle).toBeTruthy();
    expect(subtitle.nativeElement.textContent).toContain('Add and manage expenses');
  });

  it('should have back button', () => {
    const backBtn = fixture.debugElement.query(By.css('.back-button'));
    expect(backBtn).toBeTruthy();
  });

  it('should navigate to property detail when back clicked', () => {
    component['goBack']();
    expect(router.navigate).toHaveBeenCalledWith(['/properties', 'prop-123']);
  });

  it('should load property on init', () => {
    expect(mockPropertyService.getPropertyById).toHaveBeenCalledWith('prop-123');
  });

  it('should load expenses after property loads', () => {
    expect(mockExpenseStore.loadExpensesByProperty).toHaveBeenCalledWith({
      propertyId: 'prop-123',
      propertyName: 'Test Property',
    });
  });

  it('should load categories', () => {
    expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
  });

  it('should render expense form', () => {
    const form = fixture.debugElement.query(By.css('app-expense-form'));
    expect(form).toBeTruthy();
  });

  it('should render expenses list card', () => {
    const card = fixture.debugElement.query(By.css('.expenses-list-card'));
    expect(card).toBeTruthy();
  });

  it('should display "Previous Expenses" title', () => {
    const title = fixture.debugElement.query(By.css('.expenses-list-card mat-card-title'));
    expect(title).toBeTruthy();
    expect(title.nativeElement.textContent.trim()).toBe('Previous Expenses');
  });

  it('should display YTD total', () => {
    const ytdAmount = fixture.debugElement.query(By.css('.ytd-amount'));
    expect(ytdAmount).toBeTruthy();
    expect(ytdAmount.nativeElement.textContent).toContain('$650.00');
  });

  it('should render expense rows', () => {
    const rows = fixture.debugElement.queryAll(By.css('app-expense-row'));
    expect(rows.length).toBe(2);
  });
});

describe('ExpenseWorkspaceComponent loading property state', () => {
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;

  const mockExpenseStore = createMockExpenseStore({ isEmpty: signal(true) });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'prop-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    // Don't call detectChanges yet to test loading state
  });

  it('should show loading state initially', () => {
    // Component starts with isLoadingProperty = true
    const component = fixture.componentInstance;
    expect(component['isLoadingProperty']()).toBe(true);
  });
});

describe('ExpenseWorkspaceComponent property error state', () => {
  let component: ExpenseWorkspaceComponent;
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;
  let router: Router;

  const mockExpenseStore = createMockExpenseStore({ isEmpty: signal(true) });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: 'dashboard', component: ExpenseWorkspaceComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'invalid-id',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should show error card when property not found', () => {
    const errorCard = fixture.debugElement.query(By.css('.error-card'));
    expect(errorCard).toBeTruthy();
  });

  it('should display "Property not found" error', () => {
    expect(component['propertyError']()).toBe('Property not found');
  });

  it('should show go back button in error state', () => {
    const backBtn = fixture.debugElement.query(By.css('.error-card button'));
    expect(backBtn).toBeTruthy();
    expect(backBtn.nativeElement.textContent).toContain('Go Back');
  });
});

describe('ExpenseWorkspaceComponent no property ID', () => {
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;

  const mockExpenseStore = createMockExpenseStore({ isEmpty: signal(true) });

  const mockPropertyService = {
    getPropertyById: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null, // No ID
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    fixture.detectChanges();
  });

  it('should set error when no property ID', () => {
    const component = fixture.componentInstance;
    expect(component['propertyError']()).toBe('Property ID is required');
  });

  it('should not call getPropertyById when no ID', () => {
    expect(mockPropertyService.getPropertyById).not.toHaveBeenCalled();
  });
});

describe('ExpenseWorkspaceComponent empty expenses state', () => {
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;

  const mockExpenseStore = createMockExpenseStore({ isEmpty: signal(true) });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'prop-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    fixture.detectChanges();
  });

  it('should show empty state when no expenses', () => {
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
  });

  it('should display empty state message', () => {
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState.nativeElement.textContent).toContain('No expenses yet');
  });

  it('should display hint about adding expenses', () => {
    const hint = fixture.debugElement.query(By.css('.empty-hint'));
    expect(hint).toBeTruthy();
    expect(hint.nativeElement.textContent).toContain('Use the form above');
  });
});

describe('ExpenseWorkspaceComponent edit mode (AC-3.2)', () => {
  let component: ExpenseWorkspaceComponent;
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;

  const mockExpenseStore = createMockExpenseStore({
    isEditing: signal(true),
    expenses: signal([{ id: 'exp-1', date: '2026-01-15', description: 'Test', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 }]),
    ytdTotal: signal(100),
    editingExpenseId: signal<string | null>('exp-1'),
    totalCount: signal(1),
  });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'prop-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should hide expense form when editing (AC-3.2.2)', () => {
    const form = fixture.debugElement.query(By.css('app-expense-form'));
    expect(form).toBeFalsy();
  });

  it('should call startEditing when edit requested', () => {
    component['onEditExpense']('exp-1');
    expect(mockExpenseStore.startEditing).toHaveBeenCalledWith('exp-1');
  });
});

describe('ExpenseWorkspaceComponent delete (AC-3.3)', () => {
  let component: ExpenseWorkspaceComponent;
  let fixture: ComponentFixture<ExpenseWorkspaceComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockExpenses = [
    { id: 'exp-1', date: '2026-01-15', description: 'Test expense', categoryId: 'cat-1', categoryName: 'Repairs', amount: 100 },
  ];

  const mockExpenseStore = createMockExpenseStore({
    expenses: signal(mockExpenses),
    ytdTotal: signal(100),
    totalCount: signal(1),
  });

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'prop-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should open confirm dialog when delete requested (AC-3.3.1)', () => {
    component['onDeleteExpense']('exp-1');
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should call deleteExpense when confirmed (AC-3.3.2)', () => {
    component['onDeleteExpense']('exp-1');
    expect(mockExpenseStore.deleteExpense).toHaveBeenCalledWith('exp-1');
  });
});
