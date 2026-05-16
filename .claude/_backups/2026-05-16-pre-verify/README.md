## Pre-verify snapshot — 2026-05-16

Snapshot of `CLAUDE.md` and `.claude/commands/orchestrate.md` taken right before change #1:

- Adding "Verification Before Completion" iron-law section to CLAUDE.md
- Hardening orchestrator Phase Validation gates (Develop + Evaluate) to re-run verification commands instead of trusting subagent self-reports
- Adding the same principle to the orchestrator Rules section

Restore with `/rollback 2026-05-16-pre-verify` to undo only change #1 (leaves earlier snapshots and the `/rollback` skill intact).
