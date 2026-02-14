# Story 14.2: Security Headers Middleware

Status: review

## Story

As a **developer**,
I want **standard security headers added to every HTTP response**,
So that **the application is protected against common browser-based attacks**.

## Acceptance Criteria

1. **Given** any API response is returned **When** I inspect the response headers **Then** the following headers are present:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

2. **Given** the application is running in production or staging **When** a response is returned **Then** the `Strict-Transport-Security` (HSTS) header is present **And** HSTS is NOT present in development (auto-handled by `app.UseHsts()`)

3. **Given** the Content Security Policy header **When** I inspect the CSP value **Then** it allows:
   - `'self'` for default sources
   - Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) for styles and fonts
   - `blob:` for PDF preview rendering
   - `*.ingest.sentry.io` for Sentry error reporting
   - `'unsafe-inline'` for styles (required by Angular Material)

4. **Given** the security headers middleware is registered **When** checking the middleware pipeline order **Then** it is placed after `UseHttpsRedirection()` and `UseHsts()`

## Tasks / Subtasks

- [x] Task 1: Create SecurityHeadersMiddleware class (AC: #1, #3)
  - [x] 1.1 Create `backend/src/PropertyManager.Api/Middleware/SecurityHeadersMiddleware.cs`
  - [x] 1.2 Implement `InvokeAsync` that adds all security headers before calling `_next(context)`
  - [x] 1.3 Add headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - [x] 1.4 Add CSP header: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'; object-src 'none'`

- [x] Task 2: Create extension method for clean pipeline registration (AC: #4)
  - [x] 2.1 Add a static `UseSecurityHeaders()` extension method on `IApplicationBuilder` in the middleware file (or a separate `MiddlewareExtensions.cs` if preferred, but co-locating is fine)

- [x] Task 3: Register middleware in Program.cs pipeline (AC: #2, #4)
  - [x] 3.1 Add `app.UseHsts()` after `app.UseHttpsRedirection()` (built-in, auto-skips in Development)
  - [x] 3.2 Add `app.UseSecurityHeaders()` after `app.UseHsts()`
  - [x] 3.3 Resulting pipeline order:
    ```
    app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
    // Swagger (dev only)
    app.UseHttpsRedirection();
    app.UseHsts();                    // NEW - Story 14.2
    app.UseSecurityHeaders();         // NEW - Story 14.2
    app.UseSerilogRequestLogging();
    app.UseCors("AllowedOrigins");
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<ReceiptHub>("/hubs/receipts");
    ```

- [x] Task 4: Write unit tests for SecurityHeadersMiddleware (AC: #1, #3)
  - [x] 4.1 Create `backend/tests/PropertyManager.Api.Tests/Middleware/SecurityHeadersMiddlewareTests.cs`
  - [x] 4.2 Test: Response includes `X-Frame-Options: DENY`
  - [x] 4.3 Test: Response includes `X-Content-Type-Options: nosniff`
  - [x] 4.4 Test: Response includes `Referrer-Policy: strict-origin-when-cross-origin`
  - [x] 4.5 Test: Response includes `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - [x] 4.6 Test: Response includes `Content-Security-Policy` with correct value
  - [x] 4.7 Test: Next middleware is called (pass-through behavior)

## Dev Notes

### Middleware Pattern — Follow Existing Convention

Follow the `GlobalExceptionHandlerMiddleware` pattern at `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs`:
- Same namespace: `PropertyManager.Api.Middleware`
- Constructor takes `RequestDelegate next` (no logger/environment needed — this middleware just adds headers)
- `InvokeAsync(HttpContext context)` method
- Add headers to `context.Response.Headers` **before** calling `await _next(context)`

### CSP Header Value (Exact)

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'; object-src 'none'
```

Rationale for each directive:
- `style-src 'unsafe-inline'` — Angular Material injects inline styles
- `fonts.googleapis.com` / `fonts.gstatic.com` — Google Fonts used in the app
- `img-src blob:` — PDF preview rendering via blob URLs
- `connect-src https://*.ingest.sentry.io` — Story 14.4 will add Sentry; pre-allow the domain now
- `frame-ancestors 'none'` — equivalent to X-Frame-Options DENY, belt-and-suspenders

### HSTS — Use Built-in

Do **not** manually add the `Strict-Transport-Security` header. Use `app.UseHsts()` which:
- Automatically adds `Strict-Transport-Security: max-age=2592000` (30 days)
- Automatically **skips** in Development environment (no HSTS on localhost)
- This satisfies AC #2 with zero custom code

### Pipeline Placement

Headers must be added **early** in the pipeline so every response (including error responses, CORS preflight responses, etc.) gets the security headers. Place after `UseHttpsRedirection()` and `UseHsts()` but before `UseCors()`.

Current pipeline in `Program.cs` (lines 225-249):
```csharp
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
// Swagger (dev only)
app.UseHttpsRedirection();
app.UseSerilogRequestLogging();
app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
```

Target after this story:
```csharp
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
// Swagger (dev only)
app.UseHttpsRedirection();
app.UseHsts();                    // NEW
app.UseSecurityHeaders();         // NEW
app.UseSerilogRequestLogging();
app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
```

### Test Pattern — Follow GlobalExceptionHandlerMiddlewareTests

Test file: `backend/tests/PropertyManager.Api.Tests/Middleware/GlobalExceptionHandlerMiddlewareTests.cs`

Key patterns to reuse:
- `DefaultHttpContext` with `MemoryStream` for response body
- Simple `RequestDelegate` that returns `Task.CompletedTask` (no exception — just pass through)
- Assert against `_httpContext.Response.Headers["HeaderName"]`
- Use `FluentAssertions` (already referenced in test project)
- Use `[Fact]` attributes (xUnit, already in use)

### Previous Story (14.1) Learnings

- CORS implementation in Story 14.1 was clean — followed the same Program.cs modification pattern
- Code review feedback (commit `31d29c0`) addressed minor issues — keep code tight and focused
- The test project already has the `Middleware/` folder structure ready

### Project Structure Notes

- New file: `backend/src/PropertyManager.Api/Middleware/SecurityHeadersMiddleware.cs`
- Modified file: `backend/src/PropertyManager.Api/Program.cs`
- New test file: `backend/tests/PropertyManager.Api.Tests/Middleware/SecurityHeadersMiddlewareTests.cs`
- All paths align with existing project conventions — `Middleware/` folder already exists

### References

- [Source: _bmad-output/planning-artifacts/epic-14-security-hardening-observability.md#Story 14.2]
- [Source: backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs] — middleware pattern reference
- [Source: backend/tests/PropertyManager.Api.Tests/Middleware/GlobalExceptionHandlerMiddlewareTests.cs] — test pattern reference
- [Source: backend/src/PropertyManager.Api/Program.cs] — pipeline registration
- [Source: _bmad-output/implementation-artifacts/14-1-cors-configuration.md] — previous story context

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — clean implementation with no issues.

### Completion Notes List
- Created `SecurityHeadersMiddleware` with all 5 security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP) added before `_next(context)`
- Co-located `UseSecurityHeaders()` extension method in same file for clean pipeline registration
- Registered `app.UseHsts()` (built-in HSTS, auto-skips in Development) and `app.UseSecurityHeaders()` in Program.cs after `UseHttpsRedirection()` and before `UseSerilogRequestLogging()`
- 6 unit tests: one per header + pass-through behavior — all passing
- Full regression suite: 1,447 tests passing (913 Application + 85 Infrastructure + 449 Api)

### File List
- `backend/src/PropertyManager.Api/Middleware/SecurityHeadersMiddleware.cs` (NEW)
- `backend/src/PropertyManager.Api/Program.cs` (MODIFIED)
- `backend/tests/PropertyManager.Api.Tests/Middleware/SecurityHeadersMiddlewareTests.cs` (NEW)
- `_bmad-output/implementation-artifacts/14-2-security-headers-middleware.md` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)

## Change Log
- 2026-02-14: Implemented security headers middleware (Story 14.2) — all 4 tasks complete, 6 tests added, 1,447 total tests passing
