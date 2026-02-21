# Story 16.4: Expense-WorkOrder & Expense-Receipt Linking

Status: dev-complete

**GitHub Issue:** #235
**Prerequisites:** None (UnlinkReceipt fixed in Story 15.4)
**Effort:** Medium — work order dropdown copies existing pattern; receipt linking needs new backend command

## Story

As a **property owner editing an expense**,
I want **to link it to a work order and/or receipt**,
So that **my expenses are connected to the maintenance context and proof of purchase**.

## Acceptance Criteria

### AC1 — Work order dropdown on detail edit form

**Given** I am editing an expense at `/expenses/:id`
**When** I view the edit form
**Then** I see a Work Order dropdown (optional) filtered to the expense's property
**And** saving persists the work order association

### AC2 — Work order dropdown resets on property change

**Given** I change the property on the expense edit form
**When** the property changes
**Then** the work order dropdown clears and reloads work orders for the new property

### AC3 — Link unprocessed receipt to existing expense

**Given** I am editing an expense with no linked receipt
**When** I click "Link Receipt"
**Then** I can select from unprocessed receipts (thumbnails)
**And** linking sets `Expense.ReceiptId`, `Receipt.ExpenseId`, and `Receipt.ProcessedAt`

### AC4 — Unlink receipt from detail edit

**Given** the expense has a linked receipt
**When** I click unlink in edit mode
**Then** the receipt is unlinked and returned to the unprocessed queue

## Tasks / Subtasks

### Task 1: Add Work Order Dropdown to Expense Detail Edit Form (AC: #1, #2)

