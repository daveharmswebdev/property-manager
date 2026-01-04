# Story 5.5: View and Delete Receipts

Status: ready-for-dev

## Story

As a property owner,
I want to view receipts attached to expenses and delete unwanted receipts,
So that I can verify records and clean up mistakes.

## Acceptance Criteria

1. **AC-5.5.1**: Receipt indicator on expense rows
   - Expenses with receipts show a receipt icon indicator
   - Clicking the icon opens the receipt image in a lightbox/modal
   - Already partially implemented in `expense-list-row.component.ts` (opens in new tab)
   - Upgrade to lightbox/modal for better UX

2. **AC-5.5.2**: Receipt image lightbox/modal viewer
   - Displays receipt image with zoom in/out and pan controls
   - Close button to return to expense view
   - Reuse existing `ReceiptImageViewerComponent`
   - Wrap in Angular Material dialog

3. **AC-5.5.3**: Delete unprocessed receipt from queue
   - Add delete button to queue items
   - Show confirmation dialog: "Delete this receipt?"
   - On confirm: delete receipt from S3 and database
   - Show snackbar: "Receipt deleted"
   - Update queue (remove from list, decrement badge)

4. **AC-5.5.4**: Remove receipt from expense (unlink)
   - In expense edit form, show "Remove receipt" option if expense has receipt
   - Offer choice: "Delete receipt" or "Return to queue"
   - If delete: remove receipt entirely
   - If return to queue: clear `processedAt` and `expenseId`, receipt returns to unprocessed queue
   - Update expense `receiptId` to null

## Tasks / Subtasks

- [ ] Task 1: Create Receipt Lightbox Dialog Component (AC: 5.5.1, 5.5.2)
  - [ ] Create `frontend/src/app/features/receipts/components/receipt-lightbox-dialog/`
  - [ ] Input: `receiptId` (GUID string)
  - [ ] Loads receipt via `GET /api/v1/receipts/{id}`
  - [ ] Uses `ReceiptImageViewerComponent` for display
  - [ ] Close button returns to caller
  - [ ] Loading spinner while fetching
  - [ ] Error state if receipt not found

- [ ] Task 2: Update ExpenseListRowComponent to Use Lightbox (AC: 5.5.1)
  - [ ] Import MatDialog
  - [ ] Change `viewReceipt()` to open `ReceiptLightboxDialogComponent` instead of new tab
  - [ ] Pass `receiptId` to dialog
  - [ ] Update unit tests

- [ ] Task 3: Update ExpenseRowComponent to Show Receipt Indicator (AC: 5.5.1)
  - [ ] Add receipt icon next to description/category if `expense().receiptId` exists
  - [ ] Add click handler to open lightbox
  - [ ] Consistent with ExpenseListRowComponent pattern

- [ ] Task 4: Add Delete Button to ReceiptQueueItemComponent (AC: 5.5.3)
  - [ ] Add delete icon button (mat-icon-button)
  - [ ] Show on hover (desktop) or always visible (mobile)
  - [ ] Emit `delete` output event with receipt ID
  - [ ] Stop event propagation to prevent navigation

- [ ] Task 5: Create Delete Confirmation Dialog Component (AC: 5.5.3)
  - [ ] Create `frontend/src/app/shared/components/confirm-delete-dialog/` (if not exists)
  - [ ] Generic confirmation dialog with customizable message
  - [ ] "Cancel" and "Delete" buttons
  - [ ] Returns boolean result

- [ ] Task 6: Implement Delete Receipt Flow in ReceiptsComponent (AC: 5.5.3)
  - [ ] Handle delete event from queue item
  - [ ] Show confirmation dialog
  - [ ] On confirm: call `DELETE /api/v1/receipts/{id}`
  - [ ] Remove from queue via `store.removeFromQueue()`
  - [ ] Show snackbar "Receipt deleted"

- [ ] Task 7: Create Unlink Receipt Backend Command (AC: 5.5.4)
  - [ ] Create `UnlinkReceipt.cs` in Application/Receipts
  - [ ] Command: `UnlinkReceiptCommand(ExpenseId, DeleteReceipt: bool)`
  - [ ] Handler: Clear `expense.ReceiptId`, update receipt based on DeleteReceipt flag
  - [ ] If DeleteReceipt=false: Clear `receipt.ProcessedAt`, `receipt.ExpenseId` (returns to queue)
  - [ ] If DeleteReceipt=true: Soft-delete receipt and S3 file

- [ ] Task 8: Add Unlink Receipt Endpoint (AC: 5.5.4)
  - [ ] Add `POST /api/v1/expenses/{id}/unlink-receipt` to ExpensesController
  - [ ] Request body: `{ deleteReceipt: boolean }`
  - [ ] Return 204 No Content on success
  - [ ] Return 404 if expense not found or has no receipt

