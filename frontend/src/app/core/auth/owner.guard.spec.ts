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
});
