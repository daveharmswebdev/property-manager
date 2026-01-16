# Story 8.3: Create Vendor (Minimal)

Status: ready-for-review

## Story

As a **property owner**,
I want **to add a vendor with just their name**,
So that **I can quickly capture a new vendor without stopping to enter all details**.

## Acceptance Criteria

### Frontend - Vendors Page Navigation

1. **Given** I am logged in
   **When** I navigate to the Vendors page (`/vendors`)
   **Then** I see an "Add Vendor" button prominently displayed

2. **Given** I have no vendors
   **When** I view the Vendors page
   **Then** I see empty state: "No vendors yet. Add your first vendor to get started."
   **And** I see an "Add Vendor" button

### Frontend - Add Vendor Form

3. **Given** I am on the Vendors page
   **When** I click "Add Vendor"
   **Then** I see a form with fields:
   - First Name (required)
   - Last Name (required)
   - Middle Name (optional)

4. **Given** I enter a first and last name
   **When** I click "Save"
   **Then** the vendor is created with my AccountId
   **And** I see snackbar "Vendor added ✓"
   **And** I am returned to the vendor list
   **And** the new vendor appears in the list

### Frontend - Validation

5. **Given** I leave First Name empty
   **When** I try to submit
   **Then** I see validation error "First name is required"
   **And** the form does not submit

6. **Given** I leave Last Name empty
   **When** I try to submit
   **Then** I see validation error "Last name is required"
   **And** the form does not submit

### Backend - API

7. **Given** I call `POST /api/v1/vendors` with valid data:
   ```json
   {
     "firstName": "Joe",
     "lastName": "Smith",
     "middleName": "Allen"
   }
   ```
   **When** the request completes
   **Then** I receive 201 Created with `{ "id": "<guid>" }`
   **And** Location header contains `/api/v1/vendors/<guid>`
   **And** the vendor is created in the database with:
   - AccountId from current user's JWT
   - Phones = [] (empty JSONB array)
   - Emails = [] (empty JSONB array)
   - CreatedAt, UpdatedAt = current UTC timestamp

8. **Given** I call `POST /api/v1/vendors` with missing firstName
   **When** the request completes
   **Then** I receive 400 Bad Request with validation errors

## Tasks / Subtasks

### Task 1: Create Backend Command (AC: #7, #8)
- [x] 1.1 Create `CreateVendor.cs` command in Application/Vendors:
  - `CreateVendorCommand(string FirstName, string? MiddleName, string LastName) : IRequest<Guid>`
  - Handler creates Person and Vendor records using TPT pattern
  - Sets AccountId from ICurrentUser
  - Returns new Vendor Id
- [x] 1.2 Create `CreateVendorValidator.cs`:
  - FirstName: Required, max 100 chars
  - LastName: Required, max 100 chars
  - MiddleName: Optional, max 100 chars when provided

### Task 2: Update API Controller (AC: #7, #8)
- [x] 2.1 Add `POST /api/v1/vendors` endpoint to VendorsController:
  - Accept `CreateVendorRequest` DTO
  - Return 201 Created with `{ id }` and Location header
  - Include CancellationToken parameter
- [x] 2.2 Create `CreateVendorRequest.cs` record for API request body

### Task 3: Create Frontend Vendors Feature (AC: #1, #2, #3, #4, #5, #6)
- [x] 3.1 Create `vendors/` folder in frontend/src/app/features
- [x] 3.2 Create `VendorStore` using @ngrx/signals:
  - Signal: `vendors` - list of VendorDto
  - Signal: `isLoading` - loading state
  - Signal: `error` - error state
  - Method: `loadVendors()` - fetch from API
  - Method: `createVendor(command)` - POST to API, refresh list
- [x] 3.3 Create `vendor-list.component.ts`:
  - Display vendors in list format
  - Show "Add Vendor" button
  - Empty state when no vendors
  - Navigate to add vendor form on button click
- [x] 3.4 Create `vendor-form.component.ts`:
  - Reactive form with firstName, middleName, lastName
  - Required validation for firstName, lastName
  - Save button calls store.createVendor()
  - Cancel button navigates back
  - On success: snackbar + navigate to vendor list
- [x] 3.5 Create `vendors.routes.ts`:
  - `/vendors` → vendor-list.component
  - `/vendors/new` → vendor-form.component
- [x] 3.6 Add vendors route to app.routes.ts

### Task 4: Update Navigation (AC: #1)
- [x] 4.1 Add "Vendors" link to sidebar navigation
- [x] 4.2 Add route guard for authenticated access

### Task 5: Testing
- [x] 5.1 Create unit tests for CreateVendorCommandHandler:
  - Creates vendor with correct AccountId
  - Creates Person and Vendor records (TPT)
  - Returns new Id
  - Validator rejects missing firstName/lastName
