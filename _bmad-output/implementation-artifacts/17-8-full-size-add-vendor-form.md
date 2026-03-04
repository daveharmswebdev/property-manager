# Story 17.8: Full-Size Add Vendor Form

Status: done

## Story

As a user creating a vendor from the Vendors list page,
I want a full-size creation form with all vendor fields,
so that I can enter complete vendor details upfront without using the limited inline dialog.

**GitHub Issue:** #274
**Effort:** M

## Acceptance Criteria

**AC-1: Full-size form from Vendor list**
Given I am on the Vendors list page (`/vendors`)
When I click "+ Add Vendor"
Then I see a full-size vendor creation form (not the compact inline dialog)
And the form includes: first name, middle name, last name, phone numbers, email addresses, and trade tags

**AC-2: Form matches Edit Vendor layout**
Given I compare the new Add Vendor form with the Edit Vendor form
When I view both
Then they have the same layout, field sizing, and section organization

**AC-3: Inline dialog unchanged for Work Orders**
Given I am creating a Work Order and click "Add New Vendor"
When the inline dialog opens
Then it remains the compact form (unchanged — designed for speed in that context)

## Tasks / Subtasks

### Backend: Expand CreateVendor to Accept Full Details

- [ ] Task 1: Expand `CreateVendorCommand` record (AC: 1)
  - [ ] 1.1: Add optional parameters: `List<PhoneNumberDto> Phones`, `List<string> Emails`, `List<Guid> TradeTagIds` — all default to empty lists
  - [ ] 1.2: Update handler to set `Phones` and `Emails` on the new `Vendor` entity
  - [ ] 1.3: Add trade tag assignment logic (clone from `UpdateVendorCommandHandler` lines 54-99): validate tag IDs belong to current account, then create `VendorTradeTagAssignment` entries
  - [ ] 1.4: Inject `IAppDbContext` for `VendorTradeTags` query (already available)

- [ ] Task 2: Expand `CreateVendorValidator` (AC: 1)
  - [ ] 2.1: Add `RuleForEach(x => x.Phones)` with child rules: `Number` required, max 50; `Label` optional, max 50 — clone from `UpdateVendorValidator`
  - [ ] 2.2: Add `RuleForEach(x => x.Emails)` with child rules: required, max 255, valid email format — clone from `UpdateVendorValidator`

- [ ] Task 3: Expand `CreateVendorRequest` DTO in `VendorsController.cs` (AC: 1)
  - [ ] 3.1: Add `List<PhoneNumberRequest> Phones { get; init; } = new();`
  - [ ] 3.2: Add `List<string> Emails { get; init; } = new();`
  - [ ] 3.3: Add `List<Guid> TradeTagIds { get; init; } = new();`
  - [ ] 3.4: Update controller `CreateVendor` action to map new fields: `request.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList()`, `request.Emails.ToList()`, `request.TradeTagIds.ToList()`

- [ ] Task 4: Backend unit tests (AC: 1)
  - [ ] 4.1: Update `CreateVendorHandlerTests.cs` — add tests for: phones set on vendor, emails set on vendor, trade tag assignments created, invalid trade tag IDs throw ValidationException, empty optional fields still work (backward compat)
  - [ ] 4.2: Update `CreateVendorValidatorTests.cs` — add tests for: phone validation rules, email validation rules (mirror UpdateVendorValidator tests)

### Frontend: Expand VendorFormComponent to Full Form

