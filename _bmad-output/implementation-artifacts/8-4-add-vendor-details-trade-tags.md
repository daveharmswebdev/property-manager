# Story 8.4: Add Vendor Details & Trade Tags

Status: ready-for-dev

## Story

As a **property owner**,
I want **to add contact info and trade specialties to a vendor**,
So that **I can find them easily and know what jobs they handle**.

## Acceptance Criteria

### Frontend - Enhanced Vendor Form Fields

1. **Given** I am creating or editing a vendor
   **When** I view the form
   **Then** I see additional fields beyond name:
   - Phone Numbers (repeatable field with optional label: "Mobile", "Office", etc.)
   - Email Addresses (repeatable field)
   - Trade Tags (multi-select with autocomplete)

### Frontend - Phone Numbers (Repeatable)

2. **Given** I view the phone numbers section
   **When** I want to add a phone
   **Then** I see an "Add Phone" button that adds a new phone row

3. **Given** I add a phone number
   **When** I enter the number and optional label
   **Then** I can add multiple phone numbers
   **And** each can have its own label (e.g., "Mobile", "Office", "Home")

4. **Given** I have added a phone number row
   **When** I want to remove it
   **Then** I can click a delete icon to remove that phone row

### Frontend - Email Addresses (Repeatable)

5. **Given** I view the email addresses section
   **When** I want to add an email
   **Then** I see an "Add Email" button that adds a new email row

6. **Given** I add multiple email addresses
   **When** I view the form
   **Then** each email has its own input field with remove button

### Frontend - Trade Tags with Autocomplete

7. **Given** I type in the Trade Tags field
   **When** matching tags exist in my account
   **Then** I see autocomplete suggestions dropdown
   **And** I can select existing tags

8. **Given** I type a tag name that doesn't exist
   **When** I press Enter or select "Create new: [tag name]"
   **Then** a new trade tag is created for my account via API
   **And** it is assigned to this vendor

9. **Given** I have selected trade tags
   **When** I view the tags
   **Then** each tag appears as a removable chip
   **And** I can click X to remove a tag assignment

### Backend - Get Single Vendor

10. **Given** I call `GET /api/v1/vendors/{id}`
    **When** the vendor exists and belongs to my account
    **Then** I receive full vendor details:
    ```json
    {
      "id": "guid",
      "firstName": "Joe",
      "middleName": "Allen",
      "lastName": "Smith",
      "fullName": "Joe Allen Smith",
      "phones": [
        { "number": "512-555-1234", "label": "Mobile" }
      ],
      "emails": ["joe@example.com"],
      "tradeTags": [
        { "id": "guid", "name": "Plumber" }
      ]
    }
    ```

11. **Given** I call `GET /api/v1/vendors/{id}` for a non-existent vendor
    **When** the request completes
    **Then** I receive 404 Not Found

### Backend - Update Vendor

12. **Given** I call `PUT /api/v1/vendors/{id}` with:
    ```json
    {
      "firstName": "Joe",
      "middleName": "Allen",
      "lastName": "Smith",
      "phones": [
        { "number": "512-555-1234", "label": "Mobile" },
        { "number": "512-555-5678", "label": "Office" }
      ],
      "emails": ["joe@example.com", "joe.work@example.com"],
      "tradeTagIds": ["guid-1", "guid-2"]
    }
    ```
    **When** the request completes successfully
    **Then** I receive 204 No Content
    **And** the vendor's Person record is updated (FirstName, MiddleName, LastName, Phones, Emails)
    **And** the vendor's trade tag associations are updated (VendorTradeTagAssignments)
    **And** UpdatedAt timestamp is set

13. **Given** I update a vendor with invalid data (empty firstName/lastName)
    **When** the request completes
    **Then** I receive 400 Bad Request with validation errors

### Frontend - Save with Details

14. **Given** I save a vendor with phone, email, and trade tags
    **When** the save completes
    **Then** all details are persisted correctly via PUT endpoint
    **And** I see snackbar "Vendor updated ✓"
    **And** I see the updated info on the vendor list/detail

