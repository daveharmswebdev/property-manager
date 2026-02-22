import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { WorkOrderStore } from './stores/work-order.store';
import { PropertyStore } from '../properties/stores/property.store';
import {
  ConfirmDialogComponent,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { WorkOrderDto } from './services/work-order.service';

/**
 * WorkOrdersComponent
 *
 * Main work orders list page.
 * Displays all work orders as enriched two-line rows with status filtering.
 * Story 16-8: Refactored from card grid to row-based list.
 */
@Component({
  selector: 'app-work-orders',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCardModule,
    ConfirmDialogComponent,
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
            <div class="work-order-row" [class.expanded]="isExpanded(workOrder.id)">
              <!-- Expand chevron -->
              <button class="expand-btn" mat-icon-button
                (click)="toggleExpand(workOrder.id, $event)"
                aria-label="Toggle details">
                <mat-icon>{{ isExpanded(workOrder.id) ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>

              <!-- Row content (clickable → navigates to detail) -->
              <div class="row-content" [routerLink]="['/work-orders', workOrder.id]">
                <!-- Line 1: Scan line -->
                <div class="line-1">
                  <span class="status-chip" [class]="'status-' + workOrder.status.toLowerCase()">
                    {{ workOrder.status }}
                  </span>
                  <span class="wo-title">{{ workOrder.description }}</span>
                  <span class="wo-assignee">
                    <mat-icon class="inline-icon">{{ workOrder.isDiy ? 'person' : 'engineering' }}</mat-icon>
                    {{ workOrder.isDiy ? 'DIY' : (workOrder.vendorName || 'Unassigned') }}
                  </span>
                  @if (workOrder.categoryName) {
                    <span class="wo-category">{{ workOrder.categoryName }}</span>
                  }
                  <span class="wo-date">{{ workOrder.createdAt | date:'MMM d' }}</span>
                </div>

                <!-- Line 2: Context line -->
                <div class="line-2">
                  <span class="wo-property">
                    <mat-icon class="inline-icon">home</mat-icon>
                    {{ workOrder.propertyName }}
                  </span>
                  @if (!workOrder.isDiy && workOrder.vendorName) {
                    <span class="wo-vendor">{{ workOrder.vendorName }}</span>
                  }
                  @if (workOrder.tags && workOrder.tags.length > 0) {
                    <span class="wo-tags">
                      @for (tag of workOrder.tags; track tag.id) {
                        <mat-chip>{{ tag.name }}</mat-chip>
                      }
                    </span>
                  }
                </div>
              </div>

              <!-- Action icons (stop propagation to prevent navigation) -->
              <div class="row-actions">
                <a mat-icon-button [routerLink]="['/work-orders', workOrder.id, 'edit']"
                  (click)="$event.stopPropagation()" aria-label="Edit work order">
                  <mat-icon>edit</mat-icon>
                </a>
                <button mat-icon-button (click)="confirmDelete(workOrder, $event)"
                  aria-label="Delete work order">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <!-- Expand panel (AC5) -->
            @if (isExpanded(workOrder.id)) {
              <div class="expand-panel">
                <div class="expand-content">
                  <p class="full-description">{{ workOrder.description }}</p>
                  @if (workOrder.primaryPhotoThumbnailUrl) {
                    <img [src]="workOrder.primaryPhotoThumbnailUrl" alt="Work order photo"
                      class="expand-thumbnail" loading="lazy" />
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .work-orders-page {
        padding: 24px 16px;
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

      /* Enriched Row List (Story 16-8) */
      .work-orders-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .work-order-row {
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        padding: 12px 16px;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .work-order-row:hover {
        background-color: var(--mat-sys-surface-container);
      }

      /* Alternating row backgrounds (AC4) */
      .work-order-row:nth-child(odd) {
        background-color: var(--mat-sys-surface);
      }

      .work-order-row:nth-child(even) {
        background-color: var(--mat-sys-surface-container-low);
      }

      .row-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
      }

      .line-1,
      .line-2 {
        display: flex;
        align-items: center;
        gap: 0;
      }

      .line-1 {
        font-weight: 500;
      }

      .line-2 {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        gap: 12px;
        padding-left: 4px;
      }

      .wo-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        padding: 0 16px;
      }

      .wo-assignee {
        min-width: 140px;
        padding: 0 12px;
        border-left: 1px solid var(--mat-sys-outline-variant);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .wo-category {
        min-width: 90px;
        padding: 0 12px;
        border-left: 1px solid var(--mat-sys-outline-variant);
        flex-shrink: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .wo-date {
        min-width: 56px;
        padding: 0 4px 0 12px;
        border-left: 1px solid var(--mat-sys-outline-variant);
        flex-shrink: 0;
        text-align: right;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
        font-weight: 400;
      }

      .inline-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
        vertical-align: middle;
      }

      /* Status chip (AC3) */
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

      /* Row actions */
      .row-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .work-order-row:hover .row-actions {
        opacity: 1;
      }

      /* Expand button */
      .expand-btn {
        flex-shrink: 0;
        margin-right: 8px;
      }

      /* Expand panel (AC5) */
      .expand-panel {
        padding: 16px 16px 16px 56px;
        background-color: var(--mat-sys-surface-container-lowest);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .expand-content {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .full-description {
        flex: 1;
        white-space: pre-wrap;
        line-height: 1.5;
        margin: 0;
      }

      .expand-thumbnail {
        max-width: 120px;
        max-height: 120px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid var(--mat-sys-outline-variant);
      }

      /* Medium breakpoint — drop category (AC6) */
      @media (max-width: 1200px) {
        .wo-category {
          display: none;
        }
      }

      /* Mobile breakpoint — stack into card layout (AC6) */
      @media (max-width: 768px) {
        .work-order-row {
          flex-direction: column;
          align-items: flex-start;
          padding: 16px;
          gap: 8px;
        }

        .row-content {
          width: 100%;
        }

        .line-1 {
          flex-wrap: wrap;
          width: 100%;
        }

        .line-1 .status-chip {
          order: 0;
        }

        .line-1 .wo-date {
          order: 0;
          margin-left: auto;
          border-left: none;
          padding: 0;
          min-width: unset;
        }

        .line-1 .wo-title {
          width: 100%;
          white-space: normal;
          order: 1;
          flex-basis: 100%;
          padding: 4px 0 0;
        }

        .line-1 .wo-assignee {
          order: 2;
          flex-basis: 100%;
          border-left: none;
          padding: 0;
          min-width: unset;
        }

        .line-1 .wo-category {
          display: none;
        }

        .line-2 {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding-left: 0;
        }

        .row-actions {
          opacity: 1;
          align-self: flex-end;
        }

        .expand-btn {
          display: none;
        }

        .expand-panel {
          display: none;
        }
      }
    `,
  ],
})
export class WorkOrdersComponent implements OnInit {
  protected readonly store = inject(WorkOrderStore);
  protected readonly propertyStore = inject(PropertyStore);
  private readonly dialog = inject(MatDialog);

  private expandedIds = new Set<string>();

  ngOnInit(): void {
    this.store.loadWorkOrders();
    this.propertyStore.loadProperties(undefined);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  confirmDelete(workOrder: WorkOrderDto, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete "${workOrder.description}"?`,
        message: 'This work order will be permanently removed.',
        confirmText: 'Delete',
      },
    });
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.deleteWorkOrder(workOrder.id);
      }
    });
  }

  onStatusFilterChange(event: MatChipListboxChange): void {
    const selectedStatuses = (event.value as string[]) ?? [];
    this.store.setStatusFilter(selectedStatuses);
  }

  onPropertyFilterChange(propertyId: string | null): void {
    this.store.setPropertyFilter(propertyId);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }
}
