using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Expenses;

public record LinkReceiptToExpenseCommand(Guid ExpenseId, Guid ReceiptId) : IRequest<Unit>;

public class LinkReceiptToExpenseHandler : IRequestHandler<LinkReceiptToExpenseCommand, Unit>
{
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<LinkReceiptToExpenseHandler> _logger;

    public LinkReceiptToExpenseHandler(
        IAppDbContext dbContext,
        ILogger<LinkReceiptToExpenseHandler> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<Unit> Handle(
        LinkReceiptToExpenseCommand request,
        CancellationToken cancellationToken)
    {
        // 1. Load expense
        var expense = await _dbContext.Expenses
            .FirstOrDefaultAsync(e => e.Id == request.ExpenseId, cancellationToken);

        if (expense == null)
            throw new NotFoundException(nameof(Expense), request.ExpenseId);

        // 2. Verify expense doesn't already have a receipt
        if (expense.ReceiptId != null)
            throw new ConflictException(nameof(Expense), request.ExpenseId, "already has a linked receipt");

        // 3. Load receipt
        var receipt = await _dbContext.Receipts
            .FirstOrDefaultAsync(r => r.Id == request.ReceiptId, cancellationToken);

        if (receipt == null)
            throw new NotFoundException(nameof(Receipt), request.ReceiptId);

        // 4. Verify receipt is unprocessed
        if (receipt.ProcessedAt != null)
            throw new ConflictException(nameof(Receipt), request.ReceiptId, "is already processed");

        // 5. Set BOTH sides of the 1:1 relationship (critical — see Story 15.4 fix)
        expense.ReceiptId = receipt.Id;
        receipt.ExpenseId = expense.Id;
        receipt.ProcessedAt = DateTime.UtcNow;

        // 6. Sync property: if receipt has no property, set it from expense
        if (receipt.PropertyId == null)
            receipt.PropertyId = expense.PropertyId;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Linked receipt {ReceiptId} to expense {ExpenseId}",
            receipt.Id,
            request.ExpenseId);

        return Unit.Value;
    }
}