- [ ] Task 5: Expand `vendor-form.component.ts` template and form logic (AC: 1, 2)
  - [ ] 5.1: Add imports matching `VendorEditComponent`: `OnInit`, `signal`, `computed`, `ViewChild`, `ElementRef` from `@angular/core`; `FormArray` from `@angular/forms`; `MatChipsModule`, `MatAutocompleteModule`, `MatSelectModule` from Material; `COMMA`/`ENTER` from CDK; `PhoneMaskDirective` from shared directives
  - [ ] 5.2: Add `phones` `FormArray` and `emails` `FormArray` to form group (same structure as edit)
  - [ ] 5.3: Add `selectedTags` signal, `tagInputControl`, `filteredTags` computed, `separatorKeyCodes`
  - [ ] 5.4: Add `addPhone()`, `removePhone()`, `addEmail()`, `removeEmail()` methods
  - [ ] 5.5: Add `selectTag()`, `addTagFromInput()`, `createAndAddTag()`, `removeTag()`, `tagExists()` methods — clone from `VendorEditComponent`. Include `@ViewChild('tagInput') tagInput!: ElementRef<HTMLInputElement>` for clearing input after tag selection
  - [ ] 5.6: Call `store.loadTradeTags()` in `ngOnInit` lifecycle hook
  - [ ] 5.7: Update template to match edit form layout: sectioned form with Name row (3 inline fields), Phone Numbers section (FormArray with add/remove), Email Addresses section (FormArray with add/remove), Trade Tags section (chip grid with autocomplete)
  - [ ] 5.8: Update `onSubmit()` to build request with phones, emails, and tradeTagIds
  - [ ] 5.9: Update container `max-width` from `600px` to `800px`
  - [ ] 5.10: Update title to "Add Vendor" and subtitle to "Enter vendor details"
  - [ ] 5.11: Add mobile responsive styles (name-row wraps, phone-row wraps) — clone from edit component

- [ ] Task 6: Update `vendor.store.ts` `createVendor` method (AC: 1)
  - [ ] 6.1: The store calls `vendorService.createVendor()` which uses the NSwag-generated API client. After API client regeneration, the `CreateVendorRequest` type will automatically include the new fields. No store code change needed — the store just passes the request through.

- [ ] Task 7: Frontend unit tests (AC: 1, 2, 3)
  - [ ] 7.1: Update `vendor-form.component.spec.ts` — update mock store to include `tradeTags`, `loadTradeTags`, `createTradeTag` signals/methods
  - [ ] 7.2: Add tests: phone section renders, can add/remove phones, phone validation
  - [ ] 7.3: Add tests: email section renders, can add/remove emails, email validation
  - [ ] 7.4: Add tests: trade tags section renders, can select/remove tags
  - [ ] 7.5: Update submit test to verify phones, emails, tradeTagIds included in request
  - [ ] 7.6: Verify title still says "Add Vendor" (not "Edit Vendor")

- [ ] Task 8: Regenerate API client (AC: 1)
  - [ ] 8.1: Run `npm run generate-api` after backend changes are live

### Verification

- [ ] Task 9: Manual verification (AC: 1, 2, 3)
  - [ ] 9.1: Navigate to `/vendors` → click "Add Vendor" → verify full form with all sections
  - [ ] 9.2: Compare layout with edit form at `/vendors/:id/edit` → should match
  - [ ] 9.3: Create vendor with phones, emails, tags → verify all data saved
  - [ ] 9.4: Create vendor with only names (no optional fields) → verify backward compat
  - [ ] 9.5: Open work order form → click "Add New Vendor" → verify inline dialog unchanged

## Dev Notes

### Architecture: Expand Existing Components, No Refactoring

This story uses **Pattern A** (separate create/edit components) which is the established vendor feature pattern. Do NOT refactor to a shared form component — just expand `VendorFormComponent` to include the same form sections as `VendorEditComponent`.

The route `/vendors/new` → `VendorFormComponent` already exists. No routing changes needed.

### Backend: CreateVendorCommand Expansion

**Current command (3 fields):**
```csharp
public record CreateVendorCommand(
    string FirstName,
    string? MiddleName,
    string LastName
) : IRequest<Guid>;
```

**Target command (6 fields, new ones optional):**
```csharp
public record CreateVendorCommand(
    string FirstName,
    string? MiddleName,
    string LastName,
    List<PhoneNumberDto> Phones,
    List<string> Emails,
    List<Guid> TradeTagIds
) : IRequest<Guid>;
```

New fields default to empty lists so the inline dialog (which only sends names) still works — the controller maps empty lists for unset fields.

