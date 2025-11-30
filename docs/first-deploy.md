# First Deployment to Render

Date: 2025-11-30

## Overview

This document captures the initial deployment of the Property Manager application to Render.com, including domain setup, email configuration, and lessons learned from extensive debugging.

## Prerequisites Completed

- Story 1.8: CI/CD Pipeline and Initial Deployment was completed
- GitHub Actions CI/CD workflows created
- Docker images optimized for production
- Health check endpoints implemented
- render.yaml blueprint created

## Production URLs

| Service | URL |
|---------|-----|
| API | https://property-manager-api-d2zl.onrender.com |
| Frontend | https://property-manager-web.onrender.com |

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
| Static Site | `free` | N/A (changed to Docker) |
| PostgreSQL | `free`/`starter` | `basic-256mb` |

**Key Learning:** Render changed PostgreSQL to "flexible plans" in October 2024. Legacy plans (`starter`, `standard`, `pro`) are no longer available for new databases. Use new format: `basic-256mb`, `basic-1gb`, `basic-4gb`, etc.

**References:**
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Flexible Plans for Render Postgres](https://render.com/docs/postgresql-refresh)
- [Render Pricing](https://render.com/pricing)

### 3. PostgreSQL Connection String Format Mismatch

**Error:**
```
System.ArgumentException: Format of the initialization string does not conform to specification starting at index 0.
```

**Root Cause:** Render provides PostgreSQL connection strings in URI format, but .NET/Npgsql expects a different format:

| Format | Example |
|--------|---------|
| Render (URI) | `postgresql://user:password@host/database` |
| .NET (Npgsql) | `Host=host;Port=5432;Database=database;Username=user;Password=password` |

**Solution:** Added a helper function in `Program.cs` to convert between formats:

```csharp
static string ConvertPostgresConnectionString(string connectionString)
{
    if (connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase))
        return connectionString;

    // Parse URI format: postgres://user:password@host[:port]/database
    var pattern = @"^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)$";
    var match = Regex.Match(connectionString, pattern);

    if (match.Success)
    {
        var user = match.Groups[1].Value;
        var password = match.Groups[2].Value;
        var host = match.Groups[3].Value;
        var port = match.Groups[4].Success ? match.Groups[4].Value : "5432";
        var database = match.Groups[5].Value;

        return $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }
    return connectionString;
}
```

**Important:** Render often omits the port from connection strings. The regex must handle optional port (defaults to 5432).

### 4. Frontend API Proxy Not Working (Static Site)

**Error:** Registration requests from frontend never reached the API. No logs in API.

**Root Cause:** Frontend was deployed as a Render Static Site, but static sites don't support proxying. The Angular app uses relative URLs (`/api/v1/auth/...`) which need to be proxied to the backend.

**Solution:** Changed frontend from Static Site to Docker Web Service with nginx:

1. Updated `frontend/Dockerfile` to use environment variable substitution:
```dockerfile
ENV API_URL=http://api:8080
CMD envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'
```

2. Updated `nginx.conf` to use `${API_URL}` variable:
```nginx
location /api {
    proxy_pass ${API_URL};
    proxy_ssl_server_name on;
    # ... other proxy settings
}
```

3. Updated `render.yaml` to deploy frontend as Docker:
```yaml
- type: web
  name: property-manager-web
  runtime: docker
  dockerfilePath: ./frontend/Dockerfile
  dockerContext: ./frontend
  envVars:
    - key: API_URL
      value: https://property-manager-api-d2zl.onrender.com
```

**Cost Impact:** Frontend changed from free (static) to ~$7/mo (starter Docker).

### 5. SendGrid Sender Identity Error

**Error:**
```
The from address does not match a verified Sender Identity
```

**Solution:** In SendGrid, you must verify the sender email address:
1. Go to **Settings** → **Sender Authentication** → **Verify a Single Sender**
2. Add `noreply@upkeep-io.dev` as a verified sender
3. Complete the verification process

### 6. Email Environment Variable Name Mismatch

**Error:** Emails not sending despite SendGrid being configured.

**Root Cause:** The `EmailSettings.cs` class uses `FromEmail`, but we configured `Email__FromAddress` in Render.

| Wrong | Correct |
|-------|---------|
| `Email__FromAddress` | `Email__FromEmail` |

**Lesson:** Always check the actual property names in settings classes when configuring environment variables.

### 7. SSL Not Enabled for SendGrid

**Error:** Email sending failed silently or with connection errors.

**Solution:** Add `Email__EnableSsl=true` to environment variables. SendGrid requires SSL on port 587.

### 8. Email Verification Links Point to localhost

**Error:** Verification emails contained `http://localhost:4200/verify-email?token=...`

**Root Cause:** `Email__BaseUrl` not configured, defaults to `http://localhost:4200`.

**Solution:** Add environment variable:
```
Email__BaseUrl=https://property-manager-web.onrender.com
```

### 9. DataGrip PostgreSQL Connection Issues

**Error:** `Unable to reconfigure connection to the database postgres`

**Root Cause:** Render's managed PostgreSQL only gives access to your specific database, not the default `postgres` database. DataGrip tries to introspect `postgres` by default.

**Solution:**
1. In DataGrip connection settings, set the database to `propertymanager` (not `postgres`)
2. Enable SSL: add `sslmode=require` in Advanced settings
3. Use the external connection URL

**PostgreSQL Case Sensitivity:** Tables created by EF Core are quoted and case-sensitive:
```sql
-- Wrong (lowercase)
SELECT * FROM AspNetUsers;

-- Correct (quoted)
SELECT * FROM "AspNetUsers";
```

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
| `Email__FromEmail` | `noreply@upkeep-io.dev` |
| `Email__EnableSsl` | `true` |
| `Email__BaseUrl` | `https://property-manager-web.onrender.com` |

**Important:** The SMTP username is literally the word `apikey`, not the name you gave the API key in SendGrid.

## Complete Render Environment Variables

### API Service (property-manager-api)

| Variable | Value | Notes |
|----------|-------|-------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Auto-set |
| `ConnectionStrings__Default` | (from database) | Auto-set via `fromDatabase` |
| `Jwt__Secret` | (auto-generated) | Auto-generated |
| `Jwt__Issuer` | `https://property-manager-api-d2zl.onrender.com` | Manual |
| `Jwt__Audience` | `https://property-manager-web.onrender.com` | Manual |
| `Jwt__ExpiryMinutes` | `60` | Auto-set |
| `Email__Provider` | `Smtp` | Auto-set |
| `Email__FromEmail` | `noreply@upkeep-io.dev` | Manual |
| `Email__FromName` | `Property Manager` | Auto-set |
| `Email__SmtpHost` | `smtp.sendgrid.net` | Manual |
| `Email__SmtpPort` | `587` | Manual |
| `Email__SmtpUsername` | `apikey` | Manual |
| `Email__SmtpPassword` | `SG.xxxxx...` | Manual (secret) |
| `Email__EnableSsl` | `true` | Manual |
| `Email__BaseUrl` | `https://property-manager-web.onrender.com` | Manual |

### Frontend Service (property-manager-web)

| Variable | Value |
|----------|-------|
| `API_URL` | `https://property-manager-api-d2zl.onrender.com` |

## Render Services Created

| Service | Type | Plan | Estimated Cost |
|---------|------|------|----------------|
| property-manager-api | Web Service (Docker) | starter | ~$7/mo |
| property-manager-web | Web Service (Docker) | starter | ~$7/mo |
| property-manager-db | PostgreSQL | basic-256mb | ~$7/mo |

**Total estimated cost:** ~$21/month

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
    envVars:
      - key: ASPNETCORE_ENVIRONMENT
        value: Production
      - key: ConnectionStrings__Default
        fromDatabase:
          name: property-manager-db
          property: connectionString
      - key: Jwt__Secret
        generateValue: true
      - key: Jwt__Issuer
        sync: false
      - key: Jwt__Audience
        sync: false
      - key: Jwt__ExpiryMinutes
        value: "60"
      - key: Email__Provider
        value: Smtp
      - key: Email__FromEmail
        sync: false
      - key: Email__FromName
        value: Property Manager
      - key: Email__SmtpHost
        sync: false
      - key: Email__SmtpPort
        sync: false
      - key: Email__EnableSsl
        value: "true"
      - key: Email__SmtpUsername
        sync: false
      - key: Email__SmtpPassword
        sync: false

  # Frontend Web Service (Docker with nginx proxy)
  - type: web
    name: property-manager-web
    runtime: docker
    dockerfilePath: ./frontend/Dockerfile
    dockerContext: ./frontend
    region: oregon
    plan: starter
    healthCheckPath: /health
    envVars:
      - key: API_URL
        value: https://property-manager-api-d2zl.onrender.com

databases:
  - name: property-manager-db
    databaseName: propertymanager
    user: propertymanager
    region: oregon
    plan: basic-256mb
    ipAllowList: []
```

## Database Connection

### External Connection (for tools like DataGrip, psql)
```
postgresql://propertymanager:<password>@dpg-d4ma778dl3ps73afda20-a.oregon-postgres.render.com/propertymanager?sslmode=require
```

### Useful SQL Commands
```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Check migrations
SELECT * FROM "__EFMigrationsHistory";

-- Check users (use quotes for case-sensitive names)
SELECT "Email", "EmailConfirmed" FROM "AspNetUsers";

-- Clear all users (for testing)
TRUNCATE "RefreshTokens", "AspNetUserTokens", "AspNetUserLogins",
         "AspNetUserClaims", "AspNetUserRoles", "AspNetUsers" CASCADE;
```

## Post-Deployment Checklist

- [x] Verify API health check: `GET /api/v1/health`
- [x] Verify database connectivity: `GET /api/v1/health/ready`
- [x] Test user registration flow
- [x] Verify email verification works
- [ ] Test login/logout flow
- [ ] Test password reset flow
- [ ] Verify frontend loads with Forest Green theme
- [ ] Configure GitHub secrets for CD webhooks:
  - `RENDER_DEPLOY_HOOK_API`
  - `RENDER_DEPLOY_HOOK_WEB`
  - `PRODUCTION_API_URL`

## Debugging Tips

1. **Check API Logs First:** Render dashboard → Service → Logs
2. **Test API Directly:** Use curl to bypass frontend and test API endpoints
3. **Verify Environment Variables:** Double-check property names match your settings classes
4. **Clear Build Cache:** When changes don't seem to take effect, use "Clear build cache & deploy"
5. **Check SendGrid Activity:** Activity Feed shows if emails are sent, blocked, or bounced

## Future Considerations

1. **Custom Domain:** Configure `upkeep-io.dev` to point to Render services
2. **SSL:** Render provides automatic SSL for custom domains
3. **Scaling:** Upgrade plans as needed for production traffic
4. **Monitoring:** Set up alerts for health check failures
5. **Email Templates:** Consider using SendGrid's template system for better email management
