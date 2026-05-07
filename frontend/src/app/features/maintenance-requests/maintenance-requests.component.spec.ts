import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { MaintenanceRequestsComponent } from './maintenance-requests.component';
import { MaintenanceRequestStore } from './stores/maintenance-request.store';
import { PropertyStore } from '../properties/stores/property.store';
import { MaintenanceRequestDto } from './services/maintenance-request.service';
import { PropertySummaryDto } from '../properties/services/property.service';

describe('MaintenanceRequestsComponent', () => {
  let fixture: ComponentFixture<MaintenanceRequestsComponent>;
  let component: MaintenanceRequestsComponent;
  let storeMock: any;
  let propertyStoreMock: any;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  const mockRequest: MaintenanceRequestDto = {
    id: 'req-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    propertyAddress: '123 Test St, Austin, TX',
    description: 'Leaky faucet in the kitchen',
    status: 'Submitted',
    dismissalReason: null,
    submittedByUserId: 'user-1',
    submittedByUserName: 'Jane Tenant',
    workOrderId: null,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    photos: null,
  };

  const mockProperty: PropertySummaryDto = {
    id: 'prop-1',
    name: 'Test Property',
    street: '123 Test St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    expenseTotal: 0,
    incomeTotal: 0,
    primaryPhotoThumbnailUrl: null,
  };

  beforeEach(() => {
    storeMock = {
      requests: signal([mockRequest]),
      selectedRequest: signal(null),
      isLoading: signal(false),
      isLoadingDetail: signal(false),
      error: signal<string | null>(null),
      detailError: signal<string | null>(null),
      selectedStatuses: signal<string[]>(['Submitted', 'InProgress', 'Resolved', 'Dismissed']),
      selectedPropertyId: signal<string | null>(null),
      page: signal(1),
      pageSize: signal(20),
      totalCount: signal(1),
      totalPages: signal(1),
      isEmpty: signal(false),
      isFilteredEmpty: signal(false),
      hasActiveFilters: signal(false),
      loadRequests: vi.fn(),
      loadRequestById: vi.fn(),
      setStatusFilter: vi.fn(),
      setPropertyFilter: vi.fn(),
      clearFilters: vi.fn(),
      setPage: vi.fn(),
      clearSelectedRequest: vi.fn(),
    };

    propertyStoreMock = {
      properties: signal([mockProperty]),
      loadProperties: vi.fn(),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [MaintenanceRequestsComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MaintenanceRequestStore, useValue: storeMock },
        { provide: PropertyStore, useValue: propertyStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    fixture = TestBed.createComponent(MaintenanceRequestsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders the page header', () => {
    fixture.detectChanges();
    const header = fixture.debugElement.query(By.css('h1'));
    expect(header.nativeElement.textContent).toContain('Maintenance Requests');
  });

  it('calls store.loadRequests and propertyStore.loadProperties on init', () => {
    fixture.detectChanges();
    expect(storeMock.loadRequests).toHaveBeenCalled();
    expect(propertyStoreMock.loadProperties).toHaveBeenCalledWith(undefined);
  });

  it('renders rows when requests is non-empty', () => {
    fixture.detectChanges();
    const rows = fixture.debugElement.queryAll(By.css('[data-testid="request-row"]'));
    expect(rows.length).toBe(1);
    expect(rows[0].nativeElement.textContent).toContain('Leaky faucet');
    expect(rows[0].nativeElement.textContent).toContain('Test Property');
    expect(rows[0].nativeElement.textContent).toContain('Jane Tenant');
  });

  it('shows loading spinner when isLoading is true', () => {
    storeMock.isLoading.set(true);
    fixture.detectChanges();
    const spinner = fixture.debugElement.query(By.css('app-loading-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('shows error card when error is set', () => {
    storeMock.error.set('Failed to load');
    fixture.detectChanges();
    const errorCard = fixture.debugElement.query(By.css('app-error-card'));
    expect(errorCard).toBeTruthy();
  });

  it('shows empty state when isEmpty is true', () => {
    storeMock.requests.set([]);
    storeMock.isEmpty.set(true);
    storeMock.totalCount.set(0);
    fixture.detectChanges();
    const empty = fixture.debugElement.query(By.css('[data-testid="empty-state"]'));
    expect(empty).toBeTruthy();
  });

  it('shows filtered empty state when isFilteredEmpty is true', () => {
    storeMock.requests.set([]);
    storeMock.isFilteredEmpty.set(true);
    storeMock.hasActiveFilters.set(true);
    fixture.detectChanges();
    const empty = fixture.debugElement.query(By.css('[data-testid="filtered-empty-state"]'));
    expect(empty).toBeTruthy();
  });

  it('clicking a row navigates to /maintenance-requests/:id', () => {
    fixture.detectChanges();
    const row = fixture.debugElement.query(By.css('[data-testid="request-row"]'));
    row.nativeElement.click();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/maintenance-requests', 'req-1']);
  });

  it('onStatusFilterChange forwards selected values to the store', () => {
    fixture.detectChanges();
    component.onStatusFilterChange({ value: ['Submitted'] } as any);
    expect(storeMock.setStatusFilter).toHaveBeenCalledWith(['Submitted']);
  });

  it('onPropertyFilterChange forwards property id to the store', () => {
    fixture.detectChanges();
    component.onPropertyFilterChange('prop-1');
    expect(storeMock.setPropertyFilter).toHaveBeenCalledWith('prop-1');
  });

  it('onPageChange converts pageIndex to 1-based page and forwards', () => {
    fixture.detectChanges();
    component.onPageChange({ pageIndex: 2, pageSize: 50 } as any);
    expect(storeMock.setPage).toHaveBeenCalledWith(3, 50);
  });

  it('clearFilters delegates to store.clearFilters', () => {
    fixture.detectChanges();
    component.clearFilters();
    expect(storeMock.clearFilters).toHaveBeenCalled();
  });

  it('getStatusLabel returns "In Progress" for "InProgress"', () => {
    expect(component.getStatusLabel('InProgress')).toBe('In Progress');
    expect(component.getStatusLabel('Submitted')).toBe('Submitted');
  });

  it('truncateDescription truncates strings longer than maxLength', () => {
    expect(component.truncateDescription('a'.repeat(150))).toBe('a'.repeat(100) + '...');
    expect(component.truncateDescription('short')).toBe('short');
  });

  it('shows linked badge when workOrderId is present', () => {
    storeMock.requests.set([{ ...mockRequest, workOrderId: 'wo-1' }]);
    fixture.detectChanges();
    const linked = fixture.debugElement.query(By.css('.request-linked'));
    expect(linked).toBeTruthy();
    expect(linked.nativeElement.textContent).toContain('Linked');
  });

  it('hides linked badge when workOrderId is null', () => {
    fixture.detectChanges();
    const linked = fixture.debugElement.query(By.css('.request-linked'));
    expect(linked).toBeFalsy();
  });
});
