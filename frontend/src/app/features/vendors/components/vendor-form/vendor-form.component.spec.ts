import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { VendorFormComponent } from './vendor-form.component';
import { VendorStore } from '../../stores/vendor.store';
import { VendorTradeTagDto } from '../../../../core/api/api.service';

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
    tradeTags: ReturnType<typeof signal<VendorTradeTagDto[]>>;
    loadVendors: ReturnType<typeof vi.fn>;
    createVendor: ReturnType<typeof vi.fn>;
    loadTradeTags: ReturnType<typeof vi.fn>;
    createTradeTag: ReturnType<typeof vi.fn>;
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
      tradeTags: signal<VendorTradeTagDto[]>([]),
      loadVendors: vi.fn(),
      createVendor: vi.fn(),
      loadTradeTags: vi.fn(),
      createTradeTag: vi.fn().mockResolvedValue({ id: 'new-tag', name: 'Test Tag' }),
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

  it('should call loadTradeTags on init', () => {
    expect(mockVendorStore.loadTradeTags).toHaveBeenCalled();
  });

  describe('Form Structure', () => {
    it('should have Add Vendor title', () => {
      const title = fixture.debugElement.query(By.css('mat-card-title'));
      expect(title.nativeElement.textContent).toContain('Add Vendor');
    });

    it('should have First Name field', () => {
      const firstNameField = fixture.debugElement.query(
        By.css('input[formControlName="firstName"]')
      );
      expect(firstNameField).toBeTruthy();
    });

    it('should have Middle Name field', () => {
      const middleNameField = fixture.debugElement.query(
        By.css('input[formControlName="middleName"]')
      );
      expect(middleNameField).toBeTruthy();
    });

    it('should have Last Name field', () => {
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
      const cancelButton = fixture.debugElement.queryAll(
        By.css('button[type="button"]')
      ).find(el => el.nativeElement.textContent.includes('Cancel'));
      expect(cancelButton).toBeTruthy();
    });
  });

  describe('Phone Numbers Section (Story 17.8)', () => {
    it('should have phone numbers section', () => {
      const sectionHeaders = fixture.debugElement.queryAll(By.css('.section-header h3'));
      const phoneHeader = sectionHeaders.find(
        el => el.nativeElement.textContent.includes('Phone Numbers')
      );
      expect(phoneHeader).toBeTruthy();
    });

    it('should add phone row when clicking add phone', () => {
      const addButton = fixture.debugElement.queryAll(By.css('.section-header button'))
        .find(el => {
          const prev = el.nativeElement.closest('.section-header')?.querySelector('h3');
          return prev?.textContent?.includes('Phone Numbers');
        });
      addButton?.nativeElement.click();
      fixture.detectChanges();

      const phoneRows = fixture.debugElement.queryAll(By.css('.phone-row'));
      expect(phoneRows.length).toBe(1);
    });

    it('should remove phone row', () => {
      component['addPhone']();
      fixture.detectChanges();
      expect(component['phonesArray'].length).toBe(1);

      component['removePhone'](0);
      fixture.detectChanges();
      expect(component['phonesArray'].length).toBe(0);
    });

    it('should validate phone number is required', () => {
      component['addPhone']();
      const phoneControl = component['phonesArray'].at(0).get('number');
      phoneControl?.markAsTouched();
      phoneControl?.setValue('');
      expect(phoneControl?.hasError('required')).toBe(true);
    });
  });

  describe('Email Addresses Section (Story 17.8)', () => {
    it('should have email addresses section', () => {
      const sectionHeaders = fixture.debugElement.queryAll(By.css('.section-header h3'));
      const emailHeader = sectionHeaders.find(
        el => el.nativeElement.textContent.includes('Email Addresses')
      );
      expect(emailHeader).toBeTruthy();
    });

    it('should add email row when clicking add email', () => {
      component['addEmail']();
      fixture.detectChanges();

      expect(component['emailsArray'].length).toBe(1);
    });

    it('should remove email row', () => {
      component['addEmail']();
      fixture.detectChanges();
      expect(component['emailsArray'].length).toBe(1);

      component['removeEmail'](0);
      fixture.detectChanges();
      expect(component['emailsArray'].length).toBe(0);
    });

    it('should validate email format', () => {
      component['addEmail']();
      const emailControl = component['emailsArray'].at(0);
      emailControl.setValue('not-an-email');
      expect(emailControl.hasError('email')).toBe(true);
    });
  });

  describe('Trade Tags Section (Story 17.8)', () => {
    it('should have trade tags section', () => {
      const chipGrid = fixture.debugElement.query(By.css('mat-chip-grid'));
      expect(chipGrid).toBeTruthy();
    });

    it('should select and remove trade tags', () => {
      const tag: VendorTradeTagDto = { id: 'tag-1', name: 'Plumbing' };
      component['selectedTags'].set([tag]);
      fixture.detectChanges();

      expect(component['selectedTags']().length).toBe(1);

      component['removeTag'](tag);
      expect(component['selectedTags']().length).toBe(0);
    });
  });

  describe('Form Validation', () => {
    it('should have invalid form when firstName is empty', () => {
      component['form'].patchValue({
        firstName: '',
        lastName: 'Doe',
      });
      expect(component['form'].valid).toBe(false);
    });

    it('should have invalid form when lastName is empty', () => {
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
  });

  describe('Form Submission (Story 17.8)', () => {
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

    it('should call createVendor with trimmed values', () => {
      component['form'].patchValue({
        firstName: '  John  ',
        middleName: '  Allen  ',
        lastName: '  Doe  ',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          middleName: 'Allen',
          lastName: 'Doe',
        })
      );
    });

    it('should pass undefined for empty middleName', () => {
      component['form'].patchValue({
        firstName: 'John',
        middleName: '',
        lastName: 'Doe',
      });

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          middleName: undefined,
        })
      );
    });

    it('should include phones, emails, tradeTagIds in submit payload', () => {
      component['form'].patchValue({
        firstName: 'John',
        lastName: 'Doe',
      });

      // Add a phone
      component['addPhone']();
      component['phonesArray'].at(0).patchValue({ number: '512-555-1234', label: 'Mobile' });

      // Add an email
      component['addEmail']();
      component['emailsArray'].at(0).setValue('test@example.com');

      // Add a tag
      const tag: VendorTradeTagDto = { id: 'tag-1', name: 'Plumbing' };
      component['selectedTags'].set([tag]);

      component['onSubmit']();

      expect(mockVendorStore.createVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          phones: [{ number: '512-555-1234', label: 'Mobile' }],
          emails: ['test@example.com'],
          tradeTagIds: ['tag-1'],
        })
      );
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
  });

  describe('Cancel Navigation', () => {
    it('should navigate to /vendors on cancel', () => {
      component['onCancel']();

      expect(router.navigate).toHaveBeenCalledWith(['/vendors']);
    });
  });
});