### Backend - VendorTradeTagAssignment Junction

15. **Given** I update a vendor's trade tags
    **When** I send different tradeTagIds than currently assigned
    **Then** old assignments are removed
    **And** new assignments are created
    **And** only tags belonging to my account can be assigned

## Tasks / Subtasks

### Task 1: Create Backend Get Vendor Query (AC: #10, #11)
- [ ] 1.1 Create `GetVendor.cs` query in Application/Vendors:
  - `GetVendorQuery(Guid VendorId) : IRequest<VendorDetailDto>`
  - Handler joins Vendor + Person + TradeTags
  - Returns full detail DTO
  - Throws NotFoundException if not found
- [ ] 1.2 Create `VendorDetailDto.cs`:
  - All Person fields (FirstName, MiddleName, LastName, FullName)
  - Phones as `List<PhoneNumberDto>` (number, label)
  - Emails as `List<string>`
  - TradeTags as `List<TradeTagDto>` (id, name)

### Task 2: Create Backend Update Vendor Command (AC: #12, #13, #15)
- [ ] 2.1 Create `UpdateVendor.cs` command in Application/Vendors:
  - `UpdateVendorCommand(Guid Id, string FirstName, string? MiddleName, string LastName, List<PhoneNumberDto> Phones, List<string> Emails, List<Guid> TradeTagIds) : IRequest`
  - Handler updates Person fields via TPT
  - Handler syncs VendorTradeTagAssignments
  - Sets UpdatedAt = DateTime.UtcNow
- [ ] 2.2 Create `UpdateVendorValidator.cs`:
  - FirstName: Required, max 100 chars
  - LastName: Required, max 100 chars
  - MiddleName: Optional, max 100 chars
  - Phones: Each number max 50 chars, label max 50 chars
  - Emails: Each max 255 chars, valid email format
  - TradeTagIds: Must belong to current account (validated in handler)

### Task 3: Add VendorTradeTagAssignment Entity (AC: #15)
- [ ] 3.1 Create `VendorTradeTagAssignment.cs` entity in Domain/Entities:
  - VendorId (Guid, FK)
  - TradeTagId (Guid, FK)
  - Navigation properties
- [ ] 3.2 Create `VendorTradeTagAssignmentConfiguration.cs`:
  - Composite primary key (VendorId, TradeTagId)
  - Foreign key relationships
- [ ] 3.3 Add DbSet to IAppDbContext and AppDbContext
- [ ] 3.4 Update Vendor entity with navigation collection
- [ ] 3.5 Update VendorTradeTag entity with navigation collection
- [ ] 3.6 Create database migration

### Task 4: Update API Controller (AC: #10, #11, #12, #13)
- [ ] 4.1 Add `GET /api/v1/vendors/{id}` endpoint:
  - Returns VendorDetailDto
  - 200 OK or 404 Not Found
- [ ] 4.2 Add `PUT /api/v1/vendors/{id}` endpoint:
  - Accept `UpdateVendorRequest` DTO
  - Return 204 No Content on success
  - Include CancellationToken
- [ ] 4.3 Create request DTOs for update endpoint

### Task 5: Update Frontend Vendor Store (AC: #7, #8, #14)
- [ ] 5.1 Add `loadVendor(id)` method to VendorStore:
  - Fetches single vendor detail
  - Stores in `selectedVendor` signal
- [ ] 5.2 Add `updateVendor(id, command)` method:
  - PUT to API
  - Snackbar on success
  - Navigate back to list
- [ ] 5.3 Add `loadTradeTags()` method:
  - Fetches available trade tags for autocomplete
  - Stores in `tradeTags` signal
- [ ] 5.4 Add `createTradeTag(name)` method:
  - Creates new tag via API
  - Returns created tag for immediate use

