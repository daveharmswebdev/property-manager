import { Component, inject, OnInit, OnDestroy, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { PhoneMaskDirective } from '../../../../shared/directives/phone-mask.directive';
import { VendorTradeTagDto, VendorDetailDto, PhoneNumberDto, UpdateVendorRequest } from '../../../../core/api/api.service';
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { VendorFormBase } from '../shared/vendor-form-base';
import { VENDOR_FORM_SHARED_STYLES } from '../shared/vendor-form-styles';

/**
 * Vendor Edit Component (AC #1-#14)
 *
 * Form for editing an existing vendor with phones, emails, and trade tags.
 */
@Component({
  selector: 'app-vendor-edit',
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
    <div class="vendor-edit-container">
      @if (store.isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading vendor...</p>
        </div>
      } @else if (store.selectedVendor()) {
        <mat-card class="vendor-edit-card">
          <mat-card-header>
            <mat-card-title>Edit Vendor</mat-card-title>
            <mat-card-subtitle>{{ store.selectedVendor()?.fullName }}</mat-card-subtitle>
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
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="name-field">
                    <mat-label>Middle Name</mat-label>
                    <input matInput formControlName="middleName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="name-field">
                    <mat-label>Last Name</mat-label>
                    <input matInput formControlName="lastName" />
                    @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
                      <mat-error>Last name is required</mat-error>
                    }
                  </mat-form-field>
                </div>
              </section>

              <!-- Phone Numbers Section (AC #2-#4) -->
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

              <!-- Email Addresses Section (AC #5-#6) -->
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

              <!-- Trade Tags Section (AC #7-#9) -->
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

              <!-- Form Actions (AC #14) -->
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
                  [disabled]="(form.invalid || (!form.dirty && !hasTagChanges())) || store.isSaving()"
                >
                  @if (store.isSaving()) {
                    <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
                    Saving...
                  } @else {
                    Save Changes
                  }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    VENDOR_FORM_SHARED_STYLES,
    `
      .vendor-edit-container {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        gap: 16px;
      }

      .vendor-edit-card {
        padding: 16px;
      }

      mat-card-header {
        margin-bottom: 24px;
      }

      mat-card-title {
        font-size: 24px !important;
      }
    `,
  ],
})
export class VendorEditComponent extends VendorFormBase implements OnInit, OnDestroy, HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('tagInput') private tagInput!: ElementRef<HTMLInputElement>;

  private vendorId: string | null = null;
  private formPopulated = false;
  private originalTradeTagIds: string[] = [];

  constructor() {
    super();
    // Use effect to react to selectedVendor changes
    effect(() => {
      const vendor = this.store.selectedVendor();
      if (vendor && !this.formPopulated) {
        this.populateForm(vendor);
        this.formPopulated = true;
      }
    });
  }

  protected getTagInputElement(): HTMLInputElement {
    return this.tagInput.nativeElement;
  }

  ngOnInit(): void {
    this.vendorId = this.route.snapshot.paramMap.get('id');
    if (this.vendorId) {
      this.store.loadVendor(this.vendorId);
      this.store.loadTradeTags();
    }
  }

  ngOnDestroy(): void {
    this.store.clearSelectedVendor();
  }

  private populateForm(vendor: VendorDetailDto): void {
    this.form.patchValue({
      firstName: vendor.firstName || '',
      middleName: vendor.middleName || '',
      lastName: vendor.lastName || '',
    });

    // Clear and repopulate phones
    this.phonesArray.clear();
    (vendor.phones || []).forEach((phone: PhoneNumberDto) => {
      this.phonesArray.push(this.fb.group({
        number: [phone.number, [Validators.required, Validators.maxLength(50)]],
        label: [phone.label || ''],
      }));
    });

    // Clear and repopulate emails
    this.emailsArray.clear();
    (vendor.emails || []).forEach((email: string) => {
      this.emailsArray.push(this.fb.control(email, [Validators.required, Validators.email, Validators.maxLength(255)]));
    });

    // Set selected tags and store original IDs for dirty detection
    const tradeTags = vendor.tradeTags || [];
    this.selectedTags.set(tradeTags);
    this.originalTradeTagIds = tradeTags
      .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
      .map(t => t.id)
      .sort();
  }

  /**
   * Check if form has unsaved changes (AC #4, #5)
   * Required by HasUnsavedChanges interface for CanDeactivate guard
   */
  hasUnsavedChanges(): boolean {
    if (this.store.isSaving()) {
      return false;
    }
    return this.form.dirty || this.hasTagChanges();
  }

  protected hasTagChanges(): boolean {
    const currentIds = this.selectedTags()
      .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
      .map(t => t.id)
      .sort();

    return JSON.stringify(currentIds) !== JSON.stringify(this.originalTradeTagIds);
  }

  protected onSubmit(): void {
    if (this.form.invalid || !this.vendorId) {
      this.form.markAllAsTouched();
      return;
    }

    // Mark form as pristine before save to allow navigation after success.
    this.form.markAsPristine();
    this.originalTradeTagIds = this.selectedTags()
      .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
      .map(t => t.id)
      .sort();

    const request: UpdateVendorRequest = {
      firstName: this.form.value.firstName?.trim(),
      middleName: this.form.value.middleName?.trim() || undefined,
      lastName: this.form.value.lastName?.trim(),
      phones: this.getPhonesPayload(),
      emails: this.getEmailsPayload(),
      tradeTagIds: this.getSelectedTradeTagIds(),
    };

    this.store.updateVendor({ id: this.vendorId, request });
  }

  protected onCancel(): void {
    // Navigate back to vendor detail page (Story 8.9 AC #6)
    if (this.vendorId) {
      this.router.navigate(['/vendors', this.vendorId]);
    } else {
      this.router.navigate(['/vendors']);
    }
  }
}
