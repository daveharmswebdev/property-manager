import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { WorkOrderStore } from './stores/work-order.store';
import { PropertyStore } from '../properties/stores/property.store';

/**
 * WorkOrdersComponent
 *
 * Main work orders list page.
 * Displays all work orders with status filtering.
 */
@Component({
  selector: 'app-work-orders',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="work-orders-page">
      <div class="page-header">
        <h1>Work Orders</h1>
        <a mat-raised-button color="primary" routerLink="/work-orders/new">
          <mat-icon>add</mat-icon>
          New Work Order
        </a>
      </div>

      <!-- Filter Section (Story 9-7, AC #1, #5) -->
      <div class="filter-section">
        <div class="filter-group">
          <label class="filter-label">Status</label>
          <mat-chip-listbox
            multiple
            [value]="store.selectedStatuses()"
            (change)="onStatusFilterChange($event)"
            class="status-chips"
          >
            <mat-chip-option value="Reported">Reported</mat-chip-option>
            <mat-chip-option value="Assigned">Assigned</mat-chip-option>
            <mat-chip-option value="Completed">Completed</mat-chip-option>
          </mat-chip-listbox>
        </div>

        <div class="filter-group">
          <mat-form-field appearance="outline" class="property-filter">
            <mat-label>Property</mat-label>
            <mat-select
              [value]="store.selectedPropertyId()"
              (selectionChange)="onPropertyFilterChange($event.value)"
            >
              <mat-option [value]="null">All Properties</mat-option>
              @for (property of propertyStore.properties(); track property.id) {
                <mat-option [value]="property.id">{{ property.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (store.hasActiveFilters()) {
          <button mat-button color="primary" (click)="clearFilters()" class="clear-filters-btn">
            <mat-icon>clear</mat-icon>
            Clear filters
          </button>
        }
      </div>

      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else if (store.isFilteredEmpty()) {
        <!-- Filtered empty state (AC #7) - no work orders match current filters -->
        <mat-card class="empty-state filtered-empty">
          <mat-card-content>
            <mat-icon class="empty-icon">filter_list_off</mat-icon>
            <h2>No work orders match your filters</h2>
            <p>Try adjusting your filters or clear them to see all work orders.</p>
            <button mat-raised-button color="primary" (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear filters
            </button>
          </mat-card-content>
        </mat-card>
      } @else if (store.isEmpty()) {
        <!-- Truly empty state - no work orders at all -->
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon class="empty-icon">assignment</mat-icon>
            <h2>No work orders yet</h2>
            <p>Create your first work order to track maintenance tasks.</p>
            <a mat-raised-button color="primary" routerLink="/work-orders/new">
              <mat-icon>add</mat-icon>
              Create Work Order
            </a>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="work-orders-list">
          @for (workOrder of store.workOrders(); track workOrder.id) {
            <mat-card class="work-order-card" [routerLink]="['/work-orders', workOrder.id]">
              <div class="card-layout">
                <!-- Thumbnail (if available) -->
                @if (workOrder.primaryPhotoThumbnailUrl) {
                  <div class="card-thumbnail">
                    <img [src]="workOrder.primaryPhotoThumbnailUrl" alt="" loading="lazy" />
                  </div>
                }
                <div class="card-content" [class.has-thumbnail]="workOrder.primaryPhotoThumbnailUrl">
                  <mat-card-header>
                    <mat-card-title>{{ workOrder.propertyName }}</mat-card-title>
                    <mat-card-subtitle>
                      <span class="status-badge" [ngClass]="'status-' + workOrder.status.toLowerCase()">
                        {{ workOrder.status }}
                      </span>
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <p class="description">{{ workOrder.description }}</p>
                    <p class="assignee">
                      <mat-icon class="assignee-icon">{{ workOrder.isDiy ? 'person' : 'engineering' }}</mat-icon>
                      {{ workOrder.isDiy ? 'Self (DIY)' : (workOrder.vendorName || 'Unknown Vendor') }}
                    </p>
                    @if (workOrder.categoryName) {
                      <p class="category">Category: {{ workOrder.categoryName }}</p>
                    }
                    @if (workOrder.tags && workOrder.tags.length > 0) {
                      <mat-chip-set class="work-order-tags">
                        @for (tag of workOrder.tags; track tag.id) {
                          <mat-chip>{{ tag.name }}</mat-chip>
                        }
                      </mat-chip-set>
                    }
                    <span class="created-date">
                      <mat-icon class="date-icon">calendar_today</mat-icon>
                      {{ workOrder.createdAt | date:'mediumDate' }}
                    </span>
                  </mat-card-content>
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .work-orders-page {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
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

      .property-filter .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      .clear-filters-btn {
        margin-left: auto;
      }

      @media (max-width: 768px) {
        .filter-section {
          flex-direction: column;
          align-items: flex-start;
        }

        .clear-filters-btn {
          margin-left: 0;
          margin-top: 8px;
        }
      }

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 48px;
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

      .work-orders-list {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }

      .work-order-card {
        cursor: pointer;
        transition: box-shadow 0.2s;
        padding: 0;
        overflow: hidden;
      }

      .work-order-card:hover {
        box-shadow: var(--mat-sys-level3);
      }

      .card-layout {
        display: flex;
      }

      .card-thumbnail {
        flex: 0 0 80px;
        min-height: 100%;
        overflow: hidden;
        background-color: var(--mat-sys-surface-variant);
      }

      .card-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        min-height: 120px;
      }

      .card-content {
        flex: 1;
        padding: 16px;
        min-width: 0; /* Allow text truncation */
      }

      .card-content.has-thumbnail {
        padding-left: 12px;
      }

      .description {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .category {
        color: var(--mat-sys-outline);
        font-size: 0.9em;
      }

      .assignee {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9em;
        margin: 8px 0;
      }

      .assignee-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
      }

      .work-order-tags {
        margin-top: 8px;
      }

      .work-order-tags mat-chip {
        font-size: 0.8em;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
      }

      .status-reported {
        background-color: var(--mat-sys-warning-container, #fef3c7);
        color: var(--mat-sys-on-warning-container, #92400e);
      }

      .status-assigned {
        background-color: var(--mat-sys-primary-container, #dbeafe);
        color: var(--mat-sys-on-primary-container, #1e40af);
      }

      .status-completed {
        background-color: var(--mat-sys-tertiary-container, #d1fae5);
        color: var(--mat-sys-on-tertiary-container, #065f46);
      }

      .created-date {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85em;
        color: var(--mat-sys-outline);
        margin-top: 8px;
      }

      .date-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
      }
    `,
  ],
})
export class WorkOrdersComponent implements OnInit {
  protected readonly store = inject(WorkOrderStore);
  protected readonly propertyStore = inject(PropertyStore);

  ngOnInit(): void {
    this.store.loadWorkOrders();
    // Load properties for filter dropdown (rxMethod requires argument, undefined = no page limit)
    this.propertyStore.loadProperties(undefined);
  }

  /**
   * Handle status filter chip selection change (AC #2)
   */
  onStatusFilterChange(event: MatChipListboxChange): void {
    const selectedStatuses = (event.value as string[]) ?? [];
    this.store.setStatusFilter(selectedStatuses);
  }

  /**
   * Handle property filter dropdown change (AC #3)
   */
  onPropertyFilterChange(propertyId: string | null): void {
    this.store.setPropertyFilter(propertyId);
  }

  /**
   * Clear all filters (AC #6)
   */
  clearFilters(): void {
    this.store.clearFilters();
  }
}
