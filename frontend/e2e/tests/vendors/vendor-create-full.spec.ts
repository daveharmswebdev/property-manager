import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor Create Full Form E2E Tests (Story 17.8)
 *
 * Tests the full-size vendor creation form with all fields:
 * - Full form with phones, emails, and trade tags (AC-1)
 * - Layout matches edit form (AC-2)
 *
 * RED PHASE: These tests are expected to FAIL until Story 17.8 is implemented.
 * The current VendorFormComponent only has name fields (no phone/email/tag sections).
 */
test.describe('Vendor Create Full Form (Story 17.8)', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // AC-1: Full-size form sections visible
  // ─────────────────────────────────────────────────────────────────────────────

  test('should display phone numbers section in create form (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User navigates to create vendor form
    await vendorPage.gotoCreate();

    // THEN: Phone numbers section is visible with add button
    await expect(vendorPage.addPhoneButton).toBeVisible();
  });

  test('should display email addresses section in create form (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User navigates to create vendor form
    await vendorPage.gotoCreate();

    // THEN: Email addresses section is visible with add button
    await expect(vendorPage.addEmailButton).toBeVisible();
  });

  test('should display trade tags section in create form (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User navigates to create vendor form
    await vendorPage.gotoCreate();

    // THEN: Trade tags section is visible with chip input
    await expect(vendorPage.tagInput).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AC-1: Create vendor with full details
  // ─────────────────────────────────────────────────────────────────────────────

  test('should create vendor with phone numbers (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User is on the create vendor form
    await vendorPage.gotoCreate();

    const timestamp = Date.now();
    const firstName = `PhoneCreate${timestamp}`;
    const lastName = 'TestVendor';

    // WHEN: User fills name and adds a phone number
    await vendorPage.fillName(firstName, lastName);
    await vendorPage.addPhone('512-555-1234', 'Mobile');

    // AND: Submits the form
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor added');

    // THEN: Vendor is created and redirects to list
    await expect(page).toHaveURL('/vendors');

    // AND: Navigate to vendor detail to verify phone persisted
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);
    await vendorPage.expectDetailHasPhone('(512) 555-1234');
  });

  test('should create vendor with email addresses (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User is on the create vendor form
    await vendorPage.gotoCreate();

    const timestamp = Date.now();
    const firstName = `EmailCreate${timestamp}`;
    const lastName = 'TestVendor';
    const email = `create${timestamp}@test.com`;

    // WHEN: User fills name and adds an email
    await vendorPage.fillName(firstName, lastName);
    await vendorPage.addEmail(email);

    // AND: Submits the form
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor added');

    // THEN: Vendor is created and redirects to list
    await expect(page).toHaveURL('/vendors');

    // AND: Navigate to vendor detail to verify email persisted
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);
    await vendorPage.expectDetailHasEmail(email);
  });

  test('should create vendor with trade tags (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User is on the create vendor form
    await vendorPage.gotoCreate();

    const timestamp = Date.now();
    const firstName = `TagCreate${timestamp}`;
    const lastName = 'TestVendor';
    const tagName = `CreateTag${timestamp}`;

    // WHEN: User fills name and adds a trade tag
    await vendorPage.fillName(firstName, lastName);
    await vendorPage.createAndSelectTag(tagName);

    // AND: Submits the form
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor added');

    // THEN: Vendor is created and redirects to list
    await expect(page).toHaveURL('/vendors');

    // AND: Navigate to vendor detail to verify tag persisted
    await vendorPage.clickVendorByName(`${firstName} ${lastName}`);
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);
    await vendorPage.expectDetailHasTradeTag(tagName);
  });

  test('should create vendor with all details: phones, emails, and tags (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User is on the create vendor form
    await vendorPage.gotoCreate();

    const timestamp = Date.now();
    const firstName = `FullCreate${timestamp}`;
    const lastName = 'IntegrationVendor';
    const email = `full${timestamp}@test.com`;
    const tagName = `FullTag${timestamp}`;

    // WHEN: User fills all fields
    await vendorPage.fillName(firstName, lastName, 'Middle');
    await vendorPage.addPhone('512-111-2222', 'Mobile');
    await vendorPage.addPhone('512-333-4444', 'Office');
    await vendorPage.addEmail(email);
    await vendorPage.createAndSelectTag(tagName);

    // AND: Submits the form
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor added');

    // THEN: Vendor is created and redirects to list
    await expect(page).toHaveURL('/vendors');

    // AND: Navigate to vendor detail to verify all data persisted
    await vendorPage.clickVendorByName(`${firstName} Middle ${lastName}`);
    await page.waitForURL(/\/vendors\/[a-f0-9-]+$/);
    await vendorPage.expectDetailHasPhone('(512) 111-2222');
    await vendorPage.expectDetailHasEmail(email);
    await vendorPage.expectDetailHasTradeTag(tagName);
  });

  test('should still create vendor with only names for backward compatibility (AC-1)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User is on the create vendor form
    await vendorPage.gotoCreate();

    const timestamp = Date.now();
    const firstName = `NameOnly${timestamp}`;
    const lastName = 'BackwardCompat';

    // WHEN: User fills only name fields (no phones, emails, or tags)
    await vendorPage.fillName(firstName, lastName);

    // AND: Submits the form
    await vendorPage.submitForm();
    await vendorPage.waitForSnackBar('Vendor added');

    // THEN: Vendor is created successfully
    await expect(page).toHaveURL('/vendors');
    await vendorPage.expectVendorInList(`${firstName} ${lastName}`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AC-2: Form matches Edit Vendor layout
  // ─────────────────────────────────────────────────────────────────────────────

  test('should have same layout sections as edit form (AC-2)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // GIVEN: User navigates to create vendor form
    await vendorPage.gotoCreate();

    // THEN: Form has all the same sections as edit form

    // Name fields in a row
    await expect(vendorPage.firstNameInput).toBeVisible();
    await expect(vendorPage.middleNameInput).toBeVisible();
    await expect(vendorPage.lastNameInput).toBeVisible();

    // Phone section with add button
    await expect(vendorPage.addPhoneButton).toBeVisible();

    // Email section with add button
    await expect(vendorPage.addEmailButton).toBeVisible();

    // Tags section with chip input
    await expect(vendorPage.tagInput).toBeVisible();

    // Container should be 800px max-width (matching edit form, was 600px)
    const container = page.locator('.vendor-form-container');
    const maxWidth = await container.evaluate((el) => getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe('800px');
  });
});
