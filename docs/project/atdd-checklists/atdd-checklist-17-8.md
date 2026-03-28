# ATDD Checklist - Epic 17, Story 17.8: Full-Size Add Vendor Form

**Date:** 2026-03-02
**Author:** Dave
**Primary Test Level:** E2E (Playwright) + Component (Vitest) + Backend Unit (xUnit)

---

## Story Summary

Expand the vendor creation form from a simple name-only form to a full-size form matching the edit form layout, including phone numbers, email addresses, and trade tags.

**As a** user creating a vendor from the Vendors list page
**I want** a full-size creation form with all vendor fields
**So that** I can enter complete vendor details upfront without using the limited inline dialog

---

## Acceptance Criteria

1. **AC-1:** Full-size form from Vendor list — clicking "+ Add Vendor" shows full form with first name, middle name, last name, phone numbers, email addresses, and trade tags
2. **AC-2:** Form matches Edit Vendor layout — same layout, field sizing, and section organization
3. **AC-3:** Inline dialog unchanged for Work Orders — compact form remains for speed in that context

---

## Failing Tests Created (RED Phase)

### E2E Tests (9 tests)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts` (~170 lines)

- **Test:** should display phone numbers section in create form (AC-1)
  - **Status:** RED — `addPhoneButton` not found (VendorFormComponent has no phone section)
  - **Verifies:** Phone numbers section rendered with add button on create form

- **Test:** should display email addresses section in create form (AC-1)
  - **Status:** RED — `addEmailButton` not found (VendorFormComponent has no email section)
  - **Verifies:** Email addresses section rendered with add button on create form

- **Test:** should display trade tags section in create form (AC-1)
  - **Status:** RED — `tagInput` not found (VendorFormComponent has no tag section)
  - **Verifies:** Trade tags section rendered with chip input on create form

- **Test:** should create vendor with phone numbers (AC-1)
  - **Status:** RED — cannot add phone (no phone section in form)
  - **Verifies:** Full create → save → verify phone persisted on detail page

- **Test:** should create vendor with email addresses (AC-1)
  - **Status:** RED — cannot add email (no email section in form)
  - **Verifies:** Full create → save → verify email persisted on detail page

- **Test:** should create vendor with trade tags (AC-1)
  - **Status:** RED — cannot add tag (no tag section in form)
  - **Verifies:** Full create → save → verify tag persisted on detail page

- **Test:** should create vendor with all details: phones, emails, and tags (AC-1)
  - **Status:** RED — cannot interact with phone/email/tag sections
  - **Verifies:** Integration test — create with all fields, verify all data persists

- **Test:** should still create vendor with only names for backward compatibility (AC-1)
  - **Status:** GREEN (existing behavior) — regression guard
  - **Verifies:** Name-only creation still works after form expansion

- **Test:** should have same layout sections as edit form (AC-2)
  - **Status:** RED — phone/email/tag sections missing, max-width is 600px (needs 800px)
  - **Verifies:** Layout parity between create and edit forms

### Component Tests (to be added to existing spec)

**File:** `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts`

**Required mock store expansion:**
```typescript
// Add to mockVendorStore:
tradeTags: signal<VendorTradeTagDto[]>([]),
loadTradeTags: vi.fn(),
createTradeTag: vi.fn().mockResolvedValue({ id: 'new-tag', name: 'Test Tag' }),
```

**New tests to add (will fail until implementation):**

- **Test:** should have phone numbers section (AC-1)
  - **Verifies:** `addPhone` button and phone section exist in DOM

- **Test:** should add phone row when clicking add phone (AC-1)
  - **Verifies:** `addPhone()` method adds FormArray entry

- **Test:** should remove phone row (AC-1)
  - **Verifies:** `removePhone()` method removes FormArray entry

- **Test:** should have email addresses section (AC-1)
  - **Verifies:** `addEmail` button and email section exist in DOM

