# Story 9.5: Inline Vendor Creation

Status: completed

## Story

As a **property owner**,
I want **to create a new vendor while assigning a work order**,
So that **I don't have to leave the form to add a vendor I just found**.

## Acceptance Criteria

### Frontend - Add New Vendor Option in Dropdown

1. **Given** I am on the work order form in the "Assigned To" field
   **When** I view the vendor dropdown
   **Then** I see a "+ Add New Vendor" option at the bottom of the list (after all existing vendors)

### Frontend - Inline Vendor Dialog

2. **Given** I click "+ Add New Vendor" option
   **When** the action is triggered
   **Then** a dialog opens with the minimal vendor form:
   - First Name (required)
   - Last Name (required)
   - Middle Name (optional)
   - [Cancel] and [Save] buttons

3. **Given** I fill in the vendor name in the dialog (first name + last name)
   **When** I click "Save"
   **Then** the vendor is created in my account
   **And** the dialog closes
   **And** the new vendor is automatically selected in the "Assigned To" field
   **And** I can continue editing the work order
   **And** I see snackbar "Vendor added ✓"

4. **Given** I click "Cancel" on the vendor dialog
   **When** the dialog closes
   **Then** no vendor is created
   **And** the "Assigned To" field remains as it was (previous selection preserved)

5. **Given** I leave First Name or Last Name empty in the dialog
   **When** I try to submit
   **Then** I see validation error "First name is required" / "Last name is required"
   **And** the form does not submit

### Integration - Vendor Available in System

6. **Given** I create a vendor inline
   **When** I later go to the Vendors page
   **Then** the vendor appears in my vendor list
   **And** I can add more details (phone, email, trade tags) later

### Edge Cases

7. **Given** I create a vendor inline
   **When** the creation fails (network error, validation error)
   **Then** I see an error message in the dialog
   **And** the dialog remains open for retry
   **And** the work order form is not affected

8. **Given** I am creating a work order and select "+ Add New Vendor"
   **When** I am filling the vendor dialog
   **Then** the work order form behind is not reset or cleared

## Tasks / Subtasks

### Task 1: Add createVendorInline Method to VendorStore (AC: #3, #7)

- [x] 1.1 Add `createVendorInline` method to VendorStore that:
  - Creates vendor via API (same as createVendor)
  - Does NOT navigate away after success
  - Returns the created vendor ID (Promise-based for dialog)
  - Refreshes the vendors list after creation
  - Shows snackbar on success/failure

### Task 2: Create InlineVendorDialogComponent (AC: #2, #3, #4, #5)

- [x] 2.1 Create `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts`:
  - Angular Material Dialog component
  - Form with firstName (required), lastName (required), middleName (optional)
  - [Cancel] and [Save] buttons
  - Loading state during save
  - Validation error display
- [x] 2.2 Add form validation:
  - firstName: required, maxlength(100)
  - lastName: required, maxlength(100)
  - middleName: optional, maxlength(100)
- [x] 2.3 Implement save logic:
  - Call VendorStore.createVendorInline()
  - Close dialog with created vendor data on success
  - Show error and keep dialog open on failure

### Task 3: Integrate Dialog into WorkOrderFormComponent (AC: #1, #3, #4, #8)

- [x] 3.1 Add MatDialogModule import to WorkOrderFormComponent
- [x] 3.2 Add "+ Add New Vendor" option to vendor dropdown (after existing vendors)
- [x] 3.3 Implement vendor selection handler:
  - If "add-new" selected, open InlineVendorDialogComponent
  - On dialog close with vendor data, auto-select the new vendor
  - On dialog cancel, restore previous selection
- [x] 3.4 After inline vendor creation:
  - Refresh vendor list from store
  - Set vendorId form control to newly created vendor
  - Trigger status auto-update if status was "Reported"

### Task 4: Testing

- [x] 4.1 Create unit tests for VendorStore.createVendorInline:
  - Happy path: creates vendor, returns ID, shows snackbar
  - Error path: returns null, shows error snackbar
- [x] 4.2 Create unit tests for InlineVendorDialogComponent:
  - Form validation displays errors
  - Save button disabled when form invalid
  - Cancel closes dialog without creating
  - Success closes dialog with vendor data
- [x] 4.3 Create unit tests for WorkOrderFormComponent inline vendor flow:
  - "+ Add New Vendor" option appears in dropdown
  - Clicking option opens dialog
  - After vendor creation, vendor is selected
  - Cancel preserves previous selection
- [x] 4.4 Manual verification:
  - [x] Create work order, click "+ Add New Vendor"
  - [x] Fill name and save - vendor auto-selected
  - [x] Cancel dialog - previous selection preserved
  - [x] New vendor appears on Vendors page
  - [x] Inline vendor with "Reported" status auto-changes to "Assigned"

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Domain/
├── (no changes - backend already supports vendor creation)

