/**
 * E2E Tests: Landlord Maintenance Request Inbox (Story 20.7)
 *
 * Verifies the landlord inbox flow end-to-end: aggregated request list,
 * row → detail navigation, status/property filters, empty states, and
 * the role-guard tenant redirect.
 *
 * Test isolation strategy: every spec that needs landlord login creates a
 * throwaway landlord via `createLandlordViaInvitation` so the seeded
 * `claude@claude.com` account is not polluted (matches the Tenant Dashboard
 * E2E precedent in `tenant-dashboard.spec.ts`). The throwaway landlord is
 * actually a co-Owner of the seeded account (see `tenant.helper.ts`), but
 * data is uniquely-named per run so prior rows never satisfy current
 * assertions.
 *
 * Status filter limitation: backend currently parses one status only. When
 * fewer than all 4 statuses are selected, only `n === 1` results in a
 * `status=` query param. Spec 3 verifies the API call carries the param.
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

test.describe('Landlord Maintenance Request Inbox E2E (Story 20.7)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Spec 1 — Inbox shows aggregated requests across properties (AC #1, #2)
  // ─────────────────────────────────────────────────────────────────────────
  test('inbox shows aggregated requests across all properties', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyA = await createPropertyViaApi(landlord.token, {
      name: `Inbox-PropA ${Date.now()}`,
    });
    const propertyB = await createPropertyViaApi(landlord.token, {
      name: `Inbox-PropB ${Date.now()}`,
    });

    const tenantPassword = 'Throwaway@123456';
    const tenantA = `e2e-mr-tenant-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const tenantB = `e2e-mr-tenant-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyA, tenantA);
    await inviteTenantViaApi(landlord.token, propertyB, tenantB);
    await acceptTenantInvitation(page, mailhog, tenantA, tenantPassword);
    await acceptTenantInvitation(page, mailhog, tenantB, tenantPassword);

    const tokenA = await getAccessToken(tenantA, tenantPassword);
    const tokenB = await getAccessToken(tenantB, tenantPassword);
    const suffix = Date.now();
    const descA = `Inbox-A request ${suffix}`;
    const descB = `Inbox-B request ${suffix}`;
    await submitMaintenanceRequestViaApi(tokenA, descA);
    await submitMaintenanceRequestViaApi(tokenB, descB);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();

    // Both rows are visible — the inbox is account-aggregated, not per-property.
    await maintenanceRequestsListPage.expectRowVisible(descA);
    await maintenanceRequestsListPage.expectRowVisible(descB);

    // Row meta: status chip + property + submitter (AC #2)
    const rowA = maintenanceRequestsListPage.getRowByDescription(descA);
    // Chip uses CSS `text-transform: uppercase`, so the rendered DOM text
    // is mixed-case; assert via class + trimmed text.
    const chip = rowA.locator('.status-chip');
    await expect(chip).toHaveClass(/status-submitted/);
    await expect(chip).toContainText('Submitted');
    await expect(rowA.locator('.request-property')).toContainText(`Inbox-PropA`);
    await expect(rowA.locator('.request-submitter')).toContainText(tenantA);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 2 — Row click opens detail (AC #3)
  // ─────────────────────────────────────────────────────────────────────────
  test('clicking a row navigates to detail view with full description', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
    maintenanceRequestDetailPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Inbox-Detail-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-detail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);
    const description = `Inbox detail request ${Date.now()} — full text including punctuation, etc.`;
    await submitMaintenanceRequestViaApi(tenantToken, description);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();

    await maintenanceRequestsListPage.clickRow(description);
    await page.waitForURL(/\/maintenance-requests\/[a-f0-9-]+$/);

    // Full detail rendered (AC #3): description + status chip + property + submitter.
    await expect(maintenanceRequestDetailPage.root).toBeVisible();
    await expect(maintenanceRequestDetailPage.statusChip).toHaveText('Submitted');
    await maintenanceRequestDetailPage.expectDescription(description);
    // No photos => grid hidden (AC #3 photos block — empty state means no grid)
    await expect(maintenanceRequestDetailPage.photoGrid).toHaveCount(0);
    // No work order linked => badge hidden (AC #3)
    await expect(maintenanceRequestDetailPage.linkedWorkOrder).toHaveCount(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 3 — Status filter calls the API with the right param (AC #6)
  //
  // Since 20.8/20.9 don't yet exist, we can't seed a request in the
  // `InProgress` state via API. Per Task 9.3 fallback, intercept the GET
  // and assert the query string contains `status=InProgress`.
  // ─────────────────────────────────────────────────────────────────────────
  test('selecting "In Progress" sends status=InProgress on the next API call', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Inbox-Filter-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
    const tenantToken = await getAccessToken(tenantEmail, tenantPassword);
    await submitMaintenanceRequestViaApi(tenantToken, `Filter test ${Date.now()}`);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();

    // Wait for the next inbox GET that carries `status=InProgress` after the
    // chip click. The current chip-listbox starts with all four selected, so
    // clicking In Progress will deselect it (n=3 → no status param). To get
    // `n=1`, click each of the other three to deselect them, leaving only
    // InProgress selected. We assert on the LAST request that has the
    // status=InProgress param.
    const statusInProgressRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/maintenance-requests') &&
        req.method() === 'GET' &&
        req.url().includes('status=InProgress'),
      { timeout: 10000 },
    );

    // Deselect Submitted, Resolved, Dismissed (leaves InProgress selected).
    await maintenanceRequestsListPage.clickStatusChip('Submitted');
    await maintenanceRequestsListPage.clickStatusChip('Resolved');
    await maintenanceRequestsListPage.clickStatusChip('Dismissed');

    const req = await statusInProgressRequest;
    expect(req.url()).toContain('status=InProgress');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 4 — Property filter narrows results (AC #7)
  // ─────────────────────────────────────────────────────────────────────────
  test('property filter narrows results to the selected property', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const suffix = Date.now();
    const propAName = `Inbox-PropA-${suffix}`;
    const propBName = `Inbox-PropB-${suffix}`;
    const propA = await createPropertyViaApi(landlord.token, { name: propAName });
    const propB = await createPropertyViaApi(landlord.token, { name: propBName });

    const tenantPassword = 'Throwaway@123456';
    const tenantA = `e2e-mr-pf-a-${suffix}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const tenantB = `e2e-mr-pf-b-${suffix}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    await inviteTenantViaApi(landlord.token, propA, tenantA);
    await inviteTenantViaApi(landlord.token, propB, tenantB);
    await acceptTenantInvitation(page, mailhog, tenantA, tenantPassword);
    await acceptTenantInvitation(page, mailhog, tenantB, tenantPassword);
    const tokenA = await getAccessToken(tenantA, tenantPassword);
    const tokenB = await getAccessToken(tenantB, tenantPassword);
    const descA = `PF-A request ${suffix}`;
    const descB = `PF-B request ${suffix}`;
    await submitMaintenanceRequestViaApi(tokenA, descA);
    await submitMaintenanceRequestViaApi(tokenB, descB);

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();
    await maintenanceRequestsListPage.expectRowVisible(descA);
    await maintenanceRequestsListPage.expectRowVisible(descB);

    await maintenanceRequestsListPage.selectProperty(propAName);
    await maintenanceRequestsListPage.expectRowVisible(descA);
    await maintenanceRequestsListPage.expectRowHidden(descB);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 5 — Empty state when no requests exist (AC #9)
  // ─────────────────────────────────────────────────────────────────────────
  test('shows empty state when no requests exist on the account', async ({
    page,
    mailhog,
    maintenanceRequestsListPage,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    // The seeded account already has data on it (since the throwaway landlord
    // is a co-Owner — see `tenant.helper.ts`). To prove the empty-state
    // renders end-to-end, intercept the inbox GET with an empty payload.
    await page.route('**/api/v1/maintenance-requests*', async (route) => {
      const req = route.request();
      // Only stub the list endpoint, NOT detail (which has /:id suffix).
      const url = req.url();
      const path = new URL(url).pathname;
      if (path === '/api/v1/maintenance-requests' && req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0,
          }),
        });
        return;
      }
      await route.continue();
    });

    await loginAsLandlord(page, landlord.email, landlord.password);
    await maintenanceRequestsListPage.goto();

    await maintenanceRequestsListPage.expectEmptyState();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spec 6 — Tenant cannot access the landlord inbox (AC #11)
  // ─────────────────────────────────────────────────────────────────────────
  test('tenant navigating to /maintenance-requests is redirected to /tenant', async ({
    page,
    mailhog,
  }) => {
    const landlord = await createLandlordViaInvitation(mailhog);
    const propertyId = await createPropertyViaApi(landlord.token, {
      name: `Inbox-Guard-Prop ${Date.now()}`,
    });
    const tenantPassword = 'Throwaway@123456';
    const tenantEmail = `e2e-mr-guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
    await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);

    await loginAsTenant(page, tenantEmail, tenantPassword);

    // Direct navigation — `ownerGuard` should redirect back to /tenant.
    await page.goto('/maintenance-requests');
    await page.waitForURL('/tenant', { timeout: 10000 });
    expect(page.url()).toContain('/tenant');
  });
});