- **Test:** should add email row when clicking add email (AC-1)
  - **Verifies:** `addEmail()` method adds FormArray entry

- **Test:** should remove email row (AC-1)
  - **Verifies:** `removeEmail()` method removes FormArray entry

- **Test:** should validate email format (AC-1)
  - **Verifies:** Email FormControl has email validator

- **Test:** should have trade tags section (AC-1)
  - **Verifies:** `mat-chip-grid` and tag input exist in DOM

- **Test:** should select and remove trade tags (AC-1)
  - **Verifies:** Tag selection and removal signals work

- **Test:** should call loadTradeTags on init (AC-1)
  - **Verifies:** `store.loadTradeTags()` called in ngOnInit

- **Test:** should include phones, emails, tradeTagIds in submit payload (AC-1)
  - **Verifies:** `createVendor` called with expanded request object

- **Test:** should still have "Add Vendor" title (AC-2)
  - **Verifies:** Title text unchanged after form expansion

### Backend Unit Tests (to be added to existing test files)

**File:** `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorHandlerTests.cs`

**New tests (require CreateVendorCommand parameter expansion first):**

- **Test:** Handle_WithPhones_SetsPhoneNumbersOnVendor
  - **Verifies:** Phone numbers from command are set on the new Vendor entity

- **Test:** Handle_WithEmails_SetsEmailsOnVendor
  - **Verifies:** Email addresses from command are set on the new Vendor entity

- **Test:** Handle_WithTradeTagIds_CreatesVendorTradeTagAssignments
  - **Verifies:** VendorTradeTagAssignment entries created for each tag ID

- **Test:** Handle_WithInvalidTradeTagIds_ThrowsValidationException
  - **Verifies:** Tag IDs not belonging to current account throw ValidationException

- **Test:** Handle_WithEmptyOptionalFields_CreatesVendorSuccessfully
  - **Verifies:** Backward compatibility — empty phones/emails/tags still works

**File:** `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs`

**New tests (require CreateVendorValidator expansion first):**

- **Test:** Validate_PhoneNumberRequired_ReturnsError
- **Test:** Validate_PhoneNumberMaxLength_ReturnsError
- **Test:** Validate_PhoneLabelMaxLength_ReturnsError
- **Test:** Validate_EmailRequired_ReturnsError
- **Test:** Validate_EmailMaxLength_ReturnsError
- **Test:** Validate_EmailInvalidFormat_ReturnsError

---

## Data Factories Created

No new data factories required. E2E tests use `Date.now()` timestamps for unique test data (consistent with existing vendor test patterns in this project).

---

## Fixtures Created

No new fixtures required. Existing `vendorPage` fixture and `VendorPage` page object already include all necessary locators and methods for phones, emails, and trade tags (shared between create and edit forms).

**Existing fixtures used:**
- `authenticatedUser` — auto-login with seeded account
- `vendorPage` — `VendorPage` page object with `gotoCreate()`, `addPhone()`, `addEmail()`, `createAndSelectTag()`, `submitForm()`, and all assertion methods

---

## Mock Requirements

No external service mocks needed. The vendor creation flow uses the same API (`POST /api/v1/vendors`) with an expanded request body. No new external services are introduced.

---

## Required data-testid Attributes

No new `data-testid` attributes needed. The E2E tests use Angular form control selectors (`[formControlName="..."]`), CSS class selectors (`.phone-row`, `.email-row`, `.section-header`), and Material component selectors (`mat-chip-grid`, `mat-select`, `mat-option`) — all consistent with the existing edit form patterns.

**Key locators the create form must have (cloned from edit form):**
- `.section-header button` with `mat-icon:has-text("add")` — add phone/email buttons
- `.phone-row` with `input[formControlName="number"]` and `mat-select[formControlName="label"]`
- `.email-row` with `input`
- `[formArrayName="emails"]`
- `mat-chip-grid` with input for tag autocomplete
- `mat-chip-row` for selected tags
- `.vendor-form-container` with `max-width: 800px`

