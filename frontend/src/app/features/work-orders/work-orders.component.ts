import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { WorkOrderStore } from './stores/work-order.store';

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
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
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

      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else if (store.isEmpty()) {
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
              <mat-card-header>
                <mat-card-title>{{ workOrder.propertyName }}</mat-card-title>
                <mat-card-subtitle>{{ workOrder.status }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <p class="description">{{ workOrder.description }}</p>
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
              </mat-card-content>
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

      .work-orders-list {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }

      .work-order-card {
        cursor: pointer;
        transition: box-shadow 0.2s;
      }

      .work-order-card:hover {
        box-shadow: var(--mat-sys-level3);
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

      .work-order-tags {
        margin-top: 8px;
      }

      .work-order-tags mat-chip {
        font-size: 0.8em;
      }
    `,
  ],
})
export class WorkOrdersComponent implements OnInit {
  protected readonly store = inject(WorkOrderStore);

  ngOnInit(): void {
    this.store.loadWorkOrders();
  }
}
