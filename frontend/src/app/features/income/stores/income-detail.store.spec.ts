import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { IncomeDetailStore } from './income-detail.store';
import { IncomeService, IncomeDto } from '../services/income.service';

describe('IncomeDetailStore', () => {
  let store: InstanceType<typeof IncomeDetailStore>;

  const mockIncome: IncomeDto = {
    id: 'inc-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    amount: 1500,
    date: '2026-01-15',
    source: 'Test Tenant',
    description: 'Monthly rent',
    createdAt: '2026-01-15T10:00:00Z',
  };

  const mockIncomeService = {
    getIncomeById: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockRouter = {
    navigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        IncomeDetailStore,
        { provide: IncomeService, useValue: mockIncomeService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Router, useValue: mockRouter },
      ],
    });

    store = TestBed.inject(IncomeDetailStore);
  });

  it('should have initial state', () => {
    expect(store.income()).toBeNull();
    expect(store.isLoading()).toBe(false);
    expect(store.isUpdating()).toBe(false);
    expect(store.isDeleting()).toBe(false);
    expect(store.isEditing()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.isViewMode()).toBe(true);
  });

  describe('loadIncome', () => {
    it('should load income successfully', async () => {
      mockIncomeService.getIncomeById.mockReturnValue(of(mockIncome));

      store.loadIncome('inc-1');
      await vi.waitFor(() => expect(store.income()).toEqual(mockIncome));

      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should handle 404 error', async () => {
      mockIncomeService.getIncomeById.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      store.loadIncome('bad-id');
      await vi.waitFor(() => expect(store.error()).toBe('Income not found.'));

      expect(store.isLoading()).toBe(false);
      expect(store.income()).toBeNull();
    });

    it('should handle generic error', async () => {
      mockIncomeService.getIncomeById.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.loadIncome('inc-1');
      await vi.waitFor(() =>
        expect(store.error()).toBe('Failed to load income. Please try again.')
      );
    });
  });

  describe('updateIncome', () => {
    it('should update income and re-fetch', async () => {
      const updatedIncome = { ...mockIncome, amount: 2000 };
      mockIncomeService.updateIncome.mockReturnValue(of(void 0));
      mockIncomeService.getIncomeById.mockReturnValue(of(updatedIncome));

      store.updateIncome({
        incomeId: 'inc-1',
        request: { amount: 2000, date: '2026-01-15' },
      });

      await vi.waitFor(() => expect(store.income()?.amount).toBe(2000));
      expect(store.isEditing()).toBe(false);
      expect(store.isUpdating()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Income updated'),
        'Close',
        expect.any(Object)
      );
    });

    it('should handle update error', async () => {
      mockIncomeService.updateIncome.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.updateIncome({
        incomeId: 'inc-1',
        request: { amount: 2000, date: '2026-01-15' },
      });

      await vi.waitFor(() =>
        expect(store.error()).toBe('Failed to update income. Please try again.')
      );
      expect(store.isUpdating()).toBe(false);
    });
  });

  describe('deleteIncome', () => {
    it('should delete income and navigate to /income', async () => {
      mockIncomeService.deleteIncome.mockReturnValue(of(void 0));

      store.deleteIncome('inc-1');

      await vi.waitFor(() =>
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/income'])
      );
      expect(store.isDeleting()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Income deleted',
        'Close',
        expect.any(Object)
      );
    });

    it('should handle delete error', async () => {
      mockIncomeService.deleteIncome.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.deleteIncome('inc-1');

      await vi.waitFor(() =>
        expect(store.error()).toBe('Failed to delete income. Please try again.')
      );
      expect(store.isDeleting()).toBe(false);
    });
  });

  describe('startEditing / cancelEditing', () => {
    it('should toggle editing state', () => {
      expect(store.isEditing()).toBe(false);
      expect(store.isViewMode()).toBe(true);

      store.startEditing();
      expect(store.isEditing()).toBe(true);
      expect(store.isViewMode()).toBe(false);

      store.cancelEditing();
      expect(store.isEditing()).toBe(false);
      expect(store.isViewMode()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      mockIncomeService.getIncomeById.mockReturnValue(of(mockIncome));
      store.loadIncome('inc-1');
      await vi.waitFor(() => expect(store.income()).toEqual(mockIncome));

      store.startEditing();
      expect(store.isEditing()).toBe(true);

      store.reset();
      expect(store.income()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.isEditing()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });
});
