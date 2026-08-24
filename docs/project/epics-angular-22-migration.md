# Angular 22 Migration - Epic Breakdown

**Author:** Dave
**Date:** 2026-07-14
**Version:** 1.0
**Source PRD:** This document (mini-epic, no separate PRD)

---

## Overview

This document defines a focused mini-epic to move the frontend from **Angular 21.2 → Angular 22**, unblocking the TypeScript upgrade path and clearing a Dependabot PR (#441) that has been red since 2026-06-01.

Dependabot **structurally cannot** land this on its own. Angular 22's `@angular/build` peer-depends on `typescript >=6.0 <6.1`, but Dependabot files TypeScript as a *separate* PR — and its TypeScript PR (#487, now closed) overshot to 7.0.2, which no Angular version accepts. The framework and its TypeScript peer must move together, by hand.

**This epic is also the teaching vehicle** for demonstrating agentic development technique (investigation → verification gates → visual verification). The three stories were chosen so that each exercises a *different* technique rather than three rounds of the same one.

### Grounding: measured exposure, not assumed

Before scoping, the codebase was mechanically measured against the Angular 22 breaking-change list ([CHANGELOG v22.0.0](https://github.com/angular/angular/blob/main/CHANGELOG.md)). Findings:

| v22 Breaking Change | Exposure in this codebase | Risk |
|---|---|---|
| Components with undefined `changeDetection` default to **OnPush** | **92 components, 0 set `changeDetection`** → all 92 flip | **The headline risk** — see below |
| `paramsInheritanceStrategy` defaults to `'always'` (was `'emptyOnly'`) | `app.config.ts` calls bare `provideRouter(routes)` — no `withRouterConfig` | **Real** — silent routing behavior change |
| TypeScript `<6.0` unsupported | On `typescript ~5.9.2` | **Blocking** — forces the TS bump |
| Nullish-coalescing / optional-chain template diagnostics now error | `tsconfig.json` sets `strictTemplates: true`, does **not** set the two diagnostics | **Loud** — compile-time, cheap |
| `Validators.min/max` reject string args | 14 call sites, **all numeric literals** (`Validators.min(0.01)`, `Validators.max(9999999.99)`) | **None** |
| `CanMatchFn` requires `currentSnapshot` | 0 usages | **None** |
| `provideRoutes()` removed | 0 usages | **None** |
| `ComponentFactoryResolver` / `createNgModuleRef` / `checkNoChanges` removed | 0 usages | **None** |
| Hammer.js integration removed | 0 usages | **None** |
| `withFetch` / `reportProgress` deprecated | 0 usages | **None** |

### Why the OnPush flip is lower-risk than it looks

All 92 components silently switching to `OnPush` sounds alarming. It probably isn't, and the evidence is specific:

- **120 files use signals**, 19 use `@ngrx/signals` stores.
- **0 templates use the `| async` pipe.**
- **0 files call `markForCheck()` or `detectChanges()`.**

Signals notify Angular explicitly, so they behave *identically* under `OnPush`. The classic OnPush breakage patterns are absent.

The one genuine hazard: the app runs **zone-based** change detection (`provideZoneChangeDetection({ eventCoalescing: true })` in `app.config.ts`), so under `OnPush` a component that assigns a **plain, non-signal field from an async continuation** goes stale — zone triggers CD, but OnPush skips the component unless it's marked dirty.

22 of 92 components do plain-field assignment. **Spot-checking the worst offender falsified the hazard.** `work-order-pdf-preview-dialog.component.ts` (8 plain assignments + async) binds *only* signals in its template (`isLoading()`, `error()`, `previewUrl()`, `zoomLevel()`, `isPrinting()`); every plain field (`currentBlobUrl`, `cachedBlob`, `cachedFilename`, `printIframe`, `loadSub`) is private internal bookkeeping never read by the template.

The codebase follows a consistent discipline: **template state is signals, internal state is plain fields.** That is precisely the pattern that makes `OnPush` a no-op. Story 23.2 must *verify* this holds across all 92 — not assume it.

### Why the framework and Material can be split

The obvious objection to a 3-story split is that Material 22 requires Angular core `^22`, so surely they must move atomically. **Checking the registry disproves this:**

```
@angular/material@21.2.12  peerDependencies: { "@angular/core": "^21.0.0 || ^22.0.0", ... }
@angular/material@22.0.4   peerDependencies: { "@angular/core": "^22.0.0 || ^23.0.0", ... }
```

Material **21 explicitly supports Angular core 22**. So the framework can move to 22 while Material is held at 21, and Material follows in a separate, independently-shippable story. This isolates the framework upgrade (and the OnPush flip) from theming — so if something breaks, you know which half caused it.

*This check is itself the lesson: verify the constraint before you design around it.*

### Material risk (Story 23.3)

The theme is M3, applied via the `mat.theme()` mixin in `src/styles.scss`, with `src/styles/_theme-colors.scss` **generated** by `ng generate @angular/material:theme-color` (Upkeep Blue `#4361ee` / Teal `#0d9488`, per Epic 8.5).

Structural coupling to Material internals is **low** — only 2 files use `::ng-deep`, only 2 target `.mat-mdc-*` classes. But **40 files reference Material's `--mat-*` / `--mdc-*` design tokens**, and token renames are exactly what Material majors do. Nothing here fails a test; the app just looks subtly wrong. There is **no visual regression coverage today** — which is why Story 23.1 establishes a baseline *before* anything moves.

---

## Epic Summary

| Epic | Name | Stories | Description |
|------|------|---------|-------------|
| 23 | Angular 22 Migration | 3 | Readiness + visual baseline, framework upgrade (Material held), Material 22 + theme reconciliation |

---

## Functional Requirements Coverage

This is a technical migration epic; it delivers no new user-facing functionality. Requirements are expressed as migration requirements (MR) and non-functional requirements.

| MR | Description | Story |
|----|-------------|-------|
| MR-A22-1 | Router param-inheritance behavior is pinned explicitly, so v22's default change is a no-op | 23.1 |
| MR-A22-2 | Template diagnostics that v22 promotes to errors are cleared while still warnings | 23.1 |
| MR-A22-3 | A visual baseline of themed surfaces exists before any dependency moves | 23.1 |
| MR-A22-4 | Angular framework (core, cli, compiler-cli, build) runs at 22.x | 23.2 |
| MR-A22-5 | TypeScript runs at 6.0.x, satisfying Angular 22's peer range | 23.2 |
| MR-A22-6 | All 92 components behave correctly under the implicit OnPush default | 23.2 |
| MR-A22-7 | Angular Material + CDK run at 22.x | 23.3 |
| MR-A22-8 | The Upkeep theme renders identically to the 23.1 baseline (or drift is deliberate and documented) | 23.3 |

| NFR | Description | Story |
|-----|-------------|-------|
| NFR-A22-1 | No regression: full test suite (2,984 frontend unit + E2E) green at every story boundary | 23.1, 23.2, 23.3 |
| NFR-A22-2 | Each story is independently shippable and independently revertible | all |
| NFR-A22-3 | Dependabot's TypeScript ignore rule is lifted only once Angular 22 lands | 23.2 |
| NFR-A22-4 | Bundle size does not regress beyond the existing budget overage (issue #353) | 23.2, 23.3 |

---

## Epic 23: Angular 22 Migration

### Objective

Move the frontend to Angular 22 in three independently-shippable steps, isolating the framework upgrade from the theming upgrade so that any regression is attributable to one or the other. Establish visual regression coverage as a durable side benefit.

### Dependency Chain

```
23.1 (Readiness + baseline, ships on Angular 21)
        │
        ▼
23.2 (Framework → 22, TS → 6.0, Material HELD at 21)
        │
        ▼
23.3 (Material → 22, theme reconciled against 23.1 baseline)
```

Strictly sequential. Each story leaves `main` green and shippable.

### Out of Scope (Deliberate)

- **Zoneless change detection.** Angular 22 makes zoneless viable, and this codebase's signal discipline would suit it. But bundling a CD-architecture change with a version bump is exactly the mistake this epic is structured to avoid. Separate epic, if ever.
- **Opting into `OnPush` deliberately.** After 23.2, all components run OnPush *by default*. If a component turns out to need `Default`, 23.2 pins it explicitly. Wholesale CD tuning is not this epic's job.
- **Angular 23.** Lands ~Nov 2026. Take majors one at a time.
- **Issue #353 (bundle budget).** Tracked separately; this epic only asserts *no further regression*.
- **TypeScript 7.** No Angular version supports it. The Dependabot ignore rule added in PR #491 stays until Angular ships support.

### Teaching Notes (intern demo)

Each story deliberately showcases a different agentic technique:

| Story | Technique on display |
|---|---|
| **23.1** | **Investigation before code.** Ref MCP for authoritative docs; mechanical exposure analysis (grep the breaking-change list against the codebase); falsifying your own hypothesis by reading the worst-case file; capturing a baseline so the "after" is provable. |
| **23.2** | **Verification gates.** Let the compiler and 2,984 tests do the work. Read failures, don't predict them. The Iron Law from `CLAUDE.md`: no "done" without a fresh command run and its output. |
| **23.3** | **Verifying what tests can't see.** Playwright MCP visual diff against the 23.1 baseline; adversarial code review. Tests are green *and the app still looks wrong* is a real failure mode. |

Do not rehearse the run. The investigation is the lesson, and it only teaches if the wrong turns are visible.

---

### Story 23.1: Angular 22 Readiness & Visual Baseline

**User Story:** As the developer, I want the codebase to absorb every Angular 22 behavior change that can be pre-empted on Angular 21 — and I want a recorded visual baseline — so that the actual version bump changes as little as possible and any theme drift is provable rather than argued about.

**Source:** MR-A22-1, MR-A22-2, MR-A22-3, NFR-A22-1

**Ships on:** Angular 21 (no dependency changes at all)

**Acceptance Criteria:**

1. **Given** `app.config.ts` currently calls bare `provideRouter(routes)`,
   **When** the router is configured,
   **Then** it explicitly declares `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })`, pinning today's behavior so Angular 22's default flip to `'always'` becomes a no-op. A comment cites Story 23.1 and the v22 change.

2. **Given** Angular 22 promotes `nullishCoalescingNotNullable` and `optionalChainNotNullable` template diagnostics to errors,
   **When** those diagnostics are enabled in `tsconfig.json` under `angularCompilerOptions` (as `"error"`),
   **Then** the build is clean — every redundant `?.` and `??` on a non-nullable expression has been removed from templates.

3. **Given** the Upkeep theme has no visual regression coverage,
   **When** a new Playwright spec `e2e/tests/visual/theme-baseline.spec.ts` runs,
   **Then** it captures `toHaveScreenshot()` baselines for the themed surfaces (login, dashboard, property detail, expense list, work-order detail, tenant dashboard, sidebar/bottom nav, and at least one dialog and one form), and the committed snapshots become the reference for Story 23.3.

4. **Given** the visual baseline spec,
   **When** it runs twice in a row against an unchanged app,
   **Then** it passes both times — proving the snapshots are stable (fonts loaded, animations disabled, no flake) and are therefore a trustworthy oracle for 23.3.

5. **Given** the full suite,
   **When** `npm run build`, `npm test`, and the E2E suite run,
   **Then** all pass — this story changes behavior nowhere.

---

### Story 23.2: Angular 22 Framework Upgrade (Material Held at 21)

**User Story:** As the developer, I want Angular core/cli/compiler-cli/build on 22 and TypeScript on 6.0 — with Angular Material deliberately held at 21 — so that the framework upgrade and the OnPush default flip are verifiable in isolation from any theming change.

**Source:** MR-A22-4, MR-A22-5, MR-A22-6, NFR-A22-1, NFR-A22-2, NFR-A22-3

**Depends on:** 23.1

**Acceptance Criteria:**

1. **Given** the readiness work from 23.1 is on `main`,
   **When** `ng update @angular/core@22 @angular/cli@22` runs and its migration schematics are applied,
   **Then** `@angular/core`, `@angular/common`, `@angular/compiler`, `@angular/compiler-cli`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/animations`, `@angular/build`, and `@angular/cli` are all on `^22.x`, and `typescript` is on `~6.0.x`.

2. **Given** Angular Material 21 peer-supports `@angular/core: ^21.0.0 || ^22.0.0`,
   **When** dependencies are installed,
   **Then** `@angular/material` and `@angular/cdk` remain on `21.x`, `npm ci` resolves with **no `--legacy-peer-deps` and no `--force`**, and the lockfile is clean.

3. **Given** all 92 components now default to `ChangeDetectionStrategy.OnPush`,
   **When** the E2E suite runs,
   **Then** it passes — no stale-UI regressions. Any component that genuinely requires `Default` has `changeDetection: ChangeDetectionStrategy.Default` set **explicitly**, with a comment naming the specific reason it cannot use OnPush.

4. **Given** the OnPush audit,
   **When** the 22 components that assign plain (non-signal) fields are reviewed,
   **Then** each is confirmed to either (a) bind only signals in its template, or (b) be explicitly pinned to `Default`. The audit is recorded in the story's Dev Agent Record — **a per-component verdict, not a blanket assertion.**

5. **Given** TypeScript 6.0's own breaking changes,
   **When** `npm run build` runs,
   **Then** it completes with zero errors (the pre-existing bundle-budget warning from issue #353 is acceptable and must not grow).

6. **Given** the full test suite,
   **When** `npm test` and the E2E suite run,
   **Then** **2,984+ unit tests pass** and the E2E suite is green, with no test skipped or weakened to achieve it.

7. **Given** the Dependabot TypeScript ignore rule added in PR #491,
   **When** Angular 22 is on `main`,
   **Then** `.github/dependabot.yml` is updated so TypeScript **minor** updates are allowed again within Angular 22's `>=6.0 <6.1` peer range, while **major** updates stay ignored (TS 7 remains unsupported by Angular).

8. **Given** Dependabot PR #441,
   **When** this story merges,
   **Then** #441 is closed as superseded, with a comment pointing at this story.

---

### Story 23.3: Angular Material 22 & Theme Reconciliation

**User Story:** As the developer, I want Angular Material and the CDK on 22 with the Upkeep theme rendering exactly as it did before — so that a framework-currency upgrade doesn't silently degrade the brand work delivered in Epic 8.5.

**Source:** MR-A22-7, MR-A22-8, NFR-A22-1, NFR-A22-4

**Depends on:** 23.2

**Acceptance Criteria:**

1. **Given** Angular core is on 22,
   **When** `ng update @angular/material@22` runs and its schematics are applied,
   **Then** `@angular/material` and `@angular/cdk` are on `^22.x` and `npm ci` resolves cleanly with no peer overrides.

2. **Given** `src/styles/_theme-colors.scss` was generated by `ng generate @angular/material:theme-color`,
   **When** Material 22's theming API is applied,
   **Then** the palette file is regenerated (or verified still valid) for Material 22 from the same source colors — primary `#4361ee` (Upkeep Blue), tertiary `#0d9488` (Upkeep Teal) — and `mat.theme()` in `src/styles.scss` compiles without deprecation warnings.

3. **Given** 40 SCSS files reference Material's `--mat-*` / `--mdc-*` design tokens,
   **When** Material 22 renames or removes any of them,
   **Then** every affected token reference is updated to its Material 22 equivalent. **Any token that no longer exists must be replaced deliberately — not deleted to make the build quiet.**

4. **Given** the 2 files using `::ng-deep` and the 2 targeting `.mat-mdc-*` internal classes,
   **When** Material 22's DOM structure changes,
   **Then** those selectors are verified still to match, or are rewritten. (Low coupling by design — but internal selectors are exactly what majors break.)

5. **Given** the visual baseline committed in Story 23.1,
   **When** `e2e/tests/visual/theme-baseline.spec.ts` runs against Material 22,
   **Then** it passes. **Any** intentional visual diff must be reviewed by a human, explicitly approved, and the baseline re-committed **in the same PR** with the reason recorded — never silently re-baselined with `--update-snapshots`.

6. **Given** the full suite,
   **When** `npm run build`, `npm test`, and the E2E suite run,
   **Then** all pass, and the bundle does not grow beyond the existing overage (issue #353).

7. **Given** the migration is complete,
   **When** the app is smoke-tested live via Playwright MCP,
   **Then** the themed surfaces are confirmed correct by eye — screenshots saved to `screenshots/` per the project convention.

---

## Cross-Reference Validation

| Concern | Where addressed |
|---|---|
| Angular 22 requires TS ≥ 6.0 | 23.2 AC #1 |
| Node 26 support | Already satisfied — `frontend/Dockerfile` bumped to `node:26-alpine` in PR #491 |
| OnPush default flip (92 components) | 23.2 AC #3, #4 — per-component audit, not assumption |
| `paramsInheritanceStrategy` default flip | 23.1 AC #1 — pinned *before* the bump, so it's a no-op |
| Template diagnostics promoted to errors | 23.1 AC #2 — cleared while still warnings |
| Material token drift (40 files) | 23.3 AC #3 |
| Theme regression, invisible to tests | 23.1 AC #3/#4 (baseline) → 23.3 AC #5 (diff) |
| Dependabot #441 red since 2026-06-01 | 23.2 AC #8 |
| Dependabot #487 (TS 7) | Closed 2026-07-14; ignore rule in PR #491; revisited in 23.2 AC #7 |

## Epic Numbering Note

This mini-epic takes **Epic 23**. The Stripe integration (PRD FR78–FR81, NFR29) — the largest remaining unbuilt requirement and a stated demo-readiness prerequisite — therefore becomes **Epic 24**.

---

_Authored 2026-07-14 by Dave + Claude._
_Implementation order: 23.1 → 23.2 → 23.3 (strictly sequential)._
_Run `/orchestrate` to execute the epic via the story-cycle workflow._
