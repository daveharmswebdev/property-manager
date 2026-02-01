using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// No-op implementation of IStorageService for local development and CI environments.
/// Logs operations but does not persist to external storage.
/// Note: Presigned URLs will not work in this mode.
/// </summary>
public class NoOpStorageService : IStorageService
{
    private readonly ILogger<NoOpStorageService> _logger;

    public NoOpStorageService(ILogger<NoOpStorageService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<UploadUrlResult> GeneratePresignedUploadUrlAsync(
        string storageKey,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot generate presigned upload URL for {StorageKey} - S3 storage not configured",
            LogSanitizer.MaskStorageKey(storageKey));

        // Return a dummy URL that won't work, but allows the system to continue
        // This is acceptable for E2E tests that don't test actual file upload
        var dummyUrl = $"https://noop-storage.local/{storageKey}";
        var expiry = DateTime.UtcNow.AddHours(1);

        return Task.FromResult(new UploadUrlResult(dummyUrl, expiry));
    }

    /// <inheritdoc />
    public Task<string> GeneratePresignedDownloadUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot generate presigned download URL for {StorageKey} - S3 storage not configured",
            LogSanitizer.MaskStorageKey(storageKey));

        return Task.FromResult($"https://noop-storage.local/{storageKey}");
    }

    /// <inheritdoc />
    public Task DeleteFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "NoOp: Would delete file {StorageKey}",
            LogSanitizer.MaskStorageKey(storageKey));

        return Task.CompletedTask;
    }
}
