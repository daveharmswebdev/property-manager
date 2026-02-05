import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LinkExpenseDialogComponent, LinkExpenseDialogData } from './link-expense-dialog.component';
import { ExpenseService, ExpenseDto } from '../../../expenses/services/expense.service';

describe('LinkExpenseDialogComponent', () => {
  let component: LinkExpenseDialogComponent;
  let fixture: ComponentFixture<LinkExpenseDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockExpenseService: {
    getExpensesByProperty: ReturnType<typeof vi.fn>;
  };

  const dialogData: LinkExpenseDialogData = {
    propertyId: 'prop-1',
    workOrderId: 'wo-1',
  };

  const mockExpenses: ExpenseDto[] = [
    {
      id: 'exp-1', propertyId: 'prop-1', propertyName: 'Test', categoryId: 'cat-1',
      categoryName: 'Repairs', amount: 125.50, date: '2026-01-15',
      description: 'Faucet parts', createdAt: '2026-01-15', workOrderId: undefined,
    },
    {
      id: 'exp-2', propertyId: 'prop-1', propertyName: 'Test', categoryId: 'cat-2',
      categoryName: 'Supplies', amount: 45.00, date: '2026-01-10',
      description: 'Pipe fittings', createdAt: '2026-01-10', workOrderId: undefined,
    },
    {
      id: 'exp-3', propertyId: 'prop-1', propertyName: 'Test', categoryId: 'cat-1',
      categoryName: 'Repairs', amount: 200.00, date: '2026-01-05',
      description: 'Already linked', createdAt: '2026-01-05', workOrderId: 'wo-other',
    },
  ];

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    mockExpenseService = {
      getExpensesByProperty: vi.fn().mockReturnValue(of({
        items: mockExpenses,
        totalCount: 3,
        page: 1,
        pageSize: 500,
        totalPages: 1,
        ytdTotal: 370.50,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [LinkExpenseDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: ExpenseService, useValue: mockExpenseService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkExpenseDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load expenses for property on init', () => {
    fixture.detectChanges();
    expect(mockExpenseService.getExpensesByProperty).toHaveBeenCalledWith('prop-1', undefined, 1, 500);
  });

  it('should filter out already-linked expenses', () => {
    fixture.detectChanges();
    // exp-3 has workOrderId='wo-other', should be filtered out
    expect(component.unlinkedExpenses().length).toBe(2);
    expect(component.unlinkedExpenses().find(e => e.id === 'exp-3')).toBeUndefined();
  });

  it('should display unlinked expenses', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Faucet parts');
    expect(compiled.textContent).toContain('Pipe fittings');
    expect(compiled.textContent).not.toContain('Already linked');
  });

  it('should filter expenses by search term', () => {
    fixture.detectChanges();

    component.searchTerm.set('faucet');
    expect(component.filteredExpenses().length).toBe(1);
    expect(component.filteredExpenses()[0].id).toBe('exp-1');
  });

  it('should be case-insensitive search', () => {
    fixture.detectChanges();

    component.searchTerm.set('PIPE');
    expect(component.filteredExpenses().length).toBe(1);
    expect(component.filteredExpenses()[0].id).toBe('exp-2');
  });

  it('should show all unlinked expenses when search is empty', () => {
    fixture.detectChanges();

    component.searchTerm.set('');
    expect(component.filteredExpenses().length).toBe(2);
  });

  it('should close dialog with expense ID on selection', () => {
    fixture.detectChanges();

    component.selectExpense('exp-1');
    expect(mockDialogRef.close).toHaveBeenCalledWith('exp-1');
  });

  it('should show empty state when no unlinked expenses', () => {
    mockExpenseService.getExpensesByProperty.mockReturnValue(of({
      items: [{ ...mockExpenses[2] }], // Only linked expense
      totalCount: 1,
      page: 1,
      pageSize: 500,
      totalPages: 1,
      ytdTotal: 200,
    }));

    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('No unlinked expenses available for this property');
  });

  it('should have a cancel button', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Cancel');
  });

  it('should sort expenses by date newest first', () => {
    fixture.detectChanges();

    const expenses = component.unlinkedExpenses();
    expect(expenses[0].id).toBe('exp-1'); // Jan 15
    expect(expenses[1].id).toBe('exp-2'); // Jan 10
  });
});
