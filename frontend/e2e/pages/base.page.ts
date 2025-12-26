import { type Page, type Locator } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get loadingSpinner(): Locator {
    return this.page.locator('mat-spinner');
  }

  get snackBar(): Locator {
    // Use specific attribute selector to avoid matching nested elements
    return this.page.locator('[matsnackbarlabel]');
  }

  async waitForLoading(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async waitForSnackBar(text: string): Promise<void> {
    // First wait for the snackbar container to appear
    const snackbar = this.snackBar.filter({ hasText: text });
    await snackbar.first().waitFor({ state: 'visible', timeout: 5000 });
  }

  abstract goto(): Promise<void>;
}
