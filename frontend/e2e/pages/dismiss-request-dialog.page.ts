import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * DismissRequestDialogPage - page object for the landlord dismiss dialog
 * (Story 20.9).
 *
 * Covers the modal opened from the maintenance request detail page:
 * read-only property + description summary, required reason textarea,
 * Dismiss Request / Cancel buttons.
 */
export class DismissRequestDialogPage extends BasePage {
  readonly dialog: Locator;
  readonly reasonInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly summary: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.locator('[data-testid="dismiss-dialog"]');
    this.reasonInput = page.locator('[data-testid="dismiss-dialog-reason"]');
    this.submitButton = page.locator('[data-testid="dismiss-dialog-submit"]');
    this.cancelButton = page.locator('[data-testid="dismiss-dialog-cancel"]');
    this.summary = page.locator('[data-testid="dismiss-dialog-summary"]');
  }

  /**
   * No-op `goto` — the dialog is opened by the parent page, not navigated to.
   */
  async goto(): Promise<void> {
    throw new Error(
      'DismissRequestDialogPage is opened from the detail page; goto() is unsupported.',
    );
  }

  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toHaveCount(0);
  }

  async setReason(text: string): Promise<void> {
    await this.reasonInput.fill(text);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
