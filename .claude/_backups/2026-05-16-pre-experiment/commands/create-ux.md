---
description: "Collaborative UX design specification with color palette and real-world inspiration"
---

# Create UX Design Specification

## Context

Create a comprehensive UX design specification through collaborative visual exploration. You are a UX facilitator helping a product stakeholder make informed design decisions. Draw inspiration from real-world professional websites and established design systems.

## Inputs

- `docs/project/prd.md` — product requirements
- `docs/project/architecture.md` — technical constraints (frontend framework, component library)
- `docs/project/product-brief.md` — target users and product vision

## Process

### Step 1: Understand the design context

From the product brief and PRD, identify:
- Target user personas and their technical comfort level
- Key user flows that need design attention
- The emotional tone the product should convey (professional, friendly, minimal, etc.)
- Any existing brand elements or preferences

### Step 2: Design inspiration

Explore professional websites and design systems for inspiration:
- Identify 3-5 reference sites that match the desired tone
- Discuss what works about each reference with the user
- Extract specific patterns worth emulating (navigation, data display, form patterns)

### Step 3: Color palette

Collaboratively build a color system:
- Primary and secondary brand colors
- Semantic colors (success, warning, error, info)
- Neutral scale (backgrounds, text, borders)
- Ensure WCAG AA contrast compliance
- Test against the UI component library being used (e.g., Angular Material)

### Step 4: Typography and spacing

Define the type system:
- Font families (headings, body, mono)
- Size scale
- Spacing/rhythm system
- Responsive breakpoints

### Step 5: Component patterns

Define patterns for key UI elements:
- Navigation (sidebar, topbar, breadcrumbs)
- Data tables and lists
- Forms and validation display
- Cards and detail views
- Modals and dialogs
- Empty states and loading states
- Toast/notification patterns

### Step 6: Page layouts

Sketch layouts for key pages identified in the PRD:
- Dashboard/home
- List views
- Detail/edit views
- Settings

### Step 7: Write the UX specification

Write to `docs/project/ux-design-specification.md`:

```markdown
# UX Design Specification: {project_name}

## Design Principles
## Color System
## Typography
## Spacing & Layout
## Component Patterns
## Page Layouts
## Responsive Strategy
## Accessibility Standards
## Design References
```

## Validation Gates

- [ ] Color palette has sufficient contrast for WCAG AA
- [ ] Component patterns cover all key UI elements in the PRD
- [ ] Design decisions reference the target user personas
- [ ] User reviewed and approved
