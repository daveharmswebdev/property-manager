---
description: "View sprint progress, surface risks, and identify next actions"
---

# Sprint Status

## Context

Summarize the current sprint status, surface risks or blockers, and recommend what to do next.

## Process

### Step 1: Load sprint status

Read `docs/project/sprint-status.yaml` completely. Parse all development_status entries.

### Step 2: Summarize progress

Group stories by status and present:
- **Done**: completed stories
- **In Progress**: stories currently being worked on
- **Review**: stories awaiting code review
- **Ready for Dev**: stories ready to implement
- **Backlog**: stories not yet created

Show counts per epic and overall progress percentage.

### Step 3: Surface risks

Identify:
- Stories stuck in "in-progress" for an extended time
- Epics with many remaining stories
- Any status inconsistencies (e.g., epic marked done but stories still open)

### Step 4: Recommend next action

Based on current state, suggest the most useful next step:
- If stories are in "review" → suggest `/code-review`
- If stories are "ready-for-dev" → suggest `/dev-story`
- If only "backlog" stories remain → suggest `/create-story`
- If an epic is complete → suggest `/retrospective`
