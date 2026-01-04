import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ExpenseListRowComponent } from './expense-list-row.component';
import { ExpenseListItemDto } from '../../services/expense.service';
import { ReceiptLightboxDialogComponent } from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';

describe('ExpenseListRowComponent', () => {
  let component: ExpenseListRowComponent;
  let fixture: ComponentFixture<ExpenseListRowComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  const mockExpense: ExpenseListItemDto = {
    id: 'expense-123',
    propertyId: 'property-456',
    propertyName: 'Test Property',
    date: '2024-01-15',
    amount: 150.0,
    categoryId: 'cat-1',
    categoryName: 'Repairs',
    description: 'Fixed the faucet',
    receiptId: 'receipt-789',
    createdAt: '2024-01-15T12:00:00Z',
  };

  const mockExpenseNoReceipt: ExpenseListItemDto = {
    ...mockExpense,
    receiptId: undefined,
  };

  beforeEach(() => {
    mockDialog = { open: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ExpenseListRowComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  describe('with receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
      // Set input using fixture.componentRef.setInput
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display receipt icon when expense has receiptId', () => {
      const receiptIcon = fixture.nativeElement.querySelector(
        '.expense-receipt mat-icon'
      );
      expect(receiptIcon).toBeTruthy();
    });

    it('should open lightbox dialog when receipt icon clicked (AC-5.5.1)', () => {
      const receiptIcon = fixture.nativeElement.querySelector(
        '.expense-receipt mat-icon'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      receiptIcon.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockDialog.open).toHaveBeenCalledWith(
        ReceiptLightboxDialogComponent,
        {
          data: { receiptId: 'receipt-789' },
          panelClass: 'receipt-lightbox-panel',
        }
      );
    });

    it('should not navigate when receipt icon clicked', () => {
      const receiptIcon = fixture.nativeElement.querySelector(
        '.expense-receipt mat-icon'
      );
      receiptIcon.click();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('without receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpenseNoReceipt);
      fixture.detectChanges();
    });

    it('should not display receipt icon when expense has no receiptId', () => {
      const receiptIcon = fixture.nativeElement.querySelector(
        '.expense-receipt mat-icon'
      );
      expect(receiptIcon).toBeNull();
    });
  });

  describe('row click behavior', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should navigate to expense workspace when row clicked', () => {
      const row = fixture.nativeElement.querySelector('.expense-list-row');
      row.click();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/properties',
        'property-456',
        'expenses',
      ]);
    });
  });

  describe('formatting', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should format date correctly', () => {
      const dateEl = fixture.nativeElement.querySelector('.expense-date');
      // Date may be Jan 14 or Jan 15 depending on timezone
      expect(dateEl.textContent.trim()).toMatch(/Jan 1[45], 2024/);
    });

    it('should display property name', () => {
      const propertyEl =
        fixture.nativeElement.querySelector('.expense-property');
      expect(propertyEl.textContent.trim()).toBe('Test Property');
    });

    it('should display category name', () => {
      const categoryEl = fixture.nativeElement.querySelector('.category-chip');
      expect(categoryEl.textContent.trim()).toBe('Repairs');
    });

    it('should truncate long descriptions', () => {
      const longDescription =
        'This is a very long description that should be truncated because it exceeds fifty characters';
      expect(component.truncateDescription(longDescription)).toBe(
        'This is a very long description that should be tru...'
      );
    });
  });
});
