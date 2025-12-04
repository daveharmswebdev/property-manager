import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly welcomeHeader: Locator;
  readonly addPropertyButton: Locator;
  readonly propertyList: Locator;
  readonly propertyRows: Locator;
  readonly emptyState: Locator;
  readonly statsBar: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeHeader = page.locator('.dashboard-header h1');
    this.addPropertyButton = page.locator('button', { hasText: 'Add Property' });
    this.propertyList = page.locator('.properties-list-card');
    this.propertyRows = page.locator('app-property-row');
    this.emptyState = page.locator('app-empty-state');
    this.statsBar = page.locator('app-stats-bar');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  async expectWelcome(): Promise<void> {
    await expect(this.welcomeHeader).toContainText('Welcome back');
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  async expectPropertyCount(count: number): Promise<void> {
    await expect(this.propertyRows).toHaveCount(count);
  }

  async clickAddProperty(): Promise<void> {
    await this.addPropertyButton.first().click();
  }

  async clickProperty(name: string): Promise<void> {
    await this.page.locator('app-property-row', { hasText: name }).click();
  }
}
