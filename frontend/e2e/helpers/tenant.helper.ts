/**
 * Tenant E2E Helpers (Story 21.4)
 *
 * Helpers for setting up tenant contexts in E2E tests.
 *
 * Strategy: each test creates a "throwaway landlord" via Owner-role invitation
 * from the seeded `claude@claude.com` account, then provisions a property and
 * invites a tenant. **Caveat (verified during evaluation):** Owner-role
 * invitations attach the invitee to the *inviter's* existing account
 * (`CreateInvitation.cs:109` + `AcceptInvitation.cs:97-102`), so the throwaway
 * landlord is actually a co-Owner of the seeded account. All properties,
 * tenants, and maintenance requests created here DO live on the seeded account.
 *
 * Test isolation is therefore NOT account-level — it relies on per-test unique
 * data (Date.now() + random suffix on every email, property name, and request
 * description) plus property-scoped visibility. Prior runs' rows never satisfy
 * a current run's assertions because the lookup keys are unique per run.
 *
 * If the seeded account's row counts eventually slow the suite, file a separate
 * cleanup story (extend TestController.reset, or add real account isolation).
 *
 * @see docs/project/stories/epic-21/21-4-tenant-dashboard-e2e.md
 * @see frontend/e2e/tests/invitations/invitation-flow.spec.ts (pattern source)
 */
import { type Page } from '@playwright/test';
import { MailHogHelper } from './mailhog.helper';
import { DEFAULT_TEST_USER } from './auth.helper';

const API_BASE = 'http://localhost:5292';

/**
 * Full context returned by `setupTenantContext`. All accounts/properties live
 * on a throwaway landlord, isolated from the seeded `claude@claude.com` account.
 */
export interface SeededTenantContext {
  landlordEmail: string;
  landlordPassword: string;
  landlordToken: string;
  propertyId: string;
  tenantEmail: string;
  tenantPassword: string;
}

/**
 * Get an access token for the given credentials by calling the auth API directly.
 */
export async function getAccessToken(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to log in as ${email}: ${response.status} - ${body}`);
  }
  const data = await response.json();
  return data.accessToken;
}

/**
 * Create an invitation via API. Mirrors the helper from invitation-flow.spec.ts
 * but supports an optional propertyId for Tenant-role invitations.
 */
async function createInvitationViaApi(
  token: string,
  inviteeEmail: string,
  role: string,
  propertyId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { email: inviteeEmail, role };
  if (propertyId) {
    body.propertyId = propertyId;
  }
  const response = await fetch(`${API_BASE}/api/v1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create invitation: ${response.status} - ${text}`);
  }
}

/**
 * Accept an invitation via API directly (no UI needed). Sets the new user's
 * password from the supplied invitation code.
 */
async function acceptInvitationViaApi(code: string, password: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/invitations/${encodeURIComponent(code)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to accept invitation: ${response.status} - ${text}`);
  }
}

/**
 * Create a fresh landlord (Owner) account via the invitation flow from the
 * seeded `claude@claude.com` account. Returns the credentials and access token.
 *
 * This isolates the test's data from the seeded account.
 */