PropertyManager.Application/
├── (no changes - CreateVendorCommand already exists)

PropertyManager.Api/
├── (no changes - POST /api/v1/vendors already exists)
```

**Frontend Structure:**
```
frontend/src/app/features/
├── vendors/
│   ├── components/
│   │   ├── inline-vendor-dialog/
│   │   │   ├── inline-vendor-dialog.component.ts      ← NEW
│   │   │   └── inline-vendor-dialog.component.spec.ts ← NEW
│   │   └── vendor-form/ (existing - reference for form patterns)
│   ├── stores/
│   │   └── vendor.store.ts                            ← MODIFIED (add createVendorInline)
├── work-orders/
│   ├── components/
│   │   └── work-order-form/
│   │       └── work-order-form.component.ts           ← MODIFIED (add dialog integration)
```

### Backend - No Changes Required

The backend already supports vendor creation via `POST /api/v1/vendors` with:
- CreateVendorRequest: firstName (required), middleName (optional), lastName (required)
- Returns: `{ id: "<guid>" }` with 201 Created

No backend modifications needed for this story.

### Frontend Patterns to Follow

**Reference Files:**
- `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.ts` - Form structure pattern
- `frontend/src/app/features/vendors/stores/vendor.store.ts` - Store methods pattern
- `frontend/src/app/shared/components/confirm-dialog/` - Dialog pattern reference

**VendorStore.createVendorInline Pattern:**
```typescript
// In vendor.store.ts - Add new method

/**
 * Create a new vendor inline (for dialogs, no navigation)
 * @param request Vendor creation request
 * @returns Promise resolving to created vendor ID, or null on error
 */
