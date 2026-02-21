import { Component, inject, OnInit, OnDestroy, signal, DestroyRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IncomeDetailStore } from '../stores/income-detail.store';
import { UpdateIncomeRequest } from '../services/income.service';
import {
  PropertyService,
  PropertySummaryDto,
} from '../../properties/services/property.service';
import { CurrencyInputDirective } from '../../../shared/directives/currency-input.directive';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { formatDateShort, formatLocalDate } from '../../../shared/utils/date.utils';

@Component({
  selector: 'app-income-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    CurrencyPipe,
    CurrencyInputDirective,
  ],
  providers: [CurrencyPipe],
  template: `
    <div class="income-detail-container">
      <!-- Loading State -->
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading income...</p>
        </div>
      }

      <!-- Error State -->
      @if (!store.isLoading() && store.error()) {
        <div class="error-container">
          <mat-icon>error_outline</mat-icon>
          <p>{{ store.error() }}</p>
          <a routerLink="/income">Back to Income</a>
        </div>
      }

      <!-- Income Content -->
      @if (!store.isLoading() && store.income() && !store.error()) {
        <!-- Header -->
        <header class="detail-header">
          <div class="header-content">
            <a routerLink="/income" class="back-link">
              <mat-icon>arrow_back</mat-icon>
              Back to Income
            </a>
          </div>
        </header>

        <!-- VIEW MODE -->
        @if (store.isViewMode()) {
          <div class="view-mode">
            <div class="action-bar">
              <button mat-stroked-button color="primary" (click)="onEdit()">
                <mat-icon>edit</mat-icon>
                Edit
              </button>
              <button
                mat-stroked-button
                color="warn"
                (click)="onDelete()"
                [disabled]="store.isDeleting()"
              >
                @if (store.isDeleting()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>delete</mat-icon>
                }
                Delete
              </button>
            </div>

            <mat-card class="detail-card">
              <mat-card-content>
                <div class="detail-grid">
                  <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value" data-testid="income-amount">
                      {{ store.income()!.amount | currency }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value" data-testid="income-date">
                      {{ formatDate(store.income()!.date) }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Source</span>
                    <span class="detail-value" data-testid="income-source">
                      {{ store.income()!.source || 'No source' }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value" data-testid="income-description">
                      {{ store.income()!.description || 'No description' }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Property</span>
                    <span class="detail-value" data-testid="income-property">
                      {{ store.income()!.propertyName }}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value" data-testid="income-created-date">
                      {{ formatDate(store.income()!.createdAt) }}
                    </span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        }

        <!-- EDIT MODE -->
        @if (store.isEditing()) {
          <form [formGroup]="editForm" (ngSubmit)="onSubmit()" class="edit-form">
            <mat-card class="detail-card">
              <mat-card-content>
                <div class="form-fields">
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="amount-field">
                      <mat-label>Amount</mat-label>
                      <span matPrefix>$ </span>
                      <input
                        matInput
                        appCurrencyInput
                        formControlName="amount"
                        placeholder="0.00"
                      />
                      @if (editForm.get('amount')?.hasError('required') && editForm.get('amount')?.touched) {
                        <mat-error>Amount is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="date-field">
                      <mat-label>Date</mat-label>
                      <input
                        matInput
                        [matDatepicker]="picker"
                        formControlName="date"
                        [max]="today"
                      />
                      <mat-datepicker-toggle matIconSuffix [for]="picker" />
                      <mat-datepicker #picker />
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Source (optional)</mat-label>
                    <input
                      matInput
                      formControlName="source"
                      maxlength="200"
                    />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description (optional)</mat-label>
                    <textarea
                      matInput
                      formControlName="description"
                      rows="3"
                      maxlength="500"
                    ></textarea>
                    <mat-hint align="end">{{ editForm.get('description')?.value?.length || 0 }} / 500</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Property</mat-label>
                    <mat-select formControlName="propertyId">
                      @for (prop of properties(); track prop.id) {
                        <mat-option [value]="prop.id">{{ prop.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </mat-card-content>
            </mat-card>

            <div class="form-actions">
              <button mat-button type="button" (click)="onCancel()">
                Cancel
              </button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!editForm.valid || store.isUpdating()"
              >
                @if (store.isUpdating()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Save
              </button>
            </div>
          </form>
        }
      }
    </div>
  `,
  styles: [`
    .income-detail-container {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .error-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-error);
    }

    .detail-header {
      margin-bottom: 24px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .action-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    .detail-card {
      margin-bottom: 16px;
    }

    .detail-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .detail-row {
      display: flex;
      gap: 16px;
    }

    .detail-label {
      min-width: 100px;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .detail-value {
      color: var(--mat-sys-on-surface);
    }

    /* Edit mode */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .amount-field {
      flex: 1;
    }

    .date-field {
      flex: 1;
    }

    .full-width {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    @media (max-width: 600px) {
      .income-detail-container {
        padding: 16px;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .action-bar {
        flex-wrap: wrap;
      }
    }
  `],
})
export class IncomeDetailComponent implements OnInit, OnDestroy {
  protected readonly store = inject(IncomeDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyPipe = inject(CurrencyPipe);

  protected readonly today = new Date();
  protected readonly properties = signal<PropertySummaryDto[]>([]);

  protected editForm: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [null, [Validators.required]],
    source: [''],
    description: ['', [Validators.maxLength(500)]],
    propertyId: ['', [Validators.required]],
  });

  private incomeId: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.incomeId) {
        this.incomeId = id;
        this.store.loadIncome(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  protected formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }

  protected onEdit(): void {
    this.store.startEditing();
    this.populateEditForm();
    this.loadProperties();
  }

  protected onCancel(): void {
    this.store.cancelEditing();
  }

  protected onSubmit(): void {
    if (!this.editForm.valid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { amount, date, source, description, propertyId } = this.editForm.value;
    const formattedDate = this.formatDateForApi(date);

    const request: UpdateIncomeRequest = {
      amount,
      date: formattedDate,
      source: source?.trim() || undefined,
      description: description?.trim() || undefined,
      propertyId,
    };

    this.store.updateIncome({ incomeId: this.incomeId!, request });
  }

  protected onDelete(): void {
    const income = this.store.income()!;
    const dialogData: ConfirmDialogData = {
      title: 'Delete Income?',
      message: 'This income entry will be permanently removed.',
      secondaryMessage: `${this.currencyPipe.transform(income.amount, 'USD') ?? income.amount} on ${this.formatDate(income.date)}`,
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
          this.store.deleteIncome(this.incomeId!);
        }
      });
  }

  private populateEditForm(): void {
    const income = this.store.income();
    if (!income) return;

    const dateParts = income.date.split('T')[0].split('-');
    const dateValue = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );

    this.editForm.patchValue({
      amount: income.amount,
      date: dateValue,
      source: income.source || '',
      description: income.description || '',
      propertyId: income.propertyId,
    });
  }

  private loadProperties(): void {
    this.propertyService.getProperties().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => this.properties.set(response.items),
      error: () => {
        this.snackBar.open('Failed to load properties', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  private formatDateForApi(date: Date): string {
    return formatLocalDate(date);
  }
}
