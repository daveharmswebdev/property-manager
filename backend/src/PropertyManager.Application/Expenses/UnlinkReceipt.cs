using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Expenses;

/// <summary>
/// Command to unlink a receipt from an expense (AC-5.5.5).
/// Sets ExpenseId to null on the receipt and returns it to unprocessed queue.
/// </summary>
public record UnlinkReceiptCommand(Guid ExpenseId) : IRequest<Unit>;

/// <summary>
/// Handler for UnlinkReceiptCommand.
/// Finds the receipt linked to the expense, unlinks it, and returns it to unprocessed state.
/// Tenant isolation is enforced via global query filter.
/// </summary>
public class UnlinkReceiptHandler : IRequestHandler<UnlinkReceiptCommand, Unit>
{
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<UnlinkReceiptHandler> _logger;

    public UnlinkReceiptHandler(
        IAppDbContext dbContext,
        ILogger<UnlinkReceiptHandler> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<Unit> Handle(
        UnlinkReceiptCommand request,
        CancellationToken cancellationToken)
    {
        // First verify the expense exists and belongs to the user
        var expense = await _dbContext.Expenses
            .FirstOrDefaultAsync(e => e.Id == request.ExpenseId, cancellationToken);

        if (expense == null)
        {
            throw new NotFoundException(nameof(Expense), request.ExpenseId);
        }

        // Find the receipt linked to this expense
        var receipt = await _dbContext.Receipts
            .FirstOrDefaultAsync(r => r.ExpenseId == request.ExpenseId, cancellationToken);

        if (receipt == null)
        {
            throw new NotFoundException("Receipt for expense", request.ExpenseId);
        }

        // Unlink the receipt
        receipt.ExpenseId = null;
        receipt.ProcessedAt = null; // Return to unprocessed queue

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Unlinked receipt {ReceiptId} from expense {ExpenseId}",
            receipt.Id,
            request.ExpenseId);

        return Unit.Value;
    }
}
