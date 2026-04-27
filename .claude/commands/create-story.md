---
description: "Create implementation-ready story from epics with exhaustive context analysis"
---

# Create Story

## Context

Create the next implementation-ready story file by exhaustively analyzing all project artifacts. The story file is the developer's master guide — it must contain everything needed for flawless implementation. If you hallucinate an API or use outdated patterns, the dev workflow will implement them without question. Documentation lookups are cheaper than debugging.

## Inputs

Load these artifacts (read completely, do not skim):
- `docs/project/sprint-status.yaml` — find next backlog story
- `docs/project/epics.md` — story requirements, acceptance criteria, epic context
- `docs/project/architecture.md` — technical decisions, patterns, constraints
- `docs/project/prd.md` — business requirements and success criteria
- `docs/project/ux-design-specification.md` — UX patterns (if story has UI)
- `docs/project/project-context.md` — critical implementation rules

## Process

### Step 1: Determine target story

If the user provides an epic/story number (e.g., "8-3" or "epic 8 story 3"), use that directly.

Otherwise, read `docs/project/sprint-status.yaml` completely. Find the FIRST story (reading top to bottom) with status "backlog". Extract epic_num, story_num, and story_key from the key pattern (e.g., "8-3-vendor-crud" → epic 8, story 3).

If no backlog stories found, HALT and tell the user.

### Step 2: Exhaustive artifact analysis

**Epic analysis**: From epics.md, extract the full epic context — objectives, business value, ALL stories in this epic (for cross-story awareness), and our specific story's requirements, acceptance criteria, and technical constraints.

**Previous story intelligence**: If story_num > 1, load the previous story file from `docs/project/stories/epic-{N}/`. Extract:
- Dev notes and learnings
- Review feedback and corrections
- Files created/modified and their patterns
- Testing approaches that worked
- Problems encountered and solutions found

**Git intelligence**: Analyze the last 5 commits for:
- Code patterns and conventions used
- Library dependencies added/changed
- Architecture decisions implemented
- Testing approaches used

**Architecture analysis**: Systematically extract story-relevant requirements:
- Technical stack (languages, frameworks, versions)
- Code structure (folder organization, naming conventions)
- API patterns (endpoint structure, data contracts)
- Database schemas (tables, relationships)
- Security requirements
- Testing standards

### Step 3: Technology research (Ref MCP + gh CLI)

**Ref MCP (mandatory)**: For each technology/library/API involved in this story, use `mcp__Ref__ref_search_documentation` to:
- Verify current API signatures and method parameters
- Confirm configuration patterns against current docs
- Check for breaking changes or deprecations
- Flag discrepancies between architecture doc assumptions and current reality

**GitHub CLI**: Use `gh` to check recent PRs for patterns relevant to this story:
- `gh pr list --state merged --limit 10` — recent merged work
- `gh search code` — find existing patterns in the repo
- Review how similar features were implemented previously

Include ONLY documentation-verified technical details in the story. Hallucinated APIs will be implemented without question by the dev workflow.

### Step 4: Create story file

Write to `docs/project/stories/epic-{N}/{story_key}.md` using this structure:

```markdown
# Story {epic_num}.{story_num}: {story_title}

Status: ready-for-dev

## Story

As a {role},
I want {action},
so that {benefit}.

## Acceptance Criteria

1. [BDD-formatted criteria from epics analysis]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1

## Dev Notes

[Architecture patterns, constraints, file paths, testing standards]

### Previous Story Intelligence
[Learnings from prior story, if applicable]

### References
[Source paths and sections for all technical details]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
```

### Step 4.5: Test scope assessment

Before finalizing the story, explicitly evaluate which levels of the testing pyramid apply and create corresponding tasks:

**Unit tests** (always required): Identify what new handlers, validators, stores, components, or services need unit tests. Add a dedicated task for each group of unit tests.

**Integration tests** (required when backend endpoints are new or changed): Check if this story adds or modifies any API endpoints. If yes, add a task for WebApplicationFactory-based integration tests in `PropertyManager.Api.Tests/`. If the story is frontend-only and all backend endpoints already have integration test coverage, note this explicitly and skip.

**E2E tests** (required when UI features are new or changed): Check if this story adds new user-facing flows, pages, or significant UI changes. If yes, add a task for Playwright E2E tests in `frontend/e2e/tests/`. The E2E test should cover the critical happy-path user flow introduced by this story.

Include the test scope decision in the Dev Notes section with explicit justification:
```
### Test Scope
- Unit tests: Required — [list what needs unit tests]
- Integration tests: Required/Not required — [justification]
- E2E tests: Required/Not required — [justification]
```

**If a level is marked "Not required", state why.** "Frontend-only story, no new endpoints" is valid for skipping integration tests. "No new user-facing flows" is valid for skipping E2E. "It's hard" or "time constraints" are NOT valid reasons to skip any level.

### Step 5: Update sprint status

- Update `docs/project/sprint-status.yaml`: set story status to "ready-for-dev"
- If this is the first story in an epic, update the epic status to "in-progress"
- Save the file preserving all comments and structure

Report the story file path and suggest running `/dev-story` next.

## Validation Gates

- [ ] All acceptance criteria are BDD-formatted and testable
- [ ] Dev Notes contain architecture-verified technical requirements
- [ ] Technology research completed — no hallucinated APIs
- [ ] Previous story intelligence extracted (if applicable)
- [ ] Tasks/subtasks map to acceptance criteria
- [ ] Test scope assessed — each pyramid level explicitly required or justified as not needed
- [ ] Story includes dedicated test tasks for every required pyramid level
- [ ] Sprint status updated
- [ ] Story status set to "ready-for-dev"
