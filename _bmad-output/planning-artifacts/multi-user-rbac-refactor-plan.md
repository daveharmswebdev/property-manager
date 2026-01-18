# Multi-User Role-Based Access Control (RBAC) Refactor Plan

**Project:** Property Manager
**Date:** 2026-01-18
**Status:** Draft - Pending Approval
**Author:** Mary (Business Analyst) with Dave

---

## 1. Executive Summary

This plan outlines the refactor from a single-user-per-account model to a multi-user account model with role-based access control. The goal is to enable family members (or business partners) to share an account with differentiated permissions.

**Primary Use Case:** Dave and his wife are Account Owners with full control. Their adult son is a Contributor who uploads receipts and updates work orders during property maintenance, but cannot access financial data or administrative functions.

---

## 2. Current State Analysis

### 2.1 What Already Exists (Good News)

| Component | Status | Location |
|-----------|--------|----------|
| Account entity (tenant boundary) | ✅ Exists | `Domain/Entities/Account.cs` |
| Users linked to Account via `AccountId` | ✅ Exists | `Infrastructure/Identity/ApplicationUser.cs` |
| Data segregation by `AccountId` | ✅ Enforced | Global query filters in `AppDbContext.cs` |
| Role field on User | ✅ Exists | `ApplicationUser.Role` ("Owner" / "Contributor") |
| `CreatedByUserId` tracking | ✅ Exists | On Expense, Receipt, Income entities |
| JWT claim for role | ✅ Exists | `JwtService.cs` issues "role" claim |

### 2.2 The Gap

**Roles are stored but not enforced.** Currently, any authenticated user on an account has full access to all operations. The `Role` field is purely informational.

### 2.3 Current Entity Ownership

| Entity | Has `AccountId` | Has `CreatedByUserId` | Has Soft Delete |
|--------|-----------------|----------------------|-----------------|
| Property | ✅ | ❌ | ✅ |
| Expense | ✅ | ✅ | ✅ |
| Receipt | ✅ | ✅ | ✅ |
| Income | ✅ | ✅ | ✅ |
| Vendor | ✅ | ❌ | ✅ |
| Lease | ✅ | ❌ | ✅ |
| Work Order | 🔜 Feature in development | TBD | TBD |

### 2.4 Receipt/Expense Workflow (Relevant to Contributor Role)

The system has a two-stage receipt workflow that aligns perfectly with the Contributor use case:

