# BMAD Method: Analysis & Planning in Practice

**Property Manager Project - Agentic Coding Experience**

---

## The BMAD Workflow

The BMad Method organizes AI-assisted development into four sequential phases where **each document becomes context for the next**.

```
[Analysis] → [Planning] → [Solutioning] → [Implementation]
     ↓            ↓             ↓               ↓
  Product     PRD + UX      Architecture    Sprint/Story
   Brief                    + Stories        Execution
```

**Mapped to traditional cycles:** `plan → implement → review → iterate → done`

| Traditional | BMAD Phase | Output |
|-------------|-----------|--------|
| **Plan** | Analysis + Planning + Solutioning | PRD, Architecture, Stories |
| **Implement** | Implementation (Dev Story) | Code + Tests |
| **Review** | Implementation (Code Review) | PR Feedback |
| **Iterate** | Repeat Dev Story | Fixes |
| **Done** | Story Complete | Merged |

---

## How the PRD Was Created

**File:** `_bmad-output/planning-artifacts/prd.md`
**Date:** November 28, 2025
**Workflow:** `/bmad:bmm:workflows:create-prd`

### Process

1. **Collaborative Discovery** - AI facilitator asked questions, I (Dave) provided domain knowledge
2. **Structured Extraction** - Captured functional requirements (57 FRs) and non-functional requirements (27 NFRs)
3. **Prioritization** - Defined MVP scope vs. Growth vs. Vision features

### Key Sections Produced

| Section | Purpose |
|---------|---------|
| Executive Summary | "From Shoebox to Schedule E" - the core value prop |
| Success Criteria | What "done" looks like for users |
| Product Scope | MVP vs Growth vs Vision features |
| Functional Requirements | FR1-FR57 numbered for traceability |
| Non-Functional Requirements | NFR1-NFR27 for quality attributes |

### Example FR from PRD → Implementation

```
FR12: Users can create an expense linked to a specific property
  ↓
Architecture: Expenses CQRS handler + API endpoint
  ↓
Story: "Add expense creation with property selection"
  ↓
Code: CreateExpenseCommand.cs, ExpensesController.cs
```

---

## How the Architecture Was Created

**File:** `_bmad-output/planning-artifacts/architecture.md`
**Date:** November 29, 2025 (1 day after PRD)
**Workflow:** `/bmad:bmm:workflows:create-architecture`

### Process

1. **PRD as Input** - Architecture references FR/NFR numbers directly
2. **Decision-Focused** - 13 Architecture Decision Records (ADRs)
3. **Pattern Definition** - CQRS, error handling, naming conventions

### Architecture Decision Records (ADRs)

| ADR | Decision | Why It Matters for AI Agents |
|-----|----------|------------------------------|
| ADR-001 | Monorepo | Single PR for full features |
| ADR-002 | Account-based multi-tenancy | `AccountId` on all tables |
| ADR-007 | Manual verification layer | "Trust but verify" - Postman + smoke tests |
| ADR-008 | Global exception middleware | Controllers stay thin |

### FR → Architecture Traceability

```
PRD Category              Backend Module      Database Tables
─────────────────────────────────────────────────────────────
Expense Management        Expenses/           Expenses,
(FR12-22)                 Application layer   ExpenseCategories
```

---

## Context Flow: How Documents Chain Together

```
┌─────────────────────────────────────────────────────────────┐
│  PRD (Planning Phase)                                       │
│  - 57 Functional Requirements                               │
│  - 27 Non-Functional Requirements                           │
│  - User personas, success criteria                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ feeds into
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Architecture (Solutioning Phase)                           │
│  - Maps FR categories to backend modules                    │
│  - Defines API contracts, database schema                   │
│  - Records decisions as ADRs                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ feeds into
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Epics & Stories (Solutioning Phase)                        │
│  - Breaks FRs into implementable units                      │
│  - Each story references specific FRs                       │
│  - Tasks/subtasks for dev agent to execute                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ feeds into
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Implementation (Sprint Execution)                          │
│  - Dev agent reads story file as single source of truth     │
│  - Red-green-refactor: failing test → implement → pass      │
│  - Code review validates against AC                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Matters for Agentic Coding

### The Problem BMAD Solves

Without structured artifacts, AI agents:
- Hallucinate requirements
- Make inconsistent architecture decisions
- Lose context between sessions

### How BMAD Fixes It

1. **PRD is the contract** - AI can't add features not in requirements
2. **Architecture is the rulebook** - Patterns are documented, not guessed
3. **Stories are atomic** - One story = one PR = focused context
4. **Traceability** - Every line of code traces back to an FR number

### Real Example: Global Exception Handling

```
PRD: NFR23 "Graceful error handling with user-friendly messages"
  ↓
Architecture: ADR-008 "Global middleware, RFC 7807 Problem Details"
  ↓
Code: GlobalExceptionHandlerMiddleware.cs
  ↓
Dev Memory: "Controllers do NOT need try-catch blocks"
```

The AI agent doesn't guess the pattern - it follows the documented decision.

---

## Key Takeaway

**BMAD turns "vibe-based" AI coding into traceable, reviewable engineering.**

The planning artifacts aren't bureaucracy - they're **context that prevents expensive mistakes** and **guardrails that keep AI agents aligned** with what you actually want to build.

---

*Created for Dave's agentic coding presentation*
*Source: [BMAD Method Docs](https://docs.bmad-method.org/reference/workflow-map/)*
