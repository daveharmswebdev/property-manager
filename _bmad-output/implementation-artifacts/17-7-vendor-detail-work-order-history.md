# Story 17.7: Vendor Detail — Work Order History

Status: review

## Story

As a property owner viewing a vendor's detail page,
I want to see all work orders assigned to that vendor,
so that I can evaluate their work history and make informed hiring decisions.

**GitHub Issue:** #268
**Effort:** M

## Acceptance Criteria

**AC-1: Work order history section displays real data**
Given I am on a vendor detail page for a vendor who has been assigned to work orders
When the page loads
Then the "Work Order History" section displays a list of all work orders assigned to this vendor
And each row shows: description, property name, status, and date

**AC-2: Work order rows are clickable**
Given I see the work order history list on a vendor detail page
When I click on a work order row
Then I navigate to `/work-orders/:id` for that work order

**AC-3: Empty state when vendor has no work orders**
Given I am on a vendor detail page for a vendor with no assigned work orders
When the page loads
Then I see the empty state: assignment icon + "No work orders yet for this vendor"

**AC-4: Loading state while fetching work orders**
Given I am on a vendor detail page
When work orders are being fetched
Then the work order history section shows a loading spinner

**AC-5: Status displayed with appropriate styling**
Given the work order history list is rendered
When I view the status of each work order
Then statuses are displayed as styled badges (matching the work order list page pattern)

**AC-6: Total count displayed in section header**
Given the vendor has work orders
When the section renders
Then the section title shows "Work Order History (N)" where N is the total count

## Tasks / Subtasks

### Backend: Create GetWorkOrdersByVendor Query

- [x] Task 1: Create `GetWorkOrdersByVendor.cs` in `Application/WorkOrders/` (AC: 1)
  - [x] 1.1: Define `GetWorkOrdersByVendorQuery(Guid VendorId, int? Limit = null) : IRequest<GetWorkOrdersByVendorResult>`
  - [x] 1.2: Define `GetWorkOrdersByVendorResult(IReadOnlyList<WorkOrderDto> Items, int TotalCount)`
  - [x] 1.3: Implement `GetWorkOrdersByVendorQueryHandler` — mirror `GetWorkOrdersByPropertyQueryHandler` but filter on `VendorId` instead of `PropertyId`
  - [x] 1.4: Include same joins: Property, Vendor, Category, TagAssignments→Tag, Photos
  - [x] 1.5: Include primary photo thumbnail URL generation via `IPhotoService`
  - [x] 1.6: Order by `CreatedAt` descending

- [x] Task 2: Add controller endpoint in `WorkOrdersController.cs` (AC: 1)
  - [x] 2.1: Add `GET /api/v1/vendors/{vendorId:guid}/work-orders?limit=N` endpoint
  - [x] 2.2: Add `[ProducesResponseType]` attributes for 200 and 401
  - [x] 2.3: Add structured logging: `"Retrieved {Count} work orders (total: {Total}) for vendor {VendorId}"`

- [x] Task 3: Backend unit tests (AC: 1)
  - [x] 3.1: `GetWorkOrdersByVendorQueryHandlerTests.cs` — test handler returns work orders filtered by VendorId
  - [x] 3.2: Test tenant isolation (AccountId filter)
  - [x] 3.3: Test soft delete filtering (DeletedAt == null)
  - [x] 3.4: Test limit parameter caps results
  - [x] 3.5: Test empty result when vendor has no work orders

### Frontend: Service + Store + Component

- [x] Task 4: Add service method to `work-order.service.ts` (AC: 1)
  - [x] 4.1: Add `getWorkOrdersByVendor(vendorId: string, limit?: number): Observable<GetWorkOrdersByVendorResponse>` — calls `GET /api/v1/vendors/${vendorId}/work-orders`
  - [x] 4.2: Add `GetWorkOrdersByVendorResponse` interface (same shape as `GetWorkOrdersByPropertyResponse`)

- [x] Task 5: Add work order state to `vendor.store.ts` (AC: 1, 4)
  - [x] 5.1: Add state: `vendorWorkOrders: WorkOrderDto[]`, `vendorWorkOrderCount: number`, `isLoadingWorkOrders: boolean`
  - [x] 5.2: Add `loadVendorWorkOrders` rxMethod that calls `workOrderService.getWorkOrdersByVendor(vendorId)`
  - [x] 5.3: Use `switchMap`, `patchState` pattern matching existing store methods
  - [x] 5.4: Inject `WorkOrderService` via `inject()` inside `withMethods()`

