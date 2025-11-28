# Render Deployment Plan

**Document Version**: 2.0
**Last Updated**: 2025-11-22
**Status**: In Progress - Database Complete
**Estimated Timeline**: 2-4 hours active work + 24 hours monitoring

---

## Executive Summary

This document outlines the deployment plan for the Upkeep.io property management system on Render.

**Note:** This is a fresh deployment to Render, not a migration from Railway.

### Render Service Architecture

| Service | Type | Estimated Cost | Specs |
|---------|------|----------------|-------|
| **Express Backend** | Web Service | $25/month | Standard: 2GB RAM, 1 CPU |
| **Vue Frontend** | Static Site | **$0/month** | Free tier with unlimited bandwidth |
| **PostgreSQL** | Database | $7-19/month | Starter or Basic plan |
| **Background Worker** | Background Worker | $25/month | Standard: 2GB RAM, 1 CPU |
| **TOTAL** | — | **$57-69/month** | Fixed pricing |

### Key Benefits of Render

✅ **Predictable monthly costs** - No surprise bills, fixed tier pricing
✅ **Free static site hosting** - $0/month for Vue frontend
✅ **Native background worker support** - First-class service type
✅ **Superior database features** - Point-in-time recovery, automatic backups included
✅ **Simple deployment** - Git-based auto-deploy from GitHub
✅ **Production-grade defaults** - Built for reliability and stability

---

## Target Stack

### Services to Deploy

| Service | Type | Purpose | Notes |
|---------|------|---------|-------|
| **PostgreSQL** | Database | Application database | ✅ **COMPLETED** - Schema v4 |
| **Express Backend** | Web Service | Node.js/TypeScript API | Pending |
| **Vue Frontend** | Static Site | Vite-built SPA | Pending |
| **Background Worker** | Background Worker | Async processing service | Optional - deploy later |

**Note**: Redis is used in docker-compose.yml for local development only. Not needed in production.

### Database Structure

**PostgreSQL Database:** `upkeep_db_c52g`
**Current Schema Version:** v4
**Applied Migrations:**
1. V1 - Initial schema (users, properties)
2. V2 - Add persons entity
3. V3 - Drop deprecated tenant/pet tables
4. V4 - Split address field (street + address2)

**Tables:**
- `users` - User authentication
- `properties` - Rental properties
- `persons` - People associated with properties (owners, family, vendors, lessees, occupants)
- `flyway_schema_history` - Migration tracking

**Future Migrations Needed:**
- Lease entity (leases, lease_lessees, lease_occupants)
- Maintenance work entity
- Vendor/receipt/travel entities

---

## Environment Variables

### Backend (`apps/backend`)

Required environment variables for the Express API:

| Variable | Description | Example/Notes |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | From Render database (internal URL) |
| `JWT_SECRET` | Authentication secret | Generate secure random string |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `PORT` | Server port | `10000` (Render default) |
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGIN` | Allowed frontend origin | Render frontend URL |

### Frontend (`apps/frontend`)

| Variable | Description | Example/Notes |
|----------|-------------|---------------|
| `VITE_API_URL` | Backend API endpoint | `https://upkeep-api.onrender.com/api` |

---

## Deployment Steps

### ✅ Phase 1: Database Setup (COMPLETED)

**Status:** Complete - All migrations applied successfully

**What was done:**
1. ✅ Created Render PostgreSQL database (`upkeep_db_c52g`)
2. ✅ Installed Flyway CLI locally
3. ✅ Fixed migration file type compatibility (UUID vs TEXT)
4. ✅ Applied all 4 Flyway migrations
5. ✅ Verified database schema and tables

**Database Connection Info:**
- **Hostname:** dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com
- **Port:** 5432
- **Database:** upkeep_db_c52g
- **Username:** upkeep_user
- **Internal URL:** `postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a/upkeep_db_c52g`
- **External URL:** `postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com/upkeep_db_c52g`

---

### Phase 2: Backend Service Deployment

**Duration:** 1-2 hours
**Status:** Pending

#### Step 2.1: Create Express Backend Web Service

