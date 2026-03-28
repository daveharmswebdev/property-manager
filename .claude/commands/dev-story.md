---
description: "Execute story implementation with TDD, validation gates, and sprint status tracking"
---

# Develop Story

## Context

Execute a story by implementing all tasks/subtasks using red-green-refactor TDD. Continue in a single execution until the story is COMPLETE — do not stop for "milestones", "significant progress", or "session boundaries" unless a HALT condition is triggered or the user intervenes.

## Critical Tools

- **Ref MCP** — Before implementing each task, use `mcp__Ref__ref_search_documentation` to verify API signatures, configuration patterns, and library usage for the technologies involved. Do this proactively, not after hitting errors. The LLM's training data is ~1 year behind current package versions.
- **GitHub CLI (`gh`)** — Check recent PRs and commits for relevant patterns before implementing. Use `gh run view` to investigate CI failures. The repo's history is institutional memory.
- **Playwright MCP** — For frontend tasks, use the browser to visually verify your work during development, not just for automated tests. Navigate to the page and confirm the UI looks and behaves correctly.

## Inputs

- Story file: user provides path, OR discover from `docs/project/sprint-status.yaml` (first story with status "ready-for-dev")
- `docs/project/project-context.md` — critical implementation rules
- `docs/project/architecture.md` — architecture patterns (if needed)

## Process

### Step 1: Find and load story

If the user provides a story path, use it directly. Otherwise, read `docs/project/sprint-status.yaml` completely and find the FIRST story with status "ready-for-dev".

Read the COMPLETE story file. Parse sections: Story, Acceptance Criteria, Tasks/Subtasks, Dev Notes, Dev Agent Record.

Identify the first incomplete task (unchecked `[ ]`). If no incomplete tasks remain, go to Step 5.

If this is a continuation after a code review (story has a "Senior Developer Review" section with unchecked follow-up items), prioritize those review follow-up tasks first.

### Step 2: Load context and research

- Load `docs/project/project-context.md` for coding standards and project-wide patterns
- Extract developer guidance from the story's Dev Notes section
- Research key technologies, APIs, and patterns involved in the current task using documentation lookup or web search
- Record key findings in Dev Agent Record

### Step 3: Update sprint status

Read `docs/project/sprint-status.yaml`. Update the story status to "in-progress" if currently "ready-for-dev". Save the file preserving all comments and structure.

### Step 4: Implement task (red-green-refactor cycle)

For each incomplete task/subtask, follow this cycle:

**RED**: Write FAILING tests first for the task functionality. Confirm they fail before implementation — this validates test correctness.

**GREEN**: Implement MINIMAL code to make tests pass. Run tests to confirm they pass. Handle error conditions and edge cases as specified.

**REFACTOR**: Improve code structure while keeping tests green. Ensure code follows architecture patterns from Dev Notes.

**Validate and mark complete**:
- Verify ALL tests for this task actually exist and pass
- Confirm implementation matches exactly what the task specifies — no extra features
- Validate related acceptance criteria are satisfied
- Run full test suite to ensure no regressions
- ONLY THEN mark the task `[x]`
- Update File List with new/modified/deleted files
- Add completion notes to Dev Agent Record

**HALT conditions**:
- New dependencies required beyond story specifications → ask user
- 3 consecutive implementation failures → request guidance
- Required configuration is missing

**Rules**:
- NEVER implement anything not mapped to a specific task/subtask
- NEVER proceed to next task until current task is complete AND tests pass
- NEVER mark a task complete unless ALL validation gates pass
- Execute continuously — do NOT pause for review until all tasks are done

If more tasks remain, repeat Step 4. If all tasks done, continue to Step 5.

### Step 5: Story completion

- Verify ALL tasks and subtasks are marked `[x]`
- Run the full test suite (do not skip)
- Confirm File List includes every changed file
- Update story Status to "review"
- Update `docs/project/sprint-status.yaml`: set story status to "review"

**Definition of Done checklist**:
- All tasks/subtasks marked complete
- Implementation satisfies every Acceptance Criterion
- Unit tests for core functionality added/updated
- Integration tests added when required
- E2E tests for critical flows added when story demands them
- All tests pass (no regressions)
- File List includes every new/modified/deleted file
- Dev Agent Record contains implementation notes

### Step 6: Completion summary

Report to the user:
- Story ID, key, title
- Key changes made
- Tests added
- Files modified
- Story file path and current status ("review")

Suggest running `/code-review` next. Tip: for best results, clear context first.

## Validation Gates

- [ ] Every task marked `[x]` has passing tests proving it works
- [ ] No tasks marked complete without actual implementation
- [ ] Full test suite passes with zero regressions
- [ ] File List is complete and accurate
- [ ] Story status and sprint-status.yaml are in sync
