# Upkeep — UX Design Refresh 2026

**Document Version:** 1.0
**Date:** January 17, 2026
**Status:** Approved for Implementation
**Supersedes:** Sections 3.1 (Color System) and brand identity from `ux-design-specification.md`

---

## Executive Summary

This document captures the **design refresh** for Property Manager, now rebranded as **Upkeep**. The refresh introduces:

- **New brand identity** — "Upkeep" name, custom logo, favicon
- **New color palette** — Blue primary, purple accents (replacing Forest Green)
- **Softer sidebar contrast** — Deep indigo instead of near-black
- **Gradient background** — Subtle lavender wash in content area
- **Mercury-inspired aesthetic** — Modern, sophisticated, approachable

**What remains unchanged:**
- Core UX patterns and user journeys (see original spec)
- Angular Material component library
- Card-based UI pattern
- Desktop-first, mobile-capable strategy
- Left sidebar navigation layout

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Logo System](#4-logo-system)
5. [UI Refinements](#5-ui-refinements)
6. [Implementation Guide](#6-implementation-guide)
7. [Asset Inventory](#7-asset-inventory)
8. [Migration Checklist](#8-migration-checklist)

---

## 1. Brand Identity

### 1.1 Brand Name

| Element | Previous | New |
|---------|----------|-----|
| **Product name** | Property Manager | **Upkeep** |
| **Wordmark** | "PropertyManager" or "PM" | **upkeep** (lowercase) |
| **Domain** | N/A | upkeep-io.com, upkeep-io.dev |

### 1.2 Brand Positioning

**Tagline:** Property management made simple

**Target audience:** Smaller property owners (1-50 properties, typically ~20), side-hustle landlords who are busy and practical.

**Brand personality:**
- Approachable, not corporate
- Modern, not trendy
- Professional, not stuffy
- Efficient, not complicated

### 1.3 Design Inspiration

The refresh draws inspiration from [Mercury](https://mercury.com):
- Sophisticated color palette spanning cool and warm tones
- Purposeful gradients
- Clean, airy layouts
- Cards that "float" on subtle backgrounds
- Category labels in coordinated colors

---

## 2. Color System

### 2.1 Primary Palette (Blue)

The main action color for buttons, links, and focus states.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Cobalt** | `#4361ee` | 67, 97, 238 | Primary actions, buttons, links |
| **Deep Cobalt** | `#3651d4` | 54, 81, 212 | Hover states, emphasis |
| **Soft Blue** | `#6b8cff` | 107, 140, 255 | Highlights, selected states |

### 2.2 Secondary Palette (Purple)

Accent color for gradients, shading, and visual interest.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Violet** | `#7c3aed` | 124, 58, 237 | Accents, gradient endpoints |
| **Deep Violet** | `#6429cd` | 100, 41, 205 | Hover states |
| **Lavender** | `#a78bfa` | 167, 139, 250 | Subtle accents, tags |

### 2.3 Tertiary Palette (Teal)

Success states and positive indicators.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Teal** | `#0d9488` | 13, 148, 136 | Success, confirmations |
| **Deep Teal** | `#0f766e` | 15, 118, 110 | Success text |
| **Soft Teal** | `#5eead4` | 94, 234, 212 | Success backgrounds |

### 2.4 Warm Accent (Terracotta)

Visual variety and category differentiation.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Terracotta** | `#c2784e` | 194, 120, 78 | Categories, variety |
| **Sienna** | `#9c5a35` | 156, 90, 53 | Warm emphasis |
| **Soft Clay** | `#e8b89d` | 232, 184, 157 | Warm backgrounds |

### 2.5 Semantic Colors

| Role | Color | Hex | Previous |
|------|-------|-----|----------|
| **Success** | Teal | `#0d9488` | `#4CAF50` |
| **Warning** | Amber | `#d97706` | `#FFA726` |
| **Error** | Rose | `#dc2626` | `#EF5350` |
| **Info** | Cobalt | `#4361ee` | `#29B6F6` |

### 2.6 Neutral Palette

#### Sidebar & Navigation

| Name | Hex | Previous | Change |
|------|-----|----------|--------|
| **Sidebar BG** | `#1e2340` | `#1E1E1E` | Near-black → Deep indigo |
| **Sidebar Text** | `#e2e8f0` | `#E0E0E0` | Slight adjustment |
| **Sidebar Active** | `#ffffff` | `#ffffff` | No change |
| **Active BG** | `rgba(67, 97, 238, 0.15)` | `rgba(102, 187, 106, 0.15)` | Green → Blue tint |
| **Active Border** | `#4361ee` | `#66BB6A` | Green → Blue |

#### Text Colors

| Name | Hex | Previous |
|------|-----|----------|
| **Text Primary** | `#0f172a` | `#33691E` |
| **Text Secondary** | `#475569` | `#666666` |
| **Text Muted** | `#94a3b8` | `#9E9E9E` |

#### Surfaces

| Name | Hex | Previous |
|------|-----|----------|
| **Background** | `#ffffff` (top of gradient) | `#FAFAFA` |
| **Gradient Start** | `#eef2ff` | N/A (new) |
| **Surface** | `#ffffff` | `#FFFFFF` |
| **Border** | `#e5e7eb` | `#E0E0E0` |

### 2.7 Gradients

#### Brand Gradient
Used in logo, buttons (when appropriate), and accent elements.
```css
background: linear-gradient(135deg, #4361ee 0%, #7c3aed 100%);
```

#### Background Gradient
Applied to main content area. Subtle lavender wash at bottom, fading to white.
```css
background: linear-gradient(
  to top,
  #eef2ff 0%,    /* Soft lavender */
  #f8faff 30%,   /* Transitional */
  #ffffff 70%    /* White */
);
```

### 2.8 Shadow System

Softer, cool-toned shadows (replacing previous warm shadows).

| Level | CSS | Usage |
|-------|-----|-------|
| Shadow 1 | `0 1px 3px rgba(30, 35, 64, 0.08), 0 1px 2px rgba(30, 35, 64, 0.06)` | Subtle |
| Shadow 2 | `0 2px 6px rgba(30, 35, 64, 0.08), 0 2px 4px rgba(30, 35, 64, 0.06)` | Cards |
| Shadow 3 | `0 4px 12px rgba(30, 35, 64, 0.10), 0 2px 4px rgba(30, 35, 64, 0.06)` | Modals |

### 2.9 Color Usage Guidelines

| Context | Color |
|---------|-------|
| Primary action buttons | Cobalt `#4361ee` |
| Secondary action buttons | Violet `#7c3aed` |
| Cancel/tertiary buttons | Outline with Cobalt |
| Success messages | Teal `#0d9488` |
| Category: Utilities | Cobalt `#4361ee` |
| Category: Insurance | Violet `#7c3aed` |
| Category: Repairs | Terracotta `#c2784e` |
| Positive amounts | Teal `#0d9488` |
| Errors | Rose `#dc2626` |

---

## 3. Typography

### 3.1 Font Change

| Element | Previous | New |
|---------|----------|-----|
| **Primary font** | System fonts | **Inter** (Google Fonts) |
| **Fallback** | System stack | Same system stack |

**Font stack:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

### 3.2 Wordmark Typography

| Property | Value |
|----------|-------|
| Font | Inter |
| Weight | 600 (Semi-Bold) |
| Letter spacing | -0.02em |
| Case | Lowercase (`upkeep`) |

---

## 4. Logo System

### 4.1 Logo Concept

**The Roof U** — A soft, rounded roofline forming the letter U.

**Style:** Outline/stroke (not filled)

**Why this works:**
- Property/home connection (the roof)
- Brand identity (the U for Upkeep)
- Approachability (rounded corners)
- Refined, modern (outline style)

### 4.2 Logo Variations

| Variation | File | Use Case |
|-----------|------|----------|
| **Icon - White outline** | `logo-outline-white.svg` | Dark backgrounds (sidebar) |
| **Icon - Gradient outline** | `logo-outline-gradient.svg` | Light backgrounds |
| **Lockup - White** | `logo-lockup-horizontal-white.svg` | Dark backgrounds |
| **Lockup - Gradient** | `logo-lockup-horizontal-gradient.svg` | Light backgrounds |
| **Favicon** | `favicon.svg` | Browser tabs (contained) |
| **Apple Touch Icon** | `apple-touch-icon.svg` | iOS home screen |

### 4.3 Logo Selection Rules

```
Dark background?  → White outline version
Light background? → Gradient outline version
Size < 24px?      → Use contained favicon version
```

### 4.4 Favicon Strategy

For small sizes (browser tabs, bookmarks), use a **contained version**:
- Rounded square with brand gradient background
- White outline logo centered within
- Optimized stroke weights for 16px and 32px

**Generation:** Upload `favicon.svg` to https://realfavicongenerator.net

### 4.5 Logo Specifications

| Property | Value |
|----------|-------|
| Shape | Soft Roof U (rounded) |
| Style | Outline/stroke |
| Stroke weight | 4px at 80px (scales proportionally) |
| Stroke caps | Round |
| Stroke joins | Round |
| On dark | White `#ffffff` |
| On light | Gradient `#4361ee` → `#7c3aed` |
| Minimum size | 24px (use contained below) |
| Clear space | 25% of width on all sides |

---

## 5. UI Refinements

### 5.1 Sidebar Changes

| Element | Previous | New |
|---------|----------|-----|
| **Background** | Near-black `#1E1E1E` | Deep indigo `#1e2340` |
| **Active highlight** | Green tint | Blue tint |
| **Active border** | Green `#66BB6A` | Blue `#4361ee` |
| **Logo** | "PM" text | Roof U icon + "upkeep" wordmark |

**Rationale:** The near-black sidebar created "violent" contrast. Deep indigo provides clear navigation while feeling more intentional and tied to the brand palette.

### 5.2 Content Area Background

| Element | Previous | New |
|---------|----------|-----|
| **Background** | Flat `#FAFAFA` | Gradient (lavender → white) |

**Implementation:**
```css
.main-content {
  background: linear-gradient(
    to top,
    #eef2ff 0%,
    #f8faff 30%,
    #ffffff 70%
  );
}
```

### 5.3 Cards

Cards now "float" more prominently on the gradient background.

| Property | Value |
|----------|-------|
| Background | White `#ffffff` |
| Border radius | 12px |
| Border | 1px solid `#e5e7eb` |
| Shadow | Shadow 2 (cool-toned) |

### 5.4 Buttons

| Type | Background | Text | Hover |
|------|------------|------|-------|
| **Primary** | `#4361ee` | White | `#3651d4` + shadow |
| **Secondary** | `#7c3aed` | White | `#6429cd` + shadow |
| **Outline** | Transparent | `#4361ee` | Light blue bg |
| **Success** | `#0d9488` | White | `#0f766e` |

### 5.5 Tags/Badges

```css
.tag {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.tag-blue { background: rgba(67, 97, 238, 0.1); color: #4361ee; }
.tag-purple { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }
.tag-teal { background: rgba(13, 148, 136, 0.1); color: #0d9488; }
.tag-warm { background: rgba(194, 120, 78, 0.1); color: #c2784e; }
```

---

## 6. Implementation Guide

### 6.1 Angular Material Theming

#### Step 1: Generate Color Palettes

Use Angular Material's schematic to generate Material 3 palettes:

```bash
cd frontend
ng generate @angular/material:theme-color \
  --primaryColor=#4361ee \
  --tertiaryColor=#0d9488 \
  --directory=src/styles
```

This creates `_theme-colors.scss` with properly calculated tonal values (0-100 scale).

#### Step 2: Update styles.scss

Replace the existing palette imports and update the theme configuration:

```scss
@use 'sass:map';
@use '@angular/material' as mat;
@use './styles/theme-colors' as upkeep;

// Apply Upkeep theme
html {
  @include mat.theme((
    color: (
      primary: upkeep.$primary-palette,
      tertiary: upkeep.$tertiary-palette,
    ),
    typography: (
      plain-family: ('Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif),
      brand-family: ('Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif),
    ),
    density: 0,
  ));
}
```

#### Step 3: Update CSS Custom Properties

Replace the existing `:root` variables:

```scss
:root {
  // Primary (Blue)
  --pm-primary: #4361ee;
  --pm-primary-dark: #3651d4;
  --pm-primary-light: #6b8cff;

  // Secondary (Purple)
  --pm-secondary: #7c3aed;
  --pm-secondary-dark: #6429cd;
  --pm-secondary-light: #a78bfa;

  // Success (Teal)
  --pm-success: #0d9488;
  --pm-success-dark: #0f766e;
  --pm-success-light: #5eead4;

  // Warm Accent (Terracotta)
  --pm-warm: #c2784e;
  --pm-warm-dark: #9c5a35;
  --pm-warm-light: #e8b89d;

  // Semantic
  --pm-warning: #d97706;
  --pm-error: #dc2626;

  // Sidebar
  --pm-sidebar-bg: #1e2340;
  --pm-sidebar-text: #e2e8f0;
  --pm-sidebar-text-active: #ffffff;
  --pm-sidebar-hover: rgba(255, 255, 255, 0.05);
  --pm-sidebar-active-bg: rgba(67, 97, 238, 0.15);
  --pm-sidebar-active-border: #4361ee;

  // Text
  --pm-text-primary: #0f172a;
  --pm-text-secondary: #475569;
  --pm-text-muted: #94a3b8;

  // Surfaces
  --pm-background: #ffffff;
  --pm-surface: #ffffff;
  --pm-border: #e5e7eb;
  --pm-gradient-start: #eef2ff;

  // Shadows (cool-toned)
  --pm-shadow-1: 0 1px 3px rgba(30, 35, 64, 0.08), 0 1px 2px rgba(30, 35, 64, 0.06);
  --pm-shadow-2: 0 2px 6px rgba(30, 35, 64, 0.08), 0 2px 4px rgba(30, 35, 64, 0.06);
  --pm-shadow-3: 0 4px 12px rgba(30, 35, 64, 0.10), 0 2px 4px rgba(30, 35, 64, 0.06);

  // Layout
  --pm-sidebar-width: 240px;
  --pm-bottom-nav-height: 56px;
}
```

#### Step 4: Update Sidebar Component

Update the shell/sidebar to use the new logo:

```html
<div class="sidebar-logo">
  <img src="assets/brand/logo-outline-white.svg" alt="Upkeep" width="32" height="32">
  <span class="wordmark">upkeep</span>
</div>
```

```scss
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.wordmark {
  color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}
```

#### Step 5: Add Background Gradient

Apply to the main content wrapper:

```scss
.main-content,
.shell-content {
  background: linear-gradient(
    to top,
    var(--pm-gradient-start) 0%,
    #f8faff 30%,
    var(--pm-background) 70%
  );
}
```

#### Step 6: Update index.html

Add Inter font and new favicon references:

```html
<head>
  <!-- Inter font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <title>Upkeep</title>
</head>
```

### 6.2 Favicon Generation

1. Go to https://realfavicongenerator.net
2. Upload `frontend/src/assets/brand/favicon.svg`
3. Download generated package
4. Extract to `frontend/public/`:
   - `favicon.ico`
   - `favicon.svg`
   - `favicon-16x16.png`
   - `favicon-32x32.png`
   - `apple-touch-icon.png`
   - `android-chrome-*.png`
   - `site.webmanifest`

---

## 7. Asset Inventory

### 7.1 Brand Assets

**Location:** `frontend/src/assets/brand/`

```
brand/
├── README.md                           # Brand guidelines
├── logo-outline-white.svg              # Icon for dark backgrounds
├── logo-outline-gradient.svg           # Icon for light backgrounds
├── logo-icon-only-white.svg            # Compact icon (dark)
├── logo-icon-only-gradient.svg         # Compact icon (light)
├── logo-lockup-horizontal-white.svg    # Logo + wordmark (dark)
├── logo-lockup-horizontal-gradient.svg # Logo + wordmark (light)
├── logo-lockup-horizontal-dark.svg     # Logo + wordmark (light, dark text)
├── favicon.svg                         # Source for favicon generation
├── favicon-32.svg                      # Optimized 32px
├── favicon-16.svg                      # Optimized 16px
└── apple-touch-icon.svg                # iOS home screen
```

### 7.2 Design Exploration Files

**Location:** `frontend/src/assets/design-exploration/`

```
design-exploration/
├── palette-preview.html                # Interactive color palette demo
├── logo-exploration.html               # Logo concept explorations
└── logo-final-direction.html           # Approved logo system
```

### 7.3 Production Assets (to generate)

**Location:** `frontend/public/`

```
public/
├── favicon.ico                         # Multi-size ICO
├── favicon.svg                         # Modern browsers
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png                # 180×180
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest
```

---

## 8. Migration Checklist

### 8.1 Preparation

- [ ] Review this document with team
- [ ] Create feature branch for design refresh
- [ ] Back up current `styles.scss`

### 8.2 Color & Theme

- [ ] Run `ng generate @angular/material:theme-color` schematic
- [ ] Update `styles.scss` with new palettes
- [ ] Update `:root` CSS custom properties
- [ ] Test Angular Material components render correctly

### 8.3 Favicon & Branding

- [ ] Generate favicon files via realfavicongenerator.net
- [ ] Place files in `frontend/public/`
- [ ] Update `index.html` with new favicon references
- [ ] Update page title to "Upkeep"
- [ ] Add Inter font to `index.html`

### 8.4 Component Updates

- [ ] Update sidebar background color
- [ ] Update sidebar active states (blue highlight)
- [ ] Add logo SVG to sidebar
- [ ] Update sidebar wordmark to "upkeep"
- [ ] Add gradient background to content area

### 8.5 Verify Updates

- [ ] Check all button colors (primary, secondary, success)
- [ ] Check form field focus states
- [ ] Check snackbar/toast colors
- [ ] Check tag/badge colors
- [ ] Check error states
- [ ] Check success states

### 8.6 Testing

- [ ] Visual review on desktop (Chrome, Firefox, Safari)
- [ ] Visual review on mobile
- [ ] Verify favicon appears in browser tab
- [ ] Verify apple-touch-icon on iOS
- [ ] Cross-browser shadow rendering
- [ ] Gradient background renders correctly

### 8.7 Cleanup

- [ ] Remove old color exploration files (if any)
- [ ] Update any documentation references
- [ ] Commit and create PR

---

## Appendix A: CSS Variable Quick Reference

```scss
// Colors
var(--pm-primary)           // #4361ee - buttons, links
var(--pm-secondary)         // #7c3aed - accents
var(--pm-success)           // #0d9488 - success states
var(--pm-warm)              // #c2784e - categories
var(--pm-warning)           // #d97706 - warnings
var(--pm-error)             // #dc2626 - errors

// Text
var(--pm-text-primary)      // #0f172a - headings
var(--pm-text-secondary)    // #475569 - body
var(--pm-text-muted)        // #94a3b8 - placeholder

// Sidebar
var(--pm-sidebar-bg)        // #1e2340
var(--pm-sidebar-text)      // #e2e8f0
var(--pm-sidebar-active-bg) // rgba(67, 97, 238, 0.15)

// Surfaces
var(--pm-surface)           // #ffffff
var(--pm-border)            // #e5e7eb
var(--pm-gradient-start)    // #eef2ff

// Shadows
var(--pm-shadow-1)          // subtle
var(--pm-shadow-2)          // cards
var(--pm-shadow-3)          // modals
```

---

## Appendix B: Color Comparison (Before/After)

| Element | Before (Forest Green) | After (Upkeep) |
|---------|----------------------|----------------|
| Primary | `#66BB6A` | `#4361ee` |
| Primary Dark | `#4CAF50` | `#3651d4` |
| Accent | `#FFA726` | `#7c3aed` |
| Success | `#4CAF50` | `#0d9488` |
| Sidebar BG | `#1E1E1E` | `#1e2340` |
| Text Primary | `#33691E` | `#0f172a` |
| Background | `#FAFAFA` (flat) | Gradient |

---

## Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-17 | 1.0 | Initial design refresh specification | Dave + Mary (BA) |

---

**Related Documents:**
- Original UX Specification: `ux-design-specification.md` (Nov 2025)
- Brand Assets README: `frontend/src/assets/brand/README.md`
- Design Explorations: `frontend/src/assets/design-exploration/`

---

_This design refresh was developed through collaborative discovery with Mary (Business Analyst Agent), capturing brand direction, color palette, logo system, and implementation guidance for the Upkeep rebrand._
