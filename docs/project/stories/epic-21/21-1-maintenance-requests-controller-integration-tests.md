# Story 21.1: MaintenanceRequestsController Integration Tests

Status: done

## Story

As a developer,
I want integration test coverage for every `MaintenanceRequestsController` endpoint,
so that the tenant portal's core API flow is verified end-to-end (real HTTP + real EF Core + real auth) before we build more on top of it.

## Acceptance Criteria

> **Note (epic reconciliation):** Epic 21 references `POST /maintenance-requests` accepting a property id, `GET /properties/{id}/maintenance-request`, and a `Submitted` status side-effect. The actual shipped controller (see `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`) exposes:
> - `POST   /api/v1/maintenance-requests` — body `{ description }`. Tenant's `PropertyId` comes from JWT claims, never the payload.
> - `GET    /api/v1/maintenance-requests` — supports `?status=`, `?propertyId=`, `?page=`, `?pageSize=`. Role-based filtering in handler: Tenants are scoped to their `PropertyId` via `ICurrentUser.PropertyId` (shared visibility on the property — NOT per-user filtering; see AC-4 below), Owners see account-wide.
> - `GET    /api/v1/maintenance-requests/tenant-property` — returns the tenant's assigned property info.
> - `GET    /api/v1/maintenance-requests/{id:guid}` — single request. Tenant receives 404 for a request on a different property.
>
> There is NO `GET /properties/{id}/maintenance-request`. Property-scoped listing is done via the `?propertyId=` query parameter on the list endpoint. ACs below reflect the actual contract.
>
> **Status semantic:** Per Story 20.3 AC #5, tenants on the same property share visibility of that property's requests. The epic's AC-4 ("tenant sees only their OWN requests") contradicts the current handler, which filters by `PropertyId`, not by `SubmittedByUserId`. AC-4 below tests the shipped behavior (property-scoped shared visibility). If a change to per-user filtering is desired, that is a separate story — this story must not silently change behavior. See Dev Notes → "Epic vs. controller reconciliation" for detail.

**AC-1: POST /api/v1/maintenance-requests creates a request (tenant happy path)**
- **Given** a tenant user authenticated via JWT, with `PropertyId` set to an existing property in the tenant's account
- **When** they `POST /api/v1/maintenance-requests` with body `{ "description": "Leaky faucet" }`
- **Then** the response is `201 Created` with a `Location` header pointing at `/api/v1/maintenance-requests/{id}` and body `{ id }`
- **And** a row exists in `MaintenanceRequests` with `Status = Submitted`, `PropertyId` equal to the tenant's assigned property, `SubmittedByUserId` equal to the authenticated user, `AccountId` equal to the tenant's account, and `Description = "Leaky faucet"`

**AC-2: POST /api/v1/maintenance-requests is forbidden for users without `MaintenanceRequests.Create`**
- **Given** a Contributor user (role lacks `MaintenanceRequests.Create` — see `RolePermissions.cs`)
- **When** they `POST /api/v1/maintenance-requests` with a valid body
- **Then** the endpoint returns `403 Forbidden` (from the `CanCreateMaintenanceRequests` policy)

**AC-3: POST /api/v1/maintenance-requests returns 401 without a bearer token**
- **Given** no `Authorization` header
- **When** a `POST /api/v1/maintenance-requests` is sent with a valid body
- **Then** the endpoint returns `401 Unauthorized`

**AC-4: POST /api/v1/maintenance-requests returns 400 for invalid body**
- **Given** a tenant authenticated with an assigned property
- **When** they POST body `{ "description": "" }`, or a description over 5000 chars, or a null body
- **Then** the endpoint returns `400 BadRequest` with a `ValidationProblemDetails` payload whose `errors` key contains `Description`

**AC-5: POST /api/v1/maintenance-requests returns 400 (BusinessRuleException) when the caller has no assigned property**
- **Given** a user with the `MaintenanceRequests.Create` permission but `PropertyId = null` (e.g., an Owner who somehow hits the endpoint, or a Tenant whose property was unlinked)
- **When** they POST a valid body
- **Then** the endpoint returns `400 BadRequest` (the global exception middleware maps `BusinessRuleException` → `ProblemDetails` with status 400) — document the actual mapped status in Dev Notes and assert it

