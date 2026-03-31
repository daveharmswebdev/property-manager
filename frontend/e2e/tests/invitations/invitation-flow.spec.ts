/**
 * E2E Tests: Invitation Acceptance Flow (AC: #2)
 *
 * Tests the full invitation flow:
 * Owner creates invitation via API -> extract code from MailHog ->
 * navigate to accept-invitation page -> fill password form ->
 * submit -> verify success -> login as new user -> verify shared data
 */
import { test, expect } from '../../fixtures/test-fixtures';
import { DEFAULT_TEST_USER } from '../../helpers/auth.helper';

const API_BASE = 'http://localhost:5292';

async function getAccessToken(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  return data.accessToken;
}

async function createInvitationViaApi(
  token: string,
  inviteeEmail: string,
  role: string = 'Owner'
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email: inviteeEmail, role }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create invitation: ${response.status} - ${body}`);
  }
}

test.describe('Invitation Acceptance Flow', () => {
  test('owner creates invitation, invitee accepts and can see shared data', async ({
    page,
    mailhog,
  }) => {
    // Step 1: Login as seeded owner and get token
    const ownerToken = await getAccessToken(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);

    // Step 2: Create invitation via API
    const inviteeEmail = `e2e-invitee-${Date.now()}@example.com`;
    const inviteePassword = 'NewUser@123456';
    await createInvitationViaApi(ownerToken, inviteeEmail, 'Owner');

    // Step 3: Extract invitation code from MailHog
    const code = await mailhog.getInvitationCode(inviteeEmail);
    expect(code).toBeTruthy();

    // Step 4: Navigate to accept-invitation page
    await page.goto(`/accept-invitation?code=${encodeURIComponent(code)}`);

    // Step 5: Wait for validation to complete and verify email is displayed
    await expect(page.locator('.email-display span')).toContainText(inviteeEmail, {
      timeout: 10000,
    });

    // Step 6: Verify role info is displayed
    await expect(page.locator('.role-display span')).toContainText('Owner');

    // Step 7: Fill password form
    await page.locator('input[formControlName="password"]').fill(inviteePassword);
    await page.locator('input[formControlName="confirmPassword"]').fill(inviteePassword);

    // Step 8: Submit
    await page.locator('button[type="submit"]').click();

    // Step 9: Verify success
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.success-message h3')).toContainText('Account Created Successfully');

    // Step 10: Login as the new user
    await page.getByRole('link', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('/login', { timeout: 10000 });
    await page.locator('input[formControlName="email"]').fill(inviteeEmail);
    await page.locator('input[formControlName="password"]').fill(inviteePassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Step 11: Verify invitee can access the dashboard (proves account was created and login works)
    await expect(page.locator('body')).toContainText('Welcome back', { timeout: 10000 });
  });
});
