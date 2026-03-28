# Story 8.6: Search & Filter Vendors

Status: dev-complete

## Story

As a **property owner**,
I want **to search and filter my vendors by name or trade**,
So that **I can quickly find the right vendor for a job**.

## Acceptance Criteria

### Frontend - Real-Time Search (AC #1)

1. **Given** I am on the Vendors page with multiple vendors
   **When** I type in the search box
   **Then** the list filters in real-time to show vendors matching the search text
   **And** search matches against first name, last name, or combined name (case-insensitive)

### Frontend - Trade Tag Filter (AC #2)

2. **Given** I want to filter by trade
   **When** I select one or more trade tags from the filter dropdown
   **Then** only vendors with those trade tags are shown
   **And** the filter dropdown shows all available trade tags in my account

### Frontend - Combined Filters (AC #3)

3. **Given** I apply both search and trade filter
   **When** the filters are active
   **Then** results match both criteria (AND logic)
   **And** I see active filter indicators
   **And** I see a "Clear filters" link

### Frontend - No Results State (AC #4)

4. **Given** no vendors match my filters
   **When** the list is empty
   **Then** I see "No vendors match your search" with a clear filters option
   **And** this is different from the "No vendors yet" empty state when no vendors exist at all

## Tasks / Subtasks

### Task 1: Add Filter State to VendorStore (AC: #1-#4)
- [x] 1.1 Add `searchTerm: string` to VendorState interface (default: '')
- [x] 1.2 Add `selectedTradeTagIds: string[]` to VendorState interface (default: [])
- [x] 1.3 Add `filteredVendors` computed signal that applies search and trade tag filters
- [x] 1.4 Add `setSearchTerm(term: string)` method
- [x] 1.5 Add `setTradeTagFilter(tagIds: string[])` method
- [x] 1.6 Add `clearFilters()` method
- [x] 1.7 Add `hasActiveFilters` computed signal
- [x] 1.8 Add `noMatchesFound` computed signal (has vendors but filtered to empty)

### Task 2: Update Vendors Component Template (AC: #1-#4)
- [x] 2.1 Add filter bar section between header and vendor list
- [x] 2.2 Add search input with mat-form-field, debounced input (300ms)
- [x] 2.3 Add trade tag multi-select dropdown using mat-select with mat-option
- [x] 2.4 Add "Clear filters" button (visible when hasActiveFilters)
- [x] 2.5 Update @for loop to use `store.filteredVendors()` instead of `store.vendors()`
- [x] 2.6 Add "No vendors match your search" empty state (distinct from no vendors state)

### Task 3: Load Trade Tags on Page Init (AC: #2)
- [x] 3.1 Call `store.loadTradeTags()` in ngOnInit alongside loadVendors
- [x] 3.2 Use `store.tradeTags()` to populate filter dropdown options

### Task 4: Styling for Filter Controls (AC: #1-#3)
- [x] 4.1 Add filter-bar container with flex layout
- [x] 4.2 Style search input to be prominent
- [x] 4.3 Style trade tag dropdown to show chip previews when tags selected
- [x] 4.4 Add responsive styles for mobile (stack filters vertically)
- [x] 4.5 Add active filter indicator styling

### Task 5: Unit Tests - Store (AC: #1-#4)
- [x] 5.1 Test filteredVendors with search term matches first name
- [x] 5.2 Test filteredVendors with search term matches last name
- [x] 5.3 Test filteredVendors with search term matches combined full name
- [x] 5.4 Test filteredVendors with trade tag filter (single tag)
- [x] 5.5 Test filteredVendors with trade tag filter (multiple tags - OR within tags)
- [x] 5.6 Test filteredVendors with combined search + trade filter (AND logic)
- [x] 5.7 Test clearFilters resets both searchTerm and selectedTradeTagIds
- [x] 5.8 Test hasActiveFilters returns true when either filter is set
- [x] 5.9 Test noMatchesFound distinguishes from empty vendor list

### Task 6: Component Tests - Frontend (AC: #1-#4)
- [x] 6.1 Test search input renders and is functional
- [x] 6.2 Test trade tag dropdown renders with available tags
- [x] 6.3 Test typing in search filters the list
- [x] 6.4 Test selecting trade tags filters the list
- [x] 6.5 Test "Clear filters" appears when filters active
- [x] 6.6 Test clicking "Clear filters" resets both filters
- [x] 6.7 Test "No vendors match your search" state renders correctly
- [x] 6.8 Test original empty state still works when no vendors exist

