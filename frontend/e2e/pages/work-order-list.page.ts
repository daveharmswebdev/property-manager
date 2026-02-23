import { type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * WorkOrderListPage - Page object for work orders list view
 *
 * Story 16-8: Enriched two-line row layout with expand/collapse,
 * delete confirmation, status chips, and filters.
 *
 * @extends BasePage
 */
export class WorkOrderListPage extends BasePage {
  // ─────────────────────────────────────────────────────────────────────────────
  // Locators - List
  // ─────────────────────────────────────────────────────────────────────────────

  /** Work order list container */
  get workOrderList(): Locator {
    return this.page.locator('.work-orders-list');
  }

  /** Individual work order rows */
  get workOrderRows(): Locator {
    return this.page.locator('.work-order-row');
  }

  /** Status chips on rows */
  get statusChips(): Locator {
    return this.page.locator('.status-chip');
  }

  /** New Work Order button in header */
  get newWorkOrderButton(): Locator {
    return this.page.locator('.page-header a', { hasText: 'New Work Order' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Locators - Filters
  // ─────────────────────────────────────────────────────────────────────────────

  /** Filter section container */
  get filterSection(): Locator {
    return this.page.locator('.filter-section');
  }

  /** Status filter chip options */
  get statusFilterChips(): Locator {
    return this.page.locator('mat-chip-option');
  }

  /** Property filter dropdown */
  get propertyFilter(): Locator {
    return this.page.locator('.property-filter mat-select');
  }

  /** Clear filters button */
  get clearFiltersButton(): Locator {
    return this.page.locator('.clear-filters-btn');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/work-orders');
    await this.waitForLoading();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Row Interactions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a specific row by its description text
   */
  getRowByDescription(description: string): Locator {
    return this.workOrderRows.filter({ hasText: description });
  }

  /**
   * Click the expand chevron on a row
   */
  async expandRow(description: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await row.locator('.expand-btn').click();
  }

  /**
   * Click the delete button on a row
   */
  async clickDeleteOnRow(description: string): Promise<void> {
    const row = this.getRowByDescription(description);
    // Hover to reveal action icons
    await row.hover();
    await row.locator('button[aria-label="Delete work order"]').click();
  }

  /**
   * Click the edit button on a row
   */
  async clickEditOnRow(description: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await row.hover();
    await row.locator('a[aria-label="Edit work order"]').click();
  }

  /**
   * Click a row to navigate to detail page
   */
  async clickRow(description: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await row.locator('.row-content').click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions - Filters
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Click a status filter chip
   */
  async clickStatusFilter(status: string): Promise<void> {
    await this.statusFilterChips.filter({ hasText: status }).click();
  }

  /**
   * Select a property from the filter dropdown
   */
  async selectPropertyFilter(propertyName: string): Promise<void> {
    await this.propertyFilter.click({ force: true });
    await this.page.locator('mat-option', { hasText: propertyName }).click();
  }

  /**
   * Click clear filters button
   */
  async clickClearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assert the list uses row layout (not cards)
   */
  async expectRowLayout(): Promise<void> {
    await expect(this.workOrderList).toBeVisible();
    const rows = await this.workOrderRows.count();
    expect(rows).toBeGreaterThan(0);
    // Cards should NOT exist in the list
    await expect(this.page.locator('.work-order-card')).not.toBeVisible();
  }

  /**
   * Assert a row has the expected status chip
   */
  async expectRowHasStatus(description: string, status: string): Promise<void> {
    const row = this.getRowByDescription(description);
    const chip = row.locator('.status-chip');
    await expect(chip).toContainText(status);
    await expect(chip).toHaveClass(new RegExp(`status-${status.toLowerCase()}`));
  }

  /**
   * Assert a row has two-line content
   */
  async expectRowHasTwoLines(description: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await expect(row.locator('.line-1')).toBeVisible();
    await expect(row.locator('.line-2')).toBeVisible();
  }

  /**
   * Assert the expand panel is visible with description
   */
  async expectExpandPanelVisible(description: string): Promise<void> {
    const panel = this.page.locator('.expand-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(description);
  }

  /**
   * Assert the expand panel is NOT visible
   */
  async expectExpandPanelHidden(): Promise<void> {
    await expect(this.page.locator('.expand-panel')).not.toBeVisible();
  }

  /**
   * Assert the row count
   */
  async expectRowCount(count: number): Promise<void> {
    await expect(this.workOrderRows).toHaveCount(count);
  }

  /**
   * Assert a row shows the property name on line 2
   */
  async expectRowHasProperty(description: string, propertyName: string): Promise<void> {
    const row = this.getRowByDescription(description);
    await expect(row.locator('.wo-property')).toContainText(propertyName);
  }

  /**
   * Assert filtered empty state is visible
   */
  async expectFilteredEmptyState(): Promise<void> {
    await expect(this.page.locator('.filtered-empty')).toBeVisible();
  }
}
