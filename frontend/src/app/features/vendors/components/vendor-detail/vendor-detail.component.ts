import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { VendorStore } from '../../stores/vendor.store';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Vendor Detail Component (AC #1-#8)
 *
 * Read-only view of vendor details including:
 * - Vendor name as page title with back button (AC #2)
 * - Contact information: phones with labels, emails (AC #3)
 * - Trade tags displayed as chips (AC #4)
 * - Work Order History placeholder section (AC #5)
 * - Edit and Delete action buttons (AC #6, #7)
 * - 404 handling with redirect (AC #8)
 */
@Component({
  selector: 'app-vendor-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
  ],
  template: `
    <div class="vendor-detail-container">
      <!-- Loading State -->
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading vendor...</p>
        </div>
      }

      <!-- Vendor Detail Content (AC #2-#5) -->
      @if (!store.isLoading() && store.selectedVendor()) {
        <!-- Header with Vendor Name (AC #2) -->
        <header class="vendor-header">
          <div class="header-content">
            <button
              mat-icon-button
              (click)="goBack()"
              aria-label="Go back"
              class="back-button"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="title-section">
              <h1>{{ store.selectedVendor()!.fullName }}</h1>
            </div>
          </div>
          <!-- Action Buttons (AC #6, #7) -->
          <div class="action-buttons">
            <button
              mat-stroked-button
              color="primary"
              [routerLink]="['/vendors', vendorId, 'edit']"
            >
              <mat-icon>edit</mat-icon>
              Edit
            </button>
            <button
              mat-stroked-button
              color="warn"
              (click)="onDeleteClick()"
              [disabled]="store.isDeleting()"
            >
              @if (store.isDeleting()) {
                <mat-spinner diameter="18" class="button-spinner"></mat-spinner>
              } @else {
                <mat-icon>delete</mat-icon>
              }
              Delete
            </button>
          </div>
        </header>

        <!-- Contact Information Section (AC #3) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Contact Information</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <!-- Phone Numbers -->
            @if (store.selectedVendor()!.phones && store.selectedVendor()!.phones!.length > 0) {
              <div class="contact-section">
                <h3>Phone Numbers</h3>
                <div class="contact-list">
                  @for (phone of store.selectedVendor()!.phones; track phone.number) {
                    <div class="contact-item">
                      <mat-icon class="contact-icon">phone</mat-icon>
                      <span class="contact-value">
                        @if (phone.label) {
                          <span class="contact-label">{{ phone.label }}:</span>
                        }
                        {{ phone.number }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="contact-section empty">
                <h3>Phone Numbers</h3>
                <p class="empty-text">No phone numbers added</p>
              </div>
            }

            <!-- Email Addresses -->
            @if (store.selectedVendor()!.emails && store.selectedVendor()!.emails!.length > 0) {
              <div class="contact-section">
                <h3>Email Addresses</h3>
                <div class="contact-list">
                  @for (email of store.selectedVendor()!.emails; track email) {
                    <div class="contact-item">
                      <mat-icon class="contact-icon">email</mat-icon>
                      <span class="contact-value">{{ email }}</span>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="contact-section empty">
                <h3>Email Addresses</h3>
                <p class="empty-text">No email addresses added</p>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Trade Tags Section (AC #4) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Trade Tags</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (store.selectedVendor()!.tradeTags && store.selectedVendor()!.tradeTags!.length > 0) {
              <div class="trade-tags">
                @for (tag of store.selectedVendor()!.tradeTags; track tag.id) {
                  <span class="trade-tag-chip">{{ tag.name }}</span>
                }
              </div>
            } @else {
              <p class="empty-text">No trade tags assigned</p>
            }
          </mat-card-content>
        </mat-card>

        <!-- Work Order History Section - Placeholder (AC #5) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Work Order History</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="empty-state">
              <mat-icon class="empty-icon">assignment</mat-icon>
              <p>No work orders yet for this vendor</p>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .vendor-detail-container {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
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

      .vendor-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .back-button {
        margin-top: 4px;
      }

      .title-section h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 500;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .action-buttons button mat-icon {
        margin-right: 4px;
      }

      .action-buttons button mat-spinner {
        display: inline-block;
        margin-right: 4px;
      }

      .section-card {
        margin-bottom: 16px;
      }

      mat-card-header {
        margin-bottom: 16px;
      }

      mat-card-title {
        font-size: 18px !important;
        font-weight: 500;
      }

      .contact-section {
        margin-bottom: 16px;
      }

      .contact-section:last-child {
        margin-bottom: 0;
      }

      .contact-section h3 {
        font-size: 14px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 8px 0;
      }

      .contact-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .contact-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .contact-icon {
        color: rgba(0, 0, 0, 0.5);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .contact-value {
        font-size: 15px;
      }

      .contact-label {
        color: rgba(0, 0, 0, 0.6);
        font-weight: 500;
      }

      .trade-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .trade-tag-chip {
        display: inline-block;
        background-color: #e8f5e9;
        color: #2e7d32;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 500;
      }

      .empty-text {
        color: rgba(0, 0, 0, 0.5);
        font-style: italic;
        margin: 0;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 16px;
        text-align: center;
        color: rgba(0, 0, 0, 0.5);
      }

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0;
        font-size: 14px;
      }

      /* Responsive */
      @media (max-width: 600px) {
        .vendor-detail-container {
          padding: 16px;
        }

        .vendor-header {
          flex-direction: column;
        }

        .title-section h1 {
          font-size: 24px;
        }

        .action-buttons {
          width: 100%;
        }

        .action-buttons button {
          flex: 1;
        }
      }
    `,
  ],
})
export class VendorDetailComponent implements OnInit, OnDestroy {
  protected readonly store = inject(VendorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected vendorId: string | null = null;

  ngOnInit(): void {
    this.vendorId = this.route.snapshot.paramMap.get('id');
    if (this.vendorId) {
      this.store.loadVendor(this.vendorId);
    }
  }

  ngOnDestroy(): void {
    this.store.clearSelectedVendor();
  }

  /**
   * Navigate back to vendor list
   */
  goBack(): void {
    this.router.navigate(['/vendors']);
  }

  /**
   * Handle delete button click - opens confirmation dialog (AC #7)
   * On confirm: deletes vendor and navigates to /vendors
   */
  onDeleteClick(): void {
    const vendor = this.store.selectedVendor();
    if (!vendor) return;

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
        // Navigate to vendor list after delete (AC #7)
        this.router.navigate(['/vendors']);
      }
    });
  }
}
