# UX Handoff: Work Orders List View Redesign

**Date:** 2026-02-22
**Author:** Sally (UX Designer)
**Status:** Ready for Story Creation
**Wireframe:** `_bmad-output/excalidraw-diagrams/wireframe-work-orders-enriched-row.excalidraw`

---

## Problem Statement

The current Work Orders list view uses a **card grid layout** that suffers from:

- Poor scannability -- eyes dart around a grid with no consistent reading flow
- Low information density despite high visual weight
- No ability to sort or compare across work orders in columns
- Inconsistent with the pragmatic list-based pattern used by Income and Expenses views

However, work orders are **richer objects** than income/expenses. They carry status lifecycle, assignees (self or vendor), categories, properties, tags, descriptions, and optional photos. A flat single-line table row (like the Income view) would truncate too much.

## Design Decision: Enriched Row Pattern

Replace the card grid with a **two-line row list** -- a hybrid between a pure table and cards.

### Desktop Layout

Each work order renders as a full-width row with two lines:

| Line | Purpose | Content |
|------|---------|---------|
| **Line 1 (Scan Line)** | "What is this?" | Status chip, title, assignee, category, date, action icons |
| **Line 2 (Context Line)** | "What else do I need to know?" | Property address, vendor name, tags |

Additional desktop features:
- **Expand chevron** on the left of each row -- clicking reveals an inline detail panel (full description, photo thumbnail, linked expenses) without navigating away
- **Alternating row backgrounds** for visual rhythm
- **Color-coded status chips** (Reported=orange, Assigned=blue, Completed=green) forming a "traffic light strip" down the left side for instant portfolio health assessment
- **Column alignment** enables sorting and scanning by any field
- Status filter chips and Property dropdown retained from current design

### Mobile Layout (Responsive Reflow)

Each row **unstacks into a compact card** at the mobile breakpoint:

```
[STATUS CHIP]                    [DATE]

Title text
Property address
Assignee
Category
```

This is NOT a redesign for mobile -- it's the same data, same hierarchy, just reflowed vertically. The current card layout already resembles this mobile view, so mobile users see a familiar pattern.

### Breakpoint Strategy

| Breakpoint | Behavior |
|-----------|----------|
| Large (>1200px) | Full two-line row, all columns visible |
| Medium (768-1200px) | Drop category column, keep rows |
| Small (<768px) | Each row unstacks into a stacked card |

## Implementation Notes

### What Changes

- **Remove:** Card grid component and card template for work orders list
- **Add:** Enriched row list component with two-line row template
- **Add:** Expand/collapse functionality per row (chevron toggle)
- **Update:** Mobile responsive styles (flex-direction column at breakpoint)
- **Keep:** Status filter chips, Property dropdown, "+ New Work Order" button, page header

### What Does NOT Change

- Work order detail view (click-through)
- Create/edit work order forms
- API endpoints or data model
- Filter/search functionality (just visual container changes)

### Technical Guidance

- Use a flex-based list layout, NOT `mat-table` -- rows need two-line flexibility
- Status chips: reuse existing `mat-chip` with status-specific CSS classes
- Expand panel: `@if` block within each row, not a separate route
- Row backgrounds: CSS `nth-child(odd)` for alternating
- Responsive: CSS flexbox `flex-direction: row` -> `column` at mobile breakpoint
- Action icons: existing edit/delete pattern from other list views

### Acceptance Criteria (Suggested)

1. Work orders display in enriched row format on desktop (>768px)
2. Each row shows Line 1 (status, title, assignee, category, date, actions) and Line 2 (property, vendor/tags)
3. Status chips are color-coded by status (Reported, Assigned, Completed)
4. Rows have alternating background colors
5. Expand chevron toggles an inline detail panel per row
6. On mobile (<768px), rows reflow into stacked cards
7. Existing filters (status chips, property dropdown) continue to work
8. No changes to work order CRUD operations or API
