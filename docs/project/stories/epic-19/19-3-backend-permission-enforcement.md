# Story 19.3: Backend Permission Enforcement

Status: done

## Story

As a Contributor,
I should be blocked from owner-only operations,
so that the system enforces role boundaries at the API level.

## Acceptance Criteria

1. **Given** I am logged in as a Contributor
   **When** I call `POST /api/v1/properties` (create property)
   **Then** I receive 403 Forbidden

2. **Given** I am logged in as a Contributor
   **When** I call `PUT /api/v1/properties/{id}` or `DELETE /api/v1/properties/{id}`
   **Then** I receive 403 Forbidden

3. **Given** I am logged in as a Contributor
   **When** I call any Expenses endpoint (GET, POST, PUT, DELETE)
   **Then** I receive 403 Forbidden

4. **Given** I am logged in as a Contributor
   **When** I call any Income endpoint
   **Then** I receive 403 Forbidden

5. **Given** I am logged in as a Contributor
   **When** I call any Vendors endpoint
   **Then** I receive 403 Forbidden

6. **Given** I am logged in as a Contributor
   **When** I call `GET /api/v1/properties` (list for dropdowns)
   **Then** I receive 200 OK with property data

7. **Given** I am logged in as a Contributor
   **When** I call `GET /api/v1/receipts` or `POST /api/v1/receipts`
   **Then** I receive 200 OK / 201 Created (Contributors can view and upload receipts)

8. **Given** I am logged in as a Contributor
   **When** I call `POST /api/v1/receipts/{id}/process`
   **Then** I receive 403 Forbidden (only Owners can process receipts into expenses)

9. **Given** I am logged in as an Owner
   **When** I call any endpoint
   **Then** I receive normal responses (no permission restrictions)

10. **Given** I am logged in as a Contributor
    **When** I call `GET /api/v1/work-orders` or `GET /api/v1/work-orders/{id}`
    **Then** I receive 200 OK (Contributors can view work orders)

11. **Given** I am logged in as a Contributor
    **When** I call `POST /api/v1/work-orders` or `PUT /api/v1/work-orders/{id}` or `DELETE /api/v1/work-orders/{id}`
    **Then** I receive 403 Forbidden (Contributors cannot create/edit/delete work orders — they can only EditStatus and AddNotes)

12. **Given** I am logged in as a Contributor
    **When** I call Reports endpoints (GET, POST)
    **Then** I receive 403 Forbidden

## Tasks / Subtasks

- [x] Task 1: Register authorization policies in Program.cs (AC: all)
  - [x] 1.1 Add authorization policies to `builder.Services.AddAuthorization()` call in `backend/src/PropertyManager.Api/Program.cs`
  - [x] 1.2 Register policies using `RequireAssertion` that resolves `IPermissionService` from `HttpContext.RequestServices`:
    - `"CanManageProperties"` — checks `Permissions.Properties.Create` (for CUD operations)
    - `"CanViewProperties"` — checks `Permissions.Properties.ViewList` (for GET list)
    - `"CanAccessExpenses"` — checks `Permissions.Expenses.View`
    - `"CanAccessIncome"` — checks `Permissions.Income.View`
    - `"CanAccessVendors"` — checks `Permissions.Vendors.View`
    - `"CanAccessReceipts"` — checks `Permissions.Receipts.ViewAll`
    - `"CanProcessReceipts"` — checks `Permissions.Receipts.Process`
    - `"CanManageWorkOrders"` — checks `Permissions.WorkOrders.Create` (for CUD operations)
    - `"CanViewWorkOrders"` — checks `Permissions.WorkOrders.View`
    - `"CanAccessReports"` — checks `Permissions.Reports.View`
    - `"CanManageUsers"` — checks `Permissions.Users.View` (for Story 19.4)
  - [x] 1.3 Write unit test: verify policy registration does not break app startup (covered by integration tests)

