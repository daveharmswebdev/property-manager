import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { ownerGuard } from './owner.guard';
import { AuthService, User } from '../services/auth.service';

describe('ownerGuard', () => {
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let mockRouter: Partial<Router>;

  function createUser(role: string): User {
    return {
      userId: 'test-user-id',
      accountId: 'test-account-id',
      role,
      email: 'test@example.com',
      displayName: 'Test User',
      propertyId: null,
    };
  }

  beforeEach(() => {
    currentUserSignal = signal<User | null>(createUser('Owner'));

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow access for Owner role', () => {
    currentUserSignal.set(createUser('Owner'));

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/expenses' } as any);
      expect(result).toBe(true);
    });
  });

  it('should redirect Contributor to /dashboard', () => {
    currentUserSignal.set(createUser('Contributor'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/expenses' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  // Task 16.3: ownerGuard redirects Tenant to /tenant (Story 20.5, AC #6)
  it('should redirect Tenant to /tenant', () => {
    currentUserSignal.set(createUser('Tenant'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/expenses' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
    });
  });

  // Story 20.7, AC #11: Tenant accessing /maintenance-requests redirects to /tenant
  it('should redirect Tenant accessing /maintenance-requests to /tenant', () => {
    currentUserSignal.set(createUser('Tenant'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/maintenance-requests' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
    });
  });

  it('should redirect null user to /dashboard', () => {
    currentUserSignal.set(null);
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/expenses' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  it('should redirect unknown role to /dashboard', () => {
    currentUserSignal.set(createUser('Unknown'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = ownerGuard(null as any, { url: '/settings' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  // Story 20.11, AC #15: Tenant attempting to navigate to any ownerGuard-wired landlord route
  // is redirected to /tenant. Only URLs whose routes use `ownerGuard` in `app.routes.ts` are
  // included here — routes wired to `notTenantGuard` (e.g. /dashboard, /work-orders,
  // /work-orders/:id, /receipts) live in `not-tenant.guard.spec.ts` so the test exercises the
  // ACTUAL guard the route is wired to (post-evaluate fix 2026-05-19).
  describe('Tenant role sweep across ownerGuard-wired landlord routes (Story 20.11, AC #15)', () => {
    const landlordRoutes: readonly string[] = [
      '/properties',
      '/properties/abc123',
      '/expenses',
      '/expenses/abc123',
      '/income',
      '/income/abc123',
      '/reports',
      '/vendors',
      '/vendors/abc123',
      '/work-orders/abc123/edit',
      '/maintenance-requests',
      '/maintenance-requests/abc123',
      '/settings',
      '/settings/users',
    ];

    it.each(landlordRoutes)('redirects Tenant from %s to /tenant', (url) => {
      currentUserSignal.set(createUser('Tenant'));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      TestBed.runInInjectionContext(() => {
        const result = ownerGuard(null as any, { url } as any);
        expect(result).toBe(mockUrlTree);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
      });
    });
  });
});
