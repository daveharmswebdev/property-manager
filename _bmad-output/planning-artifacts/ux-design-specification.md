# property-manager UX Design Specification

_Created on 2025-11-28 by Dave_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

**Project:** Property Manager - A web application that transforms paper-based rental property expense tracking into organized, tax-ready financial records for Schedule E reporting. Built for small landlords managing 14 rental properties as a side business.

**Core Value Proposition:** "From Shoebox to Schedule E" - Enter expenses easily throughout the year, get accountant-ready reports at tax time.

**Target Users:**
- **Primary User:** Dave's wife - non-technical, busy professional who currently uses Google Sheets. Batches work (collects receipts through the week, enters data at home on desktop). Needs simple, fast expense entry with zero learning curve.
- **Secondary User:** Dave - technical owner using this as a cloud computing learning project. Manages the system but not the primary daily user.

**Platform:** Web application (SPA)
- Mobile Safari (iOS) - Receipt capture while out
- Desktop Chrome - Primary data entry and reporting

**Design Philosophy:** "Obvious, not clever" - The UI must be immediately understandable without explanation. Friendly, colorful, big buttons, clear labels.

### Core Experience

**Primary Action:** Track expenses (add, categorize, attach receipts)

**The Question It Answers:** "How much is this all costing us?"

**Why It Matters:** Enables business decisions - adjust rent, group maintenance, plan capital improvements. The app is a means to an end; expense tracking should be friction-free so mental energy goes to business decisions, not data entry.

**Platform Priority:**
- Desktop (80%+): Primary for data entry, reviewing expenses, generating reports
- Mobile (20%): Convenience for receipt capture while out

### Key Interaction Pattern: Dual-Device Receipt Processing

**The Workflow:** Phone and desktop working in tandem during the same session.

1. Stack of paper receipts on desk
2. Phone in hand - rapid-fire capture (snap, snap, snap)
3. Each receipt appears on desktop *immediately* (real-time sync)
4. Annotate on desktop (keyboard, bigger screen) while phone keeps capturing
5. Repeat until stack is processed

**Design Implications:**
- **Mobile UX:** Optimized for rapid capture - minimal UI between shots, "burst mode" feel
- **Desktop UX:** Live "receipt inbox" showing new captures as they arrive
- **Sync Requirement:** Near real-time (1-2 seconds), not batch sync
- **Device Strengths:** Phone = camera, Desktop = keyboard/annotation

This pattern transforms receipt processing from a chore into an efficient assembly line.

### Desired Emotional Response

**Target Feeling:** Confident and Organized

- **Confident:** Trust in the system. Clear feedback that things are saved. No anxiety about "did that work?" or "is anything missing?"
- **Organized:** Visual clarity. Categories visible. Easy to find things. Clear totals. Everything has a place.

**UX Design Implications:**
- Clean, structured layouts (not cluttered or chaotic)
- Clear confirmation when actions complete ("Expense saved ✓")
- Visible organization - categories, properties, dates always obvious
- Dashboard communicates "you're on top of this"
- Professional but approachable aesthetic
- Tax time moment: one click → reports ready → *relief and confidence*

**The Anti-Pattern:** The shoebox of receipts, the messy spreadsheet, the "wait, did I record that?" anxiety. This app is the antidote.

### Inspiration Analysis

**Pinterest (Primary Inspiration - User Loves)**
- Card-based design with visual, scannable layouts
- Each card shows "just enough" info at a glance
- Organization into collections (boards)
- Satisfying save/pin interactions with clear feedback
- Clean, uncluttered aesthetic
- Masonry grid that works on mobile and desktop

**Facebook (Familiar Patterns)**
- Feed-based "what's new" updates
- Clear notifications
- Immediate feedback on actions

**Medical EMR (Work Tool Comfort)**
- Comfortable with form-based data entry
- Used to structured fields and dropdowns
- Tolerates utilitarian interfaces

### Design Pattern Translation

| Pinterest Concept | Property Manager Application |
|-------------------|------------------------------|
| Home feed | Dashboard with property cards |
| Boards | Individual properties |
| Pins | Expenses/receipts |
| Save to board | Add expense to property |
| Card preview | Expense card (amount, date, category) |
| Collections | Categories, tax years |

**Visual Style Direction:**
- Card-based layouts (not dense data tables)
- Visual grid organization for scanning
- Clean cards with key info visible at glance
- Satisfying micro-interactions and feedback
- Friendly, warm colors (not sterile corporate)
- Familiar patterns from apps she already loves

### Project Vision Summary

**Vision Statement:** Transform paper-based rental property chaos into organized, tax-ready financial records. "From Shoebox to Schedule E."

**UX Complexity Assessment:**
| Factor | Assessment |
|--------|------------|
| User roles | Simple (1 primary user for MVP) |
| Primary journeys | 3-4 core flows |
| Interaction complexity | Low-medium (CRUD + receipt capture) |
| Platform requirements | Web responsive (desktop + mobile) |
| Novel patterns | 1 (dual-device receipt processing) |
| Real-time needs | Yes (receipt sync between devices) |

**UX Design Principles (derived from discovery):**

