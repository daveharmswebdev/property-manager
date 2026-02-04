import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ExpenseRowComponent } from './expense-row.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { ExpenseDto } from '../../services/expense.service';
import { WorkOrderDto } from '../../../work-orders/services/work-order.service';
import { ReceiptLightboxDialogComponent } from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';

describe('ExpenseRowComponent', () => {
  let component: ExpenseRowComponent;
  let fixture: ComponentFixture<ExpenseRowComponent>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

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

  const mockExpenseWithWorkOrder: ExpenseDto = {
    ...mockExpense,
    workOrderId: 'wo-123',
  };

  const mockWorkOrder: WorkOrderDto = {
    id: 'wo-123',
    propertyId: 'property-456',
    propertyName: 'Oak Street Duplex',
    isDiy: false,
    status: 'Assigned',
    description: 'Fix plumbing leak in kitchen',
    createdAt: '2026-01-15',
    createdByUserId: 'user-1',
    tags: [],
  };

  beforeEach(async () => {
    mockDialog = { open: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ExpenseRowComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter },
      ],
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

  describe('work order indicator (AC-11.2.7, AC-11.4.2)', () => {
    it('should not show work order indicator when expense has no workOrderId', () => {
      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator).toBeNull();
    });

    it('should show work order indicator when expense has workOrderId', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator).toBeTruthy();
    });

    it('should display assignment icon for work order indicator', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator.textContent.trim()).toBe('assignment');
    });

    it('should navigate to work order detail when indicator clicked (AC-11.4.2)', () => {
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

    it('should use WO description for tooltip when workOrder input provided (AC-11.4.2)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.componentRef.setInput('workOrder', mockWorkOrder);
      fixture.detectChanges();

      const indicatorDe = fixture.debugElement.query(By.css('[data-testid="work-order-indicator"]'));
      expect(indicatorDe).toBeTruthy();
      const tooltip = indicatorDe.injector.get(MatTooltip);
      expect(tooltip.message).toBe('Fix plumbing leak in kitchen');
    });

    it('should fall back to generic tooltip when workOrder input not provided (AC-11.4.2)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      // workOrder not set - undefined
      fixture.detectChanges();

      const indicatorDe = fixture.debugElement.query(By.css('[data-testid="work-order-indicator"]'));
      expect(indicatorDe).toBeTruthy();
      const tooltip = indicatorDe.injector.get(MatTooltip);
      expect(tooltip.message).toBe('Linked to work order');
    });

    it('should still show indicator when workOrderId exists but workOrder input is undefined (graceful fallback)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      // workOrder not set - undefined
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector(
        '[data-testid="work-order-indicator"]'
      );
      expect(indicator).toBeTruthy();
    });
  });

  describe('work order context sub-line (AC-11.4.1)', () => {
    it('should show work order context sub-line when workOrder input provided', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.componentRef.setInput('workOrder', mockWorkOrder);
      fixture.detectChanges();

      const context = fixture.nativeElement.querySelector(
        '[data-testid="work-order-context"]'
      );
      expect(context).toBeTruthy();
    });

    it('should hide work order context when no workOrder input', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      // workOrder not set
      fixture.detectChanges();

      const context = fixture.nativeElement.querySelector(
        '[data-testid="work-order-context"]'
      );
      expect(context).toBeNull();
    });

    it('should display status chip with correct status text', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.componentRef.setInput('workOrder', mockWorkOrder);
      fixture.detectChanges();

      const statusChip = fixture.nativeElement.querySelector('.wo-status-chip');
      expect(statusChip).toBeTruthy();
      expect(statusChip.textContent.trim()).toBe('Assigned');
      expect(statusChip.getAttribute('data-status')).toBe('Assigned');
    });

    it('should truncate WO description at 50 chars', () => {
      const longWo = {
        ...mockWorkOrder,
        description: 'This is a very long work order description that should be truncated at fifty characters',
      };
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.componentRef.setInput('workOrder', longWo);
      fixture.detectChanges();

      const woDesc = fixture.nativeElement.querySelector('.wo-description');
      expect(woDesc.textContent.trim()).toBe(
        'This is a very long work order description that sh...'
      );
    });

    it('should navigate to work order detail when context line clicked (AC-11.4.1)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.componentRef.setInput('workOrder', mockWorkOrder);
      fixture.detectChanges();

      const context = fixture.nativeElement.querySelector(
        '[data-testid="work-order-context"]'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      context.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/work-orders', 'wo-123']);
    });
  });

  describe('create work order button (AC-11.6.1)', () => {
    it('should show "Create Work Order" button when expense has no workOrderId', () => {
      // Default mockExpense has no workOrderId
      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      expect(button).toBeTruthy();
    });

    it('should hide "Create Work Order" button when expense has workOrderId', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      expect(button).toBeNull();
    });

    it('should emit createWorkOrder event with expense ID when clicked', () => {
      const createWoSpy = vi.fn();
      component.createWorkOrder.subscribe(createWoSpy);

      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      button.click();

      expect(createWoSpy).toHaveBeenCalledWith('expense-123');
    });

    it('should stop event propagation when clicked', () => {
      const button = fixture.nativeElement.querySelector(
        '[data-testid="create-work-order-button"]'
      );
      const event = new MouseEvent('click', { bubbles: true });
      vi.spyOn(event, 'stopPropagation');

      button.dispatchEvent(event);

      expect(event.stopPropagation).toHaveBeenCalled();
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
          width: '90vw',
          maxWidth: '1400px',
          height: '90vh',
          panelClass: 'receipt-lightbox-panel',
        }
      );
    });
  });
});
