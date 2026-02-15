/**
 * ATDD E2E Tests — Story 15-1: Login Form Fixes (RED Phase)
 *
 * These tests describe expected behavior after all ACs are implemented.
 * They MUST fail before implementation and pass after.
 *
 * Run with: npm run test:e2e (from /frontend) — or specific:
 *   npm run test:e2e -- --grep "Story 15-1"
 */
import { test, expect } from '../../fixtures/test-fixtures';
import { DEFAULT_TEST_USER } from '../../helpers/auth.helper';

test.describe('Story 15-1: Login Form Fixes', () => {
  // ---------------------------------------------------------------------------
  // AC1: Stricter email validation (GitHub #198)
  // ---------------------------------------------------------------------------
  test('AC1: should show validation error for email without TLD before server submit', async ({
    page,
    loginPage,
  }) => {
    // GIVEN: User is on the login page
    await loginPage.goto();

    // WHEN: User enters email without TLD and moves focus
    await loginPage.emailInput.fill('user@g');
    await loginPage.passwordInput.focus();

    // THEN: A field-level validation error appears
    const emailFieldError = page
      .locator('mat-form-field', { has: page.locator('input[formControlName="email"]') })
      .locator('mat-error');
    await expect(emailFieldError).toBeVisible();

    // AND: No server-side error (form prevented submission)
    await expect(loginPage.serverError).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC2: Remove "Remember me" checkbox (GitHub #199)
  // ---------------------------------------------------------------------------
  test('AC2: should not display Remember me checkbox on login page', async ({
    page,
    loginPage,
  }) => {
    // GIVEN: User is on the login page
    await loginPage.goto();

    // WHEN: Viewing the form
    // THEN: No "Remember me" checkbox is visible
    const rememberMeCheckbox = page.locator('mat-checkbox');
    await expect(rememberMeCheckbox).not.toBeVisible();

    // AND: "Forgot password?" link is still present
    await expect(page.locator('a[routerLink="/forgot-password"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC3: Honor returnUrl after login (GitHub #200)
  // ---------------------------------------------------------------------------
  test('AC3: should redirect to original destination after login via returnUrl', async ({
    page,
    loginPage,
  }) => {
    // GIVEN: Unauthenticated user tries to access protected route
    await page.goto('/properties');

    // Auth guard should redirect to /login with returnUrl query param
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('returnUrl');

    // WHEN: User logs in successfully
    await loginPage.login(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);

    // THEN: Redirected to the ORIGINAL destination (/properties), NOT /dashboard
    await page.waitForURL('**/properties**', { timeout: 10000 });
    expect(page.url()).not.toContain('/dashboard');
  });

  test('AC3: should redirect to /dashboard when no returnUrl is present', async ({
    page,
    loginPage,
  }) => {
    // GIVEN: User navigates directly to login (no returnUrl)
    await loginPage.goto();

    // WHEN: User logs in successfully
    await loginPage.login(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);

    // THEN: Redirected to default /dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });
});