### Task 6: Create Frontend Vendor Edit Route/Component (AC: #1-#9, #14)
- [ ] 6.1 Add `/vendors/:id/edit` route to app.routes.ts
- [ ] 6.2 Create `vendor-edit.component.ts` (or update vendor-form for edit mode):
  - Load existing vendor data on init
  - Pre-populate form with current values
  - Handle both create and edit modes

### Task 7: Enhance Vendor Form with Phone Fields (AC: #2, #3, #4)
- [ ] 7.1 Add phone number FormArray to form:
  - FormGroup with `number` and `label` controls
  - Add phone row button
  - Remove phone row button per row
- [ ] 7.2 Style phone fields with Angular Material:
  - Two columns: number input, label dropdown/input
  - Delete icon button

### Task 8: Enhance Vendor Form with Email Fields (AC: #5, #6)
- [ ] 8.1 Add email FormArray to form:
  - Simple string email input per row
  - Add email row button
  - Remove email row button
- [ ] 8.2 Add email validation (format check)

### Task 9: Implement Trade Tag Autocomplete (AC: #7, #8, #9)
- [ ] 9.1 Add trade tag chip list with autocomplete:
  - Use MatChipGrid + MatAutocomplete
  - Filter suggestions as user types
  - Add selected tags as chips
- [ ] 9.2 Implement create-on-the-fly:
  - Show "Create: [new tag]" option when no match
  - Call createTradeTag API, add result to chips
- [ ] 9.3 Implement chip removal:
  - X button on each chip
  - Updates form control

### Task 10: Unit & Integration Testing
- [ ] 10.1 Unit tests for GetVendorHandler:
  - Returns vendor with all details
  - Throws NotFoundException for missing vendor
  - Includes phones, emails, trade tags
- [ ] 10.2 Unit tests for UpdateVendorHandler:
  - Updates Person fields
  - Syncs trade tag assignments (add/remove)
  - Sets UpdatedAt
  - Validates required fields
- [ ] 10.3 API integration tests for new endpoints:
  - GET /api/v1/vendors/{id} returns full detail
  - PUT /api/v1/vendors/{id} updates successfully
  - PUT returns 400 for invalid data
  - PUT returns 404 for non-existent vendor
- [ ] 10.4 Frontend component tests:
  - Phone add/remove functionality
  - Email add/remove functionality
  - Trade tag autocomplete behavior
  - Create-on-the-fly trade tag
  - Form submission with all fields

### Task 11: E2E Tests with Playwright (AC: #1-#9, #14)
- [ ] 11.1 Create `vendors.page.ts` page object in e2e/pages:
  - Locators for vendor list, add button, edit button
  - Methods: goto(), clickAddVendor(), clickEditVendor(name), expectVendorInList(name)
- [ ] 11.2 Create `vendor-form.page.ts` page object in e2e/pages:
  - Locators for all form fields (name, phones, emails, trade tags)
  - Methods: fillBasicInfo(), addPhone(number, label), removePhone(index)
  - Methods: addEmail(email), removeEmail(index)
  - Methods: addTradeTag(name), removeTradeTag(name), createNewTradeTag(name)
  - Methods: submit(), cancel()
- [ ] 11.3 Update `test-fixtures.ts` with new page objects:
  - Add vendorsPage fixture
  - Add vendorFormPage fixture
- [ ] 11.4 Create `vendor-flow.spec.ts` in e2e/tests/vendors:
  - Test: Create vendor with name only, see in list (smoke test for 8-3)
  - Test: Edit vendor, add phone/email/trade tag, verify saved
  - Test: Form validation shows errors for empty required fields
- [ ] 11.5 Add TestDataHelper methods for vendor test data:
  - generateVendor() with random name
  - generatePhone() with random number and label
  - generateTradeTag() with random name

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Domain/
├── Entities/
│   ├── Vendor.cs                      ← UPDATE: add TradeTags navigation
│   ├── VendorTradeTag.cs              ← UPDATE: add Vendors navigation
│   └── VendorTradeTagAssignment.cs    ← NEW: junction entity

