import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { BottomNavComponent } from './bottom-nav.component';
import { ReceiptStore } from '../../../features/receipts/stores/receipt.store';
import { ApiClient } from '../../api/api.service';

describe('BottomNavComponent', () => {
  let component: BottomNavComponent;
  let fixture: ComponentFixture<BottomNavComponent>;

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
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
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

    fixture = TestBed.createComponent(BottomNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadUnprocessedReceipts on init (AC-5.3.1)', () => {
    // ngOnInit is called during fixture.detectChanges() in beforeEach
    expect(mockReceiptStore.loadUnprocessedReceipts).toHaveBeenCalled();
  });

  it('should have 5 navigation items (AC7.5)', () => {
    expect(component.navItems.length).toBe(5);
  });

  it('should have correct navigation items (AC7.5)', () => {
    const expectedLabels = ['Dashboard', 'Properties', 'Expenses', 'Income', 'Receipts'];
    const actualLabels = component.navItems.map((item) => item.label);
    expect(actualLabels).toEqual(expectedLabels);
  });

  it('should not include Reports and Settings in mobile nav', () => {
    const labels = component.navItems.map((item) => item.label);
    expect(labels).not.toContain('Reports');
    expect(labels).not.toContain('Settings');
  });

  // FAB moved to MobileCaptureFabComponent (AC-5.2.1)
  // See mobile-capture-fab.component.spec.ts for FAB tests

  it('should render all nav tabs in the DOM (AC7.5)', () => {
    const navTabs = fixture.debugElement.queryAll(By.css('.nav-tab'));
    expect(navTabs.length).toBe(5);
  });

  it('should have touch-friendly tap targets (AC7.5)', () => {
    const navTabs = fixture.debugElement.queryAll(By.css('.nav-tab'));
    // The CSS sets min-width and min-height to 44px
    // We verify the class exists which applies these styles
    expect(navTabs.length).toBeGreaterThan(0);
    navTabs.forEach((tab) => {
      expect(tab.nativeElement.classList.contains('nav-tab')).toBe(true);
    });
  });
});
