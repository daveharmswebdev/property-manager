import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { VendorFormComponent } from './vendor-form.component';
import { VendorStore } from '../../stores/vendor.store';

describe('VendorFormComponent', () => {
  let component: VendorFormComponent;
  let fixture: ComponentFixture<VendorFormComponent>;
  let mockVendorStore: {
    vendors: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isSaving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    hasVendors: ReturnType<typeof signal<boolean>>;
    totalCount: ReturnType<typeof signal<number>>;
    loadVendors: ReturnType<typeof vi.fn>;
    createVendor: ReturnType<typeof vi.fn>;
    clearError: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    mockVendorStore = {
      vendors: signal([]),
      isLoading: signal(false),
      isSaving: signal(false),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      hasVendors: signal(false),
      totalCount: signal(0),
      loadVendors: vi.fn(),
      createVendor: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VendorFormComponent, NoopAnimationsModule],
      providers: [
        provideRouter([
          { path: 'vendors', component: VendorFormComponent },
          { path: 'vendors/new', component: VendorFormComponent },
        ]),
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Structure (AC #3)', () => {
    it('should have Add Vendor title', () => {
      const title = fixture.debugElement.query(By.css('mat-card-title'));
      expect(title.nativeElement.textContent).toContain('Add Vendor');
    });

    it('should have First Name field (AC #3)', () => {
      const firstNameField = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      expect(firstNameField).toBeTruthy();
    });

    it('should have Middle Name field marked as optional (AC #3)', () => {
      const labels = fixture.debugElement
        .queryAll(By.css('mat-label'))
        .map((el) => el.nativeElement.textContent);
      expect(labels.some((label: string) => label.includes('Middle Name') && label.includes('Optional'))).toBe(true);
    });

    it('should have Last Name field (AC #3)', () => {
      const lastNameField = fixture.debugElement.query(
        By.css('input[formControlName="lastName"]')
      );
      expect(lastNameField).toBeTruthy();
    });

    it('should have Save button', () => {
      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton).toBeTruthy();
      expect(saveButton.nativeElement.textContent).toContain('Save');
    });

    it('should have Cancel button', () => {
      const cancelButton = fixture.debugElement.query(
        By.css('button[type="button"]')
      );
      expect(cancelButton).toBeTruthy();
      expect(cancelButton.nativeElement.textContent).toContain('Cancel');
    });
  });

  describe('Form Validation (AC #5, #6)', () => {
    it('should have invalid form when firstName is empty (AC #5)', () => {
      component['form'].patchValue({
        firstName: '',
        lastName: 'Doe',
      });
      expect(component['form'].valid).toBe(false);
    });

    it('should have invalid form when lastName is empty (AC #6)', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: '',
      });
      expect(component['form'].valid).toBe(false);
    });

    it('should have valid form with firstName and lastName', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(component['form'].valid).toBe(true);
    });

    it('should have valid form with all fields', () => {
      component['form'].patchValue({
        firstName: 'John',
        middleName: 'Allen',
        lastName: 'Doe',
      });
      expect(component['form'].valid).toBe(true);
    });

    it('should show "First name is required" error (AC #5)', () => {
      const firstNameControl = component['form'].get('firstName');
      firstNameControl?.markAsTouched();
      firstNameControl?.setValue('');
      fixture.detectChanges();

      const error = fixture.debugElement.query(By.css('mat-error'));
      expect(error?.nativeElement.textContent).toContain('First name is required');
    });

    it('should show "Last name is required" error (AC #6)', () => {
      const lastNameControl = component['form'].get('lastName');
      lastNameControl?.markAsTouched();
      lastNameControl?.setValue('');
      // Set firstName valid to isolate lastName error
      component['form'].get('firstName')?.setValue('John');
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('mat-error'));
      const lastNameError = errors.find((el) =>
        el.nativeElement.textContent.includes('Last name is required')
      );
      expect(lastNameError).toBeTruthy();
    });

    it('should enforce maxLength on firstName (100 chars)', () => {
      const longName = 'A'.repeat(101);
      component['form'].get('firstName')?.setValue(longName);
      expect(component['form'].get('firstName')?.hasError('maxlength')).toBe(true);
    });

    it('should enforce maxLength on lastName (100 chars)', () => {
      const longName = 'A'.repeat(101);
      component['form'].get('lastName')?.setValue(longName);
      expect(component['form'].get('lastName')?.hasError('maxlength')).toBe(true);
    });

    it('should enforce maxLength on middleName (100 chars)', () => {
      const longName = 'A'.repeat(101);
      component['form'].get('middleName')?.setValue(longName);
      expect(component['form'].get('middleName')?.hasError('maxlength')).toBe(true);
    });

    it('should accept 100 character firstName', () => {
      const maxName = 'A'.repeat(100);
      component['form'].get('firstName')?.setValue(maxName);
      expect(component['form'].get('firstName')?.hasError('maxlength')).toBe(false);
    });
  });

  describe('Form Submission (AC #4)', () => {
    it('should not submit when form is invalid', () => {
      component['form'].patchValue({
        firstName: '',
        lastName: '',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when submitting invalid form', () => {
      component['form'].patchValue({
        firstName: '',
        lastName: '',
      });

      component['onSubmit']();

      expect(component['form'].get('firstName')?.touched).toBe(true);
      expect(component['form'].get('lastName')?.touched).toBe(true);
    });

    it('should call createVendor with trimmed values (AC #4)', () => {
      component['form'].patchValue({
        firstName: '  John  ',
        middleName: '  Allen  ',
        lastName: '  Doe  ',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith({
        firstName: 'John',
        middleName: 'Allen',
        lastName: 'Doe',
      });
    });

    it('should pass undefined for empty middleName', () => {
      component['form'].patchValue({
        firstName: 'John',
        middleName: '',
        lastName: 'Doe',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith({
        firstName: 'John',
        middleName: undefined,
        lastName: 'Doe',
      });
    });

    it('should pass undefined for whitespace-only middleName', () => {
      component['form'].patchValue({
        firstName: 'John',
        middleName: '   ',
        lastName: 'Doe',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith({
        firstName: 'John',
        middleName: undefined,
        lastName: 'Doe',
      });
    });

    it('should disable Save button when form is invalid', () => {
      component['form'].patchValue({
        firstName: '',
        lastName: '',
      });
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should disable Save button when saving', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: 'Doe',
      });
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should show spinner when saving', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: 'Doe',
      });
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });

    it('should show "Saving..." text when saving', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: 'Doe',
      });
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.textContent).toContain('Saving');
    });

    it('should disable Cancel button when saving', () => {
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const cancelButton = fixture.debugElement.query(
        By.css('button[type="button"]')
      );
      expect(cancelButton.nativeElement.disabled).toBe(true);
    });
  });

  describe('Cancel Navigation', () => {
    it('should navigate to /vendors on cancel', () => {
      component['onCancel']();

      expect(router.navigate).toHaveBeenCalledWith(['/vendors']);
    });
  });
});
