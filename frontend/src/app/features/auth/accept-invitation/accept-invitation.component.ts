import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiClient, ValidateInvitationResponse } from '../../../core/api/api.service';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.scss',
})
export class AcceptInvitationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiClient = inject(ApiClient);

  // State signals
  protected readonly validating = signal(true);
  protected readonly loading = signal(false);
  protected readonly success = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);
  protected readonly code = signal<string | null>(null);
  protected readonly email = signal<string | null>(null);
  protected readonly invalidCode = signal(false);
  protected readonly invalidReason = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    password: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/[A-Z]/), // At least one uppercase
      Validators.pattern(/[a-z]/), // At least one lowercase
      Validators.pattern(/[0-9]/), // At least one digit
      Validators.pattern(/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/), // At least one special char
    ]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    // Get code from query params
    const codeParam = this.route.snapshot.queryParamMap.get('code');
    if (!codeParam) {
      this.validating.set(false);
      this.invalidCode.set(true);
      this.invalidReason.set('No invitation code provided');
      return;
    }
    this.code.set(codeParam);

    // Validate the invitation code
    this.apiClient.invitations_ValidateInvitation(codeParam).subscribe({
      next: (result) => {
        this.validating.set(false);
        if (result.isValid && result.email) {
          this.email.set(result.email);
        } else {
          this.invalidCode.set(true);
          this.invalidReason.set(result.errorMessage || 'This invitation is invalid');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.validating.set(false);
        this.invalidCode.set(true);
        this.invalidReason.set('Failed to validate invitation. Please try again.');
      },
    });
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.form.value;

    if (password !== confirmPassword) {
      this.serverError.set('Passwords do not match');
      return;
    }

    const codeValue = this.code();
    if (!codeValue) {
      this.serverError.set('Invalid invitation code');
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    this.apiClient.invitations_AcceptInvitation(codeValue, { password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        if (error.status === 400) {
          const errorBody = error.error;
          if (errorBody?.errors) {
            // Password validation errors
            const passwordErrors = errorBody.errors['Password'] || errorBody.errors['password'];
            if (passwordErrors && passwordErrors.length > 0) {
              this.serverError.set(passwordErrors.join('. '));
            } else {
              this.serverError.set(errorBody.detail || 'Invalid request');
            }
          } else if (errorBody?.detail) {
            this.serverError.set(errorBody.detail);
          } else {
            this.serverError.set('This invitation is invalid or has expired');
          }
        } else {
          this.serverError.set('An unexpected error occurred. Please try again.');
        }
      },
    });
  }

  protected hasPasswordError(errorKey: string): boolean {
    const control = this.form.get('password');
    return control?.hasError(errorKey) && control?.touched || false;
  }

  protected passwordMatchError(): boolean {
    const password = this.form.get('password')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    const touched = this.form.get('confirmPassword')?.touched;
    return touched && password && confirmPassword && password !== confirmPassword;
  }

  protected hasUppercase(): boolean {
    const password = this.form.get('password')?.value;
    return password ? /[A-Z]/.test(password) : false;
  }

  protected hasLowercase(): boolean {
    const password = this.form.get('password')?.value;
    return password ? /[a-z]/.test(password) : false;
  }

  protected hasNumber(): boolean {
    const password = this.form.get('password')?.value;
    return password ? /[0-9]/.test(password) : false;
  }

  protected hasSpecialChar(): boolean {
    const password = this.form.get('password')?.value;
    return password ? /[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(password) : false;
  }
}
