import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { of, throwError, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login.component';
import { AuthService, User } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: {
    login: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof signal<User | null>>;
  };
  let router: Router;

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn(),
      currentUser: signal<User | null>(null),
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
      emailControl?.markAsTouched();
      fixture.detectChanges();
      expect(emailControl?.hasError('required')).toBe(true);
      const requiredErrors = fixture.debugElement.queryAll(By.css('mat-error'));
      const requiredError = requiredErrors.find((el) =>
        el.nativeElement.textContent.includes('Email is required'),
      );
      expect(requiredError).toBeTruthy();

      emailControl?.setValue('invalid-email');
      fixture.detectChanges();
      expect(emailControl?.hasError('email')).toBe(true);
      const emailErrors = fixture.debugElement.queryAll(By.css('mat-error'));
      const emailError = emailErrors.find((el) =>
        el.nativeElement.textContent.includes('Please enter a valid email address'),
      );
      expect(emailError).toBeTruthy();

      emailControl?.setValue('valid@email.com');
      expect(emailControl?.valid).toBe(true);
    });

    it('should have password field with required validator', () => {
      const passwordControl = component['form'].get('password');
      expect(passwordControl).toBeTruthy();

      passwordControl?.setValue('');
      passwordControl?.markAsTouched();
      fixture.detectChanges();
      expect(passwordControl?.hasError('required')).toBe(true);
      const errors = fixture.debugElement.queryAll(By.css('mat-error'));
      const passwordError = errors.find((el) =>
        el.nativeElement.textContent.includes('Password is required'),
      );
      expect(passwordError).toBeTruthy();

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

  // ---------------------------------------------------------------------------
  // AC1: Stricter email validation (GitHub #198)
  // ---------------------------------------------------------------------------
  describe('email pattern validation', () => {
    it('should reject email without TLD (user@g) with pattern error', () => {
      const emailControl = component['form'].get('email');
      emailControl?.setValue('user@g');
      emailControl?.markAsTouched();
      fixture.detectChanges();

      expect(emailControl?.hasError('pattern')).toBe(true);
      expect(emailControl?.valid).toBe(false);

      const errors = fixture.debugElement.queryAll(By.css('mat-error'));
      const patternError = errors.find((el) =>
        el.nativeElement.textContent.includes('Please enter a valid email address'),
      );
      expect(patternError).toBeTruthy();
    });

    it('should reject email with single-char TLD (user@domain.c) with pattern error', () => {
      const emailControl = component['form'].get('email');
      emailControl?.setValue('user@domain.c');
      emailControl?.markAsTouched();
      fixture.detectChanges();

      expect(emailControl?.hasError('pattern')).toBe(true);

      const errors = fixture.debugElement.queryAll(By.css('mat-error'));
      const patternError = errors.find((el) =>
        el.nativeElement.textContent.includes('Please enter a valid email address'),
      );
      expect(patternError).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // AC3: Honor returnUrl after login (GitHub #200)
  // Uses separate TestBed configurations per returnUrl scenario.
  // ---------------------------------------------------------------------------
  describe('returnUrl redirect', () => {
    async function setupWithReturnUrl(returnUrl: string | null) {
      TestBed.resetTestingModule();

      const authService = { login: vi.fn(), currentUser: signal<User | null>(null) };

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
      const ctx = await setupWithReturnUrl(null);
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to /dashboard when returnUrl is absolute external URL', async () => {
      const ctx = await setupWithReturnUrl('https://evil.com');
      ctx.authService.login.mockReturnValue(of({}));

      ctx.component['form'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to /dashboard when returnUrl is protocol-relative', async () => {
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

  // Task 17: LoginComponent tenant redirect (Story 20.5, AC #1, #7)
  describe('role-based redirect after login', () => {
    async function setupWithRoleAndReturnUrl(role: string, returnUrl: string | null) {
      TestBed.resetTestingModule();

      const mockUser: User = {
        userId: 'test-user-id',
        accountId: 'test-account-id',
        role,
        email: 'test@example.com',
        displayName: 'Test User',
        propertyId: role === 'Tenant' ? 'prop-1' : null,
      };

      const currentUserSignal = signal<User | null>(null);
      // Login observable that sets the currentUser signal before emitting
      const loginObservable = new Subject<object>();
      const authService = {
        login: vi.fn().mockImplementation(() => {
          // Set currentUser before the subscriber gets the response
          currentUserSignal.set(mockUser);
          return of({ accessToken: 'token', expiresIn: 3600 });
        }),
        currentUser: currentUserSignal,
      };

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

    // Task 17.1: Tenant user redirected to /tenant after login (no returnUrl)
    it('should redirect Tenant to /tenant after login when no returnUrl', async () => {
      const ctx = await setupWithRoleAndReturnUrl('Tenant', null);

      ctx.component['form'].patchValue({
        email: 'tenant@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/tenant');
    });

    // Task 17.2: Owner user redirected to /dashboard after login (regression check)
    it('should redirect Owner to /dashboard after login when no returnUrl', async () => {
      const ctx = await setupWithRoleAndReturnUrl('Owner', null);

      ctx.component['form'].patchValue({
        email: 'owner@example.com',
        password: 'password123',
      });
      ctx.component['onSubmit']();

      expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });
});
