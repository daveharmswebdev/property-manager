# 🔧 Troubleshooting Guide

> *"The art of debugging is figuring out what you really told your program to do rather than what you thought you told it to do."* - Andrew Singer

## Quick Diagnosis

### By Error Message

| Error Contains | Jump To |
|---------------|----------|
| `"No database found to handle"` | [Database URL Format](#database-url-format-issues) |
| `"Cannot find module '@domain"` | [TypeScript Path Aliases](#typescript-path-alias-issues) |
| `"Unexpected token 'export'"` | [Module System Issues](#module-system-issues) |
| `"Cannot find name 'describe'"` | [Test File Compilation](#test-file-compilation-issues) |
| `"MODULE_NOT_FOUND"` | [Build Output Location](#build-output-location-issues) |
| `"Context access might be invalid"` | [GitHub Secrets](#github-secrets-issues) |
| `"libssl.so: cannot open"` | [Missing System Libraries](#missing-system-libraries) |
| `"Found non-empty schema"` | [Flyway Migration](#flyway-migration-issues) |

### By Symptom

| Symptom | Likely Cause |
|---------|-------------|
| Works locally, fails in production | Path aliases or module system |
| Build succeeds, runtime fails | Missing runtime dependencies |
| GitHub Actions can't find secrets | Wrong secret location |
| Database connection works, migrations fail | URL format issue |
| Frontend can't reach backend | CORS configuration |
| Deployment never completes | Build command syntax |

---

## Database Issues

### Database URL Format Issues

**Symptoms:**
- Flyway error: `"No database found to handle ***"`
- Connection works in app but not migrations
- JDBC driver errors

**Root Cause:**
Different tools require different URL formats:

```bash
# Application format (Prisma, Node.js)
postgresql://user:password@host:5432/database

# JDBC format (Flyway)
jdbc:postgresql://host:5432/database

# Internal Render format
postgresql://user:password@host.internal:5432/database
```

**Solutions:**

1. **For Flyway migrations:**
```yaml
# GitHub Actions secret
RENDER_DATABASE_URL: jdbc:postgresql://dpg-xxx.render.com:5432/database
```

2. **For application:**
```env
# Render environment variable
DATABASE_URL: postgresql://user:password@dpg-xxx.internal:5432/database
```

3. **Conversion helper:**
```javascript
// Convert PostgreSQL URL to JDBC
function toJdbcUrl(postgresUrl) {
  const url = new URL(postgresUrl);
  return `jdbc:postgresql://${url.hostname}:${url.port}${url.pathname}`;
}
```

**Verification:**
```bash
# Test JDBC connection
flyway info -url="jdbc:postgresql://host:5432/db" -user="user" -password="pass"

# Test PostgreSQL connection
psql "postgresql://user:password@host:5432/database"
```

### Database Connection Timeouts

**Symptoms:**
- Intermittent connection failures
- "Connection timeout" errors
- Works sometimes, fails others

**Solutions:**

1. **Use internal URLs on Render:**
```env
# Use .internal domain for same-region connections
DATABASE_URL=postgresql://user:pass@host.internal:5432/db
```

2. **Configure connection pool:**
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool settings
}

// Or in code
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  connectionLimit: 10,
});
```

3. **Add retry logic:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}
```

---

## Build & Compilation Issues

### TypeScript Path Alias Issues

**Symptoms:**
- `Error: Cannot find module '@domain/entities'`
- Works in development, fails in production
- Module resolution errors

**Root Cause:**
TypeScript path aliases aren't resolved by Node.js at runtime.

**Solutions:**

1. **Add tsconfig-paths to production:**
```json
// package.json
{
  "dependencies": {  // NOT devDependencies!
    "tsconfig-paths": "^4.2.0"
  },
  "scripts": {
    "start": "node -r tsconfig-paths/register dist/server.js"
  }
}
```

2. **Configure paths correctly:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["../../libs/domain/src/*"],
      "@validators/*": ["../../libs/validators/src/*"],
      "@auth/*": ["../../libs/auth/src/*"]
    }
  }
}
```

3. **For built files, point to dist:**
```json
// Backend tsconfig for production
{
  "paths": {
    "@domain/*": ["../../libs/domain/dist/*"],
    "@validators/*": ["../../libs/validators/dist/*"]
  }
}
```

### Module System Issues

**Symptoms:**
- `SyntaxError: Unexpected token 'export'`
- `Cannot use import statement outside a module`
- ES Module vs CommonJS conflicts

**Root Cause:**
Mismatch between module systems (CommonJS vs ES Modules).

**Solutions:**

1. **For shared libraries (monorepo):**
```json
// libs/*/tsconfig.json
{
  "compilerOptions": {
    "module": "CommonJS",  // Not "ESNext"
    "target": "ES2020"     // Node.js compatible
  }
}

// libs/*/package.json
{
  "name": "@upkeep-io/domain",
  // DO NOT add "type": "module"
  "main": "./dist/index.js"
}
```

2. **For Node.js backend:**
```json
// apps/backend/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020"
  }
}
```

3. **For Vite frontend:**
```json
// apps/frontend/tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext"
  }
}
```

### Test File Compilation Issues

**Symptoms:**
- `Cannot find name 'describe'`
- `Cannot find name 'it'` or `expect`
- Jest type errors during build

**Solutions:**

1. **Exclude test files from production build:**
```json
// All tsconfig.json files
{
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx"
  ]
}
```

2. **Ensure dev dependencies are installed for build:**
```bash
# Render build command
npm ci --include=dev  # Not just npm ci
```

3. **Separate test configuration:**
```json
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "jest"]
  },
  "include": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### Build Output Location Issues

**Symptoms:**
- `Cannot find module '/path/to/server.js'`
- Server file in unexpected location
- Start command fails

**Root Cause:**
TypeScript `rootDir` and `outDir` configuration affects output structure.

**Solutions:**

1. **Check actual output location:**
```bash
# After build, list files
find dist -name "*.js" | head -20

# Or on Render
ls -la apps/backend/dist/
```

2. **Correct rootDir configuration:**
```json
// apps/backend/tsconfig.json
{
  "compilerOptions": {
    "rootDir": "./src",    // Source root
    "outDir": "./dist"     // Output to dist/
  }
}
// Output: dist/server.js
```

3. **Update start command to match:**
```json
{
  "scripts": {
    "start": "node dist/server.js"  // Matches outDir structure
  }
}
```

---

## Deployment Platform Issues

### GitHub Secrets Issues

**Symptoms:**
- `Context access might be invalid: SECRET_NAME`
- Secrets undefined in Actions
- "Bad credentials" errors

**Root Cause:**
GitHub has different secret scopes.

**Solutions:**

1. **Use Environment Secrets for environment-protected workflows:**
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    environment: production  # Requires environment secrets
```

Navigate to: **Settings → Environments → production → Environment secrets**
NOT: **Settings → Secrets → Actions**

2. **Verify secret names match exactly:**
```yaml
# In workflow
${{ secrets.RENDER_DATABASE_URL }}

# In GitHub settings
RENDER_DATABASE_URL  # Case sensitive!
```

3. **Debug secret availability:**
```yaml
- name: Check secrets
  run: |
    if [ -z "${{ secrets.RENDER_DATABASE_URL }}" ]; then
      echo "Secret not found!"
      exit 1
    fi
    echo "Secret is available"
```

### Render-Specific Issues

**Symptoms:**
- Build succeeds but deploy fails
- Service never becomes healthy
- "Timed out" errors

**Solutions:**

1. **Ensure health check endpoint exists:**
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

2. **Check start command uses correct path:**
```bash
# From repository root
cd apps/backend && npm start

# Or with full path
node apps/backend/dist/server.js
```

3. **Verify port binding:**
```typescript
const PORT = process.env.PORT || 3000;  // Render provides PORT
app.listen(PORT, '0.0.0.0', () => {     // Bind to all interfaces
  console.log(`Server running on port ${PORT}`);
});
```

### Missing System Libraries

**Symptoms:**
- `libssl.so.1.1: cannot open shared object file`
- OpenSSL errors
- Binary compatibility issues

**Solutions:**

1. **Use Debian-based images instead of Alpine:**
```dockerfile
# Instead of
FROM node:18-alpine

# Use
FROM node:18-slim
```

2. **Install required libraries:**
```dockerfile
RUN apt-get update && apt-get install -y \
  openssl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*
```

3. **Configure Prisma for multiple targets:**
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = [
    "native",
    "debian-openssl-3.0.x",
    "linux-arm64-openssl-3.0.x"
  ]
}
```

---

## Migration Issues

### Flyway Migration Issues

**Symptoms:**
- `Found non-empty schema but no schema history table`
- Migrations not applying
- Version conflicts

**Solutions:**

1. **Initialize existing database:**
```bash
flyway migrate -baselineOnMigrate=true
```

2. **Check migration file naming:**
```
V1__description.sql     # Two underscores!
V2__another_one.sql
V3.1__minor_change.sql  # Decimals allowed
```

3. **Verify migration location:**
```yaml
-locations="filesystem:./apps/backend/migrations"
```

4. **Clean failed migrations:**
```bash
flyway repair  # Fix failed migrations
flyway clean   # WARNING: Drops everything!
```

---

## Runtime Issues

### CORS Issues

**Symptoms:**
- Frontend can't reach backend
- "CORS policy" errors in browser
- Preflight request failures

**Solutions:**

1. **Configure CORS properly:**
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. **Set environment variable:**
```env
# Exact frontend URL, no trailing slash
CORS_ORIGIN=https://upkeep-app.onrender.com
```

3. **Debug CORS:**
```typescript
app.use((req, res, next) => {
  console.log('Origin:', req.headers.origin);
  console.log('Method:', req.method);
  next();
});
```

### Memory Issues

**Symptoms:**
- Service restarts frequently
- "JavaScript heap out of memory"
- Slow response times

**Solutions:**

1. **Increase memory limit:**
```json
{
  "scripts": {
    "start": "node --max-old-space-size=1024 dist/server.js"
  }
}
```

2. **Optimize Prisma queries:**
```typescript
// Instead of
const properties = await prisma.property.findMany({
  include: { leases: true, maintenanceWorks: true }
});

// Use
const properties = await prisma.property.findMany({
  select: { id: true, address: true }  // Only needed fields
});
```

3. **Add pagination:**
```typescript
const properties = await prisma.property.findMany({
  skip: offset,
  take: limit,
  where: { userId }
});
```

---

## Debugging Techniques

### Local Production Build

```bash
# Simulate production locally
NODE_ENV=production npm ci --include=dev
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

### Render Shell Access

```bash
# SSH into Render service
# Available in Render dashboard → Shell

# Check file structure
ls -la dist/

# View environment variables
env | grep -E "(NODE|DATABASE|JWT)"

# Test database connection
node -e "console.log(process.env.DATABASE_URL)"

# Check running processes
ps aux

# View recent logs
tail -n 100 /var/log/render.log
```

### Logging Strategy

```typescript
// Structured logging
const logger = {
  info: (msg, data = {}) => console.log(JSON.stringify({
    level: 'info',
    message: msg,
    ...data,
    timestamp: new Date().toISOString()
  })),
  error: (msg, error, data = {}) => console.error(JSON.stringify({
    level: 'error',
    message: msg,
    error: error.message,
    stack: error.stack,
    ...data,
    timestamp: new Date().toISOString()
  }))
};

// Use throughout application
logger.info('Server starting', { port: PORT, env: NODE_ENV });
logger.error('Database connection failed', error, { url: DATABASE_URL });
```

---

## Prevention Checklist

### Before Deployment

- [ ] Test production build locally
- [ ] Verify all environment variables
- [ ] Check path alias resolution
- [ ] Exclude test files from build
- [ ] Ensure health endpoint exists
- [ ] Test with production dependencies only

### After Deployment

- [ ] Check health endpoint
- [ ] Verify database connectivity
- [ ] Test authentication flow
- [ ] Check CORS with frontend
- [ ] Monitor memory usage
- [ ] Review error logs

### Regular Maintenance

- [ ] Update dependencies monthly
- [ ] Review and rotate secrets
- [ ] Check for security updates
- [ ] Monitor performance metrics
- [ ] Test rollback procedures
- [ ] Update documentation

---

## Quick Fixes Reference

```bash
# Fix module issues
npm i tsconfig-paths --save

# Fix test compilation
echo '**/*.test.ts' >> .buildignore

# Fix CORS quickly (temporary)
CORS_ORIGIN=* npm start

# Fix memory issues
node --max-old-space-size=2048 dist/server.js

# Fix permission issues
chmod +x scripts/*.sh

# Clear and rebuild
rm -rf node_modules dist
npm ci --include=dev
npm run build
```

---

## When All Else Fails

1. **Check the basics:**
   - Is the service actually running?
   - Are credentials correct?
   - Is the URL right?

2. **Simplify:**
   - Remove complexity temporarily
   - Test with minimal configuration
   - Add features back incrementally

3. **Compare:**
   - What's different from local?
   - What changed recently?
   - Check git diff

4. **Get help:**
   - Render Community Forums
   - Stack Overflow with exact error
   - GitHub Issues on the repo

---

*Remember: Every production issue has been encountered before. The solution exists; it's just a matter of finding it.*