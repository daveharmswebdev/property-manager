import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  InviteTenantDialogComponent,
  InviteTenantDialogData,
} from './invite-tenant-dialog.component';

describe('InviteTenantDialogComponent', () => {
  let component: InviteTenantDialogComponent;
  let fixture: ComponentFixture<InviteTenantDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  const testPropertyId = 'prop-123-abc';

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    const dialogData: InviteTenantDialogData = { propertyId: testPropertyId };

    await TestBed.configureTestingModule({
      imports: [InviteTenantDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteTenantDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // AC: 20.2 Task 12.1
  it('should render email input and submit button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('button[color="primary"]')).toBeTruthy();
  });

  // AC: 20.2 Task 12.2
  it('should validate email is required', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('');
    emailControl?.markAsTouched();
    expect(emailControl?.hasError('required')).toBe(true);
  });

  it('should validate email format', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('not-an-email');
    expect(emailControl?.hasError('email')).toBe(true);
  });

  // AC: 20.2 Task 12.3
  it('should return email, role Tenant, and propertyId on submit', () => {
    component.form.get('email')?.setValue('tenant@example.com');

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      email: 'tenant@example.com',
      role: 'Tenant',
      propertyId: testPropertyId,
    });
  });

  it('should not submit when form is invalid', () => {
    component.form.get('email')?.setValue('');

    component.onSubmit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close with undefined on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith();
  });

  it('should mark all fields as touched on invalid submit', () => {
    component.onSubmit();
    expect(component.form.get('email')?.touched).toBe(true);
  });
});
