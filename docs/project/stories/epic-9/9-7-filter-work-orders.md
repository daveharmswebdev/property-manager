# Story 9.7: Filter Work Orders

Status: done

## Story

As a **property owner**,
I want **to filter work orders by status and property**,
So that **I can focus on what needs attention across my properties**.

## Acceptance Criteria

### AC #1: Filter Controls UI

**Given** I am on the Work Orders dashboard (`/work-orders`)
**When** I look at the filter controls
**Then** I see:
- Status filter (multi-select chips: Reported, Assigned, Completed)
- Property filter (dropdown of my properties with "All Properties" default)

### AC #2: Status Filter Behavior

**Given** I select status "Reported" and "Assigned"
**When** the filter applies
**Then** only work orders with those statuses are shown
**And** Completed work orders are hidden

### AC #3: Property Filter Behavior

**Given** I select a specific property from the dropdown
**When** the filter applies
**Then** only work orders for that property are shown

### AC #4: Combined Filters (AND Logic)

**Given** I apply multiple filters (e.g., Status = "Reported" AND Property = "Oak Street Duplex")
**When** viewing results
**Then** filters combine with AND logic
**And** only work orders matching ALL selected filters are shown

### AC #5: Active Filter Indicators

**Given** I have active filters applied
**When** viewing the filter controls
**Then** I see visual indicators showing which filters are active (e.g., highlighted chips, selected dropdown value)
**And** I see a "Clear filters" link/button

### AC #6: Clear Filters

**Given** I click "Clear filters"
**When** the list refreshes
**Then** all filters are reset to default (all statuses, all properties)
**And** all work orders are shown again

### AC #7: Empty Filter Results

**Given** no work orders match my filters
**When** the list is empty due to filtering
**Then** I see "No work orders match your filters" message
**And** I see the "Clear filters" link

## Tasks / Subtasks

### Task 1: Update Backend to Support Multi-Status Filter (AC: #2, #4)

- [x] 1.1 Modify `GetAllWorkOrdersQuery` to accept comma-separated status values (e.g., `?status=Reported,Assigned`)
- [x] 1.2 Update `GetAllWorkOrdersQueryHandler` to parse comma-separated statuses and filter with `IN` clause
- [x] 1.3 Add unit tests for multi-status filtering in `GetAllWorkOrdersQueryHandlerTests`

### Task 2: Add Filter State to WorkOrderStore (AC: #1-6)

- [x] 2.1 Add filter state to `WorkOrderState` interface:
  - `selectedStatuses: string[]` (default: all statuses)
  - `selectedPropertyId: string | null` (default: null = all properties)
- [x] 2.2 Add computed signal `hasActiveFilters` to detect when filters are applied
- [x] 2.3 Add method `setStatusFilter(statuses: string[])` to update status filter
- [x] 2.4 Add method `setPropertyFilter(propertyId: string | null)` to update property filter
- [x] 2.5 Add method `clearFilters()` to reset all filters to defaults
- [x] 2.6 Modify `loadWorkOrders` to send comma-separated statuses when filtering

### Task 3: Create Filter UI Component (AC: #1, #5)

- [x] 3.1 Add filter section to `work-orders.component.ts` template between header and list
- [x] 3.2 Implement status filter using Angular Material chips (`mat-chip-listbox` with `multiple` selection)
- [x] 3.3 Implement property filter using `mat-select` dropdown
- [x] 3.4 Load properties list from PropertyStore or PropertyService on component init
- [x] 3.5 Add "Clear filters" button that appears when `hasActiveFilters` is true
- [x] 3.6 Style filter section to match existing design patterns

### Task 4: Wire Up Filter Logic (AC: #2-4, #6)

- [x] 4.1 Connect status chip selection to `store.setStatusFilter()`
- [x] 4.2 Connect property dropdown selection to `store.setPropertyFilter()`
- [x] 4.3 Call `store.loadWorkOrders()` with filter params when filters change
- [x] 4.4 Connect "Clear filters" button to `store.clearFilters()` and reload

### Task 5: Handle Empty Filter Results (AC: #7)

- [x] 5.1 Add `isFilteredEmpty` computed signal (empty results with active filters)
- [x] 5.2 Add filtered empty state template: "No work orders match your filters" with clear button
- [x] 5.3 Distinguish between truly empty (no work orders ever) vs filtered empty

### Task 6: Testing (AC: #1-7)

- [x] 6.1 Backend unit tests:
  - Multi-status filter parses and filters correctly
  - Property filter works with status filter combined
  - Empty results return empty array (not error)
- [x] 6.2 Frontend unit tests:
  - Filter chips render all three statuses
  - Property dropdown loads and displays properties
  - Status selection triggers store method
  - Property selection triggers store method
  - Clear filters resets state and reloads
  - Filtered empty state displays correctly
  - Active filter indicators show when filters applied
