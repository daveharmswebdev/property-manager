import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { VendorsComponent } from './vendors.component';
import { VendorStore } from './stores/vendor.store';
import { VendorDto } from '../../core/api/api.service';

describe('VendorsComponent', () => {
  let component: VendorsComponent;
  let fixture: ComponentFixture<VendorsComponent>;
  let mockVendorStore: {
    vendors: ReturnType<typeof signal<VendorDto[]>>;
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

  const mockVendors: VendorDto[] = [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      phones: [
        { number: '512-555-1234', label: 'Mobile' },
        { number: '512-555-5678', label: 'Office' },
      ],
      emails: ['john@example.com', 'john.doe@work.com'],
      tradeTags: [
        { id: 'tag-1', name: 'Plumber' },
        { id: 'tag-2', name: 'General Contractor' },
      ],
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      fullName: 'Jane Smith',
      phones: [],
      emails: [],
      tradeTags: [],
    },
  ];

  const vendorWithFullDetails: VendorDto = {
    id: '3',
    firstName: 'Bob',
    lastName: 'Builder',
    fullName: 'Bob Builder',
    phones: [{ number: '555-123-4567', label: 'Mobile' }],
    emails: ['bob@builder.com'],
    tradeTags: [{ id: 'tag-3', name: 'Electrician' }],
  };

  beforeEach(async () => {
    mockVendorStore = {
      vendors: signal<VendorDto[]>([]),
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
      imports: [VendorsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call loadVendors on init', () => {
    fixture.detectChanges();
    expect(mockVendorStore.loadVendors).toHaveBeenCalled();
  });

  describe('Page Header (AC #1)', () => {
    it('should display page title', () => {
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('h1'));
      expect(title.nativeElement.textContent).toBe('Vendors');
    });

    it('should display Add Vendor button in header (AC #1)', () => {
      fixture.detectChanges();
      const addButton = fixture.debugElement.query(
        By.css('.page-header button[routerLink="/vendors/new"]')
      );
      expect(addButton).toBeTruthy();
      expect(addButton.nativeElement.textContent).toContain('Add Vendor');
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      mockVendorStore.isLoading.set(true);
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });

    it('should display loading text', () => {
      mockVendorStore.isLoading.set(true);
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();

      const loadingText = fixture.debugElement.query(
        By.css('.loading-container p')
      );
      expect(loadingText.nativeElement.textContent).toContain('Loading vendors');
    });

    it('should not display loading when isLoading is false', () => {
      mockVendorStore.isLoading.set(false);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('.loading-container'));
      expect(spinner).toBeFalsy();
    });
  });

  describe('Error State', () => {
    it('should display error card when error exists', () => {
      mockVendorStore.error.set('Failed to load vendors');
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();

      const errorCard = fixture.debugElement.query(By.css('.error-card'));
      expect(errorCard).toBeTruthy();
    });

    it('should display error message', () => {
      mockVendorStore.error.set('Failed to load vendors');
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();

      const errorText = fixture.debugElement.query(By.css('.error-card p'));
      expect(errorText.nativeElement.textContent).toContain('Failed to load vendors');
    });

    it('should display Try Again button on error', () => {
      mockVendorStore.error.set('Failed to load vendors');
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();

      const retryButton = fixture.debugElement.query(
        By.css('.error-card button')
      );
      expect(retryButton).toBeTruthy();
      expect(retryButton.nativeElement.textContent).toContain('Try Again');
    });

    it('should call loadVendors when Try Again clicked', () => {
      mockVendorStore.error.set('Failed to load vendors');
      mockVendorStore.isEmpty.set(false);
      fixture.detectChanges();
      mockVendorStore.loadVendors.mockClear();

      const retryButton = fixture.debugElement.query(
        By.css('.error-card button')
      );
      retryButton.nativeElement.click();

      expect(mockVendorStore.loadVendors).toHaveBeenCalled();
    });
  });

  describe('Empty State (AC #2)', () => {
    it('should display empty state card when isEmpty is true', () => {
      mockVendorStore.isEmpty.set(true);
      mockVendorStore.hasVendors.set(false);
      fixture.detectChanges();

      const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
      expect(emptyCard).toBeTruthy();
    });

    it('should display "No vendors yet" message (AC #2)', () => {
      mockVendorStore.isEmpty.set(true);
      mockVendorStore.hasVendors.set(false);
      fixture.detectChanges();

      const heading = fixture.debugElement.query(By.css('.empty-state-card h2'));
      expect(heading.nativeElement.textContent).toContain('No vendors yet');
    });

    it('should display "Add your first vendor to get started" message (AC #2)', () => {
      mockVendorStore.isEmpty.set(true);
      mockVendorStore.hasVendors.set(false);
      fixture.detectChanges();

      const message = fixture.debugElement.query(By.css('.empty-state-card p'));
      expect(message.nativeElement.textContent).toContain(
        'Add your first vendor to get started'
      );
    });

    it('should display Add Vendor button in empty state (AC #2)', () => {
      mockVendorStore.isEmpty.set(true);
      mockVendorStore.hasVendors.set(false);
      fixture.detectChanges();

      const addButton = fixture.debugElement.query(
        By.css('.empty-state-card button[routerLink="/vendors/new"]')
      );
      expect(addButton).toBeTruthy();
    });

    it('should not display empty state when hasVendors is true', () => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set(mockVendors);
      fixture.detectChanges();

      const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
      expect(emptyCard).toBeFalsy();
    });
  });

  describe('Vendor List (AC #4)', () => {
    beforeEach(() => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set(mockVendors);
      mockVendorStore.totalCount.set(2);
    });

    it('should display vendor list when hasVendors is true', () => {
      fixture.detectChanges();

      const vendorList = fixture.debugElement.query(By.css('.vendor-list'));
      expect(vendorList).toBeTruthy();
    });

    it('should display all vendors in the list (AC #4)', () => {
      fixture.detectChanges();

      const vendorCards = fixture.debugElement.queryAll(By.css('.vendor-card'));
      expect(vendorCards.length).toBe(2);
    });

    it('should display vendor full name (AC #4)', () => {
      fixture.detectChanges();

      const vendorNames = fixture.debugElement.queryAll(By.css('.vendor-name'));
      expect(vendorNames[0].nativeElement.textContent).toContain('John Doe');
      expect(vendorNames[1].nativeElement.textContent).toContain('Jane Smith');
    });

    it('should display person icon for each vendor', () => {
      fixture.detectChanges();

      const icons = fixture.debugElement.queryAll(By.css('.vendor-icon'));
      expect(icons.length).toBe(2);
    });

    it('should display trade tags as chips (AC #1)', () => {
      fixture.detectChanges();

      // First vendor has 2 trade tags
      const tradeTagChips = fixture.debugElement.queryAll(By.css('.trade-tag-chip'));
      expect(tradeTagChips.length).toBe(2); // Only John Doe has trade tags, Jane has none
      expect(tradeTagChips[0].nativeElement.textContent).toContain('Plumber');
      expect(tradeTagChips[1].nativeElement.textContent).toContain('General Contractor');
    });

    it('should display primary phone number (AC #1)', () => {
      fixture.detectChanges();

      const phoneSpans = fixture.debugElement.queryAll(By.css('.vendor-phone'));
      // Only John Doe has phones
      expect(phoneSpans.length).toBe(1);
      expect(phoneSpans[0].nativeElement.textContent).toContain('512-555-1234');
    });

    it('should display primary email (AC #1)', () => {
      fixture.detectChanges();

      const emailSpans = fixture.debugElement.queryAll(By.css('.vendor-email'));
      // Only John Doe has emails
      expect(emailSpans.length).toBe(1);
      expect(emailSpans[0].nativeElement.textContent).toContain('john@example.com');
    });

    it('should not display phone/email when vendor has none (AC #1)', () => {
      // Jane Smith has no phones or emails
      fixture.detectChanges();

      const vendorCards = fixture.debugElement.queryAll(By.css('.vendor-card'));
      const janeCard = vendorCards[1]; // Second vendor is Jane

      const phoneInJane = janeCard.query(By.css('.vendor-phone'));
      const emailInJane = janeCard.query(By.css('.vendor-email'));
      const tagsInJane = janeCard.query(By.css('.trade-tags'));

      expect(phoneInJane).toBeFalsy();
      expect(emailInJane).toBeFalsy();
      expect(tagsInJane).toBeFalsy();
    });

    it('should not display trade tags section when vendor has none (AC #1)', () => {
      fixture.detectChanges();

      const vendorCards = fixture.debugElement.queryAll(By.css('.vendor-card'));
      const janeCard = vendorCards[1]; // Jane has no trade tags

      const tradeTags = janeCard.query(By.css('.trade-tags'));
      expect(tradeTags).toBeFalsy();
    });

    it('should have cursor pointer for clickable cards (AC #4)', () => {
      fixture.detectChanges();

      const vendorCards = fixture.debugElement.queryAll(By.css('.vendor-card'));
      expect(vendorCards.length).toBe(2);

      // Verify cards have the cursor: pointer style for clickability
      const johnCard = vendorCards[0];
      const styles = getComputedStyle(johnCard.nativeElement);
      expect(styles.cursor).toBe('pointer');
    });
  });

  describe('Vendor with Full Details Display', () => {
    beforeEach(() => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set([vendorWithFullDetails]);
      mockVendorStore.totalCount.set(1);
    });

    it('should display all vendor details correctly', () => {
      fixture.detectChanges();

      const vendorName = fixture.debugElement.query(By.css('.vendor-name'));
      expect(vendorName.nativeElement.textContent).toContain('Bob Builder');

      const phone = fixture.debugElement.query(By.css('.vendor-phone'));
      expect(phone.nativeElement.textContent).toContain('555-123-4567');

      const email = fixture.debugElement.query(By.css('.vendor-email'));
      expect(email.nativeElement.textContent).toContain('bob@builder.com');

      const tradeTag = fixture.debugElement.query(By.css('.trade-tag-chip'));
      expect(tradeTag.nativeElement.textContent).toContain('Electrician');
    });
  });
});
