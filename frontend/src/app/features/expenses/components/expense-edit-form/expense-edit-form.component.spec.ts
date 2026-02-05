import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ExpenseEditFormComponent } from './expense-edit-form.component';
import { ExpenseStore } from '../../stores/expense.store';
import { ApiClient, ReceiptDto } from '../../../../core/api/api.service';
import { ExpenseDto } from '../../services/expense.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkOrderService } from '../../../work-orders/services/work-order.service';

const createMockWorkOrderService = () => ({
  getWorkOrdersByProperty: vi.fn().mockReturnValue(of({
    items: [
      { id: 'wo-1', description: 'Fix plumbing', status: 'Reported', propertyId: 'property-1' },
      { id: 'wo-2', description: 'Replace HVAC', status: 'Assigned', propertyId: 'property-1' },
    ],
    totalCount: 2,
  })),
});

describe('ExpenseEditFormComponent', () => {
  let component: ExpenseEditFormComponent;
  let fixture: ComponentFixture<ExpenseEditFormComponent>;
  let mockStore: {
    isUpdating: ReturnType<typeof signal<boolean>>;
    updateExpense: ReturnType<typeof vi.fn>;
    cancelEditing: ReturnType<typeof vi.fn>;
    isLoadingCategories: ReturnType<typeof signal<boolean>>;
    sortedCategories: ReturnType<typeof signal<{ id: string; name: string; scheduleELine?: string }[]>>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockApiClient: {
    receipts_GetReceipt: ReturnType<typeof vi.fn>;
    expenses_UnlinkReceipt: ReturnType<typeof vi.fn>;
  };

  const mockExpense: ExpenseDto = {
    id: 'expense-1',
    propertyId: 'property-1',
    propertyName: 'Test Property',
    amount: 100.5,
    date: '2024-01-15',
    categoryId: 'category-1',
    categoryName: 'Repairs',
    description: 'Test expense',
    receiptId: undefined,
    createdAt: '2024-01-15T12:00:00Z',
  };

  const mockExpenseWithReceipt: ExpenseDto = {
    ...mockExpense,
    receiptId: 'receipt-1',
  };

  const mockExpenseWithWorkOrder: ExpenseDto = {
    ...mockExpense,
    workOrderId: 'wo-1',
  };

  const mockReceipt: ReceiptDto = {
    id: 'receipt-1',
    viewUrl: 'https://s3.example.com/receipt.jpg',
    contentType: 'image/jpeg',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockStore = {
      isUpdating: signal(false),
      updateExpense: vi.fn(),
      cancelEditing: vi.fn(),
      isLoadingCategories: signal(false),
      sortedCategories: signal([
        { id: 'category-1', name: 'Repairs', scheduleELine: 'Line 14' },
        { id: 'category-2', name: 'Insurance', scheduleELine: 'Line 9' },
      ]),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockApiClient = {
      receipts_GetReceipt: vi.fn().mockReturnValue(of(mockReceipt)),
      expenses_UnlinkReceipt: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseEditFormComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ExpenseStore, useValue: mockStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: ApiClient, useValue: mockApiClient },
        { provide: WorkOrderService, useValue: createMockWorkOrderService() },
      ],
    }).compileComponents();
  });

  describe('without receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ExpenseEditFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should not show receipt section when expense has no receiptId', () => {
      const receiptSection = fixture.debugElement.query(
        By.css('[data-testid="receipt-section"]')
      );
      expect(receiptSection).toBeNull();
    });
  });

  describe('with receipt (AC-5.5.4, AC-5.5.5)', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(ExpenseEditFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpenseWithReceipt);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show receipt section when expense has receiptId', () => {
      const receiptSection = fixture.debugElement.query(
        By.css('[data-testid="receipt-section"]')
      );
      expect(receiptSection).toBeTruthy();
    });

    it('should load receipt details on init', () => {
      expect(mockApiClient.receipts_GetReceipt).toHaveBeenCalledWith('receipt-1');
    });

    it('should show receipt thumbnail after loading', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const thumbnail = fixture.debugElement.query(
        By.css('[data-testid="receipt-thumbnail"]')
      );
      expect(thumbnail).toBeTruthy();
    });

    it('should show unlink receipt button', () => {
      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      expect(unlinkBtn).toBeTruthy();
      expect(unlinkBtn.nativeElement.textContent).toContain('Unlink Receipt');
    });

    it('should open confirmation dialog when unlink button is clicked', () => {
      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(mockDialog.open).toHaveBeenCalled();
      const dialogConfig = mockDialog.open.mock.calls[0][1];
      expect(dialogConfig.data.title).toBe('Unlink Receipt');
      expect(dialogConfig.data.confirmText).toBe('Unlink');
    });

    it('should not call API when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(false),
      });

      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(mockApiClient.expenses_UnlinkReceipt).not.toHaveBeenCalled();
    });

    it('should call unlink API when dialog is confirmed', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });

      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(mockApiClient.expenses_UnlinkReceipt).toHaveBeenCalledWith('expense-1');
    });

    it('should show success snackbar on successful unlink', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });

      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Receipt unlinked', 'Close', { duration: 3000 });
    });

    it('should emit receiptUnlinked event on successful unlink', () => {
      const unlinkedSpy = vi.fn();
      component.receiptUnlinked.subscribe(unlinkedSpy);

      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });

      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(unlinkedSpy).toHaveBeenCalled();
    });

    it('should show error snackbar on failed unlink', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      });
      mockApiClient.expenses_UnlinkReceipt.mockReturnValue(throwError(() => new Error('API Error')));

      const unlinkBtn = fixture.debugElement.query(
        By.css('[data-testid="unlink-receipt-btn"]')
      );
      unlinkBtn.nativeElement.click();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to unlink receipt', 'Close', { duration: 3000 });
    });
  });

  describe('with PDF receipt', () => {
    beforeEach(async () => {
      const pdfReceipt: ReceiptDto = {
        ...mockReceipt,
        contentType: 'application/pdf',
      };
      mockApiClient.receipts_GetReceipt.mockReturnValue(of(pdfReceipt));

      fixture = TestBed.createComponent(ExpenseEditFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpenseWithReceipt);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show PDF icon instead of image for PDF receipts', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const pdfIcon = fixture.debugElement.query(By.css('.pdf-icon'));
      expect(pdfIcon).toBeTruthy();
    });
  });

  describe('view receipt lightbox', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(ExpenseEditFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpenseWithReceipt);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should open lightbox dialog when thumbnail is clicked', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const thumbnail = fixture.debugElement.query(
        By.css('[data-testid="receipt-thumbnail"]')
      );
      thumbnail.nativeElement.click();

      expect(mockDialog.open).toHaveBeenCalled();
      const dialogConfig = mockDialog.open.mock.calls[0][1];
      expect(dialogConfig.data.receiptId).toBe('receipt-1');
      expect(dialogConfig.width).toBe('90vw');
      expect(dialogConfig.maxWidth).toBe('1400px');
      expect(dialogConfig.height).toBe('90vh');
      expect(dialogConfig.panelClass).toBe('receipt-lightbox-panel');
    });
  });

  describe('work order dropdown (AC-11.2.2, AC-11.2.3, AC-11.2.5)', () => {
    let mockWorkOrderService: ReturnType<typeof createMockWorkOrderService>;

    beforeEach(() => {
      mockWorkOrderService = createMockWorkOrderService();

      TestBed.overrideProvider(WorkOrderService, { useValue: mockWorkOrderService });

      fixture = TestBed.createComponent(ExpenseEditFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('expense', mockExpense);
      fixture.detectChanges();
    });

    it('should have workOrderId form control (AC-11.2.2)', () => {
      expect(component['form'].get('workOrderId')).toBeTruthy();
    });

    it('should load work orders for expense property on init (AC-11.2.3)', () => {
      expect(mockWorkOrderService.getWorkOrdersByProperty).toHaveBeenCalledWith('property-1');
    });

    it('should pre-populate workOrderId from expense (AC-11.2.2)', () => {
      fixture.componentRef.setInput('expense', mockExpenseWithWorkOrder);
      component.ngOnChanges({
        expense: {
          currentValue: mockExpenseWithWorkOrder,
          previousValue: mockExpense,
          firstChange: false,
          isFirstChange: () => false,
        },
      });
      fixture.detectChanges();

      expect(component['form'].get('workOrderId')?.value).toBe('wo-1');
    });

    it('should default workOrderId to empty when expense has no work order', () => {
      expect(component['form'].get('workOrderId')?.value).toBe('');
    });

    it('should include workOrderId in update request (AC-11.2.5)', () => {
      component['form'].patchValue({
        amount: 200,
        date: new Date('2024-01-15'),
        categoryId: 'category-1',
        description: 'Updated expense',
        workOrderId: 'wo-2',
      });

      component['onSubmit']();

      expect(mockStore.updateExpense).toHaveBeenCalled();
      const callArg = mockStore.updateExpense.mock.calls[0][0];
      expect(callArg.request.workOrderId).toBe('wo-2');
    });

    it('should send undefined workOrderId when None selected (AC-11.2.5)', () => {
      component['form'].patchValue({
        amount: 200,
        date: new Date('2024-01-15'),
        categoryId: 'category-1',
        description: 'Updated expense',
        workOrderId: '',
      });

      component['onSubmit']();

      expect(mockStore.updateExpense).toHaveBeenCalled();
      const callArg = mockStore.updateExpense.mock.calls[0][0];
      expect(callArg.request.workOrderId).toBeUndefined();
    });
  });
});
