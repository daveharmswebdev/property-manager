import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { CreateLandlordInvitationDialogComponent } from './create-landlord-invitation-dialog.component';

describe('CreateLandlordInvitationDialogComponent', () => {
  let component: CreateLandlordInvitationDialogComponent;
  let fixture: ComponentFixture<CreateLandlordInvitationDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreateLandlordInvitationDialogComponent, NoopAnimationsModule],
      providers: [{ provide: MatDialogRef, useValue: mockDialogRef }],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateLandlordInvitationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an email-only form (no role control)', () => {
    expect(component.form.get('email')).toBeTruthy();
    expect(component.form.get('role')).toBeNull();
  });

  it('should mark email invalid when empty (AC: #8)', () => {
    component.form.get('email')?.setValue('');
    expect(component.form.get('email')?.valid).toBe(false);
  });

  it('should mark email invalid with bad format (AC: #8)', () => {
    component.form.get('email')?.setValue('not-an-email');
    expect(component.form.get('email')?.valid).toBe(false);
  });

  it('should mark email valid with proper email', () => {
    component.form.get('email')?.setValue('landlord@example.com');
    expect(component.form.get('email')?.valid).toBe(true);
  });

  it('should NOT close with a value when form is invalid (AC: #8)', () => {
    component.form.get('email')?.setValue('');
    component.onSubmit();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close with { email } on valid submit (AC: #4)', () => {
    component.form.get('email')?.setValue('landlord@example.com');
    component.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith({ email: 'landlord@example.com' });
  });

  it('should close without data on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith();
  });

  it('should render a required mat-error when email is touched and empty (AC: #8)', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('');
    emailControl?.markAsTouched();
    fixture.detectChanges();
    const error = fixture.debugElement.query(By.css('mat-error'));
    expect(error?.nativeElement.textContent).toContain('Email is required');
  });

  it('should render an invalid-format mat-error for a malformed email (AC: #8)', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('bad');
    emailControl?.markAsTouched();
    fixture.detectChanges();
    const error = fixture.debugElement.query(By.css('mat-error'));
    expect(error?.nativeElement.textContent).toContain('Invalid email format');
  });
});