**Trade tag logic to clone from `UpdateVendorCommandHandler`** (`UpdateVendor.cs:54-99`):
1. If `TradeTagIds.Count > 0`, validate IDs belong to current account via `_dbContext.VendorTradeTags`
2. Create `VendorTradeTagAssignment` entries for each valid tag ID
3. The vendor entity's `TradeTagAssignments` collection handles this

**Key difference from update:** No need to sync (remove old + add new) — just add all assignments since it's a new vendor.

### Backend: CreateVendorRequest DTO Expansion

File: `VendorsController.cs:276-281`

Add three optional list properties with empty defaults (matches `UpdateVendorRequest` shape):
- `List<PhoneNumberRequest> Phones { get; init; } = new();`
- `List<string> Emails { get; init; } = new();`
- `List<Guid> TradeTagIds { get; init; } = new();`

**Controller mapping update** (`VendorsController.cs:187-190`):
```csharp
var command = new CreateVendorCommand(
    request.FirstName,
    request.MiddleName,
    request.LastName,
    request.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList(),
    request.Emails.ToList(),
    request.TradeTagIds.ToList());
```

### Backend: Validator Expansion

Clone phone and email rules from `UpdateVendorValidator.cs:27-44` into `CreateVendorValidator`.

### Frontend: VendorFormComponent Expansion

**Source to clone from:** `VendorEditComponent` (`vendor-edit.component.ts`)

The create form should replicate these sections from the edit form:
1. **Name section** (lines 64-87): Three inline fields in a `name-row` div (First, Middle, Last)
2. **Phone Numbers section** (lines 89-127): `FormArray` with `section-header` (h3 + add button), `@for` loop of phone rows (number + label select + delete button), empty message
3. **Email Addresses section** (lines 129-159): `FormArray` with `section-header`, `@for` loop of email rows, empty message
4. **Trade Tags section** (lines 161-197): `mat-chip-grid` with `mat-chip-row` for selected tags, autocomplete input, "Create new" option
5. **Form Actions** (lines 199-222): Cancel + Save buttons

**What NOT to clone from edit:**
- No loading state (create form has no data to load — only `loadTradeTags()`)
- No `populateForm()` method
- No `HasUnsavedChanges` interface (not on the create route — see `app.routes.ts`)
- No `originalTradeTagIds` tracking (not needed for dirty detection on create)
- No `hasTagChanges()` for button disabled state — on create, button should just check `form.invalid || store.isSaving()`

**Key imports to add:**
```typescript
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { PhoneMaskDirective } from '../../../../shared/directives/phone-mask.directive';
import { MatChipInputEvent } from '@angular/material/chips';
import { VendorTradeTagDto } from '../../../../core/api/api.service';
```

**Lifecycle:** Add `OnInit` to call `store.loadTradeTags()` so the autocomplete has data.

**Submit payload expansion:**
```typescript
const request = {
  firstName: this.form.value.firstName?.trim(),
  middleName: this.form.value.middleName?.trim() || undefined,
  lastName: this.form.value.lastName?.trim(),
  phones: this.form.value.phones.map((p: { number?: string; label?: string }) => ({
    number: p.number?.trim(),
    label: p.label || undefined,
  })),
  emails: this.form.value.emails.map((e: string) => e.trim()),
  tradeTagIds: this.selectedTags()
    .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
    .map(t => t.id),
};
```

### Inline Dialog — NO CHANGES

`InlineVendorDialogComponent` stays unchanged. It uses `store.createVendorInline()` which builds a minimal `CreateVendorRequest` with only name fields. Since the new backend fields default to empty lists, this continues to work without changes.

File: `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts` — DO NOT MODIFY.

### Existing File Patterns for Phone Mask

The `PhoneMaskDirective` is already used in the edit form:
- File: `frontend/src/app/shared/directives/phone-mask.directive.ts`
- Usage: `<input matInput appPhoneMask formControlName="number" />`
- Formats as `(XXX) XXX-XXXX` on input

### Styles to Match

