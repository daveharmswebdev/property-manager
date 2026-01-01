using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Command to process a receipt by creating an expense from it (AC-5.4.4).
/// </summary>
public record ProcessReceiptCommand(
    Guid ReceiptId,
    Guid PropertyId,
    decimal Amount,
    DateOnly Date,
    Guid CategoryId,
    string? Description
) : IRequest<Guid>;

/// <summary>
/// Handler for ProcessReceiptCommand.
/// Creates an expense linked to the receipt and marks the receipt as processed.
/// </summary>
public class ProcessReceiptHandler : IRequestHandler<ProcessReceiptCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ProcessReceiptHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(ProcessReceiptCommand request, CancellationToken cancellationToken)
    {
        // Find receipt (global query filter handles account isolation)
        var receipt = await _dbContext.Receipts
            .FirstOrDefaultAsync(r => r.Id == request.ReceiptId, cancellationToken);

        if (receipt == null)
        {
            throw new NotFoundException(nameof(Receipt), request.ReceiptId);
        }

        if (receipt.ProcessedAt != null)
        {
            throw new ConflictException(nameof(Receipt), request.ReceiptId, "is already processed");
        }

        // Validate property exists and belongs to user's account (global query filter handles account isolation)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        // Validate category exists (ExpenseCategories are global, no account filter)
        var categoryExists = await _dbContext.ExpenseCategories
            .AnyAsync(c => c.Id == request.CategoryId, cancellationToken);

        if (!categoryExists)
        {
            throw new NotFoundException(nameof(ExpenseCategory), request.CategoryId);
        }

        // Create expense linked to receipt
        var expense = new Expense
        {
            AccountId = _currentUser.AccountId,
            PropertyId = request.PropertyId,
            CategoryId = request.CategoryId,
            Amount = request.Amount,
            Date = request.Date,
            Description = request.Description?.Trim(),
            ReceiptId = receipt.Id,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.Expenses.Add(expense);

        // Mark receipt as processed
        receipt.ProcessedAt = DateTime.UtcNow;
        receipt.ExpenseId = expense.Id;
        receipt.PropertyId = request.PropertyId;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return expense.Id;
    }
}
