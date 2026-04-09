import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { InviteUserDialogComponent } from './invite-user-dialog.component';

describe('InviteUserDialogComponent', () => {
  let component: InviteUserDialogComponent;
  let fixture: ComponentFixture<InviteUserDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InviteUserDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteUserDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an email form control', () => {
    expect(component.form.get('email')).toBeTruthy();
  });

  it('should have a role form control defaulting to Owner', () => {
    expect(component.form.get('role')?.value).toBe('Owner');
  });

  it('should mark email as invalid when empty', () => {
    component.form.get('email')?.setValue('');
    expect(component.form.get('email')?.valid).toBe(false);
  });

  it('should mark email as invalid with bad format', () => {
    component.form.get('email')?.setValue('not-an-email');
    expect(component.form.get('email')?.valid).toBe(false);
  });

  it('should mark email as valid with proper email', () => {
    component.form.get('email')?.setValue('test@example.com');
    expect(component.form.get('email')?.valid).toBe(true);
  });

  it('should not submit when form is invalid', () => {
    component.form.get('email')?.setValue('');
    component.onSubmit();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close dialog with form data on valid submit', () => {
    component.form.get('email')?.setValue('new@example.com');
    component.form.get('role')?.setValue('Contributor');
    component.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      email: 'new@example.com',
      role: 'Contributor',
    });
  });

  it('should close dialog without data on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith();
  });
});
