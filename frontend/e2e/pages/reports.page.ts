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

  // Reports list elements
  get reportsList(): Locator {
    return this.page.locator('[data-testid="reports-list"]');
  }

  getPreviewButton(reportId: string): Locator {
    return this.page.locator(`[data-testid="preview-report-${reportId}"]`);
  }

  getDownloadButton(reportId: string): Locator {
    return this.page.locator(`[data-testid="download-report-${reportId}"]`);
  }

  getDeleteButton(reportId: string): Locator {
    return this.page.locator(`[data-testid="delete-report-${reportId}"]`);
  }

  // Preview dialog elements
  get previewDialog(): Locator {
    return this.page.locator('[data-testid="report-preview-dialog"]');
  }

  get previewLoadingState(): Locator {
    return this.previewDialog.locator('[data-testid="loading-state"]');
  }

  get previewErrorState(): Locator {
    return this.previewDialog.locator('[data-testid="error-state"]');
  }

  get previewZoomLevel(): Locator {
    return this.previewDialog.locator('[data-testid="zoom-level"]');
  }

  get previewZoomInBtn(): Locator {
    return this.previewDialog.locator('[data-testid="zoom-in-btn"]');
  }

  get previewZoomOutBtn(): Locator {
    return this.previewDialog.locator('[data-testid="zoom-out-btn"]');
  }

  get previewResetZoomBtn(): Locator {
    return this.previewDialog.locator('[data-testid="reset-zoom-btn"]');
  }

  get previewPrintBtn(): Locator {
    return this.previewDialog.locator('[data-testid="print-btn"]');
  }

  get previewDownloadBtn(): Locator {
    return this.previewDialog.locator('[data-testid="download-btn"]');
  }

  get previewCloseBtn(): Locator {
    return this.previewDialog.locator('[data-testid="close-btn"]');
  }

  get previewFixDataLink(): Locator {
    return this.previewDialog.locator('[data-testid="fix-data-link"]');
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

  // Preview dialog actions
  async openPreview(reportId: string): Promise<void> {
    await this.getPreviewButton(reportId).click();
    await this.previewDialog.waitFor({ state: 'visible' });
  }

  async closePreview(): Promise<void> {
    await this.previewCloseBtn.click();
    await this.previewDialog.waitFor({ state: 'hidden' });
  }

  async waitForPreviewLoaded(): Promise<void> {
    // Wait for loading state to disappear
    await this.previewLoadingState.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async getZoomLevel(): Promise<string> {
    return this.previewZoomLevel.innerText();
  }
}
