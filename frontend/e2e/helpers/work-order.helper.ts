/**
 * Work Order E2E Helpers (Story 21.8)
 *
 * API-driven seeding helpers for the work-order create / edit / delete /
 * photos / pdf E2E specs. Each helper uses native `fetch` so it can be called
 * from `beforeAll`/`afterAll` without a Playwright `page` instance.
 *
 * @see docs/project/stories/epic-21/21-8-work-orders-e2e.md
 * @see frontend/e2e/helpers/tenant.helper.ts (Story 21.4 pattern reference)
 */
import { DEFAULT_TEST_USER } from './auth.helper';

const WO_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5292';

/**
 * Get an access token for the seeded `claude@claude.com` test account.
 * Mirrors `frontend/e2e/global-teardown.ts` lines 13-21.
 */
export async function getAccessTokenForSeededUser(): Promise<string> {
  const response = await fetch(`${WO_API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: DEFAULT_TEST_USER.email,
      password: DEFAULT_TEST_USER.password,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Seeded user login failed: ${response.status} - ${body}`);
  }
  const data = await response.json();
  return data.accessToken as string;
}

/**
 * Create a property via API for the supplied account token.
 * Returns the persisted property's id and the deterministic name we used.
 */
export async function createPropertyViaApi(
  token: string,
  overrides?: Partial<{
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
  }>,
): Promise<{ id: string; name: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name: overrides?.name ?? `WO E2E Property ${suffix}`,
    street: overrides?.street ?? '123 Test Lane',
    city: overrides?.city ?? 'Austin',
    state: overrides?.state ?? 'TX',
    zipCode: overrides?.zipCode ?? '78701',
  };
  const response = await fetch(`${WO_API_BASE}/api/v1/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create property: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return { id: data.id as string, name: body.name };
}

/**
 * Create a vendor via API. The `CreateVendorRequest` shape (verified in
 * `VendorsController.cs`) accepts firstName + lastName plus optional
 * phones/emails/tradeTagIds arrays. Empty arrays are valid.
 */
export async function createVendorViaApi(
  token: string,
  overrides?: Partial<{
    firstName: string;
    middleName: string | null;
    lastName: string;
  }>,
): Promise<{ id: string; fullName: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const firstName = overrides?.firstName ?? `WO`;
  const lastName = overrides?.lastName ?? `Vendor-${suffix}`;
  const body = {
    firstName,
    middleName: overrides?.middleName ?? null,
    lastName,
    phones: [] as Array<{ number: string; label?: string | null }>,
    emails: [] as string[],
    tradeTagIds: [] as string[],
  };
  const response = await fetch(`${WO_API_BASE}/api/v1/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create vendor: ${response.status} - ${text}`);
  }
  const data = await response.json();
  const fullName = `${firstName} ${lastName}`;
  return { id: data.id as string, fullName };
}

/**
 * Create a work order via API for the supplied property.
 * Optionally accepts a vendorId for assigned-state seeds.
 */
export async function createWorkOrderViaApi(
  token: string,
  propertyId: string,
  overrides?: Partial<{
    description: string;
    status: 'Reported' | 'Assigned' | 'Completed';
    vendorId: string | null;
  }>,
): Promise<{ id: string; description: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const description = overrides?.description ?? `WO E2E ${suffix}`;
  const body: Record<string, unknown> = {
    propertyId,
    description,
    status: overrides?.status ?? 'Reported',
  };
  if (overrides?.vendorId !== undefined && overrides.vendorId !== null) {
    body.vendorId = overrides.vendorId;
  }
  const response = await fetch(`${WO_API_BASE}/api/v1/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create work order: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return { id: data.id as string, description };
}

/**
 * Reset all per-test rows for the seeded user via the dev-only TestController.
 * Resilient: a 5xx is logged but does not throw, matching `global-teardown.ts`.
 */
export async function resetTestDataViaApi(token: string): Promise<void> {
  try {
    const response = await fetch(`${WO_API_BASE}/api/v1/test/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.warn(
        `[work-order.helper] Reset failed: ${response.status} - ${await response.text()}`,
      );
    }
  } catch (error) {
    console.warn(`[work-order.helper] Reset error:`, error);
  }
}
