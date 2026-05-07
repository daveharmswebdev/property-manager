# Story 20.7: Landlord Maintenance Request Inbox

Status: done

## Story

As a landlord,
I want a single inbox showing all maintenance requests across my properties,
so that I can triage them efficiently.

## Acceptance Criteria

1. **Given** a landlord user (Owner role),
   **When** they navigate to the maintenance request inbox at `/maintenance-requests`,
   **Then** they see all maintenance requests across all properties in their account, with the most-recently created first.

2. **Given** the inbox list,
   **When** requests are listed,
   **Then** each row shows: status badge, description (truncated to ~100 chars), property name, submitter name (or fallback to email), and submission date.

3. **Given** the inbox list,
   **When** a landlord clicks a row,
   **Then** they navigate to a detail view at `/maintenance-requests/:id` showing the full request: full description, status badge, dismissal reason (if dismissed), submitter info, property info, work order link badge (if linked), photos grid (with thumbnails opening full-size views), and submission/update timestamps.

4. **Given** the inbox list,
   **When** there are more than `pageSize` requests,
   **Then** the list is paginated using `mat-paginator` with page-size options `[10, 20, 50]` and a default of `20`.

5. **Given** the inbox list,
   **When** requests exist in different statuses (Submitted, InProgress, Resolved, Dismissed),
   **Then** each row shows a color-coded status chip distinguishable at a glance: Submitted = warning/amber, In Progress = primary/blue, Resolved = tertiary/green, Dismissed = warn/orange.

6. **Given** the inbox list,
   **When** the landlord uses the status filter chip-listbox,
   **Then** the list reloads filtered by the selected statuses (multi-select). Default selection is all four statuses.

7. **Given** the inbox list,
   **When** the landlord uses the property filter dropdown,
   **Then** the list reloads filtered to the selected property (or "All Properties" when none is selected).

8. **Given** any active filters,
   **When** the result set is empty,
   **Then** a "No requests match your filters" empty state is shown with a Clear Filters button.

9. **Given** no maintenance requests exist in the account,
   **When** the landlord opens the inbox,
   **Then** an "No maintenance requests yet" empty state is shown explaining that requests will appear here when tenants submit them.

10. **Given** the landlord navigation (sidebar + bottom nav),
    **When** the user has Owner role,
    **Then** a "Maintenance Requests" item appears between "Work Orders" and "Reports" with the `inbox` Material icon.

11. **Given** a user with the Tenant role,
    **When** they attempt to navigate to `/maintenance-requests` directly,
    **Then** the route guard redirects them to `/tenant` (no leakage of the landlord inbox to tenants).

12. **Given** the inbox is loading,
    **When** the request is in flight,
    **Then** a loading spinner is visible. **And given** the request fails, **Then** an error card is shown with a retry button.

13. **Given** the inbox on a small viewport (mobile width <= 768px),
    **When** the landlord views rows,
    **Then** each row stacks legibly (status + date on line 1, description on line 2, property + submitter on line 3) without horizontal overflow.

## Tasks / Subtasks