1. **Obvious, not clever** - Immediately understandable without explanation
2. **Card-based organization** - Pinterest-inspired visual scanning
3. **Confidence through feedback** - Clear confirmations, visible state
4. **Friction-free capture** - Get data in fast, organize later
5. **Desktop-optimized, mobile-capable** - Each device plays to its strength
6. **Friendly professionalism** - Warm colors, approachable but trustworthy

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Selected:** Angular Material (with custom theming)

**Rationale:**
- Expert familiarity - Dave has deep Angular Material experience
- Free and open source - no licensing overhead
- Powerful theming system - can achieve warm, friendly aesthetic
- Excellent Card component - foundation for Pinterest-inspired layouts
- Built-in accessibility - WCAG compliance out of the box
- Guaranteed Angular 19 compatibility - official Google library

**Customization Strategy:**
- Custom color palette (warm, friendly - not default blue/purple)
- Softer elevation shadows (less stark than Material defaults)
- Rounded corners on cards (friendlier feel)
- Typography adjustments for approachability

**Components We'll Use Heavily:**
- `mat-card` - Property cards, expense cards, receipt cards
- `mat-form-field` - Expense entry forms
- `mat-select` - Category dropdowns, property selection
- `mat-button` - Actions with clear hierarchy
- `mat-icon` - Visual affordances
- `mat-snackbar` - Confirmation feedback ("Expense saved!")
- `mat-dialog` - Confirmations, quick actions
- `mat-sidenav` - Navigation structure

---

## 2. Core User Experience

### 2.1 Defining Experience

**Tagline:** "From Shoebox to Schedule E in One Click"

**The Experience in Words:**
> Snap receipts on your phone, they show up on your computer, and at tax time you click one button and get all your Schedule E reports.

**Core Interaction Pattern:**
1. **Capture** - Snap receipt photo (phone) or enter expense (desktop)
2. **Organize** - Categorize by property and expense type
3. **Track** - See totals, answer "how much is this costing us?"
4. **Report** - One click → PDF worksheets for accountant

**Evolution Path:**

| Phase | Receipt → Expense Flow |
|-------|------------------------|
| MVP | Snap receipt → manual form entry |
| Future | Snap receipt → AI/OCR reads it → form pre-filled → user confirms |

**Design Implication:** The expense form should work for both flows - empty for manual entry (MVP) or pre-filled for AI-assisted entry (future). Same form, different starting state.

### 2.2 Novel UX Patterns

**Assessment:** Most interactions use standard, well-established patterns. One semi-novel pattern requires intentional design.

#### Standard Patterns (No Special Design Needed)
- Expense CRUD - standard form patterns
- Dashboard with cards - standard data display
- PDF export - standard download flow
- Camera capture - standard mobile pattern
- Category/property dropdowns - standard selection

#### Semi-Novel Pattern: Dual-Device Receipt Processing

**What Makes It Different:**
Unlike typical "capture now, sync later" workflows, this is a *real-time collaborative* workflow between the user's own devices during a single session.

**The Assembly Line:**
```
[Phone]                         [Desktop]
  │                                 │
  ├── Snap receipt #1 ──────────►  Receipt appears in inbox
  ├── Snap receipt #2 ──────────►  User annotates #1
  ├── Snap receipt #3 ──────────►  Receipt #2 queued
  └── ...                          User annotates #2, #3...
```

**Design Requirements:**
- **Mobile:** Minimal UI between shots - "burst mode" feel
- **Desktop:** Live inbox with new receipt indicator
- **Sync:** Near real-time (1-2 seconds)
- **Queue:** Clear visual of pending receipts to process

**Similar Patterns to Reference:**
- Airdrop (instant device-to-device transfer)
- Google Photos (upload while viewing on another device)
- Slack (messages appear in real-time across devices)

This pattern will be detailed further in User Journey Flows (Section 5).

### 2.3 Core Experience Principles

These principles guide every UX decision in the application:

#### Speed: Instant Gratification
- **Expense entry:** Under 30 seconds from start to saved
- **Receipt capture:** Burst-mode fast - snap and go, no waiting
- **Dashboard load:** Immediate - answer "how much?" without delay
- **Report generation:** One click, visible progress, quick completion

#### Guidance: Obvious, Not Explained
- **Self-evident UI:** No onboarding tutorial needed
- **Smart defaults:** Current date, most-used property, common categories
- **Visible options:** Advanced features accessible but not cluttering
- **Error prevention:** Validation that helps, not blocks

#### Flexibility: Simple Path, Power Available
- **Common path is effortless:** Add expense = 4-5 fields, done
- **Power when needed:** Filters, search, date ranges, bulk operations
- **Capture now, organize later:** Don't force immediate categorization
- **Undo-friendly:** Easy to correct mistakes

#### Feedback: Confident, Not Noisy
- **Clear confirmations:** "Expense saved ✓" - brief, visible, gone
- **State visibility:** Totals update, receipts appear in queue
- **Trust signals:** Data is saved, nothing lost
- **Not gamified:** This is a productivity tool, not entertainment

---

## 3. Visual Foundation

### 3.1 Color System

**Selected Theme:** Forest Green - Natural, trustworthy, growth-oriented

