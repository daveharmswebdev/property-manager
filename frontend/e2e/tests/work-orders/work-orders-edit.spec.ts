/**
 * E2E Tests: Work Orders Edit (Story 21.8 — AC-3)
 *
 * Real-backend coverage for editing an existing work order. Seeds a work
 * order via API in `beforeAll`, then exercises the list-row "Edit" hover
 * icon to navigate to the edit page, modifies fields, and submits.
 *
 * Per `work-order.store.ts:420`, on update the store redirects to
 * `/work-orders/:id` (detail page).
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

test.describe('Work Orders Edit E2E (Story 21.8)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };
  let seedWO: { id: string; description: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token);
    seedWO = await createWorkOrderViaApi(token, seedProperty.id, {
      description: `Edit-target ${Date.now()}`,
      status: 'Reported',
    });
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-3: User can edit an existing work order
  // ───────────────────────────────────────────────────────────────────────────
  test('edits an existing work order via the list edit icon', async ({
    page,
    authenticatedUser,
    workOrderListPage,
    workOrderFormPage,
    workOrderDetailPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    const newDescription = `Edited ${Date.now()}`;

    await workOrderListPage.goto();

    // Click Edit on the seeded row (router link, not dialog).
    await workOrderListPage.clickEditOnRow(seedWO.description);
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+\/edit$/);

    // Wait for the form to render with pre-populated values.
    await expect(workOrderFormPage.descriptionInput).toHaveValue(seedWO.description);

    // Update description and status.
    await workOrderFormPage.fillDescription(newDescription);
    await workOrderFormPage.selectStatus('Assigned');

    const responsePromise = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/work-orders\/[a-f0-9-]+$/.test(resp.url()) &&
        resp.request().method() === 'PUT',
    );
    await workOrderFormPage.submit();
    const response = await responsePromise;
    expect([200, 204]).toContain(response.status());

    // Snackbar verbatim from the store (work-order.store.ts:413).
    await workOrderFormPage.expectSnackBar('Work order updated');

    // Store redirects to detail (work-order.store.ts:420).
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Detail page should render the new description and status.
    await expect(workOrderDetailPage.descriptionText).toContainText(newDescription);
    await expect(workOrderDetailPage.statusOptionDisplay).toContainText('Assigned');
  });
});