- [ ] Task 9: Update TypeScript API Client
  - [ ] Run `npm run generate-api`
  - [ ] Verify `expenses_UnlinkReceipt(id, request)` method exists

- [ ] Task 10: Create UnlinkReceiptDialogComponent (AC: 5.5.4)
  - [ ] Create `frontend/src/app/features/expenses/components/unlink-receipt-dialog/`
  - [ ] Two options: "Delete receipt permanently" or "Return receipt to queue"
  - [ ] Returns selected option or null if cancelled

- [ ] Task 11: Update Expense Edit Form (AC: 5.5.4)
  - [ ] Show "Remove receipt" link/button if expense has receiptId
  - [ ] On click: open UnlinkReceiptDialogComponent
  - [ ] Call unlink API with selected option
  - [ ] Refresh expense data
  - [ ] Show snackbar with result

- [ ] Task 12: Write Backend Unit Tests
  - [ ] Test UnlinkReceiptHandler clears expense.ReceiptId
  - [ ] Test UnlinkReceiptHandler returns receipt to queue when deleteReceipt=false
  - [ ] Test UnlinkReceiptHandler deletes receipt when deleteReceipt=true
  - [ ] Test returns 404 when expense has no receipt

- [ ] Task 13: Write Frontend Unit Tests
  - [ ] `receipt-lightbox-dialog.component.spec.ts`:
    - [ ] Test dialog opens with receipt
    - [ ] Test image viewer displays
    - [ ] Test close button works
  - [ ] `receipts.component.spec.ts`:
    - [ ] Test delete flow shows confirmation
    - [ ] Test delete API called on confirm
    - [ ] Test queue updates after delete
  - [ ] `expense-edit-form.component.spec.ts`:
    - [ ] Test "Remove receipt" shown when receiptId exists
    - [ ] Test unlink dialog opens
    - [ ] Test API called with correct option

- [ ] Task 14: Write E2E Tests
  - [ ] Test viewing receipt lightbox from expense list
  - [ ] Test deleting unprocessed receipt from queue
  - [ ] Test unlinking receipt from expense

- [ ] Task 15: Manual Verification
  - [ ] Expense list shows receipt icons for expenses with receipts
  - [ ] Clicking receipt icon opens lightbox modal
  - [ ] Lightbox shows zoom/pan controls
  - [ ] Delete button appears on queue items
  - [ ] Delete confirmation works correctly
  - [ ] Receipt removed from queue after delete
  - [ ] Badge count decreases
  - [ ] "Remove receipt" appears in expense edit
  - [ ] Both unlink options work correctly

## Dev Notes

### Architecture Patterns

**Clean Architecture CQRS Pattern:**
```
Application/Receipts/
├── CreateReceipt.cs            # Existing
├── DeleteReceipt.cs            # Existing - used for queue delete
├── GetReceipt.cs               # Existing - used by lightbox
├── GetUnprocessedReceipts.cs   # Existing
├── ProcessReceipt.cs           # Existing
├── UnlinkReceipt.cs            # NEW - unlink from expense

Application/Expenses/
├── UpdateExpense.cs            # Existing - may need modification
```

**Frontend Feature Structure:**
```
frontend/src/app/features/receipts/
├── components/
│   ├── receipt-image-viewer/       # Existing - reuse in lightbox
│   ├── receipt-queue-item/         # Existing - add delete button
│   ├── receipt-lightbox-dialog/    # NEW
│   └── ...
├── receipts.component.ts           # Existing - add delete handler

frontend/src/app/features/expenses/
├── components/
│   ├── expense-edit-form/          # Existing - add unlink UI
│   ├── unlink-receipt-dialog/      # NEW
│   └── ...

frontend/src/app/shared/
├── components/
│   └── confirm-delete-dialog/      # May already exist or create generic
```

### Backend Implementation

