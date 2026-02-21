import { test, expect } from '../../fixtures/test-fixtures';
import { TestDataHelper } from '../../helpers/test-data.helper';
import { createPropertyAndGetId } from '../../helpers/test-setup.helper';

/**
 * Story 16.4: Expense-WorkOrder & Receipt Linking — ATDD Acceptance Tests
 *
 * RED PHASE: All tests fail before implementation because:
 * - Work order dropdown does not exist in expense detail edit mode
 * - Receipt linking UI does not exist in expense detail edit mode
 * - LinkReceiptToExpense backend endpoint does not exist
 * - No workOrderId form control in edit form
 *
 * These tests define the expected behavior for the dev team.
 * Implement one test at a time (red → green → refactor).
 */
test.describe('Story 16.4: Expense-WorkOrder & Receipt Linking', () => {
  /**
   * Helper: Create a property + expense, capture the expense ID.
   * Reuses the network-first pattern from expense-detail.spec.ts.
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

    // Network-first: Capture expense ID from POST response
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
  // AC1 — Work order dropdown on detail edit form
  // ─────────────────────────────────────────────────────────────────────────

  test('AC1: should show work order dropdown in edit mode', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists
    const { expenseId, propertyId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Mock work orders API for the property
    await page.route(`*/**/api/v1/properties/${propertyId}/work-orders*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              description: 'Fix leaky faucet in kitchen',
              status: 'Open',
              propertyId,
            },
            {
              id: '00000000-0000-0000-0000-000000000002',
              description: 'Replace HVAC filter',
              status: 'Completed',
              propertyId,
            },
          ],
          totalCount: 2,
        }),
      });
    });

    // WHEN: Navigate to detail and enter edit mode
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.expectEditMode();

    // THEN: Work order dropdown is visible with options
    await expenseDetailPage.expectWorkOrderDropdown();
  });

  test('AC1: should persist work order selection on save', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists with work orders available
    const { expenseId, propertyId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    const workOrderId = '00000000-0000-0000-0000-000000000001';

    // Mock work orders API
    await page.route(`*/**/api/v1/properties/${propertyId}/work-orders*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: workOrderId,
              description: 'Fix leaky faucet',
              status: 'Open',
              propertyId,
            },
          ],
          totalCount: 1,
        }),
      });
    });

    // Intercept the PUT to verify workOrderId is included
    let capturedUpdateBody: any = null;
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      if (route.request().method() === 'PUT') {
        capturedUpdateBody = route.request().postDataJSON();
        const response = await route.fetch();
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    // WHEN: Enter edit, select work order, and save
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.selectWorkOrder('Fix leaky faucet');
    await expenseDetailPage.submitEdit();

    // THEN: PUT request includes the selected workOrderId
    await expenseDetailPage.expectSnackBar('Expense updated');
    expect(capturedUpdateBody).toBeTruthy();
    expect(capturedUpdateBody.workOrderId).toBe(workOrderId);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC2 — Work order dropdown resets on property change
  // ─────────────────────────────────────────────────────────────────────────

  test('AC2: should clear work order dropdown when property changes', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense exists on Property A with work orders
    const { expenseId, propertyId: propertyAId, propertyData: propertyA } =
      await createExpenseAndGetId(
        page,
        dashboardPage,
        propertyFormPage,
        propertyDetailPage,
        expenseWorkspacePage,
      );

    // Create Property B
    const { propertyId: propertyBId, propertyData: propertyB } = await createPropertyAndGetId(
      dashboardPage,
      propertyFormPage,
      page,
    );

    // Mock work orders for Property A
    await page.route(`*/**/api/v1/properties/${propertyAId}/work-orders*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'wo-a-1', description: 'Property A Work Order', status: 'Open', propertyId: propertyAId },
          ],
          totalCount: 1,
        }),
      });
    });

    // Mock work orders for Property B (different work orders)
    await page.route(`*/**/api/v1/properties/${propertyBId}/work-orders*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'wo-b-1', description: 'Property B Work Order', status: 'Open', propertyId: propertyBId },
          ],
          totalCount: 1,
        }),
      });
    });

    // WHEN: Enter edit mode
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.expectEditMode();

    // Select a work order for Property A
    await expenseDetailPage.selectWorkOrder('Property A Work Order');

    // WHEN: Change property to Property B
    await expenseDetailPage.selectProperty(propertyB.name);

    // THEN: Work order dropdown is reset (no "Property A Work Order" selected)
    // The dropdown should now show Property B work orders
    await expect(
      page.locator('mat-select[formControlName="workOrderId"]'),
    ).not.toContainText('Property A Work Order');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC3 — Link unprocessed receipt to existing expense
  // ─────────────────────────────────────────────────────────────────────────

  test('AC3: should show receipt picker in edit mode when no receipt linked', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense without a receipt
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Mock unprocessed receipts API
    await page.route('*/**/api/v1/receipts/unprocessed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'receipt-1',
              viewUrl: 'https://example.com/receipt1.jpg',
              contentType: 'image/jpeg',
              originalFileName: 'receipt-jan.jpg',
              propertyName: 'Test Property',
            },
            {
              id: 'receipt-2',
              viewUrl: 'https://example.com/receipt2.jpg',
              contentType: 'application/pdf',
              originalFileName: 'invoice-feb.pdf',
              propertyName: null,
            },
          ],
          totalCount: 2,
        }),
      });
    });

    // WHEN: Navigate to detail and enter edit mode
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();

    // THEN: Receipt link section is visible with thumbnails
    await expenseDetailPage.expectReceiptLinkSection();
    await expect(expenseDetailPage.receiptOptions).toHaveCount(2);
  });

  test('AC3: should link selected receipt to expense', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense without a receipt
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    const receiptId = 'receipt-to-link';

    // Mock unprocessed receipts
    await page.route('*/**/api/v1/receipts/unprocessed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: receiptId,
              viewUrl: 'https://example.com/receipt.jpg',
              contentType: 'image/jpeg',
              originalFileName: 'my-receipt.jpg',
              propertyName: 'Test Property',
            },
          ],
          totalCount: 1,
        }),
      });
    });

    // Mock link-receipt POST endpoint
    let linkReceiptCalled = false;
    await page.route(`*/**/api/v1/expenses/${expenseId}/link-receipt`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.receiptId).toBe(receiptId);
        linkReceiptCalled = true;
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    });

    // Mock expense reload to show receipt after linking
    let linkDone = false;
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      if (route.request().method() === 'GET' && linkDone) {
        const response = await route.fetch();
        const json = await response.json();
        await route.fulfill({
          response,
          json: { ...json, receiptId },
        });
      } else {
        await route.continue();
      }
    });

    // WHEN: Navigate, enter edit, select receipt, click link
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();
    await expenseDetailPage.selectReceipt(0);
    await expenseDetailPage.clickLinkReceipt();
    linkDone = true;

    // THEN: Success snackbar and receipt linked
    await expenseDetailPage.expectSnackBar('Receipt linked');
    expect(linkReceiptCalled).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC4 — Unlink receipt from detail edit mode
  // ─────────────────────────────────────────────────────────────────────────

  test('AC4: should show unlink button in edit mode when receipt is linked', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense with a linked receipt
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    // Mock expense to have a receipt
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      if (route.request().method() === 'GET') {
        const response = await route.fetch();
        const json = await response.json();
        await route.fulfill({
          response,
          json: { ...json, receiptId: '00000000-0000-0000-0000-000000000099' },
        });
      } else {
        await route.continue();
      }
    });

    // WHEN: Navigate to detail and enter edit mode
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();

    // THEN: Receipt section in edit mode shows unlink button (not receipt picker)
    await expect(expenseDetailPage.receiptSectionEdit).toBeVisible();
    await expect(expenseDetailPage.unlinkReceiptButton).toBeVisible();
    // Receipt picker should NOT be visible (receipt already linked)
    await expect(expenseDetailPage.receiptLinkSection).not.toBeVisible();
  });

  test('AC4: should unlink receipt in edit mode and show receipt picker', async ({
    page,
    authenticatedUser,
    dashboardPage,
    propertyFormPage,
    propertyDetailPage,
    expenseWorkspacePage,
    expenseDetailPage,
  }) => {
    // GIVEN: An expense with a linked receipt
    const { expenseId } = await createExpenseAndGetId(
      page,
      dashboardPage,
      propertyFormPage,
      propertyDetailPage,
      expenseWorkspacePage,
    );

    let receiptUnlinked = false;

    // Mock expense to have a receipt (initially), then no receipt (after unlink)
    await page.route(`*/**/api/v1/expenses/${expenseId}`, async (route) => {
      if (route.request().method() === 'GET') {
        const response = await route.fetch();
        const json = await response.json();
        await route.fulfill({
          response,
          json: {
            ...json,
            receiptId: receiptUnlinked ? null : '00000000-0000-0000-0000-000000000099',
          },
        });
      } else {
        await route.continue();
      }
    });

    // Mock unlink receipt endpoint
    await page.route(`*/**/api/v1/expenses/${expenseId}/unlink-receipt`, async (route) => {
      if (route.request().method() === 'POST') {
        receiptUnlinked = true;
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    });

    // Mock unprocessed receipts for after unlink
    await page.route('*/**/api/v1/receipts/unprocessed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0 }),
      });
    });

    // Navigate and enter edit mode
    await expenseDetailPage.gotoExpense(expenseId);
    await expenseDetailPage.clickEdit();

    // WHEN: Click unlink receipt
    await expenseDetailPage.clickUnlinkReceipt();
    await expenseDetailPage.waitForConfirmDialog();
    await expenseDetailPage.confirmDialogAction('Receipt unlinked');

    // THEN: Receipt picker section appears (receipt is gone)
    await expenseDetailPage.expectReceiptLinkSection();
  });
});
