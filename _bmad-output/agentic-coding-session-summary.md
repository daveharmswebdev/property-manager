# Agentic Software Development: A Session Case Study

## Session Overview

**Date:** February 2, 2026
**Task:** Code Review for PR #140 (Work Order Photo Viewing - Story 10-6)
**Outcome:** 3 critical issues fixed, 7 tech debt issues logged, PR merged

---

## What Happened in This Session

### 1. Code Review Request
The developer requested a code review for a specific GitHub pull request:
```
https://github.com/daveharmswebdev/property-manager/pull/140
```

### 2. Agent Analysis
The AI agent performed a thorough adversarial code review:
- Fetched PR diff using `gh pr diff 140`
- Read 12+ source files across backend and frontend
- Identified **3 critical issues** and **7 tech debt items**
- Ran existing test suites to validate findings

### 3. Critical Issues Identified & Fixed

| Issue | Severity | Root Cause | Fix Applied |
|-------|----------|------------|-------------|
| Missing Unit Tests | HIGH | 2 new handlers had 0 test coverage | Added 18 unit tests |
| Race Condition | HIGH | Two `SaveChangesAsync` calls without transaction | Wrapped in database transaction |
| setTimeout Hack | HIGH | Using `setTimeout(100ms)` to wait for state | Replaced with optimistic UI update |

### 4. Tech Debt Logged to GitHub Issues

Rather than fixing everything in one PR, tech debt was properly tracked:

