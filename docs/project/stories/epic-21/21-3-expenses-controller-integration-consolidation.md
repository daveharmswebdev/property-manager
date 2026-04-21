# Story 21.3: ExpensesController Integration Test Consolidation

Status: done

## Story

As a developer,
I want one cohesive `ExpensesControllerTests` file that covers full CRUD plus receipt linking,
so that the most-used endpoint in the app has complete integration coverage — exercising the real HTTP + EF Core + auth + permission policy + global query filter stack — in one place, making regressions in the expense surface fail loudly and locally.

## Acceptance Criteria

> **Note (epic vs. controller reconciliation):** Epic 21's AC-3 and AC-5 reference features not present in the shipped controller. ACs below reflect the **shipped** behavior per `backend/src/PropertyManager.Api/Controllers/ExpensesController.cs`, the handlers in `backend/src/PropertyManager.Application/Expenses/`, and `GlobalExceptionHandlerMiddleware`. Key deltas:
>
> | Epic statement | Actual behavior | Story ACs |
> |---|---|---|
> | "POST returns 400 for invalid category" | Handler throws `NotFoundException(nameof(ExpenseCategory), ...)` → **404**, not 400. | AC-CR-4 |
> | "POST returns 400 for future date beyond tax year rules" | Validator `Date <= Today` → **400** (FluentValidation). No "tax year rules" beyond not-in-future. | AC-CR-5 |
> | "PUT enforces concurrency rules" | No concurrency/ETag support. PUT enforces **account isolation** via global query filter (404 cross-account) and validates new property belongs to account on reassignment. | AC-PUT-3, AC-PUT-6 |
> | "LinkReceipt + UnlinkReceipt manage FK relationship" | `LinkReceipt` returns **409** when expense already has a receipt OR receipt is already processed (`ConflictException`). `UnlinkReceipt` at `DELETE /expenses/{id}/receipt` clears both FK sides and returns 204. | AC-LINK-*, AC-UNLINK-* |
> | "LinkReceipt returns 400 for cross-account" | Expense lookup is filtered by global query filter; cross-account → handler finds nothing → `NotFoundException` → **404**. Receipt lookup has **no account filter** in the query (see `LinkReceiptToExpense.cs` line 41-42) — but receipts are still filtered by the global query filter applied on `IAppDbContext.Receipts`. Verify during dev and adjust AC-LINK-5 if behavior differs. | AC-LINK-4, AC-LINK-5 |
> | "GetByProperty returns only that property's expenses ordered by date desc" | Matches shipped behavior. `OrderByDescending(e => e.Date).ThenByDescending(e => e.CreatedAt)`. | AC-PROP-1, AC-PROP-2 |
>
> **Consolidation scope:** The 3 existing split files (`ExpensesControllerCheckDuplicateTests.cs`, `ExpensesControllerDeleteTests.cs`, `ExpensesControllerGetAllTests.cs`) are consolidated into **one** `ExpensesControllerTests.cs` file using nested partial classes per endpoint group (matches Story 21.1/21.2 convention of one file per controller, but with endpoint grouping via `#region` headers or nested test classes if the file grows past ~1000 lines). **No coverage reduction.** Every existing `[Fact]` must be preserved — see Task 2.

### Consolidation ACs

**AC-CONSOL-1: Single consolidated test file exists**
- **Given** the 3 existing split files (`ExpensesControllerCheckDuplicateTests.cs`, `ExpensesControllerDeleteTests.cs`, `ExpensesControllerGetAllTests.cs`)
- **When** the consolidation is complete
- **Then** one `ExpensesControllerTests.cs` exists in `backend/tests/PropertyManager.Api.Tests/` containing **all** test methods from the 3 original files (35 total pre-existing tests), plus the new test groups from this story
- **And** the 3 old files are deleted
- **And** no pre-existing `[Fact]` is removed or renamed without equivalent replacement — diff the original 3 files against the consolidated file and confirm every pre-existing test body/assertion still exists (method names may be reorganized inside `#region` blocks)

**AC-CONSOL-2: File structure uses region-grouped or partial-class organization**
- **Given** the consolidated file grows to include ~60-80 `[Fact]` methods
- **When** a developer reads it
- **Then** tests are grouped logically: `#region POST /expenses`, `#region PUT /expenses/{id}`, `#region DELETE /expenses/{id}`, `#region GET /expenses`, `#region GET /expenses/{id}`, `#region GET /properties/{id}/expenses`, `#region POST /expenses/{id}/link-receipt`, `#region DELETE /expenses/{id}/receipt`, `#region GET /expenses/check-duplicate`, `#region GET /expenses/totals`, `#region GET /expense-categories`
- **And** if the file exceeds ~1000 lines, it may be split into partial classes (`ExpensesControllerTests.CreateTests.cs` etc.) sharing a single base `ExpensesControllerTests` class — this is a permitted variant, NOT required; prefer a single file first

**AC-CONSOL-3: Shared helpers live in one place**
- **Given** the existing 3 files each duplicate `RegisterAndLoginAsync`, `CreatePropertyAsync`, `CreateExpenseAsync`, `PostAsJsonWithAuthAsync`, `GetWithAuthAsync`, `DeleteWithAuthAsync` helpers
- **When** consolidation is complete
- **Then** each helper exists exactly once in the consolidated file (not re-declared per region)
- **And** response records (`CreateExpenseResponse`, `ExpenseCategoriesResponse`, `PagedExpenseListResponse`, `DuplicateCheckResponse`, `DuplicateExpenseResponse`, plus new ones added this story) exist once, not duplicated

### Auth ACs (all endpoints)

**AC-AUTH-1: All endpoints return 401 without a bearer token**
- **Given** no `Authorization` header
- **When** each of: `POST /expenses`, `PUT /expenses/{id}`, `DELETE /expenses/{id}`, `GET /expenses`, `GET /expenses/{id}`, `GET /properties/{id}/expenses`, `POST /expenses/{id}/link-receipt`, `DELETE /expenses/{id}/receipt`, `GET /expenses/check-duplicate`, `GET /expenses/totals`, `GET /expense-categories` is called
- **Then** each returns `401 Unauthorized`

**AC-AUTH-2: All endpoints return 403 for users without `Expenses.View` permission**
- **Given** a Contributor user authenticated (Contributor lacks `Expenses.View`, `Expenses.Create`, `Expenses.Edit`, `Expenses.Delete` per `RolePermissions.cs`)
- **When** they call any endpoint on the controller
- **Then** the controller's class-level `[Authorize(Policy = "CanAccessExpenses")]` returns `403 Forbidden` before the handler runs
- **Note:** `CanAccessExpenses` requires `Permissions.Expenses.View` (Program.cs line 165). Only Owner has this today. Tenants do NOT have expense permissions and are also 403.

### POST /api/v1/expenses (Create) ACs

**AC-CR-1: POST creates expense and returns 201 with id + Location header**
- **Given** an Owner authenticated, with an existing property and an existing expense category
- **When** they POST body `{ PropertyId, Amount: 127.50, Date: 2025-06-01, CategoryId, Description: "Home Depot — Faucet" }`
- **Then** the response is `201 Created` with a `Location` header and body `{ id }`
- **And** a row exists in `Expenses` with `AccountId == owner.AccountId`, `PropertyId`, `CategoryId`, `Amount == 127.50`, `Date == 2025-06-01`, `Description == "Home Depot — Faucet"` (trimmed), `CreatedByUserId == owner.UserId`, `DeletedAt == null`, `WorkOrderId == null`, `ReceiptId == null`