---

## Implementation Checklist

### Test: should display phone numbers section in create form (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `phones` FormArray to VendorFormComponent form group
- [ ] Add phone section template (clone from VendorEditComponent lines 89-127)
- [ ] Add `addPhone()` and `removePhone()` methods
- [ ] Import `MatSelectModule` for phone label dropdown
- [ ] Import `PhoneMaskDirective` from shared directives
- [ ] Add `.section-header`, `.phone-row` styles (clone from edit component)
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should display email addresses section in create form (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `emails` FormArray to VendorFormComponent form group
- [ ] Add email section template (clone from VendorEditComponent lines 129-159)
- [ ] Add `addEmail()` and `removeEmail()` methods
- [ ] Add `.email-row`, `.email-field` styles
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should display trade tags section in create form (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `selectedTags` signal, `tagInputControl`, `filteredTags` computed
- [ ] Add tag section template (clone from VendorEditComponent lines 161-197)
- [ ] Add `selectTag()`, `addTagFromInput()`, `createAndAddTag()`, `removeTag()`, `tagExists()` methods
- [ ] Add `@ViewChild('tagInput')` for clearing input after selection
- [ ] Import `MatChipsModule`, `MatAutocompleteModule`
- [ ] Call `store.loadTradeTags()` in `ngOnInit`
- [ ] Add `.create-option` style
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should create vendor with phone numbers (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass (frontend done above, plus backend):**

- [ ] Expand `CreateVendorCommand` with `List<PhoneNumberDto> Phones` parameter
- [ ] Update `CreateVendorCommandHandler` to set phones on new Vendor entity
- [ ] Expand `CreateVendorRequest` DTO with `List<PhoneNumberRequest> Phones`
- [ ] Update controller mapping to pass phones to command
- [ ] Expand `CreateVendorValidator` with phone validation rules
- [ ] Regenerate API client: `npm run generate-api`
- [ ] Update `onSubmit()` to build request with phones
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should create vendor with email addresses (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Expand `CreateVendorCommand` with `List<string> Emails` parameter
- [ ] Update `CreateVendorCommandHandler` to set emails on new Vendor entity
- [ ] Expand `CreateVendorRequest` DTO with `List<string> Emails`
- [ ] Update controller mapping to pass emails to command
- [ ] Expand `CreateVendorValidator` with email validation rules
- [ ] Update `onSubmit()` to build request with emails
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should create vendor with trade tags (AC-1)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Expand `CreateVendorCommand` with `List<Guid> TradeTagIds` parameter
- [ ] Update `CreateVendorCommandHandler` with trade tag assignment logic (clone from UpdateVendorCommandHandler:54-99)
- [ ] Expand `CreateVendorRequest` DTO with `List<Guid> TradeTagIds`
- [ ] Update controller mapping to pass tradeTagIds to command
- [ ] Update `onSubmit()` to build request with tradeTagIds from selectedTags signal
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should create vendor with all details (AC-1) — Integration

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] All backend and frontend changes from above must be complete
- [ ] API client regenerated
- [ ] Full form submits phones + emails + tradeTagIds in single request
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Test: should have same layout sections as edit form (AC-2)

**File:** `frontend/e2e/tests/vendors/vendor-create-full.spec.ts`

**Tasks to make this test pass:**

- [ ] Update container `max-width` from `600px` to `800px`
- [ ] Add name-row layout (3 inline fields matching edit)
- [ ] Add mobile responsive styles (`@media (max-width: 600px)` block)
- [ ] Update subtitle from "Enter the vendor's name to add them to your list" to "Enter vendor details"
- [ ] Run test: `npm run test:e2e -- vendor-create-full.spec.ts`
- [ ] Test passes (green phase)

---

### Regression: AC-3 Inline Dialog Unchanged

**Note:** The `InlineVendorDialogComponent` file is NOT being modified (per story Dev Notes). This AC is verified by:
1. The dev NOT modifying `inline-vendor-dialog.component.ts`
2. Existing E2E tests that create vendors via work orders continue to pass
3. Manual verification step (Task 9.5 in story)

No automated E2E test written for AC-3 because:
- Risk is LOW (file is explicitly marked DO NOT MODIFY)
- Inline dialog uses `store.createVendorInline()` which sends minimal request
- New backend fields default to empty lists (backward compatible)

---

## Running Tests

```bash
# Run all failing E2E tests for this story
npm run test:e2e -- --grep "Vendor Create Full Form"

# Run specific test file
npm run test:e2e -- e2e/tests/vendors/vendor-create-full.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e -- e2e/tests/vendors/vendor-create-full.spec.ts --headed

# Debug specific test
npm run test:e2e -- e2e/tests/vendors/vendor-create-full.spec.ts --debug

# Run frontend component tests
npm test -- --reporter verbose

# Run backend unit tests
cd backend && dotnet test --filter "FullyQualifiedName~CreateVendor"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- [x] Story acceptance criteria analyzed — 3 ACs mapped to test levels
- [x] E2E tests written (9 tests in `vendor-create-full.spec.ts`)
- [x] Component test additions documented (11 new tests)
- [x] Backend test additions documented (11 new tests)
- [x] Implementation checklist created with clear tasks per test
- [x] No new fixtures or factories needed (existing infrastructure sufficient)
- [x] data-testid requirements documented (reuses edit form selectors)

**Expected Failures:**
- E2E: 8 of 9 tests fail (1 backward-compat test passes)
- Failures are due to missing DOM elements and missing API fields — NOT test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**Recommended implementation order (minimizes context switching):**

1. **Backend first** — Expand CreateVendorCommand, handler, validator, DTO
2. **Regenerate API client** — `npm run generate-api`
3. **Frontend form expansion** — Clone phone/email/tag sections from edit component
4. **Frontend submit expansion** — Build request with new fields
5. **Run E2E tests** — Verify all GREEN

**Key Principles:**
- One test at a time (don't try to fix all at once)
- Run `npm run test:e2e -- vendor-create-full.spec.ts` after each change
- Backend + API client must be done before frontend phone/email/tag tests can pass

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all 9 E2E tests pass
2. Add component tests documented above
3. Add backend unit tests documented above
4. Run full test suite (`dotnet test` + `npm test` + `npm run test:e2e`)
5. Review for DRY violations between create/edit components (don't over-abstract)

---

## Next Steps

1. **Run failing tests to confirm RED phase:** `npm run test:e2e -- e2e/tests/vendors/vendor-create-full.spec.ts`
2. **Begin implementation** using implementation checklist as guide
3. **Work one test at a time** (RED → GREEN for each)
4. **When all E2E tests pass**, add component + backend unit tests
5. **When complete**, update story status in sprint-status.yaml

---

## Knowledge Base References Applied

- **selector-resilience.md** — E2E tests use Angular form control selectors and CSS class selectors matching existing edit form patterns
- **test-quality.md** — Given-When-Then structure, one primary assertion per test, deterministic timestamps via `Date.now()`
- **timing-debugging.md** — No hard waits; relies on Playwright auto-waiting and `waitForSnackBar()` helper
- **component-tdd.md** — Component test additions follow existing TestBed/signal mock patterns

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Notes

- **No page object changes needed** — `VendorPage` already has all locators for phones, emails, and tags (shared with edit form tests)
- **Backward compatibility is critical** — the backward-compat test (`names only`) must PASS both before and after implementation
- **AC-3 is low risk** — inline dialog file is explicitly marked DO NOT MODIFY in story
- **Backend changes must land first** — frontend tests for create-with-data depend on API accepting expanded request body

---

**Generated by BMad TEA Agent** - 2026-03-02
