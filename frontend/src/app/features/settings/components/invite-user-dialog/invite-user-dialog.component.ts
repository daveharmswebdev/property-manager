import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Dialog component for inviting a new user to the account (AC: #2, #5).
 * Returns { email, role } on submit, undefined on cancel.
 */
@Component({
  selector: 'app-invite-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Invite User</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="invite-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" placeholder="user@example.com" />
          @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
            <mat-error>Email is required</mat-error>
          }
          @if (form.get('email')?.hasError('email') && !form.get('email')?.hasError('required')) {
            <mat-error>Invalid email format</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="Owner">Owner</mat-option>
            <mat-option value="Contributor">Contributor</mat-option>
          </mat-select>
          @if (form.get('role')?.hasError('required') && form.get('role')?.touched) {
            <mat-error>Role is required</mat-error>
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
export class InviteUserDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<InviteUserDialogComponent>);
  private readonly fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['Owner', [Validators.required]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      email: this.form.value.email,
      role: this.form.value.role,
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
