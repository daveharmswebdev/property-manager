/**
 * ATDD RED Phase — Story 16.6, AC1 + AC2
 *
 * E2E tests for shared components integrated into the Income page.
 * Will NOT pass until:
 * - DateRangeFilterComponent created and wired into income page (Tasks 1, 3)
 * - ListTotalDisplayComponent replaces inline total display (Task 7)
 *
 * Tests use route interception (network-first pattern) to control API data.
 * Import test/expect from fixtures — NOT @playwright/test (project rule).
 */
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Story 16.6 — Income Page Shared Components', () => {
  test.describe('Date Range Presets on Income (AC1)', () => {
    test('should display date range preset dropdown on income page', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Income page with data
      await page.route('*/**/api/v1/income*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [],
            totalCount: 0,
            totalAmount: 0,
          }),
        });
      });

      // WHEN: Navigating to income page
      await page.goto('/income');

      // THEN: Shared date range filter with preset dropdown is visible
      const dateRangeFilter = page.locator('app-date-range-filter');
      await expect(dateRangeFilter).toBeVisible();

      const presetDropdown = dateRangeFilter.locator('mat-select');
      await expect(presetDropdown).toBeVisible();
    });

    test('should show 5 preset options when dropdown opened', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Income page loaded
      await page.route('*/**/api/v1/income*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0, totalAmount: 0 }),
        });
      });
      await page.goto('/income');

      // WHEN: Opening the preset dropdown
      await page.locator('app-date-range-filter mat-select').click();

      // THEN: All 5 preset options are available
      const options = page.locator('mat-option');
      await expect(options).toHaveCount(5);
    });

    test('should show custom date inputs when Custom Range selected', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Income page loaded
      await page.route('*/**/api/v1/income*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0, totalAmount: 0 }),
        });
      });
      await page.goto('/income');

      // WHEN: Selecting "Custom Range" preset
      await page.locator('app-date-range-filter mat-select').click();
      await page.getByRole('option', { name: 'Custom Range' }).click();

      // THEN: Custom date pickers appear
      const dateFields = page.locator('app-date-range-filter .date-fields');
      await expect(dateFields).toBeVisible();
    });
  });

  test.describe('Total Income Uses Shared Component (AC2)', () => {
    test('should display total income using shared ListTotalDisplayComponent', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: API returns income with known total
      await page.route('*/**/api/v1/income*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: '00000000-0000-0000-0000-000000000001',
                propertyId: '00000000-0000-0000-0000-000000000010',
                propertyName: 'Test Property',
                amount: 2500.0,
                date: '2025-06-15',
                source: 'Rent',
                description: 'June rent',
                createdAt: '2025-06-15T12:00:00Z',
              },
            ],
            totalCount: 1,
            totalAmount: 2500.0,
          }),
        });
      });

      // WHEN: Navigating to income page
      await page.goto('/income');

      // THEN: Shared total display component shows formatted total
      const totalDisplay = page.locator('app-list-total-display');
      await expect(totalDisplay).toBeVisible();
      await expect(totalDisplay).toContainText('Total Income');
      await expect(totalDisplay).toContainText('$2,500.00');
    });
  });
});
