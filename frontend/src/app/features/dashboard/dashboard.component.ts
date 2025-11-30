import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dashboard-container">
      <mat-card class="welcome-card">
        <mat-card-header>
          <mat-card-title>Welcome to Property Manager</mat-card-title>
          <mat-card-subtitle>You are logged in as {{ currentUser()?.role }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Dashboard functionality will be implemented in future stories.</p>
          <p>For now, you have successfully logged in!</p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="warn" (click)="logout()">
            <mat-icon>logout</mat-icon>
            Logout
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background-color: var(--mat-sys-surface-container);
    }
    .welcome-card {
      width: 100%;
      max-width: 500px;
      text-align: center;
    }
    mat-card-content p {
      color: var(--mat-sys-on-surface-variant);
      margin: 8px 0;
    }
    mat-card-actions {
      justify-content: center;
      padding: 16px;
    }
  `]
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
