import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Tenant Guard (Story 20.5, AC #1, #6)
 *
 * Route guard for Tenant-only routes. Runs on child routes inside the Shell,
 * which already has authGuard — so by the time tenantGuard runs, the user
 * is guaranteed to be authenticated.
 *
 * - Tenant role: allows access
 * - Other roles: redirects to /dashboard
 */
export const tenantGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.role === 'Tenant') {
    return true;
  }

  // Non-tenant role — redirect to landlord dashboard
  return router.createUrlTree(['/dashboard']);
};
