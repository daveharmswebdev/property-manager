namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Service for generating thumbnails for receipt files (images and PDFs).
/// Encapsulates the full pipeline: download original → render/resize → upload thumbnail.
/// </summary>
public interface IReceiptThumbnailService
{
    /// <summary>
    /// Generates a thumbnail for a receipt stored in S3.
    /// For images: resizes directly.
    /// For PDFs: renders first page to image, then resizes.
    /// </summary>
    /// <param name="storageKey">S3 storage key of the original receipt.</param>
    /// <param name="contentType">MIME type of the original receipt.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Thumbnail storage key, or null if generation failed.</returns>
    Task<string?> GenerateThumbnailAsync(
        string storageKey,
        string contentType,
        CancellationToken cancellationToken = default);
}
