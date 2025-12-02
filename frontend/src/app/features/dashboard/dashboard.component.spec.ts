import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService, User } from '../../core/services/auth.service';
import { PropertyService, GetAllPropertiesResponse, PropertySummaryDto } from '../properties/services/property.service';
import { of, throwError } from 'rxjs';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;
  let mockPropertyService: { getProperties: ReturnType<typeof vi.fn> };

  const mockUser: User = {
    userId: 'test-user-id',
    accountId: 'test-account-id',
    role: 'Owner',
  };

  const mockProperties: PropertySummaryDto[] = [
    {
      id: 'prop-1',
      name: 'Oak Street Duplex',
      street: '123 Oak St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      expenseTotal: 0,
      incomeTotal: 0,
    },
    {
      id: 'prop-2',
      name: 'Pine Avenue House',
      street: '456 Pine Ave',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      expenseTotal: 0,
      incomeTotal: 0,
    },
  ];

  const mockResponse: GetAllPropertiesResponse = {
    items: mockProperties,
    totalCount: 2,
  };

  const emptyResponse: GetAllPropertiesResponse = {
    items: [],
    totalCount: 0,
  };

  beforeEach(async () => {
    const mockAuthService = {
      currentUser: signal<User | null>(mockUser),
    };

    mockPropertyService = {
      getProperties: vi.fn().mockReturnValue(of(emptyResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: PropertyService, useValue: mockPropertyService },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display welcome header', () => {
    fixture.detectChanges();
    const header = fixture.debugElement.query(By.css('.dashboard-header h1'));
    expect(header.nativeElement.textContent).toContain('Welcome back');
  });

  it('should have Add Property button in header (AC-2.1.1)', () => {
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('.dashboard-header button'));
    expect(button.nativeElement.textContent).toContain('Add Property');
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockPropertyService.getProperties.mockReturnValue(of(emptyResponse));
      fixture.detectChanges();
    });

    it('should display empty state with "No properties yet" (AC-2.2.3)', () => {
      const heading = fixture.debugElement.query(By.css('.empty-state-card h2'));
      expect(heading.nativeElement.textContent).toContain('No properties yet');
    });

    it('should have Add Property button in empty state (AC-2.2.3)', () => {
      const button = fixture.debugElement.query(By.css('.empty-state-card button'));
      expect(button.nativeElement.textContent).toContain('Add Property');
    });

    it('should have mat-card for empty state content', () => {
      const card = fixture.debugElement.query(By.css('.empty-state-card'));
      expect(card).toBeTruthy();
    });
  });

  describe('with properties (AC-2.1.4)', () => {
    beforeEach(() => {
      mockPropertyService.getProperties.mockReturnValue(of(mockResponse));
      fixture.detectChanges();
    });

    it('should display properties list when properties exist', () => {
      const listCard = fixture.debugElement.query(By.css('.properties-list-card'));
      expect(listCard).toBeTruthy();
    });

    it('should show correct property count', () => {
      const subtitle = fixture.debugElement.query(By.css('mat-card-subtitle'));
      expect(subtitle.nativeElement.textContent).toContain('2 properties');
    });

    it('should display property names', () => {
      const titles = fixture.debugElement.queryAll(By.css('[matListItemTitle]'));
      expect(titles.length).toBe(2);
      expect(titles[0].nativeElement.textContent).toContain('Oak Street Duplex');
      expect(titles[1].nativeElement.textContent).toContain('Pine Avenue House');
    });

    it('should display property locations', () => {
      const lines = fixture.debugElement.queryAll(By.css('[matListItemLine]'));
      expect(lines[0].nativeElement.textContent).toContain('Austin, TX');
      expect(lines[1].nativeElement.textContent).toContain('Dallas, TX');
    });

    it('should not show empty state when properties exist', () => {
      const emptyCard = fixture.debugElement.query(By.css('.empty-state-card'));
      expect(emptyCard).toBeFalsy();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while fetching', () => {
      // Don't trigger detectChanges yet to catch loading state
      component.loading.set(true);
      fixture.detectChanges();
      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockPropertyService.getProperties.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();
    });

    it('should display error message on API failure', () => {
      const errorCard = fixture.debugElement.query(By.css('.error-card'));
      expect(errorCard).toBeTruthy();
      expect(errorCard.nativeElement.textContent).toContain('Failed to load properties');
    });

    it('should have retry button on error', () => {
      const retryButton = fixture.debugElement.query(By.css('.error-card button'));
      expect(retryButton.nativeElement.textContent).toContain('Try Again');
    });
  });
});
