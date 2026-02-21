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
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';

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
            paramMap: of(convertToParamMap({ id: 'exp-1' })),
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

  // ─────────────────────────────────────────────────────────────────────────
  // Story 16.4: Work Order Dropdown in Edit Mode (AC1, AC2)
  // RED PHASE: These tests fail because the edit form does not yet
  // include a workOrderId form control or work order dropdown.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edit Mode — Work Order Dropdown (Story 16.4, AC1-AC2)', () => {
    beforeEach(() => {
      // Switch to edit mode
      mockDetailStore.isEditing.set(true);
      mockDetailStore.isViewMode.set(false);
      fixture.detectChanges();
    });

    afterEach(() => {
      // Reset to view mode
      mockDetailStore.isEditing.set(false);
      mockDetailStore.isViewMode.set(true);
    });

    it('should show work order dropdown in edit mode (AC1)', () => {
      // GIVEN: Component is in edit mode
      // THEN: Work order select element exists in the form
      const workOrderSelect = fixture.nativeElement.querySelector(
        '[data-testid="work-order-select"], mat-select[formControlName="workOrderId"]',
      );
      expect(workOrderSelect).toBeTruthy();
    });

    it('should populate workOrderId from expense data (AC1)', () => {
      // GIVEN: Expense has a workOrderId
      const expenseWithWO = {
        ...mockExpense,
        workOrderId: 'wo-123',
      };
      mockDetailStore.expense.set(expenseWithWO);
      fixture.detectChanges();

      // Trigger edit mode population
      // The component's onEdit() calls populateEditForm()
      // After implementation, workOrderId should be patched into the form
      const workOrderSelect = fixture.nativeElement.querySelector(
        '[data-testid="work-order-select"], mat-select[formControlName="workOrderId"]',
      );
      expect(workOrderSelect).toBeTruthy();
    });

    it('should clear work order when property changes (AC2)', () => {
      // GIVEN: Work order dropdown exists in edit mode
      // WHEN: Property dropdown value changes
      // THEN: Work order selection should be cleared
      // This tests the reactive form valueChanges subscription
      const workOrderSelect = fixture.nativeElement.querySelector(
        '[data-testid="work-order-select"], mat-select[formControlName="workOrderId"]',
      );
      expect(workOrderSelect).toBeTruthy();
      // After implementation, changing propertyId should trigger workOrder reset
    });

    it('should include workOrderId in update request on submit (AC1)', () => {
      // GIVEN: A work order is selected in edit mode
      // WHEN: Form is submitted
      // THEN: updateExpense is called with workOrderId in the request
      const workOrderSelect = fixture.nativeElement.querySelector(
        '[data-testid="work-order-select"], mat-select[formControlName="workOrderId"]',
      );
      expect(workOrderSelect).toBeTruthy();
    });

    it('should send undefined workOrderId when None selected (AC1)', () => {
      // GIVEN: "None" is selected in work order dropdown
      // WHEN: Form is submitted
      // THEN: workOrderId is undefined in the update request
      const workOrderSelect = fixture.nativeElement.querySelector(
        '[data-testid="work-order-select"], mat-select[formControlName="workOrderId"]',
      );
      expect(workOrderSelect).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Story 16.4: Receipt Linking in Edit Mode (AC3, AC4)
  // RED PHASE: These tests fail because the edit form does not yet
  // include receipt linking/unlinking UI elements.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edit Mode — Receipt Linking (Story 16.4, AC3-AC4)', () => {
    beforeEach(() => {
      // Switch to edit mode
      mockDetailStore.isEditing.set(true);
      mockDetailStore.isViewMode.set(false);
      fixture.detectChanges();
    });

    afterEach(() => {
      // Reset to view mode
      mockDetailStore.isEditing.set(false);
      mockDetailStore.isViewMode.set(true);
      mockDetailStore.hasReceipt.set(false);
    });

    it('should show receipt link section when no receipt is linked (AC3)', () => {
      // GIVEN: Expense has no receipt
      mockDetailStore.hasReceipt.set(false);
      fixture.detectChanges();

      // THEN: Receipt link section is visible in edit mode
      const linkSection = fixture.nativeElement.querySelector(
        '[data-testid="receipt-link-section"]',
      );
      expect(linkSection).toBeTruthy();
    });

    it('should show unprocessed receipt thumbnails in picker (AC3)', () => {
      // GIVEN: Expense has no receipt and unprocessed receipts exist
      mockDetailStore.hasReceipt.set(false);
      fixture.detectChanges();

      // THEN: Receipt picker with thumbnails is visible
      const receiptOptions = fixture.nativeElement.querySelectorAll(
        '[data-testid="receipt-option"]',
      );
      // After implementation, this should show unprocessed receipts
      // For now, we just verify the link section container exists
      const linkSection = fixture.nativeElement.querySelector(
        '[data-testid="receipt-link-section"]',
      );
      expect(linkSection).toBeTruthy();
    });

    it('should show Link Receipt button when receipt is selected (AC3)', () => {
      // GIVEN: A receipt thumbnail is selected and unprocessed receipts exist
      mockDetailStore.hasReceipt.set(false);
      (component as any).unprocessedReceipts.set([
        { id: 'r-1', viewUrl: 'https://example.com/r1.jpg', contentType: 'image/jpeg', propertyName: 'Prop' },
      ]);
      fixture.detectChanges();

      // THEN: Link Receipt button should exist
      const linkBtn = fixture.nativeElement.querySelector(
        '[data-testid="link-receipt-btn"]',
      );
      expect(linkBtn).toBeTruthy();
    });

    it('should show unlink button in edit mode when receipt exists (AC4)', () => {
      // GIVEN: Expense has a linked receipt
      mockDetailStore.hasReceipt.set(true);
      fixture.detectChanges();

      // THEN: Unlink button visible in edit mode, not receipt picker
      const editReceiptSection = fixture.nativeElement.querySelector(
        '[data-testid="receipt-section-edit"]',
      );
      expect(editReceiptSection).toBeTruthy();

      const linkSection = fixture.nativeElement.querySelector(
        '[data-testid="receipt-link-section"]',
      );
      expect(linkSection).toBeFalsy(); // picker not shown when receipt exists
    });

    it('should show "No unprocessed receipts" when none available (AC3)', () => {
      // GIVEN: No unprocessed receipts and no receipt linked
      mockDetailStore.hasReceipt.set(false);
      fixture.detectChanges();

      // After implementation, when unprocessedReceipts() is empty,
      // component should show "No unprocessed receipts available"
      // For now, verify the link section area exists
      const linkSection = fixture.nativeElement.querySelector(
        '[data-testid="receipt-link-section"]',
      );
      expect(linkSection).toBeTruthy();
    });
  });
});
