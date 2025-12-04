import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  DeletePropertyDialogComponent,
  DeletePropertyDialogData,
} from './delete-property-dialog.component';

describe('DeletePropertyDialogComponent', () => {
  let component: DeletePropertyDialogComponent;
  let fixture: ComponentFixture<DeletePropertyDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  const mockDialogData: DeletePropertyDialogData = {
    propertyName: 'Oak Street Duplex',
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DeletePropertyDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeletePropertyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display property name in title (AC-2.5.1)', () => {
    const titleElement = fixture.nativeElement.querySelector('h2');
    expect(titleElement.textContent).toContain('Delete Oak Street Duplex?');
  });

  it('should display preservation message (AC-2.5.1)', () => {
    const contentElement = fixture.nativeElement.querySelector('.preservation-note');
    expect(contentElement.textContent).toContain('Historical expense and income records will be preserved for tax purposes');
  });

  it('should display warning message about removing from portfolio', () => {
    const warningElement = fixture.nativeElement.querySelector('.warning-message');
    expect(warningElement.textContent).toContain('remove the property from your active portfolio');
  });

  it('should have Cancel and Delete buttons (AC-2.5.1)', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((btn: any) => btn.textContent.trim());

    expect(buttonTexts.some((text: string) => text.includes('Cancel'))).toBe(true);
    expect(buttonTexts.some((text: string) => text.includes('Delete'))).toBe(true);
  });

  it('should have Delete button with warn color (AC-2.5.1)', () => {
    const deleteButton = fixture.nativeElement.querySelector('button[color="warn"]');
    expect(deleteButton).toBeTruthy();
    expect(deleteButton.textContent).toContain('Delete');
  });

  it('should close dialog with true when Delete is clicked (AC-2.5.1)', () => {
    const deleteButton = fixture.nativeElement.querySelector('button[color="warn"]');
    deleteButton.click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close dialog with false when Cancel is clicked (AC-2.5.1)', () => {
    const cancelButton = fixture.nativeElement.querySelector('button:not([color="warn"])');
    cancelButton.click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should display warning icon', () => {
    const warningIcon = fixture.nativeElement.querySelector('.warning-icon');
    expect(warningIcon).toBeTruthy();
    expect(warningIcon.textContent).toContain('warning');
  });
});
