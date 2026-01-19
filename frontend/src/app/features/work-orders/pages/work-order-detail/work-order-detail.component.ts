import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * WorkOrderDetailComponent (AC #7 - navigation target after creation)
 *
 * Placeholder for work order detail page.
 * Will be fully implemented in story 9-8.
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
  ],
  template: `
    <div class="work-order-detail-page">
      <div class="page-header">
        <a mat-button routerLink="/work-orders">
          <mat-icon>arrow_back</mat-icon>
          Back to Work Orders
        </a>
      </div>

      <mat-card class="placeholder-card">
        <mat-card-content>
          <mat-icon class="placeholder-icon">assignment</mat-icon>
          <h2>Work Order Created Successfully</h2>
          <p>Work Order ID: {{ workOrderId }}</p>
          <p class="placeholder-note">
            Full work order details will be available in a future update (Story 9-8).
          </p>
          <a mat-raised-button color="primary" routerLink="/work-orders">
            View All Work Orders
          </a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .work-order-detail-page {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 24px;
      }

      .placeholder-card {
        text-align: center;
        padding: 48px;
      }

      .placeholder-card mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .placeholder-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        color: var(--mat-sys-primary);
      }

      .placeholder-note {
        color: var(--mat-sys-outline);
        font-style: italic;
      }
    `,
  ],
})
export class WorkOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected workOrderId: string | null = null;

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workOrderId = params['id'] || null;
    });
  }
}
