# Render Deployment Guide

This document contains hard-won lessons from setting up CI/CD with Render.com. These are the issues that required the most iteration and debugging.

## Table of Contents
- [GitHub Environment Secrets Configuration](#github-environment-secrets-configuration)
- [Database URL Format (Critical!)](#database-url-format-critical)
- [Flyway Migration Configuration](#flyway-migration-configuration)
- [Common Errors and Solutions](#common-errors-and-solutions)
- [Deployment Workflow](#deployment-workflow)

---

## GitHub Environment Secrets Configuration

### Critical: Use Environment Secrets, NOT Repository Secrets

**Problem:** When using `environment: production` in GitHub Actions, secrets must be stored in **Environment Secrets**, not Repository Secrets.

**Correct Setup:**

1. Go to: **Repository Settings → Environments**
2. Create/select environment: `production`
3. Under **Environment protection rules**:
   - ✅ Enable "Required reviewers"
   - ✅ Add yourself as a reviewer
4. Under **Environment secrets** (NOT Repository secrets), add:

| Secret Name | Value |
|------------|-------|
| `RENDER_DATABASE_URL` | See [Database URL Format](#database-url-format-critical) below |
| `RENDER_DATABASE_USER` | `upkeep_user` |
| `RENDER_DATABASE_PASSWORD` | Your database password |

**Why this matters:** GitHub Actions only looks for secrets in the environment context when `environment: production` is specified. Repository secrets won't be found.

---

## Database URL Format (Critical!)

### ❌ WRONG: PostgreSQL URL Format (from Render dashboard)

Render provides this format in the dashboard:
```
postgresql://upkeep_user:PASSWORD@dpg-xxx.ohio-postgres.render.com/upkeep_db
```

**This will NOT work with Flyway!** You'll get:
```
ERROR: No database found to handle ***
```

### ✅ CORRECT: JDBC URL Format (for Flyway)

Convert the Render URL to JDBC format:

**Template:**
```
jdbc:postgresql://HOST:5432/DATABASE
```

**Actual Example:**
```
jdbc:postgresql://dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com:5432/upkeep_db_c52g
```

**Key differences:**
1. Protocol: `jdbc:postgresql://` instead of `postgresql://`
2. Port: Explicitly add `:5432`
3. Credentials: Remove `username:password@` from URL (passed separately)
4. Host only: Just the hostname and database name

**How to convert your Render URL:**

Given Render's external connection string:
```
postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com/upkeep_db_c52g
```

Extract the parts:
- **Username:** `upkeep_user`
- **Password:** `NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq`
- **Host:** `dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com`
- **Database:** `upkeep_db_c52g`

Create the JDBC URL:
```
jdbc:postgresql://dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com:5432/upkeep_db_c52g
```

---

## Flyway Migration Configuration

### baselineOnMigrate: Required for Existing Databases

**Problem:** If your database already has tables (from manual migrations or `prisma db push`), Flyway will error:

```
ERROR: Found non-empty schema(s) "public" but no schema history table.
Use baseline() or set baselineOnMigrate to true to initialize the schema history table.
```

**Solution:** Add `-baselineOnMigrate=true` to the Flyway command:

```yaml
- name: Run Flyway migrations
  run: |
    flyway migrate \
      -url="${{ secrets.RENDER_DATABASE_URL }}" \
      -user="${{ secrets.RENDER_DATABASE_USER }}" \
      -password="${{ secrets.RENDER_DATABASE_PASSWORD }}" \
      -locations="filesystem:./apps/backend/migrations" \
      -baselineOnMigrate=true
```

**What this does:**
- Creates `flyway_schema_history` tracking table
- Marks existing migrations as already applied
- Only runs new migrations going forward

### Migration File Location

Migrations must be in: `apps/backend/migrations/`

Example structure:
```
apps/backend/migrations/
├── V1__init.sql
├── V2__add_leases.sql
└── V3__add_vendors.sql
```

---

## Common Errors and Solutions

### Error: "No database found to handle ***"

**Cause:** Wrong database URL format (using PostgreSQL URL instead of JDBC URL)

**Solution:** Convert to JDBC format (see [Database URL Format](#database-url-format-critical))

### Error: "Context access might be invalid: RENDER_DATABASE_URL"

**Cause:** Secrets are in Repository Secrets, not Environment Secrets

**Solution:** Move secrets to Environment Secrets under `production` environment

### Error: "Found non-empty schema(s) but no schema history table"

**Cause:** Database already has tables, but Flyway has no tracking table

**Solution:** Add `-baselineOnMigrate=true` to Flyway command

### Error: "schema drift between local and production"

**Cause:** Used `prisma db push` instead of `prisma migrate dev`

**Solution:**
1. Never use `prisma db push` for production schemas
2. Always use `prisma migrate dev` to create migration files
3. Copy Prisma SQL to Flyway migration files

---

## Deployment Workflow

### Complete CI/CD Flow

```mermaid
graph TD
    A[Push to main] --> B[Run Tests]
    B --> C{Tests Pass?}
    C -->|No| D[Fail - Fix Tests]
    C -->|Yes| E[Wait for Approval]
    E --> F[Approve Migration]
    F --> G[Run Flyway Migrations]
    G --> H{Migration Success?}
    H -->|No| I[Fail - Fix Migration]
    H -->|Yes| J[Render Auto-Deploys]
    J --> K[Backend Deployed]
    J --> L[Frontend Deployed]
```

### Step-by-Step Process

1. **Developer pushes to `main`**
   ```bash
   git push origin main
   ```

2. **GitHub Actions runs tests**
   - Backend unit tests must pass
   - E2E tests (currently disabled)

3. **Workflow pauses for approval**
   - You receive notification
   - Review migration files
   - Click "Review deployments" → "Approve and deploy"

4. **Flyway runs migrations**
   - Connects using JDBC URL
   - Applies new migrations only
   - Updates `flyway_schema_history` table

5. **Render auto-deploys**
   - Detects push to `main` branch
   - Rebuilds and deploys backend
   - Rebuilds and deploys frontend
   - Zero-downtime deployment

### Database Connection Notes

**Backend Service (on Render):**
- Uses **internal** database URL for performance
- Format: `postgresql://user:pass@dpg-xxx/database` (no `.ohio-postgres.render.com`)
- Set in Render dashboard environment variables

**GitHub Actions (Flyway):**
- Uses **external** JDBC URL
- Format: `jdbc:postgresql://dpg-xxx.ohio-postgres.render.com:5432/database`
- Set in GitHub environment secrets

**Local Development:**
- Uses local PostgreSQL
- Format: `postgresql://postgres:postgres@localhost:5432/upkeep_dev`
- Set in `.env` file (not committed)

---

## Troubleshooting Checklist

Before running migrations, verify:

- [ ] GitHub environment `production` exists
- [ ] Environment secrets are configured (NOT repository secrets)
- [ ] `RENDER_DATABASE_URL` uses JDBC format with `:5432` port
- [ ] `RENDER_DATABASE_URL` does NOT include username/password
- [ ] Migration files exist in `apps/backend/migrations/`
- [ ] Migration files follow naming: `V1__description.sql`
- [ ] Flyway command includes `-baselineOnMigrate=true`
- [ ] Required reviewers enabled for production environment

---

## Key Lessons

1. **Never use `prisma db push` for production schemas** - Always use `prisma migrate dev`
2. **JDBC URLs are different from PostgreSQL URLs** - Flyway needs JDBC format
3. **Environment secrets ≠ Repository secrets** - Must be in the environment context
4. **Explicit port is required** - Always add `:5432` to JDBC URL
5. **baselineOnMigrate handles existing schemas** - Required if database already has tables
6. **Render provides two URLs** - Internal for services, external for CI/CD