**Rationale:** Green suggests financial health and growth while feeling natural and trustworthy. It creates a calm, organized feeling that supports the "confident and organized" emotional target without being sterile corporate blue.

#### Primary Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | Forest Green | `#66BB6A` | Main actions, primary buttons, key UI elements |
| Primary Dark | Deep Green | `#4CAF50` | Hover states, emphasis, headers |
| Primary Light | Mint | `#A5D6A7` | Backgrounds, subtle highlights |
| Accent | Warm Orange | `#FFA726` | Attention, warnings, secondary CTAs |

#### Semantic Colors

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Success | Green | `#4CAF50` | Confirmations, positive states |
| Error | Red | `#EF5350` | Errors, destructive actions |
| Warning | Amber | `#FFA726` | Cautions, pending states |
| Info | Blue | `#29B6F6` | Informational messages |

#### Neutral Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Text Primary | Dark Forest | `#33691E` | Main body text, headings |
| Text Secondary | Gray | `#666666` | Secondary text, labels |
| Text Muted | Light Gray | `#9E9E9E` | Placeholders, disabled |
| Background | Off-White | `#FAFAFA` | Page background |
| Surface | White | `#FFFFFF` | Cards, dialogs |
| Border | Light Gray | `#E0E0E0` | Dividers, input borders |

### 3.2 Typography

**Font Family:** System fonts for performance, familiar feel

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

**Type Scale:**

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| H1 | 32px | 600 | Page titles |
| H2 | 24px | 600 | Section headers |
| H3 | 18px | 600 | Card titles, subsections |
| Body | 14px | 400 | Default text |
| Body Large | 16px | 400 | Emphasized body text |
| Small | 12px | 400 | Captions, metadata |
| Tiny | 11px | 500 | Tags, badges |

### 3.3 Spacing System

**Base Unit:** 8px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing, inline elements |
| sm | 8px | Related elements, form gaps |
| md | 16px | Card padding, section gaps |
| lg | 24px | Section separation |
| xl | 32px | Major section breaks |
| 2xl | 48px | Page margins, large gaps |

### 3.4 Elevation (Shadows)

Softer than Material defaults for friendlier feel:

| Level | Shadow | Usage |
|-------|--------|-------|
| 0 | none | Flat elements |
| 1 | `0 2px 4px rgba(0,0,0,0.08)` | Cards, subtle lift |
| 2 | `0 4px 12px rgba(0,0,0,0.12)` | Dropdowns, popovers |
| 3 | `0 8px 24px rgba(0,0,0,0.16)` | Modals, dialogs |

### 3.5 Border Radius

Rounded corners for approachable feel:

| Element | Radius |
|---------|--------|
| Buttons | 8px |
| Cards | 12px |
| Inputs | 8px |
| Tags/Chips | 16px (pill) |
| Modals | 16px |

**Interactive Visualizations:**

- Color Theme Explorer: [ux-color-themes.html](./ux-color-themes.html)

---

## 4. Design Direction

### 4.1 Chosen Design Approach

**Selected:** Direction 3 - Compact List View with Dark Sidebar

**Rationale:**
- Dark sidebar feels "app-like" and professional
- List view shows all 14 properties at a glance without scrolling
- Highly scannable - quickly find any property's totals
- Desktop-optimized for the 80% desktop workflow
- Clear visual hierarchy - navigation doesn't compete with data
- Reinforces "confident and organized" emotional target

### 4.2 Layout Decisions

| Element | Decision | Rationale |
|---------|----------|-----------|
| Navigation | Dark persistent sidebar | Always visible, professional feel |
| Content area | Light background | High contrast, easy reading |
| Property display | List view (not cards) | Scannable, fits 14+ properties |
| Stats | Top of content area | Answer "how much?" immediately |
| Primary action | Top-right button | Consistent, always accessible |

### 4.3 Desktop vs Mobile Approach

**Desktop (Primary - 80%):**
- Full sidebar navigation visible
- List view for properties
- Stats bar at top of content
- "Add Expense" button always visible

**Mobile (Secondary - 20%):**
- Bottom navigation bar
- Floating action button (FAB) for quick capture
- Simplified header with total
- Receipt capture optimized flow

### 4.4 Key Screen Layouts

#### Dashboard
```
┌─────────────────────────────────────────────────────┐
│ [Dark Sidebar]  │  [Stats: Expenses | Income | Net] │
│                 │                                    │
│ Dashboard  ●    │  Properties                        │
│ Expenses        │  ┌─────────────────────────────┐  │
│ Receipts (3)    │  │ 123 Oak St          $4,250  │  │
│ Income          │  │ 456 Elm Ave         $3,180  │  │
│ Reports         │  │ 789 Pine Rd         $5,420  │  │
│                 │  │ ...                         │  │
│                 │  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### Property Detail
```
┌─────────────────────────────────────────────────────┐
│ [Dark Sidebar]  │  123 Oak Street        [+ Expense]│
│                 │  Austin, TX 78701                 │
│                 │  ───────────────────────────────  │
│                 │  YTD: $4,250    Income: $12,000   │
│                 │                                    │
│                 │  Recent Expenses                   │
│                 │  ┌─────────────────────────────┐  │
│                 │  │ Home Depot - Faucet  $127   │  │
│                 │  │ Insurance Premium    $850   │  │
│                 │  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Interactive Mockups:**

