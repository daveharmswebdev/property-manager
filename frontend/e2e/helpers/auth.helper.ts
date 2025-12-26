import { type Page } from '@playwright/test';

/**
 * Default test user credentials - the seeded owner account.
 * This account is created automatically when the database is initialized.
 */
export const DEFAULT_TEST_USER = {
  email: 'claude@claude.com',
  password: '1@mClaude',
};

/**
 * AuthHelper - Authentication utilities for E2E tests
 *
 * Provides methods for handling authentication using the seeded owner account.
 * Since public registration has been removed, all E2E tests use the pre-seeded
 * owner account for authentication.
 *
 * @example
 * ```typescript
 * const authHelper = new AuthHelper(page);
 *
 * // Login with default seeded account
 * await authHelper.login();
 *
 * // Or with specific credentials
 * await authHelper.login('other@example.com', 'password');
 * ```
 */
export class AuthHelper {
  private readonly page: Page;

  /**
   * Creates a new AuthHelper instance.
   *
   * @param page - Playwright page instance
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Logs in with the default seeded owner account.
   *
   * This is the primary method for authenticating E2E tests since public
   * registration has been removed and all tests use the pre-seeded account.
   *
   * @param email - Optional email address (defaults to seeded account)
   * @param password - Optional password (defaults to seeded account password)
   */
  async login(email?: string, password?: string): Promise<void> {
    const userEmail = email || DEFAULT_TEST_USER.email;
    const userPassword = password || DEFAULT_TEST_USER.password;

    await this.page.goto('/login');
    await this.page.locator('input[formControlName="email"]').fill(userEmail);
    await this.page.locator('input[formControlName="password"]').fill(userPassword);
    await this.page.locator('button[type="submit"]').click();
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  /**
   * Logs out the current user.
   *
   * Clicks the logout button in the navigation and waits for redirect to login.
   */
  async logout(): Promise<void> {
    await this.page.locator('button', { hasText: 'Logout' }).click();
    await this.page.waitForURL('/login', { timeout: 10000 });
  }
}
