import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PropertyWorkOrdersComponent } from './property-work-orders.component';
import { WorkOrderService, WorkOrderDto } from '../../../work-orders/services/work-order.service';

describe('PropertyWorkOrdersComponent', () => {
  let component: PropertyWorkOrdersComponent;
  let fixture: ComponentFixture<PropertyWorkOrdersComponent>;
  let workOrderService: { getWorkOrdersByProperty: ReturnType<typeof vi.fn> };

  const mockWorkOrders: WorkOrderDto[] = [
    {
      id: 'wo-1',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      vendorName: 'John Plumber',
      vendorId: 'vendor-1',
      isDiy: false,
      categoryId: 'cat-1',
      categoryName: 'Plumbing',
      status: 'Reported',
      description: 'Fix leaky faucet in master bathroom',
      createdAt: '2026-01-15T10:00:00Z',
      createdByUserId: 'user-1',
      tags: [],
    },
    {
      id: 'wo-2',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      vendorName: undefined,
      vendorId: undefined,
      isDiy: true,
      categoryId: 'cat-2',
      categoryName: 'Electrical',
      status: 'Assigned',
      description: 'Replace light switch in kitchen',
      createdAt: '2026-01-14T10:00:00Z',
      createdByUserId: 'user-1',
      tags: [],
    },
    {
      id: 'wo-3',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      vendorName: 'HVAC Pro',
      vendorId: 'vendor-2',
      isDiy: false,
      categoryId: 'cat-3',
      categoryName: 'HVAC',
      status: 'Completed',
      description: 'Annual AC maintenance',
      createdAt: '2026-01-13T10:00:00Z',
      createdByUserId: 'user-1',
      tags: [],
    },
  ];

  beforeEach(async () => {
    workOrderService = {
      getWorkOrdersByProperty: vi.fn().mockReturnValue(of({ items: mockWorkOrders, totalCount: 3 })),
    };

    await TestBed.configureTestingModule({
      imports: [PropertyWorkOrdersComponent],
      providers: [
        provideAnimations(),
        provideRouter([]),
        { provide: WorkOrderService, useValue: workOrderService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyWorkOrdersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Loading State (AC #6)', () => {
    it('should show loading spinner during fetch', () => {
      // Set loading state directly through the component's public signal
      component['isLoading'].set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should hide spinner after data loads', () => {
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeFalsy();
    });
  });

  describe('Empty State (AC #2)', () => {
    beforeEach(() => {
      workOrderService.getWorkOrdersByProperty.mockReturnValue(of({ items: [], totalCount: 0 }));

      const newFixture = TestBed.createComponent(PropertyWorkOrdersComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();
      fixture = newFixture;
      component = newFixture.componentInstance;
    });

    it('should show empty state when no work orders', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No work orders for this property');
    });

    it('should show "New Work Order" button in header', () => {
      const newButton = fixture.nativeElement.querySelector('.new-work-order-btn');
      expect(newButton).toBeTruthy();
      expect(newButton.textContent).toContain('New Work Order');
    });
  });

  describe('Error State (AC #7)', () => {
    beforeEach(() => {
      workOrderService.getWorkOrdersByProperty.mockReturnValue(
        throwError(() => new Error('API Error'))
      );

      const newFixture = TestBed.createComponent(PropertyWorkOrdersComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();
      fixture = newFixture;
      component = newFixture.componentInstance;
    });

    it('should show error message on API failure', () => {
      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Failed to load work orders');
    });

    it('should show retry button', () => {
      const retryButton = fixture.nativeElement.querySelector('.error-state button');
      expect(retryButton).toBeTruthy();
      expect(retryButton.textContent).toContain('Retry');
    });

    it('should reload work orders when retry is clicked', () => {
      // Reset mock call count before retry
      workOrderService.getWorkOrdersByProperty.mockClear();
      workOrderService.getWorkOrdersByProperty.mockReturnValue(of({ items: mockWorkOrders, totalCount: 3 }));

      const retryButton = fixture.nativeElement.querySelector('.error-state button');
      retryButton.click();
      fixture.detectChanges();

      expect(workOrderService.getWorkOrdersByProperty).toHaveBeenCalledTimes(1);
    });
  });

  describe('Work Orders List (AC #1)', () => {
    it('should render work orders list', () => {
      const workOrderItems = fixture.nativeElement.querySelectorAll('.work-order-item');
      expect(workOrderItems.length).toBe(3);
    });

    it('should show status badge for each work order', () => {
      const statusBadges = fixture.nativeElement.querySelectorAll('.status-badge');
      expect(statusBadges.length).toBe(3);
      expect(statusBadges[0].textContent.trim()).toBe('Reported');
      expect(statusBadges[0].classList.contains('reported')).toBe(true);
    });

    it('should show correct status badge colors', () => {
      const statusBadges = fixture.nativeElement.querySelectorAll('.status-badge');
      expect(statusBadges[0].classList.contains('reported')).toBe(true);
      expect(statusBadges[1].classList.contains('assigned')).toBe(true);
      expect(statusBadges[2].classList.contains('completed')).toBe(true);
    });

    it('should show description (truncated if over 50 chars)', () => {
      const descriptions = fixture.nativeElement.querySelectorAll('.description');
      expect(descriptions[0].textContent.trim()).toBe('Fix leaky faucet in master bathroom');
    });

    it('should show assignee or DIY', () => {
      const assignees = fixture.nativeElement.querySelectorAll('.assignee');
      expect(assignees[0].textContent.trim()).toBe('John Plumber');
      expect(assignees[1].textContent.trim()).toBe('DIY');
    });

    it('should show created date', () => {
      const dates = fixture.nativeElement.querySelectorAll('.date');
      expect(dates.length).toBe(3);
    });

    it('should show total count in header', () => {
      const title = fixture.nativeElement.querySelector('mat-card-title');
      expect(title.textContent).toContain('(3)');
    });
  });

  describe('Navigation (AC #4)', () => {
    it('should have router link to work order detail page', () => {
      const firstItem = fixture.nativeElement.querySelector('.work-order-item');
      expect(firstItem.getAttribute('href')).toBe('/work-orders/wo-1');
    });
  });

  describe('Create Work Order Event', () => {
    it('should emit createClick when "New Work Order" button is clicked', () => {
      const createClickSpy = vi.fn();
      component.createClick.subscribe(createClickSpy);

      const newButton = fixture.nativeElement.querySelector('.new-work-order-btn');
      newButton.click();

      expect(createClickSpy).toHaveBeenCalled();
    });
  });

  describe('View All Link (AC #5)', () => {
    it('should show "View all" link when totalCount > displayLimit', () => {
      workOrderService.getWorkOrdersByProperty.mockReturnValue(
        of({ items: mockWorkOrders, totalCount: 10 })
      );

      const newFixture = TestBed.createComponent(PropertyWorkOrdersComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();

      const viewAllLink = newFixture.nativeElement.querySelector('.view-all a');
      expect(viewAllLink).toBeTruthy();
      expect(viewAllLink.textContent).toContain('View all 10 work orders');
    });

    it('should NOT show "View all" link when totalCount <= displayLimit', () => {
      const viewAllLink = fixture.nativeElement.querySelector('.view-all');
      expect(viewAllLink).toBeFalsy();
    });

    it('should emit viewAllClick when "View all" is clicked', () => {
      workOrderService.getWorkOrdersByProperty.mockReturnValue(
        of({ items: mockWorkOrders, totalCount: 10 })
      );

      const newFixture = TestBed.createComponent(PropertyWorkOrdersComponent);
      const newComponent = newFixture.componentInstance;
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();

      const viewAllClickSpy = vi.fn();
      newComponent.viewAllClick.subscribe(viewAllClickSpy);

      const viewAllLink = newFixture.nativeElement.querySelector('.view-all a');
      viewAllLink.click();

      expect(viewAllClickSpy).toHaveBeenCalled();
    });
  });

  describe('Service Integration', () => {
    it('should call service with propertyId and limit', () => {
      expect(workOrderService.getWorkOrdersByProperty).toHaveBeenCalledWith('prop-1', 5);
    });

    it('should use displayLimit of 5', () => {
      expect(component.displayLimit).toBe(5);
    });
  });
});
