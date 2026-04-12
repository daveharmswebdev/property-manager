import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { BottomNavComponent } from './bottom-nav.component';
import { AuthService, User } from '../../services/auth.service';
import { ReceiptStore } from '../../../features/receipts/stores/receipt.store';
import { ApiClient } from '../../api/api.service';

describe('BottomNavComponent', () => {
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
      displayName: 'Test User',
      propertyId: null,
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal<User | null>(mockUser) } },
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

    const fixture = TestBed.createComponent(BottomNavComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  }

  describe('Owner role (AC: #1)', () => {
    let component: BottomNavComponent;
    let fixture: ComponentFixture<BottomNavComponent>;

    beforeEach(async () => {
      ({ fixture, component } = await setupWithRole('Owner'));
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should call loadUnprocessedReceipts on init (AC-5.3.1)', () => {
      expect(mockReceiptStore.loadUnprocessedReceipts).toHaveBeenCalled();
    });

    it('should have 5 navigation items for Owner (AC7.5)', () => {
      expect(component.navItems().length).toBe(5);
    });

    it('should have correct navigation items for Owner (AC7.5)', () => {
      const expectedLabels = ['Dashboard', 'Properties', 'Expenses', 'Income', 'Receipts'];
      const actualLabels = component.navItems().map((item) => item.label);
      expect(actualLabels).toEqual(expectedLabels);
    });

    it('should not include Reports and Settings in mobile nav', () => {
      const labels = component.navItems().map((item) => item.label);
      expect(labels).not.toContain('Reports');
      expect(labels).not.toContain('Settings');
    });

    it('should render all nav tabs in the DOM (AC7.5)', () => {
      const navTabs = fixture.debugElement.queryAll(By.css('.nav-tab'));
      expect(navTabs.length).toBe(5);
    });

    it('should have touch-friendly tap targets (AC7.5)', () => {
      const navTabs = fixture.debugElement.queryAll(By.css('.nav-tab'));
      expect(navTabs.length).toBeGreaterThan(0);
      navTabs.forEach((tab) => {
        expect(tab.nativeElement.classList.contains('nav-tab')).toBe(true);
      });
    });
  });

  describe('Contributor role (AC: #6)', () => {
    let component: BottomNavComponent;
    let fixture: ComponentFixture<BottomNavComponent>;

    beforeEach(async () => {
      ({ fixture, component } = await setupWithRole('Contributor'));
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

    it('should render 3 nav tabs in the DOM for Contributor', () => {
      const navTabs = fixture.debugElement.queryAll(By.css('.nav-tab'));
      expect(navTabs.length).toBe(3);
    });
  });
});
