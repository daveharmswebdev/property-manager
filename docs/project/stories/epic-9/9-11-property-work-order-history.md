# Story 9.11: Property Work Order History

Status: done

## Story

As a **property owner**,
I want **to see all work orders for a specific property on its detail page**,
So that **I can understand the maintenance history of that property**.

## Acceptance Criteria

### AC #1: Work Orders Section Display

**Given** I am on a property detail page (`/properties/:id`)
**When** the page loads
**Then** I see a "Work Orders" section showing:
- List of work orders for this property only
- Each item displays: status badge, description (truncated), assigned to, created date
- Count of total work orders for this property (e.g., "Work Orders (3)")

### AC #2: Empty State

**Given** the property has no work orders
**When** I view the Work Orders section
**Then** I see "No work orders for this property"
**And** I see a "+ New Work Order" button

### AC #3: Create Work Order with Pre-Selection

**Given** I click "+ New Work Order" from the property detail page
**When** the work order create form opens (`/work-orders/create`)
**Then** the property is pre-selected in the property dropdown
**And** the property dropdown should be readonly/disabled (locked to this property)

### AC #4: Navigate to Work Order Detail

**Given** I click on a work order in the list
**When** navigation completes
**Then** I am taken to that work order's detail page (`/work-orders/:id`)

### AC #5: View All Link (Pagination)

**Given** the property has many work orders (more than 5)
**When** I view the Work Orders section
**Then** I see the most recent 5 work orders
**And** I see a "View all" link
**And** clicking "View all" takes me to Work Orders dashboard filtered by this property (`/work-orders?propertyId=:id`)

### AC #6: Loading State

**Given** work orders are being loaded for the property
**When** I view the section
**Then** I see a loading spinner inside the Work Orders card

### AC #7: Error State

**Given** work orders fail to load
**When** the error occurs
**Then** I see an error message "Failed to load work orders"
**And** I see a "Retry" button

## Tasks / Subtasks

### Task 1: Backend - Add GetWorkOrdersByProperty Query (AC: #1, #5)

- [x] 1.1 Create `GetWorkOrdersByProperty.cs` in `Application/WorkOrders/`:
  - Query: `GetWorkOrdersByPropertyQuery(Guid PropertyId, int? Limit = null)`
  - Handler returns list ordered by `CreatedAt DESC`
  - Respects tenant isolation (AccountId filter)
  - Excludes soft-deleted work orders
  - Optional `Limit` parameter for top N results
- [x] 1.2 Add endpoint to `WorkOrdersController.cs`:
  - `GET /api/v1/properties/{propertyId:guid}/work-orders`
  - Query param: `?limit=5` (optional, default returns all)
  - Returns `{ items: WorkOrderDto[], totalCount: number }`
- [x] 1.3 Add unit tests in `GetWorkOrdersByPropertyHandlerTests.cs`:
  - Returns work orders for specified property
  - Respects tenant isolation
  - Returns empty array for property with no work orders
  - Respects limit parameter
  - Orders by CreatedAt DESC

### Task 2: Frontend - Create PropertyWorkOrdersComponent (AC: #1, #2, #4, #6, #7)

- [x] 2.1 Create `property-work-orders/` folder under `features/properties/components/`
- [x] 2.2 Create `property-work-orders.component.ts`:
  - `@Input() propertyId: string` - required property ID
  - Loads work orders on init via dedicated service method
  - Displays list with status badge, description, assignee, date
  - Empty state with icon and message
  - Loading spinner state
  - Error state with retry button
- [x] 2.3 Create component template matching existing activity card styling:
  ```html
  <mat-card class="activity-card">
    <mat-card-header>
      <mat-card-title>Work Orders ({{ totalCount }})</mat-card-title>
      <button mat-stroked-button (click)="onNewWorkOrder()">
        <mat-icon>add</mat-icon> New Work Order
      </button>
    </mat-card-header>
    <mat-card-content>
      <!-- Loading/Error/Empty/List states -->
    </mat-card-content>
  </mat-card>
  ```
- [x] 2.4 Add component unit tests

