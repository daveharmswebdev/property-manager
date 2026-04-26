import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * TenantDashboardPage - Page object for the tenant dashboard E2E tests
 * (Story 21.4).
 *
 * Covers the tenant-facing `/tenant` route shipped in Story 20.5:
 * - Property info card
 * - Submit request action (desktop button + mobile FAB)
 * - Maintenance request list (status chip + description)
 * - Empty state (`app-empty-state`)
 */
export class TenantDashboardPage extends BasePage {
  /** Property info card */
  readonly propertyCard: Locator;

  /** Desktop "Submit Request" button (hidden on mobile via .desktop-only) */
  readonly submitRequestButtonDesktop: Locator;

  /** Mobile floating action button (hidden on desktop via .mobile-only) */
  readonly submitRequestFab: Locator;

  /** Wrapper around the request list (only present when requests exist) */
  readonly requestList: Locator;

  /** Individual request cards inside the list */
  readonly requestCards: Locator;

  constructor(page: Page) {
    super(page);
    this.propertyCard = page.locator('[data-testid="property-card"]');
    this.submitRequestButtonDesktop = page.locator('[data-testid="submit-request-btn"]');
    this.submitRequestFab = page.locator('[data-testid="submit-fab"]');
    this.requestList = page.locator('[data-testid="request-list"]');
    this.requestCards = page.locator('[data-testid="request-list"] mat-card.request-card');
  }

  /**
   * Override the BasePage default (`.empty-state`) to use the component
   * selector that the tenant dashboard actually renders.
   */
  override get emptyStateLocator(): Locator {
    return this.page.locator('app-empty-state');
  }

  async goto(): Promise<void> {
    await this.page.goto('/tenant');
    await this.waitForLoading();
  }

  /**
   * Click the desktop "Submit Request" button. E2E runs Chromium desktop
   * viewport per `playwright.config.ts`, so the FAB is hidden by SCSS.
   *
   * Asserts visibility first to avoid silent click-on-hidden failures.
   */
  async clickSubmitRequest(): Promise<void> {
    await expect(this.submitRequestButtonDesktop).toBeVisible();
    await this.submitRequestButtonDesktop.click();
    await this.page.waitForURL('/tenant/submit-request');
  }

  /**
   * Locate a request card by its description text.
   */
  getRequestCard(description: string): Locator {
    return this.page.locator('mat-card.request-card', { hasText: description });
  }

  async expectRequestInList(description: string): Promise<void> {
    await expect(this.getRequestCard(description)).toBeVisible();
  }

  async expectRequestNotInList(description: string): Promise<void> {
    await expect(this.getRequestCard(description)).toHaveCount(0);
  }

  async expectRequestCount(n: number): Promise<void> {
    await expect(this.requestCards).toHaveCount(n);
  }

  /**
   * Assert the status chip on the row that matches the supplied description
   * has the expected status text.
   */
  async expectStatusBadge(
    description: string,
    status: 'Submitted' | 'In Progress' | 'Resolved' | 'Dismissed',
  ): Promise<void> {
    const card = this.getRequestCard(description);
    const chip = card.locator('mat-chip');
    await expect(chip).toHaveText(status);
  }
}
