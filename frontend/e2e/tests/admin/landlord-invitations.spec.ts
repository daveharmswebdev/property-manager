/**
 * E2E Tests: Admin Console — Landlord Invitations (Story 22.4)
 *
 * The seeded `claude@claude.com` account is a PlatformAdmin (Story 22.1), so the
 * `authenticatedUser` fixture lands us with the Admin nav entry + /admin route reachable.
 *
 * Covers AC #1 (Admin nav visible), #2 (admin landing), #3 (list), #4 (create dialog),
 * #5 (create → snackbar + new Pending row + MailHog email), #6 (resend via page.route stub).
 *
 * Shared-DB note (per CLAUDE.md E2E rules): the resend path uses `page.route()` to stub
 * `GET /api/v1/admin/landlord-invitations` with a single Expired row — time-warping a real
 * invitation to expired is not possible, and "NEVER assume seed-data counts".
 */
import { test, expect } from '../../fixtures/test-fixtures';
import { AdminLandlordInvitationsPage } from '../../pages/admin-landlord-invitations.page';

test.describe('Admin Console — Landlord Invitations', () => {
  test('admin sees nav, opens /admin, creates a landlord invitation (MailHog confirms)', async ({
    page,
    authenticatedUser,
    mailhog,
  }) => {
    void authenticatedUser; // ensures login ran
    const adminPage = new AdminLandlordInvitationsPage(page);

    // AC #1 — Admin nav entry visible to PlatformAdmin
    await expect(adminPage.navLink).toBeVisible({ timeout: 10000 });

    // AC #2 — navigate to /admin via nav; the Landlord Invitations section renders
    await adminPage.gotoViaNav();
    await adminPage.expectVisible();

    // AC #4 / #5 — create a landlord invitation
    const inviteeEmail = `landlord-${Date.now()}@example.com`;
    await adminPage.createInvitation(inviteeEmail);

    // AC #5 — success snackbar confirms the invitation was sent
    await adminPage.expectSnackBar(`Landlord invitation sent to ${inviteeEmail}`);

    // AC #3 / #5 — the new row appears with status "Pending"
    const newRow = adminPage.rowForEmail(inviteeEmail);
    await expect(newRow).toBeVisible({ timeout: 10000 });
    await expect(newRow).toContainText('Pending');

    // AC #5 — MailHog received the landlord-flavored email
    const message = await mailhog.waitForEmail(
      inviteeEmail,
      "You're invited to create your Upkeep account",
    );
    expect(message).toBeTruthy();
  });

  test('admin resends an expired landlord invitation (stubbed list)', async ({
    page,
    authenticatedUser,
  }) => {
    void authenticatedUser;
    const adminPage = new AdminLandlordInvitationsPage(page);
    const expiredEmail = 'expired-landlord@example.com';

    // Stub the GET list to return a single Expired row (page.route per CLAUDE.md E2E rules —
    // real time-warping to expired is impossible, so we control the data shape).
    await page.route('**/api/v1/admin/landlord-invitations', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              email: expiredEmail,
              createdAt: '2026-01-01T00:00:00Z',
              expiresAt: '2026-01-02T00:00:00Z',
              usedAt: null,
              status: 'Expired',
              invitedBy: 'Admin',
            },
          ],
          totalCount: 1,
        }),
      });
    });

    // Capture the resend POST to assert it fires; respond with a 201 so the store reloads.
    let resendFired = false;
    await page.route('**/api/v1/admin/landlord-invitations/*/resend', async (route) => {
      resendFired = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          invitationId: '22222222-2222-2222-2222-222222222222',
          message: 'Landlord invitation resent successfully',
        }),
      });
    });

    await adminPage.goto();
    await adminPage.expectVisible();

    const row = adminPage.rowForEmail(expiredEmail);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('Expired');

    // AC #6 — Resend fires and a success snackbar confirms
    await adminPage.resendForEmail(expiredEmail);
    await adminPage.expectSnackBar('Landlord invitation resent successfully');
    expect(resendFired).toBe(true);
  });
});
