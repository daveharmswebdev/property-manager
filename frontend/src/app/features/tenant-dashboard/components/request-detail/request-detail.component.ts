import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common';

import { TenantService, MaintenanceRequestDto } from '../../services/tenant.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorCardComponent } from '../../../../shared/components/error-card/error-card.component';

/**
 * Request Detail Component (Story 20.5, AC #4)
 *
 * Shows full detail for a single maintenance request:
 * - Full description
 * - Status with badge
 * - Submitted date
 * - Dismissal reason (if dismissed)
 * - Photos (if any)
 */
@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatButtonModule,
    DatePipe,
    LoadingSpinnerComponent,
    ErrorCardComponent,
  ],
  templateUrl: './request-detail.component.html',
  styleUrl: './request-detail.component.scss',
})
export class RequestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  readonly request = signal<MaintenanceRequestDto | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  private requestId = '';

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadRequest();
  }

  loadRequest(): void {
    if (!this.requestId) {
      this.error.set('Invalid request ID.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.tenantService.getMaintenanceRequestById(this.requestId).subscribe({
      next: (result) => {
        this.request.set(result);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load maintenance request.');
        this.isLoading.set(false);
        console.error('Error loading request detail:', err);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/tenant']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'InProgress':
        return 'primary';
      case 'Resolved':
        return 'accent';
      case 'Dismissed':
        return 'warn';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'InProgress':
        return 'In Progress';
      default:
        return status;
    }
  }
}