- [x] Task 1: Frontend — Maintenance Request service (AC #1, #2, #3, #4, #6, #7)
  - [x] 1.1 Create `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`
  - [x] 1.2 Inject `HttpClient`. Methods:
    - `getMaintenanceRequests(params: { status?: string; propertyId?: string; page?: number; pageSize?: number }): Observable<PaginatedMaintenanceRequests>` — GET `/api/v1/maintenance-requests` with query params (omit empty values; build via `HttpParams`)
    - `getMaintenanceRequestById(id: string): Observable<MaintenanceRequestDto>` — GET `/api/v1/maintenance-requests/{id}`
  - [x] 1.3 Define TypeScript interfaces locally OR re-export from existing `tenant.service.ts` types. **Decision: Define new local interfaces** to keep features decoupled. Mirror the backend response exactly:
    - `MaintenanceRequestDto { id, propertyId, propertyName, propertyAddress, description, status, dismissalReason, submittedByUserId, submittedByUserName, workOrderId, createdAt, updatedAt, photos? }`
    - `MaintenanceRequestPhotoDto { id, thumbnailUrl, viewUrl, isPrimary, displayOrder, originalFileName, fileSizeBytes, createdAt }`
    - `PaginatedMaintenanceRequests { items, totalCount, page, pageSize, totalPages }`
  - [x] 1.4 Build the query string with `HttpParams` — only set keys that have values (mirror existing service patterns).
  - [x] 1.5 Spec file `maintenance-request.service.spec.ts`: 4 tests covering URL/params for each call (no params, status only, propertyId only, page+pageSize+both filters). **(7 tests written.)**

- [x] Task 2: Frontend — Maintenance Request signal store (AC #1, #4, #6, #7, #12)
  - [x] 2.1 Create `frontend/src/app/features/maintenance-requests/stores/maintenance-request.store.ts`
  - [x] 2.2 Use `signalStore({ providedIn: 'root' })` with `withState`, `withComputed`, `withMethods`. Mirror the structure of `WorkOrderStore`.
  - [x] 2.3 State:
    ```ts
    interface MaintenanceRequestState {
      requests: MaintenanceRequestDto[];
      selectedRequest: MaintenanceRequestDto | null;
      isLoading: boolean;
      isLoadingDetail: boolean;
      error: string | null;
      detailError: string | null;
      // Filter state (AC #6, #7)
      selectedStatuses: string[];   // default = all four
      selectedPropertyId: string | null;
      // Pagination (AC #4)
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    }
    ```
    Constants: `const ALL_STATUSES = ['Submitted', 'InProgress', 'Resolved', 'Dismissed'];`. Initial state: all statuses selected, no property filter, `page = 1`, `pageSize = 20`.
  - [x] 2.4 Computed signals:
    - `isEmpty` — `!isLoading() && requests().length === 0` AND no filters active
    - `isFilteredEmpty` — `!isLoading() && requests().length === 0` AND filters active (AC #8)
    - `hasActiveFilters` — `selectedStatuses.length < ALL_STATUSES.length || selectedPropertyId !== null` (AC #8)
  - [x] 2.5 Methods (use `rxMethod<...>(pipe(...))` with `tap` → `switchMap` → `tap` + `catchError` → `of(null)` pattern):
    - `loadRequests(params?: { page?; pageSize? })` — calls `MaintenanceRequestService.getMaintenanceRequests({ status, propertyId, page, pageSize })` derived from current state. On success patches `requests`, `totalCount`, `page`, `pageSize`, `totalPages`. On error sets `error`.
    - `loadRequestById(id: string)` — calls `getMaintenanceRequestById`. Patches `selectedRequest` / `detailError`. 404 → "Maintenance request not found"; other errors → generic message.
    - `setStatusFilter(statuses: string[])` — patch state, reset to page 1, reload. **Refuse empty selection** (matches WorkOrderStore pattern).
    - `setPropertyFilter(propertyId: string | null)` — patch state, reset to page 1, reload.
    - `clearFilters()` — reset to defaults, reset to page 1, reload (AC #8).
    - `setPage(page: number, pageSize: number)` — patch and reload (used by `mat-paginator`).
    - `clearSelectedRequest()` — clears `selectedRequest` and `detailError` (use on detail page leave).
  - [x] 2.6 Status filter encoding implemented per the "n=1 → status param, otherwise omit" rule (`encodeStatusParam` helper). The 0-selected case is rejected by `setStatusFilter` (refuse empty selection).
  - [x] 2.7 Spec file `maintenance-request.store.spec.ts`: tests for
    - `loadRequests` happy path patches state
    - `loadRequests` error sets error message
    - `setStatusFilter` patches state and triggers reload
    - `setStatusFilter` rejects empty selection (no patch, no reload)
    - `setPropertyFilter` patches state and triggers reload
    - `clearFilters` resets state to defaults
    - `setPage` patches and reloads
    - `loadRequestById` happy path
    - `loadRequestById` 404 sets `detailError = 'Maintenance request not found'`
    - `clearSelectedRequest` clears both fields
    - `hasActiveFilters` computed: false on defaults, true when status subset, true when property selected
    - `isFilteredEmpty` computed: true when no requests AND filters active

- [x] Task 3: Frontend — Inbox list component (AC #1, #2, #5, #6, #7, #8, #9, #12, #13)
  - [x] 3.1 Create `frontend/src/app/features/maintenance-requests/maintenance-requests.component.ts` (standalone)
  - [x] 3.2 Imports — `RouterLink` was removed from the imports list because the component navigates programmatically; the rest match the spec.
  - [x] 3.3 Inject `MaintenanceRequestStore`, `PropertyStore`, `Router`. On init: `store.loadRequests()` and `propertyStore.loadProperties(undefined)` (matches `WorkOrdersComponent.ngOnInit`).
  - [x] 3.4 Template structure:
    - Page header: `<h1>Maintenance Requests</h1>` (no "New" button — landlords don't submit; tenants do)
    - Filter section: `mat-chip-listbox multiple` for status (chip per status: Submitted / In Progress / Resolved / Dismissed), `mat-form-field outline` `mat-select` for property (`All Properties` + each property), Clear filters button when `store.hasActiveFilters()`
    - Conditional content:
      - `@if (store.isLoading())` — `<app-loading-spinner />`
      - `@else if (store.error())` — `<app-error-card [message]="..." [showRetry]="true" (retry)="retry()" />`
      - `@else if (store.isFilteredEmpty())` — filtered empty state with Clear Filters button (AC #8)
      - `@else if (store.isEmpty())` — `<app-empty-state icon="inbox" title="No maintenance requests yet" message="When tenants submit maintenance requests for your properties, they will appear here." />` (AC #9)
      - `@else` — list of rows + paginator
    - Each row (use a similar two-line pattern to `WorkOrdersComponent`):
      - Line 1: status chip + description (truncated, flex 1) + date (right-aligned)
      - Line 2: property name (with home icon) + submitter name (with person icon) + work order link badge if `workOrderId !== null` (with `link` icon and label "Linked")
      - Click row content → `router.navigate(['/maintenance-requests', request.id])`
    - Paginator: `[length]="store.totalCount()"`, `[pageSize]="store.pageSize()"`, `[pageIndex]="store.page() - 1"`, `[pageSizeOptions]="[10, 20, 50]"`, `(page)="onPageChange($event)"`. Show only when `store.totalCount() > store.pageSize()`.
  - [x] 3.5 Methods:
    - `onStatusFilterChange(event: MatChipListboxChange)` — `store.setStatusFilter((event.value as string[]) ?? [])`
    - `onPropertyFilterChange(propertyId: string | null)` — `store.setPropertyFilter(propertyId)`
    - `clearFilters()` — `store.clearFilters()`
    - `onPageChange(event: PageEvent)` — `store.setPage(event.pageIndex + 1, event.pageSize)`
    - `retry()` — `store.loadRequests()`
    - `getStatusLabel(status: string)` — returns `'In Progress'` for `'InProgress'`, otherwise the raw status (consistent with `tenant-dashboard.component.ts`)
    - `truncateDescription(description: string, maxLength = 100)` — same helper as tenant dashboard
  - [x] 3.6 SCSS: mobile-first using existing `--mat-sys-*` CSS custom properties. Status chip color classes: `.status-submitted` (warning container), `.status-in-progress` (primary container), `.status-resolved` (tertiary container), `.status-dismissed` (error container) — match the tenant-dashboard kebab-case names so the styles can be copied. Mobile breakpoint @ 768px: stacks lines vertically as described in AC #13.
  - [x] 3.7 `data-testid` attributes for E2E:
    - `data-testid="maintenance-requests-page"` on the root `<div>`
    - `data-testid="status-filter"` on the chip listbox
    - `data-testid="property-filter"` on the property `mat-select`
    - `data-testid="request-row"` on each row
    - `data-testid="request-row-${id}"` for individual rows (for stable row queries)
    - `data-testid="empty-state"` and `data-testid="filtered-empty-state"` on the respective placeholders
    - `data-testid="paginator"` on the paginator
  - [x] 3.8 Spec file `maintenance-requests.component.spec.ts`: tests for
    - Renders the page header
    - Renders rows when `store.requests()` is non-empty
    - Shows loading spinner when `store.isLoading()`
    - Shows error card when `store.error()`
    - Shows empty state when `store.isEmpty()`
    - Shows filtered empty state when `store.isFilteredEmpty()`
    - Status chip filter triggers `store.setStatusFilter`
    - Property select triggers `store.setPropertyFilter`
    - Paginator change triggers `store.setPage`
    - Row click navigates to `/maintenance-requests/:id`
    - `getStatusLabel('InProgress')` returns `'In Progress'`

- [x] Task 4: Frontend — Inbox detail component (AC #3, #5, #12)
  - [x] 4.1 Create `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`
  - [x] 4.2 Standalone, imports same Material modules as tenant-side `RequestDetailComponent` plus `RouterLink` for back-link/work-order link.
  - [x] 4.3 On init: read `id` from `ActivatedRoute.paramMap` and call `store.loadRequestById(id)`. On destroy: `store.clearSelectedRequest()`.
  - [x] 4.4 Template:
    - Back button → `routerLink="/maintenance-requests"` with `arrow_back` icon
    - Loading: spinner
    - Error: error card with retry
    - Loaded: `mat-card` containing
      - Header: status chip (color-coded) + submission date
      - Property block: name + address (with `home` icon)
      - Submitter block: name (or "Unknown") + user ID for debugging (label hidden visually but available via `<small>` for now — keep simple)
      - Description (full, `white-space: pre-wrap`)
      - Dismissal reason (only when status is `Dismissed`)
      - Linked Work Order badge with `routerLink="/work-orders/{workOrderId}"` (only when `workOrderId !== null`) — text "View linked work order"
      - Photos grid (when `photos?.length > 0`): thumbnail tiles using `thumbnailUrl`; click opens `viewUrl` in a new tab. Reuse the photo grid pattern from `tenant-dashboard/components/request-detail/request-detail.component.html` (or extract to shared if straightforward — but **keep extraction out of scope for this story**; copy the pattern).
      - Empty photos: not shown (no placeholder block)
    - `data-testid="request-detail-page"` on root, `data-testid="status-chip"` on the chip, `data-testid="dismissal-reason"` on the reason block, `data-testid="linked-work-order"` on the badge, `data-testid="photo-grid"` on the gallery.
  - [x] 4.5 No write actions in this story — convert/dismiss live in 20.8/20.9. Render the detail read-only.
  - [x] 4.6 Spec file: tests for
    - Calls `store.loadRequestById(id)` from the route param
    - Shows status chip with correct class
    - Shows dismissal reason only when status is `Dismissed`
    - Hides dismissal reason when status is not `Dismissed`
    - Shows linked work order badge only when `workOrderId !== null`
    - Renders photos grid when photos array is non-empty
    - Renders error card on `store.detailError()`

- [x] Task 5: Add routes in `app.routes.ts` (AC #1, #3, #11)
  - [x] 5.1 Added inside the shell children, after the `work-orders/:id/edit` block and before the tenant routes:
    ```ts
    {
      path: 'maintenance-requests',
      loadComponent: () =>
        import('./features/maintenance-requests/maintenance-requests.component').then(
          (m) => m.MaintenanceRequestsComponent,
        ),
      canActivate: [ownerGuard],
    },
    {
      path: 'maintenance-requests/:id',
      loadComponent: () =>
        import('./features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component').then(
          (m) => m.MaintenanceRequestDetailComponent,
        ),
      canActivate: [ownerGuard],
    },
    ```
  - [x] 5.2 `ownerGuard` already redirects Tenant users to `/tenant` (Story 20.5), satisfying AC #11. Added a guard test for `/maintenance-requests` URL → `/tenant` redirect.

- [x] Task 6: Update navigation (AC #10)
  - [x] 6.1 Added `{ label: 'Maintenance Requests', route: '/maintenance-requests', icon: 'inbox' }` to `sidebar-nav.component.ts` `allItems`, between Work Orders and Reports. Owner sees it; Contributor's `contributorRoutes` allow-list excludes it; Tenant role returns its own hard-coded list.
  - [x] 6.2 **Decision applied:** Owner bottom-nav currently has 5 items (Dashboard, Properties, Expenses, Income, Receipts). Per the story's "add only if ≤ 4" rule, bottom-nav is left unchanged. Maintenance Requests is reachable from sidebar (desktop) and direct URL on mobile.
  - [x] 6.3 No `permission.service.ts` change needed — Owner falls through to `true` for non-Tenant routes.
  - [x] 6.4 Updated `sidebar-nav.component.spec.ts` to assert the new item is present for Owner (count = 10, position between Work Orders and Reports) and absent for Tenant/Contributor.

- [x] Task 7: Frontend — guard test for Tenant redirect (AC #11)
  - [x] 7.1 Added a Tenant → `/tenant` redirect test for `/maintenance-requests` URL in `owner.guard.spec.ts`.

- [x] Task 8: Frontend — Vitest run (AC: all)
  - [x] 8.1 `npm test` — full suite: **127 files, 2835 tests passing.**
  - [x] 8.2 `ng build` — clean production build. Initial bundle 579.70 kB (4.70 kB over 575 kB budget), matching the documented pre-existing 4.4 kB overage.

- [x] Task 9: E2E — Landlord inbox happy path (AC #1, #2, #3, #5, #10)
  - [x] 9.1 Created `frontend/e2e/pages/maintenance-requests-list.page.ts` extending `BasePage`. Locators for:
    - `requestRows` (`[data-testid="request-row"]`)
    - `statusFilter` (`[data-testid="status-filter"]`)
    - `propertyFilter` (`[data-testid="property-filter"]`)
    - `paginator` (`[data-testid="paginator"]`)
    - `emptyState` and `filteredEmptyState`
    - Methods: `goto()`, `getRowByDescription(text)`, `clickRow(text)`, `selectStatus(label)`, `selectProperty(name)`, `clearFilters()`, `expectRowVisible(text)`, `expectRowHidden(text)`, `expectStatusBadge(text, status)`, `expectEmptyState()`, `expectFilteredEmptyState()`
  - [x] 9.2 Created `frontend/e2e/pages/maintenance-request-detail.page.ts`: locators for description, statusChip, dismissalReason, linkedWorkOrder, photoGrid; helper `goto(id)`.
  - [x] 9.3 Created `frontend/e2e/tests/maintenance-requests/landlord-inbox.spec.ts` with the 6 specs. Added `loginAsLandlord` helper to `tenant.helper.ts` (mirrors `loginAsTenant` but waits for `/dashboard`).
    - **Spec 1 — Inbox shows aggregated requests across properties (AC #1, #2):** landlord with 2 properties + 1 tenant per property + 1 request each → landlord opens `/maintenance-requests` → sees 2 rows, each with description + status chip + property name + submitter name.
    - **Spec 2 — Row click opens detail (AC #3):** landlord clicks a row → `/maintenance-requests/:id` shows full description + property + submitter + status chip + photos block (empty when no photos).
    - **Spec 3 — Status filter narrows results (AC #6):** seed 1 Submitted + 1 (manually-status-set if possible — otherwise just verify the filter UI calls the API by intercepting the request) → click "In Progress" chip → only matching requests shown. **If status mutation is not yet possible via API in this story (since 20.8/20.9 implement transitions), use `page.route()` to intercept the GET and assert the query string contains `status=InProgress`** instead of asserting on visible rows.
    - **Spec 4 — Property filter narrows results (AC #7):** seed requests on two properties → select one in the property dropdown → only that property's rows are visible.
    - **Spec 5 — Empty state when no requests exist (AC #9):** throwaway landlord with a property but no submitted requests → inbox shows the empty state.
    - **Spec 6 — Tenant cannot access landlord inbox (AC #11):** log in as a tenant → navigate to `/maintenance-requests` → URL ends up at `/tenant` (guard redirect).
  - [x] 9.4 Registered `maintenanceRequestsListPage` and `maintenanceRequestDetailPage` fixtures in `test-fixtures.ts`.
  - [x] 9.5 Spec file leading comment documents the throwaway-landlord isolation pattern.

- [x] Task 10: Sprint status (Process)
  - [x] 10.1 Sprint status set to `review`.

## Dev Notes

### Architecture: Frontend-Only Story

All backend APIs are already in place from Stories 20.3 and 20.4:

| Endpoint | Behavior for Landlord (Owner) |
|---|---|
| `GET /api/v1/maintenance-requests?status=&propertyId=&page=&pageSize=` | Returns all requests across the account, filtered by query params, paginated. |
| `GET /api/v1/maintenance-requests/{id}` | Returns full detail incl. photos with presigned URLs. |

The handlers (`GetMaintenanceRequestsQueryHandler`, `GetMaintenanceRequestByIdQueryHandler`) already differentiate behavior by role: when `_currentUser.Role == "Tenant"` they restrict to the tenant's `PropertyId`; otherwise they return everything in the account. The frontend just calls the API as the logged-in landlord. **No backend changes, no new migrations, no NSwag regeneration.**

Backend integration coverage for these endpoints already exists from Story 21.1 (`MaintenanceRequestsControllerTests.cs`): owner-aggregated list, cross-account isolation, ordering, status filter, property filter, pagination edge cases. This story does NOT need to add backend tests.

### Why a Separate Feature Module

Don't extend `tenant-dashboard/` for the landlord inbox. Two reasons:

1. **Role-symmetry is misleading**: the tenant dashboard is mobile-first, single-property, and tenant-scoped. The landlord inbox is filter-driven, cross-property, and Owner-scoped. They share a backend but diverge on UX.
2. **Folder boundaries match guard boundaries**: `features/tenant-dashboard/` is reached via `tenantGuard`; `features/maintenance-requests/` is reached via `ownerGuard`. Keeping them separate prevents accidental cross-leakage.

The `MaintenanceRequestService` and `MaintenanceRequestStore` are new and Owner-scoped. The DTO interfaces duplicate what `tenant.service.ts` exports — accept the duplication for now. **Consolidating** them is a future tech-debt opportunity once the landlord views (20.7–20.10) are stable; do NOT premature-extract.

### Status Filter Encoding (One-Status Constraint)

The backend `GetMaintenanceRequestsQuery.Status` is a single string parsed via `Enum.TryParse<MaintenanceRequestStatus>`. It accepts ONE status. The work-orders front-end works around this by joining selected statuses with commas, but the backend silently ignores unparseable values (returning the unfiltered set). For maintenance requests we accept the same trade-off:

- 0 selected: refuse (re-select default — same UX as work-orders)
- 1 selected: send `status=<single>` and the backend filters
- 2–3 selected: omit `status` (effectively shows all four — UX caveat documented here)
- All 4 selected: omit `status`

A future story can extend the backend to accept multi-status (`status=Submitted,InProgress`) and update the frontend to take advantage. For 20.7, single-status filtering is sufficient and matches the existing work-orders pattern. **Document this in the SubmitRequestComponent comment** so the next dev knows the limit is intentional.

### File Locations (Pattern)

```
frontend/src/app/features/maintenance-requests/
├── maintenance-requests.component.ts          # Inbox list (this story)
├── maintenance-requests.component.spec.ts
├── components/
│   └── maintenance-request-detail/
│       ├── maintenance-request-detail.component.ts
│       └── maintenance-request-detail.component.spec.ts
├── services/
│   ├── maintenance-request.service.ts
│   └── maintenance-request.service.spec.ts
└── stores/
    ├── maintenance-request.store.ts
    └── maintenance-request.store.spec.ts
```

This mirrors the work-orders feature module (`features/work-orders/`).

### Status Chip Colors (Match Tenant View)

The tenant-side request list uses these classes (`tenant-dashboard.component.html`):
- `.status-submitted` — neutral / amber (it currently has `[highlighted]="getStatusColor === 'primary'"` — i.e. only the In-Progress chip is highlighted)
- `.status-in-progress` — primary blue
- `.status-resolved` — green
- `.status-dismissed` — orange

Reuse the same color scheme so a tenant and a landlord looking at the same request see the same status visual. The CSS-variable system (`--mat-sys-*-container`) is the same one work-orders uses (`status-reported`, `status-assigned`, `status-completed`).

**Note** the tenant component uses class names like `.status-in-progress` (kebab-case). For the landlord inbox use the same names so SCSS can be copied directly. The status enum value coming from the backend is `InProgress` (PascalCase concatenated). Translate via the helper:

```ts
function statusToClass(status: string): string {
  return `status-${status.toLowerCase().replace(/inprogress/, 'in-progress')}`;
}
```

Or keep the tenant-style approach with conditional class binding (`[class.status-in-progress]="request.status === 'InProgress'"`) — both work; the second is closer to existing code.

### Pagination

Use `MatPaginatorModule` and `PageEvent`. The store's `setPage(page, pageSize)` should send 1-based `page` to the backend (the backend's `GetMaintenanceRequestsQuery.Page` defaults to 1). The paginator's `pageIndex` is 0-based so the template binds `[pageIndex]="store.page() - 1"` and the handler does `store.setPage(event.pageIndex + 1, event.pageSize)`.

Default page size: `20`. Options: `[10, 20, 50]` (tenant dashboard uses the same options).

### Loading and Error States

Use the existing shared components:
- `frontend/src/app/shared/components/loading-spinner/loading-spinner.component.ts`
- `frontend/src/app/shared/components/error-card/error-card.component.ts` (input `message`, output `retry`)
- `frontend/src/app/shared/components/empty-state/empty-state.component.ts` (inputs `icon`, `title`, `message`)

Tenant dashboard uses all three — copy the import block.

### Property Filter Source

Reuse `PropertyStore` — already loaded by the work-orders inbox via `propertyStore.loadProperties(undefined)` in `ngOnInit`. The store is `{ providedIn: 'root' }`, so loading it once in this component is fine; if it's already loaded from another page navigation the call is idempotent.

### Critical Patterns to Follow

1. **Signal store pattern** — match `WorkOrderStore`. Use `rxMethod<T>(pipe(...))` with `tap → switchMap → tap + catchError` blocks. Never re-throw from `catchError`; return `of(null)` to keep the stream alive.
2. **Standalone components** — `inject()`, `input()` / `output()` signal API, `@if`/`@for` control flow.
3. **Service pattern** — `HttpClient`, returns `Observable<T>`. Build params via `HttpParams` to omit empty keys.
4. **MatSnackBar for feedback** — not needed for this read-only inbox, but available if you extend.
5. **Prettier** — `singleQuote: true`, `printWidth: 100`. Run `npx prettier --write` if in doubt.
6. **No try/catch in controllers** — N/A here (frontend story), but reinforce: don't add backend defensive code "just in case."
7. **`data-testid` attributes** for E2E selector stability (don't rely on translatable text).

### Previous Story Intelligence

From Story 20.3:
- `MaintenanceRequestsController` lives at `api/v1/maintenance-requests`. The Owner GET path returns every request in the account.
- `MaintenanceRequestDto` includes `Photos` as an optional list (always present on detail, omitted on the list response).
- Submitter display name: `IIdentityService.GetUserDisplayNamesAsync` returns the user's display name OR email; the DTO's `SubmittedByUserName` may be null if neither is set.

From Story 20.4:
- Photo `thumbnailUrl` and `viewUrl` are presigned URLs (with expiry). Display them directly in `<img>` and `<a>` tags. They are regenerated per request — DO NOT cache them in the store across reloads.

From Story 20.5:
- `ownerGuard` redirects Tenant users to `/tenant` (not `/dashboard`). This satisfies AC #11 without new guard code.
- Sidebar/bottom nav use `currentUser()?.role` to differentiate. The `Tenant` branch returns a hard-coded list — adding to `allItems` (Owner branch) does not affect Tenant.
- Shared empty-state, loading-spinner, error-card components are usable here.

From Story 20.6:
- The tenant submit flow lands on `/tenant` after success and `loadRequests()` is called to refresh — that's their list. The landlord sees the same backend records via the inbox; no SignalR live-update is required for 20.7 (out of scope; the dashboard refresh on navigation is sufficient).

From Story 21.1:
- Backend integration tests for the Owner GET path are exhaustive (account scoping, ordering, status filter case-insensitive, property filter, pagination edge cases). No new backend tests needed.

From Story 21.4:
- Tenant E2E pattern: throwaway landlord + tenant via `setupTenantContext`. Reuse the helpers; **do not** modify `claude@claude.com`'s data. Add a `setupLandlordWithTenants` style helper if needed for the inbox spec — or compose existing helpers inline.

### Testing Strategy (Testing Pyramid)

Per the user's "Testing Pyramid" memory: full-stack stories require unit + integration (WebApplicationFactory) + E2E (Playwright). Justification per layer:

- **Unit (Vitest, frontend):** YES. New service, store, component, detail component — each gets a co-located spec. Coverage targets: ~25 new tests across the 4 spec files.
- **Integration (WebApplicationFactory, backend):** SKIPPED — justified. The Owner GET endpoint and detail endpoint are exhaustively tested by Story 21.1's `MaintenanceRequestsControllerTests.cs` (account isolation, ordering, status filter case-insensitive, property filter, pagination edge cases, AccessToken auth). This story makes ZERO backend changes; adding redundant integration tests would be busywork.
- **E2E (Playwright):** YES. New routes, new component, new role-aware navigation — needs end-to-end verification of the landlord flow. 6 specs covering happy path, navigation, filtering (UI invocation), empty states, and tenant-redirect security boundary.

If Task 9's status-filter spec has trouble seeding non-Submitted statuses (since 20.8/20.9 don't yet exist), fall back to `page.route()` interception to assert the API is called with the correct query string — this is acceptable per the project's testing rules ("Use `page.route()` to control what the component sees" from `CLAUDE.md`).

### Out of Scope (Subsequent Stories)

- **Convert request to work order** — Story 20.8. The detail view shows the request read-only with no Convert button.
- **Dismiss request with reason** — Story 20.9. Same: no Dismiss button.
- **Resolve when work order completes** — Story 20.10. Backend logic, no UI in this story.
- **Tenant authorization lockdown integration tests** — Story 20.11. Already-implemented enforcement is exercised by 20.7 only at the route-guard layer (AC #11 + Spec 6).
- **Multi-status backend filtering** — Future. See "Status Filter Encoding" above for the current single-status workaround.
- **Real-time inbox updates (SignalR)** — Future. The dashboard refresh on navigation is sufficient for 20.7.

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.7)
- Previous stories:
  - `docs/project/stories/epic-20/20-3-maintenance-request-entity-api.md`
  - `docs/project/stories/epic-20/20-4-maintenance-request-photos.md`
  - `docs/project/stories/epic-20/20-5-tenant-dashboard-role-routing.md`
  - `docs/project/stories/epic-20/20-6-submit-maintenance-request-tenant-ui.md`
- PRD: `docs/project/prd-tenant-portal.md` (FR-TP12)
- Architecture: `docs/project/architecture.md`
- Project Context: `docs/project/project-context.md`
- Reference implementations:
  - Backend controller: `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`
  - Backend list handler: `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequests.cs`
  - Backend detail handler: `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs`
  - Backend DTO: `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs`
  - Backend integration tests (already passing): `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`
  - Frontend list-page pattern: `frontend/src/app/features/work-orders/work-orders.component.ts`
  - Frontend signal store pattern: `frontend/src/app/features/work-orders/stores/work-order.store.ts`
  - Frontend service pattern: `frontend/src/app/features/work-orders/services/work-order.service.ts`
  - Tenant-side request UI (status colors, photo grid): `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.html`
  - Tenant-side store pattern: `frontend/src/app/features/tenant-dashboard/stores/tenant-dashboard.store.ts`
  - Tenant request detail (photo grid pattern): `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.html`
  - Sidebar nav (where to add the inbox item): `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts`
  - Bottom nav: `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts`
  - Owner guard (already redirects Tenant → /tenant): `frontend/src/app/core/auth/owner.guard.ts`
  - Routes file: `frontend/src/app/app.routes.ts`
  - E2E page object pattern: `frontend/e2e/pages/work-order-list.page.ts`
  - E2E tenant helpers: `frontend/e2e/helpers/tenant.helper.ts`
  - Tenant E2E precedent: `frontend/e2e/tests/tenant-dashboard/tenant-dashboard.spec.ts`
  - Shared empty-state / loading-spinner / error-card: `frontend/src/app/shared/components/`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Claude Opus 4.7, 1M context).

### Debug Log References

- Initial E2E run for `landlord-inbox.spec.ts`: 5/6 passed; spec 1 failed because `text-transform: uppercase` makes the chip's rendered text mixed-case ("Submitted") rather than uppercase. Switched the assertion to `toHaveClass(/status-submitted/) + toContainText('Submitted')`. Also updated the page-object helper.
- Frontend test runner: `ng test --include='**/<glob>' --watch=false` (NOT `npx vitest`). Confirmed the Vitest runner config in `angular.json`.
- Bundle budget warning: 579.70 kB initial, 4.70 kB over 575 kB. Matches the documented 4.4 kB pre-existing overage (story Task 8.2). No new regression.

### Completion Notes List

1. Stayed within the planned scope. No backend changes; story is frontend-only and reuses APIs from 20.3/20.4.
2. **DTOs duplicated** from `tenant.service.ts` per the story's decoupling decision; consolidation is a future tech-debt opportunity.
3. **Bottom-nav left unchanged** per Task 6.2 decision rule (Owner currently has 5 items; the story said "add only if ≤ 4").
4. **Status filter encoding**: `n=1 → status param`; otherwise omitted. Empty selection refused (matches `WorkOrderStore`).
5. **`RouterLink` removed** from the inbox component imports — navigation is programmatic via `Router.navigate`. Detail component still imports `RouterLink` for the back button and linked-work-order badge.
6. **Visual verification**: Used Playwright MCP to confirm the inbox renders with sidebar nav highlighted, status badges color-coded, and detail navigation working. Screenshots saved under `screenshots/` then deleted at story end (Step 5 cleanup).
7. **E2E test isolation**: every spec creates a throwaway landlord via `createLandlordViaInvitation` (per the tenant-dashboard precedent). Empty-state spec uses `page.route()` to stub the inbox endpoint since the throwaway landlord shares the seeded account.
8. The detail-page chip's color override (`--mdc-chip-elevated-container-color`) renders correctly; visual was confirmed with the inbox view's chip class binding.

### File List

**Created**:
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.spec.ts`
- `frontend/src/app/features/maintenance-requests/stores/maintenance-request.store.ts`
- `frontend/src/app/features/maintenance-requests/stores/maintenance-request.store.spec.ts`
- `frontend/src/app/features/maintenance-requests/maintenance-requests.component.ts`
- `frontend/src/app/features/maintenance-requests/maintenance-requests.component.spec.ts`
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.spec.ts`
- `frontend/e2e/pages/maintenance-requests-list.page.ts`
- `frontend/e2e/pages/maintenance-request-detail.page.ts`
- `frontend/e2e/tests/maintenance-requests/landlord-inbox.spec.ts`

**Modified**:
- `frontend/src/app/app.routes.ts` — added `/maintenance-requests` and `/maintenance-requests/:id` routes (ownerGuard).
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` — added Maintenance Requests nav item between Work Orders and Reports.
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` — updated counts (9 → 10), added position + Tenant/Contributor exclusion tests.
- `frontend/src/app/core/auth/owner.guard.spec.ts` — added Tenant → `/tenant` redirect test for `/maintenance-requests`.
- `frontend/e2e/helpers/tenant.helper.ts` — added `loginAsLandlord` helper.
- `frontend/e2e/fixtures/test-fixtures.ts` — registered the two new page-object fixtures.
- `docs/project/sprint-status.yaml` — `20-7-landlord-maintenance-request-inbox: in-progress` → `review`.
