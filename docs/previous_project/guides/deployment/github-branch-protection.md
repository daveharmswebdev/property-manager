# GitHub Branch Protection Setup

This guide documents the branch protection configuration for the `main` branch, ensuring code quality by requiring CI tests to pass before merging.

## Current Configuration

The `main` branch has the following protection rules:

| Setting | Value | Purpose |
|---------|-------|---------|
| Required status checks | `Run Backend Tests` | CI must pass before merge |
| Strict status checks | Enabled | Branch must be up to date |
| Enforce admins | Disabled | Allows emergency bypasses |
| Required reviews | Disabled | Solo developer project |
| Force pushes | Disabled | Prevents history rewriting |
| Branch deletions | Disabled | Protects main branch |

## Why These Settings

### Required Status Checks
The `Run Backend Tests` workflow (defined in `.github/workflows/deploy.yml`) must complete successfully before any PR can be merged to `main`. This prevents broken code from reaching production.

### Strict Mode
When enabled, PRs must be rebased on the latest `main` before merging. This ensures the tests run against the actual code that will be merged, not a stale version.

### Admin Bypass
Admins can bypass protection in emergencies (e.g., critical hotfixes when CI is broken). Use sparingly and document any bypasses.

### No Required Reviews
This project has a single developer, so requiring reviews would block all merges. The primary protection is the CI requirement.

## How It Works

1. Developer creates PR to `main`
2. GitHub Actions runs `Run Backend Tests`
3. If tests fail: merge is blocked, developer must fix
4. If tests pass: merge is allowed

## Configuration via CLI

The protection was configured using the GitHub CLI:

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Run Backend Tests"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

## Configuration via GitHub UI

1. Go to **Settings** > **Branches**
2. Click **Add branch protection rule**
3. Set branch name pattern: `main`
4. Enable **Require status checks to pass before merging**
5. Enable **Require branches to be up to date before merging**
6. Search and select `Run Backend Tests`
7. Leave **Require a pull request before merging** disabled
8. Click **Create**

## Viewing Current Protection

```bash
# View all protection settings
gh api repos/{owner}/{repo}/branches/main/protection

# View just status check requirements
gh api repos/{owner}/{repo}/branches/main/protection/required_status_checks
```

## Modifying Protection

### Add Additional Status Checks

If adding E2E tests in the future:

```bash
gh api repos/{owner}/{repo}/branches/main/protection/required_status_checks \
  --method PATCH \
  --field strict=true \
  --field contexts='["Run Backend Tests", "Run E2E Tests"]'
```

### Enable Required Reviews (Multi-Developer)

If the team grows:

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Run Backend Tests"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

### Remove Protection (Emergency Only)

```bash
gh api repos/{owner}/{repo}/branches/main/protection --method DELETE
```

## Troubleshooting

### "Merge blocked: required status check missing"

The CI workflow hasn't run yet. Push commits to trigger it, or re-run the workflow from the Actions tab.

### "Merge blocked: branch is out of date"

Rebase or merge `main` into your branch:

```bash
git fetch origin
git rebase origin/main
# or
git merge origin/main
```

### Admin bypass not working

Ensure the user has admin role in repository settings. Organization-level branch protection rules may override repository rules.

## Related Documentation

- [CI/CD Workflow](../development/ci-cd-workflow.md) - Local testing with `act`
- [Render Deployment](./render-deployment.md) - Production deployment
- [GitHub Actions Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

---

*Configured November 2024 as part of Issue #58*
