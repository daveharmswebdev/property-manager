import { InjectionToken } from '@angular/core';

/**
 * Injection token for the API base URL.
 *
 * This token is defined here (not in api.service.ts) to enable tree-shaking:
 * app.config.ts can import just the token without pulling in the entire 256KB
 * NSwag-generated API client.
 *
 * The api.service.ts is patched after generation to import from this file
 * via scripts/patch-api-service.js (run automatically by `npm run generate-api`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
