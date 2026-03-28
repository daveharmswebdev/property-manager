# Epic 14: Security Hardening & Observability

**Author:** Dave
**Date:** 2026-02-07
**Project Level:** low (web application)
**Target Scale:** 14 rental properties, single user MVP

---

## Overview

This epic addresses the remaining Phase 1 pre-production gates for Security Hardening and Observability. Investigation of the codebase revealed that 9 of the original checklist items are already implemented (token refresh, account lockout, session timeout, HTTPS, SQL injection protection, XSS protection, CSRF protection, structured logging, and log levels). This epic covers the **5 remaining gaps** that must be closed before beta users touch the app.

**All 5 stories are independent and can be parallelized.**

| Story | Name | Category |
|-------|------|----------|
| 14.1 | CORS Configuration | Security |
| 14.2 | Security Headers Middleware | Security |
| 14.3 | API Rate Limiting | Security |
| 14.4 | Backend Sentry Integration | Observability |
| 14.5 | Frontend Sentry Integration | Observability |

**Pre-Production Checklist Items Addressed:**
- [ ] CORS properly restricted to known origins (§2)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options) (§2)
- [ ] API rate limiting per user/IP (§2)
- [ ] Sentry error tracking integrated (§3)
- [ ] Unhandled exceptions captured with context (§3)
- [ ] Frontend errors captured (§3)

---

## Story 14.1: CORS Configuration

**As a** developer,
**I want** the API to restrict cross-origin requests to known frontend origins only,
**So that** unauthorized websites cannot call our API endpoints.

**Acceptance Criteria:**

**Given** the API is running with CORS configured
**When** a request arrives from an allowed origin (e.g., `http://localhost:4200`)
**Then** the response includes appropriate `Access-Control-Allow-Origin` header
**And** the response includes `Access-Control-Allow-Credentials: true`

**Given** a request arrives from a disallowed origin
**When** the browser performs a preflight OPTIONS request
**Then** the response does not include CORS headers
**And** the browser blocks the cross-origin request

**Given** a preflight request from an allowed origin
**When** the browser sends an OPTIONS request
**Then** the response allows methods: GET, POST, PUT, DELETE, OPTIONS
**And** the response allows headers: Authorization, Content-Type

**Given** the allowed origins configuration
**When** I check appsettings
**Then** origins are configurable per environment (not hardcoded):
- Development: `http://localhost:4200`
- Staging: `https://upkeep-io.dev`
- Production: `https://upkeep-io.com`

**Given** SignalR is in use for real-time features
**When** the WebSocket handshake includes credentials
**Then** CORS allows credentials for the SignalR connection

**Prerequisites:** None (independent)

**Technical Notes:**
- Add `builder.Services.AddCors()` with a named policy in `Program.cs`
- Configure allowed origins from `appsettings.json` / `appsettings.Development.json` using a `Cors:AllowedOrigins` array
- Allow methods: GET, POST, PUT, DELETE, OPTIONS
- Allow headers: Authorization, Content-Type
- Call `AllowCredentials()` (required for refresh token HttpOnly cookie)
- Add `app.UseCors("AllowedOrigins")` after `UseHttpsRedirection()`, before `UseAuthentication()`
- **Key files:**
  - `backend/src/PropertyManager.Api/Program.cs`
  - `backend/src/PropertyManager.Api/appsettings.json`
  - `backend/src/PropertyManager.Api/appsettings.Development.json`

---

## Story 14.2: Security Headers Middleware

**As a** developer,
**I want** standard security headers added to every HTTP response,
**So that** the application is protected against common browser-based attacks.

**Acceptance Criteria:**

**Given** any API response is returned
**When** I inspect the response headers
**Then** the following headers are present:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

**Given** the application is running in production or staging
**When** a response is returned
**Then** the `Strict-Transport-Security` (HSTS) header is present
**And** HSTS is NOT present in development (auto-handled by `app.UseHsts()`)

**Given** the Content Security Policy header
**When** I inspect the CSP value
**Then** it allows:
- `'self'` for default sources
- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) for styles and fonts
- `blob:` for PDF preview rendering
- `*.ingest.sentry.io` for Sentry error reporting
- `'unsafe-inline'` for styles (required by Angular Material)

**Given** the security headers middleware is registered
**When** checking the middleware pipeline order
**Then** it is placed after `UseHttpsRedirection()`

**Prerequisites:** None (independent)

**Technical Notes:**
- Create `SecurityHeadersMiddleware.cs` following the existing `GlobalExceptionHandlerMiddleware` pattern in the Middleware folder
- Use built-in `app.UseHsts()` for HSTS (automatically skips in Development environment)
- Register custom middleware in pipeline after `UseHttpsRedirection()`
- CSP header value: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'; object-src 'none'`
- **Key files:**
  - New: `backend/src/PropertyManager.Api/Middleware/SecurityHeadersMiddleware.cs`
  - `backend/src/PropertyManager.Api/Program.cs`

