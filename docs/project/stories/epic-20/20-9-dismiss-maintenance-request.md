# Story 20.9: Dismiss Maintenance Request

Status: done

## Story

As a landlord,
I want to dismiss a maintenance request with a reason,
so that the tenant understands why their request will not be addressed.

## Acceptance Criteria

1. **Given** a landlord (Owner role) on the maintenance request detail page,
   **And** the request status is `Submitted`,
   **When** the page renders,
   **Then** a `Dismiss` button is visible alongside the `Convert to Work Order` button (with `cancel` Material icon, `mat-stroked-button color="warn"` styling so it is visually subordinate to the primary Convert action). (AC-20.9.1)

2. **Given** a request whose status is `InProgress`, `Resolved`, or `Dismissed`,
   **When** the landlord views the detail page,
   **Then** the `Dismiss` button is NOT rendered. (AC-20.9.5)

3. **Given** a tenant user navigating directly to `/maintenance-requests/{id}` (a landlord URL),
   **When** the route is hit,
   **Then** `ownerGuard` redirects the user to `/tenant` (no UI leakage — same behaviour as Story 20-7 AC #11; no new guard work).

4. **Given** the landlord clicks `Dismiss`,
   **When** the dismissal dialog opens,
   **Then** the dialog shows:
   - read-only request summary (property name + truncated description, 100 chars max),
   - a `Reason` `<textarea>` (required, 2,000 char max, empty initial value, `rows="4"`, `mat-form-field appearance="outline"`),
   - `Cancel` and `Dismiss Request` buttons. (AC-20.9.1)

5. **Given** the dismissal dialog is open,
   **When** the reason field is empty (after trim) or exceeds 2,000 characters,
   **Then** the `Dismiss Request` button is `disabled` and a `mat-error` is shown for the relevant rule. (AC-20.9.3)

6. **Given** the dialog `Dismiss Request` button is clicked with valid input,
   **When** the backend handler runs,
   **Then** it loads the `MaintenanceRequest`, sets `DismissalReason = command.Reason.Trim()`, calls `MaintenanceRequest.TransitionTo(MaintenanceRequestStatus.Dismissed)` (enforcing the `Submitted → Dismissed` rule), and persists with a single `SaveChangesAsync`. No work order is created and no photos are mutated. (AC-20.9.2)

7. **Given** a successful dismissal,
   **When** the API returns,
   **Then** the response shape is `204 No Content` (no body — the request entity is the only thing modified and is already in the client's state; the frontend reloads the request after success). (AC-20.9.2)

8. **Given** a successful dismissal,
   **When** the dialog closes,
   **Then** the front-end shows a `Maintenance request dismissed` snackbar (4s duration), refreshes the request via `MaintenanceRequestStore.loadRequestById(id)` so the page re-renders with `Status = Dismissed` and the `DismissalReason` visible in the existing `dismissal-reason` block (Story 20-7). The landlord stays on the detail page.

9. **Given** a tenant viewing the dismissed request on their dashboard,
   **When** the tenant dashboard reloads,
   **Then** the request status displays as `Dismissed` and the landlord's reason is rendered in the existing dismissal-reason block on the tenant request-detail view. (AC-20.9.4)

10. **Given** a request that is NOT in `Submitted` status,
    **When** the landlord (or any attacker) POSTs to the dismiss endpoint,
    **Then** the backend handler returns `400 Bad Request` (mapped from `BusinessRuleException` by `GlobalExceptionHandlerMiddleware`) with a problem-details `title` of `Business rule violation` and a message naming the source status. The frontend button is hidden in this case (AC #2), but the backend enforces the rule too — UI guards do not satisfy security.

11. **Given** a tenant attempting `POST /api/v1/maintenance-requests/{id}/dismiss`,
    **When** the request is authenticated as Tenant role,
    **Then** the API returns `403 Forbidden` (per the new `CanDismissMaintenanceRequests` policy, which requires `MaintenanceRequests.Dismiss` — Tenant role does not have it).

12. **Given** a contributor attempting the same call,
    **When** the request is authenticated as Contributor role,
    **Then** the API returns `403 Forbidden` (Contributor lacks `MaintenanceRequests.Dismiss`).

13. **Given** a request from a different account,
    **When** the landlord POSTs to dismiss it,
    **Then** the API returns `404 Not Found` (global query filter excludes it).

14. **Given** a non-existent request ID,
    **When** the landlord POSTs to dismiss,
    **Then** the API returns `404 Not Found` (`NotFoundException`).

15. **Given** an empty or whitespace-only `reason` in the request body,
    **When** the validator runs,
    **Then** the backend returns `400 ValidationProblemDetails` with the error `Reason is required` — the client-side disabled button is the first line of defence, but the backend enforces independently.

16. **Given** a `reason` longer than 2,000 characters,
    **When** the validator runs,
    **Then** the backend returns `400 ValidationProblemDetails` with the error `Reason must be 2000 characters or less`.

17. **Given** the dialog is open and the user clicks `Cancel`,
    **When** the dialog closes without a result,
    **Then** no API call is made, the request status stays `Submitted`, and the detail page state is unchanged.

18. **Given** the new permission and policy registration,
    **When** the application starts,
    **Then** `Permissions.MaintenanceRequests.Dismiss` exists, `RolePermissions["Owner"]` includes it, `RolePermissions["Tenant"]` and `RolePermissions["Contributor"]` do NOT include it, and the `CanDismissMaintenanceRequests` authorization policy is registered in `Program.cs` and applied to the dismiss endpoint.

## Tasks / Subtasks

- [x] Task 1: Backend — New permission + role mapping + policy (AC #11, #12, #18)
  - [x] 1.1 In `backend/src/PropertyManager.Domain/Authorization/Permissions.cs` add `public const string Dismiss = "MaintenanceRequests.Dismiss";` to the `MaintenanceRequests` inner class (alphabetical: after `Create`, `ViewOwn`, `ViewAll` is fine; match the existing 20.3 ordering).
  - [x] 1.2 In `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs` add `Permissions.MaintenanceRequests.Dismiss,` to the `Owner` HashSet (under the existing `// Maintenance Requests (Owner has all permissions)` block). Do NOT add it to `Contributor` or `Tenant`.
  - [x] 1.3 In `backend/src/PropertyManager.Api/Program.cs` add a new policy registration alongside `CanCreateMaintenanceRequests` (line 174): `AddPermissionPolicy(options, "CanDismissMaintenanceRequests", Permissions.MaintenanceRequests.Dismiss);`. Use the existing `AddPermissionPolicy` helper.
  - [x] 1.4 Update `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` `RegisteredPolicies` HashSet to include `"CanDismissMaintenanceRequests"` (line 17–30 block). Without this, the existing `EveryAuthorizeAttribute_PolicyIsRegistered` test will fail when the controller references the new policy.
  - [x] 1.5 Add unit tests to `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/MaintenanceRequestPermissionsTests.cs` (extend the existing file from Story 20.3):
    - `RolePermissions_Owner_Has_DismissMaintenanceRequests`
    - `RolePermissions_Tenant_DoesNotHave_DismissMaintenanceRequests`
    - `RolePermissions_Contributor_DoesNotHave_DismissMaintenanceRequests`

- [x] Task 2: Backend — `DismissMaintenanceRequestCommand` + handler (AC #6, #10, #13, #14)
  - [ ] 2.1 Create `backend/src/PropertyManager.Application/MaintenanceRequests/DismissMaintenanceRequest.cs` with:
    ```csharp
    public record DismissMaintenanceRequestCommand(
        Guid MaintenanceRequestId,
        string Reason
    ) : IRequest<Unit>;
    ```
    Return type `Unit` so the handler signals "void async" via MediatR. The controller will translate this into `NoContent()` (AC #7).
  - [ ] 2.2 Handler injects `IAppDbContext`, `ICurrentUser`, `ILogger<DismissMaintenanceRequestCommandHandler>`. Follow the constructor + private readonly field pattern from `ConvertMaintenanceRequestToWorkOrderCommandHandler` (file-scoped namespace, nullable enabled).
  - [ ] 2.3 Load the maintenance request (no `Include` needed — we don't touch photos or related work orders). Filter `mr.Id == request.MaintenanceRequestId && mr.AccountId == _currentUser.AccountId && mr.DeletedAt == null`. Throw `NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId)` when missing (AC #13, #14).
  - [ ] 2.4 Mutate the entity:
    ```csharp
    maintenanceRequest.DismissalReason = request.Reason.Trim();
    maintenanceRequest.TransitionTo(MaintenanceRequestStatus.Dismissed);
    await _dbContext.SaveChangesAsync(cancellationToken);
    ```
    `TransitionTo` enforces `Submitted → Dismissed`; any other source status throws `BusinessRuleException` → 400 via middleware (AC #10).
  - [ ] 2.5 NO explicit transaction — there is a single `SaveChangesAsync` call. If the transition exception fires before the save, EF Core's `ChangeTracker` already has the `DismissalReason` set but `SaveChanges` is never called, so nothing is persisted. The audit interceptor handles `UpdatedAt`.
  - [ ] 2.6 Log after the save: `_logger.LogInformation("Dismissed maintenance request {RequestId} with reason length {ReasonLength}", maintenanceRequest.Id, maintenanceRequest.DismissalReason!.Length)`. Do NOT log the reason text itself — could contain tenant-personal information.
  - [ ] 2.7 Return `Unit.Value`. No try/catch — domain exceptions flow to the global middleware (project-context.md §"Anti-Patterns").

- [x] Task 3: Backend — Validator (AC #15, #16)
  - [ ] 3.1 Create `backend/src/PropertyManager.Application/MaintenanceRequests/DismissMaintenanceRequestValidator.cs`:
    ```csharp
    public class DismissMaintenanceRequestValidator
        : AbstractValidator<DismissMaintenanceRequestCommand> {
      public DismissMaintenanceRequestValidator() {
        RuleFor(x => x.MaintenanceRequestId)
            .NotEmpty().WithMessage("Maintenance request id is required");
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Reason is required")
            .MaximumLength(2000).WithMessage("Reason must be 2000 characters or less");
      }
    }
    ```
    `NotEmpty()` in FluentValidation rejects null, empty, and whitespace-only strings out of the box for `string`. Confirmed via Ref MCP (see References).

- [x] Task 4: Backend — Controller endpoint (AC #7, #10, #11, #12, #13, #14, #18)
  - [ ] 4.1 In `MaintenanceRequestsController.cs`, inject `IValidator<DismissMaintenanceRequestCommand> _dismissValidator` (alongside `_createValidator` and `_convertValidator`). Add the constructor parameter and the private readonly field.
  - [ ] 4.2 Add the action:
    ```csharp
    [HttpPost("{id:guid}/dismiss")]
    [Authorize(Policy = "CanDismissMaintenanceRequests")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DismissMaintenanceRequest(
        Guid id,
        [FromBody] DismissMaintenanceRequestRequest request,
        CancellationToken cancellationToken)
    {
        var command = new DismissMaintenanceRequestCommand(id, request.Reason);

        var validationResult = await _dismissValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Maintenance request {MaintenanceRequestId} dismissed", id);

        return NoContent();
    }
    ```
  - [ ] 4.3 At the bottom of the controller file (alongside `ConvertMaintenanceRequestRequest`) add:
    ```csharp
    /// <summary>
    /// Request model for the dismiss endpoint (Story 20.9).
    /// </summary>
    public record DismissMaintenanceRequestRequest(string Reason);
    ```

- [x] Task 5: Backend — Domain entity state machine assertion (AC #10)
  - [ ] 5.1 No domain code change. `MaintenanceRequest.TransitionTo(Dismissed)` already enforces `Submitted → Dismissed` and throws `BusinessRuleException` for any other source status. Confirm by reading `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs` lines 39–56 (the switch in `TransitionTo`).
  - [ ] 5.2 Verify the existing entity unit tests cover `Submitted → Dismissed` success and `InProgress → Dismissed` failure (Story 20.3 Task 13.4 and 13.7). No new entity tests needed.

- [x] Task 6: Backend — Unit tests for handler (AC #6, #10, #13, #14, #15)
  - [ ] 6.1 Create `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/DismissMaintenanceRequestHandlerTests.cs` following the existing `CreateMaintenanceRequestHandlerTests` and `ConvertMaintenanceRequestToWorkOrderHandlerTests` style (`Mock<IAppDbContext>`, `Mock<ICurrentUser>`, `MockQueryable.Moq` for DbSets, `BuildMockDbSet()`). Cover:
    - `Handle_ValidSubmittedRequest_SetsDismissalReasonAndTransitionsStatus` — asserts `mr.DismissalReason == "Tenant moved out"`, `mr.Status == MaintenanceRequestStatus.Dismissed`, and `SaveChangesAsync` was called exactly once
    - `Handle_TrimsReason` — input `"  Tenant moved out  "` → stored `"Tenant moved out"`
    - `Handle_RequestNotFound_ThrowsNotFoundException` (AC #14)
    - `Handle_RequestFromOtherAccount_ThrowsNotFoundException` (AC #13) — seed an MR with a different `AccountId`; the global-filter simulation (`SetupDbSet` helper) excludes it
    - `Handle_RequestInProgress_ThrowsBusinessRuleException` (AC #10) — `TransitionTo` enforces this; assert type + message contains `'InProgress'`
    - `Handle_RequestResolved_ThrowsBusinessRuleException`
    - `Handle_RequestDismissed_ThrowsBusinessRuleException` — dismissing an already-dismissed request must fail (no idempotency contract)
    - `Handle_BusinessRuleException_DoesNotPersist` — when `TransitionTo` throws, verify `SaveChangesAsync` is NOT called (`Times.Never`). This is the "rollback" proof for the single-save path: no transaction needed because nothing is saved.
    - `Handle_PersistsExactlyOneSaveChanges` — `_dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once)` on the happy path
  - [ ] 6.2 Create `DismissMaintenanceRequestValidatorTests.cs` covering:
    - empty reason → fails with `Reason is required`
    - whitespace-only reason (e.g., `"   "`) → fails with `Reason is required` (FluentValidation `NotEmpty()` rejects whitespace for strings — verified via Ref MCP)
    - null reason → fails with `Reason is required`
    - 2001-char reason → fails with `Reason must be 2000 characters or less`
    - exactly 2000 chars → passes
    - 1-char reason → passes
    - empty `MaintenanceRequestId` (Guid.Empty) → fails

- [x] Task 7: Backend — `dotnet build` + `dotnet test` (gate)
  - [x] 7.1 `cd backend && dotnet build` — zero errors.
  - [x] 7.2 `cd backend && dotnet test` — all unit tests pass including the new ones. Cite the count in the Dev Agent Record after the run.

- [x] Task 8: Frontend — Extend `MaintenanceRequestService` (AC #6, #7)
  - [ ] 8.1 Add to `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`:
    ```ts
    export interface DismissMaintenanceRequestBody {
      reason: string;
    }
    dismissMaintenanceRequest(id: string, body: DismissMaintenanceRequestBody): Observable<void> {
      return this.http.post<void>(`${this.baseUrl}/${id}/dismiss`, body);
    }
    ```
    The method returns `Observable<void>` because the backend responds `204 No Content`. The dialog will handle success/error in `.subscribe({...})`.
  - [ ] 8.2 Extend `maintenance-request.service.spec.ts` with:
    - `dismissMaintenanceRequest_posts_to_dismiss_url_with_reason_body` — uses `HttpTestingController` to assert URL `/api/v1/maintenance-requests/{id}/dismiss`, method `POST`, body `{ reason: 'Tenant moved out' }`
    - `dismissMaintenanceRequest_completes_on_204_response` — flushes a `null` response and asserts the observable completes

- [x] Task 9: Frontend — Dismiss dialog component (AC #4, #5, #17)
  - [ ] 9.1 Create `frontend/src/app/features/maintenance-requests/components/dismiss-request-dialog/dismiss-request-dialog.component.ts` modeled closely on `convert-request-dialog.component.ts` (Story 20.8) but with a simpler form (no category, no vendor, no store dependencies). Standalone, imports: `CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule`.
  - [ ] 9.2 Inject `MAT_DIALOG_DATA` typed as:
    ```ts
    export interface DismissRequestDialogData {
      maintenanceRequestId: string;
      propertyName: string;
      description: string; // for read-only summary (truncate to 100 in template)
    }
    // The dialog returns `true` on success and `undefined` on cancel.
    export type DismissRequestDialogResult = true;
    ```
  - [ ] 9.3 Inject `MatDialogRef<DismissRequestDialogComponent, DismissRequestDialogResult>`, `FormBuilder`, `MaintenanceRequestService`, `MatSnackBar`.
  - [ ] 9.4 Reactive form:
    ```ts
    form = this.fb.group({
      reason: ['', [Validators.required, Validators.maxLength(2000)]],
    });
    readonly isSubmitting = signal(false);
    ```
    Note: `Validators.required` on an empty string passes from a UX perspective but FluentValidation rejects whitespace-only on the backend. To mirror, add a custom `noWhitespaceValidator` OR rely on the trim in `onSubmit` + the backend rejection. **Decision: trim in `onSubmit` and disable the submit button when `form.invalid || form.value.reason?.trim() === ''`.** This keeps the validator simple and the backend stays authoritative.
  - [ ] 9.5 Template structure (no `ngOnInit` — no store loading needed):
    ```html
    <div data-testid="dismiss-dialog">
      <h2 mat-dialog-title>Dismiss Maintenance Request</h2>
      <mat-dialog-content>
        <p class="property-label">Property: {{ data.propertyName }}</p>
        <p class="description-summary" data-testid="dismiss-dialog-summary">
          {{ data.description | slice:0:100 }}{{ data.description.length > 100 ? '…' : '' }}
        </p>
        <p class="warning-text">
          This will tell the tenant their request will not be addressed.
        </p>
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="4"
              data-testid="dismiss-dialog-reason"
            ></textarea>
            @if (form.controls.reason.hasError('required')) {
              <mat-error>Reason is required</mat-error>
            }
            @if (form.controls.reason.hasError('maxlength')) {
              <mat-error>Reason must be 2000 characters or less</mat-error>
            }
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close data-testid="dismiss-dialog-cancel">Cancel</button>
        <button
          mat-flat-button
          color="warn"
          [disabled]="isSubmitDisabled()"
          (click)="onSubmit()"
          data-testid="dismiss-dialog-submit">
          @if (isSubmitting()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            Dismiss Request
          }
        </button>
      </mat-dialog-actions>
    </div>
    ```
    `isSubmitDisabled()` is a computed signal: `this.form.invalid || this.isSubmitting() || (this.form.value.reason ?? '').trim() === ''`. Use a `computed()` so the disabled state reacts to value changes; subscribe via `form.valueChanges` is NOT needed because the template re-evaluates the binding on each Angular CD cycle (form value access triggers it). Alternatively, expose a simple method `isSubmitDisabled(): boolean { ... }` — either form is acceptable; the spec tests by clicking & expecting no service call.
  - [ ] 9.6 `onSubmit()`:
    ```ts
    if (this.isSubmitDisabled()) return;
    this.isSubmitting.set(true);
    const reason = (this.form.value.reason ?? '').trim();
    this.service.dismissMaintenanceRequest(this.data.maintenanceRequestId, { reason }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Failed to dismiss request', 'Close', { duration: 4000 });
      },
    });
    ```
  - [ ] 9.7 `data-testid` attributes (E2E selectors):
    - `dismiss-dialog` on the root container
    - `dismiss-dialog-summary` on the description summary `<p>`
    - `dismiss-dialog-reason` on the textarea
    - `dismiss-dialog-submit` on the `Dismiss Request` button
    - `dismiss-dialog-cancel` on the `Cancel` button
  - [ ] 9.8 Styles: reuse the structure from `convert-request-dialog.component.ts` styles block — `.full-width`, `.property-label`, `mat-dialog-content { min-width: 400px; }` with the same `@media (max-width: 600px)` override. Add a small `.warning-text` rule (`color: var(--mat-sys-error)`, `font-size: 0.875rem`) to make the warning paragraph stand out.
  - [ ] 9.9 Spec file `dismiss-request-dialog.component.spec.ts` (mirror `convert-request-dialog.component.spec.ts` shape):
    - `creates the component`
    - `renders the dialog with the dismiss testid`
    - `renders the property name and truncated description summary` (use a 150-char description, assert ellipsis added)
    - `disables the submit button when reason is empty` (form starts empty so button disabled initially)
    - `disables the submit button when reason is whitespace only` (patch `'   '`)
    - `disables the submit button when reason exceeds 2000 chars`
    - `submits with trimmed reason` (`'  Tenant moved out  '` → service called with `{ reason: 'Tenant moved out' }`)
    - `closes the dialog with true on success` (`mockDialogRef.close` called with `true`)
    - `shows snackbar and keeps dialog open on error` (error path)
    - `does NOT call the service when already submitting`
    - `cancel button has mat-dialog-close attribute and does not call service`
  - [ ] 9.10 No `ExpenseStore` / `VendorStore` mocks needed — the dialog does not depend on them (intentional simplification vs. the convert dialog).

- [x] Task 10: Frontend — Wire button + dialog into the request detail page (AC #1, #2, #8)
  - [ ] 10.1 Modify `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`:
    - Import `DismissRequestDialogComponent, DismissRequestDialogData, DismissRequestDialogResult` from `../dismiss-request-dialog/dismiss-request-dialog.component`.
    - In the `.page-header` block, after the existing `Convert to Work Order` button (inside the same `@if (req.status === 'Submitted')` block to satisfy AC #2 — both buttons share the visibility rule), add a `Dismiss` button:
      ```html
      <button
        mat-stroked-button
        color="warn"
        (click)="openDismissDialog(req)"
        class="dismiss-button"
        data-testid="dismiss-button">
        <mat-icon>cancel</mat-icon>
        Dismiss
      </button>
      ```
    - Add the click handler:
      ```ts
      openDismissDialog(req: MaintenanceRequestDto): void {
        const dialogRef = this.dialog.open<
          DismissRequestDialogComponent,
          DismissRequestDialogData,
          DismissRequestDialogResult
        >(DismissRequestDialogComponent, {
          data: {
            maintenanceRequestId: req.id,
            propertyName: req.propertyName,
            description: req.description,
          },
          width: '500px',
          maxWidth: '95vw',
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (!result) {
            return;
          }
          this.snackBar.open('Maintenance request dismissed', 'Close', { duration: 4000 });
          // Refresh the request so the page re-renders with Dismissed status + reason.
          if (this.requestId) {
            this.store.loadRequestById(this.requestId);
          }
        });
      }
      ```
    - The `.dismiss-button mat-icon { margin-right: 4px; }` rule should be added alongside the existing `.back-button mat-icon, .convert-button mat-icon` selector in the component's `styles` array (combine into a `, .dismiss-button mat-icon` extension).
  - [ ] 10.2 Update the detail component spec `maintenance-request-detail.component.spec.ts`:
    - Renders Dismiss button when status is `Submitted` (AC #1)
    - Does NOT render Dismiss button when status is `InProgress` / `Resolved` / `Dismissed` (AC #2 — 3 separate cases; the existing Convert-button tests already cover the visibility rule, so add parallel assertions on `[data-testid="dismiss-button"]`)
    - Clicking Dismiss opens the dialog with `{ maintenanceRequestId, propertyName, description }`
    - When the dialog returns `true`, the component shows the dismissed snackbar AND calls `store.loadRequestById(requestId)` to refresh
    - When the dialog closes with no result (Cancel), `loadRequestById` is NOT called and the snackbar is NOT shown (AC #17)
    - Existing convert-button tests must still pass — both buttons render in the same `@if` block; the Dismiss tests should NOT remove the Convert visibility test
  - [ ] 10.3 No store change required. `MaintenanceRequestStore.loadRequestById` already exists from 20.7 and is exported. The detail component already injects `store` so reuse it.

- [x] Task 11: Backend — Integration tests for the dismiss endpoint (AC #6, #7, #10, #11, #12, #13, #14, #15, #16)
  - [ ] 11.1 Append a new region to `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` titled `// POST /api/v1/maintenance-requests/{id}/dismiss — Story 20.9 (AC #6, #7, #10–#16)` right after the convert region (line 1146). Reuse the existing helpers: `CreateTestUserAsync`, `CreatePropertyInAccountAsync`, `CreateTenantUserInAccountAsync`, `CreateTestUserInAccountAsync`, `LoginAsync`, `PostAsJsonWithAuthAsync`, `SeedMaintenanceRequestAsync`, and `CreateTenantContextAsync`. No new helpers needed.
  - [ ] 11.2 Tests (mirror the convert-region naming convention):
    - `Dismiss_WithoutAuth_Returns401`
    - `Dismiss_AsOwner_ValidSubmittedRequest_Returns204` — assert `204 NoContent`, body is empty
    - `Dismiss_AsOwner_PersistsReasonAndStatus` — after success, read DB with `IgnoreQueryFilters()` and assert `mr.Status == MaintenanceRequestStatus.Dismissed`, `mr.DismissalReason == "Tenant moved out"` (verify trim: send `"  Tenant moved out  "`)
    - `Dismiss_AsOwner_RequestInProgress_Returns400BusinessRule` — seed with `Status = InProgress`; assert 400 and content contains `"InProgress"`
    - `Dismiss_AsOwner_RequestResolved_Returns400`
    - `Dismiss_AsOwner_RequestDismissed_Returns400`
    - `Dismiss_AsOwner_EmptyReason_Returns400Validation` — body `{ reason = "" }`; assert 400 and content contains `"Reason"`
    - `Dismiss_AsOwner_WhitespaceReason_Returns400Validation` — body `{ reason = "   " }`; assert 400
    - `Dismiss_AsOwner_ReasonOver2000_Returns400Validation` — body `{ reason = new string('x', 2001) }`; assert 400 and content contains `"2000"`
    - `Dismiss_AsOwner_NonexistentRequest_Returns404`
    - `Dismiss_AsOwner_RequestFromDifferentAccount_Returns404`
    - `Dismiss_AsTenant_Returns403` — uses `CreateTenantContextAsync`, seed an MR in the tenant's property/account, call dismiss → 403
    - `Dismiss_AsContributor_Returns403` — seed contributor user in owner's account
    - `Dismiss_BusinessRuleViolation_DoesNotChangeRequest` (AC #10) — seed an `InProgress` request, call dismiss, assert (a) response is 400 and (b) the persisted entity still has `Status = InProgress` and `DismissalReason = null`. This proves nothing was persisted because no SaveChanges ran.
  - [ ] 11.3 No need to mock `IDbContextTransaction` — the dismiss handler uses a single `SaveChangesAsync` without an explicit transaction, so the "rollback" proof is simply "DB unchanged after a non-Submitted source status". Document this rationale in the test region's leading comment.

- [x] Task 12: Frontend — Tenant dashboard read-side regression (AC #9)
  - [ ] 12.1 Read `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.html` and `frontend/src/app/features/tenant-dashboard/components/request-detail/request-detail.component.html` (or component template). Confirm both already render `Dismissed` status and the dismissal-reason block when present (Story 20.5 added the read-only display).
  - [ ] 12.2 If a tenant-detail dismissal-reason block exists, NO frontend change is needed for tenant view. The new E2E spec (Task 13 Spec 3) verifies the end-to-end behavior. If somehow the tenant detail does NOT render the dismissal reason (verify by reading the file), add it in a small follow-up commit — but **expectation is no change needed** because Story 20.5 + Story 20.7's status badge already handles `'Dismissed'`.
  - [ ] 12.3 Document the verification result in the Dev Agent Record so reviewers can confirm.

- [x] Task 13: E2E — Playwright landlord dismiss flow (AC #1, #6, #8, #9, #17)
  - [ ] 13.1 Create page object `frontend/e2e/pages/dismiss-request-dialog.page.ts` extending `BasePage`. Locators:
    - `dialog` (`[data-testid="dismiss-dialog"]`)
    - `reasonInput` (`[data-testid="dismiss-dialog-reason"]`)
    - `submitButton` (`[data-testid="dismiss-dialog-submit"]`)
    - `cancelButton` (`[data-testid="dismiss-dialog-cancel"]`)
    - `summary` (`[data-testid="dismiss-dialog-summary"]`)
    - Methods: `expectVisible()`, `expectClosed()`, `setReason(text)`, `submit()`, `cancel()`
    - Mirror the structure of `convert-request-dialog.page.ts`. Override `goto()` to throw "opened from detail page" like the convert dialog page.
  - [ ] 13.2 Register `dismissRequestDialogPage` in `frontend/e2e/fixtures/test-fixtures.ts` (alongside `convertRequestDialogPage` line 173). Pattern:
    ```ts
    dismissRequestDialogPage: async ({ page }, use) => {
      await use(new DismissRequestDialogPage(page));
    },
    ```
    Import the class at the top and add `dismissRequestDialogPage: DismissRequestDialogPage;` to the `MyFixtures` type alongside line 89.
  - [ ] 13.3 Create `frontend/e2e/tests/maintenance-requests/dismiss-request.spec.ts` with 4 specs (mirror `convert-request.spec.ts`):
    - **Spec 1 — Dismiss button visible for Submitted requests (AC #1):** seed throwaway landlord + tenant + Submitted request; landlord opens detail → assert `[data-testid="dismiss-button"]` visible AND `[data-testid="convert-button"]` visible (both share the Submitted-status visibility rule).
    - **Spec 2 — Happy-path dismissal updates the detail page (AC #6, #8):** landlord clicks Dismiss → dialog opens → fills reason `"E2E dismissal reason ${Date.now()}"` → submits → snackbar appears with text `"Maintenance request dismissed"` → page status chip becomes `Dismissed` → dismissal-reason block appears with the reason text → both Convert and Dismiss buttons are now hidden (since status is no longer Submitted). Stay on `/maintenance-requests/{id}`.
    - **Spec 3 — Tenant sees `Dismissed` + reason after landlord dismisses (AC #9):** orchestrate landlord-dismisses, then clear cookies/storage, `loginAsTenant`, navigate to `/tenant`, find the request row in the tenant dashboard and confirm the status reads `Dismissed`. Optionally, navigate to the tenant-side detail view and confirm the dismissal-reason text is visible. **Note**: if the tenant detail URL routing is not yet wired (Story 20.5 might have only added the list view), fall back to asserting the dashboard row status badge only. Verify the tenant route during Task 12.
    - **Spec 4 — Cancel closes the dialog with no side effects (AC #17):** open dialog → click Cancel → URL unchanged, dialog closed, no snackbar, status chip still `Submitted`, Dismiss button still visible.
  - [ ] 13.4 Reuse `createLandlordViaInvitation`, `createPropertyViaApi`, `inviteTenantViaApi`, `acceptTenantInvitation`, `getAccessToken`, `submitMaintenanceRequestViaApi`, `loginAsLandlord`, `loginAsTenant` from `frontend/e2e/helpers/tenant.helper.ts`. No new helpers needed.
  - [ ] 13.5 Each spec uses unique data (`Date.now()` + `Math.random().toString(36).slice(2,8)`) per the test-isolation pattern from Story 20.8.

- [x] Task 14: Frontend — Vitest + ng build gate (AC: all)
  - [x] 14.1 `cd frontend && npm test` — all suites pass; the new spec files are picked up.
  - [x] 14.2 `cd frontend && ng build` — clean production build. **Expected** initial bundle ~580 kB (4-5 kB over the 575 kB budget per 20-7/20-8 baseline). Any NEW regression > 1 kB needs investigation; budget already documented.

- [x] Task 15: Sprint status (Process)
  - [x] 15.1 Update `docs/project/sprint-status.yaml`: `20-9-dismiss-maintenance-request: backlog` → flip to `in-progress` at dev start, then `review` when work + smoke is green (the `/dev-story` workflow handles this).

## Dev Notes

### Backend: Why a Single SaveChanges, No Explicit Transaction

Unlike Story 20.8 (Convert), Dismiss touches a single entity (`MaintenanceRequest`). There is exactly one `SaveChangesAsync` call. The state transition (`TransitionTo`) and the field assignment (`DismissalReason = ...`) happen in memory on the tracked entity. If the transition throws (`BusinessRuleException`), the in-memory `DismissalReason` mutation is discarded because `SaveChanges` is never called — there is nothing to roll back.

This is intentionally simpler than the convert handler. Resist the urge to add a `BeginTransactionAsync` "for consistency" — it adds an unnecessary round-trip and obscures the simple shape. The integration test `Dismiss_BusinessRuleViolation_DoesNotChangeRequest` proves the entity is unchanged on the failure path.

### Backend: Permission Choice — New `MaintenanceRequests.Dismiss`

We deliberately register a NEW permission (`MaintenanceRequests.Dismiss`) and a NEW policy (`CanDismissMaintenanceRequests`) rather than reusing the convert endpoint's `CanManageWorkOrders`. Rationale:

- **Semantic correctness**: Dismissal does not create or manage a work order. Coupling it to `WorkOrders.Create` would be load-bearing coincidence ("Owner happens to have both"). Future role changes (e.g., a hypothetical "PropertyManager" role with WO power but not dismissal power) would silently break.
- **Auditability**: a Dismiss-specific permission makes RBAC dashboards/reports clearer.
- **Minimal cost**: one constant, one HashSet entry, one policy registration, three permission tests.

If a future story introduces a "ContributorPlus" role that can dismiss but cannot create work orders, the permission split pays off. If not, the duplication is a low cost.

### Backend: `Unit` Return Type and `204 NoContent`

`IRequest<Unit>` is MediatR's idiomatic "void async". The handler `Handle` method returns `Task<Unit>` and the body returns `Unit.Value`. The controller awaits `_mediator.Send(command, ct)` (ignoring the `Unit` result) and calls `return NoContent();`. No DTO. No `Location` header (the resource already exists at the same URI — we just mutated state). This matches the `DeleteExpense` controller pattern in the codebase.

### Frontend: Why a Dialog, Why Stay on the Page

The convert flow navigates to `/work-orders/{id}` because the user's mental model is "I moved to the new work order". The dismiss flow does NOT navigate because there is nothing new to look at — the user is done with this request, and the same page now shows the dismissal reason and status. Snackbar feedback + state refresh is enough.

`store.loadRequestById(this.requestId)` triggers a fresh GET; the global signal store's `selectedRequest` updates, the detail page template re-renders, the Convert + Dismiss buttons disappear (status no longer `Submitted`), and the dismissal-reason block becomes visible. Zero manual cache wiring.

### Frontend: Reason Trimming + Validator Sympathy

`Validators.required` in Angular treats `'   '` as valid (it only checks for empty/null). FluentValidation's `NotEmpty()` on the backend rejects whitespace-only strings. To reconcile:

- The dialog's `isSubmitDisabled()` check trims before evaluating empty (`(reason ?? '').trim() === ''`).
- The `onSubmit` sends the trimmed value.
- The backend is the source of truth; if a regression slips through (e.g., a user pastes a `<br>` tag), the 400 surfaces in the error snackbar.

We do NOT write a custom Angular `noWhitespaceValidator` because the trim-on-submit + button-disabled covers the UX, and the backend covers correctness.

### Frontend: Computed vs Method for `isSubmitDisabled`

Angular's `computed()` works on signal inputs. The form control values are NOT signals (`form.value.reason` is a plain string), so `computed()` would not re-evaluate when the input changes. Two viable options:

1. **Method on the component** that re-runs every change-detection tick. Simple, correct, no `valueChanges` subscription. Pick this.
2. **`toSignal(form.valueChanges)`** + `computed()`. More plumbing for no real benefit on a 1-field form.

Pick option 1. The submit button's `[disabled]="isSubmitDisabled()"` is re-evaluated by Angular's CD on each tick.

### Frontend: Where the Dismiss Button Lives

Inside the existing `@if (req.status === 'Submitted')` block in `maintenance-request-detail.component.ts`. Both Convert and Dismiss share the visibility rule (AC #2). Placing them in the same conditional avoids two separate `@if` blocks evaluating the same predicate.

The Convert button is `mat-flat-button color="primary"` (the primary action). The Dismiss button is `mat-stroked-button color="warn"` (subordinate, destructive). This is the standard Material guidance: primary filled + secondary stroked.

### Status Transition: Defense in Depth

The frontend hides the buttons when status is not `Submitted` (AC #2). The backend handler enforces the same rule via `TransitionTo` (AC #10). The validator rejects empty/long reasons (AC #15, #16). The authorization policy rejects tenant/contributor callers (AC #11, #12). Four independent guards; any one alone is sufficient for security, but together they're robust against UI bypass, role hopping, and direct API exploration.

### Why No SignalR Push for Tenant Status Updates

Same trade-off as Story 20.8 — the tenant sees the dismissal on next dashboard load. Building real-time push is deferred. AC #9 is satisfied by the tenant navigating to / reloading the dashboard after the landlord dismisses. The E2E spec (Task 13 Spec 3) makes the reload explicit (clear cookies + storage, fresh `loginAsTenant`).

### NSwag Regeneration

Optional. The hand-written `MaintenanceRequestService` does not depend on `core/api/api.service.ts`. If NSwag is re-run separately, the new endpoint will appear in the generated client, but this story does not require it. (Same call-out as Story 20.8.)

### Test Scope

- **Unit tests: Required**
  - Backend handler tests: `DismissMaintenanceRequestHandlerTests` — happy path, trim, BRE on non-Submitted, NotFound, no persistence on failure
  - Backend validator tests: `DismissMaintenanceRequestValidatorTests` — empty, whitespace, null, over-2000, exactly-2000, 1-char, empty Id
  - Backend permission tests: extend `MaintenanceRequestPermissionsTests` — Owner has `Dismiss`, Tenant/Contributor do not
  - Backend authorization policy registration test: extend `AuthorizationPolicyTests.RegisteredPolicies` HashSet
  - Frontend service test: `dismissMaintenanceRequest` URL + body + completion
  - Frontend dialog component spec: render, validation, submit, success, error, cancel
  - Frontend detail component spec: Dismiss button visibility, dialog open, snackbar + refresh on success, no-op on cancel

- **Integration tests: Required.** New backend endpoint exercises EF Core, multi-tenant filter, validator binding, policy authorization, exception middleware mapping. Integration tests cover scenarios the unit tests cannot (real JWT auth, real DI graph, real ProblemDetails serialization). Add the new region to `MaintenanceRequestsControllerTests.cs` (Task 11).

- **E2E tests: Required.** New UI interaction (button → dialog → state refresh), new tenant-visible status change, new role-symmetry contract. 4 specs covering happy path, role-aware visibility, tenant view sync, cancel no-op. Add `frontend/e2e/tests/maintenance-requests/dismiss-request.spec.ts` (Task 13).

### Previous Story Intelligence

From **Story 20.3**:
- `MaintenanceRequest.TransitionTo` is the single source of truth for status changes. Throws `BusinessRuleException` mapped to 400 by `GlobalExceptionHandlerMiddleware`.
- `MaintenanceRequestDto.DismissalReason` is already nullable string in the DTO and is populated by `GetMaintenanceRequestById` (`backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs` line 109). The frontend types in `maintenance-request.service.ts` already include `dismissalReason: string | null`. No DTO change needed.
- `MaintenanceRequest.DismissalReason` column was added in migration `20260413112445_AddMaintenanceRequest` (Story 20.3 Task 4) with `HasMaxLength(2000)` and nullable. **No new migration needed.**
- Baseline post-20.3: 1150 backend tests; latest from 20.8 dev record: 1242 Application + 98 Infra + 823 Api = 2163 tests. Cite the fresh count after Task 7.

From **Story 20.7**:
- The detail page already renders the `dismissal-reason` block conditionally on `req.status === 'Dismissed' && req.dismissalReason`. After dismiss + refresh, the block appears automatically — **no template change for the read-side**.
- `MaintenanceRequestStore.loadRequestById(id)` is already in place and re-fetches the detail. Reuse for the post-dismiss refresh.
- E2E helpers `loginAsLandlord`, `createLandlordViaInvitation`, `setupTenantContext` live in `frontend/e2e/helpers/tenant.helper.ts`.

From **Story 20.8**:
- The detail component shape: page-header flexbox with `back-button` on the left and the action button(s) on the right; on mobile (`@media (max-width: 768px)`) the header stacks vertically. The Dismiss button slots in next to the Convert button — both render only when status is `Submitted`.
- `MatDialogModule` is intentionally NOT in the detail component's imports list. The detail opens dialogs via `MatDialog.open(...)` programmatically, and the test-bed's MatDialog mock relies on the module not being shadowed. Follow the same convention for the Dismiss dialog wiring.
- The convert dialog spec uses `vi.fn()`, `signal()` for store mocks, and `NoopAnimationsModule`. The dismiss spec is even simpler — no store mocks.
- E2E spec 3 (tenant sees status update) clears cookies + storage between landlord and tenant sessions on the same `page` context. Apply the same pattern in dismiss spec 3.
- TestController.Reset 500 errors during E2E global teardown are pre-existing (the TestController never deleted `MaintenanceRequests` / `MaintenanceRequestPhotos`). Specs are isolated by unique data names, so this does not flake individual specs. Out of scope.

From **Story 21.1** (MaintenanceRequestsControllerTests):
- The test class is `IClassFixture<PropertyManagerWebApplicationFactory>` and already has `CreateTenantContextAsync`, `SeedMaintenanceRequestAsync`, `LoginAsync`, `PostAsJsonWithAuthAsync`, `GetWithAuthAsync`. Append the dismiss region; do not extract helpers.

### Critical Patterns to Follow (Reminder)

1. **No try/catch in controller** for domain exceptions (project-context.md §"Anti-Patterns").
2. **Use `IAppDbContext` directly** in handler, no repository.
3. **Records for command / request DTOs**, file-scoped namespace, nullable enabled.
4. **Domain entity owns state transitions** (`TransitionTo`); handler calls it.
5. **`DateTime.UtcNow` only**; the auditable interceptor handles `UpdatedAt` automatically on `SaveChanges`.
6. **Validators called explicitly in the controller**, not via MediatR pipeline behavior.
7. **`[ProducesResponseType]` for every status code** the action returns (204, 400, 401, 403, 404 for dismiss).
8. **`data-testid` on every actionable element** the E2E touches.
9. **Standalone components, `inject()` API, `@if`/`@for` control flow** (project-context.md §"Framework-Specific Rules").
10. **rxjs in service, NOT signal-store transactions** — the dialog calls the service directly; success refreshes the store via the existing `loadRequestById` method.
11. **Structured logging only** — `_logger.LogInformation("Dismissed maintenance request {RequestId} ...", id)`. Never interpolate the reason text (privacy).

### Out of Scope

- **Resolve when work order completes** — Story 20.10. The backend will hook into `UpdateWorkOrderStatus` to sync linked `MaintenanceRequest`s to `Resolved`. Dismiss is unaffected.
- **Real-time tenant status updates (SignalR)** — Future. The tenant sees the update on next dashboard load.
- **Un-dismiss / re-open a dismissed request** — Out of scope. The state machine in 20.3 has no `Dismissed → *` transition; any future "reopen" feature would need a new transition AND a UX flow.
- **Audit log of who dismissed and when** — `AuditableEntity` already tracks `UpdatedAt`; tracking the actor user id would require either a separate audit table or a new field on `MaintenanceRequest`. Not requested by FR-TP15 — defer.
- **NSwag regeneration** — Optional, same as Story 20.8.
- **Bulk dismiss from inbox** — Not in 20.9 scope. Per-request only.

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.9 section)
- PRD: `docs/project/prd-tenant-portal.md` (FR-TP15, FR-TP16)
- Architecture: `docs/project/architecture.md`
- Project Context: `docs/project/project-context.md`
- Previous stories:
  - `docs/project/stories/epic-20/20-3-maintenance-request-entity-api.md` (entity, status enum, DTO, `TransitionTo`, exception middleware mapping)
  - `docs/project/stories/epic-20/20-4-maintenance-request-photos.md` (photo entity — not touched by dismiss but documents the data model)
  - `docs/project/stories/epic-20/20-5-tenant-dashboard-role-routing.md` (tenant dashboard reads status + dismissal reason)
  - `docs/project/stories/epic-20/20-7-landlord-maintenance-request-inbox.md` (landlord detail page where the Dismiss button lives)
  - `docs/project/stories/epic-20/20-8-convert-request-to-work-order.md` (sibling action; dialog + detail-page-button pattern to replicate)
- Backend reference implementations:
  - Entity: `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs` (TransitionTo logic, DismissalReason field)
  - Enum: `backend/src/PropertyManager.Domain/Enums/MaintenanceRequestStatus.cs`
  - Permissions: `backend/src/PropertyManager.Domain/Authorization/Permissions.cs`
  - Role mappings: `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`
  - Convert handler (template for handler shape): `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrder.cs`
  - Convert validator (template for validator shape): `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderValidator.cs`
  - Create handler (single-save template): `backend/src/PropertyManager.Application/MaintenanceRequests/CreateMaintenanceRequest.cs`
  - DTO: `backend/src/PropertyManager.Application/MaintenanceRequests/MaintenanceRequestDto.cs`
  - Get by id handler (returns DismissalReason): `backend/src/PropertyManager.Application/MaintenanceRequests/GetMaintenanceRequestById.cs`
  - Controller (extend): `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`
  - Authorization policies (extend): `backend/src/PropertyManager.Api/Program.cs` (lines 162–175)
  - `AddPermissionPolicy` helper: `backend/src/PropertyManager.Api/Program.cs` (line 178)
  - Exception middleware (BusinessRuleException → 400, NotFoundException → 404): `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs`
  - Integration test file (extend): `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`
  - Permissions test (extend): `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/MaintenanceRequestPermissionsTests.cs`
  - Authorization policy test (extend `RegisteredPolicies`): `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs`
- Frontend reference implementations:
  - Convert dialog (template): `frontend/src/app/features/maintenance-requests/components/convert-request-dialog/convert-request-dialog.component.ts`
  - Convert dialog spec (template): `frontend/src/app/features/maintenance-requests/components/convert-request-dialog/convert-request-dialog.component.spec.ts`
  - Maintenance request service (extend): `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`
  - Maintenance request service spec (extend): `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.spec.ts`
  - Maintenance request store (re-use `loadRequestById`): `frontend/src/app/features/maintenance-requests/stores/maintenance-request.store.ts`
  - Detail component (extend): `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`
  - Detail component spec (extend): `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.spec.ts`
  - Tenant dashboard read-side (verify): `frontend/src/app/features/tenant-dashboard/tenant-dashboard.component.ts`/`.html`
  - Owner guard (already in place): `frontend/src/app/core/auth/owner.guard.ts`
- E2E reference:
  - Convert dialog page object (template): `frontend/e2e/pages/convert-request-dialog.page.ts`
  - Convert spec (template): `frontend/e2e/tests/maintenance-requests/convert-request.spec.ts`
  - Test fixtures (extend): `frontend/e2e/fixtures/test-fixtures.ts`
  - Tenant helpers: `frontend/e2e/helpers/tenant.helper.ts` (`loginAsLandlord`, `loginAsTenant`, `createLandlordViaInvitation`, `createPropertyViaApi`, `inviteTenantViaApi`, `acceptTenantInvitation`, `getAccessToken`, `submitMaintenanceRequestViaApi`)
  - BasePage: `frontend/e2e/pages/base.page.ts`
- External documentation verified during story authoring:
  - FluentValidation `NotEmpty()` rule semantics (strings rejected when null/empty/whitespace) — confirmed against the 12.x docs reused in `CreateMaintenanceRequestValidator` and `ConvertMaintenanceRequestToWorkOrderValidator` (Stories 20.3 + 20.8). No new lookup required.
  - Angular Material `MatDialog` (v21) `open` / `MatDialogRef.afterClosed` / `MAT_DIALOG_DATA` — already verified in Story 20.8 (https://github.com/angular/components/blob/main/src/material/dialog/dialog.md). No changes since then; pattern reused verbatim.
  - MediatR `IRequest<Unit>` + `Unit.Value` — long-standing API, used elsewhere in the codebase (search `IRequest<Unit>` in the backend for precedents).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Backend build: clean, 0 errors, 4 warnings (all pre-existing — package obsolescence + nullability noise in unrelated files).
- Backend test run (`cd backend && dotnet test --no-build`):
  - PropertyManager.Application.Tests: 1261 passed / 0 failed / 0 skipped
  - PropertyManager.Infrastructure.Tests: 98 passed / 0 failed / 0 skipped
  - PropertyManager.Api.Tests: 837 passed / 0 failed / 0 skipped
  - Grand total: 2196 / 2196 passing, 0 regressions vs. the 20.8 baseline (~2163).
- Frontend Vitest run (`cd frontend && npm test`): 129 spec files / 2881 tests / 2881 passed (up from 128 / ~2865 prior). New spec files picked up:
  - `dismiss-request-dialog.component.spec.ts` (14 tests)
  - dismiss block added to `maintenance-request-detail.component.spec.ts` (+9 tests)
  - dismiss block added to `maintenance-request.service.spec.ts` (+2 tests)
- Frontend production build (`cd frontend && npm run build`): clean compile, initial bundle 579.70 kB / transfer 146.76 kB. Budget overrun of 4.70 kB matches the pre-existing 20-7/20-8 baseline — no NEW regression vs. last green.
- E2E specs are authored but not executed locally in this dev run; orchestrator's evaluate phase runs the Playwright suite.

### Completion Notes List

- Task 1 (permissions/policy): added `MaintenanceRequests.Dismiss` permission, Owner role mapping, `CanDismissMaintenanceRequests` policy, and policy registration tests. Three new permission-mapping tests + the existing `AllRegisteredPolicies_AreUsedInAtLeastOneAttribute` test now reaches green once the controller references the policy in Task 4.
- Task 2 (handler): `DismissMaintenanceRequestCommand` + handler with `IRequest<Unit>` shape. Single `SaveChangesAsync`, no explicit transaction (per Dev Notes rationale). Tenant-PII-safe logging — reason text never logged.
- Task 3 (validator): `DismissMaintenanceRequestValidator` — `NotEmpty()` rejects null/empty/whitespace strings out-of-the-box (FluentValidation 12.x); `MaximumLength(2000)` per AC #16. Followed the existing `ConvertMaintenanceRequestToWorkOrderValidator` style.
- Task 4 (controller): `POST /api/v1/maintenance-requests/{id}/dismiss` returning 204; `[Authorize(Policy = "CanDismissMaintenanceRequests")]` + the full `[ProducesResponseType]` block (204/400/401/403/404). New `_dismissValidator` injected alongside `_createValidator` and `_convertValidator`. `DismissMaintenanceRequestRequest` record at the bottom of the file.
- Task 5 (entity): no changes — `MaintenanceRequest.TransitionTo` already supports `Submitted → Dismissed` (line 44 of `MaintenanceRequest.cs`).
- Task 6 (unit tests): 9 handler tests (happy path / trim / persists-once / not-found / cross-account / 3× state-machine failures / no-persist on BRE) + 7 validator tests (1-char / 2000-char boundary / empty / whitespace / null / 2001-char / empty Guid). All passing.
- Task 7 (gate): build + targeted test run both green.
- Task 8 (frontend service): `DismissMaintenanceRequestBody` interface + `dismissMaintenanceRequest(id, body): Observable<void>`. Service spec extended with 2 new tests (URL/body + 204 completion).
- Task 9 (dismiss dialog): standalone Material dialog with reactive form, signal `isSubmitting`, trim-aware `isSubmitDisabled()` method (decided method over `computed()` per Dev Notes — form values aren't signals). 14-test spec covers render, validation, submit-trim, success/error, cancel, already-submitting.
- Task 10 (detail page wiring): Dismiss button rendered inside the existing `@if (req.status === 'Submitted')` block alongside Convert, `mat-stroked-button color="warn"`. `openDismissDialog` shows snackbar + calls `store.loadRequestById` on success; cancel is a no-op. Detail spec extended with 7 new tests covering button visibility (4 status cases) + dialog data + success/cancel.
- Task 11 (integration tests): 14 new tests appended to `MaintenanceRequestsControllerTests.cs` covering 401 / 204 happy-path / DB-state-after-success / 3× source-status 400 / empty + whitespace + 2001-char validation 400 / nonexistent 404 / cross-account 404 / tenant 403 / contributor 403 / BRE leaves entity unchanged. All passing.
- Task 12 (tenant read-side): verified — tenant dashboard (`tenant-dashboard.component.html` line 80) and tenant request-detail (`request-detail.component.html` line 52) already render Dismissed status + dismissalReason block. No code change required.
- Task 13 (E2E): `DismissRequestDialogPage` POM created, registered in fixtures, and 4 specs authored (visibility, happy-path, tenant-sees-dismissed, cancel). Mirrors the convert spec patterns including the `clearCookies + clear storage` between landlord and tenant in spec 3.
- Task 14 (gate): `npm test` 2881/2881; `ng build` clean, initial bundle 579.70 kB (4.70 kB over the documented 575 kB budget — same as 20-7/20-8 baseline, no new regression).
- Task 15 (sprint): sprint-status.yaml flipped `20-9-dismiss-maintenance-request: backlog` → `in-progress` at dev start; this run flips it to `review` on completion.
- Two-stage review: skipped for individual tasks because all source edits in this run are small, targeted, and follow the verbatim story-defined patterns (controller/handler/validator/dialog/spec). The orchestrator's evaluate phase performs the adversarial review and live smoke test, which is the heavier of the two reviews for full-stack work.

### File List

Backend — created:
- `backend/src/PropertyManager.Application/MaintenanceRequests/DismissMaintenanceRequest.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequests/DismissMaintenanceRequestValidator.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/DismissMaintenanceRequestHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/DismissMaintenanceRequestValidatorTests.cs`

Backend — modified:
- `backend/src/PropertyManager.Domain/Authorization/Permissions.cs`
- `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`
- `backend/src/PropertyManager.Api/Program.cs`
- `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`
- `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/MaintenanceRequestPermissionsTests.cs`
- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`

Frontend — created:
- `frontend/src/app/features/maintenance-requests/components/dismiss-request-dialog/dismiss-request-dialog.component.ts`
- `frontend/src/app/features/maintenance-requests/components/dismiss-request-dialog/dismiss-request-dialog.component.spec.ts`

Frontend — modified:
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.spec.ts`
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.spec.ts`

E2E — created:
- `frontend/e2e/pages/dismiss-request-dialog.page.ts`
- `frontend/e2e/tests/maintenance-requests/dismiss-request.spec.ts`

E2E — modified:
- `frontend/e2e/fixtures/test-fixtures.ts`

Sprint tracking — modified:
- `docs/project/sprint-status.yaml`
- `docs/project/stories/epic-20/20-9-dismiss-maintenance-request.md` (this file)

## Evaluation Report

**Evaluator:** Skeptical QA pass via `/evaluate` (orchestrator phase 3)
**Date:** 2026-05-16
**Verdict:** PASS

### Suite Results (this turn)

| Suite | Total | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|---|
| Backend `dotnet build` | — | — | — | — | 0 errors / 0 warnings |
| Frontend `ng build` | — | — | — | — | Clean compile; 579.70 kB initial (4.70 kB over 575 kB budget — pre-existing 20-7/20-8 baseline, no new regression) |
| Backend Application.Tests | 1261 | 1261 | 0 | 0 | |
| Backend Infrastructure.Tests | 98 | 98 | 0 | 0 | |
| Backend Api.Tests | 837 | 837 | 0 | 0 | includes 14 new `Dismiss_*` integration tests |
| Frontend Vitest | 2881 | 2881 | 0 | 0 | 129 spec files |
| E2E (maintenance-requests subset, `--workers=1`) | 14 | 14 | 0 | 0 | all 4 dismiss + 4 convert + 6 inbox specs green |

### Acceptance Criteria Verification

| AC | Method | Result |
|---|---|---|
| #1 — Dismiss button visible alongside Convert when Submitted | Live Playwright MCP on `/maintenance-requests/{id}` (`role=Owner`) | VERIFIED — `mat-stroked-button color="warn"`, `cancel` icon present |
| #2 — Dismiss button NOT rendered for non-Submitted | Live MCP after dismissal (Dismissed) + template inspection (`@if (req.status === 'Submitted')` wraps both buttons) + detail-component spec covers InProgress/Resolved/Dismissed | VERIFIED |
| #3 — Tenant hitting `/maintenance-requests/:id` → `/tenant` | Route inspection (`ownerGuard` on `app.routes.ts:269`) + landlord-inbox E2E spec at line 251 passed live | VERIFIED |
| #4 — Dialog content (summary, reason textarea rows=4, Cancel + Dismiss Request) | Live MCP — title "Dismiss Maintenance Request", property label, summary, textarea `rows=4` required, both buttons rendered, warning paragraph shown | VERIFIED — screenshot `screenshots/evaluate-ac-4-dialog-open-empty.png` |
| #5 — Submit disabled on empty/whitespace/over-2000; mat-error shown | Live MCP — submit disabled for empty/`"   "`/`"x".repeat(2001)`; mat-error "Reason must be 2000 characters or less" surfaces after blur | VERIFIED — screenshot `screenshots/evaluate-ac-5-maxlength-error.png` |
| #6 — Handler sets `DismissalReason` (trimmed) and transitions Submitted→Dismissed in single SaveChanges | Live MCP — POST body `{"reason":"Evaluate smoke-test dismissal reason 20.9"}` (leading/trailing spaces stripped on the frontend); status flipped to Dismissed; handler unit tests cover state-machine guards (`Handle_RequestInProgress_ThrowsBusinessRuleException`, etc.) | VERIFIED |
| #7 — 204 No Content | Live MCP network request #132: `POST /api/v1/maintenance-requests/{id}/dismiss → 204` | VERIFIED |
| #8 — Snackbar "Maintenance request dismissed", refresh via `loadRequestById`, landlord stays on detail page | Live MCP — snackbar text captured verbatim ("Maintenance request dismissed"), refresh GET fired (#133), URL unchanged, status now Dismissed, dismissal-reason block populated | VERIFIED — screenshots `screenshots/evaluate-ac-8-dismissed-state.png`, `screenshots/evaluate-ac-8-snackbar.png` |
| #9 — Tenant sees Dismissed + reason on dashboard | Tenant dashboard template (`tenant-dashboard.component.html:80-85` renders dismissalReason block) + tenant request-detail template (`request-detail.component.html:52-60`) + tenant-dashboard unit spec + E2E spec 3 `tenant dashboard shows Dismissed after landlord dismisses` passed live (1.4s) | VERIFIED (see Finding #1 — E2E only checks status badge, not reason text; covered by other layers) |
| #10 — 400 Business rule violation with source status in message | Live API: re-dismiss returned `400` with `title:"Business rule violation"`, `detail:"Cannot transition maintenance request from 'Dismissed' to 'Dismissed'."` | VERIFIED |
| #11 — Tenant POST → 403 | Integration test `Dismiss_AsTenant_Returns403` passing; policy `CanDismissMaintenanceRequests` requires `MaintenanceRequests.Dismiss` which Tenant role does NOT have (RolePermissions.cs:88-93) | VERIFIED |
| #12 — Contributor POST → 403 | Integration test `Dismiss_AsContributor_Returns403` passing; Contributor lacks `Dismiss` (RolePermissions.cs:78-86) | VERIFIED |
| #13 — Cross-account request → 404 | Integration test `Dismiss_AsOwner_RequestFromDifferentAccount_Returns404` passing; handler enforces `mr.AccountId == _currentUser.AccountId` explicitly (DismissMaintenanceRequest.cs:58) plus the global query filter | VERIFIED |
| #14 — Nonexistent ID → 404 | Live API: POST to `11111111-2222-3333-4444-555555555555` → `404 NotFoundException` with detail naming the GUID | VERIFIED |
| #15 — Empty/whitespace reason → 400 "Reason is required" | Live API: empty → 400 `{"Reason":["Reason is required"]}`; whitespace `"   "` → same | VERIFIED |
| #16 — Reason > 2000 → 400 "Reason must be 2000 characters or less" | Live API: 2001-char body → 400 with the exact message | VERIFIED |
| #17 — Cancel closes dialog with no side effects | Live MCP — Cancel closed dialog, no snackbar, status still Submitted, Dismiss button still visible, URL unchanged | VERIFIED |
| #18 — Permission + role mapping + policy registration | Permissions.cs:24 (`Dismiss = "MaintenanceRequests.Dismiss"`); RolePermissions.cs:72 (Owner has it); RolePermissions.cs:78-93 (Contributor + Tenant do NOT); Program.cs:175 (`AddPermissionPolicy(... "CanDismissMaintenanceRequests" ...)`); controller line 225 (`[Authorize(Policy = "CanDismissMaintenanceRequests")]`) | VERIFIED |

### Dimension Grading

| Dimension | Severity | Result | Evidence |
|---|---|---|---|
| 1. Functional Completeness | CRITICAL | PASS | All 18 ACs VERIFIED (12 in live MCP, 6 via test-layer + code inspection) |
| 2. Regression Safety | CRITICAL | PASS | Backend build 0/0; frontend build clean (pre-existing budget warning); 2196 backend + 2881 frontend + 14 E2E tests all green this turn |
| 3. Test Quality | HIGH | PASS | Pyramid complete (unit + integration + E2E + frontend specs). Handler tests assert state transition + persistence + no-save-on-failure proof. Integration tests query DB with `IgnoreQueryFilters()` to confirm no mutation after BRE. Finding #1 noted (E2E spec 3 doesn't assert reason text — covered by unit + template) |
| 4. Code Quality | MEDIUM | PASS | Handler: PII-safe logging (length not text), single SaveChanges per Dev Notes, defensive AccountId predicate. Controller: no try/catch (project convention), 5 `[ProducesResponseType]` attributes, validator injected explicitly. Dialog: standalone, signals, reactive form, all `data-testid` selectors present. Findings #2 + #4 are nit-level |

### Findings

1. **MEDIUM — E2E spec 3 asserts only the tenant status badge, not the dismissalReason text.** AC #9 explicitly says "the landlord's reason is rendered in the existing dismissal-reason block". The template renders it (`tenant-dashboard.component.html:80-85`), the unit spec asserts it, and integration tests confirm persistence — three layers cover the contract. Recommend a follow-up to add `await expect(card.locator('.dismissal-reason')).toContainText(reason)` after `expectStatusBadge` in `frontend/e2e/tests/maintenance-requests/dismiss-request.spec.ts:166`. **Not blocking** (defense in depth from unit + template + integration).

2. **LOW — Duplicate success logging.** Both `DismissMaintenanceRequestCommandHandler.Handle` (DismissMaintenanceRequest.cs:76) AND `MaintenanceRequestsController.DismissMaintenanceRequest` (MaintenanceRequestsController.cs:248) log on success. The controller log is redundant; the handler log is richer (includes reason length). Slight log noise; consistent with sibling create/convert endpoints. **Not blocking.**

3. **LOW — Frontend bundle budget overrun (4.70 kB).** `ng build` warns initial bundle 579.70 kB exceeds the 575 kB budget. Matches the 20-7/20-8 baseline; no new 20.9 regression (the dismiss dialog code is in lazy chunks). Documented in Dev Notes. **Not blocking.**

4. **LOW — Magic-string policy name `"CanDismissMaintenanceRequests"`** duplicated between `Program.cs:175` and `MaintenanceRequestsController.cs:225`. Consistent with `CanCreateMaintenanceRequests` and other sibling policies. **Not blocking.**

5. **INFO — Validator order on `Guid.Empty`.** Sending `id = "00000000-0000-0000-0000-000000000000"` returns 400 (`MaintenanceRequestId is required`) before the handler runs, rather than 404 from `NotFoundException`. AC #14 implicitly assumes a non-zero GUID. Confirmed 404 works correctly for any non-zero non-existent GUID. **Not blocking.**

### Evidence Artifacts

Screenshots in `screenshots/`:
- `evaluate-ac-1-dismiss-button-submitted.png`
- `evaluate-ac-4-dialog-open-empty.png`
- `evaluate-ac-5-maxlength-error.png`
- `evaluate-ac-8-dismissed-state.png`
- `evaluate-ac-8-snackbar.png`

### Verdict: PASS

All 4 dimensions pass with no CRITICAL or HIGH-blocking findings. Story status flipped to `done`; sprint-status updated accordingly.
