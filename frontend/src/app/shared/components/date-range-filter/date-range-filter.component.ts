import { Component, input, output, effect } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { DateRangePreset } from '../../utils/date-range.utils';
import { formatLocalDate } from '../../utils/date.utils';

/**
 * Shared DateRangeFilterComponent (AC-16.6.1)
 *
 * Presentation component — owns no state.
 * Receives values via inputs, emits changes via outputs.
 * Parent page/store is responsible for computing date ranges and calling APIs.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
  ],
  template: `
    <div class="date-range-container">
      <!-- Preset Dropdown -->
      <mat-form-field appearance="outline" class="date-range-field">
        <mat-label>Date Range</mat-label>
        <mat-select [value]="dateRangePreset()" (selectionChange)="onPresetChange($event.value)">
          <mat-option value="all">All Time</mat-option>
          <mat-option value="this-month">This Month</mat-option>
          <mat-option value="this-quarter">This Quarter</mat-option>
          <mat-option value="this-year">This Year</mat-option>
          <mat-option value="custom">Custom Range</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Custom Date Range -->
      @if (dateRangePreset() === 'custom') {
        <div class="date-fields">
          <mat-form-field appearance="outline" class="date-field">
            <mat-label>From</mat-label>
            <input matInput [matDatepicker]="fromPicker" [formControl]="customDateFrom">
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
            <mat-datepicker #fromPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" class="date-field">
            <mat-label>To</mat-label>
            <input matInput [matDatepicker]="toPicker" [formControl]="customDateTo">
            <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
            <mat-datepicker #toPicker></mat-datepicker>
          </mat-form-field>

          <button mat-stroked-button color="primary" (click)="applyCustomDateRange()" class="apply-btn">
            Apply
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .date-range-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-start;
    }

    .date-range-field {
      min-width: 150px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .date-fields {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .date-field {
      width: 140px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .apply-btn {
      margin-top: 4px;
    }

    @media (max-width: 768px) {
      .date-range-container {
        flex-direction: column;
        width: 100%;
      }

      .date-range-field {
        width: 100%;
        min-width: unset;
      }

      .date-fields {
        flex-direction: column;
        width: 100%;
      }

      .date-field {
        width: 100%;
      }
    }
  `],
})
export class DateRangeFilterComponent {
  // Inputs
  dateRangePreset = input<DateRangePreset>('all');
  dateFrom = input<string | null>(null);
  dateTo = input<string | null>(null);

  // Outputs
  dateRangePresetChange = output<DateRangePreset>();
  customDateRangeChange = output<{ dateFrom: string; dateTo: string }>();

  // Form controls for custom date range
  customDateFrom = new FormControl<Date | null>(null);
  customDateTo = new FormControl<Date | null>(null);

  constructor() {
    // Sync dateFrom input with custom date picker FormControl
    effect(() => {
      const from = this.dateFrom();
      const currentFrom = this.customDateFrom.value;
      if (from) {
        const fromDate = new Date(from + 'T00:00:00');
        if (!currentFrom || currentFrom.getTime() !== fromDate.getTime()) {
          this.customDateFrom.setValue(fromDate, { emitEvent: false });
        }
      } else if (currentFrom) {
        this.customDateFrom.setValue(null, { emitEvent: false });
      }
    });

    // Sync dateTo input with custom date picker FormControl
    effect(() => {
      const to = this.dateTo();
      const currentTo = this.customDateTo.value;
      if (to) {
        const toDate = new Date(to + 'T00:00:00');
        if (!currentTo || currentTo.getTime() !== toDate.getTime()) {
          this.customDateTo.setValue(toDate, { emitEvent: false });
        }
      } else if (currentTo) {
        this.customDateTo.setValue(null, { emitEvent: false });
      }
    });
  }

  onPresetChange(preset: DateRangePreset): void {
    this.dateRangePresetChange.emit(preset);
  }

  applyCustomDateRange(): void {
    const fromDate = this.customDateFrom.value;
    const toDate = this.customDateTo.value;

    if (fromDate && toDate) {
      this.customDateRangeChange.emit({
        dateFrom: formatLocalDate(fromDate),
        dateTo: formatLocalDate(toDate),
      });
    }
  }
}
