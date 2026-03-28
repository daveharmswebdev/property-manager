# Story 5.4: Process Receipt into Expense

Status: done

## Story

As a property owner,
I want to process a receipt by creating an expense from it,
So that receipts become properly categorized financial records.

## Acceptance Criteria

1. **AC-5.4.1**: Side-by-side processing layout
   - Clicking a receipt in the queue navigates to `/receipts/:id`
   - Page displays side-by-side layout:
     - Left panel: Receipt image viewer
     - Right panel: Expense creation form
   - Responsive: On mobile, stacks vertically (image above, form below)

2. **AC-5.4.2**: Receipt image viewer
   - Displays receipt image using presigned S3 URL
   - Zoom in/out controls (+ / - buttons or mouse wheel)
   - Pan/drag functionality when zoomed
   - Rotate controls (90° clockwise/counter-clockwise)
   - Loading spinner while image loads
   - Error state if image fails to load
   - PDF receipts: show document icon with "View PDF" link to open in new tab

3. **AC-5.4.3**: Expense form pre-population
   - Property dropdown pre-selected if receipt was tagged during capture
   - Date defaults to receipt's `createdAt` date (not today)
   - Amount, category, description fields empty (user reads from receipt)
   - All expense form validations apply (from Story 3.1)

4. **AC-5.4.4**: Save expense with receipt attachment
   - When user clicks "Save":
     - Expense created via existing expense creation API
     - Receipt linked to expense (ReceiptId on expense, ExpenseId on receipt)
     - Receipt marked as processed (`ProcessedAt` timestamp set)
     - Receipt removed from unprocessed queue (optimistic UI update)
     - Badge count in navigation decreases
   - Snackbar: "Expense saved with receipt"

5. **AC-5.4.5**: Assembly line workflow
   - After successful save, automatically load next unprocessed receipt
   - If no more unprocessed receipts, navigate to receipts page with "All caught up!" message
   - User doesn't need to manually navigate back and forth

6. **AC-5.4.6**: Cancel behavior
   - "Cancel" or back navigation returns to receipts queue
   - Receipt remains in unprocessed queue (not deleted)
   - Form data is discarded (no prompt for unsaved changes - data came from viewing receipt)

7. **AC-5.4.7**: Invalid receipt handling
   - If receipt ID not found, show 404 "Receipt not found"
   - If receipt already processed, redirect to receipts queue with snackbar "Receipt already processed"

## Tasks / Subtasks

- [x] Task 1: Create Backend ProcessReceipt Command (AC: 5.4.4)
  - [x] Create `ProcessReceipt.cs` in Application/Receipts
  - [x] Command: `ProcessReceiptCommand(ReceiptId, PropertyId, Amount, Date, CategoryId, Description?)`
  - [x] Handler creates expense with ReceiptId, sets receipt.ProcessedAt and receipt.ExpenseId
  - [x] Use transaction to ensure atomicity
  - [x] Return created expense ID
  - [x] Add validator for required fields

- [x] Task 2: Add Process Receipt Endpoint (AC: 5.4.4, 5.4.7)
  - [x] Add `POST /api/v1/receipts/{id}/process` to ReceiptsController
  - [x] Request body: `{ propertyId, amount, date, categoryId, description? }`
  - [x] Return 201 with expense ID on success
  - [x] Return 404 if receipt not found
  - [x] Return 409 if receipt already processed

- [x] Task 3: Create Receipt Image Viewer Component (AC: 5.4.2)
  - [x] Create `frontend/src/app/features/receipts/components/receipt-image-viewer/`
  - [x] Input: `viewUrl` (presigned S3 URL), `contentType`
  - [x] Implement zoom controls (scale transform, 50%-200% range)
  - [x] Implement pan/drag (transform translate with mouse events)
  - [x] Implement rotate (90° increments, transform rotate)
  - [x] Loading spinner during image load
  - [x] Error state with retry button
  - [x] PDF handling: show icon + "View PDF" link (opens new tab)

- [x] Task 4: Create Receipt Processing Page Component (AC: 5.4.1, 5.4.3, 5.4.5, 5.4.6)
  - [x] Create `frontend/src/app/features/receipts/receipt-process/receipt-process.component.ts`
  - [x] Route parameter: `:id` (receipt GUID)
  - [x] Load receipt details on init via `GET /api/v1/receipts/{id}`
  - [x] Side-by-side layout (flex, responsive)
  - [x] Embed ReceiptImageViewer (left) and expense form (right)
  - [x] Pre-populate property if receipt has propertyId
  - [x] Pre-populate date from receipt.createdAt

