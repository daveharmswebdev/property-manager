import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Login</mat-card-title>
          <mat-card-subtitle>Coming soon</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Login functionality will be implemented in a future story.</p>
        </mat-card-content>
        <mat-card-actions>
          <a mat-raised-button color="primary" routerLink="/register">
            Create Account
          </a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background-color: var(--mat-sys-surface-container);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    mat-card-content p {
      color: var(--mat-sys-on-surface-variant);
      margin: 16px 0;
    }
    mat-card-actions {
      justify-content: center;
      padding-bottom: 16px;
    }
  `]
})
export class LoginComponent {}
