import { test, expect } from '../../fixtures/test-fixtures';

/**
 * User Management E2E Tests (Story 19.6 AC #1, #2, #3)
 *
 * Tests the User Management page in Settings:
 * - Owner can navigate to Settings and see User Management page (AC #1)
 * - Owner can open Invite User dialog and send an invitation (AC #2)
 * - Invitations appear in the pending invitations list (AC #3)
 *
 * Uses page.route() to intercept API responses for test isolation.
 */
test.describe('User Management Page', () => {
  test('Owner navigates to Settings and sees User Management page', async ({
    authenticatedUser,
    page,
  }) => {
    // Intercept API calls to provide predictable data
    await page.route('*/**/api/v1/invitations', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                email: 'pending@example.com',
                role: 'Owner',
                createdAt: '2026-04-01T00:00:00Z',
                expiresAt: '2026-04-02T00:00:00Z',
                usedAt: null,
                status: 'Pending',
              },
              {
                id: '22222222-2222-2222-2222-222222222222',
                email: 'expired@example.com',
                role: 'Contributor',
                createdAt: '2026-03-01T00:00:00Z',
                expiresAt: '2026-03-02T00:00:00Z',
                usedAt: null,
                status: 'Expired',
              },
            ],
            totalCount: 2,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              userId: '33333333-3333-3333-3333-333333333333',
              email: 'claude@claude.com',
              displayName: 'Claude Owner',
              role: 'Owner',
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
          totalCount: 1,
        }),
      });
    });

    // Navigate to Settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // AC #1: See User Management page with title and Invite User button
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Invite User/i })).toBeVisible();

    // AC #3: See invitations list with email, role, status
    await expect(page.getByRole('cell', { name: 'pending@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'expired@example.com' })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText('Expired', { exact: true })).toBeVisible();

    // AC #4: Expired invitation has Resend button
    await expect(page.getByRole('button', { name: /Resend/i })).toBeVisible();

    // Account Users section visible
    await expect(page.getByText('Account Users')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'claude@claude.com' })).toBeVisible();
  });

  test('Owner clicks Invite User, fills form, submits, sees success snackbar', async ({
    authenticatedUser,
    page,
  }) => {
    // Intercept GET invitations - track if invitation was created
    let invitationCreated = false;
    await page.route('*/**/api/v1/invitations', async (route) => {
      if (route.request().method() === 'GET') {
        const items = invitationCreated
          ? [
              {
                id: '44444444-4444-4444-4444-444444444444',
                email: 'newinvite@example.com',
                role: 'Contributor',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                usedAt: null,
                status: 'Pending',
              },
            ]
          : [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items, totalCount: items.length }),
        });
      } else if (route.request().method() === 'POST') {
        invitationCreated = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            invitationId: '44444444-4444-4444-4444-444444444444',
            message: 'Invitation sent successfully',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0 }),
      });
    });

    // Navigate to Settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // AC #2: Click Invite User button
    await page.getByRole('button', { name: /Invite User/i }).click();

    // Fill the dialog form
    await page.getByLabel('Email').fill('newinvite@example.com');

    // Select Contributor role
    await page.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Contributor' }).click();

    // Submit
    await page.getByRole('button', { name: /Send Invitation/i }).click();

    // AC #2: See success snackbar
    await expect(
      page.getByText(/Invitation sent to newinvite@example.com/i),
    ).toBeVisible({ timeout: 5000 });

    // AC #3: Invitation appears in the list after reload
    await expect(page.getByRole('cell', { name: 'newinvite@example.com' })).toBeVisible({
      timeout: 5000,
    });
  });
});
