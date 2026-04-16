import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TenantDashboardComponent } from './tenant-dashboard.component';
import { TenantDashboardStore } from './stores/tenant-dashboard.store';

describe('TenantDashboardComponent', () => {
  let component: TenantDashboardComponent;
  let fixture: ComponentFixture<TenantDashboardComponent>;

  const mockStore = {
    property: signal({
      id: 'prop-1',
      name: 'Sunset Apartments',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    }),
    requests: signal([
      {
        id: 'req-1',
        propertyId: 'prop-1',
        propertyName: 'Sunset Apartments',
        propertyAddress: '123 Main St, Austin, TX 78701',
        description: 'Broken window in bedroom',
        status: 'Submitted',
        dismissalReason: null,
        submittedByUserId: 'user-1',
        submittedByUserName: 'John',
        workOrderId: null,
        createdAt: '2026-04-10T00:00:00Z',
        updatedAt: '2026-04-10T00:00:00Z',
        photos: null,
      },
    ]),
    isLoading: signal(false),
    error: signal(null),
    totalCount: signal(1),
    page: signal(1),
    pageSize: signal(20),
    totalPages: signal(1),
    isEmpty: signal(false),
    propertyAddress: signal('123 Main St, Austin, TX 78701'),
    isPropertyLoaded: signal(true),
    loadProperty: vi.fn(),
    loadRequests: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TenantDashboardStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDashboardComponent);
    component = fixture.componentInstance;
  });

  // Task 14.1: component renders property info when loaded
  it('renders property info when loaded', () => {
    fixture.detectChanges();

    const propertyCard = fixture.nativeElement.querySelector('[data-testid="property-card"]');
    expect(propertyCard).toBeTruthy();
    expect(propertyCard.textContent).toContain('Sunset Apartments');
    expect(propertyCard.textContent).toContain('123 Main St, Austin, TX 78701');
  });

  // Task 14.2: component renders request list when loaded
  it('renders request list when loaded', () => {
    fixture.detectChanges();

    const requestList = fixture.nativeElement.querySelector('[data-testid="request-list"]');
    expect(requestList).toBeTruthy();
    expect(requestList.textContent).toContain('Broken window in bedroom');
  });

  // Task 14.3: component shows loading spinner during load
  it('shows loading spinner during load', () => {
    mockStore.isLoading.set(true);
    mockStore.isPropertyLoaded.set(false);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('app-loading-spinner');
    expect(spinner).toBeTruthy();
  });

  // Task 14.4: component shows empty state when no requests
  it('shows empty state when no requests', () => {
    mockStore.requests.set([]);
    mockStore.isEmpty.set(true);
    mockStore.isLoading.set(false);
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  // Task 14.5: component shows error card on error
  it('shows error card on error', () => {
    mockStore.error.set('Failed to load property information.' as any);
    fixture.detectChanges();

    const errorCard = fixture.nativeElement.querySelector('app-error-card');
    expect(errorCard).toBeTruthy();
  });
});
