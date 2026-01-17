import { type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * VendorPage - Page object for Vendor list, create, and edit pages
 *
 * Provides methods for:
 * - Navigating to vendor list
 * - Creating new vendors
 * - Editing existing vendors with phones, emails, and trade tags
 *
 * @extends BasePage
 */
export class VendorPage extends BasePage {
  // ─────────────────────────────────────────────────────────────────────────────
  // Locators - Vendor List
  // ─────────────────────────────────────────────────────────────────────────────

  /** Vendor list container */
  get vendorList(): Locator {
    return this.page.locator('.vendor-list');
  }

  /** Individual vendor cards in the list */
  get vendorCards(): Locator {
    return this.page.locator('.vendor-card');
  }

  /** Add Vendor button in header (not the one in empty state) */
  get addVendorButton(): Locator {
    return this.page.locator('.page-header button', { hasText: 'Add Vendor' });
  }

  /** Empty state card when no vendors exist */
  get emptyStateCard(): Locator {
    return this.page.locator('.empty-state-card');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Locators - Vendor Form (Create/Edit)
  // ─────────────────────────────────────────────────────────────────────────────

  /** First name input */
  get firstNameInput(): Locator {
    return this.page.locator('input[formControlName="firstName"]');
  }

  /** Middle name input */
  get middleNameInput(): Locator {
    return this.page.locator('input[formControlName="middleName"]');
  }

  /** Last name input */
  get lastNameInput(): Locator {
    return this.page.locator('input[formControlName="lastName"]');
  }

  /** Phone number inputs */
  get phoneNumberInputs(): Locator {
    return this.page.locator('input[formControlName="number"]');
  }

  /** Phone label selects */
  get phoneLabelSelects(): Locator {
    return this.page.locator('mat-select[formControlName="label"]');
  }

  /** Add phone button */
  get addPhoneButton(): Locator {
    return this.page.locator('.section-header button').filter({ has: this.page.locator('mat-icon:has-text("add")') }).first();
  }

  /** Delete phone buttons (buttons with delete icon in phone rows) */
  get deletePhoneButtons(): Locator {
    return this.page.locator('.phone-row button').filter({ has: this.page.locator('mat-icon:has-text("delete")') });
  }

  /** Email inputs - using the formArrayName approach */
  get emailInputs(): Locator {
    return this.page.locator('[formArrayName="emails"] input');
  }

  /** Add email button */
  get addEmailButton(): Locator {
    return this.page.locator('.section-header button').filter({ has: this.page.locator('mat-icon:has-text("add")') }).nth(1);
  }

  /** Delete email buttons (buttons with delete icon in email rows) */
  get deleteEmailButtons(): Locator {
    return this.page.locator('.email-row button').filter({ has: this.page.locator('mat-icon:has-text("delete")') });
  }

  /** Trade tag chip input */
  get tagInput(): Locator {
    return this.page.locator('mat-chip-grid').locator('..').locator('input');
  }

  /** Selected trade tag chips */
  get selectedTagChips(): Locator {
    return this.page.locator('mat-chip-row');
  }

  /** Remove tag buttons on chips */
  get removeTagButtons(): Locator {
    return this.page.locator('mat-chip-row button[matChipRemove]');
  }

  /** Autocomplete options */
  get autocompleteOptions(): Locator {
    return this.page.locator('mat-option');
  }

  /** Save/Submit button */
  get saveButton(): Locator {
    return this.page.locator('button[type="submit"]');
  }

  /** Cancel button */
  get cancelButton(): Locator {
    return this.page.locator('button', { hasText: 'Cancel' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Navigate to vendor list page
   */
  async goto(): Promise<void> {
    await this.page.goto('/vendors');
    await this.waitForLoading();
  }

  /**
   * Navigate to create vendor page
   */
  async gotoCreate(): Promise<void> {
    await this.page.goto('/vendors/new');
    await this.waitForLoading();
  }

  /**
   * Navigate to edit vendor page
   * @param vendorId - Vendor ID
   */
  async gotoEdit(vendorId: string): Promise<void> {
    await this.page.goto(`/vendors/${vendorId}`);
    await this.waitForLoading();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Vendor List
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Click on a vendor card by name to navigate to edit
   * @param vendorName - Full name of the vendor
   */
  async clickVendorByName(vendorName: string): Promise<void> {
    const card = this.vendorCards.filter({ hasText: vendorName });
    await card.click();
  }

  /**
   * Click Add Vendor button
   */
  async clickAddVendor(): Promise<void> {
    await this.addVendorButton.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Vendor Form
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fill name fields
   */
  async fillName(firstName: string, lastName: string, middleName?: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    if (middleName) {
      await this.middleNameInput.fill(middleName);
    }
    await this.lastNameInput.fill(lastName);
  }

  /**
   * Add a phone number
   * @param number - Phone number
   * @param label - Optional label (Mobile, Home, Work, Office, Fax)
   */
  async addPhone(number: string, label?: string): Promise<void> {
    // Get current phone row count before clicking
    const phoneRows = this.page.locator('.phone-row');
    const currentCount = await phoneRows.count();

    // Click add phone button
    await this.addPhoneButton.click();

    // Wait for new phone row to appear
    await expect(phoneRows).toHaveCount(currentCount + 1);

    // Get the last phone row explicitly and fill its input
    const lastPhoneRow = phoneRows.last();
    await lastPhoneRow.locator('input[formControlName="number"]').fill(number);

    if (label) {
      await lastPhoneRow.locator('mat-select[formControlName="label"]').click();
      await this.page.locator('mat-option', { hasText: label }).click();
    }
  }

  /**
   * Update an existing phone number at index
   * @param index - Index of the phone row
   * @param number - New phone number
   * @param label - Optional new label
   */
  async updatePhone(index: number, number: string, label?: string): Promise<void> {
    await this.phoneNumberInputs.nth(index).fill(number);
    if (label) {
      await this.phoneLabelSelects.nth(index).click();
      await this.page.locator('mat-option', { hasText: label }).click();
    }
  }

  /**
   * Remove a phone at index
   * @param index - Index of the phone row to remove
   */
  async removePhone(index: number): Promise<void> {
    const phoneRows = this.page.locator('.phone-row');
    const currentCount = await phoneRows.count();

    // Get the value of the phone input we want to delete
    const targetValue = await this.phoneNumberInputs.nth(index).inputValue();

    // Find and click the delete button in the row with this phone number
    for (let i = 0; i < currentCount; i++) {
      const row = phoneRows.nth(i);
      const inputValue = await row.locator('input[formControlName="number"]').inputValue();
      if (inputValue === targetValue) {
        await row.locator('button').click();
        break;
      }
    }

    // Wait for phone row to be removed
    await expect(phoneRows).toHaveCount(currentCount - 1);
  }

  /**
   * Add an email address
   * @param email - Email address
   */
  async addEmail(email: string): Promise<void> {
    // Get current email row count before clicking
    const emailRows = this.page.locator('.email-row');
    const currentCount = await emailRows.count();

    // Click add email button
    await this.addEmailButton.click();

    // Wait for new email row to appear
    await expect(emailRows).toHaveCount(currentCount + 1);

    // Get the last email row explicitly and fill its input
    const lastEmailRow = emailRows.last();
    await lastEmailRow.locator('input').fill(email);
  }

  /**
   * Update an existing email at index
   * @param index - Index of the email row
   * @param email - New email address
   */
  async updateEmail(index: number, email: string): Promise<void> {
    await this.emailInputs.nth(index).fill(email);
  }

  /**
   * Remove an email at index
   * @param index - Index of the email row to remove
   */
  async removeEmail(index: number): Promise<void> {
    const emailRows = this.page.locator('.email-row');
    const currentCount = await emailRows.count();

    // Get the value of the email input we want to delete
    const targetValue = await this.emailInputs.nth(index).inputValue();

    // Find and click the delete button in the row with this email
    for (let i = 0; i < currentCount; i++) {
      const row = emailRows.nth(i);
      const inputValue = await row.locator('input').inputValue();
      if (inputValue === targetValue) {
        await row.locator('button').click();
        break;
      }
    }

    // Wait for email row to be removed
    await expect(emailRows).toHaveCount(currentCount - 1);
  }

  /**
   * Add a trade tag by selecting from autocomplete
   * @param tagName - Name of the tag to select
   */
  async selectTag(tagName: string): Promise<void> {
    await this.tagInput.fill(tagName);
    await this.page.waitForTimeout(300); // Wait for autocomplete
    await this.autocompleteOptions.filter({ hasText: tagName }).first().click();
  }

  /**
   * Create a new trade tag by typing and pressing Enter
   * @param tagName - Name of the new tag
   */
  async createAndSelectTag(tagName: string): Promise<void> {
    await this.tagInput.fill(tagName);
    await this.page.waitForTimeout(300);
    // Click the "Create" option
    await this.autocompleteOptions.filter({ hasText: `Create "${tagName}"` }).click();
  }

  /**
   * Remove a trade tag by name
   * @param tagName - Name of the tag to remove
   */
  async removeTag(tagName: string): Promise<void> {
    const chip = this.selectedTagChips.filter({ hasText: tagName });
    await chip.locator('button[matChipRemove]').click();
  }

  /**
   * Submit the form
   */
  async submitForm(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Cancel the form
   */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assert vendor appears in the list
   * @param vendorName - Full name to look for
   */
  async expectVendorInList(vendorName: string): Promise<void> {
    // Use first() to handle multiple matches (e.g., from previous test runs)
    await expect(this.vendorCards.filter({ hasText: vendorName }).first()).toBeVisible();
  }

  /**
   * Assert vendor does not appear in the list
   * @param vendorName - Full name to look for
   */
  async expectVendorNotInList(vendorName: string): Promise<void> {
    await expect(this.vendorCards.filter({ hasText: vendorName })).not.toBeVisible();
  }

  /**
   * Assert empty state is shown
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyStateCard).toBeVisible();
    await expect(this.emptyStateCard).toContainText('No vendors yet');
  }

  /**
   * Assert form fields have expected values
   */
  async expectNameValues(firstName: string, lastName: string, middleName?: string): Promise<void> {
    await expect(this.firstNameInput).toHaveValue(firstName);
    await expect(this.lastNameInput).toHaveValue(lastName);
    if (middleName !== undefined) {
      await expect(this.middleNameInput).toHaveValue(middleName);
    }
  }

  /**
   * Assert number of phones
   * @param count - Expected number of phone rows
   */
  async expectPhoneCount(count: number): Promise<void> {
    await expect(this.phoneNumberInputs).toHaveCount(count);
  }

  /**
   * Assert phone value at index
   * @param index - Phone row index
   * @param number - Expected phone number
   */
  async expectPhoneValue(index: number, number: string): Promise<void> {
    await expect(this.phoneNumberInputs.nth(index)).toHaveValue(number);
  }

  /**
   * Assert number of emails
   * @param count - Expected number of email rows
   */
  async expectEmailCount(count: number): Promise<void> {
    await expect(this.emailInputs).toHaveCount(count);
  }

  /**
   * Assert email value at index
   * @param index - Email row index
   * @param email - Expected email address
   */
  async expectEmailValue(index: number, email: string): Promise<void> {
    await expect(this.emailInputs.nth(index)).toHaveValue(email);
  }

  /**
   * Assert trade tag chip is visible
   * @param tagName - Name of the tag
   */
  async expectTagSelected(tagName: string): Promise<void> {
    await expect(this.selectedTagChips.filter({ hasText: tagName })).toBeVisible();
  }

  /**
   * Assert trade tag chip is not visible
   * @param tagName - Name of the tag
   */
  async expectTagNotSelected(tagName: string): Promise<void> {
    await expect(this.selectedTagChips.filter({ hasText: tagName })).not.toBeVisible();
  }

  /**
   * Assert number of selected tags
   * @param count - Expected number of tags
   */
  async expectTagCount(count: number): Promise<void> {
    await expect(this.selectedTagChips).toHaveCount(count);
  }
}
