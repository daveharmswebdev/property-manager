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

    public ConfirmPhotoUploadHandler(IPhotoService photoService)
    {
        _photoService = photoService;
    }

    public async Task<ConfirmPhotoUploadResponse> Handle(
        ConfirmPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
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
