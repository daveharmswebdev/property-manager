import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

/**
 * Shared ListTotalDisplayComponent (AC-16.6.2)
 *
 * Presentation component — displays a formatted label + currency amount.
 * Zero logic. Used by Income and Expenses list views.
 */
@Component({
  selector: 'app-list-total-display',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="list-total" [class.with-border]="showBorder()">
      <span class="total-label">{{ label() }}:</span>
      <span class="total-amount">{{ amount() | currency }}</span>
    </div>
  `,
  styles: [`
    .list-total {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .list-total.with-border {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .total-label {
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }

    .total-amount {
      font-size: 1.25em;
      font-weight: 600;
      color: var(--mat-sys-primary);
    }
  `],
})
export class ListTotalDisplayComponent {
  label = input.required<string>();
  amount = input<number>(0);
  showBorder = input<boolean>(false);
}
