# Story 23.1: Angular 22 Readiness & Visual Baseline

Status: pending

## Story

As the developer,
I want the codebase to absorb every Angular 22 behavior change that can be pre-empted while still on Angular 21 — and I want a recorded visual baseline of the Upkeep theme —
so that the actual version bump (Story 23.2) changes as little as possible, and so that any theme drift in Story 23.3 is **provable** rather than argued about.

**This story ships entirely on Angular 21. It changes no dependency versions.**

## Acceptance Criteria

1. **Given** `frontend/src/app/app.config.ts` currently calls bare `provideRouter(routes)` (line 14),
   **When** the router is configured,
   **Then** it explicitly declares `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })` — pinning today's behavior so that Angular 22's default flip to `'always'` becomes a **no-op** rather than a silent routing change. A comment cites Story 23.1 and the v22 default change.

2. **Given** Angular 22 promotes the `nullishCoalescingNotNullable` and `optionalChainNotNullable` template diagnostics to build errors,
   **When** both are enabled as `"error"` in `angularCompilerOptions` in `frontend/tsconfig.json`,
   **Then** `npm run build` completes with **zero errors** — every redundant `?.` / `??` applied to a non-nullable expression has been removed from templates. Scope is small: **6 templates use `?.`, 0 use `??`.**

3. **Given** a redundant optional-chain is removed,
   **When** the change is made,
   **Then** it is removed because the expression is **genuinely non-nullable** — not by widening a type, adding `!`, or suppressing the diagnostic. If a diagnostic reveals a *real* nullability bug, fix the bug and note it in the Dev Agent Record.

4. **Given** the Upkeep theme (Epic 8.5) has **no visual regression coverage today**,
   **When** a new Playwright spec `frontend/e2e/tests/visual/theme-baseline.spec.ts` runs,
   **Then** it captures `toHaveScreenshot()` baselines for the themed surfaces:
   - Login page (unauthenticated)
   - Dashboard (authenticated)
   - Property detail
   - Expenses list
   - Work order detail
   - Tenant dashboard (tenant role)
   - Sidebar nav (desktop) and bottom nav (mobile viewport)
   - At least one Material **dialog** and one Material **form** (the densest concentrations of `--mat-*` tokens)

5. **Given** screenshot tests are notoriously flaky,
   **When** the baseline spec runs **twice consecutively** against an unchanged app,
   **Then** it passes both times. Determinism is engineered, not hoped for: animations disabled, fonts confirmed loaded, a fixed viewport, and dynamic content (dates, IDs, currency totals) masked or stabilized. **A flaky baseline is worse than no baseline — it will be ignored exactly when it matters.**

6. **Given** the snapshots are the oracle for Story 23.3,
   **When** they are committed,
   **Then** they are committed to the repo (`e2e/tests/visual/theme-baseline.spec.ts-snapshots/`) and generated on the **same platform CI uses** (Playwright renders differently across OSes) — or the spec is configured to run only where the baseline is valid, with that constraint documented.

7. **Given** the full suite,
   **When** `npm run build`, `npm test`, and the E2E suite run,
   **Then** all pass. This story changes runtime behavior **nowhere**.

## Tasks / Subtasks

