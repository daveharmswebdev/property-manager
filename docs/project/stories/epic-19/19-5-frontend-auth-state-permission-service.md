# Story 19.5: Frontend Auth State and Permission Service

Status: done

## Story

As a user,
I want the app to show me only what I have access to,
so that I'm not confused by features I can't use.

## Acceptance Criteria

1. **Given** I log in as an Owner
   **When** the app loads
   **Then** I see the full sidebar navigation: Dashboard, Properties, Expenses, Income, Receipts, Vendors, Work Orders, Reports, Settings

2. **Given** I log in as a Contributor
   **When** the app loads
   **Then** I see limited sidebar navigation: Dashboard, Receipts, Work Orders

3. **Given** I am logged in as a Contributor
   **When** I navigate to `/expenses` via the URL bar
   **Then** I am redirected to the Dashboard

4. **Given** I am logged in as a Contributor
   **When** I view the properties list
   **Then** I do not see the "Add Property" button or any edit/delete actions

5. **Given** I am logged in as an Owner
   **When** I view the properties list
   **Then** I see the "Add Property" button and all actions as normal

6. **Given** I log in as a Contributor
   **When** the mobile bottom navigation loads
   **Then** I see limited bottom nav: Dashboard, Receipts, Work Orders

7. **Given** I am logged in as a Contributor
   **When** I navigate to `/receipts/:id` (process receipt page)
   **Then** I am redirected to the Dashboard (Contributors can view receipts but cannot process them into expenses)

## Tasks / Subtasks