### Task 3: Frontend - Add PropertyWorkOrderService Method (AC: #1, #5)

- [x] 3.1 Add method to `WorkOrderService`:
  ```typescript
  getWorkOrdersByProperty(propertyId: string, limit?: number): Observable<WorkOrderListResponse>
  ```
- [x] 3.2 Calls `GET /api/v1/properties/{propertyId}/work-orders?limit={limit}`
- [x] 3.3 Returns typed response with `items` and `totalCount`

### Task 4: Integrate into PropertyDetailComponent (AC: #1, #2, #3, #4, #5)

- [x] 4.1 Import `PropertyWorkOrdersComponent` into `property-detail.component.ts`
- [x] 4.2 Add `<app-property-work-orders>` to template after Photo Gallery section:
  ```html
  <!-- Work Orders Section (Story 9-11) -->
  <app-property-work-orders
    [propertyId]="propertyStore.selectedProperty()!.id"
    (createClick)="onCreateWorkOrder()"
    (viewAllClick)="onViewAllWorkOrders()"
  />
  ```
- [x] 4.3 Add navigation handlers:
  - `onCreateWorkOrder()`: Navigate to `/work-orders/create?propertyId=${propertyId}`
  - `onViewAllWorkOrders()`: Navigate to `/work-orders?propertyId=${propertyId}`

### Task 5: Support Pre-Selected Property in Create Form (AC: #3)

- [x] 5.1 Update `WorkOrderCreateComponent` to read `propertyId` from query params:
  ```typescript
  ngOnInit(): void {
    const propertyId = this.route.snapshot.queryParamMap.get('propertyId');
    if (propertyId) {
      this.preSelectedPropertyId = propertyId;
    }
  }
  ```
- [x] 5.2 Update `WorkOrderFormComponent` to accept `@Input() preSelectedPropertyId: string | null`
- [x] 5.3 When `preSelectedPropertyId` is provided:
  - Pre-select the property in the dropdown
  - Disable the property dropdown (readonly)
  - Show visual indication that property is locked

### Task 6: Testing (AC: #1-#7)

- [x] 6.1 Backend unit tests (xUnit):
  - GetWorkOrdersByPropertyHandler returns correct work orders
  - GetWorkOrdersByPropertyHandler respects tenant isolation
  - GetWorkOrdersByPropertyHandler handles limit parameter
  - GetWorkOrdersByPropertyHandler orders by CreatedAt DESC
- [x] 6.2 Frontend unit tests (Vitest):
  - PropertyWorkOrdersComponent renders work orders list
  - PropertyWorkOrdersComponent shows empty state
  - PropertyWorkOrdersComponent shows loading state
  - PropertyWorkOrdersComponent shows error state with retry
  - PropertyWorkOrdersComponent emits createClick event
  - WorkOrderCreateComponent reads propertyId from query params
  - WorkOrderFormComponent disables property dropdown when preSelected
- [ ] 6.3 Manual verification checklist:
  - Navigate to property detail page
  - Verify Work Orders section appears
  - Verify work orders display with status, description, assignee, date
  - Verify count shows in header
  - Click work order row - verify navigation to detail
  - Click "+ New Work Order" - verify navigation with propertyId query param
  - Verify property is pre-selected and locked in create form
  - Test "View all" link with property that has 6+ work orders
  - Test empty state on property with no work orders
  - Test loading spinner during fetch
  - Test error state and retry button

## Dev Notes

### Architecture Compliance

**Backend Structure:**
```
backend/src/PropertyManager.Application/WorkOrders/
├── GetWorkOrdersByProperty.cs       ← NEW (query + handler)
├── GetWorkOrders.cs                 ← EXISTS (dashboard list)
├── CreateWorkOrder.cs               ← EXISTS
└── ...

backend/tests/PropertyManager.Application.Tests/WorkOrders/
└── GetWorkOrdersByPropertyHandlerTests.cs  ← NEW
```