async createVendorInline(request: CreateVendorRequest): Promise<string | null> {
  patchState(store, { isSaving: true, error: null });

  try {
    const result = await firstValueFrom(
      apiService.vendors_CreateVendor(request)
    );

    // Refresh vendor list to include new vendor
    // Note: loadVendors is rxMethod, need to trigger it
    this.loadVendors();

    patchState(store, { isSaving: false });
    snackBar.open('Vendor added ✓', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    return result.id;
  } catch (error) {
    patchState(store, {
      isSaving: false,
      error: 'Failed to create vendor. Please try again.',
    });
    snackBar.open('Failed to create vendor', 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    console.error('Error creating vendor inline:', error);
    return null;
  }
}
```

**InlineVendorDialogComponent Pattern:**
```typescript
// inline-vendor-dialog.component.ts

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VendorStore } from '../../stores/vendor.store';

export interface InlineVendorDialogResult {
  id: string;
  fullName: string;
}

@Component({
  selector: 'app-inline-vendor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Add New Vendor</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="vendor-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" />
          @if (form.get('firstName')?.hasError('required') && form.get('firstName')?.touched) {
            <mat-error>First name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Middle Name (Optional)</mat-label>
          <input matInput formControlName="middleName" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" />
          @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
            <mat-error>Last name is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="store.isSaving()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()"
              [disabled]="form.invalid || store.isSaving()">
        @if (store.isSaving()) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          Save
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .vendor-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 300px;
    }
    .full-width { width: 100%; }
    mat-dialog-content { padding-top: 8px; }
  `]
})
export class InlineVendorDialogComponent {
  protected readonly store = inject(VendorStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<InlineVendorDialogComponent>);

  protected form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected onCancel(): void {
    this.dialogRef.close(null);
  }

  protected async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = {
      firstName: this.form.value.firstName?.trim(),
      middleName: this.form.value.middleName?.trim() || undefined,
      lastName: this.form.value.lastName?.trim(),
    };

    const vendorId = await this.store.createVendorInline(request);

    if (vendorId) {
      const fullName = [request.firstName, request.middleName, request.lastName]
        .filter(Boolean).join(' ');
      this.dialogRef.close({ id: vendorId, fullName } as InlineVendorDialogResult);
    }
    // On error, dialog stays open (store shows snackbar error)
  }
}
```

**WorkOrderFormComponent Integration Pattern:**
```typescript
// In work-order-form.component.ts

import { MatDialog } from '@angular/material/dialog';
import { InlineVendorDialogComponent, InlineVendorDialogResult } from '../../../vendors/components/inline-vendor-dialog/inline-vendor-dialog.component';

// Add to imports array
MatDialogModule,

// Add inject
private readonly dialog = inject(MatDialog);

// Track previous vendor selection for restore on cancel
private previousVendorId: string | null = null;

// Updated vendor selection handler
protected onVendorChange(vendorId: string | null): void {
  if (vendorId === 'add-new') {
    // Store current selection before opening dialog
    this.previousVendorId = this.form.get('vendorId')?.value;

    // Reset to null temporarily while dialog is open
    this.form.patchValue({ vendorId: null });

    this.openInlineVendorDialog();
    return;
  }

  // Existing status auto-update logic
  const currentStatus = this.form.get('status')?.value;
  if (vendorId && currentStatus === WorkOrderStatus.Reported) {
    this.form.patchValue({ status: WorkOrderStatus.Assigned });
  }
}

private openInlineVendorDialog(): void {
  const dialogRef = this.dialog.open(InlineVendorDialogComponent, {
    width: '400px',
    disableClose: true, // Prevent accidental close
  });

  dialogRef.afterClosed().subscribe((result: InlineVendorDialogResult | null) => {
    if (result) {
      // Success: select the newly created vendor
      this.form.patchValue({ vendorId: result.id });

      // Trigger status auto-update
      const currentStatus = this.form.get('status')?.value;
      if (currentStatus === WorkOrderStatus.Reported) {
        this.form.patchValue({ status: WorkOrderStatus.Assigned });
      }
    } else {
      // Cancel: restore previous selection
      this.form.patchValue({ vendorId: this.previousVendorId });
    }
  });
}

// Updated template for vendor dropdown:
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
  <mat-divider></mat-divider>
  <mat-option [value]="'add-new'" class="add-vendor-option">
    <mat-icon>add</mat-icon> Add New Vendor
  </mat-option>
</mat-select>
```

### Previous Story Intelligence

From 9-4 implementation:
- Vendor dropdown is already in WorkOrderFormComponent (lines 123-153)
- VendorStore is injected and loadVendors() called in ngOnInit
- Status auto-update logic exists in onVendorChange() (lines 442-449)
- vendorId is a FormControl in the form group (line 307)

From Epic 8 (Vendor Management):
- VendorStore.createVendor exists but navigates to /vendors (not suitable for inline)
- CreateVendorRequest has firstName, middleName?, lastName
- VendorFormComponent shows validation pattern (required fields, maxlength)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR14 | System allows vendor creation inline during work order assignment (no blocking validation) | Dialog opens from vendor dropdown, creates minimal vendor, auto-selects |

### Testing Requirements

**Unit Tests (frontend):**
- VendorStore.createVendorInline - 2+ tests (success, error)
- InlineVendorDialogComponent - 4+ tests (validation, cancel, save success, save error)
- WorkOrderFormComponent vendor dialog flow - 4+ tests

**Manual Verification:**
- [ ] Create work order, click "+ Add New Vendor" option
- [ ] Dialog opens with First/Middle/Last name fields
- [ ] Submit with empty first name shows validation error
- [ ] Submit with empty last name shows validation error
- [ ] Cancel closes dialog, previous vendor selection restored
- [ ] Save creates vendor, dialog closes, vendor auto-selected
- [ ] Status auto-updates to "Assigned" if was "Reported"
- [ ] Navigate to /vendors - new vendor appears in list
- [ ] Can edit new vendor later to add phone/email/trade tags

### References

- [Source: epics-work-orders-vendors.md#Story 2.5] - Original story definition
- [Source: architecture.md#Phase 2] - API design and entity structure
- [Source: 9-4-assign-work-order-vendor-or-diy.md] - Previous story patterns
- [Source: vendor.store.ts] - Existing vendor store methods
- [Source: vendor-form.component.ts] - Vendor form validation patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. **Task 1 (VendorStore.createVendorInline)**: Added Promise-based method that creates vendor via API without navigation. Uses `firstValueFrom` to convert Observable to Promise. Fixed TypeScript issue with `result.id !== undefined ? result.id : null` pattern.

2. **Task 2 (InlineVendorDialogComponent)**: Created standalone Angular component with MatDialog pattern. Form includes First Name (required), Middle Name (optional), Last Name (required) with maxLength(100) validators. Dialog stays open on error for retry capability.

3. **Task 3 (WorkOrderFormComponent Integration)**: Added MatDialogModule, MatDividerModule imports. Added "+ Add New Vendor" option with mat-divider separator in vendor dropdown. Implemented `onVendorChange` handler to open dialog when 'add-new' is selected. **Bug Fix**: Initially stored `previousVendorId` during 'add-new' selection, but Angular's mat-select already updated form value by that point. Fixed by tracking `previousVendorId` at end of each regular vendor selection instead.

4. **Task 4 (Testing)**: Added 8 unit tests for VendorStore.createVendorInline, 17 tests for InlineVendorDialogComponent, 9 tests for WorkOrderFormComponent inline vendor flow. All 1102 frontend tests pass. Manual verification completed via Playwright.

### File List

**New Files:**
- `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts`
- `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.spec.ts`

**Modified Files:**
- `frontend/src/app/features/vendors/stores/vendor.store.ts` - Added `createVendorInline` method
- `frontend/src/app/features/vendors/stores/vendor.store.spec.ts` - Added 8 tests for createVendorInline
- `frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.ts` - Added dialog integration, "+ Add New Vendor" option
- `frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.spec.ts` - Added 9 tests for inline vendor dialog flow
