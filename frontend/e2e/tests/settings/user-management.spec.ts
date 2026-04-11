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

  test('Owner sees user list with role dropdown and remove button', async ({
    authenticatedUser,
    page,
  }) => {
    // AC #1: User list with Name/Email, Role, Joined Date
    // Story 19.7 AC #2, #4: role dropdown and remove button visible
    const currentUserId = '33333333-3333-3333-3333-333333333333';

    await page.route('*/**/api/v1/invitations', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                userId: currentUserId,
                email: 'claude@claude.com',
                displayName: 'Claude Owner',
                role: 'Owner',
                createdAt: '2026-01-01T00:00:00Z',
              },
              {
                userId: '44444444-4444-4444-4444-444444444444',
                email: 'contrib@example.com',
                displayName: 'Contrib User',
                role: 'Contributor',
                createdAt: '2026-02-01T00:00:00Z',
              },
            ],
            totalCount: 2,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify Account Users section
    await expect(page.getByText('Account Users')).toBeVisible();

    // Verify users are listed
    await expect(page.getByRole('cell', { name: 'claude@claude.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'contrib@example.com' })).toBeVisible();

    // Verify role dropdowns exist (mat-select elements)
    const roleSelects = page.locator('mat-select');
    await expect(roleSelects).toHaveCount(2);

    // Verify remove button exists for non-current user but not for current user
    const removeButtons = page.getByRole('button', { name: /Remove user/i });
    await expect(removeButtons).toHaveCount(1);
  });

  test('Owner changes a user role via dropdown, sees success snackbar', async ({
    authenticatedUser,
    page,
  }) => {
    // AC #2: Role change via dropdown
    let roleUpdateCalled = false;

    await page.route('*/**/api/v1/invitations', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users', async (route) => {
      if (route.request().method() === 'GET') {
        const items = roleUpdateCalled
          ? [
              {
                userId: '33333333-3333-3333-3333-333333333333',
                email: 'claude@claude.com',
                displayName: 'Claude Owner',
                role: 'Owner',
                createdAt: '2026-01-01T00:00:00Z',
              },
              {
                userId: '44444444-4444-4444-4444-444444444444',
                email: 'contrib@example.com',
                displayName: 'Contrib User',
                role: 'Owner',
                createdAt: '2026-02-01T00:00:00Z',
              },
            ]
          : [
              {
                userId: '33333333-3333-3333-3333-333333333333',
                email: 'claude@claude.com',
                displayName: 'Claude Owner',
                role: 'Owner',
                createdAt: '2026-01-01T00:00:00Z',
              },
              {
                userId: '44444444-4444-4444-4444-444444444444',
                email: 'contrib@example.com',
                displayName: 'Contrib User',
                role: 'Contributor',
                createdAt: '2026-02-01T00:00:00Z',
              },
            ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items, totalCount: 2 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users/*/role', async (route) => {
      if (route.request().method() === 'PUT') {
        roleUpdateCalled = true;
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click the second user's role dropdown (the non-current user)
    const roleSelects = page.locator('mat-select');
    await roleSelects.nth(1).click();

    // Select "Owner" option
    await page.getByRole('option', { name: 'Owner' }).click();

    // See success snackbar
    await expect(page.getByText('Role updated successfully')).toBeVisible({ timeout: 5000 });
  });

  test('Owner clicks Remove on a user, confirms dialog, user disappears from list', async ({
    authenticatedUser,
    page,
  }) => {
    // AC #4: Remove user flow
    let userRemoved = false;

    await page.route('*/**/api/v1/invitations', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('*/**/api/v1/account/users', async (route) => {
      if (route.request().method() === 'GET') {
        const items = userRemoved
          ? [
              {
                userId: '33333333-3333-3333-3333-333333333333',
                email: 'claude@claude.com',
                displayName: 'Claude Owner',
                role: 'Owner',
                createdAt: '2026-01-01T00:00:00Z',
              },
            ]
          : [
              {
                userId: '33333333-3333-3333-3333-333333333333',
                email: 'claude@claude.com',
                displayName: 'Claude Owner',
                role: 'Owner',
                createdAt: '2026-01-01T00:00:00Z',
              },
              {
                userId: '44444444-4444-4444-4444-444444444444',
                email: 'contrib@example.com',
                displayName: 'Contrib User',
                role: 'Contributor',
                createdAt: '2026-02-01T00:00:00Z',
              },
            ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items, totalCount: items.length }),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept DELETE on the specific user endpoint
    await page.route('*/**/api/v1/account/users/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        userRemoved = true;
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify user is present
    await expect(page.getByRole('cell', { name: 'contrib@example.com' })).toBeVisible();

    // Click the Remove button
    await page.getByRole('button', { name: /Remove user/i }).click();

    // Confirm dialog should appear
    await expect(page.getByText('Remove User?')).toBeVisible();
    await expect(
      page.getByText('This user will lose access to the account'),
    ).toBeVisible();

    // Click Remove in the confirm dialog
    await page.getByRole('button', { name: 'Remove' }).click();

    // See success snackbar
    await expect(page.getByText('User removed')).toBeVisible({ timeout: 5000 });

    // User should disappear from the list
    await expect(page.getByRole('cell', { name: 'contrib@example.com' })).not.toBeVisible({
      timeout: 5000,
    });
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
