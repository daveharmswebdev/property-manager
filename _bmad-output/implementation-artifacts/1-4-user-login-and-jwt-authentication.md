# Story 1.4: User Login and JWT Authentication

Status: done

## Story

As a registered user,
I want to log in with my email and password,
so that I can access my protected data.

## Acceptance Criteria

1. **AC4.1**: `POST /api/v1/auth/login` with valid credentials returns:
   - JWT access token in response body `{ accessToken: "jwt...", expiresIn: 3600 }`
   - Refresh token set as HttpOnly cookie with Secure and SameSite=Strict flags
   - Returns 200 OK

2. **AC4.2**: JWT token contains required claims:
   - `userId` - the user's GUID
   - `accountId` - the user's tenant account GUID
   - `role` - "Owner" or "Contributor"
   - `exp` - expiration timestamp (60 minutes from issue)

3. **AC4.3**: Invalid credentials handling:
   - Wrong email or password returns 401 Unauthorized
   - Error message: "Invalid email or password" (generic for security)
   - Failed login attempts are logged with email and timestamp for security monitoring

4. **AC4.4**: Unverified email handling:
   - Login attempt with unverified email returns 401 Unauthorized
   - Error message: "Please verify your email before logging in"

5. **AC4.5**: Session persistence (FR6):
   - JWT stored in memory (frontend signal state)
   - Refresh token in HttpOnly cookie enables session persistence
   - Opening new browser tab maintains authentication via refresh token flow
   - Session persists across page refreshes

6. **AC4.6**: Token refresh flow:
   - When access token expires, `POST /api/v1/auth/refresh` automatically requests new JWT
   - Refresh token sent via cookie (HttpOnly)
   - Returns new access token without user intervention
   - Expired refresh token (>7 days) requires re-login

7. **AC4.7**: Multiple concurrent sessions supported:
   - Logging in on desktop creates JWT/refresh token pair for desktop
   - Logging in on phone creates separate JWT/refresh token pair for phone
   - Both sessions remain active simultaneously
   - Logging out of one device does NOT invalidate the other device's session

8. **AC4.8**: Frontend login flow:
   - Login page at `/login` route
   - Form fields: email, password
   - Loading spinner on submit button during authentication
   - Success: redirect to `/dashboard`
   - Error: display error message below form

## Tasks / Subtasks

- [x] Task 1: Implement Login Command and Handler (AC: 4.1, 4.2, 4.3, 4.4)
  - [x] Create `LoginCommand` record in `Application/Auth/Login.cs`
  - [x] Create `LoginCommandValidator` with FluentValidation (email format, password required)
  - [x] Create `LoginCommandHandler` that:
    - Validates user exists via UserManager
    - Checks email is verified
    - Validates password via UserManager.CheckPasswordAsync
    - Generates JWT access token with claims (userId, accountId, role, exp)
    - Generates refresh token (random string stored in database)
    - Returns LoginResponse with accessToken and expiresIn
  - [x] Create `RefreshToken` entity in Domain for storing refresh tokens
  - [x] Add RefreshToken table migration

- [x] Task 2: Implement JWT Token Generation Service (AC: 4.2)
  - [x] Create `IJwtService` interface in `Application/Common/Interfaces/`
  - [x] Create `JwtService` implementation in `Infrastructure/Identity/`
  - [x] Configure JWT settings in appsettings.json (Secret, Issuer, Audience, ExpiryMinutes)
  - [x] Implement GenerateAccessToken(ApplicationUser user, Guid accountId) method
  - [x] Implement GenerateRefreshToken() method for random token generation

- [x] Task 3: Implement Refresh Token Flow (AC: 4.6)
  - [x] Create `RefreshTokenCommand` record in `Application/Auth/RefreshToken.cs`
  - [x] Create `RefreshTokenCommandHandler` that:
    - Reads refresh token from cookie
    - Validates token exists and not expired (7-day validity)
    - Generates new access token
    - Optionally rotates refresh token
    - Returns new access token
  - [x] Implement `POST /api/v1/auth/refresh` endpoint in AuthController

- [x] Task 4: Add Login Endpoint to AuthController (AC: 4.1, 4.3, 4.4, 4.7)
  - [x] Implement `POST /api/v1/auth/login` endpoint
  - [x] Set refresh token as HttpOnly cookie in response
  - [x] Configure cookie options: HttpOnly=true, Secure=true, SameSite=Strict, Expires=7 days
  - [x] Handle validation errors with Problem Details response
  - [x] Log failed login attempts for security monitoring