> **Why:** The inline edit form (`expense-edit-form.component.ts`) already has a work order dropdown. The detail edit form at `/expenses/:id` is missing it. Copy the exact same pattern.

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts`

- [x] 1.1 Add imports:
  ```typescript
  import { WorkOrderService, WorkOrderDto } from '../../work-orders/services/work-order.service';
  ```

- [x] 1.2 Inject the service:
  ```typescript
  private readonly workOrderService = inject(WorkOrderService);
  ```

- [x] 1.3 Add state signals:
  ```typescript
  protected readonly workOrders = signal<WorkOrderDto[]>([]);
  protected readonly isLoadingWorkOrders = signal(false);
  ```

- [x] 1.4 Add `workOrderId` form control to `editForm`:
  ```typescript
  protected editForm: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01), Validators.max(9999999.99)]],
    date: [null, [Validators.required]],
    categoryId: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
    propertyId: ['', [Validators.required]],
    workOrderId: [''],  // NEW - optional
  });
  ```

- [x] 1.5 Add `loadWorkOrders()` method (copy from inline edit form):
  ```typescript
  private loadWorkOrders(propertyId: string): void {
    this.isLoadingWorkOrders.set(true);
    this.workOrderService.getWorkOrdersByProperty(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workOrders.set(response.items);
          this.isLoadingWorkOrders.set(false);
        },
        error: () => {
          this.isLoadingWorkOrders.set(false);
        },
      });
  }
  ```

- [x] 1.6 Call `loadWorkOrders()` in `onEdit()` method after loading properties, using the current expense's propertyId

- [x] 1.7 Add property change listener to reload work orders when propertyId changes (AC2):
  ```typescript
  // In onEdit() or ngOnInit, subscribe to propertyId valueChanges:
  this.editForm.get('propertyId')!.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((newPropertyId) => {
      this.editForm.patchValue({ workOrderId: '' });
      this.workOrders.set([]);
      if (newPropertyId) {
        this.loadWorkOrders(newPropertyId);
      }
    });
  ```

- [x] 1.8 Patch `workOrderId` in `populateEditForm()`:
  ```typescript
  this.editForm.patchValue({
    // ...existing fields...
    workOrderId: expense.workOrderId || '',
  });
  ```

- [x] 1.9 Include `workOrderId` in `onSubmit()` update request:
  ```typescript
  const { amount, date, categoryId, description, propertyId, workOrderId } = this.editForm.value;
  // ...
  const request: UpdateExpenseRequest = {
    amount,
    date: formattedDate,
    categoryId,
    description: description?.trim() || undefined,
    workOrderId: workOrderId || undefined,
    propertyId,
  };
  ```

- [x] 1.10 Add work order dropdown template in edit form section (between description and save/cancel buttons):
  ```html
  <!-- Work Order (optional) -->
  <mat-form-field appearance="outline" class="full-width">
    <mat-label>Work Order (optional)</mat-label>
    <mat-select formControlName="workOrderId" data-testid="work-order-select">
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
  </mat-form-field>
  ```

- [x] 1.11 Ensure `MatSelectModule` and `SlicePipe` are imported in the component

### Task 2: Create LinkReceiptToExpense Backend Command (AC: #3)

> **Why:** Currently `ProcessReceipt` creates a NEW expense linked to a receipt. There is NO command to link a receipt to an EXISTING expense. `UnlinkReceipt` handles unlinking. This new command is the inverse of `UnlinkReceipt`.

**New file:** `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpense.cs`

- [x] 2.1 Create the command record:
  ```csharp
  public record LinkReceiptToExpenseCommand(Guid ExpenseId, Guid ReceiptId) : IRequest<Unit>;
  ```

- [x] 2.2 Create the handler with validation:
  ```csharp
  public class LinkReceiptToExpenseHandler : IRequestHandler<LinkReceiptToExpenseCommand, Unit>
  {
      private readonly IAppDbContext _dbContext;
      private readonly ICurrentUser _currentUser;

      // Constructor...

      public async Task<Unit> Handle(LinkReceiptToExpenseCommand request, CancellationToken cancellationToken)
      {
          // 1. Load expense
          var expense = await _dbContext.Expenses
              .FirstOrDefaultAsync(e => e.Id == request.ExpenseId, cancellationToken);
          if (expense == null)
              throw new NotFoundException(nameof(Expense), request.ExpenseId);

          // 2. Verify expense doesn't already have a receipt
          if (expense.ReceiptId != null)
              throw new ConflictException(nameof(Expense), request.ExpenseId, "already has a linked receipt");

          // 3. Load receipt
          var receipt = await _dbContext.Receipts
              .FirstOrDefaultAsync(r => r.Id == request.ReceiptId, cancellationToken);
          if (receipt == null)
              throw new NotFoundException(nameof(Receipt), request.ReceiptId);

          // 4. Verify receipt is unprocessed
          if (receipt.ProcessedAt != null)
              throw new ConflictException(nameof(Receipt), request.ReceiptId, "is already processed");

          // 5. Set BOTH sides of the 1:1 relationship (critical — see Story 15.4 fix)
          expense.ReceiptId = receipt.Id;
          receipt.ExpenseId = expense.Id;
          receipt.ProcessedAt = DateTime.UtcNow;

          // 6. Optionally sync property: if receipt has no property, set it from expense
          if (receipt.PropertyId == null)
              receipt.PropertyId = expense.PropertyId;

          await _dbContext.SaveChangesAsync(cancellationToken);
          return Unit.Value;
      }
  }
  ```

- [x] 2.3 Create validator:
  **New file:** `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpenseValidator.cs`
  ```csharp
  public class LinkReceiptToExpenseValidator : AbstractValidator<LinkReceiptToExpenseCommand>
  {
      public LinkReceiptToExpenseValidator()
      {
          RuleFor(x => x.ExpenseId).NotEmpty();
          RuleFor(x => x.ReceiptId).NotEmpty();
      }
  }
  ```

### Task 3: Add LinkReceipt API Endpoint (AC: #3)

> **Why:** Expose the new command via the Expenses controller.

**File:** `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`

- [x] 3.1 Add endpoint:
  ```csharp
  [HttpPost("expenses/{id:guid}/link-receipt")]
  [ProducesResponseType(StatusCodes.Status204NoContent)]
  [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
  [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
  public async Task<IActionResult> LinkReceipt(Guid id, [FromBody] LinkReceiptRequest request)
  {
      var validator = new LinkReceiptToExpenseValidator();
      var command = new LinkReceiptToExpenseCommand(id, request.ReceiptId);
      var validationResult = await validator.ValidateAsync(command);
      if (!validationResult.IsValid)
          return ValidationProblem(new ValidationProblemDetails(
              validationResult.Errors.ToDictionary(e => e.PropertyName, e => new[] { e.ErrorMessage })));

      await _mediator.Send(command);
      return NoContent();
  }
  ```

- [x] 3.2 Add request record at bottom of controller file:
  ```csharp
  public record LinkReceiptRequest(Guid ReceiptId);
  ```

### Task 4: Backend Unit Tests for LinkReceiptToExpense (AC: #3)

**New file:** `backend/test/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseHandlerTests.cs`

- [x] 4.1 Test: `Handle_ValidExpenseAndReceipt_LinksSuccessfully` — verifies both FKs set, ProcessedAt set
- [x] 4.2 Test: `Handle_ExpenseNotFound_ThrowsNotFoundException`
- [x] 4.3 Test: `Handle_ReceiptNotFound_ThrowsNotFoundException`
- [x] 4.4 Test: `Handle_ExpenseAlreadyHasReceipt_ThrowsConflictException`
- [x] 4.5 Test: `Handle_ReceiptAlreadyProcessed_ThrowsConflictException`
- [x] 4.6 Test: `Handle_ReceiptWithNoProperty_SyncsPropertyFromExpense`

**New file:** `backend/test/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs`

- [x] 4.7 Test: `Validate_EmptyExpenseId_Fails`
- [x] 4.8 Test: `Validate_EmptyReceiptId_Fails`
- [x] 4.9 Test: `Validate_ValidCommand_Passes`

### Task 5: Regenerate Frontend API Client (AC: #3)

> **Why:** The new `POST /api/v1/expenses/{id}/link-receipt` endpoint needs to be available in the generated TypeScript client.

- [x] 5.1 Run `npm run generate-api` from `/frontend` after backend is running with the new endpoint
- [x] 5.2 Verify generated client has `expenses_LinkReceipt(id, request)` method
- [x] 5.3 If NSwag generation is unavailable, add the method manually to `expense.service.ts`:
  ```typescript
  linkReceipt(expenseId: string, receiptId: string): Observable<void> {
    return this.http.post<void>(`/api/v1/expenses/${expenseId}/link-receipt`, { receiptId });
  }
  ```

### Task 6: Add Receipt Linking UI to Expense Detail Edit Mode (AC: #3, #4)

> **Why:** In edit mode, the expense detail needs "Link Receipt" for expenses without a receipt, and "Unlink Receipt" for expenses with a receipt. The inline edit form already has the unlink pattern — extend it with a receipt picker for linking.

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts`

- [x] 6.1 Add receipt-related signals:
  ```typescript
  protected readonly unprocessedReceipts = signal<UnprocessedReceiptDto[]>([]);
  protected readonly isLoadingReceipts = signal(false);
  protected readonly isLinkingReceipt = signal(false);
  protected readonly selectedReceiptId = signal<string | null>(null);
  ```

- [x] 6.2 Add imports for receipt API and types:
  ```typescript
  import { ApiService, UnprocessedReceiptDto } from '../../../core/api/api.service';
  ```

- [x] 6.3 Add method to load unprocessed receipts:
  ```typescript
  private loadUnprocessedReceipts(): void {
    this.isLoadingReceipts.set(true);
    this.api.receipts_GetUnprocessed().subscribe({
      next: (response) => {
        this.unprocessedReceipts.set(response.items ?? []);
        this.isLoadingReceipts.set(false);
      },
      error: () => {
        this.isLoadingReceipts.set(false);
      },
    });
  }
  ```

- [x] 6.4 Call `loadUnprocessedReceipts()` when entering edit mode if expense has no receipt

- [x] 6.5 Add `linkReceipt()` method:
  ```typescript
  protected async linkReceipt(): Promise<void> {
    const receiptId = this.selectedReceiptId();
    if (!receiptId) return;

    this.isLinkingReceipt.set(true);
    // Use generated API client or manual service method
    this.expenseService.linkReceipt(this.store.expense()!.id, receiptId).subscribe({
      next: () => {
        this.isLinkingReceipt.set(false);
        this.snackBar.open('Receipt linked', 'Close', { duration: 3000 });
        this.store.loadExpense(this.store.expense()!.id); // Reload expense to get receiptId
        this.selectedReceiptId.set(null);
      },
      error: () => {
        this.isLinkingReceipt.set(false);
        this.snackBar.open('Failed to link receipt', 'Close', { duration: 5000 });
      },
    });
  }
  ```

- [x] 6.6 Add receipt linking section in edit mode template:
  ```html
  <!-- Receipt Section (Edit Mode) -->
  @if (store.hasReceipt()) {
    <!-- Show current receipt with unlink button (already exists in view mode, add to edit mode) -->
    <div class="receipt-section" data-testid="receipt-section-edit">
      <div class="receipt-label">Attached Receipt</div>
      <button mat-stroked-button color="warn" (click)="onUnlinkReceipt()" [disabled]="store.isUnlinkingReceipt()">
        @if (store.isUnlinkingReceipt()) {
          <mat-spinner diameter="18"></mat-spinner>
        } @else {
          <mat-icon>link_off</mat-icon>
          Unlink Receipt
        }
      </button>
    </div>
  } @else {
    <!-- Show receipt picker for linking -->
    <div class="receipt-link-section" data-testid="receipt-link-section">
      <div class="section-label">Link Receipt (optional)</div>
      @if (isLoadingReceipts()) {
        <mat-spinner diameter="24"></mat-spinner>
      } @else if (unprocessedReceipts().length === 0) {
        <p class="empty-text">No unprocessed receipts available</p>
      } @else {
        <div class="receipt-picker">
          @for (receipt of unprocessedReceipts(); track receipt.id) {
            <button
              type="button"
              class="receipt-option"
              [class.selected]="selectedReceiptId() === receipt.id"
              (click)="selectedReceiptId.set(receipt.id!)"
              data-testid="receipt-option"
            >
              @if (receipt.contentType === 'application/pdf') {
                <mat-icon class="pdf-icon">description</mat-icon>
              } @else {
                <img [src]="receipt.viewUrl" alt="Receipt" class="receipt-thumb" />
              }
              <span class="receipt-name">{{ receipt.originalFileName || receipt.propertyName || 'Receipt' }}</span>
            </button>
          }
        </div>
        <button
          mat-stroked-button
          color="primary"
          (click)="linkReceipt()"
          [disabled]="!selectedReceiptId() || isLinkingReceipt()"
          data-testid="link-receipt-btn"
        >
          @if (isLinkingReceipt()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>link</mat-icon>
            Link Selected Receipt
          }
        </button>
      }
    </div>
  }
  ```

- [x] 6.7 Add receipt picker SCSS styles:
  ```scss
  .receipt-link-section {
    margin: 16px 0;
  }
  .receipt-picker {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  .receipt-option {
    width: 80px;
    height: 80px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    background: var(--mat-sys-surface-container);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    &.selected {
      border-color: var(--mat-sys-primary);
    }

    .receipt-thumb {
      width: 100%;
      height: 60px;
      object-fit: cover;
    }

    .receipt-name {
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 76px;
      padding: 2px;
    }
  }
  ```

### Task 7: Frontend Unit Tests (AC: all)

**File:** `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts`

- [x] 7.1 Test: "Edit mode shows work order dropdown" (AC1)
- [x] 7.2 Test: "Work order dropdown loads work orders for expense property" (AC1)
- [x] 7.3 Test: "Populates workOrderId from expense data" (AC1)
- [x] 7.4 Test: "Work order dropdown clears when property changes" (AC2)
- [x] 7.5 Test: "Work order dropdown reloads for new property" (AC2)
- [x] 7.6 Test: "Submit includes workOrderId in update request" (AC1)
- [x] 7.7 Test: "Submit sends undefined workOrderId when None selected" (AC1)
- [x] 7.8 Test: "Edit mode shows receipt link section when no receipt" (AC3)
- [x] 7.9 Test: "Receipt picker shows unprocessed receipts" (AC3)
- [x] 7.10 Test: "Link Receipt button calls API with selected receipt" (AC3)
- [x] 7.11 Test: "Link success reloads expense and shows snackbar" (AC3)
- [x] 7.12 Test: "Edit mode shows unlink button when receipt exists" (AC4)
- [x] 7.13 Test: "Unlink receipt returns receipt to unprocessed queue" (AC4)

### Task 8: Run All Tests (AC: all)

- [x] 8.1 `dotnet test` from `/backend` — all existing + new tests pass
- [x] 8.2 `npm test` from `/frontend` — all existing + new tests pass (NEVER use `npx vitest`)
- [x] 8.3 Verify no TypeScript compilation errors
- [x] 8.4 Manual smoke test: edit expense → add work order link → save → verify. Edit expense → link receipt → verify receipt marked processed

## Dev Notes

### Zero-Change Inventory (Don't Rebuild)

| Component / File | Path | What it does | Reuse how |
|---|---|---|---|
| `WorkOrderService` | `features/work-orders/services/work-order.service.ts` | `getWorkOrdersByProperty()` returns work orders for a property | Inject and call — identical to inline edit form |
| `ExpenseDetailStore` | `features/expenses/stores/expense-detail.store.ts` | `updateExpense()` already passes `workOrderId` through to API | No changes needed — just include in request |
| `ExpenseStore` (list) | `features/expenses/stores/expense.store.ts` | `updateExpense` already maps `workOrderId` (line 544) | No changes needed |
| `UnlinkReceipt` command | `Application/Expenses/UnlinkReceipt.cs` | Clears both FKs, resets ProcessedAt | Already exposed via `expenses_UnlinkReceipt()` |
| `UpdateExpense` command | `Application/Expenses/UpdateExpense.cs` | Accepts `WorkOrderId` in command | Already handles work order linking — just send it |
| `ReceiptLightboxDialog` | `features/receipts/components/receipt-lightbox-dialog/` | Full-screen receipt viewer | Reuse for "View Receipt" button |
| `ConfirmDialogComponent` | `shared/components/confirm-dialog/` | Confirmation dialog | Reuse for unlink confirmation |

### Part 1: Work Order Dropdown — Copy Pattern

The inline edit form (`expense-edit-form.component.ts`) has the EXACT pattern to copy:

**Service call:**
```typescript
this.workOrderService.getWorkOrdersByProperty(propertyId)
```

**Response type:**
```typescript
interface GetWorkOrdersByPropertyResponse {
  items: WorkOrderDto[];
  totalCount: number;
}
```

**WorkOrderDto fields used in dropdown:**
- `id` — value for mat-option
- `description` — display text (truncated to 60 chars)
- `status` — shown in parentheses after description

**Critical: Property change handler.**
When the user changes the property dropdown, the work order dropdown MUST:
1. Clear the current work order selection (`patchValue({ workOrderId: '' })`)
2. Clear the work orders array (`workOrders.set([])`)
3. Reload work orders for the new property

### Part 2: Receipt Linking — New Backend Command Required

**Current state:**
- `ProcessReceipt` creates a NEW expense and links the receipt — NOT what we need
- `UnlinkReceipt` unlinks receipt from expense — the inverse of what we need
- **No command exists to link a receipt to an EXISTING expense**

**New command: `LinkReceiptToExpense`**

Must follow the UnlinkReceipt pattern (Story 15.4 fix) but in reverse:
```
UnlinkReceipt:                     LinkReceiptToExpense:
expense.ReceiptId = null      →    expense.ReceiptId = receipt.Id
receipt.ExpenseId = null      →    receipt.ExpenseId = expense.Id
receipt.ProcessedAt = null    →    receipt.ProcessedAt = DateTime.UtcNow
```

**Critical: Set BOTH sides of the 1:1 relationship.** The Story 15.4 fix established that EF Core's 1:1 with shadow properties requires clearing/setting both `expense.ReceiptId` AND `receipt.ExpenseId`. Do NOT rely on EF fixup.

**Validation rules:**
- Expense must exist (404 if not)
- Receipt must exist (404 if not)
- Expense must NOT already have a receipt (409 Conflict)
- Receipt must NOT be already processed (409 Conflict — `ProcessedAt != null`)

### Receipt-Expense Relationship Architecture

```
Receipt ←——1:1——→ Expense
  │                    │
  ├─ ReceiptId (FK in Expense table — source of truth)
  ├─ ExpenseId (shadow property in Receipt table — must sync manually)
  └─ ProcessedAt (null = unprocessed, set = linked to expense)
```

**Cardinality:** 1:1 (one receipt to one expense). Keep 1:1 per Issue #235 recommendation.
**ON DELETE:** SetNull — deleting either side clears the FK but preserves the other record.

### Backend Patterns to Follow

| Pattern | Convention | Reference |
|---|---|---|
| Command + Handler in one file | `LinkReceiptToExpense.cs` | `UnlinkReceipt.cs` |
| Validator in separate file | `LinkReceiptToExpenseValidator.cs` | `CreateExpenseValidator.cs` |
| Controller validates then sends | Explicit validator call before `_mediator.Send()` | All controllers |
| NotFoundException | `throw new NotFoundException(nameof(Entity), id)` | Domain exception → 404 |
| ConflictException | `throw new ConflictException(nameof(Entity), id, "message")` | Existing pattern |
| No try-catch in controller | Global middleware handles domain exceptions | `CLAUDE.md` rule |

### API Design

**New endpoint:**
```
POST /api/v1/expenses/{id}/link-receipt
Body: { "receiptId": "guid" }
Response: 204 No Content
Errors: 404 (expense/receipt not found), 409 (already linked/processed)
```

**Existing endpoints used:**
```
PUT  /api/v1/expenses/{id}              — Update expense (includes workOrderId)
POST /api/v1/expenses/{id}/unlink-receipt — Unlink receipt (already exists)
GET  /api/v1/receipts/unprocessed       — Get unprocessed receipts for picker
GET  /api/v1/properties/{id}/work-orders — Get work orders for dropdown
```

### Frontend Receipt Picker UX

The receipt picker should be simple — not a full modal, just an inline selection:
1. Show grid of unprocessed receipt thumbnails (from `receipts_GetUnprocessed()`)
2. User clicks a thumbnail to select it (highlighted border)
3. User clicks "Link Selected Receipt" button
4. API call links the receipt
5. UI updates: receipt section switches from picker to "Attached Receipt" display

**Thumbnail source:** Each `UnprocessedReceiptDto` has a `viewUrl` (presigned S3 URL) for direct `<img>` rendering. PDFs show `description` mat-icon instead.

### Files NOT to Modify

- `expense-edit-form.component.ts` — inline edit already has work order dropdown, leave as-is
- `receipt.store.ts` — no changes needed (unprocessed list is fetched directly from API)
- `receipt-capture.service.ts` — upload service, not relevant here
- `receipt-signalr.service.ts` — real-time, not relevant
- `ProcessReceipt.cs` — creates new expenses, not what we need
- `UnlinkReceipt.cs` — already works, reuse as-is

### Project Structure Notes

**New files:**
```
backend/src/PropertyManager.Application/Expenses/
├── LinkReceiptToExpense.cs              # NEW — command + handler
└── LinkReceiptToExpenseValidator.cs     # NEW — FluentValidation

backend/test/PropertyManager.Application.Tests/Expenses/
├── LinkReceiptToExpenseHandlerTests.cs       # NEW
└── LinkReceiptToExpenseValidatorTests.cs     # NEW
```

**Modified files:**
```
backend/src/PropertyManager.Api/Controllers/ExpensesController.cs
  — Add POST expenses/{id}/link-receipt endpoint + LinkReceiptRequest record

frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts
  — Add workOrderId form control, work order dropdown, receipt picker UI

frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts
  — Add tests for work order dropdown and receipt linking

frontend/src/app/features/expenses/services/expense.service.ts
  — Add linkReceipt() method (if not using generated API client)
```

### Testing Requirements

**Backend (xUnit + Moq + FluentAssertions):**
- `LinkReceiptToExpenseHandlerTests` — 6 tests covering happy path + all error cases
- `LinkReceiptToExpenseValidatorTests` — 3 tests
- Follow `Method_Scenario_ExpectedResult` naming convention
- Mock `IAppDbContext` and `ICurrentUser` per project pattern
- Use `MockQueryable.Moq` for DbSet mocking

**Frontend (Vitest — run via `npm test` from `/frontend`, NEVER `npx vitest`):**
- 13 new tests in `expense-detail.component.spec.ts`
- Mock `WorkOrderService.getWorkOrdersByProperty` with `vi.fn().mockReturnValue(of(...))`
- Mock `ApiService.receipts_GetUnprocessed` for receipt picker tests
- Follow existing test patterns in the spec file

### Previous Story Intelligence (16.3)

Story 16.3 established:
- `firstValueFrom()` for awaiting dialog results
- `mat-stroked-button color="primary"` for action buttons
- `data-testid` attributes on key interactive elements
- SignalR handles queue updates — no manual store calls needed after linking
- `DragDropUploadComponent` pattern (reference only, not used here)

### Git Intelligence

Recent commits (16.3 branch merged to main):
```
7600a71 Merge pull request #239 — feature/16-3-desktop-receipt-upload
c71d616 fix: improve upload snackbar messaging
ab9d388 fix: update E2E tests for new receipts page header
968b686 feat: add desktop receipt upload to receipts page (#234)
```

Patterns confirmed: feature branches follow `feature/{issue-number}-{description}` convention. PR merges to `main`.

### References

- [GitHub Issue #235](https://github.com/daveharmswebdev/property-manager/issues/235) — Add work order and receipt linking to expense detail edit view
- [Source: `features/expenses/expense-detail/expense-detail.component.ts` — Main file to modify]
- [Source: `features/expenses/components/expense-edit-form/expense-edit-form.component.ts` — Work order dropdown reference impl]
- [Source: `Application/Expenses/UnlinkReceipt.cs` — Inverse pattern for LinkReceiptToExpense]
- [Source: `Application/Receipts/ProcessReceipt.cs` — Receipt linking reference (creates new expense)]
- [Source: `Application/Expenses/UpdateExpense.cs` — Already accepts WorkOrderId]
- [Source: `features/work-orders/services/work-order.service.ts` — getWorkOrdersByProperty()]
- [Source: `Infrastructure/Persistence/Configurations/ExpenseConfiguration.cs` — EF 1:1 receipt config]
- [Source: `_bmad-output/project-context.md` — Project rules and patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None required — clean implementation.

### Completion Notes List

- Backend: Created `LinkReceiptToExpense.cs` (command+handler) and `LinkReceiptToExpenseValidator.cs` following UnlinkReceipt pattern
- Backend: Added `POST expenses/{id}/link-receipt` endpoint to ExpensesController with `LinkReceiptRequest` record
- Frontend: Added `linkReceipt()` method to `expense.service.ts` (manual, NSwag unavailable offline)
- Frontend: Added work order dropdown (`workOrderId` form control, `loadWorkOrders()`, property change listener) to expense-detail component
- Frontend: Added receipt linking UI (receipt picker with thumbnails, link/unlink buttons) to expense-detail edit mode
- Frontend: Used `ApiClient.receipts_GetUnprocessed()` for loading unprocessed receipts
- Tests: Fixed TEA red-phase test "should show Link Receipt button" by providing mock unprocessed receipts data to the component signal
- All 1,484 backend tests pass (941 Application + 85 Infrastructure + 458 API)
- All 2,420 frontend tests pass
- Zero TypeScript compilation errors

### File List

**New Files:**
- `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpense.cs`
- `backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpenseValidator.cs`

**Modified Files:**
- `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` — added LinkReceipt endpoint + LinkReceiptRequest record
- `frontend/src/app/features/expenses/services/expense.service.ts` — added linkReceipt() method
- `frontend/src/app/features/expenses/expense-detail/expense-detail.component.ts` — work order dropdown + receipt linking UI
- `frontend/src/app/features/expenses/expense-detail/expense-detail.component.spec.ts` — fixed receipt linking test mock data
- `frontend/e2e/pages/expense-detail.page.ts` — receipt linking page object (TEA pre-created)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status update
- `_bmad-output/implementation-artifacts/16-4-expense-workorder-and-receipt-linking.md` — task checkmarks + dev record
