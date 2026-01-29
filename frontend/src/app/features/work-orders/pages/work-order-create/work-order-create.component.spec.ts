import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { WorkOrderCreateComponent } from './work-order-create.component';
import { WorkOrderStore } from '../../stores/work-order.store';
import { PropertyStore } from '../../../properties/stores/property.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';
import { ExpenseStore } from '../../../expenses/stores/expense.store';

/**
 * Unit tests for WorkOrderCreateComponent (AC #6)
 *
 * Test coverage:
 * - Component creation and rendering
 * - Pre-selected property ID from query params
 * - Page title and structure
 */
describe('WorkOrderCreateComponent', () => {
  let component: WorkOrderCreateComponent;
  let fixture: ComponentFixture<WorkOrderCreateComponent>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  const mockWorkOrderStore = {
    isCreating: signal(false),
    createError: signal<string | null>(null),
    createWorkOrder: vi.fn(),
    tags: signal([]),
    loadTags: vi.fn(),
    isLoadingTags: signal(false),
    isSaving: signal(false),
    isUpdating: signal(false),
    createTag: vi.fn().mockResolvedValue('new-tag-id'),
  };

  const mockPropertyStore = {
    properties: signal([]),
    isLoading: signal(false),
    loadProperties: vi.fn(),
  };

  const mockVendorStore = {
    vendors: signal([]),
    isLoading: signal(false),
    error: signal(null),
    loadVendors: vi.fn(),
  };

  const mockExpenseStore = {
    categories: signal([]),
    sortedCategories: signal([]),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    await TestBed.configureTestingModule({
      imports: [WorkOrderCreateComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: VendorStore, useValue: mockVendorStore },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderCreateComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display "New Work Order" title', () => {
    fixture.detectChanges();
    const title = fixture.debugElement.query(By.css('h1'));
    expect(title.nativeElement.textContent.trim()).toBe('New Work Order');
  });

  it('should render work-order-form component', () => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.css('app-work-order-form'));
    expect(form).toBeTruthy();
  });

  it('should have work-order-create-page wrapper', () => {
    fixture.detectChanges();
    const wrapper = fixture.debugElement.query(By.css('.work-order-create-page'));
    expect(wrapper).toBeTruthy();
  });

  it('should initialize preSelectedPropertyId as null', () => {
    fixture.detectChanges();
    expect(component['preSelectedPropertyId']).toBeNull();
  });
});

describe('WorkOrderCreateComponent with query params (AC #6)', () => {
  let component: WorkOrderCreateComponent;
  let fixture: ComponentFixture<WorkOrderCreateComponent>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  const mockWorkOrderStore = {
    isCreating: signal(false),
    createError: signal<string | null>(null),
    createWorkOrder: vi.fn(),
    tags: signal([]),
    loadTags: vi.fn(),
    isLoadingTags: signal(false),
    isSaving: signal(false),
    isUpdating: signal(false),
    createTag: vi.fn().mockResolvedValue('new-tag-id'),
  };

  const mockPropertyStore = {
    properties: signal([]),
    isLoading: signal(false),
    loadProperties: vi.fn(),
  };

  const mockVendorStore = {
    vendors: signal([]),
    isLoading: signal(false),
    error: signal(null),
    loadVendors: vi.fn(),
  };

  const mockExpenseStore = {
    categories: signal([]),
    sortedCategories: signal([]),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({
      propertyId: 'prop-123',
    });

    await TestBed.configureTestingModule({
      imports: [WorkOrderCreateComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: VendorStore, useValue: mockVendorStore },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderCreateComponent);
    component = fixture.componentInstance;
  });

  it('should set preSelectedPropertyId from query params (AC #6)', () => {
    fixture.detectChanges();
    expect(component['preSelectedPropertyId']).toBe('prop-123');
  });

  it('should render form component when preSelectedPropertyId is set', () => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.css('app-work-order-form'));
    expect(form).toBeTruthy();
    // Parent component sets preSelectedPropertyId which is verified in the previous test
    // The form component receives this via input binding
  });

  it('should update preSelectedPropertyId when query params change', () => {
    fixture.detectChanges();
    expect(component['preSelectedPropertyId']).toBe('prop-123');

    queryParamsSubject.next({ propertyId: 'prop-456' });
    fixture.detectChanges();
    expect(component['preSelectedPropertyId']).toBe('prop-456');
  });

  it('should set preSelectedPropertyId to null when propertyId not in query params', () => {
    fixture.detectChanges();
    queryParamsSubject.next({});
    fixture.detectChanges();
    expect(component['preSelectedPropertyId']).toBeNull();
  });
});
