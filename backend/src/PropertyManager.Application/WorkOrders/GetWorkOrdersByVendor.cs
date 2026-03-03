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
    private readonly IPhotoService _photoService;

    public GetWorkOrdersByVendorQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IPhotoService photoService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _photoService = photoService;
    }

    public async Task<GetWorkOrdersByVendorResult> Handle(GetWorkOrdersByVendorQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.WorkOrders
            .Where(w => w.AccountId == _currentUser.AccountId && w.DeletedAt == null)
            .Where(w => w.VendorId == request.VendorId)
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

        return new GetWorkOrdersByVendorResult(workOrderDtos.ToList(), totalCount);
    }
}