- [x] Task 1: Create `PermissionService` (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 1.1 Create `frontend/src/app/core/auth/permission.service.ts`
  - [x] 1.2 Inject `AuthService`, read `currentUser().role` to determine permissions
  - [x] 1.3 Implement `isOwner(): boolean` — returns `true` if role === 'Owner'
  - [x] 1.4 Implement `isContributor(): boolean` — returns `true` if role === 'Contributor'
  - [x] 1.5 Implement `canAccess(route: string): boolean` — checks if the current user's role allows access to the given route path
  - [x] 1.6 Export permission constants mirroring the backend `Permissions.cs` for frontend use (optional, can use role-based logic since there are only 2 roles)
  - [x] 1.7 Unit tests: `frontend/src/app/core/auth/permission.service.spec.ts` — test `isOwner()`, `isContributor()`, `canAccess()` for both Owner and Contributor roles

- [x] Task 2: Create `ownerGuard` route guard (AC: #3, #7)
  - [x] 2.1 Create `frontend/src/app/core/auth/owner.guard.ts`
  - [x] 2.2 Implement as `CanActivateFn` (functional guard, matching existing `authGuard` pattern)
  - [x] 2.3 Inject `AuthService` and `Router` via `inject()`
  - [x] 2.4 If `currentUser().role === 'Owner'`, return `true`
  - [x] 2.5 If not Owner (Contributor or unknown), redirect to `/dashboard` via `router.createUrlTree(['/dashboard'])`
  - [x] 2.6 Handle edge case: if `currentUser()` is null (not yet loaded), wait for auth initialization before deciding (follow `authGuard` pattern with `initializeAuth()`)
  - [x] 2.7 Unit tests: `frontend/src/app/core/auth/owner.guard.spec.ts` �� test Owner allowed, Contributor redirected, null user redirected

- [x] Task 3: Apply `ownerGuard` to owner-only routes (AC: #3, #7)
  - [x] 3.1 Update `frontend/src/app/app.routes.ts` to add `canActivate: [ownerGuard]` (in addition to existing `authGuard` on the parent shell route) to:
    - `properties/new`
    - `properties/:id/edit`
    - `properties/:id` (property detail — Owner-only per backend AC)
    - `properties/:id/expenses` (expense workspace)
    - `properties/:id/income` (income workspace)
    - `expenses` and `expenses/:id`
    - `income` and `income/:id`
    - `vendors`, `vendors/new`, `vendors/:id`, `vendors/:id/edit`
    - `reports`
    - `settings`
  - [x] 3.2 Add `canActivate: [ownerGuard]` to `receipts/:id` (receipt processing — Contributors can view receipt list but cannot process receipts into expenses)
  - [x] 3.3 Do NOT guard: `dashboard`, `receipts` (list), `work-orders`, `work-orders/:id` (Contributors can view these)
  - [x] 3.4 Do NOT guard: `work-orders/new`, `work-orders/:id/edit` — these are Owner-only but the backend already enforces 403. Add `ownerGuard` for consistency.

- [x] Task 4: Update `SidebarNavComponent` to filter nav items by role (AC: #1, #2)
  - [x] 4.1 Inject `PermissionService` (or `AuthService` directly) into `SidebarNavComponent`
  - [x] 4.2 Convert `navItems` from a static readonly array to a `computed()` signal that filters items based on `currentUser().role`
  - [x] 4.3 Owner sees all 9 items: Dashboard, Properties, Expenses, Income, Receipts, Vendors, Work Orders, Reports, Settings
  - [x] 4.4 Contributor sees 3 items: Dashboard, Receipts, Work Orders
  - [x] 4.5 Update existing unit tests in `sidebar-nav.component.spec.ts`:
    - Test: Owner role shows 9 nav items
    - Test: Contributor role shows 3 nav items (Dashboard, Receipts, Work Orders)
    - Update existing tests that assert `navItems.length === 9` to use the Owner mock

- [x] Task 5: Update `BottomNavComponent` to filter nav items by role (AC: #6)
  - [x] 5.1 Inject `AuthService` into `BottomNavComponent`
  - [x] 5.2 Convert `navItems` from a static readonly array to a `computed()` signal that filters items based on role
  - [x] 5.3 Owner sees 5 items: Dashboard, Properties, Expenses, Income, Receipts
  - [x] 5.4 Contributor sees 3 items: Dashboard, Receipts, Work Orders
  - [x] 5.5 Update existing unit tests in `bottom-nav.component.spec.ts`:
    - Test: Owner role shows 5 bottom nav items
    - Test: Contributor role shows 3 bottom nav items

- [x] Task 6: Hide Owner-only actions in properties list (AC: #4, #5)
  - [x] 6.1 Inject `PermissionService` (or `AuthService`) into `PropertiesComponent`
  - [x] 6.2 Wrap the "Add Property" button with `@if (permissionService.isOwner())`
  - [x] 6.3 Note: The `PropertyRowComponent` does NOT have edit/delete buttons (those are on the property-detail page), so no changes needed there. The property detail page (`property-detail.component.ts`) has Edit and Delete buttons — these are already protected by the `ownerGuard` on the route, so Contributors cannot reach the detail page.

- [x] Task 7: Handle Contributor-specific dashboard experience (AC: #2)
  - [x] 7.1 The `DashboardController` is restricted to `CanAccessExpenses` (Owner-only per Story 19.3). Contributors hitting `/dashboard` will get a 403 from the API.
  - [x] 7.2 Create a lightweight Contributor dashboard or handle the 403 gracefully in the existing `DashboardComponent`:
    - Option A (recommended): Show a simplified welcome message for Contributors: "Welcome, {name}. Use Receipts to upload receipts or Work Orders to view maintenance tasks."
    - Option B: Catch the 403 error in the dashboard store and display the welcome message instead of an error
  - [x] 7.3 Inject `AuthService` into `DashboardComponent`, check role, and conditionally render either the full Owner dashboard or the Contributor welcome message
  - [x] 7.4 Unit test: DashboardComponent shows welcome message for Contributor role

- [x] Task 8: Unit tests for PermissionService (AC: #1, #2, #3)
  - [x] 8.1 Already covered by Task 1.7 — ensure comprehensive coverage:
    - `isOwner()` returns true for Owner, false for Contributor, false for null user
    - `isContributor()` returns true for Contributor, false for Owner, false for null user
    - `canAccess('/expenses')` returns true for Owner, false for Contributor
    - `canAccess('/receipts')` returns true for both roles
    - `canAccess('/work-orders')` returns true for both roles
    - `canAccess('/dashboard')` returns true for both roles

- [x] Task 9: Verify existing tests pass and no regressions (AC: all)
  - [x] 9.1 Run `npm test` — all existing frontend unit tests pass
  - [x] 9.2 Run `dotnet test` — all backend tests pass (no backend changes in this story)
  - [x] 9.3 Manual or E2E smoke test: Login as Owner, verify full nav and functionality unchanged

- [x] Task 10: E2E test for Contributor navigation restriction (AC: #2, #3)
  - [x] 10.1 This test requires a Contributor user account. Since E2E tests share the `claude@claude.com` Owner account, use `page.route()` to intercept the JWT and modify the role claim, OR create a Contributor via the invitation API flow.
  - [x] 10.2 **Recommended approach:** Use `page.route()` to intercept the `/api/v1/auth/login` response and modify the JWT payload's `role` claim to "Contributor". This avoids creating real users in the shared E2E database.
  - [x] 10.3 Alternative: Skip E2E for Contributor-specific behavior in this story. The unit tests cover the logic, and the route guard + nav filtering are tested at the component level. E2E for Contributor behavior can be added in Story 19.7 (final epic story) when the full user management UI is available.
  - [x] 10.4 **Decision: defer E2E to Story 19.7.** The unit test coverage for PermissionService, ownerGuard, SidebarNav, and BottomNav is sufficient. E2E would require complex JWT manipulation that's brittle.

## Dev Notes

### Architecture: Frontend Permission Model

The frontend permission model is **role-based, not permission-based**. Since there are only 2 roles (Owner and Contributor), the frontend can use simple `role === 'Owner'` checks rather than mirroring the full backend permission matrix. The backend enforces the granular permission model; the frontend provides UX-appropriate visibility.

**Key insight:** The JWT already contains a `role` claim (verified in `AuthService.decodeToken()`). The `User` interface already has a `role: string` field. No new API calls are needed — the permission check is derived from existing auth state.

### PermissionService Design

```typescript
// frontend/src/app/core/auth/permission.service.ts
import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authService = inject(AuthService);

  readonly isOwner = computed(() => this.authService.currentUser()?.role === 'Owner');
  readonly isContributor = computed(() => this.authService.currentUser()?.role === 'Contributor');

  canAccess(route: string): boolean {
    if (this.isOwner()) return true;
    // Contributor-accessible routes
    const contributorRoutes = ['/dashboard', '/receipts', '/work-orders'];
    return contributorRoutes.some(r => route === r || route.startsWith(r + '/'));
  }
}
```

**Critical:** `isOwner` and `isContributor` are `computed()` signals, not methods. This allows them to be used directly in templates: `@if (permissionService.isOwner())`. This is reactive — when the user logs out or the role changes (e.g., after role update in Story 19.7), the UI updates automatically.

**Exception for `canAccess`:** This is a method (not computed) because it takes a parameter. It's used primarily in the route guard, not in templates.

### ownerGuard Pattern

Follow the existing `authGuard` pattern in `frontend/src/app/core/auth/auth.guard.ts`:

```typescript
// frontend/src/app/core/auth/owner.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const ownerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.role === 'Owner') {
    return true;
  }

  // Contributor or unknown role — redirect to dashboard
  return router.createUrlTree(['/dashboard']);
};
```

**Important:** The `ownerGuard` does NOT need to handle authentication (that's `authGuard`'s job). It runs on child routes inside the Shell, which already has `authGuard`. So by the time `ownerGuard` runs, the user is guaranteed to be authenticated. The `currentUser()` signal will be populated.

### Route Guard Composition

The Shell route has `canActivate: [authGuard]`. Child routes that need owner-only access add `canActivate: [ownerGuard]`. Angular evaluates parent guards first, so:

1. User hits `/expenses`
2. Shell's `authGuard` checks authentication → passes (user is authenticated)
3. `/expenses` route's `ownerGuard` checks role → if Contributor, redirects to `/dashboard`

This is the standard Angular guard composition pattern. No need to check authentication again in `ownerGuard`.

### Navigation Filtering

**SidebarNavComponent** currently has a static `navItems` array with 9 items. Change to a `computed()` signal:

```typescript
readonly navItems = computed(() => {
  const allItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Properties', route: '/properties', icon: 'home_work' },
    { label: 'Expenses', route: '/expenses', icon: 'receipt_long' },
    { label: 'Income', route: '/income', icon: 'payments' },
    { label: 'Receipts', route: '/receipts', icon: 'document_scanner' },
    { label: 'Vendors', route: '/vendors', icon: 'business' },
    { label: 'Work Orders', route: '/work-orders', icon: 'assignment' },
    { label: 'Reports', route: '/reports', icon: 'assessment' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
  ];

  if (this.authService.currentUser()?.role === 'Owner') {
    return allItems;
  }

  // Contributor sees only these routes
  const contributorRoutes = ['/dashboard', '/receipts', '/work-orders'];
  return allItems.filter(item => contributorRoutes.includes(item.route));
});
```

**BottomNavComponent** currently has 5 items (Dashboard, Properties, Expenses, Income, Receipts). Apply the same pattern:
- Owner: Dashboard, Properties, Expenses, Income, Receipts (5 items — unchanged)
- Contributor: Dashboard, Receipts, Work Orders (3 items)

**Template update:** The sidebar template already uses `@for (item of navItems; track item.route)`. Since `navItems` becomes a computed signal, change the template to `@for (item of navItems(); track item.route)` — add the `()` to invoke the signal.

### Contributor Dashboard Handling

The `DashboardController` returns 403 for Contributors (Story 19.3 applied `CanAccessExpenses` policy). The frontend `DashboardComponent` will need to either:

1. **Check role before making API calls** (recommended) — if Contributor, skip the financial data fetch and show a welcome message instead
2. Handle the 403 error in the store

Option 1 is cleaner. In `DashboardComponent`, inject `AuthService`, check `currentUser().role`, and conditionally render:
- **Owner:** Full dashboard with financial summaries (existing behavior)
- **Contributor:** Simple card with "Welcome, {name}" and links to Receipts and Work Orders

### Properties Page — "Add Property" Button

The `PropertiesComponent` has an "Add Property" button in the header (line 38 of `properties.component.ts`). Wrap it:

```html
@if (permissionService.isOwner()) {
  <button mat-raised-button color="primary" routerLink="/properties/new">
    <mat-icon>add</mat-icon>
    Add Property
  </button>
}
```

**Note:** The Properties list page itself (`/properties`) is currently accessible to Contributors via `CanViewProperties` policy on the backend. Contributors can see the property list (for dropdown selection in work orders), but cannot access property detail/edit/delete pages. The `ownerGuard` on `properties/:id` prevents navigation to detail.

However, looking at the ACs more carefully: AC#4 says "When I view the properties list, I do not see Edit or Delete buttons." The `PropertyRowComponent` does NOT have edit/delete buttons — it only has a row click that navigates to detail. The Edit and Delete buttons are on the property detail page, which is already owner-guarded. So the only action to hide on the properties list is the "Add Property" button.

**Contributor on `/properties`:** The page will load and show the property list (the backend `GET /properties` allows Contributors via `CanViewProperties`). The "Add Property" button is hidden. Row clicks navigate to `/properties/:id` which will be blocked by `ownerGuard` and redirect to dashboard. This is acceptable UX — Contributors rarely need to visit the properties list since their nav doesn't include it. If they navigate via URL, they see the list but can't do anything meaningful.

### Receipt Processing Guard

Contributors can view the receipt list (`/receipts`) and upload receipts, but cannot process receipts into expenses. The receipt processing page is at `/receipts/:id`. Add `ownerGuard` to this route. The backend also enforces this via `CanProcessReceipts` policy on `ProcessReceipt` action.

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/app/core/auth/permission.service.ts` | Role-based permission checks |
| `frontend/src/app/core/auth/permission.service.spec.ts` | Unit tests for PermissionService |
| `frontend/src/app/core/auth/owner.guard.ts` | Route guard for Owner-only routes |
| `frontend/src/app/core/auth/owner.guard.spec.ts` | Unit tests for ownerGuard |

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/app.routes.ts` | Add `ownerGuard` imports and apply to owner-only child routes |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` | Convert `navItems` to computed signal filtered by role |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.html` | Update `navItems` to `navItems()` (invoke signal) |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` | Update tests for dynamic nav items (Owner vs Contributor) |
| `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts` | Convert `navItems` to computed signal filtered by role |
| `frontend/src/app/core/components/bottom-nav/bottom-nav.component.html` | Update `navItems` to `navItems()` (invoke signal) |
| `frontend/src/app/core/components/bottom-nav/bottom-nav.component.spec.ts` | Update tests for dynamic nav items (Owner vs Contributor) |
| `frontend/src/app/features/properties/properties.component.ts` | Inject PermissionService, conditionally hide "Add Property" button |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Handle Contributor role — show welcome message instead of financial dashboard |

### Previous Story Intelligence

From Story 19.3:
- **Backend permission enforcement is complete** — all controllers have `[Authorize(Policy = "...")]` attributes. The frontend permission service mirrors these restrictions in the UI.
- **DashboardController has `CanAccessExpenses` policy** — Contributors get 403. The frontend must handle this gracefully.
- **`CanViewProperties` allows Contributors** to see property list. `CanManageProperties` is Owner-only (create, edit, delete, detail).
- **`CanViewWorkOrders` allows Contributors** to view work orders. `CanManageWorkOrders` is Owner-only for CUD.
- **`CanAccessReceipts` allows Contributors** for view/upload. `CanProcessReceipts` is Owner-only.

From Story 19.4:
- **`GET /api/v1/account/users`** endpoint exists for Story 19.7's user management UI. Not needed in this story.
- **Role is stored as `ApplicationUser.Role`** string property, not Identity roles.

From Story 19.1:
- **JWT includes `role` claim** — already decoded by `AuthService.decodeToken()` into `User.role` field.
- **The `User` interface** (`auth.service.ts` line 27-33) already has `role: string`.

### Testing Pyramid

- **Unit tests (Vitest):** PermissionService, ownerGuard, SidebarNavComponent (Owner vs Contributor nav items), BottomNavComponent (Owner vs Contributor nav items), PropertiesComponent (Add Property button visibility)
- **Integration tests:** None (no backend changes)
- **E2E tests:** Deferred to Story 19.7 — unit tests provide sufficient coverage for role-based UI logic. E2E testing Contributor behavior requires either JWT manipulation or a real Contributor user, which is better handled when the full user management UI exists.

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.5 requirements and ACs |
| `docs/project/stories/epic-19/19-3-backend-permission-enforcement.md` | Policy-to-permission mapping, controller enforcement map |
| `docs/project/stories/epic-19/19-4-account-user-management-api.md` | Account users API (for future Story 19.7 reference) |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `frontend/src/app/core/services/auth.service.ts` | `User` interface with `role`, `decodeToken()`, signals |
| `frontend/src/app/core/auth/auth.guard.ts` | Pattern for `CanActivateFn` functional guard |
| `frontend/src/app/core/auth/auth.guard.spec.ts` | Pattern for guard unit tests |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` | Current static `navItems` array |
| `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` | Current nav item tests to update |
| `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts` | Current static `navItems` array |
| `frontend/src/app/core/components/bottom-nav/bottom-nav.component.spec.ts` | Current nav item tests to update |
| `frontend/src/app/features/properties/properties.component.ts` | "Add Property" button to conditionally hide |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Dashboard to add Contributor handling |
| `frontend/src/app/app.routes.ts` | Route definitions to apply ownerGuard |
| `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` | Backend permission constants (reference) |
| `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` | Role-to-permission mapping (reference) |
| Angular `CanActivateFn` docs | https://angular.dev/api/router/CanActivateFn |
| Angular computed signals docs | https://angular.dev/guide/signals |
| Angular control flow docs | https://angular.dev/guide/templates/control-flow |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- None required

### Completion Notes List
- Task 1: Created PermissionService with `isOwner`/`isContributor` computed signals and `canAccess()` method. 21 unit tests all pass.
- Task 2: Created ownerGuard as CanActivateFn following authGuard pattern. 4 unit tests pass.
- Task 3: Applied ownerGuard to 18 owner-only routes in app.routes.ts. Dashboard, receipts (list), work-orders, and work-orders/:id remain unguarded for Contributors.
- Task 4: Converted SidebarNavComponent `navItems` from static array to computed signal filtered by role. Owner: 9 items, Contributor: 3 items. Template updated to `navItems()`. 19 tests pass.
- Task 5: Converted BottomNavComponent `navItems` from static array to computed signal. Owner: 5 items, Contributor: 3 items (Dashboard, Receipts, Work Orders). 12 tests pass.
- Task 6: Added `isOwner` computed to PropertiesComponent, wrapped "Add Property" button with `@if (isOwner())`. Added Contributor test verifying button is hidden. 17 tests pass.
- Task 7: Added Contributor dashboard with welcome message and links to Receipts/Work Orders. Effect only loads properties for Owner role. 30 tests pass (6 new Contributor tests).
- Task 8: Covered by Task 1 — 21 comprehensive unit tests for PermissionService.
- Task 9: Full test suite: 112 files, 2649 tests all pass. No regressions.
- Task 10: E2E deferred to Story 19.7 per story spec decision.

### File List

**Created:**
- `frontend/src/app/core/auth/permission.service.ts` — Role-based permission service
- `frontend/src/app/core/auth/permission.service.spec.ts` — 21 unit tests
- `frontend/src/app/core/auth/owner.guard.ts` — Owner-only route guard
- `frontend/src/app/core/auth/owner.guard.spec.ts` — 4 unit tests

**Modified:**
- `frontend/src/app/app.routes.ts` — Added ownerGuard import and applied to 18 owner-only routes
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` — Converted navItems to computed signal filtered by role
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.html` — Updated navItems to navItems() signal invocation
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` — Updated tests for Owner/Contributor role filtering
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.ts` — Added AuthService, converted navItems to computed signal
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.html` — Updated navItems to navItems() signal invocation
- `frontend/src/app/core/components/bottom-nav/bottom-nav.component.spec.ts` — Updated tests for Owner/Contributor role filtering
- `frontend/src/app/features/properties/properties.component.ts` — Added AuthService, isOwner computed, conditional Add Property button
- `frontend/src/app/features/properties/properties.component.spec.ts` — Added Contributor test, AuthService mock
- `frontend/src/app/features/dashboard/dashboard.component.ts` — Added isOwner computed, Contributor dashboard with welcome message, conditional property loading
- `frontend/src/app/features/dashboard/dashboard.component.spec.ts` — Added 6 Contributor dashboard tests
- `docs/project/sprint-status.yaml` — Updated story status to in-progress
- `docs/project/stories/epic-19/19-5-frontend-auth-state-permission-service.md` — Updated status and task completion
