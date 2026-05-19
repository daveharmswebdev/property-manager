import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Not-Tenant Guard (Story 20.11, AC #15)
 *
 * Allows any authenticated NON-Tenant role through; redirects Tenant to /tenant.
 *
 * Used on routes that are shared between Owner and Contributor (e.g., `/dashboard`)
 * where `ownerGuard` is too strict (it would push Contributor away too) but where
 * a Tenant must NEVER mount the landlord component. Tenants are routed to their
 * own dashboard at /tenant.
 *
 * Runs inside the Shell which already has `authGuard`, so by the time this fires
 * the user is guaranteed to be authenticated. The null-user branch is a
 * defense-in-depth fallback.
 */
export const notTenantGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.role === 'Tenant') {
    return router.createUrlTree(['/tenant']);
  }

  // Authenticated non-Tenant (Owner/Contributor/other) — allow through.
  // Null user (shouldn't happen because authGuard runs first) falls back to /login.
  if (!user) {
    return router.createUrlTree(['/login']);
  }

  return true;
};