- [x] Task 5: Configure JWT Authentication Middleware (AC: 4.1, 4.2)
  - [x] Install `Microsoft.AspNetCore.Authentication.JwtBearer` package
  - [x] Configure JWT Bearer authentication in Program.cs
  - [x] Set up token validation parameters (Issuer, Audience, SigningKey, ClockSkew)
  - [x] Add `[Authorize]` attribute to protected controller endpoints

- [x] Task 6: Create Frontend Login Page (AC: 4.8)
  - [x] Create `LoginComponent` in `features/auth/login/`
  - [x] Create login form with fields: email, password
  - [x] Add "Remember me" checkbox (optional - controls refresh token)
  - [x] Add "Forgot password?" link (navigates to reset flow - Story 1.6)
  - [x] Implement loading state on submit button
  - [x] Display API error messages below form
  - [x] On success, store accessToken in AuthService signal state
  - [x] Navigate to `/dashboard` on successful login

- [x] Task 7: Implement Auth Interceptor for Token Handling (AC: 4.5, 4.6)
  - [x] Create `AuthInterceptor` in `core/auth/auth.interceptor.ts`
  - [x] Add Authorization header with Bearer token to outgoing requests
  - [x] Handle 401 responses by attempting token refresh
  - [x] If refresh succeeds, retry original request
  - [x] If refresh fails, redirect to login page
  - [x] Register interceptor in app.config.ts

- [x] Task 8: Implement Auth Guard for Protected Routes (AC: 4.5)
  - [x] Create `AuthGuard` in `core/auth/auth.guard.ts`
  - [x] Check if user is authenticated via AuthService
  - [x] If not authenticated, redirect to `/login`
  - [x] Store intended URL for post-login redirect
  - [x] Apply guard to protected routes (dashboard, properties, etc.)

- [x] Task 9: Update Auth Service with Login/Refresh Logic (AC: 4.5, 4.6, 4.8)
  - [x] Add `login(email: string, password: string)` method
  - [x] Add `refreshToken()` method
  - [x] Add `isAuthenticated` computed signal
  - [x] Add `currentUser` signal for user data
  - [x] Store access token in memory (signal)
  - [x] Implement token expiry checking

- [x] Task 10: Integration Tests (AC: 4.1-4.7)
  - [x] Test: Login with valid credentials returns 200 with JWT
  - [x] Test: Login with invalid password returns 401
  - [x] Test: Login with non-existent email returns 401
  - [x] Test: Login with unverified email returns 401
  - [x] Test: JWT contains correct claims
  - [x] Test: Refresh token flow returns new access token
  - [x] Test: Expired refresh token returns 401

- [x] Task 11: Update Postman Collection and Manual Verification
  - [x] Add Login request to Postman collection
  - [x] Add Refresh Token request to Postman collection
  - [ ] Add Get Current User request (protected endpoint test) - deferred to Story 1.5
  - [ ] Complete smoke test checklist for login flow - manual testing pending

## Dev Notes

### Architecture Patterns and Constraints

This story implements the JWT authentication flow defined in the Architecture document Section "Authentication Flow" and "Security Architecture".

**Technology Stack:**
- ASP.NET Core Identity for user management (reuse from Story 1.3)
- JWT Bearer authentication middleware
- MediatR for CQRS command handling
- FluentValidation for request validation

**JWT Configuration (from Architecture doc):**
```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuration["Jwt:Secret"]!)),
            ClockSkew = TimeSpan.Zero
        };
    });
```

**Security Considerations:**
- JWT in HttpOnly cookie prevents XSS attacks
- SameSite=Strict prevents CSRF attacks
- Refresh token rotation recommended for enhanced security
- Failed login attempts logged for security monitoring
- Generic error messages prevent user enumeration

**Token Lifetimes:**
- Access token: 60 minutes
- Refresh token: 7 days

### Project Structure Notes

Files to create/modify per Architecture document:

