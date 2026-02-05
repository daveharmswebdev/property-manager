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
    private readonly IPhotoService _photoService;

    public GetWorkOrdersByPropertyQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IPhotoService photoService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _photoService = photoService;
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
            .Include(w => w.Photos)
            .OrderByDescending(w => w.CreatedAt)
            .AsNoTracking();

        var totalCount = await query.CountAsync(cancellationToken);

        var workOrders = request.Limit.HasValue
            ? await query.Take(request.Limit.Value).ToListAsync(cancellationToken)
            : await query.ToListAsync(cancellationToken);

        // Generate presigned URLs for primary photo thumbnails in parallel
        var thumbnailTasks = workOrders.Select(async w =>
        {
            var primaryPhoto = w.Photos.FirstOrDefault(p => p.IsPrimary)
                ?? w.Photos.OrderBy(p => p.DisplayOrder).FirstOrDefault();

            string? thumbnailUrl = null;
            if (primaryPhoto?.ThumbnailStorageKey != null)
            {
                thumbnailUrl = await _photoService.GetThumbnailUrlAsync(primaryPhoto.ThumbnailStorageKey, cancellationToken);
            }

            return new WorkOrderDto(
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
                    .ToList(),
                thumbnailUrl
            );
        }).ToList();

        var workOrderDtos = await Task.WhenAll(thumbnailTasks);

        return new GetWorkOrdersByPropertyResult(workOrderDtos.ToList(), totalCount);
    }
}
