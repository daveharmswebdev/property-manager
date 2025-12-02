import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { AuthService } from '../../core/services/auth.service';
import { PropertyService, PropertySummaryDto } from '../properties/services/property.service';

/**
 * Dashboard Component (AC7.3, AC-2.1.1, AC-2.1.4)
 *
 * Shows property overview with Add Property button.
 * Displays list of properties or empty state when no properties exist.
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
    MatListModule
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

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <mat-card class="error-card">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error() }}</p>
          <button mat-button color="primary" (click)="loadProperties()">Try Again</button>
        </mat-card>
      }

      <!-- Properties List or Empty State -->
      @if (!loading() && !error()) {
        <div class="dashboard-content">
          @if (properties().length === 0) {
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
            <!-- Properties List (AC-2.1.4, AC-2.2.2) -->
            <mat-card class="properties-list-card">
              <mat-card-header>
                <mat-card-title>Your Properties</mat-card-title>
                <mat-card-subtitle>{{ properties().length }} {{ properties().length === 1 ? 'property' : 'properties' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <mat-list>
                  @for (property of properties(); track property.id) {
                    <mat-list-item class="property-item" [routerLink]="['/properties', property.id]">
                      <mat-icon matListItemIcon>home</mat-icon>
                      <div matListItemTitle>{{ property.name }}</div>
                      <div matListItemLine>{{ property.city }}, {{ property.state }}</div>
                      <div matListItemMeta class="expense-total">
                        {{ property.expenseTotal | currency }}
                      </div>
                    </mat-list-item>
                  }
                </mat-list>
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
        color: var(--pm-error);
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
        margin-bottom: 16px;
      }

      .property-item {
        cursor: pointer;
        border-radius: 8px;
        margin-bottom: 4px;

        &:hover {
          background-color: var(--pm-surface-hover, rgba(0, 0, 0, 0.04));
        }

        .expense-total {
          color: var(--pm-text-secondary);
          font-weight: 500;
        }
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
  private readonly propertyService = inject(PropertyService);

  readonly currentUser = this.authService.currentUser;
  readonly properties = signal<PropertySummaryDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadProperties();
  }

  loadProperties(): void {
    this.loading.set(true);
    this.error.set(null);

    this.propertyService.getProperties().subscribe({
      next: (response) => {
        this.properties.set(response.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load properties. Please try again.');
        this.loading.set(false);
        console.error('Error loading properties:', err);
      }
    });
  }
}
