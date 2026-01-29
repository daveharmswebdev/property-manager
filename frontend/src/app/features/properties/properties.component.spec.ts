import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PropertiesComponent } from './properties.component';
import { PropertyStore } from './stores/property.store';
import { YearSelectorService } from '../../core/services/year-selector.service';

/**
 * Unit tests for PropertiesComponent (AC-2.1.1)
 *
 * Test coverage:
 * - Component creation
 * - Header and Add Property button
 * - Loading state
 * - Error state
 * - Empty state
 * - Property list display
 */
describe('PropertiesComponent', () => {
  let component: PropertiesComponent;
  let fixture: ComponentFixture<PropertiesComponent>;
  let router: Router;

  const mockPropertyStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isEmpty: signal(false),
    properties: signal([
      { id: 'prop-1', name: 'Test Property 1', city: 'Austin', state: 'TX', expenseTotal: 1000, incomeTotal: 2000 },
      { id: 'prop-2', name: 'Test Property 2', city: 'Dallas', state: 'TX', expenseTotal: 500, incomeTotal: 1500 },
    ]),
    totalCount: signal(2),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PropertiesComponent],
      providers: [
        provideRouter([
          { path: 'properties/new', component: PropertiesComponent },
          { path: 'properties/:id', component: PropertiesComponent },
        ]),
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render properties container', () => {
    const container = fixture.debugElement.query(By.css('.properties-container'));
    expect(container).toBeTruthy();
  });

  it('should display "Properties" header', () => {
    const header = fixture.debugElement.query(By.css('.properties-header h1'));
    expect(header).toBeTruthy();
    expect(header.nativeElement.textContent.trim()).toBe('Properties');
  });

  it('should render Add Property button', () => {
    const addBtn = fixture.debugElement.query(By.css('.properties-header button'));
    expect(addBtn).toBeTruthy();
    expect(addBtn.nativeElement.textContent).toContain('Add Property');
  });

  it('should have Add Property button with routerLink to /properties/new', () => {
    const addBtn = fixture.debugElement.query(By.css('.properties-header button'));
    expect(addBtn.attributes['routerLink']).toBe('/properties/new');
  });

  it('should render property list card', () => {
    const card = fixture.debugElement.query(By.css('.properties-list-card'));
    expect(card).toBeTruthy();
  });

  it('should display property count in subtitle', () => {
    const subtitle = fixture.debugElement.query(By.css('mat-card-subtitle'));
    expect(subtitle).toBeTruthy();
    expect(subtitle.nativeElement.textContent).toContain('2');
    expect(subtitle.nativeElement.textContent).toContain('properties');
  });

  it('should render property rows for each property', () => {
    const rows = fixture.debugElement.queryAll(By.css('app-property-row'));
    expect(rows.length).toBe(2);
  });

  it('should navigate to property detail when row clicked', () => {
    component.navigateToProperty('prop-1');
    expect(router.navigate).toHaveBeenCalledWith(['/properties', 'prop-1']);
  });

  it('should call loadProperties on yearService', () => {
    // Effect runs on init, loadProperties is called
    expect(mockPropertyStore.loadProperties).toHaveBeenCalled();
  });
});

describe('PropertiesComponent loading state', () => {
  let fixture: ComponentFixture<PropertiesComponent>;

  const mockPropertyStore = {
    isLoading: signal(true),
    error: signal<string | null>(null),
    isEmpty: signal(false),
    properties: signal([]),
    totalCount: signal(0),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertiesComponent],
      providers: [
        provideRouter([]),
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesComponent);
    fixture.detectChanges();
  });

  it('should show loading spinner when loading', () => {
    const spinner = fixture.debugElement.query(By.css('app-loading-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('should not show properties list when loading', () => {
    const card = fixture.debugElement.query(By.css('.properties-list-card'));
    expect(card).toBeFalsy();
  });
});

describe('PropertiesComponent error state', () => {
  let component: PropertiesComponent;
  let fixture: ComponentFixture<PropertiesComponent>;

  const mockPropertyStore = {
    isLoading: signal(false),
    error: signal<string | null>('Failed to load properties'),
    isEmpty: signal(false),
    properties: signal([]),
    totalCount: signal(0),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PropertiesComponent],
      providers: [
        provideRouter([]),
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show error card when error exists', () => {
    const errorCard = fixture.debugElement.query(By.css('app-error-card'));
    expect(errorCard).toBeTruthy();
  });

  it('should call loadProperties when retry is triggered', () => {
    component.loadProperties();
    expect(mockPropertyStore.loadProperties).toHaveBeenCalledWith(2026);
  });
});

describe('PropertiesComponent empty state', () => {
  let fixture: ComponentFixture<PropertiesComponent>;

  const mockPropertyStore = {
    isLoading: signal(false),
    error: signal<string | null>(null),
    isEmpty: signal(true),
    properties: signal([]),
    totalCount: signal(0),
    loadProperties: vi.fn(),
  };

  const mockYearService = {
    selectedYear: signal(2026),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertiesComponent],
      providers: [
        provideRouter([]),
        { provide: PropertyStore, useValue: mockPropertyStore },
        { provide: YearSelectorService, useValue: mockYearService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesComponent);
    fixture.detectChanges();
  });

  it('should show empty state when isEmpty is true', () => {
    const emptyState = fixture.debugElement.query(By.css('app-empty-state'));
    expect(emptyState).toBeTruthy();
  });

  it('should not show properties list when empty', () => {
    const card = fixture.debugElement.query(By.css('.properties-list-card'));
    expect(card).toBeFalsy();
  });
});