- [x] Task 5: Create Receipt Expense Form Component (AC: 5.4.3, 5.4.4)
  - [x] Create `frontend/src/app/features/receipts/components/receipt-expense-form/`
  - [x] Inputs: `receiptId`, `propertyId?`, `defaultDate`
  - [x] Output: `saved` event
  - [x] Reuse expense form patterns (CategorySelectComponent, CurrencyInput)
  - [x] Property dropdown (load properties, pre-select if provided)
  - [x] Submit calls `POST /api/v1/receipts/{id}/process`
  - [x] On success: emit saved event, call store.removeFromQueue()

- [x] Task 6: Add Route for Receipt Processing (AC: 5.4.1)
  - [x] Add route `receipts/:id` in app.routes.ts
  - [x] Load ReceiptProcessComponent
  - [x] No unsaved changes guard needed (viewing receipt, not critical data)

- [x] Task 7: Implement Assembly Line Logic (AC: 5.4.5)
  - [x] After save in ReceiptProcessComponent:
    - [x] Get next receipt from store.unprocessedReceipts()
    - [x] If next exists, navigate to `/receipts/{nextId}`
    - [x] If no more receipts, navigate to `/receipts`
  - [x] Receipts page shows "All caught up!" empty state

- [x] Task 8: Handle Already Processed Receipts (AC: 5.4.7)
  - [x] On ReceiptProcessComponent init, check if receipt.processedAt exists
  - [x] If processed, redirect to /receipts with snackbar "Receipt already processed"

- [x] Task 9: Update TypeScript API Client
  - [x] Run `npm run generate-api` to add new endpoint
  - [x] Verify `processReceipt(id, request)` method exists

- [x] Task 10: Write Backend Unit Tests
  - [x] Test ProcessReceiptHandler creates expense with correct data
  - [x] Test ProcessReceiptHandler sets ProcessedAt timestamp
  - [x] Test ProcessReceiptHandler links expense to receipt
  - [x] Test ProcessReceiptHandler returns 404 for missing receipt
  - [x] Test ProcessReceiptHandler returns 409 for already processed
  - [x] Test transaction rollback on failure

- [x] Task 11: Write Frontend Unit Tests
  - [x] `receipt-image-viewer.component.spec.ts`:
    - [x] Test image loads with presigned URL
    - [x] Test zoom in/out controls
    - [x] Test rotate controls
    - [x] Test PDF displays icon and link
  - [x] `receipt-expense-form.component.spec.ts`:
    - [x] Test form validation
    - [x] Test property pre-selection
    - [x] Test date pre-population
    - [x] Test submit calls API
  - [x] `receipt-process.component.spec.ts`:
    - [x] Test layout renders correctly
    - [x] Test receipt data loads
    - [x] Test navigation to next receipt after save
    - [x] Test redirect when receipt already processed

- [x] Task 12: Write E2E Tests
  - [x] Test processing page loads with receipt image
  - [x] Test form submission creates expense
  - [x] Test assembly line navigates to next receipt
  - [x] Test cancel returns to queue

- [x] Task 13: Manual Verification
  - [x] All backend tests pass (`dotnet test`)
  - [x] All frontend tests pass (`npm test`)
  - [x] Receipt image displays and zooms correctly
  - [x] Property pre-selects when tagged
  - [x] Expense created with receipt linked
  - [x] Badge count decreases after processing
  - [x] Assembly line loads next receipt automatically
  - [x] Empty state shows after last receipt processed

## Dev Notes

### Architecture Patterns

**Clean Architecture CQRS Pattern:**
```
Application/Receipts/
├── ProcessReceipt.cs            # NEW - Command + Handler + Validator
├── ProcessReceiptValidator.cs   # NEW - FluentValidation
├── CreateReceipt.cs             # Existing
├── GetReceipt.cs                # Existing
├── GetUnprocessedReceipts.cs    # Existing
└── DeleteReceipt.cs             # Existing
```

**Frontend Feature Structure:**
```
frontend/src/app/features/receipts/
├── receipts.component.ts              # Existing - queue display
├── stores/
│   └── receipt.store.ts               # Existing - add method for setting current receipt
├── services/
│   └── receipt-capture.service.ts     # Existing
└── components/
    ├── mobile-capture-fab/            # Existing
    ├── property-tag-modal/            # Existing
    ├── receipt-queue-item/            # Existing
    ├── receipt-image-viewer/          # NEW - zoom/pan/rotate image viewer
    └── receipt-expense-form/          # NEW - expense form for receipt processing
├── receipt-process/                   # NEW - processing page
│   └── receipt-process.component.ts
```

