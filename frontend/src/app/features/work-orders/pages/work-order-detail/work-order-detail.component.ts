import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { WorkOrderStore } from '../../stores/work-order.store';
import { WorkOrderPhotoStore } from '../../stores/work-order-photo.store';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WorkOrderNotesComponent } from '../../components/work-order-notes/work-order-notes.component';
import { WorkOrderPhotoGalleryComponent } from '../../components/work-order-photo-gallery/work-order-photo-gallery.component';
import { PhotoUploadComponent } from '../../../../shared/components/photo-upload/photo-upload.component';
import { PhotoLightboxComponent, PhotoLightboxData, LightboxPhoto } from '../../../../shared/components/photo-lightbox/photo-lightbox.component';
import { WorkOrderPhotoDto } from '../../../../core/api/api.service';

/**
 * WorkOrderDetailComponent (Story 9-8)
 *
 * Displays full work order details including:
 * - Status badge (AC #2)
 * - Property name as link (AC #2)
 * - Full description (AC #2)
 * - Category and tags (AC #2)
 * - Vendor assignment or DIY (AC #2)
 * - Created/Updated timestamps (AC #2)
 * - Edit and Delete action buttons (AC #3)
 * - Placeholder sections for Photos, Notes, Expenses (AC #4)
 * - Back navigation (AC #5)
 * - 404 error handling (AC #6)
 * - Loading state (AC #7)
 */