- [x] Task 2: Enforce permissions on PropertiesController (AC: #1, #2, #6, #9)
  - [x] 2.1 Add `[Authorize(Policy = "CanManageProperties")]` to `CreateProperty`, `UpdateProperty`, `DeleteProperty` actions
  - [x] 2.2 Add `[Authorize(Policy = "CanViewProperties")]` to `GetAllProperties` action
  - [x] 2.3 Add `[Authorize(Policy = "CanManageProperties")]` to `GetPropertyById` action (Owner-only detail view per AC)
  - [x] 2.4 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all restricted actions

- [x] Task 3: Enforce permissions on ExpensesController (AC: #3, #9)
  - [x] 3.1 Add `[Authorize(Policy = "CanAccessExpenses")]` at **class level** on `ExpensesController` (all endpoints are Owner-only)
  - [x] 3.2 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all actions

- [x] Task 4: Enforce permissions on IncomeController (AC: #4, #9)
  - [x] 4.1 Add `[Authorize(Policy = "CanAccessIncome")]` at **class level** on `IncomeController`
  - [x] 4.2 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all actions

- [x] Task 5: Enforce permissions on VendorsController and VendorTradeTagsController and VendorPhotosController (AC: #5, #9)
  - [x] 5.1 Add `[Authorize(Policy = "CanAccessVendors")]` at **class level** on `VendorsController`
  - [x] 5.2 Add `[Authorize(Policy = "CanAccessVendors")]` at **class level** on `VendorTradeTagsController`
  - [x] 5.3 Add `[Authorize(Policy = "CanAccessVendors")]` at **class level** on `VendorPhotosController`
  - [x] 5.4 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all actions

- [x] Task 6: Enforce permissions on ReceiptsController (AC: #7, #8, #9)
  - [x] 6.1 Add `[Authorize(Policy = "CanAccessReceipts")]` at **class level** on `ReceiptsController` (Contributors can view + upload)
  - [x] 6.2 Add `[Authorize(Policy = "CanProcessReceipts")]` on `ProcessReceipt` action only (overrides class-level policy — Owner-only)
  - [x] 6.3 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to `ProcessReceipt`

- [x] Task 7: Enforce permissions on WorkOrdersController and sub-controllers (AC: #10, #11, #9)
  - [x] 7.1 Add `[Authorize(Policy = "CanViewWorkOrders")]` at **class level** on `WorkOrdersController` (Contributors can view)
  - [x] 7.2 Add `[Authorize(Policy = "CanManageWorkOrders")]` on `CreateWorkOrder`, `UpdateWorkOrder`, `DeleteWorkOrder` actions (Owner-only CUD)
  - [x] 7.3 Add `[Authorize(Policy = "CanViewWorkOrders")]` at class level on `WorkOrderPhotosController` (Contributors can view photos; Owners manage)
  - [x] 7.4 Add `[Authorize(Policy = "CanManageWorkOrders")]` on write actions in `WorkOrderPhotosController` (upload, delete, set-primary, reorder)
  - [x] 7.5 Add `[Authorize(Policy = "CanManageWorkOrders")]` at class level on `WorkOrderTagsController` (Owner-only tag management)
  - [x] 7.6 `NotesController` — Contributors can add notes (`WorkOrders.AddNotes` permission). Add `[Authorize(Policy = "CanViewWorkOrders")]` at class level. The handler-level permission check for note creation is out of scope — Notes are polymorphic and require entity-type awareness. For now, allow Contributors to add notes to any entity they can access.
  - [x] 7.7 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all restricted actions

- [x] Task 8: Enforce permissions on ReportsController (AC: #12, #9)
  - [x] 8.1 Add `[Authorize(Policy = "CanAccessReports")]` at **class level** on `ReportsController`
  - [x] 8.2 Add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]` to all actions

- [x] Task 9: Enforce permissions on PropertyPhotosController and PhotosController (AC: #2 extension)
  - [x] 9.1 Add `[Authorize(Policy = "CanManageProperties")]` at **class level** on `PropertyPhotosController` (Owner-only property photo management)
  - [x] 9.2 `PhotosController` — this is a shared photo thumbnail endpoint. Keep it as-is (authenticated only, no role restriction).

- [x] Task 10: Update InvitationsController (cleanup)
  - [x] 10.1 Replace existing `[Authorize(Roles = "Owner")]` on `CreateInvitation` with `[Authorize(Policy = "CanManageUsers")]` for consistency with the new policy-based system
  - [x] 10.2 Verify validate and accept invitation endpoints remain unauthenticated (public endpoints)

- [x] Task 11: DashboardController — permission tiering (AC: #9)
  - [x] 11.1 Dashboard shows financial data (expense totals, income totals). Add `[Authorize(Policy = "CanAccessExpenses")]` at **class level** since it aggregates Owner-only financial data.
  - [x] 11.2 Alternative: Leave Dashboard accessible to all roles but return limited data for Contributors. **Decision: restrict to Owners** — Contributors don't need the financial dashboard. Story 19.5 will handle Contributor-specific dashboard/redirect.

- [x] Task 12: Integration tests — Owner gets 200, Contributor gets 403 (AC: all)
  - [x] 12.1 Create `backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs`
  - [x] 12.2 Test helper: `CreateOwnerAndContributorInSameAccount()` — creates an Owner user and a Contributor user in the same account, returns both access tokens
  - [x] 12.3 Test: `PropertiesCreate_AsOwner_Returns201` — Owner can create property
  - [x] 12.4 Test: `PropertiesCreate_AsContributor_Returns403` — Contributor blocked from creating property
  - [x] 12.5 Test: `PropertiesGetAll_AsContributor_Returns200` — Contributor can list properties
  - [x] 12.6 Test: `PropertiesGetById_AsContributor_Returns403` — Contributor blocked from property detail
  - [x] 12.7 Test: `PropertiesUpdate_AsContributor_Returns403` — Contributor blocked from editing property
  - [x] 12.8 Test: `PropertiesDelete_AsContributor_Returns403` — Contributor blocked from deleting property
  - [x] 12.9 Test: `ExpensesGetAll_AsContributor_Returns403` — Contributor blocked from expenses
  - [x] 12.10 Test: `IncomeGetAll_AsContributor_Returns403` — Contributor blocked from income
  - [x] 12.11 Test: `VendorsGetAll_AsContributor_Returns403` — Contributor blocked from vendors
  - [x] 12.12 Test: `ReceiptsGetAll_AsContributor_Returns200` — Contributor can view receipts
  - [x] 12.13 Test: `ReceiptsCreate_AsContributor_Returns201` — Contributor can upload receipts
  - [x] 12.14 Test: `ReceiptsProcess_AsContributor_Returns403` — Contributor blocked from processing receipts
  - [x] 12.15 Test: `WorkOrdersGetAll_AsContributor_Returns200` — Contributor can view work orders
  - [x] 12.16 Test: `WorkOrdersCreate_AsContributor_Returns403` — Contributor blocked from creating work orders
  - [x] 12.17 Test: `ReportsGenerate_AsContributor_Returns403` — Contributor blocked from reports
  - [x] 12.18 Test: `DashboardGetTotals_AsContributor_Returns403` — Contributor blocked from dashboard
  - [x] 12.19 Test: `InvitationsCreate_AsContributor_Returns403` — Contributor blocked from creating invitations

- [x] Task 13: Unit tests for policy registration verification (AC: all)
  - [x] 13.1 Create `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs`
  - [x] 13.2 Test: verify all policy names used in `[Authorize(Policy = "...")]` attributes are actually registered — use reflection to scan controllers for policy names and verify they exist in the registered policies

- [x] Task 14: Verify existing tests still pass (AC: #9)
  - [x] 14.1 Run `dotnet test` — all existing tests should pass (existing tests use Owner role by default)
  - [x] 14.2 Verify no regressions in invitation flow tests

## Dev Notes

### Architecture Decision: Policy-Based Authorization via `[Authorize(Policy = "...")]`

**Chosen approach:** Register ASP.NET Core authorization policies in `Program.cs` using `RequireAssertion`, then apply `[Authorize(Policy = "...")]` attributes at controller/action level.

**Why policies over handler-level `IPermissionService` checks:**
1. **Declarative and visible** — scanning a controller instantly shows what's restricted
2. **ASP.NET Core native** — leverages the built-in authorization middleware, returns proper 403 automatically
3. **Consistent with existing pattern** — `InvitationsController` already uses `[Authorize(Roles = "Owner")]`, policies are the evolution of this
4. **Swagger/NSwag awareness** — `[Authorize]` attributes flow into generated API docs
5. **Separation of concerns** — controllers declare what permission is needed, `IPermissionService` resolves it

**Why NOT pure handler-level enforcement:**
- Would require try/catch or `ForbiddenAccessException` in every handler
- Would not short-circuit before model binding and validation
- Would not show up in Swagger

### Policy Registration Pattern (Verified via Ref MCP)

ASP.NET Core 10 `AddAuthorization()` supports inline `RequireAssertion` with a `Func<AuthorizationHandlerContext, bool>`:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanManageProperties", policy =>
        policy.RequireAssertion(context =>
        {
            var permissionService = context.Resource is HttpContext httpContext
                ? httpContext.RequestServices.GetRequiredService<IPermissionService>()
                : null;
            return permissionService?.HasPermission(Permissions.Properties.Create) ?? false;
        }));
});
```

**Critical:** The `context.Resource` is an `HttpContext` in ASP.NET Core MVC (verified in docs). Use `GetRequiredService<IPermissionService>()` to resolve the scoped service from the request's DI scope. Do NOT inject `IPermissionService` at registration time — it is scoped (depends on `ICurrentUser` which reads from the current request's JWT).

**Alternative pattern (simpler, preferred):** Use `RequireAuthenticatedUser()` combined with `RequireAssertion()`:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanManageProperties", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            if (context.Resource is HttpContext httpContext)
            {
                var permissionService = httpContext.RequestServices.GetRequiredService<IPermissionService>();
                return permissionService.HasPermission(Permissions.Properties.Create);
            }
            return false;
        });
    });
});
```

### Policy-to-Permission Mapping

| Policy Name | Permission Checked | Who Has It |
|---|---|---|
| `CanManageProperties` | `Permissions.Properties.Create` | Owner only |
| `CanViewProperties` | `Permissions.Properties.ViewList` | Owner + Contributor |
| `CanAccessExpenses` | `Permissions.Expenses.View` | Owner only |
| `CanAccessIncome` | `Permissions.Income.View` | Owner only |
| `CanAccessVendors` | `Permissions.Vendors.View` | Owner only |
| `CanAccessReceipts` | `Permissions.Receipts.ViewAll` | Owner + Contributor |
| `CanProcessReceipts` | `Permissions.Receipts.Process` | Owner only |
| `CanManageWorkOrders` | `Permissions.WorkOrders.Create` | Owner only |
| `CanViewWorkOrders` | `Permissions.WorkOrders.View` | Owner + Contributor |
| `CanAccessReports` | `Permissions.Reports.View` | Owner only |
| `CanManageUsers` | `Permissions.Users.View` | Owner only |

### Controller Enforcement Map

| Controller | Class-Level Policy | Action-Level Overrides |
|---|---|---|
| `PropertiesController` | (none — mixed) | `GetAllProperties`: `CanViewProperties`, `GetPropertyById`/`CreateProperty`/`UpdateProperty`/`DeleteProperty`: `CanManageProperties` |
| `ExpensesController` | `CanAccessExpenses` | — |
| `IncomeController` | `CanAccessIncome` | — |
| `VendorsController` | `CanAccessVendors` | — |
| `VendorTradeTagsController` | `CanAccessVendors` | — |
| `VendorPhotosController` | `CanAccessVendors` | — |
| `ReceiptsController` | `CanAccessReceipts` | `ProcessReceipt`: `CanProcessReceipts` |
| `WorkOrdersController` | `CanViewWorkOrders` | `CreateWorkOrder`/`UpdateWorkOrder`/`DeleteWorkOrder`: `CanManageWorkOrders` |
| `WorkOrderPhotosController` | `CanViewWorkOrders` | write actions: `CanManageWorkOrders` |
| `WorkOrderTagsController` | `CanManageWorkOrders` | — |
| `NotesController` | `CanViewWorkOrders` | — (polymorphic — allow Contributors to add notes) |
| `PropertyPhotosController` | `CanManageProperties` | — |
| `ReportsController` | `CanAccessReports` | — |
| `DashboardController` | `CanAccessExpenses` | — (financial data is Owner-only) |
| `InvitationsController` | (none — mixed) | `CreateInvitation`: `CanManageUsers` (replace `[Authorize(Roles = "Owner")]`) |
| `AuthController` | (no change) | — |
| `HealthController` | (no change) | — |
| `TestController` | (no change) | — |
| `PhotosController` | (no change) | — (shared thumbnail endpoint, authenticated only) |

### Multi-Policy on Controller + Action

When `[Authorize(Policy = "X")]` is at class level AND `[Authorize(Policy = "Y")]` is at action level, **both** policies must pass (verified via Ref MCP docs). This means:
- `WorkOrdersController` class-level `CanViewWorkOrders` + action-level `CanManageWorkOrders` — both check against the same user, Owner passes both, Contributor passes class-level but fails action-level. This works correctly.
- `ReceiptsController` class-level `CanAccessReceipts` + action-level `CanProcessReceipts` — Owner passes both, Contributor passes class-level but fails `CanProcessReceipts`. Correct.

### ASP.NET Core 403 Response Behavior

When an `[Authorize(Policy = "...")]` check fails for an authenticated user, ASP.NET Core returns **403 Forbidden** automatically (not 401). This is the built-in behavior — no custom middleware needed.

**Important:** The JWT Bearer authentication scheme must be configured for this to work correctly. All controllers already have `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` at class level, which handles 401 for unauthenticated requests. The policy attribute adds the 403 path for authenticated-but-unauthorized requests.

### Integration Test Pattern

Follow the pattern from `InvitationsControllerTests`:
1. Use `PropertyManagerWebApplicationFactory` with `IClassFixture`
2. `CreateTestUserAsync(email, password, role)` creates a user with a new account
3. `CreateTestUserInAccountAsync(accountId, email, password, role)` creates a user in an existing account
4. `GetAccessTokenAsync(email, password)` — login via `/api/v1/auth/login` to get JWT token
5. `PostAsJsonWithAuthAsync(url, body, token)` — helper to make authenticated requests

**Key for this story:** Create both Owner and Contributor in the **same account** so the Contributor can actually see shared data (properties for dropdown, receipts, work orders). Use `CreateTestUserAsync` for the Owner, then `CreateTestUserInAccountAsync(accountId, ...)` for the Contributor.

**Test setup helper:**
```csharp
private async Task<(string OwnerToken, string ContributorToken, Guid AccountId)> CreateOwnerAndContributorInSameAccountAsync()
{
    var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
    var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";

    var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
    await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, "Test@123456", "Contributor");

    var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");
    var contributorToken = await GetAccessTokenAsync(contributorEmail, "Test@123456");

    return (ownerToken, contributorToken, accountId);
}
```

### Key Files to Modify

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Api/Program.cs` | Replace `AddAuthorization()` with policy registrations |
| `backend/src/PropertyManager.Api/Controllers/PropertiesController.cs` | Add policy attributes to actions |
| `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/IncomeController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/VendorsController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/VendorTradeTagsController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/VendorPhotosController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/ReceiptsController.cs` | Add class-level + action-level policies |
| `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs` | Add class-level + action-level policies |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs` | Add class-level + action-level policies |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderTagsController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/NotesController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/PropertyPhotosController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/ReportsController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/DashboardController.cs` | Add class-level policy |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Replace `[Authorize(Roles = "Owner")]` with `[Authorize(Policy = "CanManageUsers")]` |

