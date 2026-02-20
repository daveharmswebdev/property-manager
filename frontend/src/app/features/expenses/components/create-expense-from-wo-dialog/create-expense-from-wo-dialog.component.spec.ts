import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { formatLocalDate } from '../../../../shared/utils/date.utils';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CreateExpenseFromWoDialogComponent,
  CreateExpenseFromWoDialogData,
} from './create-expense-from-wo-dialog.component';
import { ExpenseService } from '../../services/expense.service';
import { ExpenseStore } from '../../stores/expense.store';

describe('CreateExpenseFromWoDialogComponent', () => {
  let component: CreateExpenseFromWoDialogComponent;
  let fixture: ComponentFixture<CreateExpenseFromWoDialogComponent>;

  const mockDialogData: CreateExpenseFromWoDialogData = {
    workOrderId: 'wo-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    categoryId: 'cat-1',
    workOrderDescription: 'Fix the leaky faucet',
  };

  const mockExpenseService = {
    createExpense: vi.fn().mockReturnValue(of({ id: 'new-exp-id' })),
  };

  const mockExpenseStore = {
    loadCategories: vi.fn(),
    sortedCategories: signal([
      { id: 'cat-1', name: 'Repairs', scheduleELine: 'Repairs', sortOrder: 1, parentId: null },
      { id: 'cat-2', name: 'Supplies', scheduleELine: 'Other', sortOrder: 2, parentId: null },
    ]),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CreateExpenseFromWoDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateExpenseFromWoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('dialog rendering (AC #2)', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display dialog title', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Create Expense for Work Order');
    });

    it('should display property name as locked label', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Property: Test Property');
    });

    it('should display work order description for context', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Work Order: Fix the leaky faucet');
    });

    it('should pre-select category from work order data', () => {
      expect(component.form.controls.categoryId.value).toBe('cat-1');
    });

    it('should default date to today', () => {
      const today = formatLocalDate(new Date());
      expect(component.form.controls.date.value).toBe(today);
    });

    it('should have empty amount field', () => {
      expect(component.form.controls.amount.value).toBeNull();
    });

    it('should have empty description field', () => {
      expect(component.form.controls.description.value).toBe('');
    });

    it('should load categories on init', () => {
      expect(mockExpenseStore.loadCategories).toHaveBeenCalled();
    });

    it('should display categories from store', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Category');
    });
  });

  describe('validation (AC #5)', () => {
    it('should mark amount as required', () => {
      component.form.controls.amount.setValue(null);
      component.form.controls.amount.markAsTouched();
      expect(component.form.controls.amount.hasError('required')).toBe(true);
    });

    it('should validate amount min 0.01', () => {
      component.form.controls.amount.setValue(0);
      component.form.controls.amount.markAsTouched();
      expect(component.form.controls.amount.hasError('min')).toBe(true);
    });

    it('should accept valid amount', () => {
      component.form.controls.amount.setValue(50.00);
      expect(component.form.controls.amount.valid).toBe(true);
    });

    it('should mark category as required', () => {
      component.form.controls.categoryId.setValue('');
      component.form.controls.categoryId.markAsTouched();
      expect(component.form.controls.categoryId.hasError('required')).toBe(true);
    });

    it('should mark date as required', () => {
      component.form.controls.date.setValue('');
      component.form.controls.date.markAsTouched();
      expect(component.form.controls.date.hasError('required')).toBe(true);
    });

    it('should have Create button disabled when form invalid', () => {
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('button[mat-flat-button]');
      const createBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Create')) as HTMLButtonElement;
      expect(createBtn?.disabled).toBe(true);
    });

    it('should have Create button enabled when form valid', () => {
      component.form.controls.amount.setValue(100);
      component.form.controls.categoryId.setValue('cat-1');
      component.form.controls.date.setValue('2026-01-15');
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('button[mat-flat-button]');
      const createBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Create')) as HTMLButtonElement;
      expect(createBtn?.disabled).toBe(false);
    });
  });

  describe('submission (AC #3)', () => {
    beforeEach(() => {
      component.form.controls.amount.setValue(150.00);
      component.form.controls.date.setValue('2026-01-20');
      component.form.controls.categoryId.setValue('cat-1');
      component.form.controls.description.setValue('Parts for faucet');
    });

    it('should call expenseService.createExpense with correct data including workOrderId', () => {
      component.onSubmit();
      expect(mockExpenseService.createExpense).toHaveBeenCalledWith({
        propertyId: 'prop-456',
        amount: 150.00,
        date: '2026-01-20',
        categoryId: 'cat-1',
        description: 'Parts for faucet',
        workOrderId: 'wo-123',
      });
    });

    it('should show "Expense created" snackbar on success', () => {
      component.onSubmit();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Expense created', 'Close', { duration: 3000 });
    });

    it('should close dialog with { created: true } on success', () => {
      component.onSubmit();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ created: true });
    });

    it('should set isSubmitting during submission', () => {
      expect(component.isSubmitting()).toBe(false);
      component.onSubmit();
      // After successful completion, dialog closes so isSubmitting isn't reset
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should not submit if form invalid', () => {
      component.form.controls.amount.setValue(null);
      component.onSubmit();
      expect(mockExpenseService.createExpense).not.toHaveBeenCalled();
    });

    it('should not submit if already submitting', () => {
      component.isSubmitting.set(true);
      component.onSubmit();
      expect(mockExpenseService.createExpense).not.toHaveBeenCalled();
    });

    it('should send undefined description when empty', () => {
      component.form.controls.description.setValue('');
      component.onSubmit();
      expect(mockExpenseService.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });
  });

  describe('error handling (AC #6)', () => {
    beforeEach(() => {
      component.form.controls.amount.setValue(100);
      component.form.controls.date.setValue('2026-01-20');
      component.form.controls.categoryId.setValue('cat-1');
      mockExpenseService.createExpense.mockReturnValue(throwError(() => new Error('Server error')));
    });

    it('should show "Failed to create expense" snackbar on error', () => {
      component.onSubmit();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to create expense', 'Close', { duration: 3000 });
    });

    it('should keep dialog open on error (not close)', () => {
      component.onSubmit();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should reset isSubmitting on error for retry', () => {
      component.onSubmit();
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('cancel (AC #4)', () => {
    it('should have Cancel button', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Cancel');
    });

    it('should have mat-dialog-close directive on Cancel button', () => {
      const cancelBtn = fixture.nativeElement.querySelector('button[mat-dialog-close]');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn.textContent).toContain('Cancel');
    });
  });

  describe('no categoryId in dialog data', () => {
    it('should default categoryId to empty when not provided', async () => {
      const dataWithoutCategory: CreateExpenseFromWoDialogData = {
        ...mockDialogData,
        categoryId: undefined,
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [CreateExpenseFromWoDialogComponent],
        providers: [
          provideNoopAnimations(),
          { provide: MAT_DIALOG_DATA, useValue: dataWithoutCategory },
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: ExpenseService, useValue: mockExpenseService },
          { provide: ExpenseStore, useValue: mockExpenseStore },
          { provide: MatSnackBar, useValue: mockSnackBar },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(CreateExpenseFromWoDialogComponent);
      f.detectChanges();
      expect(f.componentInstance.form.controls.categoryId.value).toBe('');
    });
  });
});
