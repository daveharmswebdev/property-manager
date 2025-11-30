import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

/**
 * Dashboard Component (AC7.3)
 *
 * Placeholder dashboard displaying "Dashboard coming soon" message.
 * Structure prepared for future stats bar and property list.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="dashboard-container">
      <!-- Welcome Section -->
      <header class="dashboard-header">
        <h1>Welcome back!</h1>
        <p class="subtitle">Here's your property management overview.</p>
      </header>

      <!-- Placeholder Content (AC7.3) -->
      <div class="dashboard-content">
        <mat-card class="coming-soon-card">
          <mat-icon class="placeholder-icon">dashboard</mat-icon>
          <h2>Dashboard coming soon</h2>
          <p>
            Your property stats, recent activity, and quick actions will appear here.
          </p>
          <div class="feature-preview">
            <div class="feature-item">
              <mat-icon>home_work</mat-icon>
              <span>Property Overview</span>
            </div>
            <div class="feature-item">
              <mat-icon>trending_up</mat-icon>
              <span>Income Summary</span>
            </div>
            <div class="feature-item">
              <mat-icon>receipt_long</mat-icon>
              <span>Expense Tracking</span>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      margin-bottom: 24px;

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

    .dashboard-content {
      display: flex;
      justify-content: center;
    }

    .coming-soon-card {
      text-align: center;
      padding: 48px;
      max-width: 500px;
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
        margin: 0 0 32px 0;
        line-height: 1.5;
      }
    }

    .feature-preview {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .feature-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-radius: 8px;
      background-color: rgba(102, 187, 106, 0.08);
      min-width: 100px;

      mat-icon {
        color: var(--pm-primary);
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      span {
        font-size: 12px;
        color: var(--pm-text-secondary);
        font-weight: 500;
      }
    }

    @media (max-width: 767px) {
      .dashboard-header {
        h1 {
          font-size: 24px;
        }
      }

      .coming-soon-card {
        padding: 32px 24px;
      }

      .feature-preview {
        gap: 12px;
      }

      .feature-item {
        min-width: 80px;
        padding: 12px;
      }
    }
  `]
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  readonly currentUser = this.authService.currentUser;
}
