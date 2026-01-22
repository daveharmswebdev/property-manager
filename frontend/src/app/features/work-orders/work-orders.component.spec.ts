import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { WorkOrdersComponent } from './work-orders.component';
import { WorkOrderStore } from './stores/work-order.store';
import { PropertyStore } from '../properties/stores/property.store';

describe('WorkOrdersComponent', () => {
  let component: WorkOrdersComponent;
  let fixture: ComponentFixture<WorkOrdersComponent>;
  let mockWorkOrderStore: {
    workOrders: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    hasWorkOrders: ReturnType<typeof signal<boolean>>;
    workOrderCount: ReturnType<typeof signal<number>>;
    loadWorkOrders: ReturnType<typeof vi.fn>;
    // Filter state (Story 9-7)
    selectedStatuses: ReturnType<typeof signal<string[]>>;
    selectedPropertyId: ReturnType<typeof signal<string | null>>;
    hasActiveFilters: ReturnType<typeof signal<boolean>>;
    isFilteredEmpty: ReturnType<typeof signal<boolean>>;
    setStatusFilter: ReturnType<typeof vi.fn>;
    setPropertyFilter: ReturnType<typeof vi.fn>;
    clearFilters: ReturnType<typeof vi.fn>;
  };
  let mockPropertyStore: {
    properties: ReturnType<typeof signal>;
    isLoading: ReturnType<typeof signal<boolean>>;
    loadProperties: ReturnType<typeof vi.fn>;
  };

  const mockWorkOrders = [
    {
      id: 'wo-1',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      description: 'Fix the faucet',
      status: 'Reported',
      isDiy: true,
      vendorId: null,
      vendorName: null,
      categoryName: 'Plumbing',
      tags: [],
      createdAt: '2026-01-20T10:00:00Z',
    },
    {
      id: 'wo-2',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      description: 'Fix the roof',
      status: 'Assigned',
      isDiy: false,
      vendorId: 'vendor-1',
      vendorName: 'John Plumber',
      categoryName: null,
      tags: [{ id: 'tag-1', name: 'Urgent' }],
      createdAt: '2026-01-19T10:00:00Z',
    },
    {
      id: 'wo-3',
      propertyId: 'prop-2',
      propertyName: 'Other Property',
      description: 'Paint the walls',
      status: 'Completed',
      isDiy: false,
      vendorId: 'vendor-2',
      vendorName: null, // Vendor was deleted but FK preserved
      categoryName: 'Painting',
      tags: [],
      createdAt: '2026-01-18T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockWorkOrderStore = {
      workOrders: signal(mockWorkOrders),
      isLoading: signal(false),
      isEmpty: signal(false),
      hasWorkOrders: signal(true),
      workOrderCount: signal(3),
      loadWorkOrders: vi.fn(),
      // Filter state (Story 9-7)
      selectedStatuses: signal(['Reported', 'Assigned', 'Completed']),
      selectedPropertyId: signal(null),
      hasActiveFilters: signal(false),
      isFilteredEmpty: signal(false),
      setStatusFilter: vi.fn(),
      setPropertyFilter: vi.fn(),
      clearFilters: vi.fn(),
    };

    mockPropertyStore = {
      properties: signal([
        { id: 'prop-1', name: 'Test Property' },
        { id: 'prop-2', name: 'Other Property' },
      ]),
      isLoading: signal(false),
      loadProperties: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrdersComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: PropertyStore, useValue: mockPropertyStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load work orders on init', () => {
    expect(mockWorkOrderStore.loadWorkOrders).toHaveBeenCalled();
  });

  describe('Assignee Display (Story 9-4 AC #11)', () => {
    it('should display "Self (DIY)" with person icon for DIY work orders', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const diyCard = cards[0]; // First work order is DIY

      const assignee = diyCard.query(By.css('.assignee'));
      expect(assignee).toBeTruthy();

      const icon = assignee.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('person');

      expect(assignee.nativeElement.textContent).toContain('Self (DIY)');
    });

    it('should display vendor name with engineering icon for vendor-assigned work orders', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const vendorCard = cards[1]; // Second work order has vendor

      const assignee = vendorCard.query(By.css('.assignee'));
      expect(assignee).toBeTruthy();

      const icon = assignee.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('engineering');

      expect(assignee.nativeElement.textContent).toContain('John Plumber');
    });

    it('should display "Unknown Vendor" when vendorName is null but isDiy is false', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const unknownVendorCard = cards[2]; // Third work order has null vendorName

      const assignee = unknownVendorCard.query(By.css('.assignee'));
      expect(assignee).toBeTruthy();

      const icon = assignee.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('engineering');

      expect(assignee.nativeElement.textContent).toContain('Unknown Vendor');
    });

    it('should show assignee for each work order card', () => {
      const assignees = fixture.debugElement.queryAll(By.css('.assignee'));
      expect(assignees.length).toBe(3);
    });
  });

  describe('Loading State', () => {
    it('should show spinner when loading', () => {
      mockWorkOrderStore.isLoading.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no work orders', () => {
      mockWorkOrderStore.isEmpty.set(true);
      mockWorkOrderStore.workOrders.set([]);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.css('.empty-state'));
      expect(emptyState).toBeTruthy();
      expect(emptyState.nativeElement.textContent).toContain('No work orders yet');
    });
  });

  describe('Status Badge Display (Story 9-6 AC #1)', () => {
    it('should render status as badge with status-reported class for Reported status', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const reportedCard = cards[0]; // First work order has Reported status

      const statusBadge = reportedCard.query(By.css('.status-badge'));
      expect(statusBadge).toBeTruthy();
      expect(statusBadge.nativeElement.classList).toContain('status-reported');
      expect(statusBadge.nativeElement.textContent.trim()).toBe('Reported');
    });

    it('should render status as badge with status-assigned class for Assigned status', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const assignedCard = cards[1]; // Second work order has Assigned status

      const statusBadge = assignedCard.query(By.css('.status-badge'));
      expect(statusBadge).toBeTruthy();
      expect(statusBadge.nativeElement.classList).toContain('status-assigned');
      expect(statusBadge.nativeElement.textContent.trim()).toBe('Assigned');
    });

    it('should render status as badge with status-completed class for Completed status', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const completedCard = cards[2]; // Third work order has Completed status

      const statusBadge = completedCard.query(By.css('.status-badge'));
      expect(statusBadge).toBeTruthy();
      expect(statusBadge.nativeElement.classList).toContain('status-completed');
      expect(statusBadge.nativeElement.textContent.trim()).toBe('Completed');
    });

    it('should show status badge for each work order card', () => {
      const statusBadges = fixture.debugElement.queryAll(By.css('.status-badge'));
      expect(statusBadges.length).toBe(3);
    });
  });

  describe('Created Date Display (Story 9-6 AC #1)', () => {
    it('should display created date on work order card', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const firstCard = cards[0];

      const createdDate = firstCard.query(By.css('.created-date'));
      expect(createdDate).toBeTruthy();
      // Check that date is formatted (mediumDate format: Jan 20, 2026)
      expect(createdDate.nativeElement.textContent).toContain('Jan 20, 2026');
    });

    it('should show calendar icon with created date', () => {
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      const firstCard = cards[0];

      const dateIcon = firstCard.query(By.css('.created-date mat-icon'));
      expect(dateIcon).toBeTruthy();
      expect(dateIcon.nativeElement.textContent.trim()).toBe('calendar_today');
    });

    it('should display created date for all work order cards', () => {
      const createdDates = fixture.debugElement.queryAll(By.css('.created-date'));
      expect(createdDates.length).toBe(3);
    });
  });

  describe('Work Order Sorting (Story 9-6 AC #3)', () => {
    it('should display work orders in order from store (sorted by createdAt DESC)', () => {
      // The store is responsible for sorting, component just displays in order
      // Mock data is already in newest-first order (wo-1: Jan 20, wo-2: Jan 19, wo-3: Jan 18)
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));

      // Verify order matches store order
      const firstCardTitle = cards[0].query(By.css('mat-card-title'));
      const secondCardTitle = cards[1].query(By.css('mat-card-title'));
      const thirdCardTitle = cards[2].query(By.css('mat-card-title'));

      expect(firstCardTitle.nativeElement.textContent.trim()).toBe('Test Property');
      expect(secondCardTitle.nativeElement.textContent.trim()).toBe('Test Property');
      expect(thirdCardTitle.nativeElement.textContent.trim()).toBe('Other Property');

      // Verify dates are in descending order
      const createdDates = fixture.debugElement.queryAll(By.css('.created-date'));
      expect(createdDates[0].nativeElement.textContent).toContain('Jan 20, 2026');
      expect(createdDates[1].nativeElement.textContent).toContain('Jan 19, 2026');
      expect(createdDates[2].nativeElement.textContent).toContain('Jan 18, 2026');
    });
  });

  // Story 9-7: Filter Work Orders Tests
  describe('Filter Controls (Story 9-7 AC #1)', () => {
    it('should render filter section', () => {
      const filterSection = fixture.debugElement.query(By.css('.filter-section'));
      expect(filterSection).toBeTruthy();
    });

    it('should render status filter chips (Reported, Assigned, Completed)', () => {
      const statusChips = fixture.debugElement.queryAll(By.css('mat-chip-option'));
      expect(statusChips.length).toBe(3);

      const chipTexts = statusChips.map((chip) => chip.nativeElement.textContent.trim());
      expect(chipTexts).toContain('Reported');
      expect(chipTexts).toContain('Assigned');
      expect(chipTexts).toContain('Completed');
    });

    it('should render property filter dropdown', () => {
      const propertySelect = fixture.debugElement.query(By.css('.property-filter mat-select'));
      expect(propertySelect).toBeTruthy();
    });

    it('should load properties on init', () => {
      expect(mockPropertyStore.loadProperties).toHaveBeenCalled();
    });
  });

  describe('Status Filter Behavior (Story 9-7 AC #2)', () => {
    it('should call setStatusFilter when status chips change', () => {
      const chipListbox = fixture.debugElement.query(By.css('mat-chip-listbox'));
      chipListbox.triggerEventHandler('change', { value: ['Reported', 'Assigned'] });

      expect(mockWorkOrderStore.setStatusFilter).toHaveBeenCalledWith(['Reported', 'Assigned']);
    });
  });

  describe('Property Filter Behavior (Story 9-7 AC #3)', () => {
    it('should call setPropertyFilter when property dropdown changes', () => {
      component.onPropertyFilterChange('prop-1');
      expect(mockWorkOrderStore.setPropertyFilter).toHaveBeenCalledWith('prop-1');
    });

    it('should call setPropertyFilter with null for "All Properties"', () => {
      component.onPropertyFilterChange(null);
      expect(mockWorkOrderStore.setPropertyFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('Active Filter Indicators (Story 9-7 AC #5)', () => {
    it('should show clear filters button when hasActiveFilters is true', () => {
      mockWorkOrderStore.hasActiveFilters.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.query(By.css('.clear-filters-btn'));
      expect(clearButton).toBeTruthy();
      expect(clearButton.nativeElement.textContent).toContain('Clear filters');
    });

    it('should not show clear filters button when hasActiveFilters is false', () => {
      mockWorkOrderStore.hasActiveFilters.set(false);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.query(By.css('.clear-filters-btn'));
      expect(clearButton).toBeFalsy();
    });
  });

  describe('Clear Filters (Story 9-7 AC #6)', () => {
    it('should call clearFilters when clear button clicked', () => {
      mockWorkOrderStore.hasActiveFilters.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.query(By.css('.clear-filters-btn'));
      clearButton.nativeElement.click();

      expect(mockWorkOrderStore.clearFilters).toHaveBeenCalled();
    });
  });

  describe('Empty Filter Results (Story 9-7 AC #7)', () => {
    it('should show filtered empty state when isFilteredEmpty is true', () => {
      mockWorkOrderStore.workOrders.set([]);
      mockWorkOrderStore.isFilteredEmpty.set(true);
      mockWorkOrderStore.isEmpty.set(true);
      fixture.detectChanges();

      const filteredEmpty = fixture.debugElement.query(By.css('.filtered-empty'));
      expect(filteredEmpty).toBeTruthy();
      expect(filteredEmpty.nativeElement.textContent).toContain('No work orders match your filters');
    });

    it('should show clear filters button in filtered empty state', () => {
      mockWorkOrderStore.workOrders.set([]);
      mockWorkOrderStore.isFilteredEmpty.set(true);
      mockWorkOrderStore.isEmpty.set(true);
      fixture.detectChanges();

      const clearButton = fixture.debugElement.query(By.css('.filtered-empty button'));
      expect(clearButton).toBeTruthy();
      expect(clearButton.nativeElement.textContent).toContain('Clear filters');
    });

    it('should show regular empty state when isEmpty is true but isFilteredEmpty is false', () => {
      mockWorkOrderStore.workOrders.set([]);
      mockWorkOrderStore.isFilteredEmpty.set(false);
      mockWorkOrderStore.isEmpty.set(true);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.css('.empty-state:not(.filtered-empty)'));
      expect(emptyState).toBeTruthy();
      expect(emptyState.nativeElement.textContent).toContain('No work orders yet');
    });
  });
});
