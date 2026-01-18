import { type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * VendorPage - Page object for Vendor list, create, detail, and edit pages
 *
 * Provides methods for:
 * - Navigating to vendor list
 * - Creating new vendors
 * - Viewing vendor details
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

  /** Trade tag chips displayed in vendor list */
  get listTradeTagChips(): Locator {
    return this.page.locator('.vendor-list .trade-tag-chip');
  }

  /** Phone numbers displayed in vendor list */
  get listPhoneNumbers(): Locator {
    return this.page.locator('.vendor-list .vendor-phone');
  }

  /** Email addresses displayed in vendor list */
  get listEmails(): Locator {
    return this.page.locator('.vendor-list .vendor-email');
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
  // Locators - Filter Bar (Story 8-6)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Filter bar container */
  get filterBar(): Locator {
    return this.page.locator('.filter-bar');
  }

  /** Search input field */
  get searchInput(): Locator {
    return this.page.locator('.search-field input');
  }

  /** Trade tag filter dropdown */
  get tradeTagFilter(): Locator {
    return this.page.locator('.tag-filter-field mat-select');
  }

  /** Clear filters button */
  get clearFiltersButton(): Locator {
    return this.page.locator('.filter-bar button', { hasText: 'Clear filters' });
  }

  /** No matches card (when filters return empty) */
  get noMatchesCard(): Locator {
    return this.page.locator('.no-matches-card');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Locators - Vendor Detail Page (Story 8.9)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Vendor detail page container */
  get vendorDetailPage(): Locator {
    return this.page.locator('.vendor-detail-container');
  }

  /** Vendor name heading on detail page */
  get vendorDetailName(): Locator {
    return this.page.locator('.title-section h1');
  }

  /** Back button on detail page */
  get detailBackButton(): Locator {
    return this.page.locator('.back-button');
  }

  /** Edit button on detail page */
  get detailEditButton(): Locator {
    return this.page.locator('.action-buttons button', { hasText: 'Edit' });
  }

  /** Delete button on detail page */
  get detailDeleteButton(): Locator {
    return this.page.locator('.action-buttons button[color="warn"]');
  }

  /** Contact information section on detail page */
  get detailContactSection(): Locator {
    return this.page.locator('.section-card', { hasText: 'Contact Information' });
  }

  /** Trade tags section on detail page */
  get detailTradeTagsSection(): Locator {
    return this.page.locator('.section-card', { hasText: 'Trade Tags' });
  }

  /** Work order history section on detail page */
  get detailWorkOrderSection(): Locator {
    return this.page.locator('.section-card', { hasText: 'Work Order History' });
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

  /** Cancel button in form actions */
  get cancelButton(): Locator {
    return this.page.locator('.form-actions button', { hasText: 'Cancel' });
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
   * Navigate to vendor detail page (Story 8.9)
   * @param vendorId - Vendor ID
   */
  async gotoDetail(vendorId: string): Promise<void> {
    await this.page.goto(`/vendors/${vendorId}`);
    await this.waitForLoading();
  }

  /**
   * Navigate to edit vendor page (Story 8.9 - now at /vendors/:id/edit)
   * @param vendorId - Vendor ID
   */
  async gotoEdit(vendorId: string): Promise<void> {
    await this.page.goto(`/vendors/${vendorId}/edit`);
    await this.waitForLoading();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Vendor List
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Click on a vendor card by name to navigate to detail page (Story 8.9)
   * @param vendorName - Full name of the vendor
   */
  async clickVendorByName(vendorName: string): Promise<void> {
    const card = this.vendorCards.filter({ hasText: vendorName });
    await card.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Vendor Detail Page (Story 8.9)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Click Edit button on vendor detail page to navigate to edit form
   */
  async clickEditFromDetail(): Promise<void> {
    await this.detailEditButton.click();
  }

  /**
   * Click Delete button on vendor detail page
   */
  async clickDeleteFromDetail(): Promise<void> {
    await this.detailDeleteButton.click();
  }

  /**
   * Click Back button on vendor detail page to return to list
   */
  async clickBackFromDetail(): Promise<void> {
    await this.detailBackButton.click();
  }

  /**
   * Click Add Vendor button
   */
  async clickAddVendor(): Promise<void> {
    await this.addVendorButton.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Filter Bar (Story 8-6)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Search for vendors by name
   * @param searchTerm - Text to search for
   */
  async searchVendors(searchTerm: string): Promise<void> {
    await this.searchInput.fill(searchTerm);
    // Wait for debounce (300ms)
    await this.page.waitForTimeout(400);
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(400);
  }

  /**
   * Select trade tags to filter by
   * @param tagNames - Array of tag names to select
   */
  async selectTradeTagFilters(tagNames: string[]): Promise<void> {
    // Use force: true because mat-label can intercept clicks on mat-select
    await this.tradeTagFilter.click({ force: true });
    for (const tagName of tagNames) {
      await this.page.locator('mat-option', { hasText: tagName }).click();
    }
    // Close dropdown by clicking outside
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(100);
  }

  /**
   * Click clear filters button
   */
  async clickClearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
    await this.page.waitForTimeout(100);
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
    // Wait for the chip to appear (async tag creation to complete)
    await expect(this.selectedTagChips.filter({ hasText: tagName })).toBeVisible({
      timeout: 5000,
    });
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
  // Unsaved Changes Dialog (Story 8.7 - AC #4, #5)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Unsaved changes dialog */
  get unsavedChangesDialog(): Locator {
    return this.page.locator('mat-dialog-container');
  }

  /** Discard button in unsaved changes dialog */
  get discardButton(): Locator {
    return this.page.locator('mat-dialog-container button', { hasText: 'Discard' });
  }

  /** Cancel button in unsaved changes dialog */
  get dialogCancelButton(): Locator {
    return this.page.locator('mat-dialog-container button', { hasText: 'Cancel' });
  }

  /**
   * Click Discard in the unsaved changes dialog
   */
  async clickDiscardInDialog(): Promise<void> {
    await this.discardButton.click();
  }

  /**
   * Click Cancel in the unsaved changes dialog to stay on page
   */
  async clickCancelInDialog(): Promise<void> {
    await this.dialogCancelButton.click();
  }

  /**
   * Assert unsaved changes dialog is visible
   */
  async expectUnsavedChangesDialogVisible(): Promise<void> {
    await expect(this.unsavedChangesDialog).toBeVisible();
    await expect(this.unsavedChangesDialog).toContainText('Unsaved Changes');
    await expect(this.unsavedChangesDialog).toContainText('Discard');
  }

  /**
   * Assert unsaved changes dialog is not visible
   */
  async expectUnsavedChangesDialogHidden(): Promise<void> {
    await expect(this.unsavedChangesDialog).not.toBeVisible();
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions - Vendor List Display (Story 8.5)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assert a vendor card displays trade tags
   * @param vendorName - Name of vendor to check
   * @param tagNames - Expected tag names
   */
  async expectVendorHasTradeTags(vendorName: string, tagNames: string[]): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    for (const tagName of tagNames) {
      await expect(vendorCard.locator('.trade-tag-chip', { hasText: tagName })).toBeVisible();
    }
  }

  /**
   * Assert a vendor card displays phone number
   * @param vendorName - Name of vendor to check
   * @param phoneNumber - Expected phone number text
   */
  async expectVendorHasPhone(vendorName: string, phoneNumber: string): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    await expect(vendorCard.locator('.vendor-phone')).toContainText(phoneNumber);
  }

  /**
   * Assert a vendor card displays email
   * @param vendorName - Name of vendor to check
   * @param email - Expected email text
   */
  async expectVendorHasEmail(vendorName: string, email: string): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    await expect(vendorCard.locator('.vendor-email')).toContainText(email);
  }

  /**
   * Assert a vendor card has no phone displayed
   * @param vendorName - Name of vendor to check
   */
  async expectVendorHasNoPhone(vendorName: string): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    await expect(vendorCard.locator('.vendor-phone')).not.toBeVisible();
  }

  /**
   * Assert a vendor card has no email displayed
   * @param vendorName - Name of vendor to check
   */
  async expectVendorHasNoEmail(vendorName: string): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    await expect(vendorCard.locator('.vendor-email')).not.toBeVisible();
  }

  /**
   * Assert a vendor card has no trade tags displayed
   * @param vendorName - Name of vendor to check
   */
  async expectVendorHasNoTradeTags(vendorName: string): Promise<void> {
    const vendorCard = this.vendorCards.filter({ hasText: vendorName }).first();
    await expect(vendorCard.locator('.trade-tags')).not.toBeVisible();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions - Filter Bar (Story 8-6)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assert filter bar is visible
   */
  async expectFilterBarVisible(): Promise<void> {
    await expect(this.filterBar).toBeVisible();
  }

  /**
   * Assert search input has value
   * @param value - Expected search input value
   */
  async expectSearchValue(value: string): Promise<void> {
    await expect(this.searchInput).toHaveValue(value);
  }

  /**
   * Assert no matches card is visible
   */
  async expectNoMatchesState(): Promise<void> {
    await expect(this.noMatchesCard).toBeVisible();
    await expect(this.noMatchesCard).toContainText('No vendors match your search');
  }

  /**
   * Assert no matches card is not visible
   */
  async expectNoMatchesStateHidden(): Promise<void> {
    await expect(this.noMatchesCard).not.toBeVisible();
  }

  /**
   * Assert clear filters button is visible
   */
  async expectClearFiltersVisible(): Promise<void> {
    await expect(this.clearFiltersButton).toBeVisible();
  }

  /**
   * Assert clear filters button is not visible
   */
  async expectClearFiltersHidden(): Promise<void> {
    await expect(this.clearFiltersButton).not.toBeVisible();
  }

  /**
   * Assert the number of vendors visible in the list
   * @param count - Expected number of vendor cards
   */
  async expectVendorCount(count: number): Promise<void> {
    await expect(this.vendorCards).toHaveCount(count);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions - Vendor Detail Page (Story 8.9)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assert vendor detail page is visible
   */
  async expectDetailPageVisible(): Promise<void> {
    await expect(this.vendorDetailPage).toBeVisible();
  }

  /**
   * Assert vendor name is displayed on detail page
   * @param vendorName - Expected vendor name
   */
  async expectDetailVendorName(vendorName: string): Promise<void> {
    await expect(this.vendorDetailName).toContainText(vendorName);
  }

  /**
   * Assert contact section is visible on detail page
   */
  async expectDetailContactSectionVisible(): Promise<void> {
    await expect(this.detailContactSection).toBeVisible();
  }

  /**
   * Assert trade tags section is visible on detail page
   */
  async expectDetailTradeTagsSectionVisible(): Promise<void> {
    await expect(this.detailTradeTagsSection).toBeVisible();
  }

  /**
   * Assert work order section is visible on detail page
   */
  async expectDetailWorkOrderSectionVisible(): Promise<void> {
    await expect(this.detailWorkOrderSection).toBeVisible();
  }

  /**
   * Assert work order placeholder message is shown
   */
  async expectWorkOrderPlaceholder(): Promise<void> {
    await expect(this.detailWorkOrderSection).toContainText('No work orders yet for this vendor');
  }

  /**
   * Assert phone number is displayed on detail page
   * @param phoneNumber - Expected phone number
   */
  async expectDetailHasPhone(phoneNumber: string): Promise<void> {
    await expect(this.detailContactSection).toContainText(phoneNumber);
  }

  /**
   * Assert email is displayed on detail page
   * @param email - Expected email address
   */
  async expectDetailHasEmail(email: string): Promise<void> {
    await expect(this.detailContactSection).toContainText(email);
  }

  /**
   * Assert trade tag is displayed on detail page
   * @param tagName - Expected tag name
   */
  async expectDetailHasTradeTag(tagName: string): Promise<void> {
    await expect(this.detailTradeTagsSection.locator('.trade-tag-chip', { hasText: tagName })).toBeVisible();
  }

  /**
   * Assert edit button is visible on detail page
   */
  async expectDetailEditButtonVisible(): Promise<void> {
    await expect(this.detailEditButton).toBeVisible();
  }

  /**
   * Assert delete button is visible on detail page
   */
  async expectDetailDeleteButtonVisible(): Promise<void> {
    await expect(this.detailDeleteButton).toBeVisible();
  }
}