- Design Direction Showcase: [ux-design-directions.html](./ux-design-directions.html)

---

## 5. User Journey Flows

### 5.1 Critical User Paths

Four critical journeys define the core experience:

1. **Add Expense** - The daily action (most frequent)
2. **Dual-Device Receipt Processing** - Phone capture + desktop annotation
3. **View Dashboard** - Answer "how much is this costing us?"
4. **Generate Tax Reports** - The magic moment at tax time

### 5.2 Journey: Add Expense

**User Goal:** Record an expense quickly with full context

**Design Principle:** Property-first navigation. The user thinks in terms of properties (like a healthcare worker thinks in terms of patients). The property is the organizing context.

**Key UX Decision:** No modals. Full page experience shows history while entering new data - builds confidence and tells the story of that property's expenses.

#### Route Structure
```
/properties                      → List all properties
/properties/:id                  → Property detail (summary)
/properties/:id/expenses         → Expense workspace (add + history)
```

#### Entry Points

**From Property List (primary):**
```
Properties
┌──────────────────────────────────────────────────────┐
│ 123 Oak Street      Austin, TX     $4,250   [+ Add] │
│ 456 Elm Ave         Austin, TX     $3,180   [+ Add] │
└──────────────────────────────────────────────────────┘
         │
         └── Click [+ Add] → /properties/:id/expenses
```

**From Property Detail:**
```
Property Detail → Click [+ Add Expense] → /properties/:id/expenses
```

#### The Expense Workspace Page

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  123 Oak Street > Expenses                     │
│            │                                                 │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ + NEW EXPENSE                            │   │
│            │  │ Amount: [____] Date: [today]            │   │
│            │  │ Category: [dropdown]  Desc: [____]      │   │
│            │  │ [Attach Receipt]           [Save]       │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                 │
│            │  Previous Expenses                 YTD: $4,250 │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ Nov 25  Home Depot - Faucet    $127    │   │
│            │  │ Nov 18  Insurance Premium      $850    │   │
│            │  │ Nov 10  Lawn Service           $75     │   │
│            │  │ Oct 28  HVAC Repair            $320    │   │
│            │  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Flow

1. Click [+ Add] on property row
2. Land on expense workspace for that property
3. Form at top, history below
4. Enter: Amount, Date (defaults today), Category, Description (optional)
5. Optionally attach receipt
6. Click Save
7. Snackbar: "Expense saved ✓"
8. New expense appears at top of history list
9. Form clears, ready for next entry
10. Repeat for batch entry (assembly line)

#### Smart Defaults
- **Date:** Today
- **Category:** Empty (must select - prevents mis-categorization)
- **Property:** Already known from URL context

#### Why This Works
- **Context visible:** See previous expenses while entering new ones
- **Confidence:** Watch your data appear in the list
- **Batch-friendly:** Enter multiple expenses without leaving the page
- **Story:** The expense history tells the property's financial story
- **Fewer clicks:** Per-row action from property list = one click to start

### 5.3 Journey: Dual-Device Receipt Processing

**User Goal:** Rapidly capture receipts on phone, process them efficiently on desktop

**Design Principle:** Optimize each device for its strength. Phone = fast camera capture. Desktop = keyboard annotation.

#### Mobile Capture Flow

```
[Camera FAB] → Snap photo → "Saved ✓"
                              ↓
              Optional modal: "Which property?"
              ┌─────────────────────────────┐
              │  Select Property            │
              │  [123 Oak Street      ▼]    │
              │                             │
              │  [Skip]         [Save]      │
              └─────────────────────────────┘
                              ↓
              Ready for next snap (burst mode)
```

**Key UX Decisions:**
- Capture is NEVER blocked - property selection is optional
- If you know the property (at Home Depot for 123 Oak), tag it now
- Skip to capture faster, assign property on desktop later
- Minimal UI between shots for rapid-fire capture

#### Desktop Receipt Queue

**Location:** Sidebar nav item "Receipts" with badge count

**Route:** `/receipts`

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Unprocessed Receipts (3)                      │
│            │                                                 │
│ Receipts●3 │  ┌─────────────────────────────────────────┐   │
│            │  │ [thumb] Nov 28  Home Depot               │   │
│            │  │         → 123 Oak Street                 │   │
│            │  ├─────────────────────────────────────────┤   │
│            │  │ [thumb] Nov 28  Lowes                    │   │
│            │  │         → (unassigned)                   │   │
│            │  ├─────────────────────────────────────────┤   │
│            │  │ [thumb] Nov 27  Insurance Co             │   │
│            │  │         → 456 Elm Ave                    │   │
│            │  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Queue shows:**
- Receipt thumbnail
- Capture date
- Property (if tagged on mobile) or "(unassigned)"
- Visual distinction for unassigned receipts

#### Processing Flow (Desktop)

