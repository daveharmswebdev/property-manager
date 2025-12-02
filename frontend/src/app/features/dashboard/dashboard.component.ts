import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { PropertyStore } from '../properties/stores/property.store';
import { StatsBarComponent } from '../../shared/components/stats-bar/stats-bar.component';
import { PropertyRowComponent } from '../../shared/components/property-row/property-row.component';

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
    MatProgressSpinnerModule,
    StatsBarComponent,
    PropertyRowComponent,
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

      <!-- Stats Bar (AC-2.2.1) -->
      <app-stats-bar
        [expenseTotal]="propertyStore.totalExpenses()"
        [incomeTotal]="propertyStore.totalIncome()">
      </app-stats-bar>

      <!-- Loading State -->
      @if (propertyStore.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      <!-- Error State -->
      @if (propertyStore.error()) {
        <mat-card class="error-card">
          <mat-icon>error_outline</mat-icon>
          <p>{{ propertyStore.error() }}</p>
          <button mat-button color="primary" (click)="loadProperties()">Try Again</button>
        </mat-card>
      }

      <!-- Properties List or Empty State -->
      @if (!propertyStore.isLoading() && !propertyStore.error()) {
        <div class="dashboard-content">
          @if (propertyStore.isEmpty()) {
            <!-- Empty State (AC-2.2.3) -->
            <mat-card class="empty-state-card">
              <mat-icon class="placeholder-icon">home_work</mat-icon>
              <h2>No properties yet</h2>
              <p>Add your first property to get started.</p>
              <button mat-raised-button color="primary" routerLink="/properties/new">
                <mat-icon>add</mat-icon>
                Add Property
              </button>
            </mat-card>
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

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .error-card {
      text-align: center;
      padding: 24px;
      max-width: 400px;
      margin: 0 auto;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--pm-error, #c62828);
      }

      p {
        margin: 16px 0;
        color: var(--pm-text-secondary);
      }
    }

    .dashboard-content {
      display: flex;
      justify-content: center;
    }

    .empty-state-card {
      text-align: center;
      padding: 48px;
      max-width: 400px;
      width: 100%;

      .placeholder-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--pm-primary);
        margin-bottom: 16px;
      }

      h2 {
        color: var(--pm-text-primary);
        font-size: 24px;
        font-weight: 500;
        margin: 0 0 12px 0;
      }

      p {
        color: var(--pm-text-secondary);
        font-size: 16px;
        margin: 0 0 24px 0;
        line-height: 1.5;
      }

      button mat-icon {
        margin-right: 8px;
      }
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

      .empty-state-card {
        padding: 32px 24px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly propertyStore = inject(PropertyStore);

  readonly currentUser = this.authService.currentUser;

  ngOnInit(): void {
    this.loadProperties();
  }

  loadProperties(): void {
    this.propertyStore.loadProperties(undefined);
  }

  navigateToProperty(propertyId: string): void {
    this.router.navigate(['/properties', propertyId]);
  }
}
