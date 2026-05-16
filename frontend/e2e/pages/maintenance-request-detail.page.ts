import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * MaintenanceRequestDetailPage - Page object for the landlord detail view
 * (Story 20.7).
 *
 * Covers `/maintenance-requests/:id`:
 * - Status chip
 * - Description
 * - Dismissal reason (only present when status = Dismissed)
 * - Linked work order badge (only present when workOrderId is set)
 * - Photo grid (only present when photos array is non-empty)
 */
export class MaintenanceRequestDetailPage extends BasePage {
  readonly root: Locator;
  readonly statusChip: Locator;
  readonly description: Locator;
  readonly dismissalReason: Locator;
  readonly linkedWorkOrder: Locator;
  readonly photoGrid: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[data-testid="request-detail-page"]');
    this.statusChip = page.locator('[data-testid="status-chip"]');
    this.description = page.locator('[data-testid="request-description"]');
    this.dismissalReason = page.locator('[data-testid="dismissal-reason"]');
    this.linkedWorkOrder = page.locator('[data-testid="linked-work-order"]');
    this.photoGrid = page.locator('[data-testid="photo-grid"]');
    this.backButton = page.locator('[data-testid="back-button"]');
  }

  async goto(id?: string): Promise<void> {
    if (!id) {
      throw new Error('MaintenanceRequestDetailPage.goto requires a request id');
    }
    await this.page.goto(`/maintenance-requests/${id}`);
    await this.waitForLoading();
  }

  async expectStatusBadge(label: string): Promise<void> {
    await expect(this.statusChip).toHaveText(label);
  }

  async expectDescription(text: string): Promise<void> {
    await expect(this.description).toContainText(text);
  }
}