```
Click receipt in queue
        ↓
Opens expense form with receipt image visible
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  New Expense from Receipt                      │
│            │                                                 │
│            │  ┌──────────────┐  ┌────────────────────────┐  │
│            │  │              │  │ Property: [123 Oak ▼]  │  │
│            │  │   [Receipt   │  │ Amount:   [$___]       │  │
│            │  │    Image]    │  │ Date:     [Nov 28]     │  │
│            │  │              │  │ Category: [▼]          │  │
│            │  │              │  │ Desc:     [Home Depot] │  │
│            │  └──────────────┘  │                        │  │
│            │                    │ [Cancel]    [Save]     │  │
│            │                    └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Click receipt in queue
2. Expense form opens with receipt image visible (side-by-side)
3. Property pre-selected if tagged on mobile, otherwise empty
4. Fill remaining fields (reading from receipt image)
5. Save → Expense created with receipt attached
6. Receipt removed from queue, badge count decreases
7. Next receipt ready to process

#### Assembly Line Workflow

**Scenario:** Stack of 10 paper receipts, Saturday afternoon

```
PHONE                              DESKTOP
  │                                   │
  ├── Snap, tag "Oak St" ──────►  Appears in queue
  ├── Snap, skip property ─────►  Appears (unassigned)
  ├── Snap, tag "Elm Ave" ─────►  User processing first receipt
  ├── Snap, snap, snap... ─────►  Queue building up
  │                                   │
  └── Done capturing                  Process queue one by one
                                      Form + image side by side
                                      Save, next, save, next...
                                      Queue empty = done!
```

**Real-time sync requirement:** Receipts appear on desktop within 1-2 seconds of capture

#### Error Handling
- **Wrong property tagged:** Editable on desktop form
- **Duplicate receipt:** Warning if similar amount/date exists for property
- **Failed upload:** Retry indicator on mobile, don't block next capture

### 5.4 Journey: View Dashboard

**User Goal:** Answer "How much is this costing us?"

**Design Principle:** The answer should be visible immediately - no drilling down required.

#### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Dashboard                          2025 ▼    │
│            │                                                 │
│ Dashboard● │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│            │  │ $24,850  │ │ $42,000  │ │ $17,150  │       │
│            │  │ Expenses │ │ Income   │ │ Net      │       │
│            │  └──────────┘ └──────────┘ └──────────┘       │
│            │                                                 │
│            │  Properties                                     │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ 123 Oak Street    Austin     $4,250 [+] │   │
│            │  │ 456 Elm Ave       Austin     $3,180 [+] │   │
│            │  │ 789 Pine Rd       Round Rock $5,420 [+] │   │
│            │  │ ...                                     │   │
│            │  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key elements:**
- Stats bar at top: Total Expenses, Total Income, Net Income
- Year selector (tax year filter)
- Property list with per-property totals
- [+] quick action to add expense for that property

**Interaction:**
- Click property row → Property detail page
- Click [+] → Property expense workspace
- Change year → All numbers update

### 5.5 Journey: Generate Tax Reports

**User Goal:** One click → PDFs ready for accountant

**Design Principle:** This is the "magic moment." Make it feel easy and complete.

#### Reports Page

**Route:** `/reports`

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Tax Reports                                   │
│            │                                                 │
│ Reports    │  Generate Schedule E Worksheets                │
│            │                                                 │
│            │  Tax Year: [2025 ▼]                            │
│            │                                                 │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ ○ All Properties (14)                   │   │
│            │  │ ○ Select specific properties            │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                 │
│            │  [Generate Reports]                            │
│            │                                                 │
│            │  ─────────────────────────────────────────     │
│            │                                                 │
│            │  Previous Reports                               │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ 2024 - All Properties    [Download]     │   │
│            │  │ 2023 - All Properties    [Download]     │   │
│            │  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Flow

1. Navigate to Reports
2. Select tax year (defaults to current)
3. Choose all properties or select specific ones
4. Click "Generate Reports"
5. Progress indicator while generating
6. Preview appears (or download starts)
7. PDFs ready - one per property, Schedule E format

#### The Magic Moment

```
[Generate Reports]
        ↓
    Generating... (progress bar)
        ↓
    ✓ 14 reports ready!

    [Preview All]  [Download All as ZIP]
