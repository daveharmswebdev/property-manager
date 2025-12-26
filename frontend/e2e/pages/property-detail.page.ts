import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { type TestProperty } from '../helpers/test-data.helper';

/**
 * PropertyDetailPage - Page object for property detail E2E tests
 *
 * Covers: AC-TD.1.1 - Property Edit/Delete E2E tests
 */
export class PropertyDetailPage extends BasePage {
  // Header elements
  readonly backButton: Locator;
  readonly propertyName: Locator;
  readonly propertyAddress: Locator;

  // Action buttons
  readonly addExpenseButton: Locator;
  readonly addIncomeButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  // Stats section
  readonly expenseTotal: Locator;
  readonly incomeTotal: Locator;
  readonly netIncome: Locator;

  // Recent activity sections
  readonly recentExpenses: Locator;
  readonly recentIncome: Locator;
  readonly expensesEmptyState: Locator;
  readonly incomeEmptyState: Locator;

  // Confirmation dialog
  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  // Edit form elements (on edit page)
  readonly nameInput: Locator;
  readonly streetInput: Locator;
  readonly cityInput: Locator;
  readonly stateSelect: Locator;
  readonly zipCodeInput: Locator;
  readonly saveChangesButton: Locator;
  readonly cancelButton: Locator;

  // Unsaved changes dialog
  readonly unsavedChangesDialog: Locator;
  readonly discardButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.backButton = page.locator('.back-button');
    this.propertyName = page.locator('.title-section h1');
    this.propertyAddress = page.locator('.address');

    // Action buttons
    this.addExpenseButton = page.locator('button', { hasText: 'Add Expense' });
    this.addIncomeButton = page.locator('button', { hasText: 'Add Income' });
    this.editButton = page.locator('button', { hasText: 'Edit' });
    this.deleteButton = page.locator('button', { hasText: 'Delete' });

    // Stats section
    this.expenseTotal = page.locator('.expense-card .stat-value');
    this.incomeTotal = page.locator('.income-card .stat-value');
    this.netIncome = page.locator('.net-card .stat-value');

    // Recent activity
    this.recentExpenses = page.locator('.activity-card').filter({ hasText: 'Recent Expenses' });
    this.recentIncome = page.locator('.activity-card').filter({ hasText: 'Recent Income' });
    this.expensesEmptyState = this.recentExpenses.locator('.empty-state');
    this.incomeEmptyState = this.recentIncome.locator('.empty-state');

    // Confirmation dialog
    this.confirmDialog = page.locator('mat-dialog-container');
    this.confirmDeleteButton = page.locator('mat-dialog-container button', { hasText: 'Delete' });
    this.cancelDeleteButton = page.locator('mat-dialog-container button', { hasText: 'Cancel' });

    // Edit form elements (for property-edit page)
    this.nameInput = page.locator('input[formControlName="name"]');
    this.streetInput = page.locator('input[formControlName="street"]');
    this.cityInput = page.locator('input[formControlName="city"]');
    this.stateSelect = page.locator('mat-select[formControlName="state"]');
    this.zipCodeInput = page.locator('input[formControlName="zipCode"]');
    this.saveChangesButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button', { hasText: 'Cancel' });

    // Unsaved changes dialog
    this.unsavedChangesDialog = page.locator('mat-dialog-container', { hasText: 'Unsaved Changes' });
    this.discardButton = page.locator('mat-dialog-container button', { hasText: 'Discard' });
  }

  async goto(): Promise<void> {
    throw new Error('Use gotoWithPropertyId(propertyId) to navigate to property detail');
  }

  async gotoWithPropertyId(propertyId: string): Promise<void> {
    await this.page.goto(`/properties/${propertyId}`);
    await this.waitForLoading();
  }

  async gotoEditPage(propertyId: string): Promise<void> {
    await this.page.goto(`/properties/${propertyId}/edit`);
    await this.waitForLoading();
  }

  /**
   * Click edit button from detail page
   */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
  }

  /**
   * Click delete button from detail page
   */
  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  /**
   * Delete property (click delete + confirm)
   */
  async deleteProperty(): Promise<void> {
    await this.clickDelete();
    await expect(this.confirmDialog).toBeVisible();
    await this.confirmDeleteButton.click();
    await this.waitForSnackBar('Property deleted');
  }

  /**
   * Cancel delete operation
   */
  async cancelDelete(): Promise<void> {
    await expect(this.confirmDialog).toBeVisible();
    await this.cancelDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible();
  }

  /**
   * Fill edit form with new data
   */
  async fillEditForm(property: Partial<TestProperty>): Promise<void> {
    if (property.name !== undefined) {
      await this.nameInput.clear();
      await this.nameInput.fill(property.name);
    }

    if (property.street !== undefined) {
      await this.streetInput.clear();
      await this.streetInput.fill(property.street);
    }

    if (property.city !== undefined) {
      await this.cityInput.clear();
      await this.cityInput.fill(property.city);
    }

    if (property.state !== undefined) {
      await this.stateSelect.click();
      await this.page.locator('mat-option').filter({ hasText: property.state }).click();
    }

    if (property.zipCode !== undefined) {
      await this.zipCodeInput.clear();
      await this.zipCodeInput.fill(property.zipCode);
    }
  }

  /**
   * Submit edit form
   */
  async submitEditForm(): Promise<void> {
    await this.saveChangesButton.click();
    await this.waitForSnackBar('Property updated');
  }

  /**
   * Cancel edit and go back
   */
  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Cancel edit with unsaved changes - discard
   */
  async cancelEditWithDiscard(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.unsavedChangesDialog).toBeVisible();
    await this.discardButton.click();
  }

  /**
   * Go back to previous page
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Click Add Expense button
   */
  async clickAddExpense(): Promise<void> {
    await this.addExpenseButton.click();
  }

  /**
   * Click Add Income button
   */
  async clickAddIncome(): Promise<void> {
    await this.addIncomeButton.click();
  }

  /**
   * Assert property name is displayed
   */
  async expectPropertyName(name: string): Promise<void> {
    await expect(this.propertyName).toHaveText(name);
  }

  /**
   * Assert property address contains expected text
   */
  async expectAddressContains(text: string): Promise<void> {
    await expect(this.propertyAddress).toContainText(text);
  }

  /**
   * Assert expense total displays expected value
   */
  async expectExpenseTotal(expectedTotal: string): Promise<void> {
    await expect(this.expenseTotal).toContainText(expectedTotal);
  }

  /**
   * Assert income total displays expected value
   */
  async expectIncomeTotal(expectedTotal: string): Promise<void> {
    await expect(this.incomeTotal).toContainText(expectedTotal);
  }

  /**
   * Assert net income displays expected value
   */
  async expectNetIncome(expectedValue: string): Promise<void> {
    await expect(this.netIncome).toContainText(expectedValue);
  }

  /**
   * Assert expenses empty state is visible
   */
  async expectExpensesEmpty(): Promise<void> {
    await expect(this.expensesEmptyState).toBeVisible();
  }

  /**
   * Assert income empty state is visible
   */
  async expectIncomeEmpty(): Promise<void> {
    await expect(this.incomeEmptyState).toBeVisible();
  }

  /**
   * Get current property name text
   */
  async getPropertyName(): Promise<string> {
    return (await this.propertyName.textContent()) || '';
  }

  /**
   * Get current address text
   */
  async getAddress(): Promise<string> {
    return (await this.propertyAddress.textContent()) || '';
  }
}