- [x] Task 6: Update `vendor-detail.component.ts` template and logic (AC: 1, 2, 3, 4, 5, 6)
  - [x] 6.1: Replace placeholder section with real work order list
  - [x] 6.2: Add loading spinner when `store.isLoadingWorkOrders()`
  - [x] 6.3: Show count in header: `Work Order History ({{ store.vendorWorkOrderCount() }})`
  - [x] 6.4: `@for` loop over `store.vendorWorkOrders()` — each row shows description, property name, status badge, date
  - [x] 6.5: Rows clickable → `router.navigate(['/work-orders', wo.id])`
  - [x] 6.6: Status badges with color coding (Reported=blue, Assigned=orange, Completed=green) — match existing patterns
  - [x] 6.7: Keep empty state as fallback when list is empty AND not loading
  - [x] 6.8: Call `store.loadVendorWorkOrders(vendorId)` in `ngOnInit` after `store.loadVendor(vendorId)`

- [x] Task 7: Frontend unit tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 7.1: Update `vendor-detail.component.spec.ts` — replace placeholder tests (6.5) with real work order tests
  - [x] 7.2: Test loading state shows spinner
  - [x] 7.3: Test work order list renders rows with description, property, status, date
  - [x] 7.4: Test row click navigates to `/work-orders/:id`
  - [x] 7.5: Test empty state shows when no work orders
  - [x] 7.6: Test count displays in section header
  - [x] 7.7: Add `vendor.store.spec.ts` tests for `loadVendorWorkOrders` method

- [x] Task 8: Generate API client (AC: 1)
  - [x] 8.1: Run `npm run generate-api` after backend endpoint is live

## Dev Notes

### Architecture Pattern — Direct Clone of GetWorkOrdersByProperty

This story follows an **exact established pattern**. The backend query `GetWorkOrdersByProperty.cs` (102 lines) is the template — clone it and swap `PropertyId` for `VendorId`.

**Backend source to clone:**
- `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrdersByProperty.cs` — Query record, Result record, Handler class
- `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs:292-310` — Controller endpoint pattern

**Key implementation detail:** The handler filters `.Where(w => w.VendorId == request.VendorId)` instead of `.Where(w => w.PropertyId == request.PropertyId)`. Everything else (includes, photo thumbnails, ordering, DTO mapping) is identical.

### Controller Endpoint Placement

Add the new endpoint to `WorkOrdersController.cs` — NOT to `VendorsController.cs`. This follows the existing pattern where `GetWorkOrdersByProperty` lives on WorkOrdersController with route `/api/v1/properties/{propertyId}/work-orders`. The new route is `/api/v1/vendors/{vendorId:guid}/work-orders`.

### Frontend Service Pattern

Clone `getWorkOrdersByProperty` in `work-order.service.ts:228-237`:
```typescript
getWorkOrdersByVendor(vendorId: string, limit?: number): Observable<GetWorkOrdersByVendorResponse> {
  const params: Record<string, string> = {};
  if (limit !== undefined) {
    params['limit'] = limit.toString();
  }
  return this.http.get<GetWorkOrdersByVendorResponse>(
    `/api/v1/vendors/${vendorId}/work-orders`,
    { params }
  );
}
```

### Vendor Store — Adding Work Order State

The `vendor.store.ts` currently has no work order state. Add alongside existing state:
- New state fields: `vendorWorkOrders: [] as WorkOrderDto[]`, `vendorWorkOrderCount: 0`, `isLoadingWorkOrders: false`
- New `rxMethod<string>` named `loadVendorWorkOrders` — inject `WorkOrderService` in `withMethods()`
- Pattern matches `loadVendor` rxMethod already in the store
- Import `WorkOrderService` from `../../work-orders/services/work-order.service`

### Component Template — Work Order Row Design

Replace the placeholder (lines 166-177 of `vendor-detail.component.ts`) with:
- Loading spinner (reuse `.loading-container` pattern)
- `@for (wo of store.vendorWorkOrders(); track wo.id)` — each row as a clickable div
- Row content: `wo.description`, `wo.propertyName`, status badge, formatted date
- Status badge colors: match work order list page patterns (Reported=info, Assigned=warning, Completed=success)
- Row click: `(click)="navigateToWorkOrder(wo.id)"` → `router.navigate(['/work-orders', wo.id])`
- Cursor pointer + hover effect on rows

### Existing Test Structure

Current `vendor-detail.component.spec.ts` (396 lines) has:
- `mockVendorStore` with signals — needs: `vendorWorkOrders`, `vendorWorkOrderCount`, `isLoadingWorkOrders`, `loadVendorWorkOrders`
- Lines 244-266: Three placeholder tests under `'work order history placeholder (AC #5 - 6.5)'` — these get **replaced** with real implementation tests
- `setupWithVendor()` helper already triggers `ngOnInit` + sets vendor data

### WorkOrderDto Already Has Everything Needed

