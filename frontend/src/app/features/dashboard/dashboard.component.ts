import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
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
          <button mat-raised-button color="warn" (click)="logout()" [disabled]="isLoggingOut()">
            @if (isLoggingOut()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>logout</mat-icon>
            }
            {{ isLoggingOut() ? 'Logging out...' : 'Logout' }}
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
    mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `]
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly isLoggingOut = signal(false);

  logout(): void {
    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even on error, redirect to login (local state is cleared)
        this.router.navigate(['/login']);
      }
    });
  }
}
