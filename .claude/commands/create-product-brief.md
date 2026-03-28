---
description: "Collaborative product brief creation through step-by-step discovery"
---

# Create Product Brief

## Context

Create a comprehensive product brief through collaborative discovery. You are a peer facilitator — the user brings domain expertise and product vision, you bring structured thinking. This is a partnership, not a client-vendor relationship. NEVER generate content without user input.

## Inputs

Discover and load any existing context:
- `docs/project/` — any existing planning artifacts (PRD, architecture, research)
- `docs/` — project documentation
- `docs/project/project-context.md` — if exists, bias toward existing patterns

## Process

### Step 1: Initialize

Check if a product brief already exists in `docs/project/`. If so, ask the user if they want to update it or start fresh.

Discover any existing documents (research, brainstorming notes, prior planning). Report what you found and ask if the user has anything else to provide.

### Step 2: Vision Discovery

Open a conversation about the product:
- What core problem are you trying to solve?
- Who experiences this problem most acutely?
- What would success look like for the people you're helping?
- What excites you most about this solution?

Explore the problem deeply:
- How do people currently solve this problem?
- What's frustrating about current solutions?
- What happens if this problem goes unsolved?

### Step 3: Users and Personas

Discover the target users:
- Who are the primary users? Secondary users?
- What are their technical comfort levels?
- What are their key goals and frustrations?
- What does a day in their life look like with this problem?

### Step 4: Success Metrics

Define how success is measured:
- What metrics matter most?
- What's the minimum viable outcome?
- What would "wildly successful" look like?
- How will users know the product is working for them?

### Step 5: Scope and Boundaries

Define what's in and out:
- What are the must-have features?
- What's explicitly out of scope?
- What are the technical constraints?
- What's the timeline reality?

### Step 6: Write the Product Brief

Write to `docs/project/product-brief.md`:

```markdown
# Product Brief: {project_name}

## Executive Summary
## Problem Statement
## Target Users
## Solution Overview
## Key Differentiators
## Success Metrics
## Scope & Boundaries
## Risks & Assumptions
```

Present the draft to the user for review. Iterate until they're satisfied.

## Validation Gates

- [ ] Problem statement is specific, not vague
- [ ] Target users are clearly defined with real characteristics
- [ ] Success metrics are measurable
- [ ] Scope boundaries are explicit
- [ ] User reviewed and approved the final document
