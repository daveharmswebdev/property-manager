/**
 * ATDD RED Phase — Story 16.6, AC2
 *
 * E2E tests for total amount display on the Expenses list page.
 * Will NOT pass until:
 * - Backend returns TotalAmount in PagedResult (Task 5)
 * - Frontend stores and displays totalAmount (Task 6)
 *
 * Tests use route interception (network-first pattern) to control API data.
 * Import test/expect from fixtures — NOT @playwright/test (project rule).
 */
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Story 16.6 — Expense Total Amount Display (AC2)', () => {
  test('should display total expenses amount using shared component', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: API returns expenses with totalAmount in response
    await page.route('*/**/api/v1/expenses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              propertyId: '00000000-0000-0000-0000-000000000010',
              propertyName: 'Test Property',
              categoryId: '00000000-0000-0000-0000-000000000020',
              categoryName: 'Repairs',
              amount: 150.0,
              date: '2025-06-15',
              description: 'Plumbing fix',
              createdAt: '2025-06-15T12:00:00Z',
            },
            {
              id: '00000000-0000-0000-0000-000000000002',
              propertyId: '00000000-0000-0000-0000-000000000010',
              propertyName: 'Test Property',
              categoryId: '00000000-0000-0000-0000-000000000021',
              categoryName: 'Supplies',
              amount: 75.5,
              date: '2025-06-20',
              description: 'Paint supplies',
              createdAt: '2025-06-20T12:00:00Z',
            },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 25,
          totalPages: 1,
          totalAmount: 225.5,
        }),
      });
    });

    // Also intercept categories and properties for the page to render
    await page.route('*/**/api/v1/expense-categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '00000000-0000-0000-0000-000000000020', name: 'Repairs', scheduleELine: 'Line 14' },
          {
            id: '00000000-0000-0000-0000-000000000021',
            name: 'Supplies',
            scheduleELine: 'Line 18',
          },
        ]),
      });
    });

    // WHEN: Navigating to expenses list page
    await page.goto('/expenses');

    // THEN: Shared total display component shows formatted total
    const totalDisplay = page.locator('app-list-total-display');
    await expect(totalDisplay).toBeVisible();
    await expect(totalDisplay).toContainText('Total Expenses');
    await expect(totalDisplay).toContainText('$225.50');
  });

  test('should NOT show total when no expenses exist', async ({ page, authenticatedUser }) => {
    // GIVEN: API returns empty expenses
    await page.route('*/**/api/v1/expenses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 25,
          totalPages: 0,
          totalAmount: 0,
        }),
      });
    });

    await page.route('*/**/api/v1/expense-categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Navigating to expenses page with no data
    await page.goto('/expenses');

    // THEN: Total display is NOT shown (hidden when no expenses)
    const totalDisplay = page.locator('app-list-total-display');
    await expect(totalDisplay).not.toBeVisible();
  });
});