### Backend Implementation

**ProcessReceipt Command (Application Layer):**
```csharp
// Application/Receipts/ProcessReceipt.cs
public record ProcessReceiptCommand(
    Guid ReceiptId,
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
) : IRequest<Guid>; // Returns expense ID

public class ProcessReceiptHandler : IRequestHandler<ProcessReceiptCommand, Guid>
{
    private readonly AppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public async Task<Guid> Handle(ProcessReceiptCommand request, CancellationToken ct)
    {
        // 1. Find receipt
        var receipt = await _context.Receipts
            .FirstOrDefaultAsync(r =>
                r.Id == request.ReceiptId &&
                r.AccountId == _currentUser.AccountId, ct);

        if (receipt == null)
            throw new NotFoundException("Receipt", request.ReceiptId);

        if (receipt.ProcessedAt != null)
            throw new BusinessRuleException($"Receipt {request.ReceiptId} is already processed");

        // 2. Create expense
        var expense = new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _currentUser.AccountId,
            PropertyId = request.PropertyId,
            CategoryId = request.CategoryId,
            Amount = request.Amount,
            Date = request.Date,
            Description = request.Description,
            ReceiptId = receipt.Id,
            CreatedByUserId = _currentUser.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Expenses.Add(expense);

        // 3. Mark receipt as processed
        receipt.ProcessedAt = DateTime.UtcNow;
        receipt.ExpenseId = expense.Id;
        receipt.PropertyId = request.PropertyId; // Update property if changed

        await _context.SaveChangesAsync(ct);

        return expense.Id;
    }
}
```

**Controller Endpoint:**
```csharp
// Api/Controllers/ReceiptsController.cs
[HttpPost("{id:guid}/process")]
[ProducesResponseType(typeof(ProcessReceiptResponse), StatusCodes.Status201Created)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
public async Task<IActionResult> ProcessReceipt(Guid id, [FromBody] ProcessReceiptRequest request)
{
    var command = new ProcessReceiptCommand(
        id,
        request.PropertyId,
        request.Amount,
        DateOnly.Parse(request.Date),
        request.CategoryId,
        request.Description);

    var expenseId = await _mediator.Send(command);

    return CreatedAtAction(
        "GetExpense",
        "Expenses",
        new { id = expenseId },
        new ProcessReceiptResponse(expenseId));
}

public record ProcessReceiptRequest(
    Guid PropertyId,
    decimal Amount,
    string Date,
    Guid CategoryId,
    string? Description
);

public record ProcessReceiptResponse(Guid ExpenseId);
```

### Frontend Implementation

**Receipt Image Viewer Component:**
```typescript
// components/receipt-image-viewer/receipt-image-viewer.component.ts
@Component({
  selector: 'app-receipt-image-viewer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="viewer-container">
      <!-- Controls -->
      <div class="viewer-controls">
        <button mat-icon-button (click)="zoomOut()" [disabled]="scale() <= 0.5">
          <mat-icon>remove</mat-icon>
        </button>
        <span class="zoom-level">{{ (scale() * 100) | number:'1.0-0' }}%</span>
        <button mat-icon-button (click)="zoomIn()" [disabled]="scale() >= 2">
          <mat-icon>add</mat-icon>
        </button>
        <button mat-icon-button (click)="rotateLeft()">
          <mat-icon>rotate_left</mat-icon>
        </button>
        <button mat-icon-button (click)="rotateRight()">
          <mat-icon>rotate_right</mat-icon>
        </button>
        <button mat-icon-button (click)="resetView()">
          <mat-icon>restart_alt</mat-icon>
        </button>
      </div>

      <!-- Image/PDF Display -->
      @if (isPdf()) {
        <div class="pdf-placeholder">
          <mat-icon>description</mat-icon>
          <p>PDF Receipt</p>
          <a [href]="viewUrl()" target="_blank" mat-stroked-button>
            Open PDF
          </a>
        </div>
      } @else {
        <div class="image-viewport"
             (mousedown)="onMouseDown($event)"
             (mousemove)="onMouseMove($event)"
             (mouseup)="onMouseUp()"
             (wheel)="onWheel($event)">
          @if (isLoading()) {
            <mat-spinner diameter="40"></mat-spinner>
          }
          <img
            [src]="viewUrl()"
            [style.transform]="imageTransform()"
            [class.loading]="isLoading()"
            (load)="onImageLoad()"
            (error)="onImageError()"
            alt="Receipt"
            draggable="false"
          >
          @if (hasError()) {
            <div class="error-state">
              <mat-icon>error</mat-icon>
              <p>Failed to load image</p>
              <button mat-stroked-button (click)="retry()">Retry</button>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ReceiptImageViewerComponent {
  viewUrl = input.required<string>();
  contentType = input.required<string>();

  protected scale = signal(1);
  protected rotation = signal(0);
  protected translateX = signal(0);
  protected translateY = signal(0);
  protected isLoading = signal(true);
  protected hasError = signal(false);

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  protected isPdf = computed(() =>
    this.contentType().toLowerCase() === 'application/pdf'
  );

  protected imageTransform = computed(() =>
    `scale(${this.scale()}) rotate(${this.rotation()}deg) translate(${this.translateX()}px, ${this.translateY()}px)`
  );

  protected zoomIn(): void {
    this.scale.update(s => Math.min(s + 0.25, 2));
  }

  protected zoomOut(): void {
    this.scale.update(s => Math.max(s - 0.25, 0.5));
  }

  protected rotateLeft(): void {
    this.rotation.update(r => r - 90);
  }

  protected rotateRight(): void {
    this.rotation.update(r => r + 90);
  }

  protected resetView(): void {
    this.scale.set(1);
    this.rotation.set(0);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  protected onMouseDown(event: MouseEvent): void {
    if (this.scale() > 1) {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  protected onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const dx = event.clientX - this.lastMouseX;
      const dy = event.clientY - this.lastMouseY;
      this.translateX.update(x => x + dx / this.scale());
      this.translateY.update(y => y + dy / this.scale());
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  protected onMouseUp(): void {
    this.isDragging = false;
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  protected onImageLoad(): void {
    this.isLoading.set(false);
  }

  protected onImageError(): void {
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  protected retry(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    // Force image reload by appending timestamp
  }
}
```

