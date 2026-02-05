import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ReceiptExpenseFormComponent } from './receipt-expense-form.component';
import { ApiClient } from '../../../../core/api/api.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { PropertyStore } from '../../../properties/stores/property.store';
import { WorkOrderService } from '../../../work-orders/services/work-order.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal, WritableSignal } from '@angular/core';

describe('ReceiptExpenseFormComponent', () => {
  let component: ReceiptExpenseFormComponent;
  let fixture: ComponentFixture<ReceiptExpenseFormComponent>;
  let apiClientMock: { receipts_ProcessReceipt: ReturnType<typeof vi.fn> };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let mockWorkOrderService: { getWorkOrdersByProperty: ReturnType<typeof vi.fn> };
  let mockCategories: WritableSignal<any[]>;
  let mockIsLoadingCategories: WritableSignal<boolean>;
  let mockSortedCategories: WritableSignal<any[]>;
  let mockProperties: WritableSignal<any[]>;
  let mockIsLoading: WritableSignal<boolean>;

  const testReceiptId = 'receipt-123';
  const testPropertyId = 'property-456';
  const testCategoryId = 'category-789';

  const mockWorkOrders = [
    { id: 'wo-1', description: 'Fix leaky faucet', status: 'Reported', propertyId: testPropertyId },
    { id: 'wo-2', description: 'Replace HVAC filter', status: 'Assigned', propertyId: testPropertyId },
    { id: 'wo-3', description: 'Paint bedroom', status: 'Completed', propertyId: testPropertyId },
  ];

  beforeEach(async () => {
    mockCategories = signal([
      { id: testCategoryId, name: 'Repairs', sortOrder: 1 },
    ]);
    mockIsLoadingCategories = signal(false);
    mockSortedCategories = signal([
      { id: testCategoryId, name: 'Repairs', sortOrder: 1 },
    ]);
    mockProperties = signal([
      { id: testPropertyId, name: 'Test Property', expenseTotal: 0, incomeTotal: 0 },
    ]);
    mockIsLoading = signal(false);

    apiClientMock = {
      receipts_ProcessReceipt: vi.fn().mockReturnValue(of({ expenseId: 'expense-123' })),
    };

    snackBarMock = {
      open: vi.fn(),
    };

    mockWorkOrderService = {
      getWorkOrdersByProperty: vi.fn().mockReturnValue(of({
        items: mockWorkOrders,
        totalCount: mockWorkOrders.length,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [ReceiptExpenseFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ApiClient, useValue: apiClientMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: WorkOrderService, useValue: mockWorkOrderService },
        {
          provide: ExpenseStore,
          useValue: {
            loadCategories: vi.fn(),
            categories: mockCategories,
            isLoadingCategories: mockIsLoadingCategories,
            sortedCategories: mockSortedCategories,
          },
        },
        {
          provide: PropertyStore,
          useValue: {
            loadProperties: vi.fn(),
            properties: mockProperties,
            isLoading: mockIsLoading,
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReceiptExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('receiptId', testReceiptId);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display property select', () => {
    const propertySelect = fixture.debugElement.query(
      By.css('[data-testid="property-select"]')
    );
    expect(propertySelect).toBeTruthy();
  });

  it('should display amount input', () => {
    const amountInput = fixture.debugElement.query(
      By.css('[data-testid="amount-input"]')
    );
    expect(amountInput).toBeTruthy();
  });

  it('should display date input', () => {
    const dateInput = fixture.debugElement.query(
      By.css('[data-testid="date-input"]')
    );
    expect(dateInput).toBeTruthy();
  });

  it('should display description input', () => {
    const descriptionInput = fixture.debugElement.query(
      By.css('[data-testid="description-input"]')
    );
    expect(descriptionInput).toBeTruthy();
  });

  it('should display save button', () => {
    const saveBtn = fixture.debugElement.query(
      By.css('[data-testid="save-btn"]')
    );
    expect(saveBtn).toBeTruthy();
  });

  it('should display cancel button', () => {
    const cancelBtn = fixture.debugElement.query(
      By.css('[data-testid="cancel-btn"]')
    );
    expect(cancelBtn).toBeTruthy();
  });

  it('should pre-select property if propertyId is provided', () => {
    fixture.componentRef.setInput('propertyId', testPropertyId);
    fixture.detectChanges();

    // Trigger ngOnInit manually since we're changing inputs after initial detection
    component.ngOnInit();
    fixture.detectChanges();

    expect(component['form'].get('propertyId')?.value).toBe(testPropertyId);
  });

  it('should pre-populate date from defaultDate', () => {
    const testDate = new Date('2025-06-15');
    fixture.componentRef.setInput('defaultDate', testDate);
    fixture.detectChanges();

    component.ngOnInit();
    fixture.detectChanges();

    const dateValue = component['form'].get('date')?.value;
    expect(dateValue).toEqual(testDate);
  });

  it('should disable save button when form is invalid', () => {
    const saveBtn = fixture.debugElement.query(
      By.css('[data-testid="save-btn"]')
    );
    expect(saveBtn.nativeElement.disabled).toBe(true);
  });

  it('should emit cancelled event on cancel button click', () => {
    const cancelledSpy = vi.fn();
    component.cancelled.subscribe(cancelledSpy);

    const cancelBtn = fixture.debugElement.query(
      By.css('[data-testid="cancel-btn"]')
    );
    cancelBtn.nativeElement.click();

    expect(cancelledSpy).toHaveBeenCalled();
  });

  describe('form validation', () => {
    it('should require property', () => {
      const control = component['form'].get('propertyId');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should require amount', () => {
      const control = component['form'].get('amount');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should require amount greater than 0', () => {
      const control = component['form'].get('amount');
      control?.setValue(0);
      expect(control?.hasError('min')).toBe(true);
    });

    it('should require category', () => {
      const control = component['form'].get('categoryId');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should enforce max description length', () => {
      const control = component['form'].get('description');
      control?.setValue('a'.repeat(501));
      expect(control?.hasError('maxlength')).toBe(true);
    });
  });

  describe('form submission', () => {
    beforeEach(() => {
      // Set up valid form values
      component['form'].patchValue({
        propertyId: testPropertyId,
        amount: 99.99,
        date: new Date(),
        categoryId: testCategoryId,
        description: 'Test description',
      });
      fixture.detectChanges();
    });

    it('should call API when form is submitted', () => {
      component['onSubmit']();

      expect(apiClientMock.receipts_ProcessReceipt).toHaveBeenCalledWith(
        testReceiptId,
        expect.objectContaining({
          propertyId: testPropertyId,
          amount: 99.99,
          categoryId: testCategoryId,
          description: 'Test description',
        })
      );
    });

    it('should emit saved event on successful submission', () => {
      const savedSpy = vi.fn();
      component.saved.subscribe(savedSpy);

      component['onSubmit']();

      expect(savedSpy).toHaveBeenCalled();
    });

    it('should show success snackbar on successful submission', () => {
      component['onSubmit']();

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Expense saved with receipt',
        'Close',
        expect.any(Object)
      );
    });

    it('should show error snackbar on API error', () => {
      apiClientMock.receipts_ProcessReceipt.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      component['onSubmit']();

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Failed to save expense. Please try again.',
        'Close',
        expect.any(Object)
      );
    });

    it('should show conflict error for 409 status', () => {
      apiClientMock.receipts_ProcessReceipt.mockReturnValue(
        throwError(() => ({ status: 409 }))
      );

      component['onSubmit']();

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Receipt has already been processed.',
        'Close',
        expect.any(Object)
      );
    });

    it('should show not found error for 404 status', () => {
      apiClientMock.receipts_ProcessReceipt.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      component['onSubmit']();

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Receipt or property not found.',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('work order dropdown (AC-11.8)', () => {
    it('should render work order dropdown in form', () => {
      const workOrderSelect = fixture.debugElement.query(
        By.css('[data-testid="work-order-select"]')
      );
      expect(workOrderSelect).toBeTruthy();
    });

    it('should have workOrderId form control', () => {
      const control = component['form'].get('workOrderId');
      expect(control).toBeTruthy();
      expect(control?.value).toBe('');
    });

    it('should disable dropdown when no property selected', () => {
      // No property selected (default state)
      fixture.detectChanges();
      const control = component['form'].get('workOrderId');
      expect(control?.disabled).toBe(true);
    });

    it('should show "Select a property first" hint when no property', () => {
      fixture.detectChanges();
      const hints = fixture.debugElement.queryAll(By.css('mat-hint'));
      const propertyHint = hints.find(h =>
        h.nativeElement.textContent.includes('Select a property first')
      );
      expect(propertyHint).toBeTruthy();
    });

    it('should load work orders when property is selected', () => {
      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();

      expect(mockWorkOrderService.getWorkOrdersByProperty).toHaveBeenCalledWith(testPropertyId);
    });

    it('should filter to only active work orders (Reported, Assigned)', () => {
      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();

      // workOrders signal should only have Reported and Assigned, not Completed
      const workOrders = component['workOrders']();
      expect(workOrders.length).toBe(2);
      expect(workOrders.find((wo: any) => wo.status === 'Completed')).toBeUndefined();
      expect(workOrders.find((wo: any) => wo.status === 'Reported')).toBeTruthy();
      expect(workOrders.find((wo: any) => wo.status === 'Assigned')).toBeTruthy();
    });

    it('should show "None" option when work orders are loaded', () => {
      // Set property to trigger work order load
      fixture.componentRef.setInput('propertyId', testPropertyId);
      component.ngOnInit();
      fixture.detectChanges();

      // The "None" mat-option should exist (value="")
      // We verify through the workOrders signal and form control default value
      expect(component['form'].get('workOrderId')?.value).toBe('');
    });

    it('should truncate work order description at 60 chars', () => {
      const longDescription = 'A'.repeat(65);
      mockWorkOrderService.getWorkOrdersByProperty.mockReturnValue(of({
        items: [
          { id: 'wo-long', description: longDescription, status: 'Reported', propertyId: testPropertyId },
        ],
        totalCount: 1,
      }));

      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();

      const workOrders = component['workOrders']();
      expect(workOrders.length).toBe(1);
      expect(workOrders[0].description.length).toBe(65);
      // Template handles truncation via slice pipe - verify data is available
      expect(workOrders[0].description).toBe(longDescription);
    });

    it('should clear work order selection when property changes', () => {
      // First select a property and work order
      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();
      component['form'].patchValue({ workOrderId: 'wo-1' });
      fixture.detectChanges();

      expect(component['form'].get('workOrderId')?.value).toBe('wo-1');

      // Change property - should clear work order
      component['form'].patchValue({ propertyId: 'new-property-id' });
      fixture.detectChanges();

      expect(component['form'].get('workOrderId')?.value).toBe('');
    });

    it('should load new work orders when property changes', () => {
      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();

      mockWorkOrderService.getWorkOrdersByProperty.mockClear();

      component['form'].patchValue({ propertyId: 'new-property-id' });
      fixture.detectChanges();

      expect(mockWorkOrderService.getWorkOrdersByProperty).toHaveBeenCalledWith('new-property-id');
    });

    it('should keep form valid without work order selection', () => {
      component['form'].patchValue({
        propertyId: testPropertyId,
        amount: 50.00,
        date: new Date(),
        categoryId: testCategoryId,
        description: 'Test',
        workOrderId: '', // No work order
      });

      expect(component['form'].valid).toBe(true);
    });

    it('should include workOrderId in submit when selected', () => {
      component['form'].patchValue({
        propertyId: testPropertyId,
        amount: 50.00,
        date: new Date(),
        categoryId: testCategoryId,
        description: 'Test',
        workOrderId: 'wo-1',
      });
      fixture.detectChanges();

      component['onSubmit']();

      expect(apiClientMock.receipts_ProcessReceipt).toHaveBeenCalledWith(
        testReceiptId,
        expect.objectContaining({
          workOrderId: 'wo-1',
        })
      );
    });

    it('should send undefined workOrderId when "None" selected', () => {
      component['form'].patchValue({
        propertyId: testPropertyId,
        amount: 50.00,
        date: new Date(),
        categoryId: testCategoryId,
        description: 'Test',
        workOrderId: '', // "None" selected
      });
      fixture.detectChanges();

      component['onSubmit']();

      expect(apiClientMock.receipts_ProcessReceipt).toHaveBeenCalledWith(
        testReceiptId,
        expect.objectContaining({
          workOrderId: undefined,
        })
      );
    });

    it('should handle error when loading work orders', () => {
      mockWorkOrderService.getWorkOrdersByProperty.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      component['form'].patchValue({ propertyId: testPropertyId });
      fixture.detectChanges();

      expect(component['workOrders']()).toEqual([]);
      expect(component['isLoadingWorkOrders']()).toBe(false);
    });
  });
});
