import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { platformAdminGuard } from './platform-admin.guard';
import { AuthService, User } from '../services/auth.service';

describe('platformAdminGuard', () => {
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let mockRouter: Partial<Router>;

  function createUser(role: string, isPlatformAdmin: boolean): User {
    return {
      userId: 'test-user-id',
      accountId: 'test-account-id',
      role,
      email: 'test@example.com',
      displayName: 'Test User',
      propertyId: null,
      isPlatformAdmin,
    };
  }

  beforeEach(() => {
    currentUserSignal = signal<User | null>(createUser('Owner', true));

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

  it('should allow access when isPlatformAdmin is true (AC: #7)', () => {
    currentUserSignal.set(createUser('Owner', true));

    TestBed.runInInjectionContext(() => {
      const result = platformAdminGuard(null as any, { url: '/admin' } as any);
      expect(result).toBe(true);
    });
  });

  it('should redirect Owner-without-claim to /dashboard (AC: #7)', () => {
    currentUserSignal.set(createUser('Owner', false));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = platformAdminGuard(null as any, { url: '/admin' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  it('should redirect Contributor to /dashboard (AC: #7)', () => {
    currentUserSignal.set(createUser('Contributor', false));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = platformAdminGuard(null as any, { url: '/admin' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  it('should redirect Tenant to /tenant (AC: #7)', () => {
    currentUserSignal.set(createUser('Tenant', false));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = platformAdminGuard(null as any, { url: '/admin' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
    });
  });

  it('should redirect null user to /dashboard (AC: #7)', () => {
    currentUserSignal.set(null);
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = platformAdminGuard(null as any, { url: '/admin' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