```
STAGE 1 - Upload (Contributor can do this):
┌─────────────────────────────────────────────────────────┐
│ CreateReceipt                                           │
│ - Stores file (StorageKey)                              │
│ - Optional: PropertyId (dropdown selection)             │
│ - Sets CreatedByUserId                                  │
│ - ProcessedAt = NULL (sits in unprocessed queue)        │
│ - ExpenseId = NULL (no expense created yet)             │
└─────────────────────────────────────────────────────────┘

STAGE 2 - Process (Owner does this later):
┌─────────────────────────────────────────────────────────┐
│ ProcessReceipt                                          │
│ - Creates Expense record (Amount, Date, Category)       │
│ - Links Expense ↔ Receipt bidirectionally               │
│ - Sets ProcessedAt = DateTime.UtcNow                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Target Architecture

### 3.1 Role Definitions

| Role | Description | Intended Users |
|------|-------------|----------------|
| **Owner** | Full administrative control over account data. Can manage users, properties, vendors, leases, expenses, income, and all settings. | Dave, Dave's wife |
| **Contributor** | Field worker role. Focused on receipt capture and work order execution. Limited read access, no financial or administrative access. | Dave's adult son |

### 3.2 User Management

- Account Owners can invite new users to their account
- Account Owners can assign roles (Owner or Contributor)
- Account Owners can remove users from their account
- Account Owners can change a user's role
- Contributors cannot manage users

### 3.3 Future Considerations (Out of Scope)

- **Viewer Role:** Read-only access for accountants or lessees. Not needed now.

- **Admin Role (System-Level):** A platform administrator role that operates *above* accounts. This is distinct from Owner (account-scoped) and would include:
  - Cross-account visibility and management
  - System configuration and settings
  - User/account provisioning (currently done via scripts/Postman/direct DB)
  - Platform metrics and monitoring
  - Admin UI for these operations

  *Current workaround:* Dave manages system-level operations via scripts, Postman API calls, and direct database access. A proper Admin role and UI would formalize this.

---

## 4. Permission Matrix

### 4.1 Owner Permissions

Full CRUD on all entities within their account.

| Entity | View | Create | Edit | Delete |
|--------|------|--------|------|--------|
| Properties | ✅ All | ✅ | ✅ | ✅ |
| Work Orders | ✅ All | ✅ | ✅ | ✅ |
| Receipts | ✅ All | ✅ | ✅ | ✅ |
| Expenses | ✅ All | ✅ | ✅ | ✅ |
| Vendors | ✅ All | ✅ | ✅ | ✅ |
| Leases | ✅ All | ✅ | ✅ | ✅ |
| Income | ✅ All | ✅ | ✅ | ✅ |
| Account Settings | ✅ | - | ✅ | - |
| User Management | ✅ All | ✅ Invite | ✅ Role | ✅ Remove |

### 4.2 Contributor Permissions

Focused, limited access for field work.

| Entity | View | Create | Edit | Delete |
|--------|------|--------|------|--------|
| Properties | ✅ List only (for dropdowns) | ❌ | ❌ | ❌ |
| Work Orders | ✅ Full details + photos | ❌ | ✅ Status + Add Notes only | ❌ |
| Receipts | ✅ All (transparency for team alignment) | ✅ Upload + bind to property | ❌ | ❌ |
| Expenses | ❌ | ❌ | ❌ | ❌ |
| Vendors | ❌ | ❌ | ❌ | ❌ |
| Leases | ❌ | ❌ | ❌ | ❌ |
| Income | ❌ | ❌ | ❌ | ❌ |
| Account Settings | ❌ | - | ❌ | - |
| User Management | ❌ | ❌ | ❌ | ❌ |

### 4.3 Contributor User Journey

```
1. Receives work order assignment (notification or verbal)
2. Opens app on phone
3. Views work order details (description, problem photos)
4. Performs repair work
5. At store (e.g., Home Depot), purchases supplies
6. In parking lot: Opens app → Uploads receipt photo
7. App prompts: "Which property?" (dropdown, optional)
8. App prompts: "Which work order?" (dropdown, optional, filtered by property)
9. Submits receipt
10. Can view own receipts to verify upload (avoid duplicates)
11. Updates work order: Adds note, changes status (New → In Progress → Done)
```

---

## 5. Backend Implementation Plan

### 5.1 Authorization Infrastructure

#### 5.1.1 Create Permission Constants

**File:** `PropertyManager.Domain/Authorization/Permissions.cs` (new)

```csharp
public static class Permissions
{
    public static class Properties
    {
        public const string View = "Properties.View";
        public const string ViewList = "Properties.ViewList";  // For dropdowns
        public const string Create = "Properties.Create";
        public const string Edit = "Properties.Edit";
        public const string Delete = "Properties.Delete";
    }

    public static class Receipts
    {
        public const string ViewOwn = "Receipts.ViewOwn";
        public const string ViewAll = "Receipts.ViewAll";
        public const string Create = "Receipts.Create";
        public const string Edit = "Receipts.Edit";
        public const string Delete = "Receipts.Delete";
        public const string Process = "Receipts.Process";
    }

    public static class WorkOrders
    {
        public const string View = "WorkOrders.View";
        public const string Create = "WorkOrders.Create";
        public const string Edit = "WorkOrders.Edit";
        public const string EditStatus = "WorkOrders.EditStatus";
        public const string AddNotes = "WorkOrders.AddNotes";
        public const string Delete = "WorkOrders.Delete";
    }

