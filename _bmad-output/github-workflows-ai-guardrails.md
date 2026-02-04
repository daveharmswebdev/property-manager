# GitHub Workflows as AI Guardrails

**How Automated Pipelines Keep AI-Generated Code Healthy**

---

## Core Concept

GitHub Workflows act as **automated quality gates** that correct AI output before it reaches production. The AI proposes code; the pipeline validates it. Only passing code gets merged. Two months of feature additions, zero regressions.

### The Shepherd Metaphor

Think of it this way: **AI-generated code is sheep. GitHub Workflows are the shepherd.**

The shepherd doesn't *create* sheep. The shepherd doesn't *carry* sheep. The shepherd **guides** sheep that would otherwise wander into danger.

Same with workflows: They don't write the code. They don't fix the code. They tell the AI *"not that way"* until the code finds its way home.

| Element | Metaphor | Role |
|---------|----------|------|
| AI-generated code | Sheep | Wanders freely, productive but needs direction |
| GitHub Workflows | Shepherd | Guides toward the pen, nudges strays back |
| Failed CI | Sheep straying | Corrective signal, not punishment |
| Passing PR | Sheep in the pen | Vetted, ready for the barn |
| Human reviewer | Farmer | Owns the flock, decides what enters the barn |
| Production | The barn | Protected destination, only healthy sheep enter |

---

## The Four-Layer Defense

The shepherd doesn't work alone—there are multiple layers watching the flock.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: CI Pipeline (Every Pull Request)              │
│  "Does this code actually work?"                        │
├─────────────────────────────────────────────────────────┤
│  Layer 2: CodeQL Security Analysis (Every PR + Weekly)  │
│  "Is this code safe?"                                   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: CD Pipeline (Every Merge to Main)             │
│  "Did it deploy successfully?"                          │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Dependabot (Weekly/Monthly)                   │
│  "Are we current and secure?"                           │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: The CI Gauntlet

**Trigger:** Every Pull Request
**Philosophy:** If it doesn't pass CI, it doesn't exist.

This is the shepherd's primary work—watching every sheep (PR) that tries to join the flock.

### What Gets Validated

| Job | What It Catches |
|-----|-----------------|
| **Backend Build & Test** | Compilation errors, unit test failures, integration bugs |
| **Frontend Build & Test** | TypeScript errors, Vitest failures, broken imports |
| **Docker Build Verification** | Dockerfile issues, missing dependencies, environment mismatches |
| **E2E Tests** | Real browser failures, API contract breaks, user flow regressions |

### The E2E Reality Check

The E2E job spins up the **full production stack** on every PR:
- PostgreSQL 16 database with migrations applied
- MailHog for email verification flows
- Backend API running in Development mode
- Frontend with Playwright browser automation

**Why This Matters for AI Code:** The AI can write code that compiles but breaks in integration. The E2E suite catches these failures *before* human review even begins. The shepherd spots the stray before it reaches the cliff.

### Concurrency Protection

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Rapid iteration without queue buildup. Push a fix, previous run cancels. The AI can iterate quickly—the shepherd is tireless.

---

## Layer 2: CodeQL Security Scanning

**Trigger:** Every PR + Weekly scheduled scan
**Philosophy:** Security vulnerabilities caught at the source.

This layer watches for wolves in sheep's clothing—code that looks fine but carries hidden dangers.

### Coverage

| Language | What It Scans |
|----------|---------------|
| C# | Backend API, domain logic, data access |
| JavaScript/TypeScript | Angular components, services, state management |

### Extended Query Suite

```yaml
queries: security-extended
```

Not just default rules—extended analysis catches:
- SQL injection patterns
- XSS vulnerabilities
- Insecure deserialization
- Hardcoded credentials
- Path traversal risks

**Real Impact:** PR #175 fixed 51 code scanning alerts. The AI wrote code; CodeQL found the security gaps; the AI fixed them. Human just reviewed the remediation. The shepherd nudged 51 strays back to the flock in a single pass.

---

