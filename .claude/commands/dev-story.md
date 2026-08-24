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

### Step 1.5: Ensure feature branch

Check the current git branch. If on `main` (or another shared/default branch), create and switch to a new feature branch before making any code changes.

**Branch naming**: derive from the story number and title. Format: `story/<number>-<kebab-case-title>`. Examples:
- Story 18-1 "Upgrade MockQueryable Moq" → `story/18-1-upgrade-mockqueryable-moq`
- Story 5-3 "Add Vendor Search" → `story/5-3-add-vendor-search`

If already on a branch that matches the story (e.g., from a previous session), stay on it. Only create a new branch when needed.

### Step 1.75: Infrastructure check (Docker + services)

Before writing any code, verify Docker and required services are running. TDD requires running tests, and tests require infrastructure.

```bash
docker ps --format '{{.Names}}' 2>&1
```

**Required containers:** `property-manager-db-1` (PostgreSQL), `property-manager-mailhog-1` (MailHog).

- If Docker daemon is not running → **HALT**: Tell the user: "Docker is not running. Please start Docker Desktop, then run `docker compose up -d db mailhog` and tell me to continue."
- If required containers are missing/stopped → **HALT**: Tell the user: "Required containers are not running. Please run `docker compose up -d db mailhog` and tell me to continue."

**NEVER skip tests because infrastructure is down.** Ask the user to start it.

### Step 2: Load context and research

- Load `docs/project/project-context.md` for coding standards and project-wide patterns
- Extract developer guidance from the story's Dev Notes section
- Research key technologies, APIs, and patterns involved in the current task using documentation lookup or web search
- Record key findings in Dev Agent Record

### Step 2.5: Test scope assessment

Before writing any code, read the story's Test Scope section (in Dev Notes) and verify which testing pyramid levels are required. If the story lacks a Test Scope section, determine it yourself:

- **Unit tests**: Always required. Identify what needs unit tests (handlers, validators, stores, components, services).
- **Integration tests**: Required if the story adds or modifies backend API endpoints. Check the story tasks — if any task touches a controller, command, or query, integration tests are needed in `PropertyManager.Api.Tests/`.
- **E2E tests**: Required if the story adds new user-facing pages, flows, or significant UI changes. Check the story tasks — if any task creates new routes, forms, or interactive UI, E2E tests are needed in `frontend/e2e/tests/`.

**Write down your test plan now** — which test files you will create, at which pyramid levels. Add this to the Dev Agent Record. Do NOT defer test creation to "later" — each task's TDD cycle must include tests at the appropriate level. E2E tests should be written as a dedicated task, not skipped because "all unit tests pass."

### Step 3: Update sprint status

Read `docs/project/sprint-status.yaml`. Update the story status to "in-progress" if currently "ready-for-dev". Save the file preserving all comments and structure.

### Step 4: Implement task (red-green-refactor cycle)

For each incomplete task/subtask, follow this cycle:

**RED**: Write FAILING tests first for the task functionality. Confirm they fail before implementation — this validates test correctness.

**GREEN**: Implement MINIMAL code to make tests pass. Run tests to confirm they pass. Handle error conditions and edge cases as specified.

**REFACTOR**: Improve code structure while keeping tests green. Ensure code follows architecture patterns from Dev Notes.

**MIGRATION**: If the task creates an EF Core migration, always run `dotnet ef database update` to apply it to the local database. The app cannot be verified against the real database otherwise.

**Verify locally** (before review):
- Verify ALL tests for this task actually exist and pass
- Run full test suite to ensure no regressions
- Scan new/modified log statements for PII (emails, user/account IDs, storage keys, request fields). CodeQL flags these as "Exposure of private information" (CWE-359) even when masked via `LogSanitizer.MaskEmail/MaskId/MaskStorageKey/Sanitize` — the taint analyzer does not recognize our custom sanitizers. Prefer removing PII from the message entirely; rely on structured context (correlation IDs, trace IDs) instead.

**Two-stage review**: Dispatch a spec-compliance subagent, then a code-quality subagent. Each gets fresh context — they judge the diff on its merits, not on your narrative. You (the implementer) stay in-context throughout. See the **Two-Stage Review Protocol** section below for the skip rule, dispatch templates, and iteration caps. Skip both only if the task qualifies as trivial under the skip rule.

