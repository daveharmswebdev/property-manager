import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportService } from '../../services/report.service';
import { PropertyStore } from '../../../properties/stores/property.store';
import { YearSelectorService } from '../../../../core/services/year-selector.service';

/**
 * Property selection item for the batch dialog.
 */
interface PropertySelection {
  id: string;
  name: string;
  address: string;
  selected: boolean;
  hasDataForYear: boolean;
}

/**
 * Batch Report Dialog Component (AC-6.2.1, AC-6.2.2, AC-6.2.3, AC-6.2.4, AC-6.2.5, AC-6.2.6, AC-6.2.7)
 *
 * Modal dialog for generating Schedule E PDFs for multiple properties.
 * Features:
 * - Year selector dropdown (defaults to currently selected year)
 * - Property list with checkboxes (all checked by default)
 * - Select All / Deselect All toggle
 * - Dynamic button text showing count
 * - Progress indicator during generation
 * - ZIP download on completion
 * - Warning icons for properties with no data
 * - Error handling with retry option
 */
@Component({
  selector: 'app-batch-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title data-testid="batch-dialog-title">
      <mat-icon class="title-icon">summarize</mat-icon>
      Generate All Schedule E Reports
    </h2>

    <mat-dialog-content data-testid="batch-dialog-content">
      <mat-form-field appearance="outline" class="year-field">
        <mat-label>Tax Year</mat-label>
        <mat-select [(value)]="selectedYear" data-testid="year-select">
          @for (year of availableYears; track year) {
            <mat-option [value]="year">{{ year }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="property-list-header">
        <span class="property-count">Properties ({{ selectedCount() }} selected)</span>
        <button mat-button
                (click)="toggleAll()"
                data-testid="toggle-all-btn">
          {{ allSelected() ? 'Deselect All' : 'Select All' }}
        </button>
      </div>

      <div class="property-list" data-testid="property-list">
        @for (property of properties(); track property.id) {
          <div class="property-item">
            <mat-checkbox
              [checked]="property.selected"
              (change)="toggleProperty(property.id)"
              [attr.data-testid]="'property-checkbox-' + property.id">
              <div class="property-info">
                <span class="property-name">{{ property.name }}</span>
                <span class="property-address">{{ property.address }}</span>
              </div>
            </mat-checkbox>
            @if (!property.hasDataForYear) {
              <mat-icon
                class="warning-icon"
                [matTooltip]="'No transactions recorded for ' + selectedYear"
                [attr.data-testid]="'no-data-warning-' + property.id">
                warning
              </mat-icon>
            }
          </div>
        }

        @if (properties().length === 0) {
          <div class="empty-list">
            <p>No properties available. Add properties first to generate reports.</p>
          </div>
        }
      </div>

      @if (isLoading()) {
        <div class="loading-container" data-testid="loading-indicator">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Generating {{ selectedCount() }} reports...</p>
        </div>
      }

      @if (error()) {
        <div class="error-message" data-testid="error-message">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error() }}</p>
          <button mat-button color="primary" (click)="clearError()" data-testid="retry-button">
            Try Again
          </button>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-testid="cancel-btn">Cancel</button>
      <button mat-flat-button
              color="primary"
              [disabled]="isLoading() || selectedCount() === 0"
              (click)="generate()"
              data-testid="generate-btn">
        Generate ({{ selectedCount() }} Reports)
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      .title-icon {
        color: var(--pm-primary, #2e7d32);
      }
    }

    mat-dialog-content {
      padding: 24px;
      min-height: 300px;
    }

    .year-field {
      width: 100%;
      padding-top: 4px;
      margin-bottom: 16px;
    }

    .property-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .property-count {
        font-weight: 500;
        color: var(--pm-text-primary, #333);
      }
    }

    .property-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .property-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }
    }

    .property-info {
      display: flex;
      flex-direction: column;

      .property-name {
        font-weight: 500;
      }

      .property-address {
        font-size: 12px;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
      }
    }

    .warning-icon {
      color: #ff9800;
      font-size: 20px;
      height: 20px;
      width: 20px;
    }

    .empty-list {
      padding: 24px;
      text-align: center;
      color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      margin-top: 16px;

      p {
        margin: 16px 0 0 0;
        color: var(--pm-text-secondary, rgba(0, 0, 0, 0.6));
      }
    }

    .error-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      margin-top: 16px;
      text-align: center;
      background-color: #ffebee;
      border-radius: 4px;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #c62828;
      }

      p {
        margin: 8px 0;
        color: #c62828;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      gap: 8px;
    }
  `]
})
export class BatchReportDialogComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly propertyStore = inject(PropertyStore);
  private readonly yearService = inject(YearSelectorService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<BatchReportDialogComponent>);

  selectedYear = this.yearService.selectedYear();
  availableYears = this.generateYearOptions();

  readonly properties = signal<PropertySelection[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedCount = computed(() =>
    this.properties().filter(p => p.selected).length
  );

  readonly allSelected = computed(() =>
    this.properties().length > 0 &&
    this.properties().every(p => p.selected)
  );

  constructor() {
    // Watch for property changes from the store and update local state
    effect(() => {
      const storeProperties = this.propertyStore.properties();
      const isLoading = this.propertyStore.isLoading();

      // Only update when we have properties and loading is complete
      if (storeProperties.length > 0 && !isLoading) {
        this.initializeProperties();
      }
    });
  }

  ngOnInit(): void {
    // Ensure properties are loaded - trigger load if store is empty
    if (this.propertyStore.properties().length === 0 && !this.propertyStore.isLoading()) {
      this.propertyStore.loadProperties(this.selectedYear);
    }
    // Also initialize immediately if properties already exist
    if (this.propertyStore.properties().length > 0) {
      this.initializeProperties();
    }
  }

  /**
   * Initialize property selection from store.
   * Called on init and when store properties update.
   */
  private initializeProperties(): void {
    // Load properties from store
    const storeProperties = this.propertyStore.properties();
    this.properties.set(
      storeProperties.map(p => ({
        id: p.id,
        name: p.name,
        address: this.formatAddress(p),
        selected: true,
        // Determine if property has data (income or expense > 0)
        hasDataForYear: p.incomeTotal > 0 || p.expenseTotal > 0
      }))
    );
  }

  /**
   * Generate year options (current year + 9 previous years).
   */
  private generateYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => currentYear - i);
  }

  /**
   * Format property address from summary data.
   */
  private formatAddress(property: { city?: string; state?: string }): string {
    const parts: string[] = [];
    if (property.city) parts.push(property.city);
    if (property.state) parts.push(property.state);
    return parts.join(', ') || 'No address';
  }

  /**
   * Toggle selection for a single property.
   */
  toggleProperty(id: string): void {
    this.properties.update(props =>
      props.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }

  /**
   * Toggle all properties selection (AC-6.2.2).
   */
  toggleAll(): void {
    const newValue = !this.allSelected();
    this.properties.update(props =>
      props.map(p => ({ ...p, selected: newValue }))
    );
  }

  /**
   * Clear error state to allow retry (AC-6.2.7).
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Generate batch reports and trigger ZIP download (AC-6.2.3, AC-6.2.4, AC-6.2.5).
   */
  async generate(): Promise<void> {
    const selectedIds = this.properties()
      .filter(p => p.selected)
      .map(p => p.id);

    if (selectedIds.length === 0) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const blob = await this.reportService.generateBatchScheduleE(
        selectedIds,
        this.selectedYear
      );

      this.reportService.downloadZip(blob, this.selectedYear);

      this.snackBar.open(
        `${selectedIds.length} reports ready for download`,
        'Close',
        { duration: 5000 }
      );

      this.dialogRef.close({ generated: true });
    } catch (err) {
      console.error('Batch report generation failed:', err);
      this.error.set('Failed to generate reports. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
