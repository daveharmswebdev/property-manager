/**
 * E2E Tests: Maintenance Request Resolution Sync (Story 20.10)
 *
 * Verifies the end-to-end contract from epic-20 FR-TP17:
 * - When the landlord completes a WorkOrder linked to a MaintenanceRequest,
 *   the request's status is automatically set to Resolved.
 * - The tenant sees the Resolved status on the dashboard after reload.
 * - A non-Completed status change does NOT propagate to the linked request.
 *
 * Test isolation mirrors the convert-request and dismiss-request specs:
 * throwaway landlord via invitation, throwaway property, throwaway tenant,
 * per-run unique descriptions/emails (Date.now() + random suffix).
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  createLandlordViaInvitation,
  createPropertyViaApi,
  inviteTenantViaApi,
  acceptTenantInvitation,
  getAccessToken,
  loginAsLandlord,
  loginAsTenant,
  submitMaintenanceRequestViaApi,
} from '../../helpers/tenant.helper';

test.describe('Maintenance Request Resolution Sync E2E (Story 20.10)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec 1 — Happy path: landlord completes WO → tenant sees Resolved
  // (AC #1, #5)
  // ─────────────────────────────────────────────────────────────────────────
  test('landlord completing the linked work order resolves the request for the tenant', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
    convertRequestDialogPage,
    tenantDashboardPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Resolve-Happy-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-resolve-happy-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Resolve happy path ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    // Landlord logs in, opens detail, converts → MR is InProgress, WO is Reported.
    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    const requestUrl = page.url();
    const requestId = requestUrl.split('/').pop()!;

    await page.locator('[data-testid="convert-button"]').click();
    await convertRequestDialogPage.expectVisible();
    await convertRequestDialogPage.submit();
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Change WO status from Reported → Completed via the Story 17-10 dropdown.
    await page.locator('mat-select').first().click();
    const statusPutPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/work-orders/') && r.request().method() === 'PUT',
    );
    await page.locator('mat-option:has-text("Completed")').click();
    await statusPutPromise;
    await page.locator('[matsnackbarlabel]').filter({ hasText: 'Status updated' }).first().waitFor({
      state: 'visible',
      timeout: 5000,
    });

    // Landlord reloads the request detail — status chip should now read "Resolved".
    await page.goto(`/maintenance-requests/${requestId}`);
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('Resolved');

    // Tenant logs in fresh and verifies the dashboard reflects Resolved.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await loginAsTenant(page, tenantEmail, tenantPassword);
    await tenantDashboardPage.goto();
    await tenantDashboardPage.expectStatusBadge(description, 'Resolved');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 2 — Non-Completed status change does NOT resolve the request (AC #2)
  // ─────────────────────────────────────────────────────────────────────────
  test('changing the work-order status to a non-Completed value leaves the request In Progress', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
    convertRequestDialogPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Resolve-NonComplete-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-resolve-noncomplete-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Resolve negative path ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    // Landlord converts → MR is InProgress, WO is Reported.
    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    const requestUrl = page.url();
    const requestId = requestUrl.split('/').pop()!;

    await page.locator('[data-testid="convert-button"]').click();
    await convertRequestDialogPage.expectVisible();
    await convertRequestDialogPage.submit();
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Change WO status from Reported → Assigned (NOT Completed).
    await page.locator('mat-select').first().click();
    const statusPutPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/work-orders/') && r.request().method() === 'PUT',
    );
    await page.locator('mat-option:has-text("Assigned")').click();
    await statusPutPromise;
    await page.locator('[matsnackbarlabel]').filter({ hasText: 'Status updated' }).first().waitFor({
      state: 'visible',
      timeout: 5000,
    });

    // Landlord reloads the request detail — status chip MUST still read
    // "In Progress" (label transform from the InProgress enum).
    await page.goto(`/maintenance-requests/${requestId}`);
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('In Progress');
  });
});
