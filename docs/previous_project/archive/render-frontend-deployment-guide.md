# Frontend Deployment Guide for Render

**Backend Status:** ✅ Live at https://upkeep-io.onrender.com
**Next Step:** Deploy Vue 3 Frontend

## Pre-Deployment Tasks

### 1. Update Frontend Environment Configuration

Create production environment file:
```bash
# apps/frontend/.env.production
VITE_API_URL=https://upkeep-io.onrender.com/api
```

### 2. Test Frontend with Production Backend

```bash
# Test locally with production API
cd apps/frontend
npm run build  # Ensure it builds without errors
npm run preview  # Test the production build locally
```

### 3. Verify API Endpoints

Test that the backend is responding:
```bash
curl https://upkeep-io.onrender.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

## Render Static Site Configuration

### Step 1: Create New Static Site Service

1. Go to Render Dashboard
2. Click "New +" → "Static Site"
3. Connect to GitHub repository: `daveharmswebdev/upkeep-io`

### Step 2: Configure Build Settings

**Name:** `upkeep-io-frontend` (or your preferred name)

**Branch:** `main`

**Root Directory:** *(Leave blank - monorepo)*

**Build Command:**
```bash
cd apps/frontend && npm ci && npm run build
```

**Publish Directory:**
```bash
apps/frontend/dist
```

### Step 3: Environment Variables

Add these environment variables in Render:
- `NODE_VERSION`: `18`
- `VITE_API_URL`: `https://upkeep-io.onrender.com/api`

### Step 4: Deploy

Click "Create Static Site" to start the deployment.

## Post-Deployment Tasks

### 1. Update Backend CORS Settings

Once your frontend is deployed and you have the URL (e.g., `https://upkeep-io-frontend.onrender.com`):

1. Go to backend service in Render
2. Update environment variable:
   - `CORS_ORIGIN`: `https://upkeep-io-frontend.onrender.com`
3. Backend will auto-redeploy with new CORS settings

### 2. Update Frontend API URL (if needed)

If the backend URL changes:
1. Update `VITE_API_URL` in frontend environment variables
2. Trigger a redeploy

### 3. Test Full Stack Integration

Test critical user flows:
```bash
# 1. Check frontend loads
curl https://upkeep-io-frontend.onrender.com

# 2. Test authentication flow
# - Sign up
# - Login
# - Access protected routes

# 3. Test CRUD operations
# - Create a property
# - View property list
# - Update property
# - Delete property
```

## Deployment Verification Checklist

- [ ] Frontend builds without errors
- [ ] Static files served correctly
- [ ] API calls reach backend
- [ ] CORS headers allow frontend origin
- [ ] Authentication flow works
- [ ] Protected routes redirect properly
- [ ] Forms submit successfully
- [ ] Error handling displays correctly

## Common Issues & Solutions

### Issue 1: API calls failing with CORS errors

**Solution:** Verify `CORS_ORIGIN` on backend matches frontend URL exactly (including https://)

### Issue 2: 404 errors on page refresh (Vue Router)

**Solution:** Add `_redirects` file to `apps/frontend/public/`:
```
/*    /index.html   200
```

### Issue 3: Environment variables not working

**Solution:**
- Ensure variables start with `VITE_`
- Rebuild after changing environment variables
- Check variables are loaded: `console.log(import.meta.env)`

### Issue 4: Build failing on Render

**Solution:**
- Check Node version compatibility
- Ensure all dependencies are in package.json
- Verify build command syntax

## Frontend Build Optimization

### Current Build Output
- HTML: ~0.5 KB
- CSS: ~33 KB (6 KB gzipped)
- JavaScript: ~292 KB (96 KB gzipped)
- Fonts: ~4.5 MB (can be optimized)

### Optimization Opportunities
1. **Font Loading:** Consider using system fonts or web font loader
2. **Code Splitting:** Implement route-based code splitting
3. **Image Optimization:** Use WebP format and lazy loading
4. **Tree Shaking:** Review imports to remove unused code

## Monitoring & Maintenance

### Performance Monitoring
- Render provides basic metrics
- Consider adding Google Analytics or similar
- Monitor Core Web Vitals

### Error Tracking
- Add error boundary components
- Consider Sentry or similar for production error tracking
- Log API errors appropriately

### Security Headers
Add to `apps/frontend/public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer-when-downgrade
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Estimated Costs

- **Static Site:** Free tier (100 GB bandwidth/month)
- **Custom Domain:** Free with Render
- **SSL Certificate:** Free (auto-provisioned)
- **Total Frontend Cost:** $0/month

## Next Steps After Deployment

1. **Configure Custom Domain**
   - Add domain in Render dashboard
   - Update DNS records
   - Update CORS settings

2. **Set Up CI/CD**
   - Auto-deploy on push to main
   - Add build status badges
   - Configure preview deployments

3. **Performance Optimization**
   - Enable CDN
   - Implement caching strategies
   - Optimize bundle size

4. **Monitoring Setup**
   - Add uptime monitoring
   - Configure alerts
   - Track user analytics

## Quick Commands Reference

```bash
# Local development
npm run dev --workspace=apps/frontend

# Build for production
npm run build --workspace=apps/frontend

# Preview production build
npm run preview --workspace=apps/frontend

# Type checking
npm run type-check --workspace=apps/frontend

# Linting
npm run lint --workspace=apps/frontend
```

## Support Resources

- [Render Static Sites Documentation](https://render.com/docs/static-sites)
- [Vue 3 Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Document Created:** 2025-11-22 21:52:00 UTC
**Status:** Ready for Frontend Deployment
**Backend URL:** https://upkeep-io.onrender.com