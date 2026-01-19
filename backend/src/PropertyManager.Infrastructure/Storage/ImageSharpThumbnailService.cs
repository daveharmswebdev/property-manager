using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// ImageSharp-based implementation of IThumbnailService.
/// Generates thumbnails with metadata stripping and JPEG output.
/// </summary>
public class ImageSharpThumbnailService : IThumbnailService
{
    private readonly ILogger<ImageSharpThumbnailService> _logger;
    private const int JpegQuality = 85;

    public ImageSharpThumbnailService(ILogger<ImageSharpThumbnailService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<byte[]> GenerateThumbnailAsync(
        Stream imageStream,
        int maxWidth,
        int maxHeight,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var image = await Image.LoadAsync(imageStream, cancellationToken);

            _logger.LogDebug(
                "Processing image: Original size {Width}x{Height}",
                image.Width,
                image.Height);

            // Strip EXIF metadata for privacy
            image.Metadata.ExifProfile = null;
            image.Metadata.IccProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            // Calculate new dimensions maintaining aspect ratio
            var (newWidth, newHeight) = CalculateResizeDimensions(
                image.Width,
                image.Height,
                maxWidth,
                maxHeight);

            // Only resize if the image is larger than the target
            if (newWidth < image.Width || newHeight < image.Height)
            {
                image.Mutate(x => x.Resize(newWidth, newHeight));

                _logger.LogDebug(
                    "Resized image to {Width}x{Height}",
                    newWidth,
                    newHeight);
            }
            else
            {
                _logger.LogDebug(
                    "Image smaller than target, not upscaling. Keeping {Width}x{Height}",
                    image.Width,
                    image.Height);
            }

            // Encode to JPEG
            using var outputStream = new MemoryStream();
            var encoder = new JpegEncoder { Quality = JpegQuality };
            await image.SaveAsync(outputStream, encoder, cancellationToken);

            _logger.LogInformation(
                "Generated thumbnail: {OutputSize} bytes",
                outputStream.Length);

            return outputStream.ToArray();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to generate thumbnail");
            throw new InvalidOperationException($"Unable to process image: {ex.Message}", ex);
        }
    }

    private static (int width, int height) CalculateResizeDimensions(
        int originalWidth,
        int originalHeight,
        int maxWidth,
        int maxHeight)
    {
        // If image is smaller than max dimensions, return original size
        if (originalWidth <= maxWidth && originalHeight <= maxHeight)
        {
            return (originalWidth, originalHeight);
        }

        // Calculate scale factor to fit within bounds
        var widthRatio = (double)maxWidth / originalWidth;
        var heightRatio = (double)maxHeight / originalHeight;
        var scale = Math.Min(widthRatio, heightRatio);

        var newWidth = (int)Math.Round(originalWidth * scale);
        var newHeight = (int)Math.Round(originalHeight * scale);

        return (newWidth, newHeight);
    }
}
