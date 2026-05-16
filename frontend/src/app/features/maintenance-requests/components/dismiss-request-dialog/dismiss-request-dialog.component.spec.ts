import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  DismissRequestDialogComponent,
  DismissRequestDialogData,
} from './dismiss-request-dialog.component';
import { MaintenanceRequestService } from '../../services/maintenance-request.service';

describe('DismissRequestDialogComponent', () => {
  let component: DismissRequestDialogComponent;
  let fixture: ComponentFixture<DismissRequestDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockService: {
    dismissMaintenanceRequest: ReturnType<typeof vi.fn>;
  };

  const mockDialogData: DismissRequestDialogData = {
    maintenanceRequestId: 'req-1',
    propertyName: 'Test Property',
    description: 'Leaky faucet in kitchen',
  };

  async function setup(data: DismissRequestDialogData = mockDialogData): Promise<void> {
    TestBed.resetTestingModule();

    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockService = {
      dismissMaintenanceRequest: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [DismissRequestDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MaintenanceRequestService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DismissRequestDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the dialog with the dismiss testid', () => {
    const root = fixture.debugElement.query(By.css('[data-testid="dismiss-dialog"]'));
    expect(root).toBeTruthy();
  });

  it('renders the property name and short description summary verbatim', () => {
    const summary = fixture.debugElement.query(
      By.css('[data-testid="dismiss-dialog-summary"]'),
    );
    expect(summary.nativeElement.textContent.trim()).toBe('Leaky faucet in kitchen');
  });

  it('truncates description to 100 chars with an ellipsis when too long', async () => {
    const longDesc = 'x'.repeat(150);
    await setup({
      maintenanceRequestId: 'req-1',
      propertyName: 'Test Property',
      description: longDesc,
    });

    const summary = fixture.debugElement.query(
      By.css('[data-testid="dismiss-dialog-summary"]'),
    );
    const text = summary.nativeElement.textContent.trim();
    // 100 chars + ellipsis character
    expect(text.length).toBe(101);
    expect(text.endsWith('…')).toBe(true);
  });

  it('disables the submit button when reason is empty', () => {
    // Form starts empty so button is disabled.
    const btn = fixture.debugElement.query(By.css('[data-testid="dismiss-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('disables the submit button when reason is whitespace only', () => {
    component.form.patchValue({ reason: '   ' });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('[data-testid="dismiss-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('disables the submit button when reason exceeds 2000 chars', () => {
    component.form.patchValue({ reason: 'x'.repeat(2001) });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('[data-testid="dismiss-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('enables submit when reason is valid', () => {
    component.form.patchValue({ reason: 'Tenant moved out' });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('[data-testid="dismiss-dialog-submit"]'));
    expect(btn.nativeElement.disabled).toBe(false);
  });

  it('submits with the trimmed reason', () => {
    component.form.patchValue({ reason: '  Tenant moved out  ' });
    component.onSubmit();

    expect(mockService.dismissMaintenanceRequest).toHaveBeenCalledWith('req-1', {
      reason: 'Tenant moved out',
    });
  });

  it('closes the dialog with true on success', () => {
    component.form.patchValue({ reason: 'Tenant moved out' });
    component.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows snackbar and keeps dialog open on error', () => {
    mockService.dismissMaintenanceRequest.mockReturnValue(
      throwError(() => new Error('boom')),
    );
    component.form.patchValue({ reason: 'Some reason' });
    component.onSubmit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to dismiss request',
      'Close',
      { duration: 4000 },
    );
    expect(component.isSubmitting()).toBe(false);
  });

  it('does NOT call the service when the reason is empty', () => {
    component.onSubmit();
    expect(mockService.dismissMaintenanceRequest).not.toHaveBeenCalled();
  });

  it('does NOT call the service when already submitting', () => {
    component.form.patchValue({ reason: 'Some reason' });
    component.isSubmitting.set(true);
    component.onSubmit();
    expect(mockService.dismissMaintenanceRequest).not.toHaveBeenCalled();
  });

  it('cancel button has mat-dialog-close attribute (does not call service)', () => {
    const cancelBtn = fixture.debugElement.query(
      By.css('[data-testid="dismiss-dialog-cancel"]'),
    );
    expect(cancelBtn).toBeTruthy();
    cancelBtn.nativeElement.click();
    expect(mockService.dismissMaintenanceRequest).not.toHaveBeenCalled();
  });
});
