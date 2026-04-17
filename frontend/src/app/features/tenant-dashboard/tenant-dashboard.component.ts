import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DatePipe } from '@angular/common';

import { TenantDashboardStore } from './stores/tenant-dashboard.store';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorCardComponent } from '../../shared/components/error-card/error-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/**
 * Tenant Dashboard Component (Story 20.5, AC #2, #3, #4, #8)
 *
 * Displays tenant's property info and maintenance request list.
 * Mobile-first layout with max-width 800px on desktop.
 */
@Component({
  selector: 'app-tenant-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatListModule,
    MatButtonModule,
    MatPaginatorModule,
    DatePipe,
    LoadingSpinnerComponent,
    ErrorCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './tenant-dashboard.component.html',
  styleUrl: './tenant-dashboard.component.scss',
})
export class TenantDashboardComponent implements OnInit {
  readonly store = inject(TenantDashboardStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.loadProperty();
    this.store.loadRequests();
  }

  onPageChange(event: PageEvent): void {
    this.store.loadRequests({ page: event.pageIndex + 1, pageSize: event.pageSize });
  }

  viewRequest(id: string): void {
    this.router.navigate(['/tenant/requests', id]);
  }

  submitRequest(): void {
    this.router.navigate(['/tenant/submit-request']);
  }

  retry(): void {
    this.store.loadProperty();
    this.store.loadRequests();
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

  truncateDescription(description: string, maxLength = 100): string {
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  }
}