export async function createLandlordViaInvitation(
  mailhog: MailHogHelper,
): Promise<{ email: string; password: string; token: string }> {
  // Step 1: Get token for the seeded owner so we can invite a fresh landlord.
  const seededToken = await getAccessToken(DEFAULT_TEST_USER.email, DEFAULT_TEST_USER.password);

  // Step 2: Generate unique credentials for the throwaway landlord.
  const email = `e2e-landlord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'Throwaway@123456';

  // Step 3: Create the invitation.
  await createInvitationViaApi(seededToken, email, 'Owner');

  // Step 4: Pull the invitation code from MailHog.
  const code = await mailhog.getInvitationCode(email);

  // Step 5: Accept the invitation via API (no UI roundtrip needed).
  await acceptInvitationViaApi(code, password);

  // Step 6: Get the new landlord's access token for subsequent API calls.
  const token = await getAccessToken(email, password);

  return { email, password, token };
}

/**
 * Create a property via API using the supplied landlord token. Returns the
 * new property's ID.
 */
export async function createPropertyViaApi(
  landlordToken: string,
  overrides?: Partial<{ name: string; street: string; city: string; state: string; zipCode: string }>,
): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name: overrides?.name ?? `Tenant E2E Property ${suffix}`,
    street: overrides?.street ?? '123 Test Lane',
    city: overrides?.city ?? 'Austin',
    state: overrides?.state ?? 'TX',
    zipCode: overrides?.zipCode ?? '78701',
  };
  const response = await fetch(`${API_BASE}/api/v1/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${landlordToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create property: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return data.id as string;
}

/**
 * Invite a tenant onto the supplied property via API.
 */
export async function inviteTenantViaApi(
  landlordToken: string,
  propertyId: string,
  tenantEmail: string,
): Promise<void> {
  await createInvitationViaApi(landlordToken, tenantEmail, 'Tenant', propertyId);
}

/**
 * Accept a tenant invitation via the UI (acceptance page). The tenant is NOT
 * logged in afterwards — the caller is free to log in via `loginAsTenant`.
 */
export async function acceptTenantInvitation(
  page: Page,
  mailhog: MailHogHelper,
  tenantEmail: string,
  tenantPassword: string,
): Promise<void> {
  const code = await mailhog.getInvitationCode(tenantEmail);
  await page.goto(`/accept-invitation?code=${encodeURIComponent(code)}`);
  await page.locator('input[formControlName="password"]').fill(tenantPassword);
  await page.locator('input[formControlName="confirmPassword"]').fill(tenantPassword);
  await page.locator('button[type="submit"]').click();
  await page.locator('.success-message').waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Log in as a tenant. Mirrors `AuthHelper.login` but waits for `/tenant`
 * (the role-based redirect target for Tenant accounts) instead of `/dashboard`.
 *
 * Do NOT modify `AuthHelper.login` — every other E2E spec depends on its
 * `/dashboard` wait, and tenant accounts are routed elsewhere by
 * `LoginComponent.getSafeReturnUrl()`.
 */
export async function loginAsTenant(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('input[formControlName="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('/tenant', { timeout: 10000 });
}

/**
 * Submit a maintenance request via API as the supplied tenant. Used to seed
 * requests for AC-2 (cross-property isolation) without exercising the UI.
 *
 * The PropertyId comes from the tenant's JWT claim on the backend, so we only
 * need to send the description.
 */
export async function submitMaintenanceRequestViaApi(
  tenantToken: string,
  description: string,
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/maintenance-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tenantToken}`,
    },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to submit maintenance request: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return data.id as string;
}

/**
 * Compose the full per-test setup: throwaway landlord, throwaway property,
 * tenant invitation, tenant account creation. Returns the full context with
 * credentials and IDs.
 *
 * The tenant is NOT logged in at return — the caller controls login (typically
 * via `loginAsTenant` for the dashboard happy path, or `submitRequestPage.goto()`
 * after `loginAsTenant` for direct nav).
 */
export async function setupTenantContext(
  page: Page,
  mailhog: MailHogHelper,
): Promise<SeededTenantContext> {
  const landlord = await createLandlordViaInvitation(mailhog);
  const propertyId = await createPropertyViaApi(landlord.token);
  const tenantEmail = `e2e-tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const tenantPassword = 'Throwaway@123456';
  await inviteTenantViaApi(landlord.token, propertyId, tenantEmail);
  await acceptTenantInvitation(page, mailhog, tenantEmail, tenantPassword);
  return {
    landlordEmail: landlord.email,
    landlordPassword: landlord.password,
    landlordToken: landlord.token,
    propertyId,
    tenantEmail,
    tenantPassword,
  };
}
