using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// DTO for work order photo in list response.
/// Includes IsPrimary and DisplayOrder for symmetric behavior with PropertyPhoto.
/// </summary>
public record WorkOrderPhotoDto(
    Guid Id,
    Guid WorkOrderId,
    string? OriginalFileName,
    string? ContentType,
    long? FileSizeBytes,
    int DisplayOrder,
    bool IsPrimary,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    string? PhotoUrl,
    string? ThumbnailUrl);

/// <summary>
/// Response model for GetWorkOrderPhotos query.
/// </summary>
public record GetWorkOrderPhotosResponse(
    IReadOnlyList<WorkOrderPhotoDto> Items);

/// <summary>
/// Query to get all photos for a work order (AC #5).
/// Photos are sorted by DisplayOrder ascending (primary first).
/// </summary>
public record GetWorkOrderPhotosQuery(
    Guid WorkOrderId
) : IRequest<GetWorkOrderPhotosResponse>;

/// <summary>
/// Handler for GetWorkOrderPhotosQuery.
/// Returns all photos for the work order with presigned URLs.
/// </summary>
public class GetWorkOrderPhotosHandler : IRequestHandler<GetWorkOrderPhotosQuery, GetWorkOrderPhotosResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetWorkOrderPhotosHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetWorkOrderPhotosResponse> Handle(
        GetWorkOrderPhotosQuery request,
        CancellationToken cancellationToken)
    {
        // Verify work order exists and belongs to user's account
        var workOrderExists = await _dbContext.WorkOrders
            .AnyAsync(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId, cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException(nameof(WorkOrder), request.WorkOrderId);
        }

        // Get all photos ordered by DisplayOrder ascending (primary first)
        var photos = await _dbContext.WorkOrderPhotos
            .Where(p => p.WorkOrderId == request.WorkOrderId && p.AccountId == _currentUser.AccountId)
            .OrderBy(p => p.DisplayOrder)
            .Select(p => new
            {
                p.Id,
                p.WorkOrderId,
                p.StorageKey,
                p.ThumbnailStorageKey,
                p.OriginalFileName,
                p.ContentType,
                p.FileSizeBytes,
                p.DisplayOrder,
                p.IsPrimary,
                p.CreatedByUserId,
                p.CreatedAt
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Generate presigned URLs for each photo in parallel for better performance
        var urlTasks = photos.Select(async photo =>
        {
            string? thumbnailUrl = null;
            string? photoUrl = null;

            if (!string.IsNullOrEmpty(photo.ThumbnailStorageKey))
            {
                thumbnailUrl = await _photoService.GetThumbnailUrlAsync(photo.ThumbnailStorageKey, cancellationToken);
            }

            if (!string.IsNullOrEmpty(photo.StorageKey))
            {
                photoUrl = await _photoService.GetPhotoUrlAsync(photo.StorageKey, cancellationToken);
            }

            return new WorkOrderPhotoDto(
                Id: photo.Id,
                WorkOrderId: photo.WorkOrderId,
                OriginalFileName: photo.OriginalFileName,
                ContentType: photo.ContentType,
                FileSizeBytes: photo.FileSizeBytes,
                DisplayOrder: photo.DisplayOrder,
                IsPrimary: photo.IsPrimary,
                CreatedByUserId: photo.CreatedByUserId,
                CreatedAt: photo.CreatedAt,
                PhotoUrl: photoUrl,
                ThumbnailUrl: thumbnailUrl);
        }).ToList();

        var photoDtos = await Task.WhenAll(urlTasks);

        return new GetWorkOrderPhotosResponse(photoDtos.ToList());
    }
}
