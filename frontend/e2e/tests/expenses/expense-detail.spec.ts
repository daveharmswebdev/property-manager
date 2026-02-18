import { test, expect } from '../../fixtures/test-fixtures';
import { TestDataHelper } from '../../helpers/test-data.helper';
import { createPropertyAndGetId } from '../../helpers/test-setup.helper';

/**
 * Story 15.5: Expense Detail/Edit View — ATDD Acceptance Tests
 *
 * RED PHASE: All tests fail before implementation because:
 * - /expenses/:id route does not exist
 * - ExpenseDetailComponent does not exist
 * - ExpenseDetailStore does not exist
 * - ExpenseListRowComponent still navigates to /properties/:propertyId/expenses
 * - Backend UpdateExpenseCommand does not include PropertyId
 *
 * These tests define the expected behavior for the dev team.
 * Implement one test at a time (red → green → refactor).
 */
test.describe('Story 15.5: Expense Detail/Edit View', () => {
  /**
   * Helper: Create a property + expense, capture the expense ID.
   * Uses network-first pattern to intercept POST response.
   */
  async function createExpenseAndGetId(
    page: any,
    dashboardPage: any,
    propertyFormPage: any,
    propertyDetailPage: any,
    expenseWorkspacePage: any,
    expenseOverrides?: Partial<{ amount: string; category: string; description: string }>,
  ) {
    const { propertyId, propertyData } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    await propertyDetailPage.clickAddExpense();

    const testExpense = TestDataHelper.generateExpense({
      amount: '250.00',
      category: 'Repairs',
      ...expenseOverrides,
    });

    // Network-first: Capture expense ID from POST response BEFORE submit
    const createPromise = page.waitForResponse(
      (resp: any) =>
        resp.url().includes('/api/v1/expenses') &&
        !resp.url().includes('/receipt') &&
        resp.request().method() === 'POST',
    );

    await expenseWorkspacePage.fillForm(testExpense);
    await expenseWorkspacePage.submit();
    await expenseWorkspacePage.waitForSnackBar('Expense saved');

    const createResponse = await createPromise;
    const responseBody = await createResponse.json();
    const expenseId = responseBody.id;

    return { expenseId, propertyId, propertyData, testExpense };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AC1 — Navigation from expense list
  // ─────────────────────────────────────────────────────────────────────────

  test('AC1: should navigate to /expenses/:id when clicking expense row in list', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId, testExpense } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Navigate to global expense list
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // WHEN: Click the expense row (identified by unique description)
    const expenseRow = page.locator('app-expense-list-row', {
      hasText: testExpense.description,
    });
    await expect(expenseRow).toBeVisible({ timeout: 10000 });
    await expenseRow.click();

    // THEN: Navigate to expense detail page
    await expect(page).toHaveURL(`/expenses/${expenseId}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC2 — Detail view displays all fields
  // ─────────────────────────────────────────────────────────────────────────

  test('AC2: should display all expense fields in read-only detail view', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists with known data
    const { expenseId, propertyData, testExpense } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
      { amount: '375.50', category: 'Utilities' },
    );

    // WHEN: Navigate to expense detail page
    await expenseDetailPage.gotoExpense(expenseId);

    // THEN: View mode is active with Edit and Delete buttons
    await expenseDetailPage.expectViewMode();

    // THEN: All fields displayed correctly
    await expenseDetailPage.expectAmount('$375.50');
    await expenseDetailPage.expectCategory('Utilities');
    await expenseDetailPage.expectDescription(testExpense.description!);
    await expenseDetailPage.expectProperty(propertyData.name);

    // THEN: Date is displayed (not empty)
    await expect(expenseDetailPage.dateDisplay).not.toHaveText('');

    // THEN: Created date is displayed
    await expect(expenseDetailPage.createdDateDisplay).not.toHaveText('');

    // THEN: No receipt linked (we didn't attach one)
    await expenseDetailPage.expectNoReceipt();
  });

  test('AC2: should display receipt actions when expense has linked receipt', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId, testExpense } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Mock expense API to return expense WITH receipt (receipt linking is tested elsewhere)
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      // Inject a fake receiptId to simulate linked receipt
      await route.fulfill({
        response,
        json: { ...json, receiptId: '00000000-0000-0000-0000-000000000099' },
      });
    });

    // WHEN: Navigate to detail page
    await expenseDetailPage.gotoExpense(expenseId);

    // THEN: Receipt section shows view and unlink actions
    await expenseDetailPage.expectReceiptLinked();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC3 — Edit all fields including property
  // ─────────────────────────────────────────────────────────────────────────

  test('AC3: should enter edit mode with pre-populated form', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
      { amount: '100.00', category: 'Repairs' },
    );

    // Navigate to detail page
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.expectViewMode();

    // WHEN: Click Edit
    await expenseDetailPage.clickEdit();

    // THEN: Edit form is visible with pre-populated values
    await expenseDetailPage.expectEditMode();
    await expect(expenseDetailPage.amountInput).toBeVisible();
    await expect(expenseDetailPage.categorySelect).toBeVisible();
    await expect(expenseDetailPage.propertySelect).toBeVisible();
    await expect(expenseDetailPage.descriptionInput).toBeVisible();
  });

  test('AC3: should save updated expense and return to view mode', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
      { amount: '200.00', category: 'Repairs' },
    );

    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.expectEditMode();

    // WHEN: Modify fields and save
    await expenseDetailPage.fillAmount('450.00');
    await expenseDetailPage.selectCategory('Supplies');
    await expenseDetailPage.fillDescription('Updated via detail edit');
    await expenseDetailPage.submitEdit();

    // THEN: Success snackbar shown
    await expenseDetailPage.expectSnackBar('Expense updated');

    // THEN: Returns to view mode with updated values
    await expenseDetailPage.expectViewMode();
    await expenseDetailPage.expectAmount('$450.00');
    await expenseDetailPage.expectCategory('Supplies');
    await expenseDetailPage.expectDescription('Updated via detail edit');
  });

  test('AC3: should reassign expense to different property', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists on Property A
    const { expenseId, propertyData: propertyA } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Create a second property (Property B)
    const { propertyData: propertyB } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    // Navigate to expense detail
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.expectProperty(propertyA.name);

    // WHEN: Enter edit mode and change property
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.expectEditMode();
    await expenseDetailPage.selectProperty(propertyB.name);
    await expenseDetailPage.submitEdit();

    // THEN: Expense is reassigned to Property B
    await expenseDetailPage.expectSnackBar('Expense updated');
    await expenseDetailPage.expectViewMode();
    await expenseDetailPage.expectProperty(propertyB.name);
  });

  test('AC3: should cancel edit and revert to view mode without changes', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists with known amount
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
      { amount: '300.00', category: 'Insurance' },
    );

    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.expectAmount('$300.00');
    await expenseDetailPage.expectCategory('Insurance');

    // WHEN: Enter edit, change amount, then cancel
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.fillAmount('999.99');
    await expenseDetailPage.cancelEdit();

    // THEN: View mode restored with original values (no change persisted)
    await expenseDetailPage.expectViewMode();
    await expenseDetailPage.expectAmount('$300.00');
    await expenseDetailPage.expectCategory('Insurance');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC4 — Delete from detail view
  // ─────────────────────────────────────────────────────────────────────────

  test('AC4: should delete expense with confirmation and navigate to expense list', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId, testExpense } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.expectViewMode();

    // WHEN: Click Delete
    await expenseDetailPage.clickDelete();

    // THEN: Confirmation dialog appears
    await expenseDetailPage.waitForConfirmDialog();

    // WHEN: Confirm deletion
    await expenseDetailPage.confirmDialogAction('Expense deleted');

    // THEN: Navigate back to /expenses
    await expect(page).toHaveURL('/expenses');

    // THEN: Deleted expense no longer in list
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('app-expense-list-row', { hasText: testExpense.description }),
    ).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC5 — Unlink receipt from detail view
  // ─────────────────────────────────────────────────────────────────────────

  test('AC5: should unlink receipt and show "No receipt" after confirmation', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Mock expense GET to simulate linked receipt
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({
        response,
        json: { ...json, receiptId: '00000000-0000-0000-0000-000000000099' },
      });
    });

    // Mock unlink receipt DELETE to return 204
    await page.route(`*/**/api/v1/expenses/${expenseId}/receipt`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
        // After unlink, remove mock so next GET returns no receipt
        await page.unroute(`*/**/api/v1/expenses/${expenseId}`);
      } else {
        await route.continue();
      }
    });

    // Navigate to detail page (mocked receipt)
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.expectReceiptLinked();

    // WHEN: Click "Unlink Receipt" and confirm
    await expenseDetailPage.clickUnlinkReceipt();
    await expenseDetailPage.waitForConfirmDialog();
    await expenseDetailPage.confirmDialogAction('Receipt unlinked');

    // THEN: Receipt section updates to show "No receipt"
    await expenseDetailPage.expectNoReceipt();
  });
});
