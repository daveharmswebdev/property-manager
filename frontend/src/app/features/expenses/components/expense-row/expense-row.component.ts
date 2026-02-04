import { Component, inject, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseDto } from '../../services/expense.service';
import { WorkOrderDto } from '../../../work-orders/services/work-order.service';
import {
  ReceiptLightboxDialogComponent,
  ReceiptLightboxDialogData,
} from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';
import { formatDateShort } from '../../../../shared/utils/date.utils';

/**
 * ExpenseRowComponent (AC-3.1.7, AC-3.2.1, AC-3.3.1)
 *
 * Displays a single expense in the expense list with:
 * - Date (formatted as "Nov 28, 2025")
 * - Description
 * - Category (as chip/tag)
 * - Amount (formatted as currency)
 * - Edit button (appears on hover) (AC-3.2.1)
 * - Delete button (appears on hover) (AC-3.3.1)
 */
@Component({
  selector: 'app-expense-row',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    CurrencyPipe,
  ],
  template: `
    <div class="expense-row">
      <div class="expense-date">
        {{ formatDate(expense().date) }}
      </div>
      <div class="expense-details">
        <div class="expense-description">
          {{ expense().description || 'No description' }}
          @if (expense().workOrderId) {
            <mat-icon
              class="work-order-indicator clickable"
              [matTooltip]="workOrder()?.description || 'Linked to work order'"
              data-testid="work-order-indicator"
              (click)="navigateToWorkOrder($event)"
            >assignment</mat-icon>
          }
          @if (expense().receiptId) {
            <mat-icon
              class="receipt-indicator"
              matTooltip="View receipt"
              (click)="viewReceipt($event)"
              data-testid="receipt-indicator"
            >receipt</mat-icon>
          }
        </div>
        <mat-chip-set class="expense-category">
          <mat-chip>{{ expense().categoryName }}</mat-chip>
        </mat-chip-set>
        @if (workOrder(); as wo) {
          <div class="work-order-context" (click)="navigateToWorkOrder($event)" data-testid="work-order-context">
            <span class="wo-status-chip" [attr.data-status]="wo.status">{{ wo.status }}</span>
            <span class="wo-description">{{ truncateWoDescription(wo.description) }}</span>
            <mat-icon class="wo-link-icon">open_in_new</mat-icon>
          </div>
        }
      </div>
      <div class="expense-amount">
        {{ expense().amount | currency }}
      </div>
      <!-- Edit and Delete Actions (AC-3.2.1, AC-3.3.1) -->
      <div class="expense-actions">
        <button
          mat-icon-button
          (click)="onEditClick()"
          matTooltip="Edit expense"
          class="edit-button"
        >
          <mat-icon>edit</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="onDeleteClick()"
          matTooltip="Delete expense"
          class="delete-button"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .expense-row {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      gap: 16px;
      transition: background-color 0.2s ease;
    }

    .expense-row:hover {
      background-color: var(--mat-sys-surface-container-low);
    }

    .expense-row:last-child {
      border-bottom: none;
    }

    .expense-date {
      min-width: 100px;
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    .expense-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .expense-description {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .work-order-indicator {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mat-sys-on-surface-variant);
    }

    .work-order-indicator.clickable {
      cursor: pointer;
      transition: color 0.2s ease;
      &:hover {
        color: var(--mat-sys-primary);
      }
    }

    .work-order-context {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8em;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;
      padding: 2px 0;
      transition: color 0.2s ease;
      &:hover {
        color: var(--mat-sys-primary);
      }
    }

    .wo-status-chip {
      font-size: 0.75em;
      padding: 1px 8px;
      border-radius: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .wo-status-chip[data-status="Reported"] {
      background-color: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    .wo-status-chip[data-status="Assigned"] {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    .wo-status-chip[data-status="Completed"] {
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .wo-description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .wo-link-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .work-order-context:hover .wo-link-icon {
      opacity: 1;
    }

    .receipt-indicator {
      font-size: 18px;
      width: 18px;
      height: 18px;
      cursor: pointer;
      color: var(--mat-sys-on-surface-variant);
      transition: color 0.2s ease;

      &:hover {
        color: var(--mat-sys-primary);
      }
    }

    .expense-category {
      mat-chip {
        font-size: 0.8em;
        min-height: 24px;
        padding: 0 8px;
      }
    }

    .expense-amount {
      font-weight: 600;
      font-size: 1.1em;
      min-width: 100px;
      text-align: right;
    }

    .expense-actions {
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .expense-row:hover .expense-actions {
      opacity: 1;
    }

    .edit-button {
      color: var(--mat-sys-primary);
    }

    .delete-button {
      color: var(--mat-sys-on-surface-variant);
    }

    .delete-button:hover {
      color: var(--mat-sys-error);
    }

    @media (max-width: 600px) {
      .expense-row {
        flex-wrap: wrap;
      }

      .expense-date {
        min-width: auto;
        order: 1;
      }

      .expense-actions {
        order: 2;
        opacity: 1; /* Always visible on mobile */
      }

      .expense-amount {
        order: 3;
        min-width: auto;
      }

      .expense-details {
        order: 4;
        width: 100%;
        margin-top: 8px;
      }
    }
  `],
})
export class ExpenseRowComponent {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  expense = input.required<ExpenseDto>();
  workOrder = input<WorkOrderDto | undefined>();

  // Output: Edit clicked (AC-3.2.1)
  edit = output<string>();

  // Output: Delete icon clicked (AC-3.3.1)
  delete = output<string>();

  /**
   * Format date as "Nov 28, 2025"
   * Uses formatDateShort utility for correct timezone handling
   */
  protected formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  /**
   * Handle edit button click (AC-3.2.1)
   */
  protected onEditClick(): void {
    this.edit.emit(this.expense().id);
  }

  /**
   * Handle delete button click (AC-3.3.1)
   * Emits to show modal confirmation
   */
  protected onDeleteClick(): void {
    this.delete.emit(this.expense().id);
  }

  /**
   * Navigate to work order detail page (AC-11.4.1, AC-11.4.2)
   */
  protected navigateToWorkOrder(event: Event): void {
    event.stopPropagation();
    const workOrderId = this.expense().workOrderId;
    if (workOrderId) {
      this.router.navigate(['/work-orders', workOrderId]);
    }
  }

  /**
   * Truncate work order description to ~50 chars (AC-11.4.1)
   */
  protected truncateWoDescription(description: string): string {
    const maxLength = 50;
    return description.length > maxLength
      ? description.substring(0, maxLength) + '...'
      : description;
  }

  /**
   * View the attached receipt image in lightbox dialog (AC-5.5.1)
   */
  protected viewReceipt(event: Event): void {
    event.stopPropagation();

    const receiptId = this.expense().receiptId;
    if (!receiptId) return;

    this.dialog.open<ReceiptLightboxDialogComponent, ReceiptLightboxDialogData>(
      ReceiptLightboxDialogComponent,
      {
        data: { receiptId },
        width: '90vw',
        maxWidth: '1400px',
        height: '90vh',
        panelClass: 'receipt-lightbox-panel',
      }
    );
  }
}
