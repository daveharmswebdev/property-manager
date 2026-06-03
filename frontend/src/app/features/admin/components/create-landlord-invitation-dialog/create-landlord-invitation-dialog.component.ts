import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Dialog for inviting a new landlord (Story 22.4, AC: #4, #8).
 * Email-only — no role/property/account fields (the backend creates a top-level
 * Owner invitation with AccountId=null). Returns { email } on submit, undefined on cancel.
 */
@Component({
  selector: 'app-create-landlord-invitation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Invite New Landlord</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="invite-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" placeholder="landlord@example.com" />
          @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
            <mat-error>Email is required</mat-error>
          }
          @if (form.get('email')?.hasError('email') && !form.get('email')?.hasError('required')) {
            <mat-error>Invalid email format</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()">
        <mat-icon>send</mat-icon>
        Send Invitation
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .invite-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 350px;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class CreateLandlordInvitationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateLandlordInvitationDialogComponent>);
  private readonly fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({ email: this.form.value.email });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
