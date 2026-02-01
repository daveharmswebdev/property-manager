using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// Generic photo service implementation with thumbnail support.
/// Uses IStorageService for S3 operations and IThumbnailService for image processing.
/// </summary>
public class PhotoService : IPhotoService
{
    private readonly IStorageService _storageService;
    private readonly IThumbnailService _thumbnailService;
    private readonly HttpClient _httpClient;
    private readonly ILogger<PhotoService> _logger;

    private const int ThumbnailMaxWidth = 300;
    private const int ThumbnailMaxHeight = 300;

    public PhotoService(
        IStorageService storageService,
        IThumbnailService thumbnailService,
        HttpClient httpClient,
        ILogger<PhotoService> logger)
    {
        _storageService = storageService;
        _thumbnailService = thumbnailService;
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<PhotoUploadResult> GenerateUploadUrlAsync(
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

        // Storage key pattern: {accountId}/{entityType}/{year}/{guid}.{ext}
        var storageKey = $"{accountId}/{entityTypePath}/{year}/{fileId}{extension}";
        var thumbnailStorageKey = $"{accountId}/{entityTypePath}/{year}/{fileId}_thumb.jpg";

        _logger.LogInformation(
            "Generating upload URL for {EntityType} photo: {StorageKey}",
            request.EntityType,
            LogSanitizer.MaskStorageKey(storageKey));

        var uploadResult = await _storageService.GeneratePresignedUploadUrlAsync(
            storageKey,
            request.ContentType,
            request.FileSizeBytes,
            cancellationToken);

        return new PhotoUploadResult(
            uploadResult.Url,
            storageKey,
            thumbnailStorageKey,
            uploadResult.ExpiresAt);
    }

    /// <inheritdoc />
    public async Task<PhotoRecord> ConfirmUploadAsync(
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

        _logger.LogInformation(
            "Confirming upload and generating thumbnail for {StorageKey}",
            LogSanitizer.MaskStorageKey(request.StorageKey));

        string? confirmedThumbnailKey = null;

        try
        {
            // Download the original image
            var downloadUrl = await _storageService.GeneratePresignedDownloadUrlAsync(
                request.StorageKey,
                cancellationToken);

            var imageBytes = await _httpClient.GetByteArrayAsync(downloadUrl, cancellationToken);

            _logger.LogDebug(
                "Downloaded original image: {Size} bytes",
                imageBytes.Length);

            // Generate thumbnail
            using var imageStream = new MemoryStream(imageBytes);
            var thumbnailBytes = await _thumbnailService.GenerateThumbnailAsync(
                imageStream,
                ThumbnailMaxWidth,
                ThumbnailMaxHeight,
                cancellationToken);

            // Upload thumbnail
            var thumbnailUploadResult = await _storageService.GeneratePresignedUploadUrlAsync(
                request.ThumbnailStorageKey,
                "image/jpeg",
                thumbnailBytes.Length,
                cancellationToken);

            using var thumbnailContent = new ByteArrayContent(thumbnailBytes);
            thumbnailContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");

            var uploadResponse = await _httpClient.PutAsync(
                thumbnailUploadResult.Url,
                thumbnailContent,
                cancellationToken);

            uploadResponse.EnsureSuccessStatusCode();

            confirmedThumbnailKey = request.ThumbnailStorageKey;

            _logger.LogInformation(
                "Thumbnail generated and uploaded successfully: {ThumbnailKey}",
                LogSanitizer.MaskStorageKey(confirmedThumbnailKey));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Thumbnail generation failure should NOT block upload confirmation
            _logger.LogWarning(ex,
                "Failed to generate thumbnail for {StorageKey}, continuing without thumbnail",
                LogSanitizer.MaskStorageKey(request.StorageKey));
        }

        return new PhotoRecord(
            request.StorageKey,
            confirmedThumbnailKey,
            contentType,
            fileSizeBytes);
    }

    /// <inheritdoc />
    public Task<string> GetPhotoUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(storageKey);
        return _storageService.GeneratePresignedDownloadUrlAsync(storageKey, cancellationToken);
    }

    /// <inheritdoc />
    public Task<string> GetThumbnailUrlAsync(
        string thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(thumbnailStorageKey);
        return _storageService.GeneratePresignedDownloadUrlAsync(thumbnailStorageKey, cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeletePhotoAsync(
        string storageKey,
        string? thumbnailStorageKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(storageKey);

        _logger.LogInformation(
            "Deleting photo {StorageKey} and thumbnail {ThumbnailStorageKey}",
            LogSanitizer.MaskStorageKey(storageKey),
            thumbnailStorageKey != null ? LogSanitizer.MaskStorageKey(thumbnailStorageKey) : "(none)");

        await _storageService.DeleteFileAsync(storageKey, cancellationToken);

        if (!string.IsNullOrEmpty(thumbnailStorageKey))
        {
            await _storageService.DeleteFileAsync(thumbnailStorageKey, cancellationToken);
        }
    }
}
