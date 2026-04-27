/**
 * E2E Tests: Work Orders Delete (Story 21.8 — AC-4, AC-5)
 *
 * Real-backend coverage for deleting work orders from both the list-row
 * action icon and the detail-page header button. Per the store
 * (`work-order.store.ts:484-487`), only the detail-page delete redirects to
 * `/work-orders` — list-row delete just removes the row in place.
 *
 * @see docs/project/stories/epic-21/21-8-work-orders-e2e.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  createWorkOrderViaApi,
  resetTestDataViaApi,
} from '../../helpers/work-order.helper';

test.describe('Work Orders Delete E2E (Story 21.8)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token);
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-4: Delete from list row + confirm dialog
  // ───────────────────────────────────────────────────────────────────────────
  test('deletes a work order from the list row', async ({
    page,
    authenticatedUser,
    workOrderListPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    const wo = await createWorkOrderViaApi(token, seedProperty.id, {
      description: `Delete-target row ${Date.now()}`,
    });

    await workOrderListPage.goto();
    await expect(workOrderListPage.getRowByDescription(wo.description)).toBeVisible();

    await workOrderListPage.clickDeleteOnRow(wo.description);
    await workOrderListPage.waitForConfirmDialog();

    const deletePromise = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/work-orders\/[a-f0-9-]+$/.test(resp.url()) &&
        resp.request().method() === 'DELETE',
    );
    await workOrderListPage.confirmDialogAction('Work order deleted');
    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await workOrderListPage.expectRowNotInList(wo.description);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-5: Delete from detail page redirects back to list
  // ───────────────────────────────────────────────────────────────────────────
  test('deletes a work order from the detail page', async ({
    page,
    authenticatedUser,
    workOrderListPage,
    workOrderDetailPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    const wo = await createWorkOrderViaApi(token, seedProperty.id, {
      description: `Delete-target detail ${Date.now()}`,
    });

    await workOrderDetailPage.gotoWorkOrder(wo.id);

    await workOrderDetailPage.clickDelete();

    const deletePromise = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/work-orders\/[a-f0-9-]+$/.test(resp.url()) &&
        resp.request().method() === 'DELETE',
    );
    await workOrderDetailPage.confirmDelete();
    const response = await deletePromise;
    expect(response.status()).toBe(204);

    // confirmDelete already waited for `/work-orders` URL.
    await workOrderListPage.expectRowNotInList(wo.description);
  });
});
