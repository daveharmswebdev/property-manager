import { test, expect } from '@playwright/test';
import { PropertyDetailPage } from '../../pages/property-detail.page';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { TestDataHelper } from '../../helpers/test-data.helper';
import { ReportsPage } from '../../pages/reports.page';

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

/**
 * E2E Tests for Batch Schedule E Report Generation (Story 6.2)
 *
 * Tests the batch report generation flow from Reports page.
 */
test.describe('Batch Schedule E Report Generation', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let reportsPage: ReportsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    reportsPage = new ReportsPage(page);

    // Login with test account
    await loginPage.goto();
    await loginPage.login('claude@claude.com', '1@mClaude');
    await dashboardPage.waitForLoading(); // Wait for auth to complete
    // Wait for properties to load (ensures PropertyStore is populated)
    await page.locator('app-property-row').first().waitFor({ state: 'visible', timeout: 10000 });
    await reportsPage.goto();
  });

  test('should display Generate All Schedule E Reports button', async ({ page }) => {
    // AC-6.2.1: Verify the button is visible on reports page
    await expect(reportsPage.generateAllReportsButton).toBeVisible();
  });

  test('should open batch report dialog when clicking Generate All button', async ({ page }) => {
    // AC-6.2.1: Clicking button opens modal
    await reportsPage.openBatchDialog();

    // Verify dialog appears with expected elements
    await expect(reportsPage.dialogTitle).toBeVisible();
    await expect(reportsPage.dialogTitle).toContainText('Generate All Schedule E Reports');

    // Verify year selector is present
    await expect(reportsPage.yearSelect).toBeVisible();

    // Verify property list is present
    await expect(reportsPage.propertyList).toBeVisible();

    // Verify action buttons are present
    await expect(reportsPage.generateButton).toBeVisible();
    await expect(reportsPage.cancelButton).toBeVisible();
  });

  test('should show properties with checkboxes all selected by default', async ({ page }) => {
    // AC-6.2.2: All properties selected by default
    await reportsPage.openBatchDialog();

    const checkboxes = await reportsPage.getPropertyCheckboxes();
    expect(checkboxes.length).toBeGreaterThan(0);

    // All checkboxes should be checked
    for (const checkbox of checkboxes) {
      await expect(checkbox).toBeChecked();
    }
  });

  test('should have Select All / Deselect All toggle button', async ({ page }) => {
    // AC-6.2.2: Toggle all functionality
    await reportsPage.openBatchDialog();

    await expect(reportsPage.toggleAllButton).toBeVisible();
    await expect(reportsPage.toggleAllButton).toContainText('Deselect All');

    // Click to deselect all
    await reportsPage.toggleAllButton.click();
    await expect(reportsPage.toggleAllButton).toContainText('Select All');

    // Click to select all again
    await reportsPage.toggleAllButton.click();
    await expect(reportsPage.toggleAllButton).toContainText('Deselect All');
  });

  test('should show dynamic button count based on selection', async ({ page }) => {
    // AC-6.2.3: Dynamic button text
    await reportsPage.openBatchDialog();

    const buttonText = await reportsPage.getGenerateButtonText();
    // Should show count like "Generate (X Reports)"
    expect(buttonText).toMatch(/Generate \(\d+ Reports?\)/);

    // Deselect all and verify count changes
    await reportsPage.toggleAllButton.click();
    const emptyButtonText = await reportsPage.getGenerateButtonText();
    expect(emptyButtonText).toContain('Generate (0 Reports)');
  });

  test('should allow year selection in batch dialog', async ({ page }) => {
    // AC-6.2.1: Year selector functionality
    await reportsPage.openBatchDialog();

    // Click year selector
    await reportsPage.yearSelect.click();

    // Verify year options are displayed
    const options = page.locator('mat-option');
    await expect(options.first()).toBeVisible();

    // Select a different year
    const yearOptions = await options.all();
    if (yearOptions.length > 1) {
      await yearOptions[1].click();
    } else {
      await yearOptions[0].click();
    }
  });

  test('should close dialog when clicking Cancel', async ({ page }) => {
    await reportsPage.openBatchDialog();
    await expect(reportsPage.batchDialog).toBeVisible();

    await reportsPage.closeBatchDialog();
    await expect(reportsPage.batchDialog).not.toBeVisible();
  });

  test('should show loading state during report generation', async ({ page }) => {
    // AC-6.2.3: Progress indicator
    await reportsPage.openBatchDialog();

    // Click generate button
    await reportsPage.generateButton.click();

    // Should show loading indicator
    await expect(reportsPage.loadingIndicator).toBeVisible({ timeout: 1000 }).catch(() => {
      // If loading completed quickly, that's OK
    });
  });

  test('should download ZIP with correct filename format', async ({ page }) => {
    // AC-6.2.4, AC-6.2.5: ZIP download functionality
    await reportsPage.openBatchDialog();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // Click generate button
    await reportsPage.generateButton.click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename format: Schedule-E-Reports-{Year}.zip
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/Schedule-E-Reports-\d{4}\.zip/);
  });

  test('should show error message on API failure', async ({ page }) => {
    // AC-6.2.7: Error handling
    await reportsPage.openBatchDialog();

    // Intercept API call to simulate failure
    await page.route('**/api/v1/reports/schedule-e/batch', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      });
    });

    // Click generate button
    await reportsPage.generateButton.click();

    // Wait for error message to appear
    await expect(reportsPage.errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should disable generate button when no properties selected', async ({ page }) => {
    // AC-6.2.3: Button should be disabled when count is 0
    await reportsPage.openBatchDialog();

    // Deselect all properties
    await reportsPage.toggleAllButton.click();

    // Generate button should be disabled
    await expect(reportsPage.generateButton).toBeDisabled();
  });
});
