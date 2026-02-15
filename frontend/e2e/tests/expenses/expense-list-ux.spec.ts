import { test, expect } from '../../fixtures/test-fixtures';
import { TestDataHelper } from '../../helpers/test-data.helper';
import { createPropertyAndGetId } from '../../helpers/test-setup.helper';

/**
 * Story 15.3: Expense List UX Improvements — ATDD Acceptance Tests
 *
 * RED PHASE: All tests should fail before implementation.
 * - AC1 fails: No "Add Expense" button exists on /expenses page
 * - AC2 fails: Date picker FormControls don't sync from store; no sessionStorage
 * - AC3 fails: Column headers are static divs, not clickable sort buttons
 */
test.describe('Story 15.3: Expense List UX Improvements', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // AC1 — Add Expense Button (#204)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC1: should navigate directly to expense workspace when single property', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: Seeded account has exactly 1 property ("Test Property")
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks "Add Expense" in page header
    const addButton = page.locator('.page-header button', { hasText: 'Add Expense' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // THEN: Navigates directly to that property's expense workspace
    await expect(page).toHaveURL(/\/properties\/[a-f0-9-]+\/expenses$/);
  });

  test('AC1: should open property picker dialog when multiple properties', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
  }) => {
    // GIVEN: User has multiple properties (create a second one)
    const { propertyData } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks "Add Expense"
    await page.locator('.page-header button', { hasText: 'Add Expense' }).click();

    // THEN: Property selection dialog opens
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Select Property');

    // WHEN: User selects the newly created property
    await dialog.locator('mat-list-option', { hasText: propertyData.name }).click();

    // THEN: Navigates to that property's expense workspace
    await expect(page).toHaveURL(/\/properties\/[a-f0-9-]+\/expenses$/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC2 — Custom Date Range Persistence (#206)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC2: should persist custom date picker values across SPA navigation', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: On expenses page, set custom date range
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Select "Custom Range" preset
    const dateRangeSelect = page.locator('mat-form-field', {
      has: page.locator('mat-label', { hasText: 'Date Range' }),
    });
    await dateRangeSelect.locator('mat-select').click();
    await page.locator('mat-option', { hasText: 'Custom Range' }).click();

    // Fill date pickers
    const fromInput = page
      .locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'From' }) })
      .locator('input');
    const toInput = page
      .locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'To' }) })
      .locator('input');

    await fromInput.fill('1/1/2026');
    await toInput.fill('1/31/2026');
    await page.locator('button', { hasText: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    // WHEN: Navigate away and back (SPA navigation)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // THEN: Date pickers should repopulate from store (not be empty)
    // Note: Preset dropdown already works (synced from store signal).
    // The BUG is that the FormControl date pickers reset to empty.
    const restoredFrom = await fromInput.inputValue();
    const restoredTo = await toInput.inputValue();
    expect(restoredFrom).not.toBe('');
    expect(restoredTo).not.toBe('');
  });

  test('AC2: should restore custom date range from sessionStorage after page refresh', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: On expenses page, set custom date range
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    const dateRangeSelect = page.locator('mat-form-field', {
      has: page.locator('mat-label', { hasText: 'Date Range' }),
    });
    await dateRangeSelect.locator('mat-select').click();
    await page.locator('mat-option', { hasText: 'Custom Range' }).click();

    const fromInput = page
      .locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'From' }) })
      .locator('input');
    const toInput = page
      .locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'To' }) })
      .locator('input');

    await fromInput.fill('1/1/2026');
    await toInput.fill('1/31/2026');
    await page.locator('button', { hasText: 'Apply' }).click();
    await page.waitForLoadState('networkidle');

    // WHEN: Hard page refresh (destroys store singleton, clears signals)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: sessionStorage restores the custom date range
    await expect(dateRangeSelect.locator('mat-select')).toHaveText(/Custom Range/);
    const restoredFrom = await fromInput.inputValue();
    const restoredTo = await toInput.inputValue();
    expect(restoredFrom).not.toBe('');
    expect(restoredTo).not.toBe('');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC3 — Column Sorting (#207)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC3: should sort by column with direction indicator and toggle', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
  }) => {
    // GIVEN: Create property with 2 expenses at different amounts
    await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );
    await propertyDetailPage.clickAddExpense();

    const expense1 = TestDataHelper.generateExpense({ amount: '50.00', category: 'Repairs' });
    await expenseWorkspacePage.createExpense(expense1);
    const expense2 = TestDataHelper.generateExpense({ amount: '500.00', category: 'Utilities' });
    await expenseWorkspacePage.createExpense(expense2);

    // Navigate to all-expenses list
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // THEN: Column headers should be clickable buttons (not static divs)
    const amountHeader = page.locator('.list-header button', { hasText: 'Amount' });
    await expect(amountHeader).toBeVisible();

    // WHEN: Click "Amount" header
    await amountHeader.click();
    await page.waitForLoadState('networkidle');

    // THEN: Sort direction indicator appears on Amount column
    const sortIcon = amountHeader.locator('mat-icon');
    await expect(sortIcon).toBeVisible();
    const firstDirection = await sortIcon.textContent();

    // WHEN: Click Amount again to toggle direction
    await amountHeader.click();
    await page.waitForLoadState('networkidle');

    // THEN: Sort icon changes direction
    await expect(sortIcon).not.toHaveText(firstDirection!);
  });
});
