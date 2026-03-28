# Epic 8.5: UX Design Refresh - "Upkeep" Brand Launch

**Goal:** Implement the new Upkeep brand identity with a refreshed color palette, custom logo, and improved visual polish. This is a focused styling update that modernizes the application's look while preserving all existing functionality.

**GitHub Issues:** #83 (Receipt Lightbox Fix)

**User Value:** "The app feels modern, polished, and distinctly mine"

**Design Specification:** `_bmad-output/planning-artifacts/ux-design-refresh-2026.md`

---

## Story 8.5.1: Angular Material Theme Migration

**As a** user,
**I want** the application to use the new Upkeep color palette,
**So that** I experience a fresh, modern, and cohesive visual design.

**Acceptance Criteria:**

**Given** I open the application
**When** I view any page
**Then** I see the new cobalt blue (#4361ee) as the primary color

**And** purple (#7c3aed) appears as accent/secondary color
**And** teal (#0d9488) is used for success states
**And** terracotta (#c2784e) is used for warm accent elements

**Given** I view the content area (main body)
**When** I look at the background
**Then** I see a subtle gradient from light lavender (#eef2ff) at the bottom fading to white at the top

**Given** I use any Angular Material component (buttons, cards, forms)
**When** they are rendered
**Then** they use the new theme colors consistently

**Prerequisites:** None

**Technical Notes:**
- Run: `ng generate @angular/material:theme-color --primaryColor=#4361ee --tertiaryColor=#0d9488`
- Update `styles.scss` with new `mat.theme()` configuration
- Replace `--pm-*` CSS custom properties with new values
- Test all major components for visual consistency

**Implementation Files:**
- `frontend/src/styles.scss`
- Generated M3 palette files

---

## Story 8.5.2: Sidebar Styling Update

**As a** user,
**I want** the sidebar to use the new deep indigo color scheme,
**So that** it provides effective contrast while feeling modern rather than harsh.

**Acceptance Criteria:**

**Given** I view the desktop sidebar
**When** it renders
**Then** the background is deep indigo (#1e2340)

**And** the logo appears in white (outline version)
**And** text and icons are appropriately visible

**Given** I hover over sidebar menu items
**When** interacting with navigation
**Then** hover states use subtle lightening consistent with the new palette

**Prerequisites:** 8.5.1

**Technical Notes:**
- Update sidebar background from current `#1E1E1E` to `#1e2340`
- Use `logo-lockup-horizontal-white.svg` for sidebar logo
- Adjust text colors for WCAG contrast compliance
- Update hover/active states

**Implementation Files:**
- `frontend/src/app/core/components/sidebar/`
- Logo assets: `frontend/src/assets/brand/`

---

## Story 8.5.3: Logo and Favicon Implementation

**As a** user,
**I want** to see the Upkeep logo and favicon,
**So that** the application has a distinctive brand identity.

**Acceptance Criteria:**

**Given** I view the browser tab
**When** the page loads
**Then** I see the Upkeep favicon (gradient background with white house icon)

**Given** I view the sidebar on desktop
**When** expanded
**Then** I see the Upkeep logo lockup (icon + "upkeep" wordmark)

**Given** I view the app on mobile or collapsed sidebar
**When** in compact view
**Then** I see just the icon-only version of the logo

**Given** I view the login/landing page
**When** on a light background
**Then** I see the gradient outline version of the logo

**Prerequisites:** None (can be done in parallel with 8.5.1)

**Technical Notes:**
- Generate favicon files from `favicon.svg` using realfavicongenerator.net
- Place generated files in `frontend/public/`
- Update `index.html` with proper favicon links
- Use appropriate logo variant per context (see brand README)

**Implementation Files:**
- `frontend/public/` (favicon files)
- `frontend/index.html`
- `frontend/src/assets/brand/` (SVG sources)

---

## Story 8.5.4: Receipt Lightbox Fix

**GitHub Issue:** #83

**As a** user processing receipts,
**I want** the receipt lightbox to display at a proper size,
**So that** I can see the full receipt image without controls being obscured.

**Acceptance Criteria:**

**Given** I open the receipt lightbox from the Recent Receipts list
**When** the dialog appears
**Then** the image is fully visible and properly sized

**And** all controls (rotate, zoom, close) are visible and accessible
**And** the dialog uses responsive sizing (not fixed 75vw)

**Given** I rotate or zoom the image
**When** controls are used
**Then** they function correctly without being cut off

**Prerequisites:** None (independent bug fix)

**Technical Notes:**
- Root cause: `width: 75vw` constraint in `receipt-lightbox-dialog.component.ts`
- Fix: Use flexbox layout with `flex: 1` like `receipt-process.component.ts`
- The `ReceiptImageViewerComponent` itself is fine; container is the issue
- Reference working implementation in receipt-process for pattern

**Implementation Files:**
- `frontend/src/app/features/receipts/components/receipt-lightbox-dialog/receipt-lightbox-dialog.component.ts`

---

## Story 8.5.5: Visual Polish and QA

**As a** user,
**I want** all visual elements to be consistent with the new design,
**So that** the refresh feels complete and polished.

**Acceptance Criteria:**

**Given** I navigate through the entire application
**When** I visit each major section (Dashboard, Properties, Expenses, Income, Receipts, Reports)
**Then** colors are consistent with the new palette

**And** no remnants of the old green/forest theme remain
**And** all text has appropriate contrast (WCAG AA)

**Given** I view the application on mobile
**When** in responsive mode
**Then** the new styling works correctly at all breakpoints

**Given** I use dark mode (if applicable)
**When** toggled
**Then** colors adapt appropriately (or dark mode is intentionally not supported per spec)

**Prerequisites:** 8.5.1, 8.5.2, 8.5.3, 8.5.4

**Technical Notes:**
- Full visual regression testing
- Check all Angular Material components
- Verify no hardcoded old colors remain
- Screenshot comparison recommended

---

## Epic 8.5 Summary

| Story | Title | GitHub Issue | Prerequisites |
|-------|-------|--------------|---------------|
| 8.5.1 | Angular Material Theme Migration | - | None |
| 8.5.2 | Sidebar Styling Update | - | 8.5.1 |
| 8.5.3 | Logo and Favicon Implementation | - | None |
| 8.5.4 | Receipt Lightbox Fix | #83 | None |
| 8.5.5 | Visual Polish and QA | - | 8.5.1-8.5.4 |

**Stories:** 5 | **Critical Path:** 8.5.1 -> 8.5.2 -> 8.5.5

**Independent:** 8.5.3, 8.5.4 can run in parallel with 8.5.1

**Epic 8.5 Milestone:** A fully refreshed Upkeep brand identity with modern colors, custom logo, and polished UI.

---

## Color Palette Quick Reference

| Role | Color | Hex |
|------|-------|-----|
| Primary (Cobalt) | Blue | #4361ee |
| Secondary (Violet) | Purple | #7c3aed |
| Success (Teal) | Green | #0d9488 |
| Warm (Terracotta) | Orange | #c2784e |
| Sidebar BG | Deep Indigo | #1e2340 |
| Text Primary | Slate | #0f172a |
| Text Secondary | Gray | #475569 |

---

_Generated by BMAD Business Analyst_
_Date: 2026-01-17_
_For: Dave_
_Project: property-manager / Upkeep_
