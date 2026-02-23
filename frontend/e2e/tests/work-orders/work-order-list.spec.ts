import { type Page, type Route } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Work Order List E2E Tests (Story 16-8)
 *
 * Tests the enriched two-line row layout, expand/collapse,
 * delete confirmation, status chips, and filter interactions.
 *
 * Uses page.route() to intercept API calls and provide controlled
 * mock data — avoids polluting the shared test database.
 */

/** Mock work orders for API interception */
const mockWorkOrders = [
  {
    id: 'e2e-wo-1',
    propertyId: 'e2e-prop-1',
    propertyName: 'E2E Test Property',
    description: 'Fix the leaky faucet',
    status: 'Reported',
    isDiy: true,
    vendorId: null,
    vendorName: null,
    categoryId: 'cat-1',
    categoryName: 'Plumbing',
    tags: [{ id: 'tag-1', name: 'Urgent' }],
    createdAt: '2026-02-20T10:00:00Z',
    createdByUserId: 'user-1',
    primaryPhotoThumbnailUrl: null,
  },
  {
    id: 'e2e-wo-2',
    propertyId: 'e2e-prop-1',
    propertyName: 'E2E Test Property',
    description: 'Replace roof shingles',
    status: 'Assigned',
    isDiy: false,
    vendorId: 'vendor-1',
    vendorName: 'John Roofer',
    categoryId: 'cat-2',
    categoryName: 'Repairs',
    tags: [],
    createdAt: '2026-02-19T10:00:00Z',
    createdByUserId: 'user-1',
    primaryPhotoThumbnailUrl: null,
  },
  {
    id: 'e2e-wo-3',
    propertyId: 'e2e-prop-2',
    propertyName: 'Other Test Property',
    description: 'Paint exterior walls',
    status: 'Completed',
    isDiy: false,
    vendorId: 'vendor-2',
    vendorName: 'Paint Pros LLC',
    categoryId: null,
    categoryName: null,
    tags: [],
    createdAt: '2026-02-18T10:00:00Z',
    createdByUserId: 'user-1',
    primaryPhotoThumbnailUrl: null,
  },
];

const mockProperties = [
  { id: 'e2e-prop-1', name: 'E2E Test Property' },
  { id: 'e2e-prop-2', name: 'Other Test Property' },
];

/**
 * Helper to set up API route interception with mock data
 */
async function setupMockApi(page: Page) {
  // Intercept work orders list API
  await page.route('*/**/api/v1/work-orders', async (route: Route) => {
    if (route.request().method() === 'GET') {
      // Check query params for filter simulation
      const url = new URL(route.request().url());
      const statusParam = url.searchParams.get('status');
      let filtered = [...mockWorkOrders];

      if (statusParam) {
        const statuses = statusParam.split(',');
        filtered = filtered.filter((wo) => statuses.includes(wo.status));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: filtered, totalCount: filtered.length }),
      });
    } else {
      await route.continue();
    }
  });

  // Intercept properties list API
  await page.route('*/**/api/v1/properties*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockProperties, totalCount: mockProperties.length }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Work Order List View (Story 16-8)', () => {
  test('should display work orders as enriched rows, not cards (AC1)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    // Rows should exist
    await expect(workOrderListPage.workOrderRows).toHaveCount(3);

    // Cards should NOT exist
    await expect(page.locator('.work-order-card')).not.toBeVisible();
  });

  test('should display two-line row content with status chip, title, assignee, property (AC2)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    const firstRow = workOrderListPage.getRowByDescription('Fix the leaky faucet');

    // Line 1: status chip, title, assignee, date
    await expect(firstRow.locator('.line-1')).toBeVisible();
    await expect(firstRow.locator('.status-chip')).toContainText('Reported');
    await expect(firstRow.locator('.wo-title')).toContainText('Fix the leaky faucet');
    await expect(firstRow.locator('.wo-assignee')).toContainText('DIY');
    await expect(firstRow.locator('.wo-date')).toBeVisible();

    // Line 2: property name
    await expect(firstRow.locator('.line-2')).toBeVisible();
    await expect(firstRow.locator('.wo-property')).toContainText('E2E Test Property');
  });

  test('should display color-coded status chips (AC3)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    // Reported = orange (status-reported class)
    await workOrderListPage.expectRowHasStatus('Fix the leaky faucet', 'Reported');

    // Assigned = blue (status-assigned class)
    await workOrderListPage.expectRowHasStatus('Replace roof shingles', 'Assigned');

    // Completed = green (status-completed class)
    await workOrderListPage.expectRowHasStatus('Paint exterior walls', 'Completed');
  });

  test('should toggle expand/collapse panel on chevron click (AC5)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    // Panel should not be visible initially
    await workOrderListPage.expectExpandPanelHidden();

    // Click expand chevron
    await workOrderListPage.expandRow('Fix the leaky faucet');

    // Panel should now be visible with description
    await workOrderListPage.expectExpandPanelVisible('Fix the leaky faucet');

    // Click again to collapse
    await workOrderListPage.expandRow('Fix the leaky faucet');
    await workOrderListPage.expectExpandPanelHidden();
  });

  test('should not navigate when clicking expand chevron (AC5)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    const initialUrl = page.url();

    // Click expand chevron
    await workOrderListPage.expandRow('Fix the leaky faucet');

    // Should still be on the same page
    expect(page.url()).toBe(initialUrl);
  });

  test('should show vendor name on line 2 for vendor-assigned work orders (AC2)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    const vendorRow = workOrderListPage.getRowByDescription('Replace roof shingles');
    await expect(vendorRow.locator('.wo-vendor')).toContainText('John Roofer');
  });

  test('should show tags when present (AC2)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    const tagRow = workOrderListPage.getRowByDescription('Fix the leaky faucet');
    await expect(tagRow.locator('.wo-tags')).toContainText('Urgent');
  });

  test('should show action icons (edit, delete) on row hover (AC2)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    const firstRow = workOrderListPage.getRowByDescription('Fix the leaky faucet');

    // Hover to reveal actions
    await firstRow.hover();

    await expect(firstRow.locator('a[aria-label="Edit work order"]')).toBeVisible();
    await expect(firstRow.locator('button[aria-label="Delete work order"]')).toBeVisible();
  });

  test('should open delete confirmation dialog (AC2)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    // Click delete on first row
    await workOrderListPage.clickDeleteOnRow('Fix the leaky faucet');

    // Dialog should appear
    await workOrderListPage.waitForConfirmDialog();
    await expect(workOrderListPage.confirmDialog).toContainText('Fix the leaky faucet');
    await expect(workOrderListPage.confirmDialog).toContainText('permanently removed');

    // Cancel the dialog
    await workOrderListPage.cancelDialogAction();
  });

  test('should render filter section with status chips and property dropdown (AC7)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    // Filter section visible
    await expect(workOrderListPage.filterSection).toBeVisible();

    // Status filter chips present
    await expect(workOrderListPage.statusFilterChips).toHaveCount(3);

    // Property dropdown present
    await expect(workOrderListPage.propertyFilter).toBeVisible();
  });

  test('should show New Work Order button that navigates to create page (AC8)', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    await setupMockApi(page);
    await workOrderListPage.goto();

    await expect(workOrderListPage.newWorkOrderButton).toBeVisible();
    await workOrderListPage.newWorkOrderButton.click();
    await expect(page).toHaveURL('/work-orders/new');
  });
});