**Frontend Structure:**
```
frontend/src/app/features/properties/
├── property-detail/
│   └── property-detail.component.ts         ← MODIFY (add work orders section)
├── components/
│   └── property-work-orders/                 ← NEW folder
│       ├── property-work-orders.component.ts
│       └── property-work-orders.component.spec.ts

frontend/src/app/features/work-orders/
├── services/
│   └── work-order.service.ts                 ← MODIFY (add getWorkOrdersByProperty)
├── pages/
│   ├── work-order-create/
│   │   └── work-order-create.component.ts   ← MODIFY (read query param)
│   └── ...
├── components/
│   └── work-order-form/
│       └── work-order-form.component.ts     ← MODIFY (add preSelectedPropertyId)
```

### GetWorkOrdersByProperty Query Pattern

Follow existing `GetWorkOrders.cs` pattern but filtered by property:

```csharp
// Application/WorkOrders/GetWorkOrdersByProperty.cs
public record GetWorkOrdersByPropertyQuery(Guid PropertyId, int? Limit = null) : IRequest<GetWorkOrdersByPropertyResult>;

public record GetWorkOrdersByPropertyResult(IReadOnlyList<WorkOrderDto> Items, int TotalCount);

public class GetWorkOrdersByPropertyQueryHandler : IRequestHandler<GetWorkOrdersByPropertyQuery, GetWorkOrdersByPropertyResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public async Task<GetWorkOrdersByPropertyResult> Handle(GetWorkOrdersByPropertyQuery request, CancellationToken ct)
    {
        var query = _dbContext.WorkOrders
            .Include(w => w.Property)
            .Include(w => w.Vendor)
            .Include(w => w.Category)
            .Include(w => w.Tags)
            .Where(w => w.AccountId == _currentUser.AccountId)
            .Where(w => w.PropertyId == request.PropertyId)
            .OrderByDescending(w => w.CreatedAt);

        var totalCount = await query.CountAsync(ct);

        var items = request.Limit.HasValue
            ? await query.Take(request.Limit.Value).ToListAsync(ct)
            : await query.ToListAsync(ct);

        return new GetWorkOrdersByPropertyResult(
            items.Select(w => w.ToDto()).ToList(),
            totalCount
        );
    }
}
```

### Controller Endpoint

Add to existing `WorkOrdersController` or create route under `PropertiesController`:

```csharp
// Option 1: In WorkOrdersController (preferred - keeps work order logic together)
// GET /api/v1/properties/{propertyId}/work-orders
[HttpGet("/api/v1/properties/{propertyId:guid}/work-orders")]
[ProducesResponseType(typeof(GetWorkOrdersByPropertyResult), StatusCodes.Status200OK)]
public async Task<IActionResult> GetWorkOrdersByProperty(
    Guid propertyId,
    [FromQuery] int? limit,
    CancellationToken cancellationToken)
{
    var result = await _mediator.Send(
        new GetWorkOrdersByPropertyQuery(propertyId, limit),
        cancellationToken);
    return Ok(result);
}
```

### PropertyWorkOrdersComponent Pattern

Follow existing `activity-card` styling from property detail page:

