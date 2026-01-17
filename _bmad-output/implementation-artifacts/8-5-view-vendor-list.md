# Story 8.5: View Vendor List

Status: review

## Story

As a **property owner**,
I want **to see all my vendors in a list**,
So that **I can quickly find and manage my vendor network**.

## Acceptance Criteria

### Frontend - Vendor List Display

1. **Given** I am logged in
   **When** I navigate to the Vendors page (`/vendors`)
   **Then** I see a list of all my vendors showing:
   - Vendor name (First Last)
   - Trade tags as chips/badges
   - Phone number (primary/first, if exists)
   - Email (primary/first, if exists)

### Frontend - Empty State

2. **Given** I have no vendors
   **When** I view the Vendors page
   **Then** I see empty state: "No vendors yet. Add your first vendor to get started."
   **And** I see an "Add Vendor" button

### Frontend - List Sorting

3. **Given** I have multiple vendors
   **When** I view the list
   **Then** vendors are sorted alphabetically by last name, then first name

### Frontend - Navigation

4. **Given** I click on a vendor row
   **When** the navigation completes
   **Then** I am taken to the vendor edit page (`/vendors/:id`)

### Backend - Enhanced VendorDto

5. **Given** I call `GET /api/v1/vendors`
   **When** the request completes successfully
   **Then** I receive vendors with enhanced data:
   ```json
   {
     "items": [
       {
         "id": "guid",
         "firstName": "Joe",
         "lastName": "Smith",
         "fullName": "Joe Smith",
         "phones": [
           { "number": "512-555-1234", "label": "Mobile" }
         ],
         "emails": ["joe@example.com"],
         "tradeTags": [
           { "id": "guid", "name": "Plumber" }
         ]
       }
     ],
     "totalCount": 1
   }
   ```

### Backend - Sorting

6. **Given** I call `GET /api/v1/vendors`
   **When** multiple vendors exist
   **Then** results are sorted alphabetically by lastName, then firstName

## Tasks / Subtasks

### Task 1: Enhance Backend VendorDto (AC: #5)
- [x] 1.1 Update `VendorDto.cs` to include additional fields:
  - `List<PhoneNumberDto> Phones`
  - `List<string> Emails`
  - `List<TradeTagDto> TradeTags`
- [x] 1.2 Create `PhoneNumberDto.cs` if not exists (record with Number, Label) - Reused from VendorDetailDto
- [x] 1.3 Create `TradeTagDto.cs` if not exists (record with Id, Name) - Reused VendorTradeTagDto

### Task 2: Update GetAllVendors Handler (AC: #5, #6)
- [x] 2.1 Update `GetAllVendorsQueryHandler` to include:
  - Join to VendorTradeTagAssignments and VendorTradeTags
  - Map Phones JSONB column to PhoneNumberDto list
  - Map Emails JSONB column to string list
- [x] 2.2 Ensure sorting is by LastName, then FirstName (verified - already implemented)
- [x] 2.3 Use Include/ThenInclude pattern for efficient loading of navigation properties

### Task 3: Regenerate TypeScript Client
- [x] 3.1 Run `npm run generate-api` in frontend folder
- [x] 3.2 Verify VendorDto in generated api.service.ts includes new fields

### Task 4: Enhance Frontend Vendor List Component (AC: #1, #3, #4)
- [x] 4.1 Update `vendors.component.ts` template to display:
  - Vendor name (already there)
  - Trade tags as CSS-styled chips
  - Primary phone number (first in list)
  - Primary email (first in list)
- [x] 4.2 Add responsive styling for list items
- [x] 4.3 Handle missing phone/email gracefully (show nothing, not "N/A")

### Task 5: Unit Tests - Backend (AC: #5, #6)
- [x] 5.1 Update `GetAllVendorsHandlerTests.cs`:
  - Test returns vendors with phones populated
  - Test returns vendors with emails populated
  - Test returns vendors with trade tags populated
  - Test sorting by lastName, firstName with enhanced data
  - Test vendor with no phones/emails/tags returns empty arrays

