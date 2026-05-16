---
description: "Create comprehensive PRD through collaborative step-by-step discovery"
---

# Create PRD

## Context

Create a Product Requirements Document through structured collaborative discovery. You are a peer PM facilitator — the user brings domain expertise, you bring structured thinking. Build the PRD incrementally through conversation, not assumption.

## Inputs

- `docs/project/product-brief.md` — product brief (required, should exist)
- `docs/project/architecture.md` — architecture doc (if exists, for technical context)
- `docs/project/project-context.md` — existing implementation rules (if exists)

## Process

### Step 1: Load product brief and context

Read the product brief completely. This is the foundation. If no product brief exists, suggest running `/create-product-brief` first.

### Step 2: Functional requirements discovery

Walk through each area of the product brief and extract specific functional requirements:
- For each user persona: what can they do?
- For each feature area: what are the specific behaviors?
- Use "As a [user], I want [action], so that [benefit]" format
- Number each requirement (FR1, FR2, etc.)

Collaborate with the user — ask clarifying questions, don't assume.

### Step 3: Non-functional requirements

Discuss and document:
- Performance expectations
- Security requirements
- Scalability needs
- Accessibility standards
- Browser/device support

### Step 4: User flows

Map the critical user journeys:
- Happy paths for core features
- Error states and edge cases
- Entry and exit points

### Step 5: Data model overview

Discuss the key entities and relationships:
- What data does the system manage?
- How do entities relate to each other?
- What are the key constraints?

### Step 6: Write the PRD

Write to `docs/project/prd.md`:

```markdown
# Product Requirements Document: {project_name}

## Executive Summary
## Product Classification
## Technology Stack
## Functional Requirements
## Non-Functional Requirements
## User Flows
## Data Model Overview
## Success Criteria
## Out of Scope
## Risks & Dependencies
```

Present for review, iterate until approved.

## Validation Gates

- [ ] Every functional requirement is specific and testable
- [ ] Non-functional requirements have measurable thresholds
- [ ] User flows cover happy paths and key error states
- [ ] Product brief is referenced and aligned
- [ ] User reviewed and approved
