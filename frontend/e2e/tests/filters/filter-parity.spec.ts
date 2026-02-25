/**
 * ATDD RED Phase — Story 16.11: Align Expense & Income Filter Cards
 *
 * E2E tests for filter card alignment between expenses and income pages.
 * Will NOT pass until:
 * - Income page has search field (AC1, Tasks 2 + 7)
 * - Expense total moves inside filter card (AC2, Task 6)
 * - Expense page has property dropdown (AC3, Tasks 1 + 5)
 * - Both filter cards reach parity (AC4)
 *
 * Tests use route interception (network-first pattern) to control API data.
 * Import test/expect from fixtures — NOT @playwright/test (project rule).
 */
import { test, expect } from '../../fixtures/test-fixtures';
import type { Page } from '@playwright/test';

// ─── Shared Mock Data ───────────────────────────────────────────────────────

const MOCK_PROPERTIES = {
  items: [
    {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Test Property',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'Beach House',
      address: '456 Ocean Dr',
      city: 'Galveston',
      state: 'TX',
      zip: '77550',
    },
  ],
  totalCount: 2,
};

const MOCK_CATEGORIES = [
  { id: '00000000-0000-0000-0000-000000000020', name: 'Repairs', scheduleELine: 'Line 14' },
  { id: '00000000-0000-0000-0000-000000000021', name: 'Utilities', scheduleELine: 'Line 17' },
];

const MOCK_EXPENSES = {
  items: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      propertyId: '00000000-0000-0000-0000-000000000010',
      propertyName: 'Test Property',
      categoryId: '00000000-0000-0000-0000-000000000020',
      categoryName: 'Repairs',
      amount: 150.0,
      date: '2026-01-15',
      description: 'Plumbing fix',
      createdAt: '2026-01-15T12:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      propertyId: '00000000-0000-0000-0000-000000000011',
      propertyName: 'Beach House',
      categoryId: '00000000-0000-0000-0000-000000000021',
      categoryName: 'Utilities',
      amount: 75.5,
      date: '2026-01-20',
      description: 'Electric bill',
      createdAt: '2026-01-20T12:00:00Z',
    },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  totalAmount: 225.5,
};

const MOCK_INCOME = {
  items: [
    {
      id: '00000000-0000-0000-0000-000000000003',
      propertyId: '00000000-0000-0000-0000-000000000010',
      propertyName: 'Test Property',
      amount: 2500.0,
      date: '2026-01-15',
      source: 'Rent',
      description: 'January rent payment',
      createdAt: '2026-01-15T12:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      propertyId: '00000000-0000-0000-0000-000000000011',
      propertyName: 'Beach House',
      amount: 1800.0,
      date: '2026-01-20',
      source: 'Airbnb',
      description: 'Weekend booking',
      createdAt: '2026-01-20T12:00:00Z',
    },
  ],
  totalCount: 2,
  totalAmount: 4300.0,
};

// ─── Route Interception Helpers ─────────────────────────────────────────────

async function interceptIncomeApi(page: Page): Promise<void> {
  await page.route('*/**/api/v1/income*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INCOME),
    });
  });
}

async function interceptExpenseApis(page: Page): Promise<void> {
  await page.route('*/**/api/v1/expenses*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EXPENSES),
    });
  });
  await page.route('*/**/api/v1/expense-categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATEGORIES),
    });
  });
  await page.route('*/**/api/v1/properties', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROPERTIES),
    });
  });
}

