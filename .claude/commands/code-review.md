---
description: "Adversarial code review: find 3-10 issues, cross-reference git reality, auto-fix with approval"
---

# Adversarial Code Review

## Context

You are performing an adversarial code review. Your job is to find what is wrong or missing. You must find a minimum of 3 specific, actionable issues. No "looks good" reviews — challenge everything: code quality, test coverage, architecture compliance, security, performance.

A task marked `[x]` but not actually done is a CRITICAL finding. An acceptance criterion not implemented is a HIGH severity finding.

## Critical Tools

- **GitHub CLI (`gh`)** — Use `gh pr diff`, `gh pr view`, and `gh api` to pull actual PR changes, CI status, and review comments. Cross-reference the PR diff against story claims.
- **Ref MCP** — When reviewing code that uses specific APIs or library features, verify the usage is correct against current documentation via `mcp__Ref__ref_search_documentation`. Outdated API usage is a valid review finding.

## Inputs

- Story file: user provides path, or discover from `docs/project/sprint-status.yaml` (first story with status "review")
- `docs/project/project-context.md` — coding standards
- `docs/project/architecture.md` — architecture compliance

## Process

### Step 1: Load story and discover changes

1. Read the COMPLETE story file
2. Parse: Acceptance Criteria, Tasks/Subtasks, File List, Change Log
3. Run `git status --porcelain` and `git diff --name-only` to find actual changes
4. Compare story's File List against git reality — note discrepancies:
   - Files in git but not in story File List → MEDIUM finding (incomplete documentation)
   - Story lists files but no git changes → HIGH finding (false claims)
   - Uncommitted changes not documented → MEDIUM finding
5. Load `docs/project/project-context.md` for coding standards
6. Load `docs/project/architecture.md` for architecture patterns

### Step 2: Build review attack plan

1. Extract ALL Acceptance Criteria
2. Extract ALL Tasks/Subtasks with completion status (`[x]` vs `[ ]`)
3. From File List, compile list of claimed changes
4. Create review plan:
   - AC Validation: verify each AC is actually implemented
   - Task Audit: verify each `[x]` task is really done
   - Code Quality: security, performance, maintainability
   - Test Quality: real tests vs placeholder assertions

### Step 3: Execute adversarial review

**AC Validation**: For EACH Acceptance Criterion:
1. Read the requirement
2. Search implementation files for evidence
3. Mark: IMPLEMENTED, PARTIAL, or MISSING
4. If MISSING/PARTIAL → HIGH severity finding

**Task Completion Audit**: For EACH task marked `[x]`:
1. Read the task description
2. Search files for evidence it was actually done
3. If marked `[x]` but NOT done → CRITICAL finding
4. Record specific proof (file:line)

**Code Quality Deep Dive**: For EACH changed file:
1. Security — injection risks, missing validation, auth issues
2. Performance — N+1 queries, inefficient loops, missing caching
3. Error Handling — missing try/catch, poor error messages
4. Code Quality — complex functions, magic numbers, poor naming
5. Test Quality — are tests real assertions or placeholders?

**Testing Pyramid Audit**: For full-stack stories, verify all three levels are present:
- Unit tests in `PropertyManager.Application.Tests/` and frontend `.spec.ts` files
- Integration tests in `PropertyManager.Api.Tests/` (WebApplicationFactory-based endpoint tests)
- E2E tests in `frontend/e2e/tests/` (Playwright user-flow tests)
- Missing a level of the pyramid → HIGH severity finding

**If fewer than 3 issues found**: Look harder — edge cases, null handling, architecture violations, documentation gaps, integration issues, dependency problems.

### Step 4: Present findings and offer fixes

Categorize: HIGH (must fix), MEDIUM (should fix), LOW (nice to fix).

Present findings with specific file:line references. Then ask:

1. **Fix automatically** — update code and tests for all HIGH/MEDIUM issues
2. **Create action items** — add to story Tasks/Subtasks as "Review Follow-ups (AI)" for later
3. **Show details** — deep dive into specific issues

If user chooses auto-fix: fix the issues, run tests, update File List and Dev Agent Record.

### Step 5: Update story and sprint status

- If all HIGH/MEDIUM fixed AND all ACs implemented: set story status to "done", update `docs/project/sprint-status.yaml` to "done"
- If issues remain: set status to "in-progress" for continued work

Report: story status, issues fixed count, action items created.

## Validation Gates

- [ ] Minimum 3 issues identified (or explicit justification why fewer)
- [ ] Every AC verified against actual code (not just checkbox)
- [ ] Git reality cross-referenced with story File List
- [ ] Story status and sprint-status.yaml updated consistently
