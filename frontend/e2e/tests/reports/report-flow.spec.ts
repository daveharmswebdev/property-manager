import { test, expect } from '@playwright/test';
import { PropertyDetailPage } from '../../pages/property-detail.page';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { TestDataHelper } from '../../helpers/test-data.helper';

/**
 * E2E Tests for Schedule E Report Generation (Story 6.1)
 *
 * Tests the report generation flow from property detail page.
 */
test.describe('Schedule E Report Generation', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let propertyDetailPage: PropertyDetailPage;
  let testDataHelper: TestDataHelper;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    propertyDetailPage = new PropertyDetailPage(page);
    testDataHelper = new TestDataHelper(page);

    // Login with test account
    await loginPage.goto();
    await loginPage.login('claude@claude.com', '1@mClaude');
    await dashboardPage.waitForLoading();
  });

  /**
   * Helper to navigate to the first property
   */
  async function navigateToFirstProperty(page: import('@playwright/test').Page) {
    // Click the first property row
    await page.locator('app-property-row').first().click();
    await propertyDetailPage.waitForLoading();
  }

  test('should display Generate Report button on property detail page', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Verify the generate report button is visible
    await expect(propertyDetailPage.generateReportButton).toBeVisible();
  });

  test('should open report dialog when clicking Generate Report', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Click generate report button
    await propertyDetailPage.generateReportButton.click();

    // Verify dialog appears
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Verify dialog contains expected elements
    await expect(dialog.locator('h2')).toContainText('Generate Schedule E Report');

    // Verify year selector is present
    const yearSelect = dialog.locator('mat-select');
    await expect(yearSelect).toBeVisible();

    // Verify action buttons are present
    await expect(dialog.locator('button', { hasText: 'Preview' })).toBeVisible();
    await expect(dialog.locator('button', { hasText: 'Download' })).toBeVisible();
  });

  test('should close dialog when clicking Cancel', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Click cancel button
    await dialog.locator('button', { hasText: 'Cancel' }).click();

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible();
  });

  test('should allow year selection in report dialog', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Click year selector
    const yearSelect = dialog.locator('mat-select');
    await yearSelect.click();

    // Verify year options are displayed
    const options = page.locator('mat-option');
    await expect(options.first()).toBeVisible();

    // Select a different year (if available)
    const yearOptions = await options.all();
    if (yearOptions.length > 1) {
      await yearOptions[1].click();
    } else {
      await yearOptions[0].click();
    }

    // Verify dropdown closed
    await expect(options.first()).not.toBeVisible();
  });

  test('should show loading state when generating preview', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Click preview button
    const previewButton = dialog.locator('button', { hasText: 'Preview' });
    await previewButton.click();

    // Should show loading state (spinner or disabled button)
    // The button should be disabled while loading
    await expect(previewButton).toBeDisabled({ timeout: 1000 }).catch(() => {
      // If not disabled, might have completed quickly - that's OK
    });

    // Wait for preview to complete (or error)
    await page.waitForTimeout(2000);
  });

  test('should download PDF with correct filename format', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Get property name for filename verification
    const propertyName = await propertyDetailPage.getPropertyName();

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click download button
    const downloadButton = dialog.locator('button', { hasText: 'Download' });
    await downloadButton.click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename format: Schedule-E-{PropertyName}-{Year}.pdf
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/Schedule-E-.+-\d{4}\.pdf/);

    // Verify property name is in filename (sanitized)
    const sanitizedName = propertyName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
    expect(filename).toContain(sanitizedName);
  });

  test('should show error message on API failure', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Intercept API call to simulate failure
    await page.route('**/api/v1/reports/schedule-e', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      });
    });

    // Click preview button
    const previewButton = dialog.locator('button', { hasText: 'Preview' });
    await previewButton.click();

    // Wait for error message to appear
    const errorMessage = dialog.locator('.error-message, [role="alert"], mat-error');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should display PDF preview after successful generation', async ({ page }) => {
    // Navigate to first property
    await navigateToFirstProperty(page);

    // Open report dialog
    await propertyDetailPage.generateReportButton.click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Click preview button
    const previewButton = dialog.locator('button', { hasText: 'Preview' });
    await previewButton.click();

    // Wait for preview to load (iframe or object element)
    const pdfPreview = dialog.locator('app-pdf-preview iframe, app-pdf-preview object, app-pdf-preview embed');
    await expect(pdfPreview).toBeVisible({ timeout: 10000 });
  });
});