### Task 7: E2E Tests (AC: #1-#4)
- [x] 7.1 Create `vendor-search-filter.spec.ts`
- [x] 7.2 Test search by first name finds correct vendor
- [x] 7.3 Test search by last name finds correct vendor
- [x] 7.4 Test search by partial name finds vendors
- [x] 7.5 Test trade tag filter shows only matching vendors
- [x] 7.6 Test combined filters work correctly
- [x] 7.7 Test clear filters restores full list
- [x] 7.8 Test "No vendors match" message appears when no results

## Dev Notes

### Architecture Compliance

**Clean Architecture Layers:**
```
frontend/src/app/
├── features/
│   └── vendors/
│       ├── stores/
│       │   └── vendor.store.ts        ← UPDATE: add filter state and methods
│       ├── vendors.component.ts       ← UPDATE: add filter UI
│       └── vendors.component.spec.ts  ← UPDATE: add filter tests
```

### Implementation Strategy: Client-Side Filtering

For this story, **client-side filtering** is the optimal approach because:
1. Typical vendor lists are small (< 100 vendors per account)
2. Vendors are already fully loaded with trade tags from Story 8-5
3. Avoids additional API calls for real-time filtering
4. Simpler implementation with better UX (instant feedback)

Future optimization: If accounts grow to 500+ vendors, add server-side filtering with query parameters.

### VendorStore State Updates

Add to `VendorState` interface:
```typescript
interface VendorState {
  vendors: VendorDto[];
  selectedVendor: VendorDetailDto | null;
  tradeTags: VendorTradeTagDto[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  // NEW: Filter state
  searchTerm: string;
  selectedTradeTagIds: string[];
}
```

### Filtered Vendors Computed Signal

```typescript
filteredVendors: computed(() => {
  const vendors = store.vendors();
  const searchTerm = store.searchTerm().toLowerCase().trim();
  const selectedTagIds = store.selectedTradeTagIds();

  return vendors.filter(vendor => {
    // Search filter: match first, last, or full name
    const matchesSearch = !searchTerm ||
      vendor.firstName.toLowerCase().includes(searchTerm) ||
      vendor.lastName.toLowerCase().includes(searchTerm) ||
      vendor.fullName.toLowerCase().includes(searchTerm);

    // Trade tag filter: vendor must have at least one of selected tags
    const matchesTags = selectedTagIds.length === 0 ||
      (vendor.tradeTags?.some(tag => selectedTagIds.includes(tag.id)) ?? false);

    // AND logic: must match both
    return matchesSearch && matchesTags;
  });
}),
```

### Filter Bar Template Pattern

```html
<!-- Filter Bar -->
<div class="filter-bar">
  <!-- Search Input -->
  <mat-form-field appearance="outline" class="search-field">
    <mat-label>Search vendors</mat-label>
    <input matInput
           [value]="store.searchTerm()"
           (input)="onSearchChange($event)"
           placeholder="Search by name...">
    <mat-icon matPrefix>search</mat-icon>
    @if (store.searchTerm()) {
      <button matSuffix mat-icon-button (click)="clearSearch()">
        <mat-icon>close</mat-icon>
      </button>
    }
  </mat-form-field>

  <!-- Trade Tag Filter -->
  <mat-form-field appearance="outline" class="tag-filter-field">
    <mat-label>Filter by trade</mat-label>
    <mat-select multiple
                [value]="store.selectedTradeTagIds()"
                (selectionChange)="onTagFilterChange($event)">
      @for (tag of store.tradeTags(); track tag.id) {
        <mat-option [value]="tag.id">{{ tag.name }}</mat-option>
      }
    </mat-select>
  </mat-form-field>

  <!-- Clear Filters -->
  @if (store.hasActiveFilters()) {
    <button mat-button color="primary" (click)="store.clearFilters()">
      <mat-icon>clear</mat-icon>
      Clear filters
    </button>
  }
</div>
```

### No Matches Empty State

```html
<!-- No Matches State (distinct from no vendors) -->
@if (store.noMatchesFound()) {
  <mat-card class="no-matches-card">
    <mat-icon class="no-matches-icon">search_off</mat-icon>
    <h2>No vendors match your search</h2>
    <p>Try adjusting your filters</p>
    <button mat-stroked-button color="primary" (click)="store.clearFilters()">
      Clear filters
    </button>
  </mat-card>
}
```

