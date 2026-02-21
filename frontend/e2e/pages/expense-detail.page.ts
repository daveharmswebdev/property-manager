import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * ExpenseDetailPage - Page object for expense detail/edit E2E tests
 *
 * Covers: Story 15.5 — Expense Detail/Edit View
 *
 * Supports both view mode (read-only display) and edit mode (form).
 * Extends BasePage for loading state, snackbar, and confirmation dialog helpers.
 */
export class ExpenseDetailPage extends BasePage {
  // ─────────────────────────────────────────────────────────────────────────
  // Header / Navigation
  // ─────────────────────────────────────────────────────────────────────────
  readonly backLink: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Action Buttons (View Mode)
  // ─────────────────────────────────────────────────────────────────────────
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // View Mode — Expense Detail Fields
  // ─────────────────────────────────────────────────────────────────────────
  readonly amountDisplay: Locator;
  readonly dateDisplay: Locator;
  readonly categoryDisplay: Locator;
  readonly descriptionDisplay: Locator;
  readonly propertyDisplay: Locator;
  readonly createdDateDisplay: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Receipt Section
  // ─────────────────────────────────────────────────────────────────────────
  readonly receiptSection: Locator;
  readonly receiptThumbnail: Locator;
  readonly viewReceiptButton: Locator;
  readonly unlinkReceiptButton: Locator;
  readonly noReceiptMessage: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Work Order Section
  // ─────────────────────────────────────────────────────────────────────────
  readonly workOrderSection: Locator;
  readonly workOrderLink: Locator;
  readonly noWorkOrderMessage: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode — Form Elements
  // ─────────────────────────────────────────────────────────────────────────
  readonly editForm: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly categorySelect: Locator;
  readonly descriptionInput: Locator;
  readonly propertySelect: Locator;
  readonly workOrderSelect: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode — Receipt Linking (Story 16.4, AC3-AC4)
  // ─────────────────────────────────────────────────────────────────────────
  readonly receiptLinkSection: Locator;
  readonly receiptOptions: Locator;
  readonly linkReceiptButton: Locator;
  readonly receiptSectionEdit: Locator;
  readonly noUnprocessedReceiptsMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.backLink = page.locator('a', { hasText: /Back to Expenses/i });

    // Action buttons
    this.editButton = page.locator('button', { hasText: 'Edit' });
    this.deleteButton = page.locator('button', { hasText: 'Delete' });

    // View mode fields (data-testid for stable selectors)
    this.amountDisplay = page.locator('[data-testid="expense-amount"]');
    this.dateDisplay = page.locator('[data-testid="expense-date"]');
    this.categoryDisplay = page.locator('[data-testid="expense-category"]');
    this.descriptionDisplay = page.locator('[data-testid="expense-description"]');
    this.propertyDisplay = page.locator('[data-testid="expense-property"]');
    this.createdDateDisplay = page.locator('[data-testid="expense-created-date"]');

    // Receipt section
    this.receiptSection = page.locator('[data-testid="receipt-section"]');
    this.receiptThumbnail = page.locator('[data-testid="receipt-thumbnail"]');
    this.viewReceiptButton = page.locator('button', { hasText: /View Receipt/i });
    this.unlinkReceiptButton = page.locator('button', { hasText: /Unlink Receipt/i });
    this.noReceiptMessage = page.getByText(/No receipt/i);

    // Work order section
    this.workOrderSection = page.locator('[data-testid="work-order-section"]');
    this.workOrderLink = page.locator('[data-testid="work-order-link"]');
    this.noWorkOrderMessage = page.getByText(/No work order/i);

    // Edit form (formControlName selectors match Angular reactive forms)
    this.editForm = page.locator('form');
    this.amountInput = page.locator('input[formControlName="amount"]');
    this.dateInput = page.locator('input[formControlName="date"]');
    this.categorySelect = page.locator(
      'mat-select[formControlName="categoryId"], app-category-select mat-select',
    );
    this.descriptionInput = page.locator('textarea[formControlName="description"]');
    this.propertySelect = page.locator('mat-select[formControlName="propertyId"]');
    this.workOrderSelect = page.locator('mat-select[formControlName="workOrderId"]');
    this.saveButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button', { hasText: 'Cancel' });

