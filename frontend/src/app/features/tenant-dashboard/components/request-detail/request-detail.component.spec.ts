import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { RequestDetailComponent } from './request-detail.component';
import { TenantService, MaintenanceRequestDto } from '../../services/tenant.service';

describe('RequestDetailComponent', () => {
  let component: RequestDetailComponent;
  let fixture: ComponentFixture<RequestDetailComponent>;
  let tenantServiceMock: { getMaintenanceRequestById: ReturnType<typeof vi.fn> };

  const mockRequest: MaintenanceRequestDto = {
    id: 'req-1',
    propertyId: 'prop-1',
    propertyName: 'Sunset Apartments',
    propertyAddress: '123 Main St, Austin, TX 78701',
    description: 'The kitchen sink is leaking under the cabinet.',
    status: 'Submitted',
    dismissalReason: null,
    submittedByUserId: 'user-1',
    submittedByUserName: 'John Tenant',
    workOrderId: null,
    createdAt: '2026-04-10T12:00:00Z',
    updatedAt: '2026-04-10T12:00:00Z',
    photos: null,
  };

  beforeEach(async () => {
    tenantServiceMock = {
      getMaintenanceRequestById: vi.fn().mockReturnValue(of(mockRequest)),
    };

    await TestBed.configureTestingModule({
      imports: [RequestDetailComponent],
      providers: [
        provideRouter([]),
        { provide: TenantService, useValue: tenantServiceMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'req-1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestDetailComponent);
    component = fixture.componentInstance;
  });

  // Task 15.1: renders full description and status
  it('renders full description and status', () => {
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector(
      '[data-testid="request-description"]',
    );
    expect(description).toBeTruthy();
    expect(description.textContent).toContain(
      'The kitchen sink is leaking under the cabinet.',
    );

    const detailCard = fixture.nativeElement.querySelector(
      '[data-testid="request-detail-card"]',
    );
    expect(detailCard.textContent).toContain('Submitted');
  });

  // Task 15.2: renders dismissal reason when status is Dismissed
  it('renders dismissal reason when status is Dismissed', () => {
    const dismissedRequest = {
      ...mockRequest,
      status: 'Dismissed',
      dismissalReason: 'Duplicate of another request',
    };
    tenantServiceMock.getMaintenanceRequestById.mockReturnValue(of(dismissedRequest));

    fixture = TestBed.createComponent(RequestDetailComponent);
    fixture.detectChanges();

    const dismissalReason = fixture.nativeElement.querySelector(
      '[data-testid="dismissal-reason"]',
    );
    expect(dismissalReason).toBeTruthy();
    expect(dismissalReason.textContent).toContain('Duplicate of another request');
  });

  // Task 15.3: hides dismissal reason when status is not Dismissed
  it('hides dismissal reason when status is not Dismissed', () => {
    fixture.detectChanges();

    const dismissalReason = fixture.nativeElement.querySelector(
      '[data-testid="dismissal-reason"]',
    );
    expect(dismissalReason).toBeFalsy();
  });
});
