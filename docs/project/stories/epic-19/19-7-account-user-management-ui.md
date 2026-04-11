# Story 19.7: Account User Management UI

Status: done

## Story

As an account owner,
I want to see who's on my account and manage their roles or remove users,
so that I can promote, demote, or remove team members as needed.

## Acceptance Criteria

1. **Given** I am logged in as an Owner
   **When** I navigate to Settings > Users
   **Then** I see a list of account users with: Name/Email, Role, Joined Date

2. **Given** I see a user in the list
   **When** I click the role dropdown and change it from "Contributor" to "Owner" (or vice versa)
   **Then** the role is updated and I see a confirmation snackbar "Role updated successfully"

3. **Given** I am the only Owner on the account
   **When** I try to change my own role to Contributor
   **Then** I see an error snackbar "Cannot remove the last owner from the account"

4. **Given** I see a user in the list (not myself)
   **When** I click the Remove button and confirm the dialog
   **Then** the user is removed from the account and disappears from the list

5. **Given** I try to remove myself
   **When** I am the last Owner
   **Then** I see an error snackbar "Cannot remove the last owner from the account"

## Tasks / Subtasks

- [x] Task 1: Add API client methods for UpdateUserRole and RemoveUser (AC: #2, #4)
  - [x] 1.1 Add `accountUsers_UpdateUserRole(userId: string, request: UpdateUserRoleRequest): Observable<void>` method to `ApiClient` class in `api.service.ts` — `PUT /api/v1/account/users/{userId}/role`
  - [x] 1.2 Add `accountUsers_RemoveUser(userId: string): Observable<void>` method to `ApiClient` class — `DELETE /api/v1/account/users/{userId}`
  - [x] 1.3 Add `UpdateUserRoleRequest` interface: `{ role: string }`
  - [x] 1.4 Add method signatures to the `IApiClient` interface at top of file

- [x] Task 2: Extend `UserManagementStore` with updateRole and removeUser methods (AC: #2, #3, #4, #5)
  - [x] 2.1 Add `updateUserRole: rxMethod<{ userId: string; role: string }>` — calls `api.accountUsers_UpdateUserRole()`, shows success snackbar, reloads users on success, shows error snackbar on failure (including last-owner guard message)
  - [x] 2.2 Add `removeUser: rxMethod<string>` — calls `api.accountUsers_RemoveUser()`, shows success snackbar "User removed", reloads users on success, shows error snackbar on failure
  - [x] 2.3 Unit tests for `updateUserRole` (success, error, last-owner error)
  - [x] 2.4 Unit tests for `removeUser` (success, error)

- [x] Task 3: Update `SettingsComponent` — Account Users section with role dropdown and remove button (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Import `MatSelectModule`, `MatFormFieldModule`, `MatDialog`, `ConfirmDialogComponent`, `AuthService`
  - [x] 3.2 Replace read-only Role column with inline `mat-select` dropdown (options: "Owner", "Contributor")
  - [x] 3.3 On `(selectionChange)`, call `store.updateUserRole({ userId, role: newRole })`
  - [x] 3.4 Add "Remove" button (mat-icon-button with `delete` icon) to each user row — hidden for the current user (prevent self-removal UI confusion) OR shown but triggers last-owner guard
  - [x] 3.5 On Remove click, open `ConfirmDialogComponent` with title "Remove User?" and message "This user will lose access to the account. This action cannot be undone."
  - [x] 3.6 On confirm, call `store.removeUser(userId)`
  - [x] 3.7 Inject `AuthService` to get current user ID, disable Remove button for the current logged-in user
  - [x] 3.8 Unit tests for SettingsComponent: role change triggers store method, remove triggers confirm dialog then store method, remove button hidden/disabled for self

- [x] Task 4: E2E test for user management interactions (AC: #1, #2, #4)
  - [x] 4.1 Extend `frontend/e2e/tests/settings/user-management.spec.ts`
  - [x] 4.2 Test: Owner sees user list with role dropdown and remove button
  - [x] 4.3 Test: Owner changes a user's role via dropdown, sees success snackbar
  - [x] 4.4 Test: Owner clicks Remove on a user, confirms dialog, user disappears from list
  - [x] 4.5 Use `page.route()` to intercept API responses for test isolation

- [x] Task 5: Verify all existing tests pass (AC: all)
  - [x] 5.1 Run `dotnet test` — all backend unit tests pass (1090 passed; API integration tests require Docker which is unavailable)
  - [x] 5.2 Run `npm test` — all 2680 frontend unit tests pass (114 test files, 0 failures)
  - [ ] 5.3 Run E2E tests — cannot run locally: Docker not available, DB not connected, rate limiting on auth endpoint

## Dev Notes

### Architecture: Frontend-Only Story

This story is frontend-only. The backend API endpoints already exist from Story 19.4:
- `GET /api/v1/account/users` — list users (already wired in 19.6)
- `PUT /api/v1/account/users/{userId}/role` — update role (needs API client method)
- `DELETE /api/v1/account/users/{userId}` — remove user (needs API client method)

All three endpoints are protected by `[Authorize(Policy = "CanManageUsers")]` on the `AccountUsersController`. The backend handlers (`UpdateUserRoleCommandHandler`, `RemoveAccountUserCommandHandler`) already enforce the last-owner guard by throwing `FluentValidation.ValidationException("Cannot remove the last owner from the account")`.

### API Client: Manual Additions Required

NSwag generation requires .NET 9 (project uses .NET 10). Manually add methods following the established NSwag pattern (see existing `expenses_UpdateExpense` for PUT and `expenses_DeleteExpense` for DELETE patterns).

**New interface:**
```typescript
export interface UpdateUserRoleRequest {
  role: string;
}
```

**New methods to add to `IApiClient` interface and `ApiClient` class:**
- `accountUsers_UpdateUserRole(userId: string, request: UpdateUserRoleRequest): Observable<void>` — PUT to `/api/v1/account/users/{userId}/role` with JSON body, expect 204
- `accountUsers_RemoveUser(userId: string): Observable<void>` — DELETE to `/api/v1/account/users/{userId}`, expect 204

Follow the exact NSwag pattern: `this.http.request("put"|"delete", url_, options_)` with `observe: "response"`, `responseType: "blob"`, `withCredentials: true`. Process response checking for 204 (success), 400 (validation/last-owner), 401, 403, 404 status codes.

### Store: Extend UserManagementStore

Add two new `rxMethod` methods to the existing `UserManagementStore` in `frontend/src/app/features/settings/stores/user-management.store.ts`:

```typescript
updateUserRole: rxMethod<{ userId: string; role: string }>(
  pipe(
    tap(() => patchState(store, { loading: true, error: null })),
    switchMap(({ userId, role }) =>
      api.accountUsers_UpdateUserRole(userId, { role } as UpdateUserRoleRequest).pipe(
        tap(() => {
          patchState(store, { loading: false });
          snackBar.open('Role updated successfully', 'Close', { duration: 3000, ... });
          reloadUsers();
        }),
        catchError((error) => {
          // Extract error message — last-owner guard returns validation error
          let errorMessage = 'Failed to update role';
          // ... error extraction logic matching existing pattern
          patchState(store, { loading: false, error: errorMessage });
          snackBar.open(errorMessage, 'Close', { duration: 5000, ... });
          return of(null);
        }),
      )
    ),
  ),
),
```

Add a `reloadUsers` helper alongside the existing `reloadInvitations` helper.

**Error extraction for last-owner guard:** The backend throws `FluentValidation.ValidationException` which the global exception middleware maps to a 400 ProblemDetails response. The NSwag client throws an `ApiException` with `status: 400`. Extract the message from `error.title` or `error.errors` (same pattern as `sendInvitation`'s error handling).

### Component: SettingsComponent Updates

Extend the existing Account Users table in `frontend/src/app/features/settings/settings.component.ts`:

**Role column:** Replace static `{{ user.role }}` text with an inline `mat-select`:
```html
<mat-form-field appearance="outline" class="role-select">
  <mat-select [value]="user.role" (selectionChange)="onRoleChange(user.userId!, $event.value)">
    <mat-option value="Owner">Owner</mat-option>
    <mat-option value="Contributor">Contributor</mat-option>
  </mat-select>
</mat-form-field>
```

**Actions column:** Add a Remove button:
```html
<td>
  @if (user.userId !== currentUserId()) {
    <button mat-icon-button color="warn" (click)="onRemoveUser(user.userId!, user.email!)">
      <mat-icon>person_remove</mat-icon>
    </button>
  }
</td>
```

**Required new imports:**
- `MatSelectModule` from `@angular/material/select`
- `MatFormFieldModule` from `@angular/material/form-field`
- `ConfirmDialogComponent` and `ConfirmDialogData` from shared components
- `AuthService` from core/services

**Current user ID:** Inject `AuthService` and create a computed signal or method:
```typescript
private readonly authService = inject(AuthService);
protected currentUserId = computed(() => this.authService.currentUser()?.userId);
```

**Remove user flow:**
1. Click Remove button -> open `ConfirmDialogComponent` with warning message
2. On confirm -> call `store.removeUser(userId)`
3. Store reloads users list, removed user disappears

### Previous Story Intelligence

**From Story 19.6:**
- `UserManagementStore` already has `loadInvitations`, `loadUsers`, `sendInvitation`, `resendInvitation` methods
- `SettingsComponent` already displays Account Users section as a read-only table
- `reloadInvitations` helper pattern exists — follow same pattern for `reloadUsers`
- Error handling pattern: extract message from `error.errors` (validation) or `error.title` (generic)
- NSwag types were manually added — follow the same blob-based request/response pattern
- E2E tests use `page.route()` for API interception — extend existing test file

**From Story 19.4:**
- `AccountUsersController` has PUT `{userId}/role` and DELETE `{userId}` endpoints
- `UpdateUserRoleRequest` accepts `{ role: string }` body
- Backend validates role is "Owner" or "Contributor" via `UpdateUserRoleValidator`
- Last-owner guard throws `FluentValidation.ValidationException("Cannot remove the last owner from the account")`
- Both endpoints return 204 No Content on success

**Common issues from previous stories:**
- NSwag requires .NET 9 — manually add types following existing pattern
- MockQueryable.Moq v10: use `list.BuildMockDbSet()` directly
- E2E rate limiting with multiple workers: use `--workers=1` to match CI
- Vitest `this` not available in rxMethod closures: use closure variables

### Testing Pyramid

- **Unit tests (Vitest):** `UserManagementStore` (updateUserRole success/error, removeUser success/error), `SettingsComponent` (role dropdown change, remove button click, confirm dialog flow, self-removal prevention)
- **E2E tests (Playwright):** Navigate to Settings, verify user list with role dropdown, change role via dropdown, remove user via button + confirm dialog
- **No new backend tests needed** — backend endpoints already tested in Story 19.4

### Angular Material Imports

For inline `mat-select` in the table, import:
- `MatSelectModule` — provides `<mat-select>` and `<mat-option>`
- `MatFormFieldModule` — provides `<mat-form-field>` wrapper

Style the inline select to be compact within the table cell:
```scss
.role-select {
  width: 140px;
  // Reduce mat-form-field vertical padding for table context
  ::ng-deep .mat-mdc-form-field-infix {
    padding-top: 4px;
    padding-bottom: 4px;
    min-height: unset;
  }
}
```

Alternatively, use a native `mat-select` without `mat-form-field` wrapper for a more compact look — test both approaches visually.

### References

| Artifact | Section |
|----------|---------|
| `docs/project/stories/epic-19/epic-19-multi-user-rbac.md` | Story 19.7 requirements and ACs |
| `docs/project/stories/epic-19/19-6-invitation-management-ui.md` | Previous story intelligence, store/component patterns |
| `docs/project/stories/epic-19/19-4-account-user-management-api.md` | Backend API endpoints, handlers, validators |
| `docs/project/project-context.md` | All sections — coding standards, testing rules, anti-patterns |
| `backend/src/PropertyManager.Api/Controllers/AccountUsersController.cs` | PUT role, DELETE user endpoints |
| `backend/src/PropertyManager.Application/AccountUsers/UpdateUserRole.cs` | Update role handler with last-owner guard |
| `backend/src/PropertyManager.Application/AccountUsers/RemoveAccountUser.cs` | Remove user handler with last-owner guard |
| `frontend/src/app/core/api/api.service.ts` | NSwag client — manual additions needed for PUT/DELETE |
| `frontend/src/app/features/settings/settings.component.ts` | Component to extend with role dropdown + remove button |
| `frontend/src/app/features/settings/settings.component.spec.ts` | Existing unit tests to extend |
| `frontend/src/app/features/settings/stores/user-management.store.ts` | Store to extend with updateUserRole + removeUser |
| `frontend/src/app/features/settings/stores/user-management.store.spec.ts` | Existing store tests to extend |
| `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts` | Reusable confirm dialog pattern |
| `frontend/src/app/core/auth/permission.service.ts` | PermissionService for role checks |
| `frontend/src/app/core/services/auth.service.ts` | AuthService for current user ID |
| `frontend/e2e/tests/settings/user-management.spec.ts` | Existing E2E tests to extend |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- E2E tests cannot run locally due to Docker not available (DB not connected, rate limiting on auth endpoint)

### Completion Notes List
- Task 1: Added `accountUsers_UpdateUserRole` (PUT) and `accountUsers_RemoveUser` (DELETE) methods to `ApiClient` class and `IApiClient` interface, plus `UpdateUserRoleRequest` interface. Followed existing NSwag blob-based pattern with 204/400/401/403/404 status handling.
- Task 2: Added `updateUserRole` and `removeUser` rxMethod methods to `UserManagementStore`. Added `reloadUsers` helper following `reloadInvitations` pattern. Error extraction handles validation errors (last-owner guard) from `error.errors` and generic errors from `error.title`.
- Task 3: Updated `SettingsComponent` template: replaced static role text with inline `mat-select` dropdown, added "Remove" button (hidden for current user via `currentUserId()` computed signal), added `onRoleChange` and `onRemoveUser` methods with confirm dialog flow. Added compact SCSS for role-select form field.
- Task 4: Added 3 new E2E tests to `user-management.spec.ts`: role dropdown + remove button visibility, role change via dropdown with success snackbar, remove user with confirm dialog and list update. All use `page.route()` for API interception.
- Task 5: All 2680 frontend unit tests pass, all 1090 backend unit tests pass. E2E tests blocked by Docker unavailability.

### File List
- `frontend/src/app/core/api/api.service.ts` — Modified: added `IApiClient` interface methods, `ApiClient` implementation methods, `UpdateUserRoleRequest` interface
- `frontend/src/app/features/settings/stores/user-management.store.ts` — Modified: added `reloadUsers` helper, `updateUserRole` and `removeUser` rxMethod methods
- `frontend/src/app/features/settings/stores/user-management.store.spec.ts` — Modified: added 5 new unit tests for updateUserRole and removeUser
- `frontend/src/app/features/settings/settings.component.ts` — Modified: added role dropdown, remove button, `onRoleChange`, `onRemoveUser`, `currentUserId` computed signal, new imports
- `frontend/src/app/features/settings/settings.component.spec.ts` — Modified: added 4 new unit tests for role change, remove flow, self-removal prevention
- `frontend/e2e/tests/settings/user-management.spec.ts` — Modified: added 3 new E2E tests for role dropdown, role change, remove user flow
- `docs/project/sprint-status.yaml` — Modified: updated 19-7 status to review
- `docs/project/stories/epic-19/19-7-account-user-management-ui.md` — Modified: updated status, tasks, dev agent record
