import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: {
    login: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should have email field with required and email validators', () => {
      const emailControl = component['form'].get('email');
      expect(emailControl).toBeTruthy();

      emailControl?.setValue('');
      expect(emailControl?.hasError('required')).toBe(true);

      emailControl?.setValue('invalid-email');
      expect(emailControl?.hasError('email')).toBe(true);

      emailControl?.setValue('valid@email.com');
      expect(emailControl?.valid).toBe(true);
    });

    it('should have password field with required validator', () => {
      const passwordControl = component['form'].get('password');
      expect(passwordControl).toBeTruthy();

      passwordControl?.setValue('');
      expect(passwordControl?.hasError('required')).toBe(true);

      passwordControl?.setValue('anypassword');
      expect(passwordControl?.valid).toBe(true);
    });

  });

  describe('form validation', () => {
    it('should not call authService when form is invalid', () => {
      component['form'].setValue({
        email: '',
        password: '',
      });

      component['onSubmit']();

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when submitting invalid form', () => {
      component['onSubmit']();

      expect(component['form'].get('email')?.touched).toBe(true);
      expect(component['form'].get('password')?.touched).toBe(true);
    });
  });

  describe('successful login', () => {
    it('should call authService.login with email and password', () => {
      mockAuthService.login.mockReturnValue(of({}));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component['onSubmit']();

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should set loading to true during login', () => {
      const loginSubject = new Subject<object>();
      mockAuthService.login.mockReturnValue(loginSubject.asObservable());

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component['onSubmit']();

      // Loading should be true while waiting
      expect(component['loading']()).toBe(true);

      // Complete the request
      loginSubject.next({});
      loginSubject.complete();

      expect(component['loading']()).toBe(false);
    });

    it('should navigate to dashboard on successful login', () => {
      mockAuthService.login.mockReturnValue(of({}));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component['onSubmit']();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('should clear server error on successful login', () => {
      mockAuthService.login.mockReturnValue(of({}));

      // Set an initial error
      component['serverError'].set('Previous error');

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBeNull();
    });
  });

  describe('login errors', () => {
    it('should display authentication error on 401 response', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        error: { detail: 'Invalid email or password' },
      });
      mockAuthService.login.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Invalid email or password');
      expect(component['loading']()).toBe(false);
    });

    it('should display default auth error message when 401 has no detail', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        error: {},
      });
      mockAuthService.login.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Invalid email or password');
    });

    it('should display validation error on 400 response', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: { detail: 'Email is required' },
      });
      mockAuthService.login.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Email is required');
    });

    it('should display generic error on unexpected error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 500,
        error: {},
      });
      mockAuthService.login.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('An unexpected error occurred. Please try again.');
    });

    it('should set loading to false after error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        error: {},
      });
      mockAuthService.login.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password',
      });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });
  });

  describe('password visibility', () => {
    it('should start with password hidden', () => {
      expect(component['hidePassword']()).toBe(true);
    });
  });
});

// =============================================================================
// ATDD Tests — Story 15-1: Login Form Fixes (RED Phase)
//
// These tests describe the FINAL expected behavior after all ACs are implemented.
// They MUST all fail before implementation and pass after.
// Run with: npm test (from /frontend) — NEVER use npx vitest directly.
// =============================================================================

describe('Story 15-1: Login Form Fixes (ATDD)', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: { login: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    mockAuthService = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---------------------------------------------------------------------------
  // AC1: Stricter email validation (GitHub #198)
  // ---------------------------------------------------------------------------
  describe('AC1: Stricter email validation', () => {
    it('should reject email without TLD (user@g) with pattern error', () => {
      // AC-1: email without TLD should trigger pattern validator
      const emailControl = component['form'].get('email');
      emailControl?.setValue('user@g');

      expect(emailControl?.hasError('pattern')).toBe(true);
      expect(emailControl?.valid).toBe(false);
    });

    it('should reject email with single-char TLD (user@domain.c) with pattern error', () => {
      // AC-1: edge case — single character after dot is not a valid TLD
      const emailControl = component['form'].get('email');
      emailControl?.setValue('user@domain.c');

      // Angular built-in email validator allows this, but pattern should catch it
      // Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ requires 2+ chars after dot
      expect(emailControl?.hasError('pattern')).toBe(true);
    });

    it('should accept valid email with proper TLD (user@domain.com)', () => {
      // AC-1: valid email should pass all validators
      const emailControl = component['form'].get('email');
      emailControl?.setValue('user@domain.com');

      expect(emailControl?.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AC2: Remove "Remember me" checkbox (GitHub #199)
  // ---------------------------------------------------------------------------
  describe('AC2: No Remember Me checkbox', () => {
    it('should not have rememberMe form control', () => {
      // AC-2: rememberMe control must be completely removed from form group
      expect(component['form'].get('rememberMe')).toBeNull();
    });

    it('should have only email and password controls', () => {
      // AC-2: verify form shape after rememberMe removal
      const controlNames = Object.keys(component['form'].controls);
      expect(controlNames).toEqual(['email', 'password']);
    });
  });

  // ---------------------------------------------------------------------------
  // AC3: Honor returnUrl after login (GitHub #200)
  // Uses separate TestBed configurations per returnUrl scenario.
  // ---------------------------------------------------------------------------
  describe('AC3: Honor returnUrl after login', () => {
    /**
     * Helper: creates LoginComponent with a specific returnUrl query param.
     * Uses patchValue to set form values (works with both 2-control and 3-control form shapes).
     */
    async function setupWithReturnUrl(returnUrl: string | null) {
      TestBed.resetTestingModule();

      const authService = { login: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [LoginComponent],
        providers: [
          provideNoopAnimations(),
          provideRouter([]),
          { provide: AuthService, useValue: authService },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                queryParamMap: {
                  get: (key: string) => (key === 'returnUrl' ? returnUrl : null),
                },
              },
            },
          },
        ],
      }).compileComponents();

      const testRouter = TestBed.inject(Router);
      vi.spyOn(testRouter, 'navigate').mockImplementation(() => Promise.resolve(true));
      vi.spyOn(testRouter, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

      const testFixture = TestBed.createComponent(LoginComponent);
      const testComponent = testFixture.componentInstance;
      testFixture.detectChanges();

      return { component: testComponent, router: testRouter, authService };
    }

    it('should navigate to /properties when returnUrl is /properties', async () => {
      // AC-3: valid relative returnUrl should be honored
      const ctx = await setupWithReturnUrl('/properties');
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/properties');
    });

    it('should navigate to /dashboard when returnUrl is absent', async () => {
      // AC-3: no returnUrl defaults to /dashboard
      const ctx = await setupWithReturnUrl(null);
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to /dashboard when returnUrl is absolute external URL (open redirect protection)', async () => {
      // AC-3: SECURITY — absolute URL must be rejected to prevent open redirect
      const ctx = await setupWithReturnUrl('https://evil.com');
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to /dashboard when returnUrl is protocol-relative (open redirect protection)', async () => {
      // AC-3: SECURITY — protocol-relative URL must be rejected
      const ctx = await setupWithReturnUrl('//evil.com');
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });
});
