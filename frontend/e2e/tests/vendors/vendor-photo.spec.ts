import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Vendor Photo E2E Tests
 *
 * Tests the vendor photo functionality visible in the UI:
 * - Photos section visibility on vendor detail page
 * - Upload zone structure (drag-drop area)
 * - Person icon on vendor list when no photo exists
 * - Thumbnail display on vendor list when photo exists (mocked)
 * - Photo gallery rendering with mocked photo data
 *
 * Uses a single vendor created via API in beforeAll and shared across tests.
 * Tests that need specific data shapes use page.route() to mock API responses.
 */
test.describe('Vendor Photo E2E Tests', () => {
  let vendorId: string;
  let vendorFullName: string;

  test.beforeAll(async () => {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5292';

    // Login via API to get JWT (avoids browser-based rate limit)
    const loginResponse = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'claude@claude.com',
        password: '1@mClaude',
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const { accessToken } = await loginResponse.json();

    // Create vendor via API
    const timestamp = Date.now();
    const firstName = `VPhoto${timestamp}`;
    const lastName = 'Test';
    vendorFullName = `${firstName} ${lastName}`;

    const createResponse = await fetch(`${apiBaseUrl}/api/v1/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ firstName, lastName }),
    });

    if (!createResponse.ok) {
      throw new Error(`Vendor creation failed: ${createResponse.status}`);
    }

    const vendor = await createResponse.json();
    vendorId = vendor.id;
  });

  test('should show Photos section and upload zone on vendor detail page', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    await vendorPage.gotoDetail(vendorId);
    await vendorPage.expectDetailPageVisible();

    // Photos section should be visible
    await vendorPage.expectDetailPhotosSectionVisible();

    // Upload zone should be visible with expected text
    await vendorPage.expectPhotoUploadZoneVisible();
    await vendorPage.expectUploadZoneText('Drag & drop photos here');

    // The drop zone serves as the "Add Photo" trigger
    const dropZone = vendorPage.addPhotoButton;
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toContainText('click to browse');
  });

  test('should show person icon for vendor without photo in list', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    await vendorPage.goto();
    await vendorPage.expectVendorInList(vendorFullName);
    await vendorPage.expectVendorShowsPersonIcon(vendorFullName);
  });

  test('should show thumbnail when vendor has photo (mocked)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Intercept vendors API to inject a primaryPhotoThumbnailUrl
    await page.route('*/**/api/v1/vendors', async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      if (json.items) {
        json.items = json.items.map((v: any) => {
          if (v.id === vendorId) {
            return {
              ...v,
              primaryPhotoThumbnailUrl: 'https://via.placeholder.com/36x36.png',
            };
          }
          return v;
        });
      }

      await route.fulfill({ response, json });
    });

    await vendorPage.goto();
    await vendorPage.expectVendorInList(vendorFullName);
    await vendorPage.expectVendorShowsThumbnail(vendorFullName);
  });

  test('should show photos in gallery when photos exist (mocked)', async ({
    page,
    authenticatedUser,
    vendorPage,
  }) => {
    // Intercept vendor photos API to return mock photos BEFORE navigating
    // Response shape must match GetVendorPhotosResponse: { items: VendorPhotoDto[] }
    await page.route(`*/**/api/v1/vendors/${vendorId}/photos`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'mock-photo-1',
              thumbnailUrl: 'https://via.placeholder.com/150x150.png',
              viewUrl: 'https://via.placeholder.com/800x600.png',
              isPrimary: true,
              displayOrder: 0,
              originalFileName: 'test-photo-1.jpg',
              fileSizeBytes: 12345,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'mock-photo-2',
              thumbnailUrl: 'https://via.placeholder.com/150x150.png',
              viewUrl: 'https://via.placeholder.com/800x600.png',
              isPrimary: false,
              displayOrder: 1,
              originalFileName: 'test-photo-2.jpg',
              fileSizeBytes: 23456,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await vendorPage.gotoDetail(vendorId);

    // Photo gallery component should be rendered with mocked photos
    await vendorPage.expectPhotoGalleryVisible();
  });
});
