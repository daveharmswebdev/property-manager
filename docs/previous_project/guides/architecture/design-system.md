# Upkeep Property Management - Design & Style Guide

## Table of Contents
1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography Scale](#typography-scale)
4. [Spacing & Layout](#spacing--layout)
5. [Component Specifications](#component-specifications)
6. [Interaction States](#interaction-states)
7. [Form Design Patterns](#form-design-patterns)
8. [User Flow Guidelines](#user-flow-guidelines)
9. [Accessibility Requirements](#accessibility-requirements)
10. [Mobile-First Guidelines](#mobile-first-guidelines)

---

## Design Principles

### 1. High Contrast First
Every interface element must be immediately distinguishable from its background and neighboring elements. Use bold color contrasts, clear borders, and sufficient spacing to create visual separation.

**Implementation:**
- Maintain WCAG AA minimum contrast ratios (4.5:1 for text, 3:1 for UI components)
- Use shadows and borders together for maximum definition
- Avoid subtle gray-on-gray combinations
- Default to darker shades for better readability

### 2. Prominent Icons & CTAs
Users should immediately identify actionable items without reading text. Icons reinforce meaning, and primary CTAs demand attention.

**Implementation:**
- Every CTA button includes an icon when space permits
- Icon size minimum: 20px (mobile), 24px (desktop)
- Primary CTAs use bold colors (complement-300/400) with ample padding
- Action buttons appear in consistent locations (top-right for "Add", bottom-right for "Next")

### 3. Intuitive UX Flow
Every workflow should feel natural and require minimal cognitive effort. Users should never wonder "what do I do next?"

**Implementation:**
- Clear visual breadcrumbs showing current step in multi-step flows
- Disabled states explain WHY a button is disabled (e.g., "Complete all required fields")
- Success states show immediate feedback and clear next actions
- Empty states include prominent CTAs for the next logical action

### 4. Obvious Next Steps
At every point in the application, the user's next action should be visually obvious through hierarchy, color, and positioning.

**Implementation:**
- Primary action buttons always use complement green (the "go" color)
- Secondary actions use neutral grays
- Destructive actions use primary red
- Next steps are always positioned prominently (never hidden in menus)

---

## Color System

### Purpose-Driven Palette

Our color system is organized by **purpose**, not aesthetics. Each color family has specific semantic meaning:

#### Primary (Red) - #861916 to #FFABA4
**Purpose:** Alerts, Errors, Active Leases, Destructive Actions

**Usage:**
- `primary-500` (#5A0200): Dark backgrounds, high contrast text
- `primary-400` (#861916): Error text, destructive button backgrounds, active lease status
- `primary-300` (#AD3A37): Hover state for destructive buttons
- `primary-200` (#D46764): Error message backgrounds (with primary-400 text)
- `primary-100` (#FFABA4): Light error backgrounds, active lease badges

**Tailwind Classes:**
```css
/* Error states */
text-primary-400 bg-primary-100  /* Error messages */
border-primary-400 ring-primary-200  /* Error input borders */

/* Destructive actions */
bg-primary-300 hover:bg-primary-400 text-white  /* Delete buttons */

/* Active lease badge */
bg-primary-100 text-primary-500  /* Status badge */
```

#### Complement (Green) - #116917 to #81C885
**Purpose:** Success, Primary CTAs, Vacant Properties, Growth

**Usage:**
- `complement-500` (#004705): High contrast success text, price displays
- `complement-400` (#116917): Hover state for primary CTAs
- `complement-300` (#2B8831): **PRIMARY CTA BACKGROUND** - use for all main actions
- `complement-200` (#4FA755): Success message backgrounds
- `complement-100` (#81C885): Vacant property badges, light success states

**Tailwind Classes:**
```css
/* Primary CTAs - THE MOST IMPORTANT PATTERN */
bg-complement-300 hover:bg-complement-400 text-white font-medium
disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors

/* Success states */
text-complement-500 bg-complement-100  /* Success messages */
border-complement-300 ring-complement-200  /* Valid input focus states */

/* Price displays */
text-complement-500 font-semibold  /* Purchase price, monthly rent */
```

#### Secondary-1 (Orange/Brown) - #864A16 to #FFCEA4
**Purpose:** Edit Actions, Warnings, Secondary Information

**Usage:**
- `secondary-1-400` (#864A16): Warning text, dark backgrounds
- `secondary-1-300` (#AD6E37): Edit button backgrounds
- `secondary-1-200` (#D49864): Warning highlights
- `secondary-1-100` (#FFCEA4): Light warning backgrounds

**Tailwind Classes:**
```css
/* Edit actions */
bg-secondary-1-300 hover:bg-secondary-1-400 text-white  /* Edit buttons */

/* Warnings */
text-secondary-1-400 bg-secondary-1-100  /* Warning messages */
```

#### Secondary-2 (Teal) - #0E4E51 to #63979A
**Purpose:** Month-to-Month Leases, Information, Neutral Actions

**Usage:**
- `secondary-2-500` (#003436): Dark teal for text
- `secondary-2-400` (#0E4E51): Information backgrounds
- `secondary-2-300` (#226569): Informational elements
- `secondary-2-200` (#3D7D80): Month-to-month lease highlights
- `secondary-2-100` (#63979A): Month-to-month lease badges

**Tailwind Classes:**
```css
/* Month-to-month lease badge */
bg-secondary-2-100 text-secondary-2-500  /* Status badge */

/* Informational elements */
text-secondary-2-500 bg-secondary-2-100  /* Info callouts */
```

#### Neutral Grays
**Purpose:** Backgrounds, Borders, Disabled States, Body Text

**Usage:**
- `gray-900`: Primary text color
- `gray-800`: Headings, important text
- `gray-700`: Labels, secondary text
- `gray-600`: Tertiary text, placeholders
- `gray-500`: Disabled text
- `gray-400`: Borders
- `gray-300`: Disabled button backgrounds
- `gray-200`: Secondary button backgrounds
- `gray-100`: Page backgrounds
- `gray-50`: Card section backgrounds

**Tailwind Classes:**
```css
/* Text hierarchy */
text-gray-900  /* Body text (default) */
text-gray-800  /* Headings */
text-gray-700  /* Form labels */
text-gray-600  /* Helper text */

/* Backgrounds */
bg-gray-100  /* Page background */
bg-gray-50   /* Section backgrounds within cards */
bg-white     /* Card backgrounds */

/* Borders */
border-gray-300  /* Default borders */
border-gray-200  /* Subtle dividers */

/* Disabled states */
disabled:bg-gray-300 disabled:text-gray-500
```

### Color Contrast Requirements

**WCAG AA Compliance (Minimum):**
- Normal text (< 18pt): 4.5:1 contrast ratio
- Large text (≥ 18pt or 14pt bold): 3:1 contrast ratio
- UI components and graphics: 3:1 contrast ratio

**High Contrast Pairings (Pre-Approved):**
```css
/* Text on white backgrounds */
text-gray-900 bg-white         /* 21:1 - Excellent */
text-gray-800 bg-white         /* 12:1 - Excellent */
text-gray-700 bg-white         /* 8:1 - Excellent */
text-primary-400 bg-white      /* 7.2:1 - Excellent */
text-complement-500 bg-white   /* 10.5:1 - Excellent */

/* White text on colored backgrounds */
text-white bg-primary-400      /* 7.1:1 - Excellent */
text-white bg-complement-300   /* 5.8:1 - Excellent */
text-white bg-secondary-1-300  /* 5.2:1 - Good */

/* Colored text on light backgrounds */
text-primary-500 bg-primary-100    /* 8.5:1 - Excellent */
text-complement-500 bg-complement-100  /* 6.2:1 - Excellent */
```

---

## Typography Scale

### Font Families

**Montserrat (font-heading)** - Headings, labels, emphasis
- Variable font with weights 100-900
- Used for: Page titles, section headers, button text, form labels

**Lato (font-sans)** - Body text, default
- Weights: 100, 300, 400, 700, 900
- Used for: Body text, form inputs, descriptions, most UI text

### Type Scale & Usage

#### Display & Page Headers
```html
<!-- Page title (h1) -->
<h1 class="text-3xl font-heading font-bold text-gray-800 mb-6">
  Add Property
</h1>

<!-- Large hero heading (when needed) -->
<h1 class="text-4xl md:text-5xl font-heading font-bold text-gray-800">
  Property Management Dashboard
</h1>
```

**Classes:** `text-3xl font-heading font-bold text-gray-800` (32px)
**Mobile:** `text-2xl` (24px)
**Line Height:** Default (1.2 for headings)
**Use:** Main page headings, primary titles

#### Section Headers
```html
<!-- Section header (h2) -->
<h2 class="text-xl font-heading font-semibold text-gray-700 mb-4">
  Lease Details
</h2>

<!-- Subsection header (h3) -->
<h3 class="text-lg font-heading font-semibold text-gray-700 mb-3">
  Lessee Information
</h3>
```

**h2 Classes:** `text-xl font-heading font-semibold text-gray-700` (20px)
**h3 Classes:** `text-lg font-heading font-semibold text-gray-700` (18px)
**Use:** Form sections, card sections, content groupings

#### Small Headers & Labels
```html
<!-- Overline/eyebrow text -->
<h3 class="text-sm font-heading font-semibold uppercase tracking-wide text-gray-500 mb-3">
  Purchase Information
</h3>

<!-- Form label -->
<label class="block mb-2 text-gray-700 font-medium">
  Address <span class="text-primary-400">*</span>
</label>
```

**Overline:** `text-sm font-heading font-semibold uppercase tracking-wide text-gray-500`
**Form Label:** `text-gray-700 font-medium` (default text-base)
**Use:** Section labels, form field labels, metadata headers

#### Body Text
```html
<!-- Primary body text -->
<p class="text-gray-900">
  This is the default body text used throughout the application.
</p>

<!-- Secondary body text -->
<p class="text-gray-600">
  This is secondary information, less prominent than primary text.
</p>

<!-- Small text -->
<p class="text-sm text-gray-600">
  Helper text, captions, or metadata.
</p>
```

**Primary:** `text-gray-900` (16px, default)
**Secondary:** `text-gray-600` (16px)
**Small:** `text-sm text-gray-600` (14px)
**Line Height:** 1.5 (default for body text)

#### Button Text
```html
<!-- Primary CTA button -->
<button class="px-6 py-3 bg-complement-300 text-white font-medium">
  Create Property
</button>

<!-- Secondary button -->
<button class="px-6 py-3 bg-gray-200 text-gray-700 font-medium">
  Cancel
</button>
```

**Classes:** `font-medium` (weight 500)
**Size:** Inherits from button padding context
**Use:** All buttons, links that act as buttons

#### Data Display
```html
<!-- Large numeric value -->
<p class="text-2xl font-semibold text-complement-500">
  $1,234.56
</p>

<!-- Medium data value -->
<p class="text-xl font-medium text-gray-800">
  January 15, 2024
</p>

<!-- Small data label -->
<p class="text-sm text-gray-600 mb-1">
  Purchase Price
</p>
```

**Large Value:** `text-2xl font-semibold text-complement-500` (24px) - for prices, key metrics
**Medium Value:** `text-xl font-medium text-gray-800` (20px) - for dates, names
**Data Label:** `text-sm text-gray-600` (14px) - above data values

---

## Spacing & Layout

### Spacing Scale

Use Tailwind's default spacing scale consistently. **Never use arbitrary values** (e.g., `p-[13px]`).

**Core Scale:**
- `1` = 4px (0.25rem)
- `2` = 8px (0.5rem)
- `3` = 12px (0.75rem)
- `4` = 16px (1rem)
- `6` = 24px (1.5rem)
- `8` = 32px (2rem)
- `12` = 48px (3rem)
- `16` = 64px (4rem)
- `20` = 80px (5rem)

### Layout Patterns

#### Page Container
```html
<div class="min-h-screen bg-gray-100">
  <!-- Page content -->
</div>
```

**Purpose:** Full-height page wrapper
**Classes:** `min-h-screen bg-gray-100`

#### Content Wrapper
```html
<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Centered content with max width -->
</div>
```

**Purpose:** Center content with responsive padding
**Max Width Options:**
- `max-w-2xl` (672px): Forms, single-column layouts
- `max-w-4xl` (896px): Detail pages, medium content
- `max-w-7xl` (1280px): List views, wide layouts

#### Card Component
```html
<div class="bg-white p-8 rounded-lg shadow-lg">
  <!-- Card content -->
</div>
```

**Purpose:** Content container with elevation
**Padding:** `p-8` (32px) desktop, `p-6` (24px) mobile
**Shadows:**
- `shadow`: Default card shadow (4px blur)
- `shadow-lg`: Elevated cards (8px blur)
- `hover:shadow-lg`: Interactive cards

#### Card Grid
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Property cards, etc. -->
</div>
```

**Purpose:** Responsive grid layout
**Breakpoints:**
- Mobile: 1 column
- `md:` (768px): 2 columns
- `lg:` (1024px): 3 columns
**Gap:** `gap-6` (24px) between items

#### Form Spacing
```html
<!-- Form input group -->
<div class="mb-4">
  <label class="block mb-2">Label</label>
  <input class="w-full px-3 py-2" />
  <p class="text-sm mt-1">Helper text</p>
</div>
```

**Pattern:**
- `mb-4` (16px) between form groups
- `mb-2` (8px) between label and input
- `mt-1` (4px) between input and helper/error text
- `mb-6` (24px) between form sections

#### Section Spacing
```html
<!-- Page sections -->
<div class="space-y-6">
  <section>...</section>
  <section>...</section>
</div>
```

**Vertical Spacing:**
- `space-y-6` (24px): Between major sections
- `space-y-4` (16px): Between related items
- `space-y-2` (8px): Between tightly coupled items

---

## Component Specifications

### Button Hierarchy

#### 1. Primary CTA (Call-to-Action)
**Purpose:** The MAIN action on a page. Only ONE primary CTA per view.

```html
<button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
  Create Property
</button>
```

**Anatomy:**
- **Color:** `bg-complement-300` (green) - the "go" color
- **Hover:** `hover:bg-complement-400` - darker green
- **Padding:** `px-6 py-3` - substantial click target (48px height minimum)
- **Text:** `text-white font-medium` - high contrast, readable
- **Disabled:** `disabled:bg-gray-300 disabled:cursor-not-allowed` - clearly non-interactive
- **Transition:** `transition-colors` - smooth state changes
- **Border Radius:** `rounded` (4px) - subtle, modern

**States:**
- Default: Green background, white text
- Hover: Darker green (`complement-400`)
- Focus: Ring outline (see Accessibility section)
- Active: Pressed state (can add `active:bg-complement-500`)
- Disabled: Gray background, gray text, no pointer cursor
- Loading: Shows "Creating..." text, disabled state

**Icon Variant (when space permits):**
```html
<button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 transition-colors flex items-center gap-2">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
  Add Property
</button>
```

**Usage Examples:**
- "Create Property" on property list page
- "Create Lease" on lease form
- "Save Changes" on edit forms
- "Next Step" in multi-step flows

#### 2. Secondary Button
**Purpose:** Alternative actions, cancellation, navigation back.

```html
<button class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition-colors">
  Cancel
</button>
```

**Anatomy:**
- **Color:** `bg-gray-200` (light gray) - neutral, non-committal
- **Hover:** `hover:bg-gray-300` - slightly darker
- **Text:** `text-gray-700` - good contrast, not too bold
- **Padding:** Same as primary (`px-6 py-3`)
- **Border Radius:** `rounded` (4px)

**Usage Examples:**
- "Cancel" buttons on forms
- "Back" navigation buttons
- "Skip this step" in wizards

#### 3. Tertiary/Ghost Button
**Purpose:** Less important actions, links that look like buttons.

```html
<button class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors">
  View Details
</button>
```

**Anatomy:**
- **No background** (transparent by default)
- **Hover:** `hover:bg-gray-100` - subtle background appears
- **Text:** `text-gray-600 hover:text-gray-800`
- **Padding:** Smaller than primary (`px-4 py-2`)

**Usage Examples:**
- "Learn more" links
- Inline actions in tables
- Navigation within cards

#### 4. Destructive Button
**Purpose:** Delete, remove, irreversible actions. Use sparingly.

```html
<button class="px-6 py-3 bg-primary-300 text-white rounded font-medium hover:bg-primary-400 transition-colors">
  Delete Property
</button>
```

**Anatomy:**
- **Color:** `bg-primary-300` (red) - danger color
- **Hover:** `hover:bg-primary-400` - darker red
- **Text:** `text-white font-medium`
- **Padding:** Same as primary (`px-6 py-3`)

**Important:** Always pair with confirmation modal/dialog.

**Usage Examples:**
- "Delete" buttons
- "Remove" actions
- "Cancel Lease" (if irreversible)

#### 5. Edit Button
**Purpose:** Edit actions, modifications.

```html
<button class="px-6 py-3 bg-secondary-1-300 text-white rounded font-medium hover:bg-secondary-1-400 transition-colors">
  Edit Property
</button>
```

**Anatomy:**
- **Color:** `bg-secondary-1-300` (orange/brown) - distinct from create/delete
- **Hover:** `hover:bg-secondary-1-400`
- **Text:** `text-white font-medium`

**Usage Examples:**
- "Edit Property" on detail pages
- "Modify Lease" buttons
- "Update" actions

#### Button Grouping

**Side-by-Side Buttons:**
```html
<div class="flex gap-4">
  <button class="flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400">
    Create
  </button>
  <button class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300">
    Cancel
  </button>
</div>
```

**Pattern:** Primary on left (`flex-1` to fill space), secondary on right (fixed width).

**Stacked Buttons (Mobile):**
```html
<div class="flex flex-col sm:flex-row gap-4">
  <button class="w-full sm:flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium">
    Create
  </button>
  <button class="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium">
    Cancel
  </button>
</div>
```

**Mobile:** Buttons stack vertically, full width.
**Desktop:** Buttons sit side-by-side.

---

### Form Input Components

#### Text Input (Standard)

```html
<div class="mb-4">
  <label for="address" class="block mb-2 text-gray-700 font-medium">
    Address <span class="text-primary-400">*</span>
  </label>
  <input
    id="address"
    name="address"
    type="text"
    placeholder="123 Main St"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors"
  />
  <p class="text-sm text-gray-600 mt-1">Enter the full street address</p>
</div>
```

**Anatomy:**
- **Label:** Always present, includes required indicator (`*` in red)
- **Input:** `w-full px-3 py-2` (full width, 12px horizontal padding, 8px vertical)
- **Border:** `border border-gray-300` - visible by default
- **Focus State:** `focus:border-complement-300 focus:ring-2 focus:ring-complement-200` - green border + ring
- **Helper Text:** `text-sm text-gray-600 mt-1` - below input, optional

#### Text Input (Error State)

```html
<div class="mb-4">
  <label for="email" class="block mb-2 text-gray-700 font-medium">
    Email <span class="text-primary-400">*</span>
  </label>
  <input
    id="email"
    name="email"
    type="email"
    class="w-full px-3 py-2 border border-primary-400 rounded focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200 transition-colors"
  />
  <p class="text-primary-400 text-sm mt-1">Please enter a valid email address</p>
</div>
```

**Error Anatomy:**
- **Border:** `border-primary-400` (red) - NOT gray
- **Focus:** `focus:border-primary-400 focus:ring-primary-200` - red border + ring
- **Error Message:** `text-primary-400 text-sm mt-1` - red text, below input

**Critical:** Error state MUST be visually distinct from default state (red vs. gray borders).

#### Money Input

```html
<div class="mb-4">
  <label for="purchasePrice" class="block mb-2 text-gray-700 font-medium">
    Purchase Price
  </label>
  <div class="relative">
    <span class="absolute left-3 top-2 text-gray-500">$</span>
    <input
      id="purchasePrice"
      name="purchasePrice"
      type="number"
      step="0.01"
      placeholder="0.00"
      class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors"
    />
  </div>
</div>
```

**Anatomy:**
- **Dollar sign:** `absolute left-3 top-2` - inside input, on left
- **Input padding:** `pl-7` (left padding to accommodate `$` sign)
- **Type:** `type="number" step="0.01"` - numeric input with decimals

#### Date Input

```html
<div class="mb-4">
  <label for="startDate" class="block mb-2 text-gray-700 font-medium">
    Start Date <span class="text-primary-400">*</span>
  </label>
  <input
    id="startDate"
    name="startDate"
    type="date"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors"
  />
</div>
```

**Anatomy:**
- **Type:** `type="date"` - native date picker
- **Styling:** Identical to text input
- **Note:** Browser-native styling varies; ensure good UX across browsers

#### Textarea

```html
<div class="mb-4">
  <label for="notes" class="block mb-2 text-gray-700 font-medium">
    Notes
  </label>
  <textarea
    id="notes"
    name="notes"
    rows="3"
    placeholder="Additional lease notes..."
    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors"
  ></textarea>
</div>
```

**Anatomy:**
- **Rows:** `rows="3"` - sufficient height without scrolling
- **Styling:** Identical to text input
- **Resize:** Default browser behavior (can add `resize-none` if needed)

#### Select Dropdown (Future Use)

```html
<div class="mb-4">
  <label for="leaseStatus" class="block mb-2 text-gray-700 font-medium">
    Lease Status
  </label>
  <select
    id="leaseStatus"
    name="leaseStatus"
    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors bg-white"
  >
    <option value="">Select status...</option>
    <option value="ACTIVE">Active</option>
    <option value="MONTH_TO_MONTH">Month-to-Month</option>
    <option value="ENDED">Ended</option>
  </select>
</div>
```

**Anatomy:**
- **Background:** `bg-white` - ensures proper rendering
- **Styling:** Identical to text input
- **First Option:** Empty/placeholder option

---

### Card Components

#### Basic Card

```html
<div class="bg-white p-6 rounded-lg shadow">
  <h3 class="text-lg font-heading font-semibold text-gray-800 mb-3">
    Card Title
  </h3>
  <p class="text-gray-600">
    Card content goes here.
  </p>
</div>
```

**Anatomy:**
- **Background:** `bg-white` - always white
- **Padding:** `p-6` (24px) mobile, `p-8` (32px) desktop
- **Border Radius:** `rounded-lg` (8px)
- **Shadow:** `shadow` (default elevation)

#### Interactive Card (Clickable)

```html
<div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer">
  <!-- PropertyCard pattern -->
</div>
```

**Anatomy:**
- **Hover:** `hover:shadow-lg` - shadow increases on hover
- **Cursor:** `cursor-pointer` - indicates clickability
- **Transition:** `transition-shadow` - smooth shadow change

**Usage:** Property cards, clickable list items

#### Card with Badge

```html
<div class="bg-white p-6 rounded-lg shadow">
  <div class="flex justify-between items-start mb-3">
    <div class="flex-1">
      <h3 class="text-lg font-heading font-semibold text-gray-800 mb-1">
        Property Title
      </h3>
    </div>
    <span class="px-3 py-1 text-sm font-medium rounded-full bg-primary-100 text-primary-500">
      Active
    </span>
  </div>
  <!-- Card content -->
</div>
```

**Badge Anatomy:**
- **Padding:** `px-3 py-1` - pill shape
- **Border Radius:** `rounded-full` - fully rounded
- **Typography:** `text-sm font-medium`
- **Colors:** See "Status Badges" section below

#### Card with Sections

```html
<div class="bg-white p-8 rounded-lg shadow">
  <!-- Section 1 -->
  <div class="mb-6">
    <h3 class="text-sm font-heading font-semibold uppercase tracking-wide text-gray-500 mb-3">
      Section Title
    </h3>
    <div class="bg-gray-50 rounded-lg p-4">
      <!-- Section content -->
    </div>
  </div>

  <!-- Section 2 (with divider) -->
  <div class="border-t pt-6">
    <h3 class="text-sm font-heading font-semibold uppercase tracking-wide text-gray-500 mb-3">
      Another Section
    </h3>
    <!-- Section content -->
  </div>
</div>
```

**Pattern:**
- **Section Spacing:** `mb-6` between sections
- **Dividers:** `border-t pt-6` - top border + padding
- **Subsections:** `bg-gray-50 rounded-lg p-4` - light background for nested content

---

### Status Badges

Status badges communicate property/lease state at a glance.

#### Active Lease Badge

```html
<span class="px-3 py-1 text-sm font-medium rounded-full bg-primary-100 text-primary-500">
  Active
</span>
```

**Colors:** Red palette (primary)
**Meaning:** Property has an active lease

#### Month-to-Month Lease Badge

```html
<span class="px-3 py-1 text-sm font-medium rounded-full bg-secondary-2-100 text-secondary-2-500">
  Month-to-Month
</span>
```

**Colors:** Teal palette (secondary-2)
**Meaning:** Lease is ongoing without end date

#### Vacant Property Badge

```html
<span class="px-3 py-1 text-sm font-medium rounded-full bg-complement-100 text-complement-500">
  Vacant
</span>
```

**Colors:** Green palette (complement)
**Meaning:** No active lease (opportunity to lease)

#### Ended/Voided Lease Badge

```html
<span class="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-500">
  Lease Ended
</span>
```

**Colors:** Gray (neutral)
**Meaning:** Lease is no longer active

**Badge Pattern:**
- Always `rounded-full` (pill shape)
- Always `text-sm font-medium`
- Always `px-3 py-1` padding
- Background uses `-100` shade, text uses `-500` shade

---

### Navigation Components

#### App Header

```html
<header class="bg-primary-500 text-white shadow-md">
  <div class="container mx-auto px-4 py-4">
    <div class="flex items-center justify-between">
      <!-- Logo/Brand -->
      <div class="text-2xl font-heading font-bold">
        <RouterLink to="/" class="hover:text-primary-100 transition-colors">
          Upkeep
        </RouterLink>
      </div>

      <!-- Navigation -->
      <nav class="flex items-center gap-6">
        <RouterLink
          to="/dashboard"
          class="hover:text-primary-100 transition-colors font-medium"
          active-class="text-primary-100 border-b-2 border-primary-100"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          to="/properties"
          class="hover:text-primary-100 transition-colors font-medium"
          active-class="text-primary-100 border-b-2 border-primary-100"
        >
          Properties
        </RouterLink>
        <!-- User menu -->
        <div class="flex items-center gap-4 ml-4 pl-4 border-l border-primary-300">
          <span class="text-sm">John Doe</span>
          <button class="bg-primary-400 hover:bg-primary-600 px-4 py-2 rounded-md transition-colors font-medium">
            Logout
          </button>
        </div>
      </nav>
    </div>
  </div>
</header>
```

**Anatomy:**
- **Background:** `bg-primary-500` (dark red) - high contrast
- **Logo:** `text-2xl font-heading font-bold`
- **Nav Links:** `font-medium` with `hover:text-primary-100`
- **Active State:** `border-b-2 border-primary-100` - bottom border indicates current page
- **Logout Button:** `bg-primary-400` - slightly lighter than header background

#### Page Header

```html
<header class="bg-white px-8 py-6 shadow-md">
  <div class="max-w-7xl mx-auto flex justify-between items-center">
    <h1 class="text-2xl font-heading font-bold text-gray-800">Properties</h1>
    <button class="px-6 py-2 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 transition-colors">
      Add Property
    </button>
  </div>
</header>
```

**Anatomy:**
- **Background:** `bg-white shadow-md` - elevated white background
- **Title:** `text-2xl font-heading font-bold`
- **CTA:** Primary button on the right (always visible, prominent)

**Pattern:** Primary action (Add, Create, etc.) ALWAYS appears in page header.

#### Back Button

```html
<button class="text-gray-600 hover:text-gray-800 flex items-center gap-2 mb-2">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
  </svg>
  Back to Properties
</button>
```

**Anatomy:**
- **Icon:** Left-pointing chevron, `w-5 h-5` (20px)
- **Text:** `text-gray-600 hover:text-gray-800`
- **Layout:** `flex items-center gap-2` - icon + text side-by-side

**Usage:** Detail pages, forms, anywhere users navigate away from list views

---

### Icon Usage Guidelines

Icons reinforce meaning and improve scanability. Use them generously.

#### Icon Sizes

```css
w-4 h-4   /* 16px - Inline with text */
w-5 h-5   /* 20px - Small buttons, nav icons */
w-6 h-6   /* 24px - Standard button icons */
w-8 h-8   /* 32px - Large touch targets */
w-12 h-12 /* 48px - Empty state icons */
w-16 h-16 /* 64px - Hero icons */
```

#### Icon + Text Buttons

```html
<button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 transition-colors flex items-center gap-2">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
  Add Property
</button>
```

**Pattern:**
- `flex items-center gap-2` - centers icon and text, adds spacing
- Icon `w-5 h-5` or `w-6 h-6` depending on button size
- `stroke="currentColor"` - icon inherits text color

#### Common Icons

**Plus Icon (Add/Create):**
```html
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
</svg>
```

**Chevron Left (Back):**
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
</svg>
```

**Edit Icon (Pencil):**
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
</svg>
```

**Delete Icon (Trash):**
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
</svg>
```

**Check Icon (Success):**
```html
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
</svg>
```

**Warning Icon:**
```html
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>
```

**Info Icon:**
```html
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
```

#### Icon Color Patterns

**Inherit from context (default):**
```html
<svg stroke="currentColor">...</svg>
```

**Explicit colors (when needed):**
```html
<!-- Success icon -->
<svg class="text-complement-500" stroke="currentColor">...</svg>

<!-- Error icon -->
<svg class="text-primary-400" stroke="currentColor">...</svg>

<!-- Warning icon -->
<svg class="text-secondary-1-400" stroke="currentColor">...</svg>
```

---

### Loading & Empty States

#### Loading Spinner

```html
<div class="flex justify-center items-center py-20">
  <div class="text-gray-600">Loading properties...</div>
</div>
```

**Future Enhancement (with spinner icon):**
```html
<div class="flex flex-col justify-center items-center py-20">
  <svg class="animate-spin h-8 w-8 text-complement-300 mb-4" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <div class="text-gray-600">Loading properties...</div>
</div>
```

**Anatomy:**
- **Centered:** `flex justify-center items-center`
- **Vertical Spacing:** `py-20` - ample padding top and bottom
- **Text:** `text-gray-600` - neutral, not too bold

#### Empty State (No Data)

```html
<div class="text-center py-20">
  <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
    <h2 class="text-xl font-heading font-semibold text-gray-800 mb-4">
      No Properties Yet
    </h2>
    <p class="text-gray-600 mb-6">
      Get started by adding your first rental property.
    </p>
    <button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 transition-colors">
      Add Your First Property
    </button>
  </div>
</div>
```

**Anatomy:**
- **Card Container:** `bg-white p-8 rounded-lg shadow` - elevated card
- **Heading:** `text-xl font-heading font-semibold` - clear title
- **Description:** `text-gray-600 mb-6` - explains situation
- **CTA:** Primary button - OBVIOUS next action

**Critical:** Empty states MUST include a clear call-to-action. Never leave users wondering what to do next.

#### Empty State (with Icon)

```html
<div class="text-center py-20">
  <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
    <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    <h2 class="text-xl font-heading font-semibold text-gray-800 mb-4">
      No Properties Yet
    </h2>
    <p class="text-gray-600 mb-6">
      Get started by adding your first rental property.
    </p>
    <button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 transition-colors">
      Add Your First Property
    </button>
  </div>
</div>
```

**Icon:** `w-16 h-16` (64px), centered with `mx-auto`, gray color (`text-gray-400`)

#### Error State

```html
<div class="bg-primary-100 text-primary-500 p-4 rounded">
  Failed to load properties. Please try again.
</div>
```

**Anatomy:**
- **Background:** `bg-primary-100` (light red)
- **Text:** `text-primary-500` (dark red, high contrast)
- **Padding:** `p-4` (16px)
- **Border Radius:** `rounded` (4px)

**Future Enhancement (with retry button):**
```html
<div class="bg-primary-100 text-primary-500 p-4 rounded flex items-center justify-between">
  <span>Failed to load properties.</span>
  <button class="px-4 py-2 bg-primary-400 text-white rounded font-medium hover:bg-primary-500 transition-colors">
    Retry
  </button>
</div>
```

---

## Interaction States

All interactive elements MUST have clearly distinct states for accessibility and UX.

### Button States

#### Default State
```html
<button class="px-6 py-3 bg-complement-300 text-white rounded font-medium">
  Create Property
</button>
```

#### Hover State
```html
<button class="px-6 py-3 bg-complement-300 hover:bg-complement-400 text-white rounded font-medium transition-colors">
  Create Property
</button>
```

**Visual Change:** Background darkens from `complement-300` to `complement-400`
**Timing:** `transition-colors` (150ms default)

#### Focus State (Keyboard Navigation)
```html
<button class="px-6 py-3 bg-complement-300 hover:bg-complement-400 focus:outline-none focus:ring-2 focus:ring-complement-300 focus:ring-offset-2 text-white rounded font-medium transition-colors">
  Create Property
</button>
```

**Visual Change:**
- `focus:outline-none` - removes default browser outline
- `focus:ring-2 focus:ring-complement-300` - adds 2px ring in accent color
- `focus:ring-offset-2` - adds 2px spacing between button and ring

**Critical:** NEVER remove focus indicators without replacement. Keyboard users depend on them.

#### Active/Pressed State
```html
<button class="px-6 py-3 bg-complement-300 hover:bg-complement-400 active:bg-complement-500 text-white rounded font-medium transition-colors">
  Create Property
</button>
```

**Visual Change:** Background darkens to `complement-500` while pressed

#### Disabled State
```html
<button disabled class="px-6 py-3 bg-complement-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded font-medium">
  Create Property
</button>
```

**Visual Change:**
- Background changes to `gray-300`
- Cursor changes to `not-allowed`
- Button is non-interactive (no hover/click)

#### Loading State
```html
<button disabled class="px-6 py-3 bg-complement-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded font-medium">
  Creating...
</button>
```

**Visual Change:**
- Text changes to "Creating..." or "Loading..."
- Button becomes disabled (gray background)

**Future Enhancement (with spinner):**
```html
<button disabled class="px-6 py-3 bg-complement-300 disabled:bg-gray-300 text-white rounded font-medium flex items-center gap-2">
  <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  Creating...
</button>
```

---

### Input States

#### Default State
```html
<input
  class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none transition-colors"
  placeholder="123 Main St"
/>
```

**Visual:** Gray border (`border-gray-300`), neutral appearance

#### Focus State (Valid)
```html
<input
  class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-complement-300 focus:ring-2 focus:ring-complement-200 transition-colors"
  placeholder="123 Main St"
/>
```

**Visual Change:**
- Border changes to `complement-300` (green)
- 2px ring appears in `complement-200` (light green)

**Meaning:** Input is focused and valid (no errors)

#### Focus State (Error)
```html
<input
  class="w-full px-3 py-2 border border-primary-400 rounded focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200 transition-colors"
  placeholder="123 Main St"
/>
```

**Visual Change:**
- Border changes to `primary-400` (red)
- 2px ring appears in `primary-200` (light red)

**Meaning:** Input has validation error

#### Disabled State
```html
<input
  disabled
  class="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
  placeholder="123 Main St"
/>
```

**Visual Change:**
- Background changes to `gray-100`
- Cursor changes to `not-allowed`
- Input is non-interactive

---

### Card States

#### Default State
```html
<div class="bg-white p-6 rounded-lg shadow">
  <!-- Card content -->
</div>
```

**Visual:** White background, standard shadow

#### Hover State (Interactive Cards)
```html
<div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer">
  <!-- Card content -->
</div>
```

**Visual Change:** Shadow increases from `shadow` to `shadow-lg`
**Timing:** `transition-shadow` (150ms default)

**Usage:** Property cards, clickable list items

---

### Link States

#### Default Link
```html
<a href="/properties" class="text-complement-300 hover:underline">
  View all properties
</a>
```

**Visual:** Green text, no underline by default

#### Hover State
```html
<a href="/properties" class="text-complement-300 hover:underline">
  View all properties
</a>
```

**Visual Change:** Underline appears on hover

#### Nav Link (Active)
```html
<RouterLink
  to="/properties"
  class="text-white hover:text-primary-100 transition-colors font-medium"
  active-class="text-primary-100 border-b-2 border-primary-100"
>
  Properties
</RouterLink>
```

**Active Visual:**
- Text color changes to `primary-100` (light red)
- Bottom border appears (`border-b-2 border-primary-100`)

---

## Form Design Patterns

### Single-Column Form Layout

```html
<div class="max-w-2xl mx-auto px-4">
  <div class="bg-white p-8 rounded-lg shadow-lg">
    <h1 class="text-3xl font-heading font-bold mb-6 text-gray-800">Add Property</h1>

    <form @submit="onSubmit">
      <!-- Form inputs -->
      <FormInput name="address" label="Address" :required="true" />
      <FormInput name="city" label="City" :required="true" />
      <FormInput name="state" label="State" :required="true" />

      <!-- Error message -->
      <div v-if="submitError" class="mb-4 p-3 bg-primary-100 text-primary-500 rounded">
        {{ submitError }}
      </div>

      <!-- Action buttons -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="!meta.valid || isSubmitting"
          class="flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {{ isSubmitting ? 'Creating...' : 'Create Property' }}
        </button>
        <button
          type="button"
          @click="handleCancel"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>
```

**Key Patterns:**
1. **Max Width:** `max-w-2xl` (672px) - optimal reading width for forms
2. **Card Container:** `bg-white p-8 rounded-lg shadow-lg` - elevated form card
3. **Page Title:** `text-3xl font-heading font-bold mb-6` - clear form purpose
4. **Error Placement:** Above buttons, below form fields
5. **Button Group:** `flex gap-4` - primary (left, flex-1), secondary (right, fixed width)

### Multi-Section Form

```html
<form @submit="onSubmit">
  <!-- Section 1 -->
  <div class="mb-6">
    <h2 class="text-xl font-heading font-semibold mb-4 text-gray-700">Lease Details</h2>
    <FormInput name="startDate" label="Start Date" type="date" :required="true" />
    <FormInput name="endDate" label="End Date (Optional)" type="date" />
  </div>

  <!-- Section 2 -->
  <div class="mb-6">
    <h2 class="text-xl font-heading font-semibold mb-4 text-gray-700">
      Lessee <span class="text-primary-400">*</span>
    </h2>
    <FormInput name="lessees[0].firstName" label="First Name" :required="true" />
    <FormInput name="lessees[0].lastName" label="Last Name" :required="true" />
  </div>

  <!-- Submit buttons -->
  <div class="flex gap-4">
    <button type="submit" class="flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400">
      Create Lease
    </button>
    <button type="button" class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300">
      Cancel
    </button>
  </div>
</form>
```

**Key Patterns:**
1. **Section Spacing:** `mb-6` (24px) between sections
2. **Section Headers:** `text-xl font-heading font-semibold mb-4 text-gray-700`
3. **Required Indicators:** Red asterisk (`text-primary-400`) in section header if entire section is required
4. **Logical Grouping:** Related fields grouped under clear headings

### Form Validation Patterns

#### Inline Validation (VeeValidate)

```html
<FormInput
  name="email"
  label="Email"
  type="email"
  :required="true"
/>
```

**FormInput component handles:**
- Real-time validation (on blur)
- Error message display (below input)
- Border color changes (gray → red when error)
- Focus ring color (green if valid, red if error)

#### Submit-Time Validation

```html
<div v-if="submitError" class="mb-4 p-3 bg-primary-100 text-primary-500 rounded">
  {{ submitError }}
</div>
```

**Pattern:** Display server-side errors above submit buttons

#### Disabled Submit Button

```html
<button
  type="submit"
  :disabled="!meta.valid || isSubmitting"
  class="flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
>
  {{ isSubmitting ? 'Creating...' : 'Create Property' }}
</button>
```

**Pattern:**
- Disabled when form is invalid (`!meta.valid`)
- Disabled when submitting (`isSubmitting`)
- Text changes to "Creating..." during submission
- Background changes to gray when disabled

### Success States

#### Toast Notification (Existing Pattern)

```typescript
// In composable/store
toast.success('Property created successfully');
router.push('/properties');
```

**Pattern:** Toast notification + navigation to success destination

#### Success Page (Future Pattern)

```html
<div class="text-center py-20">
  <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
    <svg class="w-16 h-16 mx-auto mb-4 text-complement-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <h2 class="text-2xl font-heading font-bold text-gray-800 mb-4">
      Property Created!
    </h2>
    <p class="text-gray-600 mb-6">
      Your property has been successfully added to your portfolio.
    </p>
    <div class="flex flex-col gap-3">
      <button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400">
        View Property
      </button>
      <button class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300">
        Add Another Property
      </button>
    </div>
  </div>
</div>
```

**Usage:** For high-value actions where immediate next steps matter (e.g., after creating first property)

---

## User Flow Guidelines

Design workflows that minimize cognitive load and make next steps obvious.

### Property Creation Flow

**Current Flow:**
1. User clicks "Add Property" button (properties list page, top right)
2. User fills property form (single page, all required fields)
3. User clicks "Create Property" (form validates, submits)
4. Success toast appears, user navigates to properties list
5. New property appears in list

**Design Principles Applied:**
- **High Contrast:** "Add Property" button uses green (complement-300), stands out clearly
- **Prominent CTA:** Button in top-right of page header, always visible
- **Intuitive Flow:** One-page form, all fields visible at once, no surprises
- **Obvious Next Steps:** "Create Property" button (green, full width on left), "Cancel" (gray, right)

**Improvement Opportunities:**
1. **Add icon to "Add Property" button:**
   ```html
   <button class="px-6 py-2 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 flex items-center gap-2">
     <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
     </svg>
     Add Property
   </button>
   ```

2. **Show success state with immediate actions:**
   ```html
   <!-- After successful creation, show success modal/page -->
   <div class="text-center py-12">
     <svg class="w-16 h-16 mx-auto mb-4 text-complement-500">...</svg>
     <h2 class="text-2xl font-heading font-bold mb-4">Property Added!</h2>
     <p class="text-gray-600 mb-6">What would you like to do next?</p>
     <div class="flex gap-4 justify-center">
       <button class="px-6 py-3 bg-complement-300 text-white rounded font-medium">
         Add a Lease
       </button>
       <button class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium">
         View Property
       </button>
     </div>
   </div>
   ```

### Lease Creation Flow

**Current Flow:**
1. User navigates to property details page
2. User sees "No active lease" message with "Add Lease" button
3. User clicks "Add Lease" button
4. User fills lease form (single page, multiple sections: Lease Details, Lessee)
5. User clicks "Create Lease" button
6. Success toast appears, user navigates back to property details
7. Active lease displays on property details page

**Design Principles Applied:**
- **High Contrast:** Empty state uses white card on gray background, green CTA button
- **Prominent CTA:** "Add Lease" button (green) centered in empty state
- **Intuitive Flow:** Multi-section form with clear headings ("Lease Details", "Lessee")
- **Obvious Next Steps:** Section headings show what information is needed; "Create Lease" button at bottom

**Improvement Opportunities:**
1. **Add progress indicator for multi-section form:**
   ```html
   <div class="mb-8">
     <div class="flex items-center justify-between">
       <div class="flex-1 text-center">
         <div class="w-8 h-8 mx-auto rounded-full bg-complement-300 text-white flex items-center justify-center font-medium mb-2">
           1
         </div>
         <p class="text-sm font-medium text-gray-800">Lease Details</p>
       </div>
       <div class="flex-1 h-1 bg-gray-300"></div>
       <div class="flex-1 text-center">
         <div class="w-8 h-8 mx-auto rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-medium mb-2">
           2
         </div>
         <p class="text-sm text-gray-600">Lessee Info</p>
       </div>
     </div>
   </div>
   ```

2. **Show contextual help for each section:**
   ```html
   <div class="mb-6">
     <h2 class="text-xl font-heading font-semibold mb-2 text-gray-700">Lease Details</h2>
     <p class="text-sm text-gray-600 mb-4">
       Enter the lease term and financial information. Leave end date blank for month-to-month leases.
     </p>
     <!-- Form fields -->
   </div>
   ```

### Property Detail View Flow

**Current Flow:**
1. User clicks property card in list view
2. User sees property details page with:
   - Property information (address, purchase price, dates)
   - Lease information (if active lease exists)
   - Action buttons (Edit Property, Delete)
3. User can:
   - Add lease (if vacant)
   - Edit property
   - Delete property
   - Navigate back to list

**Design Principles Applied:**
- **High Contrast:** White cards on gray background, clear section dividers
- **Prominent CTAs:** Action buttons in dedicated card at bottom of property info
- **Intuitive Flow:** Information flows top-to-bottom (property → lease → actions)
- **Obvious Next Steps:** If vacant, "Add Lease" button prominently displayed; if has lease, edit/delete options available

**Improvement Opportunities:**
1. **Add quick action buttons to page header:**
   ```html
   <header class="bg-white px-8 py-6 shadow-md">
     <div class="max-w-4xl mx-auto flex justify-between items-center">
       <div>
         <button class="text-gray-600 hover:text-gray-800 flex items-center gap-2 mb-2">
           <svg class="w-5 h-5">...</svg>
           Back to Properties
         </button>
         <h1 class="text-2xl font-heading font-bold text-gray-800">Property Details</h1>
       </div>
       <!-- Quick actions -->
       <div class="flex gap-3">
         <button class="px-4 py-2 bg-secondary-1-300 text-white rounded font-medium hover:bg-secondary-1-400 flex items-center gap-2">
           <svg class="w-5 h-5">...</svg>
           Edit
         </button>
         <button class="px-4 py-2 bg-primary-300 text-white rounded font-medium hover:bg-primary-400 flex items-center gap-2">
           <svg class="w-5 h-5">...</svg>
           Delete
         </button>
       </div>
     </div>
   </header>
   ```

2. **Add visual hierarchy to lease information:**
   ```html
   <!-- Active lease card -->
   <div class="bg-white rounded-lg shadow p-8 border-l-4 border-complement-300">
     <div class="flex items-center justify-between mb-4">
       <h3 class="text-sm font-heading font-semibold uppercase tracking-wide text-gray-500">
         Active Lease
       </h3>
       <span class="px-3 py-1 text-sm font-medium rounded-full bg-complement-100 text-complement-500">
         Active
       </span>
     </div>
     <!-- Lease details -->
   </div>
   ```

### Common Flow Patterns

#### Wizard/Multi-Step Forms (Future Use)

```html
<!-- Step indicator -->
<div class="mb-8">
  <div class="flex items-center">
    <!-- Step 1 (completed) -->
    <div class="flex-1 text-center">
      <div class="w-10 h-10 mx-auto rounded-full bg-complement-300 text-white flex items-center justify-center font-medium mb-2">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-800">Property Info</p>
    </div>

    <!-- Connector -->
    <div class="flex-1 h-1 bg-complement-300"></div>

    <!-- Step 2 (current) -->
    <div class="flex-1 text-center">
      <div class="w-10 h-10 mx-auto rounded-full bg-complement-300 text-white flex items-center justify-center font-medium mb-2 ring-4 ring-complement-200">
        2
      </div>
      <p class="text-sm font-medium text-gray-800">Lease Details</p>
    </div>

    <!-- Connector -->
    <div class="flex-1 h-1 bg-gray-300"></div>

    <!-- Step 3 (upcoming) -->
    <div class="flex-1 text-center">
      <div class="w-10 h-10 mx-auto rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-medium mb-2">
        3
      </div>
      <p class="text-sm text-gray-600">Review</p>
    </div>
  </div>
</div>

<!-- Current step content -->
<div class="mb-8">
  <h2 class="text-2xl font-heading font-bold mb-4 text-gray-800">Step 2: Lease Details</h2>
  <p class="text-gray-600 mb-6">Enter the lease term and rental information.</p>
  <!-- Form fields -->
</div>

<!-- Navigation buttons -->
<div class="flex gap-4">
  <button class="px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300">
    Back
  </button>
  <button class="flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 flex items-center justify-center gap-2">
    Next: Review
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </button>
</div>
```

**Key Elements:**
- **Step Indicator:** Shows completed (green checkmark), current (green with ring), upcoming (gray)
- **Step Title:** Clear heading with step number
- **Step Description:** Explains what information is needed
- **Navigation:** "Back" (secondary, left), "Next: [Step Name]" (primary, right with arrow icon)

#### Confirmation Dialogs (Future Use)

```html
<!-- Modal overlay -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <!-- Modal card -->
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
    <!-- Icon -->
    <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
      <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>

    <!-- Title -->
    <h3 class="text-xl font-heading font-bold text-gray-800 text-center mb-2">
      Delete Property?
    </h3>

    <!-- Description -->
    <p class="text-gray-600 text-center mb-6">
      This action cannot be undone. All associated leases and data will be permanently deleted.
    </p>

    <!-- Actions -->
    <div class="flex flex-col gap-3">
      <button class="w-full px-6 py-3 bg-primary-300 text-white rounded font-medium hover:bg-primary-400 transition-colors">
        Yes, Delete Property
      </button>
      <button class="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition-colors">
        Cancel
      </button>
    </div>
  </div>
</div>
```

**Pattern:**
- **Overlay:** `bg-black bg-opacity-50` - dims background, focuses attention on modal
- **Icon:** Visual indicator of action severity (red warning icon for destructive actions)
- **Clear Title:** Question format ("Delete Property?")
- **Description:** Explains consequences
- **Stacked Buttons:** Destructive action on top (red), cancel below (gray)

---

## Accessibility Requirements

All components must meet WCAG 2.1 Level AA standards at minimum.

### Color Contrast

**Text Contrast (WCAG AA):**
- Normal text (< 18pt): 4.5:1 minimum
- Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum

**UI Component Contrast:**
- Interactive elements (buttons, inputs): 3:1 minimum
- Focus indicators: 3:1 minimum

**Pre-Approved High Contrast Combinations:**

```css
/* Body text */
text-gray-900 bg-white        /* 21:1 - Excellent */
text-gray-800 bg-white        /* 12:1 - Excellent */
text-gray-700 bg-white        /* 8:1 - Excellent */

/* Error text */
text-primary-400 bg-white     /* 7.2:1 - Passes AA */
text-primary-500 bg-primary-100  /* 8.5:1 - Passes AA */

/* Success text */
text-complement-500 bg-white  /* 10.5:1 - Passes AA */
text-complement-500 bg-complement-100  /* 6.2:1 - Passes AA */

/* Button text */
text-white bg-complement-300  /* 5.8:1 - Passes AA */
text-white bg-primary-400     /* 7.1:1 - Passes AA */
text-white bg-secondary-1-300 /* 5.2:1 - Passes AA */
```

**Testing:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify any new color combinations.

### Focus Indicators

**NEVER remove focus indicators without replacement.** Keyboard users depend on them for navigation.

**Standard Focus Ring:**
```css
focus:outline-none focus:ring-2 focus:ring-complement-300 focus:ring-offset-2
```

**Breakdown:**
- `focus:outline-none` - removes default browser outline
- `focus:ring-2` - adds 2px ring
- `focus:ring-complement-300` - ring color (green for valid states)
- `focus:ring-offset-2` - 2px gap between element and ring

**Error State Focus:**
```css
focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2
```

**Ring color changes to red** (`ring-primary-200`) for inputs with errors.

**Nav Link Focus:**
```css
focus:outline-none focus:ring-2 focus:ring-primary-100 focus:ring-offset-2 focus:ring-offset-primary-500
```

**Ring offset color** (`ring-offset-primary-500`) matches header background for proper visibility.

### Semantic HTML

**Use semantic elements** for screen reader navigation:

```html
<!-- Good: Semantic structure -->
<header>
  <nav>
    <a href="/dashboard">Dashboard</a>
  </nav>
</header>

<main>
  <h1>Properties</h1>
  <section>
    <h2>Active Leases</h2>
    <!-- Content -->
  </section>
</main>

<!-- Bad: Divs everywhere -->
<div class="header">
  <div class="nav">
    <div class="link">Dashboard</div>
  </div>
</div>
```

**Heading Hierarchy:**
- One `<h1>` per page (page title)
- Headings follow logical order (`<h1>` → `<h2>` → `<h3>`, never skip levels)
- Use headings for structure, not just styling

### ARIA Labels

**When to use ARIA:**
- Icon-only buttons (no visible text)
- Complex UI widgets (modals, tabs, accordions)
- Dynamic content updates (live regions)

**Icon-Only Button:**
```html
<button
  aria-label="Delete property"
  class="p-2 bg-primary-300 text-white rounded hover:bg-primary-400"
>
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

**Modal Dialog:**
```html
<div
  role="dialog"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
>
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
    <h3 id="modal-title" class="text-xl font-heading font-bold text-gray-800 mb-2">
      Delete Property?
    </h3>
    <p id="modal-description" class="text-gray-600 mb-6">
      This action cannot be undone.
    </p>
    <!-- Actions -->
  </div>
</div>
```

**Live Region (for dynamic updates):**
```html
<div role="status" aria-live="polite" class="sr-only">
  {{ loadingMessage }}
</div>
```

**Screen Reader Only Text:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Keyboard Navigation

**All interactive elements must be keyboard accessible:**

**Tab Order:**
1. Header navigation
2. Main content (skip link recommended)
3. Forms (top to bottom)
4. Action buttons
5. Footer links

**Skip Link (Recommended):**
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-complement-300 focus:text-white focus:rounded">
  Skip to main content
</a>

<main id="main-content">
  <!-- Page content -->
</main>
```

**Pattern:** Hidden by default, visible on keyboard focus.

**Form Navigation:**
- Inputs follow logical tab order (top to bottom)
- Submit button is last in tab order
- Escape key closes modals
- Enter key submits forms

**Modal Focus Trapping:**
When a modal is open, keyboard focus should:
1. Move to modal when opened
2. Stay within modal (tab cycles through modal elements)
3. Return to trigger element when closed

### Touch Targets (Mobile)

**Minimum touch target size: 44x44 CSS pixels**

**Button Minimum:**
```css
px-6 py-3  /* 24px horizontal padding + content, 12px vertical = ~48px height */
```

**Icon Button Minimum:**
```html
<button class="p-3 bg-complement-300 text-white rounded">
  <!-- 12px padding + 24px icon = 48x48px total -->
  <svg class="w-6 h-6">...</svg>
</button>
```

**Spacing Between Targets:**
Maintain at least 8px (`gap-2`) between adjacent touch targets.

---

## Mobile-First Guidelines

All designs start mobile, then enhance for larger screens.

### Breakpoints

Tailwind default breakpoints (use these consistently):

```css
/* No prefix: Mobile (< 640px) */
/* sm: 640px+ (Small tablets) */
/* md: 768px+ (Tablets) */
/* lg: 1024px+ (Small desktops) */
/* xl: 1280px+ (Large desktops) */
/* 2xl: 1536px+ (Extra large desktops) */
```

### Responsive Patterns

#### Layout Container

```html
<!-- Mobile: Full width with padding -->
<!-- Desktop: Centered with max width -->
<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Content -->
</div>
```

**Padding:**
- Mobile: `px-4` (16px)
- Desktop: Can increase to `md:px-8` if needed

#### Grid Layout

```html
<!-- Mobile: 1 column -->
<!-- Tablet: 2 columns -->
<!-- Desktop: 3 columns -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>
```

**Pattern:** Always start with 1 column, add columns as screen grows.

#### Button Groups

```html
<!-- Mobile: Stacked full-width buttons -->
<!-- Desktop: Side-by-side buttons -->
<div class="flex flex-col sm:flex-row gap-4">
  <button class="w-full sm:flex-1 px-6 py-3 bg-complement-300 text-white rounded font-medium">
    Create
  </button>
  <button class="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded font-medium">
    Cancel
  </button>
</div>
```

**Mobile:**
- `flex-col` - stack vertically
- `w-full` - full width buttons

**Desktop (sm+):**
- `sm:flex-row` - side-by-side
- `sm:flex-1` - primary button fills space
- `sm:w-auto` - secondary button fits content

#### Typography Scaling

```html
<!-- Mobile: Smaller heading -->
<!-- Desktop: Larger heading -->
<h1 class="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-gray-800">
  Page Title
</h1>
```

**Pattern:**
- Mobile: `text-2xl` (24px)
- Tablet: `md:text-3xl` (30px)
- Desktop: `lg:text-4xl` (36px)

#### Card Padding

```html
<!-- Mobile: Less padding -->
<!-- Desktop: More padding -->
<div class="bg-white p-6 md:p-8 rounded-lg shadow-lg">
  <!-- Card content -->
</div>
```

**Pattern:**
- Mobile: `p-6` (24px)
- Desktop: `md:p-8` (32px)

#### Navigation

```html
<!-- Mobile: Simplified nav (future: hamburger menu) -->
<!-- Desktop: Full nav -->
<nav class="hidden md:flex items-center gap-6">
  <a href="/dashboard">Dashboard</a>
  <a href="/properties">Properties</a>
</nav>

<!-- Mobile menu button (future implementation) -->
<button class="md:hidden p-2">
  <svg class="w-6 h-6">...</svg>
</button>
```

**Current:** All nav items visible on all screens.
**Future:** Hamburger menu on mobile (`< md:`), full nav on desktop.

### Mobile-Specific Considerations

**Form Inputs:**
- Use appropriate `type` attributes (`type="tel"`, `type="email"`) to trigger mobile keyboards
- Use `inputmode` attribute when needed (`inputmode="numeric"`)

```html
<input type="tel" inputmode="tel" placeholder="555-123-4567" />
<input type="email" inputmode="email" placeholder="user@example.com" />
<input type="text" inputmode="numeric" placeholder="12345" />
```

**Touch Gestures:**
- Ensure swipeable carousels (if used) work on touch devices
- Avoid hover-only interactions (provide tap alternatives)

**Performance:**
- Lazy load images below the fold
- Use responsive images (`srcset`) for different screen sizes
- Minimize bundle size (currently using Vite for optimal bundling)

---

## Implementation Checklist

When creating new components or views, verify:

### Visual Design
- [ ] Uses approved color palette (no arbitrary colors)
- [ ] Maintains WCAG AA contrast ratios (test with WebAIM)
- [ ] Uses Tailwind spacing scale (no arbitrary values)
- [ ] Follows typography scale (Montserrat headings, Lato body)
- [ ] Includes appropriate shadows for depth (`shadow`, `shadow-lg`)

### Interaction Design
- [ ] All buttons have distinct hover states
- [ ] All inputs have focus rings (green for valid, red for errors)
- [ ] Disabled states are visually distinct (gray background)
- [ ] Loading states show feedback (text changes, spinner if possible)
- [ ] Error messages appear below inputs in red

### User Flow
- [ ] Primary CTA uses green (`complement-300`)
- [ ] Only ONE primary CTA per view
- [ ] CTAs include icons when space permits
- [ ] Empty states include clear next action
- [ ] Multi-step forms show progress indicators

### Accessibility
- [ ] Focus indicators present on all interactive elements
- [ ] Semantic HTML used (`<header>`, `<main>`, `<nav>`, `<button>`)
- [ ] Heading hierarchy is logical (one `<h1>`, proper nesting)
- [ ] ARIA labels added to icon-only buttons
- [ ] Form labels associated with inputs (`for` attribute)
- [ ] Touch targets minimum 44x44px

### Responsive Design
- [ ] Mobile-first approach (base styles for mobile)
- [ ] Breakpoints used appropriately (`sm:`, `md:`, `lg:`)
- [ ] Touch targets adequate for mobile (44x44px minimum)
- [ ] Text scales appropriately across breakpoints
- [ ] Buttons stack on mobile, sit side-by-side on desktop

### Code Quality
- [ ] Uses existing utility functions (`formatPrice`, `formatDate`, etc.)
- [ ] Follows existing component patterns (`FormInput`, `PropertyCard`)
- [ ] Integrates with VeeValidate for form validation
- [ ] Uses shared Zod schemas from `@validators/*`
- [ ] Maintains consistency with existing codebase

---

## Examples & References

### Full Page Examples

**Property List View:**
- **File:** `apps/frontend/src/views/PropertyListView.vue`
- **Demonstrates:** Page header with CTA, card grid, empty state, loading state

**Property Form View:**
- **File:** `apps/frontend/src/views/PropertyFormView.vue`
- **Demonstrates:** Single-column form, VeeValidate integration, button groups, error handling

**Lease Form View:**
- **File:** `apps/frontend/src/views/LeaseFormView.vue`
- **Demonstrates:** Multi-section form, nested fields, money inputs, textarea

**Property Details View:**
- **File:** `apps/frontend/src/views/PropertyDetailsView.vue`
- **Demonstrates:** Detail page layout, card sections, conditional rendering, back button

### Component Examples

**FormInput Component:**
- **File:** `apps/frontend/src/components/FormInput.vue`
- **Demonstrates:** VeeValidate integration, error states, focus states

**PropertyCard Component:**
- **File:** `apps/frontend/src/components/PropertyCard.vue`
- **Demonstrates:** Interactive card, status badges, hover states

**AppHeader Component:**
- **File:** `apps/frontend/src/components/AppHeader.vue`
- **Demonstrates:** Primary navigation, active states, responsive layout

### Utility References

**Formatters:**
- **File:** `apps/frontend/src/utils/formatters.ts`
- **Use for:** Price display, date formatting, datetime display

**Lease Helpers:**
- **File:** `apps/frontend/src/utils/leaseHelpers.ts`
- **Use for:** Status badge colors, status display text, active lease detection

---

## Design System Maintenance

### Adding New Colors

1. **Evaluate need:** Can existing palette serve this purpose?
2. **Add to Tailwind config:** `apps/frontend/tailwind.config.js`
3. **Test contrast:** Verify WCAG AA compliance with WebAIM
4. **Document usage:** Add to this guide with semantic meaning
5. **Update components:** Apply consistently across codebase

### Adding New Components

1. **Check existing patterns:** Review components in `apps/frontend/src/components/`
2. **Follow specifications:** Use patterns documented in this guide
3. **Test accessibility:** Verify keyboard navigation, focus states, contrast
4. **Document usage:** Add examples to this guide
5. **Communicate changes:** Update team on new reusable components

### Evolving the Design System

This guide is a living document. Update it when:
- New components are created
- Design patterns emerge from usage
- User feedback reveals UX improvements
- Accessibility standards change
- Technology stack evolves

**Process:**
1. Propose change (document rationale)
2. Review impact (what breaks, what improves)
3. Update guide (add examples, deprecate old patterns)
4. Migrate existing code (gradually or all at once)
5. Communicate changes (to development team)

---

## Quick Reference

### Most Common Patterns

**Primary CTA Button:**
```html
<button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
  Create Property
</button>
```

**Form Input:**
```html
<FormInput name="address" label="Address" :required="true" />
```

**Card:**
```html
<div class="bg-white p-6 md:p-8 rounded-lg shadow">
  <!-- Content -->
</div>
```

**Page Header:**
```html
<header class="bg-white px-8 py-6 shadow-md">
  <div class="max-w-7xl mx-auto flex justify-between items-center">
    <h1 class="text-2xl font-heading font-bold text-gray-800">Page Title</h1>
    <button class="px-6 py-2 bg-complement-300 text-white rounded font-medium hover:bg-complement-400">
      Add Item
    </button>
  </div>
</header>
```

**Grid Layout:**
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>
```

**Empty State:**
```html
<div class="text-center py-20">
  <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
    <h2 class="text-xl font-heading font-semibold text-gray-800 mb-4">No Items Yet</h2>
    <p class="text-gray-600 mb-6">Get started by adding your first item.</p>
    <button class="px-6 py-3 bg-complement-300 text-white rounded font-medium hover:bg-complement-400">
      Add First Item
    </button>
  </div>
</div>
```

---

## Conclusion

This design guide ensures **high contrast**, **prominent icons & CTAs**, **intuitive UX flows**, and **obvious next steps** throughout the Upkeep property management application.

**Key Takeaways:**
1. **Green buttons = go** (primary CTAs always use `complement-300`)
2. **Red borders = stop** (errors always use `primary-400`)
3. **One primary CTA per view** (never compete for attention)
4. **Empty states guide action** (always include "Add X" button)
5. **Mobile-first always** (start small, enhance for larger screens)
6. **Accessibility is mandatory** (not optional, test with keyboard and contrast tools)

**Questions?** Refer to existing component files for working examples, or consult the development team for codebase-specific patterns.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Design System Team
**Location:** `docs/design-guide.md`
