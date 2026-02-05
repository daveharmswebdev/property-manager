# Story 11.8: Work Order Dropdown on Receipt Processing

Status: review

## Story

As a **property owner**,
I want **to link a receipt to a work order while processing it**,
So that **I can connect receipts to repairs in my normal workflow without extra steps**.

## Acceptance Criteria

### AC #1: Work Order Dropdown on Receipt Processing Form

**Given** I am processing a receipt (creating expense from receipt at `/receipts/:id`)
**When** I view the receipt processing form (right panel)
**Then** I see a "Work Order (optional)" dropdown field below the Description field
**And** the dropdown shows "None" as the default selection

### AC #2: Dropdown Populates Based on Selected Property

**Given** I have selected a property for the expense
**When** the Work Order dropdown loads
**Then** I see work orders filtered by:
- Same property as selected
- Status is "Reported" or "Assigned" (active work orders only)
- Sorted by most recently created
**And** each option shows: truncated description (max 60 chars) and status in parentheses

### AC #3: Dropdown Disabled When No Property Selected

**Given** no property is selected yet
**When** I view the Work Order dropdown
**Then** it is disabled with hint text "Select a property first"

### AC #4: Work Order Selection Saved with Expense

**Given** I select a work order from the dropdown
**When** I complete receipt processing and click "Save"
**Then** the expense is created with `WorkOrderId` set to the selected work order
**And** the receipt is marked as processed
**And** I see snackbar "Expense saved with receipt"

### AC #5: No Work Order Selection (Optional)

**Given** I don't select a work order (leave as "None")
**When** I complete receipt processing
**Then** the expense is created without a work order link (`WorkOrderId = NULL`)
**And** the receipt is processed normally

### AC #6: Property Change Clears Work Order Selection

**Given** I have selected a work order
**When** I change the selected property
**Then** the work order selection is cleared (reset to "None")
**And** the dropdown reloads with work orders for the new property

### AC #7: No Active Work Orders for Property

**Given** I select a property that has no active work orders
**When** I open the Work Order dropdown
**Then** I see only the "None" option
**And** the dropdown is still enabled (user can check)

## Tasks / Subtasks

### Task 1: Add WorkOrderId to Backend ProcessReceipt Command (AC: #4, #5)

- [x] 1.1 Update `ProcessReceiptCommand` in `backend/src/PropertyManager.Application/Receipts/ProcessReceipt.cs`:
  ```csharp
  public record ProcessReceiptCommand(
      Guid ReceiptId,
      Guid PropertyId,
      decimal Amount,
      DateOnly Date,
      Guid CategoryId,
      string? Description,
      Guid? WorkOrderId    // NEW - optional work order link
  ) : IRequest<Guid>;
  ```

- [x] 1.2 Update `ProcessReceiptHandler.Handle()` to set `WorkOrderId` when creating expense:
  ```csharp
  var expense = new Expense
  {
      // ... existing fields ...
      WorkOrderId = request.WorkOrderId,  // NEW
  };
  ```

- [x] 1.3 Update `ProcessReceiptValidator` - add conditional validation:
  ```csharp
  RuleFor(x => x.WorkOrderId)
      .MustAsync(async (cmd, woId, ct) =>
      {
          if (woId == null) return true;
          return await context.WorkOrders
              .AnyAsync(w => w.Id == woId && w.AccountId == currentUser.AccountId && w.DeletedAt == null, ct);
      })
      .WithMessage("Work order not found")
      .When(x => x.WorkOrderId.HasValue);
  ```

### Task 2: Update ProcessReceipt API Endpoint (AC: #4, #5)

- [x] 2.1 Update `ProcessReceiptRequest` record in `backend/src/PropertyManager.Api/Controllers/ReceiptsController.cs`:
  ```csharp
  public record ProcessReceiptRequest(
      Guid PropertyId,
      decimal Amount,
      string Date,
      Guid CategoryId,
      string? Description = null,
      Guid? WorkOrderId = null    // NEW
  );
  ```

- [x] 2.2 Update the `ProcessReceipt` endpoint to pass `WorkOrderId` to the command:
  ```csharp
  var command = new ProcessReceiptCommand(
      id,
      request.PropertyId,
      request.Amount,
      DateOnly.Parse(request.Date),
      request.CategoryId,
      request.Description,
      request.WorkOrderId    // NEW
  );
  ```

### Task 3: Backend Unit Tests (AC: #4, #5)

- [x] 3.1 Add test: `Handle_WithWorkOrderId_CreatesExpenseLinkedToWorkOrder`
  - Create work order and unprocessed receipt
  - Process receipt with WorkOrderId set
  - Assert expense.WorkOrderId equals the work order ID

