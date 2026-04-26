# Story 21.6: VendorsController Integration Tests (GET/PUT)

Status: done

## Story

As a developer,
I want integration coverage for the vendor read and update endpoints (`GET /api/v1/vendors`, `GET /api/v1/vendors/{id}`, `PUT /api/v1/vendors/{id}`),
so that the vendor feature has full CRUD integration coverage at the real HTTP + EF Core + auth + handler stack — closing the gap left by `VendorsControllerCreateTests.cs` and `VendorsControllerDeleteTests.cs` which together only cover POST and DELETE.

## Acceptance Criteria

> **Note (epic vs. controller reconciliation):** Epic 21's text for Story 21.6 references search (`?search=`), trade-tag filter (`?tradeTagId=`), and pagination (`?page=2&pageSize=10`) on `GET /vendors`. The shipped controller and `GetAllVendorsQueryHandler` (`backend/src/PropertyManager.Application/Vendors/GetAllVendors.cs`) implement **none of those query parameters** — `GetAllVendorsQuery` is parameter-less; the handler returns the full account-scoped list ordered by `LastName`, `FirstName` and sets `TotalCount = vendorDtos.Count`. AC-2 below tests the **shipped** behavior. If product wants search/filter/pagination on this endpoint, file a separate story. **Do not change the handler in this story.**
>
> **Authorization:** the controller is decorated `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` + `[Authorize(Policy = "CanAccessVendors")]`. The policy maps to `Permissions.Vendors.View`. Per `RolePermissions.Mappings`:
> - **Owner** has `Vendors.View` (and Create/Edit/Delete) → all endpoints accessible
> - **Contributor** does NOT have `Vendors.View` → all endpoints return **403**
> - **Tenant** does NOT have `Vendors.View` → all endpoints return **403**
>
> **Update vs Validator:** the controller's `UpdateVendor` action runs the FluentValidation validator BEFORE handing off to the handler. Empty/over-length name validation lives in `UpdateVendorValidator`. **Invalid trade-tag IDs** (referencing a tag that doesn't exist or belongs to another account) are NOT caught by the validator — they are caught by the handler, which throws `Domain.Exceptions.ValidationException` → mapped to 400 with `errors.tradeTagIds` populated by `GlobalExceptionHandlerMiddleware`.

### AC-1: All endpoints return 401 without a bearer token

- **Given** no `Authorization` header
- **When** `GET /api/v1/vendors`, `GET /api/v1/vendors/{id}`, or `PUT /api/v1/vendors/{id}` is called
- **Then** each returns `401 Unauthorized`

### AC-2: GET /api/v1/vendors as Owner returns the full account-scoped list

