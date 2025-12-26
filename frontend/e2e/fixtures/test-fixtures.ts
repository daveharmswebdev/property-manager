import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { DashboardPage } from '../pages/dashboard.page';
import { PropertyFormPage } from '../pages/property-form.page';
import { PropertyDetailPage } from '../pages/property-detail.page';
import { ExpenseWorkspacePage } from '../pages/expense-workspace.page';
import { IncomeWorkspacePage } from '../pages/income-workspace.page';
import { AuthHelper } from '../helpers/auth.helper';
import { MailHogHelper } from '../helpers/mailhog.helper';
import { type TestUser } from '../helpers/test-data.helper';

type Fixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  propertyFormPage: PropertyFormPage;
  propertyDetailPage: PropertyDetailPage;
  expenseWorkspacePage: ExpenseWorkspacePage;
  incomeWorkspacePage: IncomeWorkspacePage;
  authHelper: AuthHelper;
  mailhog: MailHogHelper;
  authenticatedUser: TestUser;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
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
    const mailhogUrl = process.env.MAILHOG_URL || 'http://localhost:8025';
    await use(new AuthHelper(page, mailhogUrl));
  },

  mailhog: async ({}, use) => {
    const mailhogUrl = process.env.MAILHOG_URL || 'http://localhost:8025';
    await use(new MailHogHelper(mailhogUrl));
  },

  authenticatedUser: async ({ page, authHelper }, use) => {
    const user = await authHelper.registerAndLogin();
    await use(user);
  },
});

export { expect };