PropertyManager.Application/
├── Vendors/
│   ├── VendorDto.cs                   ← EXISTS (list view)
│   ├── VendorDetailDto.cs             ← NEW (full detail)
│   ├── GetAllVendors.cs               ← EXISTS
│   ├── GetVendor.cs                   ← NEW
│   ├── CreateVendor.cs                ← EXISTS
│   ├── UpdateVendor.cs                ← NEW
│   └── UpdateVendorValidator.cs       ← NEW

PropertyManager.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── VendorConfiguration.cs             ← UPDATE
│   │   └── VendorTradeTagAssignmentConfiguration.cs  ← NEW
│   └── Migrations/
│       └── (new migration for junction table)

PropertyManager.Api/
├── Controllers/
│   └── VendorsController.cs           ← UPDATE: add GET /{id}, PUT /{id}

frontend/src/app/
├── features/
│   └── vendors/
│       ├── stores/
│       │   └── vendor.store.ts        ← UPDATE: add loadVendor, updateVendor, tradeTags
│       ├── components/
│       │   ├── vendor-form/           ← UPDATE: add phone/email/tags fields
│       │   └── trade-tag-input/       ← NEW: reusable autocomplete component
│       └── vendors.routes.ts          ← OR app.routes.ts: add edit route
```

### Junction Table Pattern

VendorTradeTagAssignment follows the existing junction table pattern (similar to CategoryTradeTagMappings):

```csharp
// Entity
public class VendorTradeTagAssignment
{
    public Guid VendorId { get; set; }
    public Guid TradeTagId { get; set; }

    public Vendor Vendor { get; set; } = null!;
    public VendorTradeTag TradeTag { get; set; } = null!;
}

// Configuration
builder.HasKey(e => new { e.VendorId, e.TradeTagId });
builder.HasOne(e => e.Vendor)
    .WithMany(v => v.TradeTagAssignments)
    .HasForeignKey(e => e.VendorId);
builder.HasOne(e => e.TradeTag)
    .WithMany(t => t.VendorAssignments)
    .HasForeignKey(e => e.TradeTagId);
```

### UpdateVendor Trade Tag Sync Pattern

```csharp
// In UpdateVendorHandler
// Get current assignments
var currentAssignments = await _dbContext.VendorTradeTagAssignments
    .Where(a => a.VendorId == request.Id)
    .ToListAsync(cancellationToken);

var currentTagIds = currentAssignments.Select(a => a.TradeTagId).ToHashSet();
var newTagIds = request.TradeTagIds.ToHashSet();

// Remove old assignments
var toRemove = currentAssignments.Where(a => !newTagIds.Contains(a.TradeTagId));
_dbContext.VendorTradeTagAssignments.RemoveRange(toRemove);

// Add new assignments
var toAdd = newTagIds.Except(currentTagIds)
    .Select(tagId => new VendorTradeTagAssignment
    {
        VendorId = request.Id,
        TradeTagId = tagId
    });
await _dbContext.VendorTradeTagAssignments.AddRangeAsync(toAdd, cancellationToken);
```

### Angular FormArray for Repeatable Fields

```typescript
// Phone numbers FormArray
phonesArray = new FormArray<FormGroup>([]);

addPhone(): void {
  this.phonesArray.push(this.fb.group({
    number: ['', [Validators.maxLength(50)]],
    label: ['', [Validators.maxLength(50)]]
  }));
}

removePhone(index: number): void {
  this.phonesArray.removeAt(index);
}

// In template
@for (phone of phonesArray.controls; track $index) {
  <div class="phone-row">
    <mat-form-field>
      <mat-label>Phone Number</mat-label>
      <input matInput [formControl]="phone.get('number')" />
    </mat-form-field>
    <mat-form-field>
      <mat-label>Label</mat-label>
      <input matInput [formControl]="phone.get('label')" placeholder="Mobile, Office, etc." />
    </mat-form-field>
    <button mat-icon-button (click)="removePhone($index)">
      <mat-icon>delete</mat-icon>
    </button>
  </div>
}
<button mat-button (click)="addPhone()">
  <mat-icon>add</mat-icon> Add Phone