1. In Render dashboard: **New → Web Service**
2. Connect your GitHub repository
3. Configuration:
   - **Name:** `upkeep-api`
   - **Runtime:** Node
   - **Branch:** `main`
   - **Root Directory:** `apps/backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Standard ($25/month - 2GB RAM, 1 CPU)
   - **Auto-Deploy:** Yes

4. Add environment variables:
   ```
   DATABASE_URL=[Link to Render PostgreSQL - use internal URL]
   JWT_SECRET=[Generate secure random string]
   JWT_EXPIRES_IN=7d
   PORT=10000
   NODE_ENV=production
   CORS_ORIGIN=[Will add after frontend is deployed]
   ```

5. Deploy and monitor build logs

#### Step 2.2: Test Backend Deployment

Once deployed, test the API:

```bash
# Get the Render backend URL
API_URL="https://upkeep-api.onrender.com/api"

# Test health endpoint (if implemented)
curl $API_URL/health

# Test authentication
curl -X POST $API_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Test with JWT token
TOKEN="<jwt_token_from_signup>"
curl $API_URL/properties \
  -H "Authorization: Bearer $TOKEN"
```

---

### Phase 3: Frontend Deployment

**Duration:** 30-60 minutes
**Status:** Pending

#### Step 3.1: Create Static Site Service

1. In Render dashboard: **New → Static Site**
2. Connect your GitHub repository
3. Configuration:
   - **Name:** `upkeep-frontend`
   - **Branch:** `main`
   - **Root Directory:** `apps/frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
   - **Auto-Deploy:** Yes

4. Add environment variables:
   ```
   VITE_API_URL=https://upkeep-api.onrender.com/api
   ```

5. Deploy and verify build succeeds

#### Step 3.2: Update Backend CORS

After frontend deploys, update backend `CORS_ORIGIN` environment variable:

```
CORS_ORIGIN=https://upkeep-frontend.onrender.com
```

Or use a custom domain if configured.

#### Step 3.3: Test Frontend

- Visit frontend URL
- Verify assets load correctly
- Test signup/login flow
- Test property CRUD operations
- Check browser console for errors

---

### Phase 4: Background Worker (Optional)

**Duration:** 30 minutes
**Status:** Optional - Can deploy later when needed

If you have background job processing:

1. In Render dashboard: **New → Background Worker**
2. Configuration:
   - **Name:** `upkeep-worker`
   - **Runtime:** Node
   - **Root Directory:** `apps/backend` (or worker-specific directory)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/worker.js`
   - **Instance Type:** Standard ($25/month)

3. Add same environment variables as backend

---

### Phase 5: CI/CD Setup (Optional)

**Duration:** 30 minutes
**Status:** Optional - Automates migrations on deploy

Enable automatic database migrations via GitHub Actions:

1. **Add GitHub Secrets:**
   - `RENDER_DATABASE_URL`: `jdbc:postgresql://dpg-d4h12ufdiees73b8fre0-a.ohio-postgres.render.com:5432/upkeep_db_c52g`
   - `RENDER_DATABASE_USER`: `upkeep_user`
   - `RENDER_DATABASE_PASSWORD`: `NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq`

2. **Update `.github/workflows/deploy.yml`:**
   ```yaml
   migrate:
     name: Run Database Migrations
     runs-on: ubuntu-latest
     needs: [test]

     steps:
       - uses: actions/checkout@v4

       - name: Setup Flyway
         uses: joshuaavalon/flyway-action@v3.0.0
         with:
           url: ${{ secrets.RENDER_DATABASE_URL }}
           user: ${{ secrets.RENDER_DATABASE_USER }}
           password: ${{ secrets.RENDER_DATABASE_PASSWORD }}
           locations: filesystem:./migrations

       - name: Run migrations
         run: flyway migrate
   ```

3. **Test:** Push to main branch and verify migrations run in GitHub Actions

See `docs/render-github-secrets-setup.md` for detailed instructions.

---

## Render Configuration Files

### Option 1: Infrastructure as Code (render.yaml)