    // ... Expenses, Vendors, Leases, Income, Account, Users
}
```

#### 5.1.2 Create Role-Permission Mapping

**File:** `PropertyManager.Domain/Authorization/RolePermissions.cs` (new)

```csharp
public static class RolePermissions
{
    public static readonly Dictionary<string, string[]> Mappings = new()
    {
        ["Owner"] = new[]
        {
            // Full permissions on everything
            Permissions.Properties.View,
            Permissions.Properties.ViewList,
            Permissions.Properties.Create,
            Permissions.Properties.Edit,
            Permissions.Properties.Delete,
            // ... all other permissions
        },

        ["Contributor"] = new[]
        {
            // Limited permissions
            Permissions.Properties.ViewList,      // For dropdowns only
            Permissions.Receipts.ViewOwn,         // Own receipts only
            Permissions.Receipts.Create,          // Upload
            Permissions.WorkOrders.View,          // Full read
            Permissions.WorkOrders.EditStatus,    // Status changes
            Permissions.WorkOrders.AddNotes,      // Add notes
        }
    };
}
```

#### 5.1.3 Create Authorization Policies

**File:** `PropertyManager.Api/Authorization/AuthorizationPolicies.cs` (new)

Register policies in `Program.cs`:

```csharp
builder.Services.AddAuthorization(options =>
{
    // Property policies
    options.AddPolicy("CanViewProperties", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner")));

    options.AddPolicy("CanViewPropertyList", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner") ||
            context.User.HasClaim("role", "Contributor")));

    // Receipt policies
    options.AddPolicy("CanCreateReceipts", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner") ||
            context.User.HasClaim("role", "Contributor")));

    options.AddPolicy("CanProcessReceipts", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner")));

    // Work Order policies
    options.AddPolicy("CanUpdateWorkOrderStatus", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner") ||
            context.User.HasClaim("role", "Contributor")));

    options.AddPolicy("CanCreateWorkOrders", policy =>
        policy.RequireAssertion(context =>
            context.User.HasClaim("role", "Owner")));

    // ... additional policies
});
```

#### 5.1.4 Create IPermissionService Interface

**File:** `PropertyManager.Application/Common/Interfaces/IPermissionService.cs` (new)

```csharp
public interface IPermissionService
{
    bool HasPermission(string permission);
    bool IsOwner();
    bool IsContributor();
    Task<bool> CanAccessReceiptAsync(Guid receiptId);  // Own receipt check
}
```

#### 5.1.5 Implement PermissionService

**File:** `PropertyManager.Infrastructure/Identity/PermissionService.cs` (new)

```csharp
public class PermissionService : IPermissionService
{
    private readonly ICurrentUser _currentUser;
    private readonly AppDbContext _dbContext;

    public bool HasPermission(string permission)
    {
        var role = _currentUser.Role;
        return RolePermissions.Mappings.TryGetValue(role, out var permissions)
            && permissions.Contains(permission);
    }

    public bool IsOwner() => _currentUser.Role == "Owner";
    public bool IsContributor() => _currentUser.Role == "Contributor";

