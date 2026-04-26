/**
 * E2E Tests: Tenant Dashboard (Story 21.4)
 *
 * Closes the gap left by Stories 20.5 and 20.6 (which deferred E2E coverage to
 * a never-created Story 20.11). These specs verify the tenant flows end-to-end
 * via the real router, real backend, and real auth state.
 *
 * Test isolation strategy: each test creates a throwaway landlord account via
 * the existing invitation flow, then provisions properties + invites tenants on
 * that throwaway account. The seeded `claude@claude.com` account never
 * accumulates properties / tenants / maintenance requests as a result of
 * these tests. See `tenant.helper.ts` for the helpers.
 *
 * @see docs/project/stories/epic-21/21-4-tenant-dashboard-e2e.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  setupTenantContext,
  loginAsTenant,
  createLandlordViaInvitation,
  createPropertyViaApi,
  inviteTenantViaApi,
  acceptTenantInvitation,
  getAccessToken,
  submitMaintenanceRequestViaApi,
} from '../../helpers/tenant.helper';

test.describe('Tenant Dashboard E2E Tests (Story 21.4)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: Submit + list flow (happy path)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant submits a maintenance request and sees it in the dashboard list', async ({
    page,
    mailhog,
    tenantDashboardPage,
    submitRequestPage,
  }) => {
    const ctx = await setupTenantContext(page, mailhog);
    await loginAsTenant(page, ctx.tenantEmail, ctx.tenantPassword);

    // Login redirected to /tenant — the dashboard should already be loaded,
    // but goto() makes the precondition explicit.
    await tenantDashboardPage.goto();
    await expect(tenantDashboardPage.propertyCard).toBeVisible();
    await tenantDashboardPage.expectEmptyState();

    await tenantDashboardPage.clickSubmitRequest();

    const description = `E2E maintenance request ${Date.now()}`;
    await submitRequestPage.fillDescription(description);
    await submitRequestPage.submit();

    // Phase 2 transition + snackbar verifies the POST succeeded (controller
    // returns the new ID, which the component uses to switch to the photo
    // upload view).
    await submitRequestPage.expectPhase2();
    await submitRequestPage.expectSnackBar('Maintenance request submitted');

    await submitRequestPage.clickDone();
    await page.waitForURL('/tenant');

    await tenantDashboardPage.expectRequestInList(description);
    await tenantDashboardPage.expectStatusBadge(description, 'Submitted');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-2: Cross-property isolation (shared visibility within a property)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant only sees requests for their own property', async ({
    page,
    mailhog,
    tenantDashboardPage,
  }) => {
    // One landlord, two properties, one tenant per property — verifies that
    // Tenant-A on Property A does NOT see Tenant-B's requests on Property B.
    const landlord = await createLandlordViaInvitation(mailhog);

    const propertyAId = await createPropertyViaApi(landlord.token, {
      name: `Property A ${Date.now()}`,
    });
    const propertyBId = await createPropertyViaApi(landlord.token, {
      name: `Property B ${Date.now()}`,
    });

    const tenantPassword = 'Throwaway@123456';
    const tenantAEmail = `e2e-tenant-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const tenantBEmail = `e2e-tenant-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    await inviteTenantViaApi(landlord.token, propertyAId, tenantAEmail);
    await inviteTenantViaApi(landlord.token, propertyBId, tenantBEmail);

    await acceptTenantInvitation(page, mailhog, tenantAEmail, tenantPassword);
    await acceptTenantInvitation(page, mailhog, tenantBEmail, tenantPassword);

    const tenantAToken = await getAccessToken(tenantAEmail, tenantPassword);
    const tenantBToken = await getAccessToken(tenantBEmail, tenantPassword);

    const suffix = Date.now();
    const descA1 = `A-1 request ${suffix}`;
    const descA2 = `A-2 request ${suffix}`;
    const descB1 = `B-1 request ${suffix}`;

    await submitMaintenanceRequestViaApi(tenantAToken, descA1);
    await submitMaintenanceRequestViaApi(tenantAToken, descA2);
    await submitMaintenanceRequestViaApi(tenantBToken, descB1);

    await loginAsTenant(page, tenantAEmail, tenantPassword);
    await tenantDashboardPage.goto();

    await tenantDashboardPage.expectRequestInList(descA1);
    await tenantDashboardPage.expectRequestInList(descA2);
    await tenantDashboardPage.expectRequestNotInList(descB1);
    await tenantDashboardPage.expectRequestCount(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-3: Required-field validation
  // ─────────────────────────────────────────────────────────────────────────
  test('submit form requires description', async ({
    page,
    mailhog,
    submitRequestPage,
  }) => {
    const ctx = await setupTenantContext(page, mailhog);
    await loginAsTenant(page, ctx.tenantEmail, ctx.tenantPassword);

    await submitRequestPage.goto();

    // Empty form -> submit is disabled.
    await submitRequestPage.expectSubmitDisabled();

    // Touching then blurring the textarea (without entering text) surfaces
    // the "Description is required" mat-error.
    await submitRequestPage.descriptionInput.click();
    await submitRequestPage.descriptionInput.blur();

    await submitRequestPage.expectRequiredError();

    // Submit stays disabled — Playwright won't fire a click on a disabled
    // button, which is the simpler equivalent of asserting "no POST sent".
    await submitRequestPage.expectSubmitDisabled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-4: Role guards (tenant <-> landlord)
  // ─────────────────────────────────────────────────────────────────────────
  // Note on route selection: the story originally listed `/expenses`,
  // `/properties`, and `/dashboard` as the landlord routes to test. Inspection
  // of `app.routes.ts` shows that `/properties` and `/dashboard` are NOT
  // protected by `ownerGuard` — only `/expenses`, `/income`, `/vendors`,
  // `/reports`, `/settings`, `/work-orders/new`, etc. are. This test uses
  // routes that ARE actually guarded; testing un-guarded routes would assert
  // behavior that doesn't exist.
  test('tenant guard redirects landlord routes back to /tenant', async ({
    page,
    mailhog,
    tenantDashboardPage,
  }) => {
    const ctx = await setupTenantContext(page, mailhog);
    await loginAsTenant(page, ctx.tenantEmail, ctx.tenantPassword);

    for (const landlordRoute of ['/expenses', '/income', '/vendors']) {
      await page.goto(landlordRoute);
      await page.waitForURL('/tenant');
      await expect(tenantDashboardPage.propertyCard).toBeVisible();
    }
  });

  test('landlord cannot access /tenant — redirected to /dashboard', async ({
    page,
    authenticatedUser,
  }) => {
    // `authenticatedUser` fixture logs in the seeded landlord and lands on
    // /dashboard. Prefer it over re-implementing the login here.
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await page.goto('/tenant');
    await page.waitForURL('/dashboard');
  });
});
