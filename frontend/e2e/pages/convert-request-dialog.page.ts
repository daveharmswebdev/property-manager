import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * ConvertRequestDialogPage - page object for the landlord convert dialog
 * (Story 20.8).
 *
 * Covers the modal opened from the maintenance request detail page:
 * description textarea, optional category select, optional vendor select,
 * Convert/Cancel buttons.
 */
export class ConvertRequestDialogPage extends BasePage {
  readonly dialog: Locator;
  readonly descriptionInput: Locator;
  readonly categorySelect: Locator;
  readonly vendorSelect: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.locator('[data-testid="convert-dialog"]');
    this.descriptionInput = page.locator('[data-testid="convert-dialog-description"]');
    this.categorySelect = page.locator('[data-testid="convert-dialog-category"]');
    this.vendorSelect = page.locator('[data-testid="convert-dialog-vendor"]');
    this.submitButton = page.locator('[data-testid="convert-dialog-submit"]');
    this.cancelButton = page.locator('[data-testid="convert-dialog-cancel"]');
  }

  /**
   * No-op `goto` — the dialog is opened by the parent page, not navigated to.
   */
  async goto(): Promise<void> {
    throw new Error('ConvertRequestDialogPage is opened from the detail page; goto() is unsupported.');
  }

  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toHaveCount(0);
  }

  async setDescription(text: string): Promise<void> {
    await this.descriptionInput.fill(text);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
