import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ExpenseService,
  CreateExpenseRequest,
  CreateExpenseResponse,
  ExpenseCategoriesResponse,
  ExpenseCategoryDto,
  ExpenseDto,
  PagedExpenseListResponse,
  UpdateExpenseRequest,
  DuplicateCheckResult,
  ExpenseFilters,
  PagedResult,
  ExpenseListItemDto
} from './expense.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let httpMock: HttpTestingController;

  const mockCategory: ExpenseCategoryDto = {
    id: 'cat-1',
    name: 'Repairs',
    scheduleELine: 'Line 14',
    sortOrder: 1,
    parentId: undefined
  };

  const mockExpense: ExpenseDto = {
    id: 'exp-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    categoryId: 'cat-1',
    categoryName: 'Repairs',
    scheduleELine: 'Line 14',
    amount: 150.50,
    date: '2024-03-15',
    description: 'Fixed faucet',
    receiptId: 'receipt-1',
    createdAt: '2024-03-15T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createExpense', () => {
    it('should create an expense and return the ID', () => {
      const request: CreateExpenseRequest = {
        propertyId: 'prop-1',
        amount: 150.50,
        date: '2024-03-15',
        categoryId: 'cat-1',
        description: 'Fixed faucet'
      };
      const mockResponse: CreateExpenseResponse = { id: 'new-exp-id' };

      service.createExpense(request).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/v1/expenses');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });

    it('should create an expense without optional description', () => {
      const request: CreateExpenseRequest = {
        propertyId: 'prop-1',
        amount: 100,
        date: '2024-03-20',
        categoryId: 'cat-2'
      };
      const mockResponse: CreateExpenseResponse = { id: 'exp-no-desc' };

      service.createExpense(request).subscribe(response => {
        expect(response.id).toBe('exp-no-desc');
      });

      const req = httpMock.expectOne('/api/v1/expenses');
      expect(req.request.body.description).toBeUndefined();
      req.flush(mockResponse);
    });
  });

  describe('getCategories', () => {
    it('should get all expense categories', () => {
      const mockResponse: ExpenseCategoriesResponse = {
        items: [mockCategory, { ...mockCategory, id: 'cat-2', name: 'Insurance' }],
        totalCount: 2
      };

      service.getCategories().subscribe(response => {
        expect(response.items).toHaveLength(2);
        expect(response.items[0].name).toBe('Repairs');
      });

      const req = httpMock.expectOne('/api/v1/expense-categories');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('getExpensesByProperty', () => {
    it('should get expenses for a property with default pagination', () => {
      const mockResponse: PagedExpenseListResponse = {
        items: [mockExpense],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        ytdTotal: 150.50
      };

      service.getExpensesByProperty('prop-1').subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.ytdTotal).toBe(150.50);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/expenses');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('25');
      req.flush(mockResponse);
    });

    it('should filter expenses by year', () => {
      const mockResponse: PagedExpenseListResponse = {
        items: [mockExpense],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        ytdTotal: 150.50
      };

      service.getExpensesByProperty('prop-1', 2024).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/expenses');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });

    it('should support custom pagination', () => {
      const mockResponse: PagedExpenseListResponse = {
        items: [],
        totalCount: 0,
        page: 2,
        pageSize: 10,
        totalPages: 0,
        ytdTotal: 0
      };

      service.getExpensesByProperty('prop-1', undefined, 2, 10).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/properties/prop-1/expenses');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('10');
      req.flush(mockResponse);
    });
  });

  describe('getExpense', () => {
    it('should get a single expense by ID', () => {
      service.getExpense('exp-1').subscribe(response => {
        expect(response.id).toBe('exp-1');
        expect(response.amount).toBe(150.50);
      });

      const req = httpMock.expectOne('/api/v1/expenses/exp-1');
      expect(req.request.method).toBe('GET');
      req.flush(mockExpense);
    });
  });

  describe('updateExpense', () => {
    it('should update an expense', () => {
      const request: UpdateExpenseRequest = {
        amount: 200,
        date: '2024-03-16',
        categoryId: 'cat-2',
        description: 'Updated description'
      };

      service.updateExpense('exp-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/expenses/exp-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });

    it('should update expense without optional description', () => {
      const request: UpdateExpenseRequest = {
        amount: 200,
        date: '2024-03-16',
        categoryId: 'cat-2'
      };

      service.updateExpense('exp-1', request).subscribe();

      const req = httpMock.expectOne('/api/v1/expenses/exp-1');
      expect(req.request.body.description).toBeUndefined();
      req.flush(null);
    });
  });

  describe('deleteExpense', () => {
    it('should delete an expense', () => {
      service.deleteExpense('exp-1').subscribe();

      const req = httpMock.expectOne('/api/v1/expenses/exp-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('checkDuplicateExpense', () => {
    it('should check for duplicate and return false when no duplicate', () => {
      const mockResponse: DuplicateCheckResult = {
        isDuplicate: false
      };

      service.checkDuplicateExpense('prop-1', 150.50, '2024-03-15').subscribe(response => {
        expect(response.isDuplicate).toBe(false);
        expect(response.existingExpense).toBeUndefined();
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses/check-duplicate');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('propertyId')).toBe('prop-1');
      expect(req.request.params.get('amount')).toBe('150.5');
      expect(req.request.params.get('date')).toBe('2024-03-15');
      req.flush(mockResponse);
    });

    it('should return existing expense when duplicate found', () => {
      const mockResponse: DuplicateCheckResult = {
        isDuplicate: true,
        existingExpense: {
          id: 'existing-exp',
          date: '2024-03-15',
          amount: 150.50,
          description: 'Same expense'
        }
      };

      service.checkDuplicateExpense('prop-1', 150.50, '2024-03-15').subscribe(response => {
        expect(response.isDuplicate).toBe(true);
        expect(response.existingExpense?.id).toBe('existing-exp');
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses/check-duplicate');
      req.flush(mockResponse);
    });
  });

  describe('getExpenses', () => {
    it('should get all expenses with minimal filters', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [mockExpense as ExpenseListItemDto],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1
      };

      service.getExpenses(filters).subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.totalCount).toBe(1);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('25');
      req.flush(mockResponse);
    });

    it('should filter expenses by date range', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.get('dateFrom')).toBe('2024-01-01');
      expect(req.request.params.get('dateTo')).toBe('2024-12-31');
      req.flush(mockResponse);
    });

    it('should filter expenses by category IDs', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        categoryIds: ['cat-1', 'cat-2']
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.getAll('categoryIds')).toEqual(['cat-1', 'cat-2']);
      req.flush(mockResponse);
    });

    it('should filter expenses by search term', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        search: 'faucet'
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.get('search')).toBe('faucet');
      req.flush(mockResponse);
    });

    it('should filter expenses by year', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        year: 2024
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.get('year')).toBe('2024');
      req.flush(mockResponse);
    });

    it('should trim search term and ignore whitespace-only search', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        search: '   '
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(mockResponse);
    });

    it('should not include empty categoryIds array', () => {
      const filters: ExpenseFilters = {
        page: 1,
        pageSize: 25,
        categoryIds: []
      };
      const mockResponse: PagedResult<ExpenseListItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0
      };

      service.getExpenses(filters).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/v1/expenses');
      expect(req.request.params.has('categoryIds')).toBe(false);
      req.flush(mockResponse);
    });
  });
});
