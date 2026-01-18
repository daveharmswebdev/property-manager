# Story 8.9: Vendor Detail Page

Status: ready-for-review

## Story

As a **property owner**,
I want **to view all details about a vendor including their work history**,
So that **I can evaluate their track record and find their contact info**.

## Acceptance Criteria

### AC #1: Access Vendor Detail from List

1. **Given** I am on the vendor list page
   **When** I click on a vendor row
   **Then** I am navigated to `/vendors/:id`
   **And** I see the vendor detail page (not the edit form)

### AC #2: Display Vendor Information

2. **Given** I am on the vendor detail page
   **When** the page loads
   **Then** I see:
   - Vendor full name as page title
   - Back button to return to vendor list
   - [Edit] and [Delete] action buttons

### AC #3: Display Contact Information

3. **Given** the vendor has phone numbers
   **When** I view the detail page
   **Then** I see all phone numbers with their labels (e.g., "Mobile: 555-1234")

4. **Given** the vendor has email addresses
   **When** I view the detail page
   **Then** I see all email addresses listed

### AC #4: Display Trade Tags

5. **Given** the vendor has trade tags assigned
   **When** I view the detail page
   **Then** I see trade tags displayed as colored chips (matching list view style)

### AC #5: Work Order History Section (Future Placeholder)

6. **Given** I am on the vendor detail page
   **When** I view the Work Order History section
   **Then** I see "No work orders yet for this vendor"
   **And** the section is styled as a placeholder for future functionality

### AC #6: Edit Navigation

7. **Given** I am on the vendor detail page
   **When** I click the [Edit] button
   **Then** I am navigated to `/vendors/:id/edit`

### AC #7: Delete from Detail Page

8. **Given** I am on the vendor detail page
   **When** I click the [Delete] button
   **Then** I see the same confirmation dialog as from the list
   **And** on confirm, the vendor is deleted and I'm redirected to `/vendors`

### AC #8: Handle Not Found

9. **Given** I try to access `/vendors/:id` with an invalid or other-account ID
   **When** the page loads
   **Then** I see 404 "Vendor not found" via snackbar
   **And** I am redirected to `/vendors`

## Tasks / Subtasks

### Task 1: Create Vendor Detail Component (AC: #1-#5)
- [x] 1.1 Create `vendor-detail.component.ts` at `frontend/src/app/features/vendors/components/vendor-detail/`
- [x] 1.2 Implement template with:
  - Page header with vendor full name and back button
  - Contact information section (phones with labels, emails)
  - Trade tags section (chips matching list style)
  - Work Order History section (placeholder)
  - Action buttons ([Edit], [Delete])
- [x] 1.3 Inject `VendorStore`, `ActivatedRoute`, `Router`, `MatDialog`
- [x] 1.4 Load vendor on init using `vendorStore.loadVendor(id)`
- [x] 1.5 Display loading spinner while loading
- [x] 1.6 Handle 404 error (already in store.loadVendor - redirects to /vendors)

### Task 2: Update Routing Configuration (AC: #1, #6)
- [x] 2.1 Change `vendors/:id` route to load `VendorDetailComponent`
- [x] 2.2 Add new route `vendors/:id/edit` to load existing `VendorEditComponent`
- [x] 2.3 Keep `unsavedChangesGuard` on the edit route only

### Task 3: Update Vendor Edit Component (AC: #6)
- [x] 3.1 Update VendorEditComponent to extract ID from `/vendors/:id/edit` route
- [x] 3.2 Update navigation after save to go to `/vendors/:id` (detail) instead of `/vendors` (list)
- [x] 3.3 Update cancel navigation to go to `/vendors/:id` (detail)

### Task 4: Add Delete Functionality to Detail Page (AC: #7)
- [x] 4.1 Add delete button to detail page template
- [x] 4.2 Reuse `onDeleteClick` pattern from `VendorsComponent`
- [x] 4.3 On successful delete, navigate to `/vendors` (list)

### Task 5: Update Vendor Store Navigation (AC: #7, #8)
- [x] 5.1 Add `deleteVendorFromDetail` method that navigates to list after delete
- [x] 5.2 Ensure `loadVendor` 404 handling navigates to `/vendors` (already implemented)