**Receipt Processing Page Component:**
```typescript
// receipt-process/receipt-process.component.ts
@Component({
  selector: 'app-receipt-process',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    ReceiptImageViewerComponent,
    ReceiptExpenseFormComponent
  ],
  template: `
    <div class="receipt-process-page">
      @if (isLoading()) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error</mat-icon>
          <h2>{{ error() }}</h2>
          <button mat-stroked-button routerLink="/receipts">Back to Receipts</button>
        </div>
      } @else if (receipt()) {
        <div class="split-view">
          <!-- Left: Image Viewer -->
          <div class="image-panel">
            <app-receipt-image-viewer
              [viewUrl]="receipt()!.viewUrl"
              [contentType]="receipt()!.contentType"
            />
          </div>

          <!-- Right: Expense Form -->
          <div class="form-panel">
            <h2>Create Expense from Receipt</h2>
            <app-receipt-expense-form
              [receiptId]="receipt()!.id"
              [propertyId]="receipt()!.propertyId ?? undefined"
              [defaultDate]="receipt()!.createdAt"
              (saved)="onExpenseSaved()"
              (cancelled)="onCancel()"
            />
          </div>
        </div>
      }
    </div>
  `
})
export class ReceiptProcessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly store = inject(ReceiptStore);
  private readonly snackbar = inject(MatSnackBar);

  protected receipt = signal<ReceiptDto | null>(null);
  protected isLoading = signal(true);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid receipt ID');
      this.isLoading.set(false);
      return;
    }
    this.loadReceipt(id);
  }

  private loadReceipt(id: string): void {
    this.api.receipts_GetReceipt(id).subscribe({
      next: (receipt) => {
        if (receipt.processedAt) {
          // Already processed - redirect
          this.snackbar.open('Receipt already processed', 'Close', { duration: 3000 });
          this.router.navigate(['/receipts']);
          return;
        }
        this.receipt.set(receipt);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Receipt not found');
        this.isLoading.set(false);
      }
    });
  }

  protected onExpenseSaved(): void {
    // Remove from store (optimistic update)
    this.store.removeFromQueue(this.receipt()!.id);

    // Assembly line: navigate to next receipt
    const remaining = this.store.unprocessedReceipts();
    if (remaining.length > 0) {
      this.router.navigate(['/receipts', remaining[0].id]);
    } else {
      this.router.navigate(['/receipts']);
    }
  }

  protected onCancel(): void {
    this.router.navigate(['/receipts']);
  }
}
```

### Existing Infrastructure (From Stories 5-1, 5-2, 5-3)

**CRITICAL: Reuse existing components - DO NOT recreate!**

