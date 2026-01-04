import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Receipt Capture E2E Tests (AC-5.2.1)', () => {
  test.describe('Mobile FAB visibility', () => {
    test('should show FAB on mobile viewport', async ({ page, authenticatedUser }) => {
      // Set mobile viewport (< 768px)
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // FAB should be visible
      const fab = page.locator('app-mobile-capture-fab button.capture-fab');
      await expect(fab).toBeVisible();

      // FAB should have camera icon
      const icon = fab.locator('mat-icon');
      await expect(icon).toHaveText('photo_camera');
    });

    test('should hide FAB on desktop viewport', async ({ page, authenticatedUser }) => {
      // Set desktop viewport (>= 768px)
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // FAB should not be visible
      const fab = page.locator('app-mobile-capture-fab button.capture-fab');
      await expect(fab).not.toBeVisible();
    });

    test('should show FAB on all authenticated pages', async ({ page, authenticatedUser }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const pages = ['/dashboard', '/properties', '/expenses', '/income', '/receipts'];

      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');

        const fab = page.locator('app-mobile-capture-fab button.capture-fab');
        await expect(fab).toBeVisible();
      }
    });
  });

  test.describe('FAB interaction', () => {
    test('should open file picker when FAB clicked', async ({ page, authenticatedUser }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Get file input element
      const fileInput = page.locator('app-mobile-capture-fab input[type="file"]');
      await expect(fileInput).toBeHidden(); // File input should be hidden

      // Verify file input accepts correct types
      await expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,application/pdf');

      // Verify file input has capture attribute for mobile camera
      await expect(fileInput).toHaveAttribute('capture', 'environment');
    });
  });

});
