# Render Backend Deployment Troubleshooting Log

**Document Created:** 2025-11-22 20:58:00 UTC
**Deployment Target:** Render.com Web Service
**Service Name:** upkeep-api
**Status:** In Progress

---

## Overview

This document chronicles the complete troubleshooting process for deploying the Express backend to Render. The deployment involved resolving multiple configuration issues related to monorepo structure, TypeScript compilation, and dependency management.

---

## Timeline of Events

### 2025-11-22 20:40:00 UTC - First Deployment Attempt

**Issue 1: Test Files Causing Build Failure**

**Error:**
```
error TS2582: Cannot find name 'describe'. Do you need to install type definitions for a test runner?
error TS2304: Cannot find name 'expect'.
error TS2304: Cannot find name 'it'.
```

**Root Cause:**
TypeScript compiler was attempting to compile `.test.ts` files in shared libraries during production build. Jest type definitions (`describe`, `it`, `expect`) were not available in the build environment.

**Affected Files:**
- `libs/domain/src/errors/NotFoundError.test.ts`
- `libs/domain/src/errors/ValidationError.test.ts`
- All other `*.test.ts` files in shared libraries

**Solution:**
Updated `tsconfig.json` for all three shared libraries to exclude test files:

```json
{
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Files Modified:**
- `libs/domain/tsconfig.json`
- `libs/validators/tsconfig.json`
- `libs/auth/tsconfig.json`

**Commit:** `7ee13cf` - "fix: Exclude test files from shared library builds"

**Result:** ✅ Test file compilation errors resolved

---

### 2025-11-22 20:43:00 UTC - Second Deployment Attempt

**Issue 2: Missing TypeScript Type Definitions**

**Error:**
```
error TS7016: Could not find a declaration file for module 'jsonwebtoken'.
Try `npm i --save-dev @types/jsonwebtoken` if it exists
```

**Root Cause:**
`npm ci` was skipping dev dependencies because `NODE_ENV=production` was set as an environment variable. TypeScript type definitions (like `@types/jsonwebtoken`) are dev dependencies but are required for compilation.

**Investigation:**
- Verified `@types/jsonwebtoken` was present in `libs/auth/package.json` as a devDependency
- Confirmed `npm ci` installed only 244 packages instead of 900+ (missing dev dependencies)

**Solution:**
Updated build command to force installation of dev dependencies:

```bash
# Before
npm ci && npm run build ...

# After
npm ci --include=dev && npm run build ...
```

**Build Command Updated in Render Dashboard:**
```bash
npm ci --include=dev && npm run build --workspace=libs/domain && npm run build --workspace=libs/validators && npm run build --workspace=libs/auth && npx prisma generate --schema=apps/backend/prisma/schema.prisma && npm run build --workspace=apps/backend
```

**Result:** ✅ TypeScript types available for build
**Side Effect:** Increased dependency installation from 244 → 907 packages

---

### 2025-11-22 20:48:00 UTC - Third Deployment Attempt

**Issue 3: Server File Not Found at Runtime**

**Error:**
```
Error: Cannot find module '/opt/render/project/src/apps/backend/dist/server.js'
code: 'MODULE_NOT_FOUND'
```

**Root Cause:**
The backend's `tsconfig.json` had `rootDir: "../../"` (repository root), causing TypeScript to preserve the full directory structure. Compiled output was at:
```
dist/apps/backend/src/server.js  ← Actual location
```

But the start command was looking for:
```
apps/backend/dist/server.js  ← Expected location
```

**Investigation:**
Examined `apps/backend/tsconfig.json`:
```json
{
  "rootDir": "../../",  // ← Problem: repository root
  "outDir": "./dist"
}
```

**Attempted Solution 1:**
Changed `rootDir` to `./src` to flatten output structure:

```json
{
  "rootDir": "./src",  // Flatten to src-relative paths
  "outDir": "./dist"
}
```

**Commit:** `21c95b7` - "fix: Correct backend TypeScript output path"

**Result:** ❌ Created new issue (see Issue 4)

---

### 2025-11-22 20:56:00 UTC - Fourth Deployment Attempt

**Issue 4: Shared Library Imports Outside rootDir**

**Error:**
```
error TS6059: File '/opt/render/project/src/libs/domain/src/errors/index.ts'
is not under 'rootDir' '/opt/render/project/src/apps/backend/src'.
'rootDir' is expected to contain all source files.
```

**Root Cause:**
When `rootDir` was changed to `./src`, TypeScript compiler refused to compile files imported from shared libraries because they were outside the specified rootDir.

**Affected Imports:**
- `@domain/entities` → `libs/domain/src/entities/`
- `@domain/errors` → `libs/domain/src/errors/`
- `@validators/auth` → `libs/validators/src/auth/`
- `@validators/property` → `libs/validators/src/property/`
- `@auth/jwt` → `libs/auth/src/jwt/`

**Investigation:**
The backend was trying to recompile shared library TypeScript sources instead of importing the already-compiled JavaScript files from their `dist` folders.

**Solution:**
Configure TypeScript path mappings to import compiled JavaScript from shared libraries:

```json
{
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
  "include": ["src/**/*"]
}
```

**Commit:** `0358580` - "fix: Configure backend to use compiled shared libraries"

**Result:** ✅ Backend imports pre-compiled shared libraries
**Expected Outcome:** Build should succeed, server should start

---

## Build Architecture

### Monorepo Structure

```
upkeep-io/
├── apps/
│   └── backend/
│       ├── src/           # TypeScript source
│       ├── dist/          # Compiled JavaScript (build output)
│       └── tsconfig.json  # Backend TypeScript config
└── libs/
    ├── domain/
    │   ├── src/           # TypeScript source
    │   ├── dist/          # Compiled JavaScript
    │   └── tsconfig.json
    ├── validators/
    │   ├── src/
    │   ├── dist/
    │   └── tsconfig.json
    └── auth/
        ├── src/
        ├── dist/
        └── tsconfig.json
