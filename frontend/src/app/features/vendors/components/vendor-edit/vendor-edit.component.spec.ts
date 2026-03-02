import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { VendorEditComponent } from './vendor-edit.component';
import { VendorStore } from '../../stores/vendor.store';
import { VendorDetailDto, VendorTradeTagDto } from '../../../../core/api/api.service';

/**
 * Unit tests for VendorEditComponent (AC #1-#14)
 */
describe('VendorEditComponent', () => {
  let component: VendorEditComponent;
  let fixture: ComponentFixture<VendorEditComponent>;
  let mockVendorStore: {
    vendors: WritableSignal<any[]>;
    isLoading: WritableSignal<boolean>;
    isSaving: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    selectedVendor: WritableSignal<VendorDetailDto | null>;
    tradeTags: WritableSignal<VendorTradeTagDto[]>;
    loadVendor: ReturnType<typeof vi.fn>;
    loadTradeTags: ReturnType<typeof vi.fn>;
    updateVendor: ReturnType<typeof vi.fn>;
    createTradeTag: ReturnType<typeof vi.fn>;
    clearSelectedVendor: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockVendor: VendorDetailDto = {
    id: 'vendor-123',
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    fullName: 'John Michael Doe',
    phones: [
      { number: '512-555-1234', label: 'Mobile' },
      { number: '512-555-5678', label: 'Office' },
    ],
    emails: ['john@example.com', 'john.work@example.com'],
    tradeTags: [
      { id: 'tag-1', name: 'Plumber' },
      { id: 'tag-2', name: 'Electrician' },
    ],
  };

  const mockTradeTags: VendorTradeTagDto[] = [
    { id: 'tag-1', name: 'Plumber' },
    { id: 'tag-2', name: 'Electrician' },
    { id: 'tag-3', name: 'HVAC' },
  ];

  beforeEach(async () => {
    mockVendorStore = {
      vendors: signal([]),
      isLoading: signal(false),
      isSaving: signal(false),
      error: signal<string | null>(null),
      selectedVendor: signal<VendorDetailDto | null>(null), // Start with null
      tradeTags: signal<VendorTradeTagDto[]>(mockTradeTags),
      loadVendor: vi.fn(),
      loadTradeTags: vi.fn(),
      updateVendor: vi.fn(),
      createTradeTag: vi.fn().mockResolvedValue({ id: 'new-tag', name: 'New Tag' }),
      clearSelectedVendor: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VendorEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([
          { path: 'vendors', component: VendorEditComponent },
          { path: 'vendors/:id', component: VendorEditComponent },
        ]),
        { provide: VendorStore, useValue: mockVendorStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'vendor-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorEditComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  /**
   * Helper to set up component with loaded vendor data
   */
  function setupWithVendor(): void {
    fixture.detectChanges(); // Triggers ngOnInit
    mockVendorStore.selectedVendor.set(mockVendor); // Set vendor data
    fixture.detectChanges(); // Trigger effect
  }

  describe('initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load vendor and trade tags on init (AC #10)', () => {
      fixture.detectChanges();
      expect(mockVendorStore.loadVendor).toHaveBeenCalledWith('vendor-123');
      expect(mockVendorStore.loadTradeTags).toHaveBeenCalled();
    });

    it('should populate form with vendor data', () => {
      setupWithVendor();
      expect(component['form'].get('firstName')?.value).toBe('John');
      expect(component['form'].get('middleName')?.value).toBe('Michael');
      expect(component['form'].get('lastName')?.value).toBe('Doe');
    });

    it('should populate phones array (AC #2)', () => {
      setupWithVendor();
      const phonesArray = component['phonesArray'];
      expect(phonesArray.length).toBe(2);
      expect(phonesArray.at(0).get('number')?.value).toBe('512-555-1234');
      expect(phonesArray.at(0).get('label')?.value).toBe('Mobile');
    });

    it('should populate emails array (AC #5)', () => {
      setupWithVendor();
      const emailsArray = component['emailsArray'];
      expect(emailsArray.length).toBe(2);
      expect(emailsArray.at(0).value).toBe('john@example.com');
    });

    it('should populate trade tags (AC #7)', () => {
      setupWithVendor();
      expect(component['selectedTags']().length).toBe(2);
      expect(component['selectedTags']()[0].name).toBe('Plumber');
    });
  });

  describe('loading state (AC #11)', () => {
    it('should show spinner when loading', () => {
      mockVendorStore.isLoading.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('mat-spinner')).toBeTruthy();
      expect(compiled.textContent).toContain('Loading vendor...');
    });

    it('should show form when vendor is loaded', () => {
      setupWithVendor();
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('form')).toBeTruthy();
    });
  });

  describe('phone management (AC #2-#4)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should display phone numbers', () => {
      const phoneInputs = fixture.debugElement.queryAll(
        By.css('input[formControlName="number"]')
      );
      expect(phoneInputs.length).toBe(2);
    });

    it('should display phone labels (AC #3)', () => {
      const labelSelects = fixture.debugElement.queryAll(
        By.css('mat-select[formControlName="label"]')
      );
      expect(labelSelects.length).toBe(2);
    });

    it('should add a new phone row (AC #4)', () => {
      const initialCount = component['phonesArray'].length;
      component['addPhone']();
      expect(component['phonesArray'].length).toBe(initialCount + 1);
    });

    it('should remove a phone row', () => {
      const initialCount = component['phonesArray'].length;
      component['removePhone'](0);
      expect(component['phonesArray'].length).toBe(initialCount - 1);
    });
  });

  describe('email management (AC #5-#6)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should display email addresses', () => {
      const emailsArray = component['emailsArray'];
      expect(emailsArray.length).toBe(2);
    });

    it('should add a new email row', () => {
      const initialCount = component['emailsArray'].length;
      component['addEmail']();
      expect(component['emailsArray'].length).toBe(initialCount + 1);
    });

    it('should remove an email row', () => {
      const initialCount = component['emailsArray'].length;
      component['removeEmail'](0);
      expect(component['emailsArray'].length).toBe(initialCount - 1);
    });

    it('should validate email format (AC #6)', () => {
      component['addEmail']();
      const lastIndex = component['emailsArray'].length - 1;
      component['emailsArray'].at(lastIndex).setValue('invalid-email');
      expect(component['emailsArray'].at(lastIndex).hasError('email')).toBe(true);
    });
  });

  describe('trade tag management (AC #7-#9)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should display selected trade tags', () => {
      expect(component['selectedTags']().length).toBe(2);
    });

    it('should remove a trade tag', () => {
      const tag = component['selectedTags']()[0];
      component['removeTag'](tag);
      expect(component['selectedTags']().find(t => t.id === tag.id)).toBeUndefined();
    });

    it('should filter available tags excluding selected ones (AC #7)', () => {
      const filtered = component['filteredTags']();
      // Only 'HVAC' should be available (Plumber and Electrician are selected)
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('HVAC');
    });

    it('should call createTradeTag for new tags (AC #8)', async () => {
      await component['createAndAddTag']('New Trade');
      expect(mockVendorStore.createTradeTag).toHaveBeenCalledWith('New Trade');
    });

    it('should check if tag exists', () => {
      expect(component['tagExists']('Plumber')).toBe(true);
      expect(component['tagExists']('NonExistent')).toBe(false);
    });
  });

  describe('form submission (AC #12, #14)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should not submit if form is invalid', () => {
      component['form'].get('firstName')?.setValue('');
      component['onSubmit']();
      expect(mockVendorStore.updateVendor).not.toHaveBeenCalled();
    });

    it('should call updateVendor with correct data (AC #12)', () => {
      component['onSubmit']();

      expect(mockVendorStore.updateVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'vendor-123',
          request: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
          }),
        })
      );
    });

    it('should include phones in update request', () => {
      component['onSubmit']();

      const call = mockVendorStore.updateVendor.mock.calls[0][0];
      expect(call.request.phones).toHaveLength(2);
      expect(call.request.phones[0].number).toBe('512-555-1234');
    });

    it('should include emails in update request', () => {
      component['onSubmit']();

      const call = mockVendorStore.updateVendor.mock.calls[0][0];
      expect(call.request.emails).toContain('john@example.com');
    });

    it('should include trade tag IDs in update request (AC #15)', () => {
      component['onSubmit']();

      const call = mockVendorStore.updateVendor.mock.calls[0][0];
      expect(call.request.tradeTagIds).toContain('tag-1');
      expect(call.request.tradeTagIds).toContain('tag-2');
    });

    it('should disable Save button when saving', () => {
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const saveButton = fixture.debugElement.query(
        By.css('button[type="submit"]')
      );
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should show spinner when saving', () => {
      mockVendorStore.isSaving.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('button[type="submit"] mat-spinner'));
      expect(spinner).toBeTruthy();
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should require first name', () => {
      component['form'].get('firstName')?.setValue('');
      expect(component['form'].get('firstName')?.hasError('required')).toBe(true);
    });

    it('should require last name', () => {
      component['form'].get('lastName')?.setValue('');
      expect(component['form'].get('lastName')?.hasError('required')).toBe(true);
    });

    it('should not require middle name', () => {
      component['form'].get('middleName')?.setValue('');
      expect(component['form'].get('middleName')?.valid).toBe(true);
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should navigate to vendor detail on cancel (Story 8.9 AC #6)', () => {
      component['onCancel']();
      // Now navigates to vendor detail instead of list
      expect(router.navigate).toHaveBeenCalledWith(['/vendors', 'vendor-123']);
    });

    it('should clear selected vendor on destroy', () => {
      component.ngOnDestroy();
      expect(mockVendorStore.clearSelectedVendor).toHaveBeenCalled();
    });
  });

  describe('save button disabled state (AC-B1)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should disable Save button when form is pristine and tags unchanged', () => {
      fixture.detectChanges();
      const saveButton = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(saveButton.nativeElement.disabled).toBe(true);
    });

    it('should enable Save button when form field is modified', () => {
      component['form'].get('firstName')?.setValue('Jane');
      component['form'].markAsDirty();
      fixture.detectChanges();
      const saveButton = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(saveButton.nativeElement.disabled).toBe(false);
    });

    it('should enable Save button when only trade tags change', () => {
      const newTag = { id: 'tag-3', name: 'HVAC' };
      component['selectedTags'].update(tags => [...tags, newTag]);
      fixture.detectChanges();
      const saveButton = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(saveButton.nativeElement.disabled).toBe(false);
    });
  });

  describe('unsaved changes detection (AC #4, #5)', () => {
    beforeEach(() => {
      setupWithVendor();
    });

    it('should implement HasUnsavedChanges interface', () => {
      expect(typeof component.hasUnsavedChanges).toBe('function');
    });

    it('should return false when form is pristine and tags unchanged', () => {
      // Form just loaded - should be pristine
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('should return true when form field is modified (dirty)', () => {
      component['form'].get('firstName')?.setValue('Jane');
      component['form'].markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should return true when phone is added', () => {
      component['addPhone']();
      component['form'].markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should return true when email is added', () => {
      component['addEmail']();
      component['form'].markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should return true when trade tag is added', () => {
      const newTag = { id: 'tag-3', name: 'HVAC' };
      component['selectedTags'].update(tags => [...tags, newTag]);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should return true when trade tag is removed', () => {
      const tagToRemove = component['selectedTags']()[0];
      component['removeTag'](tagToRemove);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should return false after form is reset to original values', () => {
      // Modify form
      component['form'].get('firstName')?.setValue('Jane');
      component['form'].markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);

      // Reset to original
      component['form'].get('firstName')?.setValue('John');
      component['form'].markAsPristine();
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('should return false when save is in progress (allow navigation on success)', () => {
      // Make form dirty
      component['form'].get('firstName')?.setValue('Jane');
      component['form'].markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);

      // Simulate save in progress - should allow navigation
      mockVendorStore.isSaving.set(true);
      expect(component.hasUnsavedChanges()).toBe(false);

      // Save failed - should warn again
      mockVendorStore.isSaving.set(false);
      expect(component.hasUnsavedChanges()).toBe(true);
    });
  });
});
