import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * AdminLandlordInvitationsPage - Page object for the admin console's
 * Landlord Invitations view (Story 22.4).
 *
 * Exposes the sidebar Admin nav link, the invite button, the create dialog's
 * email field + submit button, the table rows, and the per-row resend button.
 *
 * @example
 * ```typescript
 * test('admin lists landlord invitations', async ({ adminPage }) => {
 *   await adminPage.gotoViaNav();
 *   await adminPage.expectVisible();
 * });
 * ```
 */
export class AdminLandlordInvitationsPage extends BasePage {
  /** Sidebar nav link to the admin console (only present for PlatformAdmins) */
  readonly navLink: Locator;

  /** "Invite New Landlord" button that opens the create dialog */
  readonly inviteButton: Locator;

  /** Email field inside the create dialog */
  readonly dialogEmailInput: Locator;

  /** Submit ("Send Invitation") button inside the create dialog */
  readonly dialogSubmitButton: Locator;

  /** All data rows in the invitations table */
  readonly tableRows: Locator;

  /** Empty-state message shown when there are no landlord invitations */
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.navLink = page.getByTestId('nav-admin');
    this.inviteButton = page.getByTestId('invite-landlord');
    this.dialogEmailInput = page.locator('mat-dialog-container input[formControlName="email"]');
    this.dialogSubmitButton = page.locator(
      'mat-dialog-container button:has-text("Send Invitation")',
    );
    this.tableRows = page.locator('table.data-table tbody tr');
    this.emptyState = page.locator('.empty-message');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
  }

  /** Navigate to the admin console by clicking the sidebar Admin nav entry. */
  async gotoViaNav(): Promise<void> {
    await this.navLink.click();
    await this.page.waitForURL('**/admin', { timeout: 10000 });
  }

  /** Assert the Landlord Invitations section is rendered. */
  async expectVisible(): Promise<void> {
    await expect(
      this.page.locator('mat-card-title').filter({ hasText: 'Landlord Invitations' }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Open the create dialog, fill the email, and submit. */
  async createInvitation(email: string): Promise<void> {
    await this.inviteButton.click();
    await this.dialogEmailInput.fill(email);
    await this.dialogSubmitButton.click();
  }

  /** Locator for a table row containing the given email. */
  rowForEmail(email: string): Locator {
    return this.tableRows.filter({ hasText: email });
  }

  /** Click the Resend button within the row for the given email. */
  async resendForEmail(email: string): Promise<void> {
    await this.rowForEmail(email)
      .getByRole('button', { name: /Resend/ })
      .click();
  }
}
