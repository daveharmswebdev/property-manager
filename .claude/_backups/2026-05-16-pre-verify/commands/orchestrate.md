---
description: "Chain skills for long-running workflows: story-cycle, planning-cycle, test-first-cycle"
---

# Orchestrate

## Context

Chain multiple skills together for long-running workflows. Each phase runs in an isolated sub-agent with a fresh context window, communicating through files on disk (story files, code, git state). The orchestrator manages state, validates outputs, and pauses for user approval between phases.

**Why sub-agents?** Each phase (create-story, dev-story, evaluate) can consume significant context. Running them inline causes context bloat — by the evaluate phase, the window is stuffed with create + develop history. Sub-agents get the full context budget for their phase and communicate results via files.

## Recipes

### story-cycle (default)
The daily development loop:
1. **Create** → `/create-story` logic (sub-agent)
2. **Develop** → `/dev-story` logic (sub-agent)
3. **Evaluate** → `/evaluate` logic (sub-agent)
4. **Ship** → create branch, commit, push, open PR (orchestrator — lightweight, no sub-agent needed)

### planning-cycle
Used at project or epic boundaries:
1. **Brief** → `/create-product-brief` logic (sub-agent)
2. **PRD** → `/create-prd` logic (sub-agent)
3. **Architecture** → `/create-architecture` logic (sub-agent)
4. **UX** → `/create-ux` logic (sub-agent)
5. **Epics** → `/create-epics` logic (sub-agent)

### test-first-cycle
ATDD variant of the story cycle:
1. **Create** → `/create-story` logic (sub-agent)
2. **ATDD** → `/create-atdd` logic (sub-agent)
3. **Develop** → `/dev-story` logic (sub-agent)
4. **Evaluate** → `/evaluate` logic (sub-agent)

## Process

### Step 1: Initialize

Check for existing state in `docs/project/.orchestrator-state.yaml`. If found, ask the user if they want to resume or start fresh.

If starting fresh, ask which recipe to run (default: story-cycle). If the user provides a story number or epic reference, capture it for the first phase.

Create or update state file:

```yaml
workflow: story-cycle
story_arg: "18-3"  # user-provided story reference, or null
started: 2026-03-28T10:00:00Z
current_phase: create
phases:
  create: { status: pending, story_file: null }
  develop: { status: pending }
  evaluate: { status: pending }
  ship: { status: pending }
```

### Step 2: Execute phases via sub-agents

For each phase in the recipe:

1. Display phase banner: **"PHASE: {name} ({N}/{total})"**
2. Read the corresponding skill file from `.claude/commands/{skill-name}.md`
3. Strip the YAML frontmatter (the `---` block) — sub-agents don't need it
4. Build the agent prompt (see Phase Prompt Template below)
5. Launch the sub-agent using the `Agent` tool with `subagent_type: "general-purpose"`
6. When the agent returns, validate the phase output (see Phase Validation below)
7. Update state file with results

**Between phases**: Pause and present to the user:
- Summary of what the sub-agent produced (key files written/modified, test results, etc.)
- What the next phase will do
- Options: **[C]ontinue**, **[S]kip**, **[A]bort**

Wait for user input before proceeding. Use `AskUserQuestion` with those three options.

### Step 3: Completion

When all phases complete:
- Delete `docs/project/.orchestrator-state.yaml`
- Report full cycle summary (phases completed, files changed, tests passing)
- Suggest next action

## Phase Prompt Template

When launching a sub-agent for a phase, construct the prompt as follows:

```
You are executing the "{phase_name}" phase of a {workflow} workflow.

{If story_arg or story_file is known:}
Target story: {story_arg or story_file path}

{Full contents of the skill .md file, with frontmatter stripped}

IMPORTANT RULES:
- Execute the skill's full process — do not skip steps or shortcut validation gates.
- Write all outputs to disk (story files, code, test files, sprint-status.yaml).
- When done, report: (1) files created/modified, (2) test results if applicable, (3) final status of the skill's validation gates, (4) any issues or blockers encountered.
- Do NOT open PRs or push to remote — the orchestrator's Ship phase handles that.
```

**Additional context to include in the prompt based on phase:**

- **Create phase**: Include the user's story arg if provided.
- **Develop phase**: Include the story file path from the create phase output (stored in state).
- **Evaluate phase**: Include the story file path. The sub-agent will discover git changes, run tests, and smoke-test the live app itself.
- **Ship phase**: No sub-agent — the orchestrator handles this directly (git add, commit, push, PR).
- **Planning phases** (brief, PRD, architecture, UX, epics): Include any user-provided context or references.

## Phase Validation

After each sub-agent returns, the orchestrator validates:

### Create phase
- [ ] Story file exists at expected path (`docs/project/stories/epic-{N}/{story-key}.md`)
- [ ] Story status is "ready-for-dev"
- [ ] Sprint status updated
- Record `story_file` path in state

### Develop phase
- [ ] All tasks in story file are marked `[x]`
- [ ] Story status is "review"
- [ ] Sub-agent reported all tests passing

### Evaluate phase
- [ ] All three test suites executed (backend, frontend, E2E)
- [ ] Every AC smoke-tested in the live app with screenshots
- [ ] All four grading dimensions scored with evidence
- [ ] Overall verdict is PASS or CONDITIONAL PASS (all issues fixed)
- [ ] Story status is "done" (if evaluation passed)

### ATDD phase
- [ ] Acceptance test files created
- [ ] Tests fail (red) — confirming they test unimplemented behavior

### Ship phase (orchestrator-direct, no sub-agent)
1. Verify we're on a feature branch (not main) — create one if needed
2. `git add` changed files (review the list, exclude sensitive files)
3. `git commit` with conventional message
4. `git push -u origin {branch}`
5. `gh pr create` with summary pulled from story file
6. Report PR URL

### Planning phases (brief, PRD, architecture, UX, epics)
- [ ] Output file exists at expected path in `docs/project/`
- [ ] File is non-empty and contains expected sections

## State Recovery

If the orchestrator finds existing state on startup:
- Show the current recipe, phase, and last completed phase
- Ask: **Resume from {current_phase}?** or **Start fresh?**
- On resume: pick up from the incomplete phase with full context from state file

## Rules

- Always pause between phases for user approval
- Save state after every phase completion (enables recovery across sessions)
- Each sub-agent follows the same validation gates as its standalone skill
- The orchestrator does not shortcut any phase — full process every time
- If a phase fails validation, do not proceed to the next phase — ask the user how to proceed
- Sub-agents run in the main workspace (not worktrees) since changes must accumulate
- The Ship phase is the only phase that touches git remote (push/PR)