```
backend/src/PropertyManager.Domain/
└── Entities/
    └── RefreshToken.cs            # NEW: Refresh token entity

backend/src/PropertyManager.Application/
└── Auth/
    ├── Login.cs                   # NEW: Command + Handler
    └── RefreshToken.cs            # NEW: Command + Handler
└── Common/
    └── Interfaces/
        └── IJwtService.cs         # NEW: JWT service interface

backend/src/PropertyManager.Infrastructure/
└── Identity/
    ├── JwtService.cs              # NEW: JWT generation service
    └── JwtSettings.cs             # NEW: JWT configuration options
└── Persistence/
    └── Configurations/
        └── RefreshTokenConfiguration.cs  # NEW: EF Core config

backend/src/PropertyManager.Api/
└── Controllers/
    └── AuthController.cs          # MODIFY: Add login, refresh endpoints

frontend/src/app/
└── core/
    └── auth/
        ├── auth.service.ts        # MODIFY: Add login, refresh methods
        ├── auth.interceptor.ts    # NEW: HTTP interceptor
        └── auth.guard.ts          # NEW: Route guard
└── features/
    └── auth/
        └── login/
            ├── login.component.ts     # MODIFY: Implement full login
            ├── login.component.html   # NEW: Login form template
            └── login.component.scss   # NEW: Login form styles
```

### Learnings from Previous Story

**From Story 1-3-user-registration-with-email-verification (Status: done)**

- **ApplicationUser Created**: Use existing `ApplicationUser` at `backend/src/PropertyManager.Infrastructure/Identity/ApplicationUser.cs` - it has `AccountId` foreign key we need for JWT claims
- **IIdentityService Available**: Reuse `backend/src/PropertyManager.Application/Common/Interfaces/IIdentityService.cs` - may extend for login validation
- **AuthController Exists**: Add login/refresh endpoints to existing `backend/src/PropertyManager.Api/Controllers/AuthController.cs`
- **AuthService (Frontend)**: Extend existing `frontend/src/app/core/services/auth.service.ts` with login methods
- **AppDbContext**: Already inherits from `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>` - add RefreshToken DbSet
- **Testing Pattern**: Reuse `PropertyManagerWebApplicationFactory` from `backend/tests/PropertyManager.Api.Tests/` for integration tests
- **Login Component Placeholder**: `frontend/src/app/features/auth/login/login.component.ts` exists as placeholder - implement full login flow
- **Proxy Configuration**: `frontend/proxy.conf.json` already configured for API calls

**Files to Reuse (NOT recreate):**
- `ApplicationUser.cs` - for user lookup and claims
- `AuthController.cs` - add new endpoints
- `AuthService.ts` - add login/refresh methods
- `PropertyManagerWebApplicationFactory.cs` - for integration tests

[Source: docs/sprint-artifacts/1-3-user-registration-with-email-verification.md#Dev-Agent-Record]

### Testing Strategy

**Unit Tests (xUnit):**
- `LoginCommandHandlerTests` - test credential validation, JWT generation, error cases
- `RefreshTokenCommandHandlerTests` - test token validation, refresh flow, expiration
- `JwtServiceTests` - test token generation, claims verification

**Integration Tests (WebApplicationFactory + Testcontainers):**
- Full API endpoint testing with real database
- Verify JWT contains correct claims
- Test refresh token cookie handling
- Test concurrent session support

**Component Tests (Vitest):**
- `LoginComponent` - form validation, API error handling, redirect on success
- `AuthInterceptor` - token injection, 401 handling, refresh flow
- `AuthGuard` - protected route access, redirect behavior

**Manual Smoke Test:**
- Login via UI with valid credentials
- Verify redirect to dashboard
- Open new tab - verify still logged in
- Wait for token expiry - verify auto-refresh
- Login on another device - verify both sessions active
- Logout on one device - verify other device unaffected

### References

- [Source: docs/architecture.md#Authentication Flow] - JWT and session design
- [Source: docs/architecture.md#Security Architecture] - JWT configuration, password validation
- [Source: docs/architecture.md#API Contracts] - Auth endpoint specifications
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC4: User Login] - Acceptance criteria source
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#APIs and Interfaces] - Request/response format
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Workflows and Sequencing] - Login flow sequence diagram
- [Source: docs/epics.md#Story 1.4] - Epic-level story definition
- [Source: docs/ux-design-specification.md#Section 7.3] - Loading spinner on button pattern

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/1-4-user-login-and-jwt-authentication.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-29 | Initial story draft created | SM Agent |
