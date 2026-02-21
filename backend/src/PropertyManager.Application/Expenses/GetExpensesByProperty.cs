using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Expenses;

/// <summary>
/// Query to get expenses for a specific property with pagination (AC-3.1.7, AC-7.5.1, AC-7.5.2, AC-7.5.3).
/// </summary>
public record GetExpensesByPropertyQuery(
    Guid PropertyId,
    int? Year = null,
    int Page = 1,
    int PageSize = 25
) : IRequest<PagedExpenseListDto>;

/// <summary>
/// Paginated response DTO for expenses by property (AC-7.5.1, AC-7.5.2, AC-7.5.3).
/// YtdTotal is calculated from ALL matching expenses, independent of pagination.
/// </summary>
public record PagedExpenseListDto(
    List<ExpenseDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    decimal YtdTotal
);

/// <summary>
/// Handler for GetExpensesByPropertyQuery.
/// Returns paginated expenses for a property, ordered by Date descending (newest first).
/// Optionally filtered by year. YtdTotal is calculated from ALL matching expenses.
/// </summary>
public class GetExpensesByPropertyQueryHandler : IRequestHandler<GetExpensesByPropertyQuery, PagedExpenseListDto>
{
    private readonly IAppDbContext _dbContext;

    public GetExpensesByPropertyQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<PagedExpenseListDto> Handle(GetExpensesByPropertyQuery request, CancellationToken cancellationToken)
    {
        // Validate property exists (global query filter handles account isolation)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        var query = _dbContext.Expenses
            .Where(e => e.PropertyId == request.PropertyId);

        // Apply year filter if specified
        if (request.Year.HasValue)
        {
            var startDate = new DateOnly(request.Year.Value, 1, 1);
            var endDate = new DateOnly(request.Year.Value, 12, 31);
            query = query.Where(e => e.Date >= startDate && e.Date <= endDate);
        }

        // Calculate YtdTotal from ALL matching expenses before pagination (AC-7.5.3)
        var ytdTotal = await query.SumAsync(e => e.Amount, cancellationToken);

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Calculate pagination with clamping (AC-7.5.2)
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var page = Math.Max(1, request.Page);
        var totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var skip = (page - 1) * pageSize;

        // Execute query with sorting and pagination
        var expenses = await query
            .OrderByDescending(e => e.Date)
            .ThenByDescending(e => e.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .Select(e => new ExpenseDto(
                e.Id,
                e.PropertyId,
                e.Property.Name,
                e.CategoryId,
                e.Category.Name,
                e.Category.ScheduleELine,
                e.Amount,
                e.Date,
                e.Description,
                e.ReceiptId,
                e.WorkOrderId,
                e.WorkOrder != null ? e.WorkOrder.Description : null,
                e.WorkOrder != null ? e.WorkOrder.Status.ToString() : null,
                e.CreatedAt
            ))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new PagedExpenseListDto(
            Items: expenses,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            YtdTotal: ytdTotal
        );
    }
}