**Mark complete**:
- Confirm implementation matches exactly what the task specifies — no extra features
- Validate related acceptance criteria are satisfied
- Confirm both review stages either PASSED/APPROVED or were skipped per the trivial rule
- ONLY THEN mark the task `[x]`
- Update File List with new/modified/deleted files
- Append the review-log entry for this task to Dev Agent Record

**HALT conditions**:
- New dependencies required beyond story specifications → ask user
- 3 consecutive implementation failures → request guidance
- Required configuration is missing
- Spec review still `FAIL` after 2 iterations → surface gaps, ask user how to proceed (accept and file follow-up, amend the story, or keep iterating)
- Quality review still `ISSUES_FOUND` after 2 iterations → present remaining issues with options (merge with known issues + file follow-ups in the story, or keep iterating once more then HALT)

**Rules**:
- NEVER implement anything not mapped to a specific task/subtask
- NEVER proceed to next task until current task is complete AND tests pass AND reviews are settled
- NEVER mark a task complete unless ALL validation gates pass (including the two-stage review or its skip justification)
- Execute continuously — do NOT pause for user check-in between tasks unless a HALT condition fires

If more tasks remain, repeat Step 4. If all tasks done, continue to Step 5.

### Step 5: Story completion

- Verify ALL tasks and subtasks are marked `[x]`
- Run the full test suite (do not skip)
- Confirm File List includes every changed file
- Update story Status to "review"
- Update `docs/project/sprint-status.yaml`: set story status to "review"

**Cleanup**:
- Delete all files in `screenshots/` (keep `.gitkeep`): `find screenshots/ -type f ! -name '.gitkeep' -delete`

**Definition of Done checklist**:
- All tasks/subtasks marked complete
- Implementation satisfies every Acceptance Criterion
- **Testing pyramid respected** (all three levels required for full-stack stories):
  - Unit tests: handler/validator/store/component logic (always required)
  - Integration tests: API endpoint tests via `WebApplicationFactory` in `PropertyManager.Api.Tests/` — auth, validation, CRUD, tenant isolation, full-cycle flow (required for new/changed endpoints)
  - E2E tests: Playwright tests in `frontend/e2e/tests/` — critical user flows through the real UI (required for new/changed UI features)
- All tests pass (no regressions)
- EF Core migrations applied locally (`dotnet ef database update`)
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

## Two-Stage Review Protocol

After each task's tests pass locally, dispatch two fresh subagents — spec compliance first, then code quality. Each starts with a clean context window so it judges the diff on its merits, not on your narrative as implementer. You stay in-context throughout; only the reviewers are subagents.

### Skip Rule (trivial tasks)

Skip both reviews if **all** of these are true:
- `git diff --stat HEAD` shows ≤10 lines changed in source files (excluding generated code such as `frontend/src/app/core/api/generated/*`)
- No new files created under `backend/src/` or `frontend/src/`
- No test files touched beyond the obvious unit test for this task

When skipping, the Review Log entry must be: `Task N: SKIPPED (trivial — <reason>)`. If even one condition fails, run both reviews.

### Stage 1: Spec Compliance Review

Dispatch with the `Agent` tool, `subagent_type: "general-purpose"`. Prompt the subagent with:

```
You are reviewing ONE task's implementation for SPEC COMPLIANCE only.
You are not evaluating code quality — only whether the code matches
the spec and the ACs it touches.

## Inputs

- Story file: <absolute path>
- Task being reviewed: Task N — "<verbatim task text from story file>"
- Acceptance criteria touched by this task: <list AC numbers, e.g. AC1, AC3>
- Files changed for this task: <list of file paths>
- Run yourself: `git diff HEAD -- <those files>` to see the actual diff
- Test output excerpt: <relevant test output for the task>

## Your job

Answer two questions:

1. Does the implementation match what the task SAYS to build?
   - Scope drift (built more than specified)
   - Scope gap (built less than specified)
   - Misinterpretation (built a different thing)

2. Does the implementation satisfy the acceptance criteria it touches?
   - Read each AC literally from the story file
   - Check whether the diff makes the AC true
   - Note any AC the diff does NOT cover

## Response format

If everything matches:
PASS
<one-sentence summary of what was verified>

If anything is off:
FAIL
- Gap 1: <specific gap, citing AC number or task line>
- Gap 2: ...

Cite file paths and line numbers from the diff. Do NOT comment on
naming, code style, or other quality concerns — those are a separate
review.
```