### Task 6: Frontend Unit Tests (AC: #1-#8)
- [x] 6.1 Test VendorDetailComponent renders vendor info correctly
- [x] 6.2 Test VendorDetailComponent displays phones with labels
- [x] 6.3 Test VendorDetailComponent displays emails
- [x] 6.4 Test VendorDetailComponent displays trade tags as chips
- [x] 6.5 Test VendorDetailComponent shows work order placeholder
- [x] 6.6 Test edit button navigates to /vendors/:id/edit
- [x] 6.7 Test delete button opens confirmation dialog
- [x] 6.8 Test delete confirmation calls store and navigates away

### Task 7: E2E Tests (AC: #1-#8) - Verified with Playwright MCP
- [x] 7.1 Test clicking vendor row navigates to detail page (`/vendors/:id`)
- [x] 7.2 Test detail page displays vendor name, contact info sections, trade tags chips
- [x] 7.3 Test edit button navigates to edit page (`/vendors/:id/edit`)
- [x] 7.4 Test delete button opens confirmation dialog with correct message
- [x] 7.5 Test cancel in edit navigates back to detail page
- [x] 7.6 Test back button navigates to vendor list (`/vendors`)

**E2E Test Results (Playwright - 2026-01-18):**
- 119 E2E tests passing (including 13 new vendor-detail.spec.ts tests)
- All navigation flows verified
- Vendor detail page displays correctly with all sections
- Edit/Delete buttons functional
- Dialog shows correct confirmation message
- Updated existing vendor tests for new routing structure

## Dev Notes

### Architecture Compliance

**Frontend Structure (following property detail pattern):**
```
frontend/src/app/features/vendors/
├── components/
│   ├── vendor-detail/
│   │   ├── vendor-detail.component.ts     ← NEW
│   │   └── vendor-detail.component.spec.ts ← NEW
│   ├── vendor-edit/
│   │   ├── vendor-edit.component.ts       ← UPDATE (route param change)
│   │   └── vendor-edit.component.spec.ts  ← UPDATE
│   └── vendor-form/
│       └── vendor-form.component.ts       ← UNCHANGED
├── stores/
│   └── vendor.store.ts                    ← MINOR UPDATE (delete navigation)
├── vendors.component.ts                   ← UNCHANGED
└── vendors.component.spec.ts              ← UNCHANGED

frontend/src/app/app.routes.ts             ← UPDATE (route restructure)
```

**Route Changes (to match property pattern):**
```typescript
// BEFORE (current):
{ path: 'vendors/:id', loadComponent: VendorEditComponent }

// AFTER (property pattern):
{ path: 'vendors/:id', loadComponent: VendorDetailComponent }
{ path: 'vendors/:id/edit', loadComponent: VendorEditComponent, canDeactivate: [unsavedChangesGuard] }
```

### Current Implementation Status

**Already Implemented:**
- VendorStore with `loadVendor`, `deleteVendor` methods
- VendorDetailDto with phones, emails, tradeTags
- GetVendor API endpoint returning full details
- VendorEditComponent for editing (needs route param update)
- ConfirmDialogComponent (shared)
- Delete functionality in VendorStore

**Missing (this story's focus):**
- VendorDetailComponent (read-only view)
- Route restructure (detail vs edit)
- Work Order History placeholder section

### Property Detail Pattern Reference

Use `property-detail.component.ts` as the template pattern:
```typescript
// Key structural elements from property detail:
@Component({
  selector: 'app-vendor-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
  ],
  template: `
    <div class="detail-container">
      <!-- Header with back button -->
      <div class="page-header">
        <button mat-icon-button routerLink="/vendors">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ vendorStore.selectedVendor()?.fullName }}</h1>
        <div class="actions">
          <button mat-stroked-button [routerLink]="['/vendors', vendorId, 'edit']">
            <mat-icon>edit</mat-icon>
            Edit
          </button>
          <button mat-stroked-button color="warn" (click)="onDeleteClick()">
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        </div>
      </div>

      <!-- Content sections -->
      ...
    </div>
  `
})
```

### Vendor Store Delete Pattern

The store already has `deleteVendor` which removes from list. For detail page, we need to:
1. Call existing `deleteVendor`
2. Navigate to `/vendors` after delete completes

The navigation can happen in the component after dialog closes, or we can add a variant method.

### Previous Story Learnings (8-8-delete-vendor)

