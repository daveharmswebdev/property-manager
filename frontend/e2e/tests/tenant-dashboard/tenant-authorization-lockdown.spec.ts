/**
 * E2E Tests: Tenant Authorization Lockdown (Story 20.11)
 *
 * Proves end-to-end that the tenant lockdown holds: a logged-in tenant cannot
 * navigate to landlord routes (UI guards), cannot call landlord APIs (backend
 * policy), and cannot see cross-property maintenance requests (handler scoping).
 *
 * Spec 1 — UI navigation lockdown (AC #15)
 * Spec 2 — Direct API call returns 403 (AC #2, #3, #5, #6)
 * Spec 3 — Cross-property isolation (AC #10)
 *
 * Mimics the test-isolation strategy from tenant-dashboard.spec.ts: each test
 * creates a throwaway landlord via the seeded `claude@claude.com` invitation
 * flow, then provisions properties and tenants on that throwaway landlord. The
 * seeded account never accumulates rows. See `tenant.helper.ts`.
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

test.describe('Tenant Authorization Lockdown E2E (Story 20.11)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec 1 — UI navigation lockdown (AC #15)
  // ─────────────────────────────────────────────────────────────────────────
  // Subset of routes covered by the unit-test matrix; the E2E proves the route
  // guard + permission service + sidebar chain actually trips in the browser.
  test('tenant landing on landlord routes is redirected to /tenant', async ({
    page,
    mailhog,
  }) => {
    const ctx = await setupTenantContext(page, mailhog);
    await loginAsTenant(page, ctx.tenantEmail, ctx.tenantPassword);

    const landlordRoutes = [
      '/dashboard',
      '/expenses',
      '/income',
      '/reports',
      '/vendors',
      '/work-orders',
      '/maintenance-requests',
      '/settings',
    ];

    for (const route of landlordRoutes) {
      await page.goto(route);
      await page.waitForURL('/tenant', { timeout: 5000 });
      expect(page.url(), `tenant should be redirected from ${route} to /tenant`).toMatch(
        /\/tenant$/,
      );
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 2 — Direct API call returns 403 (AC #2, #3, #5, #6)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant token receives 403 from landlord API endpoints', async ({ page, mailhog }) => {
    const ctx = await setupTenantContext(page, mailhog);
    const tenantToken = await getAccessToken(ctx.tenantEmail, ctx.tenantPassword);

    const landlordEndpoints = [
      { method: 'GET', url: '/api/v1/expenses' },
      { method: 'GET', url: '/api/v1/income' },
      { method: 'GET', url: '/api/v1/vendors' },
      { method: 'GET', url: '/api/v1/work-orders' },
    ];

    for (const endpoint of landlordEndpoints) {
      const response = await page.request.fetch(`http://localhost:5292${endpoint.url}`, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${tenantToken}` },
      });
      expect(
        response.status(),
        `${endpoint.method} ${endpoint.url} should return 403 for Tenant token`,
      ).toBe(403);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 3 — Cross-property isolation (AC #10)
  // ─────────────────────────────────────────────────────────────────────────
  // Tenant-A on Property A does NOT see Tenant-B's request on Property B
  // (same throwaway landlord account). Verifies the handler-level property
  // scope filter in GetMaintenanceRequests.
  test('tenant sees only their own property requests, not cross-property', async ({
    page,
    mailhog,
    tenantDashboardPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const propertyAId = await createPropertyViaApi(landlord.token, {
      name: `Lockdown PropA ${suffix}`,
    });
    const propertyBId = await createPropertyViaApi(landlord.token, {
      name: `Lockdown PropB ${suffix}`,
    });

    const tenantPassword = 'Throwaway@123456';
    const tenantAEmail = `lockdown-tA-${suffix}@example.com`;
    const tenantBEmail = `lockdown-tB-${suffix}@example.com`;

    await inviteTenantViaApi(landlord.token, propertyAId, tenantAEmail);
    await inviteTenantViaApi(landlord.token, propertyBId, tenantBEmail);

    await acceptTenantInvitation(page, mailhog, tenantAEmail, tenantPassword);
    await acceptTenantInvitation(page, mailhog, tenantBEmail, tenantPassword);

    const tenantBToken = await getAccessToken(tenantBEmail, tenantPassword);
    const propertyBRequestDescription = `Property-B-only request ${suffix}`;
    await submitMaintenanceRequestViaApi(tenantBToken, propertyBRequestDescription);

    // Log in as tenant-A and verify the dashboard does not surface tenant-B's request.
    await loginAsTenant(page, tenantAEmail, tenantPassword);
    await tenantDashboardPage.goto();

    await tenantDashboardPage.expectRequestNotInList(propertyBRequestDescription);
  });
});
