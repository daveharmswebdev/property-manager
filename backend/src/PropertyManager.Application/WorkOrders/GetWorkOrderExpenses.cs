using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Query to get expenses linked to a specific work order (AC #6).
/// </summary>
public record GetWorkOrderExpensesQuery(Guid WorkOrderId) : IRequest<WorkOrderExpensesResponse>;

/// <summary>
/// Response containing expenses linked to a work order.
/// </summary>
public record WorkOrderExpensesResponse(
    List<WorkOrderExpenseItemDto> Items,
    int TotalCount);

/// <summary>
/// DTO for expense items in work order context.
/// </summary>
public record WorkOrderExpenseItemDto(
    Guid Id,
    DateOnly Date,
    string? Description,
    string CategoryName,
    decimal Amount);

/// <summary>
/// Handler for GetWorkOrderExpensesQuery.
/// Returns expenses linked to a work order, filtered by account isolation and soft delete.
/// </summary>
public class GetWorkOrderExpensesHandler : IRequestHandler<GetWorkOrderExpensesQuery, WorkOrderExpensesResponse>
{
    private readonly IAppDbContext _dbContext;

    public GetWorkOrderExpensesHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<WorkOrderExpensesResponse> Handle(GetWorkOrderExpensesQuery request, CancellationToken cancellationToken)
    {
        // Verify work order exists and belongs to current account (global query filter handles account isolation)
        var workOrderExists = await _dbContext.WorkOrders
            .AnyAsync(w => w.Id == request.WorkOrderId && w.DeletedAt == null, cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException(nameof(WorkOrder), request.WorkOrderId);
        }

        // Query expenses linked to this work order
        var expenses = await _dbContext.Expenses
            .Where(e => e.WorkOrderId == request.WorkOrderId && e.DeletedAt == null)
            .OrderByDescending(e => e.Date)
            .Select(e => new WorkOrderExpenseItemDto(
                e.Id,
                e.Date,
                e.Description,
                e.Category.Name,
                e.Amount))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new WorkOrderExpensesResponse(expenses, expenses.Count);
    }
}
