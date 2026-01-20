using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// DTO for property photo in list response.
/// </summary>
public record PropertyPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string OriginalFileName,
    long FileSizeBytes,
    DateTime CreatedAt);

/// <summary>
/// Response model for GetPropertyPhotos query.
/// </summary>
public record GetPropertyPhotosResponse(
    IReadOnlyList<PropertyPhotoDto> Items);

/// <summary>
/// Query to get all photos for a property ordered by DisplayOrder (AC-13.3a.8).
/// Includes presigned view URLs.
/// </summary>
public record GetPropertyPhotosQuery(
    Guid PropertyId
) : IRequest<GetPropertyPhotosResponse>;

/// <summary>
/// Handler for GetPropertyPhotosQuery.
/// Returns all photos for the property with presigned URLs.
/// </summary>
public class GetPropertyPhotosHandler : IRequestHandler<GetPropertyPhotosQuery, GetPropertyPhotosResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetPropertyPhotosHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetPropertyPhotosResponse> Handle(
        GetPropertyPhotosQuery request,
        CancellationToken cancellationToken)
    {
        // Verify property exists and belongs to user's account (AC-13.3a.10)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        // Get all photos ordered by DisplayOrder
        var photos = await _dbContext.PropertyPhotos
            .Where(pp => pp.PropertyId == request.PropertyId && pp.AccountId == _currentUser.AccountId)
            .OrderBy(pp => pp.DisplayOrder)
            .Select(pp => new
            {
                pp.Id,
                pp.StorageKey,
                pp.ThumbnailStorageKey,
                pp.IsPrimary,
                pp.DisplayOrder,
                pp.OriginalFileName,
                pp.FileSizeBytes,
                pp.CreatedAt
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Generate presigned URLs for each photo
        var photoDtos = new List<PropertyPhotoDto>();

        foreach (var photo in photos)
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

            photoDtos.Add(new PropertyPhotoDto(
                Id: photo.Id,
                ThumbnailUrl: thumbnailUrl,
                ViewUrl: viewUrl,
                IsPrimary: photo.IsPrimary,
                DisplayOrder: photo.DisplayOrder,
                OriginalFileName: photo.OriginalFileName,
                FileSizeBytes: photo.FileSizeBytes,
                CreatedAt: photo.CreatedAt));
        }

        return new GetPropertyPhotosResponse(photoDtos);
    }
}
