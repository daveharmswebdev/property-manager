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

    it('should have rememberMe field defaulting to false', () => {
      const rememberMeControl = component['form'].get('rememberMe');
      expect(rememberMeControl?.value).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should not call authService when form is invalid', () => {
      component['form'].setValue({
        email: '',
        password: '',
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
      });

      component['onSubmit']();

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should clear server error on successful login', () => {
      mockAuthService.login.mockReturnValue(of({}));

      // Set an initial error
      component['serverError'].set('Previous error');

      component['form'].setValue({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
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
        rememberMe: false,
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
