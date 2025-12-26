import { test, expect } from '../../fixtures/test-fixtures';
import { DEFAULT_TEST_USER } from '../../helpers/auth.helper';

test.describe('Auth Critical Path', () => {
  test('should successfully login with seeded owner account', async ({
    page,
    loginPage,
    dashboardPage,
  }) => {
    // Navigate to login page
    await loginPage.goto();
    await expect(page).toHaveURL('/login');

    // Login with seeded owner account
    await loginPage.login(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);

    // Verify successful login - redirected to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await dashboardPage.expectWelcome();
  });

  test('should show error for invalid credentials', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login('nonexistent@example.com', 'WrongPassword123!');
    await loginPage.expectError('Invalid email or password');
  });

  test('should show error for wrong password', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(DEFAULT_TEST_USER.email, 'WrongPassword123!');
    await loginPage.expectError('Invalid email or password');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without logging in
    await page.goto('/dashboard');

    // Should be redirected to login (with returnUrl query param)
    await page.waitForURL('**/login**', { timeout: 10000 });
  });

  test('should logout successfully', async ({ page, loginPage, dashboardPage }) => {
    // Login first
    await loginPage.goto();
    await loginPage.login(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Find and click logout button
    await page.locator('button:has-text("Logout")').click();

    // Should be redirected to login
    await page.waitForURL('/login', { timeout: 10000 });
  });
});
