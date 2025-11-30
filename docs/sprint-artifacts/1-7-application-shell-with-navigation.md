# Story 1.7: Application Shell with Navigation

Status: drafted

## Story

As a logged-in user,
I want to see the main application layout with navigation,
so that I can access different sections of the app.

## Acceptance Criteria

1. **AC7.1**: Dark Sidebar Navigation (Desktop ≥1024px):
   - Sidebar visible on left side with dark theme
   - Forest Green primary color (#66BB6A) for accents and active states
   - Navigation items displayed as list:
     - Dashboard (active by default, first item)
     - Properties
     - Expenses
     - Income
     - Receipts (with placeholder badge count)
     - Reports
     - Settings
   - Active nav item has background highlight + left border accent
   - Clicking nav item navigates to corresponding route

2. **AC7.2**: User Profile Section:
   - User email or name displayed in sidebar footer
   - Logout option visible and accessible
   - Clicking logout triggers the logout flow (from Story 1.5)

3. **AC7.3**: Main Content Area:
   - Light background (#FAFAFA off-white per UX spec)
   - Content area displays placeholder "Dashboard coming soon" initially
   - Responsive content area that adjusts to sidebar

4. **AC7.4**: Forest Green Theme Application:
   - Custom Angular Material theme with Forest Green (#66BB6A) as primary
   - Primary Dark: #4CAF50 for hover/emphasis
   - Accent: Warm Orange #FFA726
   - Typography using system fonts as per UX spec
   - Softer elevation shadows for friendly feel

5. **AC7.5**: Mobile Responsive Navigation (<768px):
   - Bottom tab navigation bar instead of sidebar
   - Nav items: Dashboard, Properties, Expenses, Income, Receipts
   - FAB (Floating Action Button) for quick actions (placeholder)
   - Sidebar hidden on mobile

6. **AC7.6**: Auth Guard Protection:
   - All routes except `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` protected
   - Unauthenticated users redirected to `/login`
   - After login, user redirected to `/dashboard`

7. **AC7.7**: Route Structure:
   - `/` redirects to `/dashboard`
   - `/dashboard` - Main dashboard view
   - `/properties` - Properties list (placeholder)
   - `/expenses` - Expenses view (placeholder)
   - `/income` - Income view (placeholder)
   - `/receipts` - Receipts queue (placeholder)
   - `/reports` - Tax reports (placeholder)
   - `/settings` - User settings (placeholder)

8. **AC7.8**: Loading and Error States:
   - Skeleton screen shown while checking auth status
   - Graceful handling if user data fetch fails
   - No flash of unauthenticated content on protected routes

## Tasks / Subtasks

- [ ] Task 1: Angular Material Theme Configuration (AC: 7.4)
  - [ ] Create custom Forest Green theme in `src/styles/theme.scss`
  - [ ] Configure primary palette (#66BB6A, #4CAF50)
  - [ ] Configure accent palette (#FFA726 warm orange)
  - [ ] Apply softer elevation shadows (per UX spec)
  - [ ] Configure typography with system fonts
  - [ ] Import theme in root styles

- [ ] Task 2: Create Shell Layout Component (AC: 7.1, 7.3)
  - [ ] Create `ShellComponent` as main layout wrapper
  - [ ] Implement `mat-sidenav-container` with dark sidebar
  - [ ] Create navigation list with all menu items
  - [ ] Style active nav item with highlight + left border
  - [ ] Add router outlet for content area
  - [ ] Style content area with light background

- [ ] Task 3: Implement Sidebar Navigation (AC: 7.1, 7.2)
  - [ ] Create `SidebarNavComponent` with navigation links
  - [ ] Add icons for each nav item using `mat-icon`
  - [ ] Implement active state detection using `routerLinkActive`
  - [ ] Add Receipts badge placeholder (count=0)
  - [ ] Add user profile section in footer
  - [ ] Display user email from auth state
  - [ ] Add logout button with icon
  - [ ] Wire logout to auth service

- [ ] Task 4: Mobile Bottom Navigation (AC: 7.5)
  - [ ] Create `BottomNavComponent` for mobile view
  - [ ] Implement bottom tab bar with 5 items
  - [ ] Show only on mobile (<768px) via CSS/breakpoint
  - [ ] Hide sidebar on mobile
  - [ ] Add FAB placeholder for future quick actions
  - [ ] Ensure touch-friendly tap targets (min 44px)

- [ ] Task 5: Route Configuration (AC: 7.6, 7.7)
  - [ ] Update `app.routes.ts` with all routes
  - [ ] Configure redirect from `/` to `/dashboard`
  - [ ] Create placeholder components for each route
  - [ ] Apply `authGuard` to all protected routes
  - [ ] Configure public routes (login, register, forgot, reset, verify)

- [ ] Task 6: Auth Guard Enhancement (AC: 7.6, 7.8)
  - [ ] Review existing `auth.guard.ts`
  - [ ] Ensure redirect to `/login` for unauthenticated users
  - [ ] Store intended URL for post-login redirect
  - [ ] Implement loading state while checking auth
  - [ ] Prevent flash of content on protected routes

- [ ] Task 7: Placeholder Dashboard Component (AC: 7.3)
  - [ ] Create `DashboardComponent` with placeholder content
  - [ ] Display "Dashboard coming soon" message
  - [ ] Apply proper styling consistent with theme
  - [ ] Prepare structure for future stats bar and property list

- [ ] Task 8: Responsive Design Implementation (AC: 7.1, 7.5)
  - [ ] Define breakpoints: Desktop ≥1024px, Tablet 768-1023px, Mobile <768px
  - [ ] Implement sidebar visibility rules
  - [ ] Implement bottom nav visibility rules
  - [ ] Test layout at all breakpoints
  - [ ] Ensure smooth transitions between breakpoints

- [ ] Task 9: Integration Testing (AC: All)
  - [ ] Test authenticated user sees shell with navigation
  - [ ] Test unauthenticated user redirected to login
  - [ ] Test navigation between routes works
  - [ ] Test logout clears session and redirects
  - [ ] Test mobile responsive layout
  - [ ] Manual smoke test checklist completion

## Dev Notes

### Architecture Patterns and Constraints

This story establishes the authenticated application shell that wraps all protected content. It follows the Design Direction chosen in the UX Design Specification: "Direction 3 - Compact List View with Dark Sidebar".

**Technology Stack:**
- Angular 21 with Angular Material
- @ngrx/signals for state management (auth state)
- Angular Material mat-sidenav for layout
- CSS media queries for responsive design

**Key UX Decisions (from UX Spec):**
- Dark sidebar feels "app-like" and professional
- Desktop-optimized for 80% desktop workflow
- Bottom tab bar on mobile for thumb-friendly navigation
- FAB for quick mobile actions (receipt capture in Epic 5)

**Color System (from UX Spec Section 3.1):**
| Role | Color | Hex |
|------|-------|-----|
| Primary | Forest Green | #66BB6A |
| Primary Dark | Deep Green | #4CAF50 |
| Primary Light | Mint | #A5D6A7 |
| Accent | Warm Orange | #FFA726 |
| Background | Off-White | #FAFAFA |
| Surface | White | #FFFFFF |
| Text Primary | Dark Forest | #33691E |

**Breakpoints (from UX Spec Section 8.1):**
- Desktop: ≥1024px - Sidebar + content area
- Tablet: 768-1023px - Collapsible sidebar, full content
- Mobile: <768px - Bottom nav, stacked layouts

### Project Structure Notes

Files to create/modify:

```
frontend/src/
├── styles/
│   └── theme.scss                    # NEW: Custom Angular Material theme
├── app/
│   ├── app.component.ts              # MODIFY: Add shell wrapper
│   ├── app.component.html            # MODIFY: Add shell layout
│   ├── app.routes.ts                 # MODIFY: Add all routes
│   ├── core/
│   │   ├── auth/
│   │   │   └── auth.guard.ts         # MODIFY: Enhance guard
│   │   └── components/
│   │       ├── shell/
│   │       │   ├── shell.component.ts       # NEW: Main layout wrapper
│   │       │   ├── shell.component.html
│   │       │   └── shell.component.scss
│   │       ├── sidebar-nav/
│   │       │   ├── sidebar-nav.component.ts # NEW: Desktop sidebar
│   │       │   ├── sidebar-nav.component.html
│   │       │   └── sidebar-nav.component.scss
│   │       └── bottom-nav/
│   │           ├── bottom-nav.component.ts  # NEW: Mobile nav
│   │           ├── bottom-nav.component.html
│   │           └── bottom-nav.component.scss
│   └── features/
│       └── dashboard/
│           ├── dashboard.component.ts       # NEW: Placeholder
│           └── dashboard.component.html
```

### Learnings from Previous Story

**From Story 1-6-password-reset-flow (Status: done)**

- **AuthService Available**: Use existing `auth.service.ts` for user state and logout
- **Auth Guard Pattern**: Existing `auth.guard.ts` can be enhanced for shell protection
- **Cookie-based Auth**: JWT in HttpOnly cookie - auto-sent with requests
- **Integration Test Pattern**: Use same `PropertyManagerWebApplicationFactory` approach
- **Routes Established**: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` already exist

**Files to REUSE (NOT recreate):**
- `auth.service.ts` - use for user email display, logout method
- `auth.guard.ts` - enhance for redirect behavior
- Existing auth routes and components

[Source: docs/sprint-artifacts/1-6-password-reset-flow.md#Dev-Agent-Record]

### Testing Strategy

**Component Tests (Vitest):**
- `ShellComponent` - renders sidebar/bottom nav based on viewport
- `SidebarNavComponent` - displays items, highlights active, shows user
- `BottomNavComponent` - renders on mobile only
- `DashboardComponent` - renders placeholder

**E2E Tests (Playwright):**
- Auth guard redirect flow
- Navigation between routes
- Mobile responsive behavior
- Logout from sidebar

**Manual Smoke Test:**
```markdown
## Application Shell Smoke Test
- [ ] Login with valid credentials
- [ ] Verify dark sidebar visible on desktop
- [ ] Verify all 7 nav items present (Dashboard, Properties, Expenses, Income, Receipts, Reports, Settings)
- [ ] Verify Dashboard highlighted as active
- [ ] Click Properties - verify navigation and highlight change
- [ ] Verify user email shown in sidebar footer
- [ ] Click logout - verify redirect to login
- [ ] Try accessing /dashboard without login - redirected to /login
- [ ] Resize to mobile (<768px)
- [ ] Verify bottom nav visible, sidebar hidden
- [ ] Verify bottom nav items clickable
- [ ] Verify Forest Green theme colors throughout
```

### References

- [Source: docs/ux-design-specification.md#Section 4 Design Direction] - Layout decisions
- [Source: docs/ux-design-specification.md#Section 3.1 Color System] - Color palette
- [Source: docs/ux-design-specification.md#Section 8.1 Responsive Strategy] - Breakpoints
- [Source: docs/architecture.md#Frontend Structure] - Component organization
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC7: Application Shell] - Acceptance criteria
- [Source: docs/epics.md#Story 1.7] - Epic-level story definition

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Initial story draft created | SM Agent (Create Story Workflow) |
