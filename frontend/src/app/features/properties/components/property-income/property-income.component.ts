import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IncomeService, IncomeDto } from '../../../income/services/income.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { formatDateShort } from '../../../../shared/utils/date.utils';

/**
 * PropertyIncomeComponent (Story 16-10 AC #1, #2, #3)
 *
 * Displays income for a specific property on the property detail page.
 * Features:
 * - Table with columns: Date, Source, Description, Amount, Actions
 * - Edit and delete action icons per row
 * - Loading, error, and empty states
 * - Consistent styling with main income page
 */
@Component({
  selector: 'app-property-income',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <mat-card class="activity-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>payments</mat-icon>
          Income
          @if (!isLoading() && !error()) {
            ({{ totalCount() }})
          }
        </mat-card-title>
        <button
          mat-stroked-button
          color="primary"
          (click)="addClick.emit()"
          class="add-income-btn">
          <mat-icon>add</mat-icon>
          Add Income
        </button>
      </mat-card-header>
      <mat-card-content>
        <!-- Loading State -->
        @if (isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        }

        <!-- Error State -->
        @if (!isLoading() && error()) {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <button mat-stroked-button (click)="loadIncome()">
              <mat-icon>refresh</mat-icon>
              Retry
            </button>
          </div>
        }

        <!-- Empty State -->
        @if (!isLoading() && !error() && incomeEntries().length === 0) {
          <div class="empty-state">
            <mat-icon>payments</mat-icon>
            <p>No income recorded yet</p>
            <p class="empty-hint">Add your first income entry</p>
          </div>
        }

        <!-- Income Table -->
        @if (!isLoading() && !error() && incomeEntries().length > 0) {
          <div class="list-header">
            <div class="header-date">Date</div>
            <div class="header-source">Source</div>
            <div class="header-description">Description</div>
            <div class="header-amount">Amount</div>
            <div class="header-actions">Actions</div>
          </div>

          @for (income of incomeEntries(); track income.id) {
            <div class="income-row" (click)="navigateToDetail(income)">
              <div class="cell-date">{{ formatDate(income.date) }}</div>
              <div class="cell-source">{{ income.source || '\u2014' }}</div>
              <div class="cell-description">{{ income.description || '\u2014' }}</div>
              <div class="cell-amount">{{ income.amount | currency }}</div>
              <div class="cell-actions" (click)="$event.stopPropagation()">
                <button mat-icon-button matTooltip="Edit" (click)="navigateToDetail(income)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDeleteIncome(income)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }

          <!-- View all income link -->
          @if (totalCount() > 5) {
            <div class="view-all">
              <a mat-button color="primary" (click)="navigateToAllIncome()">
                View all {{ totalCount() }} income entries
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .activity-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;

          mat-icon {
            color: var(--pm-primary);
          }
        }

        .add-income-btn mat-icon {
          margin-right: 4px;
        }
      }
    }

    .loading-state {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .error-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--pm-text-secondary);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--pm-error, #c62828);
        margin-bottom: 12px;
      }

      p {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: var(--pm-error, #c62828);
      }

      button mat-icon {
        margin-right: 4px;
      }
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

      .empty-hint {
        margin-top: 4px;
        font-size: 13px;
        opacity: 0.8;
      }
    }

    .list-header {
      display: grid;
      grid-template-columns: 100px 1fr 1fr 120px 80px;
      gap: 16px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container);
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      font-weight: 500;
      font-size: 0.85em;
      color: var(--mat-sys-on-surface-variant);
    }

    .header-amount {
      text-align: right;
    }

    .header-actions {
      text-align: center;
    }

    .income-row {
      display: grid;
      grid-template-columns: 100px 1fr 1fr 120px 80px;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      transition: background-color 0.2s ease;
      cursor: pointer;
      align-items: center;

      &:hover {
        background-color: var(--mat-sys-surface-container-low);
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .cell-actions {
      display: flex;
      justify-content: center;
      gap: 0;
    }

    .cell-date {
      font-size: 0.9em;
      color: var(--mat-sys-on-surface-variant);
    }

    .cell-source, .cell-description {
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell-amount {
      text-align: right;
      font-weight: 600;
      color: var(--mat-sys-primary);
    }

    .view-all {
      margin-top: 12px;
      text-align: center;
      border-top: 1px solid var(--pm-border, #e0e0e0);
      padding-top: 12px;

      a {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    @media (max-width: 768px) {
      .list-header {
        display: none;
      }

      .income-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
      }

      .cell-date {
        order: 1;
      }

      .cell-amount {
        order: 2;
        text-align: left;
        font-size: 1.2em;
      }

      .cell-source {
        order: 3;
      }

      .cell-description {
        order: 4;
      }

      .cell-actions {
        order: 5;
      }
    }
  `],
})
export class PropertyIncomeComponent implements OnInit {
  readonly propertyId = input.required<string>();
  readonly addClick = output<void>();

  private readonly incomeService = inject(IncomeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly incomeEntries = signal<IncomeDto[]>([]);
  readonly totalCount = signal(0);
  readonly ytdTotal = signal(0);

  ngOnInit(): void {
    this.loadIncome();
  }

  loadIncome(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.incomeService.getIncomeByProperty(this.propertyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.incomeEntries.set(response.items);
          this.totalCount.set(response.totalCount);
          this.ytdTotal.set(response.ytdTotal);
          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('Failed to load income');
          this.isLoading.set(false);
        },
      });
  }

  navigateToDetail(income: IncomeDto): void {
    this.router.navigate(['/income', income.id]);
  }

  onDeleteIncome(income: IncomeDto): void {
    const dialogData: ConfirmDialogData = {
      title: 'Delete Income?',
      message: `Delete income of ${income.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} from ${this.formatDate(income.date)}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
      iconColor: 'warn',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data: dialogData, width: '400px', disableClose: true })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.incomeService.deleteIncome(income.id).subscribe({
            next: () => {
              this.snackBar.open('Income deleted', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
              this.loadIncome();
            },
            error: () => {
              this.snackBar.open('Failed to delete income. Please try again.', 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
              });
            },
          });
        }
      });
  }

  formatDate(date: string): string {
    return formatDateShort(date);
  }

  navigateToAllIncome(): void {
    this.router.navigate(['/income']);
  }
}
