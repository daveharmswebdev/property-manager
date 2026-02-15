# Story 15.1: Login Form Fixes

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user logging into the application,
I want the login form to validate email properly, not show dead UI, and redirect me to where I was going,
so that the login experience is clean and functional.

## Acceptance Criteria

**AC1 — Stricter email validation (GitHub #198):**
Given I enter an email without a TLD (e.g., `user@g`)
When I attempt to submit the login form
Then a field-level validation error appears before the form submits to the server

**AC2 — Remove "Remember me" checkbox (GitHub #199):**
Given I am on the login page
When I view the form
Then there is no "Remember me" checkbox (sessions are already persistent via HttpOnly refresh cookies)

**AC3 — Honor returnUrl after login (GitHub #200):**
Given I am redirected to `/login?returnUrl=%2Fproperties`
When I log in successfully
Then I am redirected to `/properties` (the returnUrl value), not hardcoded `/dashboard`

Given the returnUrl is an absolute URL or external domain
When I log in
Then the returnUrl is rejected and I am redirected to `/dashboard` (open redirect protection)

## Tasks / Subtasks

- [x] Task 1: Add stricter email validation (AC: #1)
  - [x] 1.1: In `login.component.ts` line ~43, add `Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)` to the email field validators array alongside existing `Validators.required` and `Validators.email`
  - [x] 1.2: In `login.component.html`, add a `@if` error block for the pattern error on the email field (e.g., "Please enter a valid email address") — display when `email.hasError('pattern') && !email.hasError('required')`
  - [x] 1.3: Update `login.component.spec.ts` — add test: email like `user@g` should be invalid (pattern error)
  - [x] 1.4: Update `login.component.spec.ts` — add test: email like `user@domain.com` should be valid

- [x] Task 2: Remove "Remember me" checkbox (AC: #2)
  - [x] 2.1: In `login.component.ts` line ~45, remove `rememberMe: [false]` from the form group definition
  - [x] 2.2: In `login.component.html` lines ~42-44, remove the `<mat-checkbox formControlName="rememberMe">Remember me</mat-checkbox>` element
  - [x] 2.3: In `login.component.ts`, remove `MatCheckboxModule` from imports array if present (check if other components in the same file use it — they don't)
  - [x] 2.4: In `login.component.html`, the `.form-options` div currently contains the checkbox and "Forgot password?" link — restructure so "Forgot password?" link remains, positioned right-aligned
  - [x] 2.5: Update `login.component.spec.ts` — remove test "should have rememberMe field defaulting to false" (~line 71-74)
  - [x] 2.6: Update all test form setValue calls to remove `rememberMe: false` from the form value objects (affects ~8 test cases)

- [x] Task 3: Honor returnUrl after login (AC: #3)
  - [x] 3.1: In `login.component.ts`, inject `ActivatedRoute`: `private readonly route = inject(ActivatedRoute);`
  - [x] 3.2: Add import for `ActivatedRoute` from `@angular/router`
  - [x] 3.3: In the `onSubmit()` success handler (~line 63), replace `this.router.navigate(['/dashboard'])` with returnUrl-aware redirect logic
  - [x] 3.4: Implement `returnUrl` sanitization: extract from `this.route.snapshot.queryParamMap.get('returnUrl')`, validate it starts with `/` and does not contain `://` or `//`, fall back to `/dashboard` if invalid or missing
  - [x] 3.5: Use `this.router.navigateByUrl(sanitizedReturnUrl)` instead of `this.router.navigate()`
  - [x] 3.6: Update `login.component.spec.ts` — add test: when returnUrl query param is `/properties`, navigates to `/properties` after login
  - [x] 3.7: Update `login.component.spec.ts` — add test: when returnUrl is absent, navigates to `/dashboard`
  - [x] 3.8: Update `login.component.spec.ts` — add test: when returnUrl is `https://evil.com`, navigates to `/dashboard` (open redirect protection)
  - [x] 3.9: Update `login.component.spec.ts` — add test: when returnUrl is `//evil.com`, navigates to `/dashboard`
  - [x] 3.10: Update the ActivatedRoute mock in beforeEach to support parameterized returnUrl values per test

## Dev Notes

### Current State of Login Component

**File:** `frontend/src/app/features/auth/login/login.component.ts`

The component currently:
- Defines form with 3 controls: `email` (required + Validators.email), `password` (required), `rememberMe` (false)
- On submit, destructures only `{ email, password }` from form value — `rememberMe` is already ignored
- Hardcodes `this.router.navigate(['/dashboard'])` on success (line ~63)
- Does NOT inject `ActivatedRoute` — no access to query params
- Imports: `Router`, `FormBuilder`, `ReactiveFormsModule`, `MatCheckboxModule`, `MatCardModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatProgressSpinnerModule`, `MatIconModule`, `RouterLink`

**File:** `frontend/src/app/features/auth/login/login.component.html`

- Email field uses `<mat-form-field>` with `<input matInput formControlName="email">`
- Error messages displayed via `@if (email.hasError('required'))` and `@if (email.hasError('email'))` blocks
- Remember me checkbox at ~line 42: `<mat-checkbox formControlName="rememberMe">Remember me</mat-checkbox>`
- Checkbox is inside `.form-options` div alongside "Forgot password?" link
- Submit button triggers `onSubmit()` method

**File:** `frontend/src/app/features/auth/login/login.component.scss`

- `.form-options` class uses `display: flex; justify-content: space-between;` — after removing checkbox, the forgot password link should be right-aligned (use `justify-content: flex-end` or similar)

**File:** `frontend/src/app/features/auth/login/login.component.spec.ts`

- ~240 lines, 14 test cases
- ActivatedRoute mocked at line ~29: `{ snapshot: { queryParamMap: { get: () => null } } }`
- Tests `rememberMe` defaults to false (line ~71-74)
- All form setValue calls include `rememberMe: false`
- Navigation test asserts `router.navigate` called with `['/dashboard']`
- Uses `vi.spyOn(router, 'navigate')` — will need to also spy on `router.navigateByUrl` for Task 3

### Auth Guard Context (Already Correct)

**File:** `frontend/src/app/core/auth/auth.guard.ts`

- `authGuard` already captures `returnUrl` correctly (line ~35): passes `state.url` to `createLoginRedirect()`
- `createLoginRedirect()` at line ~48: `router.createUrlTree(['/login'], { queryParams: { returnUrl } })`
- No changes needed to auth guard — the returnUrl is already being passed, just not consumed by login component

### Security: Open Redirect Prevention (Task 3.4)

The `returnUrl` MUST be sanitized to prevent open redirect attacks. Implementation pattern:

```typescript
private getSafeReturnUrl(): string {
  const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  if (!returnUrl) return '/dashboard';
  // Must start with / and not contain protocol indicators
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.includes('://')) {
    return returnUrl;
  }
  return '/dashboard';
}
```

### Project Structure Notes

- All changes are frontend-only, scoped to `frontend/src/app/features/auth/login/`
- No backend changes required
- No new files needed — only modifications to existing login component files
- No new dependencies required
- Alignment with project patterns: uses `inject()` function, ReactiveFormsModule, Angular Material, functional guards

### References

- [Source: epic-15-manual-testing-bug-fixes.md#Story 15.1]
- [Source: GitHub Issue #198 — TC-AUTH-003]
- [Source: GitHub Issue #199 — TC-AUTH-004]
- [Source: GitHub Issue #200 — TC-AUTH-009]
- [Source: frontend/src/app/features/auth/login/login.component.ts — current implementation]
- [Source: frontend/src/app/core/auth/auth.guard.ts — returnUrl already passed via createLoginRedirect]
- [Source: frontend/src/app/core/services/auth.service.ts — no rememberMe support]
- [Source: _bmad-output/project-context.md — Angular patterns, testing rules]

### Git Intelligence

Recent commits show Story 15-4 (UnlinkReceipt fix) was the last completed work. No recent changes to the auth/login feature area. The login component has been stable since Epic 1 (Story 1-4).

### Testing Patterns to Follow

Per project-context.md:
- Spec files co-located: `login.component.spec.ts` alongside `login.component.ts` (already exists)
- `describe/it` blocks with `vi.fn()` for mocks, `vi.spyOn()` for spies
- TestBed configuration in `beforeEach` with service mocks
- Import from `vitest`: `describe, it, expect, beforeEach, vi`
- Run tests: `npm test` from `/frontend`

### Estimated Test Changes

Current test file has ~14 tests across 5 describe blocks. Expected changes:
- **Remove:** 1 test (rememberMe default)
- **Modify:** ~8 tests (remove rememberMe from form setValue calls)
- **Add:** ~5 tests (pattern validation x2, returnUrl redirect x3)
- Final count: ~18 tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- **Task 1 (AC1):** Added `Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)` to email control. Used `{2,}` for TLD length per ATDD test expectations (catches `user@domain.c` edge case). Added `@if` block for pattern error in template. ATDD tests (3) all green.
- **Task 2 (AC2):** Removed `rememberMe` form control, `MatCheckboxModule` import, checkbox from template. Updated `.form-options` SCSS to `flex-end`. Deleted rememberMe test, removed `rememberMe: false` from ~10 setValue calls. ATDD tests (2) green, all existing tests pass.
- **Task 3 (AC3):** Injected `ActivatedRoute`, added `getSafeReturnUrl()` with open redirect protection (rejects `://`, `//`, non-`/` prefixed URLs). Replaced `router.navigate(['/dashboard'])` with `router.navigateByUrl(this.getSafeReturnUrl())`. Added `navigateByUrl` spy to main beforeEach. Updated existing navigation test assertion. ATDD tests (4) all green.
- **Final test suite:** 2309 tests passing, 0 failures, 99 test files.

### Change Log

- 2026-02-15: Implemented all 3 ACs for Story 15-1 (email validation, remove rememberMe, returnUrl redirect)

### File List

- `frontend/src/app/features/auth/login/login.component.ts` — Modified (added pattern validator, removed rememberMe, added ActivatedRoute + getSafeReturnUrl)
- `frontend/src/app/features/auth/login/login.component.html` — Modified (added pattern error @if block, removed checkbox)
- `frontend/src/app/features/auth/login/login.component.scss` — Modified (justify-content: flex-end)
- `frontend/src/app/features/auth/login/login.component.spec.ts` — Modified (removed rememberMe test + references, updated navigation assertion, added navigateByUrl spy; ATDD block pre-existing from TEA agent)
