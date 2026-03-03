using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Query to get work orders for a specific vendor.
/// Used on vendor detail page to show work order history.
/// </summary>
public record GetWorkOrdersByVendorQuery(
    Guid VendorId,
    int? Limit = null
) : IRequest<GetWorkOrdersByVendorResult>;

/// <summary>
/// Response containing list of work orders for a vendor with total count.
/// </summary>
public record GetWorkOrdersByVendorResult(
    IReadOnlyList<WorkOrderDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetWorkOrdersByVendorQuery.
/// Returns work orders for a specific vendor belonging to current user's account.
/// Note: Explicit tenant isolation and soft delete filtering for defense-in-depth
/// alongside global query filters.
/// </summary>
public class GetWorkOrdersByVendorQueryHandler : IRequestHandler<GetWorkOrdersByVendorQuery, GetWorkOrdersByVendorResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetWorkOrdersByVendorQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetWorkOrdersByVendorResult> Handle(GetWorkOrdersByVendorQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.WorkOrders
            .Where(w => w.AccountId == _currentUser.AccountId && w.DeletedAt == null)
            .Where(w => w.VendorId == request.VendorId)
            .Include(w => w.Property)
            .OrderByDescending(w => w.CreatedAt)
            .AsNoTracking();

        int totalCount;
        List<Domain.Entities.WorkOrder> workOrders;

        if (request.Limit.HasValue)
        {
            totalCount = await query.CountAsync(cancellationToken);
            workOrders = await query.Take(request.Limit.Value).ToListAsync(cancellationToken);
        }
        else
        {
            workOrders = await query.ToListAsync(cancellationToken);
            totalCount = workOrders.Count;
        }

        var workOrderDtos = workOrders.Select(w => new WorkOrderDto(
            w.Id,
            w.PropertyId,
            w.Property.Name,
            w.VendorId,
            null, // Vendor name omitted — caller already has vendor context
            w.IsDiy,
            null, // CategoryId not needed for list view
            null, // CategoryName not needed for list view
            w.Status.ToString(),
            w.Description,
            w.CreatedAt,
            w.CreatedByUserId,
            new List<WorkOrderTagDto>(), // Tags not displayed in vendor detail list
            null // Thumbnail not displayed in vendor detail list
        )).ToList();

        return new GetWorkOrdersByVendorResult(workOrderDtos, totalCount);
    }
}
