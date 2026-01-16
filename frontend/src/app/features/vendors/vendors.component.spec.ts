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
    } as VendorDto,
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      fullName: 'Jane Smith',
    } as VendorDto,
  ];

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
  });
});