## Layer 3: CD Pipeline

**Trigger:** Every merge to `main`
**Philosophy:** Merged code = deployed code. No manual intervention.

This is the gate to the barn. Only sheep that passed through the shepherd's watch get to enter.

### The Deployment Chain

```
Merge to main
    ↓
Trigger Render deploy hooks (API + Web)
    ↓
Wait for deployment propagation (60s)
    ↓
Health check verification
    ↓
Production live ✓
```

### The Health Gate

```bash
response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_API_URL/api/v1/health")
if [ "$response" != "200" ]; then
  echo "Health check failed"
  exit 1
fi
```

If the deployment is unhealthy, the pipeline fails. Bad deploys don't get silently ignored. Even at the barn door, a sick sheep gets turned back.

---

## Layer 4: Dependabot Maintenance

**Trigger:** Weekly (npm, NuGet) + Monthly (Docker, GitHub Actions)
**Philosophy:** Dependencies are attack surface. Keep them current.

This layer keeps the flock healthy over time—watching for aging dependencies that could weaken the herd.

### Intelligent Grouping

```yaml
groups:
  angular:
    patterns:
      - "@angular/*"
  microsoft:
    patterns:
      - "Microsoft.*"
```

**Why Grouping Matters:** Instead of 20 individual PRs for Angular packages, Dependabot creates one coherent update. The AI can review and merge logically grouped changes.

### Coverage

| Ecosystem | Directory | Frequency |
|-----------|-----------|-----------|
| npm | `/frontend` | Weekly (Monday) |
| NuGet | `/backend` | Weekly (Monday) |
| Docker | Both | Monthly |
| GitHub Actions | `/` | Monthly |

---

## The Feedback Loop

```
AI writes code (sheep grazes)
    ↓
CI runs tests ──────────────────┐
    ↓                           │
CodeQL scans for vulnerabilities │
    ↓                           │ Strays get nudged back
PR Review (farmer at gate) ←────┤
    ↓                           │
Merge to main                   │
    ↓                           │
CD deploys + health check ──────┘
    ↓
Production (the barn)
```

**The Key Insight:** The AI doesn't need to write perfect code on the first try. The workflows *tell it* when something is wrong. The iteration loop is:

1. AI writes code
2. Workflow fails with specific error (shepherd nudges)
3. AI reads error, writes fix
4. Workflow passes (sheep rejoins flock)
5. Human approves (farmer opens gate)

The human reviews *passing* code, not debugging *broken* code. The farmer isn't out in the field chasing each sheep. The farmer is at the gate, deciding which flock enters the barn.

---

## Why the Codebase Stays Healthy

### Regression Prevention

Every feature addition runs through:
- 230 lines of CI workflow validation
- Full E2E test suite with real database
- Security analysis on both languages

New features can't break existing ones without the pipeline catching it. New sheep can't scatter the existing flock.

### Dependency Hygiene

Dependabot PRs run through the same CI. An update that breaks tests gets flagged automatically. The codebase stays current without introducing instability.

### Security as Default

CodeQL runs on every PR. Security isn't an afterthought or a quarterly audit—it's a gate that every line of AI-generated code must pass.

---

## The Numbers

| Metric | Value |
|--------|-------|
| CI Jobs per PR | 4 (backend, frontend, docker, e2e) |
| Security Queries | Extended suite (C# + JS/TS) |
| Dependency Ecosystems Monitored | 4 |
| Time from Merge to Production | ~2 minutes |
| Manual Deploys Required | 0 |

---

## Key Takeaway

**GitHub Workflows transform AI from a code generator into a supervised contributor.**

> The AI writes code like sheep graze—freely, productively, but prone to wandering. The workflows are the tireless shepherd, watching every PR, nudging strays back toward the flock. The human isn't out in the field chasing each sheep. The human is the farmer at the gate, deciding which flock enters the barn.

The result: a codebase that grows without degrading—because every addition is guided before it lands.

---

*Property Manager: Two months of AI-assisted development, continuous feature additions, zero regressions.*