```

**Output:**
- One PDF per property
- Schedule E worksheet format
- Expense categories match IRS line items
- Totals calculated
- Ready to email or print for accountant

---

## 6. Component Library

### 6.1 Component Strategy

**Approach:** Leverage Angular Material components with custom theming. Build custom components only where our specific UX requirements demand it.

### 6.2 Angular Material Components (Use/Customize)

| Component | Usage | Customization |
|-----------|-------|---------------|
| `mat-sidenav` | Dark sidebar navigation | Dark theme, Forest Green accents |
| `mat-list` | Property list, expense list | Custom row templates |
| `mat-form-field` | All form inputs | Forest Green focus states |
| `mat-select` | Property/category dropdowns | Standard styling |
| `mat-button` | All actions | Primary=green, rounded corners |
| `mat-icon` | Visual affordances | Material icons |
| `mat-snackbar` | Confirmations | Success styling |
| `mat-badge` | Receipt count | Orange accent color |
| `mat-progress-bar` | Report generation | Green progress |
| `mat-card` | Stats cards | Softer shadows |
| `mat-datepicker` | Date selection | Standard |

### 6.3 Custom Components

#### PropertyRowComponent
**Purpose:** Property list item with inline actions

```
┌─────────────────────────────────────────────────────┐
│ [icon] 123 Oak Street    Austin, TX   $4,250  [+]  │
└─────────────────────────────────────────────────────┘
```

**Elements:**
- Property icon (home)
- Property name (bold)
- Address (secondary text)
- YTD expense total (green, right-aligned)
- [+] Add expense action button

**States:** Default, hover (subtle highlight), active

---

#### ExpenseRowComponent
**Purpose:** Expense list item in expense workspace

```
┌─────────────────────────────────────────────────────┐
│ Nov 25   Home Depot - Faucet repair   [Repairs]  $127 │
└─────────────────────────────────────────────────────┘
```

**Elements:**
- Date (fixed width)
- Description (truncate if long)
- Category tag (pill style)
- Amount (right-aligned, bold)
- Receipt indicator icon (if attached)

**States:** Default, hover (show edit/delete actions)

---

#### ReceiptQueueItemComponent
**Purpose:** Unprocessed receipt in queue

```
┌─────────────────────────────────────────────────────┐
│ [thumbnail]  Nov 28  Home Depot                     │
│              → 123 Oak Street                       │
└─────────────────────────────────────────────────────┘
```

**Elements:**
- Receipt thumbnail (small preview)
- Capture date
- Auto-detected vendor (if readable)
- Property assignment (or "unassigned" in muted style)

**States:** Default, hover, unassigned (visual distinction)

---

#### StatsBarComponent
**Purpose:** Dashboard summary stats

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ $24,850  │ │ $42,000  │ │ $17,150  │
│ Expenses │ │ Income   │ │ Net      │
└──────────┘ └──────────┘ └──────────┘
```

**Elements:**
- Three stat cards in a row
- Large value (styled by type: expense, income, net)
- Label below

---

#### ReceiptFormLayoutComponent
**Purpose:** Side-by-side receipt image and expense form

```
┌──────────────────┬─────────────────────────────┐
│                  │  Property: [dropdown]       │
│   [Receipt       │  Amount:   [input]          │
│    Image]        │  Date:     [datepicker]     │
│                  │  Category: [dropdown]       │
│   [Zoom] [Rotate]│  Desc:     [input]          │
│                  │                             │
│                  │  [Cancel]      [Save]       │
└──────────────────┴─────────────────────────────┘
```

**Elements:**
- Left panel: Receipt image with zoom/rotate controls
- Right panel: Expense form
- Responsive: Stack vertically on smaller screens

---

#### MobileCaptureButtonComponent
**Purpose:** Floating action button for receipt capture

```
     ┌─────┐
     │  +  │  ← Camera icon, bottom-right
     └─────┘
```

**Behavior:**
- Tap → Open camera
- After capture → Show optional property modal
- Always visible on mobile screens

---

## 7. UX Pattern Decisions

### 7.1 Consistency Rules

These patterns ensure predictable behavior across all screens.

### 7.2 Button Hierarchy

| Type | Style | Usage |
|------|-------|-------|
| **Primary** | Solid green, white text | Main action per screen (Save, Generate, Add) |
| **Secondary** | Outlined green, green text | Alternative actions (Cancel, View) |
| **Tertiary** | Text only, green | Inline actions, less emphasis |
| **Destructive** | Solid red | Delete, remove (requires confirmation) |
| **Disabled** | Grayed out | Action not available |

**Rule:** Maximum ONE primary button visible per context. If there are multiple actions, one is primary, others are secondary.

### 7.3 Feedback Patterns

| Feedback | Pattern | Duration |
|----------|---------|----------|
| **Success** | Snackbar bottom-center: "Expense saved ✓" | 3 seconds, auto-dismiss |
| **Error** | Snackbar bottom-center, red: "Failed to save. Retry?" | Manual dismiss or retry |
| **Warning** | Inline yellow banner | Persists until resolved |
| **Loading** | Spinner on button OR skeleton screen | Until complete |
| **Progress** | Progress bar (reports) | Shows percentage |

**Snackbar behavior:**
- Appears at bottom center
- Doesn't block interaction
- Stacks if multiple (max 3)
- Swipe to dismiss on mobile

### 7.4 Form Patterns

| Element | Pattern |
|---------|---------|
| **Labels** | Above input (not floating) |
| **Required indicator** | Asterisk (*) after label |
| **Validation timing** | On blur (when leaving field) |
| **Error display** | Inline below field, red text |
| **Help text** | Below field, muted gray |
| **Dropdowns** | Searchable if >10 options (categories) |

**Form layout:**
- Single column on mobile
- Can use 2 columns on desktop for short forms
- Primary action (Save) aligned right
- Cancel/secondary aligned left of primary

### 7.5 Empty States