**Backend (Already Implemented):**
- `Receipt` entity with `ProcessedAt`, `ExpenseId` fields
- `ReceiptsController` with CRUD endpoints
- `GetReceipt` query returns receipt with presigned viewUrl
- `S3StorageService` with presigned URL generation
- `Expense` entity with `ReceiptId` field
- FluentValidation pipeline

**Frontend (Already Implemented):**
- `ReceiptStore` with `removeFromQueue()` method
- `CategorySelectComponent` for expense categories
- `CurrencyInputDirective` for amount formatting
- `ExpenseStore` for categories
- All property-related components and stores

### API Contracts

**GET /api/v1/receipts/{id}** (Existing)
Response includes: `id`, `createdAt`, `propertyId`, `propertyName`, `contentType`, `viewUrl`, `processedAt`

**POST /api/v1/receipts/{id}/process** (NEW)
Request:
```json
{
  "propertyId": "uuid",
  "amount": 125.50,
  "date": "2025-12-31",
  "categoryId": "uuid",
  "description": "Home Depot - supplies"
}
```

Response (201 Created):
```json
{
  "expenseId": "uuid"
}
```

Error Responses:
- 404: Receipt not found
- 409: Receipt already processed (`{ "error": "Receipt is already processed" }`)
- 400: Validation errors

### Responsive Layout

**Desktop (≥768px):**
```
┌─────────────────────────────────────────────────────┐
│ ┌───────────────────┐  ┌─────────────────────────┐  │
│ │                   │  │                         │  │
│ │   Receipt Image   │  │    Create Expense       │  │
│ │   with zoom/pan   │  │    Form                 │  │
│ │   controls        │  │                         │  │
│ │                   │  │    • Property           │  │
│ │                   │  │    • Amount             │  │
│ │                   │  │    • Date               │  │
│ │                   │  │    • Category           │  │
│ │                   │  │    • Description        │  │
│ │                   │  │                         │  │
│ │                   │  │    [Cancel] [Save]      │  │
│ └───────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │          Receipt Image (smaller height)         │ │
│ │          with zoom controls                     │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │          Create Expense Form                    │ │
│ │                                                 │ │
│ │          • Property dropdown                    │ │
│ │          • Amount                               │ │
│ │          • Date                                 │ │
│ │          • Category                             │ │
│ │          • Description                          │ │
│ │                                                 │ │
│ │          [Cancel]     [Save]                    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Testing Strategy

**Backend Unit Tests (xUnit):**
```csharp
[Fact]
public async Task Handle_ValidRequest_CreatesExpenseAndMarksProcessed()
{
    // Arrange: Create unprocessed receipt
    // Act: Send ProcessReceiptCommand
    // Assert: Expense created with correct data
    // Assert: Receipt.ProcessedAt is set
    // Assert: Receipt.ExpenseId matches expense.Id
}

[Fact]
public async Task Handle_ReceiptNotFound_ThrowsNotFoundException() { }

[Fact]
public async Task Handle_AlreadyProcessed_ThrowsBusinessRuleException() { }
```

**Frontend Unit Tests (Vitest):**
- Test image viewer zoom/pan/rotate functionality
- Test form validation and pre-population
- Test API call on submit
- Test navigation after save

### Previous Story Learnings (From 5-3)

**Patterns to Follow:**
- @ngrx/signals store pattern with computed signals
- Standalone components with explicit imports
- Data-testid attributes for E2E testing
- Loading/error states in components
- Snackbar for user feedback

**Code Files to Reference:**
- `receipt-queue-item.component.ts` - component pattern
- `receipt.store.ts` - store pattern with removeFromQueue
- `expense-form.component.ts` - form validation pattern
- `category-select.component.ts` - category dropdown

### Git Context

Recent commits for Epic 5:
- `14a03e5` feat(receipts): Add unprocessed receipt queue with navigation badges (#47)
- `e5bf51e` feat(receipts): Add mobile receipt capture with camera FAB (#46)
- `c724331` feat(receipts): Add S3 presigned URL infrastructure for receipt uploads (#45)

### Deployment Notes

- No database migrations needed (Receipt and Expense entities exist with required fields)
- No new environment variables required
- S3 bucket already configured

### Project Structure Notes

- Alignment: Follows existing feature-based structure
- New route added to app.routes.ts matching existing pattern
- Component structure mirrors receipts feature organization
- Reuses expense form patterns from Epic 3

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Contracts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4: Process Receipt into Expense]
- [Source: _bmad-output/implementation-artifacts/5-3-unprocessed-receipt-queue.md]
- [Source: frontend/src/app/features/expenses/components/expense-form/expense-form.component.ts]
- [Source: frontend/src/app/features/receipts/stores/receipt.store.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
