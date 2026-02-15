# ATDD Checklist - Story 15.1: Login Form Fixes

**Date:** 2026-02-15
**Author:** Dave
**Primary Test Level:** Component (Vitest) + E2E (Playwright)

---

## Story Summary

As a user logging into the application, I want the login form to validate email properly, not show dead UI, and redirect me to where I was going, so that the login experience is clean and functional.

**As a** user logging into the application
**I want** proper email validation, no dead UI, and returnUrl redirect
**So that** the login experience is clean and functional

---

## Acceptance Criteria

1. **AC1 — Stricter email validation (GitHub #198):** Email without TLD (e.g., `user@g`) triggers field-level validation error before server submit
2. **AC2 — Remove "Remember me" checkbox (GitHub #199):** No "Remember me" checkbox on login page (sessions use HttpOnly refresh cookies)
3. **AC3 — Honor returnUrl after login (GitHub #200):** Successful login redirects to `returnUrl` if valid relative path, falls back to `/dashboard` for missing/external URLs (open redirect protection)

---

## Failing Tests Created (RED Phase)

### Component Tests (9 tests)

**File:** `frontend/src/app/features/auth/login/login.component.spec.ts` (appended ATDD block)

- **Test:** `AC1: should reject email without TLD (user@g) with pattern error`
  - **Status:** RED — no `Validators.pattern()` on email control
  - **Verifies:** `hasError('pattern')` is true for `user@g`

- **Test:** `AC1: should reject email with single-char TLD (user@domain.c) with pattern error`
  - **Status:** RED — no pattern validator exists
  - **Verifies:** Edge case for 1-char TLD rejection

- **Test:** `AC1: should accept valid email with proper TLD (user@domain.com)`
  - **Status:** GREEN (baseline) — already passes with existing validators
  - **Verifies:** Regression safety for valid emails

- **Test:** `AC2: should not have rememberMe form control`
  - **Status:** RED — `rememberMe` control still exists in form group
  - **Verifies:** `form.get('rememberMe')` returns null

- **Test:** `AC2: should have only email and password controls`
  - **Status:** RED — form has 3 controls, expected 2
  - **Verifies:** Form shape is exactly `['email', 'password']`

- **Test:** `AC3: should navigate to /properties when returnUrl is /properties`
  - **Status:** RED — component uses `router.navigate(['/dashboard'])` not `router.navigateByUrl`
  - **Verifies:** `navigateByUrl` called with `/properties`

- **Test:** `AC3: should navigate to /dashboard when returnUrl is absent`
  - **Status:** RED — component doesn't use `navigateByUrl`
  - **Verifies:** Default fallback to `/dashboard`

- **Test:** `AC3: should navigate to /dashboard when returnUrl is absolute external URL`
  - **Status:** RED — no returnUrl sanitization logic exists
  - **Verifies:** SECURITY — `https://evil.com` rejected, redirects to `/dashboard`

- **Test:** `AC3: should navigate to /dashboard when returnUrl is protocol-relative`
  - **Status:** RED — no returnUrl sanitization logic exists
  - **Verifies:** SECURITY — `//evil.com` rejected, redirects to `/dashboard`

### E2E Tests (4 tests)

**File:** `frontend/e2e/tests/auth/login-fixes.spec.ts` (new file)

- **Test:** `AC1: should show validation error for email without TLD before server submit`
  - **Status:** RED — no `@if (hasError('pattern'))` in template, no pattern validator
  - **Verifies:** mat-error visible after entering `user@g`, no server error triggered

- **Test:** `AC2: should not display Remember me checkbox on login page`
  - **Status:** RED — `<mat-checkbox>` still in template
  - **Verifies:** No mat-checkbox visible, "Forgot password?" link still present

- **Test:** `AC3: should redirect to original destination after login via returnUrl`
  - **Status:** RED — login always navigates to `/dashboard`
  - **Verifies:** Full guard → login → returnUrl redirect flow

- **Test:** `AC3: should redirect to /dashboard when no returnUrl is present`
  - **Status:** GREEN (baseline) — current behavior
  - **Verifies:** Default redirect regression safety

---

## Modifications Required to Existing Tests

The following existing tests in `login.component.spec.ts` must be updated during implementation:

### Tests with `rememberMe` references (after AC2)

| Line(s) | Test | Change |
|----------|------|--------|
| 71-74 | `should have rememberMe field defaulting to false` | **DELETE** entirely |
| 79-83 | `should not call authService when form is invalid` | Remove `rememberMe: false` from setValue |
| 102-106 | `should call authService.login with email and password` | Remove `rememberMe: false` from setValue |
| 117-120 | `should set loading to true during login` | Remove `rememberMe: false` from setValue |
| 137-141 | `should navigate to dashboard on successful login` | Remove `rememberMe: false` from setValue |
| 155-159 | `should clear server error on successful login` | Remove `rememberMe: false` from setValue |
| 175-179 | `should display authentication error on 401 response` | Remove `rememberMe: false` from setValue |
| 193-197 | `should display default auth error message when 401 has no detail` | Remove `rememberMe: false` from setValue |
| 212-216 | `should display validation error on 400 response` | Remove `rememberMe: false` from setValue |
| 230-234 | `should display generic error on unexpected error` | Remove `rememberMe: false` from setValue |
| 248-252 | `should set loading to false after error` | Remove `rememberMe: false` from setValue |

### Navigation test (after AC3)

| Line(s) | Test | Change |
|----------|------|--------|
| 135-147 | `should navigate to dashboard on successful login` | Change to assert `router.navigateByUrl('/dashboard')` instead of `router.navigate(['/dashboard'])` |

**Total modifications:** 1 test deleted, ~11 tests modified

---

## Mock Requirements

No external service mocks needed — all changes are frontend-only:
- Auth API remains unchanged (same login endpoint)
- Auth guard already passes `returnUrl` correctly
- No new backend endpoints required

---

## Required data-testid Attributes

No new `data-testid` attributes required. Tests use existing locators:

### Login Page (existing locators in use)

- `input[formControlName="email"]` — Email input field
- `input[formControlName="password"]` — Password input field
- `button[type="submit"]` — Submit button
- `.server-error` — Server error message container
- `mat-error` (within email mat-form-field) — Field validation error
- `mat-checkbox` — Used to assert ABSENCE of Remember me

---

## Implementation Checklist

### Task 1: Add stricter email validation (AC1)

**Failing tests:** 2 component + 1 E2E

**Tasks to make tests pass:**

- [ ] In `login.component.ts` line ~43, add `Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)` to email validators array
- [ ] In `login.component.html`, add `@if` block for pattern error: `@if (form.get('email')?.hasError('pattern') && !form.get('email')?.hasError('required') && !form.get('email')?.hasError('email') && form.get('email')?.touched)`
- [ ] Display error message: "Please enter a valid email address" (same text as existing email error — combines gracefully)
- [ ] Run tests: `npm test` (from `/frontend`)
- [ ] Verify: AC1 component tests pass, E2E test passes
- [ ] ✅ Tests pass (green phase)

---

### Task 2: Remove "Remember me" checkbox (AC2)

**Failing tests:** 2 component + 1 E2E

**Tasks to make tests pass:**

- [ ] In `login.component.ts` line ~45, remove `rememberMe: [false]` from form group
- [ ] In `login.component.ts`, remove `MatCheckboxModule` from imports array
- [ ] In `login.component.html` lines ~42, remove `<mat-checkbox formControlName="rememberMe">Remember me</mat-checkbox>`
- [ ] In `login.component.html`, keep `.form-options` div with "Forgot password?" link only
- [ ] In `login.component.scss`, change `.form-options` `justify-content` from `space-between` to `flex-end` (right-align the link)
- [ ] **Modify existing tests:** Delete `should have rememberMe field defaulting to false` test
- [ ] **Modify existing tests:** Remove `rememberMe: false` from all `form.setValue()` calls (~10 occurrences)
- [ ] Run tests: `npm test` (from `/frontend`)
- [ ] Verify: AC2 tests pass, ALL existing tests still pass
- [ ] ✅ Tests pass (green phase)

---

### Task 3: Honor returnUrl after login (AC3)

**Failing tests:** 4 component + 1 E2E (1 E2E already green)

**Tasks to make tests pass:**

- [ ] In `login.component.ts`, add import: `ActivatedRoute` from `@angular/router`
- [ ] In `login.component.ts`, inject route: `private readonly route = inject(ActivatedRoute);`
- [ ] Add private method `getSafeReturnUrl()` with sanitization logic:
  ```typescript
  private getSafeReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!returnUrl) return '/dashboard';
    if (returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.includes('://')) {
      return returnUrl;
    }
    return '/dashboard';
  }
  ```
- [ ] In `onSubmit()` success handler, replace `this.router.navigate(['/dashboard'])` with `this.router.navigateByUrl(this.getSafeReturnUrl())`
- [ ] **Modify existing test:** Update `should navigate to dashboard on successful login` to assert `router.navigateByUrl('/dashboard')` instead of `router.navigate(['/dashboard'])`
- [ ] Add `vi.spyOn(router, 'navigateByUrl')` to the main beforeEach block (alongside existing `navigate` spy)
- [ ] Run tests: `npm test` (from `/frontend`)
- [ ] Run E2E: `npm run test:e2e -- --grep "Story 15-1"` (from `/frontend`)
- [ ] Verify: ALL AC3 tests pass, all existing tests still pass
- [ ] ✅ Tests pass (green phase)

---

## Running Tests

```bash
# Run all component tests (from /frontend)
npm test

# Run E2E tests for this story (from /frontend)
npm run test:e2e -- --grep "Story 15-1"

# Run all E2E tests (from /frontend)
npm run test:e2e

# Run E2E in headed mode (see browser)
npm run test:e2e:ui

# IMPORTANT: NEVER use "npx vitest" directly — causes 4GB orphaned processes
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ 9 component tests written (7 failing, 2 green baselines)
- ✅ 4 E2E tests written (3 failing, 1 green baseline)
- ✅ Existing test modification guide documented (1 delete, ~11 modify)
- ✅ Implementation checklist created with clear task ordering
- ✅ No new fixtures/factories needed (story uses existing infrastructure)
- ✅ No mock requirements (frontend-only changes)

**Verification:**

- Tests fail for correct reasons (missing implementation)
- Failure messages are clear and actionable
- No test infrastructure bugs

---

### GREEN Phase (DEV Team - Next Steps)

**Recommended implementation order:**

1. **AC2 first** (Remove rememberMe) — unblocks AC3 tests that omit rememberMe from form
2. **AC1 second** (Pattern validator) — independent, quick win
3. **AC3 last** (returnUrl logic) — depends on AC2 form shape being correct

**DEV Agent Responsibilities:**

1. Pick one failing test from implementation checklist
2. Implement minimal code to make that specific test pass
3. Run `npm test` to verify green
4. Move to next test and repeat

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all 13 new tests pass (9 component + 4 E2E)
2. Verify all ~14 modified existing tests still pass
3. Review returnUrl sanitization for edge cases
4. Ensure SCSS looks clean after checkbox removal

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `npm test` (from `/frontend`)
2. **Begin implementation** using Task ordering: AC2 → AC1 → AC3
3. **Work one test at a time** (red → green for each)
4. **Run E2E after all component tests pass**: `npm run test:e2e -- --grep "Story 15-1"`
5. When all tests pass, update story status to 'in-progress' → 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

- **test-quality.md** — Given-When-Then format, one assertion per test, deterministic assertions
- **selector-resilience.md** — Using formControlName selectors and mat-error locators (framework-native, stable)
- **component-tdd.md** — TestBed setup patterns, TestBed.resetTestingModule for parameterized tests
- **timing-debugging.md** — E2E waitForURL patterns, avoiding race conditions in redirect assertions

---

## Notes

- AC1 pattern regex uses `{2,}` for TLD length to catch edge cases like `user@domain.c` — story only mentions `user@g` but defense in depth applies
- AC3 E2E test relies on auth guard already passing `state.url` as returnUrl (confirmed in `auth.guard.ts` line 35) — no guard changes needed
- The `provideNoopAnimations` deprecation warnings are pre-existing in the test file — outside scope of this story
- **CRITICAL: Never run `npx vitest` directly — always use `npm test` which calls `ng test`**

---

**Generated by BMad TEA Agent** - 2026-02-15