**AC-6: GET /api/v1/maintenance-requests (Owner) returns the account-scoped list**
- **Given** an Owner in Account A with 3 maintenance requests across 2 properties, AND an unrelated Account B with 2 requests
- **When** the Owner calls `GET /api/v1/maintenance-requests`
- **Then** the response is `200 OK` with `items.Count == 3` and `totalCount == 3`, each `items[i].id` belongs to Account A, none belong to Account B
- **And** results are ordered by `createdAt` descending

**AC-7: GET /api/v1/maintenance-requests (Tenant) is scoped to the tenant's property (shared visibility)**
- **Given** an Account with Property P1 (Tenant-1 and Tenant-2 both assigned) and Property P2 (Tenant-3 assigned), plus 3 requests on P1 (one submitted by Tenant-1, one by Tenant-2, one by an Owner from the property page) and 1 request on P2
- **When** Tenant-1 calls `GET /api/v1/maintenance-requests`
- **Then** the response contains exactly the 3 requests on P1 (including Tenant-2's request — shared property visibility per Story 20.3 AC #5), and zero P2 requests

**AC-8: GET /api/v1/maintenance-requests enforces AccountId isolation**
- **Given** an Owner in Account A and an Owner in Account B, each with their own requests
- **When** Account-A's owner calls `GET /api/v1/maintenance-requests`
- **Then** the response contains only Account A requests (cross-account leakage is prevented by the global query filter)

**AC-9: GET /api/v1/maintenance-requests supports `?status=` filter (case-insensitive)**
- **Given** an Owner with requests of varying statuses — `Submitted`, `InProgress`, `Resolved`, `Dismissed`
- **When** they call `GET /api/v1/maintenance-requests?status=submitted`
- **Then** only `Submitted` requests are returned
- **And** `?status=INVALID` returns the unfiltered list (per handler's `Enum.TryParse` — invalid values are ignored, not rejected)

**AC-10: GET /api/v1/maintenance-requests supports `?propertyId=` filter**
- **Given** an Owner with requests on two properties P1 (2 requests) and P2 (1 request)
- **When** they call `GET /api/v1/maintenance-requests?propertyId={P1}`
- **Then** only the 2 P1 requests are returned; `totalCount == 2`

**AC-11: GET /api/v1/maintenance-requests paginates correctly**
- **Given** an Owner with 25 requests
- **When** they call `GET /api/v1/maintenance-requests?page=2&pageSize=10`
- **Then** `items.Count == 10`, `page == 2`, `pageSize == 10`, `totalCount == 25`, `totalPages == 3`

**AC-12: GET /api/v1/maintenance-requests/{id} (Owner) returns the request**
- **Given** an Owner and a request in the same account
- **When** they `GET /api/v1/maintenance-requests/{id}`
- **Then** the response is `200 OK` with the full `MaintenanceRequestDto` including `propertyName`, `propertyAddress`, `submittedByUserName`, and the `photos` collection (empty or populated)

**AC-13: GET /api/v1/maintenance-requests/{id} returns 404 for cross-account access (no existence disclosure)**
- **Given** a request in Account A
- **When** a user from Account B calls `GET /api/v1/maintenance-requests/{id}`
- **Then** the response is `404 NotFound` (NOT 403) — global query filter prevents leakage

**AC-14: GET /api/v1/maintenance-requests/{id} returns 404 for a tenant accessing a request on a different property**
- **Given** an Account with Property P1 (Tenant-1 assigned) and Property P2 (Tenant-2 assigned), and a request on P2
- **When** Tenant-1 calls `GET /api/v1/maintenance-requests/{requestOnP2Id}`
- **Then** the response is `404 NotFound` (NOT 403) per `GetMaintenanceRequestByIdHandler` — avoids existence disclosure across tenants

**AC-15: GET /api/v1/maintenance-requests/tenant-property returns the tenant's property info**
- **Given** a tenant with `PropertyId` set
- **When** they `GET /api/v1/maintenance-requests/tenant-property`
- **Then** the response is `200 OK` with the property id, name, and address

**AC-16: All GET endpoints return 401 without a bearer token**
- **Given** no `Authorization` header
- **When** `GET /api/v1/maintenance-requests`, `GET /api/v1/maintenance-requests/{id}`, and `GET /api/v1/maintenance-requests/tenant-property` are each called
- **Then** each returns `401 Unauthorized`

## Tasks / Subtasks

- [x] **Task 1: Extend `PropertyManagerWebApplicationFactory` with a tenant-user seed helper (AC: #1, #7, #14, #15)**
  - [x] 1.1 Add `public async Task<Guid> CreateTenantUserInAccountAsync(Guid accountId, Guid propertyId, string email, string password = "Test@123456")` to `PropertyManagerWebApplicationFactory.cs`
  - [x] 1.2 Inside the helper: resolve `UserManager<ApplicationUser>`, create an `ApplicationUser` with `EmailConfirmed = true`, `AccountId = accountId`, `Role = "Tenant"`, `PropertyId = propertyId`; call `userManager.CreateAsync(user, password)` and throw `InvalidOperationException` on failure (mirror `CreateTestUserInAccountAsync`)
  - [x] 1.3 Add `public async Task<Guid> CreatePropertyInAccountAsync(Guid accountId, string name = "Test Property", string street = "123 Test St", string city = "Austin", string state = "TX", string zipCode = "78701")` that inserts a `Property` directly via `AppDbContext` (bypasses the API) so tests don't need an Owner token just to seed data
  - [x] 1.4 Keep the existing `CreateTestUserAsync` / `CreateTestUserInAccountAsync` signatures unchanged (they're used by 15+ existing test files)

- [x] **Task 2: Create `MaintenanceRequestsControllerTests.cs` skeleton and helper methods (AC: all)**
  - [x] 2.1 Create `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` following the structure of `VendorsControllerCreateTests.cs` (class uses `IClassFixture<PropertyManagerWebApplicationFactory>`, constructor captures `_factory` + `_client`)
  - [x] 2.2 Copy the `PostAsJsonWithAuthAsync`, `GetWithAuthAsync` helpers from `VendorsControllerCreateTests.cs`. (No `DeleteWithAuthAsync` needed — controller has no DELETE endpoint.) Do NOT extract to a base class in this story
  - [x] 2.3 Add a `LoginAsync(email, password)` helper and a `RegisterAndLoginOwnerAsync` convenience wrapper
  - [x] 2.4 Add response records at the bottom of the file as file-scoped types: `CreateMaintenanceRequestResponse`, `MaintenanceRequestItemDto`, `GetMaintenanceRequestsResponseDto`, `MaintenanceRequestPhotoResponseDto`, `MaintenanceRequestDetailDto`, `TenantPropertyResponseDto`, `MrLoginResponse`

- [x] **Task 3: POST /maintenance-requests tests (AC: #1-#5)**
  - [x] 3.1 `CreateMaintenanceRequest_WithoutAuth_Returns401`
  - [x] 3.2 `CreateMaintenanceRequest_AsTenant_ValidBody_Returns201WithIdAndLocation`
  - [x] 3.3 `CreateMaintenanceRequest_AsTenant_Persists_WithCorrectFields`
  - [x] 3.4 `CreateMaintenanceRequest_AsContributor_Returns403`
  - [x] 3.5 `CreateMaintenanceRequest_EmptyDescription_Returns400`
  - [x] 3.6 `CreateMaintenanceRequest_DescriptionTooLong_Returns400`
  - [x] 3.7 `CreateMaintenanceRequest_NullBody_Returns400`
  - [x] 3.8 `CreateMaintenanceRequest_CallerWithoutAssignedProperty_Returns400` — confirmed: `GlobalExceptionHandlerMiddleware` maps `BusinessRuleException` → `StatusCodes.Status400BadRequest`

- [x] **Task 4: GET /maintenance-requests tests — account/role scoping (AC: #6, #7, #8, #16)**
  - [x] 4.1 `GetMaintenanceRequests_WithoutAuth_Returns401`
  - [x] 4.2 `GetMaintenanceRequests_AsOwner_ReturnsAccountScopedList`
  - [x] 4.3 `GetMaintenanceRequests_CrossAccount_DoesNotLeak`
  - [x] 4.4 `GetMaintenanceRequests_OrderedByCreatedAtDesc` — deterministic timestamps via a second SaveChangesAsync that updates `CreatedAt` (audit interceptor only overrides on EntityState.Added)
  - [x] 4.5 `GetMaintenanceRequests_AsTenant_ReturnsPropertyScopedRequests_SharedVisibility`

- [x] **Task 5: GET /maintenance-requests tests — filters & pagination (AC: #9, #10, #11)**
  - [x] 5.1 `GetMaintenanceRequests_StatusFilter_CaseInsensitive_ReturnsMatching`
  - [x] 5.2 `GetMaintenanceRequests_StatusFilter_InvalidValue_ReturnsUnfiltered`
  - [x] 5.3 `GetMaintenanceRequests_PropertyIdFilter_ReturnsMatching`
  - [x] 5.4 `GetMaintenanceRequests_Pagination_Page2PageSize10`
  - [x] 5.5 `GetMaintenanceRequests_EmptyAccount_ReturnsEmptyList`

- [x] **Task 6: GET /maintenance-requests/{id} tests (AC: #12, #13, #14, #16)**
  - [x] 6.1 `GetMaintenanceRequestById_WithoutAuth_Returns401`
  - [x] 6.2 `GetMaintenanceRequestById_AsOwner_Returns200WithFullDto`
  - [x] 6.3 `GetMaintenanceRequestById_CrossAccount_Returns404`
  - [x] 6.4 `GetMaintenanceRequestById_SoftDeleted_Returns404`
  - [x] 6.5 `GetMaintenanceRequestById_AsTenantOnDifferentProperty_Returns404`
  - [x] 6.6 `GetMaintenanceRequestById_AsTenantOnSameProperty_Returns200`

- [x] **Task 7: GET /maintenance-requests/tenant-property tests (AC: #15, #16)**
  - [x] 7.1 `GetTenantProperty_WithoutAuth_Returns401`
  - [x] 7.2 `GetTenantProperty_AsTenant_ReturnsAssignedProperty` — DTO shape confirmed from `GetTenantProperty.cs`: `(Guid Id, string Name, string Street, string City, string State, string ZipCode)`
  - [x] 7.3 `GetTenantProperty_AsOwner_Returns400` — handler throws `BusinessRuleException("This endpoint is only accessible to Tenant users.")` for non-Tenant roles; middleware maps to 400 BadRequest

- [x] **Task 8: Full suite + sanity (AC: all)**
  - [x] 8.1 27/27 `MaintenanceRequestsControllerTests` green
  - [x] 8.2 Full suite 1845 pass / 0 fail (Application.Tests 1189, Infrastructure.Tests 98, Api.Tests 558 — 27 new)
  - [x] 8.3 Build succeeds with no new warnings from the added code

## Dev Notes

### Test scope (per project testing-pyramid memory)

This is a pure test-writing story. The deliverable IS integration tests.

| Layer | Required? | Justification |
|---|---|---|
| **Unit** | Not required | Handler-level unit tests already exist — see `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/` (CreateMaintenanceRequestHandlerTests, GetMaintenanceRequestsHandlerTests, GetMaintenanceRequestByIdHandlerTests, GetTenantPropertyHandlerTests, validators, entity). Adding more is out of scope and would duplicate coverage. |
| **Integration** | **Required — this IS the story** | Four controller endpoints currently have zero coverage of the real HTTP + DI + EF Core + auth + global query filter + permission policy stack. |
| **E2E (Playwright)** | Not required | Backend-only. Tenant E2E is Story 21.4. |

### Pattern reference — mirror `VendorsControllerCreateTests.cs`

The epic's technical notes explicitly call out `VendorsControllerTests.cs` as the pattern to mirror. In this codebase it's split: **`VendorsControllerCreateTests.cs`** and **`VendorsControllerDeleteTests.cs`** (no combined `VendorsControllerTests.cs` — Story 21.6 extends these files rather than consolidating). Read both in full before starting — they encode every convention used here:

- `IClassFixture<PropertyManagerWebApplicationFactory>` for shared Testcontainers Postgres
- Constructor captures `_factory` and `_client`
- `[Fact]` methods, naming `Method_Scenario_ExpectedResult` (e.g., `CreateVendor_ValidRequest_Returns201WithId`)
- FluentAssertions (`response.StatusCode.Should().Be(...)`, `content.Should().NotBeNull()`)
- Unique test data: `$"test-{Guid.NewGuid():N}@example.com"` for emails — prevents collisions since the Postgres container is shared within a test class run
- Database verification after API calls: `using var scope = _factory.Services.CreateScope(); var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>(); ...`
- For soft-delete verification: `dbContext.Entities.IgnoreQueryFilters().FirstOrDefaultAsync(...)`

### Factory — what you need and don't need to change

The existing `PropertyManagerWebApplicationFactory` (`backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs`) already:
- Spins up a Postgres 16 container via Testcontainers
- Disables rate limiting
- Replaces `IEmailService`, `IStorageService`, `IReportStorageService` with in-memory fakes
- Exposes `CreateTestUserAsync` (Owner by default, new account) and `CreateTestUserInAccountAsync` (any role, existing account — **but does NOT set `PropertyId`**)

You will extend it with two new helpers (Task 1). **Critical constraint:** no existing test (15+ files) sets `PropertyId` on a test user. The current `CreateTestUserInAccountAsync` accepts a `role` parameter but silently ignores the `PropertyId` requirement that Tenant users need. This is why a dedicated `CreateTenantUserInAccountAsync(accountId, propertyId, email, password)` helper is the right shape — do not bolt `PropertyId` into the existing method and risk breaking neighbors.

### Permissions and policy wiring

From `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`:
- **Owner**: has `MaintenanceRequests.Create`, `ViewOwn`, `ViewAll`
- **Contributor**: does NOT have any MaintenanceRequest permission → POST must 403
- **Tenant**: has `MaintenanceRequests.Create`, `ViewOwn`, `Properties.ViewAssigned`

From `backend/src/PropertyManager.Api/Program.cs` line 174:
- `CanCreateMaintenanceRequests` policy requires `Permissions.MaintenanceRequests.Create`

Controller authorization (`MaintenanceRequestsController.cs`):
- Class-level: `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` — all endpoints require a bearer token
- POST: additional `[Authorize(Policy = "CanCreateMaintenanceRequests")]`
- GETs: no additional policy — filtering happens in the handler based on `ICurrentUser.Role` and `ICurrentUser.PropertyId`

### JWT claims — the `propertyId` claim is critical

Story 20.1 wired `PropertyId` into the JWT (`backend/src/PropertyManager.Infrastructure/Identity/JwtService.cs`). For a Tenant test user to be correctly scoped during `GET /maintenance-requests`, the **login flow** must produce a token with the `propertyId` claim set. This means:

1. `CreateTenantUserInAccountAsync` must set `ApplicationUser.PropertyId` on the DB row
2. `IdentityService.ValidateCredentialsAsync` reads `user.PropertyId` and returns it in its tuple (already implemented)
3. The auth login controller passes that through to `JwtService.GenerateAccessTokenAsync(..., propertyId)` (already implemented)

Therefore the integration test only needs to:
```csharp
var (accessToken, _) = await LoginAsync(tenantEmail, password);
```
after seeding via `CreateTenantUserInAccountAsync`, and the JWT claim will carry `propertyId` automatically. Verify this once during Task 3.2 development by decoding the JWT if the first test fails — a missing `propertyId` claim will make Tenant GETs return the wrong rows.

### Global exception mapping — verify AC-5's actual status code

`CreateMaintenanceRequestCommandHandler` throws `BusinessRuleException` when `_currentUser.PropertyId == null`. The global exception middleware (search `backend/src/PropertyManager.Api/Middleware` for the handler class — likely `GlobalExceptionHandlerMiddleware.cs` or similar) defines the mapping. Read it before writing AC-5's assertion and update the task's expected status (400, 409, or 422) to match the implemented mapping. **Do not hardcode 400 without verification.**

### Seeding maintenance requests with specific Status values

The API only creates `Submitted` requests. To test `?status=InProgress`/`Resolved`/`Dismissed` filtering, seed directly via `AppDbContext`:

```csharp
using var scope = _factory.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
dbContext.MaintenanceRequests.Add(new MaintenanceRequest
{
    AccountId = accountId,
    PropertyId = propertyId,
    SubmittedByUserId = userId,
    Description = "seeded",
    Status = MaintenanceRequestStatus.InProgress,
    CreatedAt = DateTime.UtcNow.AddMinutes(-10),
    UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
});
await dbContext.SaveChangesAsync();
```

`AuditableEntity` sets `CreatedAt`/`UpdatedAt` automatically via interceptor or `SaveChanges` override — check `AppDbContext.SaveChangesAsync` to confirm whether you need to set them explicitly. If AC-4.4 (ordering by CreatedAt desc) is flaky because seeded rows share a timestamp, bypass the auditor by setting explicit `DateTime.UtcNow.AddMinutes(-n)` values. Verify the interceptor behavior before writing the test — see `backend/src/PropertyManager.Infrastructure/Persistence/Interceptors/` or equivalent.

### Epic vs. controller reconciliation (READ THIS BEFORE CODING)

Epic 21 Story 21.1 was written against an idealized API. The acceptance criteria in this story have been **rewritten to match the shipped contract** from `MaintenanceRequestsController.cs` and the handlers. Key deltas from the epic text:

| Epic statement | Actual behavior | Story AC |
|---|---|---|
| "POST enforces tenant→property linkage, returns 403 if not linked" | Tenants post without a property in the body; `PropertyId` comes from JWT claim. If the claim is missing, the handler throws `BusinessRuleException` → 400 (not 403). There is no "tenant posts for a different property" codepath. | AC-5 tests the BusinessRuleException path |
| "Tenant GET returns only the tenant's OWN requests" | Handler filters by `PropertyId` only, not by `SubmittedByUserId` — Story 20.3 AC #5 explicitly says "shared visibility — all requests for their property". | AC-7 tests shared property visibility |
| "GET /properties/{id}/maintenance-request" | No such endpoint. Filter via `GET /maintenance-requests?propertyId={id}`. | AC-10 tests the query-param filter |
| "GET /{id} returns 404 for different-tenant access" | Handler returns 404 when the request's `PropertyId` differs from the tenant's `PropertyId`. This does match — good. | AC-14 tests this |

**If the team later decides "tenant sees only their own requests" is the desired behavior, that is a separate Story (update the handler + tests together). Do not change `GetMaintenanceRequestsQueryHandler` in this story.**

### File to create

- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` — single file, one class `MaintenanceRequestsControllerTests`. Estimated ~30 test methods + helpers. If it grows past ~800 lines during dev, split by endpoint into `MaintenanceRequestsControllerCreateTests.cs` / `...GetAllTests.cs` / `...GetByIdTests.cs` / `...TenantPropertyTests.cs` — mirrors the Vendors split pattern and the Expenses split pattern.

### Files to modify

- `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` — add `CreateTenantUserInAccountAsync` and `CreatePropertyInAccountAsync`. Preserve existing signatures.

### Previous Story Intelligence

**Story 20.3 (done)** — Built the MaintenanceRequest entity, CRUD API, permissions policy wiring, and handler-level unit tests. Its Task 11 notes the controller has the exact four endpoints used here. The integration test gap it left is what this story fills.

**Story 20.4 (done)** — Built `MaintenanceRequestPhotosController`. Integration tests for photos are **Story 21.2**, not here. But the `photos` collection on the `MaintenanceRequestDto` returned by `GET /{id}` (AC-12) is populated by `GetMaintenanceRequestByIdHandler` calling `IPhotoService.GetPhotoUrlAsync` — `FakeStorageService` in the test factory already returns deterministic URLs for this, so your AC-12 assertion should expect a non-null `viewUrl` format like `https://test-bucket.s3.amazonaws.com/...?presigned=download` if a photo is seeded.

**Story 20.5 (done)** — Tenant dashboard. No direct overlap with this story's scope, but the `GET /api/v1/maintenance-requests/tenant-property` endpoint (AC-15) was added in 20.5, not 20.3. Read `GetTenantProperty.cs` to confirm the DTO shape and non-tenant behavior (404? 200 with a sentinel?) before asserting AC-15/Task 7.

**Story 20.6 (done)** — Tenant submit-request UI. This is the frontend caller of `POST /maintenance-requests`. Its E2E coverage gap is **Story 21.4**, not here.

**Story 21.6 (backlog — Vendors integration GET/PUT)** — Follows the same extension pattern (extend existing Vendor test files). Helpful to remember this story's factory changes (`CreateTenantUserInAccountAsync` etc.) shouldn't block 21.6.

**Epic 18 Story 18.1 (done)** — Upgraded MockQueryable.Moq to v10. Not relevant for integration tests (no mocking), but if you find yourself reaching for DbSet mocks, stop — this is the *integration* layer.

### Git / PR intelligence

Recent merged PRs (see `git log --oneline -15`): 
- #370 (5cf6cfc) — Story 20.6 tenant submit UI
- #369 (99595e9) — Story 20.5 tenant dashboard
- #368 (5ab8eb4) — Story 20.4 maintenance request photos

None of these added integration tests for `MaintenanceRequestsController`, confirming the gap. Before opening the PR for this story, run `gh pr list --state merged --limit 5 --search "MaintenanceRequests"` to confirm no concurrent work.

### References

- [MaintenanceRequestsController source](../../backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs) — all four endpoints and their attributes
- [CreateMaintenanceRequest.cs](../../backend/src/PropertyManager.Application/MaintenanceRequests/CreateMaintenanceRequest.cs) — handler logic and BusinessRuleException path (AC-5)
- [GetMaintenanceRequests.cs](../../backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequests.cs) — role-based filtering, status parse, propertyId filter, pagination
- [GetMaintenanceRequestById.cs](../../backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs) — 404-on-cross-property-tenant-access behavior
- [GetTenantProperty.cs](../../backend/src/PropertyManager.Application/MaintenanceRequests/GetTenantProperty.cs) — AC-15 contract (read before asserting)
- [PropertyManagerWebApplicationFactory.cs](../../backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs) — factory being extended
- [VendorsControllerCreateTests.cs](../../backend/tests/PropertyManager.Api.Tests/VendorsControllerCreateTests.cs) — PRIMARY PATTERN REFERENCE
- [VendorsControllerDeleteTests.cs](../../backend/tests/PropertyManager.Api.Tests/VendorsControllerDeleteTests.cs) — soft-delete + cross-account 404 pattern
- [PermissionEnforcementTests.cs](../../backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs) — multi-user same-account pattern (Owner + Contributor)
- [RolePermissions.cs](../../backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs) — role → permission mapping
- [ApplicationUser.cs](../../backend/src/PropertyManager.Infrastructure/Identity/ApplicationUser.cs) — `PropertyId` field for tenant users
- [Story 20.3](../epic-20/20-3-maintenance-request-entity-api.md) — original entity/API story including the "shared visibility" design decision (AC #5)
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic
- [project-context.md](../../project-context.md) — testing conventions, naming, anti-patterns
- [ASP.NET Core 10 Integration Tests (Microsoft Learn)](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit) — WebApplicationFactory + IClassFixture reference
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit that spawned this epic

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- Initial build after factory extension + test skeleton failed with `CS9051` ("File-local type cannot be used in a member signature in non-file-local type"). Root cause: `TenantContext` was declared as `file record` but used as the return type of a private instance method on the non-file-scoped test class. Fix: move `TenantContext` to a `private sealed record` nested inside the test class; drop the no-longer-needed `TupleExtensions` shim.
- AC-5 (`BusinessRuleException` status-code mapping): verified against `GlobalExceptionHandlerMiddleware.GetErrorDetails` — `BusinessRuleException => StatusCodes.Status400BadRequest`. Used 400 assertions.
- Task 7.3 (non-tenant behavior of `/tenant-property`): verified against `GetTenantPropertyQueryHandler` — throws `BusinessRuleException` for any role other than `"Tenant"`. Maps to 400 per middleware. Asserted 400 + message contains "Tenant".
- Ordering test (Task 4.4): `AppDbContext.UpdateAuditFields` forces `CreatedAt = utcNow` on `EntityState.Added` but only touches `UpdatedAt` on `Modified`. Achieved deterministic timestamps by inserting, then setting `entity.CreatedAt = explicit` and calling SaveChangesAsync a second time — the second save updates the row with our explicit `CreatedAt` because the interceptor's Modified branch does not overwrite it.

### Completion Notes List

- All 27 new integration tests pass on first run.
- Full backend test suite: 1845 total, 0 failures, 0 skipped (1189 Application + 98 Infrastructure + 558 Api).
- Factory extensions (`CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`) are additive — existing 15+ test files that rely on `CreateTestUserAsync` / `CreateTestUserInAccountAsync` are unaffected (558 Api tests passing end-to-end).
- No controller, handler, validator, or domain code was modified. This story is test-only, per the Dev Notes.
- Response records are defined at the test boundary (`file`-scoped) rather than re-importing Application DTOs — intentional, so HTTP contract changes fail loudly here.
- The Dev Notes' "epic vs. controller reconciliation" was honored as written. The shipped tenant-shared-visibility behavior (AC-7) and `GetTenantProperty` non-tenant 400 (AC-15 Task 7.3) match the story's reconciled specs.

### File List

**New:**
- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` — 27 integration tests covering POST, GET list, GET by id, GET tenant-property across all role/account/property/status/pagination branches.

**Modified:**
- `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` — added `CreateTenantUserInAccountAsync(accountId, propertyId, email, password?)` and `CreatePropertyInAccountAsync(accountId, name?, street?, city?, state?, zipCode?)` helpers. Existing public signatures preserved.
- `docs/project/sprint-status.yaml` — 21-1 moved from `ready-for-dev` → `in-progress` → `review`.
