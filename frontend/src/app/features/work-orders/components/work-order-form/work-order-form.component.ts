import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Router } from '@angular/router';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { PropertyService, PropertySummaryDto } from '../../../properties/services/property.service';
import { ExpenseStore } from '../../../expenses/stores/expense.store';
import { WorkOrderStore } from '../../stores/work-order.store';
import { WorkOrderStatus, WorkOrderTagDto } from '../../services/work-order.service';
import { VendorStore } from '../../../vendors/stores/vendor.store';
import { VendorDto } from '../../../../core/api/api.service';

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
    MatChipsModule,
    MatAutocompleteModule,
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

          <!-- Assigned To Field (Story 9-4 AC #6, #7, #8, #9, #10) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Assigned To</mat-label>
            @if (vendorStore.isLoading()) {
              <mat-select disabled>
                <mat-option>Loading...</mat-option>
              </mat-select>
            } @else if (vendorStore.error()) {
              <mat-select formControlName="vendorId">
                <mat-option [value]="null">
                  <mat-icon>person</mat-icon> Self (DIY)
                </mat-option>
              </mat-select>
              <mat-error>Failed to load vendors. DIY only available.</mat-error>
            } @else {
              <mat-select formControlName="vendorId" (selectionChange)="onVendorChange($event.value)">
                <mat-option [value]="null">
                  <mat-icon>person</mat-icon> Self (DIY)
                </mat-option>
                @for (vendor of vendorStore.vendors(); track vendor.id) {
                  <mat-option [value]="vendor.id">
                    {{ vendor.fullName }}
                    @if (vendor.tradeTags?.length) {
                      <span class="vendor-trades"> - {{ formatTradeTags(vendor.tradeTags!) }}</span>
                    }
                  </mat-option>
                }
              </mat-select>
            }
            <mat-hint>Select a vendor or leave as DIY</mat-hint>
          </mat-form-field>

          <!-- Tags Field (AC #8, #9, #10, #11) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tags (optional)</mat-label>
            @if (workOrderStore.isLoadingTags()) {
              <mat-select disabled>
                <mat-option>Loading...</mat-option>
              </mat-select>
            } @else {
              <mat-chip-grid #chipGrid>
                @for (tag of selectedTags(); track tag.id) {
                  <mat-chip-row (removed)="removeTag(tag)">
                    {{ tag.name }}
                    <button matChipRemove>
                      <mat-icon>cancel</mat-icon>
                    </button>
                  </mat-chip-row>
                }
              </mat-chip-grid>
              <input
                placeholder="Add tags..."
                #tagInput
                [formControl]="tagInputControl"
                [matChipInputFor]="chipGrid"
                [matAutocomplete]="auto"
                [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                (matChipInputTokenEnd)="addTag($event)"
              />
              <mat-autocomplete
                #auto="matAutocomplete"
                (optionSelected)="selectTag($event)"
              >
                @for (tag of filteredTags(); track tag.id) {
                  <mat-option [value]="tag">{{ tag.name }}</mat-option>
                }
                @if (tagInputControl.value && canCreateNewTag()) {
                  <mat-option [value]="{ id: 'new', name: tagInputControl.value }" class="create-new-tag">
                    <mat-icon>add</mat-icon> Create "{{ tagInputControl.value }}"
                  </mat-option>
                }
              </mat-autocomplete>
            }
            <mat-hint>Type to search or create new tags</mat-hint>
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

      mat-chip-row {
        margin: 2px 4px 2px 0;
      }

      .create-new-tag {
        font-style: italic;
        color: var(--mdc-theme-primary);
      }

      .create-new-tag mat-icon {
        vertical-align: middle;
        margin-right: 4px;
      }

      .vendor-trades {
        color: var(--mdc-theme-text-secondary-on-background, rgba(0, 0, 0, 0.6));
        font-size: 0.85em;
      }
    `,
  ],
})
export class WorkOrderFormComponent implements OnInit, OnDestroy {
  protected readonly workOrderStore = inject(WorkOrderStore);
  protected readonly expenseStore = inject(ExpenseStore);
  protected readonly vendorStore = inject(VendorStore);
  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly router = inject(Router);

  // Input: Pre-selected property ID (when navigating from property page)
  preSelectedPropertyId = input<string | null>(null);

  // Local state
  protected readonly properties = signal<PropertySummaryDto[]>([]);
  protected readonly isLoadingProperties = signal(true);
  private destroyed = false;

  // Tag input state (AC #8, #9, #10, #11)
  protected readonly selectedTags = signal<WorkOrderTagDto[]>([]);
  protected readonly tagInputControl = new FormControl('');
  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;

  protected form: FormGroup = this.fb.group({
    propertyId: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    categoryId: [null as string | null],
    status: [WorkOrderStatus.Reported],
    vendorId: [null as string | null],
  });

  /**
   * Filtered tags for autocomplete (AC #9)
   * Excludes already selected tags and filters by input text
   */
  protected readonly filteredTags = computed(() => {
    const input = (this.tagInputControl.value || '').toLowerCase().trim();
    const selected = this.selectedTags();
    const allTags = this.workOrderStore.tags();

    return allTags.filter(
      (tag) =>
        !selected.some((s) => s.id === tag.id) &&
        (!input || tag.name.toLowerCase().includes(input))
    );
  });

  /**
   * Check if user can create a new tag (AC #10)
   * True if input doesn't match any existing tag name (case-insensitive)
   */
  protected readonly canCreateNewTag = computed(() => {
    const input = (this.tagInputControl.value || '').trim();
    if (!input) return false;

    const allTags = this.workOrderStore.tags();
    return !allTags.some((tag) => tag.name.toLowerCase() === input.toLowerCase());
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

    // Load tags (AC #8)
    this.workOrderStore.loadTags();

    // Load vendors for assignment dropdown (Story 9-4 AC #6)
    this.vendorStore.loadVendors();
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

    const { propertyId, description, categoryId, status, vendorId } = this.form.value;
    const tagIds = this.selectedTags().map((tag) => tag.id);

    this.workOrderStore.createWorkOrder({
      propertyId,
      description: description.trim(),
      categoryId: categoryId || undefined,
      status,
      vendorId: vendorId || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
    });
  }

  protected onCancel(): void {
    this.router.navigate(['/work-orders']);
  }

  /**
   * Handle vendor selection change (Story 9-4 AC #10)
   * Auto-updates status to "Assigned" when a vendor is selected and status is "Reported"
   */
  protected onVendorChange(vendorId: string | null): void {
    const currentStatus = this.form.get('status')?.value;

    // Auto-update status to "Assigned" if vendor selected and status is "Reported"
    if (vendorId && currentStatus === WorkOrderStatus.Reported) {
      this.form.patchValue({ status: WorkOrderStatus.Assigned });
    }
  }

  /**
   * Format vendor trade tags for display (Story 9-4 AC #9)
   */
  protected formatTradeTags(tradeTags: { name?: string }[]): string {
    return tradeTags.map((t) => t.name).filter(Boolean).join(', ');
  }

  /**
   * Remove a tag from selection (AC #11)
   */
  protected removeTag(tag: WorkOrderTagDto): void {
    this.selectedTags.update((tags) => tags.filter((t) => t.id !== tag.id));
  }

  /**
   * Add a tag from chip input (AC #10 - create new)
   */
  protected async addTag(event: { value: string; chipInput: { clear: () => void } }): Promise<void> {
    const value = (event.value || '').trim();
    if (!value) return;

    // Check if this matches an existing tag
    const existingTag = this.workOrderStore
      .tags()
      .find((t) => t.name.toLowerCase() === value.toLowerCase());

    if (existingTag) {
      // Select the existing tag if not already selected
      if (!this.selectedTags().some((t) => t.id === existingTag.id)) {
        this.selectedTags.update((tags) => [...tags, existingTag]);
      }
    } else {
      // Create a new tag
      const newId = await this.workOrderStore.createTag(value);
      if (newId) {
        this.selectedTags.update((tags) => [...tags, { id: newId, name: value }]);
      }
    }

    // Clear the input
    event.chipInput.clear();
    this.tagInputControl.setValue('');
  }

  /**
   * Select a tag from autocomplete (AC #9)
   */
  protected async selectTag(event: MatAutocompleteSelectedEvent): Promise<void> {
    const tag = event.option.value as WorkOrderTagDto;

    if (tag.id === 'new') {
      // Create a new tag
      const newId = await this.workOrderStore.createTag(tag.name);
      if (newId) {
        this.selectedTags.update((tags) => [...tags, { id: newId, name: tag.name }]);
      }
    } else {
      // Add existing tag if not already selected
      if (!this.selectedTags().some((t) => t.id === tag.id)) {
        this.selectedTags.update((tags) => [...tags, tag]);
      }
    }

    // Clear the input
    this.tagInputControl.setValue('');
  }
}
