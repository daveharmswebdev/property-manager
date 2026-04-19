# Epic 21: Test Coverage Backfill

**Author:** Dave
**Date:** 2026-04-17
**GitHub Issue:** #371
**Interrupts:** Epic 20 (Tenant Portal) — paused at 20.6, resumes after this epic

---

## Overview

A full audit of the testing pyramid (issue #371) found strong foundations — **243 test files, ~4,169 tests** — but consistent gaps in newer features (maintenance requests, tenant portal, photo operations) and a few core infrastructure services. This epic closes the full audit before resuming Epic 20 tenant portal work.

**Motivation for interrupting Epic 20:** the tenant portal is the most-affected surface (0 E2E, 0 integration tests on `MaintenanceRequestsController`). Continuing to build on that surface without backfilling tests compounds the gap. Closing the audit now keeps the pyramid shape honest as tenant features ship.

| Story | Title | Scope | Effort | Priority | Issue section |
|-------|-------|-------|--------|----------|---------------|
| 21.1 | MaintenanceRequestsController integration tests | Backend | M | P1 | #371 Critical |
| 21.2 | MaintenanceRequestPhotosController integration tests | Backend | M | P1 | #371 Critical |
| 21.3 | ExpensesController integration test consolidation | Backend | L | P1 | #371 High |
| 21.4 | Tenant Dashboard E2E | E2E | M | P1 | #371 E2E |
| 21.5 | WorkOrderPhotosController integration tests | Backend | M | P2 | #371 Critical |
| 21.6 | VendorsController integration tests (GET/PUT) | Backend | S | P2 | #371 High |
| 21.7 | Core frontend service unit tests | Frontend | M | P2 | #371 Frontend |
| 21.8 | Work Orders E2E | E2E | L | P2 | #371 E2E |
| 21.9 | Auth handler unit tests | Backend | M | P3 | #371 Medium |
| 21.10 | Dashboard unit + E2E tests | Full-stack | M | P3 | #371 Medium/E2E |
| 21.11 | Validation message assertion improvements | Cross-cutting | S | P3 | #371 Polish |
| 21.12 | Pagination edge case tests | Cross-cutting | S | P3 | #371 Polish |

**Stories are independent** — no inter-story dependencies. Execute in priority order (P1 → P2 → P3).

---

## Story 21.1: MaintenanceRequestsController Integration Tests

**As a** developer,
**I want** integration test coverage for every `MaintenanceRequestsController` endpoint,
**So that** the tenant portal's core API flow is verified end-to-end before we build more on top of it.

**Effort:** M — 4 endpoints, role-based permission matrix, tenant↔admin flow

### Background

`MaintenanceRequestsController` has 4 endpoints and zero integration tests. This controller is the heart of Epic 20 and will only grow in the tenant portal work resuming after this epic. The unit-level handler tests exist, but permission enforcement, EF Core projection, and tenant↔property linkage are only exercised by unit tests with mocks.

### Acceptance Criteria

**AC-1: POST /maintenance-requests creates a request**
Given a tenant authenticated and linked to a property
When they POST a maintenance request
Then the request is persisted with status `Submitted`, linked to the correct property and tenant user

**AC-2: POST /maintenance-requests enforces tenant→property linkage**
Given a tenant authenticated but NOT linked to the target property
When they POST a maintenance request for that property
Then the endpoint returns 403

**AC-3: GET /maintenance-requests returns account-scoped list for admin**
Given an admin user with maintenance requests across multiple properties
When they GET /maintenance-requests
Then the response includes all requests for their account and no others

**AC-4: GET /maintenance-requests returns only the tenant's own requests**
Given a tenant with their own requests plus other tenants' requests on the same property
When the tenant calls GET /maintenance-requests
Then only their own requests are returned

**AC-5: GET /maintenance-requests/{id} enforces access control**
Given a tenant requesting a maintenance request belonging to a different tenant
When they GET /maintenance-requests/{id}
Then the endpoint returns 404 (not 403 — avoid existence disclosure)

**AC-6: GET /properties/{id}/maintenance-request returns property-scoped list**
Given an admin with a property that has requests from multiple tenants
When they GET /properties/{id}/maintenance-request
Then all requests for that property are returned, ordered newest-first

### Technical Notes

- Pattern: mirror `backend/tests/PropertyManager.Api.Tests/VendorsControllerTests.cs` for fixture setup and role-based assertions
- Use `WebApplicationFactory` + real database (not mocked) per `feedback_bmad_what_works` integration test conventions
- Seeder must create: admin user, 2 tenants, property with tenant-1 linked, property with tenant-2 linked
- Don't mock `IMaintenanceRequestRepository` — the point of this story is to exercise the real EF Core path

---

## Story 21.2: MaintenanceRequestPhotosController Integration Tests

**As a** developer,
**I want** integration test coverage for the maintenance request photo flow,
**So that** S3 presigned URL generation, upload confirmation, and deletion are verified against real HTTP semantics.

**Effort:** M — 4 endpoints, presigned URL flow, S3 interaction

### Background

Four endpoints with zero integration tests: `GenerateUploadUrl`, `ConfirmUpload`, `DeletePhoto`, `GetPhotos`. S3 interactions should use LocalStack or the existing S3 test double (check existing photo controller tests for the established pattern).

### Acceptance Criteria

**AC-1: GenerateUploadUrl returns presigned URL and photo record**
Given a tenant with access to a maintenance request
When they POST /maintenance-requests/{id}/photos/generate-upload-url
Then the response contains a presigned S3 PUT URL and a `MaintenanceRequestPhoto` record with status `PendingUpload`

**AC-2: ConfirmUpload transitions status and captures metadata**
Given a photo record in `PendingUpload` status
When the client POSTs /maintenance-requests/{id}/photos/{photoId}/confirm with file metadata
Then the photo status becomes `Uploaded` and size/content-type are persisted

**AC-3: DeletePhoto removes record and S3 object**
Given an uploaded photo
When the owning tenant or an admin DELETEs it
Then the record is removed and the S3 delete call is invoked

**AC-4: DeletePhoto enforces access control**
Given a photo belonging to a different tenant
When a non-owner tenant attempts deletion
Then the endpoint returns 404

**AC-5: GetPhotos returns only photos for the requested maintenance request**
Given a maintenance request with 3 photos and another with 2 photos
When GET /maintenance-requests/{id}/photos is called
Then exactly the 3 photos for that request are returned

### Technical Notes

- Pattern: follow `PropertyPhotosControllerTests.cs` or `WorkOrderPhotos`-related integration fixtures
- For S3: use the existing test double registered in `TestServer`'s DI — do not hit real S3
- Confirm upload endpoint must be idempotent (per existing photo flow pattern)

---

## Story 21.3: ExpensesController Integration Test Consolidation

**As a** developer,
**I want** one cohesive `ExpensesControllerTests` file that covers full CRUD plus receipt linking,
**So that** the most-used endpoint in the app has complete integration coverage in one place.

**Effort:** L — consolidate 3 existing files, add 6 new test groups

### Background

Current state: `CheckDuplicate` (12 tests), `Delete` (8), `GetAll` (16) exist in separate files. Missing: POST (create), PUT (update), LinkReceipt, UnlinkReceipt, GetById, GetByProperty. This story consolidates the 3 split files into one and backfills the 6 missing groups.

### Acceptance Criteria

**AC-1: Single consolidated test file exists**
Given the 3 existing split files (`ExpensesController.CheckDuplicate`, `ExpensesController.Delete`, `ExpensesController.GetAll`)
When the consolidation is complete
Then one `ExpensesControllerTests.cs` exists containing all test methods and the 3 old files are deleted

**AC-2: POST /expenses creates expense with all valid fields**
Given a property owner authenticated
When they POST a valid expense payload
Then the expense is persisted and returned with 201 + location header

**AC-3: POST /expenses returns 400 for invalid payloads**
Given various invalid payloads (missing amount, invalid category, future date beyond tax year rules)
When each is POSTed
Then each returns 400 with validation errors matching the FluentValidation rules

**AC-4: PUT /expenses/{id} updates expense**
Given an existing expense
When a valid update is PUT
Then the expense reflects the changes and concurrency/ownership rules are enforced

**AC-5: LinkReceipt and UnlinkReceipt manage the FK relationship**
Given an expense and an unlinked receipt
When POST /expenses/{id}/link-receipt is called
Then the expense.ReceiptId is set; UnlinkReceipt clears both FK sides (per Issue #210 fix)

**AC-6: GetById returns 404 for cross-account access**
Given an expense belonging to another account
When a user from a different account GETs it
Then 404 is returned

**AC-7: GetByProperty returns only that property's expenses**
Given multiple properties with expenses
When GET /properties/{id}/expenses is called
Then only that property's expenses are returned, ordered by date desc

### Technical Notes

- Existing file locations: `backend/tests/PropertyManager.Api.Tests/ExpensesController.CheckDuplicate.cs` (etc.)
- Consolidation target: `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs`
- Preserve all existing assertions during the merge — do not reduce coverage as part of consolidation
- Nested classes (e.g., `public class Post : ExpensesControllerTestsBase`) are acceptable if the file grows large

---

## Story 21.4: Tenant Dashboard E2E Tests

**As a** developer,
**I want** Playwright E2E coverage of the tenant submit-request + request-list flow,
**So that** Epic 20 Stories 20.5 + 20.6 have user-level regression protection.

**Effort:** M — 2 flows, tenant-role auth setup, uses maintenance request API

### Background

Stories 20.5 (tenant dashboard + role routing) and 20.6 (submit maintenance request UI) shipped with zero E2E coverage. This closes that gap before Epic 20 resumes.

### Acceptance Criteria

**AC-1: Tenant can submit a maintenance request via UI**
Given a seeded tenant account linked to a property
When they log in, navigate to the dashboard, open the submit-request form, fill in title/description/priority, and submit
Then the request appears in their request list with status `Submitted`

**AC-2: Tenant sees only their own requests**
Given a tenant with 2 of their own requests and another tenant with 1 request on the same property
When they view the tenant dashboard request list
Then only their 2 requests are visible

**AC-3: Tenant submit form enforces required fields**
Given the submit-request form is open
When the tenant submits with missing title or description
Then the form shows validation errors and does not POST

**AC-4: Submit request form cleans up after itself**
Given the test creates a maintenance request
When the test completes
Then the created request is deleted via `afterEach` (per Epic 18 cleanup conventions)

### Technical Notes

- Test file: `frontend/e2e/tests/tenant-dashboard.spec.ts`
- Auth setup: use tenant seed account pattern from Story 20.5 — may need a tenant-specific storageState
- Cleanup: use the test reset pattern from Epic 18 (Story 18.2) — or `page.route()` interception where reset endpoint isn't wired
- Run locally with `--workers=1` to match CI

---

## Story 21.5: WorkOrderPhotosController Integration Tests

**As a** developer,
**I want** dedicated integration tests for `WorkOrderPhotosController`,
**So that** the 5 photo endpoints are covered independently of the work order controller.

**Effort:** M — 5 endpoints, referenced in `WorkOrdersControllerTests` but no dedicated file

### Background

Endpoints: `GenerateUploadUrl`, `ConfirmUpload`, `DeletePhoto`, `SetPrimary`, `ReorderPhotos`. Currently referenced tangentially in `WorkOrdersControllerTests` but no dedicated test file exists.

### Acceptance Criteria

**AC-1: GenerateUploadUrl returns presigned URL for work order owner**
Given an authenticated user owning a work order
When they request an upload URL
Then a presigned URL and pending photo record are returned

**AC-2: ConfirmUpload transitions photo to `Uploaded`**
Given a pending photo
When confirm is called with metadata
Then status becomes `Uploaded` and metadata is persisted

**AC-3: SetPrimary promotes one photo and demotes others**
Given a work order with 3 photos, one currently primary
When SetPrimary is called on a non-primary photo
Then the new photo is primary and the old one is not — exactly one primary per work order

**AC-4: ReorderPhotos updates display order**
Given 3 photos with display orders 0,1,2
When ReorderPhotos is called with the reversed order
Then display orders are 2,1,0

**AC-5: DeletePhoto removes S3 object and record**
Given an uploaded photo
When the owner deletes it
Then record and S3 object are removed; subsequent primary logic adjusts if needed

**AC-6: All endpoints enforce work-order ownership**
Given a user requesting operations on another account's work-order photo
When any endpoint is called
Then 404 is returned

### Technical Notes

- Pattern: mirror 21.2 (`MaintenanceRequestPhotosController`) and `PropertyPhotos` integration tests
- Test file: `backend/tests/PropertyManager.Api.Tests/WorkOrderPhotosControllerTests.cs`
- Setup must handle the "exactly one primary" invariant cleanly (seed with a known primary photo)

---

## Story 21.6: VendorsController Integration Tests (GET/PUT)

**As a** developer,
**I want** integration coverage for vendor read and update endpoints,
**So that** the vendor feature has full CRUD integration coverage.

**Effort:** S — 3 endpoints, existing Create+Delete tests as pattern

### Background

`VendorsController` has integration tests for Create (12) and Delete (7). Missing: GET /vendors (list), GET /vendors/{id}, PUT /vendors/{id}.

### Acceptance Criteria

**AC-1: GET /vendors returns account-scoped list**
Given an account with 3 vendors and another account with 2 vendors
When a user from the first account GETs /vendors
Then exactly the 3 vendors belonging to their account are returned

**AC-2: GET /vendors supports search, trade-tag filter, and pagination**
Given 20+ vendors with varied names and trade tags
When GET /vendors is called with `?search=`, `?tradeTagId=`, `?page=2&pageSize=10`
Then the response reflects the applied filters and pagination metadata matches

**AC-3: GET /vendors/{id} returns 404 for cross-account access**
Given a vendor on another account
When a user from a different account GETs it
Then 404 is returned

**AC-4: PUT /vendors/{id} updates vendor fields and trade tags**
Given an existing vendor
When a valid update payload is PUT (including updated phone list, email list, trade tags)
Then the vendor reflects the changes with the updated child collections

**AC-5: PUT /vendors/{id} returns 400 for invalid payloads**
Given various invalid payloads (missing name, invalid email format, duplicate trade tag IDs)
When each is PUT
Then 400 is returned with validation errors

### Technical Notes

- Existing file: `backend/tests/PropertyManager.Api.Tests/VendorsControllerTests.cs` (extend — do not create separate file)
- Follow the Create tests' fixture setup pattern

---

## Story 21.7: Core Frontend Service Unit Tests

**As a** developer,
**I want** unit test coverage for `api.service.ts` and `auth.interceptor.ts`,
**So that** the HTTP plumbing every feature depends on has its own regression tests.

**Effort:** M — 2 cross-cutting services, interceptor chain testing

### Background

`api.service.ts` is the base HTTP service used by all feature services. `auth.interceptor.ts` handles token injection, 401 handling, and refresh flow. Both are load-bearing infrastructure with zero dedicated unit tests.

### Acceptance Criteria

**AC-1: api.service exposes typed HTTP methods that prefix /api/v1**
Given the service is used with a resource path like `/properties`
When any method (get/post/put/delete) is called
Then the underlying HttpClient receives `/api/v1/properties` with the method and body intact

**AC-2: api.service surfaces server errors via observable error channel**
Given the server returns 500
When the service caller subscribes
Then the error observable emits with the status and body preserved

**AC-3: auth.interceptor injects Authorization header for protected routes**
Given the user is authenticated (token in auth state)
When any request passes through the interceptor
Then the `Authorization: Bearer <token>` header is added

**AC-4: auth.interceptor does NOT inject token for public routes**
Given a request to `/api/v1/auth/login` or other public routes
When the interceptor runs
Then no Authorization header is added

**AC-5: auth.interceptor handles 401 by attempting refresh then retrying once**
Given a protected request returns 401 and a refresh token is available
When the interceptor handles the 401
Then it calls the refresh endpoint, updates auth state, and retries the original request once

**AC-6: auth.interceptor logs user out after failed refresh**
Given the refresh call itself fails
When the interceptor handles that failure
Then auth state is cleared and navigation redirects to login

### Technical Notes

- Test files: `frontend/src/app/core/services/api.service.spec.ts`, `frontend/src/app/core/auth/auth.interceptor.spec.ts`
- Use Angular's `HttpClientTestingModule` + `HttpTestingController` for the API service
- For the interceptor, provide a fake `AuthService` via DI and assert against `flush()`/`expectOne()`
- Vitest runner, not vanilla Jasmine (per project convention)

---

## Story 21.8: Work Orders E2E Tests

**As a** developer,
**I want** E2E coverage for work order create/edit/delete/photo/PDF flows,
**So that** the work order feature has regression protection beyond the current list-only test.

**Effort:** L — 5 flows, may split during dev-story if it grows

### Background

Current E2E: 1 file, list-only. Missing: create, edit, delete, photo upload, PDF generation.

### Acceptance Criteria

**AC-1: User can create a work order via UI**
Given a seeded property and vendor
When the user opens the create-work-order form, fills fields, and submits
Then the work order appears in the list with the correct status and vendor

**AC-2: User can edit an existing work order**
Given an existing work order
When the user opens edit, changes status/description/vendor, and saves
Then the detail page reflects the changes

**AC-3: User can delete a work order from list or detail**
Given an existing work order
When the user clicks delete and confirms
Then the work order is removed from the list

**AC-4: User can upload a photo to a work order**
Given a work order detail page
When the user uploads an image file via the photo upload control
Then the photo appears in the gallery

**AC-5: User can generate and view the work order PDF**
Given a work order with vendor and details
When the user clicks "Generate PDF"
Then a PDF preview opens (or downloads per current behavior) with the work order content

**AC-6: Tests clean up created data**
Given the tests create work orders, photos
When tests finish
Then all created entities are removed via afterEach or test reset endpoint

### Technical Notes

- File location: `frontend/e2e/tests/work-orders-*.spec.ts` — split by flow if single file exceeds ~300 lines
- PDF: don't validate PDF bytes — validate that the request is made and response returns 200 with `application/pdf` content type
- Photo upload: use existing property-photo or work-order-photo upload E2E as the pattern
- If this story runs long, split AC-4/AC-5 into a follow-up story during dev-story

---

## Story 21.9: Auth Handler Unit Tests

**As a** developer,
**I want** unit tests for auth handlers (Login, RefreshToken, ResetPassword, etc.),
**So that** handler logic has the same unit coverage as the rest of the Application layer.

**Effort:** M — ~5-7 handlers, existing handler unit tests as pattern

### Background

Integration tests for auth exist (~25 methods). Zero unit tests for the handler logic itself. Handlers contain meaningful business logic (password validation, token generation, account lockout rules) that is currently only exercised indirectly through integration.

### Acceptance Criteria

**AC-1: LoginHandler unit tests cover success, invalid password, and lockout paths**
Given mocked UserManager and SignInManager
When each scenario is exercised
Then the handler returns the expected success or failure with the correct error message

**AC-2: RefreshTokenHandler unit tests cover valid, expired, and revoked token paths**
Given mocked token repository
When each scenario is exercised
Then the handler returns new tokens for valid, and failures for expired/revoked

**AC-3: ResetPasswordHandler unit tests cover valid token, invalid token, expired token**
Given mocked UserManager with varying token validation
When each scenario is exercised
Then the handler returns the expected outcome

**AC-4: RequestPasswordResetHandler unit tests cover valid email, unknown email, email send failure**
Given mocked UserManager and IEmailService
When each scenario is exercised
Then behavior matches requirements (including "return 200 for unknown email" anti-enumeration)

**AC-5: Tests follow existing handler unit test conventions**
Given the established patterns in `PropertyManager.Application.Tests/`
When the new tests are added
Then they use the same fixture/builder/Moq patterns as neighboring tests

### Technical Notes

- Target handlers live in `backend/src/PropertyManager.Application/Auth/` — enumerate and cover each
- Existing pattern reference: any `*/Handlers/*HandlerTests.cs` in the Application.Tests project
- Use MockQueryable.Moq v10 pattern (per Epic 18) — `.BuildMockDbSet()` without `.AsQueryable()`

---

## Story 21.10: Dashboard Unit + E2E Tests

**As a** developer,
**I want** unit coverage of dashboard aggregation logic plus at least one E2E smoke,
**So that** the dashboard has baseline regression protection even though it's low-priority internal analytics.

**Effort:** M — small surface, but spans two test layers

### Background

Integration tests exist (~8 methods) for the dashboard aggregation query. Zero unit tests for the aggregation logic. Zero E2E coverage.

### Acceptance Criteria

**AC-1: Dashboard aggregation handler unit tests cover common paths**
Given mocked repositories with varied data (no properties, one property, multiple properties with expenses/income)
When the aggregation handler runs
Then returned totals, percentage-change calculations, and period comparisons match expectations

**AC-2: Dashboard E2E smoke verifies the page renders with data**
Given a seeded account with at least one property, expense, and income
When the user logs in and lands on the dashboard
Then the totals card, recent activity, and per-property breakdown render with non-zero values where expected

**AC-3: Dashboard E2E smoke verifies empty-state**
Given an account with no properties
When the user views the dashboard
Then the empty-state prompt is shown (no errors, no misleading "$0" totals without context)

### Technical Notes

- Unit tests: target the aggregation handler in `PropertyManager.Application/Dashboard/`
- E2E: one file, ~2-3 tests, not a full feature sweep — this is baseline coverage only
- Empty-state assertion requires a separate seed/fixture; alternatively use `page.route()` to simulate empty data

---

## Story 21.11: Validation Message Assertion Improvements

**As a** developer,
**I want** existing controller and component tests to assert validation message content (not just "expect error"),
**So that** changes to validator messages are caught by tests instead of slipping past.

**Effort:** S — cross-cutting polish, no new test files

### Background

Per audit: existing tests often assert "validation fails" without asserting the specific message. That means a validator message change wouldn't fail any test. This story tightens assertions across the existing corpus.

### Acceptance Criteria

**AC-1: Backend FluentValidation tests assert specific error messages**
Given the current validator unit tests
When they assert invalid input
Then each assertion includes the exact expected error message (or the property+rule name that produced it)

**AC-2: Frontend reactive form tests assert displayed error text**
Given component tests that submit invalid forms
When they assert error state
Then each assertion checks the rendered message text (not just `form.invalid === true`)

**AC-3: Scope is bounded — no new tests, only tightening existing ones**
Given this is polish work
When the story is executed
Then no new test files or test cases are added; existing assertions are strengthened

### Technical Notes

- Scan target: backend `*ValidatorTests.cs` and frontend `*.spec.ts` with `form.invalid` or generic error assertions
- If a test file has 20+ assertions to tighten, prefer a single-file PR rather than one mega-PR
- If tightening reveals incorrect or missing validator messages, fix the validator — don't assert wrong behavior

---

## Story 21.12: Pagination Edge Case Tests

**As a** developer,
**I want** pagination edge case coverage across list endpoints,
**So that** page-boundary, empty-page, and over-request scenarios are verified consistently.

**Effort:** S — cross-cutting polish across existing integration tests

### Background

Per audit: list endpoints support pagination but edge cases (page=0, page beyond last, pageSize=0, pageSize larger than total) are unevenly covered. This story adds a consistent edge-case block to each list endpoint test file.

### Acceptance Criteria

**AC-1: Each paginated endpoint has edge case coverage**
Given list endpoints across Properties, Expenses, Vendors, WorkOrders, MaintenanceRequests
When each test file is updated
Then each file has tests covering: page=1 with fewer results than pageSize, page beyond last, pageSize=0 (should reject or default), pageSize > max (should clamp or reject per current rule)

**AC-2: Edge cases match the actual controller contract**
Given the controller's current pagination rules (pageSize bounds, default behavior)
When tests assert
Then they assert the actual contract — not an aspirational one

**AC-3: If inconsistencies are found across controllers, document and fix**
Given different controllers might handle pageSize=0 differently (one rejects, another defaults)
When the inconsistency is surfaced
Then a follow-up issue is filed (or fixed in-scope if trivial) and tests assert the unified behavior

### Technical Notes

- Paginated endpoints to cover: list controllers in the audit's P1/P2 scope plus Properties/Income
- Follow the pattern already used in `ExpensesController.GetAll` tests for pagination
- If AC-3 surfaces a real bug, do NOT silently fix it inside this story — flag it

---

## Validation Gates

- [ ] All 12 stories have BDD-formatted acceptance criteria
- [ ] Effort estimates assigned (S/M/L) for every story
- [ ] Stories are independent — no hidden inter-story dependencies
- [ ] Coverage targets (from issue #371) are fully represented across the 12 stories
- [ ] User reviewed and approved
