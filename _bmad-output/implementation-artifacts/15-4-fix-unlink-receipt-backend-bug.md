# Story 15.4: Fix Unlink Receipt Backend Bug

Status: done

## Story

As a **property owner managing receipts**,
I want **to unlink a receipt from an expense**,
So that **I can reprocess or reassign receipts when needed**.

**GitHub Issue:** #210
**Severity:** High — blocks receipt reprocessing workflow

## Root Cause Analysis

The `UnlinkReceiptHandler` queries the wrong side of the FK relationship.

**The FK configuration** (`ExpenseConfiguration.cs` lines 71-74):
```csharp
builder.HasOne(e => e.Receipt)
    .WithOne(r => r.Expense)
    .HasForeignKey<Expense>(e => e.ReceiptId)  // FK is on Expense side
    .OnDelete(DeleteBehavior.SetNull);
```

- `Expense.ReceiptId` → **real FK** pointing to `Receipt.Id`
- `Receipt.ExpenseId` → **NOT a FK**, just a property column — may be null or stale

**The bug** (`UnlinkReceipt.cs` line 48):
```csharp
var receipt = await _dbContext.Receipts
    .FirstOrDefaultAsync(r => r.ExpenseId == request.ExpenseId, cancellationToken);
```

This queries `Receipt.ExpenseId` which is not the FK → returns null → throws 404.

**Additionally**, the handler only nulls `Receipt.ExpenseId` and `Receipt.ProcessedAt` but never clears `Expense.ReceiptId` — the actual FK that links them.

## Acceptance Criteria

### AC #1: Successfully Unlink a Linked Receipt

**Given** an expense has a linked receipt (`Expense.ReceiptId` is set)
**When** I call `DELETE /api/v1/expenses/{id}/receipt`
**Then** `Expense.ReceiptId` is set to null
**And** `Receipt.ExpenseId` is set to null
**And** `Receipt.ProcessedAt` is set to null (returns receipt to unprocessed queue)
**And** the response is `204 No Content`

### AC #2: Expense Not Found

**Given** the expense ID does not exist
**When** I call `DELETE /api/v1/expenses/{id}/receipt`
**Then** the response is `404 Not Found` with message containing "Expense"

### AC #3: No Receipt Linked to Expense

**Given** the expense exists but has no linked receipt (`Expense.ReceiptId` is null)
**When** I call `DELETE /api/v1/expenses/{id}/receipt`
**Then** the response is `404 Not Found` with message containing "Receipt for expense"

### AC #4: Existing Tests Continue to Pass

**Given** the fix is applied
**When** I run the full backend test suite
**Then** all tests pass with no regressions

## Tasks / Subtasks

> **TDD Approach:** Fix tests first to reflect correct behavior, then fix the handler.

---

### Task 1: Update Unit Tests to Reflect Correct FK Direction [x]

**File:** `backend/tests/PropertyManager.Application.Tests/Expenses/UnlinkReceiptHandlerTests.cs`

The existing tests use mock DbSets for both `Expenses` and `Receipts` separately. After the fix, the handler will use `Include(e => e.Receipt)` on the Expenses DbSet, so tests must set up the `Receipt` navigation property on the `Expense` entity instead of relying on a separate Receipts query.

**Changes:**
1. Update `CreateExpense()` helper to accept an optional `Receipt` parameter and set the `Receipt` navigation property + `ReceiptId`
2. Update `Handle_NoReceiptLinked_ThrowsNotFoundException` — expense exists with `ReceiptId = null`, `Receipt = null`
3. Update `Handle_ValidCommand_UnlinksReceiptFromExpense` — verify `expense.ReceiptId` is nulled (not just `receipt.ExpenseId`)
4. Update `Handle_ValidCommand_ClearsProcessedAtTimestamp` — same navigation-based setup
5. Update `Handle_ValidCommand_CallsSaveChanges` — same navigation-based setup
6. Update or remove `Handle_ReceiptLinkedToDifferentExpense_ThrowsNotFoundException` — this scenario doesn't apply with Include-based approach (the receipt is accessed via navigation, not queried separately)
7. Add new test: `Handle_ValidCommand_ClearsExpenseReceiptId` — verify `expense.ReceiptId` is set to null
8. Add new test: `Handle_ValidCommand_ClearsReceiptExpenseId` — verify `receipt.ExpenseId` is set to null

---

### Task 2: Fix the UnlinkReceiptHandler [x]

**File:** `backend/src/PropertyManager.Application/Expenses/UnlinkReceipt.cs`

Replace the broken query with Include-based approach:

```csharp
public async Task<Unit> Handle(
    UnlinkReceiptCommand request,
    CancellationToken cancellationToken)
{
    // Load expense WITH its receipt via navigation property
    var expense = await _dbContext.Expenses
        .Include(e => e.Receipt)
        .FirstOrDefaultAsync(e => e.Id == request.ExpenseId, cancellationToken);

    if (expense == null)
    {
        throw new NotFoundException(nameof(Expense), request.ExpenseId);
    }

    var receipt = expense.Receipt;
    if (receipt == null)
    {
        throw new NotFoundException("Receipt for expense", request.ExpenseId);
    }

    // Clear BOTH sides of the relationship
    expense.ReceiptId = null;      // The real FK
    receipt.ExpenseId = null;      // The shadow property
    receipt.ProcessedAt = null;    // Return to unprocessed queue

    await _dbContext.SaveChangesAsync(cancellationToken);

    _logger.LogInformation(
        "Unlinked receipt {ReceiptId} from expense {ExpenseId}",
        receipt.Id,
        request.ExpenseId);

    return Unit.Value;
}
```

**Key changes from original:**
1. Use `.Include(e => e.Receipt)` to load via navigation instead of querying Receipts table
2. Access receipt via `expense.Receipt` navigation property
3. Clear `expense.ReceiptId` (the real FK) — **this was completely missing before**
4. Keep clearing `receipt.ExpenseId` and `receipt.ProcessedAt`

---

### Task 3: Run Tests and Verify [x]

1. Run `dotnet test --filter UnlinkReceiptHandlerTests` — all tests pass
2. Run `dotnet test` — full suite passes, no regressions
3. Manual verification: start API, upload a receipt, process into expense, unlink — should return 204

---

## Dev Notes

- **No database migration needed** — no schema changes, just fixing the query logic
- **No frontend changes needed** — the API contract (endpoint + response codes) is unchanged
- **No new dependencies** — `Include()` is standard EF Core
- The controller at `ExpensesController.cs` line 391 is correct and needs no changes

## Files Involved

| File | Action |
|------|--------|
| `backend/src/PropertyManager.Application/Expenses/UnlinkReceipt.cs` | **FIX** — rewrite query + clear both FK sides |
| `backend/tests/PropertyManager.Application.Tests/Expenses/UnlinkReceiptHandlerTests.cs` | **UPDATE** — align tests with Include-based approach |

---

_Generated by BMAD Scrum Master_
_Date: 2026-02-15_
_For: Dave_
_Project: property-manager_