1. **Test Baselines:** Frontend: 891 tests, Backend: 639 tests
2. **Shared Components:** ConfirmDialogComponent already exists at `frontend/src/app/shared/components/confirm-dialog/`
3. **Store Pattern:** VendorStore follows rxMethod pattern with patchState
4. **Snackbar Pattern:** 3000ms duration for success, 5000ms for errors
5. **Delete Dialog Config:**
   ```typescript
   const dialogData: ConfirmDialogData = {
     title: `Delete ${vendor.fullName}?`,
     message: "This vendor will be removed from your list. Work orders assigned to this vendor will show 'Deleted Vendor'.",
     confirmText: 'Delete',
     cancelText: 'Cancel',
     icon: 'warning',
     iconColor: 'warn',
   };
   ```

### Trade Tag Chip Styling (from vendors.component.ts)

```scss
.trade-tag-chip {
  display: inline-block;
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
```

### Work Order History Placeholder

Since Work Orders aren't implemented yet (Epic 9), show a placeholder:
```html
<mat-card class="section-card">
  <h3>Work Order History</h3>
  <div class="empty-state">
    <mat-icon>assignment</mat-icon>
    <p>No work orders yet for this vendor</p>
  </div>
</mat-card>
```

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR13 | Users can view a vendor's work order history | Placeholder section ready for Epic 9 |
| FR9 | Users can view a list of all vendors | Detail page accessible from list |
| FR11 | Users can edit vendor details | Edit button navigates to edit page |
| FR12 | Users can delete a vendor | Delete button with confirmation |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - Vendor entity and API
- [Source: epics-work-orders-vendors.md#Story 1.9] - Original story definition
- [Source: property-detail.component.ts] - Pattern reference for detail page
- [Source: 8-8-delete-vendor.md] - Previous story learnings and delete pattern
- [Source: vendor.store.ts] - Existing store with loadVendor, deleteVendor
- [Source: app.routes.ts] - Current routing configuration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **VendorDetailComponent Created** - New read-only detail page at `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.ts` following the property-detail pattern:
   - Displays vendor name, phones with labels, emails, and trade tags
   - Work Order History placeholder section for future Epic 9
   - Edit and Delete action buttons
   - Loading state with spinner
   - Responsive design for mobile

2. **Routing Updated** - Modified `app.routes.ts` to:
   - `vendors/:id` → VendorDetailComponent (read-only view)
   - `vendors/:id/edit` → VendorEditComponent (edit form with unsavedChangesGuard)

3. **VendorEditComponent Updated** - Updated navigation:
   - Cancel now navigates to vendor detail instead of list
   - Save success navigates to vendor detail instead of list

4. **VendorStore Updated** - After vendor update, navigates to detail page

5. **Unit Tests Added** - 30 new tests in `vendor-detail.component.spec.ts` covering:
   - Component initialization and loading
   - Vendor info display (name, phones, emails, tags)
   - Work order placeholder display
   - Edit navigation
   - Delete confirmation dialog
   - Delete execution with store and navigation

6. **All 928 Frontend Tests Pass** - No regressions introduced

7. **E2E Tests Updated & Extended** - 119 total E2E tests passing:
   - Created `vendor-detail.spec.ts` with 13 new tests for detail page functionality
   - Updated `vendor.page.ts` with new detail page locators/actions/assertions
   - Updated `vendor-edit.spec.ts` for new routing (`/vendors/:id/edit`)
   - Updated `vendor-list.spec.ts` - clicking vendor goes to detail page now
   - Updated `vendor-search-filter.spec.ts` helpers for new routing flow

### File List

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.ts` | Created | New vendor detail component |
| `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.spec.ts` | Created | Unit tests for vendor detail component |
| `frontend/src/app/app.routes.ts` | Modified | Added vendor detail route, moved edit to /edit path |
| `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.ts` | Modified | Updated cancel navigation to detail page |
| `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.spec.ts` | Modified | Updated test for new cancel navigation |
| `frontend/src/app/features/vendors/stores/vendor.store.ts` | Modified | Updated post-save navigation to detail page |
| `frontend/e2e/pages/vendor.page.ts` | Modified | Added vendor detail page locators, actions, and assertions |
| `frontend/e2e/tests/vendors/vendor-detail.spec.ts` | Created | E2E tests for vendor detail page (13 tests) |
| `frontend/e2e/tests/vendors/vendor-edit.spec.ts` | Modified | Updated for new routing (/vendors/:id/edit) |
| `frontend/e2e/tests/vendors/vendor-list.spec.ts` | Modified | Updated navigation expectations for detail page |
| `frontend/e2e/tests/vendors/vendor-search-filter.spec.ts` | Modified | Updated helper functions for new routing |

