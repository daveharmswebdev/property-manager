# Story 21.11: Validation Message Assertion Improvements

Status: done

## Story

As a developer,
I want existing FluentValidation unit tests and Angular reactive form component tests to assert the **exact validation error message text** (not just "validation failed" or `form.invalid === true`),
so that a future edit to a validator's `.WithMessage(...)` string or to a control's error template surfaces as a failing test instead of silently slipping past CI.

## Acceptance Criteria

> **Reality check (epic vs. shipped tests) — read this before changing any assertion.**
>
> The epic spec at `epic-21-epics-test-coverage.md` § Story 21.11 says "existing tests often assert 'validation fails' without asserting the specific message" and that this story tightens those assertions across the existing corpus with **no new test files or test cases** (epic AC-3). A repo-wide audit (April 2026) of every `*ValidatorTests.cs` and every component spec referencing `hasError(...)`, `form.invalid`, or `mat-error` was completed during story creation. The findings:
>
> 1. **Backend validator tests fall into three buckets** based on assertion strength:
>    - **Strong (already use `WithErrorMessage` via `FluentValidation.TestHelper.TestValidate(...)` extension):** `Vendors/CreateVendorValidatorTests.cs`, `Vendors/UpdateVendorValidatorTests.cs`, `Vendors/DeleteVendorValidatorTests.cs`, `Receipts/GenerateUploadUrlValidatorTests.cs`, `Income/CreateIncomeValidatorTests.cs`, `WorkOrders/CreateWorkOrderValidatorTests.cs`, `WorkOrders/UpdateWorkOrderValidatorTests.cs`, `WorkOrders/ReorderWorkOrderPhotosValidatorTests.cs`, `Photos/ConfirmPhotoUploadValidatorTests.cs`, `Photos/GeneratePhotoUploadUrlValidatorTests.cs`, `AccountUsers/UpdateUserRoleValidatorTests.cs`. **Out of scope for this story** — already meet the bar.
>    - **Mixed (strong on some `[Fact]`s; weak — `PropertyName`-only or `ErrorMessage.Contains("...")` substring — on others):** `Properties/CreatePropertyValidatorTests.cs`, `Expenses/UpdateExpenseValidatorTests.cs`, `Income/UpdateIncomeValidatorTests.cs`, `MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs`, `Notes/CreateNoteCommandValidatorTests.cs`, `Invitations/CreateInvitationTests.cs`, `Invitations/ValidateInvitationTests.cs`, `Invitations/ResendInvitationTests.cs`, `WorkOrderTags/CreateWorkOrderTagValidatorTests.cs`, `VendorTradeTags/CreateVendorTradeTagValidatorTests.cs`, `WorkOrders/GetAllWorkOrdersValidatorTests.cs`, `Expenses/LinkReceiptToExpenseValidatorTests.cs`. **In scope.**
>    - **Weak across the whole file (every "fails" assertion is `PropertyName`-only):** `MaintenanceRequestPhotos/ValidatorTests.cs`, `PropertyPhotos/ValidatorTests.cs`, `VendorPhotos/ValidatorTests.cs`. **In scope.**
>
> 2. **Frontend component specs fall into two buckets:**
>    - **Strong (already query `mat-error` and assert on `nativeElement.textContent`):** `work-orders/components/work-order-form/work-order-form.component.spec.ts`, `vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.spec.ts`, `tenant-dashboard/components/submit-request/submit-request.component.spec.ts`. **Out of scope.**
>    - **Weak (`hasError('xxx')` or `form.invalid` only, no DOM-rendered error text assertion):** `auth/login/login.component.spec.ts`, `auth/forgot-password/forgot-password.component.spec.ts`, `auth/reset-password/reset-password.component.spec.ts`, `auth/accept-invitation/accept-invitation.component.spec.ts`, `expenses/components/expense-form/expense-form.component.spec.ts`, `expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.spec.ts`, `income/components/income-form/income-form.component.spec.ts`, `properties/property-form/property-form.component.spec.ts`, `properties/property-edit/property-edit.component.spec.ts`, `properties/components/invite-tenant-dialog/invite-tenant-dialog.component.spec.ts`, `vendors/components/vendor-form/vendor-form.component.spec.ts`, `vendors/components/vendor-edit/vendor-edit.component.spec.ts`, `work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts`, `receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts`. **In scope.**
>
> 3. **Per epic AC-3, this story adds NO new test files and NO new `[Fact]`/`it(...)` blocks.** Every change is a *strengthened assertion within an existing test*. If during the work the dev finds a validator/template where the rendered error text doesn't match the expected message (or where no `mat-error` actually renders for a control flagged invalid), the validator/template is fixed (not the test) — **don't assert wrong behavior just to make the test pass.**
>
> 4. **The "fix the validator if it's wrong" rule has a corollary: don't change a validator message in a way that breaks any currently-passing test that's already asserting on the exact text.** Read the validator's `.WithMessage("...")` string (or the template's `<mat-error>` text) and use that exact text in the new assertion. The strong-bucket files above are the source of truth for the canonical strings on backend (e.g. `"First name is required"`, `"Phone number is required"`, `"Amount must be greater than $0"`).

### AC-1: Backend FluentValidation tests assert the exact error message on every "fails" assertion

For every validator test file in the **mixed** and **weak** buckets above, every `[Fact]`/`[Theory]` whose assertion currently looks like:

```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(e => e.PropertyName == "X");
```

OR

```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(e => e.PropertyName == "X" && e.ErrorMessage.Contains("substring"));
```

