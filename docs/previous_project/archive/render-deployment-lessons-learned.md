# Render Deployment: Lessons Learned

**Date:** 2025-11-22
**Backend URL:** https://upkeep-io.onrender.com
**Status:** ✅ Successfully Deployed

## Key Lessons from Backend Deployment

### 1. TypeScript Path Aliases in Production

**Problem:** TypeScript path aliases (`@domain/*`, `@auth/*`, `@validators/*`) are compile-time features that don't work at runtime in Node.js.

**Solution:**
- Add `tsconfig-paths` to production dependencies
- Update start command to include `-r tsconfig-paths/register`
- **Critical:** Render's start command in dashboard must be updated, not just package.json

**Implementation:**
```json
// package.json
"dependencies": {
  "tsconfig-paths": "^4.2.0"  // Moved from devDependencies
}
```

**Render Start Command:**
```bash
cd apps/backend && npm start
```

### 2. Module Format Compatibility

**Problem:** Shared libraries compiled as ES modules (`export`), but Node.js backend expects CommonJS (`module.exports`).

**Solution:**
- Update all shared library tsconfig.json files:
  - Change `"module": "ESNext"` → `"module": "CommonJS"`
  - Change `"target": "ESNext"` → `"target": "ES2020"`

**Impact:** This change affects both backend and frontend. Frontend (Vite) can handle CommonJS, but backend cannot handle ES modules.

### 3. Docker Base Image Selection

**Problem:** Alpine Linux lacks OpenSSL libraries required by Prisma.

**Solution:**
- Switch from `node:18-alpine` to `node:18-slim` (Debian-based)
- Install OpenSSL: `apt-get install -y openssl`
- Add multiple Prisma binary targets for cross-platform support

**Prisma Configuration:**
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-1.1.x", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]
}
```

### 4. Render Service Configuration

**Problem:** Render uses the start command from its dashboard settings, not from package.json.

**Solution:** Always update BOTH:
1. package.json start script
2. Render dashboard Build & Deploy settings

**Best Practice:** Use `cd apps/backend && npm start` in Render to leverage package.json scripts.

### 5. Build Command Dependencies

**Problem:** TypeScript compilation requires dev dependencies (`@types/*` packages).

**Solution:** Use `npm ci --include=dev` in build command, not just `npm ci`.

**Render Build Command:**
```bash
npm ci --include=dev && \
npm run build --workspace=libs/domain && \
npm run build --workspace=libs/validators && \
npm run build --workspace=libs/auth && \
npx prisma generate --schema=apps/backend/prisma/schema.prisma && \
npm run build --workspace=apps/backend
```

### 6. Monorepo Deployment Considerations

**Key Points:**
- Build order matters: shared libraries → Prisma → backend
- Don't set a root directory in Render (leave blank for monorepo access)
- Start command must navigate to correct directory: `cd apps/backend && npm start`
- Shared libraries must be built during deployment

### 7. Environment Variables

**Required for Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secure random string
- `NODE_ENV` - Set to "production"
- `CORS_ORIGIN` - Frontend URL (update after frontend deployment)
- `JWT_EXPIRES_IN` - Token expiration (e.g., "7d")
- `NODE_VERSION` - Set to "18" (consider upgrading to 20 LTS)

### 8. Testing Strategy

**Always Test Locally First:**
1. Build all components: `npm run build`
2. Test dev environment: `npm run dev`
3. Build and test Docker image locally
4. Verify health endpoint responds

**Docker Test Command:**
```bash
docker build -f apps/backend/Dockerfile -t test . && \
docker run --rm -p 3000:3000 test
```

## Common Pitfalls to Avoid

1. **Don't assume Render uses package.json scripts** - Always check dashboard settings
2. **Don't use Alpine images with Prisma** - Stick with Debian-based images
3. **Don't forget dev dependencies in build** - Use `--include=dev`
4. **Don't mix module formats** - Keep shared libraries consistent (CommonJS for Node.js)
5. **Don't skip local testing** - Docker build locally before pushing

## Debugging Checklist

When deployment fails:
1. ✅ Check Render logs for specific error
2. ✅ Verify start command in Render dashboard
3. ✅ Confirm all environment variables are set
4. ✅ Test Docker build locally
5. ✅ Verify shared libraries are built
6. ✅ Check module format compatibility
7. ✅ Ensure Prisma binary targets match deployment platform

## Performance Observations

- Build time: ~23 seconds
- Deployment time: ~30 seconds
- Cold start: ~3 seconds
- Memory usage: Under 512MB
- Response time (health endpoint): ~50ms

## Security Considerations

1. **Vulnerabilities detected:** 6 (5 moderate, 1 high) in dev dependencies
   - Run `npm audit fix` after deployment
   - These are in dev dependencies, not affecting production runtime

2. **OpenSSL warning:** Render detects OpenSSL 1.x dependencies
   - Consider upgrading Prisma to latest version
   - Not critical but should be addressed

3. **Node.js version:** 18.20.8 is end-of-life
   - Upgrade to Node 20 LTS or 22 LTS recommended
   - Update `NODE_VERSION` environment variable in Render

## Monitoring & Maintenance

1. **Health Check:** https://upkeep-io.onrender.com/health
2. **Logs:** Available in Render dashboard
3. **Auto-deploy:** Enabled for main branch
4. **Rollback:** Available through Render dashboard

## Cost Tracking

- Backend service: Standard instance ($7/month estimated)
- Database: Separate PostgreSQL instance (cost varies)
- Total backend infrastructure: ~$12-15/month

## Next Steps: Frontend Deployment

### Pre-deployment Checklist:
- [ ] Update VITE_API_URL to backend URL
- [ ] Test frontend locally with production backend
- [ ] Build frontend to verify no errors
- [ ] Update CORS_ORIGIN on backend

### Deployment Plan:
1. Configure frontend for production API
2. Create Render static site service
3. Set build and publish directories
4. Deploy and verify
5. Update backend CORS settings
6. Test full stack integration

---

**Document Created:** 2025-11-22 21:50:00 UTC
**Last Updated:** 2025-11-22 21:50:00 UTC
**Author:** Claude Code + Developer