# Story 23.2: Angular 22 Framework Upgrade (Material Held at 21)

Status: pending

## Story

As the developer,
I want Angular core/cli/compiler-cli/build on 22 and TypeScript on 6.0 — with Angular Material **deliberately held at 21** —
so that the framework upgrade and the implicit OnPush change-detection flip are verifiable in complete isolation from any theming change.

**Depends on:** Story 23.1 (readiness + visual baseline must be on `main` first).

## Acceptance Criteria

1. **Given** the readiness work from Story 23.1 is merged,
   **When** `ng update @angular/core@22 @angular/cli@22` runs and its migration schematics are applied,
   **Then** `@angular/core`, `@angular/common`, `@angular/compiler`, `@angular/compiler-cli`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/animations`, `@angular/build`, and `@angular/cli` are all on `^22.x`, and `typescript` is on `~6.0.x` (satisfying Angular 22's `>=6.0 <6.1` peer range).

2. **Given** `@angular/material@21.2.12` peer-supports `"@angular/core": "^21.0.0 || ^22.0.0"` (verified against the npm registry),
   **When** dependencies are installed,
   **Then** `@angular/material` and `@angular/cdk` **remain on `21.x`**, and `npm ci` resolves cleanly with **no `--legacy-peer-deps` and no `--force`**. If npm demands a peer override, **stop** — the premise of this story's isolation is broken and it must be re-planned, not forced.

3. **Given** all 92 components currently declare no `changeDetection` and therefore silently flip to `ChangeDetectionStrategy.OnPush` under v22,
   **When** the E2E suite runs,
   **Then** it passes with no stale-UI regressions.

4. **Given** the OnPush flip is the single highest-risk change in this epic,
   **When** the audit is performed,
   **Then** each of the **22 components that assign plain (non-signal) fields** receives an explicit, recorded verdict: either
   - **(a)** its template binds **only signals** → safe under OnPush, no change; or
   - **(b)** it binds a plain field that is mutated asynchronously → **explicitly pinned** with `changeDetection: ChangeDetectionStrategy.Default` and a comment naming the specific field and why it cannot be a signal.

   The audit is recorded as a **per-component table** in the Dev Agent Record. **A blanket "all components verified safe" is not an acceptable deliverable** — the whole point is the per-component evidence.

5. **Given** TypeScript 6.0 carries its own breaking changes independent of Angular,
   **When** `npm run build` runs,
   **Then** it completes with **zero errors**. The pre-existing bundle-budget warning (issue #353, currently 585.58 kB vs 575 kB) is acceptable but **must not grow**.

6. **Given** the full test suite,
   **When** `npm test` and the E2E suite run,
   **Then** **2,984+ unit tests pass** and E2E is green — with **no test skipped, deleted, or weakened** to achieve it. A test that must change to accommodate v22 requires a written justification in the Dev Agent Record.

7. **Given** the Dependabot TypeScript ignore rule added in PR #491 (which ignores TS major **and minor** updates because Angular 21 pinned TS to `>=5.9 <6.0`),
   **When** Angular 22 lands on `main`,
   **Then** `.github/dependabot.yml` is updated so TypeScript **minor** updates are permitted again within Angular 22's `>=6.0 <6.1` range, while **major** updates remain ignored (TypeScript 7 is still unsupported by every Angular version).

8. **Given** Dependabot PR #441 ("Bump the angular group across 1 directory with 12 updates"), red since 2026-06-01,
   **When** this story merges,
   **Then** #441 is closed as superseded with a comment pointing at this story.

9. **Given** the visual baseline committed in Story 23.1,
   **When** the visual spec runs against Angular 22 with Material still at 21,
   **Then** it **passes unchanged**. Any visual diff at this stage is a genuine framework-level rendering regression — Material has not moved — and must be investigated, **not re-baselined**.

## Tasks / Subtasks

- [ ] **Task 1: Pre-flight** (AC: #2)
  - [ ] 1.1 Confirm Story 23.1 is merged to `main` and the visual baseline is committed and passing.
  - [ ] 1.2 Re-verify the Material 21 peer range still permits core 22 (it may have been republished):
    ```bash
    curl -s https://registry.npmjs.org/@angular/material/21.2.12 | jq .peerDependencies
    # expect: "@angular/core": "^21.0.0 || ^22.0.0"
    ```
    If this is no longer true, **stop** — the story's isolation premise is void and 23.2/23.3 must be merged into one story.
  - [ ] 1.3 Branch from a green `main`.

- [ ] **Task 2: Run the upgrade** (AC: #1)
  - [ ] 2.1 `cd frontend && ng update @angular/core@22 @angular/cli@22`
  - [ ] 2.2 **Read what the schematics actually did** before running anything else. `ng update` applies automated migrations; review the diff file-by-file. Do not treat it as a black box — a migration that rewrites 92 files deserves to be read.
  - [ ] 2.3 Confirm `typescript` landed on `~6.0.x`. `ng update` should pull it via the peer range; if it did not, set it explicitly.
  - [ ] 2.4 Confirm `@angular/material` and `@angular/cdk` are **still 21.x** and were not swept along.
  - [ ] 2.5 `npm ci` from a clean `node_modules` — must resolve with no peer flags (AC #2).

- [ ] **Task 3: Fix compile-time breakage** (AC: #1, #5)
  - [ ] 3.1 `npm run build`. Work the error list.
  - [ ] 3.2 Expected classes of error, per the v22 CHANGELOG (all **loud**, all compile-time — this is the cheap part):
    - Duplicate `input`/`output`/`model` bindings now throw.
    - Elements matching multiple component selectors now throw.
    - `data-`-prefixed attributes no longer bind inputs/outputs.
    - Template expressions using `in` with variables now throw.
    - `appRef.bootstrap` second argument must be non-nullable.
    - `TitleStrategy.getResolvedTitleForRoute` return type is now strictly `string | undefined`.
  - [ ] 3.3 Confirmed **not applicable** (measured — 0 usages each): `CanMatchFn`/`CanMatch.canMatch`, `provideRoutes()`, `ComponentFactoryResolver`, `ComponentFactory`, `createNgModuleRef`, `ChangeDetectorRef.checkNoChanges`, Hammer.js, `withFetch`, `reportProgress`. Also **not applicable**: `Validators.min/max` string args — all 14 call sites pass numeric literals. If any of these *do* surface, the earlier measurement was wrong: record that, it's a finding.
  - [ ] 3.4 TypeScript 6.0's own breaking changes will surface here too. Fix them properly; do not reach for `any` or `@ts-ignore`.

- [ ] **Task 4: The OnPush audit — the heart of this story** (AC: #3, #4)
  - [ ] 4.1 Enumerate the 22 components that assign plain (non-signal) fields:
    ```bash
    cd frontend/src
    for f in $(grep -rl "@Component" --include="*.ts" . | grep -v spec); do
      grep -qE "^\s*this\.[a-zA-Z_]+\s*=\s*" "$f" && echo "$f"
    done
    ```
  - [ ] 4.2 For **each**, determine whether any plain field is **read in the template**. This is the only question that matters. A plain field that is purely internal bookkeeping is harmless under OnPush; a plain field that is bound *and* assigned from an async continuation goes stale.
  - [ ] 4.3 **Reference case (already analyzed):** `features/work-orders/components/work-order-pdf-preview-dialog/work-order-pdf-preview-dialog.component.ts` has 8 plain assignments and async work, yet is **safe** — its template binds only signals (`isLoading()`, `error()`, `previewUrl()`, `zoomLevel()`, `isPrinting()`), while every plain field (`currentBlobUrl`, `cachedBlob`, `cachedFilename`, `printIframe`, `loadSub`) is private bookkeeping never read by the template. **This is the pattern to confirm across the other 21 — not to assume.**
  - [ ] 4.4 Where a component genuinely needs `Default`, prefer **converting the field to a signal** over pinning to `Default`. Pinning is the escape hatch, not the goal — the codebase is signal-native and should stay that way. Pin only when conversion is disproportionate, and say why.
  - [ ] 4.5 Record the **per-component verdict table** in the Dev Agent Record (AC #4). This table is a required deliverable.
  - [ ] 4.6 Remember the CD context: `app.config.ts` uses `provideZoneChangeDetection({ eventCoalescing: true })` — **zone-based, not zoneless**. Under zone + OnPush, an `await`-continuation assigning a bound plain field does *not* mark the component dirty. That is the exact failure mode being hunted.

- [ ] **Task 5: Verify — the gate** (AC: #3, #5, #6, #9)
  - [ ] 5.1 `cd frontend && npm run build` — zero errors; bundle not larger than 585.58 kB.
  - [ ] 5.2 `cd frontend && npm test` — 2,984+ passing, exit 0.
  - [ ] 5.3 `cd frontend && npx playwright test --workers=1` — full E2E green (`--workers=1` matches CI, per `CLAUDE.md`).
  - [ ] 5.4 **Unit tests are the weak oracle for OnPush.** `TestBed` specs typically call `fixture.detectChanges()` explicitly, which masks exactly the staleness OnPush introduces. **E2E is the real detector here.** If E2E is green and unit tests are green, believe E2E.
  - [ ] 5.5 Run the Story 23.1 visual baseline spec (AC #9). It must pass **unchanged** — Material hasn't moved, so any pixel diff is a real framework rendering regression. **Do not run `--update-snapshots`.**
  - [ ] 5.6 Manual smoke via Playwright MCP: exercise at least one async-heavy flow (receipt upload → process; work-order PDF preview) — these are the flows where an OnPush staleness bug would actually bite. Screenshots to `screenshots/`.

- [ ] **Task 6: Dependabot reconciliation** (AC: #7, #8)
  - [ ] 6.1 Update `.github/dependabot.yml` — relax the TypeScript `ignore` rule from `[semver-major, semver-minor]` to `[semver-major]` only, and update the comment to cite Angular 22's `>=6.0 <6.1` range.
  - [ ] 6.2 Close PR #441 with a comment referencing this story.
  - [ ] 6.3 Confirm no other Dependabot PR is now unblocked-but-stale.

- [ ] **Task 7: Document** (AC: all)
  - [ ] 7.1 Cite exact counts and exit codes in completion notes (project Iron Law: no "done" without a fresh in-turn run).
  - [ ] 7.2 Update `docs/project/sprint-status.yaml`.

## Dev Notes

### The one thing that makes this story possible

`@angular/material@21.2.12` declares `"@angular/core": "^21.0.0 || ^22.0.0"`. Material 21 **explicitly supports Angular core 22**.

Without that, the framework and Material would have to move atomically, and this epic would collapse into one large PR where an OnPush regression and a Material token regression would be indistinguishable. The entire three-story structure rests on one registry lookup.

**Task 1.2 re-verifies it before doing anything.** If the premise has evaporated, the correct response is to re-plan — not to force the install with `--legacy-peer-deps` and hope.

### OnPush: what the evidence says, and what it doesn't

The measured picture is genuinely reassuring:
- 92 components, **0** set `changeDetection` → all 92 flip to OnPush.
- **120 files use signals**, 19 use `@ngrx/signals`.
- **0 templates use `| async`.**
- **0 files call `markForCheck()` or `detectChanges()`.**

Signals notify Angular explicitly and behave identically under OnPush. Zero `| async` and zero `markForCheck` means the classic Default-CD idioms simply are not present.

**But "reassuring" is not "verified."** The evidence supports a *hypothesis*: this codebase keeps template state in signals and internal state in plain fields, which makes OnPush a no-op. One component (`work-order-pdf-preview-dialog`) was read in full and confirms it. **Twenty-one others have not been read.**

Task 4 exists to convert the hypothesis into a per-component fact. Resist the pull to skip it because the aggregate numbers look good — aggregate numbers are exactly how a single stale-UI bug hides in a codebase of 92 components.

### Why unit tests will lie to you here

2,984 unit tests passing will feel like proof. It isn't — not for this specific risk.

Angular `TestBed` specs almost always call `fixture.detectChanges()` explicitly, which forces a check regardless of dirty state. That is precisely the mechanism OnPush changes. A component that goes stale in the browser can pass its unit test cleanly.

**E2E is the oracle for OnPush.** So is the manual Playwright MCP smoke of async-heavy flows (Task 5.6). Weight the evidence accordingly, and say so in the completion notes.

### Read the schematics' diff

`ng update` runs migration schematics that may rewrite many files. It is tempting to trust them and skip to the build. Don't — read the diff. Angular's migrations are good, but they are code changes to *your* codebase, and a reviewer will (rightly) ask what changed. "The tool did it" is not an answer.

### What is NOT in this story

- **No Angular Material.** Material and CDK stay on 21.x. If they move, this story has failed its own premise (AC #2).
- **No zoneless.** Angular 22 makes it viable and this codebase would suit it. Bundling a CD-architecture change with a version bump is the exact mistake this epic is structured to avoid.
- **No opportunistic OnPush tuning.** Components flip by default; pin the ones that need `Default`. Wholesale CD optimization is not this story's job.
- **No theme work.** 23.3.

### Test Scope

| Pyramid Level | Required? | Justification |
|---|---|---|
| **Unit (frontend)** | **YES — must stay green** | 2,984 existing tests are the regression net for the TS 6 upgrade and template-compilation changes. But see "Why unit tests will lie to you" — they are a **weak** oracle for OnPush specifically. |
| **Unit (backend)** | **N/A** | Zero backend code touched. |
| **Integration (backend)** | **N/A** | Same. |
| **E2E (Playwright)** | **YES — the primary gate** | The only reliable detector of OnPush staleness and of the `paramsInheritanceStrategy` behavior pinned in 23.1. Run with `--workers=1` to match CI. |
| **Visual (Playwright snapshot)** | **YES — must pass unchanged** | Material has not moved, so the 23.1 baseline must hold exactly. A diff here is a real framework rendering regression (AC #9). |

### References

| Artifact | Section / Lines |
|----------|-----------------|
| `docs/project/epics-angular-22-migration.md` | Story 23.2; "Why the framework and Material can be split"; exposure table |
| `docs/project/stories/epic-23/23-1-angular-22-readiness-and-visual-baseline.md` | Prerequisite — router pin, template diagnostics, visual baseline |
| `frontend/package.json` | Angular 21.2.14 / Material 21.2.12 / TypeScript ~5.9.2 → targets of this story |
| `frontend/src/app/app.config.ts` | `provideZoneChangeDetection({ eventCoalescing: true })` — zone-based CD, the OnPush hazard context |
| `frontend/src/app/features/work-orders/components/work-order-pdf-preview-dialog/work-order-pdf-preview-dialog.component.ts` | **Reference case** for the OnPush audit — signals in template, plain fields internal only |
| `.github/dependabot.yml` | TypeScript ignore rule added in PR #491 — relaxed by AC #7 |
| GitHub PR #441 | The Dependabot Angular group bump superseded by this story |
| GitHub PR #487 (closed) | TypeScript 7.0.2 — overshot; closed 2026-07-14 |
| GitHub PR #491 (merged) | Batch dependency update; bumped Docker base to `node:26-alpine` (Angular 22 supports Node 26) |
| Angular v22 CHANGELOG | https://github.com/angular/angular/blob/main/CHANGELOG.md — full breaking-change list |
| Angular Update Guide 21→22 | https://angular.dev/update-guide?v=21.0-22.0 |
| `CLAUDE.md` | Verification Before Completion (Iron Law); E2E rules (`--workers=1`) |

## Dev Agent Record

### Agent Model Used

_(populated by /dev-story)_

### Test Plan

_(populated by /dev-story)_

### OnPush Audit — Per-Component Verdicts

_(REQUIRED by AC #4. One row per component that assigns plain non-signal fields (22 expected). A blanket assertion is not acceptable.)_

| Component | Plain fields assigned | Any bound in template? | Verdict | Action |
|---|---|---|---|---|
| `work-order-pdf-preview-dialog` | `currentBlobUrl`, `cachedBlob`, `cachedFilename`, `printIframe`, `loadSub` | **No** — template binds only `isLoading()`, `error()`, `previewUrl()`, `zoomLevel()`, `isPrinting()` | **Safe under OnPush** | None (pre-verified during epic grounding) |
| _(tbd — 21 more)_ | | | | |

### Debug Log References

_(populated by /dev-story)_

### Completion Notes List

_(populated by /dev-story)_

### File List

_(populated by /dev-story)_
