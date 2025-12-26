/**
 * Playwright Test Fixtures for E2E Tests
 *
 * Extends Playwright's base test with page object fixtures and authentication.
 * Import `test` and `expect` from this file instead of `@playwright/test`.
 *
 * @module e2e/fixtures/test-fixtures
 *
 * @example
 * ```typescript
 * import { test, expect } from '../../fixtures/test-fixtures';
 *
 * test('my test', async ({
 *   authenticatedUser,  // Auto-handles login with seeded account
 *   dashboardPage,      // Dashboard page object
 *   expenseWorkspacePage,
 * }) => {
 *   // Test code here
 * });
 * ```
 */

import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { PropertyFormPage } from '../pages/property-form.page';
import { PropertyDetailPage } from '../pages/property-detail.page';
import { ExpenseWorkspacePage } from '../pages/expense-workspace.page';
import { IncomeWorkspacePage } from '../pages/income-workspace.page';
import { AuthHelper, DEFAULT_TEST_USER } from '../helpers/auth.helper';
import { MailHogHelper } from '../helpers/mailhog.helper';

/**
 * Test user type for authenticated fixtures
 */
export type TestUser = {
  email: string;
  password: string;
};

/**
 * Custom fixture types for E2E tests
 */
type Fixtures = {
  /** Login page object */
  loginPage: LoginPage;
  /** Dashboard page object */
  dashboardPage: DashboardPage;
  /** Property creation form page object */
  propertyFormPage: PropertyFormPage;
  /** Property detail/edit page object */
  propertyDetailPage: PropertyDetailPage;
  /** Expense workspace page object */
  expenseWorkspacePage: ExpenseWorkspacePage;
  /** Income workspace page object */
  incomeWorkspacePage: IncomeWorkspacePage;
  /** Authentication helper for login flows */
  authHelper: AuthHelper;
  /** MailHog helper for email verification (invitation flow) */
  mailhog: MailHogHelper;
  /**
   * Authenticated user fixture.
   *
   * When used, automatically logs in with the seeded owner account
   * before the test runs. The test user data is returned.
   */
  authenticatedUser: TestUser;
};

/**
 * Extended Playwright test with custom fixtures.
 *
 * Use this instead of importing `test` from `@playwright/test`.
 */
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  propertyFormPage: async ({ page }, use) => {
    await use(new PropertyFormPage(page));
  },

  propertyDetailPage: async ({ page }, use) => {
    await use(new PropertyDetailPage(page));
  },

  expenseWorkspacePage: async ({ page }, use) => {
    await use(new ExpenseWorkspacePage(page));
  },

  incomeWorkspacePage: async ({ page }, use) => {
    await use(new IncomeWorkspacePage(page));
  },

  authHelper: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },

  mailhog: async ({}, use) => {
    const mailhogUrl = process.env.MAILHOG_URL || 'http://localhost:8025';
    await use(new MailHogHelper(mailhogUrl));
  },

  /**
   * Authenticated user fixture.
   *
   * This fixture logs in with the pre-seeded owner account.
   * Since public registration has been removed, all E2E tests
   * use this seeded account for authentication.
   */
  authenticatedUser: async ({ page, authHelper }, use) => {
    await authHelper.login();
    await use(DEFAULT_TEST_USER);
  },
});

export { expect };
