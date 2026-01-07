# Story 7.1: Mobile Logout Option

Status: review

## Story

As a **user on mobile**,
I want **to log out of the application**,
so that **I can securely end my session from any device**.

## Acceptance Criteria

1. **AC-7.1.1: Logout visible on mobile**
   - **Given** I am logged in on mobile (< 768px viewport)
   - **When** I look at the mobile header
   - **Then** I see a logout icon button accessible from the mobile UI

2. **AC-7.1.2: Logout action works**
   - **Given** I tap the logout icon
   - **When** the action completes
   - **Then** I am logged out and redirected to the login page
   - **And** my session is terminated securely (server-side logout API called)

3. **AC-7.1.3: Loading state during logout**
   - **Given** I tap the logout icon
   - **When** the logout is in progress
   - **Then** I see a spinner replacing the logout icon (matching desktop behavior)

## Tasks / Subtasks

- [x] Task 1: Add logout to mobile header in shell component (AC: #1, #2, #3)
  - [x] 1.1: Inject AuthService and Router into ShellComponent
  - [x] 1.2: Add isLoggingOut signal to ShellComponent
  - [x] 1.3: Add logout() method reusing pattern from sidebar-nav.component.ts
  - [x] 1.4: Update mobile-header toolbar in shell.component.html to include logout icon button
  - [x] 1.5: Style logout button to match year-selector placement (right side of header)

- [x] Task 2: Unit tests (AC: #1, #2, #3)
  - [x] 2.1: Test logout button is visible when showBottomNav() is true
  - [x] 2.2: Test logout() calls AuthService.logout() and navigates to /login
  - [x] 2.3: Test spinner displays when isLoggingOut is true

- [x] Task 3: Manual verification
  - [x] 3.1: Test on mobile viewport (< 768px) - logout visible and functional
  - [x] 3.2: Test on tablet viewport (768-1024px) - uses sidebar logout (unchanged)
  - [x] 3.3: Test on desktop viewport (> 1024px) - uses sidebar logout (unchanged)

## Dev Notes

### Implementation Pattern

The logout logic already exists in `sidebar-nav.component.ts:105-118`. Replicate this exact pattern in the shell component:

```typescript
// From sidebar-nav.component.ts - COPY THIS PATTERN
logout(): void {
  if (this.isLoggingOut()) return;

  this.isLoggingOut.set(true);
  this.authService.logout().subscribe({
    next: () => {
      this.router.navigate(['/login']);
    },
    error: () => {
      // Even on error, redirect to login (local state is cleared)
      this.router.navigate(['/login']);
    },
  });
}
```

### Mobile Header Location

The mobile header is in `shell.component.html:35-42`:

```html
<!-- Mobile Header with Year Selector (AC-3.5.1) -->
@if (showBottomNav()) {
  <mat-toolbar class="mobile-header" color="primary">
    <span class="header-title">Property Manager</span>
    <span class="spacer"></span>
    <app-year-selector class="light-theme" />
    <!-- ADD LOGOUT ICON BUTTON HERE -->
  </mat-toolbar>
}
```

Add logout icon button AFTER the year-selector, matching the right-aligned pattern.

### UI Pattern

Use the same icon button style as the tablet menu toggle button:

```html
<button
  mat-icon-button
  (click)="logout()"
  [disabled]="isLoggingOut()"
  aria-label="Logout"
  data-testid="mobile-logout-button"
>
  @if (isLoggingOut()) {
    <mat-spinner diameter="20"></mat-spinner>
  } @else {
    <mat-icon>logout</mat-icon>
  }
</button>
```

### Required Imports

Add to shell.component.ts imports array:
- `MatProgressSpinnerModule` - for the loading spinner

### Project Structure Notes

- Shell component: `frontend/src/app/core/components/shell/`
- AuthService: `frontend/src/app/core/services/auth.service.ts`
- Existing logout pattern: `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts`

### Testing Standards

- Use Vitest for unit tests
- Test file: `shell.component.spec.ts`
- Use `data-testid="mobile-logout-button"` for E2E test selectors

### References

- [Source: frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts:105-118] - Logout pattern
- [Source: frontend/src/app/core/components/shell/shell.component.html:35-42] - Mobile header
- [Source: frontend/src/app/core/services/auth.service.ts:126-141] - AuthService.logout()
- [Source: _bmad-output/implementation-artifacts/epic-7-bug-fixes.md] - Story requirements
- GitHub Issue: #60

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 654 unit tests passing
- Manual verification performed using Playwright MCP

### Completion Notes List

- Implemented mobile logout button following red-green-refactor TDD cycle
- Added AuthService and Router injection to ShellComponent
- Added isLoggingOut signal for loading state
- Added logout() method reusing exact pattern from sidebar-nav.component.ts
- Added logout icon button to mobile header with spinner loading state
- Added styling for button and spinner to match existing tablet header pattern
- Created 6 new unit tests for mobile logout functionality
- Verified all acceptance criteria via Playwright:
  - AC-7.1.1: Logout icon visible in mobile header ✓
  - AC-7.1.2: Logout action redirects to /login ✓
  - AC-7.1.3: Loading spinner shown during logout ✓
- Tablet and desktop views unchanged (use sidebar logout)

### File List

- `frontend/src/app/core/components/shell/shell.component.ts` (modified)
- `frontend/src/app/core/components/shell/shell.component.html` (modified)
- `frontend/src/app/core/components/shell/shell.component.scss` (modified)
- `frontend/src/app/core/components/shell/shell.component.spec.ts` (modified)
- `frontend/src/app/core/services/auth.service.ts` (modified)
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.ts` (modified)
- `frontend/src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` (modified)
- `frontend/src/app/core/constants/layout.constants.ts` (new)

### Code Review Fixes (2026-01-07)

- **Refactoring**: Centralized logout logic into `AuthService.logoutAndRedirect()` to DRY up code between Shell and Sidebar components.
- **UX**: Added logout button to Tablet header (previously missing).
- **Standards**: Extracted breakpoint constants to `frontend/src/app/core/constants/layout.constants.ts` to avoid magic numbers.
- **Accessibility**: Added `aria-busy` to logout buttons during loading state.