### New Files

| File | Purpose |
|------|---------|
| `backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs` | Integration tests for all permission boundaries |

### Critical Implementation Details

**`using` statements needed in Program.cs:**
```csharp
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Authorization;
```

**Policy helper to reduce boilerplate in Program.cs:**
```csharp
// Helper method to create permission-based policies
void AddPermissionPolicy(AuthorizationOptions options, string policyName, string permission)
{
    options.AddPolicy(policyName, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            if (context.Resource is HttpContext httpContext)
            {
                var permissionService = httpContext.RequestServices.GetRequiredService<IPermissionService>();
                return permissionService.HasPermission(permission);
            }
            return false;
        });
    });
}
```

Then call it for each policy:
```csharp
builder.Services.AddAuthorization(options =>
{
    AddPermissionPolicy(options, "CanManageProperties", Permissions.Properties.Create);
    AddPermissionPolicy(options, "CanViewProperties", Permissions.Properties.ViewList);
    // ... etc
});
```

**No database migration needed.** This story is pure authorization attribute/policy enforcement.

**No frontend changes.** Story 19.5 handles frontend permission-aware UI.

### Existing Tests and Backward Compatibility

All existing integration tests create users with `role: "Owner"` by default (see `CreateTestUserAsync` which defaults to `"Owner"`). This means all existing tests will continue to pass — Owner role has all permissions, so adding policies will not break any existing test.

