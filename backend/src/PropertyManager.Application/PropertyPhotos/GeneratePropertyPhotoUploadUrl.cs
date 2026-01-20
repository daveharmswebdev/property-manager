using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Response model containing presigned upload URL details for property photos.
/// </summary>
public record GeneratePropertyPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Command to generate a presigned upload URL for a property photo (AC-13.3a.3).
/// </summary>
public record GeneratePropertyPhotoUploadUrlCommand(
    Guid PropertyId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<GeneratePropertyPhotoUploadUrlResponse>;

/// <summary>
/// Handler for GeneratePropertyPhotoUploadUrlCommand.
/// Uses IPhotoService to generate presigned upload URL after verifying property ownership.
/// </summary>
public class GeneratePropertyPhotoUploadUrlHandler : IRequestHandler<GeneratePropertyPhotoUploadUrlCommand, GeneratePropertyPhotoUploadUrlResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GeneratePropertyPhotoUploadUrlHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GeneratePropertyPhotoUploadUrlResponse> Handle(
        GeneratePropertyPhotoUploadUrlCommand request,
        CancellationToken cancellationToken)
    {
        // Verify property exists and belongs to user's account (AC-13.3a.10)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        var photoRequest = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            request.PropertyId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var result = await _photoService.GenerateUploadUrlAsync(
            _currentUser.AccountId,
            photoRequest,
            cancellationToken);

        return new GeneratePropertyPhotoUploadUrlResponse(
            UploadUrl: result.UploadUrl,
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ExpiresAt: result.ExpiresAt);
    }
}
