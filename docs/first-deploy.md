# First Deployment to Render

Date: 2025-11-30

## Overview

This document captures the initial deployment of the Property Manager application to Render.com, including domain setup, email configuration, and lessons learned.

## Prerequisites Completed

- Story 1.8: CI/CD Pipeline and Initial Deployment was completed
- GitHub Actions CI/CD workflows created
- Docker images optimized for production
- Health check endpoints implemented
- render.yaml blueprint created

## Issues Encountered and Resolutions

### 1. Git Push Rejected for Workflow Files

**Error:**
```
! [remote rejected] master -> master (refusing to allow an OAuth App to create or update workflow `.github/workflows/cd.yml` without `workflow` scope)
```

**Solution:** Switch to SSH authentication or create a Personal Access Token with `workflow` scope.

```bash
# SSH approach
git remote set-url origin git@github.com:daveharmswebdev/property-manager.git
```

### 2. Render Plan Names Updated

**Error:** Render Blueprint validation failed - legacy plan names no longer valid.

**Resolution:** Updated `render.yaml` with current plan names:

| Service | Old Plan | New Plan |
|---------|----------|----------|
| API (web service) | `free` | `starter` |
| Static Site | `free` | (removed - static sites are free) |
| PostgreSQL | `free`/`starter` | `basic-256mb` |

**Key Learning:** Render changed PostgreSQL to "flexible plans" in October 2024. Legacy plans (`starter`, `standard`, `pro`) are no longer available for new databases. Use new format: `basic-256mb`, `basic-1gb`, `basic-4gb`, etc.

**References:**
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Flexible Plans for Render Postgres](https://render.com/docs/postgresql-refresh)
- [Render Pricing](https://render.com/pricing)

### 3. Email Provider Setup

**Challenge:** SendGrid requires domain verification for sending emails.

**Solution:** Registered domains:
- `upkeep-io.dev` (primary)
- `upkeep-io.com` (backup)

## Domain DNS Configuration (Namecheap)

Added the following DNS records for SendGrid authentication:

| Type | Host | Value |
|------|------|-------|
| CNAME | `em3558` | `u57658848.wl099.sendgrid.net` |
| CNAME | `s1._domainkey` | `s1.domainkey.u57658848.wl099.sendgrid.net` |
| CNAME | `s2._domainkey` | `s2.domainkey.u57658848.wl099.sendgrid.net` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

**Note:** In Namecheap, only enter the subdomain in the "Host" field (e.g., `em3558` not `em3558.upkeep-io.dev`).

## SendGrid SMTP Configuration

| Variable | Value |
|----------|-------|
| `Email__SmtpHost` | `smtp.sendgrid.net` |
| `Email__SmtpPort` | `587` |
| `Email__SmtpUsername` | `apikey` (literal string) |
| `Email__SmtpPassword` | SendGrid API key (starts with `SG.`) |
| `Email__FromAddress` | `noreply@upkeep-io.dev` |

**Important:** The SMTP username is literally the word `apikey`, not the name you gave the API key in SendGrid.

## Render Environment Variables

### Auto-configured by Blueprint:
- `ASPNETCORE_ENVIRONMENT` = `Production`
- `ConnectionStrings__Default` (from database)
- `Jwt__Secret` (auto-generated)
- `Jwt__ExpiryMinutes` = `60`
- `Email__Provider` = `Smtp`
- `Email__FromName` = `Property Manager`

### Manually configured:
- `Jwt__Issuer` = API service URL
- `Jwt__Audience` = Frontend service URL
- `Email__FromAddress` = `noreply@upkeep-io.dev`
- `Email__SmtpHost` = `smtp.sendgrid.net`
- `Email__SmtpPort` = `587`
- `Email__SmtpUsername` = `apikey`
- `Email__SmtpPassword` = SendGrid API key

## Render Services Created

| Service | Type | Plan | Estimated Cost |
|---------|------|------|----------------|
| property-manager-api | Web Service (Docker) | starter | ~$7/mo |
| property-manager-web | Static Site | free | $0 |
| property-manager-db | PostgreSQL | basic-256mb | ~$7/mo |

**Total estimated cost:** ~$14/month

## Final render.yaml Configuration

```yaml
services:
  # Backend API Service
  - type: web
    name: property-manager-api
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    region: oregon
    plan: starter
    healthCheckPath: /api/v1/health
    # ... environment variables

  # Frontend Static Site
  - type: web
    name: property-manager-web
    runtime: static
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: frontend/dist/property-manager/browser
    # No plan field - static sites are free

databases:
  - name: property-manager-db
    databaseName: propertymanager
    user: propertymanager
    region: oregon
    plan: basic-256mb
```

## Post-Deployment Checklist

- [ ] Verify API health check: `GET /api/v1/health`
- [ ] Verify database connectivity: `GET /api/v1/health/ready`
- [ ] Test user registration flow
- [ ] Verify email verification works
- [ ] Test login/logout flow
- [ ] Test password reset flow
- [ ] Verify frontend loads with Forest Green theme
- [ ] Configure GitHub secrets for CD webhooks:
  - `RENDER_DEPLOY_HOOK_API`
  - `RENDER_DEPLOY_HOOK_WEB`
  - `PRODUCTION_API_URL`

## Future Considerations

1. **Custom Domain:** Configure `upkeep-io.dev` to point to Render services
2. **SSL:** Render provides automatic SSL for custom domains
3. **Scaling:** Upgrade plans as needed for production traffic
4. **Monitoring:** Set up alerts for health check failures
