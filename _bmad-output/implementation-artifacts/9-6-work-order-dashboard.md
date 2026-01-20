# Story 9.6: Work Order Dashboard

Status: review

## Story

As a **property owner**,
I want **to see all my work orders in one place with status badges and dates**,
So that **I can track what's happening across all my properties at a glance**.

## Acceptance Criteria

### Frontend - Work Order List Display

1. **Given** I am logged in
   **When** I navigate to Work Orders (`/work-orders`)
   **Then** I see a list of all my work orders showing:
   - Status (as colored badge: Reported=amber/yellow, Assigned=blue, Completed=green)
   - Property name
   - Description (truncated if long)
   - Assigned to (vendor name or "Self (DIY)")
   - Category (if set)
   - Created date (formatted, e.g., "Jan 20, 2026")
   - Tags (as small chips)

### Frontend - Empty State

2. **Given** I have no work orders
   **When** I view the Work Orders page
   **Then** I see empty state: "No work orders yet. Create your first work order to track maintenance tasks."
   **And** I see a "Create Work Order" button

### Frontend - Sorting

3. **Given** I have multiple work orders
   **When** I view the list
   **Then** work orders are sorted by created date (newest first)
   **And** I can click any card to go to its detail page

### Frontend - New Work Order Navigation

4. **Given** I click "New Work Order" button
   **When** the form opens
   **Then** I can create a new work order (routes to /work-orders/new)

## Tasks / Subtasks

### Task 1: Add Status Badge Component (AC: #1)

- [x] 1.1 Create status badge styles using Angular Material theming:
  - Reported: amber/warning color
  - Assigned: blue/primary color
  - Completed: green/success color
- [x] 1.2 Update mat-card-subtitle to use colored badge styling
- [x] 1.3 Add CSS classes for each status: `.status-reported`, `.status-assigned`, `.status-completed`

### Task 2: Add Created Date Display (AC: #1)

- [x] 2.1 Add created date to work order card display
- [x] 2.2 Format date using Angular DatePipe (e.g., "Jan 20, 2026" or "mediumDate")
- [x] 2.3 Position date appropriately in card layout

### Task 3: Verify Sorting by Created Date (AC: #3)

- [x] 3.1 Verify backend API returns work orders sorted by createdAt DESC
- [x] 3.2 If not sorted by backend, add frontend sorting in store or component (N/A - backend sorts correctly)
- [x] 3.3 Confirm newest work orders appear first

### Task 4: Testing

- [x] 4.1 Update unit tests for WorkOrdersComponent:
  - Status badge renders with correct class for each status
  - Created date displays formatted correctly
  - Work orders sorted newest first
- [x] 4.2 Manual verification:
  - [x] Navigate to /work-orders
  - [x] Verify Reported status shows amber/yellow badge
  - [x] Verify Assigned status shows blue badge
  - [x] Verify Completed status shows green badge (code implemented, no Completed data to verify visually)
  - [x] Verify created date displays on each card
  - [x] Verify newest work orders appear at top
  - [x] Verify empty state when no work orders (existing implementation verified in unit tests)
  - [x] Verify "New Work Order" navigates to creation form

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
```
frontend/src/app/features/work-orders/
├── work-orders.component.ts           ← MODIFIED (add status badges, created date)
├── work-orders.component.spec.ts      ← MODIFIED (update tests)
```

**No backend changes required** - WorkOrderDto already includes `createdAt` and `status`.

### Current Implementation Analysis

The work-orders.component.ts currently displays:
- Property name (mat-card-title)
- Status as plain text (mat-card-subtitle)
- Description (truncated with CSS)
- Assignee (vendor name or "DIY")
- Category (if set)
- Tags (as chips)

**Gaps to address:**
1. Status needs colored badge styling instead of plain text
2. Created date not displayed
3. Sorting verification needed

### Status Badge Implementation Pattern

```typescript
// Add to template - replace plain status text with badge
<span class="status-badge" [ngClass]="'status-' + workOrder.status.toLowerCase()">
  {{ workOrder.status }}
</span>

// Add to styles
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-reported {
  background-color: var(--mat-sys-warning-container, #fef3c7);
  color: var(--mat-sys-on-warning-container, #92400e);
}

.status-assigned {
  background-color: var(--mat-sys-primary-container, #dbeafe);
  color: var(--mat-sys-on-primary-container, #1e40af);
}

.status-completed {
  background-color: var(--mat-sys-tertiary-container, #d1fae5);
  color: var(--mat-sys-on-tertiary-container, #065f46);
}
```

### Created Date Display Pattern

```typescript
// Add DatePipe to imports
import { DatePipe } from '@angular/common';

// In template - add after status badge
<span class="created-date">
  <mat-icon class="date-icon">calendar_today</mat-icon>
  {{ workOrder.createdAt | date:'mediumDate' }}
</span>

// Styles
.created-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  color: var(--mat-sys-outline);
  margin-top: 8px;
}

.date-icon {
  font-size: 16px;
  height: 16px;
  width: 16px;
}
```

### Sorting Verification

Check WorkOrderStore.loadWorkOrders() and backend API behavior:
- Backend GetWorkOrdersQuery should order by CreatedAt DESC
- If not, add sorting in the store after loading:
```typescript
// In store, after loading
const sorted = [...workOrders].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);
```

### Previous Story Intelligence

From 9-5 implementation:
- WorkOrderStore uses @ngrx/signals pattern
- WorkOrderDto includes: id, propertyId, propertyName, vendorId, vendorName, isDiy, categoryId, categoryName, status, description, createdAt, createdByUserId, tags
- Component uses CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule

### WorkOrderDto Structure Reference

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
  status: string;  // 'Reported' | 'Assigned' | 'Completed'
  description: string;
  createdAt: string;  // ISO date string
  createdByUserId: string;
  tags: WorkOrderTagDto[];
}
```

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR22 | Users can view all work orders in a dashboard view | Enhanced dashboard with status badges and dates |

### Testing Requirements

**Unit Tests (frontend):**
- Status badge renders correct CSS class per status
- Created date displays with correct format
- Work orders appear in correct order (newest first)
- Empty state renders when no work orders

**Manual Verification:**
- [x] Navigate to /work-orders with existing work orders
- [x] Verify "Reported" work orders show amber/yellow badge
- [x] Verify "Assigned" work orders show blue badge
- [x] Verify "Completed" work orders show green badge (code implemented)
- [x] Verify created date shows on each card
- [x] Verify newest work orders at top of list
- [x] Navigate to /work-orders with no work orders (tested via unit tests)
- [x] Verify empty state message and button (tested via unit tests)
- [x] Click "New Work Order" - verify navigation to /work-orders/new

### References

- [Source: epics-work-orders-vendors.md#Story 2.6] - Original story definition
- [Source: architecture.md#Phase 2] - Frontend structure patterns
- [Source: work-orders.component.ts] - Current implementation to enhance
- [Source: 9-5-inline-vendor-creation.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented status badge component with colored styling (amber/Reported, blue/Assigned, green/Completed)
- Added created date display with calendar icon using Angular DatePipe (mediumDate format)
- Verified backend API already sorts by createdAt DESC (GetAllWorkOrders.cs:69)
- Added 8 new unit tests covering status badges, created date, and sorting
- All 1151 frontend tests passing
- Manual verification completed via Playwright MCP

### File List

- `frontend/src/app/features/work-orders/work-orders.component.ts` - MODIFIED (status badges, created date display, CSS styles)
- `frontend/src/app/features/work-orders/work-orders.component.spec.ts` - MODIFIED (added 8 new tests for Story 9-6)