```

### Build Sequence

The correct build order is critical:

1. **Build Shared Libraries** (in parallel):
   ```bash
   npm run build --workspace=libs/domain
   npm run build --workspace=libs/validators
   npm run build --workspace=libs/auth
   ```

   Output:
   - `libs/domain/dist/*.js`
   - `libs/validators/dist/*.js`
   - `libs/auth/dist/*.js`

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate --schema=apps/backend/prisma/schema.prisma
   ```

   Output: `node_modules/@prisma/client/`

3. **Build Backend**:
   ```bash
   npm run build --workspace=apps/backend
   ```

   - Imports from `libs/*/dist/*.js` (compiled libraries)
   - Compiles only `apps/backend/src/**/*`
   - Output: `apps/backend/dist/server.js`

### Dependency Management

**Production vs Dev Dependencies:**

The build process requires dev dependencies (TypeScript types) but Render defaults to production-only installation when `NODE_ENV=production`.

**Solution:** Explicitly install dev dependencies:
```bash
npm ci --include=dev
```

**Installed Packages:**
- Production only: 244 packages
- With dev dependencies: 907 packages

**Critical Dev Dependencies:**
- `@types/jsonwebtoken` - JWT type definitions
- `@types/jest` - Test type definitions
- `typescript` - TypeScript compiler
- All other `@types/*` packages

---

## Configuration Files

### Final Backend tsconfig.json

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
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Key Points:**
- `rootDir: "./src"` - Only compile backend source
- `paths` - Import compiled shared libraries
- `exclude` - Skip test files

### Final Shared Library tsconfig.json (libs/*/tsconfig.json)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "module": "ESNext",
    "target": "ESNext"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Key Points:**
- `exclude` - Skip all test files
- `composite: true` - Enable TypeScript project references

### Render Service Configuration

**Build Command:**
```bash
npm ci --include=dev && npm run build --workspace=libs/domain && npm run build --workspace=libs/validators && npm run build --workspace=libs/auth && npx prisma generate --schema=apps/backend/prisma/schema.prisma && npm run build --workspace=apps/backend
```

**Start Command:**
```bash
node apps/backend/dist/server.js
```

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection (internal URL)
- `JWT_SECRET` - Secure random string
- `NODE_ENV` - `production`
- `CORS_ORIGIN` - Frontend URL (or `*` temporarily)
- `JWT_EXPIRES_IN` - `7d`
- `NODE_VERSION` - `18`

**Instance Type:** Standard ($25/month - 2GB RAM, 1 CPU)

**Root Directory:** *(Leave blank - full repo needed)*

**Auto-Deploy:** Yes (on push to main branch)

---

## Lessons Learned

### 1. Test File Exclusion

**Problem:** TypeScript compiles all files in `include` patterns by default.

