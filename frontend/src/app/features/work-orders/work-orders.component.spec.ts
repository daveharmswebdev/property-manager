import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { WorkOrdersComponent } from './work-orders.component';
import { WorkOrderStore } from './stores/work-order.store';

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
    },
    {
      id: 'wo-3',
      propertyId: 'prop-2',
      propertyName: 'Other Property',
      description: 'Paint the walls',
      status: 'Assigned',
      isDiy: false,
      vendorId: 'vendor-2',
      vendorName: null, // Vendor was deleted but FK preserved
      categoryName: 'Painting',
      tags: [],
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
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrdersComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
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
});
