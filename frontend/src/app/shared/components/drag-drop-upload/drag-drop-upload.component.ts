import { Component, computed, ElementRef, input, output, signal, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

/**
 * Preview information for a selected file
 */
interface FilePreview {
  file: File;
  previewUrl: string | null;
}

/**
 * DragDropUploadComponent
 *
 * Reusable drag-and-drop file upload component with:
 * - Drag-and-drop support with visual feedback
 * - Click-to-browse file picker
 * - File type and size validation
 * - Preview thumbnails for images
 * - Keyboard accessibility and ARIA labels
 */
@Component({
  selector: 'app-drag-drop-upload',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatSnackBarModule, DecimalPipe],
  template: `
    <div
      class="drag-drop-zone"
      [class.dragging]="isDragging()"
      [class.disabled]="disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="openFilePicker()"
      (keydown.enter)="openFilePicker()"
      (keydown.space)="openFilePicker(); $event.preventDefault()"
      [attr.tabindex]="disabled() ? -1 : 0"
      role="button"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-disabled]="disabled()"
      data-testid="drag-drop-zone"
    >
      <input
        #fileInput
        type="file"
        [accept]="accept()"
        [multiple]="multiple()"
        [disabled]="disabled()"
        (change)="onFileInputChange($event)"
        class="hidden-input"
        data-testid="file-input"
        aria-hidden="true"
      />

      @if (selectedFiles().length === 0) {
        <mat-icon class="upload-icon">cloud_upload</mat-icon>
        <p class="instructions">
          Drag and drop files here<br />
          <span class="or-text">or</span>
        </p>
        <button
          mat-stroked-button
          type="button"
          [disabled]="disabled()"
          (click)="openFilePicker(); $event.stopPropagation()"
          data-testid="browse-btn"
        >
          Browse Files
        </button>
        <p class="hint">{{ acceptHint() }} &bull; Max {{ maxSizeBytes() / 1024 / 1024 }}MB each</p>
      } @else {
        <!-- File previews -->
        <div class="previews-container" data-testid="previews-container">
          @for (preview of filePreviews(); track preview.file.name) {
            <div class="preview-item" data-testid="preview-item">
              @if (preview.previewUrl) {
                <img [src]="preview.previewUrl" [alt]="preview.file.name" class="preview-image" />
              } @else {
                <mat-icon class="file-icon">insert_drive_file</mat-icon>
              }
              <span class="file-name">{{ preview.file.name }}</span>
              <button
                mat-icon-button
                type="button"
                class="remove-btn"
                (click)="removeFile(preview.file); $event.stopPropagation()"
                [attr.aria-label]="'Remove ' + preview.file.name"
                data-testid="remove-btn"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
        </div>

        <div class="summary" data-testid="summary">
          <span>{{ selectedFiles().length }} file(s) selected</span>
          <span>&bull;</span>
          <span>{{ totalSize() | number: '1.0-2' }} MB total</span>
        </div>

        <div class="actions">
          <button
            mat-stroked-button
            type="button"
            (click)="clearFiles(); $event.stopPropagation()"
            data-testid="clear-btn"
          >
            Clear All
          </button>
          <button
            mat-stroked-button
            type="button"
            [disabled]="disabled()"
            (click)="openFilePicker(); $event.stopPropagation()"
            data-testid="add-more-btn"
          >
            Add More
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .hidden-input {
        display: none;
      }

      .drag-drop-zone {
        border: 2px dashed var(--mat-sys-outline, #79747e);
        border-radius: 8px;
        padding: 32px;
        text-align: center;
        transition: all 0.2s ease;
        cursor: pointer;
        background-color: var(--mat-sys-surface, #fff);

        &:hover:not(.disabled) {
          border-color: var(--mat-sys-primary, #6750a4);
          background-color: var(--mat-sys-surface-variant, #f5f5f5);
        }

        &:focus {
          outline: 2px solid var(--mat-sys-primary, #6750a4);
          outline-offset: 2px;
        }

        &.dragging {
          border-color: var(--mat-sys-primary, #6750a4);
          border-style: solid;
          background-color: var(--mat-sys-primary-container, #eaddff);
        }

        &.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .upload-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-on-surface-variant, #49454f);
        margin-bottom: 16px;
      }

      .instructions {
        margin: 0 0 16px 0;
        color: var(--mat-sys-on-surface, #1d1b20);
        font-size: 1rem;
      }

      .or-text {
        color: var(--mat-sys-on-surface-variant, #49454f);
        font-size: 0.875rem;
      }

      .hint {
        margin: 16px 0 0 0;
        color: var(--mat-sys-on-surface-variant, #49454f);
        font-size: 0.75rem;
      }

      .previews-container {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin-bottom: 16px;
      }

      .preview-item {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px;
        border-radius: 4px;
        background-color: var(--mat-sys-surface-container, #f3edf7);
        max-width: 100px;
      }

      .preview-image {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 4px;
      }

      .file-icon {
        width: 60px;
        height: 60px;
        font-size: 48px;
        color: var(--mat-sys-on-surface-variant, #49454f);
      }

      .file-name {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface, #1d1b20);
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 4px;
      }

      .remove-btn {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 24px;
        height: 24px;
        padding: 0;
        background-color: var(--mat-sys-error, #b3261e);
        color: var(--mat-sys-on-error, #fff);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .summary {
        display: flex;
        gap: 8px;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant, #49454f);
        font-size: 0.875rem;
        margin-bottom: 16px;
      }

      .actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
    `,
  ],
})
export class DragDropUploadComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  /** Accepted file types (MIME types, comma-separated) */
  accept = input('image/jpeg,image/png');

  /** Maximum file size in bytes */
  maxSizeBytes = input(10 * 1024 * 1024); // 10MB

  /** Allow multiple file selection */
  multiple = input(true);

  /** Disable the component */
  disabled = input(false);

  /** Emitted when files are selected and validated */
  filesSelected = output<File[]>();

  /** Emitted when a validation error occurs */
  uploadError = output<string>();

  /** Whether user is dragging files over the drop zone */
  isDragging = signal(false);

  /** Currently selected files */
  selectedFiles = signal<File[]>([]);

  /** File previews with thumbnail URLs */
  filePreviews = computed<FilePreview[]>(() => {
    return this.selectedFiles().map((file) => ({
      file,
      previewUrl: this.isImageFile(file) ? URL.createObjectURL(file) : null,
    }));
  });

  /** Total size of selected files in MB */
  totalSize = computed(() => {
    const totalBytes = this.selectedFiles().reduce((sum, file) => sum + file.size, 0);
    return totalBytes / 1024 / 1024;
  });

  /** Human-readable accept hint for display */
  acceptHint = computed(() => {
    const types = this.accept().split(',').map((t) => t.trim());
    const extensions = types.map((t) => {
      switch (t) {
        case 'image/jpeg':
          return 'JPG';
        case 'image/png':
          return 'PNG';
        case 'image/gif':
          return 'GIF';
        case 'image/webp':
          return 'WebP';
        case 'image/bmp':
          return 'BMP';
        case 'image/tiff':
          return 'TIFF';
        default:
          return t.split('/')[1]?.toUpperCase() || t;
      }
    });
    return extensions.join(', ');
  });

  /** ARIA label for the drop zone */
  ariaLabel = computed(() => {
    if (this.selectedFiles().length > 0) {
      return `${this.selectedFiles().length} files selected. Click or press Enter to add more files.`;
    }
    return 'Drop files here or click to browse';
  });

  private snackBar: MatSnackBar;

  constructor(snackBar: MatSnackBar) {
    this.snackBar = snackBar;
  }

  /** Handle dragover event */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  /** Handle dragleave event */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  /** Handle drop event */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.disabled()) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  /** Open the native file picker */
  openFilePicker(): void {
    if (!this.disabled() && this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  /** Handle file input change */
  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
      // Reset input to allow selecting the same file again
      input.value = '';
    }
  }

  /** Remove a file from the selection */
  removeFile(file: File): void {
    const currentFiles = this.selectedFiles();
    const updatedFiles = currentFiles.filter((f) => f !== file);
    this.selectedFiles.set(updatedFiles);

    // Emit updated selection
    if (updatedFiles.length > 0) {
      this.filesSelected.emit(updatedFiles);
    }
  }

  /** Clear all selected files */
  clearFiles(): void {
    // Revoke object URLs to prevent memory leaks
    this.filePreviews().forEach((preview) => {
      if (preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    });
    this.selectedFiles.set([]);
  }

  /** Process and validate dropped/selected files */
  private processFiles(files: File[]): void {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check if multiple files allowed
      if (!this.multiple() && (validFiles.length > 0 || this.selectedFiles().length > 0)) {
        errors.push('Only one file can be selected');
        break;
      }

      // Validate file type
      if (!this.isValidFileType(file)) {
        errors.push(`"${file.name}" is not an accepted file type. Accepted: ${this.acceptHint()}`);
        continue;
      }

      // Validate file size
      if (file.size > this.maxSizeBytes()) {
        const maxMB = this.maxSizeBytes() / 1024 / 1024;
        errors.push(`"${file.name}" exceeds the ${maxMB}MB limit`);
        continue;
      }

      validFiles.push(file);
    }

    // Show errors if any
    if (errors.length > 0) {
      const errorMessage = errors.join('. ');
      this.uploadError.emit(errorMessage);
      this.snackBar.open(errorMessage, 'Dismiss', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
    }

    // Add valid files to selection
    if (validFiles.length > 0) {
      const currentFiles = this.multiple() ? this.selectedFiles() : [];
      const newSelection = [...currentFiles, ...validFiles];
      this.selectedFiles.set(newSelection);
      this.filesSelected.emit(newSelection);
    }
  }

  /** Check if file type is accepted */
  private isValidFileType(file: File): boolean {
    const acceptedTypes = this.accept()
      .split(',')
      .map((t) => t.trim().toLowerCase());
    return acceptedTypes.includes(file.type.toLowerCase());
  }

  /** Check if file is an image (for preview) */
  private isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
}
