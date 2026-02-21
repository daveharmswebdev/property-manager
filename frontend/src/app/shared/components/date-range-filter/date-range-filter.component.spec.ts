/**
 * ATDD RED Phase — Story 16.6, Task 1.5
 *
 * Component tests for DateRangeFilterComponent.
 * Will NOT pass until the component is created (Task 1.2-1.4).
 *
 * Tests verify:
 * - Preset dropdown renders with 5 options (AC1)
 * - Preset change emits output event
 * - Custom date range inputs appear when 'custom' selected
 * - Custom date range emits formatted dates on Apply
 * - Does not emit if either custom date is missing
 * - Accepts dateFrom/dateTo inputs for custom range sync
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DateRangeFilterComponent } from './date-range-filter.component';

describe('DateRangeFilterComponent', () => {
  let component: DateRangeFilterComponent;
  let fixture: ComponentFixture<DateRangeFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangeFilterComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangeFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('preset dropdown', () => {
    it('should render date range preset dropdown', () => {
      const select = fixture.nativeElement.querySelector('mat-select');
      expect(select).toBeTruthy();
    });

    it('should default to all preset', () => {
      // GIVEN: component with default inputs
      // THEN: dateRangePreset input defaults to 'all'
      expect(component.dateRangePreset()).toBe('all');
    });

    it('should emit dateRangePresetChange on preset selection', () => {
      // GIVEN: component is rendered
      const emitSpy = vi.spyOn(component.dateRangePresetChange, 'emit');

      // WHEN: a preset is selected
      component.onPresetChange('this-month');

      // THEN: output event emits the new preset
      expect(emitSpy).toHaveBeenCalledWith('this-month');
    });

    it('should emit dateRangePresetChange for each preset value', () => {
      const emitSpy = vi.spyOn(component.dateRangePresetChange, 'emit');

      // WHEN/THEN: each preset triggers emission
      component.onPresetChange('this-quarter');
      expect(emitSpy).toHaveBeenCalledWith('this-quarter');

      component.onPresetChange('this-year');
      expect(emitSpy).toHaveBeenCalledWith('this-year');

      component.onPresetChange('all');
      expect(emitSpy).toHaveBeenCalledWith('all');
    });
  });

  describe('custom date range', () => {
    it('should NOT show date inputs when preset is not custom', () => {
      // GIVEN: preset is 'all' (default)
      fixture.componentRef.setInput('dateRangePreset', 'all');
      fixture.detectChanges();

      // THEN: custom date fields are hidden
      const dateFields = fixture.nativeElement.querySelector('.date-fields');
      expect(dateFields).toBeFalsy();
    });

    it('should show date inputs when preset is custom', () => {
      // GIVEN: preset is 'custom'
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.detectChanges();

      // THEN: custom date fields are visible
      const dateFields = fixture.nativeElement.querySelector('.date-fields');
      expect(dateFields).toBeTruthy();
    });

    it('should emit customDateRangeChange with formatted dates on Apply', () => {
      // GIVEN: preset is custom with both dates set
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.customDateRangeChange, 'emit');

      // WHEN: dates are set and Apply is clicked
      component.customDateFrom.setValue(new Date(2025, 0, 1));
      component.customDateTo.setValue(new Date(2025, 11, 31));
      component.applyCustomDateRange();

      // THEN: formatted dates are emitted
      expect(emitSpy).toHaveBeenCalledWith({
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });
    });

    it('should NOT emit customDateRangeChange if dateFrom is missing', () => {
      // GIVEN: preset is custom, only dateTo set
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.customDateRangeChange, 'emit');

      // WHEN: only dateTo is set
      component.customDateTo.setValue(new Date(2025, 11, 31));
      component.applyCustomDateRange();

      // THEN: no emission
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit customDateRangeChange if dateTo is missing', () => {
      // GIVEN: preset is custom, only dateFrom set
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.customDateRangeChange, 'emit');

      // WHEN: only dateFrom is set
      component.customDateFrom.setValue(new Date(2025, 0, 1));
      component.applyCustomDateRange();

      // THEN: no emission
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('input synchronization', () => {
    it('should sync dateFrom input to custom date form control', () => {
      // GIVEN: component receives dateFrom from parent
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.componentRef.setInput('dateFrom', '2025-01-15');
      fixture.detectChanges();

      // THEN: custom date from control has the date value
      expect(component.customDateFrom.value).toBeTruthy();
    });

    it('should sync dateTo input to custom date form control', () => {
      // GIVEN: component receives dateTo from parent
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.componentRef.setInput('dateTo', '2025-12-31');
      fixture.detectChanges();

      // THEN: custom date to control has the date value
      expect(component.customDateTo.value).toBeTruthy();
    });

    it('should clear custom date controls when preset changes from custom to non-custom', () => {
      // GIVEN: preset is custom with dates set
      fixture.componentRef.setInput('dateRangePreset', 'custom');
      fixture.componentRef.setInput('dateFrom', '2025-01-15');
      fixture.componentRef.setInput('dateTo', '2025-12-31');
      fixture.detectChanges();

      // WHEN: preset changes to 'all'
      fixture.componentRef.setInput('dateRangePreset', 'all');
      fixture.componentRef.setInput('dateFrom', null);
      fixture.componentRef.setInput('dateTo', null);
      fixture.detectChanges();

      // THEN: custom date controls are cleared
      expect(component.customDateFrom.value).toBeNull();
      expect(component.customDateTo.value).toBeNull();
    });
  });
});
