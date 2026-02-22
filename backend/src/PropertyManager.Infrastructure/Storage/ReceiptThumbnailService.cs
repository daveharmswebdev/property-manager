using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// Service that generates thumbnails for receipt files (images and PDFs).
/// Encapsulates: download original → render (if PDF) → resize → upload thumbnail.
/// </summary>
public class ReceiptThumbnailService : IReceiptThumbnailService
{
    private readonly IStorageService _storageService;
    private readonly IThumbnailService _thumbnailService;
    private readonly IPdfRendererService _pdfRendererService;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ReceiptThumbnailService> _logger;

    private const int ThumbnailMaxWidth = 300;
    private const int ThumbnailMaxHeight = 300;

    public ReceiptThumbnailService(
        IStorageService storageService,
        IThumbnailService thumbnailService,
        IPdfRendererService pdfRendererService,
        HttpClient httpClient,
        ILogger<ReceiptThumbnailService> logger)
    {
        _storageService = storageService;
        _thumbnailService = thumbnailService;
        _pdfRendererService = pdfRendererService;
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<string?> GenerateThumbnailAsync(
        string storageKey,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation(
                "Generating thumbnail for receipt {StorageKey} (type: {ContentType})",
                LogSanitizer.MaskStorageKey(storageKey),
                contentType);

            // Download original file from S3
            var downloadUrl = await _storageService.GeneratePresignedDownloadUrlAsync(
                storageKey, cancellationToken);
            var fileBytes = await _httpClient.GetByteArrayAsync(downloadUrl, cancellationToken);

            _logger.LogDebug("Downloaded original file: {Size} bytes", fileBytes.Length);

            // Get image bytes (render from PDF if needed)
            byte[] imageBytes;
            if (contentType == "application/pdf")
            {
                using var pdfStream = new MemoryStream(fileBytes);
                imageBytes = await _pdfRendererService.RenderFirstPageToImageAsync(
                    pdfStream, cancellationToken);
            }
            else
            {
                imageBytes = fileBytes;
            }

            // Generate thumbnail using existing ImageSharp pipeline
            using var imageStream = new MemoryStream(imageBytes);
            var thumbnailBytes = await _thumbnailService.GenerateThumbnailAsync(
                imageStream, ThumbnailMaxWidth, ThumbnailMaxHeight, cancellationToken);

            // Derive thumbnail storage key from original key
            var thumbnailKey = DeriveThumbKey(storageKey);

            // Upload thumbnail to S3
            var uploadResult = await _storageService.GeneratePresignedUploadUrlAsync(
                thumbnailKey, "image/jpeg", thumbnailBytes.Length, cancellationToken);

            using var thumbnailContent = new ByteArrayContent(thumbnailBytes);
            thumbnailContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");

            var uploadResponse = await _httpClient.PutAsync(
                uploadResult.Url, thumbnailContent, cancellationToken);
            uploadResponse.EnsureSuccessStatusCode();

            _logger.LogInformation(
                "Thumbnail generated and uploaded: {ThumbnailKey}",
                LogSanitizer.MaskStorageKey(thumbnailKey));

            return thumbnailKey;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex,
                "Failed to generate thumbnail for {StorageKey}, continuing without thumbnail",
                LogSanitizer.MaskStorageKey(storageKey));
            return null;
        }
    }

    internal static string DeriveThumbKey(string storageKey)
    {
        var lastDot = storageKey.LastIndexOf('.');
        return lastDot >= 0
            ? $"{storageKey[..lastDot]}_thumb.jpg"
            : $"{storageKey}_thumb.jpg";
    }
}
