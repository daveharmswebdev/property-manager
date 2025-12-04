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
    return this.page.locator('.mat-mdc-snack-bar-label');
  }

  async waitForLoading(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async waitForSnackBar(text: string): Promise<void> {
    await this.snackBar.filter({ hasText: text }).waitFor({ state: 'visible' });
  }

  abstract goto(): Promise<void>;
}
