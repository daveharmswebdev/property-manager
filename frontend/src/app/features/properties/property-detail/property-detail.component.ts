import { Component, inject, OnInit, OnDestroy, effect, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject, takeUntil } from 'rxjs';
import { PropertyStore } from '../stores/property.store';
import { PropertyPhotoStore } from '../stores/property-photo.store';
import { YearSelectorService } from '../../../core/services/year-selector.service';
import { PropertyPhotoGalleryComponent, PropertyPhoto } from '../components/property-photo-gallery/property-photo-gallery.component';
import { PropertyPhotoUploadComponent } from '../components/property-photo-upload/property-photo-upload.component';
import { PropertyWorkOrdersComponent } from '../components/property-work-orders/property-work-orders.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  ReportDialogComponent,
  ReportDialogData,
} from '../../reports/components/report-dialog/report-dialog.component';
import {
  PropertyPhotoLightboxComponent,
  PropertyPhotoLightboxData,
} from '../../../shared/components/property-photo-lightbox/property-photo-lightbox.component';

/**
 * Property Detail Component (AC-2.3.1, AC-2.3.2, AC-2.3.3, AC-2.3.4, AC-2.3.6)
 *
 * Displays:
 * - Property name as page title
 * - Full address (street, city, state, ZIP)
 * - YTD stats (expenses, income, net)
 * - Recent Expenses section with empty state
 * - Recent Income section with empty state
 * - Action buttons (Add Expense, Add Income, Edit, Delete)
 */
