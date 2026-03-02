import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor Detail Page E2E Tests (Story 8.9)
 *
 * Tests the vendor detail page functionality including:
 * - Navigation to detail page from list (AC #1)
 * - Display of vendor information (AC #2)
 * - Display of contact information (AC #3)
 * - Display of trade tags (AC #4)
 * - Work order history placeholder (AC #5)
 * - Edit navigation (AC #6)
 * - Delete functionality (AC #7)
 * - Back navigation
 */
test.describe('Vendor Detail Page E2E Tests (Story 8.9)', () => {
  /**
   * Create a test vendor with full details
   * Returns vendor ID. After this function, user is on the vendor list page.
   */
  async function createVendorWithDetails(
    vendorPage: any,
    page: any,
    firstName: string,
    lastName: string,
    options?: {
      phone?: string;
      phoneLabel?: string;
      email?: string;
      tagName?: string;
    }
  ): Promise<string> {
    await vendorPage.goto();
    await vendorPage.clickAddVendor();
    await expect(page).toHaveURL('/vendors/new');

    // Fill basic info
    await vendorPage.fillName(firstName, lastName);
    await vendorPage.submitForm();

    // Wait for redirect
    await vendorPage.waitForSnackBar('Vendor added');
    await expect(page).toHaveURL('/vendors');

    // Click on the vendor to go to detail page
    const fullName = `${firstName} ${lastName}`;
    await vendorPage.clickVendorByName(fullName);
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);

    // Extract vendor ID
    const url = page.url();
    const match = url.match(/\/vendors\/([a-f0-9-]+)/);
    if (!match) {
      throw new Error(`Could not extract vendor ID from URL: ${url}`);
    }
    const vendorId = match[1];

    // Add details if provided
    if (options?.phone || options?.email || options?.tagName) {
      await vendorPage.clickEditFromDetail();
      await page.waitForURL(/\/vendors\/[a-f0-9-]+\/edit$/);

      if (options?.phone) {
        await vendorPage.addPhone(options.phone, options.phoneLabel);
      }
      if (options?.email) {
        await vendorPage.addEmail(options.email);
      }
      if (options?.tagName) {
        await vendorPage.createAndSelectTag(options.tagName);
      }

      await vendorPage.submitForm();
      await vendorPage.waitForSnackBar('Vendor updated');
      // After save, we're on detail page
    }

    // Go back to list
    await vendorPage.goto();
    return vendorId;
  }

  test('should navigate to detail page from vendor list (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `DetailNav${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Go to vendor list and click on vendor
    await vendorPage.goto();
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);

    // Verify we're on the detail page (not edit)
    await expect(page).toHaveURL(`/vendors/${vendorId}`);
    await vendorPage.expectDetailPageVisible();
  });

  test('should display vendor name and action buttons (AC #2)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `DisplayTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Verify vendor name is displayed
    await vendorPage.expectDetailVendorName(`${firstName} ${lastName}`);

    // Verify action buttons are visible
    await vendorPage.expectDetailEditButtonVisible();
    await vendorPage.expectDetailDeleteButtonVisible();
  });

  test('should display contact information (AC #3)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `ContactTest${timestamp}`;
    const lastName = 'Vendor';
    const phone = '512-555-9876';
    const email = `contact${timestamp}@test.com`;

    // Create a vendor with contact details
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName, {
      phone,
      phoneLabel: 'Mobile',
      email,
    });

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Verify contact section is visible
    await vendorPage.expectDetailContactSectionVisible();


    // Verify phone and email are displayed (phone mask stores digits, pipe formats to (XXX) XXX-XXXX)
    await vendorPage.expectDetailHasPhone('(512) 555-9876');
    await vendorPage.expectDetailHasEmail(email);
  });

  test('should display trade tags (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `TagTest${timestamp}`;
    const lastName = 'Vendor';
    const tagName = `E2ETag${timestamp}`;

    // Create a vendor with trade tag
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName, {
      tagName,
    });

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Verify trade tags section is visible
    await vendorPage.expectDetailTradeTagsSectionVisible();

    // Verify tag is displayed
    await vendorPage.expectDetailHasTradeTag(tagName);
  });

  test('should display work order history placeholder (AC #5)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `WorkOrderTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Verify work order section is visible with placeholder
    await vendorPage.expectDetailWorkOrderSectionVisible();
    await vendorPage.expectWorkOrderPlaceholder();
  });

  test('should navigate to edit page from detail (AC #6)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `EditNav${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Click Edit button
    await vendorPage.clickEditFromDetail();

    // Verify navigation to edit page
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);

    // Verify edit form is displayed
    await expect(vendorPage.firstNameInput).toBeVisible();
    await expect(vendorPage.lastNameInput).toBeVisible();
  });

  test('should show delete confirmation dialog (AC #7)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `DeleteTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Click Delete button
    await vendorPage.clickDeleteFromDetail();

    // Verify confirmation dialog appears
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('mat-dialog-container')).toContainText(`Delete ${firstName} ${lastName}?`);
  });

  test('should delete vendor and redirect to list (AC #7)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `DeleteConfirm${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Click Delete button
    await vendorPage.clickDeleteFromDetail();

    // Confirm deletion
    await page.locator('mat-dialog-container button', { hasText: 'Delete' }).click();

    // Wait for snackbar and redirect
    await vendorPage.waitForSnackBar('Vendor deleted');
    await expect(page).toHaveURL('/vendors');

    // Verify vendor is no longer in list
    await vendorPage.expectVendorNotInList(`${firstName} ${lastName}`);
  });

  test('should navigate back to vendor list', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `BackNav${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page
    await vendorPage.gotoDetail(vendorId);

    // Click Back button
    await vendorPage.clickBackFromDetail();

    // Verify navigation to vendor list
    await expect(page).toHaveURL('/vendors');
  });

  test('should cancel in edit and return to detail page', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `CancelTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page then to edit
    await vendorPage.gotoDetail(vendorId);
    await vendorPage.clickEditFromDetail();
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);

    // Click cancel (no changes made, so no dialog)
    await vendorPage.clickCancel();

    // Should return to detail page
    await expect(page).toHaveURL(`/vendors/${vendorId}`);
    await vendorPage.expectDetailPageVisible();
  });

  test('should save in edit and return to detail page', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `SaveTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Navigate to detail page then to edit
    await vendorPage.gotoDetail(vendorId);
    await vendorPage.clickEditFromDetail();
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);

    // Make a change and save
    await vendorPage.addPhone('512-555-4321', 'Mobile');
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');

    // Should return to detail page
    await expect(page).toHaveURL(`/vendors/${vendorId}`);
    await vendorPage.expectDetailPageVisible();

    // Verify the change is shown on detail page (phone mask stores digits, pipe formats to (XXX) XXX-XXXX)
    await vendorPage.expectDetailHasPhone('(512) 555-4321');
  });
});
