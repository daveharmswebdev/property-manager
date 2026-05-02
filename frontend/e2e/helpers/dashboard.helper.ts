/**
 * Dashboard E2E Helpers (Story 21.10)
 *
 * API-driven seeding helpers for the dashboard E2E spec. Each helper uses
 * native `fetch` so it can be called from `beforeAll` / `afterAll` without
 * a Playwright `page` instance.
 *
 * The helpers re-export `getAccessTokenForSeededUser` and
 * `resetTestDataViaApi` from `work-order.helper.ts` (Story 21.8) so the
 * dashboard spec only imports from one place; `createPropertyViaApi` is
 * also re-exported because we use it as-is.
 *
 * Adds two helpers specific to dashboard testing:
 *   - createExpenseViaApi(token, propertyId, amount, dateString) — POSTs
 *     /api/v1/expenses with a category looked up from /api/v1/expense-categories.
 *   - createIncomeViaApi(token, propertyId, amount, dateString) — POSTs
 *     /api/v1/income (no category required).
 *
 * @see docs/project/stories/epic-21/21-10-dashboard-unit-and-e2e-tests.md
 * @see frontend/e2e/helpers/work-order.helper.ts (template)
 */
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  resetTestDataViaApi,
} from './work-order.helper';

const D_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5292';

/**
 * Look up the first available expense category id. Mirrors the integration
 * test helper at `DashboardControllerTests.cs:280-298`.
 */
async function getFirstExpenseCategoryId(token: string): Promise<string> {
  const response = await fetch(`${D_API_BASE}/api/v1/expense-categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch expense categories: ${response.status} - ${text}`);
  }
  const data = await response.json();
  const items = (data.items ?? data) as Array<{ id: string }>;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No expense categories available — cannot seed expense.');
  }
  return items[0].id;
}

/**
 * Create an expense via API for the supplied property and date.
 * Returns the persisted expense's id and amount.
 */
export async function createExpenseViaApi(
  token: string,
  propertyId: string,
  amount: number,
  dateString: string,
): Promise<{ id: string; amount: number; date: string }> {
  const categoryId = await getFirstExpenseCategoryId(token);
  const body = {
    propertyId,
    amount,
    date: dateString,
    categoryId,
    description: 'Dashboard E2E expense',
  };
  const response = await fetch(`${D_API_BASE}/api/v1/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create expense: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return { id: data.id as string, amount, date: dateString };
}

/**
 * Create an income via API for the supplied property and date.
 * Income has no category requirement.
 */
export async function createIncomeViaApi(
  token: string,
  propertyId: string,
  amount: number,
  dateString: string,
): Promise<{ id: string; amount: number; date: string }> {
  const body = {
    propertyId,
    amount,
    date: dateString,
    source: 'Rent',
    description: 'Dashboard E2E income',
  };
  const response = await fetch(`${D_API_BASE}/api/v1/income`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create income: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return { id: data.id as string, amount, date: dateString };
}

// Re-exports — keep the dashboard spec's imports limited to one helper module.
export { getAccessTokenForSeededUser, createPropertyViaApi, resetTestDataViaApi };
