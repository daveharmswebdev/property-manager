import { Component, inject, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseListItemDto } from '../../services/expense.service';
import {
  ReceiptLightboxDialogComponent,
  ReceiptLightboxDialogData,
} from '../../../receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component';
import { formatDateShort } from '../../../../shared/utils/date.utils';

/**
 * ExpenseListRowComponent (AC-3.4.2)
 *
 * Displays a single expense in the all-expenses list with:
 * - Date (formatted as "Dec 08, 2025")
 * - Property name (for context across all properties)
 * - Description (truncated if too long)
 * - Category (as colored chip/tag)
 * - Amount (right-aligned with currency formatting)
 * - Receipt indicator icon (placeholder for Epic 5)
 * - Clickable row to navigate to expense workspace
 */
@Component({
  selector: 'app-expense-list-row',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    CurrencyPipe,
  ],
  template: `
    <div class="expense-list-row" (click)="navigateToExpense()">
      <!-- Date (AC-3.4.2) -->
      <div class="expense-date">
        {{ formatDate(expense().date) }}
      </div>

      <!-- Property Name (AC-3.4.2) -->
      <div class="expense-property">
        {{ expense().propertyName }}
      </div>

      <!-- Description (AC-3.4.2) -->
      <div class="expense-description" [matTooltip]="expense().description || ''" matTooltipPosition="above">
        {{ truncateDescription(expense().description) }}
      </div>

      <!-- Category Chip (AC-3.4.2) -->
      <div class="expense-category">
        <mat-chip-set>
          <mat-chip class="category-chip">{{ expense().categoryName }}</mat-chip>
        </mat-chip-set>
      </div>

      <!-- Receipt Indicator (AC-3.4.2, AC-5.4) -->
      <div class="expense-receipt">
        @if (expense().receiptId) {
          <mat-icon
            matTooltip="View receipt"
            class="receipt-link"
            (click)="viewReceipt($event)"
          >receipt</mat-icon>
        }
      </div>

      <!-- Work Order Indicator (AC-11.4.4, AC-11.6.7) -->
      <div class="expense-work-order">
        @if (expense().workOrderId) {
          <mat-icon
            matTooltip="Linked to work order"
            class="work-order-link"
            role="link"
            tabindex="0"
            (click)="navigateToWorkOrder($event)"
            (keydown.enter)="navigateToWorkOrder($event)"
            data-testid="work-order-indicator"
          >assignment</mat-icon>
        } @else {
          <mat-icon
            matTooltip="Create work order"
            class="create-wo-link"
            role="button"
            tabindex="0"
            (click)="onCreateWorkOrder($event)"
            (keydown.enter)="onCreateWorkOrder($event)"
            data-testid="create-work-order-button"
          >add_task</mat-icon>
        }
      </div>

      <!-- Amount (AC-3.4.2) -->
      <div class="expense-amount">
        {{ expense().amount | currency }}
      </div>
    </div>
  `,
  styles: [`
    .expense-list-row {
      display: grid;
      grid-template-columns: 100px 150px 1fr auto 40px 40px 100px;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      gap: 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .expense-list-row:hover {
      background-color: var(--mat-sys-surface-container-low);
    }

    .expense-list-row:last-child {
      border-bottom: none;
    }

    .expense-date {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }

    .expense-property {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .expense-description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--mat-sys-on-surface);
    }

    .expense-category {
      mat-chip {
        font-size: 0.8em;
        min-height: 24px;
        padding: 0 8px;
      }
    }

    .category-chip {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    .expense-receipt {
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-on-surface-variant);
      }

      .receipt-link {
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: var(--mat-sys-primary);
        }
      }
    }

    .expense-work-order {
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-on-surface-variant);
      }

      .work-order-link {
        cursor: pointer;
        transition: color 0.2s ease;
        &:hover {
          color: var(--mat-sys-primary);
        }
      }

      .create-wo-link {
        cursor: pointer;
        color: var(--mat-sys-on-surface-variant);
        transition: color 0.2s ease;
        &:hover {
          color: var(--mat-sys-primary);
        }
      }
    }

    .expense-amount {
      font-weight: 600;
      font-size: 1em;
      text-align: right;
      color: var(--mat-sys-on-surface);
    }

    @media (max-width: 768px) {
      .expense-list-row {
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto auto;
        gap: 4px 16px;
        padding: 12px 16px;
      }

      .expense-date {
        grid-column: 1;
        grid-row: 1;
      }

      .expense-amount {
        grid-column: 2;
        grid-row: 1;
      }

      .expense-property {
        grid-column: 1 / -1;
        grid-row: 2;
        font-weight: 500;
      }

      .expense-description {
        grid-column: 1 / -1;
        grid-row: 3;
        font-size: 0.9em;
        color: var(--mat-sys-on-surface-variant);
      }

      .expense-category {
        display: none;
      }

      .expense-receipt {
        display: none;
      }

      .expense-work-order {
        display: none;
      }
    }
  `],
})
export class ExpenseListRowComponent {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  expense = input.required<ExpenseListItemDto>();

  // Output: Create work order from this expense (AC-11.6.7)
  createWorkOrder = output<ExpenseListItemDto>();

  /**
   * Format date as "Dec 08, 2025" (AC-3.4.2)
   * Uses formatDateShort utility for correct timezone handling
   */
  formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  /**
   * Truncate long descriptions with ellipsis (AC-3.4.2)
   */
  truncateDescription(description?: string): string {
    if (!description) return 'No description';
    const maxLength = 50;
    return description.length > maxLength
      ? description.substring(0, maxLength) + '...'
      : description;
  }

  /**
   * Navigate to expense detail page (AC-15.5.1)
   */
  navigateToExpense(): void {
    this.router.navigate(['/expenses', this.expense().id]);
  }

  /**
   * Handle create work order click (AC-11.6.7)
   */
  onCreateWorkOrder(event: Event): void {
    event.stopPropagation();
    this.createWorkOrder.emit(this.expense());
  }

  /**
   * Navigate to work order detail page (AC-11.4.4)
   */
  protected navigateToWorkOrder(event: Event): void {
    event.stopPropagation();
    const workOrderId = this.expense().workOrderId;
    if (workOrderId) {
      this.router.navigate(['/work-orders', workOrderId]);
    }
  }

  /**
   * View the attached receipt image in lightbox dialog (AC-5.5.1, AC-5.5.2)
   */
  viewReceipt(event: Event): void {
    event.stopPropagation(); // Prevent row click navigation

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