- [x] 3.2 Add test: `Handle_WithoutWorkOrderId_CreatesExpenseWithNullWorkOrderId`
  - Process receipt with WorkOrderId = null
  - Assert expense.WorkOrderId is null

- [x] 3.3 Add test: `Handle_WithInvalidWorkOrderId_ReturnsValidationError`
  - Process receipt with non-existent WorkOrderId
  - Assert validation failure

- [x] 3.4 Add test: `Handle_WithWorkOrderFromDifferentAccount_ReturnsValidationError`
  - Process receipt with WorkOrderId from another account
  - Assert validation failure (tenant isolation)

### Task 4: Regenerate TypeScript API Client

- [x] 4.1 Run `npm run generate-api` from `/frontend` to regenerate the NSwag API client
- [x] 4.2 Verify `ProcessReceiptRequest` in generated `api.service.ts` now includes `workOrderId?: string`

### Task 5: Add Work Order Dropdown to Receipt Expense Form (AC: #1, #2, #3, #6, #7)

- [x] 5.1 In `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts`:
  - Add import: `WorkOrderService` and `WorkOrderDto`
  - Inject `WorkOrderService`
  - Add `workOrderId` form control (no validators - optional field):
    ```typescript
    this.form = this.fb.group({
      // ... existing controls ...
      workOrderId: [''],  // NEW - optional
    });
    ```
  - Add signals:
    ```typescript
    protected readonly workOrders = signal<WorkOrderDto[]>([]);
    protected readonly isLoadingWorkOrders = signal(false);
    ```

- [x] 5.2 Add work order loading when property changes:
  ```typescript
  private loadWorkOrders(propertyId: string): void {
    this.isLoadingWorkOrders.set(true);
    this.workOrderService.getWorkOrdersByProperty(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Filter to active work orders only (Reported, Assigned)
          const active = response.items.filter(
            wo => wo.status === 'Reported' || wo.status === 'Assigned'
          );
          this.workOrders.set(active);
          this.isLoadingWorkOrders.set(false);
        },
        error: () => {
          this.workOrders.set([]);
          this.isLoadingWorkOrders.set(false);
        },
      });
  }
  ```

- [x] 5.3 Wire property selection change to load work orders and reset selection:
  - When property changes: call `loadWorkOrders(propertyId)` and reset `workOrderId` control to `''`
  - When property cleared: clear `workOrders` signal and disable dropdown

- [x] 5.4 Add dropdown template after the Description field:
  ```html
  <mat-form-field appearance="outline" class="full-width">
    <mat-label>Work Order (optional)</mat-label>
    <mat-select formControlName="workOrderId"
      [disabled]="!form.controls.propertyId.value"
      data-testid="work-order-select">
      @if (isLoadingWorkOrders()) {
        <mat-option disabled>Loading work orders...</mat-option>
      } @else {
        <mat-option value="">None</mat-option>
        @for (wo of workOrders(); track wo.id) {
          <mat-option [value]="wo.id">
            {{ wo.description.length > 60 ? (wo.description | slice:0:60) + '...' : wo.description }}
            ({{ wo.status }})
          </mat-option>
        }
      }
    </mat-select>
    @if (!form.controls.propertyId.value) {
      <mat-hint>Select a property first</mat-hint>
    }
  </mat-form-field>
  ```

- [x] 5.5 Include `workOrderId` in the API submit call:
  ```typescript
  const workOrderId = this.form.value.workOrderId || undefined;

  this.api.receipts_ProcessReceipt(this.receiptId(), {
    propertyId,
    amount,
    date: formattedDate,
    categoryId,
    description: description?.trim(),
    workOrderId,    // NEW - pass through to backend
  }).subscribe({ ... });
  ```

- [x] 5.6 Import `MatSelectModule` if not already imported (check existing imports)

### Task 6: Frontend Unit Tests (AC: ALL)

- [x] 6.1 Update `receipt-expense-form.component.spec.ts`:
  - Test: Work order dropdown renders in form
  - Test: Dropdown disabled when no property selected
  - Test: Dropdown shows "Select a property first" hint when no property
  - Test: Dropdown loads work orders when property selected
  - Test: Only active work orders shown (Reported, Assigned) - not Completed
  - Test: "None" option always available
  - Test: Work order description truncated at 60 chars with ellipsis
  - Test: Loading state shows "Loading work orders..."
  - Test: Changing property clears work order selection
  - Test: Changing property loads new work orders
  - Test: Form valid without work order selection
  - Test: Submit includes workOrderId when selected
  - Test: Submit sends undefined workOrderId when "None" selected

## Dev Notes

### Architecture: Full-Stack Story (Backend + Frontend)

