import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpenseRowComponent } from './expense-row.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseDto } from '../../services/expense.service';
import { ReceiptLightboxDialogComponent } from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';

describe('ExpenseRowComponent', () => {
  let component: ExpenseRowComponent;
  let fixture: ComponentFixture<ExpenseRowComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockExpense: ExpenseDto = {
    id: 'expense-123',
    propertyId: 'property-456',
    propertyName: 'Oak Street Duplex',
    categoryId: 'cat-789',
    categoryName: 'Repairs',
    amount: 127.5,
    date: '2025-11-28',
    description: 'Faucet replacement',
    createdAt: '2025-11-28T10:30:00Z',
  };

  const mockExpenseWithReceipt: ExpenseDto = {
    ...mockExpense,
    receiptId: 'receipt-999',
  };

  beforeEach(async () => {
    mockDialog = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExpenseRowComponent, NoopAnimationsModule],
      providers: [{ provide: MatDialog, useValue: mockDialog }],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseRowComponent);
    component = fixture.componentInstance;

    // Set required input
    fixture.componentRef.setInput('expense', mockExpense);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('normal display state', () => {
    it('should display formatted date', () => {
      const dateElement = fixture.nativeElement.querySelector('.expense-date');
      // Date parsing may vary by timezone, so just check it contains the year and month
      expect(dateElement.textContent).toContain('Nov');
      expect(dateElement.textContent).toContain('2025');
    });

    it('should display expense description', () => {
      const descElement =
        fixture.nativeElement.querySelector('.expense-description');
      expect(descElement.textContent).toContain('Faucet replacement');
    });

    it('should display "No description" when description is empty', () => {
      fixture.componentRef.setInput('expense', {
        ...mockExpense,
        description: undefined,
      });
      fixture.detectChanges();

      const descElement =
        fixture.nativeElement.querySelector('.expense-description');
      expect(descElement.textContent).toContain('No description');
    });

    it('should display category name in chip', () => {
      const chipElement = fixture.nativeElement.querySelector('mat-chip');
      expect(chipElement.textContent?.trim()).toBe('Repairs');
    });

    it('should display amount as currency', () => {
      const amountElement =
        fixture.nativeElement.querySelector('.expense-amount');
      expect(amountElement.textContent?.trim()).toBe('$127.50');
    });

    it('should have edit button', () => {
      const editButton = fixture.nativeElement.querySelector('.edit-button');
      expect(editButton).toBeTruthy();
    });

    it('should have delete button (AC-3.3.1)', () => {
      const deleteButton =
        fixture.nativeElement.querySelector('.delete-button');
      expect(deleteButton).toBeTruthy();
    });
  });

  describe('edit button', () => {
    it('should emit edit event with expense id when clicked (AC-3.2.1)', () => {
      const editSpy = vi.fn();
      component.edit.subscribe(editSpy);

      const editButton = fixture.nativeElement.querySelector('.edit-button');
      editButton.click();

      expect(editSpy).toHaveBeenCalledWith('expense-123');
    });
  });

  describe('delete button', () => {
    it('should emit delete event with expense id when clicked (AC-3.3.1)', () => {
      const deleteSpy = vi.fn();
      component.delete.subscribe(deleteSpy);

      const deleteButton =
        fixture.nativeElement.querySelector('.delete-button');
      deleteButton.click();

      expect(deleteSpy).toHaveBeenCalledWith('expense-123');
    });
  });

  describe('receipt indicator (AC-5.5.1)', () => {
    it('should not show receipt indicator when expense has no receiptId', () => {
      const receiptIndicator = fixture.nativeElement.querySelector(
        '[data-testid="receipt-indicator"]'
      );
      expect(receiptIndicator).toBeNull();
    });

    it('should show receipt indicator when expense has receiptId', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithReceipt);
      fixture.detectChanges();

      const receiptIndicator = fixture.nativeElement.querySelector(
        '[data-testid="receipt-indicator"]'
      );
      expect(receiptIndicator).toBeTruthy();
    });

    it('should open lightbox dialog when receipt indicator is clicked', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithReceipt);
      fixture.detectChanges();

      const receiptIndicator = fixture.nativeElement.querySelector(
        '[data-testid="receipt-indicator"]'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      receiptIndicator.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockDialog.open).toHaveBeenCalledWith(
        ReceiptLightboxDialogComponent,
        {
          data: { receiptId: 'receipt-999' },
          panelClass: 'receipt-lightbox-panel',
        }
      );
    });
  });
});
