import { Component, inject, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/services/auth.service';
import { PropertyStore } from '../properties/stores/property.store';
import { StatsBarComponent } from '../../shared/components/stats-bar/stats-bar.component';
import { PropertyRowComponent } from '../../shared/components/property-row/property-row.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorCardComponent } from '../../shared/components/error-card/error-card.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DateRangeFilterComponent } from '../../shared/components/date-range-filter/date-range-filter.component';
import { DateRangePreset, getDateRangeFromPreset } from '../../shared/utils/date-range.utils';

/**
 * Dashboard Component (AC-2.2.1, AC-2.2.2, AC-2.2.3, AC-2.2.4)
 *
 * Main dashboard showing:
 * - Stats bar with financial summary (expenses, income, net income)
 * - List of properties or empty state
 * - Add Property button
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    StatsBarComponent,
    PropertyRowComponent,
    EmptyStateComponent,
    ErrorCardComponent,
    LoadingSpinnerComponent,
    DateRangeFilterComponent,
  ],
  template: `
    <div class="dashboard-container">
      <!-- Welcome Section -->
      <header class="dashboard-header">
        <div class="header-content">
          <h1>Welcome back!</h1>
          <p class="subtitle">Here's your property management overview.</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/properties/new">
          <mat-icon>add</mat-icon>
          Add Property
        </button>
      </header>

      <!-- Date Range Filter (AC-17.12.2) -->
      <mat-card class="filters-card">
        <app-date-range-filter
          [dateRangePreset]="dateRangePreset()"
          [dateFrom]="dateFrom()"
          [dateTo]="dateTo()"
          (dateRangePresetChange)="onDateRangePresetChange($event)"
          (customDateRangeChange)="onCustomDateRangeChange($event)"
        />
      </mat-card>

      <!-- Stats Bar (AC-2.2.1) -->
      <app-stats-bar
        [expenseTotal]="propertyStore.totalExpenses()"
        [incomeTotal]="propertyStore.totalIncome()">
      </app-stats-bar>

      <!-- Loading State -->
      @if (propertyStore.isLoading()) {
        <app-loading-spinner />
      }

      <!-- Error State -->
      @if (propertyStore.error()) {
        <app-error-card
          [message]="propertyStore.error()!"
          (retry)="loadProperties()" />
      }

      <!-- Properties List or Empty State -->
      @if (!propertyStore.isLoading() && !propertyStore.error()) {
        <div class="dashboard-content">
          @if (propertyStore.isEmpty()) {
            <!-- Empty State (AC-2.2.3) -->
            <app-empty-state
              icon="home_work"
              title="No properties yet"
              message="Add your first property to get started."
              actionLabel="Add Property"
              actionRoute="/properties/new"
              actionIcon="add" />
          } @else {
            <!-- Properties List (AC-2.2.2, AC-2.2.4) -->
            <mat-card class="properties-list-card">
              <mat-card-header>
                <mat-card-title>Your Properties</mat-card-title>
                <mat-card-subtitle>{{ propertyStore.totalCount() }} {{ propertyStore.totalCount() === 1 ? 'property' : 'properties' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="property-list">
                  @for (property of propertyStore.properties(); track property.id) {
                    <app-property-row
                      [id]="property.id"
                      [name]="property.name"
                      [city]="property.city"
                      [state]="property.state"
                      [expenseTotal]="property.expenseTotal"
                      [incomeTotal]="property.incomeTotal"
                      [thumbnailUrl]="property.primaryPhotoThumbnailUrl"
                      (rowClick)="navigateToProperty($event)">
                    </app-property-row>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;

      .header-content {
        h1 {
          color: var(--pm-text-primary);
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .subtitle {
          color: var(--pm-text-secondary);
          font-size: 16px;
          margin: 0;
        }
      }

      button mat-icon {
        margin-right: 8px;
      }
    }

    .filters-card {
      margin-bottom: 24px;
      padding: 16px;
    }

    .dashboard-content {
      display: flex;
      justify-content: center;
    }

    .properties-list-card {
      width: 100%;

      mat-card-header {
        margin-bottom: 8px;
      }

      mat-card-content {
        padding: 0;
      }

      .property-list {
        display: flex;
        flex-direction: column;
      }
    }

    @media (max-width: 767px) {
      .dashboard-header {
        flex-direction: column;
        gap: 16px;

        .header-content h1 {
          font-size: 24px;
        }

        button {
          width: 100%;
        }
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly propertyStore = inject(PropertyStore);

  readonly currentUser = this.authService.currentUser;

  readonly dateRangePreset = signal<DateRangePreset>('this-year');
  readonly dateFrom = signal<string | null>(null);
  readonly dateTo = signal<string | null>(null);

  constructor() {
    const initial = getDateRangeFromPreset('this-year');
    this.dateFrom.set(initial.dateFrom);
    this.dateTo.set(initial.dateTo);

    effect(() => {
      const from = this.dateFrom();
      const to = this.dateTo();
      this.propertyStore.loadProperties({ dateFrom: from ?? undefined, dateTo: to ?? undefined });
    });
  }

  ngOnInit(): void {
    // Initial load happens via effect when dateFrom/dateTo signals are read
  }

  loadProperties(): void {
    this.propertyStore.loadProperties({ dateFrom: this.dateFrom() ?? undefined, dateTo: this.dateTo() ?? undefined });
  }

  onDateRangePresetChange(preset: DateRangePreset): void {
    this.dateRangePreset.set(preset);
    const { dateFrom, dateTo } = getDateRangeFromPreset(preset);
    this.dateFrom.set(dateFrom);
    this.dateTo.set(dateTo);
  }

  onCustomDateRangeChange(range: { dateFrom: string; dateTo: string }): void {
    this.dateRangePreset.set('custom');
    this.dateFrom.set(range.dateFrom);
    this.dateTo.set(range.dateTo);
  }

  navigateToProperty(propertyId: string): void {
    this.router.navigate(['/properties', propertyId]);
  }
}