`WorkOrderDto` (from `WorkOrderDto.cs` and generated API client) includes:
- `id`, `propertyName`, `vendorName`, `status`, `description`, `createdAt`, `categoryName`, `tags[]`, `primaryPhotoThumbnailUrl`
- No new DTOs needed — reuse existing `WorkOrderDto`

### Project Structure Notes

- Backend follows single-file CQRS: Query record + Handler class + DTOs co-located in one `.cs` file
- Controller endpoint at class level `[Route("api/v1")]`, custom route on action: `[HttpGet("/api/v1/vendors/{vendorId:guid}/work-orders")]`
- Frontend store uses `signalStore()` with `withState()`, `withComputed()`, `withMethods()` — all `{ providedIn: 'root' }`
- Cross-feature import: `WorkOrderService` imported from `features/work-orders/services/` into vendor store

### References

- [Source: `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrdersByProperty.cs` — Clone template for backend query]
- [Source: `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs:292-310` — Controller endpoint pattern]
- [Source: `frontend/src/app/features/work-orders/services/work-order.service.ts:228-237` — Service method pattern]
- [Source: `frontend/src/app/features/vendors/stores/vendor.store.ts` — Store to extend with work order state]
- [Source: `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.ts:166-177` — Placeholder to replace]
- [Source: `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.spec.ts:244-266` — Tests to update]
- [Source: GitHub Issue #268 — Vendor detail API does not return work order history]
- [Source: project-context.md — Clean Architecture patterns, CQRS, testing rules]

## Testing Requirements

### Unit Tests

**Backend:**
- `GetWorkOrdersByVendorQueryHandlerTests.cs` — handler returns work orders filtered by VendorId
- Tenant isolation (AccountId filter applied)
- Soft delete filtering (DeletedAt == null)
- Limit parameter caps results
- Empty result when vendor has no work orders

**Frontend:**
- `vendor.store.spec.ts` — `loadVendorWorkOrders` sets state correctly, handles errors
- `vendor-detail.component.spec.ts` — replace placeholder tests:
  - Loading state shows spinner in work order section
  - Work order list renders with correct data
  - Row click navigates to work order detail
  - Empty state when no work orders
  - Count displays in section header

### Manual Verification
- Navigate to vendor with assigned work orders → see list
- Navigate to vendor with no work orders → see empty state
- Click work order row → navigates to `/work-orders/:id`
- Verify loading spinner appears briefly

### E2E Tests
No new E2E tests required — this is a data display feature. Existing E2E tests should continue passing.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Backend: 969/969 tests pass (6 new for GetWorkOrdersByVendorHandler)
- Frontend: 2585/2585 tests pass (8 new for vendor-detail component, 5 new for vendor store)

### Completion Notes List

- Cloned `GetWorkOrdersByProperty.cs` → `GetWorkOrdersByVendor.cs`, swapped `PropertyId` filter for `VendorId`
- Added `GET /api/v1/vendors/{vendorId:guid}/work-orders` endpoint to `WorkOrdersController.cs`
- 6 backend unit tests: filter by vendor, tenant isolation, soft delete, limit, empty result, ordering
- Added `getWorkOrdersByVendor` method + `GetWorkOrdersByVendorResponse` interface to `work-order.service.ts`
- Extended `vendor.store.ts` with `vendorWorkOrders`, `vendorWorkOrderCount`, `isLoadingWorkOrders` state + `loadVendorWorkOrders` rxMethod
- Replaced placeholder work order section in `vendor-detail.component.ts` with real list: loading spinner, clickable rows with description/property/status badge/date, empty state, count in header
- Status badge colors: Reported=blue, Assigned=orange, Completed=green
- Replaced 3 placeholder tests with 8 real tests in `vendor-detail.component.spec.ts`
- Added 5 store tests for `loadVendorWorkOrders` in `vendor.store.spec.ts`
- Regenerated NSwag API client

### File List

- `backend/src/PropertyManager.Application/WorkOrders/GetWorkOrdersByVendor.cs` (NEW)
- `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs` (MODIFIED)
- `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetWorkOrdersByVendorHandlerTests.cs` (NEW)
- `frontend/src/app/features/work-orders/services/work-order.service.ts` (MODIFIED)
- `frontend/src/app/features/vendors/stores/vendor.store.ts` (MODIFIED)
- `frontend/src/app/features/vendors/stores/vendor.store.spec.ts` (MODIFIED)
- `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.ts` (MODIFIED)
- `frontend/src/app/features/vendors/components/vendor-detail/vendor-detail.component.spec.ts` (MODIFIED)
- `frontend/src/app/core/api/api.service.ts` (REGENERATED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)
- `_bmad-output/implementation-artifacts/17-7-vendor-detail-work-order-history.md` (MODIFIED)

## Change Log

- 2026-03-02: Implemented vendor detail work order history — backend query, controller endpoint, frontend service/store/component, tests (Story 17.7)
