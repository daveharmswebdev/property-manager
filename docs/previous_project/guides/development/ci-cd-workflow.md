# Local CI/CD Testing with act

This guide explains how to test GitHub Actions workflows locally before pushing to GitHub, using the `nektos/act` tool.

## Overview

The project uses GitHub Actions for continuous integration and deployment. The workflow is defined in `.github/workflows/deploy.yml` and includes:

1. **Backend Unit Tests** - Run backend test suite
2. **Frontend E2E Tests** - Run Playwright end-to-end tests
3. **Database Migrations** - Run Flyway migrations (Railway only)
4. **Backend Deployment** - Deploy backend to Railway (Railway only)
5. **Frontend Deployment** - Deploy frontend to Railway (Railway only)

Railway deployment jobs are **gated** with `if: github.actor != 'nektos/act'` to prevent execution during local testing.

## Prerequisites

- **Docker** - act uses Docker to simulate GitHub Actions runners
- **act CLI** - Installed via Homebrew (macOS) or other package managers

### Installation

The `act` tool is already installed via Homebrew:

```bash
brew install act
```

Verify installation:

```bash
act --version
```

## Configuration

The `.actrc` file in the project root configures act behavior:

```bash
# Use medium-sized runner image (~500MB)
-P ubuntu-latest=catthehacker/ubuntu:act-latest

# Enable offline mode for faster runs
--action-offline-mode

# Fix M-series chip compatibility (Apple Silicon)
--container-architecture linux/amd64
```

## Usage

### Basic Commands

**Run all jobs (Railway jobs automatically skipped):**
```bash
act
```

**List all available jobs:**
```bash
act --list
```

**Run specific job:**
```bash
act --job test           # Run backend tests only
act --job test-e2e       # Run E2E tests only
```

**Run on specific event:**
```bash
act push                 # Trigger push event (default)
act pull_request         # Trigger pull request event
```

### Advanced Options

**Dry run (show what would run without executing):**
```bash
act --dryrun
```

**Verbose output for debugging:**
```bash
act --verbose
```

**Watch mode (auto-rerun on workflow changes):**
```bash
act --watch
```

**Specify workflow file:**
```bash
act --workflows .github/workflows/deploy.yml
```

## Workflow Execution Flow

### Local Testing (with act)

```
1. act command executed
2. Docker pulls runner image (first time only)
3. Backend tests run (test job)
4. E2E tests run (test-e2e job) - in parallel with backend tests
5. Railway jobs SKIPPED (migrate, deploy-backend, deploy-frontend)
6. Results displayed in terminal
```

### GitHub Actions (on push to main)

```
1. Push to main branch triggers workflow
2. Backend tests run (test job)
3. E2E tests run (test-e2e job) - in parallel with backend tests
4. Database migrations run (migrate job) - ONLY if Railway secrets configured
5. Backend deployment (deploy-backend job) - ONLY if Railway secrets configured
6. Frontend deployment (deploy-frontend job) - ONLY if Railway secrets configured
```

## Testing Strategy

### Development Workflow

1. **Make code changes**
2. **Test locally with act:**
   ```bash
   act --job test        # Quick backend test validation
   act --job test-e2e    # Quick E2E test validation
   act                   # Run full test suite
   ```
3. **Fix any failing tests**
4. **Commit and push to GitHub** (triggers actual CI/CD)

### Benefits of Local Testing

✅ **Zero GitHub runner costs** during development
✅ **Faster iteration** - No waiting for GitHub runner queue (2-5 minutes saved)
✅ **No polluted commit history** - Avoid "fix CI" commits
✅ **Offline capable** - Works without internet after initial image pull
✅ **Instant feedback** - See test results immediately

## Troubleshooting

### Docker Not Running

**Error:** `Cannot connect to the Docker daemon`

**Solution:**
```bash
# Start Docker Desktop (macOS)
open -a Docker
```

### Runner Image Download Slow

**First-time use only:** The medium runner image (~500MB) downloads once and is cached.

**Speed up subsequent runs:**
- `.actrc` already configured with `--action-offline-mode`
- Images cached in Docker

### Tests Failing Locally But Pass on GitHub

**Possible causes:**
- Different Node.js version (workflow uses Node 18)
- Missing dependencies (run `npm ci` to ensure clean install)
- Environment variables not set

**Debug with verbose mode:**
```bash
act --verbose --job test
```

### Railway Jobs Running Locally

**Error:** Railway jobs execute when they shouldn't

**Solution:** Verify workflow file uses correct conditional:
```yaml
if: github.actor != 'nektos/act'
```

Verify Railway jobs are skipped with:
```bash
act --dryrun  # Railway jobs should not appear in output
```

## Managing Secrets (Future)

When you need to test workflows requiring secrets (not needed yet for test-only pipeline):

### Option 1: Environment File

Create `.secrets` file (gitignored):
```bash
DATABASE_URL=postgresql://localhost:5432/upkeep
JWT_SECRET=local-test-secret
```

Run with secrets:
```bash
act --secret-file .secrets
```

### Option 2: Inline Secrets

```bash
act --secret DATABASE_URL=postgresql://localhost:5432/upkeep
```

### Option 3: Interactive Prompt

```bash
act --secret GITHUB_TOKEN  # Prompts for value
```

## Workflow Modification Guidelines

When modifying `.github/workflows/deploy.yml`:

1. **Test locally first:**
   ```bash
   act --dryrun  # Validate syntax
   act           # Run full workflow
   ```

2. **Keep Railway jobs gated:**
   - Always use `if: ${{ !env.ACT }}` for deployment jobs
   - Prevents accidental Railway deployments during local testing

3. **Add new test jobs:**
   - No gating needed for test-only jobs
   - Will run both locally and on GitHub

4. **Update job dependencies:**
   - Use `needs: [test, test-e2e]` to wait for all tests
   - Parallel jobs improve CI/CD speed

## References

- [act GitHub Repository](https://github.com/nektos/act)
- [act Documentation](https://nektosact.com)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Railway Documentation](https://docs.railway.app)

## Next Steps

When ready to deploy to Railway:

1. Create Railway account
2. Set up Railway project with PostgreSQL database
3. Configure Railway secrets in GitHub repository settings:
   - `RAILWAY_TOKEN`
   - `RAILWAY_DATABASE_URL`
   - `RAILWAY_DATABASE_USER`
   - `RAILWAY_DATABASE_PASSWORD`
4. Push to main branch - deployment jobs will execute on GitHub Actions
5. Railway jobs will still be skipped when testing locally with act
