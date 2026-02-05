import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IncomeStore } from './income.store';
import {
  IncomeService,
  IncomeDto,
  IncomeListResponse,
  CreateIncomeResponse,
} from '../services/income.service';

describe('IncomeStore', () => {
  let store: InstanceType<typeof IncomeStore>;
  let incomeServiceMock: {
    getIncomeByProperty: ReturnType<typeof vi.fn>;
    createIncome: ReturnType<typeof vi.fn>;
    updateIncome: ReturnType<typeof vi.fn>;
    deleteIncome: ReturnType<typeof vi.fn>;
  };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };

  const mockIncome: IncomeDto = {
    id: 'inc-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    amount: 1500.0,
    date: '2025-01-15',
    source: 'Tenant 1',
    description: 'January rent',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const mockIncomeListResponse: IncomeListResponse = {
    items: [mockIncome],
    totalCount: 1,
    ytdTotal: 1500.0,
  };

  const mockCreateResponse: CreateIncomeResponse = {
    id: 'new-inc-1',
  };

  beforeEach(() => {
    incomeServiceMock = {
      getIncomeByProperty: vi.fn().mockReturnValue(of(mockIncomeListResponse)),
      createIncome: vi.fn().mockReturnValue(of(mockCreateResponse)),
      updateIncome: vi.fn().mockReturnValue(of(undefined)),
      deleteIncome: vi.fn().mockReturnValue(of(undefined)),
    };
    snackBarMock = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        IncomeStore,
        { provide: IncomeService, useValue: incomeServiceMock },
        { provide: MatSnackBar, useValue: snackBarMock },
      ],
    });

    store = TestBed.inject(IncomeStore);
  });

  describe('initial state', () => {
    it('should have empty income entries', () => {
      expect(store.incomeEntries()).toEqual([]);
    });

    it('should have null currentPropertyId', () => {
      expect(store.currentPropertyId()).toBeNull();
    });

    it('should have null currentPropertyName', () => {
      expect(store.currentPropertyName()).toBeNull();
    });

    it('should have zero ytdTotal', () => {
      expect(store.ytdTotal()).toBe(0);
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should not be saving', () => {
      expect(store.isSaving()).toBe(false);
    });

    it('should not be updating', () => {
      expect(store.isUpdating()).toBe(false);
    });

    it('should not be deleting', () => {
      expect(store.isDeleting()).toBe(false);
    });

    it('should have no editing income id', () => {
      expect(store.editingIncomeId()).toBeNull();
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('hasIncome should be false when empty', () => {
      expect(store.hasIncome()).toBe(false);
    });

    it('hasIncome should be true when income loaded', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.hasIncome()).toBe(true);
    });

    it('isEmpty should be true when no income', () => {
      incomeServiceMock.getIncomeByProperty.mockReturnValue(of({
        items: [],
        totalCount: 0,
        ytdTotal: 0,
      }));
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.isEmpty()).toBe(true);
    });

    it('incomeCount should return correct count', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.incomeCount()).toBe(1);
    });

    it('isEditing should be false when no editing income', () => {
      expect(store.isEditing()).toBe(false);
    });

    it('isEditing should be true when editing income id set', () => {
      store.setEditingIncome('inc-1');
      expect(store.isEditing()).toBe(true);
    });

    it('incomeForCurrentProperty should filter by property id', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.incomeForCurrentProperty()).toEqual([mockIncome]);
    });
  });

  describe('loadIncomeByProperty', () => {
    it('should call service with property id and year', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
        year: 2025,
      });
      expect(incomeServiceMock.getIncomeByProperty).toHaveBeenCalledWith('prop-1', 2025);
    });

    it('should update income entries', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.incomeEntries()).toEqual([mockIncome]);
    });

    it('should update ytdTotal', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.ytdTotal()).toBe(1500.0);
    });

    it('should set current property id and name', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.currentPropertyId()).toBe('prop-1');
      expect(store.currentPropertyName()).toBe('Test Property');
    });

    it('should handle 404 error', () => {
      incomeServiceMock.getIncomeByProperty.mockReturnValue(throwError(() => ({ status: 404 })));
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.error()).toBe('Property not found');
    });

    it('should handle other errors', () => {
      incomeServiceMock.getIncomeByProperty.mockReturnValue(throwError(() => ({ status: 500 })));
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.error()).toBe('Failed to load income. Please try again.');
    });
  });

  describe('createIncome', () => {
    const createRequest = {
      propertyId: 'prop-1',
      amount: 1600.0,
      date: '2025-02-01',
      source: 'Tenant 1',
      description: 'February rent',
    };

    beforeEach(() => {
      // Set up current property first
      store.setCurrentProperty('prop-1', 'Test Property');
    });

    it('should call service with request', () => {
      store.createIncome(createRequest);
      expect(incomeServiceMock.createIncome).toHaveBeenCalledWith(createRequest);
    });

    it('should prepend new income to list', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      store.createIncome(createRequest);

      const entries = store.incomeEntries();
      expect(entries.length).toBe(2);
      expect(entries[0].id).toBe('new-inc-1');
      expect(entries[0].amount).toBe(1600.0);
    });

    it('should update ytdTotal', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      store.createIncome(createRequest);

      expect(store.ytdTotal()).toBe(3100.0); // 1500 + 1600
    });

    it('should show success snackbar', () => {
      store.createIncome(createRequest);
      expect(snackBarMock.open).toHaveBeenCalledWith(
        expect.stringContaining('Income recorded'),
        'Close',
        expect.any(Object)
      );
    });

    it('should handle 400 error', () => {
      incomeServiceMock.createIncome.mockReturnValue(throwError(() => ({ status: 400 })));
      store.createIncome(createRequest);
      expect(store.error()).toBe('Invalid income data. Please check your input.');
    });

    it('should handle 404 error', () => {
      incomeServiceMock.createIncome.mockReturnValue(throwError(() => ({ status: 404 })));
      store.createIncome(createRequest);
      expect(store.error()).toBe('Property not found.');
    });
  });

  describe('updateIncome', () => {
    const updateRequest = {
      amount: 1700.0,
      date: '2025-01-20',
      source: 'Tenant 1',
      description: 'Updated rent',
    };

    beforeEach(() => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
    });

    it('should call service with id and request', () => {
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });
      expect(incomeServiceMock.updateIncome).toHaveBeenCalledWith('inc-1', updateRequest);
    });

    it('should update income in list', () => {
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });

      const entry = store.incomeEntries()[0];
      expect(entry.amount).toBe(1700.0);
      expect(entry.date).toBe('2025-01-20');
      expect(entry.description).toBe('Updated rent');
    });

    it('should update ytdTotal with difference', () => {
      // Original: 1500, Updated: 1700, Diff: +200
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });
      expect(store.ytdTotal()).toBe(1700.0);
    });

    it('should clear editing income id', () => {
      store.setEditingIncome('inc-1');
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });
      expect(store.editingIncomeId()).toBeNull();
    });

    it('should show success snackbar', () => {
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });
      expect(snackBarMock.open).toHaveBeenCalledWith(
        expect.stringContaining('Income updated'),
        'Close',
        expect.any(Object)
      );
    });

    it('should handle 404 error', () => {
      incomeServiceMock.updateIncome.mockReturnValue(throwError(() => ({ status: 404 })));
      store.updateIncome({ incomeId: 'inc-1', request: updateRequest });
      expect(store.error()).toBe('Income not found.');
    });
  });

  describe('deleteIncome', () => {
    beforeEach(() => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
    });

    it('should call service with id', () => {
      store.deleteIncome('inc-1');
      expect(incomeServiceMock.deleteIncome).toHaveBeenCalledWith('inc-1');
    });

    it('should remove income from list', () => {
      store.deleteIncome('inc-1');
      expect(store.incomeEntries()).toEqual([]);
    });

    it('should update ytdTotal', () => {
      // Original: 1500, After delete: 0
      store.deleteIncome('inc-1');
      expect(store.ytdTotal()).toBe(0);
    });

    it('should show success snackbar', () => {
      store.deleteIncome('inc-1');
      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Income deleted',
        'Close',
        expect.any(Object)
      );
    });

    it('should handle 404 error', () => {
      incomeServiceMock.deleteIncome.mockReturnValue(throwError(() => ({ status: 404 })));
      store.deleteIncome('inc-1');
      expect(store.error()).toBe('Income not found.');
    });
  });

  describe('setEditingIncome', () => {
    it('should set editing income id', () => {
      store.setEditingIncome('inc-1');
      expect(store.editingIncomeId()).toBe('inc-1');
    });
  });

  describe('cancelEditing', () => {
    it('should clear editing income id', () => {
      store.setEditingIncome('inc-1');
      store.cancelEditing();
      expect(store.editingIncomeId()).toBeNull();
    });
  });

  describe('setCurrentProperty', () => {
    it('should set current property id and name', () => {
      store.setCurrentProperty('prop-2', 'Another Property');
      expect(store.currentPropertyId()).toBe('prop-2');
      expect(store.currentPropertyName()).toBe('Another Property');
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      incomeServiceMock.getIncomeByProperty.mockReturnValue(throwError(() => new Error('Error')));
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      expect(store.error()).not.toBeNull();

      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      store.loadIncomeByProperty({
        propertyId: 'prop-1',
        propertyName: 'Test Property',
      });
      store.setEditingIncome('inc-1');

      store.reset();

      expect(store.incomeEntries()).toEqual([]);
      expect(store.currentPropertyId()).toBeNull();
      expect(store.currentPropertyName()).toBeNull();
      expect(store.ytdTotal()).toBe(0);
      expect(store.editingIncomeId()).toBeNull();
      expect(store.error()).toBeNull();
    });
  });
});
