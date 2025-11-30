import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from './core/services/auth.service';

/**
 * Root Application Component (AC7.8)
 *
 * Shows loading state while auth is being initialized to prevent
 * flash of unauthenticated content on protected routes.
 */
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, MatProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('property-manager');
  protected readonly authService = inject(AuthService);

  // Expose isInitializing for template (AC7.8)
  readonly isInitializing = this.authService.isInitializing;
}