- [x] 5.2 Test API endpoint via Postman/curl:
  - POST creates vendor successfully
  - Returns 201 with id and Location header
  - Returns 400 for invalid data
  - Returns 401 without JWT
- [x] 5.3 E2E test for vendor creation flow (optional)

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
PropertyManager.Application/
├── Vendors/
│   ├── VendorDto.cs           ← EXISTS from 8.1
│   ├── GetAllVendors.cs       ← EXISTS from 8.1
│   ├── CreateVendor.cs        ← NEW
│   └── CreateVendorValidator.cs  ← NEW

PropertyManager.Api/
├── Controllers/
│   └── VendorsController.cs   ← UPDATE: add POST endpoint

frontend/src/app/
├── features/
│   └── vendors/               ← NEW folder
│       ├── vendor-list.component.ts
│       ├── vendor-form.component.ts
│       ├── stores/
│       │   └── vendor.store.ts
│       └── vendors.routes.ts
├── app.routes.ts              ← UPDATE: add vendors route
└── core/
    └── components/
        └── sidebar/           ← UPDATE: add Vendors link
```

### TPT Vendor Creation Pattern

Creating a vendor requires inserting into BOTH Person and Vendor tables due to TPT inheritance. EF Core handles this automatically when using the Vendor entity:

```csharp
// Handler creates Vendor (which includes Person fields due to inheritance)
var vendor = new Vendor
{
    Id = Guid.NewGuid(),
    AccountId = _currentUser.AccountId,
    FirstName = request.FirstName,
    MiddleName = request.MiddleName,
    LastName = request.LastName,
    Phones = new List<PhoneNumber>(),
    Emails = new List<string>(),
    CreatedAt = DateTime.UtcNow,
    UpdatedAt = DateTime.UtcNow
};

// EF Core with TPT inserts into Persons first, then Vendors
await _dbContext.Vendors.AddAsync(vendor, cancellationToken);
await _dbContext.SaveChangesAsync(cancellationToken);
```

### Existing API Request DTO Pattern

Follow existing pattern from CreateExpense:

```csharp
// CreateVendorRequest.cs (in Api/Controllers or separate DTOs folder)
public record CreateVendorRequest(
    string FirstName,
    string? MiddleName,
    string LastName
);
```

### Angular Signals Pattern

Follow existing expense.store.ts pattern:

```typescript
// vendor.store.ts
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface VendorState {
  vendors: VendorDto[];
  isLoading: boolean;
  error: string | null;
}

export const VendorStore = signalStore(
  { providedIn: 'root' },
  withState<VendorState>({
    vendors: [],
    isLoading: false,
    error: null,
  }),
  withMethods((store, apiService = inject(ApiService)) => ({
    async loadVendors() {
      patchState(store, { isLoading: true, error: null });
      try {
        const response = await apiService.getVendors();
        patchState(store, { vendors: response.items, isLoading: false });
      } catch (e) {
        patchState(store, { error: 'Failed to load vendors', isLoading: false });
      }
    },
    async createVendor(command: CreateVendorCommand) {
      // Call API, then reload list
    }
  }))
);
```

### Angular Material Form Pattern

Follow existing expense-form pattern:

```typescript
// vendor-form.component.ts
@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field>
        <mat-label>First Name</mat-label>
        <input matInput formControlName="firstName" />
        <mat-error *ngIf="form.controls.firstName.hasError('required')">
          First name is required
        </mat-error>
      </mat-form-field>
      <!-- middleName, lastName fields -->
      <button mat-raised-button color="primary" type="submit"
              [disabled]="form.invalid || isSubmitting">
        Save
      </button>
      <button mat-button type="button" (click)="onCancel()">Cancel</button>
    </form>
  `
})
export class VendorFormComponent {
  form = new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    middleName: new FormControl('', [Validators.maxLength(100)]),
    lastName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
  });
}
```

### Snackbar Pattern

Follow existing pattern from expense components:

```typescript
import { MatSnackBar } from '@angular/material/snack-bar';

this.snackBar.open('Vendor added ✓', 'Dismiss', { duration: 3000 });
```

### Previous Story Learnings (8.1, 8.2)

1. **CancellationToken:** Always include CancellationToken in controller actions and pass to handlers.

2. **Tenant Isolation:** AccountId is set from ICurrentUser - DO NOT accept AccountId from client request.

3. **Request Body Null Check:** Add null check for `[FromBody]` parameter with proper ProblemDetails response.

4. **TPT Query Filter:** Global query filter on Person applies to Vendor queries automatically. Soft delete filter for Vendor is in handler (EF Core TPT limitation).

5. **Test Count Baseline:** 544 tests passing after 8.2 (353 Application + 33 Infrastructure + 158 Api).

### NSwag API Client Generation

After adding POST endpoint, regenerate TypeScript client:
```bash
cd frontend
npm run generate-api
```

This creates the typed `createVendor()` method in the generated API service.

### API Response Formats

