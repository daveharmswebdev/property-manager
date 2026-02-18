import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseDetailComponent } from './expense-detail.component';
import { ExpenseDetailStore } from '../stores/expense-detail.store';
import { ExpenseStore } from '../stores/expense.store';
import { signal } from '@angular/core';

describe('ExpenseDetailComponent', () => {
  let component: ExpenseDetailComponent;
  let fixture: ComponentFixture<ExpenseDetailComponent>;

  const mockExpense = {
    id: 'exp-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    categoryId: 'cat-1',
    categoryName: 'Repairs',
    scheduleELine: 'Line 14',
    amount: 250.0,
    date: '2026-01-15',
    description: 'Test expense description',
    receiptId: undefined as string | undefined,
    workOrderId: undefined as string | undefined,
    createdAt: '2026-01-15T10:00:00Z',
  };

  const mockDetailStore = {
    expense: signal(mockExpense),
    isLoading: signal(false),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isUnlinkingReceipt: signal(false),
    isEditing: signal(false),
    isViewMode: signal(true),
    hasReceipt: signal(false),
    hasWorkOrder: signal(false),
    error: signal(null),
    loadExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    unlinkReceipt: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    reset: vi.fn(),
  };

  const mockExpenseStore = {
    sortedCategories: signal([
      { id: 'cat-1', name: 'Repairs', scheduleELine: 'Line 14', sortOrder: 1 },
      { id: 'cat-2', name: 'Utilities', scheduleELine: 'Line 17', sortOrder: 2 },
    ]),
    loadCategories: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: ExpenseDetailStore, useValue: mockDetailStore },
        { provide: ExpenseStore, useValue: mockExpenseStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'exp-1' } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load expense on init', () => {
    expect(mockDetailStore.loadExpense).toHaveBeenCalledWith('exp-1');
  });

  it('should display expense details in view mode', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="expense-amount"]').textContent).toContain('$250.00');
    expect(el.querySelector('[data-testid="expense-category"]').textContent).toContain('Repairs');
    expect(el.querySelector('[data-testid="expense-description"]').textContent).toContain('Test expense description');
    expect(el.querySelector('[data-testid="expense-property"]').textContent).toContain('Test Property');
  });

  it('should show Edit and Delete buttons in view mode', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b: any) => b.textContent.trim());
    expect(buttonTexts.some((t: string) => t.includes('Edit'))).toBe(true);
    expect(buttonTexts.some((t: string) => t.includes('Delete'))).toBe(true);
  });

  it('should show "No receipt" when no receipt linked', () => {
    expect(fixture.nativeElement.textContent).toContain('No receipt');
  });

  it('should show "No work order" when no work order linked', () => {
    expect(fixture.nativeElement.textContent).toContain('No work order');
  });

  it('should call reset on destroy', () => {
    fixture.destroy();
    expect(mockDetailStore.reset).toHaveBeenCalled();
  });
});