    public async Task<bool> CanAccessReceiptAsync(Guid receiptId)
    {
        if (IsOwner()) return true;

        // Contributors can only access their own receipts
        var receipt = await _dbContext.Receipts
            .Where(r => r.Id == receiptId)
            .Select(r => r.CreatedByUserId)
            .FirstOrDefaultAsync();

        return receipt == _currentUser.UserId;
    }
}
```

### 5.2 Handler Modifications

#### 5.2.1 Receipts - GetAllReceipts (No filtering needed)

**Note:** Contributors can view ALL receipts on the account for transparency. The existing global query filter by `AccountId` is sufficient - no additional role-based filtering required for viewing.

#### 5.2.2 Receipts - ProcessReceipt (Owner only)

**File:** `PropertyManager.Application/Receipts/ProcessReceipt.cs`

```csharp
public async Task<Guid> Handle(ProcessReceiptCommand request, ...)
{
    if (!_permissionService.HasPermission(Permissions.Receipts.Process))
    {
        throw new ForbiddenAccessException("Only owners can process receipts");
    }

    // ... rest of handler
}
```

#### 5.2.4 Properties - GetAllProperties (Filtered for Contributors)

**File:** `PropertyManager.Application/Properties/GetAllProperties.cs`

```csharp
public async Task<List<PropertyDto>> Handle(GetAllPropertiesQuery request, ...)
{
    // Contributors get minimal list (id, name only) for dropdowns
    if (_permissionService.IsContributor())
    {
        return await _dbContext.Properties
            .Select(p => new PropertyDto(p.Id, p.Name, null, null, null, ...))
            .ToListAsync();
    }

    // Owners get full property data
    // ... existing logic
}
```

#### 5.2.5 Create/Edit/Delete Operations (Owner only for most entities)

Add permission checks at the start of each handler:

```csharp
// Example: CreatePropertyCommandHandler
public async Task<Guid> Handle(CreatePropertyCommand request, ...)
{
    if (!_permissionService.HasPermission(Permissions.Properties.Create))
    {
        throw new ForbiddenAccessException();
    }

    // ... existing logic
}
```

### 5.3 Controller Modifications

Apply policy attributes to endpoints:

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PropertiesController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "CanViewPropertyList")]  // Both Owner and Contributor
    public async Task<ActionResult<List<PropertyDto>>> GetAll() { ... }

    [HttpGet("{id}")]
    [Authorize(Policy = "CanViewProperties")]    // Owner only
    public async Task<ActionResult<PropertyDto>> Get(Guid id) { ... }

    [HttpPost]
    [Authorize(Policy = "CanCreateProperties")]  // Owner only
    public async Task<ActionResult<Guid>> Create(...) { ... }

    // ... etc
}
```

### 5.4 New Endpoints for Contributor Workflow

#### 5.4.1 Properties Dropdown Endpoint

**File:** `PropertyManager.Api/Controllers/PropertiesController.cs`

```csharp
[HttpGet("dropdown")]
[Authorize(Policy = "CanViewPropertyList")]
public async Task<ActionResult<List<PropertyDropdownDto>>> GetDropdown()
{
    // Returns minimal data: Id, Name only
    // Accessible by both Owner and Contributor
}
```

### 5.5 User Management Endpoints (Owner Only)

**File:** `PropertyManager.Api/Controllers/AccountUsersController.cs` (new)

```csharp
[ApiController]
[Route("api/account/users")]
[Authorize(Policy = "CanManageUsers")]
public class AccountUsersController : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AccountUserDto>>> GetUsers() { ... }

    [HttpPost("invite")]
    public async Task<ActionResult> InviteUser(InviteUserCommand command) { ... }

    [HttpPut("{userId}/role")]
    public async Task<ActionResult> UpdateUserRole(Guid userId, UpdateUserRoleCommand command) { ... }

    [HttpDelete("{userId}")]
    public async Task<ActionResult> RemoveUser(Guid userId) { ... }
}
```

---

## 6. Frontend Implementation Plan

### 6.1 Auth State Enhancement

**File:** `src/app/core/auth/auth.state.ts`

```typescript
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  role: 'Owner' | 'Contributor' | null;  // Add role
}
```

### 6.2 Permission Service

**File:** `src/app/core/auth/permission.service.ts` (new)

```typescript
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private authStore = inject(AuthStore);

  isOwner(): boolean {
    return this.authStore.role() === 'Owner';
  }

  isContributor(): boolean {
    return this.authStore.role() === 'Contributor';
  }

  canAccessRoute(route: string): boolean {
    const ownerOnlyRoutes = [
      '/properties/new', '/properties/edit',
      '/vendors', '/leases', '/expenses', '/income',
      '/settings/users'
    ];

    if (this.isContributor() && ownerOnlyRoutes.some(r => route.startsWith(r))) {
      return false;
    }
    return true;
  }
}
```

### 6.3 Route Guards