</button>
```

### Trade Tag Autocomplete Pattern

```typescript
// Use MatChipGrid with MatAutocomplete
import { MatChipGrid, MatChipRow, MatChipInput } from '@angular/material/chips';
import { MatAutocomplete, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

// Filter trade tags based on input
filteredTags$ = this.tagInput.valueChanges.pipe(
  startWith(''),
  map(value => this.filterTags(value))
);

filterTags(value: string): VendorTradeTagDto[] {
  const filterValue = value?.toLowerCase() || '';
  return this.allTags().filter(tag =>
    tag.name.toLowerCase().includes(filterValue) &&
    !this.selectedTagIds().includes(tag.id)
  );
}

// Add tag from autocomplete selection
onTagSelected(event: MatAutocompleteSelectedEvent): void {
  const tag = event.option.value as VendorTradeTagDto;
  this.selectedTags.update(tags => [...tags, tag]);
  this.tagInput.setValue('');
}

// Create new tag on-the-fly
async createNewTag(name: string): Promise<void> {
  const newTag = await firstValueFrom(this.store.createTradeTag(name));
  this.selectedTags.update(tags => [...tags, newTag]);
}
```

### E2E Test Patterns (Playwright)

Follow existing patterns from property-flow.spec.ts and expense-flow.spec.ts:

**Page Object Pattern (vendors.page.ts):**
```typescript
import { Page, Locator } from '@playwright/test';

export class VendorsPage {
  readonly page: Page;
  readonly addVendorButton: Locator;
  readonly vendorList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addVendorButton = page.getByRole('button', { name: /add vendor/i });
    this.vendorList = page.locator('app-vendor-list');
  }

  async goto(): Promise<void> {
    await this.page.goto('/vendors');
  }

  async clickAddVendor(): Promise<void> {
    await this.addVendorButton.click();
  }

  async clickEditVendor(vendorName: string): Promise<void> {
    await this.page.locator(`[data-testid="vendor-row"]`, { hasText: vendorName })
      .getByRole('button', { name: /edit/i }).click();
  }

  async expectVendorInList(vendorName: string): Promise<void> {
    await expect(this.page.locator('[data-testid="vendor-row"]', { hasText: vendorName })).toBeVisible();
  }
}
```

**Vendor Form Page Object (vendor-form.page.ts):**
```typescript
export class VendorFormPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly addPhoneButton: Locator;
  readonly addEmailButton: Locator;
  readonly tradeTagInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByLabel(/first name/i);
    this.lastNameInput = page.getByLabel(/last name/i);
    this.addPhoneButton = page.getByRole('button', { name: /add phone/i });
    this.addEmailButton = page.getByRole('button', { name: /add email/i });
    this.tradeTagInput = page.getByLabel(/trade tags/i);
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async addPhone(number: string, label?: string): Promise<void> {
    await this.addPhoneButton.click();
    const phoneRows = this.page.locator('[data-testid="phone-row"]');
    const lastRow = phoneRows.last();
    await lastRow.getByLabel(/phone number/i).fill(number);
    if (label) {
      await lastRow.getByLabel(/label/i).fill(label);
    }
  }

  async addTradeTag(tagName: string): Promise<void> {
    await this.tradeTagInput.fill(tagName);
    await this.page.getByRole('option', { name: tagName }).click();
  }

  async createNewTradeTag(tagName: string): Promise<void> {
    await this.tradeTagInput.fill(tagName);
    await this.page.getByRole('option', { name: new RegExp(`create.*${tagName}`, 'i') }).click();
  }
}
```

**Test Data Helper Extension:**
```typescript
// Add to test-data.helper.ts
static generateVendor(): { firstName: string; lastName: string } {
  const timestamp = Date.now();
  return {
    firstName: `TestVendor${timestamp}`,
    lastName: `Smith${timestamp % 1000}`,
  };
}