### Task 6: Component Tests - Frontend (AC: #1, #2, #3, #4)
- [x] 6.1 Update `vendors.component.spec.ts`:
  - Test trade tags render as chips
  - Test phone number displays
  - Test email displays
  - Test empty state still works
  - Test vendor cards are clickable

### Task 7: E2E Tests (AC: #1-#4)
- [x] 7.1 Create `vendor-list.spec.ts`:
  - Test vendor list shows trade tags after creating vendor with tags
  - Test vendor list shows phone/email after adding details
  - Test clicking vendor navigates to edit page

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Application/
├── Vendors/
│   ├── VendorDto.cs                   ← UPDATE: add Phones, Emails, TradeTags
│   ├── PhoneNumberDto.cs              ← NEW or reuse from VendorDetailDto
│   ├── TradeTagDto.cs                 ← NEW or reuse from VendorDetailDto
│   ├── GetAllVendors.cs               ← UPDATE: include joined data
│   └── GetAllVendorsHandlerTests.cs   ← UPDATE tests

frontend/src/app/
├── features/
│   └── vendors/
│       ├── vendors.component.ts       ← UPDATE: enhanced list display
│       └── vendors.component.spec.ts  ← UPDATE tests
```

### Key Implementation Pattern

The GetAllVendors query needs to efficiently load vendors with their trade tags. Use EF Core projection to avoid N+1:

```csharp
var vendors = await _dbContext.Vendors
    .Where(v => v.AccountId == _currentUser.AccountId && v.DeletedAt == null)
    .OrderBy(v => v.LastName)
    .ThenBy(v => v.FirstName)
    .Select(v => new VendorDto(
        v.Id,
        v.FirstName,
        v.LastName,
        string.IsNullOrWhiteSpace(v.MiddleName)
            ? v.FirstName + " " + v.LastName
            : v.FirstName + " " + v.MiddleName + " " + v.LastName,
        v.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList(),
        v.Emails.ToList(),
        v.TradeTagAssignments
            .Select(a => new TradeTagDto(a.TradeTag.Id, a.TradeTag.Name))
            .ToList()
    ))
    .AsNoTracking()
    .ToListAsync(cancellationToken);
```

### DTO Reuse Pattern

VendorDetailDto (from 8-4) already has PhoneNumberDto and uses VendorTradeTagDto. Consider:
- Reusing `PhoneNumberDto` from existing code
- Using the same `TradeTagDto` pattern as in VendorDetailDto
- Keep VendorDto and VendorDetailDto separate (list view vs detail view)

### Frontend Trade Tag Chips

Use Angular Material chips in the list:

```html
<div class="vendor-info">
  <span class="vendor-name">{{ vendor.fullName }}</span>
  <div class="vendor-details">
    @if (vendor.phones?.length) {
      <span class="phone">{{ vendor.phones[0].number }}</span>
    }
    @if (vendor.emails?.length) {
      <span class="email">{{ vendor.emails[0] }}</span>
    }
  </div>
  @if (vendor.tradeTags?.length) {
    <div class="trade-tags">
      @for (tag of vendor.tradeTags; track tag.id) {
        <span class="trade-tag-chip">{{ tag.name }}</span>
      }
    </div>
  }