…must be tightened to one of the following two equivalent strict forms (pick whichever keeps the test file's existing style consistent — do not mix styles within a single file):

**Form A — keep `.ValidateAsync` / `.Validate`, tighten the predicate to full-equality:**

```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(e =>
    e.PropertyName == "X" &&
    e.ErrorMessage == "<exact message from validator's .WithMessage(...) call>");
```

**Form B — switch to `FluentValidation.TestHelper.TestValidate` extension:**

```csharp
using FluentValidation.TestHelper;
// ...
var result = _validator.TestValidate(command);
result.ShouldHaveValidationErrorFor(x => x.X)
    .WithErrorMessage("<exact message from validator's .WithMessage(...) call>");
```

- **AC-1.1:** For every "fails" `[Fact]`/`[Theory]` in the in-scope files, the assertion includes the **exact** expected error message (string equality, not `.Contains(...)`) — sourced from reading the corresponding validator's `.WithMessage(...)` calls.
- **AC-1.2:** No `result.Errors.Should().Contain(e => e.ErrorMessage.Contains("..."))` substring-style assertions remain in any in-scope file. (Substring matching is the explicit anti-pattern this story removes.)
- **AC-1.3:** `[Theory]` cases that produce the **same** message across all rows still get exact-message assertions; cases that produce **different** messages across rows are split into separate `[Fact]`s OR the `[Theory]` adds an `expectedMessage` `InlineData` column. Choose whichever pattern matches the file's neighboring tests.
- **AC-1.4:** "Passes" assertions (`result.IsValid.Should().BeTrue()` and `result.Errors.Should().BeEmpty()`) are **not changed** — the story scope is "fails" assertions only. Strengthening positive paths is out of scope.
- **AC-1.5:** If a validator test exercises a rule that has **no `.WithMessage(...)` override** in the validator (i.e., FluentValidation's default localized message), the dev resolves this by reading the FluentValidation default for the rule (e.g., `"'Property X' must not be empty."`) and asserts that exact default. **Don't add a `.WithMessage(...)` to the validator just to satisfy a test** — that's a behavior change, not a test improvement.
- **AC-1.6:** If a validator's actual `.WithMessage(...)` text contains a **typo** or **inconsistency** (e.g., `"Description must be 500 characters or less"` vs. `"Maximum 500 characters"`), the validator is the source of truth — **fix the validator only if the typo is genuinely wrong** (per epic technical-notes guidance). Document any validator change in the Dev Agent Record File List.

### AC-2: Frontend reactive form component tests assert displayed `mat-error` text on every form-validation assertion

For every component spec in the **weak** bucket above, every `it(...)` whose assertion currently looks like:

```typescript
expect(control?.hasError('required')).toBe(true);
// or
expect(form.invalid).toBe(true);
```

…must additionally assert on the rendered `<mat-error>` text in the DOM. The control must be marked-as-touched and `fixture.detectChanges()` called so the `<mat-error>` actually projects. The canonical pattern (already used by the strong-bucket files) is:

```typescript
import { By } from '@angular/platform-browser';

it('should show "X is required" error', () => {
  const control = component['form'].get('x');
  control?.markAsTouched();
  control?.setValue('');
  fixture.detectChanges();

  const error = fixture.debugElement.query(By.css('mat-error'));
  expect(error?.nativeElement.textContent).toContain('X is required');
});
```

When multiple `<mat-error>`s render simultaneously (e.g., several invalid fields), use `queryAll` + `find`:

```typescript
const errors = fixture.debugElement.queryAll(By.css('mat-error'));
const target = errors.find(e => e.nativeElement.textContent.includes('X is required'));
expect(target).toBeTruthy();
```

- **AC-2.1:** For every form-validation `it(...)` in the in-scope frontend specs, the assertion verifies the rendered `<mat-error>` text (via `By.css('mat-error')` query + `nativeElement.textContent`) **in addition to** the existing `hasError(...)` / `form.invalid` assertion. Both assertions stay — the `hasError` check is kept as a fast control-state check; the `mat-error` check pins the user-visible text.
- **AC-2.2:** The expected error text is sourced from the component's `.html` template — read the template's `<mat-error>` blocks to confirm the literal string before writing the assertion.
- **AC-2.3:** If the component template renders error text via `{{ ... }}` interpolation against a localization key or a getter (e.g., `{{ getErrorMessage('email') }}`), assert on the **resolved string** (what the user sees), not the template syntax. Read the getter's source to find the literal.
- **AC-2.4:** If a control is invalid but the template has **no `<mat-error>` block** for that error type (i.e., the control is invalid but the user sees nothing), the gap is a UI defect — **add the `<mat-error>` block to the template** and document in Dev Agent Record. Don't write a test that asserts on missing UI.
- **AC-2.5:** Existing `hasError(...)` assertions are kept — they verify the form-control state. The new `mat-error` assertion is additive (asserts the DOM rendering), not replacement.
- **AC-2.6:** "Pristine/untouched" tests (i.e., tests that confirm errors do **not** show before user interaction) are out of scope — do not change them.

### AC-3: Scope is bounded — no new tests, only tightening existing ones (epic AC-3)

- **AC-3.1:** No new `*ValidatorTests.cs` files are created.
- **AC-3.2:** No new `[Fact]` or `[Theory]` methods are added to existing validator test files. (The number of tests per file stays the same; the assertions inside them get tighter.)
- **AC-3.3:** No new `*.spec.ts` files are created on the frontend.
- **AC-3.4:** No new `it(...)` blocks are added to existing component specs. (The number of tests per file stays the same.)
- **AC-3.5:** No new `describe(...)` blocks are added.
- **AC-3.6:** Validator source files (`backend/src/PropertyManager.Application/**/*Validator.cs`) are **read-only** unless AC-1.6 applies (genuine validator typo found). Same for frontend component templates — read-only unless AC-2.4 applies (missing `<mat-error>` block). Any production-code change is documented in Dev Agent Record File List with a one-line rationale.

### AC-4: All tests still pass after the tightening

- **AC-4.1 (backend filtered run):** `cd backend && dotnet test --filter "FullyQualifiedName~Validator"` passes 100% (no test in any in-scope file fails).
- **AC-4.2 (backend full suite):** `cd backend && dotnet test` — no regression in any non-validator test (allowing for the documented pre-existing `TestControllerTests.Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts` failure noted in Story 21.10).
- **AC-4.3 (frontend full Vitest suite):** `cd frontend && npm test` passes — no regression. Tests that previously asserted on `form.invalid`/`hasError` plus a new `mat-error` query still pass.
- **AC-4.4 (build + lint):** `cd backend && dotnet build` clean (no new warnings). Frontend Prettier formatting preserved.

### AC-5: Test scope justification (process AC — addressed in Dev Notes, not implemented as a test)

- **AC-5.1:** This story is intrinsically a **test-quality** story. Per epic AC-3, **no new tests** are added; only existing assertions are tightened. Therefore:
  - **Unit tests:** REQUIRED — but as **modifications**, not additions. Every change happens inside an existing `[Fact]` / `it(...)`.
  - **Integration tests:** NOT REQUIRED — there is no new or changed API endpoint, no new handler, no new EF Core query path. The story does not modify production behavior; the integration test surface is unchanged.
  - **E2E tests:** NOT REQUIRED — there is no new user-facing flow. The user's experience of the app is identical before and after this story; the only change is that the test suite catches a different class of regression (validator message drift).

## Tasks / Subtasks

- [x] **Task 1: Audit and tighten the 12 mixed-bucket backend validator tests (AC-1, AC-3, AC-4.1)**
  - [x] 1.1 `backend/tests/PropertyManager.Application.Tests/Properties/CreatePropertyValidatorTests.cs` — already strong on most facts; tighten the 2 `PropertyName`-only assertions (`Validate_MissingState_ReturnsValidationError` line 148 → assert exact message; `Validate_MissingZipCode_ReturnsValidationError` line 189 → assert exact message). Read `CreatePropertyCommandValidator.cs` for the `.WithMessage(...)` text on State and ZipCode `NotEmpty`.
  - [x] 1.2 `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseValidatorTests.cs` — tighten the 8 `ErrorMessage.Contains(...)` substring assertions and `PropertyName`-only assertions to exact-string equality. Validator messages source: `backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs` lines 13-39 (each `.WithMessage(...)`).
  - [x] 1.3 `backend/tests/PropertyManager.Application.Tests/Income/UpdateIncomeValidatorTests.cs` — tighten all 11 weak assertions. Validator: `backend/src/PropertyManager.Application/Income/UpdateIncomeValidator.cs`.
  - [x] 1.4 `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs` — currently mostly strong (3 weak assertions at the `PropertyName`-only level). Tighten the remaining 3.
  - [x] 1.5 `backend/tests/PropertyManager.Application.Tests/Notes/CreateNoteCommandValidatorTests.cs` — tighten the 8 weak assertions (mix of `PropertyName`-only and `Contains("required")` / `Contains("must be one of")`). Validator: `backend/src/PropertyManager.Application/Notes/CreateNoteCommandValidator.cs`.
  - [x] 1.6 `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs` — tighten the 9 weak assertions (mix of `PropertyName`-only and `Contains("Invalid email")` / `Contains("required")` / `Contains("only be set for Tenant")`). Validator: `backend/src/PropertyManager.Application/Invitations/CreateInvitationValidator.cs`.
  - [x] 1.7 `backend/tests/PropertyManager.Application.Tests/Invitations/ValidateInvitationTests.cs` — tighten the 2 weak assertions. (No-op: file contains only positive `IsValid.BeTrue()` handler tests; no validator-failure assertions to tighten. Documented in Dev Agent Record.)
  - [x] 1.8 `backend/tests/PropertyManager.Application.Tests/Invitations/ResendInvitationTests.cs` — tighten the 2 weak assertions.
  - [x] 1.9 `backend/tests/PropertyManager.Application.Tests/WorkOrderTags/CreateWorkOrderTagValidatorTests.cs` — tighten the 5 weak assertions.
  - [x] 1.10 `backend/tests/PropertyManager.Application.Tests/VendorTradeTags/CreateVendorTradeTagValidatorTests.cs` — tighten the 5 weak assertions.
  - [x] 1.11 `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersValidatorTests.cs` — tighten the 1 `Errors.Should().ContainSingle()` weak assertion (line 106 — needs to additionally assert the exact error message).
  - [x] 1.12 `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs` — tighten the 3 weak assertions.
  - [x] 1.13 Run `cd backend && dotnet test --filter "FullyQualifiedName~Validator"` — confirm green.

- [x] **Task 2: Tighten the 3 fully-weak photo validator tests (AC-1, AC-3, AC-4.1)**
  - [x] 2.1 `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/ValidatorTests.cs` — every "fails" assertion (~11 occurrences) is `PropertyName`-only. Tighten all to exact-message equality.
  - [x] 2.2 `backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ValidatorTests.cs` — same pattern (~17 occurrences). Tighten all.
  - [x] 2.3 `backend/tests/PropertyManager.Application.Tests/VendorPhotos/ValidatorTests.cs` — same pattern (~17 occurrences). Tighten all.
  - [x] 2.4 Run `dotnet test --filter "FullyQualifiedName~Validator"` — confirm green.

- [x] **Task 3: Tighten the 14 frontend reactive-form component specs (AC-2, AC-3, AC-4.3)**
  - [x] 3.1 `frontend/src/app/features/auth/login/login.component.spec.ts` — 4 `hasError(...)` assertions. Add corresponding `mat-error` text assertions. Source error text from `login.component.html`.
  - [x] 3.2 `frontend/src/app/features/auth/forgot-password/forgot-password.component.spec.ts` — 2 `hasError(...)` assertions. Template: `forgot-password.component.html`.
  - [x] 3.3 `frontend/src/app/features/auth/reset-password/reset-password.component.spec.ts` — 4 `hasError(...)` assertions. Template: `reset-password.component.html`.
  - [x] 3.4 `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.spec.ts` — 3 `hasError(...)` assertions. Template: `accept-invitation.component.html`.
  - [x] 3.5 `frontend/src/app/features/expenses/components/expense-form/expense-form.component.spec.ts` — 6 `hasError(...)` assertions. Template: `expense-form.component.html`.
  - [x] 3.6 `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.spec.ts` — 4 `hasError(...)` assertions. Template: corresponding `.html`.
  - [x] 3.7 `frontend/src/app/features/income/components/income-form/income-form.component.spec.ts` — 5 `hasError(...)` assertions. Template: `income-form.component.html`.
  - [x] 3.8 `frontend/src/app/features/properties/property-form/property-form.component.spec.ts` — 5 `hasError(...)` assertions. Template: `property-form.component.html`.
  - [x] 3.9 `frontend/src/app/features/properties/property-edit/property-edit.component.spec.ts` — 5 `hasError(...)` assertions. Template: `property-edit.component.html`.
  - [x] 3.10 `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.spec.ts` — 2 `hasError(...)` assertions. Template: corresponding `.html`.
  - [x] 3.11 `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts` — 5 `hasError(...)` assertions (note: existing file already mixes `mat-error` queries with `hasError` — keep the strong patterns and ADD `mat-error` queries to the weak ones). Template: `vendor-form.component.html`.
  - [x] 3.12 `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.spec.ts` — 3 `hasError(...)` assertions. Template: `vendor-edit.component.html`.
  - [x] 3.13 `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts` — 1 `hasError` + 1 `form.invalid` assertion. Template: corresponding `.html`.
  - [x] 3.14 `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts` — 5 `hasError(...)` assertions. Template: `receipt-expense-form.component.html`.
  - [x] 3.15 Run `cd frontend && npm test` — confirm full suite green.

- [x] **Task 4: Verify, no regressions, no scope creep (AC-3, AC-4)**
  - [x] 4.1 `cd backend && dotnet build` — clean (zero new warnings).
  - [x] 4.2 `cd backend && dotnet test --filter "FullyQualifiedName~Validator"` — all green; the test count per file is **exactly the same** as on `main` (verify with `git diff --stat main -- backend/tests` and `dotnet test --list-tests --filter ...`).
  - [x] 4.3 `cd backend && dotnet test` — full suite green except documented pre-existing failure.
  - [x] 4.4 `cd frontend && npm test` — full Vitest suite green; the test count per file is **exactly the same** as on `main` (verify via `git diff --stat main -- frontend/src` and a `grep -c "  it(" <spec>` snapshot before/after).
  - [x] 4.5 `git diff --stat main -- backend/src frontend/src` — should be **empty** unless AC-1.6 or AC-2.4 triggered a documented production-code fix. If non-empty, document each touched production file in Dev Agent Record File List with the fix rationale.

- [x] **Task 5: Sprint status + story status update (process)**
  - [x] 5.1 Update `docs/project/sprint-status.yaml`: `21-11-validation-message-assertion-improvements: review` (preserve `# P3 - S - Issue #371` comment).
  - [x] 5.2 Set this story's `Status:` line to `review`.
  - [x] 5.3 Fill out Dev Agent Record below (Agent Model Used, Debug Log References, Completion Notes, File List).

## Dev Notes

### Test Scope

| Layer | Required? | Justification |
|---|---|---|
| **Unit tests (xUnit + Moq + FluentAssertions / Vitest)** | **Required — as MODIFICATIONS to existing tests, not additions** | Per epic AC-3, no new tests are added; existing assertions are tightened. 15 backend validator test files in scope (12 mixed + 3 weak); 14 frontend component specs in scope. Each existing `[Fact]` / `it(...)` gets a strict assertion replacing the loose one (backend) or an additional `mat-error` DOM query (frontend). |
| **Integration tests (.NET WebApplicationFactory)** | **Not required** | This story is a test-quality refactor. There is no new or changed API endpoint, no new handler, no new EF Core query path, no new validation rule. Production code is read-only (except the narrowly-scoped exceptions in AC-1.6 / AC-2.4). The integration test surface is unchanged — therefore no integration test work is in scope. |
| **E2E tests (Playwright)** | **Not required** | There is no new user-facing flow. The user's UX of the app is identical before and after this story; the only change is that the test suite now catches a class of regression (validator message drift / mat-error template drift) that previously slipped past CI. E2E coverage is therefore neither sufficient nor necessary to verify the story's value. |

### Pattern References — mirror these existing files

1. **Backend strong pattern A — `result.Errors.Should().Contain(e => ... && e.ErrorMessage == "...")`:**
   - `backend/tests/PropertyManager.Application.Tests/Properties/CreatePropertyValidatorTests.cs` lines 53, 72, 91, 110, 129, 170, 213 — exact-string-equality predicate inside `.Contain(...)`. Most economical pattern when the file already uses `ValidateAsync(...)` and doesn't import `FluentValidation.TestHelper`.
   - `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs` lines 21, 32 — `e.ErrorMessage == "Description is required"`.
2. **Backend strong pattern B — `FluentValidation.TestHelper`'s `ShouldHaveValidationErrorFor(...).WithErrorMessage(...)` chain:**
   - `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs` lines 51-57 — `_validator.TestValidate(command); result.ShouldHaveValidationErrorFor(x => x.FirstName).WithErrorMessage("First name is required");`. Most economical when the file is converting from `Validate` to `TestValidate` for the whole pass-through.
   - `backend/tests/PropertyManager.Application.Tests/Vendors/UpdateVendorValidatorTests.cs` and `Receipts/GenerateUploadUrlValidatorTests.cs` — same pattern.
3. **Frontend strong pattern — `By.css('mat-error')` + `nativeElement.textContent`:**
   - `frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.spec.ts` lines 258-281 — `markAsTouched()` → `setValue('')` → `fixture.detectChanges()` → `query(By.css('mat-error'))` → `expect(error?.nativeElement.textContent).toContain('Property is required')`. The canonical pattern for single-error visibility.
   - `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.spec.ts` lines 90-118 — `queryAll(By.css('mat-error'))` + `find(...)` for multi-error scenarios.
   - `frontend/src/app/features/tenant-dashboard/components/submit-request/submit-request.component.spec.ts` lines 90-99 — minimal `markAsTouched` + `query(By.css('mat-error'))` + `toContain('...')` pattern.

### How to choose between Form A and Form B (backend)

- **Form A (`Errors.Should().Contain(e => ... && e.ErrorMessage == "...")`):** Use when the test file already uses `_validator.ValidateAsync(...)` or `_validator.Validate(...)` and the rest of the file follows that style. **Lower-friction migration** — change the predicate inside `.Contain(...)`, no other restructure.
- **Form B (`TestValidate(...).ShouldHaveValidationErrorFor(...).WithErrorMessage(...)`):** Use when the test file is being more fully reorganized OR when the assertion needs to chain `.WithSeverity(...)` / `.WithErrorCode(...)` / `.Only()` (rare in this codebase). **More idiomatic** for FluentValidation, but requires `using FluentValidation.TestHelper;` and a switch from `Validate(Async)` to `TestValidate(Async)`.

**Default to Form A.** Only use Form B if the file already uses `TestValidate` (e.g., `CreateVendorValidatorTests.cs`) or if the file's tests are getting heavily restructured for unrelated reasons (which they shouldn't be — see AC-3.2).

### Worked example — `CreateVendorTradeTagValidatorTests.cs::Validate_NameTooLong_Fails`

Before (line 54-55):
```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(e => e.PropertyName == "Name" && e.ErrorMessage.Contains("100"));
```

After (Form A — read `CreateVendorTradeTagValidator.cs` to find the `.WithMessage(...)` text, e.g. `"Trade tag name must be 100 characters or less"`):
```csharp
result.IsValid.Should().BeFalse();
result.Errors.Should().Contain(e =>
    e.PropertyName == "Name" &&
    e.ErrorMessage == "Trade tag name must be 100 characters or less");
```

### Worked example — `expense-form.component.spec.ts` `hasError('required')`

Before:
```typescript
expect(amountControl?.hasError('required')).toBe(true);
```

After (read `expense-form.component.html` for the literal `<mat-error>Amount is required</mat-error>` text):
```typescript
expect(amountControl?.hasError('required')).toBe(true);

amountControl?.markAsTouched();
fixture.detectChanges();

const errors = fixture.debugElement.queryAll(By.css('mat-error'));
const requiredError = errors.find(e =>
  e.nativeElement.textContent.includes('Amount is required')
);
expect(requiredError).toBeTruthy();
```

(If only one `<mat-error>` is rendered for that test, use `query(...)` + `.toContain(...)` per the work-order-form pattern.)

### Anti-pitfalls (don't make these mistakes)

1. **Don't add new `[Fact]` / `it(...)` blocks.** Every change is inside an existing test. The test count per file before and after must be identical (`grep -c "\[Fact\]" <file>` and `grep -c "  it(" <spec>`). Verified in Task 4.4.

2. **Don't change `result.IsValid.Should().BeTrue()` "passes" assertions.** AC-1.4 is explicit: positive paths are out of scope. If a file has 5 `BeTrue()` and 5 `BeFalse()`, only the 5 `BeFalse()` are touched.

3. **Don't replace `hasError(...)` with `mat-error` queries on the frontend — *add* the mat-error query.** AC-2.5: both assertions stay. The `hasError` is a fast control-state check; the `mat-error` is the user-visible-text pin. Removing one weakens the test.

4. **Don't re-write the validator to make the message match what you "think" it should say.** The validator's `.WithMessage(...)` is the source of truth (or, if no override, the FluentValidation default — see AC-1.5). Read the validator first, copy the text exactly. Only edit the validator if AC-1.6 applies (genuine typo/inconsistency, documented in File List).

5. **Don't assert on substring matches (`.Contains(...)` / `.toContain('partial')` against partial words).** That's the anti-pattern this story removes. **The one exception is `mat-error` `nativeElement.textContent.toContain(...)` on the frontend** — this is a string-search inside the DOM text node, which is the standard Angular DOM-testing idiom (per the strong-pattern files). The string passed to `toContain` is still the **complete user-visible message**, not a fragment.

6. **Don't add `data-testid` to component templates.** Production code is read-only (except AC-2.4 missing-mat-error case). Use `By.css('mat-error')` and `formControlName` selectors that already exist in the template.

7. **Don't break any currently-passing strong-bucket file.** The audit identified the strong files as "already meet the bar." Don't touch them — touching them is scope creep AND risks introducing a regression in tests that already work.

8. **Don't introduce `using FluentValidation.TestHelper;` to a file that doesn't need it.** Only files migrating to Form B need that using-statement. Form A doesn't.

9. **Don't run frontend tests with `npx vitest`.** Per CLAUDE.md memory note: use `npm test`. The test command in `package.json` is configured for the project's vitest setup (3-thread cap, etc.).

10. **Don't strip pre-existing `// AC-X.Y.Z` comments from tests when tightening.** They reference the original story's acceptance criteria for traceability — keep them.

11. **Don't mix Form A and Form B inside a single file.** AC-1's scope statement: pick one style per file and stay consistent. (Different files in the corpus can use different styles; that's already true today.)

12. **Don't change snapshot tests, e2e tests, or non-validation specs.** Out of scope. The audit scope is exclusively `*ValidatorTests.cs` files in `Application.Tests/` (backend) and `*.spec.ts` files in `frontend/src/app/features/**` that contain `hasError(...)` or `form.invalid` (frontend).

13. **Don't aggregate this work into a single mega-PR.** Per epic technical-notes: "If a test file has 20+ assertions to tighten, prefer a single-file PR rather than one mega-PR." With 15 backend + 14 frontend files in scope, the orchestrator's Ship phase decides PR granularity. The dev workflow prepares the changes; it does NOT bundle them prematurely.

14. **Don't re-read the same validator twice.** Read each validator file once, capture the exact `.WithMessage(...)` strings, then apply across all corresponding test cases. (E.g., `UpdateExpenseValidator.cs` is read once for Task 1.2, even though it covers 8 assertion edits.)

15. **Don't forget `markAsTouched()` + `fixture.detectChanges()` before querying `mat-error`.** Material's `<mat-error>` projection is gated on the form-field's "show error" state which requires `touched` + invalid. Without it, the `query(By.css('mat-error'))` returns `null` and the assertion silently passes-by-truthy-on-falsy in some patterns. Verified by reading the strong-pattern specs (`work-order-form.component.spec.ts` line 260, `submit-request.component.spec.ts` line 92).

### Previous Story Intelligence

**Story 21.10 (done — PR #396)** — Dashboard unit + E2E tests. Carried-over patterns:
- "Reality check (epic vs. shipped code)" preamble convention — replicated above with the audit-finding bucket lists.
- Anti-pitfall numbered list convention — replicated.
- Test Scope table convention — replicated; this story marks Integration and E2E as "Not required" with explicit justification (per the create-story skill's Step 4.5 mandate).
- "If tightening reveals incorrect or missing validator messages, fix the validator — don't assert wrong behavior" — this is the same discipline as 21.10's "if a future story adds percentage-change to the handler, those tests get added then" (don't bolt scope creep onto a tightening story).
- Dev Agent Record structure (Agent Model, Debug Log, Completion Notes, File List) — replicated.

**Story 21.9 (done — PR #395)** — Auth handler unit tests. Carried-over patterns:
- The "no `ILogger` mock unless the SUT injects one" lesson — same applied here: don't add `using FluentValidation.TestHelper;` unless the file needs it (AC-1's Form B). Read the file, then act.

**Story 21.7 (done — PR #386)** — Core frontend service unit tests for `api.service.ts` and `auth.interceptor.ts`. Carried-over patterns:
- Vitest assertion conventions — `expect(...).toBe(...)`, `expect(...).toContain(...)`, `vi.fn()`, `vi.spyOn(...)`. The mat-error queries follow the same Angular `By.css` + `nativeElement.textContent` pattern that 21.7's interceptor tests use for HTTP-related assertions, applied here at the DOM layer.

**Story 17.2 (done — PR #281)** — Form behavior fixes (vendor edit). The vendor-edit spec file is in this story's in-scope list (Task 3.12). 17.2 left the `hasError`-only assertions in place; this story is the follow-up that tightens them.

**Story 18.1 (done — Issue #319)** — MockQueryable.Moq v10 upgrade. Not directly relevant (this story does no DbSet mocking) but confirms the project-wide rigor for keeping test infrastructure current — same rigor applies to assertion strength.

### Files NOT to modify

- **Backend strong-bucket validator test files** (already meet the bar — listed in the Reality Check):
  - `Vendors/CreateVendorValidatorTests.cs`, `Vendors/UpdateVendorValidatorTests.cs`, `Vendors/DeleteVendorValidatorTests.cs`
  - `Receipts/GenerateUploadUrlValidatorTests.cs`
  - `Income/CreateIncomeValidatorTests.cs`
  - `WorkOrders/CreateWorkOrderValidatorTests.cs`, `WorkOrders/UpdateWorkOrderValidatorTests.cs`, `WorkOrders/ReorderWorkOrderPhotosValidatorTests.cs`
  - `Photos/ConfirmPhotoUploadValidatorTests.cs`, `Photos/GeneratePhotoUploadUrlValidatorTests.cs`
  - `AccountUsers/UpdateUserRoleValidatorTests.cs`
- **Frontend strong-bucket spec files**:
  - `work-orders/components/work-order-form/work-order-form.component.spec.ts`
  - `vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.spec.ts`
  - `tenant-dashboard/components/submit-request/submit-request.component.spec.ts`
- **All production code under `backend/src/PropertyManager.Application/**/*Validator.cs`** — read-only unless AC-1.6 applies.
- **All production code under `frontend/src/app/features/**/*.component.html`** — read-only unless AC-2.4 applies.
- **All non-validator backend test files** (handler tests, controller tests, etc.) — out of scope.
- **All non-form-validation frontend tests** (store tests, service tests, snapshot tests, page-level tests) — out of scope.

### Files in scope to modify (test files only — comprehensive enumeration)

**Backend (15 files):**
1. `backend/tests/PropertyManager.Application.Tests/Properties/CreatePropertyValidatorTests.cs`
2. `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseValidatorTests.cs`
3. `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs`
4. `backend/tests/PropertyManager.Application.Tests/Income/UpdateIncomeValidatorTests.cs`
5. `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs`
6. `backend/tests/PropertyManager.Application.Tests/Notes/CreateNoteCommandValidatorTests.cs`
7. `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs`
8. `backend/tests/PropertyManager.Application.Tests/Invitations/ValidateInvitationTests.cs`
9. `backend/tests/PropertyManager.Application.Tests/Invitations/ResendInvitationTests.cs`
10. `backend/tests/PropertyManager.Application.Tests/WorkOrderTags/CreateWorkOrderTagValidatorTests.cs`
11. `backend/tests/PropertyManager.Application.Tests/VendorTradeTags/CreateVendorTradeTagValidatorTests.cs`
12. `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersValidatorTests.cs`
13. `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/ValidatorTests.cs`
14. `backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ValidatorTests.cs`
15. `backend/tests/PropertyManager.Application.Tests/VendorPhotos/ValidatorTests.cs`

**Frontend (14 files):**
1. `frontend/src/app/features/auth/login/login.component.spec.ts`
2. `frontend/src/app/features/auth/forgot-password/forgot-password.component.spec.ts`
3. `frontend/src/app/features/auth/reset-password/reset-password.component.spec.ts`
4. `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.spec.ts`
5. `frontend/src/app/features/expenses/components/expense-form/expense-form.component.spec.ts`
6. `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.spec.ts`
7. `frontend/src/app/features/income/components/income-form/income-form.component.spec.ts`
8. `frontend/src/app/features/properties/property-form/property-form.component.spec.ts`
9. `frontend/src/app/features/properties/property-edit/property-edit.component.spec.ts`
10. `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.spec.ts`
11. `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts`
12. `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.spec.ts`
13. `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts`
14. `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts`

**Process docs (2 files):**
- `docs/project/sprint-status.yaml` — `21-11-validation-message-assertion-improvements: review` (Task 5.1)
- `docs/project/stories/epic-21/21-11-validation-message-assertion-improvements.md` — Status + Dev Agent Record (Task 5.2, 5.3)

### References

- [FluentValidation Test Extensions documentation (verified April 2026 via Ref MCP)](https://github.com/fluentvalidation/fluentvalidation/blob/main/docs/testing.md) — confirms `result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorMessage("'Name' must not be empty.")` chain syntax; confirms `WithErrorMessage`, `WithSeverity`, `WithErrorCode`, `Only()` chainables on the test result; confirms async `TestValidateAsync` parallel for async validators. Form B in this story is sourced from this doc.
- [Angular DebugElement `By.css` documentation (verified April 2026 via Ref MCP)](https://angular.dev/guide/testing/components-basics#bycss) — confirms `fixture.debugElement.query(By.css(selector))` returns a `DebugElement`; `.nativeElement.textContent` is the standard way to read DOM text. Pattern A in this story is sourced from this.
- [Epic 21](./epic-21-epics-test-coverage.md) — parent epic. Story 21.11 spec at lines 524-559. Epic AC-3 mandates "no new test files or test cases."
- [Story 21.10 (done — most recent prior story in epic)](./21-10-dashboard-unit-and-e2e-tests.md) — pattern reference for "Reality check" preamble, anti-pitfall list, Test Scope table, Dev Agent Record structure.
- [Story 21.9 (done)](./21-9-auth-handler-unit-tests.md) — handler unit-test patterns and import discipline.
- [Story 21.7 (done — PR #386)](./21-7-core-frontend-service-unit-tests.md) — frontend Vitest + Angular TestBed conventions.
- [project-context.md:106-141](../../project-context.md) — backend testing standards (xUnit + Moq + FluentAssertions); frontend testing standards (Vitest, `By.css` selectors).
- [CLAUDE.md](../../../CLAUDE.md) — `npm test` not `npx vitest` rule; testing pyramid memory note.
- GitHub Issue [#371](https://github.com/daveharmswebdev/property-manager/issues/371) — test-coverage audit that spawned this epic.
- Pattern reference (Backend Form A — `Errors.Should().Contain(e => ... && e.ErrorMessage == "...")`):
  - [`Properties/CreatePropertyValidatorTests.cs`](../../../../backend/tests/PropertyManager.Application.Tests/Properties/CreatePropertyValidatorTests.cs) lines 53, 72, 91, 110, 129, 170, 213
  - [`MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs`](../../../../backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs) lines 21, 32
- Pattern reference (Backend Form B — `TestValidate(...).ShouldHaveValidationErrorFor(...).WithErrorMessage(...)`):
  - [`Vendors/CreateVendorValidatorTests.cs`](../../../../backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs) lines 51-57
  - [`Vendors/UpdateVendorValidatorTests.cs`](../../../../backend/tests/PropertyManager.Application.Tests/Vendors/UpdateVendorValidatorTests.cs) — full file uses Form B
  - [`Receipts/GenerateUploadUrlValidatorTests.cs`](../../../../backend/tests/PropertyManager.Application.Tests/Receipts/GenerateUploadUrlValidatorTests.cs) — full file uses Form B
- Pattern reference (Frontend `By.css('mat-error')` + `nativeElement.textContent`):
  - [`work-order-form.component.spec.ts`](../../../../frontend/src/app/features/work-orders/components/work-order-form/work-order-form.component.spec.ts) lines 258-281, 602
  - [`inline-vendor-dialog.component.spec.ts`](../../../../frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.spec.ts) lines 90-118
  - [`submit-request.component.spec.ts`](../../../../frontend/src/app/features/tenant-dashboard/components/submit-request/submit-request.component.spec.ts) lines 90-99
- Validator source files (read these to find the exact `.WithMessage(...)` strings — one read per validator):
  - [`UpdateExpenseValidator.cs`](../../../../backend/src/PropertyManager.Application/Expenses/UpdateExpenseValidator.cs) — 7 explicit messages confirmed.
  - All other validators in `backend/src/PropertyManager.Application/**/*Validator.cs`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via /dev-story skill (orchestrator-driven).

### Debug Log References

- Backend filtered run (validators only): `dotnet test --filter "FullyQualifiedName~Validator"` — 330 passed.
- Backend full suite: `dotnet test` — 2110 passed (Application.Tests 1221 + Infrastructure.Tests 98 + Api.Tests 791). Zero failures, zero regressions.
- Backend build: `dotnet build` — 0 warnings, 0 errors.
- Frontend full Vitest suite: `npm test` — 2768 passed across 123 files. Zero regressions.
- AC-3 scope guard: `git diff main -- 'backend/tests/**/*Tests.cs' 'frontend/src/app/features/**/*.spec.ts' | grep -cE "^\\+[^+].*(\\[Fact\\]|\\[Theory\\]|  it\\()"` returned `0`. Net-new test count: 0.
- Production-code scope guard: `git diff --stat main -- backend/src frontend/src/app/features` filtered for non-spec files — 0 changes.

### Completion Notes List

- **Form A used throughout backend** (per Dev Notes default). All tightened backend assertions use `result.Errors.Should().Contain(e => e.PropertyName == "X" && e.ErrorMessage == "...")` pattern. No file was migrated to Form B (`TestValidate`) because none of the in-scope mixed/weak files imported `FluentValidation.TestHelper`.
- **Task 1.7 (`ValidateInvitationTests.cs`) was a no-op:** the file's only two `[Fact]`s are positive-path handler tests asserting `result.IsValid.Should().BeTrue()`. There are no `IsValid.BeFalse()` validator-failure assertions in the file. Per AC-1.4, positive paths are out of scope. Story audit overcounted; no tightening required.
- **Task 1.4 (`CreateMaintenanceRequestValidatorTests.cs`) had only 2 fail assertions** (story said 3); both were already `e.ErrorMessage == "..."` exact-equality but did not check `PropertyName`. Strengthened both to also assert `PropertyName == "Description"` for symmetry with the canonical Form A pattern.
- **`LinkReceiptToExpenseValidator.cs` has no `.WithMessage(...)` overrides** (AC-1.5 path). Used FluentValidation v12 default `NotEmpty()` message: `"'Expense Id' must not be empty."` and `"'Receipt Id' must not be empty."` (auto-formatted from camelCase by FluentValidation's default `PropertyNameResolver`). Did NOT add `.WithMessage(...)` to the validator — that would be a behavior change (forbidden by AC-1.5).
- **`GetAllWorkOrdersValidatorTests.cs::Validate_InvalidStatus_IsInvalid`** had 3 separate `.Should().Contain(...)` substring assertions on the single error message (one per enum value). Replaced with a single `.Should().Be("Status must be one of: Reported, Assigned, Completed")` exact-match assertion. Net assertion count change for the test method: -2 (3 substring → 1 equality), but no `[Fact]`/`[Theory]` count change.
- **Photo validator tests (Tasks 2.1–2.3)** asserted only `PropertyName`. Tightened all to `PropertyName + ErrorMessage` exact-equality. The dynamic `string.Join(", ", PhotoValidation.AllowedContentTypes)` message resolves to `"Content type must be one of: image/jpeg, image/png, image/gif, image/webp, image/bmp, image/tiff"` (HashSet iteration order is by insertion, deterministic).
- **Frontend categoryId-required tests (`expense-form` Task 3.5, `receipt-expense-form` Task 3.14)** were left as `hasError`-only. The category control's error rendering is delegated to the `<app-category-select>` child component via `[error]="getCategoryError()"` binding — there is no `<mat-error>` block in the parent component for `categoryId`. Adding a `mat-error` query for these cases would test the wrong component. Per AC-2.5, the existing `hasError` assertion is preserved as a control-state check; the user-visible error text for categoryId is exercised in `category-select.component.spec.ts` (out of scope for this story).
- **No production-code escape hatches were triggered.** No validator typos found (AC-1.6 not invoked); no missing `<mat-error>` blocks found (AC-2.4 not invoked). All template `<mat-error>` text matched what the component logic could render.
- **AC-3 scope guard verified:** `git diff main` shows 0 net-new `[Fact]`/`[Theory]`/`it(...)` declarations. All changes are tightened assertions inside existing test cases.
- **All 380 in-scope frontend spec tests pass** after tightening. **All 397 in-scope backend validator + invitation tests pass** after tightening.

### File List

**Backend test files modified (15):**
- `backend/tests/PropertyManager.Application.Tests/Properties/CreatePropertyValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Expenses/UpdateExpenseValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Expenses/LinkReceiptToExpenseValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Income/UpdateIncomeValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequests/CreateMaintenanceRequestValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Notes/CreateNoteCommandValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/CreateInvitationTests.cs`
- `backend/tests/PropertyManager.Application.Tests/Invitations/ResendInvitationTests.cs`
- `backend/tests/PropertyManager.Application.Tests/WorkOrderTags/CreateWorkOrderTagValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/VendorTradeTags/CreateVendorTradeTagValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/WorkOrders/GetAllWorkOrdersValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/MaintenanceRequestPhotos/ValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/PropertyPhotos/ValidatorTests.cs`
- `backend/tests/PropertyManager.Application.Tests/VendorPhotos/ValidatorTests.cs`

**Backend test files NOT modified (Task 1.7 no-op — see Completion Notes):**
- `backend/tests/PropertyManager.Application.Tests/Invitations/ValidateInvitationTests.cs` (no failure-path assertions; out of AC-1.4 scope)

**Frontend spec files modified (13):**
- `frontend/src/app/features/auth/login/login.component.spec.ts`
- `frontend/src/app/features/auth/forgot-password/forgot-password.component.spec.ts`
- `frontend/src/app/features/auth/reset-password/reset-password.component.spec.ts`
- `frontend/src/app/features/auth/accept-invitation/accept-invitation.component.spec.ts`
- `frontend/src/app/features/expenses/components/expense-form/expense-form.component.spec.ts`
- `frontend/src/app/features/expenses/components/create-expense-from-wo-dialog/create-expense-from-wo-dialog.component.spec.ts`
- `frontend/src/app/features/income/components/income-form/income-form.component.spec.ts`
- `frontend/src/app/features/properties/property-form/property-form.component.spec.ts`
- `frontend/src/app/features/properties/property-edit/property-edit.component.spec.ts`
- `frontend/src/app/features/properties/components/invite-tenant-dialog/invite-tenant-dialog.component.spec.ts`
- `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts`
- `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.spec.ts`
- `frontend/src/app/features/work-orders/components/create-wo-from-expense-dialog/create-wo-from-expense-dialog.component.spec.ts`
- `frontend/src/app/features/receipts/components/receipt-expense-form/receipt-expense-form.component.spec.ts`

**Production source files modified:** NONE.
- No validator `.WithMessage(...)` text was changed (AC-1.6 not triggered — no typos found).
- No component template `<mat-error>` block was added (AC-2.4 not triggered — no missing-error UI defects found).
- No `categoryId` mat-error was added to `expense-form` / `receipt-expense-form` (per AC-2.5 reasoning above; categoryId error rendering is delegated to `<app-category-select>` child component, which is out of scope).

**Process docs (2):**
- `docs/project/sprint-status.yaml` — status: in-progress → review
- `docs/project/stories/epic-21/21-11-validation-message-assertion-improvements.md` — Status, all task checkboxes, Dev Agent Record
