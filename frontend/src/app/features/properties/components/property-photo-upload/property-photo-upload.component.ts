import { Component, input, output, inject } from '@angular/core';
import { PhotoUploadComponent } from '../../../../shared/components/photo-upload/photo-upload.component';
import { PropertyPhotoStore } from '../../stores/property-photo.store';

/**
 * PropertyPhotoUploadComponent
 *
 * Property-specific wrapper around the generic PhotoUploadComponent.
 * Connects to PropertyPhotoStore for upload operations.
 *
 * Features (via PhotoUploadComponent):
 * - Drag-and-drop zone
 * - File picker button
 * - Upload progress bar
 * - Client-side file type/size validation
 * - Error states with retry option
 */
@Component({
  selector: 'app-property-photo-upload',
  standalone: true,
  imports: [PhotoUploadComponent],
  template: `
    <app-photo-upload
      [uploadFn]="uploadPhoto"
      (uploadComplete)="uploadComplete.emit()"
      (batchComplete)="batchComplete.emit()"
    />
  `,
})
export class PropertyPhotoUploadComponent {
  private readonly photoStore = inject(PropertyPhotoStore);

  /**
   * Property ID for the upload (kept for API compatibility, though store already has it)
   */
  readonly propertyId = input.required<string>();

  /**
   * Emitted when upload completes successfully (per file)
   */
  readonly uploadComplete = output<void>();

  /**
   * Emitted when all files in the batch reach a final state (Task 6.1)
   */
  readonly batchComplete = output<void>();

  /**
   * Upload function passed to the generic PhotoUploadComponent.
   * Uses PropertyPhotoStore.uploadPhoto which calls property-specific endpoints.
   */
  uploadPhoto = async (file: File): Promise<boolean> => {
    return this.photoStore.uploadPhoto(file);
  };
}
