/**
 * E2E Tests: Dashboard (Story 21.10 — AC-2, AC-3)
 *
 * Coverage for the Owner-role dashboard page (`/dashboard`):
 *
 *  - AC-2 (one test): seeded property + expense + income render in the
 *    stats-bar and per-property row.
 *  - AC-3 (one test): empty-state visible when `/api/v1/properties` is
 *    intercepted to return zero items.
 *  - AC-3.3 (one test): empty-state's Add Property button navigates to
 *    `/properties/new`.
 *
 * Reality-check notes (epic vs. shipped UI):
 *  - Dashboard does NOT call `/api/v1/dashboard/totals` — totals are
 *    computed client-side from the per-property rows returned by
 *    `/api/v1/properties`. The empty-state mock therefore intercepts
 *    `/api/v1/properties`, NOT `/api/v1/dashboard/totals`.
 *  - The stats-bar is unconditionally rendered for Owner role even when
 *    the empty-state card is shown — the "context" for $0 totals is the
 *    empty-state card, not the absence of the stats-bar.
 *  - There is NO "recent activity" section.
 *
 * @see docs/project/stories/epic-21/21-10-dashboard-unit-and-e2e-tests.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  createExpenseViaApi,
  createIncomeViaApi,
  resetTestDataViaApi,
} from '../../helpers/dashboard.helper';

/**
 * Build an ISO date string in the current year, guaranteed to be in the past
 * (the API rejects future-dated expenses/income). Falls back to Jan 1 when
 * the test runs early in January.
 */
function pastDateThisYear(): string {
  const now = new Date();
  // Use yesterday (UTC-based) so we never trip the API's "Date cannot be in
  // the future" validator while still landing inside `this-year`.
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  // If yesterday rolled into the prior year, clamp to Jan 1 of this year.
  if (yesterday.getUTCFullYear() !== now.getUTCFullYear()) {
    return `${now.getUTCFullYear()}-01-01`;
  }
  const mm = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(yesterday.getUTCDate()).padStart(2, '0');
  return `${now.getUTCFullYear()}-${mm}-${dd}`;
}

test.describe('Dashboard E2E (Story 21.10)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token, {
      name: `Dashboard E2E Property ${Date.now()}`,
    });
    const seedDate = pastDateThisYear();
    await createExpenseViaApi(token, seedProperty.id, 250, seedDate);
    await createIncomeViaApi(token, seedProperty.id, 1500, seedDate);
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-2: dashboard renders with seeded data — header, stats-bar, property row
  // ───────────────────────────────────────────────────────────────────────────
  test('renders dashboard with seeded property, expense, and income', async ({
    page,
    authenticatedUser,
    dashboardPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await dashboardPage.goto();

    // AC-2.1: welcome header + Add Property button
    await dashboardPage.expectWelcome();
    await expect(dashboardPage.addPropertyButton.first()).toBeVisible();

    // AC-2.2: stats-bar renders with non-zero values
    await expect(dashboardPage.statsBar).toBeVisible();
    await expect(page.locator('.stat-card.expense-card .stat-value')).toHaveText(
      /\$[1-9][\d,.]*/,
    );
    await expect(page.locator('.stat-card.income-card .stat-value')).toHaveText(
      /\$[1-9][\d,.]*/,
    );
    // Net stat may be displayed as positive ($) or negative (parentheses) — match either.
    await expect(page.locator('.stat-card.net-card .stat-value')).toHaveText(
      /[\$(][1-9][\d,.]*\)?/,
    );

    // AC-2.3: per-property row renders with non-zero expense + net values
    await dashboardPage.expectPropertyInList(seedProperty.name);
    const seededRow = page.locator('app-property-row', { hasText: seedProperty.name });
    await expect(seededRow.locator('.expense-value')).toHaveText(/\$[1-9][\d,.]*/);
    await expect(seededRow.locator('.net-value')).toHaveText(/[\$(][1-9][\d,.]*\)?/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-3: empty-state when GET /api/v1/properties returns zero items
  // ───────────────────────────────────────────────────────────────────────────
  test('shows empty-state when account has no properties', async ({
    page,
    authenticatedUser,
    dashboardPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await page.route('**/api/v1/properties**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await dashboardPage.goto();

    // AC-3.1: empty-state card visible with title + message
    await dashboardPage.expectNoProperties();
    await expect(page.locator('app-empty-state h2')).toHaveText('No properties yet');
    await expect(page.locator('app-empty-state p')).toHaveText(
      'Add your first property to get started.',
    );

    // AC-3.2: no error indicator displayed
    await expect(page.locator('app-error-card')).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-3.3: empty-state Add Property action navigates to /properties/new
  // ───────────────────────────────────────────────────────────────────────────
  test('empty-state Add Property button navigates to /properties/new', async ({
    page,
    authenticatedUser,
    dashboardPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await page.route('**/api/v1/properties**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await dashboardPage.goto();
    await dashboardPage.expectNoProperties();

    await page.locator('app-empty-state button').click();
    await page.waitForURL('**/properties/new');
    expect(page.url()).toContain('/properties/new');
  });
});