**UnlinkReceipt Command (Application Layer):**
```csharp
// Application/Receipts/UnlinkReceipt.cs
public record UnlinkReceiptCommand(Guid ExpenseId, bool DeleteReceipt) : IRequest<Unit>;

public class UnlinkReceiptHandler : IRequestHandler<UnlinkReceiptCommand, Unit>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUser _currentUser;
    private readonly IStorageService _storageService;

    public async Task<Unit> Handle(UnlinkReceiptCommand request, CancellationToken ct)
    {
        // 1. Find expense with receipt
        var expense = await _context.Expenses
            .FirstOrDefaultAsync(e =>
                e.Id == request.ExpenseId &&
                e.AccountId == _currentUser.AccountId, ct);

        if (expense == null)
            throw new NotFoundException(nameof(Expense), request.ExpenseId);

        if (expense.ReceiptId == null)
            throw new BusinessRuleException("Expense has no attached receipt");

        // 2. Find the receipt
        var receipt = await _context.Receipts
            .FirstOrDefaultAsync(r => r.Id == expense.ReceiptId, ct);

        if (receipt == null)
            throw new NotFoundException(nameof(Receipt), expense.ReceiptId.Value);

        // 3. Clear expense receipt link
        expense.ReceiptId = null;
        expense.UpdatedAt = DateTime.UtcNow;

        // 4. Handle receipt based on option
        if (request.DeleteReceipt)
        {
            // Soft-delete the receipt
            receipt.DeletedAt = DateTime.UtcNow;

            // Try to delete from S3 (fire-and-forget)
            try
            {
                await _storageService.DeleteFileAsync(receipt.StorageKey, ct);
            }
            catch { /* Log but don't fail */ }
        }
        else
        {
            // Return to queue - clear processing info
            receipt.ProcessedAt = null;
            receipt.ExpenseId = null;
        }

        await _context.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
```

**Controller Endpoint:**
```csharp
// Api/Controllers/ExpensesController.cs
[HttpPost("{id:guid}/unlink-receipt")]
[ProducesResponseType(StatusCodes.Status204NoContent)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
public async Task<IActionResult> UnlinkReceipt(Guid id, [FromBody] UnlinkReceiptRequest request)
{
    var command = new UnlinkReceiptCommand(id, request.DeleteReceipt);
    await _mediator.Send(command);
    return NoContent();
}

public record UnlinkReceiptRequest(bool DeleteReceipt);
```

### Frontend Implementation

**Receipt Lightbox Dialog:**
```typescript
// components/receipt-lightbox-dialog/receipt-lightbox-dialog.component.ts
@Component({
  selector: 'app-receipt-lightbox-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReceiptImageViewerComponent,
  ],
  template: `
    <div class="lightbox-container" data-testid="receipt-lightbox">
      <div class="lightbox-header">
        <h3>Receipt</h3>
        <button mat-icon-button (click)="close()" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="lightbox-content">
        @if (isLoading()) {
          <mat-spinner diameter="40"></mat-spinner>
        } @else if (error()) {
          <div class="error-state">
            <mat-icon>error</mat-icon>
            <p>{{ error() }}</p>
          </div>
        } @else if (receipt()) {
          <app-receipt-image-viewer
            [viewUrl]="receipt()!.viewUrl!"
            [contentType]="receipt()!.contentType!"
          />
        }
      </div>
    </div>
  `
})
export class ReceiptLightboxDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ReceiptLightboxDialogComponent>);
  private readonly api = inject(ApiClient);
  readonly data = inject<{ receiptId: string }>(MAT_DIALOG_DATA);

  receipt = signal<ReceiptDto | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReceipt();
  }

  private loadReceipt(): void {
    this.api.receipts_GetReceipt(this.data.receiptId).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load receipt');
        this.isLoading.set(false);
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
```

**Updated ReceiptQueueItemComponent with Delete:**
```typescript
// Add to existing template after chevron
<button
  mat-icon-button
  class="delete-btn"
  (click)="onDelete($event)"
  matTooltip="Delete receipt"
  data-testid="delete-receipt-btn"
>
  <mat-icon>delete</mat-icon>
</button>

// Add to component class
delete = output<string>();

onDelete(event: Event): void {
  event.stopPropagation(); // Prevent navigation
  this.delete.emit(this.receipt().id);
}
```

