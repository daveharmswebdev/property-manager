# Story 2.5: Delete Property

Status: done

## Story

As a property owner,
I want to delete a property I no longer manage,
so that it doesn't clutter my portfolio.

## Acceptance Criteria

1. **AC-2.5.1**: Delete button shows modal confirmation dialog
   - Delete button visible on property detail page (`/properties/:id`)
   - Clicking [Delete] opens confirmation modal dialog
   - Modal title: "Delete [Property Name]?"
   - Modal message: "This will remove the property from your active portfolio. Historical expense and income records will be preserved for tax purposes."
   - Modal has [Cancel] and [Delete] buttons
   - Delete button styled as destructive (red)

2. **AC-2.5.2**: Confirming delete soft-deletes property
   - When user confirms deletion, DELETE request sent to API
   - API sets `DeletedAt` timestamp on property record
   - Property remains in database (soft delete, not hard delete)
   - Returns 204 No Content on success
   - Returns 404 Not Found if property doesn't exist or belongs to different account

3. **AC-2.5.3**: Related expenses and income are preserved (NOT deleted)
   - All Expense records linked to the property remain in database with DeletedAt = null
   - All Income records linked to the property remain in database with DeletedAt = null
   - All Receipt records linked to the property remain in database with DeletedAt = null
   - Historical financial data preserved for tax reporting purposes
   - Related records remain accessible via direct query if needed for tax reports

4. **AC-2.5.4**: Success feedback and navigation
   - Snackbar shows "Property deleted" with success styling
   - User redirected to Dashboard (`/dashboard`)
   - Snackbar auto-dismisses after 3 seconds

5. **AC-2.5.5**: Deleted property excluded from all lists
   - Property no longer appears in Dashboard property list
   - Property no longer appears in property dropdowns
   - Stats bar totals no longer include deleted property's expenses/income
   - Direct navigation to `/properties/{deleted-id}` returns 404 page
   - API returns 404 for any requests to deleted property

## Tasks / Subtasks

- [ ] Task 1: Create DeleteProperty Command and Handler (AC: 2.5.2, 2.5.3)
  - [ ] Create `DeletePropertyCommand.cs` in Application/Properties with PropertyId
  - [ ] Create `DeletePropertyHandler.cs` implementing IRequestHandler
  - [ ] Handler validates property exists and belongs to user's account
  - [ ] Handler sets DeletedAt timestamp on Property entity
  - [ ] Handler does NOT cascade delete to Expenses, Income, or Receipts (preserved for tax records)
  - [ ] Throw NotFoundException if property not found (returns 404)
  - [ ] Write unit tests for DeletePropertyHandler (5+ tests: success, not found, wrong account, already deleted, verify no cascade)

- [ ] Task 2: Add DELETE Endpoint to PropertiesController (AC: 2.5.2, 2.5.5)
  - [ ] Add `DELETE /api/v1/properties/{id}` endpoint accepting property ID
  - [ ] Return 204 No Content on successful deletion
  - [ ] Return 404 Not Found when property doesn't exist or wrong account
  - [ ] Return 401 Unauthorized if no valid JWT
  - [ ] Update Swagger documentation
  - [ ] Write integration tests for DELETE endpoint (5+ tests: success, not found, unauthorized, wrong account, already deleted)

- [ ] Task 3: Add deleteProperty method to PropertyService (AC: 2.5.2)
  - [ ] Add `deleteProperty(id: string)` method to property.service.ts
  - [ ] Returns Observable<void> (204 response)
  - [ ] Handle 404 error responses appropriately

- [ ] Task 4: Add delete functionality to PropertyStore (AC: 2.5.2, 2.5.4, 2.5.5)
  - [ ] Add `deleteProperty(id: string)` rxMethod to property.store.ts
  - [ ] Add `isDeleting` signal for loading state
  - [ ] Add `deleteError` signal for error state
  - [ ] On success: Remove property from local state, show snackbar, navigate to dashboard
  - [ ] On error: Set deleteError, show error snackbar
  - [ ] Write unit tests for delete functionality in property.store.spec.ts

- [ ] Task 5: Add delete button and confirmation to PropertyDetailComponent (AC: 2.5.1)
  - [ ] Add [Delete] button to property detail page template
  - [ ] Style button as destructive (red, mat-warn)
  - [ ] Wire click handler to show confirmation dialog
  - [ ] Pass property name to dialog for personalized message

- [ ] Task 6: Create DeletePropertyDialogComponent (AC: 2.5.1)
  - [ ] Create `features/properties/delete-property-dialog/delete-property-dialog.component.ts`
  - [ ] Accept property name via MAT_DIALOG_DATA injection
  - [ ] Display confirmation message with property name
  - [ ] Display warning about data loss
  - [ ] [Cancel] button closes dialog with false result
  - [ ] [Delete] button closes dialog with true result
  - [ ] Style Delete button as destructive (mat-warn)
  - [ ] Write unit tests for DeletePropertyDialogComponent

