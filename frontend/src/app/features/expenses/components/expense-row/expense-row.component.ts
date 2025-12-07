import { Component, input } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ExpenseDto } from '../../services/expense.service';

/**
 * ExpenseRowComponent (AC-3.1.7)
 *
 * Displays a single expense in the expense list with:
 * - Date (formatted as "Nov 28, 2025")
 * - Description
 * - Category (as chip/tag)
 * - Amount (formatted as currency)
 */
@Component({
  selector: 'app-expense-row',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
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
        </div>
        <mat-chip-set class="expense-category">
          <mat-chip>{{ expense().categoryName }}</mat-chip>
        </mat-chip-set>
      </div>
      <div class="expense-amount">
        {{ expense().amount | currency }}
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

    @media (max-width: 600px) {
      .expense-row {
        flex-wrap: wrap;
      }

      .expense-date {
        min-width: auto;
        order: 1;
      }

      .expense-amount {
        order: 2;
        min-width: auto;
      }

      .expense-details {
        order: 3;
        width: 100%;
        margin-top: 8px;
      }
    }
  `],
})
export class ExpenseRowComponent {
  expense = input.required<ExpenseDto>();

  /**
   * Format date as "Nov 28, 2025"
   */
  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
