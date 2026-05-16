/**
 * E2E Tests: Convert Maintenance Request to Work Order (Story 20.8)
 *
 * Verifies the landlord-side convert flow end-to-end:
 * - Convert button visibility on Submitted requests
 * - Happy-path conversion → new work order, snackbar, navigation
 * - Tenant dashboard reflects InProgress after conversion
 * - Cancel closes dialog with no side effects
 *
 * Test isolation strategy mirrors Story 20.7's landlord-inbox spec: every spec
 * provisions a throwaway landlord via `createLandlordViaInvitation` and uses
 * per-run unique data (Date.now() + random suffix).
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

test.describe('Convert Maintenance Request to Work Order E2E (Story 20.8)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec 1 — Convert button visible for Submitted requests (AC #1)
  // ─────────────────────────────────────────────────────────────────────────
  test('Convert button is visible on the detail page when status is Submitted', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Convert-Vis-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-conv-vis-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Convert visibility ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);

    await expect(maintenanceRequestDetailPage.root).toBeVisible();
    await expect(page.locator('[data-testid="convert-button"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 2 — Happy-path conversion navigates to the new work order (AC #5, #8)
  // ─────────────────────────────────────────────────────────────────────────
  test('clicking Convert opens dialog, submits, and navigates to the new work order', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    convertRequestDialogPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Convert-Happy-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-conv-happy-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Convert happy path ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);

    await page.locator('[data-testid="convert-button"]').click();
    await convertRequestDialogPage.expectVisible();

    // Description is pre-filled from the request.
    await expect(convertRequestDialogPage.descriptionInput).toHaveValue(description);

    await convertRequestDialogPage.submit();

    // Snackbar + navigation to the new work order.
    await convertRequestDialogPage.expectSnackBar(
      'Work order created — maintenance request marked In Progress',
    );
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 3 — Tenant sees "In Progress" after the landlord converts (AC #9)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant dashboard shows In Progress after landlord converts', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    convertRequestDialogPage,
    tenantDashboardPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Convert-Tenant-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-conv-tenant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Tenant sees in progress ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    // Landlord converts.
    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    await page.locator('[data-testid="convert-button"]').click();
    await convertRequestDialogPage.expectVisible();
    await convertRequestDialogPage.submit();
    await page.waitForURL(/\/work-orders\/[a-f0-9-]+$/);

    // Clear landlord auth state before tenant logs in.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Tenant logs in fresh and verifies the dashboard status.
    await loginAsTenant(page, tenantEmail, tenantPassword);
    await tenantDashboardPage.goto();

    await tenantDashboardPage.expectStatusBadge(description, 'In Progress');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 4 — Cancel closes the dialog with no side effects (AC #16)
  // ─────────────────────────────────────────────────────────────────────────
  test('Cancel closes the dialog and the request status stays Submitted', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
    convertRequestDialogPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Convert-Cancel-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-conv-cancel-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Convert cancel ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    const detailUrl = page.url();

    await page.locator('[data-testid="convert-button"]').click();
    await convertRequestDialogPage.expectVisible();
    await convertRequestDialogPage.cancel();
    await convertRequestDialogPage.expectClosed();

    // URL unchanged.
    expect(page.url()).toBe(detailUrl);

    // Status chip still shows Submitted.
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('Submitted');

    // Convert button still visible because status didn't transition.
    await expect(page.locator('[data-testid="convert-button"]')).toBeVisible();
  });
});