- [ ] Task 7: Wire up delete flow in PropertyDetailComponent (AC: 2.5.1, 2.5.4, 2.5.5)
  - [ ] Import DeletePropertyDialogComponent and MatDialog
  - [ ] On delete click: Open DeletePropertyDialogComponent
  - [ ] On dialog confirm (true result): Call propertyStore.deleteProperty(id)
  - [ ] On dialog cancel (false result): Do nothing, stay on page
  - [ ] Handle loading state (disable button while deleting)
  - [ ] Write unit tests for delete flow in property-detail.component.spec.ts

- [ ] Task 8: Verify Global Query Filters and Data Preservation (AC: 2.5.3, 2.5.5)
  - [ ] Verify Property entity has DeletedAt global query filter in AppDbContext
  - [ ] Write integration test: Delete property, then GET /properties returns filtered list
  - [ ] Write integration test: Delete property, then GET /properties/{id} returns 404
  - [ ] Write integration test: Delete property with expenses, verify expenses still exist with DeletedAt = null
  - [ ] Write integration test: Verify deleted property's expenses still accessible for tax reports (future Epic 6)

- [ ] Task 9: Run Tests and Validate
  - [ ] Backend unit tests pass (new DeletePropertyHandler tests)
  - [ ] Backend integration tests pass (new DELETE endpoint tests)
  - [ ] Frontend component tests pass
  - [ ] Frontend builds successfully
  - [ ] Backend builds successfully
  - [ ] Manual smoke test checklist completed

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Application Layer: `DeletePropertyCommand`, `DeletePropertyHandler` in Properties folder
- Domain exceptions: `NotFoundException` (reuse from Story 2.4) for 404 responses
- API Layer: `PropertiesController` DELETE endpoint returns 204/404
- Multi-tenant filtering via ICurrentUser.AccountId
- Soft delete pattern: Set DeletedAt timestamp, don't physically remove records
- NO cascade delete: Related expenses/income/receipts preserved for tax records

**Data Preservation Strategy (No Cascade Delete):**
The handler soft-deletes ONLY the property, preserving all related financial records for tax purposes:
```csharp
// Pseudo-code - property only, no cascade
var property = await _context.Properties.FindAsync(id);
if (property == null || property.AccountId != currentUser.AccountId)
    throw new NotFoundException("Property", id);

property.DeletedAt = DateTime.UtcNow;

await _context.SaveChangesAsync();

// Related Expenses, Income, Receipts are NOT touched
// They remain in database for historical tax reporting (Epic 6)
```

**Why No Cascade Delete:**
- Tax records must be preserved even after property is sold/removed
- Schedule E reports need historical expense/income data
- User may want to generate reports for previous tax years
- Orphaned records (expenses without active property) are acceptable for reporting purposes

**Frontend Component Patterns:**
- Reuse ConfirmDialogComponent pattern from Story 2.4 OR create dedicated DeletePropertyDialogComponent
- PropertyStore extended with deleteProperty rxMethod
- Navigation after delete uses Angular Router to redirect to /dashboard
- MatSnackBar for success/error feedback

**UX Patterns (from UX Design doc):**
- Destructive actions on important data require modal confirmation
- Modal has [Cancel] and [Delete] buttons
- Delete button styled red (destructive)
- Snackbar at bottom-center, auto-dismiss after 3 seconds

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Properties/
    └── DeleteProperty.cs              # Command + Handler
backend/tests/PropertyManager.Application.Tests/Properties/
    └── DeletePropertyHandlerTests.cs  # Unit tests
```

**Frontend files to create:**
```
frontend/src/app/features/properties/delete-property-dialog/
    ├── delete-property-dialog.component.ts
    └── delete-property-dialog.component.spec.ts
```

**Frontend files to modify:**
```
frontend/src/app/features/properties/services/property.service.ts
frontend/src/app/features/properties/stores/property.store.ts
frontend/src/app/features/properties/property-detail/property-detail.component.ts
frontend/src/app/features/properties/property-detail/property-detail.component.html
```

### Learnings from Previous Story

**From Story 2-4-edit-property (Status: done)**

- **ConfirmDialogComponent Created**: Reusable shared component at `shared/components/confirm-dialog/confirm-dialog.component.ts` - accepts title, message, confirmText, cancelText via MAT_DIALOG_DATA. Can potentially reuse for delete confirmation OR create dedicated DeletePropertyDialogComponent for more control over styling.

- **NotFoundException Pattern**: `NotFoundException.cs` exists at `Domain/Exceptions/NotFoundException.cs` - reuse for 404 handling when property not found

- **PropertyStore Extended**: Has rxMethod pattern established with `updateProperty`, `isUpdating`, `updateError` signals - follow same pattern for `deleteProperty`, `isDeleting`, `deleteError`

- **PropertyService Pattern**: Has `updateProperty(id, data)` method returning Observable<void> - add `deleteProperty(id)` with same pattern

- **Test Patterns**: Unit tests follow `Method_Scenario_ExpectedResult` naming. Integration tests cover success, validation, auth, tenant isolation scenarios.

- **Frontend Test Gaps (Technical Debt)**: Story 2.4 review noted missing tests for PropertyEditComponent, UnsavedChangesGuard, ConfirmDialogComponent. These are pre-existing gaps - ensure this story's new components have proper test coverage.

**Pending Review Items from Story 2.4:**
- [ ] [Med] Missing property-edit.component.spec.ts - not directly relevant to this story
- [ ] [Med] Missing unsaved-changes.guard.spec.ts - not directly relevant to this story
- [ ] [Med] Missing confirm-dialog.component.spec.ts - if reusing ConfirmDialogComponent, consider adding tests

[Source: docs/sprint-artifacts/2-4-edit-property.md#Dev-Agent-Record]

### Data Model Reference

**DeleteProperty Flow:**
```
DELETE /api/v1/properties/{id}
    → Validate JWT
    → Validate property exists with matching AccountId
    → Set Property.DeletedAt = DateTime.UtcNow
    → SaveChanges
    → Return 204 No Content

