import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WorkOrderService,
  WorkOrderDto,
} from '../../../work-orders/services/work-order.service';

/**
 * PropertyWorkOrdersComponent (Story 9-11 AC #1, #2, #4, #6, #7)
 *
 * Displays work orders for a specific property on the property detail page.
 * Features:
 * - List of recent work orders with status badge, description, assignee, date
 * - Empty state with "New Work Order" button
 * - Loading state with spinner
 * - Error state with retry button
 * - "View all" link when more than 5 work orders exist
 */
@Component({
  selector: 'app-property-work-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
    SlicePipe,
  ],
  template: `
    <mat-card class="activity-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>engineering</mat-icon>
          Work Orders
          @if (!isLoading() && !error()) {
            ({{ totalCount() }})
          }
        </mat-card-title>
        <button
          mat-stroked-button
          color="primary"
          (click)="createClick.emit()"
          class="new-work-order-btn">
          <mat-icon>add</mat-icon>
          New Work Order
        </button>
      </mat-card-header>
      <mat-card-content>
        <!-- Loading State (AC #6) -->
        @if (isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        }

        <!-- Error State (AC #7) -->
        @if (!isLoading() && error()) {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <button mat-stroked-button (click)="retry()">
              <mat-icon>refresh</mat-icon>
              Retry
            </button>
          </div>
        }

        <!-- Empty State (AC #2) -->
        @if (!isLoading() && !error() && workOrders().length === 0) {
          <div class="empty-state">
            <mat-icon>engineering</mat-icon>
            <p>No work orders for this property</p>
          </div>
        }

        <!-- Work Orders List (AC #1, #4) -->
        @if (!isLoading() && !error() && workOrders().length > 0) {
          <div class="work-order-list">
            @for (wo of workOrders(); track wo.id) {
              <a class="work-order-item" [routerLink]="['/work-orders', wo.id]">
                <span class="status-badge" [class]="wo.status.toLowerCase()">
                  {{ wo.status }}
                </span>
                <span class="description">
                  {{ wo.description.length > 50 ? (wo.description | slice:0:50) + '...' : wo.description }}
                </span>
                <span class="assignee">{{ wo.vendorName || 'DIY' }}</span>
                <span class="date">{{ wo.createdAt | date:'shortDate' }}</span>
              </a>
            }
          </div>

          <!-- View All Link (AC #5) -->
          @if (totalCount() > displayLimit) {
            <div class="view-all">
              <a mat-button color="primary" (click)="viewAllClick.emit()">
                View all {{ totalCount() }} work orders
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .activity-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;

          mat-icon {
            color: var(--pm-primary);
          }
        }

        .new-work-order-btn mat-icon {
          margin-right: 4px;
        }
      }
    }

    .loading-state {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .error-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--pm-text-secondary);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--pm-error, #c62828);
        margin-bottom: 12px;
      }

      p {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: var(--pm-error, #c62828);
      }

      button mat-icon {
        margin-right: 4px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--pm-text-secondary);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .work-order-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .work-order-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      gap: 12px;
      transition: background-color 0.2s;

      &:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }

      .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        white-space: nowrap;

        &.reported {
          background: #fff3e0;
          color: #e65100;
        }

        &.assigned {
          background: #e3f2fd;
          color: #1565c0;
        }

        &.completed {
          background: #e8f5e9;
          color: #2e7d32;
        }
      }

      .description {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--pm-text-primary);
      }

      .assignee {
        color: var(--pm-text-secondary);
        font-size: 13px;
        white-space: nowrap;
      }

      .date {
        color: var(--pm-text-secondary);
        font-size: 13px;
        white-space: nowrap;
      }
    }

    .view-all {
      margin-top: 12px;
      text-align: center;
      border-top: 1px solid var(--pm-border, #e0e0e0);
      padding-top: 12px;

      a {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    @media (max-width: 599px) {
      .work-order-item {
        flex-wrap: wrap;
        gap: 8px;

        .status-badge {
          order: 1;
        }

        .date {
          order: 2;
          margin-left: auto;
        }

        .description {
          order: 3;
          flex-basis: 100%;
        }

        .assignee {
          order: 4;
          flex-basis: 100%;
        }
      }
    }
  `],
})
export class PropertyWorkOrdersComponent implements OnInit {
  /**
   * Property ID to load work orders for (required)
   */
  readonly propertyId = input.required<string>();

  /**
   * Emitted when user clicks "New Work Order" button
   */
  readonly createClick = output<void>();

  /**
   * Emitted when user clicks "View all" link
   */
  readonly viewAllClick = output<void>();

  private readonly workOrderService = inject(WorkOrderService);

  /** Maximum number of work orders to display */
  readonly displayLimit = 5;

  /** Loading state */
  readonly isLoading = signal(false);

  /** Error message */
  readonly error = signal<string | null>(null);

  /** Work orders list (limited to displayLimit) */
  readonly workOrders = signal<WorkOrderDto[]>([]);

  /** Total count of work orders for this property */
  readonly totalCount = signal(0);

  ngOnInit(): void {
    this.loadWorkOrders();
  }

  /**
   * Load work orders for the property
   */
  loadWorkOrders(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.workOrderService.getWorkOrdersByProperty(this.propertyId(), this.displayLimit).subscribe({
      next: (response) => {
        this.workOrders.set(response.items);
        this.totalCount.set(response.totalCount);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load work orders');
        this.isLoading.set(false);
        console.error('Error loading property work orders:', err);
      },
    });
  }

  /**
   * Retry loading work orders after error
   */
  retry(): void {
    this.loadWorkOrders();
  }
}
