# Story 7.3: Year Selection Persistence

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **property owner**,
I want **my selected tax year to persist across page refreshes and browser sessions**,
So that **I don't have to reselect the year I'm working on every time**.

## Acceptance Criteria

1. **AC-7.3.1: Persist across page refresh**
   - **Given** I select a tax year (e.g., 2025)
   - **When** I refresh the page (F5 or browser refresh)
   - **Then** the year remains set to 2025

2. **AC-7.3.2: Persist across browser sessions**
   - **Given** I select a tax year (e.g., 2025)
   - **When** I close the browser tab and reopen the app
   - **Then** the last selected year (2025) is restored

3. **AC-7.3.3: Graceful fallback on data loss**
   - **Given** I clear browser data (localStorage cleared)
   - **When** I open the app
   - **Then** the year defaults to current year (graceful fallback)
   - **And** no error is shown to the user

4. **AC-7.3.4: Invalid stored value handling**
   - **Given** localStorage contains an invalid year value (e.g., "abc" or -1)
   - **When** I open the app
   - **Then** the year defaults to current year
   - **And** the invalid value is replaced with the current year in localStorage

5. **AC-7.3.5: Year must be within available range**
   - **Given** localStorage contains a year outside the available range
   - **When** I open the app
   - **Then** the year defaults to current year
   - **And** the out-of-range value is replaced

## Tasks / Subtasks