Note: Related Expenses, Income, Receipts are NOT modified.
They remain accessible for historical tax reporting.
```

**Backend Command:**
```csharp
public record DeletePropertyCommand(Guid Id) : IRequest;
```

### Testing Strategy

**Unit Tests (xUnit):**
- `DeletePropertyHandlerTests`:
  - Handle_ValidProperty_SetsDeletedAt
  - Handle_PropertyNotFound_ThrowsNotFoundException
  - Handle_PropertyBelongsToOtherAccount_ThrowsNotFoundException
  - Handle_AlreadyDeletedProperty_ThrowsNotFoundException
  - Handle_PropertyWithExpenses_DoesNotCascadeDelete (verify expenses preserved)

**Integration Tests (xUnit):**
- `PropertiesControllerTests`:
  - Delete_ValidProperty_Returns204
  - Delete_NonExistentProperty_Returns404
  - Delete_OtherAccountProperty_Returns404
  - Delete_WithoutAuth_Returns401
  - Delete_VerifyGlobalFilterExcludes
  - Delete_PropertyWithExpenses_PreservesExpenses (verify no cascade)

**Component Tests (Vitest):**
- `DeletePropertyDialogComponent`: Renders message with property name, button clicks return correct values
- `PropertyDetailComponent`: Delete button click opens dialog, dialog result triggers delete, loading states

**Manual Verification Checklist:**
```markdown
## Smoke Test: Delete Property

### API Verification
- [ ] DELETE /api/v1/properties/{id} returns 204
- [ ] DELETE /api/v1/properties/{invalid-id} returns 404
- [ ] DELETE /api/v1/properties/{other-account-id} returns 404
- [ ] DeletedAt timestamp set on property after delete

### Database Verification
- [ ] Property record still exists with DeletedAt populated
- [ ] Related Expense records still exist with DeletedAt = null (NOT deleted)
- [ ] Related Income records still exist with DeletedAt = null (NOT deleted)
- [ ] Related Receipt records still exist with DeletedAt = null (NOT deleted)

### Frontend Verification
- [ ] [Delete] button visible on property detail page
- [ ] Clicking [Delete] opens confirmation dialog
- [ ] Dialog shows property name in message
- [ ] Dialog mentions records are preserved for tax purposes
- [ ] Dialog has [Cancel] and [Delete] buttons
- [ ] [Cancel] closes dialog without deleting
- [ ] [Delete] shows loading state and processes delete
- [ ] Success snackbar "Property deleted" appears
- [ ] Redirected to dashboard after delete
- [ ] Deleted property not in dashboard list
- [ ] Navigating to deleted property URL shows 404

### Data Preservation Verification
- [ ] Create property with expenses
- [ ] Delete property
- [ ] Verify expenses still exist in database with DeletedAt = null
- [ ] Verify expenses still accessible via direct database query (for future tax reports)
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Story 2.5: Delete Property] - Acceptance Criteria AC-2.5.1 through AC-2.5.5
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Workflows - Delete Property Flow] - Delete workflow sequence
- [Source: docs/epics.md#Story 2.5: Delete Property] - Epic-level story definition
- [Source: docs/architecture.md#Data Architecture] - Soft delete pattern with DeletedAt
- [Source: docs/architecture.md#API Contracts] - DELETE returns 204 No Content
- [Source: docs/ux-design-specification.md#7.6 Confirmation Patterns] - Modal confirmation for destructive actions on important data
- [Source: docs/sprint-artifacts/2-4-edit-property.md] - Previous story patterns (ConfirmDialogComponent, NotFoundException, PropertyStore)

**Note - Deviation from Tech Spec:**
AC-2.5.3 in tech spec states "Related expenses/income cascade soft-deleted." This story intentionally deviates: related records are PRESERVED (not cascade deleted) to maintain tax record integrity. Historical expense/income data must remain accessible for Schedule E report generation (Epic 6) even after a property is removed from the active portfolio.

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-03 | Initial story draft created | SM Agent (Create Story Workflow) |
