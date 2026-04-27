/**
 * E2E Tests: Work Orders Create (Story 21.8 — AC-1, AC-2)
 *
 * Real-backend coverage for the work-order creation flow. Complements the
 * existing fully-mocked `work-order-list.spec.ts`.
 *
 * Strategy: seed one property + one vendor via API once in `beforeAll`, then
 * exercise the UI for each create scenario. Per-test unique descriptions
 * (`Date.now()`) keep assertions safe across runs even with shared seed data.
 *
 * Reality check vs. story AC-1: the work-order store redirects to
 * `/work-orders/:id` (detail page) on create — not `/work-orders` (list)
 * (verified `work-order.store.ts:199`). The test matches the implementation
 * and asserts the row in the list after explicit navigation back.
 *
 * @see docs/project/stories/epic-21/21-8-work-orders-e2e.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  createVendorViaApi,
  resetTestDataViaApi,
} from '../../helpers/work-order.helper';

test.describe('Work Orders Create E2E (Story 21.8)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };
  let seedVendor: { id: string; fullName: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token);
    seedVendor = await createVendorViaApi(token);
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-1: User can create a work order via the UI (real backend round-trip)
  // ───────────────────────────────────────────────────────────────────────────
  test('creates a work order with required fields', async ({
    page,
    authenticatedUser,
    workOrderListPage,
    workOrderFormPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    const description = `Create-target ${Date.now()}`;

    await workOrderListPage.goto();
    await workOrderListPage.newWorkOrderButton.click();
    await page.waitForURL('/work-orders/new');

    await workOrderFormPage.selectProperty(seedProperty.name);
    await workOrderFormPage.fillDescription(description);

    // Status defaults to "Reported" — leave as-is.
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().endsWith('/api/v1/work-orders') &&
        resp.request().method() === 'POST',
    );
    await workOrderFormPage.submit();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Snackbar verbatim from the store (work-order.store.ts:192).
    await workOrderFormPage.expectSnackBar('Work order created');

    // Store redirects to detail page (work-order.store.ts:199).
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Navigate back to the list to verify the row.
    await workOrderListPage.goto();
    await expect(workOrderListPage.getRowByDescription(description)).toBeVisible();
    await workOrderListPage.expectRowHasStatus(description, 'Reported');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-2: Selecting a vendor auto-transitions status to Assigned
  // ───────────────────────────────────────────────────────────────────────────
  test('auto-transitions status to Assigned when a vendor is selected', async ({
    page,
    authenticatedUser,
    workOrderListPage,
    workOrderFormPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    const description = `Auto-assign ${Date.now()}`;

    await page.goto('/work-orders/new');
    await workOrderFormPage.waitForLoading();

    await workOrderFormPage.selectProperty(seedProperty.name);
    await workOrderFormPage.fillDescription(description);
    await workOrderFormPage.selectVendorByName(seedVendor.fullName);

    // Verify the auto-Assigned transition fired before submit
    // (work-order-form.component.ts:561-566).
    await workOrderFormPage.expectStatusValue('Assigned');

    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().endsWith('/api/v1/work-orders') &&
        resp.request().method() === 'POST',
    );
    await workOrderFormPage.submit();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    await workOrderFormPage.expectSnackBar('Work order created');
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Verify the row in the list shows the vendor + Assigned status.
    await workOrderListPage.goto();
    await expect(workOrderListPage.getRowByDescription(description)).toBeVisible();
    await workOrderListPage.expectRowHasStatus(description, 'Assigned');
    await workOrderListPage.expectRowVendor(description, seedVendor.fullName);
  });
});