static generatePhone(): { number: string; label: string } {
  const rand = Math.floor(Math.random() * 9000000) + 1000000;
  return {
    number: `512-555-${rand.toString().slice(0, 4)}`,
    label: ['Mobile', 'Office', 'Home'][Math.floor(Math.random() * 3)],
  };
}
```

**E2E Test Structure (vendor-flow.spec.ts):**
```typescript
import { test, expect } from '../../fixtures/test-fixtures';
import { TestDataHelper } from '../../helpers/test-data.helper';

test.describe('Vendor Management Flow', () => {
  test('create vendor, edit with details, verify saved', async ({
    page,
    authenticatedUser,
    vendorsPage,
    vendorFormPage,
  }) => {
    // Step 1: Navigate to vendors
    await vendorsPage.goto();

    // Step 2: Create vendor with name only
    const vendor = TestDataHelper.generateVendor();
    await vendorsPage.clickAddVendor();
    await vendorFormPage.fillBasicInfo(vendor);
    await vendorFormPage.submit();

    // Step 3: Verify vendor in list
    await vendorsPage.expectVendorInList(`${vendor.firstName} ${vendor.lastName}`);

    // Step 4: Edit vendor, add phone/email/tag
    await vendorsPage.clickEditVendor(`${vendor.firstName} ${vendor.lastName}`);
    const phone = TestDataHelper.generatePhone();
    await vendorFormPage.addPhone(phone.number, phone.label);
    await vendorFormPage.addEmail('test@example.com');
    await vendorFormPage.createNewTradeTag('Plumber');
    await vendorFormPage.submit();

    // Step 5: Verify details saved (re-edit and check)
    await vendorsPage.clickEditVendor(`${vendor.firstName} ${vendor.lastName}`);
    await expect(page.getByDisplayValue(phone.number)).toBeVisible();
  });
});
```

### Previous Story Learnings (8.1, 8.2, 8.3)

1. **JSONB EnableDynamicJson:** Npgsql 8.0+ requires `EnableDynamicJson()` for complex JSONB types like `List<PhoneNumber>`. Already configured in Program.cs and test factory.

2. **TPT Pattern:** When updating a Vendor, EF Core handles updating both Person and Vendor tables automatically. Just update the Vendor entity properties.

3. **CancellationToken:** Always include CancellationToken in controller actions and pass through to handlers/DbContext operations.

4. **Test Count Baseline:** 577 backend tests (374 Application + 33 Infrastructure + 170 API), 785 frontend tests after story 8.3.

5. **Tenant Isolation:** Always validate that trade tags belong to current user's account before assignment. Use global query filter + explicit validation.

6. **Trade Tag Case Insensitivity:** VendorTradeTags have case-insensitive unique index. Comparison should use ToLower().

### API Response Formats

**GET /api/v1/vendors/{id} (200 OK):**
```json
{
  "id": "abc-123",
  "firstName": "Joe",
  "middleName": "Allen",
  "lastName": "Smith",
  "fullName": "Joe Allen Smith",
  "phones": [
    { "number": "512-555-1234", "label": "Mobile" },
    { "number": "512-555-5678", "label": "Office" }
  ],
  "emails": ["joe@example.com"],
  "tradeTags": [
    { "id": "tag-1", "name": "Plumber" },
    { "id": "tag-2", "name": "General Contractor" }
  ]
}
```

**PUT /api/v1/vendors/{id} (204 No Content):** No body

**PUT /api/v1/vendors/{id} (400 Bad Request):**
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "firstName": ["First name is required"],
    "phones[0].number": ["Phone number must be 50 characters or less"]
  },
  "traceId": "00-..."
}
```

### NSwag Regeneration

After adding GET and PUT endpoints, regenerate TypeScript client:
```bash
cd frontend
npm run generate-api
```

This creates `vendors_GetVendor(id)` and `vendors_UpdateVendor(id, request)` methods.

### Project Structure Notes

