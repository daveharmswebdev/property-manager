# TypeScript Configuration Guide

This document explains the TypeScript configuration structure for the upkeep-io monorepo.

## Overview

The monorepo uses a layered TypeScript configuration approach with three base configs to support different module systems and compilation targets across backend (Node.js/CommonJS), frontend (Vite/ES Modules), and shared libraries.

## Configuration Structure

```
upkeep-io/
├── tsconfig.json                  # Legacy root config (kept for compatibility)
├── tsconfig.base.json             # Shared base configuration
├── tsconfig.backend.json          # CommonJS config for Node.js
├── tsconfig.frontend.json         # ES Module config for Vite/Vue
├── apps/
│   ├── backend/tsconfig.json      # Extends tsconfig.backend.json
│   └── frontend/tsconfig.json     # Extends @vue/tsconfig + custom paths
└── libs/
    ├── auth/tsconfig.json         # Extends tsconfig.base.json + ESNext
    ├── domain/tsconfig.json       # Extends tsconfig.base.json + ESNext
    └── validators/tsconfig.json   # Extends tsconfig.base.json + ESNext
```

## Base Configurations

### tsconfig.base.json

**Purpose:** Shared compiler options for all packages

**Key Settings:**
- `target: "ES2022"` - Modern JavaScript features
- `moduleResolution: "node"` - Standard Node.js resolution
- `strict: true` - All strict type checking enabled
- Path aliases for shared libraries (`@domain/*`, `@validators/*`, `@auth/*`)

**Used By:** Backend, shared libraries

### tsconfig.backend.json

**Purpose:** Node.js/Express backend with CommonJS modules

**Key Settings:**
- `extends: "./tsconfig.base.json"`
- `module: "commonjs"` - Required for Node.js with ts-node-dev
- `experimentalDecorators: true` - For inversify dependency injection
- `emitDecoratorMetadata: true` - For inversify runtime type information

**Used By:** `apps/backend/`

### tsconfig.frontend.json

**Purpose:** Vite/Vue frontend with ES Modules

**Key Settings:**
- `extends: "./tsconfig.base.json"`
- `module: "ESNext"` - Modern ES Module syntax
- `outDir: "./dist"`

**Note:** The actual frontend config extends `@vue/tsconfig/tsconfig.dom.json` for Vue-specific settings, not `tsconfig.frontend.json`. The frontend config exists for potential future non-Vue frontends.

## Module System Strategy

### The CommonJS/ESM Challenge

**Problem:**
- Backend runs with `ts-node-dev` which uses CommonJS (`require()`)
- Frontend runs with Vite which expects ES Modules (`import/export`)
- Shared libraries need to work with both

**Solution:**
1. **Shared libraries compile to ES Modules** (`module: "ESNext"`) for optimal tree-shaking and modern tooling
2. **Shared libraries DO NOT declare `"type": "module"`** in package.json - this allows the TypeScript source to be imported by CommonJS backend via ts-node-dev
3. **Backend uses ts-node-dev with tsconfig-paths** to directly import TypeScript source from shared libraries
4. **Frontend uses Vite aliases** pointing to shared library `src/` directories (not compiled `dist/`)

### Why This Works

```typescript
// Backend (CommonJS runtime, TypeScript source)
// ts-node-dev transpiles on-the-fly, doesn't care about package.json "type"
import { Property } from '@domain/entities'; // → libs/domain/src/entities/Property.ts

// Frontend (ESM runtime, TypeScript source)
// Vite bundles TypeScript directly, uses path aliases
import { Property } from '@domain/entities'; // → libs/domain/src/entities/Property.ts
```

Both apps import the **same TypeScript source code**, but compile it differently:
- Backend: CommonJS output via ts-node-dev
- Frontend: ES Modules output via Vite

## Common Issues & Solutions

### Issue: "Must use import to load ES Module"

**Symptom:** Backend fails to start with ES Module error when importing from shared libraries

**Cause:** Shared library has `"type": "module"` in package.json, forcing Node.js to treat all `.js` files as ES Modules

**Solution:** Remove `"type": "module"` from all `libs/*/package.json` files

```json
// ❌ Don't do this in shared libraries
{
  "name": "@upkeep-io/domain",
  "type": "module",  // Remove this line
  "main": "dist/index.js"
}

// ✅ Do this instead
{
  "name": "@upkeep-io/domain",
  "main": "dist/index.js"
}
```

### Issue: Stale .js files in libs/*/src/

**Symptom:** ES Module errors even after removing `"type": "module"`

**Cause:** Compiled `.js` files exist in source directories and confuse Node.js module resolution

**Solution:** Delete all compiled files from source directories

```bash
find libs -path "*/src/*.js" -delete
find libs -path "*/src/*.d.ts" -delete
```

**Prevention:** The `.gitignore` already excludes these files:
```gitignore
libs/*/src/**/*.js
libs/*/src/**/*.d.ts
```

### Issue: vue-tsc compatibility errors

**Symptom:** `Search string not found: "/supportedTSExtensions = .*(?=;)/"`

**Cause:** Version mismatch between `vue-tsc` and TypeScript

