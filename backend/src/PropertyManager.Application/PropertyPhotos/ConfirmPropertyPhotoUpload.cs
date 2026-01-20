using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Response model for confirmed property photo upload.
/// </summary>
public record ConfirmPropertyPhotoUploadResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

/// <summary>
/// Command to confirm a property photo upload and create PropertyPhoto record (AC-13.3a.4).
/// Auto-sets IsPrimary=true if this is the first photo for the property.
/// </summary>
public record ConfirmPropertyPhotoUploadCommand(
    Guid PropertyId,
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<ConfirmPropertyPhotoUploadResponse>;

/// <summary>
/// Handler for ConfirmPropertyPhotoUploadCommand.
/// Creates PropertyPhoto record with auto-primary logic for first photo.
/// </summary>
public class ConfirmPropertyPhotoUploadHandler : IRequestHandler<ConfirmPropertyPhotoUploadCommand, ConfirmPropertyPhotoUploadResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ConfirmPropertyPhotoUploadHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<ConfirmPropertyPhotoUploadResponse> Handle(
        ConfirmPropertyPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
        // Verify property exists and belongs to user's account (AC-13.3a.10)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
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

        // Check if this is the first photo for the property (auto-primary logic)
        var existingPhotoCount = await _dbContext.PropertyPhotos
            .CountAsync(pp => pp.PropertyId == request.PropertyId, cancellationToken);

        var isFirstPhoto = existingPhotoCount == 0;

        // Determine DisplayOrder (next in sequence)
        var maxDisplayOrder = await _dbContext.PropertyPhotos
            .Where(pp => pp.PropertyId == request.PropertyId)
            .MaxAsync(pp => (int?)pp.DisplayOrder, cancellationToken) ?? -1;

        var propertyPhoto = new PropertyPhoto
        {
            AccountId = _currentUser.AccountId,
            PropertyId = request.PropertyId,
            StorageKey = photoRecord.StorageKey,
            ThumbnailStorageKey = photoRecord.ThumbnailStorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = photoRecord.ContentType,
            FileSizeBytes = photoRecord.FileSizeBytes,
            DisplayOrder = maxDisplayOrder + 1,
            IsPrimary = isFirstPhoto, // Auto-set primary if first photo (AC-13.3a.4)
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.PropertyPhotos.Add(propertyPhoto);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Generate presigned URLs for response
        string? thumbnailUrl = null;
        string? viewUrl = null;

        if (!string.IsNullOrEmpty(propertyPhoto.ThumbnailStorageKey))
        {
            thumbnailUrl = await _photoService.GetThumbnailUrlAsync(propertyPhoto.ThumbnailStorageKey, cancellationToken);
        }

        viewUrl = await _photoService.GetPhotoUrlAsync(propertyPhoto.StorageKey, cancellationToken);

        return new ConfirmPropertyPhotoUploadResponse(
            Id: propertyPhoto.Id,
            ThumbnailUrl: thumbnailUrl,
            ViewUrl: viewUrl);
    }
}
