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
import { VendorStore } from '../../../vendors/stores/vendor.store';

describe('WorkOrderFormComponent', () => {
  let component: WorkOrderFormComponent;
  let fixture: ComponentFixture<WorkOrderFormComponent>;
  let mockWorkOrderStore: {
    workOrders: ReturnType<typeof signal>;
    tags: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isLoadingTags: ReturnType<typeof signal<boolean>>;
    isSaving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    hasWorkOrders: ReturnType<typeof signal<boolean>>;
    workOrderCount: ReturnType<typeof signal<number>>;
    loadWorkOrders: ReturnType<typeof vi.fn>;
    loadTags: ReturnType<typeof vi.fn>;
    createWorkOrder: ReturnType<typeof vi.fn>;
    createTag: ReturnType<typeof vi.fn>;
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
  let mockVendorStore: {
    vendors: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadVendors: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockVendors = [
    { id: 'vendor-1', fullName: 'John Plumber', tradeTags: [{ id: 'trade-1', name: 'Plumbing' }] },
    { id: 'vendor-2', fullName: 'Jane Electric', tradeTags: [{ id: 'trade-2', name: 'Electrical' }] },
  ];

  const mockProperties = [
    { id: 'prop-1', name: 'Test Property 1', city: 'Austin', state: 'TX' },
    { id: 'prop-2', name: 'Test Property 2', city: 'Dallas', state: 'TX' },
  ];

  const mockCategories = [
    { id: 'cat-1', name: 'Repairs', parentId: null },
    { id: 'cat-2', name: 'Plumbing', parentId: 'cat-1' },
    { id: 'cat-3', name: 'Maintenance', parentId: null },
  ];

  const mockTags = [
    { id: 'tag-1', name: 'Urgent' },
    { id: 'tag-2', name: 'Recurring' },
  ];

  beforeEach(async () => {
    mockWorkOrderStore = {
      workOrders: signal([]),
      tags: signal(mockTags),
      isLoading: signal(false),
      isLoadingTags: signal(false),
      isSaving: signal(false),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      hasWorkOrders: signal(false),
      workOrderCount: signal(0),
      loadWorkOrders: vi.fn(),
      loadTags: vi.fn(),
      createWorkOrder: vi.fn(),
      createTag: vi.fn().mockResolvedValue('new-tag-id'),
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

    mockVendorStore = {
      vendors: signal(mockVendors),
      isLoading: signal(false),
      error: signal<string | null>(null),
      loadVendors: vi.fn(),
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
        { provide: VendorStore, useValue: mockVendorStore },
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

    it('should load tags on init', () => {
      expect(mockWorkOrderStore.loadTags).toHaveBeenCalled();
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
        vendorId: null,
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: undefined,
        status: 'Reported',
        vendorId: undefined,
        tagIds: undefined,
      });
    });

    it('should pass categoryId when provided', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: 'cat-1',
        status: 'Reported',
        vendorId: null,
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: 'cat-1',
        status: 'Reported',
        vendorId: undefined,
        tagIds: undefined,
      });
    });

    it('should pass vendorId when vendor is selected (Story 9-4)', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: null,
        status: 'Assigned',
        vendorId: 'vendor-1',
      });

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: undefined,
        status: 'Assigned',
        vendorId: 'vendor-1',
        tagIds: undefined,
      });
    });

    it('should pass tagIds when tags are selected', () => {
      component['form'].patchValue({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: null,
        status: 'Reported',
        vendorId: null,
      });
      component['selectedTags'].set([
        { id: 'tag-1', name: 'Urgent' },
        { id: 'tag-2', name: 'Recurring' },
      ]);

      component['onSubmit']();

      expect(mockWorkOrderStore.createWorkOrder).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        description: 'Fix the faucet',
        categoryId: undefined,
        status: 'Reported',
        vendorId: undefined,
        tagIds: ['tag-1', 'tag-2'],
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

  describe('Tag Functionality (AC #8-11)', () => {
    it('should have empty selectedTags by default', () => {
      expect(component['selectedTags']()).toEqual([]);
    });

    it('should show all tags when input is empty (AC #9)', () => {
      // The computed is evaluated with empty input initially, showing all tags
      const filtered = component['filteredTags']();
      expect(filtered.length).toBe(2);
    });

    it('should filter tags based on input after re-render (AC #9)', () => {
      // Set input value and trigger change detection to re-evaluate computed
      component['tagInputControl'].setValue('Urg');
      // Manually trigger a dependency change to force re-evaluation
      mockWorkOrderStore.tags.set([...mockTags]);
      const filtered = component['filteredTags']();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Urgent');
    });

    it('should exclude already selected tags from filteredTags', () => {
      component['selectedTags'].set([{ id: 'tag-1', name: 'Urgent' }]);
      const filtered = component['filteredTags']();
      expect(filtered.some((t) => t.id === 'tag-1')).toBe(false);
    });

    it('should allow creating new tag when input does not match existing (AC #10)', () => {
      component['tagInputControl'].setValue('NewTag');
      expect(component['canCreateNewTag']()).toBe(true);
    });

    it('should not allow creating new tag when input matches existing (case-insensitive)', () => {
      component['tagInputControl'].setValue('urgent');
      expect(component['canCreateNewTag']()).toBe(false);
    });

    it('should not allow creating new tag when input is empty', () => {
      component['tagInputControl'].setValue('');
      expect(component['canCreateNewTag']()).toBe(false);
    });

    it('should remove tag from selectedTags (AC #11)', () => {
      const tag = { id: 'tag-1', name: 'Urgent' };
      component['selectedTags'].set([tag, { id: 'tag-2', name: 'Recurring' }]);

      component['removeTag'](tag);

      expect(component['selectedTags']()).toEqual([{ id: 'tag-2', name: 'Recurring' }]);
    });
  });

  describe('Vendor Assignment (Story 9-4)', () => {
    it('should have Assigned To dropdown (AC #6)', () => {
      const vendorSelect = fixture.debugElement.query(
        By.css('mat-select[formControlName="vendorId"]')
      );
      expect(vendorSelect).toBeTruthy();
    });

    it('should load vendors on init (AC #6)', () => {
      expect(mockVendorStore.loadVendors).toHaveBeenCalled();
    });

    it('should default vendorId to null (DIY)', () => {
      expect(component['form'].get('vendorId')?.value).toBeNull();
    });

    it('should have vendorId form control', () => {
      expect(component['form'].get('vendorId')).toBeTruthy();
    });

    it('should auto-update status to Assigned when vendor selected and status is Reported (AC #10)', () => {
      component['form'].patchValue({ status: 'Reported' });

      component['onVendorChange']('vendor-1');

      expect(component['form'].get('status')?.value).toBe('Assigned');
    });

    it('should NOT auto-update status when vendor selected but status is not Reported', () => {
      component['form'].patchValue({ status: 'Completed' });

      component['onVendorChange']('vendor-1');

      expect(component['form'].get('status')?.value).toBe('Completed');
    });

    it('should NOT auto-update status when DIY selected (vendorId is null)', () => {
      component['form'].patchValue({ status: 'Reported' });

      component['onVendorChange'](null);

      expect(component['form'].get('status')?.value).toBe('Reported');
    });

    it('should format trade tags correctly', () => {
      const result = component['formatTradeTags']([
        { name: 'Plumbing' },
        { name: 'HVAC' },
      ]);

      expect(result).toBe('Plumbing, HVAC');
    });

    it('should format empty trade tags as empty string', () => {
      const result = component['formatTradeTags']([]);

      expect(result).toBe('');
    });

    it('should show error message when vendor loading fails', () => {
      mockVendorStore.error.set('Failed to load vendors');
      fixture.detectChanges();

      const errorElement = fixture.debugElement.query(By.css('mat-error'));
      expect(errorElement).toBeTruthy();
      expect(errorElement.nativeElement.textContent).toContain('Failed to load vendors');
    });

    it('should still allow DIY selection when vendor loading fails', () => {
      mockVendorStore.error.set('Failed to load vendors');
      fixture.detectChanges();

      const vendorSelect = fixture.debugElement.query(
        By.css('mat-select[formControlName="vendorId"]')
      );
      expect(vendorSelect).toBeTruthy();
      // Should not be disabled when there's an error - DIY is still available
      expect(vendorSelect.attributes['ng-reflect-disabled']).toBeFalsy();
    });
  });
});