**If `PASS`:** proceed to Stage 2.

**If `FAIL`:**
1. You (in main context) address each gap
2. Re-dispatch a fresh spec-review subagent with the updated diff
3. Max 2 iterations. If still `FAIL` after iteration 2 → HALT, surface gaps to user.

### Stage 2: Code Quality Review

Only after Stage 1 passes. Dispatch a fresh subagent (do not reuse the spec reviewer):

```
You are doing an ADVERSARIAL code quality review on ONE task's
implementation. Your job is to find real problems. If you genuinely
cannot find at least 2 substantive issues, the review is APPROVE.
Do not stretch to invent issues, but do not soften criticism either.

## Inputs

- Files changed for this task: <list>
- Run yourself: `git diff HEAD -- <those files>` for the diff
- Test output excerpt: <results>
- READ FIRST: `docs/project/project-context.md` (project-wide rules)
- READ IF RELEVANT: `docs/project/architecture.md` (architecture patterns)

## What to look for

- **Naming:** are variables/functions/files named for what they ARE,
  not how they got there or who happens to use them?
- **DRY:** any duplication that warrants extraction? Or premature
  abstraction that should be inlined?
- **Error handling:** errors handled where they happen vs. validated
  at boundaries? Over-defensive try/catch around impossible cases?
  Any swallowed errors?
- **Tests:** do tests verify BEHAVIOR or just IMPLEMENTATION DETAILS?
  Obvious edge cases that would catch real bugs but aren't covered?
  Mocks hiding integration risk?
- **Security:** input validation at trust boundaries, authorization
  checks present, no secrets in code, no SQL injection or XSS exposure?
- **PII in logs:** any log statement embedding emails, user IDs, account
  IDs, storage keys, or other PII — even when wrapped in
  `LogSanitizer.MaskEmail`, `MaskId`, `MaskStorageKey`, or `Sanitize`?
  CodeQL's taint analyzer does not recognize our custom sanitizers as
  safe sinks and will flag these as "Exposure of private information"
  (CWE-359). Preferred fix: remove the PII from the message entirely —
  structured context (correlation IDs, trace IDs) is usually sufficient.
  Reserve masking for cases where the value is genuinely diagnostic and
  accept that CodeQL may still flag it.
- **Patterns:** does the code follow conventions from
  project-context.md? Any unjustified deviations?
- **Comments:** comments that just describe WHAT the code does (when
  a good name would suffice)? "Added for ticket X" / "used by Y"
  comments that belong in a PR description?

## Response format

If you find ≥2 real issues:
ISSUES_FOUND
1. <file:line> — <issue> — <recommended fix>
2. <file:line> — <issue> — <recommended fix>
...

If you genuinely cannot find 2 real issues:
APPROVE
<one-sentence note on what was strongest about the implementation>

Trivial nits (whitespace, single-word comment tweaks, "could be more
idiomatic") do not count. If you have to stretch, just APPROVE.
```

**If `APPROVE`:** mark the task complete.

**If `ISSUES_FOUND`:**
1. You address each issue in main context
2. Re-dispatch a fresh quality-review subagent with the updated diff
3. Max 2 iterations. If still `ISSUES_FOUND` after iteration 2 → present
   remaining issues to the user with options (merge with known issues
   and file follow-ups in the story, or one more override iteration then HALT).

### Recording Reviews

Append a "Review Log" subsection to Dev Agent Record after each task:

```
### Review Log

- Task 1: Spec PASS (1 iter); Quality APPROVE (1 iter)
- Task 2: Spec PASS (2 iters — fixed AC3 coverage gap); Quality APPROVE (1 iter)
- Task 3: SKIPPED (trivial — renamed config key, 4 lines)
- Task 4: Spec PASS (1 iter); Quality APPROVE (2 iters — fixed naming + missing null check)
```

This is evidence for `/evaluate` and for the orchestrator's Develop-phase validation. A task without a Review Log entry has unknown review status — treat that as a validation-gate failure.

## Validation Gates

- [ ] Every task marked `[x]` has passing tests proving it works
- [ ] No tasks marked complete without actual implementation
- [ ] Full test suite passes with zero regressions
- [ ] File List is complete and accurate
- [ ] Story status and sprint-status.yaml are in sync
- [ ] Dev Agent Record contains a Review Log entry for every task (Spec PASS + Quality APPROVE, or explicit SKIPPED with reason per the trivial rule)
