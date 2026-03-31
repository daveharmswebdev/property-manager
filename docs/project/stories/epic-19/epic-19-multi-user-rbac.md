# Epic 19: Multi-User Account with RBAC

**Goal:** Transform the app from a single-user tool into a team tool. Account owners can invite partners (Co-Manager/Owner) and field workers (Contributor) to share an account with role-appropriate permissions.

**Primary Use Case:** Husband and wife managing rental properties together — both as Owners with full access. Secondary: inviting a Contributor (e.g., adult son) who can upload receipts and update work orders but cannot access financial data.

**FRs Covered:** FR58, FR59, FR60, FR61, FR62

**Source:** `docs/project/archive/multi-user-rbac-refactor-plan.md` (2026-01-18)

**User Value:** "My wife and I can both use the app. We're a team — the tool should reflect that."

---

## What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| `ApplicationUser.Role` field | Stored, not enforced | Defaults to "Owner" |
| JWT role claims | Issued | `JwtService` emits `role` claim |
| `CurrentUserService.Role` | Available | Reads from JWT claims |
| Invitation system (API) | Works, but broken for RBAC | Creates a **new account** — should join inviter's account |
| Account-based multi-tenancy | Enforced | Global query filters by `AccountId` |
| `CreatedByUserId` tracking | On Expense, Receipt, Income | Supports "who uploaded this" |
| `[Authorize(Roles = "Owner")]` | On InvitationsController | Only existing permission enforcement |

## The Gap

**Roles are stored but not enforced.** Any authenticated user on an account has full access to all operations. The invitation system creates a new account per user instead of joining the inviter's existing account.

---

## Stories

| Story | Title | Size | FRs |
|-------|-------|------|-----|
| 19.1 | Refactor Invitation to Join Existing Account | 5 | FR58, FR59 |
| 19.2 | Permission Infrastructure | 3 | — |
| 19.3 | Backend Permission Enforcement | 5 | FR60 |
| 19.4 | Account User Management API | 3 | FR61, FR62 |
| 19.5 | Frontend Auth State and Permission Service | 5 | FR60 |
| 19.6 | Invitation Management UI | 5 | FR58, FR62 |
| 19.7 | Account User Management UI | 3 | FR61, FR62 |

---

## Story 19.1: Refactor Invitation to Join Existing Account

**As an** account owner,
**I want** to invite someone to join my account with a specific role,
**So that** they can work alongside me without creating a separate account.

### Acceptance Criteria

**Given** I am logged in as an Owner
**When** I create an invitation with an email and role ("Owner" or "Contributor")
**Then** the invitation is stored with my AccountId, the specified Role, and my UserId as InvitedByUserId
**And** the invitation email is sent to the recipient

**Given** I received an invitation email
**When** I click the link and register with a password
**Then** my user is created on the inviter's Account (not a new account)
**And** my Role is set to the role specified in the invitation
**And** I can log in and see the same properties/data as the inviter

**Given** an invitation was created with role "Contributor"
**When** the recipient accepts the invitation
**Then** the new user has Role = "Contributor" on the inviter's account

**Given** an invitation was created with role "Owner"
**When** the recipient accepts the invitation
**Then** the new user has Role = "Owner" on the inviter's account

### Technical Notes

- **Migration required:** Add `AccountId` (Guid, required), `Role` (string, required, default "Owner"), `InvitedByUserId` (Guid, required) to `Invitation` entity
- **Breaking change in `AcceptInvitationCommandHandler`:** Remove account creation (lines 113-118 of current code). Instead, read `AccountId` from the invitation and pass it to `CreateUserWithConfirmedEmailAsync`
- **`CreateInvitationCommandHandler`:** Must read `ICurrentUser.AccountId` and `ICurrentUser.UserId` to populate new fields. Add `Role` parameter to `CreateInvitationCommand`
- **Run `dotnet ef database update`** after creating migration
- **Tests:** Unit tests for handlers, integration tests for invitation endpoints (create → validate → accept flow), E2E test for invitation acceptance

### Dependencies
None (first story in epic)

---

## Story 19.2: Permission Infrastructure

**As a** developer,
**I want** a permission system that maps roles to granular permissions,
**So that** handlers and controllers can enforce role-based access.

### Acceptance Criteria

**Given** the permission constants are defined
**When** I check `RolePermissions.Mappings["Owner"]`
**Then** it contains all permissions (full CRUD on all entities)

**Given** the permission constants are defined
**When** I check `RolePermissions.Mappings["Contributor"]`
**Then** it contains only: `Properties.ViewList`, `Receipts.ViewAll`, `Receipts.Create`, `WorkOrders.View`, `WorkOrders.EditStatus`, `WorkOrders.AddNotes`

**Given** I inject `IPermissionService`
**When** I call `HasPermission("Expenses.View")` as an Owner
**Then** it returns true

**Given** I inject `IPermissionService`
**When** I call `HasPermission("Expenses.View")` as a Contributor
**Then** it returns false

