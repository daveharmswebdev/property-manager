import { type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * WorkOrderFormPage — page object for create/edit work-order form (Story 21.8).
 *
 * Verified against `work-order-form.component.ts`:
 * - propertyId / description / status / vendorId controls (lines 70-173)
 * - Submit button is `<button type="submit">` (line 222-241), label is
 *   "Create Work Order" in create mode and "Save Changes" in edit mode.
 * - Cancel is a regular `<button type="button">` with text "Cancel".
 *
 * @extends BasePage
 */
export class WorkOrderFormPage extends BasePage {
  // ───────────────────────────────────────────────────────────────────────────
  // Locators (Material control selectors — no testids needed)
  // ───────────────────────────────────────────────────────────────────────────

  get propertyDropdown(): Locator {
    return this.page.locator('mat-select[formControlName="propertyId"]');
  }

  get descriptionInput(): Locator {
    return this.page.locator('textarea[formControlName="description"]');
  }

  get statusDropdown(): Locator {
    return this.page.locator('mat-select[formControlName="status"]');
  }

  get vendorDropdown(): Locator {
    return this.page.locator('mat-select[formControlName="vendorId"]');
  }

  get submitButton(): Locator {
    return this.page.locator('button[type="submit"]');
  }

  get cancelButton(): Locator {
    return this.page.locator('button:has-text("Cancel")');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/work-orders/new');
    await this.waitForLoading();
  }

  async gotoEdit(id: string): Promise<void> {
    await this.page.goto(`/work-orders/${id}/edit`);
    await this.waitForLoading();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Field interactions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Select a property by partial name match. The option label includes
   * `${name} - ${city}, ${state}` (form template line 73), so we match on the
   * unique name prefix.
   */
  async selectProperty(propertyName: string): Promise<void> {
    await this.propertyDropdown.click();
    await this.page
      .locator('mat-option', { hasText: propertyName })
      .first()
      .click();
  }

  async fillDescription(text: string): Promise<void> {
    await this.descriptionInput.fill(text);
  }

  async selectStatus(status: 'Reported' | 'Assigned' | 'Completed'): Promise<void> {
    await this.statusDropdown.click();
    // Status options live in the open panel; use exact match to avoid the
    // status chip strings that may appear elsewhere on the page.
    await this.page.locator('mat-option', { hasText: status }).first().click();
  }

  /**
   * Select a vendor option by name. Skips the "Self (DIY)" and "Add New
   * Vendor" options by matching on the unique vendor full-name string.
   */
  async selectVendorByName(name: string): Promise<void> {
    await this.vendorDropdown.click();
    await this.page.locator('mat-option', { hasText: name }).first().click();
  }

  /**
   * Select the "Self (DIY)" option (vendorId = null).
   */
  async selectDiy(): Promise<void> {
    await this.vendorDropdown.click();
    await this.page.locator('mat-option', { hasText: 'Self (DIY)' }).first().click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Assertions
  // ───────────────────────────────────────────────────────────────────────────

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }

  /**
   * Assert the status dropdown's currently-displayed value is `expected`.
   * Useful for verifying the auto-Assigned transition before submit.
   */
  async expectStatusValue(expected: 'Reported' | 'Assigned' | 'Completed'): Promise<void> {
    await expect(this.statusDropdown).toContainText(expected);
  }
}
