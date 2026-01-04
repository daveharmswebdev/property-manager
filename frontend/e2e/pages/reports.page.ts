import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * ReportsPage - Page object for the Reports page
 *
 * Provides locators and actions for the reports page including
 * batch report generation dialog.
 */
export class ReportsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports');
    // Wait for the page content to be visible (no spinner on this page)
    await this.page.waitForSelector('.reports-page', { state: 'visible', timeout: 10000 });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Page Elements
  // ─────────────────────────────────────────────────────────────────────────────

  get generateAllReportsButton(): Locator {
    return this.page.locator('[data-testid="generate-all-reports-btn"]');
  }

  get batchDialog(): Locator {
    return this.page.locator('mat-dialog-container');
  }

  get dialogTitle(): Locator {
    return this.batchDialog.locator('[data-testid="batch-dialog-title"]');
  }

  get yearSelect(): Locator {
    return this.batchDialog.locator('[data-testid="year-select"]');
  }

  get propertyList(): Locator {
    return this.batchDialog.locator('[data-testid="property-list"]');
  }

  get toggleAllButton(): Locator {
    return this.batchDialog.locator('[data-testid="toggle-all-btn"]');
  }

  get generateButton(): Locator {
    return this.batchDialog.locator('[data-testid="generate-btn"]');
  }

  get cancelButton(): Locator {
    return this.batchDialog.locator('[data-testid="cancel-btn"]');
  }

  get loadingIndicator(): Locator {
    return this.batchDialog.locator('[data-testid="loading-indicator"]');
  }

  get errorMessage(): Locator {
    return this.batchDialog.locator('[data-testid="error-message"]');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────────

  async openBatchDialog(): Promise<void> {
    await this.generateAllReportsButton.click();
    await this.batchDialog.waitFor({ state: 'visible' });
  }

  async closeBatchDialog(): Promise<void> {
    await this.cancelButton.click();
    await this.batchDialog.waitFor({ state: 'hidden' });
  }

  async selectYear(year: number): Promise<void> {
    await this.yearSelect.click();
    await this.page.locator('mat-option', { hasText: String(year) }).click();
  }

  async togglePropertySelection(propertyId: string): Promise<void> {
    await this.batchDialog.locator(`[data-testid="property-checkbox-${propertyId}"]`).click();
  }

  async getPropertyCheckboxes(): Promise<Locator[]> {
    // Wait for at least one checkbox to appear before getting all
    await this.batchDialog.getByRole('checkbox').first().waitFor({ state: 'visible', timeout: 5000 });
    return this.batchDialog.getByRole('checkbox').all();
  }

  async getGenerateButtonText(): Promise<string> {
    return this.generateButton.innerText();
  }

  async hasNoDataWarning(propertyId: string): Promise<boolean> {
    const warning = this.batchDialog.locator(`[data-testid="no-data-warning-${propertyId}"]`);
    return warning.isVisible();
  }
}
