import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { authGuard, guestGuard, publicGuard } from './auth.guard';
import { AuthService, LoginResponse, User } from '../services/auth.service';

describe('Auth Guards', () => {
  let mockAuthService: Partial<AuthService>;
  let mockRouter: Partial<Router>;
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let isInitializingSignal: ReturnType<typeof signal<boolean>>;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;

  function createUser(role: string): User {
    return {
      userId: 'test-user-id',
      accountId: 'test-account-id',
      role,
      email: 'test@example.com',
      displayName: 'Test User',
      propertyId: role === 'Tenant' ? 'prop-1' : null,
    };
  }

  beforeEach(() => {
    isAuthenticatedSignal = signal(false);
    isInitializingSignal = signal(false);
    currentUserSignal = signal<User | null>(null);

    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
      isInitializing: isInitializingSignal,
      initializeAuth: vi.fn(),
      currentUser: currentUserSignal,
    };
    mockRouter = {
      createUrlTree: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  describe('authGuard', () => {
    it('should allow access if user is already authenticated', () => {
      isAuthenticatedSignal.set(true);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(null as any, { url: '/dashboard' } as any);
        expect(result).toBe(true);
      });
    });

    it('should allow access if token refresh succeeds', async () => {
      isAuthenticatedSignal.set(false);
      const mockResponse: LoginResponse = { accessToken: 'token', expiresIn: 3600 };
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(of(mockResponse));

      await TestBed.runInInjectionContext(async () => {
        const result$ = authGuard(null as any, { url: '/dashboard' } as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(true);
              expect(mockAuthService.initializeAuth).toHaveBeenCalled();
              resolve();
            });
          });
        }
      });
    });

    it('should redirect to login if token refresh fails', async () => {
      isAuthenticatedSignal.set(false);
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(of(null));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      await TestBed.runInInjectionContext(async () => {
        const result$ = authGuard(null as any, { url: '/protected' } as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(mockUrlTree);
              expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
                queryParams: { returnUrl: '/protected' }
              });
              resolve();
            });
          });
        }
      });
    });

    it('should redirect to login if token refresh throws error', async () => {
      isAuthenticatedSignal.set(false);
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(throwError(() => new Error('Network error')));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      await TestBed.runInInjectionContext(async () => {
        const result$ = authGuard(null as any, { url: '/protected' } as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(mockUrlTree);
              expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
                queryParams: { returnUrl: '/protected' }
              });
              resolve();
            });
          });
        }
      });
    });
  });

  describe('guestGuard', () => {
    it('should redirect to dashboard if user is already authenticated (Owner)', () => {
      isAuthenticatedSignal.set(true);
      currentUserSignal.set(createUser('Owner'));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      TestBed.runInInjectionContext(() => {
        const result = guestGuard(null as any, null as any);
        expect(result).toBe(mockUrlTree);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
      });
    });

    // Task 16.4: guestGuard redirects authenticated Tenant to /tenant (Story 20.5)
    it('should redirect to /tenant if user is already authenticated Tenant', () => {
      isAuthenticatedSignal.set(true);
      currentUserSignal.set(createUser('Tenant'));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      TestBed.runInInjectionContext(() => {
        const result = guestGuard(null as any, null as any);
        expect(result).toBe(mockUrlTree);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tenant']);
      });
    });

    it('should allow access if user is not authenticated and not initializing', () => {
      isAuthenticatedSignal.set(false);
      isInitializingSignal.set(false);

      TestBed.runInInjectionContext(() => {
        const result = guestGuard(null as any, null as any);
        expect(result).toBe(true);
      });
    });

    it('should redirect to dashboard if initialization succeeds', async () => {
      isAuthenticatedSignal.set(false);
      isInitializingSignal.set(true);
      const mockResponse: LoginResponse = { accessToken: 'token', expiresIn: 3600 };
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(of(mockResponse));
      const mockUrlTree = {} as UrlTree;
      vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

      await TestBed.runInInjectionContext(async () => {
        const result$ = guestGuard(null as any, null as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(mockUrlTree);
              expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
              resolve();
            });
          });
        }
      });
    });

    it('should allow access if initialization fails', async () => {
      isAuthenticatedSignal.set(false);
      isInitializingSignal.set(true);
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(of(null));

      await TestBed.runInInjectionContext(async () => {
        const result$ = guestGuard(null as any, null as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(true);
              resolve();
            });
          });
        }
      });
    });

    it('should allow access if initialization throws error', async () => {
      isAuthenticatedSignal.set(false);
      isInitializingSignal.set(true);
      vi.mocked(mockAuthService.initializeAuth!).mockReturnValue(throwError(() => new Error('Network error')));

      await TestBed.runInInjectionContext(async () => {
        const result$ = guestGuard(null as any, null as any);

        if (typeof result$ === 'object' && 'subscribe' in result$) {
          return new Promise<void>(resolve => {
            result$.subscribe(result => {
              expect(result).toBe(true);
              resolve();
            });
          });
        }
      });
    });
  });

  describe('publicGuard', () => {
    it('should always allow access regardless of authentication state - authenticated', () => {
      isAuthenticatedSignal.set(true);

      TestBed.runInInjectionContext(() => {
        const result = publicGuard(null as any, null as any);
        expect(result).toBe(true);
      });
    });

    it('should always allow access regardless of authentication state - unauthenticated', () => {
      isAuthenticatedSignal.set(false);

      TestBed.runInInjectionContext(() => {
        const result = publicGuard(null as any, null as any);
        expect(result).toBe(true);
      });
    });

    it('should always allow access even when initializing', () => {
      isInitializingSignal.set(true);

      TestBed.runInInjectionContext(() => {
        const result = publicGuard(null as any, null as any);
        expect(result).toBe(true);
      });
    });

    it('should not depend on auth service state', () => {
      // Set various auth states
      isAuthenticatedSignal.set(true);
      isInitializingSignal.set(true);

      TestBed.runInInjectionContext(() => {
        const result = publicGuard(null as any, null as any);
        // Public guard always allows access
        expect(result).toBe(true);
        // Should not call initializeAuth
        expect(mockAuthService.initializeAuth).not.toHaveBeenCalled();
      });
    });
  });
});