**AC-CR-2: POST trims Description whitespace**
- **Given** a valid payload with `Description: "   leading and trailing   "`
- **When** POSTed
- **Then** the persisted `Description == "leading and trailing"`

**AC-CR-3: POST with WorkOrderId on same property succeeds**
- **Given** a property P1 with an existing work order WO-1 on P1
- **When** POST body includes `PropertyId: P1.Id, WorkOrderId: WO-1.Id`
- **Then** the response is `201`, and the persisted expense has `WorkOrderId == WO-1.Id`

**AC-CR-4: POST returns 404 when PropertyId does not exist (or belongs to another account)**
- **Given** an authenticated Owner in Account A and a property in Account B (or a random GUID)
- **When** they POST with `PropertyId: accountB.PropertyId` (or nonexistent GUID)
- **Then** the response is `404 Not Found` — handler throws `NotFoundException(nameof(Property), ...)`
- **Note:** Global query filter on `Properties` makes cross-account properties invisible; same code path as "property doesn't exist"

**AC-CR-5: POST returns 404 for non-existent CategoryId**
- **Given** a valid property, but `CategoryId` set to a random GUID
- **When** POSTed
- **Then** the response is `404 Not Found` — handler throws `NotFoundException(nameof(ExpenseCategory), ...)`

**AC-CR-6: POST returns 404 for non-existent WorkOrderId**
- **Given** `WorkOrderId` set to a random GUID
- **When** POSTed
- **Then** the response is `404 Not Found`

**AC-CR-7: POST returns 400 (FluentValidation) when WorkOrder belongs to a different property**
- **Given** Property P1 and Property P2, with WO-2 on P2
- **When** the owner POSTs body `{ PropertyId: P1, WorkOrderId: WO-2 }`
- **Then** the response is `400 BadRequest` — handler throws `FluentValidation.ValidationException("Expense and work order must belong to the same property")`, middleware maps to 400

**AC-CR-8: POST validation errors return 400 with ValidationProblemDetails**
- **Given** various invalid payloads (one per test or `[Theory]`):
  - `Amount: 0` → "Amount must be greater than $0"
  - `Amount: -10` → same
  - `Amount: 10000000.00` → "Amount exceeds maximum of $9,999,999.99"
  - `Amount: 12.345` → "Amount can have at most 2 decimal places"
  - `Date: DateOnly.FromDateTime(DateTime.Today.AddDays(1))` → "Date cannot be in the future"
  - `PropertyId: Guid.Empty` → "Property is required"
  - `CategoryId: Guid.Empty` → "Category is required"
  - `Description: new string('x', 501)` → "Description must be 500 characters or less"
  - `Description: "<script>alert('xss')</script>"` → "Description cannot contain HTML"
  - `WorkOrderId: Guid.Empty` (non-null) → "WorkOrderId must be a valid GUID or null"
- **When** each is POSTed
- **Then** each returns `400 BadRequest` with a `ValidationProblemDetails` payload, and the `errors` dictionary contains the appropriate field name(s). **Assert the specific message string per Story 21.11 guidance** — do not just assert 400.

### PUT /api/v1/expenses/{id} (Update) ACs

**AC-PUT-1: PUT updates editable fields and returns 204**
- **Given** an existing expense owned by the caller's account
- **When** they PUT body `{ Amount, Date, CategoryId, Description, WorkOrderId: null, PropertyId: null }` with all fields changed
- **Then** the response is `204 No Content`
- **And** the persisted expense reflects the new `Amount`, `Date`, `CategoryId`, `Description` (trimmed)
- **And** `UpdatedAt` is within ±2 seconds of `DateTime.UtcNow`
- **And** `CreatedAt` and `CreatedByUserId` are **unchanged** (preserved)

**AC-PUT-2: PUT allows property reassignment**
- **Given** an expense on Property P1, and a Property P2 in the same account
- **When** PUT body includes `PropertyId: P2.Id`
- **Then** the persisted expense has `PropertyId == P2.Id`, response 204

