import { Component, computed, effect, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { PropertyService, PropertySummaryDto } from '../../../properties/services/property.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { WorkOrderStore } from '../../stores/work-order.store';
import { WorkOrderStatus } from '../../services/work-order.service';

/**
 * WorkOrderFormComponent (AC #6, #8, #9)
 *
 * Form for creating work orders with:
 * - Property (required, dropdown)
 * - Description (required, max 5000 chars)
 * - Category (optional, hierarchical dropdown)
 * - Status (required, defaults to Reported)
 */
@Component({
  selector: 'app-work-order-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <mat-card class="work-order-form-card">
      <mat-card-header>
        <mat-card-title>New Work Order</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="work-order-form">
          <!-- Property Field (AC #6) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Property</mat-label>
            @if (isLoadingProperties()) {
              <mat-select disabled>
                <mat-option>Loading...</mat-option>
              </mat-select>
            } @else {
              <mat-select formControlName="propertyId">
                @for (property of properties(); track property.id) {
                  <mat-option [value]="property.id">
                    {{ property.name }} - {{ property.city }}, {{ property.state }}
                  </mat-option>
                }
              </mat-select>
            }
            @if (form.get('propertyId')?.hasError('required') && form.get('propertyId')?.touched) {
              <mat-error>Property is required</mat-error>
            }
          </mat-form-field>

          <!-- Description Field -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea
              matInput
              formControlName="description"
              placeholder="Describe the maintenance issue..."
              rows="4"
              maxlength="5000"
            ></textarea>
            <mat-hint align="end">{{ form.get('description')?.value?.length || 0 }} / 5000</mat-hint>
            @if (form.get('description')?.hasError('required') && form.get('description')?.touched) {
              <mat-error>Description is required</mat-error>
            }
            @if (form.get('description')?.hasError('maxlength') && form.get('description')?.touched) {
              <mat-error>Description must be 5000 characters or less</mat-error>
            }
          </mat-form-field>

          <!-- Category Field (AC #8) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Category (optional)</mat-label>
            @if (expenseStore.isLoadingCategories()) {
              <mat-select disabled>
                <mat-option>Loading...</mat-option>
              </mat-select>
            } @else {
              <mat-select formControlName="categoryId">
                <mat-option [value]="null">-- None --</mat-option>
                @for (category of hierarchicalCategories(); track category.id) {
                  <mat-option [value]="category.id">
                    {{ category.indent }}{{ category.name }}
                  </mat-option>
                }
              </mat-select>
            }
          </mat-form-field>

          <!-- Status Field -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="Reported">Reported</mat-option>
              <mat-option value="Assigned">Assigned</mat-option>
              <mat-option value="Completed">Completed</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Form Actions -->
          <div class="form-actions">
            <button mat-button type="button" (click)="onCancel()">Cancel</button>
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="!form.valid || workOrderStore.isSaving()"
            >
              @if (workOrderStore.isSaving()) {
                <mat-spinner diameter="20" />
              } @else {
                <ng-container>
                  <mat-icon>add</mat-icon>
                  Save Work Order
                </ng-container>
              }
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .work-order-form-card {
        max-width: 600px;
        margin: 0 auto;
      }

      .work-order-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      }

      .full-width {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
      }

      .form-actions button {
        min-width: 120px;

        mat-icon {
          vertical-align: middle;
          margin-right: 4px;
        }
      }

      mat-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class WorkOrderFormComponent implements OnInit, OnDestroy {
  protected readonly workOrderStore = inject(WorkOrderStore);
  protected readonly expenseStore = inject(ExpenseStore);
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly router = inject(Router);

  // Input: Pre-selected property ID (when navigating from property page)
  preSelectedPropertyId = input<string | null>(null);

  // Local state
  protected readonly properties = signal<PropertySummaryDto[]>([]);
  protected readonly isLoadingProperties = signal(true);
  private destroyed = false;

  protected form: FormGroup = this.fb.group({
    propertyId: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    categoryId: [null as string | null],
    status: [WorkOrderStatus.Reported],
  });

  /**
   * Hierarchical categories for display (AC #8)
   * Built reactively from expenseStore.sortedCategories using computed signal
   */
  protected readonly hierarchicalCategories = computed(() => {
    const categories = this.expenseStore.sortedCategories();
    if (categories.length === 0) {
      return [];
    }

    // Build hierarchical list
    const parents = categories.filter((c) => !c.parentId);
    const children = categories.filter((c) => c.parentId);

    const hierarchical: Array<{ id: string; name: string; indent: string; parentId?: string }> = [];

    for (const parent of parents) {
      hierarchical.push({
        id: parent.id,
        name: parent.name,
        indent: '',
      });

      // Add children of this parent
      const parentChildren = children.filter((c) => c.parentId === parent.id);
      for (const child of parentChildren) {
        hierarchical.push({
          id: child.id,
          name: child.name,
          indent: '\u00A0\u00A0\u00A0\u00A0', // Non-breaking spaces for indentation
          parentId: child.parentId,
        });
      }
    }

    return hierarchical;
  });

  ngOnInit(): void {
    // Load properties
    this.loadProperties();

    // Load categories
    this.expenseStore.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private loadProperties(): void {
    this.propertyService.getProperties().subscribe({
      next: (response) => {
        if (this.destroyed) return;
        this.properties.set(response.items);
        this.isLoadingProperties.set(false);

        // Pre-select property if provided
        const preSelected = this.preSelectedPropertyId();
        if (preSelected && response.items.some((p) => p.id === preSelected)) {
          this.form.patchValue({ propertyId: preSelected });
        }
      },
      error: (error) => {
        if (this.destroyed) return;
        console.error('Error loading properties:', error);
        this.isLoadingProperties.set(false);
      },
    });
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const { propertyId, description, categoryId, status } = this.form.value;

    this.workOrderStore.createWorkOrder({
      propertyId,
      description: description.trim(),
      categoryId: categoryId || undefined,
      status,
    });
  }

  protected onCancel(): void {
    this.router.navigate(['/work-orders']);
  }
}
