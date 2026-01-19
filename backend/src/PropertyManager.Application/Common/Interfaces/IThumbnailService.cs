namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for generating image thumbnails.
/// Implementations handle resizing, format conversion, and metadata stripping.
/// </summary>
public interface IThumbnailService
{
    /// <summary>
    /// Generates a thumbnail from an image stream.
    /// </summary>
    /// <param name="imageStream">Stream containing the source image.</param>
    /// <param name="maxWidth">Maximum width of the thumbnail in pixels.</param>
    /// <param name="maxHeight">Maximum height of the thumbnail in pixels.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Byte array containing the thumbnail as JPEG.</returns>
    /// <remarks>
    /// - Maintains aspect ratio (fits within bounds, no cropping)
    /// - Output format is always JPEG
    /// - All EXIF metadata is stripped for privacy
    /// - Very small images are not upscaled
    /// </remarks>
    Task<byte[]> GenerateThumbnailAsync(
        Stream imageStream,
        int maxWidth,
        int maxHeight,
        CancellationToken cancellationToken = default);
}