| GitHub Issue | Description | Priority |
|--------------|-------------|----------|
| [#141](https://github.com/daveharmswebdev/property-manager/issues/141) | ArgumentException should be ValidationException | Medium |
| [#142](https://github.com/daveharmswebdev/property-manager/issues/142) | Add duplicate ID validation to validator | Medium |
| [#143](https://github.com/daveharmswebdev/property-manager/issues/143) | Fix non-null assertions on photo IDs | Medium |
| [#144](https://github.com/daveharmswebdev/property-manager/issues/144) | Fix frontend test environment | High |
| [#145](https://github.com/daveharmswebdev/property-manager/issues/145) | Extract magic number constant | Low |
| [#146](https://github.com/daveharmswebdev/property-manager/issues/146) | Remove unused parameter | Low |
| [#147](https://github.com/daveharmswebdev/property-manager/issues/147) | Update documentation reference | Low |

### 5. Validation & Merge
- All 1,370 backend tests passing (18 new tests added)
- Changes committed with conventional commit message
- PR merged to main
- Sprint status updated (Epic 10 marked complete)

---

## Key Insight: AI Changes the "How," Not the "What"

### The Engineering Practices Remain Unchanged

```
┌─────────────────────────────────────────────────────────────┐
│                    SOFTWARE ENGINEERING                      │
│                     (Same for 10+ years)                    │
├─────────────────────────────────────────────────────────────┤
│  • Code Reviews          • Unit Testing                     │
│  • Pull Requests         • Issue Tracking                   │
│  • Version Control       • CI/CD Pipelines                  │
│  • Tech Debt Management  • Sprint Planning                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI-ASSISTED EXECUTION                     │
│                        (New in 2024+)                       │
├─────────────────────────────────────────────────────────────┤
│  • Faster code generation   • Pattern recognition           │
│  • Automated test writing   • Cross-file analysis           │
│  • Documentation drafting   • Issue description generation  │
└─────────────────────────────────────────────────────────────┘
```

### What the AI Did in This Session

1. **Used `gh` CLI** to fetch PR information from GitHub
2. **Read files** to understand context before making changes
3. **Ran `dotnet test`** to validate changes don't break existing code
4. **Created GitHub issues** with proper labels, descriptions, and acceptance criteria
5. **Made atomic commits** with conventional commit messages
6. **Pushed to the correct branch** (not creating a new one)

### What the AI Did NOT Do

- ❌ Replace the need for human judgment on priorities
- ❌ Decide which issues are critical vs. tech debt
- ❌ Merge the PR (human approval required)
- ❌ Bypass the existing CI/CD pipeline
- ❌ Skip writing tests for new code

---

## GitHub as the Source of Truth

### The Integration Points

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Claude Code    │────▶│      GitHub      │────▶│    CI/CD         │
│   (AI Agent)     │     │  (Source of Truth)│     │   (Validation)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                         │                        │
        │                         │                        │
   Uses gh CLI              Stores:                   Runs:
   to interact         • Code (PRs, branches)      • Tests
                       • Issues (tech debt)        • Linting
                       • History (commits)         • Builds
                       • Reviews (comments)        • Deployments
```

### Why This Matters

1. **Accountability**: Every change is tracked in git history
2. **Traceability**: Issues link to PRs, PRs link to commits
3. **Collaboration**: Human developers can review AI-generated changes
4. **Persistence**: Tech debt doesn't get lost in chat history—it's in GitHub Issues
5. **Process Compliance**: Same PR review process, same CI checks

### Commands Used in This Session

```bash
# Fetching PR information
gh pr diff 140

# Running tests
dotnet test

# Creating issues with full metadata
gh issue create --title "..." --body "..."

# Standard git workflow
git add <files>
git commit -m "..."
git push
```

---

## The Human-AI Collaboration Model

### This Session's Workflow

```
Human                          AI Agent                       GitHub
  │                               │                              │
  │──"Review PR #140"────────────▶│                              │
  │                               │──gh pr diff 140─────────────▶│
  │                               │◀─────────diff content────────│
  │                               │                              │
  │                               │──[Reads 12+ files]           │
  │                               │──[Runs tests]                │
  │                               │                              │
  │◀─"Found 3 critical issues"────│                              │
  │                               │                              │
  │──"Fix critical, log rest"────▶│                              │
  │                               │──[Writes code]               │
  │                               │──[Writes tests]              │
  │                               │──gh issue create (x7)───────▶│
  │                               │──git commit && push─────────▶│
  │                               │                              │
  │──[Reviews in GitHub UI]──────────────────────────────────────│
  │──[Merges PR]─────────────────────────────────────────────────│
  │                               │                              │
  │──"Update progress"───────────▶│                              │
  │                               │──[Updates sprint-status.yaml]│
```

### What This Demonstrates

1. **The human remains in control** of decisions (what to fix now vs. later)
2. **The AI accelerates execution** (writing tests, creating issues)
3. **GitHub provides the framework** for collaboration and tracking
4. **Standard tools are preserved** (git, gh CLI, dotnet test)

---

## Lessons for Agentic Software Development

### 1. AI is a Force Multiplier, Not a Replacement

The AI wrote 18 unit tests, but a human decided:
- Which issues were critical
- What should be tech debt
- When to merge the PR

### 2. Infrastructure Matters More Than Ever

The value of GitHub Issues, PRs, and CI/CD pipelines is **amplified** by AI:
- AI can create 7 well-documented issues in seconds
- But those issues go through the same human triage process
- CI still runs the same test suites

### 3. The 10-Year-Old Practices Still Apply

| Practice | Still Required? | AI Enhancement |
|----------|-----------------|----------------|
| Code Review | ✅ Yes | AI can do first pass, human approves |
| Unit Testing | ✅ Yes | AI writes tests faster |
| Issue Tracking | ✅ Yes | AI creates issues with better descriptions |
| Git Workflow | ✅ Yes | AI follows branching conventions |
| Documentation | ✅ Yes | AI generates it, human validates |

### 4. The "Source of Truth" Concept is Critical

Without GitHub as the source of truth:
- Tech debt would be lost in chat logs
- Code changes wouldn't be auditable
- CI/CD couldn't validate AI-generated code
- Collaboration would break down

---

## Conclusion

> **AI changes how we write code, but it doesn't change how we perform as software developers.**

The session demonstrated that agentic AI coding:
- **Accelerates** the mechanical aspects of development
- **Preserves** the engineering practices we've refined over decades
- **Integrates** with existing tools rather than replacing them
- **Requires** human judgment for decisions that matter

The future isn't AI replacing developers—it's developers wielding AI tools within the same robust engineering frameworks we've always trusted.

---

## Session Statistics

| Metric | Value |
|--------|-------|
| Files Changed | 5 |
| Lines Added | 578 |
| Lines Removed | 20 |
| New Unit Tests | 18 |
| GitHub Issues Created | 7 |
| Total Backend Tests | 1,370 (all passing) |
| Time to Review & Fix | ~20 minutes |
