import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PropertyStore } from '../../../properties/stores/property.store';

/**
 * Result from property tag modal
 */
export interface PropertyTagResult {
  propertyId: string | null;
}

/**
 * Property Tag Modal Component (AC-5.2.3, AC-5.2.4)
 *
 * Modal for optionally associating a receipt with a property.
 * - Shows property dropdown populated from user's properties
 * - Skip button saves with null propertyId (unassigned)
 * - Save button saves with selected propertyId
 * - Compact design for quick interaction
 */
@Component({
  selector: 'app-property-tag-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Which property?</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Property (optional)</mat-label>
        <mat-select [(value)]="selectedPropertyId">
          @for (property of propertyStore.properties(); track property.id) {
            <mat-option [value]="property.id">
              {{ property.name }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onSkip()">Skip</button>
      <button mat-raised-button color="primary" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
    }

    mat-dialog-content {
      min-height: 60px;
      padding-top: 8px;
    }
  `],
})
export class PropertyTagModalComponent implements OnInit {
  readonly propertyStore = inject(PropertyStore);
  private readonly dialogRef = inject(MatDialogRef<PropertyTagModalComponent>);

  selectedPropertyId: string | null = null;

  ngOnInit(): void {
    // Load properties if not already loaded
    if (this.propertyStore.properties().length === 0) {
      this.propertyStore.loadProperties(undefined);
    }
  }

  /**
   * Skip property selection - saves as unassigned (AC-5.2.4)
   */
  onSkip(): void {
    this.dialogRef.close({ propertyId: null } as PropertyTagResult);
  }

  /**
   * Save with selected property (AC-5.2.3)
   */
  onSave(): void {
    this.dialogRef.close({ propertyId: this.selectedPropertyId } as PropertyTagResult);
  }
}
