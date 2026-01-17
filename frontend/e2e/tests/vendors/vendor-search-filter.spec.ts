import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor Search & Filter E2E Tests (Story 8-6 AC #1-#4)
 *
 * Tests the vendor search and filter functionality including:
 * - Search by first name (AC #1)
 * - Search by last name (AC #1)
 * - Search by partial name (AC #1)
 * - Trade tag filter (AC #2)
 * - Combined filters (AC #3)
 * - Clear filters (AC #3)
 * - No matches state (AC #4)
 */
test.describe('Vendor Search & Filter E2E Tests (Story 8-6)', () => {
  /**
   * Helper to create a test vendor with trade tag
   */
  async function createVendorWithTag(
    vendorPage: any,
    page: any,
    firstName: string,
    lastName: string,
    tagName: string
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

    // Click on the vendor to edit and add trade tag
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

    // Add trade tag
    await vendorPage.createAndSelectTag(tagName);
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');

    return vendorId;
  }

  /**
   * Helper to create a simple vendor without details
   */
  async function createSimpleVendor(
    vendorPage: any,
    page: any,
    firstName: string,
    lastName: string
  ): Promise<void> {
    await vendorPage.goto();
    await vendorPage.clickAddVendor();
    await expect(page).toHaveURL('/vendors/new');

    await vendorPage.fillName(firstName, lastName);
    await vendorPage.submitForm();

    await vendorPage.waitForSnackBar('Vendor added');
    await expect(page).toHaveURL('/vendors');
  }

  test('7.2 - should filter vendors by first name (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const uniqueName = `SearchFirst${timestamp}`;

    // Create a vendor with unique first name
    await createSimpleVendor(vendorPage, page, uniqueName, 'TestLastName');

    // Go to vendor list and wait for the vendor to be visible (confirms API loaded)
    await vendorPage.goto();
    await vendorPage.expectVendorInList(`${uniqueName} TestLastName`);

    // Now filter bar should be visible
    await vendorPage.expectFilterBarVisible();
    await vendorPage.searchVendors(uniqueName);

    // Verify only the matching vendor is shown
    await vendorPage.expectVendorInList(`${uniqueName} TestLastName`);
    await vendorPage.expectClearFiltersVisible();
  });

  test('7.3 - should filter vendors by last name (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const uniqueLastName = `LastName${timestamp}`;

    // Create a vendor with unique last name
    await createSimpleVendor(vendorPage, page, 'TestFirstName', uniqueLastName);

    // Go to vendor list and search by last name
    await vendorPage.goto();
    await vendorPage.searchVendors(uniqueLastName);

    // Verify the matching vendor is shown
    await vendorPage.expectVendorInList(`TestFirstName ${uniqueLastName}`);
  });

  test('7.4 - should filter vendors by partial name (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const uniquePrefix = `Partial${timestamp}`;

    // Create two vendors with similar names
    await createSimpleVendor(vendorPage, page, `${uniquePrefix}Alpha`, 'TestVendor');
    await createSimpleVendor(vendorPage, page, `${uniquePrefix}Beta`, 'TestVendor');

    // Go to vendor list and search by partial name
    await vendorPage.goto();
    await vendorPage.searchVendors(uniquePrefix);

    // Both vendors should be visible
    await vendorPage.expectVendorInList(`${uniquePrefix}Alpha TestVendor`);
    await vendorPage.expectVendorInList(`${uniquePrefix}Beta TestVendor`);
  });

  test('7.5 - should filter vendors by trade tag (AC #2)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const uniqueTag = `TagFilter${timestamp}`;
    const vendorName = `TagTest${timestamp}`;

    // Create a vendor with a unique trade tag
    await createVendorWithTag(vendorPage, page, vendorName, 'FilterVendor', uniqueTag);

    // Go to vendor list and filter by trade tag
    await vendorPage.goto();
    await vendorPage.selectTradeTagFilters([uniqueTag]);

    // Verify the matching vendor is shown
    await vendorPage.expectVendorInList(`${vendorName} FilterVendor`);
    await vendorPage.expectClearFiltersVisible();
  });

  test('7.6 - should apply combined search and tag filters (AC #3)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const uniqueTag = `CombinedTag${timestamp}`;
    const vendorName = `Combined${timestamp}`;

    // Create a vendor with name and tag
    await createVendorWithTag(vendorPage, page, vendorName, 'ComboVendor', uniqueTag);

    // Go to vendor list
    await vendorPage.goto();

    // Apply both search and tag filter
    await vendorPage.searchVendors(vendorName);
    await vendorPage.selectTradeTagFilters([uniqueTag]);

    // Verify the matching vendor is shown
    await vendorPage.expectVendorInList(`${vendorName} ComboVendor`);
    await vendorPage.expectClearFiltersVisible();
  });

  test('7.7 - should clear filters and restore full list (AC #3)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const vendorName = `ClearTest${timestamp}`;

    // Create a vendor
    await createSimpleVendor(vendorPage, page, vendorName, 'ClearVendor');

    // Go to vendor list and apply a filter
    await vendorPage.goto();
    await vendorPage.searchVendors('nonexistentvendor');

    // Verify no matches state or empty list
    await vendorPage.expectClearFiltersVisible();

    // Clear filters
    await vendorPage.clickClearFilters();

    // Verify the vendor is now visible
    await vendorPage.expectVendorInList(`${vendorName} ClearVendor`);
    await vendorPage.expectClearFiltersHidden();
  });

  test('7.8 - should show "No vendors match" when search has no results (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();

    // Create a vendor first to ensure we have vendors
    await createSimpleVendor(vendorPage, page, `NoMatch${timestamp}`, 'TestVendor');

    // Go to vendor list and search for nonexistent vendor
    await vendorPage.goto();
    await vendorPage.searchVendors(`xyz_nonexistent_${timestamp}`);

    // Verify no matches state is shown
    await vendorPage.expectNoMatchesState();
    await vendorPage.expectClearFiltersVisible();

    // Click clear filters from no matches card
    await vendorPage.clickClearFilters();

    // Verify vendors are visible again
    await vendorPage.expectNoMatchesStateHidden();
  });

  test('should show filter bar when vendors exist', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();

    // Create a vendor
    await createSimpleVendor(vendorPage, page, `FilterBar${timestamp}`, 'TestVendor');

    // Go to vendor list
    await vendorPage.goto();

    // Verify filter bar is visible
    await vendorPage.expectFilterBarVisible();
  });

  test('search should be case-insensitive (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    const timestamp = Date.now();
    const vendorName = `CaseTest${timestamp}`;

    // Create a vendor
    await createSimpleVendor(vendorPage, page, vendorName, 'Vendor');

    // Go to vendor list and search with different case
    await vendorPage.goto();
    await vendorPage.searchVendors(vendorName.toLowerCase());

    // Verify the vendor is still found
    await vendorPage.expectVendorInList(`${vendorName} Vendor`);
  });
});