**Solution:**
- TypeScript 5.4+ requires vue-tsc 2.x
- Update `apps/frontend/package.json`:
  ```json
  {
    "devDependencies": {
      "vue-tsc": "^2.0.0"
    }
  }
  ```

### Issue: Vite can't resolve shared library imports

**Symptom:** Module not found errors in frontend dev server

**Cause:** Vite alias paths don't match tsconfig paths

**Solution:** Ensure `apps/frontend/vite.config.ts` aliases point to `src/` directories:

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('../../libs/domain/src', import.meta.url)),
      '@validators': fileURLToPath(new URL('../../libs/validators/src', import.meta.url)),
      '@auth': fileURLToPath(new URL('../../libs/auth/src', import.meta.url)),
    }
  }
});
```

## Build Process

### Development

**Backend:**
```bash
npm run dev:backend
# Uses ts-node-dev with tsconfig-paths
# Transpiles TypeScript on-the-fly from apps/backend/src and libs/*/src
```

**Frontend:**
```bash
npm run dev --workspace=apps/frontend
# Uses Vite dev server
# Bundles TypeScript directly from apps/frontend/src and libs/*/src
```

### Production Build

```bash
npm run build
# Builds all workspaces in parallel:
# - apps/backend → dist/ (CommonJS)
# - apps/frontend → dist/ (ES Modules, optimized bundles)
# - libs/auth → dist/ (ES Modules)
# - libs/domain → dist/ (ES Modules)
# - libs/validators → dist/ (ES Modules)
```

**Note:** In production, the backend could be updated to use the compiled `dist/` outputs from shared libraries instead of importing TypeScript source, but the current setup works for both development and production.

## TypeScript Compiler Options Reference

### Critical Settings for inversify (Backend)

```json
{
  "experimentalDecorators": true,     // Enable @injectable(), @inject() decorators
  "emitDecoratorMetadata": true       // Emit design-time type info for DI
}
```

**Why:** inversify uses decorators for dependency injection. Without these settings, the DI container won't work.

**Example:**
```typescript
@injectable()
export class CreatePropertyUseCase {
  constructor(
    @inject('IPropertyRepository') private propertyRepo: IPropertyRepository
  ) {}
}
```

### Path Aliases

All configs include path aliases for shared libraries:

```json
{
  "baseUrl": ".",
  "paths": {
    "@domain/*": ["libs/domain/src/*"],
    "@validators/*": ["libs/validators/src/*"],
    "@auth/*": ["libs/auth/src/*"]
  }
}
```

**Backend:** Resolved by `tsconfig-paths/register` at runtime
**Frontend:** Resolved by Vite alias configuration
**Tests:** Resolved by jest/vitest configuration

## Migration Notes

### From Previous Setup

**What Changed (Nov 2024):**

1. **Created base configs** for better separation:
   - `tsconfig.base.json` - shared settings
   - `tsconfig.backend.json` - CommonJS for Node.js
   - `tsconfig.frontend.json` - ES Modules for Vite

2. **Removed `"type": "module"`** from all `libs/*/package.json` files to fix ES Module errors

3. **Upgraded frontend dependencies:**
   - `vue-tsc`: 1.8.27 → 2.0.0 (compatible with TypeScript 5.9+)

4. **Fixed Vite aliases** to point to `src/` instead of `dist/`

5. **Created `apps/frontend/src/env.d.ts`** for Vite type definitions

### Why Not Full ES Modules?

We considered converting the entire monorepo to ES Modules (`"type": "module"` everywhere), but decided against it because:

1. **ts-node-dev** has limited ES Module support - would require migration to `tsx` or `ts-node --esm`
2. **inversify** works better with CommonJS and decorators
3. **Current hybrid approach works** - no need to change what's not broken
4. **Allows incremental migration** - can switch to full ESM in the future if needed

## Best Practices

1. **Never commit compiled files in `libs/*/src/`** - only TypeScript source should be in src/
2. **Keep shared libraries module-agnostic** - don't add `"type": "module"` to their package.json
3. **Match Vite aliases to tsconfig paths** - always point to the same `src/` directories
4. **Use consistent TypeScript version** across all packages (currently 5.9.3)
5. **Run `npm run build` before pushing** to catch type errors in both apps
6. **Update both tsconfig AND vite.config** when adding new shared libraries

## Troubleshooting Checklist

If you encounter build errors:

- [ ] Run `npm install` after pulling changes
- [ ] Delete `node_modules` and `package-lock.json`, then `npm install`
- [ ] Check for stale `.js` files in `libs/*/src/`: `find libs -path "*/src/*.js"`
- [ ] Verify all `libs/*/package.json` files do NOT have `"type": "module"`
- [ ] Ensure TypeScript versions match across all packages
- [ ] Check that Vite aliases match tsconfig paths (both point to `src/`)
- [ ] Look for missing `env.d.ts` in frontend (needed for Vite types)
- [ ] Verify backend has `experimentalDecorators` and `emitDecoratorMetadata` enabled

## Further Reading

- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Vite TypeScript Support](https://vitejs.dev/guide/features.html#typescript)
- [inversify Documentation](https://inversify.io/)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
