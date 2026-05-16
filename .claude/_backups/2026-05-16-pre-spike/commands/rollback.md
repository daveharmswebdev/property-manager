---
description: "Roll back skill changes by restoring a snapshot from .claude/_backups/"
---

# Rollback

## Context

Restore `.claude/commands/*.md` and `CLAUDE.md` from a previously-taken snapshot in `.claude/_backups/`. Use this when an experimental skill change isn't working and you want to revert to a known-good state.

Snapshots are taken manually before risky skill edits. Each snapshot mirrors the structure: `.claude/_backups/<name>/commands/*.md` and `.claude/_backups/<name>/CLAUDE.md`.

This skill never deletes a snapshot — rollback is non-destructive to the backup itself.

## Inputs

User invokes one of:
- `/rollback` — list snapshots and ask which to restore
- `/rollback <snapshot-name>` — restore from a specific snapshot (still confirms)
- `/rollback latest` — restore from the most recently modified snapshot (still confirms)

## Process

### Step 1: Resolve snapshot

List snapshots:

```bash
ls -1t .claude/_backups/ 2>/dev/null
```

- **No argument:** present the list with modification times and ask via `AskUserQuestion` which to restore.
- **`latest`:** pick the most recently modified directory under `.claude/_backups/`.
- **Specific name:** verify `.claude/_backups/<name>/` exists. If not, error and list available snapshots.

If `.claude/_backups/` doesn't exist or is empty, stop and tell the user there are no snapshots to restore from.

### Step 2: Show what will change

Before restoring, show the user the diff between current state and the snapshot:

```bash
diff -rq .claude/commands/ .claude/_backups/<snapshot>/commands/ 2>&1
diff -q CLAUDE.md .claude/_backups/<snapshot>/CLAUDE.md 2>&1
```

Report counts: N files modified, M added, P removed (relative to current state being replaced with the snapshot).

### Step 3: Confirm

`AskUserQuestion`: "Restore from `<snapshot>`? This will overwrite current skills."

Options:
- **Yes, restore**
- **No, cancel**
- **Show full diff first**

If "Show full diff first": run `diff -ru .claude/commands/ .claude/_backups/<snapshot>/commands/` and `diff -u CLAUDE.md .claude/_backups/<snapshot>/CLAUDE.md`, then ask again.

### Step 4: Check for in-flight orchestrator state

```bash
test -f docs/project/.orchestrator-state.yaml && echo "state-exists"
```

If a state file exists, warn:

> In-flight orchestrator state detected. Rolling back skills may leave it referencing phase shapes that no longer exist. Delete the state file as part of rollback?

Options:
- **Delete state**
- **Keep state (I'll handle it)**

### Step 5: Restore

```bash
# Wipe current commands, copy from snapshot
rm -f .claude/commands/*.md
cp .claude/_backups/<snapshot>/commands/*.md .claude/commands/
cp .claude/_backups/<snapshot>/CLAUDE.md CLAUDE.md
```

If the user opted to delete orchestrator state:

```bash
rm -f docs/project/.orchestrator-state.yaml
```

### Step 6: Show result and offer commit

Run `git status` and `git diff --stat` so the user sees exactly what changed.

`AskUserQuestion`: "Commit the rollback?"

Options:
- **Yes, commit**
- **No, I'll review and commit manually**

If yes:

```bash
git add .claude/commands/ CLAUDE.md docs/project/.orchestrator-state.yaml 2>/dev/null
git commit -m "chore: rollback skills to <snapshot>"
```

### Step 7: Report

Tell the user:
- Snapshot restored: `<name>`
- Files changed: `<count>`
- Whether the rollback was committed
- Suggested next step: clear context (`/clear`) so the rolled-back skills are the ones loaded for the next turn

## Rules

- Always show the diff before restoring — no silent overwrites
- Always confirm before restoring — no destructive default
- Never touch `docs/project/stories/`, `docs/project/sprint-status.yaml`, or `docs/project/spikes/` — those are data, not skill code
- Never delete the snapshot itself
- If the user is mid-workflow (orchestrator state exists), surface that before restoring
