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
import { IncomeWorkspaceComponent } from './income-workspace.component';
import { IncomeStore } from '../stores/income.store';
import { PropertyService } from '../../properties/services/property.service';

/**
 * Unit tests for IncomeWorkspaceComponent (AC-4.1.1, AC-4.1.2, AC-4.1.4, AC-4.2.3, AC-4.2.6)
 *
 * Test coverage:
 * - Component creation
 * - Property loading and header display
 * - Loading and error states
 * - Income form display
 * - Income list display
 * - YTD total display
 * - Edit/delete functionality
 */
describe('IncomeWorkspaceComponent', () => {
  let component: IncomeWorkspaceComponent;
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;
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

  const mockIncomeEntries = [
    { id: 'inc-1', date: '2026-01-15', propertyId: 'prop-123', propertyName: 'Test Property', source: 'John Smith', description: 'Rent', amount: 1500 },
    { id: 'inc-2', date: '2026-01-20', propertyId: 'prop-123', propertyName: 'Test Property', source: 'Jane Doe', description: 'Deposit', amount: 500 },
  ];

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(false),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal(mockIncomeEntries),
    ytdTotal: signal(2000),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    setEditingIncome: vi.fn(),
    cancelEditing: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of(mockProperty)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: 'properties/:id', component: IncomeWorkspaceComponent },
          { path: 'dashboard', component: IncomeWorkspaceComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render income-workspace container', () => {
    const container = fixture.debugElement.query(By.css('.income-workspace'));
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
    expect(subtitle.nativeElement.textContent).toContain('Add and manage income');
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

  it('should load income after property loads', () => {
    expect(mockIncomeStore.loadIncomeByProperty).toHaveBeenCalledWith({
      propertyId: 'prop-123',
      propertyName: 'Test Property',
    });
  });

  it('should render income form', () => {
    const form = fixture.debugElement.query(By.css('app-income-form'));
    expect(form).toBeTruthy();
  });

  it('should render income list card', () => {
    const card = fixture.debugElement.query(By.css('.income-list-card'));
    expect(card).toBeTruthy();
  });

  it('should display "Previous Income" title', () => {
    const title = fixture.debugElement.query(By.css('.income-list-card mat-card-title'));
    expect(title).toBeTruthy();
    expect(title.nativeElement.textContent.trim()).toBe('Previous Income');
  });

  it('should display YTD total', () => {
    const ytdAmount = fixture.debugElement.query(By.css('.ytd-amount'));
    expect(ytdAmount).toBeTruthy();
    expect(ytdAmount.nativeElement.textContent).toContain('$2,000.00');
  });

  it('should render income rows', () => {
    const rows = fixture.debugElement.queryAll(By.css('app-income-row'));
    expect(rows.length).toBe(2);
  });

  it('should call setEditingIncome when edit requested (AC-4.2.1)', () => {
    component['onEditIncome']('inc-1');
    expect(mockIncomeStore.setEditingIncome).toHaveBeenCalledWith('inc-1');
  });

  it('should call cancelEditing when edit cancelled (AC-4.2.7)', () => {
    component['onCancelEdit']();
    expect(mockIncomeStore.cancelEditing).toHaveBeenCalled();
  });

  it('should call updateIncome when edit saved (AC-4.2.3)', () => {
    const event = { incomeId: 'inc-1', request: { amount: 1600, date: '2026-01-15' } };
    component['onSaveIncome'](event);
    expect(mockIncomeStore.updateIncome).toHaveBeenCalledWith(event);
  });

  it('should call deleteIncome when delete confirmed (AC-4.2.6)', () => {
    component['onDeleteIncome']('inc-1');
    expect(mockIncomeStore.deleteIncome).toHaveBeenCalledWith('inc-1');
  });
});

describe('IncomeWorkspaceComponent loading property state', () => {
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal([]),
    ytdTotal: signal(0),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
    // Don't call detectChanges to test initial loading state
  });

  it('should show loading state initially', () => {
    const component = fixture.componentInstance;
    expect(component['isLoadingProperty']()).toBe(true);
  });
});

describe('IncomeWorkspaceComponent property error state', () => {
  let component: IncomeWorkspaceComponent;
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;
  let router: Router;

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal([]),
    ytdTotal: signal(0),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: 'dashboard', component: IncomeWorkspaceComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
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

describe('IncomeWorkspaceComponent no property ID', () => {
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal([]),
    ytdTotal: signal(0),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
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

describe('IncomeWorkspaceComponent empty income state', () => {
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal([]),
    ytdTotal: signal(0),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
    fixture.detectChanges();
  });

  it('should show empty state when no income', () => {
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
  });

  it('should display empty state message', () => {
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState.nativeElement.textContent).toContain('No income recorded yet');
  });

  it('should display hint about adding income', () => {
    const hint = fixture.debugElement.query(By.css('.empty-hint'));
    expect(hint).toBeTruthy();
    expect(hint.nativeElement.textContent).toContain('Use the form above');
  });
});

describe('IncomeWorkspaceComponent goBack navigation', () => {
  let component: IncomeWorkspaceComponent;
  let fixture: ComponentFixture<IncomeWorkspaceComponent>;
  let router: Router;

  const mockIncomeStore = {
    isLoading: signal(false),
    isEmpty: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isSaving: signal(false),
    incomeEntries: signal([]),
    ytdTotal: signal(0),
    editingIncomeId: signal<string | null>(null),
    loadIncomeByProperty: vi.fn(),
    createIncome: vi.fn(),
  };

  const mockPropertyService = {
    getPropertyById: vi.fn().mockReturnValue(of({ id: 'prop-123', name: 'Test Property' })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeWorkspaceComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: 'properties/:id', component: IncomeWorkspaceComponent },
          { path: 'dashboard', component: IncomeWorkspaceComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IncomeStore, useValue: mockIncomeStore },
        { provide: PropertyService, useValue: mockPropertyService },
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

    fixture = TestBed.createComponent(IncomeWorkspaceComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should navigate to property detail when propertyId exists', () => {
    component['goBack']();
    expect(router.navigate).toHaveBeenCalledWith(['/properties', 'prop-123']);
  });
});
