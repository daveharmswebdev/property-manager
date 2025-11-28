# GitHub Secrets Setup for Render Deployment

This document outlines the GitHub secrets needed to enable automatic database migrations via GitHub Actions when deploying to Render.

## Required GitHub Secrets

To enable Flyway migrations in your CI/CD pipeline, add the following secrets to your GitHub repository:

### 1. Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/upkeep-io`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### 2. Add Database Credentials

Add the following three secrets with your Render PostgreSQL connection information:

#### RENDER_DATABASE_URL
```
jdbc:postgresql://dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com:5432/upkeep_db_c52g
```
**Note:** This is the JDBC URL format required by Flyway. It differs from the standard PostgreSQL URL.

#### RENDER_DATABASE_USER
```
upkeep_user
```

#### RENDER_DATABASE_PASSWORD
```
NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq
```

## Updating GitHub Actions Workflow

Your `.github/workflows/deploy.yml` file should be updated to use these secrets for Flyway migrations:

```yaml
migrate:
  name: Run Database Migrations
  runs-on: ubuntu-latest
  needs: [test]

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Flyway
      uses: joshuaavalon/flyway-action@v3.0.0
      with:
        url: ${{ secrets.RENDER_DATABASE_URL }}
        user: ${{ secrets.RENDER_DATABASE_USER }}
        password: ${{ secrets.RENDER_DATABASE_PASSWORD }}
        locations: filesystem:./migrations

    - name: Run Flyway migrations
      run: flyway migrate
```

## Verification

After adding the secrets and updating the workflow:

1. **Push to main branch** to trigger the GitHub Actions workflow
2. **Check Actions tab** to verify the migration step succeeds
3. **Verify database** using Flyway CLI:
   ```bash
   flyway info -configFiles=flyway.conf
   ```

## Current Migration Status

As of 2025-11-22, all 4 migrations have been successfully applied to Render PostgreSQL:

| Version | Description            | Status  | Applied On          |
|---------|------------------------|---------|---------------------|
| 1       | init                   | Success | 2025-11-22 13:53:47 |
| 2       | add tenant person pet  | Success | 2025-11-22 13:55:55 |
| 3       | drop tenant pet tables | Success | 2025-11-22 13:55:57 |
| 4       | split address field    | Success | 2025-11-22 13:55:57 |

**Schema Version:** v4

## Database Connection Information

### For Local Development

Use the **internal database URL** in your `.env` file:

```bash
DATABASE_URL="postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a/upkeep_db_c52g"
```

### For Render Services

Render services use the **internal database URL** automatically when you link the database to your service via the Render dashboard.

### For External Connections

Use the **external database URL** for connections from outside Render:

```bash
postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com/upkeep_db_c52g
```

## Important Notes

1. **flyway.conf is gitignored** - The local `flyway.conf` file contains sensitive credentials and is excluded from version control
2. **JDBC URL Format** - Flyway requires `jdbc:postgresql://` prefix, not just `postgresql://`
3. **Migration Order** - Flyway executes migrations in version order (V1, V2, V3, V4, etc.)
4. **Idempotency** - Once applied, migrations are never re-run. Flyway tracks applied migrations in `flyway_schema_history` table

## Troubleshooting

### Migration Fails in CI/CD

1. **Check secrets are set correctly** in GitHub repository settings
2. **Verify JDBC URL format** starts with `jdbc:postgresql://`
3. **Check migration file syntax** - Flyway validates SQL before execution
4. **Review GitHub Actions logs** for detailed error messages

### Type Mismatch Errors

If you encounter errors like "incompatible types: text and uuid":

1. **Check migration consistency** - All ID columns should use UUID type
2. **Verify V1 migration** created tables with UUID columns
3. **Ensure subsequent migrations** use UUID for foreign key references

### Testing Locally

Before pushing to GitHub, test migrations locally:

```bash
# Test migration (dry run)
flyway validate -configFiles=flyway.conf

# Apply migrations
flyway migrate -configFiles=flyway.conf

# Check status
flyway info -configFiles=flyway.conf

# Rollback if needed (Flyway Teams edition only)
# For OSS edition, manually write and run rollback SQL
```

## Next Steps

After setting up GitHub secrets:

1. ✅ Database migrations are automated via GitHub Actions
2. ⏭️ Deploy backend web service to Render
3. ⏭️ Deploy frontend static site to Render
4. ⏭️ Configure environment variables for backend service
5. ⏭️ Test API endpoints and database connectivity

---

**Last Updated:** 2025-11-22
**Database Provider:** Render PostgreSQL
**Schema Version:** v4
**Total Migrations:** 4