**POST /api/v1/vendors (201 Created):**
```json
{
  "id": "abc-123-def-456"
}
```
+ `Location` header: `/api/v1/vendors/abc-123-def-456`

**POST /api/v1/vendors (400 Bad Request):**
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "firstName": ["First name is required"],
    "lastName": ["Last name is required"]
  },
  "traceId": "00-..."
}
```

### Project Structure Notes

- Vendors frontend folder follows properties/expenses pattern
- No new architectural patterns introduced
- Extends existing tenant isolation mechanism
- Uses standard Angular Material components

### Testing Requirements

**Unit Tests (Application Layer):**
- `CreateVendorHandlerTests.cs`:
  - Creates vendor with AccountId from current user
  - Sets CreatedAt and UpdatedAt to current UTC time
  - Initializes Phones and Emails as empty collections
  - Returns new vendor Id
  - Does not throw for valid input

- `CreateVendorValidatorTests.cs`:
  - Rejects empty firstName
  - Rejects empty lastName
  - Accepts valid firstName/lastName
  - Accepts null middleName
  - Rejects firstName > 100 chars
  - Rejects lastName > 100 chars
  - Rejects middleName > 100 chars when provided

**Manual Verification:**
- [ ] POST /api/v1/vendors creates vendor successfully
- [ ] Swagger shows POST endpoint with correct schema
- [ ] Response is 201 with id and Location header
- [ ] Database shows both Person and Vendor records
- [ ] GET /api/v1/vendors returns the new vendor
- [ ] Frontend /vendors page displays "Add Vendor" button
- [ ] Form validation shows errors for empty required fields
- [ ] Successful save shows snackbar and returns to list
- [ ] New vendor appears in vendor list

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR6 | Users can create a new vendor with minimal required fields (name only) | CreateVendor command with FirstName, LastName only required |
| FR9 | Users can view a list of all vendors | Vendor list component displays all vendors (partial - list view) |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - Vendor entity structure
- [Source: architecture.md#Frontend Structure] - Angular feature folder pattern
- [Source: epics-work-orders-vendors.md#Story 1.3] - Original story definition
- [Source: prd-work-orders-vendors.md#Vendor Management] - FR6 requirements
- [Source: 8-1-person-vendor-entity-foundation.md] - TPT inheritance pattern, test baseline
- [Source: 8-2-trade-tag-taxonomy-setup.md] - Controller patterns, CancellationToken requirement

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

1. **JSONB Dynamic JSON Issue:** Discovered that Npgsql 8.0+ requires `EnableDynamicJson()` for complex types like `List<PhoneNumber>` in JSONB columns. Fixed by configuring `NpgsqlDataSourceBuilder.EnableDynamicJson()` in both Program.cs and test factory.

2. **TPT Pattern:** EF Core handles TPT (Table-Per-Type) inheritance automatically - inserting into both Person and Vendor tables when creating a Vendor entity.

3. **Test Count:** 577 backend tests pass (374 Application + 33 Infrastructure + 170 API), 713 frontend tests pass.

4. **API Generation:** NSwag client regenerated after adding POST endpoint - now includes `vendors_CreateVendor` method.

5. **Routes implemented inline:** Instead of separate `vendors.routes.ts`, routes added directly to `app.routes.ts` following existing pattern for other features.

### File List

**Backend - New Files:**
- `src/PropertyManager.Application/Vendors/CreateVendor.cs` - Command and handler
- `src/PropertyManager.Application/Vendors/CreateVendorValidator.cs` - FluentValidation
- `tests/PropertyManager.Application.Tests/Vendors/CreateVendorHandlerTests.cs` - Unit tests (6 tests)
- `tests/PropertyManager.Application.Tests/Vendors/CreateVendorValidatorTests.cs` - Validator tests (11 tests)
- `tests/PropertyManager.Api.Tests/VendorsControllerCreateTests.cs` - API integration tests (12 tests)

**Backend - Modified Files:**
- `src/PropertyManager.Api/Controllers/VendorsController.cs` - Added POST endpoint
- `src/PropertyManager.Api/Program.cs` - Added EnableDynamicJson() for JSONB
- `tests/PropertyManager.Api.Tests/PropertyManagerWebApplicationFactory.cs` - Added EnableDynamicJson()

**Frontend - New Files:**
- `src/app/features/vendors/stores/vendor.store.ts` - Signal store
- `src/app/features/vendors/vendors.component.ts` - Vendor list page
- `src/app/features/vendors/components/vendor-form/vendor-form.component.ts` - Add vendor form

**Frontend - Modified Files:**
- `src/app/app.routes.ts` - Added /vendors and /vendors/new routes
- `src/app/core/components/sidebar-nav/sidebar-nav.component.ts` - Added Vendors nav item
- `src/app/core/components/sidebar-nav/sidebar-nav.component.spec.ts` - Updated tests for 8 nav items
- `src/app/core/api/api.service.ts` - Regenerated with vendors_CreateVendor

