import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VendorStore } from './stores/vendor.store';

/**
 * Vendors Component (AC #1, #2, #4)
 *
 * Main vendor list page displaying all vendors for the current account.
 * Shows empty state when no vendors exist.
 */
@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="vendors-container">
      <!-- Page Header (AC #1) -->
      <div class="page-header">
        <div class="header-content">
          <h1>Vendors</h1>
          <p class="subtitle">Manage your vendor list</p>
        </div>
        <button
          mat-raised-button
          color="primary"
          routerLink="/vendors/new"
          class="add-button"
        >
          <mat-icon>add</mat-icon>
          Add Vendor
        </button>
      </div>

      <!-- Loading State -->
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading vendors...</p>
        </div>
      }

      <!-- Error State -->
      @if (store.error()) {
        <mat-card class="error-card">
          <mat-icon color="warn">error_outline</mat-icon>
          <p>{{ store.error() }}</p>
          <button mat-button color="primary" (click)="store.loadVendors()">
            Try Again
          </button>
        </mat-card>
      }

      <!-- Empty State (AC #2) -->
      @if (store.isEmpty()) {
        <mat-card class="empty-state-card">
          <mat-icon class="empty-icon">person_off</mat-icon>
          <h2>No vendors yet</h2>
          <p>Add your first vendor to get started.</p>
          <button mat-raised-button color="primary" routerLink="/vendors/new">
            <mat-icon>add</mat-icon>
            Add Vendor
          </button>
        </mat-card>
      }

      <!-- Vendor List (AC #4) -->
      @if (store.hasVendors()) {
        <div class="vendor-list">
          @for (vendor of store.vendors(); track vendor.id) {
            <mat-card class="vendor-card" [routerLink]="['/vendors', vendor.id]">
              <mat-card-content>
                <div class="vendor-row">
                  <mat-icon class="vendor-icon">person</mat-icon>
                  <div class="vendor-info">
                    <span class="vendor-name">{{ vendor.fullName }}</span>
                  </div>
                  <mat-icon class="edit-icon">chevron_right</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .vendors-container {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
      }

      .header-content h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 500;
      }

      .header-content .subtitle {
        margin: 4px 0 0;
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
      }

      .add-button mat-icon {
        margin-right: 8px;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        gap: 16px;
      }

      .loading-container p {
        color: rgba(0, 0, 0, 0.6);
      }

      .error-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px;
        text-align: center;
        gap: 16px;
      }

      .error-card mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      .empty-state-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        text-align: center;
      }

      .empty-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: rgba(0, 0, 0, 0.3);
        margin-bottom: 16px;
      }

      .empty-state-card h2 {
        margin: 0 0 8px;
        font-weight: 500;
      }

      .empty-state-card p {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 24px;
      }

      .vendor-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .vendor-card {
        cursor: pointer;
        transition: box-shadow 0.2s;
      }

      .vendor-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
      }

      .vendor-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .vendor-icon {
        color: rgba(0, 0, 0, 0.5);
      }

      .vendor-info {
        flex: 1;
      }

      .vendor-name {
        font-weight: 500;
      }

      .edit-icon {
        color: rgba(0, 0, 0, 0.3);
      }
    `,
  ],
})
export class VendorsComponent implements OnInit {
  protected readonly store = inject(VendorStore);

  ngOnInit(): void {
    this.store.loadVendors();
  }
}