**File:** `src/app/core/auth/owner.guard.ts` (new)

```typescript
export const ownerGuard: CanActivateFn = () => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  if (permissionService.isOwner()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
```

### 6.4 Route Configuration Updates

**File:** `src/app/app.routes.ts`

```typescript
export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },

  // Properties - mixed access
  { path: 'properties', component: PropertyListComponent },  // Both can access
  { path: 'properties/new', component: PropertyFormComponent, canActivate: [ownerGuard] },
  { path: 'properties/:id/edit', component: PropertyFormComponent, canActivate: [ownerGuard] },

  // Receipts - both can access (filtering handled by backend)
  { path: 'receipts', component: ReceiptListComponent },
  { path: 'receipts/upload', component: ReceiptUploadComponent },

  // Owner-only routes
  { path: 'expenses', component: ExpenseListComponent, canActivate: [ownerGuard] },
  { path: 'vendors', component: VendorListComponent, canActivate: [ownerGuard] },
  { path: 'leases', component: LeaseListComponent, canActivate: [ownerGuard] },
  { path: 'income', component: IncomeListComponent, canActivate: [ownerGuard] },
  { path: 'settings/users', component: UserManagementComponent, canActivate: [ownerGuard] },

  // Work orders - mixed access (when implemented)
  { path: 'work-orders', component: WorkOrderListComponent },
  { path: 'work-orders/new', component: WorkOrderFormComponent, canActivate: [ownerGuard] },
  { path: 'work-orders/:id', component: WorkOrderDetailComponent },  // Both can view
];
```

### 6.5 Navigation Menu (Role-Aware)

**File:** `src/app/shared/components/navigation/navigation.component.ts`

```typescript
@Component({...})
export class NavigationComponent {
  permissionService = inject(PermissionService);

  menuItems = computed(() => {
    const baseItems = [
      { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
      { label: 'Receipts', route: '/receipts', icon: 'receipt' },
    ];

    if (this.permissionService.isOwner()) {
      return [
        ...baseItems,
        { label: 'Properties', route: '/properties', icon: 'home' },
        { label: 'Expenses', route: '/expenses', icon: 'payments' },
        { label: 'Vendors', route: '/vendors', icon: 'store' },
        { label: 'Leases', route: '/leases', icon: 'description' },
        { label: 'Income', route: '/income', icon: 'attach_money' },
        { label: 'Users', route: '/settings/users', icon: 'people' },
      ];
    }

    // Contributor sees limited menu
    return [
      ...baseItems,
      { label: 'Work Orders', route: '/work-orders', icon: 'build' },
    ];
  });
}
```

### 6.6 UI Component Conditional Rendering

Use `@if` directives to hide actions:

```html
<!-- Property list - hide edit/delete for Contributors -->
<mat-card *ngFor="let property of properties()">
  <mat-card-title>{{ property.name }}</mat-card-title>

  @if (permissionService.isOwner()) {
    <button mat-icon-button (click)="edit(property)">
      <mat-icon>edit</mat-icon>
    </button>
    <button mat-icon-button (click)="delete(property)">
      <mat-icon>delete</mat-icon>
    </button>
  }
</mat-card>
```

### 6.7 Receipt Upload Component (Contributor-Friendly)

The existing upload flow should work with minimal changes:
- Property dropdown: Uses the new `/api/properties/dropdown` endpoint
- Work order dropdown: Filter by selected property (when feature exists)
- Both dropdowns are optional

---

## 7. Database Changes

### 7.1 No Schema Changes Required

The existing schema already supports multi-user accounts:
- `ApplicationUser.AccountId` links users to accounts
- `ApplicationUser.Role` stores the role
- `Receipt.CreatedByUserId` tracks receipt ownership
- Global query filters handle account-level data isolation

### 7.2 Potential Future Enhancement

If fine-grained audit logging is desired:

```sql
-- Optional: Audit log table for tracking who did what
CREATE TABLE AuditLogs (
    Id UUID PRIMARY KEY,
    AccountId UUID NOT NULL,
    UserId UUID NOT NULL,
    Action VARCHAR(50) NOT NULL,       -- 'Create', 'Update', 'Delete'
    EntityType VARCHAR(100) NOT NULL,  -- 'Receipt', 'Expense', etc.
    EntityId UUID NOT NULL,
    Timestamp TIMESTAMPTZ NOT NULL,
    Details JSONB
);
```

---

## 8. Migration Strategy

### 8.1 Existing Users

All existing users should be assigned the **Owner** role:

```sql
-- Migration script
UPDATE "AspNetUsers"
SET "Role" = 'Owner'
WHERE "Role" IS NULL OR "Role" = '';
```

### 8.2 Rollout Phases

| Phase | Scope | Risk |
|-------|-------|------|
| 1 | Backend permission infrastructure (policies, services) | Low - additive |
| 2 | Handler modifications with permission checks | Medium - test thoroughly |
| 3 | Controller policy attributes | Low - builds on Phase 2 |
| 4 | Frontend permission service and guards | Low - UX only |
| 5 | User management UI (invite, role assignment) | Low - new feature |
| 6 | Work Order integration (when feature lands) | Low - new feature |

### 8.3 Feature Flag Option

Consider using a feature flag to enable RBAC gradually:

```csharp
if (_featureFlags.IsEnabled("MultiUserRbac"))
{
    // Apply permission checks
}
else
{
    // Legacy behavior - all authenticated users have full access
}
```

---

## 9. Work Order Integration Notes

Work Orders are currently in development. When the feature lands:

### 9.1 Work Order Entity Should Include

```csharp
public class WorkOrder : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public WorkOrderStatus Status { get; set; }  // New, InProgress, Done
    public Guid? AssignedToUserId { get; set; }  // Optional: assign to Contributor
    public Guid CreatedByUserId { get; set; }

    // Navigation
    public ICollection<WorkOrderNote> Notes { get; set; }
    public ICollection<WorkOrderPhoto> Photos { get; set; }
    public ICollection<Receipt> LinkedReceipts { get; set; }
}
```

### 9.2 Work Order Permissions

- **Owner:** Full CRUD
- **Contributor:**
  - View all work orders (or only assigned ones - design decision)
  - Update status
  - Add notes
  - Cannot create, delete, or edit core details

### 9.3 Receipt-Work Order Binding

Extend `Receipt` entity:

```csharp
public Guid? WorkOrderId { get; set; }  // Add to Receipt entity
public WorkOrder? WorkOrder { get; set; }
```

Update `CreateReceiptCommand`:

```csharp
public record CreateReceiptCommand(
    string StorageKey,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null,
    Guid? WorkOrderId = null  // Add work order binding
) : IRequest<Guid>;
```

---

## 10. Testing Considerations

### 10.1 Unit Tests

- Test `PermissionService.HasPermission()` for all role/permission combinations
- Test handler permission checks throw `ForbiddenAccessException` appropriately
- Test `CanAccessReceiptAsync()` for own vs. others' receipts

### 10.2 Integration Tests

- Test API endpoints return 403 for unauthorized role
- Test Contributor cannot access Owner-only endpoints
- Test Contributor sees only own receipts in list
- Test Contributor can upload receipt and bind to property
- Test Contributor can update work order status but not delete

### 10.3 E2E Tests

- Contributor login → limited navigation menu
- Contributor receipt upload flow with property selection
- Contributor work order status update flow
- Owner user management flow (invite, role change, remove)

---

## 11. Resolved Questions

1. **Contributor Dashboard:** What should Contributors see on their dashboard?
   - **Answer:** Receipts, Work Orders, and a camera FAB (floating action button) for quick receipt capture.

2. **Notifications:** Should Contributors receive notifications for new work order assignments?
   - **Answer:** Yes. Two mechanisms:
     - In-app: Badge/number overlay on Work Orders icon indicating new/unread work orders
     - Email: Notification when new work orders are created (future feature, but roles/permissions should accommodate this)