- [ ] **Task 1: Pin `paramsInheritanceStrategy` explicitly** (AC: #1)
  - [ ] 1.1 In `frontend/src/app/app.config.ts`, import `withRouterConfig` from `@angular/router`.
  - [ ] 1.2 Change `provideRouter(routes)` to:
    ```ts
    // Story 23.1 — Angular 22 flips the paramsInheritanceStrategy default from
    // 'emptyOnly' to 'always'. Pin today's behavior explicitly so the upgrade
    // in Story 23.2 is a no-op here. Revisit deliberately if param inheritance
    // is ever actually wanted.
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })),
    ```
  - [ ] 1.3 Sanity-check the 13 nested param routes under the `children:` block in `app.routes.ts` (line 52): `properties/:id`, `properties/:id/edit`, `properties/:id/expenses`, `properties/:id/income`, `expenses/:id`, `income/:id`, `receipts/:id`, `vendors/:id`, `vendors/:id/edit`, `work-orders/:id`, `work-orders/:id/edit`, `maintenance-requests/:id`, `tenant/requests/:id`. Confirm E2E still green — behavior must be unchanged.

- [ ] **Task 2: Enable the two template diagnostics** (AC: #2, #3)
  - [ ] 2.1 In `frontend/tsconfig.json`, add to `angularCompilerOptions` (which already sets `strictTemplates: true`):
    ```json
    "nullishCoalescingNotNullable": "error",
    "optionalChainNotNullable": "error"
    ```
  - [ ] 2.2 Run `npm run build`. Fix each reported site.
  - [ ] 2.3 For each fix, confirm the expression is genuinely non-nullable. **Do not** silence with `!`, do not widen the type, do not downgrade the diagnostic to `"warning"`. If a diagnostic exposes a real nullability bug, fix it and record it (AC #3).
  - [ ] 2.4 Only 6 templates use `?.` and none use `??`, so expect a handful of sites at most. If the count balloons, stop and reassess — that would mean the diagnostic is finding something real.

- [ ] **Task 3: Build the visual baseline spec** (AC: #4, #5, #6)
  - [ ] 3.1 Create `frontend/e2e/tests/visual/theme-baseline.spec.ts`.
  - [ ] 3.2 Reuse the existing page objects in `e2e/pages/` (21 of them — `login.page.ts`, `dashboard.page.ts`, `property-detail.page.ts`, `expense-workspace.page.ts`, `work-order-detail.page.ts`, `tenant-dashboard.page.ts`, …) and `e2e/helpers/auth.helper.ts` for login. **Do not hand-roll new selectors** — the page objects are the project's convention.
  - [ ] 3.3 Engineer determinism (AC #5):
    - Disable animations globally for the spec. Playwright's `toHaveScreenshot()` accepts `animations: 'disabled'`; also consider a `prefers-reduced-motion` emulation or a CSS override injected via `page.addStyleTag()`.
    - Wait for fonts: `await page.evaluate(() => document.fonts.ready)` — Inter is loaded via the theme and a race here is a classic snapshot flake.
    - Pin the viewport explicitly per screenshot (desktop for sidebar, mobile for bottom nav).
    - **Mask dynamic content** with the `mask:` option — dates, currency totals, generated IDs, "recent" lists. Anything seeded data can change will otherwise fail the baseline for reasons that have nothing to do with theming.
  - [ ] 3.4 Cover a Material **dialog** and a Material **form** explicitly — per the epic's grounding, 40 SCSS files reference `--mat-*` / `--mdc-*` tokens, and dialogs/form-fields are where those concentrate. These are the highest-value screenshots in the set.
  - [ ] 3.5 Respect the project's E2E rules (`CLAUDE.md`): tests share one database and the `claude@claude.com` account, so **never assume seed-data counts**. Use `page.route()` interception if a screenshot needs a specific data shape, or mask the varying region.
  - [ ] 3.6 Generate the baselines and commit the `-snapshots/` directory.

- [ ] **Task 4: Prove the baseline is stable** (AC: #5)
  - [ ] 4.1 Run the visual spec twice in a row with **no code changes** — `npx playwright test e2e/tests/visual --workers=1`, twice. Both runs must pass.
  - [ ] 4.2 If any screenshot flakes, fix the *determinism*, not the tolerance. Do not paper over flake by raising `maxDiffPixels` — a loose threshold defeats the entire purpose of the baseline, which is to catch subtle Material token drift in Story 23.3.
  - [ ] 4.3 Record in the Dev Agent Record: which surfaces are covered, what is masked, and what the diff tolerance is.

- [ ] **Task 5: Platform consistency for snapshots** (AC: #6)
  - [ ] 5.1 Determine where the baseline will be authoritative. Playwright screenshots differ across OS (font rasterization). CI runs `ubuntu-latest`; local dev is macOS (darwin).
  - [ ] 5.2 Choose one and document it. Recommended: generate baselines **in Docker/CI-matching Linux** so CI is the source of truth, OR scope the visual spec to a dedicated Playwright project that is skipped in CI and run locally only for the 23.3 comparison. **Either is defensible; an undocumented mismatch is not** — it produces a spec that fails on every CI run and gets disabled within a week.
  - [ ] 5.3 Wire the decision into `playwright.config.ts` (currently: chromium-only, `testDir: './e2e'`, `workers: 1` in CI).

- [ ] **Task 6: Verify** (AC: #7)
  - [ ] 6.1 `cd frontend && npm run build` — zero errors.
  - [ ] 6.2 `cd frontend && npm test` — 2,984+ passing.
  - [ ] 6.3 `cd frontend && npx playwright test --workers=1` — full E2E green, including the new visual spec.
  - [ ] 6.4 Cite counts and exit codes in the completion notes (project Iron Law: no "done" without a fresh run in-turn).

## Dev Notes

### Why this story exists at all

The instinct with a framework major is to just run `ng update` and fix what breaks. That works, but it produces one enormous PR where a routing behavior change, a change-detection strategy change, a TypeScript major, and a Material theming change are all entangled — and when something looks subtly wrong, you cannot tell which one did it.

This story pulls **everything that can be done on Angular 21** out of that PR. After it lands, Story 23.2's diff is purely "the version numbers moved."

The visual baseline is the load-bearing piece. Angular Material majors drift design tokens; **nothing fails a test when they do**. Without a recorded "before," Story 23.3's success criterion degrades to "Dave squints at it and it seems fine." With one, it's a diff.

**You cannot capture a baseline after you've already changed the thing.** That's why this is Story 23.1 and not part of 23.3.

### Router: what actually changes in v22

Angular 22 flips `paramsInheritanceStrategy` from `'emptyOnly'` to `'always'`. With `'always'`, child routes inherit parent route **params and data** even when the parent has no params of its own.

`app.routes.ts` has a `children:` block (line 52) containing 13 param routes. The parent is the authenticated shell layout. Practically, the risk here is modest — but "modest" is not "zero," and pinning it costs one line. The point of this story is to convert a silent unknown into an explicit, reviewable declaration.

If param inheritance later turns out to be *desirable*, flip it deliberately in its own change, with its own test.

### Template diagnostics: keep them honest

`tsconfig.json` already sets `strictTemplates: true` but not the two nullability diagnostics. Angular 22 turns them on as errors.

The trap: the fastest way to make these errors go away is `!` (non-null assertion) or loosening a type. **Both are silent lies** — they suppress the diagnostic without establishing the fact it was asserting. If `foo?.bar` is flagged, it means the compiler already knows `foo` is non-nullable; the correct fix is to delete the `?.`. If the compiler is *wrong* about that, you have found a real bug, and that is a finding worth recording, not erasing.

Scope is genuinely small (6 templates with `?.`, 0 with `??`), so there is no excuse for shortcuts here.

### Visual baseline: determinism is the whole job

A screenshot test that flakes is worse than no screenshot test, because it trains you to ignore it — and it will be ignored precisely when Material 22 subtly shifts a button's padding.

Sources of flake, all of which must be engineered out:
- **Animations** — Material transitions mid-capture. Disable them.
- **Fonts** — Inter loads async. A capture before `document.fonts.ready` renders in a fallback face. Classic, and it looks exactly like a "theme regression."
- **Dynamic data** — this project's E2E tests share one database and the `claude@claude.com` account (see `CLAUDE.md`), and earlier specs leave properties/expenses behind. Any screenshot showing counts, totals, dates, or "recent" lists **will** drift. Mask them.
- **Viewport** — pin it per shot.
- **Platform** — macOS and Linux rasterize fonts differently. Pick one home for the baseline (Task 5).

Do **not** compensate for flake by loosening `maxDiffPixels`/`threshold`. A tolerance wide enough to swallow flake is wide enough to swallow the token drift you're trying to catch.

### What is NOT in this story

- **No dependency version changes.** Not one. If `package.json` versions move, this story has failed its own premise.
- **No `changeDetection` annotations.** The OnPush audit belongs to 23.2, where it can be verified against the actual v22 behavior.
- **No Material work.** That's 23.3.

### Test Scope

Per `feedback_testing_pyramid` (full-stack stories require unit + integration + E2E) — but this story is frontend-only and behavior-preserving:

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit (frontend)** | **Existing suite must stay green** | No new units introduced. The router config change and template edits are covered by the existing 2,984 tests. |
| **Unit (backend)** | **N/A** | Story touches zero backend code. |
| **Integration (backend)** | **N/A** | Same. |
| **E2E (Playwright)** | **YES — this story's primary deliverable** | The visual baseline spec *is* new E2E surface. Additionally, the existing E2E suite is the regression gate for the `paramsInheritanceStrategy` pin (AC #1) — routing behavior is exactly what E2E is for. |

### References

| Artifact | Section / Lines |
|----------|-----------------|
| `docs/project/epics-angular-22-migration.md` | Story 23.1 — full AC and grounding table |
| `frontend/src/app/app.config.ts` | Line 14 — `provideRouter(routes)` to be extended |
| `frontend/src/app/app.routes.ts` | Line 52 — `children:` block; 13 nested `:id` routes |
| `frontend/tsconfig.json` | `angularCompilerOptions` — already `strictTemplates: true`; add the two diagnostics |
| `frontend/playwright.config.ts` | chromium-only, `testDir: './e2e'`, CI `workers: 1`, `retries: 2` |
| `frontend/e2e/pages/` | 21 page objects — **reuse, do not hand-roll selectors** |
| `frontend/e2e/helpers/auth.helper.ts` | Login helper for authenticated screenshots |
| `frontend/e2e/helpers/tenant.helper.ts` | Tenant-role setup for the tenant-dashboard screenshot |
| `frontend/src/styles.scss` | `mat.theme()` M3 mixin — the theme under test |
| `frontend/src/styles/_theme-colors.scss` | Generated palette (Upkeep Blue `#4361ee`, Teal `#0d9488`) |
| `CLAUDE.md` | E2E Testing Rules — shared DB, never assume seed counts, `page.route()` interception |
| `docs/project/ux-design-specification.md` | Section 3.1 Color System — what the baseline is protecting |
| Angular v22 CHANGELOG | https://github.com/angular/angular/blob/main/CHANGELOG.md — `paramsInheritanceStrategy` default change; template diagnostics |
| Angular compiler options reference | https://angular.dev/reference/configs/angular-compiler-options — `nullishCoalescingNotNullable`, `optionalChainNotNullable` |
| Playwright visual comparisons | https://playwright.dev/docs/test-snapshots — `toHaveScreenshot()`, `mask`, `animations: 'disabled'` |

## Dev Agent Record

### Agent Model Used

_(populated by /dev-story)_

### Test Plan

_(populated by /dev-story)_

### Debug Log References

_(populated by /dev-story)_

### Completion Notes List

_(populated by /dev-story)_

### Visual Baseline Manifest

_(populated during implementation — REQUIRED by AC #5/#6. Record: each surface covered, viewport, what is masked and why, diff tolerance, and the platform the baseline was generated on.)_

| Surface | Viewport | Masked regions | Notes |
|---|---|---|---|
| _(tbd)_ | | | |

### File List

_(populated by /dev-story)_
