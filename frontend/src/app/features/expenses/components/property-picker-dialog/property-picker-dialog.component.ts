import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

export interface PropertyPickerDialogData {
  properties: { id: string; name: string }[];
}

@Component({
  selector: 'app-property-picker-dialog',
  standalone: true,
  imports: [MatDialogModule, MatListModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Select Property</h2>
    <mat-dialog-content>
      <mat-selection-list [multiple]="false" (selectionChange)="onSelect($event)">
        @for (property of data.properties; track property.id) {
          <mat-list-option [value]="property.id">{{ property.name }}</mat-list-option>
        }
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `,
})
export class PropertyPickerDialogComponent {
  readonly data = inject<PropertyPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PropertyPickerDialogComponent>);

  onSelect(event: MatSelectionListChange): void {
    const selectedId = event.options[0]?.value;
    if (selectedId) {
      this.dialogRef.close(selectedId);
    }
  }
}
