import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseDetailStore } from './expense-detail.store';
import { ExpenseDto } from '../services/expense.service';

describe('ExpenseDetailStore', () => {
  let store: InstanceType<typeof ExpenseDetailStore>;
  let httpTesting: HttpTestingController;
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };

  const mockExpense: ExpenseDto = {
    id: 'exp-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    categoryId: 'cat-1',
    categoryName: 'Repairs',
    scheduleELine: 'Line 14',
    amount: 250.0,
    date: '2026-01-15',
    description: 'Test expense',
    receiptId: undefined,
    workOrderId: undefined,
    createdAt: '2026-01-15T10:00:00Z',
  };

  beforeEach(() => {
    snackBarSpy = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: snackBarSpy },
        ExpenseDetailStore,
      ],
    });

    store = TestBed.inject(ExpenseDetailStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should have initial state', () => {
    expect(store.expense()).toBeNull();
    expect(store.isLoading()).toBe(false);
    expect(store.isEditing()).toBe(false);
    expect(store.isUpdating()).toBe(false);
    expect(store.isDeleting()).toBe(false);
    expect(store.isUnlinkingReceipt()).toBe(false);
    expect(store.error()).toBeNull();
  });

  describe('loadExpense', () => {
    it('should load expense and update state', () => {
      store.loadExpense('exp-1');
      expect(store.isLoading()).toBe(true);

      const req = httpTesting.expectOne('/api/v1/expenses/exp-1');
      req.flush(mockExpense);

      expect(store.expense()).toEqual(mockExpense);
      expect(store.isLoading()).toBe(false);
    });

    it('should handle 404 error', () => {
      store.loadExpense('exp-999');
      expect(store.isLoading()).toBe(true);

      const req = httpTesting.expectOne('/api/v1/expenses/exp-999');
      req.flush(null, { status: 404, statusText: 'Not Found' });

      expect(store.expense()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe('Expense not found.');
    });
  });

  describe('computed signals', () => {
    it('hasReceipt should be true when receiptId exists', () => {
      store.loadExpense('exp-1');
      const req = httpTesting.expectOne('/api/v1/expenses/exp-1');
      req.flush({ ...mockExpense, receiptId: 'rcpt-1' });

      expect(store.hasReceipt()).toBe(true);
    });

    it('hasReceipt should be false when no receiptId', () => {
      store.loadExpense('exp-1');
      const req = httpTesting.expectOne('/api/v1/expenses/exp-1');
      req.flush(mockExpense);

      expect(store.hasReceipt()).toBe(false);
    });

    it('isViewMode should be true when not editing', () => {
      expect(store.isViewMode()).toBe(true);
    });

    it('isViewMode should be false when editing', () => {
      store.startEditing();
      expect(store.isViewMode()).toBe(false);
    });
  });

  describe('edit mode', () => {
    it('should toggle editing state', () => {
      expect(store.isEditing()).toBe(false);
      store.startEditing();
      expect(store.isEditing()).toBe(true);
      store.cancelEditing();
      expect(store.isEditing()).toBe(false);
    });
  });

  describe('updateExpense', () => {
    it('should update expense and exit edit mode', () => {
      // Load expense first
      store.loadExpense('exp-1');
      httpTesting.expectOne('/api/v1/expenses/exp-1').flush(mockExpense);

      store.startEditing();

      const updateRequest = {
        amount: 450,
        date: '2026-01-15',
        categoryId: 'cat-1',
        description: 'Updated',
      };

      store.updateExpense({ expenseId: 'exp-1', request: updateRequest });
      expect(store.isUpdating()).toBe(true);

      // PUT request
      const putReq = httpTesting.expectOne({ method: 'PUT', url: '/api/v1/expenses/exp-1' });
      putReq.flush(null, { status: 204, statusText: 'No Content' });

      // Reload GET request
      const getReq = httpTesting.expectOne('/api/v1/expenses/exp-1');
      getReq.flush({ ...mockExpense, amount: 450, description: 'Updated' });

      expect(store.isUpdating()).toBe(false);
      expect(store.isEditing()).toBe(false);
      expect(store.expense()?.amount).toBe(450);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Expense updated \u2713',
        'Close',
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  describe('deleteExpense', () => {
    it('should delete expense and show snackbar', () => {
      store.deleteExpense('exp-1');
      expect(store.isDeleting()).toBe(true);

      const req = httpTesting.expectOne({ method: 'DELETE', url: '/api/v1/expenses/exp-1' });
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.isDeleting()).toBe(false);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Expense deleted',
        'Close',
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  describe('unlinkReceipt', () => {
    it('should unlink receipt and reload expense', () => {
      store.unlinkReceipt('exp-1');
      expect(store.isUnlinkingReceipt()).toBe(true);

      // DELETE receipt request
      const deleteReq = httpTesting.expectOne({
        method: 'DELETE',
        url: '/api/v1/expenses/exp-1/receipt',
      });
      deleteReq.flush(null, { status: 204, statusText: 'No Content' });

      // Reload GET request
      const getReq = httpTesting.expectOne('/api/v1/expenses/exp-1');
      getReq.flush({ ...mockExpense, receiptId: undefined });

      expect(store.isUnlinkingReceipt()).toBe(false);
      expect(store.hasReceipt()).toBe(false);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Receipt unlinked',
        'Close',
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      store.loadExpense('exp-1');
      httpTesting.expectOne('/api/v1/expenses/exp-1').flush(mockExpense);
      store.startEditing();

      store.reset();

      expect(store.expense()).toBeNull();
      expect(store.isEditing()).toBe(false);
      expect(store.isLoading()).toBe(false);
    });
  });
});
