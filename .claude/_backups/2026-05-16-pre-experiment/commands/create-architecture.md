---
description: "Collaborative architecture decision document for consistent AI implementation"
---

# Create Architecture Document

## Context

Create a decision-focused architecture document through collaborative facilitation. The goal is to make decisions that prevent implementation conflicts and ensure consistency. You are an architectural peer — the user brings domain knowledge, you bring structured architectural thinking.

## Inputs

- `docs/project/prd.md` — product requirements (required)
- `docs/project/product-brief.md` — product brief (if exists)
- `docs/project/project-context.md` — existing rules (if exists)

## Process

### Step 1: Load requirements context

Read the PRD completely. Extract technical implications from each functional requirement. If no PRD exists, suggest running `/create-prd` first.

### Step 2: Technology stack decisions

For each layer of the system, discuss and decide:
- **Frontend**: framework, state management, UI library, build tools
- **Backend**: language, framework, API style (REST/GraphQL)
- **Database**: engine, ORM, migration strategy
- **Infrastructure**: hosting, CI/CD, containerization

For each decision, capture the WHY — what alternatives were considered and why this choice was made.

### Step 3: Project structure decisions

Define the code organization:
- Monorepo vs multi-repo
- Directory structure and naming conventions
- Layer boundaries and dependency rules
- Shared code patterns

### Step 4: API and data patterns

Decide on consistent patterns:
- API response formats
- Error handling patterns
- Authentication/authorization approach
- Data validation strategy
- Naming conventions (casing, prefixes)

### Step 5: Cross-cutting concerns

Address:
- Logging and observability
- Security patterns
- Performance strategies (caching, pagination)
- Testing strategy (unit, integration, E2E boundaries)

### Step 6: Write the architecture document

Write to `docs/project/architecture.md`:

```markdown
# Architecture Decisions: {project_name}

## Decision Log
[Numbered decisions with rationale]

## Technology Stack
## Project Structure
## API Patterns
## Data Patterns
## Security Architecture
## Testing Strategy
## Deployment Architecture
## Naming Conventions
```

Each decision should include: Decision, Rationale, Alternatives Considered, Consequences.

## Validation Gates

- [ ] Every decision includes rationale (not just "we chose X")
- [ ] Naming conventions are explicit enough to prevent ambiguity
- [ ] API patterns are specific enough for consistent implementation
- [ ] Testing boundaries are clearly defined
- [ ] User reviewed and approved
