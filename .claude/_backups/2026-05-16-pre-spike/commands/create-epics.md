---
description: "Transform PRD into epics and stories with BDD acceptance criteria"
---

# Create Epics and Stories

## Context

Transform completed planning documents (PRD + Architecture, UX recommended) into implementation-ready epics and stories organized by user value. Each story should have BDD-formatted acceptance criteria and clear scope.

## Inputs

- `docs/project/prd.md` — functional requirements (required)
- `docs/project/architecture.md` — technical decisions (required)
- `docs/project/ux-design-specification.md` — UX patterns (recommended if UI exists)
- `docs/project/product-brief.md` — product vision for context

## Process

### Step 1: Load and analyze requirements

Read all planning documents completely. Extract:
- All functional requirements from PRD
- Technical constraints and patterns from architecture
- UX patterns and page layouts from UX spec
- Group related requirements into feature areas

### Step 2: Define epics

Organize requirements into epics that deliver incremental user value:
- Each epic should be independently deployable
- Order epics by dependency (foundation first) and value
- Name epics clearly: "Epic N: [Feature Area]"

Present the epic breakdown to the user for feedback before proceeding.

### Step 3: Break epics into stories

For each epic, create stories that:
- Are small enough to implement in one session (target story points 3-5)
- Have clear acceptance criteria in BDD format (Given/When/Then)
- Map to specific functional requirements (reference FR numbers)
- Include technical requirements from architecture doc
- Build on each other logically within the epic

### Step 4: Write the epics document

Write to `docs/project/epics.md`:

```markdown
# Epics and Stories: {project_name}

## Epic Overview
[Table of epics with story counts and descriptions]

## Epic 1: [Name]
### Objective
### Stories
#### Story 1.1: [Title]
**User Story**: As a [role], I want [action], so that [benefit]
**Acceptance Criteria**:
- Given [context], When [action], Then [result]
**Technical Notes**: [Architecture references]
**Source**: [FR numbers from PRD]

## Epic 2: [Name]
...
```

### Step 5: Cross-reference validation

Verify:
- Every functional requirement from the PRD maps to at least one story
- No orphaned requirements
- Story dependencies are logical
- Epic ordering makes sense

Present the complete document for user review.

## Validation Gates

- [ ] Every PRD functional requirement is covered by at least one story
- [ ] All acceptance criteria are in BDD Given/When/Then format
- [ ] Stories are sized appropriately (not too large)
- [ ] Epic order respects dependencies
- [ ] User reviewed and approved