**AC-PUT-3: PUT with PropertyId of another account returns 404**
- **Given** an expense in Account A, and a Property P_B in Account B
- **When** Account A's owner PUTs with `PropertyId: P_B.Id`
- **Then** response is `404 Not Found` (handler validates the new property exists + belongs to caller's account)

**AC-PUT-4: PUT clears optional WorkOrderId when body passes null**
- **Given** an expense with a non-null `WorkOrderId`
- **When** PUT body has `WorkOrderId: null`
- **Then** the persisted `WorkOrderId == null`

**AC-PUT-5: PUT returns 404 for non-existent expense id**
- **Given** an authenticated Owner and a random GUID
- **When** they PUT `/expenses/{randomGuid}`
- **Then** response is `404 Not Found`

**AC-PUT-6: PUT cross-account access returns 404 (no existence disclosure)**
- **Given** an expense in Account A
- **When** an Owner in Account B PUTs to that id
- **Then** response is `404 Not Found` (global query filter prevents leakage)

**AC-PUT-7: PUT on soft-deleted expense returns 404**
- **Given** an expense with `DeletedAt != null`
- **When** PUT is called on it
- **Then** response is `404 Not Found`

**AC-PUT-8: PUT returns 404 for non-existent CategoryId**
- **Given** a valid expense and random CategoryId
- **When** PUT is called
- **Then** response is `404 Not Found`

**AC-PUT-9: PUT returns 400 when WorkOrder belongs to a different property than the effective (post-reassignment) one**
- **Given** an expense being reassigned to P2, and a WorkOrder on P1
- **When** PUT body `{ PropertyId: P2, WorkOrderId: WO_P1 }`
- **Then** response is `400` (same `ValidationException` path as AC-CR-7)

**AC-PUT-10: PUT returns 400 for the same validator rules as POST**
- **Given** the invalid-payload matrix from AC-CR-8 (applicable fields)
- **When** each is PUT
- **Then** each returns `400 BadRequest` with matching validator messages

### DELETE /api/v1/expenses/{id} (Soft Delete) ACs — PRESERVE FROM `ExpensesControllerDeleteTests.cs`

Preserve all 8 existing tests verbatim (or under `#region DELETE /expenses/{id}`):
- `DeleteExpense_WithoutAuth_Returns401`
- `DeleteExpense_ValidExpense_Returns204`
- `DeleteExpense_ValidExpense_SetsDeletedAt`
- `DeleteExpense_NonExistentExpense_Returns404`
- `DeleteExpense_OtherAccountExpense_Returns404`
- `DeleteExpense_AlreadyDeleted_Returns404`
- `DeleteExpense_ExcludedFromGetByProperty`
- `DeleteExpense_GetByIdReturns404`

### GET /api/v1/expenses (List) ACs — PRESERVE FROM `ExpensesControllerGetAllTests.cs`

Preserve all 16 existing tests verbatim (under `#region GET /expenses`).

**AC-GET-ALL-NEW-1: Sort by Amount descending**
- **Given** 3 expenses with amounts 100, 200, 300
- **When** `GET /expenses?sortBy=amount&sortDirection=desc`
- **Then** items[0].Amount == 300, items[1] == 200, items[2] == 100

**AC-GET-ALL-NEW-2: Sort by Amount ascending**
- Same seed, `sortDirection=asc` → ascending order

**AC-GET-ALL-NEW-3: Filter by PropertyId**
- **Given** expenses on two properties
- **When** `GET /expenses?propertyId={P1.Id}`
- **Then** only P1's expenses returned

**AC-GET-ALL-NEW-4: Filter by multiple CategoryIds (additive)**
- **Given** expenses across 3 categories (Repairs, Utilities, Insurance)
- **When** `GET /expenses?categoryIds={Repairs.Id}&categoryIds={Utilities.Id}`
- **Then** expenses in Repairs OR Utilities are returned; Insurance is excluded

**AC-GET-ALL-NEW-5: Page beyond last returns empty Items with correct metadata**
- **Given** 3 expenses
- **When** `GET /expenses?page=10&pageSize=50`
- **Then** response `items.Count == 0`, `page == 10`, `totalCount == 3`, `totalPages == 1`

**AC-GET-ALL-NEW-6: PageSize > 100 is clamped to 100**
- **Given** any state (may be empty)
- **When** `GET /expenses?pageSize=500`
- **Then** response `pageSize == 100` (per `Math.Clamp`)

**AC-GET-ALL-NEW-7: Response includes TotalAmount**
- **Given** 3 expenses of 100, 200, 300
- **When** `GET /expenses`
- **Then** response `totalAmount == 600.00` (sum of all matching rows)

### GET /api/v1/expenses/{id} (GetById) ACs — NEW

**AC-GETBYID-1: Returns the expense with all DTO fields**
- **Given** an expense in the caller's account with a Property, Category, and no WorkOrder or Receipt
- **When** `GET /expenses/{id}`
- **Then** response is `200 OK` with `{ id, propertyId, propertyName, categoryId, categoryName, scheduleELine, amount, date, description, receiptId: null, workOrderId: null, workOrderDescription: null, workOrderStatus: null, createdAt }`

**AC-GETBYID-2: Returns workOrder fields when expense has a WorkOrder**
- **Given** an expense with a linked work order
- **When** `GET /expenses/{id}`
- **Then** `workOrderId`, `workOrderDescription`, and `workOrderStatus` are populated (status is the enum `.ToString()`)

**AC-GETBYID-3: Cross-account returns 404**
- Same as AC-PUT-6 shape — an Owner in Account B gets 404 for Account A's expense

**AC-GETBYID-4: Soft-deleted expense returns 404**
- Same as `DeleteExpense_GetByIdReturns404` but listed explicitly in the GET-by-id region

### GET /api/v1/properties/{id}/expenses ACs — NEW

**AC-PROP-1: Returns paginated list for a property with YtdTotal**
- **Given** a property with 3 expenses (100, 200, 300) plus one expense on a different property
- **When** `GET /properties/{id}/expenses`
- **Then** response `items.Count == 3`, `totalCount == 3`, `ytdTotal == 600.00`, `pageSize == 25` (default)
- **And** items are ordered by `Date` descending then `CreatedAt` descending
- **And** only that property's expenses are returned (the "other property" expense is not leaked)

**AC-PROP-2: Year filter excludes expenses outside the year**
- **Given** expenses in 2024 and 2025 for the same property
- **When** `GET /properties/{id}/expenses?year=2025`
- **Then** only 2025 expenses are returned; `ytdTotal` sums only 2025

**AC-PROP-3: Returns 404 for non-existent / cross-account property**
- **Given** an authenticated Owner and a random GUID (or another account's property id)
- **When** `GET /properties/{randomId}/expenses`
- **Then** response is `404 Not Found`

**AC-PROP-4: Empty property returns empty list with YtdTotal == 0**
- **Given** a property with no expenses
- **When** `GET /properties/{id}/expenses`
- **Then** response `items == []`, `totalCount == 0`, `ytdTotal == 0`, `totalPages == 1` (per handler: `totalCount == 0 ? 1 : ...`)

**AC-PROP-5: Pagination respects page + pageSize, clamped to 1-100**
- **Given** 5 expenses
- **When** `GET /properties/{id}/expenses?pageSize=2&page=2`
- **Then** `items.Count == 2`, `page == 2`, `pageSize == 2`, `totalPages == 3`, `ytdTotal` still reflects ALL 5 (pre-pagination sum per handler)
- **And** `GET /properties/{id}/expenses?pageSize=500` → `pageSize == 100`

### POST /api/v1/expenses/{id}/link-receipt ACs — NEW

**AC-LINK-1: Happy path links receipt to expense and returns 204**
- **Given** an existing expense with `ReceiptId == null` and an existing unprocessed receipt (`ProcessedAt == null`, `ExpenseId == null`) in the same account
- **When** `POST /expenses/{expenseId}/link-receipt` body `{ receiptId }`
- **Then** response is `204 No Content`
- **And** `expense.ReceiptId == receipt.Id`
- **And** `receipt.ExpenseId == expense.Id`
- **And** `receipt.ProcessedAt` is within ±2 seconds of `DateTime.UtcNow`
- **And** if `receipt.PropertyId` was null, it is now `expense.PropertyId`; if already set, unchanged

**AC-LINK-2: Validation rejects empty GUIDs with 400**
- **Given** body `{ receiptId: Guid.Empty }` (or route `{id}` as `Guid.Empty` — not possible via `:guid` constraint, but empty body-receiptId is)
- **When** POST is called
- **Then** response is `400 BadRequest` (validator `NotEmpty()`)

**AC-LINK-3: Returns 404 for non-existent expense id**
- **Given** an authenticated Owner and a random expenseId GUID
- **When** POST is called
- **Then** response is `404 Not Found`

**AC-LINK-4: Cross-account expense returns 404**
- **Given** an expense in Account A
- **When** Account B's owner POSTs link-receipt on that expense id
- **Then** response is `404 Not Found`

**AC-LINK-5: Returns 404 for non-existent receipt id**
- **Given** a valid expense and random receiptId GUID
- **When** POST is called
- **Then** response is `404 Not Found`

**AC-LINK-6: Returns 409 when expense already has a receipt**
- **Given** an expense with `ReceiptId != null`
- **When** POST is called with a different receipt id (even an unprocessed one)
- **Then** response is `409 Conflict` — handler throws `ConflictException(nameof(Expense), expenseId, "already has a linked receipt")`

**AC-LINK-7: Returns 409 when receipt is already processed**
- **Given** an expense with `ReceiptId == null` and a receipt with `ProcessedAt != null`
- **When** POST is called
- **Then** response is `409 Conflict` — `ConflictException(nameof(Receipt), receiptId, "is already processed")`

### DELETE /api/v1/expenses/{id}/receipt (UnlinkReceipt) ACs — NEW

**AC-UNLINK-1: Happy path clears both FK sides and returns 204**
- **Given** an expense with a linked receipt (both sides set, `ProcessedAt != null`)
- **When** `DELETE /expenses/{expenseId}/receipt`
- **Then** response is `204 No Content`
- **And** `expense.ReceiptId == null`
- **And** `receipt.ExpenseId == null`
- **And** `receipt.ProcessedAt == null` (returned to unprocessed queue)

**AC-UNLINK-2: Returns 404 for non-existent expense**
- Random GUID → 404

**AC-UNLINK-3: Returns 404 for expense with no linked receipt**
- **Given** an expense with `ReceiptId == null`
- **When** DELETE is called
- **Then** response is `404 Not Found` (handler throws `NotFoundException("Receipt for expense", expenseId)`)

**AC-UNLINK-4: Cross-account expense returns 404**
- Same as AC-PUT-6 shape

**AC-UNLINK-5: Idempotency / double-unlink returns 404**
- Call DELETE twice; second call returns 404 (state-based, not strictly idempotent — matches Story 15.4)

### GET /api/v1/expenses/check-duplicate ACs — PRESERVE FROM `ExpensesControllerCheckDuplicateTests.cs` (11 tests)

All 11 existing tests preserved under `#region GET /expenses/check-duplicate`.

### GET /api/v1/expenses/totals ACs — NEW

**AC-TOTALS-1: Returns totals for the given year with per-property breakdown**
- **Given** an account with 2 properties and expenses 100, 200 on P1 and 50 on P2 in 2025
- **When** `GET /expenses/totals?year=2025`
- **Then** response has `totalExpenses == 350` and `byProperty` contains 2 entries summing to 350

**AC-TOTALS-2: Defaults to current year when `year` omitted**
- Per controller: `effectiveYear = year ?? DateTime.UtcNow.Year`

**AC-TOTALS-3: Empty account returns `totalExpenses == 0` and empty byProperty**
- No properties, no expenses → `totalExpenses == 0`, `byProperty.Count == 0`

**AC-TOTALS-4: Other accounts' expenses are not leaked**
- Account B has expenses; Account A's totals show 0

### GET /api/v1/expense-categories ACs — NEW

**AC-CATS-1: Returns all seeded expense categories**
- **Given** the database has the 15 IRS Schedule E categories seeded (per migrations)
- **When** `GET /expense-categories`
- **Then** response is `200 OK` with `items.Count == 15` (or actual seeded count — read the migration to confirm) and `totalCount == items.Count`
- **Note:** Categories are global (not account-scoped). This endpoint is shared across all accounts.

## Tasks / Subtasks

- [x] **Task 1: Inventory pre-existing tests and plan the merge (AC: CONSOL-1, CONSOL-3)**
  - [x] 1.1 List every `[Fact]` in the 3 source files with method name + line range. Keep the list in the PR description or as a scratch file; confirm nothing is dropped later
  - [x] 1.2 Identify duplicated helpers (`RegisterAndLoginAsync`, `CreatePropertyAsync`, `CreateExpenseAsync`, `GetWithAuthAsync`, `PostAsJsonWithAuthAsync`, `DeleteWithAuthAsync`) — pick one canonical shape (use the most expressive signatures: `CreatePropertyAsync(accessToken, name = "Test Property")` and `CreateExpenseAsync(propertyId, accessToken, amount, description, date?, categoryId?)` — matches existing usage)
  - [x] 1.3 Identify duplicated response records (`CreateExpenseResponse`, `ExpenseCategoriesResponse`, `PagedExpenseListResponse`, `DuplicateCheckResponse`, `DuplicateExpenseResponse`) — they currently live at bottom of `ExpensesControllerDeleteTests.cs` and `ExpensesControllerGetAllTests.cs`. Consolidate into one list at the bottom of the new file. Collisions across files mean these are currently ambiguous at compile time — check `git log -p` on those files; if `CreateExpenseResponse` is defined twice today, that's a bug the consolidation fixes
  - [x] 1.4 Confirm `CreatePropertyResponse` + `LoginResponse` live in `PropertiesControllerTests.cs` (line ~1029). Consolidated file can reference them directly (same assembly) or redeclare if partial-class split is used

- [x] **Task 2: Create `ExpensesControllerTests.cs` skeleton and migrate pre-existing tests (AC: CONSOL-1, CONSOL-2, CONSOL-3, AUTH-1)**
  - [x] 2.1 Create `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` — class `ExpensesControllerTests` using `IClassFixture<PropertyManagerWebApplicationFactory>`, same shape as `MaintenanceRequestsControllerTests.cs`
  - [x] 2.2 Copy the 11 CheckDuplicate tests under `#region GET /expenses/check-duplicate`
  - [x] 2.3 Copy the 8 Delete tests under `#region DELETE /expenses/{id}`
  - [x] 2.4 Copy the 16 GetAll tests under `#region GET /expenses`
  - [x] 2.5 Consolidate helpers + response records at the bottom of the file (or in a `#region Helpers` at top — follow whichever convention is cleanest). Use `file record` for response DTOs per 21.1/21.2 convention; use `private sealed record` only if nested inside class as method return type
  - [x] 2.6 Delete the 3 old test files: `ExpensesControllerCheckDuplicateTests.cs`, `ExpensesControllerDeleteTests.cs`, `ExpensesControllerGetAllTests.cs`
  - [x] 2.7 Run `dotnet test --filter "FullyQualifiedName~ExpensesControllerTests"` and confirm all 35 pre-existing tests still pass (same count, same behavior)

- [x] **Task 3: Auth coverage (AC: AUTH-1, AUTH-2)**
  - [x] 3.1 Add 401 tests for any endpoint not already covered in the preserved set: POST, PUT, GetById, GetByProperty, LinkReceipt, UnlinkReceipt, Totals, ExpenseCategories. (Note: DELETE/{id}, GET /expenses, check-duplicate already have 401 tests from the preserved set)
  - [x] 3.2 Add a single 403 test: `AllEndpoints_AsContributor_Returns403` — authenticate as a Contributor (use `CreateTestUserInAccountAsync(accountId, email, password, role: "Contributor")`) and hit any one representative endpoint. A single test is sufficient because the class-level policy applies to all endpoints identically

- [x] **Task 4: POST /api/v1/expenses tests (AC: CR-1 through CR-8)**
  - [x] 4.1 `CreateExpense_WithoutAuth_Returns401` (AC-AUTH-1 for POST — if not in preserved set)
  - [x] 4.2 `CreateExpense_AsOwner_ValidBody_Returns201WithIdAndLocation`
  - [x] 4.3 `CreateExpense_Persists_WithCorrectFields`
  - [x] 4.4 `CreateExpense_TrimsDescriptionWhitespace`
  - [x] 4.5 `CreateExpense_WithWorkOrderOnSameProperty_Returns201`
  - [x] 4.6 `CreateExpense_NonExistentProperty_Returns404`
  - [x] 4.7 `CreateExpense_CrossAccountProperty_Returns404`
  - [x] 4.8 `CreateExpense_NonExistentCategory_Returns404`
  - [x] 4.9 `CreateExpense_NonExistentWorkOrder_Returns404`
  - [x] 4.10 `CreateExpense_WorkOrderOnDifferentProperty_Returns400_WithMessage`
  - [x] 4.11 `CreateExpense_AmountZero_Returns400_WithValidationMessage` — assert `content.errors["Amount"]` contains "Amount must be greater than $0"
  - [x] 4.12 `CreateExpense_AmountNegative_Returns400`
  - [x] 4.13 `CreateExpense_AmountOverMax_Returns400`
  - [x] 4.14 `CreateExpense_AmountTooManyDecimals_Returns400`
  - [x] 4.15 `CreateExpense_FutureDate_Returns400`
  - [x] 4.16 `CreateExpense_EmptyPropertyId_Returns400`
  - [x] 4.17 `CreateExpense_EmptyCategoryId_Returns400`
  - [x] 4.18 `CreateExpense_DescriptionOver500Chars_Returns400`
  - [x] 4.19 `CreateExpense_DescriptionContainsHtml_Returns400`
  - [x] 4.20 `CreateExpense_EmptyWorkOrderId_Returns400`

- [x] **Task 5: PUT /api/v1/expenses/{id} tests (AC: PUT-1 through PUT-10)**
  - [x] 5.1 `UpdateExpense_WithoutAuth_Returns401`
  - [x] 5.2 `UpdateExpense_AsOwner_ValidBody_Returns204`
  - [x] 5.3 `UpdateExpense_Persists_UpdatedFields_AndPreservesCreatedAt`
  - [x] 5.4 `UpdateExpense_SetsUpdatedAt`
  - [x] 5.5 `UpdateExpense_PropertyReassignment_Succeeds`
  - [x] 5.6 `UpdateExpense_PropertyReassignment_CrossAccount_Returns404`
  - [x] 5.7 `UpdateExpense_ClearsWorkOrderId_WhenNullInBody`
  - [x] 5.8 `UpdateExpense_NonExistentId_Returns404`
  - [x] 5.9 `UpdateExpense_CrossAccount_Returns404`
  - [x] 5.10 `UpdateExpense_SoftDeleted_Returns404`
  - [x] 5.11 `UpdateExpense_NonExistentCategory_Returns404`
  - [x] 5.12 `UpdateExpense_WorkOrderOnDifferentProperty_Returns400`
  - [x] 5.13 `UpdateExpense_ValidationErrors_Return400` — mirror AC-CR-8 matrix where applicable (Amount, Date, CategoryId, Description, WorkOrderId, PropertyId validation)

- [x] **Task 6: GET /api/v1/expenses/{id} tests (AC: GETBYID-1 through GETBYID-4)**
  - [x] 6.1 `GetExpenseById_WithoutAuth_Returns401`
  - [x] 6.2 `GetExpenseById_AsOwner_Returns200_WithFullDto` (including category name + schedule E line)
  - [x] 6.3 `GetExpenseById_WithWorkOrder_IncludesWorkOrderFields`
  - [x] 6.4 `GetExpenseById_NonExistent_Returns404`
  - [x] 6.5 `GetExpenseById_CrossAccount_Returns404`
  - [x] 6.6 `GetExpenseById_SoftDeleted_Returns404` — kept as `DeleteExpense_GetByIdReturns404` under DELETE region (cross-references AC-GETBYID-4)

- [x] **Task 7: GET /api/v1/properties/{id}/expenses tests (AC: PROP-1 through PROP-5)**
  - [x] 7.1 `GetExpensesByProperty_WithoutAuth_Returns401`
  - [x] 7.2 `GetExpensesByProperty_ReturnsPagedWithYtdTotal_OrderedByDateDesc`
  - [x] 7.3 `GetExpensesByProperty_YearFilter_ReturnsMatching`
  - [x] 7.4 `GetExpensesByProperty_NonExistentProperty_Returns404`
  - [x] 7.5 `GetExpensesByProperty_CrossAccountProperty_Returns404`
  - [x] 7.6 `GetExpensesByProperty_EmptyProperty_ReturnsZeroYtdTotal`
  - [x] 7.7 `GetExpensesByProperty_Pagination_Page2PageSize2`
  - [x] 7.8 `GetExpensesByProperty_PageSizeOverMax_ClampedTo100`
  - [x] 7.9 `GetExpensesByProperty_PageSizeZero_Clamped` — verified `Math.Clamp(0, 1, 100) == 1` in handler (line 75)

- [x] **Task 8: POST /api/v1/expenses/{id}/link-receipt tests (AC: LINK-1 through LINK-7)**
  - [x] 8.1 Added `SeedReceiptAsync(accountId, createdByUserId, propertyId?, processedAt?, expenseId?)` helper that inserts a `Receipt` row directly via `AppDbContext`
  - [x] 8.2 `LinkReceipt_WithoutAuth_Returns401`
  - [x] 8.3 `LinkReceipt_HappyPath_Returns204_AndSetsBothFkSides_AndProcessedAt`
  - [x] 8.4 `LinkReceipt_ReceiptHadNullPropertyId_InheritsExpensePropertyId`
  - [x] 8.5 `LinkReceipt_ReceiptAlreadyHadPropertyId_Unchanged`
  - [x] 8.6 `LinkReceipt_EmptyReceiptId_Returns400` (validator `NotEmpty`)
  - [x] 8.7 `LinkReceipt_NonExistentExpense_Returns404`
  - [x] 8.8 `LinkReceipt_CrossAccountExpense_Returns404`
  - [x] 8.9 `LinkReceipt_NonExistentReceipt_Returns404`
  - [x] 8.10 `LinkReceipt_ExpenseAlreadyHasReceipt_Returns409`
  - [x] 8.11 `LinkReceipt_ReceiptAlreadyProcessed_Returns409`

- [x] **Task 9: DELETE /api/v1/expenses/{id}/receipt (Unlink) tests (AC: UNLINK-1 through UNLINK-5)**
  - [x] 9.1 `UnlinkReceipt_WithoutAuth_Returns401`
  - [x] 9.2 `UnlinkReceipt_HappyPath_Returns204_AndClearsBothSides_AndClearsProcessedAt`
  - [x] 9.3 `UnlinkReceipt_NonExistentExpense_Returns404`
  - [x] 9.4 `UnlinkReceipt_ExpenseHasNoReceipt_Returns404`
  - [x] 9.5 `UnlinkReceipt_CrossAccountExpense_Returns404`
  - [x] 9.6 `UnlinkReceipt_DoubleCall_ReturnsSecond404`

- [x] **Task 10: GET expense aux endpoints — totals + categories (AC: TOTALS-*, CATS-1)**
  - [x] 10.1 `GetExpenseTotals_WithoutAuth_Returns401`
  - [x] 10.2 `GetExpenseTotals_WithYear_ReturnsTotals_AndByPropertyBreakdown`
  - [x] 10.3 `GetExpenseTotals_NoYear_DefaultsToCurrentYear`
  - [x] 10.4 `GetExpenseTotals_EmptyAccount_ReturnsZero`
  - [x] 10.5 `GetExpenseTotals_CrossAccount_DoesNotLeak`
  - [x] 10.6 `GetExpenseCategories_WithoutAuth_Returns401`
  - [x] 10.7 `GetExpenseCategories_Returns200_WithAllSeededCategories` — 15 categories per `20251129215839_InitialCreate.cs` (no additional inserts in later migrations)

- [x] **Task 11: GET /api/v1/expenses — NEW tests (sort + property filter + pagination extras) (AC: GET-ALL-NEW-1 through GET-ALL-NEW-7)**
  - [x] 11.1 `GetAllExpenses_SortByAmountDescending_ReturnsOrdered`
  - [x] 11.2 `GetAllExpenses_SortByAmountAscending_ReturnsOrdered`
  - [x] 11.3 `GetAllExpenses_PropertyIdFilter_ReturnsMatching`
  - [x] 11.4 `GetAllExpenses_MultipleCategoryIds_ReturnsUnion`
  - [x] 11.5 `GetAllExpenses_PageBeyondLast_ReturnsEmptyItems`
  - [x] 11.6 `GetAllExpenses_PageSizeOverMax_ClampedTo100`
  - [x] 11.7 `GetAllExpenses_TotalAmountReturnedAccurately`

- [x] **Task 12: Full suite + sanity (AC: all)**
  - [x] 12.1 All pre-existing 35 tests + new tests pass (114 total in the consolidated file)
  - [x] 12.2 Full backend suite (`dotnet test` from `backend/`) still green — 0 failures, 0 new warnings (1970 total pass)
  - [x] 12.3 Exactly one `ExpensesControllerTests.cs` file exists in `backend/tests/PropertyManager.Api.Tests/`; the 3 old files are gone
  - [x] 12.4 No production code under `backend/src/` modified (test-only story)
  - [x] 12.5 `dotnet build` succeeds
  - [x] 12.6 File is 2616 lines — partial-class split is an OPTIONAL variant per AC-CONSOL-2; keeping single file (matches single-class convention used for `MaintenanceRequestsControllerTests.cs`, and the `#region` headers provide adequate navigation)

## Dev Notes

### Test Scope

This is a pure test-writing story. The deliverable IS integration tests.

- **Unit tests:** Not required — handler-level unit tests for `CreateExpense`, `UpdateExpense`, `DeleteExpense`, `GetExpense`, `GetExpensesByProperty`, `LinkReceiptToExpense`, `UnlinkReceipt`, `CheckDuplicateExpense`, `GetAllExpenses`, `GetExpenseTotals`, `GetExpenseCategories` already exist in `backend/tests/PropertyManager.Application.Tests/Expenses/` (confirm during dev; if a specific handler lacks unit coverage, that's a follow-up story — NOT in scope here).
- **Integration tests:** **Required — this IS the story.** Eleven endpoints on `ExpensesController`; 3 of them have fragmented coverage today; 6 have zero. The consolidation + backfill closes the gap.
- **E2E tests:** Not required — expense-flow E2E coverage already exists at `frontend/e2e/tests/expense-flow.spec.ts` and is not in scope here. This story is backend-only.

### Pattern Reference — mirror Story 21.1 / 21.2

Primary pattern: `backend/tests/PropertyManager.Api.Tests/MaintenanceRequestsControllerTests.cs` (Story 21.1) and `MaintenanceRequestPhotosControllerTests.cs` (Story 21.2). Both merged recently (PRs #372 and #373). Read them end-to-end first. Key conventions:

- `IClassFixture<PropertyManagerWebApplicationFactory>` (shared Testcontainers Postgres per test class)
- Naming: `Method_Scenario_ExpectedResult` (or `Endpoint_Scenario_ExpectedResult`)
- FluentAssertions (`response.StatusCode.Should().Be(...)`, `content.Items.Should().HaveCount(...)`)
- Unique per-test emails: `$"owner-{Guid.NewGuid():N}@example.com"` avoid collisions in shared Postgres container
- Per-test data via `AppDbContext` scope: `using var scope = _factory.Services.CreateScope(); var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();`
- Verification reads that need to see soft-deleted rows use `.IgnoreQueryFilters()`
- Response DTOs defined as `file record` at the bottom of the file — do NOT reuse Application DTOs. HTTP contract drift should break these tests loudly.

### Factory — no changes needed

`PropertyManagerWebApplicationFactory` already has everything required:
- `CreateTestUserAsync(email, password?, role?)` → new account, user with role (default Owner)
- `CreateTestUserInAccountAsync(accountId, email, password?, role?)` → same-account additional user (use for Contributor 403 test — AC-AUTH-2 — with `role: "Contributor"`)
- `CreatePropertyInAccountAsync(accountId, name?, street?, ...)` → bypasses API; useful for seed-only properties
- `FakeEmailService`, `FakeStorageService` registered — not relevant for this story beyond test hygiene

**Do not modify the factory.** If you find a missing helper (e.g., "seed an Expense directly"), add it as a private helper inside `ExpensesControllerTests.cs` — the factory is shared infrastructure; keep it stable.

### Seeding receipts for link/unlink tests

Receipts are created via the `/api/v1/receipts` endpoints in real flows, but for integration tests we seed directly via `AppDbContext` to avoid the S3 upload choreography:

```csharp
private async Task<Guid> SeedReceiptAsync(
    Guid accountId,
    Guid createdByUserId,
    Guid? propertyId = null,
    DateTime? processedAt = null,
    Guid? expenseId = null)
{
    using var scope = _factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var receipt = new Receipt
    {
        AccountId = accountId,
        PropertyId = propertyId,
        StorageKey = $"{accountId}/receipts/{Guid.NewGuid()}.jpg",
        OriginalFileName = "receipt.jpg",
        ContentType = "image/jpeg",
        FileSizeBytes = 1024,
        CreatedByUserId = createdByUserId,
        ProcessedAt = processedAt,
        ExpenseId = expenseId,
    };
    dbContext.Receipts.Add(receipt);
    await dbContext.SaveChangesAsync();
    return receipt.Id;
}
```

Note: `Receipt.CreatedAt` and `UpdatedAt` are set by the audit interceptor — don't set them explicitly unless you need a specific value.

### Seeding work orders for link tests

For `AC-CR-3`, `AC-CR-7`, `AC-PUT-9`, you need a `WorkOrder`. Read `WorkOrder` entity + any existing test that seeds one (e.g., `WorkOrdersControllerTests.cs` helper) — reuse that pattern. Typical fields: `AccountId`, `PropertyId`, `Description`, `Status`, `VendorId?`, `DueDate?`, `CreatedByUserId`. If no existing helper is reusable, create `SeedWorkOrderAsync(accountId, propertyId, description = "Test WO")` following the same direct-EF pattern as receipts.

### Exception → HTTP mapping (read before coding)

`backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs` (lines 109-159):

| Exception | HTTP status |
|---|---|
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `ForbiddenAccessException` | 403 |
| `UnauthorizedAccessException` | 403 |
| `BusinessRuleException` | 400 |
| `ArgumentException` | 400 |
| `DomainValidationException` | 400 |
| `FluentValidation.ValidationException` | 400 |

**Don't hardcode 400 without confirming which path fires.** Some handlers throw `NotFoundException` where the epic text says "400 for invalid input" — trust the code.

### ExpensesController permissions

- Class-level attributes (ExpensesController.cs line 15-19):
  - `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]` → 401 without token
  - `[Authorize(Policy = "CanAccessExpenses")]` → 403 without `Expenses.View` permission
- `CanAccessExpenses` requires `Permissions.Expenses.View` (Program.cs line 165)
- **Who has `Expenses.View`?** Only Owner (see `RolePermissions.cs`). Contributor, Tenant, any other role → **403 on every endpoint, regardless of route**
- This means a single AC-AUTH-2 test is sufficient — the policy applies uniformly

### Pre-existing test files — exact inventory

Before deleting the old files, confirm this inventory matches. If a test has been added/modified since this story was written, merge the change into the consolidated file.

**`ExpensesControllerCheckDuplicateTests.cs` (11 tests + 2 response records):**
- `CheckDuplicate_WithoutAuth_Returns401`
- `CheckDuplicate_MissingPropertyId_Returns400`
- `CheckDuplicate_MissingAmount_Returns400`
- `CheckDuplicate_MissingDate_Returns400`
- `CheckDuplicate_MissingAllParams_Returns400`
- `CheckDuplicate_DuplicateFound_ReturnsIsDuplicateTrue`
- `CheckDuplicate_NoDuplicate_ReturnsIsDuplicateFalse`
- `CheckDuplicate_DateWithin24Hours_ReturnsDuplicate`
- `CheckDuplicate_DateMoreThan24HoursApart_ReturnsNoDuplicate`
- `CheckDuplicate_DifferentAmount_ReturnsNoDuplicate`
- `CheckDuplicate_DifferentProperty_ReturnsNoDuplicate`
- `CheckDuplicate_OtherUserExpense_NotDetected`
- Records: `DuplicateCheckResponse`, `DuplicateExpenseResponse`

**`ExpensesControllerDeleteTests.cs` (8 tests + 2 response records):**
- `DeleteExpense_WithoutAuth_Returns401`
- `DeleteExpense_ValidExpense_Returns204`
- `DeleteExpense_ValidExpense_SetsDeletedAt`
- `DeleteExpense_NonExistentExpense_Returns404`
- `DeleteExpense_OtherAccountExpense_Returns404`
- `DeleteExpense_AlreadyDeleted_Returns404`
- `DeleteExpense_ExcludedFromGetByProperty`
- `DeleteExpense_GetByIdReturns404`
- Records: `CreateExpenseResponse`, `ExpenseCategoriesResponse` ← **note: collides with `ExpensesControllerGetAllTests.cs` which also defines `PagedExpenseListResponse`. Confirm how the current build handles this — possibly `internal` or identical declarations.**

**`ExpensesControllerGetAllTests.cs` (16 tests + 1 response record):**
- `GetAllExpenses_WithoutAuth_Returns401`
- `GetAllExpenses_NoExpenses_ReturnsEmptyList`
- `GetAllExpenses_WithExpenses_ReturnsPaginated`
- `GetAllExpenses_IncludesPropertyName`
- `GetAllExpenses_SortedByDateDescending`
- `GetAllExpenses_WithPageSize_RespectsPageSize`
- `GetAllExpenses_WithPage_ReturnsCorrectPage`
- `GetAllExpenses_WithYearFilter_ReturnsMatchingYear`
- `GetAllExpenses_WithDateRange_ReturnsMatchingDates`
- `GetAllExpenses_WithCategoryFilter_ReturnsMatchingCategory`
- `GetAllExpenses_WithSearchFilter_ReturnsMatchingDescription`
- `GetAllExpenses_SearchFilter_CaseInsensitive`
- `GetAllExpenses_MultipleFilters_ReturnsIntersection`
- `GetAllExpenses_NoMatches_ReturnsEmptyList`
- `GetAllExpenses_MultipleProperties_ReturnsAll`
- `GetAllExpenses_OtherUserExpenses_NotVisible`
- Records: `PagedExpenseListResponse`

**Total pre-existing:** 35 `[Fact]`s. **New in this story:** ~60-80 additional tests. **Final count target:** ~100-115 tests in one file.

### Duplicate response records — IMPORTANT

The existing files declare `CreateExpenseResponse(Guid Id)` in both `ExpensesControllerDeleteTests.cs` (line 286) AND the `CheckDuplicateTests.cs` via `ExpenseCategoriesResponse` (line 323). If these are top-level `public record`s in the same assembly, there would be a compile error — meaning either (a) they're `internal`, (b) they're scoped differently than they appear, or (c) only one is referenced. **Verify during dev** by running `dotnet build` on the current state; if it builds today, the declarations are compatible — but after consolidation into one file, declare each record exactly once. Use `file record` for this file's response DTOs; if they need to be reused by another controller test file later, promote to `internal record` in a shared location (not in this story).

### Test data seeding — use the seed ExpenseCategory, don't create one

`ExpenseCategories` are seeded by a migration (global, not per-account). Fetch one at the start of a test:
```csharp
var categoriesResponse = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
var categories = await categoriesResponse.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
var firstCategory = categories!.Items[0];
var repairsCategory = categories!.Items.First(c => c.Name == "Repairs");
```

For `AC-CR-5` (non-existent category), use `CategoryId = Guid.NewGuid()`. The category doesn't exist, so handler returns 404.

### Sort-by options (AC-GET-ALL-NEW-1/2)

Per `GetAllExpenses.cs` line 128-139, valid `sortBy` values are:
- `"amount"` — sort by expense amount
- `"property"` — sort by property name
- `"category"` — sort by category name
- `"description"` — sort by description
- anything else (or null) → default sort by `Date`

`sortDirection` case-insensitive comparison against `"asc"`; anything else (including `"desc"` or null) → descending.

### Previous Story Intelligence

**Story 21.1 (done, PR #372)** — Introduced the `MaintenanceRequestsControllerTests` file pattern. Key takeaways applied here:
1. Per-test unique emails prevent PostgreSQL uniqueness collisions
2. `CreatePropertyInAccountAsync` and `CreateTenantUserInAccountAsync` already live on the factory — reuse
3. Nested record types as return values must be `private sealed record` (CS9051 if `file record` is used as member signature)
4. Assertion pattern: scope-per-read (`using var scope = _factory.Services.CreateScope()`) — DO NOT hold the DbContext across the HTTP call

**Story 21.2 (done, PR #373)** — Extended the pattern for photo/upload flows. Key insight: `FakeStorageService.DeletedKeys` is a singleton that accumulates across tests. Not relevant to this story (no photo/storage operations on ExpensesController), but if any test ends up touching receipts that trigger storage deletes, use the snapshot-and-delta pattern.

**Story 15.4 (done)** — Fixed the UnlinkReceipt bug (Issue #210). The handler now clears both FK sides. AC-UNLINK-1 explicitly tests the fix — this is regression insurance.

**Story 15.5 (done)** — Built the expense detail/edit page UI. The UI calls `GET /expenses/{id}`, `PUT /expenses/{id}`, `DELETE /expenses/{id}`. Our GET-by-id and PUT tests verify the contract that UI depends on.

### Git / PR intelligence

- PR #372 (Story 21.1, merged 2026-04-19) — 27 tests, single file, 783 lines
- PR #373 (Story 21.2, merged 2026-04-19) — 47 tests, single file, ~850 lines
- PR #233 (Story 15.5) — added `GET /expenses/{id}`, `PUT /expenses/{id}`, `GET /expenses/check-duplicate` logic; integration coverage only for `check-duplicate`
- PR #242 (Issue #235) — added `PUT /expenses/{id}` work-order linking support; no integration tests added

Confirm no concurrent work by `gh pr list --state open --search "ExpensesController"` before opening the PR.

### File to create

- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` — single file, one class `ExpensesControllerTests`, likely ~1000-1200 lines. If exceeding ~1200 lines post-migration, split into partial classes: `ExpensesControllerTests.Create.cs`, `ExpensesControllerTests.Update.cs`, `ExpensesControllerTests.Receipt.cs`, sharing the primary `ExpensesControllerTests` class via `partial`. All share one `IClassFixture<PropertyManagerWebApplicationFactory>` — no separate fixtures.

### Files to delete

- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerCheckDuplicateTests.cs`
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerDeleteTests.cs`
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerGetAllTests.cs`

### Files NOT to modify

- Any production code in `backend/src/` — test-only story
- `PropertyManagerWebApplicationFactory.cs` — no factory extensions needed
- Other test files (VendorsController*, MaintenanceRequests*, Properties*, etc.)

### References

- [ExpensesController.cs (controller)](../../backend/src/PropertyManager.Api/Controllers/ExpensesController.cs) — all 11 endpoints, permission policy
- [CreateExpense.cs](../../backend/src/PropertyManager.Application/Expenses/CreateExpense.cs) — AC-CR-* behavior
- [CreateExpenseValidator.cs](../../backend/src/PropertyManager.Application/Expenses/CreateExpenseValidator.cs) — AC-CR-8 validation matrix + messages
- [UpdateExpense.cs](../../backend/src/PropertyManager.Application/Expenses/UpdateExpense.cs) — AC-PUT-* behavior, property reassignment
- [UpdateExpenseValidator.cs](../../backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs) — AC-PUT-10 validation
- [DeleteExpense.cs](../../backend/src/PropertyManager.Application/Expenses/DeleteExpense.cs) — soft-delete behavior (existing tests)
- [GetExpense.cs](../../backend/src/PropertyManager.Application/Expenses/GetExpense.cs) — GetById DTO shape (AC-GETBYID-1/2)
- [GetExpensesByProperty.cs](../../backend/src/PropertyManager.Application/Expenses/GetExpensesByProperty.cs) — `/properties/{id}/expenses` ordering + YtdTotal
- [GetAllExpenses.cs](../../backend/src/PropertyManager.Application/Expenses/GetAllExpenses.cs) — sort-by options, pagination clamping
- [GetExpenseTotals.cs](../../backend/src/PropertyManager.Application/Expenses/GetExpenseTotals.cs) — Totals breakdown shape
- [GetExpenseCategories.cs](../../backend/src/PropertyManager.Application/Expenses/GetExpenseCategories.cs) — seeded categories
- [LinkReceiptToExpense.cs](../../backend/src/PropertyManager.Application/Expenses/LinkReceiptToExpense.cs) — AC-LINK-* behavior, 409 paths
- [UnlinkReceipt.cs](../../backend/src/PropertyManager.Application/Expenses/UnlinkReceipt.cs) — AC-UNLINK-* (Story 15.4 fix)
- [CheckDuplicateExpense.cs](../../backend/src/PropertyManager.Application/Expenses/CheckDuplicateExpense.cs) — duplicate detection window
- [GlobalExceptionHandlerMiddleware.cs](../../backend/src/PropertyManager.Api/Middleware/GlobalExceptionHandlerMiddleware.cs) — exception → HTTP mapping
- [Permissions.cs](../../backend/src/PropertyManager.Domain/Authorization/Permissions.cs) — `Expenses.View/Create/Edit/Delete`
- [RolePermissions.cs](../../backend/src/PropertyManager.Domain/Authorization/RolePermissions.cs) — Only Owner has `Expenses.*`
- [PropertyManagerWebApplicationFactory.cs](../../backend/tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs) — factory helpers
- [MaintenanceRequestsControllerTests.cs (Story 21.1)](./21-1-maintenance-requests-controller-integration-tests.md) — PRIMARY PATTERN REFERENCE
- [MaintenanceRequestPhotosControllerTests.cs (Story 21.2)](./21-2-maintenance-request-photos-controller-integration-tests.md) — secondary pattern reference
- [ExpensesControllerCheckDuplicateTests.cs (existing)](../../backend/tests/PropertyManager.Api.Tests/ExpensesControllerCheckDuplicateTests.cs) — to be consolidated
- [ExpensesControllerDeleteTests.cs (existing)](../../backend/tests/PropertyManager.Api.Tests/ExpensesControllerDeleteTests.cs) — to be consolidated
- [ExpensesControllerGetAllTests.cs (existing)](../../backend/tests/PropertyManager.Api.Tests/ExpensesControllerGetAllTests.cs) — to be consolidated
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic
- [Story 15.4 (done)](../epic-15/15-4-fix-unlink-receipt-backend-bug.md) — unlink receipt fix; AC-UNLINK-1 is regression insurance for it
- [ASP.NET Core 10 Integration Tests (Microsoft Learn)](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit)
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- Full backend test suite (`dotnet test` from `backend/`): 683 API + 98 Infrastructure + 1189 Application = **1970 passed, 0 failed**.
- Targeted run (`dotnet test --filter "FullyQualifiedName~ExpensesControllerTests"`): **114 passed, 0 failed**.
- `dotnet build` (Api.Tests project): clean, 1 pre-existing warning (PostgreSqlBuilder obsolete in the factory — out of scope for this story).

### Completion Notes List

- Created single consolidated file `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` (2616 lines, 114 `[Fact]` methods).
- Deleted the 3 old split files: `ExpensesControllerCheckDuplicateTests.cs`, `ExpensesControllerDeleteTests.cs`, `ExpensesControllerGetAllTests.cs`.
- All 35 pre-existing tests preserved verbatim (bodies + assertions); they now live under `#region` blocks matching the endpoint they exercise.
- Structure uses `#region` headers per endpoint group (AC-CONSOL-2). Did NOT split into partial classes (single file remains manageable with regions for navigation; partial split is a permitted variant, not required).
- Response records declared ONCE as `file record` at the bottom of the file (no cross-file collisions). `CreatePropertyResponse` and `LoginResponse` are reused from `PropertiesControllerTests.cs` (same assembly, `public record`).
- Helper `SeedReceiptAsync` added locally to the test class for direct-EF receipt seeding (bypasses the S3 upload choreography per Dev Notes).
- Helper `GetAccountIdForUserAsync` added to retrieve `AccountId` from `ApplicationUser` for seeding tests — matches the test file's convention of scope-per-read.
- Helper `CreateWorkOrderAsync` talks to the real `/api/v1/work-orders` endpoint (matches `ExpenseWorkOrderIntegrationTests.cs` pattern).
- Confirmed 15 IRS Schedule E categories are seeded in `20251129215839_InitialCreate.cs`; no additional inserts in later migrations. AC-CATS-1 asserts `Items.Count == 15` and spot-checks "Repairs" and "Utilities".
- Confirmed in `GetExpensesByProperty.cs` line 75: `Math.Clamp(pageSize, 1, 100)` with `pageSize=0` → clamps to `1`. AC-PROP-5's Task 7.9 asserts `PageSize == 1`.
- No production code under `backend/src/` modified. No factory changes required.
- No new EF Core migrations created.

### File List

**Created:**
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerTests.cs` (single consolidated test file, 114 tests)

**Deleted:**
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerCheckDuplicateTests.cs`
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerDeleteTests.cs`
- `backend/tests/PropertyManager.Api.Tests/ExpensesControllerGetAllTests.cs`

**Modified:**
- `docs/project/stories/epic-21/21-3-expenses-controller-integration-consolidation.md` (task checkboxes, status → review, Dev Agent Record)
- `docs/project/sprint-status.yaml` (story 21.3 status → review)