@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule,
    CurrencyPipe,
    DatePipe,
    PropertyPhotoGalleryComponent,
    PropertyPhotoUploadComponent,
    PropertyWorkOrdersComponent,
  ],
  template: `
    <div class="property-detail-container">
      <!-- Loading State -->
      @if (propertyStore.isLoadingDetail()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      <!-- Error State / 404 (AC-2.3.6) -->
      @if (propertyStore.detailError()) {
        <mat-card class="error-card">
          <mat-icon>error_outline</mat-icon>
          <h2>Property not found</h2>
          <p>{{ propertyStore.detailError() }}</p>
          <button mat-raised-button color="primary" (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            Go Back
          </button>
        </mat-card>
      }

      <!-- Property Detail Content -->
      @if (!propertyStore.isLoadingDetail() && !propertyStore.detailError() && propertyStore.selectedProperty()) {
        <!-- Header with Property Name (AC-2.3.2) -->
        <header class="property-header">
          <div class="header-content">
            <button mat-icon-button (click)="goBack()" aria-label="Go back" class="back-button">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="title-section">
              <h1>{{ propertyStore.selectedProperty()!.name }}</h1>
              <p class="address">{{ propertyStore.selectedPropertyFullAddress() }}</p>
            </div>
          </div>
          <!-- Action Buttons (AC-2.3.4, AC-3.1.1, AC-6.1.1) -->
          <div class="action-buttons">
            <!-- Primary actions - always visible -->
            <button mat-stroked-button
                    color="primary"
                    [routerLink]="['/properties', propertyStore.selectedProperty()!.id, 'expenses']">
              <mat-icon>add</mat-icon>
              <span class="button-text">Add Expense</span>
            </button>
            <button mat-stroked-button
                    color="primary"
                    [routerLink]="['/properties', propertyStore.selectedProperty()!.id, 'income']">
              <mat-icon>add</mat-icon>
              <span class="button-text">Add Income</span>
            </button>

            <!-- Desktop: Show all buttons -->
            @if (!isMobile()) {
              <button mat-flat-button
                      color="primary"
                      (click)="openReportDialog()"
                      data-testid="generate-report-button">
                <mat-icon>description</mat-icon>
                Generate Report
              </button>
              <button mat-stroked-button color="primary" [routerLink]="['/properties', propertyStore.selectedProperty()!.id, 'edit']">
                <mat-icon>edit</mat-icon>
                Edit
              </button>
              <button mat-stroked-button
                      color="warn"
                      (click)="onDeleteClick()"
                      [disabled]="propertyStore.isDeleting()">
                @if (propertyStore.isDeleting()) {
                  <mat-spinner diameter="18" class="button-spinner"></mat-spinner>
                } @else {
                  <mat-icon>delete</mat-icon>
                }
                Delete
              </button>
            }

            <!-- Mobile: More menu for secondary actions -->
            @if (isMobile()) {
              <button mat-stroked-button
                      color="primary"
                      [matMenuTriggerFor]="moreMenu"
                      aria-label="More actions">
                <mat-icon>more_vert</mat-icon>
                <span class="button-text">More</span>
              </button>
              <mat-menu #moreMenu="matMenu">
                <button mat-menu-item (click)="openReportDialog()" data-testid="generate-report-menu-item">
                  <mat-icon>description</mat-icon>
                  <span>Generate Report</span>
                </button>
                <button mat-menu-item [routerLink]="['/properties', propertyStore.selectedProperty()!.id, 'edit']">
                  <mat-icon>edit</mat-icon>
                  <span>Edit</span>
                </button>
                <button mat-menu-item
                        (click)="onDeleteClick()"
                        [disabled]="propertyStore.isDeleting()"
                        class="delete-menu-item">
                  @if (propertyStore.isDeleting()) {
                    <mat-spinner diameter="18"></mat-spinner>
                  } @else {
                    <mat-icon color="warn">delete</mat-icon>
                  }
                  <span>Delete</span>
                </button>
              </mat-menu>
            }
          </div>
        </header>

        <!-- Stats Section (AC-2.3.2) -->
        <div class="stats-section">
          <mat-card class="stat-card expense-card">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>trending_down</mat-icon>
              </div>
              <div class="stat-details">
                <span class="stat-label">YTD Expenses</span>
                <span class="stat-value expense-value">{{ propertyStore.selectedProperty()!.expenseTotal | currency }}</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card income-card">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>trending_up</mat-icon>
              </div>
              <div class="stat-details">
                <span class="stat-label">YTD Income</span>
                <span class="stat-value income-value">{{ propertyStore.selectedProperty()!.incomeTotal | currency }}</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card net-card">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>{{ propertyStore.selectedPropertyNetIncome() >= 0 ? 'account_balance' : 'warning' }}</mat-icon>
              </div>
              <div class="stat-details">
                <span class="stat-label">Net Income</span>
                <span class="stat-value" [class.negative]="propertyStore.selectedPropertyNetIncome() < 0" [class.positive]="propertyStore.selectedPropertyNetIncome() > 0">
                  {{ formatNetIncome(propertyStore.selectedPropertyNetIncome()) }}
                </span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Photo Gallery Section (AC-13.3b.2, AC-13.3c.5, AC-13.3c.6) -->
        <div class="photo-section">
          <app-property-photo-gallery
            [photos]="galleryPhotos()"
            [isLoading]="photoStore.isLoading()"
            (addPhotoClick)="showUploadDialog = true"
            (photoClick)="onPhotoClick($event)"
            (setPrimaryClick)="onSetPrimaryClick($event)"
            (deleteClick)="onDeletePhotoClick($event)"
            (reorderClick)="onReorderPhotos($event)"
          />

          <!-- Upload Dialog/Overlay -->
          @if (showUploadDialog) {
            <div class="upload-overlay" (click)="showUploadDialog = false">
              <div class="upload-dialog" (click)="$event.stopPropagation()">
                <div class="upload-dialog-header">
                  <h3>Upload Photo</h3>
                  <button mat-icon-button (click)="showUploadDialog = false" aria-label="Close">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <app-property-photo-upload
                  [propertyId]="propertyStore.selectedProperty()!.id"
                  (uploadComplete)="onUploadComplete()"
                />
              </div>
            </div>
          }
        </div>

        <!-- Work Orders Section (Story 9-11) -->
        <div class="work-orders-section">
          <app-property-work-orders
            [propertyId]="propertyStore.selectedProperty()!.id"
            (createClick)="onCreateWorkOrder()"
            (viewAllClick)="onViewAllWorkOrders()"
          />
        </div>

        <!-- Recent Activity Section (AC-2.3.3) -->
        <div class="activity-section">
          <!-- Recent Expenses -->
          <mat-card class="activity-card">
            <mat-card-header>
              <mat-card-title>Recent Expenses</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (propertyStore.selectedProperty()!.recentExpenses.length === 0) {
                <div class="empty-state">
                  <mat-icon>receipt_long</mat-icon>
                  <p>No expenses yet</p>
                </div>
              } @else {
                <!-- Future: List of recent expenses -->
                <div class="activity-list">
                  @for (expense of propertyStore.selectedProperty()!.recentExpenses; track expense.id) {
                    <div class="activity-item">
                      <span class="activity-date">{{ expense.date | date:'mediumDate' }}</span>
                      <span class="activity-description">{{ expense.description || 'No description' }}</span>
                      <span class="activity-amount expense">{{ expense.amount | currency }}</span>
                    </div>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Recent Income -->
          <mat-card class="activity-card">
            <mat-card-header>
              <mat-card-title>Recent Income</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (propertyStore.selectedProperty()!.recentIncome.length === 0) {
                <div class="empty-state">
                  <mat-icon>payments</mat-icon>
                  <p>No income recorded yet</p>
                </div>
              } @else {
                <!-- Future: List of recent income -->
                <div class="activity-list">
                  @for (income of propertyStore.selectedProperty()!.recentIncome; track income.id) {
                    <div class="activity-item">
                      <span class="activity-date">{{ income.date | date:'mediumDate' }}</span>
                      <span class="activity-description">{{ income.description || 'No description' }}</span>
                      <span class="activity-amount income">{{ income.amount | currency }}</span>
                    </div>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    .property-detail-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .error-card {
      text-align: center;
      padding: 48px;
      max-width: 400px;
      margin: 48px auto;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--pm-error, #c62828);
        margin-bottom: 16px;
      }

      h2 {
        color: var(--pm-text-primary);
        font-size: 24px;
        font-weight: 500;
        margin: 0 0 12px 0;
      }

      p {
        color: var(--pm-text-secondary);
        font-size: 16px;
        margin: 0 0 24px 0;
      }

      button mat-icon {
        margin-right: 8px;
      }
    }

    .property-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        .back-button {
          margin-top: 4px;
        }

        .title-section {
          h1 {
            color: var(--pm-text-primary);
            font-size: 28px;
            font-weight: 600;
            margin: 0 0 8px 0;
          }

          .address {
            color: var(--pm-text-secondary);
            font-size: 16px;
            margin: 0;
          }
        }
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;

        button mat-icon {
          margin-right: 4px;
        }

        button mat-spinner {
          display: inline-block;
          margin-right: 4px;
        }
      }
    }

    .stats-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;

      .stat-card {
        mat-card-content {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background-color: var(--pm-primary-light);

          mat-icon {
            color: var(--pm-primary-dark);
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        &.expense-card .stat-icon {
          background-color: #ffebee;

          mat-icon {
            color: #c62828;
          }
        }

        &.income-card .stat-icon {
          background-color: #e8f5e9;

          mat-icon {
            color: var(--pm-primary-dark);
          }
        }

        &.net-card .stat-icon {
          background-color: #fff8e1;

          mat-icon {
            color: #f57f17;
          }
        }

        .stat-details {
          display: flex;
          flex-direction: column;

          .stat-label {
            color: var(--pm-text-secondary);
            font-size: 14px;
            margin-bottom: 4px;
          }

          .stat-value {
            color: var(--pm-text-primary);
            font-size: 24px;
            font-weight: 600;

            &.expense-value {
              color: #c62828;
            }

            &.income-value {
              color: var(--pm-primary-dark);
            }

            &.negative {
              color: #c62828;
            }

            &.positive {
              color: var(--pm-primary-dark);
            }
          }
        }
      }
    }

    .activity-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;

      .activity-card {
        mat-card-header {
          margin-bottom: 16px;
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

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          gap: 12px;

          &:last-child {
            border-bottom: none;
          }

          .activity-date {
            color: var(--pm-text-secondary);
            font-size: 13px;
            white-space: nowrap;
            min-width: 80px;
          }

          .activity-description {
            color: var(--pm-text-primary);
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .activity-amount {
            font-weight: 500;
            white-space: nowrap;

            &.expense {
              color: #c62828;
            }

            &.income {
              color: var(--pm-primary-dark);
            }
          }
        }
      }
    }

    @media (max-width: 767px) {
      .property-header {
        flex-direction: column;

        .header-content {
          .title-section h1 {
            font-size: 24px;
          }
        }

        .action-buttons {
          width: 100%;
          justify-content: flex-start;

          button {
            flex: 1;
            min-width: 0;
            max-width: none;
            padding: 0 12px;

            .button-text {
              display: inline;
            }

            mat-icon {
              margin-right: 4px;
            }
          }
        }
      }

      .stats-section {
        grid-template-columns: 1fr;
      }

      .activity-section {
        grid-template-columns: 1fr;
      }
    }

    // Menu item styling for delete action
    .delete-menu-item {
      color: var(--pm-error, #c62828);
    }

    // Photo Section (AC-13.3b.2)
    .photo-section {
      margin-bottom: 24px;
    }

    // Work Orders Section (Story 9-11)
    .work-orders-section {
      margin-bottom: 24px;
    }

    // Upload Overlay
    .upload-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .upload-dialog {
      background-color: white;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

      .upload-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid var(--pm-border, #e0e0e0);

        h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: var(--pm-text-primary);
        }
      }

      app-property-photo-upload {
        display: block;
        padding: 24px;
      }
    }
  `]
})
export class PropertyDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly propertyStore = inject(PropertyStore);
  readonly photoStore = inject(PropertyPhotoStore);
  readonly yearService = inject(YearSelectorService);

  private propertyId: string | null = null;
  private readonly destroy$ = new Subject<void>();

  /** Mobile viewport detection for responsive action buttons */
  readonly isMobile = signal(false);

  /** Show upload dialog overlay */
  showUploadDialog = false;

  /**
   * Convert store photos to gallery-compatible format
   */
  galleryPhotos = computed(() =>
    this.photoStore.sortedPhotos().map(p => ({
      id: p.id ?? '',
      thumbnailUrl: p.thumbnailUrl,
      viewUrl: p.viewUrl,
      isPrimary: p.isPrimary ?? false,
      displayOrder: p.displayOrder ?? 0,
      originalFileName: p.originalFileName,
      fileSizeBytes: p.fileSizeBytes,
      createdAt: p.createdAt,
    } as PropertyPhoto))
  );

  constructor() {
    // React to year changes and reload property detail (AC-3.5.6)
    effect(() => {
      const year = this.yearService.selectedYear();
      if (this.propertyId) {
        this.propertyStore.loadPropertyById({ id: this.propertyId, year });
      }
    });
  }

  ngOnInit(): void {
    // Get property ID from route and load (AC-2.3.1)
    this.propertyId = this.route.snapshot.paramMap.get('id');
    // Initial load happens via effect when selectedYear signal is read

    // Load photos for the property (AC-13.3b.2)
    if (this.propertyId) {
      this.photoStore.loadPhotos(this.propertyId);
    }

    // Mobile breakpoint detection for responsive action buttons
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile.set(result.matches);
      });
  }

  ngOnDestroy(): void {
    // Clear selected property and photos when leaving the page
    this.propertyStore.clearSelectedProperty();
    this.photoStore.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/properties']);
  }

  /**
   * Format net income with accounting format for negative values (AC-4.4.4)
   * Positive: $1,234.00
   * Negative: ($1,234.00) - accounting format with parentheses
   * Zero: $0.00
   */
  formatNetIncome(value: number): string {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (value < 0) {
      return `(${formatted})`;
    }
    return formatted;
  }

  /**
   * Opens the report generation dialog (AC-6.1.1).
   * Passes property details and current year to the dialog.
   */
  openReportDialog(): void {
    const property = this.propertyStore.selectedProperty();
    if (!property) return;

    const dialogData: ReportDialogData = {
      propertyId: property.id,
      propertyName: property.name,
      currentYear: this.yearService.selectedYear()
    };

    this.dialog.open(ReportDialogComponent, {
      width: '700px',
      maxHeight: '90vh',
      data: dialogData,
      panelClass: 'report-dialog-panel'
    });
  }

  /**
   * Opens delete confirmation dialog (AC-2.5.1)
   * On confirm: calls propertyStore.deleteProperty() which handles
   * API call, success snackbar, and navigation to dashboard (AC-2.5.4)
   */
  onDeleteClick(): void {
    const property = this.propertyStore.selectedProperty();
    if (!property) return;

    const dialogData: ConfirmDialogData = {
      title: `Delete ${property.name}?`,
      message: 'This will remove the property from your active portfolio.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
      secondaryMessage:
        'Historical expense and income records will be preserved for tax purposes.',
      confirmIcon: 'delete',
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '450px',
      disableClose: true,
      panelClass: 'confirm-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.propertyStore.deleteProperty(property.id);
      }
    });
  }

  /**
   * Handle photo click - open lightbox dialog (AC-13.3c.1)
   */
  onPhotoClick(photo: PropertyPhoto): void {
    const photos = this.galleryPhotos();
    const currentIndex = photos.findIndex(p => p.id === photo.id);

    const dialogData: PropertyPhotoLightboxData = {
      photos: photos.map(p => ({
        id: p.id,
        viewUrl: p.viewUrl,
        thumbnailUrl: p.thumbnailUrl,
        contentType: this.inferContentType(p.originalFileName),
        originalFileName: p.originalFileName,
        isPrimary: p.isPrimary,
        displayOrder: p.displayOrder,
      })),
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    };

    this.dialog.open(PropertyPhotoLightboxComponent, {
      data: dialogData,
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100vw',
      height: '100vh',
      panelClass: 'fullscreen-dialog',
    });
  }

  /**
   * Infer content type from filename extension
   */
  private inferContentType(filename?: string): string {
    if (!filename) return 'image/jpeg';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'svg': return 'image/svg+xml';
      case 'bmp': return 'image/bmp';
      case 'jpg':
      case 'jpeg':
      default: return 'image/jpeg';
    }
  }

  /**
   * Handle upload complete - close dialog
   * Note: Photo refresh is handled by the store's uploadPhoto method
   */
  onUploadComplete(): void {
    this.showUploadDialog = false;
  }

  /**
   * Handle set primary photo click (AC-13.3c.5)
   */
  onSetPrimaryClick(photo: PropertyPhoto): void {
    this.photoStore.setPrimaryPhoto(photo.id);
  }

  /**
   * Handle delete photo click - show confirmation dialog (AC-13.3c.5, AC-13.3c.8)
   */
  onDeletePhotoClick(photo: PropertyPhoto): void {
    const dialogData: ConfirmDialogData = {
      title: 'Delete Photo?',
      message: 'Are you sure you want to delete this photo?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
      secondaryMessage: 'This action cannot be undone.',
      confirmIcon: 'delete',
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '400px',
      disableClose: true,
      panelClass: 'confirm-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.photoStore.deletePhoto(photo.id);
      }
    });
  }

  /**
   * Handle reorder photos (AC-13.3c.6)
   */
  onReorderPhotos(photoIds: string[]): void {
    this.photoStore.reorderPhotos(photoIds);
  }

  /**
   * Navigate to create work order with pre-selected property (Story 9-11 AC #3)
   */
  onCreateWorkOrder(): void {
    const property = this.propertyStore.selectedProperty();
    if (property) {
      this.router.navigate(['/work-orders/new'], {
        queryParams: { propertyId: property.id },
      });
    }
  }

  /**
   * Navigate to work orders dashboard filtered by this property (Story 9-11 AC #5)
   */
  onViewAllWorkOrders(): void {
    const property = this.propertyStore.selectedProperty();
    if (property) {
      this.router.navigate(['/work-orders'], {
        queryParams: { propertyId: property.id },
      });
    }
  }
}