Unlike Stories 11-2 through 11-7 which were purely frontend, this story requires **backend changes** because the receipt processing endpoint (`POST /api/v1/receipts/{id}/process`) currently does not accept a `WorkOrderId` parameter. The receipt processing uses its own dedicated command/handler, not the generic expense create endpoint.

**Backend Change Summary:**
- `ProcessReceiptCommand` + `ProcessReceiptRequest` + `ProcessReceiptHandler` + `ProcessReceiptValidator`
- Small, additive changes - adding one optional `Guid?` field through the pipeline

**Frontend Change Summary:**
- `receipt-expense-form.component.ts` - Add work order dropdown (follow Story 11-2 pattern exactly)

### Critical: Follow the Expense Form Pattern (Story 11-2)

The expense form (`expense-form.component.ts`) already has a working work order dropdown from Story 11-2. **Copy the exact same pattern**:
- Same imports (`WorkOrderService`, `WorkOrderDto`)
- Same signals (`workOrders`, `isLoadingWorkOrders`)
- Same `loadWorkOrders()` method using `getWorkOrdersByProperty()`
- Same template structure with `mat-select`, "None" option, truncated descriptions
- Same disabled state when no property selected

**DO NOT** reinvent this. The pattern is proven and working.

### Key Files to Modify

| File | Change | Layer |
|------|--------|-------|
| `backend/src/PropertyManager.Application/Receipts/ProcessReceipt.cs` | Add `Guid? WorkOrderId` to command + handler | Backend |
| `backend/src/PropertyManager.Api/Controllers/ReceiptsController.cs` | Add `Guid? WorkOrderId` to request record + pass to command | Backend |
| `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts` | Add work order dropdown | Frontend |
| `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts` | Add tests for work order dropdown | Frontend |

### Key Files to Reference (DO NOT modify)

| File | What to Reuse |
|------|---------------|
| `frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts` | Work order dropdown pattern (Story 11-2) |
| `frontend/src/app/features/work-orders/services/work-order.service.ts` | `getWorkOrdersByProperty()` method |
| `frontend/src/app/features/work-orders/services/work-order.service.ts` | `WorkOrderDto` interface |

### Backend ProcessReceipt Pipeline (Current State)

```
ReceiptsController.ProcessReceipt()
  → ProcessReceiptCommand (record)
  → ProcessReceiptValidator (FluentValidation)
  → ProcessReceiptHandler (creates Expense, marks Receipt processed)
```

All three files need `WorkOrderId` added. The handler simply sets it on the Expense entity which already has the `WorkOrderId` nullable FK (added in Story 11-1).

### WorkOrderService.getWorkOrdersByProperty() Shape

```typescript
getWorkOrdersByProperty(propertyId: string, limit?: number):
  Observable<{ items: WorkOrderDto[], totalCount: number }>
```

This returns ALL work orders for the property. The frontend must filter to active statuses ("Reported", "Assigned") before displaying.

### WorkOrderDto Shape

```typescript
interface WorkOrderDto {
  id: string;
  propertyId: string;
  propertyName: string;
  vendorId?: string;
  vendorName?: string;
  isDiy: boolean;
  categoryId?: string;
  categoryName?: string;
  status: string;  // "Reported" | "Assigned" | "Completed"
  description: string;
  createdAt: string;
  createdByUserId: string;
  tags: WorkOrderTagDto[];
  primaryPhotoThumbnailUrl?: string;
}
```

### Receipt Expense Form Current Inputs

```typescript
receiptId = input.required<string>();
propertyId = input<string | undefined>();   // Pre-selected from receipt
defaultDate = input.required<string>();     // Receipt createdAt date
```

The `propertyId` input is used for pre-selection but the user can change it via the dropdown. The work order loading must hook into the property dropdown `valueChanges`, not just the input.

### NSwag API Client Regeneration

After backend changes, run `npm run generate-api` from `/frontend`. This regenerates `api.service.ts` from Swagger. The `ProcessReceiptRequest` interface will automatically get the new `workOrderId?: string` field.

### Previous Story Intelligence (11.7)

From Story 11.7:
- Frontend: 2,219+ tests passing, 0 failures
- Components use inline templates, standalone, `@if`/`@for` control flow
- Signal-based inputs: `input()` and `input.required()`
- `signal()` for reactive state, `computed()` for derived state
- `MatDialog` patterns established for all Epic 11 stories
- `MatSnackBar` for user feedback

### Testing Standards

**Backend (xUnit):**
- Tests in `PropertyManager.Application.Tests`
- Use `AppDbContext` in-memory or test fixtures
- One assertion per test, descriptive names
- Follow `Handle_Scenario_ExpectedResult` naming

