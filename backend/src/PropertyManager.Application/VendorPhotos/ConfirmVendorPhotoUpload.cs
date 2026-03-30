using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Response model for confirmed vendor photo upload.
/// </summary>
public record ConfirmVendorPhotoUploadResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

/// <summary>
/// Command to confirm a vendor photo upload and create VendorPhoto record.
/// Auto-sets IsPrimary=true if this is the first photo for the vendor.
/// </summary>
public record ConfirmVendorPhotoUploadCommand(
    Guid VendorId,
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<ConfirmVendorPhotoUploadResponse>;

/// <summary>
/// Handler for ConfirmVendorPhotoUploadCommand.
/// Creates VendorPhoto record with auto-primary logic for first photo.
/// </summary>
public class ConfirmVendorPhotoUploadHandler : IRequestHandler<ConfirmVendorPhotoUploadCommand, ConfirmVendorPhotoUploadResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ConfirmVendorPhotoUploadHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<ConfirmVendorPhotoUploadResponse> Handle(
        ConfirmVendorPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
        // Verify vendor exists and belongs to user's account
        var vendorExists = await _dbContext.Vendors
            .AnyAsync(v => v.Id == request.VendorId && v.AccountId == _currentUser.AccountId && v.DeletedAt == null, cancellationToken);

        if (!vendorExists)
        {
            throw new NotFoundException(nameof(Vendor), request.VendorId);
        }

        // Validate storage key belongs to current user's account
        var keyParts = request.StorageKey.Split('/');
        if (keyParts.Length < 1 || !Guid.TryParse(keyParts[0], out var keyAccountId))
        {
            throw new ArgumentException("Invalid storage key format", nameof(request.StorageKey));
        }

        if (keyAccountId != _currentUser.AccountId)
        {
            throw new UnauthorizedAccessException("Cannot confirm upload for another account");
        }

        // Confirm upload and generate thumbnail via IPhotoService
        var confirmRequest = new ConfirmPhotoUploadRequest(
            request.StorageKey,
            request.ThumbnailStorageKey);

        var photoRecord = await _photoService.ConfirmUploadAsync(
            confirmRequest,
            request.ContentType,
            request.FileSizeBytes,
            cancellationToken);

        // Check if this is the first photo for the vendor (auto-primary logic)
        var existingPhotoCount = await _dbContext.VendorPhotos
            .CountAsync(vp => vp.VendorId == request.VendorId, cancellationToken);

        var isFirstPhoto = existingPhotoCount == 0;

        // Determine DisplayOrder (next in sequence)
        var maxDisplayOrder = await _dbContext.VendorPhotos
            .Where(vp => vp.VendorId == request.VendorId)
            .MaxAsync(vp => (int?)vp.DisplayOrder, cancellationToken) ?? -1;

        var vendorPhoto = new VendorPhoto
        {
            AccountId = _currentUser.AccountId,
            VendorId = request.VendorId,
            StorageKey = photoRecord.StorageKey,
            ThumbnailStorageKey = photoRecord.ThumbnailStorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = photoRecord.ContentType,
            FileSizeBytes = photoRecord.FileSizeBytes,
            DisplayOrder = maxDisplayOrder + 1,
            IsPrimary = isFirstPhoto,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.VendorPhotos.Add(vendorPhoto);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Generate presigned URLs for response
        string? thumbnailUrl = null;
        string? viewUrl = null;

        if (!string.IsNullOrEmpty(vendorPhoto.ThumbnailStorageKey))
        {
            thumbnailUrl = await _photoService.GetThumbnailUrlAsync(vendorPhoto.ThumbnailStorageKey, cancellationToken);
        }

        viewUrl = await _photoService.GetPhotoUrlAsync(vendorPhoto.StorageKey, cancellationToken);

        return new ConfirmVendorPhotoUploadResponse(
            Id: vendorPhoto.Id,
            ThumbnailUrl: thumbnailUrl,
            ViewUrl: viewUrl);
    }
}
