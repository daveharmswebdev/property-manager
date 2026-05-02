/**
 * E2E Tests: Work Orders PDF (Story 21.8 — AC-7, AC-8)
 *
 * Real-backend coverage for PDF preview and download flows. Per the epic's
 * technical note, we validate the request layer only — content-type header
 * and HTTP status — never PDF bytes.
 *
 * Reality check vs. story AC-7: the PDF endpoint is `POST` (not `GET`)
 * (verified `WorkOrdersController.cs:267`). The frontend posts an empty body
 * and reads the blob from the response (`work-order.service.ts:222`). The
 * test asserts on the POST response.
 *
 * @see docs/project/stories/epic-21/21-8-work-orders-e2e.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  createVendorViaApi,
  createWorkOrderViaApi,
  resetTestDataViaApi,
} from '../../helpers/work-order.helper';

test.describe('Work Orders PDF E2E (Story 21.8)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };
  let seedVendor: { id: string; fullName: string };
  let seedWO: { id: string; description: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token);
    seedVendor = await createVendorViaApi(token);
    seedWO = await createWorkOrderViaApi(token, seedProperty.id, {
      description: `PDF-target ${Date.now()}`,
      status: 'Assigned',
      vendorId: seedVendor.id,
    });
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-7: Preview PDF — request returns 200 application/pdf
  // ───────────────────────────────────────────────────────────────────────────
  test('previews PDF — request returns 200 application/pdf', async ({
    page,
    authenticatedUser,
    workOrderDetailPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await workOrderDetailPage.gotoWorkOrder(seedWO.id);

    const pdfResponsePromise = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/work-orders\/[a-f0-9-]+\/pdf$/.test(resp.url()) &&
        resp.request().method() === 'POST',
    );

    await workOrderDetailPage.clickPreviewPdf();

    const pdfResponse = await pdfResponsePromise;
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toMatch(/^application\/pdf/);

    await expect(workOrderDetailPage.pdfPreviewDialog).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-8: Download PDF — file dispatched and snackbar shown
  // ───────────────────────────────────────────────────────────────────────────
  test('downloads PDF — file dispatched and snackbar shown', async ({
    page,
    authenticatedUser,
    workOrderDetailPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    await workOrderDetailPage.gotoWorkOrder(seedWO.id);

    // Register the download listener BEFORE clicking the button.
    const downloadPromise = page.waitForEvent('download');
    await workOrderDetailPage.downloadPdfButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^WorkOrder-.+\.pdf$/);

    // Snackbar verbatim from the component (work-order-detail.component.ts:929).
    await workOrderDetailPage.expectSnackBar('PDF downloaded');
  });
});
