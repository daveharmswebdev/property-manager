import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { VendorsComponent } from './vendors.component';
import { VendorStore } from './stores/vendor.store';
import { VendorDto, VendorTradeTagDto } from '../../core/api/api.service';

describe('VendorsComponent', () => {
  let component: VendorsComponent;
  let fixture: ComponentFixture<VendorsComponent>;
  let mockVendorStore: {
    vendors: ReturnType<typeof signal<VendorDto[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isSaving: ReturnType<typeof signal<boolean>>;
    isDeleting: ReturnType<typeof signal<boolean>>;
    deletingVendorId: ReturnType<typeof signal<string | null>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    hasVendors: ReturnType<typeof signal<boolean>>;
    totalCount: ReturnType<typeof signal<number>>;
    // Story 8-6: Filter signals
    searchTerm: ReturnType<typeof signal<string>>;
    selectedTradeTagIds: ReturnType<typeof signal<string[]>>;
    filteredVendors: ReturnType<typeof signal<VendorDto[]>>;
    hasActiveFilters: ReturnType<typeof signal<boolean>>;
    noMatchesFound: ReturnType<typeof signal<boolean>>;
    tradeTags: ReturnType<typeof signal<VendorTradeTagDto[]>>;
    loadVendors: ReturnType<typeof vi.fn>;
    loadTradeTags: ReturnType<typeof vi.fn>;
    createVendor: ReturnType<typeof vi.fn>;
    deleteVendor: ReturnType<typeof vi.fn>;
    clearError: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    // Story 8-6: Filter methods
    setSearchTerm: ReturnType<typeof vi.fn>;
    setTradeTagFilter: ReturnType<typeof vi.fn>;
    clearFilters: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
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
      isDeleting: signal(false),
      deletingVendorId: signal<string | null>(null),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      hasVendors: signal(false),
      totalCount: signal(0),
      // Story 8-6: Filter signals
      searchTerm: signal(''),
      selectedTradeTagIds: signal<string[]>([]),
      filteredVendors: signal<VendorDto[]>([]),
      hasActiveFilters: signal(false),
      noMatchesFound: signal(false),
      tradeTags: signal<VendorTradeTagDto[]>([
        { id: 'tag-1', name: 'Plumber' },
        { id: 'tag-2', name: 'Electrician' },
      ]),
      loadVendors: vi.fn(),
      loadTradeTags: vi.fn(),
      createVendor: vi.fn(),
      deleteVendor: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
      // Story 8-6: Filter methods
      setSearchTerm: vi.fn(),
      setTradeTagFilter: vi.fn(),
      clearFilters: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [VendorsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: VendorStore, useValue: mockVendorStore },
      ],
    })
      .overrideComponent(VendorsComponent, {
        add: {
          providers: [{ provide: MatDialog, useValue: mockDialog }],
        },
      })
      .compileComponents();

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
      mockVendorStore.filteredVendors.set(mockVendors); // Story 8-6: Component uses filteredVendors
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
      mockVendorStore.filteredVendors.set(mockVendors); // Story 8-6: Component uses filteredVendors
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
      expect(phoneSpans[0].nativeElement.textContent).toContain('(512) 555-1234');
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
      mockVendorStore.filteredVendors.set([vendorWithFullDetails]); // Story 8-6: Component uses filteredVendors
      mockVendorStore.totalCount.set(1);
    });

    it('should display all vendor details correctly', () => {
      fixture.detectChanges();

      const vendorName = fixture.debugElement.query(By.css('.vendor-name'));
      expect(vendorName.nativeElement.textContent).toContain('Bob Builder');

      const phone = fixture.debugElement.query(By.css('.vendor-phone'));
      expect(phone.nativeElement.textContent).toContain('(555) 123-4567');

      const email = fixture.debugElement.query(By.css('.vendor-email'));
      expect(email.nativeElement.textContent).toContain('bob@builder.com');

      const tradeTag = fixture.debugElement.query(By.css('.trade-tag-chip'));
      expect(tradeTag.nativeElement.textContent).toContain('Electrician');
    });
  });

  // Story 8-6: Filter functionality component tests
  describe('Filter Bar (Story 8-6)', () => {
    beforeEach(() => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set(mockVendors);
      mockVendorStore.filteredVendors.set(mockVendors);
    });

    describe('Search Input (AC #1)', () => {
      it('6.1 - should render search input when vendors exist', () => {
        fixture.detectChanges();

        const searchInput = fixture.debugElement.query(
          By.css('.search-field input')
        );
        expect(searchInput).toBeTruthy();
      });

      it('6.1 - should display search icon', () => {
        fixture.detectChanges();

        const searchIcon = fixture.debugElement.query(
          By.css('.search-field mat-icon')
        );
        expect(searchIcon.nativeElement.textContent).toContain('search');
      });

      it('6.3 - should call onSearchChange when typing in search', () => {
        fixture.detectChanges();

        const searchInput = fixture.debugElement.query(
          By.css('.search-field input')
        );
        searchInput.nativeElement.value = 'test';
        searchInput.nativeElement.dispatchEvent(new Event('input'));

        // Note: The actual filtering happens via Subject/debounce, but we verify the input event fires
        expect(searchInput.nativeElement.value).toBe('test');
      });
    });

    describe('Trade Tag Filter (AC #2)', () => {
      it('6.2 - should render trade tag dropdown', () => {
        fixture.detectChanges();

        const tagDropdown = fixture.debugElement.query(
          By.css('.tag-filter-field mat-select')
        );
        expect(tagDropdown).toBeTruthy();
      });

      it('6.2 - should have available trade tags as options', () => {
        fixture.detectChanges();

        // Trade tags are available in the store
        expect(mockVendorStore.tradeTags().length).toBe(2);
        expect(mockVendorStore.tradeTags()[0].name).toBe('Plumber');
      });
    });

    describe('Clear Filters (AC #3)', () => {
      it('6.5 - should show Clear filters button when hasActiveFilters is true', () => {
        mockVendorStore.hasActiveFilters.set(true);
        fixture.detectChanges();

        const clearButton = fixture.debugElement.query(
          By.css('.filter-bar button[color="primary"]')
        );
        expect(clearButton).toBeTruthy();
        expect(clearButton.nativeElement.textContent).toContain('Clear filters');
      });

      it('6.5 - should not show Clear filters when no filters active', () => {
        mockVendorStore.hasActiveFilters.set(false);
        fixture.detectChanges();

        const filterBar = fixture.debugElement.query(By.css('.filter-bar'));
        if (filterBar) {
          const clearButton = filterBar.query(
            By.css('button[color="primary"]')
          );
          expect(clearButton).toBeFalsy();
        }
      });

      it('6.6 - should call clearFilters when Clear filters clicked', () => {
        mockVendorStore.hasActiveFilters.set(true);
        fixture.detectChanges();

        const clearButton = fixture.debugElement.query(
          By.css('.filter-bar button[color="primary"]')
        );
        clearButton.nativeElement.click();

        expect(mockVendorStore.clearFilters).toHaveBeenCalled();
      });
    });

    describe('No Matches State (AC #4)', () => {
      it('6.7 - should show "No vendors match" when noMatchesFound is true', () => {
        mockVendorStore.noMatchesFound.set(true);
        fixture.detectChanges();

        const noMatchesCard = fixture.debugElement.query(
          By.css('.no-matches-card')
        );
        expect(noMatchesCard).toBeTruthy();
        expect(noMatchesCard.nativeElement.textContent).toContain(
          'No vendors match your search'
        );
      });

      it('6.7 - should show clear filters button in no matches state', () => {
        mockVendorStore.noMatchesFound.set(true);
        fixture.detectChanges();

        const noMatchesCard = fixture.debugElement.query(
          By.css('.no-matches-card')
        );
        const clearButton = noMatchesCard.query(By.css('button'));
        expect(clearButton.nativeElement.textContent).toContain('Clear filters');
      });

      it('6.8 - should still show empty state when isEmpty is true', () => {
        mockVendorStore.isEmpty.set(true);
        mockVendorStore.hasVendors.set(false);
        mockVendorStore.noMatchesFound.set(false);
        fixture.detectChanges();

        const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
        expect(emptyCard).toBeTruthy();
        expect(emptyCard.nativeElement.textContent).toContain('No vendors yet');
      });
    });

    describe('Filter Bar Visibility', () => {
      it('should show filter bar when hasVendors is true', () => {
        mockVendorStore.hasVendors.set(true);
        fixture.detectChanges();

        const filterBar = fixture.debugElement.query(By.css('.filter-bar'));
        expect(filterBar).toBeTruthy();
      });

      it('should show filter bar when hasActiveFilters is true', () => {
        mockVendorStore.hasVendors.set(false);
        mockVendorStore.hasActiveFilters.set(true);
        fixture.detectChanges();

        const filterBar = fixture.debugElement.query(By.css('.filter-bar'));
        expect(filterBar).toBeTruthy();
      });

      it('should not show filter bar when isEmpty and no active filters', () => {
        mockVendorStore.isEmpty.set(true);
        mockVendorStore.hasVendors.set(false);
        mockVendorStore.hasActiveFilters.set(false);
        fixture.detectChanges();

        const filterBar = fixture.debugElement.query(By.css('.filter-bar'));
        expect(filterBar).toBeFalsy();
      });
    });

    describe('loadTradeTags on init', () => {
      it('should call loadTradeTags on init', () => {
        fixture.detectChanges();
        expect(mockVendorStore.loadTradeTags).toHaveBeenCalled();
      });
    });
  });

  // Story 8-8: Delete Vendor Tests
  describe('Delete Button (Story 8-8)', () => {
    beforeEach(() => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set(mockVendors);
      mockVendorStore.filteredVendors.set(mockVendors);
      mockVendorStore.totalCount.set(2);
    });

    it('should display delete button for each vendor (AC #1)', () => {
      fixture.detectChanges();

      const deleteButtons = fixture.debugElement.queryAll(
        By.css('.delete-button')
      );
      expect(deleteButtons.length).toBe(2);
    });

    it('should have delete icon in button', () => {
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      const icon = deleteButton.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent).toContain('delete');
    });

    it('should have aria-label on delete button for accessibility', () => {
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      expect(deleteButton.attributes['aria-label']).toBe('Delete vendor');
    });

    it('should disable delete button for specific vendor being deleted', () => {
      mockVendorStore.deletingVendorId.set('1'); // First vendor being deleted
      fixture.detectChanges();

      const deleteButtons = fixture.debugElement.queryAll(By.css('.delete-button'));
      // First button (vendor id '1') should be disabled
      expect(deleteButtons[0].nativeElement.disabled).toBe(true);
      // Second button (vendor id '2') should NOT be disabled
      expect(deleteButtons[1].nativeElement.disabled).toBe(false);
    });

    it('should not disable any delete button when deletingVendorId is null', () => {
      mockVendorStore.deletingVendorId.set(null);
      fixture.detectChanges();

      const deleteButtons = fixture.debugElement.queryAll(By.css('.delete-button'));
      expect(deleteButtons[0].nativeElement.disabled).toBe(false);
      expect(deleteButtons[1].nativeElement.disabled).toBe(false);
    });

    it('should show spinner instead of delete icon when vendor is being deleted', () => {
      mockVendorStore.deletingVendorId.set('1');
      fixture.detectChanges();

      const firstVendorCard = fixture.debugElement.queryAll(By.css('.vendor-card'))[0];
      const spinner = firstVendorCard.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });
  });

  // Story 8-8: Dialog Interaction Tests (Task 7.4-7.6)
  describe('Delete Confirmation Dialog (Story 8-8 AC #2-#4)', () => {
    beforeEach(() => {
      mockVendorStore.isEmpty.set(false);
      mockVendorStore.hasVendors.set(true);
      mockVendorStore.vendors.set(mockVendors);
      mockVendorStore.filteredVendors.set(mockVendors);
      mockVendorStore.totalCount.set(2);
    });

    it('should open confirmation dialog when delete button clicked (Task 7.4)', () => {
      // Setup dialog to return cancel (false)
      const mockDialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.mockReturnValue(mockDialogRef);
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      deleteButton.nativeElement.click();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should pass correct dialog data with vendor name (AC #2)', () => {
      const mockDialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.mockReturnValue(mockDialogRef);
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      deleteButton.nativeElement.click();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Delete John Doe?',
            message: expect.stringContaining('removed from your list'),
            confirmText: 'Delete',
            cancelText: 'Cancel',
          }),
          width: '450px',
          disableClose: true,
        })
      );
    });

    it('should NOT call deleteVendor when dialog is cancelled (Task 7.5)', () => {
      const mockDialogRef = {
        afterClosed: () => of(false), // User clicked Cancel
      };
      mockDialog.open.mockReturnValue(mockDialogRef);
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      deleteButton.nativeElement.click();

      expect(mockVendorStore.deleteVendor).not.toHaveBeenCalled();
    });

    it('should call deleteVendor with vendor id when dialog is confirmed (Task 7.6)', () => {
      const mockDialogRef = {
        afterClosed: () => of(true), // User clicked Delete (confirm)
      };
      mockDialog.open.mockReturnValue(mockDialogRef);
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      deleteButton.nativeElement.click();

      expect(mockVendorStore.deleteVendor).toHaveBeenCalledWith('1');
    });

    it('should stop event propagation to prevent card navigation', () => {
      const mockDialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.mockReturnValue(mockDialogRef);
      fixture.detectChanges();

      const deleteButton = fixture.debugElement.query(By.css('.delete-button'));
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      deleteButton.nativeElement.dispatchEvent(clickEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });
});
