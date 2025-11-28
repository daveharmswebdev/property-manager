# 🚀 Deployment Lessons Learned

> *"In theory, deployment is just copying files. In practice, it's a journey through every decision you've ever made."*

## Executive Summary

Deploying Upkeep.io from local development to Render.com revealed critical lessons about module systems, database URL formats, secret management, and production configurations. These lessons cost approximately 20 hours of debugging time - may they save you from the same fate.

## 🔴 Critical Issues That Will Block You

### 1. Database URL Format Incompatibility

**The Problem That Cost 4 Hours**

Render provides PostgreSQL URLs in standard format:
```
postgresql://user:password@host/database
```

But Flyway (our migration tool) requires JDBC format:
```
jdbc:postgresql://host:5432/database
```

**What Happens:**
- Flyway fails with cryptic error: `"No database found to handle ***"`
- No clear indication that URL format is the issue
- Works perfectly in local development

**The Solution:**
```yaml
# GitHub Actions Secret (RENDER_DATABASE_URL)
jdbc:postgresql://dpg-xxx.render.com:5432/upkeep_db

# NOT this (from Render dashboard):
postgresql://user:pass@dpg-xxx.render.com/upkeep_db
```

**Lesson:** Database tools have different URL format requirements. Document all formats needed.

### 2. TypeScript Path Aliases in Production

**The Problem That Cost 3 Hours**

TypeScript aliases (`@domain/*`, `@validators/*`) work in development but fail in production:
```
Error: Cannot find module '@domain/entities'
```

**Why It Happens:**
- TypeScript aliases are compile-time features
- Node.js doesn't understand them at runtime
- `ts-node-dev` handles this in development, but not in production

**The Solution:**

1. Move `tsconfig-paths` to production dependencies:
```json
"dependencies": {
  "tsconfig-paths": "^4.2.0"  // NOT in devDependencies!
}
```

2. Update start command:
```json
"start": "node -r tsconfig-paths/register dist/server.js"
```

**Lesson:** Development tools that "just work" often need explicit production configuration.

### 3. GitHub Secrets: Environment vs Repository

**The Problem That Cost 2 Hours**

GitHub Actions couldn't find secrets despite them being clearly defined:
```
Error: Context access might be invalid: RENDER_DATABASE_URL
```

**Why It Happens:**
- Using `environment: production` in workflow requires Environment Secrets
- Repository Secrets are completely ignored when environment is specified
- No clear error message indicating where to look

**The Solution:**

Navigate to: **Settings → Environments → production → Environment secrets**

NOT: **Settings → Secrets and variables → Actions**

**Lesson:** GitHub has multiple secret scopes. Environment protection requires environment secrets.

## 🟡 Module System Challenges

### The CommonJS vs ESM Battle

**The Setup:**
- Backend: Node.js with CommonJS (`require/module.exports`)
- Frontend: Vite with ES Modules (`import/export`)
- Shared libraries: Need to work with both

**The Problems:**

1. **Shared libraries with `"type": "module"`** break the backend
2. **Shared libraries without it** might break frontend builds
3. **Mixed module systems** cause cryptic errors

**The Working Solution:**

```json
// libs/*/package.json
{
  "name": "@upkeep-io/domain",
  // DO NOT add "type": "module" here!
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

```json
// libs/*/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",  // Frontend-friendly
    "target": "ES2020"   // Node-compatible
  }
}
```

**Why This Works:**
- Both apps import TypeScript source directly
- No runtime module conflicts
- Each app compiles with its own module system

**Lesson:** The 2024 JavaScript ecosystem still struggles with module systems. Choose one approach and document it thoroughly.

## 🟢 Docker and Dependencies

### Alpine Linux Missing Libraries

**The Problem:**
```dockerfile
FROM node:18-alpine  # Seems efficient!
```
Results in:
```
Error: libssl.so.1.1: cannot open shared object file
```

**Why:**
- Alpine uses musl libc, not glibc
- Many Node packages expect glibc
- Prisma specifically needs OpenSSL libraries

**The Solution:**
```dockerfile
FROM node:18-slim  # Debian-based, has glibc

