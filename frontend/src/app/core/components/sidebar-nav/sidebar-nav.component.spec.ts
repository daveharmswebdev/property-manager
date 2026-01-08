import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SidebarNavComponent } from './sidebar-nav.component';
import { AuthService, User } from '../../services/auth.service';
import { ReceiptStore } from '../../../features/receipts/stores/receipt.store';
import { ApiClient } from '../../api/api.service';

describe('SidebarNavComponent', () => {
  let component: SidebarNavComponent;
  let fixture: ComponentFixture<SidebarNavComponent>;
  let mockLogout: ReturnType<typeof vi.fn>;
  let mockLogoutAndRedirect: ReturnType<typeof vi.fn>;

  const mockUser: User = {
    userId: 'test-user-id',
    accountId: 'test-account-id',
    role: 'Owner',
    email: 'test@example.com',
    displayName: 'John Doe',
  };
  const mockReceiptStore = {
    unprocessedReceipts: signal([]),
    isLoading: signal(false),
    error: signal<string | null>(null),
    isEmpty: signal(true),
    unprocessedCount: signal(0),
    hasReceipts: signal(false),
    loadUnprocessedReceipts: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockLogout = vi.fn().mockReturnValue(of(undefined));
    mockLogoutAndRedirect = vi.fn();

    const mockAuthService = {
      currentUser: signal<User | null>(mockUser),
      logout: mockLogout,
      logoutAndRedirect: mockLogoutAndRedirect,
    };

    await TestBed.configureTestingModule({
      imports: [SidebarNavComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ReceiptStore, useValue: mockReceiptStore },
        {
          provide: ApiClient,
          useValue: {
            receipts_GetUnprocessed: vi
              .fn()
              .mockReturnValue(of({ items: [], totalCount: 0 })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 7 navigation items (AC7.1)', () => {
    expect(component.navItems.length).toBe(7);
  });

  it('should have correct navigation items in order (AC7.1)', () => {
    const expectedLabels = [
      'Dashboard',
      'Properties',
      'Expenses',
      'Income',
      'Receipts',
      'Reports',
      'Settings',
    ];
    const actualLabels = component.navItems.map((item) => item.label);
    expect(actualLabels).toEqual(expectedLabels);
  });

  it('should have Dashboard as first item (AC7.1)', () => {
    expect(component.navItems[0].label).toBe('Dashboard');
    expect(component.navItems[0].route).toBe('/dashboard');
  });

  it('should have Receipts nav item with dynamic badge (AC-5.3.1)', () => {
    const receiptsItem = component.navItems.find((item) => item.label === 'Receipts');
    expect(receiptsItem).toBeTruthy();
    expect(receiptsItem?.route).toBe('/receipts');
    // Badge is now dynamic from store, default 0 when no receipts
    expect(component.getBadgeCount(receiptsItem!)).toBe(0);
  });

  it('should return unprocessed count for Receipts badge (AC-5.3.1)', () => {
    const receiptsItem = component.navItems.find((item) => item.label === 'Receipts');
    // Verify the getBadgeCount method returns the store signal value
    mockReceiptStore.unprocessedCount.set(5);
    expect(component.getBadgeCount(receiptsItem!)).toBe(5);
  });

  it('should display displayName when available (AC-7.2.1)', () => {
    expect(component.userDisplayName).toBe('John Doe');
  });

  it('should render logout button (AC7.2)', () => {
    const logoutButton = fixture.debugElement.query(
      By.css('[data-testid="logout-button"]')
    );
    expect(logoutButton).toBeTruthy();
  });

  it('should call logout on auth service when logout clicked (AC7.2)', () => {
    component.logout();
    expect(mockLogoutAndRedirect).toHaveBeenCalledWith(component.isLoggingOut);
  });

  it('should render all nav items in the DOM (AC7.1)', () => {
    const navItems = fixture.debugElement.queryAll(By.css('.nav-item'));
    expect(navItems.length).toBe(7);
  });

  describe('userDisplayName fallback logic (AC-7.2.2)', () => {
    it('should fall back to email when displayName is null', async () => {
      const userWithoutDisplayName: User = {
        userId: 'test-user-id',
        accountId: 'test-account-id',
        role: 'Owner',
        email: 'fallback@example.com',
        displayName: null,
      };

      const mockAuthServiceNoDisplayName = {
        currentUser: signal<User | null>(userWithoutDisplayName),
        logout: vi.fn().mockReturnValue(of(undefined)),
        logoutAndRedirect: vi.fn(),
      };

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SidebarNavComponent, NoopAnimationsModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: AuthService, useValue: mockAuthServiceNoDisplayName },
          { provide: ReceiptStore, useValue: mockReceiptStore },
          {
            provide: ApiClient,
            useValue: {
              receipts_GetUnprocessed: vi
                .fn()
                .mockReturnValue(of({ items: [], totalCount: 0 })),
            },
          },
        ],
      }).compileComponents();

      const testFixture = TestBed.createComponent(SidebarNavComponent);
      const testComponent = testFixture.componentInstance;
      testFixture.detectChanges();

      expect(testComponent.userDisplayName).toBe('fallback@example.com');
    });

    it('should fall back to "User" when both displayName and email are missing', async () => {
      const userWithNothing: User = {
        userId: 'test-user-id',
        accountId: 'test-account-id',
        role: 'Owner',
        email: '',
        displayName: null,
      };

      const mockAuthServiceNoEmail = {
        currentUser: signal<User | null>(userWithNothing),
        logout: vi.fn().mockReturnValue(of(undefined)),
        logoutAndRedirect: vi.fn(),
      };

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SidebarNavComponent, NoopAnimationsModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: AuthService, useValue: mockAuthServiceNoEmail },
          { provide: ReceiptStore, useValue: mockReceiptStore },
          {
            provide: ApiClient,
            useValue: {
              receipts_GetUnprocessed: vi
                .fn()
                .mockReturnValue(of({ items: [], totalCount: 0 })),
            },
          },
        ],
      }).compileComponents();

      const testFixture = TestBed.createComponent(SidebarNavComponent);
      const testComponent = testFixture.componentInstance;
      testFixture.detectChanges();

      expect(testComponent.userDisplayName).toBe('User');
    });

    it('should return "User" when currentUser is null', async () => {
      const mockAuthServiceNullUser = {
        currentUser: signal<User | null>(null),
        logout: vi.fn().mockReturnValue(of(undefined)),
        logoutAndRedirect: vi.fn(),
      };

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SidebarNavComponent, NoopAnimationsModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: AuthService, useValue: mockAuthServiceNullUser },
          { provide: ReceiptStore, useValue: mockReceiptStore },
          {
            provide: ApiClient,
            useValue: {
              receipts_GetUnprocessed: vi
                .fn()
                .mockReturnValue(of({ items: [], totalCount: 0 })),
            },
          },
        ],
      }).compileComponents();

      const testFixture = TestBed.createComponent(SidebarNavComponent);
      const testComponent = testFixture.componentInstance;
      testFixture.detectChanges();

      expect(testComponent.userDisplayName).toBe('User');
    });
  });
});
