# Story 14.1: CORS Configuration

Status: done

## Story

As a **developer**,
I want **the API to restrict cross-origin requests to known frontend origins only**,
So that **unauthorized websites cannot call our API endpoints**.

## Acceptance Criteria

1. **Given** the API is running with CORS configured **When** a request arrives from an allowed origin (e.g., `http://localhost:4200`) **Then** the response includes the appropriate `Access-Control-Allow-Origin` header **And** the response includes `Access-Control-Allow-Credentials: true`

2. **Given** a request arrives from a disallowed origin **When** the browser performs a preflight OPTIONS request **Then** the response does not include CORS headers **And** the browser blocks the cross-origin request

3. **Given** a preflight request from an allowed origin **When** the browser sends an OPTIONS request **Then** the response allows methods: GET, POST, PUT, DELETE, OPTIONS **And** the response allows headers: Authorization, Content-Type

4. **Given** the allowed origins configuration **When** I check appsettings **Then** origins are configurable per environment (not hardcoded):
   - Development: `http://localhost:4200`
   - Staging: `https://upkeep-io.dev`
   - Production: `https://upkeep-io.com`

5. **Given** SignalR is in use for real-time features **When** the WebSocket handshake includes credentials **Then** CORS allows credentials for the SignalR connection

## Tasks / Subtasks

- [x] Task 1: Add CORS configuration section to appsettings files (AC: #4)
  - [x] 1.1 Add `Cors:AllowedOrigins` array to `backend/src/PropertyManager.Api/appsettings.json` with staging and production origins: `["https://upkeep-io.dev", "https://upkeep-io.com"]`
  - [x] 1.2 Add `Cors:AllowedOrigins` array to `backend/src/PropertyManager.Api/appsettings.Development.json` with development origin: `["http://localhost:4200"]`

- [x] Task 2: Register CORS services in Program.cs (AC: #1, #2, #3, #5)
  - [x] 2.1 Read `Cors:AllowedOrigins` from configuration as `string[]`
  - [x] 2.2 Add `builder.Services.AddCors()` with a named policy `"AllowedOrigins"` using `CorsPolicyBuilder`:
    - `.WithOrigins(allowedOrigins)` — restricts to configured origins
    - `.WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")` — allowed HTTP methods
    - `.WithHeaders("Authorization", "Content-Type")` — allowed request headers
    - `.AllowCredentials()` — required for HttpOnly refresh token cookie and SignalR WebSocket handshake

- [x] Task 3: Add CORS middleware to the pipeline (AC: #1, #2, #5)
  - [x] 3.1 Add `app.UseCors("AllowedOrigins")` in the middleware pipeline after `app.UseHttpsRedirection()` and `app.UseSerilogRequestLogging()`, but before `app.UseAuthentication()`
  - [x] 3.2 Verify the resulting pipeline order:
    ```
    app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
    // Swagger (dev only)
    app.UseHttpsRedirection();
    app.UseSerilogRequestLogging();
    app.UseCors("AllowedOrigins");       // <-- NEW
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<ReceiptHub>("/hubs/receipts");
    ```

- [x] Task 4: Write integration tests (AC: #1, #2, #3)
  - [x] 4.1 Test: Request from allowed origin gets `Access-Control-Allow-Origin` header in response
  - [x] 4.2 Test: Request from allowed origin gets `Access-Control-Allow-Credentials: true` header
  - [x] 4.3 Test: Preflight OPTIONS from allowed origin returns allowed methods (GET, POST, PUT, DELETE, OPTIONS) and allowed headers (Authorization, Content-Type)
  - [x] 4.4 Test: Request from disallowed origin does NOT get `Access-Control-Allow-Origin` header
  - [x] 4.5 Test: Request with no Origin header succeeds normally (server-to-server / same-origin)

## Dev Notes

### Current State of Program.cs

No CORS is currently configured. The middleware pipeline in `Program.cs:206-230` currently is:

```
GlobalExceptionHandlerMiddleware → (Swagger if dev) → HttpsRedirection → SerilogRequestLogging → Authentication → Authorization → MapControllers → MapHub
```

CORS middleware must be inserted **before** `UseAuthentication()` so that preflight OPTIONS requests are handled before auth rejects them as unauthenticated.

### Key Implementation Detail: AllowCredentials + WithOrigins

ASP.NET Core does **not** allow `AllowCredentials()` with `AllowAnyOrigin()`. You must use `WithOrigins(...)` when credentials are enabled. This is already what we want (restricted origins), but be aware that if the origins array is empty, CORS will effectively block all cross-origin requests.

### SignalR Compatibility

SignalR uses WebSocket transport which performs a credential-bearing handshake. The existing `OnMessageReceived` event in the JWT config (Program.cs:133-149) extracts `access_token` from the query string for hub connections. CORS `AllowCredentials()` is required for this handshake to succeed cross-origin.

### File Impact

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Api/appsettings.json` | Add `Cors.AllowedOrigins` array (staging + prod) |
| `backend/src/PropertyManager.Api/appsettings.Development.json` | Add `Cors.AllowedOrigins` array (localhost:4200) |
| `backend/src/PropertyManager.Api/Program.cs` | Add `AddCors()` service + `UseCors()` middleware |
| `backend/tests/PropertyManager.Api.Tests/` | New CORS integration test file |

### Epic 14 Middleware Pipeline Reference

After all Epic 14 stories are complete, the target pipeline order is:

```
app.UseHttpsRedirection();
app.UseHsts();                    // Story 14.2
app.UseSecurityHeaders();         // Story 14.2
app.UseCors("AllowedOrigins");    // Story 14.1 (this story)
app.UseSentryTracing();           // Story 14.4
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();             // Story 14.3
```

For this story, just insert `UseCors` before `UseAuthentication`. Other stories will rearrange as needed when they land.

### Testing Approach

Use `WebApplicationFactory<Program>` with a custom `HttpClient` that sets the `Origin` header to simulate cross-origin requests. Check response headers for CORS headers. For preflight, send an OPTIONS request with `Access-Control-Request-Method` and `Access-Control-Request-Headers`.
