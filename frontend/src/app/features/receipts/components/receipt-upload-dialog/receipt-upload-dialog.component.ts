import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DragDropUploadComponent } from '../../../../shared/components/drag-drop-upload/drag-drop-upload.component';

@Component({
  selector: 'app-receipt-upload-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, DragDropUploadComponent],
  template: `
    <h2 mat-dialog-title>Upload Receipts</h2>
    <mat-dialog-content>
      <app-drag-drop-upload
        accept="image/jpeg,image/png,application/pdf"
        [multiple]="true"
        (filesSelected)="onFilesSelected($event)"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="selectedFiles().length === 0"
        (click)="onUpload()"
        data-testid="dialog-upload-btn"
      >
        Upload
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-height: 200px;
        padding-top: 8px;
      }
    `,
  ],
})
export class ReceiptUploadDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReceiptUploadDialogComponent>);

  readonly selectedFiles = signal<File[]>([]);

  onFilesSelected(files: File[]): void {
    this.selectedFiles.set(files);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onUpload(): void {
    this.dialogRef.close(this.selectedFiles());
  }
}
