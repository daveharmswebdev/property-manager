import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { tenantGuard } from './tenant.guard';
import { AuthService, User } from '../services/auth.service';

describe('tenantGuard', () => {
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let mockRouter: Partial<Router>;

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
    currentUserSignal = signal<User | null>(createUser('Tenant'));

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

  // Task 16.1: tenantGuard allows Tenant role
  it('should allow access for Tenant role', () => {
    currentUserSignal.set(createUser('Tenant'));

    TestBed.runInInjectionContext(() => {
      const result = tenantGuard(null as any, { url: '/tenant' } as any);
      expect(result).toBe(true);
    });
  });

  // Task 16.2: tenantGuard redirects non-Tenant to /dashboard
  it('should redirect Owner to /dashboard', () => {
    currentUserSignal.set(createUser('Owner'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = tenantGuard(null as any, { url: '/tenant' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  it('should redirect Contributor to /dashboard', () => {
    currentUserSignal.set(createUser('Contributor'));
    const mockUrlTree = {} as UrlTree;
    vi.mocked(mockRouter.createUrlTree!).mockReturnValue(mockUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = tenantGuard(null as any, { url: '/tenant' } as any);
      expect(result).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
