import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * Properties list component (AC-2.1.1)
 * Shows list of properties with Add Property button
 */
@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="properties-container">
      <header class="properties-header">
        <h1>Properties</h1>
        <button mat-raised-button color="primary" routerLink="/properties/new">
          <mat-icon>add</mat-icon>
          Add Property
        </button>
      </header>

      <div class="properties-content">
        <mat-card class="empty-state-card">
          <mat-icon class="placeholder-icon">home_work</mat-icon>
          <h2>No properties yet</h2>
          <p>Add your first property to get started.</p>
          <button mat-raised-button color="primary" routerLink="/properties/new">
            <mat-icon>add</mat-icon>
            Add Property
          </button>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .properties-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .properties-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        color: var(--pm-text-primary);
        font-size: 28px;
        font-weight: 600;
        margin: 0;
      }

      button {
        mat-icon {
          margin-right: 8px;
        }
      }
    }

    .properties-content {
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
        margin: 0 0 8px 0;
      }

      p {
        color: var(--pm-text-secondary);
        margin: 0 0 24px 0;
      }

      button mat-icon {
        margin-right: 8px;
      }
    }

    @media (max-width: 767px) {
      .properties-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;

        h1 {
          font-size: 24px;
        }

        button {
          width: 100%;
        }
      }
    }
  `]
})
export class PropertiesComponent {}
