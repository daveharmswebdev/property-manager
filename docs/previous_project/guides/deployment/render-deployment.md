# 🚀 Render Deployment Guide (Complete)

> *This consolidated guide combines all deployment knowledge into one authoritative resource.*

## Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Database Setup](#database-setup)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
- [Common Issues & Solutions](#common-issues--solutions)
- [Configuration Reference](#configuration-reference)

---

## Quick Start

### Deployment Checklist
- [ ] PostgreSQL database created on Render
- [ ] Backend service deployed and running
- [ ] Frontend static site deployed
- [ ] GitHub Actions configured for migrations
- [ ] Environment secrets properly formatted
- [ ] Health checks passing

### Critical URLs Format

⚠️ **MOST IMPORTANT:** Database URLs have different formats for different tools:

```bash
# Render provides (for application use):
postgresql://user:password@host/database

# Flyway needs (for migrations):
jdbc:postgresql://host:5432/database

# Internal vs External:
# Use Internal URL for backend (faster, secure)
# Use External URL for GitHub Actions (migrations)
```

---

## Prerequisites

### Required Accounts
- Render.com account (free tier works initially)
- GitHub repository with the code
- PostgreSQL database on Render

### Local Prerequisites
```bash
# Verify build works locally
npm ci --include=dev
npm run build

# Test production build
NODE_ENV=production npm start
```

---

## Backend Deployment

### Step 1: Create Web Service

1. **New Web Service** → Connect GitHub repo
2. **Service Name:** `upkeep-api` or similar
3. **Root Directory:** Leave blank (monorepo needs full access)
4. **Environment:** Node
5. **Build Command:**
```bash
npm ci --include=dev && \
npm run build --workspace=libs/domain && \
npm run build --workspace=libs/validators && \
npm run build --workspace=libs/auth && \
npx prisma generate --schema=apps/backend/prisma/schema.prisma && \
npm run build --workspace=apps/backend
```

6. **Start Command:**
```bash
cd apps/backend && npm start
```

### Step 2: Configure Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Internal PostgreSQL URL | Use internal for performance |
| `JWT_SECRET` | Random secure string | Generate with `openssl rand -hex 32` |
| `NODE_ENV` | `production` | Required for production mode |
| `CORS_ORIGIN` | Frontend URL or `*` | Update after frontend deployment |
| `JWT_EXPIRES_IN` | `7d` | Token expiration |
| `NODE_VERSION` | `18` | Or newer LTS version |

### Step 3: Deploy and Verify

1. Click **Create Web Service**
2. Monitor build logs for errors
3. Once deployed, test health endpoint:
```bash
curl https://your-service.onrender.com/health
```

### Critical Backend Configurations

#### TypeScript Path Aliases
**Problem:** Path aliases (`@domain/*`) don't work in production Node.js

**Solution:**
```json
// apps/backend/package.json
{
  "dependencies": {
    "tsconfig-paths": "^4.2.0"  // Must be in dependencies, not devDependencies
  },
  "scripts": {
    "start": "node -r tsconfig-paths/register dist/server.js"
  }
}
```

#### Module Compatibility
**Problem:** Shared libraries as ES modules break CommonJS backend

**Solution:**
```json
// libs/*/tsconfig.json
{
  "compilerOptions": {
    "module": "CommonJS",  // Not "ESNext"
    "target": "ES2020"     // Not "ESNext"
  }
}
```

#### Test Files in Build
**Problem:** TypeScript tries to compile test files in production

**Solution:**
```json
// All tsconfig.json files
{
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

---

## Frontend Deployment

### Step 1: Create Static Site

1. **New Static Site** → Connect same GitHub repo
2. **Service Name:** `upkeep-app` or similar
3. **Root Directory:** Leave blank
4. **Build Command:**
```bash
npm ci --include=dev && \
npm run build --workspace=libs/domain && \
npm run build --workspace=libs/validators && \
npm run build --workspace=libs/auth && \
npm run build --workspace=apps/frontend
```

5. **Publish Directory:** `apps/frontend/dist`

### Step 2: Configure Build Environment

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | Backend URL + `/api` | e.g., `https://upkeep-api.onrender.com/api` |
| `NODE_VERSION` | `18` | Match backend version |

### Step 3: Configure Redirects

Create `apps/frontend/public/_redirects`:
```
/* /index.html 200
```
This enables client-side routing for Vue Router.

### Step 4: Deploy and Verify

1. Click **Create Static Site**
2. Monitor build logs
3. Test deployed site
4. Update backend `CORS_ORIGIN` with frontend URL

---

## Database Setup

### Step 1: Create PostgreSQL Database

1. **New PostgreSQL** → Create database
2. **Name:** `upkeep-db`
3. **Region:** Same as backend (Ohio recommended)
4. **Plan:** Free tier initially

### Step 2: Get Connection URLs

Navigate to database dashboard and note:

- **Internal URL:** For backend service (same network, faster)
- **External URL:** For GitHub Actions (internet access)

### Step 3: Initial Schema Setup

If starting fresh:
```bash
# Connect to database
psql $DATABASE_URL

# Verify connection
\dt
```

If migrating existing schema, use Flyway (see CI/CD section).

---

## CI/CD with GitHub Actions

### Step 1: Configure GitHub Environment

1. Go to: **Repository Settings → Environments**
2. Create environment: `production`
3. Enable **Required reviewers** (add yourself)
4. Add **Environment Secrets** (NOT Repository Secrets):

| Secret | Value | Format |
|--------|-------|--------|
| `RENDER_DATABASE_URL` | JDBC format URL | `jdbc:postgresql://host:5432/database` |
| `RENDER_DATABASE_USER` | Database username | From Render dashboard |
| `RENDER_DATABASE_PASSWORD` | Database password | From Render dashboard |

### Step 2: URL Format Conversion

**Critical:** Convert Render's PostgreSQL URL to JDBC format for Flyway

Given Render URL:
```
postgresql://user:password@dpg-xxx.render.com/database
```

Extract and create JDBC URL:
```
jdbc:postgresql://dpg-xxx.render.com:5432/database
```

### Step 3: GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  migrate:
    needs: test
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4

      - name: Setup Flyway
        run: |
          wget -qO- https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/10.21.0/flyway-commandline-10.21.0-linux-x64.tar.gz | tar xvz
          sudo ln -s `pwd`/flyway-10.21.0/flyway /usr/local/bin

      - name: Run migrations
        run: |
          flyway migrate \
            -url="${{ secrets.RENDER_DATABASE_URL }}" \
            -user="${{ secrets.RENDER_DATABASE_USER }}" \
            -password="${{ secrets.RENDER_DATABASE_PASSWORD }}" \
            -locations="filesystem:./apps/backend/migrations" \
            -baselineOnMigrate=true
```

### Step 4: Migration Files

Place Flyway migrations in `apps/backend/migrations/`:
```
V1__init.sql
V2__add_leases.sql
V3__add_vendors.sql
```

---

## Common Issues & Solutions

### Issue: "No database found to handle ***"

**Cause:** Wrong database URL format for Flyway

**Solution:** Use JDBC format:
```bash
# Wrong:
postgresql://user:pass@host/db

# Right:
jdbc:postgresql://host:5432/db
```

### Issue: "Cannot find module '@domain/entities'"

**Cause:** TypeScript path aliases not resolved at runtime

**Solution:**
1. Add `tsconfig-paths` to dependencies (not devDependencies)
2. Update start command: `node -r tsconfig-paths/register dist/server.js`

### Issue: "Unexpected token 'export'"

**Cause:** Shared libraries compiled as ES modules, backend expects CommonJS

**Solution:** Update shared library `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020"
  }
}
```

### Issue: "Cannot find name 'describe'"

**Cause:** Test files being compiled in production

**Solution:** Exclude test files in `tsconfig.json`:
```json
{
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### Issue: "Found non-empty schema but no schema history table"

**Cause:** Database has existing tables, Flyway needs initialization

**Solution:** Add `-baselineOnMigrate=true` to Flyway command

### Issue: "Context access might be invalid: RENDER_DATABASE_URL"

**Cause:** Secrets in wrong location

**Solution:** Use Environment Secrets, not Repository Secrets

### Issue: Missing OpenSSL libraries

**Cause:** Alpine Linux doesn't include libraries Prisma needs

**Solution:** Use Debian-based image:
```dockerfile
FROM node:18-slim  # Not node:18-alpine
RUN apt-get update && apt-get install -y openssl
```

---

## Configuration Reference

### Complete Backend Configuration

#### package.json
```json
{
  "scripts": {
    "start": "node -r tsconfig-paths/register dist/server.js",
    "build": "tsc"
  },
  "dependencies": {
    "tsconfig-paths": "^4.2.0",
    // ... other runtime dependencies
  }
}
```

#### tsconfig.json
```json
{
  "extends": "../../tsconfig.backend.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["../../libs/domain/dist/*"],
      "@validators/*": ["../../libs/validators/dist/*"],
      "@auth/*": ["../../libs/auth/dist/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Complete Frontend Configuration

#### vite.config.ts
```typescript
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@domain': fileURLToPath(new URL('../../libs/domain/src', import.meta.url)),
      '@validators': fileURLToPath(new URL('../../libs/validators/src', import.meta.url)),
      '@auth': fileURLToPath(new URL('../../libs/auth/src', import.meta.url))
    }
  }
})
```

### Prisma Configuration

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = [
    "native",
    "linux-musl-arm64-openssl-1.1.x",
    "linux-arm64-openssl-3.0.x",
    "debian-openssl-3.0.x"
  ]
}
```