| State | Message | Action |
|-------|---------|--------|
| **First property** | "Add your first property to get started" | [+ Add Property] button |
| **No expenses** | "No expenses yet for this property" | [+ Add Expense] button |
| **No receipts in queue** | "All caught up! No receipts to process." | Checkmark icon, no action needed |
| **No search results** | "No expenses match your search" | Clear filters link |
| **No reports yet** | "Generate your first tax report" | [Generate Report] button |

**Tone:** Friendly, helpful, action-oriented. Never leave user stuck.

### 7.6 Confirmation Patterns

| Action | Confirmation |
|--------|--------------|
| **Delete expense** | Inline confirmation: "Delete this expense?" [Cancel] [Delete] |
| **Delete property** | Modal: "Delete 123 Oak Street? This will remove all expenses." [Cancel] [Delete] |
| **Delete receipt** | Inline confirmation (same as expense) |
| **Leave unsaved form** | Browser prompt: "You have unsaved changes" |
| **Generate reports** | No confirmation needed (non-destructive) |

**Rule:** Destructive actions on important data (properties) get modal confirmation. Quick items (single expense) get inline confirmation.

### 7.7 Navigation Patterns

| Element | Pattern |
|---------|---------|
| **Active nav item** | Background highlight + left border accent |
| **Breadcrumbs** | Show on detail pages: Dashboard > 123 Oak Street > Expenses |
| **Back button** | Browser back works naturally (proper routing) |
| **Deep linking** | All pages have shareable URLs |
| **Mobile nav** | Bottom tab bar, FAB for capture |

### 7.8 Loading Patterns

| Scenario | Pattern |
|----------|---------|
| **Page load** | Skeleton screens (content shape placeholders) |
| **Button action** | Spinner replaces button text, button disabled |
| **List loading more** | Spinner at bottom of list |
| **Image loading** | Gray placeholder, fade in when loaded |
| **Report generation** | Progress bar with percentage |

### 7.9 Date/Time Patterns

| Element | Pattern |
|---------|---------|
| **Display format** | "Nov 28, 2025" (readable) |
| **Input format** | Datepicker (no manual typing required) |
| **Default date** | Today for new expenses |
| **Relative dates** | Not used (absolute dates for financial records) |
| **Tax year** | Jan 1 - Dec 31, selectable in dashboard/reports |

### 7.10 Search & Filter Patterns

| Element | Pattern |
|---------|---------|
| **Search** | Top of list, instant filter as you type |
| **Filters** | Dropdowns/chips above list (category, date range) |
| **Clear filters** | "Clear all" link when filters active |
| **No results** | Friendly message with suggestion to adjust filters |
| **Persist filters** | Filters persist during session, reset on logout |

---

## 8. Responsive Design & Accessibility

### 8.1 Responsive Strategy

**Design approach:** Desktop-first (80% usage), with mobile adaptations for receipt capture (20% usage).

#### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Desktop** | ≥1024px | Sidebar + content area |
| **Tablet** | 768-1023px | Collapsible sidebar, full content |
| **Mobile** | <768px | Bottom nav, stacked layouts |

#### Layout Adaptations

| Element | Desktop | Mobile |
|---------|---------|--------|
| **Navigation** | Dark sidebar (always visible) | Bottom tab bar |
| **Property list** | Single list with all columns | Simplified cards, stacked |
| **Stats bar** | 3 cards in row | 3 cards in row (smaller) |
| **Expense form** | 2-column possible | Single column |
| **Receipt + form** | Side-by-side | Stacked (image above form) |
| **Add action** | Button in header | FAB (floating action button) |

#### Mobile-Specific UX

```
┌─────────────────────────┐
│ Total Expenses          │
│ $24,850                 │
├─────────────────────────┤
│ 123 Oak St      $4,250  │
│ 456 Elm Ave     $3,180  │
│ 789 Pine Rd     $5,420  │
│ ...                     │
├─────────────────────────┤
│ [Home] [Expenses] [📷] [Reports] │
└─────────────────────────┘
              ┌───┐
              │ + │  ← FAB
              └───┘
```

**Key mobile optimizations:**
- FAB for quick receipt capture (primary mobile action)
- Bottom nav for thumb-friendly navigation
- Larger touch targets (min 44px)
- Simplified property rows
- Full-screen receipt camera

### 8.2 Accessibility Strategy

**Target:** WCAG 2.1 Level AA compliance

This is a private application (not public-facing), but good accessibility practices ensure:
- Works well for all users regardless of ability
- Keyboard navigation (useful even for power users)
- Works with browser zoom/text scaling
- Screen reader compatible if ever needed

#### Color & Contrast

