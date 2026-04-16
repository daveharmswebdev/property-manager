import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Permission Service (Story 19.5)
 *
 * Role-based permission checks derived from JWT auth state.
 * Uses computed signals for reactive UI updates.
 * The backend enforces granular permissions; this service
 * provides UX-appropriate visibility filtering.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authService = inject(AuthService);

  /** True if the current user has the Owner role */
  readonly isOwner = computed(() => this.authService.currentUser()?.role === 'Owner');

  /** True if the current user has the Contributor role */
  readonly isContributor = computed(() => this.authService.currentUser()?.role === 'Contributor');

  /** True if the current user has the Tenant role */
  readonly isTenant = computed(() => this.authService.currentUser()?.role === 'Tenant');

  /**
   * Check if the current user's role allows access to the given route path.
   * Owners can access all routes. Contributors can only access a subset.
   * Tenants can only access tenant routes (populated in Story 20.5).
   */
  canAccess(route: string): boolean {
    if (this.isOwner()) return true;
    if (!this.authService.currentUser()) return false;

    // Tenant-accessible routes (Story 20.5)
    if (this.isTenant()) {
      const tenantRoutes: string[] = ['/tenant'];
      return tenantRoutes.some((r) => route === r || route.startsWith(r + '/'));
    }

    // Contributor-accessible routes
    const contributorRoutes = ['/dashboard', '/receipts', '/work-orders'];
    return contributorRoutes.some((r) => route === r || route.startsWith(r + '/'));
  }
}