The `InvitationsControllerTests` already test that a non-Owner gets 403 when creating an invitation (using `CreateTestUserAsync(email, password, "Member")`). The migration from `[Authorize(Roles = "Owner")]` to `[Authorize(Policy = "CanManageUsers")]` should produce the same 403 behavior.

### Testing Pyramid

- **Unit tests:** Policy registration verification via reflection (verify all policy names in attributes are registered)
- **Integration tests:** WebApplicationFactory + Testcontainers — test every protected endpoint as both Owner (200) and Contributor (403)
- **No E2E tests:** This is backend-only enforcement. E2E tests for Contributor behavior will be in Story 19.5 (frontend permission service).

### Previous Story Intelligence

From Story 19.1:
- **Test factory helpers:** `CreateTestUserAsync(email, password, role)` and `CreateTestUserInAccountAsync(accountId, email, password, role)` — both available and working
- **Login returns JWT with `role` claim:** Verified in `JwtService` — the role is in the token, and `CurrentUserService` reads it
- **`[Authorize(Roles = "Owner")]` returns 403:** Already proven by `CreateInvitation_WithNonOwnerRole_Returns403` test

From Story 19.2:
- **`IPermissionService` is registered as scoped** in DI — this means it can be resolved from `HttpContext.RequestServices` in `RequireAssertion`
- **`ForbiddenAccessException` is mapped to 403** in `GlobalExceptionHandlerMiddleware` — available as fallback if handler-level checks are needed
- **`PermissionService` depends on `ICurrentUser`** which is also scoped — reads role from JWT claims of the current request