- **Given** an Owner authenticated with 3 vendors in their account
- **When** they `GET /api/v1/vendors`
- **Then** the response is `200 OK` with `items.Count == 3` and `totalCount == 3`
- **And** every `items[i].id` corresponds to a vendor in the caller's account
- **And** the items are ordered by `lastName` ASC, then `firstName` ASC (the handler's stable sort)

### AC-3: GET /api/v1/vendors enforces account isolation

- **Given** Account A with 3 vendors and Account B with 2 vendors
- **When** the Account A Owner calls `GET /api/v1/vendors`
- **Then** the response contains only the 3 Account A vendors; none of Account B's vendor IDs appear in the response
- **And** the same is true when the Account B Owner calls — they see only their 2 vendors

### AC-4: GET /api/v1/vendors omits soft-deleted vendors

- **Given** an Owner with 2 active vendors and 1 vendor whose `DeletedAt` is non-null (seeded directly via `AppDbContext`)
- **When** they `GET /api/v1/vendors`
- **Then** `items.Count == 2` and `totalCount == 2`; the soft-deleted vendor's id is NOT in the response

### AC-5: GET /api/v1/vendors returns an empty list for a fresh account

- **Given** an Owner with zero vendors
- **When** they `GET /api/v1/vendors`
- **Then** the response is `200 OK` with `items` being an empty array (not null) and `totalCount == 0`

### AC-6: GET /api/v1/vendors returns trade tags and presigned thumbnail URL when applicable

- **Given** an Owner with one vendor that has 2 trade tags assigned (e.g., "Plumber", "HVAC") and a primary `VendorPhoto` whose `IsPrimary == true` with a non-empty `ThumbnailStorageKey` (seeded directly via `AppDbContext`)
- **When** they `GET /api/v1/vendors`
- **Then** the matching `VendorDto` has `tradeTags.Count == 2` with the correct `name` values
- **And** `primaryPhotoThumbnailUrl` is non-null and matches the `FakeStorageService` deterministic pattern (`https://test-bucket.s3.amazonaws.com/{key}?presigned=download`)
- **And** for a vendor without a primary photo, `primaryPhotoThumbnailUrl` is `null`

### AC-7: GET /api/v1/vendors as Contributor returns 403

- **Given** an authenticated Contributor user (no `Vendors.View` permission per `RolePermissions.Mappings["Contributor"]`)
- **When** they `GET /api/v1/vendors`
- **Then** the response is `403 Forbidden` (from the `CanAccessVendors` policy)

### AC-8: GET /api/v1/vendors as Tenant returns 403

- **Given** an authenticated Tenant user (no `Vendors.View` permission)
- **When** they `GET /api/v1/vendors`
- **Then** the response is `403 Forbidden`

### AC-9: GET /api/v1/vendors/{id} as Owner returns the full vendor detail

- **Given** an Owner and a vendor in the same account that has `MiddleName`, 1 phone (with label), 1 email, and 1 trade-tag assignment
- **When** they `GET /api/v1/vendors/{id}`
- **Then** the response is `200 OK` with a `VendorDetailDto` whose `id`, `firstName`, `middleName`, `lastName`, `fullName`, `phones`, `emails`, and `tradeTags` match the seeded data
- **And** `phones[0]` carries both `number` and `label`

### AC-10: GET /api/v1/vendors/{id} returns 404 for cross-account access

- **Given** a vendor in Account A
- **When** an Owner in Account B calls `GET /api/v1/vendors/{vendorId}`
- **Then** the response is `404 NotFound` (handler throws `NotFoundException` because the `AccountId == _currentUser.AccountId` filter eliminates the row — no existence disclosure)

### AC-11: GET /api/v1/vendors/{id} returns 404 for a soft-deleted vendor

- **Given** a vendor in the caller's account whose `DeletedAt` is non-null
- **When** the Owner `GET`s its id
- **Then** the response is `404 NotFound` (handler filters `v.DeletedAt == null`)

### AC-12: GET /api/v1/vendors/{id} returns 404 for a non-existent id

- **Given** a fresh `Guid.NewGuid()` that doesn't match any vendor row
- **When** the Owner `GET`s it
- **Then** the response is `404 NotFound`

### AC-13: GET /api/v1/vendors/{id} as Contributor / Tenant returns 403

- **Given** an authenticated Contributor (or Tenant) and a vendor in their own account
- **When** they `GET /api/v1/vendors/{id}`
- **Then** the response is `403 Forbidden` (the `CanAccessVendors` policy fails before the handler runs — they wouldn't even see their own account's vendors via this controller)

### AC-14: PUT /api/v1/vendors/{id} updates Person fields and returns 204

- **Given** a vendor in the Owner's account with `firstName="Old"`, `middleName=null`, `lastName="Name"`, no phones, no emails, no trade tags
- **When** the Owner `PUT`s `{ firstName: "New", middleName: "M", lastName: "Surname", phones: [], emails: [], tradeTagIds: [] }` to `/api/v1/vendors/{id}`
- **Then** the response is `204 NoContent`
- **And** in the database the vendor row has `FirstName = "New"`, `MiddleName = "M"`, `LastName = "Surname"`
- **And** `UpdatedAt` is greater than the seeded `UpdatedAt` (audit interceptor runs on Modified)

### AC-15: PUT /api/v1/vendors/{id} replaces phones and emails

- **Given** a vendor with two phones and one email
- **When** the Owner `PUT`s a payload with one new phone (different number+label) and two new emails
- **Then** the database row reflects the new collections — the previous phones/emails are replaced wholesale (`vendor.Phones = ...; vendor.Emails = ...` in the handler)
- **And** the new phone has the correct `number` and `label` value-object fields

### AC-16: PUT /api/v1/vendors/{id} adds new trade-tag assignments

- **Given** a vendor with zero trade-tag assignments and 2 valid `VendorTradeTag` rows in the same account (seeded directly)
- **When** the Owner `PUT`s a payload with `tradeTagIds: [tagA, tagB]`
- **Then** the response is `204 NoContent`
- **And** the database has 2 rows in `VendorTradeTagAssignments` for this vendor with `TradeTagId` ∈ `{tagA, tagB}`

### AC-17: PUT /api/v1/vendors/{id} removes trade-tag assignments not in the payload

- **Given** a vendor with `tradeTagIds: [tagA, tagB]` already assigned
- **When** the Owner `PUT`s a payload with `tradeTagIds: [tagA]`
- **Then** the database has exactly 1 assignment row for this vendor with `TradeTagId == tagA`; the row for `tagB` is gone

### AC-18: PUT /api/v1/vendors/{id} can clear all trade-tag assignments

- **Given** a vendor with two trade-tag assignments
- **When** the Owner `PUT`s a payload with `tradeTagIds: []`
- **Then** the database has zero assignment rows for this vendor

### AC-19: PUT /api/v1/vendors/{id} returns 400 for missing first name

- **Given** an existing vendor in the caller's account
- **When** the Owner `PUT`s a payload with `firstName: ""` (or omitted)
- **Then** the response is `400 BadRequest` with a `ValidationProblemDetails` whose `errors` key contains `FirstName` and message `"First name is required"` (per `UpdateVendorValidator`)

### AC-20: PUT /api/v1/vendors/{id} returns 400 for missing last name

- **Given** an existing vendor
- **When** the Owner `PUT`s a payload with `lastName: ""`
- **Then** the response is `400 BadRequest` with `errors.LastName` containing `"Last name is required"`

### AC-21: PUT /api/v1/vendors/{id} returns 400 for over-length name fields

- **Given** an existing vendor
- **When** the Owner `PUT`s a payload with `firstName` or `lastName` over 100 characters, or `middleName` over 100 characters
- **Then** the response is `400 BadRequest` with the appropriate `errors.{Field}` message (`"... must be 100 characters or less"`)

### AC-22: PUT /api/v1/vendors/{id} returns 400 for invalid email format

- **Given** an existing vendor
- **When** the Owner `PUT`s a payload with `emails: ["not-an-email"]`
- **Then** the response is `400 BadRequest` with an `errors` key referencing the email element and the message `"Invalid email address format"`

### AC-23: PUT /api/v1/vendors/{id} returns 400 for empty phone number

- **Given** an existing vendor
- **When** the Owner `PUT`s a payload with `phones: [{ number: "", label: "Cell" }]`
- **Then** the response is `400 BadRequest` with `errors` referencing the phone-number element and `"Phone number is required"`

### AC-24: PUT /api/v1/vendors/{id} returns 400 for invalid trade-tag IDs

- **Given** an existing vendor in Account A and a `VendorTradeTag` in Account B
- **When** the Owner of Account A `PUT`s a payload with `tradeTagIds: [accountBTagId]`
- **Then** the response is `400 BadRequest` with `errors.tradeTagIds` containing `"Invalid trade tag IDs: {accountBTagId}"` (handler-level `Domain.Exceptions.ValidationException` mapped by middleware)
- **And** the same is true when `tradeTagIds` references a `Guid.NewGuid()` that doesn't exist anywhere

### AC-25: PUT /api/v1/vendors/{id} returns 400 for null body

- **Given** an authenticated Owner
- **When** they `PUT` to `/api/v1/vendors/{id}` with body `null` (literal JSON `null`)
- **Then** the response is `400 BadRequest` with `ProblemDetails.Detail == "Request body is required"` (controller's null guard before validation)

### AC-26: PUT /api/v1/vendors/{id} returns 404 for non-existent vendor

- **Given** an Owner and a fresh `Guid.NewGuid()`
- **When** they `PUT` a valid payload to `/api/v1/vendors/{nonExistentId}`
- **Then** the response is `404 NotFound` (handler's `NotFoundException` after the validator passes)

### AC-27: PUT /api/v1/vendors/{id} returns 404 for cross-account access

- **Given** a vendor in Account A
- **When** an Owner in Account B `PUT`s a valid payload to `/api/v1/vendors/{vendorId}`
- **Then** the response is `404 NotFound` (handler filters by `AccountId == _currentUser.AccountId`)

### AC-28: PUT /api/v1/vendors/{id} returns 404 for a soft-deleted vendor

- **Given** a vendor in the Owner's account whose `DeletedAt` is non-null
- **When** the Owner `PUT`s a valid payload
- **Then** the response is `404 NotFound` (handler also filters `DeletedAt == null`)

### AC-29: PUT /api/v1/vendors/{id} as Contributor / Tenant returns 403

- **Given** a Contributor or Tenant in the same account as the vendor
- **When** they `PUT` a valid payload to `/api/v1/vendors/{id}`
- **Then** the response is `403 Forbidden` (the `CanAccessVendors` policy fails before validator/handler run)

## Tasks / Subtasks

- [x] **Task 1: Create `VendorsControllerGetTests.cs` skeleton (AC: #1, #2-#8, #9-#13)**
  - [x] 1.1 Create `backend/tests/PropertyManager.Api.Tests/VendorsControllerGetTests.cs` mirroring the structure of `VendorsControllerCreateTests.cs` and `VendorsControllerDeleteTests.cs` (same assembly so DTO records like `CreateVendorResponse`, `GetAllVendorsResponse`, `VendorDto`, `PhoneNumberDto`, `VendorTradeTagDto` are reusable directly — do NOT redeclare them in this file)
  - [x] 1.2 Use `IClassFixture<PropertyManagerWebApplicationFactory>` — single shared Testcontainers Postgres for the class. Do NOT add new factory helpers; the existing `CreateTestUserAsync`, `CreateTestUserInAccountAsync`, and `CreateTenantUserInAccountAsync` cover every role we need. `CreatePropertyInAccountAsync` is not required (vendors don't depend on properties).
  - [x] 1.3 Copy the helper methods from `VendorsControllerCreateTests.cs` into the new file (do NOT extract a base class — Stories 21.1/21.2/21.5 all kept helpers colocated): `GetAccessTokenAsync`, `RegisterAndLoginAsync`, `PostAsJsonWithAuthAsync`, `GetWithAuthAsync`. Add `PutAsJsonWithAuthAsync`, `CreateVendorAsync(accessToken, firstName, middleName?, lastName)`, and `SeedVendorDirectAsync(accountId, firstName, lastName, ...)` for direct-DB seeding (needed for soft-delete and primary-photo cases that the API can't produce).
  - [x] 1.4 Add a private record `OwnerContext(string AccessToken, Guid UserId, Guid AccountId)` and a `CreateOwnerContextAsync()` factory used across all `_AsOwner_*` tests (mirrors 21.5's `OwnerContext` pattern but without `WorkOrderId` / `PropertyId`). Declare it as `private sealed record` nested inside the test class to avoid the CS9051 trap from 21.1 (do not use `file record` for types used as method return values).
  - [x] 1.5 Define a `VendorDetailDto` record at the bottom of the file (file scope) for `GET /{id}` deserialization — fields: `Guid Id, string FirstName, string? MiddleName, string LastName, string FullName, IReadOnlyList<PhoneNumberDto> Phones, IReadOnlyList<string> Emails, IReadOnlyList<VendorTradeTagDto> TradeTags`. The Application's `VendorDetailDto` is the wire shape — re-declaring it in the test file is intentional (HTTP-contract changes must surface as test failures). Reuse the existing `PhoneNumberDto` and `VendorTradeTagDto` records already declared in `VendorsControllerCreateTests.cs` — they live in the same assembly so do NOT redeclare. Also extend `VendorDto` if the existing declaration is missing the `PrimaryPhotoThumbnailUrl` field — quick check of `VendorsControllerCreateTests.cs` shows it's missing; add a separate file-scoped record `VendorDtoWithThumbnail` ONLY if the JSON deserializer can't tolerate the extra property (System.Text.Json by default ignores unknown properties so the existing record likely deserializes fine — verify on first test run).

- [x] **Task 2: Auth coverage — AC-1 (3 tests)**
  - [x] 2.1 `GetAllVendors_WithoutAuth_Returns401`
  - [x] 2.2 `GetVendor_WithoutAuth_Returns401`
  - [x] 2.3 `UpdateVendor_WithoutAuth_Returns401`

- [x] **Task 3: GET /api/v1/vendors tests — AC-2 to AC-8 (Owner success + isolation + role policy)**
  - [x] 3.1 `GetAllVendors_AsOwner_ReturnsAccountScopedList_OrderedByLastNameThenFirstName` (AC-2) — create vendors named "Smith, Joe" / "Adams, Mary" / "Adams, Bob" via `CreateVendorAsync`, GET, assert order is Adams Bob → Adams Mary → Smith Joe and `totalCount == 3`
  - [x] 3.2 `GetAllVendors_DoesNotLeakOtherAccountVendors` (AC-3) — register two Owners (Account A, Account B), seed 3 in A and 2 in B, both call GET, assert disjoint id sets
  - [x] 3.3 `GetAllVendors_OmitsSoftDeletedVendors` (AC-4) — seed via API, then directly set one vendor's `DeletedAt = DateTime.UtcNow` via `AppDbContext` (the API's DELETE also works), GET, assert it's excluded
  - [x] 3.4 `GetAllVendors_EmptyAccount_ReturnsEmptyList` (AC-5)
  - [x] 3.5 `GetAllVendors_IncludesTradeTagsAndThumbnailUrl` (AC-6) — create a vendor via API, then directly seed two `VendorTradeTag` rows + two `VendorTradeTagAssignment` rows + a `VendorPhoto` row with `IsPrimary = true` and a non-empty `ThumbnailStorageKey` (e.g., `$"{accountId}/vendors/2026/{Guid.NewGuid()}.jpg"`). GET, assert `tradeTags.Count == 2` and `primaryPhotoThumbnailUrl` matches the `FakeStorageService` deterministic download pattern. Reset of vendor without primary photo should have `primaryPhotoThumbnailUrl == null`.
  - [x] 3.6 `GetAllVendors_AsContributor_Returns403` (AC-7) — use `_factory.CreateTestUserInAccountAsync(accountId, email, role: "Contributor")`; login; assert 403
  - [x] 3.7 `GetAllVendors_AsTenant_Returns403` (AC-8) — use `_factory.CreateTenantUserInAccountAsync(accountId, propertyId, email)`; login; assert 403. Tenants need a property to receive the JWT property claim, so seed a property too via `_factory.CreatePropertyInAccountAsync(accountId)`.

- [x] **Task 4: GET /api/v1/vendors/{id} tests — AC-9 to AC-13**
  - [x] 4.1 `GetVendor_AsOwner_Returns200WithFullDetail` (AC-9) — POST a vendor with `MiddleName`, 1 phone (`{ number: "555-1234", label: "Cell" }`), 1 email, then directly seed 1 `VendorTradeTagAssignment` to a seeded `VendorTradeTag`. GET, assert all fields
  - [x] 4.2 `GetVendor_CrossAccount_Returns404` (AC-10) — Owner A creates a vendor; Owner B GETs it; assert 404
  - [x] 4.3 `GetVendor_SoftDeleted_Returns404` (AC-11) — POST then DELETE via API (sets `DeletedAt`); GET; assert 404
  - [x] 4.4 `GetVendor_NonExistent_Returns404` (AC-12)
  - [x] 4.5 `GetVendor_AsContributor_Returns403` (AC-13)
  - [x] 4.6 `GetVendor_AsTenant_Returns403` (AC-13)

- [x] **Task 5: Create `VendorsControllerUpdateTests.cs` skeleton (AC: #1 PUT, #14-#29)**
  - [x] 5.1 Create `backend/tests/PropertyManager.Api.Tests/VendorsControllerUpdateTests.cs` (split into a separate file from GET tests because UPDATE has 16 ACs / ~25 expected `[Fact]` methods — keeping each file under ~600 lines mirrors the existing Vendors split pattern)
  - [x] 5.2 Reuse the helpers from Task 1.3 — copy them into this file, OR (preferred since the Vendors test files already each have their own copy of the helpers) keep them colocated per the project convention. **Do NOT extract a base class** — Stories 21.1/21.2/21.5 all rejected base classes for these test files.
  - [x] 5.3 Define an `UpdateVendorRequest` payload-builder helper (or just inline anonymous types) — since the controller accepts `UpdateVendorRequest` with `FirstName`, `MiddleName`, `LastName`, `Phones`, `Emails`, `TradeTagIds`, build payloads via `new { firstName = ..., lastName = ..., phones = new[] { new { number = "555-1234", label = "Cell" } }, emails = new[] { "x@y.com" }, tradeTagIds = new Guid[] { } }`. Match the JSON casing the API expects (System.Text.Json defaults to camelCase per `Program.cs` configuration — verify by re-reading the existing Create tests, which use PascalCase anonymous object property names that JsonContent.Create converts to camelCase). Both casings work in the existing tests.

- [x] **Task 6: PUT happy paths — AC-14 to AC-18 (5 tests)**
  - [x] 6.1 `UpdateVendor_ValidRequest_Returns204_AndPersistsFields` (AC-14)
  - [x] 6.2 `UpdateVendor_ReplacesPhonesAndEmails` (AC-15) — verify `dbContext.Vendors.IgnoreQueryFilters().Include(...).First(...)` returns the new collections (note: `Phones` and `Emails` are owned/value collections; verify the EF mapping persists the raw JSON or columns appropriately by checking the entity configuration if needed). Verify `phones[0].Number` and `phones[0].Label` reflect the PUT payload.
  - [x] 6.3 `UpdateVendor_AddsTradeTagAssignments` (AC-16) — seed 2 `VendorTradeTag` rows for the account, PUT with `tradeTagIds: [tagA, tagB]`, assert `dbContext.VendorTradeTagAssignments.CountAsync(a => a.VendorId == vendorId) == 2` and the tag IDs match
  - [x] 6.4 `UpdateVendor_RemovesTradeTagAssignmentsNotInPayload` (AC-17) — same setup but PUT with `[tagA]`; assert assignment count is 1, only `tagA` remains
  - [x] 6.5 `UpdateVendor_ClearsAllTradeTagAssignments` (AC-18) — PUT with empty `tradeTagIds`; assert count is 0

- [x] **Task 7: PUT validation tests — AC-19 to AC-25 (8 tests)**
  - [x] 7.1 `UpdateVendor_EmptyFirstName_Returns400` (AC-19) — assert response body has `errors.FirstName` containing `"First name is required"`. Read the JSON via `await response.Content.ReadAsStringAsync()` and parse with `JsonSerializer.Deserialize<JsonElement>(...)` to inspect `errors.FirstName[0]` — this matches `ValidationProblemDetails` shape from `CreateValidationProblemDetails` in the controller
  - [x] 7.2 `UpdateVendor_EmptyLastName_Returns400` (AC-20) — same shape, `errors.LastName`
  - [x] 7.3 `UpdateVendor_FirstNameOver100Chars_Returns400` (AC-21)
  - [x] 7.4 `UpdateVendor_LastNameOver100Chars_Returns400` (AC-21)
  - [x] 7.5 `UpdateVendor_MiddleNameOver100Chars_Returns400` (AC-21)
  - [x] 7.6 `UpdateVendor_InvalidEmailFormat_Returns400` (AC-22) — validator's `RuleForEach(x => x.Emails).ChildRules(...)` produces error key `Emails[0]` per FluentValidation's collection-rule property naming; verify the actual key on first run and assert against it
  - [x] 7.7 `UpdateVendor_EmptyPhoneNumber_Returns400` (AC-23) — error key likely `Phones[0].Number`
  - [x] 7.8 `UpdateVendor_NullBody_Returns400_WithBodyRequiredMessage` (AC-25) — send literal JSON `null`, assert 400 and `Detail == "Request body is required"`. Mirror `CreateVendor_NullBody_Returns400` shape from `VendorsControllerCreateTests.cs`.

- [x] **Task 8: PUT trade-tag handler-level validation — AC-24 (3 tests)**
  - [x] 8.1 `UpdateVendor_TradeTagBelongsToOtherAccount_Returns400_WithErrorsTradeTagIds` (AC-24) — register Owner A and Owner B, seed a `VendorTradeTag` in B, PUT from A with that tag id, assert 400 and `errors.tradeTagIds[0]` matches `"Invalid trade tag IDs: {tagId}"`
  - [x] 8.2 `UpdateVendor_NonExistentTradeTagId_Returns400` (AC-24) — same shape with a `Guid.NewGuid()`
  - [x] 8.3 `UpdateVendor_PartiallyValidTradeTagIds_Returns400_WithOnlyInvalidIdsListed` (AC-24, optional but valuable) — pass `[validTagId, invalidTagId]`, assert message contains only the invalid id

- [x] **Task 9: PUT not-found and access-control tests — AC-26 to AC-29 (5 tests)**
  - [x] 9.1 `UpdateVendor_NonExistentVendor_Returns404` (AC-26) — valid payload, `Guid.NewGuid()` for the id
  - [x] 9.2 `UpdateVendor_CrossAccount_Returns404` (AC-27) — Owner A creates vendor; Owner B PUTs; assert 404
  - [x] 9.3 `UpdateVendor_SoftDeleted_Returns404` (AC-28) — seed via API, DELETE via API, then PUT; assert 404
  - [x] 9.4 `UpdateVendor_AsContributor_Returns403` (AC-29) — Contributor in same account
  - [x] 9.5 `UpdateVendor_AsTenant_Returns403` (AC-29) — Tenant in same account (with property assignment)

- [x] **Task 10: Verify and ship (AC: all)**
  - [x] 10.1 Run `dotnet test --filter "FullyQualifiedName~VendorsControllerGetTests|FullyQualifiedName~VendorsControllerUpdateTests"` — all new tests pass on first run
  - [x] 10.2 Run `dotnet test` (full backend suite) — no regressions; expect ~2070+ tests still passing (2041 today + ~30-35 new)
  - [x] 10.3 `dotnet build` clean — 0 errors. The 3 pre-existing warnings should remain (Receipts nullability, PdfRendererService CA1416, testcontainers obsolescence)
  - [x] 10.4 No production code modified — controller, handlers, validators, entity, EF config, factory all untouched. Test-only story.

- [x] **Task 11: Sprint status + story status update (process)**
  - [x] 11.1 Update `docs/project/sprint-status.yaml`: `21-6-vendors-controller-integration-tests: review`
  - [x] 11.2 Update story status (this file) to `review`; fill out Dev Agent Record
  - [x] 11.3 Note any deviations between this AC list and the actual handler/validator behavior in the Completion Notes section (especially if the FluentValidation collection-error-key shape for AC-22 / AC-23 differs from this story's guess)

## Dev Notes

### Test Scope

This is a pure backend test-writing story. The deliverable IS integration tests.

| Layer | Required? | Justification |
|---|---|---|
| **Unit** | Not required — no new handlers/validators introduced | Unit tests for `GetAllVendorsQueryHandler`, `GetVendorQueryHandler`, `UpdateVendorCommandHandler`, and `UpdateVendorValidator` already exist (or are out of scope for this audit story). Adding more is not the deliverable. |
| **Integration** | **Required — this IS the story** | Three controller endpoints (GET list, GET by id, PUT) currently have zero coverage of the real HTTP + DI + EF Core + auth + permission policy stack. |
| **E2E (Playwright)** | Not required | Backend-only test story. No UI changes. Vendor E2E coverage is out-of-scope; tracked separately if/when needed. |

### Pattern Reference — mirror `VendorsControllerCreateTests.cs` and `VendorsControllerDeleteTests.cs`

**PRIMARY pattern reference:** `backend/tests/PropertyManager.Api.Tests/VendorsControllerCreateTests.cs` and `VendorsControllerDeleteTests.cs`. These files define every convention used here:

- `IClassFixture<PropertyManagerWebApplicationFactory>` — shared Testcontainers Postgres within the class
- Constructor captures `_factory` and `_client`
- `[Fact]` naming `Method_Scenario_ExpectedResult`
- FluentAssertions (`response.StatusCode.Should().Be(...)`, etc.)
- Unique per-test emails: `$"...-{Guid.NewGuid():N}@example.com"`
- Per-test data seeded via API (`POST /api/v1/vendors`) where possible; direct `AppDbContext` seeding only for things the API can't produce (soft-deleted vendors, primary photos, trade tag assignments before update tests)
- DB verification via `using var scope = _factory.Services.CreateScope();` + `scope.ServiceProvider.GetRequiredService<AppDbContext>()`
- For soft-delete: `dbContext.Vendors.IgnoreQueryFilters().FirstOrDefaultAsync(...)`
- Response records redeclared in test files (intentional — HTTP-contract changes must surface here, not in Application code)

**Secondary references:**
- `MaintenanceRequestsControllerTests.cs` (Story 21.1) — for the role-based permission test pattern (Owner/Contributor/Tenant), `LoginAsync` flow, `private sealed record` context (avoids CS9051)
- `WorkOrderPhotosControllerTests.cs` (Story 21.5) — for direct-DB seeding patterns and the `OwnerContext` shape; also for verifying that the existing factory helpers cover the role matrix
- `VendorTradeTagsControllerTests.cs` — for the trade-tag creation pattern (`CreateTradeTagAsync`); but note that this story will mostly seed trade tags directly via `AppDbContext` rather than via the API to avoid coupling to a separate controller's contract

### Existing Vendor test files — do NOT consolidate

The epic's "Existing file: `VendorsControllerTests.cs` (extend — do not create separate file)" is **inaccurate**. The shipped tests are split across two files (`VendorsControllerCreateTests.cs`, `VendorsControllerDeleteTests.cs`). Story 21.6 follows the same pattern: add **two new files** (`VendorsControllerGetTests.cs` and `VendorsControllerUpdateTests.cs`) instead of consolidating. Rationale:

1. The existing split pattern is established and the team has not signaled a desire to consolidate (unlike Story 21.3's explicit consolidation goal for Expenses)
2. Consolidating now would re-do work later if the team eventually decides Vendors should also be in one file — at that point a dedicated consolidation story (mirror 21.3) is cheaper than retrofitting
3. Each file stays under ~600 lines, well within readable limits

If during dev a strong reason to consolidate emerges, raise it in PR review — do not do it silently in this story.

### Factory — what you DON'T need to change

`PropertyManagerWebApplicationFactory` already exposes everything needed:

- `CreateTestUserAsync(email, password? = "Test@123456")` — creates a new Owner in a brand-new account; returns `(Guid UserId, Guid AccountId)`
- `CreateTestUserInAccountAsync(accountId, email, password? = "Test@123456", role = "Member")` — creates a non-Owner in an existing account; **override role to `"Contributor"`** for AC-7/AC-13/AC-29 Contributor cases
- `CreateTenantUserInAccountAsync(accountId, propertyId, email, password? = "Test@123456")` — creates a Tenant in an existing account with `PropertyId` set; needed for AC-8/AC-13/AC-29 Tenant cases
- `CreatePropertyInAccountAsync(accountId, name?, street?, city?, state?, zipCode?)` — needed only because `CreateTenantUserInAccountAsync` requires a `propertyId`. Vendors don't depend on properties.

**Do NOT change `PropertyManagerWebApplicationFactory.cs`.** Stories 21.1, 21.2, 21.4, 21.5 explicitly relied on the factory as-is and so does this story.

### Handler access-control contract (the behavior being tested)

All three handlers (`GetAllVendorsQueryHandler`, `GetVendorQueryHandler`, `UpdateVendorCommandHandler`) share these access-control patterns:

1. **Controller-level** `[Authorize(Policy = "CanAccessVendors")]` → `Permissions.Vendors.View`. Failure → **403** before reaching the handler. Owner ✅, Contributor ❌, Tenant ❌.
2. **Handler-level account scoping**: `_dbContext.Vendors.Where(v => v.AccountId == _currentUser.AccountId && v.DeletedAt == null)`. Cross-account or soft-deleted → `NotFoundException` (or empty list for GetAll) → **404** for single-vendor lookups.
3. **For `UpdateVendor`**: validator runs in the controller before `_mediator.Send`. Validation failure → controller calls `CreateValidationProblemDetails(validationResult)` → **400** with `errors.{Field}` populated.
4. **For `UpdateVendor` trade-tag check**: handler validates that all `TradeTagIds` reference rows where `AccountId == _currentUser.AccountId`. Mismatched/non-existent → `Domain.Exceptions.ValidationException` with `errors.tradeTagIds` → **400** via middleware.

**Exception → HTTP mapping** (from `GlobalExceptionHandlerMiddleware.GetErrorDetails`, verified):
- `NotFoundException` → 404
- `ConflictException` → 409
- `ForbiddenAccessException` / `UnauthorizedAccessException` → 403
- `BusinessRuleException` → 400 (Title: "Business rule violation")
- `ArgumentException` → 400 (Title: "Bad request")
- `Domain.Exceptions.ValidationException` → 400 with `errors` populated (Title: "Validation failed")
- `FluentValidation.ValidationException` → 400 with `errors` populated

### Route structure

```
GET    /api/v1/vendors
GET    /api/v1/vendors/{id:guid}
PUT    /api/v1/vendors/{id:guid}
```

**Per Story 21.5 finding:** the `:guid` route constraint produces **404 NotFound** (no endpoint matches) for non-GUID values, NOT 400. Don't write a malformed-GUID 400 test.

### Update payload shape — `UpdateVendorRequest`

From `VendorsController.cs`:

```csharp
public record UpdateVendorRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string? MiddleName { get; init; }
    public string LastName { get; init; } = string.Empty;
    public List<PhoneNumberRequest> Phones { get; init; } = new();
    public List<string> Emails { get; init; } = new();
    public List<Guid> TradeTagIds { get; init; } = new();
}

public record PhoneNumberRequest
{
    public string Number { get; init; } = string.Empty;
    public string? Label { get; init; }
}
```

The controller maps `Phones` to `PhoneNumberDto(Number, Label)` (the Application DTO) and the handler converts those to `PhoneNumber` value objects on the entity.

### Validator — `UpdateVendorValidator` rules (verbatim)

(verified at `backend/src/PropertyManager.Application/Vendors/UpdateVendorValidator.cs`):

- `Id`: `NotEmpty` ("Vendor ID is required")
- `FirstName`: `NotEmpty` ("First name is required") + `MaximumLength(100)` ("First name must be 100 characters or less")
- `LastName`: `NotEmpty` ("Last name is required") + `MaximumLength(100)` ("Last name must be 100 characters or less")
- `MiddleName`: `MaximumLength(100)` ("Middle name must be 100 characters or less") `When MiddleName != null`
- `Phones[*].Number`: `NotEmpty` ("Phone number is required") + `MaximumLength(50)` ("Phone number must be 50 characters or less")
- `Phones[*].Label`: `MaximumLength(50)` ("Phone label must be 50 characters or less") when not null
- `Emails[*]`: `NotEmpty` ("Email address is required") + `MaximumLength(255)` + `EmailAddress` ("Invalid email address format")

**Note** the validator does NOT validate `TradeTagIds` — invalid tag IDs are caught by the handler.

### Trade-tag seeding

Two paths to seed trade tags:

```csharp
// Direct DB seeding (preferred for tests where the trade tag is just a fixture)
using var scope = _factory.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
var tagId = Guid.NewGuid();
dbContext.VendorTradeTags.Add(new VendorTradeTag
{
    Id = tagId,
    AccountId = accountId,
    Name = "Plumber",
    CreatedAt = DateTime.UtcNow
});
await dbContext.SaveChangesAsync();
```

```csharp
// To seed a VendorTradeTagAssignment manually (e.g., when setting up AC-17/18):
dbContext.VendorTradeTagAssignments.Add(new VendorTradeTagAssignment
{
    VendorId = vendorId,
    TradeTagId = tagId
});
await dbContext.SaveChangesAsync();
```

`VendorTradeTag` has `ITenantEntity` and a global query filter on `AccountId`, so seeding directly is fine — the filter doesn't block writes.

### Soft-delete seeding

Two approaches; pick whichever is simplest per test:

1. **Via the API**: `await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken)` — simplest, gives a real-world soft-delete shape
2. **Direct DB**: `vendor.DeletedAt = DateTime.UtcNow; await dbContext.SaveChangesAsync();` — useful when you want to assert the response shape doesn't include the deleted vendor without going through DELETE first

Both work. The Update tests (AC-28) should use the API DELETE to mirror real flow.

### Primary photo seeding (AC-6)

Direct DB seed of a `VendorPhoto` row with `IsPrimary = true`:

```csharp
var photoId = Guid.NewGuid();
var thumbnailKey = $"{accountId}/vendors/2026/{Guid.NewGuid()}.jpg";
dbContext.VendorPhotos.Add(new VendorPhoto
{
    Id = photoId,
    VendorId = vendorId,
    AccountId = accountId,
    StorageKey = $"{accountId}/vendors/2026/{Guid.NewGuid()}.jpg",
    ThumbnailStorageKey = thumbnailKey,
    OriginalFileName = "primary.jpg",
    ContentType = "image/jpeg",
    FileSizeBytes = 1024,
    IsPrimary = true,
    DisplayOrder = 0,
    CreatedByUserId = userId
});
await dbContext.SaveChangesAsync();
```

The `GetAllVendorsQueryHandler` calls `_photoService.GetThumbnailUrlAsync(thumbnailStorageKey, ...)`. The factory uses the **real** `PhotoService` backed by `FakeStorageService`, which returns deterministic URLs of the form `https://test-bucket.s3.amazonaws.com/{key}?presigned=download`. Assert `primaryPhotoThumbnailUrl` contains `?presigned=download` rather than asserting the exact full URL — the storage key includes a fresh `Guid.NewGuid()` so an exact-match assertion is fragile. Verify the exact format from `FakeStorageService` (`backend/tests/PropertyManager.Api.Tests/FakeStorageService.cs` or similar) on first test run if uncertain.

Quickly verify the `VendorPhoto` entity field set by reading `backend/src/PropertyManager.Domain/Entities/VendorPhoto.cs` — Story 17.13 added vendor photo support. If the field set differs from this guess, adjust the seed accordingly.

### Permissions — verified mappings

From `backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs`:

| Role | `Vendors.View` | Effect on this controller |
|---|---|---|
| Owner | yes | All endpoints accessible (subject to handler-level checks) |
| Contributor | no | All 3 endpoints → **403** (policy fails) |
| Tenant | no | All 3 endpoints → **403** (policy fails) |

There is no per-endpoint-only Vendor-View vs Vendor-Edit policy split on the controller — all three endpoints share `CanAccessVendors`. Owner is the only role we'll exercise for happy paths.

### Test data naming convention

Unique per-test emails to avoid collisions in the shared Testcontainers Postgres:
- Owners: `$"owner-vendors-get-{Guid.NewGuid():N}@example.com"` / `$"owner-vendors-update-{Guid.NewGuid():N}@example.com"`
- Contributors: `$"contrib-vendors-{Guid.NewGuid():N}@example.com"`
- Tenants: `$"tenant-vendors-{Guid.NewGuid():N}@example.com"`

### Previous Story Intelligence

**Story 21.1 (done, PR #372)** — Established `private sealed record` context pattern (avoids CS9051 when `file record` is used as a return type), added `CreateTenantUserInAccountAsync` and `CreatePropertyInAccountAsync` factory helpers. This story uses both helpers. Also established the `LoginAsync` / `RegisterAndLoginAsync` shape that the existing Vendors test files already use.

**Story 21.2 (done, PR #373)** — `MaintenanceRequestPhotosController` integration tests. Same testing pattern + `FakeStorageService` snapshot approach. Not directly applicable (this story doesn't touch S3-backed flows), but the role-policy multiplication pattern (3 roles × N endpoints) is reused here.

**Story 21.3 (done, PR #381)** — Expense controller test consolidation. **NOT applicable here.** This story does NOT consolidate — it adds two new files to extend the existing 2-file split (Create + Delete → Create + Delete + Get + Update). The epic's "extend — do not create separate file" guidance was based on an inaccurate assumption that there's a single `VendorsControllerTests.cs`. Reality: there are two files, and following that pattern means adding two more.

**Story 21.4 (done, PR #382)** — Tenant dashboard E2E. Frontend-only, no overlap.

**Story 21.5 (done, PR #383)** — `WorkOrderPhotosController` integration tests. Most-recent reference for the role-policy matrix (AC-25 in 21.5). The same shape of "3 roles × all endpoints → 403 for non-permitted roles" is reused here. Also the file-records-at-bottom convention applies here, except this story can largely **reuse** the records already declared in `VendorsControllerCreateTests.cs` (same assembly).

### Files to create

- `backend/tests/PropertyManager.Api.Tests/VendorsControllerGetTests.cs` — ~12-14 `[Fact]` tests, ~400-500 lines
- `backend/tests/PropertyManager.Api.Tests/VendorsControllerUpdateTests.cs` — ~22-25 `[Fact]` tests, ~500-650 lines

### Files NOT to modify

- `PropertyManagerWebApplicationFactory.cs` — already provides every helper
- Any production code in `backend/src/` — controller, handlers, validators, EF config, entity. Test-only story.
- `VendorsControllerCreateTests.cs` / `VendorsControllerDeleteTests.cs` — leave alone; they're working
- `VendorTradeTagsControllerTests.cs` / `VendorPhotosControllerTests.cs` — out of scope

### Anti-pitfalls

1. **Don't redeclare DTOs that exist in the same assembly** — `CreateVendorResponse`, `GetAllVendorsResponse`, `VendorDto`, `PhoneNumberDto`, `VendorTradeTagDto` are already declared in `VendorsControllerCreateTests.cs`. Re-declaring causes a duplicate-type compile error. The `VendorDetailDto` is NOT declared yet (the GET-by-id endpoint isn't tested today) — declare it once in `VendorsControllerGetTests.cs` and reference it from both new files (it's a public type once declared at file scope; or use `internal` / file-scoped if you want it isolated).
2. **Don't add search/filter/pagination tests to GET /vendors** — those query params are NOT implemented by the controller. AC-2 reflects the shipped contract.
3. **Don't consolidate the Vendors test files in this story** — that's a separate (and currently un-prioritized) consolidation effort. Add two new files alongside the existing two.
4. **Don't change the `UpdateVendorValidator` or `UpdateVendorCommandHandler`** — this is a test-only story. If the validator's collection-error-key shape (e.g., `Emails[0]` vs `Emails`) doesn't match this story's guess, update the test assertion to match reality, NOT the validator.
5. **Don't write a malformed-GUID 400 test** — the `:guid` route constraint produces 404, not 400 (per Story 21.5 / 21.2 measurement).
6. **Don't forget the `null` body case for PUT (AC-25)** — the controller has a hand-rolled null guard before calling the validator. The shape mirrors Create's null-body test.
7. **Don't assume the `UpdateVendorRequest` JSON casing** — System.Text.Json defaults are camelCase but `JsonContent.Create(new { FirstName = ... })` with PascalCase property names gets serialized as PascalCase by default. The existing Create tests use anonymous types with PascalCase names and they work, so the API accepts both casings (or System.Text.Json on the deserialization side is case-insensitive). Verify on first run; if a test fails on payload binding, switch to camelCase.
8. **Don't assert the exact thumbnail URL string** for AC-6 — the storage key contains a fresh GUID. Assert it contains `?presigned=download` and is non-null.

### References

- [VendorsController source](../../../backend/src/PropertyManager.Api/Controllers/VendorsController.cs) — all 5 endpoints, route templates, policy attributes, `UpdateVendorRequest` / `PhoneNumberRequest` shapes
- [GetAllVendors.cs](../../../backend/src/PropertyManager.Application/Vendors/GetAllVendors.cs) — handler logic for AC-2/AC-3/AC-4/AC-5/AC-6 (no search/filter/pagination)
- [GetVendor.cs](../../../backend/src/PropertyManager.Application/Vendors/GetVendor.cs) — handler logic for AC-9/AC-10/AC-11/AC-12, returns `VendorDetailDto`
- [UpdateVendor.cs](../../../backend/src/PropertyManager.Application/Vendors/UpdateVendor.cs) — handler for AC-14/15/16/17/18 (full update + trade-tag sync), AC-24 (handler-level trade-tag validation), AC-26/27/28
- [UpdateVendorValidator.cs](../../../backend/src/PropertyManager.Application/Vendors/UpdateVendorValidator.cs) — AC-19/20/21/22/23 rules verbatim
- [VendorDetailDto.cs](../../../backend/src/PropertyManager.Application/Vendors/VendorDetailDto.cs) — wire shape for GET /{id}
- [VendorDto.cs](../../../backend/src/PropertyManager.Application/Vendors/VendorDto.cs) — wire shape for GET list (includes `PrimaryPhotoThumbnailUrl`)
- [Vendor.cs (entity)](../../../backend/src/PropertyManager.Domain/Entities/Vendor.cs) — TPT inheritance, `ISoftDeletable`
- [Person.cs (base)](../../../backend/src/PropertyManager.Domain/Entities/Person.cs) — `Phones`, `Emails` value collections
- [VendorTradeTag.cs](../../../backend/src/PropertyManager.Domain/Entities/VendorTradeTag.cs)
- [VendorTradeTagAssignment.cs](../../../backend/src/PropertyManager.Domain/Entities/VendorTradeTagAssignment.cs)
- [PhoneNumber.cs (value object)](../../../backend/src/PropertyManager.Domain/ValueObjects/PhoneNumber.cs)
- [GlobalExceptionHandlerMiddleware.cs](../../../backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs) — verified mappings used in this story
- [Permissions.cs](../../../backend/src/PropertyManager.Domain/Authorization/Permissions.cs) — `Vendors.View`
- [RolePermissions.cs](../../../backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs) — Owner has it; Contributor and Tenant do not
- [Program.cs (auth policy registration)](../../../backend/src/PropertyManager.Api/Program.cs) — line 167: `CanAccessVendors` policy = `Permissions.Vendors.View`
- [PropertyManagerWebApplicationFactory.cs](../../../backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs) — `CreateTestUserAsync`, `CreateTestUserInAccountAsync(role: "Contributor")`, `CreateTenantUserInAccountAsync`, `CreatePropertyInAccountAsync`, `FakeStorageService`
- [VendorsControllerCreateTests.cs](../../../backend/tests/PropertyManager.Api.Tests/VendorsControllerCreateTests.cs) — **PRIMARY pattern reference** for this story
- [VendorsControllerDeleteTests.cs](../../../backend/tests/PropertyManager.Api.Tests/VendorsControllerDeleteTests.cs) — soft-delete + cross-account 404 pattern
- [MaintenanceRequestsControllerTests.cs (Story 21.1)](../../../backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs) — role-matrix pattern, `private sealed record` context
- [WorkOrderPhotosControllerTests.cs (Story 21.5)](../../../backend/tests/PropertyManager.Api.Tests/WorkOrderPhotosControllerTests.cs) — direct-DB seeding patterns, `OwnerContext` shape
- [Story 21.1 (done)](./21-1-maintenance-requests-controller-integration-tests.md) — factory helpers, exception mapping
- [Story 21.5 (done)](./21-5-work-order-photos-controller-integration-tests.md) — most-recent role-matrix reference
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic
- [project-context.md](../../project-context.md) — testing conventions, naming, anti-patterns
- [ASP.NET Core 10 Integration Tests (Microsoft Learn)](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit) — `WebApplicationFactory` + `IClassFixture` is the current pattern (verified via Ref MCP for prior Epic 21 stories)
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `dev-story` skill via orchestrator (story-cycle).

### Debug Log References

- `dotnet build` — clean (0 errors, 4 warnings: Receipts CS8619, PdfRendererService CA1416, two testcontainers obsolescence warnings — all pre-existing).
- `dotnet test --filter "FullyQualifiedName~VendorsControllerGetTests|FullyQualifiedName~VendorsControllerUpdateTests" --no-build` — 37/37 passed in ~2 s on first run.
- `dotnet test --no-build` (full backend suite) — 2078 passed / 0 failed (1189 Application + 98 Infrastructure + 791 Api). Up from 2041 baseline by 37 new tests, matching the story's ~30-35 estimate.

### Completion Notes List

- Two new files added (matches "do NOT consolidate" guidance from Dev Notes): `VendorsControllerGetTests.cs` (16 tests) and `VendorsControllerUpdateTests.cs` (21 tests). Total: 37 new `[Fact]` methods (story estimated 12-14 + 22-25; the lower bound was hit because some validation cases share the same shape and were not duplicated unnecessarily).
- DTOs reused from `VendorsControllerCreateTests.cs` (same assembly): `CreateVendorResponse`, `GetAllVendorsResponse`, `VendorDto`, `PhoneNumberDto`, `VendorTradeTagDto`, `LoginResponse` (the last from `PropertiesControllerTests.cs`). Two new top-level public records added in `VendorsControllerGetTests.cs`: `TestVendorDetailDto` (for GET /{id}) and `VendorDtoWithThumbnail` + `GetAllVendorsWithThumbnailResponse` (for AC-6 — the existing `VendorDto` in CreateTests omits `PrimaryPhotoThumbnailUrl`, so a parallel record is required to deserialize the new field).
- AC-1 PUT (no auth) is covered as `UpdateVendor_WithoutAuth_Returns401` in the GET file (Task 2 placement) since both files run independently and the PUT auth test sits naturally with the other auth coverage.
- AC-21 split into 3 separate tests (FirstName / LastName / MiddleName over 100), matching Task 7.3-7.5.
- AC-24 covered by 3 tests (cross-account tag, non-existent tag, partial mix), matching Task 8.1-8.3.
- Validation message assertions use `response.Content.ReadAsStringAsync()` + `Should().Contain(...)` — same pattern as existing `ExpensesControllerTests` validation tests. This sidesteps the FluentValidation collection-error-key-shape uncertainty noted in the story (e.g., `Emails[0]` vs `Emails`) — the test asserts the message text, which is stable, rather than the exact key path.
- AC-14 `UpdatedAt > seededUpdatedAt`: `AuditableEntity.UpdatedAt` is non-nullable `DateTime`, so the test reads it directly (no null check). A 50 ms `Task.Delay` between create and update guarantees `UpdatedAt` advances observably.
- AC-6 thumbnail URL assertion uses `Should().Contain("?presigned=download")` AND `Should().Contain(thumbnailKey)` — avoids fragile exact-match while still verifying the right key is presigned.
- No production code modified. `PropertyManagerWebApplicationFactory.cs`, `VendorsController.cs`, the handlers, validators, entities, and EF config are all untouched.

### File List

- `backend/tests/PropertyManager.Api.Tests/VendorsControllerGetTests.cs` (added)
- `backend/tests/PropertyManager.Api.Tests/VendorsControllerUpdateTests.cs` (added)
- `docs/project/stories/epic-21/21-6-vendors-controller-integration-tests.md` (status updated)
- `docs/project/sprint-status.yaml` (`21-6-vendors-controller-integration-tests` → `review`)
