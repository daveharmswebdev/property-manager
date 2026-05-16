# Story 20.8: Convert Maintenance Request to Work Order

Status: done

## Story

As a landlord,
I want to convert a maintenance request into a work order,
so that I can track the repair through my existing work-order workflow.

## Acceptance Criteria

1. **Given** a landlord (Owner role) on the maintenance request detail page,
   **And** the request status is `Submitted`,
   **When** the page renders,
   **Then** a `Convert to Work Order` button is visible (with `build` Material icon) alongside a future `Dismiss` action area.

2. **Given** a request whose status is `InProgress`, `Resolved`, or `Dismissed`,
   **When** the landlord views the detail page,
   **Then** the `Convert to Work Order` button is NOT rendered (AC-20.8.7).

3. **Given** a tenant user navigating directly to `/maintenance-requests/{id}` (a landlord URL),
   **When** the route is hit,
   **Then** `ownerGuard` redirects the user to `/tenant` (no UI leakage — same behaviour as Story 20-7 AC #11).

4. **Given** the landlord clicks `Convert to Work Order`,
   **When** the conversion dialog opens,
   **Then** the dialog shows:
   - read-only property name (pre-populated from the request),
   - a description `<textarea>` pre-populated with the request description (5,000 char max, required),
   - an optional `Category` `mat-select` populated from `ExpenseStore.sortedCategories()` (matching the work-order conversion-from-expense dialog),
   - an optional `Assigned To` `mat-select` populated from `VendorStore.vendors()` with a "Self (DIY)" option (value=""),
   - `Cancel` and `Convert` buttons.

5. **Given** the dialog `Convert` button is clicked with valid input,
   **When** the backend handler runs,
   **Then** in a single transaction it: (a) creates a `WorkOrder` with `PropertyId = request.PropertyId`, `Description = command.Description.Trim()`, `CategoryId = command.CategoryId`, `VendorId = command.VendorId`, `Status = Reported`, `CreatedByUserId = currentUser.UserId`, `AccountId = currentUser.AccountId`; (b) sets `MaintenanceRequest.WorkOrderId = workOrder.Id`; (c) calls `MaintenanceRequest.TransitionTo(MaintenanceRequestStatus.InProgress)` (which enforces `Submitted → InProgress` and throws `BusinessRuleException` for any other source status).

6. **Given** the maintenance request has photos,
   **When** the conversion handler runs,
   **Then** for each `MaintenanceRequestPhoto` the handler creates a corresponding `WorkOrderPhoto` row sharing the SAME `StorageKey`, `ThumbnailStorageKey`, `OriginalFileName`, `ContentType`, `FileSizeBytes`, `DisplayOrder`, and `IsPrimary` values. **S3 objects are NOT copied** — the new `WorkOrderPhoto` row references the same S3 key (per epic-20 Technical Notes: "reference same S3 keys" is the chosen trade-off). The maintenance request's photo rows remain so the request keeps its original gallery.

7. **Given** a successful conversion,
   **When** the API returns,
   **Then** the response shape is `201 Created` with `{ workOrderId: Guid, maintenanceRequestId: Guid }` and a `Location` header pointing at `/api/v1/work-orders/{workOrderId}`.

8. **Given** a successful conversion,
   **When** the dialog closes,
   **Then** the front-end shows a `Work order created — maintenance request marked In Progress` snackbar (4s duration) and navigates the landlord to `/work-orders/{workOrderId}`.

9. **Given** a tenant viewing the converted request on their dashboard,
   **When** the tenant dashboard reloads,
   **Then** the request status displays as `In Progress` (AC-20.8.6) — driven by the existing `MaintenanceRequestStatus` enum on the same record; no tenant-side code change.

10. **Given** a request that is NOT in `Submitted` status,
    **When** the landlord (or any attacker) POSTs to the convert endpoint,
    **Then** the backend handler returns `400 Bad Request` (mapped from `BusinessRuleException` by `GlobalExceptionHandlerMiddleware`) with a problem-details `title` of `Business rule violation`. The frontend button is hidden in this case (AC #2), but the backend enforces the rule too — UI guards do not satisfy security.

11. **Given** a tenant attempting `POST /api/v1/maintenance-requests/{id}/convert`,
    **When** the request is authenticated as Tenant role,
    **Then** the API returns `403 Forbidden` (per `CanManageWorkOrders` policy, which requires `WorkOrders.Create` — Tenant role does not have it).

12. **Given** a request from a different account,
    **When** the landlord POSTs to convert it,
    **Then** the API returns `404 Not Found` (global query filter excludes it).

13. **Given** a non-existent request ID,
    **When** the landlord POSTs to convert,
    **Then** the API returns `404 Not Found` (`NotFoundException`).

14. **Given** the conversion handler is mid-flight,
    **When** `SaveChangesAsync` fails on the second save (e.g., DB error),
    **Then** the transaction rolls back and NEITHER the work order NOR the request status change is persisted (verified via integration test using an in-flight failure simulation — see Task 11).

15. **Given** the conversion dialog,
    **When** the description field is cleared (empty after trim),
    **Then** the `Convert` button is disabled (client-side validation), and the backend validator independently rejects empty/whitespace descriptions with `400 ValidationProblemDetails`.

16. **Given** the dialog is open and the user clicks `Cancel`,
    **When** the dialog closes without a result,
    **Then** no API call is made, no navigation occurs, and the detail page state is unchanged.

## Tasks / Subtasks

- [x] Task 1: Backend — `ConvertMaintenanceRequestToWorkOrderCommand` + handler (AC #5, #6, #10, #12, #13, #14)
  - [x] 1.1 Create `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrder.cs` with:
    ```csharp
    public record ConvertMaintenanceRequestToWorkOrderCommand(
        Guid MaintenanceRequestId,
        string Description,
        Guid? CategoryId,
        Guid? VendorId
    ) : IRequest<ConvertMaintenanceRequestToWorkOrderResponse>;

    public record ConvertMaintenanceRequestToWorkOrderResponse(
        Guid WorkOrderId,
        Guid MaintenanceRequestId);
    ```
  - [x] 1.2 Handler injects `IAppDbContext`, `ICurrentUser`, `ILogger<ConvertMaintenanceRequestToWorkOrderCommandHandler>`.
  - [x] 1.3 Load the maintenance request with `Include(mr => mr.Photos)` (NOT `AsNoTracking` — we need to mutate it). Filter `mr.AccountId == _currentUser.AccountId && mr.DeletedAt == null`. Throw `NotFoundException(nameof(MaintenanceRequest), id)` when missing (AC #12, #13).
  - [x] 1.4 Validate `CategoryId` (if provided): `_dbContext.ExpenseCategories.AnyAsync(c => c.Id == request.CategoryId.Value, ct)` — match `CreateWorkOrder` pattern; throw `NotFoundException(nameof(ExpenseCategory), categoryId)`.
  - [x] 1.5 Validate `VendorId` (if provided): `_dbContext.Vendors.AnyAsync(v => v.Id == request.VendorId.Value && v.AccountId == _currentUser.AccountId, ct)`; throw `NotFoundException(nameof(Vendor), vendorId)`. (Global query filter handles account isolation, but keep the explicit predicate parallel to `CreateWorkOrder` for consistency.)
  - [x] 1.6 Wrap mutations in `await using var transaction = await _dbContext.Database.BeginTransactionAsync(ct);` — mirrors `SetPrimaryWorkOrderPhoto.cs`. Two `SaveChangesAsync` calls are required because (a) the `WorkOrder` insert must assign `Id` before `MaintenanceRequest.WorkOrderId` is set, and (b) the `MaintenanceRequest` status transition must run after the WO save so a status-transition exception still rolls back the WO insert.
  - [x] 1.7 Step 1 (inside transaction):
    ```csharp
    var workOrder = new WorkOrder {
        AccountId = _currentUser.AccountId,
        PropertyId = maintenanceRequest.PropertyId,
        Description = request.Description.Trim(),
        CategoryId = request.CategoryId,
        VendorId = request.VendorId,
        Status = WorkOrderStatus.Reported,
        CreatedByUserId = _currentUser.UserId,
    };
    _dbContext.WorkOrders.Add(workOrder);
    // Copy photos (AC #6) — reference SAME S3 keys, no S3 copy
    foreach (var src in maintenanceRequest.Photos) {
        _dbContext.WorkOrderPhotos.Add(new WorkOrderPhoto {
            AccountId = _currentUser.AccountId,
            WorkOrderId = workOrder.Id,
            StorageKey = src.StorageKey,
            ThumbnailStorageKey = src.ThumbnailStorageKey,
            OriginalFileName = src.OriginalFileName,
            ContentType = src.ContentType,
            FileSizeBytes = src.FileSizeBytes,
            DisplayOrder = src.DisplayOrder,
            IsPrimary = src.IsPrimary,
            CreatedByUserId = _currentUser.UserId,
        });
    }
    await _dbContext.SaveChangesAsync(ct);
    ```
  - [x] 1.8 Step 2 (inside transaction):
    ```csharp
    maintenanceRequest.WorkOrderId = workOrder.Id;
    maintenanceRequest.TransitionTo(MaintenanceRequestStatus.InProgress); // throws BusinessRuleException for non-Submitted statuses
    await _dbContext.SaveChangesAsync(ct);
    await transaction.CommitAsync(ct);
    ```
  - [x] 1.9 Log `_logger.LogInformation("Converted maintenance request {RequestId} to work order {WorkOrderId}", maintenanceRequest.Id, workOrder.Id)` after commit.
  - [x] 1.10 Return `new ConvertMaintenanceRequestToWorkOrderResponse(workOrder.Id, maintenanceRequest.Id)`.
  - [x] 1.11 Do NOT add a try/catch — `await using` rolls the transaction back on any exception per EF Core `IDbContextTransaction` disposal semantics, and global middleware maps domain exceptions to ProblemDetails.

- [x] Task 2: Backend — Validator (AC #15)
  - [x] 2.1 Create `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderValidator.cs`:
    ```csharp
    public class ConvertMaintenanceRequestToWorkOrderValidator
        : AbstractValidator<ConvertMaintenanceRequestToWorkOrderCommand> {
      public ConvertMaintenanceRequestToWorkOrderValidator() {
        RuleFor(x => x.MaintenanceRequestId).NotEmpty().WithMessage("Maintenance request id is required");
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(5000).WithMessage("Description must be 5000 characters or less");
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty)
            .When(x => x.CategoryId.HasValue)
            .WithMessage("Category ID must be a valid non-empty GUID");
        RuleFor(x => x.VendorId).NotEqual(Guid.Empty)
            .When(x => x.VendorId.HasValue)
            .WithMessage("Vendor ID must be a valid non-empty GUID");
      }
    }
    ```

- [x] Task 3: Backend — Controller endpoint (AC #7, #10, #11, #12, #13)
  - [x] 3.1 In `MaintenanceRequestsController.cs`, add:
    ```csharp
    [HttpPost("{id:guid}/convert")]
    [Authorize(Policy = "CanManageWorkOrders")]   // Tenant lacks WorkOrders.Create → 403 (AC #11)
    [ProducesResponseType(typeof(ConvertMaintenanceRequestToWorkOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConvertToWorkOrder(
        Guid id,
        [FromBody] ConvertMaintenanceRequestRequest request,
        CancellationToken cancellationToken) { ... }
    ```
  - [x] 3.2 Inject `IValidator<ConvertMaintenanceRequestToWorkOrderCommand>` into the controller constructor (add the new validator as a private readonly field alongside `_createValidator`). Call `ValidateAsync` before `_mediator.Send`, returning `ValidationProblem(new ValidationProblemDetails(...))` on failure — matches the existing controller pattern.
  - [x] 3.3 Append the request record to the bottom of the controller file:
    ```csharp
    public record ConvertMaintenanceRequestRequest(string Description, Guid? CategoryId, Guid? VendorId);
    ```
    The response record `ConvertMaintenanceRequestToWorkOrderResponse` lives in the Application layer file from Task 1 — return it directly via `CreatedAtAction(nameof(WorkOrdersController.GetWorkOrder), "WorkOrders", new { id = workOrderId }, responseDto)`. **Verify the `CreatedAtAction` controller-name argument exactly** — `WorkOrdersController` is sibling, not the current controller; using `nameof(WorkOrdersController.GetWorkOrder)` with the controller name string `"WorkOrders"` resolves the `Location` header to `/api/v1/work-orders/{id}` (AC #7).

- [x] Task 4: Backend — Domain entity state machine assertion (AC #5, #10)
  - [x] 4.1 `MaintenanceRequest.TransitionTo(InProgress)` already enforces the `Submitted → InProgress` rule (story 20-3 Task 2 + tests). No domain code change. Confirm with a dev-note that the handler calls `TransitionTo` *after* setting `WorkOrderId` and *before* the final `SaveChangesAsync` so a non-Submitted source status rolls back the WO insert via the surrounding transaction.

- [x] Task 5: Backend — Unit tests for handler (AC #5, #6, #10, #12, #13, #14, #15)
  - [x] 5.1 Create `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderHandlerTests.cs` following the existing `CreateMaintenanceRequestHandlerTests` style (`Mock<IAppDbContext>`, `Mock<ICurrentUser>`, `MockQueryable.Moq` for DbSets, `BuildMockDbSet()`). Cover:
    - `Handle_ValidRequest_CreatesWorkOrderWithExpectedFields` — asserts new `WorkOrder` has `AccountId`, `PropertyId`, `Description.Trim()`, `Status == Reported`, `CategoryId`, `VendorId`, `CreatedByUserId = currentUser.UserId`
    - `Handle_ValidRequest_SetsMaintenanceRequestWorkOrderIdAndStatus` — asserts `mr.WorkOrderId == workOrder.Id` and `mr.Status == InProgress`
    - `Handle_WithPhotos_CreatesMirroredWorkOrderPhotos` — given 2 `MaintenanceRequestPhoto` rows, the handler adds 2 `WorkOrderPhoto` rows with matching keys & display orders, including `IsPrimary` preserved
    - `Handle_NoPhotos_NoWorkOrderPhotosAdded`
    - `Handle_RequestNotFound_ThrowsNotFoundException` (AC #13)
    - `Handle_RequestInProgress_ThrowsBusinessRuleException` (AC #10) — entity TransitionTo enforces this; assert the type & message
    - `Handle_RequestDismissed_ThrowsBusinessRuleException`
    - `Handle_RequestResolved_ThrowsBusinessRuleException`
    - `Handle_InvalidCategory_ThrowsNotFoundException`
    - `Handle_InvalidVendor_ThrowsNotFoundException`
    - `Handle_VendorFromOtherAccount_ThrowsNotFoundException`
    - `Handle_TrimsDescription` — input `"  Fix sink  "` → `"Fix sink"`
    - `Handle_PersistsViaTwoSaveChangesCalls` — `_dbContextMock.Verify(x => x.SaveChangesAsync(...), Times.Exactly(2))` (transaction wraps both)
    - `Handle_Throws_TransactionDisposed_NotCommitted` — when `TransitionTo` throws on non-Submitted status, verify the `IDbContextTransaction.CommitAsync` was NOT invoked (use `Mock<IDbContextTransaction>` via the `Database` facade). **If mocking `Database.BeginTransactionAsync` proves painful with the existing `Mock<IAppDbContext>`, document the rollback as integration-test-only (Task 11) and remove this unit test.**
  - [x] 5.2 Create `ConvertMaintenanceRequestToWorkOrderValidatorTests.cs` covering: empty description, whitespace description, 5001-char description, empty MaintenanceRequestId, empty CategoryId GUID, empty VendorId GUID, valid input.

- [x] Task 6: Backend — Authorization policy test update (AC #11)
  - [x] 6.1 Update `backend/tests/PropertyManager.Application.Tests/Common/AuthorizationPolicyTests.cs` — the convert endpoint reuses the existing `CanManageWorkOrders` policy, so no `RegisteredPolicies` change is needed. **Verify**: search the test file for any "every endpoint maps to a registered policy" assertion and ensure the new `ConvertToWorkOrder` action is picked up correctly. If the test enumerates `[Authorize(Policy = ...)]` attributes from controllers, no edit is needed.

- [x] Task 7: Backend — `dotnet build` + `dotnet test` (gate)
  - [x] 7.1 `cd backend && dotnet build` — zero errors.
  - [x] 7.2 `cd backend && dotnet test` — all unit tests pass including the new ones.

- [x] Task 8: Frontend — Extend `MaintenanceRequestService` (AC #4, #5, #7)
  - [x] 8.1 Add to `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`:
    ```ts
    export interface ConvertMaintenanceRequestRequest {
      description: string;
      categoryId?: string | null;
      vendorId?: string | null;
    }
    export interface ConvertMaintenanceRequestResponse {
      workOrderId: string;
      maintenanceRequestId: string;
    }
    convertToWorkOrder(id: string, body: ConvertMaintenanceRequestRequest)
      : Observable<ConvertMaintenanceRequestResponse> {
      return this.http.post<ConvertMaintenanceRequestResponse>(`${this.baseUrl}/${id}/convert`, body);
    }
    ```
    Drop empty string values from `categoryId` / `vendorId` BEFORE calling the service (let the dialog component pass `undefined` when blank), so the backend sees `null`.
  - [x] 8.2 Service spec `maintenance-request.service.spec.ts`: add tests for
    - `convertToWorkOrder` posts to `/api/v1/maintenance-requests/{id}/convert` with the body
    - response shape mapped through

- [x] Task 9: Frontend — Convert dialog component (AC #4, #15, #16)
  - [x] 9.1 Create `frontend/src/app/features/maintenance-requests/components/convert-request-dialog/convert-request-dialog.component.ts` modeled on `features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.ts`. Standalone, imports: `CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatProgressSpinnerModule`.
  - [x] 9.2 Inject `MAT_DIALOG_DATA` typed as:
    ```ts
    export interface ConvertRequestDialogData {
      maintenanceRequestId: string;
      propertyId: string;
      propertyName: string;
      description: string;          // pre-fill from request
    }
    export interface ConvertRequestDialogResult {
      workOrderId: string;
      maintenanceRequestId: string;
    }
    ```
  - [x] 9.3 Inject `MatDialogRef<ConvertRequestDialogComponent, ConvertRequestDialogResult>`, `FormBuilder`, `MaintenanceRequestService`, `MatSnackBar`. Protected: `ExpenseStore` (for categories), `VendorStore` (for vendors).
  - [x] 9.4 Reactive form:
    ```ts
    form = this.fb.group({
      description: [this.data.description, [Validators.required, Validators.maxLength(5000)]],
      categoryId: [''],
      vendorId: [''],   // '' = Self (DIY)
    });
    ```
  - [x] 9.5 `ngOnInit`: `this.expenseStore.loadCategories(); this.vendorStore.loadVendors();`
  - [x] 9.6 Template structure: `mat-dialog-title` ("Convert to Work Order"), `mat-dialog-content` with property label + description textarea + category select + vendor select, `mat-dialog-actions` with Cancel (`mat-dialog-close`) and `Convert` button. The submit button is `[disabled]="form.invalid || isSubmitting()"` (AC #15).
  - [x] 9.7 `onSubmit()`: trim description; build request `{ description, categoryId: form.value.categoryId || undefined, vendorId: form.value.vendorId || undefined }`; call `service.convertToWorkOrder(data.maintenanceRequestId, body)`; on next `dialogRef.close({ workOrderId, maintenanceRequestId })`; on error reset `isSubmitting`, show snackbar `'Failed to convert request to work order'`.
  - [x] 9.8 `data-testid` attributes:
    - `convert-dialog` on the root container
    - `convert-dialog-description` on the textarea
    - `convert-dialog-category` on the category mat-select
    - `convert-dialog-vendor` on the vendor mat-select
    - `convert-dialog-submit` on the Convert button
    - `convert-dialog-cancel` on the Cancel button
  - [x] 9.9 Spec file `convert-request-dialog.component.spec.ts`: tests for
    - Pre-populates description from `data.description`
    - Submit button disabled when description empty
    - Submit button disabled when description over 5000 chars
    - `onSubmit` calls `service.convertToWorkOrder` with the form values
    - Successful response closes the dialog with `{ workOrderId, maintenanceRequestId }`
    - Error response keeps the dialog open and shows snackbar (AC #16-adjacent UX)
    - `mat-dialog-close` Cancel button does NOT call the service (AC #16)

- [x] Task 10: Frontend — Wire button + dialog into the request detail page (AC #1, #2, #8)
  - [x] 10.1 Modify `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`:
    - Add `MatDialog` and `Router` injections
    - Add `MatDialogModule` to imports
    - Render the `Convert to Work Order` button next to the back-button area when `req.status === 'Submitted'`. Use `mat-flat-button color="primary"`, `<mat-icon>build</mat-icon>`, `data-testid="convert-button"`. Hide it for other statuses (AC #2).
    - Click handler `openConvertDialog(req)`:
      ```ts
      const dialogRef = this.dialog.open<
        ConvertRequestDialogComponent,
        ConvertRequestDialogData,
        ConvertRequestDialogResult
      >(ConvertRequestDialogComponent, {
        data: {
          maintenanceRequestId: req.id,
          propertyId: req.propertyId,
          propertyName: req.propertyName,
          description: req.description,
        },
        width: '600px',
        maxWidth: '95vw',
      });
      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;
        this.snackBar.open(
          'Work order created — maintenance request marked In Progress',
          'Close',
          { duration: 4000 },
        );
        this.router.navigate(['/work-orders', result.workOrderId]);
      });
      ```
    - Inject `MatSnackBar` (already used elsewhere via the snackbar module — add the import).
  - [x] 10.2 Update the detail component spec to cover:
    - Renders Convert button when status is `Submitted` (AC #1)
    - Does NOT render Convert button when status is `InProgress` / `Resolved` / `Dismissed` (AC #2 — 3 separate cases)
    - Clicking Convert opens the dialog with the request data
    - When the dialog returns a result, navigate to `/work-orders/{workOrderId}` and show the snackbar
    - When the dialog closes with no result (Cancel), do nothing (AC #16)

- [x] Task 11: Backend — Integration test for the convert endpoint (AC #5, #6, #7, #10, #11, #12, #13, #14)
  - [x] 11.1 Append a new region to `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` titled `// POST /api/v1/maintenance-requests/{id}/convert`. **Reuse** the existing helpers: `CreateTestUserAsync`, `CreatePropertyInAccountAsync`, `CreateTenantUserInAccountAsync`, `LoginAsync`, `PostAsJsonWithAuthAsync`, and the local `SeedMaintenanceRequestAsync` helper (search the file for the existing direct-DB seed and reuse).
  - [x] 11.2 Tests:
    - `Convert_AsOwner_ValidSubmittedRequest_Returns201WithBody` — assert `201`, `Location` header contains `/api/v1/work-orders/`, body shape `{ workOrderId, maintenanceRequestId }`
    - `Convert_AsOwner_PersistsWorkOrderAndUpdatesRequest` — read DB: WorkOrder has correct PropertyId / Description / Status=Reported / CreatedByUserId, MaintenanceRequest.WorkOrderId = WO.Id, Status = InProgress
    - `Convert_AsOwner_WithSourcePhotos_CopiesPhotoRowsSharedKeys` — seed two `MaintenanceRequestPhoto` rows; after convert, assert two `WorkOrderPhoto` rows exist for the new WO with matching StorageKey/ThumbnailStorageKey/DisplayOrder/IsPrimary
    - `Convert_AsOwner_RequestInProgress_Returns400BusinessRule` — seed a request with `Status = InProgress`; assert 400, problem-details `type` includes `business-rule-violation`
    - `Convert_AsOwner_RequestResolved_Returns400`
    - `Convert_AsOwner_RequestDismissed_Returns400`
    - `Convert_AsOwner_EmptyDescription_Returns400Validation`
    - `Convert_AsOwner_NonexistentRequest_Returns404`
    - `Convert_AsOwner_RequestFromDifferentAccount_Returns404` (global query filter)
    - `Convert_AsOwner_InvalidCategoryId_Returns404`
    - `Convert_AsOwner_InvalidVendorId_Returns404`
    - `Convert_AsTenant_Returns403` (AC #11) — seed tenant + request, call convert → 403
    - `Convert_AsContributor_Returns403` (Contributor lacks `WorkOrders.Create`)
    - `Convert_WithoutAuth_Returns401`
    - `Convert_BusinessRuleViolation_DoesNotCreateWorkOrder` — verify rollback (AC #14): seed an `InProgress` request, call convert, then assert `WorkOrders.CountAsync()` did NOT increase. **Note**: rollback is the simplest end-to-end proof — no need to mock the transaction.
  - [x] 11.3 The test class already has `IClassFixture<PropertyManagerWebApplicationFactory>` and the helpers; no test-infrastructure change required.

- [x] Task 12: Frontend — Vitest + ng build gate (AC: all)
  - [x] 12.1 `cd frontend && npm test` — all suites pass; the new spec files are picked up.
  - [x] 12.2 `cd frontend && ng build` — clean production build. **Expected** initial bundle ~580 kB (4-5 kB over the 575 kB budget per 20-7 baseline). Any NEW regression > 1 kB needs investigation; budget already documented.

- [x] Task 13: E2E — Playwright landlord convert happy path (AC #1, #5, #8, #9)
  - [x] 13.1 Create page object `frontend/e2e/pages/convert-request-dialog.page.ts` extending `BasePage`. Locators:
    - `dialog` (`[data-testid="convert-dialog"]`)
    - `descriptionInput`, `categorySelect`, `vendorSelect`, `submitButton`, `cancelButton`
    - Methods: `expectVisible()`, `setDescription(text)`, `submit()`, `cancel()`
  - [x] 13.2 Create `frontend/e2e/tests/maintenance-requests/convert-request.spec.ts`:
    - **Spec 1 — Convert button visible for Submitted requests, hidden otherwise (AC #1, #2):** seed throwaway landlord + tenant + request; landlord opens detail → assert button visible. Then directly mutate DB / re-load with a request that's already InProgress (via fresh convert) → button hidden.
    - **Spec 2 — Happy path conversion navigates to the new work order (AC #5, #8):** landlord opens detail → click Convert → dialog opens with description pre-filled → click Convert → URL becomes `/work-orders/{newId}`, snackbar visible, status badge on the original request page reads `In Progress` on revisit.
    - **Spec 3 — Tenant sees `In Progress` after landlord converts (AC #9):** orchestrate landlord-converts, then `loginAsTenant`, navigate to `/tenant`, assert the request row's status badge is `In Progress`.
    - **Spec 4 — Cancel closes the dialog with no side effects (AC #16):** open dialog → click Cancel → URL unchanged, dialog closed, no snackbar, request status still `Submitted`.
  - [x] 13.3 Reuse `loginAsLandlord`, `createLandlordViaInvitation`, `setupTenantContext` from `frontend/e2e/helpers/tenant.helper.ts` (Story 20-7 added these). Register `convertRequestDialogPage` in `e2e/fixtures/test-fixtures.ts`.
  - [x] 13.4 Photo-copy verification is OUT of E2E scope (covered by integration test Task 11). E2E doesn't need to assert WorkOrderPhoto rows.

- [x] Task 14: Sprint status (Process)
  - [x] 14.1 Update `docs/project/sprint-status.yaml`: `20-8-convert-request-to-work-order: ready-for-dev` → flip to `in-progress` at dev start, then `review` when work + smoke is green (the `/dev-story` workflow handles this).

## Dev Notes

### Backend: Why a Single Transaction, Two SaveChanges

EF Core can persist the new `WorkOrder`, its mirrored `WorkOrderPhoto` rows, and the `MaintenanceRequest.WorkOrderId + Status` update in **one** `SaveChangesAsync` call IF we use the tracked navigation property. However, two reasons push us to two saves inside an explicit transaction:

1. We need `workOrder.Id` to assign to `maintenanceRequest.WorkOrderId`. Although `Id` has a DB default (`gen_random_uuid()`), Application code reads `workOrder.Id` after `Add` via `ValueGeneratedOnAdd`-style generation. The `Id` Guid is materialized on `SaveChanges`. So the first save is what gives us a stable `WorkOrderId` to set on the maintenance request.
2. The `MaintenanceRequest.TransitionTo(InProgress)` call must succeed *after* the WO insert but *before* the WO commit. If we did one save with both entities, an entity-state-machine exception (`BusinessRuleException`) would still roll back via `await using` — but we lose the clear "WO created, MR transition failed" diagnostic. Two saves + `BeginTransactionAsync` mirrors the `SetPrimaryWorkOrderPhoto` pattern that's already in the codebase.

`await using var transaction` ensures rollback on any thrown exception per `IDbContextTransaction.DisposeAsync`. The middleware then maps the exception to ProblemDetails.

### Backend: Why Reference S3 Keys Instead of Copying Objects

Per epic-20 Technical Notes for Story 20.8: "Copy photos from maintenance request S3 path to work order S3 path, **or reference same S3 keys**." We pick **reference-same-keys** because:

- It's a strict subset of work (no `IStorageService.CopyAsync` needed, no second presigned upload).
- S3 keys are content-addressed by GUID, so there's no semantic mismatch — a `WorkOrderPhoto` pointing at a key under `accounts/{accountId}/maintenance-requests/{requestId}/photos/{photoId}.jpg` is still scoped to the same account; the existing presigned-URL generator (`IPhotoService.GetPhotoUrlAsync`) doesn't care which entity owns the row.
- Deleting the maintenance request later (soft delete only) does NOT delete S3 objects, so the work order's photo references stay valid.
- The `WorkOrderPhoto.StorageKey` schema doesn't include the entity type in code — it's just a string. Confirmed by reading `WorkOrderPhoto.cs` and the `IPhotoService.GenerateUploadUrlAsync` key format `{accountId}/{entityType}/{year}/{guid}.{ext}`.

**Trade-off**: If we ever hard-delete a maintenance request and prune S3 objects, the work order's photo URLs would 404. Acceptable for now — soft-delete is the only delete path in v1. Add a comment in the handler: `// AC-20.8.6: photo rows are mirrored, S3 objects are shared (see Story 20.8 Dev Notes).`

### Backend: `CanManageWorkOrders` is the Right Policy

The convert endpoint creates a new work order. The existing `CanManageWorkOrders` policy (Program.cs line 170) maps to `Permissions.WorkOrders.Create`. Tenant role does NOT have `WorkOrders.Create`. Owner does. Contributor: check `RolePermissions.cs` — per the existing `Convert_AsContributor_Returns403` expectation, Contributor also lacks it. Using the existing policy avoids adding a new authorization policy registration.

**Do NOT** apply `[Authorize(Policy = "CanCreateMaintenanceRequests")]` — that policy allows tenants, which would be a security regression.

### Frontend: Categories & Vendors Already Cached

`ExpenseStore.loadCategories()` and `VendorStore.loadVendors()` are idempotent — both stores use a "loaded" flag and skip the HTTP call when data is present. The dialog's `ngOnInit` can call them safely on every open.

`ExpenseStore.sortedCategories()` and `VendorStore.vendors()` are signals returning typed arrays — no Observable subscription needed in the template. Use `@for (cat of expenseStore.sortedCategories(); track cat.id) {...}`.

### Frontend: Why a Dialog Instead of a Route

The existing work-order create flow (`/work-orders/new`) is a full page — used when starting from scratch. A dialog is the right pattern for "convert this thing" (cf. Story 11.6's `CreateWoFromExpenseDialogComponent` for the precedent). Smaller cognitive load, the user stays on the request detail page, and on success we navigate to the new work order — which is the same UX result as a full-page form would give.

### Frontend: Navigation After Success

`router.navigate(['/work-orders', result.workOrderId])` lands on the existing work-order detail page (Story 9.8). That page already loads from `/api/v1/work-orders/{id}` so the converted WO appears immediately. The snackbar provides the "request marked In Progress" feedback before the page transition.

### Frontend: No Need to Re-load the Request Store

After the convert, the user navigates AWAY from the request detail page. The `MaintenanceRequestStore.clearSelectedRequest()` runs in `ngOnDestroy` (already in place). When the landlord later returns to `/maintenance-requests/{id}` or the inbox, the store re-fetches and sees the new `Status = InProgress` and `WorkOrderId` — no manual cache invalidation needed.

### Status Transition: TransitionTo, Not Direct Assignment

`MaintenanceRequest.Status = MaintenanceRequestStatus.InProgress` would silently succeed regardless of source status. ALWAYS use `entity.TransitionTo(InProgress)` so the domain enforces the state machine. The unit tests in 20-3 verified the throws — we don't re-test that here; we test that the handler routes through the method.

### CreatedAtAction Cross-Controller

`CreatedAtAction(nameof(WorkOrdersController.GetWorkOrder), "WorkOrders", new { id }, body)` resolves to `GET /api/v1/work-orders/{id}` because:

- `nameof(WorkOrdersController.GetWorkOrder)` → string `"GetWorkOrder"` (the action method name)
- Controller name string `"WorkOrders"` (no `Controller` suffix per ASP.NET conventions)
- Route values `{ id }` substitute into the `[HttpGet("{id:guid}")]` template on `WorkOrdersController.GetWorkOrder`

Confirmed by reading `WorkOrdersController.cs` line 139: `[HttpGet("{id:guid}")]` action `GetWorkOrder`. The class-level `[Route("api/v1/work-orders")]` provides the `/api/v1/work-orders` prefix.

### Test Scope Justification (Testing Pyramid)

- **Unit tests (xUnit, backend) — REQUIRED**: handler logic, validator rules, status-transition routing. The handler has multiple branches (CategoryId / VendorId optional, photos present/absent, transition failures) that benefit from fast, isolated tests.
- **Unit tests (Vitest, frontend) — REQUIRED**: service method, dialog component, detail component button-visibility & navigation. The dialog has form validation, snackbar, and `dialogRef.close` flows that are cheaper to verify with TestBed than Playwright.
- **Integration tests (WebApplicationFactory, backend) — REQUIRED**: the convert endpoint is new code, exercises EF Core transactions, multi-entity persistence, role-based 403, and global query filter 404. Per the "Build Before Ship" + "Testing Pyramid" memory rules, full-stack stories need WebApplicationFactory coverage. Photo-copy verification specifically needs DB introspection, which is awkward in E2E.
- **E2E tests (Playwright) — REQUIRED**: new UI interaction (button → dialog → navigate), new role-symmetry contract (tenant sees `In Progress` after landlord converts). Without E2E, we have no end-to-end proof that the dialog + service + handler chain works in the running app.

### Previous Story Intelligence

From **Story 20.3**:
- `MaintenanceRequest.TransitionTo` is the single source of truth for status changes. Throws `BusinessRuleException` (mapped to 400 by `GlobalExceptionHandlerMiddleware` line 133).
- `MaintenanceRequestDto.WorkOrderId` is already nullable — the detail GET response will surface the new link on the next reload, no DTO change.
- Backend baseline at 20.3 completion: 1150 tests; latest baseline (after 21.x) is higher — verify via `dotnet test` in Task 7.
- Migrations: this story adds NO schema (WorkOrderId column + WorkOrder FK already exist from 20.3 Task 4.7 + 4.8).

From **Story 20.4**:
- `MaintenanceRequestPhoto` lives in `MaintenanceRequestPhotos/` Application folder. Storage uses `IPhotoService` with key pattern `{accountId}/{entityType}/{year}/{guid}.{ext}`. **Confirmed**: `WorkOrderPhoto.StorageKey` has no entity-type validation, so sharing keys across rows is safe.
- `MaintenanceRequestPhotoDto` is included in `MaintenanceRequestDto.Photos` only on detail GET (story 20.3). Our handler reads `_dbContext.MaintenanceRequests.Include(mr => mr.Photos)` — confirmed the nav property exists on `MaintenanceRequest.cs` line 28.

From **Story 20.6**:
- Tenant dashboard reloads requests on navigation to `/tenant`. No SignalR push is wired for status changes. **Therefore AC #9** is satisfied by the tenant simply navigating to / refreshing the dashboard after the landlord converts — not by a live update. The E2E spec must reload the tenant view after the conversion (already implicit in the test flow).

From **Story 20.7**:
- `MaintenanceRequestDetailComponent` is read-only. We are extending it with a single `Convert` button. Keep the existing layout — slot the button into the header row alongside the back button on desktop, and let it stack below the back button on mobile (use the existing `@media (max-width: 768px)` rule).
- The detail page state container is `MaintenanceRequestStore` — `selectedRequest` signal holds the loaded request. After conversion we DON'T need to call `loadRequestById` again because we navigate away; if we did stay on the page we'd want a `requestService.refresh()` or store helper, but that's not needed here.
- `data-testid` attributes are stable selectors used by E2E. Continue the convention.
- E2E helpers `loginAsLandlord`, `createLandlordViaInvitation`, `setupTenantContext` are in `frontend/e2e/helpers/tenant.helper.ts`.

From **Story 11.6** (CreateWoFromExpenseDialog):
- Pattern for "convert X into a WO" with category + vendor + description form. **Replicate** the layout & button styling closely. Note: 11.6 does both Create WO AND link via `expenseService.updateExpense` in two HTTP calls. Our story does it in ONE backend call (the convert endpoint handles both create + link atomically), so the dialog logic is simpler — no `switchMap` chain.

From **Story 21.1** (MaintenanceRequestsControllerTests):
- Existing helpers in the test class — `CreateTenantContextAsync`, `SeedMaintenanceRequestAsync`, `LoginAsync`, `PostAsJsonWithAuthAsync` — cover most of our integration test needs. Append a new region; do not extract.

### Critical Patterns to Follow (Reminder)

1. **No try/catch in controller** for domain exceptions (project-context.md §"Anti-Patterns").
2. **Use `IAppDbContext` directly** in handler, no repository.
3. **Records for command / response**, file-scoped namespace, nullable enabled.
4. **`await using` for transactions** + `BeginTransactionAsync(cancellationToken)`.
5. **Domain entity owns state transitions** (`TransitionTo`), handler calls it.
6. **`DateTime.UtcNow` only** (the auditable interceptor sets timestamps — no manual `UpdatedAt` set in the handler; the EF interceptor does it on `SaveChanges`).
7. **Validators called explicitly in the controller**, not via MediatR pipeline behavior.
8. **`[ProducesResponseType]` for every status code** the action returns.
9. **`data-testid` on every actionable element** the E2E touches.
10. **Standalone components, `inject()` API, `@if`/`@for` control flow** (project-context.md §"Framework-Specific Rules").
11. **rxjs in service, NOT signal-store transactions** — the dialog calls the service directly because there's no need to mutate global store state on success (we navigate to a different feature module).

### Out of Scope

- **Dismiss maintenance request** — Story 20.9. The detail page will get a `Dismiss` button there.
- **Resolve when work order completes** — Story 20.10. The backend will hook into `UpdateWorkOrderStatus` to sync the linked `MaintenanceRequest` to `Resolved`.
- **Real-time tenant status updates (SignalR)** — Future. The tenant sees the update on next dashboard load.
- **S3 object copy / re-key** — Future. Current trade-off: share keys (see Dev Notes).
- **NSwag regeneration** — Optional. The hand-written `MaintenanceRequestService` does not depend on `core/api/api.service.ts`. If NSwag is re-run separately, the new endpoint will appear in the generated client, but this story does not require it.
- **Editing the work order pre-creation** — The dialog gives only Description / Category / Vendor. Tags, status overrides, etc. happen via the standard work-order edit flow after navigation.

### References

- Epic file: `docs/project/stories/epic-20/epic-20-tenant-portal.md` (Story 20.8 section)
- Previous stories:
  - `docs/project/stories/epic-20/20-3-maintenance-request-entity-api.md`
  - `docs/project/stories/epic-20/20-4-maintenance-request-photos.md`
  - `docs/project/stories/epic-20/20-7-landlord-maintenance-request-inbox.md`
- PRD: `docs/project/prd-tenant-portal.md` (FR-TP13, FR-TP14, FR-TP16)
- Architecture: `docs/project/architecture.md`
- Project Context: `docs/project/project-context.md`
- Backend reference implementations:
  - Entity (target): `backend/src/PropertyManager.Domain/Entities/WorkOrder.cs`
  - Entity (source): `backend/src/PropertyManager.Domain/Entities/MaintenanceRequest.cs`
  - Photo entities: `WorkOrderPhoto.cs`, `MaintenanceRequestPhoto.cs`
  - Existing create handler (template): `backend/src/PropertyManager.Application/WorkOrders/CreateWorkOrder.cs`
  - Existing create validator (template): `backend/src/PropertyManager.Application/WorkOrders/CreateWorkOrderValidator.cs`
  - Status transition method: `MaintenanceRequest.TransitionTo` (lines 39–56)
  - Transaction pattern: `backend/src/PropertyManager.Application/WorkOrders/SetPrimaryWorkOrderPhoto.cs` (line 58)
  - Existing controller: `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs`
  - Sibling controller (for `CreatedAtAction` target): `backend/src/PropertyManager.Api/Controllers/WorkOrdersController.cs`
  - Authorization policies: `backend/src/PropertyManager.Api/Program.cs` (lines 162–175)
  - Permissions: `backend/src/PropertyManager.Domain/Authorization/Permissions.cs`
  - Role mappings: `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`
  - Exception middleware (BusinessRuleException → 400): `backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` (line 133)
  - WebApplicationFactory + helpers: `backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs`
  - Existing integration tests (extend): `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs`
- Frontend reference implementations:
  - Convert-from-expense dialog (template): `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.ts`
  - Maintenance request service (extend): `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts`
  - Maintenance request store: `frontend/src/app/features/maintenance-requests/stores/maintenance-request.store.ts`
  - Maintenance request detail (extend): `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts`
  - Vendor store: `frontend/src/app/features/vendors/stores/vendor.store.ts`
  - Expense store (for categories): `frontend/src/app/features/expenses/stores/expense.store.ts`
  - Owner guard: `frontend/src/app/core/auth/owner.guard.ts`
  - Routes: `frontend/src/app/app.routes.ts` (no new routes needed)
- E2E reference:
  - Tenant helpers: `frontend/e2e/helpers/tenant.helper.ts` (`loginAsLandlord`, `createLandlordViaInvitation`, `setupTenantContext`)
  - Inbox E2E precedent: `frontend/e2e/tests/maintenance-requests/landlord-inbox.spec.ts`
  - Test fixtures: `frontend/e2e/fixtures/test-fixtures.ts`
  - BasePage: `frontend/e2e/pages/base.page.ts`
- External documentation verified during story authoring:
  - Angular Material `MatDialog` (v21) `open` / `MatDialogRef.afterClosed` / `MAT_DIALOG_DATA` — https://github.com/angular/components/blob/main/src/material/dialog/dialog.md
  - @ngrx/signals `rxMethod` (not used in this story for the convert action — direct service call is simpler) — https://github.com/ngrx/platform/blob/main/projects/ngrx.io/content/guide/signals/rxjs-integration.md

## Dev Agent Record

### Agent Model Used

Opus 4.7 (1M context) via `/dev-story`.

### Debug Log References

- Backend `dotnet test`: 1242 Application + 98 Infrastructure + 823 Api = 2163 tests passing.
- Frontend `npm test`: 128 spec files, 2858 tests passing.
- Frontend `ng build`: clean (initial bundle 579.70 kB vs. 575 kB budget; +4.7 kB consistent with Story 20-7 baseline; no NEW regression > 1 kB).
- Playwright `--workers=1`: 239 specs passing including 4 new convert-request specs.

### Completion Notes List

- Pre-assigned `workOrder.Id = Guid.NewGuid()` in the handler so the photo-mirror INSERTs in the same `SaveChanges` carry the correct `WorkOrderId`. The DB column has `gen_random_uuid()` as a default, but EF only invokes it when `Id == Guid.Empty`, so the in-memory assignment overrides the default and keeps a single round-trip.
- `MatDialogModule` was intentionally NOT added to the detail component imports — the detail component opens a dialog via `MatDialog.open(...)` programmatically and does NOT use `mat-dialog-*` directives in its own template. Removing the module keeps the test MatDialog override working (the module's providers were shadowing the test-bed `useValue` swap).
- TestController.Reset 500s observed during global E2E teardown are pre-existing (TestController never deleted MaintenanceRequests / MaintenanceRequestPhotos). They do not fail individual specs because each spec uses uniquely-named throwaway data. Cleanup is tracked separately — out of scope for 20-8.
- E2E spec 3 clears cookies + storage between landlord and tenant sessions in the same `page` context. Without this, `loginAsTenant` saw the landlord JWT and timed out waiting for the login form.

### File List

**Created:**
- `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrder.cs`
- `backend/src/PropertyManager.Application/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderValidator.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderHandlerTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/ConvertMaintenanceRequestToWorkOrderValidatorTests.cs`
- `frontend/src/app/features/maintenance-requests/components/convert-request-dialog/convert-request-dialog.component.ts`
- `frontend/src/app/features/maintenance-requests/components/convert-request-dialog/convert-request-dialog.component.spec.ts`
- `frontend/e2e/pages/convert-request-dialog.page.ts`
- `frontend/e2e/tests/maintenance-requests/convert-request.spec.ts`

**Modified:**
- `backend/src/PropertyManager.Api/Controllers/MaintenanceRequestsController.cs` — Added `ConvertToWorkOrder` action, validator injection, and `ConvertMaintenanceRequestRequest` record.
- `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` — Added 15 integration tests covering happy path, photo mirroring, business-rule rollback, 401/403/404/400 paths, and rollback verification. Added `ConvertResponseDto` file-record.
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.ts` — Added `convertToWorkOrder` method and request/response interfaces.
- `frontend/src/app/features/maintenance-requests/services/maintenance-request.service.spec.ts` — Added tests for the new method.
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.ts` — Added Convert button + `openConvertDialog` handler + Router/MatDialog/MatSnackBar injections + page-header layout.
- `frontend/src/app/features/maintenance-requests/components/maintenance-request-detail/maintenance-request-detail.component.spec.ts` — Added MatDialog/Router/MatSnackBar mocks, Convert button visibility cases, dialog navigation tests.
- `frontend/e2e/fixtures/test-fixtures.ts` — Registered `convertRequestDialogPage` fixture.
- `docs/project/sprint-status.yaml` — Flipped `20-8-convert-request-to-work-order` to `review`.
- `docs/project/stories/epic-20/20-8-convert-request-to-work-order.md` — Status, task checkmarks, Dev Agent Record.
