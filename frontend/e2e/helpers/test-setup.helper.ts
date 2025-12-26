import { type Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { PropertyFormPage } from '../pages/property-form.page';
import { TestDataHelper, type TestProperty } from './test-data.helper';

export interface PropertySetupResult {
  propertyId: string;
  propertyData: TestProperty;
}

/**
 * Shared helper for E2E tests that need a property created.
 * Creates a property and returns its ID and data.
 *
 * Usage:
 * ```typescript
 * const { propertyId, propertyData } = await createPropertyAndGetId(
 *   dashboardPage,
 *   propertyFormPage,
 *   page
 * );
 * ```
 */
export async function createPropertyAndGetId(
  dashboardPage: DashboardPage,
  propertyFormPage: PropertyFormPage,
  page: Page
): Promise<PropertySetupResult> {
  const testProperty = TestDataHelper.generateProperty();

  await dashboardPage.goto();
  await dashboardPage.clickAddProperty();
  await propertyFormPage.fillForm(testProperty);
  await propertyFormPage.submit();

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Click on property to get to detail page and extract ID
  await dashboardPage.clickProperty(testProperty.name);
  await page.waitForURL(/\/properties\/[a-f0-9-]+$/);
  const url = page.url();
  const propertyId = url.split('/properties/')[1];

  return { propertyId, propertyData: testProperty };
}
