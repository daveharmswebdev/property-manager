import { InjectionToken } from '@angular/core';

/**
 * Injection token for the API base URL.
 * Separated from api.service.ts to avoid pulling the entire NSwag client into the initial bundle.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
