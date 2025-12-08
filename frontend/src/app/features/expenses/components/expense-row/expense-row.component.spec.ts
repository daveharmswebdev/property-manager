import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpenseRowComponent } from './expense-row.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ExpenseDto } from '../../services/expense.service';

describe('ExpenseRowComponent', () => {
  let component: ExpenseRowComponent;
  let fixture: ComponentFixture<ExpenseRowComponent>;

  const mockExpense: ExpenseDto = {
    id: 'expense-123',
    propertyId: 'property-456',
    propertyName: 'Oak Street Duplex',
    categoryId: 'cat-789',
    categoryName: 'Repairs',
    amount: 127.50,
    date: '2025-11-28',
    description: 'Faucet replacement',
    createdAt: '2025-11-28T10:30:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseRowComponent, NoopAnimationsModule],
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
      const descElement = fixture.nativeElement.querySelector('.expense-description');
      expect(descElement.textContent?.trim()).toBe('Faucet replacement');
    });

    it('should display "No description" when description is empty', () => {
      fixture.componentRef.setInput('expense', { ...mockExpense, description: undefined });
      fixture.detectChanges();

      const descElement = fixture.nativeElement.querySelector('.expense-description');
      expect(descElement.textContent?.trim()).toBe('No description');
    });

    it('should display category name in chip', () => {
      const chipElement = fixture.nativeElement.querySelector('mat-chip');
      expect(chipElement.textContent?.trim()).toBe('Repairs');
    });

    it('should display amount as currency', () => {
      const amountElement = fixture.nativeElement.querySelector('.expense-amount');
      expect(amountElement.textContent?.trim()).toBe('$127.50');
    });

    it('should have edit button', () => {
      const editButton = fixture.nativeElement.querySelector('.edit-button');
      expect(editButton).toBeTruthy();
    });

    it('should have delete button (AC-3.3.1)', () => {
      const deleteButton = fixture.nativeElement.querySelector('.delete-button');
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

      const deleteButton = fixture.nativeElement.querySelector('.delete-button');
      deleteButton.click();

      expect(deleteSpy).toHaveBeenCalledWith('expense-123');
    });
  });

  describe('delete confirmation state (AC-3.3.2)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('isConfirmingDelete', true);
      fixture.detectChanges();
    });

    it('should show confirmation message when isConfirmingDelete is true', () => {
      const confirmationMessage = fixture.nativeElement.querySelector('.confirmation-message');
      expect(confirmationMessage).toBeTruthy();
      expect(confirmationMessage.textContent?.trim()).toBe('Delete this expense?');
    });

    it('should show Cancel button', () => {
      const cancelButton = fixture.nativeElement.querySelector('.cancel-button');
      expect(cancelButton).toBeTruthy();
      expect(cancelButton.textContent?.trim()).toBe('Cancel');
    });

    it('should show Delete button', () => {
      const deleteConfirmButton = fixture.nativeElement.querySelector('.confirm-delete-button');
      expect(deleteConfirmButton).toBeTruthy();
      expect(deleteConfirmButton.textContent?.trim()).toBe('Delete');
    });

    it('should emit cancelDelete when Cancel is clicked', () => {
      const cancelSpy = vi.fn();
      component.cancelDelete.subscribe(cancelSpy);

      const cancelButton = fixture.nativeElement.querySelector('.cancel-button');
      cancelButton.click();

      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should emit confirmDelete with expense id when Delete is clicked', () => {
      const confirmSpy = vi.fn();
      component.confirmDelete.subscribe(confirmSpy);

      const deleteConfirmButton = fixture.nativeElement.querySelector('.confirm-delete-button');
      deleteConfirmButton.click();

      expect(confirmSpy).toHaveBeenCalledWith('expense-123');
    });

    it('should hide normal expense row content', () => {
      const expenseDetails = fixture.nativeElement.querySelector('.expense-details');
      expect(expenseDetails).toBeFalsy();
    });
  });

  describe('state transitions', () => {
    it('should show normal row when isConfirmingDelete is false', () => {
      fixture.componentRef.setInput('isConfirmingDelete', false);
      fixture.detectChanges();

      const expenseDetails = fixture.nativeElement.querySelector('.expense-details');
      const confirmationMessage = fixture.nativeElement.querySelector('.confirmation-message');

      expect(expenseDetails).toBeTruthy();
      expect(confirmationMessage).toBeFalsy();
    });

    it('should show confirmation when isConfirmingDelete is true', () => {
      fixture.componentRef.setInput('isConfirmingDelete', true);
      fixture.detectChanges();

      const expenseDetails = fixture.nativeElement.querySelector('.expense-details');
      const confirmationMessage = fixture.nativeElement.querySelector('.confirmation-message');

      expect(expenseDetails).toBeFalsy();
      expect(confirmationMessage).toBeTruthy();
    });
  });
});
