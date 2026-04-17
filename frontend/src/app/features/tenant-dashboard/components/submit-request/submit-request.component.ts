import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { TenantDashboardStore } from '../../stores/tenant-dashboard.store';
import { PhotoUploadComponent } from '../../../../shared/components/photo-upload/photo-upload.component';

/**
 * Submit Request Component (Story 20.6, Task 3)
 *
 * Two-phase form for submitting maintenance requests:
 * Phase 1: Description entry and submission
 * Phase 2: Optional photo upload after request creation
 */
@Component({
  selector: 'app-submit-request',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    PhotoUploadComponent,
  ],
  template: `
    <div class="submit-request-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            @if (!createdRequestId()) {
              Submit Maintenance Request
            } @else {
              Add Photos (Optional)
            }
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          @if (!createdRequestId()) {
            <!-- Phase 1: Description Form -->
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea
                  matInput
                  formControlName="description"
                  rows="4"
                  placeholder="Describe the maintenance issue..."
                  data-testid="description-input"
                ></textarea>
                @if (form.controls.description.hasError('required') && form.controls.description.touched) {
                  <mat-error>Description is required</mat-error>
                }
                @if (form.controls.description.hasError('maxlength')) {
                  <mat-error>Description cannot exceed 2000 characters</mat-error>
                }
                <mat-hint align="end">
                  {{ form.controls.description.value?.length || 0 }} / 2000
                </mat-hint>
              </mat-form-field>

              <div class="form-actions">
                <button
                  mat-stroked-button
                  type="button"
                  (click)="onCancel()"
                  data-testid="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  mat-raised-button
                  color="primary"
                  type="submit"
                  [disabled]="form.invalid || store.isSubmitting()"
                  data-testid="submit-btn"
                >
                  @if (store.isSubmitting()) {
                    Submitting...
                  } @else {
                    Submit Request
                  }
                </button>
              </div>
            </form>
          } @else {
            <!-- Phase 2: Photo Upload -->
            <p class="photo-instructions">
              You can add photos of the issue to help your landlord understand the problem.
            </p>
            <app-photo-upload [uploadFn]="uploadFn" />
            <div class="form-actions">
              <button
                mat-raised-button
                color="primary"
                (click)="onDone()"
                data-testid="done-btn"
              >
                Done
              </button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .submit-request-container {
        padding: 16px;
        max-width: 600px;
        margin: 0 auto;
      }

      .full-width {
        width: 100%;
      }

      mat-card-content {
        padding-top: 16px;
      }

      textarea {
        resize: vertical;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }

      .form-actions button[type='submit'],
      .form-actions [data-testid='done-btn'] {
        min-height: 48px;
        font-size: 16px;
      }

      .photo-instructions {
        color: var(--pm-text-secondary);
        margin-bottom: 16px;
        font-size: 14px;
      }

      @media (max-width: 599px) {
        .submit-request-container {
          padding: 12px;
        }

        .form-actions {
          flex-direction: column-reverse;
        }

        .form-actions button {
          width: 100%;
          min-height: 48px;
        }
      }

      @media (min-width: 600px) {
        .submit-request-container {
          padding: 24px;
        }
      }
    `,
  ],
})
export class SubmitRequestComponent {
  readonly store = inject(TenantDashboardStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** Signal API for cancel event (Task 3.7) */
  readonly cancel = output<void>();

  /** Track the created request ID for two-phase flow (Task 3.5) */
  readonly createdRequestId = signal<string | null>(null);

  /** Reactive form with description field (Task 3.3) */
  readonly form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  /** Upload function bound to store for PhotoUploadComponent (Task 3.2) */
  readonly uploadFn = (file: File): Promise<boolean> => {
    const requestId = this.createdRequestId();
    if (!requestId) return Promise.resolve(false);
    return this.store.uploadPhoto(requestId, file);
  };

  /** Phase 1: Submit the description to create a maintenance request (Task 3.4) */
  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const description = this.form.controls.description.value!.trim();
    const requestId = await this.store.submitRequest(description);

    if (requestId) {
      this.createdRequestId.set(requestId);
    }
  }

  /** Phase 2: Done with photos, navigate back to dashboard (Task 6.1) */
  onDone(): void {
    this.store.loadRequests();
    this.router.navigate(['/tenant']);
  }

  /** Cancel and navigate back (Task 3.7) */
  onCancel(): void {
    this.cancel.emit();
    this.router.navigate(['/tenant']);
  }
}
