import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CreateWoFromExpenseDialogComponent,
  CreateWoFromExpenseDialogData,
} from './create-wo-from-expense-dialog.component';
import { WorkOrderService } from '../../services/work-order.service';
import { ExpenseService } from '../../../expenses/services/expense.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';

describe('CreateWoFromExpenseDialogComponent', () => {
  let component: CreateWoFromExpenseDialogComponent;
  let fixture: ComponentFixture<CreateWoFromExpenseDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockWorkOrderService: {
    createWorkOrder: ReturnType<typeof vi.fn>;
  };
  let mockExpenseService: {
    getExpense: ReturnType<typeof vi.fn>;
    updateExpense: ReturnType<typeof vi.fn>;
  };

  const mockDialogData: CreateWoFromExpenseDialogData = {
    expenseId: 'exp-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    description: 'Faucet repair',
    categoryId: 'cat-1',
  };

  const mockExpenseStore = {
    sortedCategories: signal([
      { id: 'cat-1', name: 'Repairs', scheduleELine: 'Line 14' },
      { id: 'cat-2', name: 'Insurance', scheduleELine: 'Line 9' },
    ]),
    isLoadingCategories: signal(false),
    loadCategories: vi.fn(),
  };

  const mockVendorStore = {
    vendors: signal([
      { id: 'v-1', fullName: 'John Smith' },
      { id: 'v-2', fullName: 'Jane Doe' },
    ]),
    isLoading: signal(false),
    loadVendors: vi.fn(),
  };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockWorkOrderService = {
      createWorkOrder: vi.fn().mockReturnValue(of({ id: 'new-wo-id' })),
    };
    mockExpenseService = {
      getExpense: vi.fn().mockReturnValue(of({
        id: 'exp-1',
        propertyId: 'prop-1',
        propertyName: 'Test Property',
        amount: 125.50,
        date: '2026-01-15',
        categoryId: 'cat-1',
        categoryName: 'Repairs',
        description: 'Faucet repair',
        createdAt: '2026-01-15T10:00:00Z',
      })),
      updateExpense: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [CreateWoFromExpenseDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: WorkOrderService, useValue: mockWorkOrderService },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateWoFromExpenseDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render dialog title', () => {
    const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
    expect(title.textContent).toContain('Create Work Order from Expense');
  });

  it('should display property name (not editable) (AC #2)', () => {
    const propertyLabel = fixture.nativeElement.querySelector('.property-label');
    expect(propertyLabel.textContent).toContain('Test Property');
  });

  it('should pre-populate description from expense data (AC #2)', () => {
    expect(component.form.controls.description.value).toBe('Faucet repair');
  });

  it('should pre-select category from expense data (AC #2)', () => {
    expect(component.form.controls.categoryId.value).toBe('cat-1');
  });

  it('should validate description as required (AC #5)', () => {
    component.form.controls.description.setValue('');
    component.form.controls.description.markAsTouched();
    expect(component.form.controls.description.hasError('required')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('should disable "Create & Link" when form invalid (AC #5)', () => {
    component.form.controls.description.setValue('');
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(submitButton.disabled).toBe(true);
  });

  it('should disable "Create & Link" during submission', () => {
    component.isSubmitting.set(true);
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(submitButton.disabled).toBe(true);
  });

  it('should call workOrderService.createWorkOrder with correct data on submit (AC #3)', () => {
    component.form.controls.description.setValue('Faucet repair');
    component.form.controls.categoryId.setValue('cat-1');
    component.form.controls.vendorId.setValue('v-1');

    component.onSubmit();

    expect(mockWorkOrderService.createWorkOrder).toHaveBeenCalledWith({
      propertyId: 'prop-1',
      description: 'Faucet repair',
      categoryId: 'cat-1',
      status: 'Reported',
      vendorId: 'v-1',
    });
  });

  it('should fetch expense and update with workOrderId after WO creation (AC #3)', () => {
    component.onSubmit();

    expect(mockExpenseService.getExpense).toHaveBeenCalledWith('exp-1');
    expect(mockExpenseService.updateExpense).toHaveBeenCalledWith('exp-1', {
      amount: 125.50,
      date: '2026-01-15',
      categoryId: 'cat-1',
      description: 'Faucet repair',
      workOrderId: 'new-wo-id',
    });
  });

  it('should show success snackbar on full success (AC #3)', () => {
    component.onSubmit();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Work order created and linked',
      'Close',
      { duration: 3000 }
    );
  });

  it('should close dialog with result on full success (AC #3)', () => {
    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      workOrderId: 'new-wo-id',
      expenseId: 'exp-1',
    });
  });

  it('should show error snackbar when WO creation fails (AC #6)', () => {
    mockWorkOrderService.createWorkOrder.mockReturnValue(
      throwError(() => new Error('Network error'))
    );

    component.onSubmit();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to create work order',
      'Close',
      { duration: 3000 }
    );
  });

  it('should keep dialog open when WO creation fails (AC #6)', () => {
    mockWorkOrderService.createWorkOrder.mockReturnValue(
      throwError(() => new Error('Network error'))
    );

    component.onSubmit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  it('should show partial success snackbar when linking fails (AC #6)', () => {
    mockExpenseService.updateExpense.mockReturnValue(
      throwError(() => new Error('Link failed'))
    );

    component.onSubmit();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Work order created but linking failed. Link manually from the work order.',
      'Close',
      { duration: 5000 }
    );
  });

  it('should close dialog with linkFailed flag when linking fails (AC #6)', () => {
    mockExpenseService.updateExpense.mockReturnValue(
      throwError(() => new Error('Link failed'))
    );

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      workOrderId: 'new-wo-id',
      expenseId: 'exp-1',
      linkFailed: true,
    });
  });

  it('should show partial success snackbar when getExpense fails (AC #6)', () => {
    mockExpenseService.getExpense.mockReturnValue(
      throwError(() => new Error('Fetch failed'))
    );

    component.onSubmit();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Work order created but linking failed. Link manually from the work order.',
      'Close',
      { duration: 5000 }
    );
  });

  it('should not submit when form is invalid', () => {
    component.form.controls.description.setValue('');

    component.onSubmit();

    expect(mockWorkOrderService.createWorkOrder).not.toHaveBeenCalled();
  });

  it('should not submit when already submitting', () => {
    component.isSubmitting.set(true);

    component.onSubmit();

    expect(mockWorkOrderService.createWorkOrder).not.toHaveBeenCalled();
  });

  it('should load categories on init', () => {
    expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
  });

  it('should load vendors on init', () => {
    expect(mockVendorStore.loadVendors).toHaveBeenCalled();
  });

  it('should not send categoryId when empty string (AC #2)', () => {
    component.form.controls.categoryId.setValue('');

    component.onSubmit();

    expect(mockWorkOrderService.createWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: undefined,
      })
    );
  });

  it('should not send vendorId when empty string', () => {
    component.form.controls.vendorId.setValue('');

    component.onSubmit();

    expect(mockWorkOrderService.createWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: undefined,
      })
    );
  });
});

describe('CreateWoFromExpenseDialogComponent without pre-populated data', () => {
  let component: CreateWoFromExpenseDialogComponent;
  let fixture: ComponentFixture<CreateWoFromExpenseDialogComponent>;

  const dialogDataNoDescription: CreateWoFromExpenseDialogData = {
    expenseId: 'exp-2',
    propertyId: 'prop-2',
    propertyName: 'Another Property',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateWoFromExpenseDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogDataNoDescription },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: WorkOrderService, useValue: { createWorkOrder: vi.fn() } },
        { provide: ExpenseService, useValue: { getExpense: vi.fn(), updateExpense: vi.fn() } },
        {
          provide: ExpenseStore,
          useValue: {
            sortedCategories: signal([]),
            isLoadingCategories: signal(false),
            loadCategories: vi.fn(),
          },
        },
        {
          provide: VendorStore,
          useValue: {
            vendors: signal([]),
            isLoading: signal(false),
            loadVendors: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateWoFromExpenseDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have empty description when not provided', () => {
    expect(component.form.controls.description.value).toBe('');
  });

  it('should have empty categoryId when not provided', () => {
    expect(component.form.controls.categoryId.value).toBe('');
  });
});
