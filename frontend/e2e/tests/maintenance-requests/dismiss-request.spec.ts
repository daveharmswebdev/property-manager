/**
 * E2E Tests: Dismiss Maintenance Request (Story 20.9)
 *
 * Verifies the landlord-side dismiss flow end-to-end:
 * - Dismiss button visibility on Submitted requests (next to Convert)
 * - Happy-path dismissal: dialog → snackbar → detail page re-renders Dismissed
 * - Tenant dashboard reflects Dismissed status + reason after the landlord acts
 * - Cancel closes dialog with no side effects
 *
 * Test isolation strategy mirrors Story 20.8's convert spec: every spec
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

test.describe('Dismiss Maintenance Request E2E (Story 20.9)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec 1 — Dismiss button visible for Submitted requests (AC #1)
  // Both Convert and Dismiss share the Submitted-only visibility rule.
  // ─────────────────────────────────────────────────────────────────────────
  test('Dismiss button is visible on the detail page when status is Submitted', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Dismiss-Vis-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-dis-vis-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Dismiss visibility ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);

    await expect(maintenanceRequestDetailPage.root).toBeVisible();
    await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible();
    // Convert button shares the visibility rule.
    await expect(page.locator('[data-testid="convert-button"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 2 — Happy-path dismissal updates the detail page (AC #6, #8)
  // ─────────────────────────────────────────────────────────────────────────
  test('clicking Dismiss opens dialog, submits, and re-renders the detail page as Dismissed', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
    dismissRequestDialogPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Dismiss-Happy-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-dis-happy-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Dismiss happy path ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    const detailUrl = page.url();

    await page.locator('[data-testid="dismiss-button"]').click();
    await dismissRequestDialogPage.expectVisible();

    const reason = `E2E dismissal reason ${Date.now()}`;
    await dismissRequestDialogPage.setReason(reason);
    await dismissRequestDialogPage.submit();

    // Snackbar shown; URL unchanged (landlord stays on the detail page).
    await dismissRequestDialogPage.expectSnackBar('Maintenance request dismissed');
    expect(page.url()).toBe(detailUrl);

    // Status chip becomes Dismissed.
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('Dismissed');

    // Dismissal-reason block appears with the persisted reason.
    const dismissalBlock = page.locator('[data-testid="dismissal-reason"]');
    await expect(dismissalBlock).toBeVisible();
    await expect(dismissalBlock).toContainText(reason);

    // Both action buttons disappear because status is no longer Submitted.
    await expect(page.locator('[data-testid="dismiss-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="convert-button"]')).toHaveCount(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 3 — Tenant sees Dismissed status after landlord dismisses (AC #9)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant dashboard shows Dismissed after landlord dismisses', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    dismissRequestDialogPage,
    tenantDashboardPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Dismiss-Tenant-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-dis-tenant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Tenant sees dismissed ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    // Landlord dismisses.
    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    await page.locator('[data-testid="dismiss-button"]').click();
    await dismissRequestDialogPage.expectVisible();
    const reason = `Out of scope ${Date.now()}`;
    await dismissRequestDialogPage.setReason(reason);
    await dismissRequestDialogPage.submit();
    await dismissRequestDialogPage.expectSnackBar('Maintenance request dismissed');

    // Clear landlord auth state before tenant logs in.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Tenant logs in fresh and verifies the dashboard status.
    await loginAsTenant(page, tenantEmail, tenantPassword);
    await tenantDashboardPage.goto();

    await tenantDashboardPage.expectStatusBadge(description, 'Dismissed');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 4 — Cancel closes the dialog with no side effects (AC #17)
  // ─────────────────────────────────────────────────────────────────────────
  test('Cancel closes the dialog and the request status stays Submitted', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
    dismissRequestDialogPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Dismiss-Cancel-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-dis-cancel-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);

    const description = `Dismiss cancel ${Date.now()}`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);
    const detailUrl = page.url();

    await page.locator('[data-testid="dismiss-button"]').click();
    await dismissRequestDialogPage.expectVisible();
    await dismissRequestDialogPage.cancel();
    await dismissRequestDialogPage.expectClosed();

    // URL unchanged.
    expect(page.url()).toBe(detailUrl);

    // Status chip still shows Submitted.
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('Submitted');

    // Dismiss button still visible because status didn't transition.
    await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible();
  });
});
