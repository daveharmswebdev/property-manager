import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * SubmitRequestPage - Page object for the tenant submit-request E2E tests
 * (Story 21.4).
 *
 * Covers `/tenant/submit-request` shipped in Story 20.6 — a two-phase form:
 * Phase 1: description input + submit
 * Phase 2: optional photo upload + Done
 */
export class SubmitRequestPage extends BasePage {
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  /** Phase 2 only — visible after a request is created */
  readonly doneButton: Locator;

  /** Validation error: "Description is required" */
  readonly descriptionRequiredError: Locator;

  /** Phase 2 header — "Add Photos (Optional)" */
  readonly phase2Header: Locator;

  constructor(page: Page) {
    super(page);
    this.descriptionInput = page.locator('[data-testid="description-input"]');
    this.submitButton = page.locator('[data-testid="submit-btn"]');
    this.cancelButton = page.locator('[data-testid="cancel-btn"]');
    this.doneButton = page.locator('[data-testid="done-btn"]');
    this.descriptionRequiredError = page.locator('mat-error', { hasText: 'Description is required' });
    this.phase2Header = page.locator('mat-card-title', { hasText: 'Add Photos (Optional)' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/tenant/submit-request');
  }

  async fillDescription(text: string): Promise<void> {
    await this.descriptionInput.fill(text);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectPhase2(): Promise<void> {
    await expect(this.phase2Header).toBeVisible();
  }

  async clickDone(): Promise<void> {
    await this.doneButton.click();
  }

  async expectRequiredError(): Promise<void> {
    await expect(this.descriptionRequiredError).toBeVisible();
  }
}
