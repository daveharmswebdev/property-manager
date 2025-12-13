import { Component, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IncomeDto } from '../../services/income.service';

/**
 * IncomeRowComponent (AC-4.1.6)
 *
 * Displays a single income entry in the income list with:
 * - Date (formatted as "Jan 15, 2025")
 * - Amount (formatted as currency $1,500.00)
 * - Source (if present)
 * - Description (if present)
 * - Edit/Delete buttons (disabled, prepared for Story 4.2)
 */
@Component({
  selector: 'app-income-row',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    CurrencyPipe,
  ],
  template: `
    <div class="income-row">
      <div class="income-date">
        {{ formatDate(income().date) }}
      </div>
      <div class="income-details">
        @if (income().source) {
          <div class="income-source">
            {{ income().source }}
          </div>
        }
        @if (income().description) {
          <div class="income-description">
            {{ income().description }}
          </div>
        }
        @if (!income().source && !income().description) {
          <div class="income-no-details">
            —
          </div>
        }
      </div>
      <div class="income-amount">
        {{ income().amount | currency }}
      </div>
      <!-- Edit and Delete Actions (prepared for Story 4.2) -->
      <div class="income-actions">
        <button
          mat-icon-button
          (click)="onEditClick()"
          matTooltip="Edit income (coming soon)"
          class="edit-button"
          [disabled]="true"
        >
          <mat-icon>edit</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="onDeleteClick()"
          matTooltip="Delete income (coming soon)"
          class="delete-button"
          [disabled]="true"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .income-row {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      gap: 16px;
      transition: background-color 0.2s ease;
    }

    .income-row:hover {
      background-color: var(--mat-sys-surface-container-low);
    }

    .income-row:last-child {
      border-bottom: none;
    }

    .income-date {
      min-width: 100px;
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    .income-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .income-source {
      font-weight: 500;
    }

    .income-description {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    .income-no-details {
      color: var(--mat-sys-on-surface-variant);
    }

    .income-amount {
      font-weight: 600;
      font-size: 1.1em;
      min-width: 100px;
      text-align: right;
      color: var(--mat-sys-primary);
    }

    .income-actions {
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .income-row:hover .income-actions {
      opacity: 1;
    }

    .edit-button,
    .delete-button {
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 600px) {
      .income-row {
        flex-wrap: wrap;
      }

      .income-date {
        min-width: auto;
        order: 1;
      }

      .income-actions {
        order: 2;
        opacity: 1; /* Always visible on mobile */
      }

      .income-amount {
        order: 3;
        min-width: auto;
      }

      .income-details {
        order: 4;
        width: 100%;
        margin-top: 8px;
      }
    }
  `],
})
export class IncomeRowComponent {
  income = input.required<IncomeDto>();

  // Output: Edit clicked (prepared for Story 4.2)
  edit = output<string>();

  // Output: Delete icon clicked (prepared for Story 4.2)
  delete = output<string>();

  /**
   * Format date as "Jan 15, 2025" (AC-4.1.6)
   */
  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Handle edit button click (prepared for Story 4.2)
   */
  protected onEditClick(): void {
    this.edit.emit(this.income().id);
  }

  /**
   * Handle delete button click (prepared for Story 4.2)
   */
  protected onDeleteClick(): void {
    this.delete.emit(this.income().id);
  }
}
