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

  const mockReceiptStore = {
    unprocessedReceipts: signal([]),
    isLoading: signal(false),
    error: signal<string | null>(null),
    isEmpty: signal(true),
    unprocessedCount: signal(0),
    hasReceipts: signal(false),
    loadUnprocessedReceipts: vi.fn().mockResolvedValue(undefined),
  };

  async function setupWithRole(role: string) {
    const mockUser: User = {
      userId: 'test-user-id',
      accountId: 'test-account-id',
      role,
      email: 'test@example.com',
      displayName: 'John Doe',
      propertyId: null,
    };

    mockLogout = vi.fn().mockReturnValue(of(undefined));
    mockLogoutAndRedirect = vi.fn();

    const mockAuthService = {
      currentUser: signal<User | null>(mockUser),
      logout: mockLogout,
      logoutAndRedirect: mockLogoutAndRedirect,
    };

    TestBed.resetTestingModule();
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
  }

  describe('Owner role (AC: #1)', () => {
    beforeEach(async () => {
      await setupWithRole('Owner');
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have 9 navigation items for Owner', () => {
      expect(component.navItems().length).toBe(9);
    });

    it('should have correct navigation items in order for Owner', () => {
      const expectedLabels = [
        'Dashboard',
        'Properties',
        'Expenses',
        'Income',
        'Receipts',
        'Vendors',
        'Work Orders',
        'Reports',
        'Settings',
      ];
      const actualLabels = component.navItems().map((item) => item.label);
      expect(actualLabels).toEqual(expectedLabels);
    });

    it('should have Dashboard as first item', () => {
      expect(component.navItems()[0].label).toBe('Dashboard');
      expect(component.navItems()[0].route).toBe('/dashboard');
    });

    it('should have Receipts nav item with dynamic badge (AC-5.3.1)', () => {
      const receiptsItem = component.navItems().find((item) => item.label === 'Receipts');
      expect(receiptsItem).toBeTruthy();
      expect(receiptsItem?.route).toBe('/receipts');
      expect(component.getBadgeCount(receiptsItem!)).toBe(0);
    });

    it('should return unprocessed count for Receipts badge (AC-5.3.1)', () => {
      const receiptsItem = component.navItems().find((item) => item.label === 'Receipts');
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

    it('should render all 9 nav items in the DOM', () => {
      const navItems = fixture.debugElement.queryAll(By.css('.nav-item'));
      expect(navItems.length).toBe(9);
    });
  });

  describe('Contributor role (AC: #2)', () => {
    beforeEach(async () => {
      await setupWithRole('Contributor');
    });

    it('should have 3 navigation items for Contributor', () => {
      expect(component.navItems().length).toBe(3);
    });

    it('should show Dashboard, Receipts, Work Orders for Contributor', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).toEqual(['Dashboard', 'Receipts', 'Work Orders']);
    });

    it('should NOT show Properties for Contributor', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).not.toContain('Properties');
    });

    it('should NOT show Expenses for Contributor', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).not.toContain('Expenses');
    });

    it('should NOT show Settings for Contributor', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).not.toContain('Settings');
    });

    it('should render 3 nav items in the DOM', () => {
      const navItems = fixture.debugElement.queryAll(By.css('.nav-item'));
      expect(navItems.length).toBe(3);
    });
  });

  // Task 16.5: SidebarNavComponent shows Dashboard + Submit Request for Tenant role
  // (Story 20.5, AC #5; Story 20.6, AC #1)
  describe('Tenant role (Story 20.5, 20.6)', () => {
    beforeEach(async () => {
      await setupWithRole('Tenant');
    });

    it('should have 2 navigation items for Tenant', () => {
      expect(component.navItems().length).toBe(2);
    });

    it('should show Dashboard and Submit Request for Tenant', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).toEqual(['Dashboard', 'Submit Request']);
      expect(component.navItems()[0].route).toBe('/tenant');
      expect(component.navItems()[1].route).toBe('/tenant/submit-request');
    });

    // Task 10.1: SidebarNavComponent shows "Submit Request" nav item for Tenant role (AC #1)
    it('should show Submit Request nav item with add_circle icon for Tenant', () => {
      const submitItem = component.navItems().find((item) => item.label === 'Submit Request');
      expect(submitItem).toBeTruthy();
      expect(submitItem?.route).toBe('/tenant/submit-request');
      expect(submitItem?.icon).toBe('add_circle');
    });

    it('should render 2 nav items in the DOM', () => {
      const navItems = fixture.debugElement.queryAll(By.css('.nav-item'));
      expect(navItems.length).toBe(2);
    });
  });

  describe('userDisplayName fallback logic (AC-7.2.2)', () => {
    it('should fall back to email when displayName is null', async () => {
      const userWithoutDisplayName: User = {
        userId: 'test-user-id',
        accountId: 'test-account-id',
        role: 'Owner',
        email: 'fallback@example.com',
        displayName: null,
        propertyId: null,
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
        propertyId: null,
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
