using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Query to get all work orders for the current user's account.
/// Optional filters for status and propertyId (stubbed for future use).
/// </summary>
public record GetAllWorkOrdersQuery(
    string? Status = null,
    Guid? PropertyId = null
) : IRequest<GetAllWorkOrdersResponse>;

/// <summary>
/// Response containing list of work orders with pagination info.
/// </summary>
public record GetAllWorkOrdersResponse(
    IReadOnlyList<WorkOrderDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetAllWorkOrdersQuery.
/// Returns all work orders for the current user's account.
/// Note: Explicit tenant isolation and soft delete filtering for defense-in-depth
/// alongside global query filters.
/// </summary>
public class GetAllWorkOrdersQueryHandler : IRequestHandler<GetAllWorkOrdersQuery, GetAllWorkOrdersResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetAllWorkOrdersQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetAllWorkOrdersResponse> Handle(GetAllWorkOrdersQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.WorkOrders
            .Where(w => w.AccountId == _currentUser.AccountId && w.DeletedAt == null)
            .Include(w => w.Property)
            .Include(w => w.Vendor)
            .Include(w => w.Category)
            .Include(w => w.TagAssignments)
                .ThenInclude(a => a.Tag)
            .AsQueryable();

        // Apply optional status filter
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = query.Where(w => w.Status.ToString() == request.Status);
        }

        // Apply optional property filter
        if (request.PropertyId.HasValue)
        {
            query = query.Where(w => w.PropertyId == request.PropertyId.Value);
        }

        var workOrders = await query
            .OrderByDescending(w => w.CreatedAt)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var workOrderDtos = workOrders.Select(w => new WorkOrderDto(
            w.Id,
            w.PropertyId,
            w.Property.Name,
            w.VendorId,
            w.Vendor?.FullName,
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

        return new GetAllWorkOrdersResponse(workOrderDtos, workOrderDtos.Count);
    }
}