---

## Deployment Timeline

Expect the following timeline for initial deployment:

| Step | Time | Notes |
|------|------|-------|
| Database setup | 5 min | Instant provisioning |
| Backend first build | 5-10 min | Installing dependencies |
| Backend subsequent builds | 1-2 min | Cached dependencies |
| Frontend build | 3-5 min | Vite build |
| Migration setup | 20 min | GitHub secrets config |
| Full verification | 10 min | Testing all endpoints |
| **Total** | **~45 minutes** | First deployment |

---

## Health Checks & Monitoring

### Backend Health Check
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

### Monitoring Commands
```bash
# Check backend
curl https://your-backend.onrender.com/health

# Check database connection
curl https://your-backend.onrender.com/api/health/db

# Check frontend
curl https://your-frontend.onrender.com
```

---

## Cost Optimization

### Free Tier Limits
- Web Service: Spins down after 15 min inactivity
- Database: 90 days retention, 256MB storage
- Bandwidth: 100GB/month

### Upgrade Path
- Backend: $25/month (always on, 2GB RAM)
- Database: $20/month (1GB storage, backups)
- Frontend: Free (static hosting)
- **Total:** ~$45/month for production

---

## Rollback Procedures

### Code Rollback
1. Revert commit in GitHub
2. Render auto-deploys previous version
3. Verify services are running

### Database Rollback
```bash
# Always backup first
pg_dump $DATABASE_URL > backup.sql

# Rollback migration
flyway undo

# Or restore from backup
psql $DATABASE_URL < backup.sql
```

---

## Security Checklist

- [ ] JWT_SECRET is random and secure
- [ ] CORS_ORIGIN restricted to frontend URL
- [ ] Database URL uses internal connection
- [ ] Environment variables not in code
- [ ] HTTPS enforced (Render default)
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma parameterized queries)

---

## Next Steps After Deployment

1. **Test all endpoints** with the deployed URLs
2. **Set up monitoring** (UptimeRobot, etc.)
3. **Configure custom domain** if needed
4. **Set up error tracking** (Sentry, etc.)
5. **Enable automatic backups** for database
6. **Document API endpoints** for team

---

## Support Resources

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Project Repository Issues](https://github.com/your-repo/issues)
- [Flyway Documentation](https://flywaydb.org/documentation/)

---

*This guide represents ~20 hours of deployment troubleshooting condensed into a 15-minute read. When issues arise, check the Common Issues section first - your problem has likely been solved before.*