test.describe('Story 16.11: Align Expense & Income Filter Cards', () => {
  // ─── AC1 — Income list: add search field ──────────────────────────────────

  test.describe('AC1 — Income search field', () => {
    test.beforeEach(async ({ page }) => {
      await interceptIncomeApi(page);
      await page.goto('/income');
    });

    test('should display a search field in the income filter card', async ({
      page,
      authenticatedUser,
    }) => {
      // THEN: Search field is visible inside the filter card
      const filterCard = page.locator('.filters-card');
      const searchField = filterCard.locator('mat-form-field').filter({
        has: page.locator('mat-label', { hasText: /search/i }),
      });
      await expect(searchField).toBeVisible();
    });

    test('should have search icon prefix matching expense search styling', async ({
      page,
      authenticatedUser,
    }) => {
      // THEN: Search field has search icon prefix (mat-icon with "search")
      const filterCard = page.locator('.filters-card');
      const searchField = filterCard.locator('mat-form-field').filter({
        has: page.locator('mat-label', { hasText: /search/i }),
      });
      await expect(searchField.locator('mat-icon', { hasText: 'search' })).toBeVisible();
    });

    test('should show clear button when search has text', async ({
      page,
      authenticatedUser,
    }) => {
      // WHEN: Text is entered in search field
      const filterCard = page.locator('.filters-card');
      const searchInput = filterCard
        .locator('mat-form-field')
        .filter({
          has: page.locator('mat-label', { hasText: /search/i }),
        })
        .locator('input');
      await searchInput.fill('Rent');

      // THEN: Clear button appears
      await expect(filterCard.locator('button[aria-label="Clear search"]')).toBeVisible();
    });

    test('should send search parameter to income API', async ({
      page,
      authenticatedUser,
    }) => {
      await page.waitForLoadState('networkidle');

      // WHEN: User types "Airbnb" in search field
      const searchInput = page
        .locator('.filters-card mat-form-field')
        .filter({
          has: page.locator('mat-label', { hasText: /search/i }),
        })
        .locator('input');

      // Set up response listener BEFORE typing (network-first)
      const searchResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/v1/income') && resp.url().includes('search='),
      );

      await searchInput.fill('Airbnb');

      // THEN: API is called with search parameter (after 300ms debounce)
      const response = await searchResponsePromise;
      expect(response.url()).toContain('search=Airbnb');
    });
  });

  // ─── AC2 — Expenses: move total inside filter card ────────────────────────

  test.describe('AC2 — Expense total inside filter card', () => {
    test('should display total expenses inside the expense filters component', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Intercept APIs before navigation
      await interceptExpenseApis(page);

      // WHEN: Navigating to expenses page
      await page.goto('/expenses');

      // THEN: Total display is INSIDE app-expense-filters (not a sibling element)
      const filtersComponent = page.locator('app-expense-filters');
      const totalInside = filtersComponent.locator('app-list-total-display');
      await expect(totalInside).toBeVisible();
      await expect(totalInside).toContainText('Total Expenses');
      await expect(totalInside).toContainText('$225.50');
    });
  });

  // ─── AC3 — Expenses: add property filter ──────────────────────────────────

  test.describe('AC3 — Expense property filter', () => {
    test.beforeEach(async ({ page }) => {
      await interceptExpenseApis(page);
      await page.goto('/expenses');
    });

    test('should display property dropdown in expense filters', async ({
      page,
      authenticatedUser,
    }) => {
      // THEN: Property dropdown is visible in expense filters
      const filtersComponent = page.locator('app-expense-filters');
      const propertyField = filtersComponent.locator('mat-form-field').filter({
        has: page.locator('mat-label', { hasText: 'Property' }),
      });
      await expect(propertyField).toBeVisible();
    });

    test('should show "All Properties" as default selection', async ({
      page,
      authenticatedUser,
    }) => {
      // THEN: Property dropdown shows "All Properties" by default
      const filtersComponent = page.locator('app-expense-filters');
      const propertySelect = filtersComponent
        .locator('mat-form-field')
        .filter({
          has: page.locator('mat-label', { hasText: 'Property' }),
        })
        .locator('mat-select');
      await expect(propertySelect).toHaveText(/All Properties/);
    });

    test('should send propertyId to expenses API when property selected', async ({
      page,
      authenticatedUser,
    }) => {
      await page.waitForLoadState('networkidle');

      // Set up response listener BEFORE clicking (network-first)
      const filterResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/v1/expenses') && resp.url().includes('propertyId='),
      );

      // WHEN: User selects "Test Property" from property dropdown
      const filtersComponent = page.locator('app-expense-filters');
      const propertySelect = filtersComponent
        .locator('mat-form-field')
        .filter({
          has: page.locator('mat-label', { hasText: 'Property' }),
        })
        .locator('mat-select');
      await propertySelect.click();
      await page.locator('mat-option', { hasText: 'Test Property' }).click();

      // THEN: API is called with propertyId parameter
      const response = await filterResponsePromise;
      expect(response.url()).toContain('propertyId=00000000-0000-0000-0000-000000000010');
    });
  });

  // ─── AC4 — Both filter cards reach parity ─────────────────────────────────

  test.describe('AC4 — Filter card parity', () => {
    test('should have date range, property, search, and total on expense filters', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Intercept APIs before navigation
      await interceptExpenseApis(page);
      await page.goto('/expenses');

      const filters = page.locator('app-expense-filters');

      // THEN: All shared filter elements present
      await expect(filters.locator('app-date-range-filter')).toBeVisible();
      await expect(
        filters.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: 'Property' }),
        }),
      ).toBeVisible();
      await expect(
        filters.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: /search/i }),
        }),
      ).toBeVisible();
      await expect(filters.locator('app-list-total-display')).toBeVisible();

      // AND: Category dropdown (expenses only — this already exists)
      await expect(
        filters.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: 'Categories' }),
        }),
      ).toBeVisible();
    });

    test('should have date range, property, search, and total on income filter card', async ({
      page,
      authenticatedUser,
    }) => {
      // GIVEN: Intercept APIs before navigation
      await interceptIncomeApi(page);
      await page.goto('/income');

      const filterCard = page.locator('.filters-card');

      // THEN: All shared filter elements present
      await expect(filterCard.locator('app-date-range-filter')).toBeVisible();
      await expect(
        filterCard.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: 'Property' }),
        }),
      ).toBeVisible();
      await expect(
        filterCard.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: /search/i }),
        }),
      ).toBeVisible();
      await expect(filterCard.locator('app-list-total-display')).toBeVisible();

      // AND: No category dropdown (income doesn't have categories)
      await expect(
        filterCard.locator('mat-form-field').filter({
          has: page.locator('mat-label', { hasText: 'Categories' }),
        }),
      ).not.toBeVisible();
    });
  });
});
