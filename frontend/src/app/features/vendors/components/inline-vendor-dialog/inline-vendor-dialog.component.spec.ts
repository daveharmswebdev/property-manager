import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { InlineVendorDialogComponent } from './inline-vendor-dialog.component';
import { VendorStore } from '../../stores/vendor.store';

describe('InlineVendorDialogComponent', () => {
  let component: InlineVendorDialogComponent;
  let fixture: ComponentFixture<InlineVendorDialogComponent>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let mockVendorStore: {
    isSaving: ReturnType<typeof vi.fn>;
    createVendorInline: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    dialogRefSpy = {
      close: vi.fn(),
    };

    mockVendorStore = {
      isSaving: vi.fn().mockReturnValue(false),
      createVendorInline: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InlineVendorDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InlineVendorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form display (AC #2)', () => {
    it('should display dialog title "Add New Vendor"', () => {
      const title = fixture.debugElement.query(By.css('h2[mat-dialog-title]'));
      expect(title.nativeElement.textContent).toContain('Add New Vendor');
    });

    it('should have First Name field', () => {
      const firstNameField = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      expect(firstNameField).toBeTruthy();
    });

    it('should have Last Name field', () => {
      const lastNameField = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );
      expect(lastNameField).toBeTruthy();
    });

    it('should have Middle Name field (optional)', () => {
      const middleNameField = fixture.debugElement.query(
        By.css('input[formControlName="middleName"]')
      );
      expect(middleNameField).toBeTruthy();
    });

    it('should have Cancel button', () => {
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const cancelButton = buttons.find((b) =>
        b.nativeElement.textContent.includes('Cancel')
      );
      expect(cancelButton).toBeTruthy();
    });

    it('should have Save button', () => {
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const saveButton = buttons.find((b) =>
        b.nativeElement.textContent.includes('Save')
      );
      expect(saveButton).toBeTruthy();
    });
  });

  describe('form validation (AC #5)', () => {
    it('should show error when First Name is empty and touched', async () => {
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      firstNameInput.nativeElement.focus();
      firstNameInput.nativeElement.blur();
      fixture.detectChanges();

      const error = fixture.debugElement.query(By.css('mat-error'));
      expect(error?.nativeElement.textContent).toContain(
        'First name is required'
      );
    });

    it('should show error when Last Name is empty and touched', async () => {
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );
      lastNameInput.nativeElement.focus();
      lastNameInput.nativeElement.blur();
      fixture.detectChanges();

      const error = fixture.debugElement.queryAll(By.css('mat-error'));
      const lastNameError = error.find((e) =>
        e.nativeElement.textContent.includes('Last name is required')
      );
      expect(lastNameError).toBeTruthy();
    });

    it('should disable Save button when form is invalid', () => {
      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      expect(saveButton?.nativeElement.disabled).toBe(true);
    });

    it('should enable Save button when required fields are filled', () => {
      // Fill in required fields
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );

      firstNameInput.nativeElement.value = 'John';
      firstNameInput.nativeElement.dispatchEvent(new Event('input'));
      lastNameInput.nativeElement.value = 'Doe';
      lastNameInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      expect(saveButton?.nativeElement.disabled).toBe(false);
    });
  });

  describe('cancel behavior (AC #4)', () => {
    it('should close dialog with null when Cancel is clicked', () => {
      const cancelButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Cancel')
      );
      cancelButton?.nativeElement.click();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });

  describe('save behavior (AC #3)', () => {
    it('should call createVendorInline when Save is clicked with valid form', async () => {
      mockVendorStore.createVendorInline.mockResolvedValue('vendor-123');

      // Fill in form
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );

      firstNameInput.nativeElement.value = 'John';
      firstNameInput.nativeElement.dispatchEvent(new Event('input'));
      lastNameInput.nativeElement.value = 'Doe';
      lastNameInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      saveButton?.nativeElement.click();

      await fixture.whenStable();

      expect(mockVendorStore.createVendorInline).toHaveBeenCalledWith({
        firstName: 'John',
        middleName: undefined,
        lastName: 'Doe',
      });
    });

    it('should close dialog with vendor data on successful save (AC #3)', async () => {
      mockVendorStore.createVendorInline.mockResolvedValue('vendor-123');

      // Fill in form
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );

      firstNameInput.nativeElement.value = 'John';
      firstNameInput.nativeElement.dispatchEvent(new Event('input'));
      lastNameInput.nativeElement.value = 'Doe';
      lastNameInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      saveButton?.nativeElement.click();

      await fixture.whenStable();

      expect(dialogRefSpy.close).toHaveBeenCalledWith({
        id: 'vendor-123',
        fullName: 'John Doe',
      });
    });

    it('should include middle name in fullName when provided', async () => {
      mockVendorStore.createVendorInline.mockResolvedValue('vendor-123');

      // Fill in form including middle name
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      const middleNameInput = fixture.debugElement.query(
        By.css('input[formControlName="middleName"]')
      );
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );

      firstNameInput.nativeElement.value = 'John';
      firstNameInput.nativeElement.dispatchEvent(new Event('input'));
      middleNameInput.nativeElement.value = 'Michael';
      middleNameInput.nativeElement.dispatchEvent(new Event('input'));
      lastNameInput.nativeElement.value = 'Doe';
      lastNameInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      saveButton?.nativeElement.click();

      await fixture.whenStable();

      expect(dialogRefSpy.close).toHaveBeenCalledWith({
        id: 'vendor-123',
        fullName: 'John Michael Doe',
      });
    });

    it('should NOT close dialog on error (AC #7)', async () => {
      mockVendorStore.createVendorInline.mockResolvedValue(null);

      // Fill in form
      const firstNameInput = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      const lastNameInput = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );

      firstNameInput.nativeElement.value = 'John';
      firstNameInput.nativeElement.dispatchEvent(new Event('input'));
      lastNameInput.nativeElement.value = 'Doe';
      lastNameInput.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Save')
      );
      saveButton?.nativeElement.click();

      await fixture.whenStable();

      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable Cancel button while saving', async () => {
      mockVendorStore.isSaving.mockReturnValue(true);
      fixture.detectChanges();

      const cancelButton = fixture.debugElement.queryAll(By.css('button')).find(
        (b) => b.nativeElement.textContent.includes('Cancel')
      );
      expect(cancelButton?.nativeElement.disabled).toBe(true);
    });
  });
});