@Component({
  selector: 'app-work-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
    WorkOrderNotesComponent,
    WorkOrderPhotoGalleryComponent,
    PhotoUploadComponent,
  ],
  template: `
    <div class="work-order-detail-page">
      <!-- Loading State (AC #7) -->
      @if (store.isLoadingDetail()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading work order...</p>
        </div>
      }

      <!-- Error State (AC #6) -->
      @if (!store.isLoadingDetail() && store.detailError()) {
        <mat-card class="error-card">
          <mat-card-content>
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h2>{{ store.detailError() }}</h2>
            <p>The work order you're looking for doesn't exist or you don't have access to it.</p>
            <button mat-raised-button color="primary" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              Back to Work Orders
            </button>
          </mat-card-content>
        </mat-card>
      }

      <!-- Work Order Detail Content (AC #2-#5) -->
      @if (!store.isLoadingDetail() && store.selectedWorkOrder()) {
        <!-- Header with Back Button and Status Badge (AC #2, #5) -->
        <header class="work-order-header">
          <div class="header-content">
            <button
              mat-icon-button
              (click)="goBack()"
              aria-label="Go back to work orders"
              class="back-button"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="title-section">
              <span class="status-badge" [ngClass]="'status-' + store.selectedWorkOrder()!.status.toLowerCase()">
                {{ store.selectedWorkOrder()!.status }}
              </span>
              <h1>Work Order</h1>
            </div>
          </div>
          <!-- Action Buttons (AC #3) -->
          <div class="action-buttons">
            <button
              mat-stroked-button
              color="primary"
              [routerLink]="['/work-orders', workOrderId, 'edit']"
              title="Edit work order (Story 9-9)"
            >
              <mat-icon>edit</mat-icon>
              Edit
            </button>
            <button
              mat-stroked-button
              color="warn"
              (click)="onDeleteClick()"
              title="Delete work order (Story 9-10)"
            >
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          </div>
        </header>

        <!-- Property Link (AC #2) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Property</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <a
              [routerLink]="['/properties', store.selectedWorkOrder()!.propertyId]"
              class="property-link"
            >
              <mat-icon>home</mat-icon>
              {{ store.selectedWorkOrder()!.propertyName }}
            </a>
          </mat-card-content>
        </mat-card>

        <!-- Description (AC #2) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Description</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="description-text">{{ store.selectedWorkOrder()!.description }}</p>
          </mat-card-content>
        </mat-card>

        <!-- Details Section: Category, Assignment, Tags (AC #2) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Details</mat-card-title>
          </mat-card-header>
          <mat-card-content class="details-content">
            <!-- Category -->
            <div class="detail-row">
              <span class="detail-label">Category</span>
              <span class="detail-value">
                {{ store.selectedWorkOrder()!.categoryName || 'Not categorized' }}
              </span>
            </div>

            <!-- Assignment -->
            <div class="detail-row">
              <span class="detail-label">Assigned To</span>
              <span class="detail-value">
                @if (store.selectedWorkOrder()!.isDiy) {
                  <span class="diy-label">
                    <mat-icon class="diy-icon">person</mat-icon>
                    DIY (Self)
                  </span>
                } @else if (store.selectedWorkOrder()!.vendorId) {
                  <a
                    [routerLink]="['/vendors', store.selectedWorkOrder()!.vendorId]"
                    class="vendor-link"
                  >
                    <mat-icon class="vendor-icon">engineering</mat-icon>
                    {{ store.selectedWorkOrder()!.vendorName }}
                  </a>
                } @else {
                  <span class="unassigned">Not assigned</span>
                }
              </span>
            </div>

            <!-- Tags -->
            <div class="detail-row">
              <span class="detail-label">Tags</span>
              <span class="detail-value">
                @if (store.selectedWorkOrder()!.tags && store.selectedWorkOrder()!.tags.length > 0) {
                  <mat-chip-set class="work-order-tags">
                    @for (tag of store.selectedWorkOrder()!.tags; track tag.id) {
                      <mat-chip>{{ tag.name }}</mat-chip>
                    }
                  </mat-chip-set>
                } @else {
                  <span class="no-tags">No tags</span>
                }
              </span>
            </div>

            <!-- Created Date -->
            <div class="detail-row">
              <span class="detail-label">Created</span>
              <span class="detail-value">
                {{ store.selectedWorkOrder()!.createdAt | date:'medium' }}
              </span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Photos Section (Story 10-5) -->
        <div class="photos-section">
          <!-- Photo Upload Zone (toggleable) -->
          @if (showUploadZone()) {
            <mat-card class="section-card upload-zone-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>cloud_upload</mat-icon>
                  Upload Photos
                </mat-card-title>
                <button
                  mat-icon-button
                  (click)="toggleUploadZone()"
                  aria-label="Close upload zone"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </mat-card-header>
              <mat-card-content>
                <app-photo-upload
                  [uploadFn]="uploadPhoto"
                  (uploadComplete)="onUploadComplete()"
                />
              </mat-card-content>
            </mat-card>
          }

          <!-- Photo Gallery -->
          <app-work-order-photo-gallery
            [photos]="photoStore.sortedPhotos()"
            [isLoading]="photoStore.isLoading()"
            [isUploadVisible]="showUploadZone()"
            (addPhotoClick)="toggleUploadZone()"
            (photoClick)="onPhotoClick($event)"
            (deleteClick)="onPhotoDeleteClick($event)"
            (setPrimaryClick)="onSetPrimaryPhoto($event)"
            (reorderClick)="onReorderPhotos($event)"
          />
        </div>

        <!-- Notes Section (Story 10-2) -->
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Notes</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-work-order-notes [workOrderId]="store.selectedWorkOrder()!.id"></app-work-order-notes>
          </mat-card-content>
        </mat-card>

        <!-- Linked Expenses Placeholder -->
        <mat-card class="section-card placeholder-section">
          <mat-card-header>
            <mat-card-title>Linked Expenses</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="empty-state">
              <mat-icon class="empty-icon">receipt_long</mat-icon>
              <p>No expenses linked</p>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .work-order-detail-page {
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
        color: var(--mat-sys-outline);
      }

      .error-card {
        text-align: center;
        padding: 48px;
      }

      .error-card mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .error-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        color: var(--mat-sys-error);
      }

      .work-order-header {
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

      .title-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .title-section h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 500;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        width: fit-content;
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

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .action-buttons button mat-icon {
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

      .property-link {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--mat-sys-primary);
        text-decoration: none;
        font-size: 16px;
        font-weight: 500;
      }

      .property-link:hover {
        text-decoration: underline;
      }

      .property-link mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .description-text {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.6;
      }

      .details-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .detail-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .detail-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--mat-sys-outline);
      }

      .detail-value {
        font-size: 15px;
      }

      .diy-label {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--mat-sys-on-surface);
      }

      .diy-icon,
      .vendor-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .vendor-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--mat-sys-primary);
        text-decoration: none;
      }

      .vendor-link:hover {
        text-decoration: underline;
      }

      .unassigned,
      .no-tags {
        color: var(--mat-sys-outline);
        font-style: italic;
      }

      .work-order-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .work-order-tags mat-chip {
        font-size: 0.9em;
      }

      .placeholder-section {
        opacity: 0.7;
      }

      /* Photos Section */
      .photos-section {
        margin-bottom: 16px;
      }

      .upload-zone-card {
        margin-bottom: 16px;

        mat-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          mat-card-title {
            display: flex;
            align-items: center;
            gap: 8px;

            mat-icon {
              color: var(--pm-primary);
            }
          }
        }
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 16px;
        text-align: center;
        color: var(--mat-sys-outline);
      }

      .empty-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        margin-bottom: 8px;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0;
        font-size: 14px;
        font-style: italic;
      }

      /* Responsive */
      @media (max-width: 600px) {
        .work-order-detail-page {
          padding: 16px;
        }

        .work-order-header {
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

        .detail-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class WorkOrderDetailComponent implements OnInit, OnDestroy {
  protected readonly store = inject(WorkOrderStore);
  protected readonly photoStore = inject(WorkOrderPhotoStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected workOrderId: string | null = null;

  /** Whether the upload zone is visible */
  protected readonly showUploadZone = signal(false);

  ngOnInit(): void {
    this.workOrderId = this.route.snapshot.paramMap.get('id');
    if (this.workOrderId) {
      this.store.loadWorkOrderById(this.workOrderId);
      this.photoStore.loadPhotos(this.workOrderId);
    }
  }

  ngOnDestroy(): void {
    this.store.clearSelectedWorkOrder();
    this.photoStore.clear();
  }

  /**
   * Navigate back to work orders list (AC #5)
   */
  goBack(): void {
    this.router.navigate(['/work-orders']);
  }

  /**
   * Handle delete button click (Story 9-9, AC #5, #6, #7)
   * Opens confirmation dialog and deletes work order if confirmed.
   */
  async onDeleteClick(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this work order?',
        message: 'This will remove the work order. Linked expenses will be unlinked.',
        confirmText: 'Delete',
        icon: 'warning',
        iconColor: 'warn',
        confirmIcon: 'delete',
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed && this.workOrderId) {
      this.store.deleteWorkOrder(this.workOrderId);
    }
  }

  // ========== Photo Methods (Story 10-5) ==========

  /**
   * Upload photo function passed to PhotoUploadComponent
   */
  uploadPhoto = async (file: File): Promise<boolean> => {
    return this.photoStore.uploadPhoto(file);
  };

  /**
   * Toggle the visibility of the upload zone
   */
  toggleUploadZone(): void {
    this.showUploadZone.update((value) => !value);
  }

  /**
   * Handle upload completion - close upload zone
   */
  onUploadComplete(): void {
    this.showUploadZone.set(false);
  }

  /**
   * Handle photo click - open lightbox (Story 10-5, AC #7; Story 10-6)
   */
  onPhotoClick(photo: WorkOrderPhotoDto): void {
    const photos = this.photoStore.sortedPhotos();

    // Guard against empty photos array
    if (photos.length === 0) {
      return;
    }

    const currentIndex = photos.findIndex((p) => p.id === photo.id);

    const dialogRef = this.dialog.open(PhotoLightboxComponent, {
      data: {
        photos: photos.map((p) => ({
          id: p.id || '',
          viewUrl: p.photoUrl,
          thumbnailUrl: p.thumbnailUrl,
          originalFileName: p.originalFileName,
          createdAt: p.createdAt,  // Story 10-6: Pass upload date
        })),
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        showDelete: true,  // Story 10-6: Enable delete from lightbox
      } as PhotoLightboxData,
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100%',
      height: '100%',
      panelClass: 'photo-lightbox-dialog',
    });

    // Story 10-6: Subscribe to delete events from lightbox
    const lightbox = dialogRef.componentInstance;
    lightbox.deleteClick.subscribe((photoToDelete: LightboxPhoto) => {
      this.onLightboxDelete(photoToDelete, dialogRef);
    });
  }

  /**
   * Handle set primary photo click
   */
  onSetPrimaryPhoto(photo: WorkOrderPhotoDto): void {
    if (photo.id) {
      this.photoStore.setPrimaryPhoto(photo.id);
    }
  }

  /**
   * Handle reorder photos
   */
  onReorderPhotos(photoIds: string[]): void {
    this.photoStore.reorderPhotos(photoIds);
  }

  /**
   * Handle photo delete click - confirm and delete (Story 10-5, AC #8)
   */
  async onPhotoDeleteClick(photo: WorkOrderPhotoDto): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this photo?',
        message: 'This photo will be permanently removed from this work order.',
        confirmText: 'Delete',
        icon: 'warning',
        iconColor: 'warn',
        confirmIcon: 'delete',
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed && photo.id) {
      this.photoStore.deletePhoto(photo.id);
    }
  }

  /**
   * Handle delete from lightbox (Story 10-6, AC #5, #6, #7)
   * Shows confirmation, deletes photo, and updates lightbox state.
   */
  async onLightboxDelete(
    photo: LightboxPhoto,
    lightboxRef: MatDialogRef<PhotoLightboxComponent>
  ): Promise<void> {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this photo?',
        message: 'This photo will be permanently removed.',
        confirmText: 'Delete',
        icon: 'warning',
        iconColor: 'warn',
        confirmIcon: 'delete',
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(confirmRef.afterClosed());
    if (confirmed && photo.id) {
      // Delete the photo via store
      this.photoStore.deletePhoto(photo.id);

      // Wait a tick for store to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check remaining photos
      const remainingPhotos = this.photoStore.sortedPhotos();
      if (remainingPhotos.length === 0) {
        // No photos left - close lightbox (AC #7)
        lightboxRef.close();
      } else {
        // Update lightbox with remaining photos (AC #6)
        const lightbox = lightboxRef.componentInstance;
        const currentIdx = lightbox.currentIndex();
        const newIdx = Math.min(currentIdx, remainingPhotos.length - 1);

        lightbox.updatePhotos(
          remainingPhotos.map((p) => ({
            id: p.id || '',
            viewUrl: p.photoUrl,
            thumbnailUrl: p.thumbnailUrl,
            originalFileName: p.originalFileName,
            createdAt: p.createdAt,
          })),
          newIdx
        );
      }
    }
  }
}