### Required Angular Material Imports

Add to vendors.component.ts imports:
```typescript
imports: [
  // Existing...
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
]
```

### Debounced Search Input

Use RxJS for debounced search (prevents excessive filtering):

```typescript
private searchSubject = new Subject<string>();
private searchSubscription?: Subscription;

ngOnInit(): void {
  this.store.loadVendors();
  this.store.loadTradeTags();

  // Debounced search
  this.searchSubscription = this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged()
  ).subscribe(term => {
    this.store.setSearchTerm(term);
  });
}

onSearchChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  this.searchSubject.next(value);
}

ngOnDestroy(): void {
  this.searchSubscription?.unsubscribe();
}
```

### Previous Story Learnings (8-5)

1. **VendorDto Structure:** Already includes `tradeTags: VendorTradeTagDto[]` with id and name.

2. **Trade Tags Loaded Separately:** Store has `loadTradeTags()` method that populates `tradeTags` state.

3. **Test Baselines:** Backend: 624 tests, Frontend: 825 tests.

4. **CSS Trade Tag Chips:** Already styled in vendors.component.ts - reuse pattern for filter dropdown chips.

### Responsive Design

```scss
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  min-width: 200px;
}

.tag-filter-field {
  min-width: 180px;
}

@media (max-width: 600px) {
  .filter-bar {
    flex-direction: column;
  }

  .search-field,
  .tag-filter-field {
    width: 100%;
  }
}
```

### Testing Trade Tag Filter Logic

Trade tag filter uses OR logic within tags (vendor matches if they have ANY of the selected tags):
- Selected: [Plumber, Electrician]
- Vendor with [Plumber] → matches
- Vendor with [Electrician] → matches
- Vendor with [Plumber, HVAC] → matches
- Vendor with [HVAC] → does NOT match

Combined with search uses AND logic:
- Search: "joe" AND Tags: [Plumber]
- Must be named "Joe" AND have "Plumber" tag

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR10 | Users can search/filter vendors by name or trade tag | Search input + trade tag dropdown with combined filtering |

### References

- [Source: architecture.md#Phase 2: Work Orders and Vendors] - VendorDto structure
- [Source: epics-work-orders-vendors.md#Story 1.6] - Original story definition
- [Source: 8-5-view-vendor-list.md] - VendorDto with tradeTags, store pattern
- [Source: vendors.component.ts] - Existing component structure to extend
- [Source: vendor.store.ts] - Existing store pattern with tradeTags support

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Task 1-4 Complete**: Added filter state, UI components, and styling to VendorStore and VendorsComponent
2. **Task 5 Complete**: Added 20+ store unit tests for filter functionality (52 total store tests passing)
3. **Task 6 Complete**: Added 15+ component tests for filter UI (868 total frontend tests passing)
4. **Task 7 Complete**: Created E2E test file with 9 test cases. E2E tests require running infrastructure (frontend + backend servers) to execute. Existing vendor E2E tests also fail when infrastructure is down - this is expected.

### Test Summary

- **Frontend Unit Tests**: 868 passing (all tests pass)
- **Store Tests**: 52 passing (includes 20+ new filter tests)
- **Component Tests**: Added 15+ new filter-related tests
- **E2E Tests**: File created with 9 tests (requires running infrastructure)

### File List

**Frontend - Modified Files:**
- `frontend/src/app/features/vendors/stores/vendor.store.ts` - Added filter state, computed signals (filteredVendors, hasActiveFilters, noMatchesFound), and methods (setSearchTerm, setTradeTagFilter, clearFilters)
- `frontend/src/app/features/vendors/stores/vendor.store.spec.ts` - Added 20+ tests for filter functionality
- `frontend/src/app/features/vendors/vendors.component.ts` - Added filter bar UI with search input, trade tag dropdown, clear filters button, and no-matches state
- `frontend/src/app/features/vendors/vendors.component.spec.ts` - Added 15+ component tests for filter UI

**E2E Tests - New/Modified Files:**
- `frontend/e2e/tests/vendors/vendor-search-filter.spec.ts` - New E2E test file with 9 test cases
- `frontend/e2e/pages/vendor.page.ts` - Added filter-related locators, actions, and assertions
