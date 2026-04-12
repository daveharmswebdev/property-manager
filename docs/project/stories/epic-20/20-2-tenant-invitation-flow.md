# Story 20.2: Tenant Invitation Flow

Status: done

## Story

As a landlord,
I want to invite a tenant to a specific property via email,
so that the tenant can create an account and immediately access their property.

## Acceptance Criteria

1. **Given** a landlord on the property detail page,
   **When** they invite a tenant by email,
   **Then** an invitation is created with role "Tenant" and the associated PropertyId

2. **Given** an invitation with role "Tenant" and a PropertyId,
   **When** the tenant accepts the invitation,
   **Then** their account is created with the Tenant role and PropertyId set to the invited property

3. **Given** an existing user who is not yet a tenant,
   **When** they accept a tenant invitation,
   **Then** their role and PropertyId are updated accordingly

4. **Given** a tenant invitation,
   **When** the invitation email is sent,
   **Then** the email includes the property address so the tenant knows what they're accepting

5. **Given** an invitation,
   **When** the invitation is created,
   **Then** the PropertyId is validated to ensure it belongs to the landlord's account

6. **Given** an expired or already-accepted tenant invitation,
   **When** a user tries to accept it,
   **Then** the system returns an appropriate error

## Tasks / Subtasks

- [x] Task 1: Add PropertyId to Invitation entity (AC: #1, #5)
  - [x] 1.1 Add `public Guid? PropertyId { get; set; }` to `Invitation` entity in `backend/src/PropertyManager.Domain/Entities/Invitation.cs`
  - [x] 1.2 Add navigation property `public Property? Property { get; set; }` to `Invitation`
  - [x] 1.3 Update `InvitationConfiguration.cs` — configure `PropertyId` as optional FK to `Properties` table with appropriate delete behavior
  - [x] 1.4 Add index on `PropertyId` for invitation lookups

- [x] Task 2: Create EF Core migration for Invitation PropertyId (AC: #1)
  - [x] 2.1 Create migration: `dotnet ef migrations add AddInvitationPropertyId --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api`
  - [x] 2.2 Apply migration and verify nullable `PropertyId` column on `Invitations` table with FK to `Properties`

- [x] Task 3: Extend CreateInvitationCommand to accept PropertyId (AC: #1, #5)
  - [x] 3.1 Update `CreateInvitationCommand` record to add `Guid? PropertyId` parameter: `public record CreateInvitationCommand(string Email, string Role, Guid? PropertyId = null) : IRequest<CreateInvitationResult>;`
  - [x] 3.2 In `CreateInvitationCommandHandler.Handle()`, when `request.PropertyId` has a value, validate that the property exists and belongs to the current user's account by querying `_dbContext.Properties.AnyAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId)`
  - [x] 3.3 Set `PropertyId = request.PropertyId` on the created `Invitation` entity
  - [x] 3.4 Pass property address to the email service when PropertyId is present (see Task 5)

- [x] Task 4: Update CreateInvitationValidator for Tenant role (AC: #1, #5)
  - [x] 4.1 Update `CreateInvitationCommandValidator` — allow "Tenant" as valid role: `.Must(r => r == "Owner" || r == "Contributor" || r == "Tenant")`
  - [x] 4.2 Add conditional validation: when Role is "Tenant", PropertyId is required — use FluentValidation `When()`: `When(x => x.Role == "Tenant", () => { RuleFor(x => x.PropertyId).NotNull().WithMessage("PropertyId is required for Tenant invitations"); });`
  - [x] 4.3 Add conditional validation: when Role is NOT "Tenant", PropertyId must be null — `When(x => x.Role != "Tenant", () => { RuleFor(x => x.PropertyId).Null().WithMessage("PropertyId should only be set for Tenant invitations"); });`

- [x] Task 5: Extend email service to include property address (AC: #4)
  - [x] 5.1 Add new overload or extend `IEmailService.SendInvitationEmailAsync` to accept an optional property address string: `Task SendTenantInvitationEmailAsync(string email, string code, string propertyAddress, CancellationToken cancellationToken = default);`
  - [x] 5.2 Implement `SendTenantInvitationEmailAsync` in `SmtpEmailService` — generate HTML/text email that includes the property address (e.g., "You've been invited to submit maintenance requests for **123 Main St, Austin, TX 78701**")
  - [x] 5.3 In `CreateInvitationCommandHandler`, when PropertyId is present, fetch the property to get its address, then call the new tenant-specific email method instead of the generic one

- [x] Task 6: Extend AcceptInvitationCommand to set PropertyId on user (AC: #2, #3, #6)
  - [x] 6.1 In `AcceptInvitationCommandHandler.Handle()`, after determining `accountId` and `role`, check if `invitation.PropertyId` has a value
  - [x] 6.2 When `invitation.PropertyId` has a value, pass it to `CreateUserWithConfirmedEmailAsync()` as the `propertyId` parameter (the parameter already exists from Story 20.1)
  - [x] 6.3 The existing expired/used checks in AcceptInvitationCommandHandler already handle AC #6 — verify with tests

- [x] Task 7: Extend ValidateInvitationQuery to return PropertyId and property address (AC: #4)
  - [x] 7.1 Add `Guid? PropertyId` and `string? PropertyAddress` to `ValidateInvitationResult` record
  - [x] 7.2 In `ValidateInvitationQueryHandler`, when the invitation has a PropertyId, load the property (via `_dbContext.Properties`) to get the address
  - [x] 7.3 Return the formatted address string (e.g., "123 Main St, Austin, TX 78701") in the result
  - [x] 7.4 Update `ValidateInvitationResponse` in `InvitationsController.cs` to include `PropertyAddress` field

- [x] Task 8: Update InvitationsController for PropertyId (AC: #1)
  - [x] 8.1 Update `CreateInvitationRequest` record to include `Guid? PropertyId`: `public record CreateInvitationRequest(string Email, string Role = "Owner", Guid? PropertyId = null);`
  - [x] 8.2 Pass `request.PropertyId` to `CreateInvitationCommand` in the controller action
  - [x] 8.3 Update `ValidateInvitationResponse` to include `string? PropertyAddress`

- [x] Task 8.5: Update ResendInvitationHandler to carry PropertyId (AC: #1, #4)
  - [x] 8.5.1 In `ResendInvitationCommandHandler.Handle()`, copy `PropertyId = original.PropertyId` to the new invitation entity (line ~89 in ResendInvitation.cs)
  - [x] 8.5.2 When the original invitation has a PropertyId, call `SendTenantInvitationEmailAsync` instead of the generic `SendInvitationEmailAsync` (fetch property address from DB)
  - [x] 8.5.3 Add unit test: resend tenant invitation preserves PropertyId and sends tenant email
  - [x] 8.5.4 Add unit test: resend non-tenant invitation does not set PropertyId, sends generic email

- [x] Task 9: Frontend — add "Invite Tenant" button on property detail page (AC: #1)
  - [x] 9.1 Create `InviteTenantDialogComponent` in `frontend/src/app/features/properties/components/invite-tenant-dialog/` — dialog with email field only (role is pre-set to "Tenant", PropertyId comes from the property context)
  - [x] 9.2 Add an "Invite Tenant" button to the property detail page action area (uses mat-button with person_add icon)
  - [x] 9.3 On dialog submit, call the existing invitation API endpoint with `{ email, role: 'Tenant', propertyId }` via the generated API client or a direct HttpClient call
  - [x] 9.4 Show success/error snackbar after invitation is sent
  - [x] 9.5 Only show the "Invite Tenant" button for Owner role users (use PermissionService)

- [x] Task 10: Frontend — update accept-invitation page for tenant context (AC: #2, #4)
  - [x] 10.1 Update the accept-invitation component to display the property address when `propertyAddress` is returned from the validate endpoint
  - [x] 10.2 Show contextual message like "You're being invited to submit maintenance requests for [property address]"

- [x] Task 11: Backend unit tests (AC: #1, #2, #4, #5, #6)
  - [x] 11.1 Test: `CreateInvitationHandler` — when role is "Tenant" and PropertyId is valid, creates invitation with PropertyId set
  - [x] 11.2 Test: `CreateInvitationHandler` — when role is "Tenant" and PropertyId belongs to a different account, throws validation error
  - [x] 11.3 Test: `CreateInvitationHandler` — when role is "Tenant" and PropertyId does not exist, throws validation error
  - [x] 11.4 Test: `CreateInvitationHandler` — when role is "Tenant", calls `SendTenantInvitationEmailAsync` with property address
  - [x] 11.5 Test: `CreateInvitationValidator` — "Tenant" is a valid role
  - [x] 11.6 Test: `CreateInvitationValidator` — when role is "Tenant", PropertyId is required (null fails)
  - [x] 11.7 Test: `CreateInvitationValidator` — when role is "Owner", PropertyId must be null (non-null fails)
  - [x] 11.8 Test: `AcceptInvitationHandler` — when invitation has PropertyId, passes it to `CreateUserWithConfirmedEmailAsync`
  - [x] 11.9 Test: `AcceptInvitationHandler` — when invitation has no PropertyId (Owner/Contributor), propertyId is null
  - [x] 11.10 Test: `ValidateInvitationHandler` — when invitation has PropertyId, returns property address
  - [x] 11.11 Test: `ValidateInvitationHandler` — when invitation has no PropertyId, returns null for property address

- [x] Task 12: Frontend unit tests (AC: #1, #4)
  - [x] 12.1 Test: `InviteTenantDialogComponent` — renders email input and submit button
  - [x] 12.2 Test: `InviteTenantDialogComponent` — validates email is required
  - [x] 12.3 Test: `InviteTenantDialogComponent` — returns `{ email, role: 'Tenant', propertyId }` on submit
  - [x] 12.4 Test: accept-invitation component — displays property address when present in validation response
  - [x] 12.5 Test: accept-invitation component — does not display property address when not present

- [x] Task 13: Verify all existing tests pass (AC: all)
  - [x] 13.1 Run `dotnet test` — all backend tests pass
  - [x] 13.2 Run `npm test` — all frontend tests pass
  - [x] 13.3 Run `dotnet build` and `ng build` — both compile without errors

## Dev Notes

### Architecture: Extending Existing Invitation Infrastructure

This story extends the invitation infrastructure established in Epic 19 (Stories 19.1, 19.6). The core pattern is already in place — we are adding `PropertyId` to the invitation entity and extending the create/accept/validate flows to handle tenant-specific logic.

**No new API endpoints.** The existing `/api/v1/invitations` endpoints are extended with the optional `PropertyId` field. The frontend adds a new dialog on the property detail page that calls the same endpoint with `role: 'Tenant'` and `propertyId`.

### Key Files to Modify

**Domain Layer:**
- `backend/src/PropertyManager.Domain/Entities/Invitation.cs` — add `PropertyId` (nullable Guid) and `Property` nav property

**Application Layer:**
- `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` — extend command with PropertyId, add property ownership validation, call tenant email
- `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs` — add "Tenant" to valid roles, conditional PropertyId validation
- `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` — pass PropertyId to CreateUserWithConfirmedEmailAsync
- `backend/src/PropertyManager.Application/Invitations/ValidateInvitation.cs` — return PropertyId and property address
- `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs` — add `SendTenantInvitationEmailAsync`

**Infrastructure Layer:**
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` — configure PropertyId FK
- `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs` — implement tenant invitation email with property address
- New migration file for PropertyId on Invitations table

**API Layer:**
- `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` — update DTOs (CreateInvitationRequest, ValidateInvitationResponse)

**Frontend:**
- New: `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.ts`
- Modified: `frontend/src/app/features/properties/property-detail/property-detail.component.ts` — add "Invite Tenant" button
- Modified: `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts` — display property address
- Modified: `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.html` — property address display

### Critical Patterns to Follow

1. **Invitation entity has no AuditableEntity base class or global query filters.** It is a standalone entity with its own `CreatedAt`, `ExpiresAt`, `UsedAt` fields. No AccountId-based global filtering — invitations are queried directly by CodeHash. The `AccountId` on Invitation is the target account, not a multi-tenancy filter.

2. **FluentValidation conditional rules.** Use the top-level `When()` pattern (verified via docs):
   ```csharp
   When(x => x.Role == "Tenant", () => {
       RuleFor(x => x.PropertyId).NotNull().WithMessage("...");
   });
   ```

3. **CreateInvitationCommand is a positional record.** Adding `PropertyId` means updating the parameter list: `public record CreateInvitationCommand(string Email, string Role, Guid? PropertyId = null)`. The default value maintains backward compatibility.

4. **AcceptInvitationHandler already passes `propertyId: null`** to `CreateUserWithConfirmedEmailAsync` (line 119 of current code). For tenant invitations, replace `null` with `invitation.PropertyId`.

5. **Property address format.** Compose from Property fields: `$"{property.Street}, {property.City}, {property.State} {property.ZipCode}"`. Use this same format in both the email and the validate response.

6. **Email service pattern.** Add a new method `SendTenantInvitationEmailAsync` rather than modifying the existing `SendInvitationEmailAsync` signature. This avoids breaking existing callers (ResendInvitation also calls the generic version).

7. **Frontend dialog pattern.** Follow the existing `InviteUserDialogComponent` pattern in `frontend/src/app/features/settings/components/invite-user-dialog/`. The tenant version is simpler: email-only input (role and propertyId are pre-set from context). Use `MAT_DIALOG_DATA` to pass the `propertyId` into the dialog.

8. **Controller DTOs at bottom of controller file.** Request/Response records are defined at the bottom of the controller file, not in separate files. Extend the existing records.

9. **Validators injected into controllers and called explicitly** before `_mediator.Send()`. Not via MediatR pipeline behavior.

10. **Property ownership validation in handler, not validator.** The validator checks structural rules (PropertyId not null when Tenant). The handler checks business rules (PropertyId belongs to current user's account) because it requires database access.

### Previous Story Intelligence

From Story 20.1:
- `PropertyId` was added to `ApplicationUser` as nullable Guid with FK to Properties and SetNull delete behavior
- `CreateUserWithConfirmedEmailAsync` already accepts optional `Guid? propertyId = null` parameter — this is the integration point for AC #2
- JWT claims include `propertyId` when present — the accepted tenant will automatically get the right JWT
- All existing tests (1735 backend, 2694 frontend) pass — baseline for regression testing
- The `UpdateUserRoleAsync` method now accepts "Tenant" as a valid role string
- Owner role was updated to include MaintenanceRequests and Properties.ViewAssigned permissions

From Story 20.1 review:
- Migration files must be staged with `git add` (they were initially untracked)
- `UpdateUserRoleAsync` does not clear PropertyId when changing FROM Tenant — acceptable for now, but worth noting

### Migration Notes

- Column: `PropertyId` (nullable Guid) on `Invitations` table
- FK: References `Properties.Id` — use `DeleteBehavior.SetNull` (if property is deleted, invitation's PropertyId becomes null; invitation itself remains for audit)
- Index: Add index on `PropertyId` for potential lookups

### Testing Strategy

- **Backend unit tests** for:
  - CreateInvitationHandler: PropertyId stored, property ownership validated, tenant email called
  - CreateInvitationValidator: conditional PropertyId rules, "Tenant" role allowed
  - AcceptInvitationHandler: PropertyId passed through to user creation
  - ValidateInvitationHandler: property address returned
- **Frontend unit tests** for:
  - InviteTenantDialogComponent: form validation and output
  - Accept-invitation component: property address display
- **No integration tests in this story** — Story 20.11 provides comprehensive authorization lockdown tests
- **No E2E tests** — would require end-to-end invitation flow with MailHog; tenant dashboard doesn't exist yet (Story 20.5)

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.2)
- PRD: `docs/project/prd-tenant-portal.md` (FR-TP1, FR-TP4, FR-TP5, NFR-TP4)
- Previous story: `docs/project/stories/epic-20/20-1-tenant-role-property-association.md`
- Architecture: `docs/project/architecture.md`
- Project Context: `docs/project/project-context.md`
- Existing invitation infrastructure:
  - Entity: `backend/src/PropertyManager.Domain/Entities/Invitation.cs`
  - Create handler: `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs`
  - Accept handler: `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs`
  - Validate handler: `backend/src/PropertyManager.Application/Invitations/ValidateInvitation.cs`
  - Validator: `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs`
  - Controller: `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs`
  - Email service: `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs`
  - EF config: `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs`
  - Frontend dialog: `frontend/src/app/features/settings/components/invite-user-dialog/invite-user-dialog.component.ts`
  - Frontend accept page: `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts`

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- NSwag generation failed (Net90 runtime not available with .NET 10) — manually updated API client types

### Completion Notes List
- Task 1-2: Added PropertyId (nullable Guid) + Property nav prop to Invitation entity, configured FK with SetNull delete behavior, added index, created and applied migration
- Task 3: Extended CreateInvitationCommand with optional PropertyId parameter, added property ownership validation in handler, conditional tenant email dispatch
- Task 4: Updated validator — "Tenant" is valid role, PropertyId required when Tenant, PropertyId must be null for non-Tenant
- Task 5: Added SendTenantInvitationEmailAsync to IEmailService and SmtpEmailService with property address in HTML/text email
- Task 6: Changed AcceptInvitationHandler to pass invitation.PropertyId to CreateUserWithConfirmedEmailAsync (was hardcoded null)
- Task 7: Extended ValidateInvitationResult with PropertyId and PropertyAddress, handler loads property for address formatting
- Task 8: Updated controller DTOs and command construction to pass PropertyId through
- Task 8.5: ResendInvitationHandler now copies PropertyId and dispatches tenant-specific email when applicable
- Task 9: Created InviteTenantDialogComponent with email-only form, added "Invite Tenant" button to property detail (Owner only via PermissionService)
- Task 10: Accept-invitation component now displays property address with contextual message
- Task 11: Added 13 new backend unit tests across CreateInvitation, AcceptInvitation, ValidateInvitation, and ResendInvitation test files
- Task 12: Added 9 new frontend unit tests for InviteTenantDialogComponent and accept-invitation property address display
- Task 13: All 1750 backend tests pass, all 2703 frontend tests pass, both build successfully
- FakeEmailService in WebApplicationFactory updated to implement new IEmailService method

### File List

**New Files:**
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260412194849_AddInvitationPropertyId.cs`
- `backend/src/PropertyManager.Infrastructure/Persistence/Migrations/20260412194849_AddInvitationPropertyId.Designer.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/ValidateInvitationTests.cs`
- `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.ts`
- `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.spec.ts`

**Modified Files:**
- `backend/src/PropertyManager.Domain/Entities/Invitation.cs` — added PropertyId and Property nav property
- `backend/src/PropertyManager.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` — PropertyId FK, index
- `backend/src/PropertyManager.Application/Invitations/CreateInvitation.cs` — PropertyId on command, property ownership validation, tenant email
- `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs` — "Tenant" role, conditional PropertyId rules
- `backend/src/PropertyManager.Application/Invitations/AcceptInvitation.cs` — pass invitation.PropertyId to user creation
- `backend/src/PropertyManager.Application/Invitations/ValidateInvitation.cs` — PropertyId and PropertyAddress in result
- `backend/src/PropertyManager.Application/Invitations/ResendInvitation.cs` — copy PropertyId, tenant email dispatch
- `backend/src/PropertyManager.Application/Common/Interfaces/IEmailService.cs` — added SendTenantInvitationEmailAsync
- `backend/src/PropertyManager.Infrastructure/Email/SmtpEmailService.cs` — implemented SendTenantInvitationEmailAsync
- `backend/src/PropertyManager.Api/Controllers/InvitationsController.cs` — updated DTOs and command construction
- `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` — FakeEmailService tenant method
- `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` — 7 new tests
- `backend/tests/PropertyManager.Application.Tests/Invitations/AcceptInvitationTests.cs` — 2 new tests
- `backend/tests/PropertyManager.Application.Tests/Invitations/ResendInvitationTests.cs` — 2 new tests
- `frontend/src/app/core/api/api.service.ts` — added propertyId to CreateInvitationRequest, propertyAddress to ValidateInvitationResponse
- `frontend/src/app/features/properties/property-detail/property-detail.component.ts` — Invite Tenant button + dialog integration
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.ts` — propertyAddress signal
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.html` — property address display
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.scss` — property-display styling
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.spec.ts` — 2 new tests
- `docs/project/sprint-status.yaml` — story 20-2 status updated
- `docs/project/stories/epic-20/20-2-tenant-invitation-flow.md` — task completion, dev agent record
