# Test Coverage Gap Work - Handoff Document

## Status
- **Branch:** `main`
- **Backend:** ✅ **COMPLETE** - 15/15 controllers tested, 407 API integration tests
- **Frontend:** 71 test files, 1654 tests
- **Progress:** P0 ✅ + P1 ✅ + P2 ✅ + P3 ✅ (Core Services + Feature Stores + Feature Services + Auth Components complete)

---

## Backend - COMPLETE

All 15 backend API controllers have integration tests:

| Task | Controller | Coverage | PR |
|------|------------|----------|-----|
| #1 | WorkOrdersController | 0% → 95.6% | #121 |
| #2 | WorkOrderTagsController | 0% → 84.4% | #121 |
| #3 | ReportsController | 0% → 93.3% | #122 |
| #4 | PhotosController | 0% → ~95% | #124 |
| #5 | PropertyPhotosController | 0% → ~90% | #124 |
| #6 | IncomeController | 37% → ~90% | #124 |
| #7 | VendorTradeTagsController | 0% → ~95% | #124 |
| #8 | InvitationsController | 0% → ~95% | #125 |

---

## Frontend - REMAINING GAPS

### Critical: Core Services
These are foundational services used across the app:

| Priority | File | Location | Status |
|----------|------|----------|--------|
| **P0** | auth.service.ts | `frontend/src/app/core/services/` | ✅ 47 tests |
| **P0** | api.service.ts | `frontend/src/app/core/api/` | N/A (NSwag generated) |

### High: Feature Stores
State management stores - high business logic concentration:

| Priority | File | Location | Status |
|----------|------|----------|--------|
| **P1** | work-order.store.ts | `frontend/src/app/features/work-orders/stores/` | ✅ 59 tests |
| **P1** | expense-list.store.ts | `frontend/src/app/features/expenses/stores/` | ✅ 54 tests |
| **P1** | income.store.ts | `frontend/src/app/features/income/stores/` | ✅ 56 tests |

### Medium: Feature Services
API integration services:

| Priority | File | Location | Status |
|----------|------|----------|--------|
| **P2** | work-order.service.ts | `frontend/src/app/features/work-orders/services/` | ✅ 16 tests |
| **P2** | expense.service.ts | `frontend/src/app/features/expenses/services/` | ✅ 20 tests |
| **P2** | income.service.ts | `frontend/src/app/features/income/services/` | ✅ 15 tests |
| **P2** | property.service.ts | `frontend/src/app/features/properties/services/` | ✅ 12 tests |

### P3: Auth Components
User-facing critical path components:

| Priority | File | Location | Status |
|----------|------|----------|--------|
| **P3** | login.component.ts | `frontend/src/app/features/auth/login/` | ✅ 16 tests |
| **P3** | forgot-password.component.ts | `frontend/src/app/features/auth/forgot-password/` | ✅ 13 tests |
| **P3** | reset-password.component.ts | `frontend/src/app/features/auth/reset-password/` | ✅ 27 tests |
| **P3** | accept-invitation.component.ts | `frontend/src/app/features/auth/accept-invitation/` | ✅ 33 tests |

### Lower: Components (No Tests)
19 components without test files:

**Work Orders (2 components)**
- `work-order-create.component.ts`
- `work-order-edit.component.ts`

**Expenses (5 components)**
- `expenses.component.ts`
- `expense-workspace.component.ts`
- `expense-form.component.ts`
- `expense-filters.component.ts`
- `category-select.component.ts`

**Income (4 components)**
- `income.component.ts`
- `income-workspace.component.ts`
- `income-form.component.ts`
- `income-row.component.ts`

**Other (8 components)**
- `properties.component.ts`
- `settings.component.ts`
- `pdf-preview.component.ts`
- `not-found.component.ts`
- `empty-state.component.ts`
- `loading-spinner.component.ts`
- `year-selector.component.ts`
- `error-card.component.ts`

---

## Recommended Order

1. ~~**P0 - Core Services** (~2 files, critical foundation)~~ ✅ PR #126
2. ~~**P1 - Feature Stores** (~3 files, high business logic)~~ ✅ PR #126
3. ~~**P2 - Feature Services** (~4 files, API integration)~~ ✅ PR #127
4. ~~**P3 - Auth Components** (~4 files, user-facing critical path)~~ ✅ PR #128
5. **P4 - Remaining Components** (~19 files) ← Next

---

## Commands

```bash
# Frontend tests
cd frontend
npm test              # Run all tests in watch mode
npm test -- --watch=false  # Run once

# Backend tests
cd backend
dotnet test           # Run all tests
dotnet test --filter "FullyQualifiedName~XxxTests"  # Run specific tests
```

## Frontend Testing Pattern (Vitest + Angular)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyService, useValue: vi.fn() }
      ]
    });
    service = TestBed.inject(ServiceName);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

## Notes

- Frontend uses Vitest (not Jest/Jasmine)
- Stores use @ngrx/signals - test with `signalStore` patterns
- Mock HTTP calls with `vi.fn()` or `HttpTestingController`
- Auth service interacts with localStorage and API