- [x] 6.3 Manual verification:
  - [x] Navigate to /work-orders with existing work orders
  - [x] Verify status chips appear (Reported, Assigned, Completed)
  - [x] Verify property dropdown loads with all properties
  - [x] Select "Reported" only - verify only Reported work orders shown
  - [x] Select a property - verify only that property's work orders shown
  - [x] Apply both filters - verify AND logic works
  - [x] Verify active filter indicators visible
  - [x] Click "Clear filters" - verify all work orders return
  - [x] Apply filters that return no results - verify empty state message

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
```
frontend/src/app/features/work-orders/
├── work-orders.component.ts           ← MODIFIED (add filter UI)
├── work-orders.component.spec.ts      ← MODIFIED (add filter tests)
├── stores/
│   └── work-order.store.ts            ← MODIFIED (add filter state/methods)
└── services/
    └── work-order.service.ts          ← MODIFIED (update getWorkOrders for multi-status)
```

**Backend Structure:**
```
backend/src/PropertyManager.Application/WorkOrders/
└── GetAllWorkOrders.cs                ← MODIFIED (support comma-separated status)

backend/tests/PropertyManager.Application.Tests/WorkOrders/
└── GetAllWorkOrdersQueryHandlerTests.cs ← MODIFIED (add multi-status tests)
```

### Current Implementation Analysis

**Backend (GetAllWorkOrders.cs:56-60):**
- Currently parses single status: `Enum.TryParse<WorkOrderStatus>(request.Status, ignoreCase: true, out var statusEnum)`
- Needs to handle comma-separated values: `"Reported,Assigned"`

**Frontend Store (work-order.store.ts:75-105):**
- `loadWorkOrders` already accepts `{ status?: string; propertyId?: string }`
- Need to add filter state and methods to manage UI selections

**Frontend Service (work-order.service.ts:122-131):**
- `getWorkOrders(status?: string, propertyId?: string)` already passes params
- Status will be comma-separated string (e.g., "Reported,Assigned")

### Multi-Status Filter Implementation

**Backend Change:**
```csharp
// GetAllWorkOrders.cs - Replace single status parsing with multi-status
if (!string.IsNullOrWhiteSpace(request.Status))
{
    var statusStrings = request.Status.Split(',', StringSplitOptions.RemoveEmptyEntries);
    var validStatuses = statusStrings
        .Select(s => Enum.TryParse<WorkOrderStatus>(s.Trim(), ignoreCase: true, out var status) ? status : (WorkOrderStatus?)null)
        .Where(s => s.HasValue)
        .Select(s => s!.Value)
        .ToList();

    if (validStatuses.Any())
    {
        query = query.Where(w => validStatuses.Contains(w.Status));
    }
}
```

### Filter Store State Pattern

```typescript
// work-order.store.ts additions
interface WorkOrderState {
  // ... existing state ...
  selectedStatuses: string[];      // Default: ['Reported', 'Assigned', 'Completed']
  selectedPropertyId: string | null;  // Default: null (all properties)
}

// In withComputed:
hasActiveFilters: computed(() => {
  const allStatuses = ['Reported', 'Assigned', 'Completed'];
  const hasStatusFilter = store.selectedStatuses().length < allStatuses.length;
  const hasPropertyFilter = store.selectedPropertyId() !== null;
  return hasStatusFilter || hasPropertyFilter;
}),

isFilteredEmpty: computed(() =>
  !store.isLoading() &&
  store.workOrders().length === 0 &&
  store.hasActiveFilters()
),

// In withMethods:
setStatusFilter(statuses: string[]): void {
  patchState(store, { selectedStatuses: statuses });
  // Build comma-separated status string
  const statusParam = statuses.length < 3 ? statuses.join(',') : undefined;
  this.loadWorkOrders({ status: statusParam, propertyId: store.selectedPropertyId() ?? undefined });
},

setPropertyFilter(propertyId: string | null): void {
  patchState(store, { selectedPropertyId: propertyId });
  const statusParam = store.selectedStatuses().length < 3
    ? store.selectedStatuses().join(',')
    : undefined;
  this.loadWorkOrders({ status: statusParam, propertyId: propertyId ?? undefined });
},

clearFilters(): void {
  patchState(store, {
    selectedStatuses: ['Reported', 'Assigned', 'Completed'],
    selectedPropertyId: null,
  });
  this.loadWorkOrders();
},
```

### Filter UI Template Pattern

```typescript
// work-orders.component.ts template additions (after page-header, before work-orders-list)
<div class="filter-section">
  <div class="filter-group">
    <label>Status</label>
    <mat-chip-listbox multiple [value]="store.selectedStatuses()"
                       (change)="onStatusFilterChange($event)">
      <mat-chip-option value="Reported">Reported</mat-chip-option>
      <mat-chip-option value="Assigned">Assigned</mat-chip-option>
      <mat-chip-option value="Completed">Completed</mat-chip-option>
    </mat-chip-listbox>
  </div>

  <div class="filter-group">
    <mat-form-field>
      <mat-label>Property</mat-label>
      <mat-select [value]="store.selectedPropertyId()"
                  (selectionChange)="onPropertyFilterChange($event.value)">
        <mat-option [value]="null">All Properties</mat-option>
        @for (property of propertyStore.properties(); track property.id) {
          <mat-option [value]="property.id">{{ property.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  </div>

  @if (store.hasActiveFilters()) {
    <button mat-button color="primary" (click)="clearFilters()">
      <mat-icon>clear</mat-icon>
      Clear filters
    </button>
  }
</div>
```