**Given** I call `IsOwner()` or `IsContributor()`
**When** the current user has role "Owner" or "Contributor" respectively
**Then** the method returns true

### Technical Notes

- **New files:**
  - `PropertyManager.Domain/Authorization/Permissions.cs` — static permission constants
  - `PropertyManager.Domain/Authorization/RolePermissions.cs` — role-to-permission mapping
  - `PropertyManager.Application/Common/Interfaces/IPermissionService.cs` — interface
  - `PropertyManager.Infrastructure/Identity/PermissionService.cs` — implementation
- Register `IPermissionService` in DI container
- See RBAC plan Sections 5.1.1–5.1.5 for detailed design
- **Tests:** Unit tests for `PermissionService` — all role/permission combinations

### Dependencies
None (can be developed in parallel with 19.1)

---

## Story 19.3: Backend Permission Enforcement

**As a** Contributor,
**I should** be blocked from owner-only operations,
**So that** the system enforces role boundaries at the API level.

### Acceptance Criteria

**Given** I am logged in as a Contributor
**When** I call `POST /api/v1/properties` (create property)
**Then** I receive 403 Forbidden

**Given** I am logged in as a Contributor
**When** I call `PUT /api/v1/properties/{id}` or `DELETE /api/v1/properties/{id}`
**Then** I receive 403 Forbidden

**Given** I am logged in as a Contributor
**When** I call any Expenses endpoint (GET, POST, PUT, DELETE)
**Then** I receive 403 Forbidden

**Given** I am logged in as a Contributor
**When** I call any Income endpoint
**Then** I receive 403 Forbidden

**Given** I am logged in as a Contributor
**When** I call any Vendors endpoint
**Then** I receive 403 Forbidden

**Given** I am logged in as a Contributor
**When** I call `GET /api/v1/properties` (list for dropdowns)
**Then** I receive 200 OK with minimal property data (Id, Name only)

**Given** I am logged in as a Contributor
**When** I call `GET /api/v1/receipts` or `POST /api/v1/receipts`
**Then** I receive 200 OK / 201 Created (Contributors can view and upload receipts)

**Given** I am logged in as a Contributor
**When** I call `POST /api/v1/receipts/{id}/process`
**Then** I receive 403 Forbidden (only Owners can process receipts into expenses)

**Given** I am logged in as an Owner
**When** I call any endpoint
**Then** I receive normal responses (no permission restrictions)

### Technical Notes

- Add `[Authorize(Policy = "...")]` attributes to controllers OR inject `IPermissionService` into handlers — follow whichever pattern is more consistent with existing code
- Properties controller needs two tiers: `GET /properties` accessible to both roles (returns minimal data for Contributors), `GET /properties/{id}` Owner-only
- Reports endpoints: Owner-only
- **Tests:** Integration tests for every protected endpoint — test both Owner (200) and Contributor (403) responses

### Dependencies
Story 19.2

---

## Story 19.4: Account User Management API

**As an** account owner,
**I want** API endpoints to list, update, and remove users on my account,
**So that** I can manage who has access and what role they have.

### Acceptance Criteria

**Given** I am logged in as an Owner
**When** I call `GET /api/v1/account/users`
**Then** I receive a list of all users on my account with: UserId, Email, DisplayName, Role, CreatedAt

**Given** I am logged in as an Owner
**When** I call `PUT /api/v1/account/users/{userId}/role` with `{ "role": "Contributor" }`
**Then** the user's role is updated to Contributor
**And** subsequent API calls by that user enforce Contributor permissions

**Given** I am logged in as an Owner
**When** I try to change my own role and I am the last Owner on the account
**Then** I receive 400 Bad Request with "Cannot remove the last owner from the account"

**Given** I am logged in as an Owner
**When** I call `DELETE /api/v1/account/users/{userId}`
**Then** the user is removed from the account (soft delete or disable)
**And** that user can no longer log in to this account

**Given** I am logged in as a Contributor
**When** I call any `/api/v1/account/users` endpoint
**Then** I receive 403 Forbidden

### Technical Notes

- **New controller:** `AccountUsersController` with `[Authorize(Policy = "CanManageUsers")]`
- **New commands/queries:** `GetAccountUsers`, `UpdateUserRole`, `RemoveAccountUser`
- "Remove user" should disable the user's access — decide between soft delete on ApplicationUser vs. setting AccountId to null
- Must prevent removing the last Owner (business rule)
- **Tests:** Unit tests for handlers, integration tests for all endpoints (Owner success + Contributor 403 + last-owner guard)

### Dependencies
Story 19.2

---

## Story 19.5: Frontend Auth State and Permission Service

**As a** user,
**I want** the app to show me only what I have access to,
**So that** I'm not confused by features I can't use.

### Acceptance Criteria

**Given** I log in as an Owner
**When** the app loads
**Then** I see the full navigation: Dashboard, Properties, Expenses, Income, Receipts, Vendors, Work Orders, Reports, Settings

