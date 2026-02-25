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

  const mockExpenseWithWorkOrder: ExpenseListItemDto = {
    ...mockExpense,
    workOrderId: 'wo-123',
  };

  const mockExpenseNoWorkOrder: ExpenseListItemDto = {
    ...mockExpense,
    workOrderId: undefined,
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
          width: '90vw',
          maxWidth: '1400px',
          height: '90vh',
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

    it('should navigate to expense detail when row clicked', () => {
      const row = fixture.nativeElement.querySelector('.expense-list-row');
      row.click();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/expenses',
        'expense-123',
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

  describe('create work order button (AC-11.6.7)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
    });

    it('should show add_task icon when no workOrderId', () => {
      fixture.componentRef.setInput('expense', mockExpenseNoWorkOrder);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      expect(button).toBeTruthy();
      expect(button.textContent.trim()).toBe('add_task');
    });

    it('should hide add_task icon when workOrderId exists', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      expect(button).toBeNull();
    });

    it('should emit createWorkOrder event with full expense item when clicked', () => {
      fixture.componentRef.setInput('expense', mockExpenseNoWorkOrder);
      fixture.detectChanges();

      const createWoSpy = vi.fn();
      component.createWorkOrder.subscribe(createWoSpy);

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      button.click();

      expect(createWoSpy).toHaveBeenCalledWith(mockExpenseNoWorkOrder);
    });

    it('should stop event propagation when clicked', () => {
      fixture.componentRef.setInput('expense', mockExpenseNoWorkOrder);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      button.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('delete action (AC-D1, AC-D3)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should emit delete event with expense ID when delete button clicked', () => {
      const deleteSpy = vi.fn();
      component.delete.subscribe(deleteSpy);

      const deleteButton = fixture.nativeElement.querySelector(
        '.cell-actions button[mattooltip="Delete"]'
      );
      expect(deleteButton).toBeTruthy();
      deleteButton.click();

      expect(deleteSpy).toHaveBeenCalledWith('expense-123');
    });

    it('should show edit and delete action buttons', () => {
      const actionButtons = fixture.nativeElement.querySelectorAll('.cell-actions button');
      expect(actionButtons.length).toBe(2);
    });

    it('should not navigate when action buttons clicked (stopPropagation)', () => {
      mockRouter.navigate.mockClear();

      const actionsDiv = fixture.nativeElement.querySelector('.cell-actions');
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');
      actionsDiv.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('work order indicator (AC-11.4.4)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseListRowComponent);
      component = fixture.componentInstance;
    });

    it('should show work order icon when workOrderId exists', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator).toBeTruthy();
      expect(indicator.textContent.trim()).toBe('assignment');
    });

    it('should hide work order icon when no workOrderId', () => {
      fixture.componentRef.setInput('expense', mockExpenseNoWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator).toBeNull();
    });

    it('should navigate to work order detail when icon clicked (AC-11.4.4)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      indicator.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/work-orders', 'wo-123']);
    });

    it('should NOT propagate click event to row click handler (AC-11.4.4)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );

      // Reset to ensure clean state
      mockRouter.navigate.mockClear();

      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');
      indicator.dispatchEvent(event);

      // Should navigate to work order, NOT to expense workspace
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/work-orders', 'wo-123']);
      expect(mockRouter.navigate).not.toHaveBeenCalledWith([
        '/properties',
        'property-456',
        'expenses',
      ]);
    });
  });
});
