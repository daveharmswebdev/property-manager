import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService, User } from '../../core/services/auth.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockUser: User = {
    userId: 'test-user-id',
    accountId: 'test-account-id',
    role: 'Owner',
  };

  beforeEach(async () => {
    const mockAuthService = {
      currentUser: signal<User | null>(mockUser),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state with "No properties yet" (AC-2.1.1)', () => {
    const heading = fixture.debugElement.query(By.css('.empty-state-card h2'));
    expect(heading.nativeElement.textContent).toContain('No properties yet');
  });

  it('should display welcome header', () => {
    const header = fixture.debugElement.query(By.css('.dashboard-header h1'));
    expect(header.nativeElement.textContent).toContain('Welcome back');
  });

  it('should have Add Property button in header (AC-2.1.1)', () => {
    const button = fixture.debugElement.query(By.css('.dashboard-header button'));
    expect(button.nativeElement.textContent).toContain('Add Property');
  });

  it('should have Add Property button in empty state (AC-2.1.1)', () => {
    const button = fixture.debugElement.query(By.css('.empty-state-card button'));
    expect(button.nativeElement.textContent).toContain('Add Property');
  });

  it('should have mat-card for empty state content', () => {
    const card = fixture.debugElement.query(By.css('.empty-state-card'));
    expect(card).toBeTruthy();
  });
});
