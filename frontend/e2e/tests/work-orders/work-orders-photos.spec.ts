/**
 * E2E Tests: Work Orders Photos (Story 21.8 — AC-6)
 *
 * Real-backend coverage for the photo upload flow. The API calls
 * (`generate-upload-url` and `confirm-upload`) hit the real backend, but the
 * S3 PUT itself is mocked because the dev environment uses real AWS S3
 * (verified `S3StorageService.cs`) and Playwright cannot reach it.
 *
 * Network strategy:
 * 1. Register `page.route('**\/*.amazonaws.com/**')` BEFORE the upload click
 *    so the S3 PUT is stubbed regardless of the dynamic presigned URL.
 * 2. Let `/upload-url`, `/confirm`, and `/photos` (GET) hit the real backend.
 * 3. The `ConfirmUpload` endpoint doesn't verify object existence in S3, so
 *    the mocked S3 PUT is sufficient to drive the chain to completion.
 *
 * @see docs/project/stories/epic-21/21-8-work-orders-e2e.md
 */
import { test, expect } from '../../fixtures/test-fixtures';
import {
  getAccessTokenForSeededUser,
  createPropertyViaApi,
  createWorkOrderViaApi,
  resetTestDataViaApi,
} from '../../helpers/work-order.helper';

test.describe('Work Orders Photos E2E (Story 21.8)', () => {
  let token: string;
  let seedProperty: { id: string; name: string };
  let seedWO: { id: string; description: string };

  test.beforeAll(async () => {
    token = await getAccessTokenForSeededUser();
    seedProperty = await createPropertyViaApi(token);
    seedWO = await createWorkOrderViaApi(token, seedProperty.id, {
      description: `Photo-target ${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (token) {
      await resetTestDataViaApi(token);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-6: Photo upload flow
  // ───────────────────────────────────────────────────────────────────────────
  test('uploads a photo to a work order via the detail page', async ({
    page,
    authenticatedUser,
    workOrderDetailPage,
  }) => {
    expect(authenticatedUser.email).toBe('claude@claude.com');

    // Register S3 PUT mock BEFORE the upload click. The presigned URL points
    // at a real *.amazonaws.com host; we intercept and return 200 so the
    // chain progresses to the confirm step.
    await page.route('**/*.amazonaws.com/**', (route) =>
      route.fulfill({ status: 200 }),
    );

    await workOrderDetailPage.gotoWorkOrder(seedWO.id);

    // Empty state should be visible initially.
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();

    // Open the upload zone via the empty-state CTA.
    await workOrderDetailPage.clickAddPhoto();

    // Upload an in-memory JPEG. The component fires the upload pipeline on
    // file selection (no submit needed).
    await workOrderDetailPage.uploadPhoto(
      Buffer.from('fake-jpeg-bytes'),
      'wo-test.jpg',
      'image/jpeg',
    );

    // Snackbar verbatim from the photo store (work-order-photo.store.ts:198).
    // Note the check-mark glyph.
    await workOrderDetailPage.expectSnackBar('Photo added ✓', 10000);

    // Photo grid should now contain at least one card.
    await expect(page.locator('[data-testid="photo-grid"]')).toBeVisible();
    await expect(workOrderDetailPage.photoCards.first()).toBeVisible();
  });
});