---

## Story 14.3: API Rate Limiting

**As a** developer,
**I want** API rate limiting to protect against brute-force and abuse,
**So that** authentication endpoints and general API access are protected from excessive requests.

**Acceptance Criteria:**

**Given** the auth endpoints (login, forgot-password, reset-password)
**When** more than 5 requests per minute arrive from the same IP
**Then** subsequent requests return HTTP 429 Too Many Requests
**And** the response includes a `Retry-After` header
**And** the response body is a ProblemDetails JSON object

**Given** the refresh token endpoint
**When** more than 10 requests per minute arrive from the same IP
**Then** subsequent requests return HTTP 429 Too Many Requests

**Given** general API endpoints (authenticated)
**When** more than 100 requests per minute arrive from the same user (by user ID)
**Then** subsequent requests return HTTP 429 Too Many Requests
**And** the response includes a `Retry-After` header

**Given** general API endpoints (unauthenticated / anonymous)
**When** more than 100 requests per minute arrive from the same IP
**Then** subsequent requests return HTTP 429 Too Many Requests

**Given** the rate limit window has expired
**When** a previously rate-limited client makes a new request
**Then** the request is allowed through normally

**Given** the rate limiter is in the middleware pipeline
**When** checking pipeline order
**Then** it is placed after `UseAuthentication()` and `UseAuthorization()` (so user ID is available for keying)

**Prerequisites:** None (independent)

**Technical Notes:**
- Use ASP.NET Core built-in `builder.Services.AddRateLimiter()` with two named policies:
  - `"auth"`: 5 req/min per IP, sliding window — applied via `[EnableRateLimiting("auth")]` on `AuthController`
  - `"api"`: 100 req/min, keyed by authenticated user ID or IP for anonymous — applied as global default
- Refresh endpoint: 10 req/min (use a separate `"refresh"` policy or adjust auth policy for that endpoint)
- Return 429 with `Retry-After` header and `ProblemDetails` JSON body
- Place `app.UseRateLimiter()` after `UseAuthentication()` / `UseAuthorization()`
- **Key files:**
  - `backend/src/PropertyManager.Api/Program.cs`
  - `backend/src/PropertyManager.Api/Controllers/AuthController.cs`

---

## Story 14.4: Backend Sentry Integration

**As a** developer,
**I want** server-side errors captured in Sentry with request context,
**So that** production issues are visible, traceable, and alertable.

**Acceptance Criteria:**

**Given** the backend has Sentry configured with a valid DSN
**When** an unhandled exception occurs
**Then** the error is captured in Sentry with:
- Full stack trace
- HTTP request context (method, URL, status code)
- Environment tag (development/staging/production)

**Given** the existing `GlobalExceptionHandlerMiddleware` logs all errors
**When** Sentry is integrated with Serilog
**Then** errors at Error level and above are forwarded to Sentry via the `.WriteTo.Sentry()` sink

**Given** Sentry's PII settings
**When** errors are captured
**Then** `SendDefaultPii` is set to `false`
**And** auth endpoint request bodies are scrubbed via `SetBeforeSend` callback (no passwords/tokens sent)

**Given** the DSN environment variable is empty or not set (local development)
**When** the application starts
**Then** the application runs normally without errors
**And** Sentry is silently disabled (graceful degradation)

**Given** the application is running with Sentry enabled
**When** I check the tracing configuration
**Then** traces sample rate is 1.0 in development and 0.2 in production

**Given** the Sentry tracing middleware is registered
**When** checking the middleware pipeline
**Then** `app.UseSentryTracing()` is present in the pipeline

**Prerequisites:** None (independent)

**Technical Notes:**
- Install NuGet packages: `Sentry.AspNetCore`, `Sentry.Serilog`
- Configure `builder.WebHost.UseSentry()` with DSN from environment variable `SENTRY_DSN`
- Add `.WriteTo.Sentry()` to the existing Serilog pipeline (capture Error+ level)
- Set `SendDefaultPii = false` to respect existing PII patterns (LogSanitizer already prevents PII in logs)
- Add `SetBeforeSend` callback to scrub request bodies for `/api/v1/auth/*` endpoints
- Environment tagging via `options.Environment`
- Traces sample rate: `1.0` dev, `0.2` production (configurable via appsettings)
- Add `app.UseSentryTracing()` to pipeline
- Add placeholder `Sentry:Dsn` to `appsettings.json` (empty string, actual DSN via env var)
- **Key files:**
  - `backend/src/PropertyManager.Api/PropertyManager.Api.csproj` (new packages)
  - `backend/src/PropertyManager.Api/Program.cs`
  - `backend/src/PropertyManager.Api/appsettings.json` (placeholder config)

---

## Story 14.5: Frontend Sentry Integration

**As a** developer,
**I want** client-side JavaScript errors captured in Sentry,
**So that** frontend issues are visible with stack traces and browser context.

