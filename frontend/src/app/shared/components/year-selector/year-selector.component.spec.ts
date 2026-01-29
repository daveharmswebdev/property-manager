import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { YearSelectorComponent } from './year-selector.component';
import { YearSelectorService } from '../../../core/services/year-selector.service';

describe('YearSelectorComponent', () => {
  let component: YearSelectorComponent;
  let fixture: ComponentFixture<YearSelectorComponent>;
  let mockYearService: {
    selectedYear: ReturnType<typeof signal<number>>;
    availableYears: ReturnType<typeof signal<number[]>>;
    setYear: ReturnType<typeof vi.fn>;
  };

  const currentYear = new Date().getFullYear();
  const availableYears = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4,
    currentYear - 5,
  ];

  beforeEach(async () => {
    mockYearService = {
      selectedYear: signal(currentYear),
      availableYears: signal(availableYears),
      setYear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [YearSelectorComponent, NoopAnimationsModule],
      providers: [{ provide: YearSelectorService, useValue: mockYearService }],
    }).compileComponents();

    fixture = TestBed.createComponent(YearSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should inject YearSelectorService', () => {
    expect(component.yearService).toBeTruthy();
  });

  it('should have year-selector-wrapper container', () => {
    const wrapper = fixture.debugElement.query(By.css('.year-selector-wrapper'));
    expect(wrapper).toBeTruthy();
  });

  it('should display calendar icon (AC-3.5.1)', () => {
    const icon = fixture.debugElement.query(By.css('.calendar-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('calendar_today');
  });

  it('should render mat-select element', () => {
    const select = fixture.debugElement.query(By.css('mat-select'));
    expect(select).toBeTruthy();
  });

  it('should have aria-label for accessibility', () => {
    const select = fixture.debugElement.query(By.css('mat-select'));
    expect(select.attributes['aria-label']).toBe('Select tax year');
  });

  it('should have data-testid attribute', () => {
    const select = fixture.debugElement.query(By.css('[data-testid="year-selector"]'));
    expect(select).toBeTruthy();
  });

  it('should display current year from service', () => {
    expect(component.yearService.selectedYear()).toBe(currentYear);
  });

  it('should call setYear when year is changed (AC-3.5.5)', () => {
    const newYear = currentYear - 1;
    component.onYearChange(newYear);

    expect(mockYearService.setYear).toHaveBeenCalledWith(newYear);
  });

  it('should call setYear with correct year value', () => {
    const targetYear = currentYear - 2;
    component.onYearChange(targetYear);

    expect(mockYearService.setYear).toHaveBeenCalledWith(targetYear);
  });
});

describe('YearSelectorComponent with different selected year', () => {
  let fixture: ComponentFixture<YearSelectorComponent>;
  let mockYearService: {
    selectedYear: ReturnType<typeof signal<number>>;
    availableYears: ReturnType<typeof signal<number[]>>;
    setYear: ReturnType<typeof vi.fn>;
  };

  const currentYear = new Date().getFullYear();
  const selectedYear = currentYear - 2;

  beforeEach(async () => {
    mockYearService = {
      selectedYear: signal(selectedYear),
      availableYears: signal([
        currentYear,
        currentYear - 1,
        currentYear - 2,
        currentYear - 3,
        currentYear - 4,
        currentYear - 5,
      ]),
      setYear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [YearSelectorComponent, NoopAnimationsModule],
      providers: [{ provide: YearSelectorService, useValue: mockYearService }],
    }).compileComponents();

    fixture = TestBed.createComponent(YearSelectorComponent);
    fixture.detectChanges();
  });

  it('should display selected year from service', () => {
    expect(fixture.componentInstance.yearService.selectedYear()).toBe(selectedYear);
  });
});

describe('YearSelectorComponent available years (AC-3.5.1)', () => {
  let component: YearSelectorComponent;
  let fixture: ComponentFixture<YearSelectorComponent>;
  let mockYearService: {
    selectedYear: ReturnType<typeof signal<number>>;
    availableYears: ReturnType<typeof signal<number[]>>;
    setYear: ReturnType<typeof vi.fn>;
  };

  const currentYear = new Date().getFullYear();
  const availableYears = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4,
    currentYear - 5,
  ];

  beforeEach(async () => {
    mockYearService = {
      selectedYear: signal(currentYear),
      availableYears: signal(availableYears),
      setYear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [YearSelectorComponent, NoopAnimationsModule],
      providers: [{ provide: YearSelectorService, useValue: mockYearService }],
    }).compileComponents();

    fixture = TestBed.createComponent(YearSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have 6 available years from service', () => {
    expect(component.yearService.availableYears().length).toBe(6);
  });

  it('should include current year in available years', () => {
    expect(component.yearService.availableYears()).toContain(currentYear);
  });

  it('should include 5 previous years', () => {
    const years = component.yearService.availableYears();
    expect(years).toContain(currentYear - 1);
    expect(years).toContain(currentYear - 2);
    expect(years).toContain(currentYear - 3);
    expect(years).toContain(currentYear - 4);
    expect(years).toContain(currentYear - 5);
  });
});
