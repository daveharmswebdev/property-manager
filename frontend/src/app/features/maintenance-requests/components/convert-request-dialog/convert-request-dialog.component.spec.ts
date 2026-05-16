import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ConvertRequestDialogComponent,
  ConvertRequestDialogData,
} from './convert-request-dialog.component';
import { MaintenanceRequestService } from '../../services/maintenance-request.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { VendorStore } from '../../../vendors/stores/vendor.store';

describe('ConvertRequestDialogComponent', () => {
  let component: ConvertRequestDialogComponent;
  let fixture: ComponentFixture<ConvertRequestDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockService: {
    convertToWorkOrder: ReturnType<typeof vi.fn>;
  };

  const mockDialogData: ConvertRequestDialogData = {
    maintenanceRequestId: 'req-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    description: 'Leaky faucet in kitchen',
  };

  const mockExpenseStore = {
    sortedCategories: signal([
      { id: 'cat-1', name: 'Repairs' },
      { id: 'cat-2', name: 'Insurance' },
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

  async function setup(): Promise<void> {
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockService = {
      convertToWorkOrder: vi.fn().mockReturnValue(
        of({ workOrderId: 'wo-new-1', maintenanceRequestId: 'req-1' }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ConvertRequestDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MaintenanceRequestService, useValue: mockService },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConvertRequestDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('pre-populates description from dialog data', () => {
    expect(component.form.value.description).toBe('Leaky faucet in kitchen');
  });

  it('renders the dialog with the convert testid', () => {
    const root = fixture.debugElement.query(By.css('[data-testid="convert-dialog"]'));
    expect(root).toBeTruthy();
  });

  it('calls ExpenseStore.loadCategories and VendorStore.loadVendors on init', () => {
    expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
    expect(mockVendorStore.loadVendors).toHaveBeenCalled();
  });

  it('disables the submit button when description is empty', () => {
    component.form.patchValue({ description: '' });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('[data-testid="convert-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('disables the submit button when description exceeds 5000 chars', () => {
    component.form.patchValue({ description: 'x'.repeat(5001) });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('[data-testid="convert-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('submits with description, categoryId, and vendorId when set', () => {
    component.form.patchValue({
      description: 'Fix the heater',
      categoryId: 'cat-1',
      vendorId: 'v-1',
    });

    component.onSubmit();

    expect(mockService.convertToWorkOrder).toHaveBeenCalledWith('req-1', {
      description: 'Fix the heater',
      categoryId: 'cat-1',
      vendorId: 'v-1',
    });
  });

  it('passes undefined when categoryId is empty string', () => {
    component.form.patchValue({
      description: 'Fix it',
      categoryId: '',
      vendorId: '',
    });

    component.onSubmit();

    expect(mockService.convertToWorkOrder).toHaveBeenCalledWith('req-1', {
      description: 'Fix it',
      categoryId: undefined,
      vendorId: undefined,
    });
  });

  it('trims description before sending to the backend', () => {
    component.form.patchValue({ description: '   Fix it   ' });

    component.onSubmit();

    expect(mockService.convertToWorkOrder).toHaveBeenCalledWith('req-1', {
      description: 'Fix it',
      categoryId: undefined,
      vendorId: undefined,
    });
  });

  it('closes the dialog with result on successful conversion', () => {
    component.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      workOrderId: 'wo-new-1',
      maintenanceRequestId: 'req-1',
    });
  });

  it('shows snackbar and keeps dialog open on error', () => {
    mockService.convertToWorkOrder.mockReturnValue(
      throwError(() => new Error('boom')),
    );
    component.onSubmit();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to convert request to work order',
      'Close',
      { duration: 4000 },
    );
    expect(component.isSubmitting()).toBe(false);
  });

  it('does NOT call the service when the form is invalid', () => {
    component.form.patchValue({ description: '' });
    component.onSubmit();
    expect(mockService.convertToWorkOrder).not.toHaveBeenCalled();
  });

  it('does NOT call the service when already submitting', () => {
    component.isSubmitting.set(true);
    component.onSubmit();
    expect(mockService.convertToWorkOrder).not.toHaveBeenCalled();
  });

  it('cancel button has mat-dialog-close attribute (does not call service)', () => {
    const cancelBtn = fixture.debugElement.query(
      By.css('[data-testid="convert-dialog-cancel"]'),
    );
    expect(cancelBtn).toBeTruthy();
    // The cancel button uses [mat-dialog-close] directive, which causes Material
    // to close the dialog automatically without invoking onSubmit.
    cancelBtn.nativeElement.click();
    expect(mockService.convertToWorkOrder).not.toHaveBeenCalled();
  });
});