**Given** I log in as a Contributor
**When** the app loads
**Then** I see limited navigation: Dashboard, Receipts, Work Orders

**Given** I am logged in as a Contributor
**When** I navigate to `/expenses` via the URL bar
**Then** I am redirected to the Dashboard

**Given** I am logged in as a Contributor
**When** I view a property list
**Then** I do not see Edit or Delete buttons

**Given** I am logged in as an Owner
**When** I view a property list
**Then** I see Edit and Delete buttons as normal

### Technical Notes

- **Auth state:** Add `role` to auth state from JWT claims (already in token)
- **New files:**
  - `src/app/core/auth/permission.service.ts` — `isOwner()`, `isContributor()`, `canAccessRoute()`
  - `src/app/core/auth/owner.guard.ts` — route guard redirecting Contributors away from owner-only routes
- **Route updates:** Apply `ownerGuard` to: properties/new, properties/:id/edit, expenses/**, income/**, vendors/**, reports/**, settings/users
- **Navigation component:** Use `computed()` signal to filter menu items by role
- **Conditional rendering:** `@if (permissionService.isOwner())` to hide edit/delete buttons for Contributors
- **Tests:** Unit tests for PermissionService, unit tests for navigation component (Owner vs Contributor menu items), E2E test for Contributor seeing restricted nav

### Dependencies
Story 19.3 (backend must enforce permissions before frontend hides UI)

---

## Story 19.6: Invitation Management UI

**As an** account owner,
**I want** a UI to invite new users to my account,
**So that** I don't need to use Postman or API calls to add my wife.

### Acceptance Criteria

**Given** I am logged in as an Owner
**When** I navigate to Settings > Users
**Then** I see an "Invite User" button

**Given** I click "Invite User"
**When** I enter an email address and select a role (Owner or Contributor)
**And** I click Send
**Then** the invitation is created and I see a success message "Invitation sent to {email}"

**Given** I am on the Users page
**When** I look at the invitations section
**Then** I see a list of pending invitations with: Email, Role, Sent Date, Status (Pending/Expired/Accepted)

**Given** an invitation has expired
**When** I view the invitations list
**Then** the expired invitation shows status "Expired" and I can resend it

**Given** I enter an email that's already registered on my account
**When** I try to send the invitation
**Then** I see an error "This email is already registered"

**Given** I am logged in as a Contributor
**When** I try to navigate to Settings > Users
**Then** I am redirected to the Dashboard (ownerGuard blocks access)

### Technical Notes

- **New components:**
  - `src/app/features/settings/user-management/` — container page
  - Invite dialog/form with email input and role dropdown
  - Pending invitations list
- Generate API client (`npm run generate-api`) to pick up invitation endpoint changes from 19.1
- Use Angular Material dialog for invite form
- **Tests:** Unit tests for invite form validation, E2E test for full invite flow (navigate to Settings > Users, fill form, submit, verify success message)

### Dependencies
Story 19.1, Story 19.5

---

## Story 19.7: Account User Management UI

**As an** account owner,
**I want** to see who's on my account and manage their roles,
**So that** I can promote, demote, or remove users as needed.

### Acceptance Criteria

**Given** I am logged in as an Owner
**When** I navigate to Settings > Users
**Then** I see a list of account users with: Name/Email, Role, Joined Date

**Given** I see a user in the list
**When** I click the role dropdown and change it from "Contributor" to "Owner"
**Then** the role is updated and I see a confirmation snackbar

**Given** I am the only Owner on the account
**When** I try to change my own role to Contributor
**Then** I see an error "Cannot remove the last owner from the account"

**Given** I see a user in the list (not myself)
**When** I click the Remove button and confirm the dialog
**Then** the user is removed from the account and disappears from the list

**Given** I try to remove myself
**When** I am the last Owner
**Then** I see an error "Cannot remove the last owner from the account"

### Technical Notes

- Extends the Settings > Users page from Story 19.6 (invitations + active users on same page)
- Users list with inline role dropdown (mat-select) and remove button
- Confirmation dialog for remove action
- Handle the "last owner" guard error from the API gracefully
- **Tests:** Unit tests for user list component, E2E test for role change and user removal flows

### Dependencies
Story 19.4, Story 19.5, Story 19.6

---

## Acceptance Test (Epic-Level)

When all stories are complete, run this smoke test:

1. Log in as `claude@claude.com` (Owner)
2. Go to Settings > Users, invite a second email as **Owner**
3. Check MailHog, accept invitation, register
4. Confirm full navigation and full access as the new Owner
5. Back as original owner, invite a third email as **Contributor**
6. Accept, register, confirm stripped-down navigation
7. As Contributor: upload a receipt (should work), try to access /expenses (should redirect)
8. As Owner: go to Settings > Users, change Contributor's role to Owner, confirm access changes
9. Remove a user, confirm they can no longer log in
