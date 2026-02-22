using Microsoft.Extensions.Logging;
using PDFtoImage;
using PropertyManager.Application.Common.Interfaces;
using SkiaSharp;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// PDFtoImage-based implementation of IPdfRendererService.
/// Renders the first page of a PDF to a PNG image using PDFium.
/// </summary>
public class PdfRendererService : IPdfRendererService
{
    private readonly ILogger<PdfRendererService> _logger;

    public PdfRendererService(ILogger<PdfRendererService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<byte[]> RenderFirstPageToImageAsync(
        Stream pdfStream,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var bitmap = Conversion.ToImage(pdfStream, page: 0);
            using var data = bitmap.Encode(SKEncodedImageFormat.Png, 100);

            _logger.LogInformation(
                "Rendered PDF first page to PNG: {Size} bytes",
                data.Size);

            return Task.FromResult(data.ToArray());
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to render PDF first page");
            throw new InvalidOperationException($"Unable to render PDF: {ex.Message}", ex);
        }
    }
}
