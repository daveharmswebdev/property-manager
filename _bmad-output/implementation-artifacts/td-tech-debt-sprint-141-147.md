# Tech Debt Sprint: Issues #141-147

Status: complete

## Overview

As a **development team**,
We want **to address accumulated tech debt from the work order photos feature**,
So that **our codebase maintains consistent patterns, proper error handling, and working test infrastructure**.

## Scope

7 GitHub issues covering backend validation patterns, frontend type safety, and test infrastructure:

| Issue | Title | Stack | Priority |
|-------|-------|-------|----------|
| #144 | Fix frontend test environment (TestBed error) | Frontend | **HIGH** |
| #141 | ReorderWorkOrderPhotos throws ArgumentException instead of ValidationException | Backend | Medium |
| #142 | Add duplicate ID validation to ReorderWorkOrderPhotosValidator | Backend | Medium |
| #143 | Fix non-null assertions on photo IDs in gallery component | Frontend | Medium |
| #145 | Extract magic number for skeleton loader items | Frontend | Low |
| #146 | Remove unused parameter in gallery reorder methods | Frontend | Low |
| #147 | Update comment reference from Story 10.4 to 10-6 | Backend | Low |

## Execution Order

**Phase 1** (Unblock Testing): #144
**Phase 2** (Backend Validation): #141 + #142 (single PR)
**Phase 3** (Frontend Type Safety): #143
**Phase 4** (Cleanup Sweep): #145 + #146 + #147 (single PR)

---

## Acceptance Criteria

### AC #1: Frontend Tests Run Successfully (#144)

**Given** I run `npm test` in the frontend directory
**When** the test suite executes
**Then** all tests run without `TestBed.initTestEnvironment()` errors

### AC #2: Validation Exception Pattern (#141)

**Given** the ReorderWorkOrderPhotos handler receives invalid PhotoIds
**When** validation fails (mismatched count or duplicates)
**Then** a `ValidationException` is thrown (not `ArgumentException`)
**And** GlobalExceptionHandlerMiddleware returns HTTP 400 with RFC 7807 ProblemDetails

### AC #3: Duplicate ID Validation in Validator (#142)

**Given** a ReorderWorkOrderPhotos request with duplicate PhotoIds
**When** FluentValidation runs
**Then** validation fails with message "Photo IDs must not contain duplicates"
**And** the handler never executes

### AC #4: No Non-Null Assertions on Photo IDs (#143)

**Given** the work-order-photo-gallery component
**When** mapping photo IDs for reorder operations
**Then** null/undefined IDs are filtered out safely (no `!` assertions)
**And** TypeScript compiles without errors

### AC #5: Named Constant for Skeleton Items (#145)

**Given** the skeleton loader in work-order-photo-gallery
**When** rendering loading state
**Then** the item count comes from a named constant (not magic number array)

### AC #6: Clean Method Signatures (#146)

**Given** the `onMoveUp` and `onMoveDown` methods
**When** reviewing their signatures
**Then** no unused parameters exist
**And** template calls match the method signatures

### AC #7: Accurate Documentation (#147)

**Given** the WorkOrderPhotosController XML comments
**When** reading the documentation
**Then** it accurately references Story 10-6 for reorder/primary features

---

## Tasks / Subtasks

---

### Task 1: Fix Frontend Test Environment (#144) - HIGH PRIORITY

**Investigation Areas:**
- `frontend/src/setupTests.ts` or equivalent
- `frontend/vitest.config.ts`
- Angular testing library versions

**Subtasks:**
- [x] 1.1 Investigate TestBed initialization configuration
- [x] 1.2 Check Vitest + Angular testing library compatibility
- [x] 1.3 Fix the configuration issue (no fix needed - tests already passing)
- [x] 1.4 Verify all frontend tests pass: `npm test` (95 files, 2130 tests)
- [ ] 1.5 Verify CI pipeline passes frontend tests (pending PR merge)

---

### Task 2: Backend Validation Fixes (#141 + #142)

**Location:** `backend/src/PropertyManager.Application/WorkOrders/`

**Subtasks:**
- [x] 2.1 Add duplicate ID validation rule to `ReorderWorkOrderPhotosValidator.cs`

- [x] 2.2 Change exception type in `ReorderWorkOrderPhotos.cs:65-68`:
  - From: `throw new ArgumentException(...)`
  - To: `throw new ValidationException(...)`

- [x] 2.3 Add unit test for validator duplicate check (created ReorderWorkOrderPhotosValidatorTests.cs with 8 tests)

- [x] 2.4 Update existing handler tests if needed (updated to expect ValidationException)

