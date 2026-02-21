import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Desktop Receipt Upload E2E Tests (Story 16.3)
 *
 * ATDD RED Phase — All tests fail before implementation.
 * Tests verify acceptance criteria AC1-AC7 for desktop receipt upload.
 *
 * API mocking strategy: Uses page.route() to intercept upload endpoints
 * (presigned URL, S3, receipt creation) to avoid database pollution.
 */
test.describe('Desktop Receipt Upload (Story 16.3)', () => {
  // ─────────────────────────────────────────────
  // AC1 — Upload button in page header
  // ─────────────────────────────────────────────
  test.describe('AC1 — Upload button in page header', () => {
    test('should display Upload Receipt button on receipts page', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on the /receipts page at desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // THEN: I see an "Upload Receipt" button
      const uploadBtn = page.locator('[data-testid="upload-receipt-btn"]');
      await expect(uploadBtn).toBeVisible();
    });

    test('should display Upload Receipt button with cloud_upload icon', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on the /receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // THEN: the button has a cloud_upload icon
      const uploadBtn = page.locator('[data-testid="upload-receipt-btn"]');
      const icon = uploadBtn.locator('mat-icon');
      await expect(icon).toHaveText('cloud_upload');
    });

    test('should display page header with title and subtitle', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on the /receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // THEN: page header follows Expenses pattern with title and subtitle
      const header = page.locator('.page-header');
      await expect(header).toBeVisible();
      await expect(header.locator('h1')).toContainText('Receipts');
      await expect(header.locator('.subtitle')).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────
  // AC2 — Drag-and-drop upload dialog
  // ─────────────────────────────────────────────
  test.describe('AC2 — Drag-and-drop upload dialog', () => {
    test('should open upload dialog when Upload Receipt is clicked', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on the /receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // WHEN: I click "Upload Receipt"
      await page.click('[data-testid="upload-receipt-btn"]');

      // THEN: the upload dialog opens with a drag-drop zone
      const dialog = page.locator('mat-dialog-container');
      await expect(dialog).toBeVisible();
      const dropZone = dialog.locator('[data-testid="drag-drop-zone"]');
      await expect(dropZone).toBeVisible();
    });

    test('should show dialog accepting JPEG, PNG, and PDF', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I click "Upload Receipt" and the dialog opens
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="upload-receipt-btn"]');

      // THEN: the file input accepts JPEG, PNG, and PDF
      const dialog = page.locator('mat-dialog-container');
      const fileInput = dialog.locator('[data-testid="file-input"]');
      await expect(fileInput).toHaveAttribute(
        'accept',
        'image/jpeg,image/png,application/pdf'
      );
    });

    test('should show dialog title "Upload Receipts"', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I click "Upload Receipt"
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="upload-receipt-btn"]');

      // THEN: dialog shows "Upload Receipts" title
      const dialogTitle = page.locator(
        'mat-dialog-container [mat-dialog-title]'
      );
      await expect(dialogTitle).toContainText('Upload Receipts');
    });
  });

  // ─────────────────────────────────────────────
  // AC3 — Optional property assignment
  // ─────────────────────────────────────────────
  test.describe('AC3 — Optional property assignment', () => {
    test('should open PropertyTagModal after files selected and Upload clicked', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on the /receipts page and open the upload dialog
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="upload-receipt-btn"]');

      // WHEN: I select a file via the dialog's file input
      const fileInput = page.locator(
        'mat-dialog-container [data-testid="file-input"]'
      );
      await fileInput.setInputFiles({
        name: 'test-receipt.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });

      // AND: I click Upload in the dialog
      const uploadDialogBtn = page.locator(
        'mat-dialog-container button:has-text("Upload")'
      );
      await uploadDialogBtn.click();

      // THEN: PropertyTagModal opens asking "Which property?"
      const propertyDialog = page.locator(
        'mat-dialog-container:has-text("Which property?")'
      );
      await expect(propertyDialog).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────
  // AC4 — Upload success
  // ─────────────────────────────────────────────
  test.describe('AC4 — Upload success', () => {
    test('should show success snackbar after upload completes', async ({
      page,
      authenticatedUser,
    }) => {
      // Mock upload API endpoints BEFORE navigation (network-first pattern)
      await page.route('*/**/api/v1/receipts/upload-url', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadUrl: 'https://mock-s3.example.com/upload',
            storageKey: 'test-storage-key',
          }),
        })
      );

      await page.route('https://mock-s3.example.com/**', (route) =>
        route.fulfill({ status: 200 })
      );

      await page.route('*/**/api/v1/receipts', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'new-receipt-id' }),
          });
        }
        return route.continue();
      });

      // GIVEN: I am on receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // WHEN: I complete the full upload flow
      await page.click('[data-testid="upload-receipt-btn"]');

      const fileInput = page.locator(
        'mat-dialog-container [data-testid="file-input"]'
      );
      await fileInput.setInputFiles({
        name: 'test-receipt.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });

      await page
        .locator('mat-dialog-container button:has-text("Upload")')
        .click();

      // Skip property assignment
      await page
        .locator('mat-dialog-container button:has-text("Skip")')
        .click();

      // THEN: success snackbar appears
      const snackbar = page.locator('[matsnackbarlabel]');
      await expect(snackbar).toContainText('uploaded successfully');
    });
  });

  // ─────────────────────────────────────────────
  // AC5 — Multi-file support
  // ─────────────────────────────────────────────
  test.describe('AC5 — Multi-file support', () => {
    test('should confirm multiple receipts uploaded for multi-file selection', async ({
      page,
      authenticatedUser,
    }) => {
      let uploadCount = 0;

      // Mock upload API endpoints BEFORE navigation
      await page.route('*/**/api/v1/receipts/upload-url', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadUrl: 'https://mock-s3.example.com/upload',
            storageKey: `test-key-${++uploadCount}`,
          }),
        })
      );

      await page.route('https://mock-s3.example.com/**', (route) =>
        route.fulfill({ status: 200 })
      );

      await page.route('*/**/api/v1/receipts', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: `receipt-${uploadCount}` }),
          });
        }
        return route.continue();
      });

      // GIVEN: I am on receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // WHEN: I select multiple files and upload
      await page.click('[data-testid="upload-receipt-btn"]');

      const fileInput = page.locator(
        'mat-dialog-container [data-testid="file-input"]'
      );
      await fileInput.setInputFiles([
        {
          name: 'receipt1.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-1'),
        },
        {
          name: 'receipt2.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake-2'),
        },
        {
          name: 'receipt3.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake-3'),
        },
      ]);

      await page
        .locator('mat-dialog-container button:has-text("Upload")')
        .click();

      // Skip property assignment
      await page
        .locator('mat-dialog-container button:has-text("Skip")')
        .click();

      // THEN: snackbar confirms multiple receipts uploaded
      const snackbar = page.locator('[matsnackbarlabel]');
      await expect(snackbar).toContainText('3 receipts uploaded successfully');
    });
  });

  // ─────────────────────────────────────────────
  // AC6 — Error handling
  // ─────────────────────────────────────────────
  test.describe('AC6 — Error handling', () => {
    test('should show error snackbar when upload fails', async ({
      page,
      authenticatedUser,
    }) => {
      // Mock upload API to fail BEFORE navigation
      await page.route('*/**/api/v1/receipts/upload-url', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      );

      // GIVEN: I am on receipts page
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // WHEN: I attempt to upload a file that fails
      await page.click('[data-testid="upload-receipt-btn"]');

      const fileInput = page.locator(
        'mat-dialog-container [data-testid="file-input"]'
      );
      await fileInput.setInputFiles({
        name: 'test-receipt.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });

      await page
        .locator('mat-dialog-container button:has-text("Upload")')
        .click();

      // Skip property assignment
      await page
        .locator('mat-dialog-container button:has-text("Skip")')
        .click();

      // THEN: error snackbar shows with filename
      const snackbar = page.locator('[matsnackbarlabel]');
      await expect(snackbar).toContainText('Failed to upload');
    });
  });

  // ─────────────────────────────────────────────
  // AC7 — Desktop and tablet viewports
  // ─────────────────────────────────────────────
  test.describe('AC7 — Desktop and tablet viewports', () => {
    test('should show upload button on tablet viewport (768px)', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: I am on any viewport >= 768px wide
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/receipts');
      await page.waitForLoadState('networkidle');

      // THEN: the upload button is visible and functional
      const uploadBtn = page.locator('[data-testid="upload-receipt-btn"]');
      await expect(uploadBtn).toBeVisible();
    });
  });
});