| Element | Requirement | Our Design |
|---------|-------------|------------|
| **Body text** | 4.5:1 minimum | Dark green (#33691E) on white = ✓ |
| **Large text** | 3:1 minimum | ✓ |
| **Interactive elements** | 3:1 minimum | Green on white = ✓ |
| **Focus indicators** | Visible | Green outline ring |

**Color independence:** Don't rely on color alone. Icons, text labels, or patterns accompany color indicators.

#### Keyboard Navigation

| Action | Keyboard |
|--------|----------|
| **Navigate sidebar** | Tab, Arrow keys |
| **Activate button/link** | Enter |
| **Close modal** | Escape |
| **Navigate form** | Tab between fields |
| **Submit form** | Enter (when on submit button) |
| **Dropdown selection** | Arrow keys, Enter |

**Focus management:**
- Visible focus ring on all interactive elements
- Focus trapped in modals until closed
- Focus returns to trigger element after modal closes

#### Screen Reader Support

| Element | Implementation |
|---------|----------------|
| **Page titles** | Descriptive `<title>` per route |
| **Headings** | Proper hierarchy (h1 → h2 → h3) |
| **Form labels** | Associated with inputs via `for`/`id` |
| **Buttons** | Descriptive text or `aria-label` |
| **Icons** | `aria-hidden` if decorative, `aria-label` if functional |
| **Status messages** | `aria-live` regions for snackbars |
| **Images** | `alt` text for receipt thumbnails |

#### Touch Targets

| Element | Minimum Size |
|---------|--------------|
| **Buttons** | 44×44px |
| **List rows** | 48px height minimum |
| **Icons as buttons** | 44×44px tap area |
| **Form inputs** | 44px height |

### 8.3 Testing Strategy

| Type | Tool/Method |
|------|-------------|
| **Automated** | Lighthouse, axe DevTools |
| **Keyboard** | Manual testing, tab through all flows |
| **Screen reader** | VoiceOver (Mac), test key flows |
| **Color contrast** | Browser DevTools contrast checker |
| **Mobile** | Chrome DevTools device emulation + real device |

---

## 9. Implementation Guidance

### 9.1 What We Created

| Element | Decision |
|---------|----------|
| **Design System** | Angular Material with Forest Green custom theme |
| **Layout** | Dark sidebar navigation, list-based content |
| **Color Theme** | Forest Green (#66BB6A) - natural, trustworthy, growth |
| **Typography** | System fonts, 14px base |
| **Core Principle** | "Obvious, not clever" - property-first navigation |

### 9.2 Key UX Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Property-first navigation | User thinks in terms of properties, not actions |
| No modals for data entry | Full page shows context and history |
| Per-row [+ Add] actions | Fewer clicks, faster entry |
| Expense workspace pattern | Form + history on same page builds confidence |
| Dual-device receipt flow | Phone captures, desktop annotates (assembly line) |
| Optional property tagging | Capture is never blocked, tag if convenient |
| List view over cards | Scannable for 14+ properties |
| Dark sidebar | Professional "app-like" feel |

### 9.3 Route Structure

```
/                           → Redirect to /dashboard
/dashboard                  → Stats + property list
/properties                 → Property list (same as dashboard for MVP)
/properties/:id             → Property detail (summary, recent activity)
/properties/:id/expenses    → Expense workspace (add + history)
/receipts                   → Unprocessed receipt queue
/receipts/:id               → Process single receipt (form + image)
/income                     → Income tracking (similar to expenses)
/reports                    → Tax report generation
/settings                   → User settings
```

### 9.4 Component Checklist

**Angular Material (customize theme):**
- [ ] mat-sidenav (dark theme)
- [ ] mat-list
- [ ] mat-form-field (green focus)
- [ ] mat-select
- [ ] mat-button (rounded, green primary)
- [ ] mat-icon
- [ ] mat-snackbar
- [ ] mat-badge
- [ ] mat-progress-bar
- [ ] mat-card
- [ ] mat-datepicker

**Custom Components to Build:**
- [ ] PropertyRowComponent
- [ ] ExpenseRowComponent
- [ ] ReceiptQueueItemComponent
- [ ] StatsBarComponent
- [ ] ReceiptFormLayoutComponent
- [ ] MobileCaptureButtonComponent (FAB)
- [ ] BottomNavComponent (mobile)

### 9.5 Deliverables

| Deliverable | Location |
|-------------|----------|
| UX Design Specification | `docs/ux-design-specification.md` |
| Color Theme Visualizer | `docs/ux-color-themes.html` |
| Design Direction Mockups | `docs/ux-design-directions.html` |

### 9.6 Next Steps

1. **Architecture** - Define technical implementation (API, database, real-time sync)
2. **Epics & Stories** - Break down into implementable work items
3. **Implementation** - Build the Angular frontend with these UX decisions
4. **Validation** - Test with primary user (Dave's wife) early and often

---

## Appendix

### Related Documents

- Product Requirements: `docs/prd.md`
- Brainstorming: `docs/bmm-brainstorming-session-2025-11-28.md`

### Core Interactive Deliverables

This UX Design Specification was created through visual collaboration:

- **Color Theme Visualizer**: docs/ux-color-themes.html
  - Interactive HTML showing all color theme options explored
  - Live UI component examples in each theme
  - Side-by-side comparison and semantic color usage

- **Design Direction Mockups**: docs/ux-design-directions.html
  - Interactive HTML with 6-8 complete design approaches
  - Full-screen mockups of key screens
  - Design philosophy and rationale for each direction

### Version History

| Date       | Version | Changes                         | Author |
| ---------- | ------- | ------------------------------- | ------ |
| 2025-11-28 | 1.0     | Initial UX Design Specification | Dave   |

---

_This UX Design Specification was created through collaborative design facilitation, not template generation. All decisions were made with user input and are documented with rationale._