**Unlink Receipt Dialog:**
```typescript
// components/unlink-receipt-dialog/unlink-receipt-dialog.component.ts
@Component({
  selector: 'app-unlink-receipt-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Remove Receipt</h2>
    <mat-dialog-content>
      <p>What would you like to do with this receipt?</p>
      <mat-radio-group [(ngModel)]="selectedOption">
        <mat-radio-button value="queue">Return to unprocessed queue</mat-radio-button>
        <mat-radio-button value="delete">Delete permanently</mat-radio-button>
      </mat-radio-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()">Remove</button>
    </mat-dialog-actions>
  `
})
export class UnlinkReceiptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<UnlinkReceiptDialogComponent>);
  selectedOption: 'queue' | 'delete' = 'queue';

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    this.dialogRef.close({ deleteReceipt: this.selectedOption === 'delete' });
  }
}
```

### Existing Infrastructure to Reuse

**Backend (Already Implemented):**
- `DeleteReceipt.cs` - Handles receipt deletion with S3 cleanup
- `GetReceipt.cs` - Returns receipt with presigned viewUrl
- `Receipt` entity with all required fields
- `ReceiptsController` with existing delete endpoint
- `S3StorageService` for file operations

**Frontend (Already Implemented):**
- `ReceiptImageViewerComponent` - Full zoom/pan/rotate functionality
- `ReceiptStore.removeFromQueue()` - Optimistic UI updates
- `receipt-queue-item.component.ts` - Queue display
- `expense-list-row.component.ts` - Already has receipt indicator (enhance to use lightbox)
- `expense-row.component.ts` - Needs receipt indicator added

### API Contracts

**DELETE /api/v1/receipts/{id}** (Existing)
- Response: 204 No Content
- Deletes receipt from database and S3

**GET /api/v1/receipts/{id}** (Existing)
- Response includes: `id`, `viewUrl`, `contentType`, `createdAt`, etc.

**POST /api/v1/expenses/{id}/unlink-receipt** (NEW)
Request:
```json
{
  "deleteReceipt": false  // true = delete, false = return to queue
}
```

Response: 204 No Content

Error Responses:
- 404: Expense not found or expense has no receipt
- 400: Other validation errors

### Responsive Layout

**Lightbox Dialog:**
```
Desktop (≥768px):
┌────────────────────────────────────┐
│ Receipt                      [✕]   │
├────────────────────────────────────┤
│                                    │
│      ┌──────────────────────┐      │
│      │                      │      │
│      │   Receipt Image      │      │
│      │   with zoom/pan      │      │
│      │                      │      │
│      └──────────────────────┘      │
│                                    │
│    [➖] 100% [➕] [↻] [↺] [⟲]    │
│                                    │
└────────────────────────────────────┘

Mobile (<768px):
Full-screen dialog with image viewer
```

**Queue Item with Delete:**
```
┌─────────────────────────────────────────────┐
│ ┌────────┐  2 hours ago          [🗑] [>]  │
│ │ thumb  │  Test Property                  │
│ └────────┘                                 │
└─────────────────────────────────────────────┘
```

### Testing Strategy

**Backend Unit Tests (xUnit):**
```csharp
[Fact]
public async Task Handle_ReturnToQueue_ClearsProcessedAtAndExpenseId()
{
    // Arrange: Expense with linked processed receipt
    // Act: Send UnlinkReceiptCommand(expenseId, deleteReceipt: false)
    // Assert: expense.ReceiptId == null
    // Assert: receipt.ProcessedAt == null
    // Assert: receipt.ExpenseId == null
    // Assert: receipt.DeletedAt == null (not deleted)
}

[Fact]
public async Task Handle_DeleteReceipt_SoftDeletesReceipt()
{
    // Arrange: Expense with linked receipt
    // Act: Send UnlinkReceiptCommand(expenseId, deleteReceipt: true)
    // Assert: expense.ReceiptId == null
    // Assert: receipt.DeletedAt != null
}

[Fact]
public async Task Handle_NoReceipt_ThrowsBusinessRuleException() { }
```

**Frontend Unit Tests (Vitest):**
- Test lightbox dialog opens and displays image viewer
- Test delete confirmation flow
- Test unlink dialog radio options
- Test API calls with correct parameters

### Previous Story Learnings (From 5-4)

**Patterns to Follow:**
- MatDialog for modals (use inject() pattern)
- Signal-based state management
- data-testid attributes for E2E testing
- Snackbar for user feedback
- Optimistic UI updates via store methods

**Code Files to Reference:**
- `receipt-image-viewer.component.ts` - Reuse for lightbox
- `receipt-queue-item.component.ts` - Pattern for delete button
- `property-tag-modal.component.ts` - Dialog pattern example
- `expense-edit-form.component.ts` - Form modification patterns

### Git Context

Recent commits for Epic 5:
- `3917b1e` feat(receipts): Add receipt processing into expenses (#48)
- `14a03e5` feat(receipts): Add unprocessed receipt queue with navigation badges (#47)
- `e5bf51e` feat(receipts): Add mobile receipt capture with camera FAB (#46)
- `c724331` feat(receipts): Add S3 presigned URL infrastructure for receipt uploads (#45)

### Deployment Notes

- No database migrations needed (existing schema sufficient)
- No new environment variables required
- S3 bucket already configured

### Project Structure Notes

- Alignment: Follows existing feature-based structure
- Lightbox dialog follows shared dialog patterns
- UnlinkReceipt command follows CQRS pattern
- Reuses existing ReceiptImageViewerComponent

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API Contracts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5: View and Delete Receipts]
- [Source: _bmad-output/implementation-artifacts/5-4-process-receipt-into-expense.md]
- [Source: frontend/src/app/features/receipts/components/receipt-image-viewer/receipt-image-viewer.component.ts]
- [Source: frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts]
- [Source: frontend/src/app/features/expenses/components/expense-list-row/expense-list-row.component.ts]
- [Source: backend/src/PropertyManager.Application/Receipts/DeleteReceipt.cs]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