    // Receipt linking (Story 16.4)
    this.receiptLinkSection = page.locator('[data-testid="receipt-link-section"]');
    this.receiptOptions = page.locator('[data-testid="receipt-option"]');
    this.linkReceiptButton = page.locator('[data-testid="link-receipt-btn"]');
    this.receiptSectionEdit = page.locator('[data-testid="receipt-section-edit"]');
    this.noUnprocessedReceiptsMessage = page.getByText(/No unprocessed receipts/i);
  }

  async goto(): Promise<void> {
    throw new Error('Use gotoExpense(expenseId) to navigate to expense detail');
  }

  /**
   * Navigate directly to expense detail page by ID.
   */
  async gotoExpense(expenseId: string): Promise<void> {
    await this.page.goto(`/expenses/${expenseId}`);
    await this.waitForLoading();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // View Mode Assertions
  // ─────────────────────────────────────────────────────────────────────────

  async expectViewMode(): Promise<void> {
    await expect(this.editButton).toBeVisible();
    await expect(this.deleteButton).toBeVisible();
  }

  async expectAmount(expected: string): Promise<void> {
    await expect(this.amountDisplay).toContainText(expected);
  }

  async expectCategory(expected: string): Promise<void> {
    await expect(this.categoryDisplay).toContainText(expected);
  }

  async expectProperty(expected: string): Promise<void> {
    await expect(this.propertyDisplay).toContainText(expected);
  }

  async expectDescription(expected: string): Promise<void> {
    await expect(this.descriptionDisplay).toContainText(expected);
  }

  async expectReceiptLinked(): Promise<void> {
    await expect(this.viewReceiptButton).toBeVisible();
    await expect(this.unlinkReceiptButton).toBeVisible();
  }

  async expectNoReceipt(): Promise<void> {
    await expect(this.noReceiptMessage).toBeVisible();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode Assertions
  // ─────────────────────────────────────────────────────────────────────────

  async expectEditMode(): Promise<void> {
    await expect(this.editForm).toBeVisible();
    await expect(this.saveButton).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  async clickEdit(): Promise<void> {
    await this.editButton.click();
  }

  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  async clickUnlinkReceipt(): Promise<void> {
    await this.unlinkReceiptButton.click();
  }

  async submitEdit(): Promise<void> {
    await this.saveButton.click();
  }

  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  async clickBack(): Promise<void> {
    await this.backLink.click();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Receipt Linking Actions (Story 16.4, AC3-AC4)
  // ─────────────────────────────────────────────────────────────────────────

  async expectReceiptLinkSection(): Promise<void> {
    await expect(this.receiptLinkSection).toBeVisible();
  }

  async expectNoUnprocessedReceipts(): Promise<void> {
    await expect(this.noUnprocessedReceiptsMessage).toBeVisible();
  }

  async selectReceipt(index: number): Promise<void> {
    await this.receiptOptions.nth(index).click();
  }

  async clickLinkReceipt(): Promise<void> {
    await this.linkReceiptButton.click();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Work Order Actions (Story 16.4, AC1-AC2)
  // ─────────────────────────────────────────────────────────────────────────

  async expectWorkOrderDropdown(): Promise<void> {
    await expect(this.workOrderSelect).toBeVisible();
  }

  async selectWorkOrder(description: string): Promise<void> {
    await this.workOrderSelect.click();
    await this.page.locator('mat-option', { hasText: description }).click();
  }

  /**
   * Fill the edit form amount field.
   */
  async fillAmount(amount: string): Promise<void> {
    await this.amountInput.clear();
    await this.amountInput.fill(amount);
  }

  /**
   * Fill the edit form description field.
   */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
  }

  /**
   * Select a category in the edit form dropdown.
   */
  async selectCategory(categoryName: string): Promise<void> {
    await this.categorySelect.click();
    await this.page.locator('mat-option', { hasText: categoryName }).click();
  }

  /**
   * Select a property in the edit form dropdown.
   */
  async selectProperty(propertyName: string): Promise<void> {
    await this.propertySelect.click();
    await this.page.locator('mat-option', { hasText: propertyName }).click();
  }
}
