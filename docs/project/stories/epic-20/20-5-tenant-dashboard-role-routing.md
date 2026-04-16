# Story 20.5: Tenant Dashboard & Role-Based Routing

Status: done

## Story

As a tenant,
I want to log in and see a dashboard showing my property and maintenance requests,
so that I can manage my requests without seeing landlord workflows.

## Acceptance Criteria

1. **Given** a user with the Tenant role,
   **When** they log in,
   **Then** they are routed to the tenant dashboard (not the landlord dashboard)

2. **Given** a tenant on their dashboard,
   **When** the page loads,
   **Then** they see their property information (address, name) in read-only format

3. **Given** a tenant on their dashboard,
   **When** the page loads,
   **Then** they see a list of all maintenance requests for their property (submitted by any tenant on that property)

4. **Given** a maintenance request in the list,
   **When** the tenant views it,
   **Then** they see the description, status (Submitted / In Progress / Resolved / Dismissed), and dismissal reason if dismissed

5. **Given** a tenant,
   **When** they navigate the app,
   **Then** the navigation shows only tenant-relevant items (dashboard, submit request) — no properties list, expenses, income, reports, vendors, or work orders

6. **Given** a tenant,
   **When** they manually navigate to a landlord route (e.g., /expenses),
   **Then** the Angular route guard redirects them to the tenant dashboard

7. **Given** a landlord user,
   **When** they log in,
   **Then** they are routed to the existing landlord dashboard as before (no regression)

8. **Given** the tenant dashboard,
   **When** viewed on a mobile device,
   **Then** the layout is mobile-first and usable on small screens

## Tasks / Subtasks

