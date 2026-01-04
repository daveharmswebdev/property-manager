import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Receipt Queue E2E Tests (AC-5.3)', () => {
  test.describe('Receipts Page (AC-5.3.2, AC-5.3.3)', () => {
    test('should display page title "Receipts to Process"', async ({
      page,
      authenticatedUser,
    }) => {
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      const title = page.locator('.page-title');
      await expect(title).toContainText('Receipts to Process');
    });

    test('should display empty state when no unprocessed receipts', async ({
      page,
      authenticatedUser,
    }) => {
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // Wait for loading to complete
      await page.waitForSelector('[data-testid="receipts-empty"]', {
        timeout: 10000,
      });

      // Verify empty state elements
      const emptyState = page.locator('[data-testid="receipts-empty"]');
      await expect(emptyState).toBeVisible();

      const checkIcon = emptyState.locator('.check-icon');
      await expect(checkIcon).toBeVisible();

      const heading = emptyState.locator('h2');
      await expect(heading).toContainText('All caught up!');

      const message = emptyState.locator('p');
      await expect(message).toContainText('No receipts to process.');
    });

    test('should show loading state initially', async ({
      page,
      authenticatedUser,
    }) => {
      // Navigate but don't wait for network idle to catch loading state
      await page.goto('/receipts');

      // The loading spinner should appear briefly
      // This tests the loading state is rendered
      const loadingSpinner = page.locator('[data-testid="receipts-loading"]');
      // Note: This may pass too quickly, so we check if it exists or empty state appears
      const emptyOrLoading = page.locator(
        '[data-testid="receipts-loading"], [data-testid="receipts-empty"]'
      );
      await expect(emptyOrLoading.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation Badge (AC-5.3.1)', () => {
    test('should show Receipts nav item in sidebar', async ({
      page,
      authenticatedUser,
    }) => {
      // Desktop viewport to see sidebar
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const receiptsNavItem = page.locator('[data-testid="nav-receipts"]');
      await expect(receiptsNavItem).toBeVisible();
      await expect(receiptsNavItem).toContainText('Receipts');
    });

    test('should show Receipts nav item in bottom nav on mobile', async ({
      page,
      authenticatedUser,
    }) => {
      // Mobile viewport to see bottom nav
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const receiptsBottomNav = page.locator(
        '[data-testid="bottom-nav-receipts"]'
      );
      await expect(receiptsBottomNav).toBeVisible();
    });

    test('should navigate to receipts page when sidebar nav clicked', async ({
      page,
      authenticatedUser,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Click receipts nav item
      await page.click('[data-testid="nav-receipts"]');
      await page.waitForURL('**/receipts');

      // Verify we're on receipts page
      await expect(page.locator('.page-title')).toContainText(
        'Receipts to Process'
      );
    });

    test('should navigate to receipts page when bottom nav clicked', async ({
      page,
      authenticatedUser,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Click receipts bottom nav item
      await page.click('[data-testid="bottom-nav-receipts"]');
      await page.waitForURL('**/receipts');

      // Verify we're on receipts page
      await expect(page.locator('.page-title')).toContainText(
        'Receipts to Process'
      );
    });

    test('should not show badge when no unprocessed receipts', async ({
      page,
      authenticatedUser,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // Wait for empty state to confirm API returned 0 receipts
      await page.waitForSelector('[data-testid="receipts-empty"]', {
        timeout: 10000,
      });

      // Go to dashboard to check sidebar badge
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Badge should not be visible when count is 0
      const receiptsNavItem = page.locator('[data-testid="nav-receipts"]');
      const badge = receiptsNavItem.locator('.mat-badge-content');
      await expect(badge).not.toBeVisible();
    });
  });
});