### WorkOrdersController Special Handling

The `WorkOrdersController` has a `GenerateWorkOrderPdf` action that uses the `GenerateWorkOrderPdfQuery`. This is a report-like endpoint but it's a work order feature. Since Contributors can view work orders, they should be able to generate a PDF of a work order. Apply `CanViewWorkOrders` (not `CanManageWorkOrders`) to the PDF generation action.

Check for `UpdateWorkOrderStatus` action — if it exists as a separate action, it should be `CanViewWorkOrders` level since Contributors have `WorkOrders.EditStatus`. If status updates go through the general `UpdateWorkOrder` action, this needs handler-level logic in Story 19.5 or a future refinement.

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.3 requirements and ACs |
| `docs/project/stories/epic-19/19-2-permission-infrastructure.md` | Permission constants, PermissionService, ForbiddenAccessException |
| `docs/project/stories/epic-19/19-1-refactor-invitation-join-account.md` | Test factory helpers, JWT role claims |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` | Permission constants |
| `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` | Role-to-permission mapping |
| `backend/src/PropertyManager.Application/Common/Interfaces/IPermissionService.cs` | Service interface |
| `backend/src/PropertyManager.Infrastructure/Identity/PermissionService.cs` | Service implementation |
| `backend/src/PropertyManager.Api/Program.cs` | Line 159: current `AddAuthorization()` call, line 66: `IPermissionService` DI registration |
| `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` | `ForbiddenAccessException` → 403 mapping |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Line 48: existing `[Authorize(Roles = "Owner")]` to replace |
| `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` | Test helpers: `CreateTestUserAsync`, `CreateTestUserInAccountAsync` |
| `backend/tests/PropertyManager.Api.Tests/InvitationsControllerTests.cs` | Pattern for integration tests with auth |
| ASP.NET Core 10 Policy-based authorization docs | `RequireAssertion` pattern, `context.Resource` as `HttpContext` |

## File List

### New Files
| File | Purpose |
|------|---------|
| `backend/tests/PropertyManager.Api.Tests/PermissionEnforcementTests.cs` | Integration tests for all permission boundaries (17 tests) |
| `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` | Unit tests verifying policy registration via reflection (2 tests) |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/PropertyManager.Api/Program.cs` | Added 11 authorization policies using `RequireAssertion` + `IPermissionService`, added helper method `AddPermissionPolicy` |
| `backend/src/PropertyManager.Api/Controllers/PropertiesController.cs` | Added action-level `CanManageProperties` and `CanViewProperties` policies + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs` | Added class-level `CanAccessExpenses` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/IncomeController.cs` | Added class-level `CanAccessIncome` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/VendorsController.cs` | Added class-level `CanAccessVendors` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/VendorTradeTagsController.cs` | Added class-level `CanAccessVendors` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/VendorPhotosController.cs` | Added class-level `CanAccessVendors` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/ReceiptsController.cs` | Added class-level `CanAccessReceipts` + action-level `CanProcessReceipts` on ProcessReceipt |
| `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs` | Added class-level `CanViewWorkOrders` + action-level `CanManageWorkOrders` on CUD actions |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs` | Added class-level `CanViewWorkOrders` + action-level `CanManageWorkOrders` on write actions |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderTagsController.cs` | Added class-level `CanManageWorkOrders` policy |
| `backend/src/PropertyManager.Api/Controllers/NotesController.cs` | Added class-level `CanViewWorkOrders` policy |
| `backend/src/PropertyManager.Api/Controllers/PropertyPhotosController.cs` | Added class-level `CanManageProperties` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/ReportsController.cs` | Added class-level `CanAccessReports` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/DashboardController.cs` | Added class-level `CanAccessExpenses` policy + 403 response types |
| `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` | Replaced `[Authorize(Roles = "Owner")]` with `[Authorize(Policy = "CanManageUsers")]` |
| `backend/tests/PropertyManager.Api.Tests/NotesControllerTests.cs` | Updated `UpdateNote_SameAccountDifferentUser_Returns404` test to use Owner role for User 2 |
| `backend/tests/PropertyManager.Application.Tests/PropertyManager.Application.Tests.csproj` | Added ProjectReference to PropertyManager.Api for reflection-based tests |
| `docs/project/sprint-status.yaml` | Updated 19-3 status to review |

## Dev Agent Record

### Implementation Notes
- All 14 tasks completed successfully
- 11 authorization policies registered in Program.cs using a helper method to reduce boilerplate
- Policy enforcement applied to 16 controllers using class-level and/or action-level `[Authorize(Policy = "...")]` attributes
- Mixed-policy controllers (PropertiesController, ReceiptsController, WorkOrdersController, WorkOrderPhotosController) use class-level for read access + action-level for write restrictions
- InvitationsController migrated from role-based `[Authorize(Roles = "Owner")]` to policy-based `[Authorize(Policy = "CanManageUsers")]`
- PhotosController left unchanged (shared thumbnail endpoint, authenticated only)

### Test Results
- **Unit tests:** 1,061 passed (including 2 new AuthorizationPolicyTests)
- **Infrastructure tests:** 96 passed
- **Integration tests:** 516 passed (including 17 new PermissionEnforcementTests)
- **Total: 1,673 tests, 0 failures**

### Regression Fix
- `NotesControllerTests.UpdateNote_SameAccountDifferentUser_Returns404` was updated to create User 2 with "Owner" role instead of default "Member", since the NotesController now requires `CanViewWorkOrders` policy (which Members don't have). The test's intent (verifying cross-user note isolation) is preserved.