Create `render.yaml` in repository root for declarative configuration:

```yaml
services:
  # Express Backend API
  - type: web
    name: upkeep-api
    runtime: node
    plan: standard
    region: oregon
    buildCommand: cd apps/backend && npm install && npm run build
    startCommand: cd apps/backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        sync: false  # Managed via dashboard for security
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        fromDatabase:
          name: upkeep-db-main
          property: connectionString
      - key: CORS_ORIGIN
        fromService:
          type: web
          name: upkeep-frontend
          property: host

  # Vue Frontend Static Site
  - type: web
    name: upkeep-frontend
    runtime: static
    plan: free
    region: oregon
    buildCommand: cd apps/frontend && npm install && npm run build
    staticPublishPath: apps/frontend/dist
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: upkeep-api
          property: host
          envVarKey: VITE_API_URL
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

databases:
  - name: upkeep-db-main
    databaseName: upkeep_db_c52g
    plan: starter
    region: oregon
```

### Option 2: Dashboard Configuration

Use the Render dashboard to manually create and configure services (steps outlined above).

---

## Troubleshooting

### Issue 1: Migration Type Mismatch (UUID vs TEXT)

**Problem:**
```
ERROR: foreign key constraint "persons_user_id_fkey" cannot be implemented
Detail: Key columns "user_id" of the referencing table and "id" of the
referenced table are of incompatible types: text and uuid.
```

**Cause:**
- V1 migration created tables with `UUID` type for ID columns
- V2 migration was auto-generated by Prisma with `TEXT` type (from `@default(cuid())`)
- Foreign key constraints failed due to type mismatch

**Solution:**
1. Updated `migrations/V2__add_tenant_person_pet.sql`
2. Changed all ID columns from `TEXT` to `UUID`
3. Added `DEFAULT gen_random_uuid()` for auto-generated UUIDs

**Example Fix:**
```sql
-- BEFORE (broken)
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    ...
);

-- AFTER (fixed)
CREATE TABLE "persons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    ...
);
```

**Prevention:**
- Ensure Prisma schema uses `@id @default(uuid())` (NOT `@default(cuid())`)
- Verify all Flyway migration files use consistent UUID types
- Test migrations against fresh database before production deployment

### Issue 2: Flyway Fails to Connect

**Problem:**
```
ERROR: Connection refused to database
```

**Solution:**
- Verify JDBC URL format: `jdbc:postgresql://host:port/dbname` (not `postgresql://`)
- Check database hostname is correct (internal vs external URL)
- Ensure database user/password are correct
- Verify database is running and accessible

### Issue 3: Build Failures on Render

**Problem:** Backend fails to build with module errors

**Common Causes:**
1. **Missing dependencies** - Run `npm install` in build command
2. **TypeScript errors** - Fix type errors before deploying
3. **Root directory misconfigured** - Ensure `apps/backend` is set correctly
4. **Node version mismatch** - Add `.nvmrc` or specify in Render settings

**Solution:**
```yaml
# In render.yaml or dashboard settings
buildCommand: cd apps/backend && npm install && npm run build
startCommand: cd apps/backend && npm start
```

### Issue 4: CORS Errors in Frontend

**Problem:** API requests blocked by CORS policy

**Solution:**
1. Update backend `CORS_ORIGIN` environment variable
2. Include frontend Render URL: `https://upkeep-frontend.onrender.com`
3. Or use wildcard for development: `*` (NOT recommended for production)
4. Redeploy backend after updating CORS settings

---

## Post-Deployment Verification

### Database Health

```bash
# Check migration status
flyway info -configFiles=flyway.conf

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Check table structure
psql $DATABASE_URL -c "\d+ users"
psql $DATABASE_URL -c "\d+ properties"
psql $DATABASE_URL -c "\d+ persons"
```

### Backend Health

```bash
# Test API endpoint
curl https://upkeep-api.onrender.com/api/health

# Create test user
curl -X POST https://upkeep-api.onrender.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'
```

### Frontend Health

