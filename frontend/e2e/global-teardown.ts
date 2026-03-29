import type { FullConfig } from '@playwright/test';

/**
 * Playwright global teardown — runs after all E2E tests complete.
 *
 * Authenticates as the test user and calls the test reset endpoint
 * to clean up all data created during the test run.
 */
async function globalTeardown(config: FullConfig) {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5292';

  try {
    // 1. Authenticate to get JWT
    const loginResponse = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'claude@claude.com',
        password: '1@mClaude',
      }),
    });

    if (!loginResponse.ok) {
      console.warn(`[global-teardown] Login failed: ${loginResponse.status}`);
      return;
    }

    const { accessToken } = await loginResponse.json();

    // 2. Call reset endpoint
    const resetResponse = await fetch(`${apiBaseUrl}/api/v1/test/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resetResponse.ok) {
      const result = await resetResponse.json();
      console.log(`[global-teardown] Reset complete: ${result.totalDeleted} entities deleted`);
    } else {
      console.warn(`[global-teardown] Reset failed: ${resetResponse.status}`);
    }
  } catch (error) {
    // Don't fail the test suite if teardown fails — just warn
    console.warn(`[global-teardown] Error during teardown:`, error);
  }
}

export default globalTeardown;
