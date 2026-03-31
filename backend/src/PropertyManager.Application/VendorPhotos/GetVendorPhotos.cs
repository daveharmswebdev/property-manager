using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// DTO for vendor photo in list response.
/// </summary>
public record VendorPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string OriginalFileName,
    long FileSizeBytes,
    DateTime CreatedAt);

/// <summary>
/// Response model for GetVendorPhotos query.
/// </summary>
public record GetVendorPhotosResponse(
    IReadOnlyList<VendorPhotoDto> Items);

/// <summary>
/// Query to get all photos for a vendor ordered by DisplayOrder.
/// Includes presigned view URLs.
/// </summary>
public record GetVendorPhotosQuery(
    Guid VendorId
) : IRequest<GetVendorPhotosResponse>;

/// <summary>
/// Handler for GetVendorPhotosQuery.
/// Returns all photos for the vendor with presigned URLs.
/// </summary>
public class GetVendorPhotosHandler : IRequestHandler<GetVendorPhotosQuery, GetVendorPhotosResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetVendorPhotosHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetVendorPhotosResponse> Handle(
        GetVendorPhotosQuery request,
        CancellationToken cancellationToken)
    {
        // Verify vendor exists and belongs to user's account
        var vendorExists = await _dbContext.Vendors
            .AnyAsync(v => v.Id == request.VendorId && v.AccountId == _currentUser.AccountId && v.DeletedAt == null, cancellationToken);

        if (!vendorExists)
        {
            throw new NotFoundException(nameof(Vendor), request.VendorId);
        }

        // Get all photos ordered by DisplayOrder
        var photos = await _dbContext.VendorPhotos
            .Where(vp => vp.VendorId == request.VendorId && vp.AccountId == _currentUser.AccountId)
            .OrderBy(vp => vp.DisplayOrder)
            .Select(vp => new
            {
                vp.Id,
                vp.StorageKey,
                vp.ThumbnailStorageKey,
                vp.IsPrimary,
                vp.DisplayOrder,
                vp.OriginalFileName,
                vp.FileSizeBytes,
                vp.CreatedAt
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

            return new VendorPhotoDto(
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

        return new GetVendorPhotosResponse(photoDtos.ToList());
    }
}
