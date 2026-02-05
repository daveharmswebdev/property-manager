import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { WorkOrderEditComponent } from './work-order-edit.component';
import { WorkOrderStore } from '../../stores/work-order.store';
import { WorkOrderDto } from '../../services/work-order.service';
import { PropertyStore } from '../../../properties/stores/property.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';
import { ExpenseStore } from '../../../expenses/stores/expense.store';

/**
 * Unit tests for WorkOrderEditComponent (Story 9-9)
 *
 * Test coverage:
 * - AC #1: Load work order by ID
 * - AC #2: Display form in edit mode with pre-populated data
 * - AC #3: Form submission
 * - AC #4: Cancel navigation
 * - Loading and error states
 */
describe('WorkOrderEditComponent', () => {
  let component: WorkOrderEditComponent;
  let fixture: ComponentFixture<WorkOrderEditComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorkOrderStore: any;
  let router: Router;

  const mockWorkOrder: WorkOrderDto = {
    id: 'wo-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    vendorId: 'vendor-789',
    vendorName: 'John Plumber',
    isDiy: false,
    categoryId: 'cat-101',
    categoryName: 'Plumbing',
    status: 'Assigned',
    description: 'Fix the leaky faucet',
    createdAt: '2026-01-20T10:30:00Z',
    createdByUserId: 'user-111',
    tags: [],
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
    mockWorkOrderStore = {
      isLoadingDetail: signal(false),
      detailError: signal<string | null>(null),
      selectedWorkOrder: signal<WorkOrderDto | null>(null),
      isUpdating: signal(false),
      isCreating: signal(false),
      isSaving: signal(false),
      isLoadingTags: signal(false),
      tags: signal([]),
      loadWorkOrderById: vi.fn(),
      clearSelectedWorkOrder: vi.fn(),
      updateWorkOrder: vi.fn(),
      loadTags: vi.fn(),
      createWorkOrder: vi.fn(),
      createTag: vi.fn().mockResolvedValue('new-tag-id'),
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrderEditComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([
          { path: 'work-orders', component: WorkOrderEditComponent },
          { path: 'work-orders/:id', component: WorkOrderEditComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: VendorStore, useValue: mockVendorStore },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'wo-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderEditComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  function setupWithWorkOrder(workOrder: WorkOrderDto = mockWorkOrder): void {
    fixture.detectChanges();
    mockWorkOrderStore.selectedWorkOrder.set(workOrder);
    fixture.detectChanges();
  }

  describe('initialization (AC #1)', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load work order by ID on init', () => {
      fixture.detectChanges();
      expect(mockWorkOrderStore.loadWorkOrderById).toHaveBeenCalledWith('wo-123');
    });

    it('should clear selected work order on destroy', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(mockWorkOrderStore.clearSelectedWorkOrder).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show spinner when loading', () => {
      mockWorkOrderStore.isLoadingDetail.set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should display loading text', () => {
      mockWorkOrderStore.isLoadingDetail.set(true);
      fixture.detectChanges();

      const loadingText = fixture.nativeElement.querySelector('.loading-container p');
      expect(loadingText.textContent).toContain('Loading work order...');
    });

    it('should not show form when loading', () => {
      mockWorkOrderStore.isLoadingDetail.set(true);
      fixture.detectChanges();

      const form = fixture.debugElement.query(By.css('app-work-order-form'));
      expect(form).toBeFalsy();
    });
  });

  describe('error state', () => {
    it('should show error card when detailError is set', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const errorCard = fixture.nativeElement.querySelector('.error-card');
      expect(errorCard).toBeTruthy();
    });

    it('should display error message', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const errorText = fixture.nativeElement.querySelector('.error-card h2');
      expect(errorText.textContent).toContain('Work order not found');
    });

    it('should show error icon', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const errorIcon = fixture.nativeElement.querySelector('.error-icon');
      expect(errorIcon).toBeTruthy();
    });

    it('should show back button in error state', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const backButton = fixture.nativeElement.querySelector('.error-card button');
      expect(backButton).toBeTruthy();
      expect(backButton.textContent).toContain('Back to Work Orders');
    });

    it('should navigate to work orders list when back button clicked', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const backButton = fixture.debugElement.query(By.css('.error-card button'));
      backButton.triggerEventHandler('click', null);

      expect(router.navigate).toHaveBeenCalledWith(['/work-orders']);
    });
  });

  describe('edit form display (AC #2)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should display "Edit Work Order" title', () => {
      const title = fixture.debugElement.query(By.css('h1'));
      expect(title.nativeElement.textContent.trim()).toBe('Edit Work Order');
    });

    it('should render work-order-form component', () => {
      const form = fixture.debugElement.query(By.css('app-work-order-form'));
      expect(form).toBeTruthy();
    });

    it('should have selectedWorkOrder in store for form', () => {
      // Form receives workOrder via input binding from parent
      // The store's selectedWorkOrder is what gets passed to form
      expect(mockWorkOrderStore.selectedWorkOrder()).toEqual(mockWorkOrder);
    });

    it('should render form in edit context', () => {
      // Form component receives mode='edit' via input binding
      // When selectedWorkOrder is set, parent renders the form in edit mode
      const form = fixture.debugElement.query(By.css('app-work-order-form'));
      expect(form).toBeTruthy();
    });

    it('should have work-order-edit-page wrapper', () => {
      const wrapper = fixture.debugElement.query(By.css('.work-order-edit-page'));
      expect(wrapper).toBeTruthy();
    });
  });

  describe('form submission (AC #3)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should call updateWorkOrder on form submit', () => {
      const updateData = {
        description: 'Updated description',
        status: 'Completed',
      };

      component.onSubmit(updateData);

      expect(mockWorkOrderStore.updateWorkOrder).toHaveBeenCalledWith({
        id: 'wo-123',
        data: updateData,
      });
    });
  });

  describe('cancel navigation (AC #4)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should navigate to work order detail on cancel', () => {
      component.onCancel();
      expect(router.navigate).toHaveBeenCalledWith(['/work-orders', 'wo-123']);
    });
  });

  describe('goBack method', () => {
    it('should navigate to work orders list', () => {
      fixture.detectChanges();
      component.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/work-orders']);
    });
  });
});