- [x] Task 1: Create tenant property API endpoint (AC: #2)
  - [x] 1.1 Create `GetTenantProperty.cs` in `backend/src/PropertyManager.Application/MaintenanceRequests/` — a new query that returns property info for the current tenant user using `_currentUser.PropertyId`
  - [x] 1.2 Define query: `public record GetTenantPropertyQuery() : IRequest<TenantPropertyDto>;`
  - [x] 1.3 Define DTO: `public record TenantPropertyDto(Guid Id, string Name, string Street, string City, string State, string ZipCode);` — read-only, no financial data
  - [x] 1.4 Handler: query `_dbContext.Properties` filtered by `Id == _currentUser.PropertyId && AccountId == _currentUser.AccountId && DeletedAt == null`. Throw `NotFoundException` if not found. Throw `BusinessRuleException` if `_currentUser.PropertyId` is null.
  - [x] 1.5 Add GET `tenant-property` endpoint to `MaintenanceRequestsController` — no authorization policy beyond JWT (handler verifies role + PropertyId). Returns 200 with `TenantPropertyDto`.

- [x] Task 2: Backend unit tests for GetTenantProperty (AC: #2)
  - [x] 2.1 Test: Handle returns property info for tenant with valid PropertyId
  - [x] 2.2 Test: Handle throws NotFoundException when property not found
  - [x] 2.3 Test: Handle throws BusinessRuleException when CurrentUser.PropertyId is null

- [x] Task 3: Create frontend maintenance request service (AC: #3, #4)
  - [x] 3.1 Create `frontend/src/app/features/tenant-dashboard/services/tenant.service.ts`
  - [x] 3.2 Inject `HttpClient`. Methods: `getTenantProperty()` returns `Observable<TenantPropertyDto>`, `getMaintenanceRequests(page?, pageSize?)` returns `Observable<PaginatedMaintenanceRequests>`, `getMaintenanceRequestById(id)` returns `Observable<MaintenanceRequestDto>`
  - [x] 3.3 Define TypeScript interfaces: `TenantPropertyDto`, `MaintenanceRequestDto`, `MaintenanceRequestPhotoDto`, `PaginatedMaintenanceRequests` matching backend DTOs
  - [x] 3.4 API URLs: `/api/v1/maintenance-requests/tenant-property`, `/api/v1/maintenance-requests`, `/api/v1/maintenance-requests/{id}`

- [x] Task 4: Create tenant dashboard signal store (AC: #2, #3, #4)
  - [x] 4.1 Create `frontend/src/app/features/tenant-dashboard/stores/tenant-dashboard.store.ts`
  - [x] 4.2 Use `signalStore()` with `withState()`, `withComputed()`, `withMethods()`
  - [x] 4.3 State: `{ property: TenantPropertyDto | null, requests: MaintenanceRequestDto[], isLoading: boolean, error: string | null, totalCount: number, page: number, pageSize: number }`
  - [x] 4.4 Methods: `loadProperty()` — calls `TenantService.getTenantProperty()`, patches state. `loadRequests(page?, pageSize?)` — calls `TenantService.getMaintenanceRequests()`, patches state. Both use `rxMethod<void>(pipe(...))` pattern with `switchMap`, `tap`, `catchError`.
  - [x] 4.5 Computed: `totalPages`, `isEmpty`, `propertyAddress` (formatted), `isPropertyLoaded`

- [x] Task 5: Create tenant dashboard component (AC: #2, #3, #4, #8)
  - [x] 5.1 Create `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.ts` — standalone component
  - [x] 5.2 Template: property info card (name, full address) at top, maintenance request list below
  - [x] 5.3 Request list: each item shows description (truncated), status badge (color-coded), date submitted. Clicking opens detail view (inline expand or separate section).
  - [x] 5.4 Status badges: "Submitted" = neutral/gray, "In Progress" = blue/primary, "Resolved" = green/success, "Dismissed" = orange/warn with dismissal reason displayed
  - [x] 5.5 Empty state: "No maintenance requests yet" with icon and message
  - [x] 5.6 Loading state: use shared `LoadingSpinnerComponent`
  - [x] 5.7 Error state: use shared `ErrorCardComponent` with retry
  - [x] 5.8 Mobile-first SCSS: full-width cards, large text, stacked layout on small screens. Max-width 800px on desktop.
  - [x] 5.9 Use Angular Material: `MatCardModule`, `MatIconModule`, `MatChipsModule` (for status badges), `MatListModule`, `MatButtonModule`, `MatPaginatorModule`
  - [x] 5.10 Inject `TenantDashboardStore`, call `loadProperty()` and `loadRequests()` on init

- [x] Task 6: Create request detail section within dashboard (AC: #4)
  - [x] 6.1 Create `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.ts` — standalone component
  - [x] 6.2 Shows: full description, status with badge, submitted date, dismissal reason (if dismissed), photos (if any, with presigned URLs from backend)
  - [x] 6.3 Input: maintenance request ID. Component fetches detail via `TenantService.getMaintenanceRequestById(id)`.
  - [x] 6.4 Photos displayed as thumbnail grid (reuse existing photo viewer pattern if applicable, or simple img grid)
  - [x] 6.5 "Back to list" button/link to return to dashboard list view

- [x] Task 7: Update role-based routing — login redirect (AC: #1, #7)
  - [x] 7.1 Modify `LoginComponent.getSafeReturnUrl()`: if `returnUrl` is not provided, check user role. If Tenant, return `/tenant`; otherwise return `/dashboard`.
  - [x] 7.2 Modify `guestGuard`: when redirecting authenticated users, check role. If Tenant, redirect to `/tenant`; otherwise redirect to `/dashboard`.
  - [x] 7.3 Verify: landlord login still routes to `/dashboard` (regression check)

- [x] Task 8: Update role-based routing — route guards (AC: #6)
  - [x] 8.1 Create `frontend/src/app/core/auth/tenant.guard.ts` — `tenantGuard: CanActivateFn` that allows only Tenant role users; redirects others to `/dashboard`
  - [x] 8.2 Modify `ownerGuard`: when a Tenant user hits an owner-only route, redirect to `/tenant` instead of `/dashboard`
  - [x] 8.3 Add route guard for the default shell redirect: when a Tenant user hits the empty path `''` inside the shell, redirect to `/tenant` instead of `/dashboard`

- [x] Task 9: Update app.routes.ts with tenant routes (AC: #1, #6)
  - [x] 9.1 Add tenant dashboard route inside shell children: `{ path: 'tenant', loadComponent: () => import('./features/tenant-dashboard/tenant-dashboard.component').then(m => m.TenantDashboardComponent), canActivate: [tenantGuard] }`
  - [x] 9.2 Add tenant request detail route: `{ path: 'tenant/requests/:id', loadComponent: () => import('./features/tenant-dashboard/components/request-detail/request-detail.component').then(m => m.RequestDetailComponent), canActivate: [tenantGuard] }`
  - [x] 9.3 Update the catch-all redirect: consider role-aware redirect (or keep `/dashboard` — the `DashboardComponent` or shell-level redirect will handle tenant routing)
  - [x] 9.4 Update `PermissionService.canAccess()`: populate `tenantRoutes` array with `['/tenant']`

- [x] Task 10: Update navigation for tenant role (AC: #5)
  - [x] 10.1 Modify `SidebarNavComponent.navItems` computed: add Tenant case — return only `[{ label: 'Dashboard', route: '/tenant', icon: 'dashboard' }]` (Submit Request will be added in Story 20.6)
  - [x] 10.2 Modify `BottomNavComponent.navItems` computed: add Tenant case — return only `[{ label: 'Dashboard', route: '/tenant', icon: 'dashboard' }]`
  - [x] 10.3 Verify: sidebar and bottom nav show correct items for Owner (all), Contributor (subset), and Tenant (dashboard only)

- [x] Task 11: Update shell component for tenant users (AC: #5)
  - [x] 11.1 In `ShellComponent.ngOnInit()`: skip `receiptSignalR.initialize()` and `receiptStore.loadUnprocessedReceipts()` for Tenant users (tenants don't use receipts). Check `this.authService.currentUser()?.role === 'Tenant'`.
  - [x] 11.2 In `ShellComponent` template: hide `MobileCaptureFabComponent` for Tenant users
  - [x] 11.3 Verify: receipts FAB and SignalR init are still active for Owner/Contributor users

- [x] Task 12: Backend unit tests for GetTenantProperty endpoint (AC: #2)
  - [x] 12.1 (Covered in Task 2 — handler tests)

- [x] Task 13: Frontend unit tests — TenantDashboardStore (AC: #2, #3, #4)
  - [x] 13.1 Test: `loadProperty()` fetches and stores property data
  - [x] 13.2 Test: `loadProperty()` error sets error state
  - [x] 13.3 Test: `loadRequests()` fetches and stores maintenance requests
  - [x] 13.4 Test: `loadRequests()` error sets error state
  - [x] 13.5 Test: `totalPages` computed correctly
  - [x] 13.6 Test: `propertyAddress` formats correctly

- [x] Task 14: Frontend unit tests — TenantDashboardComponent (AC: #2, #3, #8)
  - [x] 14.1 Test: component renders property info when loaded
  - [x] 14.2 Test: component renders request list when loaded
  - [x] 14.3 Test: component shows loading spinner during load
  - [x] 14.4 Test: component shows empty state when no requests
  - [x] 14.5 Test: component shows error card on error

- [x] Task 15: Frontend unit tests — RequestDetailComponent (AC: #4)
  - [x] 15.1 Test: renders full description and status
  - [x] 15.2 Test: renders dismissal reason when status is Dismissed
  - [x] 15.3 Test: hides dismissal reason when status is not Dismissed

- [x] Task 16: Frontend unit tests — Route guards and navigation (AC: #1, #5, #6, #7)
  - [x] 16.1 Test: `tenantGuard` allows Tenant role
  - [x] 16.2 Test: `tenantGuard` redirects non-Tenant to `/dashboard`
  - [x] 16.3 Test: `ownerGuard` redirects Tenant to `/tenant`
  - [x] 16.4 Test: `guestGuard` redirects authenticated Tenant to `/tenant`
  - [x] 16.5 Test: `SidebarNavComponent` shows only Dashboard for Tenant role
  - [x] 16.6 Test: `BottomNavComponent` shows only Dashboard for Tenant role
  - [x] 16.7 Test: `PermissionService.canAccess('/tenant')` returns true for Tenant role
  - [x] 16.8 Test: `PermissionService.canAccess('/expenses')` returns false for Tenant role

- [x] Task 17: Frontend unit tests — LoginComponent redirect (AC: #1, #7)
  - [x] 17.1 Test: Tenant user redirected to `/tenant` after login (no returnUrl)
  - [x] 17.2 Test: Owner user redirected to `/dashboard` after login (no returnUrl, regression check)

- [x] Task 18: Frontend unit tests — ShellComponent tenant handling (AC: #5)
  - [x] 18.1 Test: `ShellComponent` does NOT call `receiptSignalR.initialize()` for Tenant users
  - [x] 18.2 Test: `ShellComponent` hides MobileCaptureFab for Tenant users
  - [x] 18.3 Test: `ShellComponent` initializes receipts for Owner users (regression)

- [x] Task 19: Verify all existing tests pass (AC: all)
  - [x] 19.1 Run `dotnet test` — all backend tests pass
  - [x] 19.2 Run `npm test` — all frontend tests pass
  - [x] 19.3 Run `dotnet build` and `ng build` — both compile without errors

## Dev Notes

### Architecture: Full-Stack Frontend + Minimal Backend

This is primarily a frontend story with a small backend addition. The major work is:
1. **Backend (small):** One new query handler (`GetTenantProperty`) + one new controller endpoint
2. **Frontend (large):** New feature module (`tenant-dashboard/`), route guards, navigation updates, shell modifications

### Backend: New GetTenantProperty Endpoint

The existing `GET /api/v1/properties/{id}` endpoint uses the `CanManageProperties` policy which maps to `Properties.Create` — tenants don't have this permission (they have only `Properties.ViewAssigned`). Rather than modifying the existing property endpoint's authorization (which could introduce security gaps), create a **new dedicated endpoint** for tenants.

**Endpoint:** `GET /api/v1/maintenance-requests/tenant-property`
- Returns the current tenant's assigned property info (name, address only — no financial data)
- Uses `_currentUser.PropertyId` from JWT to identify the property
- No authorization policy beyond JWT — handler validates the user is a Tenant with a PropertyId
- Returns a lean `TenantPropertyDto` (no expenses, income, recent activity, photos)

**Why on MaintenanceRequestsController?** The tenant property endpoint is semantically part of the tenant experience, and the MaintenanceRequestsController already handles both tenant and landlord requests without restrictive class-level policies. Adding a new controller for a single endpoint adds unnecessary complexity.

### Frontend: Feature Structure

```
frontend/src/app/features/tenant-dashboard/
├── tenant-dashboard.component.ts          # Main dashboard page
├── tenant-dashboard.component.html        # Template
├── tenant-dashboard.component.scss        # Mobile-first styles
├── tenant-dashboard.component.spec.ts     # Tests
├── components/
│   └── request-detail/
│       ├── request-detail.component.ts    # Request detail view
│       ├── request-detail.component.html
│       ├── request-detail.component.scss
│       └── request-detail.component.spec.ts
├── services/
│   └── tenant.service.ts                  # HTTP service for tenant API calls
│       └── tenant.service.spec.ts
└── stores/
    └── tenant-dashboard.store.ts          # Signal store
        └── tenant-dashboard.store.spec.ts
```

### Frontend: Routing Strategy

**Route structure:**
- `/tenant` — Tenant dashboard (property info + request list)
- `/tenant/requests/:id` — Maintenance request detail

**Guard strategy:**
- `tenantGuard` — allows only Tenant role, redirects others to `/dashboard`
- `ownerGuard` (modified) — redirects Tenant to `/tenant` instead of `/dashboard`
- `guestGuard` (modified) — redirects authenticated Tenant to `/tenant`
- `authGuard` — unchanged (shell-level, all authenticated users)

**Login redirect:**
- `LoginComponent.getSafeReturnUrl()` — if no `returnUrl`, check role: Tenant goes to `/tenant`, others go to `/dashboard`

### Frontend: Navigation Updates

Both `SidebarNavComponent` and `BottomNavComponent` currently handle Owner and Contributor roles. Add a third case for Tenant:

```typescript
// In navItems computed:
if (this.authService.currentUser()?.role === 'Tenant') {
  return [
    { label: 'Dashboard', route: '/tenant', icon: 'dashboard' },
  ];
}
```

The "Submit Request" nav item will be added in Story 20.6.

### Frontend: Shell Component Modifications

The `ShellComponent` currently initializes SignalR for receipts and loads unprocessed receipt counts. Tenants don't use receipts, so these should be skipped:

```typescript
ngOnInit(): void {
  if (this.authService.currentUser()?.role !== 'Tenant') {
    this.receiptSignalR.initialize();
    this.receiptStore.loadUnprocessedReceipts();
  }
}
```

Also hide the `MobileCaptureFabComponent` in the template for Tenant users.

### Frontend: Status Badge Design

Use Angular Material chips (`MatChipsModule`) for status badges with these colors:
- **Submitted**: default/neutral chip
- **In Progress**: primary-colored chip (Upkeep Blue)
- **Resolved**: green-tinted chip (success)
- **Dismissed**: orange/warn chip, with dismissal reason displayed below

### Frontend: Mobile-First Design

The tenant dashboard is mobile-first (NFR-TP7). Key design decisions:
- Full-width cards on mobile, max-width 800px on desktop
- Large font sizes for readability on small screens
- Touch-friendly list items with adequate padding (min 48px height)
- Status badges visible at a glance in the request list
- Property info card at top is compact (just name + address)
- Stacked layout: property card → request list → pagination

### Critical Patterns to Follow

1. **Signal store pattern:** Use `signalStore()` with `{ providedIn: 'root' }`. Follow existing stores (e.g., `PropertyStore`, `ReceiptStore`) for `rxMethod` patterns.

2. **Component pattern:** Standalone components with `inject()`, `input()` / `output()` signal-based API, `@if` / `@for` control flow.

3. **Service pattern:** Injectable service with `HttpClient`, returns Observables. No generated NSwag client — manual HTTP calls (NSwag generation has had issues with .NET 10 per Story 20.2 notes).

4. **Route guard pattern:** Functional `CanActivateFn` using `inject()`. Follow `ownerGuard` pattern.

5. **SCSS pattern:** Use CSS custom properties (e.g., `var(--pm-text-primary)`, `var(--pm-text-secondary)`). Follow responsive breakpoints from existing components.

6. **Validators called explicitly in controller** before `_mediator.Send()`.

7. **Request/Response records at bottom of controller file.**

8. **No try-catch in controllers** — global exception middleware handles domain exceptions.

### API Endpoints Used by This Story

| Method | URL | Description | Auth |
|--------|-----|-------------|------|
| GET | `/api/v1/maintenance-requests/tenant-property` | Get tenant's property info | JWT (any — handler validates) |
| GET | `/api/v1/maintenance-requests` | List requests (role-filtered) | JWT |
| GET | `/api/v1/maintenance-requests/{id}` | Request detail with photos | JWT |

All three endpoints exist except `tenant-property` which is new.

### Previous Story Intelligence

From Story 20.1:
- `ICurrentUser.PropertyId` is available (from JWT claim)
- `PermissionService.isTenant` computed signal exists
- `PermissionService.canAccess()` has a placeholder for tenant routes (empty array)
- `User` interface has `propertyId: string | null`
- Owner guard redirects non-Owner to `/dashboard` — must be updated for Tenant
- Backend baseline: 1812 tests (after Story 20.4)
- Frontend baseline: 2703 tests (after Story 20.2, no frontend changes in 20.3/20.4)

From Story 20.3:
- `MaintenanceRequestsController` exists at `api/v1/maintenance-requests`
- GET list and GET by ID endpoints are role-aware (handler filters by role)
- `MaintenanceRequestDto` has all fields including optional `Photos` list
- No authorization policy on GET endpoints — handler differentiates by role

From Story 20.4:
- `MaintenanceRequestPhotoDto` has `ThumbnailUrl`, `ViewUrl`, `IsPrimary`, `DisplayOrder`, `OriginalFileName`, `FileSizeBytes`, `CreatedAt`
- Photos are included in `GetMaintenanceRequestById` response
- Photo entity type is `MaintenanceRequests` in `PhotoEntityType` enum

From Story 20.2:
- NSwag generation may fail with .NET 10 — manual TypeScript interfaces are acceptable
- Property address format: `$"{property.Street}, {property.City}, {property.State} {property.ZipCode}"`

### Testing Strategy

- **Backend unit tests** (3 tests): GetTenantProperty handler (valid, not found, null PropertyId)
- **Frontend unit tests** (~25+ tests):
  - TenantDashboardStore (6 tests: load property, load requests, errors, computeds)
  - TenantDashboardComponent (5 tests: renders, loading, empty, error states)
  - RequestDetailComponent (3 tests: description, status, dismissal reason)
  - Route guards (4 tests: tenantGuard allow/deny, ownerGuard tenant redirect, guestGuard tenant redirect)
  - Navigation components (2 tests: sidebar and bottom nav for Tenant role)
  - PermissionService (2 tests: canAccess for tenant routes)
  - LoginComponent (2 tests: tenant redirect, owner regression)
  - ShellComponent (3 tests: skip receipts for tenant, hide FAB, owner regression)
- **No E2E tests** in this story — tenant E2E tests require a seeded tenant user which would need test infrastructure changes (Story 20.11 handles this with WebApplicationFactory integration tests)

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.5)
- Previous stories:
  - `docs/project/stories/epic-20/20-1-tenant-role-property-association.md`
  - `docs/project/stories/epic-20/20-2-tenant-invitation-flow.md`
  - `docs/project/stories/epic-20/20-3-maintenance-request-entity-api.md`
  - `docs/project/stories/epic-20/20-4-maintenance-request-photos.md`
- PRD: `docs/project/prd-tenant-portal.md` (FR-TP6, FR-TP8, FR-TP9, FR-TP11, NFR-TP5, NFR-TP7)
- Architecture: `docs/project/architecture.md`
- Project Context: `docs/project/project-context.md`
- Reference implementations:
  - Landlord dashboard: `frontend/src/app/features/dashboard/dashboard.component.ts`
  - Sidebar nav: `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts`
  - Bottom nav: `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts`
  - Shell: `frontend/src/app/core/components/shell/shell.component.ts`
  - Owner guard: `frontend/src/app/core/auth/owner.guard.ts`
  - Auth guard: `frontend/src/app/core/auth/auth.guard.ts`
  - Guest guard: `frontend/src/app/core/auth/auth.guard.ts`
  - Permission service: `frontend/src/app/core/auth/permission.service.ts`
  - Auth service: `frontend/src/app/core/services/auth.service.ts`
  - Login component: `frontend/src/app/features/auth/login/login.component.ts`
  - App routes: `frontend/src/app/app.routes.ts`
  - Property store: `frontend/src/app/features/properties/stores/property.store.ts`
  - MaintenanceRequestsController: `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`
  - MaintenanceRequestDto: `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs`
  - GetMaintenanceRequests: `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequests.cs`
  - GetMaintenanceRequestById: `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs`
  - MaintenanceRequestPhotoDto: `backend/src/PropertyManager.Application/MaintenanceRequestPhotos/GetMaintenanceRequestPhotos.cs`
  - Permissions: `backend/src/PropertyManager.Domain/Authorization/Permissions.cs`
  - RolePermissions: `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`
  - Program.cs (policies): `backend/src/PropertyManager.Api/Program.cs` (lines 162-174)

## File List

### New Files
- `backend/src/PropertyManager.Application/MaintenanceRequests/GetTenantProperty.cs` — GetTenantPropertyQuery + TenantPropertyDto + Handler
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/GetTenantPropertyHandlerTests.cs` — 3 unit tests
- `frontend/src/app/features/tenant-dashboard/services/tenant.service.ts` — HTTP service for tenant API
- `frontend/src/app/features/tenant-dashboard/stores/tenant-dashboard.store.ts` — Signal store
- `frontend/src/app/features/tenant-dashboard/stores/tenant-dashboard.store.spec.ts` — 6 store tests
- `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.ts` — Main dashboard component
- `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.html` — Dashboard template
- `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.scss` — Mobile-first styles
- `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.spec.ts` — 5 component tests
- `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.ts` — Request detail component
- `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.html` — Detail template
- `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.scss` — Detail styles
- `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.spec.ts` — 3 detail tests
- `frontend/src/app/core/auth/tenant.guard.ts` — Tenant route guard
- `frontend/src/app/core/auth/tenant.guard.spec.ts` — 3 guard tests

### Modified Files
- `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs` — Added GetTenantProperty endpoint
- `frontend/src/app/app.routes.ts` — Added tenant routes, imported tenantGuard
- `frontend/src/app/core/auth/auth.guard.ts` — guestGuard redirects tenants to /tenant
- `frontend/src/app/core/auth/auth.guard.spec.ts` — Added tenant redirect test, updated mock
- `frontend/src/app/core/auth/owner.guard.ts` — Redirects tenant to /tenant
- `frontend/src/app/core/auth/owner.guard.spec.ts` — Added tenant redirect test
- `frontend/src/app/core/auth/permission.service.ts` — Populated tenant routes array
- `frontend/src/app/core/auth/permission.service.spec.ts` — Added 2 tenant canAccess tests
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` — Added Tenant nav items
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` — Added 3 Tenant tests
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts` — Added Tenant nav items
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.spec.ts` — Added 3 Tenant tests
- `frontend/src/app/core/components/shell/shell.component.ts` — isTenant computed, skip receipts for tenant
- `frontend/src/app/core/components/shell/shell.component.html` — Hide MobileCaptureFab for tenant
- `frontend/src/app/core/components/shell/shell.component.spec.ts` — Added 4 tenant/owner tests
- `frontend/src/app/features/auth/login/login.component.ts` — Role-based default redirect
- `frontend/src/app/features/auth/login/login.component.spec.ts` — Added 2 role-based redirect tests, fixed mock
- `docs/project/sprint-status.yaml` — Updated story status
- `docs/project/stories/epic-20/20-5-tenant-dashboard-role-routing.md` — Updated task status

## Dev Agent Record

### Implementation Notes
- Backend: Created GetTenantProperty query handler with TenantPropertyDto (lean, no financial data). Placed in MaintenanceRequests namespace per story spec. Added GET tenant-property endpoint to MaintenanceRequestsController.
- Frontend: Created full tenant-dashboard feature module with service, signal store, dashboard component (property card + request list), and request detail component (with photo grid, dismissal reason).
- Routing: Created tenantGuard, updated ownerGuard (tenant -> /tenant), guestGuard (tenant -> /tenant), LoginComponent (role-based default redirect). Added /tenant and /tenant/requests/:id routes with tenantGuard.
- Navigation: SidebarNav and BottomNav both show single Dashboard item for Tenant role pointing to /tenant.
- Shell: Skip receiptSignalR.initialize() and receiptStore.loadUnprocessedReceipts() for Tenant users. Hide MobileCaptureFab in template.
- PermissionService: Populated tenantRoutes with ['/tenant'].
- Tests: 3 backend unit tests (handler). ~32 new/updated frontend tests across store, components, guards, nav, login, shell.
- All existing tests pass: 1817 backend, 2735 frontend. Both builds succeed.
