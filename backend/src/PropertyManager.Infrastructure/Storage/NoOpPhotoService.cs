using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
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
        if (accountId == Guid.Empty)
        {
            throw new ArgumentException("Account ID is required.", nameof(accountId));
        }

        PhotoValidation.ValidateRequest(request);

        var extension = PhotoValidation.GetExtensionFromContentType(request.ContentType);
        var entityTypePath = request.EntityType.ToString().ToLowerInvariant();
        var year = DateTime.UtcNow.Year;
        var fileId = Guid.NewGuid();

        var storageKey = $"{accountId}/{entityTypePath}/{year}/{fileId}{extension}";
        var thumbnailKey = $"{accountId}/{entityTypePath}/{year}/{fileId}_thumb.jpg";

        _logger.LogWarning(
            "NoOp: Cannot generate presigned upload URL for photo - S3 storage not configured. StorageKey: {StorageKey}",
            LogSanitizer.MaskStorageKey(storageKey));

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
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.StorageKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.ThumbnailStorageKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(contentType);

        if (fileSizeBytes <= 0)
        {
            throw new ArgumentException("File size must be greater than zero.", nameof(fileSizeBytes));
        }

        _logger.LogWarning(
            "NoOp: Cannot confirm photo upload - S3 storage not configured. StorageKey: {StorageKey}",
            LogSanitizer.MaskStorageKey(request.StorageKey));

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
        ArgumentException.ThrowIfNullOrWhiteSpace(storageKey);

        _logger.LogWarning(
            "NoOp: Cannot generate presigned download URL for photo - S3 storage not configured. StorageKey: {StorageKey}",
            LogSanitizer.MaskStorageKey(storageKey));

        return Task.FromResult($"https://noop-storage.local/{storageKey}");
    }

    /// <inheritdoc />
    public Task<string> GetThumbnailUrlAsync(
        string thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(thumbnailStorageKey);

        _logger.LogWarning(
            "NoOp: Cannot generate presigned download URL for thumbnail - S3 storage not configured. ThumbnailKey: {ThumbnailKey}",
            LogSanitizer.MaskStorageKey(thumbnailStorageKey));

        return Task.FromResult($"https://noop-storage.local/{thumbnailStorageKey}");
    }

    /// <inheritdoc />
    public Task DeletePhotoAsync(
        string storageKey,
        string? thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(storageKey);

        _logger.LogInformation(
            "NoOp: Would delete photo {StorageKey} and thumbnail {ThumbnailKey}",
            LogSanitizer.MaskStorageKey(storageKey),
            thumbnailStorageKey != null ? LogSanitizer.MaskStorageKey(thumbnailStorageKey) : "(none)");

        return Task.CompletedTask;
    }
}
