import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExpenseService, ExpenseDto } from '../../../expenses/services/expense.service';

export interface LinkExpenseDialogData {
  propertyId: string;
  workOrderId: string;
}

@Component({
  selector: 'app-link-expense-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Link Existing Expense</h2>
    <mat-dialog-content>
      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="32"></mat-spinner>
          <p>Loading expenses...</p>
        </div>
      } @else if (unlinkedExpenses().length === 0 && !searchTerm()) {
        <div class="empty-state">
          <mat-icon>receipt_long</mat-icon>
          <p>No unlinked expenses available for this property</p>
        </div>
      } @else {
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search by description</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Filter expenses...">
        </mat-form-field>

        @if (filteredExpenses().length === 0) {
          <div class="empty-state">
            <p>No matching expenses found</p>
          </div>
        } @else {
          <mat-nav-list class="expense-list">
            @for (expense of filteredExpenses(); track expense.id) {
              <mat-list-item (click)="selectExpense(expense.id)" class="expense-option">
                <div class="expense-row">
                  <div class="expense-info">
                    <span class="expense-date">{{ expense.date | date:'mediumDate' }}</span>
                    <span class="expense-description">{{ expense.description || 'No description' }}</span>
                    <span class="expense-category">{{ expense.categoryName }}</span>
                  </div>
                  <span class="expense-amount">{{ expense.amount | currency:'USD' }}</span>
                </div>
              </mat-list-item>
            }
          </mat-nav-list>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-height: 200px;
      max-height: 400px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      gap: 12px;
      color: var(--mat-sys-outline);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      text-align: center;
      color: var(--mat-sys-outline);
    }

    .empty-state mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .search-field {
      width: 100%;
      margin-bottom: 8px;
    }

    .expense-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .expense-option {
      cursor: pointer;
    }

    .expense-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 12px;
    }

    .expense-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .expense-date {
      font-size: 12px;
      color: var(--mat-sys-outline);
    }

    .expense-description {
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .expense-category {
      font-size: 12px;
      color: var(--mat-sys-outline);
    }

    .expense-amount {
      font-weight: 500;
      white-space: nowrap;
    }
  `],
})
export class LinkExpenseDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LinkExpenseDialogComponent>);
  private readonly data: LinkExpenseDialogData = inject(MAT_DIALOG_DATA);
  private readonly expenseService = inject(ExpenseService);

  readonly isLoading = signal(false);
  readonly searchTerm = signal('');
  readonly unlinkedExpenses = signal<ExpenseDto[]>([]);

  readonly filteredExpenses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const expenses = this.unlinkedExpenses();
    if (!term) return expenses;
    return expenses.filter(e =>
      (e.description || '').toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    this.expenseService.getExpensesByProperty(this.data.propertyId, undefined, 1, 500).subscribe({
      next: (response) => {
        const unlinked = response.items
          .filter(e => !e.workOrderId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.unlinkedExpenses.set(unlinked);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  selectExpense(expenseId: string): void {
    this.dialogRef.close(expenseId);
  }
}
