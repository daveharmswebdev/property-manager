import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError, Subject } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let mockAuthService: {
    forgotPassword: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAuthService = {
      forgotPassword: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
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
  });

  describe('initial state', () => {
    it('should have loading set to false', () => {
      expect(component['loading']()).toBe(false);
    });

    it('should have submitted set to false', () => {
      expect(component['submitted']()).toBe(false);
    });

    it('should have serverError set to null', () => {
      expect(component['serverError']()).toBeNull();
    });
  });

  describe('form validation', () => {
    it('should not call authService when form is invalid', () => {
      component['form'].setValue({ email: '' });

      component['onSubmit']();

      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });

    it('should mark email as touched when submitting invalid form', () => {
      component['onSubmit']();

      expect(component['form'].get('email')?.touched).toBe(true);
    });

    it('should not submit with invalid email format', () => {
      component['form'].setValue({ email: 'not-an-email' });

      component['onSubmit']();

      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('successful submission', () => {
    it('should call authService.forgotPassword with email', () => {
      mockAuthService.forgotPassword.mockReturnValue(of(undefined));

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });

    it('should set submitted to true on success', () => {
      mockAuthService.forgotPassword.mockReturnValue(of(undefined));

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      expect(component['submitted']()).toBe(true);
    });

    it('should set loading to false after success', () => {
      mockAuthService.forgotPassword.mockReturnValue(of(undefined));

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });

    it('should clear server error on submission', () => {
      mockAuthService.forgotPassword.mockReturnValue(of(undefined));

      component['serverError'].set('Previous error');
      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      expect(component['serverError']()).toBeNull();
    });
  });

  describe('error handling (security)', () => {
    it('should still show submitted state on error (prevents enumeration)', () => {
      mockAuthService.forgotPassword.mockReturnValue(throwError(() => new Error('Network error')));

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      // Even on error, should show success to prevent email enumeration
      expect(component['submitted']()).toBe(true);
    });

    it('should set loading to false after error', () => {
      mockAuthService.forgotPassword.mockReturnValue(throwError(() => new Error('Network error')));

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      expect(component['loading']()).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should set loading to true when submitting', () => {
      const forgotSubject = new Subject<void>();
      mockAuthService.forgotPassword.mockReturnValue(forgotSubject.asObservable());

      component['form'].setValue({ email: 'test@example.com' });

      component['onSubmit']();

      // Loading should be true while waiting
      expect(component['loading']()).toBe(true);

      // Complete the request
      forgotSubject.next();
      forgotSubject.complete();

      expect(component['loading']()).toBe(false);
    });
  });
});
