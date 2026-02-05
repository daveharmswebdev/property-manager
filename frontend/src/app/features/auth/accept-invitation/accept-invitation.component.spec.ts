import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AcceptInvitationComponent } from './accept-invitation.component';
import { ApiClient, ValidateInvitationResponse } from '../../../core/api/api.service';

describe('AcceptInvitationComponent', () => {
  let component: AcceptInvitationComponent;
  let fixture: ComponentFixture<AcceptInvitationComponent>;
  let mockApiClient: {
    invitations_ValidateInvitation: ReturnType<typeof vi.fn>;
    invitations_AcceptInvitation: ReturnType<typeof vi.fn>;
  };
  let mockActivatedRoute: {
    snapshot: {
      queryParamMap: {
        get: ReturnType<typeof vi.fn>;
      };
    };
  };

  function createComponent(code: string | null = 'valid-code', validationResult?: ValidateInvitationResponse) {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue(code);

    if (code && validationResult) {
      mockApiClient.invitations_ValidateInvitation.mockReturnValue(of(validationResult));
    } else if (code) {
      mockApiClient.invitations_ValidateInvitation.mockReturnValue(
        of({ isValid: true, email: 'invited@example.com' })
      );
    }

    fixture = TestBed.createComponent(AcceptInvitationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockApiClient = {
      invitations_ValidateInvitation: vi.fn(),
      invitations_AcceptInvitation: vi.fn(),
    };

    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn(),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [AcceptInvitationComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ApiClient, useValue: mockApiClient },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();
  });

  describe('initialization', () => {
    it('should create', () => {
      createComponent();
      expect(component).toBeTruthy();
    });

    it('should extract code from query params on init', () => {
      createComponent('my-invitation-code');
      expect(component['code']()).toBe('my-invitation-code');
    });

    it('should set invalidCode when no code in query params', () => {
      createComponent(null);
      expect(component['invalidCode']()).toBe(true);
      expect(component['invalidReason']()).toBe('No invitation code provided');
      expect(component['validating']()).toBe(false);
    });

    it('should validate invitation code on init', () => {
      createComponent('valid-code');
      expect(mockApiClient.invitations_ValidateInvitation).toHaveBeenCalledWith('valid-code');
    });

    it('should set email when validation succeeds', () => {
      createComponent('valid-code', { isValid: true, email: 'user@example.com' });
      expect(component['email']()).toBe('user@example.com');
      expect(component['validating']()).toBe(false);
    });

    it('should set invalidCode when validation returns invalid', () => {
      createComponent('expired-code', { isValid: false, errorMessage: 'Invitation has expired' });
      expect(component['invalidCode']()).toBe(true);
      expect(component['invalidReason']()).toBe('Invitation has expired');
    });

    it('should set invalidCode when validation fails with network error', () => {
      mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('code');
      mockApiClient.invitations_ValidateInvitation.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      fixture = TestBed.createComponent(AcceptInvitationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['invalidCode']()).toBe(true);
      expect(component['invalidReason']()).toBe('Failed to validate invitation. Please try again.');
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
  });

  describe('form submission', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should not call apiClient when form is invalid', () => {
      component['form'].setValue({
        password: '',
        confirmPassword: '',
      });

      component['onSubmit']();

      expect(mockApiClient.invitations_AcceptInvitation).not.toHaveBeenCalled();
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
      expect(mockApiClient.invitations_AcceptInvitation).not.toHaveBeenCalled();
    });
  });

  describe('successful invitation acceptance', () => {
    beforeEach(() => {
      createComponent('valid-code');
    });

    it('should call apiClient.invitations_AcceptInvitation with code and password', () => {
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(of(undefined));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(mockApiClient.invitations_AcceptInvitation).toHaveBeenCalledWith('valid-code', {
        password: 'NewPassword1!',
      });
    });

    it('should set success to true on successful acceptance', () => {
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(of(undefined));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['success']()).toBe(true);
    });

    it('should set loading to false after success', () => {
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(of(undefined));

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
      createComponent('valid-code');
    });

    it('should display password validation errors from 400 response', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: {
          errors: {
            Password: ['Password must contain at least one uppercase letter'],
          },
        },
      });
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(throwError(() => errorResponse));

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
        error: { detail: 'Invitation has already been used' },
      });
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Invitation has already been used');
    });

    it('should display default error for 400 without detail', () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
        error: {},
      });
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('This invitation is invalid or has expired');
    });

    it('should display generic error for non-400 errors', () => {
      const errorResponse = new HttpErrorResponse({
        status: 500,
        error: {},
      });
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(throwError(() => errorResponse));

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
      mockApiClient.invitations_AcceptInvitation.mockReturnValue(throwError(() => errorResponse));

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });
  });

  describe('no code scenario', () => {
    it('should set error when submitting without code', () => {
      // Create with code initially, then clear it
      createComponent('valid-code');

      // Manually clear the code to simulate edge case
      component['code'].set(null);

      component['form'].setValue({
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      component['onSubmit']();

      expect(component['serverError']()).toBe('Invalid invitation code');
      expect(mockApiClient.invitations_AcceptInvitation).not.toHaveBeenCalled();
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
