using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Photos;

/// <summary>
/// Response model for confirmed photo upload.
/// </summary>
public record ConfirmPhotoUploadResponse(
    string StorageKey,
    string? ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes);

/// <summary>
/// Command to confirm a photo upload and trigger thumbnail generation.
/// </summary>
public record ConfirmPhotoUploadCommand(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes
) : IRequest<ConfirmPhotoUploadResponse>;

/// <summary>
/// Handler for ConfirmPhotoUploadCommand.
/// Confirms the upload and generates a thumbnail via IPhotoService.
/// </summary>
public class ConfirmPhotoUploadHandler : IRequestHandler<ConfirmPhotoUploadCommand, ConfirmPhotoUploadResponse>
{
    private readonly IPhotoService _photoService;
    private readonly ICurrentUser _currentUser;

    public ConfirmPhotoUploadHandler(IPhotoService photoService, ICurrentUser currentUser)
    {
        _photoService = photoService;
        _currentUser = currentUser;
    }

    public async Task<ConfirmPhotoUploadResponse> Handle(
        ConfirmPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
        // Validate that the storage key belongs to the current user's account
        // Storage key format: {accountId}/{entityType}/{year}/{guid}.{ext}
        var keyParts = request.StorageKey.Split('/');
        if (keyParts.Length < 1 || !Guid.TryParse(keyParts[0], out var keyAccountId))
        {
            throw new ArgumentException("Invalid storage key format", nameof(request.StorageKey));
        }

        if (keyAccountId != _currentUser.AccountId)
        {
            throw new UnauthorizedAccessException("Cannot confirm upload for another account");
        }

        var confirmRequest = new ConfirmPhotoUploadRequest(
            request.StorageKey,
            request.ThumbnailStorageKey);

        var result = await _photoService.ConfirmUploadAsync(
            confirmRequest,
            request.ContentType,
            request.FileSizeBytes,
            cancellationToken);

        return new ConfirmPhotoUploadResponse(
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ContentType: result.ContentType,
            FileSizeBytes: result.FileSizeBytes);
    }
}