```typescript
// property-work-orders.component.ts
@Component({
  selector: 'app-property-work-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  template: `
    <mat-card class="activity-card">
      <mat-card-header>
        <mat-card-title>
          Work Orders
          @if (!isLoading() && !error()) {
            ({{ totalCount() }})
          }
        </mat-card-title>
        <button mat-stroked-button color="primary" (click)="createClick.emit()">
          <mat-icon>add</mat-icon>
          New Work Order
        </button>
      </mat-card-header>
      <mat-card-content>
        @if (isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <button mat-stroked-button (click)="retry()">
              <mat-icon>refresh</mat-icon>
              Retry
            </button>
          </div>
        } @else if (workOrders().length === 0) {
          <div class="empty-state">
            <mat-icon>engineering</mat-icon>
            <p>No work orders for this property</p>
          </div>
        } @else {
          <div class="work-order-list">
            @for (wo of workOrders(); track wo.id) {
              <a class="work-order-item" [routerLink]="['/work-orders', wo.id]">
                <span class="status-badge" [class]="wo.status.toLowerCase()">
                  {{ wo.status }}
                </span>
                <span class="description">{{ wo.description | slice:0:50 }}{{ wo.description.length > 50 ? '...' : '' }}</span>
                <span class="assignee">{{ wo.vendorName || 'DIY' }}</span>
                <span class="date">{{ wo.createdAt | date:'shortDate' }}</span>
              </a>
            }
          </div>
          @if (totalCount() > displayLimit) {
            <div class="view-all">
              <a mat-button color="primary" (click)="viewAllClick.emit()">
                View all {{ totalCount() }} work orders
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `
})
export class PropertyWorkOrdersComponent implements OnInit {
  @Input({ required: true }) propertyId!: string;
  @Output() createClick = new EventEmitter<void>();
  @Output() viewAllClick = new EventEmitter<void>();

  private workOrderService = inject(WorkOrderService);

  readonly displayLimit = 5;
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly workOrders = signal<WorkOrderDto[]>([]);
  readonly totalCount = signal(0);

  ngOnInit(): void {
    this.loadWorkOrders();
  }

  loadWorkOrders(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.workOrderService.getWorkOrdersByProperty(this.propertyId, this.displayLimit)
      .subscribe({
        next: (response) => {
          this.workOrders.set(response.items);
          this.totalCount.set(response.totalCount);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load work orders');
          this.isLoading.set(false);
          console.error('Error loading property work orders:', err);
        }
      });
  }

  retry(): void {
    this.loadWorkOrders();
  }
}
```

### Pre-Selected Property in Create Form

Update `work-order-create.component.ts`:

```typescript
ngOnInit(): void {
  // Check for pre-selected property from query params (Story 9-11)
  const propertyId = this.route.snapshot.queryParamMap.get('propertyId');
  if (propertyId) {
    this.preSelectedPropertyId = propertyId;
  }
  this.propertyStore.loadProperties();
  this.workOrderStore.loadTags();
}
```

Update `work-order-form.component.ts`:

```typescript
@Input() preSelectedPropertyId: string | null = null;

// In template, disable property select when pre-selected:
<mat-select formControlName="propertyId" [disabled]="preSelectedPropertyId !== null">
  ...
</mat-select>

// In ngOnInit, set the value if pre-selected:
if (this.preSelectedPropertyId) {
  this.form.patchValue({ propertyId: this.preSelectedPropertyId });
}
```

### Styling (Match Existing Activity Cards)

Use same styles as Recent Expenses/Recent Income cards:

```scss
.work-order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.work-order-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  gap: 12px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;

    &.reported { background: #fff3e0; color: #e65100; }
    &.assigned { background: #e3f2fd; color: #1565c0; }
    &.completed { background: #e8f5e9; color: #2e7d32; }
  }

  .description {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assignee {
    color: var(--pm-text-secondary);
    font-size: 13px;
  }

  .date {
    color: var(--pm-text-secondary);
    font-size: 13px;
    white-space: nowrap;
  }
}

.view-all {
  margin-top: 12px;
  text-align: center;
  border-top: 1px solid var(--pm-border);
  padding-top: 12px;
}
```

### Previous Story Intelligence (9-9, 9-10)

From Stories 9-9 and 9-10:
- Work order store has `loadWorkOrders` with status/propertyId filters
- `WorkOrderService` has all CRUD methods
- Status badge styling established (Reported=orange, Assigned=blue, Completed=green)
- Navigation patterns to `/work-orders/:id` detail page
- Property dropdown pattern in work order form

### Git Intelligence

Recent work order commits:
- `cebe70d` - Story 9-9: Edit and delete functionality
- `7fe0f8e` - Story 9-8: Work order detail page
- `284717f` - Story 9-7: Filter work orders by status/property
- Pattern: Work order features follow Clean Architecture, @ngrx/signals for state

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR28 | Users can view work order history for a specific property | Work Orders section on property detail page |

### Testing Requirements

**Backend Unit Tests (xUnit):**
- GetWorkOrdersByPropertyHandler returns work orders for specified property
- GetWorkOrdersByPropertyHandler returns empty for property with no work orders
- GetWorkOrdersByPropertyHandler respects tenant isolation (different AccountId returns empty)
- GetWorkOrdersByPropertyHandler respects limit parameter
- GetWorkOrdersByPropertyHandler orders by CreatedAt DESC
- GetWorkOrdersByPropertyHandler excludes soft-deleted work orders

**Frontend Unit Tests (Vitest):**
- PropertyWorkOrdersComponent renders work orders list
- PropertyWorkOrdersComponent shows loading spinner during fetch
- PropertyWorkOrdersComponent shows empty state when no work orders
- PropertyWorkOrdersComponent shows error state on API failure
- PropertyWorkOrdersComponent retry button reloads work orders
- PropertyWorkOrdersComponent emits createClick when button clicked
- PropertyWorkOrdersComponent emits viewAllClick when link clicked
- PropertyWorkOrdersComponent shows "View all" only when totalCount > displayLimit
- WorkOrderCreateComponent reads propertyId from query params
- WorkOrderFormComponent sets property value when preSelectedPropertyId provided
- WorkOrderFormComponent disables property dropdown when preSelectedPropertyId provided

**Manual Verification Checklist:**
- [ ] Navigate to property detail page with work orders
- [ ] Verify Work Orders section appears below Photo Gallery
- [ ] Verify work orders display with status badge, description, assignee, date
- [ ] Verify count shows in header "Work Orders (N)"
- [ ] Click work order row - verify navigation to `/work-orders/:id`
- [ ] Click "+ New Work Order" button
- [ ] Verify navigation to `/work-orders/create?propertyId=:id`
- [ ] Verify property is pre-selected in dropdown
- [ ] Verify property dropdown is disabled/readonly
- [ ] Navigate to property with no work orders
- [ ] Verify empty state shows "No work orders for this property"
- [ ] Navigate to property with 6+ work orders
- [ ] Verify only 5 most recent show
- [ ] Verify "View all X work orders" link appears
- [ ] Click "View all" - verify navigation to `/work-orders?propertyId=:id`
- [ ] Verify work orders dashboard is filtered by that property

### References

- [Source: epics-work-orders-vendors.md#Story 2.11] - Property Work Order History (lines 990-1022)
- [Source: architecture.md#API Extensions] - GET /properties/{propertyId}/work-orders endpoint
- [Source: 9-9-edit-and-delete-work-order.md] - Previous story patterns and learnings
- [Source: property-detail.component.ts] - Activity card styling patterns (lines 244-296)
- [Source: work-order.store.ts] - Store patterns and filter methods
- [Source: work-order.service.ts] - Service patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No issues encountered during development.

### Completion Notes List

- Implemented GetWorkOrdersByProperty query following existing GetAllWorkOrders pattern
- Created 10 unit tests for the backend handler covering all ACs
- PropertyWorkOrdersComponent follows existing activity card styling patterns
- Pre-selection of property now locks/disables the dropdown with visual feedback (lock icon)
- WorkOrderCreateComponent already had propertyId query param support - just needed to enhance form component
- All 1286 frontend tests pass
- All 1036 backend tests pass

### File List

**Backend (New Files):**
- `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrdersByProperty.cs` - Query, Result, Handler
- `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetWorkOrdersByPropertyHandlerTests.cs` - 10 unit tests

**Backend (Modified Files):**
- `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs` - Added GetWorkOrdersByProperty endpoint

**Frontend (New Files):**
- `frontend/src/app/features/properties/components/property-work-orders/property-work-orders.component.ts` - Component
- `frontend/src/app/features/properties/components/property-work-orders/property-work-orders.component.spec.ts` - Unit tests

**Frontend (Modified Files):**
- `frontend/src/app/features/work-orders/services/work-order.service.ts` - Added getWorkOrdersByProperty method and response type
- `frontend/src/app/features/properties/property-detail/property-detail.component.ts` - Integrated PropertyWorkOrdersComponent, added navigation handlers
- `frontend/src/app/features/properties/property-detail/property-detail.component.spec.ts` - Added WorkOrderService mock
- `frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.ts` - Added isPropertyLocked computed, disabled property dropdown when pre-selected
