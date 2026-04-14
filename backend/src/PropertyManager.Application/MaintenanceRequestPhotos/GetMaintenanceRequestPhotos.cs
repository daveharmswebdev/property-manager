using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequestPhotos;

/// <summary>
/// DTO for maintenance request photo in list response.
/// Reused by GetMaintenanceRequestById detail endpoint.
/// </summary>
public record MaintenanceRequestPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string? OriginalFileName,
    long? FileSizeBytes,
    DateTime CreatedAt);

/// <summary>
/// Response model for GetMaintenanceRequestPhotos query.
/// </summary>
public record GetMaintenanceRequestPhotosResponse(
    IReadOnlyList<MaintenanceRequestPhotoDto> Items);

/// <summary>
/// Query to get all photos for a maintenance request ordered by DisplayOrder.
/// Includes presigned view URLs.
/// </summary>
public record GetMaintenanceRequestPhotosQuery(
    Guid MaintenanceRequestId
) : IRequest<GetMaintenanceRequestPhotosResponse>;

/// <summary>
/// Handler for GetMaintenanceRequestPhotosQuery.
/// Returns all photos for the maintenance request with presigned URLs.
/// </summary>
public class GetMaintenanceRequestPhotosHandler : IRequestHandler<GetMaintenanceRequestPhotosQuery, GetMaintenanceRequestPhotosResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetMaintenanceRequestPhotosHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetMaintenanceRequestPhotosResponse> Handle(
        GetMaintenanceRequestPhotosQuery request,
        CancellationToken cancellationToken)
    {
        // Verify maintenance request exists and belongs to user's account
        var maintenanceRequest = await _dbContext.MaintenanceRequests
            .Where(mr => mr.Id == request.MaintenanceRequestId
                && mr.AccountId == _currentUser.AccountId
                && mr.DeletedAt == null)
            .Select(mr => new { mr.Id, mr.PropertyId })
            .FirstOrDefaultAsync(cancellationToken);

        if (maintenanceRequest is null)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
        }

        // Tenant users can only access requests on their assigned property
        if (_currentUser.Role == "Tenant" && _currentUser.PropertyId.HasValue
            && maintenanceRequest.PropertyId != _currentUser.PropertyId.Value)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
        }

        // Get all photos ordered by DisplayOrder
        var photos = await _dbContext.MaintenanceRequestPhotos
            .Where(p => p.MaintenanceRequestId == request.MaintenanceRequestId && p.AccountId == _currentUser.AccountId)
            .OrderBy(p => p.DisplayOrder)
            .Select(p => new
            {
                p.Id,
                p.StorageKey,
                p.ThumbnailStorageKey,
                p.IsPrimary,
                p.DisplayOrder,
                p.OriginalFileName,
                p.FileSizeBytes,
                p.CreatedAt
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Generate presigned URLs for each photo in parallel for better performance
        var urlTasks = photos.Select(async photo =>
        {
            string? thumbnailUrl = null;
            string? viewUrl = null;

            if (!string.IsNullOrEmpty(photo.ThumbnailStorageKey))
            {
                thumbnailUrl = await _photoService.GetThumbnailUrlAsync(photo.ThumbnailStorageKey, cancellationToken);
            }

            if (!string.IsNullOrEmpty(photo.StorageKey))
            {
                viewUrl = await _photoService.GetPhotoUrlAsync(photo.StorageKey, cancellationToken);
            }

            return new MaintenanceRequestPhotoDto(
                Id: photo.Id,
                ThumbnailUrl: thumbnailUrl,
                ViewUrl: viewUrl,
                IsPrimary: photo.IsPrimary,
                DisplayOrder: photo.DisplayOrder,
                OriginalFileName: photo.OriginalFileName,
                FileSizeBytes: photo.FileSizeBytes,
                CreatedAt: photo.CreatedAt);
        }).ToList();

        var photoDtos = await Task.WhenAll(urlTasks);

        return new GetMaintenanceRequestPhotosResponse(photoDtos.ToList());
    }
}
