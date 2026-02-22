using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// No-op implementation of IReceiptThumbnailService for local development.
/// Returns null (no thumbnail generated) since S3 is not available locally.
/// </summary>
public class NoOpReceiptThumbnailService : IReceiptThumbnailService
{
    private readonly ILogger<NoOpReceiptThumbnailService> _logger;

    public NoOpReceiptThumbnailService(ILogger<NoOpReceiptThumbnailService> logger)
    {
        _logger = logger;
    }

    public Task<string?> GenerateThumbnailAsync(
        string storageKey,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "NoOp: Skipping thumbnail generation for receipt (type: {ContentType})",
            contentType);
        return Task.FromResult<string?>(null);
    }
}
