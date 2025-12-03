import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  const defaultDialogData: ConfirmDialogData = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  };

  beforeEach(async () => {
    dialogRefSpy = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: defaultDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the title from dialog data', () => {
    const title = fixture.debugElement.query(By.css('h2[mat-dialog-title]'));
    expect(title.nativeElement.textContent).toContain('Confirm Action');
  });

  it('should display the message from dialog data', () => {
    const content = fixture.debugElement.query(By.css('mat-dialog-content p'));
    expect(content.nativeElement.textContent).toContain(
      'Are you sure you want to proceed?'
    );
  });

  it('should display confirm button with correct text', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('button[color="warn"]')
    );
    expect(confirmButton.nativeElement.textContent.trim()).toBe('Confirm');
  });

  it('should display cancel button with correct text', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const cancelButton = buttons.find(
      (b) => !b.nativeElement.getAttribute('color')
    );
    expect(cancelButton?.nativeElement.textContent.trim()).toBe('Cancel');
  });

  it('should close dialog with true when confirm is clicked (AC-2.4.3)', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('button[color="warn"]')
    );
    confirmButton.nativeElement.click();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should close dialog with false when cancel is clicked (AC-2.4.3)', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const cancelButton = buttons.find(
      (b) => !b.nativeElement.getAttribute('color')
    );
    cancelButton?.nativeElement.click();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('should have two buttons in action area', () => {
    const actionButtons = fixture.debugElement.queryAll(
      By.css('mat-dialog-actions button')
    );
    expect(actionButtons.length).toBe(2);
  });
});

describe('ConfirmDialogComponent with unsaved changes data', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  const unsavedChangesData: ConfirmDialogData = {
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Discard changes?',
    confirmText: 'Discard',
    cancelText: 'Cancel',
  };

  beforeEach(async () => {
    dialogRefSpy = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: unsavedChangesData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  });

  it('should display Unsaved Changes title (AC-2.4.3)', () => {
    const title = fixture.debugElement.query(By.css('h2[mat-dialog-title]'));
    expect(title.nativeElement.textContent).toContain('Unsaved Changes');
  });

  it('should display discard message (AC-2.4.3)', () => {
    const content = fixture.debugElement.query(By.css('mat-dialog-content p'));
    expect(content.nativeElement.textContent).toContain(
      'You have unsaved changes. Discard changes?'
    );
  });

  it('should display Discard button (AC-2.4.3)', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('button[color="warn"]')
    );
    expect(confirmButton.nativeElement.textContent.trim()).toBe('Discard');
  });

  it('should display Cancel button (AC-2.4.3)', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const cancelButton = buttons.find(
      (b) => !b.nativeElement.getAttribute('color')
    );
    expect(cancelButton?.nativeElement.textContent.trim()).toBe('Cancel');
  });
});
