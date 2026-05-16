import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MaintenanceRequestDetailComponent } from './maintenance-request-detail.component';
import { MaintenanceRequestStore } from '../../stores/maintenance-request.store';
import {
  MaintenanceRequestDto,
  MaintenanceRequestPhotoDto,
} from '../../services/maintenance-request.service';

describe('MaintenanceRequestDetailComponent', () => {
  let fixture: ComponentFixture<MaintenanceRequestDetailComponent>;
  let component: MaintenanceRequestDetailComponent;
  let storeMock: any;

  const mockPhoto: MaintenanceRequestPhotoDto = {
    id: 'photo-1',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    viewUrl: 'https://example.com/view.jpg',
    isPrimary: true,
    displayOrder: 1,
    originalFileName: 'kitchen.jpg',
    fileSizeBytes: 12345,
    createdAt: '2026-05-01T10:00:00Z',
  };

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

  function setupTest(initial?: { request?: MaintenanceRequestDto | null; detailError?: string | null; isLoading?: boolean }) {
    storeMock = {
      selectedRequest: signal<MaintenanceRequestDto | null>(initial?.request ?? mockRequest),
      isLoadingDetail: signal(initial?.isLoading ?? false),
      detailError: signal<string | null>(initial?.detailError ?? null),
      loadRequestById: vi.fn(),
      clearSelectedRequest: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [MaintenanceRequestDetailComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MaintenanceRequestStore, useValue: storeMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'id' ? 'req-1' : null) },
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(MaintenanceRequestDetailComponent);
    component = fixture.componentInstance;
  }

  it('calls store.loadRequestById from the route param', () => {
    setupTest();
    fixture.detectChanges();
    expect(storeMock.loadRequestById).toHaveBeenCalledWith('req-1');
  });

  it('shows loading spinner while loading', () => {
    setupTest({ isLoading: true, request: null });
    fixture.detectChanges();
    const spinner = fixture.debugElement.query(By.css('app-loading-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('shows error card when detailError set', () => {
    setupTest({ detailError: 'Maintenance request not found', request: null });
    fixture.detectChanges();
    const error = fixture.debugElement.query(By.css('app-error-card'));
    expect(error).toBeTruthy();
  });

  it('renders status chip with correct class for Submitted', () => {
    setupTest();
    fixture.detectChanges();
    const chip = fixture.debugElement.query(By.css('[data-testid="status-chip"]'));
    expect(chip).toBeTruthy();
    expect(chip.nativeElement.classList).toContain('status-submitted');
  });

  it('renders status chip with status-in-progress class for InProgress', () => {
    setupTest({ request: { ...mockRequest, status: 'InProgress' } });
    fixture.detectChanges();
    const chip = fixture.debugElement.query(By.css('[data-testid="status-chip"]'));
    expect(chip.nativeElement.classList).toContain('status-in-progress');
    expect(chip.nativeElement.textContent).toContain('In Progress');
  });

  it('shows dismissal reason ONLY when status is Dismissed', () => {
    setupTest({
      request: {
        ...mockRequest,
        status: 'Dismissed',
        dismissalReason: 'Tenant withdrew the request',
      },
    });
    fixture.detectChanges();
    const dismissal = fixture.debugElement.query(By.css('[data-testid="dismissal-reason"]'));
    expect(dismissal).toBeTruthy();
    expect(dismissal.nativeElement.textContent).toContain('Tenant withdrew the request');
  });

  it('hides dismissal reason when status is not Dismissed', () => {
    setupTest({ request: { ...mockRequest, status: 'Submitted', dismissalReason: 'ignored' } });
    fixture.detectChanges();
    const dismissal = fixture.debugElement.query(By.css('[data-testid="dismissal-reason"]'));
    expect(dismissal).toBeFalsy();
  });

  it('shows linked work order badge ONLY when workOrderId is non-null', () => {
    setupTest({ request: { ...mockRequest, workOrderId: 'wo-1' } });
    fixture.detectChanges();
    const linked = fixture.debugElement.query(By.css('[data-testid="linked-work-order"]'));
    expect(linked).toBeTruthy();
    expect(linked.nativeElement.textContent).toContain('View linked work order');
  });

  it('hides linked work order badge when workOrderId is null', () => {
    setupTest();
    fixture.detectChanges();
    const linked = fixture.debugElement.query(By.css('[data-testid="linked-work-order"]'));
    expect(linked).toBeFalsy();
  });

  it('renders photos grid when photos array is non-empty', () => {
    setupTest({ request: { ...mockRequest, photos: [mockPhoto] } });
    fixture.detectChanges();
    const grid = fixture.debugElement.query(By.css('[data-testid="photo-grid"]'));
    expect(grid).toBeTruthy();
    const imgs = fixture.debugElement.queryAll(By.css('[data-testid="photo-grid"] img'));
    expect(imgs.length).toBe(1);
    expect(imgs[0].nativeElement.getAttribute('src')).toBe('https://example.com/thumb.jpg');
  });

  it('hides photos grid when photos is null', () => {
    setupTest();
    fixture.detectChanges();
    const grid = fixture.debugElement.query(By.css('[data-testid="photo-grid"]'));
    expect(grid).toBeFalsy();
  });

  it('renders the back button linking to /maintenance-requests', () => {
    setupTest();
    fixture.detectChanges();
    const back = fixture.debugElement.query(By.css('[data-testid="back-button"]'));
    expect(back).toBeTruthy();
  });

  it('renders submitter name with fallback to "Unknown"', () => {
    setupTest({ request: { ...mockRequest, submittedByUserName: null } });
    fixture.detectChanges();
    const submitter = fixture.debugElement.query(By.css('.submitter-name'));
    expect(submitter.nativeElement.textContent).toContain('Unknown');
  });

  it('clearSelectedRequest is called on destroy', () => {
    setupTest();
    fixture.detectChanges();
    fixture.destroy();
    expect(storeMock.clearSelectedRequest).toHaveBeenCalled();
  });
});