- [x] 2.5 Run backend tests: `dotnet test` (1,378 tests pass)

---

### Task 3: Fix Non-Null Assertions (#143)

**Location:** `frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.ts`

**Lines:** 551, 563, 565, 577

**Subtasks:**
- [x] 3.1 Replace all `photos.map(p => p.id!)` with type-safe filter in onDrop, onMoveUp, onMoveDown

- [x] 3.2 Verify TypeScript compiles without errors

- [x] 3.3 Run frontend tests: `npm test` (2130 tests pass)

---

### Task 4: Cleanup Sweep (#145, #146, #147)

**Subtasks:**
- [x] 4.1 Extract magic number: added SKELETON_ITEM_COUNT constant

- [x] 4.2 Remove unused `photo` parameter from onMoveUp/onMoveDown methods and template calls

- [x] 4.3 Update comment in WorkOrderPhotosController.cs to reference both Story 10-4 and 10-6

- [x] 4.4 Run all tests: `dotnet test` (1,378 pass) and `npm test` (2,130 pass)

---

## Dev Notes

### Exception Pattern Reference

Per project patterns (CLAUDE.md), validation failures should use:
- `ValidationException` from `PropertyManager.Domain.Exceptions`
- Handled by `GlobalExceptionHandlerMiddleware`
- Returns HTTP 400 with RFC 7807 ProblemDetails format

### File Locations

| File | Purpose |
|------|---------|
| `frontend/vitest.config.ts` | Vitest configuration |
| `frontend/src/setupTests.ts` | Test environment setup |
| `backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotos.cs` | Handler with wrong exception |
| `backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotosValidator.cs` | Validator needing duplicate check |
| `frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.ts` | Component with type issues |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs` | Controller with outdated comment |

### GitHub Issues

- https://github.com/walterharms/property-manager/issues/141
- https://github.com/walterharms/property-manager/issues/142
- https://github.com/walterharms/property-manager/issues/143
- https://github.com/walterharms/property-manager/issues/144
- https://github.com/walterharms/property-manager/issues/145
- https://github.com/walterharms/property-manager/issues/146
- https://github.com/walterharms/property-manager/issues/147

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **#144 (Frontend Tests)**: No actual fix needed - tests were already passing. The experimental `@angular/build:unit-test` builder with Vitest runs correctly. 95 test files, 2130 tests pass.

2. **#141 (ValidationException)**: Changed `ArgumentException` to `ValidationException` in `ReorderWorkOrderPhotos.cs:67`. Updated corresponding handler tests to expect `ValidationException`.

3. **#142 (Duplicate Validation)**: Added `.Must(ids => ids == null || ids.Distinct().Count() == ids.Count)` rule to validator. Created new test file `ReorderWorkOrderPhotosValidatorTests.cs` with 8 tests covering all validation rules.

4. **#143 (Non-Null Assertions)**: Replaced `p.id!` with `p.id).filter((id): id is string => id != null)` in `onDrop`, `onMoveUp`, `onMoveDown` methods.

5. **#145 (Magic Number)**: Added `SKELETON_ITEM_COUNT = 6` constant and refactored `skeletonItems` to use `Array.from()`.

6. **#146 (Unused Parameter)**: Removed unused `photo` parameter from `onMoveUp` and `onMoveDown` method signatures. Updated template calls to match.

7. **#147 (Comment Reference)**: Updated controller XML comment to reference both Story 10-4 (core) and Story 10-6 (reorder/primary).

### File List

| File | Change |
|------|--------|
| `backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotos.cs` | Changed ArgumentException to ValidationException |
| `backend/src/PropertyManager.Application/WorkOrders/ReorderWorkOrderPhotosValidator.cs` | Added duplicate ID validation rule |
| `backend/tests/PropertyManager.Application.Tests/WorkOrders/ReorderWorkOrderPhotosValidatorTests.cs` | NEW - 8 validator tests |
| `backend/tests/PropertyManager.Application.Tests/WorkOrders/ReorderWorkOrderPhotosHandlerTests.cs` | Updated to expect ValidationException |
| `backend/src/PropertyManager.Api/Controllers/WorkOrderPhotosController.cs` | Updated XML comment |
| `frontend/src/app/features/work-orders/components/work-order-photo-gallery/work-order-photo-gallery.component.ts` | Fixed non-null assertions, removed unused params, extracted magic number |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Tech debt sprint handoff created from issues #141-147 | SM Agent (Bob) |
| 2026-02-01 | Completed all 7 issues. All tests pass (1,378 backend, 2,130 frontend) | Dev Agent (Amelia) |
