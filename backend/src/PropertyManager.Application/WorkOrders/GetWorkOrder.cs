using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Query to get a single work order by ID.
/// </summary>
public record GetWorkOrderQuery(Guid Id) : IRequest<WorkOrderDto>;

/// <summary>
/// Handler for GetWorkOrderQuery.
/// Returns full work order details including property, vendor, category, and tags.
/// Implements tenant isolation and soft-delete filtering for security.
/// </summary>
public class GetWorkOrderQueryHandler : IRequestHandler<GetWorkOrderQuery, WorkOrderDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetWorkOrderQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<WorkOrderDto> Handle(GetWorkOrderQuery request, CancellationToken cancellationToken)
    {
        var workOrder = await _dbContext.WorkOrders
            .Where(w => w.Id == request.Id
                && w.AccountId == _currentUser.AccountId
                && w.DeletedAt == null)
            .Include(w => w.Property)
            .Include(w => w.Vendor)
            .Include(w => w.Category)
            .Include(w => w.TagAssignments)
                .ThenInclude(a => a.Tag)
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (workOrder is null)
        {
            throw new NotFoundException("WorkOrder", request.Id);
        }

        return new WorkOrderDto(
            workOrder.Id,
            workOrder.PropertyId,
            workOrder.Property.Name,
            workOrder.VendorId,
            workOrder.Vendor?.FullName,
            workOrder.IsDiy,
            workOrder.CategoryId,
            workOrder.Category?.Name,
            workOrder.Status.ToString(),
            workOrder.Description,
            workOrder.CreatedAt,
            workOrder.CreatedByUserId,
            workOrder.TagAssignments
                .Select(a => new WorkOrderTagDto(a.Tag.Id, a.Tag.Name))
                .ToList()
        );
    }
}
