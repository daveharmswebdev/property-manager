import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { notTenantGuard } from './not-tenant.guard';
import { AuthService, User } from '../services/auth.service';

describe('notTenantGuard (Story 20.11, AC #15)', () => {
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

  it('allows Owner through (returns true)', () => {
    currentUserSignal.set(createUser('Owner'));
    TestBed.runInInjectionContext(() => {
      expect(notTenantGuard(null as any, { url: '/dashboard' } as any)).toBe(true);
    });
  });

  it('allows Contributor through (returns true)', () => {
    currentUserSignal.set(createUser('Contributor'));
    TestBed.runInInjectionContext(() => {
      expect(notTenantGuard(null as any, { url: '/dashboard' } as any)).toBe(true);
    });
  });

  it('redirects Tenant to /tenant', () => {
    currentUserSignal.set(createUser('Tenant'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = notTenantGuard(null as any, { url: '/dashboard' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
    });
  });

  it('redirects null user to /login (defense-in-depth)', () => {
    currentUserSignal.set(null);
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = notTenantGuard(null as any, { url: '/dashboard' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    });
  });

  // Story 20.11, AC #15 (post-evaluate fix 2026-05-19): These URLs are wired to
  // `notTenantGuard` in `app.routes.ts`. Tests live here (not in `owner.guard.spec.ts`)
  // so they exercise the ACTUAL guard the route uses. If a future regression swaps a
  // route from `notTenantGuard` to no guard, the route-wiring assertion in
  // `app.routes.ts` would still need a higher-level check, but these tests at least
  // prove the wired guard does the right thing.
  describe('Tenant role sweep across notTenantGuard-wired landlord routes (Story 20.11, AC #15)', () => {
    const notTenantRoutes: readonly string[] = [
      '/dashboard',
      '/work-orders',
      '/work-orders/abc123',
      '/receipts',
    ];

    it.each(notTenantRoutes)('redirects Tenant from %s to /tenant', (url) => {
      currentUserSignal.set(createUser('Tenant'));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      TestBed.runInInjectionContext(() => {
        const result = notTenantGuard(null as any, { url } as any);
        expect(result).toBe(mockUrlTree);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
      });
    });
  });
});
