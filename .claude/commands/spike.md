---
description: "Run a focused throwaway experiment to validate or invalidate an idea before committing to a real story"
---

# Spike

## Context

A spike is a focused experiment to answer ONE question before committing to real implementation. Use it when you don't know if an approach will work — feasibility, performance, library choice, integration concerns, or design uncertainty.

Spikes live entirely under `docs/project/spikes/NNN-<kebab>/`. Spike code NEVER touches `backend/src/` or `frontend/src/`. If a spike leaks into the main tree, it stops being a spike and becomes regret. When the spike answers its question, write a verdict, then either kill it or graduate it to a real story (via `/create-story` referencing the spike folder).

No tests required, no PR, no ceremony. Speed and disposability over polish.

## When to use vs. `/create-story`

- **Use `/spike`** when the question is: *will this work?* / *which approach is better?* / *is this fast enough?* / *can the library actually do X?*
- **Use `/create-story`** when the question is: *how should we build the thing we've already decided on?*

If you find yourself spiking the same idea twice, the second one should probably be a story instead.

## Inputs

User provides a short idea description, e.g.:
- "can we use SignalR for the maintenance-request inbox instead of polling?"
- "would Postgres LISTEN/NOTIFY work for the notification fan-out?"
- "is the .NET 10 OpenTelemetry OTLP exporter stable enough to replace our custom logging middleware?"

If the user runs `/spike` with no argument, ask them what they want to spike (one question, then proceed).

## Process

### Step 1: Frame the question

Before creating any files, lock down all five:

- **Question:** the single thing this spike answers (one sentence)
- **Hypothesis:** your current best guess at the answer
- **Falsifier:** what evidence would prove the hypothesis wrong
- **Timebox:** how long you're willing to spend before declaring `partial` or `invalidated` (in hours, not days — spikes are not stories)
- **Out of scope:** what this spike will deliberately NOT answer

If any of these are unclear, ask the user — one question at a time. Don't proceed without all five. A spike without a falsifier is wishful thinking with a directory.

### Step 2: Create the spike directory

Find the next spike number:

```bash
ls -d docs/project/spikes/[0-9][0-9][0-9]-* 2>/dev/null | sort | tail -1
```

If none exist, start at `001`. Otherwise increment by 1 and zero-pad to 3 digits.

Create the structure:

```
docs/project/spikes/NNN-<kebab-slug>/
├── README.md      — question, hypothesis, falsifier, timebox, scope
├── notes.md       — running log (timestamped entries during exploration)
├── code/          — throwaway implementation
└── VERDICT.md     — written at the end (Step 5)
```

### Step 3: Write the README

Template:

```markdown
# Spike NNN: <short title>

**Status:** in-progress
**Started:** <ISO date>
**Timebox:** <hours>

## Question

<the single question this spike answers>

## Hypothesis

<your current best guess>

## Falsifier

<what evidence would prove the hypothesis wrong>

## Out of scope

- <thing 1>
- <thing 2>

## Related

- <links to docs, prior spikes, issues, PRs that motivated this>
```

Initialize `notes.md` with a header and the first timestamp. Create an empty `code/` directory.

Commit the scaffolding before exploring. Message: `spike(NNN): <title> — start`.

### Step 4: Explore

Build the smallest possible thing that answers the question. Keep everything under `code/`. Examples:

- A 50-line minimal API endpoint demonstrating the pattern
- A standalone .NET console app exercising a library
- An Angular standalone component proving an interaction works
- A SQL script benchmarking a query approach

**Append to `notes.md` as you go**, with timestamps. Capture: what you tried, what happened, error messages verbatim, unexpected behaviors, benchmark numbers. This is the institutional memory — the verdict will reference it.

**Rules for the exploration:**
- Code is allowed to be ugly. Tests are not required. No linting.
- Do NOT touch `backend/src/`, `frontend/src/`, or any production code. If you find yourself needing to, stop and ask the user — that's a sign the spike isn't isolated enough.
- Do NOT add dependencies to the main project's `package.json` or `.csproj`. Spike-specific deps go in `code/` with their own manifest (e.g., a separate `.csproj` or `package.json` under `code/`).
- If you hit the timebox without an answer, that's a `partial` verdict — don't keep going to "finish."

### Step 5: Verdict

When you have an answer (or hit the timebox), write `VERDICT.md`:

```markdown
# Verdict: <validated | invalidated | partial>

**Closed:** <ISO date>
**Time spent:** <hours>

## Answer

<one sentence answering the original question>

## Evidence

<bullet list of concrete observations from the spike, citing notes.md
 entries or code/ files. Reference exit codes, benchmark numbers, error
 messages, screenshots — not impressions.>

## What we learned

<one paragraph: the durable insight worth keeping even if we don't
 graduate this spike. What surprised you? What did the docs get wrong?
 What does future-you need to know?>

## Recommendation

- **If validated:** what would the real story look like? Which epic does
  it belong to? Any constraints discovered during the spike that the
  story must respect.
- **If invalidated:** which alternative should we try next, or is the
  underlying need still real?
- **If partial:** what would close it out? Is it worth another spike or
  should we decide based on what we have?
```

Update the README: change `Status: in-progress` to `Status: validated | invalidated | partial`.

Commit with message: `spike(NNN): <title> — <verdict>`.

### Step 6: Decide the next move

Present to the user:

- **Graduate** — invoke `/create-story` with this spike as input. The story should reference `docs/project/spikes/NNN-<slug>/` in Dev Notes so the implementer can read the evidence.
- **Kill** — leave the spike folder in place as documentation. Do NOT delete; future-you will appreciate the institutional memory.
- **Continue** — if `partial`, schedule a follow-up spike with a tighter question.

Do not auto-graduate. The verdict is the user's decision, not the spike's.

## Rules

- Spike code lives ONLY under `docs/project/spikes/NNN/code/`. Never `backend/src/` or `frontend/src/`.
- No new dependencies added to the main project from a spike — spike-specific deps stay in `code/`.
- Spikes have verdicts. A spike without a `VERDICT.md` is unfinished, even if the code "works."
- Spikes are kept after they finish. They're institutional memory, not garbage. `Status: invalidated` is just as valuable as `Status: validated` — it tells future-you not to repeat the experiment.
- If you find yourself spiking for >1 day of wall-clock time, the question was too broad. Stop, narrow it, start a new spike.
- `/spike` never opens a PR. Spikes are exploration; PRs come from stories.
- `/spike` never modifies `docs/project/sprint-status.yaml`. Sprint status tracks stories, not experiments.

## Validation Gates

Before declaring the spike complete:
- [ ] `README.md` has Question, Hypothesis, Falsifier, Timebox, and Out-of-scope filled in
- [ ] `notes.md` has at least one timestamped entry
- [ ] `VERDICT.md` exists with verdict + evidence + recommendation
- [ ] No changes to `backend/src/` or `frontend/src/` (`git diff --stat backend/src frontend/src` shows nothing)
- [ ] No additions to root `package.json` or top-level `.csproj` files
- [ ] Spike status is one of: `validated`, `invalidated`, `partial`