**Frontend (Vitest):**
- Run with `npm test` (NEVER `npx vitest`)
- Co-located `.spec.ts` files
- Mock `WorkOrderService.getWorkOrdersByProperty()` returning `of({ items: [...], totalCount: n })`
- Mock `ApiClient.receipts_ProcessReceipt()` returning `of({ expenseId: 'new-id' })`
- Use `TestBed.configureTestingModule()` with mock providers

**Pattern for mocking WorkOrderService (from Story 11-2):**
```typescript
const mockWorkOrderService = {
  getWorkOrdersByProperty: vi.fn().mockReturnValue(of({
    items: [
      { id: 'wo-1', description: 'Fix leaky faucet', status: 'Reported', propertyId: 'prop-1' },
      { id: 'wo-2', description: 'Replace HVAC filter', status: 'Assigned', propertyId: 'prop-1' },
      { id: 'wo-3', description: 'Paint bedroom', status: 'Completed', propertyId: 'prop-1' },
    ],
    totalCount: 3,
  })),
};
```

### Project Structure Notes

- Components use inline templates and styles (backtick strings, not separate files)
- All components are `standalone: true`
- Use new control flow: `@if`, `@for`, `@else`
- Signal-based inputs: `input()` and `input.required()`
- Material components imported individually
- `signal()` for reactive state, `computed()` for derived state
- `data-testid` attributes for E2E test selectors

### References

- [Source: epics-work-orders-vendors.md#Epic 4 Story 4.8] - Work Order Dropdown on Receipt Processing (FR35)
- [Source: architecture.md#Decision 18] - FK on Expense (WorkOrderId), 1:N relationship
- [Source: expense-form.component.ts] - Work order dropdown pattern (Story 11-2)
- [Source: receipt-expense-form.component.ts] - Current receipt processing form (to be modified)
- [Source: work-order.service.ts] - getWorkOrdersByProperty() method
- [Source: ReceiptsController.cs] - ProcessReceiptRequest record (to be modified)
- [Source: ProcessReceipt.cs] - ProcessReceiptCommand + Handler (to be modified)
- [Source: 11-7-create-expense-from-work-order.md] - Previous story intelligence
- [Source: 11-1-expense-workorder-relationship.md] - Backend foundation (FK on Expense)
- [Source: 5-4-process-receipt-into-expense.md] - Receipt processing infrastructure

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR35 | Work order dropdown appears on receipt processing form (active work orders only) | Adds optional work order dropdown to receipt-expense-form, filtered by selected property + active status, linked at expense creation time |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required.

### Completion Notes List

- **Task 1:** Added `Guid? WorkOrderId = null` to `ProcessReceiptCommand`, set it on `Expense` in handler, added existence check in handler (consistent with property/category validation pattern), added GUID format validation in `ProcessReceiptValidator`.
- **Task 2:** Added `Guid? WorkOrderId = null` to `ProcessReceiptRequest` record, passed through to command in controller.
- **Task 3:** Added 4 backend tests: linked work order, null work order, invalid work order (NotFoundException), cross-account work order (NotFoundException via global query filter). All 903 backend tests pass.
- **Task 4:** Regenerated NSwag client. `ProcessReceiptRequest` includes `workOrderId?: string | undefined`.
- **Task 5:** Added work order dropdown to receipt-expense-form following expense-form pattern: `WorkOrderService` injection, `workOrders`/`isLoadingWorkOrders` signals, `loadWorkOrders()` method with active status filter, property `valueChanges` subscription for load/reset, programmatic enable/disable (Angular reactive forms best practice), dropdown template with None/loading/truncation.
- **Task 6:** Added 14 frontend tests (13 story-specified + 1 error handling). All 2271 frontend tests pass.
- **Decision:** Used programmatic `enable()`/`disable()` on `workOrderId` form control instead of `[disabled]` template binding (Angular warns against mixing reactive forms with disabled attribute).
- **Decision:** Placed work order existence validation in handler (consistent with property/category pattern) rather than async validator (no existing MustAsync pattern in project).

### File List

**Backend (Modified):**
- `backend/src/PropertyManager.Application/Receipts/ProcessReceipt.cs` - Added WorkOrderId to command + handler
- `backend/src/PropertyManager.Application/Receipts/ProcessReceiptValidator.cs` - Added WorkOrderId GUID validation
- `backend/src/PropertyManager.Api/Controllers/ReceiptsController.cs` - Added WorkOrderId to request + pass to command
- `backend/tests/PropertyManager.Application.Tests/Receipts/ProcessReceiptHandlerTests.cs` - Added 4 work order tests

**Frontend (Modified):**
- `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.ts` - Added work order dropdown
- `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts` - Added 14 work order tests

**Frontend (Auto-generated):**
- `frontend/src/app/core/api/api.service.ts` - Regenerated NSwag client with workOrderId field
