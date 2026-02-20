import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * IncomeDetailPage - Page object for income detail/edit E2E tests
 *
 * Covers: Story 16.2 — Income Feature Parity (AC3, AC4, AC5)
 *
 * Supports both view mode (read-only display) and edit mode (form).
 * Extends BasePage for loading state, snackbar, and confirmation dialog helpers.
 */
export class IncomeDetailPage extends BasePage {
  // ─────────────────────────────────────────────────────────────────────────
  // Header / Navigation
  // ─────────────────────────────────────────────────────────────────────────
  readonly backLink: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Action Buttons (View Mode)
  // ─────────────────────────────────────────────────────────────────────────
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // View Mode — Income Detail Fields
  // ─────────────────────────────────────────────────────────────────────────
  readonly amountDisplay: Locator;
  readonly dateDisplay: Locator;
  readonly sourceDisplay: Locator;
  readonly descriptionDisplay: Locator;
  readonly propertyDisplay: Locator;
  readonly createdDateDisplay: Locator;

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode — Form Elements
  // ─────────────────────────────────────────────────────────────────────────
  readonly editForm: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly sourceInput: Locator;
  readonly descriptionInput: Locator;
  readonly propertySelect: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.backLink = page.locator('a', { hasText: /Back to Income/i });

    // Action buttons
    this.editButton = page.locator('button', { hasText: 'Edit' });
    this.deleteButton = page.locator('button', { hasText: 'Delete' });

    // View mode fields (data-testid for stable selectors)
    this.amountDisplay = page.locator('[data-testid="income-amount"]');
    this.dateDisplay = page.locator('[data-testid="income-date"]');
    this.sourceDisplay = page.locator('[data-testid="income-source"]');
    this.descriptionDisplay = page.locator('[data-testid="income-description"]');
    this.propertyDisplay = page.locator('[data-testid="income-property"]');
    this.createdDateDisplay = page.locator('[data-testid="income-created-date"]');

    // Edit form (formControlName selectors match Angular reactive forms)
    this.editForm = page.locator('form');
    this.amountInput = page.locator('input[formControlName="amount"]');
    this.dateInput = page.locator('input[formControlName="date"]');
    this.sourceInput = page.locator('input[formControlName="source"]');
    this.descriptionInput = page.locator('textarea[formControlName="description"]');
    this.propertySelect = page.locator('mat-select[formControlName="propertyId"]');
    this.saveButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button', { hasText: 'Cancel' });
  }

  async goto(): Promise<void> {
    throw new Error('Use gotoIncome(incomeId) to navigate to income detail');
  }

  /**
   * Navigate directly to income detail page by ID.
   */
  async gotoIncome(incomeId: string): Promise<void> {
    await this.page.goto(`/income/${incomeId}`);
    await this.waitForLoading();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // View Mode Assertions
  // ─────────────────────────────────────────────────────────────────────────

  async expectViewMode(): Promise<void> {
    await expect(this.editButton).toBeVisible();
    await expect(this.deleteButton).toBeVisible();
  }

  async expectAmount(expected: string): Promise<void> {
    await expect(this.amountDisplay).toContainText(expected);
  }

  async expectSource(expected: string): Promise<void> {
    await expect(this.sourceDisplay).toContainText(expected);
  }

  async expectProperty(expected: string): Promise<void> {
    await expect(this.propertyDisplay).toContainText(expected);
  }

  async expectDescription(expected: string): Promise<void> {
    await expect(this.descriptionDisplay).toContainText(expected);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode Assertions
  // ─────────────────────────────────────────────────────────────────────────

  async expectEditMode(): Promise<void> {
    await expect(this.editForm).toBeVisible();
    await expect(this.saveButton).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  async clickEdit(): Promise<void> {
    await this.editButton.click();
  }

  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  async submitEdit(): Promise<void> {
    await this.saveButton.click();
  }

  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  async clickBack(): Promise<void> {
    await this.backLink.click();
  }

  /**
   * Fill the edit form amount field.
   */
  async fillAmount(amount: string): Promise<void> {
    await this.amountInput.clear();
    await this.amountInput.fill(amount);
  }

  /**
   * Fill the edit form source field.
   */
  async fillSource(source: string): Promise<void> {
    await this.sourceInput.clear();
    await this.sourceInput.fill(source);
  }

  /**
   * Fill the edit form description field.
   */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
  }

  /**
   * Select a property in the edit form dropdown.
   */
  async selectProperty(propertyName: string): Promise<void> {
    await this.propertySelect.click();
    await this.page.locator('mat-option', { hasText: propertyName }).click();
  }
}
