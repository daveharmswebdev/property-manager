using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Photos;

/// <summary>
/// Request model for generating a photo upload URL.
/// </summary>
public record GeneratePhotoUploadUrlRequest(
    PhotoEntityType EntityType,
    Guid EntityId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Response model containing presigned upload URL details.
/// </summary>
public record GeneratePhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Command to generate a presigned upload URL for a photo.
/// </summary>
public record GeneratePhotoUploadUrlCommand(
    PhotoEntityType EntityType,
    Guid EntityId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<GeneratePhotoUploadUrlResponse>;

/// <summary>
/// Handler for GeneratePhotoUploadUrlCommand.
/// Uses IPhotoService to generate presigned upload URL.
/// </summary>
public class GeneratePhotoUploadUrlHandler : IRequestHandler<GeneratePhotoUploadUrlCommand, GeneratePhotoUploadUrlResponse>
{
    private readonly IPhotoService _photoService;
    private readonly ICurrentUser _currentUser;

    public GeneratePhotoUploadUrlHandler(
        IPhotoService photoService,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _currentUser = currentUser;
    }

    public async Task<GeneratePhotoUploadUrlResponse> Handle(
        GeneratePhotoUploadUrlCommand request,
        CancellationToken cancellationToken)
    {
        var photoRequest = new PhotoUploadRequest(
            request.EntityType,
            request.EntityId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var result = await _photoService.GenerateUploadUrlAsync(
            _currentUser.AccountId,
            photoRequest,
            cancellationToken);

        return new GeneratePhotoUploadUrlResponse(
            UploadUrl: result.UploadUrl,
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ExpiresAt: result.ExpiresAt);
    }
}
