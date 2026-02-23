import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
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
    deleteWorkOrder: ReturnType<typeof vi.fn>;
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
  let dialogSpy: any;

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
      primaryPhotoThumbnailUrl: null,
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
      primaryPhotoThumbnailUrl: 'http://example.com/thumb.jpg',
    },
    {
      id: 'wo-3',
      propertyId: 'prop-2',
      propertyName: 'Other Property',
      description: 'Paint the walls',
      status: 'Completed',
      isDiy: false,
      vendorId: 'vendor-2',
      vendorName: null,
      categoryName: 'Painting',
      tags: [],
      createdAt: '2026-01-18T10:00:00Z',
      primaryPhotoThumbnailUrl: null,
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
      deleteWorkOrder: vi.fn(),
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

    // Spy on the real MatDialog instance injected into the component
    const dialog = TestBed.inject(MatDialog);
    dialogSpy = vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as any);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load work orders on init', () => {
    expect(mockWorkOrderStore.loadWorkOrders).toHaveBeenCalled();
  });

  // Story 16-8: Enriched Row Layout (AC 1, 2)
  describe('Enriched Row Layout (Story 16-8 AC #1, #2)', () => {
    it('should render work orders as rows, not cards', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      expect(rows.length).toBe(3);

      // Cards should NOT exist
      const cards = fixture.debugElement.queryAll(By.css('.work-order-card'));
      expect(cards.length).toBe(0);
    });

    it('should render two-line content for each row', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0];

      const line1 = firstRow.query(By.css('.line-1'));
      const line2 = firstRow.query(By.css('.line-2'));
      expect(line1).toBeTruthy();
      expect(line2).toBeTruthy();
    });

    it('should show description as title on line 1', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0];

      const title = firstRow.query(By.css('.wo-title'));
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent.trim()).toBe('Fix the faucet');
    });

    it('should show property name on line 2', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0];

      const property = firstRow.query(By.css('.wo-property'));
      expect(property).toBeTruthy();
      expect(property.nativeElement.textContent).toContain('Test Property');
    });

    it('should show date on line 1', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0];

      const date = firstRow.query(By.css('.wo-date'));
      expect(date).toBeTruthy();
      expect(date.nativeElement.textContent).toContain('Jan 20');
    });
  });

  // Story 16-8: Assignee Display (updated selectors from AC #11 to row layout)
  describe('Assignee Display (Story 16-8 AC #2)', () => {
    it('should display "DIY" with person icon for DIY work orders', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const diyRow = rows[0];

      const assignee = diyRow.query(By.css('.wo-assignee'));
      expect(assignee).toBeTruthy();

      const icon = assignee.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('person');

      expect(assignee.nativeElement.textContent).toContain('DIY');
    });

    it('should display vendor name with engineering icon for vendor-assigned work orders', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const vendorRow = rows[1];

      const assignee = vendorRow.query(By.css('.wo-assignee'));
      expect(assignee).toBeTruthy();

      const icon = assignee.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent.trim()).toBe('engineering');

      expect(assignee.nativeElement.textContent).toContain('John Plumber');
    });

    it('should display "Unassigned" when vendorName is null but isDiy is false', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const unassignedRow = rows[2];

      const assignee = unassignedRow.query(By.css('.wo-assignee'));
      expect(assignee).toBeTruthy();
      expect(assignee.nativeElement.textContent).toContain('Unassigned');
    });

    it('should show assignee for each work order row', () => {
      const assignees = fixture.debugElement.queryAll(By.css('.wo-assignee'));
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

  // Story 16-8: Status Chip Display (AC #3)
  describe('Status Chip Display (Story 16-8 AC #3)', () => {
    it('should render status as chip with status-reported class for Reported status', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const reportedRow = rows[0];

      const statusChip = reportedRow.query(By.css('.status-chip'));
      expect(statusChip).toBeTruthy();
      expect(statusChip.nativeElement.classList).toContain('status-reported');
      expect(statusChip.nativeElement.textContent.trim()).toBe('Reported');
    });

    it('should render status as chip with status-assigned class for Assigned status', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const assignedRow = rows[1];

      const statusChip = assignedRow.query(By.css('.status-chip'));
      expect(statusChip).toBeTruthy();
      expect(statusChip.nativeElement.classList).toContain('status-assigned');
      expect(statusChip.nativeElement.textContent.trim()).toBe('Assigned');
    });

    it('should render status as chip with status-completed class for Completed status', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const completedRow = rows[2];

      const statusChip = completedRow.query(By.css('.status-chip'));
      expect(statusChip).toBeTruthy();
      expect(statusChip.nativeElement.classList).toContain('status-completed');
      expect(statusChip.nativeElement.textContent.trim()).toBe('Completed');
    });

    it('should show status chip for each work order row', () => {
      const statusChips = fixture.debugElement.queryAll(By.css('.status-chip'));
      expect(statusChips.length).toBe(3);
    });
  });

  // Story 16-8: Category Display (AC #2)
  describe('Category Display (Story 16-8 AC #2)', () => {
    it('should show category when present', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0]; // Has category 'Plumbing'

      const category = firstRow.query(By.css('.wo-category'));
      expect(category).toBeTruthy();
      expect(category.nativeElement.textContent.trim()).toBe('Plumbing');
    });

    it('should not show category when null', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const secondRow = rows[1]; // categoryName is null

      const category = secondRow.query(By.css('.wo-category'));
      expect(category).toBeFalsy();
    });
  });

  // Story 16-8: Tags Display (AC #2)
  describe('Tags Display (Story 16-8 AC #2)', () => {
    it('should show tags when present', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const secondRow = rows[1]; // Has tag 'Urgent'

      const tags = secondRow.query(By.css('.wo-tags'));
      expect(tags).toBeTruthy();
      expect(tags.nativeElement.textContent).toContain('Urgent');
    });

    it('should not show tags section when no tags', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0]; // No tags

      const tags = firstRow.query(By.css('.wo-tags'));
      expect(tags).toBeFalsy();
    });
  });

  // Story 16-8: Vendor Display on Line 2 (AC #2)
  describe('Vendor Name on Line 2 (Story 16-8 AC #2)', () => {
    it('should show vendor name on line 2 when not DIY and vendor exists', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const vendorRow = rows[1]; // Has vendorName 'John Plumber'

      const vendor = vendorRow.query(By.css('.wo-vendor'));
      expect(vendor).toBeTruthy();
      expect(vendor.nativeElement.textContent.trim()).toBe('John Plumber');
    });

    it('should not show vendor on line 2 for DIY work orders', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const diyRow = rows[0]; // isDiy = true

      const vendor = diyRow.query(By.css('.wo-vendor'));
      expect(vendor).toBeFalsy();
    });
  });

  describe('Work Order Sorting (Story 9-6 AC #3)', () => {
    it('should display work orders in order from store (sorted by createdAt DESC)', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));

      // Verify dates are in descending order
      const dates = fixture.debugElement.queryAll(By.css('.wo-date'));
      expect(dates[0].nativeElement.textContent).toContain('Jan 20');
      expect(dates[1].nativeElement.textContent).toContain('Jan 19');
      expect(dates[2].nativeElement.textContent).toContain('Jan 18');
    });
  });

  // Story 16-8: Expand/Collapse (AC #5)
  describe('Expand/Collapse (Story 16-8 AC #5)', () => {
    it('should not show expand panel by default', () => {
      const expandPanels = fixture.debugElement.queryAll(By.css('.expand-panel'));
      expect(expandPanels.length).toBe(0);
    });

    it('should show expand button on each row', () => {
      const expandBtns = fixture.debugElement.queryAll(By.css('.expand-btn'));
      expect(expandBtns.length).toBe(3);
    });

    it('should toggle expand panel on chevron click', () => {
      const expandBtns = fixture.debugElement.queryAll(By.css('.expand-btn'));
      expandBtns[0].nativeElement.click();
      fixture.detectChanges();

      // Panel should be visible
      const expandPanel = fixture.debugElement.query(By.css('.expand-panel'));
      expect(expandPanel).toBeTruthy();
      expect(expandPanel.nativeElement.textContent).toContain('Fix the faucet');

      // Click again to collapse
      expandBtns[0].nativeElement.click();
      fixture.detectChanges();

      const expandPanelAfter = fixture.debugElement.query(By.css('.expand-panel'));
      expect(expandPanelAfter).toBeFalsy();
    });

    it('should show photo thumbnail in expand panel when available', () => {
      // Expand second row (has primaryPhotoThumbnailUrl)
      const expandBtns = fixture.debugElement.queryAll(By.css('.expand-btn'));
      expandBtns[1].nativeElement.click();
      fixture.detectChanges();

      const thumbnail = fixture.debugElement.query(By.css('.expand-thumbnail'));
      expect(thumbnail).toBeTruthy();
      expect(thumbnail.nativeElement.getAttribute('src')).toBe('http://example.com/thumb.jpg');
    });

    it('should not show photo thumbnail when not available', () => {
      // Expand first row (no photo)
      const expandBtns = fixture.debugElement.queryAll(By.css('.expand-btn'));
      expandBtns[0].nativeElement.click();
      fixture.detectChanges();

      const thumbnail = fixture.debugElement.query(By.css('.expand-thumbnail'));
      expect(thumbnail).toBeFalsy();
    });

    it('should stop propagation when clicking expand chevron', () => {
      const mockEvent = new MouseEvent('click', { bubbles: true });
      vi.spyOn(mockEvent, 'stopPropagation');
      vi.spyOn(mockEvent, 'preventDefault');

      component.toggleExpand('wo-1', mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // Story 16-8: Action Icons (AC #2)
  describe('Action Icons (Story 16-8 AC #2)', () => {
    it('should show edit and delete action buttons on each row', () => {
      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const firstRow = rows[0];

      const actions = firstRow.query(By.css('.row-actions'));
      expect(actions).toBeTruthy();

      const editLink = actions.query(By.css('a[aria-label="Edit work order"]'));
      expect(editLink).toBeTruthy();

      const deleteBtn = actions.query(By.css('button[aria-label="Delete work order"]'));
      expect(deleteBtn).toBeTruthy();
    });
  });

  // Story 16-8: Delete Confirmation (AC #2, Task 3)
  describe('Delete Confirmation (Story 16-8 Task 3)', () => {
    it('should open confirm dialog on delete click', () => {
      dialogSpy.mockReturnValue({ afterClosed: () => of(false) });

      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const deleteBtn = rows[0].query(By.css('button[aria-label="Delete work order"]'));
      deleteBtn.nativeElement.click();
      fixture.detectChanges();

      expect(dialogSpy).toHaveBeenCalled();
      const dialogData = dialogSpy.mock.calls[0][1].data;
      expect(dialogData.title).toContain('Fix the faucet');
      expect(dialogData.message).toContain('permanently removed');
    });

    it('should call store.deleteWorkOrder on confirm', () => {
      dialogSpy.mockReturnValue({ afterClosed: () => of(true) });

      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const deleteBtn = rows[0].query(By.css('button[aria-label="Delete work order"]'));
      deleteBtn.nativeElement.click();
      fixture.detectChanges();

      expect(mockWorkOrderStore.deleteWorkOrder).toHaveBeenCalledWith('wo-1');
    });

    it('should NOT call store.deleteWorkOrder on cancel', () => {
      dialogSpy.mockReturnValue({ afterClosed: () => of(false) });

      const rows = fixture.debugElement.queryAll(By.css('.work-order-row'));
      const deleteBtn = rows[0].query(By.css('button[aria-label="Delete work order"]'));
      deleteBtn.nativeElement.click();
      fixture.detectChanges();

      expect(mockWorkOrderStore.deleteWorkOrder).not.toHaveBeenCalled();
    });

    it('should stop propagation when clicking delete', () => {
      dialogSpy.mockReturnValue({ afterClosed: () => of(false) });

      const mockEvent = new MouseEvent('click', { bubbles: true });
      vi.spyOn(mockEvent, 'stopPropagation');
      vi.spyOn(mockEvent, 'preventDefault');

      component.confirmDelete(mockWorkOrders[0] as any, mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // Story 9-7: Filter Work Orders Tests (unchanged — filter section not modified)
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
