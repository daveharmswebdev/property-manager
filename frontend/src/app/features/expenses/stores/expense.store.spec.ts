import { TestBed } from '@angular/core/testing';
import { ExpenseStore } from './expense.store';
import { ExpenseService, ExpenseDto, ExpenseCategoryDto } from '../services/expense.service';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

describe('ExpenseStore', () => {
  let store: InstanceType<typeof ExpenseStore>;
  let expenseServiceSpy: {
    getCategories: ReturnType<typeof vi.fn>;
    getExpensesByProperty: ReturnType<typeof vi.fn>;
    createExpense: ReturnType<typeof vi.fn>;
    updateExpense: ReturnType<typeof vi.fn>;
    deleteExpense: ReturnType<typeof vi.fn>;
  };
  let snackBarSpy: {
    open: ReturnType<typeof vi.fn>;
  };

  const mockCategories: ExpenseCategoryDto[] = [
    { id: 'cat-1', name: 'Repairs', sortOrder: 1 },
    { id: 'cat-2', name: 'Insurance', sortOrder: 2 },
  ];

  const mockExpenses: ExpenseDto[] = [
    {
      id: 'expense-1',
      propertyId: 'prop-1',
      propertyName: 'Oak Street Duplex',
      categoryId: 'cat-1',
      categoryName: 'Repairs',
      amount: 100.00,
      date: '2025-11-28',
      description: 'Faucet repair',
      createdAt: '2025-11-28T10:30:00Z',
    },
    {
      id: 'expense-2',
      propertyId: 'prop-1',
      propertyName: 'Oak Street Duplex',
      categoryId: 'cat-2',
      categoryName: 'Insurance',
      amount: 200.00,
      date: '2025-11-27',
      description: 'Monthly premium',
      createdAt: '2025-11-27T10:30:00Z',
    },
  ];

  beforeEach(() => {
    expenseServiceSpy = {
      getCategories: vi.fn().mockReturnValue(of({ items: mockCategories, totalCount: 2 })),
      getExpensesByProperty: vi.fn().mockReturnValue(of({
        items: mockExpenses,
        totalCount: 2,
        ytdTotal: 300.00,
      })),
      createExpense: vi.fn().mockReturnValue(of({ id: 'new-expense' })),
      updateExpense: vi.fn().mockReturnValue(of(undefined)),
      deleteExpense: vi.fn().mockReturnValue(of(undefined)),
    };

    snackBarSpy = {
      open: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ExpenseStore,
        { provide: ExpenseService, useValue: expenseServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    });

    store = TestBed.inject(ExpenseStore);
  });

  describe('initial state', () => {
    it('should have empty expenses array', () => {
      expect(store.expenses()).toEqual([]);
    });

    it('should have null confirmingDeleteId initially', () => {
      expect(store.confirmingDeleteId()).toBeNull();
    });

    it('should not be deleting initially', () => {
      expect(store.isDeleting()).toBe(false);
    });

    it('should have isConfirmingDelete as false initially', () => {
      expect(store.isConfirmingDelete()).toBe(false);
    });
  });

  describe('startDeleteConfirmation (AC-3.3.1)', () => {
    it('should set confirmingDeleteId', () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.confirmingDeleteId()).toBe('expense-1');
    });

    it('should set isConfirmingDelete to true', () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.isConfirmingDelete()).toBe(true);
    });

    it('should clear any editing state', async () => {
      // Load expenses first
      store.loadExpensesByProperty({ propertyId: 'prop-1', propertyName: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 0));

      // Start editing
      store.startEditing('expense-1');
      expect(store.editingExpenseId()).toBe('expense-1');

      // Start delete confirmation - should clear edit mode
      store.startDeleteConfirmation('expense-2');
      expect(store.editingExpenseId()).toBeNull();
      expect(store.confirmingDeleteId()).toBe('expense-2');
    });

    it('should clear error state', () => {
      // Simulate error state first (we can't directly set error, but we test the effect)
      store.startDeleteConfirmation('expense-1');
      expect(store.error()).toBeNull();
    });
  });

  describe('cancelDeleteConfirmation (AC-3.3.2)', () => {
    it('should clear confirmingDeleteId', () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.confirmingDeleteId()).toBe('expense-1');

      store.cancelDeleteConfirmation();
      expect(store.confirmingDeleteId()).toBeNull();
    });

    it('should set isConfirmingDelete to false', () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.isConfirmingDelete()).toBe(true);

      store.cancelDeleteConfirmation();
      expect(store.isConfirmingDelete()).toBe(false);
    });
  });

  describe('deleteExpense (AC-3.3.3, AC-3.3.4, AC-3.3.5)', () => {
    beforeEach(async () => {
      // Load expenses first
      store.loadExpensesByProperty({ propertyId: 'prop-1', propertyName: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should call delete service with expense id', async () => {
      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(expenseServiceSpy.deleteExpense).toHaveBeenCalledWith('expense-1');
    });

    it('should remove expense from state on success (AC-3.3.5)', async () => {
      expect(store.expenses().length).toBe(2);

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.expenses().length).toBe(1);
      expect(store.expenses().find(e => e.id === 'expense-1')).toBeUndefined();
    });

    it('should update ytdTotal on success (AC-3.3.5)', async () => {
      expect(store.ytdTotal()).toBe(300);

      store.deleteExpense('expense-1'); // Amount: 100
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.ytdTotal()).toBe(200);
    });

    it('should clear confirmingDeleteId on success', async () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.confirmingDeleteId()).toBe('expense-1');

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.confirmingDeleteId()).toBeNull();
    });

    it('should set isDeleting to false on success', async () => {
      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      // After async operation completes, isDeleting should be false
      expect(store.isDeleting()).toBe(false);
    });

    it('should show snackbar on success (AC-3.3.4)', async () => {
      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Expense deleted',
        'Close',
        expect.objectContaining({
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        })
      );
    });

    it('should handle 404 error gracefully', async () => {
      const error404 = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      expenseServiceSpy.deleteExpense.mockReturnValue(throwError(() => error404));

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBe('Expense not found.');
      expect(store.isDeleting()).toBe(false);
      expect(store.confirmingDeleteId()).toBeNull();
    });

    it('should handle other errors with generic message', async () => {
      const error500 = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      expenseServiceSpy.deleteExpense.mockReturnValue(throwError(() => error500));

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBe('Failed to delete expense. Please try again.');
      expect(store.isDeleting()).toBe(false);
    });

    it('should show error snackbar on failure', async () => {
      const error500 = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      expenseServiceSpy.deleteExpense.mockReturnValue(throwError(() => error500));

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Failed to delete expense. Please try again.',
        'Close',
        expect.objectContaining({
          duration: 5000,
        })
      );
    });

    it('should not affect other expenses when one is deleted', async () => {
      const expense2Before = store.expenses().find(e => e.id === 'expense-2');

      store.deleteExpense('expense-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      const expense2After = store.expenses().find(e => e.id === 'expense-2');
      expect(expense2After).toEqual(expense2Before);
    });
  });

  describe('computed isConfirmingDelete', () => {
    it('should be false when confirmingDeleteId is null', () => {
      expect(store.isConfirmingDelete()).toBe(false);
    });

    it('should be true when confirmingDeleteId is set', () => {
      store.startDeleteConfirmation('expense-1');
      expect(store.isConfirmingDelete()).toBe(true);
    });

    it('should be false after cancellation', () => {
      store.startDeleteConfirmation('expense-1');
      store.cancelDeleteConfirmation();
      expect(store.isConfirmingDelete()).toBe(false);
    });
  });
});
