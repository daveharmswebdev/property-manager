import { Component, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
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
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { VendorFormBase } from '../shared/vendor-form-base';
import { VENDOR_FORM_SHARED_STYLES } from '../shared/vendor-form-styles';

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
    VENDOR_FORM_SHARED_STYLES,
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
    `,
  ],
})
export class VendorFormComponent extends VendorFormBase implements OnInit, HasUnsavedChanges {
  private readonly router = inject(Router);

  @ViewChild('tagInput') private tagInput!: ElementRef<HTMLInputElement>;

  protected getTagInputElement(): HTMLInputElement {
    return this.tagInput.nativeElement;
  }

  ngOnInit(): void {
    this.store.loadTradeTags();
  }

  hasUnsavedChanges(): boolean {
    if (this.store.isSaving()) {
      return false;
    }
    return this.form.dirty || this.selectedTags().length > 0;
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
      phones: this.getPhonesPayload(),
      emails: this.getEmailsPayload(),
      tradeTagIds: this.getSelectedTradeTagIds(),
    };

    this.store.createVendor(request);
  }

  protected onCancel(): void {
    this.router.navigate(['/vendors']);
  }
}
