## Pre-two-stage-review snapshot — 2026-05-16

Snapshot of `CLAUDE.md` and `.claude/commands/dev-story.md` taken right before change #3:

- Adding the Two-Stage Review Protocol inside `/dev-story` (spec-compliance subagent → code-quality subagent, per task, with skip rule for trivial tasks and a 2-iteration cap per stage)
- Updating Step 4's task loop to invoke the protocol before marking a task complete
- Adding a "Review Log" requirement to the Dev Agent Record and to the Validation Gates

Includes the change #1 + #2 state (CLAUDE.md verification iron law, hardened orchestrator gates, `/spike` skill, `/rollback` skill).

Restore with `/rollback 2026-05-16-pre-twostage` to undo only change #3 (leaves changes #1 and #2 in place).
