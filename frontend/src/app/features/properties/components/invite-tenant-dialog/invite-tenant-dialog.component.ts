import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface InviteTenantDialogData {
  propertyId: string;
}

export interface InviteTenantDialogResult {
  email: string;
  role: 'Tenant';
  propertyId: string;
}

/**
 * Dialog component for inviting a tenant to a specific property (AC: 20.2 #1).
 * Returns { email, role: 'Tenant', propertyId } on submit, undefined on cancel.
 */
@Component({
  selector: 'app-invite-tenant-dialog',
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
    <h2 mat-dialog-title>Invite Tenant</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="invite-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input
            matInput
            formControlName="email"
            type="email"
            placeholder="tenant@example.com"
          />
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
        <mat-icon>person_add</mat-icon>
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
export class InviteTenantDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<InviteTenantDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly data: InviteTenantDialogData = inject(MAT_DIALOG_DATA);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const result: InviteTenantDialogResult = {
      email: this.form.value.email,
      role: 'Tenant',
      propertyId: this.data.propertyId,
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
