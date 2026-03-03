import { Component, inject, OnInit, computed, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { PhoneMaskDirective } from '../../../../shared/directives/phone-mask.directive';
import { VendorStore } from '../../stores/vendor.store';
import { VendorTradeTagDto } from '../../../../core/api/api.service';

/**
 * Vendor Form Component (Story 17.8)
 *
 * Full-size form for creating a new vendor with all fields:
 * name, phone numbers, email addresses, and trade tags.
 */
@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatSelectModule,
    PhoneMaskDirective,
  ],
  template: `
    <div class="vendor-form-container">
      <mat-card class="vendor-form-card">
        <mat-card-header>
          <mat-card-title>Add Vendor</mat-card-title>
          <mat-card-subtitle>Enter vendor details</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Name Section -->
            <section class="form-section">
              <h3>Name</h3>
              <div class="name-row">
                <mat-form-field appearance="outline" class="name-field">
                  <mat-label>First Name</mat-label>
                  <input matInput formControlName="firstName" />
                  @if (form.get('firstName')?.hasError('required') && form.get('firstName')?.touched) {
                    <mat-error>First name is required</mat-error>
                  }
                  @if (form.get('firstName')?.hasError('maxlength')) {
                    <mat-error>First name must be 100 characters or less</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline" class="name-field">
                  <mat-label>Middle Name</mat-label>
                  <input matInput formControlName="middleName" />
                  @if (form.get('middleName')?.hasError('maxlength')) {
                    <mat-error>Middle name must be 100 characters or less</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline" class="name-field">
                  <mat-label>Last Name</mat-label>
                  <input matInput formControlName="lastName" />
                  @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
                    <mat-error>Last name is required</mat-error>
                  }
                  @if (form.get('lastName')?.hasError('maxlength')) {
                    <mat-error>Last name must be 100 characters or less</mat-error>
                  }
                </mat-form-field>
              </div>
            </section>

            <!-- Phone Numbers Section -->
            <section class="form-section">
              <div class="section-header">
                <h3>Phone Numbers</h3>
                <button mat-icon-button type="button" (click)="addPhone()" color="primary">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
              <div formArrayName="phones" class="array-items">
                @for (phone of phonesArray.controls; track phone; let i = $index) {
                  <div [formGroupName]="i" class="phone-row">
                    <mat-form-field appearance="outline" class="phone-number">
                      <mat-label>Phone Number</mat-label>
                      <input matInput appPhoneMask formControlName="number" placeholder="(512) 555-1234" />
                      @if (phone.get('number')?.hasError('required') && phone.get('number')?.touched) {
                        <mat-error>Phone number is required</mat-error>
                      }
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="phone-label">
                      <mat-label>Label</mat-label>
                      <mat-select formControlName="label">
                        <mat-option value="">None</mat-option>
                        <mat-option value="Mobile">Mobile</mat-option>
                        <mat-option value="Home">Home</mat-option>
                        <mat-option value="Work">Work</mat-option>
                        <mat-option value="Office">Office</mat-option>
                        <mat-option value="Fax">Fax</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-icon-button type="button" (click)="removePhone(i)" color="warn">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
                @if (phonesArray.length === 0) {
                  <p class="empty-message">No phone numbers added</p>
                }
              </div>
            </section>

            <!-- Email Addresses Section -->
            <section class="form-section">
              <div class="section-header">
                <h3>Email Addresses</h3>
                <button mat-icon-button type="button" (click)="addEmail()" color="primary">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
              <div formArrayName="emails" class="array-items">
                @for (email of emailsArray.controls; track email; let i = $index) {
                  <div class="email-row">
                    <mat-form-field appearance="outline" class="email-field">
                      <mat-label>Email Address</mat-label>
                      <input matInput [formControlName]="i" placeholder="vendor@example.com" />
                      @if (email.hasError('required') && email.touched) {
                        <mat-error>Email is required</mat-error>
                      }
                      @if (email.hasError('email')) {
                        <mat-error>Invalid email format</mat-error>
                      }
                    </mat-form-field>
                    <button mat-icon-button type="button" (click)="removeEmail(i)" color="warn">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
                @if (emailsArray.length === 0) {
                  <p class="empty-message">No email addresses added</p>
                }
              </div>
            </section>

            <!-- Trade Tags Section -->
            <section class="form-section">
              <h3>Trade Tags</h3>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Trade Tags</mat-label>
                <mat-chip-grid #chipGrid aria-label="Trade tag selection">
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
                  placeholder="Type to search or add tag..."
                  #tagInput
                  [formControl]="tagInputControl"
                  [matAutocomplete]="auto"
                  [matChipInputFor]="chipGrid"
                  [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                  (matChipInputTokenEnd)="addTagFromInput($event)"
                />
                <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selectTag($event)">
                  @for (tag of filteredTags(); track tag.id) {
                    <mat-option [value]="tag">{{ tag.name }}</mat-option>
                  }
                  @if (tagInputControl.value && !tagExists(tagInputControl.value)) {
                    <mat-option [value]="{ id: null, name: tagInputControl.value }" class="create-option">
                      <mat-icon>add</mat-icon> Create "{{ tagInputControl.value }}"
                    </mat-option>
                  }
                </mat-autocomplete>
                <mat-hint>Select existing tags or type to create new ones</mat-hint>
              </mat-form-field>
            </section>

            <!-- Form Actions -->
            <div class="form-actions">
              <button
                mat-button
                type="button"
                (click)="onCancel()"
                [disabled]="store.isSaving()"
              >
                Cancel
              </button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="form.invalid || store.isSaving()"
              >
                @if (store.isSaving()) {
                  <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
                  Saving...
                } @else {
                  Save
                }
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .vendor-form-container {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .vendor-form-card {
        padding: 16px;
      }

      mat-card-header {
        margin-bottom: 24px;
      }

      mat-card-title {
        font-size: 24px !important;
      }

      .form-section {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e0e0e0;
      }

      .form-section h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 500;
        color: #666;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .section-header h3 {
        margin: 0;
      }

      .name-row {
        display: flex;
        gap: 16px;
      }

      .name-field {
        flex: 1;
      }

      .phone-row, .email-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .phone-number {
        flex: 2;
      }

      .phone-label {
        flex: 1;
      }

      .email-field {
        flex: 1;
      }

      .array-items {
        margin-top: 8px;
      }

      .empty-message {
        color: #999;
        font-style: italic;
        margin: 8px 0;
      }

      .full-width {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #e0e0e0;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      ::ng-deep .button-spinner circle {
        stroke: white;
      }

      .create-option {
        color: #1976d2;
        font-weight: 500;
      }

      .create-option mat-icon {
        margin-right: 8px;
      }

      @media (max-width: 600px) {
        .name-row {
          flex-direction: column;
        }

        .phone-row {
          flex-wrap: wrap;
        }

        .phone-number, .phone-label {
          flex: 1 1 100%;
        }
      }
    `,
  ],
})
export class VendorFormComponent implements OnInit {
  protected readonly store = inject(VendorStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;
  protected readonly tagInputControl = this.fb.control('');
  @ViewChild('tagInput') tagInput!: ElementRef<HTMLInputElement>;

  protected form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    phones: this.fb.array([]),
    emails: this.fb.array([]),
  });

  // Selected trade tags (managed separately from form)
  protected selectedTags = signal<VendorTradeTagDto[]>([]);

  // Filtered tags for autocomplete
  protected filteredTags = computed(() => {
    const input = this.tagInputControl.value?.toLowerCase() || '';
    const selectedIds = new Set(this.selectedTags().map(t => t.id));
    return this.store.tradeTags()
      .filter(tag => !selectedIds.has(tag.id))
      .filter(tag => tag.name?.toLowerCase().includes(input));
  });

  get phonesArray(): FormArray {
    return this.form.get('phones') as FormArray;
  }

  get emailsArray(): FormArray {
    return this.form.get('emails') as FormArray;
  }

  ngOnInit(): void {
    this.store.loadTradeTags();
  }

  protected addPhone(): void {
    this.phonesArray.push(this.fb.group({
      number: ['', [Validators.required, Validators.maxLength(50)]],
      label: [''],
    }));
  }

  protected removePhone(index: number): void {
    this.phonesArray.removeAt(index);
  }

  protected addEmail(): void {
    this.emailsArray.push(this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(255)]));
  }

  protected removeEmail(index: number): void {
    this.emailsArray.removeAt(index);
  }

  protected selectTag(event: MatAutocompleteSelectedEvent): void {
    const tag = event.option.value as VendorTradeTagDto;
    if (tag.id === null) {
      this.createAndAddTag(tag.name || '');
    } else {
      this.selectedTags.update(tags => [...tags, tag]);
    }
    this.tagInputControl.setValue('');
    this.tagInput.nativeElement.value = '';
  }

  protected addTagFromInput(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && !this.tagExists(value)) {
      this.createAndAddTag(value);
    }
    event.chipInput?.clear();
    this.tagInputControl.setValue('');
  }

  private async createAndAddTag(name: string): Promise<void> {
    const newTag = await this.store.createTradeTag(name);
    if (newTag) {
      this.selectedTags.update(tags => [...tags, newTag]);
    }
  }

  protected removeTag(tag: VendorTradeTagDto): void {
    this.selectedTags.update(tags => tags.filter(t => t.id !== tag.id));
  }

  protected tagExists(name: string): boolean {
    const lowerName = name.toLowerCase();
    return this.store.tradeTags().some(t => t.name?.toLowerCase() === lowerName) ||
           this.selectedTags().some(t => t.name?.toLowerCase() === lowerName);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = {
      firstName: this.form.value.firstName?.trim(),
      middleName: this.form.value.middleName?.trim() || undefined,
      lastName: this.form.value.lastName?.trim(),
      phones: (this.form.value.phones || []).map((p: { number?: string; label?: string }) => ({
        number: p.number?.trim(),
        label: p.label || undefined,
      })),
      emails: (this.form.value.emails || []).map((e: string) => e.trim()),
      tradeTagIds: this.selectedTags()
        .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
        .map(t => t.id),
    };

    this.store.createVendor(request);
  }

  protected onCancel(): void {
    this.router.navigate(['/vendors']);
  }
}