- No new architectural patterns introduced
- Junction table follows existing CategoryTradeTagMapping pattern
- Frontend uses standard Angular Material form patterns
- Trade tag autocomplete can be extracted to shared component for reuse in Work Orders (Story 2.3)

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR7 | Users can add optional vendor details (phone, email, trade tags) at any time | Update endpoint accepts phones, emails, tradeTagIds |
| FR8 | Users can assign one or more trade tags to a vendor | VendorTradeTagAssignment junction table, multi-select in form |
| FR41 | Users see autocomplete suggestions when entering tags | MatAutocomplete with filtered tag list |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - Vendor entity, JSONB phone/email, trade tag assignments
- [Source: architecture.md#Decision 17] - Taxonomy structure: flat trade tags, junction table
- [Source: epics-work-orders-vendors.md#Story 1.4] - Original story definition with ACs
- [Source: prd-work-orders-vendors.md#Vendor Management] - FR7, FR8, FR41 requirements
- [Source: 8-3-create-vendor-minimal.md] - Existing VendorsController, VendorStore, VendorFormComponent patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**Backend - New Files:**
- `src/PropertyManager.Domain/Entities/VendorTradeTagAssignment.cs`
- `src/PropertyManager.Application/Vendors/GetVendor.cs`
- `src/PropertyManager.Application/Vendors/VendorDetailDto.cs`
- `src/PropertyManager.Application/Vendors/UpdateVendor.cs`
- `src/PropertyManager.Application/Vendors/UpdateVendorValidator.cs`
- `src/PropertyManager.Infrastructure/Persistence/Configurations/VendorTradeTagAssignmentConfiguration.cs`
- `tests/PropertyManager.Application.Tests/Vendors/GetVendorHandlerTests.cs`
- `tests/PropertyManager.Application.Tests/Vendors/UpdateVendorHandlerTests.cs`
- `tests/PropertyManager.Application.Tests/Vendors/UpdateVendorValidatorTests.cs`
- `tests/PropertyManager.Api.Tests/VendorsControllerGetTests.cs`
- `tests/PropertyManager.Api.Tests/VendorsControllerUpdateTests.cs`

**Backend - Modified Files:**
- `src/PropertyManager.Domain/Entities/Vendor.cs` - Add TradeTagAssignments navigation
- `src/PropertyManager.Domain/Entities/VendorTradeTag.cs` - Add VendorAssignments navigation
- `src/PropertyManager.Application/Common/Interfaces/IAppDbContext.cs` - Add DbSet
- `src/PropertyManager.Infrastructure/Persistence/AppDbContext.cs` - Add DbSet
- `src/PropertyManager.Api/Controllers/VendorsController.cs` - Add GET/{id}, PUT/{id}

**Frontend - New Files:**
- `src/app/features/vendors/components/trade-tag-input/trade-tag-input.component.ts`
- `src/app/features/vendors/components/trade-tag-input/trade-tag-input.component.spec.ts`

**Frontend - Modified Files:**
- `src/app/features/vendors/stores/vendor.store.ts` - Add loadVendor, updateVendor, tradeTags
- `src/app/features/vendors/stores/vendor.store.spec.ts` - Add tests
- `src/app/features/vendors/components/vendor-form/vendor-form.component.ts` - Add phone/email/tags
- `src/app/features/vendors/components/vendor-form/vendor-form.component.spec.ts` - Add tests
- `src/app/app.routes.ts` - Add /vendors/:id/edit route
- `src/app/core/api/api.service.ts` - Regenerated

**E2E Tests - New Files:**
- `e2e/pages/vendors.page.ts` - Vendors list page object
- `e2e/pages/vendor-form.page.ts` - Vendor form page object
- `e2e/tests/vendors/vendor-flow.spec.ts` - Vendor management E2E tests

**E2E Tests - Modified Files:**
- `e2e/fixtures/test-fixtures.ts` - Add vendorsPage, vendorFormPage fixtures
- `e2e/helpers/test-data.helper.ts` - Add generateVendor(), generatePhone()
