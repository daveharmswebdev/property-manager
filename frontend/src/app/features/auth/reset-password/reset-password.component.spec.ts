import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let mockAuthService: {
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let mockActivatedRoute: {
    snapshot: {
      queryParamMap: {
        get: ReturnType<typeof vi.fn>;
      };
    };
  };

  function createComponent(token: string | null = 'valid-token') {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue(token);

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockAuthService = {
      resetPassword: vi.fn(),
    };

    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn(),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();
  });

  describe('initialization', () => {
    it('should create', () => {
      createComponent();
      expect(component).toBeTruthy();
    });

    it('should extract token from query params on init', () => {
      createComponent('my-reset-token');
      expect(component['token']()).toBe('my-reset-token');
    });

    it('should set invalidToken when no token in query params', () => {
      createComponent(null);
      expect(component['invalidToken']()).toBe(true);
      expect(component['token']()).toBeNull();
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should have password field with required validator', () => {
      const passwordControl = component['form'].get('password');
      passwordControl?.setValue('');
      expect(passwordControl?.hasError('required')).toBe(true);
    });

    it('should require minimum 8 characters for password', () => {
      const passwordControl = component['form'].get('password');
      passwordControl?.setValue('Short1!');
      expect(passwordControl?.hasError('minlength')).toBe(true);

      passwordControl?.setValue('LongEnough1!');
      expect(passwordControl?.hasError('minlength')).toBe(false);
    });

    it('should have confirmPassword field with required validator', () => {
      const confirmControl = component['form'].get('confirmPassword');
      confirmControl?.setValue('');
      expect(confirmControl?.hasError('required')).toBe(true);
    });
  });

  describe('password validation helpers', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should detect uppercase letters', () => {
      component['form'].get('password')?.setValue('lowercase1!');
      expect(component['hasUppercase']()).toBe(false);

      component['form'].get('password')?.setValue('Uppercase1!');
      expect(component['hasUppercase']()).toBe(true);
    });

    it('should detect lowercase letters', () => {
      component['form'].get('password')?.setValue('UPPERCASE1!');
      expect(component['hasLowercase']()).toBe(false);

      component['form'].get('password')?.setValue('MIXEDcase1!');
      expect(component['hasLowercase']()).toBe(true);
    });

    it('should detect numbers', () => {
      component['form'].get('password')?.setValue('NoNumbers!');
      expect(component['hasNumber']()).toBe(false);

      component['form'].get('password')?.setValue('HasNumber1!');
      expect(component['hasNumber']()).toBe(true);
    });

    it('should detect special characters', () => {
      component['form'].get('password')?.setValue('NoSpecial1');
      expect(component['hasSpecialChar']()).toBe(false);

      component['form'].get('password')?.setValue('HasSpecial1!');
      expect(component['hasSpecialChar']()).toBe(true);
    });

    it('should return false for empty password', () => {
      component['form'].get('password')?.setValue('');
      expect(component['hasUppercase']()).toBe(false);
      expect(component['hasLowercase']()).toBe(false);
      expect(component['hasNumber']()).toBe(false);
      expect(component['hasSpecialChar']()).toBe(false);
    });
  });

  describe('password match validation', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should detect password mismatch when confirmPassword is touched', () => {
      component['form'].get('password')?.setValue('Password1!');
      component['form'].get('confirmPassword')?.setValue('DifferentPassword1!');
      component['form'].get('confirmPassword')?.markAsTouched();

      expect(component['passwordMatchError']()).toBe(true);
    });

    it('should not show mismatch when passwords match', () => {
      component['form'].get('password')?.setValue('Password1!');
      component['form'].get('confirmPassword')?.setValue('Password1!');
      component['form'].get('confirmPassword')?.markAsTouched();

      expect(component['passwordMatchError']()).toBe(false);
    });

    it('should not show mismatch when confirmPassword not touched', () => {
      component['form'].get('password')?.setValue('Password1!');
      component['form'].get('confirmPassword')?.setValue('DifferentPassword1!');

      expect(component['passwordMatchError']()).toBe(false);
    });
  });

  describe('form submission', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should not call authService when form is invalid', () => {
      component['form'].setValue({
        password: '',
        confirmPassword: '',
      });

      component['onSubmit']();

      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when submitting invalid form', () => {
      component['onSubmit']();

      expect(component['form'].get('password')?.touched).toBe(true);
      expect(component['form'].get('confirmPassword')?.touched).toBe(true);
    });

    it('should set error when passwords do not match', () => {
      component['form'].setValue({
        password: 'Password1!',
        confirmPassword: 'DifferentPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Passwords do not match');
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('successful password reset', () => {
    beforeEach(() => {
      createComponent('valid-token');
    });

    it('should call authService.resetPassword with token and password', () => {
      mockAuthService.resetPassword.mockReturnValue(of(undefined));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('valid-token', 'NewPassword1!');
    });

    it('should set success to true on successful reset', () => {
      mockAuthService.resetPassword.mockReturnValue(of(undefined));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['success']()).toBe(true);
    });

    it('should set loading to false after success', () => {
      mockAuthService.resetPassword.mockReturnValue(of(undefined));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      createComponent('valid-token');
    });

    it('should display password validation errors from 400 response', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: {
          errors: {
            NewPassword: ['Password must contain at least one uppercase letter'],
          },
        },
      });
      mockAuthService.resetPassword.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Password must contain at least one uppercase letter');
    });

    it('should display generic 400 error with detail', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: { detail: 'Token has expired' },
      });
      mockAuthService.resetPassword.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Token has expired');
    });

    it('should display default error for 400 without detail', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: {},
      });
      mockAuthService.resetPassword.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('This reset link is invalid or expired');
    });

    it('should display generic error for non-400 errors', () => {
      const errorResponse = new HttpErrorResponse({
        status: 500,
        error: {},
      });
      mockAuthService.resetPassword.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('An unexpected error occurred. Please try again.');
    });

    it('should set loading to false after error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: {},
      });
      mockAuthService.resetPassword.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });
  });

  describe('no token scenario', () => {
    it('should set error when submitting without token', () => {
      createComponent(null);

      // Force form to be valid to test token check
      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Invalid reset link');
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('password visibility', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should start with password hidden', () => {
      expect(component['hidePassword']()).toBe(true);
    });

    it('should start with confirm password hidden', () => {
      expect(component['hideConfirmPassword']()).toBe(true);
    });
  });
});