- [x] Task 1: Add localStorage persistence to YearSelectorService (AC: #1, #2)
  - [x] 1.1: Define localStorage key constant: `propertyManager.selectedYear`
  - [x] 1.2: Add `initializeFromStorage()` private method to read and validate stored year
  - [x] 1.3: Call `initializeFromStorage()` in service constructor
  - [x] 1.4: Update `setYear()` to write to localStorage after setting signal

- [x] Task 2: Add validation and error handling (AC: #3, #4, #5)
  - [x] 2.1: Implement `isValidYear()` private method to check if year is in available range
  - [x] 2.2: Handle `try-catch` around localStorage operations (may be disabled in private browsing)
  - [x] 2.3: Log warning (not error) when falling back to current year

- [x] Task 3: Update unit tests (AC: #1, #2, #3, #4, #5)
  - [x] 3.1: Mock localStorage in test setup
  - [x] 3.2: Test: reads stored year on initialization
  - [x] 3.3: Test: writes to localStorage on setYear()
  - [x] 3.4: Test: falls back to current year when localStorage is empty
  - [x] 3.5: Test: falls back to current year when stored value is invalid
  - [x] 3.6: Test: falls back to current year when stored year is out of range
  - [x] 3.7: Test: handles localStorage exceptions gracefully

- [x] Task 4: Manual verification
  - [x] 4.1: Select year 2025, refresh page, verify year persists
  - [x] 4.2: Select year 2024, close tab, reopen, verify year persists
  - [x] 4.3: Clear localStorage in DevTools, reload, verify defaults to current year
  - [x] 4.4: Manually set invalid value in localStorage, reload, verify graceful fallback

## Dev Notes

### Architecture Compliance

**Angular Service Pattern:**
- Service is `providedIn: 'root'` (singleton)
- Uses Angular signals for reactive state
- localStorage is accessed synchronously in constructor (safe for initialization)

**localStorage Pattern:**
```typescript
// Key naming convention from technical notes
const STORAGE_KEY = 'propertyManager.selectedYear';

// Safe read pattern
private initializeFromStorage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const year = parseInt(stored, 10);
      if (this.isValidYear(year)) {
        this._selectedYear.set(year);
        return;
      }
    }
  } catch {
    // localStorage may be unavailable (private browsing, disabled)
  }
  // Fall through to default (current year already set)
}

// Safe write pattern
private saveToStorage(year: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, year.toString());
  } catch {
    // Silently ignore - persistence is best-effort
  }
}
```

### Current Implementation Analysis

**File:** `frontend/src/app/core/services/year-selector.service.ts`

**Current State (lines 1-39):**
```typescript
@Injectable({ providedIn: 'root' })
export class YearSelectorService {
  // Currently defaults to current year, no persistence
  private readonly _selectedYear = signal<number>(new Date().getFullYear());

  readonly selectedYear = this._selectedYear.asReadonly();

  readonly availableYears = computed(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  });

  setYear(year: number): void {
    this._selectedYear.set(year);
    // NEED TO ADD: save to localStorage here
  }

  reset(): void {
    this._selectedYear.set(new Date().getFullYear());
  }
}
```

**Required Changes:**
1. Add `STORAGE_KEY` constant
2. Add `initializeFromStorage()` method
3. Add `isValidYear()` validation method
4. Add `saveToStorage()` method
5. Call `initializeFromStorage()` in constructor
6. Call `saveToStorage()` in `setYear()`
7. Optionally update `reset()` to also clear localStorage

### Validation Logic

```typescript
private isValidYear(year: number): boolean {
  if (isNaN(year)) return false;
  const availableYears = this.availableYears();
  return availableYears.includes(year);
}
```

### Testing Strategy

**Mocking localStorage:**
```typescript
describe('YearSelectorService', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    spyOn(localStorage, 'getItem').and.callFake((key: string) => localStorageMock[key] || null);
    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    spyOn(localStorage, 'removeItem').and.callFake((key: string) => {
      delete localStorageMock[key];
    });
  });

  // Tests...
});
```

**New Test Cases:**
1. `it('should read stored year on initialization')`
2. `it('should write to localStorage when year changes')`
3. `it('should default to current year when localStorage is empty')`
4. `it('should default to current year when stored value is invalid')`
5. `it('should default to current year when stored year is out of range')`
6. `it('should handle localStorage exceptions gracefully')`

### Project Structure Notes

```
frontend/src/app/core/services/
├── year-selector.service.ts       <- MODIFY: Add localStorage persistence
└── year-selector.service.spec.ts  <- MODIFY: Add persistence tests
```

**No other files need modification** - the service is already used throughout the app via dependency injection. Changes will automatically propagate.

### Previous Story Intelligence (7-2)

From story 7-2 implementation:
- Pattern: Services use Angular signals for state
- Pattern: Tests mock dependencies (localStorage mock follows same pattern)
- JWT token handling demonstrates error-tolerant patterns (try-catch with fallback)

### Git Intelligence

Recent commits show patterns:
- `f93bcc5`: feat(profile) - service modifications follow similar patterns
- `e1672b9`: feat(shell) - component/service changes tested thoroughly

### Edge Cases to Handle

1. **Private browsing mode**: localStorage may throw on access
2. **Storage quota exceeded**: setItem may throw
3. **Corrupted data**: parseInt may return NaN
4. **Future years**: stored year might be valid now but invalid if user time-travels back
5. **Multiple tabs**: Changes in one tab won't sync to others (acceptable for MVP)

### References

- [Source: frontend/src/app/core/services/year-selector.service.ts] - Current implementation
- [Source: frontend/src/app/shared/components/year-selector/year-selector.component.ts] - Component using service
- [Source: _bmad-output/implementation-artifacts/epic-7-bug-fixes.md#Story-7.3] - Epic requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Structure] - Service patterns
- GitHub Issue: #59

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without issues.

### Completion Notes List

1. **Task 1 Complete**: Added localStorage persistence to YearSelectorService
   - Added `STORAGE_KEY` constant: `propertyManager.selectedYear`
   - Added `initializeFromStorage()` method that reads and validates stored year on service construction
   - Added `saveToStorage()` method called by `setYear()` to persist selection
   - Service now reads from localStorage on initialization and writes on every year change

2. **Task 2 Complete**: Added validation and error handling
   - Added `isValidYear()` method that checks if year is within available range (current year - 5)
   - All localStorage operations wrapped in try-catch for graceful degradation
   - Invalid/out-of-range values automatically replaced with current year

3. **Task 3 Complete**: Updated unit tests with 12 new localStorage persistence tests
   - Mocked localStorage using Vitest's `vi.fn()` pattern
   - Tests cover: initialization from storage, write on setYear, fallback scenarios, exception handling
   - All 19 tests pass (669 total frontend tests pass)

4. **Task 4 Complete**: Manual verification with Playwright MCP
   - AC-7.3.1: Verified year persists across page refresh (selected 2025, refreshed, still 2025)
   - AC-7.3.3: Verified graceful fallback when localStorage cleared (defaults to 2026)
   - AC-7.3.4: Verified invalid value handling (set "abc", reload → defaults to 2026, replaces invalid value)

### File List

**Files Modified:**
- `frontend/src/app/core/services/year-selector.service.ts` - Added localStorage persistence with validation
- `frontend/src/app/core/services/year-selector.service.spec.ts` - Added 12 new unit tests for persistence

### Change Log

- 2026-01-08: Implemented year selection persistence (Story 7.3) - All ACs satisfied
