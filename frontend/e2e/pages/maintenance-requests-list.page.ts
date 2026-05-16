import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * MaintenanceRequestsListPage - Page object for the landlord inbox (Story 20.7).
 *
 * Covers `/maintenance-requests`:
 * - Status chip filter listbox
 * - Property select filter
 * - Aggregated request rows (status chip + description + property + submitter)
 * - Empty / filtered-empty states
 * - Paginator
 */
export class MaintenanceRequestsListPage extends BasePage {
  readonly root: Locator;
  readonly requestRows: Locator;
  readonly statusFilter: Locator;
  readonly propertyFilter: Locator;
  readonly paginator: Locator;
  readonly emptyState: Locator;
  readonly filteredEmptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[data-testid="maintenance-requests-page"]');
    this.requestRows = page.locator('[data-testid="request-row"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.propertyFilter = page.locator('[data-testid="property-filter"]');
    this.paginator = page.locator('[data-testid="paginator"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
    this.filteredEmptyState = page.locator('[data-testid="filtered-empty-state"]');
  }

  /**
   * Override BasePage default — the inbox empty-state uses a `data-testid`
   * wrapper instead of `.empty-state` (which is also used for the filtered
   * empty state in the same template).
   */
  override get emptyStateLocator(): Locator {
    return this.emptyState;
  }

  async goto(): Promise<void> {
    await this.page.goto('/maintenance-requests');
    await this.waitForLoading();
  }

  /**
   * Locate a row by its description text (truncated descriptions are still matched).
   */
  getRowByDescription(description: string): Locator {
    return this.requestRows.filter({ hasText: description });
  }

  async clickRow(description: string): Promise<void> {
    await this.getRowByDescription(description).click();
  }

  async expectRowVisible(description: string): Promise<void> {
    await expect(this.getRowByDescription(description)).toBeVisible();
  }

  async expectRowHidden(description: string): Promise<void> {
    await expect(this.getRowByDescription(description)).toHaveCount(0);
  }

  async expectRowCount(n: number): Promise<void> {
    await expect(this.requestRows).toHaveCount(n);
  }

  /**
   * Click a status chip in the filter listbox.
   * @param label The user-visible label: 'Submitted' | 'In Progress' | 'Resolved' | 'Dismissed'
   */
  async clickStatusChip(label: string): Promise<void> {
    await this.statusFilter.locator('mat-chip-option', { hasText: label }).click();
  }

  /**
   * Open the property filter and select an option by name.
   */
  async selectProperty(name: string): Promise<void> {
    await this.propertyFilter.click();
    await this.page.locator('mat-option', { hasText: name }).click();
  }

  async clickClearFilters(): Promise<void> {
    await this.page.locator('[data-testid="clear-filters-btn"]').click();
  }

  async expectFilteredEmptyState(): Promise<void> {
    await expect(this.filteredEmptyState).toBeVisible();
  }

  /**
   * Assert a row's status chip text matches the supplied label.
   * The chip is styled with `text-transform: uppercase`, so the underlying
   * DOM text is mixed-case — use `toContainText` (case-sensitive substring).
   */
  async expectStatusBadge(description: string, label: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await expect(row.locator('.status-chip')).toContainText(label);
  }
}
