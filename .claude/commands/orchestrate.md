---
description: "Chain skills for long-running workflows: story-cycle, planning-cycle, test-first-cycle"
---

# Orchestrate

## Context

Chain multiple skills together for long-running workflows. The orchestrator manages state between phases, pauses for user approval between each phase, and can resume after session breaks.

## Recipes

### story-cycle (default)
The daily development loop:
1. **Create** — create the next story from epics (`/create-story` logic)
2. **Develop** — implement all tasks with TDD (`/dev-story` logic)
3. **Review** — adversarial code review (`/code-review` logic)
4. **Ship** — create branch, commit, push, open PR

### planning-cycle
Used at project or epic boundaries:
1. **Brief** — create or update product brief (`/create-product-brief` logic)
2. **PRD** — create or update PRD (`/create-prd` logic)
3. **Architecture** — create or update architecture doc (`/create-architecture` logic)
4. **UX** — create or update UX spec (`/create-ux` logic)
5. **Epics** — generate epics and stories (`/create-epics` logic)

### test-first-cycle
ATDD variant of the story cycle:
1. **Create** — create the next story
2. **ATDD** — generate failing acceptance tests (`/create-atdd` logic)
3. **Develop** — implement to make tests pass
4. **Review** — adversarial code review

## Process

### Step 1: Initialize

Check for existing state in `docs/project/.orchestrator-state.yaml`. If found, ask the user if they want to resume or start fresh.

If starting fresh, ask which recipe to run (default: story-cycle).

Create or update state file:

```yaml
workflow: story-cycle
story: null
started: 2026-03-28T10:00:00Z
current_phase: create
phases:
  create: { status: pending }
  develop: { status: pending }
  review: { status: pending }
  ship: { status: pending }
```

### Step 2: Execute phases

For each phase in the recipe:

1. Display phase banner: **"PHASE: {name} ({N}/{total})"**
2. Execute the phase logic (follow the corresponding skill's process steps)
3. Validate phase completion (check the skill's validation gates)
4. On success: update state file, summarize what was produced
5. On failure/HALT: save state, report what happened

**Between phases**: Pause and present:
- Summary of what the completed phase produced
- What the next phase will do
- Options: **[C]ontinue**, **[S]kip**, **[A]bort**

Wait for user input before proceeding.

### Step 3: Completion

When all phases complete:
- Delete `docs/project/.orchestrator-state.yaml`
- Report full cycle summary
- Suggest next action

## State Recovery

If the orchestrator finds existing state on startup:
- Show the current recipe, phase, and last completed phase
- Ask: **Resume from {current_phase}?** or **Start fresh?**
- On resume: pick up from the incomplete phase with full context

## Rules

- Always pause between phases for user approval
- Save state after every phase completion (enables recovery)
- Each phase follows the same validation gates as its standalone skill
- The orchestrator does not shortcut any phase — full process every time
- If a phase fails validation, do not proceed to the next phase
