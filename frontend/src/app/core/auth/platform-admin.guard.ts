import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Platform Admin Guard (Story 22.4, AC: #7)
 *
 * Route guard for PlatformAdmin-only routes (the /admin console). Runs on child
 * routes inside the Shell, which already applies authGuard — so by the time this
 * runs, the user is guaranteed to be authenticated.
 *
 * PlatformAdmin is a claim, orthogonal to role (Story 22.1): a user can be both
 * Owner and PlatformAdmin. This guard keys ONLY on the claim, not on role.
 *
 * - PlatformAdmin claim present: allows access
 * - Tenant: redirects to /tenant
 * - Everyone else (Owner/Contributor without the claim): redirects to /dashboard
 */
export const platformAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.isPlatformAdmin === true) {
    return true;
  }

  if (user?.role === 'Tenant') {
    return router.createUrlTree(['/tenant']);
  }

  return router.createUrlTree(['/dashboard']);
};