RUN apt-get update && apt-get install -y openssl
```

**Lesson:** Alpine's size savings aren't worth the compatibility headaches for Node.js apps.

### Prisma Binary Targets

**The Problem:**
Prisma generates platform-specific binaries. Local Mac binaries don't work in Linux containers.

**The Solution:**
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

**Lesson:** Always specify multiple binary targets for cross-platform compatibility.

## 🔵 Render-Specific Configurations

### Build Command Must Include Dev Dependencies

**The Problem:**
TypeScript types (`@types/*`) are needed during build but are devDependencies.

**The Solution:**
```bash
# Render Build Command
npm ci --include=dev  # NOT just npm ci
```

**Lesson:** Cloud providers may not install devDependencies by default.

### Start Command Source of Truth

**The Gotcha:**
Render uses its dashboard setting, not package.json:

```bash
# In Render Dashboard (this wins)
cd apps/backend && npm start

# In package.json (ignored by Render)
"start": "node dist/server.js"
```

**Lesson:** Platform configurations override repository configurations.

### Monorepo Deployment Order

**Critical Build Sequence:**
```bash
# Must build in dependency order
npm run build --workspace=libs/domain      # 1st: Shared types
npm run build --workspace=libs/validators  # 2nd: Shared validation
npm run build --workspace=libs/auth        # 3rd: Shared auth
npx prisma generate                        # 4th: Database client
npm run build --workspace=apps/backend     # Last: Application
```

**Lesson:** Dependency order matters in monorepo builds.

## 📊 Time Cost Analysis

| Issue | Debug Time | Could Have Been |
|-------|------------|-----------------|
| Database URL format | 4 hours | 5 minutes with docs |
| TypeScript aliases | 3 hours | 10 minutes with docs |
| GitHub secrets location | 2 hours | 2 minutes with docs |
| Module system issues | 3 hours | 30 minutes with clear strategy |
| Docker Alpine issues | 2 hours | 0 minutes (use Debian) |
| Prisma binaries | 1 hour | 5 minutes with config |
| **Total** | **15 hours** | **~1 hour** |

## ✅ Deployment Checklist

Before deploying a Node.js monorepo to Render:

### Pre-Deployment
- [ ] Document all database URL formats needed
- [ ] Move runtime dependencies out of devDependencies
- [ ] Configure Prisma binary targets
- [ ] Test production build locally
- [ ] Document module system strategy

### Render Configuration
- [ ] Use Debian-based Docker images
- [ ] Build command includes `--include=dev`
- [ ] Start command navigates to correct directory
- [ ] Environment variables set (not just in .env)
- [ ] CORS_ORIGIN configured for frontend URL

### GitHub Actions
- [ ] Secrets in Environment Secrets (not Repository)
- [ ] Database URLs in correct format
- [ ] Manual approval for migrations
- [ ] Build order respects dependencies

### Post-Deployment
- [ ] Test health endpoint
- [ ] Verify database connectivity
- [ ] Check TypeScript path resolution
- [ ] Confirm environment variables loaded
- [ ] Test a full user flow

## 🎯 Key Takeaways

### What Worked Well
- **Manual migration approval** - Saved us from bad migrations
- **Render's auto-deploy** - Push to main = deployed
- **Health checks** - Quick verification of deployment
- **Separate services** - Backend/frontend independence

### What We'd Do Differently
1. **Start with integration tests** - Would have caught module issues
2. **Document deployment immediately** - Not after struggling
3. **Use standard module system** - Pick one, stick to it
4. **Test production build in CI** - Before attempting deployment
5. **Use simpler Docker base** - Debian from the start

## 💡 Universal Deployment Truths

1. **Production is a different world** - What works locally may not work deployed
2. **Module systems are still painful** - In 2024, this shouldn't be true, but it is
3. **Platform docs lie by omission** - They assume happy paths
4. **Errors messages mislead** - The real issue is often 2-3 layers deeper
5. **Document immediately** - You will forget the exact fix

## 🔮 Future Considerations

### For Next Project
- Start with deployment CI from day one
- Choose either CommonJS or ESM, not both
- Integration test the deployment process
- Use managed services when possible
- Keep deployment docs in the repo

### For This Project
- Add deployment smoke tests
- Consider migration to full ESM
- Add deployment rollback procedures
- Implement zero-downtime deployments
- Add performance monitoring

---

## Final Word

> *"Every deployment issue you encounter is a lesson learned. Every lesson documented is a future hour saved. This document represents 15 hours of debugging condensed into 15 minutes of reading."*

These deployment lessons were learned the hard way. May your deployments be smoother for having read them.

**Remember:** When deployment fails mysteriously, check:
1. URL formats
2. Module systems
3. Secret locations
4. Dependency classifications
5. Platform-specific settings

The answer is usually in one of these.