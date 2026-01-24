using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Query to get work orders for a specific property.
/// Used on property detail page to show maintenance history.
/// </summary>
public record GetWorkOrdersByPropertyQuery(
    Guid PropertyId,
    int? Limit = null
) : IRequest<GetWorkOrdersByPropertyResult>;

/// <summary>
/// Response containing list of work orders for a property with total count.
/// </summary>
public record GetWorkOrdersByPropertyResult(
    IReadOnlyList<WorkOrderDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetWorkOrdersByPropertyQuery.
/// Returns work orders for a specific property belonging to current user's account.
/// Note: Explicit tenant isolation and soft delete filtering for defense-in-depth
/// alongside global query filters.
/// </summary>
public class GetWorkOrdersByPropertyQueryHandler : IRequestHandler<GetWorkOrdersByPropertyQuery, GetWorkOrdersByPropertyResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetWorkOrdersByPropertyQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetWorkOrdersByPropertyResult> Handle(GetWorkOrdersByPropertyQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.WorkOrders
            .Where(w => w.AccountId == _currentUser.AccountId && w.DeletedAt == null)
            .Where(w => w.PropertyId == request.PropertyId)
            .Include(w => w.Property)
            .Include(w => w.Vendor)
            .Include(w => w.Category)
            .Include(w => w.TagAssignments)
                .ThenInclude(a => a.Tag)
            .OrderByDescending(w => w.CreatedAt)
            .AsNoTracking();

        var totalCount = await query.CountAsync(cancellationToken);

        var workOrders = request.Limit.HasValue
            ? await query.Take(request.Limit.Value).ToListAsync(cancellationToken)
            : await query.ToListAsync(cancellationToken);

        var workOrderDtos = workOrders.Select(w => new WorkOrderDto(
            w.Id,
            w.PropertyId,
            w.Property.Name,
            w.VendorId,
            w.Vendor?.FullName,
            w.IsDiy,
            w.CategoryId,
            w.Category?.Name,
            w.Status.ToString(),
            w.Description,
            w.CreatedAt,
            w.CreatedByUserId,
            w.TagAssignments
                .Select(a => new WorkOrderTagDto(a.Tag.Id, a.Tag.Name))
                .ToList()
        )).ToList();

        return new GetWorkOrdersByPropertyResult(workOrderDtos, totalCount);
    }
}