### Angular Material Imports Needed

```typescript
// Add to imports array:
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
```

### Property Store Integration

Inject `PropertyStore` in the component to get the property list for the dropdown:

```typescript
protected readonly propertyStore = inject(PropertyStore);

ngOnInit(): void {
  this.store.loadWorkOrders();
  this.propertyStore.loadProperties(); // Load properties for filter dropdown
}
```

### Previous Story Intelligence (9-6)

From 9-6 implementation:
- Status badge styling already exists (`.status-reported`, `.status-assigned`, `.status-completed`)
- WorkOrderDto includes all fields needed for filtering display
- Store pattern uses `rxMethod` for async operations
- DatePipe already imported for date formatting

### Git Intelligence Summary

Recent commits show:
- `d99abf6` - Story 9-6 added status badges and created date to dashboard
- `a8332a8` - Story 9-5 added inline vendor creation
- Work orders feature following established patterns

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR23 | Users can filter work orders by status | Status multi-select filter chips |
| FR24 | Users can filter work orders by property | Property dropdown filter |

### Testing Requirements

**Backend Unit Tests (xUnit):**
- Multi-status parsing: `"Reported,Assigned"` returns work orders with either status
- Single status still works for backward compatibility
- Invalid status in comma list is ignored (only valid ones used)
- Empty status string returns all work orders
- Property + status combined filtering

**Frontend Unit Tests (Vitest):**
- Filter chips render and are selectable
- Property dropdown loads properties
- Status filter change calls store method
- Property filter change calls store method
- Clear filters resets to defaults
- `hasActiveFilters` computed correctly
- `isFilteredEmpty` vs `isEmpty` distinction
- Filtered empty state message renders

**Manual Verification:**
- [ ] Navigate to /work-orders with multiple work orders in different statuses
- [ ] Verify all three status chips appear and are initially selected
- [ ] Verify property dropdown shows "All Properties" + all user properties
- [ ] Deselect "Completed" - verify only Reported/Assigned work orders shown
- [ ] Select a specific property - verify only that property's work orders shown
- [ ] Apply both filters - verify combined AND filtering
- [ ] Verify "Clear filters" button appears when filters active
- [ ] Click "Clear filters" - verify all work orders return
- [ ] Apply filters with no matches - verify "No work orders match your filters" message
- [ ] Verify URL does not change when filtering (client-side filtering trigger)

### References

- [Source: epics-work-orders-vendors.md#Story 2.7] - Original story definition (lines 854-891)
- [Source: architecture.md#API Extensions] - Query parameter design (lines 1162-1170)
- [Source: work-orders.component.ts] - Current dashboard implementation
- [Source: work-order.store.ts] - Current store implementation
- [Source: GetAllWorkOrders.cs] - Current backend query handler
- [Source: 9-6-work-order-dashboard.md] - Previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Backend tests: 1,010 tests passing (747 Application + 85 Infrastructure + 178 API)
- Frontend tests: 1,228 tests passing (13 new filter tests added)

### Completion Notes List

1. **Task 1 (Backend)**: Implemented multi-status filter parsing in `GetAllWorkOrdersQueryHandler`. Status parameter now accepts comma-separated values (e.g., "Reported,Assigned"). Invalid statuses are gracefully ignored. Added 12 unit tests covering various edge cases.

2. **Task 2 (Store)**: Added filter state (`selectedStatuses`, `selectedPropertyId`) and computed signals (`hasActiveFilters`, `isFilteredEmpty`) to `WorkOrderStore`. Implemented `setStatusFilter()`, `setPropertyFilter()`, and `clearFilters()` methods.

3. **Task 3-4 (UI)**: Added filter section to `WorkOrdersComponent` with status chips (mat-chip-listbox) and property dropdown (mat-select). Integrated PropertyStore for property list. Clear filters button appears when filters are active.

4. **Task 5 (Empty State)**: Distinguished between truly empty (no work orders) and filtered empty (no matches). Shows appropriate message for each case with clear filters option.

5. **Task 6 (Testing)**: All unit tests passing. Manual verification completed via Playwright browser automation.

### File List

**Backend (Modified):**
- `backend/src/PropertyManager.Application/WorkOrders/GetAllWorkOrders.cs` - Multi-status filter parsing
- `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersHandlerTests.cs` - 12 new tests

**Frontend (Modified):**
- `frontend/src/app/features/work-orders/stores/work-order.store.ts` - Filter state and methods
- `frontend/src/app/features/work-orders/work-orders.component.ts` - Filter UI and event handlers
- `frontend/src/app/features/work-orders/work-orders.component.spec.ts` - 13 new filter tests
