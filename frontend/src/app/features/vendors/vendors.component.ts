import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { VendorStore } from './stores/vendor.store';
import { VendorDto } from '../../core/api/api.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PhoneFormatPipe } from '../../shared/pipes/phone-format.pipe';

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    PhoneFormatPipe,
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

      <!-- Filter Bar (Story 8-6 AC #1-#3) -->
      @if (store.hasVendors() || store.hasActiveFilters()) {
        <div class="filter-bar">
          <!-- Search Input (AC #1) -->
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search vendors</mat-label>
            <input
              matInput
              [value]="store.searchTerm()"
              (input)="onSearchChange($event)"
              placeholder="Search by name..."
            />
            <mat-icon matPrefix>search</mat-icon>
            @if (store.searchTerm()) {
              <button matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>

          <!-- Trade Tag Filter (AC #2) -->
          <mat-form-field appearance="outline" class="tag-filter-field">
            <mat-label>Filter by trade</mat-label>
            <mat-select
              multiple
              [value]="store.selectedTradeTagIds()"
              (selectionChange)="onTagFilterChange($event)"
            >
              @for (tag of store.tradeTags(); track tag.id) {
                <mat-option [value]="tag.id">{{ tag.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Clear Filters (AC #3) -->
          @if (store.hasActiveFilters()) {
            <button mat-button color="primary" (click)="store.clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear filters
            </button>
          }
        </div>
      }

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

      <!-- Empty State (AC #2) - No vendors at all -->
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

      <!-- No Matches State (Story 8-6 AC #4) - Has vendors but filter returns empty -->
      @if (store.noMatchesFound()) {
        <mat-card class="no-matches-card">
          <mat-icon class="no-matches-icon">search_off</mat-icon>
          <h2>No vendors match your search</h2>
          <p>Try adjusting your filters</p>
          <button
            mat-stroked-button
            color="primary"
            (click)="store.clearFilters()"
          >
            Clear filters
          </button>
        </mat-card>
      }

      <!-- Vendor List (AC #1, #3, #4) - Use filteredVendors for search/filter -->
      @if (store.hasVendors() && !store.noMatchesFound()) {
        <div class="vendor-list">
          @for (vendor of store.filteredVendors(); track vendor.id) {
            <mat-card class="vendor-card" [routerLink]="['/vendors', vendor.id]">
              <mat-card-content>
                <div class="vendor-row">
                  <mat-icon class="vendor-icon">person</mat-icon>
                  <div class="vendor-info">
                    <span class="vendor-name">{{ vendor.fullName }}</span>
                    <div class="vendor-details">
                      @if (vendor.phones && vendor.phones.length > 0) {
                        <span class="vendor-phone">
                          <mat-icon class="detail-icon">phone</mat-icon>
                          {{ vendor.phones![0].number | phoneFormat }}
                        </span>
                      }
                      @if (vendor.emails && vendor.emails.length > 0) {
                        <span class="vendor-email">
                          <mat-icon class="detail-icon">email</mat-icon>
                          {{ vendor.emails![0] }}
                        </span>
                      }
                    </div>
                    @if (vendor.tradeTags && vendor.tradeTags.length > 0) {
                      <div class="trade-tags">
                        @for (tag of vendor.tradeTags!; track tag.id) {
                          <span class="trade-tag-chip">{{ tag.name }}</span>
                        }
                      </div>
                    }
                  </div>
                  <button
                    mat-icon-button
                    color="warn"
                    class="delete-button"
                    (click)="onDeleteClick(vendor, $event)"
                    [disabled]="store.deletingVendorId() === vendor.id"
                    aria-label="Delete vendor"
                    matTooltip="Delete vendor"
                  >
                    @if (store.deletingVendorId() === vendor.id) {
                      <mat-spinner diameter="20"></mat-spinner>
                    } @else {
                      <mat-icon>delete</mat-icon>
                    }
                  </button>
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
        min-width: 0;
      }

      .vendor-name {
        font-weight: 500;
        display: block;
      }

      .vendor-details {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 4px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }

      .vendor-phone,
      .vendor-email {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .detail-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: rgba(0, 0, 0, 0.4);
      }

      .trade-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .trade-tag-chip {
        display: inline-block;
        background-color: #e8f5e9;
        color: #2e7d32;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .edit-icon {
        color: rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
      }

      .delete-button {
        flex-shrink: 0;
        opacity: 0.6;
        transition: opacity 0.2s;
      }

      .delete-button:hover {
        opacity: 1;
      }

      .vendor-card:hover .delete-button {
        opacity: 0.8;
      }

      /* Filter Bar (Story 8-6) */
      .filter-bar {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: flex-start;
      }

      .search-field {
        flex: 1;
        min-width: 200px;
      }

      .tag-filter-field {
        min-width: 180px;
      }

      /* No Matches State (Story 8-6 AC #4) */
      .no-matches-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        text-align: center;
      }

      .no-matches-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: rgba(0, 0, 0, 0.3);
        margin-bottom: 16px;
      }

      .no-matches-card h2 {
        margin: 0 0 8px;
        font-weight: 500;
      }

      .no-matches-card p {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 24px;
      }

      /* Responsive adjustments */
      @media (max-width: 600px) {
        .vendors-container {
          padding: 16px;
        }

        .page-header {
          flex-direction: column;
          gap: 16px;
        }

        .add-button {
          width: 100%;
        }

        .vendor-details {
          flex-direction: column;
          gap: 4px;
        }

        /* Filter bar responsive (Story 8-6) */
        .filter-bar {
          flex-direction: column;
        }

        .search-field,
        .tag-filter-field {
          width: 100%;
          min-width: unset;
        }
      }
    `,
  ],
})
export class VendorsComponent implements OnInit {
  protected readonly store = inject(VendorStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  /** Subject for debounced search input (Story 8-6 AC #1) */
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.store.loadVendors();
    this.store.loadTradeTags();

    // Debounced search - 300ms delay (Story 8-6 AC #1)
    // Uses takeUntilDestroyed for automatic cleanup on component destruction
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        this.store.setSearchTerm(term);
      });
  }

  /**
   * Handle search input change - pushes to debounced subject (Story 8-6 AC #1)
   */
  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  /**
   * Clear search input (Story 8-6 AC #1)
   */
  clearSearch(): void {
    this.searchSubject.next('');
    this.store.setSearchTerm('');
  }

  /**
   * Handle trade tag filter selection change (Story 8-6 AC #2)
   */
  onTagFilterChange(event: { value: string[] }): void {
    this.store.setTradeTagFilter(event.value);
  }

  /**
   * Handle delete button click - opens confirmation dialog (Story 8-8 AC #1-#4)
   * @param vendor The vendor to potentially delete
   * @param event The click event to prevent row navigation
   */
  onDeleteClick(vendor: VendorDto, event: Event): void {
    event.stopPropagation(); // Prevent row click navigation

    const dialogData: ConfirmDialogData = {
      title: `Delete ${vendor.fullName}?`,
      message:
        "This vendor will be removed from your list. Work orders assigned to this vendor will show 'Deleted Vendor'.",
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '450px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed && vendor.id) {
        this.store.deleteVendor(vendor.id);
      }
    });
  }
}
