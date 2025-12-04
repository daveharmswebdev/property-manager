import { type Page } from '@playwright/test';
import { MailHogHelper } from './mailhog.helper';
import { TestDataHelper, type TestUser } from './test-data.helper';

export class AuthHelper {
  private readonly page: Page;
  private readonly mailhog: MailHogHelper;

  constructor(page: Page, mailhogUrl?: string) {
    this.page = page;
    this.mailhog = new MailHogHelper(mailhogUrl);
  }

  async registerAndLogin(user?: TestUser): Promise<TestUser> {
    const testUser = user || TestDataHelper.generateTestUser();

    // Note: Don't delete all messages here - causes race conditions with parallel tests
    // Each test uses unique email addresses, so we can filter by email

    // Register
    await this.page.goto('/register');
    await this.page.locator('input[formControlName="accountName"]').fill(testUser.accountName);
    await this.page.locator('input[formControlName="email"]').fill(testUser.email);
    await this.page.locator('input[formControlName="password"]').fill(testUser.password);
    await this.page.locator('input[formControlName="confirmPassword"]').fill(testUser.password);
    await this.page.locator('button[type="submit"]').click();

    // Wait for success message
    await this.page.locator('.success-content').waitFor({ state: 'visible' });

    // Get verification token from MailHog
    const token = await this.mailhog.getVerificationToken(testUser.email);

    // Verify email - wait for success state then redirect (component has 3s delay)
    await this.page.goto(`/verify-email?token=${token}`);
    await this.page.locator('.success-icon, mat-icon:has-text("check_circle")').waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForURL('/login', { timeout: 10000 });

    // Login
    await this.page.locator('input[formControlName="email"]').fill(testUser.email);
    await this.page.locator('input[formControlName="password"]').fill(testUser.password);
    await this.page.locator('button[type="submit"]').click();

    // Wait for dashboard
    await this.page.waitForURL('/dashboard', { timeout: 10000 });

    return testUser;
  }
}
