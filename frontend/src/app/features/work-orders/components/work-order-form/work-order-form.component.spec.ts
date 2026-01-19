import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { WorkOrderFormComponent } from './work-order-form.component';
import { WorkOrderStore } from '../../stores/work-order.store';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { PropertyService } from '../../../properties/services/property.service';

describe('WorkOrderFormComponent', () => {
  let component: WorkOrderFormComponent;
  let fixture: ComponentFixture<WorkOrderFormComponent>;
  let mockWorkOrderStore: {
    workOrders: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isSaving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    hasWorkOrders: ReturnType<typeof signal<boolean>>;
    workOrderCount: ReturnType<typeof signal<number>>;
    loadWorkOrders: ReturnType<typeof vi.fn>;
    createWorkOrder: ReturnType<typeof vi.fn>;
    clearError: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  let mockExpenseStore: {
    categories: ReturnType<typeof signal>;
    sortedCategories: ReturnType<typeof signal>;
    isLoadingCategories: ReturnType<typeof signal<boolean>>;
    loadCategories: ReturnType<typeof vi.fn>;
  };
  let mockPropertyService: {
    getProperties: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockProperties = [
    { id: 'prop-1', name: 'Test Property 1', city: 'Austin', state: 'TX' },
    { id: 'prop-2', name: 'Test Property 2', city: 'Dallas', state: 'TX' },
  ];

  const mockCategories = [
    { id: 'cat-1', name: 'Repairs', parentId: null },
    { id: 'cat-2', name: 'Plumbing', parentId: 'cat-1' },
    { id: 'cat-3', name: 'Maintenance', parentId: null },
  ];

  beforeEach(async () => {
    mockWorkOrderStore = {
      workOrders: signal([]),
      isLoading: signal(false),
      isSaving: signal(false),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      hasWorkOrders: signal(false),
      workOrderCount: signal(0),
      loadWorkOrders: vi.fn(),
      createWorkOrder: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
    };

    mockExpenseStore = {
      categories: signal(mockCategories),
      sortedCategories: signal(mockCategories),
      isLoadingCategories: signal(false),
      loadCategories: vi.fn(),
    };

    mockPropertyService = {
      getProperties: vi.fn().mockReturnValue(of({ items: mockProperties, totalCount: 2 })),
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrderFormComponent, NoopAnimationsModule],
      providers: [
        provideRouter([
          { path: 'work-orders', component: WorkOrderFormComponent },
          { path: 'work-orders/new', component: WorkOrderFormComponent },
        ]),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: PropertyService, useValue: mockPropertyService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Structure (AC #6)', () => {
    it('should have New Work Order title', () => {
      const title = fixture.debugElement.query(By.css('mat-card-title'));
      expect(title.nativeElement.textContent).toContain('New Work Order');
    });

    it('should have Property dropdown (AC #6)', () => {
      const propertySelect = fixture.debugElement.query(
        By.css('mat-select[formControlName="propertyId"]')
      );
      expect(propertySelect).toBeTruthy();
    });

    it('should have Description textarea (AC #6)', () => {
      const descriptionField = fixture.debugElement.query(
        By.css('textarea[formControlName="description"]')
      );
      expect(descriptionField).toBeTruthy();
    });

    it('should have Category dropdown marked as optional (AC #6)', () => {
      const labels = fixture.debugElement
        .queryAll(By.css('mat-label'))
        .map((el) => el.nativeElement.textContent);
      expect(labels.some((label: string) => label.includes('Category') && label.includes('optional'))).toBe(true);
    });

    it('should have Status dropdown (AC #6)', () => {
      const statusSelect = fixture.debugElement.query(
        By.css('mat-select[formControlName="status"]')
      );
      expect(statusSelect).toBeTruthy();
    });

    it('should have Save Work Order button', () => {
      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton).toBeTruthy();
      expect(saveButton.nativeElement.textContent).toContain('Save Work Order');
    });

    it('should have Cancel button', () => {
      const cancelButton = fixture.debugElement.query(
        By.css('button[type="button"]')
      );
      expect(cancelButton).toBeTruthy();
      expect(cancelButton.nativeElement.textContent).toContain('Cancel');
    });
  });

  describe('Form Initialization', () => {
    it('should load properties on init', () => {
      expect(mockPropertyService.getProperties).toHaveBeenCalled();
    });

    it('should load categories on init', () => {
      expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
    });

    it('should default status to Reported', () => {
      expect(component['form'].get('status')?.value).toBe('Reported');
    });
  });

  describe('Form Validation (AC #9)', () => {
    it('should have invalid form when propertyId is empty', () => {
      component['form'].patchValue({
        propertyId: '',
        description: 'Test description',
      });
      expect(component['form'].valid).toBe(false);
    });

    it('should have invalid form when description is empty', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: '',
      });
      expect(component['form'].valid).toBe(false);
    });

    it('should have valid form with propertyId and description', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the leaky faucet',
      });
      expect(component['form'].valid).toBe(true);
    });

    it('should have valid form with all fields', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the leaky faucet',
        categoryId: 'cat-1',
        status: 'Assigned',
      });
      expect(component['form'].valid).toBe(true);
    });

    it('should show "Property is required" error (AC #9)', () => {
      const propertyControl = component['form'].get('propertyId');
      propertyControl?.markAsTouched();
      propertyControl?.setValue('');
      fixture.detectChanges();

      const error = fixture.debugElement.query(By.css('mat-error'));
      expect(error?.nativeElement.textContent).toContain('Property is required');
    });

    it('should show "Description is required" error (AC #9)', () => {
      const descriptionControl = component['form'].get('description');
      descriptionControl?.markAsTouched();
      descriptionControl?.setValue('');
      // Set propertyId valid to isolate description error
      component['form'].get('propertyId')?.setValue('prop-1');
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('mat-error'));
      const descriptionError = errors.find((el) =>
        el.nativeElement.textContent.includes('Description is required')
      );
      expect(descriptionError).toBeTruthy();
    });

    it('should enforce maxLength on description (5000 chars)', () => {
      const longDescription = 'A'.repeat(5001);
      component['form'].get('description')?.setValue(longDescription);
      expect(component['form'].get('description')?.hasError('maxlength')).toBe(true);
    });

    it('should accept 5000 character description', () => {
      const maxDescription = 'A'.repeat(5000);
      component['form'].get('description')?.setValue(maxDescription);
      expect(component['form'].get('description')?.hasError('maxlength')).toBe(false);
    });
  });

  describe('Hierarchical Categories (AC #8)', () => {
    it('should build hierarchical categories from sorted categories', () => {
      const hierarchical = component['hierarchicalCategories']();
      expect(hierarchical.length).toBeGreaterThan(0);
    });

    it('should indent child categories', () => {
      const hierarchical = component['hierarchicalCategories']();
      const childCategory = hierarchical.find((c) => c.parentId);
      expect(childCategory?.indent).toBeTruthy();
      expect(childCategory?.indent.length).toBeGreaterThan(0);
    });

    it('should not indent parent categories', () => {
      const hierarchical = component['hierarchicalCategories']();
      const parentCategory = hierarchical.find((c) => !c.parentId);
      expect(parentCategory?.indent).toBe('');
    });
  });

  describe('Form Submission', () => {
    it('should not submit when form is invalid', () => {
      component['form'].patchValue({
        propertyId: '',
        description: '',
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when submitting invalid form', () => {
      component['form'].patchValue({
        propertyId: '',
        description: '',
      });

      component['onSubmit']();

      expect(component['form'].get('propertyId')?.touched).toBe(true);
      expect(component['form'].get('description')?.touched).toBe(true);
    });

    it('should call createWorkOrder with trimmed description', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: '  Fix the faucet  ',
        categoryId: null,
        status: 'Reported',
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: undefined,
        status: 'Reported',
      });
    });

    it('should pass categoryId when provided', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: 'cat-1',
        status: 'Reported',
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: 'cat-1',
        status: 'Reported',
      });
    });

    it('should disable Save button when form is invalid', () => {
      component['form'].patchValue({
        propertyId: '',
        description: '',
      });
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should disable Save button when saving', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
      });
      mockWorkOrderStore.isSaving.set(true);
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should show spinner when saving', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
      });
      mockWorkOrderStore.isSaving.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });
  });

  describe('Cancel Navigation', () => {
    it('should navigate to /work-orders on cancel', () => {
      component['onCancel']();

      expect(router.navigate).toHaveBeenCalledWith(['/work-orders']);
    });
  });

  describe('Component Lifecycle', () => {
    it('should implement OnDestroy', () => {
      expect(component.ngOnDestroy).toBeDefined();
    });

    it('should set destroyed flag on destroy', () => {
      component.ngOnDestroy();
      expect(component['destroyed']).toBe(true);
    });
  });
});
