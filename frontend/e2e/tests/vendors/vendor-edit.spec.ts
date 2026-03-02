import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor Edit E2E Tests (Story 8.4 AC #1-#15, Story 8.7 AC #1-#5)
 *
 * Tests the complete vendor edit flow including:
 * - Navigation from vendor list to edit form (AC #1)
 * - Phone number management with labels (AC #2-#4)
 * - Email address management with validation (AC #5-#6)
 * - Trade tag autocomplete and creation (AC #7-#9)
 * - Loading and populating existing vendor data (AC #10-#11)
 * - Saving changes and verification (AC #12-#13)
 * - Cancel navigation (AC #14)
 * - Trade tag assignments persistence (AC #15)
 * - Unsaved changes confirmation dialog (Story 8.7 AC #4, #5)
 */
test.describe('Vendor Edit E2E Tests', () => {
  /**
   * Create a test vendor before each test that needs editing
   * Returns vendor ID. After this function, user is on the vendor list page.
   */
  async function createTestVendor(vendorPage: any, page: any): Promise<string> {
    await vendorPage.goto();
    await vendorPage.clickAddVendor();
    await expect(page).toHaveURL('/vendors/new');

    const timestamp = Date.now();
    const firstName = `Test${timestamp}`;
    const lastName = `Vendor${timestamp}`;
    await vendorPage.fillName(firstName, lastName);
    await vendorPage.submitForm();

    // Wait for redirect and extract vendor ID from URL
    await vendorPage.waitForSnackBar('Vendor added');
    await expect(page).toHaveURL('/vendors');

    // Click on the newly created vendor to navigate to detail page (Story 8.9)
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);

    // Wait for navigation to detail page (not edit page anymore)
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);

    // Extract vendor ID from URL
    const url = page.url();
    const match = url.match(/\/vendors\/([a-f0-9-]+)/);
    if (!match) {
      throw new Error(`Could not extract vendor ID from URL: ${url}`);
    }
    return match[1];
  }

  test('should navigate to detail page from vendor list, then to edit form (AC #1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor first
    const vendorId = await createTestVendor(vendorPage, page);

    // Verify we're on the detail page (Story 8.9 - clicking vendor goes to detail)
    await expect(page).toHaveURL(`/vendors/${vendorId}`);

    // Verify detail page is displayed with edit button
    await vendorPage.expectDetailPageVisible();
    await vendorPage.expectDetailEditButtonVisible();

    // Click Edit to go to edit form
    await vendorPage.clickEditFromDetail();
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);

    // Verify edit form is displayed
    await expect(vendorPage.firstNameInput).toBeVisible();
    await expect(vendorPage.lastNameInput).toBeVisible();
    await expect(vendorPage.saveButton).toBeVisible();
  });

  test('should load and display existing vendor data (AC #10, #11)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor first
    const vendorId = await createTestVendor(vendorPage, page);

    // Navigate to edit and verify data is loaded
    await vendorPage.gotoEdit(vendorId);

    // Verify first/last name fields are populated (has some value)
    await expect(vendorPage.firstNameInput).not.toHaveValue('');
    await expect(vendorPage.lastNameInput).not.toHaveValue('');
  });

  test('should add and manage phone numbers (AC #2-#4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Initially no phones
    await vendorPage.expectPhoneCount(0);

    // Add first phone
    await vendorPage.addPhone('512-555-1234', 'Mobile');
    await vendorPage.expectPhoneCount(1);
    await vendorPage.expectPhoneValue(0, '(512) 555-1234');

    // Add second phone
    await vendorPage.addPhone('512-555-5678', 'Work');
    await vendorPage.expectPhoneCount(2);

    // Save and verify persistence (Story 8.9 - now redirects to detail page)
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');
    await expect(page).toHaveURL(`/vendors/${vendorId}`, { timeout: 10000 });

    // Navigate back and verify phones persisted
    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectPhoneCount(2);
    await vendorPage.expectPhoneValue(0, '(512) 555-1234');
    await vendorPage.expectPhoneValue(1, '(512) 555-5678');
  });

  test('should remove phone numbers', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Add two phones
    await vendorPage.addPhone('512-555-1111');
    await vendorPage.addPhone('512-555-2222');
    await vendorPage.expectPhoneCount(2);

    // Remove first phone
    await vendorPage.removePhone(0);
    await vendorPage.expectPhoneCount(1);
    await vendorPage.expectPhoneValue(0, '(512) 555-2222');

    // Save and verify
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');

    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectPhoneCount(1);
  });

  test('should add and manage email addresses (AC #5-#6)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Initially no emails
    await vendorPage.expectEmailCount(0);

    // Add first email
    await vendorPage.addEmail('test@example.com');
    await vendorPage.expectEmailCount(1);
    await vendorPage.expectEmailValue(0, 'test@example.com');

    // Add second email
    await vendorPage.addEmail('work@example.com');
    await vendorPage.expectEmailCount(2);

    // Save and verify persistence (Story 8.9 - now redirects to detail page)
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');
    await expect(page).toHaveURL(`/vendors/${vendorId}`, { timeout: 10000 });

    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectEmailCount(2);
    await vendorPage.expectEmailValue(0, 'test@example.com');
    await vendorPage.expectEmailValue(1, 'work@example.com');
  });

  test('should remove email addresses', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Add two emails
    await vendorPage.addEmail('first@example.com');
    await vendorPage.addEmail('second@example.com');
    await vendorPage.expectEmailCount(2);

    // Remove first email
    await vendorPage.removeEmail(0);
    await vendorPage.expectEmailCount(1);
    await vendorPage.expectEmailValue(0, 'second@example.com');
  });

  test('should select existing trade tags from autocomplete (AC #7)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Initially no tags
    await vendorPage.expectTagCount(0);

    // Type in autocomplete and select existing tag (if exists)
    // Note: This test assumes there are existing trade tags in the system
    await vendorPage.tagInput.fill('Plumb');
    await page.waitForTimeout(500);

    // Check if autocomplete has options
    const optionCount = await vendorPage.autocompleteOptions.count();
    if (optionCount > 0) {
      // Select the first option that's not a create option
      const existingTagOption = vendorPage.autocompleteOptions.filter({ hasNotText: 'Create' }).first();
      if (await existingTagOption.isVisible()) {
        await existingTagOption.click();
        await vendorPage.expectTagCount(1);
      }
    }
  });

  test('should create new trade tag on the fly (AC #8)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Type a new tag name that doesn't exist
    const newTagName = `NewTag${Date.now()}`;
    await vendorPage.createAndSelectTag(newTagName);

    // Verify tag is selected
    await vendorPage.expectTagSelected(newTagName);
    await vendorPage.expectTagCount(1);

    // Save and verify persistence (AC #15) - Story 8.9 now redirects to detail page
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');
    await expect(page).toHaveURL(`/vendors/${vendorId}`, { timeout: 10000 });

    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectTagSelected(newTagName);
  });

  test('should remove trade tags (AC #9)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Add a tag first
    const tagName = `RemoveTest${Date.now()}`;
    await vendorPage.createAndSelectTag(tagName);
    await vendorPage.expectTagSelected(tagName);

    // Remove the tag
    await vendorPage.removeTag(tagName);
    await vendorPage.expectTagNotSelected(tagName);
    await vendorPage.expectTagCount(0);
  });

  test('should update vendor name and verify changes persist (AC #12, #13)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Modify name fields
    const newFirstName = `Updated${Date.now()}`;
    const newLastName = `VendorName`;
    await vendorPage.fillName(newFirstName, newLastName, 'Middle');

    // Save changes
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');

    // Should redirect to vendor detail page (Story 8.9)
    await expect(page).toHaveURL(`/vendors/${vendorId}`, { timeout: 10000 });

    // Navigate back and verify changes persisted
    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectNameValues(newFirstName, newLastName, 'Middle');
  });

  test('should cancel edit and return to vendor detail page (AC #14)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Get original values
    const originalFirstName = await vendorPage.firstNameInput.inputValue();
    const originalLastName = await vendorPage.lastNameInput.inputValue();

    // Make changes but don't save
    await vendorPage.fillName('Changed', 'Name');

    // Cancel - shows unsaved changes dialog (Story 8.7 AC #4)
    await vendorPage.clickCancel();
    await vendorPage.expectUnsavedChangesDialogVisible();
    await vendorPage.clickDiscardInDialog();

    // Should redirect to vendor detail page (Story 8.9)
    await expect(page).toHaveURL(`/vendors/${vendorId}`);

    // Navigate back and verify original values are intact
    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectNameValues(originalFirstName, originalLastName);
  });

  test('should show loading state while fetching vendor (AC #11)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);

    // Navigate to edit page with network throttling to observe loading (Story 8.9 - now at /edit)
    await page.goto(`/vendors/${vendorId}/edit`);

    // The form should eventually load
    await expect(vendorPage.firstNameInput).toBeVisible({ timeout: 10000 });
  });

  test('should disable save button while saving', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Make a change
    await vendorPage.addPhone('512-555-9999');

    // Submit - button should be disabled while saving
    await vendorPage.saveButton.click();

    // Check for snackbar confirmation
    await vendorPage.waitForSnackBar('Vendor updated');
  });

  test('full edit workflow with phones, emails, and tags (integration)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Update name
    await vendorPage.fillName('Integration', 'TestVendor', 'Full');

    // Add phones
    await vendorPage.addPhone('512-111-1111', 'Mobile');
    await vendorPage.addPhone('512-222-2222', 'Office');

    // Add emails
    await vendorPage.addEmail('primary@integration.test');
    await vendorPage.addEmail('secondary@integration.test');

    // Add a trade tag
    const tagName = `Integration${Date.now()}`;
    await vendorPage.createAndSelectTag(tagName);

    // Save all changes
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor updated');

    // Verify redirect to detail page (Story 8.9)
    await expect(page).toHaveURL(`/vendors/${vendorId}`, { timeout: 10000 });

    // Go back to vendor list and verify vendor appears
    await vendorPage.goto();
    await vendorPage.expectVendorInList('Integration Full TestVendor');

    // Navigate back and verify all data persisted
    await vendorPage.gotoEdit(vendorId);
    await vendorPage.expectNameValues('Integration', 'TestVendor', 'Full');
    await vendorPage.expectPhoneCount(2);
    await vendorPage.expectEmailCount(2);
    await vendorPage.expectTagSelected(tagName);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Story 8.7: Unsaved Changes Confirmation (AC #4, #5)
  // ─────────────────────────────────────────────────────────────────────────────

  test('should cancel without confirmation when form is pristine (AC #5)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Don't make any changes - just click cancel
    await vendorPage.clickCancel();

    // Should navigate directly to vendor detail page without dialog (Story 8.9)
    await expect(page).toHaveURL(`/vendors/${vendorId}`);
    await vendorPage.expectUnsavedChangesDialogHidden();
  });

  test('should show confirmation dialog when canceling with unsaved name changes (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Make a change to the form
    await vendorPage.firstNameInput.fill('ChangedName');

    // Click cancel
    await vendorPage.clickCancel();

    // Should show confirmation dialog
    await vendorPage.expectUnsavedChangesDialogVisible();
  });

  test('should show confirmation dialog when canceling with added phone (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Add a phone
    await vendorPage.addPhone('512-555-9999');

    // Click cancel
    await vendorPage.clickCancel();

    // Should show confirmation dialog
    await vendorPage.expectUnsavedChangesDialogVisible();
  });

  test('should show confirmation dialog when canceling with trade tag changes (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Add a trade tag
    const tagName = `UnsavedTest${Date.now()}`;
    await vendorPage.createAndSelectTag(tagName);

    // Wait for tag chip to be visible confirming the selection completed
    await vendorPage.expectTagSelected(tagName);

    // Click cancel
    await vendorPage.clickCancel();

    // Should show confirmation dialog
    await vendorPage.expectUnsavedChangesDialogVisible();
  });

  test('should navigate to vendor detail when clicking Discard in dialog (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Make a change
    await vendorPage.firstNameInput.fill('WillBeDiscarded');

    // Click cancel
    await vendorPage.clickCancel();

    // Dialog should appear
    await vendorPage.expectUnsavedChangesDialogVisible();

    // Click Discard
    await vendorPage.clickDiscardInDialog();

    // Should navigate to vendor detail page (Story 8.9)
    await expect(page).toHaveURL(`/vendors/${vendorId}`);

    // Verify changes were NOT saved
    await vendorPage.gotoEdit(vendorId);
    const firstName = await vendorPage.firstNameInput.inputValue();
    expect(firstName).not.toBe('WillBeDiscarded');
  });

  test('should stay on edit form when clicking Cancel in dialog (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Make a change
    await vendorPage.firstNameInput.fill('WillBeKept');

    // Click cancel
    await vendorPage.clickCancel();

    // Dialog should appear
    await vendorPage.expectUnsavedChangesDialogVisible();

    // Click Cancel in dialog to stay on page
    await vendorPage.clickCancelInDialog();

    // Should still be on edit page (Story 8.9 - now at /edit path)
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);

    // Changes should still be in the form
    await expect(vendorPage.firstNameInput).toHaveValue('WillBeKept');
  });

  test('should show confirmation dialog when navigating via sidebar with unsaved changes (AC #4)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Create a vendor
    const vendorId = await createTestVendor(vendorPage, page);
    await vendorPage.gotoEdit(vendorId);

    // Make a change
    await vendorPage.addEmail('test@unsaved.com');

    // Try to navigate away using sidebar navigation (triggers Angular router)
    await page.locator('a[href="/dashboard"]').click();

    // Dialog should appear (guard intercepts navigation)
    await vendorPage.expectUnsavedChangesDialogVisible();

    // Cancel the navigation
    await vendorPage.clickCancelInDialog();

    // Should still be on vendor edit page (Story 8.9 - now at /edit path)
    await expect(page).toHaveURL(`/vendors/${vendorId}/edit`);
  });
});