**Solution:** Always explicitly exclude test files in production builds:
```json
{
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### 2. Dev Dependencies in Production Builds

**Problem:** TypeScript compilation requires dev dependencies (`@types/*`), but many platforms skip them in production mode.

**Solution:** Force dev dependency installation during build:
```bash
npm ci --include=dev
```

**Alternative:** Move critical type definitions to `dependencies` (not recommended).

### 3. Monorepo TypeScript Configuration

**Problem:** Backend importing shared library TypeScript sources creates rootDir conflicts.

**Solution:** Use path mappings to import compiled JavaScript:
```json
{
  "paths": {
    "@lib/*": ["../../libs/lib/dist/*"]
  }
}
```

**Benefits:**
- Avoids recompiling shared code
- Prevents rootDir conflicts
- Faster builds (shared libs built once)

### 4. Build Order Matters

**Critical:** Shared libraries MUST build before the backend.

**Correct Order:**
1. Shared libraries (can be parallel)
2. Prisma client generation
3. Backend compilation

**Incorrect Order Results In:**
- Missing module errors
- Import path errors
- Runtime failures

### 5. Render-Specific Considerations

**Root Directory:** Leave blank for monorepos. Render needs access to the entire repository to build shared libraries.

**Working Directory:** Start command runs from repository root, so use explicit paths:
```bash
node apps/backend/dist/server.js
```

**Upload Phase:** Only compiled files in `dist` folders are needed at runtime, but Render includes the full build directory.

---

## Troubleshooting Guide

### Issue: "Cannot find name 'describe'" or similar Jest errors

**Diagnosis:** Test files are being compiled in production build.

**Fix:** Add test files to `exclude` in `tsconfig.json`:
```json
{
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Issue: "Could not find a declaration file for module 'X'"

**Diagnosis:** Missing `@types/*` packages or dev dependencies not installed.

**Fix 1:** Ensure dev dependencies are installed:
```bash
npm ci --include=dev
```

**Fix 2:** Verify `@types/X` is in `devDependencies` in `package.json`.

### Issue: "File is not under 'rootDir'"

**Diagnosis:** TypeScript trying to compile files outside the specified `rootDir`.

**Fix:** Use path mappings to import compiled files instead of sources:
```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "paths": {
      "@lib/*": ["../../libs/lib/dist/*"]
    }
  }
}
```

### Issue: "Cannot find module '/path/to/server.js'"

**Diagnosis:** Compiled output is in unexpected location.

**Fix 1:** Check `tsconfig.json` `rootDir` and `outDir` settings.

**Fix 2:** Update start command to match actual output path:
```bash
# If rootDir is repo root:
node apps/backend/dist/apps/backend/src/server.js

# If rootDir is ./src:
node apps/backend/dist/server.js
```

**Fix 3:** List files in build output to verify location:
```bash
# In Render shell
ls -R apps/backend/dist/
```

---

## Performance Metrics

### Build Times

| Phase | Duration | Notes |
|-------|----------|-------|
| npm ci --include=dev | ~22s | Install 907 packages |
| Build libs/domain | ~2s | TypeScript compilation |
| Build libs/validators | ~3s | TypeScript compilation |
| Build libs/auth | ~2s | TypeScript compilation |
| Generate Prisma Client | ~0.4s | Schema to client generation |
| Build backend | ~3s | TypeScript compilation |
| **Total Build Time** | **~32s** | First build on Render |

### Dependency Counts

- **Production dependencies:** 244 packages
- **All dependencies (with dev):** 907 packages
- **Difference:** 663 dev dependencies

### Security Vulnerabilities

```
6 vulnerabilities (5 moderate, 1 high)
```

**Note:** These are in dev dependencies (testing tools). Production runtime is not affected.

**Recommendation:** Run `npm audit fix` locally and commit updated `package-lock.json`.

---

## Future Improvements

### 1. TypeScript Project References

Consider using TypeScript project references for better monorepo support:

```json
// apps/backend/tsconfig.json
{
  "references": [
    { "path": "../../libs/domain" },
    { "path": "../../libs/validators" },
    { "path": "../../libs/auth" }
  ]
}
```

**Benefits:**
- Better IDE support
- Incremental builds
- Clearer dependency graph

### 2. Turborepo or Nx

Evaluate monorepo build tools for:
- Parallel builds
- Dependency caching
- Affected-only builds

### 3. Separate Build and Runtime Images

For Docker deployments:
- Multi-stage builds
- Smaller runtime images (production only)
- Build cache optimization

### 4. Node Version Upgrade

Current: Node 18.20.8 (end-of-life)

**Recommendation:** Upgrade to Node 20 LTS or Node 22 LTS

Update `NODE_VERSION` environment variable in Render:
```
NODE_VERSION=20
```

### 5. Prisma Optimizations

- Generate Prisma Client during build (already done)
- Consider `prisma generate --no-engine` for smaller builds
- Evaluate Prisma Accelerate for connection pooling

---

## Related Documentation

- [Render Deployment Plan](railway-to-render-migration.md)
- [GitHub Secrets Setup](render-github-secrets-setup.md)
- [TypeScript Configuration Guide](./typescript-configuration.md)

---

## Deployment Checklist

### Pre-Deployment
- [x] Database migrated and verified
- [x] Environment variables configured
- [x] Build command configured
- [x] Start command configured
- [x] Node version specified
- [x] Test files excluded from build
- [x] Dev dependencies installation enabled
- [x] TypeScript path mappings configured

### Post-Deployment Verification
- [ ] Build completes successfully
- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] Database connection works
- [ ] Authentication endpoints functional
- [ ] CORS configured correctly
- [ ] Logs show no errors

### Testing
- [ ] POST /api/auth/signup - Create test user
- [ ] POST /api/auth/login - Get JWT token
- [ ] GET /api/properties - List properties (with auth)
- [ ] POST /api/properties - Create property (with auth)
- [ ] GET /api/properties/:id - Get single property
- [ ] PUT /api/properties/:id - Update property
- [ ] DELETE /api/properties/:id - Delete property

---

## Appendix: Git Commits

### Commit History (Deployment Fixes)

1. **7ee13cf** - "fix: Exclude test files from shared library builds"
   - Added `**/*.test.ts` and `**/*.spec.ts` to exclude in all libs
   - Resolved Jest type errors in build

2. **21c95b7** - "fix: Correct backend TypeScript output path"
   - Changed `rootDir` to `./src`
   - Attempted to flatten output structure
   - **Reverted by next commit** (caused new issues)

3. **0358580** - "fix: Configure backend to use compiled shared libraries"
   - Added TypeScript path mappings
   - Backend imports from `libs/*/dist/*.js`
   - Resolved rootDir conflict
   - **Final working configuration**

---

---

## Deployment Fix Complete: 2025-11-22 21:33:00 UTC

### Final Issue 5: TypeScript Path Aliases Not Resolved at Runtime

**Error:**
```
Error: Cannot find module '@auth/jwt'
```

**Root Cause:**
TypeScript path aliases (`@domain/*`, `@auth/*`, `@validators/*`) were not resolved at runtime in production. While development used `ts-node-dev -r tsconfig-paths/register` which resolved aliases, production used plain `node dist/server.js` which doesn't understand these aliases.

**Solution Applied:**
1. **Moved `tsconfig-paths` to production dependencies** in `apps/backend/package.json`
2. **Updated start script** to use `node -r tsconfig-paths/register dist/server.js`
3. **Fixed TypeScript implicit 'any' errors** in repositories:
   - PrismaLeaseRepository.ts
   - PrismaPersonRepository.ts
   - PrismaPropertyRepository.ts

**Result:** ✅ Runtime path resolution works in production

---

### Final Issue 6: Shared Libraries Compiled as ES Modules

**Error:**
```
SyntaxError: Unexpected token 'export'
```

**Root Cause:**
Shared libraries were compiled with `"module": "ESNext"` producing ES modules, but backend expected CommonJS modules.

**Solution Applied:**
Updated all shared library `tsconfig.json` files:
- Changed `"module": "ESNext"` to `"module": "CommonJS"`
- Changed `"target": "ESNext"` to `"target": "ES2020"`

**Files Modified:**
- `libs/auth/tsconfig.json`
- `libs/domain/tsconfig.json`
- `libs/validators/tsconfig.json`

**Result:** ✅ Shared libraries compile to CommonJS

---

### Final Issue 7: Docker Image Missing OpenSSL

**Error:**
```
Error loading shared library libssl.so.1.1: No such file or directory
```

**Root Cause:**
Alpine Linux image missing OpenSSL libraries required by Prisma.

**Solution Applied:**
1. **Changed base image** from `node:18-alpine` to `node:18-slim` (Debian-based)
2. **Added OpenSSL installation** in Dockerfile
3. **Updated Prisma schema** to support multiple binary targets:
   ```prisma
   binaryTargets = ["native", "linux-musl-arm64-openssl-1.1.x", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]
   ```

**Result:** ✅ Prisma works in Docker container

---

## Final Working Configuration

### Backend package.json Changes:
```json
{
  "scripts": {
    "start": "node -r tsconfig-paths/register dist/server.js",
  },
  "dependencies": {
    "tsconfig-paths": "^4.2.0",  // Moved from devDependencies
  }
}
```

### Dockerfile Changes:
- Base image: `node:18-slim` (Debian) instead of `node:18-alpine`
- Added OpenSSL: `apt-get install -y openssl`
- Build shared libraries before backend
- Use `npm start` in CMD to leverage the updated start script

### Render Configuration:
- Build command remains the same (includes shared library builds)
- Start command now uses the updated `npm start` which includes tsconfig-paths

---

## Verification Steps Completed

✅ Development environment verified:
- All shared libraries build successfully
- Backend and frontend build without errors
- Dev servers run without issues
- No impact on development workflow

✅ Docker container tested locally:
- Image builds successfully
- Container starts without module resolution errors
- Health endpoint responds correctly
- Prisma client works with proper binary targets

✅ Ready for Render deployment:
- All fixes are backward compatible
- Development environment unaffected
- Production-ready configuration

---

**Document Status:** Complete
**Last Updated:** 2025-11-22 21:33:00 UTC
**Deployment Status:** Ready for Render deployment
