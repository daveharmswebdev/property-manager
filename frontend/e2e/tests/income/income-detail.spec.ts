import { test, expect } from '../../fixtures/test-fixtures';
import { TestDataHelper } from '../../helpers/test-data.helper';
import { createPropertyAndGetId } from '../../helpers/test-setup.helper';

/**
 * Story 16.2: Income Feature Parity — ATDD Acceptance Tests
 *
 * RED PHASE: All tests fail before implementation because:
 * - "Add Income" button does not exist on /income page (AC1)
 * - Income list rows have no action icons or click navigation (AC2)
 * - /income/:id route does not exist (AC3)
 * - IncomeDetailComponent does not exist (AC3, AC4, AC5)
 * - IncomeDetailStore does not exist (AC3, AC4, AC5)
 * - Backend UpdateIncomeCommand does not include PropertyId (AC4)
 *
 * These tests define the expected behavior for the dev team.
 * Implement one test at a time (red → green → refactor).
 */
test.describe('Story 16.2: Income Feature Parity', () => {
  /**
   * Helper: Create a property + income, capture the income ID.
   * Uses network-first pattern to intercept POST response.
   */
  async function createIncomeAndGetId(
    page: any,
    dashboardPage: any,
    propertyFormPage: any,
    propertyDetailPage: any,
    incomeWorkspacePage: any,
    incomeOverrides?: Partial<{ amount: string; source: string; description: string }>,
  ) {
    const { propertyId, propertyData } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    await propertyDetailPage.clickAddIncome();

    const testIncome = TestDataHelper.generateIncome({
      amount: '1500.00',
      source: 'Test Tenant',
      ...incomeOverrides,
    });

    // Network-first: Capture income ID from POST response BEFORE submit
    const createPromise = page.waitForResponse(
      (resp: any) =>
        resp.url().includes('/api/v1/income') &&
        resp.request().method() === 'POST',
    );

    await incomeWorkspacePage.fillForm(testIncome);
    await incomeWorkspacePage.submit();
    await incomeWorkspacePage.waitForSnackBar('Income recorded');

    const createResponse = await createPromise;
    const responseBody = await createResponse.json();
    const incomeId = responseBody.id;

    return { incomeId, propertyId, propertyData, testIncome };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AC1 — Add Income button on list page (#218)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC1: should navigate directly to income workspace when single property', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: Intercept properties API to simulate single-property account
    await page.route('*/**/api/v1/properties', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const singleProperty = { items: json.items.slice(0, 1), totalCount: 1 };
      await route.fulfill({ response, json: singleProperty });
    });

    await page.goto('/income');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks "Add Income" in page header
    const addButton = page.locator('.page-header button', { hasText: 'Add Income' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // THEN: Navigates directly to that property's income workspace
    await expect(page).toHaveURL(/\/properties\/[a-f0-9-]+\/income$/);
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

    await page.goto('/income');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks "Add Income"
    await page.locator('.page-header button', { hasText: 'Add Income' }).click();

    // THEN: Property selection dialog opens
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Select Property');

    // WHEN: User selects the newly created property
    await dialog.locator('mat-list-option', { hasText: propertyData.name }).click();

    // THEN: Navigates to that property's income workspace
    await expect(page).toHaveURL(/\/properties\/[a-f0-9-]+\/income$/);
  });

  test('AC1: should show snackbar when zero properties exist', async ({
    page,
    authenticatedUser,
  }) => {
    // GIVEN: Intercept properties API to simulate zero-property account
    await page.route('*/**/api/v1/properties', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0 }),
      });
    });

    await page.goto('/income');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks "Add Income"
    const addButton = page.locator('.page-header button', { hasText: 'Add Income' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // THEN: Snackbar informs user to create a property first
    const snackbar = page.locator('[matsnackbarlabel]');
    await expect(snackbar.filter({ hasText: 'Create a property first before adding income.' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC2 — Edit/Delete actions on list rows (#218)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC2: should navigate to /income/:id when clicking income row in list', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
  }) => {
    // GIVEN: An income entry exists
    const { incomeId, testIncome } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
    );

    // Navigate to global income list
    await page.goto('/income');
    await page.waitForLoadState('networkidle');

    // WHEN: Click the income row (identified by unique description)
    const incomeRow = page.locator('.income-row', {
      hasText: testIncome.description,
    });
    await expect(incomeRow).toBeVisible({ timeout: 10000 });
    await incomeRow.click();

    // THEN: Navigate to income detail page
    await expect(page).toHaveURL(`/income/${incomeId}`);
  });

  test('AC2: should delete income from list row with confirmation dialog', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
  }) => {
    // GIVEN: An income entry exists
    const { testIncome } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
      { source: 'Income To Delete' },
    );

    // Navigate to global income list
    await page.goto('/income');
    await page.waitForLoadState('networkidle');

    // Find the income row
    const incomeRow = page.locator('.income-row', {
      hasText: testIncome.description,
    });
    await expect(incomeRow).toBeVisible({ timeout: 10000 });

    // WHEN: Click delete icon on the row (stopPropagation prevents row navigation)
    const deleteButton = incomeRow.locator('.cell-actions button').filter({
      has: page.locator('mat-icon', { hasText: 'delete' }),
    });
    await deleteButton.click();

    // THEN: Confirmation dialog appears
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // WHEN: Confirm deletion
    await dialog.locator('button[mat-raised-button]').click();

    // THEN: Snackbar confirms deletion
    const snackbar = page.locator('[matsnackbarlabel]');
    await expect(snackbar.filter({ hasText: 'Income deleted' })).toBeVisible();

    // THEN: Income no longer in list
    await expect(
      page.locator('.income-row', { hasText: testIncome.description }),
    ).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC3 — Income detail view (#219)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC3: should display all income fields in read-only detail view', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists with known data
    const { incomeId, propertyData, testIncome } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
      { amount: '2750.00', source: 'Monthly Rent Payment' },
    );

    // WHEN: Navigate to income detail page
    await incomeDetailPage.gotoIncome(incomeId);

    // THEN: View mode is active with Edit and Delete buttons
    await incomeDetailPage.expectViewMode();

    // THEN: All fields displayed correctly
    await incomeDetailPage.expectAmount('$2,750.00');
    await incomeDetailPage.expectSource('Monthly Rent Payment');
    await incomeDetailPage.expectDescription(testIncome.description!);
    await incomeDetailPage.expectProperty(propertyData.name);

    // THEN: Date is displayed (not empty)
    await expect(incomeDetailPage.dateDisplay).not.toHaveText('');
  });

  test('AC3: should navigate back to /income via "Back to Income" link', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: On income detail page
    const { incomeId } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
    );

    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.expectViewMode();

    // WHEN: Click "Back to Income" link
    await incomeDetailPage.clickBack();

    // THEN: Navigate to /income list
    await expect(page).toHaveURL('/income');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC4 — Edit all fields including property (#219)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC4: should enter edit mode with pre-populated form', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists
    const { incomeId } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
      { amount: '1800.00', source: 'Tenant Alpha' },
    );

    // Navigate to detail page
    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.expectViewMode();

    // WHEN: Click Edit
    await incomeDetailPage.clickEdit();

    // THEN: Edit form is visible with pre-populated values
    await incomeDetailPage.expectEditMode();
    await expect(incomeDetailPage.amountInput).toBeVisible();
    await expect(incomeDetailPage.sourceInput).toBeVisible();
    await expect(incomeDetailPage.propertySelect).toBeVisible();
    await expect(incomeDetailPage.descriptionInput).toBeVisible();
  });

  test('AC4: should save updated income and return to view mode', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists
    const { incomeId } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
      { amount: '1200.00', source: 'Original Source' },
    );

    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.clickEdit();
    await incomeDetailPage.expectEditMode();

    // WHEN: Modify fields and save
    await incomeDetailPage.fillAmount('1950.00');
    await incomeDetailPage.fillSource('Updated Source');
    await incomeDetailPage.fillDescription('Updated via detail edit');
    await incomeDetailPage.submitEdit();

    // THEN: Success snackbar shown
    await incomeDetailPage.expectSnackBar('Income updated');

    // THEN: Returns to view mode with updated values
    await incomeDetailPage.expectViewMode();
    await incomeDetailPage.expectAmount('$1,950.00');
    await incomeDetailPage.expectSource('Updated Source');
    await incomeDetailPage.expectDescription('Updated via detail edit');
  });

  test('AC4: should reassign income to different property', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists on Property A
    const { incomeId, propertyData: propertyA } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
    );

    // Create a second property (Property B)
    const { propertyData: propertyB } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    // Navigate to income detail
    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.expectProperty(propertyA.name);

    // WHEN: Enter edit mode and change property
    await incomeDetailPage.clickEdit();
    await incomeDetailPage.expectEditMode();
    await incomeDetailPage.selectProperty(propertyB.name);
    await incomeDetailPage.submitEdit();

    // THEN: Income is reassigned to Property B
    await incomeDetailPage.expectSnackBar('Income updated');
    await incomeDetailPage.expectViewMode();
    await incomeDetailPage.expectProperty(propertyB.name);
  });

  test('AC4: should cancel edit and revert to view mode without changes', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists with known values
    const { incomeId } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
      { amount: '3000.00', source: 'Stable Tenant' },
    );

    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.expectAmount('$3,000.00');
    await incomeDetailPage.expectSource('Stable Tenant');

    // WHEN: Enter edit, change amount, then cancel
    await incomeDetailPage.clickEdit();
    await incomeDetailPage.fillAmount('9999.99');
    await incomeDetailPage.cancelEdit();

    // THEN: View mode restored with original values (no change persisted)
    await incomeDetailPage.expectViewMode();
    await incomeDetailPage.expectAmount('$3,000.00');
    await incomeDetailPage.expectSource('Stable Tenant');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC5 — Delete from detail view (#219)
  // ─────────────────────────────────────────────────────────────────────────

  test('AC5: should delete income from detail view with confirmation and navigate to /income', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    incomeWorkspacePage,
    incomeDetailPage,
  }) => {
    // GIVEN: An income entry exists
    const { incomeId, testIncome } = await createIncomeAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      incomeWorkspacePage,
    );

    await incomeDetailPage.gotoIncome(incomeId);
    await incomeDetailPage.expectViewMode();

    // WHEN: Click Delete
    await incomeDetailPage.clickDelete();

    // THEN: Confirmation dialog appears
    await incomeDetailPage.waitForConfirmDialog();

    // WHEN: Confirm deletion
    await incomeDetailPage.confirmDialogAction('Income deleted');

    // THEN: Navigate back to /income
    await expect(page).toHaveURL('/income');

    // THEN: Deleted income no longer in list
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.income-row', { hasText: testIncome.description }),
    ).not.toBeVisible();
  });
});
