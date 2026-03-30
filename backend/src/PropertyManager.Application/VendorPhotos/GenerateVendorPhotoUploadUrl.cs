using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Response model containing presigned upload URL details for vendor photos.
/// </summary>
public record GenerateVendorPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Command to generate a presigned upload URL for a vendor photo.
/// </summary>
public record GenerateVendorPhotoUploadUrlCommand(
    Guid VendorId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<GenerateVendorPhotoUploadUrlResponse>;

/// <summary>
/// Handler for GenerateVendorPhotoUploadUrlCommand.
/// Uses IPhotoService to generate presigned upload URL after verifying vendor ownership.
/// </summary>
public class GenerateVendorPhotoUploadUrlHandler : IRequestHandler<GenerateVendorPhotoUploadUrlCommand, GenerateVendorPhotoUploadUrlResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GenerateVendorPhotoUploadUrlHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GenerateVendorPhotoUploadUrlResponse> Handle(
        GenerateVendorPhotoUploadUrlCommand request,
        CancellationToken cancellationToken)
    {
        // Verify vendor exists and belongs to user's account
        var vendorExists = await _dbContext.Vendors
            .AnyAsync(v => v.Id == request.VendorId && v.AccountId == _currentUser.AccountId && v.DeletedAt == null, cancellationToken);

        if (!vendorExists)
        {
            throw new NotFoundException(nameof(Vendor), request.VendorId);
        }

        var photoRequest = new PhotoUploadRequest(
            PhotoEntityType.Vendors,
            request.VendorId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var result = await _photoService.GenerateUploadUrlAsync(
            _currentUser.AccountId,
            photoRequest,
            cancellationToken);

        return new GenerateVendorPhotoUploadUrlResponse(
            UploadUrl: result.UploadUrl,
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ExpiresAt: result.ExpiresAt);
    }
}
