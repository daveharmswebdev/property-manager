import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorCardComponent } from '../../shared/components/error-card/error-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { MaintenanceRequestStore } from './stores/maintenance-request.store';
import { PropertyStore } from '../properties/stores/property.store';

/**
 * MaintenanceRequestsComponent (Story 20.7).
 *
 * Landlord maintenance request inbox. Shows all requests across the account's
 * properties with status + property filtering and pagination. Frontend-only
 * story — all backend APIs already exist (Stories 20.3 + 20.4).
 *
 * Filter limitation: backend only accepts a single status. When the user
 * selects 2 or 3 statuses, no `status` param is sent (returns the unfiltered
 * set). See store's `encodeStatusParam` for details.
 */
@Component({
  selector: 'app-maintenance-requests',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCardModule,
    MatPaginatorModule,
    LoadingSpinnerComponent,
    ErrorCardComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="maintenance-requests-page" data-testid="maintenance-requests-page">
      <div class="page-header">
        <h1>Maintenance Requests</h1>
      </div>

      <!-- Filter Section (AC #6, #7) -->
      <div class="filter-section">
        <div class="filter-group">
          <label class="filter-label">Status</label>
          <mat-chip-listbox
            multiple
            [value]="store.selectedStatuses()"
            (change)="onStatusFilterChange($event)"
            class="status-chips"
            data-testid="status-filter"
          >
            <mat-chip-option value="Submitted">Submitted</mat-chip-option>
            <mat-chip-option value="InProgress">In Progress</mat-chip-option>
            <mat-chip-option value="Resolved">Resolved</mat-chip-option>
            <mat-chip-option value="Dismissed">Dismissed</mat-chip-option>
          </mat-chip-listbox>
        </div>

        <div class="filter-group">
          <mat-form-field appearance="outline" class="property-filter">
            <mat-label>Property</mat-label>
            <mat-select
              [value]="store.selectedPropertyId()"
              (selectionChange)="onPropertyFilterChange($event.value)"
              data-testid="property-filter"
            >
              <mat-option [value]="null">All Properties</mat-option>
              @for (property of propertyStore.properties(); track property.id) {
                <mat-option [value]="property.id">{{ property.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (store.hasActiveFilters()) {
          <button
            mat-button
            color="primary"
            (click)="clearFilters()"
            class="clear-filters-btn"
            data-testid="clear-filters-btn"
          >
            <mat-icon>clear</mat-icon>
            Clear filters
          </button>
        }
      </div>

      @if (store.isLoading()) {
        <app-loading-spinner />
      } @else if (store.error()) {
        <app-error-card
          [message]="store.error()!"
          [showRetry]="true"
          (retry)="retry()"
        />
      } @else if (store.isFilteredEmpty()) {
        <mat-card class="empty-state filtered-empty" data-testid="filtered-empty-state">
          <mat-card-content>
            <mat-icon class="empty-icon">filter_list_off</mat-icon>
            <h2>No requests match your filters</h2>
            <p>Try adjusting your filters or clear them to see all maintenance requests.</p>
            <button mat-raised-button color="primary" (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear filters
            </button>
          </mat-card-content>
        </mat-card>
      } @else if (store.isEmpty()) {
        <div data-testid="empty-state">
          <app-empty-state
            icon="inbox"
            title="No maintenance requests yet"
            message="When tenants submit maintenance requests for your properties, they will appear here."
          />
        </div>
      } @else {
        <div class="request-list">
          @for (request of store.requests(); track request.id) {
            <div
              class="request-row"
              data-testid="request-row"
              [attr.data-testid-id]="'request-row-' + request.id"
              (click)="openRequest(request.id)"
              (keydown.enter)="openRequest(request.id)"
              tabindex="0"
              role="button"
            >
              <div class="row-content">
                <!-- Line 1: status chip + description (truncated, flex 1) + date -->
                <div class="line-1">
                  <span
                    class="status-chip"
                    [class.status-submitted]="request.status === 'Submitted'"
                    [class.status-in-progress]="request.status === 'InProgress'"
                    [class.status-resolved]="request.status === 'Resolved'"
                    [class.status-dismissed]="request.status === 'Dismissed'"
                  >
                    {{ getStatusLabel(request.status) }}
                  </span>
                  <span class="request-description">{{
                    truncateDescription(request.description)
                  }}</span>
                  <span class="request-date">{{ request.createdAt | date: 'MMM d' }}</span>
                </div>

                <!-- Line 2: property + submitter + work order link badge -->
                <div class="line-2">
                  <span class="request-property">
                    <mat-icon class="inline-icon">home</mat-icon>
                    {{ request.propertyName }}
                  </span>
                  <span class="request-submitter">
                    <mat-icon class="inline-icon">person</mat-icon>
                    {{ request.submittedByUserName || 'Unknown' }}
                  </span>
                  @if (request.workOrderId) {
                    <span class="request-linked">
                      <mat-icon class="inline-icon">link</mat-icon>
                      Linked
                    </span>
                  }
                </div>
              </div>
            </div>
          }

          @if (store.totalCount() > store.pageSize()) {
            <mat-paginator
              [length]="store.totalCount()"
              [pageSize]="store.pageSize()"
              [pageIndex]="store.page() - 1"
              [pageSizeOptions]="[10, 20, 50]"
              (page)="onPageChange($event)"
              data-testid="paginator"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .maintenance-requests-page {
        padding: 24px 16px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 24px;
      }

      .page-header h1 {
        margin: 0;
      }

      .filter-section {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        padding: 16px;
        background-color: var(--mat-sys-surface-container-low);
        border-radius: 8px;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9em;
      }

      .status-chips {
        display: flex;
        gap: 8px;
      }

      .property-filter {
        min-width: 200px;
      }

      .property-filter ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      .clear-filters-btn {
        margin-left: auto;
      }

      .empty-state {
        text-align: center;
        padding: 48px;
      }

      .empty-state mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .empty-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        color: var(--mat-sys-outline);
      }

      .filtered-empty .empty-icon {
        color: var(--mat-sys-primary);
      }

      .request-list {
        display: flex;
        flex-direction: column;
      }

      .request-row {
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        padding: 12px 16px;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .request-row:hover,
      .request-row:focus-visible {
        background-color: var(--mat-sys-surface-container);
        outline: none;
      }

      .row-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .line-1 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 500;
      }

      .line-2 {
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        flex-wrap: wrap;
      }

      .request-description {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .request-date {
        flex-shrink: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
        font-weight: 400;
      }

      .request-property,
      .request-submitter,
      .request-linked {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .inline-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
        vertical-align: middle;
      }

      /* Status chip (AC #5) — match tenant-dashboard color scheme. */
      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .status-submitted {
        background-color: var(--mat-sys-warning-container, #fef3c7);
        color: var(--mat-sys-on-warning-container, #92400e);
      }

      .status-in-progress {
        background-color: var(--mat-sys-primary-container, #dbeafe);
        color: var(--mat-sys-on-primary-container, #1e40af);
      }

      .status-resolved {
        background-color: var(--mat-sys-tertiary-container, #d1fae5);
        color: var(--mat-sys-on-tertiary-container, #065f46);
      }

      .status-dismissed {
        background-color: var(--mat-sys-error-container, #ffe0b2);
        color: var(--mat-sys-on-error-container, #e65100);
      }

      /* Mobile breakpoint @ 768px (AC #13): stack lines. */
      @media (max-width: 768px) {
        .filter-section {
          flex-direction: column;
          align-items: flex-start;
        }

        .clear-filters-btn {
          margin-left: 0;
          margin-top: 8px;
        }

        .request-row {
          padding: 16px;
        }

        .line-1 {
          flex-wrap: wrap;
          gap: 8px;
        }

        .line-1 .request-description {
          width: 100%;
          white-space: normal;
          flex-basis: 100%;
          order: 2;
        }

        .line-1 .status-chip {
          order: 0;
        }

        .line-1 .request-date {
          order: 1;
          margin-left: auto;
        }

        .line-2 {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }
    `,
  ],
})
export class MaintenanceRequestsComponent implements OnInit {
  protected readonly store = inject(MaintenanceRequestStore);
  protected readonly propertyStore = inject(PropertyStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.loadRequests();
    this.propertyStore.loadProperties(undefined);
  }

  onStatusFilterChange(event: MatChipListboxChange): void {
    const selected = (event.value as string[]) ?? [];
    this.store.setStatusFilter(selected);
  }

  onPropertyFilterChange(propertyId: string | null): void {
    this.store.setPropertyFilter(propertyId);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }

  onPageChange(event: PageEvent): void {
    this.store.setPage(event.pageIndex + 1, event.pageSize);
  }

  retry(): void {
    this.store.loadRequests();
  }

  openRequest(id: string): void {
    this.router.navigate(['/maintenance-requests', id]);
  }

  getStatusLabel(status: string): string {
    return status === 'InProgress' ? 'In Progress' : status;
  }

  truncateDescription(description: string, maxLength = 100): string {
    if (description.length <= maxLength) {
      return description;
    }
    return description.substring(0, maxLength) + '...';
  }
}
