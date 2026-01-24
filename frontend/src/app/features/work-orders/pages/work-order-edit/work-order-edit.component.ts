import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { WorkOrderFormComponent } from '../../components/work-order-form/work-order-form.component';
import { WorkOrderStore } from '../../stores/work-order.store';
import { UpdateWorkOrderRequest } from '../../services/work-order.service';

/**
 * WorkOrderEditComponent (Story 9-9, AC #1, #2)
 *
 * Page for editing an existing work order.
 * - Loads work order by ID from route params
 * - Renders WorkOrderFormComponent in edit mode
 * - Passes work order data to form for pre-population
 */
@Component({
  selector: 'app-work-order-edit',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    WorkOrderFormComponent,
  ],
  template: `
    <div class="work-order-edit-page">
      <!-- Loading State -->
      @if (store.isLoadingDetail()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading work order...</p>
        </div>
      }

      <!-- Error State -->
      @if (!store.isLoadingDetail() && store.detailError()) {
        <mat-card class="error-card">
          <mat-card-content>
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h2>{{ store.detailError() }}</h2>
            <p>The work order you're trying to edit doesn't exist or you don't have access to it.</p>
            <button mat-raised-button color="primary" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              Back to Work Orders
            </button>
          </mat-card-content>
        </mat-card>
      }

      <!-- Edit Form -->
      @if (!store.isLoadingDetail() && store.selectedWorkOrder()) {
        <h1>Edit Work Order</h1>
        <app-work-order-form
          [workOrder]="store.selectedWorkOrder()"
          mode="edit"
          (formSubmit)="onSubmit($event)"
          (formCancel)="onCancel()"
        />
      }
    </div>
  `,
  styles: [
    `
      .work-order-edit-page {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      h1 {
        margin-bottom: 24px;
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
    `,
  ],
})
export class WorkOrderEditComponent implements OnInit, OnDestroy {
  protected readonly store = inject(WorkOrderStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadWorkOrderById(id);
    }
  }

  ngOnDestroy(): void {
    this.store.clearSelectedWorkOrder();
  }

  /**
   * Handle form submission (AC #3)
   */
  onSubmit(data: UpdateWorkOrderRequest): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.updateWorkOrder({ id, data });
    }
  }

  /**
   * Handle cancel (AC #4)
   */
  onCancel(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.router.navigate(['/work-orders', id]);
  }

  /**
   * Navigate back to work orders list
   */
  goBack(): void {
    this.router.navigate(['/work-orders']);
  }
}
