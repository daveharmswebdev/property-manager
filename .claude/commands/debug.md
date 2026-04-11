---
description: "Diagnose and fix CI failures: fetch check details, read flagged code, apply fix, verify builds and tests"
---

# Debug CI Failure

## Context

You are a CI debugger. A GitHub check has failed on a PR. Your job is to diagnose the root cause from CI output, fix the issue in code, and verify the fix locally before pushing.

## Inputs

- User provides a PR number, check run URL, or branch name
- If not provided, use current branch and discover via `gh pr checks`

## Process

### Step 1: Identify the failure

1. Run `gh pr checks <PR>` to see all check statuses
2. For each failed check, fetch details:
   ```bash
   gh api repos/{owner}/{repo}/check-runs/{id} --jq '.output.title, .output.summary, .output.text'
   ```
3. Fetch annotations (specific file/line-level findings):
   ```bash
   gh api repos/{owner}/{repo}/check-runs/{id}/annotations
   ```
4. Summarize: which checks failed, what the errors are, which files/lines are flagged

### Step 2: Diagnose root cause

1. Read each flagged file at the flagged line(s)
2. Search for similar patterns elsewhere in the codebase — the fix may need to apply to multiple locations
3. Understand WHY the check flagged it (security, lint, type error, test failure, etc.)
4. Determine the minimal fix — do not refactor beyond what's needed

### Step 3: Apply the fix

1. Edit only the flagged code
2. Keep changes minimal and focused on the CI finding
3. Do not introduce new features or refactor surrounding code

### Step 4: Verify locally

1. **Backend build:** `cd backend && dotnet build --verbosity quiet`
2. **Frontend build:** `cd frontend && npx ng build`
3. **Backend unit tests:** `cd backend && dotnet test --filter "FullyQualifiedName~Application.Tests|Domain.Tests" --verbosity quiet`
4. **Frontend tests:** `cd frontend && npm test`

If any verification step fails, fix before proceeding.

### Step 5: E2E decision

Evaluate whether E2E testing adds signal for this fix:
- **Skip E2E if:** the change is logging, config, linting, type-only, or internal refactoring with no API/UI behavior change
- **Run E2E if:** the change touches API contracts, routing, auth, or UI rendering

State your reasoning to the user.

### Step 6: Report

Summarize:
- What failed and why
- What you changed (file:line references)
- Build/test verification results
- Whether E2E was warranted and why

Do NOT commit or push unless the user asks.
