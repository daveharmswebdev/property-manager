import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, take, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard for protecting routes that require authentication (AC4.5).
 *
 * Checks if user is authenticated:
 * - If authenticated, allows access
 * - If not authenticated, attempts token refresh (for page refresh persistence)
 * - If refresh fails, redirects to login with return URL
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated, allow access
  if (authService.isAuthenticated()) {
    return true;
  }

  // Not authenticated - try to refresh token (handles page refresh scenario)
  return authService.initializeAuth().pipe(
    take(1),
    map(response => {
      if (response) {
        // Refresh succeeded - user is now authenticated
        return true;
      }
      // Refresh failed - redirect to login
      return createLoginRedirect(router, state.url);
    }),
    catchError(() => {
      // Error during refresh - redirect to login
      return of(createLoginRedirect(router, state.url));
    })
  );
};

/**
 * Create redirect URL to login page with return URL.
 */
function createLoginRedirect(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl }
  });
}

/**
 * Guest Guard for routes that should only be accessible to unauthenticated users.
 * (e.g., login and register pages)
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If authenticated, redirect to dashboard
  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
