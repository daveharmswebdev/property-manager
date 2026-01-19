using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// No-op implementation of IPhotoService for local development and CI environments.
/// Logs operations but does not persist to external storage.
/// </summary>
public class NoOpPhotoService : IPhotoService
{
    private readonly ILogger<NoOpPhotoService> _logger;

    public NoOpPhotoService(ILogger<NoOpPhotoService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<PhotoUploadResult> GenerateUploadUrlAsync(
        Guid accountId,
        PhotoUploadRequest request,
        CancellationToken cancellationToken = default)
    {
        var storageKey = $"{accountId}/{request.EntityType.ToString().ToLowerInvariant()}/{DateTime.UtcNow.Year}/{Guid.NewGuid()}.jpg";
        var thumbnailKey = storageKey.Replace(".jpg", "_thumb.jpg");

        _logger.LogWarning(
            "NoOp: Cannot generate presigned upload URL for photo - S3 storage not configured. StorageKey: {StorageKey}",
            storageKey);

        return Task.FromResult(new PhotoUploadResult(
            $"https://noop-storage.local/{storageKey}",
            storageKey,
            thumbnailKey,
            DateTime.UtcNow.AddHours(1)));
    }

    /// <inheritdoc />
    public Task<PhotoRecord> ConfirmUploadAsync(
        ConfirmPhotoUploadRequest request,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot confirm photo upload - S3 storage not configured. StorageKey: {StorageKey}",
            request.StorageKey);

        return Task.FromResult(new PhotoRecord(
            request.StorageKey,
            request.ThumbnailStorageKey,
            contentType,
            fileSizeBytes));
    }

    /// <inheritdoc />
    public Task<string> GetPhotoUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot generate presigned download URL for photo - S3 storage not configured. StorageKey: {StorageKey}",
            storageKey);

        return Task.FromResult($"https://noop-storage.local/{storageKey}");
    }

    /// <inheritdoc />
    public Task<string> GetThumbnailUrlAsync(
        string thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot generate presigned download URL for thumbnail - S3 storage not configured. ThumbnailKey: {ThumbnailKey}",
            thumbnailStorageKey);

        return Task.FromResult($"https://noop-storage.local/{thumbnailStorageKey}");
    }

    /// <inheritdoc />
    public Task DeletePhotoAsync(
        string storageKey,
        string? thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "NoOp: Would delete photo {StorageKey} and thumbnail {ThumbnailKey}",
            storageKey,
            thumbnailStorageKey ?? "(none)");

        return Task.CompletedTask;
    }
}