Clone all styles from `VendorEditComponent` (lines 229-363). Key differences from current create form:
- `max-width: 800px` (was 600px)
- Add `.form-section`, `.section-header`, `.name-row`, `.name-field`, `.phone-row`, `.phone-number`, `.phone-label`, `.email-row`, `.email-field`, `.array-items`, `.empty-message`, `.create-option` classes
- Add mobile responsive `@media (max-width: 600px)` block

### Project Structure Notes

- Route already exists: `/vendors/new` → `VendorFormComponent` (in `app.routes.ts:178-200`)
- No new files — only expanding existing `VendorFormComponent` and backend `CreateVendor*` files
- Cross-feature imports: none needed (trade tags are in vendor feature)
- `PhoneMaskDirective` import from `shared/directives/` — already used in edit form

### References

- [Source: `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.ts` — Component to expand (193 lines → ~450 lines)]
- [Source: `frontend/src/app/features/vendors/components/vendor-edit/vendor-edit.component.ts` — Template/logic to clone from (587 lines)]
- [Source: `frontend/src/app/features/vendors/components/inline-vendor-dialog/inline-vendor-dialog.component.ts` — DO NOT MODIFY]
- [Source: `backend/src/PropertyManager.Application/Vendors/CreateVendor.cs` — Command + handler to expand]
- [Source: `backend/src/PropertyManager.Application/Vendors/CreateVendorValidator.cs` — Validator to expand]
- [Source: `backend/src/PropertyManager.Application/Vendors/UpdateVendor.cs:54-99` — Trade tag logic to clone]
- [Source: `backend/src/PropertyManager.Application/Vendors/UpdateVendorValidator.cs:27-44` — Phone/email validation to clone]
- [Source: `backend/src/PropertyManager.Api/Controllers/VendorsController.cs:276-281` — DTO to expand, lines 187-190 mapping to update]
- [Source: `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorHandlerTests.cs` — Tests to expand]
- [Source: `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs` — Tests to expand]
- [Source: `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts` — Tests to expand]
- [Source: `frontend/src/app/shared/directives/phone-mask.directive.ts` — Phone mask directive to import]
- [Source: GitHub Issue #274 — Full-size add vendor form]
- [Source: project-context.md — Clean Architecture, CQRS, testing rules, Angular patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Backend: Expanded CreateVendorCommand with Phones, Emails, TradeTagIds parameters (all default-empty for backward compat)
- Backend: Handler sets phones/emails on vendor entity and creates VendorTradeTagAssignment entries with account validation
- Backend: Validator expanded with phone/email validation rules cloned from UpdateVendorValidator
- Backend: CreateVendorRequest DTO expanded with Phones, Emails, TradeTagIds; controller mapping updated
- Backend: 11 new handler tests + 10 new validator tests — all 1,535 backend tests pass
- Frontend: VendorFormComponent expanded from name-only to full form with phone/email/tag sections
- Frontend: Template, styles, imports all cloned from VendorEditComponent; max-width 800px, mobile responsive
- Frontend: onSubmit builds request with phones, emails, tradeTagIds; calls store.loadTradeTags() on init
- Frontend: Component spec expanded with 30+ tests including new phone/email/tag sections — all 2,594 frontend tests pass
- API client regenerated via npm run generate-api
- InlineVendorDialogComponent NOT modified (AC-3 preserved)

### File List

- `backend/src/PropertyManager.Application/Vendors/CreateVendor.cs` — Expanded command + handler
- `backend/src/PropertyManager.Application/Vendors/CreateVendorValidator.cs` — Added phone/email rules
- `backend/src/PropertyManager.Api/Controllers/VendorsController.cs` — DTO + mapping expansion
- `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorHandlerTests.cs` — New tests
- `backend/tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs` — New tests
- `frontend/src/app/core/api/api.service.ts` — Regenerated API client
- `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.ts` — Full form expansion
- `frontend/src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts` — New tests

## Change Log

- 2026-03-02: Story created by SM agent (Bob) — comprehensive developer guide for full-size vendor creation form
- 2026-03-03: Implementation complete by Dev agent (Amelia, Claude Opus 4.6) — all tasks done, 1535 backend + 2594 frontend tests passing