</div>
```

Style chips with CSS (simpler than mat-chip for read-only display):

```scss
.trade-tag-chip {
  display: inline-block;
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 4px;
}
```

### Previous Story Learnings (8.1-8.4)

1. **JSONB with EnableDynamicJson:** Already configured in Program.cs for `List<PhoneNumber>` mapping.

2. **VendorTradeTagAssignment Junction:** Already exists from 8-4. Use `.TradeTagAssignments` navigation.

3. **Test Count Baseline:** After story 8-4, backend has ~580+ tests, frontend has ~785 tests.

4. **TPT Explicit Filters:** The handler already filters `DeletedAt == null` explicitly (required for TPT).

5. **Tenant Isolation:** Handler already filters by `AccountId` explicitly.

### API Response Format

**GET /api/v1/vendors (200 OK):**
```json
{
  "items": [
    {
      "id": "abc-123",
      "firstName": "Joe",
      "lastName": "Smith",
      "fullName": "Joe Smith",
      "phones": [
        { "number": "512-555-1234", "label": "Mobile" },
        { "number": "512-555-5678", "label": "Office" }
      ],
      "emails": ["joe@example.com"],
      "tradeTags": [
        { "id": "tag-1", "name": "Plumber" },
        { "id": "tag-2", "name": "General Contractor" }
      ]
    },
    {
      "id": "def-456",
      "firstName": "Jane",
      "lastName": "Doe",
      "fullName": "Jane Doe",
      "phones": [],
      "emails": [],
      "tradeTags": []
    }
  ],
  "totalCount": 2
}
```

### NSwag Regeneration

After updating VendorDto, regenerate TypeScript client:
```bash
cd frontend
npm run generate-api
```

This will update `VendorDto` in `api.service.ts` to include the new fields.

### Project Structure Notes

- No new architectural patterns introduced
- Reuses existing DTO patterns from 8-4 (VendorDetailDto)
- Frontend uses simple CSS chips rather than full mat-chip component for list view performance

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR9 | Users can view a list of all vendors | List shows all vendors with details |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - VendorDto, GetAllVendors pattern
- [Source: architecture.md#Decision 15] - JSONB for phones/emails
- [Source: epics-work-orders-vendors.md#Story 1.5] - Original story definition
- [Source: 8-4-add-vendor-details-trade-tags.md] - VendorDetailDto pattern, trade tag associations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

1. **VendorDto Enhancement** - Updated VendorDto record to include IReadOnlyList<PhoneNumberDto> Phones, IReadOnlyList<string> Emails, IReadOnlyList<VendorTradeTagDto> TradeTags. Reused existing PhoneNumberDto from VendorDetailDto and VendorTradeTagDto.

2. **GetAllVendors Handler** - Updated to use Include/ThenInclude pattern instead of inline projection. The inline Select with nested LINQ caused EF Core issues in integration tests. Pattern now matches GetVendor handler.

3. **Frontend Component** - Enhanced vendors.component.ts template to show phone, email, and trade tags. Used CSS-styled chips instead of mat-chip for better performance in list view. Added responsive styles for mobile.

4. **TypeScript Strict Null Handling** - Used non-null assertion (!) after checking array length to satisfy Angular's strict template type checking.

5. **Backend Tests** - Added 5 new tests to GetAllVendorsHandlerTests: phones, emails, tradeTags, empty lists, and sorting with enhanced data. Total backend tests: 624 (420 Application + 33 Infrastructure + 171 Api).

6. **Frontend Tests** - Added 8 new tests to vendors.component.spec.ts for trade tags, phone, email display and empty state handling. Total frontend tests: 825.

7. **E2E Tests** - Created new vendor-list.spec.ts with 6 tests covering trade tags, phone, email display, and navigation to edit page.

8. **Integration Test Fix** - Updated VendorsControllerCreateTests.cs local VendorDto record to match the new schema with Phones, Emails, TradeTags fields.

### File List

**Backend - Modified Files:**
- `src/PropertyManager.Application/Vendors/VendorDto.cs` - Add Phones, Emails, TradeTags fields, add using statement
- `src/PropertyManager.Application/Vendors/GetAllVendors.cs` - Include TradeTagAssignments navigation, use Include pattern
- `tests/PropertyManager.Application.Tests/Vendors/GetAllVendorsHandlerTests.cs` - Add 5 new tests for enhanced DTO fields
- `tests/PropertyManager.Api.Tests/VendorsControllerCreateTests.cs` - Update local VendorDto record to match new schema

**Frontend - Modified Files:**
- `src/app/features/vendors/vendors.component.ts` - Enhanced template and styles for phone, email, trade tags display
- `src/app/features/vendors/vendors.component.spec.ts` - Add 8 new tests for enhanced display
- `src/app/core/api/api.service.ts` - Regenerated with NSwag

**E2E Tests - New/Modified Files:**
- `e2e/pages/vendor.page.ts` - Add locators and assertions for list display (listTradeTagChips, listPhoneNumbers, listEmails, expectVendorHas* methods)
- `e2e/tests/vendors/vendor-list.spec.ts` - NEW: 6 E2E tests for vendor list display verification
