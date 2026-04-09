import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Owner Guard (Story 19.5, AC: #3, #7)
 *
 * Route guard for Owner-only routes. Runs on child routes inside the Shell,
 * which already has authGuard — so by the time ownerGuard runs, the user
 * is guaranteed to be authenticated.
 *
 * - Owner role: allows access
 * - Contributor or unknown role: redirects to /dashboard
 */
export const ownerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.role === 'Owner') {
    return true;
  }

  // Contributor or unknown role — redirect to dashboard
  return router.createUrlTree(['/dashboard']);
};
