using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Expenses;

/// <summary>
/// Command to unlink a receipt from an expense.
/// Clears both sides of the relationship and returns receipt to unprocessed queue.
/// </summary>
public record UnlinkReceiptCommand(Guid ExpenseId) : IRequest<Unit>;

/// <summary>
/// Handler for UnlinkReceiptCommand.
/// Loads expense with its receipt via navigation property, clears both FK sides.
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
}