1. Visit frontend URL in browser
2. Open browser DevTools → Console
3. Verify no errors
4. Test user signup/login
5. Test property creation

---

## Monitoring & Maintenance

### Render Dashboard

Monitor the following metrics:

- **Service Health:** All services running without restarts
- **Response Times:** API latency within acceptable range
- **Error Rates:** No spike in 4xx/5xx errors
- **Build History:** Deployments succeeding consistently
- **Database Metrics:** Query times, connection count

### Cost Monitoring

Current monthly costs:
- PostgreSQL Starter: $7/month
- Backend (Standard): $25/month
- Frontend (Free): $0/month
- **Total: $32/month**

With background worker:
- Worker (Standard): +$25/month
- **Total: $57/month**

### Log Management

- Render provides 7 days of logs on all paid plans
- Consider external log aggregation for longer retention:
  - Papertrail
  - Logtail
  - Datadog
  - New Relic

---

## Future Enhancements

### 1. Custom Domain Setup

1. Add custom domain in Render dashboard
2. Update DNS CNAME records
3. Render auto-provisions SSL certificate
4. Update `CORS_ORIGIN` environment variable

### 2. Preview Environments

Enable preview deployments for pull requests:

1. In Render service settings → **Pull Request Previews**
2. Enable for frontend and backend
3. Each PR gets temporary environment for testing

### 3. Database Scaling

Monitor database performance and upgrade plan if needed:

- **Starter ($7/month):** 1GB storage, 0.5 CPU
- **Basic ($19/month):** 5GB storage, 1 CPU
- **Pro ($90/month):** 50GB storage, 2 CPU, read replicas

### 4. Additional Migrations

Create migrations for remaining entities:

- Lease system (leases, lease_lessees, lease_occupants)
- Maintenance work tracking
- Vendor/receipt/travel entities
- Recurring service scheduling

---

## Deployment Progress

### ✅ Completed

**Phase 1: Database Setup (2025-11-22)**
- ✅ Created Render PostgreSQL database
- ✅ Installed Flyway CLI (v11.17.1)
- ✅ Created flyway.conf configuration
- ✅ Fixed V2 migration type mismatch (TEXT → UUID)
- ✅ Applied all 4 migrations successfully
- ✅ Verified database schema (users, properties, persons tables)
- ✅ Created `docs/render-github-secrets-setup.md`
- ✅ Updated `.gitignore` to exclude flyway.conf

**Database Status:**
- Schema Version: v4
- Tables: users, properties, persons, flyway_schema_history
- All foreign key constraints working correctly
- UUID types consistent across all tables

### ⏭️ Pending

**Phase 2: Backend Deployment**
- [ ] Create Express API web service on Render
- [ ] Configure environment variables
- [ ] Deploy backend
- [ ] Test API endpoints

**Phase 3: Frontend Deployment**
- [ ] Create static site service on Render
- [ ] Configure VITE_API_URL
- [ ] Deploy frontend
- [ ] Update backend CORS settings
- [ ] Test full user flow

**Phase 4: Optional Enhancements**
- [ ] Deploy background worker (if needed)
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure custom domain
- [ ] Enable preview environments

---

## Quick Reference

### Database Connection

**Local Development (apps/backend/.env):**
```bash
DATABASE_URL="postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a/upkeep_db_c52g"
```

**Render Service (Internal):**
```
postgresql://upkeep_user:NRcBRAxYhNxiE0b5DNF8joi6dRFTRYCq@dpg-d4h12ufdiees73b8fre0-a/upkeep_db_c52g
```

### Flyway Commands

```bash
# Check migration status
flyway info -configFiles=flyway.conf

# Apply migrations
flyway migrate -configFiles=flyway.conf

# Validate migrations
flyway validate -configFiles=flyway.conf
```

### Useful PostgreSQL Commands

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d+ table_name

# Run query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

**Document Version:** 2.0
**Last Updated:** 2025-11-22
**Database Provider:** Render PostgreSQL
**Schema Version:** v4
**Total Migrations Applied:** 4
**Next Phase:** Backend Service Deployment
