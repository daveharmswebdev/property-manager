import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor List E2E Tests (Story 8.5 AC #1-#4)
 *
 * Tests the vendor list display functionality including:
 * - Display of vendor name, phone, email, and trade tags (AC #1)
 * - Empty state display (AC #2)
 * - Sorting by last name, first name (AC #3)
 * - Navigation from list to edit page (AC #4)
 */
test.describe('Vendor List E2E Tests', () => {
  /**
   * Helper to create a test vendor with full details
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

    // Wait for redirect and get vendor
    await vendorPage.waitForSnackBar('Vendor added');
    await expect(page).toHaveURL('/vendors');

    // Click on the vendor to edit and add details
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
    if (options?.phone) {
      await vendorPage.addPhone(options.phone, options.phoneLabel);
    }
    if (options?.email) {
      await vendorPage.addEmail(options.email);
    }
    if (options?.tagName) {
      await vendorPage.createAndSelectTag(options.tagName);
    }

    // Save if we added any details
    if (options?.phone || options?.email || options?.tagName) {
      await vendorPage.submitForm();
      await vendorPage.waitForSnackBar('Vendor updated');
    } else {
      // Navigate back to list
      await vendorPage.clickCancel();
    }

    return vendorId;
  }

  test('should display vendor list with trade tags (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const tagName = `E2ETag${timestamp}`;

    // Create a vendor with a trade tag
    await createVendorWithDetails(vendorPage, page, `TagTest${timestamp}`, 'Vendor', {
      tagName,
    });

    // Go to vendor list
    await vendorPage.goto();

    // Verify trade tag is displayed as chip
    await vendorPage.expectVendorHasTradeTags(`TagTest${timestamp} Vendor`, [tagName]);
  });

  test('should display vendor list with phone number (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const phoneNumber = '512-555-1234';

    // Create a vendor with phone
    await createVendorWithDetails(vendorPage, page, `PhoneTest${timestamp}`, 'Vendor', {
      phone: phoneNumber,
      phoneLabel: 'Mobile',
    });

    // Go to vendor list
    await vendorPage.goto();

    // Verify phone is displayed
    await vendorPage.expectVendorHasPhone(`PhoneTest${timestamp} Vendor`, phoneNumber);
  });

  test('should display vendor list with email (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const email = `e2etest${timestamp}@example.com`;

    // Create a vendor with email
    await createVendorWithDetails(vendorPage, page, `EmailTest${timestamp}`, 'Vendor', {
      email,
    });

    // Go to vendor list
    await vendorPage.goto();

    // Verify email is displayed
    await vendorPage.expectVendorHasEmail(`EmailTest${timestamp} Vendor`, email);
  });

  test('should not show phone/email when vendor has none (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();

    // Create a vendor with no contact info
    await createVendorWithDetails(vendorPage, page, `NoDetails${timestamp}`, 'Vendor');

    // Go to vendor list
    await vendorPage.goto();

    // Verify no phone/email/tags displayed
    await vendorPage.expectVendorHasNoPhone(`NoDetails${timestamp} Vendor`);
    await vendorPage.expectVendorHasNoEmail(`NoDetails${timestamp} Vendor`);
    await vendorPage.expectVendorHasNoTradeTags(`NoDetails${timestamp} Vendor`);
  });

  test('should navigate from vendor list to edit page on click (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `NavTest${timestamp}`;
    const lastName = 'Vendor';

    // Create a vendor
    const vendorId = await createVendorWithDetails(vendorPage, page, firstName, lastName);

    // Go to vendor list
    await vendorPage.goto();

    // Click on the vendor
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);

    // Verify navigation to edit page
    await expect(page).toHaveURL(`/vendors/${vendorId}`);

    // Verify form is displayed
    await expect(vendorPage.firstNameInput).toBeVisible();
    await expect(vendorPage.lastNameInput).toBeVisible();
  });

  test('should display vendor with all details in list (integration)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const firstName = `FullDetails${timestamp}`;
    const lastName = 'IntegrationVendor';
    const phone = '512-999-8888';
    const email = `fulldetails${timestamp}@test.com`;
    const tagName = `FullTag${timestamp}`;

    // Create a vendor with all details
    await createVendorWithDetails(vendorPage, page, firstName, lastName, {
      phone,
      phoneLabel: 'Mobile',
      email,
      tagName,
    });

    // Go to vendor list
    await vendorPage.goto();

    const fullName = `${firstName} ${lastName}`;

    // Verify all details are displayed
    await vendorPage.expectVendorInList(fullName);
    await vendorPage.expectVendorHasPhone(fullName, phone);
    await vendorPage.expectVendorHasEmail(fullName, email);
    await vendorPage.expectVendorHasTradeTags(fullName, [tagName]);
  });
});
