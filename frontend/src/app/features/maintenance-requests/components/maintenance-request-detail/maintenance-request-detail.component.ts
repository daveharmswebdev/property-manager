import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorCardComponent } from '../../../../shared/components/error-card/error-card.component';
import { MaintenanceRequestStore } from '../../stores/maintenance-request.store';

/**
 * MaintenanceRequestDetailComponent (Story 20.7, AC #3, #5, #12).
 *
 * Read-only detail view for a single maintenance request from the landlord
 * inbox. Convert/dismiss actions live in 20.8/20.9 and are intentionally
 * out of scope here.
 */
@Component({
  selector: 'app-maintenance-request-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    LoadingSpinnerComponent,
    ErrorCardComponent,
  ],
  template: `
    <div class="request-detail-page" data-testid="request-detail-page">
      <button mat-button routerLink="/maintenance-requests" class="back-button" data-testid="back-button">
        <mat-icon>arrow_back</mat-icon>
        Back to Inbox
      </button>

      @if (store.isLoadingDetail()) {
        <app-loading-spinner />
      } @else if (store.detailError()) {
        <app-error-card
          [message]="store.detailError()!"
          [showRetry]="true"
          (retry)="retry()"
        />
      } @else if (store.selectedRequest(); as req) {
        <mat-card class="detail-card">
          <mat-card-content>
            <!-- Header: status chip + submission date -->
            <div class="detail-header">
              <span
                class="status-chip"
                data-testid="status-chip"
                [class.status-submitted]="req.status === 'Submitted'"
                [class.status-in-progress]="req.status === 'InProgress'"
                [class.status-resolved]="req.status === 'Resolved'"
                [class.status-dismissed]="req.status === 'Dismissed'"
              >
                {{ getStatusLabel(req.status) }}
              </span>
              <span class="submission-date">
                Submitted {{ req.createdAt | date: 'medium' }}
              </span>
            </div>

            <!-- Property block -->
            <section class="detail-section property-block">
              <h3>
                <mat-icon class="section-icon">home</mat-icon>
                Property
              </h3>
              <p class="property-name">{{ req.propertyName }}</p>
              <p class="property-address">{{ req.propertyAddress }}</p>
            </section>

            <!-- Submitter block -->
            <section class="detail-section submitter-block">
              <h3>
                <mat-icon class="section-icon">person</mat-icon>
                Submitted by
              </h3>
              <p class="submitter-name">{{ req.submittedByUserName || 'Unknown' }}</p>
              <small class="submitter-id">{{ req.submittedByUserId }}</small>
            </section>

            <!-- Description -->
            <section class="detail-section description-block" data-testid="request-description">
              <h3>Description</h3>
              <p class="description-text">{{ req.description }}</p>
            </section>

            <!-- Dismissal reason (only when Dismissed) -->
            @if (req.status === 'Dismissed' && req.dismissalReason) {
              <section
                class="detail-section dismissal-block"
                data-testid="dismissal-reason"
              >
                <h3>
                  <mat-icon class="section-icon">info</mat-icon>
                  Dismissal Reason
                </h3>
                <p class="dismissal-text">{{ req.dismissalReason }}</p>
              </section>
            }

            <!-- Linked work order badge -->
            @if (req.workOrderId) {
              <section class="detail-section linked-wo-block">
                <a
                  mat-stroked-button
                  color="primary"
                  [routerLink]="['/work-orders', req.workOrderId]"
                  class="linked-wo-link"
                  data-testid="linked-work-order"
                >
                  <mat-icon>link</mat-icon>
                  View linked work order
                </a>
              </section>
            }

            <!-- Photos grid -->
            @if (req.photos && req.photos.length > 0) {
              <section class="detail-section photos-block">
                <h3>Photos</h3>
                <div class="photo-grid" data-testid="photo-grid">
                  @for (photo of req.photos; track photo.id) {
                    <a
                      class="photo-thumbnail"
                      [href]="photo.viewUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        [src]="photo.thumbnailUrl || photo.viewUrl"
                        [alt]="photo.originalFileName"
                        loading="lazy"
                      />
                    </a>
                  }
                </div>
              </section>
            }

            <!-- Updated timestamp -->
            <footer class="detail-footer">
              <small>Last updated {{ req.updatedAt | date: 'medium' }}</small>
            </footer>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .request-detail-page {
        padding: 24px 16px;
        max-width: 800px;
        margin: 0 auto;
      }

      .back-button {
        margin-bottom: 16px;
      }

      .back-button mat-icon {
        margin-right: 4px;
      }

      .detail-card {
        margin-bottom: 24px;
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 24px;
      }

      .submission-date {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .detail-section {
        margin-bottom: 20px;
      }

      .detail-section h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }

      .section-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
      }

      .property-name,
      .submitter-name {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
      }

      .property-address,
      .submitter-id {
        margin: 4px 0 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .description-text {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.5;
      }

      .dismissal-text {
        margin: 0;
        white-space: pre-wrap;
        padding: 12px;
        background-color: var(--mat-sys-error-container, #fff3e0);
        color: var(--mat-sys-on-error-container, #e65100);
        border-radius: 4px;
        line-height: 1.4;
      }

      .photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
      }

      .photo-thumbnail {
        display: block;
        aspect-ratio: 1 / 1;
        border-radius: 8px;
        overflow: hidden;
        background-color: var(--mat-sys-surface-container);
      }

      .photo-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .detail-footer {
        margin-top: 16px;
        text-align: right;
        color: var(--mat-sys-on-surface-variant);
      }

      /* Status chip — match landlord inbox + tenant dashboard. */
      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
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

      @media (max-width: 768px) {
        .request-detail-page {
          padding: 16px 12px;
        }

        .detail-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class MaintenanceRequestDetailComponent implements OnInit, OnDestroy {
  protected readonly store = inject(MaintenanceRequestStore);
  private readonly route = inject(ActivatedRoute);

  private requestId = '';

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.requestId) {
      this.store.loadRequestById(this.requestId);
    }
  }

  ngOnDestroy(): void {
    this.store.clearSelectedRequest();
  }

  retry(): void {
    if (this.requestId) {
      this.store.loadRequestById(this.requestId);
    }
  }

  getStatusLabel(status: string): string {
    return status === 'InProgress' ? 'In Progress' : status;
  }
}