3. **Multiple Contributors:** If there are multiple Contributors, should they see each other's receipts or strictly their own?
   - **Answer:** Yes, Contributors can see ALL receipts on the account (including other Contributors' and Owners' receipts). Transparency promotes alignment, cooperation, and prevents redundant purchases.
   - **Permission Change:** `Receipts.ViewOwn` → `Receipts.ViewAll` for Contributors

## 12. Resolved - Work Order Assignment

**Question:** Should work orders be explicitly assigned to Contributors, or can any Contributor work any work order?

**Answer:** Assignment is **optional and informational only**. Any Contributor can view and work on any work order - assignment does not restrict access. This keeps the system flexible and non-restrictive.

- `AssignedToUserId` on Work Order: Optional field
- Filtering by assignment: UI convenience, not permission enforcement
- All Contributors see all work orders regardless of assignment

---

## 13. Acceptance Criteria

### Must Have (MVP)

- [ ] Owner retains full access to all features
- [ ] Contributor can upload receipts with optional property binding
- [ ] Contributor sees only their own receipts
- [ ] Contributor cannot access Expenses, Vendors, Leases, Income
- [ ] Contributor cannot create/edit/delete Properties
- [ ] Owner can invite new users to account
- [ ] Owner can assign roles (Owner/Contributor)
- [ ] Owner can remove users from account
- [ ] Frontend navigation adapts to role
- [ ] Unauthorized API calls return 403 Forbidden

### Should Have

- [ ] Contributor can view and update Work Order status (when feature exists)
- [ ] Contributor can add notes to Work Orders
- [ ] Contributor can bind receipts to Work Orders at upload time

### Nice to Have

- [ ] Audit logging of permission-related actions
- [ ] Feature flag for gradual rollout
- [ ] Email notifications for user invitations

---

## Appendix A: Complete Permission Matrix

| Permission | Owner | Contributor |
|------------|-------|-------------|
| Properties.View | ✅ | ❌ |
| Properties.ViewList | ✅ | ✅ |
| Properties.Create | ✅ | ❌ |
| Properties.Edit | ✅ | ❌ |
| Properties.Delete | ✅ | ❌ |
| Receipts.ViewAll | ✅ | ✅ |
| Receipts.Create | ✅ | ✅ |
| Receipts.Edit | ✅ | ❌ |
| Receipts.Delete | ✅ | ❌ |
| Receipts.Process | ✅ | ❌ |
| Expenses.View | ✅ | ❌ |
| Expenses.Create | ✅ | ❌ |
| Expenses.Edit | ✅ | ❌ |
| Expenses.Delete | ✅ | ❌ |
| Vendors.View | ✅ | ❌ |
| Vendors.Create | ✅ | ❌ |
| Vendors.Edit | ✅ | ❌ |
| Vendors.Delete | ✅ | ❌ |
| Leases.View | ✅ | ❌ |
| Leases.Create | ✅ | ❌ |
| Leases.Edit | ✅ | ❌ |
| Leases.Delete | ✅ | ❌ |
| Income.View | ✅ | ❌ |
| Income.Create | ✅ | ❌ |
| Income.Edit | ✅ | ❌ |
| Income.Delete | ✅ | ❌ |
| WorkOrders.View | ✅ | ✅ |
| WorkOrders.Create | ✅ | ❌ |
| WorkOrders.Edit | ✅ | ❌ |
| WorkOrders.EditStatus | ✅ | ✅ |
| WorkOrders.AddNotes | ✅ | ✅ |
| WorkOrders.Delete | ✅ | ❌ |
| Account.View | ✅ | ❌ |
| Account.Edit | ✅ | ❌ |
| Users.View | ✅ | ❌ |
| Users.Invite | ✅ | ❌ |
| Users.EditRole | ✅ | ❌ |
| Users.Remove | ✅ | ❌ |

---

*Plan drafted by Mary (Business Analyst) based on discovery session with Dave on 2026-01-18*