**Acceptance Criteria:**

**Given** the Angular app has Sentry configured with a valid DSN
**When** an unhandled JavaScript error occurs
**Then** the error is captured in Sentry with:
- Full stack trace
- Browser and OS information
- Angular component context (if available)

**Given** the Angular `ErrorHandler` is provided by Sentry
**When** Angular catches a component or service error
**Then** the error is forwarded to Sentry instead of only logging to console

**Given** non-actionable errors occur (browser noise)
**When** Sentry processes the error
**Then** the following are filtered out before sending:
- `ChunkLoadError` (lazy-loading race conditions)
- `AbortError` (cancelled network requests)
- HTTP status 0 errors (network disconnections)

**Given** a user logs in
**When** their session is established
**Then** `Sentry.setUser({ id: userId })` is called (ID only, no email)
**And** when the user logs out, `Sentry.setUser(null)` is called

**Given** `sendDefaultPii` configuration
**When** errors are sent
**Then** `sendDefaultPii` is `false`

**Given** the DSN is empty or not configured
**When** the Angular app bootstraps
**Then** the app runs normally without errors
**And** Sentry is silently disabled

**Given** the Sentry SDK is initialized
**When** checking initialization order
**Then** Sentry is initialized in `main.ts` before Angular bootstrap

**Prerequisites:** None (independent)

**Technical Notes:**
- Install npm package: `@sentry/angular`
- Initialize Sentry in `main.ts` before `bootstrapApplication()` call
- Provide `Sentry.createErrorHandler()` as Angular `ErrorHandler` in `app.config.ts` providers
- Create environment files for DSN configuration:
  - `frontend/src/environments/environment.ts` (development, empty DSN)
  - `frontend/src/environments/environment.prod.ts` (production, DSN placeholder)
- Filter non-actionable errors in `beforeSend` callback
- Set user context on login in `AuthService` via `Sentry.setUser({ id })`, clear on logout
- `sendDefaultPii: false`
- Document source map upload for CI/CD (`@sentry/cli`) as a follow-up note
- **Key files:**
  - `frontend/package.json` (new dependency)
  - `frontend/src/main.ts`
  - `frontend/src/app/app.config.ts`
  - `frontend/src/app/core/services/auth.service.ts` (user context)
  - New: `frontend/src/environments/environment.ts`
  - New: `frontend/src/environments/environment.prod.ts`

---

## Epic 14 Summary

| Story | Title | Checklist Items Addressed | Prerequisites |
|-------|-------|---------------------------|---------------|
| 14.1 | CORS Configuration | CORS properly restricted to known origins | None |
| 14.2 | Security Headers Middleware | Security headers configured (CSP, HSTS, X-Frame-Options) | None |
| 14.3 | API Rate Limiting | API rate limiting per user/IP | None |
| 14.4 | Backend Sentry Integration | Sentry error tracking integrated; Unhandled exceptions captured with context | None |
| 14.5 | Frontend Sentry Integration | Frontend errors captured | None |

**Stories:** 5 | **All stories are independent — no inter-story dependencies**

**Epic 14 Milestone:** Phase 1 security hardening and observability gates are closed. The app is ready for beta users.

---

## Middleware Pipeline Order (Reference)

After all stories are implemented, the ASP.NET Core middleware pipeline should be ordered:

```
app.UseHttpsRedirection();
app.UseHsts();                    // Story 14.2
app.UseSecurityHeaders();         // Story 14.2 (custom middleware)
app.UseCors("AllowedOrigins");    // Story 14.1
app.UseSentryTracing();           // Story 14.4
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();             // Story 14.3
// ... routing, controllers, etc.
```

---

## Already Implemented (No Stories Needed)

The following Phase 1 items were verified as already implemented in the codebase:

| Item | Evidence |
|------|----------|
| Token refresh mechanism | HttpOnly cookies, SHA256-hashed refresh tokens, auto-refresh interceptor |
| Account lockout (5 attempts, 5 min) | `Program.cs` Identity lockout configuration |
| Session timeout configured | Access token: 60min, Refresh token: 7 days (appsettings) |
| HTTPS enforced | `app.UseHttpsRedirection()` in `Program.cs` |
| SQL injection protection | EF Core parameterization throughout |
| XSS protection | Angular built-in sanitization; bypass only for trusted blob URLs |
| CSRF protection | HttpOnly + SameSite=Strict cookies + Bearer tokens |
| Structured logging (Serilog) | Serilog.AspNetCore with console sink, request logging, enrichment |
| Log levels appropriate | Info default, Warning for Microsoft/EF, LogSanitizer for PII |
| Health check endpoint | `HealthController.cs` with `/api/v1/health` + `/api/v1/health/ready` |

---

_Generated by BMAD Epic & Story Workflow_
_Date: 2026-02-07_
_For: Dave_
_Project: property-manager_
